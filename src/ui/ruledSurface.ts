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
  cloneBoundaryPathSnapshot,
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  reverseBoundaryPathSnapshot,
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
export type PickedCoonsBoundary = {
  sourcePathId: string
  reversed: boolean
}
export type CoonsPatchBoundaryPathSelection = string | PickedCoonsBoundary
export type CoonsPatchBoundaryPathSelections = Partial<
  Record<CoonsPatchBoundaryRole, CoonsPatchBoundaryPathSelection>
>
export type CoonsPatchBoundarySnapshots = Record<
  CoonsPatchBoundaryRole,
  BoundaryPathSnapshot
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

export type ResolveCoonsPatchBoundarySnapshotsResult =
  | {
      ok: true
      boundaries: CoonsPatchBoundarySnapshots
    }
  | {
      ok: false
      error: CreateCoonsPatchFromBoundaryPathsError
      sourcePathId?: string
      role?: CoonsPatchBoundaryRole
    }

export type ValidateCoonsPatchBoundarySelectionsResult =
  | {
      ok: true
    }
  | {
      ok: false
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
  sourcePathIds: CoonsPatchBoundaryPathSelections,
  options: CreateCoonsPatchFromBoundaryPathsOptions = {},
): CreateCoonsPatchFromBoundaryPathsResult {
  if (diagram.ambientDimension !== 3) {
    return {
      ok: false,
      diagram,
      error: 'unsupportedAmbientDimension',
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

  const boundaryResult = resolveCoonsPatchBoundarySnapshots(diagram, sourcePathIds)

  if (!boundaryResult.ok) {
    return {
      ok: false,
      diagram,
      error: boundaryResult.error,
      sourcePathId: boundaryResult.sourcePathId,
      role: boundaryResult.role,
    }
  }

  const primitive: CoonsPatchPrimitive = {
    kind: 'coonsPatch',
    bottom: boundaryResult.boundaries.bottom,
    right: boundaryResult.boundaries.right,
    top: boundaryResult.boundaries.top,
    left: boundaryResult.boundaries.left,
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

export function orientedCoonsBoundarySnapshot(
  sourceSnapshot: BoundaryPathSnapshot,
  reversed: boolean,
): BoundaryPathSnapshot {
  return reversed
    ? reverseBoundaryPathSnapshot(sourceSnapshot)
    : cloneBoundaryPathSnapshot(sourceSnapshot)
}

export function resolveCoonsPatchBoundarySnapshots(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathSelections,
): ResolveCoonsPatchBoundarySnapshotsResult {
  if (diagram.ambientDimension !== 3) {
    return {
      ok: false,
      error: 'unsupportedAmbientDimension',
    }
  }

  const roleSelections = coonsPatchBoundaryRoles.map((role) => ({
    role,
    selection: normalizeCoonsPatchBoundarySelection(sourcePathIds[role]),
  }))

  const missingRole = roleSelections.find(
    ({ selection }) => selection === null,
  )

  if (missingRole !== undefined) {
    return {
      ok: false,
      error: 'wrongBoundaryCount',
      role: missingRole.role,
    }
  }

  const sourcePathIdsByRole = roleSelections.map(({ selection }) =>
    selection === null ? '' : selection.sourcePathId,
  )

  if (new Set(sourcePathIdsByRole).size !== sourcePathIdsByRole.length) {
    return {
      ok: false,
      error: 'duplicateSourcePath',
    }
  }

  const boundaries: Partial<CoonsPatchBoundarySnapshots> = {}

  for (const { role, selection } of roleSelections) {
    if (selection === null) {
      return {
        ok: false,
        error: 'wrongBoundaryCount',
        role,
      }
    }

    const boundaryResult = loadBoundaryPathSnapshot(
      diagram,
      selection.sourcePathId,
    )

    if (!boundaryResult.ok) {
      return {
        ok: false,
        error: boundaryResult.error,
        sourcePathId: selection.sourcePathId,
        role,
      }
    }

    if (!isBoundaryPathOpen(boundaryResult.boundary)) {
      return {
        ok: false,
        error: 'sourceClosedPath',
        sourcePathId: selection.sourcePathId,
        role,
      }
    }

    boundaries[role] = orientedCoonsBoundarySnapshot(
      boundaryResult.boundary,
      selection.reversed,
    )
  }

  if (
    boundaries.bottom === undefined ||
    boundaries.right === undefined ||
    boundaries.top === undefined ||
    boundaries.left === undefined
  ) {
    return {
      ok: false,
      error: 'wrongBoundaryCount',
    }
  }

  return {
    ok: true,
    boundaries: {
      bottom: boundaries.bottom,
      right: boundaries.right,
      top: boundaries.top,
      left: boundaries.left,
    },
  }
}

export function validateCoonsPatchBoundarySelections(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathSelections,
): ValidateCoonsPatchBoundarySelectionsResult {
  const boundaryResult = resolveCoonsPatchBoundarySnapshots(diagram, sourcePathIds)

  if (!boundaryResult.ok) {
    return boundaryResult
  }

  const primitive: CoonsPatchPrimitive = {
    kind: 'coonsPatch',
    bottom: boundaryResult.boundaries.bottom,
    right: boundaryResult.boundaries.right,
    top: boundaryResult.boundaries.top,
    left: boundaryResult.boundaries.left,
    sampling: { ...defaultCoonsPatchSampling },
  }

  return validateCurvedSheetPrimitive(primitive).valid
    ? { ok: true }
    : { ok: false, error: 'invalidBoundary' }
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
      return 'Coons corners do not match with the current boundary directions. Use Reverse controls to adjust boundary directions.'
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

type NormalizedCoonsPatchBoundarySelection = {
  sourcePathId: string
  reversed: boolean
}

function normalizeCoonsPatchBoundarySelection(
  selection: CoonsPatchBoundaryPathSelection | undefined,
): NormalizedCoonsPatchBoundarySelection | null {
  if (selection === undefined) {
    return null
  }

  if (typeof selection === 'string') {
    const sourcePathId = selection.trim()

    return sourcePathId.length === 0
      ? null
      : { sourcePathId, reversed: false }
  }

  const sourcePathId = selection.sourcePathId.trim()

  return sourcePathId.length === 0
    ? null
    : { sourcePathId, reversed: selection.reversed }
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
