// Synthetic policy fixture only. This does not execute native browser input and
// must never be used as native acceptance evidence.
export function syntheticPointNativeDragEvidence({ id = 'app-point', ambientDimension = 2, shape = 'diamond',
  scenario = 'point-geometric-native-contours-2d-3d', displacement = { x: 28, y: -16 }, steps = 4 } = {}) {
  const point = { id, codim: ambientDimension, geometricKind: 'point', name: 'Point', text: 'drag $x_i$',
    style: { kind: 'pointStyle', shape, size: 8, opacity: 1, layout: { anchor: 'center' } }, position: { x: 3, y: 3, z: 0 }, layer: 0 }
  const before = { version: 1, ambientDimension, camera: ambientDimension === 2 ? { mode: '2d', scale: 1, origin: { x: 0, y: 0 } }
    : { mode: '3d', kind: 'orthographic', thetaDeg: 60, phiDeg: 30, zoom: 1, pan: { x: 0, y: 0 } }, strata: [point], labels: [], layers: [{ value: 0, name: 'Layer 0' }] }
  const after = structuredClone(before); after.strata[0].position = { x: 3.28, y: 3.16, z: 0 }
  const selection = { kind: 'stratum', id }, historyBefore = { past: [], present: before, future: [] }
  const historyAfter = { past: [before], present: after, future: [] }, historyUndo = { past: [], present: before, future: [after] }
  const state = (runtime, history, revision) => ({ json: JSON.stringify({ format: 'stratified-tikz-diagram', version: 2, diagram: runtime }),
    runtimeDiagramJson: JSON.stringify(runtime), history: JSON.stringify(history), selection, labelDocumentRevision: revision, uiSettings: '{}' })
  // Geometry edits and Undo/Redo stay inside the current App document epoch.
  const stateBefore = state(before, historyBefore, 100), stateAfter = state(after, historyAfter, 100)
  const stateUndo = state(before, historyUndo, 100), stateRedo = state(after, historyAfter, 100)
  const element = { tag: 'circle', id: '', class: 'svg-geometry-handle', connected: true, drawer: false, pointId: null,
    ariaLabel: 'Point', svg: true, canvas: true, canvasRoot: false, pointHandle: true, selectedOwner: id }
  const group = { ...element, tag: 'g', class: null, ariaLabel: 'Selected point drag handles', pointHandle: false }
  const root = { ...element, tag: 'svg', class: 'svg-diagram', ariaLabel: null, canvasRoot: true, pointHandle: false }
  const start = { x: 300, y: 250 }, end = { x: start.x + displacement.x, y: start.y + displacement.y }
  const event = (type, client, options = {}) => ({ type, phase: 'drag', trusted: true, at: 20,
    pointerId: 1, pointerType: 'mouse', button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerup' || type === 'lostpointercapture' ? 0 : 1, client,
    target: type === 'pointerdown' ? element : root, path: type === 'pointerdown' ? [element, group, root] : [root],
    selection, labelDocumentRevision: 100, canvasHasPointerCapture: type !== 'pointerdown' && type !== 'lostpointercapture',
    captureAfterMicrotask: type !== 'pointerup' && type !== 'lostpointercapture',
    ...(type === 'pointerup' ? { captureAfterBubble: false } : {}), canvasConnected: true, ...options })
  const events = [event('pointerdown', start, { handleAtPointerDown: { connected: true, selectedOwner: id,
    localBounds: { x: 294, y: 244, width: 12, height: 12 }, localCenter: start,
    screenCTM: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: start, hitTarget: element } }), event('gotpointercapture', start)]
  for (let step = 1; step <= steps; step++) events.push(event('pointermove', {
    x: start.x + displacement.x * step / steps, y: start.y + displacement.y * step / steps }))
  events.push(event('pointerup', end), event('lostpointercapture', end))
  const snapshot = (open = false, observedEvents = [], modelPoint = point, revision = 100) => ({ at: 10, id, phase: 'preparation', selection,
    camera: before.camera, modelPoint, labelDocumentRevision: revision, workPlaneControls: [], workPlaneStatus: ['xy-plane at z=0'],
    viewport: { width: 1700, height: 1300, scrollX: 0, scrollY: 0, devicePixelRatio: 1 }, scrollAncestors: [],
    inspector: { open, bounds: open ? { x: 280, y: 0, width: 300, height: 600 } : null }, selectPressed: 'true',
    canvas: { connected: true, sameOwnedCanvas: true, bounds: { x: 0, y: 0, width: 900, height: 700 },
      screenCTM: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } },
    handle: { groupCount: 1, count: 1, connected: true, selectedOwner: id, element, group,
      bounds: { x: 294, y: 244, width: 12, height: 12 }, localBounds: { x: 294, y: 244, width: 12, height: 12 },
      localCenter: start, screenCTM: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      CTM: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, start },
    elementFromPoint: element, elementsFromPoint: [element, root], events: observedEvents, droppedEvents: 0, errors: [],
    captureStates: observedEvents.length ? [{ pointerId: 1, captured: false }] : [] })
  return JSON.parse(JSON.stringify({ kind: 'point-native-drag', scenario, sequence: 1, id, displacement, steps,
    preparation: { stateBefore, inherited: snapshot(true), closeActions: 1, drawerCount: 1,
      closedDrawerCount: 0, openerCount: 1, openerExpanded: 'false', closed: snapshot(), stateAfter: stateBefore,
      prepared: snapshot(), statePrepared: stateBefore },
    before: snapshot(), stateBefore, requested: { start, end },
    afterAction: { state: stateAfter, observation: snapshot(false, events, after.strata[0]) },
    undo: { stateBefore: stateAfter, stateAfter: stateUndo, observation: snapshot(false, events, point) },
    redo: { stateBefore: stateUndo, stateAfter: stateRedo, observation: snapshot(false, events, after.strata[0]) },
    secondaryErrors: [] }))
}
