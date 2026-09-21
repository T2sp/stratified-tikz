import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { ownPageEvent } from '../../scripts/ownedPageEvent.mjs'

class Page extends EventEmitter {
  closed = false
  isClosed() { return this.closed }
  close() { this.closed = true; this.emit('close') }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const turn = () => new Promise((resolve) => setImmediate(resolve))
const clean = (page) => {
  assert.equal(page.listenerCount('download'), 0)
  assert.equal(page.listenerCount('filechooser'), 0)
  assert.equal(page.listenerCount('close'), 0)
}
// Track real timer removal without depending on private helper state.
function trackTimers(t) {
  const timers = new Set()
  const originalSet = globalThis.setTimeout
  const originalClear = globalThis.clearTimeout
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = originalSet(() => { timers.delete(timer); callback(...args) }, delay)
    timers.add(timer)
    return timer
  })
  t.mock.method(globalThis, 'clearTimeout', (timer) => { timers.delete(timer); originalClear(timer) })
  return timers
}

test('event timeout reaches the caller while action is pending; closing and draining owns late action rejection', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const action = deferred()
  let actionFinished = false
  page.once('close', () => action.reject(new Error('Native action cancelled by page close')))
  const wait = ownPageEvent(page, 'download', { timeoutMs: 15 })
  let failures = 0
  await wait.run(async ({ check }) => {
    await action.promise
    check()
    actionFinished = true
  }).catch((error) => { failures++; assert.match(error.message, /Timed out after 15ms waiting for download/) })
  assert.equal(failures, 1)
  assert.equal(actionFinished, false)
  assert.equal(page.listenerCount('download'), 0)
  assert.equal(timers.size, 0)
  page.close()
  await wait.drain()
  wait.dispose()
  clean(page)
  assert.equal(timers.size, 0)
})

test('a native action failure retains its original error and call log while the event wait is pending', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const failure = new Error('locator.click: Timeout 5000ms exceeded\nCall log:\n- inspector intercepts pointer events')
  const wait = ownPageEvent(page, 'download', { timeoutMs: 500 })
  await assert.rejects(wait.run(async () => { throw failure }), (error) => error === failure)
  await wait.drain()
  assert.deepEqual(await wait.outcome, { ok: false, error: failure })
  clean(page)
  assert.equal(timers.size, 0)
  page.close()
})

test('an immediate download before the click resolves is retained while action completion is still required', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const click = deferred()
  const download = { name: 'immediate.svg' }
  const wait = ownPageEvent(page, 'download', { timeoutMs: 500 })
  let completed = false
  const running = wait.run(async () => {
    page.emit('download', download)
    await click.promise
    return 'click completed'
  }).then((result) => { completed = true; return result })
  await turn()
  assert.equal(completed, false)
  clean(page)
  assert.equal(timers.size, 0)
  click.resolve()
  assert.deepEqual(await running, { event: download, value: 'click completed' })
  await wait.drain()
})

test('delayed delivery after action completion cleans ownership before a fresh attempt', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const wait = ownPageEvent(page, 'download', { timeoutMs: 500 })
  const running = wait.run(async () => 'clicked')
  await turn()
  const first = { name: 'first.svg' }
  page.emit('download', first)
  assert.deepEqual(await running, { event: first, value: 'clicked' })
  await wait.drain()
  clean(page)
  assert.equal(timers.size, 0)
  const second = { name: 'second.svg' }
  const retry = ownPageEvent(page, 'download', { timeoutMs: 500 })
  assert.deepEqual(await retry.run(async () => { page.emit('download', second) }), { event: second, value: undefined })
  await retry.drain()
  clean(page)
  assert.equal(timers.size, 0)
})

test('page close fails a pending event and a pending action remains observed until drained', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const action = deferred()
  const wait = ownPageEvent(page, 'download', { timeoutMs: 500 })
  const failure = assert.rejects(wait.run(() => action.promise), /Page closed while waiting for download/)
  await turn()
  page.close()
  await failure
  action.reject(new Error('Target page has been closed'))
  await wait.drain()
  clean(page)
  assert.equal(timers.size, 0)
})

