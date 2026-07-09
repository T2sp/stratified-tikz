import {
  DEFAULT_WORK_PLANE_EPSILON,
  constructWorkPlaneFromThreePoints,
  constructWorkPlaneFromOriginNormal,
  cross,
  isFiniteVec3,
  norm,
  subtractVec3,
  validateWorkPlane,
  workPlaneToBasis,
} from '../geometry/workPlane.ts'
import { coordinateAnchorPositionPreview } from '../model/coordinateAnchors.ts'
import type {
  AmbientDimension,
  AxisAlignedWorkPlaneName,
  Diagram,
  PointStratum,
  Vec2,
  Vec3,
  WorkPlane,
} from '../model/types.ts'

export type WorkPlaneSetupMethod =
  | 'pickThreeExistingPoints'
  | 'originNormalVector'
  | 'customThreePoints'

export type WorkPlaneSetupMethodOption = {
  id: WorkPlaneSetupMethod
  label: string
}

export type WorkPlaneVectorInput = {
  x: string
  y: string
  z: string
}

export type CustomOriginNormalWorkPlaneInput = {
  origin: WorkPlaneVectorInput
  normal: WorkPlaneVectorInput
}

export type CustomOriginNormalThetaPhiWorkPlaneInput = {
  origin: WorkPlaneVectorInput
  normalThetaDeg: string
  normalPhiDeg: string
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

export type WorkPlaneFrameDisplay = {
  origin: Vec3
  planeX: Vec3
  planeY: Vec3
  originText: string
  planeXText: string
  planeYText: string
}

export type WorkPlanePickTarget =
  | {
      kind: 'pointStratum'
      id: string
    }
  | {
      kind: 'coordinateAnchor'
      id: string
    }

export type WorkPlanePointPickingState = {
  active: boolean
  pickedPointIds: string[]
  pickedTargets?: WorkPlanePickTarget[]
}

export type WorkPlanePointPickResult = {
  state: WorkPlanePointPickingState
  status: string
}

export type WorkPlaneOriginPickingState = {
  active: boolean
}

export type WorkPlaneOriginPickResult = {
  state: WorkPlaneOriginPickingState
  input: CustomOriginNormalThetaPhiWorkPlaneInput
  status: string
}

export type WorkPlaneCoordinateAnchorPickOptions = {
  showCoordinateAnchors?: boolean
}

export type WorkPlanePointPickingValidationResult = {
  state: WorkPlanePointPickingState
  removedStalePointIds: string[]
  removedStaleCoordinateIds: string[]
}

export type WorkPlaneNormalVectorPreviewLine = {
  id: 'x' | 'y' | 'z' | 'normal'
  from: Vec2
  to: Vec2
  label: string
}

export type WorkPlaneNormalVectorPreviewGeometry = {
  viewBox: string
  axes: WorkPlaneNormalVectorPreviewLine[]
  normal: WorkPlaneNormalVectorPreviewLine
}

export const defaultWorkPlaneSetupMethod: WorkPlaneSetupMethod =
  'pickThreeExistingPoints'

export const workPlaneSetupMethodOptions: WorkPlaneSetupMethodOption[] = [
  {
    id: 'pickThreeExistingPoints',
    label: 'Pick 3 existing points',
  },
  {
    id: 'originNormalVector',
    label: 'Origin + normal vector',
  },
  {
    id: 'customThreePoints',
    label: 'Custom 3 points',
  },
]

export const inactiveWorkPlanePointPickingState: WorkPlanePointPickingState = {
  active: false,
  pickedPointIds: [],
  pickedTargets: [],
}

export const inactiveWorkPlaneOriginPickingState: WorkPlaneOriginPickingState = {
  active: false,
}

export const defaultCustomOriginNormalWorkPlaneInput: CustomOriginNormalWorkPlaneInput =
  {
    origin: { x: '0', y: '0', z: '0' },
    normal: { x: '0', y: '0', z: '1' },
  }

export const defaultCustomOriginNormalThetaPhiWorkPlaneInput: CustomOriginNormalThetaPhiWorkPlaneInput =
  {
    origin: { x: '0', y: '0', z: '0' },
    normalThetaDeg: '0',
    normalPhiDeg: '0',
  }

export const defaultCustomThreePointWorkPlaneInput: CustomThreePointWorkPlaneInput =
  {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '0', z: '0' },
    p2: { x: '0', y: '1', z: '0' },
  }

