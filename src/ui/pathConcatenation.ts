import { createConcatenatedPathStratum } from '../model/constructors.ts'
import { cleanPathCrossingStates } from '../model/pathCrossings.ts'
import {
  arcScalarPreviewValue,
  cloneBoundaryPathSnapshot,
  clonePathSegment,
  createArcPathSegmentFromAngles,
  pathCoordinates,
  pathEndpointEpsilon,
  pathEndpoints,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  reverseBoundaryPathSnapshot,
  reversePathSegment,
} from '../model/paths.ts'
import type {
  AmbientDimension,
  BoundaryPathSnapshot,
  CurveStratum,
  Diagram,
  PathSegment,
  Vec3,
} from '../model/types.ts'
import { makeUniqueId } from './diagramUpdates.ts'
import {
  clearSelectionForLayerFilter,
  isSelectionCompatibleWithLayerFilter,
  normalizeLayerFilterForDiagram,
} from './layerFilter.ts'
import {
  findSelectedElement,
  selectedElements,
  type SelectedElement,
} from './selection.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export type ConcatenateSelectedPathsOptions = {
  keepOriginals?: boolean
  directionReversed?: readonly boolean[]
  id?: string
  name?: string
}

export type ConcatenateSelectedPathsError =
  | 'tooFewPaths'
  | 'missingSourcePath'
  | 'sourceNotPath'
  | 'duplicateSourcePath'
  | 'unsupportedPathKind'
  | 'unsupportedTemplatePath'
  | 'emptySourcePath'
  | 'sourceNonFinite'
  | 'endpointMismatch'

export type ConcatenateSelectedPathsResult =
  | {
      ok: true
      diagram: Diagram
      id: string
      selectedElement: SelectedElement
      sourcePathCount: number
      reversedSourcePathIds: string[]
    }
  | {
      ok: false
      diagram: Diagram
      error: ConcatenateSelectedPathsError
      sourcePathId?: string
    }

export type PathConcatenationEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

export type PathLikeSnapshot = BoundaryPathSnapshot

export type PathConcatenationSource = {
  path: CurveStratum
  snapshot: PathLikeSnapshot
}

export type ResolveSelectedPathSnapshotsForConcatenationResult =
  | {
      ok: true
      sources: PathConcatenationSource[]
    }
  | {
      ok: false
      error: ConcatenateSelectedPathsError
      sourcePathId?: string
    }

export type PathConcatenationEndpointCheck = {
  index: number
  previousPathIndex: number
  nextPathIndex: number
  previousPathId?: string
  nextPathId?: string
  previousEnd: Vec3 | null
  nextStart: Vec3 | null
  matches: boolean
  equation: string
}

export type OrientPathsForConcatenationResult =
  | {
      ok: true
      oriented: PathLikeSnapshot[]
      reversed: boolean[]
      endpointChecks: PathConcatenationEndpointCheck[]
    }
  | {
      ok: false
      error: 'emptySourcePath' | 'sourceNonFinite' | 'endpointMismatch'
      sourcePathId?: string
      endpointChecks: PathConcatenationEndpointCheck[]
    }

export type PathConcatenationDirectionDraftPath = {
  id?: string
  name?: string
  reversed: boolean
  start: Vec3 | null
  end: Vec3 | null
}

export type PathConcatenationDirectionDraft = {
  sourceSnapshots: PathLikeSnapshot[]
  oriented: PathLikeSnapshot[]
  reversed: boolean[]
  paths: PathConcatenationDirectionDraftPath[]
  endpointChecks: PathConcatenationEndpointCheck[]
  canCreate: boolean
}

type SourcePathSegmentsResult =
  | {
      ok: true
      segments: PathSegment[]
    }
  | {
      ok: false
      error:
        | 'unsupportedPathKind'
        | 'unsupportedTemplatePath'
        | 'emptySourcePath'
        | 'sourceNonFinite'
    }

const concatenatedPathIdPrefix = 'concatenated-path'

