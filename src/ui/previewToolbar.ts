import type {
  AmbientDimension,
  CoordinateInputMode,
} from '../model/types.ts'
import type { ConcatenatedPathSegmentKind } from './pathDraft.ts'
import type { WorkPlanePreviewTool } from './workPlanePreview.ts'

export type PreviewToolbarState = 'expanded' | 'collapsed'

export type PreviewToolbarPaletteId =
  | 'addPoint'
  | 'addLabel'
  | 'addPath'
  | 'addSheet'
  | 'addGrid'

export type PreviewToolbarPalette = PreviewToolbarPaletteId | null

export type PreviewToolbarTopTool = {
  id: WorkPlanePreviewTool
  label: string
  menu: 'none' | 'direct' | 'path' | 'sheet'
  palette: PreviewToolbarPalette
}

export type PreviewPathInputMode = 'manual' | 'circle' | 'ellipse' | 'arc'

export type PreviewDirectPathInputModeItem = {
  id: PreviewPathInputMode
  label: string
}

export type PreviewPathMenuGroup = 'cursorCreation' | 'directInput'

export type PreviewPathMenuGroupDefinition = {
  id: PreviewPathMenuGroup
  label: string
}

export type PreviewPathMenuItem = {
  id:
    | 'manualPath'
    | 'polyline'
    | 'cubicBezier'
    | 'arcPath'
    | 'directPathInput'
  label: string
  icon: string
  group: PreviewPathMenuGroup
  tool: WorkPlanePreviewTool
  inputMode: CoordinateInputMode
  segmentKind?: ConcatenatedPathSegmentKind
  directPathInputMode?: PreviewPathInputMode
}

export type PreviewSheetCreationKind =
  | 'polygon'
  | 'coonsPatch'
  | 'ruledSurface'
  | 'hemisphere'

export type PreviewSheetMenuItem = {
  id:
    | 'polygonSheet'
    | 'coonsPatch'
    | 'ruledSurface'
    | 'hemisphere'
    | 'directSheetInput'
  label: string
  icon: string
  group: PreviewPathMenuGroup
  tool: 'createSheet'
  inputMode: CoordinateInputMode
  sheetCreationKind?: PreviewSheetCreationKind
}

export type PreviewOverlayEvent = {
  stopPropagation: () => void
}

export type PreviewOverlayAction = () => void

export function defaultPreviewCoordinateInputMode(): CoordinateInputMode {
  return 'cursor'
}

export function activeToolSupportsCursorCreation(
  tool: WorkPlanePreviewTool,
): boolean {
  switch (tool) {
    case 'createPoint':
    case 'createLabel':
    case 'createPolyline':
    case 'createCubicBezier':
    case 'createPath':
    case 'createSheet':
      return true
    case 'select':
    case 'createGrid':
      return false
  }
}

export function shouldHandlePreviewCanvasCreationClick(
  tool: WorkPlanePreviewTool,
  inputMode: CoordinateInputMode,
): boolean {
  return inputMode !== 'direct' && activeToolSupportsCursorCreation(tool)
}

export function togglePreviewToolbarState(
  state: PreviewToolbarState,
): PreviewToolbarState {
  return state === 'expanded' ? 'collapsed' : 'expanded'
}

export function toggleToolbarPalette(
  current: PreviewToolbarPalette,
  palette: PreviewToolbarPaletteId,
): PreviewToolbarPalette {
  return current === palette ? null : palette
}

export function closeToolbarPalette(): PreviewToolbarPalette {
  return null
}

export function toolbarPaletteAfterCommandSelection(): PreviewToolbarPalette {
  return closeToolbarPalette()
}

export function previewToolbarTopTools(
  ambientDimension: AmbientDimension,
): PreviewToolbarTopTool[] {
  return [
    { id: 'select', label: 'Select', menu: 'none', palette: null },
    {
      id: 'createPoint',
      label: 'Add point',
      menu: 'direct',
      palette: 'addPoint',
    },
    {
      id: 'createLabel',
      label: 'Add label',
      menu: 'direct',
      palette: 'addLabel',
    },
    {
      id: 'createPath',
      label: 'Add path',
      menu: 'path',
      palette: 'addPath',
    },
    ...(ambientDimension === 3
      ? [
          {
            id: 'createSheet' as const,
            label: 'Add sheet',
            menu: 'sheet' as const,
            palette: 'addSheet' as const,
          },
        ]
      : []),
    {
      id: 'createGrid',
      label: 'Add grid',
      menu: 'direct',
      palette: 'addGrid',
    },
  ]
}

