import assert from 'node:assert/strict'
import { selectGeometricPoint } from './pointGeometricSelection.mjs'
import { assertGeometricSelectionEvidence } from './pointGeometricShapesContract.mjs'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

// Browser observation only. The ordinary .23 contour gesture continues through
// the existing shared native-selection helper and the production point handler.
export function observePendingLayoutPreparation({ fixture, source, id = 'layout-circle', click = null }) {
  const errors = []
  const safe = (name, operation) => {
    try { return operation() } catch (error) { errors.push({ name, message: error.message }); return null }
  }
  const rect = (value) => value && ({ x: value.x, y: value.y, width: value.width, height: value.height })
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const geometry = (element, name) => ({ connected: element?.isConnected ?? false,
    bounds: safe(`${name} client bounds`, () => rect(element?.getBoundingClientRect())),
    bbox: safe(`${name} native bounds`, () => rect(element?.getBBox())),
    screenCTM: safe(`${name} screen CTM`, () => matrix(element?.getScreenCTM())),
    CTM: safe(`${name} CTM`, () => matrix(element?.getCTM())) })
  const describe = (element) => element instanceof Element ? {
    tag: element.localName, pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    bodyTarget: element.matches('[data-point-body-target]'), contour: element.matches('[data-point-contour]'),
    drawer: !!element.closest('#preview-inspector-drawer'), svg: element instanceof SVGElement,
    canvas: !!element.closest('svg.svg-diagram'), canvasRoot: element.matches('svg.svg-diagram'),
    toolbar: !!element.closest('.preview-toolbar-overlay-stack'),
  } : null
  const state = safe('authoritative App state', () => window.stzAppLabels.state())
  const model = state && safe('current model', () => JSON.parse(state.runtimeDiagramJson))
  const canvas = document.querySelector('svg.svg-diagram')
  const backgroundControls = [...document.querySelectorAll('select[aria-label="SVG export background"]')]
  const nodes = [...document.querySelectorAll('[data-point-id] [data-point-node]')]
  const points = nodes.map((node) => {
    const pointId = node.closest('[data-point-id]')?.getAttribute('data-point-id')
    const body = node.querySelector('[data-label-state]'), target = node.querySelector('[data-point-body-target]')
    const contour = node.querySelector('[data-point-contour]')
    return { id: pointId, modelIndex: model?.strata.findIndex((point) => point.id === pointId) ?? -1,
      model: model?.strata.find((point) => point.id === pointId) ?? null,
      owner: node.getAttribute('data-point-node'), request: node.getAttribute('data-point-request'),
      bodyRequest: body?.getAttribute('data-label-request') ?? null, source: body?.getAttribute('data-label-source') ?? null,
      state: body?.getAttribute('data-label-state') ?? null, shape: node.getAttribute('data-point-shape'),
      parameters: node.getAttribute('data-point-shape-parameters'), layout: node.getAttribute('data-point-layout'),
      targetIdentity: target ? { owner: target.closest('[data-point-node]')?.getAttribute('data-point-node') ?? null,
        request: target.closest('[data-point-node]')?.getAttribute('data-point-request') ?? null,
        source: target.closest('[data-point-node]')?.querySelector('[data-label-state]')?.getAttribute('data-label-source') ?? null } : null,
      geometry: Object.fromEntries([['node', node], ['body', body], ['bodyTarget', target], ['contour', contour]]
        .map(([name, element]) => [name, geometry(element, `${pointId} ${name}`)])),
      paintedContours: [...node.children].filter((element) => ['path', 'polygon', 'circle', 'ellipse', 'rect'].includes(element.localName)
        && element.getAttribute('stroke') && element.getAttribute('stroke') !== 'none' && !element.hasAttribute('data-svg-export-exclude'))
        .map((element, index) => ({ tag: element.localName, ...geometry(element, `${pointId} paint ${index}`) })) }
  })
  const intendedNode = nodes.find((node) => node.closest('[data-point-id]')?.getAttribute('data-point-id') === id)
  const contour = intendedNode?.querySelector('[data-point-contour]')
  const length = safe('captured contour length', () => contour.getTotalLength())
  const localPoint = safe('captured .23 native point', () => contour.getPointAtLength(length * .23))
  const local = localPoint && { x: localPoint.x, y: localPoint.y }
  const screenPoint = localPoint && safe('captured .23 screen point', () => localPoint.matrixTransform(contour.getScreenCTM()))
  const screen = screenPoint && { x: screenPoint.x, y: screenPoint.y }
  const requestedClick = click ?? screen
  const hit = requestedClick && document.elementFromPoint(requestedClick.x, requestedClick.y)
  const stack = requestedClick ? document.elementsFromPoint(requestedClick.x, requestedClick.y).slice(0, 24) : []
  const scrollAncestors = [], clipFrames = []
  for (let element = canvas; element && scrollAncestors.length < 12; element = element.parentElement) {
    const bounds = rect(element.getBoundingClientRect()), style = getComputedStyle(element)
    scrollAncestors.push({ element: describe(element), bounds, scrollTop: element.scrollTop, scrollLeft: element.scrollLeft })
    if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) || ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY)) {
      clipFrames.push({ element: describe(element), bounds, overflowX: style.overflowX, overflowY: style.overflowY })
    }
  }
  const reasons = []
  const inside = (point, bounds) => point && bounds && point.x > bounds.x && point.x < bounds.x + bounds.width
    && point.y > bounds.y && point.y < bounds.y + bounds.height
  const canvasGeometry = geometry(canvas, 'canvas')
  if (!inside(requestedClick, canvasGeometry.bounds)) reasons.push('outside-canvas-client-bounds')
  if (!inside(requestedClick, { x: 0, y: 0, width: innerWidth, height: innerHeight })) reasons.push('outside-viewport')
  for (const frame of clipFrames) if (!inside(requestedClick, frame.bounds)) reasons.push('clipped-by-ancestor')
  const target = describe(hit), first = describe(stack[0])
  const owned = (target) => target?.pointId === id && target.svg && target.canvas && !target.drawer
  if (!owned(target)) reasons.push(target?.pointId ? 'sibling-interception' : target?.toolbar ? 'toolbar-interception' : 'unavailable-intended-target')
  if (!owned(first)) reasons.push('wrong-first-hit-stack-owner')
  const hold = safe('captured held conversion', () => window.stzAppLabels.pending(source))
  if (!hold || !(hold.started > 0) || hold.completed !== 0 || hold.released !== false) reasons.push('captured-conversion-not-held-pending')
  return { at: performance.now(), id, source, labelDocumentRevision: state?.labelDocumentRevision ?? null, hold,
    modelOrder: model?.strata.map(({ id }) => id) ?? [], fixtureOrder: fixture.diagram.strata.map(({ id }) => id),
    renderOrder: points.map(({ id }) => id), points, requestedClick, contour: { fraction: .23, length, local, screen },
    canvas: { geometry: canvasGeometry, viewBox: canvas?.getAttribute('viewBox') ?? null,
      preserveAspectRatio: canvas?.getAttribute('preserveAspectRatio') ?? null },
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, scrollX, scrollY,
      visual: visualViewport ? { width: visualViewport.width, height: visualViewport.height, offsetLeft: visualViewport.offsetLeft,
        offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null },
    scrollAncestors, clipFrames, elementFromPoint: target, elementsFromPoint: stack.map(describe),
    exportBackground: { count: backgroundControls.length, tag: backgroundControls[0]?.localName ?? null,
      ariaLabel: backgroundControls[0]?.getAttribute('aria-label') ?? null, value: backgroundControls[0]?.value ?? null },
    eligibility: { eligible: reasons.length === 0 && errors.length === 0, reasons }, errors }
}

