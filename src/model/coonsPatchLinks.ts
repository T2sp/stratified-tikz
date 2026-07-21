import {
  coonsPatchCornerEquationStatusesFromBoundaries,
  isBoundaryPathClosed,
  validateBoundaryPathSnapshot,
  validateCoonsBoundarySnapshot,
  validateCurvedSheetPrimitive,
} from '../geometry/curvedSheets.ts'
import { isFiniteVec3 } from '../geometry/workPlane.ts'
import {
  detachSampledCurvedSheetPrimitiveCoordinateReferences,
} from './coordinateReferences.ts'
import {
  cloneBoundaryPathSnapshot,
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  reverseBoundaryPathSnapshot,
  sampleTemplatePathPoints,
} from './paths.ts'
import type { ScalarInputValue } from './scalarExpressions.ts'
import {
  coonsPatchBoundaryRoles,
  isCoonsPatchBoundarySources,
  type AmbientDimension,
  type BoundaryPathSnapshot,
  type CoonsBoundarySnapshot,
  type CoonsConstantPointBoundarySnapshot,
  type CoonsPatchBoundaryRole,
  type CoonsPatchBoundarySource,
  type CoonsPatchBoundarySources,
  type CoonsPatchPrimitive,
  type CoordinateComponent,
  type CoordinateSource,
  type CubicBezierControlMode,
  type CurveStratum,
  type Diagram,
  type PathSegment,
  type PointStratum,
  type PathTemplate,
  type Stratum,
  type SymbolicVec3,
  type Vec3,
  type WorkPlaneFrameSnapshot,
} from './types.ts'

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
  | { ok: true; boundary: BoundaryPathSnapshot }
  | { ok: false; error: BoundarySurfaceBoundaryPathSourceError }

export type CoonsPatchBoundaryPathSourceValidationResult =
  | { ok: true; boundary: BoundaryPathSnapshot }
  | { ok: false; error: CoonsPatchBoundaryPathSourceError }

export type CoonsPatchBoundaryPointSourceValidationResult =
  | { ok: true; boundary: CoonsConstantPointBoundarySnapshot }
  | { ok: false; error: CoonsPatchBoundaryPointSourceError }

export type CoonsPatchBoundaryLinkIssueKind =
  | 'missingSource'
  | 'invalidSource'
  | 'coordinateReferenceResolutionFailure'
  | 'cornerMismatch'
  | 'invalidPatch'
  | 'snapshotOutOfDate'

export type CoonsPatchBoundaryLinkIssue = {
  kind: CoonsPatchBoundaryLinkIssueKind
  patchId: string
  role?: CoonsPatchBoundaryRole
  sourceId?: string
  message: string
}

export type CoonsPatchBoundaryLinkStatus =
  | { kind: 'static' }
  | { kind: 'linkedUpToDate' }
  | { kind: 'linkedStale'; issues: CoonsPatchBoundaryLinkIssue[] }

export type SynchronizeLinkedCoonsPatchesOptions = {
  mode?: 'changedSources' | 'full'
}

export type SynchronizeLinkedCoonsPatchesResult = {
  diagram: Diagram
  updatedPatchIds: string[]
  issues: CoonsPatchBoundaryLinkIssue[]
}

export type CoonsPatchBoundarySourceRemap = {
  pathSourceIds: ReadonlyMap<string, string>
  pointSourceIds: ReadonlyMap<string, string>
}

type LinkedPatchInspection = {
  sourceFingerprint: string
  candidate: CoonsPatchPrimitive | null
  issues: CoonsPatchBoundaryLinkIssue[]
}

type LinkedBoundaryFingerprintValue =
  | string
  | number
  | boolean
  | null
  | LinkedBoundaryFingerprintValue[]