export function concatenateSelectedPaths(
  diagram: Diagram,
  selection: SelectedElement,
  options: ConcatenateSelectedPathsOptions = {},
): ConcatenateSelectedPathsResult {
  const sources = resolveSelectedPathSnapshotsForConcatenation(diagram, selection)

  if (!sources.ok) {
    return {
      ok: false,
      diagram,
      error: sources.error,
      sourcePathId: sources.sourcePathId,
    }
  }

  const sourcePaths = sources.sources.map((source) => source.path)
  const sourceSnapshots = sources.sources.map((source) => source.snapshot)
  const sourceIds = new Set(sourcePaths.map((path) => path.id))
  const ordered =
    options.directionReversed === undefined
      ? orientPathsForConcatenation(sourceSnapshots, pathEndpointEpsilon)
      : orientPathsForConcatenationWithDirections(
          sourceSnapshots,
          options.directionReversed,
          pathEndpointEpsilon,
        )

  if (!ordered.ok) {
    return {
      ok: false,
      diagram,
      error: ordered.error,
      sourcePathId: ordered.sourcePathId,
    }
  }

  const firstPath = sourcePaths[0]

  if (firstPath === undefined) {
    return {
      ok: false,
      diagram,
      error: 'tooFewPaths',
    }
  }

  const id = safeConcatenatedPathId(diagram, options.id)
  const path = createConcatenatedPathStratum({
    ambientDimension: diagram.ambientDimension,
    id,
    name: options.name ?? 'Concatenated path',
    style: firstPath.style,
    segments: concatenatedSegmentsFromSnapshots(ordered.oriented),
    styleSegments: [],
    arrows: firstPath.arrows,
    layer: firstPath.layer,
  })
  const keepOriginals = options.keepOriginals ?? true
  const diagramWithPath: Diagram = {
    ...diagram,
    strata: [
      ...diagram.strata.filter(
        (stratum) => keepOriginals || !sourceIds.has(stratum.id),
      ),
      path,
    ],
  }
  const nextDiagram = keepOriginals
    ? diagramWithPath
    : cleanPathCrossingStates(diagramWithPath)

  return {
    ok: true,
    diagram: nextDiagram,
    id,
    selectedElement: { kind: 'stratum', id },
    sourcePathCount: sourcePaths.length,
    reversedSourcePathIds: sourcePaths
      .filter((_, index) => ordered.reversed[index] === true)
      .map((path) => path.id),
  }
}

export function resolveSelectedPathSnapshotsForConcatenation(
  diagram: Diagram,
  selection: SelectedElement,
): ResolveSelectedPathSnapshotsForConcatenationResult {
  const selected = selectedElements(selection)

  if (selected.length < 2) {
    return {
      ok: false,
      error: 'tooFewPaths',
    }
  }

  const sourceIds = new Set<string>()
  const sources: PathConcatenationSource[] = []

  for (const selectedElement of selected) {
    if (selectedElement.kind !== 'stratum') {
      return {
        ok: false,
        error: 'sourceNotPath',
      }
    }

    if (sourceIds.has(selectedElement.id)) {
      return {
        ok: false,
        error: 'duplicateSourcePath',
        sourcePathId: selectedElement.id,
      }
    }

    const found = findSelectedElement(diagram, selectedElement)

    if (found === null) {
      return {
        ok: false,
        error: 'missingSourcePath',
        sourcePathId: selectedElement.id,
      }
    }

    if (found.kind !== 'stratum' || found.element.geometricKind !== 'curve') {
      return {
        ok: false,
        error: 'sourceNotPath',
        sourcePathId: selectedElement.id,
      }
    }

    const segments = sourcePathSegments(
      found.element,
      diagram.ambientDimension,
    )

    if (!segments.ok) {
      return {
        ok: false,
        error: segments.error,
        sourcePathId: found.element.id,
      }
    }

    sourceIds.add(found.element.id)
    sources.push({
      path: found.element,
      snapshot: {
        id: found.element.id,
        name: found.element.name,
        segments: segments.segments,
      },
    })
  }

  return {
    ok: true,
    sources,
  }
}

export function getPathStart(pathLike: PathLikeSnapshot): Vec3 | null {
  return pathEndpoints(pathLike.segments)?.start ?? null
}

