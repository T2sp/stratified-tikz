import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { allPointNodeScenarios, pointNodeScenarioArtifacts, validateBrowserEvidence } from '../../scripts/automation/phase-verification.mjs'
import { layoutAnchorGroup, layoutAnchorScenarios, layoutAnchorArtifacts, layoutShapes, layoutRegimes, layoutForShapeRegime,
  pointAnchorsForShape, layoutImportCases, assertLayoutAnchorEvidence, assertObservedPointPlacement, assertPointTikzSourceByMode, assertLayoutStandaloneEvidence } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { syntheticStandalonePointDownload } from './standalonePointDownloadFixture.mjs'
import { syntheticUnsupportedDiagnosticEvidence } from './pointUnsupportedDiagnosticFixture.mjs'
import { pointNodeAnchorSupport } from '../../src/geometry/pointNodeShapes/index.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { syntheticPointNativeDragEvidence, syntheticPointToolbarRevisionRecords } from './pointNativeDragFixture.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'
import { syntheticGeometricVisibilityEvidence, mutateSyntheticVisibilityStageModels,
  syntheticVisibilityLayerFaults } from './pointGeometricVisibilityFixture.mjs'
import { assertGeometricSelectionEvidence, assertGeometricShapeEvidence } from '../../scripts/pointGeometricShapesContract.mjs'
import { compareSvgPreviewSelectionCandidates, nextSvgPreviewSelectionCycle } from '../../src/rendering/svgHitTesting.ts'

function placement(shape = 'rectangle', anchor = 'base east', extra = {}) {
  return { result: 'passed', source: '$x_i$', shape, anchor, modelPositionUnchanged: true, rendered: {
    source: '$x_i$', shape, anchor, state: 'ready', pointRequest: 'current', bodyRequest: 'current',
    bodyOrigin: { x: -20, y: -12 }, placement: { x: 310, y: 290 }, anchorOffset: { x: 20, y: 4 },
    placedAnchor: { x: 310, y: 290 }, bounds: { x: -20, y: -10, width: 40, height: 20 }, contourLength: 120,
    bodyUpright: true, math: 1 }, ...extra }
}
function unsupportedNativeCases() {
  return [2, 3].flatMap((ambientDimension) => ['ellipse', 'circle', 'cylinder'].map((shape) =>
    syntheticUnsupportedDiagnosticEvidence({ ambientDimension, shape })))
}

