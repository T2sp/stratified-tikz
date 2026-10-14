import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { runAppChecksWithGeometryControls } from '../../scripts/checkFreeLabelsAppFocused.mjs'
import { browserDocument } from './appGeometryWaitFixture.mjs'

const appPath = fileURLToPath(new URL('../../scripts/checkFreeLabelsApp.mjs', import.meta.url))
const flush = () => new Promise((resolve) => setImmediate(resolve))
const validSource = '$\\mathord{\\mathrm{i}}$'
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function clock() {
  let now = 100
  const entries = []
  const schedule = (expire, timeoutMs, operation) => {
    const entry = { expire, timeoutMs, operation, cancelled: false }
    entries.push(entry)
    return () => { entry.cancelled = true }
  }
  schedule.monotonicNow = () => now
  return { schedule, entries,
    expire(name) {
      const entry = entries.findLast((value) => value.operation.name === name)
      assert.ok(entry, `Actual operation entered: ${name}`)
      now = entry.operation.deadlineMs
      entry.expire()
    } }
}

/** Load the actual App caller body without adding production test flags. Only
 * owned startup/state controls are synthetic. The diagnostic factory delegates
 * every wait/observer/cancellation/cleanup to its unchanged actual module. */
async function loadCaller(controls) {
  const key = `__stzAppCallerTest_${randomUUID()}`
  globalThis[key] = controls
  const geometryUrl = pathToFileURL(join(dirname(appPath), 'appGeometryDiagnostics.mjs')).href
  const geometry = dataModule(`
    import * as actual from ${JSON.stringify(geometryUrl)};
    const controls = globalThis[${JSON.stringify(key)}];
    export const clickAppPointer = actual.clickAppPointer;
    export const readAppGeometry = actual.readAppGeometry;
    export function createAppGeometryDiagnostics(options) {
      const diagnostics = actual.createAppGeometryDiagnostics(options);
      const wait = diagnostics.wait;
      diagnostics.wait = (mode, details, options) => controls.wait(wait, mode, details, options);
      return diagnostics;
    }
  `)
  const ownership = dataModule(`
    const controls = globalThis[${JSON.stringify(key)}];
    export const createOwnedAppPage = (options) => controls.createOwnedAppPage(options);
  `)
  let source = await readFile(appPath, 'utf8')
  let geometryImports = 0, ownershipImports = 0
  source = source.replace(/from '(\.\/[^']+)'/g, (_match, relative) => {
    if (relative === './appGeometryDiagnostics.mjs') { geometryImports++; return `from '${geometry}'` }
    if (relative === './ownedAppPage.mjs') { ownershipImports++; return `from '${ownership}'` }
    return `from '${pathToFileURL(join(dirname(appPath), relative)).href}'`
  })
  assert.equal(geometryImports, 1)
  assert.equal(ownershipImports, 1)
  source += '\n//# sourceURL=stz-actual-App-caller-test.mjs\n'
  try { return await import(dataModule(source)) }
  finally { delete globalThis[key] }
}

