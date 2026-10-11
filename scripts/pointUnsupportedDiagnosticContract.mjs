import assert from 'node:assert/strict'

// A finite declared counterexample set, chosen before native input. The original
// rightward observation stays first even when it projects beyond the drawing.
export function fixedDiagnosticCandidates(body, warning) {
  const bounds = { minX: Math.min(body.minX, warning.minX), minY: Math.min(body.minY, warning.minY),
    maxX: Math.max(body.maxX, warning.maxX), maxY: Math.max(body.maxY, warning.maxY) }
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  return [
    { name: 'right', local: { x: body.maxX + 100, y: (body.minY + body.maxY) / 2 } },
    { name: 'left', local: { x: bounds.minX - 100, y: center.y } },
    { name: 'below', local: { x: center.x, y: bounds.maxY + 100 } },
    { name: 'above', local: { x: center.x, y: bounds.minY - 100 } },
  ]
}

const pointFinite = (point) => !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
const boundsFinite = (bounds) => !!bounds && ['minX', 'minY', 'maxX', 'maxY'].every((key) => Number.isFinite(bounds[key]))
  && bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY
const rectFinite = (bounds) => !!bounds && ['left', 'top', 'right', 'bottom', 'width', 'height'].every((key) => Number.isFinite(bounds[key]))
  && bounds.width > 0 && bounds.height > 0 && close(bounds.right - bounds.left, bounds.width) && close(bounds.bottom - bounds.top, bounds.height)
const matrixFinite = (matrix) => !!matrix && ['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(matrix[key]))
  && Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12
function close(a, b) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)) }
const samePoint = (actual, expected) => pointFinite(actual) && pointFinite(expected) && close(actual.x, expected.x) && close(actual.y, expected.y)
const inBounds = (point, bounds) => pointFinite(point) && boundsFinite(bounds)
  && point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
const inRect = (point, rect) => pointFinite(point) && rectFinite(rect)
  && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
