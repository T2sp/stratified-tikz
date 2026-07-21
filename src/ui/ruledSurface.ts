import {
  boundaryEnd,
  boundaryStart,
  MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS,
  validateCurvedSheetPrimitive,
} from '../geometry/curvedSheets.ts'
import { createCurvedSheetStratum } from '../model/constructors.ts'
import {
  boundaryPathSnapshotFromCurveStratum as boundaryPathSnapshotFromCurveStratumCore,
  isBoundarySurfaceBoundaryPathStratum as isBoundarySurfaceBoundaryPathStratumCore,
  normalizeCoonsPatchBoundarySources,
  orientedCoonsBoundarySnapshot,
  validateBoundarySurfaceBoundaryPathSource,
  validateCoonsPatchBoundaryPathSource as validateCoonsPatchBoundaryPathSourceCore,
  validateCoonsPatchBoundaryPointSource as validateCoonsPatchBoundaryPointSourceCore,
} from '../model/coonsPatchLinks.ts'
import {
  detachSampledCurvedSheetPrimitiveCoordinateReferences,
} from '../model/coordinateReferences.ts'
import {
  pathEndpointEpsilon,
} from '../model/paths.ts'
import { defaultSheetStyle } from '../model/styles.ts'
import {
  coonsPatchBoundaryRoles,
  coonsPatchRequiredCornerEquations,
  type CoonsPatchBoundaryRole,
  type CoonsPatchBoundarySources,
  type CoonsPatchCornerEndpoint,
  type CoonsPatchCornerEquation,
  type CoonsPatchCornerEquationId,
} from '../model/types.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  CoonsBoundarySnapshot,
  CoonsConstantPointBoundarySnapshot,
  CoonsPatchPrimitive,
  CurveStratum,
  Diagram,
  RuledSurfacePrimitive,
  SheetStyle,
  SurfaceSampling,
  Stratum,
  Vec3,
} from '../model/types.ts'
import { makeUniqueId } from './diagramUpdates.ts'

export const defaultRuledSurfaceSamplingSegments = 8
export const defaultCoonsPatchSampling: SurfaceSampling = {
  uSegments: 8,
  vSegments: 8,
}
export { coonsPatchBoundaryRoles, coonsPatchRequiredCornerEquations }
export type {
  CoonsPatchBoundaryRole,
  CoonsPatchCornerEndpoint,
  CoonsPatchCornerEquation,
  CoonsPatchCornerEquationId,
}
export type CoonsPatchBoundaryPathIds = Partial<
  Record<CoonsPatchBoundaryRole, string>
>
export type PickedCoonsPathBoundary = {
  kind?: 'path'
  sourcePathId: string
  reversed: boolean
}
export type PickedCoonsPointBoundary = {
  kind: 'point'
  sourcePointId: string
}
export type PickedCoonsBoundary =
  | PickedCoonsPathBoundary
  | PickedCoonsPointBoundary
export type CoonsPatchBoundaryPathSelection = string | PickedCoonsPathBoundary
export type CoonsPatchBoundaryPointSelection = PickedCoonsPointBoundary
export type CoonsPatchBoundarySelection =
  | CoonsPatchBoundaryPathSelection
  | CoonsPatchBoundaryPointSelection
export type CoonsPatchBoundaryPathSelections = Partial<
  Record<CoonsPatchBoundaryRole, CoonsPatchBoundarySelection>
>
export type CoonsPatchBoundarySnapshots = Record<
  CoonsPatchBoundaryRole,
  CoonsBoundarySnapshot
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
  | 'coordinateReferenceDetachFailed'
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
  | 'missingSourcePoint'
  | 'sourceNotBoundaryPoint'
  | 'sourceWrongCodimension'
  | 'sourceNonFinite'
  | 'sourceClosedPath'
  | 'invalidSampling'
  | 'coordinateReferenceDetachFailed'
  | 'invalidBoundary'

