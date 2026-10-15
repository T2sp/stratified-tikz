import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDiagnosticAction, assertDiagnosticMeasurement, assertUnsupportedDiagnosticEvidence,
  resolveDiagnosticCandidates } from '../../scripts/pointUnsupportedDiagnosticContract.mjs'
import { syntheticDiagnosticMeasurement, syntheticUnsupportedDiagnosticEvidence } from './pointUnsupportedDiagnosticFixture.mjs'

function resolved(measurement) { return { ...measurement, ...resolveDiagnosticCandidates(measurement) } }
function obscure(candidate) {
  const target = { ...candidate.hit.target, tag: 'button', canvas: false, canvasRoot: false, background: false,
    canvasToken: null, pointId: null, ownerToken: null, overlay: true }
  candidate.hit = { target, stack: [target] }
}

test('measured rightward off-canvas counterexample is retained and deterministic left probe reaches canvas', () => {
  const measurement = syntheticDiagnosticMeasurement()
  assert.equal(measurement.candidates[0].screen.x, 552.706)
  assert.ok(measurement.candidates[0].reasons.includes('outside-svg-viewbox'))
  assert.ok(measurement.candidates[0].reasons.includes('missing-native-target'))
  assert.equal(measurement.candidates[0].eligible, false)
  assert.equal(measurement.adopted, 'left'); assert.equal(measurement.nativeCanvasAtFarClick, true)
  assert.deepEqual(measurement.farClick.local, { x: -158.70600000000002, y: -1.5 })
  assertDiagnosticMeasurement(measurement, { requireCandidate: true })
})

test('left overlay rejection adopts bounded declared below candidate without trial input', () => {
  const measurement = syntheticDiagnosticMeasurement()
  obscure(measurement.candidates[1])
  const result = resolved(measurement)
  assert.equal(result.adopted, 'below')
  assert.ok(result.candidates[1].reasons.includes('unrelated-or-obstructed-native-target'))
  assert.equal(result.farClick.local.y, 107)
  assertDiagnosticMeasurement(result, { requireCandidate: true })
})

test('node and root frames respect nontrivial screen transforms and aspect-ratio letterboxing', () => {
  const measurement = syntheticDiagnosticMeasurement({
    canvasMatrix: { a: 2, b: 0, c: 0, d: 2, e: 40, f: 210 },
    nodeMatrix: { a: 1.8, b: .3, c: -.25, d: 1.8, e: 848, f: 282 },
    canvasClient: { left: 40, top: 70, right: 1080, bottom: 1070, width: 1040, height: 1000 },
  })
  assert.equal(measurement.adopted, 'left')
  assert.notDeepEqual(measurement.farClick.root, measurement.farClick.screen)
  assert.ok(Math.abs(measurement.farClick.screen.x - (measurement.farClick.root.x * 2 + 40)) < 1e-9)
  assert.ok(Math.abs(measurement.farClick.screen.y - (measurement.farClick.root.y * 2 + 210)) < 1e-9)
  assertDiagnosticMeasurement(measurement, { requireCandidate: true })
})

test('all measured candidates invalid remains observed with complete rejection reasons and no adopted input', () => {
  const measurement = syntheticDiagnosticMeasurement()
  for (const candidate of measurement.candidates) obscure(candidate)
  const result = resolved(measurement)
  assert.equal(result.adopted, null); assert.equal(result.farClick, null)
  assert.equal(result.nativeCanvasAtFarClick, false)
  assert.equal(result.candidates.length, 4); assert.ok(result.candidates.every(({ eligible, reasons }) => !eligible && reasons.length > 0))
  assertDiagnosticMeasurement(result)
  assert.throws(() => assertDiagnosticMeasurement(result, { requireCandidate: true }), /eligible negative candidate/)
})

test('native target inside client rectangle still fails the visible viewport and scrolling clip conditions', () => {
  const viewport = syntheticDiagnosticMeasurement()
  viewport.viewport.width = 200
  const clippedViewport = resolved(viewport)
  assert.equal(clippedViewport.adopted, null)
  assert.ok(clippedViewport.candidates.every(({ reasons }) => reasons.includes('outside-visible-viewport')))
  const scroll = syntheticDiagnosticMeasurement()
  scroll.clipAncestors.push({ bounds: { left: 300, top: 0, right: 520, bottom: 100, width: 220, height: 100 },
    overflowX: 'hidden', overflowY: 'auto', scrollLeft: 9, scrollTop: 20 })
  const clippedScroll = resolved(scroll)
  assert.equal(clippedScroll.adopted, null)
  assert.ok(clippedScroll.candidates[1].reasons.includes('outside-scroll-clip'))
  assert.ok(clippedScroll.candidates[2].reasons.includes('outside-scroll-clip'))
})

