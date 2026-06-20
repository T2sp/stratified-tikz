import {
  MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS,
  isBoundaryPathClosed,
  isBoundaryPathOpen,
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
  CoonsPatchPrimitive,
  CurveStratum,
  Diagram,
  PathSegment,
  RuledSurfacePrimitive,
  SheetStyle,
  SurfaceSampling,
  Stratum,
} from '../model/types.ts'
import { makeUniqueId } from './diagramUpdates.ts'

export const defaultRuledSurfaceSamplingSegments = 8
export const defaultCoonsPatchSampling: SurfaceSampling = {
  uSegments: 8,
  vSegments: 8,
}
export const coonsPatchBoundaryRoles = [
  'bottom',
  'right',
  'top',
  'left',
] as const

export type CoonsPatchBoundaryRole = (typeof coonsPatchBoundaryRoles)[number]
export type CoonsPatchBoundaryPathIds = Partial<
  Record<CoonsPatchBoundaryRole, string>
>

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

export type CreateCoonsPatchFromBoundaryPathsError =
  | 'unsupportedAmbientDimension'
  | 'wrongBoundaryCount'
  | 'duplicateSourcePath'
  | 'missingSourcePath'
  | 'sourceNotBoundaryPath'
  | 'sourceWrongCodimension'
  | 'sourceNonFinite'
  | 'sourceClosedPath'
  | 'invalidSampling'
  | 'invalidBoundary'

export type CreateCoonsPatchFromBoundaryPathsOptions = {
  id?: string
  name?: string
  layer?: number
  style?: SheetStyle
  sampling?: SurfaceSampling
}

export type CreateCoonsPatchFromBoundaryPathsResult =
  | {
      ok: true
      diagram: Diagram
      id: string
    }
  | {
      ok: false
      diagram: Diagram
      error: CreateCoonsPatchFromBoundaryPathsError
      sourcePathId?: string
      role?: CoonsPatchBoundaryRole
    }

export type BoundarySurfaceBoundaryPathSourceError =
  | 'missingSourcePath'
  | 'sourceNotBoundaryPath'
  | 'sourceWrongCodimension'
  | 'sourceNonFinite'
  | 'invalidBoundary'

export type CoonsPatchBoundaryPathSourceError =
  | BoundarySurfaceBoundaryPathSourceError
  | 'sourceClosedPath'

export type BoundarySurfaceBoundaryPathSourceValidationResult =
  | {
      ok: true
      boundary: BoundaryPathSnapshot
    }
  | {
      ok: false
      error: BoundarySurfaceBoundaryPathSourceError
    }

