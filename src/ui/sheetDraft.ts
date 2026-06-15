import type { Vec3, WorkPlane } from '../model/types.ts'

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
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
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

  switch (workPlane.kind) {
    case 'xy':
      return Math.abs(point.z - workPlane.z) <= tolerance
    case 'xz':
      return Math.abs(point.y - workPlane.y) <= tolerance
    case 'yz':
      return Math.abs(point.x - workPlane.x) <= tolerance
  }
}

function cloneWorkPlane(workPlane: WorkPlane): WorkPlane {
  switch (workPlane.kind) {
    case 'xy':
      return { kind: 'xy', z: workPlane.z }
    case 'xz':
      return { kind: 'xz', y: workPlane.y }
    case 'yz':
      return { kind: 'yz', x: workPlane.x }
  }
}

function isFiniteWorkPlane(workPlane: WorkPlane): boolean {
  switch (workPlane.kind) {
    case 'xy':
      return Number.isFinite(workPlane.z)
    case 'xz':
      return Number.isFinite(workPlane.y)
    case 'yz':
      return Number.isFinite(workPlane.x)
  }
}
