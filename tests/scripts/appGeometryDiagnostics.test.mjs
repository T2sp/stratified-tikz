import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { appGeometryLimits, clickAppPointer, createAppGeometryDiagnostics, installAppGeometryObserver, readAppGeometry,
  waitForAppFrames, waitForAppGeometryInDocument, waitForStableAppGeometry } from '../../scripts/appGeometryDiagnostics.mjs'

const rectangle = () => ({ x: 1, y: 2, width: 300, height: 200, top: 2, right: 301, bottom: 202, left: 1 })
const matrix = () => ({ a: 1, b: 0, c: 0, d: 1, e: 1, f: 2 })
const node = (id) => ({ id, connected: true, rect: rectangle(), screenCTM: matrix(), scroll: { left: 0, top: 0 }, layout: {} })
function snapshot() {
  return { generation: 'generation-1', observerGeneration: 'generation-1', api: { sameInstance: true },
    frames: { count: 1, stopped: false }, url: 'http://localhost/app', observerUrl: 'http://localhost/app', labelSource: '$i$', labelRequest: '["$i$"]',
    labelStatus: 'ready', labelBounds: '0 0 10 10', svg: node(1), label: node(2), ancestors: [node(3)],
    inspector: null, camera: {}, viewBox: '0 0 100 100', viewport: { width: 1600, height: 1200 }, scroll: { x: 0, y: 0 } }
}
async function directory(context) {
  const path = await mkdtemp(join(tmpdir(), 'stz-app-geometry-test-'))
  context.after(() => rm(path, { recursive: true, force: true }))
  return path
}
class Page extends EventEmitter {
  constructor(evaluate = () => snapshot()) { super(); this.reader = evaluate; this.calls = [] }
  url() { return 'http://localhost/app' }
  isClosed() { return false }
  mainFrame() { return this }
  async evaluate(callback, argument) { this.calls.push(callback.name); return this.reader(callback, argument) }
}

test('one-shot geometry evaluation reaches caller cleanup on a stalled transport and owns late rejection', async () => {
  let rejectRead, cleanup
  const page = new Page(() => new Promise((_resolve, reject) => { rejectRead = reject }))
  try {
    await assert.rejects(readAppGeometry(page, () => {}, undefined, 15), /Timed out after 15ms during App geometry observation/)
  } finally { cleanup = true }
  assert.equal(cleanup, true)
  assert.equal(page.calls.length, 1, 'A failed read is not retried')
  rejectRead(new Error('owned page closed after the original read deadline'))
  await new Promise((resolve) => setImmediate(resolve))
})

test('native pointer releases Alt within a host bound without replacing the failed click', async () => {
  const primary = new Error('native click failed'), calls = []
  let rejectRelease
  const page = { keyboard: {
    down: async (key) => calls.push(`down ${key}`),
    up: (key) => { calls.push(`up ${key}`); return new Promise((_resolve, reject) => { rejectRelease = reject }) },
  }, mouse: { click: async () => { calls.push('click'); throw primary } } }
  await assert.rejects(clickAppPointer(page, { x: 1, y: 2 }, true, 15), (error) => error === primary)
  assert.deepEqual(calls, ['down Alt', 'click', 'up Alt'])
  rejectRelease(new Error('late modifier release rejection'))
  await new Promise((resolve) => setImmediate(resolve))
  page.mouse.click = async () => {}
  page.keyboard.up = async () => { throw new Error('release is the only failure') }
  await assert.rejects(clickAppPointer(page, { x: 1, y: 2 }, true, 15), /release is the only failure/)
})

function frameDocument(measure = snapshot, stalled = false) {
  const pending = new Map(), cancelled = [], window = { __stzAppGeometryDiagnostics: { snapshot: measure } }
  let next = 0, calls = 0
  const globals = { window, Map, Number, JSON, Error, setTimeout, clearTimeout,
    requestAnimationFrame(callback) {
      calls++; const id = ++next
      if (!stalled) pending.set(id, setTimeout(() => { pending.delete(id); callback(calls * 16) }, 0))
      return id
    },
    cancelAnimationFrame(id) { cancelled.push(id); clearTimeout(pending.get(id)); pending.delete(id) },
  }
  const page = new Page((callback, args) => runInNewContext(`(${callback.toString()})(argument)`, { ...globals, argument: args }))
  return { page, globals, window, pending, cancelled, get calls() { return calls } }
}

test('two-frame wait completes and cancels browser timer/rAF bookkeeping', async () => {
  const document = frameDocument()
  const result = await waitForAppFrames(document.page, { frames: 2, timeoutMs: 200 })
  assert.equal(result.frames, 2)
  assert.equal(document.calls, 2)
  assert.equal(document.window.__stzAppGeometryWaits.size, 0)
  assert.equal(document.pending.size, 0)
})

test('stalled frames reject on the browser deadline and clean up the scheduled frame', async () => {
  const document = frameDocument(snapshot, true)
  await assert.rejects(waitForAppFrames(document.page, { timeoutMs: 10 }), /animation frames stalled/)
  assert.equal(document.window.__stzAppGeometryWaits.size, 0)
  assert.equal(document.cancelled.length, 1)
})

