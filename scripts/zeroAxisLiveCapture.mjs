import assert from 'node:assert/strict'

// Observation only: native toolbar input, the single image and bounded cleanup
// belong to the caller. screenCTM already includes the current page scroll.
export function observeZeroAxisCapture({ snapshot, halfExtent }) {
  const errors = [], safe = (name, operation) => {
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
  const roots = [...document.querySelectorAll('svg.svg-diagram')], root = roots[0] ?? null
  const backgrounds = root ? [...root.children].filter((element) => element instanceof SVGElement
    && element.localName === 'rect' && element.getAttribute('data-svg-background') === 'true') : []
  const describe = (element) => {
    if (!(element instanceof Element)) return null
    const current = roots.length === 1 && root.isConnected
    return { tag: element.localName, id: element.id, class: element.getAttribute('class'),
      pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
      drawer: !!element.closest('#preview-inspector-drawer'), ariaLabel: element.getAttribute('aria-label'),
      svg: element instanceof SVGElement, canvas: !!element.closest('svg.svg-diagram'),
      canvasRoot: element.matches('svg.svg-diagram'), connected: element.isConnected,
      svgBackgroundAttribute: element.getAttribute('data-svg-background'),
      currentCanvas: current && element.closest('svg.svg-diagram') === root,
      currentCanvasRoot: current && element.isConnected && element === root,
      canvasDirectChild: root !== null && element.parentElement === root,
      svgBackground: current && element instanceof SVGElement && element.isConnected && element.localName === 'rect'
        && element.getAttribute('data-svg-background') === 'true' && element.parentElement === root
        && backgrounds.length === 1 && element === backgrounds[0],
      pointHandle: element.matches('circle.svg-geometry-handle') && !!element.closest('[aria-label="Selected point drag handles"]'),
      creationToolbar: !!element.closest('.preview-floating-toolbar'), toolbarOverlay: !!element.closest('.preview-toolbar-overlay-stack'),
      quickStyle: !!element.closest('.context-quick-style-bar'), history: !!element.closest('.preview-history-overlay') }
  }
  const points = [...document.querySelectorAll('[data-point-id="zero-overlap"] [data-point-node]')]
  const point = points[0] ?? null, contours = point ? [...point.querySelectorAll('[data-point-contour]')] : []
  const contour = contours[0] ?? null, body = point?.querySelector('[data-label-state]')
  const state = safe('fresh capture App state', () => window.stzAppLabels.state())
  const ctm = safe('fresh capture contour screenCTM', () => matrix(contour, 'getScreenCTM'))
  const project = ({ x, y }) => ({ x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f })
  const length = safe('fresh capture native length', () => contour.getTotalLength())
  const nativeTraversal = safe('fresh capture native traversal', () => [0, .25, .5, .75, 1].map((fraction) => {
    const value = contour.getPointAtLength(length * fraction); return { x: value.x, y: value.y }
  }))
  const strokeWidth = Number(contour?.getAttribute('stroke-width'))
  const endpoints = safe('independent projected capture extrema', () => [{ x: 0, y: -halfExtent }, { x: 0, y: halfExtent }].map(project))
  const nativeEndpoints = safe('native projected capture extrema', () => [nativeTraversal[1], nativeTraversal[3]].map(project))
  const corners = safe('complete capture stroke footprint', () => {
    const half = strokeWidth / 2, extent = halfExtent + half
    return [{ x: -half, y: -extent }, { x: half, y: -extent }, { x: half, y: extent }, { x: -half, y: extent }].map(project)
  })
  const bounds = corners ? { x: Math.min(...corners.map(({ x }) => x)), y: Math.min(...corners.map(({ y }) => y)),
    width: Math.max(...corners.map(({ x }) => x)) - Math.min(...corners.map(({ x }) => x)),
    height: Math.max(...corners.map(({ y }) => y)) - Math.min(...corners.map(({ y }) => y)) } : null
  const intersects = (box) => !!(bounds && box && box.x < bounds.x + bounds.width && box.x + box.width > bounds.x
    && box.y < bounds.y + bounds.height && box.y + box.height > bounds.y)
  const visible = (element) => {
    const box = rect(element)
    if (!element?.isConnected || !box || box.width <= 0 || box.height <= 0) return false
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current)
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false
    }
    return true
  }
  const painted = (element) => {
    const style = getComputedStyle(element)
    const colorPaints = (color) => color !== 'transparent' && !/^rgba\([^)]*,\s*0\)$/u.test(color)
    return colorPaints(style.backgroundColor) || style.backgroundImage !== 'none' || style.boxShadow !== 'none'
      || ['Top', 'Right', 'Bottom', 'Left'].some((side) => parseFloat(style[`border${side}Width`]) > 0
        && !['none', 'hidden'].includes(style[`border${side}Style`]) && colorPaints(style[`border${side}Color`]))
      || element instanceof SVGElement || ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'CANVAS', 'VIDEO'].includes(element.tagName)
      || [...element.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== '')
  }
  const controls = Object.fromEntries([['collapse', 'Collapse preview toolbar'], ['expand', 'Expand preview toolbar']].map(([name, label]) =>
    [name, [...document.querySelectorAll('button')].filter((element) => element.getAttribute('aria-label') === label)
      .map((element) => ({ element: describe(element), bounds: rect(element), visible: visible(element), disabled: element.disabled }))]))
  const overlays = [], seen = new Set()
  const addOverlay = (kind, element, forcePaint = false) => {
    if (seen.has(element)) return
    seen.add(element)
    const box = rect(element)
    overlays.push({ kind, element: describe(element), bounds: box, visible: visible(element),
      intersects: intersects(box), painted: forcePaint || painted(element) })
  }
  for (const [kind, selector] of [['toolbar', 'section.preview-floating-toolbar'], ['toolbar-container', '.preview-toolbar-overlay-stack'],
    ['history', '.preview-history-overlay'], ['quick-style', '.context-quick-style-bar'], ['inspector', '#preview-inspector-drawer'],
    ['selection-decoration', '[aria-label="Selected point drag handles"],.svg-selection-cycle-feedback']]) {
    for (const element of document.querySelectorAll(selector)) addOverlay(kind, element, kind !== 'toolbar-container')
  }
  // Record other visible painted UI intersecting the complete footprint, even
  // when pointer-events:none would remove it from elementFromPoint ownership.
  for (const element of document.querySelectorAll('body *')) {
    if (element === root || root?.contains(element) || element.contains(root) || seen.has(element)
      || !intersects(rect(element)) || !visible(element) || !painted(element)) continue
    addOverlay(element.closest('.preview-floating-toolbar,.preview-toolbar-overlay-stack,.context-quick-style-bar') ? 'toolbar' : 'other-ui', element)
  }
  const samples = safe('complete capture hit stacks', () => {
    const steps = Math.max(1, Math.ceil(2 * halfExtent * Math.hypot(ctm.c, ctm.d)))
    if (3 * (steps + 1) + 4 > 2048) throw new Error('Complete capture hit stacks exceed the bounded 2048-sample budget')
    const locals = []
    for (let index = 0; index <= steps; index++) for (const x of [-strokeWidth / 4, 0, strokeWidth / 4]) {
      locals.push({ x, y: -halfExtent + 2 * halfExtent * index / steps })
    }
    const half = strokeWidth / 2, extent = halfExtent + half
    locals.push({ x: -half, y: -extent }, { x: half, y: -extent }, { x: half, y: extent }, { x: -half, y: extent })
    return locals.map((local) => {
      const screen = project(local)
      return { local, screen, elementFromPoint: describe(document.elementFromPoint(screen.x, screen.y)),
        elementsFromPoint: document.elementsFromPoint(screen.x, screen.y).slice(0, 16).map(describe) }
    })
  }) ?? []
  const supportedTarget = (target) => target?.connected === true && target.svg === true && target.canvas === true
    && target.currentCanvas === true && target.drawer === false
    && target.pointHandle === false && target.creationToolbar === false && target.toolbarOverlay === false
    && target.quickStyle === false && target.history === false
    && ((target.pointId === null && ((target.tag === 'svg' && target.currentCanvasRoot === true && target.canvasRoot === true)
      || (target.tag === 'rect' && target.svgBackground === true && target.canvasDirectChild === true && target.svgBackgroundAttribute === 'true')))
      || (target.tag === 'path' && ['app-point', 'zero-overlap'].includes(target.pointId)))
  const obstructions = overlays.flatMap((overlay, index) => overlay.visible && overlay.painted && overlay.intersects ? [{ kind: 'overlay', index }] : [])
  for (const [index, sample] of samples.entries()) if (!supportedTarget(sample.elementFromPoint)
    || !sample.elementsFromPoint.some((element) => element?.currentCanvasRoot === true)) obstructions.push({ kind: 'hit-stack', index })
  const inside = (box) => !!(bounds && box && bounds.x >= box.x && bounds.y >= box.y
    && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height)
  const viewport = { width: innerWidth, height: innerHeight, devicePixelRatio, scrollX, scrollY,
    visual: visualViewport ? { width: visualViewport.width, height: visualViewport.height,
      offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null }
  const current = { rootCount: roots.length, pointCount: points.length, contourCount: contours.length,
    canvasObservation: { rootCount: roots.length, backgroundCount: backgrounds.length, root: describe(root), background: describe(backgrounds[0]) },
    layout: { shape: point?.getAttribute('data-point-shape') ?? null, parameters: point?.getAttribute('data-point-shape-parameters') ?? null,
      owner: point?.getAttribute('data-point-node') ?? null, request: point?.getAttribute('data-point-request') ?? null,
      bodyRequest: body?.getAttribute('data-label-request') ?? null, source: body?.getAttribute('data-label-source') ?? null,
      state: body?.getAttribute('data-label-state') ?? null }, revision: state?.labelDocumentRevision ?? null,
    geometry: Object.fromEntries([['canvas', root], ['point', point], ['contour', contour]].map(([name, element]) => [name, {
      bounds: safe(`fresh capture ${name} bounds`, () => rect(element)), connected: element?.isConnected ?? false,
      currentCanvas: describe(element)?.currentCanvas ?? false,
      CTM: safe(`fresh capture ${name} CTM`, () => matrix(element, 'getCTM')),
      screenCTM: safe(`fresh capture ${name} screenCTM`, () => matrix(element, 'getScreenCTM')) }])) }
  return { ...snapshot, captureGeometry: { method: 'fresh-native-zero-axis-entire-stroke', current, halfExtent, strokeWidth,
    nativeTraversal, nativeEndpoints, endpoints, footprint: { corners, bounds }, frame: { origin: { x: 0, y: 0 }, viewport },
    controls, overlays, samples, obstructions, insideViewport: inside({ x: 0, y: 0, width: innerWidth, height: innerHeight }),
    insideCanvas: inside(rect(root)), errors } }
}

