import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

// These functions execute in the owned App document. The registry contains only
// scoped observations; all model changes still go through native production UI.
export function installPointNativeDragObserver({ token, id }) {
  const registry = window.__stzPointNativeDragObservers ??= new Map()
  if (registry.has(token)) throw new Error(`Point drag observer already owned: ${token}`)
  const canvas = document.querySelector('svg.svg-diagram')
  const describe = (element, selectedOwner) => element instanceof Element ? {
    tag: element.localName, id: element.id, class: element.getAttribute('class'),
    connected: element.isConnected, drawer: !!element.closest('#preview-inspector-drawer'),
    pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    ariaLabel: element.getAttribute('aria-label'), svg: element instanceof SVGElement,
    canvas: element.closest('svg.svg-diagram') === canvas, canvasRoot: element === canvas,
    pointHandle: element.matches('circle.svg-geometry-handle')
      && element.parentElement?.getAttribute('aria-label') === 'Selected point drag handles',
    selectedOwner,
  } : null
  const owned = { id, canvas, phase: 'preparation', events: [], errors: [], droppedEvents: 0, describe, pointerIds: new Set(), entries: new WeakMap() }
  owned.listener = (event) => {
    if (owned.events.length >= 192) { owned.droppedEvents++; return }
    try {
      const state = window.stzAppLabels.state(), selectedOwner = state.selection?.kind === 'stratum' ? state.selection.id : null
      const captured = () => Number.isInteger(event.pointerId) && (canvas?.hasPointerCapture(event.pointerId) ?? false)
      const entry = { type: event.type, phase: owned.phase, trusted: event.isTrusted, at: performance.now(),
        pointerId: event.pointerId ?? null, pointerType: event.pointerType ?? null,
        button: event.button, buttons: event.buttons, client: { x: event.clientX, y: event.clientY },
        target: describe(event.target, selectedOwner), path: event.composedPath().slice(0, 16).map((element) => describe(element, selectedOwner)),
        selection: state.selection, labelDocumentRevision: state.labelDocumentRevision,
        canvasHasPointerCapture: captured(), canvasConnected: canvas?.isConnected ?? false }
      if (Number.isInteger(event.pointerId)) owned.pointerIds.add(event.pointerId)
      if (event.type === 'pointerdown' && entry.target?.pointHandle) {
        const handle = event.target, matrix = handle.getScreenCTM(), bounds = handle.getBBox()
        const localCenter = { x: handle.cx.baseVal.value, y: handle.cy.baseVal.value }
        const center = new DOMPoint(localCenter.x, localCenter.y).matrixTransform(matrix)
        entry.handleAtPointerDown = { connected: handle.isConnected, selectedOwner,
          localBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, localCenter,
          screenCTM: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])),
          center: { x: center.x, y: center.y }, hitTarget: describe(document.elementFromPoint(event.clientX, event.clientY), selectedOwner) }
      }
      owned.events.push(entry)
      owned.entries.set(event, entry)
      // A native callback's microtask can precede a later propagation listener;
      // retain its phase honestly and use capture transitions/moves as proof.
      queueMicrotask(() => {
        try { entry.captureAfterMicrotask = captured() }
        catch (error) { owned.errors.push({ name: 'microtask capture', message: String(error.message).slice(0, 2000) }) }
      })
    } catch (error) { owned.errors.push({ name: 'native drag event', message: String(error.message).slice(0, 2000) }) }
  }
  registry.set(token, owned)
  owned.bubbleListener = (event) => {
    const entry = owned.entries.get(event)
    if (entry) entry.captureAfterBubble = canvas?.hasPointerCapture(event.pointerId) ?? false
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'click']) {
    document.addEventListener(type, owned.listener, true)
  }
  document.addEventListener('pointerup', owned.bubbleListener)
}

export function setPointNativeDragPhase({ token, phase }) {
  const owned = window.__stzPointNativeDragObservers?.get(token)
  if (!owned) throw new Error('Owned point drag observer is missing')
  owned.phase = phase
}

