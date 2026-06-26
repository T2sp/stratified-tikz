import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  Diagram,
  PathIntersectionCandidate,
  PathSegment,
  PointStratum,
  RegionStratum,
  SheetStratum,
  Stratum,
  TextLabel,
  Vec2,
  Vec3,
  VisibilityOptions,
} from '../model/types'
import {
  curveOcclusionEnabled,
  defaultHiddenCurveStyle,
  hiddenLabelStyleFromBase,
  hiddenPointStyleFromBase,
  labelAutoVisibilityEnabled,
  pointAutoVisibilityEnabled,
  resolveVisibilityOptions,
} from '../model/visibility.ts'
import {
  arcSegmentToCubicBezierSegments,
  circleTemplateRadiusHandlePoint,
  ellipseTemplateRadiusHandlePoints,
  pathSegmentStyleRuns,
  sampleTemplatePathPoints,
} from '../model/paths.ts'
import { sheetVertices } from '../model/sheets.ts'
import { gridPreviewSegments } from '../model/grids.ts'
import type { GeometryHandleTarget } from '../ui/geometryHandles'
import {
  isSelectedElement,
  isSingleSelectedElement,
  type SelectedElement,
  type SelectionClickMode,
  type SingleSelectedElement,
} from '../ui/selection'
import type {
  WorkPlaneDirectionIndicator,
  WorkPlanePreview,
} from '../ui/workPlanePreview'
import type { CoordinateSourceHighlight } from '../ui/coordinateSourceHighlights'
import {
  cameraDragModeFromPointerInput,
  type CameraDragMode,
} from '../ui/cameraControls'
import {
  concatenatedPathDraftCoordinates,
  type ConcatenatedPathDraft,
} from '../ui/pathDraft'
import {
  describeConcatenatedPathSegments,
  type ConcatenatedPathPointTarget,
} from '../ui/pathEditing'
import { resolveSvgCamera } from './svgCamera'
import {
  cubicBezierToSvgPath,
  closedBoundariesToSvgPathData,
  pathSegmentsToSvgPath,
  polylineToSvgPath,
  regularPolygonPoints,
  starPolygonPoints,
  svgFillRuleValue,
  type SvgPathSegment,
  svgPointList,
} from './svgPath'
import { curveArrowheadsForSvgPreview } from './svgArrows.ts'
import {
  svgPathCrossingOverlayPrimitives,
  type SvgPathCrossingOverlayPrimitive,
} from './svgPathCrossings.ts'
import { projectToSvgPoint } from './svgProjection'
import {
  curveStyleToSvgStrokeAttributes,
  filledSurfaceStyleToSvgAttributes,
  hiddenCurveStyleToSvgStrokeAttributes,
  svgPathCrossingMarkerStyle,
  svgLabelAnchorPlacement,
} from './svgStyle'
import { curvedSheetToSvgMesh } from './curvedSheetMesh.ts'
import { mapClientPointToViewBox } from './svgViewBox'
import {
  curveHandleLabel,
  shouldRenderSvgGeometryHandles,
  vertexHandleLabel,
} from './svgGeometryHandles'
import {
  createCoordinateAxesGuide,
  type CoordinateAxesGuide,
  type CoordinateAxisGuide,
} from './coordinateAxesGuide'
import {
  allLayersFilter,
  isLayerSelectableByLayerFilter,
  layerFilterIncludesLayer,
  type LayerFilter,
} from '../ui/layerFilter'
import type { CameraViewAdjustment } from './svgCamera'
import {
  shouldRenderStratumInSvgPreview,
  shouldRenderTextLabelInSvgPreview,
} from './svgPreviewPolicy.ts'
import {
  compareSvgRenderItems,
  type SvgRenderItemKind,
} from './svgRenderSort.ts'
import type { ProjectedSurfaceFace } from './projectedPrimitives.ts'
import { sortedSvgSurfaceFaces } from './svgSurfaceDepthSort.ts'
import {
  classifyCurveOcclusion,
  type CurveOcclusionResult,
} from './curveOcclusion.ts'
import {
  classifyAnchorOcclusion,
  type AnchorOcclusionResult,
} from './pointOcclusion.ts'
import {
  pathIntersectionDetectionForDiagram,
  type PathIntersectionDetectionStatus,
} from '../geometry/pathIntersections.ts'
import { pathCrossingKindForCandidate } from '../model/pathCrossings.ts'

export type BoundaryPathHighlight = {
  id: string
  label: string
}

export type SvgDiagramProps = {
  diagram: Diagram
  width?: number
  height?: number
  fitToView?: boolean
  cameraOverride?: Diagram['camera']
  cameraViewAdjustment?: CameraViewAdjustment
  selectedElement?: SelectedElement
  polylineDraft?: Vec3[]
  cubicBezierDraft?: Vec3[]
  pathDraft?: ConcatenatedPathDraft
  sheetDraft?: Vec3[]
  workPlanePreview?: WorkPlanePreview
  coordinateSourceHighlights?: CoordinateSourceHighlight[]
  boundaryPathHighlights?: BoundaryPathHighlight[]
  selectedPathIntersectionCandidateId?: string | null
  layerFilter?: LayerFilter
  visibilityOptions?: VisibilityOptions
  showGeometryHandles?: boolean
  onSelectionChange?: (
    selection: SelectedElement,
    options?: SvgSelectionChangeOptions,
  ) => void
  onCurveStratumClick?: (curveId: string) => void
  onPointStratumClick?: (pointId: string) => void
  onPathIntersectionCandidateClick?: (
    candidate: PathIntersectionCandidate,
  ) => void
  onPathIntersectionDetectionStatusChange?: (
    status: PathIntersectionDetectionStatus,
  ) => void
  onCanvasClick?: (
    svgPoint: Vec2,
    viewportHeight: number,
    camera: Diagram['camera'],
  ) => void
  onGeometryHandleDrag?: (
    target: GeometryHandleTarget,
    svgPoint: Vec2,
    viewportHeight: number,
    camera: Diagram['camera'],
  ) => void
  onGeometryHandleDragStart?: (target: GeometryHandleTarget) => void
  onGeometryHandleDragEnd?: () => void
  onCameraDrag?: (delta: Vec2, mode: CameraDragMode) => void
}

export type SvgSelectionChangeOptions = {
  mode: SelectionClickMode
}

type RenderItemElement = {
  id: string
  layer: number
  element: ReactElement
  surfaceFace?: ProjectedSurfaceFace
  surfaceSortIndex?: number
}

type RenderItemDraft = RenderItemElement & {
  renderKind: SvgRenderItemKind
}

type RenderItem = RenderItemDraft & {
  stableIndex: number
}

type SvgWorkPlaneDirectionIndicator = {
  from: Vec2
  to: Vec2
  label: string
}

type SvgCurvePathRun = {
  key: string
  pathData: string
  stroke: string
  strokeOpacity: number
  strokeWidth: number
  strokeDasharray?: string
}

type CurveOcclusionById = ReadonlyMap<string, CurveOcclusionResult>
type AnchorOcclusionById = ReadonlyMap<string, AnchorOcclusionResult>

type ActiveCameraDrag = {
  mode: CameraDragMode
  lastClientPoint: Vec2
  moved: boolean
}

const defaultWidth = 520
const defaultHeight = 360
const pointRadiusScale = 1.8
const highlightColor = '#F4B400'
const handleFillColor = '#ffffff'
const handleStrokeColor = '#1D4ED8'
const handleRadius = 5.6

