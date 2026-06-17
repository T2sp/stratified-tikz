import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import type {
  AmbientDimension,
  PathSegment,
  Vec3,
  WorkPlane,
} from '../model/types.ts'
import { pathCoordinates } from '../model/paths.ts'
import {
  arePointsOnWorkPlane,
  isFinitePoint,
} from './sheetDraft.ts'

export type ConcatenatedPathSegmentKind = PathSegment['kind']

export type ConcatenatedPathDraft = {
  segments: PathSegment[]
  anchor: Vec3
  pendingPoints: Vec3[]
  currentSegmentKind: ConcatenatedPathSegmentKind
  workPlane: WorkPlane
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
): CreateConcatenatedPathDraftResult {
  const normalizedPoint = normalizePointForAmbientDimension(
    ambientDimension,
    firstPoint,
  )
  const validation = validatePathDraftPoint(
    normalizedPoint,
    workPlane,
    ambientDimension,
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
  return draft !== null
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

  switch (draft.pendingPoints.length) {
    case 0:
      return 'control 1'
    case 1:
      return 'control 2'
    default:
      return 'endpoint'
  }
}

function validatePathDraftPoint(
  point: Vec3,
  workPlane: WorkPlane,
  ambientDimension: AmbientDimension,
): { ok: false; reason: ConcatenatedPathDraftPointError } | null {
  if (!isFinitePoint(point)) {
    return {
      ok: false,
      reason: 'nonFinitePoint',
    }
  }

  if (ambientDimension === 3 && !arePointsOnWorkPlane([point], workPlane)) {
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
