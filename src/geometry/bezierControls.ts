import { normalizePointForAmbientDimension } from './projection.ts'
import type {
  AmbientDimension,
  CubicBezierControlMode,
  CubicBezierPolarControl,
  Vec3,
} from '../model/types.ts'

export type CubicBezierPointTuple = [Vec3, Vec3, Vec3, Vec3]

export function absoluteCubicBezierPointsFromControlMode(
  ambientDimension: AmbientDimension,
  start: Vec3,
  end: Vec3,
  controlMode: CubicBezierControlMode,
): CubicBezierPointTuple | null {
  const normalizedStart = normalizePointForAmbientDimension(
    ambientDimension,
    start,
  )
  const normalizedEnd = normalizePointForAmbientDimension(ambientDimension, end)

  switch (controlMode.kind) {
    case 'absolute':
      return null
    case 'relativeCartesian':
      if (
        controlMode.secondOffsetReference !== 'end' ||
        !isFiniteVec3(controlMode.firstControlOffset) ||
        !isFiniteVec3(controlMode.secondControlOffset)
      ) {
        return null
      }

      return [
        normalizedStart,
        normalizePointForAmbientDimension(
          ambientDimension,
          addVec3(normalizedStart, controlMode.firstControlOffset),
        ),
        normalizePointForAmbientDimension(
          ambientDimension,
          addVec3(normalizedEnd, controlMode.secondControlOffset),
        ),
        normalizedEnd,
      ]
    case 'relativePolar':
      if (
        ambientDimension !== 2 ||
        controlMode.secondOffsetReference !== 'end' ||
        !isValidPolarControl(controlMode.firstControl) ||
        !isValidPolarControl(controlMode.secondControl)
      ) {
        return null
      }

      return [
        normalizedStart,
        normalizePointForAmbientDimension(
          ambientDimension,
          addVec3(normalizedStart, polarControlToOffset(controlMode.firstControl)),
        ),
        normalizePointForAmbientDimension(
          ambientDimension,
          addVec3(normalizedEnd, polarControlToOffset(controlMode.secondControl)),
        ),
        normalizedEnd,
      ]
  }
}

export function relativeCartesianControlModeFromPoints(
  ambientDimension: AmbientDimension,
  points: readonly Vec3[],
): CubicBezierControlMode | null {
  if (points.length !== 4 || !points.every(isFiniteVec3)) {
    return null
  }

  const start = normalizePointForAmbientDimension(ambientDimension, points[0])
  const firstControl = normalizePointForAmbientDimension(
    ambientDimension,
    points[1],
  )
  const secondControl = normalizePointForAmbientDimension(
    ambientDimension,
    points[2],
  )
  const end = normalizePointForAmbientDimension(ambientDimension, points[3])

  return {
    kind: 'relativeCartesian',
    firstControlOffset: normalizePointForAmbientDimension(
      ambientDimension,
      subtractVec3(firstControl, start),
    ),
    secondControlOffset: normalizePointForAmbientDimension(
      ambientDimension,
      subtractVec3(secondControl, end),
    ),
    secondOffsetReference: 'end',
  }
}

export function relativePolarControlModeFromPoints(
  ambientDimension: AmbientDimension,
  points: readonly Vec3[],
): CubicBezierControlMode | null {
  if (ambientDimension !== 2 || points.length !== 4 || !points.every(isFiniteVec3)) {
    return null
  }

  const firstOffset = subtractVec3(points[1], points[0])
  const secondOffset = subtractVec3(points[2], points[3])

  return {
    kind: 'relativePolar',
    firstControl: offsetToPolarControl(firstOffset),
    secondControl: offsetToPolarControl(secondOffset),
    secondOffsetReference: 'end',
  }
}

export function cubicBezierControlModeLabel(
  controlMode: CubicBezierControlMode | undefined,
): string {
  switch (controlMode?.kind ?? 'absolute') {
    case 'absolute':
      return 'absolute'
    case 'relativeCartesian':
      return 'relative Cartesian'
    case 'relativePolar':
      return 'relative polar'
  }
}

export function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

export function subtractVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  }
}

export function polarControlToOffset(control: CubicBezierPolarControl): Vec3 {
  const angleRadians = (control.angleDegrees * Math.PI) / 180

  return {
    x: control.radius * Math.cos(angleRadians),
    y: control.radius * Math.sin(angleRadians),
    z: 0,
  }
}

export function isValidPolarControl(
  control: CubicBezierPolarControl,
): boolean {
  return (
    Number.isFinite(control.angleDegrees) &&
    Number.isFinite(control.radius) &&
    control.radius >= 0
  )
}

export function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function offsetToPolarControl(offset: Vec3): CubicBezierPolarControl {
  return {
    angleDegrees: (Math.atan2(offset.y, offset.x) * 180) / Math.PI,
    radius: Math.hypot(offset.x, offset.y),
  }
}
