import { pathIntersectionCandidatesForDiagram } from './pathIntersections.ts'
import type {
  CrossingKind,
  CurveStratum,
  Diagram,
  PathIntersectionCandidate,
  PathCrossingState,
  Vec2,
  Vec3,
} from '../model/types.ts'

export const defaultPathCrossingOverlaySegmentLength = 0.24

export type PathCrossingOverlayOptions = {
  includeCurve?: (curve: CurveStratum) => boolean
  segmentLength?: number
}

export type PathCrossingOverlaySegment = {
  pathId: string
  parameter: number
  tangent: Vec2
  start: Vec3
  end: Vec3
}

export type PathCrossingOverlay = {
  crossingId: string
  kind: Exclude<CrossingKind, 'none'>
  point: Vec3
  pathAId: string
  pathBId: string
  overPathId: string
  underPathId: string
  underMask: PathCrossingOverlaySegment
  overRedraw: PathCrossingOverlaySegment
}

const minimumOverlaySegmentLength = 1e-6
const minimumTangentLength = 1e-9

export function pathCrossingOverlaysForDiagram(
  diagram: Diagram,
  options: PathCrossingOverlayOptions = {},
): PathCrossingOverlay[] {
  if (diagram.ambientDimension !== 2 || diagram.pathCrossings === undefined) {
    return []
  }

  const segmentLength = normalizeOverlaySegmentLength(options.segmentLength)
  const candidates = pathIntersectionCandidatesForDiagram(diagram, {
    ...(options.includeCurve === undefined
      ? {}
      : { includeCurve: options.includeCurve }),
  })

  return diagram.pathCrossings.flatMap((state) => {
    if (state.kind === 'none') {
      return []
    }

    const candidate = currentCandidateForState(candidates, state)

    if (candidate === null) {
      return []
    }

    const overlay = pathCrossingOverlayFromCandidate(
      state.kind,
      candidate,
      segmentLength,
    )

    return overlay === null ? [] : [overlay]
  })
}

function pathCrossingOverlayFromCandidate(
  kind: Exclude<CrossingKind, 'none'>,
  candidate: PathIntersectionCandidate,
  segmentLength: number,
): PathCrossingOverlay | null {
  const overPathId =
    kind === 'braiding' ? candidate.pathAId : candidate.pathBId
  const underPathId =
    kind === 'braiding' ? candidate.pathBId : candidate.pathAId
  const overParameter =
    kind === 'braiding' ? candidate.parameterA : candidate.parameterB
  const underParameter =
    kind === 'braiding' ? candidate.parameterB : candidate.parameterA
  const overTangent =
    kind === 'braiding' ? candidate.tangentA : candidate.tangentB
  const underTangent =
    kind === 'braiding' ? candidate.tangentB : candidate.tangentA
  const overRedraw = segmentAroundPoint({
    pathId: overPathId,
    parameter: overParameter,
    point: candidate.point,
    tangent: overTangent,
    segmentLength,
  })
  const underMask = segmentAroundPoint({
    pathId: underPathId,
    parameter: underParameter,
    point: candidate.point,
    tangent: underTangent,
    segmentLength,
  })

  if (overRedraw === null || underMask === null) {
    return null
  }

  return {
    crossingId: candidate.id,
    kind,
    point: cloneFinitePoint(candidate.point),
    pathAId: candidate.pathAId,
    pathBId: candidate.pathBId,
    overPathId,
    underPathId,
    underMask,
    overRedraw,
  }
}

function currentCandidateForState(
  candidates: readonly PathIntersectionCandidate[],
  state: PathCrossingState,
): PathIntersectionCandidate | null {
  return (
    candidates.find(
      (candidate) =>
        candidate.id === state.id &&
        candidate.pathAId === state.pathAId &&
        candidate.pathBId === state.pathBId,
    ) ?? null
  )
}

function segmentAroundPoint({
  pathId,
  parameter,
  point,
  tangent,
  segmentLength,
}: {
  pathId: string
  parameter: number
  point: Vec3
  tangent: Vec2
  segmentLength: number
}): PathCrossingOverlaySegment | null {
  if (!isFiniteVec3(point) || !Number.isFinite(parameter)) {
    return null
  }

  const unitTangent = normalizeVec2(tangent)

  if (unitTangent === null) {
    return null
  }

  const halfLength = segmentLength / 2
  const start = {
    x: point.x - unitTangent.x * halfLength,
    y: point.y - unitTangent.y * halfLength,
    z: 0,
  }
  const end = {
    x: point.x + unitTangent.x * halfLength,
    y: point.y + unitTangent.y * halfLength,
    z: 0,
  }

  if (!isFiniteVec3(start) || !isFiniteVec3(end)) {
    return null
  }

  return {
    pathId,
    parameter,
    tangent: unitTangent,
    start,
    end,
  }
}

function normalizeOverlaySegmentLength(value: number | undefined): number {
  return value !== undefined &&
    Number.isFinite(value) &&
    value > minimumOverlaySegmentLength
    ? value
    : defaultPathCrossingOverlaySegmentLength
}

function normalizeVec2(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector.x, vector.y)

  if (!Number.isFinite(length) || length <= minimumTangentLength) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  }
}

function cloneFinitePoint(point: Vec3): Vec3 {
  return { x: point.x, y: point.y, z: 0 }
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}
