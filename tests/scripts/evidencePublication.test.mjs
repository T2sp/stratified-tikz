import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { createEvidencePublisher, createEvidenceReportStorage, createLiveEvidenceRetainer,
  readEvidenceDocumentSync } from '../../scripts/evidencePublication.mjs'
import { awaitPublicationEntry, ownPublication, publicationGate, publicationValue } from './ownedPublicationProgressFixture.mjs'
import { createPointDiagnosticOperation } from '../../scripts/pointCheckDiagnostics.mjs'

const checkout = { fingerprint: 'a'.repeat(64), revision: 'b'.repeat(40), trackedDiffSha256: 'c'.repeat(64),
  untrackedSha256: { 'tests/fixtures/authenticated-reference.tex': 'd'.repeat(64) } }

function deferred() {
  let resolve, reject
  const promise = new Promise((fulfill, fail) => { resolve = fulfill; reject = fail })
  return { promise, resolve, reject }
}

async function directory(t) {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-owned-evidence-'))
  t.after(() => rm(artifactDir, { recursive: true, force: true }))
  return artifactDir
}

// Faithful full-stroke data shape, with all 640 samples and all 16 descriptors
// retained. Repeated descriptors/state are shared in memory only to avoid the
// earlier fixture-allocation failure; every sample's exact values are checked.
function liveFixture(ambientDimension = 2) {
  const revision = 110, owner = JSON.stringify(['point-node', revision, 'zero-overlap'])
  const source = '  body $\\frac{x_1}{y^2}$\t\nraw \\alpha  '
  const camera = ambientDimension === 2 ? { mode: '2d', scale: 1, origin: { x: 0, y: 0 } }
    : { mode: '3d', theta: 90, phi: 0, scale: 1, origin: { x: 0, y: 0 } }
  const point = { id: 'zero-overlap', codim: ambientDimension, geometricKind: 'point', text: source,
    position: { x: 3, y: 3, z: 0 }, layer: 0, style: { kind: 'pointStyle', shape: 'ellipse', size: 8, color: '#3870a0',
      opacity: 1, fill: 'hollow', layout: { innerXSep: 0, innerYSep: 20, minimumWidth: 0, minimumHeight: 0,
        outerXSep: 0, outerYSep: 0, anchor: 'center' }, shapeParameters: {},
      paint: { text: { color: '#203040', opacity: 1 }, fill: { enabled: false, color: '#FFFFFF', opacity: 1 },
        stroke: { enabled: true, color: '#B000C0', opacity: 1, width: .4, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } } } }
  const diagram = { version: 1, ambientDimension, camera, strata: [point], labels: [
    { id: 'free-label', geometricKind: 'label', name: 'Label', position: { x: 7, y: 6.5, z: 0 }, text: '\t$F^{(1)}L$  \n',
      layer: 0, style: { kind: 'labelStyle', color: '#000000', opacity: 1, fontSize: 10, anchor: 'center' } }],
    layers: [{ value: 0, name: 'Layer 0' }], coordinateAnchors: [] }
  const state = { json: JSON.stringify({ format: 'stratified-tikz-diagram', version: 2,
    diagram: ambientDimension === 2 ? { ...diagram, camera: undefined } : diagram }, null, 2) + '\n',
  runtimeDiagramJson: JSON.stringify(diagram), uiSettings: JSON.stringify({ exportMode: 'standalone', visibility: { enabled: false } }),
  history: JSON.stringify({ past: [{ ...diagram, strata: [{ ...point, text: source + 'older' }] }], present: diagram, future: [] }),
  selection: { kind: 'stratum', id: point.id }, labelDocumentRevision: revision,
  requests: [{ owner, source, request: 'request:110:zero-overlap', state: 'ready' }], fontGeneration: 3,
  completionOrder: [107, 109, 110] }
  const ctm = { a: 3.1, b: 0, c: 0, d: 3.1, e: 1296.4, f: 268.975 }
  const viewport = { width: 1700, height: 1300, devicePixelRatio: 1, scrollX: 0, scrollY: 129,
    visual: { width: 1700, height: 1300, offsetLeft: 0, offsetTop: 0, scale: 1 } }
  const descriptors = Array.from({ length: 16 }, (_, index) => ({ tag: index === 0 ? 'path' : index === 1 ? 'svg' : 'div',
    id: index === 7 ? 'root' : '', class: index === 1 ? 'svg-diagram' : index > 1 ? `ancestor-${index}` : null,
    pointId: index === 0 ? point.id : null, drawer: false, ariaLabel: index === 1 ? `${ambientDimension}D StratifiedTikZ example` : null,
    svg: index < 2, canvas: index < 2, canvasRoot: index === 1, connected: true, svgBackgroundAttribute: null,
    currentCanvas: index < 2, currentCanvasRoot: index === 1, canvasDirectChild: false, svgBackground: false,
    pointHandle: false, creationToolbar: false, toolbarOverlay: false, quickStyle: false, history: false }))
  const samples = Array.from({ length: 640 }, (_, index) => {
    const local = { x: [-.12, 0, .12][index % 3], y: -33.94112549695428 + 67.88225099390856 * index / 639 }
    return { local, screen: { x: ctm.a * local.x + ctm.e, y: ctm.d * local.y + ctm.f },
      elementFromPoint: descriptors[0], elementsFromPoint: descriptors }
  })
  const snapshot = { at: 204.125, requestedClick: null, readyState: 'complete', selection: state.selection,
    model: diagram, camera, labelDocumentRevision: revision, tool: { selectPressed: null },
    layout: { owner, request: 'request:110:zero-overlap', bodyRequest: 'request:110:zero-overlap', source, state: 'ready',
      shape: 'ellipse', parameters: '{"borderRotate":0}', ...point.style.layout, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } },
    geometry: Object.fromEntries(['canvas', 'point', 'contour'].map((kind) => [kind,
      { connected: true, currentCanvas: true, CTM: { ...ctm }, screenCTM: { ...ctm },
        bounds: { x: 43, y: 130.375, width: kind === 'canvas' ? 1614 : 0, height: 1018 } }])),
    viewport, toolbar: { overlayCount: 1, collapsed: true, floatingCount: 0, expandCount: 1, collapseCount: 0, quickStyleCount: 0, historyCount: 1 },
    workPlaneControls: { xy: 1, xz: 1, yz: 1 }, workPlaneStatus: { plane: 'xy', fixed: 0 }, scrollAncestors: [],
    inspector: { pointId: point.id }, selectionHandles: [], elementFromPoint: null, elementsFromPoint: [], events: [], droppedEvents: null, errors: [],
    canvasObservation: { rootCount: 1, backgroundCount: 1, root: descriptors[1], background: descriptors[0] },
    coincidentContours: [{ id: point.id, owner, request: 'request:110:zero-overlap', bodyRequest: 'request:110:zero-overlap', source }],
    captureGeometry: { sampleMethod: 'entire-independent-native-stroke-footprint-and-hit-stacks', samples, obstructions: [], errors: [],
      insideViewport: true, insideCanvas: true, current: { geometry: { contour: { screenCTM: ctm } } },
      frame: { origin: { x: 0, y: 0 }, viewport }, controls: { expand: [{ element: { ariaLabel: 'Expand preview toolbar' }, visible: true, disabled: false }], collapse: [] } } }
  const afterSnapshot = { ...snapshot, at: 207.5 }
  const event = { type: 'pointerdown', isTrusted: true, pointerId: 1, button: 0, buttons: 1, clientX: 1296.4, clientY: 164.1,
    at: 205.25, owner, request: 'request:110:zero-overlap', source, labelDocumentRevision: revision }
  const live = { state, snapshot, afterState: state, afterSnapshot,
    capture: { inheritedState: state, inherited: { ...snapshot, at: 200.125 }, preparedState: state, prepared: snapshot,
      actions: [{ name: 'collapse', purpose: 'capture-obstruction', events: [event], stateBefore: state,
        before: { ...snapshot, at: 201.5, toolbar: { ...snapshot.toolbar, collapsed: false } }, stateAfter: state, after: snapshot }],
      decision: { action: 'collapse', reason: 'measured-toolbar-obstruction', obstructions: [{ kind: 'hit-stack', index: 1 }] },
      image: { attempts: 1, path: `signed-${ambientDimension}d-live.png`, bytes: 36882, sha256: 'e'.repeat(64), width: 1700, height: 1300,
        fullPage: false, scale: 'css', frame: { origin: { x: 0, y: 0 }, viewport, ctm } },
      restoration: { actions: [{ name: 'expand', purpose: 'restore', events: [{ ...event, type: 'click', at: 211 }],
        stateBefore: state, before: { ...snapshot, at: 210 }, stateAfter: state, after: { ...snapshot, at: 212 } }],
        stateBefore: state, before: { ...snapshot, at: 209 }, stateAfter: state, after: { ...snapshot, at: 213 } },
      cleanup: { observerRegistries: Object.fromEntries(['geometricSelection', 'pointNativeDrag', 'zeroAxisInput', 'zeroAxisCapture']
        .map((name) => [name, { present: false, size: 0 }])), listenersInstalled: 0, altKeyUp: 'completed-by-native-interaction' }, secondaryErrors: [] },
    pixels: { method: 'actual-native-PNG-magenta-stroke-pixel-centers', ctm, pixels: 632, bytes: 36882, sha256: 'e'.repeat(64), width: 1700, height: 1300,
      bounds: { minX: -.2, maxX: .2, minY: -34.02419354838708, maxY: 33.71774193548388 } } }
  return live
}