export function getPathEnd(pathLike: PathLikeSnapshot): Vec3 | null {
  return pathEndpoints(pathLike.segments)?.end ?? null
}

export function reversePathSegments(
  segments: readonly PathSegment[],
): PathSegment[] {
  return [...segments].reverse().map(reversePathSegment)
}

export function reversePathLikeSnapshot(
  pathLike: PathLikeSnapshot,
): PathLikeSnapshot {
  return reverseBoundaryPathSnapshot(pathLike)
}

export function orientPathsForConcatenation(
  paths: readonly PathLikeSnapshot[],
  epsilon = pathEndpointEpsilon,
): OrientPathsForConcatenationResult {
  const validation = validatePathLikeSnapshots(paths)

  if (!validation.ok) {
    return validation
  }

  const [firstPath] = paths

  if (firstPath === undefined) {
    return {
      ok: true,
      oriented: [],
      reversed: [],
      endpointChecks: [],
    }
  }

  const attempts = [false, true].flatMap((reverseFirst) =>
    orientPathAttempt(paths, reverseFirst, epsilon),
  )

  if (attempts.length === 0) {
    return {
      ok: false,
      error: 'endpointMismatch',
      sourcePathId: paths[1]?.id,
      endpointChecks: [],
    }
  }

  const [best] = [...attempts].sort(compareOrientationAttempts)

  if (best === undefined) {
    return {
      ok: false,
      error: 'endpointMismatch',
      sourcePathId: paths[1]?.id,
      endpointChecks: [],
    }
  }

  return {
    ok: true,
    oriented: best.oriented,
    reversed: best.reversed,
    endpointChecks: pathConcatenationEndpointChecks(best.oriented, epsilon),
  }
}

export function orientPathsForConcatenationWithDirections(
  paths: readonly PathLikeSnapshot[],
  reversed: readonly boolean[],
  epsilon = pathEndpointEpsilon,
): OrientPathsForConcatenationResult {
  const validation = validatePathLikeSnapshots(paths)

  if (!validation.ok) {
    return validation
  }

  if (reversed.length !== paths.length) {
    return {
      ok: false,
      error: 'endpointMismatch',
      sourcePathId: paths[reversed.length]?.id,
      endpointChecks: [],
    }
  }

  const oriented = paths.map((path, index) =>
    reversed[index] === true
      ? reversePathLikeSnapshot(path)
      : cloneBoundaryPathSnapshot(path),
  )
  const endpointChecks = pathConcatenationEndpointChecks(oriented, epsilon)
  const firstFailingCheck = endpointChecks.find((check) => !check.matches)

  if (firstFailingCheck !== undefined) {
    return {
      ok: false,
      error: 'endpointMismatch',
      sourcePathId: firstFailingCheck.nextPathId,
      endpointChecks,
    }
  }

  return {
    ok: true,
    oriented,
    reversed: [...reversed],
    endpointChecks,
  }
}

export function pathConcatenationEndpointChecks(
  paths: readonly PathLikeSnapshot[],
  epsilon = pathEndpointEpsilon,
): PathConcatenationEndpointCheck[] {
  return paths.slice(0, -1).map((path, index) => {
    const nextPath = paths[index + 1]
    const previousEnd = getPathEnd(path)
    const nextStart =
      nextPath === undefined ? null : getPathStart(nextPath)

    return {
      index,
      previousPathIndex: index,
      nextPathIndex: index + 1,
      ...(path.id === undefined ? {} : { previousPathId: path.id }),
      ...(nextPath?.id === undefined ? {} : { nextPathId: nextPath.id }),
      previousEnd,
      nextStart,
      matches:
        previousEnd !== null &&
        nextStart !== null &&
        vec3ApproximatelyEqual(previousEnd, nextStart, epsilon),
      equation: `path ${index + 1} end = path ${index + 2} start`,
    }
  })
}

