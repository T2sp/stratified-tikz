/* Separately named LPPL 1.3c adaptation of PGF 3.1.11a shape anchors and
 * pgfmathcalc's bounded line/arc bisection. Source hashes and oracle input/output
 * are recorded in tests/fixtures/point-node-anchors; no TeX runs in the app. */
import type { PointShape, Vec2 } from '../../model/types.ts'
import { resolvePointShapeParameters } from '../../model/pointShapeParameters.ts'
import { boundsOfPoints, svgPoint } from './contours.ts'
import type { PointNodeAnchorResolution, PointNodeShapeInput, PointNodeShapeSolution, PointShapeBounds } from './types.ts'
import { pgfAsin, pgfAtan2, pgfCos, pgfReciprocal, pgfRound, pgfSin, pgfTan, pgfMultiply } from './pgfMath.ts'

const radians = Math.PI / 180
const sin = (angle: number) => Math.sin(angle * radians)
const cos = (angle: number) => Math.cos(angle * radians)
const polar = (radius: number, angle: number): Vec2 => ({ x: radius * cos(angle), y: radius * sin(angle) })
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
const midpoint = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const compass = { east: 0, 'north east': 45, north: 90, 'north west': 135, west: 180,
  'south west': 225, south: 270, 'south east': 315 } as const
const textAnchors = ['center', 'text', 'base', 'mid'] as const
const sideTextAnchors = ['base east', 'base west', 'mid east', 'mid west'] as const
const specific: Readonly<Record<PointShape, readonly string[]>> = {
  circle: [], rectangle: [], ellipse: [], diamond: [], square: ['corner N', 'side N'], triangle: ['corner N', 'side N'],
  'regular polygon': ['corner N', 'side N'], star: ['outer point N', 'inner point N'],
  trapezium: ['bottom left corner', 'top left corner', 'top right corner', 'bottom right corner', 'left side', 'right side', 'top side', 'bottom side'],
  'isosceles triangle': ['apex', 'left corner', 'right corner', 'left side', 'right side', 'lower side'],
  kite: ['upper vertex', 'lower vertex', 'left vertex', 'right vertex', 'upper left side', 'lower left side', 'upper right side', 'lower right side'],
  dart: ['tip', 'left tail', 'right tail', 'tail center', 'left side', 'right side'],
  semicircle: ['apex', 'arc start', 'arc end', 'chord center'],
  'circular sector': ['arc start', 'arc end', 'sector center', 'arc center'],
  cylinder: ['shape center', 'before top', 'top', 'after top', 'before bottom', 'bottom', 'after bottom'],
}
const textSides = new Set<PointShape>(['circle', 'rectangle', 'ellipse', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'cylinder'])

/** The exact declared PGF 3.1.11a anchor inventory, including inherited text. */
type AnchorSupport = { standard: readonly string[]; specific: readonly string[]; numericBorder: boolean }
function support(shape: PointShape): AnchorSupport {
  return { standard: [...textAnchors, ...Object.keys(compass), ...(textSides.has(shape) ? sideTextAnchors : [])], specific: specific[shape], numericBorder: true }
}
export const pointNodeAnchorSupport: Readonly<Record<PointShape, AnchorSupport>> = {
  circle: support('circle'), rectangle: support('rectangle'), ellipse: support('ellipse'), diamond: support('diamond'),
  square: support('square'), triangle: support('triangle'), 'regular polygon': support('regular polygon'), star: support('star'),
  trapezium: support('trapezium'), 'isosceles triangle': support('isosceles triangle'), kite: support('kite'), dart: support('dart'),
  semicircle: support('semicircle'), 'circular sector': support('circular sector'), cylinder: support('cylinder'),
}

/** Name validation is independent of body measurement; numeric intersection remains layout-dependent. */
export function pointNodeAnchorIssue(shape: PointShape, raw: string, parameters?: PointNodeShapeInput['parameters']): string | undefined {
  const anchor = raw.trim()
  if (pointNodeAnchorSupport[shape].standard.includes(anchor) || pointNodeAnchorSupport[shape].specific.some((name) => !name.endsWith(' N') && name === anchor)) return undefined
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(anchor) && Number.isFinite(Number(anchor))) {
    if (anchor.startsWith('.') || anchor.startsWith('+.')) return `Numeric anchor “${raw}” requires an integer part in PGF's count grammar; its source is retained for TikZ.`
    // Unsigned literals use the parser's fast lane; a leading plus uses quick
    // count assignment. A leading minus invokes dimensional negation first.
    const negative = anchor.startsWith('-')
    const withinRange = negative ? Math.round(Math.abs(Number(anchor)) * 65536) < 2 ** 30 : Number(anchor.split('.')[0] || '0') < 16384
    return withinRange ? undefined : `Numeric anchor “${raw}” exceeds PGF's finite TeX dimensional range; its source is retained for TikZ.`
  }
  const p = resolvePointShapeParameters(parameters)
  const indexed = /^(corner|side|outer point|inner point) ([1-9]\d*)$/.exec(anchor)
  if (indexed) {
    const count = shape === 'square' ? 4 : shape === 'triangle' ? 3 : p.regularPolygonSides
    if ((['square', 'triangle', 'regular polygon'].includes(shape) && ['corner', 'side'].includes(indexed[1]!) && Number(indexed[2]) <= count) ||
      (shape === 'star' && ['outer point', 'inner point'].includes(indexed[1]!) && Number(indexed[2]) <= p.starPoints)) return undefined
  }
  return `Anchor “${raw}” is not supported by ${shape}; its source is retained for TikZ.`
}