export function applyCustomOriginNormalThetaPhiWorkPlaneInput(
  currentWorkPlane: WorkPlane,
  ambientDimension: AmbientDimension,
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
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
  const normal = normalVectorFromThetaPhiInput(input)

  if (origin === null || normal === null) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Origin and normal angles must be finite numbers.',
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

export function canApplyCustomOriginNormalThetaPhiWorkPlaneInput(
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
): boolean {
  return (
    parseWorkPlaneVectorInput(input.origin) !== null &&
    normalVectorFromThetaPhiInput(input) !== null
  )
}

export function normalVectorFromThetaPhiDegrees(
  thetaDeg: number,
  phiDeg: number,
): Vec3 | null {
  if (!Number.isFinite(thetaDeg) || !Number.isFinite(phiDeg)) {
    return null
  }

  const theta = degreesToRadians(thetaDeg)
  const phi = degreesToRadians(phiDeg)

  if (!Number.isFinite(theta) || !Number.isFinite(phi)) {
    return null
  }

  const sinTheta = Math.sin(theta)
  const normal = {
    x: normalizeTinyWorkPlaneValue(sinTheta * Math.cos(phi)),
    y: normalizeTinyWorkPlaneValue(sinTheta * Math.sin(phi)),
    z: normalizeTinyWorkPlaneValue(Math.cos(theta)),
  }

  return isFiniteVec3(normal) && !isZeroVector(normal) ? normal : null
}

export function normalVectorFromThetaPhiInput(
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
): Vec3 | null {
  const thetaDeg = parseFiniteNumberInput(input.normalThetaDeg)
  const phiDeg = parseFiniteNumberInput(input.normalPhiDeg)

  return thetaDeg === null || phiDeg === null
    ? null
    : normalVectorFromThetaPhiDegrees(thetaDeg, phiDeg)
}

export function workPlaneNormalVectorPreviewGeometry(
  normal: Vec3,
): WorkPlaneNormalVectorPreviewGeometry | null {
  if (!isFiniteVec3(normal) || isZeroVector(normal)) {
    return null
  }

  const origin = { x: 45, y: 44 }
  const axes: WorkPlaneNormalVectorPreviewLine[] = [
    {
      id: 'x',
      from: origin,
      to: projectNormalPreviewVector({ x: 1, y: 0, z: 0 }),
      label: 'x',
    },
    {
      id: 'y',
      from: origin,
      to: projectNormalPreviewVector({ x: 0, y: 1, z: 0 }),
      label: 'y',
    },
    {
      id: 'z',
      from: origin,
      to: projectNormalPreviewVector({ x: 0, y: 0, z: 1 }),
      label: 'z',
    },
  ]
  const normalLine = {
    id: 'normal' as const,
    from: origin,
    to: projectNormalPreviewVector(normal),
    label: 'n',
  }

  if (
    [...axes, normalLine].some(
      (line) => !isFiniteVec2(line.from) || !isFiniteVec2(line.to),
    )
  ) {
    return null
  }

  return {
    viewBox: '0 0 90 72',
    axes,
    normal: normalLine,
  }
}

export function workPlaneNormalVectorPreviewGeometryFromInput(
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
): WorkPlaneNormalVectorPreviewGeometry | null {
  const normal = normalVectorFromThetaPhiInput(input)

  return normal === null ? null : workPlaneNormalVectorPreviewGeometry(normal)
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

  const state = workPlanePointPickingStateFromTargets([])

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
  const state = workPlanePointPickingStateFromTargets([])

  return {
    state,
    status: workPlanePointPickingStatus(state),
  }
}

export function pickWorkPlanePointStratum(
  state: WorkPlanePointPickingState,
  pointId: string,
): WorkPlanePointPickResult {
  return pickWorkPlaneTarget(state, { kind: 'pointStratum', id: pointId })
}

export function pickWorkPlaneCoordinateAnchor(
  diagram: Diagram,
  state: WorkPlanePointPickingState,
  coordinateId: string,
  options: WorkPlaneCoordinateAnchorPickOptions = {},
): WorkPlanePointPickResult {
  if (options.showCoordinateAnchors === false) {
    return {
      state,
      status: 'Coordinate anchors are hidden.',
    }
  }

  const resolved = resolveWorkPlanePickTargetPosition(diagram, {
    kind: 'coordinateAnchor',
    id: coordinateId,
  }, options)

  if (resolved === null) {
    return {
      state,
      status: 'Coordinate anchor is unavailable or has no finite preview position.',
    }
  }

  return pickWorkPlaneTarget(
    state,
    { kind: 'coordinateAnchor', id: coordinateId },
    diagram,
  )
}

export function startWorkPlaneOriginPicking(
  ambientDimension: AmbientDimension,
): { state: WorkPlaneOriginPickingState; status: string } {
  if (ambientDimension !== 3) {
    return {
      state: inactiveWorkPlaneOriginPickingState,
      status: 'Origin picking for work planes is available only in 3D.',
    }
  }

  return {
    state: { active: true },
    status: 'Pick an existing point or shown coordinate anchor for the origin.',
  }
}

export function cancelWorkPlaneOriginPicking(
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
): WorkPlaneOriginPickResult {
  return {
    state: inactiveWorkPlaneOriginPickingState,
    input,
    status: 'Origin picking canceled.',
  }
}

export function pickWorkPlaneOriginPointStratum(
  diagram: Diagram,
  state: WorkPlaneOriginPickingState,
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
  pointId: string,
): WorkPlaneOriginPickResult {
  return pickWorkPlaneOriginTarget(diagram, state, input, {
    kind: 'pointStratum',
    id: pointId,
  })
}

export function pickWorkPlaneOriginCoordinateAnchor(
  diagram: Diagram,
  state: WorkPlaneOriginPickingState,
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
  coordinateId: string,
  options: WorkPlaneCoordinateAnchorPickOptions = {},
): WorkPlaneOriginPickResult {
  if (options.showCoordinateAnchors === false) {
    return {
      state,
      input,
      status: 'Coordinate anchors are hidden.',
    }
  }

  return pickWorkPlaneOriginTarget(
    diagram,
    state,
    input,
    {
      kind: 'coordinateAnchor',
      id: coordinateId,
    },
    options,
  )
}

export function pickWorkPlaneOriginTarget(
  diagram: Diagram,
  state: WorkPlaneOriginPickingState,
  input: CustomOriginNormalThetaPhiWorkPlaneInput,
  target: WorkPlanePickTarget,
  options: WorkPlaneCoordinateAnchorPickOptions = {},
): WorkPlaneOriginPickResult {
  if (!state.active) {
    return {
      state,
      input,
      status: 'Origin picking is not active.',
    }
  }

  const resolved = resolveWorkPlanePickTargetPosition(diagram, target, options)

  if (resolved === null) {
    return {
      state,
      input,
      status:
        target.kind === 'pointStratum'
          ? 'Point is unavailable or has no finite position.'
          : 'Coordinate anchor is unavailable or has no finite preview position.',
    }
  }

  return {
    state: inactiveWorkPlaneOriginPickingState,
    input: {
      ...input,
      origin: workPlaneVectorInputFromVec3(resolved.position),
    },
    status: `Origin picked from ${workPlanePickTargetStatusLabel(
      diagram,
      target,
    )}.`,
  }
}

export function pickWorkPlaneTarget(
  state: WorkPlanePointPickingState,
  target: WorkPlanePickTarget,
  diagram?: Diagram,
): WorkPlanePointPickResult {
  if (!state.active) {
    return {
      state,
      status: 'Point picking is not active.',
    }
  }

  const pickedTargets = workPlanePointPickingTargets(state)

  if (
    pickedTargets.some((pickedTarget) =>
      workPlanePickTargetsEqual(pickedTarget, target),
    )
  ) {
    return {
      state,
      status:
        target.kind === 'pointStratum'
          ? 'Point already picked.'
          : 'Coordinate anchor already picked.',
    }
  }

  if (pickedTargets.length >= 3) {
    return {
      state,
      status: 'Already picked 3/3 points.',
    }
  }

  const nextState = workPlanePointPickingStateFromTargets([
    ...pickedTargets,
    target,
  ])

  return {
    state: nextState,
    status: workPlanePointPickingStatus(nextState, diagram),
  }
}

export function validateWorkPlanePointPickingState(
  diagram: Diagram,
  state: WorkPlanePointPickingState,
): WorkPlanePointPickingValidationResult {
  const pickedTargets = workPlanePointPickingTargets(state)

  if (!state.active || pickedTargets.length === 0) {
    return {
      state,
      removedStalePointIds: [],
      removedStaleCoordinateIds: [],
    }
  }

  const availablePointIds = new Set(
    diagram.strata
      .filter((stratum): stratum is PointStratum => stratum.geometricKind === 'point')
      .map((point) => point.id),
  )
  const availableCoordinateIds = new Set(
    (diagram.coordinateAnchors ?? [])
      .filter((anchor) =>
        isFiniteCoordinateAnchorPreview(diagram, anchor.id),
      )
      .map((anchor) => anchor.id),
  )
  const targets = pickedTargets.filter((target) =>
    target.kind === 'pointStratum'
      ? availablePointIds.has(target.id)
      : availableCoordinateIds.has(target.id),
  )
  const removedStalePointIds = pickedTargets.flatMap((target) =>
    target.kind === 'pointStratum' && !availablePointIds.has(target.id)
      ? [target.id]
      : [],
  )
  const removedStaleCoordinateIds = pickedTargets.flatMap((target) =>
    target.kind === 'coordinateAnchor' && !availableCoordinateIds.has(target.id)
      ? [target.id]
      : [],
  )

  return {
    state:
      removedStalePointIds.length === 0 && removedStaleCoordinateIds.length === 0
        ? state
        : workPlanePointPickingStateFromTargets(targets),
    removedStalePointIds,
    removedStaleCoordinateIds,
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

  const pickedTargets = workPlanePointPickingTargets(state)
  const targetKeys = pickedTargets.map(workPlanePickTargetKey)

  if (new Set(targetKeys).size !== targetKeys.length) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Plane points must be distinct.',
    }
  }

  if (pickedTargets.length !== 3) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: workPlanePointPickingStatus(state),
    }
  }

  const resolvedTargets = pickedTargets.map((target) =>
    resolveWorkPlanePickTargetPosition(diagram, target),
  )

  if (resolvedTargets.some((target) => target === null)) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Picked points are no longer available.',
    }
  }

  const [p0, p1, p2] = resolvedTargets as [
    ResolvedWorkPlanePickTarget,
    ResolvedWorkPlanePickTarget,
    ResolvedWorkPlanePickTarget,
  ]
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
    const allPointTargets = pickedTargets.every(
      (target) => target.kind === 'pointStratum',
    )

    return {
      ok: true,
      workPlane: allPointTargets
        ? {
            ...workPlane,
            source: {
              kind: 'existingPointStrata',
              pointIds: [p0.id, p1.id, p2.id],
            },
          }
        : workPlane,
      status: allPointTargets
        ? 'Custom plane applied from picked points.'
        : 'Custom plane applied from picked points and coordinates.',
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

export function workPlanePointPickingCount(
  state: WorkPlanePointPickingState,
): number {
  return workPlanePointPickingTargets(state).length
}

export function canApplyPickedPointWorkPlane(
  state: WorkPlanePointPickingState,
): boolean {
  return state.active && workPlanePointPickingCount(state) === 3
}

export function workPlanePointPickingTargets(
  state: WorkPlanePointPickingState,
): WorkPlanePickTarget[] {
  return state.pickedTargets ?? state.pickedPointIds.map((id) => ({
    kind: 'pointStratum',
    id,
  }))
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

export function normalizeActiveWorkPlaneForDiagram(
  diagram: Diagram,
  workPlane: WorkPlane,
): WorkPlane {
  const normalized = normalizeActiveWorkPlaneForAmbientDimension(
    diagram.ambientDimension,
    workPlane,
  )

  if (
    normalized.kind !== 'custom' ||
    normalized.source.kind !== 'existingPointStrata'
  ) {
    return normalized
  }

  const availablePointIds = new Set(
    diagram.strata
      .filter((stratum): stratum is PointStratum => stratum.geometricKind === 'point')
      .map((point) => point.id),
  )

  return normalized.source.pointIds.every((id) => availablePointIds.has(id))
    ? normalized
    : { kind: 'xy', z: 0 }
}

export function shouldShowWorkPlaneControls(
  ambientDimension: AmbientDimension,
): boolean {
  return ambientDimension === 3
}

export function shouldShowWorkPlaneDetails(
  ambientDimension: AmbientDimension,
  expanded: boolean,
): boolean {
  return shouldShowWorkPlaneControls(ambientDimension) && expanded
}

export function shouldShowWorkPlaneOverlay(
  ambientDimension: AmbientDimension,
): boolean {
  return ambientDimension === 3
}

export function shouldShowWorkPlaneOverlayPanel(
  ambientDimension: AmbientDimension,
  expanded: boolean,
): boolean {
  return shouldShowWorkPlaneOverlay(ambientDimension) && expanded
}

export function toggleWorkPlaneOverlayPanel(expanded: boolean): boolean {
  return !expanded
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

export function workPlaneSummaryLabel(workPlane: WorkPlane): string {
  switch (workPlane.kind) {
    case 'xy':
      return `xy plane at z = ${String(workPlane.z)}`
    case 'xz':
      return `xz plane at y = ${String(workPlane.y)}`
    case 'yz':
      return `yz plane at x = ${String(workPlane.x)}`
    case 'axisAligned':
      return `${workPlane.plane} plane at ${workPlaneFixedCoordinate(
        workPlane.plane,
      )} = ${String(workPlane.offset)}`
    case 'custom':
      return workPlane.name
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

export function workPlaneOverlayButtonLabel(workPlane: WorkPlane): string {
  return `Work plane: ${workPlaneDisplayName(workPlane)} ▾`
}

export function workPlaneFrameDisplay(
  workPlane: WorkPlane,
): WorkPlaneFrameDisplay | null {
  try {
    const basis = workPlaneToBasis(workPlane)

    return {
      origin: basis.origin,
      planeX: basis.u,
      planeY: basis.v,
      originText: formatCompactVec3ForWorkPlane(basis.origin),
      planeXText: formatCompactVec3ForWorkPlane(basis.u),
      planeYText: formatCompactVec3ForWorkPlane(basis.v),
    }
  } catch {
    return null
  }
}

export function workPlaneOriginReferenceText(workPlane: WorkPlane): string {
  const display = workPlaneFrameDisplay(workPlane)

  return display === null
    ? 'Active work-plane origin: unavailable'
    : `Active work-plane origin: ${display.originText}`
}

export function workPlaneVectorReferenceText(
  workPlane: WorkPlane,
): string | null {
  const display = workPlaneFrameDisplay(workPlane)

  return display === null
    ? null
    : `Plane x ${display.planeXText}; plane y ${display.planeYText}`
}

export function workPlanePointPickingStatus(
  state: WorkPlanePointPickingState,
  diagram?: Diagram,
): string {
  const targets = workPlanePointPickingTargets(state)
  const summary =
    diagram === undefined || targets.length === 0
      ? ''
      : `: ${targets
          .map((target) => workPlanePickTargetStatusLabel(diagram, target))
          .join(', ')}`

  return `Picked ${targets.length}/3 points${summary}.`
}

export function workPlanePointPickingTargetLabels(
  diagram: Diagram,
  state: WorkPlanePointPickingState,
): string[] {
  return workPlanePointPickingTargets(state).map((target) =>
    workPlanePickTargetStatusLabel(diagram, target),
  )
}

type ResolvedWorkPlanePickTarget = WorkPlanePickTarget & {
  position: Vec3
}

function workPlanePointPickingStateFromTargets(
  pickedTargets: WorkPlanePickTarget[],
): WorkPlanePointPickingState {
  return {
    active: true,
    pickedTargets,
    pickedPointIds: pickedTargets.flatMap((target) =>
      target.kind === 'pointStratum' ? [target.id] : [],
    ),
  }
}

function resolveWorkPlanePickTargetPosition(
  diagram: Diagram,
  target: WorkPlanePickTarget,
  options: WorkPlaneCoordinateAnchorPickOptions = {},
): ResolvedWorkPlanePickTarget | null {
  switch (target.kind) {
    case 'pointStratum': {
      const point = diagram.strata.find(
        (stratum): stratum is PointStratum =>
          stratum.id === target.id && stratum.geometricKind === 'point',
      )

      return point !== undefined && isFiniteVec3(point.position)
        ? { ...target, position: { ...point.position } }
        : null
    }
    case 'coordinateAnchor': {
      if (options.showCoordinateAnchors === false) {
        return null
      }

      const anchor = (diagram.coordinateAnchors ?? []).find(
        (candidate) => candidate.id === target.id,
      )

      if (anchor === undefined) {
        return null
      }

      try {
        const position = coordinateAnchorPositionPreview(
          anchor.position,
          diagram.ambientDimension,
        )

        return isFiniteVec3(position)
          ? { ...target, position: { ...position } }
          : null
      } catch {
        return null
      }
    }
  }
}

function isFiniteCoordinateAnchorPreview(
  diagram: Diagram,
  coordinateId: string,
): boolean {
  return resolveWorkPlanePickTargetPosition(diagram, {
    kind: 'coordinateAnchor',
    id: coordinateId,
  }) !== null
}

function workPlanePickTargetsEqual(
  left: WorkPlanePickTarget,
  right: WorkPlanePickTarget,
): boolean {
  return left.kind === right.kind && left.id === right.id
}

function workPlanePickTargetKey(target: WorkPlanePickTarget): string {
  return `${target.kind}:${target.id}`
}

function workPlanePickTargetStatusLabel(
  diagram: Diagram,
  target: WorkPlanePickTarget,
): string {
  switch (target.kind) {
    case 'pointStratum': {
      const point = diagram.strata.find(
        (stratum): stratum is PointStratum =>
          stratum.id === target.id && stratum.geometricKind === 'point',
      )
      return `point ${point?.name.trim() || target.id}`
    }
    case 'coordinateAnchor': {
      const anchor = (diagram.coordinateAnchors ?? []).find(
        (candidate) => candidate.id === target.id,
      )
      const label =
        anchor === undefined
          ? target.id
          : `${anchor.name.trim() || anchor.id} (${anchor.tikzName})`
      return `coordinate ${label}`
    }
  }
}

function workPlaneFixedCoordinate(plane: AxisAlignedWorkPlaneName): 'x' | 'y' | 'z' {
  switch (plane) {
    case 'xy':
      return 'z'
    case 'xz':
      return 'y'
    case 'yz':
      return 'x'
  }
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

function workPlaneVectorInputFromVec3(point: Vec3): WorkPlaneVectorInput {
  return {
    x: formatWorkPlaneVectorInputValue(point.x),
    y: formatWorkPlaneVectorInputValue(point.y),
    z: formatWorkPlaneVectorInputValue(point.z),
  }
}

function formatWorkPlaneVectorInputValue(value: number): string {
  return String(normalizeTinyWorkPlaneValue(value))
}

function parseFiniteNumberInput(value: string): number | null {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function normalizeTinyWorkPlaneValue(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value
}

function projectNormalPreviewVector(vector: Vec3): Vec2 {
  const scale = 24

  return {
    x: 45 + scale * (vector.x - 0.55 * vector.y),
    y: 44 + scale * (0.38 * vector.x + 0.38 * vector.y - vector.z),
  }
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function formatCompactVec3ForWorkPlane(point: Vec3): string {
  return `(${formatCompactNumberForWorkPlane(point.x)}, ${formatCompactNumberForWorkPlane(
    point.y,
  )}, ${formatCompactNumberForWorkPlane(point.z)})`
}

function formatCompactNumberForWorkPlane(value: number): string {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value

  if (Number.isInteger(normalized)) {
    return String(normalized)
  }

  return normalized.toFixed(3).replace(/\.?0+$/, '')
}

function isZeroVector(vector: Vec3): boolean {
  return vector.x === 0 && vector.y === 0 && vector.z === 0
}

function areCoincidentPoints(first: Vec3, second: Vec3): boolean {
  return norm(subtractVec3(first, second)) <= DEFAULT_WORK_PLANE_EPSILON
}
