import {
  DEFAULT_WORK_PLANE_EPSILON,
  constructWorkPlaneFromThreePoints,
  constructWorkPlaneFromOriginNormal,
  cross,
  norm,
  subtractVec3,
  validateWorkPlane,
} from '../geometry/workPlane.ts'
import type {
  AmbientDimension,
  AxisAlignedWorkPlaneName,
  Diagram,
  PointStratum,
  Vec3,
  WorkPlane,
} from '../model/types.ts'

export type WorkPlaneVectorInput = {
  x: string
  y: string
  z: string
}

export type CustomOriginNormalWorkPlaneInput = {
  origin: WorkPlaneVectorInput
  normal: WorkPlaneVectorInput
}

export type CustomThreePointWorkPlaneInput = {
  p0: WorkPlaneVectorInput
  p1: WorkPlaneVectorInput
  p2: WorkPlaneVectorInput
}

export type CustomWorkPlaneApplyResult =
  | {
      ok: true
      workPlane: WorkPlane
      status: string
    }
  | {
      ok: false
      workPlane: WorkPlane
      status: string
    }

export type WorkPlaneSelectValue = AxisAlignedWorkPlaneName | 'custom'

export type WorkPlanePointPickingState = {
  active: boolean
  pickedPointIds: string[]
}

export type WorkPlanePointPickResult = {
  state: WorkPlanePointPickingState
  status: string
}

export type WorkPlanePointPickingValidationResult = {
  state: WorkPlanePointPickingState
  removedStalePointIds: string[]
}

export const inactiveWorkPlanePointPickingState: WorkPlanePointPickingState = {
  active: false,
  pickedPointIds: [],
}

export const defaultCustomOriginNormalWorkPlaneInput: CustomOriginNormalWorkPlaneInput =
  {
    origin: { x: '0', y: '0', z: '0' },
    normal: { x: '0', y: '0', z: '1' },
  }

export const defaultCustomThreePointWorkPlaneInput: CustomThreePointWorkPlaneInput =
  {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '0', z: '0' },
    p2: { x: '0', y: '1', z: '0' },
  }

export function applyCustomOriginNormalWorkPlaneInput(
  currentWorkPlane: WorkPlane,
  ambientDimension: AmbientDimension,
  input: CustomOriginNormalWorkPlaneInput,
): CustomWorkPlaneApplyResult {
  if (ambientDimension !== 3) {
    return {
      ok: false,
      workPlane: normalizeActiveWorkPlaneForAmbientDimension(
        ambientDimension,
        currentWorkPlane,
      ),
      status: 'Custom work planes are available only in 3D.',
    }
  }

  const origin = parseWorkPlaneVectorInput(input.origin)
  const normal = parseWorkPlaneVectorInput(input.normal)

  if (origin === null || normal === null) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Origin and normal must be finite numbers.',
    }
  }

  if (isZeroVector(normal)) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Normal vector must be nonzero.',
    }
  }

  try {
    return {
      ok: true,
      workPlane: constructWorkPlaneFromOriginNormal(origin, normal, {
        id: 'custom-origin-normal-work-plane',
        name: 'Custom plane',
      }),
      status: 'Custom plane applied.',
    }
  } catch {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Custom plane inputs are invalid.',
    }
  }
}

export function applyCustomThreePointWorkPlaneInput(
  currentWorkPlane: WorkPlane,
  ambientDimension: AmbientDimension,
  input: CustomThreePointWorkPlaneInput,
): CustomWorkPlaneApplyResult {
  if (ambientDimension !== 3) {
    return {
      ok: false,
      workPlane: normalizeActiveWorkPlaneForAmbientDimension(
        ambientDimension,
        currentWorkPlane,
      ),
      status: 'Custom work planes are available only in 3D.',
    }
  }

  const p0 = parseWorkPlaneVectorInput(input.p0)
  const p1 = parseWorkPlaneVectorInput(input.p1)
  const p2 = parseWorkPlaneVectorInput(input.p2)

  if (p0 === null || p1 === null || p2 === null) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Plane points must be finite numbers.',
    }
  }

  if (
    areCoincidentPoints(p0, p1) ||
    areCoincidentPoints(p0, p2) ||
    areCoincidentPoints(p1, p2)
  ) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Plane points must be distinct.',
    }
  }

  const firstEdge = subtractVec3(p1, p0)
  const secondEdge = subtractVec3(p2, p0)

  if (norm(cross(firstEdge, secondEdge)) <= DEFAULT_WORK_PLANE_EPSILON) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Plane points must not be collinear.',
    }
  }

  try {
    return {
      ok: true,
      workPlane: constructWorkPlaneFromThreePoints(p0, p1, p2, {
        id: 'custom-three-point-work-plane',
        name: 'Custom plane',
      }),
      status: 'Custom plane applied.',
    }
  } catch {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Custom plane inputs are invalid.',
    }
  }
}

export function startWorkPlanePointPicking(
  ambientDimension: AmbientDimension,
): WorkPlanePointPickResult {
  if (ambientDimension !== 3) {
    return {
      state: inactiveWorkPlanePointPickingState,
      status: 'Point picking for work planes is available only in 3D.',
    }
  }

  const state = { active: true, pickedPointIds: [] }

  return {
    state,
    status: workPlanePointPickingStatus(state),
  }
}

export function cancelWorkPlanePointPicking(): WorkPlanePointPickResult {
  return {
    state: inactiveWorkPlanePointPickingState,
    status: 'Point picking canceled.',
  }
}

export function resetWorkPlanePointPicking(): WorkPlanePointPickResult {
  const state = { active: true, pickedPointIds: [] }

  return {
    state,
    status: workPlanePointPickingStatus(state),
  }
}