function recordedWriter() {
  const writes = []
  return { writes, async write(path, bytes) {
    writes.push({ path, bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex') })
    await writeFile(path, bytes)
  } }
}

for (const ambientDimension of [2, 3]) test(`owned publication resolves all faithful ${ambientDimension}D full-stroke observations exactly`, async (t) => {
  const artifactDir = await directory(t), writer = recordedWriter(), publisher = createEvidencePublisher({ artifactDir, checkout, write: writer.write })
  const live = liveFixture(ambientDimension), expected = structuredClone(live)
  await publisher.publish('live.json', live, { stage: 'restored-after-image-attempt' })
  const resolved = readEvidenceDocumentSync(artifactDir, 'live.json', { checkout })
  assert.deepEqual(resolved, expected)
  assert.equal(resolved.snapshot.captureGeometry.samples.length, 640)
  assert.ok(resolved.snapshot.captureGeometry.samples.every((sample) => sample.elementsFromPoint.length === 16))
  assert.deepEqual(resolved.capture.actions[0].events, expected.capture.actions[0].events)
  assert.notEqual(resolved.snapshot.at, resolved.afterSnapshot.at, 'Similar snapshots retain distinct boundary timestamps')
  assert.equal(resolved.state.history, expected.state.history)
  assert.equal(resolved.state.runtimeDiagramJson, expected.state.runtimeDiagramJson)
  assert.equal(resolved.snapshot.layout.owner, expected.snapshot.layout.owner)
  assert.equal(resolved.snapshot.layout.source, expected.snapshot.layout.source)
  assert.ok(writer.writes.length > 0, 'Resolution uses retained ordinary writer bytes')
})

test('legacy complete documents still resolve without changing existing proof values', async (t) => {
  const artifactDir = await directory(t), value = liveFixture(2)
  await writeFile(join(artifactDir, 'legacy.json'), JSON.stringify(value))
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'legacy.json', { checkout }), value)
})

test('queued observations are frozen before awaiting a writer or another publication', async (t) => {
  const artifactDir = await directory(t), entered = publicationGate(), release = publicationGate(), finished = publicationGate()
  // Construct independent expensive inputs before holding the actual ordinary
  // writer. These observations prove enqueue-time freezing, not wall speed.
  const next = liveFixture(3), expected = structuredClone(next), deadlines = [], outcomes = []
  const own = promise => {
    const outcome = ownPublication(promise)
    outcomes.push(outcome)
    return outcome
  }
  let stalled = false
  const publisher = createEvidencePublisher({ artifactDir, checkout, scheduleDeadline: (expire, timeoutMs) => {
    const deadline = { expire, timeoutMs, cancelled: false }
    deadlines.push(deadline)
    return () => { deadline.cancelled = true }
  }, write: async (path, bytes) => {
    if (!stalled) {
      stalled = true; entered.resolve()
      try { await release.promise; await writeFile(path, bytes) } finally { finished.resolve() }
      return
    }
    await writeFile(path, bytes)
  } })
  try {
    const first = own(publisher.publish('first.json', { stage: 'before', value: 1 }, { stage: 'before' }))
    // An unexpected rejection before writer entry cannot orphan the entry gate.
    await awaitPublicationEntry(entered, first)
    const queued = own(publisher.publish('second.json', next, { stage: 'after' }))
    assert.equal(deadlines.length, 2)
    assert.ok(deadlines.every(deadline => deadline.timeoutMs === 5000 && !deadline.cancelled))
    next.snapshot.captureGeometry.samples[639].local.y = 999
    next.state.history = 'mutated after queue'
    next.capture.actions[0].events[0].source = 'mutated owner event'
    assert.equal(publisher.metrics.boundaries, 0, 'Neither publication has committed when queued inputs change')
    // Deterministic contention keeps a queued root behind a still-held ordinary
    // write while another event-loop turn observes the corrupted input.
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(publisher.metrics.boundaries, 0)
    release.resolve()
    publicationValue(await first); publicationValue(await queued)
    assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'second.json', { checkout }), expected)
    assert.ok(deadlines.every(deadline => deadline.cancelled), 'Every scoped deadline is cancelled')
  } finally {
    entered.resolve(); release.resolve()
    if (stalled) await finished.promise
    await Promise.all(outcomes)
  }
})

