import {
  addVec3,
  dot,
  isFiniteVec3,
  scaleVec3,
  subtractVec3,
} from '../geometry/workPlane.ts'
import {
  isValidWorkPlaneFrameSnapshot,
  workPlaneLocalCoordinateFromPoint,
} from '../geometry/bezierControls.ts'
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

/**
 * Keeps a filled sheet's stored basis while moving its derived plane origin to
 * a parallel boundary plane. Symbolic boundary previews can move uniformly in
 * the normal direction when variables are updated, while the stored frame is a
 * concrete snapshot. A tilted or non-planar boundary is deliberately left for
 * validation to reject.
 */
export function reanchorWorkPlaneFrameToClosedPathBoundaries(
  frame: WorkPlaneFrameSnapshot,
  boundaries: readonly ClosedPathBoundary[],
  epsilon = pathEndpointEpsilon,
): WorkPlaneFrameSnapshot {
  if (!isValidWorkPlaneFrameSnapshot(frame)) {
    return frame
  }

  const points = boundaries.flatMap(closedPathBoundaryCoordinates)
  const firstPoint = points[0]

  if (firstPoint === undefined || !points.every(isFiniteVec3)) {
    return frame
  }

  const signedDistance = pointPlaneSignedDistance(frame, firstPoint)

  if (
    !Number.isFinite(signedDistance) ||
    points.some(
      (point) =>
        Math.abs(pointPlaneSignedDistance(frame, point) - signedDistance) >
        epsilon,
    )
  ) {
    return frame
  }

  if (Math.abs(signedDistance) <= epsilon) {
    return frame
  }

  const origin = addVec3(
    frame.origin,
    scaleVec3(frame.normal, signedDistance),
  )

  return isFiniteVec3(origin)
    ? {
        ...frame,
        // planeFrame is derived geometry; do not retain stale symbolic
        // metadata from an origin that had to be reconciled.
        origin,
      }
    : frame
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
