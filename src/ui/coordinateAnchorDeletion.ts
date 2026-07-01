import {
  coordinateAnchorReferenceCount,
  detachCoordinateAnchorReferencesMany,
} from '../model/coordinateReferences.ts'
import type { CoordinateAnchor, Diagram } from '../model/types.ts'

export type DeletedCoordinateAnchorSummary = {
  id: string
  name: string
  tikzName: string
}

export type DeleteCoordinateAnchorsWithDetachResult =
  | {
      ok: true
      diagram: Diagram
      deletedCount: number
      detachedCount: number
      deletedCoordinates: DeletedCoordinateAnchorSummary[]
    }
  | {
      ok: false
      diagram: Diagram
      reason: 'missing' | 'detachFailed'
      message: string
      missingCoordinateIds?: string[]
    }

export type DeleteCoordinateAnchorWithDetachResult =
  | {
      ok: true
      diagram: Diagram
      deleted: true
      detachedCount: number
      deletedCoordinateName: string
      deletedCoordinateTikzName: string
      message: string
    }
  | {
      ok: false
      diagram: Diagram
      deleted: false
      reason: 'missing' | 'detachFailed'
      referenceCount: number
      message: string
    }

export function deleteCoordinateAnchorsWithDetach(
  diagram: Diagram,
  coordinateIds: readonly string[],
): DeleteCoordinateAnchorsWithDetachResult {
  const uniqueCoordinateIds = [...new Set(coordinateIds)]

  if (uniqueCoordinateIds.length === 0) {
    return {
      ok: true,
      diagram,
      deletedCount: 0,
      detachedCount: 0,
      deletedCoordinates: [],
    }
  }

  const anchorsById = new Map(
    (diagram.coordinateAnchors ?? []).map((anchor) => [anchor.id, anchor]),
  )
  const missingCoordinateIds = uniqueCoordinateIds.filter(
    (coordinateId) => !anchorsById.has(coordinateId),
  )

  if (missingCoordinateIds.length > 0) {
    return {
      ok: false,
      diagram,
      reason: 'missing',
      message: missingCoordinateDeleteMessage(missingCoordinateIds),
      missingCoordinateIds,
    }
  }

  const deletedCoordinates = uniqueCoordinateIds.map((coordinateId) =>
    deletedCoordinateSummary(anchorsById.get(coordinateId)),
  )
  const detached = detachCoordinateAnchorReferencesMany(
    diagram,
    uniqueCoordinateIds,
  )

  if (!detached.ok) {
    return {
      ok: false,
      diagram,
      reason: 'detachFailed',
      message: `Could not delete ${coordinateDeleteSubject(
        deletedCoordinates,
      )}: ${detached.error.message}`,
    }
  }

  const deletedCoordinateIds = new Set(uniqueCoordinateIds)

  return {
    ok: true,
    diagram: {
      ...detached.value.diagram,
      coordinateAnchors: (detached.value.diagram.coordinateAnchors ?? []).filter(
        (anchor) => !deletedCoordinateIds.has(anchor.id),
      ),
    },
    deletedCount: deletedCoordinates.length,
    detachedCount: detached.value.detachedCount,
    deletedCoordinates,
  }
}

export function deleteCoordinateAnchorWithDetach(
  diagram: Diagram,
  coordinateId: string,
): DeleteCoordinateAnchorWithDetachResult {
  const anchor = (diagram.coordinateAnchors ?? []).find(
    (candidate) => candidate.id === coordinateId,
  )

  if (anchor === undefined) {
    return {
      ok: false,
      diagram,
      deleted: false,
      reason: 'missing',
      referenceCount: 0,
      message: `Coordinate anchor "${coordinateId}" does not exist.`,
    }
  }

  const result = deleteCoordinateAnchorsWithDetach(diagram, [coordinateId])

  if (!result.ok) {
    return {
      ok: false,
      diagram,
      deleted: false,
      reason: result.reason,
      referenceCount: coordinateAnchorReferenceCount(diagram, coordinateId),
      message: result.message,
    }
  }

  return {
    ok: true,
    diagram: result.diagram,
    deleted: true,
    detachedCount: result.detachedCount,
    deletedCoordinateName: anchor.name,
    deletedCoordinateTikzName: anchor.tikzName,
    message: singleCoordinateDeleteStatusMessage(anchor.name, result.detachedCount),
  }
}

function deletedCoordinateSummary(
  anchor: CoordinateAnchor | undefined,
): DeletedCoordinateAnchorSummary {
  if (anchor === undefined) {
    throw new Error('Expected coordinate anchor to exist.')
  }

  return {
    id: anchor.id,
    name: anchor.name,
    tikzName: anchor.tikzName,
  }
}

function coordinateDeleteSubject(
  coordinates: readonly DeletedCoordinateAnchorSummary[],
): string {
  if (coordinates.length === 1) {
    return `coordinate "${coordinates[0]?.name ?? ''}"`
  }

  return `${coordinates.length} coordinates`
}

function missingCoordinateDeleteMessage(coordinateIds: readonly string[]): string {
  if (coordinateIds.length === 1) {
    return `Coordinate anchor "${coordinateIds[0] ?? ''}" does not exist.`
  }

  return `Coordinate anchors do not exist: ${coordinateIds.join(', ')}.`
}

function singleCoordinateDeleteStatusMessage(
  coordinateName: string,
  detachedCount: number,
): string {
  const deleted = `Deleted coordinate "${coordinateName}"`

  return detachedCount === 0
    ? `${deleted}.`
    : `${deleted} and detached ${coordinateReferenceCountLabel(detachedCount)}.`
}

function coordinateReferenceCountLabel(count: number): string {
  return `${count} coordinate ${count === 1 ? 'reference' : 'references'}`
}
