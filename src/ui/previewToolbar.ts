import type {
  AmbientDimension,
  CoordinateInputMode,
} from '../model/types.ts'
import type { ConcatenatedPathSegmentKind } from './pathDraft.ts'
import type { WorkPlanePreviewTool } from './workPlanePreview.ts'

export type PreviewToolbarState = 'expanded' | 'collapsed'

export type PreviewToolbarTopTool = {
  id: WorkPlanePreviewTool
  label: string
  menu: 'none' | 'direct' | 'path' | 'sheet'
}

export type PreviewPathInputMode = 'manual' | 'circle' | 'ellipse' | 'arc'

export type PreviewPathMenuItem = {
  id:
    | 'manualPath'
    | 'polyline'
    | 'cubicBezier'
    | 'arcPath'
    | 'directManualPath'
    | 'directCircle'
    | 'directEllipse'
    | 'directArc'
  label: string
  tool: WorkPlanePreviewTool
  inputMode: CoordinateInputMode
  segmentKind?: ConcatenatedPathSegmentKind
  directPathInputMode?: PreviewPathInputMode
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

export function previewToolbarTopTools(
  ambientDimension: AmbientDimension,
): PreviewToolbarTopTool[] {
  return [
    { id: 'select', label: 'Select', menu: 'none' },
    { id: 'createPoint', label: 'Add point', menu: 'direct' },
    { id: 'createLabel', label: 'Add label', menu: 'direct' },
    { id: 'createPath', label: 'Add path', menu: 'path' },
    ...(ambientDimension === 3
      ? [{ id: 'createSheet' as const, label: 'Add sheet', menu: 'sheet' as const }]
      : []),
    { id: 'createGrid', label: 'Add grid', menu: 'direct' },
  ]
}

export function addPathMenuItems(): PreviewPathMenuItem[] {
  return [
    {
      id: 'manualPath',
      label: 'Line/manual path',
      tool: 'createPath',
      inputMode: 'cursor',
      segmentKind: 'line',
    },
    {
      id: 'polyline',
      label: 'Polyline',
      tool: 'createPolyline',
      inputMode: 'cursor',
    },
    {
      id: 'cubicBezier',
      label: 'Cubic Bezier',
      tool: 'createCubicBezier',
      inputMode: 'cursor',
    },
    {
      id: 'arcPath',
      label: 'Arc segment path',
      tool: 'createPath',
      inputMode: 'cursor',
      segmentKind: 'arc',
    },
    {
      id: 'directManualPath',
      label: 'Direct manual path',
      tool: 'createPath',
      inputMode: 'direct',
      directPathInputMode: 'manual',
    },
    {
      id: 'directCircle',
      label: 'Direct circle',
      tool: 'createPath',
      inputMode: 'direct',
      directPathInputMode: 'circle',
    },
    {
      id: 'directEllipse',
      label: 'Direct ellipse',
      tool: 'createPath',
      inputMode: 'direct',
      directPathInputMode: 'ellipse',
    },
    {
      id: 'directArc',
      label: 'Direct arc',
      tool: 'createPath',
      inputMode: 'direct',
      directPathInputMode: 'arc',
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
