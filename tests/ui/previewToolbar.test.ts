import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { emptyTwoDimensionalDiagram } from '../../src/examples/index.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  closeDirectInputDrawerInputMode,
  directInputDrawerFormKind,
  directInputDrawerStateForInputMode,
  shouldShowDirectInputDrawer,
} from '../../src/ui/directInputDrawer.ts'
import {
  closeInspectorDrawerState,
  defaultInspectorDrawerState,
  isInspectorDrawerOpen,
  openInspectorDrawerState,
  toggleInspectorDrawerState,
} from '../../src/ui/inspectorDrawer.ts'
import {
  addPathMenuGroups,
  addPathMenuItems,
  addSheetMenuGroups,
  addSheetMenuItems,
  activeToolSupportsCursorCreation,
  directPathInputModeItems,
  closeToolbarPalette,
  coordinateAnchorVisibilityAriaLabel,
  coordinateAnchorVisibilityButtonLabel,
  defaultPreviewCoordinateInputMode,
  previewToolbarTopTools,
  runPreviewOverlayAction,
  shouldHandlePreviewCanvasCreationClick,
  shouldShowFillPathsForTool,
  stopPreviewOverlayEvent,
  toolbarPaletteAfterCommandSelection,
  toggleCoordinateAnchorVisibility,
  toggleToolbarPalette,
  togglePreviewToolbarState,
} from '../../src/ui/previewToolbar.ts'
import type { WorkPlanePreviewTool } from '../../src/ui/workPlanePreview.ts'

const appSource = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
)
const appCss = readFileSync(new URL('../../src/App.css', import.meta.url), 'utf8')

test('preview toolbar collapse state toggles between expanded and collapsed', () => {
  assert.equal(togglePreviewToolbarState('expanded'), 'collapsed')
  assert.equal(togglePreviewToolbarState('collapsed'), 'expanded')
})

test('coordinate anchor visibility control exposes show and hide labels', () => {
  assert.equal(toggleCoordinateAnchorVisibility(true), false)
  assert.equal(toggleCoordinateAnchorVisibility(false), true)
  assert.equal(coordinateAnchorVisibilityButtonLabel(true), 'Coordinates: Hide')
  assert.equal(coordinateAnchorVisibilityButtonLabel(false), 'Coordinates: Show')
  assert.equal(
    coordinateAnchorVisibilityAriaLabel(true),
    'Hide coordinate anchors in preview',
  )
  assert.equal(
    coordinateAnchorVisibilityAriaLabel(false),
    'Show coordinate anchors in preview',
  )
})

test('opening Add point palette sets the open toolbar palette', () => {
  assert.equal(toggleToolbarPalette(null, 'addPoint'), 'addPoint')
})

test('opening Add path while Add point is open replaces the open palette', () => {
  assert.equal(toggleToolbarPalette('addPoint', 'addPath'), 'addPath')
})

test('clicking the open Add path palette closes it', () => {
  assert.equal(toggleToolbarPalette('addPath', 'addPath'), null)
})

test('selecting a toolbar palette command closes the open palette', () => {
  assert.equal(toolbarPaletteAfterCommandSelection(), null)
  assert.equal(closeToolbarPalette(), null)
})

test('preview overlay state is UI-only and not saved in diagram JSON', () => {
  const serialized = serializeDiagram(emptyTwoDimensionalDiagram)
  const parsed = JSON.parse(serialized) as {
    diagram: Record<string, unknown>
  }

  togglePreviewToolbarState('expanded')
  toggleToolbarPalette(null, 'addPath')
  openInspectorDrawerState()
  directInputDrawerStateForInputMode('direct')

  assert.equal('previewToolbarState' in parsed.diagram, false)
  assert.equal('openToolbarPalette' in parsed.diagram, false)
  assert.equal('inspectorDrawerState' in parsed.diagram, false)
  assert.equal('directInputDrawerState' in parsed.diagram, false)
  assert.equal('layerWindowOpen' in parsed.diagram, false)
  assert.equal('cameraPanelOpen' in parsed.diagram, false)
  assert.equal('showCoordinateAnchors' in parsed.diagram, false)
})