export function createPathConcatenationDirectionDraft(
  paths: readonly PathLikeSnapshot[],
  reversed: readonly boolean[] = [],
  epsilon = pathEndpointEpsilon,
): PathConcatenationDirectionDraft {
  const sourceSnapshots = paths.map(cloneBoundaryPathSnapshot)
  const directionFlags = sourceSnapshots.map(
    (_, index) => reversed[index] === true,
  )
  const oriented = sourceSnapshots.map((path, index) =>
    directionFlags[index] === true
      ? reversePathLikeSnapshot(path)
      : cloneBoundaryPathSnapshot(path),
  )
  const endpointChecks = pathConcatenationEndpointChecks(oriented, epsilon)
  const pathsWithEndpoints = oriented.map((path, index) => ({
    ...(path.id === undefined ? {} : { id: path.id }),
    ...(path.name === undefined ? {} : { name: path.name }),
    reversed: directionFlags[index] === true,
    start: getPathStart(path),
    end: getPathEnd(path),
  }))

  return {
    sourceSnapshots,
    oriented,
    reversed: directionFlags,
    paths: pathsWithEndpoints,
    endpointChecks,
    canCreate:
      oriented.length >= 2 &&
      pathsWithEndpoints.every(
        (path) => path.start !== null && path.end !== null,
      ) &&
      sourceSnapshots.every((path) => segmentsHaveFinitePreview(path.segments)) &&
      endpointChecks.every((check) => check.matches),
  }
}

export function togglePathConcatenationDraftDirection(
  draft: PathConcatenationDirectionDraft,
  pathIndex: number,
  epsilon = pathEndpointEpsilon,
): PathConcatenationDirectionDraft {
  if (pathIndex < 0 || pathIndex >= draft.reversed.length) {
    return draft
  }

  return createPathConcatenationDirectionDraft(
    draft.sourceSnapshots,
    draft.reversed.map((reversed, index) =>
      index === pathIndex ? !reversed : reversed,
    ),
    epsilon,
  )
}

export function applyConcatenateSelectedPathsToEditorState<
  T extends PathConcatenationEditorState,
>(current: T, options: ConcatenateSelectedPathsOptions = {}): T {
  if (
    !isSelectionCompatibleWithLayerFilter(
      current.editableDiagram,
      current.selectedElement,
      current.layerFilter,
    )
  ) {
    return {
      ...current,
      selectedElement: null,
      layerFilter: normalizeLayerFilterForDiagram(
        current.editableDiagram,
        current.layerFilter,
      ),
      layerOperationStatus: 'Selection is not editable in the current layer filter.',
    }
  }

  const result = concatenateSelectedPaths(
    current.editableDiagram,
    current.selectedElement,
    options,
  )

  if (!result.ok) {
    return {
      ...current,
      layerOperationStatus: concatenateSelectedPathsErrorMessage(
        result.error,
        result.sourcePathId,
      ),
    }
  }

  const nextLayerFilter = normalizeLayerFilterForDiagram(
    result.diagram,
    current.layerFilter,
  )
  const nextSelection = clearSelectionForLayerFilter(
    result.diagram,
    result.selectedElement,
    nextLayerFilter,
  )

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: nextSelection,
    layerFilter: nextLayerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: concatenateSelectedPathsSuccessMessage(
      result.sourcePathCount,
      result.reversedSourcePathIds,
      options.keepOriginals ?? true,
    ),
  })
}

export function concatenateSelectedPathsSuccessMessage(
  sourcePathCount: number,
  reversedSourcePathIds: readonly string[],
  keepOriginals: boolean,
): string {
  const originalPolicy = keepOriginals
    ? 'Original paths kept.'
    : 'Original paths removed; stale crossing data cleaned.'
  const reversed =
    reversedSourcePathIds.length === 0
      ? ''
      : ` Reversed ${reversedSourcePathIds.length} ${pathCountLabel(
          reversedSourcePathIds.length,
        )} to match endpoints.`

  return `Concatenated ${sourcePathCount} ${pathCountLabel(
    sourcePathCount,
  )}. ${originalPolicy}${reversed}`
}

