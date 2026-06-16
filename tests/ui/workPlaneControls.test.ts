import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyCustomOriginNormalWorkPlaneInput,
  applyCustomThreePointWorkPlaneInput,
  normalizeActiveWorkPlaneForAmbientDimension,
  shouldShowWorkPlaneControls,
  workPlaneDisplayName,
  workPlaneSelectValue,
} from '../../src/ui/workPlaneControls.ts'
import type { WorkPlane } from '../../src/model/types.ts'

test('valid origin and normal input applies a custom work plane in 3D', () => {
  const previous: WorkPlane = { kind: 'xy', z: 5 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '1', y: '2', z: '3' },
    normal: { x: '0', y: '0', z: '2' },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 'Custom plane applied.')
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.name, 'Custom plane')
  assert.deepEqual(result.workPlane.origin, { x: 1, y: 2, z: 3 })
  assert.deepEqual(result.workPlane.normal, { x: 0, y: 0, z: 1 })
  assert.equal(workPlaneSelectValue(result.workPlane), 'custom')
  assert.equal(workPlaneDisplayName(result.workPlane), 'Custom plane')
})

test('zero normal input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xz', y: -2 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '1', y: '2', z: '3' },
    normal: { x: '0', y: '0', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Normal vector must be nonzero.')
  assert.strictEqual(result.workPlane, previous)
})

test('non-finite origin or normal input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'yz', x: 4 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '1', y: 'Infinity', z: '3' },
    normal: { x: '0', y: '1', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Origin and normal must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('blank numeric input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xy', z: 1 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '', y: '0', z: '0' },
    normal: { x: '0', y: '0', z: '1' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Origin and normal must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('valid three-point input applies a custom work plane in 3D', () => {
  const previous: WorkPlane = { kind: 'xy', z: 5 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '1', y: '2', z: '3' },
    p1: { x: '3', y: '2', z: '3' },
    p2: { x: '1', y: '5', z: '3' },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 'Custom plane applied.')
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.source.kind, 'threePoints')
  assert.deepEqual(result.workPlane.origin, { x: 1, y: 2, z: 3 })
  assert.deepEqual(result.workPlane.u, { x: 1, y: 0, z: 0 })
})

test('three-point input uses P0 as origin and P1 minus P0 as u direction', () => {
  const result = applyCustomThreePointWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      p0: { x: '2', y: '3', z: '4' },
      p1: { x: '2', y: '6', z: '4' },
      p2: { x: '2', y: '3', z: '8' },
    },
  )

  assert.equal(result.ok, true)

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.deepEqual(result.workPlane.origin, { x: 2, y: 3, z: 4 })
  assert.deepEqual(result.workPlane.u, { x: 0, y: 1, z: 0 })
})

test('collinear three-point input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xz', y: -2 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '1', z: '1' },
    p2: { x: '2', y: '2', z: '2' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must not be collinear.')
  assert.strictEqual(result.workPlane, previous)
})

test('coincident three-point input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'yz', x: 4 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '0', z: '0' },
    p2: { x: '1', y: '0', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must be distinct.')
  assert.strictEqual(result.workPlane, previous)
})

test('non-finite three-point input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xy', z: 1 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: 'Infinity', y: '0', z: '0' },
    p2: { x: '0', y: '1', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('three-point custom work planes are rejected outside 3D mode', () => {
  const previous: WorkPlane = {
    kind: 'custom',
    id: 'previous',
    name: 'Previous plane',
    origin: { x: 1, y: 1, z: 1 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: { kind: 'threePoints' },
  }
  const result = applyCustomThreePointWorkPlaneInput(previous, 2, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '0', z: '0' },
    p2: { x: '0', y: '1', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Custom work planes are available only in 3D.')
  assert.deepEqual(result.workPlane, { kind: 'xy', z: 0 })
})

test('work plane controls are hidden outside 3D mode', () => {
  assert.equal(shouldShowWorkPlaneControls(2), false)
  assert.equal(shouldShowWorkPlaneControls(3), true)
})

test('switching to 2D resets active work plane to xy at z equals 0', () => {
  const customResult = applyCustomOriginNormalWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      origin: { x: '1', y: '2', z: '3' },
      normal: { x: '1', y: '1', z: '1' },
    },
  )

  assert.equal(customResult.ok, true)
  assert.deepEqual(
    normalizeActiveWorkPlaneForAmbientDimension(2, customResult.workPlane),
    { kind: 'xy', z: 0 },
  )
})
