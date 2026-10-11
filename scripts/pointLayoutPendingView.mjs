import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

export const pendingViewReferenceIds = ['layout-rectangle', 'layout-cylinder']
const stateFields = ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']

// Read-only native observations. The registry stores DOM references, never
// changes the model/DOM, and is removed by the owner even after an input failure.
export function observePendingLayoutView({ token, source, ids }) {
  const errors = [], owned = window.__stzPendingViews?.get(token)
  const safe = (name, read) => {
    try { return read() } catch (error) { errors.push({ name, message: error.message }); return null }
  }
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const rect = (value) => value && ({ x: value.x, y: value.y, width: value.width, height: value.height })
  const xy = (value) => value && ({ x: value.x, y: value.y })
  const panels = [...document.querySelectorAll('.camera-panel')], panel = panels[0]
  const controls = (name, type, reference) => {
    const found = [...document.querySelectorAll(`input[type="${type}"][aria-label="${name}"]`)], element = found[0]
    return { count: found.length, tag: element?.localName ?? null, type: element?.type ?? null,
      accessibleName: element?.getAttribute('aria-label') ?? null, value: element?.value ?? null,
      min: element?.getAttribute('min') ?? null, max: element?.getAttribute('max') ?? null,
      step: element?.getAttribute('step') ?? null, connected: element?.isConnected ?? false,
      sameIdentity: !!owned && element === owned[reference], inPanel: !!element && panel?.contains(element) === true,
      inDetails: element?.closest('#camera-details') !== null && !!element,
      valid: element?.validity.valid ?? false, bounds: rect(element?.getBoundingClientRect()) }
  }
  const zoom = document.querySelector('input[type="number"][aria-label="zoom value"]')
  const slider = document.querySelector('input[type="range"][aria-label="zoom slider"]')
  const disclosures = [...document.querySelectorAll('.camera-panel .camera-summary-toggle')], disclosure = disclosures[0]
  const roots = [...document.querySelectorAll('svg.svg-diagram')], root = roots[0]
  const state = safe('authoritative state', () => window.stzAppLabels.state())
  const model = safe('runtime diagram', () => JSON.parse(state.runtimeDiagramJson))
  const rootScreen = safe('root screen matrix', () => root?.getScreenCTM())
  const points = ids.map((id) => {
    const nodes = [...document.querySelectorAll(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)], node = nodes[0]
    const body = node?.querySelector('[data-label-state]'), nodeScreen = safe(`${id} screen matrix`, () => node?.getScreenCTM())
    const relative = safe(`${id} root matrix`, () => rootScreen.inverse().multiply(nodeScreen))
    const screen = safe(`${id} screen placement`, () => new DOMPoint().matrixTransform(nodeScreen))
    return { id, count: nodes.length, connected: node?.isConnected ?? false,
      sameIdentity: !!owned && node === owned.nodes.get(id), inRoot: !!node && root?.contains(node) === true,
      model: model?.strata.find((point) => point.id === id) ?? null,
      owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
      bodyRequest: body?.getAttribute('data-label-request') ?? null, source: body?.getAttribute('data-label-source') ?? null,
      status: body?.getAttribute('data-label-state') ?? null, anchor: node?.getAttribute('data-point-anchor') ?? null,
      layout: node?.getAttribute('data-point-layout') ?? null, nodeTransform: node?.getAttribute('transform') ?? null,
      screenCTM: matrix(nodeScreen), CTM: safe(`${id} CTM`, () => matrix(node?.getCTM())), rootMatrix: matrix(relative),
      screen: xy(screen), root: safe(`${id} root placement`, () => xy(screen.matrixTransform(rootScreen.inverse()))) }
  })
  const scroll = []
  for (let element = root?.parentElement; element; element = element.parentElement) {
    scroll.push({ tag: element.localName, id: element.id, className: element.className,
      scrollTop: element.scrollTop, scrollLeft: element.scrollLeft, bounds: rect(element.getBoundingClientRect()) })
  }
  return { at: performance.now(), state, errors, points,
    click: safe('immutable export click', () => window.stzAppLabels.pointExportClick()),
    hold: safe('captured source hold', () => window.stzAppLabels.pending(source)),
    controls: { panelCount: panels.length, panelHeading: panel?.querySelector('#camera-heading')?.textContent ?? null,
      zoom: controls('zoom value', 'number', 'zoom'), slider: controls('zoom slider', 'range', 'slider'),
      panX: controls('pan x value', 'number', 'panX'), panY: controls('pan y value', 'number', 'panY'),
      associated: !!zoom && !!slider && zoom.closest('label') === slider.closest('label'),
      disclosure: { count: disclosures.length, connected: disclosure?.isConnected ?? false,
        sameIdentity: !!owned && disclosure === owned.disclosure, controls: disclosure?.getAttribute('aria-controls') ?? null,
        expanded: disclosure?.getAttribute('aria-expanded') ?? null, accessibleName: disclosure?.textContent?.trim() ?? null } },
    canvas: { count: roots.length, connected: root?.isConnected ?? false, sameIdentity: !!owned && root === owned.root,
      viewBox: root?.getAttribute('viewBox') ?? null, preserveAspectRatio: root?.getAttribute('preserveAspectRatio') ?? null,
      width: root?.getAttribute('width') ?? null, height: root?.getAttribute('height') ?? null,
      client: rect(root?.getBoundingClientRect()), screenCTM: matrix(rootScreen), CTM: safe('root CTM', () => matrix(root?.getCTM())) },
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio }, scroll,
    events: owned ? structuredClone(owned.events) : null, droppedEvents: owned?.droppedEvents ?? null }
}

