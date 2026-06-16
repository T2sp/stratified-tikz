import type { Vec3, WorkPlane } from '../model/types'
import {
  isFiniteVec3,
  projectPointToWorkPlaneCoordinates,
  workPlaneToBasis,
} from './workPlane.ts'

export type WorkPlanePatch = {
  corners: [Vec3, Vec3, Vec3, Vec3]
}

export type WorkPlanePatchOptions = {
  center?: Vec3
  size?: number
}

export const DEFAULT_WORK_PLANE_PATCH_SIZE = 4

// Work-plane previews are derived from editor state and must stay independent
// from diagram data and TikZ export. Size must be finite and positive; successful
// calls guarantee finite patch corners.
export function createWorkPlanePatch(
  workPlane: WorkPlane,
  options: WorkPlanePatchOptions = {},
): WorkPlanePatch {
  const size = assertFinitePositiveSize(
    options.size ?? DEFAULT_WORK_PLANE_PATCH_SIZE,
  )
  const halfSize = size / 2
  const basis = workPlaneToBasis(workPlane)
  const centerCoordinates =
    options.center === undefined
      ? { a: 0, b: 0 }
      : projectPointToWorkPlaneCoordinates(options.center, workPlane)
  const cornerCoordinates: [number, number][] = [
    [centerCoordinates.a - halfSize, centerCoordinates.b - halfSize],
    [centerCoordinates.a + halfSize, centerCoordinates.b - halfSize],
    [centerCoordinates.a + halfSize, centerCoordinates.b + halfSize],
    [centerCoordinates.a - halfSize, centerCoordinates.b + halfSize],
  ]
  const corners = cornerCoordinates.map(([a, b]) =>
    addBasisOffset(basis.origin, a, basis.u, b, basis.v),
  ) as [Vec3, Vec3, Vec3, Vec3]

  if (!corners.every(isFiniteVec3)) {
    throw new Error('Work-plane patch produced non-finite corners.')
  }

  return {
    corners,
  }
}

function assertFinitePositiveSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Work-plane patch size must be a finite positive number.')
  }

  return size
}

function addBasisOffset(
  origin: Vec3,
  a: number,
  u: Vec3,
  b: number,
  v: Vec3,
): Vec3 {
  return {
    x: origin.x + a * u.x + b * v.x,
    y: origin.y + a * u.y + b * v.y,
    z: origin.z + a * u.z + b * v.z,
  }
}
