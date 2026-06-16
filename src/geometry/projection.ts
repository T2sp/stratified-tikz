import type {
  AmbientDimension,
  Camera,
  Camera2D,
  Camera3D,
  Camera3DProjectionBasis,
  Vec2,
  Vec3,
  WorkPlane,
} from '../model/types'
import {
  addVec3,
  cross,
  dot,
  isFiniteVec3,
  normalizeVector,
  scaleVec3,
  subtractVec3,
  workPlaneToBasis,
} from './workPlane.ts'

export type Camera3DValidationIssue = {
  path: string
  message: string
}

export type Camera3DValidationResult = {
  valid: boolean
  errors: Camera3DValidationIssue[]
}

export type Camera3DBasis = Camera3DProjectionBasis & {
  right: Vec3
  up: Vec3
  forward: Vec3
}

export type CameraRay = {
  origin: Vec3
  direction: Vec3
}

export type ScreenRayProjectionInfo =
  | {
      coordinateSpace?: 'view'
    }
  | {
      coordinateSpace: 'svg'
      viewportHeight: number
    }

const projectionRankEpsilon = 1e-10

// Projection is deliberately separate from work-plane geometry. Work planes live
// in model space; camera/projection data only maps model points to screen
// coordinates and screen coordinates back onto a chosen model-space plane.
export function projectModelToScreen(point: Vec3, camera: Camera): Vec2 {
  if (camera.mode === '2d') {
    return {
      x: camera.origin.x + camera.scale * point.x,
      y: camera.origin.y + camera.scale * point.y,
    }
  }

  return projectVec3WithCamera(point, camera)
}

export function projectVec3(camera: Camera, point: Vec3): Vec2 {
  return projectModelToScreen(point, camera)
}

export function validateCamera3D(camera: unknown): Camera3DValidationResult {
  const errors: Camera3DValidationIssue[] = []

  if (!isRecord(camera)) {
    errors.push({
      path: '',
      message: '3D camera must be an object.',
    })
    return validationResult(errors)
  }

  if (camera.mode !== '3d') {
    errors.push({
      path: 'mode',
      message: '3D camera mode must be 3d.',
    })
  }

  if (camera.kind !== 'orthographic') {
    errors.push({
      path: 'kind',
      message: '3D camera kind must be orthographic.',
    })
  }

  validateFiniteNumber(camera.thetaDeg, 'thetaDeg', errors)
  validateFiniteNumber(camera.phiDeg, 'phiDeg', errors)
  validatePositiveFiniteNumber(camera.zoom, 'zoom', errors)
  validateVec2Like(camera.pan, 'pan', errors)

  if (camera.projectionBasis !== undefined) {
    validateProjectionBasis(camera.projectionBasis, 'projectionBasis', errors)
  }

  const thetaDeg = camera.thetaDeg
  const phiDeg = camera.phiDeg

  if (
    errors.length === 0 &&
    camera.projectionBasis === undefined &&
    typeof thetaDeg === 'number' &&
    typeof phiDeg === 'number' &&
    Number.isFinite(thetaDeg) &&
    Number.isFinite(phiDeg)
  ) {
    try {
      cameraBasisFromTikz3dplotAngles(thetaDeg, phiDeg)
    } catch (error) {
      errors.push({
        path: '',
        message:
          error instanceof Error
            ? error.message
            : 'Camera angles produced an invalid basis.',
      })
    }
  }

  return validationResult(errors)
}

export function cameraBasisFromTikz3dplotAngles(
  thetaDeg: number,
  phiDeg: number,
): Camera3DBasis {
  if (!Number.isFinite(thetaDeg)) {
    throw new Error('thetaDeg must be a finite number.')
  }

  if (!Number.isFinite(phiDeg)) {
    throw new Error('phiDeg must be a finite number.')
  }

  const theta = degreesToRadians(thetaDeg)
  const phi = degreesToRadians(phiDeg)
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const right = createVec3(cosPhi, -sinPhi, 0)
  const up = createVec3(sinPhi * sinTheta, cosPhi * sinTheta, cosTheta)
  const forward = normalizeVector(cross(right, up))
  const basis: Camera3DBasis = {
    right,
    up,
    forward,
    xVector: [right.x, up.x],
    yVector: [right.y, up.y],
    zVector: [right.z, up.z],
  }

  if (
    !isFiniteVec3(basis.right) ||
    !isFiniteVec3(basis.up) ||
    !isFiniteVec3(basis.forward) ||
    !isFiniteProjectionBasis(basis)
  ) {
    throw new Error('Camera angles produced a non-finite basis.')
  }

  return basis
}

export function projectVec3WithCamera(point: Vec3, camera: Camera3D): Vec2 {
  assertFiniteVec3(point, 'point')
  assertValidCamera3D(camera)

  const projected = projectVec3ToCameraUnits(camera, point)
  const screenPoint = {
    x: camera.pan.x + camera.zoom * projected.x,
    y: camera.pan.y + camera.zoom * projected.y,
  }

  assertFiniteVec2(screenPoint, 'projected point')

  return screenPoint
}

