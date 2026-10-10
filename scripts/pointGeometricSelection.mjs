import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

// These three functions run in the actual App document. They only observe;
// native mouse input and production selection remain owned by the caller.
export function installGeometricSelectionObserver({ token, id }) {
  const registry = window.__stzGeometricSelectionObservers ??= new Map()
  if (registry.has(token)) throw new Error(`Selection observer already owned: ${token}`)
  const describe = (element) => element instanceof Element ? {
    tag: element.localName, id: element.id, class: element.getAttribute('class'),
    pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    drawer: !!element.closest('#preview-inspector-drawer'),
    ariaLabel: element.getAttribute('aria-label'),
    svg: element instanceof SVGElement, canvas: !!element.closest('svg.svg-diagram'),
    canvasRoot: element.matches('svg.svg-diagram'),
    pointHandle: element.matches('circle.svg-geometry-handle') && !!element.closest('[aria-label="Selected point drag handles"]'),
    creationToolbar: !!element.closest('.preview-floating-toolbar'),
    toolbarOverlay: !!element.closest('.preview-toolbar-overlay-stack'),
    quickStyle: !!element.closest('.context-quick-style-bar'), history: !!element.closest('.preview-history-overlay'),
  } : null
  const owned = { events: [], droppedEvents: 0, errors: [] }
  owned.listener = (event) => {
    if (owned.events.length === 16) { owned.droppedEvents++; return }
    let state
    try { state = window.stzAppLabels.state() }
    catch (error) { owned.errors.push({ name: 'event App state', message: error.message }) }
    const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
    const body = node?.querySelector('[data-label-state]')
    const select = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Select')
    owned.events.push({ type: event.type, trusted: event.isTrusted, at: performance.now(),
      client: { x: event.clientX, y: event.clientY }, page: { x: event.pageX, y: event.pageY },
      screen: { x: event.screenX, y: event.screenY }, button: event.button,
      pointerType: event.pointerType ?? null, target: describe(event.target),
      pointerId: event.pointerId ?? null,
      canvasHasPointerCapture: typeof event.pointerId === 'number'
        && (document.querySelector('svg.svg-diagram')?.hasPointerCapture(event.pointerId) ?? false),
      App: { selection: state?.selection ?? null, labelDocumentRevision: state?.labelDocumentRevision ?? null,
        selectPressed: select?.getAttribute('aria-pressed') ?? null },
      layout: { owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
        shape: node?.getAttribute('data-point-shape') ?? null, source: body?.getAttribute('data-label-source') ?? null },
      path: event.composedPath().slice(0, 16).map(describe) })
  }
  registry.set(token, owned)
  for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, owned.listener, true)
}

