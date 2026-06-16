import type {
  AxisAlignedWorkPlane,
  AxisAlignedWorkPlaneName,
  CustomWorkPlane,
  LegacyAxisAlignedWorkPlane,
  Vec3,
  WorkPlane,
} from '../model/types.ts'

export const DEFAULT_WORK_PLANE_EPSILON = 1e-9

export type WorkPlaneConstructionOptions = {
  id?: string
  name?: string
  epsilon?: number
}

export type WorkPlaneValidationIssue = {
  path: string
  message: string
}

export type WorkPlaneValidationResult = {
  valid: boolean
  errors: WorkPlaneValidationIssue[]
}

export type WorkPlaneBasis = {
  origin: Vec3
  u: Vec3
  v: Vec3
  normal: Vec3
}

export function dot(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

export function cross(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  }
}

export function norm(vector: Vec3): number {
  return Math.sqrt(dot(vector, vector))
}

export function normalizeVector(
  vector: Vec3,
  epsilon = DEFAULT_WORK_PLANE_EPSILON,
): Vec3 {
  if (!isFiniteVec3(vector)) {
    throw new Error('Cannot normalize a non-finite vector.')
  }

  const length = norm(vector)

  if (!Number.isFinite(length) || length <= epsilon) {
    throw new Error('Cannot normalize a zero-length vector.')
  }

  return scaleVec3(vector, 1 / length)
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

export function scaleVec3(vector: Vec3, scalar: number): Vec3 {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
    z: vector.z * scalar,
  }
}

export function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

export function constructWorkPlaneFromOriginNormal(
  origin: Vec3,
  normal: Vec3,
  options: WorkPlaneConstructionOptions = {},
): CustomWorkPlane {
  const epsilon = options.epsilon ?? DEFAULT_WORK_PLANE_EPSILON

  assertFiniteVec3(origin, 'origin')
  assertFiniteVec3(normal, 'normal')

  const normalizedNormal = normalizeVector(normal, epsilon)
  const auxiliaryAxis = chooseAuxiliaryAxis(normalizedNormal)
  const u = normalizeVector(
    subtractVec3(
      auxiliaryAxis,
      scaleVec3(normalizedNormal, dot(auxiliaryAxis, normalizedNormal)),
    ),
    epsilon,
  )
  // The basis is right-handed: cross(u, v) points in the normal direction.
  const v = normalizeVector(cross(normalizedNormal, u), epsilon)

  return createCustomWorkPlane(
    {
      origin,
      u,
      v,
      normal: normalizedNormal,
    },
    {
      id: options.id,
      name: options.name,
      source: { kind: 'originNormal' },
    },
  )
}

export function constructWorkPlaneFromThreePoints(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  options: WorkPlaneConstructionOptions = {},
): CustomWorkPlane {
  const epsilon = options.epsilon ?? DEFAULT_WORK_PLANE_EPSILON

  assertFiniteVec3(p0, 'p0')
  assertFiniteVec3(p1, 'p1')
  assertFiniteVec3(p2, 'p2')

  const firstEdge = subtractVec3(p1, p0)
  const secondEdge = subtractVec3(p2, p0)
  const u = normalizeVector(firstEdge, epsilon)
  const normal = normalizeVector(cross(firstEdge, secondEdge), epsilon)
  const v = normalizeVector(cross(normal, u), epsilon)

  return createCustomWorkPlane(
    {
      origin: p0,
      u,
      v,
      normal,
    },
    {
      id: options.id,
      name: options.name,
      source: { kind: 'threePoints' },
    },
  )
}

