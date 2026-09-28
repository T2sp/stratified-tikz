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

function nativeControlDocument(nativeControls = true) {
  const eventTarget = () => {
    const listeners = new Map()
    return { listeners, addEventListener(name, callback) { listeners.set(name, callback) },
      removeEventListener(name, callback) { assert.equal(listeners.get(name), callback); listeners.delete(name) } }
  }
  const element = (tag, attributes = {}) => ({ localName: tag, id: '', isConnected: true, parentElement: null,
    type: '', labels: [], value: '', checked: false, disabled: false, textContent: '',
    getAttribute: (name) => attributes[name] ?? null, getBoundingClientRect: rectangle,
    getAnimations: () => [], matches(selector) { assert.equal(selector, ':disabled'); return this.disabled },
    scrollLeft: 0, scrollTop: 17, scrollWidth: 300, scrollHeight: 1200, clientWidth: 300, clientHeight: 200 })
  const source = element('article', { class: 'source-panel' })
  const makeControl = (name, type = 'checkbox') => {
    const label = element('label'), input = element(type === 'select-one' ? 'select' : 'input', type === 'number' ? { 'aria-label': name } : {})
    label.textContent = name; label.parentElement = source
    input.type = type; input.labels = [label]; input.parentElement = label
    return input
  }
  const visibility = makeControl('Enable approximate 3D visibility'), sort = makeControl('Auto depth-sort surfaces'),
    axes = makeControl('Show xyz axes in TikZ output'), mode = makeControl('TikZ export mode: standalone inlineMath', 'select-one')
  visibility.checked = true; sort.checked = false; axes.checked = true; mode.value = 'standalone'
  const controls = [visibility, sort, axes, mode, ...['theta', 'phi', 'zoom', 'pan x', 'pan y'].map((name) => makeControl(`${name} value`, 'number'))]
  let stateCalls = 0, frame, cancelled = 0, cleared = 0, revision = 5
  const api = { state: () => { stateCalls++; return { labelDocumentRevision: revision,
    json: JSON.stringify({ diagram: { ambientDimension: 3, strata: [{ id: 'point' }], labels: [] } }),
    history: JSON.stringify({ past: [{}], present: {}, future: [{}, {}] }), selection: { kind: 'stratum', id: 'app-point' },
    uiSettings: JSON.stringify({ exportMode: mode.value, visibility: { enabled: visibility.checked, surfaceDepthSort: sort.checked } }) } } }
  const window = { ...eventTarget(), __stzOwnedAppDocument: { generation: 'owned', api }, stzAppLabels: api,
    innerWidth: 1600, innerHeight: 1200, devicePixelRatio: 1, scrollX: 0, scrollY: 19 }
  const document = { ...eventTarget(), readyState: 'complete', visibilityState: 'visible', hasFocus: () => true,
    documentElement: { clientWidth: 1600, clientHeight: 1200 }, activeElement: sort,
    querySelector: (selector) => selector === '.source-panel' ? source : null,
    querySelectorAll: (selector) => selector === 'input[type="checkbox"], select, input[type="number"]' ? controls : [],
    elementsFromPoint: () => [visibility, visibility.parentElement, source] }
  const location = { href: 'http://localhost/app' }
  const globals = { window, document, location, performance, Date, WeakMap,
    getComputedStyle: () => ({ overflowY: 'auto', scrollBehavior: 'auto', pointerEvents: 'auto' }),
    requestAnimationFrame(callback) { frame = callback; return 1 }, cancelAnimationFrame() { cancelled++ },
    setTimeout: () => 2, clearTimeout() { cleared++ }, argument: { limits: appGeometryLimits, nativeControls } }
  runInNewContext(`(${installAppGeometryObserver.toString()})(argument)`, globals)
  return { window, document, controls, visibility, sort, mode, location, api, source, element,
    observer: window.__stzAppGeometryDiagnostics, frame: (at) => frame(at),
    get stateCalls() { return stateCalls }, get cancelled() { return cancelled }, get cleared() { return cleared },
    advanceRevision() { revision++ } }
}

