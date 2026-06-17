import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import type {
  AmbientDimension,
  ConcatenatedPathStratum,
  CubicBezierControlMode,
  CubicBezierPathSegment,
  LinePathSegment,
  PathSegment,
  Vec3,
} from './types.ts'

export const pathEndpointEpsilon = 1e-9

export type PathEndpointPair = {
  start: Vec3
  end: Vec3
}

export function pathSegmentsFromPolyline(
  points: readonly Vec3[],
): LinePathSegment[] {
  if (points.length < 2) {
    return []
  }

  return points.slice(0, -1).map((point, index) => ({
    kind: 'line',
    start: cloneVec3(point),
    end: cloneVec3(points[index + 1]),
  }))
}

export function pathSegmentsFromCubicBezier(
  points: readonly Vec3[],
  controlMode?: CubicBezierControlMode,
): CubicBezierPathSegment[] {
  if (points.length !== 4) {
    return []
  }

  return [
    {
      kind: 'cubicBezier',
      start: cloneVec3(points[0]),
      control1: cloneVec3(points[1]),
      control2: cloneVec3(points[2]),
      end: cloneVec3(points[3]),
      ...(controlMode === undefined
        ? {}
        : { controlMode: cloneCubicBezierControlMode(controlMode) }),
    },
  ]
}

export function pathEndpoints(
  segments: readonly PathSegment[],
): PathEndpointPair | null {
  if (segments.length === 0) {
    return null
  }

  return {
    start: cloneVec3(pathSegmentStart(segments[0])),
    end: cloneVec3(pathSegmentEnd(segments[segments.length - 1])),
  }
}

export function areSegmentsComposable(
  segments: readonly PathSegment[],
  epsilon = pathEndpointEpsilon,
): boolean {
  for (let index = 1; index < segments.length; index += 1) {
    if (
      !vec3ApproximatelyEqual(
        pathSegmentEnd(segments[index - 1]),
        pathSegmentStart(segments[index]),
        epsilon,
      )
    ) {
      return false
    }
  }

  return true
}

export function normalizePathForAmbientDimension(
  path: ConcatenatedPathStratum,
  ambientDimension: AmbientDimension,
): ConcatenatedPathStratum {
  return {
    ...path,
    codim: ambientDimension === 2 ? 1 : 2,
    segments: normalizePathSegmentsForAmbientDimension(
      path.segments,
      ambientDimension,
    ),
  }
}

export function normalizePathSegmentsForAmbientDimension(
  segments: readonly PathSegment[],
  ambientDimension: AmbientDimension,
): PathSegment[] {
  return segments.map((segment) => normalizePathSegment(segment, ambientDimension))
}

export function pathSegmentStart(segment: PathSegment): Vec3 {
  return segment.start
}

export function pathSegmentEnd(segment: PathSegment): Vec3 {
  return segment.end
}

export function pathSegmentCoordinates(segment: PathSegment): Vec3[] {
  switch (segment.kind) {
    case 'line':
      return [segment.start, segment.end]
    case 'cubicBezier':
      return [segment.start, segment.control1, segment.control2, segment.end]
  }
}

export function pathCoordinates(segments: readonly PathSegment[]): Vec3[] {
  return segments.flatMap(pathSegmentCoordinates)
}

function normalizePathSegment(
  segment: PathSegment,
  ambientDimension: AmbientDimension,
): PathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: normalizePointForAmbientDimension(ambientDimension, segment.start),
        end: normalizePointForAmbientDimension(ambientDimension, segment.end),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: normalizePointForAmbientDimension(ambientDimension, segment.start),
        control1: normalizePointForAmbientDimension(
          ambientDimension,
          segment.control1,
        ),
        control2: normalizePointForAmbientDimension(
          ambientDimension,
          segment.control2,
        ),
        end: normalizePointForAmbientDimension(ambientDimension, segment.end),
        ...(segment.controlMode === undefined
          ? {}
          : { controlMode: cloneCubicBezierControlMode(segment.controlMode) }),
      }
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return { ...point }
}

function cloneCubicBezierControlMode(
  controlMode: CubicBezierControlMode,
): CubicBezierControlMode {
  switch (controlMode.kind) {
    case 'absolute':
      return { kind: 'absolute' }
    case 'relativeCartesian':
      return {
        kind: 'relativeCartesian',
        firstControlOffset: cloneVec3(controlMode.firstControlOffset),
        secondControlOffset: cloneVec3(controlMode.secondControlOffset),
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'relativePolar':
      return {
        kind: 'relativePolar',
        firstControl: { ...controlMode.firstControl },
        secondControl: { ...controlMode.secondControl },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'workPlaneRelativeCartesian':
      return {
        kind: 'workPlaneRelativeCartesian',
        frame: {
          origin: cloneVec3(controlMode.frame.origin),
          u: cloneVec3(controlMode.frame.u),
          v: cloneVec3(controlMode.frame.v),
          normal: cloneVec3(controlMode.frame.normal),
        },
        localStart: { ...controlMode.localStart },
        localEnd: { ...controlMode.localEnd },
        firstControlOffset: { ...controlMode.firstControlOffset },
        secondControlOffset: { ...controlMode.secondControlOffset },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
    case 'workPlaneRelativePolar':
      return {
        kind: 'workPlaneRelativePolar',
        frame: {
          origin: cloneVec3(controlMode.frame.origin),
          u: cloneVec3(controlMode.frame.u),
          v: cloneVec3(controlMode.frame.v),
          normal: cloneVec3(controlMode.frame.normal),
        },
        localStart: { ...controlMode.localStart },
        localEnd: { ...controlMode.localEnd },
        firstControl: { ...controlMode.firstControl },
        secondControl: { ...controlMode.secondControl },
        secondOffsetReference: controlMode.secondOffsetReference,
      }
  }
}

function vec3ApproximatelyEqual(
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
