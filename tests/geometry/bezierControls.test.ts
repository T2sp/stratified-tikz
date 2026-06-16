import assert from 'node:assert/strict'
import test from 'node:test'
import {
  absoluteCubicBezierPointsFromControlMode,
  pointFromWorkPlaneLocalCoordinate,
  relativeCartesianControlModeFromPoints,
  relativePolarControlModeFromPoints,
  workPlaneLocalCoordinateFromPoint,
} from '../../src/geometry/bezierControls.ts'
import type {
  CubicBezierControlMode,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'

test('relative Cartesian Bezier controls convert to absolute points from start and end', () => {
  const controlMode: CubicBezierControlMode = {
    kind: 'relativeCartesian',
    firstControlOffset: { x: 1, y: 2, z: 0 },
    secondControlOffset: { x: -3, y: 4, z: 0 },
    secondOffsetReference: 'end',
  }
  const points = absoluteCubicBezierPointsFromControlMode(
    2,
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 10, z: 0 },
    controlMode,
  )

  assert.deepEqual(points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 7, y: 14, z: 0 },
    { x: 10, y: 10, z: 0 },
  ])
})

test('relative polar Bezier controls convert to absolute 2D points from start and end', () => {
  const controlMode: CubicBezierControlMode = {
    kind: 'relativePolar',
    firstControl: { angleDegrees: 0, radius: 2 },
    secondControl: { angleDegrees: 90, radius: 3 },
    secondOffsetReference: 'end',
  }
  const points = absoluteCubicBezierPointsFromControlMode(
    2,
    { x: 1, y: 1, z: 0 },
    { x: 5, y: 5, z: 0 },
    controlMode,
  )

  assert.notEqual(points, null)
  assert.deepEqual(points?.[1], { x: 3, y: 1, z: 0 })
  assert.ok(Math.abs((points?.[2].x ?? 0) - 5) < 1e-9)
  assert.ok(Math.abs((points?.[2].y ?? 0) - 8) < 1e-9)
})

test('relative polar Bezier controls reject negative radius and non-finite values', () => {
  assert.equal(
    absoluteCubicBezierPointsFromControlMode(
      2,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      {
        kind: 'relativePolar',
        firstControl: { angleDegrees: 0, radius: -1 },
        secondControl: { angleDegrees: 90, radius: 1 },
        secondOffsetReference: 'end',
      },
    ),
    null,
  )
  assert.equal(
    absoluteCubicBezierPointsFromControlMode(
      2,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      {
        kind: 'relativePolar',
        firstControl: { angleDegrees: Number.NaN, radius: 1 },
        secondControl: { angleDegrees: 90, radius: 1 },
        secondOffsetReference: 'end',
      },
    ),
    null,
  )
})

test('relative Bezier control modes can be derived from absolute points', () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 2, y: 0, z: 0 },
  ]

  assert.deepEqual(relativeCartesianControlModeFromPoints(2, points), {
    kind: 'relativeCartesian',
    firstControlOffset: { x: 1, y: 0, z: 0 },
    secondControlOffset: { x: -1, y: 2, z: 0 },
    secondOffsetReference: 'end',
  })

  const polar = relativePolarControlModeFromPoints(2, points)

  assert.equal(polar?.kind, 'relativePolar')
  if (polar?.kind !== 'relativePolar') {
    throw new Error('Expected relative polar controls.')
  }
  assert.equal(polar.firstControl.angleDegrees, 0)
  assert.equal(polar.firstControl.radius, 1)
  assert.ok(Math.abs(polar.secondControl.angleDegrees - 116.565051) < 1e-6)
})

test('work-plane-local Cartesian Bezier metadata converts to absolute 3D controls', () => {
  const controlMode: CubicBezierControlMode = {
    kind: 'workPlaneRelativeCartesian',
    frame: testFrame,
    localStart: { a: 2, b: 3 },
    localEnd: { a: 6, b: 7 },
    firstControlOffset: { dx: 2, dy: -1 },
    secondControlOffset: { dx: -3, dy: 4 },
    secondOffsetReference: 'end',
  }
  const points = absoluteCubicBezierPointsFromControlMode(
    3,
    { x: 12, y: 20, z: 33 },
    { x: 16, y: 20, z: 37 },
    controlMode,
  )

  assert.deepEqual(points, [
    { x: 12, y: 20, z: 33 },
    { x: 14, y: 20, z: 32 },
    { x: 13, y: 20, z: 41 },
    { x: 16, y: 20, z: 37 },
  ])
})

test('work-plane-local polar Bezier metadata converts angle and radius through the saved frame', () => {
  const controlMode: CubicBezierControlMode = {
    kind: 'workPlaneRelativePolar',
    frame: testFrame,
    localStart: { a: 1, b: 2 },
    localEnd: { a: 5, b: 6 },
    firstControl: { angleDegrees: 0, radius: 2 },
    secondControl: { angleDegrees: 90, radius: 3 },
    secondOffsetReference: 'end',
  }
  const points = absoluteCubicBezierPointsFromControlMode(
    3,
    { x: 11, y: 20, z: 32 },
    { x: 15, y: 20, z: 36 },
    controlMode,
  )

  assert.notEqual(points, null)
  assert.deepEqual(points?.[1], { x: 13, y: 20, z: 32 })
  assert.ok(Math.abs((points?.[2].x ?? 0) - 15) < 1e-9)
  assert.ok(Math.abs((points?.[2].y ?? 0) - 20) < 1e-9)
  assert.ok(Math.abs((points?.[2].z ?? 0) - 39) < 1e-9)
})

test('work-plane-local Bezier second control is relative to the end point', () => {
  const controlMode: CubicBezierControlMode = {
    kind: 'workPlaneRelativeCartesian',
    frame: testFrame,
    localStart: { a: 0, b: 0 },
    localEnd: { a: 10, b: 0 },
    firstControlOffset: { dx: 1, dy: 0 },
    secondControlOffset: { dx: -2, dy: 0 },
    secondOffsetReference: 'end',
  }
  const points = absoluteCubicBezierPointsFromControlMode(
    3,
    { x: 10, y: 20, z: 30 },
    { x: 20, y: 20, z: 30 },
    controlMode,
  )

  assert.deepEqual(points?.[2], { x: 18, y: 20, z: 30 })
})

test('work-plane-local coordinates round-trip through the saved frame', () => {
  const point = { x: 13, y: 20, z: 35 }
  const local = workPlaneLocalCoordinateFromPoint(testFrame, point)

  assert.deepEqual(local, { a: 3, b: 5 })
  assert.deepEqual(pointFromWorkPlaneLocalCoordinate(testFrame, local), point)
})

test('work-plane-local Bezier metadata rejects invalid frames safely', () => {
  const controlMode: CubicBezierControlMode = {
    kind: 'workPlaneRelativeCartesian',
    frame: {
      ...testFrame,
      u: { x: 2, y: 0, z: 0 },
    },
    localStart: { a: 0, b: 0 },
    localEnd: { a: 1, b: 0 },
    firstControlOffset: { dx: 1, dy: 0 },
    secondControlOffset: { dx: -1, dy: 0 },
    secondOffsetReference: 'end',
  }

  assert.equal(
    absoluteCubicBezierPointsFromControlMode(
      3,
      { x: 10, y: 20, z: 30 },
      { x: 11, y: 20, z: 30 },
      controlMode,
    ),
    null,
  )
})

const testFrame: WorkPlaneFrameSnapshot = {
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}