export function SvgDiagram({
  diagram,
  width = defaultWidth,
  height = defaultHeight,
  fitToView = false,
  cameraOverride,
  cameraViewAdjustment,
  selectedElement = null,
  polylineDraft,
  cubicBezierDraft,
  pathDraft,
  sheetDraft,
  workPlanePreview,
  coordinateSourceHighlights,
  boundaryPathHighlights,
  selectedPathIntersectionCandidateId = null,
  layerFilter = allLayersFilter,
  visibilityOptions: visibilityOptionsOverride,
  showGeometryHandles = false,
  onSelectionChange,
  onCurveStratumClick,
  onPointStratumClick,
  onPathIntersectionCandidateClick,
  onPathIntersectionDetectionStatusChange,
  onCanvasClick,
  onGeometryHandleDrag,
  onGeometryHandleDragStart,
  onGeometryHandleDragEnd,
  onCameraDrag,
}: SvgDiagramProps): ReactElement {
  const activeDragTargetRef = useRef<GeometryHandleTarget | null>(null)
  const activeCameraDragRef = useRef<ActiveCameraDrag | null>(null)
  const suppressNextCanvasClickRef = useRef(false)
  const coordinateAxesGuide = createCoordinateAxesGuide(diagram.ambientDimension)
  const extraPointsForFit = [
    ...(coordinateAxesGuide?.fitPoints ?? []),
    ...(workPlanePreview?.corners ?? []),
    ...(sheetDraft ?? []),
    ...(polylineDraft ?? []),
    ...(cubicBezierDraft ?? []),
    ...(pathDraft === undefined ? [] : concatenatedPathDraftCoordinates(pathDraft)),
    ...(coordinateSourceHighlights?.map((highlight) => highlight.position) ?? []),
  ]
  const camera = resolveSvgCamera(diagram, width, height, {
    fitToView,
    cameraOverride,
    viewAdjustment: cameraViewAdjustment,
    extraPointsForFit,
  })
  const visibilityOptions = resolveVisibilityOptions(
    diagram,
    visibilityOptionsOverride,
  )
  const curveOcclusionById = createSvgCurveOcclusionMap(
    diagram,
    camera,
    visibilityOptions,
  )
  const pointOcclusionById = createSvgPointOcclusionMap(
    diagram,
    camera,
    visibilityOptions,
  )
  const labelOcclusionById = createSvgLabelOcclusionMap(
    diagram,
    camera,
    visibilityOptions,
  )
  const sortedSurfaceItems = renderSortedSurfaceFaces(
    diagram,
    camera,
    height,
    selectedElement,
    layerFilter,
    visibilityOptions,
    onSelectionChange,
  )
  const renderSurfacesAsSortedFaces = sortedSurfaceItems !== null
  const itemDrafts: RenderItemDraft[] = [
    ...(sortedSurfaceItems ?? []),
    ...diagram.strata
      .filter((stratum) => shouldRenderStratumInSvgPreview(diagram, stratum))
      .filter(
        (stratum) =>
          !(
            renderSurfacesAsSortedFaces &&
            stratum.geometricKind === 'sheet' &&
            stratum.codim === 1
          ),
      )
      .map((stratum) =>
        withRenderKind(
          renderStratum(
            diagram,
            stratum,
            camera,
            height,
            selectedElement,
            layerFilter,
            boundaryPathHighlights,
            curveOcclusionById,
            pointOcclusionById,
            visibilityOptions,
            onSelectionChange,
            onCurveStratumClick,
            onPointStratumClick,
          ),
          stratum.geometricKind,
        ),
      ),
    ...diagram.labels
      .filter((label) => shouldRenderTextLabelInSvgPreview(diagram, label))
      .map((label) =>
        withRenderKind(
          renderLabel(
            diagram,
            label,
            camera,
            height,
            selectedElement,
            layerFilter,
            labelOcclusionById,
            visibilityOptions,
            onSelectionChange,
          ),
          'label',
        ),
      ),
  ]
  const items = itemDrafts
    .map(withStableRenderIndex)
    .sort(compareSvgRenderItems)
  const pathIntersectionDetection = useMemo(
    () => pathIntersectionDetectionForDiagram(diagram, {
      includeCurve: (curve) =>
        shouldRenderStratumInSvgPreview(diagram, curve) &&
        layerFilterIncludesLayer(layerFilter, curve.layer),
    }),
    [diagram, layerFilter],
  )
  const pathIntersectionDetectionStatusKey =
    pathIntersectionDetectionStatusCacheKey(pathIntersectionDetection.status)
  const pathIntersectionCandidates = pathIntersectionDetection.candidates
  const pathCrossingOverlays = svgPathCrossingOverlayPrimitives(
    diagram,
    (point) => projectToSvgPoint(camera, point, height),
    {
      includeCurve: (curve) =>
        shouldRenderStratumInSvgPreview(diagram, curve) &&
        layerFilterIncludesLayer(layerFilter, curve.layer),
    },
  )

  useEffect(() => {
    onPathIntersectionDetectionStatusChange?.(pathIntersectionDetection.status)
  }, [
    onPathIntersectionDetectionStatusChange,
    pathIntersectionDetectionStatusKey,
    pathIntersectionDetection.status,
  ])

  return (
    <svg
      className="svg-diagram"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${diagram.ambientDimension}D StratifiedTikZ example`}
      onPointerDown={(event) => {
        if (activeDragTargetRef.current !== null || onCameraDrag === undefined) {
          return
        }

        const mode = cameraDragModeFromPointerInput({
          cameraDragEnabled: true,
          isBackgroundTarget: isSvgBackgroundTarget(event.target),
          button: event.button,
          shiftKey: event.shiftKey,
        })

        if (mode === null) {
          return
        }

        event.preventDefault()
        activeCameraDragRef.current = {
          mode,
          lastClientPoint: { x: event.clientX, y: event.clientY },
          moved: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const target = activeDragTargetRef.current

        if (target !== null && onGeometryHandleDrag !== undefined) {
          event.preventDefault()
          onGeometryHandleDrag(
            target,
            svgPointFromPointerEvent(event, width, height),
            height,
            camera,
          )
          return
        }

        const cameraDrag = activeCameraDragRef.current

        if (cameraDrag !== null && onCameraDrag !== undefined) {
          const nextClientPoint = { x: event.clientX, y: event.clientY }
          const delta = {
            x: nextClientPoint.x - cameraDrag.lastClientPoint.x,
            y: nextClientPoint.y - cameraDrag.lastClientPoint.y,
          }

          event.preventDefault()
          activeCameraDragRef.current = {
            ...cameraDrag,
            lastClientPoint: nextClientPoint,
            moved: cameraDrag.moved || delta.x !== 0 || delta.y !== 0,
          }

          if (delta.x !== 0 || delta.y !== 0) {
            suppressNextCanvasClickRef.current = true
            onCameraDrag(delta, cameraDrag.mode)
          }
        }
      }}
      onPointerUp={(event) => {
        if (activeDragTargetRef.current !== null) {
          event.preventDefault()
          activeDragTargetRef.current = null
          onGeometryHandleDragEnd?.()
          releasePointerCaptureIfHeld(event)
          window.setTimeout(() => {
            suppressNextCanvasClickRef.current = false
          }, 0)
        }

        const cameraDrag = activeCameraDragRef.current

        if (cameraDrag !== null) {
          event.preventDefault()
          activeCameraDragRef.current = null
          if (cameraDrag.moved) {
            suppressNextCanvasClickRef.current = true
            window.setTimeout(() => {
              suppressNextCanvasClickRef.current = false
            }, 0)
          }
          releasePointerCaptureIfHeld(event)
        }
      }}
      onPointerCancel={(event) => {
        activeDragTargetRef.current = null
        activeCameraDragRef.current = null
        suppressNextCanvasClickRef.current = false
        onGeometryHandleDragEnd?.()
        releasePointerCaptureIfHeld(event)
      }}
      onClick={(event) => {
        if (suppressNextCanvasClickRef.current) {
          suppressNextCanvasClickRef.current = false
          return
        }

        if (onCanvasClick !== undefined) {
          onCanvasClick(svgPointFromMouseEvent(event, width, height), height, camera)
          return
        }

        onSelectionChange?.(null, {
          mode: selectionClickModeFromMouseEvent(event),
        })
      }}
    >
      <rect
        width={width}
        height={height}
        fill="currentColor"
        opacity="0.04"
        data-svg-background="true"
      />
      {renderCoordinateAxesGuide(coordinateAxesGuide, camera, height)}
      {renderWorkPlanePreview(workPlanePreview, camera, height)}
      <g>{items.map((item) => item.element)}</g>
      {renderPathCrossingOverlays(pathCrossingOverlays)}
      {renderSheetDraft(sheetDraft, camera, height)}
      {renderPolylineDraft(polylineDraft, camera, height)}
      {renderCubicBezierDraft(cubicBezierDraft, camera, height)}
      {renderConcatenatedPathDraft(
        pathDraft,
        camera,
        height,
        diagram.ambientDimension,
      )}
      {renderCoordinateSourceHighlights(
        coordinateSourceHighlights,
        camera,
        height,
      )}
      {renderPathIntersectionCandidates(
        diagram,
        pathIntersectionCandidates,
        camera,
        height,
        layerFilter,
        selectedPathIntersectionCandidateId,
        onPathIntersectionCandidateClick,
      )}
      {shouldRenderSvgGeometryHandles(
        showGeometryHandles,
        onGeometryHandleDrag !== undefined,
      )
        ? renderSelectedGeometryHandles(
            diagram,
            camera,
            height,
            selectedElement,
            layerFilter,
            (event, target) => {
              event.preventDefault()
              event.stopPropagation()
              activeDragTargetRef.current = target
              suppressNextCanvasClickRef.current = true
              onGeometryHandleDragStart?.(target)
              event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
            },
          )
        : null}
    </svg>
  )
}

function pathIntersectionDetectionStatusCacheKey(
  status: PathIntersectionDetectionStatus,
): string {
  const stats = status.stats

  return [
    status.capped ? 'capped' : 'ok',
    status.capReason ?? '',
    status.message,
    stats.inputPathCount,
    stats.consideredPathCount,
    stats.skippedPathCount,
    stats.pathPairCount,
    stats.skippedPathPairCount,
    stats.candidateCount,
    stats.ambiguousOverlapCount,
    stats.segmentCappedPathCount,
  ].join('|')
}

function withRenderKind(
  item: RenderItemElement,
  renderKind: SvgRenderItemKind,
): RenderItemDraft {
  return { ...item, renderKind }
}

function withStableRenderIndex(
  item: RenderItemDraft,
  stableIndex: number,
): RenderItem {
  return { ...item, stableIndex }
}

function renderSortedSurfaceFaces(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  visibilityOptions: VisibilityOptions,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemDraft[] | null {
  const sortedFaces = sortedSvgSurfaceFaces(
    diagram,
    camera,
    viewportHeight,
    visibilityOptions,
  )

  if (sortedFaces === null) {
    return null
  }

  return sortedFaces.map(({ sheet, face, points }, surfaceSortIndex) =>
    withRenderKind(
      renderSortedSurfaceFace(
        diagram,
        sheet,
        face,
        points,
        surfaceSortIndex,
        selectedElement,
        layerFilter,
        onSelectionChange,
      ),
      'surfaceFace',
    ),
  )
}

function createSvgCurveOcclusionMap(
  diagram: Diagram,
  camera: Diagram['camera'],
  visibilityOptions: VisibilityOptions,
): CurveOcclusionById {
  if (
    diagram.ambientDimension !== 3 ||
    camera.mode !== '3d' ||
    !curveOcclusionEnabled(visibilityOptions)
  ) {
    return new Map()
  }

  const visibleSheetIds = new Set(
    diagram.strata
      .filter(
        (stratum): stratum is SheetStratum =>
          stratum.geometricKind === 'sheet' &&
          stratum.codim === 1 &&
          shouldRenderStratumInSvgPreview(diagram, stratum),
      )
      .map((sheet) => sheet.id),
  )

  try {
    return new Map(
      classifyCurveOcclusion(diagram, {
        camera,
        visibility: visibilityOptions,
        occludingSurfaceIds: visibleSheetIds,
      }).map((result) => [result.curveId, result]),
    )
  } catch {
    return new Map()
  }
}

function createSvgPointOcclusionMap(
  diagram: Diagram,
  camera: Diagram['camera'],
  visibilityOptions: VisibilityOptions,
): AnchorOcclusionById {
  if (
    diagram.ambientDimension !== 3 ||
    camera.mode !== '3d' ||
    !pointAutoVisibilityEnabled(visibilityOptions)
  ) {
    return new Map()
  }

  const visibleSheetIds = visibleSvgSheetIds(diagram)
  const targets = diagram.strata.flatMap((stratum) =>
    stratum.geometricKind === 'point' &&
    stratum.codim === 3 &&
    shouldRenderStratumInSvgPreview(diagram, stratum)
      ? [
          {
            id: stratum.id,
            layer: stratum.layer,
            position: stratum.position,
          },
        ]
      : [],
  )

  try {
    return new Map(
      classifyAnchorOcclusion(diagram, targets, {
        camera,
        visibility: visibilityOptions,
        occludingSurfaceIds: visibleSheetIds,
        kind: 'point',
      }).map((result) => [result.id, result]),
    )
  } catch {
    return new Map()
  }
}

function createSvgLabelOcclusionMap(
  diagram: Diagram,
  camera: Diagram['camera'],
  visibilityOptions: VisibilityOptions,
): AnchorOcclusionById {
  if (
    diagram.ambientDimension !== 3 ||
    camera.mode !== '3d' ||
    !labelAutoVisibilityEnabled(visibilityOptions)
  ) {
    return new Map()
  }

  const visibleSheetIds = visibleSvgSheetIds(diagram)
  const targets = diagram.labels
    .filter((label) => shouldRenderTextLabelInSvgPreview(diagram, label))
    .map((label) => ({
      id: label.id,
      layer: label.layer,
      position: label.position,
    }))

  try {
    return new Map(
      classifyAnchorOcclusion(diagram, targets, {
        camera,
        visibility: visibilityOptions,
        occludingSurfaceIds: visibleSheetIds,
        kind: 'label',
      }).map((result) => [result.id, result]),
    )
  } catch {
    return new Map()
  }
}

function visibleSvgSheetIds(diagram: Diagram): ReadonlySet<string> {
  return new Set(
    diagram.strata
      .filter(
        (stratum): stratum is SheetStratum =>
          stratum.geometricKind === 'sheet' &&
          stratum.codim === 1 &&
          shouldRenderStratumInSvgPreview(diagram, stratum),
      )
      .map((sheet) => sheet.id),
  )
}

function renderSortedSurfaceFace(
  diagram: Diagram,
  sheet: SheetStratum,
  face: ProjectedSurfaceFace,
  points: string,
  surfaceSortIndex: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemElement {
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, sheet.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    sheet.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, sheet.id)
  const surfaceAttributes = filledSurfaceStyleToSvgAttributes(
    sheet.style,
    sheet.kind === 'curvedSheet' ? 0.85 : undefined,
  )
  const key = `${sheet.id}-sorted-face-${face.faceIndex}-${face.originalIndex}`

  return {
    id: key,
    layer: face.layer,
    surfaceFace: face,
    surfaceSortIndex,
    element: (
      <g
        key={key}
        className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
        opacity={previewElementOpacity(isIncludedByFilter)}
        pointerEvents={isSelectable ? undefined : 'none'}
        data-surface-depth-sorted="true"
        data-surface-source-id={sheet.id}
        data-surface-face-index={face.faceIndex}
        data-surface-depth-avg={face.depth.avg}
        onClick={(event) =>
          selectElement(event, { kind: 'stratum', id: sheet.id }, onSelectionChange)
        }
      >
        {isSelected && (
          <polygon
            points={points}
            fill={highlightColor}
            fillOpacity={0.1}
            stroke={highlightColor}
            strokeOpacity={0.9}
            strokeWidth={5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        <polygon
          points={points}
          vectorEffect="non-scaling-stroke"
          {...surfaceAttributes}
        />
      </g>
    ),
  }
}

function renderCoordinateSourceHighlights(
  highlights: CoordinateSourceHighlight[] | undefined,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement | null {
  if (highlights === undefined || highlights.length === 0) {
    return null
  }

  return (
    <g
      key="coordinate-source-highlights"
      className="svg-coordinate-source-highlights"
      pointerEvents="none"
      aria-hidden="true"
    >
      {highlights.map((highlight) =>
        renderCoordinateSourceHighlight(highlight, camera, viewportHeight),
      )}
    </g>
  )
}

function renderCoordinateSourceHighlight(
  highlight: CoordinateSourceHighlight,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement {
  const center = projectToSvgPoint(camera, highlight.position, viewportHeight)

  if (highlight.kind === 'workPlanePick') {
    const color = '#0F766E'

    return (
      <g key={highlight.id}>
        <circle
          cx={center.x}
          cy={center.y}
          r={12}
          fill="none"
          stroke={color}
          strokeOpacity={0.9}
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={center.x}
          cy={center.y}
          r={6.2}
          fill={color}
          fillOpacity={0.92}
          stroke="#ffffff"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={center.x}
          y={center.y}
          fill="#ffffff"
          fontSize={8.5}
          fontWeight={750}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {highlight.label}
        </text>
      </g>
    )
  }

  const color = '#C026D3'

  return (
    <g key={highlight.id}>
      <circle
        cx={center.x}
        cy={center.y}
        r={9.5}
        fill="none"
        stroke={color}
        strokeOpacity={0.88}
        strokeWidth={2.1}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={center.x}
        cy={center.y}
        r={3}
        fill={color}
        fillOpacity={0.95}
      />
      {highlight.label !== undefined && (
        <text
          x={center.x}
          y={center.y}
          dx={10}
          dy={-9}
          fill={color}
          stroke="#ffffff"
          strokeWidth={3}
          paintOrder="stroke"
          fontSize={10}
          fontWeight={700}
          dominantBaseline="middle"
        >
          {highlight.label}
        </text>
      )}
    </g>
  )
}

function renderPathIntersectionCandidates(
  diagram: Diagram,
  candidates: readonly PathIntersectionCandidate[],
  camera: Diagram['camera'],
  viewportHeight: number,
  layerFilter: LayerFilter,
  selectedCandidateId: string | null,
  onPathIntersectionCandidateClick:
    | SvgDiagramProps['onPathIntersectionCandidateClick']
    | undefined,
): ReactElement | null {
  if (diagram.ambientDimension !== 2 || candidates.length === 0) {
    return null
  }

  return (
    <g
      key="path-intersection-candidates"
      className="svg-path-intersection-candidates"
      aria-label="Path intersection candidates"
    >
      {candidates.map((candidate) =>
        renderPathIntersectionCandidate(
          diagram,
          candidate,
          camera,
          viewportHeight,
          layerFilter,
          selectedCandidateId === candidate.id,
          onPathIntersectionCandidateClick,
        ),
      )}
    </g>
  )
}

function renderPathCrossingOverlays(
  overlays: readonly SvgPathCrossingOverlayPrimitive[],
): ReactElement | null {
  if (overlays.length === 0) {
    return null
  }

  return (
    <g
      key="path-crossing-overlays"
      className="svg-path-crossing-overlays"
      pointerEvents="none"
      aria-hidden="true"
    >
      {overlays.map((overlay, index) => (
        <path
          key={`${overlay.crossingId}-${overlay.kind}-${index}`}
          d={overlay.pathData}
          fill="none"
          stroke={overlay.stroke}
          strokeOpacity={overlay.strokeOpacity}
          strokeWidth={overlay.strokeWidth}
          strokeDasharray={overlay.strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          data-svg-path-crossing-overlay={overlay.kind}
          data-path-intersection-candidate-id={overlay.crossingId}
          data-path-id={overlay.pathId}
        />
      ))}
    </g>
  )
}

function renderPathIntersectionCandidate(
  diagram: Diagram,
  candidate: PathIntersectionCandidate,
  camera: Diagram['camera'],
  viewportHeight: number,
  layerFilter: LayerFilter,
  isSelected: boolean,
  onPathIntersectionCandidateClick:
    | SvgDiagramProps['onPathIntersectionCandidateClick']
    | undefined,
): ReactElement {
  const center = projectToSvgPoint(camera, candidate.point, viewportHeight)
  const crossingKind = pathCrossingKindForCandidate(diagram, candidate)
  const markerStyle = svgPathCrossingMarkerStyle(crossingKind, isSelected)
  const title = pathIntersectionCandidateTooltip(candidate, crossingKind)
  const isClickable =
    onPathIntersectionCandidateClick !== undefined &&
    pathIntersectionCandidateIsSelectable(diagram, candidate, layerFilter)

  return (
    <g
      key={candidate.id}
      className="svg-path-intersection-candidate"
      pointerEvents={isClickable ? 'visiblePainted' : 'none'}
      role="button"
      aria-label={`Path crossing candidate ${candidate.pathAId} with ${candidate.pathBId}: ${crossingKind}`}
      data-svg-path-intersection-candidate="true"
      data-path-intersection-candidate-id={candidate.id}
      data-path-a-id={candidate.pathAId}
      data-path-b-id={candidate.pathBId}
      data-crossing-kind={crossingKind}
      data-crossing-sign={candidate.crossingSign}
      onClick={(event) => {
        if (onPathIntersectionCandidateClick === undefined) {
          return
        }

        event.stopPropagation()
        onPathIntersectionCandidateClick(candidate)
      }}
    >
      <title>{title}</title>
      <rect
        x={center.x - 7.2}
        y={center.y - 7.2}
        width={14.4}
        height={14.4}
        transform={`rotate(45 ${center.x} ${center.y})`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.96}
        strokeWidth={markerStyle.strokeWidth + 3.2}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <rect
        x={center.x - 5.8}
        y={center.y - 5.8}
        width={11.6}
        height={11.6}
        transform={`rotate(45 ${center.x} ${center.y})`}
        fill={markerStyle.fill}
        fillOpacity={markerStyle.fillOpacity}
        stroke={markerStyle.stroke}
        strokeOpacity={markerStyle.strokeOpacity}
        strokeWidth={markerStyle.strokeWidth}
        strokeDasharray={markerStyle.strokeDasharray}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={center.x}
        cy={center.y}
        r={2.35}
        fill={markerStyle.centerFill}
        fillOpacity={0.95}
        pointerEvents="none"
      />
    </g>
  )
}

function pathIntersectionCandidateTooltip(
  candidate: PathIntersectionCandidate,
  crossingKind: ReturnType<typeof pathCrossingKindForCandidate>,
): string {
  switch (crossingKind) {
    case 'none':
      return `No braiding: click to set ${candidate.pathAId} over ${candidate.pathBId}.`
    case 'braiding':
      return `Braiding: ${candidate.pathAId} over ${candidate.pathBId}. Click for anti-braiding.`
    case 'antiBraiding':
      return `Anti-braiding: ${candidate.pathBId} over ${candidate.pathAId}. Click for no braiding.`
  }
}

function pathIntersectionCandidateIsSelectable(
  diagram: Diagram,
  candidate: PathIntersectionCandidate,
  layerFilter: LayerFilter,
): boolean {
  const pathA = diagram.strata.find(
    (stratum) => stratum.id === candidate.pathAId,
  )
  const pathB = diagram.strata.find(
    (stratum) => stratum.id === candidate.pathBId,
  )

  return (
    pathA !== undefined &&
    pathB !== undefined &&
    isLayerSelectableByLayerFilter(diagram, layerFilter, pathA.layer) &&
    isLayerSelectableByLayerFilter(diagram, layerFilter, pathB.layer)
  )
}

function renderCoordinateAxesGuide(
  guide: CoordinateAxesGuide | null,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement | null {
  if (guide === null) {
    return null
  }

  return (
    <g
      key="coordinate-axes-guide"
      className="svg-coordinate-axes-guide"
      pointerEvents={guide.pointerEvents}
      aria-hidden="true"
      data-selectable={String(guide.selectable)}
    >
      {guide.axes.map((axis) =>
        renderCoordinateAxisGuide(axis, camera, viewportHeight),
      )}
    </g>
  )
}

function renderCoordinateAxisGuide(
  axis: CoordinateAxisGuide,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement {
  const from = projectToSvgPoint(camera, axis.from, viewportHeight)
  const to = projectToSvgPoint(camera, axis.to, viewportHeight)
  const labelPosition = projectToSvgPoint(
    camera,
    axis.labelPosition,
    viewportHeight,
  )
  const axisColor = '#64748B'

  return (
    <g key={`coordinate-axis-${axis.axis}`}>
      <path
        d={polylineToSvgPath([from, to])}
        fill="none"
        stroke={axisColor}
        strokeOpacity={0.38}
        strokeWidth={1.15}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={to.x} cy={to.y} r={2.4} fill={axisColor} opacity={0.32} />
      <text
        x={labelPosition.x}
        y={labelPosition.y}
        fill={axisColor}
        opacity={0.58}
        fontSize={10}
        fontWeight={650}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {axis.label}
      </text>
    </g>
  )
}

function renderStratum(
  diagram: Diagram,
  stratum: Stratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  boundaryPathHighlights: BoundaryPathHighlight[] | undefined,
  curveOcclusionById: CurveOcclusionById,
  pointOcclusionById: AnchorOcclusionById,
  visibilityOptions: VisibilityOptions,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
  onCurveStratumClick: SvgDiagramProps['onCurveStratumClick'],
  onPointStratumClick: SvgDiagramProps['onPointStratumClick'],
): RenderItemElement {
  switch (stratum.geometricKind) {
    case 'region':
      return renderRegion(
        diagram,
        stratum,
        camera,
        viewportHeight,
        selectedElement,
        layerFilter,
        onSelectionChange,
      )
    case 'sheet':
      return renderSheet(
        diagram,
        stratum,
        camera,
        viewportHeight,
        selectedElement,
        layerFilter,
        onSelectionChange,
      )
    case 'curve':
      return renderCurve(
        diagram,
        stratum,
        camera,
        viewportHeight,
        selectedElement,
        layerFilter,
        boundaryPathHighlights,
        curveOcclusionById,
        visibilityOptions,
        onSelectionChange,
        onCurveStratumClick,
      )
    case 'point':
      return renderPoint(
        diagram,
        stratum,
        camera,
        viewportHeight,
        selectedElement,
        layerFilter,
        pointOcclusionById,
        visibilityOptions,
        onSelectionChange,
        onPointStratumClick,
      )
  }
}

function renderRegion(
  diagram: Diagram,
  region: RegionStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemElement {
  if (region.kind !== 'filledRegion' || !region.visible) {
    return {
      id: region.id,
      layer: region.layer,
      element: <g key={region.id} />,
    }
  }

  const pathData = closedBoundariesToSvgPathData(region.boundaries, (point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, region.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    region.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, region.id)
  const fillRule = svgFillRuleValue(region.fillRule)
  const surfaceAttributes = filledSurfaceStyleToSvgAttributes(region.style)

  return {
    id: region.id,
    layer: region.layer,
    element: (
      <g
        key={region.id}
        className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
        opacity={previewElementOpacity(isIncludedByFilter)}
        pointerEvents={isSelectable ? undefined : 'none'}
        onClick={(event) =>
          selectElement(event, { kind: 'stratum', id: region.id }, onSelectionChange)
        }
      >
        {isSelected && pathData !== '' && (
          <path
            d={pathData}
            fill={highlightColor}
            fillOpacity={0.14}
            fillRule={fillRule}
            stroke={highlightColor}
            strokeOpacity={0.9}
            strokeWidth={5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {pathData !== '' && (
          <path
            d={pathData}
            fillRule={fillRule}
            vectorEffect="non-scaling-stroke"
            {...surfaceAttributes}
          />
        )}
      </g>
    ),
  }
}

function renderSheet(
  diagram: Diagram,
  sheet: SheetStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemElement {
  if (sheet.kind === 'workPlaneFilledSheet') {
    return renderWorkPlaneFilledSheet(
      diagram,
      sheet,
      camera,
      viewportHeight,
      selectedElement,
      layerFilter,
      onSelectionChange,
    )
  }

  if (sheet.kind === 'curvedSheet') {
    return renderCurvedSheet(
      diagram,
      sheet,
      camera,
      viewportHeight,
      selectedElement,
      layerFilter,
      onSelectionChange,
    )
  }

  const points = sheetVertices(sheet).map((vertex) =>
    projectToSvgPoint(camera, vertex, viewportHeight),
  )
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, sheet.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    sheet.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, sheet.id)

  return {
    id: sheet.id,
    layer: sheet.layer,
    element: (
      <g
        key={sheet.id}
        className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
        opacity={previewElementOpacity(isIncludedByFilter)}
        pointerEvents={isSelectable ? undefined : 'none'}
        onClick={(event) =>
          selectElement(event, { kind: 'stratum', id: sheet.id }, onSelectionChange)
        }
      >
        {isSelected && (
          <polygon
            points={svgPointList(points)}
            fill="none"
            stroke={highlightColor}
            strokeOpacity={0.9}
            strokeWidth={5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        <polygon
          points={svgPointList(points)}
          fill={sheet.style.fillColor}
          fillOpacity={sheet.style.fillOpacity}
          stroke={sheet.style.strokeColor}
          strokeOpacity={sheet.style.strokeOpacity}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    ),
  }
}

function renderCurvedSheet(
  diagram: Diagram,
  sheet: Extract<SheetStratum, { kind: 'curvedSheet' }>,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemElement {
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, sheet.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    sheet.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, sheet.id)
  const surfaceAttributes = filledSurfaceStyleToSvgAttributes(sheet.style, 0.85)

  try {
    const mesh = curvedSheetToSvgMesh(sheet, camera, viewportHeight)

    return {
      id: sheet.id,
      layer: sheet.layer,
      element: (
        <g
          key={sheet.id}
          className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
          opacity={previewElementOpacity(isIncludedByFilter)}
          pointerEvents={isSelectable ? undefined : 'none'}
          data-curved-sheet-primitive={mesh.primitiveKind}
          data-curved-sheet-u-segments={mesh.uSegments}
          data-curved-sheet-v-segments={mesh.vSegments}
          onClick={(event) =>
            selectElement(event, { kind: 'stratum', id: sheet.id }, onSelectionChange)
          }
        >
          {isSelected &&
            mesh.faces.map((face) => (
              <polygon
                key={`${face.key}-highlight-fill`}
                points={face.points}
                fill={highlightColor}
                fillOpacity={0.1}
                stroke="none"
                pointerEvents="none"
              />
            ))}
          {mesh.faces.map((face) => (
            <polygon
              key={face.key}
              points={face.points}
              vectorEffect="non-scaling-stroke"
              {...surfaceAttributes}
            />
          ))}
          {isSelected &&
            mesh.boundaryPathData.map((pathData, index) => (
              <path
                key={`${sheet.id}-curved-boundary-highlight-${index}`}
                d={pathData}
                fill="none"
                stroke={highlightColor}
                strokeOpacity={0.9}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
        </g>
      ),
    }
  } catch {
    return {
      id: sheet.id,
      layer: sheet.layer,
      element: (
        <g
          key={sheet.id}
          className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
          opacity={previewElementOpacity(isIncludedByFilter)}
          pointerEvents="none"
          data-curved-sheet-primitive={sheet.primitive.kind}
          data-curved-sheet-render-error="true"
        />
      ),
    }
  }
}

function renderWorkPlaneFilledSheet(
  diagram: Diagram,
  sheet: Extract<SheetStratum, { kind: 'workPlaneFilledSheet' }>,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemElement {
  const pathData = closedBoundariesToSvgPathData(sheet.boundaries, (point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, sheet.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    sheet.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, sheet.id)
  const fillRule = svgFillRuleValue(sheet.fillRule)
  const surfaceAttributes = filledSurfaceStyleToSvgAttributes(sheet.style)

  return {
    id: sheet.id,
    layer: sheet.layer,
    element: (
      <g
        key={sheet.id}
        className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
        opacity={previewElementOpacity(isIncludedByFilter)}
        pointerEvents={isSelectable ? undefined : 'none'}
        onClick={(event) =>
          selectElement(event, { kind: 'stratum', id: sheet.id }, onSelectionChange)
        }
      >
        {isSelected && pathData !== '' && (
          <path
            d={pathData}
            fill={highlightColor}
            fillOpacity={0.14}
            fillRule={fillRule}
            stroke={highlightColor}
            strokeOpacity={0.9}
            strokeWidth={5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {pathData !== '' && (
          <path
            d={pathData}
            fillRule={fillRule}
            vectorEffect="non-scaling-stroke"
            {...surfaceAttributes}
          />
        )}
      </g>
    ),
  }
}

function renderCurve(
  diagram: Diagram,
  curve: CurveStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  boundaryPathHighlights: BoundaryPathHighlight[] | undefined,
  curveOcclusionById: CurveOcclusionById,
  visibilityOptions: VisibilityOptions,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
  onCurveStratumClick: SvgDiagramProps['onCurveStratumClick'],
): RenderItemElement {
  const occlusion = curveOcclusionById.get(curve.id)
  const pathData = curveToSvgPathData(curve, camera, viewportHeight)
  const pathRuns = curveToSvgPathRuns(
    curve,
    camera,
    viewportHeight,
    occlusion,
    visibilityOptions,
  )
  const arrowheads = curveArrowheadsForSvgPreview(
    curve,
    diagram.ambientDimension,
    (point) => projectToSvgPoint(camera, point, viewportHeight),
  )
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, curve.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    curve.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, curve.id)
  const boundaryHighlight = boundaryPathHighlights?.find(
    (highlight) => highlight.id === curve.id,
  )

  return {
    id: curve.id,
    layer: curve.layer,
    element: (
      <g
        key={curve.id}
        className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
        opacity={previewElementOpacity(isIncludedByFilter)}
        pointerEvents={isSelectable ? undefined : 'none'}
        onClick={(event) =>
          selectCurveElement(
            event,
            curve.id,
            onSelectionChange,
            onCurveStratumClick,
          )
        }
      >
        {boundaryHighlight !== undefined && (
          <path
            d={pathData}
            fill="none"
            stroke="#0F766E"
            strokeOpacity={0.8}
            strokeWidth={curve.style.lineWidth + 7}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            data-boundary-highlight-label={boundaryHighlight.label}
          />
        )}
        {isSelected && (
          <path
            d={pathData}
            fill="none"
            stroke={highlightColor}
            strokeOpacity={0.7}
            strokeWidth={curve.style.lineWidth + 7}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {pathRuns.map((run) => (
          <path
            key={run.key}
            d={run.pathData}
            fill="none"
            stroke={run.stroke}
            strokeOpacity={run.strokeOpacity}
            strokeWidth={run.strokeWidth}
            strokeDasharray={run.strokeDasharray}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {arrowheads.map((arrowhead, index) => (
          <polygon
            key={`${curve.id}-arrowhead-${index}`}
            points={svgPointList([arrowhead.tip, arrowhead.left, arrowhead.right])}
            fill={arrowhead.color}
            fillOpacity={arrowhead.opacity}
            stroke={arrowhead.color}
            strokeOpacity={arrowhead.opacity}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            aria-hidden="true"
            data-svg-arrow-preview={arrowhead.kind}
            data-svg-arrow-head={arrowhead.head}
          />
        ))}
      </g>
    ),
  }
}

function curveToSvgPathData(
  curve: CurveStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
): string {
  if (curve.kind === 'grid') {
    const preview = gridPreviewSegments(curve, curve.codim === 1 ? 2 : 3)

    return preview.ok
      ? preview.segments
          .map((segment) =>
            polylineToSvgPath([
              projectToSvgPoint(camera, segment.start, viewportHeight),
              projectToSvgPoint(camera, segment.end, viewportHeight),
            ]),
          )
          .join(' ')
      : ''
  }

  if (curve.kind === 'concatenatedPath') {
    return pathSegmentsToSvgPath(
      curve.segments.flatMap((segment) =>
        pathSegmentToSvgPathSegments(
          segment,
          camera,
          viewportHeight,
          curve.codim === 1 ? 2 : 3,
        ),
      ),
    )
  }

  if (curve.kind === 'templatePath') {
    return polylineToSvgPath(
      sampleTemplatePathPoints(
        curve.template,
        curve.codim === 1 ? 2 : 3,
      ).map((point) => projectToSvgPoint(camera, point, viewportHeight)),
    )
  }

  const points = curve.points.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )

  return curve.kind === 'cubicBezier'
    ? cubicBezierToSvgPath(points)
    : polylineToSvgPath(points)
}

function curveToSvgPathRuns(
  curve: CurveStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  occlusion: CurveOcclusionResult | undefined,
  visibilityOptions: VisibilityOptions,
): SvgCurvePathRun[] {
  if (
    occlusion !== undefined &&
    !occlusion.capped &&
    occlusion.segments.length > 0
  ) {
    return occlusion.segments.map((segment) => {
      const attributes =
        segment.visibility === 'hidden'
          ? hiddenCurveStyleToSvgStrokeAttributes(
              segment.style,
              visibilityOptions.hiddenCurveStyle ?? defaultHiddenCurveStyle,
            )
          : curveStyleToSvgStrokeAttributes(segment.style)

      return {
        key: `${curve.id}-occlusion-${segment.segmentIndex}-${segment.visibility}`,
        pathData: polylineToSvgPath([
          projectToSvgPoint(camera, segment.start, viewportHeight),
          projectToSvgPoint(camera, segment.end, viewportHeight),
        ]),
        ...attributes,
      }
    })
  }

  if (curve.kind === 'grid') {
    const pathData = curveToSvgPathData(curve, camera, viewportHeight)

    return pathData === ''
      ? []
      : [
          {
            key: `${curve.id}-grid`,
            pathData,
            ...curveStyleToSvgStrokeAttributes(curve.style),
          },
        ]
  }

  if (curve.kind !== 'concatenatedPath') {
    return [
      {
        key: `${curve.id}-path`,
        pathData: curveToSvgPathData(curve, camera, viewportHeight),
        ...curveStyleToSvgStrokeAttributes(curve.style),
      },
    ]
  }

  return pathSegmentStyleRuns(curve.segments, curve.style).map((run) => ({
    key: `${curve.id}-segment-run-${run.startIndex}`,
    pathData: pathSegmentsToSvgPath(
      run.segments.flatMap((segment) =>
        pathSegmentToSvgPathSegments(
          segment,
          camera,
          viewportHeight,
          curve.codim === 1 ? 2 : 3,
        ),
      ),
    ),
    ...curveStyleToSvgStrokeAttributes(run.style),
  }))
}

function renderPoint(
  diagram: Diagram,
  point: PointStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  pointOcclusionById: AnchorOcclusionById,
  visibilityOptions: VisibilityOptions,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
  onPointStratumClick: SvgDiagramProps['onPointStratumClick'],
): RenderItemElement {
  const occlusion = pointOcclusionById.get(point.id)
  const isHiddenBySurface = occlusion?.visibility === 'hidden'

  if (
    isHiddenBySurface &&
    visibilityOptions.pointVisibility === 'hideHidden'
  ) {
    return {
      id: point.id,
      layer: point.layer,
      element: (
        <g
          key={point.id}
          data-point-visibility="hidden"
          data-occluding-surface-id={occlusion.occludingFace?.sourceId}
        />
      ),
    }
  }

  const style = isHiddenBySurface
    ? hiddenPointStyleFromBase(point.style)
    : point.style
  const center = projectToSvgPoint(camera, point.position, viewportHeight)
  const radius = Math.max(style.size * pointRadiusScale, 1)
  const fill = style.fill === 'hollow' ? '#ffffff' : style.color
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, point.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    point.layer,
  )
  const isSelected = isSelectable && isSelectedStratum(selectedElement, point.id)
  const groupProps = {
    className: svgPreviewElementClassName(isIncludedByFilter, isSelectable),
    opacity: previewElementOpacity(isIncludedByFilter),
    pointerEvents: isSelectable ? undefined : 'none',
  } as const
  const commonProps = {
    fill,
    stroke: style.color,
    strokeWidth: 1.4,
    opacity: style.opacity,
    vectorEffect: 'non-scaling-stroke',
  }
  const visibilityDataProps = {
    'data-point-visibility': isHiddenBySurface ? 'dimmed' : 'visible',
    'data-occluding-surface-id': occlusion?.occludingFace?.sourceId,
  }

  switch (style.shape) {
    case 'circle':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <g
            key={point.id}
            {...groupProps}
            {...visibilityDataProps}
            onClick={(event) =>
              selectPointElement(
                event,
                point.id,
                onSelectionChange,
                onPointStratumClick,
              )
            }
          >
            {renderPointHighlight(center, radius, isSelected)}
            <circle {...commonProps} cx={center.x} cy={center.y} r={radius} />
          </g>
        ),
      }
    case 'square':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <g
            key={point.id}
            {...groupProps}
            {...visibilityDataProps}
            onClick={(event) =>
              selectPointElement(
                event,
                point.id,
                onSelectionChange,
                onPointStratumClick,
              )
            }
          >
            {renderPointHighlight(center, radius, isSelected)}
            <polygon
              {...commonProps}
              points={svgPointList(
                regularPolygonPoints(center, radius, 4, Math.PI / 4),
              )}
            />
          </g>
        ),
      }
    case 'triangle':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <g
            key={point.id}
            {...groupProps}
            {...visibilityDataProps}
            onClick={(event) =>
              selectPointElement(
                event,
                point.id,
                onSelectionChange,
                onPointStratumClick,
              )
            }
          >
            {renderPointHighlight(center, radius, isSelected)}
            <polygon
              {...commonProps}
              points={svgPointList(
                regularPolygonPoints(center, radius, 3, -Math.PI / 2),
              )}
            />
          </g>
        ),
      }
    case 'star':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <g
            key={point.id}
            {...groupProps}
            {...visibilityDataProps}
            onClick={(event) =>
              selectPointElement(
                event,
                point.id,
                onSelectionChange,
                onPointStratumClick,
              )
            }
          >
            {renderPointHighlight(center, radius, isSelected)}
            <polygon
              {...commonProps}
              points={svgPointList(starPolygonPoints(center, radius, radius * 0.45))}
            />
          </g>
        ),
      }
  }
}

function renderLabel(
  diagram: Diagram,
  label: TextLabel,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  labelOcclusionById: AnchorOcclusionById,
  visibilityOptions: VisibilityOptions,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItemElement {
  const occlusion = labelOcclusionById.get(label.id)
  const isHiddenBySurface = occlusion?.visibility === 'hidden'

  if (
    isHiddenBySurface &&
    visibilityOptions.labelVisibility === 'autoHide'
  ) {
    return {
      id: label.id,
      layer: label.layer,
      element: (
        <g
          key={label.id}
          data-label-visibility="hidden"
          data-occluding-surface-id={occlusion.occludingFace?.sourceId}
        />
      ),
    }
  }

  const style =
    isHiddenBySurface && visibilityOptions.labelVisibility === 'autoDim'
      ? hiddenLabelStyleFromBase(label.style)
      : label.style
  const position = projectToSvgPoint(camera, label.position, viewportHeight)
  const isIncludedByFilter = layerFilterIncludesLayer(layerFilter, label.layer)
  const isSelectable = isLayerSelectableByLayerFilter(
    diagram,
    layerFilter,
    label.layer,
  )
  const isSelected =
    isSelectable &&
    isSelectedElement(selectedElement, { kind: 'label', id: label.id })
  const fontSize = style.fontSize * 1.35
  const anchorPlacement = svgLabelAnchorPlacement(style.anchor, fontSize)

  return {
    id: label.id,
    layer: label.layer,
    element: (
      <g
        key={label.id}
        className={svgPreviewElementClassName(isIncludedByFilter, isSelectable)}
        opacity={previewElementOpacity(isIncludedByFilter)}
        pointerEvents={isSelectable ? undefined : 'none'}
        data-label-visibility={isHiddenBySurface ? 'dimmed' : 'visible'}
        data-occluding-surface-id={occlusion?.occludingFace?.sourceId}
        onClick={(event) =>
          selectElement(event, { kind: 'label', id: label.id }, onSelectionChange)
        }
      >
        {isSelected && (
          <circle
            cx={position.x}
            cy={position.y}
            r={7}
            fill="none"
            stroke={highlightColor}
            strokeOpacity={0.9}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        <text
          x={position.x}
          y={position.y + anchorPlacement.dy}
          fill={style.color}
          opacity={style.opacity}
          fontSize={fontSize}
          textAnchor={anchorPlacement.textAnchor}
          dominantBaseline={anchorPlacement.dominantBaseline}
          dx={anchorPlacement.dx}
        >
          {label.text}
        </text>
      </g>
    ),
  }
}

function renderWorkPlanePreview(
  preview: WorkPlanePreview | undefined,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement | null {
  if (preview === undefined) {
    return null
  }

  const corners = preview.corners.map((corner) =>
    projectToSvgPoint(camera, corner, viewportHeight),
  )
  const origin = projectToSvgPoint(camera, preview.origin, viewportHeight)
  const uIndicator = projectIndicator(preview.uIndicator, camera, viewportHeight)
  const vIndicator = projectIndicator(preview.vIndicator, camera, viewportHeight)
  const normalIndicator = projectIndicator(
    preview.normalIndicator,
    camera,
    viewportHeight,
  )
  const labelPosition = corners[2]

  return (
    <g
      key="work-plane-preview"
      pointerEvents={preview.pointerEvents}
      aria-hidden="true"
      data-selectable={String(preview.selectable)}
    >
      <polygon
        points={svgPointList(corners)}
        fill="#F59E0B"
        fillOpacity={0.055}
        stroke="#B45309"
        strokeOpacity={0.88}
        strokeWidth={2.1}
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={polylineToSvgPath([corners[0], corners[2]])}
        fill="none"
        stroke="#B45309"
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray="2 7"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={polylineToSvgPath([corners[1], corners[3]])}
        fill="none"
        stroke="#B45309"
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray="2 7"
        vectorEffect="non-scaling-stroke"
      />
      {renderWorkPlaneIndicator(uIndicator, '#2563EB')}
      {renderWorkPlaneIndicator(vIndicator, '#059669')}
      {renderWorkPlaneIndicator(normalIndicator, '#DC2626')}
      <circle
        cx={origin.x}
        cy={origin.y}
        r={4.6}
        fill="#ffffff"
        stroke="#92400E"
        strokeOpacity={0.95}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={labelPosition.x}
        y={labelPosition.y}
        dx={8}
        dy={-8}
        fill="#92400E"
        opacity={0.9}
        fontSize={11}
        fontWeight={600}
        dominantBaseline="middle"
      >
        {preview.label}
      </text>
    </g>
  )
}

function projectIndicator(
  indicator: WorkPlaneDirectionIndicator,
  camera: Diagram['camera'],
  viewportHeight: number,
): SvgWorkPlaneDirectionIndicator {
  return {
    label: indicator.label,
    from: projectToSvgPoint(camera, indicator.from, viewportHeight),
    to: projectToSvgPoint(camera, indicator.to, viewportHeight),
  }
}

function renderWorkPlaneIndicator(
  indicator: SvgWorkPlaneDirectionIndicator,
  color: string,
): ReactElement {
  return (
    <g key={`work-plane-${indicator.label}-indicator`}>
      <path
        d={polylineToSvgPath([indicator.from, indicator.to])}
        fill="none"
        stroke={color}
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={indicator.to.x}
        cy={indicator.to.y}
        r={3.2}
        fill={color}
        opacity={0.9}
      />
      <text
        x={indicator.to.x}
        y={indicator.to.y}
        dx={6}
        dy={-6}
        fill={color}
        opacity={0.95}
        fontSize={10}
        fontWeight={700}
        dominantBaseline="middle"
      >
        {indicator.label}
      </text>
    </g>
  )
}

function renderSheetDraft(
  draft: Vec3[] | undefined,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement | null {
  if (draft === undefined || draft.length === 0) {
    return null
  }

  const points = draft.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const boundaryData = polylineToSvgPath(points)

  return (
    <g key="sheet-draft-preview" pointerEvents="none" aria-hidden="true">
      {points.length >= 3 && (
        <polygon
          points={svgPointList(points)}
          fill="#10B981"
          fillOpacity={0.16}
          stroke="#047857"
          strokeOpacity={0.9}
          strokeWidth={2}
          strokeDasharray="9 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.length === 2 && (
        <path
          d={boundaryData}
          fill="none"
          stroke="#047857"
          strokeOpacity={0.9}
          strokeWidth={2}
          strokeDasharray="9 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((point, index) => (
        <circle
          key={`sheet-draft-vertex-${index}`}
          cx={point.x}
          cy={point.y}
          r={4.3}
          fill="#ffffff"
          stroke="#047857"
          strokeOpacity={0.95}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

function renderPolylineDraft(
  draft: Vec3[] | undefined,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement | null {
  if (draft === undefined || draft.length === 0) {
    return null
  }

  const points = draft.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const pathData = polylineToSvgPath(points)

  return (
    <g key="polyline-draft-preview" pointerEvents="none" aria-hidden="true">
      {points.length >= 2 && (
        <path
          d={pathData}
          fill="none"
          stroke="#5F6C7B"
          strokeOpacity={0.78}
          strokeWidth={2}
          strokeDasharray="7 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((point, index) => (
        <circle
          key={`polyline-draft-vertex-${index}`}
          cx={point.x}
          cy={point.y}
          r={4}
          fill="#ffffff"
          stroke="#5F6C7B"
          strokeOpacity={0.9}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

function renderCubicBezierDraft(
  draft: Vec3[] | undefined,
  camera: Diagram['camera'],
  viewportHeight: number,
): ReactElement | null {
  if (draft === undefined || draft.length === 0) {
    return null
  }

  const points = draft.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const pathData = points.length >= 4 ? cubicBezierToSvgPath(points.slice(0, 4)) : ''
  const guideData = polylineToSvgPath(points)

  return (
    <g key="cubic-bezier-draft-preview" pointerEvents="none" aria-hidden="true">
      {points.length >= 2 && (
        <path
          d={guideData}
          fill="none"
          stroke="#7B8794"
          strokeOpacity={0.55}
          strokeWidth={1.4}
          strokeDasharray="4 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.length >= 4 && (
        <path
          d={pathData}
          fill="none"
          stroke="#8E44AD"
          strokeOpacity={0.82}
          strokeWidth={2.2}
          strokeDasharray="8 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((point, index) => {
        const isAnchor = index === 0 || index === 3

        return (
          <circle
            key={`cubic-bezier-draft-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={isAnchor ? 4.6 : 3.6}
            fill={isAnchor ? '#ffffff' : '#8E44AD'}
            stroke={isAnchor ? '#8E44AD' : '#ffffff'}
            strokeOpacity={0.95}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </g>
  )
}

