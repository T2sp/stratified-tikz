import {
  pathSegmentPointAt,
  resolvePathSegmentStyle,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import {
  isValidMidArrowPosition,
  resolvePathArrowOptions,
} from '../model/pathArrows.ts'
import type {
  AmbientDimension,
  ArrowHeadKind,
  CurveStratum,
  MidArrowDirection,
  PathSegment,
  Vec2,
  Vec3,
} from '../model/types.ts'
import { svgPoint } from './svgPath.ts'

export type SvgArrowheadPreview = {
  kind: 'endpoint' | 'mid'
  tip: Vec2
  left: Vec2
  right: Vec2
  points: Vec2[]
  pathData: string
  color: string
  opacity: number
  head: ArrowHeadKind | 'endpoint'
  shape: ArrowHeadKind
  className: string
  angleRadians: number
  length: number
  strokeWidth: number
}

type MeasuredPolyline = {
  points: Vec2[]
  cumulativeLengths: number[]
  totalLength: number
}

type ArrowheadShapeGeometry = {
  points: Vec2[]
  pathData: string
  left: Vec2
  right: Vec2
  length: number
  strokeWidth: number
}

const cubicSampleCount = 24
const arcSampleCount = 32
const templateSampleCount = 72
const minArrowProbeLength = 1e-6
const defaultArrowLineWidth = 1.2

export function curveArrowheadsForSvgPreview(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  project: (point: Vec3) => Vec2,
): SvgArrowheadPreview[] {
  if (curve.kind === 'grid') {
    return []
  }

  const arrows = resolvePathArrowOptions(curve.arrows)
  const projectedSamples = curveSamplePoints(curve, ambientDimension).map(project)

  if (
    projectedSamples.length < 2 ||
    projectedSamples.some((point) => !isFiniteVec2(point))
  ) {
    return []
  }

  const measured = measurePolyline(projectedSamples)

  if (measured === null) {
    return []
  }

  const previews: SvgArrowheadPreview[] = []

  if (arrows.endpoint === 'forward' || arrows.endpoint === 'both') {
    const arrowhead = arrowheadAtDistance({
      measured,
      distance: measured.totalLength,
      direction: 'forward',
      color: curve.style.strokeColor,
      opacity: curve.style.strokeOpacity,
      lineWidth: curve.style.lineWidth,
      kind: 'endpoint',
      head: 'endpoint',
    })

    if (arrowhead !== null) {
      previews.push(arrowhead)
    }
  }

  if (arrows.endpoint === 'backward' || arrows.endpoint === 'both') {
    const arrowhead = arrowheadAtDistance({
      measured,
      distance: 0,
      direction: 'backward',
      color: curve.style.strokeColor,
      opacity: curve.style.strokeOpacity,
      lineWidth: curve.style.lineWidth,
      kind: 'endpoint',
      head: 'endpoint',
    })

    if (arrowhead !== null) {
      previews.push(arrowhead)
    }
  }

  if (arrows.mid.enabled && isValidMidArrowPosition(arrows.mid.position)) {
    const style =
      curve.kind === 'concatenatedPath'
        ? curveStyleAtPosition(
            curve.segments,
            curve.style,
            ambientDimension,
            arrows.mid.position,
          )
        : curve.style
    const arrowhead = arrowheadAtDistance({
      measured,
      distance: measured.totalLength * arrows.mid.position,
      direction: arrows.mid.direction,
      color: style.strokeColor,
      opacity: style.strokeOpacity,
      lineWidth: style.lineWidth,
      kind: 'mid',
      head: arrows.mid.head,
    })

    if (arrowhead !== null) {
      previews.push(arrowhead)
    }
  }

  return previews
}

function curveSamplePoints(
  curve: Exclude<CurveStratum, Extract<CurveStratum, { kind: 'grid' }>>,
  ambientDimension: AmbientDimension,
): Vec3[] {
  switch (curve.kind) {
    case 'polyline':
      return curve.points
    case 'cubicBezier':
      if (curve.points.length !== 4) {
        return []
      }

      return samplePathSegment(
        {
          kind: 'cubicBezier',
          start: curve.points[0],
          control1: curve.points[1],
          control2: curve.points[2],
          end: curve.points[3],
        },
        ambientDimension,
        cubicSampleCount,
      )
    case 'concatenatedPath':
      return curve.segments.flatMap((segment, segmentIndex) => {
        const samples = samplePathSegment(
          segment,
          ambientDimension,
          segment.kind === 'arc' ? arcSampleCount : cubicSampleCount,
        )

        return segmentIndex === 0 ? samples : samples.slice(1)
      })
    case 'templatePath':
      return sampleTemplatePathPoints(
        curve.template,
        ambientDimension,
        templateSampleCount,
      )
  }
}

function samplePathSegment(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
  sampleCount: number,
): Vec3[] {
  const count = segment.kind === 'line' ? 1 : sampleCount
  const samples: Vec3[] = []

  for (let index = 0; index <= count; index += 1) {
    const point = pathSegmentPointAt(segment, index / count, ambientDimension)

    if (point === null) {
      return []
    }

    samples.push(point)
  }

  return samples
}

function curveStyleAtPosition(
  segments: readonly PathSegment[],
  baseStyle: CurveStratum['style'],
  ambientDimension: AmbientDimension,
  position: number,
): CurveStratum['style'] {
  const segmentIndex = pathSegmentIndexAtPosition(
    segments,
    ambientDimension,
    position,
  )
  const segment = segments[segmentIndex]

  return segment === undefined
    ? baseStyle
    : resolvePathSegmentStyle(baseStyle, segment)
}

function pathSegmentIndexAtPosition(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
  position: number,
): number {
  const lengths = segments.map((segment) =>
    measuredSegmentLength(segment, ambientDimension),
  )
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return 0
  }

  const targetLength = totalLength * position
  let accumulated = 0

  for (let index = 0; index < lengths.length; index += 1) {
    accumulated += lengths[index]

    if (targetLength <= accumulated) {
      return index
    }
  }

  return Math.max(0, lengths.length - 1)
}