export function observePointNativeDrag({ token, id }) {
  const owned = window.__stzPointNativeDragObservers?.get(token), errors = []
  const safe = (name, operation) => {
    try { return operation() } catch (error) { errors.push({ name, message: String(error.message).slice(0, 2000) }); return null }
  }
  const state = safe('App state', () => window.stzAppLabels.state())
  const selectedOwner = state?.selection?.kind === 'stratum' ? state.selection.id : null
  const canvas = document.querySelector('svg.svg-diagram'), drawer = document.getElementById('preview-inspector-drawer')
  const groups = [...document.querySelectorAll('[aria-label="Selected point drag handles"]')]
  const handles = [...document.querySelectorAll('[aria-label="Selected point drag handles"] > circle.svg-geometry-handle')]
  const handle = handles.length === 1 ? handles[0] : null
  const rect = (element) => {
    if (!element) return null
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }
  const matrix = (element, method) => {
    const value = element?.[method]?.()
    return value ? Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]])) : null
  }
  const describe = (element) => owned?.describe(element, selectedOwner) ?? null
  const screenCTM = safe('handle screen CTM', () => matrix(handle, 'getScreenCTM'))
  const localCenter = handle ? { x: handle.cx.baseVal.value, y: handle.cy.baseVal.value } : null
  const start = localCenter && screenCTM ? { x: screenCTM.a * localCenter.x + screenCTM.c * localCenter.y + screenCTM.e,
    y: screenCTM.b * localCenter.x + screenCTM.d * localCenter.y + screenCTM.f } : null
  const model = state && safe('runtime model', () => JSON.parse(state.runtimeDiagramJson))
  const scrollAncestors = []
  for (let element = canvas; element && scrollAncestors.length < 8; element = element.parentElement) {
    scrollAncestors.push({ tag: element.localName, class: element.getAttribute('class'), bounds: rect(element),
      scrollTop: element.scrollTop, scrollLeft: element.scrollLeft })
  }
  if (!owned) errors.push({ name: 'observer ownership', message: 'Owned point drag observer is missing' })
  const select = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Select')
  // Active work-plane controls are read-only evidence, independent of geometry.
  const workPlaneControls = [...document.querySelectorAll('input,select,button')].filter((element) =>
    !element.closest('#preview-inspector-drawer')
    && (element.closest('#preview-work-plane-panel,.work-plane-control')
      || /work.?plane/i.test([element.getAttribute('aria-label'), element.id, element.className].join(' ')))).slice(0, 48)
    .map((element) => ({ tag: element.localName, id: element.id, ariaLabel: element.getAttribute('aria-label'),
      value: element.value ?? null, pressed: element.getAttribute('aria-pressed'), checked: element.checked ?? null }))
  return { at: performance.now(), id, phase: owned?.phase ?? null, selection: state?.selection ?? null,
    camera: model?.camera ?? null, modelPoint: model?.strata.find((point) => point.id === id) ?? null,
    labelDocumentRevision: state?.labelDocumentRevision ?? null, workPlaneControls,
    workPlaneStatus: [...document.querySelectorAll('.work-plane-status,.preview-work-plane-status,.work-plane-summary')].map((element) => element.textContent),
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio }, scrollAncestors,
    inspector: { open: !!drawer, bounds: rect(drawer) }, selectPressed: select?.getAttribute('aria-pressed') ?? null,
    canvas: { connected: canvas?.isConnected ?? false, sameOwnedCanvas: canvas === owned?.canvas, bounds: rect(canvas),
      screenCTM: safe('canvas screen CTM', () => matrix(canvas, 'getScreenCTM')) },
    handle: { groupCount: groups.length, count: handles.length, connected: handle?.isConnected ?? false,
      selectedOwner, element: describe(handle), group: describe(handle?.parentElement),
      bounds: safe('handle bounds', () => rect(handle)), localBounds: safe('handle local bounds', () => {
        if (!handle) return null
        const { x, y, width, height } = handle.getBBox(); return { x, y, width, height }
      }), localCenter, screenCTM, CTM: safe('handle CTM', () => matrix(handle, 'getCTM')), start },
    elementFromPoint: start ? describe(document.elementFromPoint(start.x, start.y)) : null,
    elementsFromPoint: start ? document.elementsFromPoint(start.x, start.y).slice(0, 16).map(describe) : [],
    events: owned ? owned.events.map((event) => ({ ...event })) : [], droppedEvents: owned?.droppedEvents ?? null,
    captureStates: owned ? [...owned.pointerIds].map((pointerId) => ({ pointerId, captured: canvas?.hasPointerCapture(pointerId) ?? false })) : [],
    errors: [...errors, ...(owned?.errors ?? [])] }
}

