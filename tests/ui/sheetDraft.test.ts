import assert from 'node:assert/strict'
import test from 'node:test'
import {
  areFinitePoints,
  arePointsOnWorkPlane,
  createSheetPolygonDraft,
  isPointOnWorkPlane,
  sheetDraftBlocksWorkPlaneChange,
} from '../../src/ui/sheetDraft.ts'
import type { WorkPlane } from '../../src/model/types.ts'

test('sheet polygon draft captures the initial work plane', () => {
  const workPlane: WorkPlane = { kind: 'xy', z: 2 }
  const draft = createSheetPolygonDraft({ x: 1, y: 1, z: 2 }, workPlane)

  workPlane.z = 5

  assert.deepEqual(draft.workPlane, { kind: 'xy', z: 2 })
  assert.deepEqual(draft.points, [{ x: 1, y: 1, z: 2 }])
})

test('active sheet drafts block work-plane changes', () => {
  const draft = createSheetPolygonDraft({ x: 0, y: 0, z: 0 }, { kind: 'xy', z: 0 })

  assert.equal(sheetDraftBlocksWorkPlaneChange(draft), true)
  assert.equal(sheetDraftBlocksWorkPlaneChange(null), false)
})

test('work-plane membership accepts valid xy, xz, and yz sheet vertices', () => {
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 0, y: 0, z: 3 },
        { x: 1, y: 0, z: 3 },
        { x: 0, y: 1, z: 3 },
      ],
      { kind: 'xy', z: 3 },
    ),
    true,
  )
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 0, y: 4, z: 0 },
        { x: 1, y: 4, z: 0 },
        { x: 0, y: 4, z: 1 },
      ],
      { kind: 'xz', y: 4 },
    ),
    true,
  )
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 5, y: 0, z: 0 },
        { x: 5, y: 1, z: 0 },
        { x: 5, y: 0, z: 1 },
      ],
      { kind: 'yz', x: 5 },
    ),
    true,
  )
})

test('work-plane membership rejects mixed-plane sheet vertices', () => {
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 0, y: 0, z: 3 },
        { x: 1, y: 0, z: 3 },
        { x: 0, y: 1, z: 4 },
      ],
      { kind: 'xy', z: 3 },
    ),
    false,
  )
  assert.equal(isPointOnWorkPlane({ x: 1, y: 4.1, z: 0 }, { kind: 'xz', y: 4 }), false)
  assert.equal(isPointOnWorkPlane({ x: 5.1, y: 0, z: 0 }, { kind: 'yz', x: 5 }), false)
})

test('finite point checks reject NaN and infinities', () => {
  assert.equal(
    areFinitePoints([
      { x: 0, y: 0, z: 0 },
      { x: Number.NaN, y: 0, z: 0 },
    ]),
    false,
  )
  assert.equal(
    areFinitePoints([
      { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
      { x: 1, y: 0, z: Number.NEGATIVE_INFINITY },
    ]),
    false,
  )
})