function installPendingViewObserver({ token, ids, source }) {
  const registry = window.__stzPendingViews ??= new Map()
  if (registry.has(token)) throw new Error(`View observer already owned: ${token}`)
  const input = (name) => document.querySelector(`input[type="number"][aria-label="${name}"]`)
  const owned = { zoom: input('zoom value'), slider: document.querySelector('input[type="range"][aria-label="zoom slider"]'),
    panX: input('pan x value'), panY: input('pan y value'), root: document.querySelector('svg.svg-diagram'),
    disclosure: document.querySelector('.camera-panel .camera-summary-toggle'),
    nodes: new Map(ids.map((id) => [id, document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)])),
    events: [], droppedEvents: 0 }
  owned.listener = (event) => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.closest('.camera-panel')) return
    if (owned.events.length >= 12) { owned.droppedEvents++; return }
    owned.events.push({ order: owned.events.length, at: performance.now(), type: event.type, trusted: event.isTrusted,
      target: { tag: event.target.localName, type: event.target.type, accessibleName: event.target.getAttribute('aria-label'),
        connected: event.target.isConnected, sameIdentity: event.target === owned.zoom,
        inDetails: event.target.closest('#camera-details') !== null }, value: event.target.value,
      sliderValue: owned.slider?.value ?? null, inputType: event.inputType ?? null, data: event.data ?? null,
      state: window.stzAppLabels.state(), hold: window.stzAppLabels.pending(source),
      points: ids.map((id) => {
        const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`), body = node?.querySelector('[data-label-state]')
        return { id, connected: node?.isConnected ?? false, sameIdentity: node === owned.nodes.get(id),
          owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
          source: body?.getAttribute('data-label-source') ?? null }
      }) })
  }
  registry.set(token, owned)
  for (const type of ['input', 'change']) document.addEventListener(type, owned.listener, true)
}
function removePendingViewObserver(token) {
  const registry = window.__stzPendingViews, owned = registry?.get(token)
  if (owned) for (const type of ['input', 'change']) document.removeEventListener(type, owned.listener, true)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzPendingViews
  return !window.__stzPendingViews?.has(token)
}
function commitViewFrames() {
  return new Promise((resolve, reject) => {
    let frame
    const timer = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error('Pending view commit exceeded 2000ms')) }, 2000)
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { clearTimeout(timer); resolve() }) })
  })
}
const sameState = (a, b) => {
  for (const field of stateFields) {
    assert.notEqual(a?.[field], undefined, `View observation retains ${field}`)
    assert.deepEqual(b?.[field], a[field], `View-only action preserves ${field}`)
  }
}
const finiteMatrix = (matrix) => {
  assert.ok(matrix && ['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(matrix[key])))
  assert.ok(Number.isFinite(matrix.a * matrix.d - matrix.b * matrix.c) && Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12)
}
const close = (a, b) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && (Math.abs(a - b) < 1e-7 || a === Math.fround(b)), 'Native point/matrix values agree')
// SVG transform lists use binary32 in Chrome. Propagate half an ulp from
// each independently observed translation through subtraction and scale/origin
// inference; this changes no PGF/reference tolerance and is not a pixel margin.
const nativeTranslationError = (value) => Math.max(2 ** -150, 2 ** (Math.floor(Math.log2(Math.abs(value) || 2 ** -126)) - 24))
const derivedClose = (a, b, error) => assert.ok(Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= error + 1e-7, 'Native projection agrees within propagated binary32 rounding')

export function assertPendingLayoutViewStage(stage, record) {
  assert.ok(stage); assert.deepEqual(stage.errors, []); assert.ok(Number.isFinite(stage.at))
  assert.deepEqual(stage.click, record.click, 'Live diagnostics preserve the original export-click snapshot')
  assert.ok(stage.hold?.started > 0); assert.equal(stage.hold.completed, 0); assert.equal(stage.hold.released, false)
  const model = JSON.parse(stage.state.runtimeDiagramJson)
  assert.equal(model.ambientDimension, 2); assert.deepEqual(stage.state.selection, { kind: 'stratum', id: 'layout-circle' })
  const c = stage.controls
  assert.equal(c.panelCount, 1); assert.equal(c.panelHeading, 'Preview view'); assert.equal(c.associated, true)
  assert.equal(c.disclosure.count, 1); assert.equal(c.disclosure.connected, true); assert.equal(c.disclosure.sameIdentity, true)
  assert.equal(c.disclosure.controls, 'camera-details'); assert.equal(c.disclosure.expanded, 'true'); assert.ok(c.disclosure.accessibleName.includes('Preview view'))
  for (const [key, name, type] of [['zoom', 'zoom value', 'number'], ['slider', 'zoom slider', 'range'], ['panX', 'pan x value', 'number'], ['panY', 'pan y value', 'number']]) {
    const control = c[key]
    assert.equal(control.count, 1); assert.equal(control.tag, 'input'); assert.equal(control.type, type); assert.equal(control.accessibleName, name)
    for (const property of ['connected', 'sameIdentity', 'inPanel', 'inDetails', 'valid']) assert.equal(control[property], true)
    assert.notEqual(control.value, ''); assert.ok(Number.isFinite(Number(control.value)))
    assert.notEqual(control.min, null); assert.notEqual(control.max, null)
    assert.ok(Number.isFinite(Number(control.min)) && Number.isFinite(Number(control.max)) && Number(control.min) < Number(control.max))
    assert.ok(Number(control.value) >= Number(control.min) && Number(control.value) <= Number(control.max))
    assert.ok(control.bounds && Object.values(control.bounds).every(Number.isFinite) && control.bounds.width > 0 && control.bounds.height > 0)
  }
  assert.equal(c.zoom.min, c.slider.min); assert.equal(c.zoom.max, c.slider.max); assert.equal(c.zoom.step, 'any')
  assert.ok(Number.isFinite(Number(c.slider.step)) && Number(c.slider.step) > 0)
  const root = stage.canvas
  assert.equal(root.count, 1); assert.equal(root.connected, true); assert.equal(root.sameIdentity, true)
  const viewBox = root.viewBox?.trim().split(/[\s,]+/).map(Number)
  assert.equal(viewBox?.length, 4); assert.ok(viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0)
  assert.ok(root.client && Object.values(root.client).every(Number.isFinite) && root.client.width > 0 && root.client.height > 0)
  finiteMatrix(root.screenCTM); finiteMatrix(root.CTM)
  assert.ok(stage.viewport && Object.values(stage.viewport).every(Number.isFinite) && stage.viewport.width > 0 && stage.viewport.height > 0)
  assert.ok(stage.scroll.length > 0); for (const scroll of stage.scroll) assert.ok(Number.isFinite(scroll.scrollTop) && Number.isFinite(scroll.scrollLeft))
  assert.deepEqual(stage.points.map(({ id }) => id), record.ids)
  for (const point of stage.points) {
    assert.equal(point.count, 1); assert.equal(point.connected, true); assert.equal(point.sameIdentity, true); assert.equal(point.inRoot, true)
    assert.deepEqual(point.model, model.strata.find(({ id }) => id === point.id)); assert.equal(point.model.geometricKind, 'point'); assert.equal(point.model.codim, 2)
    assert.equal(point.model.position.z, 0); assert.ok(Object.values(point.model.position).every(Number.isFinite))
    assert.deepEqual(JSON.parse(point.owner), ['point-node', stage.state.labelDocumentRevision, point.id])
    assert.ok(point.request); assert.equal(point.request, point.bodyRequest); assert.equal(point.source, point.model.text)
    assert.equal(point.anchor, point.model.style.layout.anchor); assert.deepEqual(JSON.parse(point.layout), { ...point.model.style.layout,
      fontContext: { fontSizePt: 10, xHeightPt: 4.30554, ...point.model.style.layout.fontContext } })
    assert.ok(['pending', 'ready'].includes(point.status))
    for (const key of ['screenCTM', 'CTM', 'rootMatrix']) finiteMatrix(point[key])
    close(point.screen.x, point.screenCTM.e); close(point.screen.y, point.screenCTM.f)
    close(point.root.x, point.rootMatrix.e); close(point.root.y, point.rootMatrix.f)
    const m = root.screenCTM, p = point.root, n = point.rootMatrix
    close(point.screen.x, m.a * p.x + m.c * p.y + m.e); close(point.screen.y, m.b * p.x + m.d * p.y + m.f)
    for (const [key, value] of Object.entries({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
      c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d })) close(point.screenCTM[key], value)
  }
}

export function assertPendingLayoutViewEvidence(record, click = record?.click) {
  assert.ok(record && ['observed', 'passed'].includes(record.result)); assert.equal(record.error, undefined)
  assert.equal(record.scenario, 'point-layout-pending-transparent-edit'); assert.equal(record.target, 1.4)
  assert.deepEqual(record.ids, ['layout-circle', ...pendingViewReferenceIds]); assert.deepEqual(record.click, click)
  assert.equal(record.source, click.snapshot.points.find(({ id }) => id === 'layout-circle').source)
  assert.equal(record.fillCount, 1); assert.equal(record.resolution.numericCount, 1); assert.equal(record.resolution.sliderCount, 1)
  assert.equal(record.preparation.disclosureCount, 1); assert.ok(['true', 'false'].includes(record.preparation.originalExpanded))
  assert.deepEqual(record.stages.map(({ boundary }) => boundary), ['before', 'immediate-input', 'after'])
  const [before, immediate, after] = record.stages
  for (const stage of record.stages) { assertPendingLayoutViewStage(stage, record); sameState(before.state, stage.state) }
  sameState(record.preparation.stateBefore, before.state)
  assert.ok(before.at <= immediate.at && immediate.at <= after.at, 'Actual view observations retain chronological order')
  const edited = JSON.parse(click.snapshot.runtimeDiagramJson), circle = edited.strata.find(({ id }) => id === 'layout-circle')
  circle.text = 'later $changed$'; circle.style.layout.anchor = 'north'; circle.style.layout.minimumWidth = 110
  assert.deepEqual(JSON.parse(before.state.runtimeDiagramJson), edited, 'Baseline follows only the intended source/anchor/minimum edits')
  assert.equal(before.state.labelDocumentRevision, click.snapshot.runtime.documentRevision)
  assert.equal(before.state.uiSettings, click.snapshot.uiSettings); assert.deepEqual(before.state.selection, click.snapshot.selection)
  const zoom = Number(before.controls.zoom.value), ratio = record.target / zoom
  assert.ok(zoom > 0); assert.notEqual(zoom, record.target, 'Already-equal zoom is a failed view-change precondition')
  assert.equal(Number(before.controls.slider.value), zoom)
  for (const stage of [immediate, after]) {
    assert.equal(Number(stage.controls.zoom.value), record.target); assert.equal(Number(stage.controls.slider.value), record.target)
    for (const key of ['panX', 'panY']) for (const field of ['value', 'min', 'max', 'step', 'sameIdentity']) {
      assert.deepEqual(stage.controls[key][field], before.controls[key][field], 'Native pan controls remain fixed')
    }
    assert.deepEqual(stage.hold, before.hold, 'The original source remains held through this view-only action')
    for (const key of ['viewBox', 'width', 'height', 'preserveAspectRatio']) assert.equal(stage.canvas[key], before.canvas[key])
    for (const point of stage.points) {
      const old = before.points.find(({ id }) => id === point.id)
      for (const field of ['model', 'owner', 'request', 'source', 'layout', 'anchor']) assert.deepEqual(point[field], old[field])
      // A current unrelated conversion may finish. It keeps the same source,
      // request and placement origin; text/contour dimensions prove no zoom.
      assert.ok(point.status === old.status || (old.status === 'pending' && point.status === 'ready'))
    }
  }
  const refs = (stage) => pendingViewReferenceIds.map((id) => stage.points.find((point) => point.id === id))
  const [a, b] = refs(before), [c, d] = refs(after)
  for (const point of [a, b]) {
    const captured = click.snapshot.points.find(({ id }) => id === point.id)
    assert.equal(point.request, captured.request); assert.equal(point.owner, captured.owner); assert.equal(point.source, captured.source)
  }
  const modelDx = b.model.position.x - a.model.position.x, modelDy = b.model.position.y - a.model.position.y
  assert.ok(modelDx !== 0 && modelDy !== 0, 'Stable references differ on both model axes')
  const scaleX = (b.root.x - a.root.x) / modelDx, scaleY = -(b.root.y - a.root.y) / modelDy
  const errorX = (nativeTranslationError(a.root.x) + nativeTranslationError(b.root.x)) / Math.abs(modelDx)
  const errorY = (nativeTranslationError(a.root.y) + nativeTranslationError(b.root.y)) / Math.abs(modelDy)
  assert.ok(scaleX > 0 && scaleY > 0); derivedClose(scaleX, scaleY, errorX + errorY)
  for (const axis of ['x', 'y']) derivedClose(d.root[axis] - c.root[axis], (b.root[axis] - a.root[axis]) * ratio,
    nativeTranslationError(d.root[axis]) + nativeTranslationError(c.root[axis])
      + ratio * (nativeTranslationError(b.root[axis]) + nativeTranslationError(a.root[axis])))
  assert.notDeepEqual(c.root, a.root); assert.notDeepEqual(d.root, b.root)
  // Measured separation establishes scale; absolute placement also excludes
  // a hidden translation/pan. No production camera/layout solver is the oracle.
  const origin = { x: a.root.x - scaleX * a.model.position.x, y: a.root.y + scaleY * a.model.position.y }
  for (const point of after.points) {
    for (const axis of ['x', 'y']) derivedClose(point.root[axis], origin[axis]
      + (axis === 'x' ? 1 : -1) * (axis === 'x' ? scaleX : scaleY) * ratio * point.model.position[axis],
    nativeTranslationError(point.root[axis]) + nativeTranslationError(a.root[axis])
      + (axis === 'x' ? errorX : errorY) * Math.abs(ratio * point.model.position[axis] - a.model.position[axis]))
  }
  const events = after.events
  assert.equal(before.events.length, 0); assert.equal(after.droppedEvents, 0)
  assert.ok(events.length >= 1 && events.length <= 2); assert.equal(events[0].type, 'input')
  if (events.length === 2) assert.equal(events[1].type, 'change')
  assert.deepEqual(immediate.events, events)
  for (const [index, event] of events.entries()) {
    assert.equal(event.order, index); assert.equal(event.trusted, true); assert.ok(Number.isFinite(event.at) && event.at >= before.at && event.at <= immediate.at)
    assert.deepEqual(event.target, { tag: 'input', type: 'number', accessibleName: 'zoom value', connected: true, sameIdentity: true, inDetails: true })
    assert.equal(Number(event.value), record.target); sameState(before.state, event.state); assert.deepEqual(event.hold, before.hold)
    assert.deepEqual(event.points, before.points.map(({ id, owner, request, source }) => ({ id, owner, request, source, connected: true, sameIdentity: true })))
  }
  assert.equal(record.cleanup.observerRemoved, true); assert.equal(record.cleanup.disclosureRestored, true)
  sameState(after.state, record.cleanup.observation.state)
  assert.deepEqual(record.cleanup.observation.hold, after.hold); assert.deepEqual(record.cleanup.observation.click, record.click)
  assert.equal(record.cleanup.observation.disclosureCount, 1)
  assert.equal(record.cleanup.observation.expanded, record.preparation.originalExpanded)
  assert.deepEqual(record.secondaryErrors, [])
}

export async function changePendingLayoutView({ page, scenario, source, click, persist, secondaryErrors }) {
  const token = `${scenario}:post-click-view`, ids = ['layout-circle', ...pendingViewReferenceIds]
  const record = { scenario, source, click: structuredClone(click), target: 1.4, ids, result: 'observed', stages: [], fillCount: 0,
    resolution: {}, preparation: {}, cleanup: { observerRemoved: false, disclosureRestored: false }, secondaryErrors: [] }
  const retain = () => boundedPointDiagnostic(() => persist(record), 'Pending post-click view evidence', 5000)
  const capture = async (boundary) => {
    const stage = { boundary, ...await boundedPointDiagnostic(() => page.evaluate(observePendingLayoutView, { token, source, ids }), 'Pending view native observations', 5000) }
    record.stages.push(stage); await retain(); return stage
  }
  const disclosure = page.locator('.camera-panel .camera-summary-toggle')
  let primary, installed = false, expanded = false
  try {
    record.preparation.stateBefore = await page.evaluate(() => window.stzAppLabels.state())
    record.preparation.disclosureCount = await disclosure.count()
    record.preparation.originalExpanded = await disclosure.getAttribute('aria-expanded')
    await retain(); assert.equal(record.preparation.disclosureCount, 1)
    assert.ok(['true', 'false'].includes(record.preparation.originalExpanded))
    if (record.preparation.originalExpanded === 'false') { await disclosure.click({ timeout: 5000 }); expanded = true }
    const zoom = page.getByRole('spinbutton', { name: 'zoom value', exact: true })
    record.resolution.numericCount = await zoom.count()
    record.resolution.sliderCount = await page.getByRole('slider', { name: 'zoom slider', exact: true }).count()
    await retain(); assert.equal(record.resolution.numericCount, 1); assert.equal(record.resolution.sliderCount, 1)
    await zoom.scrollIntoViewIfNeeded({ timeout: 5000 }); await page.evaluate(commitViewFrames)
    await page.evaluate(installPendingViewObserver, { token, ids, source }); installed = true
    const before = await capture('before')
    sameState(record.preparation.stateBefore, before.state)
    assertPendingLayoutViewStage(before, record)
    assert.notEqual(Number(before.controls.zoom.value), record.target, 'Declared zoom must differ before native input')
    assert.equal(Number(before.controls.zoom.value), Number(before.controls.slider.value))
    assert.ok(record.target >= Number(before.controls.zoom.min) && record.target <= Number(before.controls.zoom.max))
    record.fillCount++
    try { await zoom.fill(String(record.target), { timeout: 5000 }) } catch (error) { primary = error }
    for (const [operation, action] of [['Immediate pending view observation', () => capture('immediate-input')],
      ['Pending view bounded commit', () => page.evaluate(commitViewFrames)], ['Committed pending view observation', () => capture('after')]]) {
      try { await action() } catch (error) {
        if (!primary) primary = error
        else { record.secondaryErrors.push({ operation, message: error.message }); secondaryErrors.push(`${operation}: ${error.message}`) }
      }
    }
  } catch (error) { primary = error; record.error = { message: error.message, stack: error.stack } }
  finally {
    const cleanup = async (operation, action) => {
      try { return await boundedPointDiagnostic(action, operation, 5000) } catch (error) {
        primary ??= error; record.secondaryErrors.push({ operation, message: error.message }); secondaryErrors.push(`${operation}: ${error.message}`)
        return false
      }
    }
    record.cleanup.observerRemoved = !installed || await cleanup('Pending view observer cleanup', () => page.evaluate(removePendingViewObserver, token))
    record.cleanup.disclosureRestored = !expanded || await cleanup('Pending view disclosure restoration', async () => {
      assert.equal(await disclosure.getAttribute('aria-expanded'), 'true'); await disclosure.click({ timeout: 5000 })
      assert.equal(await disclosure.getAttribute('aria-expanded'), 'false'); return true
    })
    record.cleanup.observation = await cleanup('Pending view restoration observations', () => page.evaluate((source) => ({
      state: window.stzAppLabels.state(), hold: window.stzAppLabels.pending(source), click: window.stzAppLabels.pointExportClick(),
      disclosureCount: document.querySelectorAll('.camera-panel .camera-summary-toggle').length,
      expanded: document.querySelector('.camera-panel .camera-summary-toggle')?.getAttribute('aria-expanded') ?? null }), source))
    if (primary) record.error = { message: primary.message, stack: primary.stack }
    await cleanup('Final pending view evidence', retain)
  }
  if (!primary) {
    try { assertPendingLayoutViewEvidence(record, click); record.result = 'passed'; await retain() }
    catch (error) { primary = error; record.result = 'observed'; record.error = { message: error.message, stack: error.stack }; try { await retain() } catch (secondary) { secondaryErrors.push(secondary.message) } }
  }
  if (primary) throw primary
  return record
}
