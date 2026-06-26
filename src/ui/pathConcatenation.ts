import { createConcatenatedPathStratum } from '../model/constructors.ts'
import { cleanPathCrossingStates } from '../model/pathCrossings.ts'
import {
  arcScalarPreviewValue,
  clonePathSegment,
  createArcPathSegmentFromAngles,
  pathCoordinates,
  pathEndpointEpsilon,
  pathEndpoints,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  reversePathSegment,
} from '../model/paths.ts'
import type {
  AmbientDimension,
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
  const selected = selectedElements(selection)

  if (selected.length < 2) {
    return {
      ok: false,
      diagram,
      error: 'tooFewPaths',
    }
  }

  const sourceIds = new Set<string>()
  const sourcePaths: CurveStratum[] = []
  const sourceSegments: PathSegment[][] = []

  for (const selectedElement of selected) {
    if (selectedElement.kind !== 'stratum') {
      return {
        ok: false,
        diagram,
        error: 'sourceNotPath',
      }
    }

    if (sourceIds.has(selectedElement.id)) {
      return {
        ok: false,
        diagram,
        error: 'duplicateSourcePath',
        sourcePathId: selectedElement.id,
      }
    }

    const found = findSelectedElement(diagram, selectedElement)

    if (found === null) {
      return {
        ok: false,
        diagram,
        error: 'missingSourcePath',
        sourcePathId: selectedElement.id,
      }
    }

    if (found.kind !== 'stratum' || found.element.geometricKind !== 'curve') {
      return {
        ok: false,
        diagram,
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
        diagram,
        error: segments.error,
        sourcePathId: found.element.id,
      }
    }

    sourceIds.add(found.element.id)
    sourcePaths.push(found.element)
    sourceSegments.push(segments.segments)
  }

  const ordered = orderComposableSegments(sourcePaths, sourceSegments)

  if (!ordered.ok) {
    return {
      ok: false,
      diagram,
      error: 'endpointMismatch',
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
    segments: ordered.segments,
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
    reversedSourcePathIds: ordered.reversedSourcePathIds,
  }
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

function orderComposableSegments(
  sourcePaths: readonly CurveStratum[],
  sourceSegments: readonly PathSegment[][],
):
  | {
      ok: true
      segments: PathSegment[]
      reversedSourcePathIds: string[]
    }
  | {
      ok: false
      sourcePathId: string
    } {
  const [firstSegments, ...remainingSegments] = sourceSegments
  const [firstPath, ...remainingPaths] = sourcePaths

  if (firstSegments === undefined || firstPath === undefined) {
    return {
      ok: false,
      sourcePathId: '',
    }
  }

  const orderedSegments = firstSegments.map(cloneSegmentWithoutStyleOverride)
  const reversedSourcePathIds: string[] = []

  for (let index = 0; index < remainingSegments.length; index += 1) {
    const nextSegments = remainingSegments[index]
    const nextPath = remainingPaths[index]
    const currentEndpoints = pathEndpoints(orderedSegments)
    const nextEndpoints =
      nextSegments === undefined ? null : pathEndpoints(nextSegments)

    if (
      nextSegments === undefined ||
      nextPath === undefined ||
      currentEndpoints === null ||
      nextEndpoints === null
    ) {
      return {
        ok: false,
        sourcePathId: nextPath?.id ?? '',
      }
    }

    if (
      vec3ApproximatelyEqual(
        currentEndpoints.end,
        nextEndpoints.start,
        pathEndpointEpsilon,
      )
    ) {
      orderedSegments.push(...nextSegments.map(cloneSegmentWithoutStyleOverride))
      continue
    }

    if (
      vec3ApproximatelyEqual(
        currentEndpoints.end,
        nextEndpoints.end,
        pathEndpointEpsilon,
      )
    ) {
      orderedSegments.push(
        ...[...nextSegments]
          .reverse()
          .map(reverseSegmentWithoutStyleOverride),
      )
      reversedSourcePathIds.push(nextPath.id)
      continue
    }

    return {
      ok: false,
      sourcePathId: nextPath.id,
    }
  }

  return {
    ok: true,
    segments: orderedSegments,
    reversedSourcePathIds,
  }
}

function cloneSegmentWithoutStyleOverride(segment: PathSegment): PathSegment {
  return withoutStyleOverride(clonePathSegment(segment))
}

function reverseSegmentWithoutStyleOverride(segment: PathSegment): PathSegment {
  return withoutStyleOverride(reversePathSegment(segment))
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