function measuredSegmentLength(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
): number {
  const samples = samplePathSegment(
    segment,
    ambientDimension,
    segment.kind === 'arc' ? arcSampleCount : cubicSampleCount,
  )

  return measureModelPolylineLength(samples)
}

function measureModelPolylineLength(points: readonly Vec3[]): number {
  let total = 0

  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
      points[index].z - points[index - 1].z,
    )
  }

  return total
}

function measurePolyline(points: readonly Vec2[]): MeasuredPolyline | null {
  const cumulativeLengths = [0]
  let totalLength = 0

  for (let index = 1; index < points.length; index += 1) {
    totalLength += distance2(points[index - 1], points[index])
    cumulativeLengths.push(totalLength)
  }

  return Number.isFinite(totalLength) && totalLength > 0
    ? {
        points: [...points],
        cumulativeLengths,
        totalLength,
      }
    : null
}

function arrowheadAtDistance({
  measured,
  distance,
  direction,
  color,
  opacity,
  lineWidth,
  kind,
  head,
}: {
  measured: MeasuredPolyline
  distance: number
  direction: MidArrowDirection
  color: string
  opacity: number
  lineWidth: number
  kind: SvgArrowheadPreview['kind']
  head: SvgArrowheadPreview['head']
}): SvgArrowheadPreview | null {
  const shape = arrowheadShape(head)
  const probeLength = tangentProbeLength(measured, lineWidth, shape)
  const tip = pointAtDistance(measured, distance)
  const before = pointAtDistance(
    measured,
    Math.max(0, distance - probeLength),
  )
  const after = pointAtDistance(
    measured,
    Math.min(measured.totalLength, distance + probeLength),
  )

  if (tip === null || before === null || after === null) {
    return null
  }

  const forwardVector =
    distance >= measured.totalLength
      ? subtract2(tip, before)
      : distance <= 0
        ? subtract2(after, tip)
        : subtract2(after, before)
  const directionVector =
    direction === 'forward'
      ? forwardVector
      : { x: -forwardVector.x, y: -forwardVector.y }
  const unit = normalize2(directionVector)

  if (unit === null) {
    return null
  }

  const geometry = arrowheadShapeGeometry(tip, unit, lineWidth, shape)

  if (!geometry.points.every(isFiniteVec2)) {
    return null
  }

  return {
    kind,
    tip,
    left: geometry.left,
    right: geometry.right,
    points: geometry.points,
    pathData: geometry.pathData,
    color,
    opacity,
    head,
    shape,
    className: `svg-arrowhead-preview svg-arrowhead-preview--${shape}`,
    angleRadians: Math.atan2(unit.y, unit.x),
    length: geometry.length,
    strokeWidth: geometry.strokeWidth,
  }
}

function tangentProbeLength(
  measured: MeasuredPolyline,
  lineWidth: number,
  shape: ArrowHeadKind,
): number {
  return Math.max(
    minArrowProbeLength,
    Math.min(measured.totalLength / 3, arrowheadLength(lineWidth, shape)),
  )
}

function arrowheadShape(head: SvgArrowheadPreview['head']): ArrowHeadKind {
  return head === 'endpoint' ? 'standard' : head
}

