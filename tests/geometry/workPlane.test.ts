import assert from 'node:assert/strict'
import test from 'node:test'
import {
  axisAlignedWorkPlane,
  constructWorkPlaneFromOriginNormal,
  constructWorkPlaneFromThreePoints,
  cross,
  dot,
  norm,
  pointOnWorkPlane,
  projectPointToWorkPlaneCoordinates,
  validateWorkPlane,
  workPlaneToBasis,
} from '../../src/geometry/workPlane.ts'
import type { Vec3, WorkPlane } from '../../src/model/types.ts'

test('constructs a custom work plane from origin and normal', () => {
  const plane = constructWorkPlaneFromOriginNormal(
    { x: 1, y: 2, z: 3 },
    { x: 0, y: 0, z: 5 },
    { id: 'plane-a', name: 'Plane A' },
  )

  assert.equal(plane.id, 'plane-a')
  assert.equal(plane.name, 'Plane A')
  assert.equal(plane.source.kind, 'originNormal')
  assertVec3AlmostEqual(plane.origin, { x: 1, y: 2, z: 3 })
  assertVec3AlmostEqual(plane.normal, { x: 0, y: 0, z: 1 })
  assert.equal(validateWorkPlane(plane).valid, true)
})

test('rejects a zero normal', () => {
  assert.throws(
    () =>
      constructWorkPlaneFromOriginNormal(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ),
    /zero-length/,
  )
})

test('rejects non-finite origin and normal input', () => {
  assert.throws(
    () =>
      constructWorkPlaneFromOriginNormal(
        { x: Number.NaN, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ),
    /origin must have finite coordinates/,
  )
  assert.throws(
    () =>
      constructWorkPlaneFromOriginNormal(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: Number.POSITIVE_INFINITY, z: 1 },
      ),
    /normal must have finite coordinates/,
  )
})

test('constructs a custom work plane from three points', () => {
  const plane = constructWorkPlaneFromThreePoints(
    { x: 1, y: 1, z: 1 },
    { x: 3, y: 1, z: 1 },
    { x: 1, y: 4, z: 1 },
  )

  assert.equal(plane.source.kind, 'threePoints')
  assertVec3AlmostEqual(plane.origin, { x: 1, y: 1, z: 1 })
  assertVec3AlmostEqual(plane.u, { x: 1, y: 0, z: 0 })
  assertVec3AlmostEqual(plane.v, { x: 0, y: 1, z: 0 })
  assertVec3AlmostEqual(plane.normal, { x: 0, y: 0, z: 1 })
})

test('rejects coincident and collinear three-point input', () => {
  assert.throws(
    () =>
      constructWorkPlaneFromThreePoints(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ),
    /zero-length/,
  )
  assert.throws(
    () =>
      constructWorkPlaneFromThreePoints(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 2, y: 2, z: 2 },
      ),
    /zero-length/,
  )
})

test('constructed custom work planes have an approximate orthonormal basis', () => {
  const plane = constructWorkPlaneFromOriginNormal(
    { x: -1, y: 2, z: 0.5 },
    { x: 2, y: 3, z: 4 },
  )

  assertAlmostEqual(norm(plane.u), 1)
  assertAlmostEqual(norm(plane.v), 1)
  assertAlmostEqual(norm(plane.normal), 1)
  assertAlmostEqual(dot(plane.u, plane.v), 0)
  assertAlmostEqual(dot(plane.u, plane.normal), 0)
  assertAlmostEqual(dot(plane.v, plane.normal), 0)
  assertVec3AlmostEqual(cross(plane.u, plane.v), plane.normal)
})

test('axis-aligned work planes preserve legacy coordinate behavior', () => {
  assertVec3AlmostEqual(
    pointOnWorkPlane({ kind: 'xy', z: 3 }, 2, 4),
    { x: 2, y: 4, z: 3 },
  )
  assertVec3AlmostEqual(
    pointOnWorkPlane(axisAlignedWorkPlane('xz', 5), 2, 4),
    { x: 2, y: 5, z: 4 },
  )
  assertVec3AlmostEqual(
    pointOnWorkPlane(axisAlignedWorkPlane('yz', -1), 2, 4),
    { x: -1, y: 2, z: 4 },
  )
})

test('local-to-global and global-to-local work plane conversion round-trips', () => {
  const plane = constructWorkPlaneFromOriginNormal(
    { x: 1, y: -2, z: 3 },
    { x: 1, y: 1, z: 1 },
  )
  const point = pointOnWorkPlane(plane, 2.5, -1.25)
  const coordinates = projectPointToWorkPlaneCoordinates(point, plane)

  assertAlmostEqual(coordinates.a, 2.5)
  assertAlmostEqual(coordinates.b, -1.25)
  assertVec3AlmostEqual(pointOnWorkPlane(plane, coordinates.a, coordinates.b), point)
})

test('validateWorkPlane rejects invalid custom bases without producing coordinates', () => {
  const invalidPlane: WorkPlane = {
    kind: 'custom',
    id: 'bad-plane',
    name: 'Bad plane',
    origin: { x: 0, y: 0, z: 0 },
    u: { x: 2, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: { kind: 'originNormal' },
  }

  const validation = validateWorkPlane(invalidPlane)

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map((error) => error.message).join('\n'), /normalized/)
  assert.throws(() => workPlaneToBasis(invalidPlane), /Invalid work plane/)
})

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