for (const late of ['fulfillment', 'rejection']) test(`stalled final publication owns late ${late} and cannot replace authoritative failure`, async (t) => {
  const artifactDir = await directory(t), entered = deferred(), gate = deferred(), finished = deferred(), lateError = new Error('late ordinary writer rejection')
  let stall = false, caught, stalledPath
  const unhandled = [], onUnhandled = (error) => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled); t.after(() => process.off('unhandledRejection', onUnhandled))
  const publisher = createEvidencePublisher({ artifactDir, checkout, timeoutMs: 20, write: async (path, bytes) => {
    if (stall) {
      stall = false; stalledPath = path; entered.resolve()
      try { await gate.promise; writeFileSync(path, bytes) } finally { finished.resolve() }
    } else writeFileSync(path, bytes)
  } })
  await publisher.publish('live.json', { result: 'observed', image: { attempts: 1 }, stage: 'pixels-before-assertion' }, { stage: 'pixels-before-assertion' })
  stall = true
  const pending = publisher.publish('live.json', { result: 'observed', image: { attempts: 1 }, restored: true,
    cleanup: { listenersInstalled: 0 }, stage: 'restored-after-image-attempt' }, { stage: 'restored-after-image-attempt' })
  await entered.promise
  await assert.rejects(pending, (error) => { caught = error; return /Timed out after 20ms/.test(error.message) })
  publisher.fail(caught)
  const failure = { result: 'failed', error: { message: caught.message, stack: caught.stack },
    image: { attempts: 1 }, restored: true, cleanup: { listenersInstalled: 0 }, nativeChecks: 5 }
  await publisher.publish('live.json', failure, { stage: 'failure-after-restoration', disposition: 'failed' })
  const terminal = await readFile(join(artifactDir, 'live.json'))
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'live.json', { checkout }), failure)
  if (late === 'fulfillment') gate.resolve(); else gate.reject(lateError)
  await finished.promise
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(await readFile(join(artifactDir, 'live.json')), terminal)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'live.json', { checkout }), failure)
  assert.deepEqual(unhandled, [], 'The timed-out operation retains a rejection handler')
  assert.notEqual(basename(stalledPath), 'live.json', 'Late writer owns immutable bytes, never the authoritative pointer')
  assert.equal(publisher.primary, caught)
  assert.throws(() => publisher.publish('live.json', { result: 'passed' }, { stage: 'invalid-success', disposition: 'passed' }),
    (error) => error === caught)
})

test('an immediate ordinary writer error remains the exact primary Error after subsequent failures', async (t) => {
  const artifactDir = await directory(t), primary = new Error('controlled first artifact failure'), secondary = new Error('controlled second writer failure')
  let failures = 0
  const publisher = createEvidencePublisher({ artifactDir, checkout, write: async () => { throw ++failures === 1 ? primary : secondary } })
  await assert.rejects(publisher.publish('failure.json', { result: 'observed' }, { stage: 'first' }), (error) => error === primary)
  publisher.fail(secondary)
  assert.throws(() => publisher.publish('failure.json', { result: 'passed' }, { stage: 'invalid-success', disposition: 'passed' }), (error) => error === primary)
  assert.equal(publisher.primary, primary)
  assert.equal(Object.keys(primary).length, 0, 'Publication does not mutate the original Error object')
})

for (const fault of ['no-write', 'truncated', 'corrupt', 'symlink']) test(`ordinary ${fault} writer cannot publish a reference before exact retained-byte authentication`, async (t) => {
  const artifactDir = await directory(t)
  const publisher = createEvidencePublisher({ artifactDir, checkout, write: async (path, bytes) => {
    if (fault === 'no-write') return
    if (fault === 'truncated') { writeFileSync(path, bytes.subarray(0, bytes.length - 1)); return }
    if (fault === 'corrupt') {
      const corrupted = Buffer.from(bytes); corrupted[0] ^= 1; writeFileSync(path, corrupted); return
    }
    const target = `${path}.target`
    writeFileSync(target, bytes); symlinkSync(target, path)
  } })
  let primary
  await assert.rejects(publisher.publish('unpublished.json', { raw: 'a faithful raw observation'.repeat(12) }, { stage: 'before-native-input' }), (error) => {
    primary = error
    return fault === 'no-write' ? error.code === 'ENOENT' : fault === 'truncated' ? /byte length/.test(error.message)
      : fault === 'corrupt' ? /SHA256/.test(error.message) : /ordinary raw file|regular file/.test(error.message)
  })
  assert.equal(publisher.primary, primary)
  assert.equal(existsSync(join(artifactDir, 'unpublished.json')), false)
  const index = await readJson(artifactDir, 'evidence-publication-index.json')
  assert.equal(index.disposition, 'failed')
  assert.deepEqual(index.documents, {})
  assert.deepEqual(index.history, [])
  assert.equal(index.primary.message, primary.message)
})

test('terminal cumulative publication locks later running and passed owners', async (t) => {
  const artifactDir = await directory(t), publisher = createEvidencePublisher({ artifactDir, checkout })
  const report = { result: 'passed', stage: 'complete', completed: ['controlled-group'], diagnostics: [], evidence: [] }
  await publisher.publish('free-labels-evidence.json', report, { stage: report.stage, disposition: 'passed' })
  const authoritative = await readFile(join(artifactDir, 'free-labels-evidence.json'))
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }), report)
  for (const disposition of ['running', 'passed']) assert.throws(() => publisher.publish('free-labels-evidence.json',
    { ...report, result: disposition }, { stage: 'late-publication', disposition }), /already terminal/)
  assert.deepEqual(await readFile(join(artifactDir, 'free-labels-evidence.json')), authoritative)
  assert.equal(JSON.parse(await readFile(join(artifactDir, 'evidence-publication-index.json'), 'utf8')).disposition, 'passed')
})

test('a cumulative passed flag in a running raw boundary cannot establish terminal acceptance', async (t) => {
  const artifactDir = await directory(t), publisher = createEvidencePublisher({ artifactDir, checkout })
  await publisher.publish('free-labels-evidence.json', { result: 'passed', stage: 'complete' }, { stage: 'complete' })
  assert.throws(() => readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }), /terminal publication/)
})

test('the absolute publication deadline blocks authority even before delayed timer delivery', async t => {
  const artifactDir = await directory(t), scheduled = [], entered = deferred(), release = deferred()
  let clockMs = 10
  const schedule = (expire, timeoutMs) => {
    const deadline = { expire, timeoutMs, cancelled: false }; scheduled.push(deadline)
    return () => { deadline.cancelled = true }
  }
  schedule.monotonicNow = () => clockMs
  const publisher = createEvidencePublisher({ artifactDir, checkout, scheduleDeadline: schedule, write: async (path, bytes) => {
    await writeFile(path, bytes)
    if (path.endsWith('.boundary.json')) { entered.resolve(); await release.promise }
  } })
  const outcome = ownPublication(publisher.publish('proof.json', { result: 'observed', raw: 'first' }, { stage: 'absolute-deadline' }))
  try {
    await awaitPublicationEntry(entered, outcome)
    assert.deepEqual(scheduled.map(entry => entry.timeoutMs), [5000])
    clockMs = 5010 // No timer callback fires: the authority guard owns expiry.
    release.resolve()
    const result = await outcome
    assert.equal(result.ok, false); assert.match(result.error.message, /Timed out after 5000ms/)
    assert.equal(existsSync(join(artifactDir, 'proof.json')), false)
    assert.deepEqual((await readJson(artifactDir, 'evidence-publication-index.json')).documents, {})
    assert.ok(scheduled.every(entry => entry.cancelled))
  } finally { entered.resolve(); release.resolve(); await outcome }
})