const stateFields = ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']
const identityFields = ['model', 'camera', 'workPlaneControls', 'workPlaneStatus', 'layout', 'canvasObservation']
const expectedHalfExtent = 20 * Math.SQRT2 * 1.2
const matrixKeys = ['a', 'b', 'c', 'd', 'e', 'f']
const project = (matrix, { x, y }) => ({ x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f })
function invertible(matrix) {
  assert.ok(matrix && matrixKeys.every((key) => Number.isFinite(matrix[key])), 'Capture CTM is finite')
  assert.ok(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12, 'Capture CTM is invertible')
}
function finiteRect(rect) {
  assert.ok(rect && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])))
  assert.ok(rect.width >= 0 && rect.height >= 0)
}
function supportedTarget(target) {
  return target?.connected === true && target.svg === true && target.canvas === true
    && target.currentCanvas === true && target.drawer === false
    && target.pointHandle === false && target.creationToolbar === false && target.toolbarOverlay === false
    && target.quickStyle === false && target.history === false
    && ((target.pointId === null && ((target.tag === 'svg' && target.currentCanvasRoot === true && target.canvasRoot === true)
      || (target.tag === 'rect' && target.svgBackground === true && target.canvasDirectChild === true && target.svgBackgroundAttribute === 'true')))
      || (target.tag === 'path' && ['app-point', 'zero-overlap'].includes(target.pointId)))
}
function toolbar(snapshot) {
  const value = snapshot.toolbar
  assert.equal(value.overlayCount, 1); assert.equal(value.historyCount, 1)
  assert.equal(typeof value.collapsed, 'boolean')
  assert.equal(value.floatingCount, value.collapsed ? 0 : 1)
  assert.equal(value.expandCount, value.collapsed ? 1 : 0); assert.equal(value.collapseCount, value.collapsed ? 0 : 1)
  if (value.collapsed) assert.equal(value.quickStyleCount, 0)
  const controls = snapshot.captureGeometry.controls
  assert.equal(controls.expand.length, value.expandCount); assert.equal(controls.collapse.length, value.collapseCount)
  for (const [name, label] of [['expand', 'Expand preview toolbar'], ['collapse', 'Collapse preview toolbar']]) for (const control of controls[name]) {
    assert.equal(control.element.tag, 'button'); assert.equal(control.element.ariaLabel, label)
    assert.equal(control.element.connected, true); assert.equal(control.element.toolbarOverlay, true)
    assert.equal(control.element.currentCanvas, false); assert.equal(control.visible, true); assert.equal(control.disabled, false)
    finiteRect(control.bounds); assert.ok(control.bounds.width > 0 && control.bounds.height > 0)
  }
}