export function concatenateSelectedPathsErrorMessage(
  error: ConcatenateSelectedPathsError,
  sourcePathId?: string,
): string {
  const suffix = sourcePathId === undefined ? '' : ` (${sourcePathId})`

  switch (error) {
    case 'tooFewPaths':
      return 'Select at least two paths to concatenate.'
    case 'missingSourcePath':
      return `A selected path is no longer available${suffix}.`
    case 'sourceNotPath':
      return `Selected objects must be path-like curves${suffix}.`
    case 'duplicateSourcePath':
      return `Each source path can be selected only once${suffix}.`
    case 'unsupportedPathKind':
      return `Selected paths must be polylines, cubic Bezier curves, concatenated paths, or convertible circle templates${suffix}.`
    case 'unsupportedTemplatePath':
      return `Only circle template paths can be converted exactly for concatenation${suffix}.`
    case 'emptySourcePath':
      return `Every selected path must contain at least one segment${suffix}.`
    case 'sourceNonFinite':
      return `Selected paths must have finite preview coordinates${suffix}.`
    case 'endpointMismatch':
      return `Selected paths must connect endpoint-to-endpoint in selection order${suffix}.`
  }
}

function pathCountLabel(count: number): string {
  return count === 1 ? 'path' : 'paths'
}

function sourcePathSegments(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
): SourcePathSegmentsResult {
  let segments: PathSegment[]

  switch (curve.kind) {
    case 'polyline':
      segments = pathSegmentsFromPolyline(curve.points)
      break
    case 'cubicBezier':
      segments = pathSegmentsFromCubicBezier(
        curve.points,
        curve.bezierControls,
      )
      break
    case 'concatenatedPath':
      segments = curve.segments.map(clonePathSegment)
      break
    case 'templatePath':
      return circleTemplateSegments(curve, ambientDimension)
    case 'grid':
      return {
        ok: false,
        error: 'unsupportedPathKind',
      }
  }

  return validateSourceSegments(segments)
}

function circleTemplateSegments(
  curve: Extract<CurveStratum, { kind: 'templatePath' }>,
  ambientDimension: AmbientDimension,
): SourcePathSegmentsResult {
  if (curve.template.kind !== 'circleTemplate') {
    return {
      ok: false,
      error: 'unsupportedTemplatePath',
    }
  }

  const firstArc = createArcPathSegmentFromAngles({
    center: curve.template.center,
    radius: curve.template.radius,
    startAngleDeg: 0,
    endAngleDeg: 180,
    direction: 'counterclockwise',
    ambientDimension,
    ...(curve.template.frame === undefined
      ? {}
      : { frame: curve.template.frame }),
  })
  const secondArc = createArcPathSegmentFromAngles({
    center: curve.template.center,
    radius: curve.template.radius,
    startAngleDeg: 180,
    endAngleDeg: 360,
    direction: 'counterclockwise',
    ambientDimension,
    ...(curve.template.frame === undefined
      ? {}
      : { frame: curve.template.frame }),
  })

  if (firstArc === null || secondArc === null) {
    return {
      ok: false,
      error: 'sourceNonFinite',
    }
  }

  return validateSourceSegments([firstArc, secondArc])
}

function validateSourceSegments(
  segments: PathSegment[],
): SourcePathSegmentsResult {
  if (segments.length === 0) {
    return {
      ok: false,
      error: 'emptySourcePath',
    }
  }

  if (!segmentsHaveFinitePreview(segments)) {
    return {
      ok: false,
      error: 'sourceNonFinite',
    }
  }

  return {
    ok: true,
    segments,
  }
}

type OrientationAttempt = {
  oriented: PathLikeSnapshot[]
  reversed: boolean[]
}

function validatePathLikeSnapshots(
  paths: readonly PathLikeSnapshot[],
): OrientPathsForConcatenationResult {
  for (const path of paths) {
    if (path.segments.length === 0) {
      return {
        ok: false,
        error: 'emptySourcePath',
        sourcePathId: path.id,
        endpointChecks: [],
      }
    }

    if (!segmentsHaveFinitePreview(path.segments)) {
      return {
        ok: false,
        error: 'sourceNonFinite',
        sourcePathId: path.id,
        endpointChecks: [],
      }
    }
  }

  return {
    ok: true,
    oriented: [],
    reversed: [],
    endpointChecks: [],
  }
}

