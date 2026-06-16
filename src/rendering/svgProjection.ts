import {
  projectVec3,
  screenToModelOnWorkPlane,
} from '../geometry/projection.ts'
import type { Camera, Vec2, Vec3, WorkPlane } from '../model/types'

export function projectToSvgPoint(
  camera: Camera,
  point: Vec3,
  viewportHeight: number,
): Vec2 {
  return viewToSvgPoint(projectVec3(camera, point), viewportHeight)
}

export function svgPointToModelOnWorkPlane(
  camera: Camera,
  svgPoint: Vec2,
  viewportHeight: number,
  workPlane: WorkPlane,
): Vec3 {
  return screenToModelOnWorkPlane(
    svgToViewPoint(svgPoint, viewportHeight),
    workPlane,
    camera,
  )
}

export function viewToSvgPoint(point: Vec2, viewportHeight: number): Vec2 {
  return {
    x: point.x,
    // TikZ and the model use mathematical coordinates with positive y upward.
    // SVG's y axis points downward, so the preview flips y only at this boundary.
    y: viewportHeight - point.y,
  }
}

export function svgToViewPoint(point: Vec2, viewportHeight: number): Vec2 {
  return {
    x: point.x,
    y: viewportHeight - point.y,
  }
}