export function removePointNativeDragObserver(token) {
  const registry = window.__stzPointNativeDragObservers, owned = registry?.get(token)
  if (owned) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'click']) {
    document.removeEventListener(type, owned.listener, true)
  }
  if (owned) document.removeEventListener('pointerup', owned.bubbleListener)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzPointNativeDragObservers
}

const invariantFields = ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']
function assertUnchangedState(before, after, message) {
  assert.ok(before && after, `${message}: authoritative state retained`)
  for (const field of invariantFields) assert.deepEqual(after[field], before[field], `${message}: ${field}`)
}
function assertSelected(state, id) {
  assert.deepEqual(state?.selection, { kind: 'stratum', id }, 'Point canvas preparation preserves the selected owner')
}
function assertSnapshot(snapshot, id) {
  assert.ok(snapshot, 'Native point snapshot retained')
  assert.deepEqual(snapshot.errors, [], 'Native point observation has no errors')
  assert.equal(snapshot.droppedEvents, 0, 'All scoped native events retained')
  assertSelected(snapshot, id)
  assert.equal(snapshot.canvas.connected, true); assert.equal(snapshot.canvas.sameOwnedCanvas, true)
  assert.ok(Array.isArray(snapshot.workPlaneControls) && Array.isArray(snapshot.workPlaneStatus), 'Active work-plane records retained')
  assert.ok(snapshot.viewport && Object.values(snapshot.viewport).every(Number.isFinite), 'Viewport retained')
}
export function assertPointCanvasPreparation(preparation, id) {
  assert.equal(preparation.drawerCount, preparation.inherited.inspector.open ? 1 : 0)
  assert.equal(preparation.closeActions, preparation.drawerCount, 'One native close for an open drawer, none for a closed drawer')
  assert.equal(preparation.closedDrawerCount, 0); assert.equal(preparation.openerCount, 1); assert.equal(preparation.openerExpanded, 'false')
  assertUnchangedState(preparation.stateBefore, preparation.stateAfter, 'Inspector close')
  assertUnchangedState(preparation.stateBefore, preparation.statePrepared, 'Select/scroll preparation')
  for (const state of [preparation.stateBefore, preparation.stateAfter, preparation.statePrepared]) assertSelected(state, id)
  for (const snapshot of [preparation.inherited, preparation.closed, preparation.prepared]) assertSnapshot(snapshot, id)
  assert.equal(preparation.closed.inspector.open, false); assert.equal(preparation.prepared.inspector.open, false)
  assert.equal(preparation.prepared.selectPressed, 'true')
  for (const snapshot of [preparation.closed, preparation.prepared]) {
    assert.deepEqual(snapshot.camera, preparation.inherited.camera, 'Preparation preserves camera')
    assert.deepEqual(snapshot.workPlaneControls, preparation.inherited.workPlaneControls, 'Preparation preserves active work plane')
    assert.deepEqual(snapshot.workPlaneStatus, preparation.inherited.workPlaneStatus, 'Preparation preserves active work-plane status')
    assert.deepEqual(snapshot.modelPoint, preparation.inherited.modelPoint, 'Preparation preserves rendered handle owner model')
  }
  for (const [snapshot, state] of [[preparation.inherited, preparation.stateBefore], [preparation.closed, preparation.stateAfter], [preparation.prepared, preparation.statePrepared]]) {
    const runtime = parsed(state).runtime
    assert.deepEqual(snapshot.modelPoint, runtime.strata.find((point) => point.id === id), 'Prepared rendered owner matches authoritative model')
    assert.deepEqual(snapshot.camera, runtime.camera, 'Prepared observed camera matches authoritative model')
    assert.equal(snapshot.labelDocumentRevision, state.labelDocumentRevision)
  }
}
function intendedHandle(target, id) {
  return target?.pointHandle === true && target.svg === true && target.canvas === true && target.drawer === false
    && target.connected === true && target.selectedOwner === id
}
function intendedPath(event, id, handle = false) {
  return event.path?.some((target) => target?.canvasRoot === true && target.canvas === true && target.connected === true)
    && (handle ? intendedHandle(event.target, id)
      && event.path.some((target) => target?.ariaLabel === 'Selected point drag handles' && target.selectedOwner === id)
      : event.target?.canvasRoot === true && event.target.canvas === true && event.target.drawer === false
        && event.target.connected === true && event.target.selectedOwner === id)
}
function assertFreshHandle(snapshot, id) {
  assertSnapshot(snapshot, id)
  assert.equal(snapshot.inspector.open, false, 'Inspector is detached at native handle input')
  const handle = snapshot.handle
  assert.equal(handle.groupCount, 1); assert.equal(handle.count, 1); assert.equal(handle.connected, true)
  assert.equal(handle.selectedOwner, id); assert.ok(intendedHandle(handle.element, id))
  assert.equal(handle.group.ariaLabel, 'Selected point drag handles')
  assert.equal(handle.element.ariaLabel, snapshot.modelPoint.name, 'Rendered point-position handle belongs to the selected model point')
  for (const geometry of [handle.bounds, handle.localBounds, handle.screenCTM, handle.CTM, handle.localCenter, handle.start]) {
    assert.ok(geometry && Object.values(geometry).every(Number.isFinite), 'Fresh connected native handle geometry is finite')
  }
  assert.ok(handle.bounds.width > 0 && handle.bounds.height > 0)
  const m = handle.screenCTM, center = handle.localCenter
  assert.notEqual(m.a * m.d - m.b * m.c, 0, 'Native handle screen CTM is nonsingular')
  assert.deepEqual(handle.start, { x: m.a * center.x + m.c * center.y + m.e, y: m.b * center.x + m.d * center.y + m.f }, 'Current start comes from connected SVG CTM')
  assert.ok(handle.start.x >= handle.bounds.x && handle.start.x <= handle.bounds.x + handle.bounds.width
    && handle.start.y >= handle.bounds.y && handle.start.y <= handle.bounds.y + handle.bounds.height, 'Native start lies in the current handle screen bounds')
  assert.ok(intendedHandle(snapshot.elementFromPoint, id), 'Current hit target is the selected point-position handle')
  assert.ok(intendedHandle(snapshot.elementsFromPoint[0], id), 'Current hit stack starts with the intended handle')
}
function assertNativeDelivery(observation) {
  const { id, before, afterAction, requested, steps } = observation
  assertFreshHandle(before, id); assertSnapshot(afterAction.observation, id)
  assert.deepEqual(requested.start, before.handle.start, 'Native input uses the freshly measured handle center')
  assert.deepEqual(requested.end, { x: requested.start.x + observation.displacement.x, y: requested.start.y + observation.displacement.y })
  const events = afterAction.observation.events.filter((event) => event.phase === 'drag')
  const input = events.filter((event) => ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].includes(event.type))
  assert.deepEqual(input.map(({ type }) => type), ['pointerdown', ...Array(steps).fill('pointermove'), 'pointerup'], 'One complete native drag, without cancellation or contaminated selection events')
  const down = input[0], up = input.at(-1), moves = input.slice(1, -1)
  assert.ok(Number.isInteger(down.pointerId)); assert.equal(down.pointerType, 'mouse')
  for (const event of input) {
    assert.equal(event.trusted, true); assert.equal(event.pointerId, down.pointerId)
    assertSelected(event, id); assert.equal(event.canvasConnected, true)
    assert.ok(event.client && Object.values(event.client).every(Number.isFinite))
  }
  assert.equal(down.button, 0); assert.equal(down.buttons, 1); assert.ok(intendedPath(down, id, true), 'Trusted pointerdown reaches the intended production handle path')
  const nativeCoordinate = (actual, expected, message) => {
    assert.ok(Math.abs(actual.x - expected.x) <= .05 && Math.abs(actual.y - expected.y) <= .05, message)
  }
  nativeCoordinate(down.client, requested.start, 'Pointerdown delivered at the current handle center within browser coordinate quantization')
  const boundary = down.handleAtPointerDown
  assert.equal(boundary?.connected, true); assert.equal(boundary.selectedOwner, id)
  assert.deepEqual(boundary.localBounds, before.handle.localBounds); assert.deepEqual(boundary.localCenter, before.handle.localCenter)
  assert.deepEqual(boundary.screenCTM, before.handle.screenCTM)
  assert.ok(Math.abs(boundary.center.x - requested.start.x) < 1e-8 && Math.abs(boundary.center.y - requested.start.y) < 1e-8, 'Event-boundary CTM still measures the current handle center')
  assert.ok(intendedHandle(boundary.hitTarget, id), 'Pointerdown boundary hit test still reaches the owned handle')
  const captured = down.captureAfterMicrotask === true || events.some((event) => event.type === 'gotpointercapture'
    && event.trusted === true && event.pointerId === down.pointerId && intendedPath(event, id))
  assert.equal(captured, true, 'Production handler establishes canvas pointer capture')
  for (const event of [...moves, up]) {
    assert.ok(intendedPath(event, id) || intendedPath(event, id, true), 'Matching captured continuation stays on the owned production canvas')
    assert.equal(event.canvasHasPointerCapture, true, 'Movement/up observes active canvas capture before handler release')
  }
  assert.ok(moves.every((event) => event.buttons === 1)); assert.equal(up.button, 0); assert.equal(up.buttons, 0)
  nativeCoordinate(moves.at(-1).client, requested.end, 'Final movement reaches requested displacement')
  nativeCoordinate(up.client, requested.end, 'Pointerup finishes at requested displacement')
  assert.ok(moves.some((event) => event.client.x !== down.client.x || event.client.y !== down.client.y), 'Native movement is real')
  assert.ok(up.captureAfterBubble === false || afterAction.observation.captureStates.some((entry) => entry.pointerId === down.pointerId && entry.captured === false), 'Post-handler observation confirms production pointerup releases canvas capture')
  for (const event of events.filter((event) => ['gotpointercapture', 'lostpointercapture'].includes(event.type))) {
    assert.equal(event.trusted, true); assert.equal(event.pointerId, down.pointerId); assert.ok(intendedPath(event, id))
  }
}
function parsed(state) {
  assert.ok(state && typeof state.json === 'string' && typeof state.runtimeDiagramJson === 'string' && typeof state.history === 'string', 'Raw JSON/runtime/history evidence retained')
  return { saved: JSON.parse(state.json), runtime: JSON.parse(state.runtimeDiagramJson), history: JSON.parse(state.history) }
}
function assertMovement(beforeState, afterState, id) {
  const before = parsed(beforeState), after = parsed(afterState)
  assertSelected(beforeState, id); assertSelected(afterState, id)
  const beforePoint = before.runtime.strata.find((point) => point.id === id), afterPoint = after.runtime.strata.find((point) => point.id === id)
  assert.ok(beforePoint && afterPoint); assert.equal(beforePoint.geometricKind, 'point')
  assert.equal(beforePoint.codim, before.runtime.ambientDimension); assert.equal(afterPoint.codim, beforePoint.codim)
  assert.notDeepEqual(afterPoint.position, beforePoint.position, 'Native handle drag changes the selected model position')
  if (before.runtime.ambientDimension === 2) assert.equal(afterPoint.position.z, 0)
  for (const key of ['x', 'y', 'z']) assert.ok(Number.isFinite(afterPoint.position[key]))
  for (const kind of ['saved', 'runtime']) {
    const restored = structuredClone(after[kind]), old = kind === 'saved' ? before.saved.diagram : before.runtime
    const diagram = kind === 'saved' ? restored.diagram : restored
    const index = diagram.strata.findIndex((point) => point.id === id)
    diagram.strata[index].position = structuredClone(old.strata.find((point) => point.id === id).position)
    assert.deepEqual(restored, before[kind], 'Only the selected point position changes; camera, other points and data are preserved')
  }
  assert.deepEqual(after.saved.diagram.strata.find((point) => point.id === id).position, afterPoint.position)
  assert.deepEqual(after.history, { past: [...before.history.past, before.history.present].slice(-100), present: after.runtime, future: [] }, 'Native drag creates exactly one effective bounded history commit')
  assert.deepEqual(before.history.present, before.runtime); assert.deepEqual(afterState.uiSettings, beforeState.uiSettings)
  assert.ok(Number.isInteger(afterState.labelDocumentRevision) && afterState.labelDocumentRevision > beforeState.labelDocumentRevision)
}
export function assertPointNativeDragEvidence(observation) {
  assert.equal(observation?.kind, 'point-native-drag')
  assert.ok(Number.isInteger(observation.sequence) && observation.sequence > 0)
  assert.ok(observation.displacement && Object.values(observation.displacement).every(Number.isFinite))
  assert.ok(Number.isInteger(observation.steps) && observation.steps > 0)
  assert.deepEqual(observation.secondaryErrors, [])
  assertPointCanvasPreparation(observation.preparation, observation.id)
  assertUnchangedState(observation.preparation.statePrepared, observation.stateBefore, 'Before native drag')
  assert.deepEqual(observation.before.modelPoint, parsed(observation.stateBefore).runtime.strata.find((point) => point.id === observation.id), 'Before handle owner matches authoritative model')
  assert.deepEqual(observation.afterAction.observation.modelPoint, parsed(observation.afterAction.state).runtime.strata.find((point) => point.id === observation.id), 'After handle owner matches authoritative model')
  assert.equal(observation.before.labelDocumentRevision, observation.stateBefore.labelDocumentRevision)
  assert.equal(observation.afterAction.observation.labelDocumentRevision, observation.afterAction.state.labelDocumentRevision)
  assertNativeDelivery(observation)
  assertMovement(observation.stateBefore, observation.afterAction.state, observation.id)
  assertUnchangedState(observation.afterAction.state, observation.undo.stateBefore, 'Before Undo')
  const moved = parsed(observation.afterAction.state), undone = parsed(observation.undo.stateAfter), redone = parsed(observation.redo.stateAfter)
  assert.equal(observation.undo.stateAfter.json, observation.stateBefore.json, 'Undo restores exact saved JSON')
  assert.equal(observation.undo.stateAfter.runtimeDiagramJson, observation.stateBefore.runtimeDiagramJson, 'Undo restores exact runtime model')
  assert.deepEqual(undone.history, { past: moved.history.past.slice(0, -1), present: undone.runtime, future: [moved.runtime] }, 'Undo reverses precisely the drag history commit')
  assertUnchangedState(observation.undo.stateAfter, observation.redo.stateBefore, 'Before Redo')
  assert.equal(observation.redo.stateAfter.json, observation.afterAction.state.json, 'Redo restores exact saved JSON')
  assert.equal(observation.redo.stateAfter.runtimeDiagramJson, observation.afterAction.state.runtimeDiagramJson, 'Redo restores exact runtime model')
  assert.deepEqual(redone.history, moved.history, 'Redo restores exact post-drag history')
  for (const action of [observation.undo, observation.redo]) {
    assertSelected(action.stateAfter, observation.id); assertSnapshot(action.observation, observation.id)
    assert.deepEqual(action.stateAfter.uiSettings, observation.stateBefore.uiSettings)
    assert.ok(action.stateAfter.labelDocumentRevision > action.stateBefore.labelDocumentRevision)
    assert.equal(action.observation.labelDocumentRevision, action.stateAfter.labelDocumentRevision)
    assert.deepEqual(action.observation.modelPoint, parsed(action.stateAfter).runtime.strata.find((point) => point.id === observation.id))
  }
  assert.deepEqual(observation.afterAction.observation.camera, observation.before.camera)
  assert.deepEqual(observation.afterAction.observation.workPlaneControls, observation.before.workPlaneControls)
  assert.deepEqual(observation.afterAction.observation.workPlaneStatus, observation.before.workPlaneStatus)
}

