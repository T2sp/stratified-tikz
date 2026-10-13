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

const checkout = { fingerprint: 'a'.repeat(64), head: 'b'.repeat(40), trackedDiffSha256: 'c'.repeat(64), untrackedSha256: 'd'.repeat(64) }

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

async function mutatePack(artifactDir, mutate) {
  await mutateBoundary(artifactDir, async (boundary) => {
    const ref = boundary.packs[0], pack = await readJson(artifactDir, ref.path)
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
  assert.ok(boundary.packs.length >= 2, 'Corruption fixture proves ordered shared and changed raw packs')
  assert.deepEqual(readEvidenceDocumentSync(artifactDir, 'proof.json', { checkout }), value)
  return { artifactDir, document, boundary, publisher }
}

for (const fault of ['missing-boundary', 'missing-pack', 'truncated-pack', 'wrong-hash', 'wrong-length', 'wrong-owner', 'wrong-stage',
  'wrong-tree', 'wrong-order', 'duplicate-pack', 'missing-node', 'conflicting-node', 'unpublished-pointer', 'path-escape', 'unknown-document-schema', 'unknown-graph-tag',
  'missing-history-boundary', 'truncated-history-boundary', 'wrong-history-order', 'unknown-history-graph-tag', 'missing-history-pack-coverage']) {
  test(`strict replay rejects ${fault} raw proof rather than trusting compact authority`, async (t) => {
    const { artifactDir, document, boundary, publisher } = await referencedProof(t)
    let expected, readerName = 'proof.json'
    if (fault === 'missing-boundary') { await rm(join(artifactDir, document.artifact.path)); expected = /ENOENT/ }
    if (fault === 'missing-pack') { await rm(join(artifactDir, boundary.packs[0].path)); expected = /ENOENT/ }
    if (fault === 'truncated-pack') { await writeFile(join(artifactDir, boundary.packs[0].path), '{'); expected = /byte length/ }
    if (fault === 'wrong-hash') { await mutateBoundary(artifactDir, (entry) => { entry.packs[0].sha256 = '0'.repeat(64) }); expected = /SHA256/ }
    if (fault === 'wrong-length') { await mutateBoundary(artifactDir, (entry) => { entry.packs[0].bytes++ }); expected = /byte length/ }
    if (fault === 'wrong-owner') { await mutatePack(artifactDir, (entry) => { entry.identity.owner = 'other-owner' }); expected = /deep-equal|equal/ }
    if (fault === 'wrong-stage') { await mutatePack(artifactDir, (entry) => { entry.identity.stage = 'unobserved-stage' }); expected = /deep-equal|equal/ }
    if (fault === 'wrong-tree') { expected = /current tree/ }
    if (fault === 'wrong-order') { await mutateBoundary(artifactDir, (entry) => { entry.packs.reverse() }); expected = /publication order/ }
    if (fault === 'duplicate-pack') { await mutateBoundary(artifactDir, (entry) => { entry.packs.push(entry.packs[0]) }); expected = /publication order|unique/ }
    if (fault === 'missing-node') { await mutatePack(artifactDir, (entry) => { entry.nodes.shift() }); expected = /Every evidence reference/ }
    if (fault === 'conflicting-node') { await mutatePack(artifactDir, (entry) => { entry.nodes.push(entry.nodes[0]) }); expected = /intern order|duplicate/ }
    if (fault === 'unpublished-pointer') {
      document.identity.stage = 'not-the-published-stage'
      await writeFile(join(artifactDir, 'proof.json'), bytesFor(document)); expected = /current committed document/
    }
    if (fault === 'path-escape') { await mutateBoundary(artifactDir, (entry) => { entry.packs[0].path = '../foreign.pack.json' }); expected = /artifact directory/ }
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
        else { retained.packs = []; expected = /pack|coverage|prefix/i }
        const bytes = bytesFor(retained)
        await writeFile(join(artifactDir, historical.artifact.path), bytes)
        historical.artifact = refFor(historical.artifact.path, bytes)
        await writeFile(join(artifactDir, 'evidence-publication-index.json'), bytesFor(index))
      }
    }
    assert.throws(() => readEvidenceDocumentSync(artifactDir, readerName, { checkout: fault === 'wrong-tree' ? { ...checkout, fingerprint: 'f'.repeat(64) } : checkout }), expected)
  })
}
