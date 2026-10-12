import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import test from 'node:test'
import { allPointNodeScenarios, pointNodeScenarioArtifacts, validateBrowserEvidence } from '../../scripts/automation/phase-verification.mjs'
import { layoutAnchorGroup, layoutAnchorScenarios, layoutAnchorArtifacts, layoutShapes, layoutRegimes, layoutForShapeRegime,
  pointAnchorsForShape, layoutImportCases, assertLayoutAnchorEvidence, assertObservedPointPlacement, assertPointTikzSourceByMode,
  assertLayoutStandaloneEvidence, assertLayoutPostClickViewDiagnostic, signedAnchorCases, signedPickingCases,
  signedPolygonalScenario, signedPolygonalCases, zeroAxisLayout, zeroAxisHalfExtent,
  observeZeroAxisPixels, assertZeroAxisPixelEvidence, assertFreshZeroAxisAction, assertZeroAxisNativeAction, assertSignedPolygonalStandaloneEvidence } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { signedPointRenderOrderProof, signedPointStandaloneRootAttributes, createSignedPointAssociationCandidate, assertSignedPointStandaloneAssociation,
  assertSignedPointStandaloneGeometry, findSignedZeroAxisAssociation } from '../../scripts/signedPointStandaloneAssociation.mjs'
import { assertZeroAxisCaptureSnapshot, assertZeroAxisLiveCapture } from '../../scripts/zeroAxisLiveCapture.mjs'
import { captureZeroAxisLive, isZeroAxisLiveCaptureFailure } from '../../scripts/zeroAxisLiveCaptureWorkflow.mjs'
import { capturePointLayoutStandalone } from '../../scripts/checkPointLayoutAnchors.mjs'
import { syntheticStandalonePointDownload, syntheticPendingLayoutPreparation } from './standalonePointDownloadFixture.mjs'
import { syntheticPendingLayoutViewEvidence } from './pointLayoutPendingViewFixture.mjs'
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
import { compareSvgRenderItems } from '../../src/rendering/svgRenderSort.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'