export async function capturePendingLayoutPreparation({ page, readState, fixture, source, id = 'layout-circle', click = null }) {
  const measurement = await page.evaluate(observePendingLayoutPreparation, { fixture, source, id, click })
  const state = await readState()
  return { state, measurement }
}

function finitePoint(point, name) {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), `${name} is finite`)
}
function finiteGeometry(geometry, name) {
  assert.equal(geometry?.connected, true, `${name} is connected`)
  for (const key of ['bounds', 'bbox']) {
    const bounds = geometry[key]
    assert.ok(bounds && Object.values(bounds).every(Number.isFinite) && bounds.width > 0 && bounds.height > 0, `${name} ${key} is finite and positive`)
  }
  for (const key of ['screenCTM', 'CTM']) {
    const matrix = geometry[key]
    assert.ok(matrix && Object.values(matrix).every(Number.isFinite)
      && Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12, `${name} ${key} is finite and invertible`)
  }
}
function sameAuthoritative(before, after, selection = false) {
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings', ...(selection ? ['selection'] : [])]) {
    assert.deepEqual(after[field], before[field], `Pending setup preserves ${field}`)
  }
}
export function assertPendingLayoutMeasurement(stage, fixture, source, id = 'layout-circle', requireTarget = true) {
  const { state, measurement: raw } = stage
  assert.deepEqual(raw?.errors, [], 'Pending preparation observations are complete')
  assert.equal(raw.id, id); assert.equal(raw.source, source)
  assert.equal(raw.labelDocumentRevision, state.labelDocumentRevision)
  const model = JSON.parse(state.runtimeDiagramJson), expected = fixture.diagram.strata.filter(({ geometricKind }) => geometricKind === 'point')
  assert.deepEqual(raw.modelOrder, model.strata.map(({ id }) => id)); assert.deepEqual(raw.fixtureOrder, fixture.diagram.strata.map(({ id }) => id))
  assert.deepEqual(model.strata, fixture.diagram.strata, 'Loaded combined strata retain exact declared content and positions')
  assert.deepEqual(model.labels, fixture.diagram.labels, 'Loaded combined free labels retain their declared content')
  assert.equal(raw.points.length, expected.length); assert.equal(new Set(raw.renderOrder).size, expected.length)
  assert.deepEqual([...raw.renderOrder].sort(), expected.map(({ id }) => id).sort())
  for (const point of raw.points) {
    const declared = expected.find(({ id }) => id === point.id)
    assert.ok(declared); assert.deepEqual(point.model, declared); assert.equal(point.modelIndex, model.strata.findIndex(({ id }) => id === point.id))
    assert.deepEqual(JSON.parse(point.owner), ['point-node', state.labelDocumentRevision, point.id])
    assert.ok(point.request); assert.equal(point.request, point.bodyRequest); assert.equal(point.source, declared.text)
    assert.equal(point.shape, declared.style.shape)
    assert.deepEqual(JSON.parse(point.layout), { ...declared.style.layout, fontContext: { fontSizePt: 10, xHeightPt: 4.30554, ...declared.style.layout.fontContext } })
    const parameters = JSON.parse(point.parameters)
    assert.ok(parameters && Object.keys(parameters).length > 0, 'Resolved parameters are retained')
    for (const [key, value] of Object.entries(declared.style.shapeParameters ?? {})) assert.deepEqual(parameters[key], value, 'Declared shape parameters are preserved')
    assert.ok(['pending', 'ready'].includes(point.state))
    for (const [name, geometry] of Object.entries(point.geometry)) finiteGeometry(geometry, `${point.id} ${name}`)
    assert.ok(point.paintedContours.length > 0)
    for (const [index, geometry] of point.paintedContours.entries()) finiteGeometry(geometry, `${point.id} paint ${index}`)
    assert.equal(point.targetIdentity?.owner, point.owner); assert.equal(point.targetIdentity?.request, point.request)
    assert.equal(point.targetIdentity?.source, point.source)
  }
  const captured = raw.points.find((point) => point.id === id)
  assert.equal(captured.state, 'pending'); assert.equal(captured.source, source)
  assert.ok(raw.hold?.started > 0); assert.equal(raw.hold.completed, 0); assert.equal(raw.hold.released, false)
  finiteGeometry(raw.canvas.geometry, 'canvas'); assert.equal(typeof raw.canvas.viewBox, 'string')
  assert.ok(Number.isFinite(raw.viewport.width) && raw.viewport.width > 0 && Number.isFinite(raw.viewport.height) && raw.viewport.height > 0)
  assert.ok(raw.scrollAncestors.length > 0 && Array.isArray(raw.clipFrames))
  assert.equal(raw.exportBackground?.count, 1); assert.equal(raw.exportBackground.tag, 'select')
  assert.equal(raw.exportBackground.ariaLabel, 'SVG export background'); assert.ok(['transparent', 'white'].includes(raw.exportBackground.value))
  assert.equal(raw.contour.fraction, .23); assert.ok(Number.isFinite(raw.contour.length) && raw.contour.length > 0)
  finitePoint(raw.contour.local, '.23 local point'); finitePoint(raw.contour.screen, '.23 screen point'); finitePoint(raw.requestedClick, 'requested click')
  const matrix = captured.geometry.contour.screenCTM, local = raw.contour.local
  // Native SVGPoint uses binary32 in Chrome. Keep the precise shared allowance;
  // these comparisons do not alter any independent PGF reference tolerance.
  for (const [key, projected] of [['x', matrix.a * local.x + matrix.c * local.y + matrix.e], ['y', matrix.b * local.x + matrix.d * local.y + matrix.f]]) {
    assert.ok(Math.abs(raw.contour.screen[key] - projected) < 1e-7 || raw.contour.screen[key] === Math.fround(projected), `Current ${key} uses the native contour CTM`)
    assert.equal(raw.requestedClick[key], raw.contour.screen[key], 'Pending selection uses the fixed .23 contour point')
  }
  assert.ok(Array.isArray(raw.elementsFromPoint) && raw.elementsFromPoint.length <= 24)
  assert.ok(raw.eligibility && typeof raw.eligibility.eligible === 'boolean' && Array.isArray(raw.eligibility.reasons))
  // Earlier owned toolbar preparation and later Inspector reopening may change
  // the hit at this contour position. Only the exact native input boundary uses
  // this point; all stages still retain their actual targets and rejection reasons.
  if (requireTarget) {
    const intended = (target) => target?.pointId === id && target.svg === true && target.canvas === true && target.drawer === false
    assert.ok(intended(raw.elementFromPoint), 'Pending contour input reaches the current intended owner')
    assert.ok(intended(raw.elementsFromPoint[0]), 'Pending contour hit stack starts at its intended owner')
    assert.deepEqual(raw.elementsFromPoint[0], raw.elementFromPoint)
    const inside = (bounds) => bounds && Object.values(bounds).every(Number.isFinite)
      && raw.requestedClick.x > bounds.x && raw.requestedClick.x < bounds.x + bounds.width
      && raw.requestedClick.y > bounds.y && raw.requestedClick.y < bounds.y + bounds.height
    assert.ok(inside(raw.canvas.geometry.bounds), 'Pending input is inside the measured canvas client bounds')
    assert.ok(inside({ x: 0, y: 0, width: raw.viewport.width, height: raw.viewport.height }), 'Pending input is inside the viewport')
    for (const frame of raw.clipFrames) assert.ok(inside(frame.bounds), 'Pending input is inside every actual clipping frame')
    assert.equal(raw.eligibility.eligible, true); assert.deepEqual(raw.eligibility.reasons, [])
  }
}

