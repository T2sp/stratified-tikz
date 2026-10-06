import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { createClosedDashTransferContext, createClosedDashTransferFailures } from '../../scripts/closedDashTransferLifecycle.mjs'

class Page extends EventEmitter {
  closed = false
  constructor(name, closedResources) { super(); this.name = name; this.closedResources = closedResources }
  url() { return `file:///${this.name}.svg` }
  isClosed() { return this.closed }
  async close() { this.closedResources.push(this.name); this.closed = true; this.emit('close') }
}

async function setup(options = {}) {
  const pageErrors = [], ownedPages = [], closedResources = []
  class Context extends EventEmitter {
    pages = []
    async newPage() { const page = new Page(`page-${this.pages.length + 1}`, closedResources); this.pages.push(page); this.emit('page', page); return page }
    async close() { closedResources.push('context') }
  }
  const context = new Context(), calls = []
  const browser = {
    async newPage() { throw new Error('Implicit browser.newPage must not be used') },
    async newContext(options) { calls.push(options); return context },
  }
  const owner = await createClosedDashTransferContext({ browser, pageErrors, ownedPages, ...options })
  return { owner, context, calls, pageErrors, ownedPages, closedResources }
}

test('transfer owns an explicit context where main and saved-SVG pages coexist', async () => {
  const { owner, context, calls, ownedPages, closedResources } = await setup()
  const main = await owner.newPage('main-fixture'), standalone = await owner.newPage('standalone-triangle')
  assert.deepEqual(calls, [{ viewport: { width: 1600, height: 1600 } }])
  assert.equal(owner.context, context)
  assert.notEqual(main, standalone); assert.equal(main.isClosed(), false)
  assert.deepEqual(ownedPages.map(({ role }) => role), ['main-fixture', 'standalone-triangle'])
  await owner.closePage(standalone)
  assert.equal(main.isClosed(), false, 'Closing standalone cannot destroy the main fixture')
  assert.deepEqual(await owner.cleanup(), [])
  assert.deepEqual(closedResources, ['page-2', 'page-1', 'context'])
  assert.ok(ownedPages.every(({ closed }) => closed))
  assert.equal(context.listenerCount('page'), 0)
  assert.equal(main.listenerCount('pageerror'), 0); assert.equal(standalone.listenerCount('pageerror'), 0)
})

test('every owned page reports errors, including standalone and context-created popup pages', async () => {
  const { owner, context, pageErrors, ownedPages, closedResources } = await setup()
  const main = await owner.newPage('main-fixture'), standalone = await owner.newPage('standalone-square')
  const popup = new Page('popup', closedResources); context.emit('page', popup)
  main.emit('pageerror', new Error('fixture failure'))
  standalone.emit('pageerror', new Error('standalone failure'))
  popup.emit('pageerror', new Error('popup failure'))
  assert.deepEqual(pageErrors.map(({ role, message }) => [role, message]), [
    ['main-fixture', 'fixture failure'], ['standalone-square', 'standalone failure'], ['context-page', 'popup failure'],
  ])
  assert.deepEqual(ownedPages.map(({ pageErrors }) => pageErrors.length), [1, 1, 1])
  assert.throws(() => owner.assertNoPageErrors(standalone), /Owned transfer page errors/)
  assert.deepEqual(await owner.cleanup(), [])
  assert.deepEqual(closedResources, ['popup', 'page-2', 'page-1', 'context'])
  assert.equal(popup.listenerCount('pageerror'), 0)
})

test('first candidate or trusted action failure stays primary through export, reopen and cleanup failures', async () => {
  for (const stage of ['candidate', 'action']) {
    const record = { result: 'observed' }, failures = createClosedDashTransferFailures(record)
    const primary = new Error(`first ${stage} failure`), attempted = []
    failures.note(stage, primary)
    assert.equal(await failures.attempt('export', async () => { attempted.push('export'); throw new Error('export failure') }), undefined)
    assert.equal(await failures.attempt('reopen', async () => { attempted.push('reopen'); throw new Error('reopen failure') }), undefined)
    failures.note('cleanup', new Error('cleanup failure'))
    assert.deepEqual(attempted, ['export', 'reopen'], 'Independent artifact work still executes after the interaction failure')
    assert.equal(record.result, 'failed'); assert.equal(record.primaryFailureStage, stage)
    assert.equal(record.error.message, primary.message)
    assert.deepEqual(record.failures.map(({ stage }) => stage), [stage, 'export', 'reopen', 'cleanup'])
    assert.throws(() => failures.throwIfFailed(), (error) => error === primary)
  }
})

test('reopen failure is retained before its finally-cleanup error and duplicate catch preserves ordering', async () => {
  const record = {}, failures = createClosedDashTransferFailures(record), primary = new Error('saved SVG cannot reopen')
  await failures.attempt('reopen', async () => {
    try { throw primary }
    catch (error) { failures.note('reopen', error); throw error }
    finally { failures.note('cleanup', new Error('standalone close also failed')) }
  })
  assert.deepEqual(record.failures.map(({ stage }) => stage), ['reopen', 'cleanup'])
  assert.throws(() => failures.throwIfFailed(), (error) => error === primary)
})

test('bounded page cleanup owns late rejection and still closes other pages and context', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { owner, context, closedResources, ownedPages } = await setup({ timeoutMs: 15 })
  const main = await owner.newPage('main-fixture'), standalone = await owner.newPage('standalone-star')
  let entered, rejectLate
  const started = new Promise((resolve) => { entered = resolve })
  standalone.close = () => new Promise((_resolve, reject) => { rejectLate = reject; entered() })
  const cleanup = owner.cleanup()
  await started; t.mock.timers.tick(15)
  const errors = await cleanup
  assert.equal(errors.length, 1); assert.equal(errors[0].name, 'standalone-star-page')
  assert.match(errors[0].error.message, /Timed out after 15ms during transfer standalone-star page cleanup/)
  assert.equal(main.isClosed(), true); assert.deepEqual(closedResources, ['page-1', 'context'])
  assert.match(ownedPages[1].closeError.message, /Timed out/)
  rejectLate(new Error('late browser cancellation')); await new Promise((resolve) => setImmediate(resolve))
  assert.equal(context.listenerCount('page'), 0); assert.equal(standalone.listenerCount('pageerror'), 0)
})

test('cleanup alone fails the transfer and a context cleanup error remains separately recorded', async () => {
  const { owner, context } = await setup()
  const main = await owner.newPage('main-fixture')
  const pageFailure = new Error('main page close failed'), contextFailure = new Error('context close failed')
  main.close = async () => { throw pageFailure }; context.close = async () => { throw contextFailure }
  const errors = await owner.cleanup()
  assert.deepEqual(errors.map(({ name, error }) => [name, error]), [['main-fixture-page', pageFailure], ['browser-context', contextFailure]])
  const record = {}, failures = createClosedDashTransferFailures(record)
  for (const { name, error } of errors) failures.note(`cleanup:${name}`, error)
  assert.equal(record.result, 'failed'); assert.equal(record.error.message, pageFailure.message)
  assert.throws(() => failures.throwIfFailed(), (error) => error === pageFailure)
})