export function observeGeometricSelection({ id, click, token }) {
  const errors = []
  const safe = (name, operation) => {
    try { return operation() } catch (error) { errors.push({ name, message: error.message }); return null }
  }
  const rect = (element) => {
    if (!element) return null
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }
  const matrix = (element, method) => {
    const value = element?.[method]?.()
    return value ? Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]])) : null
  }
  const describe = (element) => element ? { tag: element.localName, id: element.id,
    class: element.getAttribute('class'), pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    drawer: !!element.closest('#preview-inspector-drawer'), ariaLabel: element.getAttribute('aria-label'),
    svg: element instanceof SVGElement, canvas: !!element.closest('svg.svg-diagram'),
    canvasRoot: element.matches('svg.svg-diagram'),
    pointHandle: element.matches('circle.svg-geometry-handle') && !!element.closest('[aria-label="Selected point drag handles"]'),
    creationToolbar: !!element.closest('.preview-floating-toolbar'),
    toolbarOverlay: !!element.closest('.preview-toolbar-overlay-stack'),
    quickStyle: !!element.closest('.context-quick-style-bar'), history: !!element.closest('.preview-history-overlay') } : null
  const outer = document.querySelector(`[data-point-id="${CSS.escape(id)}"]`)
  const node = outer?.querySelector('[data-point-node]'), contour = node?.querySelector('[data-point-contour]')
  const body = node?.querySelector('[data-label-state]'), canvas = document.querySelector('svg.svg-diagram')
  const drawer = document.getElementById('preview-inspector-drawer')
  const select = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Select')
  const state = safe('App state', () => window.stzAppLabels.state())
  const model = state && safe('model JSON', () => JSON.parse(state.runtimeDiagramJson))
  const owned = window.__stzGeometricSelectionObservers?.get(token)
  const overlays = document.querySelectorAll('.preview-toolbar-overlay-stack')
  const countControl = (name) => [...document.querySelectorAll('button')].filter((element) => element.getAttribute('aria-label') === name).length
  const toolbar = { overlayCount: overlays.length, collapsed: overlays.length === 1 && overlays[0].classList.contains('is-collapsed'),
    floatingCount: document.querySelectorAll('section.preview-floating-toolbar').length,
    expandCount: countControl('Expand preview toolbar'), collapseCount: countControl('Collapse preview toolbar'),
    quickStyleCount: document.querySelectorAll('.context-quick-style-bar').length,
    historyCount: document.querySelectorAll('.preview-history-overlay').length }
  const workPlaneControls = [...document.querySelectorAll('input,select,button')].filter((element) =>
    !element.closest('#preview-inspector-drawer,.preview-floating-toolbar,.context-quick-style-bar')
    && (element.closest('#preview-work-plane-panel,.work-plane-control')
      || /work.?plane/i.test([element.getAttribute('aria-label'), element.id, element.className].join(' ')))).slice(0, 48)
    .map((element) => ({ tag: element.localName, id: element.id, ariaLabel: element.getAttribute('aria-label'),
      value: element.value ?? null, pressed: element.getAttribute('aria-pressed'), checked: element.checked ?? null }))
  if (token && !owned) errors.push({ name: 'observer ownership', message: 'Selection observer is missing' })
  for (const [name, element] of [['canvas', canvas], ['point', node], ['contour', contour], ['body', body]]) {
    if (!element?.isConnected) errors.push({ name, message: 'Required connected selection element is missing' })
    else if (!element.getScreenCTM()) errors.push({ name, message: 'Required selection screen CTM is unavailable' })
  }
  const scrollAncestors = []
  for (let element = canvas; element && scrollAncestors.length < 8; element = element.parentElement) {
    scrollAncestors.push({ element: describe(element), bounds: rect(element), scrollTop: element.scrollTop, scrollLeft: element.scrollLeft })
  }
  const contourLength = safe('contour length', () => contour.getTotalLength())
  const localBoundary = safe('contour local boundary', () => {
    const point = contour.getPointAtLength(contourLength * .23); return { x: point.x, y: point.y }
  })
  const boundary = safe('contour screen boundary', () => {
    const point = contour.getPointAtLength(contourLength * .23).matrixTransform(contour.getScreenCTM())
    return { x: point.x, y: point.y }
  })
  const center = safe('point screen center', () => {
    const point = new DOMPoint().matrixTransform(node.getScreenCTM()); return { x: point.x, y: point.y }
  })
  return { at: performance.now(), requestedClick: click, readyState: document.readyState, toolbar, workPlaneControls,
    workPlaneStatus: [...document.querySelectorAll('.work-plane-status,.preview-work-plane-status,.work-plane-summary')].map((element) => element.textContent),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio,
      scrollX, scrollY, visual: visualViewport ? { width: visualViewport.width, height: visualViewport.height,
        offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null },
    model: model?.strata.find((point) => point.id === id) ?? null, camera: model?.camera ?? null,
    labelDocumentRevision: state?.labelDocumentRevision ?? null, selection: state?.selection ?? null,
    tool: { selectPressed: select?.getAttribute('aria-pressed') ?? null,
      selectedButtons: [...document.querySelectorAll('button[aria-pressed="true"]')].slice(0, 16).map(describe) },
    layout: { shape: node?.getAttribute('data-point-shape') ?? null,
      parameters: node?.getAttribute('data-point-shape-parameters') ?? null,
      owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
      bodyRequest: body?.getAttribute('data-label-request') ?? null,
      source: body?.getAttribute('data-label-source') ?? null, state: body?.getAttribute('data-label-state') ?? null },
    geometry: Object.fromEntries([['canvas', canvas], ['point', node], ['contour', contour], ['body', body]].map(([name, element]) => [name, {
      bounds: safe(`${name} bounds`, () => rect(element)),
      screenCTM: safe(`${name} screenCTM`, () => matrix(element, 'getScreenCTM')),
      CTM: safe(`${name} CTM`, () => matrix(element, 'getCTM')),
      connected: element?.isConnected ?? false,
      ...(name === 'contour' ? { length: contourLength, fraction: .23, localBoundary, boundary } : {}),
      ...(name === 'point' ? { center } : {}),
    }])), scrollAncestors,
    inspector: { open: !!drawer, bounds: rect(drawer), noSelection: drawer?.textContent.includes('No selection') ?? false,
      expansionControls: drawer ? [...drawer.querySelectorAll('button')].filter((element) => ['Expand', 'Collapse'].includes(element.textContent.trim()))
        .map((element) => ({ text: element.textContent.trim(), expanded: element.getAttribute('aria-expanded') })) : [],
      style: drawer ? { display: getComputedStyle(drawer).display, visibility: getComputedStyle(drawer).visibility,
        pointerEvents: getComputedStyle(drawer).pointerEvents, zIndex: getComputedStyle(drawer).zIndex } : null },
    selectionHandles: [...document.querySelectorAll('[aria-label="Selected point drag handles"]')].map((element) => ({ element: describe(element), bounds: rect(element) })),
    elementFromPoint: click ? describe(document.elementFromPoint(click.x, click.y)) : null,
    elementsFromPoint: click ? document.elementsFromPoint(click.x, click.y).slice(0, 16).map(describe) : [],
    events: owned ? [...owned.events] : [], droppedEvents: owned?.droppedEvents ?? null, errors: [...errors, ...(owned?.errors ?? [])] }
}

