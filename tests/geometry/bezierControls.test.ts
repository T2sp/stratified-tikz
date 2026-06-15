import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cubicBezierControlToRelativeCartesian,
  cubicBezierControlToRelativePolar,
  planeCoordinateLabels,
  polarToRelativeCartesian,
  updateCubicBezierControlFromRelativeCartesian,
  updateCubicBezierControlFromRelativePolar,
} from '../../src/geometry/bezierControls.ts'
import type { Vec3, WorkPlane } from '../../src/model/types.ts'

const cubicPoints: [Vec3, Vec3, Vec3, Vec3] = [
  { x: 1, y: 2, z: 3 },
  { x: 4, y: 6, z: 3 },
  { x: 6, y: 8, z: 3 },
  { x: 10, y: 2, z: 3 },
]

test('2D relative Bezier controls use xy offsets and force z to zero', () => {
  const workPlane: WorkPlane = { kind: 'xz', y: 7 }
  const relative = cubicBezierControlToRelativeCartesian(
    cubicPoints,
    1,
    2,
    workPlane,
  )
  const updated = updateCubicBezierControlFromRelativeCartesian(
    cubicPoints,
    1,
    { u: 2, v: -3 },
    2,
    workPlane,
  )

  assert.deepEqual(relative, { u: 3, v: 4 })
  assert.deepEqual(updated[1], { x: 3, y: -1, z: 0 })
})

test('3D relative Bezier controls use active work-plane axes', () => {
  const xzPlane: WorkPlane = { kind: 'xz', y: 0 }
  const yzPlane: WorkPlane = { kind: 'yz', x: 0 }

  assert.deepEqual(planeCoordinateLabels(3, xzPlane), { u: 'x', v: 'z' })
  assert.deepEqual(planeCoordinateLabels(3, yzPlane), { u: 'y', v: 'z' })
  assert.deepEqual(
    cubicBezierControlToRelativeCartesian(cubicPoints, 2, 3, xzPlane),
    { u: -4, v: 0 },
  )
  assert.deepEqual(
    cubicBezierControlToRelativeCartesian(cubicPoints, 2, 3, yzPlane),
    { u: 6, v: 0 },
  )
})

test('relative Bezier control point 2 is anchored at the end point', () => {
  const updated = updateCubicBezierControlFromRelativeCartesian(
    cubicPoints,
    2,
    { u: -2, v: 5 },
    3,
    { kind: 'xy', z: 0 },
  )

  assert.deepEqual(updated[2], { x: 8, y: 7, z: 3 })
  assert.deepEqual(updated[0], cubicPoints[0])
  assert.deepEqual(updated[3], cubicPoints[3])
})

test('polar Bezier controls round-trip through plane coordinates', () => {
  const polar = cubicBezierControlToRelativePolar(
    cubicPoints,
    1,
    3,
    { kind: 'xy', z: 0 },
  )
  const updated = updateCubicBezierControlFromRelativePolar(
    cubicPoints,
    1,
    { angleDegrees: 90, radius: 2 },
    3,
    { kind: 'xy', z: 0 },
  )

  assert.equal(polar?.radius, 5)
  assert.equal(polar?.angleDegrees, 53.13010235415598)
  assert.deepEqual(polarToRelativeCartesian({ angleDegrees: 0, radius: 3 }), {
    u: 3,
    v: 0,
  })
  assert.ok(Math.abs(updated[1].x - 1) < 1e-12)
  assert.ok(Math.abs(updated[1].y - 4) < 1e-12)
})

test('polar Bezier control radius is nonnegative when applied', () => {
  const updated = updateCubicBezierControlFromRelativePolar(
    cubicPoints,
    1,
    { angleDegrees: 0, radius: -10 },
    3,
    { kind: 'xy', z: 0 },
  )

  assert.deepEqual(updated[1], cubicPoints[0])
})
