import type { Vec3, WorkPlane } from '../model/types.ts'
import {
  coonsPatchBoundaryRoles,
  type CoonsPatchBoundaryPathIds,
  type CoonsPatchBoundaryPathSelections,
  type CoonsPatchBoundaryRole,
  type PickedCoonsBoundary,
} from './ruledSurface.ts'
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

export type RuledSurfaceBoundaryRole = 'boundary0' | 'boundary1'

export type RuledSurfaceBoundaryDraft = {
  kind: 'ruledSurface'
  boundary0Id?: string
  boundary1Id?: string
  nextRole: RuledSurfaceBoundaryRole
}

export type CoonsPatchBoundaryDraft = {
  kind: 'coonsPatch'
  bottom?: PickedCoonsBoundary
  right?: PickedCoonsBoundary
  top?: PickedCoonsBoundary
  left?: PickedCoonsBoundary
  nextRole: CoonsPatchBoundaryRole
}

export type BoundarySurfaceDraftPickError =
  | 'emptyPathId'
  | 'emptyPointId'
  | 'duplicatePath'
  | 'completeDraft'

export type RuledSurfaceBoundaryDraftPickResult =
  | {
      ok: true
      draft: RuledSurfaceBoundaryDraft
      role: RuledSurfaceBoundaryRole
    }
  | {
      ok: false
      draft: RuledSurfaceBoundaryDraft
      error: BoundarySurfaceDraftPickError
    }

export type CoonsPatchBoundaryDraftPickResult =
  | {
      ok: true
      draft: CoonsPatchBoundaryDraft
      role: CoonsPatchBoundaryRole
    }
  | {
      ok: false
      draft: CoonsPatchBoundaryDraft
      error: BoundarySurfaceDraftPickError
    }

export type BoundarySurfacePathClickTool = 'select' | 'createSheet' | 'other'
export type BoundarySurfacePathClickSheetKind =
  | 'ruledSurface'
  | 'coonsPatch'
  | 'other'
export type BoundarySurfacePathClickWorkflow =
  | 'select'
  | 'ruledSurface'
  | 'coonsPatch'
  | null

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

export function createRuledSurfaceBoundaryDraft(): RuledSurfaceBoundaryDraft {
  return {
    kind: 'ruledSurface',
    nextRole: 'boundary0',
  }
}

export function createCoonsPatchBoundaryDraft(): CoonsPatchBoundaryDraft {
  return {
    kind: 'coonsPatch',
    nextRole: 'bottom',
  }
}

export function resetRuledSurfaceBoundaryDraft(): RuledSurfaceBoundaryDraft {
  return createRuledSurfaceBoundaryDraft()
}

export function resetCoonsPatchBoundaryDraft(): CoonsPatchBoundaryDraft {
  return createCoonsPatchBoundaryDraft()
}

export function ruledSurfaceBoundaryDraftCanCreate(
  draft: RuledSurfaceBoundaryDraft,
): boolean {
  return (
    normalizePickedPathId(draft.boundary0Id) !== null &&
    normalizePickedPathId(draft.boundary1Id) !== null
  )
}

export function coonsPatchBoundaryDraftCanCreate(
  draft: CoonsPatchBoundaryDraft,
): boolean {
  return coonsPatchBoundaryRoles.every(
    (role) => coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role) !== null,
  )
}

export function ruledSurfaceBoundaryDraftPickedPathIds(
  draft: RuledSurfaceBoundaryDraft,
): string[] {
  const boundary0Id = normalizePickedPathId(draft.boundary0Id)
  const boundary1Id = normalizePickedPathId(draft.boundary1Id)

  return [
    ...(boundary0Id === null ? [] : [boundary0Id]),
    ...(boundary1Id === null ? [] : [boundary1Id]),
  ]
}

export function coonsPatchBoundaryDraftPickedPathIds(
  draft: CoonsPatchBoundaryDraft,
): string[] {
  return coonsPatchBoundaryRoles.flatMap((role) => {
    const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role)

    return picked === null || picked.kind === 'point' ? [] : [picked.sourcePathId]
  })
}

export function coonsPatchBoundaryDraftPickedSourceIds(
  draft: CoonsPatchBoundaryDraft,
): string[] {
  return coonsPatchBoundaryRoles.flatMap((role) => {
    const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role)

    if (picked === null) {
      return []
    }

    return picked.kind === 'point'
      ? [picked.sourcePointId]
      : [picked.sourcePathId]
  })
}

export function ruledSurfaceBoundaryPathIdsFromDraft(
  draft: RuledSurfaceBoundaryDraft,
): string[] {
  return ruledSurfaceBoundaryDraftPickedPathIds(draft)
}

export function coonsPatchBoundaryPathIdsFromDraft(
  draft: CoonsPatchBoundaryDraft,
): CoonsPatchBoundaryPathIds {
  const sourcePathIds: CoonsPatchBoundaryPathIds = {}

  coonsPatchBoundaryRoles.forEach((role) => {
    const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role)

    if (picked !== null) {
      if (picked.kind !== 'point') {
        sourcePathIds[role] = picked.sourcePathId
      }
    }
  })

  return sourcePathIds
}

