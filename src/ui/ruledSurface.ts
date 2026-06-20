import {
  MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS,
  validateBoundaryPathSnapshot,
  validateCurvedSheetPrimitive,
} from '../geometry/curvedSheets.ts'
import { isFiniteVec3 } from '../geometry/workPlane.ts'
import { createCurvedSheetStratum } from '../model/constructors.ts'
import {
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import { defaultSheetStyle } from '../model/styles.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  CurveStratum,
  Diagram,
  PathSegment,
  RuledSurfacePrimitive,
  SheetStyle,
  Stratum,
} from '../model/types.ts'
import { makeUniqueId } from './diagramUpdates.ts'

export const defaultRuledSurfaceSamplingSegments = 8

export type CreateRuledSurfaceFromBoundaryPathsError =
  | 'unsupportedAmbientDimension'
  | 'wrongBoundaryCount'
  | 'duplicateSourcePath'
  | 'missingSourcePath'
  | 'sourceNotBoundaryPath'
  | 'sourceWrongCodimension'
  | 'sourceNonFinite'
  | 'invalidSampling'
  | 'invalidBoundary'

export type CreateRuledSurfaceFromBoundaryPathsOptions = {
  id?: string
  name?: string
  layer?: number
  style?: SheetStyle
  samplingSegments?: number
}

export type CreateRuledSurfaceFromBoundaryPathsResult =
  | {
      ok: true
      diagram: Diagram
      id: string
    }
  | {
      ok: false
      diagram: Diagram
      error: CreateRuledSurfaceFromBoundaryPathsError
      sourcePathId?: string
    }

export function createRuledSurfaceFromBoundaryPaths(
  diagram: Diagram,
  sourcePathIds: readonly string[],
  options: CreateRuledSurfaceFromBoundaryPathsOptions = {},
): CreateRuledSurfaceFromBoundaryPathsResult {
  if (diagram.ambientDimension !== 3) {
    return {
      ok: false,
      diagram,
      error: 'unsupportedAmbientDimension',
    }
  }

  if (sourcePathIds.length !== 2) {
    return {
      ok: false,
      diagram,
      error: 'wrongBoundaryCount',
    }
  }

  if (new Set(sourcePathIds).size !== sourcePathIds.length) {
    return {
      ok: false,
      diagram,
      error: 'duplicateSourcePath',
    }
  }

  const samplingSegments =
    options.samplingSegments ?? defaultRuledSurfaceSamplingSegments

  if (!isValidBoundarySurfaceSamplingSegmentCount(samplingSegments)) {
    return {
      ok: false,
      diagram,
      error: 'invalidSampling',
    }
  }

  const boundaries: BoundaryPathSnapshot[] = []

  for (const sourcePathId of sourcePathIds) {
    const source = diagram.strata.find((stratum) => stratum.id === sourcePathId)

    if (source === undefined) {
      return {
        ok: false,
        diagram,
        error: 'missingSourcePath',
        sourcePathId,
      }
    }

    if (source.geometricKind !== 'curve') {
      return {
        ok: false,
        diagram,
        error: 'sourceNotBoundaryPath',
        sourcePathId,
      }
    }

    if (source.codim !== expectedBoundaryPathCodim(diagram.ambientDimension)) {
      return {
        ok: false,
        diagram,
        error: 'sourceWrongCodimension',
        sourcePathId,
      }
    }

    if (!isRuledSurfaceBoundaryPathStratum(source, diagram.ambientDimension)) {
      return {
        ok: false,
        diagram,
        error: 'sourceNotBoundaryPath',
        sourcePathId,
      }
    }

    const boundary = boundaryPathSnapshotFromCurveStratum(
      source,
      diagram.ambientDimension,
    )

    if (boundary === null) {
      return {
        ok: false,
        diagram,
        error: 'sourceNotBoundaryPath',
        sourcePathId,
      }
    }

    if (!pathCoordinates(boundary.segments).every(isFiniteVec3)) {
      return {
        ok: false,
        diagram,
        error: 'sourceNonFinite',
        sourcePathId,
      }
    }

    if (!validateBoundaryPathSnapshot(boundary).valid) {
      return {
        ok: false,
        diagram,
        error: 'invalidBoundary',
        sourcePathId,
      }
    }

    boundaries.push(boundary)
  }

  const primitive: RuledSurfacePrimitive = {
    kind: 'ruledSurface',
    boundary0: boundaries[0],
    boundary1: boundaries[1],
    sampling: { segments: samplingSegments },
  }

  if (!validateCurvedSheetPrimitive(primitive).valid) {
    return {
      ok: false,
      diagram,
      error: 'invalidBoundary',
    }
  }

  const layer = options.layer ?? nextLayer(diagram)
  const sheet = createCurvedSheetStratum({
    id: safeRuledSurfaceId(diagram, options.id),
    name: options.name ?? 'Ruled surface',
    style: options.style ?? defaultSheetStyle,
    primitive,
    layer,
  })

  return {
    ok: true,
    diagram: {
      ...diagram,
      strata: [...diagram.strata, sheet],
    },
    id: sheet.id,
  }
}

