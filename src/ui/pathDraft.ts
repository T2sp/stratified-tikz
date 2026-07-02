import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import { workPlaneToBasis } from '../geometry/workPlane.ts'
import type {
  AmbientDimension,
  PathSegment,
  Vec3,
  WorkPlane,
  WorkPlaneFrameSnapshot,
} from '../model/types.ts'
import {
  createArcPathSegmentFromAngles,
  pathCoordinates,
  pathEndpointEpsilon,
} from '../model/paths.ts'
import {
  arePointsOnWorkPlane,
  isFinitePoint,
} from './sheetDraft.ts'

export type ConcatenatedPathSegmentKind = PathSegment['kind']

export type ConcatenatedPathWorkPlaneMode =
  | 'sameWorkPlane'
  | 'crossWorkPlane'

export type ConcatenatedPathDraft = {
  segments: PathSegment[]
  anchor: Vec3
  pendingPoints: Vec3[]
  currentSegmentKind: ConcatenatedPathSegmentKind
  workPlane: WorkPlane
  workPlaneMode: ConcatenatedPathWorkPlaneMode
}

export type ConcatenatedPathDraftPointError =
  | 'nonFinitePoint'
  | 'pointOffWorkPlane'

export type ConcatenatedPathDraftSegmentKindError = 'segmentInProgress'

export type CreateConcatenatedPathDraftResult =
  | {
      ok: true
      draft: ConcatenatedPathDraft
    }
  | {
      ok: false
      reason: ConcatenatedPathDraftPointError
    }

export type AppendConcatenatedPathDraftPointResult =
  | {
      ok: true
      draft: ConcatenatedPathDraft
      completedSegment: boolean
    }
  | {
      ok: false
      draft: ConcatenatedPathDraft
      reason: ConcatenatedPathDraftPointError
    }

export type SetConcatenatedPathDraftSegmentKindResult =
  | {
      ok: true
      draft: ConcatenatedPathDraft
    }
  | {
      ok: false
      draft: ConcatenatedPathDraft
      reason: ConcatenatedPathDraftSegmentKindError
    }

export function createConcatenatedPathDraft(
  firstPoint: Vec3,
  workPlane: WorkPlane,
  segmentKind: ConcatenatedPathSegmentKind,
  ambientDimension: AmbientDimension,
  workPlaneMode: ConcatenatedPathWorkPlaneMode = 'sameWorkPlane',
): CreateConcatenatedPathDraftResult {
  const normalizedPoint = normalizePointForAmbientDimension(
    ambientDimension,
    firstPoint,
  )
  const validation = validatePathDraftPoint(
    normalizedPoint,
    workPlane,
    ambientDimension,
    workPlaneMode,
  )

  if (validation !== null) {
    return validation
  }

  return {
    ok: true,
    draft: {
      segments: [],
      anchor: normalizedPoint,
      pendingPoints: [],
      currentSegmentKind: segmentKind,
      workPlane: cloneWorkPlane(workPlane),
      workPlaneMode,
    },
  }
}

export function appendConcatenatedPathDraftPoint(
  draft: ConcatenatedPathDraft,
  point: Vec3,
  ambientDimension: AmbientDimension,
): AppendConcatenatedPathDraftPointResult {
  const normalizedPoint = normalizePointForAmbientDimension(
    ambientDimension,
    point,
  )
  const validation = validatePathDraftPoint(
    normalizedPoint,
    draft.workPlane,
    ambientDimension,
    draft.workPlaneMode,
  )

  if (validation !== null) {
    return {
      ...validation,
      draft,
    }
  }

  if (draft.currentSegmentKind === 'line') {
    const nextSegment: PathSegment = {
      kind: 'line',
      start: draft.anchor,
      end: normalizedPoint,
    }

    return {
      ok: true,
      draft: {
        ...draft,
        segments: [...draft.segments, nextSegment],
        anchor: normalizedPoint,
        pendingPoints: [],
      },
      completedSegment: true,
    }
  }

  const pendingPoints = [...draft.pendingPoints, normalizedPoint]

  if (draft.currentSegmentKind === 'arc') {
    if (pendingPoints.length < 2) {
      return {
        ok: true,
        draft: {
          ...draft,
          pendingPoints,
        },
        completedSegment: false,
      }
    }

    const [center, endpointHint] = pendingPoints
    const nextSegment = createArcDraftSegment(
      draft.anchor,
      center,
      endpointHint,
      draft.workPlane,
      ambientDimension,
    )

    if (nextSegment === null) {
      return {
        ok: false,
        draft,
        reason: 'nonFinitePoint',
      }
    }

    return {
      ok: true,
      draft: {
        ...draft,
        segments: [...draft.segments, nextSegment],
        anchor: nextSegment.end,
        pendingPoints: [],
      },
      completedSegment: true,
    }
  }

  if (pendingPoints.length < 3) {
    return {
      ok: true,
      draft: {
        ...draft,
        pendingPoints,
      },
      completedSegment: false,
    }
  }

  const [control1, control2, end] = pendingPoints
  const nextSegment: PathSegment = {
    kind: 'cubicBezier',
    start: draft.anchor,
    control1,
    control2,
    end,
  }

  return {
    ok: true,
    draft: {
      ...draft,
      segments: [...draft.segments, nextSegment],
      anchor: end,
      pendingPoints: [],
    },
    completedSegment: true,
  }
}