test('a composed producer expiry after index serialization cannot publish running authority', async t => {
  const artifactDir = await directory(t)
  let clockMs = 0
  const operation = createPointDiagnosticOperation('Geometric selection final evidence', 2000, () => clockMs)
  const mark = operation.mark
  operation.mark = (phase, details) => {
    const record = mark(phase, details)
    if (phase === 'publication:index-serialization-complete') clockMs = 2000
    return record
  }
  const publisher = createEvidencePublisher({ artifactDir, checkout })
  await assert.rejects(publisher.publish('proof.json', { result: 'observed', source: 'immutable' }, { stage: 'selection-finished', operation }),
    error => error === operation.error && /Timed out after 2000ms/.test(error.message))
  assert.equal(operation.state, 'expired')
  assert.equal(publisher.primary, undefined, 'The caller independently owns its composed outer Aggregate')
  assert.equal(existsSync(join(artifactDir, 'proof.json')), false)
  assert.equal(existsSync(join(artifactDir, 'evidence-publication-index.json')), false)
  const outer = new AggregateError([operation.error], 'Geometric selection diagnostics failed')
  publisher.fail(outer)
  await publisher.publish('proof.json', { result: 'observed', outerError: { message: outer.message }, secondaryErrors: [operation.error.message] },
    { stage: 'failure-cleanup', disposition: 'failed', primary: outer })
  const index = await readJson(artifactDir, 'evidence-publication-index.json')
  assert.equal(index.disposition, 'failed'); assert.equal(index.primary.message, outer.message)
  assert.equal(publisher.primary, outer)
})

test('failure authority cannot rename after its caller deadline crosses during serialization', async t => {
  const artifactDir = await directory(t), publisher = createEvidencePublisher({ artifactDir, checkout })
  await publisher.publish('proof.json', { result: 'observed', boundary: 'before-failure' }, { stage: 'before-failure' })
  const before = await readFile(join(artifactDir, 'evidence-publication-index.json')), primary = new Error('original native primary')
  let clockMs = 0
  const operation = createPointDiagnosticOperation('Geometric selection failure evidence', 2000, () => clockMs), mark = operation.mark
  operation.mark = (phase, details) => {
    const record = mark(phase, details)
    if (phase === 'publication:index-serialization-complete') clockMs = 2000
    return record
  }
  assert.equal(publisher.fail(primary, { operation }), primary)
  assert.equal(operation.state, 'expired')
  assert.equal(publisher.primary, primary, 'The original native Error was installed before expiry and remains exact')
  assert.deepEqual(await readFile(join(artifactDir, 'evidence-publication-index.json')), before,
    'Expired failure serialization cannot rename newer authority')
  await publisher.publish('proof.json', { result: 'observed', boundary: 'failure-cleanup', primary: primary.message },
    { stage: 'failure-cleanup', disposition: 'failed', primary })
  assert.equal((await readJson(artifactDir, 'evidence-publication-index.json')).primary.message, primary.message)
  assert.equal(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }).boundary, 'failure-cleanup')
})

test('expired failure entry cannot mutate primary and direct failure owns its fresh 5000ms budget', async t => {
  const artifactDir = await directory(t), publisher = createEvidencePublisher({ artifactDir, checkout })
  await publisher.publish('proof.json', { result: 'observed' }, { stage: 'before' })
  const before = await readFile(join(artifactDir, 'evidence-publication-index.json'))
  const expired = createPointDiagnosticOperation('expired selection evidence', 2000, () => 0)
  expired.expire()
  const late = new Error('late primary must never install')
  assert.throws(() => publisher.fail(late, { operation: expired }), error => error === expired.error)
  assert.equal(publisher.primary, undefined)
  assert.deepEqual(await readFile(join(artifactDir, 'evidence-publication-index.json')), before)
  const actual = new AggregateError([expired.error], 'actual outer diagnostic failure')
  assert.equal(publisher.fail(actual), actual)
  const owned = publisher.metrics.progress.find(record => record.phase === 'failure-authority-start')
  assert.equal(owned.timeoutMs, 5000)
  assert.equal(owned.deadlineMs, owned.startedMs + 5000)
  assert.ok(owned.operationOwner && owned.operationToken)
  assert.notEqual(owned.operationOwner, expired.owner, 'Cleanup does not borrow the expired diagnostic owner')
  const authority = await readFile(join(artifactDir, 'evidence-publication-index.json'))
  assert.equal(publisher.fail(late), actual)
  assert.deepEqual(await readFile(join(artifactDir, 'evidence-publication-index.json')), authority)
})

test('late ordinary rejection cannot install failure while the expired producer timer is undelivered', async t => {
  const artifactDir = await directory(t), entered = deferred(), release = deferred(), finished = deferred(), late = new Error('late writer rejection')
  let stall = false, writerStarted = false, clockMs = 0
  const publisher = createEvidencePublisher({ artifactDir, checkout, write: async (path, bytes) => {
    const held = stall && path.endsWith('.pack.json')
    if (held) { stall = false; writerStarted = true }
    try {
      await writeFile(path, bytes)
      if (held) { entered.resolve(); await release.promise }
    } finally { if (held) finished.resolve() }
  } })
  await publisher.publish('proof.json', { result: 'observed', boundary: 'before' }, { stage: 'before' })
  const before = await readFile(join(artifactDir, 'evidence-publication-index.json'))
  const operation = createPointDiagnosticOperation('Geometric selection final evidence', 2000, () => clockMs)
  const unhandled = [], onUnhandled = error => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled); t.after(() => process.off('unhandledRejection', onUnhandled))
  stall = true
  const outcome = ownPublication(publisher.publish('proof.json', { result: 'observed', boundary: 'selection-finished', raw: 'changed'.repeat(90) },
    { stage: 'selection-finished', operation }))
  try {
    await awaitPublicationEntry(entered, outcome)
    assert.equal(operation.state, 'active'); assert.equal(operation.timeoutMs, 2000)
    clockMs = operation.deadlineMs // The producer's timer has not delivered expiry.
    release.reject(late)
    const result = await outcome
    assert.equal(result.ok, false); assert.equal(result.error, operation.error)
    assert.match(result.error.message, /Timed out after 2000ms during Geometric selection final evidence/)
    assert.equal(operation.state, 'expired')
    assert.equal(publisher.primary, undefined, 'The late writer cannot install a new primary')
    assert.deepEqual(await readFile(join(artifactDir, 'evidence-publication-index.json')), before,
      'The late writer cannot overwrite authority')
    const outer = new AggregateError([operation.error], 'Geometric selection diagnostics failed')
    publisher.fail(outer)
    await publisher.publish('proof.json', { result: 'observed', boundary: 'failure-cleanup', secondaryErrors: [operation.error.message] },
      { stage: 'failure-cleanup', disposition: 'failed', primary: outer })
    assert.equal(publisher.primary, outer)
    assert.equal((await readJson(artifactDir, 'evidence-publication-index.json')).primary.message, outer.message)
    assert.equal(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }).boundary, 'failure-cleanup')
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(unhandled, [])
  } finally {
    entered.resolve(); release.resolve()
    await outcome; if (writerStarted) await finished.promise
  }
})

