import { normalizePointForAmbientDimension } from './projection.ts'
import type {
  AmbientDimension,
  CubicBezierControlMode,
  CubicBezierPolarControl,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinate,
  WorkPlaneLocalOffset,
} from '../model/types.ts'

export type CubicBezierPointTuple = [Vec3, Vec3, Vec3, Vec3]

const frameEpsilon = 1e-9

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
    case 'workPlaneRelativeCartesian':
      if (
        ambientDimension !== 3 ||
        controlMode.secondOffsetReference !== 'end' ||
        !isValidWorkPlaneFrameSnapshot(controlMode.frame) ||
        !isValidWorkPlaneLocalOffset(controlMode.firstControlOffset) ||
        !isValidWorkPlaneLocalOffset(controlMode.secondControlOffset) ||
        !isValidWorkPlaneLocalCoordinate(controlMode.localStart) ||
        !isValidWorkPlaneLocalCoordinate(controlMode.localEnd)
      ) {
        return null
      }

      return [
        normalizedStart,
        addVec3(
          normalizedStart,
          workPlaneLocalOffsetToVec3(
            controlMode.frame,
            controlMode.firstControlOffset,
          ),
        ),
        addVec3(
          normalizedEnd,
          workPlaneLocalOffsetToVec3(
            controlMode.frame,
            controlMode.secondControlOffset,
          ),
        ),
        normalizedEnd,
      ]
    case 'workPlaneRelativePolar':
      if (
        ambientDimension !== 3 ||
        controlMode.secondOffsetReference !== 'end' ||
        !isValidWorkPlaneFrameSnapshot(controlMode.frame) ||
        !isValidPolarControl(controlMode.firstControl) ||
        !isValidPolarControl(controlMode.secondControl) ||
        !isValidWorkPlaneLocalCoordinate(controlMode.localStart) ||
        !isValidWorkPlaneLocalCoordinate(controlMode.localEnd)
      ) {
        return null
      }

      return [
        normalizedStart,
        addVec3(
          normalizedStart,
          workPlaneLocalPolarControlToOffset(
            controlMode.frame,
            controlMode.firstControl,
          ),
        ),
        addVec3(
          normalizedEnd,
          workPlaneLocalPolarControlToOffset(
            controlMode.frame,
            controlMode.secondControl,
          ),
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
    case 'workPlaneRelativeCartesian':
      return 'work-plane relative Cartesian'
    case 'workPlaneRelativePolar':
      return 'work-plane relative polar'
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

export function workPlaneLocalOffsetToVec3(
  frame: WorkPlaneFrameSnapshot,
  offset: WorkPlaneLocalOffset,
): Vec3 {
  return addVec3(scaleVec3(frame.u, offset.dx), scaleVec3(frame.v, offset.dy))
}

export function workPlaneLocalPolarControlToOffset(
  frame: WorkPlaneFrameSnapshot,
  control: CubicBezierPolarControl,
): Vec3 {
  const angleRadians = (control.angleDegrees * Math.PI) / 180

  return workPlaneLocalOffsetToVec3(frame, {
    dx: control.radius * Math.cos(angleRadians),
    dy: control.radius * Math.sin(angleRadians),
  })
}

export function pointFromWorkPlaneLocalCoordinate(
  frame: WorkPlaneFrameSnapshot,
  coordinate: WorkPlaneLocalCoordinate,
): Vec3 {
  return addVec3(
    frame.origin,
    addVec3(scaleVec3(frame.u, coordinate.a), scaleVec3(frame.v, coordinate.b)),
  )
}

export function workPlaneLocalCoordinateFromPoint(
  frame: WorkPlaneFrameSnapshot,
  point: Vec3,
): WorkPlaneLocalCoordinate {
  const relativePoint = subtractVec3(point, frame.origin)

  return {
    a: dotVec3(relativePoint, frame.u),
    b: dotVec3(relativePoint, frame.v),
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

export function isValidWorkPlaneLocalCoordinate(
  coordinate: WorkPlaneLocalCoordinate,
): boolean {
  return Number.isFinite(coordinate.a) && Number.isFinite(coordinate.b)
}

export function isValidWorkPlaneLocalOffset(
  offset: WorkPlaneLocalOffset,
): boolean {
  return Number.isFinite(offset.dx) && Number.isFinite(offset.dy)
}

export function isValidWorkPlaneFrameSnapshot(
  frame: WorkPlaneFrameSnapshot,
): boolean {
  if (
    !isFiniteVec3(frame.origin) ||
    !isFiniteVec3(frame.u) ||
    !isFiniteVec3(frame.v) ||
    !isFiniteVec3(frame.normal)
  ) {
    return false
  }

  return (
    approximatelyEqual(normVec3(frame.u), 1) &&
    approximatelyEqual(normVec3(frame.v), 1) &&
    approximatelyEqual(normVec3(frame.normal), 1) &&
    approximatelyEqual(dotVec3(frame.u, frame.v), 0) &&
    approximatelyEqual(dotVec3(frame.u, frame.normal), 0) &&
    approximatelyEqual(dotVec3(frame.v, frame.normal), 0) &&
    vectorsApproximatelyEqual(crossVec3(frame.u, frame.v), frame.normal)
  )
}

export function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function scaleVec3(vector: Vec3, scalar: number): Vec3 {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
    z: vector.z * scalar,
  }
}

function dotVec3(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function crossVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  }
}

function normVec3(vector: Vec3): number {
  return Math.sqrt(dotVec3(vector, vector))
}

function offsetToPolarControl(offset: Vec3): CubicBezierPolarControl {
  return {
    angleDegrees: (Math.atan2(offset.y, offset.x) * 180) / Math.PI,
    radius: Math.hypot(offset.x, offset.y),
  }
}

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= frameEpsilon
}

function vectorsApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  return (
    approximatelyEqual(first.x, second.x) &&
    approximatelyEqual(first.y, second.y) &&
    approximatelyEqual(first.z, second.z)
  )
}
