import type { ReactElement } from 'react'
import type {
  CurveStratum,
  Diagram,
  PointStratum,
  SheetStratum,
  Stratum,
  TextLabel,
} from '../model/types'
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
  anchorToDominantBaseline,
  anchorToTextAnchor,
  lineStyleToStrokeDasharray,
} from './svgStyle'

export type SvgDiagramProps = {
  diagram: Diagram
  width?: number
  height?: number
  fitToView?: boolean
}

type RenderItem = {
  id: string
  layer: number
  element: ReactElement
}

const defaultWidth = 520
const defaultHeight = 360
const pointRadiusScale = 1.8

export function SvgDiagram({
  diagram,
  width = defaultWidth,
  height = defaultHeight,
  fitToView = false,
}: SvgDiagramProps): ReactElement {
  const camera = resolveSvgCamera(diagram, width, height, { fitToView })
  const items = [
    ...diagram.strata
      .filter((stratum) => shouldRenderStratum(diagram.ambientDimension, stratum))
      .map((stratum) => renderStratum(stratum, camera, height)),
    ...diagram.labels.map((label) => renderLabel(label, camera, height)),
  ].sort((left, right) => left.layer - right.layer || left.id.localeCompare(right.id))

  return (
    <svg
      className="svg-diagram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${diagram.ambientDimension}D StratifiedTikZ example`}
    >
      <rect width={width} height={height} fill="currentColor" opacity="0.04" />
      <g>{items.map((item) => item.element)}</g>
    </svg>
  )
}

function renderStratum(
  stratum: Stratum,
  camera: Diagram['camera'],
  viewportHeight: number,
): RenderItem {
  switch (stratum.geometricKind) {
    case 'region':
      return {
        id: stratum.id,
        layer: stratum.layer,
        element: <g key={stratum.id} />,
      }
    case 'sheet':
      return renderSheet(stratum, camera, viewportHeight)
    case 'curve':
      return renderCurve(stratum, camera, viewportHeight)
    case 'point':
      return renderPoint(stratum, camera, viewportHeight)
  }
}

function renderSheet(
  sheet: SheetStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
): RenderItem {
  const points = sheet.corners.map((corner) =>
    projectToSvgPoint(camera, corner, viewportHeight),
  )

  return {
    id: sheet.id,
    layer: sheet.layer,
    element: (
      <polygon
        key={sheet.id}
        points={svgPointList(points)}
        fill={sheet.style.fillColor}
        fillOpacity={sheet.style.fillOpacity}
        stroke={sheet.style.strokeColor}
        strokeOpacity={sheet.style.strokeOpacity}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    ),
  }
}

function renderCurve(
  curve: CurveStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
): RenderItem {
  const points = curve.points.map((point) =>
    projectToSvgPoint(camera, point, viewportHeight),
  )
  const pathData =
    curve.kind === 'cubicBezier'
      ? cubicBezierToSvgPath(points)
      : polylineToSvgPath(points)
  const dashArray = lineStyleToStrokeDasharray(curve.style.lineStyle)

  return {
    id: curve.id,
    layer: curve.layer,
    element: (
      <path
        key={curve.id}
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
    ),
  }
}

function renderPoint(
  point: PointStratum,
  camera: Diagram['camera'],
  viewportHeight: number,
): RenderItem {
  const center = projectToSvgPoint(camera, point.position, viewportHeight)
  const radius = Math.max(point.style.size * pointRadiusScale, 1)
  const fill = point.style.fill === 'hollow' ? '#ffffff' : point.style.color
  const commonProps = {
    key: point.id,
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
        element: <circle {...commonProps} cx={center.x} cy={center.y} r={radius} />,
      }
    case 'square':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <polygon
            {...commonProps}
            points={svgPointList(
              regularPolygonPoints(center, radius, 4, Math.PI / 4),
            )}
          />
        ),
      }
    case 'triangle':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <polygon
            {...commonProps}
            points={svgPointList(
              regularPolygonPoints(center, radius, 3, -Math.PI / 2),
            )}
          />
        ),
      }
    case 'star':
      return {
        id: point.id,
        layer: point.layer,
        element: (
          <polygon
            {...commonProps}
            points={svgPointList(starPolygonPoints(center, radius, radius * 0.45))}
          />
        ),
      }
  }
}

function renderLabel(
  label: TextLabel,
  camera: Diagram['camera'],
  viewportHeight: number,
): RenderItem {
  const position = projectToSvgPoint(camera, label.position, viewportHeight)

  return {
    id: label.id,
    layer: label.layer,
    element: (
      <text
        key={label.id}
        x={position.x}
        y={position.y}
        fill={label.style.color}
        opacity={label.style.opacity}
        fontSize={label.style.fontSize * 1.35}
        textAnchor={anchorToTextAnchor(label.style.anchor)}
        dominantBaseline={anchorToDominantBaseline(label.style.anchor)}
      >
        {label.text}
      </text>
    ),
  }
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