function distanceToBounds(point, bounds) {
  return Math.hypot(Math.max(bounds.minX - point.x, point.x - bounds.maxX, 0), Math.max(bounds.minY - point.y, point.y - bounds.maxY, 0))
}
function transform(matrix, point) {
  return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f }
}
function inverseTransform(matrix, point) {
  const det = matrix.a * matrix.d - matrix.b * matrix.c
  const x = point.x - matrix.e, y = point.y - matrix.f
  return { x: (matrix.d * x - matrix.c * y) / det, y: (-matrix.b * x + matrix.a * y) / det }
}
function viewBoxFinite(box) { return box && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(box[key])) && box.width > 0 && box.height > 0 }
function viewportFinite(viewport) {
  return viewport && ['width', 'height', 'scrollX', 'scrollY'].every((key) => Number.isFinite(viewport[key])) && viewport.width > 0 && viewport.height > 0
}
function visibleProjectionReasons(measurement, click) {
  const reasons = []
  if (!pointFinite(click?.local) || !pointFinite(click?.screen) || !pointFinite(click?.root)) return ['nonfinite-coordinate']
  if (!matrixFinite(measurement.nodeMatrix) || !matrixFinite(measurement.canvasMatrix)) return ['invalid-screen-matrix']
  if (!samePoint(click.screen, transform(measurement.nodeMatrix, click.local))) reasons.push('mismatched-node-projection')
  if (!samePoint(click.root, inverseTransform(measurement.canvasMatrix, click.screen))) reasons.push('mismatched-canvas-projection')
  const box = measurement.viewBox
  if (!viewBoxFinite(box) || !inBounds(click.root, { minX: box.x, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height })) reasons.push('outside-svg-viewbox')
  if (!inRect(click.screen, measurement.canvasClient)) reasons.push('outside-canvas-client-bounds')
  const viewport = measurement.viewport
  if (!viewportFinite(viewport) || click.screen.x < 0 || click.screen.y < 0 || click.screen.x >= viewport.width || click.screen.y >= viewport.height) reasons.push('outside-visible-viewport')
  if (viewport?.visual) {
    const visual = viewport.visual
    if (!['offsetLeft', 'offsetTop', 'width', 'height', 'scale'].every((key) => Number.isFinite(visual[key])) || visual.width <= 0 || visual.height <= 0 || visual.scale <= 0
      || click.screen.x < visual.offsetLeft || click.screen.y < visual.offsetTop || click.screen.x >= visual.offsetLeft + visual.width || click.screen.y >= visual.offsetTop + visual.height) reasons.push('outside-visual-viewport')
  }
  if (!Array.isArray(measurement.clipAncestors) || measurement.clipAncestors.length > 16) reasons.push('missing-clip-observations')
  else for (const ancestor of measurement.clipAncestors) {
    if (!rectFinite(ancestor.bounds) || !Number.isFinite(ancestor.scrollLeft) || !Number.isFinite(ancestor.scrollTop)
      || typeof ancestor.overflowX !== 'string' || typeof ancestor.overflowY !== 'string') { reasons.push('invalid-clip-observation'); continue }
    const clippedX = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestor.overflowX)
    const clippedY = ['hidden', 'clip', 'auto', 'scroll'].includes(ancestor.overflowY)
    if ((clippedX && (click.screen.x < ancestor.bounds.left || click.screen.x >= ancestor.bounds.right))
      || (clippedY && (click.screen.y < ancestor.bounds.top || click.screen.y >= ancestor.bounds.bottom))) reasons.push('outside-scroll-clip')
  }
  return [...new Set(reasons)]
}
function exactCanvas(target, identity) {
  return target?.connected === true && typeof target.tag === 'string' && typeof target.id === 'string'
    && ['canvasRoot', 'canvas', 'background', 'body', 'warning', 'ring', 'handle', 'overlay'].every((key) => typeof target[key] === 'boolean')
    && target.canvas === true && target.canvasToken === identity?.canvasToken && !target.overlay && !target.handle
}
function backgroundTarget(target, identity) {
  return exactCanvas(target, identity) && ((target.canvasRoot === true && target.tag === 'svg') || (target.background === true && target.tag === 'rect'))
    && target.pointId === null && target.ownerToken === null && !target.body && !target.bodyTarget && !target.warning && !target.ring
}
function hitReasons(measurement, hit, background = false) {
  const reasons = []
  if (!hit?.target) return ['missing-native-target']
  if (!exactCanvas(hit.target, measurement.identity)) reasons.push('unrelated-or-obstructed-native-target')
  if (background && !backgroundTarget(hit.target, measurement.identity)) reasons.push('not-owned-canvas-background')
  if (!Array.isArray(hit.stack) || hit.stack.length === 0 || hit.stack.length > 16) reasons.push('missing-native-hit-stack')
  else {
    try { assert.deepEqual(hit.stack[0], hit.target) } catch { reasons.push('mismatched-native-hit-stack') }
    if (!hit.stack.some((target) => exactCanvas(target, measurement.identity))) reasons.push('missing-canvas-hit-route')
  }
  return reasons
}

export function resolveDiagnosticCandidates(measurement) {
  const expected = boundsFinite(measurement?.bodyBounds) && boundsFinite(measurement?.warningBounds)
    ? fixedDiagnosticCandidates(measurement.bodyBounds, measurement.warningBounds) : []
  const candidates = (Array.isArray(measurement?.candidates) ? measurement.candidates : []).slice(0, 4).map((candidate, index) => {
    const reasons = visibleProjectionReasons(measurement, candidate)
    if (candidate.name !== expected[index]?.name || !samePoint(candidate.local, expected[index]?.local)) reasons.push('not-declared-candidate')
    if (!inBounds(candidate.local, measurement.shapeBounds)) reasons.push('outside-requested-shape-bounds')
    for (const name of ['body', 'warning']) {
      const bounds = measurement[`${name}Bounds`]
      if (!boundsFinite(bounds) || !pointFinite(candidate.local) || distanceToBounds(candidate.local, bounds) <= 6) reasons.push(`inside-visible-${name}-clearance`)
    }
    if (measurement.ring !== null && measurement.ring !== undefined) {
      const ring = measurement.ring
      if (![ring.cx, ring.cy, ring.radius].every(Number.isFinite) || ring.radius <= 0 || !pointFinite(candidate.local)
        || Math.hypot(candidate.local.x - ring.cx, candidate.local.y - ring.cy) <= ring.radius + 6) reasons.push('inside-visible-selection-ring')
    }
    reasons.push(...hitReasons(measurement, candidate.hit, true))
    return { ...candidate, eligible: reasons.length === 0, reasons: [...new Set(reasons)] }
  })
  const first = candidates.find(({ eligible }) => eligible)
  return { candidates, adopted: first?.name ?? null,
    farClick: first ? { local: first.local, screen: first.screen, root: first.root, hit: first.hit } : null,
    nativeCanvasAtFarClick: !!first }
}

