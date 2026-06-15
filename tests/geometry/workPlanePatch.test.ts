import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWorkPlanePatch,
  DEFAULT_WORK_PLANE_PATCH_SIZE,
} from '../../src/geometry/workPlanePatch.ts'
import type { WorkPlane } from '../../src/model/types.ts'

test('xy work plane patch has four corners with fixed z', () => {
  const patch = createWorkPlanePatch({ kind: 'xy', z: 3 })

  assert.equal(patch.corners.length, 4)
  assert.deepEqual(
    patch.corners.map((corner) => corner.z),
    [3, 3, 3, 3],
  )
})

test('xz work plane patch has four corners with fixed y', () => {
  const patch = createWorkPlanePatch({ kind: 'xz', y: -2 })

  assert.equal(patch.corners.length, 4)
  assert.deepEqual(
    patch.corners.map((corner) => corner.y),
    [-2, -2, -2, -2],
  )
})

test('yz work plane patch has four corners with fixed x', () => {
  const patch = createWorkPlanePatch({ kind: 'yz', x: 5 })

  assert.equal(patch.corners.length, 4)
  assert.deepEqual(
    patch.corners.map((corner) => corner.x),
    [5, 5, 5, 5],
  )
})

test('work plane patch size is reflected in corner distances', () => {
  const patch = createWorkPlanePatch(
    { kind: 'xy', z: 0 },
    { center: { x: 10, y: 20, z: 30 }, size: 6 },
  )

  assert.deepEqual(patch.corners, [
    { x: 7, y: 17, z: 0 },
    { x: 13, y: 17, z: 0 },
    { x: 13, y: 23, z: 0 },
    { x: 7, y: 23, z: 0 },
  ])
})

test('work plane patch uses the default size when no size is provided', () => {
  const patch = createWorkPlanePatch({ kind: 'xz', y: 1 })

  assert.equal(patch.corners[1].x - patch.corners[0].x, DEFAULT_WORK_PLANE_PATCH_SIZE)
  assert.equal(patch.corners[2].z - patch.corners[1].z, DEFAULT_WORK_PLANE_PATCH_SIZE)
})

test('work plane patch helper does not mutate input', () => {
  const workPlane: WorkPlane = { kind: 'yz', x: 2 }
  const original = { ...workPlane }

  createWorkPlanePatch(workPlane, { center: { x: 3, y: 4, z: 5 }, size: 8 })

  assert.deepEqual(workPlane, original)
})

test('work plane patch generation is independent of diagram data', () => {
  const first = createWorkPlanePatch({ kind: 'xy', z: 0 })
  const second = createWorkPlanePatch({ kind: 'xy', z: 0 })

  assert.deepEqual(first, second)
})