test('preview toolbar chrome uses translucent backgrounds without parent opacity', () => {
  const appShellRule = cssRule('.app-shell')
  const toolbarRule = cssRule('.preview-floating-toolbar')
  const historyRule = cssRule('.preview-history-overlay')

  assert.match(
    appShellRule,
    /--preview-toolbar-bg:\s*rgba\(248, 246, 238, 0\.42\);/,
  )
  assert.match(toolbarRule, /background:\s*var\(--preview-toolbar-bg\);/)
  assert.match(toolbarRule, /backdrop-filter:\s*blur\(10px\);/)
  assert.match(historyRule, /background:\s*rgba\(248, 246, 238, 0\.36\);/)
  assert.doesNotMatch(toolbarRule, /opacity:/)
  assert.doesNotMatch(historyRule, /opacity:/)
})

test('preview toolbar buttons are translucent while text remains opaque', () => {
  const appShellRule = cssRule('.app-shell')
  const buttonRule = cssRuleStartingAt('.preview-overlay-button,')
  const hoverRule = cssRuleStartingAt('.preview-overlay-button:hover,')
  const disabledRule = cssRuleStartingAt('.preview-overlay-button:disabled,')
  const activeRule = cssRuleStartingAt('.preview-floating-toolbar button.is-selected,')

  assert.match(
    appShellRule,
    /--preview-toolbar-button-bg:\s*rgba\(255, 255, 255, 0\.36\);/,
  )
  assert.match(
    appShellRule,
    /--preview-toolbar-button-bg-hover:\s*rgba\(255, 255, 255, 0\.62\);/,
  )
  assert.match(
    appShellRule,
    /--preview-toolbar-button-bg-active:\s*rgba\(255, 255, 255, 0\.82\);/,
  )
  assert.match(
    appShellRule,
    /--preview-toolbar-button-text:\s*rgb\(20, 24, 32\);/,
  )
  assert.match(buttonRule, /background:\s*var\(--preview-toolbar-button-bg\);/)
  assert.match(buttonRule, /color:\s*var\(--preview-toolbar-button-text\);/)
  assert.match(
    hoverRule,
    /background:\s*var\(--preview-toolbar-button-bg-hover\);/,
  )
  assert.match(
    activeRule,
    /background:\s*var\(--preview-toolbar-button-bg-active\);/,
  )
  assert.match(
    disabledRule,
    /color:\s*var\(--preview-toolbar-button-text-disabled\);/,
  )
  assert.match(
    disabledRule,
    /background:\s*var\(--preview-toolbar-button-bg-disabled\);/,
  )
  assert.doesNotMatch(buttonRule, /opacity:/)
  assert.doesNotMatch(disabledRule, /opacity:/)
})