const stateFields = ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings']
function assertState(state, message) {
  assert.ok(state && stateFields.every((field) => Object.hasOwn(state, field)) && Object.hasOwn(state, 'selection'), `${message}: authoritative state exists`)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'uiSettings']) assert.equal(typeof state[field], 'string', `${message}: raw ${field}`)
  assert.ok(Number.isInteger(state.labelDocumentRevision) && state.labelDocumentRevision >= 0, `${message}: current document epoch`)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'uiSettings']) assert.doesNotThrow(() => JSON.parse(state[field]), `${message}: valid ${field}`)
}
function assertUnchanged(before, after, message, selection = false) {
  assertState(before, `${message} before`); assertState(after, `${message} after`)
  for (const field of [...stateFields, ...(selection ? ['selection'] : []), ...(Object.hasOwn(before, 'requests') ? ['requests'] : [])]) {
    assert.deepEqual(after[field], before[field], `${message}: ${field}`)
  }
}
function assertRing(measurement, ring) {
  assert.ok(ring && [ring.cx, ring.cy, ring.radius].every(Number.isFinite), 'Visible diagnostic selection ring is measured')
  const visibleRadius = Math.max(...[measurement.bodyBounds, measurement.warningBounds].flatMap((bounds) => [
    [bounds.minX, bounds.minY], [bounds.maxX, bounds.minY], [bounds.minX, bounds.maxY], [bounds.maxX, bounds.maxY],
  ]).map(([x, y]) => Math.hypot(x - ring.cx, y - ring.cy)))
  assert.ok(ring.radius >= visibleRadius && ring.radius <= visibleRadius + 20, 'Diagnostic ring follows visible body/warning, not hidden minima')
}
function assertCurrentPointTarget(target, identity) {
  assert.ok(exactCanvas(target, identity), 'Point target belongs to the exact connected canvas')
  assert.equal(target.pointId, identity.id); assert.equal(target.ownerToken, identity.ownerToken)
  assert.equal(target.pointRequest, identity.pointRequest); assert.equal(target.bodyRequest, identity.bodyRequest)
  assert.equal(target.source, identity.source); assert.equal(target.labelOwner, identity.ownerToken)
  for (const field of ['elementToken', 'pointNodeToken', 'pointGroupToken']) assert.ok(typeof target[field] === 'string' && target[field].length > 0, `Actual DOM ${field} retained`)
  assert.equal(target.background, false); assert.equal(target.canvasRoot, false)
  assert.equal(target.ring, false); assert.equal(target.handle, false)
}
function assertBodyTarget(measurement) {
  const raw = measurement.bodyTarget, identity = measurement.identity
  assert.ok(raw, 'Current visible body has a production-owned hit target')
  const target = raw.descriptor
  assertCurrentPointTarget(target, identity)
  assert.equal(target.tag, 'rect'); assert.equal(target.bodyTarget, true); assert.equal(target.exportExcluded, true)
  assert.notEqual(target.pointerEvents, 'none', 'Point body target accepts ordinary native input')
  assert.equal(raw.parentIsPointNode, true, 'Body target is a direct child of its current point node')
  assertCurrentPointTarget(raw.ownerNode, identity); assert.equal(raw.ownerNode.pointNode, true)
  assertCurrentPointTarget(raw.ownerGroup, identity); assert.equal(raw.ownerGroup.pointGroup, true)
  assertCurrentPointTarget(raw.label, identity); assert.equal(raw.label.body, true)
  assert.equal(target.pointNodeToken, raw.ownerNode.elementToken)
  assert.equal(target.pointGroupToken, raw.ownerGroup.elementToken)
  assert.equal(raw.label.pointNodeToken, target.pointNodeToken)
  assert.equal(raw.label.pointGroupToken, target.pointGroupToken)
  const attributes = raw.attributes, bounds = measurement.modelBodyBounds
  assert.ok(attributes && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(attributes[key]))
    && attributes.width > 0 && attributes.height > 0, 'Visible body target has finite positive geometry')
  assert.equal(attributes.fill, 'transparent'); assert.equal(attributes.transform, null, 'Body target uses the current point-node placement frame')
  for (const [key, value] of Object.entries({ x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY })) {
    assert.ok(close(attributes[key], value), `Body target ${key} follows only current resolved visible body bounds`)
    // SVGRect getBBox exposes native binary32 values; model/PGF tolerances are unchanged.
    assert.equal(raw.nativeBounds?.[key], Math.fround(attributes[key]), `Actual body target ${key} matches native SVG rectangle precision`)
  }
  assert.ok(boundsFinite(raw.bounds) && matrixFinite(raw.screenMatrix), 'Actual body target bounds and screen CTM retained')
  assert.deepEqual(raw.screenMatrix, measurement.nodeMatrix, 'Direct body target shares its current point-node screen CTM')
  const box = raw.nativeBounds
  for (const [key, value] of Object.entries({ minX: box.x, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height })) {
    assert.ok(close(raw.bounds[key], value), `Actual target ${key} agrees with native bbox and current placement`)
  }
}
function assertOwnedClick(measurement, click, kind) {
  assert.deepEqual(visibleProjectionReasons(measurement, click), [], `${kind}: current local/root/client projection lies in visible canvas`)
  assert.deepEqual(hitReasons(measurement, click?.hit, kind === 'far'), [], `${kind}: actual native target belongs to the canvas`)
  if (kind !== 'far') {
    assert.ok(inBounds(click.local, measurement[`${kind}Bounds`]), `${kind}: input lies inside the measured visible region`)
    const target = click.hit.target
    assertCurrentPointTarget(target, measurement.identity)
    if (kind === 'body') {
      assert.deepEqual(target, measurement.bodyTarget.descriptor, 'Body native hit is the actual current owned visible-body target')
      assert.ok(inBounds(click.local, measurement.bodyTarget.bounds), 'Measured literal-body input lies inside actual visible-body target bounds')
    } else assert.equal(target.warning, true, 'Warning native hit reaches the actual owned warning')
  }
}