export function synchronizeLinkedCoonsPatches(
  previousDiagram: Diagram | null,
  nextDiagram: Diagram,
  options: SynchronizeLinkedCoonsPatchesOptions = {},
): SynchronizeLinkedCoonsPatchesResult {
  const mode = options.mode ?? (previousDiagram === null ? 'full' : 'changedSources')
  const previousById = new Map(
    (previousDiagram?.strata ?? []).map((stratum) => [stratum.id, stratum]),
  )
  const updatedPatchIds: string[] = []
  const issues: CoonsPatchBoundaryLinkIssue[] = []
  let changed = false

  const strata = nextDiagram.strata.map((stratum) => {
    if (
      stratum.geometricKind !== 'sheet' ||
      stratum.kind !== 'curvedSheet' ||
      stratum.primitive.kind !== 'coonsPatch' ||
      stratum.primitive.boundarySources === undefined
    ) {
      return stratum
    }

    const nextInspection = inspectLinkedCoonsPatch(
      nextDiagram,
      stratum.id,
      stratum.primitive,
    )
    const nextSources = stratum.primitive.boundarySources
    issues.push(...nextInspection.issues)

    const previousStratum = previousById.get(stratum.id)
    const previousPrimitive =
      previousStratum?.geometricKind === 'sheet' &&
      previousStratum.kind === 'curvedSheet' &&
      previousStratum.primitive.kind === 'coonsPatch'
        ? previousStratum.primitive
        : null
    const previousSources = previousPrimitive?.boundarySources
    const nextSourcesValid = isCoonsPatchBoundarySources(nextSources)
    const previousSourcesValid = isCoonsPatchBoundarySources(previousSources)
    const sourcesChanged =
      mode === 'full' ||
      previousDiagram === null ||
      previousPrimitive === null ||
      !nextSourcesValid ||
      !previousSourcesValid ||
      inspectLinkedCoonsPatch(
        previousDiagram,
        stratum.id,
        previousPrimitive,
      ).sourceFingerprint !== nextInspection.sourceFingerprint

    if (sourcesChanged && nextInspection.candidate !== null) {
      if (
        coonsPatchMaterializedBoundariesEqual(
          stratum.primitive,
          nextInspection.candidate,
        ) &&
        stratum.primitive.boundarySnapshotState ===
          nextInspection.candidate.boundarySnapshotState
      ) {
        return stratum
      }

      changed = true
      updatedPatchIds.push(stratum.id)
      return {
        ...stratum,
        primitive: nextInspection.candidate,
      }
    }

    if (sourcesChanged && nextInspection.candidate === null) {
      const fallbackPrimitive =
        previousPrimitive === null
          ? stratum.primitive
          : restorePreviousCoonsPatchBoundaries(
              stratum.primitive,
              previousPrimitive,
            )
      const stalePrimitive: CoonsPatchPrimitive = {
        ...fallbackPrimitive,
        // A stale linked fallback retains the complete last-valid snapshot
        // model. Its saved previews, expressions, and provenance stay frozen
        // until one complete source-derived candidate is valid.
        boundarySnapshotState: 'frozen',
      }

      changed = true
      return {
        ...stratum,
        primitive: stalePrimitive,
      }
    }

    return stratum
  })

  return {
    diagram: changed ? { ...nextDiagram, strata } : nextDiagram,
    updatedPatchIds,
    issues,
  }
}

export function coonsPatchBoundaryLinkStatus(
  diagram: Diagram,
  patchId: string,
): CoonsPatchBoundaryLinkStatus {
  const stratum = diagram.strata.find((candidate) => candidate.id === patchId)

  if (
    stratum?.geometricKind !== 'sheet' ||
    stratum.kind !== 'curvedSheet' ||
    stratum.primitive.kind !== 'coonsPatch' ||
    stratum.primitive.boundarySources === undefined
  ) {
    return { kind: 'static' }
  }

  const inspection = inspectLinkedCoonsPatch(
    diagram,
    patchId,
    stratum.primitive,
  )

  if (inspection.candidate === null) {
    return { kind: 'linkedStale', issues: inspection.issues }
  }

  if (
    coonsPatchMaterializedBoundariesEqual(
      stratum.primitive,
      inspection.candidate,
    )
  ) {
    return { kind: 'linkedUpToDate' }
  }

  return {
    kind: 'linkedStale',
    issues: [
      ...inspection.issues,
      {
        kind: 'snapshotOutOfDate',
        patchId,
        message: 'Linked boundary snapshots are out of date.',
      },
    ],
  }
}

export function detachCoonsPatchBoundaryLinks(
  diagram: Diagram,
  patchId: string,
): Diagram {
  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (
      stratum.id !== patchId ||
      stratum.geometricKind !== 'sheet' ||
      stratum.kind !== 'curvedSheet' ||
      stratum.primitive.kind !== 'coonsPatch' ||
      stratum.primitive.boundarySources === undefined
    ) {
      return stratum
    }

    changed = true
    return {
      ...stratum,
      primitive: {
        kind: 'coonsPatch' as const,
        bottom: stratum.primitive.bottom,
        right: stratum.primitive.right,
        top: stratum.primitive.top,
        left: stratum.primitive.left,
        ...(stratum.primitive.boundarySnapshotState === undefined
          ? {}
          : {
              boundarySnapshotState:
                stratum.primitive.boundarySnapshotState,
            }),
        sampling: stratum.primitive.sampling,
      },
    }
  })

  return changed ? { ...diagram, strata } : diagram
}

