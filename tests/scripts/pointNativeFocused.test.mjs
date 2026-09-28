import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { runFocusedNativePointAcceptance, runFocusedNativePointWorkflow } from '../../scripts/checkPointNodesAppFocused.mjs'

const bodyGroup = 'point-node-body-layout-lifecycle'
const exportGroup = 'point-node-settled-export'
const persistence = 'point-native-direct-cursor-workplanes-inspector-persistence'
const exports = ['point-native-pending-transparent-edit', 'point-native-pending-white-load',
  'point-whole-node-fallback-opacity-validation']
const reportName = 'focused-point-native-evidence.json'

async function fixture(t, overrides = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-focused-test-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const calls = [], handlers = new Map()
  const page = {
    on(name, handler) { handlers.set(name, handler); calls.push(`on:${name}`) },
    off(name, handler) { assert.equal(handlers.get(name), handler); handlers.delete(name); calls.push(`off:${name}`) },
    async goto(url, options) { calls.push({ goto: url, options }) },
    async waitForFunction(callback, argument, options) {
      assert.match(callback.toString(), /window.stzLabels !== undefined/)
      assert.equal(argument, undefined); assert.equal(options.timeout, 30_000)
      calls.push('renderer API ready')
    },
    async close() { calls.push('page close') },
  }
  const browser = {
    version: () => 'test-only mocked engine',
    async newPage(options) { calls.push({ newPage: options }); return page },
    async close() { calls.push('browser close') },
  }
  const server = {
    httpServer: { address: () => ({ port: 23456 }) },
    async listen() { calls.push('server listen') },
    async close() { calls.push('server close') },
  }
  const nativeChecks = async (context) => {
    calls.push('whole shared workflow invocation')
    assert.equal(context.page, page); assert.equal(context.browser, browser)
    assert.equal(context.origin, 'http://127.0.0.1:23456')
    await context.diagnose(bodyGroup, persistence, { boundary: 'mocked-before-controls', ambientDimension: 3, mode: 'standalone' })
    await context.saved(persistence, { unitTestOnly: true }, bodyGroup)
    context.setStage('point-node-settled-export')
    await context.startGroup(exportGroup)
    for (const name of exports) await context.saved(name, { unitTestOnly: true }, exportGroup)
    await context.completeGroup(exportGroup)
  }
  const options = {
    artifactDir, env: {},
    captureCheckout: () => { calls.push('checkout'); return {
      checkout: { fingerprint: 'unit-test-identity', untrackedSha256: { 'binary.png': 'raw-byte-hash' } },
      diff: Buffer.from([0, 255, 10]), untracked: { version: 2, files: { 'binary.png': { encoding: 'base64', data: 'AP8=' } } },
    } },
    loadChromium: async (name) => {
      assert.equal(name, 'playwright'); calls.push('playwright import')
      return { launch: async (options) => { calls.push({ launch: options }); return browser } }
    },
    createViteServer: async (options) => { calls.push({ server: options }); return server },
    nativeChecks, diagnosticTimeoutMs: 500, cleanupTimeoutMs: 100,
    ...overrides,
  }
  return { options, page, browser, server, calls, handlers,
    report: async () => JSON.parse(await readFile(join(artifactDir, reportName), 'utf8')) }
}

test('focused native wrapper invokes the entire shared workflow once before completing its native subset', async () => {
  const calls = [], context = {
    startGroup: async (name) => calls.push(`start ${name}`),
    completeGroup: async (name) => calls.push(`complete ${name}`),
  }
  await runFocusedNativePointWorkflow(context, async (actual) => {
    assert.equal(actual, context); calls.push('shared workflow, no dimension or saved-mode filter')
  })
  assert.deepEqual(calls, [`start ${bodyGroup}`, 'shared workflow, no dimension or saved-mode filter', `complete ${bodyGroup}`])
})

test('native workflow failure leaves native subset completion unreachable', async () => {
  const primary = new Error('visibility uncheck timeout'), calls = []
  await assert.rejects(runFocusedNativePointWorkflow({
    startGroup: async () => calls.push('start'), completeGroup: async () => calls.push('complete'),
  }, async () => { calls.push('native'); throw primary }), (error) => error === primary)
  assert.deepEqual(calls, ['start', 'native'])
})

