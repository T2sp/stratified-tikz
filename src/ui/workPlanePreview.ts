import type { AmbientDimension } from '../model/types'

export type WorkPlanePreviewTool =
  | 'select'
  | 'createPoint'
  | 'createLabel'
  | 'createPolyline'
  | 'createCubicBezier'
  | 'createSheet'

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
    case 'createSheet':
      return ambientDimension === 3
  }
}