function diagnosticOwner({ diagnose, secondaryErrors, observation }) {
  const failures = []
  const diagnostic = async (name, operation) => {
    try { return await boundedPointDiagnostic(operation, `Native point drag ${name}`) }
    catch (error) {
      failures.push(error); observation.secondaryErrors.push({ name, message: String(error.message).slice(0, 4000) })
      secondaryErrors.push(`Native point drag ${name}: ${error.message}`)
    }
  }
  return { failures, diagnostic, evidence: (boundary) => diagnostic(`${boundary} evidence`, () => diagnose({ boundary, observation })) }
}
async function prepareCanvas({ page, readState, id, token, observation, diagnostic, evidence }) {
  const preparation = observation.preparation
  preparation.stateBefore = await diagnostic('state before preparation', readState)
  preparation.inherited = await diagnostic('inherited drawer and handle', () => page.evaluate(observePointNativeDrag, { token, id }))
  let primary
  try {
    const drawer = page.locator('#preview-inspector-drawer')
    preparation.drawerCount = await drawer.count()
    assert.ok([0, 1].includes(preparation.drawerCount), 'Inspector drawer is unique')
    if (preparation.drawerCount === 1) {
      const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true })
      assert.equal(await close.count(), 1, 'Open Inspector has one native close control')
      preparation.closeActions++
      await close.click({ timeout: 5000 }); await drawer.waitFor({ state: 'detached', timeout: 5000 })
    }
    preparation.closedDrawerCount = await drawer.count()
    const open = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
    preparation.openerCount = await open.count(); preparation.openerExpanded = await open.getAttribute('aria-expanded', { timeout: 5000 })
  } catch (error) { primary = error; preparation.error = { message: error.message, stack: error.stack } }
  preparation.closed = await diagnostic('closed drawer observation', () => page.evaluate(observePointNativeDrag, { token, id }))
  preparation.stateAfter = await diagnostic('state after drawer close', readState)
  await evidence('canvas-drawer-prepared')
  if (primary) throw primary
  assert.equal(preparation.closedDrawerCount, 0); assert.equal(preparation.openerCount, 1); assert.equal(preparation.openerExpanded, 'false')
  assertUnchangedState(preparation.stateBefore, preparation.stateAfter, 'Inspector close'); assertSelected(preparation.stateAfter, id)
  await page.getByRole('button', { name: 'Select', exact: true }).click({ timeout: 5000 })
  await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded({ timeout: 5000 })
  preparation.prepared = await diagnostic('fresh prepared canvas', () => page.evaluate(observePointNativeDrag, { token, id }))
  preparation.statePrepared = await diagnostic('state after Select/scroll', readState)
  await evidence('canvas-input-prepared-before-assertion')
  assertPointCanvasPreparation(preparation, id)
}