function syntheticOwnerCycle(selectedId, expectedId, initial = false) {
  const raw = syntheticPointNativeDragEvidence({ id: selectedId })
  const target = { tag: 'path', pointId: selectedId, drawer: false, svg: true, canvas: true }
  const selection = { kind: 'stratum', id: selectedId }, stateBefore = structuredClone(raw.stateBefore)
  const runtime = JSON.parse(stateBefore.runtimeDiagramJson)
  runtime.strata.push({ ...structuredClone(runtime.strata[0]), id: 'app-point' })
  stateBefore.runtimeDiagramJson = JSON.stringify(runtime)
  stateBefore.json = JSON.stringify({ version: 2, diagram: runtime })
  stateBefore.history = JSON.stringify({ past: [], present: runtime, future: [] })
  const preparation = structuredClone(raw.preparation)
  for (const key of ['stateBefore', 'stateAfter', 'statePrepared']) preparation[key] = stateBefore
  const stateAfter = { ...stateBefore, selection: { kind: 'stratum', id: initial ? selectedId : expectedId } }
  const selectionRaw = syntheticGeometricSelectionEvidence({ id: selectedId, state: stateBefore, initialSelection: selection })
  const requestedClick = selectionRaw.requestedClick
  const toolbarRestoration = selectionRaw.toolbarRestoration
  for (const key of ['stateBefore', 'stateAfter']) toolbarRestoration[key] = stateAfter
  for (const key of ['before', 'after']) toolbarRestoration[key].selection = stateAfter.selection
  for (const action of selectionRaw.toolbarPreparation.actions.filter(({ purpose }) => purpose === 'restore')) {
    action.stateBefore = stateAfter; action.stateAfter = stateAfter
    action.before.selection = stateAfter.selection; action.after.selection = stateAfter.selection
  }
  return { selectedId, expectedId, preparation, stateBefore, stateAfter,
    toolbarPreparation: selectionRaw.toolbarPreparation, toolbarRestoration,
    secondaryErrors: [], droppedEvents: 0, requestedClick, rendered: selectionRaw.rendered,
    before: { ...selectionRaw.before, elementFromPoint: target, elementsFromPoint: [target, { canvasRoot: true }] },
    events: ['pointerdown', 'pointerup', 'click'].map((type) => ({ phase: 'owner-cycle', selectedId, type, trusted: true,
      altKey: true, pointerId: 1, button: 0, buttons: type === 'pointerdown' ? 1 : 0, client: requestedClick, target, selection,
      labelDocumentRevision: stateBefore.labelDocumentRevision,
      path: [target, { canvasRoot: true }] })) }
}
test('synthetic equal-distance point owner cycling records initial overlap then app-point continuation', () => {
  for (const overlap of ['overlap-point', 'overflow-overlap']) {
    const candidates = [overlap, 'app-point'].map((id) => ({ kind: 'point', id, stableId: `point:${id}`, distance: 0,
      selection: { kind: 'stratum', id }, description: id })).sort(compareSvgPreviewSelectionCandidates)
    const first = nextSvgPreviewSelectionCycle(null, { x: 3, y: 3 }, candidates)
    assert.equal(first.candidate.id, overlap)
    assert.equal(nextSvgPreviewSelectionCycle(first.state, { x: 3, y: 3 }, candidates).candidate.id, 'app-point')
  }
})
function evidence(name) {
  const common = { scenario: name, group: layoutAnchorGroup, result: 'passed', pageErrors: [] }
  if (name === 'point-layout-per-shape-spacing-minima') return { ...common,
    cases: layoutShapes.flatMap((shape) => layoutRegimes.map((regime) => placement(shape, 'center', { regime: regime.key, layout: layoutForShapeRegime(shape, regime) }))),
    outerSepPaintInvariant: layoutShapes.map((shape) => ({ shape, sameContour: shape !== 'diamond', samePaintedBounds: shape !== 'diamond', differentAnchorBounds: true,
      ...(shape === 'diamond' ? { paintShrink: { width: 2 * .414213 * 8 * 1.2, height: 2 * .414213 * 13 * 1.2 } } : {}) })) }
  if (name === 'point-layout-anchor-support-rotation') return { ...common,
    cases: layoutShapes.flatMap((shape) => pointAnchorsForShape(shape).map((anchor) => placement(shape, anchor))),
    unsupportedAnchor: { savedAnchor: 'not a PGF anchor', diagnostic: 'Not supported; preserved for TikZ', nativeCases: unsupportedNativeCases() } }
  if (name === 'point-layout-async-combined-isolation') return { ...common,
    transitions: ['pending-wide', 'ready-wide', 'fallback', 'ready-tall', 'stale-load', 'undo', 'redo', 'stale-undo', 'font-before', 'font-loaded', 'font-restored'].map((key) => {
      const entry = placement('circular sector', 'arc start', { key, siblingsUnchanged: true, literalObservation: { lines: [{ width: key === 'font-loaded' ? 200 : 100 }] } })
      entry.rendered.state = key === 'pending-wide' ? 'pending' : key === 'fallback' || key.startsWith('font-') ? 'fallback' : 'ready'
      return entry
    }),
    actualMathJax: true, historyUnchangedOnSettle: true, nativeFontChanged: true, nativeFontRestored: true,
    ownedFace: { ownedFacePresent: true }, fontLifecycle: { restored: { restored: { ownedFacePresent: false, previousFaces: [{ present: true }] } } } }
  if (name === 'point-layout-native-controls-persistence') return { ...common,
    nativeInputs: true, historyRestored: true, clipboardRestored: true, presetRestored: true, saveReloadRestored: true, rawSourcePreserved: true, standaloneTikz: true, inlineTikz: true,
    fields: ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight', 'anchor'].map((key) => ({ key,
      events: [{ type: 'input', trusted: true, value: key === 'anchor' ? 'base east' : '2' }], value: key === 'anchor' ? 'base east' : '2', expected: key === 'anchor' ? 'base east' : '2',
      modelValue: key === 'anchor' ? 'base east' : 2, expectedModel: key === 'anchor' ? 'base east' : 2, requestsUnchanged: true })) }
  if (name === 'point-layout-native-interaction-2d-3d') return { ...common,
    cases: [2, 3].flatMap((ambientDimension) => ['rectangle', 'circular sector'].map((shape) => {
      const nativeDrag = syntheticPointNativeDragEvidence({ scenario: name, ambientDimension, shape,
        id: 'overlap-point', displacement: { x: 22, y: -14 }, steps: 4 })
      const nativeSelection = syntheticGeometricSelectionEvidence({ scenario: name, ambientDimension, shape,
        id: 'overlap-point', state: nativeDrag.stateBefore })
      return { ambientDimension, shape, codim: ambientDimension, nativeDrag,
      ownerCycleStart: syntheticOwnerCycle('overlap-point', 'overlap-point', true), ownerCycle: syntheticOwnerCycle('overlap-point', 'app-point'),
      before: JSON.parse(nativeDrag.stateBefore.runtimeDiagramJson).strata[0],
      after: JSON.parse(nativeDrag.afterAction.state.runtimeDiagramJson).strata[0],
      trustedBoundaryClick: true, trustedDrag: true, anchorStayedAtModel: true, undoRestored: true, redoRestored: true, altCycling: true, lockedUnchanged: true, hiddenAbsent: true, cameraPlacement: true, referenceUnchanged: true,
      observed: { boundary: nativeSelection.requestedClick, nativeSelection },
      events: nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag'), referenceCode: String.raw`\node at (LayoutReference) {$x_i$};` } })),
    bodyOverflowCases: [2, 3].map((ambientDimension) => {
      const ownerCycle = syntheticOwnerCycle('overflow-overlap', 'app-point')
      const entry = placement('rectangle', 'base east', { ambientDimension, layout: { innerXSep: -15 }, diagramUnchanged: true, ownerCycle,
        ownerCycleStart: syntheticOwnerCycle('overflow-overlap', 'overflow-overlap', true),
        altSelection: { id: 'app-point', events: ownerCycle.events } })
      const nativeSelection = syntheticGeometricSelectionEvidence({ scenario: name, ambientDimension, shape: 'rectangle', id: 'overflow-overlap', body: true })
      Object.assign(entry.rendered, { boundary: nativeSelection.requestedClick, nativeSelection,
        bodyOverflow: { localBodyClick: { x: 2, y: 3 }, characterBounds: { x: 0, y: 0, width: 5, height: 6 }, clickInContour: { x: -30, y: 0 }, contourBounds: { x: -20, y: -10, width: 40, height: 20 }, distance: 10, selectionRing: { radius: 50, inkRadius: 45 } } })
      return entry
    }) }
  if (name === 'point-layout-import-order-units') return { ...common,
    cases: layoutImportCases.map(({ key, expected }) => ({ result: 'passed', key, actual: expected, expected, sourcePreserved: true })),
    nativeImport: true, saveReloadRestored: true, standaloneTikz: true, inlineTikz: true, unsupportedTextMetricsDiagnosed: true }
  return { ...common, background: name.includes('transparent') ? 'transparent' : 'white', actualDownload: true, capturedPending: true, reopened: true,
    capture: { status: 'saved' },
    immutableSource: true, immutableLayout: true, immutablePlacement: true, settledContour: true, combinedLabels: true, noExternalAssets: true,
    expected: layoutShapes.map((shape) => placement(shape, shape === 'cylinder' ? 'shape center' : 'base')),
    click: { snapshot: { points: layoutShapes.map((shape) => ({ shape })) } } }
}

test('32D named group and every artifact are registered cumulatively', () => {
  assert.deepEqual(allPointNodeScenarios[layoutAnchorGroup], layoutAnchorScenarios)
  assert.equal(Object.keys(allPointNodeScenarios).length, 6)
  assert.equal(layoutShapes.length, 15)
  for (const name of layoutAnchorScenarios) {
    assert.deepEqual(pointNodeScenarioArtifacts(name), layoutAnchorArtifacts(name))
    assertLayoutAnchorEvidence(evidence(name), name)
  }
})
for (const options of [{}, { collapsed: true }, { obstructed: true }, { collapsed: true, obstructed: true }]) {
  test(`synthetic 32D toolbar policy accepts owned preparation/restoration ${JSON.stringify(options)}`, () => {
    const raw = syntheticGeometricSelectionEvidence(options)
    assertGeometricSelectionEvidence(raw, raw.id)
    assert.equal(raw.rendered.shape, 'semicircle')
    assert.equal(raw.before.model.codim, 2)
    assert.equal(raw.before.geometry.contour.fraction, .23)
    assert.equal(raw.toolbarPreparation.actions.filter(({ purpose }) => purpose === 'obstruction').length, Number(!!options.obstructed))
    assert.equal(raw.toolbarRestoration.after.toolbar.collapsed, !!options.collapsed)
  })
}
test('synthetic 32D geometric visibility parent policy accepts real raw same-value no-op plus both observed transitions', () => {
  const evidence = syntheticGeometricVisibilityEvidence(), actions = evidence.visibility.actions
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  assert.equal(actions[0].afterAction.transition.effective, false)
  assert.equal(actions[0].before.state.uiSettings, actions[0].afterAction.state.uiSettings)
  assert.equal(actions[1].afterAction.transition.effective, true)
  assert.equal(actions[2].afterAction.transition.effective, true)
  assert.deepEqual(actions.map(({ afterAction }) => afterAction.transition), [
    { priorValue: 'dimHidden', finalValue: 'dimHidden', effective: false },
    { priorValue: 'dimHidden', finalValue: 'hideHidden', effective: true },
    { priorValue: 'hideHidden', finalValue: 'dimHidden', effective: true },
  ])
})
test('synthetic 32D camera preparation accepts native same-value input without inventing a model edit', () => {
  const evidence = syntheticGeometricVisibilityEvidence({ cameraAngles: { thetaDeg: 90, phiDeg: 0 } })
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  for (const action of evidence.visibility.cameraPreparation.actions) assert.deepEqual(action.after.state, action.before.state)
})
test('synthetic 32D visibility policy accepts omitted canonical visibility and retains explicit hidden metadata', () => {
  const evidence = syntheticGeometricVisibilityEvidence()
  for (const state of [evidence.visibility.locked.before, evidence.visibility.locked.stateAfter,
    evidence.visibility.cameraPreparation.before, evidence.visibility.actions.at(-1).afterAction.state]) {
    const models = [JSON.parse(state.json).diagram, JSON.parse(state.runtimeDiagramJson), JSON.parse(state.history).present]
    assert.ok(models.every((model) => !Object.hasOwn(model.layers[0], 'visible')), 'Visible defaults are omitted in all canonical model observations')
  }
  assert.equal(JSON.parse(evidence.visibility.locked.before.runtimeDiagramJson).layers[0].locked, true)
  assert.equal(JSON.parse(evidence.visibility.hidden.state.runtimeDiagramJson).layers[0].visible, false)
  const before = structuredClone(evidence)
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  assert.deepEqual(evidence, before, 'The contract preserves the observed raw canonical representation')
})
test('synthetic 32D visibility policy permits valid explicit true without treating it as canonical production output', () => {
  const evidence = syntheticGeometricVisibilityEvidence()
  mutateSyntheticVisibilityStageModels(evidence, 'locked', (model) => { model.layers[0].visible = true })
  const before = structuredClone(evidence)
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  assert.deepEqual(evidence, before, 'The contract does not rewrite explicit raw visibility')
})
test('synthetic 32D visibility parent policy rejects an observed candidate despite success flags', () => {
  const evidence = syntheticGeometricVisibilityEvidence()
  evidence.result = 'observed'
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
for (const [fault, mutate] of syntheticVisibilityLayerFaults) {
  test(`synthetic 32D raw layer visibility policy rejects ${fault}`, () => {
    const evidence = syntheticGeometricVisibilityEvidence()
    mutate(evidence)
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const index of [0, 1, 2]) for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision']) {
  test(`synthetic 32D parent raw visibility action ${index} rejects changed ${field}`, () => {
    const evidence = syntheticGeometricVisibilityEvidence(), state = evidence.visibility.actions[index].afterAction.state
    if (field === 'selection') state.selection = { kind: 'stratum', id: 'occluder' }
    else if (field === 'labelDocumentRevision') state[field] += 1
    else state[field] += 'changed'
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const index of [0, 1]) for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision']) {
  test(`synthetic 32D parent native visibility camera action ${index} rejects changed ${field}`, () => {
    const evidence = syntheticGeometricVisibilityEvidence(), state = evidence.visibility.cameraPreparation.actions[index].after.state
    if (field === 'selection') state.selection = { kind: 'stratum', id: 'app-point' }
    else if (field === 'labelDocumentRevision') state[field] += 1
    else state[field] += 'changed'
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const fault of ['camera-ui-stale', 'camera-zoom-edit', 'camera-no-controls', 'checkbox-stale-camera', 'policy-camera-change',
  'policy-work-plane-change', 'policy-disabled-visibility', 'policy-foreign-ui-setting', 'policy-fake-noop', 'policy-fake-transition',
  'policy-preparation-work-plane-change', 'policy-source-edit', 'policy-style-edit', 'policy-coordinate-edit', 'policy-event-epoch',
  'policy-foreign-scenario', 'policy-action-error', 'dimmed-owner-flags-only', 'dimmed-opacity-flags-only', 'dimmed-ancestor-only-opacity']) {
  test(`synthetic 32D parent geometric visibility evidence rejects ${fault}`, () => {
    const evidence = syntheticGeometricVisibilityEvidence(), { cameraPreparation, enable, actions } = evidence.visibility
    const settings = JSON.parse(actions[0].afterAction.state.uiSettings)
    if (fault === 'camera-ui-stale') {
      const stale = JSON.parse(cameraPreparation.actions[0].after.state.uiSettings); stale.camera3d.thetaDeg = 13
      cameraPreparation.actions[0].after.state.uiSettings = JSON.stringify(stale)
    }
    if (fault === 'camera-zoom-edit') {
      const changed = JSON.parse(cameraPreparation.actions[0].after.state.uiSettings); changed.camera3d.zoom = 50
      cameraPreparation.actions[0].after.state.uiSettings = JSON.stringify(changed)
    }
    if (fault === 'camera-no-controls') cameraPreparation.actions = []
    if (fault === 'checkbox-stale-camera') enable.before.uiSettings = cameraPreparation.before.uiSettings
    if (fault === 'policy-camera-change') settings.camera3d.thetaDeg = 25
    if (fault === 'policy-work-plane-change') settings.workPlane = { kind: 'yz', value: 2 }
    if (fault === 'policy-disabled-visibility') settings.visibility.enabled = false
    if (fault === 'policy-foreign-ui-setting') settings.includeCoordinateAxesInTikz = true
    if (['policy-camera-change', 'policy-work-plane-change', 'policy-disabled-visibility', 'policy-foreign-ui-setting'].includes(fault)) {
      actions[0].afterAction.state.uiSettings = JSON.stringify(settings)
    }
    if (fault === 'policy-fake-noop') actions[1].afterAction.transition.effective = false
    if (fault === 'policy-fake-transition') actions[0].afterAction.transition.effective = true
    if (fault === 'policy-preparation-work-plane-change') actions[0].prepared.control.workPlaneStatus = ['yz-plane at x=4']
    if (['policy-source-edit', 'policy-style-edit', 'policy-coordinate-edit'].includes(fault)) {
      const state = actions[0].afterAction.state, runtime = JSON.parse(state.runtimeDiagramJson)
      if (fault === 'policy-source-edit') runtime.strata[0].text = '$edited$'
      if (fault === 'policy-style-edit') runtime.strata[0].style.paint.fill.color = '#123456'
      if (fault === 'policy-coordinate-edit') runtime.strata[0].position.y = -2
      const saved = JSON.parse(state.json); saved.diagram = runtime
      const history = JSON.parse(state.history); history.present = runtime
      state.runtimeDiagramJson = JSON.stringify(runtime); state.json = JSON.stringify(saved); state.history = JSON.stringify(history)
      actions[0].afterAction.rendered.source = runtime.strata[0].text
    }
    if (fault === 'policy-event-epoch') actions[1].afterAction.events.events[0].labelDocumentRevision += 1
    if (fault === 'policy-foreign-scenario') actions[0].scenario = 'point-geometric-ellipse'
    if (fault === 'policy-action-error') actions[0].actionError = { message: 'controlled failed native select' }
    if (fault === 'dimmed-owner-flags-only') delete actions[2].afterAction.rendered.id
    if (fault === 'dimmed-opacity-flags-only') delete actions[2].afterAction.rendered.effectiveOpacity
    if (fault === 'dimmed-ancestor-only-opacity') {
      const rendered = actions[2].afterAction.rendered
      rendered.effectiveFillOpacity = 1; rendered.opacityAncestors[0].opacity = '.25'
      assert.equal(rendered.effectiveOpacity, .25, 'Effective opacity flag alone retains the fabricated plausible dimming')
    }
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const nativeProjection of ['double', 'binary32']) for (const body of [false, true]) {
  test(`synthetic 32D raw CTM policy accepts exact ${nativeProjection} native contour projection with ${body ? 'body' : 'boundary'} input`, () => {
    const raw = syntheticGeometricSelectionEvidence({ nativeProjection, body, obstructed: true })
    const contour = raw.before.geometry.contour, matrix = contour.screenCTM, local = contour.localBoundary
    const algebra = { x: matrix.a * local.x + matrix.c * local.y + matrix.e,
      y: matrix.b * local.x + matrix.d * local.y + matrix.f }
    if (nativeProjection === 'binary32') {
      assert.ok(Math.abs(algebra.x - contour.boundary.x) > 1e-7, 'Control reaches native binary32 handling beyond double rounding')
      assert.equal(contour.boundary.x, Math.fround(algebra.x)); assert.equal(contour.boundary.y, Math.fround(algebra.y))
    }
    if (body) assert.deepEqual(raw.requestedClick, algebra, 'Body input retains its original double transform')
    else assert.deepEqual(raw.requestedClick, contour.boundary, 'Boundary input retains exact native screen coordinates')
    assertGeometricSelectionEvidence(raw, raw.id, body ? 'body' : 'boundary')
  })
  for (const fault of ['stale-CTM', 'stale-native-boundary', 'different-requested-native-boundary', 'rounded-body-input']) {
    if (fault === 'rounded-body-input' && (!body || nativeProjection !== 'binary32')) continue
    test(`synthetic 32D raw ${nativeProjection} projection rejects ${fault} with ${body ? 'body' : 'boundary'} input`, () => {
      const raw = syntheticGeometricSelectionEvidence({ nativeProjection, body, obstructed: true })
      if (fault === 'stale-CTM') raw.before.geometry.contour.screenCTM.e += 20
      if (fault === 'stale-native-boundary') raw.before.geometry.contour.boundary = { ...raw.before.geometry.contour.boundary, x: raw.before.geometry.contour.boundary.x + .000001 }
      if (fault === 'different-requested-native-boundary') raw.requestedClick = { ...raw.requestedClick, x: raw.requestedClick.x + .000001 }
      if (fault === 'rounded-body-input') {
        raw.requestedClick = { x: Math.fround(raw.requestedClick.x), y: Math.fround(raw.requestedClick.y) }
        // Keep the raw coordinate records coherent to reach the double body rule.
        raw.before.requestedClick = raw.requestedClick; raw.rendered.boundary = raw.requestedClick
      }
      assert.throws(() => assertGeometricSelectionEvidence(raw, raw.id, body ? 'body' : 'boundary'))
    })
  }
}
const rawToolbarFaults = [
  ['missing-preparation', (raw) => { delete raw.toolbarPreparation }],
  ['missing-restoration', (raw) => { delete raw.toolbarRestoration }],
  ['toolbar-flags-only', (raw) => { raw.toolbarPreparation = { collapsed: true, restored: true } }],
  ['missing-Select', (raw) => { raw.toolbarPreparation.actions.splice(0, 1) }],
  ['ambiguous-Select', (raw) => { raw.toolbarPreparation.actions[0].controlCount = 2 }],
  ['collapsed-Select', (raw) => { raw.toolbarPreparation.actions[0].before.toolbar.collapsed = true }],
  ['Select-not-active', (raw) => { raw.toolbarPreparation.actions[0].after.tool.selectPressed = 'false' }],
  ['unowned-collapse', (raw) => { raw.toolbarPreparation.obstructed.observation.elementFromPoint.creationToolbar = false }],
  ['missing-obstructed-hit', (raw) => { delete raw.toolbarPreparation.obstructed }],
  ['missing-collapse-control', (raw) => { raw.toolbarPreparation.actions[1].controlCount = 0 }],
  ['collapse-before-Select', (raw) => { raw.toolbarPreparation.actions.reverse() }],
  ['failed-collapse', (raw) => { raw.toolbarPreparation.actions[1].error = { message: 'controlled native collapse failure' } }],
  ['Creation-not-detached', (raw) => { raw.toolbarPreparation.actions[1].after.toolbar.floatingCount = 1 }],
  ['quick-style-not-detached', (raw) => { raw.toolbarPreparation.actions[1].after.toolbar.quickStyleCount = 1 }],
  ['missing-native-expand', (raw) => { raw.toolbarPreparation.actions[1].after.toolbar.expandCount = 0 }],
  ['History-unmounted', (raw) => { raw.toolbarPreparation.prepared.toolbar.historyCount = 0 }],
  ['failed-restoration', (raw) => { raw.toolbarPreparation.actions.at(-1).error = { message: 'controlled native expand failure' } }],
  ['restored-caller-state-wrong', (raw) => { raw.toolbarRestoration.after.toolbar.collapsed = true }],
  ['restoration-before-selection', (raw) => { raw.toolbarRestoration.stateBefore.selection = null }],
  ['stale-boundary', (raw) => { raw.requestedClick = { x: raw.requestedClick.x + 1, y: raw.requestedClick.y } }],
  ['stale-prepared-CTM', (raw) => { raw.toolbarPreparation.prepared.geometry.contour.screenCTM.e += 20 }],
  ['stale-before-CTM', (raw) => { raw.before.geometry.contour.screenCTM.e += 20 }],
  ['singular-CTM', (raw) => { raw.before.geometry.contour.screenCTM.a = 0 }],
  ['different-arclength', (raw) => { raw.before.geometry.contour.fraction = .5 }],
  ['disconnected-contour', (raw) => { raw.before.geometry.contour.connected = false }],
  ['remaining-Creation-obstruction', (raw) => { raw.before.elementFromPoint = raw.toolbarPreparation.obstructed.observation.elementFromPoint }],
  ['remaining-History-obstruction', (raw) => { raw.before.elementFromPoint = { history: true, svg: false, canvas: false, drawer: false } }],
  ['remaining-other-obstruction', (raw) => { raw.before.elementFromPoint = { class: 'other-overlay', svg: false, canvas: false, drawer: false } }],
  ['wrong-preclick-owner', (raw) => { raw.before.elementFromPoint.pointId = 'other-point' }],
  ['toolbar-only-trusted-events', (raw) => { raw.events.forEach((event) => { event.target = raw.toolbarPreparation.obstructed.observation.elementFromPoint }) }],
  ['preexisting-selection-toolbar-input', (raw) => { raw.selected = raw.stateBefore.selection = { kind: 'stratum', id: raw.id }; raw.events.forEach((event) => { event.target = { svg: false, creationToolbar: true } }) }],
  ['preparation-event-contamination', (raw) => { raw.before.events = raw.events }],
  ['restoration-event-contamination', (raw) => { raw.after.events.push({ type: 'click', trusted: true, target: { creationToolbar: true } }) }],
  ['missing-event-path', (raw) => { raw.events[0].path = [] }],
  ['wrong-event-order', (raw) => { raw.events.reverse() }],
  ['missing-event', (raw) => { raw.events.pop() }],
  ['dropped-event', (raw) => { raw.after.droppedEvents = 1 }],
  ['wrong-event-owner', (raw) => { raw.events[0].layout.owner = 'obsolete-point' }],
  ['wrong-event-epoch', (raw) => { raw.events[0].App.labelDocumentRevision += 1 }],
  ['untrusted-native-click', (raw) => { raw.events.at(-1).trusted = false }],
  ['missing-raw-after-events', (raw) => { raw.after.events = [] }],
  ['observer-error', (raw) => { raw.after.errors.push({ message: 'controlled observer failure' }) }],
  ['secondary-cleanup-failure', (raw) => { raw.secondaryErrors.push({ message: 'controlled cleanup failure' }) }],
]
for (const [fault, mutate] of rawToolbarFaults) {
  test(`synthetic 32D raw toolbar selection policy rejects ${fault}`, () => {
    const raw = syntheticGeometricSelectionEvidence({ obstructed: true })
    mutate(raw)
    assert.throws(() => assertGeometricSelectionEvidence(raw, raw.id))
  })
}
for (const actionName of ['Select', 'collapse', 'expand']) for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'selection', 'uiSettings']) {
  test(`synthetic 32D raw native ${actionName} policy rejects changed ${field}`, () => {
    const raw = syntheticGeometricSelectionEvidence({ obstructed: true })
    const action = raw.toolbarPreparation.actions.find(({ name }) => name === actionName)
    if (field === 'selection') action.stateAfter.selection = { kind: 'stratum', id: 'other-point' }
    else if (field === 'labelDocumentRevision') action.stateAfter[field] += 1
    else action.stateAfter[field] += 'changed'
    assert.throws(() => assertGeometricSelectionEvidence(raw, raw.id))
  })
}
for (const actionName of ['Select', 'collapse', 'expand']) for (const field of ['camera', 'workPlaneControls', 'workPlaneStatus']) {
  test(`synthetic 32D raw native ${actionName} policy rejects changed ${field}`, () => {
    const raw = syntheticGeometricSelectionEvidence({ obstructed: true, ambientDimension: 3 })
    const action = raw.toolbarPreparation.actions.find(({ name }) => name === actionName)
    action.after[field] = field === 'workPlaneStatus' ? 'yz at x=20' : field === 'camera' ? { mode: '3d', scale: 10 } : [{ value: 'yz' }, { value: '20' }]
    assert.throws(() => assertGeometricSelectionEvidence(raw, raw.id))
  })
}
test('32D native anchor matrix matches independently recorded PGF categories', () => {
  for (const shape of layoutShapes) {
    const spec = pointNodeAnchorSupport[shape], anchors = pointAnchorsForShape(shape)
    for (const anchor of spec.standard) assert.ok(anchors.includes(anchor), `${shape}/${anchor}`)
    for (const category of spec.specific) {
      const regexp = new RegExp('^' + category.replace('N', '\\d+') + '$')
      assert.ok(anchors.some((anchor) => regexp.test(anchor)), `${shape}/${category}`)
    }
    for (const anchor of anchors) {
      assert.ok(spec.standard.includes(anchor) || /^\d+$/u.test(anchor)
        || spec.specific.some((category) => new RegExp('^' + category.replace('N', '\\d+') + '$').test(anchor)), `${shape}: no fabricated ${anchor}`)
    }
  }
})
for (const fault of ['missing-regime', 'duplicate-regime', 'wrong-layout', 'wrong-source', 'old-contour-revision', 'nonfinite', 'moved-anchor', 'moved-model', 'painted-outer-sep', 'missing-anchor-clearance', 'page-error', 'started']) {
  test(`32D sizing evidence rejects ${fault}`, () => {
    const name = 'point-layout-per-shape-spacing-minima', current = evidence(name), first = current.cases[0]
    if (fault === 'missing-regime') current.cases.pop()
    if (fault === 'duplicate-regime') current.cases[1] = structuredClone(first)
    if (fault === 'wrong-layout') first.layout = { ...first.layout, innerXSep: 99 }
    if (fault === 'wrong-source') first.rendered.source = '$stale$'
    if (fault === 'old-contour-revision') first.rendered.pointRequest = 'stale'
    if (fault === 'nonfinite') first.rendered.bounds.width = Infinity
    if (fault === 'moved-anchor') first.rendered.placedAnchor.x += 1
    if (fault === 'moved-model') first.modelPositionUnchanged = false
    if (fault === 'painted-outer-sep') current.outerSepPaintInvariant[0].sameContour = false
    if (fault === 'missing-anchor-clearance') current.outerSepPaintInvariant[0].differentAnchorBounds = false
    if (fault === 'page-error') current.pageErrors.push('unhandled action rejection')
    if (fault === 'started') current.result = 'started'
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['missing-category', 'duplicate-index', 'rotated-body', 'unsupported-silence']) {
  test(`32D anchor evidence rejects ${fault}`, () => {
    const name = 'point-layout-anchor-support-rotation', current = evidence(name)
    if (fault === 'missing-category') current.cases.splice(current.cases.findIndex(({ shape, anchor }) => shape === 'star' && anchor === 'inner point 7'), 1)
    if (fault === 'duplicate-index') current.cases[1] = structuredClone(current.cases[0])
    if (fault === 'rotated-body') current.cases[0].rendered.bodyUpright = false
    if (fault === 'unsupported-silence') current.unsupportedAnchor.diagnostic = ''
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['missing-native-diagnostic', 'hidden-contour', 'hidden-paint-bounds', 'hidden-shape-hit', 'wrong-warning-hit', 'synthetic-diagnostic-click', 'far-click-overlay', 'far-click-near-body', 'inflated-diagnostic-ring']) {
  test(`32D unsupported anchor evidence rejects ${fault}`, () => {
    const name = 'point-layout-anchor-support-rotation', current = evidence(name), first = current.unsupportedAnchor.nativeCases[0]
    if (fault === 'missing-native-diagnostic') current.unsupportedAnchor.nativeCases.pop()
    if (fault === 'hidden-contour') first.rendered.contourCount = 1
    if (fault === 'hidden-paint-bounds') first.rendered.paintedBounds.maxX = 600
    if (fault === 'hidden-shape-hit') first.clicks[1].selectedId = 'app-point'
    if (fault === 'wrong-warning-hit') first.clicks[2].selectedId = null
    if (fault === 'synthetic-diagnostic-click') first.clicks[0].events[0].trusted = false
    if (fault === 'far-click-overlay') first.rendered.nativeCanvasAtFarClick = false
    if (fault === 'far-click-near-body') first.rendered.farClick.local.x = 62
    if (fault === 'inflated-diagnostic-ring') first.ring.radius = 606
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
test('32D parent policy requires measured candidate frames and native event ownership beyond success flags', () => {
  const name = 'point-layout-anchor-support-rotation'
  for (const fault of ['missing-candidates', 'unrelated-target', 'wrong-event-epoch', 'missing-fresh-after-input']) {
    const current = evidence(name), first = current.unsupportedAnchor.nativeCases[0]
    if (fault === 'missing-candidates') delete first.rendered.candidates
    if (fault === 'unrelated-target') first.clicks[1].events[0].target.canvasToken = 'other-native-canvas'
    if (fault === 'wrong-event-epoch') first.clicks[1].events[0].epoch++
    if (fault === 'missing-fresh-after-input') delete first.clicks[0].afterMeasurement
    assert.throws(() => assertLayoutAnchorEvidence(current, name), fault)
  }
})
test('32D parent policy rejects stale candidate projections and native frames after body selection', () => {
  const name = 'point-layout-anchor-support-rotation'
  for (const fault of ['root-projection', 'off-canvas-screen', 'stale-current-ctm', 'malformed-body-bounds']) {
    const current = evidence(name), first = current.unsupportedAnchor.nativeCases[0]
    if (fault === 'root-projection') first.rendered.candidates[1].root.x += 10
    if (fault === 'off-canvas-screen') first.clicks[1].click.screen.x = 1000
    if (fault === 'stale-current-ctm') first.clicks[1].measurement.nodeMatrix.e += 4
    if (fault === 'malformed-body-bounds') first.clicks[1].measurement.bodyBounds.maxX = Infinity
    assert.throws(() => assertLayoutAnchorEvidence(current, name), fault)
  }
})
for (const fault of ['untrusted-input', 'missing-input', 'wrong-model', 'wrong-tikz', 'missing-clipboard', 'duplicate-field', 'synthetic-final-value']) {
  test(`32D native control evidence rejects ${fault}`, () => {
    const name = 'point-layout-native-controls-persistence', current = evidence(name)
    if (fault === 'untrusted-input') current.fields[0].events[0].trusted = false
    if (fault === 'missing-input') current.fields[0].events = []
    if (fault === 'wrong-model') current.fields[0].modelValue = 0
    if (fault === 'wrong-tikz') current.inlineTikz = false
    if (fault === 'missing-clipboard') current.clipboardRestored = false
    if (fault === 'duplicate-field') current.fields[1] = structuredClone(current.fields[0])
    if (fault === 'synthetic-final-value') current.fields[0].events[0].value = '1'
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['stale-settlement', 'wrong-load-owner', 'changed-free-label', 'no-real-math', 'font-width-unchanged', 'font-not-restored', 'wrong-terminal-state']) {
  test(`32D combined lifecycle evidence rejects ${fault}`, () => {
    const name = 'point-layout-async-combined-isolation', current = evidence(name)
    if (fault === 'stale-settlement') current.transitions[1].rendered.pointRequest = 'old'
    if (fault === 'wrong-load-owner') current.transitions[4].rendered.source = '$stale$'
    if (fault === 'changed-free-label') current.transitions[4].siblingsUnchanged = false
    if (fault === 'no-real-math') current.actualMathJax = false
    if (fault === 'font-width-unchanged') current.transitions.find(({ key }) => key === 'font-loaded').literalObservation.lines[0].width = 100
    if (fault === 'font-not-restored') current.fontLifecycle.restored.restored.ownedFacePresent = true
    if (fault === 'wrong-terminal-state') current.transitions[0].rendered.state = 'ready'
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['untrusted-boundary', 'untrusted-drag', 'wrong-boundary', 'reference-detached']) {
  test(`32D interaction evidence rejects ${fault}`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name), first = current.cases[0]
    if (fault === 'untrusted-boundary') first.observed.nativeSelection.events[0].trusted = false
    if (fault === 'untrusted-drag') first.events[0].trusted = false
    if (fault === 'wrong-boundary') first.observed.nativeSelection.requestedClick.x += 1
    if (fault === 'reference-detached') first.referenceCode = String.raw`\node at (3,3) {$x_i$};`
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['flags-only', 'earlier-selection', 'overlay-input', 'wrong-drag-owner', 'unchanged-position', 'bad-drag-history', 'bad-drag-undo']) {
  test(`synthetic 32D raw drag policy rejects ${fault} despite trustedDrag flag`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name), first = current.cases[0], raw = first.nativeDrag
    if (fault === 'flags-only') delete first.nativeDrag
    if (fault === 'earlier-selection') raw.afterAction.observation.events.forEach((event) => { event.phase = 'selection' })
    if (fault === 'overlay-input') raw.afterAction.observation.events.find(({ type }) => type === 'pointerdown').target = { drawer: true, svg: false }
    if (fault === 'wrong-drag-owner') raw.id = 'app-point'
    if (fault === 'unchanged-position') raw.afterAction.state.runtimeDiagramJson = raw.stateBefore.runtimeDiagramJson
    if (fault === 'bad-drag-history') raw.afterAction.state.history = raw.stateBefore.history
    if (fault === 'bad-drag-undo') raw.undo.stateAfter.runtimeDiagramJson = raw.afterAction.state.runtimeDiagramJson
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
function setSyntheticRevision(records, revision) {
  for (const record of records) {
    if (revision === undefined) delete record.labelDocumentRevision
    else record.labelDocumentRevision = revision
    if (record.layout?.owner && record.model?.id) record.layout.owner = JSON.stringify(['point-node', revision, record.model.id])
  }
}
function syntheticRevisionRecords(raw) {
  return [raw.preparation.stateBefore, raw.preparation.stateAfter, raw.preparation.statePrepared,
    raw.preparation.inherited, raw.preparation.closed, raw.preparation.prepared, raw.stateBefore, raw.before,
    raw.afterAction.state, raw.afterAction.observation, raw.undo.stateBefore, raw.undo.stateAfter, raw.undo.observation,
    raw.redo.stateBefore, raw.redo.stateAfter, raw.redo.observation,
    ...raw.afterAction.observation.events, ...raw.undo.observation.events, ...raw.redo.observation.events,
    ...syntheticPointToolbarRevisionRecords(raw)]
}
function setSyntheticActionRevision(raw, action, revision) {
  const records = action === 'drag' ? [raw.afterAction.state, raw.afterAction.observation, raw.undo.stateBefore]
    : action === 'undo' ? [raw.undo.stateAfter, raw.undo.observation, raw.redo.stateBefore]
      : [raw.redo.stateAfter, raw.redo.observation]
  // Keep each observed state and its successor's before-state consistent, so
  // these controls reach document ownership rather than record continuity.
  setSyntheticRevision(records, revision)
}
for (const revision of [0, 100]) {
  test(`synthetic 32D raw drag policy accepts unchanged document epoch ${revision} with movement and history`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name)
    for (const { nativeDrag } of current.cases) {
      setSyntheticRevision(syntheticRevisionRecords(nativeDrag), revision)
      assert.ok(syntheticRevisionRecords(nativeDrag).every((record) => record.labelDocumentRevision === revision))
    }
    assertLayoutAnchorEvidence(current, name)
  })
}
for (const action of ['drag', 'undo', 'redo']) {
  for (const [fault, revision] of [['increased', 101], ['decreased', 99], ['missing', undefined], ['null', null],
    ['negative', -1], ['fractional', 100.5], ['string', '100'], ['nonfinite', Infinity]]) {
    test(`synthetic 32D raw ${action} policy rejects ${fault} document revision`, () => {
      const name = 'point-layout-native-interaction-2d-3d', current = evidence(name)
      setSyntheticActionRevision(current.cases[0].nativeDrag, action, revision)
      const expected = ['increased', 'decreased'].includes(fault)
        ? new RegExp(`Native point ${action}: same document revision`)
        : /labelDocumentRevision must be a nonnegative integer/u
      assert.throws(() => assertLayoutAnchorEvidence(current, name), expected)
    })
  }
}
for (const [fault, revision] of [['missing', undefined], ['negative', -1], ['fractional', 100.5], ['string', '100']]) {
  test(`synthetic 32D raw drag policy rejects a consistently ${fault} preparation epoch`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name)
    setSyntheticRevision(syntheticRevisionRecords(current.cases[0].nativeDrag), revision)
    assert.throws(() => assertLayoutAnchorEvidence(current, name), /labelDocumentRevision must be a nonnegative integer/u)
  })
}
for (const boundary of ['before', 'after', 'undo', 'redo']) {
  test(`synthetic 32D raw ${boundary} policy rejects observed and authoritative revision disagreement`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name), raw = current.cases[0].nativeDrag
    const observed = boundary === 'before' ? raw.before : boundary === 'after' ? raw.afterAction.observation : raw[boundary].observation
    observed.labelDocumentRevision += 1
    assert.throws(() => assertLayoutAnchorEvidence(current, name), /observed revision matches authoritative state/u)
  })
}
for (const fault of ['stale-coordinate', 'wrong-next-owner', 'earlier-selection', 'overlay-only', 'wrong-pointer', 'model-edit', 'unclosed-drawer',
  'missing-toolbar-preparation', 'missing-toolbar-restoration', 'stale-prepared-CTM', 'History-overlap', 'wrong-hit-stack',
  'toolbar-event-contamination', 'obsolete-event-epoch', 'restoration-wrong-owner']) {
  test(`synthetic 32D owner-cycle policy rejects ${fault}`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name), cycle = current.cases[0].ownerCycle
    if (fault === 'stale-coordinate') cycle.requestedClick = { x: 199, y: 300 }
    if (fault === 'wrong-next-owner') cycle.stateAfter.selection.id = 'overlap-point'
    if (fault === 'earlier-selection') cycle.events.forEach((event) => { event.phase = 'selection' })
    if (fault === 'overlay-only') cycle.events.forEach((event) => { event.target = { drawer: true, svg: false } })
    if (fault === 'wrong-pointer') cycle.events[1].pointerId = 2
    if (fault === 'model-edit') cycle.stateAfter.json += 'changed'
    if (fault === 'unclosed-drawer') cycle.preparation.closed.inspector.open = true
    if (fault === 'missing-toolbar-preparation') delete cycle.toolbarPreparation
    if (fault === 'missing-toolbar-restoration') delete cycle.toolbarRestoration
    if (fault === 'stale-prepared-CTM') cycle.toolbarPreparation.prepared.geometry.contour.screenCTM.e += 20
    if (fault === 'History-overlap') cycle.before.elementFromPoint = { history: true, svg: false, canvas: false }
    if (fault === 'wrong-hit-stack') cycle.before.elementsFromPoint[0] = { creationToolbar: true, svg: false, canvas: false }
    if (fault === 'toolbar-event-contamination') cycle.events.push({ type: 'click', trusted: true, target: { creationToolbar: true } })
    if (fault === 'obsolete-event-epoch') cycle.events[0].labelDocumentRevision += 1
    if (fault === 'restoration-wrong-owner') cycle.toolbarRestoration.stateBefore.selection = { kind: 'stratum', id: 'overlap-point' }
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['missing-body-overflow', 'inside-contour', 'outside-text', 'untrusted-body-click', 'missing-native-alt', 'wrong-body-owner', 'clipped-selection-ring']) {
  test(`32D body overflow evidence rejects ${fault}`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name), first = current.bodyOverflowCases[0]
    if (fault === 'missing-body-overflow') current.bodyOverflowCases.pop()
    if (fault === 'inside-contour') { first.rendered.bodyOverflow.clickInContour.x = -19; first.rendered.bodyOverflow.distance = 0 }
    if (fault === 'outside-text') first.rendered.bodyOverflow.localBodyClick.x = 6
    if (fault === 'untrusted-body-click') first.rendered.nativeSelection.events[0].trusted = false
    if (fault === 'missing-native-alt') first.altSelection.events[0].altKey = false
    if (fault === 'wrong-body-owner') first.altSelection.id = 'overflow-overlap'
    if (fault === 'clipped-selection-ring') first.rendered.bodyOverflow.selectionRing.radius = 44
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const fault of ['pending-sized-contour', 'later-source', 'later-layout', 'later-placement', 'no-download', 'missing-inline', 'missing-shape']) {
  test(`32D standalone evidence rejects ${fault}`, () => {
    const name = 'point-layout-pending-transparent-edit', current = evidence(name)
    if (fault === 'pending-sized-contour') current.settledContour = false
    if (fault === 'later-source') current.immutableSource = false
    if (fault === 'later-layout') current.immutableLayout = false
    if (fault === 'later-placement') current.immutablePlacement = false
    if (fault === 'no-download') current.actualDownload = false
    if (fault === 'missing-inline') current.combinedLabels = false
    if (fault === 'missing-shape') current.expected.pop()
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const background of ['transparent', 'white']) {
  test(`32D synthetic standalone ${background} policy accepts only complete raster and raw placement`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'stz-32d-standalone-policy-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const fixture = syntheticStandalonePointDownload(directory, `point-layout-pending-${background === 'transparent' ? 'transparent-edit' : 'white-load'}`)
    assert.equal(fixture.raw.result, 'observed'); assert.equal(fixture.raw.capture.before.bodyExists, false)
    assertLayoutStandaloneEvidence(fixture.evidence, fixture.raw, directory)
  })
}
for (const fault of ['pending', 'missing-record', 'unrelated-scenario', 'wrong-png-path', 'nonfinite-root', 'scaled-root',
  'cropped-root', 'changed-coordinates', 'mock-png-header', 'missing-png', 'wrong-png-dimensions',
  'wrong-body-transform', 'wrong-layout', 'pending-contour', 'wrong-captured-tikz', 'primary-error']) {
  test(`32D standalone parent contract rejects ${fault}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'stz-32d-standalone-policy-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const fixture = syntheticStandalonePointDownload(directory, 'point-layout-pending-transparent-edit')
    const { evidence, raw } = fixture, capture = raw.capture
    if (fault === 'pending') capture.status = 'pending'
    if (fault === 'missing-record') delete raw.capture
    if (fault === 'unrelated-scenario') raw.scenario = 'point-layout-pending-white-load'
    if (fault === 'wrong-png-path') capture.retainedPath += '.other'
    if (fault === 'nonfinite-root') { capture.before.root.bounds.x = NaN; capture.after.root.bounds.x = NaN }
    if (fault === 'scaled-root') { capture.before.root.bounds.width /= 2; capture.after.root.bounds.width /= 2 }
    if (fault === 'cropped-root') { capture.before.root.bounds.y = 1140; capture.after.root.bounds.y = 1140 }
    if (fault === 'changed-coordinates') capture.after.scroll.x = 1
    if (fault === 'mock-png-header') writeFileSync(fixture.pngPath, fixture.png.subarray(0, 24))
    if (fault === 'missing-png') unlinkSync(fixture.pngPath)
    if (fault === 'wrong-png-dimensions') capture.png.height += 1
    if (fault === 'wrong-body-transform') raw.reopened[0].bodyTransform = 'translate(0,0)'
    if (fault === 'wrong-layout') evidence.click.snapshot.points[0].style.layout.innerXSep += 1
    if (fault === 'pending-contour') raw.pending.contour = evidence.expected[0].rendered.contour
    if (fault === 'wrong-captured-tikz') raw.outputs.inlineMath = 'later replacement'
    if (fault === 'primary-error') raw.error = { message: 'first capture failure' }
    assert.throws(() => assertLayoutStandaloneEvidence(evidence, raw, directory))
  })
}

const phase31fGroups = ['existing-renderer-regressions', 'independent-oracle-negative-controls', 'boundary-anchor-camera-matrix',
  'inverted-success-and-failure-races', 'pending-lock-and-autohide', 'deletion-and-unmount', 'real-App-input-JSON-history-reused-ID-load', 'current-SVG-cloning',
  'inline-node-rendering-placement-halo-picking', 'inline-node-lifecycle-path-operations-export', 'settled-SVG-export-standalone', 'combined-free-inline-workflows']
function reportFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'stz-32d-policy-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const checkout = { revision: 'exact', trackedDiffSha256: 'tracked', untrackedSha256: { 'layout-fixture.ts': 'untracked' } }
  const report = { result: 'passed', stage: 'complete', environment: { browserVersion: 'controlled policy fixture' }, checkout,
    completed: [...phase31fGroups, ...Object.keys(allPointNodeScenarios)], incompleteGroups: [], unexecuted: [], pageErrors: [], evidence: [] }
  return { root, checkout, report, save: () => writeFileSync(join(root, 'free-labels-evidence.json'), JSON.stringify(report)) }
}
test('32D rejects an exit-zero complete historical 32C report', (t) => {
  const { root, checkout, report, save } = reportFixture(t)
  report.completed = report.completed.filter((group) => group !== layoutAnchorGroup); save()
  assert.throws(() => validateBrowserEvidence('check:free-labels', root, '32D', checkout), /18 required groups/)
})
for (const fault of ['tracked', 'untracked', 'revision']) {
  test(`32D rejects mismatching ${fault} checkout before accepting scenario assertions`, (t) => {
    const { root, checkout, report, save } = reportFixture(t)
    report.checkout = structuredClone(checkout)
    if (fault === 'tracked') report.checkout.trackedDiffSha256 = 'old'
    if (fault === 'untracked') report.checkout.untrackedSha256['layout-fixture.ts'] = 'old'
    if (fault === 'revision') report.checkout.revision = 'old'
    save(); assert.throws(() => validateBrowserEvidence('check:free-labels', root, '32D', checkout), /checkout mismatch/)
  })
}
test('32D cannot accept a complete group count without terminal named scenarios and artifacts', (t) => {
  const { root, checkout, save } = reportFixture(t); save()
  assert.throws(() => validateBrowserEvidence('check:free-labels', root, '32D', checkout), /Missing completed point-node scenario/)
})
test('numeric border placement remains finite and at the stored coordinate', () => {
  const current = placement('ellipse', '213'); assertObservedPointPlacement(current)
  current.rendered.anchorOffset.y = NaN; assert.throws(() => assertObservedPointPlacement(current))
})
for (const source of ['  native $x_i$\t\\keep\n tail  ', ' \\slash\r\n\r\n\t next ', ' plain $g_j$ ']) {
  test(`32D native TikZ oracle preserves established output modes for ${JSON.stringify(source)}`, () => {
    const diagram = createEmptyDiagram({ ambientDimension: 2 })
    diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'oracle-point', position: { x: 3, y: 2, z: 0 }, text: source })]
    const outputs = Object.fromEntries(['standalone', 'inlineMath'].map((exportMode) => [exportMode, generateTikz(diagram, { exportMode })]))
    assertPointTikzSourceByMode(outputs, source)
    assert.equal(diagram.strata[0].text, source)
    const flattened = source.replace(/\r\n?/g, '\n').replace(/[^\S\n]*\n+[^\S\n]*/g, ' ')
    if (source !== flattened) {
      assert.throws(() => assertPointTikzSourceByMode({ ...outputs, standalone: outputs.inlineMath }, source))
      assert.throws(() => assertPointTikzSourceByMode({ ...outputs, inlineMath: outputs.inlineMath.replace(`{${flattened}}`, '{stale source}') }, source))
    }
  })
}