export function setConcatenatedPathDraftSegmentKind(
  draft: ConcatenatedPathDraft,
  segmentKind: ConcatenatedPathSegmentKind,
): SetConcatenatedPathDraftSegmentKindResult {
  if (draft.pendingPoints.length > 0) {
    return {
      ok: false,
      draft,
      reason: 'segmentInProgress',
    }
  }

  return {
    ok: true,
    draft: {
      ...draft,
      currentSegmentKind: segmentKind,
    },
  }
}

export function concatenatedPathDraftCanFinish(
  draft: ConcatenatedPathDraft | null,
): boolean {
  return draft !== null && draft.segments.length > 0 && draft.pendingPoints.length === 0
}

export function cancelConcatenatedPathDraft(): null {
  return null
}

export function concatenatedPathDraftBlocksWorkPlaneChange(
  draft: ConcatenatedPathDraft | null,
): boolean {
  return draft !== null && draft.workPlaneMode === 'sameWorkPlane'
}

export function concatenatedPathDraftCoordinates(
  draft: ConcatenatedPathDraft,
): Vec3[] {
  return [
    ...pathCoordinates(draft.segments),
    draft.anchor,
    ...draft.pendingPoints,
  ]
}

export function concatenatedPathDraftNextPointLabel(
  draft: ConcatenatedPathDraft | null,
): string {
  if (draft === null) {
    return 'start'
  }

  if (draft.currentSegmentKind === 'line') {
    return 'endpoint'
  }

  if (draft.currentSegmentKind === 'arc') {
    return draft.pendingPoints.length === 0 ? 'center' : 'endpoint direction'
  }

  switch (draft.pendingPoints.length) {
    case 0:
      return 'control 1'
    case 1:
      return 'control 2'
    default:
      return 'endpoint'
  }
}

export function concatenatedPathDraftNextPointSupportsCoordinateRef(
  draft: ConcatenatedPathDraft | null,
  segmentKind: ConcatenatedPathSegmentKind,
  ambientDimension: AmbientDimension,
): boolean {
  return (
    concatenatedPathDraftNextPointCoordinateRefRejectionReason(
      draft,
      segmentKind,
      ambientDimension,
    ) === null
  )
}

export type ConcatenatedPathDraftCoordinateRefRejectionReason =
  | 'arcEndpoint'
  | 'arcCenter'
  | 'arc3d'

export function concatenatedPathDraftNextPointCoordinateRefRejectionReason(
  draft: ConcatenatedPathDraft | null,
  segmentKind: ConcatenatedPathSegmentKind,
  ambientDimension: AmbientDimension,
): ConcatenatedPathDraftCoordinateRefRejectionReason | null {
  const nextSegmentKind = draft?.currentSegmentKind ?? segmentKind

  if (nextSegmentKind === 'line' || nextSegmentKind === 'cubicBezier') {
    return null
  }

  if (ambientDimension === 3) {
    return 'arc3d'
  }

  return draft !== null && draft.pendingPoints.length === 0
    ? 'arcCenter'
    : 'arcEndpoint'
}

function validatePathDraftPoint(
  point: Vec3,
  workPlane: WorkPlane,
  ambientDimension: AmbientDimension,
  workPlaneMode: ConcatenatedPathWorkPlaneMode,
): { ok: false; reason: ConcatenatedPathDraftPointError } | null {
  if (!isFinitePoint(point)) {
    return {
      ok: false,
      reason: 'nonFinitePoint',
    }
  }

  if (ambientDimension === 3 && !arePointsOnWorkPlane([point], workPlane)) {
    if (workPlaneMode === 'crossWorkPlane') {
      return null
    }

    return {
      ok: false,
      reason: 'pointOffWorkPlane',
    }
  }

  return null
}

function cloneWorkPlane(workPlane: WorkPlane): WorkPlane {
  return structuredClone(workPlane) as WorkPlane
}

function createArcDraftSegment(
  start: Vec3,
  center: Vec3,
  endpointHint: Vec3,
  workPlane: WorkPlane,
  ambientDimension: AmbientDimension,
): PathSegment | null {
  const frame =
    ambientDimension === 2
      ? xyFrame(center)
      : workPlaneFrameFromWorkPlane(workPlane, center)
  const startPolar = localPolarCoordinateForPoint(start, center, frame)
  const endPolar = localPolarCoordinateForPoint(endpointHint, center, frame)

  if (
    startPolar === null ||
    endPolar === null ||
    startPolar.radius <= pathEndpointEpsilon
  ) {
    return null
  }

  return createArcPathSegmentFromAngles({
    center,
    radius: startPolar.radius,
    startAngleDeg: startPolar.angleDeg,
    endAngleDeg: endPolar.angleDeg,
    direction: 'counterclockwise',
    ...(ambientDimension === 3 ? { frame } : {}),
    ambientDimension,
  })
}

function workPlaneFrameFromWorkPlane(
  workPlane: WorkPlane,
  center: Vec3,
): WorkPlaneFrameSnapshot {
  const basis = workPlaneToBasis(workPlane)

  return {
    origin: center,
    u: basis.u,
    v: basis.v,
    normal: basis.normal,
  }
}

function xyFrame(origin: Vec3): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function localPolarCoordinateForPoint(
  point: Vec3,
  center: Vec3,
  frame: WorkPlaneFrameSnapshot,
): { radius: number; angleDeg: number } | null {
  const delta = {
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z,
  }
  const localX = dotVec3(delta, frame.u)
  const localY = dotVec3(delta, frame.v)
  const radius = Math.hypot(localX, localY)
  const angleDeg = (Math.atan2(localY, localX) * 180) / Math.PI

  return Number.isFinite(radius) && Number.isFinite(angleDeg)
    ? { radius, angleDeg }
    : null
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}