function nativeFixture() {
  const fixture = browserDocument(), { page, context, document, api, svg, label } = fixture
  fixture.location.href = 'http://localhost/stratified-tikz/scripts/fixtures/freeLabelsApp.html'
  const style = { color: '#000000', opacity: 1, fontSize: 12, anchor: 'center' }
  let text = '$F^{(1)}L$', status = 'ready', selection = null, revision = 0, inspector = false, exportMode = 'standalone'
  let past = [], future = []
  const held = new Map(), controls = [], failures = []
  const payload = (source = text) => ({ diagram: { ambientDimension: 2, strata: [], labels: [{ id: 'app-label', text: source, style, position: { x: 0, y: 0, z: 0 } }] } })
  const updateLabel = () => {
    Object.assign(label.attributes, { 'data-label-source': text, 'data-label-request': JSON.stringify([text, 1, style.fontSize * 1.35]),
      'data-label-state': status, 'data-label-bounds': '-5 -5 5 5' })
  }
  const state = () => ({ json: JSON.stringify(payload()), runtimeDiagramJson: JSON.stringify(payload()),
    history: JSON.stringify({ past, future }), selection, labelDocumentRevision: revision, uiSettings: '{}' })
  const load = (json) => {
    text = JSON.parse(json).diagram.labels[0].text
    status = held.has(text) ? 'pending' : 'ready'; revision++; selection = null; past = []; future = []; updateLabel()
  }
  Object.assign(api, { state,
    hold(source) { held.set(source, { started: 1, completed: 0, released: false }) },
    pending: (source) => held.get(source),
    release(source) {
      const request = held.get(source)
      request.completed = request.started; request.released = true
      if (source === text) { status = source.includes('invalid') ? 'fallback' : 'ready'; updateLabel() }
      return { ...request }
    },
    inspectContent: () => ({ published: { minX: -5, minY: -5, maxX: 5, maxY: 5 } }) })
  api.documentJson = (source) => JSON.stringify(payload(source))
  const transform = (e, f) => ({ a: 1, b: 0, c: 0, d: 1, e, f,
    inverse: () => transform(-e, -f), multiply: (other) => transform(e + other.e, f + other.f) })
  svg.transform = transform(500, 500); label.transform = transform(500, 500)
  svg.bounds = { x: 300, y: 300, width: 400, height: 400, top: 300, right: 700, bottom: 700, left: 300 }
  svg.viewBox = { baseVal: { x: -50, y: -50, width: 100, height: 100 } }
  label.querySelector = () => ({ getAttribute: (name) => name === 'color' ? style.color : String(style.opacity) })
  label.querySelectorAll = (selector) => selector === '[data-label-literal]' ? status === 'ready' ? [] : [{ textContent: text }]
    : selector === '[data-label-math]' && status === 'ready' ? [{}] : []
  const surface = { tagName: 'svg', closest: (selector) => selector === 'svg.svg-diagram' ? svg : null }
  document.elementFromPoint = () => surface
  document.activeElement = null
  Object.assign(context, { innerWidth: 1600, innerHeight: 1200,
    DOMPoint: class { constructor(x, y) { this.x = x; this.y = y }
      matrixTransform(matrix) { return { x: matrix.a * this.x + matrix.c * this.y + matrix.e, y: matrix.b * this.x + matrix.d * this.y + matrix.f } } },
    SVGGraphicsElement: class { static [Symbol.hasInstance](value) { return value === label || value === svg } },
    HTMLElement: class { static [Symbol.hasInstance]() { return false } } })
  updateLabel()
  page.goto = async (url) => { assert.equal(url, fixture.location.href); return {} }
  page.waitForFunction = async (callback, argument) => {
    assert.ok(await page.evaluate(callback, argument), 'Explicit synthetic control condition is already satisfied')
  }
  const query = document.querySelector.bind(document)
  document.querySelector = (selector) => selector === '#preview-inspector-drawer' ? null : query(selector)
  page.keyboard = { press: async (key) => { assert.equal(key, 'Escape'); selection = null }, down: async () => {}, up: async () => {} }
  page.mouse = { click: async (x, y) => {
    controls.push({ action: 'click', x, y })
    if (fixture.nativeError) throw fixture.nativeError
    selection = x > 495 && x < 505 && y > 495 && y < 505 ? { kind: 'label', id: 'app-label' } : null
  } }
  const locator = (name) => ({
    count: async () => name === 'Close inspector drawer' ? Number(inspector) : name === 'Expand' ? 0 : 1,
    click: async () => {
      controls.push({ action: name })
      if (name === 'Load JSON') page.emit('filechooser', { setFiles: async ({ buffer }) => load(buffer.toString()) })
      else if (name === 'Close inspector drawer') inspector = false
      else if (name === 'Open inspector drawer') inspector = true
    },
    fill: async (value) => {
      assert.equal(name, 'Text'); past.push(text); future = []; text = value
      status = held.has(text) ? 'pending' : 'ready'; updateLabel()
    },
    inputValue: async () => name === 'Text' ? text : name === 'Generated TikZ source' ? `source:${text};mode:${exportMode}` : exportMode,
    selectOption: async (value) => { exportMode = value },
    evaluate: async (callback) => page.execute(callback, label),
    scrollIntoViewIfNeeded: async ({ timeout }) => { assert.equal(timeout, 30_000); controls.push({ action: 'synthetic scroll control' }) },
    getByRole: (_role, { name: nested }) => locator(nested),
  })
  page.getByRole = (_role, { name }) => locator(name)
  page.getByLabel = () => locator('export mode')
  page.locator = (selector) => locator(selector)
  page.screenshot = async (options) => { controls.push({ action: 'screenshot', options }) }
  const closed = page.close.bind(page)
  page.close = async () => { await closed(); if (fixture.cleanupError) throw fixture.cleanupError }
  return Object.assign(fixture, { state, controls, failures,
    createOwnedAppPage({ artifactDir }) {
      const listener = () => {}
      page.on('close', listener)
      return { install: async () => {}, start: async () => ({ document: { generation: 'original-document' } }),
        readState: async () => state(), checkpoint: async () => state(),
        failure: async (error, details) => {
          failures.push(error)
          await writeFile(join(artifactDir, 'app-failure.json'), JSON.stringify({ error: { message: error.message }, details }))
          if (fixture.failureCaptureError) throw fixture.failureCaptureError
        },
        dispose: async () => { page.off('close', listener); fixture.ownershipDisposed = true },
      }
    } })
}

