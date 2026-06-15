import { projectVec3 } from '../geometry/projection.ts'
import { sheetVertices } from '../model/sheets.ts'
import type { Camera, Diagram, Vec2, Vec3 } from '../model/types'

export type ResolveSvgCameraOptions = {
  fitToView?: boolean
  padding?: number
  extraPointsForFit?: readonly Vec3[]
}

const defaultPreviewPadding = 36

export function resolveSvgCamera(
  diagram: Diagram,
  width: number,
  height: number,
  options: ResolveSvgCameraOptions = {},
): Camera {
  if (!options.fitToView) {
    return diagram.camera
  }

  return createFittedCamera(
    diagram,
    width,
    height,
    options.padding ?? defaultPreviewPadding,
    options.extraPointsForFit ?? [],
  )
}

function createFittedCamera(
  diagram: Diagram,
  width: number,
  height: number,
  padding: number,
  extraPointsForFit: readonly Vec3[],
): Camera {
  const modelPoints = [...collectDiagramPoints(diagram), ...extraPointsForFit]
  const unitCamera = {
    ...diagram.camera,
    scale: 1,
    origin: { x: 0, y: 0 },
  }
  const projectedPoints = modelPoints.map((point) => projectVec3(unitCamera, point))
  const bounds = getBounds(projectedPoints)
  const spanX = Math.max(bounds.maxX - bounds.minX, 1)
  const spanY = Math.max(bounds.maxY - bounds.minY, 1)
  const availableWidth = Math.max(width - padding * 2, 1)
  const availableHeight = Math.max(height - padding * 2, 1)
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY)
  const usedWidth = spanX * scale
  const usedHeight = spanY * scale

  return {
    ...diagram.camera,
    scale,
    origin: {
      x: padding + (availableWidth - usedWidth) / 2 - bounds.minX * scale,
      y: padding + (availableHeight - usedHeight) / 2 - bounds.minY * scale,
    },
  }
}

function collectDiagramPoints(diagram: Diagram): Vec3[] {
  const stratumPoints = diagram.strata.flatMap((stratum) => {
    switch (stratum.geometricKind) {
      case 'region':
        return []
      case 'sheet':
        return [...sheetVertices(stratum)]
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