export type CreateCoonsPatchFromBoundaryPathsOptions = {
  id?: string
  name?: string
  layer?: number
  style?: SheetStyle
  sampling?: SurfaceSampling
  keepLinkedToBoundarySources?: boolean
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

export type CoonsPatchBoundaryPointSourceError =
  | 'missingSourcePoint'
  | 'sourceNotBoundaryPoint'
  | 'sourceWrongCodimension'
  | 'sourceNonFinite'

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

export type CoonsPatchBoundaryPointSourceValidationResult =
  | {
      ok: true
      boundary: CoonsConstantPointBoundarySnapshot
    }
  | {
      ok: false
      error: CoonsPatchBoundaryPointSourceError
    }

export type CoonsPatchCornerEquationStatus = CoonsPatchCornerEquation & {
  matches: boolean | null
  leftPoint?: Vec3
  rightPoint?: Vec3
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
    const boundaryResult = validateBoundarySurfaceBoundaryPathSource(
      diagram,
      sourcePathId,
    )

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
  const detachedPrimitive =
    detachSampledCurvedSheetPrimitiveCoordinateReferences(
      diagram,
      primitive,
      'primitive',
    )

  if (!detachedPrimitive.ok) {
    return {
      ok: false,
      diagram,
      error: 'coordinateReferenceDetachFailed',
    }
  }

  if (!validateCurvedSheetPrimitive(detachedPrimitive.value.primitive).valid) {
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
    primitive: detachedPrimitive.value.primitive,
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

  const boundarySources =
    options.keepLinkedToBoundarySources === false
      ? undefined
      : coonsPatchBoundarySourcesFromSelections(sourcePathIds)

  if (
    options.keepLinkedToBoundarySources !== false &&
    boundarySources === null
  ) {
    return {
      ok: false,
      diagram,
      error: 'wrongBoundaryCount',
    }
  }

  const primitive: CoonsPatchPrimitive = {
    kind: 'coonsPatch',
    bottom: boundaryResult.boundaries.bottom,
    right: boundaryResult.boundaries.right,
    top: boundaryResult.boundaries.top,
    left: boundaryResult.boundaries.left,
    ...(boundarySources === undefined || boundarySources === null
      ? {}
      : { boundarySources }),
    sampling: { ...sampling },
  }
  const detachedPrimitive =
    detachSampledCurvedSheetPrimitiveCoordinateReferences(
      diagram,
      primitive,
      'primitive',
    )

  if (!detachedPrimitive.ok) {
    return {
      ok: false,
      diagram,
      error: 'coordinateReferenceDetachFailed',
    }
  }

  if (!validateCurvedSheetPrimitive(detachedPrimitive.value.primitive).valid) {
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
    primitive: detachedPrimitive.value.primitive,
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

export { orientedCoonsBoundarySnapshot }

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

  const sourcePathIdsByRole = roleSelections.flatMap(({ selection }) =>
    selection !== null && selection.kind === 'path'
      ? [selection.sourcePathId]
      : [],
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

    const boundaryResult = resolveNormalizedCoonsPatchBoundarySnapshot(
      diagram,
      selection,
    )

    if (!boundaryResult.ok) {
      return {
        ok: false,
        error: boundaryResult.error,
        sourcePathId: boundaryResult.sourceId,
        role,
      }
    }

    boundaries[role] = boundaryResult.boundary
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

export function coonsPatchCornerEquationStatuses(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathSelections,
): CoonsPatchCornerEquationStatus[] {
  const boundaries = coonsPatchBoundarySnapshotsForStatus(diagram, sourcePathIds)

  return coonsPatchRequiredCornerEquations.map((equation) => {
    const leftPoint = coonsBoundaryEndpointForStatus(
      boundaries[equation.leftRole],
      equation.leftEndpoint,
    )
    const rightPoint = coonsBoundaryEndpointForStatus(
      boundaries[equation.rightRole],
      equation.rightEndpoint,
    )

    return {
      ...equation,
      matches:
        leftPoint === undefined || rightPoint === undefined
          ? null
          : vec3ApproximatelyEqual(leftPoint, rightPoint, pathEndpointEpsilon),
      ...(leftPoint === undefined ? {} : { leftPoint }),
      ...(rightPoint === undefined ? {} : { rightPoint }),
    }
  })
}

export function coonsPatchFailedCornerEquationLabels(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathSelections,
): string[] {
  return coonsPatchCornerEquationStatuses(diagram, sourcePathIds)
    .filter((status) => status.matches === false)
    .map((status) => status.label)
}

export function coonsPatchCornerMismatchMessage(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathSelections,
): string | null {
  const failed = coonsPatchFailedCornerEquationLabels(diagram, sourcePathIds)

  if (failed.length === 0) {
    return null
  }

  return `Coons corners do not match with current boundary directions. Failed: ${failed.join(
    '; ',
  )}. Use Reverse controls or choose a point/path with matching endpoint.`
}

export function isBoundarySurfaceBoundaryPathStratum(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): stratum is CurveStratum {
  return isBoundarySurfaceBoundaryPathStratumCore(stratum, ambientDimension)
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
  return validateBoundarySurfaceBoundaryPathSource(diagram, sourcePathId)
}

export function validateCoonsPatchBoundaryPathSource(
  diagram: Diagram,
  sourcePathId: string,
): CoonsPatchBoundaryPathSourceValidationResult {
  return validateCoonsPatchBoundaryPathSourceCore(diagram, sourcePathId)
}

export function validateCoonsPatchBoundaryPointSource(
  diagram: Diagram,
  sourcePointId: string,
): CoonsPatchBoundaryPointSourceValidationResult {
  return validateCoonsPatchBoundaryPointSourceCore(diagram, sourcePointId)
}

export function boundaryPathSnapshotFromCurveStratum(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): BoundaryPathSnapshot | null {
  return boundaryPathSnapshotFromCurveStratumCore(curve, ambientDimension)
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
    case 'coordinateReferenceDetachFailed':
      return 'Could not snapshot coordinate anchors into the ruled surface boundary.'
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
      return 'Pick bottom, right, top, and left boundary paths or points.'
    case 'duplicateSourcePath':
      return 'Use four different boundary paths for the Coons patch.'
    case 'missingSourcePath':
      return 'A picked Coons patch boundary path is no longer available.'
    case 'sourceNotBoundaryPath':
      return 'Picked sources must be paths, polylines, cubic Beziers, or path templates.'
    case 'missingSourcePoint':
      return 'A picked Coons patch boundary point is no longer available.'
    case 'sourceNotBoundaryPoint':
      return 'Picked constant Coons boundaries must be point strata.'
    case 'sourceWrongCodimension':
      return 'Picked boundary paths must be codimension 2 and picked boundary points must be codimension 3 in a 3D diagram.'
    case 'sourceNonFinite':
      return 'Picked boundary paths and points must have finite coordinates.'
    case 'sourceClosedPath':
      return role === undefined
        ? 'Coons patch boundaries must be open paths.'
        : `Coons patch ${role} boundary must be an open path.`
    case 'invalidSampling':
      return `Coons patch u and v sampling must be positive integers at most ${MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS}.`
    case 'coordinateReferenceDetachFailed':
      return 'Could not snapshot coordinate anchors into the Coons patch boundary.'
    case 'invalidBoundary':
      return 'Coons corners do not match with the current boundary directions. Check the failed corner equation, then use Reverse controls or choose a point/path with matching endpoints.'
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

export function coonsPatchBoundaryPointSourceErrorMessage(
  error: CoonsPatchBoundaryPointSourceError,
): string {
  switch (error) {
    case 'missingSourcePoint':
      return 'Picked Coons boundary point is no longer available.'
    case 'sourceNotBoundaryPoint':
      return 'Click a point for a constant Coons boundary.'
    case 'sourceWrongCodimension':
      return 'Coons boundary points must be codimension 3 in a 3D diagram.'
    case 'sourceNonFinite':
      return 'Coons boundary points must have finite coordinates.'
  }
}

type CoonsBoundaryResolveResult =
  | {
      ok: true
      boundary: CoonsBoundarySnapshot
    }
  | {
      ok: false
      error: CreateCoonsPatchFromBoundaryPathsError
      sourceId: string
    }

function resolveNormalizedCoonsPatchBoundarySnapshot(
  diagram: Diagram,
  selection: NormalizedCoonsPatchBoundarySelection,
): CoonsBoundaryResolveResult {
  if (selection.kind === 'point') {
    const pointResult = validateCoonsPatchBoundaryPointSourceCore(
      diagram,
      selection.sourcePointId,
    )

    return pointResult.ok
      ? { ok: true, boundary: pointResult.boundary }
      : {
          ok: false,
          error: pointResult.error,
          sourceId: selection.sourcePointId,
        }
  }

  const pathResult = validateCoonsPatchBoundaryPathSourceCore(
    diagram,
    selection.sourcePathId,
  )

  if (!pathResult.ok) {
    return {
      ok: false,
      error: pathResult.error,
      sourceId: selection.sourcePathId,
    }
  }

  return {
    ok: true,
    boundary: orientedCoonsBoundarySnapshot(
      pathResult.boundary,
      selection.reversed,
    ),
  }
}

function coonsPatchBoundarySnapshotsForStatus(
  diagram: Diagram,
  sourcePathIds: CoonsPatchBoundaryPathSelections,
): Partial<CoonsPatchBoundarySnapshots> {
  const boundaries: Partial<CoonsPatchBoundarySnapshots> = {}

  coonsPatchBoundaryRoles.forEach((role) => {
    const selection = normalizeCoonsPatchBoundarySelection(sourcePathIds[role])

    if (selection === null) {
      return
    }

    const boundaryResult = resolveNormalizedCoonsPatchBoundarySnapshot(
      diagram,
      selection,
    )

    if (boundaryResult.ok) {
      boundaries[role] = boundaryResult.boundary
    }
  })

  return boundaries
}

function coonsBoundaryEndpointForStatus(
  boundary: CoonsBoundarySnapshot | undefined,
  endpoint: CoonsPatchCornerEndpoint,
): Vec3 | undefined {
  if (boundary === undefined) {
    return undefined
  }

  try {
    return endpoint === 'start' ? boundaryStart(boundary) : boundaryEnd(boundary)
  } catch {
    return undefined
  }
}

function isValidBoundarySurfaceSamplingSegmentCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS
  )
}

type NormalizedCoonsPatchBoundarySelection =
  | {
      kind: 'path'
      sourcePathId: string
      reversed: boolean
    }
  | {
      kind: 'point'
      sourcePointId: string
    }

function normalizeCoonsPatchBoundarySelection(
  selection: CoonsPatchBoundarySelection | undefined,
): NormalizedCoonsPatchBoundarySelection | null {
  if (selection === undefined) {
    return null
  }

  if (typeof selection === 'string') {
    const sourcePathId = selection.trim()

    return sourcePathId.length === 0
      ? null
      : { kind: 'path', sourcePathId, reversed: false }
  }

  if (selection.kind === 'point') {
    const sourcePointId = selection.sourcePointId.trim()

    return sourcePointId.length === 0
      ? null
      : { kind: 'point', sourcePointId }
  }

  const sourcePathId = selection.sourcePathId.trim()

  return sourcePathId.length === 0
    ? null
    : { kind: 'path', sourcePathId, reversed: selection.reversed }
}

function coonsPatchBoundarySourcesFromSelections(
  selections: CoonsPatchBoundaryPathSelections,
): CoonsPatchBoundarySources | null {
  const bottom = normalizeCoonsPatchBoundarySelection(selections.bottom)
  const right = normalizeCoonsPatchBoundarySelection(selections.right)
  const top = normalizeCoonsPatchBoundarySelection(selections.top)
  const left = normalizeCoonsPatchBoundarySelection(selections.left)

  if (bottom === null || right === null || top === null || left === null) {
    return null
  }

  return normalizeCoonsPatchBoundarySources({ bottom, right, top, left })
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