export function coonsPatchBoundarySourceRemapForDuplicatedStrata(
  duplicatedStrata: readonly Stratum[],
  copiedIdBySourceId: ReadonlyMap<string, string>,
): CoonsPatchBoundarySourceRemap {
  const pathSourceIds = new Map<string, string>()
  const pointSourceIds = new Map<string, string>()

  for (const stratum of duplicatedStrata) {
    const copiedId = copiedIdBySourceId.get(stratum.id)

    if (copiedId === undefined) {
      continue
    }

    if (isCoonsPatchBoundaryPathSourceStratum(stratum)) {
      pathSourceIds.set(stratum.id, copiedId)
      continue
    }

    if (isCoonsPatchBoundaryPointSourceStratum(stratum)) {
      pointSourceIds.set(stratum.id, copiedId)
    }
  }

  return { pathSourceIds, pointSourceIds }
}

export function remapCoonsPatchBoundarySources(
  primitive: CoonsPatchPrimitive,
  remap: CoonsPatchBoundarySourceRemap,
): CoonsPatchPrimitive {
  if (
    primitive.boundarySources === undefined ||
    !isCoonsPatchBoundarySources(primitive.boundarySources) ||
    (remap.pathSourceIds.size === 0 && remap.pointSourceIds.size === 0)
  ) {
    return primitive
  }

  let changed = false
  const boundarySources = mapCoonsPatchBoundarySources(
    primitive.boundarySources,
    (source) => {
      const remappedId =
        source.kind === 'path'
          ? remap.pathSourceIds.get(source.sourcePathId)
          : remap.pointSourceIds.get(source.sourcePointId)

      if (remappedId === undefined) {
        return source
      }

      changed = true
      return source.kind === 'path'
        ? { ...source, sourcePathId: remappedId }
        : { ...source, sourcePointId: remappedId }
    },
  )

  return changed ? { ...primitive, boundarySources } : primitive
}

export function remapLinkedCoonsPatchSourcesInStratum(
  stratum: Stratum,
  remap: CoonsPatchBoundarySourceRemap,
): Stratum {
  if (
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'curvedSheet' ||
    stratum.primitive.kind !== 'coonsPatch'
  ) {
    return stratum
  }

  const primitive = remapCoonsPatchBoundarySources(stratum.primitive, remap)

  return primitive === stratum.primitive ? stratum : { ...stratum, primitive }
}

export function cloneCoonsPatchBoundarySources(
  sources: CoonsPatchBoundarySources,
): CoonsPatchBoundarySources {
  return mapCoonsPatchBoundarySources(sources, (source) => ({ ...source }))
}

export function normalizeCoonsPatchBoundarySources(
  sources: CoonsPatchBoundarySources,
): CoonsPatchBoundarySources {
  return mapCoonsPatchBoundarySources(sources, (source) =>
    source.kind === 'path'
      ? {
          kind: 'path',
          sourcePathId: source.sourcePathId.trim(),
          reversed: source.reversed,
        }
      : {
          kind: 'point',
          sourcePointId: source.sourcePointId.trim(),
        },
  )
}

export function coonsPatchBoundarySourceId(
  source: CoonsPatchBoundarySource,
): string {
  return source.kind === 'path' ? source.sourcePathId : source.sourcePointId
}

export function orientedCoonsBoundarySnapshot(
  sourceSnapshot: CoonsBoundarySnapshot,
  reversed: boolean,
): CoonsBoundarySnapshot {
  if (isCoonsConstantPointBoundary(sourceSnapshot)) {
    return cloneCoonsConstantPointBoundarySnapshot(sourceSnapshot)
  }

  return reversed
    ? reverseBoundaryPathSnapshot(sourceSnapshot)
    : cloneBoundaryPathSnapshot(sourceSnapshot)
}

export function validateBoundarySurfaceBoundaryPathSource(
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
    return { ok: false, error: 'sourceClosedPath' }
  }

  return result
}

export function validateCoonsPatchBoundaryPointSource(
  diagram: Diagram,
  sourcePointId: string,
): CoonsPatchBoundaryPointSourceValidationResult {
  return loadCoonsConstantPointBoundarySnapshot(diagram, sourcePointId)
}

export function boundaryPathSnapshotFromCurveStratum(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): BoundaryPathSnapshot | null {
  if (curve.kind === 'grid') {
    return null
  }

  const segments = boundaryPathSegmentsFromCurve(curve, ambientDimension)

  return segments.length === 0
    ? null
    : { id: curve.id, name: curve.name, segments }
}

