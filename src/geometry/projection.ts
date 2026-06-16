import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  Vec2,
  Vec3,
  WorkPlane,
} from '../model/types'
import { pointOnWorkPlane, workPlaneToBasis } from './workPlane.ts'

type BasisVector2D = Vec2

export function projectVec3(camera: Camera, point: Vec3): Vec2 {
  if (camera.mode === '2d') {
    return {
      x: camera.origin.x + camera.scale * point.x,
      y: camera.origin.y + camera.scale * point.y,
    }
  }

  return {
    x:
      camera.origin.x +
      camera.scale *
        (point.x * camera.xVector[0] +
          point.y * camera.yVector[0] +
          point.z * camera.zVector[0]),
    y:
      camera.origin.y +
      camera.scale *
        (point.x * camera.xVector[1] +
          point.y * camera.yVector[1] +
          point.z * camera.zVector[1]),
  }
}

export function screenToModel2D(camera: Camera2D, screenPoint: Vec2): Vec3 {
  assertUsableScale(camera.scale)

  return {
    x: (screenPoint.x - camera.origin.x) / camera.scale,
    y: (screenPoint.y - camera.origin.y) / camera.scale,
    z: 0,
  }
}

export function screenToModelOnWorkPlane(
  camera: Camera,
  screenPoint: Vec2,
  workPlane: WorkPlane,
): Vec3 {
  if (camera.mode === '2d') {
    return screenToModel2D(camera, screenPoint)
  }

  assertUsableScale(camera.scale)

  const basis = workPlaneToBasis(workPlane)
  const projectedOrigin = projectVec3ToCameraUnits(camera, basis.origin)
  const projectedTarget = subtractVec2(
    screenToCameraUnits(camera, screenPoint),
    projectedOrigin,
  )
  const solved = solveBasis2D(
    projectVec3ToCameraUnits(camera, basis.u),
    projectVec3ToCameraUnits(camera, basis.v),
    projectedTarget,
  )

  return pointOnWorkPlane(workPlane, solved.first, solved.second)
}

export function normalizePointForAmbientDimension(
  ambientDimension: AmbientDimension,
  point: Vec3,
): Vec3 {
  return ambientDimension === 2 ? { ...point, z: 0 } : { ...point }
}

function screenToCameraUnits(camera: Camera3D, screenPoint: Vec2): Vec2 {
  return {
    x: (screenPoint.x - camera.origin.x) / camera.scale,
    y: (screenPoint.y - camera.origin.y) / camera.scale,
  }
}

function projectVec3ToCameraUnits(camera: Camera3D, point: Vec3): Vec2 {
  return {
    x:
      point.x * camera.xVector[0] +
      point.y * camera.yVector[0] +
      point.z * camera.zVector[0],
    y:
      point.x * camera.xVector[1] +
      point.y * camera.yVector[1] +
      point.z * camera.zVector[1],
  }
}

function subtractVec2(point: Vec2, subtrahend: Vec2): Vec2 {
  return {
    x: point.x - subtrahend.x,
    y: point.y - subtrahend.y,
  }
}

function solveBasis2D(
  firstBasis: BasisVector2D,
  secondBasis: BasisVector2D,
  target: Vec2,
): { first: number; second: number } {
  const determinant =
    firstBasis.x * secondBasis.y - firstBasis.y * secondBasis.x

  if (determinant === 0) {
    throw new Error('Work plane basis projects to a degenerate screen plane.')
  }

  return {
    first: (target.x * secondBasis.y - target.y * secondBasis.x) / determinant,
    second: (firstBasis.x * target.y - firstBasis.y * target.x) / determinant,
  }
}

function assertUsableScale(scale: number): void {
  if (!Number.isFinite(scale) || scale === 0) {
    throw new Error('Camera scale must be a finite nonzero number.')
  }
}
