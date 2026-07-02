import { createConcatenatedPathStratum } from '../model/constructors.ts'
import { collectTopLevelDiagramIds } from '../model/diagramIds.ts'
import {
  clonePathInlineNode,
  isValidPathInlineNodePositionValue,
} from '../model/pathInlineNodes.ts'
import { resolvePathArrowOptions } from '../model/pathArrows.ts'
import { cleanPathCrossingStates } from '../model/pathCrossings.ts'
import {
  arcScalarPreviewValue,
  clonePathSegment,
  pathCoordinates,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  splitPathSegmentAt,
} from '../model/paths.ts'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  Diagram,
  EndpointArrowMode,
  PathInlineNode,
  PathSegment,
  Vec3,
} from '../model/types.ts'
import {
  clearSelectionForLayerFilter,
  isSelectionCompatibleWithLayerFilter,
  normalizeLayerFilterForDiagram,
} from './layerFilter.ts'
import {
  findSelectedElement,
  isSingleSelectedElement,
  selectedElementFromElements,
  type SelectedElement,
} from './selection.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export type PathSplitTarget = {
  segmentIndex: number
  t: number
}

export type SplitSelectedPathOptions = {
  keepOriginal?: boolean
  firstId?: string
  secondId?: string
  firstName?: string
  secondName?: string
}

export type SplitSelectedPathError =
  | 'noSinglePath'
  | 'missingSourcePath'
  | 'sourceNotPath'
  | 'unsupportedPathKind'
  | 'unsupportedTemplatePath'
  | 'emptySourcePath'
  | 'sourceNonFinite'
  | 'invalidSegmentIndex'
  | 'invalidSplitParameter'
  | 'unsupportedSegment'

export type SplitSelectedPathResult =
  | {
      ok: true
      diagram: Diagram
      firstId: string
      secondId: string
      selectedElement: SelectedElement
      keepOriginal: boolean
    }
  | {
      ok: false
      diagram: Diagram
      error: SplitSelectedPathError
      sourcePathId?: string
    }