function installPendingModifiers(token) {
  const registry = window.__stzPendingLayoutInputs ??= new Map()
  if (registry.has(token)) throw new Error(`Pending input observer already owned: ${token}`)
  const describe = (element) => element instanceof Element ? { tag: element.localName,
    pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    canvas: !!element.closest('svg.svg-diagram'), canvasRoot: element.matches('svg.svg-diagram'),
    svg: element instanceof SVGElement, drawer: !!element.closest('#preview-inspector-drawer') } : null
  const owned = { events: [], droppedEvents: 0 }
  owned.listener = (event) => {
    if (owned.events.length >= 12) { owned.droppedEvents++; return }
    const node = event.target instanceof Element ? event.target.closest('[data-point-id]')?.querySelector('[data-point-node]') : null
    const body = node?.querySelector('[data-label-state]')
    owned.events.push({ type: event.type, trusted: event.isTrusted, button: event.button, buttons: event.buttons,
      altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey,
      pointerId: event.pointerId ?? null, client: { x: event.clientX, y: event.clientY }, target: describe(event.target),
      path: event.composedPath().slice(0, 16).map(describe), owner: node?.getAttribute('data-point-node') ?? null,
      request: node?.getAttribute('data-point-request') ?? null, source: body?.getAttribute('data-label-source') ?? null,
      documentRevision: window.stzAppLabels.state().labelDocumentRevision })
  }
  registry.set(token, owned)
  for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, owned.listener, true)
}
function readPendingModifiers(token) {
  const owned = window.__stzPendingLayoutInputs?.get(token)
  return owned ? { events: [...owned.events], droppedEvents: owned.droppedEvents } : null
}
function removePendingModifiers(token) {
  const registry = window.__stzPendingLayoutInputs, owned = registry?.get(token)
  if (owned) for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, owned.listener, true)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzPendingLayoutInputs
  return !window.__stzPendingLayoutInputs?.has(token)
}