async function setup(t, target, options = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-app-caller-'))
  const fixture = nativeFixture(), reached = deferred(), waits = [], stages = [], continuation = []
  let entering
  fixture.page.overrides.set('waitForAppGeometryInDocument', (callback, argument) => {
    const result = fixture.page.execute(callback, argument)
    entering.resolve(argument)
    return result
  })
  const cancellation = deferred(), cancellationEntered = deferred()
  if (options.stalledCancellation) fixture.page.overrides.set('cancelAppGeometryWait', async (callback, argument) => {
    cancellationEntered.resolve(argument)
    await cancellation.promise
    return fixture.page.execute(callback, argument)
  })
  const controls = { createOwnedAppPage: (values) => fixture.createOwnedAppPage(values),
    async wait(actualWait, mode, details, waitOptions) {
      entering = deferred()
      const timing = clock(), observations = []
      const operation = actualWait(mode, details, { ...waitOptions, scheduleDeadline: timing.schedule,
        cancellationScheduleDeadline: timing.schedule, observeWait: (value) => observations.push(value) })
        .then((value) => ({ value }), (error) => ({ error }))
      const argument = await entering.promise
      const entry = { mode, details, timing, observations, argument, operation }
      waits.push(entry)
      const selected = details.stage.name === 'valid-again-pending' && (target === 'pointer'
        ? details.probe.kind === 'pointer' && details.probe.phase === 'before-click' && details.probe.edge === 'west'
          && details.probe.location === 'inside' && details.probe.alt === false
        : details.probe.kind === 'final-stage')
      if (selected) {
        reached.resolve(entry)
        if (options.succeedTarget) {
          await fixture.frame(); await fixture.frame(); await fixture.frame()
        }
      } else {
        for (let frame = 0; frame < (mode === 'stable' ? 3 : 2); frame++) await fixture.frame()
      }
      const outcome = await operation
      entry.outcome = outcome
      if (outcome.error) { fixture.primaryFromWait = outcome.error; throw outcome.error }
      return outcome.value
    } }
  const { runAppChecks } = await loadCaller(controls)
  const group = runAppChecksWithGeometryControls({ browser: { newPage: async () => fixture.page }, origin: 'http://localhost',
    artifactDir, record: async (name) => {
      stages.push(name)
      if (options.recordError && name === 'app-valid-again-pending') throw options.recordError
    } }, async (values) => {
    await runAppChecks(values)
    await writeFile(join(artifactDir, 'app-workflows.json'), '{}')
    continuation.push('App workflow returned')
  }, async () => { continuation.push('native controls returned') })
    .then(() => ({ passed: true }), (error) => ({ error }))
  // Keep test readiness bounded independently of all ordinary App/I/O budgets.
  const safety = setTimeout(() => reached.reject(new Error('Synthetic App target was not reached')), 10_000)
  group.then((value) => { if (value.error) reached.reject(value.error) })
  t.after(async () => {
    clearTimeout(safety)
    cancellation.resolve()
    fixture.nativeError = undefined; fixture.cleanupError = undefined
    for (const wait of waits) if (!wait.outcome) wait.timing.expire(`App ${wait.mode} frame wait`)
    await group
    await flush()
    await rm(artifactDir, { recursive: true, force: true })
  })
  return { fixture, reached: reached.promise, waits, stages, continuation, artifactDir, group, cancellation, cancellationEntered: cancellationEntered.promise }
}

