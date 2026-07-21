import {
  addVec3,
  isFiniteVec3,
  scaleVec3,
  subtractVec3,
} from './workPlane.ts'
import { isValidWorkPlaneFrameSnapshot } from './bezierControls.ts'
import {
  arcScalarPreviewValue,
  arcSegmentExpectedEnd,
  arcSegmentExpectedStart,
  areSegmentsComposable,
  pathEndpointEpsilon,
  pathEndpoints,
  pathPointAt,
  reverseBoundaryPathSnapshot,
} from '../model/paths.ts'
import {
  coonsPatchBoundaryRoles,
  coonsPatchRequiredCornerEquations,
  isCoonsPatchBoundarySources,
  isValidCoonsBoundarySnapshotState,
} from '../model/types.ts'
import type {
  ArcPathSegment,
  BoundaryPathSnapshot,
  CoonsBoundarySnapshot,
  CoonsConstantPointBoundarySnapshot,
  CoonsPatchPrimitive,
  CoonsPatchBoundaryRole,
  CoonsPatchCornerEquationStatus,
  CurvedSheetPrimitive,
  HemisphereCurvedSheetPrimitive,
  PathSegment,
  RuledSurfacePrimitive,
  SaddleCurvedSheetPrimitive,
  SurfaceFrame,
  SurfaceSampling,
  Vec3,
} from '../model/types.ts'

export const MAX_CURVED_SHEET_SAMPLING_SEGMENTS = 64
export const MAX_BOUNDARY_SURFACE_SAMPLING_SEGMENTS =
  MAX_CURVED_SHEET_SAMPLING_SEGMENTS

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

export function validateBoundaryPathSnapshot(
  snapshot: unknown,
  path = 'boundary',
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  if (!isRecord(snapshot)) {
    pushError(errors, path, 'Boundary path snapshot must be an object.')
    return validationResult(errors)
  }

  if (
    snapshot.id !== undefined &&
    (typeof snapshot.id !== 'string' || snapshot.id.trim().length === 0)
  ) {
    pushError(errors, `${path}.id`, 'Boundary path snapshot id must be non-empty.')
  }

  if (
    snapshot.name !== undefined &&
    (typeof snapshot.name !== 'string' || snapshot.name.trim().length === 0)
  ) {
    pushError(
      errors,
      `${path}.name`,
      'Boundary path snapshot name must be non-empty.',
    )
  }

  if (!Array.isArray(snapshot.segments)) {
    pushError(errors, `${path}.segments`, 'Boundary path segments must be an array.')
    return validationResult(errors)
  }

  if (snapshot.segments.length === 0) {
    pushError(
      errors,
      `${path}.segments`,
      'Boundary path snapshots must have at least one segment.',
    )
    return validationResult(errors)
  }

  snapshot.segments.forEach((segment, index) => {
    validateBoundaryPathSegment(segment, `${path}.segments[${index}]`, errors)
  })

  if (
    snapshot.segments.every(isBoundaryPathSegment) &&
    !areSegmentsComposable(snapshot.segments, pathEndpointEpsilon)
  ) {
    pushError(
      errors,
      `${path}.segments`,
      'Boundary path segment endpoints must match consecutively.',
    )
  }

  return validationResult(errors)
}

export function validateCoonsBoundarySnapshot(
  snapshot: unknown,
  path = 'boundary',
): SurfaceValidationResult {
  if (isCoonsConstantPointBoundaryRecord(snapshot)) {
    return validateCoonsConstantPointBoundarySnapshot(snapshot, path)
  }

  return validateBoundaryPathSnapshot(snapshot, path)
}

export function isBoundaryPathClosed(
  snapshot: unknown,
  epsilon = pathEndpointEpsilon,
): boolean {
  const endpoints = boundaryPathSnapshotEndpoints(snapshot)

  return endpoints === null
    ? false
    : vec3ApproximatelyEqual(endpoints.start, endpoints.end, epsilon)
}

