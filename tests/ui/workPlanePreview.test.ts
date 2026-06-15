import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkPlanePatch } from '../../src/geometry/workPlanePatch.ts'
import { threeDimensionalExample, twoDimensionalExample } from '../../src/examples/index.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
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

const allPreviewTools: WorkPlanePreviewTool[] = [
  'select',
  'createPoint',
  'createLabel',
  'createPolyline',
  'createCubicBezier',
]
