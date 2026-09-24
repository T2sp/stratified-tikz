import assert from 'node:assert/strict'

const epsilon = 1e-6
const fail = (condition, message) => assert.ok(condition, `Responsive framing setup: ${message}`)
const finite = (values, name) => fail(values.every(Number.isFinite), `${name} must be finite`)
const near = (a, b, name, tolerance = epsilon) => fail(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${name}: ${a} != ${b}`)
const edges = ({ x, y, width, height }) => ({ minX: x, minY: y, maxX: x + width, maxY: y + height })
const transform = (m, { x, y }) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f })
const inverse = (m) => ({ a: 1 / m.a, b: 0, c: 0, d: 1 / m.d, e: -m.e / m.a, f: -m.f / m.d })
const union = (boxes) => ({ minX: Math.min(...boxes.map((b) => b.minX)), minY: Math.min(...boxes.map((b) => b.minY)),
  maxX: Math.max(...boxes.map((b) => b.maxX)), maxY: Math.max(...boxes.map((b) => b.maxY)) })
const transformed = (m, box) => {
  const points = [[box.minX, box.minY], [box.maxX, box.minY], [box.minX, box.maxY], [box.maxX, box.maxY]]
    .map(([x, y]) => transform(m, { x, y }))
  return { minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) }
}
function rect(value, name) {
  fail(value && typeof value === 'object', `${name} is required`)
  finite([value.x, value.y, value.width, value.height], name)
  fail(value.width > 0 && value.height > 0, `${name} must have positive size`)
}
function matrix(value, name) {
  fail(value && typeof value === 'object', `${name} CTM is required`)
  finite(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => value[key]), `${name} CTM`)
  fail(value.a > 0 && value.d > 0, `${name} CTM must be invertible and positive`)
  near(value.b, 0, `${name} CTM shear`); near(value.c, 0, `${name} CTM shear`)
  near(value.a, value.d, `${name} CTM uniform scale`)
}

/** Shared intended native pointer positions, derived only from measured paths
 * and the independent 20pt declaration (24 local units), never painted bounds. */
export function responsivePointProbes(actual, variant = 'solid') {
  const circle = actual.contour.kind === 'circle', m = actual.contour.ctm
  const radius = circle ? actual.contour.radius : -Math.min(...actual.contour.vertices.map(({ y }) => y))
  const extension = variant === 'disabled' ? 0 : circle ? 12 : 24
  const inside = circle ? { x: radius + (extension ? extension - 3 : -3), y: 0 }
    : { x: 0, y: -radius - (extension ? extension - 4 : -3) }
  const outside = circle ? { x: radius + extension + 9, y: 0 } : { x: 0, y: -radius - extension - 9 }
  const viewBox = actual.root.viewBox.trim().split(/[ ,]+/).map(Number)
  return { inside: { local: inside, screen: transform(m, inside) }, outside: { local: outside, screen: transform(m, outside) },
    clear: { screen: transform(actual.root.ctm, { x: viewBox[0] + 8, y: viewBox[1] + 8 }) } }
}

/** Independently reserve the entire node, both stroke models, selection and
 * native click sites even for zero-alpha/disabled cases. This is setup coverage,
 * not the paint oracle: observed production painted bounds never enter it. */
export function responsivePointFraming(actual, { scale = actual.root?.ctm?.a, variant = 'solid' } = {}) {
  const { root, contour, body, viewport, scroll } = actual
  fail(Number.isFinite(scale) && scale > 0, 'expected CSS display scale must be finite and positive')
  rect(root?.rect, 'root/capture rectangle')
  matrix(root.ctm, 'root'); matrix(contour?.ctm, 'contour'); matrix(body?.ctm, 'body')
  for (const [name, m] of [['root', root.ctm], ['contour', contour.ctm]]) near(m.a, scale, `${name} CSS scale`)
  rect(contour.shapeBounds, 'path bounds'); rect(body.bounds, 'body bounds')
  finite([viewport?.width, viewport?.height, actual.devicePixelRatio, scroll?.x, scroll?.y], 'viewport/scroll')
  fail(viewport.width > 0 && viewport.height > 0 && viewport.width <= 4096 && viewport.height <= 4096
    && actual.devicePixelRatio > 0, 'viewport must fit the bounded capture budget')
  const values = typeof root.viewBox === 'string' ? root.viewBox.trim().split(/[ ,]+/).map(Number) : []
  fail(values.length === 4, 'viewBox must contain four numbers'); finite(values, 'viewBox')
  const view = { x: values[0], y: values[1], width: values[2], height: values[3] }
  rect(view, 'viewBox')
  const rootScreen = transformed(root.ctm, edges(view))
  const crop = edges(root.rect)
  for (const key of Object.keys(crop)) near(rootScreen[key], crop[key], `root CTM/capture ${key}`)
  near(parseFloat(root.cssWidth), root.rect.width, 'CSS/capture width')
  near(parseFloat(root.cssHeight), root.rect.height, 'CSS/capture height')
  // These controlled CSS fixtures deliberately use integral pixel crops, so no
  // implicit locator rounding can silently change the retained pixel origin.
  for (const [key, value] of Object.entries(root.rect)) near(value, Math.round(value), `integral capture ${key}`)
  fail(crop.minX >= 0 && crop.minY >= 0 && crop.maxX <= viewport.width && crop.maxY <= viewport.height,
    'complete root/capture must fit the browser viewport')
  const circle = contour.kind === 'circle', path = edges(contour.shapeBounds)
  fail(circle || contour.kind === 'polygon', 'supported circle or triangle path is required')
  let radius
  if (circle) {
    radius = contour.radius
    finite([radius], 'circle radius'); fail(radius > 0, 'circle radius must be positive')
    for (const [key, value] of Object.entries({ minX: -radius, minY: -radius, maxX: radius, maxY: radius })) near(path[key], value, `circle path ${key}`, 1e-4)
  } else {
    fail(contour.vertices?.length === 3, 'triangle must have three vertices')
    finite(contour.vertices.flatMap(({ x, y }) => [x, y]), 'triangle vertices')
    const [top, left, right] = [...contour.vertices].sort((a, b) => a.y - b.y || a.x - b.x)
    radius = -top.y
    fail(radius > 0, 'triangle radius must be positive')
    // Verify the upright regular triangle before using its known 60° miters.
    near(top.x, 0, 'triangle top', 1e-4); near(left.y, radius / 2, 'triangle base', 1e-4); near(right.y, radius / 2, 'triangle base', 1e-4)
    near(left.x, -Math.sqrt(3) * radius / 2, 'triangle left', 1e-4); near(right.x, Math.sqrt(3) * radius / 2, 'triangle right', 1e-4)
    for (const [key, value] of Object.entries({ minX: left.x, minY: top.y, maxX: right.x, maxY: left.y })) near(path[key], value, `triangle path ${key}`, 1e-4)
  }
  const expandPaint = (half) => ({ minX: path.minX - (circle ? half : Math.sqrt(3) * half),
    minY: path.minY - (circle ? half : 2 * half), maxX: path.maxX + (circle ? half : Math.sqrt(3) * half), maxY: path.maxY + half })
  const geometric = expandPaint(12), nonScaling = expandPaint(12 / scale)
  // Selection is a circular overlay with six local units of padding and its
  // own non-scaling 3px stroke. Reserve it before selection exists as well.
  const selectionRadius = radius + (circle ? 12 : 24) + 6 + 1.5 / scale
  const selection = { minX: -selectionRadius, minY: -selectionRadius, maxX: selectionRadius, maxY: selectionRadius }
  const local = union([geometric, nonScaling, selection])
  const screen = union([transformed(contour.ctm, local), transformed(body.ctm, edges(body.bounds))])
  const probes = responsivePointProbes(actual, variant)
  const containers = { root: crop, capture: crop, viewport: { minX: 0, minY: 0, maxX: viewport.width, maxY: viewport.height } }
  const margins = {}, probeMargins = {}
  const margin = (box, container) => ({ left: box.minX - container.minX, top: box.minY - container.minY,
    right: container.maxX - box.maxX, bottom: container.maxY - box.maxY })
  for (const [name, container] of Object.entries(containers)) {
    margins[name] = margin(screen, container)
    probeMargins[name] = {}
    for (const [key, { screen: p }] of Object.entries(probes)) {
      finite([p.x, p.y], `${key} probe`)
      probeMargins[name][key] = margin({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y }, container)
    }
  }
  const report = { status: 'pending', scale, variant, declaredWidthPt: 20, halfWidth: 12, triangleMiterExtension: 24,
    selectionStrokePx: 3, requiredMarginPx: 2, local: { geometric, nonScaling, selection, envelope: local },
    expected: { screen, root: transformed(inverse(root.ctm), screen),
      capture: transformed({ a: 1, b: 0, c: 0, d: 1, e: -root.rect.x, f: -root.rect.y }, screen) },
    margins, probes, probeMargins, capture: { ...root.rect }, viewBox: view }
  try {
    for (const name of Object.keys(containers)) {
      fail(Object.values(margins[name]).every((value) => value >= 2), `complete expected envelope needs 2px margin inside ${name}: ${JSON.stringify(margins[name])}`)
      for (const key of Object.keys(probes)) {
        fail(Object.values(probeMargins[name][key]).every((value) => value >= 2), `${key} click needs 2px margin inside ${name}`)
      }
    }
  } catch (error) {
    error.framing = { ...report, status: 'failed' }
    throw error
  }
  return { ...report, status: 'passed' }
}

/** A screenshot may auto-scroll or settle layout. It cannot be paired with an
 * earlier coordinate system even when both individual frames fit the root. */
export function assertResponsiveCaptureStable(before, after, png) {
  const pick = (value) => ({ root: value.root, contour: value.contour, body: value.body, layout: value.layout,
    viewport: value.viewport, scroll: value.scroll, devicePixelRatio: value.devicePixelRatio,
    selection: value.selection, framingState: value.framingState })
  assert.deepEqual(pick(after), pick(before), 'Responsive capture coordinate mismatch: root/contour/body or capture state changed')
  if (png) {
    assert.equal(png.width, before.root.rect.width, 'Responsive capture coordinate mismatch: PNG width')
    assert.equal(png.height, before.root.rect.height, 'Responsive capture coordinate mismatch: PNG height')
  }
}
