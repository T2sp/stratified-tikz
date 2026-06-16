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
import type {
  Camera2D,
  Camera3D,
  PerspectiveCamera3D,
  Vec2,
  Vec3,
} from '../../src/model/types.ts'

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

const changedAngleCamera3D: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 70,
  phiDeg: 110,
  zoom: 14,
  pan: { x: 80, y: 45 },
}

const perspectiveCamera3D: PerspectiveCamera3D = {
  mode: '3d',
  kind: 'perspective',
  thetaDeg: 13,
  phiDeg: -23,
  zoom: 1,
  pan: { x: 0, y: 0 },
  target: { x: 0, y: 0, z: 0 },
  distance: 8,
  fieldOfViewDeg: 45,
}

test('initial 3D camera exists and validates', () => {
  const validation = validateCamera3D(INITIAL_CAMERA_3D)

  assert.equal(validation.valid, true)
  assert.equal(validation.structurallyValid, true)
  assert.equal(validation.supported, true)
  assert.equal(validation.kind, 'orthographic')
})

test('initial 3D camera preview aligns with exported tikz-3dplot angles', () => {
  const camera = createInitialCamera3D()
  const point = { x: 2, y: 4, z: 3 }

  assert.equal(camera.projectionBasis, undefined)
  assertVec2AlmostEqual(
    projectVec3WithCamera(point, camera),
    projectWithTikz3dplotCamera(camera, point),
  )
})

test('deprecated projectionBasis does not override theta and phi projection', () => {
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 9,
    pan: { x: 12, y: -8 },
    projectionBasis: {
      xVector: [1, 0],
      yVector: [0.5, 0.25],
      zVector: [0, 1],
    },
  }
  const point = { x: 2, y: 4, z: 3 }

  assertVec2AlmostEqual(
    projectVec3(camera, point),
    projectWithTikz3dplotCamera(camera, point),
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

test('perspective 3D camera scaffold validates structurally but is unsupported', () => {
  const validation = validateCamera3D(perspectiveCamera3D)

  assert.equal(validation.kind, 'perspective')
  assert.equal(validation.structurallyValid, true)
  assert.equal(validation.supported, false)
  assert.equal(validation.valid, false)
  assert.match(
    validation.errors.map((error) => error.message).join(' '),
    /Perspective 3D cameras are recognized but not supported yet/,
  )
})

test('perspective 3D camera scaffold validates perspective-specific fields', () => {
  const validation = validateCamera3D({
    ...perspectiveCamera3D,
    fieldOfViewDeg: 180,
  })

  assert.equal(validation.kind, 'perspective')
  assert.equal(validation.structurallyValid, false)
  assert.equal(validation.supported, false)
  assert.match(
    validation.errors.map((error) => error.message).join(' '),
    /Field of view must be greater than 0 and less than 180 degrees/,
  )
})

test('unsupported perspective projection fails clearly', () => {
  assert.throws(
    () => projectVec3WithCamera({ x: 1, y: 2, z: 3 }, perspectiveCamera3D),
    /SVG projection supports only orthographic 3D cameras/,
  )
})

test('reset helper returns the initial 3D camera', () => {
  const changedCamera = {
    ...createInitialCamera3D(),
    thetaDeg: 80,
    phiDeg: 120,
  }
  const resetCamera = resetCameraToInitial()
  const point = { x: 2, y: 4, z: 3 }

  assert.notDeepEqual(
    projectVec3(changedCamera, point),
    projectVec3(resetCamera, point),
  )
  assert.deepEqual(resetCamera, createInitialCamera3D())
  assert.notEqual(resetCamera, INITIAL_CAMERA_3D)
  assert.equal(resetCamera.projectionBasis, undefined)
  assertVec2AlmostEqual(
    projectVec3(resetCamera, point),
    projectWithTikz3dplotCamera(resetCamera, point),
  )
})

test('projects Vec3 with a 2D camera', () => {
  assertVec2AlmostEqual(
    projectVec3(camera2D, { x: 2, y: -3, z: 9 }),
    { x: 120, y: 20 },
  )
})

test('projects Vec3 with a 3D orthographic camera', () => {
  const point = { x: 2, y: 4, z: 3 }

  assertVec2AlmostEqual(
    projectVec3(camera3D, point),
    projectWithTikz3dplotCamera(camera3D, point),
  )
})

test('projectModelToScreen maps model points without work-plane input', () => {
  const point = { x: 2, y: 4, z: 3 }

  assertVec2AlmostEqual(
    projectModelToScreen(point, camera3D),
    projectWithTikz3dplotCamera(camera3D, point),
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

test('orthographic camera rays are parallel across screen points', () => {
  const firstRay = screenRayFromCameraPoint({ x: 10, y: 20 }, camera3D)
  const secondRay = screenRayFromCameraPoint({ x: 120, y: -40 }, camera3D)

  assertVec3AlmostEqual(firstRay.direction, secondRay.direction)
})

test('unsupported perspective work-plane picking fails clearly', () => {
  assert.throws(
    () => screenRayFromCameraPoint({ x: 0, y: 0 }, perspectiveCamera3D),
    /work-plane picking supports only orthographic 3D cameras/,
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

test('changed camera angles still invert screen input onto the active work plane', () => {
  const workPlane = { kind: 'xz' as const, y: -2 }
  const modelPoint = { x: 1.25, y: -2, z: 3.5 }
  const screenPoint = projectVec3(changedAngleCamera3D, modelPoint)
  const inverted = screenToModelOnWorkPlane(
    screenPoint,
    workPlane,
    changedAngleCamera3D,
  )

  assertVec3AlmostEqual(inverted, modelPoint)
})

test('parallel camera ray and work plane intersection is rejected', () => {
  const frontCamera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 90,
    phiDeg: 0,
    zoom: 10,
    pan: { x: 100, y: 50 },
  }

  assert.throws(
    () =>
      screenToModelOnWorkPlane(
        projectVec3(frontCamera, { x: 1, y: 2, z: 0 }),
        { kind: 'xy', z: 0 },
        frontCamera,
      ),
    /Camera ray is parallel to the work plane/,
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

function projectWithTikz3dplotCamera(camera: Camera3D, point: Vec3): Vec2 {
  const basis = cameraBasisFromTikz3dplotAngles(camera.thetaDeg, camera.phiDeg)

  return {
    x:
      camera.pan.x +
      camera.zoom *
        (point.x * basis.xVector[0] +
          point.y * basis.yVector[0] +
          point.z * basis.zVector[0]),
    y:
      camera.pan.y +
      camera.zoom *
        (point.x * basis.xVector[1] +
          point.y * basis.yVector[1] +
          point.z * basis.zVector[1]),
  }
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