function arrowheadShapeGeometry(
  tip: Vec2,
  unit: Vec2,
  lineWidth: number,
  shape: ArrowHeadKind,
): ArrowheadShapeGeometry {
  const length = arrowheadLength(lineWidth, shape)
  const width = arrowheadWidth(length, shape)
  const perpendicular = { x: -unit.y, y: unit.x }
  const strokeWidth = arrowheadStrokeWidth(lineWidth)

  switch (shape) {
    case 'standard': {
      const left = pointBehind(tip, unit, perpendicular, length, width * 0.5)
      const right = pointBehind(tip, unit, perpendicular, length, -width * 0.5)
      const points = [tip, left, right]

      return {
        points,
        pathData: closedPath(points),
        left,
        right,
        length,
        strokeWidth,
      }
    }
    case 'stealth': {
      const left = pointBehind(tip, unit, perpendicular, length, width * 0.5)
      const notch = pointBehind(tip, unit, perpendicular, length * 0.68, 0)
      const right = pointBehind(tip, unit, perpendicular, length, -width * 0.5)
      const points = [tip, left, notch, right]

      return {
        points,
        pathData: closedPath(points),
        left,
        right,
        length,
        strokeWidth,
      }
    }
    case 'latex': {
      const shoulderBack = length * 0.74
      const left = pointBehind(
        tip,
        unit,
        perpendicular,
        shoulderBack,
        width * 0.5,
      )
      const tail = pointBehind(tip, unit, perpendicular, length, 0)
      const right = pointBehind(
        tip,
        unit,
        perpendicular,
        shoulderBack,
        -width * 0.5,
      )
      const points = [tip, left, tail, right]

      return {
        points,
        pathData: closedPath(points),
        left,
        right,
        length,
        strokeWidth,
      }
    }
    case 'stealthHarpoon': {
      return harpoonShapeGeometry(
        tip,
        unit,
        perpendicular,
        length,
        width,
        1,
        strokeWidth,
      )
    }
    case 'stealthHarpoonSwap': {
      return harpoonShapeGeometry(
        tip,
        unit,
        perpendicular,
        length,
        width,
        -1,
        strokeWidth,
      )
    }
  }
}

function harpoonShapeGeometry(
  tip: Vec2,
  unit: Vec2,
  perpendicular: Vec2,
  length: number,
  width: number,
  side: 1 | -1,
  strokeWidth: number,
): ArrowheadShapeGeometry {
  const sidePoint = pointBehind(
    tip,
    unit,
    perpendicular,
    length,
    side * width * 0.5,
  )
  const notch = pointBehind(tip, unit, perpendicular, length * 0.68, 0)
  const tail = pointBehind(tip, unit, perpendicular, length, 0)
  const points =
    side === 1
      ? [tip, sidePoint, notch, tail]
      : [tip, tail, notch, sidePoint]
  const left = side === 1 ? sidePoint : tail
  const right = side === 1 ? tail : sidePoint

  return {
    points,
    pathData: closedPath(points),
    left,
    right,
    length,
    strokeWidth,
  }
}

function arrowheadLength(lineWidth: number, shape: ArrowHeadKind): number {
  const base = Math.max(7, Math.min(18, 7 + safeLineWidth(lineWidth) * 2.2))

  switch (shape) {
    case 'standard':
      return base
    case 'stealth':
      return base * 1.12
    case 'latex':
      return base * 1.18
    case 'stealthHarpoon':
    case 'stealthHarpoonSwap':
      return base * 1.12
  }
}

function arrowheadWidth(length: number, shape: ArrowHeadKind): number {
  switch (shape) {
    case 'standard':
      return length * 0.5
    case 'stealth':
      return length * 0.78
    case 'latex':
      return length * 0.46
    case 'stealthHarpoon':
    case 'stealthHarpoonSwap':
      return length * 0.78
  }
}

function arrowheadStrokeWidth(lineWidth: number): number {
  return Math.max(0.7, Math.min(1.8, safeLineWidth(lineWidth) * 0.35))
}

function safeLineWidth(lineWidth: number): number {
  return Number.isFinite(lineWidth) && lineWidth > 0
    ? lineWidth
    : defaultArrowLineWidth
}

function pointBehind(
  tip: Vec2,
  unit: Vec2,
  perpendicular: Vec2,
  distance: number,
  offset: number,
): Vec2 {
  return {
    x: tip.x - unit.x * distance + perpendicular.x * offset,
    y: tip.y - unit.y * distance + perpendicular.y * offset,
  }
}

function closedPath(points: readonly Vec2[]): string {
  const [firstPoint, ...restPoints] = points

  return firstPoint === undefined
    ? ''
    : [
        `M ${svgPoint(firstPoint)}`,
        ...restPoints.map((point) => `L ${svgPoint(point)}`),
        'Z',
      ].join(' ')
}

function pointAtDistance(
  measured: MeasuredPolyline,
  distance: number,
): Vec2 | null {
  if (!Number.isFinite(distance)) {
    return null
  }

  if (distance <= 0) {
    return measured.points[0]
  }

  if (distance >= measured.totalLength) {
    return measured.points[measured.points.length - 1]
  }

  for (let index = 1; index < measured.points.length; index += 1) {
    const previousLength = measured.cumulativeLengths[index - 1]
    const nextLength = measured.cumulativeLengths[index]

    if (distance > nextLength) {
      continue
    }

    const segmentLength = nextLength - previousLength

    if (segmentLength <= 0) {
      continue
    }

    const local = (distance - previousLength) / segmentLength

    return {
      x:
        measured.points[index - 1].x +
        (measured.points[index].x - measured.points[index - 1].x) * local,
      y:
        measured.points[index - 1].y +
        (measured.points[index].y - measured.points[index - 1].y) * local,
    }
  }

  return measured.points[measured.points.length - 1]
}

function subtract2(first: Vec2, second: Vec2): Vec2 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
  }
}

function normalize2(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector.x, vector.y)

  return Number.isFinite(length) && length > 0
    ? {
        x: vector.x / length,
        y: vector.y / length,
      }
    : null
}

function distance2(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