/** Scoped preparation for fresh owner-cycling clicks. It never reselects a point. */
export async function prepareSelectedPointCanvas({ page, readState, diagnose, secondaryErrors,
  scenario, sequence, id = 'app-point' }) {
  const token = `point-canvas:${scenario}:${sequence}:${id}`
  const observation = { scenario, sequence, id, preparation: { closeActions: 0 }, secondaryErrors: [] }
  const owner = diagnosticOwner({ diagnose, secondaryErrors, observation })
  let primary, installed = false
  try {
    await page.evaluate(installPointNativeDragObserver, { token, id })
    installed = true
    await prepareCanvas({ page, readState, id, token, observation, ...owner })
  } catch (error) { primary = error }
  finally {
    if (installed) {
      await owner.diagnostic('final preparation observation', async () => {
        observation.final = await page.evaluate(observePointNativeDrag, { token, id })
      })
      await owner.diagnostic('preparation observer cleanup', () => page.evaluate(removePointNativeDragObserver, token))
    }
    if (primary) observation.primary = { message: primary.message, stack: primary.stack }
    await owner.evidence('canvas-preparation-finished')
  }
  if (primary) throw primary
  if (owner.failures.length) throw new AggregateError(owner.failures, 'Native point preparation diagnostics failed')
  return observation.preparation
}