test('dispose is idempotent before run and checks stop a staged continuation after cancellation', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const unused = ownPageEvent(page, 'filechooser', { timeoutMs: 500 })
  unused.dispose()
  unused.dispose()
  await unused.drain()
  assert.equal((await unused.outcome).ok, false)
  clean(page)
  assert.equal(timers.size, 0)

  const step = deferred()
  const wait = ownPageEvent(page, 'filechooser', { timeoutMs: 500 })
  let continuation = false
  const failure = new Error('intervening assertion failed')
  const running = assert.rejects(wait.run(async ({ check }) => {
    await step.promise
    check()
    continuation = true
  }), (error) => error === failure)
  await turn()
  wait.dispose(failure)
  await running
  step.resolve()
  await wait.drain()
  assert.equal(continuation, false)
  clean(page)
  assert.equal(timers.size, 0)
})

test('filechooser captures synchronous delivery and disposes on an intervening assertion failure', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  const chooser = { name: 'Load JSON' }
  const wait = ownPageEvent(page, 'filechooser', { timeoutMs: 500 })
  const failure = new Error('revision assertion failed')
  await assert.rejects(wait.run(async () => {
    page.emit('filechooser', chooser)
    throw failure
  }), (error) => error === failure)
  assert.deepEqual(await wait.outcome, { ok: true, event: chooser })
  await wait.drain()
  clean(page)
  assert.equal(timers.size, 0)
})

test('an already closed page fails without starting an action or leaving timers/listeners', async (t) => {
  const timers = trackTimers(t)
  const page = new Page()
  page.close()
  const wait = ownPageEvent(page, 'download', { timeoutMs: 500 })
  // Creation alone may settle; it never creates an unhandled rejected promise.
  await turn()
  assert.match((await wait.outcome).error.message, /Page closed/)
  let actionStarted = false
  await assert.rejects(wait.run(async () => { actionStarted = true }), /Page closed/)
  assert.equal(actionStarted, false)
  await wait.drain()
  clean(page)
  assert.equal(timers.size, 0)
})

test('invalid and unbounded event deadlines are rejected before listeners are installed', () => {
  const page = new Page()
  for (const timeoutMs of [0, -1, Infinity, NaN, undefined]) {
    assert.throws(() => ownPageEvent(page, 'download', { timeoutMs }), /finite and positive/)
    clean(page)
  }
})

test('strict rejection subprocess catches early event timeout and late native action rejection exactly once', () => {
  const helper = new URL('../../scripts/ownedPageEvent.mjs', import.meta.url).href
  const source = `
    import assert from 'node:assert/strict'
    import { EventEmitter } from 'node:events'
    import { ownPageEvent } from ${JSON.stringify(helper)}
    const page = new EventEmitter()
    page.isClosed = () => false
    let rejectClick
    let failures = 0
    const click = new Promise((_, reject) => { rejectClick = reject })
    const wait = ownPageEvent(page, 'download', { timeoutMs: 10 })
    try { await wait.run(() => click) }
    catch (error) {
      failures++
      assert.match(error.message, /Timed out/)
      page.emit('close')
      rejectClick(new Error('Native click cancelled after saved diagnostics'))
    }
    await wait.drain()
    wait.dispose()
    assert.equal(failures, 1)
    assert.equal(page.listenerCount('download'), 0)
    assert.equal(page.listenerCount('close'), 0)
    // A second wait can expire before run() without becoming an unhandled rejection.
    const unused = ownPageEvent(page, 'filechooser', { timeoutMs: 10 })
    await new Promise((resolve) => setTimeout(resolve, 25))
    assert.equal((await unused.outcome).ok, false)
    let started = false
    await assert.rejects(unused.run(() => { started = true }), /Timed out/)
    assert.equal(started, false)
    unused.dispose()
    await unused.drain()
    assert.equal(page.listenerCount('filechooser'), 0)
    assert.equal(page.listenerCount('close'), 0)
    await new Promise((resolve) => setTimeout(resolve, 25))
    process.stdout.write('caught once; drained; clean\\n')
  `
  const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', '--input-type=module', '-e', source], {
    encoding: 'utf8', timeout: 5000,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal(result.stdout, 'caught once; drained; clean\n')
})
