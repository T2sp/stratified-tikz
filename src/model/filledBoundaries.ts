import {
  dot,
  isFiniteVec3,
  subtractVec3,
} from '../geometry/workPlane.ts'
import { workPlaneLocalCoordinateFromPoint } from '../geometry/bezierControls.ts'
import {
  areSegmentsComposable,
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
  pathEndpointEpsilon,
  pathEndpoints,
} from './paths.ts'
import { fillRules } from './types.ts'
import type {
  AmbientDimension,
  ClosedPathBoundary,
  FillRule,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
} from './types.ts'

export function isFillRule(value: unknown): value is FillRule {
  return (
    typeof value === 'string' &&
    (fillRules as readonly string[]).includes(value)
  )
}

export function cloneClosedPathBoundary(
  boundary: ClosedPathBoundary,
): ClosedPathBoundary {
  return {
    id: boundary.id,
    ...(boundary.name === undefined ? {} : { name: boundary.name }),
    segments: normalizePathSegmentsForAmbientDimension(boundary.segments, 3),
  }
}

export function normalizeClosedPathBoundariesForAmbientDimension(
  boundaries: readonly ClosedPathBoundary[],
  ambientDimension: AmbientDimension,
): ClosedPathBoundary[] {
  return boundaries.map((boundary) => ({
    id: boundary.id,
    ...(boundary.name === undefined ? {} : { name: boundary.name }),
    segments: normalizePathSegmentsForAmbientDimension(
      boundary.segments,
      ambientDimension,
    ),
  }))
}

export function closedPathBoundaryCoordinates(
  boundary: ClosedPathBoundary,
): Vec3[] {
  return pathCoordinates(boundary.segments)
}

export function isClosedPathBoundary(
  boundary: ClosedPathBoundary,
  epsilon = pathEndpointEpsilon,
): boolean {
  const endpoints = pathEndpoints(boundary.segments)

  return (
    endpoints !== null &&
    areSegmentsComposable(boundary.segments, epsilon) &&
    pointsApproximatelyEqual(endpoints.start, endpoints.end, epsilon)
  )
}

export function pointPlaneSignedDistance(
  frame: WorkPlaneFrameSnapshot,
  point: Vec3,
): number {
  return dot(subtractVec3(point, frame.origin), frame.normal)
}

export function isPointOnWorkPlaneFrame(
  point: Vec3,
  frame: WorkPlaneFrameSnapshot,
  epsilon = pathEndpointEpsilon,
): boolean {
  const distance = pointPlaneSignedDistance(frame, point)

  return Number.isFinite(distance) && Math.abs(distance) <= epsilon
}

export function workPlaneLocalCoordinatesForBoundary(
  boundary: ClosedPathBoundary,
  frame: WorkPlaneFrameSnapshot,
  epsilon = pathEndpointEpsilon,
): WorkPlaneLocalCoordinate[] | null {
  const coordinates: WorkPlaneLocalCoordinate[] = []

  for (const point of closedPathBoundaryCoordinates(boundary)) {
    if (
      !isFiniteVec3(point) ||
      !isPointOnWorkPlaneFrame(point, frame, epsilon)
    ) {
      return null
    }

    const localCoordinate = workPlaneLocalCoordinateFromPoint(frame, point)

    if (
      !Number.isFinite(localCoordinate.a) ||
      !Number.isFinite(localCoordinate.b)
    ) {
      return null
    }

    coordinates.push(localCoordinate)
  }

  return coordinates
}

function pointsApproximatelyEqual(
  first: Vec3,
  second: Vec3,
  epsilon: number,
): boolean {
  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon &&
    Math.abs(first.z - second.z) <= epsilon
  )
}
