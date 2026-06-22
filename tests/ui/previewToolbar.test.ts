import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addPathMenuItems,
  activeToolSupportsCursorCreation,
  defaultPreviewCoordinateInputMode,
  previewToolbarTopTools,
  runPreviewOverlayAction,
  shouldHandlePreviewCanvasCreationClick,
  shouldShowFillPathsForTool,
  stopPreviewOverlayEvent,
  togglePreviewToolbarState,
} from '../../src/ui/previewToolbar.ts'
import type { WorkPlanePreviewTool } from '../../src/ui/workPlanePreview.ts'

test('preview toolbar collapse state toggles between expanded and collapsed', () => {
  assert.equal(togglePreviewToolbarState('expanded'), 'collapsed')
  assert.equal(togglePreviewToolbarState('collapsed'), 'expanded')
})

test('fill paths are visible only for Select and Add path family tools', () => {
  const visibleTools: WorkPlanePreviewTool[] = [
    'select',
    'createPath',
    'createPolyline',
    'createCubicBezier',
  ]
  const hiddenTools: WorkPlanePreviewTool[] = [
    'createPoint',
    'createLabel',
    'createSheet',
    'createGrid',
  ]

  for (const tool of visibleTools) {
    assert.equal(shouldShowFillPathsForTool(tool), true, tool)
  }

  for (const tool of hiddenTools) {
    assert.equal(shouldShowFillPathsForTool(tool), false, tool)
  }
})

test('Add path menu exposes polyline and cubic Bezier options', () => {
  const labels = addPathMenuItems().map((item) => item.label)

  assert.ok(labels.includes('Polyline'))
  assert.ok(labels.includes('Cubic Bezier'))
  assert.ok(labels.includes('Line/manual path'))
})

test('Add path menu exposes existing direct path templates', () => {
  const directModes = addPathMenuItems()
    .filter((item) => item.inputMode === 'direct')
    .map((item) => item.directPathInputMode)

  assert.deepEqual(directModes, ['manual', 'circle', 'ellipse', 'arc'])
})

test('preview toolbar top tools do not expose polyline or cubic Bezier directly', () => {
  const toolIds = previewToolbarTopTools(3).map((tool) => tool.id)

  assert.ok(toolIds.includes('createPath'))
  assert.ok(toolIds.includes('createSheet'))
  assert.equal(toolIds.includes('createPolyline'), false)
  assert.equal(toolIds.includes('createCubicBezier'), false)
})

test('direct input is exposed through add-mode menus instead of a global mode', () => {
  const tools = previewToolbarTopTools(3)
  const toolMenus = new Map(tools.map((tool) => [tool.id, tool.menu]))

  assert.equal(toolMenus.get('createPoint'), 'direct')
  assert.equal(toolMenus.get('createLabel'), 'direct')
  assert.equal(toolMenus.get('createGrid'), 'direct')
  assert.equal(toolMenus.get('createPath'), 'path')
  assert.equal(toolMenus.get('createSheet'), 'sheet')
})

test('preview toolbar omits Add sheet in 2D diagrams', () => {
  const toolIds = previewToolbarTopTools(2).map((tool) => tool.id)

  assert.equal(toolIds.includes('createSheet'), false)
})

test('cursor input is the default preview coordinate input mode', () => {
  assert.equal(defaultPreviewCoordinateInputMode(), 'cursor')
})

test('preview canvas creation clicks are disabled for Add grid direct input', () => {
  assert.equal(activeToolSupportsCursorCreation('createGrid'), false)
  assert.equal(
    shouldHandlePreviewCanvasCreationClick('createGrid', 'direct'),
    false,
  )
  assert.equal(
    shouldHandlePreviewCanvasCreationClick('createGrid', 'cursor'),
    false,
  )
})

test('preview canvas creation clicks require cursor-capable tools in cursor mode', () => {
  const cursorTools: WorkPlanePreviewTool[] = [
    'createPoint',
    'createLabel',
    'createPolyline',
    'createCubicBezier',
    'createPath',
    'createSheet',
  ]

  for (const tool of cursorTools) {
    assert.equal(activeToolSupportsCursorCreation(tool), true, tool)
    assert.equal(shouldHandlePreviewCanvasCreationClick(tool, 'cursor'), true, tool)
    assert.equal(shouldHandlePreviewCanvasCreationClick(tool, 'direct'), false, tool)
  }

  assert.equal(activeToolSupportsCursorCreation('select'), false)
  assert.equal(shouldHandlePreviewCanvasCreationClick('select', 'cursor'), false)
})

test('overlay event helper stops propagation', () => {
  let stopped = false

  stopPreviewOverlayEvent({
    stopPropagation: () => {
      stopped = true
    },
  })

  assert.equal(stopped, true)
})

test('overlay action helper stops propagation and calls history or trash handlers', () => {
  let stopped = false
  let calls = 0

  runPreviewOverlayAction(
    {
      stopPropagation: () => {
        stopped = true
      },
    },
    () => {
      calls += 1
    },
  )

  assert.equal(stopped, true)
  assert.equal(calls, 1)
})