async function assertFailedCleanup(actual, primary, target) {
  const { fixture, artifactDir, continuation, stages } = actual
  assert.equal((await actual.group).error, primary, 'Actual runAppChecks and App-group composition preserve the first Error object')
  assert.deepEqual(fixture.failures, [primary])
  assert.equal(fixture.page.isClosed(), true)
  assert.equal(fixture.ownershipDisposed, true)
  assert.equal(fixture.page.eventNames().length, 0, 'App page, diagnostic and event listeners are removed')
  assert.equal(fixture.frames.size, 0)
  assert.equal(fixture.timers.size, 0)
  assert.equal(fixture.document.listeners.size, 0)
  assert.equal(fixture.window.listeners.size, 0)
  assert.equal(fixture.window.__stzAppGeometryWaits.size, 0)
  assert.deepEqual(continuation, [])
  assert.ok(!stages.includes('app-valid-again-pending'))
  await assert.rejects(access(join(artifactDir, 'app-workflows.json')), { code: 'ENOENT' })
  const index = JSON.parse(await readFile(join(artifactDir, 'app-geometry-index.json'), 'utf8'))
  assert.equal(index.disposed, true)
  assert.equal(index.failure.error.message, primary.message)
  const entry = index.waitIndex.find((value) => value.token === target.argument.token)
  assert.equal(entry.result, 'failed')
  assert.deepEqual(entry.context, target.details)
  const record = JSON.parse(await readFile(join(artifactDir, entry.artifact), 'utf8'))
  assert.equal(record.result, 'failed')
  assert.equal(record.events.some((value) => value.event === 'host-settled' && value.result === 'passed'), false)
  assert.ok(record.events.some((value) => value.event === 'late-rejection'), 'Expired App evaluation rejection remains owned through cleanup')
  const cancellation = fixture.page.calls.filter((value) => value.name === 'cancelAppGeometryWait')
  assert.equal(cancellation.length, 1, 'Only the failed wait token is cancelled')
  assert.equal(cancellation[0].argument.token, target.argument.token)
  assert.deepEqual(cancellation[0].argument.identity,
    { generation: 'original-document', url: fixture.location.href })
  assert.equal(fixture.window.__stzAppGeometryWaitRecords.get(target.argument.token).cleanup.mapHasToken, false)
  const stopped = index.events.findLast((value) => value.event === 'observer-stop-returned').details
  assert.equal(stopped.waits, 0)
  assert.equal(stopped.cancelledTokens, 0)
  assert.equal(stopped.identity.cleanup.observerFramePending, false)
  assert.equal(stopped.identity.cleanup.observerTimerPending, false)
  assert.equal(stopped.identity.cleanup.listeners, 0)
  return record
}

for (const target of ['pointer', 'final-stage']) {
  test(`actual App ${target} wait expires with exact stage/probe and responsive token cleanup`, async (t) => {
    const actual = await setup(t, target), entry = await actual.reached
    assert.equal(entry.details.stage.name, 'valid-again-pending')
    assert.equal(entry.details.stage.source, validSource)
    assert.equal(entry.details.stage.status, 'pending')
    assert.equal(entry.timing.entries[0].timeoutMs, 2100)
    assert.equal(entry.argument.timeoutMs, 2000)
    assert.ok(actual.stages.includes('app-invalid-fallback'))
    if (target === 'pointer') assert.deepEqual({ edge: entry.details.probe.edge, location: entry.details.probe.location,
      alt: entry.details.probe.alt, phase: entry.details.probe.phase }, { edge: 'west', location: 'inside', alt: false, phase: 'before-click' })
    else assert.equal(entry.details.probe.phase, 'after-pointer-probes')
    entry.timing.expire('App stable frame wait')
    const result = await actual.group
    assert.equal(result.error, actual.fixture.primaryFromWait)
    assert.match(result.error.message, /Timed out after 2100ms during App stable frame wait/)
    const record = await assertFailedCleanup(actual, result.error, entry)
    assert.equal(record.cancellation.registered, true)
    assert.equal(record.cancellation.cleanup.framePending, false)
    assert.equal(record.cancellation.cleanup.timerPending, false)
    assert.equal(entry.timing.entries.find((value) => value.operation.name === 'App frame cancellation').timeoutMs, 250)
    assert.ok(entry.timing.entries.every((value) => value.cancelled))
  })
}