export function assertDiagnosticMeasurement(measurement, { requireCandidate = false, allowObstructedClicks = false, expected } = {}) {
  assert.ok(measurement, 'Raw unsupported diagnostic measurement retained')
  assert.deepEqual(measurement.errors, [], 'Diagnostic measurement completed without hidden errors')
  const identity = measurement.identity, state = measurement.stateSnapshot
  assertState(state, 'Diagnostic measurement')
  assert.ok(identity && ['id', 'shape', 'pointRequest', 'bodyRequest', 'source', 'anchor', 'canvasToken', 'ownerToken'].every((key) => typeof identity[key] === 'string' && identity[key].length > 0), 'Diagnostic owner/request/canvas identities retained')
  assert.ok([2, 3].includes(identity.ambientDimension)); assert.ok(['ellipse', 'circle', 'cylinder'].includes(identity.shape))
  assert.equal(identity.id, 'app-point'); assert.equal(identity.epoch, state.labelDocumentRevision)
  if (expected) for (const key of ['id', 'ambientDimension', 'shape']) {
    assert.equal(identity[key], expected[key], `Fresh diagnostic belongs to expected ${key}`)
  }
  assert.deepEqual(JSON.parse(identity.ownerToken), ['point-node', identity.epoch, identity.id], 'Diagnostic owner belongs to current document')
  assert.equal(identity.pointRequest, identity.bodyRequest, 'Diagnostic body and requested shape share a current request')
  const runtime = JSON.parse(state.runtimeDiagramJson), saved = JSON.parse(state.json)
  assert.equal(saved.version, 2, 'Diagnostic saved envelope remains version 2')
  assert.equal(runtime.ambientDimension, identity.ambientDimension)
  const point = runtime.strata?.find(({ id }) => id === identity.id)
  assert.ok(point && point.geometricKind === 'point' && point.codim === identity.ambientDimension, 'Diagnostic model owns the expected codimension point')
  assert.deepEqual(saved.diagram.strata.find(({ id }) => id === identity.id), point, 'Saved and runtime diagnostic point agree')
  const history = JSON.parse(state.history)
  assert.ok(Array.isArray(history.past) && Array.isArray(history.future), 'Raw bounded history has past and future arrays')
  assert.deepEqual(history.present?.strata?.find(({ id }) => id === identity.id), point, 'Current history retains the exact owned point')
  assert.equal(point.text, 'WWWW diagnostic'); assert.equal(identity.source, point.text); assert.equal(measurement.source, point.text)
  assert.equal(point.style.shape, identity.shape)
  assert.equal(identity.anchor, 'not a PGF anchor'); assert.equal(measurement.anchor, identity.anchor)
  assert.equal(point.style.layout.anchor, identity.anchor)
  assert.equal(point.style.layout.minimumWidth, 1000); assert.equal(point.style.layout.minimumHeight, 1000)
  assert.equal(measurement.layout.minimumWidth, 1000); assert.equal(measurement.layout.minimumHeight, 1000)
  assert.equal(measurement.layout.anchor, identity.anchor)
  if (identity.ambientDimension === 2) assert.equal(point.position.z, 0, '2D model coordinates remain z=0')
  for (const name of ['canvas', 'node', 'body', 'warning', 'bodyTarget']) {
    assert.equal(measurement.connected?.[`${name}Count`], 1, `One connected diagnostic ${name}`)
    assert.equal(measurement.connected?.[name], true, `Expected diagnostic ${name} is connected`)
  }
  assert.equal(measurement.state, 'ready'); assert.ok(typeof measurement.diagnostic === 'string' && measurement.diagnostic.length > 0)
  assert.equal(measurement.contourCount, 0, 'Unsupported requested contour is intentionally absent')
  for (const name of ['body', 'warning', 'shape', 'painted', 'anchor']) assert.ok(boundsFinite(measurement[`${name}Bounds`]), `Valid native ${name} bounds`)
  assert.ok(boundsFinite(measurement.modelBodyBounds), 'Resolved native model body bounds are finite and ordered')
  assertBodyTarget(measurement)
  for (const name of ['body', 'warning']) {
    const bounds = measurement[`${name}Bounds`]; assert.ok(bounds.maxX > bounds.minX && bounds.maxY > bounds.minY, `Visible ${name} has actual extent`)
  }
  for (const name of ['shape', 'anchor']) {
    const bounds = measurement[`${name}Bounds`]
    assert.ok(bounds.maxX - bounds.minX >= 1000 && bounds.maxY - bounds.minY >= 1000, `Requested ${name} retains huge minimum dimensions`)
  }
  assert.deepEqual(measurement.paintedBounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 }, 'Suppressed contour has zero painted bounds')
  assert.ok(matrixFinite(measurement.nodeMatrix) && matrixFinite(measurement.canvasMatrix), 'Current point/root screen matrices are finite and invertible')
  for (const name of ['node', 'canvas', 'bodyScreen', 'warningScreen']) assert.ok(matrixFinite(measurement.matrices?.[name]), `Native ${name} matrix is finite and invertible`)
  for (const name of ['body', 'warning']) {
    const bounds = measurement.nativeBounds?.[name]
    assert.ok(bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) && bounds.width > 0 && bounds.height > 0, `Actual native ${name} getBBox retained`)
    const corners = [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y], [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]]
      .map(([x, y]) => inverseTransform(measurement.nodeMatrix, transform(measurement.matrices[`${name}Screen`], { x, y })))
    const observed = measurement[`${name}Bounds`], derived = { minX: Math.min(...corners.map(({ x }) => x)), maxX: Math.max(...corners.map(({ x }) => x)),
      minY: Math.min(...corners.map(({ y }) => y)), maxY: Math.max(...corners.map(({ y }) => y)) }
    for (const key of ['minX', 'minY', 'maxX', 'maxY']) assert.ok(close(observed[key], derived[key]), `Native ${name} bounds match actual node/body screen frames`)
  }
  assert.ok(viewBoxFinite(measurement.viewBox) && rectFinite(measurement.canvasClient) && viewportFinite(measurement.viewport), 'Native viewBox/client/viewport frames retained')
  assert.ok(measurement.preserveAspectRatio && Number.isInteger(measurement.preserveAspectRatio.align) && measurement.preserveAspectRatio.align >= 1 && measurement.preserveAspectRatio.align <= 10
    && [1, 2].includes(measurement.preserveAspectRatio.meetOrSlice), 'Actual SVG preserveAspectRatio retained')
  assert.ok(Array.isArray(measurement.ui?.workPlaneControls) && Array.isArray(measurement.ui?.workPlaneStatus), 'Actual work plane observations retained')
  assert.ok(typeof measurement.ui?.inspector?.open === 'boolean' && typeof measurement.ui?.toolbar?.collapsed === 'boolean', 'Actual scoped Inspector and toolbar states retained')
  assert.ok(measurement.ring === null || measurement.ring, 'Selection ring observation is explicit')
  if (measurement.ring) assertRing(measurement, measurement.ring)
  if (!allowObstructedClicks) {
    assert.equal(measurement.ui.selectPressed, 'true', 'Ordinary diagnostic input uses the actual Select tool')
    assertOwnedClick(measurement, measurement.bodyClick, 'body'); assertOwnedClick(measurement, measurement.warningClick, 'warning')
  }
  assert.equal(measurement.candidates.length, 4, 'All four declared candidates retained')
  const declared = fixedDiagnosticCandidates(measurement.bodyBounds, measurement.warningBounds)
  for (const [index, candidate] of measurement.candidates.entries()) {
    assert.equal(candidate.name, declared[index].name, 'Candidate order is fixed before input')
    assert.ok(samePoint(candidate.local, declared[index].local), 'Candidate uses declared measured clearance')
    assert.ok(samePoint(candidate.screen, transform(measurement.nodeMatrix, candidate.local)), 'Every observed candidate retains its actual node projection')
    assert.ok(samePoint(candidate.root, inverseTransform(measurement.canvasMatrix, candidate.screen)), 'Every observed candidate retains its actual canvas projection')
  }
  const resolved = resolveDiagnosticCandidates(measurement)
  assert.deepEqual(measurement.candidates, resolved.candidates, 'Candidate eligibility and rejection reasons recomputed from raw frames/targets')
  assert.equal(measurement.adopted, resolved.adopted, 'First measured eligible declared candidate adopted')
  assert.deepEqual(measurement.farClick, resolved.farClick, 'Adopted candidate binds exact local/root/client/hit observations')
  assert.equal(measurement.nativeCanvasAtFarClick, resolved.nativeCanvasAtFarClick, 'Canvas result follows actual measured route')
  if (requireCandidate) assert.ok(resolved.adopted, 'A measured eligible negative candidate must reach the actual canvas')
  return resolved
}