export function assertZeroAxisCaptureSnapshot(state, snapshot, { requireClear = false } = {}) {
  assert.deepEqual(snapshot.errors, []); assert.equal(snapshot.readyState, 'complete')
  assert.equal(snapshot.labelDocumentRevision, state.labelDocumentRevision); assert.deepEqual(snapshot.selection, state.selection)
  const runtime = JSON.parse(state.runtimeDiagramJson), point = runtime.strata.find(({ id }) => id === 'zero-overlap')
  assert.ok(point); assert.deepEqual(snapshot.model, point); assert.deepEqual(snapshot.camera, runtime.camera ?? null)
  assert.deepEqual(JSON.parse(snapshot.layout.owner), ['point-node', state.labelDocumentRevision, 'zero-overlap'])
  assert.equal(snapshot.layout.shape, 'ellipse'); assert.equal(snapshot.layout.state, 'ready'); assert.equal(snapshot.layout.source, '')
  assert.ok(snapshot.layout.request); assert.equal(snapshot.layout.request, snapshot.layout.bodyRequest)
  assert.ok(Number.isFinite(snapshot.at), 'Fresh capture observation retains its actual timestamp')
  assert.equal(snapshot.inspector.open, false, 'Live capture inherits completed Inspector restoration')
  const value = snapshot.captureGeometry
  assert.ok(value, 'Live capture requires fresh full-stroke observations')
  assert.equal(value.method, 'fresh-native-zero-axis-entire-stroke'); assert.deepEqual(value.errors, [])
  assert.equal(value.halfExtent, expectedHalfExtent); assert.equal(value.strokeWidth, .48)
  assert.equal(value.current.rootCount, 1); assert.equal(value.current.pointCount, 1); assert.equal(value.current.contourCount, 1)
  assert.deepEqual(value.current.canvasObservation, snapshot.canvasObservation)
  assert.equal(snapshot.canvasObservation.rootCount, 1); assert.equal(snapshot.canvasObservation.backgroundCount, 1)
  const root = snapshot.canvasObservation.root, background = snapshot.canvasObservation.background
  assert.equal(root.tag, 'svg'); assert.equal(root.currentCanvasRoot, true); assert.equal(root.canvasRoot, true)
  assert.equal(root.svgBackgroundAttribute, null); assert.equal(root.canvasDirectChild, false); assert.equal(root.svgBackground, false)
  assert.ok(root.class?.split(/\s+/u).includes('svg-diagram'))
  assert.equal(background.tag, 'rect'); assert.equal(background.currentCanvasRoot, false); assert.equal(background.canvasRoot, false)
  assert.equal(background.svgBackgroundAttribute, 'true'); assert.equal(background.canvasDirectChild, true); assert.equal(background.svgBackground, true)
  for (const target of [root, background]) {
    for (const key of ['connected', 'svg', 'canvas', 'currentCanvas']) assert.equal(target[key], true)
    assert.equal(target.pointId, null)
    for (const key of ['drawer', 'pointHandle', 'creationToolbar', 'toolbarOverlay', 'quickStyle', 'history']) assert.equal(target[key], false)
  }
  assert.deepEqual(value.current.layout, snapshot.layout); assert.equal(value.current.revision, state.labelDocumentRevision)
  for (const kind of ['canvas', 'point', 'contour']) {
    const geometry = snapshot.geometry[kind], current = value.current.geometry[kind]
    assert.equal(geometry.connected, true); assert.equal(geometry.currentCanvas, true)
    for (const key of ['connected', 'currentCanvas', 'bounds', 'CTM', 'screenCTM']) assert.deepEqual(current[key], geometry[key], 'Capture measurement authenticates the same current geometry')
    finiteRect(geometry.bounds)
    for (const key of ['CTM', 'screenCTM']) invertible(geometry[key])
  }
  assert.deepEqual(snapshot.coincidentContours.map(({ id }) => id), ['app-point', 'zero-overlap'])
  for (const entry of snapshot.coincidentContours) {
    assert.equal(entry.count, 1); assert.equal(entry.currentCanvas, true)
    assert.deepEqual(JSON.parse(entry.owner), ['point-node', state.labelDocumentRevision, entry.id])
    assert.ok(entry.request); assert.equal(entry.request, entry.bodyRequest); assert.equal(entry.source, ''); assert.equal(entry.state, 'ready')
    assert.equal(entry.shape, 'ellipse'); assert.deepEqual(entry.pointScreenCTM, snapshot.geometry.point.screenCTM)
    assert.deepEqual(entry.contour.screenCTM, snapshot.geometry.contour.screenCTM)
    assert.deepEqual(entry.contour.CTM, snapshot.geometry.contour.CTM); assert.equal(entry.contour.connected, true)
    assert.equal(entry.contour.tag, 'path'); assert.equal(entry.contour.attributes.fill, 'none')
    assert.equal(entry.contour.attributes.stroke, '#B000C0'); assert.equal(entry.contour.attributes['stroke-width'], '0.48')
    assert.equal(entry.contour.bounds.width, 0); assert.ok(Math.abs(entry.contour.length - 4 * expectedHalfExtent) < .005)
    const currentPoint = runtime.strata.find(({ id }) => id === entry.id)
    assert.ok(currentPoint); assert.equal(currentPoint.geometricKind, 'point'); assert.equal(currentPoint.codim, runtime.ambientDimension)
    assert.deepEqual(currentPoint.position, point.position); assert.deepEqual(currentPoint.style, point.style)
    if (entry.id === 'zero-overlap') for (const key of ['owner', 'request', 'bodyRequest', 'source', 'state', 'shape', 'parameters']) assert.equal(entry[key], snapshot.layout[key])
  }
  assert.deepEqual(snapshot.coincidentContours[0].contour, snapshot.coincidentContours[1].contour)
  assert.deepEqual(value.frame.origin, { x: 0, y: 0 }); assert.deepEqual(value.frame.viewport, snapshot.viewport)
  const viewport = value.frame.viewport
  for (const key of ['width', 'height', 'devicePixelRatio', 'scrollX', 'scrollY']) assert.ok(Number.isFinite(viewport[key]))
  assert.ok(viewport.width > 0 && viewport.height > 0 && viewport.devicePixelRatio > 0)
  if (viewport.visual) {
    assert.equal(viewport.visual.scale, 1); assert.equal(viewport.visual.offsetLeft, 0); assert.equal(viewport.visual.offsetTop, 0)
    assert.equal(viewport.visual.width, viewport.width); assert.equal(viewport.visual.height, viewport.height)
  }
  const ctm = snapshot.geometry.contour.screenCTM
  const locals = [0, -expectedHalfExtent, 0, expectedHalfExtent, 0].map((y) => ({ x: 0, y }))
  assert.equal(value.nativeTraversal.length, locals.length)
  for (const [index, local] of locals.entries()) for (const axis of ['x', 'y']) assert.ok(Math.abs(value.nativeTraversal[index][axis] - local[axis]) < .005)
  assert.deepEqual(value.nativeTraversal, snapshot.coincidentContours[1].contour.traversal, 'Fresh native traversal binds the complete footprint to the current coincident contour')
  assert.deepEqual(value.nativeEndpoints, [value.nativeTraversal[1], value.nativeTraversal[3]].map((local) => project(ctm, local)))
  assert.deepEqual(value.endpoints, [locals[1], locals[3]].map((local) => project(ctm, local)))
  for (const [index, endpoint] of value.nativeEndpoints.entries()) for (const axis of ['x', 'y']) {
    assert.ok(Math.abs(endpoint[axis] - value.endpoints[index][axis]) < .005 * Math.hypot(ctm.a, ctm.b, ctm.c, ctm.d))
  }
  const half = value.strokeWidth / 2, extent = expectedHalfExtent + half
  const localCorners = [{ x: -half, y: -extent }, { x: half, y: -extent }, { x: half, y: extent }, { x: -half, y: extent }]
  assert.deepEqual(value.footprint.corners, localCorners.map((local) => project(ctm, local)))
  const corners = value.footprint.corners, bounds = value.footprint.bounds
  assert.deepEqual(bounds, { x: Math.min(...corners.map(({ x }) => x)), y: Math.min(...corners.map(({ y }) => y)),
    width: Math.max(...corners.map(({ x }) => x)) - Math.min(...corners.map(({ x }) => x)),
    height: Math.max(...corners.map(({ y }) => y)) - Math.min(...corners.map(({ y }) => y)) })
  finiteRect(bounds)
  const inside = (box) => bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width
    && bounds.y + bounds.height <= box.y + box.height
  assert.equal(value.insideViewport, inside({ x: 0, y: 0, width: viewport.width, height: viewport.height }))
  assert.equal(value.insideCanvas, inside(snapshot.geometry.canvas.bounds))
  assert.equal(value.insideViewport, true, 'Entire independently known stroke footprint is inside the actual viewport')
  assert.equal(value.insideCanvas, true, 'Entire independently known stroke footprint is inside the actual canvas')
  toolbar(snapshot)
  const intersects = (box) => box.x < bounds.x + bounds.width && box.x + box.width > bounds.x
    && box.y < bounds.y + bounds.height && box.y + box.height > bounds.y
  const obstructions = []
  assert.ok(Array.isArray(value.overlays))
  assert.equal(value.overlays.filter(({ element }) => element?.tag === 'section'
    && element.class?.split(/\s+/u).includes('preview-floating-toolbar')).length, snapshot.toolbar.floatingCount,
  'Fresh full-stroke observation retains only the actually mounted floating toolbar')
  for (const [index, overlay] of value.overlays.entries()) {
    assert.ok(['toolbar', 'toolbar-container', 'history', 'quick-style', 'inspector', 'selection-decoration', 'other-ui'].includes(overlay.kind))
    assert.equal(overlay.element.connected, true); finiteRect(overlay.bounds)
    for (const key of ['visible', 'painted', 'intersects']) assert.equal(typeof overlay[key], 'boolean')
    assert.equal(overlay.intersects, intersects(overlay.bounds))
    if (overlay.visible && overlay.painted && overlay.intersects) obstructions.push({ kind: 'overlay', index })
  }
  const steps = Math.max(1, Math.ceil(2 * expectedHalfExtent * Math.hypot(ctm.c, ctm.d))), sampleLocals = []
  assert.ok(3 * (steps + 1) + 4 <= 2048, 'Complete capture observation stays inside its finite budget')
  for (let index = 0; index <= steps; index++) for (const x of [-value.strokeWidth / 4, 0, value.strokeWidth / 4]) {
    sampleLocals.push({ x, y: -expectedHalfExtent + 2 * expectedHalfExtent * index / steps })
  }
  sampleLocals.push(...localCorners)
  assert.equal(value.samples.length, sampleLocals.length, 'Full stroke hit-stack observations retain every sample and both extrema')
  for (const [index, sample] of value.samples.entries()) {
    assert.deepEqual(sample.local, sampleLocals[index]); assert.deepEqual(sample.screen, project(ctm, sample.local))
    assert.ok(Array.isArray(sample.elementsFromPoint) && sample.elementsFromPoint.length <= 16)
    assert.deepEqual(sample.elementFromPoint, sample.elementsFromPoint[0] ?? null)
    for (const target of sample.elementsFromPoint.filter((element) => element?.currentCanvasRoot === true)) {
      assert.deepEqual(target, snapshot.canvasObservation.root, 'Capture hit stack retains the actual unique authenticated root')
    }
    if (sample.elementFromPoint?.svgBackground === true) assert.deepEqual(sample.elementFromPoint, snapshot.canvasObservation.background)
    if (!supportedTarget(sample.elementFromPoint) || !sample.elementsFromPoint.some((element) => element?.currentCanvasRoot === true)) {
      obstructions.push({ kind: 'hit-stack', index })
    }
  }
  assert.deepEqual(value.obstructions, obstructions, 'Capture obstruction decision follows actual full-stroke overlay bounds and hit stacks')
  if (requireClear) assert.deepEqual(obstructions, [], 'Entire current stroke is unobstructed before the single live image')
}

