import type { ReactElement } from 'react'
import type { MouseEvent } from 'react'
import type {
  CurveStratum,
  Diagram,
  PointStratum,
  SheetStratum,
  Stratum,
  TextLabel,
  Vec2,
  Vec3,
} from '../model/types'
import { sheetVertices } from '../model/sheets.ts'
import type { SelectedElement } from '../ui/selection'
import { resolveSvgCamera } from './svgCamera'
import {
  cubicBezierToSvgPath,
  polylineToSvgPath,
  regularPolygonPoints,
  starPolygonPoints,
  svgPointList,
} from './svgPath'
import { projectToSvgPoint } from './svgProjection'
import {
  lineStyleToStrokeDasharray,
  svgLabelAnchorPlacement,
} from './svgStyle'
import { mapClientPointToViewBox } from './svgViewBox'

export type SvgDiagramProps = {
  diagram: Diagram
  width?: number
  height?: number
  fitToView?: boolean
  selectedElement?: SelectedElement
  polylineDraft?: Vec3[]
  cubicBezierDraft?: Vec3[]
  sheetDraft?: Vec3[]
  workPlanePreview?: WorkPlanePreview
  onSelectionChange?: (selection: SelectedElement) => void
  onCanvasClick?: (
    svgPoint: Vec2,
    viewportHeight: number,
    camera: Diagram['camera'],
  ) => void
}

export type WorkPlanePreview = {
  corners: [Vec3, Vec3, Vec3, Vec3]
  label?: string
}

type RenderItem = {
  id: string
  layer: number
  element: ReactElement
}

const defaultWidth = 520
const defaultHeight = 360
const pointRadiusScale = 1.8
const highlightColor = '#F4B400'