type Line = { kind: 'line'; a: Vec2; b: Vec2 }
type Arc = { kind: 'arc'; center: Vec2; rx: number; ry: number; start: number; end: number }
type Boundary = { segments: (Line | Arc)[]; names: Record<string, Vec2>; center: Vec2; rotation: number; bounds: PointShapeBounds;
  shape: PointShape; pgfOffsetArc: boolean; unitScale: number; externalRadius: number; sourceCenter: Vec2;
  angularStart?: number;
  signedAxes?: Vec2;
  cylinder?: { top: Vec2; bottom: Vec2; endCenter: Vec2; baseCenter: Vec2; rx: number; ry: number; externalRadius: number } }
type UnanchoredSolution = Omit<PointNodeShapeSolution, 'anchors' | 'placementAnchor' | 'anchorDiagnostic' | 'textCenter' | 'shapeCenter'>

/** Resolve placement without changing model coordinates or any painted contour. */
export function resolvePointNodeAnchor(input: PointNodeShapeInput, solution: UnanchoredSolution, anchor: string): PointNodeAnchorResolution {
  const boundary = anchorBoundary(input, solution)
  return resolve(input, solution, boundary, anchor)
}

/** Runtime-only anchor data; never belongs in a Diagram, history or preset. */
export function pointNodeAnchorLayout(input: PointNodeShapeInput, solution: UnanchoredSolution): Pick<PointNodeShapeSolution,
  'anchors' | 'placementAnchor' | 'anchorDiagnostic' | 'textCenter' | 'shapeCenter' | 'anchorBounds'> {
  const boundary = anchorBoundary(input, solution)
  const names = [...pointNodeAnchorSupport[input.shape].standard, ...Object.keys(boundary.names)]
  const anchors: Record<string, Vec2> = {}
  for (const name of names) {
    const result = resolve(input, solution, boundary, name)
    if (result.supported) anchors[name] = result.position
  }
  const selected = resolve(input, solution, boundary, input.anchor ?? 'center')
  return { anchors, placementAnchor: selected.position, ...(selected.diagnostic ? { anchorDiagnostic: selected.diagnostic } : {}),
    textCenter: { x: 0, y: 0 }, shapeCenter: svgPoint(boundary.center, boundary.rotation), anchorBounds: boundary.bounds }
}

function resolve(input: PointNodeShapeInput, solution: UnanchoredSolution, boundary: Boundary, raw: string): PointNodeAnchorResolution {
  try {
    const result = resolveUnchecked(input, solution, boundary, raw)
    if (!Number.isFinite(result.position.x) || !Number.isFinite(result.position.y)) return {
      supported: false, position: { x: 0, y: 0 }, diagnostic: 'The requested PGF anchor is singular for these clearance dimensions.' }
    return Math.round(Math.max(Math.abs(result.position.x), Math.abs(result.position.y)) / boundary.unitScale * 65536) < 2 ** 30 ? result :
      { supported: false, position: { x: 0, y: 0 }, diagnostic: 'The requested PGF anchor exceeds the finite TeX dimensional range.' }
  } catch (error) {
    return { supported: false, position: { x: 0, y: 0 }, diagnostic: error instanceof Error ? error.message : 'The requested PGF anchor is singular.' }
  }
}

function resolveUnchecked(input: PointNodeShapeInput, solution: UnanchoredSolution, boundary: Boundary, raw: string): PointNodeAnchorResolution {
  const anchor = raw.trim()
  const position = (point: Vec2): PointNodeAnchorResolution => Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { supported: true, position: point }
    : { supported: false, position: { x: 0, y: 0 }, diagnostic: 'The requested PGF anchor is singular for these clearance axes.' }
  const baseline = solution.baseline
  const midY = baseline - (input.fontContext?.ex ?? 4.30554 * (input.unitScale ?? 1)) / 2
  if (anchor === 'center') return position({ x: 0, y: 0 })
  if (anchor === 'text') return position({ x: input.body.originX ?? -input.body.width / 2, y: baseline })
  if (anchor === 'base') return position({ x: 0, y: baseline })
  if (anchor === 'mid') return position({ x: 0, y: midY })
  if (input.shape === 'circular sector' && anchor === 'arc center') return borderResult(boundary, boundary.rotation + 180, undefined, true)
  const named = boundary.names[anchor]
  if (named) return position(svgPoint(named, boundary.rotation))
  if (Object.hasOwn(compass, anchor)) {
    const angle = compass[anchor as keyof typeof compass]
    if (boundary.signedAxes) {
      const { x, y } = boundary.signedAxes
      const diagonal = anchor.includes(' ')
      if (input.shape === 'rectangle') return position({ x: Math.round(cos(angle)) * x, y: -Math.round(sin(angle)) * y })
      if (input.shape === 'diamond') return position({ x: Math.round(cos(angle)) * x / (diagonal ? 2 : 1), y: -Math.round(sin(angle)) * y / (diagonal ? 2 : 1) })
      // Ellipse compass diagonals use eccentric angle, unlike numeric border directions.
      return position(svgPoint({ x: x * cos(angle), y: y * sin(angle) }))
    }
    return borderResult(boundary, angle, undefined, true)
  }
  if (textSides.has(input.shape) && sideTextAnchors.includes(anchor as typeof sideTextAnchors[number])) {
    const reference = { x: 0, y: anchor.startsWith('base') ? baseline : midY }
    const angle = anchor.endsWith('east') ? 0 : 180
    // Basic shapes deliberately use axis extrema, rather than intersecting at the text baseline.
    if (input.shape === 'rectangle' || input.shape === 'circle' || input.shape === 'ellipse') {
      return position({ x: (anchor.endsWith('east') ? 1 : -1) * boundary.signedAxes!.x, y: reference.y })
    }
    return borderResult(boundary, angle, reference, true)
  }
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(anchor) && Number.isFinite(Number(anchor))) {
    const issue = pointNodeAnchorIssue(input.shape, raw, input.parameters)
    if (issue) return { supported: false, position: { x: 0, y: 0 }, diagnostic: issue }
    // PGF's unknown-anchor route calls pgfmathsetcounter before polar placement.
    const angle = anchor.startsWith('-') ? -Math.trunc(pgfRound(Math.abs(Number(anchor)))) : Number(anchor.split('.')[0] || '0')
    if (input.shape === 'diamond' && boundary.signedAxes?.x === 0 && boundary.signedAxes.y === 0) {
      return { supported: false, position: { x: 0, y: 0 }, diagnostic: 'PGF diamond numeric border anchors are singular when both clearance axes are zero.' }
    }
    if (boundary.signedAxes) return position(signedBasicBorder(input.shape, boundary.signedAxes, angle, boundary.unitScale))
    return borderResult(boundary, angle)
  }
  return { supported: false, position: { x: 0, y: 0 }, diagnostic: `Anchor “${raw}” is not supported by ${input.shape}; its source is retained for TikZ.` }
}

