import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyCustomOriginNormalWorkPlaneInput,
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