export function isRuledSurfaceBoundaryPathStratum(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): stratum is CurveStratum {
  return (
    stratum.geometricKind === 'curve' &&
    stratum.codim === expectedBoundaryPathCodim(ambientDimension) &&
    boundaryPathSnapshotFromCurveStratum(stratum, ambientDimension) !== null
  )
}

export function boundaryPathSnapshotFromCurveStratum(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): BoundaryPathSnapshot | null {
  if (curve.kind === 'grid') {
    return null
  }

  const segments = boundaryPathSegmentsFromCurve(curve, ambientDimension)

  if (segments.length === 0) {
    return null
  }

  return {
    id: curve.id,
    name: curve.name,
    segments,
  }
}

export function createRuledSurfaceFromBoundaryPathsErrorMessage(
  error: CreateRuledSurfaceFromBoundaryPathsError,
): string {
  switch (error) {
    case 'unsupportedAmbientDimension':
      return 'Ruled surfaces are available only in 3D diagrams.'
    case 'wrongBoundaryCount':
      return 'Pick exactly two boundary paths.'
    case 'duplicateSourcePath':
      return 'Pick two different boundary paths.'
    case 'missingSourcePath':
      return 'A picked boundary path is no longer available.'
    case 'sourceNotBoundaryPath':
      return 'Picked sources must be paths, polylines, cubic Beziers, or path templates.'
    case 'sourceWrongCodimension':
      return 'Picked boundary paths must be codimension 2 in a 3D diagram.'
    case 'sourceNonFinite':
      return 'Picked boundary paths must have finite coordinates.'
    case 'invalidSampling':
      return `Sampling segments must be a positive integer at most ${MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS}.`
    case 'invalidBoundary':
      return 'Boundary paths must be valid composable paths with matching closure status.'
  }
}

function boundaryPathSegmentsFromCurve(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): PathSegment[] {
  switch (curve.kind) {
    case 'polyline':
      return normalizePathSegmentsForAmbientDimension(
        pathSegmentsFromPolyline(curve.points),
        ambientDimension,
      )
    case 'cubicBezier':
      return normalizePathSegmentsForAmbientDimension(
        pathSegmentsFromCubicBezier(curve.points, curve.bezierControls),
        ambientDimension,
      )
    case 'concatenatedPath':
      return normalizePathSegmentsForAmbientDimension(
        curve.segments,
        ambientDimension,
      )
    case 'templatePath':
      return normalizePathSegmentsForAmbientDimension(
        pathSegmentsFromPolyline(
          sampleTemplatePathPoints(curve.template, ambientDimension),
        ),
        ambientDimension,
      )
    case 'grid':
      return []
  }
}

function isValidBoundarySurfaceSamplingSegmentCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS
  )
}

function expectedBoundaryPathCodim(ambientDimension: AmbientDimension): 1 | 2 {
  return ambientDimension === 2 ? 1 : 2
}

function safeRuledSurfaceId(
  diagram: Diagram,
  id: string | undefined,
): string {
  const trimmedId = id?.trim()

  if (trimmedId === undefined || trimmedId.length === 0) {
    return makeUniqueId(diagram, 'sheet')
  }

  return diagram.strata.some((stratum) => stratum.id === trimmedId) ||
    diagram.labels.some((label) => label.id === trimmedId)
    ? makeUniqueId(diagram, 'sheet')
    : trimmedId
}

function nextLayer(diagram: Diagram): number {
  const layers = [
    ...diagram.strata.map((stratum) => stratum.layer),
    ...diagram.labels.map((label) => label.layer),
  ]

  return layers.length === 0 ? 0 : Math.max(...layers) + 1
}
