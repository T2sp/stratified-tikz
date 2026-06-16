import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cameraBasisFromTikz3dplotAngles,
  intersectCameraRayWithWorkPlane,
  normalizePointForAmbientDimension,
  projectModelToScreen,
  projectVec3WithCamera,
  projectVec3,
  screenRayFromCameraPoint,
  screenToModel2D,
  screenToModelOnWorkPlane,
  validateCamera3D,
} from '../../src/geometry/projection.ts'
import {
  constructWorkPlaneFromThreePoints,
  dot,
  norm,
} from '../../src/geometry/workPlane.ts'
import {
  createInitialCamera3D,
  INITIAL_CAMERA_3D,
  resetCameraToInitial,
} from '../../src/model/camera.ts'
import type { Camera2D, Camera3D, Vec2, Vec3 } from '../../src/model/types.ts'

const camera2D: Camera2D = {
  mode: '2d',
  scale: 10,
  origin: { x: 100, y: 50 },
}

const camera3D: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 13,
  phiDeg: -23,
  zoom: 10,
  pan: { x: 100, y: 50 },
  projectionBasis: {
    xVector: [1, 0],
    yVector: [0.5, 0.25],
    zVector: [0, 1],
  },
}

test('initial 3D camera exists and validates', () => {
  assert.equal(validateCamera3D(INITIAL_CAMERA_3D).valid, true)
})

test('initial 3D camera reproduces the previous default projection', () => {
  assertVec2AlmostEqual(
    projectVec3WithCamera({ x: 2, y: 4, z: 3 }, createInitialCamera3D()),
    { x: 3.8, y: 4 },
  )
})

test('tikz-3dplot thetaDeg and phiDeg produce finite basis vectors', () => {
  const basis = cameraBasisFromTikz3dplotAngles(70, 110)
  const vectors = [
    basis.right,
    basis.up,
    basis.forward,
    { x: basis.xVector[0], y: basis.xVector[1], z: 0 },
    { x: basis.yVector[0], y: basis.yVector[1], z: 0 },
    { x: basis.zVector[0], y: basis.zVector[1], z: 0 },
  ]

  assert.equal(
    vectors.every(
      (vector) =>
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z),
    ),
    true,
  )
})

test('tikz-3dplot basis matches formulas for non-axis-aligned angles', () => {
  assertTikz3dplotBasis(60, 30)
})

test('tikz-3dplot basis matches formulas for simple axis angles', () => {
  assertTikz3dplotBasis(90, 0)
})

test('tikz-3dplot camera basis is orthonormal in model space', () => {
  const basis = cameraBasisFromTikz3dplotAngles(70, 110)

  assertAlmostEqual(norm(basis.right), 1)
  assertAlmostEqual(norm(basis.up), 1)
  assertAlmostEqual(norm(basis.forward), 1)
  assertAlmostEqual(dot(basis.right, basis.up), 0)
  assertAlmostEqual(dot(basis.right, basis.forward), 0)
  assertAlmostEqual(dot(basis.up, basis.forward), 0)
})

test('projection of finite Vec3 with a valid 3D camera is finite', () => {
  const projected = projectVec3WithCamera(
    { x: 1.5, y: -2.25, z: 3.75 },
    {
      mode: '3d',
      kind: 'orthographic',
      thetaDeg: 70,
      phiDeg: 110,
      zoom: 12,
      pan: { x: 100, y: 50 },
    },
  )

  assert.equal(Number.isFinite(projected.x), true)
  assert.equal(Number.isFinite(projected.y), true)
})

test('invalid 3D camera values are rejected', () => {
  const valid = createInitialCamera3D()
  const invalidCameras: Camera3D[] = [
    { ...valid, thetaDeg: Number.NaN },
    { ...valid, phiDeg: Number.POSITIVE_INFINITY },
    { ...valid, zoom: 0 },
    { ...valid, zoom: -1 },
    { ...valid, pan: { x: Number.NaN, y: 0 } },
  ]

  invalidCameras.forEach((camera) => {
    assert.equal(validateCamera3D(camera).valid, false)
  })
})

test('reset helper returns the initial 3D camera', () => {
  const resetCamera = resetCameraToInitial()

  assert.deepEqual(resetCamera, createInitialCamera3D())
  assert.notEqual(resetCamera, INITIAL_CAMERA_3D)
  assert.ok(resetCamera.projectionBasis !== undefined)
  assert.deepEqual(resetCamera.projectionBasis, INITIAL_CAMERA_3D.projectionBasis)
  assert.notEqual(resetCamera.projectionBasis, INITIAL_CAMERA_3D.projectionBasis)
})

test('projects Vec3 with a 2D camera', () => {
  assertVec2AlmostEqual(
    projectVec3(camera2D, { x: 2, y: -3, z: 9 }),
    { x: 120, y: 20 },
  )
})

test('projects Vec3 with a 3D orthographic camera', () => {
  assertVec2AlmostEqual(
    projectVec3(camera3D, { x: 2, y: 4, z: 3 }),
    { x: 140, y: 90 },
  )
})

test('projectModelToScreen maps model points without work-plane input', () => {
  assertVec2AlmostEqual(
    projectModelToScreen({ x: 2, y: 4, z: 3 }, camera3D),
    { x: 140, y: 90 },
  )
})