function signedBasicBorder(shape: PointShape, axes: Vec2, angle: number, scale: number): Vec2 {
  const dx = pgfCos(angle), dy = pgfSin(angle), a = Math.abs(dx), b = Math.abs(dy)
  if (shape === 'circle') return { x: axes.x * dx, y: -axes.x * dy }
  if (shape === 'ellipse') {
    if (axes.x === axes.y) return { x: axes.x * dx, y: -axes.y * dy }
    const direction = axes.x < axes.y ? { x: dx, y: dy * axes.x / axes.y } : { x: dx * axes.y / axes.x, y: dy }
    // PGF normalizes through atantwo, including its deliberate (0,0)->90
    // direction. A zero ellipse axis does not imply an undefined anchor.
    const normalized = pgfAtan2(direction.y, direction.x)
    return { x: axes.x * pgfCos(normalized), y: -axes.y * pgfSin(normalized) }
  }
  if (shape === 'diamond') {
    if (a === 0 && axes.y === 0 || b === 0 && axes.x === 0) return { x: 0, y: 0 }
    const factor = 1 / ((a === 0 ? 0 : a / axes.x) + (b === 0 ? 0 : b / axes.y))
    return { x: dx * factor, y: -dy * factor }
  }
  // PGF compares signed saved axes, even after negative outer separation
  // inverts them. Sorting the bounds or choosing the nearest positive ray
  // would change its negative-radius and mirrored rectangle behavior.
  const small = 255 / 8192
  const inverseA = a < small ? 0 : Math.trunc(8192 * 65536 / Math.trunc(a * 8192)) / 65536
  const inverseB = b < small ? 0 : Math.trunc(8192 * 65536 / Math.trunc(b * 8192)) / 65536
  const project = (coordinate: number, inverse: number, axis: number) => pgfRound(pgfRound(coordinate * Number(inverse.toFixed(5))) * Number((axis / scale).toFixed(5))) * scale
  let x: number, y: number
  if (b < a) {
    if (a < small) { x = 0; y = axes.y }
    else {
      y = project(b, inverseA, axes.x)
      if (y < axes.y) x = axes.x
      else if (b < small) { x = axes.x; y = 0 }
      else { x = project(a, inverseB, axes.y); y = axes.y }
    }
  } else if (b < small) { x = axes.x; y = 0 }
  else {
    x = project(a, inverseB, axes.y)
    if (x < axes.x) y = axes.y
    else if (a < small) { x = 0; y = axes.y }
    else { y = project(b, inverseA, axes.x); x = axes.x }
  }
  return { x: dx < 0 ? -x : x, y: -(dy < 0 ? -y : y) }
}

function borderResult(boundary: Boundary, angle: number, reference: Vec2 = { x: 0, y: 0 }, namedDirection = false): PointNodeAnchorResolution {
  // Named compass/text-side anchors pass the shape's saved external radius.
  // PGF retains its sign even if a negative outer separation inverts it.
  if (namedDirection && boundary.externalRadius < 0) angle += 180
  const origin = unrotate(reference, boundary.rotation)
  const direction = polar(1, angle - boundary.rotation)
  let segments = boundary.segments
  const selected = selectedPgfSegment(boundary, angle, reference, origin)
  if (selected) {
    if (selected.kind === 'arc') return offsetArcResult(boundary, selected, angle, reference)
    return pgfIntersectionResult(boundary, selected, angle, reference, namedDirection)
  }
  if (boundary.cylinder) {
    const cylinder = boundary.cylinder
    const globalReference = { x: reference.x, y: -reference.y }
    const diagonal = normalizedAngle(angle) % 90 === 45
    const external = add(globalReference, polar(namedDirection ? Math.abs(cylinder.externalRadius) * (diagonal ? Math.SQRT2 : 1) : boundary.unitScale, angle))
    const fromReference = (point: Vec2) => normalizedAngle(pgfAtan2((point.y - globalReference.y) / boundary.unitScale, (point.x - globalReference.x) / boundary.unitScale))
    const externalAngle = normalizedAngle(pgfAtan2(external.y / boundary.unitScale, external.x / boundary.unitScale) - boundary.rotation)
    const bottomRight = { x: cylinder.top.x, y: -cylinder.top.y }, bottomLeft = { x: cylinder.bottom.x, y: -cylinder.bottom.y }
    if (externalAngle < fromReference(cylinder.bottom)) {
      segments = externalAngle < fromReference(cylinder.top)
        ? [arc(cylinder.endCenter, cylinder.rx, cylinder.ry, 0, 90)]
        : [{ kind: 'line', a: cylinder.bottom, b: cylinder.top }]
    } else if (externalAngle > fromReference(bottomLeft)) {
      segments = externalAngle > fromReference(bottomRight)
        ? [arc(cylinder.endCenter, cylinder.rx, cylinder.ry, 270, 360)]
        : [{ kind: 'line', a: bottomLeft, b: bottomRight }]
    } else segments = [arc(cylinder.baseCenter, cylinder.rx, cylinder.ry, 90, 270)]
    const segment = segments[0]!
    if (segment.kind === 'arc') return { supported: true, position: svgPoint(pgfLineArcPoint(boundary, origin, direction, segment), boundary.rotation) }
    return pgfIntersectionResult(boundary, segment, angle, reference, namedDirection, true)
  }
  let nearest = Infinity
  let nearestSegment: Line | Arc | undefined
  for (const segment of segments) {
    for (const distance of intersections(origin, direction, segment, boundary.cylinder !== undefined)) {
      if (distance >= -1e-8 && distance < nearest) { nearest = Math.max(0, distance); nearestSegment = segment }
    }
  }
  if (!Number.isFinite(nearest)) return { supported: false, position: { x: 0, y: 0 }, diagnostic: 'The requested anchor has no finite intersection with this PGF clearance boundary.' }
  if (boundary.pgfOffsetArc && nearestSegment?.kind === 'arc') return offsetArcResult(boundary, nearestSegment, angle, reference)
  return { supported: true, position: svgPoint(add(origin, { x: nearest * direction.x, y: nearest * direction.y }), boundary.rotation) }
}

