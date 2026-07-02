import {
  pathSegmentPointAt,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
} from '../model/paths.ts'
import type {
  AmbientDimension,
  Camera,
  CurveStratum,
  PathSegment,
  Vec2,
} from '../model/types.ts'
import { projectToSvgPoint } from './svgProjection.ts'

export type SvgPathSplitPickTarget = {
  segmentIndex: number
  t: number
  distance: number
}

const sampledSegmentCount = 64
const interiorParameterEpsilon = 1e-6

export function pathSplitTargetFromSvgPoint(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  camera: Camera,
  viewportHeight: number,
  svgPoint: Vec2,
): SvgPathSplitPickTarget | null {
  const segments = pathSegmentsForSplitPicking(curve)

  if (segments.length === 0) {
    return null
  }

  const candidates = segments.flatMap((segment, segmentIndex) => {
    const candidate =
      segment.kind === 'line'
        ? closestLineSegmentParameter(segment, camera, viewportHeight, svgPoint)
        : closestSampledSegmentParameter(
            segment,
            ambientDimension,
            camera,
            viewportHeight,
            svgPoint,
          )

    return candidate === null
      ? []
      : [
          {
            segmentIndex,
            t: candidate.t,
            distance: candidate.distance,
          },
        ]
  })

  return candidates
    .filter((candidate) => isInteriorParameter(candidate.t))
    .sort((left, right) => left.distance - right.distance)[0] ?? null
}

function pathSegmentsForSplitPicking(curve: CurveStratum): PathSegment[] {
  switch (curve.kind) {
    case 'polyline':
      return pathSegmentsFromPolyline(curve.points)
    case 'cubicBezier':
      return pathSegmentsFromCubicBezier(curve.points, curve.bezierControls)
    case 'concatenatedPath':
      return curve.segments
    case 'templatePath':
    case 'grid':
      return []
  }
}

function closestLineSegmentParameter(
  segment: Extract<PathSegment, { kind: 'line' }>,
  camera: Camera,
  viewportHeight: number,
  svgPoint: Vec2,
): { t: number; distance: number } | null {
  const start = projectToSvgPoint(camera, segment.start, viewportHeight)
  const end = projectToSvgPoint(camera, segment.end, viewportHeight)

  return closestParameterOnSvgSegment(svgPoint, start, end)
}

function closestSampledSegmentParameter(
  segment: Exclude<PathSegment, Extract<PathSegment, { kind: 'line' }>>,
  ambientDimension: AmbientDimension,
  camera: Camera,
  viewportHeight: number,
  svgPoint: Vec2,
): { t: number; distance: number } | null {
  const samples = Array.from({ length: sampledSegmentCount + 1 }, (_, index) => {
    const t = index / sampledSegmentCount
    const point = pathSegmentPointAt(segment, t, ambientDimension)

    return point === null
      ? null
      : {
          t,
          svgPoint: projectToSvgPoint(camera, point, viewportHeight),
        }
  })
  const candidates = samples.slice(0, -1).flatMap((sample, index) => {
    const next = samples[index + 1]

    if (sample === null || next === null) {
      return []
    }

    const local = closestParameterOnSvgSegment(
      svgPoint,
      sample.svgPoint,
      next.svgPoint,
    )

    return local === null
      ? []
      : [
          {
            t: sample.t + (next.t - sample.t) * local.t,
            distance: local.distance,
          },
        ]
  })

  return candidates.sort((left, right) => left.distance - right.distance)[0] ?? null
}

function closestParameterOnSvgSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
): { t: number; distance: number } | null {
  if (!isFiniteVec2(start) || !isFiniteVec2(end)) {
    return null
  }

  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy

  if (!Number.isFinite(lengthSquared) || lengthSquared <= 0) {
    return null
  }

  const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  const t = Math.min(1, Math.max(0, rawT))
  const closest = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  }

  return {
    t,
    distance: distanceVec2(point, closest),
  }
}

function isInteriorParameter(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > interiorParameterEpsilon &&
    value < 1 - interiorParameterEpsilon
  )
}

function distanceVec2(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