export function assertZeroAxisCaptureTransition(beforeState, afterState, before, after) {
  assertZeroAxisCaptureSnapshot(beforeState, before); assertZeroAxisCaptureSnapshot(afterState, after)
  assert.ok(after.at >= before.at, 'Fresh native capture transition observations follow lifecycle order')
  for (const field of stateFields) assert.deepEqual(afterState[field], beforeState[field], `Capture native UI preparation preserves ${field}`)
  for (const field of identityFields) assert.deepEqual(after[field], before[field], `Capture native UI preparation preserves current ${field}`)
  for (const entry of after.coincidentContours) {
    const previous = before.coincidentContours.find(({ id }) => id === entry.id)
    assert.ok(previous)
    for (const key of ['id', 'count', 'currentCanvas', 'owner', 'request', 'bodyRequest', 'source', 'state', 'shape', 'parameters', 'layout']) assert.deepEqual(entry[key], previous[key])
    for (const key of ['connected', 'tag', 'attributes', 'bounds', 'length', 'traversal']) assert.deepEqual(entry.contour[key], previous.contour[key])
  }
  assert.deepEqual(after.coincidentContours.map(({ id }) => id), before.coincidentContours.map(({ id }) => id))
}

function assertNativeCaptureAction(action, name, purpose) {
  assert.equal(action.name, name); assert.equal(action.purpose, purpose); assert.equal(action.error, undefined)
  assert.equal(action.controlName, `${name === 'collapse' ? 'Collapse' : 'Expand'} preview toolbar`)
  assert.equal(action.controlCount, 1); assert.equal(action.oppositeCount, 1)
  assert.deepEqual(action.control, action.before.captureGeometry.controls[name][0], 'Native capture action uses the actual measured unique control')
  assertZeroAxisCaptureTransition(action.stateBefore, action.stateAfter, action.before, action.after)
  assert.equal(action.before.toolbar.collapsed, name !== 'collapse'); assert.equal(action.after.toolbar.collapsed, name === 'collapse')
}