export function validateWorkPlane(
  workPlane: WorkPlane,
  epsilon = DEFAULT_WORK_PLANE_EPSILON,
): WorkPlaneValidationResult {
  const errors: WorkPlaneValidationIssue[] = []

  if (isLegacyAxisAlignedWorkPlane(workPlane)) {
    validateFiniteNumber(legacyAxisAlignedOffset(workPlane), 'offset', errors)
    return validationResult(errors)
  }

  if (workPlane.kind === 'axisAligned') {
    validateFiniteNumber(workPlane.offset, 'offset', errors)
    return validationResult(errors)
  }

  validateFiniteVec3(workPlane.origin, 'origin', errors)
  validateFiniteVec3(workPlane.u, 'u', errors)
  validateFiniteVec3(workPlane.v, 'v', errors)
  validateFiniteVec3(workPlane.normal, 'normal', errors)

  if (errors.length > 0) {
    return validationResult(errors)
  }

  validateUnitVector(workPlane.u, 'u', epsilon, errors)
  validateUnitVector(workPlane.v, 'v', epsilon, errors)
  validateUnitVector(workPlane.normal, 'normal', epsilon, errors)
  validateOrthogonal(workPlane.u, workPlane.v, 'u', 'v', epsilon, errors)
  validateOrthogonal(workPlane.u, workPlane.normal, 'u', 'normal', epsilon, errors)
  validateOrthogonal(workPlane.v, workPlane.normal, 'v', 'normal', epsilon, errors)

  const handednessError = norm(subtractVec3(cross(workPlane.u, workPlane.v), workPlane.normal))

  if (!Number.isFinite(handednessError) || handednessError > epsilon) {
    errors.push({
      path: 'normal',
      message: 'Work plane basis must be right-handed: cross(u, v) must equal normal.',
    })
  }

  return validationResult(errors)
}

export function pointOnWorkPlane(
  workPlane: WorkPlane,
  a: number,
  b: number,
): Vec3 {
  assertFiniteNumber(a, 'a')
  assertFiniteNumber(b, 'b')

  const basis = workPlaneToBasis(workPlane)
  const point = addVec3(
    basis.origin,
    addVec3(scaleVec3(basis.u, a), scaleVec3(basis.v, b)),
  )

  if (!isFiniteVec3(point)) {
    throw new Error('Work plane coordinates produced a non-finite point.')
  }

  return point
}

export function projectPointToWorkPlaneCoordinates(
  point: Vec3,
  workPlane: WorkPlane,
): { a: number; b: number } {
  assertFiniteVec3(point, 'point')

  const basis = workPlaneToBasis(workPlane)
  const relativePoint = subtractVec3(point, basis.origin)
  const coordinates = {
    a: dot(relativePoint, basis.u),
    b: dot(relativePoint, basis.v),
  }

  assertFiniteNumber(coordinates.a, 'a')
  assertFiniteNumber(coordinates.b, 'b')

  return coordinates
}

export function axisAlignedWorkPlane(
  plane: AxisAlignedWorkPlaneName,
  offset: number,
): AxisAlignedWorkPlane {
  assertFiniteNumber(offset, 'offset')

  return {
    kind: 'axisAligned',
    plane,
    offset,
  }
}

export function axisAlignedWorkPlaneToLegacy(
  workPlane: AxisAlignedWorkPlane,
): LegacyAxisAlignedWorkPlane {
  switch (workPlane.plane) {
    case 'xy':
      return { kind: 'xy', z: workPlane.offset }
    case 'xz':
      return { kind: 'xz', y: workPlane.offset }
    case 'yz':
      return { kind: 'yz', x: workPlane.offset }
  }
}

export function legacyAxisAlignedWorkPlaneToAxisAligned(
  workPlane: LegacyAxisAlignedWorkPlane,
): AxisAlignedWorkPlane {
  return axisAlignedWorkPlane(workPlane.kind, legacyAxisAlignedOffset(workPlane))
}

export function isLegacyAxisAlignedWorkPlane(
  workPlane: WorkPlane,
): workPlane is LegacyAxisAlignedWorkPlane {
  return (
    workPlane.kind === 'xy' ||
    workPlane.kind === 'xz' ||
    workPlane.kind === 'yz'
  )
}