export function assertDiagnosticAction(action, expected = action?.measurement?.identity) {
  assert.ok(['body', 'far', 'warning'].includes(action?.kind), 'Expected diagnostic native action kind')
  assertDiagnosticMeasurement(action.measurement, { requireCandidate: true, expected })
  assert.deepEqual(action.measurement.stateSnapshot, action.before, 'Each action is bound to its fresh measurement state')
  assert.deepEqual(action.click, action.measurement[`${action.kind}Click`], 'Actual input uses fresh measured coordinates and native hit')
  assert.ok(action.inputMeasurement, 'Immediate native input measurement is retained')
  const input = { ...action.inputMeasurement, ...resolveDiagnosticCandidates(action.inputMeasurement) }
  assertDiagnosticMeasurement(input, { requireCandidate: true, expected })
  assert.deepEqual(input.stateSnapshot, action.before, 'Immediate input state agrees with authoritative bound state')
  assert.deepEqual(input.identity, action.measurement.identity, 'Immediate input retains source/request/epoch/canvas owner')
  for (const field of ['nodeMatrix', 'canvasMatrix', 'bodyBounds', 'warningBounds', 'shapeBounds', 'paintedBounds', 'anchorBounds', 'modelBodyBounds', 'nativeBounds', 'bodyTarget', 'matrices', 'ring', 'viewBox', 'canvasClient', 'viewport', 'clipAncestors', 'preserveAspectRatio']) {
    assert.deepEqual(input[field], action.measurement[field], `Immediate native input retains current ${field}`)
  }
  assert.deepEqual(input[`${action.kind}Click`], action.click, 'Immediate native hit and projection bind the requested input')
  assertOwnedClick(action.measurement, action.click, action.kind)
  assertUnchanged(action.before, action.after, `${action.kind} click`)
  const identity = action.measurement.identity
  const selection = action.kind === 'far' ? null : { kind: 'stratum', id: identity.id }
  assert.deepEqual(action.after.selection, selection, `${action.kind}: production picking returns expected actual selection`)
  assert.equal(action.selectedId, selection?.id ?? null)
  assert.equal(action.droppedEvents, 0); assert.equal(action.events.length, 3, 'Exactly one owned native pointer gesture')
  assert.deepEqual(action.errors ?? [], [], 'Native diagnostic listener has no observation failures')
  assert.equal(action.canvasCaptureAfterInput, false, 'Diagnostic input leaves no captured pointer')
  let previousOrder = -1, pointerId, capturedUp = false
  for (const [index, type] of ['pointerdown', 'pointerup', 'click'].entries()) {
    const event = action.events[index]
    assert.equal(event.type, type); assert.equal(event.trusted, true)
    assert.ok(Number.isInteger(event.order) && event.order > previousOrder, 'Native event order retained')
    previousOrder = event.order
    assert.ok(Number.isFinite(event.x) && Number.isFinite(event.y) && Math.abs(event.x - action.click.screen.x) < 1 && Math.abs(event.y - action.click.screen.y) < 1, 'Trusted native input reaches adopted projected point')
    assert.equal(event.button, 0); assert.equal(event.buttons, type === 'pointerdown' ? 1 : 0)
    for (const key of ['altKey', 'shiftKey', 'ctrlKey', 'metaKey']) assert.equal(event[key], false, 'Diagnostic input has no modifiers')
    assert.equal(typeof event.canvasHasPointerCapture, 'boolean', 'Actual native canvas pointer capture is observed')
    if (index === 0) { pointerId = event.pointerId; assert.ok(Number.isInteger(pointerId) && pointerId > 0) }
    else assert.ok(event.pointerId === pointerId || (type === 'click' && event.pointerId === null), 'One native pointer owns the gesture')
    assert.equal(event.epoch, identity.epoch); assert.deepEqual(event.identity, identity, 'Native event retains actual owner/source/request epoch')
    assert.ok(exactCanvas(event.target, identity), 'Native event target belongs to exact production canvas')
    let measuredTarget = false
    try { assert.deepEqual(event.target, action.click.hit.target); measuredTarget = true } catch { /* Only the measured capture continuation below may substitute. */ }
    const capturedRoot = action.kind === 'far' && backgroundTarget(action.events[0].target, identity) && event.target.canvasRoot === true && event.target.tag === 'svg'
      && (type === 'pointerup' ? event.canvasHasPointerCapture === true : type === 'click' && capturedUp && event.canvasHasPointerCapture === false)
    assert.ok(measuredTarget || capturedRoot, 'Native gesture reaches the measured target or its observed owned root capture continuation')
    if (type === 'pointerdown') assert.equal(event.canvasHasPointerCapture, false, 'Diagnostic gesture starts without stale pointer capture')
    if (type === 'pointerup') capturedUp = event.canvasHasPointerCapture
    if (type === 'click') assert.equal(event.canvasHasPointerCapture, false, 'Native click follows pointer release')
    if (action.kind === 'far') assert.ok(backgroundTarget(event.target, identity), 'Negative input is actual background delivery')
    assert.ok(Array.isArray(event.path) && event.path.length > 0 && event.path.length <= 16, 'Owned bounded native composed path retained')
    assert.deepEqual(event.path[0], event.target, 'Native composed path begins at actual target')
    assert.ok(event.path.some((target) => exactCanvas(target, identity) && target.canvasRoot === true && target.tag === 'svg'), 'Native event traverses exact root canvas')
    if (action.kind !== 'far') {
      assertCurrentPointTarget(event.target, identity)
      for (const [name, flag] of [['ownerNode', 'pointNode'], ['ownerGroup', 'pointGroup']]) {
        const owner = action.measurement.bodyTarget[name]
        assert.ok(event.path.some((target) => exactCanvas(target, identity) && target[flag] === true
          && target.elementToken === owner.elementToken && target.pointId === identity.id && target.ownerToken === identity.ownerToken),
        `Ordinary ${action.kind} input traverses its actual current ${name}`)
      }
    }
  }
  if (action.kind === 'far') assertRing(action.measurement, action.measurement.ring)
  const afterMeasurement = action.afterMeasurement
  assert.ok(afterMeasurement, 'Actual after-input native geometry and state retained')
  const resolvedAfter = { ...afterMeasurement, ...resolveDiagnosticCandidates(afterMeasurement) }
  assertDiagnosticMeasurement(resolvedAfter, { expected })
  assert.deepEqual(afterMeasurement.stateSnapshot, action.after, 'Native after-input observation agrees with authoritative state')
  assert.deepEqual(afterMeasurement.identity, identity, 'Native after-input geometry keeps same request/document/canvas owner')
  for (const field of ['nodeMatrix', 'canvasMatrix', 'bodyBounds', 'warningBounds', 'shapeBounds', 'paintedBounds', 'anchorBounds', 'modelBodyBounds', 'nativeBounds', 'bodyTarget', 'matrices', 'viewBox', 'canvasClient', 'preserveAspectRatio']) {
    assert.deepEqual(afterMeasurement[field], action.measurement[field], `Click selection preserves measured ${field}`)
  }
  for (const field of ['workPlaneControls', 'workPlaneStatus']) assert.deepEqual(afterMeasurement.ui[field], action.measurement.ui[field], `Click selection preserves actual ${field}`)
  if (selection) assertRing(afterMeasurement, afterMeasurement.ring)
  else assert.equal(afterMeasurement.ring, null, 'Cleared far selection removes visible ring')
}