export function coonsPatchBoundarySelectionsFromDraft(
  draft: CoonsPatchBoundaryDraft,
): CoonsPatchBoundaryPathSelections {
  const sourcePathIds: CoonsPatchBoundaryPathSelections = {}

  coonsPatchBoundaryRoles.forEach((role) => {
    const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role)

    if (picked !== null) {
      sourcePathIds[role] = picked
    }
  })

  return sourcePathIds
}

export function pickRuledSurfaceBoundaryDraftPath(
  draft: RuledSurfaceBoundaryDraft,
  sourcePathId: string,
): RuledSurfaceBoundaryDraftPickResult {
  const pathId = normalizePickedPathId(sourcePathId)

  if (pathId === null) {
    return {
      ok: false,
      draft,
      error: 'emptyPathId',
    }
  }

  if (ruledSurfaceBoundaryDraftCanCreate(draft)) {
    return {
      ok: false,
      draft,
      error: 'completeDraft',
    }
  }

  if (ruledSurfaceBoundaryDraftPickedPathIds(draft).includes(pathId)) {
    return {
      ok: false,
      draft,
      error: 'duplicatePath',
    }
  }

  if (draft.nextRole === 'boundary0') {
    return {
      ok: true,
      role: 'boundary0',
      draft: {
        ...draft,
        boundary0Id: pathId,
        nextRole: 'boundary1',
      },
    }
  }

  return {
    ok: true,
    role: 'boundary1',
    draft: {
      ...draft,
      boundary1Id: pathId,
      nextRole: 'boundary1',
    },
  }
}

export function pickCoonsPatchBoundaryDraftPath(
  draft: CoonsPatchBoundaryDraft,
  sourcePathId: string,
): CoonsPatchBoundaryDraftPickResult {
  const pathId = normalizePickedPathId(sourcePathId)

  if (pathId === null) {
    return {
      ok: false,
      draft,
      error: 'emptyPathId',
    }
  }

  if (coonsPatchBoundaryDraftCanCreate(draft)) {
    return {
      ok: false,
      draft,
      error: 'completeDraft',
    }
  }

  if (coonsPatchBoundaryDraftPickedPathIds(draft).includes(pathId)) {
    return {
      ok: false,
      draft,
      error: 'duplicatePath',
    }
  }

  const role = draft.nextRole

  return {
    ok: true,
    role,
    draft: {
      ...setCoonsPatchBoundaryDraftPickedBoundary(draft, role, {
        sourcePathId: pathId,
        reversed: false,
      }),
      nextRole: nextCoonsPatchBoundaryRole(role),
    },
  }
}

export function pickCoonsPatchBoundaryDraftPoint(
  draft: CoonsPatchBoundaryDraft,
  sourcePointId: string,
): CoonsPatchBoundaryDraftPickResult {
  const pointId = normalizePickedPathId(sourcePointId)

  if (pointId === null) {
    return {
      ok: false,
      draft,
      error: 'emptyPointId',
    }
  }

  if (coonsPatchBoundaryDraftCanCreate(draft)) {
    return {
      ok: false,
      draft,
      error: 'completeDraft',
    }
  }

  const role = draft.nextRole

  return {
    ok: true,
    role,
    draft: {
      ...setCoonsPatchBoundaryDraftPickedBoundary(draft, role, {
        kind: 'point',
        sourcePointId: pointId,
      }),
      nextRole: nextCoonsPatchBoundaryRole(role),
    },
  }
}

export function undoRuledSurfaceBoundaryDraftPick(
  draft: RuledSurfaceBoundaryDraft,
): RuledSurfaceBoundaryDraft {
  if (normalizePickedPathId(draft.boundary1Id) !== null) {
    return {
      ...draft,
      boundary1Id: undefined,
      nextRole: 'boundary1',
    }
  }

  if (normalizePickedPathId(draft.boundary0Id) !== null) {
    return {
      ...draft,
      boundary0Id: undefined,
      nextRole: 'boundary0',
    }
  }

  return draft
}

export function undoCoonsPatchBoundaryDraftPick(
  draft: CoonsPatchBoundaryDraft,
): CoonsPatchBoundaryDraft {
  const lastPickedRole = [...coonsPatchBoundaryRoles]
    .reverse()
    .find(
      (role) => coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role) !== null,
    )

  if (lastPickedRole === undefined) {
    return draft
  }

  return {
    ...clearCoonsPatchBoundaryDraftPickedBoundary(draft, lastPickedRole),
    nextRole: lastPickedRole,
  }
}

export function toggleCoonsPatchBoundaryDraftReverse(
  draft: CoonsPatchBoundaryDraft,
  role: CoonsPatchBoundaryRole,
): CoonsPatchBoundaryDraft {
  const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role)

  if (picked === null) {
    return draft
  }

  if (picked.kind === 'point') {
    return draft
  }

  return setCoonsPatchBoundaryDraftPickedBoundary(draft, role, {
    sourcePathId: picked.sourcePathId,
    reversed: !picked.reversed,
  })
}

