/*
 * Shape-fitting algorithms derived from PGF 3.1.11a's
 * pgflibraryshapes.geometric.code.tex (2018 Till Tantau and Mark Wibrow).
 * This independently named TypeScript adaptation is distributed under LPPL 1.3c.
 * The upstream source hash, license, fixed-box references and generation commands
 * are recorded with the Phase 32C reference fixtures. It never executes TeX.
 */
import type { PointShape, PointShapeParameters, Vec2 } from '../../model/types.ts'
import { resolvePointShapeParameters } from '../../model/pointShapeParameters.ts'
import { ellipseContour, ellipsePoint, polygonContour, ShapeContourBuilder } from './contours.ts'
import type {
  PointNodeShapeInput,
  PointNodeShapeSolution,
  PointShapeBounds,
  PointShapeContour,
  PointShapePaintRegion,
} from './types.ts'

const degree = Math.PI / 180
const sin = (angle: number) => Math.sin(angle * degree)
const cos = (angle: number) => Math.cos(angle * degree)
const tan = (angle: number) => Math.tan(angle * degree)
const cot = (angle: number) => 1 / tan(angle)

type Parameters = Required<PointShapeParameters>
type Construction = { contours: PointShapeContour[]; regions?: PointShapePaintRegion[]; rotation: number }

/**
 * Solve the PGF background path around a fixed upright box. All geometry is in
 * the same caller-selected units. This is intentionally independent of fonts,
 * DOM measurements, rendering state, the inspector and TikZ serialization.
 */
export function solvePointNodeShape(input: PointNodeShapeInput): PointNodeShapeSolution {
  validateInput(input)
  const p = resolvePointShapeParameters(input.parameters)
  validateParameters(p)
  const x = input.body.width / 2 + input.innerXSep
  const y = (input.body.height + input.body.depth) / 2 + input.innerYSep
  const construction = construct(input, p, x, y)
  const bounds = unionBounds(construction.contours.map((contour) => contour.bounds))
  if (!Object.values(bounds).every(Number.isFinite)) throw new RangeError('The shape parameters produce a degenerate contour.')
  const bodyBounds = {
    minX: -input.body.width / 2,
    minY: -(input.body.height + input.body.depth) / 2,
    maxX: input.body.width / 2,
    maxY: (input.body.height + input.body.depth) / 2,
  }
  // Full named/numeric PGF anchor resolution is a separate contract in 32D.
  // Clearance is never painted or used as the selectable fill contour.
  return {
    contours: construction.contours,
    paintRegions: construction.regions ?? [{ ...construction.contours[0]!, role: 'body' }],
    bounds,
    bodyBounds,
    bodyOrigin: { x: bodyBounds.minX, y: bodyBounds.minY },
    baseline: (input.body.height - input.body.depth) / 2,
    anchorBounds: clearanceBounds(input, construction.contours[0]!),
    rotation: construction.rotation,
    radius: Math.max(...construction.contours.flatMap((contour) => contour.vertices.map((point) => Math.hypot(point.x, point.y)))),
  }
}