export function removeGeometricSelectionObserver(token) {
  const registry = window.__stzGeometricSelectionObservers, owned = registry?.get(token)
  if (owned) for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, owned.listener, true)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzGeometricSelectionObservers
}

// A selected point's production drag handle is outside its data-point-id group.
// Only that exact SVG handle path may substitute for the owned point path, and
// only when the intended point was already selected before this native click.
function intendedSelectionTarget(target, selection, id, requireUnselected) {
  return target?.svg === true && target.canvas === true && target.drawer === false
    && (target.pointId === id || (!requireUnselected && selection?.id === id && target.pointHandle === true))
}

function intendedSelectionPath(event, selection, id, requireUnselected) {
  return intendedSelectionTarget(event.target, selection, id, requireUnselected)
    && event.path.some((element) => element?.canvasRoot === true)
    && (event.target.pointId === id ? event.path.some((element) => element?.pointId === id)
      : event.path.some((element) => element?.ariaLabel === 'Selected point drag handles'))
}

function assertToolbar(snapshot) {
  assert.deepEqual(snapshot?.errors, [], 'Toolbar observation is complete')
  const toolbar = snapshot.toolbar
  assert.equal(toolbar.overlayCount, 1, 'Preview toolbar overlay is unique')
  assert.equal(toolbar.historyCount, 1, 'History overlay remains mounted')
  assert.equal(typeof toolbar.collapsed, 'boolean')
  assert.equal(toolbar.floatingCount, toolbar.collapsed ? 0 : 1, 'Creation toolbar matches collapsed state')
  assert.equal(toolbar.expandCount, toolbar.collapsed ? 1 : 0, 'Collapsed toolbar has one native expand control')
  assert.equal(toolbar.collapseCount, toolbar.collapsed ? 0 : 1, 'Expanded toolbar has one native collapse control')
  if (toolbar.collapsed) assert.equal(toolbar.quickStyleCount, 0, 'Collapsed toolbar detaches quick style controls')
}

function assertUiState(state, snapshot) {
  assert.ok(state && typeof state.json === 'string' && typeof state.runtimeDiagramJson === 'string' && typeof state.history === 'string',
    'Native UI preparation retains authoritative saved/runtime/history records')
  assert.ok(Object.hasOwn(state, 'selection') && typeof state.uiSettings === 'string', 'Native UI preparation retains selection and UI settings')
  assert.ok(Number.isInteger(state.labelDocumentRevision) && state.labelDocumentRevision >= 0, 'Document epoch is a nonnegative integer')
  assert.equal(snapshot.labelDocumentRevision, state.labelDocumentRevision, 'Observed epoch matches authoritative state')
  assert.deepEqual(snapshot.selection, state.selection, 'Observed selection matches authoritative state')
  const model = JSON.parse(state.runtimeDiagramJson)
  assert.deepEqual(snapshot.camera, model.camera ?? null, 'Observed camera matches authoritative state')
  assert.ok(Array.isArray(snapshot.workPlaneControls) && Array.isArray(snapshot.workPlaneStatus), 'Active work plane is retained')
  assert.ok(model.strata.some((point) => point.id === snapshot.model?.id), 'Observed point belongs to the current document')
  assert.deepEqual(snapshot.model, model.strata.find((point) => point.id === snapshot.model.id), 'Observed point matches authoritative state')
  assert.deepEqual(JSON.parse(snapshot.layout.owner), ['point-node', state.labelDocumentRevision, snapshot.model.id], 'Layout belongs to the current document and point')
  assert.ok(snapshot.layout.request, 'Current layout request is retained')
  assert.equal(snapshot.layout.request, snapshot.layout.bodyRequest, 'Point and body share the current layout request')
  assert.equal(snapshot.layout.source, snapshot.model.text ?? '', 'Layout preserves current raw point source')
}

