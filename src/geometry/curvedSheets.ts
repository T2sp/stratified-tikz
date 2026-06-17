import {
  addVec3,
  isFiniteVec3,
  scaleVec3,
} from './workPlane.ts'
import { isValidWorkPlaneFrameSnapshot } from './bezierControls.ts'
import type {
  CurvedSheetPrimitive,
  HemisphereCurvedSheetPrimitive,
  SaddleCurvedSheetPrimitive,
  SurfaceFrame,
  SurfaceSampling,
  Vec3,
} from '../model/types.ts'

export const MAX_CURVED_SHEET_SAMPLING_SEGMENTS = 64

export type SurfaceParameterInterval = {
  min: number
  max: number
  closed: boolean
}

export type SurfaceParameterDomain = {
  u: SurfaceParameterInterval
  v: SurfaceParameterInterval
}

export type SurfaceSampleMesh = {
  uSegments: number
  vSegments: number
  vertices: Vec3[]
  faces: Array<[number, number, number, number]>
}

export type SurfaceValidationIssue = {
  path: string
  message: string
}

export type SurfaceValidationResult = {
  valid: boolean
  errors: SurfaceValidationIssue[]
}

type MeshPointSampler = (uIndex: number, vIndex: number) => Vec3

export function validateSurfaceFrame(
  frame: unknown,
  path = 'frame',
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  if (!isRecord(frame)) {
    pushError(errors, path, 'Surface frame must be an object.')
    return validationResult(errors)
  }

  const candidate = {
    origin: frame.origin,
    u: frame.u,
    v: frame.v,
    normal: frame.normal,
  }
  const hasFiniteFrame =
    validateVec3(candidate.origin, `${path}.origin`, errors) &&
    validateVec3(candidate.u, `${path}.u`, errors) &&
    validateVec3(candidate.v, `${path}.v`, errors) &&
    validateVec3(candidate.normal, `${path}.normal`, errors)

  if (
    hasFiniteFrame &&
    !isValidWorkPlaneFrameSnapshot(candidate as SurfaceFrame)
  ) {
    pushError(
      errors,
      path,
      'Surface frame must be an orthonormal right-handed frame.',
    )
  }

  return validationResult(errors)
}

export function validateSurfaceSampling(
  sampling: unknown,
  path = 'sampling',
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  if (!isRecord(sampling)) {
    pushError(errors, path, 'Surface sampling must be an object.')
    return validationResult(errors)
  }

  validateSegmentCount(sampling.uSegments, `${path}.uSegments`, errors)
  validateSegmentCount(sampling.vSegments, `${path}.vSegments`, errors)

  return validationResult(errors)
}

export function validateCurvedSheetPrimitive(
  primitive: unknown,
  path = 'primitive',
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  if (!isRecord(primitive)) {
    pushError(errors, path, 'Curved sheet primitive must be an object.')
    return validationResult(errors)
  }

  switch (primitive.kind) {
    case 'hemisphere':
      validateHemispherePrimitive(primitive, path, errors)
      break
    case 'saddle':
      validateSaddlePrimitive(primitive, path, errors)
      break
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Curved sheet primitive kind must be hemisphere or saddle.',
      )
      break
  }

  if (errors.length === 0) {
    try {
      sampleCurvedSheetPrimitive(primitive as CurvedSheetPrimitive)
    } catch (error) {
      pushError(
        errors,
        path,
        error instanceof Error
          ? error.message
          : 'Curved sheet primitive sampling failed.',
      )
    }
  }

  return validationResult(errors)
}

export function isValidCurvedSheetPrimitive(
  primitive: unknown,
): primitive is CurvedSheetPrimitive {
  return validateCurvedSheetPrimitive(primitive).valid
}

export function surfaceParameterDomain(
  primitive: CurvedSheetPrimitive,
): SurfaceParameterDomain {
  switch (primitive.kind) {
    case 'hemisphere':
      return {
        u: { min: 0, max: Math.PI * 2, closed: true },
        v: { min: 0, max: Math.PI / 2, closed: false },
      }
    case 'saddle':
      return {
        u: {
          min: -primitive.width / 2,
          max: primitive.width / 2,
          closed: false,
        },
        v: {
          min: -primitive.depth / 2,
          max: primitive.depth / 2,
          closed: false,
        },
      }
  }
}

