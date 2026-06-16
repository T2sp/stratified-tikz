import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizePointForAmbientDimension,
  projectModelToScreen,
  projectVec3,
  screenToModel2D,
  screenToModelOnWorkPlane,
} from '../../src/geometry/projection.ts'
import { constructWorkPlaneFromThreePoints } from '../../src/geometry/workPlane.ts'
import type { Camera2D, Camera3D, Vec2, Vec3 } from '../../src/model/types.ts'

const camera2D: Camera2D = {
  mode: '2d',
  scale: 10,
  origin: { x: 100, y: 50 },
}

const camera3D: Camera3D = {
  mode: '3d',
  projection: 'orthographic',
  xVector: [1, 0],
  yVector: [0.5, 0.25],
  zVector: [0, 1],
  scale: 10,
  origin: { x: 100, y: 50 },
}

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

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-10,
    `Expected ${actual} to be approximately ${expected}.`,
  )
}