test('an owned writer failure rejects its producer before queued sibling authority can start', async t => {
  const artifactDir = await directory(t), entered = deferred(), release = deferred(), finished = deferred()
  const writerError = new Error('ordinary final diagnostic writer failure')
  let stall = false, writerStarted = false
  const publisher = createEvidencePublisher({ artifactDir, checkout, write: async (path, bytes) => {
    const held = stall && path.endsWith('.pack.json')
    if (held) { stall = false; writerStarted = true }
    try {
      await writeFile(path, bytes)
      if (held) { entered.resolve(); await release.promise }
    } finally { if (held) finished.resolve() }
  } })
  await publisher.publish('proof.json', { result: 'observed', boundary: 'before' }, { stage: 'before' })
  const before = await readFile(join(artifactDir, 'evidence-publication-index.json'))
  const operation = createPointDiagnosticOperation('Geometric selection final evidence', 2000, () => 0)
  const outcomes = []
  stall = true
  const first = ownPublication(publisher.publish('first.json', { raw: 'first'.repeat(90) }, { stage: 'selection-finished', operation }))
  outcomes.push(first)
  try {
    await awaitPublicationEntry(entered, first)
    const queued = ownPublication(publisher.publish('queued.json', { raw: 'queued'.repeat(90) }, { stage: 'queued-report', operation }))
    outcomes.push(queued)
    release.reject(writerError)
    assert.equal((await first).error, writerError)
    assert.equal((await queued).error, writerError)
    assert.equal(operation.state, 'rejected'); assert.equal(operation.error, writerError); assert.equal(operation.generation, 1)
    assert.equal(publisher.primary, undefined, 'The composed caller retains responsibility for its outer Aggregate')
    assert.equal(existsSync(join(artifactDir, 'first.json')), false); assert.equal(existsSync(join(artifactDir, 'queued.json')), false)
    assert.deepEqual(await readFile(join(artifactDir, 'evidence-publication-index.json')), before)
    const outer = new AggregateError([writerError], 'Geometric selection diagnostics failed')
    publisher.fail(outer)
    await publisher.publish('proof.json', { result: 'observed', boundary: 'failure-cleanup' },
      { stage: 'failure-cleanup', disposition: 'failed', primary: outer })
    assert.equal(publisher.primary, outer)
    assert.equal(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }).boundary, 'failure-cleanup')
  } finally {
    entered.resolve(); release.resolve()
    await Promise.all(outcomes); if (writerStarted) await finished.promise
  }
})

for (const late of ['fulfillment', 'rejection']) test(`an already-failed publication timeout cannot later ${late === 'fulfillment' ? 'fulfill over' : 'reject over'} newer failure authority`, async (t) => {
  const artifactDir = await directory(t), primary = new Error('original native primary'), entered = deferred(), gate = deferred(), finished = deferred()
  let stalled = false
  const unhandled = [], onUnhandled = (error) => unhandled.push(error)
  process.on('unhandledRejection', onUnhandled); t.after(() => process.off('unhandledRejection', onUnhandled))
  const publisher = createEvidencePublisher({ artifactDir, checkout, timeoutMs: 20, write: async (path, bytes) => {
    if (stalled) {
      stalled = false; entered.resolve()
      try { await gate.promise; writeFileSync(path, bytes) } finally { finished.resolve() }
    } else writeFileSync(path, bytes)
  } })
  await publisher.publish('failure.json', { result: 'observed', listenersInstalled: 2 }, { stage: 'before-failure' })
  assert.equal(publisher.fail(primary), primary)
  stalled = true
  const older = publisher.publish('failure.json', { result: 'failed', error: primary.message, cleanup: 'pending' },
    { stage: 'earlier-failure', disposition: 'failed' })
  await entered.promise
  await assert.rejects(older, /Timed out after 20ms/)
  assert.equal(publisher.primary, primary, 'A secondary failure-publication deadline cannot replace the native primary')
  const newer = { result: 'failed', error: primary.message, cleanup: 'complete', listenersInstalled: 0, nativeChecks: 5 }
  await publisher.publish('failure.json', newer, { stage: 'terminal-failure', disposition: 'failed' })
  const authoritative = await readFile(join(artifactDir, 'failure.json'))
  if (late === 'fulfillment') gate.resolve(); else gate.reject(new Error('late failed writer rejection'))
  await finished.promise; await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(await readFile(join(artifactDir, 'failure.json')), authoritative)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'failure.json', { checkout }), newer)
  assert.equal(JSON.parse(await readFile(join(artifactDir, 'evidence-publication-index.json'), 'utf8')).primary.message, primary.message)
  assert.equal(publisher.primary, primary)
  assert.deepEqual(unhandled, [])
})