export function assertUnsupportedDiagnosticEvidence(entry) {
  assert.equal(entry?.result, 'passed'); assert.equal(entry.diagramUnchanged, true)
  assert.deepEqual(entry.secondaryErrors, [], 'Diagnostic secondary failures prevent terminal acceptance')
  const initial = entry.rendered
  assertDiagnosticMeasurement(initial, { requireCandidate: true })
  assert.equal(initial.stateSnapshot.selection, null, 'Fresh diagnostic document begins unselected')
  assert.equal(initial.ring, null, 'Fresh diagnostic document has no selection ring')
  assert.equal(entry.ambientDimension, initial.identity.ambientDimension); assert.equal(entry.shape, initial.identity.shape)
  for (const phase of ['preparation', 'restoration']) {
    const raw = entry[phase]
    assert.ok(raw && Array.isArray(raw.actions) && raw.actions.length <= 8, `Bounded owned ${phase} retained`)
    assertUnchanged(raw.before, raw.after, `${phase}`, true)
    assert.ok(raw.uiBefore && raw.uiAfter, `${phase}: actual UI state retained`)
    for (const action of raw.actions) {
      assert.equal(action.controlCount, 1, `${phase}: one real owned native UI control`)
      if (/preview toolbar/.test(action.name)) assert.equal(action.oppositeCount, 1, `${phase}: one real opposite toolbar control`)
      assertUnchanged(action.stateBefore, action.stateAfter, `${phase} action`, true)
    }
  }
  assert.deepEqual(initial.stateSnapshot, entry.preparation.after, 'Fresh diagnostic measurement follows owned preparation')
  assert.deepEqual(entry.clicks.map(({ kind }) => kind), ['body', 'far', 'warning'], 'Exact native diagnostic click sequence')
  let previous = entry.preparation.after
  for (const action of entry.clicks) {
    assertDiagnosticAction(action, initial.identity)
    assert.deepEqual(action.measurement.identity, initial.identity, 'Each click retains current source/request/document/canvas owner')
    for (const field of ['nodeMatrix', 'canvasMatrix', 'bodyBounds', 'warningBounds', 'shapeBounds', 'paintedBounds', 'anchorBounds', 'modelBodyBounds', 'nativeBounds', 'bodyTarget', 'matrices', 'viewBox', 'canvasClient', 'preserveAspectRatio']) {
      assert.deepEqual(action.measurement[field], initial[field], `Fresh click retains unchanged prepared ${field}`)
    }
    assert.deepEqual(action.before, previous, 'Fresh input starts from the preceding authoritative state')
    assertUnchanged(entry.preparation.before, action.before, `${action.kind} entire diagnostic state`)
    for (const name of ['workPlaneControls', 'workPlaneStatus']) assert.deepEqual(action.measurement.ui[name], initial.ui[name], `Clicks preserve active ${name}`)
    if (action.kind === 'far') {
      assert.deepEqual(entry.ring, action.measurement.ring)
      assert.equal(action.measurement.adopted, initial.adopted, 'Negative candidate identity is preserved after visible selection changes')
      assert.deepEqual(action.click.local, initial.farClick.local, 'Negative candidate local point is fixed before selection outcome')
    }
    previous = action.after
  }
  assert.deepEqual(entry.restoration.before, previous, 'UI restoration begins after final warning selection')
  assert.deepEqual(entry.restoration.after.selection, { kind: 'stratum', id: initial.identity.id }, 'Owned restoration preserves terminal selection')
  assert.equal(entry.restoration.uiAfter.inspector.open, entry.preparation.uiBefore.inspector.open, 'Owned preparation restores inherited Inspector state')
  assert.equal(entry.restoration.uiAfter.toolbar.collapsed, entry.preparation.uiBefore.toolbar.collapsed, 'Owned preparation restores inherited toolbar state')
}