test('a stuck evaluate has a finite host budget and its late rejection stays owned', async () => {
  let rejectLate
  const page = new Page((callback) => callback.name === 'cancelAppGeometryWait' ? undefined : new Promise((_resolve, reject) => { rejectLate = reject }))
  const before = performance.now()
  await assert.rejects(waitForAppFrames(page, { timeoutMs: 10 }), /Timed out.*App frames frame wait/)
  assert.ok(performance.now() - before < 1500)
  assert.ok(page.calls.includes('cancelAppGeometryWait'))
  rejectLate(new Error('late transport rejection'))
  await new Promise((done) => setImmediate(done))
})

test('stable geometry requires three equal frames while retaining native viewport offsets', async () => {
  let frame = 0
  const document = frameDocument(() => {
    const value = snapshot(); frame++
    if (frame === 1) value.svg.rect.y += 3
    value.scroll.y = 200
    return value
  })
  const result = await waitForStableAppGeometry(document.page, { timeoutMs: 200 })
  assert.equal(result.frames, 4)
  assert.equal(result.stableFrames, 3)
  assert.equal(result.snapshot.scroll.y, 200)
  assert.equal(result.samples.length, 3)
})

test('never-stable rect, node identity, transform, source and scroll paths fail rather than accept readiness', async () => {
  for (const mutate of [
    (value, frame) => { value.svg.rect.x += frame },
    (value, frame) => { value.label.id += frame },
    (value, frame) => { value.ancestors[0].screenCTM.e += frame },
    (value, frame) => { value.scroll.y = frame },
    (value, frame) => { value.labelRequest = String(frame) },
  ]) {
    let frame = 0
    const document = frameDocument(() => { const value = snapshot(); mutate(value, ++frame); return value })
    await assert.rejects(waitForStableAppGeometry(document.page, { timeoutMs: 20 }), /geometry never stabilized/)
    assert.equal(document.window.__stzAppGeometryWaits.size, 0)
  }
})

test('ownership loss and nonfinite/missing targets fail immediately without waiting away replacement', async () => {
  for (const mutate of [
    (value) => { value.api.sameInstance = false },
    (value) => { value.generation = 'replacement' },
    (value) => { value.url = 'http://localhost/replaced' },
    (value) => { value.svg.rect.width = Infinity },
    (value) => { value.label = null },
    (value) => { value.label.screenCTM = null },
  ]) {
    const document = frameDocument(() => { const value = snapshot(); mutate(value); return value })
    await assert.rejects(waitForStableAppGeometry(document.page, { timeoutMs: 200 }), /continuity lost|nonfinite|client transform/)
    assert.equal(document.calls, 1)
    assert.equal(document.pending.size, 0)
  }
})

test('browser frame work has a finite frame-count and concurrent-wait budget', async () => {
  const document = frameDocument(snapshot, true)
  document.window.__stzAppGeometryWaits = new Map(Array.from({ length: 8 }, (_, i) => [i, {}]))
  await assert.rejects(document.page.evaluate(waitForAppGeometryInDocument,
    { token: 'extra', mode: 'frames', frames: 2, timeoutMs: 10 }), /wait budget exceeded/)
  assert.equal(document.calls, 0)
})

test('before-operation evidence exists before invoking the scroll; original failure survives diagnostic reads', async (context) => {
  const artifactDir = await directory(context), primary = new Error('native scroll timeout')
  let broken = false
  const page = new Page(() => { if (broken) throw new Error('diagnostic renderer unavailable'); return snapshot() })
  const diagnostics = createAppGeometryDiagnostics({ page, artifactDir, timeoutMs: 50 })
  await diagnostics.install()
  await assert.rejects(diagnostics.around('valid-again-ready:scroll', async () => {
    const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
    assert.equal(index.index[0].boundary, 'valid-again-ready:scroll:before')
    const before = JSON.parse(await readFile(join(artifactDir, index.index[0].artifact), 'utf8'))
    assert.equal(before.browser.status, 'available')
    broken = true; throw primary
  }, { stage: 'valid-again-ready', source: '$i$' }, 30_000), (error) => error === primary)
  await diagnostics.failure(primary, { errors: ['owned App error'], actions: ['Download JSON completed'] })
  const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  assert.equal(index.failure.error.message, primary.message)
  assert.deepEqual(index.failure.details.errors, ['owned App error'])
  assert.equal(index.index.at(-1).status, 'unavailable')
  await diagnostics.dispose()
  assert.equal(page.listenerCount('pageerror'), 0)
})

test('stalled diagnostic evaluation is not multiplied by subsequent captures or dispose', async (context) => {
  const artifactDir = await directory(context)
  let rejectLate
  const page = new Page((callback) => callback.name === 'readAppGeometryObserver'
    ? new Promise((_resolve, reject) => { rejectLate = reject }) : {})
  const diagnostics = createAppGeometryDiagnostics({ page, artifactDir, timeoutMs: 10 })
  await diagnostics.install()
  const first = await diagnostics.capture('before-download')
  assert.equal(first.browser.status, 'unavailable')
  const second = await diagnostics.capture('after-download')
  assert.match(second.browser.error.message, /remains pending/)
  await diagnostics.dispose()
  assert.equal(page.calls.filter((name) => name === 'readAppGeometryObserver').length, 1)
  assert.equal(page.calls.filter((name) => name === 'stopAppGeometryObserver').length, 0)
  rejectLate(new Error('owned late evaluation error'))
  await new Promise((done) => setImmediate(done))
})