export function addPathMenuGroups(): PreviewPathMenuGroupDefinition[] {
  return [
    { id: 'cursorCreation', label: 'Cursor creation' },
    { id: 'directInput', label: 'Direct' },
  ]
}

export function directPathInputModeItems(): PreviewDirectPathInputModeItem[] {
  return [
    { id: 'manual', label: 'Manual segments' },
    { id: 'circle', label: 'Circle' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'arc', label: 'Arc' },
  ]
}

export function addPathMenuItems(): PreviewPathMenuItem[] {
  return [
    {
      id: 'manualPath',
      label: 'Line/manual path',
      icon: '─',
      group: 'cursorCreation',
      tool: 'createPath',
      inputMode: 'cursor',
      segmentKind: 'line',
    },
    {
      id: 'polyline',
      label: 'Polyline',
      icon: '⌁',
      group: 'cursorCreation',
      tool: 'createPolyline',
      inputMode: 'cursor',
    },
    {
      id: 'cubicBezier',
      label: 'Cubic Bézier',
      icon: 'bezierCurve',
      group: 'cursorCreation',
      tool: 'createCubicBezier',
      inputMode: 'cursor',
    },
    {
      id: 'arcPath',
      label: 'Arc segment path',
      icon: '◜',
      group: 'cursorCreation',
      tool: 'createPath',
      inputMode: 'cursor',
      segmentKind: 'arc',
    },
    {
      id: 'directPathInput',
      label: 'Direct input...',
      icon: '⌨',
      group: 'directInput',
      tool: 'createPath',
      inputMode: 'direct',
    },
  ]
}

export function addSheetMenuGroups(): PreviewPathMenuGroupDefinition[] {
  return addPathMenuGroups()
}

export function addSheetMenuItems(): PreviewSheetMenuItem[] {
  return [
    {
      id: 'polygonSheet',
      label: 'Polygon',
      icon: 'sheetPolygon',
      group: 'cursorCreation',
      tool: 'createSheet',
      inputMode: 'cursor',
      sheetCreationKind: 'polygon',
    },
    {
      id: 'coonsPatch',
      label: 'Coons',
      icon: 'sheetCoonsPatch',
      group: 'cursorCreation',
      tool: 'createSheet',
      inputMode: 'cursor',
      sheetCreationKind: 'coonsPatch',
    },
    {
      id: 'ruledSurface',
      label: 'Ruled',
      icon: 'sheetRuledSurface',
      group: 'cursorCreation',
      tool: 'createSheet',
      inputMode: 'cursor',
      sheetCreationKind: 'ruledSurface',
    },
    {
      id: 'hemisphere',
      label: 'Hemisphere',
      icon: 'sheetHemisphere',
      group: 'cursorCreation',
      tool: 'createSheet',
      inputMode: 'cursor',
      sheetCreationKind: 'hemisphere',
    },
    {
      id: 'directSheetInput',
      label: 'Direct input',
      icon: 'sheetDirectInput',
      group: 'directInput',
      tool: 'createSheet',
      inputMode: 'direct',
    },
  ]
}

export function isAddPathTool(tool: WorkPlanePreviewTool): boolean {
  return (
    tool === 'createPath' ||
    tool === 'createPolyline' ||
    tool === 'createCubicBezier'
  )
}

export function shouldShowFillPathsForTool(tool: WorkPlanePreviewTool): boolean {
  return tool === 'select' || isAddPathTool(tool)
}

export function stopPreviewOverlayEvent(event: PreviewOverlayEvent): void {
  event.stopPropagation()
}

export function runPreviewOverlayAction(
  event: PreviewOverlayEvent,
  action: PreviewOverlayAction,
): void {
  stopPreviewOverlayEvent(event)
  action()
}