export function screenRayFromCameraPoint(
  screenPoint: Vec2,
  camera: Camera3D,
  projectionInfo: ScreenRayProjectionInfo = {},
): CameraRay {
  assertFiniteVec2(screenPoint, 'screenPoint')
  assertValidCamera3D(camera)

  const viewPoint = normalizeScreenPointForProjection(screenPoint, projectionInfo)
  const cameraUnits = screenToCameraUnits(camera, viewPoint)
  const basis = projectionBasisFromCamera(camera)
  const rowX = projectionRowX(basis)
  const rowY = projectionRowY(basis)
  const rowDotXX = dot(rowX, rowX)
  const rowDotXY = dot(rowX, rowY)
  const rowDotYY = dot(rowY, rowY)
  const determinant = rowDotXX * rowDotYY - rowDotXY * rowDotXY

  if (!Number.isFinite(determinant) || determinant <= projectionRankEpsilon) {
    throw new Error('Camera projection basis must have rank 2.')
  }

  const first =
    (cameraUnits.x * rowDotYY - cameraUnits.y * rowDotXY) / determinant
  const second =
    (rowDotXX * cameraUnits.y - rowDotXY * cameraUnits.x) / determinant
  const origin = addVec3(scaleVec3(rowX, first), scaleVec3(rowY, second))
  const direction = normalizeVector(cross(rowX, rowY))
  const ray = { origin, direction }

  if (!isFiniteVec3(ray.origin) || !isFiniteVec3(ray.direction)) {
    throw new Error('Camera screen ray must have finite coordinates.')
  }

  return ray
}

export function intersectCameraRayWithWorkPlane(
  ray: CameraRay,
  workPlane: WorkPlane,
): Vec3 {
  assertFiniteVec3(ray.origin, 'ray.origin')
  assertFiniteVec3(ray.direction, 'ray.direction')

  const basis = workPlaneToBasis(workPlane)
  const denominator = dot(ray.direction, basis.normal)

  if (
    !Number.isFinite(denominator) ||
    Math.abs(denominator) <= projectionRankEpsilon
  ) {
    throw new Error('Camera ray is parallel to the work plane.')
  }

  const parameter =
    dot(subtractVec3(basis.origin, ray.origin), basis.normal) / denominator
  const point = addVec3(ray.origin, scaleVec3(ray.direction, parameter))

  if (!isFiniteVec3(point)) {
    throw new Error('Camera ray intersection produced a non-finite point.')
  }

  return point
}

export function screenToModel2D(camera: Camera2D, screenPoint: Vec2): Vec3 {
  assertUsableScale(camera.scale)

  return {
    x: (screenPoint.x - camera.origin.x) / camera.scale,
    y: (screenPoint.y - camera.origin.y) / camera.scale,
    z: 0,
  }
}

export function screenToModelOnWorkPlane(
  screenPoint: Vec2,
  workPlane: WorkPlane,
  camera: Camera,
): Vec3
export function screenToModelOnWorkPlane(
  camera: Camera,
  screenPoint: Vec2,
  workPlane: WorkPlane,
): Vec3
export function screenToModelOnWorkPlane(
  first: Camera | Vec2,
  second: Vec2 | WorkPlane,
  third: WorkPlane | Camera,
): Vec3 {
  const { camera, screenPoint, workPlane } = isCamera(first)
    ? {
        camera: first,
        screenPoint: second as Vec2,
        workPlane: third as WorkPlane,
      }
    : {
        camera: third as Camera,
        screenPoint: first,
        workPlane: second as WorkPlane,
      }

  if (camera.mode === '2d') {
    return screenToModel2D(camera, screenPoint)
  }

  return intersectCameraRayWithWorkPlane(
    screenRayFromCameraPoint(screenPoint, camera),
    workPlane,
  )
}

export function normalizePointForAmbientDimension(
  ambientDimension: AmbientDimension,
  point: Vec3,
): Vec3 {
  return ambientDimension === 2 ? { ...point, z: 0 } : { ...point }
}

function screenToCameraUnits(camera: Camera3D, screenPoint: Vec2): Vec2 {
  return {
    x: (screenPoint.x - camera.pan.x) / camera.zoom,
    y: (screenPoint.y - camera.pan.y) / camera.zoom,
  }
}

function projectVec3ToCameraUnits(camera: Camera3D, point: Vec3): Vec2 {
  const basis = projectionBasisFromCamera(camera)

  return {
    x:
      point.x * basis.xVector[0] +
      point.y * basis.yVector[0] +
      point.z * basis.zVector[0],
    y:
      point.x * basis.xVector[1] +
      point.y * basis.yVector[1] +
      point.z * basis.zVector[1],
  }
}

