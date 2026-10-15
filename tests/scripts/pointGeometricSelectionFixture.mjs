// Fabricated raw records exercise policy rejection. They never establish native
// browser acceptance or replace the cumulative production App scenarios.
export function syntheticGeometricSelectionEvidence({ scenario = 'point-geometric-native-contours-2d-3d',
  id = 'app-point', ambientDimension = 2, shape = 'semicircle', boundary = true, body = false,
  requireUnselected = false, collapsed = false, obstructed = false, state, initialSelection = null, nativeProjection = 'double' } = {}) {
  const point = { id, geometricKind: 'point', codim: ambientDimension,
    position: { x: 3, y: 3, z: ambientDimension === 3 ? .5 : 0 }, text: 'drag $x_i$',
    style: { shape, size: 8, opacity: 1, shapeParameters: shape === 'semicircle' ? { borderUsesIncircle: true, borderRotate: 33 } : {} } }
  const diagram = { ambientDimension, camera: { mode: ambientDimension === 2 ? '2d' : '3d', scale: 1, origin: { x: 0, y: 0 } }, strata: [point], labels: [] }
  const beforeState = state ? structuredClone(state) : { json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), labelDocumentRevision: 102, uiSettings: JSON.stringify({ exportMode: 'standalone' }) }
  beforeState.selection = structuredClone(initialSelection)
  const runtime = JSON.parse(beforeState.runtimeDiagramJson), model = runtime.strata.find((point) => point.id === id)
  const afterState = { ...structuredClone(beforeState), selection: { kind: 'stratum', id } }
  const matrix = { a: 3.1, b: 0, c: 0, d: 3.1, e: 1296.4, f: 268.975 }
  const project = nativeProjection === 'binary32' ? Math.fround : (value) => value
  const local = { x: project((1313.197754 - matrix.e) / matrix.a), y: project((158.548584 - matrix.f) / matrix.d) }
  const doublePoint = { x: matrix.a * local.x + matrix.e, y: matrix.d * local.y + matrix.f }
  const boundaryPoint = { x: project(doublePoint.x), y: project(doublePoint.y) }
  const center = { x: matrix.e, y: matrix.f }, clickKind = body ? 'body' : boundary ? 'boundary' : 'center'
  const requestedClick = body ? doublePoint : boundary ? boundaryPoint : center
  const rendered = { shape: model.style.shape, source: model.text, state: 'ready', contourLength: 220, center, boundary: body ? doublePoint : boundaryPoint,
    ...(body ? { bodyOverflow: { clickInContour: local, localBodyClick: { x: 2, y: 3 }, characterBounds: { x: 0, y: 0, width: 5, height: 6 } } } : {}) }
  const target = { tag: 'path', pointId: id, svg: true, canvas: true, drawer: false, canvasRoot: false,
    pointHandle: false, creationToolbar: false, toolbarOverlay: false, quickStyle: false, history: false }
  const toolbarTarget = { tag: 'span', class: 'preview-toolbar-status', pointId: null, svg: false, canvas: false,
    drawer: false, canvasRoot: false, pointHandle: false, creationToolbar: true, toolbarOverlay: true, quickStyle: false, history: false }
  const layout = { owner: JSON.stringify(['point-node', beforeState.labelDocumentRevision, id]),
    request: `request:${beforeState.labelDocumentRevision}:${id}`, bodyRequest: `request:${beforeState.labelDocumentRevision}:${id}`,
    source: model.text, shape: model.style.shape, state: 'ready' }
  const snapshot = (state, isCollapsed, click = null, hit = target, events = [], pressed = 'true') => ({
    errors: [], at: 100, model: structuredClone(model), camera: structuredClone(runtime.camera ?? null),
    selection: structuredClone(state.selection), labelDocumentRevision: state.labelDocumentRevision,
    workPlaneControls: ambientDimension === 3 ? [{ value: 'xy' }, { value: '0' }] : [], workPlaneStatus: ambientDimension === 3 ? ['xy at z=0'] : [],
    inspector: { open: false }, tool: { selectPressed: isCollapsed ? null : pressed }, layout: structuredClone(layout),
    toolbar: { overlayCount: 1, collapsed: isCollapsed, floatingCount: Number(!isCollapsed), expandCount: Number(isCollapsed),
      collapseCount: Number(!isCollapsed), quickStyleCount: Number(!isCollapsed && state.selection !== null), historyCount: 1 },
    geometry: { contour: { connected: true, length: 220, fraction: .23, localBoundary: local, boundary: boundaryPoint,
      screenCTM: structuredClone(matrix), CTM: structuredClone(matrix), bounds: { x: -50, y: -40, width: 100, height: 80 } },
    point: { connected: true, center } }, requestedClick: click, elementFromPoint: click ? structuredClone(hit) : null,
    elementsFromPoint: click ? [structuredClone(hit), { canvasRoot: true, svg: true, canvas: true, drawer: false }] : [],
    events: structuredClone(events), droppedEvents: 0 })
  const inherited = snapshot(beforeState, collapsed), actions = []
  let isCollapsed = collapsed
  const action = (name, purpose, currentState = beforeState) => {
    const before = snapshot(currentState, isCollapsed)
    if (name !== 'Select') isCollapsed = name === 'collapse'
    const after = snapshot(currentState, isCollapsed)
    actions.push({ name, purpose, controlCount: 1, ...(name === 'Select' ? {} : { oppositeCount: 1 }), stateBefore: structuredClone(currentState), before,
      stateAfter: structuredClone(currentState), after,
      floatingCount: after.toolbar.floatingCount, expandCount: after.toolbar.expandCount, collapseCount: after.toolbar.collapseCount,
      collapsed: after.toolbar.collapsed, pressed: after.tool.selectPressed })
  }
  if (collapsed) action('expand', 'select-access')
  action('Select', 'select')
  const toolbarPreparation = { inherited, stateBefore: structuredClone(beforeState), actions, clickKind }
  if (obstructed) {
    toolbarPreparation.obstructed = { rendered: structuredClone(rendered), observation: snapshot(beforeState, false, requestedClick, toolbarTarget) }
    action('collapse', 'obstruction')
  }
  Object.assign(toolbarPreparation, { prepared: snapshot(beforeState, isCollapsed, requestedClick), statePrepared: structuredClone(beforeState),
    rendered: structuredClone(rendered), requestedClick })
  const before = snapshot(beforeState, isCollapsed, requestedClick)
  const events = ['pointerdown', 'pointerup', 'click'].map((type) => ({ type, trusted: true, button: 0,
    pointerId: 1, canvasHasPointerCapture: false, client: requestedClick, target: structuredClone(target),
    path: [structuredClone(target), { canvasRoot: true, svg: true, canvas: true, drawer: false }],
    App: { selection: type === 'pointerdown' ? structuredClone(initialSelection) : { kind: 'stratum', id }, labelDocumentRevision: beforeState.labelDocumentRevision,
      selectPressed: isCollapsed ? null : 'true' }, layout: structuredClone(layout) }))
  const after = snapshot(afterState, isCollapsed, requestedClick, target, events)
  const toolbarRestoration = { stateBefore: structuredClone(afterState), before: snapshot(afterState, isCollapsed) }
  if (isCollapsed !== collapsed) action(isCollapsed ? 'expand' : 'collapse', 'restore', afterState)
  Object.assign(toolbarRestoration, { stateAfter: structuredClone(afterState), after: snapshot(afterState, isCollapsed) })
  return { scenario, sequence: 14, id, clickKind, requireUnselected, preparation: { closeActions: 0,
    stateBefore: structuredClone(beforeState), stateAfter: structuredClone(beforeState), inherited: snapshot(beforeState, collapsed),
    closed: snapshot(beforeState, collapsed), drawerCount: 0, closedDrawerCount: 0, openerCount: 1, openerExpanded: 'false' },
  toolbarPreparation, rendered, requestedClick, stateBefore: beforeState, stateAfter: afterState, before, after,
  selected: afterState.selection, events, toolbarRestoration, secondaryErrors: [] }
}