test('focused runner retains normal fixture viewport, binary identity and explicit diagnostic-only scope', async (t) => {
  const f = await fixture(t)
  await runFocusedNativePointAcceptance(f.options)
  const report = await f.report()
  assert.equal(report.result, 'passed'); assert.equal(report.stage, 'complete')
  assert.match(report.scope, /not cumulative phase acceptance/)
  assert.match(report.scopeNote, /dash-cap audits are not executed/)
  assert.deepEqual(report.incompleteNativeScopes, []); assert.deepEqual(report.unexecutedNativeScopes, [])
  assert.deepEqual(report.evidence.map(({ name }) => name), [persistence, ...exports])
  assert.equal(report.afterCheckout.fingerprint, report.checkout.fingerprint)
  assert.deepEqual(await readFile(join(f.options.artifactDir, 'checkout.diff')), Buffer.from([0, 255, 10]))
  assert.equal(JSON.parse(await readFile(join(f.options.artifactDir, 'checkout-untracked.json'))).files['binary.png'].data, 'AP8=')
  assert.deepEqual(f.calls.find((item) => item.newPage), { newPage: { viewport: { width: 1100, height: 850 } } })
  assert.deepEqual(f.calls.find((item) => item.server), { server: { server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' } })
  assert.deepEqual(f.calls.find((item) => item.launch), { launch: { headless: true, timeout: 30_000 } })
  assert.deepEqual(f.calls.slice(-4), ['off:pageerror', 'page close', 'browser close', 'server close'])
  assert.equal(f.handlers.size, 0)
  assert.equal(report.observations.length, 5)
  const observation = JSON.parse(await readFile(join(f.options.artifactDir, report.observations[0].artifact), 'utf8'))
  assert.equal(observation.mode, 'standalone'); assert.equal(observation.ambientDimension, 3)
  assert.equal(report.observations[0].mode, undefined, 'Large observations remain file-backed')
})

test('native primary error and complete call log survive cleanup failures and a late rejected close', async (t) => {
  const primary = new Error("locator.uncheck: Timeout 30000ms exceeded.\nCall log:\n waiting for getByLabel('Enable approximate 3D visibility')\n scrolling into view if needed")
  primary.log = ['locator resolved to <input type="checkbox"/>', 'scrolling into view if needed']
  const f = await fixture(t, { nativeChecks: async () => { throw primary }, cleanupTimeoutMs: 10 })
  let rejectClose
  f.page.close = () => new Promise((resolve, reject) => { rejectClose = reject })
  f.browser.close = async () => { f.calls.push('browser close'); throw new Error('browser close failed') }
  await assert.rejects(runFocusedNativePointAcceptance(f.options), (error) => error === primary)
  rejectClose(new Error('late page close rejection'))
  await new Promise((resolve) => setImmediate(resolve))
  const report = await f.report()
  assert.equal(report.result, 'failed'); assert.equal(report.stage, 'point-node-native-input')
  assert.deepEqual(report.error, { message: primary.message, stack: primary.stack, log: primary.log })
  assert.deepEqual(report.completedNativeScopes, [])
  assert.deepEqual(report.unexecutedNativeScopes, [exportGroup])
  assert.equal(report.secondary.length, 2)
  assert.match(report.secondary[0].error.message, /Timed out after 10ms/)
  assert.equal(report.secondary[1].error.message, 'browser close failed')
  assert.equal(f.calls.at(-1), 'server close'); assert.equal(f.handlers.size, 0)
})

test('oversized native error message, stack and separate log have explicit bounded truncation', async (t) => {
  const primary = new Error('m'.repeat(70_000))
  primary.stack = 's'.repeat(70_000)
  primary.log = Array.from({ length: 140 }, () => 'l'.repeat(9000))
  const f = await fixture(t, { nativeChecks: async () => { throw primary } })
  await assert.rejects(runFocusedNativePointAcceptance(f.options), (error) => error === primary)
  const report = await f.report()
  assert.equal(report.error.message.length, 65_536); assert.equal(report.error.stack.length, 65_536)
  assert.equal(report.error.log.length, 128); assert.ok(report.error.log.every((entry) => entry.length === 8192))
  assert.deepEqual(report.error.truncated, { message: true, stack: true, log: true })
  assert.equal(primary.message.length, 70_000); assert.equal(primary.log.length, 140)
})

test('server listen restriction is reported at its actual stage without browser launch or native completion', async (t) => {
  const primary = Object.assign(new Error('listen EPERM: operation not permitted 127.0.0.1'), { code: 'EPERM' })
  const f = await fixture(t)
  f.server.listen = async () => { throw primary }
  await assert.rejects(runFocusedNativePointAcceptance(f.options), (error) => error === primary)
  const report = await f.report()
  assert.equal(report.stage, 'development-server-listen'); assert.equal(report.error.code, 'EPERM')
  assert.deepEqual(report.startedNativeScopes, []); assert.deepEqual(report.evidence, [])
  assert.equal(f.calls.some((item) => item.launch), false)
  assert.equal(f.calls.at(-1), 'server close')
})

test('failed capture/report writes cannot replace the native primary failure or skip cleanup', async (t) => {
  const primary = new Error('native original timeout')
  const f = await fixture(t, { nativeChecks: async () => { throw primary } })
  f.options.write = async (path, bytes) => {
    if (basename(path) === reportName && JSON.parse(bytes).result === 'failed') throw new Error('evidence disk failure')
    await writeFile(path, bytes)
  }
  await assert.rejects(runFocusedNativePointAcceptance(f.options), (error) => error === primary)
  assert.deepEqual(f.calls.slice(-4), ['off:pageerror', 'page close', 'browser close', 'server close'])
})

test('a stalled failure report has a finite deadline and owns its late rejection', async (t) => {
  const primary = new Error('native first error'), rejectWrites = []
  const f = await fixture(t, { nativeChecks: async () => { throw primary }, diagnosticTimeoutMs: 20 })
  f.options.write = (path, bytes) => {
    if (basename(path) === reportName && JSON.parse(bytes).result === 'failed') {
      return new Promise((resolve, reject) => { rejectWrites.push(reject) })
    }
    return writeFile(path, bytes)
  }
  await assert.rejects(runFocusedNativePointAcceptance(f.options), (error) => error === primary)
  assert.equal(rejectWrites.length, 2)
  rejectWrites.forEach((reject) => reject(new Error('late evidence failure')))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(f.calls.at(-1), 'server close')
})

test('a workflow that returns without required saved scenarios cannot claim a passing native subset', async (t) => {
  const f = await fixture(t, { nativeChecks: async () => {} })
  await assert.rejects(runFocusedNativePointAcceptance(f.options), /Completed native scenario/)
  const report = await f.report()
  assert.equal(report.result, 'failed'); assert.deepEqual(report.completedNativeScopes, [])
})

test('final evidence write failure is reported after cleanup and never printed as a pass', async (t) => {
  const primary = new Error('final report write failed')
  const f = await fixture(t)
  f.options.write = async (path, bytes) => {
    if (basename(path) === reportName && JSON.parse(bytes).result === 'passed') throw primary
    await writeFile(path, bytes)
  }
  await assert.rejects(runFocusedNativePointAcceptance(f.options), (error) => error === primary)
  const report = await f.report()
  assert.equal(report.result, 'failed'); assert.equal(report.error.message, primary.message)
  assert.equal(f.calls.at(-1), 'server close')
})

test('different final checkout or renderer page errors leave focused execution failed', async (t) => {
  for (const fault of ['identity', 'page-error']) {
    const f = await fixture(t)
    const capture = f.options.captureCheckout, nativeChecks = f.options.nativeChecks
    if (fault === 'identity') {
      let calls = 0
      f.options.captureCheckout = () => {
        const result = capture()
        if (++calls > 1) result.checkout.fingerprint = 'changed-tree'
        return result
      }
    } else {
      f.options.nativeChecks = async (context) => {
        f.handlers.get('pageerror')(new Error('renderer page failure'))
        await nativeChecks(context)
      }
    }
    await assert.rejects(runFocusedNativePointAcceptance(f.options), fault === 'identity'
      ? /preserves tracked, untracked and binary/ : /no page errors/)
    assert.equal((await f.report()).result, 'failed')
    assert.equal(f.calls.at(-1), 'server close')
  }
})