function construct(input: PointNodeShapeInput, p: Parameters, x: number, y: number): Construction {
  const minimumRadius = Math.max(input.minimumWidth, input.minimumHeight) / 2
  switch (input.shape) {
    case 'circle': {
      const radius = Math.max(Math.hypot(x, y), minimumRadius)
      return single(ellipseContour(radius, radius))
    }
    case 'rectangle': {
      const halfWidth = Math.max(x, input.minimumWidth / 2)
      const halfHeight = Math.max(y, input.minimumHeight / 2)
      return single(polygonContour([
        { x: halfWidth, y: halfHeight }, { x: -halfWidth, y: halfHeight },
        { x: -halfWidth, y: -halfHeight }, { x: halfWidth, y: -halfHeight },
      ]))
    }
    case 'ellipse':
      // This PGF shape does not consume shape-border rotation/incircle keys.
      return single(ellipseContour(Math.max(Math.SQRT2 * x, input.minimumWidth / 2), Math.max(Math.SQRT2 * y, input.minimumHeight / 2)))
    case 'diamond': {
      // Minima intentionally operate independently, after aspect fitting.
      const rx = Math.max(x + p.aspect * y, input.minimumWidth / 2)
      const ry = Math.max(x / p.aspect + y, input.minimumHeight / 2)
      return single(polygonContour([{ x: rx, y: 0 }, { x: 0, y: ry }, { x: -rx, y: 0 }, { x: 0, y: -ry }]))
    }
    case 'square':
    case 'triangle':
    case 'regular polygon': {
      const sides = input.shape === 'square' ? 4 : input.shape === 'triangle' ? 3 : p.regularPolygonSides
      const radius = Math.max(Math.SQRT2 * Math.max(x, y) / cos(180 / sides), minimumRadius)
      const start = sides % 2 ? 90 : 90 - 180 / sides
      return single(polygonContour(Array.from({ length: sides }, (_, index) => polar(radius, start + index * 360 / sides)), p.borderRotate), p.borderRotate)
    }
    case 'star': {
      let inner = Math.SQRT2 * Math.max(x, y)
      const originalOuter = p.starPointMode === 'height' ? inner + p.starPointHeight : inner * p.starPointRatio
      const outer = Math.max(originalOuter, minimumRadius)
      if (outer > originalOuter) inner = p.starPointMode === 'height' ? outer - p.starPointHeight : outer / p.starPointRatio
      return single(polygonContour(Array.from({ length: 2 * p.starPoints }, (_, index) => polar(index % 2 ? inner : outer, 90 + index * 180 / p.starPoints)), p.borderRotate), p.borderRotate)
    }
    case 'trapezium': return trapezium(input, p, x, y)
    case 'isosceles triangle': return triangle(input, p, x, y)
    case 'kite': return kite(input, p, x, y)
    case 'dart': return dart(input, p, x, y)
    case 'semicircle': return semicircle(input, p, x, y)
    case 'circular sector': return sector(input, p, x, y)
    case 'cylinder': return cylinder(input, p, x, y)
    default: return unsupportedShape(input.shape)
  }
}

function single(contour: PointShapeContour, rotation = 0): Construction {
  return { contours: [contour], rotation }
}

function polar(radius: number, angle: number): Vec2 {
  return { x: radius * cos(angle), y: radius * sin(angle) }
}

/** Preserve PGF 3.1.11a's two different negative-angle rounding branches. */
export function restrictedBorderRotation(angle: number, normalizeNegative = false): number {
  let mod = angle % 360
  if (normalizeNegative && mod < 0) mod += 360
  const rounded = Math.trunc((Math.trunc(mod) + 45) / 90) * 90
  return rounded === 0 ? 0 : rounded < 0 ? rounded + 360 : rounded
}

function fitAxes(p: Parameters, x: number, y: number, normalizeNegative = false): { x: number; y: number; rotation: number } {
  if (p.borderUsesIncircle) {
    const radius = Math.SQRT2 * Math.max(x, y)
    return { x: radius, y: radius, rotation: p.borderRotate }
  }
  const rotation = restrictedBorderRotation(p.borderRotate, normalizeNegative)
  return rotation === 90 || rotation === 270 ? { x: y, y: x, rotation } : { x, y, rotation }
}

function trapezium(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  let { x, y } = fitAxes(p, initialX, initialY)
  const { rotation } = fitAxes(p, initialX, initialY)
  let left = 2 * y * cot(p.trapeziumLeftAngle)
  let right = 2 * y * cot(p.trapeziumRightAngle)
  if (y < input.minimumHeight / 2) {
    if (p.trapeziumStretches || p.trapeziumStretchesBody) y = input.minimumHeight / 2
    else {
      const factor = checkedRatio(input.minimumHeight / 2, y, input.unitScale)
      y = input.minimumHeight / 2
      x *= factor
      left *= factor
      right *= factor
    }
  }
  const width = 2 * x + Math.abs(left) + Math.abs(right)
  if (width < input.minimumWidth) {
    if (p.trapeziumStretchesBody) x += (input.minimumWidth - width) / 2
    else {
      const factor = checkedRatio(input.minimumWidth, width, input.unitScale)
      x *= factor
      left *= factor
      right *= factor
      if (!p.trapeziumStretches) y *= factor
    }
  }
  return single(polygonContour([
    { x: -x - Math.max(0, left), y: -y },
    { x: -x + Math.min(0, left), y },
    { x: x - Math.min(0, right), y },
    { x: x + Math.max(0, right), y: -y },
  ], rotation), rotation)
}