export function ruledSurfaceBoundaryDraftStatusMessage(
  draft: RuledSurfaceBoundaryDraft,
): string {
  const pickedCount = ruledSurfaceBoundaryDraftPickedPathIds(draft).length

  if (pickedCount === 0) {
    return 'Pick first boundary path.'
  }

  if (ruledSurfaceBoundaryDraftCanCreate(draft)) {
    return 'Ruled surface: picked 2/2. Create is enabled.'
  }

  return `Ruled surface: picked ${pickedCount}/2. Next: ${ruledSurfaceBoundaryRoleLabel(
    draft.nextRole,
  )}.`
}

export function coonsPatchBoundaryDraftStatusMessage(
  draft: CoonsPatchBoundaryDraft,
): string {
  const pickedCount = coonsPatchBoundaryDraftPickedSourceIds(draft).length

  if (pickedCount === 0) {
    return 'Pick bottom boundary path or point.'
  }

  if (coonsPatchBoundaryDraftCanCreate(draft)) {
    return 'Coons patch: picked 4/4. Create is enabled.'
  }

  return `Coons patch: picked ${pickedCount}/4. Next: ${draft.nextRole}.`
}

export function boundarySurfaceDraftPickErrorMessage(
  error: BoundarySurfaceDraftPickError,
): string {
  switch (error) {
    case 'emptyPathId':
      return 'Clicked path is unavailable.'
    case 'emptyPointId':
      return 'Clicked point is unavailable.'
    case 'duplicatePath':
      return 'Boundary path already picked.'
    case 'completeDraft':
      return 'All Coons boundaries are already picked. Create or reset before choosing another boundary.'
  }
}

export function boundarySurfacePathClickWorkflow(options: {
  tool: BoundarySurfacePathClickTool
  sheetCreationKind: BoundarySurfacePathClickSheetKind
  workPlanePointPickingActive: boolean
}): BoundarySurfacePathClickWorkflow {
  if (options.workPlanePointPickingActive) {
    return null
  }

  if (options.tool === 'select') {
    return 'select'
  }

  if (options.tool !== 'createSheet') {
    return null
  }

  if (options.sheetCreationKind === 'ruledSurface') {
    return 'ruledSurface'
  }

  if (options.sheetCreationKind === 'coonsPatch') {
    return 'coonsPatch'
  }

  return null
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

function normalizePickedPathId(sourcePathId: string | undefined): string | null {
  if (sourcePathId === undefined) {
    return null
  }

  const trimmed = sourcePathId.trim()

  return trimmed.length === 0 ? null : trimmed
}

function ruledSurfaceBoundaryRoleLabel(role: RuledSurfaceBoundaryRole): string {
  switch (role) {
    case 'boundary0':
      return 'first boundary'
    case 'boundary1':
      return 'second boundary'
  }
}

export function coonsPatchBoundaryDraftPickedBoundaryForRole(
  draft: CoonsPatchBoundaryDraft,
  role: CoonsPatchBoundaryRole,
): PickedCoonsBoundary | null {
  switch (role) {
    case 'bottom':
      return normalizePickedCoonsBoundary(draft.bottom)
    case 'right':
      return normalizePickedCoonsBoundary(draft.right)
    case 'top':
      return normalizePickedCoonsBoundary(draft.top)
    case 'left':
      return normalizePickedCoonsBoundary(draft.left)
  }
}

function setCoonsPatchBoundaryDraftPickedBoundary(
  draft: CoonsPatchBoundaryDraft,
  role: CoonsPatchBoundaryRole,
  picked: PickedCoonsBoundary,
): CoonsPatchBoundaryDraft {
  switch (role) {
    case 'bottom':
      return { ...draft, bottom: picked }
    case 'right':
      return { ...draft, right: picked }
    case 'top':
      return { ...draft, top: picked }
    case 'left':
      return { ...draft, left: picked }
  }
}

function clearCoonsPatchBoundaryDraftPickedBoundary(
  draft: CoonsPatchBoundaryDraft,
  role: CoonsPatchBoundaryRole,
): CoonsPatchBoundaryDraft {
  switch (role) {
    case 'bottom':
      return { ...draft, bottom: undefined }
    case 'right':
      return { ...draft, right: undefined }
    case 'top':
      return { ...draft, top: undefined }
    case 'left':
      return { ...draft, left: undefined }
  }
}

function normalizePickedCoonsBoundary(
  picked: PickedCoonsBoundary | undefined,
): PickedCoonsBoundary | null {
  if (picked === undefined) {
    return null
  }

  if (picked.kind === 'point') {
    const sourcePointId = normalizePickedPathId(picked.sourcePointId)

    return sourcePointId === null
      ? null
      : { kind: 'point', sourcePointId }
  }

  const sourcePathId = normalizePickedPathId(picked.sourcePathId)

  return sourcePathId === null
    ? null
    : { sourcePathId, reversed: picked.reversed ?? false }
}

function nextCoonsPatchBoundaryRole(
  role: CoonsPatchBoundaryRole,
): CoonsPatchBoundaryRole {
  const currentIndex = coonsPatchBoundaryRoles.indexOf(role)
  const nextRole = coonsPatchBoundaryRoles[currentIndex + 1]

  return nextRole ?? role
}