// Node retains cleanup callbacks until the test completes. Keep their lexical
// scope limited to the directory rather than the complete raw capture fixture.
function syntheticPolicyDirectory(t, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

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

function syntheticOwnerCycle(selectedId, expectedId, initial = false, suppliedState) {
  const raw = syntheticPointNativeDragEvidence({ id: selectedId })
  const target = { tag: 'path', pointId: selectedId, drawer: false, svg: true, canvas: true }
  const selection = { kind: 'stratum', id: selectedId }, stateBefore = structuredClone(suppliedState ?? raw.stateBefore)
  stateBefore.selection = selection
  const runtime = JSON.parse(stateBefore.runtimeDiagramJson)
  if (!suppliedState) runtime.strata.push({ ...structuredClone(runtime.strata[0]), id: 'app-point' })
  stateBefore.runtimeDiagramJson = JSON.stringify(runtime)
  stateBefore.json = JSON.stringify({ version: 2, diagram: runtime })
  stateBefore.history = JSON.stringify({ past: [], present: runtime, future: [] })
  const preparation = structuredClone(raw.preparation)
  for (const key of ['stateBefore', 'stateAfter', 'statePrepared']) preparation[key] = stateBefore
  for (const key of ['inherited', 'closed', 'prepared']) {
    preparation[key].modelPoint = structuredClone(runtime.strata.find(({ id }) => id === selectedId))
    preparation[key].camera = structuredClone(runtime.camera)
    preparation[key].selection = selection
    preparation[key].labelDocumentRevision = stateBefore.labelDocumentRevision
  }
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
  const result = { selectedId, expectedId, preparation, stateBefore, stateAfter,
    toolbarPreparation: selectionRaw.toolbarPreparation, toolbarRestoration,
    secondaryErrors: [], droppedEvents: 0, requestedClick, rendered: selectionRaw.rendered,
    before: { ...selectionRaw.before, elementFromPoint: target, elementsFromPoint: [target, { canvasRoot: true }] },
    events: ['pointerdown', 'pointerup', 'click'].map((type) => ({ phase: 'owner-cycle', selectedId, type, trusted: true,
      altKey: true, pointerId: 1, button: 0, buttons: type === 'pointerdown' ? 1 : 0, client: requestedClick, target, selection,
      labelDocumentRevision: stateBefore.labelDocumentRevision,
      path: [target, { canvasRoot: true }] })) }
  if (suppliedState) setSyntheticSignedBoundary(result)
  return result
}
function syntheticSignedState(spec, overlap = false) {
  const diagram = createEmptyDiagram({ ambientDimension: spec.ambientDimension })
  diagram.strata = [createPointStratum({ id: 'app-point', ambientDimension: spec.ambientDimension, text: spec.source,
    position: { x: 3, y: 3, z: spec.ambientDimension === 3 ? .5 : 0 },
    style: { kind: 'pointStyle', shape: spec.shape, size: 8, color: '#203040', opacity: 1, fill: 'filled', layout: structuredClone(spec.layout) } })]
  if (overlap) diagram.strata.push({ ...structuredClone(diagram.strata[0]), id: 'signed-overlap' })
  return { json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), labelDocumentRevision: 100, uiSettings: '{}', selection: null }
}
// Deliberately fabricated geometry exercises raw-policy rejection only. Real
// .23 SVG arclength/CTM measurements and trusted input come from the App runner.
function setSyntheticSignedBoundary(record, local = { x: -96 * Math.cos(.23 * 2 * Math.PI), y: -96 * Math.sin(.23 * 2 * Math.PI) }) {
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 310, f: 290 }
  const boundary = { x: matrix.e + local.x, y: matrix.f + local.y }
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (value.geometry?.contour) Object.assign(value.geometry.contour, { localBoundary: structuredClone(local), boundary: structuredClone(boundary),
      screenCTM: structuredClone(matrix), CTM: structuredClone(matrix), fraction: .23, bounds: { x: 214, y: 194, width: 192, height: 192 } })
    if (Object.hasOwn(value, 'contourLength')) value.contourScreenBounds = { x: 214, y: 194, width: 192, height: 192 }
    if (Object.hasOwn(value, 'boundary')) value.boundary = structuredClone(boundary)
    if (Object.hasOwn(value, 'requestedClick') && value.requestedClick) value.requestedClick = structuredClone(boundary)
    if (value.type && ['pointerdown', 'pointerup', 'click'].includes(value.type)) value.client = structuredClone(boundary)
    for (const child of Object.values(value)) visit(child)
  }
  visit(record)
}
function syntheticSignedPlacement(spec, picking = false) {
  const state = syntheticSignedState(spec, picking), entry = placement(spec.shape, spec.layout.anchor, {
    key: spec.key, ambientDimension: spec.ambientDimension, source: spec.source, layout: structuredClone(spec.layout), state })
  Object.assign(entry.rendered, { source: spec.source, layout: structuredClone(spec.layout), anchorOffset: { x: picking ? 0 : -96, y: 0 },
    placementOffset: { x: picking ? 0 : 96, y: 0 }, bounds: { x: -96, y: -96, width: 192, height: 192 },
    contour: { tag: 'path', attributes: picking ? { d: 'M -96 0 A -96 -96 0 0 0 96 0 A -96 -96 0 0 0 -96 0 Z' }
      : { transform: 'translate(96 0)' } } })
  if (picking) {
    const selectedState = { ...state, selection: { kind: 'stratum', id: 'signed-overlap' } }
    entry.rendered.nativeSelection = syntheticGeometricSelectionEvidence({ scenario: 'point-layout-native-interaction-2d-3d',
      id: 'signed-overlap', state, ambientDimension: spec.ambientDimension, shape: spec.shape })
    setSyntheticSignedBoundary(entry.rendered.nativeSelection)
    entry.rendered.boundary = entry.rendered.nativeSelection.requestedClick
    entry.rendered.contourScreenBounds = entry.rendered.nativeSelection.rendered.contourScreenBounds
    entry.ownerCycleStart = syntheticOwnerCycle('signed-overlap', 'signed-overlap', true, selectedState)
    entry.ownerCycle = syntheticOwnerCycle('signed-overlap', 'app-point', false, selectedState)
  }
  return entry
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
// Synthetic records below only exercise the policy schema and negative
// controls. Native acceptance uses the observed App and downloaded files.
function syntheticPolygonalPlacement(spec, ambientDimension, id = 'app-point') {
  const state = syntheticSignedState({ ...spec, ambientDimension })
  if (id !== 'app-point') {
    const remap = (value) => {
      if (!value || typeof value !== 'object') return
      if (value.id === 'app-point') value.id = id
      for (const child of Object.values(value)) remap(child)
    }
    for (const field of ['json', 'runtimeDiagramJson', 'history']) { const value = JSON.parse(state[field]); remap(value); state[field] = JSON.stringify(value) }
  }
  const entry = placement(spec.shape, spec.anchor, { key: spec.key, id, ambientDimension, source: '', layout: structuredClone(spec.layout), state })
  const anchorOffset = Object.fromEntries(Object.entries(spec.expectedTeXpt).map(([axis, value]) => [axis, value * 1.2]))
  Object.assign(entry.rendered, { source: '', layout: structuredClone(spec.layout), anchorOffset,
    placementOffset: { x: -anchorOffset.x || 0, y: -anchorOffset.y || 0 }, nodeTransform: 'translate(310 290)', bodyTransform: 'translate(0 0)',
    contour: { tag: 'path', attributes: { d: 'M 0 0 L 1 1 L 1 -1 Z' } },
    nativeSelection: syntheticGeometricSelectionEvidence({ scenario: signedPolygonalScenario, id, ambientDimension, shape: spec.shape, state }) })
  return entry
}
function syntheticZeroRendered() {
  const h = zeroAxisHalfExtent
  return { source: '', shape: 'ellipse', anchor: 'center', layout: structuredClone(zeroAxisLayout), state: 'ready',
    pointRequest: 'current', bodyRequest: 'current', bodyOrigin: { x: 0, y: 0 }, placement: { x: 310, y: 290 }, placedAnchor: { x: 310, y: 290 },
    anchorOffset: { x: 0, y: 0 }, placementOffset: { x: 0, y: 0 }, bodyUpright: true,
    contourLength: 4 * h, bounds: { x: 0, y: -h, width: 0, height: 2 * h },
    nativeTraversal: [0, -h, 0, h, 0].map((y) => ({ x: 0, y })), nodeTransform: 'translate(310 290)', bodyTransform: 'translate(0 0)',
    contour: { tag: 'path', attributes: { d: `M 0 0 L 0 ${-h} L 0 0 L 0 ${h} L 0 0 Z`,
      fill: 'none', stroke: '#B000C0', 'stroke-width': '0.48', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-dashoffset': '0' } } }
}
function syntheticZeroPixels(ctm) {
  return { method: 'actual-native-PNG-magenta-stroke-pixel-centers', sha256: 'a'.repeat(64), bytes: 100,
    width: 1500, height: 1150, ctm, pixels: 68, bounds: { minX: -.2, maxX: .2, minY: -zeroAxisHalfExtent, maxY: zeroAxisHalfExtent } }
}
function syntheticZeroCanvas(ambientDimension) {
  const common = { id: '', class: null, pointId: null, drawer: false, ariaLabel: null, svg: true, canvas: true,
    pointHandle: false, creationToolbar: false, toolbarOverlay: false, quickStyle: false, history: false,
    connected: true, currentCanvas: true }
  const root = { ...common, tag: 'svg', class: 'svg-diagram', ariaLabel: `${ambientDimension}D StratifiedTikZ example`,
    canvasRoot: true, currentCanvasRoot: true, canvasDirectChild: false, svgBackgroundAttribute: null, svgBackground: false }
  const background = { ...common, tag: 'rect', canvasRoot: false, currentCanvasRoot: false, canvasDirectChild: true,
    svgBackgroundAttribute: 'true', svgBackground: true }
  return { rootCount: 1, backgroundCount: 1, root, background }
}
function syntheticZeroCoincidentContours(snapshot, ctm) {
  const rendered = syntheticZeroRendered()
  return ['app-point', 'zero-overlap'].map((id) => ({ id, count: 1, currentCanvas: true,
    owner: JSON.stringify(['point-node', snapshot.labelDocumentRevision, id]),
    request: `request:${snapshot.labelDocumentRevision}:${id}`, bodyRequest: `request:${snapshot.labelDocumentRevision}:${id}`,
    source: '', state: 'ready', shape: 'ellipse', parameters: snapshot.layout.parameters,
    layout: { ...structuredClone(zeroAxisLayout), fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } },
    pointScreenCTM: structuredClone(ctm), contour: { connected: true, tag: 'path', attributes: structuredClone(rendered.contour.attributes),
      bounds: structuredClone(rendered.bounds), length: rendered.contourLength, traversal: structuredClone(rendered.nativeTraversal),
      CTM: structuredClone(ctm), screenCTM: structuredClone(ctm) } }))
}
function syntheticCaptureElement(canvasObservation, { toolbar = false, label = null, tag = 'div' } = {}) {
  return { ...structuredClone(canvasObservation.root), tag, class: toolbar ? 'preview-floating-toolbar' : 'other-ui',
    ariaLabel: label, svg: false, canvas: false, canvasRoot: false, currentCanvas: false, currentCanvasRoot: false,
    creationToolbar: toolbar, toolbarOverlay: toolbar }
}
// The earlier native workflow owns its own collapse/restoration. This separate
// fabricated lifecycle starts from that restored UI and measures the entire
// independently known stroke, including its upper endpoint, before one image.
function syntheticZeroCaptureSnapshot(snapshot, state, collapsed, clearExpanded = false) {
  const result = structuredClone(snapshot), matrix = result.geometry.contour.screenCTM
  result.readyState = 'complete'
  const project = ({ x, y }) => ({ x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f })
  result.toolbar = { overlayCount: 1, collapsed, floatingCount: Number(!collapsed), expandCount: Number(collapsed),
    collapseCount: Number(!collapsed), quickStyleCount: 0, historyCount: 1 }
  result.tool.selectPressed = collapsed ? null : 'true'
  result.selection = structuredClone(state.selection); result.requestedClick = null
  result.elementFromPoint = null; result.elementsFromPoint = []; result.events = []; result.droppedEvents = null
  result.viewport = { width: 1500, height: 1150, devicePixelRatio: 1, scrollX: 0, scrollY: 129,
    visual: { width: 1500, height: 1150, offsetLeft: 0, offsetTop: 0, scale: 1 } }
  result.geometry.canvas.bounds ??= { x: 43, y: 130.375, width: 1414, height: 1018 }
  const strokeWidth = .48, h = zeroAxisHalfExtent, halfStroke = strokeWidth / 2
  const corners = [{ x: -halfStroke, y: -h - halfStroke }, { x: halfStroke, y: -h - halfStroke },
    { x: halfStroke, y: h + halfStroke }, { x: -halfStroke, y: h + halfStroke }].map(project)
  const minX = Math.min(...corners.map(({ x }) => x)), maxX = Math.max(...corners.map(({ x }) => x)),
    minY = Math.min(...corners.map(({ y }) => y)), maxY = Math.max(...corners.map(({ y }) => y))
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  for (const kind of ['point', 'contour']) result.geometry[kind].bounds = { x: matrix.e, y: matrix.f - matrix.d * h, width: 0, height: 2 * h * matrix.d }
  const controlBounds = { x: 55, y: 144, width: 28, height: 30 }, toolbarBounds = clearExpanded
    ? { x: 51, y: 138, width: 500, height: 42 } : { x: 51, y: 138, width: 1350, height: 42 }
  const toolbar = syntheticCaptureElement(result.canvasObservation, { toolbar: true, tag: 'section' })
  const intersects = (overlay) => overlay.x < bounds.x + bounds.width && overlay.x + overlay.width > bounds.x
    && overlay.y < bounds.y + bounds.height && overlay.y + overlay.height > bounds.y
  const overlays = [...(collapsed ? [] : [{ kind: 'toolbar', element: toolbar, bounds: toolbarBounds, visible: true,
    intersects: intersects(toolbarBounds), painted: true }]),
  { kind: 'history', element: { ...syntheticCaptureElement(result.canvasObservation), class: 'preview-history-toolbar', history: true },
    bounds: { x: 51, y: 185, width: 108, height: 41 }, visible: true, intersects: false, painted: true }]
  const target = { ...structuredClone(result.canvasObservation.root), tag: 'path', class: null, pointId: 'zero-overlap',
    canvasRoot: false, currentCanvasRoot: false }
  const locals = [], steps = Math.ceil(2 * h * Math.hypot(matrix.c, matrix.d))
  for (let i = 0; i <= steps; i++) for (const x of [-strokeWidth / 4, 0, strokeWidth / 4]) locals.push({ x, y: -h + 2 * h * i / steps })
  locals.push({ x: -halfStroke, y: -h - halfStroke }, { x: halfStroke, y: -h - halfStroke },
    { x: halfStroke, y: h + halfStroke }, { x: -halfStroke, y: h + halfStroke })
  const samples = locals.map((local) => {
    const screen = project(local), covered = !collapsed && screen.x >= toolbarBounds.x && screen.x <= toolbarBounds.x + toolbarBounds.width
      && screen.y >= toolbarBounds.y && screen.y <= toolbarBounds.y + toolbarBounds.height
    const elementFromPoint = covered ? toolbar : target
    return { local, screen, elementFromPoint, elementsFromPoint: [elementFromPoint, result.canvasObservation.root] }
  })
  const obstructions = overlays.flatMap((overlay, index) => overlay.visible && overlay.painted && overlay.intersects ? [{ kind: 'overlay', index }] : [])
  for (const [index, sample] of samples.entries()) if (!sample.elementFromPoint.currentCanvas) obstructions.push({ kind: 'hit-stack', index })
  const control = (label) => ({ element: { ...syntheticCaptureElement(result.canvasObservation, { toolbar: true, label, tag: 'button' }),
    creationToolbar: label === 'Collapse preview toolbar', class: 'preview-overlay-button' },
    bounds: structuredClone(controlBounds), visible: true, disabled: false })
  result.captureGeometry = { method: 'fresh-native-zero-axis-entire-stroke',
    current: { rootCount: 1, pointCount: 1, contourCount: 1, canvasObservation: structuredClone(result.canvasObservation),
      layout: structuredClone(result.layout), revision: state.labelDocumentRevision,
      geometry: Object.fromEntries(['canvas', 'point', 'contour'].map((key) => [key, structuredClone(result.geometry[key])])) },
    halfExtent: h, strokeWidth, nativeTraversal: syntheticZeroRendered().nativeTraversal,
    nativeEndpoints: [{ x: 0, y: -h }, { x: 0, y: h }].map(project),
    endpoints: [{ x: 0, y: -h }, { x: 0, y: h }].map(project), footprint: { corners, bounds },
    frame: { origin: { x: 0, y: 0 }, viewport: structuredClone(result.viewport) },
    controls: { collapse: collapsed ? [] : [control('Collapse preview toolbar')], expand: collapsed ? [control('Expand preview toolbar')] : [] },
    overlays, samples, obstructions, insideViewport: true, insideCanvas: true, errors: [] }
  return result
}
function syntheticZeroLiveObservation(workflow, state, { inheritedCollapsed = false, clearExpanded = false } = {}) {
  const inherited = syntheticZeroCaptureSnapshot(workflow.actions.at(-1).after, state, inheritedCollapsed, clearExpanded)
  const needsCollapse = inherited.captureGeometry.obstructions.length > 0
  const prepared = syntheticZeroCaptureSnapshot(workflow.actions.at(-1).after, state, inheritedCollapsed || needsCollapse, clearExpanded)
  inherited.at = 200; prepared.at = 220
  const collapsedAfter = { ...structuredClone(prepared), at: 210 }, afterImage = { ...structuredClone(prepared), at: 230 },
    restorationBefore = { ...structuredClone(prepared), at: 240 }, restoredActionAfter = { ...structuredClone(inherited), at: 250 },
    restorationAfter = { ...structuredClone(inherited), at: 260 }
  const action = (name, before, after, purpose) => ({ name, purpose, controlCount: 1, oppositeCount: 1,
    controlName: `${name === 'collapse' ? 'Collapse' : 'Expand'} preview toolbar`,
    control: structuredClone(before.captureGeometry.controls[name][0]), stateBefore: structuredClone(state), before: structuredClone(before),
    stateAfter: structuredClone(state), after: structuredClone(after) })
  const pixels = syntheticZeroPixels(prepared.geometry.contour.screenCTM)
  const capture = { inheritedState: structuredClone(state), inherited,
    decision: { action: needsCollapse ? 'collapse' : 'none', reason: needsCollapse ? 'measured-toolbar-obstruction' : 'already-unobstructed',
      obstructions: structuredClone(inherited.captureGeometry.obstructions) },
    actions: needsCollapse ? [action('collapse', inherited, collapsedAfter, 'capture-obstruction')] : [], preparedState: structuredClone(state), prepared,
    restoration: { actions: needsCollapse ? [action('expand', restorationBefore, restoredActionAfter, 'restore')] : [], stateBefore: structuredClone(state),
      before: restorationBefore, stateAfter: structuredClone(state), after: restorationAfter,
      ...(needsCollapse ? { expandCount: 1, collapseCount: 0 } : {}) },
    cleanup: { observerRegistries: Object.fromEntries(['geometricSelection', 'pointNativeDrag', 'zeroAxisInput', 'zeroAxisCapture']
      .map((key) => [key, { present: false, size: 0 }])), listenersInstalled: 0, altKeyUp: 'completed-by-native-interaction' }, secondaryErrors: [],
    image: { attempts: 1, path: `/synthetic-policy-only/${signedPolygonalScenario}-live.png`, bytes: pixels.bytes, sha256: pixels.sha256,
      width: pixels.width, height: pixels.height, frame: { origin: { x: 0, y: 0 }, viewport: structuredClone(prepared.viewport), ctm: structuredClone(pixels.ctm) },
      fullPage: false, scale: 'css' } }
  return { state: structuredClone(state), snapshot: structuredClone(prepared), afterState: structuredClone(state), afterSnapshot: afterImage, capture, pixels }
}
function refreshSyntheticCaptureObstruction(snapshot) {
  const geometry = snapshot.captureGeometry, bounds = geometry.footprint.bounds
  const target = { ...structuredClone(snapshot.canvasObservation.root), tag: 'path', class: null, pointId: 'zero-overlap',
    canvasRoot: false, currentCanvasRoot: false }
  for (const overlay of geometry.overlays) overlay.intersects = overlay.bounds.x < bounds.x + bounds.width
    && overlay.bounds.x + overlay.bounds.width > bounds.x && overlay.bounds.y < bounds.y + bounds.height
    && overlay.bounds.y + overlay.bounds.height > bounds.y
  for (const sample of geometry.samples) {
    const overlay = geometry.overlays.findLast((entry) => entry.visible && entry.painted && sample.screen.x >= entry.bounds.x
      && sample.screen.x <= entry.bounds.x + entry.bounds.width && sample.screen.y >= entry.bounds.y
      && sample.screen.y <= entry.bounds.y + entry.bounds.height)
    sample.elementFromPoint = overlay?.element ?? target
    sample.elementsFromPoint = [sample.elementFromPoint, snapshot.canvasObservation.root]
  }
  geometry.obstructions = geometry.overlays.flatMap((overlay, index) => overlay.visible && overlay.painted && overlay.intersects ? [{ kind: 'overlay', index }] : [])
  for (const [index, sample] of geometry.samples.entries()) if (!sample.elementFromPoint.currentCanvas) geometry.obstructions.push({ kind: 'hit-stack', index })
}
function setSyntheticZeroInputContour(record) {
  const ctm = { a: 3.1, b: 0, c: 0, d: 3.1, e: 1296.4, f: 268.975 }
  const local = { x: 0, y: -.92 * zeroAxisHalfExtent }, boundary = { x: ctm.e, y: ctm.d * local.y + ctm.f }
  const bounds = { x: ctm.e, y: ctm.f - ctm.d * zeroAxisHalfExtent, width: 0, height: 2 * ctm.d * zeroAxisHalfExtent }
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (value.geometry?.contour) Object.assign(value.geometry.contour, { length: 4 * zeroAxisHalfExtent, fraction: .23,
      localBoundary: structuredClone(local), boundary: structuredClone(boundary), bounds: structuredClone(bounds) })
    if (Object.hasOwn(value, 'contourLength')) { value.contourLength = 4 * zeroAxisHalfExtent; value.contourScreenBounds = structuredClone(bounds) }
    if (Object.hasOwn(value, 'boundary')) value.boundary = structuredClone(boundary)
    if (value.requestedClick) value.requestedClick = structuredClone(boundary)
    if (value.type && ['pointerdown', 'pointerup', 'click'].includes(value.type)) value.client = structuredClone(boundary)
    for (const child of Object.values(value)) visit(child)
  }
  visit(record)
}
function syntheticZeroNative(ambientDimension, outsideTarget = 'background', captureOptions = {}) {
  const spec = { source: '', shape: 'ellipse', layout: zeroAxisLayout, ambientDimension }, state = syntheticSignedState(spec)
  for (const field of ['json', 'runtimeDiagramJson', 'history']) {
    const value = JSON.parse(state[field]), diagram = field === 'json' ? value.diagram : field === 'history' ? value.present : value
    diagram.strata[0].style.paint = { text: { color: '#203040', opacity: 1 }, fill: { enabled: false, color: '#FFFFFF', opacity: 1 },
      stroke: { enabled: true, color: '#B000C0', opacity: 1, width: .4, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } }
    diagram.strata.push({ ...structuredClone(diagram.strata[0]), id: 'zero-overlap' }); state[field] = JSON.stringify(value)
  }
  state.selection = { kind: 'stratum', id: 'zero-overlap' }
  const selection = syntheticGeometricSelectionEvidence({ scenario: signedPolygonalScenario,
    id: 'zero-overlap', ambientDimension, shape: 'ellipse', state })
  const prepared = syntheticGeometricSelectionEvidence({ scenario: signedPolygonalScenario,
    id: 'zero-overlap', ambientDimension, shape: 'ellipse', state, initialSelection: state.selection, obstructed: true,
    collapsed: captureOptions.inheritedCollapsed ?? false })
  setSyntheticZeroInputContour(selection); setSyntheticZeroInputContour(prepared)
  const canvasPreparation = syntheticOwnerCycle('zero-overlap', 'zero-overlap', true, state).preparation
  const workflow = { result: 'observed', secondaryErrors: [], preparation: canvasPreparation,
    toolbarPreparation: prepared.toolbarPreparation, toolbarRestoration: prepared.toolbarRestoration, actions: [] }
  let current = structuredClone(state)
  const ctm = prepared.before.geometry.contour.screenCTM
  const canvasObservation = syntheticZeroCanvas(ambientDimension)
  for (const [index, key] of ['outside-clear', 'ordinary-axis', 'alt-start', 'alt-next', 'outside-final'].entries()) {
    const inside = index > 0 && index < 4, local = { x: inside ? 0 : 12, y: 20 }
    const click = { x: ctm.a * local.x + ctm.c * local.y + ctm.e, y: ctm.b * local.x + ctm.d * local.y + ctm.f }
    const stateBefore = structuredClone(current), selectedId = [null, 'zero-overlap', 'zero-overlap', 'app-point', null][index]
    current.selection = selectedId ? { kind: 'stratum', id: selectedId } : null
    const before = structuredClone(prepared.before), after = structuredClone(prepared.after)
    for (const [snapshot, snapshotState] of [[before, stateBefore], [after, current]]) {
      snapshot.at = 110 + index * 10 + Number(snapshot === after) * 5
      snapshot.selection = structuredClone(snapshotState.selection); snapshot.requestedClick = click
      snapshot.events = []; snapshot.droppedEvents = null
      snapshot.layout.parameters = '{"borderRotate":0}'
      snapshot.geometry.contour.length = 4 * zeroAxisHalfExtent
      snapshot.geometry.canvas = { connected: true, currentCanvas: true, screenCTM: structuredClone(ctm), CTM: structuredClone(ctm) }
      for (const kind of ['point', 'contour']) Object.assign(snapshot.geometry[kind],
        { currentCanvas: true, screenCTM: structuredClone(ctm), CTM: structuredClone(ctm) })
      snapshot.canvasObservation = structuredClone(canvasObservation)
      snapshot.coincidentContours = syntheticZeroCoincidentContours(snapshot, ctm)
    }
    const target = inside ? { ...structuredClone(prepared.before.elementFromPoint), connected: true, currentCanvas: true,
      currentCanvasRoot: false, canvasDirectChild: false, svgBackgroundAttribute: null, svgBackground: false }
      : structuredClone(canvasObservation[outsideTarget === 'root' ? 'root' : 'background'])
    for (const snapshot of [before, after]) {
      snapshot.elementFromPoint = structuredClone(target)
      snapshot.elementsFromPoint = target.canvasRoot ? [structuredClone(target)] : [structuredClone(target), structuredClone(canvasObservation.root)]
    }
    const altKey = index === 2 || index === 3
    workflow.actions.push({ key, local, altKey, click, stateBefore, stateAfter: structuredClone(current), before, after,
      droppedEvents: 0, events: ['pointerdown', 'pointerup', 'click'].map((type) => ({ type, trusted: true, altKey,
        labelDocumentRevision: state.labelDocumentRevision, layout: { owner: before.layout.owner, request: before.layout.request,
          bodyRequest: before.layout.bodyRequest, source: '', shape: 'ellipse', state: 'ready' },
        button: 0, buttons: type === 'pointerdown' ? 1 : 0, pointerId: 1, selection: structuredClone(stateBefore.selection),
        canvasObservation: structuredClone(canvasObservation), canvasHasPointerCapture: !inside && outsideTarget === 'background' && type === 'pointerup',
        target: structuredClone(inside || type === 'pointerdown' ? target : canvasObservation.root),
        path: inside || (type === 'pointerdown' && !target.canvasRoot)
          ? [structuredClone(target), structuredClone(canvasObservation.root)] : [structuredClone(canvasObservation.root)],
        client: type === 'click' ? { x: Math.trunc(click.x), y: Math.trunc(click.y) }
          : { x: Math.fround(click.x), y: Math.fround(click.y) } })) })
  }
  for (const field of ['stateBefore', 'stateAfter']) workflow.toolbarRestoration[field] = structuredClone(current)
  for (const field of ['before', 'after']) {
    const { toolbar, tool } = workflow.toolbarRestoration[field]
    workflow.toolbarRestoration[field] = { ...structuredClone(workflow.actions.at(-1).after),
      at: field === 'before' ? 170 : 180, toolbar, tool, requestedClick: null, elementFromPoint: null, elementsFromPoint: [] }
    toolbar.quickStyleCount = 0
  }
  for (const action of workflow.toolbarPreparation.actions.filter(({ purpose }) => purpose === 'restore')) {
    action.stateBefore = structuredClone(current); action.stateAfter = structuredClone(current)
    action.before = structuredClone(workflow.toolbarRestoration.before); action.after = structuredClone(workflow.toolbarRestoration.after)
  }
  workflow.cleanup = { altKeyUp: 'completed', observer: { tokenPresent: false, registryPresent: false, remaining: 0 } }
  const liveObservation = syntheticZeroLiveObservation(workflow, current, captureOptions)
  return { ambientDimension, layout: structuredClone(zeroAxisLayout), state, rendered: { ...syntheticZeroRendered(), nativeSelection: selection },
    axisInteraction: workflow, liveObservation, livePaint: syntheticZeroPixels(ctm) }
}
// Distinct before-image contours retain the real fixture's body/contour relation.
// These fabricated records exercise correspondence policy, never native fitting.
const syntheticSignedContours = [
  'M 0 12 L 11.412678195542 3.708203932499 L 7.05342302751 -9.708203932499 L -7.05342302751 -9.708203932499 L -11.412678195542 3.708203932499 Z',
  'M -8.485281374239 8.485281374239 L 8.485281374239 8.485281374239 L 8.485281374239 -8.485281374239 L -8.485281374239 -8.485281374239 Z',
  'M 0 12 L 10.392304845413 -6 L -10.392304845413 -6 Z',
  'M 0 12 L 4.70228201834 6.472135955 L 11.412678195542 3.708203932499 L 7.608452130361 -2.472135955 L 7.05342302751 -9.708203932499 L 0 -8 L -7.05342302751 -9.708203932499 L -7.608452130361 -2.472135955 L -11.412678195542 3.708203932499 L -4.70228201834 6.472135955 Z',
  'M -25.338520367386 0 L -1.338520367386 9.9404296875 L -1.338520367386 -9.9404296875 Z',
  'M -15.229339599609 0 L 8.538153076172 9.844427490234 L 4.46044921875 0 L 8.538153076172 -9.844427490234 Z',
]
function syntheticSignedRenderOrder(expected) {
  return expected.map((entry, stableIndex) => ({ id: entry.id, layer: entry.modelPoint.layer ?? 0,
    renderKind: 'point', stableIndex })).sort(compareSvgRenderItems).map(({ stableIndex }) => expected[stableIndex])
}
function syntheticPolygonalEvidence(outsideTarget = 'background', captureOptions = {}) {
  const polygonalCases = [2, 3].flatMap((ambientDimension) => signedPolygonalCases.map((spec) => syntheticPolygonalPlacement(spec, ambientDimension)))
  const zeroAxisCases = [2, 3].map((ambientDimension) => syntheticZeroNative(ambientDimension, outsideTarget, captureOptions))
  const downloads = [2, 3].map((ambientDimension) => {
    const expected = signedPolygonalCases.map((spec) => syntheticPolygonalPlacement(spec, ambientDimension, `signed-${spec.key}`))
    expected.push({ result: 'passed', id: 'signed-zero-axis', source: '', shape: 'ellipse', anchor: 'center', layout: structuredClone(zeroAxisLayout),
      rendered: syntheticZeroRendered(), modelPositionUnchanged: true })
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.strata = expected.map((entry, index) => {
      const spec = index < signedPolygonalCases.length ? signedPolygonalCases[index] : { source: '', shape: 'ellipse', layout: zeroAxisLayout }
      const point = JSON.parse(syntheticSignedState({ ...spec, ambientDimension }).runtimeDiagramJson).strata[0]
      point.id = entry.id; point.position = { x: index < signedPolygonalCases.length ? 1 + index % 3 * 2 : 7,
        y: index < signedPolygonalCases.length ? 1 + Math.floor(index / 3) * 2 : 3, z: ambientDimension === 3 ? .5 : 0 }
      entry.modelPoint = structuredClone(point); entry.rendered.pointOwner = JSON.stringify(['point-node', 100, point.id])
      entry.rendered.pointRequest = JSON.stringify(['', 'Times New Roman, Times, serif', 12, '400', 'normal', 1, 4, .2, entry.rendered.pointOwner])
      entry.rendered.bodyRequest = entry.rendered.pointRequest
      return point
    })
    const projection = resolveSvgCamera(diagram, 520, 360, { fitToView: true, extraPointsForFit: createCoordinateAxesGuide(ambientDimension).fitPoints })
    for (const [index, entry] of expected.entries()) {
      const projected = projectToSvgPoint(projection, entry.modelPoint.position, 360)
      entry.rendered.nodeTransform = `translate(${projected.x} ${projected.y})`
      entry.rendered.placement = projected; entry.rendered.placedAnchor = structuredClone(projected)
      if (index < signedPolygonalCases.length) {
        const offset = entry.rendered.placementOffset
        entry.rendered.bodyTransform = `translate(${offset.x} ${offset.y})`
        entry.rendered.contour = { tag: 'path', attributes: { fill: '#d8ecff', 'fill-opacity': '0.7', stroke: '#203040',
          'stroke-opacity': '1', 'stroke-width': '0.48', 'stroke-dashoffset': '0', 'stroke-linecap': 'butt',
          'stroke-linejoin': 'miter', 'stroke-miterlimit': '10', transform: entry.rendered.bodyTransform, d: syntheticSignedContours[index] } }
      }
    }
    const savedDiagram = structuredClone(diagram); if (ambientDimension === 2) delete savedDiagram.camera
    const savedJson = JSON.stringify({ version: 2, diagram: savedDiagram })
    const beforeExportState = { json: savedJson, runtimeDiagramJson: JSON.stringify(diagram),
      history: JSON.stringify({ past: [], present: diagram, future: [] }), selection: null, uiSettings: '{}', labelDocumentRevision: 100 }
    const runtime = { documentRevision: 100, identity: 'synthetic-policy-only', fontGeneration: 1 }
    const click = { snapshot: { ...structuredClone(beforeExportState), runtime, camera: savedDiagram.camera, documentUnchanged: true,
      exportBackground: { count: 1, tag: 'select', ariaLabel: 'SVG export background', value: 'transparent' },
      points: expected.map((entry) => ({ id: entry.id, source: '', modelSource: '', status: 'ready', runtime,
        owner: entry.rendered.pointOwner, request: entry.rendered.bodyRequest, pointRequest: entry.rendered.pointRequest, held: null,
        position: structuredClone(entry.modelPoint.position), style: structuredClone(entry.modelPoint.style), nodeTransform: entry.rendered.nodeTransform })) } }
    return { scenario: `${signedPolygonalScenario}-${ambientDimension}d`, group: layoutAnchorGroup, background: 'transparent', ambientDimension,
      expected, click, beforeExportState, savedJson, capture: { status: 'saved' }, strokePixels: syntheticZeroPixels(zeroAxisCases[ambientDimension - 2].livePaint.ctm) }
  })
  return { scenario: signedPolygonalScenario, group: layoutAnchorGroup, result: 'passed', pageErrors: [], polygonalCases, zeroAxisCases, downloads }
}
function evidence(name) {
  if (name === signedPolygonalScenario) return syntheticPolygonalEvidence()
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
    }),
    signedAnchorCases: signedAnchorCases.map((spec) => syntheticSignedPlacement(spec)),
    signedPickingCases: signedPickingCases.map((spec) => syntheticSignedPlacement(spec, true)) }
  if (name === 'point-layout-import-order-units') return { ...common,
    cases: layoutImportCases.map(({ key, expected }) => ({ result: 'passed', key, actual: expected, expected, sourcePreserved: true })),
    nativeImport: true, saveReloadRestored: true, standaloneTikz: true, inlineTikz: true, unsupportedTextMetricsDiagnosed: true }
  const background = name.includes('transparent') ? 'transparent' : 'white'
  const preparation = syntheticPendingLayoutPreparation(background)
  const postClickView = background === 'transparent'
    ? syntheticPendingLayoutViewEvidence({ click: preparation.click, source: preparation.pendingPreparation.source }) : null
  const releasedRequests = postClickView ? postClickView.cleanup.observation.hold.started : 1
  return { ...common, background, actualDownload: true, capturedPending: true, reopened: true,
    capture: { status: 'saved' },
    immutableSource: true, immutableLayout: true, immutablePlacement: true, settledContour: true, combinedLabels: true, noExternalAssets: true,
    expected: preparation.click.snapshot.points.map((point) => {
      const entry = placement(point.style.shape, point.style.layout.anchor, { id: point.id, source: point.source, layout: point.style.layout })
      entry.rendered.source = point.source; entry.rendered.nodeTransform = point.nodeTransform
      return entry
    }), ...preparation, ...(postClickView ? { postClickView } : {}), capturedRelease: { source: preparation.pendingPreparation.source,
      before: postClickView ? structuredClone(postClickView.cleanup.observation.hold) : { started: 1, completed: 0, released: false },
      result: { source: preparation.pendingPreparation.source, started: releasedRequests, completed: releasedRequests, fail: false }, after: null } }
}