function triangle(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  const { x, y, rotation } = fitAxes(p, initialX, initialY, true)
  let halfAngle = p.isoscelesTriangleApexAngle / 2
  let length = p.borderUsesIncircle ? x * (1 + 1 / sin(halfAngle)) : 2 * x + cot(halfAngle) * y
  let halfWidth = p.borderUsesIncircle ? tan(halfAngle) * length : 2 * x * tan(halfAngle) + y
  if (length === 0) length = input.minimumHeight
  if (halfWidth < input.minimumWidth / 2) {
    halfWidth = input.minimumWidth / 2
    if (p.isoscelesTriangleStretches) halfAngle = Math.atan2(halfWidth, length) / degree
    else length = cot(halfAngle) * halfWidth
  }
  if (length < input.minimumHeight) {
    length = input.minimumHeight
    if (p.isoscelesTriangleStretches) halfAngle = Math.atan2(halfWidth, length) / degree
    else halfWidth = tan(halfAngle) * length
  }
  const offset = p.borderUsesIncircle
    ? length * sin(halfAngle) / (1 + sin(halfAngle))
    : x + ((halfWidth - y) * cos(halfAngle) - 2 * x * sin(halfAngle)) / (1 + sin(halfAngle))
  return single(polygonContour([{ x: length - offset, y: 0 }, { x: -offset, y: halfWidth }, { x: -offset, y: -halfWidth }], rotation), rotation)
}

function kite(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  const { x, y, rotation } = fitAxes(p, initialX, initialY)
  const a = p.kiteUpperVertexAngle / 2
  const b = p.kiteLowerVertexAngle / 2
  let height: number
  let depth: number
  let halfWidth: number
  let offset: number
  if (p.borderUsesIncircle) {
    offset = x / sin(a) - x * cot(a) * (sin(a) + sin(b)) / sin(a + b)
    height = x / sin(a) - offset
    depth = x / sin(b) + offset
    halfWidth = tan(a) * height
  } else {
    const upperBody = 2 * y * cos(a) * sin(b) / sin(a + b)
    offset = y - upperBody
    halfWidth = x + tan(a) * upperBody
    height = upperBody + cot(a) * x
    depth = 2 * y - upperBody + cot(b) * x
  }
  if (height + depth < input.minimumHeight) {
    const factor = checkedRatio(input.minimumHeight, height + depth, input.unitScale)
    halfWidth *= factor
    height *= factor
    depth *= factor
  }
  if (2 * halfWidth < input.minimumWidth) {
    const factor = checkedRatio(input.minimumWidth, 2 * halfWidth, input.unitScale)
    halfWidth *= factor
    height *= factor
    depth *= factor
  }
  // Upstream deliberately retains the pre-minimum diagonal-intersection offset.
  return single(polygonContour([
    { x: 0, y: offset + height }, { x: -halfWidth, y: offset },
    { x: 0, y: offset - depth }, { x: halfWidth, y: offset },
  ], rotation), rotation)
}

function dart(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  const axes = fitAxes(p, initialX, initialY)
  let x = axes.x
  const a = p.dartTipAngle / 2
  const b = p.dartTailAngle / 2
  let tipLength = p.borderUsesIncircle ? x * (cot(a) + 1) : cot(a) * axes.y + 2 * x
  let halfSeparation = tipLength * sin(a) * cos(a) / sin(b - a)
  const totalLength = cot(a) * halfSeparation
  let tailLength = totalLength - tipLength
  if (totalLength < input.minimumHeight) {
    const factor = checkedRatio(input.minimumHeight, totalLength, input.unitScale)
    tipLength *= factor
    tailLength *= factor
    halfSeparation *= factor
    x *= factor
  }
  if (halfSeparation < input.minimumWidth / 2) {
    const factor = checkedRatio(input.minimumWidth / 2, halfSeparation, input.unitScale)
    halfSeparation = input.minimumWidth / 2
    tipLength *= factor
    tailLength *= factor
    x *= factor
  }
  return single(polygonContour([
    { x: tipLength - x, y: 0 }, { x: -x - tailLength, y: halfSeparation },
    { x: -x, y: 0 }, { x: -x - tailLength, y: -halfSeparation },
  ], axes.rotation), axes.rotation)
}

function semicircle(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  const { x, y, rotation } = fitAxes(p, initialX, initialY)
  const defaultRadius = p.borderUsesIncircle ? 2 * x : Math.hypot(x, 2 * y)
  const radius = Math.max(defaultRadius, input.minimumWidth / 2, input.minimumHeight)
  const center = { x: 0, y: -y - 0.4 * (radius - defaultRadius) }
  return single(new ShapeContourBuilder(rotation)
    .move({ x: radius, y: center.y })
    .arc(center, radius, radius, 0, 180)
    .close().finish(), rotation)
}

