import { projectVec3 } from '../geometry/projection.ts'
import { sheetVertices } from '../model/sheets.ts'
import type { Camera, Diagram, Vec2, Vec3 } from '../model/types'

export type CameraViewAdjustment = {
  zoom: number
  pan: Vec2
}

export type ResolveSvgCameraOptions = {
  fitToView?: boolean
  padding?: number
  extraPointsForFit?: readonly Vec3[]
  cameraOverride?: Camera
  viewAdjustment?: CameraViewAdjustment
}

const defaultPreviewPadding = 36

export function resolveSvgCamera(
  diagram: Diagram,
  width: number,
  height: number,
  options: ResolveSvgCameraOptions = {},
): Camera {
  const baseDiagram =
    options.cameraOverride === undefined
      ? diagram
      : { ...diagram, camera: options.cameraOverride }
  const resolvedCamera = options.fitToView
    ? fitCameraToDiagram(
        baseDiagram,
        width,
        height,
        options.padding ?? defaultPreviewPadding,
        options.extraPointsForFit ?? [],
      )
    : baseDiagram.camera

  return options.viewAdjustment === undefined
    ? resolvedCamera
    : applyCameraViewAdjustment(resolvedCamera, options.viewAdjustment)
}

export function applyCameraViewAdjustment(
  camera: Camera,
  adjustment: CameraViewAdjustment,
): Camera {
  if (
    !Number.isFinite(adjustment.zoom) ||
    adjustment.zoom <= 0 ||
    !Number.isFinite(adjustment.pan.x) ||
    !Number.isFinite(adjustment.pan.y)
  ) {
    throw new Error('Camera view adjustment must be finite with positive zoom.')
  }

  if (camera.mode === '2d') {
    return {
      ...camera,
      scale: camera.scale * adjustment.zoom,
      origin: {
        x: camera.origin.x + adjustment.pan.x,
        y: camera.origin.y + adjustment.pan.y,
      },
    }
  }

  return {
    ...camera,
    zoom: camera.zoom * adjustment.zoom,
    pan: {
      x: camera.pan.x + adjustment.pan.x,
      y: camera.pan.y + adjustment.pan.y,
    },
  }
}

export function fitCameraToDiagram(
  diagram: Diagram,
  width: number,
  height: number,
  padding: number,
  extraPointsForFit: readonly Vec3[],
): Camera {
  const modelPoints = [...collectDiagramPoints(diagram), ...extraPointsForFit]
  const unitCamera = cameraWithUnitView(diagram.camera)
  const projectedPoints = modelPoints.map((point) => projectVec3(unitCamera, point))
  const bounds = getBounds(projectedPoints)
  const spanX = Math.max(bounds.maxX - bounds.minX, 1)
  const spanY = Math.max(bounds.maxY - bounds.minY, 1)
  const availableWidth = Math.max(width - padding * 2, 1)
  const availableHeight = Math.max(height - padding * 2, 1)
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY)
  const usedWidth = spanX * scale
  const usedHeight = spanY * scale

  return cameraWithView(diagram.camera, scale, {
    x: padding + (availableWidth - usedWidth) / 2 - bounds.minX * scale,
    y: padding + (availableHeight - usedHeight) / 2 - bounds.minY * scale,
  })
}

function cameraWithUnitView(camera: Camera): Camera {
  if (camera.mode === '2d') {
    return {
      ...camera,
      scale: 1,
      origin: { x: 0, y: 0 },
    }
  }

  return {
    ...camera,
    zoom: 1,
    pan: { x: 0, y: 0 },
  }
}

function cameraWithView(camera: Camera, scale: number, origin: Vec2): Camera {
  if (camera.mode === '2d') {
    return {
      ...camera,
      scale,
      origin,
    }
  }

  return {
    ...camera,
    zoom: scale,
    pan: origin,
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