export function assertPendingLayoutInputBinding(stage, nativeSelection, id = 'layout-circle') {
  const captured = stage.measurement.points.find((point) => point.id === id)
  const before = nativeSelection?.before
  assert.ok(before && nativeSelection.stateBefore, 'Pending input retains shared immediate native observations')
  sameAuthoritative(stage.state, nativeSelection.stateBefore, true)
  assert.deepEqual(nativeSelection.requestedClick, stage.measurement.requestedClick)
  assert.deepEqual(before.requestedClick, stage.measurement.requestedClick)
  assert.equal(before.geometry.contour.connected, true); assert.equal(before.geometry.contour.fraction, .23)
  assert.deepEqual(captured.geometry.contour.screenCTM, before.geometry.contour.screenCTM)
  assert.deepEqual(stage.measurement.contour.local, before.geometry.contour.localBoundary)
  assert.deepEqual(stage.measurement.contour.screen, before.geometry.contour.boundary)
  assert.equal(stage.measurement.contour.length, before.geometry.contour.length)
  for (const field of ['owner', 'request', 'bodyRequest', 'source', 'state']) assert.equal(captured[field], before.layout[field], 'Current pending measurement matches shared native ownership')
  assert.deepEqual(captured.model, before.model)
  const intended = (target) => target?.pointId === id && target.svg === true && target.canvas === true && target.drawer === false
  assert.ok(intended(before.elementFromPoint)); assert.ok(intended(before.elementsFromPoint[0]))
}