test('monitor persists a bounded during sequence and stops further samples when the operation completes', async (context) => {
  const artifactDir = await directory(context), page = new Page()
  const diagnostics = createAppGeometryDiagnostics({ page, artifactDir, timeoutMs: 100 })
  await diagnostics.install()
  const value = await diagnostics.around('scroll', () => new Promise((done) => setTimeout(() => done('complete'), 180)), {}, 500)
  assert.equal(value, 'complete')
  const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  assert.ok(index.index.some(({ boundary }) => boundary === 'scroll:during'))
  assert.equal(index.index.at(-1).boundary, 'scroll:after')
  assert.ok(index.index.length <= appGeometryLimits.monitorSamples + 2)
  const count = index.index.length
  await new Promise((done) => setTimeout(done, 50))
  const later = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  assert.equal(later.index.length, count)
  await diagnostics.dispose()
})

test('host lifecycle and supplied failure details use bounded event/string buffers', async (context) => {
  const artifactDir = await directory(context), page = new Page()
  const diagnostics = createAppGeometryDiagnostics({ page, artifactDir, timeoutMs: 100 })
  await diagnostics.install()
  for (let i = 0; i < 300; i++) page.emit('pageerror', new Error(`error ${i}`))
  await diagnostics.failure(new Error('primary'), { errors: Array.from({ length: 100 }, () => 'x'.repeat(20_000)) })
  const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  assert.equal(index.events.length, appGeometryLimits.events)
  assert.ok(index.droppedEvents > 0)
  assert.ok(JSON.stringify(index.failure.details).length < 20_000)
  await diagnostics.dispose()
})

test('DOM observer distinguishes node replacement, records frame/lifecycle progress and explicitly stops', () => {
  const eventTargets = () => { const listeners = new Map(); return { listeners,
    addEventListener(event, callback) { listeners.set(event, callback) }, removeEventListener(event) { listeners.delete(event) } } }
  const element = (tag) => ({ localName: tag, id: '', isConnected: true, parentElement: null,
    getAttribute: () => '', getBoundingClientRect: rectangle, getScreenCTM: matrix, getAnimations: () => [],
    scrollLeft: 0, scrollTop: 0, scrollWidth: 300, scrollHeight: 200, clientWidth: 300, clientHeight: 200 })
  const svg = element('svg'); let label = element('g'); label.parentElement = svg
  const api = { state() { throw new Error('observer must not call App API') } }
  const window = { ...eventTargets(), __stzOwnedAppDocument: { generation: 'g', api }, stzAppLabels: api,
    innerWidth: 1600, innerHeight: 1200, devicePixelRatio: 1, scrollX: 0, scrollY: 0 }
  const document = { ...eventTargets(), visibilityState: 'visible', readyState: 'complete', hasFocus: () => true,
    documentElement: { clientWidth: 1600, clientHeight: 1200 }, querySelectorAll: () => [],
    querySelector: (selector) => selector === 'svg.svg-diagram' ? svg : selector.startsWith('[data-label-id=') ? label : null }
  let frame, cancelled = false, cleared = false
  const globals = { window, document, location: { href: 'http://localhost/app' }, performance, Date, WeakMap,
    getComputedStyle: () => ({}), requestAnimationFrame(callback) { frame = callback; return 1 },
    cancelAnimationFrame() { cancelled = true }, setTimeout: () => 2, clearTimeout() { cleared = true },
    argument: { limits: appGeometryLimits } }
  runInNewContext(`(${installAppGeometryObserver.toString()})(argument)`, globals)
  const observer = window.__stzAppGeometryDiagnostics
  const first = observer.snapshot()
  frame(12)
  label = element('g'); label.parentElement = svg
  for (let i = 0; i < 150; i++) document.listeners.get('visibilitychange')()
  const second = observer.snapshot()
  assert.equal(second.svg.id, first.svg.id)
  assert.notEqual(second.label.id, first.label.id)
  assert.equal(second.frames.count, 1)
  assert.equal(second.lifecycle.events.length, appGeometryLimits.events)
  assert.ok(second.lifecycle.dropped > 0)
  assert.equal(second.api.sameInstance, true)
  assert.doesNotThrow(() => observer.assertOwnership())
  window.stzAppLabels = { state: () => assert.fail('Replacement API must never be called') }
  assert.throws(() => observer.assertOwnership(), /continuity lost/)
  observer.stop()
  assert.equal(document.listeners.size, 0)
  assert.equal(window.listeners.size, 0)
  assert.equal(cancelled, true)
  assert.equal(cleared, true)
  assert.equal(observer.snapshot().frames.stopped, true)
})
