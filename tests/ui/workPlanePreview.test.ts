import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkPlanePatch } from '../../src/geometry/workPlanePatch.ts'
import { constructWorkPlaneFromThreePoints } from '../../src/geometry/workPlane.ts'
import { threeDimensionalExample, twoDimensionalExample } from '../../src/examples/index.ts'
import type { WorkPlane } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  createCustomWorkPlanePreview,
  shouldShowCustomWorkPlanePreview,
  shouldShowWorkPlanePreview,
  type WorkPlanePreviewTool,
} from '../../src/ui/workPlanePreview.ts'

test('work plane preview is hidden in 2D mode', () => {
  for (const tool of allPreviewTools) {
    assert.equal(shouldShowWorkPlanePreview(2, tool), false)
  }
})

test('work plane preview is visible in 3D Select and creation modes', () => {
  for (const tool of allPreviewTools) {
    assert.equal(shouldShowWorkPlanePreview(3, tool), true)
  }
})

test('work plane preview data is independent from Diagram and TikZ output', () => {
  const before = generateTikz(threeDimensionalExample)
  const preview = createWorkPlanePatch({ kind: 'xy', z: 0 })
  const after = generateTikz(threeDimensionalExample)

  assert.equal(preview.corners.length, 4)
  assert.equal(after, before)
  assert.doesNotMatch(after, /active xy plane/)
  assert.doesNotMatch(after, /work-plane-preview/)
  assert.doesNotMatch(after, /F59E0B|B45309|92400E/)
})

test('2D diagrams do not produce work plane preview visibility', () => {
  assert.equal(
    shouldShowWorkPlanePreview(twoDimensionalExample.ambientDimension, 'select'),
    false,
  )
})

test('3D diagrams produce work plane preview visibility in Select mode', () => {
  assert.equal(
    shouldShowWorkPlanePreview(threeDimensionalExample.ambientDimension, 'select'),
    true,
  )
})

test('custom work plane preview is shown only for active custom planes in 3D', () => {
  const customPlane = createCustomPlaneForPreviewTests()
  const axisPlane: WorkPlane = { kind: 'xy', z: 0 }

  assert.equal(shouldShowCustomWorkPlanePreview(3, 'select', customPlane), true)
  assert.equal(shouldShowCustomWorkPlanePreview(3, 'select', axisPlane), false)
  assert.equal(shouldShowCustomWorkPlanePreview(2, 'select', customPlane), false)
  assert.equal(
    createCustomWorkPlanePreview(3, 'createPoint', axisPlane),
    undefined,
  )
})

test('custom work plane preview is preview-only and non-interactive', () => {
  const preview = createCustomWorkPlanePreview(
    3,
    'createPolyline',
    createCustomPlaneForPreviewTests(),
  )

  assert.notEqual(preview, undefined)
  if (preview === undefined) {
    throw new Error('Expected custom work-plane preview.')
  }

  assert.equal(preview.corners.length, 4)
  assert.equal(preview.label, 'custom work plane')
  assert.equal(preview.pointerEvents, 'none')
  assert.equal(preview.selectable, false)
  assert.equal(preview.uIndicator.label, 'u')
  assert.equal(preview.vIndicator.label, 'v')
  assert.equal(preview.normalIndicator.label, 'n')
})

test('custom work plane guide is not exported to TikZ', () => {
  const before = generateTikz(threeDimensionalExample)
  const preview = createCustomWorkPlanePreview(
    3,
    'select',
    createCustomPlaneForPreviewTests(),
  )
  const after = generateTikz(threeDimensionalExample)

  assert.notEqual(preview, undefined)
  assert.equal(after, before)
  assert.doesNotMatch(after, /custom work plane/)
  assert.doesNotMatch(after, /work-plane-preview/)
})

const allPreviewTools: WorkPlanePreviewTool[] = [
  'select',
  'createPoint',
  'createLabel',
  'createPolyline',
  'createCubicBezier',
  'createPath',
  'createSheet',
]

function createCustomPlaneForPreviewTests(): WorkPlane {
  return constructWorkPlaneFromThreePoints(
    { x: 1, y: 0, z: 1 },
    { x: 3, y: 0, z: 1 },
    { x: 1, y: 2, z: 3 },
  )
}