function sector(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  const { x, y, rotation } = fitAxes(p, initialX, initialY)
  const half = p.circularSectorAngle / 2
  let offset = p.borderUsesIncircle ? x / sin(half) : cot(half) * y + x
  let radius = p.borderUsesIncircle ? offset + x : Math.hypot(offset + x, y)
  const axialWidth = Math.abs(offset / cos(half))
  if (axialWidth < input.minimumWidth / 2) {
    const factor = checkedRatio(input.minimumWidth / 2, axialWidth, input.unitScale)
    offset *= factor
    radius *= factor
  }
  if (radius < input.minimumHeight) {
    const factor = checkedRatio(input.minimumHeight, radius, input.unitScale)
    radius = input.minimumHeight
    offset *= factor
  }
  const center = { x: offset, y: 0 }
  return single(new ShapeContourBuilder(rotation)
    .move(center)
    .line(ellipsePoint(center, radius, radius, 180 - half))
    .arc(center, radius, radius, 180 - half, 180 + half)
    .close().finish(), rotation)
}

function cylinder(input: PointNodeShapeInput, p: Parameters, initialX: number, initialY: number): Construction {
  const { x, y, rotation } = fitAxes(p, initialX, initialY, true)
  const halfLineWidth = (input.lineWidth ?? 0.4) / 2
  let halfLength = x
  const rx = p.aspect * y
  const ry = Math.max(y, input.minimumWidth / 2)
  const innerYSep = !p.borderUsesIncircle && (rotation === 90 || rotation === 270) ? input.innerXSep : input.innerYSep
  const sineAngle = ry === 0 ? 0 : (ry - innerYSep) / ry
  const bodyExtension = rx * Math.sqrt(Math.max(0, 1 - sineAngle * sineAngle))
  const axialLength = halfLineWidth + 2 * halfLength + 3 * rx - bodyExtension
  if (axialLength < input.minimumHeight) halfLength += (input.minimumHeight - axialLength) / 2
  const endCenter = { x: halfLength + rx + halfLineWidth, y: 0 }
  const baseCenter = { x: -halfLength + bodyExtension, y: 0 }
  const top = { x: endCenter.x, y: ry }
  const bottom = { x: baseCenter.x, y: ry }
  const outline = new ShapeContourBuilder(rotation)
    .move(bottom).arc(baseCenter, rx, ry, 90, 270)
    .line({ x: top.x, y: -ry }).arc(endCenter, rx, ry, -90, 90)
    .close().finish()
  const seam = new ShapeContourBuilder(rotation).move(top).arc(endCenter, rx, ry, 90, 270).finish()
  const body = new ShapeContourBuilder(rotation)
    .move(bottom).arc(baseCenter, rx, ry, 90, 270)
    .line({ x: top.x, y: -ry }).arc(endCenter, rx, ry, 270, 90)
    .close().finish()
  const end = ellipseContour(rx, ry, endCenter, rotation)
  return { contours: [outline, seam], regions: [{ ...body, role: 'body' }, { ...end, role: 'end' }], rotation }
}

function unionBounds(bounds: readonly PointShapeBounds[]): PointShapeBounds {
  return {
    minX: Math.min(...bounds.map((item) => item.minX)),
    minY: Math.min(...bounds.map((item) => item.minY)),
    maxX: Math.max(...bounds.map((item) => item.maxX)),
    maxY: Math.max(...bounds.map((item) => item.maxY)),
  }
}

function clearanceBounds(input: PointNodeShapeInput, contour: PointShapeContour): PointShapeBounds {
  const { bounds } = contour
  const sep = Math.max(input.outerXSep, input.outerYSep)
  if (sep === 0) return { ...bounds }
  if (['ellipse', 'diamond', 'rectangle', 'circle'].includes(input.shape)) {
    const x = input.shape === 'circle' ? sep : input.outerXSep
    const y = input.shape === 'circle' ? sep : input.outerYSep
    return { minX: bounds.minX - x, minY: bounds.minY - y, maxX: bounds.maxX + x, maxY: bounds.maxY + y }
  }
  // Shape-specific polygon borders use miter clearance; a simple axis expansion
  // would understate e.g. the acute tip of a triangle, star, or circular sector.
  const points = contour.vertices
  const signedArea = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length]!
    return total + point.x * next.y - point.y * next.x
  }, 0)
  const orientation = signedArea < 0 ? -1 : 1
  const expanded = points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]!
    const next = points[(index + 1) % points.length]!
    const beforeLength = Math.hypot(point.x - previous.x, point.y - previous.y)
    const afterLength = Math.hypot(next.x - point.x, next.y - point.y)
    if (beforeLength === 0 || afterLength === 0) return point
    const a = { x: orientation * (point.y - previous.y) / beforeLength, y: orientation * (previous.x - point.x) / beforeLength }
    const b = { x: orientation * (next.y - point.y) / afterLength, y: orientation * (point.x - next.x) / afterLength }
    const denominator = 1 + a.x * b.x + a.y * b.y
    if (denominator < 1e-12) return point
    return { x: point.x + sep * (a.x + b.x) / denominator, y: point.y + sep * (a.y + b.y) / denominator }
  })
  return {
    minX: Math.min(bounds.minX - sep, ...expanded.map((point) => point.x)),
    minY: Math.min(bounds.minY - sep, ...expanded.map((point) => point.y)),
    maxX: Math.max(bounds.maxX + sep, ...expanded.map((point) => point.x)),
    maxY: Math.max(bounds.maxY + sep, ...expanded.map((point) => point.y)),
  }
}