/** The upstream line intersection normalizes dimension vectors, inverts a
 * rounded affine matrix, and uses its bounded reciprocal. Near parallel
 * clearance lines expose a measurable difference from a float cross product. */
function pgfIntersectionResult(boundary: Boundary, segment: Line, angle: number, reference: Vec2,
  namedDirection: boolean, borderFirst = false): PointNodeAnchorResolution {
  const scale = boundary.unitScale
  const center = { x: pgfRound(boundary.sourceCenter.x / scale), y: pgfRound(boundary.sourceCenter.y / scale) }
  const printed = (value: number) => Number(value.toFixed(5))
  const multiply = (factor: number, dimension: number) => pgfMultiply(printed(factor), dimension)
  const global = (point: Vec2): Vec2 => ({
    x: center.x + multiply(pgfCos(boundary.rotation), point.x / scale) - multiply(pgfSin(boundary.rotation), point.y / scale),
    y: center.y + multiply(pgfSin(boundary.rotation), point.x / scale) + multiply(pgfCos(boundary.rotation), point.y / scale),
  })
  const origin = { x: center.x + pgfRound(reference.x / scale), y: center.y - pgfRound(reference.y / scale) }
  const components = !['semicircle', 'circular sector'].includes(boundary.shape) && normalizedAngle(angle) % 90 === 45
  const radius = namedDirection ? Math.abs(boundary.externalRadius) / scale * (components ? Math.SQRT2 : 1) : 1
  const external = add(origin, { x: multiply(pgfCos(angle), radius), y: multiply(pgfSin(angle), radius) })
  let a = origin, b = external, c = global(segment.a), d = global(segment.b)
  if (borderFirst) [a, b, c, d] = [c, d, a, b]
  const orthogonal = (first: Vec2, second: Vec2): Vec2 => {
    let x = pgfRound(second.x - first.x), y = pgfRound(first.y - second.y)
    const count = Math.trunc((Math.abs(Math.round(x * 65536)) + Math.abs(Math.round(y * 65536))) / 65536)
    if (count > 0) { x = Math.trunc(Math.round(x * 65536) / count) / 65536; y = Math.trunc(Math.round(y * 65536) / count) / 65536 }
    return { x, y }
  }
  const first = orthogonal(a, b), second = orthogonal(c, d)
  const aa = printed(first.y), ab = printed(second.y), ba = printed(first.x), bb = printed(second.x)
  const projectionA = multiply(aa, a.x) + multiply(ba, a.y)
  const projectionB = multiply(ab, c.x) + multiply(bb, c.y)
  let inverseAA: number, inverseAB: number, inverseBA: number, inverseBB: number
  if (ab === 0 && ba === 0) { inverseAA = pgfReciprocal(aa); inverseBB = pgfReciprocal(bb); inverseAB = 0; inverseBA = 0 }
  else {
    const inverse = pgfReciprocal(multiply(aa, bb) - multiply(ba, ab))
    inverseAA = multiply(bb, inverse); inverseBB = multiply(aa, inverse)
    inverseBA = multiply(-ba, inverse); inverseAB = multiply(-ab, inverse)
  }
  const point = { x: multiply(inverseAA, projectionA) + multiply(inverseBA, projectionB),
    y: multiply(inverseBB, projectionB) + multiply(inverseAB, projectionA) }
  return { supported: true, position: { x: (point.x - center.x) * scale, y: -(point.y - center.y) * scale } }
}

/** PGF's experimental line/arc function uses a fixed-point angular bisection,
 * including finite estimates when signed radii make the ray miss the arc. */