function orientPathAttempt(
  paths: readonly PathLikeSnapshot[],
  reverseFirst: boolean,
  epsilon: number,
): OrientationAttempt[] {
  const [firstPath] = paths

  if (firstPath === undefined) {
    return []
  }

  const firstOriented = reverseFirst
    ? reversePathLikeSnapshot(firstPath)
    : cloneBoundaryPathSnapshot(firstPath)
  const oriented: PathLikeSnapshot[] = [firstOriented]
  const reversed: boolean[] = [reverseFirst]

  for (let index = 1; index < paths.length; index += 1) {
    const previousEnd = getPathEnd(oriented[index - 1] ?? firstOriented)
    const nextPath = paths[index]

    if (previousEnd === null || nextPath === undefined) {
      return []
    }

    const nextStart = getPathStart(nextPath)
    const nextEnd = getPathEnd(nextPath)

    if (
      nextStart !== null &&
      vec3ApproximatelyEqual(previousEnd, nextStart, epsilon)
    ) {
      oriented.push(cloneBoundaryPathSnapshot(nextPath))
      reversed.push(false)
      continue
    }

    if (
      nextEnd !== null &&
      vec3ApproximatelyEqual(previousEnd, nextEnd, epsilon)
    ) {
      oriented.push(reversePathLikeSnapshot(nextPath))
      reversed.push(true)
      continue
    }

    return []
  }

  return [
    {
      oriented,
      reversed,
    },
  ]
}

function compareOrientationAttempts(
  first: OrientationAttempt,
  second: OrientationAttempt,
): number {
  const reversalCountDifference =
    countReversals(first.reversed) - countReversals(second.reversed)

  if (reversalCountDifference !== 0) {
    return reversalCountDifference
  }

  for (let index = 0; index < first.reversed.length; index += 1) {
    const firstReversed = first.reversed[index] === true
    const secondReversed = second.reversed[index] === true

    if (firstReversed !== secondReversed) {
      return firstReversed ? 1 : -1
    }
  }

  return 0
}

function countReversals(reversed: readonly boolean[]): number {
  return reversed.filter(Boolean).length
}

function concatenatedSegmentsFromSnapshots(
  snapshots: readonly PathLikeSnapshot[],
): PathSegment[] {
  return snapshots.flatMap((snapshot) =>
    snapshot.segments.map(cloneSegmentWithoutStyleOverride),
  )
}

function cloneSegmentWithoutStyleOverride(segment: PathSegment): PathSegment {
  return withoutStyleOverride(clonePathSegment(segment))
}

function withoutStyleOverride(segment: PathSegment): PathSegment {
  const nextSegment = { ...segment }

  delete nextSegment.styleOverride

  return nextSegment
}

function segmentsHaveFinitePreview(segments: readonly PathSegment[]): boolean {
  return (
    pathCoordinates(segments).every(isFiniteVec3) &&
    segments.every((segment) => {
      if (segment.kind !== 'arc') {
        return true
      }

      const radius = arcScalarPreviewValue(segment.radius)
      const startAngleDeg = arcScalarPreviewValue(segment.startAngleDeg)
      const endAngleDeg = arcScalarPreviewValue(segment.endAngleDeg)

      return (
        Number.isFinite(radius) &&
        radius > 0 &&
        Number.isFinite(startAngleDeg) &&
        Number.isFinite(endAngleDeg)
      )
    })
  )
}

function safeConcatenatedPathId(
  diagram: Diagram,
  requestedId: string | undefined,
): string {
  const trimmedId = requestedId?.trim()

  if (trimmedId === undefined || trimmedId.length === 0) {
    return makeUniqueId(diagram, concatenatedPathIdPrefix)
  }

  const existingIds = new Set([
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ])

  return existingIds.has(trimmedId)
    ? makeUniqueId(diagram, concatenatedPathIdPrefix)
    : trimmedId
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
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
