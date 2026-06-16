import type { Vec3, WorkPlane } from '../model/types.ts'
import {
  dot,
  isFiniteVec3,
  isLegacyAxisAlignedWorkPlane,
  subtractVec3,
  validateWorkPlane,
  workPlaneToBasis,
} from '../geometry/workPlane.ts'

export type SheetPolygonDraft = {
  points: Vec3[]
  workPlane: WorkPlane
}

const workPlaneTolerance = 1e-9

export function createSheetPolygonDraft(
  firstPoint: Vec3,
  workPlane: WorkPlane,
): SheetPolygonDraft {
  return {
    points: [firstPoint],
    workPlane: cloneWorkPlane(workPlane),
  }
}

export function appendSheetPolygonDraftPoint(
  draft: SheetPolygonDraft,
  point: Vec3,
): SheetPolygonDraft {
  return {
    ...draft,
    points: [...draft.points, point],
  }
}

export function sheetDraftBlocksWorkPlaneChange(
  draft: SheetPolygonDraft | null,
): boolean {
  return draft !== null
}

export function areFinitePoints(points: readonly Vec3[]): boolean {
  return points.every(isFinitePoint)
}

export function isFinitePoint(point: Vec3): boolean {
  return isFiniteVec3(point)
}

export function arePointsOnWorkPlane(
  points: readonly Vec3[],
  workPlane: WorkPlane,
  tolerance = workPlaneTolerance,
): boolean {
  return points.every((point) => isPointOnWorkPlane(point, workPlane, tolerance))
}

export function isPointOnWorkPlane(
  point: Vec3,
  workPlane: WorkPlane,
  tolerance = workPlaneTolerance,
): boolean {
  if (!isFinitePoint(point) || !isFiniteWorkPlane(workPlane)) {
    return false
  }

  const basis = workPlaneToBasis(workPlane)
  const signedDistance = Math.abs(dot(subtractVec3(point, basis.origin), basis.normal))

  return signedDistance <= tolerance
}

function cloneWorkPlane(workPlane: WorkPlane): WorkPlane {
  if (isLegacyAxisAlignedWorkPlane(workPlane)) {
    switch (workPlane.kind) {
      case 'xy':
        return { kind: 'xy', z: workPlane.z }
      case 'xz':
        return { kind: 'xz', y: workPlane.y }
      case 'yz':
        return { kind: 'yz', x: workPlane.x }
    }
  }

  if (workPlane.kind === 'axisAligned') {
    return { ...workPlane }
  }

  return {
    ...workPlane,
    origin: { ...workPlane.origin },
    u: { ...workPlane.u },
    v: { ...workPlane.v },
    normal: { ...workPlane.normal },
    source:
      workPlane.source.kind === 'existingPointStrata'
        ? {
            kind: 'existingPointStrata',
            pointIds: [
              workPlane.source.pointIds[0],
              workPlane.source.pointIds[1],
              workPlane.source.pointIds[2],
            ],
          }
        : { ...workPlane.source },
  }
}

function isFiniteWorkPlane(workPlane: WorkPlane): boolean {
  return validateWorkPlane(workPlane).valid
}
