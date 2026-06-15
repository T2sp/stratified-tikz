import type { CurveStratum } from '../model/types'

export function shouldRenderSvgGeometryHandles(
  showGeometryHandles: boolean,
  canDragGeometryHandles: boolean,
): boolean {
  return showGeometryHandles && canDragGeometryHandles
}

export function vertexHandleLabel(index: number): string {
  return `Vertex ${index + 1}`
}

export function curveHandleLabel(kind: CurveStratum['kind'], index: number): string {
  if (kind === 'polyline') {
    return vertexHandleLabel(index)
  }

  switch (index) {
    case 0:
      return 'Start'
    case 1:
      return 'Control point 1'
    case 2:
      return 'Control point 2'
    case 3:
      return 'End'
    default:
      return `Point ${index + 1}`
  }
}
