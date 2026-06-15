import type { Vec3, WorkPlane } from '../model/types'

export type WorkPlanePatch = {
  corners: [Vec3, Vec3, Vec3, Vec3]
}

export type WorkPlanePatchOptions = {
  center?: Vec3
  size?: number
}

export const DEFAULT_WORK_PLANE_PATCH_SIZE = 4

// TODO: Future custom work planes can extend this helper with user-configurable
// centers, sizes, and non-axis-aligned bases.
export function createWorkPlanePatch(
  workPlane: WorkPlane,
  options: WorkPlanePatchOptions = {},
): WorkPlanePatch {
  const center = options.center ?? { x: 0, y: 0, z: 0 }
  const halfSize = (options.size ?? DEFAULT_WORK_PLANE_PATCH_SIZE) / 2

  switch (workPlane.kind) {
    case 'xy':
      return {
        corners: [
          { x: center.x - halfSize, y: center.y - halfSize, z: workPlane.z },
          { x: center.x + halfSize, y: center.y - halfSize, z: workPlane.z },
          { x: center.x + halfSize, y: center.y + halfSize, z: workPlane.z },
          { x: center.x - halfSize, y: center.y + halfSize, z: workPlane.z },
        ],
      }
    case 'xz':
      return {
        corners: [
          { x: center.x - halfSize, y: workPlane.y, z: center.z - halfSize },
          { x: center.x + halfSize, y: workPlane.y, z: center.z - halfSize },
          { x: center.x + halfSize, y: workPlane.y, z: center.z + halfSize },
          { x: center.x - halfSize, y: workPlane.y, z: center.z + halfSize },
        ],
      }
    case 'yz':
      return {
        corners: [
          { x: workPlane.x, y: center.y - halfSize, z: center.z - halfSize },
          { x: workPlane.x, y: center.y + halfSize, z: center.z - halfSize },
          { x: workPlane.x, y: center.y + halfSize, z: center.z + halfSize },
          { x: workPlane.x, y: center.y - halfSize, z: center.z + halfSize },
        ],
      }
  }
}