test('converts screen coordinates to model coordinates in 2D', () => {
  assertVec3AlmostEqual(
    screenToModel2D(camera2D, { x: 120, y: 20 }),
    { x: 2, y: -3, z: 0 },
  )
})

test('converts cursor input on an xy work plane', () => {
  const modelPoint = { x: 2, y: 4, z: 3 }
  const screenPoint = projectVec3(camera3D, modelPoint)

  assertVec3AlmostEqual(
    screenToModelOnWorkPlane(screenPoint, { kind: 'xy', z: 3 }, camera3D),
    modelPoint,
  )
})

test('converts cursor input on an xz work plane', () => {
  const modelPoint = { x: 2, y: 4, z: 3 }
  const screenPoint = projectVec3(camera3D, modelPoint)

  assertVec3AlmostEqual(
    screenToModelOnWorkPlane(screenPoint, { kind: 'xz', y: 4 }, camera3D),
    modelPoint,
  )
})

test('converts cursor input on a yz work plane', () => {
  const modelPoint = { x: 2, y: 4, z: 3 }
  const screenPoint = projectVec3(camera3D, modelPoint)

  assertVec3AlmostEqual(
    screenToModelOnWorkPlane(screenPoint, { kind: 'yz', x: 2 }, camera3D),
    modelPoint,
  )
})

test('converts cursor input on a custom work plane', () => {
  const workPlane = constructWorkPlaneFromThreePoints(
    { x: 1, y: 0, z: 1 },
    { x: 3, y: 0, z: 1 },
    { x: 1, y: 2, z: 3 },
  )
  const modelPoint = { x: 2.5, y: 1.25, z: 2.25 }
  const screenPoint = projectVec3(camera3D, modelPoint)

  assertVec3AlmostEqual(
    screenToModelOnWorkPlane(screenPoint, workPlane, camera3D),
    modelPoint,
  )
})

test('camera ray intersects a work plane at the projected model point', () => {
  const workPlane = { kind: 'xy' as const, z: 3 }
  const modelPoint = { x: 2, y: 4, z: 3 }
  const screenPoint = projectVec3(camera3D, modelPoint)

  assertVec3AlmostEqual(
    intersectCameraRayWithWorkPlane(
      screenRayFromCameraPoint(screenPoint, camera3D),
      workPlane,
    ),
    modelPoint,
  )
})

test('converts cursor input with a 2D camera to z = 0', () => {
  assertVec3AlmostEqual(
    screenToModelOnWorkPlane({ x: 120, y: 20 }, { kind: 'xy', z: 12 }, camera2D),
    { x: 2, y: -3, z: 0 },
  )
})

test('keeps legacy camera-first work-plane projection calls compatible', () => {
  const modelPoint = { x: 2, y: 4, z: 3 }
  const screenPoint = projectVec3(camera3D, modelPoint)

  assertVec3AlmostEqual(
    screenToModelOnWorkPlane(camera3D, screenPoint, { kind: 'xy', z: 3 }),
    modelPoint,
  )
})

test('normalizes z to 0 in 2D mode', () => {
  assertVec3AlmostEqual(
    normalizePointForAmbientDimension(2, { x: 1, y: 2, z: 99 }),
    { x: 1, y: 2, z: 0 },
  )
})

test('preserves z in 3D mode', () => {
  assertVec3AlmostEqual(
    normalizePointForAmbientDimension(3, { x: 1, y: 2, z: 99 }),
    { x: 1, y: 2, z: 99 },
  )
})

function assertVec2AlmostEqual(actual: Vec2, expected: Vec2): void {
  assertAlmostEqual(actual.x, expected.x)
  assertAlmostEqual(actual.y, expected.y)
}

function assertVec3AlmostEqual(actual: Vec3, expected: Vec3): void {
  assertAlmostEqual(actual.x, expected.x)
  assertAlmostEqual(actual.y, expected.y)
  assertAlmostEqual(actual.z, expected.z)
}

function assertTikz3dplotBasis(thetaDeg: number, phiDeg: number): void {
  const theta = degreesToRadians(thetaDeg)
  const phi = degreesToRadians(phiDeg)
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const basis = cameraBasisFromTikz3dplotAngles(thetaDeg, phiDeg)

  assertBasisVectorAlmostEqual(basis.xVector, [
    cosPhi,
    -cosTheta * sinPhi,
  ])
  assertBasisVectorAlmostEqual(basis.yVector, [
    sinPhi,
    cosTheta * cosPhi,
  ])
  assertBasisVectorAlmostEqual(basis.zVector, [0, sinTheta])
  assertVec3AlmostEqual(basis.right, {
    x: cosPhi,
    y: sinPhi,
    z: 0,
  })
  assertVec3AlmostEqual(basis.up, {
    x: -cosTheta * sinPhi,
    y: cosTheta * cosPhi,
    z: sinTheta,
  })
}

function assertBasisVectorAlmostEqual(
  actual: [number, number],
  expected: [number, number],
): void {
  assertAlmostEqual(actual[0], expected[0])
  assertAlmostEqual(actual[1], expected[1])
}

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-10,
    `Expected ${actual} to be approximately ${expected}.`,
  )
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
