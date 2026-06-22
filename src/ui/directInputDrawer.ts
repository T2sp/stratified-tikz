import type { CoordinateInputMode } from '../model/types.ts'
import type { WorkPlanePreviewTool } from './workPlanePreview.ts'

export type DirectInputDrawerState = 'open' | 'closed'

export type DirectInputDrawerFormKind =
  | 'point'
  | 'label'
  | 'path'
  | 'sheet'
  | 'grid'

export function directInputDrawerStateForInputMode(
  inputMode: CoordinateInputMode,
): DirectInputDrawerState {
  return inputMode === 'direct' ? 'open' : 'closed'
}

export function closeDirectInputDrawerInputMode(): CoordinateInputMode {
  return 'cursor'
}

export function directInputDrawerFormKind(
  tool: WorkPlanePreviewTool,
  inputMode: CoordinateInputMode,
): DirectInputDrawerFormKind | null {
  if (inputMode !== 'direct') {
    return null
  }

  switch (tool) {
    case 'createPoint':
      return 'point'
    case 'createLabel':
      return 'label'
    case 'createPath':
    case 'createPolyline':
    case 'createCubicBezier':
      return 'path'
    case 'createSheet':
      return 'sheet'
    case 'createGrid':
      return 'grid'
    case 'select':
      return null
  }
}

export function shouldShowDirectInputDrawer(
  tool: WorkPlanePreviewTool,
  inputMode: CoordinateInputMode,
  drawerState: DirectInputDrawerState,
): boolean {
  return (
    drawerState === 'open' &&
    directInputDrawerFormKind(tool, inputMode) !== null
  )
}