test('actual live/native/observe/report path writes shared proof once and compact ordered boundaries afterward', async (t) => {
  const artifactDir = await directory(t), writer = recordedWriter(), publisher = createEvidencePublisher({ artifactDir, checkout, write: writer.write })
  const storage = createEvidenceReportStorage({ artifactDir, checkout, publisher }), live = liveFixture(2)
  const group = 'point-node-layout-anchors-combined', scenario = 'signed-polygonal-zero-axis', stem = `${scenario}-2d`
  const report = { result: 'running', stage: 'point-node-layout-anchors', checkout, started: [group], completed: [],
    unexecuted: ['final-standalone'], diagnostics: [], checkpoints: [], evidence: [], pageErrors: [] }
  const zeroAxisCase = { ambientDimension: 2, axisInteraction: { owner: live.snapshot.layout.owner, events: live.capture.actions[0].events }, liveObservation: live }
  const retainer = createLiveEvidenceRetainer({ publisher, stem, scenario, group, zeroAxisCase, polygonalCases: [],
    observe: async (name, details) => {
      report.checkpoints.push({ group, name }); report.diagnostics.push({ name, ...details })
      await storage.save(report)
    } })
  await retainer('pixels-before-assertion', live)
  const initiallyWritten = publisher.metrics.uniqueNodes, initialWrites = writer.writes.length
  const graphBytes = publisher.metrics.uniqueNodeBytes, initialPackWrites = publisher.metrics.packWrites
  for (const boundary of ['before-restoration', 'restored-after-image-attempt']) await retainer(boundary, live)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, `${stem}-live-capture.json`, { checkout }), live)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, `${stem}-native.json`, { checkout }).zeroAxisCase.liveObservation, live)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }), report)
  assert.equal(report.diagnostics.length, 3); assert.equal(report.checkpoints.length, 3)
  const subsequentWrites = writer.writes.slice(initialWrites)
  assert.ok(subsequentWrites.every(({ bytes }) => bytes < 16_384), 'Repeated boundaries retain compact refs, not a full live/native/report dump')
  assert.ok(publisher.metrics.uniqueNodes - initiallyWritten < 25, 'Only changed ordered report nodes are serialized anew')
  assert.ok(publisher.metrics.uniqueNodeBytes - graphBytes < 16_384, 'Unchanged full samples/state/descriptors are interned once')
  assert.ok(publisher.metrics.packWrites - initialPackWrites <= 2, 'Live/native unchanged roots need no new raw pack')
  assert.equal(publisher.metrics.boundaries, 9)
  assert.equal(publisher.metrics.manifestWrites, 9)
  assert.equal(publisher.metrics.pointerWrites, 9)
  const packNames = writer.writes.filter(({ path }) => path.endsWith('.pack.json')).map(({ path }) => path)
  assert.equal(new Set(packNames).size, packNames.length, 'A retained immutable pack is written once')
  assert.ok(publisher.metrics.operations.every(({ bytes, durationMs }) => Number.isSafeInteger(bytes) && bytes > 0 && Number.isFinite(durationMs) && durationMs >= 0))
  assert.equal(publisher.metrics.operations.filter(({ kind }) => ['pack', 'boundary'].includes(kind)).reduce((sum, { bytes }) => sum + bytes, 0),
    publisher.metrics.retainedBytes)
  assert.equal(publisher.metrics.operations.filter(({ kind }) => kind === 'pointer').reduce((sum, { bytes }) => sum + bytes, 0), publisher.metrics.pointerBytes)
  assert.equal(publisher.metrics.operations.filter(({ kind }) => kind === 'index').reduce((sum, { bytes }) => sum + bytes, 0), publisher.metrics.indexBytes)
  assert.ok(publisher.metrics.encodeMs >= 0 && publisher.metrics.writeMs >= 0)
  assert.deepEqual((await readdir(artifactDir)).filter((name) => name.endsWith('.png')), [], 'Persistence never captures or retries the one image')
})

test('scoped report storage externalizes earlier large diagnostics losslessly without altering earlier groups', async (t) => {
  const artifactDir = await directory(t), writer = recordedWriter(), publisher = createEvidencePublisher({ artifactDir, checkout, write: writer.write })
  const storage = createEvidenceReportStorage({ artifactDir, checkout, publisher, write: writer.write }), live = liveFixture(3)
  const report = { result: 'running', stage: 'phase32c', started: ['point-node-geometric-shapes'], diagnostics: [{ name: 'native-interaction', live }],
    completed: ['point-node-geometric-shapes'], evidence: [{ name: 'overflow', owner: live.snapshot.layout.owner, state: live.state }], checkpoints: [] }
  await storage.save(report)
  assert.equal(JSON.parse(await readFile(join(artifactDir, 'free-labels-evidence.json'), 'utf8')).schema, undefined)
  assert.equal(publisher.metrics.boundaries, 0, 'The 31F/32A/32C persistence path remains ordinary raw JSON')
  report.started.push('point-node-layout-anchors-combined'); report.stage = 'phase32d'
  await storage.save(report)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }), report)
  assert.ok((await readFile(join(artifactDir, 'free-labels-evidence.json'))).length < 2048, 'Current report is a compact authenticated reference')
  const uniqueNodes = publisher.metrics.uniqueNodes, uniqueBytes = publisher.metrics.uniqueNodeBytes
  report.checkpoints.push({ group: 'point-node-layout-anchors-combined', name: 'final-live-restored' })
  await storage.save(report)
  assert.ok(publisher.metrics.uniqueNodes - uniqueNodes <= 4)
  assert.ok(publisher.metrics.uniqueNodeBytes - uniqueBytes < 4096)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }).diagnostics[0].live, live)
})

const bytesFor = (value) => Buffer.from(JSON.stringify(value) + '\n')
const refFor = (path, bytes) => ({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
const readJson = async (directory, name) => JSON.parse(await readFile(join(directory, name), 'utf8'))

async function commitTamperedDocument(artifactDir, document) {
  await writeFile(join(artifactDir, 'proof.json'), bytesFor(document))
  const index = await readJson(artifactDir, 'evidence-publication-index.json')
  index.documents['proof.json'] = document
  const history = index.history?.find((entry) => entry.name === 'proof.json' && entry.sequence === document.identity.sequence)
  if (history) Object.assign(history, { stage: document.identity.stage, disposition: document.identity.disposition, artifact: document.artifact })
  await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
}

async function mutateBoundary(artifactDir, mutate) {
  const document = await readJson(artifactDir, 'proof.json'), boundary = await readJson(artifactDir, document.artifact.path)
  await mutate(boundary)
  const bytes = bytesFor(boundary)
  await writeFile(join(artifactDir, document.artifact.path), bytes)
  document.artifact = refFor(document.artifact.path, bytes)
  await commitTamperedDocument(artifactDir, document)
}

async function packReferences(artifactDir, boundary) {
  if (boundary.schema === 'stz-evidence-boundary-v1') return boundary.packs
  const groups = []
  let ref = boundary.packReferences
  while (ref) {
    const chunk = await readJson(artifactDir, ref.path)
    groups.unshift(chunk.packs); ref = chunk.previous
  }
  return groups.flat()
}

async function mutateReferences(artifactDir, mutate) {
  await mutateBoundary(artifactDir, async boundary => {
    const refs = await packReferences(artifactDir, boundary)
    await mutate(refs)
    if (boundary.schema === 'stz-evidence-boundary-v1') { boundary.packs = refs; return }
    let previous = null
    for (let ordinal = 0; ordinal < refs.length; ordinal++) {
      const pack = refs[ordinal], path = `control-${boundary.identity.owner}-${ordinal}.references.json`
      const bytes = bytesFor({ schema: 'stz-evidence-pack-references-v2',
        identity: { owner: boundary.identity.owner, checkout: boundary.identity.checkout, sequence: pack.sequence, stage: pack.stage },
        previous, packs: [pack] })
      await writeFile(join(artifactDir, path), bytes); previous = refFor(path, bytes)
    }
    boundary.packReferences = previous; boundary.packCount = refs.length
  })
}

async function mutatePack(artifactDir, mutate) {
  await mutateReferences(artifactDir, async (refs) => {
    const ref = refs[0], pack = await readJson(artifactDir, ref.path)
    mutate(pack)
    const bytes = bytesFor(pack)
    await writeFile(join(artifactDir, ref.path), bytes)
    Object.assign(ref, refFor(ref.path, bytes))
  })
}

async function referencedProof(t) {
  const artifactDir = await directory(t), publisher = createEvidencePublisher({ artifactDir, checkout }), value = liveFixture(2)
  await publisher.publish('proof.json', value, { stage: 'before' })
  value.afterSnapshot = { ...value.afterSnapshot, at: 217.75, events: [{ owner: value.snapshot.layout.owner, at: 216.25, type: 'input', isTrusted: true }] }
  await publisher.publish('proof.json', value, { stage: 'after' })
  const document = await readJson(artifactDir, 'proof.json'), boundary = await readJson(artifactDir, document.artifact.path)
  const refs = await packReferences(artifactDir, boundary)
  assert.ok(refs.length >= 2, 'Corruption fixture proves ordered shared and changed raw packs')
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }), value)
  return { artifactDir, document, boundary, refs, publisher }
}