test('preview overlay z-index tokens keep modal above preview overlays', () => {
  const appShellRule = cssRule('.app-shell')
  const toolbarRule = cssRule('.preview-toolbar-overlay-stack')
  const contextRule = cssRule('.context-quick-style-bar')
  const popoverRule = cssRule('.preview-toolbar-menu-popover')
  const edgeRule = cssRule('.preview-layer-control')
  const layerWindowRule = cssRule('.layer-palette-window')
  const directDrawerRule = cssRule('.direct-input-drawer')
  const inspectorRule = cssRule('.inspector-drawer')
  const backdropRule = cssRule('.modal-backdrop')
  const dialogRule = cssRule('.modal-dialog')

  assert.equal(cssVariableNumber(appShellRule, '--z-preview-canvas'), 0)
  assert.equal(cssVariableNumber(appShellRule, '--z-preview-selection'), 5)
  assert.equal(cssVariableNumber(appShellRule, '--z-preview-toolbar'), 20)
  assert.equal(cssVariableNumber(appShellRule, '--z-preview-context-bar'), 21)
  assert.equal(cssVariableNumber(appShellRule, '--z-preview-edge-actions'), 25)
  assert.equal(cssVariableNumber(appShellRule, '--z-workplane-panel'), 30)
  assert.equal(cssVariableNumber(appShellRule, '--z-layer-window'), 35)
  assert.equal(cssVariableNumber(appShellRule, '--z-inspector-drawer'), 40)
  assert.equal(cssVariableNumber(appShellRule, '--z-popover'), 60)
  assert.equal(cssVariableNumber(appShellRule, '--z-modal-backdrop'), 90)
  assert.equal(cssVariableNumber(appShellRule, '--z-modal'), 100)
  assert.match(toolbarRule, /z-index:\s*var\(--z-preview-toolbar\);/)
  assert.match(contextRule, /z-index:\s*var\(--z-preview-context-bar\);/)
  assert.match(popoverRule, /z-index:\s*var\(--z-popover\);/)
  assert.match(edgeRule, /z-index:\s*var\(--z-preview-edge-actions\);/)
  assert.match(layerWindowRule, /z-index:\s*var\(--z-layer-window\);/)
  assert.match(directDrawerRule, /z-index:\s*var\(--z-direct-input-drawer\);/)
  assert.match(inspectorRule, /z-index:\s*var\(--z-inspector-drawer\);/)
  assert.match(backdropRule, /z-index:\s*var\(--z-modal-backdrop\);/)
  assert.match(dialogRule, /z-index:\s*var\(--z-modal\);/)
  assert.ok(
    cssVariableNumber(appShellRule, '--z-modal-backdrop') >
      cssVariableNumber(appShellRule, '--z-popover'),
  )
})

test('preview overlay renders context quick style bar near toolbar controls', () => {
  const toolbarStart = appSource.indexOf('function renderPreviewToolbarOverlay')
  const toolbarEnd = appSource.indexOf('function renderCursorSnapControls', toolbarStart)
  const toolbarSource = appSource.slice(toolbarStart, toolbarEnd)

  assert.ok(toolbarStart >= 0)
  assert.ok(toolbarEnd > toolbarStart)
  assert.match(toolbarSource, /<ContextQuickStyleBar/)
  assert.match(toolbarSource, /onChange=\{updateContextQuickStyleField\}/)
  assert.match(toolbarSource, /onSliderInteractionStart=\{beginQuickStyleSliderInteraction\}/)
  assert.match(toolbarSource, /onSliderInteractionEnd=\{endQuickStyleSliderInteraction\}/)
})

test('symbolic variable import dialog is a topmost modal over toolbar overlays', () => {
  const backdropRule = cssRule('.modal-backdrop')
  const dialogRule = cssRule('.modal-dialog')
  const toolbarIndex = appSource.indexOf('<section className="toolbar"')
  const modalIndex = appSource.indexOf(
    'className="modal-backdrop symbolic-import-backdrop"',
  )
  const workspaceIndex = appSource.indexOf('className="workspace"')

  assert.ok(toolbarIndex >= 0)
  assert.ok(modalIndex > toolbarIndex)
  assert.ok(workspaceIndex > modalIndex)
  assert.match(appSource, /className="modal-dialog symbolic-import-dialog"/)
  assert.match(appSource, /role="dialog"/)
  assert.match(appSource, /aria-modal="true"/)
  assert.match(backdropRule, /position:\s*fixed;/)
  assert.match(backdropRule, /inset:\s*0;/)
  assert.match(backdropRule, /pointer-events:\s*auto;/)
  assert.match(dialogRule, /pointer-events:\s*auto;/)
})

