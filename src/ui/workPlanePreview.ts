import type { AmbientDimension } from '../model/types'

export type WorkPlanePreviewTool =
  | 'select'
  | 'createPoint'
  | 'createLabel'
  | 'createPolyline'
  | 'createCubicBezier'

export function shouldShowWorkPlanePreview(
  ambientDimension: AmbientDimension,
  tool: WorkPlanePreviewTool,
): boolean {
  switch (tool) {
    case 'select':
    case 'createPoint':
    case 'createLabel':
    case 'createPolyline':
    case 'createCubicBezier':
      return ambientDimension === 3
  }
}