export function isBoundarySurfaceBoundaryPathStratum(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): stratum is CurveStratum {
  return (
    isCoonsPatchBoundaryPathSourceStratum(stratum) &&
    stratum.codim === expectedBoundaryPathCodim(ambientDimension) &&
    boundaryPathSnapshotFromCurveStratum(stratum, ambientDimension) !== null
  )
}

function inspectLinkedCoonsPatch(
  diagram: Diagram,
  patchId: string,
  primitive: CoonsPatchPrimitive,
): LinkedPatchInspection {
  const sources = primitive.boundarySources

  if (sources === undefined) {
    return { sourceFingerprint: 'static', candidate: null, issues: [] }
  }

  if (!isCoonsPatchBoundarySources(sources)) {
    return {
      sourceFingerprint: 'malformed',
      candidate: null,
      issues: [
        {
          kind: 'invalidSource',
          patchId,
          message: 'Linked boundary source metadata is malformed.',
        },
      ],
    }
  }

  const boundaries: Partial<Record<CoonsPatchBoundaryRole, CoonsBoundarySnapshot>> = {}
  const issues: CoonsPatchBoundaryLinkIssue[] = []
  const sourceStates = coonsPatchBoundaryRoles.map((role) =>
    linkedCoonsBoundarySourceState(diagram, sources[role], role),
  )

  for (const role of coonsPatchBoundaryRoles) {
    const source = sources[role]
    const sourceId = coonsPatchBoundarySourceId(source)
    const result = resolveBoundarySource(diagram, source)

    if (!result.ok) {
      const issue = sourceLinkIssue(patchId, role, source, result.error)
      issues.push(issue)
      continue
    }

    boundaries[role] = result.boundary

    if (sourceId.length === 0) {
      issues.push({
        kind: 'invalidSource',
        patchId,
        role,
        sourceId,
        message: `${role}: source id is empty`,
      })
    }
  }

  if (!hasAllCoonsBoundaries(boundaries)) {
    return {
      sourceFingerprint: linkedCoonsBoundarySourcesFingerprint(sourceStates),
      candidate: null,
      issues,
    }
  }

  const unresolvedCandidate: CoonsPatchPrimitive = {
    ...coonsPatchPrimitiveWithoutFrozenSnapshotState(primitive),
    bottom: boundaries.bottom,
    right: boundaries.right,
    top: boundaries.top,
    left: boundaries.left,
    boundarySources: cloneCoonsPatchBoundarySources(sources),
  }
  const detached = detachSampledCurvedSheetPrimitiveCoordinateReferences(
    diagram,
    unresolvedCandidate,
    'primitive',
  )

  if (!detached.ok || detached.value.primitive.kind !== 'coonsPatch') {
    const error = detached.ok
      ? { path: 'primitive', message: 'Resolved primitive kind changed.' }
      : detached.error

    return {
      sourceFingerprint: linkedCoonsBoundarySourcesFingerprint(sourceStates),
      candidate: null,
      issues: [
        ...issues,
        {
          kind: 'coordinateReferenceResolutionFailure',
          patchId,
          role: roleFromPrimitivePath(error.path),
          message: `Could not resolve linked boundary coordinate references: ${error.message}`,
        },
      ],
    }
  }

  const candidate = detached.value.primitive
  const sourceFingerprint = linkedCoonsBoundarySourcesFingerprint(
    sourceStates,
    candidate,
  )
  const validation = validateCurvedSheetPrimitive(candidate)

  if (validation.valid) {
    return { sourceFingerprint, candidate, issues }
  }

  const cornerIssues = coonsPatchCornerEquationStatusesFromBoundaries({
    bottom: candidate.bottom,
    right: candidate.right,
    top: candidate.top,
    left: candidate.left,
  })
    .filter((status) => !status.matches)
    .map<CoonsPatchBoundaryLinkIssue>((status) => ({
      kind: 'cornerMismatch',
      patchId,
      role: status.leftRole,
      message: `Corner mismatch: ${status.label}`,
    }))
  const candidateIssues =
    cornerIssues.length > 0
      ? cornerIssues
      : validation.errors.map<CoonsPatchBoundaryLinkIssue>((error) => ({
          kind: 'invalidPatch',
          patchId,
          role: roleFromPrimitivePath(error.path),
          message: error.message,
        }))

  return {
    sourceFingerprint,
    candidate: null,
    issues: [...issues, ...candidateIssues],
  }
}

