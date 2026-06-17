import { isFiniteVec3 } from '../geometry/workPlane.ts'
import {
  isClosedPathBoundary,
  isPointOnWorkPlaneFrame,
  normalizeClosedPathBoundariesForAmbientDimension,
  workPlaneLocalCoordinatesForBoundary,
} from '../model/filledBoundaries.ts'
import { pathCoordinates, pathEndpointEpsilon } from '../model/paths.ts'
import type {
  ClosedPathBoundary,
  Diagram,
  FilledRegion2DStratum,
  FillRule,
  Stratum,
  WorkPlaneFilledSheet3DStratum,
} from '../model/types.ts'
import { updateStratumById } from './diagramUpdates.ts'

export type FilledBoundaryStratum =
  | FilledRegion2DStratum
  | WorkPlaneFilledSheet3DStratum

export type ReplaceFilledStratumBoundariesError =
  | 'missingStratum'
  | 'notFilledStratum'
  | 'emptyBoundaries'
  | 'nonFiniteBoundary'
  | 'nonzeroZBoundary'
  | 'openBoundary'
  | 'nonPlanarBoundary'

export type ReplaceFilledStratumBoundariesResult =
  | {
      ok: true
      diagram: Diagram
    }
  | {
      ok: false
      diagram: Diagram
      error: ReplaceFilledStratumBoundariesError
      boundaryId?: string
    }

export function isFilledBoundaryStratum(
  stratum: Stratum,
): stratum is FilledBoundaryStratum {
  return (
    (stratum.geometricKind === 'region' && stratum.kind === 'filledRegion') ||
    (stratum.geometricKind === 'sheet' &&
      stratum.kind === 'workPlaneFilledSheet')
  )
}

export function updateFilledStratumFillRule(
  diagram: Diagram,
  id: string,
  fillRule: FillRule,
): Diagram {
  return updateStratumById(diagram, id, (stratum) =>
    isFilledBoundaryStratum(stratum) ? { ...stratum, fillRule } : stratum,
  )
}

export function replaceFilledStratumBoundaries(
  diagram: Diagram,
  id: string,
  boundaries: readonly ClosedPathBoundary[],
): ReplaceFilledStratumBoundariesResult {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined) {
    return {
      ok: false,
      diagram,
      error: 'missingStratum',
    }
  }

  if (!isFilledBoundaryStratum(stratum)) {
    return {
      ok: false,
      diagram,
      error: 'notFilledStratum',
    }
  }

  const validation = validateReplacementBoundaries(diagram, stratum, boundaries)

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    diagram: updateStratumById(diagram, id, (current) =>
      isFilledBoundaryStratum(current)
        ? { ...current, boundaries: validation.boundaries }
        : current,
    ),
  }
}

type BoundaryValidationResult =
  | {
      ok: true
      boundaries: ClosedPathBoundary[]
    }
  | {
      ok: false
      diagram: Diagram
      error: ReplaceFilledStratumBoundariesError
      boundaryId?: string
    }

function validateReplacementBoundaries(
  diagram: Diagram,
  stratum: FilledBoundaryStratum,
  boundaries: readonly ClosedPathBoundary[],
): BoundaryValidationResult {
  if (boundaries.length === 0) {
    return {
      ok: false,
      diagram,
      error: 'emptyBoundaries',
    }
  }

  for (const boundary of boundaries) {
    const coordinates = pathCoordinates(boundary.segments)

    if (!coordinates.every(isFiniteVec3)) {
      return {
        ok: false,
        diagram,
        error: 'nonFiniteBoundary',
        boundaryId: boundary.id,
      }
    }

    if (!isClosedPathBoundary(boundary)) {
      return {
        ok: false,
        diagram,
        error: 'openBoundary',
        boundaryId: boundary.id,
      }
    }

    if (
      diagram.ambientDimension === 2 &&
      coordinates.some((point) => Math.abs(point.z) > pathEndpointEpsilon)
    ) {
      return {
        ok: false,
        diagram,
        error: 'nonzeroZBoundary',
        boundaryId: boundary.id,
      }
    }

    if (
      stratum.kind === 'workPlaneFilledSheet' &&
      !isBoundaryOnStoredPlane(boundary, stratum)
    ) {
      return {
        ok: false,
        diagram,
        error: 'nonPlanarBoundary',
        boundaryId: boundary.id,
      }
    }
  }

  return {
    ok: true,
    boundaries: normalizeClosedPathBoundariesForAmbientDimension(
      boundaries,
      diagram.ambientDimension,
    ),
  }
}

function isBoundaryOnStoredPlane(
  boundary: ClosedPathBoundary,
  stratum: WorkPlaneFilledSheet3DStratum,
): boolean {
  const coordinates = pathCoordinates(boundary.segments)

  return (
    coordinates.every((point) =>
      isPointOnWorkPlaneFrame(point, stratum.planeFrame, pathEndpointEpsilon),
    ) &&
    workPlaneLocalCoordinatesForBoundary(
      boundary,
      stratum.planeFrame,
      pathEndpointEpsilon,
    ) !== null
  )
}