test('visible body, warning, selection ring and requested-shape conditions reject invalid far probes', () => {
  const body = syntheticDiagnosticMeasurement()
  body.candidates[1].local.x = -50
  let result = resolveDiagnosticCandidates(body)
  assert.ok(result.candidates[1].reasons.includes('inside-visible-body-clearance'))
  assert.ok(result.candidates[1].reasons.includes('inside-visible-warning-clearance'))
  const ring = syntheticDiagnosticMeasurement({ ring: { cx: 0, cy: 0, radius: 160 } })
  assert.equal(ring.adopted, null)
  assert.ok(ring.candidates[1].reasons.includes('inside-visible-selection-ring'))
  assert.throws(() => assertDiagnosticMeasurement(ring), /ring follows visible/)
  const shape = syntheticDiagnosticMeasurement()
  shape.shapeBounds = { minX: 1000, minY: 1000, maxX: 2200, maxY: 2200 }
  result = resolveDiagnosticCandidates(shape)
  assert.equal(result.adopted, null)
  assert.ok(result.candidates.every(({ reasons }) => reasons.includes('outside-requested-shape-bounds')))
})

test('coordinate binding rejects tampered root/client projection, singular matrices and stale native boxes', () => {
  for (const fault of ['screen', 'root', 'singular', 'box']) {
    const measurement = syntheticDiagnosticMeasurement()
    if (fault === 'screen') measurement.candidates[1].screen.x += 10
    if (fault === 'root') measurement.candidates[1].root.x += 10
    if (fault === 'singular') measurement.canvasMatrix.d = 0
    if (fault === 'box') measurement.nativeBounds.body.width += 3
    assert.throws(() => assertDiagnosticMeasurement(measurement, { requireCandidate: true }), fault)
  }
})

test('synthetic raw policy accepts owned body and warning routes with the exact six-case selection sequence', () => {
  for (const ambientDimension of [2, 3]) for (const shape of ['ellipse', 'circle', 'cylinder']) {
    const evidence = syntheticUnsupportedDiagnosticEvidence({ ambientDimension, shape })
    assert.equal(evidence.clicks[0].click.hit.target.background, false)
    assert.equal(evidence.clicks[0].click.hit.target.bodyTarget, true)
    assert.equal(evidence.clicks[2].click.hit.target.warning, true)
    assert.equal(evidence.clicks[0].selectedId, 'app-point')
    assert.equal(evidence.clicks[1].selectedId, null)
    assert.equal(evidence.clicks[2].selectedId, 'app-point')
    assertUnsupportedDiagnosticEvidence(evidence)
  }
})

test('visible-body native policy rejects disconnected, stale, unowned, absent and oversized body targets', () => {
  for (const fault of ['absent', 'disconnected', 'wrong-owner', 'stale-request', 'old-document', 'oversized', 'wrong-frame', 'export-included']) {
    const measurement = syntheticDiagnosticMeasurement()
    const raw = measurement.bodyTarget
    if (fault === 'absent') measurement.bodyTarget = null
    if (fault === 'disconnected') raw.descriptor.connected = false
    if (fault === 'wrong-owner') raw.descriptor.pointId = 'other-point'
    if (fault === 'stale-request') raw.descriptor.bodyRequest = 'obsolete-request'
    if (fault === 'old-document') raw.descriptor.ownerToken = '["point-node",1,"app-point"]'
    if (fault === 'oversized') raw.attributes.width = 1000
    if (fault === 'wrong-frame') raw.screenMatrix = { ...raw.screenMatrix, e: raw.screenMatrix.e + 10 }
    if (fault === 'export-included') raw.descriptor.exportExcluded = false
    assert.throws(() => assertDiagnosticMeasurement(measurement), fault)
  }
})

test('declared body success cannot substitute background delivery, modifiers, missing owner path, null selection or absent ring', () => {
  for (const fault of ['background', 'alt-cycle', 'missing-owner-path', 'null-selection', 'absent-ring']) {
    const evidence = syntheticUnsupportedDiagnosticEvidence(), action = evidence.clicks[0]
    if (fault === 'background') {
      const background = action.measurement.candidates[1].hit
      action.measurement.bodyClick.hit = background
      action.click.hit = background
    }
    if (fault === 'alt-cycle') action.events[0].altKey = true
    if (fault === 'missing-owner-path') action.events[0].path = [action.events[0].target, action.events[0].path.at(-1)]
    if (fault === 'null-selection') { action.after.selection = null; action.selectedId = null }
    if (fault === 'absent-ring') action.afterMeasurement.ring = null
    assert.throws(() => assertDiagnosticAction(action, evidence.rendered.identity), fault)
  }
})

