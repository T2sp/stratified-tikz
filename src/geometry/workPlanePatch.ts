import type { Vec3, WorkPlane } from '../model/types'
import {
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
// from diagram data and TikZ export.
export function createWorkPlanePatch(
  workPlane: WorkPlane,
  options: WorkPlanePatchOptions = {},
): WorkPlanePatch {
  const halfSize = (options.size ?? DEFAULT_WORK_PLANE_PATCH_SIZE) / 2
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

  return {
    corners: cornerCoordinates.map(([a, b]) =>
      addBasisOffset(basis.origin, a, basis.u, b, basis.v),
    ) as [Vec3, Vec3, Vec3, Vec3],
  }
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
