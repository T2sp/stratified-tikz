import assert from 'node:assert/strict'
import test from 'node:test'
import {
  absoluteCubicBezierPointsFromControlMode,
  relativeCartesianControlModeFromPoints,
  relativePolarControlModeFromPoints,
} from '../../src/geometry/bezierControls.ts'
import type { CubicBezierControlMode } from '../../src/model/types.ts'

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