function renderConcatenatedPathDraft(
  draft: ConcatenatedPathDraft | undefined,
  camera: Diagram['camera'],
  viewportHeight: number,
  ambientDimension: 2 | 3,
): ReactElement | null {
  if (draft === undefined) {
    return null
  }

  const completedSegments = draft.segments.flatMap((segment) =>
    pathSegmentToSvgPathSegments(
      segment,
      camera,
      viewportHeight,
      ambientDimension,
    ),
  )
  const completedPathData = pathSegmentsToSvgPath(completedSegments)
  const anchor = projectToSvgPoint(camera, draft.anchor, viewportHeight)
  const pendingPoints = draft.pendingPoints.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const pendingGuideData =
    pendingPoints.length === 0 ? '' : polylineToSvgPath([anchor, ...pendingPoints])
  const endpoints = pathDraftEndpointMarkers(draft).map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const completedControlGuides = draft.segments.flatMap((segment, index) =>
    segment.kind === 'cubicBezier'
      ? [
          {
            key: `path-draft-cubic-guide-a-${index}`,
            points: [
              projectToSvgPoint(camera, segment.start, viewportHeight),
              projectToSvgPoint(camera, segment.control1, viewportHeight),
            ],
          },
          {
            key: `path-draft-cubic-guide-b-${index}`,
            points: [
              projectToSvgPoint(camera, segment.control2, viewportHeight),
              projectToSvgPoint(camera, segment.end, viewportHeight),
            ],
          },
        ]
      : [],
  )
  const completedControls = draft.segments.flatMap((segment) =>
    segment.kind === 'cubicBezier'
      ? [
          projectToSvgPoint(camera, segment.control1, viewportHeight),
          projectToSvgPoint(camera, segment.control2, viewportHeight),
        ]
      : [],
  )

  return (
    <g
      key="concatenated-path-draft"
      className="svg-path-draft"
      pointerEvents="none"
      aria-hidden="true"
    >
      {completedPathData !== '' && (
        <path
          d={completedPathData}
          fill="none"
          stroke="#7C3AED"
          strokeOpacity={0.8}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {completedControlGuides.map((guide) => (
        <path
          key={guide.key}
          d={polylineToSvgPath(guide.points)}
          fill="none"
          stroke="#7C3AED"
          strokeOpacity={0.34}
          strokeWidth={1.25}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {pendingGuideData !== '' && (
        <path
          d={pendingGuideData}
          fill="none"
          stroke="#0F766E"
          strokeOpacity={0.75}
          strokeWidth={1.7}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {endpoints.map((point, index) => (
        <circle
          key={`path-draft-endpoint-${index}`}
          cx={point.x}
          cy={point.y}
          r={index === endpoints.length - 1 ? 4.7 : 3.6}
          fill="#ffffff"
          stroke="#7C3AED"
          strokeOpacity={0.95}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {completedControls.map((point, index) => (
        <circle
          key={`path-draft-control-${index}`}
          cx={point.x}
          cy={point.y}
          r={3.2}
          fill="#7C3AED"
          fillOpacity={0.56}
          stroke="#ffffff"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {pendingPoints.map((point, index) => (
        <circle
          key={`path-draft-pending-${index}`}
          cx={point.x}
          cy={point.y}
          r={3.7}
          fill="#0F766E"
          fillOpacity={0.82}
          stroke="#ffffff"
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

function renderPointHighlight(
  center: Vec2,
  radius: number,
  isSelected: boolean,
): ReactElement | null {
  if (!isSelected) {
    return null
  }

  return (
    <circle
      cx={center.x}
      cy={center.y}
      r={radius + 6}
      fill="none"
      stroke={highlightColor}
      strokeOpacity={0.85}
      strokeWidth={3}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  )
}

function pathSegmentToSvgPathSegments(
  segment: PathSegment,
  camera: Diagram['camera'],
  viewportHeight: number,
  ambientDimension: 2 | 3,
): SvgPathSegment[] {
  switch (segment.kind) {
    case 'line':
      return [{
        kind: 'line',
        start: projectToSvgPoint(camera, segment.start, viewportHeight),
        end: projectToSvgPoint(camera, segment.end, viewportHeight),
      }]
    case 'cubicBezier':
      return [{
        kind: 'cubicBezier',
        start: projectToSvgPoint(camera, segment.start, viewportHeight),
        control1: projectToSvgPoint(camera, segment.control1, viewportHeight),
        control2: projectToSvgPoint(camera, segment.control2, viewportHeight),
        end: projectToSvgPoint(camera, segment.end, viewportHeight),
      }]
    case 'arc': {
      const cubicSegments = arcSegmentToCubicBezierSegments(
        segment,
        ambientDimension,
      )

      return cubicSegments === null
        ? []
        : cubicSegments.flatMap((cubicSegment) =>
            pathSegmentToSvgPathSegments(
              cubicSegment,
              camera,
              viewportHeight,
              ambientDimension,
            ),
          )
    }
  }
}

function pathDraftEndpointMarkers(draft: ConcatenatedPathDraft): Vec3[] {
  if (draft.segments.length === 0) {
    return [draft.anchor]
  }

  const [firstSegment, ...restSegments] = draft.segments

  return [
    firstSegment.start,
    firstSegment.end,
    ...restSegments.map((segment) => segment.end),
  ]
}

function renderSelectedGeometryHandles(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter,
  onPointerDown: (
    event: PointerEvent<SVGCircleElement>,
    target: GeometryHandleTarget,
  ) => void,
): ReactElement | null {
  if (!isSingleSelectedElement(selectedElement)) {
    return null
  }

  if (selectedElement.kind === 'label') {
    const label = diagram.labels.find(
      (candidate) => candidate.id === selectedElement.id,
    )

    if (
      label === undefined ||
      !isLayerSelectableByLayerFilter(diagram, layerFilter, label.layer)
    ) {
      return null
    }

    return (
      <g key="selected-label-handles" aria-label="Selected label drag handles">
        {renderHandleCircle(
          projectToSvgPoint(camera, label.position, viewportHeight),
          { kind: 'labelPosition', labelId: label.id },
          label.name,
          onPointerDown,
        )}
      </g>
    )
  }

  const stratum = diagram.strata.find(
    (candidate) => candidate.id === selectedElement.id,
  )

  if (
    stratum === undefined ||
    !shouldRenderStratumInSvgPreview(diagram, stratum) ||
    !isLayerSelectableByLayerFilter(diagram, layerFilter, stratum.layer)
  ) {
    return null
  }

  switch (stratum.geometricKind) {
    case 'region':
      return null
    case 'point':
      return (
        <g key="selected-point-handles" aria-label="Selected point drag handles">
          {renderHandleCircle(
            projectToSvgPoint(camera, stratum.position, viewportHeight),
            { kind: 'pointPosition', stratumId: stratum.id },
            stratum.name,
            onPointerDown,
          )}
        </g>
      )
    case 'curve':
      if (stratum.kind === 'templatePath') {
        const handles = templatePathHandleDescriptions(
          stratum,
          diagram.ambientDimension,
        )

        return (
          <g
            key="selected-template-path-handles"
            aria-label="Selected template path drag handles"
          >
            {handles.map((handle) =>
              renderHandleCircle(
                projectToSvgPoint(camera, handle.point, viewportHeight),
                handle.target,
                handle.label,
                onPointerDown,
              ),
            )}
          </g>
        )
      }

      if (stratum.kind === 'concatenatedPath') {
        const handles = concatenatedPathHandleDescriptions(stratum)

        return (
          <g
            key="selected-path-handles"
            aria-label="Selected path drag handles"
          >
            {handles.map((handle) =>
              renderHandleCircle(
                projectToSvgPoint(camera, handle.point, viewportHeight),
                {
                  kind: 'pathSegmentPoint',
                  stratumId: stratum.id,
                  segmentIndex: handle.target.segmentIndex,
                  role: handle.target.role,
                },
                handle.label,
                onPointerDown,
              ),
            )}
          </g>
        )
      }

      if (stratum.kind === 'grid') {
        return null
      }

      return (
        <g key="selected-curve-handles" aria-label="Selected curve drag handles">
          {stratum.points.map((point, index) =>
            renderHandleCircle(
              projectToSvgPoint(camera, point, viewportHeight),
              { kind: 'curvePoint', stratumId: stratum.id, pointIndex: index },
              curveHandleLabel(stratum.kind, index),
              onPointerDown,
            ),
          )}
        </g>
      )
    case 'sheet':
      return (
        <g key="selected-sheet-handles" aria-label="Selected sheet drag handles">
          {sheetVertices(stratum).map((vertex, index) =>
            renderHandleCircle(
              projectToSvgPoint(camera, vertex, viewportHeight),
              { kind: 'sheetVertex', stratumId: stratum.id, vertexIndex: index },
              vertexHandleLabel(index),
              onPointerDown,
            ),
          )}
        </g>
      )
  }
}

function renderHandleCircle(
  center: Vec2,
  target: GeometryHandleTarget,
  label: string,
  onPointerDown: (
    event: PointerEvent<SVGCircleElement>,
    target: GeometryHandleTarget,
  ) => void,
): ReactElement {
  return (
    <circle
      key={geometryHandleKey(target)}
      className="svg-geometry-handle"
      cx={center.x}
      cy={center.y}
      r={handleRadius}
      fill={handleFillColor}
      stroke={handleStrokeColor}
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
      aria-label={label}
      onPointerDown={(event) => onPointerDown(event, target)}
      onClick={(event) => event.stopPropagation()}
    />
  )
}

type ConcatenatedPathHandleDescription = {
  target: ConcatenatedPathPointTarget
  point: Vec3
  label: string
}

type TemplatePathHandleDescription = {
  target: GeometryHandleTarget
  point: Vec3
  label: string
}

function concatenatedPathHandleDescriptions(
  path: ConcatenatedPathStratum,
): ConcatenatedPathHandleDescription[] {
  return describeConcatenatedPathSegments(path).flatMap((segment) =>
    segment.points
      .filter(
        (point) =>
          point.target.role !== 'start' || point.target.segmentIndex === 0,
      )
      .map((point) => ({
        target: point.target,
        point: point.point,
        label: `Segment ${segment.segmentNumber} ${point.label}`,
      })),
  )
}

function templatePathHandleDescriptions(
  path: Extract<CurveStratum, { kind: 'templatePath' }>,
  ambientDimension: 2 | 3,
): TemplatePathHandleDescription[] {
  switch (path.template.kind) {
    case 'circleTemplate':
      return [
        {
          target: { kind: 'circleTemplateRadius', stratumId: path.id },
          point: circleTemplateRadiusHandlePoint(
            path.template,
            ambientDimension,
          ),
          label: `${path.name} radius`,
        },
      ]
    case 'ellipseTemplate': {
      const handles = ellipseTemplateRadiusHandlePoints(
        path.template,
        ambientDimension,
      )

      return [
        {
          target: { kind: 'ellipseTemplateRadiusX', stratumId: path.id },
          point: handles.radiusX,
          label: `${path.name} radius x`,
        },
        {
          target: { kind: 'ellipseTemplateRadiusY', stratumId: path.id },
          point: handles.radiusY,
          label: `${path.name} radius y`,
        },
      ]
    }
  }
}

function geometryHandleKey(target: GeometryHandleTarget): string {
  switch (target.kind) {
    case 'pointPosition':
      return `point-handle-${target.stratumId}`
    case 'labelPosition':
      return `label-handle-${target.labelId}`
    case 'curvePoint':
      return `curve-handle-${target.stratumId}-${target.pointIndex}`
    case 'pathSegmentPoint':
      return `path-handle-${target.stratumId}-${target.segmentIndex}-${target.role}`
    case 'circleTemplateRadius':
      return `template-circle-radius-handle-${target.stratumId}`
    case 'ellipseTemplateRadiusX':
      return `template-ellipse-radius-x-handle-${target.stratumId}`
    case 'ellipseTemplateRadiusY':
      return `template-ellipse-radius-y-handle-${target.stratumId}`
    case 'sheetVertex':
      return `sheet-handle-${target.stratumId}-${target.vertexIndex}`
  }
}

function selectElement(
  event: MouseEvent<SVGGElement>,
  selection: SingleSelectedElement,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): void {
  if (onSelectionChange === undefined) {
    return
  }

  event.stopPropagation()
  onSelectionChange(selection, { mode: selectionClickModeFromMouseEvent(event) })
}

function selectCurveElement(
  event: MouseEvent<SVGGElement>,
  curveId: string,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
  onCurveStratumClick: SvgDiagramProps['onCurveStratumClick'],
): void {
  if (onCurveStratumClick !== undefined) {
    event.stopPropagation()
    onCurveStratumClick(curveId)
    return
  }

  selectElement(event, { kind: 'stratum', id: curveId }, onSelectionChange)
}

function selectPointElement(
  event: MouseEvent<SVGGElement>,
  pointId: string,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
  onPointStratumClick: SvgDiagramProps['onPointStratumClick'],
): void {
  if (onPointStratumClick !== undefined) {
    event.stopPropagation()
    onPointStratumClick(pointId)
    return
  }

  selectElement(event, { kind: 'stratum', id: pointId }, onSelectionChange)
}

function svgPointFromMouseEvent(
  event: MouseEvent<SVGSVGElement>,
  viewportWidth: number,
  viewportHeight: number,
): Vec2 {
  const bounds = event.currentTarget.getBoundingClientRect()

  return mapClientPointToViewBox(
    { x: event.clientX, y: event.clientY },
    bounds,
    { width: viewportWidth, height: viewportHeight },
  )
}

function svgPointFromPointerEvent(
  event: PointerEvent<SVGSVGElement>,
  viewportWidth: number,
  viewportHeight: number,
): Vec2 {
  const bounds = event.currentTarget.getBoundingClientRect()

  return mapClientPointToViewBox(
    { x: event.clientX, y: event.clientY },
    bounds,
    { width: viewportWidth, height: viewportHeight },
  )
}

function isSvgBackgroundTarget(target: EventTarget): boolean {
  return (
    target instanceof SVGElement &&
    target.dataset.svgBackground === 'true'
  )
}

function releasePointerCaptureIfHeld(event: PointerEvent<SVGSVGElement>): void {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}

function isSelectedStratum(
  selectedElement: SelectedElement,
  id: string,
): boolean {
  return isSelectedElement(selectedElement, { kind: 'stratum', id })
}

function selectionClickModeFromMouseEvent(
  event: MouseEvent<SVGElement>,
): SelectionClickMode {
  return event.shiftKey || event.metaKey || event.ctrlKey ? 'toggle' : 'replace'
}

function previewElementOpacity(isIncludedByFilter: boolean): number | undefined {
  return isIncludedByFilter ? undefined : 0.16
}

function svgPreviewElementClassName(
  isIncludedByFilter: boolean,
  isSelectable: boolean,
): string {
  if (!isIncludedByFilter) {
    return 'svg-filtered-out'
  }

  return isSelectable ? 'svg-selectable' : 'svg-locked-layer'
}