function resolveBoundarySource(
  diagram: Diagram,
  source: CoonsPatchBoundarySource,
):
  | { ok: true; boundary: CoonsBoundarySnapshot }
  | {
      ok: false
      error: CoonsPatchBoundaryPathSourceError | CoonsPatchBoundaryPointSourceError
    } {
  if (source.kind === 'point') {
    return validateCoonsPatchBoundaryPointSource(diagram, source.sourcePointId)
  }

  const result = validateCoonsPatchBoundaryPathSource(
    diagram,
    source.sourcePathId,
  )

  return result.ok
    ? {
        ok: true,
        boundary: orientedCoonsBoundarySnapshot(
          result.boundary,
          source.reversed,
        ),
      }
    : result
}

function sourceLinkIssue(
  patchId: string,
  role: CoonsPatchBoundaryRole,
  source: CoonsPatchBoundarySource,
  error: CoonsPatchBoundaryPathSourceError | CoonsPatchBoundaryPointSourceError,
): CoonsPatchBoundaryLinkIssue {
  const sourceId = coonsPatchBoundarySourceId(source)
  const missing = error === 'missingSourcePath' || error === 'missingSourcePoint'

  return {
    kind: missing ? 'missingSource' : 'invalidSource',
    patchId,
    role,
    sourceId,
    message: `${role}: ${sourceErrorMessage(error)}`,
  }
}

function sourceErrorMessage(
  error: CoonsPatchBoundaryPathSourceError | CoonsPatchBoundaryPointSourceError,
): string {
  switch (error) {
    case 'missingSourcePath':
      return 'source path is missing'
    case 'missingSourcePoint':
      return 'source point is missing'
    case 'sourceNotBoundaryPath':
      return 'source is not a supported boundary path'
    case 'sourceNotBoundaryPoint':
      return 'source is not a point'
    case 'sourceWrongCodimension':
      return 'source has the wrong codimension'
    case 'sourceNonFinite':
      return 'source geometry is non-finite'
    case 'sourceClosedPath':
      return 'source path is closed'
    case 'invalidBoundary':
      return 'source path is invalid'
  }
}

function loadBoundaryPathSnapshot(
  diagram: Diagram,
  sourcePathId: string,
): BoundarySurfaceBoundaryPathSourceValidationResult {
  const source = diagram.strata.find((stratum) => stratum.id === sourcePathId)

  if (source === undefined) {
    return { ok: false, error: 'missingSourcePath' }
  }

  if (!isCoonsPatchBoundaryPathSourceStratum(source)) {
    return { ok: false, error: 'sourceNotBoundaryPath' }
  }

  if (source.codim !== expectedBoundaryPathCodim(diagram.ambientDimension)) {
    return { ok: false, error: 'sourceWrongCodimension' }
  }

  const boundary = boundaryPathSnapshotFromCurveStratum(
    source,
    diagram.ambientDimension,
  )

  if (boundary === null) {
    return { ok: false, error: 'sourceNotBoundaryPath' }
  }

  if (!pathCoordinates(boundary.segments).every(isFiniteVec3)) {
    return { ok: false, error: 'sourceNonFinite' }
  }

  if (!validateBoundaryPathSnapshot(boundary).valid) {
    return { ok: false, error: 'invalidBoundary' }
  }

  return { ok: true, boundary }
}

