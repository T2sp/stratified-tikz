import type { ReactElement } from 'react'
import { projectVec3 } from '../geometry/projection'
import type {
  Camera,
  CurveStratum,
  Diagram,
  PointStratum,
  SheetStratum,
  Stratum,
  TextLabel,
  Vec2,
  Vec3,
} from '../model/types'
import {
  cubicBezierToSvgPath,
  polylineToSvgPath,
  regularPolygonPoints,
  starPolygonPoints,
  svgPointList,
} from './svgPath'
import {
  anchorToDominantBaseline,
  anchorToTextAnchor,
  lineStyleToStrokeDasharray,
} from './svgStyle'

export type SvgDiagramProps = {
  diagram: Diagram
  width?: number
  height?: number
}

type RenderItem = {
  id: string
  layer: number
  element: ReactElement
}

const defaultWidth = 520
const defaultHeight = 360
const previewPadding = 36
const pointRadiusScale = 1.8

export function SvgDiagram({
  diagram,
  width = defaultWidth,
  height = defaultHeight,
}: SvgDiagramProps): ReactElement {
  const camera = createPreviewCamera(diagram, width, height)
  const items = [
    ...diagram.strata
      .filter((stratum) => shouldRenderStratum(diagram.ambientDimension, stratum))
      .map((stratum) => renderStratum(stratum, camera)),
    ...diagram.labels.map((label) => renderLabel(label, camera)),
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

function renderStratum(stratum: Stratum, camera: Camera): RenderItem {
  switch (stratum.geometricKind) {
    case 'region':
      return {
        id: stratum.id,
        layer: stratum.layer,
        element: <g key={stratum.id} />,
      }
    case 'sheet':
      return renderSheet(stratum, camera)
    case 'curve':
      return renderCurve(stratum, camera)
    case 'point':
      return renderPoint(stratum, camera)
  }
}

function renderSheet(sheet: SheetStratum, camera: Camera): RenderItem {
  const points = sheet.corners.map((corner) => projectVec3(camera, corner))

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

function renderCurve(curve: CurveStratum, camera: Camera): RenderItem {
  const points = curve.points.map((point) => projectVec3(camera, point))
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

function renderPoint(point: PointStratum, camera: Camera): RenderItem {
  const center = projectVec3(camera, point.position)
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

function renderLabel(label: TextLabel, camera: Camera): RenderItem {
  const position = projectVec3(camera, label.position)

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

function createPreviewCamera(
  diagram: Diagram,
  width: number,
  height: number,
): Camera {
  const modelPoints = collectDiagramPoints(diagram)
  const unitCamera = {
    ...diagram.camera,
    scale: 1,
    origin: { x: 0, y: 0 },
  }
  const projectedPoints = modelPoints.map((point) => projectVec3(unitCamera, point))
  const bounds = getBounds(projectedPoints)
  const spanX = Math.max(bounds.maxX - bounds.minX, 1)
  const spanY = Math.max(bounds.maxY - bounds.minY, 1)
  const availableWidth = Math.max(width - previewPadding * 2, 1)
  const availableHeight = Math.max(height - previewPadding * 2, 1)
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY)
  const usedWidth = spanX * scale
  const usedHeight = spanY * scale

  return {
    ...diagram.camera,
    scale,
    origin: {
      x: previewPadding + (availableWidth - usedWidth) / 2 - bounds.minX * scale,
      y: previewPadding + (availableHeight - usedHeight) / 2 - bounds.minY * scale,
    },
  }
}

function collectDiagramPoints(diagram: Diagram): Vec3[] {
  const stratumPoints = diagram.strata.flatMap((stratum) => {
    switch (stratum.geometricKind) {
      case 'region':
        return []
      case 'sheet':
        return [...stratum.corners]
      case 'curve':
        return [...stratum.points]
      case 'point':
        return [stratum.position]
    }
  })

  return [...stratumPoints, ...diagram.labels.map((label) => label.position)]
}

function getBounds(points: Vec2[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  if (points.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: points[0].x,
      maxX: points[0].x,
      minY: points[0].y,
      maxY: points[0].y,
    },
  )
}