export function isBoundaryPathOpen(
  snapshot: unknown,
  epsilon = pathEndpointEpsilon,
): boolean {
  const endpoints = boundaryPathSnapshotEndpoints(snapshot)

  return endpoints === null
    ? false
    : !vec3ApproximatelyEqual(endpoints.start, endpoints.end, epsilon)
}

export function evaluateBoundaryPathAt(
  snapshot: BoundaryPathSnapshot,
  parameter: number,
): Vec3 {
  const point = pathPointAt(snapshot.segments, parameter, 3)

  if (point === null || !isFiniteVec3(point)) {
    throw new Error('Boundary path evaluation produced a non-finite point.')
  }

  return point
}

export function sampleBoundaryPath(
  snapshot: BoundaryPathSnapshot,
  segments: number,
): Vec3[] {
  assertValidSegmentCount(segments, 'segments')

  return Array.from({ length: segments + 1 }, (_, index) =>
    evaluateBoundaryPathAt(snapshot, index / segments),
  )
}

export function boundaryStart(boundary: CoonsBoundarySnapshot): Vec3 {
  return boundaryEndpoint(boundary, 'start')
}

export function boundaryEnd(boundary: CoonsBoundarySnapshot): Vec3 {
  return boundaryEndpoint(boundary, 'end')
}

export function evaluateBoundary(
  boundary: CoonsBoundarySnapshot,
  parameter: number,
): Vec3 {
  if (isCoonsConstantPointBoundarySnapshot(boundary)) {
    return cloneVec3(boundary.point)
  }

  return evaluateBoundaryPathAt(boundary, parameter)
}

export function sampleBoundary(
  boundary: CoonsBoundarySnapshot,
  segments: number,
): Vec3[] {
  assertValidSegmentCount(segments, 'segments')

  if (isCoonsConstantPointBoundarySnapshot(boundary)) {
    return Array.from({ length: segments + 1 }, () => cloneVec3(boundary.point))
  }

  return sampleBoundaryPath(boundary, segments)
}

export function reverseBoundary(
  boundary: CoonsBoundarySnapshot,
): CoonsBoundarySnapshot {
  if (isCoonsConstantPointBoundarySnapshot(boundary)) {
    return cloneCoonsConstantPointBoundarySnapshot(boundary)
  }

  return reverseBoundaryPathSnapshot(boundary)
}