// Timestamps are independently measured at every boundary. Validate their
// order, then compare the declared state/identity/frame fields individually;
// never strip or replace arbitrary raw metadata to manufacture continuity.
function assertCaptureBoundary(beforeState, afterState, before, after) {
  assertZeroAxisCaptureTransition(beforeState, afterState, before, after)
  assert.ok(after.at >= before.at, 'Capture observations follow their actual lifecycle order')
  for (const field of ['toolbar', 'viewport', 'scrollAncestors', 'inspector', 'tool', 'selectionHandles', 'captureGeometry', 'coincidentContours']) {
    assert.deepEqual(after[field], before[field], `Capture boundary retains exact ${field}`)
  }
  for (const kind of ['canvas', 'point', 'contour']) for (const key of ['bounds', 'CTM', 'screenCTM']) assert.deepEqual(after.geometry[kind][key], before.geometry[kind][key])
  for (const snapshot of [before, after]) {
    assert.equal(snapshot.requestedClick, null); assert.equal(snapshot.elementFromPoint, null)
    assert.deepEqual(snapshot.elementsFromPoint, []); assert.deepEqual(snapshot.events, []); assert.equal(snapshot.droppedEvents, null)
  }
}

export function assertZeroAxisLiveCapture(live, interaction, pixels) {
  const capture = live?.capture
  assert.ok(capture, 'Missing live capture lifecycle fails closed')
  assert.equal(capture.primary, undefined); assert.deepEqual(capture.secondaryErrors, [])
  assertZeroAxisCaptureSnapshot(capture.inheritedState, capture.inherited)
  const restored = interaction.toolbarRestoration
  const nativeEnd = interaction.actions.at(-1).after
  assert.ok([nativeEnd.at, restored.before.at, restored.after.at].every(Number.isFinite), 'Native action/restoration boundary timestamps are retained')
  assert.ok(restored.before.at >= nativeEnd.at && restored.after.at >= restored.before.at,
    'Interaction restoration completes after the final native action')
  assert.ok(capture.inherited.at >= restored.after.at, 'The capture inherited baseline is measured after completed native interaction restoration')
  for (const field of stateFields) assert.deepEqual(capture.inheritedState[field], restored.stateAfter[field], 'Capture baseline follows completed interaction restoration')
  for (const field of identityFields) assert.deepEqual(capture.inherited[field], restored.after[field])
  assert.deepEqual(capture.inherited.toolbar, restored.after.toolbar)
  for (const kind of ['canvas', 'point', 'contour']) for (const key of ['CTM', 'screenCTM']) assert.deepEqual(capture.inherited.geometry[kind][key], restored.after.geometry[kind][key])
  const obstructed = capture.inherited.captureGeometry.obstructions.length > 0
  assert.deepEqual(capture.decision, { action: obstructed ? 'collapse' : 'none',
    reason: obstructed ? 'measured-toolbar-obstruction' : 'already-unobstructed', obstructions: capture.inherited.captureGeometry.obstructions })
  if (obstructed) {
    assert.equal(capture.inherited.toolbar.collapsed, false)
    for (const obstruction of capture.inherited.captureGeometry.obstructions) {
      const value = obstruction.kind === 'overlay' ? capture.inherited.captureGeometry.overlays[obstruction.index]
        : capture.inherited.captureGeometry.samples[obstruction.index].elementFromPoint
      assert.ok(obstruction.kind === 'overlay' ? ['toolbar', 'toolbar-container', 'quick-style'].includes(value.kind)
        : value?.creationToolbar === true || value?.toolbarOverlay === true || value?.quickStyle === true, 'Only observed owned toolbar obstruction authorizes a capture collapse')
    }
    assert.equal(capture.actions.length, 1); assertNativeCaptureAction(capture.actions[0], 'collapse', 'capture-obstruction')
    assertCaptureBoundary(capture.inheritedState, capture.actions[0].stateBefore, capture.inherited, capture.actions[0].before)
    assertCaptureBoundary(capture.actions[0].stateAfter, capture.preparedState, capture.actions[0].after, capture.prepared)
  } else {
    assert.deepEqual(capture.actions, []); assertCaptureBoundary(capture.inheritedState, capture.preparedState, capture.inherited, capture.prepared)
  }
  assertZeroAxisCaptureSnapshot(capture.preparedState, capture.prepared, { requireClear: true })
  assertZeroAxisCaptureTransition(capture.inheritedState, capture.preparedState, capture.inherited, capture.prepared)
  assertCaptureBoundary(capture.preparedState, live.state, capture.prepared, live.snapshot)
  assertZeroAxisCaptureSnapshot(live.afterState, live.afterSnapshot, { requireClear: true })
  assertCaptureBoundary(live.state, live.afterState, live.snapshot, live.afterSnapshot)
  const image = capture.image
  assert.equal(image.attempts, 1); assert.equal(image.fullPage, false); assert.equal(image.scale, 'css')
  assert.equal(typeof image.path, 'string'); assert.ok(image.path.startsWith('/'))
  assert.deepEqual(image.frame, { origin: { x: 0, y: 0 }, viewport: live.snapshot.viewport, ctm: live.snapshot.geometry.contour.screenCTM })
  for (const key of ['bytes', 'sha256', 'width', 'height']) assert.equal(image[key], pixels[key], 'Actual saved PNG identity binds lifecycle to the strict pixel replay')
  assert.equal(image.width, live.snapshot.viewport.width); assert.equal(image.height, live.snapshot.viewport.height)
  assert.deepEqual(pixels.ctm, image.frame.ctm)
  const restoration = capture.restoration
  assert.ok(restoration, 'Live capture restoration is mandatory'); assert.equal(restoration.error, undefined)
  assertCaptureBoundary(live.afterState, restoration.stateBefore, live.afterSnapshot, restoration.before)
  assertZeroAxisCaptureTransition(restoration.stateBefore, restoration.stateAfter, restoration.before, restoration.after)
  if (obstructed) {
    assert.equal(restoration.actions.length, 1); assertNativeCaptureAction(restoration.actions[0], 'expand', 'restore')
    assertCaptureBoundary(restoration.stateBefore, restoration.actions[0].stateBefore, restoration.before, restoration.actions[0].before)
    assertCaptureBoundary(restoration.actions[0].stateAfter, restoration.stateAfter, restoration.actions[0].after, restoration.after)
  } else assert.deepEqual(restoration.actions, [])
  for (const field of stateFields) assert.deepEqual(restoration.stateAfter[field], capture.inheritedState[field], 'Capture restores its exact inherited state')
  for (const field of identityFields) assert.deepEqual(restoration.after[field], capture.inherited[field])
  assert.deepEqual(restoration.after.toolbar, capture.inherited.toolbar)
  for (const field of ['viewport', 'scrollAncestors', 'tool', 'inspector', 'selectionHandles']) {
    assert.deepEqual(restoration.after[field], capture.inherited[field], `Capture restores exact inherited ${field}`)
  }
  for (const kind of ['canvas', 'point', 'contour']) for (const key of ['bounds', 'CTM', 'screenCTM']) {
    assert.deepEqual(restoration.after.geometry[kind][key], capture.inherited.geometry[kind][key], 'Capture restores the inherited actual canvas frame')
  }
  assert.deepEqual(capture.cleanup, { observerRegistries: Object.fromEntries(['geometricSelection', 'pointNativeDrag', 'zeroAxisInput', 'zeroAxisCapture']
    .map((name) => [name, { present: false, size: 0 }])), listenersInstalled: 0, altKeyUp: 'completed-by-native-interaction' })
}