test('native-control state, exact associated labels, layout and hit evidence are opt-in and read-only', () => {
  const inactive = nativeControlDocument(false)
  assert.equal(inactive.observer.snapshot().nativeControls, undefined)
  assert.equal(inactive.stateCalls, 0)
  assert.equal(inactive.document.listeners.has('change'), false)
  inactive.observer.stop()
  const fixture = nativeControlDocument()
  const evidence = fixture.observer.snapshot().nativeControls
  assert.equal(fixture.stateCalls, 1)
  assert.equal(evidence.state.labelDocumentRevision, 5)
  assert.equal(evidence.state.model.ambientDimension, 3)
  assert.equal(evidence.state.model.strataCount, 1)
  assert.equal(evidence.state.model.freeLabelCount, 0)
  assert.equal(evidence.state.history.pastCount, 1)
  assert.equal(evidence.state.history.futureCount, 2)
  assert.equal(evidence.state.selection.kind, 'stratum')
  assert.equal(evidence.state.selection.id, 'app-point')
  assert.equal(JSON.parse(evidence.state.uiSettings.text).visibility.enabled, true)
  const visibility = evidence.controls[0]
  assert.equal(visibility.matchCount, 1)
  assert.equal(visibility.matches[0].checked, true)
  assert.equal(visibility.matches[0].enabled, true)
  assert.equal(visibility.matches[0].connected, true)
  assert.equal(visibility.matches[0].labels[0], 'Enable approximate 3D visibility')
  assert.equal(visibility.matches[0].associatedLabels[0].tag, 'label')
  assert.equal(visibility.matches[0].hitTest.targets[0].id, visibility.matches[0].id)
  assert.equal(evidence.ancestors[0].scroll.top, 17)
  assert.equal(evidence.ancestors[0].layout.overflowY, 'auto')
  assert.equal(evidence.activeFocus.id, evidence.controls[1].matches[0].id)
  assert.equal(evidence.controls[3].matches[0].value, 'standalone')
  assert.equal(evidence.controls[4].name, 'theta value')
  fixture.observer.stop()
})

test('native-control state call is guarded against missing/replaced API, document generation and URL', () => {
  for (const change of [
    (fixture) => { fixture.window.stzAppLabels = undefined },
    (fixture) => { fixture.window.stzAppLabels = { state() { assert.fail('replacement state must not be called') } } },
    (fixture) => { fixture.window.__stzOwnedAppDocument.generation = 'replacement' },
    (fixture) => { fixture.location.href = 'http://localhost/another-app' },
  ]) {
    const fixture = nativeControlDocument()
    change(fixture)
    const evidence = fixture.observer.snapshot().nativeControls
    assert.equal(evidence.state.status, 'unavailable')
    assert.match(evidence.state.reason, /continuity lost/)
    assert.equal(fixture.stateCalls, 0)
    assert.equal(evidence.controls[0].matchCount, 1, 'DOM evidence survives API continuity loss')
    fixture.observer.stop()
  }
})

test('native-control frames and trusted events retain bounded movement/state observations and release listeners', () => {
  const fixture = nativeControlDocument()
  let parent = fixture.source
  for (let i = 0; i < appGeometryLimits.ancestors; i++) { parent.parentElement = fixture.element('div'); parent = parent.parentElement }
  const first = fixture.observer.snapshot().nativeControls.controls[0].matches[0].id
  for (let i = 0; i < 100; i++) {
    fixture.visibility.getBoundingClientRect = () => ({ ...rectangle(), x: i, left: i })
    fixture.window.scrollY = i
    fixture.frame(i * 100)
    fixture.visibility.checked = i % 2 === 0
    fixture.document.listeners.get('input')({ target: fixture.visibility, isTrusted: true })
    fixture.document.listeners.get('change')({ target: fixture.visibility, isTrusted: true })
  }
  fixture.advanceRevision()
  const evidence = fixture.observer.snapshot().nativeControls
  assert.equal(fixture.stateCalls, 2, 'rAF and event listeners never invoke state')
  assert.equal(evidence.frames.samples.length, appGeometryLimits.controlFrames)
  assert.equal(evidence.frames.dropped, 100 - appGeometryLimits.controlFrames)
  assert.equal(evidence.frames.samples.at(-1).controls[0].matches[0].rect.x, 99)
  assert.equal(evidence.frames.samples.at(-1).controls[0].matches[0].id, first)
  assert.equal(evidence.frames.samples.at(-1).scroll.y, 99)
  assert.equal(evidence.frames.samples.at(-1).delta, 100)
  assert.equal(evidence.events.samples.length, appGeometryLimits.controlEvents)
  assert.equal(evidence.events.dropped, 200 - appGeometryLimits.controlEvents)
  assert.equal(evidence.events.samples.at(-1).event, 'change')
  assert.equal(evidence.events.samples.at(-1).trusted, true)
  assert.equal(evidence.events.samples.at(-1).checked, false)
  assert.equal(evidence.state.labelDocumentRevision, 6)
  assert.equal(evidence.ancestors.length, appGeometryLimits.ancestors)
  assert.equal(evidence.controls.length, 9)
  assert.equal(evidence.controls[0].matches[0].ancestorsTruncated, true)
  assert.ok(evidence.controls[1].matches[0].ancestors.length > 0, 'Shared scroll ancestors survive exhausted deduplicated-node budget')
  assert.ok(JSON.stringify(fixture.observer.snapshot()).length < appGeometryLimits.recordBytes)
  fixture.observer.stop()
  assert.equal(fixture.document.listeners.size, 0)
  assert.equal(fixture.window.listeners.size, 0)
  assert.equal(fixture.cancelled, 1)
  assert.ok(fixture.cleared > 0)
})