function projectionBasisFromCamera(camera: Camera3D): Camera3DProjectionBasis {
  return camera.projectionBasis ?? cameraBasisFromTikz3dplotAngles(
    camera.thetaDeg,
    camera.phiDeg,
  )
}

function assertUsableScale(scale: number): void {
  if (!Number.isFinite(scale) || scale === 0) {
    throw new Error('Camera scale must be a finite nonzero number.')
  }
}

function isCamera(value: Camera | Vec2): value is Camera {
  return 'mode' in value
}

function normalizeScreenPointForProjection(
  screenPoint: Vec2,
  projectionInfo: ScreenRayProjectionInfo,
): Vec2 {
  if (
    'coordinateSpace' in projectionInfo &&
    projectionInfo.coordinateSpace === 'svg'
  ) {
    return {
      x: screenPoint.x,
      y: projectionInfo.viewportHeight - screenPoint.y,
    }
  }

  return screenPoint
}

function validateProjectionBasis(
  basis: unknown,
  path: string,
  errors: Camera3DValidationIssue[],
): void {
  if (!isRecord(basis)) {
    errors.push({
      path,
      message: 'Camera projection basis must be an object.',
    })
    return
  }

  validateBasisVectorLike(basis.xVector, `${path}.xVector`, errors)
  validateBasisVectorLike(basis.yVector, `${path}.yVector`, errors)
  validateBasisVectorLike(basis.zVector, `${path}.zVector`, errors)

  if (
    isBasisVectorLike(basis.xVector) &&
    isBasisVectorLike(basis.yVector) &&
    isBasisVectorLike(basis.zVector)
  ) {
    const candidate = {
      xVector: basis.xVector,
      yVector: basis.yVector,
      zVector: basis.zVector,
    }
    const rankVector = cross(
      projectionRowX(candidate),
      projectionRowY(candidate),
    )

    if (
      !isFiniteVec3(rankVector) ||
      dot(rankVector, rankVector) <= projectionRankEpsilon
    ) {
      errors.push({
        path,
        message: 'Camera projection basis must have rank 2.',
      })
    }
  }
}

function validateBasisVectorLike(
  value: unknown,
  path: string,
  errors: Camera3DValidationIssue[],
): void {
  if (!isBasisVectorLike(value)) {
    errors.push({
      path,
      message: 'Camera projection basis vector must contain two finite numbers.',
    })
  }
}

function isBasisVectorLike(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function validateVec2Like(
  value: unknown,
  path: string,
  errors: Camera3DValidationIssue[],
): void {
  if (!isRecord(value)) {
    errors.push({
      path,
      message: 'Camera pan must be an object with finite x and y values.',
    })
    return
  }

  validateFiniteNumber(value.x, `${path}.x`, errors)
  validateFiniteNumber(value.y, `${path}.y`, errors)
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  errors: Camera3DValidationIssue[],
): void {
  if (!Number.isFinite(value)) {
    errors.push({
      path,
      message: 'Value must be a finite number.',
    })
  }
}

function validatePositiveFiniteNumber(
  value: unknown,
  path: string,
  errors: Camera3DValidationIssue[],
): void {
  if (!Number.isFinite(value)) {
    errors.push({
      path,
      message: 'Value must be a finite number.',
    })
    return
  }

  if (typeof value === 'number' && value <= 0) {
    errors.push({
      path,
      message: 'Value must be greater than 0.',
    })
  }
}

function validationResult(
  errors: Camera3DValidationIssue[],
): Camera3DValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  }
}

function assertValidCamera3D(camera: Camera3D): void {
  const validation = validateCamera3D(camera)

  if (!validation.valid) {
    throw new Error(
      `Invalid 3D camera: ${validation.errors
        .map((error) =>
          error.path.length === 0
            ? error.message
            : `${error.path} ${error.message}`,
        )
        .join('; ')}`,
    )
  }
}

function assertFiniteVec2(point: Vec2, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${name} must have finite coordinates.`)
  }
}

function assertFiniteVec3(point: Vec3, name: string): void {
  if (!isFiniteVec3(point)) {
    throw new Error(`${name} must have finite coordinates.`)
  }
}

function projectionRowX(basis: Camera3DProjectionBasis): Vec3 {
  return {
    x: basis.xVector[0],
    y: basis.yVector[0],
    z: basis.zVector[0],
  }
}

function projectionRowY(basis: Camera3DProjectionBasis): Vec3 {
  return {
    x: basis.xVector[1],
    y: basis.yVector[1],
    z: basis.zVector[1],
  }
}

function isFiniteProjectionBasis(basis: Camera3DProjectionBasis): boolean {
  return (
    isFiniteBasisVector(basis.xVector) &&
    isFiniteBasisVector(basis.yVector) &&
    isFiniteBasisVector(basis.zVector)
  )
}

function isFiniteBasisVector(vector: [number, number]): boolean {
  return Number.isFinite(vector[0]) && Number.isFinite(vector[1])
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function createVec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