export function coonsPatchCornerEquationStatusesFromBoundaries(
  boundaries: Record<CoonsPatchBoundaryRole, CoonsBoundarySnapshot>,
): CoonsPatchCornerEquationStatus[] {
  return coonsPatchRequiredCornerEquations.map((equation) => {
    const leftPoint = boundaryEndpoint(
      boundaries[equation.leftRole],
      equation.leftEndpoint,
    )
    const rightPoint = boundaryEndpoint(
      boundaries[equation.rightRole],
      equation.rightEndpoint,
    )

    return {
      ...equation,
      matches: vec3ApproximatelyEqual(
        leftPoint,
        rightPoint,
        pathEndpointEpsilon,
      ),
      leftPoint,
      rightPoint,
    }
  })
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
    case 'ruledSurface':
      validateRuledSurfacePrimitive(primitive, path, errors)
      break
    case 'coonsPatch':
      validateCoonsPatchPrimitive(primitive, path, errors)
      break
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Curved sheet primitive kind must be hemisphere, saddle, ruledSurface, or coonsPatch.',
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
    case 'ruledSurface':
      return {
        u: {
          min: 0,
          max: 1,
          closed:
            isBoundaryPathClosed(primitive.boundary0) &&
            isBoundaryPathClosed(primitive.boundary1),
        },
        v: { min: 0, max: 1, closed: false },
      }
    case 'coonsPatch':
      return {
        u: { min: 0, max: 1, closed: false },
        v: { min: 0, max: 1, closed: false },
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

export function sampleRuledSurface(
  primitive: RuledSurfacePrimitive,
): SurfaceSampleMesh {
  assertValidPrimitive(primitive)
  const boundary0 = sampleBoundaryPath(
    primitive.boundary0,
    primitive.sampling.segments,
  )
  const boundary1 = sampleBoundaryPath(
    primitive.boundary1,
    primitive.sampling.segments,
  )
  const mesh = sampleMesh(
    {
      uSegments: primitive.sampling.segments,
      vSegments: 1,
    },
    (uIndex, vIndex) => {
      const v = vIndex

      return addVec3(
        scaleVec3(boundary0[uIndex], 1 - v),
        scaleVec3(boundary1[uIndex], v),
      )
    },
  )

  assertFiniteMesh(mesh)
  return mesh
}

export function sampleCoonsPatch(
  primitive: CoonsPatchPrimitive,
): SurfaceSampleMesh {
  assertValidPrimitive(primitive)
  const bottom = sampleBoundary(primitive.bottom, primitive.sampling.uSegments)
  const top = sampleBoundary(primitive.top, primitive.sampling.uSegments)
  const left = sampleBoundary(primitive.left, primitive.sampling.vSegments)
  const right = sampleBoundary(primitive.right, primitive.sampling.vSegments)
  const bottomLeft = bottom[0]
  const bottomRight = bottom[bottom.length - 1]
  const topLeft = top[0]
  const topRight = top[top.length - 1]
  const mesh = sampleMesh(primitive.sampling, (uIndex, vIndex) => {
    const u = uIndex / primitive.sampling.uSegments
    const v = vIndex / primitive.sampling.vSegments
    const boundaryBlend = addVec3(
      addVec3(scaleVec3(bottom[uIndex], 1 - v), scaleVec3(top[uIndex], v)),
      addVec3(scaleVec3(left[vIndex], 1 - u), scaleVec3(right[vIndex], u)),
    )
    const bilinearCornerBlend = addVec3(
      addVec3(
        scaleVec3(bottomLeft, (1 - u) * (1 - v)),
        scaleVec3(bottomRight, u * (1 - v)),
      ),
      addVec3(scaleVec3(topLeft, (1 - u) * v), scaleVec3(topRight, u * v)),
    )

    return subtractVec3(boundaryBlend, bilinearCornerBlend)
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
    case 'ruledSurface':
      return sampleRuledSurface(primitive)
    case 'coonsPatch':
      return sampleCoonsPatch(primitive)
  }
}

export function surfaceBoundaryPolylines(
  primitive: CurvedSheetPrimitive,
): Vec3[][] {
  const mesh = sampleCurvedSheetPrimitive(primitive)

  return surfaceBoundaryPolylinesFromMesh(primitive, mesh)
}

export function surfaceBoundaryPolylinesFromMesh(
  primitive: CurvedSheetPrimitive,
  mesh: SurfaceSampleMesh,
): Vec3[][] {
  switch (primitive.kind) {
    case 'hemisphere':
      return [meshRow(mesh, mesh.vSegments)]
    case 'saddle':
      return [meshPerimeter(mesh)]
    case 'ruledSurface':
      return [meshPerimeter(mesh)]
    case 'coonsPatch':
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

function validateRuledSurfacePrimitive(
  primitive: Record<string, unknown>,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  appendIssues(
    errors,
    validateBoundaryPathSnapshot(primitive.boundary0, `${path}.boundary0`),
  )
  appendIssues(
    errors,
    validateBoundaryPathSnapshot(primitive.boundary1, `${path}.boundary1`),
  )
  appendIssues(
    errors,
    validateRuledSurfaceSampling(primitive.sampling, `${path}.sampling`),
  )

  if (
    isBoundaryPathSnapshot(primitive.boundary0) &&
    isBoundaryPathSnapshot(primitive.boundary1)
  ) {
    const boundary0Closed = isBoundaryPathClosed(primitive.boundary0)
    const boundary1Closed = isBoundaryPathClosed(primitive.boundary1)

    if (boundary0Closed !== boundary1Closed) {
      pushError(
        errors,
        path,
        'Ruled surface boundaries must have the same closure status.',
      )
    }
  }
}

function validateCoonsPatchPrimitive(
  primitive: Record<string, unknown>,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  appendIssues(
    errors,
    validateCoonsBoundarySnapshot(primitive.bottom, `${path}.bottom`),
  )
  appendIssues(
    errors,
    validateCoonsBoundarySnapshot(primitive.right, `${path}.right`),
  )
  appendIssues(
    errors,
    validateCoonsBoundarySnapshot(primitive.top, `${path}.top`),
  )
  appendIssues(
    errors,
    validateCoonsBoundarySnapshot(primitive.left, `${path}.left`),
  )
  appendIssues(
    errors,
    validateSurfaceSampling(primitive.sampling, `${path}.sampling`),
  )
  validateCoonsPatchBoundarySources(
    primitive.boundarySources,
    `${path}.boundarySources`,
    errors,
  )
  validateCoonsPatchBoundarySnapshotState(
    primitive.boundarySnapshotState,
    `${path}.boundarySnapshotState`,
    errors,
  )

  if (
    isCoonsBoundarySnapshot(primitive.bottom) &&
    isCoonsBoundarySnapshot(primitive.right) &&
    isCoonsBoundarySnapshot(primitive.top) &&
    isCoonsBoundarySnapshot(primitive.left)
  ) {
    const boundaries = [
      { role: 'bottom', boundary: primitive.bottom },
      { role: 'right', boundary: primitive.right },
      { role: 'top', boundary: primitive.top },
      { role: 'left', boundary: primitive.left },
    ] as const
    const allBoundariesOpen = boundaries.every(({ role, boundary }) =>
      validateCoonsPatchOpenBoundary(boundary, role, `${path}.${role}`, errors),
    )

    if (allBoundariesOpen) {
      validateCoonsPatchCorners(
        primitive.bottom,
        primitive.right,
        primitive.top,
        primitive.left,
        path,
        errors,
      )
    }
  }
}

function validateCoonsPatchBoundarySnapshotState(
  state: unknown,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  if (!isValidCoonsBoundarySnapshotState(state)) {
    pushError(
      errors,
      path,
      'Coons patch boundary snapshot state must be frozen when present.',
    )
  }
}

function validateRuledSurfaceSampling(
  sampling: unknown,
  path: string,
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  if (!isRecord(sampling)) {
    pushError(errors, path, 'Ruled surface sampling must be an object.')
    return validationResult(errors)
  }

  validateSegmentCount(sampling.segments, `${path}.segments`, errors)

  return validationResult(errors)
}

function validateCoonsPatchCorners(
  bottom: CoonsBoundarySnapshot,
  right: CoonsBoundarySnapshot,
  top: CoonsBoundarySnapshot,
  left: CoonsBoundarySnapshot,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  const boundaries = { bottom, right, top, left }

  coonsPatchCornerEquationStatusesFromBoundaries(boundaries).forEach(
    (status) => {
      if (!status.matches) {
        pushError(
          errors,
          `${path}.${status.leftRole}`,
          `Coons patch corner must match ${path}.${status.rightRole}.`,
        )
      }
    },
  )
}

function validateCoonsPatchBoundarySources(
  sources: unknown,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  if (sources === undefined) {
    return
  }

  if (!isRecord(sources)) {
    pushError(errors, path, 'Coons patch boundary sources must be an object.')
    return
  }

  if (isCoonsPatchBoundarySources(sources)) {
    const pathSourceIds = coonsPatchBoundaryRoles.flatMap((role) => {
      const source = sources[role]
      return source.kind === 'path' ? [source.sourcePathId] : []
    })

    if (new Set(pathSourceIds).size !== pathSourceIds.length) {
      pushError(
        errors,
        path,
        'Linked Coons path sources must use distinct path ids.',
      )
    }
    return
  }

  const pathSourceIds: string[] = []

  coonsPatchBoundaryRoles.forEach((role) => {
    const source = sources[role]
    const sourcePath = `${path}.${role}`

    if (!isRecord(source)) {
      pushError(errors, sourcePath, `Coons patch ${role} source is required.`)
      return
    }

    if (source.kind === 'path') {
      if (
        typeof source.sourcePathId !== 'string' ||
        source.sourcePathId.trim().length === 0
      ) {
        pushError(
          errors,
          `${sourcePath}.sourcePathId`,
          'Linked Coons path source id must be non-empty.',
        )
      } else {
        pathSourceIds.push(source.sourcePathId)
      }

      if (typeof source.reversed !== 'boolean') {
        pushError(
          errors,
          `${sourcePath}.reversed`,
          'Linked Coons path reverse flag must be boolean.',
        )
      }
      return
    }

    if (source.kind === 'point') {
      if (
        typeof source.sourcePointId !== 'string' ||
        source.sourcePointId.trim().length === 0
      ) {
        pushError(
          errors,
          `${sourcePath}.sourcePointId`,
          'Linked Coons point source id must be non-empty.',
        )
      }
      return
    }

    pushError(
      errors,
      `${sourcePath}.kind`,
      'Linked Coons boundary source kind must be path or point.',
    )
  })

  if (new Set(pathSourceIds).size !== pathSourceIds.length) {
    pushError(
      errors,
      path,
      'Linked Coons path sources must use distinct path ids.',
    )
  }
}

function validateCoonsPatchOpenBoundary(
  boundary: CoonsBoundarySnapshot,
  role: 'bottom' | 'right' | 'top' | 'left',
  path: string,
  errors: SurfaceValidationIssue[],
): boolean {
  if (isCoonsConstantPointBoundarySnapshot(boundary)) {
    return true
  }

  if (isBoundaryPathOpen(boundary)) {
    return true
  }

  pushError(errors, path, `Coons patch ${role} boundary must be an open path.`)
  return false
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
    case 'ruledSurface':
      validateRuledSurfacePrimitive(primitive, 'primitive', errors)
      break
    case 'coonsPatch':
      validateCoonsPatchPrimitive(primitive, 'primitive', errors)
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

function validateArcScalarPreview(
  value: unknown,
  path: string,
  label: string,
  errors: SurfaceValidationIssue[],
): number | null {
  const previewValue = arcScalarPreviewValueFromUnknown(value)

  if (!Number.isFinite(previewValue)) {
    pushError(errors, path, `${label} must have a finite preview value.`)
    return null
  }

  return previewValue
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

function validateCoonsConstantPointBoundarySnapshot(
  snapshot: Record<string, unknown>,
  path: string,
): SurfaceValidationResult {
  const errors: SurfaceValidationIssue[] = []

  if (
    snapshot.sourceId !== undefined &&
    (typeof snapshot.sourceId !== 'string' || snapshot.sourceId.trim().length === 0)
  ) {
    pushError(
      errors,
      `${path}.sourceId`,
      'Constant Coons boundary source id must be non-empty.',
    )
  }

  if (
    snapshot.name !== undefined &&
    (typeof snapshot.name !== 'string' || snapshot.name.trim().length === 0)
  ) {
    pushError(
      errors,
      `${path}.name`,
      'Constant Coons boundary name must be non-empty.',
    )
  }

  validateVec3(snapshot.point, `${path}.point`, errors)

  return validationResult(errors)
}

function validateBoundaryPathSegment(
  segment: unknown,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  if (!isRecord(segment)) {
    pushError(errors, path, 'Boundary path segment must be an object.')
    return
  }

  switch (segment.kind) {
    case 'line':
      validateVec3(segment.start, `${path}.start`, errors)
      validateVec3(segment.end, `${path}.end`, errors)
      return
    case 'cubicBezier':
      validateVec3(segment.start, `${path}.start`, errors)
      validateVec3(segment.control1, `${path}.control1`, errors)
      validateVec3(segment.control2, `${path}.control2`, errors)
      validateVec3(segment.end, `${path}.end`, errors)
      return
    case 'arc':
      validateBoundaryArcSegment(segment, path, errors)
      return
    default:
      pushError(
        errors,
        `${path}.kind`,
        'Boundary path segment kind must be line, cubicBezier, or arc.',
      )
  }
}

function validateBoundaryArcSegment(
  segment: Record<string, unknown>,
  path: string,
  errors: SurfaceValidationIssue[],
): void {
  validateVec3(segment.start, `${path}.start`, errors)
  validateVec3(segment.end, `${path}.end`, errors)
  validateVec3(segment.center, `${path}.center`, errors)
  const radius = validateArcScalarPreview(
    segment.radius,
    `${path}.radius`,
    'Arc radius',
    errors,
  )
  validateArcScalarPreview(
    segment.startAngleDeg,
    `${path}.startAngleDeg`,
    'Arc start angle',
    errors,
  )
  validateArcScalarPreview(
    segment.endAngleDeg,
    `${path}.endAngleDeg`,
    'Arc end angle',
    errors,
  )

  if (radius !== null && radius <= 0) {
    pushError(errors, `${path}.radius`, 'Arc radius must be positive.')
  }

  if (
    segment.direction !== 'counterclockwise' &&
    segment.direction !== 'clockwise'
  ) {
    pushError(
      errors,
      `${path}.direction`,
      'Arc direction must be counterclockwise or clockwise.',
    )
  }

  if (segment.frame === undefined) {
    pushError(errors, `${path}.frame`, '3D boundary arc segments must store a frame.')
  } else {
    appendIssues(errors, validateSurfaceFrame(segment.frame, `${path}.frame`))
  }

  if (!isBoundaryArcSegment(segment)) {
    return
  }

  const expectedStart = arcSegmentExpectedStart(segment, 3)
  const expectedEnd = arcSegmentExpectedEnd(segment, 3)

  if (!vec3ApproximatelyEqual(segment.start, expectedStart, pathEndpointEpsilon)) {
    pushError(
      errors,
      `${path}.start`,
      'Arc start must match center, radius, and start angle.',
    )
  }

  if (!vec3ApproximatelyEqual(segment.end, expectedEnd, pathEndpointEpsilon)) {
    pushError(
      errors,
      `${path}.end`,
      'Arc end must match center, radius, and end angle.',
    )
  }
}

function isBoundaryPathSnapshot(value: unknown): value is BoundaryPathSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.segments) &&
    value.segments.length > 0 &&
    value.segments.every(isBoundaryPathSegment)
  )
}

function isCoonsBoundarySnapshot(value: unknown): value is CoonsBoundarySnapshot {
  return (
    isBoundaryPathSnapshot(value) || isCoonsConstantPointBoundarySnapshot(value)
  )
}

function isCoonsConstantPointBoundarySnapshot(
  value: unknown,
): value is CoonsConstantPointBoundarySnapshot {
  return (
    isRecord(value) &&
    value.kind === 'constantPoint' &&
    isFiniteBoundaryVec3(value.point)
  )
}

function isCoonsConstantPointBoundaryRecord(
  value: unknown,
): value is Record<string, unknown> {
  return isRecord(value) && value.kind === 'constantPoint'
}

function boundaryPathSnapshotEndpoints(
  snapshot: unknown,
): ReturnType<typeof pathEndpoints> {
  if (!isBoundaryPathSnapshot(snapshot)) {
    return null
  }

  return pathEndpoints(snapshot.segments)
}

function isBoundaryPathSegment(value: unknown): value is PathSegment {
  if (!isRecord(value)) {
    return false
  }

  switch (value.kind) {
    case 'line':
      return isFiniteBoundaryVec3(value.start) && isFiniteBoundaryVec3(value.end)
    case 'cubicBezier':
      return (
        isFiniteBoundaryVec3(value.start) &&
        isFiniteBoundaryVec3(value.control1) &&
        isFiniteBoundaryVec3(value.control2) &&
        isFiniteBoundaryVec3(value.end)
      )
    case 'arc':
      return isBoundaryArcSegment(value)
    default:
      return false
  }
}

function isBoundaryArcSegment(value: Record<string, unknown>): value is ArcPathSegment {
  return (
    value.kind === 'arc' &&
    isFiniteBoundaryVec3(value.start) &&
    isFiniteBoundaryVec3(value.end) &&
    isFiniteBoundaryVec3(value.center) &&
    Number.isFinite(arcScalarPreviewValueFromUnknown(value.radius)) &&
    arcScalarPreviewValueFromUnknown(value.radius) > 0 &&
    Number.isFinite(arcScalarPreviewValueFromUnknown(value.startAngleDeg)) &&
    Number.isFinite(arcScalarPreviewValueFromUnknown(value.endAngleDeg)) &&
    (value.direction === 'counterclockwise' || value.direction === 'clockwise') &&
    value.frame !== undefined &&
    isBoundarySurfaceFrame(value.frame)
  )
}

function arcScalarPreviewValueFromUnknown(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }

  if (!isRecord(value)) {
    return Number.NaN
  }

  if (value.kind === 'numeric' || value.kind === 'symbolic') {
    return arcScalarPreviewValue(
      value as Parameters<typeof arcScalarPreviewValue>[0],
    )
  }

  return Number.NaN
}

function isFiniteBoundaryVec3(value: unknown): value is Vec3 {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    typeof value.z === 'number' &&
    Number.isFinite(value.z)
  )
}

function isBoundarySurfaceFrame(value: unknown): value is SurfaceFrame {
  return (
    isRecord(value) &&
    isFiniteBoundaryVec3(value.origin) &&
    isFiniteBoundaryVec3(value.u) &&
    isFiniteBoundaryVec3(value.v) &&
    isFiniteBoundaryVec3(value.normal) &&
    isValidWorkPlaneFrameSnapshot(value as SurfaceFrame)
  )
}

function assertValidSegmentCount(value: number, path: string): void {
  const errors: SurfaceValidationIssue[] = []
  validateSegmentCount(value, path, errors)

  if (errors.length > 0) {
    throw new Error(
      errors.map((issue) => `${issue.path} ${issue.message}`).join('; '),
    )
  }
}

function boundaryEndpoint(
  boundary: CoonsBoundarySnapshot,
  endpoint: 'start' | 'end',
): Vec3 {
  if (isCoonsConstantPointBoundarySnapshot(boundary)) {
    return cloneVec3(boundary.point)
  }

  const endpoints = pathEndpoints(boundary.segments)

  if (endpoints === null) {
    throw new Error('Boundary path endpoint lookup failed.')
  }

  return cloneVec3(endpoints[endpoint])
}

function cloneCoonsConstantPointBoundarySnapshot(
  boundary: CoonsConstantPointBoundarySnapshot,
): CoonsConstantPointBoundarySnapshot {
  return {
    kind: 'constantPoint',
    ...(boundary.sourceId === undefined ? {} : { sourceId: boundary.sourceId }),
    ...(boundary.name === undefined ? {} : { name: boundary.name }),
    point: cloneVec3(boundary.point),
  }
}

function cloneVec3(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    ...(point.symbolic === undefined
      ? {}
      : {
          symbolic: {
            x: { ...point.symbolic.x },
            y: { ...point.symbolic.y },
            z: { ...point.symbolic.z },
          },
        }),
  }
}

function vec3ApproximatelyEqual(
  first: Vec3,
  second: Vec3,
  epsilon: number,
): boolean {
  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon &&
    Math.abs(first.z - second.z) <= epsilon
  )
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