test('symbolic variable import modal keeps focus and Escape inside modal flow', () => {
  assert.match(appSource, /symbolicImportFirstInputRef\.current\?\.focus\(\)/)
  assert.match(appSource, /autoFocus=\{index === 0\}/)
  assert.match(appSource, /onKeyDown=\{handleSymbolicImportDialogKeyDown\}/)
  assert.match(appSource, /modalFocusableElements\(dialog\)/)
  assert.match(
    appSource,
    /window\.addEventListener\('keydown', handleSymbolicImportEscape, true\)/,
  )
  assert.match(appSource, /event\.stopPropagation\(\)/)
  assert.match(appSource, /setSaveLoadMessage\('JSON load canceled\.'\)/)
})

test('preview toolbar command handlers remain wired after style changes', () => {
  const toolbarStart = appSource.indexOf('function renderPreviewToolbarTool')
  const toolbarEnd = appSource.indexOf('function isPathMenuItemSelected', toolbarStart)
  const toolbarSource = appSource.slice(toolbarStart, toolbarEnd)
  const historyStart = appSource.indexOf('className="preview-history-overlay"')
  const historyEnd = appSource.indexOf('function renderCursorSnapControls', historyStart)
  const historySource = appSource.slice(historyStart, historyEnd)

  assert.ok(toolbarStart >= 0)
  assert.ok(toolbarEnd > toolbarStart)
  assert.match(toolbarSource, /activateCursorCreationTool\(directTool\)/)
  assert.match(toolbarSource, /activateDirectCreationTool\(directTool\)/)
  assert.match(toolbarSource, /activatePathMenuItem\(item\)/)
  assert.match(toolbarSource, /activateSheetMenuItem\(item\)/)
  assert.match(toolbarSource, /activateCursorCreationTool\(tool\.id\)/)
  assert.match(historySource, /runPreviewOverlayAction\(event, undoLastChange\)/)
  assert.match(historySource, /runPreviewOverlayAction\(event, redoLastChange\)/)
})

test('toolbar collapse state does not affect generated TikZ', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)

  assert.equal(togglePreviewToolbarState('expanded'), 'collapsed')
  assert.equal(togglePreviewToolbarState('collapsed'), 'expanded')
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('toolbar palette state does not affect generated TikZ', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)

  assert.equal(toggleToolbarPalette(null, 'addPoint'), 'addPoint')
  assert.equal(toggleToolbarPalette('addPoint', 'addPath'), 'addPath')
  assert.equal(closeToolbarPalette(), null)
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('coordinate anchor visibility state does not affect generated TikZ', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)

  assert.equal(toggleCoordinateAnchorVisibility(true), false)
  assert.equal(toggleCoordinateAnchorVisibility(false), true)
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('inspector drawer is closed by default and opens only by explicit action', () => {
  const defaultState = defaultInspectorDrawerState()
  const openState = openInspectorDrawerState()
  const closedState = closeInspectorDrawerState()

  assert.equal(defaultState, 'closed')
  assert.equal(isInspectorDrawerOpen(defaultState), false)
  assert.equal(isInspectorDrawerOpen(openState), true)
  assert.equal(closedState, 'closed')
  assert.equal(toggleInspectorDrawerState(defaultState), 'open')
  assert.equal(toggleInspectorDrawerState(openState), 'closed')
})

test('closed inspector drawer state is UI-only and does not change diagram serialization', () => {
  const before = serializeDiagram(emptyTwoDimensionalDiagram)
  const drawerState = closeInspectorDrawerState()

  assert.equal(isInspectorDrawerOpen(drawerState), false)
  assert.equal(serializeDiagram(emptyTwoDimensionalDiagram), before)
})

test('inspector drawer controls stop before canvas handlers can run', () => {
  let stopped = false
  let opened = false
  let canvasCalls = 0

  runPreviewOverlayAction(
    {
      stopPropagation: () => {
        stopped = true
      },
    },
    () => {
      opened = true
    },
  )

  if (!stopped) {
    canvasCalls += 1
  }

  assert.equal(stopped, true)
  assert.equal(opened, true)
  assert.equal(canvasCalls, 0)
})