export function pickWorkPlanePointStratum(
  state: WorkPlanePointPickingState,
  pointId: string,
): WorkPlanePointPickResult {
  if (!state.active) {
    return {
      state,
      status: 'Point picking is not active.',
    }
  }

  if (state.pickedPointIds.includes(pointId)) {
    return {
      state,
      status: 'Point already picked.',
    }
  }

  if (state.pickedPointIds.length >= 3) {
    return {
      state,
      status: 'Already picked 3/3 points.',
    }
  }

  const nextState = {
    active: true,
    pickedPointIds: [...state.pickedPointIds, pointId],
  }

  return {
    state: nextState,
    status: workPlanePointPickingStatus(nextState),
  }
}

export function validateWorkPlanePointPickingState(
  diagram: Diagram,
  state: WorkPlanePointPickingState,
): WorkPlanePointPickingValidationResult {
  if (!state.active || state.pickedPointIds.length === 0) {
    return {
      state,
      removedStalePointIds: [],
    }
  }

  const availablePointIds = new Set(
    diagram.strata
      .filter((stratum): stratum is PointStratum => stratum.geometricKind === 'point')
      .map((point) => point.id),
  )
  const pickedPointIds = state.pickedPointIds.filter((id) =>
    availablePointIds.has(id),
  )
  const removedStalePointIds = state.pickedPointIds.filter(
    (id) => !availablePointIds.has(id),
  )

  return {
    state:
      removedStalePointIds.length === 0
        ? state
        : { ...state, pickedPointIds },
    removedStalePointIds,
  }
}

export function applyPickedPointWorkPlane(
  currentWorkPlane: WorkPlane,
  ambientDimension: AmbientDimension,
  diagram: Diagram,
  state: WorkPlanePointPickingState,
): CustomWorkPlaneApplyResult {
  if (ambientDimension !== 3) {
    return {
      ok: false,
      workPlane: normalizeActiveWorkPlaneForAmbientDimension(
        ambientDimension,
        currentWorkPlane,
      ),
      status: 'Custom work planes are available only in 3D.',
    }
  }

  if (!state.active) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Point picking is not active.',
    }
  }

  if (new Set(state.pickedPointIds).size !== state.pickedPointIds.length) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Plane points must be distinct.',
    }
  }

  if (state.pickedPointIds.length !== 3) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: workPlanePointPickingStatus(state),
    }
  }

  const points = state.pickedPointIds.map((id) =>
    diagram.strata.find(
      (stratum): stratum is PointStratum =>
        stratum.id === id && stratum.geometricKind === 'point',
    ),
  )

  if (points.some((point) => point === undefined)) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Picked points are no longer available.',
    }
  }

  const [p0, p1, p2] = points as [PointStratum, PointStratum, PointStratum]
  const firstEdge = subtractVec3(p1.position, p0.position)
  const secondEdge = subtractVec3(p2.position, p0.position)

  if (norm(cross(firstEdge, secondEdge)) <= DEFAULT_WORK_PLANE_EPSILON) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Plane points must not be collinear.',
    }
  }

  try {
    const workPlane = constructWorkPlaneFromThreePoints(
      p0.position,
      p1.position,
      p2.position,
      {
        id: 'custom-existing-points-work-plane',
        name: 'Custom plane',
      },
    )

    return {
      ok: true,
      workPlane: {
        ...workPlane,
        source: {
          kind: 'existingPointStrata',
          pointIds: [p0.id, p1.id, p2.id],
        },
      },
      status: 'Custom plane applied from picked points.',
    }
  } catch {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Custom plane inputs are invalid.',
    }
  }
}

export function shouldBlockCreationForWorkPlanePointPicking(
  state: WorkPlanePointPickingState,
): boolean {
  return state.active
}

export function normalizeActiveWorkPlaneForAmbientDimension(
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): WorkPlane {
  if (ambientDimension === 2) {
    return { kind: 'xy', z: 0 }
  }

  return validateWorkPlane(workPlane).valid ? workPlane : { kind: 'xy', z: 0 }
}

export function shouldShowWorkPlaneControls(
  ambientDimension: AmbientDimension,
): boolean {
  return ambientDimension === 3
}

export function workPlaneSelectValue(
  workPlane: WorkPlane,
): WorkPlaneSelectValue {
  switch (workPlane.kind) {
    case 'xy':
    case 'xz':
    case 'yz':
      return workPlane.kind
    case 'axisAligned':
      return workPlane.plane
    case 'custom':
      return 'custom'
  }
}

export function workPlaneDisplayName(workPlane: WorkPlane): string {
  switch (workPlane.kind) {
    case 'xy':
      return 'xy plane'
    case 'xz':
      return 'xz plane'
    case 'yz':
      return 'yz plane'
    case 'axisAligned':
      return `${workPlane.plane} plane`
    case 'custom':
      return workPlane.name
  }
}

export function workPlanePointPickingStatus(
  state: WorkPlanePointPickingState,
): string {
  return `Picked ${state.pickedPointIds.length}/3 points.`
}

function parseWorkPlaneVectorInput(input: WorkPlaneVectorInput): Vec3 | null {
  const x = parseFiniteNumberInput(input.x)
  const y = parseFiniteNumberInput(input.y)
  const z = parseFiniteNumberInput(input.z)

  if (x === null || y === null || z === null) {
    return null
  }

  return { x, y, z }
}

function parseFiniteNumberInput(value: string): number | null {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function isZeroVector(vector: Vec3): boolean {
  return vector.x === 0 && vector.y === 0 && vector.z === 0
}

function areCoincidentPoints(first: Vec3, second: Vec3): boolean {
  return norm(subtractVec3(first, second)) <= DEFAULT_WORK_PLANE_EPSILON
}