// Complete lossless fabricated PNG transport exercises replay and corruption
// policy only. It never supplies production/native paint acceptance.
function syntheticZeroPng(ctm, paint = true, extent = zeroAxisHalfExtent) {
  const width = 1500, height = 1150, stride = width * 4 + 1, scanlines = Buffer.alloc(height * stride, 255)
  for (let y = 0; y < height; y++) {
    scanlines[y * stride] = 0
    if (!paint) continue
    const localY = (y + .5 - ctm.f) / ctm.d
    if (Math.abs(localY) > extent + .5 / ctm.d) continue
    const x = Math.floor(ctm.e), at = y * stride + 1 + x * 4
    scanlines[at] = 176; scanlines[at + 1] = 0; scanlines[at + 2] = 192
  }
  const chunk = (name, content) => {
    const data = Buffer.concat([Buffer.from(name), content]), crcBytes = Buffer.alloc(4)
    let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    crcBytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    const length = Buffer.alloc(4); length.writeUInt32BE(content.length)
    return Buffer.concat([length, data, crcBytes])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))])
}
function syntheticSignedMatrices(rendered) {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const translation = (value) => {
    if (!value) return identity
    const values = value.slice('translate('.length, -1).split(/\s+/u).map(Number)
    return { ...identity, e: Math.fround(values[0]), f: Math.fround(values[1]) }
  }
  const outer = translation(rendered.nodeTransform), body = translation(rendered.bodyTransform), contour = translation(rendered.contour.attributes.transform)
  const placed = (offset) => ({ ...identity, e: outer.e + offset.e, f: outer.f + offset.f })
  return { nodeCTM: outer, bodyCTM: placed(body), contourCTM: placed(contour),
    nodeScreenCTM: structuredClone(outer), bodyScreenCTM: placed(body), contourScreenCTM: placed(contour) }
}
function syntheticSignedStructure(domOrdinal) {
  const nodePath = [0, domOrdinal, 0], bodyPath = [...nodePath, 1]
  return { nodePath, bodyPath, contourPath: [...nodePath, 0], titlePath: [...bodyPath, 0],
    nodeTag: 'g', bodyTag: 'g', contourTag: 'path', titleTag: 'title', nodeChildTags: ['path', 'g'], bodyChildTags: ['title', 'g'],
    titleCount: 1, bodyCount: 1, contourCount: 1,
    connected: { node: true, body: true, contour: true, title: true }, currentRoot: { node: true, body: true, contour: true, title: true } }
}
function syntheticSignedSvg(raw) {
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<svg ${Object.entries(raw.document.rootAttributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}><g>`
    + raw.reopened.map((entry) => `<g><g transform="${entry.nodeTransform}"><path ${Object.entries(entry.contour.attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}/><g transform="${entry.bodyTransform}"><title/><g transform="translate(0 0)" opacity="1" fill="#203040" color="#203040" pointer-events="none"><g/></g></g></g></g>`).join('') + '</g></svg>'
}
function syntheticSignedStandalone(directory, ambientDimension = 2, outsideTarget = 'background', captureOptions = {}) {
  const evidence = syntheticPolygonalEvidence(outsideTarget, captureOptions), download = evidence.downloads.find((entry) => entry.ambientDimension === ambientDimension)
  const stem = download.scenario, svgPath = join(directory, `${stem}.svg`), pngPath = join(directory, `${stem}.png`), fileUrl = pathToFileURL(svgPath).href
  const ordered = syntheticSignedRenderOrder(download.expected)
  const reopened = ordered.map((entry, domOrdinal) => {
    const matrices = syntheticSignedMatrices(entry.rendered)
    return { domOrdinal, source: '', contour: structuredClone(entry.rendered.contour),
      nodeTransform: entry.rendered.nodeTransform, bodyTransform: entry.rendered.bodyTransform, errors: 0,
      screenCTM: structuredClone(matrices.contourScreenCTM), structure: syntheticSignedStructure(domOrdinal), matrices }
  })
  const zeroOrdinal = ordered.findIndex(({ id }) => id === 'signed-zero-axis'), ctm = reopened[zeroOrdinal].screenCTM, png = syntheticZeroPng(ctm)
  const root = { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }
  download.preExport = { url: 'http://localhost:5173/stratified-tikz/scripts/fixtures/freeLabelsApp.html', root, rootCount: 1, rootConnected: true, rootOwnerDocument: true,
    labelDocumentRevision: download.beforeExportState.labelDocumentRevision, runtime: structuredClone(download.click.snapshot.runtime),
    renderOrderProof: structuredClone(signedPointRenderOrderProof), points: ordered.map((entry, domOrdinal) => ({
      domOrdinal, id: entry.id, source: '', bodySource: '', shape: entry.shape, owner: entry.rendered.pointOwner,
      request: entry.rendered.pointRequest, bodyRequest: entry.rendered.bodyRequest, state: 'ready',
      nodeTransform: entry.rendered.nodeTransform, bodyTransform: entry.rendered.bodyTransform,
      structure: syntheticSignedStructure(domOrdinal), matrices: syntheticSignedMatrices(entry.rendered) })) }
  const measurement = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false, parserErrors: [],
    root: { ...root, bounds: { x: 0, y: 0, width: 520, height: 360 } }, viewport: { width: 1500, height: 1150 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 1 }
  download.capture = { status: 'saved', requestedPath: pngPath, retainedPath: pngPath, fileExists: true,
    options: { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 }, measurements: [measurement], before: measurement, after: structuredClone(measurement),
    coverage: { completeRoot: true, bounds: measurement.root.bounds, viewport: measurement.viewport }, coordinatesStable: true,
    png: { width: 1500, height: 1150, bytes: png.length } }
  download.strokePixels = observeZeroAxisPixels(png, ctm)
  download.outputs = Object.fromEntries(['standalone', 'inlineMath'].map((mode) => [mode,
    signedPolygonalCases.map(({ anchor }) => `\\node[anchor=${anchor}] {};`).join('\n') + '\n\\node[inner xsep=0pt,inner ysep=20pt] {};']))
  const raw = { scenario: stem, group: layoutAnchorGroup, result: 'observed', background: 'transparent', ambientDimension, savedJson: download.savedJson,
    preExport: structuredClone(download.preExport), expected: structuredClone(download.expected),
    click: structuredClone(download.click), beforeExportState: structuredClone(download.beforeExportState), capture: structuredClone(download.capture), strokePixels: structuredClone(download.strokePixels), outputs: download.outputs,
    svgPath, fileUrl, requests: [fileUrl], pageErrors: [], standaloneErrors: [], cleanupErrors: [], reopened,
    document: { root, rootAttributes: structuredClone(signedPointStandaloneRootAttributes), forbiddenCount: 0, externalReferences: [], backgroundCount: 0,
      inventory: { pathCount: 7, titleCount: 7, groupCount: 36, rootChildTags: ['g'],
        contourCandidates: reopened.map((actual) => ({ path: actual.structure.contourPath, parentPath: actual.structure.nodePath,
          parentTransform: actual.nodeTransform, siblingBodyCount: 1 })) }, frame: {
      url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', rootConnected: true, rootOwnerDocument: true,
      rootCTM: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, rootScreenCTM: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      rootBounds: { x: 0, y: 0, width: 520, height: 360 }, scroll: { x: 0, y: 0 }, viewport: { width: 1500, height: 1150 } } } }
  const svg = syntheticSignedSvg(raw)
  raw.xml = svg; raw.association = createSignedPointAssociationCandidate(raw)
  const zeroAxisCase = evidence.zeroAxisCases.find((entry) => entry.ambientDimension === ambientDimension)
  const livePng = syntheticZeroPng(zeroAxisCase.livePaint.ctm)
  zeroAxisCase.livePaint = observeZeroAxisPixels(livePng, zeroAxisCase.livePaint.ctm)
  const liveCaptureImage = zeroAxisCase.liveObservation.capture.image
  Object.assign(liveCaptureImage, { path: join(directory, `${stem}-live.png`), bytes: livePng.length, sha256: zeroAxisCase.livePaint.sha256,
    width: zeroAxisCase.livePaint.width, height: zeroAxisCase.livePaint.height })
  zeroAxisCase.liveObservation.pixels = structuredClone(zeroAxisCase.livePaint)
  const native = { scenario: signedPolygonalScenario, group: layoutAnchorGroup, result: 'observed',
    polygonalCases: evidence.polygonalCases.filter((entry) => entry.ambientDimension === ambientDimension), zeroAxisCase }
  writeFileSync(svgPath, svg); writeFileSync(pngPath, png); writeFileSync(join(directory, `${stem}-live.png`), livePng)
  writeFileSync(join(directory, `${stem}-native.json`), JSON.stringify(native))
  writeFileSync(join(directory, `${stem}-live-capture.json`), JSON.stringify(zeroAxisCase.liveObservation))
  writeFileSync(join(directory, `${stem}-saved.json`), download.savedJson)
  for (const [mode, source] of Object.entries(download.outputs)) writeFileSync(join(directory, `${stem}-${mode}.tex`), source)
  return { evidence, download, raw, native, png, livePng, svgPath, pngPath, zeroAxis: reopened[zeroOrdinal] }
}
function persistSyntheticSignedSvg(fixture) {
  fixture.raw.xml = syntheticSignedSvg(fixture.raw)
  writeFileSync(fixture.svgPath, fixture.raw.xml)
}
function rebindSyntheticSignedRequest(raw, id, change) {
  const expected = raw.expected.find((entry) => entry.id === id), captured = raw.click.snapshot.points.find((entry) => entry.id === id),
    observed = raw.preExport.points.find((entry) => entry.id === id)
  const request = JSON.parse(captured.request)
  change(request)
  const value = JSON.stringify(request)
  expected.rendered.pointRequest = value; expected.rendered.bodyRequest = value
  captured.request = value; captured.pointRequest = value; observed.request = value; observed.bodyRequest = value
}
for (const ambientDimension of [2, 3]) {
  test(`synthetic faithful ${ambientDimension}D stripped standalone authenticates owners independently of contour order`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-signed-correspondence-'), fixture = syntheticSignedStandalone(directory, ambientDimension),
      { evidence, download, raw } = fixture
    const modelOrder = ['signed-regular-polygon', 'signed-square', 'signed-triangle', 'signed-star', 'signed-isosceles-triangle', 'signed-dart', 'signed-zero-axis']
    const documentOrder = ['signed-dart', 'signed-isosceles-triangle', 'signed-regular-polygon', 'signed-square', 'signed-star', 'signed-triangle', 'signed-zero-axis']
    assert.deepEqual(raw.expected.map(({ id }) => id), modelOrder)
    assert.deepEqual(raw.click.snapshot.points.map(({ id }) => id), modelOrder)
    assert.deepEqual(JSON.parse(raw.savedJson).diagram.strata.map(({ id }) => id), modelOrder)
    assert.deepEqual(raw.preExport.points.map(({ id }) => id), documentOrder)
    assert.deepEqual(raw.reopened.map(({ domOrdinal }) => domOrdinal), [0, 1, 2, 3, 4, 5, 6])
    assert.equal(new Set(raw.reopened.map(({ nodeTransform }) => nodeTransform)).size, 7)
    for (const actual of raw.reopened) { assert.equal(actual.source, ''); assert.equal(Object.hasOwn(actual, 'id'), false); assert.equal(Object.hasOwn(actual, 'shape'), false) }
    assert.equal((raw.xml.match(/<title\/>/gu) ?? []).length, 7)
    assert.equal(/data-|aria-|signed-/.test(raw.xml), false, 'Exported SVG keeps genuinely stripped metadata and empty native titles')
    assert.throws(() => raw.reopened.forEach((actual, index) => assert.deepEqual(actual.contour, download.expected[index].rendered.contour)),
      'The old model-index/document-index pairing rejects this faithful fixture')
    const binding = assertSignedPointStandaloneAssociation(raw, raw.xml)
    assertSignedPointStandaloneGeometry(raw, binding)
    assert.deepEqual(binding.associations.map(({ expectedIndex }) => expectedIndex), [5, 4, 0, 1, 3, 2, 6])
    assert.equal(binding.zeroAxis, fixture.zeroAxis)
    assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, ambientDimension)
  })
}
const signedAssociationFaults = [
  ['missing-pre-export', (raw) => { delete raw.preExport }],
  ['wrong-App-pathname', (raw) => { raw.preExport.url = 'http://localhost:5173/foreign-App.html' }],
  ['missing-render-order-proof', (raw) => { delete raw.preExport.renderOrderProof }],
  ['changed-render-comparator-proof', (raw) => { raw.preExport.renderOrderProof.sha256 = '0'.repeat(64) }],
  ['missing-native-owner', (raw) => { raw.preExport.points.pop() }],
  ['duplicate-native-owner', (raw) => { raw.preExport.points[1] = structuredClone(raw.preExport.points[0]) }],
  ['foreign-native-owner', (raw) => { raw.preExport.points[0].id = 'foreign-point' }],
  ['altered-native-order', (raw) => { [raw.preExport.points[0], raw.preExport.points[1]] = [raw.preExport.points[1], raw.preExport.points[0]] }],
  ['altered-native-ordinal', (raw) => { raw.preExport.points[0].domOrdinal = 5 }],
  ['stale-native-revision', (raw) => { raw.preExport.labelDocumentRevision-- }],
  ['stale-native-owner', (raw) => { raw.preExport.points[0].owner = '["point-node",99,"signed-dart"]' }],
  ['stale-native-request', (raw) => { raw.preExport.points[0].request = 'previous-request' }],
  ['wrong-native-title', (raw) => { raw.preExport.points[0].source = 'foreign source' }],
  ['wrong-native-body-source', (raw) => { raw.preExport.points[0].bodySource = 'foreign source' }],
  ['coherent-request-stale-owner', (raw) => { rebindSyntheticSignedRequest(raw, 'signed-dart', (request) => { request[8] = '["point-node",99,"signed-dart"]' }) }],
  ['coherent-request-stale-font', (raw) => { rebindSyntheticSignedRequest(raw, 'signed-dart', (request) => { request[5]-- }) }],
  ['coherent-request-wrong-source', (raw) => { rebindSyntheticSignedRequest(raw, 'signed-dart', (request) => { request[0] = 'later source' }) }],
  ['stale-click-runtime', (raw) => { raw.click.snapshot.runtime.documentRevision-- }],
  ['edited-click-position', (raw) => { raw.click.snapshot.points[0].position.x++ }],
  ['edited-saved-model', (raw) => { const saved = JSON.parse(raw.savedJson); saved.diagram.strata[0].position.x++; raw.savedJson = JSON.stringify(saved) }],
  ['coherent-edited-fixture-position', (raw) => {
    const saved = JSON.parse(raw.savedJson)
    saved.diagram.strata[0].position.x++; raw.savedJson = JSON.stringify(saved)
    for (const state of [raw.beforeExportState, raw.click.snapshot]) {
      const envelope = JSON.parse(state.json), runtime = JSON.parse(state.runtimeDiagramJson), history = JSON.parse(state.history)
      envelope.diagram.strata[0].position.x++; runtime.strata[0].position.x++; history.present.strata[0].position.x++
      state.json = JSON.stringify(envelope); state.runtimeDiagramJson = JSON.stringify(runtime); state.history = JSON.stringify(history)
    }
    raw.expected[0].modelPoint.position.x++; raw.click.snapshot.points[0].position.x++
  }],
  ['coherent-foreign-owner', (raw) => {
    const foreignId = 'foreign-dart', oldId = 'signed-dart', saved = JSON.parse(raw.savedJson)
    const remap = (diagram) => { diagram.strata.find(({ id }) => id === oldId).id = foreignId }
    remap(saved.diagram); raw.savedJson = JSON.stringify(saved)
    for (const state of [raw.beforeExportState, raw.click.snapshot]) {
      const envelope = JSON.parse(state.json), runtime = JSON.parse(state.runtimeDiagramJson), history = JSON.parse(state.history)
      remap(envelope.diagram); remap(runtime); remap(history.present)
      state.json = JSON.stringify(envelope); state.runtimeDiagramJson = JSON.stringify(runtime); state.history = JSON.stringify(history)
    }
    const expected = raw.expected.find(({ id }) => id === oldId), captured = raw.click.snapshot.points.find(({ id }) => id === oldId),
      observed = raw.preExport.points.find(({ id }) => id === oldId), owner = JSON.stringify(['point-node', 100, foreignId])
    expected.id = foreignId; expected.modelPoint.id = foreignId; expected.rendered.pointOwner = owner
    captured.id = foreignId; captured.owner = owner; observed.id = foreignId; observed.owner = owner
    rebindSyntheticSignedRequest(raw, foreignId, (request) => { request[8] = owner })
  }],
  ['missing-actual-group', (raw) => { raw.reopened.pop() }],
  ['duplicate-actual-group', (raw) => { raw.reopened[1] = structuredClone(raw.reopened[0]) }],
  ['foreign-actual-placement', (raw) => { raw.reopened[0].nodeTransform = 'translate(42 42)' }],
  ['ambiguous-native-placement', (raw) => { raw.preExport.points[1].nodeTransform = raw.preExport.points[0].nodeTransform }],
  ['altered-actual-ordinal', (raw) => { raw.reopened[0].domOrdinal = 1 }],
  ['altered-actual-order', (raw) => { [raw.reopened[0], raw.reopened[1]] = [raw.reopened[1], raw.reopened[0]] }],
  ['derived-wrong-id', (raw) => { raw.association.associations[0].expectedId = 'signed-square' }],
  ['derived-wrong-index', (raw) => { raw.association.associations[0].expectedIndex = 0 }],
  ['derived-wrong-ordinal', (raw) => { raw.association.associations[0].actualDomOrdinal = 1 }],
  ['disconnected-actual-group', (raw) => { raw.reopened[0].structure.connected.node = false }],
  ['foreign-actual-root', (raw) => { raw.reopened[0].structure.currentRoot.contour = false }],
  ['wrong-body-ownership', (raw) => { raw.reopened[0].structure.bodyPath = raw.reopened[1].structure.bodyPath }],
  ['wrong-contour-ownership', (raw) => { raw.reopened[0].structure.contourPath = raw.reopened[1].structure.contourPath }],
  ['copied-native-shape', (raw) => { raw.reopened[0].shape = raw.expected[0].shape }],
  ['foreign-untitled-contour-candidate', (raw) => { raw.document.inventory.contourCandidates.push({ path: [0, 7, 0], parentPath: [0, 7], parentTransform: 'translate(40 40)', siblingBodyCount: 0 }); raw.document.inventory.pathCount++ }],
  ['missing-file-group-inventory', (raw) => { delete raw.document.inventory }],
  ['stale-reopened-frame-viewport', (raw) => { raw.document.frame.viewport.width-- }],
  ['zero-missing-association', (raw) => { raw.association.associations = raw.association.associations.filter(({ expectedId }) => expectedId !== 'signed-zero-axis') }],
  ['zero-duplicate-association', (raw) => { raw.association.associations.push(structuredClone(raw.association.associations.find(({ expectedId }) => expectedId === 'signed-zero-axis'))) }],
  ['zero-foreign-association', (raw) => { raw.association.associations.find(({ expectedId }) => expectedId === 'signed-zero-axis').actualDomOrdinal = 0 }],
  ['zero-stale-screen-ctm', (raw) => { findSignedZeroAxisAssociation(raw.reopened, raw.association).screenCTM.e += 5 }],
  ['zero-nonfinite-screen-ctm', (raw) => { findSignedZeroAxisAssociation(raw.reopened, raw.association).screenCTM.e = Infinity }],
  ['zero-singular-screen-ctm', (raw) => { findSignedZeroAxisAssociation(raw.reopened, raw.association).screenCTM.a = 0 }],
  ['zero-foreign-screen-ctm', (raw) => { findSignedZeroAxisAssociation(raw.reopened, raw.association).screenCTM = structuredClone(raw.reopened[0].screenCTM) }],
]
for (const [fault, mutate] of signedAssociationFaults) {
  test(`synthetic authenticated standalone association rejects ${fault} before geometry or pixel replay`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-signed-association-fault-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
    mutate(raw)
    assert.throws(() => assertSignedPointStandaloneAssociation(raw, raw.xml))
    fixture.download.preExport = structuredClone(raw.preExport)
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(fixture.evidence, raw, directory, 2))
  })
}
for (const fault of ['swapped-geometry', 'wrong-paint', 'wrong-body-transform', 'wrong-anchor-transform']) {
  test(`synthetic authenticated standalone owner placements cannot conceal ${fault}`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-signed-owned-geometry-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
    if (fault === 'swapped-geometry') [raw.reopened[0].contour, raw.reopened[1].contour] = [raw.reopened[1].contour, raw.reopened[0].contour]
    if (fault === 'wrong-paint') raw.reopened[0].contour.attributes.stroke = '#000000'
    if (fault === 'wrong-body-transform') raw.reopened[0].bodyTransform = 'translate(0 0)'
    if (fault === 'wrong-anchor-transform') raw.reopened[0].contour.attributes.transform = 'translate(0 0)'
    for (const actual of raw.reopened) {
      actual.matrices = syntheticSignedMatrices(actual); actual.screenCTM = structuredClone(actual.matrices.contourScreenCTM)
    }
    persistSyntheticSignedSvg(fixture)
    const binding = assertSignedPointStandaloneAssociation(raw, raw.xml)
    assert.throws(() => assertSignedPointStandaloneGeometry(raw, binding), 'Owner association cannot consume the contour/body attribute under test')
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(fixture.evidence, raw, directory, 2))
  })
}
for (const fault of ['swapped-file-contours', 'swapped-file-bodies']) {
  test(`synthetic parent file-local replay rejects ${fault} while every attribute value remains in XML`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-signed-file-local-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
    const original = raw.xml, changed = structuredClone(raw)
    if (fault === 'swapped-file-contours') [changed.reopened[0].contour, changed.reopened[1].contour] = [changed.reopened[1].contour, changed.reopened[0].contour]
    if (fault === 'swapped-file-bodies') [changed.reopened[0].bodyTransform, changed.reopened[1].bodyTransform] = [changed.reopened[1].bodyTransform, changed.reopened[0].bodyTransform]
    raw.xml = syntheticSignedSvg(changed); writeFileSync(fixture.svgPath, raw.xml)
    const attributes = (xml) => [...xml.matchAll(/\s[\w-]+="[^"]*"/gu)].map(([value]) => value).sort()
    assert.deepEqual(attributes(raw.xml), attributes(original), 'A global attribute-presence/multiset check would accept the corrupt file')
    const binding = assertSignedPointStandaloneAssociation(raw)
    assertSignedPointStandaloneGeometry(raw, binding)
    assert.throws(() => assertSignedPointStandaloneAssociation(raw, raw.xml), 'Parent reconstructs actual title/body/path structural ownership from the exact file')
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(fixture.evidence, raw, directory, 2))
  })
}
test('synthetic zero-axis pixel lookup follows derived owner ordinal while canonical raw order still rejects reordered observations', (t) => {
  const directory = syntheticPolicyDirectory(t, 'stz-signed-bound-zero-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
  const reordered = [fixture.zeroAxis, ...raw.reopened.filter((actual) => actual !== fixture.zeroAxis)]
  assert.notEqual(reordered.at(-1), fixture.zeroAxis)
  assert.equal(findSignedZeroAxisAssociation(reordered, raw.association), fixture.zeroAxis)
  assert.deepEqual(observeZeroAxisPixels(fixture.png, findSignedZeroAxisAssociation(reordered, raw.association).screenCTM), raw.strokePixels)
  assert.throws(() => assertZeroAxisPixelEvidence(observeZeroAxisPixels(fixture.png, reordered.at(-1).screenCTM)), 'The final raw entry belongs to a different projected point')
  raw.reopened = reordered
  assert.throws(() => assertSignedPointStandaloneAssociation(raw, raw.xml), 'The isolated lookup never relaxes required real SVG document order')
  assert.throws(() => assertSignedPolygonalStandaloneEvidence(fixture.evidence, raw, directory, 2))
})
test('synthetic exact-file replay rejects a foreign untitled painted group even with all seven authenticated titles', (t) => {
  const directory = syntheticPolicyDirectory(t, 'stz-signed-foreign-file-group-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
  raw.xml = raw.xml.replace('</svg>', '<g transform="translate(40 40)"><path d="M 0 0 L 1 1" stroke="#203040"/></g></svg>')
  writeFileSync(fixture.svgPath, raw.xml)
  assert.equal((raw.xml.match(/<title\/>/gu) ?? []).length, 7)
  assertSignedPointStandaloneGeometry(raw)
  assert.throws(() => assertSignedPointStandaloneAssociation(raw, raw.xml))
  assert.throws(() => assertSignedPolygonalStandaloneEvidence(fixture.evidence, raw, directory, 2))
})
for (const fault of ['root-transform', 'root-CSS-transform', 'root-opacity']) {
  test(`synthetic caller and parent reject ${fault} with otherwise unchanged geometry and PNG evidence`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-signed-root-identity-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
    const before = structuredClone(raw), rootAttributes = structuredClone(raw.document.rootAttributes)
    if (fault === 'root-transform') rootAttributes.transform = 'translate(5 0)'
    if (fault === 'root-CSS-transform') rootAttributes.style += 'transform:translate(5px,0);'
    if (fault === 'root-opacity') rootAttributes.opacity = '0'
    raw.xml = syntheticSignedSvg({ ...raw, document: { ...raw.document, rootAttributes } })
    writeFileSync(fixture.svgPath, raw.xml)
    assert.deepEqual(raw.document, before.document)
    assert.deepEqual(raw.reopened, before.reopened)
    assert.deepEqual(raw.capture, before.capture); assert.deepEqual(raw.strokePixels, before.strokePixels)
    assertSignedPointStandaloneGeometry(raw)
    assert.throws(() => assertSignedPointStandaloneAssociation(raw, raw.xml), 'Exact parsed root attributes bind all native CTMs to the downloaded SVG root')
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(fixture.evidence, raw, directory, 2))
    raw.document.rootAttributes = rootAttributes
    const candidate = createSignedPointAssociationCandidate(raw)
    assert.ok(candidate.failureReasons.some(({ reason }) => reason === 'document-root-attributes'))
    assert.throws(() => assertSignedPointStandaloneAssociation(raw), 'Caller authenticates fresh native root attributes before image work')
  })
}
test('synthetic unassignable standalone candidate persists raw owners and association reasons before bounded rejection and image work', async (t) => {
  const directory = syntheticPolicyDirectory(t, 'stz-signed-unassignable-candidate-'), fixture = syntheticSignedStandalone(directory), { raw } = fixture
  unlinkSync(fixture.pngPath)
  const details = structuredClone(raw)
  for (const field of ['capture', 'strokePixels', 'reopened', 'document', 'association', 'result', 'requests', 'standaloneErrors', 'cleanupErrors']) delete details[field]
  const reopened = structuredClone(raw.reopened), document = structuredClone(raw.document), listeners = new Map()
  reopened[0].nodeTransform = 'translate(999 999)'
  document.inventory.contourCandidates[0].parentTransform = reopened[0].nodeTransform
  const observation = { reopened, document }
  observation.association = createSignedPointAssociationCandidate({ ...details, ...observation })
  assert.ok(observation.association.failureReasons.some(({ reason }) => reason === 'missing-duplicate-foreign-or-ambiguous-owner-placement'))
  let captures = 0, closed = 0, beforeAssertion
  const standalone = {
    on: (type, listener) => listeners.set(type, listener), off: (type) => listeners.delete(type),
    goto: async (url) => listeners.get('request')({ url: () => url }), close: async () => { closed++ },
    screenshot: async () => { captures++; return fixture.png },
  }
  await assert.rejects(capturePointLayoutStandalone({ standalone, artifactDir: directory, details,
    reopen: async () => observation, observe: async () => {}, assertReopened: (candidate) => {
      beforeAssertion = JSON.parse(readFileSync(join(directory, `${raw.scenario}-standalone.json`), 'utf8'))
      return assertSignedPointStandaloneAssociation(candidate, raw.xml)
    } }), /Every actual group has one current authenticated unique owner/u)
  assert.deepEqual(beforeAssertion.reopened, reopened)
  assert.deepEqual(beforeAssertion.association, observation.association)
  assert.equal(beforeAssertion.capture, undefined)
  const retained = JSON.parse(readFileSync(join(directory, `${raw.scenario}-standalone.json`), 'utf8'))
  assert.deepEqual(retained.reopened, reopened); assert.deepEqual(retained.association, observation.association)
  assert.match(retained.error.message, /Every actual group/u)
  assert.deepEqual(retained.cleanupErrors, []); assert.equal(retained.capture, undefined)
  assert.equal(captures, 0); assert.equal(closed, 1); assert.equal(listeners.size, 0)
  assert.equal(existsSync(fixture.pngPath), false, 'Association failure retains no new standalone PNG or cleanup screenshot')
})
test('synthetic malformed owner inputs retain association failure reasons without consuming or rewriting reopened candidates', (t) => {
  const directory = syntheticPolicyDirectory(t, 'stz-signed-malformed-owners-'), { raw } = syntheticSignedStandalone(directory)
  for (const corrupt of [
    (input) => { delete input.expected[0].modelPoint },
    (input) => { input.expected = { invalid: 'non-array owners' } },
    (input) => { input.preExport.points = { invalid: 'non-array observations' } },
  ]) {
    const input = structuredClone(raw), before = structuredClone(input.reopened)
    corrupt(input)
    let candidate
    assert.doesNotThrow(() => { candidate = createSignedPointAssociationCandidate(input) })
    assert.ok(candidate.failureReasons.length > 0)
    assert.deepEqual(input.reopened, before, 'Native document ordinals, raw sources, contours, ownership paths and matrices remain available to failure persistence')
    assert.equal(input.reopened.length, 7)
  }
})
for (const captureMode of ['restored-expanded-obstruction', 'inherited-collapsed', 'clear-expanded']) {
  test(`synthetic full-stroke live capture ${captureMode} preserves separate native picking and complete parent raw evidence`, (t) => {
    for (const ambientDimension of [2, 3]) {
      const directory = syntheticPolicyDirectory(t, 'stz-zero-capture-policy-')
      const options = { inheritedCollapsed: captureMode === 'inherited-collapsed', clearExpanded: captureMode === 'clear-expanded' }
      const { evidence, raw, native } = syntheticSignedStandalone(directory, ambientDimension, 'background', options)
      const zero = native.zeroAxisCase, live = zero.liveObservation, capture = live.capture
      for (const action of zero.axisInteraction.actions) {
        assert.equal(action.before.toolbar.collapsed, true, 'Earlier native input remains separately prepared and proven')
        assertZeroAxisNativeAction(action)
      }
      assert.equal(capture.inherited.toolbar.collapsed, options.inheritedCollapsed)
      assert.equal(capture.restoration.after.toolbar.collapsed, options.inheritedCollapsed)
      assert.ok(capture.prepared.at > capture.inherited.at && live.afterSnapshot.at > capture.prepared.at
        && capture.restoration.after.at > capture.restoration.before.at, 'Every image boundary retains a separate fresh observation')
      assert.equal(capture.image.attempts, 1); assert.equal(capture.image.frame.viewport.scrollY, 129)
      assert.deepEqual(capture.image.frame.ctm, live.snapshot.geometry.contour.screenCTM, 'screenCTM already includes retained page scroll')
      if (captureMode === 'restored-expanded-obstruction') {
        assert.equal(zero.axisInteraction.toolbarRestoration.after.toolbar.collapsed, false)
        assert.equal(capture.decision.action, 'collapse'); assert.equal(capture.actions.length, 1)
        assert.equal(capture.actions[0].controlName, 'Collapse preview toolbar')
        assert.equal(capture.restoration.actions[0].controlName, 'Expand preview toolbar')
        assert.ok(capture.inherited.captureGeometry.obstructions.length > 0)
        const upper = capture.inherited.captureGeometry.samples.find(({ local }) => local.x === 0 && local.y === -zeroAxisHalfExtent)
        assert.equal(upper.elementFromPoint.creationToolbar, true, 'The restored toolbar covers the independent upper extremum')
        assert.equal(capture.actions.filter(({ name }) => name === 'Select').length, 0)
      } else {
        assert.deepEqual(capture.decision, { action: 'none', reason: 'already-unobstructed', obstructions: [] })
        assert.deepEqual(capture.actions, []); assert.deepEqual(capture.restoration.actions, [])
      }
      assertZeroAxisLiveCapture(live, zero.axisInteraction, zero.livePaint)
      assertZeroAxisPixelEvidence(zero.livePaint)
      assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, ambientDimension)
    }
  })
}

const liveCaptureFaults = [
  ['missing-capture-lifecycle', (zero) => { delete zero.liveObservation.capture }],
  ['missing-entire-stroke-measurement', (zero) => { delete zero.liveObservation.capture.inherited.captureGeometry }],
  ['missing-collapse-control', (zero) => { zero.liveObservation.capture.inherited.captureGeometry.controls.collapse = [] }],
  ['wrong-collapse-control', (zero) => { zero.liveObservation.capture.inherited.captureGeometry.controls.collapse[0].element.ariaLabel = 'Select' }],
  ['duplicate-collapse-control', (zero) => { const controls = zero.liveObservation.capture.inherited.captureGeometry.controls.collapse; controls.push(structuredClone(controls[0])) }],
  ['foreign-current-root', (zero) => { zero.liveObservation.capture.inherited.canvasObservation.root.currentCanvasRoot = false }],
  ['stale-owner', (zero) => { zero.liveObservation.capture.inherited.layout.owner = '["point-node",99,"zero-overlap"]' }],
  ['stale-body-request', (zero) => { zero.liveObservation.capture.inherited.layout.bodyRequest = 'stale-request' }],
  ['stale-revision', (zero) => { zero.liveObservation.capture.inherited.labelDocumentRevision++ }],
  ['singular-current-CTM', (zero) => { zero.liveObservation.capture.prepared.geometry.canvas.screenCTM.a = 0 }],
  ['foreign-current-CTM', (zero) => { zero.liveObservation.capture.prepared.captureGeometry.current.geometry.contour.screenCTM.e += 10 }],
  ['endpoint-outside-viewport', (zero) => { const snapshot = zero.liveObservation.capture.prepared;
    snapshot.viewport.height = 300; snapshot.captureGeometry.frame.viewport.height = 300 }],
  ['endpoint-outside-canvas', (zero) => { const snapshot = zero.liveObservation.capture.prepared;
    snapshot.geometry.canvas.bounds.height = 170; snapshot.captureGeometry.current.geometry.canvas.bounds.height = 170 }],
  ['unsupported-visual-viewport', (zero) => { zero.liveObservation.capture.prepared.viewport.visual.offsetTop = 129 }],
  ['omitted-upper-footprint', (zero) => { zero.liveObservation.capture.prepared.captureGeometry.footprint.bounds.y += 16 }],
  ['missing-full-stroke-hit-stack', (zero) => { zero.liveObservation.capture.prepared.captureGeometry.samples.pop() }],
  ['clear-point-23-covered-extremum', (zero) => {
    const snapshot = zero.liveObservation.capture.prepared, geometry = snapshot.captureGeometry,
      upper = geometry.samples.find(({ local }) => local.x === 0 && local.y === -zeroAxisHalfExtent)
    assert.notDeepEqual(upper.screen, snapshot.geometry.contour.boundary)
    assert.equal(snapshot.geometry.contour.boundary.y > upper.screen.y + 3, true, 'The original .23 target is clear below this obstruction')
    const element = syntheticCaptureElement(snapshot.canvasObservation, { toolbar: true })
    geometry.overlays.push({ kind: 'toolbar', element, bounds: { x: upper.screen.x - 2, y: upper.screen.y - 1, width: 4, height: 3 },
      visible: true, painted: true, intersects: true })
    refreshSyntheticCaptureObstruction(snapshot)
  }],
  ['toolbar-paint-remains-after-collapse', (zero) => { const snapshot = zero.liveObservation.capture.prepared;
    snapshot.captureGeometry.overlays.push({ kind: 'toolbar', element: syntheticCaptureElement(snapshot.canvasObservation, { toolbar: true }),
      bounds: { x: 51, y: 138, width: 1350, height: 42 }, visible: true, painted: true, intersects: true })
    refreshSyntheticCaptureObstruction(snapshot) }],
  ['collapsed-floating-toolbar-not-detached', (zero) => { const snapshot = zero.liveObservation.capture.prepared;
    snapshot.captureGeometry.overlays.push({ kind: 'toolbar', element: syntheticCaptureElement(snapshot.canvasObservation, { toolbar: true, tag: 'section' }),
      bounds: { x: 51, y: 138, width: 1350, height: 42 }, visible: true, painted: true, intersects: true })
    refreshSyntheticCaptureObstruction(snapshot) }],
  ['foreign-UI-first-hit', (zero) => { const sample = zero.liveObservation.capture.prepared.captureGeometry.samples[0],
    element = syntheticCaptureElement(zero.liveObservation.capture.prepared.canvasObservation);
    sample.elementFromPoint = element; sample.elementsFromPoint[0] = structuredClone(element) }],
  ['foreign-label-current-canvas-first-hit', (zero) => { const geometry = zero.liveObservation.capture.prepared.captureGeometry,
    sample = geometry.samples[0], element = { ...structuredClone(sample.elementFromPoint), pointId: null, tag: 'text' };
    sample.elementFromPoint = element; sample.elementsFromPoint[0] = structuredClone(element)
    geometry.obstructions = [{ kind: 'hit-stack', index: 0 }] }],
  ['history-covers-endpoint', (zero) => { const snapshot = zero.liveObservation.capture.prepared, endpoint = snapshot.captureGeometry.endpoints[0];
    snapshot.captureGeometry.overlays.find(({ kind }) => kind === 'history').bounds = { x: endpoint.x - 2, y: endpoint.y - 2, width: 4, height: 4 }
    refreshSyntheticCaptureObstruction(snapshot) }],
  ['quick-style-covers-endpoint', (zero) => { const snapshot = zero.liveObservation.capture.prepared, endpoint = snapshot.captureGeometry.endpoints[0];
    snapshot.captureGeometry.overlays.push({ kind: 'quick-style', element: syntheticCaptureElement(snapshot.canvasObservation, { toolbar: true }),
      bounds: { x: endpoint.x - 2, y: endpoint.y - 2, width: 4, height: 4 }, visible: true, painted: true, intersects: true }); refreshSyntheticCaptureObstruction(snapshot) }],
  ['selection-decoration-covers-endpoint', (zero) => { const snapshot = zero.liveObservation.capture.prepared, endpoint = snapshot.captureGeometry.endpoints[0];
    snapshot.captureGeometry.overlays.push({ kind: 'selection-decoration', element: { ...syntheticCaptureElement(snapshot.canvasObservation), pointHandle: true },
      bounds: { x: endpoint.x - 2, y: endpoint.y - 2, width: 4, height: 4 }, visible: true, painted: true, intersects: true }); refreshSyntheticCaptureObstruction(snapshot) }],
  ['changed-model', (zero) => { const state = zero.liveObservation.capture.preparedState, runtime = JSON.parse(state.runtimeDiagramJson);
    runtime.strata[0].position.x++; state.runtimeDiagramJson = JSON.stringify(runtime) }],
  ['changed-history', (zero) => { zero.liveObservation.capture.preparedState.history += ' ' }],
  ['changed-selection', (zero) => { zero.liveObservation.capture.actions[0].stateAfter.selection = { kind: 'stratum', id: 'app-point' } }],
  ['changed-UI-settings', (zero) => { zero.liveObservation.capture.actions[0].stateAfter.uiSettings = '{"changed":true}' }],
  ['missing-native-collapse', (zero) => { zero.liveObservation.capture.actions = [] }],
  ['fabricated-native-collapse', (zero) => { zero.liveObservation.capture.actions[0].controlCount = 0 }],
  ['extra-Select-action', (zero) => { zero.liveObservation.capture.actions.push({ ...structuredClone(zero.liveObservation.capture.actions[0]), name: 'Select' }) }],
  ['post-image-viewport-changed', (zero) => { zero.liveObservation.afterSnapshot.viewport.scrollY++ }],
  ['post-image-point-CTM-changed', (zero) => { zero.liveObservation.afterSnapshot.geometry.point.screenCTM.e++ }],
  ['image-frame-origin-shifted', (zero) => { zero.liveObservation.capture.image.frame.origin.y = 129 }],
  ['image-frame-scroll-subtracted-twice', (zero) => { zero.liveObservation.capture.image.frame.ctm.f -= 129 }],
  ['second-image-attempt', (zero) => { zero.liveObservation.capture.image.attempts = 2 }],
  ['image-byte-record-altered', (zero) => { zero.liveObservation.capture.image.bytes++ }],
  ['absent-capture-restoration', (zero) => { delete zero.liveObservation.capture.restoration }],
  ['failed-capture-restoration', (zero) => { zero.liveObservation.capture.restoration.error = { message: 'controlled native expansion failure' } }],
  ['inherited-toolbar-unrestored', (zero) => { zero.liveObservation.capture.restoration.after.toolbar.collapsed = true }],
  ['inherited-viewport-scroll-unrestored', (zero) => { const restoration = zero.liveObservation.capture.restoration;
    for (const snapshot of [restoration.actions[0].after, restoration.after]) {
      snapshot.viewport.scrollY++; snapshot.captureGeometry.frame.viewport.scrollY++
    } }],
  ['leaked-owned-observer', (zero) => { zero.liveObservation.capture.cleanup.observerRegistries.zeroAxisCapture = { present: true, size: 1 } }],
  ['leaked-owned-listener', (zero) => { zero.liveObservation.capture.cleanup.listenersInstalled = 1 }],
  ['missing-Alt-cleanup', (zero) => { delete zero.liveObservation.capture.cleanup.altKeyUp }],
]
for (const [index, [fault, mutate]] of liveCaptureFaults.entries()) {
  test(`synthetic full-stroke live capture direct and complete parent raw policy rejects ${fault}`, (t) => {
    const ambientDimension = index % 2 === 0 ? 2 : 3
    const directory = syntheticPolicyDirectory(t, 'stz-zero-capture-policy-')
    const { evidence, raw, native, download } = syntheticSignedStandalone(directory, ambientDimension)
    mutate(native.zeroAxisCase)
    if (['clear-point-23-covered-extremum', 'toolbar-paint-remains-after-collapse', 'foreign-label-current-canvas-first-hit', 'history-covers-endpoint',
      'quick-style-covers-endpoint', 'selection-decoration-covers-endpoint'].includes(fault)) {
      const capture = native.zeroAxisCase.liveObservation.capture
      assertZeroAxisCaptureSnapshot(capture.preparedState, capture.prepared)
      assert.throws(() => assertZeroAxisCaptureSnapshot(capture.preparedState, capture.prepared, { requireClear: true }), /unobstructed/)
    }
    assert.throws(() => assertZeroAxisLiveCapture(native.zeroAxisCase.liveObservation, native.zeroAxisCase.axisInteraction, native.zeroAxisCase.livePaint))
    writeFileSync(join(directory, `${download.scenario}-native.json`), JSON.stringify(native))
    writeFileSync(join(directory, `${download.scenario}-live-capture.json`), JSON.stringify(native.zeroAxisCase.liveObservation))
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, ambientDimension))
  })
}
for (const fault of ['missing-live-capture-raw', 'raw-live-capture-disagrees', 'truncated-live-PNG', 'blank-live-PNG', 'short-stroke-live-PNG']) {
  test(`synthetic full-stroke live capture complete file policy rejects ${fault}`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-zero-capture-file-policy-')
    const { evidence, raw, native, download, livePng } = syntheticSignedStandalone(directory, 3), stem = download.scenario,
      capturePath = join(directory, `${stem}-live-capture.json`)
    if (fault === 'missing-live-capture-raw') unlinkSync(capturePath)
    if (fault === 'raw-live-capture-disagrees') { const observation = structuredClone(native.zeroAxisCase.liveObservation);
      observation.capture.decision.reason = 'fabricated-clear'; writeFileSync(capturePath, JSON.stringify(observation)) }
    if (fault === 'truncated-live-PNG') writeFileSync(join(directory, `${stem}-live.png`), livePng.subarray(0, 33))
    if (fault === 'blank-live-PNG' || fault === 'short-stroke-live-PNG') {
      const zero = native.zeroAxisCase, png = syntheticZeroPng(zero.livePaint.ctm, fault !== 'blank-live-PNG', 20)
      zero.livePaint = observeZeroAxisPixels(png, zero.livePaint.ctm); zero.liveObservation.pixels = structuredClone(zero.livePaint)
      Object.assign(zero.liveObservation.capture.image, { bytes: png.length, sha256: zero.livePaint.sha256 })
      assert.throws(() => assertZeroAxisPixelEvidence(zero.livePaint), 'Complete geometry cannot waive absent/short native raster paint')
      writeFileSync(join(directory, `${stem}-live.png`), png); writeFileSync(join(directory, `${stem}-native.json`), JSON.stringify(native))
      writeFileSync(capturePath, JSON.stringify(zero.liveObservation))
    }
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, 3))
  })
}

function syntheticLiveWorkflow(t, { ambientDimension = 2, inheritedCollapsed = false, clearExpanded = false,
  failScreenshot, failPixelAssertion, failRetain, failRestoration, failMeasurement, shiftedPreparedFrame = false, duplicateNativeCollapse = false } = {}) {
  const directory = syntheticPolicyDirectory(t, 'stz-zero-capture-workflow-')
  const native = syntheticZeroNative(ambientDimension, 'background', { inheritedCollapsed, clearExpanded }),
    state = native.axisInteraction.toolbarRestoration.stateAfter, pngPath = join(directory, 'single-live.png'), live = {},
    calls = { controls: [], native: [], screenshots: [], retained: [], measures: 0, resourceObservations: 0 }
  let collapsed = inheritedCollapsed
  const page = {
    getByRole(role, options) {
      assert.equal(role, 'button'); assert.equal(options.exact, true)
      assert.ok(['Collapse preview toolbar', 'Expand preview toolbar'].includes(options.name), 'Capture never selects another owner or tool')
      calls.controls.push(options.name)
      const expected = () => options.name === `${collapsed ? 'Expand' : 'Collapse'} preview toolbar`
      return { count: async () => Number(expected()) * (duplicateNativeCollapse && options.name === 'Collapse preview toolbar' ? 2 : 1),
        waitFor: async (wait) => { assert.deepEqual(wait, { state: 'visible', timeout: 5000 }); assert.equal(expected(), true) },
        click: async (click) => {
          assert.deepEqual(click, { timeout: 5000 }, 'Capture uses one normal native control gesture without force')
          assert.equal(expected(), true); calls.native.push(options.name)
          if (options.name === 'Expand preview toolbar' && failRestoration) throw failRestoration
          collapsed = options.name === 'Collapse preview toolbar'
        } }
    },
    locator(selector) { return { waitFor: async (options) => {
      assert.equal(options.timeout, 5000)
      if (selector === 'section.preview-floating-toolbar') assert.equal(options.state, collapsed ? 'detached' : 'visible')
      else { assert.equal(selector, `.preview-toolbar-overlay-stack${collapsed ? '.is-collapsed' : ':not(.is-collapsed)'}`); assert.equal(options.state, 'visible') }
    } } },
    async screenshot(options) {
      calls.screenshots.push(structuredClone(options))
      assert.deepEqual(options, { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 })
      assert.equal(calls.retained.at(-1).boundary, 'single-image-attempt', 'Fresh geometry and single image intent precede screenshot bytes')
      assert.equal(live.snapshot.toolbar.collapsed, inheritedCollapsed || !clearExpanded)
      if (failScreenshot) throw failScreenshot
      const png = syntheticZeroPng(live.snapshot.geometry.contour.screenCTM)
      writeFileSync(pngPath, png); return png
    },
    async evaluate() { calls.resourceObservations++; return structuredClone(native.liveObservation.capture.cleanup) },
  }
  const measure = async () => {
    calls.measures++
    if (calls.measures === failMeasurement?.at) throw failMeasurement.error
    const base = structuredClone(native.axisInteraction.actions.at(-1).after)
    if (shiftedPreparedFrame && collapsed && !inheritedCollapsed) {
      for (const kind of ['canvas', 'point', 'contour']) base.geometry[kind].screenCTM.f += 9
      base.geometry.canvas.bounds = { x: 43, y: 139.375, width: 1414, height: 1018 }
      for (const entry of base.coincidentContours) { entry.pointScreenCTM.f += 9; entry.contour.screenCTM.f += 9 }
    }
    const snapshot = syntheticZeroCaptureSnapshot(base, state, collapsed, clearExpanded)
    snapshot.at = 1000 + calls.measures
    assertZeroAxisCaptureSnapshot(state, snapshot)
    return { state: structuredClone(state), snapshot }
  }
  const retain = async (boundary, record) => {
    calls.retained.push({ boundary, record: structuredClone(record) })
    if (boundary === failRetain?.boundary) throw failRetain.error
  }
  const args = { page, measure, retain, pngPath, interaction: native.axisInteraction, live, inspect: observeZeroAxisPixels,
    assertPixels(pixels) { assertZeroAxisPixelEvidence(pixels); if (failPixelAssertion) throw failPixelAssertion } }
  return { args, calls, native, live, isCollapsed: () => collapsed }
}
for (const mode of ['measured-collapse', 'inherited-collapsed', 'clear-expanded']) {
  test(`synthetic native live lifecycle ${mode} takes one complete image with owned restoration and independent measurements`, async (t) => {
    const fixture = syntheticLiveWorkflow(t, { ambientDimension: mode === 'inherited-collapsed' ? 3 : 2,
      inheritedCollapsed: mode === 'inherited-collapsed', clearExpanded: mode === 'clear-expanded' })
    const result = await captureZeroAxisLive(fixture.args)
    assert.equal(result, fixture.live); assert.equal(fixture.calls.screenshots.length, 1)
    assert.deepEqual(fixture.calls.native, mode === 'measured-collapse' ? ['Collapse preview toolbar', 'Expand preview toolbar'] : [])
    assert.equal(fixture.isCollapsed(), mode === 'inherited-collapsed'); assert.equal(fixture.calls.resourceObservations, 1)
    assert.ok(result.snapshot.at < result.afterSnapshot.at && result.afterSnapshot.at < result.capture.restoration.before.at
      && result.capture.restoration.before.at < result.capture.restoration.after.at)
    const retainedBytes = fixture.calls.retained.find(({ boundary }) => boundary === 'bytes-before-inspection').record
    assert.equal(retainedBytes.pixels, undefined, 'Raw image path/bytes/hash/dimensions precede pixel inspection')
    assert.equal(retainedBytes.capture.image.bytes, result.pixels.bytes)
    assert.equal(retainedBytes.capture.image.sha256, result.pixels.sha256)
    assert.deepEqual(result.capture.cleanup, fixture.native.liveObservation.capture.cleanup)
  })
}
test('synthetic native live lifecycle binds a changed native preparation frame to one image and restores the original frame', async (t) => {
  const fixture = syntheticLiveWorkflow(t, { ambientDimension: 3, shiftedPreparedFrame: true }), result = await captureZeroAxisLive(fixture.args)
  assert.equal(result.snapshot.geometry.contour.screenCTM.f, result.capture.inherited.geometry.contour.screenCTM.f + 9)
  assert.deepEqual(result.pixels.ctm, result.snapshot.geometry.contour.screenCTM)
  assert.deepEqual(result.capture.image.frame.ctm, result.snapshot.geometry.contour.screenCTM)
  assert.deepEqual(result.capture.restoration.after.geometry.contour.screenCTM, result.capture.inherited.geometry.contour.screenCTM)
  assert.equal(result.state.runtimeDiagramJson, result.capture.inheritedState.runtimeDiagramJson)
  assert.equal(fixture.calls.screenshots.length, 1); assert.deepEqual(fixture.calls.native, ['Collapse preview toolbar', 'Expand preview toolbar'])
})
test('synthetic native live lifecycle rejects actual duplicate controls before collapse or image input', async (t) => {
  const fixture = syntheticLiveWorkflow(t, { duplicateNativeCollapse: true })
  await assert.rejects(captureZeroAxisLive(fixture.args), /one unique native toolbar control/)
  assert.equal(fixture.calls.screenshots.length, 0); assert.deepEqual(fixture.calls.native, [])
  assert.equal(fixture.isCollapsed(), false); assert.equal(fixture.calls.resourceObservations, 1)
  assert.equal(fixture.live.capture.restoration.after.toolbar.collapsed, false)
})
for (const phase of ['screenshot', 'image-evidence', 'pixel-oracle']) {
  test(`synthetic native live lifecycle preserves exact primary ${phase} Error when native restoration also fails`, async (t) => {
    const primary = new Error(`controlled primary ${phase}`), secondary = new Error('controlled secondary native expand')
    const fixture = syntheticLiveWorkflow(t, { ambientDimension: 3, failRestoration: secondary,
      ...(phase === 'screenshot' ? { failScreenshot: primary } : phase === 'image-evidence'
        ? { failRetain: { boundary: 'bytes-before-inspection', error: primary } } : { failPixelAssertion: primary }) })
    await assert.rejects(captureZeroAxisLive(fixture.args), (error) => error === primary)
    assert.equal(isZeroAxisLiveCaptureFailure(primary), true, 'Outer failure diagnostics cannot add another screenshot')
    assert.equal(fixture.calls.screenshots.length, 1); assert.deepEqual(fixture.calls.native, ['Collapse preview toolbar', 'Expand preview toolbar'])
    assert.equal(fixture.live.capture.primary.message, primary.message)
    assert.ok(fixture.live.capture.secondaryErrors.some(({ message }) => message === secondary.message))
    assert.equal(fixture.live.capture.restoration.error.message, secondary.message)
    assert.equal(fixture.calls.resourceObservations, 1)
    assert.equal(Object.keys(primary).length, 0, 'Primary Error identity and properties remain owned by its original source')
  })
}
for (const boundary of ['before-restoration', 'restore-expand-before-native-action']) {
  test(`synthetic native live lifecycle still restores the inherited toolbar when ${boundary} evidence persistence fails`, async (t) => {
    const primary = new Error(`controlled ${boundary} persistence failure`), fixture = syntheticLiveWorkflow(t, { failRetain: { boundary, error: primary } })
    await assert.rejects(captureZeroAxisLive(fixture.args), (error) => error === primary)
    assert.equal(fixture.calls.screenshots.length, 1); assert.deepEqual(fixture.calls.native, ['Collapse preview toolbar', 'Expand preview toolbar'])
    assert.equal(fixture.isCollapsed(), false); assert.equal(fixture.calls.resourceObservations, 1)
    assert.equal(fixture.live.capture.primary.message, primary.message)
    assert.equal(fixture.live.capture.restoration.after.toolbar.collapsed, false)
  })
}
test('synthetic native live lifecycle preserves screenshot failure and completes restoration after cleanup evidence failure', async (t) => {
  const primary = new Error('controlled image failure'), cleanup = new Error('controlled cleanup evidence failure'),
    fixture = syntheticLiveWorkflow(t, { failScreenshot: primary, failRetain: { boundary: 'before-restoration', error: cleanup } })
  await assert.rejects(captureZeroAxisLive(fixture.args), (error) => error === primary)
  assert.equal(fixture.calls.screenshots.length, 1); assert.equal(fixture.isCollapsed(), false)
  assert.ok(fixture.live.capture.secondaryErrors.some(({ message }) => message === cleanup.message))
  assert.deepEqual(fixture.calls.native, ['Collapse preview toolbar', 'Expand preview toolbar']); assert.equal(fixture.calls.resourceObservations, 1)
})
test('synthetic native live lifecycle restores the actual toolbar after restoration measurement fails', async (t) => {
  const primary = new Error('controlled fresh cleanup measurement failure'),
    fixture = syntheticLiveWorkflow(t, { failMeasurement: { at: 5, error: primary } })
  await assert.rejects(captureZeroAxisLive(fixture.args), (error) => error === primary)
  assert.equal(fixture.calls.screenshots.length, 1); assert.equal(fixture.isCollapsed(), false)
  assert.deepEqual(fixture.calls.native, ['Collapse preview toolbar', 'Expand preview toolbar'])
  assert.equal(fixture.live.capture.primary.message, primary.message); assert.equal(fixture.calls.resourceObservations, 1)
  assert.equal(fixture.live.capture.restoration.after.toolbar.collapsed, false)
})
test('synthetic native live lifecycle retains a first final-evidence failure after complete actual restoration', async (t) => {
  const primary = new Error('controlled final restored evidence failure'),
    fixture = syntheticLiveWorkflow(t, { failRetain: { boundary: 'restored-after-image-attempt', error: primary } })
  await assert.rejects(captureZeroAxisLive(fixture.args), (error) => error === primary)
  assert.equal(fixture.calls.screenshots.length, 1); assert.equal(fixture.isCollapsed(), false)
  assert.equal(fixture.live.capture.primary.message, primary.message); assert.equal(isZeroAxisLiveCaptureFailure(primary), true)
  assert.deepEqual(fixture.calls.native, ['Collapse preview toolbar', 'Expand preview toolbar'])
})
for (const outsideTarget of ['background', 'root']) {
  test(`synthetic authenticated zero-axis ${outsideTarget} accepts fresh actions and complete parent raw records in both dimensions`, (t) => {
    for (const ambientDimension of [2, 3]) {
      const directory = syntheticPolicyDirectory(t, 'stz-zero-outside-policy-')
      const { evidence, raw } = syntheticSignedStandalone(directory, ambientDimension, outsideTarget)
      const zero = evidence.zeroAxisCases.find((entry) => entry.ambientDimension === ambientDimension)
      for (const action of zero.axisInteraction.actions) {
        assertFreshZeroAxisAction(action); assertZeroAxisNativeAction(action)
      }
      const outside = zero.axisInteraction.actions[0]
      assert.equal(outside.before.elementFromPoint.canvasRoot, outsideTarget === 'root')
      assert.equal(outside.before.elementFromPoint.svgBackgroundAttribute, outsideTarget === 'root' ? null : 'true')
      assert.equal(outside.before.elementFromPoint.svgBackground, outsideTarget === 'background')
      assert.equal(outside.events[0].target.tag, outsideTarget === 'root' ? 'svg' : 'rect')
      assert.equal(outside.events[1].target.tag, 'svg'); assert.equal(outside.events[1].canvasHasPointerCapture, outsideTarget === 'background')
      assert.equal(outside.events[2].target.tag, 'svg'); assert.equal(outside.events[2].canvasHasPointerCapture, false)
      if (outsideTarget === 'background') {
        assert.throws(() => assert.equal(outside.before.elementFromPoint.canvasRoot, true),
          'The obsolete root-only assertion rejects the faithful production background fixture')
        assert.notDeepEqual(outside.events[0].target, outside.events[1].target,
          'Fresh background input and root-retargeted capture retain their distinct actual targets')
      }
      assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, ambientDimension)
    }
  })
}
function mutateOutsideHit(action, mutate) {
  mutate(action.before.elementFromPoint)
  action.before.elementsFromPoint[0] = structuredClone(action.before.elementFromPoint)
}
const freshOutsideFaults = [
  ['missing-marker', (action) => mutateOutsideHit(action, (target) => { delete target.svgBackgroundAttribute; target.svgBackground = false })],
  ['false-marker', (action) => mutateOutsideHit(action, (target) => { target.svgBackgroundAttribute = 'false'; target.svgBackground = false })],
  ['wrong-marker', (action) => mutateOutsideHit(action, (target) => { target.svgBackgroundAttribute = 'TRUE'; target.svgBackground = false })],
  ['arbitrary-SVG-child', (action) => mutateOutsideHit(action, (target) => { target.tag = 'g'; target.svgBackgroundAttribute = null; target.svgBackground = false })],
  ['wrong-current-canvas', (action) => mutateOutsideHit(action, (target) => { target.currentCanvas = false; target.svgBackground = false })],
  ['nested-marked-rect', (action) => mutateOutsideHit(action, (target) => { target.canvasDirectChild = false; target.svgBackground = false })],
  ['disconnected-background', (action) => mutateOutsideHit(action, (target) => { target.connected = false; target.svgBackground = false })],
  ['wrong-hit-stack-root', (action) => { action.before.elementsFromPoint[1].currentCanvasRoot = false }],
  ['disconnected-current-root', (action) => { action.before.canvasObservation.root.connected = false }],
  ['missing-current-canvas-observation', (action) => { delete action.before.canvasObservation }],
  ['ambiguous-background', (action) => { action.before.canvasObservation.backgroundCount = 2 }],
  ['point-owner', (action) => mutateOutsideHit(action, (target) => { target.pointId = 'app-point' })],
  ['drag-handle', (action) => mutateOutsideHit(action, (target) => { target.pointHandle = true })],
  ['drawer', (action) => mutateOutsideHit(action, (target) => { target.drawer = true })],
  ['creation-toolbar', (action) => mutateOutsideHit(action, (target) => { target.creationToolbar = true })],
  ['toolbar-overlay', (action) => mutateOutsideHit(action, (target) => { target.toolbarOverlay = true })],
  ['history-overlay', (action) => mutateOutsideHit(action, (target) => { target.history = true })],
  ['quick-style', (action) => mutateOutsideHit(action, (target) => { target.quickStyle = true })],
  ['stale-current-owner', (action) => { action.before.layout.owner = '["point-node",99,"zero-overlap"]' }],
  ['stale-current-request', (action) => { action.before.layout.request = action.before.layout.bodyRequest = 'obsolete-request' }],
  ['stale-current-revision', (action) => { action.before.labelDocumentRevision++ }],
  ['stale-contour-CTM', (action) => { action.before.geometry.contour.screenCTM.e += 1 }],
  ['mismatched-measured-click', (action) => { action.click.x += .00001 }],
  ['missing-coincident-contour', (action) => { action.before.coincidentContours.pop() }],
  ['changed-coincident-path', (action) => { action.before.coincidentContours[0].contour.attributes.d = 'M 0 -20 L 0 20' }],
  ['displaced-coincident-contour', (action) => { action.before.coincidentContours[0].contour.screenCTM.e += 1 }],
  ['changed-resolved-font-context', (action) => { action.before.coincidentContours[0].layout.fontContext.xHeightPt += .1 }],
]
for (const [fault, mutate] of freshOutsideFaults) {
  test(`synthetic authenticated zero-axis fresh and complete raw policy rejects ${fault}`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-zero-outside-policy-')
    const { evidence, raw, native, download } = syntheticSignedStandalone(directory)
    const action = native.zeroAxisCase.axisInteraction.actions[0]
    mutate(action)
    assert.throws(() => assertFreshZeroAxisAction(action))
    // Keep the persisted native record identical to the complete evidence so
    // rejection must come from the shared policy, rather than file disagreement.
    writeFileSync(join(directory, `${download.scenario}-native.json`), JSON.stringify(native))
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, 2))
  })
}
const outsideNativeFaults = [
  ['unmarked-event-rect', (workflow) => { const event = workflow.actions[0].events[1]
    event.target = { ...structuredClone(workflow.actions[0].before.elementFromPoint), svgBackgroundAttribute: null, svgBackground: false }
    event.path = [structuredClone(event.target), structuredClone(event.canvasObservation.root)] }],
  ['arbitrary-SVG-event-child', (workflow) => { const event = workflow.actions[0].events[1]
    event.target = { ...structuredClone(workflow.actions[0].before.elementFromPoint), tag: 'g', svgBackgroundAttribute: null, svgBackground: false }
    event.path = [structuredClone(event.target), structuredClone(event.canvasObservation.root)] }],
  ['point-owned-outside-event', (workflow) => { const event = workflow.actions[0].events[1]
    event.target.pointId = 'app-point'; event.path[0] = structuredClone(event.target) }],
  ['handle-outside-event', (workflow) => { const event = workflow.actions[0].events[1]
    event.target.pointHandle = true; event.path[0] = structuredClone(event.target) }],
  ['overlay-outside-event', (workflow) => { const event = workflow.actions[0].events[1]
    event.target.toolbarOverlay = true; event.path[0] = structuredClone(event.target) }],
  ['wrong-event-canvas', (workflow) => { workflow.actions[0].events[1].canvasObservation.root.currentCanvasRoot = false }],
  ['wrong-composed-path-root', (workflow) => { workflow.actions[0].events[2].path[0].currentCanvasRoot = false }],
  ['wrong-composed-path-head', (workflow) => { workflow.actions[0].events[1].path.unshift(workflow.actions[0].events[0].target) }],
  ['wrong-pointerdown-target', (workflow) => { const event = workflow.actions[0].events[0]
    event.target = structuredClone(event.canvasObservation.root); event.path = [structuredClone(event.target)] }],
  ['missing-pointerup', (workflow) => { workflow.actions[0].events.splice(1, 1) }],
  ['dropped-events', (workflow) => { workflow.actions[0].droppedEvents = 1 }],
  ['untrusted-click', (workflow) => { workflow.actions[0].events[2].trusted = false }],
  ['small-forged-pointer-coordinate', (workflow) => { workflow.actions[0].events[0].client.x += .01 }],
  ['root-input-spurious-capture', (workflow) => { workflow.actions[0].events[1].canvasHasPointerCapture = true }],
  ['wrong-Alt-provenance', (workflow) => { workflow.actions[2].events[0].altKey = false }],
  ['wrong-event-body-request', (workflow) => { workflow.actions[0].events[1].layout.bodyRequest = 'obsolete-request' }],
  ['wrong-post-input-current-request', (workflow) => { const snapshot = workflow.actions[0].after
    snapshot.layout.request = snapshot.layout.bodyRequest = 'obsolete-request' }],
  ['missing-after-observation', (workflow) => { delete workflow.actions[0].after }],
  ['wrong-five-action-order', (workflow) => { [workflow.actions[2], workflow.actions[3]] = [workflow.actions[3], workflow.actions[2]] }],
  ['wrong-outside-selection', (workflow) => { workflow.actions[0].stateAfter.selection = { kind: 'stratum', id: 'app-point' } }],
  ['wrong-Alt-cycle', (workflow) => { workflow.actions[3].stateAfter.selection = { kind: 'stratum', id: 'zero-overlap' } }],
  ['changed-model', (workflow) => { const state = workflow.actions[0].stateAfter, model = JSON.parse(state.runtimeDiagramJson)
    model.strata[0].position.x += 1; state.runtimeDiagramJson = JSON.stringify(model) }],
  ['changed-history', (workflow) => { workflow.actions[0].stateAfter.history += ' ' }],
  ['changed-UI-settings', (workflow) => { workflow.actions[0].stateAfter.uiSettings = '{"changed":true}' }],
  ['discontinuous-boundary', (workflow) => { workflow.actions[1].stateBefore.selection = { kind: 'stratum', id: 'app-point' } }],
  ['missing-owned-cleanup', (workflow) => { delete workflow.cleanup }],
]
for (const [fault, mutate] of outsideNativeFaults) {
  test(`synthetic authenticated zero-axis complete native raw policy rejects ${fault}`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-zero-outside-policy-')
    const { evidence, raw, native, download } = syntheticSignedStandalone(directory, 3,
      fault === 'root-input-spurious-capture' ? 'root' : 'background')
    mutate(native.zeroAxisCase.axisInteraction)
    if (!['wrong-five-action-order', 'missing-owned-cleanup'].includes(fault)) assert.throws(() => {
      for (const action of native.zeroAxisCase.axisInteraction.actions) assertZeroAxisNativeAction(action)
    })
    writeFileSync(join(directory, `${download.scenario}-native.json`), JSON.stringify(native))
    assert.throws(() => assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, 3))
  })
}
for (const ambientDimension of [2, 3]) for (const fault of ['missing-polygon', 'duplicate-polygon', 'absolute-clearance', 'wrong-ctm', 'edited-model-source',
  'edited-model-coordinate', 'apex-only-iso', 'missing-zero', 'coincident-arcs', 'shortened-path', 'wrong-order', 'nonzero-fill-area',
  'synthetic-gesture', 'axis-became-boundary', 'outside-within-tolerance', 'outside-selected', 'wrong-cycle-owner', 'stale-owner',
  'changed-history', 'missing-raster', 'short-raster', 'missing-download', 'wrong-hit-stack', 'wrong-first-hit', 'wrong-event-owner',
  'wrong-pointer', 'wrong-button', 'wrong-event-coordinate', 'wrong-snapshot-selection', 'wrong-snapshot-revision',
  'changed-live-ctm-after-restoration', 'changed-live-root-ctm', 'captured-stale-owner', 'captured-stale-request', 'captured-wrong-pointrequest',
  'captured-wrong-revision', 'captured-edited-position', 'captured-edited-style', 'captured-mismatched-envelope', 'captured-held', 'capture-state-only']) {
  test(`synthetic additive signed/zero-axis ${ambientDimension}D policy rejects ${fault}`, () => {
    const current = syntheticPolygonalEvidence(), polygon = current.polygonalCases.find((entry) => entry.ambientDimension === ambientDimension),
      zero = current.zeroAxisCases.find((entry) => entry.ambientDimension === ambientDimension), action = zero.axisInteraction.actions[1]
    if (fault === 'missing-polygon') current.polygonalCases.splice(current.polygonalCases.indexOf(polygon), 1)
    if (fault === 'duplicate-polygon') current.polygonalCases.push(structuredClone(polygon))
    if (fault === 'absolute-clearance') polygon.rendered.anchorOffset.y = 13.70820393249937 * 1.2
    if (fault === 'wrong-ctm') polygon.rendered.placementOffset.y = polygon.rendered.anchorOffset.y
    if (fault === 'edited-model-source' || fault === 'edited-model-coordinate') {
      const runtime = JSON.parse(polygon.state.runtimeDiagramJson)
      if (fault === 'edited-model-source') runtime.strata[0].text = 'later $changed$'
      else runtime.strata[0].position.x = 5
      polygon.state.runtimeDiagramJson = JSON.stringify(runtime)
    }
    if (fault === 'apex-only-iso') current.polygonalCases.find((entry) => entry.ambientDimension === ambientDimension && entry.shape === 'isosceles triangle').anchor = 'apex'
    if (fault === 'missing-zero') current.zeroAxisCases = current.zeroAxisCases.filter((entry) => entry !== zero)
    if (fault === 'coincident-arcs') zero.rendered.contour.attributes.d = 'M 0 0 A 0 33.941 0 0 0 0 0 A 0 33.941 0 0 0 0 0 Z'
    if (fault === 'shortened-path') zero.rendered.contourLength = 2 * zeroAxisHalfExtent
    if (fault === 'wrong-order') zero.rendered.nativeTraversal.reverse()
    if (fault === 'wrong-order') zero.rendered.nativeTraversal[1].y *= -1
    if (fault === 'nonzero-fill-area') zero.rendered.bounds.width = .01
    if (fault === 'synthetic-gesture') action.events[0].trusted = false
    if (fault === 'axis-became-boundary') action.local.y = -zeroAxisHalfExtent * .92
    if (fault === 'outside-within-tolerance') zero.axisInteraction.actions.at(-1).local.x = 5
    if (fault === 'outside-selected') zero.axisInteraction.actions.at(-1).stateAfter.selection = { kind: 'stratum', id: 'app-point' }
    if (fault === 'wrong-cycle-owner') zero.axisInteraction.actions[3].stateAfter.selection.id = 'zero-overlap'
    if (fault === 'stale-owner') action.before.layout.owner = JSON.stringify(['point-node', 1, 'zero-overlap'])
    if (fault === 'changed-history') action.stateAfter.history += ' '
    if (fault === 'missing-raster') zero.livePaint.pixels = 0
    if (fault === 'short-raster') zero.livePaint.bounds.maxY = 20
    if (fault === 'missing-download') current.downloads = current.downloads.filter((entry) => entry.ambientDimension !== ambientDimension)
    if (fault === 'wrong-hit-stack') action.before.elementsFromPoint.reverse()
    if (fault === 'wrong-first-hit') action.before.elementFromPoint.pointId = 'app-point'
    if (fault === 'wrong-event-owner') action.events[0].layout.owner = '["point-node",1,"zero-overlap"]'
    if (fault === 'wrong-pointer') action.events[1].pointerId = 44
    if (fault === 'wrong-button') action.events[0].buttons = 0
    if (fault === 'wrong-event-coordinate') action.events[0].client.x += .1
    if (fault === 'wrong-snapshot-selection') action.after.selection = null
    if (fault === 'wrong-snapshot-revision') action.after.labelDocumentRevision++
    if (fault === 'changed-live-ctm-after-restoration') zero.liveObservation.afterSnapshot.geometry.contour.screenCTM.e += 5
    if (fault === 'changed-live-root-ctm') zero.liveObservation.afterSnapshot.geometry.canvas.screenCTM.e += 5
    const download = current.downloads.find((entry) => entry.ambientDimension === ambientDimension), point = download?.click.snapshot.points[0]
    if (fault === 'captured-stale-owner') point.owner = JSON.stringify(['point-node', 1, point.id])
    if (fault === 'captured-stale-request') point.request = 'stale-request'
    if (fault === 'captured-wrong-pointrequest') point.pointRequest = 'different-contour-request'
    if (fault === 'captured-wrong-revision') point.runtime = { ...point.runtime, documentRevision: 1 }
    if (fault === 'captured-edited-position') point.position.x += 1
    if (fault === 'captured-edited-style') point.style.layout.outerXSep = -3
    if (fault === 'captured-mismatched-envelope') download.click.snapshot.history += ' '
    if (fault === 'captured-held') point.held = { started: 1, completed: 0, released: false }
    if (fault === 'capture-state-only') delete download.beforeExportState

    assert.throws(() => assertLayoutAnchorEvidence(current, signedPolygonalScenario))
  })
}
for (const ambientDimension of [2, 3]) {
  test(`synthetic additive ${ambientDimension}D raw acceptance replays complete lossless PNG bytes`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-signed-zero-policy-')
    const { evidence, raw } = syntheticSignedStandalone(directory, ambientDimension)
    assertLayoutAnchorEvidence(evidence, signedPolygonalScenario)
    assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, ambientDimension)
  })
  for (const fault of ['missing-native-raw', 'wrong-native-record', 'native-flags-only', 'wrong-live-png', 'blank-live-png',
    'wrong-reopened-path', 'wrong-reopened-transform', 'wrong-root', 'wrong-png', 'blank-png', 'png-header-only',
    'wrong-pixel-ctm', 'wrong-tikz', 'wrong-saved-json']) {
    test(`synthetic additive ${ambientDimension}D standalone policy rejects ${fault}`, (t) => {
      const directory = syntheticPolicyDirectory(t, 'stz-signed-zero-policy-')
      const fixture = syntheticSignedStandalone(directory, ambientDimension), { evidence, raw, native, download } = fixture, stem = download.scenario
      if (fault === 'missing-native-raw') unlinkSync(join(directory, `${stem}-native.json`))
      if (fault === 'wrong-native-record') { native.scenario = 'point-layout-native-interaction-2d-3d'; writeFileSync(join(directory, `${stem}-native.json`), JSON.stringify(native)) }
      if (fault === 'native-flags-only') { delete native.zeroAxisCase.axisInteraction; writeFileSync(join(directory, `${stem}-native.json`), JSON.stringify(native)) }
      if (fault === 'wrong-live-png') writeFileSync(join(directory, `${stem}-live.png`), fixture.png)
      if (fault === 'blank-live-png') writeFileSync(join(directory, `${stem}-live.png`), syntheticZeroPng(native.zeroAxisCase.livePaint.ctm, false))
      if (fault === 'wrong-reopened-path') fixture.zeroAxis.contour.attributes.d = 'M 0 0 A 0 33.941 0 0 0 0 0 Z'
      if (fault === 'wrong-reopened-transform') raw.reopened[0].nodeTransform = 'translate(310 320)'
      if (fault === 'wrong-root') raw.document.root.viewBox = '0 0 1040 720'
      if (fault === 'wrong-png') writeFileSync(fixture.pngPath, fixture.livePng)
      if (fault === 'blank-png') writeFileSync(fixture.pngPath, syntheticZeroPng(fixture.zeroAxis.screenCTM, false))
      if (fault === 'png-header-only') writeFileSync(fixture.pngPath, fixture.png.subarray(0, 33))
      if (fault === 'wrong-pixel-ctm') fixture.zeroAxis.screenCTM.e += 12
      if (fault === 'wrong-tikz') writeFileSync(join(directory, `${stem}-inlineMath.tex`), 'later replacement')
      if (fault === 'wrong-saved-json') writeFileSync(join(directory, `${stem}-saved.json`), '{}')
      assert.throws(() => assertSignedPolygonalStandaloneEvidence(evidence, raw, directory, ambientDimension))
    })
  }
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
for (const spec of signedAnchorCases) for (const fault of ['missing', 'duplicate', 'wrong-sign-with-correct-paint',
  'wrong-ctm-offset', 'wrong-transform', 'absolute-resolved-minimum', 'absolute-authored-minimum', 'edited-source', 'edited-position']) {
  test(`synthetic 32D signed ${spec.key} policy rejects ${fault}`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name)
    const entry = current.signedAnchorCases.find(({ key }) => key === spec.key)
    if (fault === 'missing') current.signedAnchorCases = current.signedAnchorCases.filter(({ key }) => key !== spec.key)
    if (fault === 'duplicate') current.signedAnchorCases.push(structuredClone(entry))
    if (fault === 'wrong-sign-with-correct-paint') {
      entry.rendered.anchorOffset.x = 96; entry.rendered.placementOffset.x = -96
      entry.rendered.contour.attributes.transform = 'translate(-96 0)'
      assert.deepEqual(entry.rendered.bounds, { x: -96, y: -96, width: 192, height: 192 })
    }
    if (fault === 'wrong-ctm-offset') entry.rendered.placementOffset.x = -96
    if (fault === 'wrong-transform') entry.rendered.contour.attributes.transform = 'translate(-96 0)'
    if (fault === 'absolute-resolved-minimum') entry.rendered.layout.minimumWidth = 160
    if (fault === 'absolute-authored-minimum') entry.layout.minimumWidth = 160
    if (fault === 'edited-source' || fault === 'edited-position') {
      const runtime = JSON.parse(entry.state.runtimeDiagramJson)
      if (fault === 'edited-source') runtime.strata[0].text = 'changed'
      else runtime.strata[0].position.x += 1
      entry.state.runtimeDiagramJson = JSON.stringify(runtime)
      entry.state.json = JSON.stringify({ version: 2, diagram: runtime })
      entry.state.history = JSON.stringify({ past: [], present: runtime, future: [] })
    }
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const spec of signedPickingCases) for (const fault of ['missing', 'wrong-source', 'wrong-dimension', 'cardinal-click',
  'wrong-radius', 'absolute-path-radius', 'wrong-paint-bounds', 'missing-screen-bounds', 'local-bounds-in-screen-frame',
  'cycle-screen-bounds', 'missing-native-selection', 'missing-cycle',
  'untrusted-cycle', 'wrong-cycle-owner', 'stale-cycle-revision', 'changed-cycle-layout']) {
  test(`synthetic 32D signed ${spec.key} picking policy rejects ${fault}`, () => {
    const name = 'point-layout-native-interaction-2d-3d', current = evidence(name)
    const entry = current.signedPickingCases.find(({ key }) => key === spec.key)
    if (fault === 'missing') current.signedPickingCases = current.signedPickingCases.filter(({ key }) => key !== spec.key)
    if (fault === 'wrong-source') entry.source = spec.source === '' ? 'x' : ''
    if (fault === 'wrong-dimension') entry.ambientDimension = spec.ambientDimension === 2 ? 3 : 2
    if (fault === 'absolute-path-radius') entry.rendered.contour.attributes.d = entry.rendered.contour.attributes.d.replaceAll('A -96 -96', 'A 96 96')
    if (fault === 'wrong-paint-bounds') entry.rendered.bounds.width = 96
    if (fault === 'missing-screen-bounds') delete entry.rendered.contourScreenBounds
    if (fault === 'local-bounds-in-screen-frame') entry.rendered.contourScreenBounds = structuredClone(entry.rendered.bounds)
    if (fault === 'cycle-screen-bounds') entry.ownerCycle.rendered.contourScreenBounds = structuredClone(entry.rendered.bounds)
    if (fault === 'cardinal-click' || fault === 'wrong-radius') {
      const local = fault === 'cardinal-click' ? { x: -96, y: 0 } : { x: -48, y: -48 }
      setSyntheticSignedBoundary(entry.rendered.nativeSelection, local)
      entry.rendered.boundary = entry.rendered.nativeSelection.requestedClick
      // Raw native-selection policy accepts this coherent fabricated projection;
      // the signed regression must additionally require the original oblique gap.
      assertGeometricSelectionEvidence(entry.rendered.nativeSelection, 'signed-overlap')
    }
    if (fault === 'missing-native-selection') delete entry.rendered.nativeSelection
    if (fault === 'missing-cycle') delete entry.ownerCycle
    if (fault === 'untrusted-cycle') entry.ownerCycle.events[0].trusted = false
    if (fault === 'wrong-cycle-owner') entry.ownerCycle.stateAfter.selection.id = 'signed-overlap'
    if (fault === 'stale-cycle-revision') entry.ownerCycle.events[0].labelDocumentRevision += 1
    if (fault === 'changed-cycle-layout') {
      const runtime = JSON.parse(entry.ownerCycle.stateBefore.runtimeDiagramJson)
      runtime.strata[0].style.layout.minimumWidth = 160
      entry.ownerCycle.stateBefore.runtimeDiagramJson = JSON.stringify(runtime)
    }
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
test('32D post-click view raw artifact is mandatory only for the transparent pending edit', () => {
  assert.ok(layoutAnchorArtifacts('point-layout-pending-transparent-edit').includes('point-layout-pending-transparent-edit-post-click-view.json'))
  assert.ok(!layoutAnchorArtifacts('point-layout-pending-white-load').some((file) => file.endsWith('-post-click-view.json')))
})
test('synthetic 32D oracle accepts unchanged 2D uiSettings and root CTM with actual control and root-relative projection changes', () => {
  const name = 'point-layout-pending-transparent-edit', current = evidence(name)
  const [before, immediate, after] = current.postClickView.stages
  assert.equal(after.state.uiSettings, before.state.uiSettings)
  assert.deepEqual(after.canvas.screenCTM, before.canvas.screenCTM)
  assert.equal(before.controls.zoom.value, '1'); assert.equal(after.controls.zoom.value, '1.4')
  assert.equal(immediate.events[0].value, '1.4')
  assert.equal(current.click.snapshot.points[0].held.started, 1)
  assert.equal(before.hold.started, 2); assert.equal(current.capturedRelease.before.started, 2)
  const references = (stage) => ['layout-rectangle', 'layout-cylinder'].map((id) => stage.points.find((point) => point.id === id))
  const [a, b] = references(before), [c, d] = references(after)
  assert.notDeepEqual(c.root, a.root); assert.notDeepEqual(d.root, b.root)
  assert.equal(d.root.x - c.root.x, (b.root.x - a.root.x) * 1.4)
  assert.equal(d.root.y - c.root.y, (b.root.y - a.root.y) * 1.4)
  assertLayoutAnchorEvidence(current, name)
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
test('32D parent policy requires actual ordinary visible-body owner delivery and current bounded preview target', () => {
  const name = 'point-layout-anchor-support-rotation'
  for (const fault of ['background-success', 'missing-target', 'hidden-minimum-target', 'stale-target-request', 'missing-owner-path', 'alt-body', 'actual-null-selection']) {
    const current = evidence(name), first = current.unsupportedAnchor.nativeCases[0], action = first.clicks[0]
    if (fault === 'background-success') first.rendered.bodyClick.hit = structuredClone(first.rendered.candidates[1].hit)
    if (fault === 'missing-target') delete first.rendered.bodyTarget
    if (fault === 'hidden-minimum-target') first.rendered.bodyTarget.attributes.width = 1000
    if (fault === 'stale-target-request') first.rendered.bodyTarget.descriptor.bodyRequest = 'obsolete-request'
    if (fault === 'missing-owner-path') action.events[0].path = [action.events[0].target, action.events[0].path.at(-1)]
    if (fault === 'alt-body') action.events[0].altKey = true
    if (fault === 'actual-null-selection') { action.after.selection = null; action.selectedId = null; action.afterMeasurement.ring = null }
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
for (const fault of ['missing-preparation', 'observed-preparation', 'trapezium-before-circle', 'missing-before-export',
  'wrong-click-owner', 'wrong-click-selection', 'released-before-click', 'ready-at-click', 'changed-click-position',
  'changed-declared-position', 'wrong-captured-order', 'missing-release', 'wrong-release-source', 'unfinished-release']) {
  test(`synthetic 32D pending terminal policy rejects success flags with ${fault}`, () => {
    const name = 'point-layout-pending-transparent-edit', current = evidence(name)
    const preparation = current.pendingPreparation
    const immediate = preparation.stages.find(({ boundary }) => boundary === 'immediate-before-input')
    if (fault === 'missing-preparation') delete current.pendingPreparation
    if (fault === 'observed-preparation') preparation.result = 'observed'
    if (fault === 'trapezium-before-circle') {
      const target = { ...immediate.measurement.elementFromPoint, tag: 'rect', pointId: 'layout-trapezium', bodyTarget: true, contour: false }
      immediate.measurement.elementFromPoint = target
      immediate.measurement.elementsFromPoint = [target, { ...target, tag: 'path', bodyTarget: false, contour: true },
        { ...target, tag: 'path', pointId: 'layout-isosceles-triangle', bodyTarget: false, contour: true },
        immediate.measurement.elementsFromPoint[0]]
    }
    if (fault === 'missing-before-export') delete current.beforeExportClick
    if (fault === 'wrong-click-owner') current.click.snapshot.points[0].owner = JSON.stringify(['point-node', 1, 'layout-circle'])
    if (fault === 'wrong-click-selection') current.click.snapshot.selection = { kind: 'stratum', id: 'layout-trapezium' }
    if (fault === 'released-before-click') current.click.snapshot.points[0].held.released = true
    if (fault === 'ready-at-click') current.click.snapshot.points[0].status = 'ready'
    if (fault === 'changed-click-position') current.click.snapshot.points[0].position.x += 1
    if (fault === 'changed-declared-position') preparation.fixture.diagram.strata[0].position.x += 1
    if (fault === 'wrong-captured-order') current.click.snapshot.points.reverse()
    if (fault === 'missing-release') delete current.capturedRelease
    if (fault === 'wrong-release-source') current.capturedRelease.result.source = 'later replacement'
    if (fault === 'unfinished-release') current.capturedRelease.result.completed = 0
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
for (const background of ['transparent', 'white']) {
  test(`32D synthetic standalone ${background} policy accepts only complete raster and raw placement`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-32d-standalone-policy-')
    const fixture = syntheticStandalonePointDownload(directory, `point-layout-pending-${background === 'transparent' ? 'transparent-edit' : 'white-load'}`)
    assert.equal(fixture.raw.result, 'observed'); assert.equal(fixture.raw.capture.before.bodyExists, false)
    assertLayoutStandaloneEvidence(fixture.evidence, fixture.raw, directory)
  })
}
for (const fault of ['missing-view', 'flags-only-view', 'unrelated-view', 'observed-view', 'failed-view', 'overwritten-click-placement', 'release-reuses-click-hold']) {
  test(`synthetic 32D pending terminal policy rejects post-click 2D view ${fault}`, () => {
    const name = 'point-layout-pending-transparent-edit', current = evidence(name)
    if (fault === 'missing-view') delete current.postClickView
    if (fault === 'flags-only-view') current.postClickView = { scenario: name, result: 'passed', viewChanged: true }
    if (fault === 'unrelated-view') current.postClickView.scenario = 'point-layout-pending-white-load'
    if (fault === 'observed-view') current.postClickView.result = 'observed'
    if (fault === 'failed-view') current.postClickView.result = 'failed'
    if (fault === 'overwritten-click-placement') current.click.snapshot.points[0].nodeTransform = 'translate(999,999)'
    if (fault === 'release-reuses-click-hold') {
      current.capturedRelease.before = structuredClone(current.click.snapshot.points[0].held)
      current.capturedRelease.result.started = 1; current.capturedRelease.result.completed = 1
    }
    assert.throws(() => assertLayoutAnchorEvidence(current, name))
  })
}
function syntheticPostClickViewDiagnostics(current) {
  const common = { name: `${current.scenario}-post-click-view`, group: layoutAnchorGroup, result: 'observed' }
  return [0, 1, 2, 3].map((count) => ({ ...common, postClickView: { ...structuredClone(current.postClickView),
    result: 'observed', stages: structuredClone(current.postClickView.stages.slice(0, count)) } }))
    .concat({ ...common, postClickView: structuredClone(current.postClickView) })
}
test('synthetic 32D fresh browser report binds partial provenance and one final accepted view diagnostic', () => {
  const current = evidence('point-layout-pending-transparent-edit')
  assertLayoutPostClickViewDiagnostic(current, syntheticPostClickViewDiagnostics(current))
})
for (const fault of ['missing-diagnostics', 'unrelated-name', 'missing-view', 'wrong-group', 'wrong-source', 'failed-last',
  'stale-last', 'duplicate-accepted', 'missing-accepted', 'changed-accepted', 'overwritten-click', 'primary-error', 'secondary-error',
  'missing-before-observation', 'missing-immediate-observation', 'missing-after-observation', 'changed-stage-prefix', 'unordered-stage-observations']) {
  test(`synthetic 32D fresh browser report rejects post-click view diagnostic ${fault}`, () => {
    const current = evidence('point-layout-pending-transparent-edit'), records = syntheticPostClickViewDiagnostics(current)
    if (fault === 'missing-diagnostics') records.length = 0
    if (fault === 'unrelated-name') for (const entry of records) entry.name = 'point-layout-pending-white-load-post-click-view'
    if (fault === 'missing-view') delete records[0].postClickView
    if (fault === 'wrong-group') records[0].group = 'point-node-geometric-shapes'
    if (fault === 'wrong-source') records[0].postClickView.source = 'unrelated held source'
    if (fault === 'failed-last') records.at(-1).postClickView.result = 'failed'
    if (fault === 'stale-last') records.push(structuredClone(records[0]))
    if (fault === 'duplicate-accepted') records.push(structuredClone(records.at(-1)))
    if (fault === 'missing-accepted') records.at(-1).postClickView.result = 'observed'
    if (fault === 'changed-accepted') records.at(-1).postClickView.viewChanged = false
    if (fault === 'overwritten-click') records[0].postClickView.click.snapshot.points[0].nodeTransform = 'translate(999,999)'
    if (fault === 'primary-error') records[0].postClickView.error = { message: 'native fill failed' }
    if (fault === 'secondary-error') records[0].postClickView.secondaryErrors.push({ message: 'observer cleanup failed' })
    if (fault === 'missing-before-observation') records.splice(1, 1)
    if (fault === 'missing-immediate-observation') records.splice(2, 1)
    if (fault === 'missing-after-observation') records.splice(3, 1)
    if (fault === 'changed-stage-prefix') records[2].postClickView.stages[0].state.history = 'stale history'
    if (fault === 'unordered-stage-observations') [records[1], records[2]] = [records[2], records[1]]
    assert.throws(() => assertLayoutPostClickViewDiagnostic(current, records))
  })
}
for (const fault of ['pending', 'missing-record', 'unrelated-scenario', 'wrong-png-path', 'nonfinite-root', 'scaled-root',
  'cropped-root', 'changed-coordinates', 'mock-png-header', 'missing-png', 'wrong-png-dimensions',
  'wrong-body-transform', 'wrong-layout', 'pending-contour', 'wrong-captured-tikz', 'primary-error',
  'missing-preparation-artifact', 'wrong-preparation-artifact', 'raw-preparation-disagrees', 'raw-before-export-disagrees', 'raw-release-disagrees',
  'missing-view-artifact', 'unrelated-view-artifact', 'wrong-view-artifact-group', 'passed-view-artifact', 'failed-view-artifact',
  'view-artifact-disagrees', 'view-artifact-authored-provenance', 'missing-raw-view', 'raw-view-disagrees', 'raw-view-authored-provenance']) {
  test(`32D standalone parent contract rejects ${fault}`, (t) => {
    const directory = syntheticPolicyDirectory(t, 'stz-32d-standalone-policy-')
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
    const preparationPath = join(directory, `${evidence.scenario}-preparation.json`)
    if (fault === 'missing-preparation-artifact') unlinkSync(preparationPath)
    if (fault === 'wrong-preparation-artifact') writeFileSync(preparationPath, JSON.stringify({ scenario: evidence.scenario, group: layoutAnchorGroup,
      result: 'observed', pendingPreparation: { ...evidence.pendingPreparation, result: 'observed' } }))
    if (fault === 'raw-preparation-disagrees') raw.pendingPreparation.source = 'later replacement'
    if (fault === 'raw-before-export-disagrees') raw.beforeExportClick.measurement.hold.released = true
    if (fault === 'raw-release-disagrees') raw.capturedRelease.result.completed = 0
    const viewPath = join(directory, `${evidence.scenario}-post-click-view.json`)
    if (fault === 'missing-view-artifact') unlinkSync(viewPath)
    if (['unrelated-view-artifact', 'wrong-view-artifact-group', 'passed-view-artifact', 'failed-view-artifact', 'view-artifact-disagrees', 'view-artifact-authored-provenance'].includes(fault)) {
      const viewArtifact = { scenario: `${evidence.scenario}-post-click-view`, group: layoutAnchorGroup, result: 'observed',
        postClickView: structuredClone(evidence.postClickView) }
      if (fault === 'unrelated-view-artifact') viewArtifact.scenario = 'point-layout-pending-white-load-post-click-view'
      if (fault === 'wrong-view-artifact-group') viewArtifact.group = 'point-node-geometric-shapes'
      if (fault === 'passed-view-artifact') viewArtifact.result = 'passed'
      if (fault === 'failed-view-artifact') viewArtifact.result = 'failed'
      if (fault === 'view-artifact-disagrees') viewArtifact.postClickView.viewChanged = false
      if (fault === 'view-artifact-authored-provenance') {
        const stage = viewArtifact.postClickView.stages[0], saved = JSON.parse(stage.state.json)
        const circle = saved.diagram.strata.find(({ id }) => id === 'layout-circle')
        assert.equal(circle.style.layout.minimumWidth, 110)
        circle.style.layout.units.minimumWidth.texPoints = 111
        stage.state.json = JSON.stringify(saved)
      }
      writeFileSync(viewPath, JSON.stringify(viewArtifact))
    }
    if (fault === 'missing-raw-view') delete raw.postClickView
    if (fault === 'raw-view-disagrees') raw.postClickView.viewChanged = false
    if (fault === 'raw-view-authored-provenance') {
      const stage = raw.postClickView.stages[0], saved = JSON.parse(stage.state.json)
      const circle = saved.diagram.strata.find(({ id }) => id === 'layout-circle')
      assert.equal(circle.style.layout.minimumWidth, 110)
      circle.style.layout.units.minimumWidth.source = '110pt'
      stage.state.json = JSON.stringify(saved)
    }
    assert.throws(() => assertLayoutStandaloneEvidence(evidence, raw, directory))
  })
}

const phase31fGroups = ['existing-renderer-regressions', 'independent-oracle-negative-controls', 'boundary-anchor-camera-matrix',
  'inverted-success-and-failure-races', 'pending-lock-and-autohide', 'deletion-and-unmount', 'real-App-input-JSON-history-reused-ID-load', 'current-SVG-cloning',
  'inline-node-rendering-placement-halo-picking', 'inline-node-lifecycle-path-operations-export', 'settled-SVG-export-standalone', 'combined-free-inline-workflows']
function reportFixture(t) {
  const root = syntheticPolicyDirectory(t, 'stz-32d-policy-')
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