// Retained v1 metadata is produced explicitly, with recomputed exact artifact
// bytes. The reader must honor the declared representation; this fixture never
// routes old data through a permissive normalization or a new publisher.
async function retainedV1Fixture(t) {
  const artifactDir = await directory(t), publisher = createEvidencePublisher({ artifactDir, checkout })
  const value = { source: ' raw $F$\t\n', entries: Array.from({ length: 130 }, (_, index) => ({ index, source: 'x'.repeat(140), owner: `owner-${index}` })) }
  await publisher.publish('proof.json', value, { stage: 'before' })
  value.entries.push({ index: 130, source: 'later raw', owner: 'owner-130' })
  await publisher.publish('proof.json', value, { stage: 'after' })
  const report = { result: 'running', stage: 'legacy-running', diagnostics: [{ artifact: 'proof.json', value }] }
  await publisher.publish('free-labels-evidence.json', report, { stage: report.stage })
  const index = await readJson(artifactDir, 'evidence-publication-index.json')
  const current = await readJson(artifactDir, index.history.at(-1).artifact.path)
  const refs = await packReferences(artifactDir, current), legacyRefs = []
  for (const ref of refs) {
    const pack = await readJson(artifactDir, ref.path)
    pack.schema = 'stz-evidence-pack-v1'; pack.identity.checkout = checkout
    const bytes = bytesFor(pack)
    await writeFile(join(artifactDir, ref.path), bytes)
    legacyRefs.push({ ...ref, ...refFor(ref.path, bytes) })
  }
  for (const entry of index.history) {
    const boundary = await readJson(artifactDir, entry.artifact.path)
    boundary.schema = 'stz-evidence-boundary-v1'; boundary.identity.checkout = checkout
    boundary.packs = legacyRefs.filter(ref => ref.sequence <= entry.sequence)
    delete boundary.packCount; delete boundary.packReferences
    const bytes = bytesFor(boundary)
    await writeFile(join(artifactDir, entry.artifact.path), bytes)
    entry.artifact = refFor(entry.artifact.path, bytes)
  }
  index.schema = 'stz-evidence-publication-index-v1'; index.checkout = checkout
  for (const [name, document] of Object.entries(index.documents)) {
    document.schema = 'stz-evidence-document-v1'; document.identity.checkout = checkout
    document.artifact = index.history.find(entry => entry.sequence === document.identity.sequence).artifact
    await writeFile(join(artifactDir, name), bytesFor(document))
  }
  await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }), value)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }), report)
  return { artifactDir, index, refs: legacyRefs, report, value }
}

test('declared authenticated v1 reports retain exact ordered raw and complete historical replay', async t => {
  const { artifactDir, report, value } = await retainedV1Fixture(t)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }), report)
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }).entries, value.entries)
})

for (const fault of ['missing-history', 'missing-pack', 'wrong-hash', 'wrong-owner', 'wrong-identity', 'wrong-order', 'wrong-sequence', 'wrong-array-chunk']) {
  test(`declared authenticated v1 parent replay rejects ${fault}`, async t => {
    const { artifactDir, index, refs } = await retainedV1Fixture(t)
    if (fault === 'missing-history') await rm(join(artifactDir, index.history[0].artifact.path))
    if (fault === 'missing-pack') await rm(join(artifactDir, refs[0].path))
    if (fault === 'wrong-hash') await writeFile(join(artifactDir, refs[0].path), '{}')
    if (fault === 'wrong-owner' || fault === 'wrong-identity' || fault === 'wrong-sequence') {
      const document = index.documents['free-labels-evidence.json']
      if (fault === 'wrong-owner') document.identity.owner = 'wrong-owner'
      if (fault === 'wrong-identity') document.identity.checkout = { fingerprint: checkout.fingerprint }
      if (fault === 'wrong-sequence') document.identity.sequence++
      await writeFile(join(artifactDir, 'free-labels-evidence.json'), bytesFor(document))
    }
    if (fault === 'wrong-order') {
      index.history.reverse(); await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
    }
    if (fault === 'wrong-array-chunk') {
      const entry = index.history[0], boundary = await readJson(artifactDir, entry.artifact.path)
      boundary.root = ['c', [['a', [1]], ['a', [2]]]]
      const bytes = bytesFor(boundary); await writeFile(join(artifactDir, entry.artifact.path), bytes)
      entry.artifact = refFor(entry.artifact.path, bytes)
      await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
    }
    assert.throws(() => readEvidenceDocumentSync(artifactDir, 'free-labels-evidence.json', { checkout }))
  })
}