test('TikZ output is unaffected by inspector drawer state', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)
  const drawerState = openInspectorDrawerState()

  assert.equal(isInspectorDrawerOpen(drawerState), true)
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('TikZ output is unaffected by inspector open and closed states', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)

  assert.equal(isInspectorDrawerOpen(openInspectorDrawerState()), true)
  assert.equal(isInspectorDrawerOpen(closeInspectorDrawerState()), false)
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('fill paths are visible only for Select and Add path family tools', () => {
  const visibleTools: WorkPlanePreviewTool[] = [
    'select',
    'createPath',
    'createPolyline',
    'createCubicBezier',
  ]
  const hiddenTools: WorkPlanePreviewTool[] = [
    'createCoordinate',
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

test('Add path menu exposes polyline and cubic Bézier options', () => {
  const labels = addPathMenuItems().map((item) => item.label)

  assert.ok(labels.includes('Polyline'))
  assert.ok(labels.includes('Cubic Bézier'))
  assert.ok(labels.includes('Arbitrary path'))
  assert.equal(labels.includes('Line/manual path'), false)
  assert.ok(labels.includes('Arc segment path'))
  assert.ok(labels.includes('Direct input...'))
})

test('Add path Arbitrary path keeps the manual creation action and help text', () => {
  const arbitraryPathItem = addPathMenuItems().find(
    (item) => item.id === 'manualPath',
  )

  assert.notEqual(arbitraryPathItem, undefined)
  assert.equal(arbitraryPathItem?.label, 'Arbitrary path')
  assert.equal(
    arbitraryPathItem?.helpText,
    'Create a path with line, arc, and Bézier segments.',
  )
  assert.equal(arbitraryPathItem?.tool, 'createPath')
  assert.equal(arbitraryPathItem?.inputMode, 'cursor')
  assert.equal(arbitraryPathItem?.segmentKind, 'line')
})

test('Add path Cubic Bézier menu item uses the curve icon sentinel', () => {
  const cubicBezierItem = addPathMenuItems().find(
    (item) => item.id === 'cubicBezier',
  )

  assert.notEqual(cubicBezierItem, undefined)
  assert.equal(cubicBezierItem?.label, 'Cubic Bézier')
  assert.equal(cubicBezierItem?.icon, 'bezierCurve')
  assert.equal(cubicBezierItem?.tool, 'createCubicBezier')
  assert.equal(cubicBezierItem?.inputMode, 'cursor')
})

test('Add path menu contains exactly one Direct input item', () => {
  const directItems = addPathMenuItems().filter((item) =>
    item.label.toLowerCase().includes('direct'),
  )

  assert.equal(directItems.length, 1)
  assert.equal(directItems[0]?.id, 'directPathInput')
})

test('Add path menu groups and icons distinguish path actions', () => {
  const groups = addPathMenuGroups().map((group) => group.id)
  const items = addPathMenuItems()
  const icons = new Set(items.map((item) => item.icon))

  assert.deepEqual(groups, ['cursorCreation', 'directInput'])
  assert.equal(icons.size, items.length)
  assert.deepEqual(
    items.map((item) => item.group),
    [
      'cursorCreation',
      'cursorCreation',
      'cursorCreation',
      'cursorCreation',
      'directInput',
    ],
  )
})

test('Add sheet menu exposes exactly the visible items in palette order', () => {
  assert.deepEqual(
    addSheetMenuItems().map((item) => item.label),
    ['Polygon', 'Coons', 'Ruled', 'Hemisphere', 'Direct input'],
  )
})

test('Add sheet menu removes Saddle while preserving remaining creation targets', () => {
  const items = addSheetMenuItems()

  assert.equal(items.some((item) => item.label === 'Saddle'), false)
  assert.deepEqual(
    items.map((item) => item.sheetCreationKind ?? 'direct'),
    ['polygon', 'coonsPatch', 'ruledSurface', 'hemisphere', 'direct'],
  )
  assert.deepEqual(
    items.map((item) => item.tool),
    ['createSheet', 'createSheet', 'createSheet', 'createSheet', 'createSheet'],
  )
})

test('Add sheet menu contains exactly one Direct input item', () => {
  const directItems = addSheetMenuItems().filter((item) =>
    item.label.toLowerCase().includes('direct'),
  )

  assert.equal(directItems.length, 1)
  assert.equal(directItems[0]?.id, 'directSheetInput')
  assert.equal(directItems[0]?.inputMode, 'direct')
})

test('Add sheet menu uses distinct semantic icon keys', () => {
  assert.deepEqual(
    addSheetMenuItems().map((item) => item.icon),
    [
      'sheetPolygon',
      'sheetCoonsPatch',
      'sheetRuledSurface',
      'sheetHemisphere',
      'sheetDirectInput',
    ],
  )
})

test('Add sheet menu uses the same grouped palette structure as Add path', () => {
  assert.deepEqual(
    addSheetMenuGroups().map((group) => group.id),
    ['cursorCreation', 'directInput'],
  )
  assert.deepEqual(
    addSheetMenuGroups().map((group) => group.label),
    addPathMenuGroups().map((group) => group.label),
  )
  assert.deepEqual(
    addSheetMenuItems().map((item) => item.group),
    [
      'cursorCreation',
      'cursorCreation',
      'cursorCreation',
      'cursorCreation',
      'directInput',
    ],
  )
})

test('Add path direct drawer still exposes direct path creation choices', () => {
  const directModes = directPathInputModeItems().map((item) => item.id)

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

  assert.equal(toolMenus.get('createCoordinate'), 'direct')
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

test('selecting Direct for Add point opens the direct input drawer', () => {
  const state = directInputDrawerStateForInputMode('direct')

  assert.equal(state, 'open')
  assert.equal(shouldShowDirectInputDrawer('createPoint', 'direct', state), true)
  assert.equal(directInputDrawerFormKind('createPoint', 'direct'), 'point')
})

test('selecting Direct for Add coordinate opens the coordinate direct input drawer', () => {
  const state = directInputDrawerStateForInputMode('direct')

  assert.equal(
    shouldShowDirectInputDrawer('createCoordinate', 'direct', state),
    true,
  )
  assert.equal(
    directInputDrawerFormKind('createCoordinate', 'direct'),
    'coordinate',
  )
})

test('selecting Direct for Add path opens the path direct input form', () => {
  const state = directInputDrawerStateForInputMode('direct')

  assert.equal(shouldShowDirectInputDrawer('createPath', 'direct', state), true)
  assert.equal(directInputDrawerFormKind('createPath', 'direct'), 'path')
})

test('selecting Add path Direct input item closes palette and opens path drawer policy', () => {
  const directItem = addPathMenuItems().find(
    (item) => item.id === 'directPathInput',
  )

  assert.notEqual(directItem, undefined)
  if (directItem === undefined) {
    return
  }

  const state = directInputDrawerStateForInputMode(directItem.inputMode)

  assert.equal(toolbarPaletteAfterCommandSelection(), null)
  assert.equal(directItem.tool, 'createPath')
  assert.equal(directItem.inputMode, 'direct')
  assert.equal(
    shouldShowDirectInputDrawer(directItem.tool, directItem.inputMode, state),
    true,
  )
  assert.equal(directInputDrawerFormKind(directItem.tool, directItem.inputMode), 'path')
})

test('selecting Add sheet Direct input item closes palette and opens sheet drawer policy', () => {
  const directItem = addSheetMenuItems().find(
    (item) => item.id === 'directSheetInput',
  )

  assert.notEqual(directItem, undefined)
  if (directItem === undefined) {
    return
  }

  const state = directInputDrawerStateForInputMode(directItem.inputMode)

  assert.equal(toolbarPaletteAfterCommandSelection(), null)
  assert.equal(directItem.tool, 'createSheet')
  assert.equal(directItem.inputMode, 'direct')
  assert.equal(
    shouldShowDirectInputDrawer(directItem.tool, directItem.inputMode, state),
    true,
  )
  assert.equal(
    directInputDrawerFormKind(directItem.tool, directItem.inputMode),
    'sheet',
  )
})

test('opening Add sheet and Add path palettes remains exclusive', () => {
  assert.equal(toggleToolbarPalette('addPath', 'addSheet'), 'addSheet')
  assert.equal(toggleToolbarPalette('addSheet', 'addPath'), 'addPath')
})

test('closing the direct input drawer returns the add tool to cursor input', () => {
  const inputMode = closeDirectInputDrawerInputMode()
  const state = directInputDrawerStateForInputMode(inputMode)

  assert.equal(inputMode, 'cursor')
  assert.equal(state, 'closed')
  assert.equal(shouldShowDirectInputDrawer('createPoint', inputMode, state), false)
})

test('direct input drawer state is UI-only and does not change diagram serialization', () => {
  const before = serializeDiagram(emptyTwoDimensionalDiagram)
  const drawerState = directInputDrawerStateForInputMode('direct')
  const formKind = directInputDrawerFormKind('createGrid', 'direct')

  assert.equal(drawerState, 'open')
  assert.equal(formKind, 'grid')
  assert.equal(serializeDiagram(emptyTwoDimensionalDiagram), before)
})

test('direct input drawer open and closed states do not affect TikZ before creation', () => {
  const before = generateTikz(emptyTwoDimensionalDiagram)
  const openState = directInputDrawerStateForInputMode('direct')
  const closedInputMode = closeDirectInputDrawerInputMode()
  const closedState = directInputDrawerStateForInputMode(closedInputMode)

  assert.equal(shouldShowDirectInputDrawer('createPoint', 'direct', openState), true)
  assert.equal(
    shouldShowDirectInputDrawer('createPoint', closedInputMode, closedState),
    false,
  )
  assert.equal(generateTikz(emptyTwoDimensionalDiagram), before)
})

test('switching tools follows the drawer policy', () => {
  const directState = directInputDrawerStateForInputMode('direct')
  const cursorState = directInputDrawerStateForInputMode('cursor')

  assert.equal(shouldShowDirectInputDrawer('createPath', 'direct', directState), true)
  assert.equal(shouldShowDirectInputDrawer('createLabel', 'cursor', cursorState), false)
  assert.equal(directInputDrawerFormKind('select', 'direct'), null)
})

test('direct input drawer controls stop before canvas handlers can run', () => {
  let stopped = false
  let canvasCalls = 0

  stopPreviewOverlayEvent({
    stopPropagation: () => {
      stopped = true
    },
  })

  if (!stopped) {
    canvasCalls += 1
  }

  assert.equal(stopped, true)
  assert.equal(canvasCalls, 0)
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
    'createCoordinate',
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

function cssRule(selector: string): string {
  const start = appCss.indexOf(`${selector} {`)

  assert.notEqual(start, -1, `Missing CSS rule for ${selector}.`)

  const end = appCss.indexOf('\n}', start)

  assert.notEqual(end, -1, `Missing CSS rule end for ${selector}.`)

  return appCss.slice(start, end + 2)
}

function cssRuleStartingAt(selectorStart: string): string {
  const start = appCss.indexOf(selectorStart)

  assert.notEqual(start, -1, `Missing CSS rule starting at ${selectorStart}.`)

  const openBrace = appCss.indexOf('{', start)
  const end = appCss.indexOf('\n}', openBrace)

  assert.notEqual(openBrace, -1, `Missing CSS rule open for ${selectorStart}.`)
  assert.notEqual(end, -1, `Missing CSS rule end for ${selectorStart}.`)

  return appCss.slice(start, end + 2)
}

function cssVariableNumber(rule: string, variableName: string): number {
  const value = rule.match(new RegExp(`${variableName}:\\s*(\\d+);`))?.[1]

  assert.notEqual(value, undefined, `Missing CSS variable ${variableName}.`)

  return Number(value)
}
