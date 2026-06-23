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

export type SvgArrowheadPreview = {
  kind: 'endpoint' | 'mid'
  tip: Vec2
  left: Vec2
  right: Vec2
  color: string
  opacity: number
  head: ArrowHeadKind | 'endpoint'
}

type MeasuredPolyline = {
  points: Vec2[]
  cumulativeLengths: number[]
  totalLength: number
}

const cubicSampleCount = 24
const arcSampleCount = 32
const templateSampleCount = 72
const minArrowProbeLength = 1e-6

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
  const tip = pointAtDistance(measured, distance)
  const before = pointAtDistance(
    measured,
    Math.max(0, distance - tangentProbeLength(measured, lineWidth)),
  )
  const after = pointAtDistance(
    measured,
    Math.min(measured.totalLength, distance + tangentProbeLength(measured, lineWidth)),
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

  const length = arrowheadLength(lineWidth)
  const width = length * 0.62
  const perpendicular = { x: -unit.y, y: unit.x }
  const base = {
    x: tip.x - unit.x * length,
    y: tip.y - unit.y * length,
  }
  const left = {
    x: base.x + perpendicular.x * width * 0.5,
    y: base.y + perpendicular.y * width * 0.5,
  }
  const right = {
    x: base.x - perpendicular.x * width * 0.5,
    y: base.y - perpendicular.y * width * 0.5,
  }

  if (![tip, left, right].every(isFiniteVec2)) {
    return null
  }

  return {
    kind,
    tip,
    left,
    right,
    color,
    opacity,
    head,
  }
}

function tangentProbeLength(
  measured: MeasuredPolyline,
  lineWidth: number,
): number {
  return Math.max(
    minArrowProbeLength,
    Math.min(measured.totalLength / 3, arrowheadLength(lineWidth)),
  )
}

function arrowheadLength(lineWidth: number): number {
  return Math.max(7, Math.min(18, 7 + lineWidth * 2.2))
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