export function workPlaneToBasis(workPlane: WorkPlane): WorkPlaneBasis {
  const validation = validateWorkPlane(workPlane)

  if (!validation.valid) {
    throw new Error(
      `Invalid work plane: ${validation.errors
        .map((error) => `${error.path} ${error.message}`)
        .join('; ')}`,
    )
  }

  if (isLegacyAxisAlignedWorkPlane(workPlane)) {
    return axisAlignedBasis(workPlane.kind, legacyAxisAlignedOffset(workPlane))
  }

  if (workPlane.kind === 'axisAligned') {
    return axisAlignedBasis(workPlane.plane, workPlane.offset)
  }

  return {
    origin: { ...workPlane.origin },
    u: { ...workPlane.u },
    v: { ...workPlane.v },
    normal: { ...workPlane.normal },
  }
}

function createCustomWorkPlane(
  basis: WorkPlaneBasis,
  metadata: Pick<CustomWorkPlane, 'source'> &
    Partial<Pick<CustomWorkPlane, 'id' | 'name'>>,
): CustomWorkPlane {
  return {
    kind: 'custom',
    id: metadata.id ?? 'custom-work-plane',
    name: metadata.name ?? 'Custom work plane',
    origin: { ...basis.origin },
    u: { ...basis.u },
    v: { ...basis.v },
    normal: { ...basis.normal },
    source: metadata.source,
  }
}

function chooseAuxiliaryAxis(normal: Vec3): Vec3 {
  const candidates: Vec3[] = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ]

  return candidates.reduce((best, candidate) =>
    Math.abs(dot(candidate, normal)) < Math.abs(dot(best, normal))
      ? candidate
      : best,
  )
}

function axisAlignedBasis(
  plane: AxisAlignedWorkPlaneName,
  offset: number,
): WorkPlaneBasis {
  switch (plane) {
    case 'xy':
      return {
        origin: { x: 0, y: 0, z: offset },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      }
    case 'xz':
      return {
        origin: { x: 0, y: offset, z: 0 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 1 },
        normal: { x: 0, y: -1, z: 0 },
      }
    case 'yz':
      return {
        origin: { x: offset, y: 0, z: 0 },
        u: { x: 0, y: 1, z: 0 },
        v: { x: 0, y: 0, z: 1 },
        normal: { x: 1, y: 0, z: 0 },
      }
  }
}

function legacyAxisAlignedOffset(workPlane: LegacyAxisAlignedWorkPlane): number {
  switch (workPlane.kind) {
    case 'xy':
      return workPlane.z
    case 'xz':
      return workPlane.y
    case 'yz':
      return workPlane.x
  }
}

function validateFiniteNumber(
  value: number,
  path: string,
  errors: WorkPlaneValidationIssue[],
): void {
  if (!Number.isFinite(value)) {
    errors.push({ path, message: 'Value must be finite.' })
  }
}

function validateFiniteVec3(
  value: Vec3,
  path: string,
  errors: WorkPlaneValidationIssue[],
): void {
  if (!isFiniteVec3(value)) {
    errors.push({ path, message: 'Vector coordinates must be finite.' })
  }
}

function validateUnitVector(
  vector: Vec3,
  path: string,
  epsilon: number,
  errors: WorkPlaneValidationIssue[],
): void {
  const length = norm(vector)

  if (Math.abs(length - 1) > epsilon) {
    errors.push({ path, message: 'Vector must be normalized.' })
  }
}

function validateOrthogonal(
  first: Vec3,
  second: Vec3,
  firstPath: string,
  secondPath: string,
  epsilon: number,
  errors: WorkPlaneValidationIssue[],
): void {
  if (Math.abs(dot(first, second)) > epsilon) {
    errors.push({
      path: `${firstPath}.${secondPath}`,
      message: 'Basis vectors must be orthogonal.',
    })
  }
}

function validationResult(
  errors: WorkPlaneValidationIssue[],
): WorkPlaneValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  }
}

function assertFiniteVec3(value: Vec3, path: string): void {
  if (!isFiniteVec3(value)) {
    throw new Error(`${path} must have finite coordinates.`)
  }
}

function assertFiniteNumber(value: number, path: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${path} must be finite.`)
  }
}