// Scoped orchestration boundary. Capture/persistence happens before entry; no
// rejected or unavailable target can reach the supplied ordinary native input.
export async function inputPendingLayoutContour({ stage, fixture, source, id = 'layout-circle', stateBefore,
  x, y, options = [], nativeSelection, startObserver, nativeClick }) {
  assertPendingLayoutMeasurement(stage, fixture, source, id)
  assertPendingLayoutInputBinding(stage, nativeSelection, id)
  assert.deepEqual(stage.measurement.requestedClick, { x, y })
  assert.deepEqual(options, [], 'Pending preparation supplies no click modifiers or force options')
  sameAuthoritative(stateBefore, stage.state, true)
  assert.equal(stage.state.selection, null, 'Pending fixture is unselected before its one native input')
  await startObserver()
  return nativeClick(x, y)
}

export async function preparePendingLayoutPoint({ page, readState, diagnose, secondaryErrors, scenario, sequence,
  fixture, source, id = 'layout-circle', observePoint }) {
  const token = `${scenario}:pending-preparation:${sequence}:${id}`
  const record = { scenario, sequence, id, source, fixture: structuredClone(fixture), result: 'observed', stages: [],
    cleanup: { observerRemoved: false }, secondaryErrors: [] }
  let primary, rendered, installed = false, inputCount = 0
  const retain = () => boundedPointDiagnostic(() => diagnose({ boundary: 'pending-layout-preparation', pendingPreparation: record }), 'Pending layout preparation evidence')
  const capture = async (boundary, click = null) => {
    const stage = { boundary, ...await capturePendingLayoutPreparation({ page, readState, fixture, source, id, click }) }
    record.stages.push(stage); await retain(); return stage
  }
  try {
    record.stateBefore = await readState()
    const guardedMouse = new Proxy(page.mouse, { get(target, property) {
      if (property === 'click') return async (x, y, ...options) => {
        const immediate = await capture('immediate-before-input', { x, y })
        assert.equal(inputCount, 0, 'Pending preparation owns one ordinary native input')
        return inputPendingLayoutContour({ stage: immediate, fixture, source, id, stateBefore: record.stateBefore, x, y, options, nativeSelection: record.nativeSelection,
          startObserver: async () => { await page.evaluate(installPendingModifiers, token); installed = true },
          nativeClick: async (clickX, clickY) => { inputCount++; return target.click(clickX, clickY) } })
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    const guardedPage = new Proxy(page, { get(target, property) {
      if (property === 'mouse') return guardedMouse
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    rendered = await selectGeometricPoint({ page: guardedPage, readState, id, scenario, sequence, boundary: true, requireUnselected: true,
      observePoint: async (ownedPage, pointId) => {
        const point = await observePoint(ownedPage, pointId)
        const stage = await capture('current-contour-measurement', point?.boundary)
        assertPendingLayoutMeasurement(stage, fixture, source, id, false)
        return point
      }, secondaryErrors, diagnose: async (details) => {
        if (details.observation) record.nativeSelection = structuredClone(details.observation)
        if (installed) record.modifiers = await page.evaluate(readPendingModifiers, token)
        await diagnose(details); await retain()
      } })
    record.nativeSelection = rendered.nativeSelection
    record.modifiers = await page.evaluate(readPendingModifiers, token)
    record.stateAfter = await readState()
    await capture('after-native-selection', rendered.boundary)
    assert.equal(inputCount, 1, 'Pending preparation made exactly one native contour gesture')
  } catch (error) { primary = error; record.error = { message: error.message, stack: error.stack } }
  finally {
    if (installed) {
      try { record.cleanup.observerRemoved = await boundedPointDiagnostic(() => page.evaluate(removePendingModifiers, token), 'Pending modifier observer cleanup') }
      catch (error) { primary ??= error; record.secondaryErrors.push({ operation: 'modifier observer cleanup', message: error.message }); secondaryErrors.push(error.message) }
    } else record.cleanup.observerRemoved = true
    if (primary) record.error = { message: primary.message, stack: primary.stack }
    try { await retain() } catch (error) { primary ??= error; record.secondaryErrors.push({ operation: 'final pending evidence', message: error.message }); secondaryErrors.push(error.message) }
  }
  if (primary) throw primary
  try {
    assertPendingLayoutPreparation(record)
    record.result = 'passed'; await retain()
  } catch (error) {
    record.result = 'observed'; record.error = { message: error.message, stack: error.stack }
    try { await retain() } catch (secondary) {
      record.secondaryErrors.push({ operation: 'validation failure evidence', message: secondary.message }); secondaryErrors.push(secondary.message)
    }
    throw error
  }
  rendered.pendingPreparation = record
  return rendered
}

export function assertPendingLayoutPreparation(record) {
  assert.ok(record && ['observed', 'passed'].includes(record.result)); assert.equal(record.error, undefined)
  assert.equal(record.id, 'layout-circle'); assert.ok(record.scenario.startsWith('point-layout-pending-'))
  const stages = record.stages
  assert.ok(stages.some(({ boundary }) => boundary === 'current-contour-measurement'))
  assert.equal(stages.filter(({ boundary }) => boundary === 'immediate-before-input').length, 1)
  assert.equal(stages.filter(({ boundary }) => boundary === 'after-native-selection').length, 1)
  for (const stage of stages) assertPendingLayoutMeasurement(stage, record.fixture, record.source, record.id, stage.boundary === 'immediate-before-input')
  const immediate = stages.find(({ boundary }) => boundary === 'immediate-before-input')
  const after = stages.find(({ boundary }) => boundary === 'after-native-selection')
  sameAuthoritative(record.stateBefore, immediate.state, true); assert.equal(immediate.state.selection, null)
  sameAuthoritative(record.stateBefore, record.stateAfter); sameAuthoritative(record.stateAfter, after.state, true)
  assert.deepEqual(record.stateAfter.selection, { kind: 'stratum', id: record.id })
  assertGeometricSelectionEvidence(record.nativeSelection, record.id)
  assert.equal(record.nativeSelection.requireUnselected, true); assert.equal(record.nativeSelection.clickKind, 'boundary')
  assert.deepEqual(record.nativeSelection.requestedClick, immediate.measurement.requestedClick)
  sameAuthoritative(immediate.state, record.nativeSelection.stateBefore, true)
  sameAuthoritative(record.stateAfter, record.nativeSelection.stateAfter, true)
  const captured = immediate.measurement.points.find(({ id }) => id === record.id)
  assertPendingLayoutInputBinding(immediate, record.nativeSelection, record.id)
  for (const stage of stages) {
    const point = stage.measurement.points.find(({ id }) => id === record.id)
    for (const field of ['owner', 'request', 'bodyRequest', 'source', 'state']) assert.equal(point[field], captured[field], `Pending setup preserves current ${field}`)
  }
  const events = record.modifiers?.events
  assert.equal(record.modifiers?.droppedEvents, 0); assert.equal(events?.length, 3)
  assert.deepEqual(events.map(({ type }) => type), ['pointerdown', 'pointerup', 'click'])
  for (const event of events) {
    assert.equal(event.trusted, true); assert.equal(event.button, 0); assert.equal(event.buttons, event.type === 'pointerdown' ? 1 : 0)
    for (const key of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) assert.equal(event[key], false, 'Pending selection has no modifiers')
    assert.equal(event.target?.pointId, record.id); assert.equal(event.target?.svg, true); assert.equal(event.target?.canvas, true); assert.equal(event.target?.drawer, false)
    assert.ok(event.path.some((target) => target?.pointId === record.id)); assert.ok(event.path.some((target) => target?.canvasRoot === true))
    assert.equal(event.owner, captured.owner); assert.equal(event.request, captured.request); assert.equal(event.source, record.source)
    assert.equal(event.documentRevision, immediate.state.labelDocumentRevision)
    assert.ok(Math.abs(event.client.x - immediate.measurement.requestedClick.x) < 1 && Math.abs(event.client.y - immediate.measurement.requestedClick.y) < 1)
    assert.ok(event.pointerId === events[0].pointerId || (event.type === 'click' && event.pointerId === null))
  }
  assert.ok(Number.isInteger(events[0].pointerId)); assert.equal(record.cleanup?.observerRemoved, true); assert.deepEqual(record.secondaryErrors, [])
}

export function assertPendingLayoutClickContinuation(record, click, beforeClick) {
  assertPendingLayoutPreparation(record)
  assertPendingLayoutMeasurement(beforeClick, record.fixture, record.source, record.id, false)
  // The background select is outside the authoritative model/UI-setting record.
  // Its actual native value is retained separately; every authoritative field stays exact.
  sameAuthoritative(record.stateAfter, beforeClick.state, true)
  assert.equal(beforeClick.measurement.exportBackground.value, record.scenario.includes('transparent') ? 'transparent' : 'white')
  assert.equal(click.error, undefined); assert.ok(click.snapshot)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'uiSettings', 'selection']) assert.deepEqual(click.snapshot[field], beforeClick.state[field])
  assert.deepEqual(click.snapshot.exportBackground, beforeClick.measurement.exportBackground)
  assert.equal(click.snapshot.runtime.documentRevision, beforeClick.state.labelDocumentRevision)
  const declared = record.fixture.diagram.strata.filter(({ geometricKind }) => geometricKind === 'point')
  assert.deepEqual(click.snapshot.points.map(({ id }) => id), declared.map(({ id }) => id))
  for (const point of click.snapshot.points) {
    const current = beforeClick.measurement.points.find(({ id }) => id === point.id), model = declared.find(({ id }) => id === point.id)
    assert.ok(current && model); assert.equal(point.owner, current.owner); assert.equal(point.request, current.request); assert.equal(point.pointRequest, current.request)
    assert.equal(point.source, model.text); assert.equal(point.modelSource, model.text); assert.deepEqual(point.style, model.style); assert.deepEqual(point.position, model.position)
    assert.equal(point.status, current.state)
  }
  const captured = click.snapshot.points[0]
  assert.equal(captured.id, record.id); assert.equal(captured.source, record.source); assert.equal(captured.status, 'pending')
  assert.ok(captured.held?.started > 0); assert.equal(captured.held.completed, 0); assert.equal(captured.held.released, false)
  assert.deepEqual(captured.held, beforeClick.measurement.hold)
  const initial = record.stages.find(({ boundary }) => boundary === 'immediate-before-input').measurement.points.find(({ id }) => id === record.id)
  assert.equal(captured.request, initial.request); assert.equal(captured.owner, initial.owner)
}
