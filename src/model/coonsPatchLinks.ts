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
  arcScalarPreviewValue,
  cloneBoundaryPathSnapshot,
  normalizePathSegmentsForAmbientDimension,
  pathCoordinates,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  reverseBoundaryPathSnapshot,
  sampleTemplatePathPoints,
} from './paths.ts'
import {
  coonsPatchBoundaryRoles,
  type AmbientDimension,
  type BoundaryPathSnapshot,
  type CoonsBoundarySnapshot,
  type CoonsConstantPointBoundarySnapshot,
  type CoonsPatchBoundaryRole,
  type CoonsPatchBoundarySource,
  type CoonsPatchBoundarySources,
  type CoonsPatchPrimitive,
  type CurveStratum,
  type Diagram,
  type PathSegment,
  type PointStratum,
  type Stratum,
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

type LinkedPatchInspection = {
  sourceFingerprint: string
  candidate: CoonsPatchPrimitive | null
  issues: CoonsPatchBoundaryLinkIssue[]
}

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
      previousStratum.primitive.kind === 'coonsPatch' &&
      previousStratum.primitive.boundarySources !== undefined
        ? previousStratum.primitive
        : null
    const sourcesChanged =
      mode === 'full' ||
      previousDiagram === null ||
      previousPrimitive === null ||
      previousPrimitive.boundarySources === undefined ||
      !coonsPatchBoundarySourcesEqual(
        previousPrimitive.boundarySources,
        nextSources,
      ) ||
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
        )
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
        sampling: stratum.primitive.sampling,
      },
    }
  })

  return changed ? { ...diagram, strata } : diagram
}

export function remapCoonsPatchBoundarySourceIds(
  primitive: CoonsPatchPrimitive,
  idMap: ReadonlyMap<string, string>,
): CoonsPatchPrimitive {
  if (primitive.boundarySources === undefined || idMap.size === 0) {
    return primitive
  }

  let changed = false
  const boundarySources = mapCoonsPatchBoundarySources(
    primitive.boundarySources,
    (source) => {
      const sourceId = coonsPatchBoundarySourceId(source)
      const remappedId = idMap.get(sourceId)

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
  idMap: ReadonlyMap<string, string>,
): Stratum {
  if (
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'curvedSheet' ||
    stratum.primitive.kind !== 'coonsPatch'
  ) {
    return stratum
  }

  const primitive = remapCoonsPatchBoundarySourceIds(stratum.primitive, idMap)

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
    stratum.geometricKind === 'curve' &&
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

  const boundaries: Partial<Record<CoonsPatchBoundaryRole, CoonsBoundarySnapshot>> = {}
  const issues: CoonsPatchBoundaryLinkIssue[] = []
  const unresolvedFingerprint: string[] = []

  for (const role of coonsPatchBoundaryRoles) {
    const source = sources[role]
    const sourceId = coonsPatchBoundarySourceId(source)
    const result = resolveBoundarySource(diagram, source)

    if (!result.ok) {
      const issue = sourceLinkIssue(patchId, role, source, result.error)
      issues.push(issue)
      unresolvedFingerprint.push(`${role}:error:${result.error}`)
      continue
    }

    boundaries[role] = result.boundary
    unresolvedFingerprint.push(
      `${role}:ok:${coonsBoundaryGeometryFingerprint(result.boundary)}`,
    )

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
      sourceFingerprint: unresolvedFingerprint.join('|'),
      candidate: null,
      issues,
    }
  }

  const unresolvedCandidate: CoonsPatchPrimitive = {
    ...primitive,
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
      sourceFingerprint: unresolvedFingerprint.join('|'),
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
  const sourceFingerprint = coonsPatchBoundaryGeometryFingerprint(candidate)
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

  if (source.geometricKind !== 'curve') {
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

  if (source.geometricKind !== 'point') {
    return { ok: false, error: 'sourceNotBoundaryPoint' }
  }

  if (source.codim !== expectedBoundaryPointCodim(diagram.ambientDimension)) {
    return { ok: false, error: 'sourceWrongCodimension' }
  }

  if (!isCoonsBoundaryPointStratum(source, diagram.ambientDimension)) {
    return { ok: false, error: 'sourceNotBoundaryPoint' }
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

function coonsPatchBoundarySourcesEqual(
  left: CoonsPatchBoundarySources,
  right: CoonsPatchBoundarySources,
): boolean {
  return coonsPatchBoundaryRoles.every(
    (role) => JSON.stringify(left[role]) === JSON.stringify(right[role]),
  )
}

function coonsPatchMaterializedBoundariesEqual(
  left: CoonsPatchPrimitive,
  right: CoonsPatchPrimitive,
): boolean {
  return (
    coonsBoundaryGeometryFingerprint(left.bottom) ===
      coonsBoundaryGeometryFingerprint(right.bottom) &&
    coonsBoundaryGeometryFingerprint(left.right) ===
      coonsBoundaryGeometryFingerprint(right.right) &&
    coonsBoundaryGeometryFingerprint(left.top) ===
      coonsBoundaryGeometryFingerprint(right.top) &&
    coonsBoundaryGeometryFingerprint(left.left) ===
      coonsBoundaryGeometryFingerprint(right.left)
  )
}

function coonsPatchBoundaryGeometryFingerprint(
  primitive: CoonsPatchPrimitive,
): string {
  return coonsPatchBoundaryRoles
    .map(
      (role) => `${role}:${coonsBoundaryGeometryFingerprint(primitive[role])}`,
    )
    .join('|')
}

function coonsBoundaryGeometryFingerprint(
  boundary: CoonsBoundarySnapshot,
): string {
  if (isCoonsConstantPointBoundary(boundary)) {
    return JSON.stringify(['point', vec3Geometry(boundary.point)])
  }

  return JSON.stringify(
    boundary.segments.map((segment) => {
      switch (segment.kind) {
        case 'line':
          return ['line', vec3Geometry(segment.start), vec3Geometry(segment.end)]
        case 'cubicBezier':
          return [
            'cubicBezier',
            vec3Geometry(segment.start),
            vec3Geometry(segment.control1),
            vec3Geometry(segment.control2),
            vec3Geometry(segment.end),
          ]
        case 'arc':
          return [
            'arc',
            vec3Geometry(segment.start),
            vec3Geometry(segment.end),
            vec3Geometry(segment.center),
            arcScalarPreviewValue(segment.radius),
            arcScalarPreviewValue(segment.startAngleDeg),
            arcScalarPreviewValue(segment.endAngleDeg),
            segment.direction,
            frameGeometry(segment.frame),
          ]
      }
    }),
  )
}

function frameGeometry(frame: WorkPlaneFrameSnapshot | undefined): unknown {
  return frame === undefined
    ? null
    : [
        vec3Geometry(frame.origin),
        vec3Geometry(frame.u),
        vec3Geometry(frame.v),
        vec3Geometry(frame.normal),
      ]
}

function vec3Geometry(point: Vec3): [number, number, number] {
  return [point.x, point.y, point.z]
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

function isCoonsBoundaryPointStratum(
  stratum: Stratum,
  ambientDimension: AmbientDimension,
): stratum is PointStratum {
  return (
    stratum.geometricKind === 'point' &&
    stratum.codim === expectedBoundaryPointCodim(ambientDimension)
  )
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

function cloneVec3(point: Vec3): Vec3 {
  return structuredClone(point) as Vec3
}