function pgfLineArcPoint(boundary: Boundary, origin: Vec2, direction: Vec2, segment: Arc): Vec2 {
  let x = normalizedAngle(pgfAtan2(direction.y, direction.x))
  let s = segment.start, e = segment.end
  const wrapsZero = normalizedAngle(e) < normalizedAngle(s)
  if (wrapsZero) x = normalizedAngle(x + 180)
  let best = (s + e) / 2, residual = 360
  const pointAt = (angle: number): Vec2 => add(segment.center, {
    x: pgfRound(segment.rx / boundary.unitScale * pgfCos(angle)) * boundary.unitScale,
    y: pgfRound(segment.ry / boundary.unitScale * pgfSin(angle)) * boundary.unitScale,
  })
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const p = Math.trunc((s + e) / 2 * 65536) / 65536
    if (p === s) break
    const point = pointAt(p)
    let q = normalizedAngle(pgfAtan2((point.y - origin.y) / boundary.unitScale, (point.x - origin.x) / boundary.unitScale))
    if (wrapsZero) q = normalizedAngle(q + 180)
    if (x > 335 && q < 45) q += 360
    const delta = Math.abs(x - q)
    if (delta < residual) { residual = delta; best = p }
    if (x === q) break
    if (x < q) e = p
    else s = p
  }
  return pointAt(best)
}

function offsetArcResult(boundary: Boundary, segment: Arc, angle: number, reference: Vec2): PointNodeAnchorResolution {
    // The upstream offset-circle formula uses PGF's deliberately bounded
    // reciprocal and inverse-sine tables. Exact quadratic intersections can
    // otherwise disagree by a visible fraction of a point in the incircle branch.
    const scale = boundary.unitScale
    const svgCenter = svgPoint(segment.center, boundary.rotation)
    const globalCenter = { x: svgCenter.x, y: -svgCenter.y }
    const globalReference = { x: reference.x, y: -reference.y }
    const centerToReference = { x: globalReference.x - globalCenter.x, y: globalReference.y - globalCenter.y }
    const distance = boundary.shape === 'circular sector' ? segment.center.x : Math.hypot(centerToReference.x, centerToReference.y)
    const externalAngle = ((angle % 360) + 360) % 360
    const secondAngle = pgfAtan2(centerToReference.y / scale, centerToReference.x / scale)
    const sine = pgfSin(secondAngle - externalAngle)
    try {
      const reciprocal = pgfReciprocal(segment.rx / scale)
      const argument = pgfRound(pgfRound(distance / scale * sine) * reciprocal)
      const curveAngle = externalAngle + pgfAsin(argument)
      return { supported: true, position: { x: globalCenter.x + segment.rx * pgfCos(curveAngle),
        y: -(globalCenter.y + segment.ry * pgfSin(curveAngle)) } }
    } catch (error) {
      return { supported: false, position: { x: 0, y: 0 }, diagnostic: error instanceof Error ? error.message : 'The PGF offset arc is singular.' }
    }
}

const normalizedAngle = (value: number) => ((value % 360) + 360) % 360

/** PGF compares its saved angles in declaration order and intersects infinite
 * lines. Replacing this with a nearest positive ray changes valid inverted
 * clearance boundaries produced by strong negative outer separation. */
function selectedPgfSegment(boundary: Boundary, angle: number, reference: Vec2, origin: Vec2): Line | Arc | undefined {
  const external = normalizedAngle(angle - boundary.rotation)
  const angleFrom = (point: Vec2, from = origin) => normalizedAngle(pgfAtan2((point.y - from.y) / boundary.unitScale, (point.x - from.x) / boundary.unitScale))
  const n = boundary.names
  const line = (a: Vec2, b: Vec2): Line => ({ kind: 'line', a, b })
  if (boundary.angularStart !== undefined) {
    const step = 360 / boundary.segments.length
    const index = Math.floor(normalizedAngle(external - boundary.angularStart) / step)
    return boundary.segments[Math.min(index, boundary.segments.length - 1)]
  }
  switch (boundary.shape) {
    case 'trapezium': {
      const ur = n['top right corner']!, ul = n['top left corner']!, ll = n['bottom left corner']!, lr = n['bottom right corner']!
      return external < angleFrom(ur) ? line(ur, lr) : external < angleFrom(ul) ? line(ul, ur) :
        external < angleFrom(ll) ? line(ul, ll) : external < angleFrom(lr) ? line(ll, lr) : line(ur, lr)
    }
    case 'isosceles triangle': {
      const apex = n.apex!, left = n['left corner']!, right = n['right corner']!
      // Upstream compares its unrotated points with the upright reference,
      // including base/mid; this differs from the other polygon solvers.
      const globalReference = { x: reference.x, y: -reference.y }
      const from = (point: Vec2) => angleFrom(point, globalReference)
      return external < from(right) ? external < from(left) ? external > from(apex) ? line(apex, left) : line(apex, right) :
        line(left, right) : line(right, apex)
    }
    case 'kite': {
      const top = n['upper vertex']!, left = n['left vertex']!, bottom = n['lower vertex']!, right = n['right vertex']!
      const at = angleFrom(top), al = angleFrom(left), ab = angleFrom(bottom), ar = angleFrom(right)
      if (ar < at) return external < ar ? line(right, bottom) : external < at ? line(right, top) : external < al ? line(top, left) :
        external < ab ? line(left, bottom) : line(right, bottom)
      return external < at ? line(right, top) : external < al ? line(left, top) : external < ab ? line(bottom, left) :
        external < ar ? line(right, bottom) : line(right, top)
    }
    case 'dart': {
      const tip = n.tip!, left = n['left tail']!, tail = n['tail center']!, right = n['right tail']!
      return external < angleFrom(tip) ? line(tip, right) : external < angleFrom(left) ? line(left, tip) :
        external < angleFrom(tail) ? line(left, tail) : external < angleFrom(right) ? line(right, tail) : line(tip, right)
    }
    case 'semicircle': {
      const curved = boundary.segments[0] as Arc
      const start = arcPoint(curved, curved.start), end = arcPoint(curved, curved.end)
      const startCorner = n['arc start']!, endCorner = n['arc end']!
      return external > angleFrom(start) ? curved : external > angleFrom(startCorner) ? line(startCorner, start) :
        external > angleFrom(endCorner) ? line(endCorner, startCorner) : external > angleFrom(end) ? line(end, endCorner) : curved
    }
    case 'circular sector': {
      const curved = boundary.segments[0] as Arc
      const start = arcPoint(curved, curved.start), end = arcPoint(curved, curved.end)
      const startCorner = n['arc start']!, endCorner = n['arc end']!, center = n['sector center']!
      return external > angleFrom(endCorner) ? line(endCorner, center) : external > angleFrom(end) ? line(end, endCorner) :
        external > angleFrom(start) ? curved : external > angleFrom(startCorner) ? line(start, startCorner) : line(center, startCorner)
    }
    default: return undefined
  }
}