function loadCoonsConstantPointBoundarySnapshot(
  diagram: Diagram,
  sourcePointId: string,
): CoonsPatchBoundaryPointSourceValidationResult {
  const source = diagram.strata.find((stratum) => stratum.id === sourcePointId)

  if (source === undefined) {
    return { ok: false, error: 'missingSourcePoint' }
  }

  if (!isCoonsPatchBoundaryPointSourceStratum(source)) {
    return { ok: false, error: 'sourceNotBoundaryPoint' }
  }

  if (source.codim !== expectedBoundaryPointCodim(diagram.ambientDimension)) {
    return { ok: false, error: 'sourceWrongCodimension' }
  }

  if (!isFiniteVec3(source.position)) {
    return { ok: false, error: 'sourceNonFinite' }
  }

  const boundary: CoonsConstantPointBoundarySnapshot = {
    kind: 'constantPoint',
    sourceId: source.id,
    ...(source.name.trim().length === 0 ? {} : { name: source.name }),
    point: cloneVec3(source.position),
  }

  return validateCoonsBoundarySnapshot(boundary).valid
    ? { ok: true, boundary }
    : { ok: false, error: 'sourceNonFinite' }
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

function coonsPatchMaterializedBoundariesEqual(
  left: CoonsPatchPrimitive,
  right: CoonsPatchPrimitive,
): boolean {
  return (
    coonsBoundaryPersistedSemanticFingerprint(left.bottom) ===
      coonsBoundaryPersistedSemanticFingerprint(right.bottom) &&
    coonsBoundaryPersistedSemanticFingerprint(left.right) ===
      coonsBoundaryPersistedSemanticFingerprint(right.right) &&
    coonsBoundaryPersistedSemanticFingerprint(left.top) ===
      coonsBoundaryPersistedSemanticFingerprint(right.top) &&
    coonsBoundaryPersistedSemanticFingerprint(left.left) ===
      coonsBoundaryPersistedSemanticFingerprint(right.left)
  )
}

function restorePreviousCoonsPatchBoundaries(
  nextPrimitive: CoonsPatchPrimitive,
  previousPrimitive: CoonsPatchPrimitive,
): CoonsPatchPrimitive {
  return {
    ...nextPrimitive,
    bottom: cloneCoonsBoundarySnapshot(previousPrimitive.bottom),
    right: cloneCoonsBoundarySnapshot(previousPrimitive.right),
    top: cloneCoonsBoundarySnapshot(previousPrimitive.top),
    left: cloneCoonsBoundarySnapshot(previousPrimitive.left),
  }
}

function coonsPatchPrimitiveWithoutFrozenSnapshotState(
  primitive: CoonsPatchPrimitive,
): CoonsPatchPrimitive {
  if (primitive.boundarySnapshotState === undefined) {
    return primitive
  }

  const candidate = { ...primitive }
  delete candidate.boundarySnapshotState
  return candidate
}

function linkedCoonsBoundarySourcesFingerprint(
  sourceStates: LinkedBoundaryFingerprintValue[],
  candidate?: CoonsPatchPrimitive,
): string {
  return JSON.stringify([
    'linkedCoonsBoundarySources',
    sourceStates,
    candidate === undefined
      ? null
      : coonsPatchPersistedBoundarySemanticState(candidate),
  ])
}

// This is deliberately narrower than a stratum comparison. It records only
// source identity plus geometry/provenance that can determine a materialized
// boundary; names, styles, layers, labels, arrows, and UI state are excluded.
function linkedCoonsBoundarySourceState(
  diagram: Diagram,
  source: CoonsPatchBoundarySource,
  role: CoonsPatchBoundaryRole,
): LinkedBoundaryFingerprintValue {
  const sourceId = coonsPatchBoundarySourceId(source)
  const stratum = diagram.strata.find((candidate) => candidate.id === sourceId)
  const descriptor: LinkedBoundaryFingerprintValue =
    source.kind === 'path'
      ? ['path', source.sourcePathId, source.reversed]
      : ['point', source.sourcePointId]

  if (stratum === undefined) {
    return [role, descriptor, 'missing']
  }

  if (source.kind === 'point') {
    return stratum.geometricKind === 'point'
      ? [
          role,
          descriptor,
          'pointSource',
          stratum.codim,
          vec3PersistedSemanticState(stratum.position),
        ]
      : [role, descriptor, 'incompatibleSource', stratum.geometricKind, stratum.codim]
  }

  return stratum.geometricKind === 'curve'
    ? [
        role,
        descriptor,
        'pathSource',
        stratum.codim,
        curveBoundarySourceSemanticState(stratum),
      ]
    : [role, descriptor, 'incompatibleSource', stratum.geometricKind, stratum.codim]
}

function curveBoundarySourceSemanticState(
  curve: CurveStratum,
): LinkedBoundaryFingerprintValue {
  switch (curve.kind) {
    case 'polyline':
      return [
        'polyline',
        curve.points.map(vec3PersistedSemanticState),
      ]
    case 'cubicBezier':
      return [
        'cubicBezier',
        curve.points.map(vec3PersistedSemanticState),
        cubicBezierControlModeSemanticState(curve.bezierControls),
      ]
    case 'concatenatedPath':
      return [
        'concatenatedPath',
        curve.segments.map(pathSegmentPersistedSemanticState),
      ]
    case 'templatePath':
      return ['templatePath', pathTemplateSemanticState(curve.template)]
    case 'grid':
      return ['grid']
  }
}

function pathTemplateSemanticState(
  template: PathTemplate,
): LinkedBoundaryFingerprintValue {
  switch (template.kind) {
    case 'circleTemplate':
      return [
        'circleTemplate',
        vec3PersistedSemanticState(template.center),
        template.radius,
        workPlaneFrameSemanticState(template.frame),
      ]
    case 'ellipseTemplate':
      return [
        'ellipseTemplate',
        vec3PersistedSemanticState(template.center),
        template.radiusX,
        template.radiusY,
        template.rotationDeg ?? null,
        workPlaneFrameSemanticState(template.frame),
      ]
  }
}

function coonsPatchPersistedBoundarySemanticState(
  primitive: CoonsPatchPrimitive,
): LinkedBoundaryFingerprintValue {
  return [
    'coonsPatchBoundaries',
    ...coonsPatchBoundaryRoles.map((role) => [
      role,
      coonsBoundaryPersistedSemanticState(primitive[role]),
    ] satisfies LinkedBoundaryFingerprintValue),
  ]
}

// Snapshot ids/names are display identity, not geometry. Duplication remaps
// boundarySources while intentionally retaining independently cloned snapshot
// identity fields, so currentness is based on the persisted geometry-bearing
// representation below, including symbolic expressions and preview metadata.
function coonsBoundaryPersistedSemanticFingerprint(
  boundary: CoonsBoundarySnapshot,
): string {
  return JSON.stringify(coonsBoundaryPersistedSemanticState(boundary))
}

function coonsBoundaryPersistedSemanticState(
  boundary: CoonsBoundarySnapshot,
): LinkedBoundaryFingerprintValue {
  if (isCoonsConstantPointBoundary(boundary)) {
    return ['point', vec3PersistedSemanticState(boundary.point)]
  }

  return ['path', boundary.segments.map(pathSegmentPersistedSemanticState)]
}

function pathSegmentPersistedSemanticState(
  segment: PathSegment,
): LinkedBoundaryFingerprintValue {
  switch (segment.kind) {
    case 'line':
      return [
        'line',
        vec3PersistedSemanticState(segment.start),
        vec3PersistedSemanticState(segment.end),
      ]
    case 'cubicBezier':
      return [
        'cubicBezier',
        vec3PersistedSemanticState(segment.start),
        vec3PersistedSemanticState(segment.control1),
        vec3PersistedSemanticState(segment.control2),
        vec3PersistedSemanticState(segment.end),
        cubicBezierControlModeSemanticState(segment.controlMode),
      ]
    case 'arc':
      return [
        'arc',
        vec3PersistedSemanticState(segment.start),
        vec3PersistedSemanticState(segment.end),
        vec3PersistedSemanticState(segment.center),
        scalarInputSemanticState(segment.radius),
        scalarInputSemanticState(segment.startAngleDeg),
        scalarInputSemanticState(segment.endAngleDeg),
        segment.direction,
        workPlaneFrameSemanticState(segment.frame),
      ]
  }
}

function cubicBezierControlModeSemanticState(
  controlMode: CubicBezierControlMode | undefined,
): LinkedBoundaryFingerprintValue {
  if (controlMode === undefined) {
    return null
  }

  switch (controlMode.kind) {
    case 'absolute':
      return ['absolute']
    case 'relativeCartesian':
      return [
        'relativeCartesian',
        vec3PersistedSemanticState(controlMode.firstControlOffset),
        vec3PersistedSemanticState(controlMode.secondControlOffset),
        controlMode.secondOffsetReference,
      ]
    case 'relativePolar':
      return [
        'relativePolar',
        controlMode.firstControl.angleDegrees,
        controlMode.firstControl.radius,
        controlMode.secondControl.angleDegrees,
        controlMode.secondControl.radius,
        controlMode.secondOffsetReference,
      ]
    case 'workPlaneRelativeCartesian':
      return [
        'workPlaneRelativeCartesian',
        workPlaneFrameSemanticState(controlMode.frame),
        controlMode.localStart.a,
        controlMode.localStart.b,
        controlMode.localEnd.a,
        controlMode.localEnd.b,
        controlMode.firstControlOffset.dx,
        controlMode.firstControlOffset.dy,
        controlMode.secondControlOffset.dx,
        controlMode.secondControlOffset.dy,
        controlMode.secondOffsetReference,
      ]
    case 'workPlaneRelativePolar':
      return [
        'workPlaneRelativePolar',
        workPlaneFrameSemanticState(controlMode.frame),
        controlMode.localStart.a,
        controlMode.localStart.b,
        controlMode.localEnd.a,
        controlMode.localEnd.b,
        controlMode.firstControl.angleDegrees,
        controlMode.firstControl.radius,
        controlMode.secondControl.angleDegrees,
        controlMode.secondControl.radius,
        controlMode.secondOffsetReference,
      ]
  }
}

function vec3PersistedSemanticState(
  point: Vec3,
): LinkedBoundaryFingerprintValue {
  return [
    'vec3',
    point.x,
    point.y,
    point.z,
    symbolicVec3SemanticState(point.symbolic),
  ]
}

function symbolicVec3SemanticState(
  symbolic: SymbolicVec3 | undefined,
): LinkedBoundaryFingerprintValue {
  return symbolic === undefined
    ? null
    : [
        'symbolicVec3',
        coordinateComponentSemanticState(symbolic.x),
        coordinateComponentSemanticState(symbolic.y),
        coordinateComponentSemanticState(symbolic.z),
        coordinateSourceSemanticState(symbolic.source),
      ]
}

function coordinateComponentSemanticState(
  component: CoordinateComponent,
): LinkedBoundaryFingerprintValue {
  return component.kind === 'numeric'
    ? ['numeric', component.value]
    : ['symbolic', component.expression, component.previewValue]
}

function coordinateSourceSemanticState(
  source: CoordinateSource | undefined,
): LinkedBoundaryFingerprintValue {
  if (source === undefined) {
    return null
  }

  switch (source.kind) {
    case 'coordinateRef':
      return [
        'coordinateRef',
        source.coordinateId,
        vec3PersistedSemanticState(source.preview),
      ]
    case 'workPlaneLocal':
      return [
        'workPlaneLocal',
        workPlaneFrameSemanticState(source.frame),
        scalarInputSemanticState(source.local.a),
        scalarInputSemanticState(source.local.b),
      ]
  }
}

function scalarInputSemanticState(
  value: number | ScalarInputValue,
): LinkedBoundaryFingerprintValue {
  if (typeof value === 'number') {
    return ['number', value]
  }

  return value.kind === 'numeric'
    ? ['numeric', value.value]
    : ['symbolic', value.expression, value.previewValue]
}

function workPlaneFrameSemanticState(
  frame: WorkPlaneFrameSnapshot | undefined,
): LinkedBoundaryFingerprintValue {
  return frame === undefined
    ? null
    : [
        'frame',
        vec3PersistedSemanticState(frame.origin),
        vec3PersistedSemanticState(frame.u),
        vec3PersistedSemanticState(frame.v),
        vec3PersistedSemanticState(frame.normal),
      ]
}

function hasAllCoonsBoundaries(
  boundaries: Partial<Record<CoonsPatchBoundaryRole, CoonsBoundarySnapshot>>,
): boundaries is Record<CoonsPatchBoundaryRole, CoonsBoundarySnapshot> {
  return coonsPatchBoundaryRoles.every((role) => boundaries[role] !== undefined)
}

function mapCoonsPatchBoundarySources(
  sources: CoonsPatchBoundarySources,
  mapper: (source: CoonsPatchBoundarySource) => CoonsPatchBoundarySource,
): CoonsPatchBoundarySources {
  return {
    bottom: mapper(sources.bottom),
    right: mapper(sources.right),
    top: mapper(sources.top),
    left: mapper(sources.left),
  }
}

function roleFromPrimitivePath(
  path: string,
): CoonsPatchBoundaryRole | undefined {
  return coonsPatchBoundaryRoles.find((role) =>
    path.includes(`.${role}`),
  )
}

function expectedBoundaryPathCodim(ambientDimension: AmbientDimension): 1 | 2 {
  return ambientDimension === 2 ? 1 : 2
}

function expectedBoundaryPointCodim(ambientDimension: AmbientDimension): 2 | 3 {
  return ambientDimension === 2 ? 2 : 3
}

function isCoonsPatchBoundaryPathSourceStratum(
  stratum: Stratum,
): stratum is CurveStratum {
  return stratum.geometricKind === 'curve' && stratum.kind !== 'grid'
}

function isCoonsPatchBoundaryPointSourceStratum(
  stratum: Stratum,
): stratum is PointStratum {
  return stratum.geometricKind === 'point'
}

function isCoonsConstantPointBoundary(
  boundary: CoonsBoundarySnapshot,
): boundary is CoonsConstantPointBoundarySnapshot {
  return 'kind' in boundary && boundary.kind === 'constantPoint'
}

function cloneCoonsConstantPointBoundarySnapshot(
  boundary: CoonsConstantPointBoundarySnapshot,
): CoonsConstantPointBoundarySnapshot {
  return {
    kind: 'constantPoint',
    ...(boundary.sourceId === undefined ? {} : { sourceId: boundary.sourceId }),
    ...(boundary.name === undefined ? {} : { name: boundary.name }),
    point: cloneVec3(boundary.point),
  }
}

function cloneCoonsBoundarySnapshot(
  boundary: CoonsBoundarySnapshot,
): CoonsBoundarySnapshot {
  return isCoonsConstantPointBoundary(boundary)
    ? cloneCoonsConstantPointBoundarySnapshot(boundary)
    : cloneBoundaryPathSnapshot(boundary)
}

function cloneVec3(point: Vec3): Vec3 {
  return structuredClone(point) as Vec3
}