export function SvgDiagram({
  diagram,
  width = defaultWidth,
  height = defaultHeight,
  fitToView = false,
  selectedElement = null,
  polylineDraft,
  cubicBezierDraft,
  sheetDraft,
  workPlanePreview,
  onSelectionChange,
  onCanvasClick,
}: SvgDiagramProps): ReactElement {
  const extraPointsForFit = [
    ...(workPlanePreview?.corners ?? []),
    ...(sheetDraft ?? []),
    ...(polylineDraft ?? []),
    ...(cubicBezierDraft ?? []),
  ]
  const camera = resolveSvgCamera(diagram, width, height, {
    fitToView,
    extraPointsForFit,
  })
  const items = [
    ...diagram.strata
      .filter((stratum) => shouldRenderStratum(diagram.ambientDimension, stratum))
      .map((stratum) =>
        renderStratum(stratum, camera, height, selectedElement, onSelectionChange),
      ),
    ...diagram.labels.map((label) =>
      renderLabel(label, camera, height, selectedElement, onSelectionChange),
    ),
  ].sort((left, right) => left.layer - right.layer || left.id.localeCompare(right.id))

  return (
    <svg
      className="svg-diagram"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${diagram.ambientDimension}D StratifiedTikZ example`}
      onClick={(event) => {
        if (onCanvasClick !== undefined) {
          onCanvasClick(svgPointFromMouseEvent(event, width, height), height, camera)
          return
        }

        onSelectionChange?.(null)
      }}
    >
      <rect width={width} height={height} fill="currentColor" opacity="0.04" />
      {renderWorkPlanePreview(workPlanePreview, camera, height)}
      <g>{items.map((item) => item.element)}</g>
      {renderSheetDraft(sheetDraft, camera, height)}
      {renderPolylineDraft(polylineDraft, camera, height)}
      {renderCubicBezierDraft(cubicBezierDraft, camera, height)}
    </svg>
  )
}

function renderStratum(
  stratum: Stratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItem {
  switch (stratum.geometricKind) {
    case 'region':
      return {
        id: stratum.id,
        layer: stratum.layer,
        element: <g key={stratum.id} />,
      }
    case 'sheet':
      return renderSheet(stratum, camera, viewportHeight, selectedElement, onSelectionChange)
    case 'curve':
      return renderCurve(stratum, camera, viewportHeight, selectedElement, onSelectionChange)
    case 'point':
      return renderPoint(stratum, camera, viewportHeight, selectedElement, onSelectionChange)
  }
}

function renderSheet(
  sheet: SheetStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItem {
  const points = sheetVertices(sheet).map((vertex) =>
    projectToSvgPoint(camera, vertex, viewportHeight),
  )
  const isSelected = isSelectedStratum(selectedElement, sheet.id)

  return {
    id: sheet.id,
    layer: sheet.layer,
    element: (
      <g
        key={sheet.id}
        className="svg-selectable"
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

function renderCurve(
  curve: CurveStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItem {
  const points = curve.points.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const pathData =
    curve.kind === 'cubicBezier'
      ? cubicBezierToSvgPath(points)
      : polylineToSvgPath(points)
  const dashArray = lineStyleToStrokeDasharray(curve.style.lineStyle)
  const isSelected = isSelectedStratum(selectedElement, curve.id)

  return {
    id: curve.id,
    layer: curve.layer,
    element: (
      <g
        key={curve.id}
        className="svg-selectable"
        onClick={(event) =>
          selectElement(event, { kind: 'stratum', id: curve.id }, onSelectionChange)
        }
      >
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
        <path
          d={pathData}
          fill="none"
          stroke={curve.style.strokeColor}
          strokeOpacity={curve.style.strokeOpacity}
          strokeWidth={curve.style.lineWidth}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    ),
  }
}

function renderPoint(
  point: PointStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItem {
  const center = projectToSvgPoint(camera, point.position, viewportHeight)
  const radius = Math.max(point.style.size * pointRadiusScale, 1)
  const fill = point.style.fill === 'hollow' ? '#ffffff' : point.style.color
  const isSelected = isSelectedStratum(selectedElement, point.id)
  const commonProps = {
    fill,
    stroke: point.style.color,
    strokeWidth: 1.4,
    opacity: point.style.opacity,
    vectorEffect: 'non-scaling-stroke',
  }

  switch (point.style.shape) {
    case 'circle':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <g
            key={point.id}
            className="svg-selectable"
            onClick={(event) =>
              selectElement(event, { kind: 'stratum', id: point.id }, onSelectionChange)
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
            className="svg-selectable"
            onClick={(event) =>
              selectElement(event, { kind: 'stratum', id: point.id }, onSelectionChange)
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
            className="svg-selectable"
            onClick={(event) =>
              selectElement(event, { kind: 'stratum', id: point.id }, onSelectionChange)
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
            className="svg-selectable"
            onClick={(event) =>
              selectElement(event, { kind: 'stratum', id: point.id }, onSelectionChange)
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
  label: TextLabel,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): RenderItem {
  const position = projectToSvgPoint(camera, label.position, viewportHeight)
  const isSelected = selectedElement?.kind === 'label' && selectedElement.id === label.id
  const fontSize = label.style.fontSize * 1.35
  const anchorPlacement = svgLabelAnchorPlacement(label.style.anchor, fontSize)

  return {
    id: label.id,
    layer: label.layer,
    element: (
      <g
        key={label.id}
        className="svg-selectable"
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
          fill={label.style.color}
          opacity={label.style.opacity}
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
  const labelPosition = corners[2]

  return (
    <g key="work-plane-preview" pointerEvents="none" aria-hidden="true">
      <polygon
        points={svgPointList(corners)}
        fill="#F59E0B"
        fillOpacity={0.035}
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
      {preview.label !== undefined && (
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
      )}
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

function selectElement(
  event: MouseEvent<SVGGElement>,
  selection: NonNullable<SelectedElement>,
  onSelectionChange: SvgDiagramProps['onSelectionChange'],
): void {
  if (onSelectionChange === undefined) {
    return
  }

  event.stopPropagation()
  onSelectionChange(selection)
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

function isSelectedStratum(
  selectedElement: SelectedElement,
  id: string,
): boolean {
  return selectedElement?.kind === 'stratum' && selectedElement.id === id
}

function shouldRenderStratum(
  ambientDimension: Diagram['ambientDimension'],
  stratum: Stratum,
): boolean {
  if (ambientDimension === 2) {
    return (
      (stratum.geometricKind === 'curve' && stratum.codim === 1) ||
      (stratum.geometricKind === 'point' && stratum.codim === 2)
    )
  }

  return (
    (stratum.geometricKind === 'sheet' && stratum.codim === 1) ||
    (stratum.geometricKind === 'curve' && stratum.codim === 2) ||
    (stratum.geometricKind === 'point' && stratum.codim === 3)
  )
}