function intersections(origin: Vec2, direction: Vec2, segment: Line | Arc, infiniteLine = false): number[] {
  if (segment.kind === 'line') {
    const edge = { x: segment.b.x - segment.a.x, y: segment.b.y - segment.a.y }
    const denominator = cross(direction, edge)
    if (Math.abs(denominator) < 1e-12) return []
    const difference = { x: segment.a.x - origin.x, y: segment.a.y - origin.y }
    const u = cross(difference, direction) / denominator
    return infiniteLine || (u >= -1e-9 && u <= 1 + 1e-9) ? [cross(difference, edge) / denominator] : []
  }
  if (segment.rx === 0 || segment.ry === 0) return []
  const x = (origin.x - segment.center.x) / segment.rx, y = (origin.y - segment.center.y) / segment.ry
  const dx = direction.x / segment.rx, dy = direction.y / segment.ry
  const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - 1
  const discriminant = b * b - 4 * a * c
  if (discriminant < -1e-10) return []
  return [(-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a), (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a)]
    .filter((t) => {
      const angle = Math.atan2(y + t * dy, x + t * dx) / radians
      const normalized = ((angle - segment.start) % 360 + 360) % 360
      return normalized <= segment.end - segment.start + 1e-7 || normalized >= 360 - 1e-7
    })
}

function cross(a: Vec2, b: Vec2): number { return a.x * b.y - a.y * b.x }
function unrotate(point: Vec2, rotation: number): Vec2 {
  return { x: point.x * cos(rotation) - point.y * sin(rotation), y: -point.x * sin(rotation) - point.y * cos(rotation) }
}
function polyline(points: readonly Vec2[]): Line[] { return points.map((a, index) => ({ kind: 'line', a, b: points[(index + 1) % points.length]! })) }
function arc(center: Vec2, rx: number, ry: number, start = 0, end = 360): Arc { return { kind: 'arc', center, rx, ry, start, end } }
function arcPoint(item: Arc, angle: number): Vec2 { return add(item.center, { x: item.rx * cos(angle), y: item.ry * sin(angle) }) }

/** Parallel edge intersections preserve PGF's corner/miter clearance. */
function miterPolygon(points: readonly Vec2[], separation: number): Vec2[] {
  const area = points.reduce((total, a, index) => total + cross(a, points[(index + 1) % points.length]!), 0)
  const sign = area < 0 ? -1 : 1
  return points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length]!, after = points[(index + 1) % points.length]!
    const aLength = Math.hypot(point.x - before.x, point.y - before.y), bLength = Math.hypot(after.x - point.x, after.y - point.y)
    if (!aLength || !bLength) return { ...point }
    const a = { x: sign * (point.y - before.y) / aLength, y: sign * (before.x - point.x) / aLength }
    const b = { x: sign * (after.y - point.y) / bLength, y: sign * (point.x - after.x) / bLength }
    const denominator = 1 + a.x * b.x + a.y * b.y
    if (Math.abs(denominator) < 1e-12) return { ...point }
    return add(point, { x: separation * (a.x + b.x) / denominator, y: separation * (a.y + b.y) / denominator })
  })
}

