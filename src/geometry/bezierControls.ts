import type {
  AmbientDimension,
  CurveStratum,
  Vec3,
  WorkPlane,
} from '../model/types'

export type CubicBezierControlPointIndex = 1 | 2

export type PlaneCoordinateLabels = {
  u: 'x' | 'y'
  v: 'y' | 'z'
}

export type RelativeCartesianControl = {
  u: number
  v: number
}

export type RelativePolarControl = {
  angleDegrees: number
  radius: number
}

export function isEditableCubicBezierCurve(curve: CurveStratum): boolean {
  return curve.kind === 'cubicBezier' && curve.points.length === 4
}

export function planeCoordinateLabels(
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): PlaneCoordinateLabels {
  if (ambientDimension === 2) {
    return { u: 'x', v: 'y' }
  }

  switch (workPlane.kind) {
    case 'xy':
      return { u: 'x', v: 'y' }
    case 'xz':
      return { u: 'x', v: 'z' }
    case 'yz':
      return { u: 'y', v: 'z' }
  }
}

export function cubicBezierControlAnchor(
  points: readonly Vec3[],
  controlIndex: CubicBezierControlPointIndex,
): Vec3 | null {
  if (points.length !== 4) {
    return null
  }

  return controlIndex === 1 ? points[0] : points[3]
}

export function cubicBezierControlToRelativeCartesian(
  points: readonly Vec3[],
  controlIndex: CubicBezierControlPointIndex,
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): RelativeCartesianControl | null {
  const anchor = cubicBezierControlAnchor(points, controlIndex)
  const control = points[controlIndex]

  if (anchor === null || control === undefined) {
    return null
  }

  const labels = planeCoordinateLabels(ambientDimension, workPlane)

  return {
    u: control[labels.u] - anchor[labels.u],
    v: control[labels.v] - anchor[labels.v],
  }
}

export function cubicBezierControlToRelativePolar(
  points: readonly Vec3[],
  controlIndex: CubicBezierControlPointIndex,
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): RelativePolarControl | null {
  const relative = cubicBezierControlToRelativeCartesian(
    points,
    controlIndex,
    ambientDimension,
    workPlane,
  )

  if (relative === null) {
    return null
  }

  return relativeCartesianToPolar(relative)
}

export function updateCubicBezierControlFromRelativeCartesian(
  points: readonly Vec3[],
  controlIndex: CubicBezierControlPointIndex,
  relative: RelativeCartesianControl,
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): Vec3[] {
  const anchor = cubicBezierControlAnchor(points, controlIndex)

  if (anchor === null) {
    return [...points]
  }

  const labels = planeCoordinateLabels(ambientDimension, workPlane)
  const control = { ...points[controlIndex] }
  control[labels.u] = anchor[labels.u] + relative.u
  control[labels.v] = anchor[labels.v] + relative.v

  if (ambientDimension === 2) {
    control.z = 0
  }

  return points.map((point, index) =>
    index === controlIndex ? control : { ...point },
  )
}

export function updateCubicBezierControlFromRelativePolar(
  points: readonly Vec3[],
  controlIndex: CubicBezierControlPointIndex,
  relative: RelativePolarControl,
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): Vec3[] {
  return updateCubicBezierControlFromRelativeCartesian(
    points,
    controlIndex,
    polarToRelativeCartesian(relative),
    ambientDimension,
    workPlane,
  )
}

export function relativeCartesianToPolar(
  relative: RelativeCartesianControl,
): RelativePolarControl {
  return {
    angleDegrees: normalizeSignedZero(
      (Math.atan2(relative.v, relative.u) * 180) / Math.PI,
    ),
    radius: normalizeSignedZero(Math.hypot(relative.u, relative.v)),
  }
}

export function polarToRelativeCartesian(
  relative: RelativePolarControl,
): RelativeCartesianControl {
  const angleRadians = (relative.angleDegrees * Math.PI) / 180
  const radius = Math.max(0, relative.radius)

  return {
    u: normalizeSignedZero(radius * Math.cos(angleRadians)),
    v: normalizeSignedZero(radius * Math.sin(angleRadians)),
  }
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}
