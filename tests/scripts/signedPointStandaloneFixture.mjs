import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { layoutAnchorGroup, layoutShapes, layoutRegimes, layoutForShapeRegime, pointAnchorsForShape, layoutImportCases, signedAnchorCases, signedPickingCases, signedPolygonalScenario, signedPolygonalCases, zeroAxisLayout, zeroAxisHalfExtent, observeZeroAxisPixels } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { signedPointRenderOrderProof, signedPointStandaloneRootAttributes, createSignedPointAssociationCandidate } from '../../scripts/signedPointStandaloneAssociation.mjs'
import { syntheticPendingLayoutPreparation } from './standalonePointDownloadFixture.mjs'
import { syntheticPendingLayoutViewEvidence } from './pointLayoutPendingViewFixture.mjs'
import { syntheticUnsupportedDiagnosticEvidence } from './pointUnsupportedDiagnosticFixture.mjs'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { syntheticPointNativeDragEvidence } from './pointNativeDragFixture.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'
import { compareSvgRenderItems } from '../../src/rendering/svgRenderSort.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'

// Shared controlled fixtures preserve the complete current policy records and
// real empty native shell. Fabricated geometry/PNG paint exercises validation;
// these fixtures never constitute native browser acceptance.
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
    + raw.reopened.map((entry, ordinal) => `<g><g transform="${entry.nodeTransform}"><path ${Object.entries(entry.contour.attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}/><g transform="${entry.bodyTransform}"><title/><g transform="translate(0 0)" opacity="1" fill="${syntheticSignedRenderOrder(raw.expected)[ordinal].modelPoint.style.paint.text.color}" color="${syntheticSignedRenderOrder(raw.expected)[ordinal].modelPoint.style.paint.text.color}" pointer-events="none"><g/></g></g></g></g>`).join('') + '</g></svg>'
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

export { placement, unsupportedNativeCases, syntheticOwnerCycle, syntheticSignedState, setSyntheticSignedBoundary, syntheticSignedPlacement, syntheticPolygonalPlacement, syntheticZeroRendered, syntheticZeroPixels, syntheticZeroCanvas, syntheticZeroCoincidentContours, syntheticCaptureElement, syntheticZeroCaptureSnapshot, syntheticZeroLiveObservation, refreshSyntheticCaptureObstruction, setSyntheticZeroInputContour, syntheticZeroNative, syntheticSignedRenderOrder, syntheticPolygonalEvidence, evidence, syntheticZeroPng, syntheticSignedMatrices, syntheticSignedStructure, syntheticSignedSvg, syntheticSignedStandalone }