function anchorBoundary(input: PointNodeShapeInput, solution: UnanchoredSolution): Boundary {
  const p = resolvePointShapeParameters(input.parameters)
  const rotation = solution.rotation
  const painted = solution.contours[0]!.vertices.map((point) => unrotate(point, rotation))
  const bounds = boundsOfPoints(painted)
  const sep = Math.max(input.outerXSep, input.outerYSep)
  let segments: (Line | Arc)[] = []
  const names: Record<string, Vec2> = {}
  let center: Vec2 = { x: 0, y: 0 }
  let cylinder: Boundary['cylinder']
  let signedAxes: Vec2 | undefined
  let externalRadius = input.unitScale ?? 1
  let angularStart: number | undefined
  switch (input.shape) {
    case 'circle': signedAxes = { x: bounds.maxX + sep, y: bounds.maxY + sep }; segments = [arc(center, signedAxes.x, signedAxes.y)]; break
    case 'ellipse': signedAxes = { x: bounds.maxX + input.outerXSep, y: bounds.maxY + input.outerYSep }; segments = [arc(center, signedAxes.x, signedAxes.y)]; break
    case 'rectangle': signedAxes = { x: bounds.maxX + input.outerXSep, y: bounds.maxY + input.outerYSep }; segments = polyline([{ x: bounds.maxX + input.outerXSep, y: bounds.maxY + input.outerYSep },
      { x: bounds.minX - input.outerXSep, y: bounds.maxY + input.outerYSep }, { x: bounds.minX - input.outerXSep, y: bounds.minY - input.outerYSep },
      { x: bounds.maxX + input.outerXSep, y: bounds.minY - input.outerYSep }]); break
    case 'diamond': {
      const paddedX = input.body.width / 2 + input.innerXSep, paddedY = (input.body.height + input.body.depth) / 2 + input.innerYSep
      const rx = Math.max(paddedX + p.aspect * paddedY, input.minimumWidth / 2) + input.outerXSep
      const ry = Math.max(paddedX / p.aspect + paddedY, input.minimumHeight / 2) + input.outerYSep
      signedAxes = { x: rx, y: ry }
      segments = polyline([{ x: rx, y: 0 }, { x: 0, y: ry }, { x: -rx, y: 0 }, { x: 0, y: -ry }]); break
    }
    case 'square': case 'triangle': case 'regular polygon': {
      const sides = painted.length
      const points = painted.map((point) => {
        const radius = Math.hypot(point.x, point.y)
        const factor = radius ? (radius + sep / cos(180 / sides)) / radius : 1
        return { x: point.x * factor, y: point.y * factor }
      })
      points.forEach((point, index) => { names[`corner ${index + 1}`] = point; names[`side ${index + 1}`] = midpoint(point, points[(index + 1) % sides]!) })
      angularStart = sides % 2 ? 90 : 90 - 180 / sides
      externalRadius = points[0]!.x * cos(angularStart) + points[0]!.y * sin(angularStart)
      segments = polyline(points); break
    }
    case 'star': {
      const points = miterPolygon(painted, sep)
      points.forEach((point, index) => { names[`${index % 2 ? 'inner' : 'outer'} point ${Math.floor(index / 2) + 1}`] = point })
      angularStart = 90
      externalRadius = points[0]!.y
      segments = polyline(points); break
    }
    case 'trapezium': {
      const scale = input.unitScale ?? 1
      const miter = (index: number, first: number, second: number, xSign: number, ySign: number): Vec2 => {
        const point = painted[index]!, a = painted[first]!, b = painted[second]!
        const angleA = normalizedAngle(pgfAtan2((a.y - point.y) / scale, (a.x - point.x) / scale))
        const angleB = normalizedAngle(pgfAtan2((b.y - point.y) / scale, (b.x - point.x) / scale))
        const adjustment = pgfReciprocal(pgfTan(pgfRound(normalizedAngle(angleB - angleA) / 2)))
        return add(point, { x: pgfRound(xSign * sep / scale * adjustment) * scale, y: ySign * sep })
      }
      const points = [miter(0, 3, 1, -1, -1), miter(1, 0, 2, -1, 1), miter(2, 1, 3, 1, 1), miter(3, 2, 0, 1, -1)]
      const [bottomLeft, topLeft, topRight, bottomRight] = points as [Vec2, Vec2, Vec2, Vec2]
      // The saved external radius excludes the left/right extensions.
      const halfWidth = (Math.min(painted[2]!.x, painted[3]!.x) - Math.max(painted[0]!.x, painted[1]!.x)) / 2
      externalRadius = 2 * Math.max(halfWidth, painted[1]!.y) + 2 * sep
      Object.assign(names, { 'bottom left corner': bottomLeft, 'top left corner': topLeft, 'top right corner': topRight, 'bottom right corner': bottomRight,
        'left side': midpoint(bottomLeft, topLeft), 'right side': midpoint(bottomRight, topRight), 'top side': midpoint(topLeft, topRight), 'bottom side': midpoint(bottomLeft, bottomRight) })
      segments = polyline(points); break
    }
    case 'isosceles triangle': {
      const [apex, left, right] = painted as [Vec2, Vec2, Vec2]
      // PGF deliberately retains the original cosecant at a stretched apex.
      const halfAngle = Math.atan2(left.y - right.y, 2 * (apex.x - left.x)) / radians
      const apexAnchor = add(apex, { x: sep / sin(p.isoscelesTriangleApexAngle / 2), y: 0 })
      const leftAnchor = add(left, { x: -sep, y: sep / Math.tan((90 - halfAngle) / 2 * radians) })
      const rightAnchor = { x: leftAnchor.x, y: -leftAnchor.y }
      Object.assign(names, { apex: apexAnchor, 'left corner': leftAnchor, 'right corner': rightAnchor, 'left side': midpoint(apexAnchor, leftAnchor),
        'right side': midpoint(apexAnchor, rightAnchor), 'lower side': midpoint(leftAnchor, rightAnchor) })
      segments = polyline([apexAnchor, leftAnchor, rightAnchor]); break
    }
    case 'kite': {
      const scale = input.unitScale ?? 1
      const a = p.kiteUpperVertexAngle / 2, b = p.kiteLowerVertexAngle / 2
      const topMiter = pgfRound(sep / scale * pgfReciprocal(pgfSin(a))) * scale
      const bottomMiter = pgfRound(sep / scale * pgfReciprocal(pgfSin(b))) * scale
      const sideMiter = pgfRound(sep / scale * pgfReciprocal(pgfSin((180 - a - b) / 2))) * scale
      const sideAngle = (a - b) / 2
      const miterAt = (angle: number): Vec2 => ({ x: pgfRound(sideMiter / scale * pgfCos(angle)) * scale,
        y: pgfRound(sideMiter / scale * pgfSin(angle)) * scale })
      const points = [add(painted[0]!, { x: 0, y: topMiter }), add(painted[1]!, miterAt(180 - sideAngle)),
        add(painted[2]!, { x: 0, y: -bottomMiter }), add(painted[3]!, miterAt(sideAngle))]
      const [upper, left, lower, right] = points as [Vec2, Vec2, Vec2, Vec2]
      externalRadius = Math.max(Math.abs(right.x - left.x), Math.abs(upper.y - lower.y))
      Object.assign(names, { 'upper vertex': upper, 'lower vertex': lower, 'left vertex': left, 'right vertex': right,
        'upper left side': midpoint(upper, left), 'lower left side': midpoint(lower, left), 'upper right side': midpoint(upper, right), 'lower right side': midpoint(lower, right) })
      segments = polyline(points); break
    }
    case 'dart': {
      const points = miterPolygon(painted, sep)
      const [tip, left, tail, right] = points as [Vec2, Vec2, Vec2, Vec2]
      externalRadius = Math.max(Math.abs(tip.x - left.x), Math.abs(right.y - left.y))
      Object.assign(names, { tip, 'left tail': left, 'right tail': right, 'tail center': tail, 'left side': midpoint(tip, left), 'right side': midpoint(tip, right) })
      segments = polyline(points); break
    }
    case 'semicircle': {
      center = { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY }
      const radius = (bounds.maxX - bounds.minX) / 2 + sep
      const curved = arc(center, radius, radius, 0, 180)
      externalRadius = radius
      const start = arcPoint(curved, 0), end = arcPoint(curved, 180)
      const startCorner = add(start, { x: 0, y: -sep }), endCorner = add(end, { x: 0, y: -sep })
      Object.assign(names, { apex: arcPoint(curved, 90), 'arc start': startCorner, 'arc end': endCorner, 'chord center': midpoint(startCorner, endCorner) })
      segments = [curved, { kind: 'line', a: end, b: endCorner }, { kind: 'line', a: endCorner, b: startCorner }, { kind: 'line', a: startCorner, b: start }]; break
    }
    case 'circular sector': {
      center = painted[0]!
      const half = p.circularSectorAngle / 2
      const radius = Math.hypot(painted[1]!.x - center.x, painted[1]!.y - center.y)
      const curved = arc(center, radius + sep, radius + sep, 180 - half, 180 + half)
      const sectorCenter = add(center, { x: sep / sin(half), y: 0 })
      const cornerRadius = radius + sep + sep * cos(half) / sin(half)
      externalRadius = cornerRadius
      const startCorner = add(sectorCenter, polar(cornerRadius, 180 - half)), endCorner = add(sectorCenter, polar(cornerRadius, 180 + half))
      const start = arcPoint(curved, curved.start), end = arcPoint(curved, curved.end)
      Object.assign(names, { 'sector center': sectorCenter, 'arc start': startCorner, 'arc end': endCorner, 'arc center': arcPoint(curved, 180) })
      segments = [curved, { kind: 'line', a: end, b: endCorner }, { kind: 'line', a: endCorner, b: sectorCenter },
        { kind: 'line', a: sectorCenter, b: startCorner }, { kind: 'line', a: startCorner, b: start }]; break
    }
    case 'cylinder': {
      const end = solution.paintRegions.find((region) => region.role === 'end')!
      const endBounds = boundsOfPoints(end.vertices.map((point) => unrotate(point, rotation)))
      const rx = (endBounds.maxX - endBounds.minX) / 2, ry = (endBounds.maxY - endBounds.minY) / 2
      const endCenter = { x: (endBounds.minX + endBounds.maxX) / 2, y: 0 }
      const baseCenter = { x: bounds.minX + rx, y: 0 }
      const endArc = arc(endCenter, rx + sep, ry + sep, -90, 90), baseArc = arc(baseCenter, rx + sep, ry + sep, 90, 270)
      const top = { x: endCenter.x, y: ry + input.outerYSep }, bottom = { x: baseCenter.x, y: ry + input.outerYSep }
      Object.assign(names, { 'before top': top, top: { x: endCenter.x + rx + sep, y: 0 }, 'after top': { x: top.x, y: -top.y },
        'before bottom': { x: bottom.x, y: -bottom.y }, bottom: { x: baseCenter.x - rx - sep, y: 0 }, 'after bottom': bottom,
        'shape center': midpoint(baseCenter, endCenter) })
      center = names['shape center']!
      cylinder = { top, bottom, endCenter, baseCenter, rx: rx + sep, ry: ry + sep,
        externalRadius: Math.max(top.x + rx + sep, top.y) }
      externalRadius = cylinder.externalRadius
      // The horizontal clearance uses outer ysep; ellipse clearance uses max(xsep,ysep).
      // Their intentional PGF discontinuity is retained instead of expanding the paint box.
      segments = [endArc, baseArc, { kind: 'line', a: top, b: bottom },
        { kind: 'line', a: { x: top.x, y: -top.y }, b: { x: bottom.x, y: -bottom.y } }]; break
    }
  }
  const extrema: Vec2[] = []
  for (const segment of segments) {
    if (segment.kind === 'line') extrema.push(svgPoint(segment.a, rotation), svgPoint(segment.b, rotation))
    else {
      const criticalX = Math.atan2(-segment.ry * sin(rotation), segment.rx * cos(rotation)) / radians
      const criticalY = Math.atan2(segment.ry * cos(rotation), segment.rx * sin(rotation)) / radians
      for (const angle of [segment.start, segment.end, criticalX, criticalX + 180, criticalY, criticalY + 180]) {
        if ([segment.start, segment.end].includes(angle) || ((angle - segment.start) % 360 + 360) % 360 <= segment.end - segment.start) extrema.push(svgPoint(arcPoint(segment, angle), rotation))
      }
    }
  }
  return { segments, names, center, rotation, shape: input.shape, externalRadius,
    sourceCenter: { x: input.body.width / 2, y: (input.body.height - input.body.depth) / 2 },
    ...(angularStart !== undefined ? { angularStart } : {}), bounds: boundsOfPoints(extrema),
    pgfOffsetArc: input.shape === 'semicircle' || input.shape === 'circular sector', unitScale: input.unitScale ?? 1,
    ...(cylinder ? { cylinder } : {}), ...(signedAxes ? { signedAxes } : {}) }
}