test('stale measurements after UI preparation or body selection cannot pass authoritative evidence', () => {
  const prepared = syntheticUnsupportedDiagnosticEvidence()
  prepared.preparation.after.labelDocumentRevision++
  assert.throws(() => assertUnsupportedDiagnosticEvidence(prepared))
  const selected = syntheticUnsupportedDiagnosticEvidence()
  selected.clicks[1].measurement.stateSnapshot.selection = null
  assert.throws(() => assertUnsupportedDiagnosticEvidence(selected))
  const moved = syntheticUnsupportedDiagnosticEvidence()
  moved.clicks[1].measurement.nodeMatrix.e += 10
  assert.throws(() => assertUnsupportedDiagnosticEvidence(moved))
  const after = syntheticUnsupportedDiagnosticEvidence()
  after.clicks[0].afterMeasurement.identity.bodyRequest = 'stale-request'
  assert.throws(() => assertUnsupportedDiagnosticEvidence(after))
  const immediate = syntheticUnsupportedDiagnosticEvidence()
  immediate.clicks[1].inputMeasurement.nodeMatrix.e += 1
  assert.throws(() => assertUnsupportedDiagnosticEvidence(immediate))
})

test('native input requires correct owner epoch, exact canvas path, pointer/button order and measured target', () => {
  for (const fault of ['epoch', 'owner', 'misdelivery', 'path', 'pointer', 'buttons', 'order', 'untrusted']) {
    const evidence = syntheticUnsupportedDiagnosticEvidence(), action = evidence.clicks[1], event = action.events[1]
    if (fault === 'epoch') event.epoch++
    if (fault === 'owner') event.identity.ownerToken = '["point-node",1,"old"]'
    if (fault === 'misdelivery') event.target.canvasToken = 'unrelated-canvas'
    if (fault === 'path') event.path = [event.target]
    if (fault === 'pointer') event.pointerId = 2
    if (fault === 'buttons') event.buttons = 1
    if (fault === 'order') event.order = 0
    if (fault === 'untrusted') event.trusted = false
    assert.throws(() => assertDiagnosticAction(action, evidence.rendered.identity), fault)
  }
  const unownedCapture = syntheticUnsupportedDiagnosticEvidence({ ambientDimension: 3 })
  const action = unownedCapture.clicks[1], root = action.events[1].path.find((target) => target.canvasRoot)
  action.events[1].target = root; action.events[1].path = [root]
  assert.throws(() => assertDiagnosticAction(action), 'A root continuation without measured capture cannot stand in for the background target')
})

test('complete raw input rejects extra clicks, hidden failed listener work and selection/model changes', () => {
  for (const fault of ['extra', 'drop', 'listener', 'selection', 'history', 'source', 'captured-after-input']) {
    const evidence = syntheticUnsupportedDiagnosticEvidence(), action = evidence.clicks[1]
    if (fault === 'extra') action.events.push(action.events[2])
    if (fault === 'drop') action.droppedEvents = 1
    if (fault === 'listener') action.errors.push({ name: 'late event', message: 'failure' })
    if (fault === 'selection') action.after.selection = { kind: 'stratum', id: 'unrelated-point' }
    if (fault === 'history') action.after.history = '{}'
    if (fault === 'source') action.measurement.source = 'changed'
    if (fault === 'captured-after-input') action.canvasCaptureAfterInput = true
    assert.throws(() => assertUnsupportedDiagnosticEvidence(evidence), fault)
  }
})

test('negative candidate remains fixed after body outcome and terminal warning survives owned UI restoration', () => {
  const evidence = syntheticUnsupportedDiagnosticEvidence()
  assert.deepEqual(evidence.rendered.farClick.local, evidence.clicks[1].click.local)
  const restored = structuredClone(evidence)
  restored.restoration.after.selection = null
  assert.throws(() => assertUnsupportedDiagnosticEvidence(restored))
  const secondary = structuredClone(evidence)
  secondary.secondaryErrors.push({ name: 'restoration', message: 'failed' })
  assert.throws(() => assertUnsupportedDiagnosticEvidence(secondary), /secondary failures/)
  const ui = structuredClone(evidence)
  ui.restoration.uiAfter = structuredClone(ui.restoration.uiAfter)
  ui.restoration.uiAfter.inspector.open = true
  assert.throws(() => assertUnsupportedDiagnosticEvidence(ui), /Inspector state/)
})
