import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  Vec2,
  Vec3,
  WorkPlane,
} from '../model/types'

type BasisVector2D = [number, number]

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

  switch (workPlane.kind) {
    case 'xy':
      return screenToModelOnXyPlane(camera, screenPoint, workPlane.z)
    case 'xz':
      return screenToModelOnXzPlane(camera, screenPoint, workPlane.y)
    case 'yz':
      return screenToModelOnYzPlane(camera, screenPoint, workPlane.x)
  }
}

export function normalizePointForAmbientDimension(
  ambientDimension: AmbientDimension,
  point: Vec3,
): Vec3 {
  return ambientDimension === 2 ? { ...point, z: 0 } : { ...point }
}

function screenToModelOnXyPlane(
  camera: Camera3D,
  screenPoint: Vec2,
  z: number,
): Vec3 {
  const projected = subtractFixedCoordinate(
    screenToCameraUnits(camera, screenPoint),
    camera.zVector,
    z,
  )
  const solved = solveBasis2D(camera.xVector, camera.yVector, projected)

  return { x: solved.first, y: solved.second, z }
}

function screenToModelOnXzPlane(
  camera: Camera3D,
  screenPoint: Vec2,
  y: number,
): Vec3 {
  const projected = subtractFixedCoordinate(
    screenToCameraUnits(camera, screenPoint),
    camera.yVector,
    y,
  )
  const solved = solveBasis2D(camera.xVector, camera.zVector, projected)

  return { x: solved.first, y, z: solved.second }
}

function screenToModelOnYzPlane(
  camera: Camera3D,
  screenPoint: Vec2,
  x: number,
): Vec3 {
  const projected = subtractFixedCoordinate(
    screenToCameraUnits(camera, screenPoint),
    camera.xVector,
    x,
  )
  const solved = solveBasis2D(camera.yVector, camera.zVector, projected)

  return { x, y: solved.first, z: solved.second }
}

function screenToCameraUnits(camera: Camera3D, screenPoint: Vec2): Vec2 {
  return {
    x: (screenPoint.x - camera.origin.x) / camera.scale,
    y: (screenPoint.y - camera.origin.y) / camera.scale,
  }
}

function subtractFixedCoordinate(
  point: Vec2,
  basisVector: BasisVector2D,
  coordinate: number,
): Vec2 {
  return {
    x: point.x - coordinate * basisVector[0],
    y: point.y - coordinate * basisVector[1],
  }
}

function solveBasis2D(
  firstBasis: BasisVector2D,
  secondBasis: BasisVector2D,
  target: Vec2,
): { first: number; second: number } {
  const determinant =
    firstBasis[0] * secondBasis[1] - firstBasis[1] * secondBasis[0]

  if (determinant === 0) {
    throw new Error('Work plane basis projects to a degenerate screen plane.')
  }

  return {
    first: (target.x * secondBasis[1] - target.y * secondBasis[0]) / determinant,
    second: (firstBasis[0] * target.y - firstBasis[1] * target.x) / determinant,
  }
}

function assertUsableScale(scale: number): void {
  if (!Number.isFinite(scale) || scale === 0) {
    throw new Error('Camera scale must be a finite nonzero number.')
  }
}