function assertUiPreserved(beforeState, afterState, before, after, name) {
  assertUiState(beforeState, before); assertUiState(afterState, after)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'selection', 'uiSettings']) {
    assert.deepEqual(afterState[field], beforeState[field], `${name} preserves ${field}`)
  }
  for (const field of ['model', 'camera', 'workPlaneControls', 'workPlaneStatus', 'layout']) {
    assert.deepEqual(after[field], before[field], `${name} preserves ${field}`)
  }
}

async function nativeToolbarAction({ page, readState, id, preparation, diagnostic, evidence, name, purpose }) {
  const action = { name, purpose }
  preparation.actions.push(action)
  action.stateBefore = await diagnostic(`before ${purpose} ${name} state`, readState)
  action.before = await diagnostic(`before ${purpose} ${name} toolbar`, () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
  let primary
  try {
    // Cleanup must still attempt its owned native toggle when a secondary
    // diagnostic read failed. Missing raw records continue to fail acceptance.
    if (purpose !== 'restore') { assertToolbar(action.before); assertUiState(action.stateBefore, action.before) }
    const controlName = name === 'Select' ? 'Select' : `${name === 'collapse' ? 'Collapse' : 'Expand'} preview toolbar`
    const control = page.getByRole('button', { name: controlName, exact: true })
    action.controlCount = await control.count()
    assert.equal(action.controlCount, 1, `${controlName} has one native control`)
    await control.click({ timeout: 5000 })
    if (name === 'Select') action.pressed = await control.getAttribute('aria-pressed', { timeout: 5000 })
    else {
      const collapsed = name === 'collapse'
      await page.locator('section.preview-floating-toolbar').waitFor({ state: collapsed ? 'detached' : 'visible', timeout: 5000 })
      await page.locator(`.preview-toolbar-overlay-stack${collapsed ? '.is-collapsed' : ':not(.is-collapsed)'}`).waitFor({ state: 'visible', timeout: 5000 })
      const opposite = page.getByRole('button', { name: `${collapsed ? 'Expand' : 'Collapse'} preview toolbar`, exact: true })
      action.oppositeCount = await opposite.count()
      assert.equal(action.oppositeCount, 1, 'Toolbar transition has one opposite native control')
      await opposite.waitFor({ state: 'visible', timeout: 5000 })
    }
  } catch (error) { primary = error; action.error = { message: error.message, stack: error.stack } }
  action.stateAfter = await diagnostic(`after ${purpose} ${name} state`, readState)
  action.after = await diagnostic(`after ${purpose} ${name} toolbar`, () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
  await evidence(`toolbar-${purpose}-${name}-before-assertion`)
  if (primary) throw primary
  assertToolbar(action.after)
  assertUiPreserved(action.stateBefore, action.stateAfter, action.before, action.after, `Native toolbar ${purpose} ${name}`)
  if (name === 'Select') {
    assert.equal(action.pressed, 'true', 'Native Select action activates Select while its control is visible')
    assert.equal(action.after.tool.selectPressed, 'true', 'Observed Select control is pressed')
    assert.equal(action.after.toolbar.collapsed, false)
  } else assert.equal(action.after.toolbar.collapsed, name === 'collapse', 'Native toolbar action reached its requested state')
  return action
}

// Select must be available before a temporary contour-only collapse. Also used
// by native drag preparation when a caller inherited a collapsed toolbar.
export async function ensureGeometricSelectAccess({ page, readState, id, preparation, diagnostic, evidence }) {
  preparation.stateBefore = await diagnostic('inherited toolbar state', readState)
  preparation.inherited = await diagnostic('inherited toolbar', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
  preparation.actions ??= []
  await evidence('toolbar-inherited')
  assertToolbar(preparation.inherited); assertUiState(preparation.stateBefore, preparation.inherited)
  if (preparation.inherited.toolbar.collapsed) {
    await nativeToolbarAction({ page, readState, id, preparation, diagnostic, evidence, name: 'expand', purpose: 'select-access' })
  }
  const selected = await nativeToolbarAction({ page, readState, id, preparation, diagnostic, evidence, name: 'Select', purpose: 'select' })
  preparation.prepared = selected.after; preparation.statePrepared = selected.stateAfter
}

/** Validate the retained raw UI action records independently of the gesture. */
export function assertGeometricToolbarPreparation(preparation, restoration) {
  assertToolbar(preparation?.inherited); assertUiState(preparation.stateBefore, preparation.inherited)
  assert.equal(preparation.actions.filter((action) => action.name === 'Select').length, 1, 'One native Select action is retained')
  let selected = false, obstruction = false
  for (const action of preparation.actions) {
    assert.equal(action.error, undefined, 'Native toolbar action succeeded')
    assert.equal(action.controlCount, 1, 'Native toolbar action used one unique control')
    assertToolbar(action.before); assertToolbar(action.after)
    assertUiPreserved(action.stateBefore, action.stateAfter, action.before, action.after, `Retained ${action.name} action`)
    if (action.name === 'Select') {
      assert.equal(action.purpose, 'select'); assert.equal(action.before.toolbar.collapsed, false)
      assert.equal(action.after.toolbar.collapsed, false); assert.equal(action.pressed, 'true')
      assert.equal(action.after.tool.selectPressed, 'true'); selected = true
    } else {
      assert.ok(['expand', 'collapse'].includes(action.name)); assert.equal(action.oppositeCount, 1)
      assert.equal(action.after.toolbar.collapsed, action.name === 'collapse')
      assert.notEqual(action.before.toolbar.collapsed, action.after.toolbar.collapsed)
      if (action.purpose === 'select-access') {
        assert.equal(selected, false); assert.equal(action.name, 'expand'); assert.equal(preparation.inherited.toolbar.collapsed, true)
      } else if (action.purpose === 'obstruction') {
        assert.equal(selected, true); assert.equal(obstruction, false); assert.equal(action.name, 'collapse'); obstruction = true
        const hit = preparation.obstructed.observation.elementFromPoint
        assert.ok(hit.creationToolbar === true || (hit.quickStyle === true && hit.toolbarOverlay === true), 'Owned toolbar obstruction is retained')
      } else assert.equal(action.purpose, 'restore')
    }
  }
  assertToolbar(preparation.prepared)
  assertUiPreserved(preparation.stateBefore, preparation.statePrepared, preparation.inherited, preparation.prepared, 'Retained toolbar preparation')
  assert.equal(restoration?.error, undefined)
  assertToolbar(restoration?.before); assertToolbar(restoration?.after)
  assertUiPreserved(restoration.stateBefore, restoration.stateAfter, restoration.before, restoration.after, 'Retained toolbar restoration')
  assert.equal(restoration.after.toolbar.collapsed, preparation.inherited.toolbar.collapsed)
}

export async function restoreGeometricCanvasToolbar({ page, readState, id, preparation, restoration, diagnostic, evidence }) {
  // An earlier observer/preparation failure may precede ownership of any UI.
  if (!preparation.inherited) return
  restoration.stateBefore = await diagnostic('before toolbar restoration state', readState)
  restoration.before = await diagnostic('before toolbar restoration', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
  let primary
  try {
    const collapsed = preparation.inherited.toolbar.collapsed
    // Use actual unique controls for cleanup, even when the preceding raw
    // observation failed. No synthetic DOM change or repeated click is used.
    restoration.expandCount = await page.getByRole('button', { name: 'Expand preview toolbar', exact: true }).count()
    restoration.collapseCount = await page.getByRole('button', { name: 'Collapse preview toolbar', exact: true }).count()
    assert.ok((restoration.expandCount === 1 && restoration.collapseCount === 0)
      || (restoration.expandCount === 0 && restoration.collapseCount === 1), 'Toolbar restoration has one actual state control')
    if ((restoration.expandCount === 1) !== collapsed) {
      await nativeToolbarAction({ page, readState, id, preparation, diagnostic, evidence,
        name: collapsed ? 'collapse' : 'expand', purpose: 'restore' })
    }
  } catch (error) { primary = error; restoration.error = { message: error.message, stack: error.stack } }
  restoration.stateAfter = await diagnostic('after toolbar restoration state', readState)
  restoration.after = await diagnostic('after toolbar restoration', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
  await evidence('toolbar-restored-before-assertion')
  if (primary) throw primary
  assertToolbar(restoration.after)
  assertUiPreserved(restoration.stateBefore, restoration.stateAfter, restoration.before, restoration.after, 'Toolbar restoration')
  assert.equal(restoration.after.toolbar.collapsed, preparation.inherited.toolbar.collapsed, 'Only owned toolbar state is restored')
}

export function assertFreshGeometricClick(snapshot, rendered, click, boundary) {
  assert.deepEqual(snapshot?.errors, [], 'Fresh selection geometry observation is complete')
  const contour = snapshot.geometry.contour, point = snapshot.geometry.point
  assert.equal(contour.connected, true, 'Fresh selection contour is connected')
  assert.ok(contour.length > 0 && Number.isFinite(contour.length))
  assert.equal(contour.fraction, .23, 'Boundary uses the preserved .23 arclength input')
  const matrix = contour.screenCTM
  assert.ok(matrix && Object.values(matrix).every(Number.isFinite), 'Fresh contour screen CTM is finite')
  assert.notEqual(matrix.a * matrix.d - matrix.b * matrix.c, 0, 'Fresh contour screen CTM is nonsingular')
  const local = rendered.bodyOverflow ? rendered.bodyOverflow.clickInContour : contour.localBoundary
  const transformed = { x: matrix.a * local.x + matrix.c * local.y + matrix.e,
    y: matrix.b * local.x + matrix.d * local.y + matrix.f }
  const expected = boundary ? (rendered.bodyOverflow ? transformed : contour.boundary) : point.center
  assert.ok(expected && [expected.x, expected.y, click?.x, click?.y].every(Number.isFinite), 'Fresh click coordinates are finite')
  if (boundary) for (const key of ['x', 'y']) {
    // SVGPoint.matrixTransform can return binary32 coordinates. Preserve that
    // native result; exact binary32 rounding is not a geometry tolerance.
    assert.ok(Math.abs(transformed[key] - expected[key]) < 1e-7
      || (!rendered.bodyOverflow && expected[key] === Math.fround(transformed[key])), 'Boundary matches current contour screen CTM')
  }
  if (boundary && !rendered.bodyOverflow) assert.deepEqual(click, expected, 'Native boundary input equals the current native .23 measurement')
  else for (const key of ['x', 'y']) assert.ok(Math.abs(click[key] - expected[key]) < 1e-7, 'Native click uses freshly measured connected geometry')
  assert.deepEqual(snapshot.requestedClick, click, 'Hit test uses the current requested click')
}

/** Prepare only this native canvas input; restore through native controls after
 * the caller's observer/input boundary. Other overlay obstructions remain errors. */
export async function prepareGeometricCanvasClick({ page, readState, observePoint, id, boundary, requireUnselected = false,
  preparation, diagnostic, evidence }) {
  preparation.clickKind = boundary ? 'boundary' : 'center'
  await ensureGeometricSelectAccess({ page, readState, id, preparation, diagnostic, evidence })
  const measure = async () => {
    await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded({ timeout: 5000 })
    const rendered = await observePoint(page, id)
    assert.ok(rendered, 'Selection has freshly measured connected point geometry')
    const click = boundary ? rendered.boundary : rendered.center
    const snapshot = await diagnostic('fresh contour hit', () => page.evaluate(observeGeometricSelection, { id, click, token: null }))
    const state = await diagnostic('fresh contour state', readState)
    return { rendered, requestedClick: click, observation: snapshot, state }
  }
  preparation.obstructed = await measure()
  await evidence('toolbar-contour-measured')
  const first = preparation.obstructed
  assertFreshGeometricClick(first.observation, first.rendered, first.requestedClick, boundary)
  assertToolbar(first.observation); assertUiState(first.state, first.observation)
  const hit = first.observation.elementFromPoint
  if (!first.observation.toolbar.collapsed && (hit?.creationToolbar === true || (hit?.quickStyle === true && hit.toolbarOverlay === true))) {
    await nativeToolbarAction({ page, readState, id, preparation, diagnostic, evidence, name: 'collapse', purpose: 'obstruction' })
    // Native toggle/scroll can change screen placement. Never reuse its old CTM.
    preparation.finalMeasurement = await measure()
  } else preparation.finalMeasurement = first
  const final = preparation.finalMeasurement
  if (final.rendered.bodyOverflow) preparation.clickKind = 'body'
  preparation.prepared = final.observation; preparation.statePrepared = final.state
  preparation.rendered = final.rendered; preparation.requestedClick = final.requestedClick
  await evidence('toolbar-canvas-prepared-before-assertion')
  assertFreshGeometricClick(final.observation, final.rendered, final.requestedClick, boundary)
  assertUiPreserved(preparation.stateBefore, final.state, preparation.inherited, final.observation, 'Canvas toolbar preparation')
  assert.equal(final.observation.inspector.open, false, 'Inspector stays closed at native input')
  if (requireUnselected) assert.equal(final.observation.selection, null, 'Initial circle setup is unselected before the native click')
  assert.ok(intendedSelectionTarget(final.observation.elementFromPoint, final.observation.selection, id, requireUnselected),
    'Current native click target is the intended SVG point or its selected drag handle')
  assert.ok(intendedSelectionTarget(final.observation.elementsFromPoint[0], final.observation.selection, id, requireUnselected),
    'Current native hit stack starts with the intended SVG point or selected handle')
  return final.rendered
}

/** Close an inherited Inspector through its real control before measuring.
 * Preserve primary native/assertion errors through bounded diagnostics/cleanup. */
export async function selectGeometricPoint({ page, readState, observePoint, diagnose, secondaryErrors,
  scenario, sequence, id = 'app-point', boundary = false, requireUnselected = false }) {
  const token = `${scenario}:${sequence}:${id}`
  const observation = { scenario, sequence, id, clickKind: boundary ? 'boundary' : 'center', requireUnselected,
    preparation: { closeActions: 0 }, toolbarPreparation: { actions: [] }, toolbarRestoration: {}, secondaryErrors: [] }
  const failures = []
  let primary, rendered, installed = false
  const diagnostic = async (name, operation) => {
    try { return await boundedPointDiagnostic(operation, `Geometric selection ${name}`) }
    catch (error) {
      failures.push(error)
      observation.secondaryErrors.push({ name, message: error.message })
      secondaryErrors.push(`Geometric selection ${name}: ${error.message}`)
    }
  }
  try {
    const preparation = observation.preparation
    preparation.stateBefore = await diagnostic('state before preparation', readState)
    preparation.inherited = await diagnostic('inherited drawer', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
    const drawer = page.locator('#preview-inspector-drawer')
    let preparationPrimary
    try {
      preparation.drawerCount = await drawer.count()
      assert.ok(preparation.drawerCount === 0 || preparation.drawerCount === 1, 'Inspector drawer is unique')
      if (preparation.drawerCount === 1) {
        const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true })
        assert.equal(await close.count(), 1, 'Open Inspector has one native close control')
        preparation.closeActions++
        await close.click({ timeout: 5000 })
        await drawer.waitFor({ state: 'detached', timeout: 5000 })
      }
      preparation.closedDrawerCount = await drawer.count()
      const open = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
      preparation.openerCount = await open.count()
      preparation.openerExpanded = await open.getAttribute('aria-expanded', { timeout: 5000 })
    } catch (error) {
      preparationPrimary = error
      preparation.error = { message: error.message, stack: error.stack }
    }
    preparation.closed = await diagnostic('closed drawer', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
    preparation.stateAfter = await diagnostic('state after preparation', readState)
    await diagnostic('preparation evidence', () => diagnose({ boundary: 'selection-prepared', observation }))
    if (preparationPrimary) throw preparationPrimary
    assert.equal(preparation.closedDrawerCount, 0, 'Inspector drawer is detached before selection')
    assert.equal(preparation.openerCount, 1, 'Closed Inspector has one native open control')
    assert.equal(preparation.openerExpanded, 'false', 'Inspector is closed before selection')
    // Drawer state is UI state; exact saved/runtime data and history include
    // coordinates, raw source and all explicit style/provenance fields.
    if (preparation.stateBefore && preparation.stateAfter) {
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'selection', 'uiSettings']) {
        assert.deepEqual(preparation.stateAfter[field], preparation.stateBefore[field], `Inspector preparation preserves ${field}`)
      }
    }
    rendered = await prepareGeometricCanvasClick({ page, readState, observePoint, id, boundary, requireUnselected,
      preparation: observation.toolbarPreparation, diagnostic,
      evidence: (stage) => diagnostic(`${stage} evidence`, () => diagnose({ boundary: stage, observation })) })
    observation.rendered = rendered
    if (rendered.bodyOverflow) observation.clickKind = 'body'
    const click = boundary ? rendered.boundary : rendered.center
    observation.requestedClick = click
    await page.evaluate(installGeometricSelectionObserver, { token, id }); installed = true
    observation.stateBefore = await diagnostic('state before canvas click', readState)
    observation.before = await diagnostic('before click', () => page.evaluate(observeGeometricSelection, { id, click, token }))
    await diagnostic('before evidence', () => diagnose({ boundary: 'before-native-click', observation }))
    assertFreshGeometricClick(observation.before, rendered, click, boundary)
    assertUiPreserved(observation.toolbarPreparation.statePrepared, observation.stateBefore,
      observation.toolbarPreparation.prepared, observation.before, 'Fresh canvas click measurement')
    assert.ok(intendedSelectionTarget(observation.before.elementFromPoint, observation.before.selection, id, requireUnselected),
      'Current native click target is the intended SVG point or its selected drag handle')
    assert.ok(intendedSelectionTarget(observation.before.elementsFromPoint[0], observation.before.selection, id, requireUnselected),
      'Current native hit stack starts with the intended SVG point or selected handle')
    try { await page.mouse.click(click.x, click.y) } catch (error) { primary = error }
    try { observation.stateAfter = await readState(); observation.selected = observation.stateAfter.selection } catch (error) { primary ??= error }
    observation.after = await diagnostic('after click', () => page.evaluate(observeGeometricSelection, { id, click, token }))
    await diagnostic('after evidence', () => diagnose({ boundary: 'after-native-click-before-assertion', observation }))
    if (primary) throw primary
    assert.equal(observation.selected?.id, id, 'Native contour click selects its point')
    if (failures.length) throw new AggregateError(failures, 'Geometric selection diagnostics failed')
    for (const snapshot of [preparation.inherited, preparation.closed, observation.before, observation.after]) {
      assert.deepEqual(snapshot?.errors, [], 'Selection snapshot completed without observation errors')
    }
    if (requireUnselected) assert.equal(observation.before.selection, null, 'Initial circle setup is unselected before the native click')
    assert.equal(observation.before.inspector.open, false, 'Inspector stays closed at click time')
    assert.ok(intendedSelectionTarget(observation.before.elementFromPoint, observation.before.selection, id, requireUnselected),
      'Current native click target is the intended SVG point or its selected drag handle')
    assert.equal(observation.after.droppedEvents, 0, 'All owned native selection events were retained')
    assert.deepEqual(observation.before.events, [], 'Canvas click observation excludes native toolbar preparation')
    const events = observation.after.events
    assert.equal(events.length, 3, 'One native down/up/click gesture is retained')
    const downIndex = events.findIndex((event) => event.type === 'pointerdown' && event.trusted === true
      && intendedSelectionPath(event, observation.before.selection, id, requireUnselected))
    assert.ok(downIndex >= 0, 'Observed trusted selection pointerdown delivered to the intended SVG production path')
    const down = events[downIndex]
    assert.ok(Number.isInteger(down.pointerId), 'Native selection retains its pointer identity')
    for (const event of events) {
      assert.equal(event.button, 0, 'Native selection uses the primary pointer button')
      assert.ok(event.pointerId === down.pointerId || (event.type === 'click' && event.pointerId === null), 'Native selection keeps its pointer identity')
      assert.ok(event.client && Math.abs(event.client.x - click.x) < 1 && Math.abs(event.client.y - click.y) < 1,
        'Owned native events use the requested fresh click coordinates')
      assert.equal(event.App?.labelDocumentRevision, observation.stateBefore.labelDocumentRevision, 'Native selection events stay in the same document epoch')
    }
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings']) {
      assert.deepEqual(observation.stateAfter[field], observation.stateBefore[field], `Native canvas selection preserves ${field}`)
    }
    let previousIndex = downIndex, capturedUp = false
    for (const type of ['pointerup', 'click']) {
      const index = events.findIndex((event, index) => index > previousIndex && event.type === type && event.trusted === true
        && (intendedSelectionPath(event, observation.before.selection, id, requireUnselected)
          || (down.target.pointHandle === true && Number.isInteger(down.pointerId)
            && (event.pointerId === down.pointerId || (type === 'click' && event.pointerId === null
              && Math.abs(event.client?.x - down.client?.x) <= 1 && Math.abs(event.client?.y - down.client?.y) <= 1))
            && event.target?.canvasRoot === true && event.target.drawer === false
            && event.path.some((element) => element?.canvasRoot === true)
            && (type === 'pointerup' ? event.canvasHasPointerCapture === true : capturedUp))))
      assert.ok(index >= 0, `Observed trusted selection ${type} delivered to the intended SVG production path`)
      capturedUp = events[index].canvasHasPointerCapture === true
      previousIndex = index
    }
  } catch (error) { primary ??= error }
  finally {
    if (installed) await diagnostic('observer cleanup', () => page.evaluate(removeGeometricSelectionObserver, token))
    try {
      await restoreGeometricCanvasToolbar({ page, readState, id, preparation: observation.toolbarPreparation,
        restoration: observation.toolbarRestoration, diagnostic,
        evidence: (stage) => diagnostic(`${stage} evidence`, () => diagnose({ boundary: stage, observation })) })
    } catch (error) {
      if (!primary) primary = error
      else {
        observation.secondaryErrors.push({ name: 'toolbar restoration', message: error.message })
        secondaryErrors.push(`Geometric selection toolbar restoration: ${error.message}`)
      }
    }
    if (!primary && failures.length === 0) {
      try { assertGeometricToolbarPreparation(observation.toolbarPreparation, observation.toolbarRestoration) }
      catch (error) { primary = error }
    }
    await diagnostic('final evidence', () => diagnose({ boundary: 'selection-finished', observation,
      ...(primary ? { primary: { message: primary.message, stack: primary.stack } } : {}) }))
  }
  if (primary) throw primary
  if (failures.length) throw new AggregateError(failures, 'Geometric selection diagnostics failed')
  observation.events = observation.after.events
  rendered.nativeSelection = structuredClone(observation)
  return rendered
}