export function sampleHemisphere(
  primitive: HemisphereCurvedSheetPrimitive,
): SurfaceSampleMesh {
  assertValidPrimitive(primitive)
  const sideSign = primitive.hemisphereSide === 'positive' ? 1 : -1
  const mesh = sampleMesh(primitive.sampling, (uIndex, vIndex) => {
    const phi = (uIndex / primitive.sampling.uSegments) * Math.PI * 2
    const theta = (vIndex / primitive.sampling.vSegments) * (Math.PI / 2)
    const radialScale = primitive.radius * Math.sin(theta)
    const normalScale = primitive.radius * Math.cos(theta) * sideSign

    return addVec3(
      primitive.center,
      addVec3(
        addVec3(
          scaleVec3(primitive.frame.u, radialScale * Math.cos(phi)),
          scaleVec3(primitive.frame.v, radialScale * Math.sin(phi)),
        ),
        scaleVec3(primitive.frame.normal, normalScale),
      ),
    )
  })

  assertFiniteMesh(mesh)
  return mesh
}

export function sampleSaddle(
  primitive: SaddleCurvedSheetPrimitive,
): SurfaceSampleMesh {
  assertValidPrimitive(primitive)
  const halfWidth = primitive.width / 2
  const halfDepth = primitive.depth / 2
  const mesh = sampleMesh(primitive.sampling, (uIndex, vIndex) => {
    const uRatio = uIndex / primitive.sampling.uSegments
    const vRatio = vIndex / primitive.sampling.vSegments
    const localU = (uRatio - 0.5) * primitive.width
    const localV = (vRatio - 0.5) * primitive.depth
    const normalizedU = halfWidth === 0 ? 0 : localU / halfWidth
    const normalizedV = halfDepth === 0 ? 0 : localV / halfDepth
    const normalOffset = primitive.height * normalizedU * normalizedV

    return addVec3(
      primitive.frame.origin,
      addVec3(
        addVec3(
          scaleVec3(primitive.frame.u, localU),
          scaleVec3(primitive.frame.v, localV),
        ),
        scaleVec3(primitive.frame.normal, normalOffset),
      ),
    )
  })

  assertFiniteMesh(mesh)
  return mesh
}

export function sampleCurvedSheetPrimitive(
  primitive: CurvedSheetPrimitive,
): SurfaceSampleMesh {
  switch (primitive.kind) {
    case 'hemisphere':
      return sampleHemisphere(primitive)
    case 'saddle':
      return sampleSaddle(primitive)
  }
}

export function surfaceBoundaryPolylines(
  primitive: CurvedSheetPrimitive,
): Vec3[][] {
  const mesh = sampleCurvedSheetPrimitive(primitive)

  switch (primitive.kind) {
    case 'hemisphere':
      return [meshRow(mesh, mesh.vSegments)]
    case 'saddle':
      return [meshPerimeter(mesh)]
  }
}

function validateHemispherePrimitive(
  primitive: Record<string, unknown>,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  validateVec3(primitive.center, `${path}.center`, errors)
  validatePositiveFinite(primitive.radius, `${path}.radius`, 'Hemisphere radius', errors)
  appendIssues(errors, validateSurfaceFrame(primitive.frame, `${path}.frame`))

  if (
    primitive.hemisphereSide !== 'positive' &&
    primitive.hemisphereSide !== 'negative'
  ) {
    pushError(
      errors,
      `${path}.hemisphereSide`,
      'Hemisphere side must be positive or negative.',
    )
  }

  appendIssues(
    errors,
    validateSurfaceSampling(primitive.sampling, `${path}.sampling`),
  )
}

function validateSaddlePrimitive(
  primitive: Record<string, unknown>,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  appendIssues(errors, validateSurfaceFrame(primitive.frame, `${path}.frame`))
  validatePositiveFinite(primitive.width, `${path}.width`, 'Saddle width', errors)
  validatePositiveFinite(primitive.depth, `${path}.depth`, 'Saddle depth', errors)
  validateFinite(primitive.height, `${path}.height`, 'Saddle height', errors)
  appendIssues(
    errors,
    validateSurfaceSampling(primitive.sampling, `${path}.sampling`),
  )
}

function sampleMesh(
  sampling: SurfaceSampling,
  pointAt: MeshPointSampler,
): SurfaceSampleMesh {
  const vertices: Vec3[] = []
  const faces: Array<[number, number, number, number]> = []
  const uStride = sampling.uSegments + 1

  for (let vIndex = 0; vIndex <= sampling.vSegments; vIndex += 1) {
    for (let uIndex = 0; uIndex <= sampling.uSegments; uIndex += 1) {
      vertices.push(pointAt(uIndex, vIndex))
    }
  }

  for (let vIndex = 0; vIndex < sampling.vSegments; vIndex += 1) {
    for (let uIndex = 0; uIndex < sampling.uSegments; uIndex += 1) {
      const lowerLeft = vIndex * uStride + uIndex
      faces.push([
        lowerLeft,
        lowerLeft + 1,
        lowerLeft + uStride + 1,
        lowerLeft + uStride,
      ])
    }
  }

  return {
    uSegments: sampling.uSegments,
    vSegments: sampling.vSegments,
    vertices,
    faces,
  }
}

