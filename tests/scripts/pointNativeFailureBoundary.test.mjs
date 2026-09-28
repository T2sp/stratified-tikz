import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runNativePointChecks } from '../../scripts/checkPointNodesApp.mjs'

const origin = 'http://127.0.0.1:5174'
const expectedUrl = `${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`

function pendingOperation() {
  let started, reject
  const entered = new Promise((resolve) => { started = resolve })
  return { entered, run: () => new Promise((_resolve, fail) => { reject = fail; started() }),
    reject: (error) => reject(error) }
}

async function setup(t, { failureAt, stalled = false }) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-point-native-failure-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  const primary = new Error(`original native ${failureAt} failure`)
  primary.log = ['waiting for native control', 'scrolling into view if needed']
  const calls = [], diagnostics = [], pending = {
    geometry: pendingOperation(), document: pendingOperation(), image: pendingOperation(), close: pendingOperation(),
  }
  t.mock.method(console, 'error', (...args) => diagnostics.push(args))
  const page = new EventEmitter(), renderer = new EventEmitter()
  const rendererListener = () => {}
  renderer.on('pageerror', rendererListener)
  let pageUrl = 'about:blank', rendererClosed = 0, newPages = 0
  renderer.close = async () => { rendererClosed++ }
  page.url = () => pageUrl
  page.isClosed = () => false
  page.mainFrame = () => page
  page.addInitScript = async () => {
    calls.push('install')
    if (failureAt === 'install') throw primary
  }
  page.goto = async (url) => {
    calls.push('goto'); assert.equal(url, expectedUrl); pageUrl = url
    throw primary
  }
  page.evaluate = async (operation, argument) => {
    const name = operation.name || 'native-form-capture'
    calls.push(name)
    if (name === 'readAppGeometryObserver') {
      if (stalled) return pending.geometry.run()
      throw new Error('secondary control snapshot failure')
    }
    if (name === 'observeOwnedAppDocument') {
      assert.equal(argument.includeDom, true, 'Failure requests bounded DOM from the native App')
      const retained = JSON.parse(await readFile(join(artifactDir, 'point-native-app-failure.json'), 'utf8'))
      assert.equal(retained.error.message, primary.message, 'Primary is persisted before browser capture')
      assert.deepEqual(retained.error.log, primary.log)
      if (stalled) return pending.document.run()
      throw new Error('secondary App snapshot failure')
    }
    if (name === 'native-form-capture') throw new Error('secondary closed-form snapshot failure')
    assert.equal(name, 'stopAppGeometryObserver', 'Startup failure never executes the fixture state API')
    throw new Error('secondary observer cleanup failure')
  }
  page.screenshot = async (options) => {
    calls.push('screenshot')
    assert.equal(options.path, join(artifactDir, 'point-native-app-failure.png'))
    assert.equal(options.fullPage, false)
    assert.equal(options.timeout, 2000)
    if (stalled) return pending.image.run()
    throw new Error('secondary screenshot failure')
  }
  page.close = async () => {
    calls.push('close')
    if (stalled) return pending.close.run()
    throw new Error('secondary native close failure')
  }
  const unexpected = () => { throw new Error('Acceptance cannot continue after startup failure') }
  const result = runNativePointChecks({
    browser: { newPage: async (options) => {
      newPages++
      assert.deepEqual(options, { viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
      return page
    } }, origin, page: renderer, artifactDir,
    saved: unexpected, startGroup: unexpected, completeGroup: unexpected,
    setStage: (stage) => assert.equal(stage, 'point-node-native-input'),
    diagnose: async (group, scenario, details) => {
      calls.push('diagnose')
      assert.equal(group, 'point-node-body-layout-lifecycle')
      assert.equal(scenario, 'point-native-direct-cursor-workplanes-inspector-persistence')
      await writeFile(join(artifactDir, 'native-scenario-failure.json'), JSON.stringify(details, null, 2))
    },
    observe: async () => { calls.push('observe'); throw new Error('secondary terminal observation failure') },
  }).then(() => ({ passed: true }), (error) => ({ error }))
  return { artifactDir, primary, page, renderer, rendererListener, calls, diagnostics, pending, result,
    newPages: () => newPages, rendererClosed: () => rendererClosed }
}

async function assertFailureEvidence(input, stalled) {
  const { artifactDir, primary, page, renderer, rendererListener, calls } = input
  assert.equal((await input.result).error, primary, 'Every secondary failure preserves the original Error object')
  const own = JSON.parse(await readFile(join(artifactDir, 'point-native-app-failure.json'), 'utf8'))
  assert.equal(own.error.message, primary.message)
  assert.equal(own.error.stack, primary.stack)
  assert.deepEqual(own.error.log, primary.log, 'The original Playwright call log is retained')
  assert.equal(own.expectedUrl, expectedUrl)
  assert.equal(own.boundary, 'owned-app-failure')
  assert.equal(own.action, 'startup')
  assert.deepEqual(own.errors, [])
  assert.equal(own.snapshot, undefined)
  assert.match(own.captureError.message, stalled ? /Timed out after 2000ms during owned App document capture \(failure\)/ : /secondary App snapshot failure/)
  assert.match(own.screenshotError.message, stalled ? /Timed out after 2100ms during owned App failure screenshot/ : /secondary screenshot failure/)
  const geometry = JSON.parse(await readFile(join(artifactDir, 'point-native-controls-index.json'), 'utf8'))
  assert.equal(geometry.failure.error.message, primary.message)
  assert.equal(geometry.disposed, true, 'Control observer disposal completed before native close')
  assert.ok(geometry.events.some((entry) => entry.event === 'disposed'))
  const capture = JSON.parse(await readFile(join(artifactDir, geometry.index[0].artifact), 'utf8'))
  assert.equal(capture.boundary, 'primary-failure')
  assert.equal(capture.browser.status, 'unavailable')
  assert.match(capture.browser.error.message, stalled ? /Timed out after 2000ms during App geometry browser observation/ : /secondary control snapshot failure/)
  const scenario = JSON.parse(await readFile(join(artifactDir, 'native-scenario-failure.json'), 'utf8'))
  assert.equal(scenario.error.message, primary.message)
  assert.equal(scenario.error.stack, primary.stack)
  assert.equal(scenario.nativeBoundary.action, 'startup')
  assert.match(scenario.captureError.message, /secondary closed-form snapshot failure/)
  const lifecycle = JSON.parse(await readFile(join(artifactDir, 'point-native-app-lifecycle.json'), 'utf8'))
  assert.equal(lifecycle.pageId, own.pageId)
  assert.deepEqual(lifecycle.failure.error, own.error)
  assert.equal(page.eventNames().length, 0, 'Native control, App ownership, and local page-error listeners are released after close fails')
  assert.ok(calls.indexOf('diagnose') < calls.indexOf('close'))
  assert.ok(calls.includes('observe'), 'Terminal observation was attempted even though native setup capture failed')
  assert.equal(input.newPages(), 1, 'The failed App is never replaced')
  assert.equal(input.rendererClosed(), 0, 'Cleanup closes only the owned native App page')
  assert.deepEqual(renderer.listeners('pageerror'), [rendererListener], 'Unowned renderer listeners remain intact')
  assert.ok(input.diagnostics.some((entry) => String(entry[0]).includes('native owned page close')))
}

test('native point orchestration retains install failure through capture, screenshot, observation and cleanup failures', async (t) => {
  const input = await setup(t, { failureAt: 'install' })
  await assertFailureEvidence(input, false)
  assert.equal(input.calls.includes('goto'), false)
  assert.ok(input.calls.indexOf('stopAppGeometryObserver') < input.calls.indexOf('close'), 'Observer cleanup is attempted before close')
})

test('native point orchestration bounds stalled captures and close, owns late rejection, and completes later cleanup', { timeout: 10_000 }, async (t) => {
  // Advance only deliberately stalled browser operations. Filesystem evidence
  // writes run on real I/O without consuming a tiny wall-clock test deadline.
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const input = await setup(t, { failureAt: 'goto', stalled: true })
  await input.pending.geometry.entered
  t.mock.timers.tick(2000)
  await input.pending.document.entered
  t.mock.timers.tick(2000)
  await input.pending.image.entered
  t.mock.timers.tick(2100)
  await input.pending.close.entered
  t.mock.timers.tick(12_000)
  await assertFailureEvidence(input, true)
  assert.ok(input.calls.includes('goto'))
  const unhandled = []
  const onUnhandled = (error) => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled)
  try {
    for (const [name, operation] of Object.entries(input.pending)) operation.reject(new Error(`late ${name} rejection`))
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(unhandled, [], 'All browser promises remain owned after their diagnostic deadlines')
  } finally { process.off('unhandledRejection', onUnhandled) }
  assert.equal(input.page.eventNames().length, 0)
})