export type CoonsPatchBoundaryPathSourceValidationResult =
  | {
      ok: true
      boundary: BoundaryPathSnapshot
    }
  | {
      ok: false
      error: CoonsPatchBoundaryPathSourceError
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
    const boundaryResult = loadBoundaryPathSnapshot(diagram, sourcePathId)

    if (!boundaryResult.ok) {
      return {
        ok: false,
        diagram,
        error: boundaryResult.error,
        sourcePathId,
      }
    }

    boundaries.push(boundaryResult.boundary)
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
    id: safeBoundarySurfaceId(diagram, options.id),
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

export function createCoonsPatchFromBoundaryPaths(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathIds,
  options: CreateCoonsPatchFromBoundaryPathsOptions = {},
): CreateCoonsPatchFromBoundaryPathsResult {
  if (diagram.ambientDimension !== 3) {
    return {
      ok: false,
      diagram,
      error: 'unsupportedAmbientDimension',
    }
  }

  const rolePathIds = coonsPatchBoundaryRoles.map((role) => ({
    role,
    sourcePathId: sourcePathIds[role]?.trim() ?? '',
  }))

  const missingRole = rolePathIds.find(
    ({ sourcePathId }) => sourcePathId.length === 0,
  )

  if (missingRole !== undefined) {
    return {
      ok: false,
      diagram,
      error: 'wrongBoundaryCount',
      role: missingRole.role,
    }
  }

  if (
    new Set(rolePathIds.map(({ sourcePathId }) => sourcePathId)).size !==
    rolePathIds.length
  ) {
    return {
      ok: false,
      diagram,
      error: 'duplicateSourcePath',
    }
  }

  const sampling = options.sampling ?? defaultCoonsPatchSampling

  if (
    !isValidBoundarySurfaceSamplingSegmentCount(sampling.uSegments) ||
    !isValidBoundarySurfaceSamplingSegmentCount(sampling.vSegments)
  ) {
    return {
      ok: false,
      diagram,
      error: 'invalidSampling',
    }
  }

  const boundaries: Partial<Record<CoonsPatchBoundaryRole, BoundaryPathSnapshot>> =
    {}

  for (const { role, sourcePathId } of rolePathIds) {
    const boundaryResult = loadBoundaryPathSnapshot(diagram, sourcePathId)

    if (!boundaryResult.ok) {
      return {
        ok: false,
        diagram,
        error: boundaryResult.error,
        sourcePathId,
        role,
      }
    }

    if (!isBoundaryPathOpen(boundaryResult.boundary)) {
      return {
        ok: false,
        diagram,
        error: 'sourceClosedPath',
        sourcePathId,
        role,
      }
    }

    boundaries[role] = boundaryResult.boundary
  }

  const bottom = boundaries.bottom
  const right = boundaries.right
  const top = boundaries.top
  const left = boundaries.left

  if (
    bottom === undefined ||
    right === undefined ||
    top === undefined ||
    left === undefined
  ) {
    return {
      ok: false,
      diagram,
      error: 'wrongBoundaryCount',
    }
  }

  const primitive: CoonsPatchPrimitive = {
    kind: 'coonsPatch',
    bottom,
    right,
    top,
    left,
    sampling: { ...sampling },
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
    id: safeBoundarySurfaceId(diagram, options.id),
    name: options.name ?? 'Coons patch',
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

export function isBoundarySurfaceBoundaryPathStratum(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): stratum is CurveStratum {
  return (
    stratum.geometricKind === 'curve' &&
    stratum.codim === expectedBoundaryPathCodim(ambientDimension) &&
    boundaryPathSnapshotFromCurveStratum(stratum, ambientDimension) !== null
  )
}

export function isRuledSurfaceBoundaryPathStratum(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): stratum is CurveStratum {
  return isBoundarySurfaceBoundaryPathStratum(stratum, ambientDimension)
}

export function validateRuledSurfaceBoundaryPathSource(
  diagram: Diagram,
  sourcePathId: string,
): BoundarySurfaceBoundaryPathSourceValidationResult {
  return loadBoundaryPathSnapshot(diagram, sourcePathId)
}

export function validateCoonsPatchBoundaryPathSource(
  diagram: Diagram,
  sourcePathId: string,
): CoonsPatchBoundaryPathSourceValidationResult {
  const result = loadBoundaryPathSnapshot(diagram, sourcePathId)

  if (!result.ok) {
    return result
  }

  if (isBoundaryPathClosed(result.boundary)) {
    return {
      ok: false,
      error: 'sourceClosedPath',
    }
  }

  return result
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

export function createCoonsPatchFromBoundaryPathsErrorMessage(
  error: CreateCoonsPatchFromBoundaryPathsError,
  role?: CoonsPatchBoundaryRole,
): string {
  switch (error) {
    case 'unsupportedAmbientDimension':
      return 'Coons patches are available only in 3D diagrams.'
    case 'wrongBoundaryCount':
      return 'Pick bottom, right, top, and left boundary paths.'
    case 'duplicateSourcePath':
      return 'Use four different boundary paths for the Coons patch.'
    case 'missingSourcePath':
      return 'A picked Coons patch boundary path is no longer available.'
    case 'sourceNotBoundaryPath':
      return 'Picked sources must be paths, polylines, cubic Beziers, or path templates.'
    case 'sourceWrongCodimension':
      return 'Picked boundary paths must be codimension 2 in a 3D diagram.'
    case 'sourceNonFinite':
      return 'Picked boundary paths must have finite coordinates.'
    case 'sourceClosedPath':
      return role === undefined
        ? 'Coons patch boundaries must be open paths.'
        : `Coons patch ${role} boundary must be an open path.`
    case 'invalidSampling':
      return `Coons patch u and v sampling must be positive integers at most ${MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS}.`
    case 'invalidBoundary':
      return 'Coons patch corners must match: bottom start = left start, bottom end = right start, top start = left end, and top end = right end.'
  }
}

export function boundarySurfaceBoundaryPathSourceErrorMessage(
  error: BoundarySurfaceBoundaryPathSourceError,
): string {
  switch (error) {
    case 'missingSourcePath':
      return 'Picked boundary path is no longer available.'
    case 'sourceNotBoundaryPath':
      return 'Click a path, polyline, cubic Bezier, or path template.'
    case 'sourceWrongCodimension':
      return 'Boundary paths must be codimension 2 in a 3D diagram.'
    case 'sourceNonFinite':
      return 'Boundary paths must have finite coordinates.'
    case 'invalidBoundary':
      return 'Boundary paths must be valid composable paths.'
  }
}

export function coonsPatchBoundaryPathSourceErrorMessage(
  error: CoonsPatchBoundaryPathSourceError,
): string {
  if (error === 'sourceClosedPath') {
    return 'Coons patch boundaries must be open paths.'
  }

  return boundarySurfaceBoundaryPathSourceErrorMessage(error)
}

type BoundaryPathLoadResult =
  | {
      ok: true
      boundary: BoundaryPathSnapshot
    }
  | {
      ok: false
      error: BoundarySurfaceBoundaryPathSourceError
    }

function loadBoundaryPathSnapshot(
  diagram: Diagram,
  sourcePathId: string,
): BoundaryPathLoadResult {
  const source = diagram.strata.find((stratum) => stratum.id === sourcePathId)

  if (source === undefined) {
    return {
      ok: false,
      error: 'missingSourcePath',
    }
  }

  if (source.geometricKind !== 'curve') {
    return {
      ok: false,
      error: 'sourceNotBoundaryPath',
    }
  }

  if (source.codim !== expectedBoundaryPathCodim(diagram.ambientDimension)) {
    return {
      ok: false,
      error: 'sourceWrongCodimension',
    }
  }

  if (!isBoundarySurfaceBoundaryPathStratum(source, diagram.ambientDimension)) {
    return {
      ok: false,
      error: 'sourceNotBoundaryPath',
    }
  }

  const boundary = boundaryPathSnapshotFromCurveStratum(
    source,
    diagram.ambientDimension,
  )

  if (boundary === null) {
    return {
      ok: false,
      error: 'sourceNotBoundaryPath',
    }
  }

  if (!pathCoordinates(boundary.segments).every(isFiniteVec3)) {
    return {
      ok: false,
      error: 'sourceNonFinite',
    }
  }

  if (!validateBoundaryPathSnapshot(boundary).valid) {
    return {
      ok: false,
      error: 'invalidBoundary',
    }
  }

  return {
    ok: true,
    boundary,
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

function safeBoundarySurfaceId(
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