for (const fault of ['missing-identity', 'substituted-identity', 'wrong-identity-owner', 'identity-missing-entry', 'identity-wrong-entry',
  'identity-wrong-reference', 'missing-reference-chunk', 'wrong-reference-owner', 'wrong-reference-tree', 'wrong-reference-sequence',
  'wrong-reference-stage', 'wrong-reference-hash', 'reference-cycle', 'reference-unknown-field', 'boundary-ignored-packs']) {
  test(`compact exact authority rejects ${fault}`, async t => {
    const { artifactDir, document, boundary } = await referencedProof(t)
    const identityRef = document.identity.checkout
    if (fault === 'missing-identity') await rm(join(artifactDir, identityRef.path))
    if (fault === 'substituted-identity') await writeFile(join(artifactDir, identityRef.path), '{}')
    if (fault === 'identity-wrong-reference') {
      document.identity.checkout = { ...identityRef, sha256: '0'.repeat(64) }
      await commitTamperedDocument(artifactDir, document)
    }
    if (['wrong-identity-owner', 'identity-missing-entry', 'identity-wrong-entry'].includes(fault)) {
      const canonical = await readJson(artifactDir, identityRef.path)
      if (fault === 'wrong-identity-owner') canonical.owner = 'wrong-owner'
      if (fault === 'identity-missing-entry') canonical.checkout.untrackedSha256 = {}
      if (fault === 'identity-wrong-entry') canonical.checkout.untrackedSha256['tests/fixtures/authenticated-reference.tex'] = '0'.repeat(64)
      const bytes = bytesFor(canonical); await writeFile(join(artifactDir, identityRef.path), bytes)
      document.identity.checkout = refFor(identityRef.path, bytes)
      // Both pointer and index agree on the substituted ref; exact expected tree
      // and owner authentication must still reject it before any raw acceptance.
      const index = await readJson(artifactDir, 'evidence-publication-index.json')
      index.checkout = document.identity.checkout
      index.documents['proof.json'] = document
      await writeFile(join(artifactDir, 'proof.json'), bytesFor(document))
      await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
    }
    if (fault === 'missing-reference-chunk') await rm(join(artifactDir, boundary.packReferences.path))
    if (fault === 'wrong-reference-hash') await mutateBoundary(artifactDir, entry => { entry.packReferences.sha256 = '0'.repeat(64) })
    if (fault === 'boundary-ignored-packs') await mutateBoundary(artifactDir, entry => { entry.packs = [] })
    if (['wrong-reference-owner', 'wrong-reference-tree', 'wrong-reference-sequence', 'wrong-reference-stage', 'reference-cycle', 'reference-unknown-field'].includes(fault)) {
      await mutateBoundary(artifactDir, async entry => {
        const ref = entry.packReferences, chunk = await readJson(artifactDir, ref.path)
        if (fault === 'wrong-reference-owner') chunk.identity.owner = 'wrong-owner'
        if (fault === 'wrong-reference-tree') chunk.identity.checkout = { ...identityRef, sha256: '0'.repeat(64) }
        if (fault === 'wrong-reference-sequence') chunk.identity.sequence++
        if (fault === 'wrong-reference-stage') chunk.identity.stage = 'unobserved-stage'
        if (fault === 'reference-cycle') chunk.previous = ref
        if (fault === 'reference-unknown-field') chunk.ignored = []
        const bytes = bytesFor(chunk); await writeFile(join(artifactDir, ref.path), bytes)
        entry.packReferences = refFor(ref.path, bytes)
      })
    }
    assert.throws(() => readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }))
  })
}

for (const fault of ['missing-boundary', 'missing-pack', 'truncated-pack', 'wrong-hash', 'wrong-length', 'wrong-owner', 'wrong-stage',
  'wrong-tree', 'wrong-order', 'duplicate-pack', 'missing-node', 'conflicting-node', 'unpublished-pointer', 'path-escape', 'unknown-document-schema', 'unknown-graph-tag',
  'missing-history-boundary', 'truncated-history-boundary', 'wrong-history-order', 'unknown-history-graph-tag', 'missing-history-pack-coverage']) {
  test(`strict replay rejects ${fault} raw proof rather than trusting compact authority`, async (t) => {
    const { artifactDir, document, refs, publisher } = await referencedProof(t)
    let expected, readerName = 'proof.json'
    if (fault === 'missing-boundary') { await rm(join(artifactDir, document.artifact.path)); expected = /ENOENT/ }
    if (fault === 'missing-pack') { await rm(join(artifactDir, refs[0].path)); expected = /ENOENT/ }
    if (fault === 'truncated-pack') { await writeFile(join(artifactDir, refs[0].path), '{'); expected = /byte length/ }
    if (fault === 'wrong-hash') { await mutateReferences(artifactDir, (entries) => { entries[0].sha256 = '0'.repeat(64) }); expected = /SHA256/ }
    if (fault === 'wrong-length') { await mutateReferences(artifactDir, (entries) => { entries[0].bytes++ }); expected = /byte length/ }
    if (fault === 'wrong-owner') { await mutatePack(artifactDir, (entry) => { entry.identity.owner = 'other-owner' }); expected = /deep-equal|equal/ }
    if (fault === 'wrong-stage') { await mutatePack(artifactDir, (entry) => { entry.identity.stage = 'unobserved-stage' }); expected = /deep-equal|equal/ }
    if (fault === 'wrong-tree') { expected = /current tree/ }
    if (fault === 'wrong-order') { await mutateReferences(artifactDir, (entries) => { entries.reverse() }); expected = /publication order/ }
    if (fault === 'duplicate-pack') { await mutateReferences(artifactDir, (entries) => { entries.push(entries[0]) }); expected = /publication order|unique/ }
    if (fault === 'missing-node') { await mutatePack(artifactDir, (entry) => { entry.nodes.shift() }); expected = /Every evidence reference/ }
    if (fault === 'conflicting-node') { await mutatePack(artifactDir, (entry) => { entry.nodes.push(entry.nodes[0]) }); expected = /intern order|duplicate/ }
    if (fault === 'unpublished-pointer') {
      document.identity.stage = 'not-the-published-stage'
      await writeFile(join(artifactDir, 'proof.json'), bytesFor(document)); expected = /current committed document/
    }
    if (fault === 'path-escape') { await mutateReferences(artifactDir, (entries) => { entries[0].path = '../foreign.pack.json' }); expected = /artifact directory/ }
    if (fault === 'unknown-document-schema') { document.schema = 'stz-evidence-document-v999'; await commitTamperedDocument(artifactDir, document); expected = /schema/ }
    if (fault === 'unknown-graph-tag') { await mutateBoundary(artifactDir, (entry) => { entry.root = ['unknown', []] }); expected = /Known lossless evidence graph tag/ }
    if (['missing-history-boundary', 'truncated-history-boundary', 'wrong-history-order', 'unknown-history-graph-tag', 'missing-history-pack-coverage'].includes(fault)) {
      await publisher.publish('free-labels-evidence.json', { result: 'running', stage: 'parent-report-root', started: ['point-node-layout-anchors-combined'],
        diagnostics: [{ artifact: 'proof.json' }] }, { stage: 'parent-report-root' })
      readerName = 'free-labels-evidence.json'
      const index = await readJson(artifactDir, 'evidence-publication-index.json')
      assert.ok(index.history.length >= 2)
      const historical = index.history[0]
      assert.notEqual(historical.artifact.path, document.artifact.path)
      if (fault === 'missing-history-boundary') { await rm(join(artifactDir, historical.artifact.path)); expected = /ENOENT/ }
      if (fault === 'truncated-history-boundary') { await writeFile(join(artifactDir, historical.artifact.path), '{'); expected = /byte length/ }
      if (fault === 'wrong-history-order') {
        index.history.reverse(); await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index)); expected = /history|order|sequence/i
      }
      if (fault === 'unknown-history-graph-tag' || fault === 'missing-history-pack-coverage') {
        const retained = await readJson(artifactDir, historical.artifact.path)
        if (fault === 'unknown-history-graph-tag') { retained.root = ['unknown', []]; expected = /Known lossless evidence graph tag/ }
        else { retained.packReferences = null; retained.packCount = 0; expected = /pack|coverage|prefix/i }
        const bytes = bytesFor(retained)
        await writeFile(join(artifactDir, historical.artifact.path), bytes)
        historical.artifact = refFor(historical.artifact.path, bytes)
        await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
      }
    }
    assert.throws(() => readEvidenceDocumentSync(artifactDir, readerName, { checkout: fault === 'wrong-tree' ? { ...checkout, fingerprint: 'f'.repeat(64) } : checkout }), expected)
  })
}