function checkedRatio(numerator: number, denominator: number, unitScale = 1): number {
  if (denominator === 0) throw new RangeError('A zero-area body with zero separation cannot satisfy this shape minimum.')
  // PGF 3.1.11a uses its reciprocal macro here, not exact floating division.
  // For nonintegers <=100pt it deliberately retains only four decimal digits;
  // copying the formula with JS division visibly changes minimum-size fixtures.
  const value = texRound(denominator / unitScale)
  let reciprocal: number
  if (Number.isInteger(value)) reciprocal = Math.trunc(65536 / value) / 65536
  else if (value > 100) reciprocal = Math.trunc(Math.trunc(1e6 / value) * 65536 / 1e6) / 65536
  else {
    reciprocal = Math.trunc(10000 / value)
    for (let index = 0; index < 4; index += 1) reciprocal = Math.trunc(reciprocal * .1 * 65536) / 65536
  }
  return texRound(reciprocal * numerator / unitScale)
}

function texRound(value: number): number {
  return Math.round(value * 65536) / 65536
}

function validateInput(input: PointNodeShapeInput): void {
  if (!Number.isFinite(input.unitScale ?? 1) || (input.unitScale ?? 1) <= 0) throw new RangeError('Geometry unit scale must be positive and finite.')
  const lengths = [input.body.width, input.body.height, input.body.depth, input.innerXSep, input.innerYSep,
    input.outerXSep, input.outerYSep, input.minimumWidth, input.minimumHeight, input.lineWidth ?? 0.4]
  if (lengths.some((value) => !Number.isFinite(value) || value < 0 || value > 1e6)) {
    throw new RangeError('Shape lengths must be finite, nonnegative and at most 1000000 units.')
  }
}

function validateParameters(p: Parameters): void {
  if (Object.values(p).some((value) => typeof value === 'number' && !Number.isFinite(value))) throw new RangeError('Shape parameters must be finite.')
  if (p.aspect < 0.01 || p.aspect > 100) throw new RangeError('Shape aspect must be in [0.01, 100].')
  for (const count of [p.regularPolygonSides, p.starPoints]) {
    if (!Number.isInteger(count) || count < 3 || count > 64) throw new RangeError('Shape counts must be integers from 3 to 64.')
  }
  if (p.starPointRatio < 1 || p.starPointRatio > 100 || p.starPointHeight < 0 || p.starPointHeight > 1e6) throw new RangeError('Star radius parameters are outside the finite preview domain.')
  for (const angle of [p.trapeziumLeftAngle, p.trapeziumRightAngle, p.isoscelesTriangleApexAngle,
    p.kiteUpperVertexAngle, p.kiteLowerVertexAngle, p.dartTipAngle, p.dartTailAngle]) {
    if (angle < 1 || angle > 179) throw new RangeError('Vertex angles must lie between 1 and 179 degrees.')
  }
  if (p.dartTailAngle <= p.dartTipAngle) throw new RangeError('Dart tail angle must exceed its tip angle.')
  if (p.circularSectorAngle < 1 || p.circularSectorAngle > 179) throw new RangeError('Sector angle must lie between 1 and 179 degrees; reflex sectors do not preserve PGF body enclosure.')
  if (Math.abs(p.borderRotate) > 360_000) throw new RangeError('Border rotation must be within ±360000 degrees.')
}

function unsupportedShape(shape: never): never {
  throw new RangeError(`Unsupported point shape: ${String(shape as PointShape)}`)
}