function meshRow(mesh: SurfaceSampleMesh, vIndex: number): Vec3[] {
  const start = vIndex * (mesh.uSegments + 1)

  return mesh.vertices.slice(start, start + mesh.uSegments + 1)
}

function meshPoint(mesh: SurfaceSampleMesh, uIndex: number, vIndex: number): Vec3 {
  return mesh.vertices[vIndex * (mesh.uSegments + 1) + uIndex]
}

function meshPerimeter(mesh: SurfaceSampleMesh): Vec3[] {
  const bottom = meshRow(mesh, 0)
  const right = Array.from({ length: mesh.vSegments }, (_, index) =>
    meshPoint(mesh, mesh.uSegments, index + 1),
  )
  const top = Array.from({ length: mesh.uSegments }, (_, index) =>
    meshPoint(mesh, mesh.uSegments - index - 1, mesh.vSegments),
  )
  const left = Array.from({ length: Math.max(mesh.vSegments - 1, 0) }, (_, index) =>
    meshPoint(mesh, 0, mesh.vSegments - index - 1),
  )

  return [...bottom, ...right, ...top, ...left, bottom[0]]
}

function assertValidPrimitive(primitive: CurvedSheetPrimitive): void {
  const validation = validateCurvedSheetPrimitiveStructure(primitive)

  if (!validation.valid) {
    throw new Error(
      validation.errors.map((issue) => `${issue.path} ${issue.message}`).join('; '),
    )
  }
}

function validateCurvedSheetPrimitiveStructure(
  primitive: CurvedSheetPrimitive,
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  switch (primitive.kind) {
    case 'hemisphere':
      validateHemispherePrimitive(primitive, 'primitive', errors)
      break
    case 'saddle':
      validateSaddlePrimitive(primitive, 'primitive', errors)
      break
  }

  return validationResult(errors)
}

function assertFiniteMesh(mesh: SurfaceSampleMesh): void {
  if (!mesh.vertices.every(isFiniteVec3)) {
    throw new Error('Curved sheet sampling produced non-finite vertices.')
  }
}

function validateSegmentCount(
  value: unknown,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushError(errors, path, 'Surface sampling segment count must be finite.')
    return
  }

  if (!Number.isInteger(value) || value <= 0) {
    pushError(
      errors,
      path,
      'Surface sampling segment count must be a positive integer.',
    )
    return
  }

  if (value > MAX_CURVED_SHEET_SAMPLING_SEGMENTS) {
    pushError(
      errors,
      path,
      `Surface sampling segment count must be at most ${MAX_CURVED_SHEET_SAMPLING_SEGMENTS}.`,
    )
  }
}

function validatePositiveFinite(
  value: unknown,
  path: string,
  label: string,
  errors: SurfaceValidationIssue[],
): void {
  if (validateFinite(value, path, label, errors) && value <= 0) {
    pushError(errors, path, `${label} must be positive.`)
  }
}

function validateFinite(
  value: unknown,
  path: string,
  label: string,
  errors: SurfaceValidationIssue[],
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushError(errors, path, `${label} must be finite.`)
    return false
  }

  return true
}

function validateVec3(
  value: unknown,
  path: string,
  errors: SurfaceValidationIssue[],
): value is Vec3 {
  if (!isRecord(value)) {
    pushError(errors, path, 'Vector must be an object.')
    return false
  }

  const xIsFinite = validateFinite(value.x, `${path}.x`, 'Vector x coordinate', errors)
  const yIsFinite = validateFinite(value.y, `${path}.y`, 'Vector y coordinate', errors)
  const zIsFinite = validateFinite(value.z, `${path}.z`, 'Vector z coordinate', errors)

  return xIsFinite && yIsFinite && zIsFinite
}

function appendIssues(
  errors: SurfaceValidationIssue[],
  validation: SurfaceValidationResult,
): void {
  errors.push(...validation.errors)
}

function validationResult(
  errors: SurfaceValidationIssue[],
): SurfaceValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  }
}

function pushError(
  errors: SurfaceValidationIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