export type PathSplittingEditorState = UndoableEditorState & {
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

type RedistributedInlineNodes = {
  first?: PathInlineNode[]
  second?: PathInlineNode[]
}

const splitPathIdPrefix = 'split-path'
const inlineNodeSplitEpsilon = 1e-9

export function pathSplitSegmentCount(curve: CurveStratum): number {
  switch (curve.kind) {
    case 'polyline':
      return Math.max(0, curve.points.length - 1)
    case 'cubicBezier':
      return curve.points.length === 4 ? 1 : 0
    case 'concatenatedPath':
      return curve.segments.length
    case 'templatePath':
    case 'grid':
      return 0
  }
}

export function splitSelectedPath(
  diagram: Diagram,
  selection: SelectedElement,
  target: PathSplitTarget,
  options: SplitSelectedPathOptions = {},
): SplitSelectedPathResult {
  if (!isSingleSelectedElement(selection)) {
    return {
      ok: false,
      diagram,
      error: 'noSinglePath',
    }
  }

  const found = findSelectedElement(diagram, selection)

  if (found === null) {
    return {
      ok: false,
      diagram,
      error: 'missingSourcePath',
      sourcePathId: selection.id,
    }
  }

  if (found.kind !== 'stratum' || found.element.geometricKind !== 'curve') {
    return {
      ok: false,
      diagram,
      error: 'sourceNotPath',
      sourcePathId: selection.id,
    }
  }

  const source = found.element
  const segments = sourcePathSegmentsForSplitting(source)

  if (!segments.ok) {
    return {
      ok: false,
      diagram,
      error: segments.error,
      sourcePathId: source.id,
    }
  }

  if (
    !Number.isInteger(target.segmentIndex) ||
    target.segmentIndex < 0 ||
    target.segmentIndex >= segments.segments.length
  ) {
    return {
      ok: false,
      diagram,
      error: 'invalidSegmentIndex',
      sourcePathId: source.id,
    }
  }

  if (!Number.isFinite(target.t) || target.t <= 0 || target.t >= 1) {
    return {
      ok: false,
      diagram,
      error: 'invalidSplitParameter',
      sourcePathId: source.id,
    }
  }

  const splitSegment = segments.segments[target.segmentIndex]

  if (splitSegment === undefined) {
    return {
      ok: false,
      diagram,
      error: 'invalidSegmentIndex',
      sourcePathId: source.id,
    }
  }

  const split = splitPathSegmentAt(
    splitSegment,
    target.t,
    diagram.ambientDimension,
  )

  if (!split.ok) {
    return {
      ok: false,
      diagram,
      error:
        split.error === 'invalidParameter'
          ? 'invalidSplitParameter'
          : split.error === 'unsupportedArc'
            ? 'unsupportedSegment'
            : 'sourceNonFinite',
      sourcePathId: source.id,
    }
  }

  const firstSegments = [
    ...segments.segments.slice(0, target.segmentIndex).map(clonePathSegment),
    split.first,
  ]
  const secondSegments = [
    split.second,
    ...segments.segments.slice(target.segmentIndex + 1).map(clonePathSegment),
  ]
  const inlineNodes = redistributePathInlineNodes(
    source.inlineNodes,
    target.segmentIndex,
    target.t,
  )
  const arrowModes = splitEndpointArrowModes(source)
  const firstId = safeSplitPathId(
    diagram,
    options.firstId,
    `${source.id || splitPathIdPrefix}-part-a`,
    new Set(),
  )
  const secondId = safeSplitPathId(
    diagram,
    options.secondId,
    `${source.id || splitPathIdPrefix}-part-b`,
    new Set([firstId]),
  )
  const firstPath = createSplitPath(source, {
    id: firstId,
    name: options.firstName ?? `${source.name} (1)`,
    segments: firstSegments,
    endpoint: arrowModes.first,
    inlineNodes: inlineNodes.first,
    ambientDimension: diagram.ambientDimension,
  })
  const secondPath = createSplitPath(source, {
    id: secondId,
    name: options.secondName ?? `${source.name} (2)`,
    segments: secondSegments,
    endpoint: arrowModes.second,
    inlineNodes: inlineNodes.second,
    ambientDimension: diagram.ambientDimension,
  })
  const keepOriginal = options.keepOriginal ?? false
  const strata = diagram.strata.flatMap((stratum) => {
    if (stratum.id !== source.id) {
      return [stratum]
    }

    return keepOriginal
      ? [stratum, firstPath, secondPath]
      : [firstPath, secondPath]
  })
  const diagramWithSplit: Diagram = {
    ...diagram,
    strata,
  }
  const nextDiagram = keepOriginal
    ? diagramWithSplit
    : cleanPathCrossingStates(diagramWithSplit)

  return {
    ok: true,
    diagram: nextDiagram,
    firstId,
    secondId,
    selectedElement: selectedElementFromElements([
      { kind: 'stratum', id: firstId },
      { kind: 'stratum', id: secondId },
    ]),
    keepOriginal,
  }
}

export function applySplitSelectedPathToEditorState<
  T extends PathSplittingEditorState,
>(
  current: T,
  target: PathSplitTarget,
  options: SplitSelectedPathOptions = {},
): T {
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

  const result = splitSelectedPath(
    current.editableDiagram,
    current.selectedElement,
    target,
    options,
  )

  if (!result.ok) {
    return {
      ...current,
      layerOperationStatus: splitSelectedPathErrorMessage(
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
    layerOperationStatus: splitSelectedPathSuccessMessage(
      result.firstId,
      result.secondId,
      result.keepOriginal,
    ),
  })
}

export function splitSelectedPathSuccessMessage(
  firstId: string,
  secondId: string,
  keepOriginal: boolean,
): string {
  const originalPolicy = keepOriginal
    ? 'Original path kept; existing crossing states stay on the original.'
    : 'Original path removed; stale crossing states cleaned.'

  return `Split path into ${firstId} and ${secondId}. ${originalPolicy} Endpoint arrows were adjusted; mid-arrows at whole-path positions were dropped.`
}

export function splitSelectedPathErrorMessage(
  error: SplitSelectedPathError,
  sourcePathId?: string,
): string {
  const suffix = sourcePathId === undefined ? '' : ` (${sourcePathId})`

  switch (error) {
    case 'noSinglePath':
      return 'Select exactly one path to split.'
    case 'missingSourcePath':
      return `The selected path is no longer available${suffix}.`
    case 'sourceNotPath':
      return `Select a curve path to split${suffix}.`
    case 'unsupportedPathKind':
      return `Selected path kind cannot be split${suffix}. Use a polyline, cubic Bezier, or arbitrary path.`
    case 'unsupportedTemplatePath':
      return `Template paths cannot be split for the MVP${suffix}.`
    case 'emptySourcePath':
      return `The selected path has no splittable segments${suffix}.`
    case 'sourceNonFinite':
      return `The selected path must have finite preview coordinates${suffix}.`
    case 'invalidSegmentIndex':
      return `Choose a segment that exists on the selected path${suffix}.`
    case 'invalidSplitParameter':
      return `Split position must satisfy 0 < pos < 1${suffix}.`
    case 'unsupportedSegment':
      return `This segment cannot be split exactly${suffix}. Numeric line, cubic Bezier, and numeric-angle arc segments are supported.`
  }
}

function sourcePathSegmentsForSplitting(
  curve: CurveStratum,
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
      return {
        ok: false,
        error: 'unsupportedTemplatePath',
      }
    case 'grid':
      return {
        ok: false,
        error: 'unsupportedPathKind',
      }
  }

  return validateSourceSegments(segments)
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

function createSplitPath(
  source: CurveStratum,
  input: {
    id: string
    name: string
    segments: PathSegment[]
    endpoint: EndpointArrowMode
    inlineNodes?: PathInlineNode[]
    ambientDimension: Diagram['ambientDimension']
  },
): ConcatenatedPathStratum {
  const path = createConcatenatedPathStratum({
    ambientDimension: input.ambientDimension,
    id: input.id,
    name: input.name,
    style: source.style,
    importedTikzStyleReferenceId: source.importedTikzStyleReferenceId,
    segments: input.segments,
    styleSegments: [],
    arrows: {
      endpoint: input.endpoint,
    },
    inlineNodes: input.inlineNodes,
    layer: source.layer,
  })

  if (source.stylePresetId !== undefined) {
    path.stylePresetId = source.stylePresetId
  }

  return path
}

function splitEndpointArrowModes(
  source: CurveStratum,
): { first: EndpointArrowMode; second: EndpointArrowMode } {
  const endpoint = resolvePathArrowOptions(source.arrows).endpoint

  switch (endpoint) {
    case 'none':
      return { first: 'none', second: 'none' }
    case 'forward':
      return { first: 'none', second: 'forward' }
    case 'backward':
      return { first: 'backward', second: 'none' }
    case 'both':
      return { first: 'backward', second: 'forward' }
  }
}

function redistributePathInlineNodes(
  inlineNodes: readonly PathInlineNode[] | undefined,
  splitSegmentIndex: number,
  splitParameter: number,
): RedistributedInlineNodes {
  if (inlineNodes === undefined) {
    return {}
  }

  const first: PathInlineNode[] = []
  const second: PathInlineNode[] = []

  inlineNodes.forEach((node) => {
    const segmentIndex = node.position.segmentIndex
    const value = node.position.value

    if (
      !Number.isInteger(segmentIndex) ||
      segmentIndex < 0 ||
      !isValidPathInlineNodePositionValue(value)
    ) {
      return
    }

    if (segmentIndex < splitSegmentIndex) {
      first.push(clonePathInlineNode(node))
      return
    }

    if (segmentIndex > splitSegmentIndex) {
      second.push(
        pathInlineNodeWithPosition(
          node,
          segmentIndex - splitSegmentIndex,
          value,
        ),
      )
      return
    }

    if (value < splitParameter - inlineNodeSplitEpsilon) {
      const nextValue = value / splitParameter

      if (isValidPathInlineNodePositionValue(nextValue)) {
        first.push(pathInlineNodeWithPosition(node, segmentIndex, nextValue))
      }
      return
    }

    if (value > splitParameter + inlineNodeSplitEpsilon) {
      const nextValue = (value - splitParameter) / (1 - splitParameter)

      if (isValidPathInlineNodePositionValue(nextValue)) {
        second.push(pathInlineNodeWithPosition(node, 0, nextValue))
      }
    }
  })

  return {
    ...(first.length === 0 ? {} : { first }),
    ...(second.length === 0 ? {} : { second }),
  }
}

function pathInlineNodeWithPosition(
  node: PathInlineNode,
  segmentIndex: number,
  value: number,
): PathInlineNode {
  return {
    ...clonePathInlineNode(node),
    position: {
      kind: 'segment',
      segmentIndex,
      value,
    },
  }
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

function safeSplitPathId(
  diagram: Diagram,
  requestedId: string | undefined,
  fallbackPrefix: string,
  reservedIds: ReadonlySet<string>,
): string {
  const trimmedId = requestedId?.trim()
  const existingIds = collectTopLevelDiagramIds(diagram)

  if (
    trimmedId !== undefined &&
    trimmedId.length > 0 &&
    !existingIds.has(trimmedId) &&
    !reservedIds.has(trimmedId)
  ) {
    return trimmedId
  }

  let index = 1

  while (
    existingIds.has(`${fallbackPrefix}-${index}`) ||
    reservedIds.has(`${fallbackPrefix}-${index}`)
  ) {
    index += 1
  }

  return `${fallbackPrefix}-${index}`
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}
