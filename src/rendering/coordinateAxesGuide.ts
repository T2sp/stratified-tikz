import type { AmbientDimension, Vec3 } from '../model/types'

export type CoordinateAxisName = 'x' | 'y' | 'z'

export type CoordinateAxisGuide = {
  axis: CoordinateAxisName
  label: CoordinateAxisName
  from: Vec3
  to: Vec3
  labelPosition: Vec3
}

export type CoordinateAxesGuide = {
  axes: CoordinateAxisGuide[]
  fitPoints: Vec3[]
  pointerEvents: 'none'
  selectable: false
}

export const defaultCoordinateAxesGuideLength = 2.5
const labelOffset = 0.25

export function createCoordinateAxesGuide(
  ambientDimension: AmbientDimension,
  length = defaultCoordinateAxesGuideLength,
): CoordinateAxesGuide | null {
  if (ambientDimension !== 3) {
    return null
  }

  const origin = createVec3(0, 0, 0)
  const axes: CoordinateAxisGuide[] = [
    createAxisGuide('x', origin, createVec3(length, 0, 0), labelOffset),
    createAxisGuide('y', origin, createVec3(0, length, 0), labelOffset),
    createAxisGuide('z', origin, createVec3(0, 0, length), labelOffset),
  ]

  return {
    axes,
    fitPoints: axes.flatMap((axis) => [axis.from, axis.to, axis.labelPosition]),
    pointerEvents: 'none',
    selectable: false,
  }
}

function createAxisGuide(
  axis: CoordinateAxisName,
  from: Vec3,
  to: Vec3,
  offset: number,
): CoordinateAxisGuide {
  const direction = normalizeVec3(subtractVec3(to, from))
  const labelPosition = addVec3(to, scaleVec3(direction, offset))

  return {
    axis,
    label: axis,
    from,
    to,
    labelPosition,
  }
}

function createVec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

function subtractVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  }
}

function scaleVec3(point: Vec3, scale: number): Vec3 {
  return {
    x: point.x * scale,
    y: point.y * scale,
    z: point.z * scale,
  }
}

function normalizeVec3(point: Vec3): Vec3 {
  const length = Math.hypot(point.x, point.y, point.z)

  if (length === 0) {
    return createVec3(0, 0, 0)
  }

  return scaleVec3(point, 1 / length)
}