test('actual App caller bounds stalled cancellation, closes the page, and owns late cancellation fulfillment', async (t) => {
  const actual = await setup(t, 'pointer', { stalledCancellation: true }), entry = await actual.reached
  entry.timing.expire('App stable frame wait')
  await actual.cancellationEntered
  entry.timing.expire('App frame cancellation')
  const result = await actual.group
  assert.match(result.error.message, /2100ms.*App stable frame wait/)
  const record = await assertFailedCleanup(actual, result.error, entry)
  assert.ok(record.events.some((value) => value.event === 'cancellation-rejected'))
  assert.equal(record.browser, undefined, 'Stalled cancellation cannot supply an unavailable browser settlement')
  actual.cancellation.resolve()
  await flush(); await flush()
  assert.ok(entry.observations.some((value) => value.event === 'late-cancellation-fulfillment'))
  assert.equal((await actual.group).error, result.error)
  assert.equal(actual.fixture.window.__stzAppGeometryWaits.size, 0)
})

test('actual App failure/cleanup secondary errors preserve the primary wait Error', async (t) => {
  const actual = await setup(t, 'final-stage'), entry = await actual.reached
  actual.fixture.failureCaptureError = new Error('synthetic owned failure capture secondary')
  actual.fixture.cleanupError = new Error('synthetic page close secondary after close')
  entry.timing.expire('App stable frame wait')
  const result = await actual.group
  assert.equal(result.error, actual.fixture.primaryFromWait)
  await assertFailedCleanup(actual, result.error, entry)
})

test('actual App pointer helper preserves a synthetic click Error without an after-click wait or group completion', async (t) => {
  const actual = await setup(t, 'pointer'), entry = await actual.reached
  const primary = new Error('synthetic pointer click failure')
  actual.fixture.nativeError = primary
  await actual.fixture.frame(); await actual.fixture.frame(); await actual.fixture.frame()
  const result = await actual.group
  assert.equal(result.error, primary)
  assert.deepEqual(actual.fixture.failures, [primary])
  assert.equal(entry.outcome.value.stableFrames, 3)
  assert.equal(actual.waits.at(-1), entry, 'Failed click cannot start its post-click frame wait')
  assert.equal(actual.fixture.page.isClosed(), true)
  assert.equal(actual.fixture.page.eventNames().length, 0)
  assert.equal(actual.fixture.frames.size, 0)
  assert.equal(actual.fixture.timers.size, 0)
  assert.deepEqual(actual.continuation, [])
  await assert.rejects(access(join(actual.artifactDir, 'app-workflows.json')), { code: 'ENOENT' })
})

test('actual App final-stage accepts three exact frames before caller assertions and the retained synthetic observation', async (t) => {
  const primary = new Error('synthetic stop after retained App stage observation')
  const actual = await setup(t, 'final-stage', { succeedTarget: true, recordError: primary }), entry = await actual.reached
  const result = await actual.group
  assert.equal(result.error, primary)
  assert.equal(entry.outcome.value.stableFrames, 3)
  assert.equal(entry.outcome.value.frames, 3)
  assert.equal(entry.outcome.value.snapshot.labelSource, validSource)
  assert.ok(actual.stages.includes('app-valid-again-pending'), 'Stage geometry/pointer/source assertions reached the actual record call')
  assert.equal(actual.fixture.page.isClosed(), true)
  assert.equal(actual.fixture.page.eventNames().length, 0)
  assert.equal(actual.fixture.frames.size, 0)
  assert.equal(actual.fixture.timers.size, 0)
  assert.deepEqual(actual.continuation, [])
  await assert.rejects(access(join(actual.artifactDir, 'app-workflows.json')), { code: 'ENOENT' })
})