test('native-control scans/matches and serialized state clipping explicitly report evidence limits', () => {
  const fixture = nativeControlDocument()
  for (let i = 0; i < appGeometryLimits.controlScan + 20; i++) fixture.controls.push(fixture.visibility)
  fixture.api.state = () => ({ uiSettings: 'x'.repeat(5000), json: 'x'.repeat(appGeometryLimits.stateParse + 1),
    history: 'x'.repeat(appGeometryLimits.stateParse + 1), selection: 'x'.repeat(900), labelDocumentRevision: 5 })
  const evidence = fixture.observer.snapshot().nativeControls
  assert.equal(evidence.scan.truncated, true)
  assert.equal(evidence.scan.scanned, appGeometryLimits.controlScan)
  assert.ok(evidence.controls[0].matchCount > appGeometryLimits.controlMatches)
  assert.equal(evidence.controls[0].matches.length, appGeometryLimits.controlMatches)
  assert.equal(evidence.state.status, 'available')
  assert.equal(evidence.state.uiSettings.length, 5000)
  assert.equal(evidence.state.uiSettings.text.length, 4000)
  assert.equal(evidence.state.uiSettings.truncated, true)
  assert.equal(evidence.state.model.summaryOmitted, true)
  assert.equal(evidence.state.history.summaryOmitted, true)
  fixture.api.state = () => ({ selection: null })
  assert.equal(fixture.observer.snapshot().nativeControls.state.selection, null)
  fixture.api.state = () => ({ selection: { kind: 'multi', elements: Array.from({ length: 12 }, () => ({ kind: 'label', id: 'x'.repeat(1000) })) } })
  const selection = fixture.observer.snapshot().nativeControls.state.selection
  assert.equal(selection.kind, 'multi')
  assert.equal(selection.count, 12)
  assert.equal(selection.elements.length, 8)
  assert.equal(selection.elements[0].id.length, 300)
  assert.equal(selection.truncated, true)
  fixture.observer.stop()
})

test('native-control opt-in reaches browser install and a timed-out failure capture retains the original call log', async (context) => {
  const artifactDir = await directory(context)
  const primary = new Error('locator.uncheck: Timeout 30000ms exceeded.\nCall log:\n  scrolling into view if needed')
  primary.log = ['locator resolved to <input type="checkbox"/>', 'scrolling into view if needed']
  let unavailable = false, rejectLate, installed
  const page = new Page((callback, argument) => {
    if (callback.name === 'installAppGeometryObserver') { installed = argument; return {} }
    if (unavailable && callback.name === 'readAppGeometryObserver') return new Promise((_resolve, reject) => { rejectLate = reject })
    return snapshot()
  })
  const diagnostics = createAppGeometryDiagnostics({ page, artifactDir, timeoutMs: 10, nativeControls: true })
  await diagnostics.install()
  assert.equal(installed.nativeControls, true)
  await assert.rejects(diagnostics.around('3d:standalone:visibility-off', async () => {
    unavailable = true; throw primary
  }, { ambientDimension: 3, mode: 'standalone' }), (error) => error === primary)
  await diagnostics.failure(primary)
  await diagnostics.dispose()
  const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  assert.equal(index.failure.error.message, primary.message)
  assert.equal(index.failure.error.stack, primary.stack)
  assert.deepEqual(index.failure.error.log, primary.log)
  assert.equal(index.failure.error.logTruncated, false)
  assert.equal(index.index.at(-1).status, 'unavailable')
  assert.equal(page.listenerCount('pageerror'), 0)
  rejectLate(new Error('late native-control capture transport error'))
  await new Promise((done) => setImmediate(done))
})