/** One native drag through the selected production handle, then native Undo/Redo.
 * Raw state/events precede every movement/history assertion and survive failures. */
export async function dragSelectedPoint({ page, readState, diagnose, secondaryErrors,
  scenario, sequence, id = 'app-point', displacement, steps = 4 }) {
  const token = `point-drag:${scenario}:${sequence}:${id}`
  const observation = { kind: 'point-native-drag', scenario, sequence, id, displacement, steps,
    preparation: { closeActions: 0 }, secondaryErrors: [] }
  const owner = diagnosticOwner({ diagnose, secondaryErrors, observation })
  let primary, pointerPressed = false, installed = false
  try {
    await page.evaluate(installPointNativeDragObserver, { token, id })
    installed = true
    await prepareCanvas({ page, readState, id, token, observation, ...owner })
    await page.evaluate(setPointNativeDragPhase, { token, phase: 'setup' })
    observation.before = await owner.diagnostic('fresh handle before drag', () => page.evaluate(observePointNativeDrag, { token, id }))
    observation.stateBefore = await owner.diagnostic('authoritative state before drag', readState)
    await owner.evidence('handle-before-native-input')
    assertFreshHandle(observation.before, id)
    assertUnchangedState(observation.preparation.statePrepared, observation.stateBefore, 'Fresh handle measurement')
    const start = observation.before.handle.start, end = { x: start.x + displacement.x, y: start.y + displacement.y }
    observation.requested = { start, end }
    try {
      await page.mouse.move(start.x, start.y)
      await page.evaluate(setPointNativeDragPhase, { token, phase: 'drag' })
      pointerPressed = true; await page.mouse.down()
      await page.mouse.move(end.x, end.y, { steps }); await page.mouse.up(); pointerPressed = false
    } catch (error) { primary = error; observation.actionError = { message: error.message, stack: error.stack } }
    observation.afterAction = { state: await owner.diagnostic('after drag state', readState),
      observation: await owner.diagnostic('after drag delivery', () => page.evaluate(observePointNativeDrag, { token, id })) }
    await owner.evidence('after-native-drag-before-assertion')
    if (primary) throw primary
    assertNativeDelivery(observation)
    assertMovement(observation.stateBefore, observation.afterAction.state, id)
    for (const [phase, label] of [['undo', 'Undo last diagram change'], ['redo', 'Redo last undone diagram change']]) {
      observation[phase] = { stateBefore: await owner.diagnostic(`before ${phase} state`, readState) }
      await owner.evidence(`before-native-${phase}`)
      await page.evaluate(setPointNativeDragPhase, { token, phase })
      let actionPrimary
      try { await page.getByRole('button', { name: label, exact: true }).click({ timeout: 5000 }) }
      catch (error) { actionPrimary = error; observation[phase].actionError = { message: error.message, stack: error.stack } }
      observation[phase].stateAfter = await owner.diagnostic(`after ${phase} state`, readState)
      observation[phase].observation = await owner.diagnostic(`after ${phase} observation`, () => page.evaluate(observePointNativeDrag, { token, id }))
      await owner.evidence(`after-native-${phase}-before-assertion`)
      if (actionPrimary) throw actionPrimary
      assert.equal(observation[phase].stateAfter.json, phase === 'undo' ? observation.stateBefore.json : observation.afterAction.state.json, `${phase} restores exact saved JSON`)
      assert.equal(observation[phase].stateAfter.runtimeDiagramJson, phase === 'undo' ? observation.stateBefore.runtimeDiagramJson : observation.afterAction.state.runtimeDiagramJson, `${phase} restores exact runtime JSON`)
    }
    assertPointNativeDragEvidence(observation)
  } catch (error) { primary ??= error }
  finally {
    if (pointerPressed) await owner.diagnostic('release held native pointer', async () => {
      await page.evaluate(setPointNativeDragPhase, { token, phase: 'cleanup' }); await page.mouse.up()
    })
    if (installed) {
      await owner.diagnostic('final native drag observation', async () => {
        observation.final = await page.evaluate(observePointNativeDrag, { token, id })
      })
      await owner.diagnostic('observer cleanup', () => page.evaluate(removePointNativeDragObserver, token))
    }
    if (primary) observation.primary = { message: primary.message, stack: primary.stack }
    await owner.evidence('native-drag-finished')
  }
  if (primary) throw primary
  if (owner.failures.length) throw new AggregateError(owner.failures, 'Native point drag diagnostics failed')
  return observation
}
