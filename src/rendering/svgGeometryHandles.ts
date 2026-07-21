import type { CurveStratum } from '../model/types'
import type { GeometryHandleTarget } from '../ui/geometryHandles.ts'

export type SvgPointerCaptureTarget = {
  setPointerCapture: (pointerId: number) => void
  hasPointerCapture: (pointerId: number) => boolean
  releasePointerCapture: (pointerId: number) => void
}

export type SvgGeometryHandlePointerController = {
  activeTarget: () => GeometryHandleTarget | null
  begin: (
    target: GeometryHandleTarget,
    pointerId: number,
    pointerCaptureTarget: SvgPointerCaptureTarget | null,
    onDragStart?: (target: GeometryHandleTarget) => void,
  ) => void
  move: (onDrag?: (target: GeometryHandleTarget) => void) => boolean
  end: (
    pointerId: number,
    pointerCaptureTarget: SvgPointerCaptureTarget,
    onDragEnd?: () => void,
  ) => boolean
  cancel: () => boolean
}

export function createSvgGeometryHandlePointerController(): SvgGeometryHandlePointerController {
  let activeTarget: GeometryHandleTarget | null = null

  return {
    activeTarget: () => activeTarget,
    begin: (target, pointerId, pointerCaptureTarget, onDragStart) => {
      activeTarget = target
      onDragStart?.(target)
      pointerCaptureTarget?.setPointerCapture(pointerId)
    },
    move: (onDrag) => {
      if (activeTarget === null || onDrag === undefined) {
        return false
      }

      onDrag(activeTarget)
      return true
    },
    end: (pointerId, pointerCaptureTarget, onDragEnd) => {
      if (activeTarget === null) {
        return false
      }

      activeTarget = null
      onDragEnd?.()
      releaseSvgPointerCaptureIfHeld(pointerCaptureTarget, pointerId)
      return true
    },
    cancel: () => {
      const hadActiveSession = activeTarget !== null

      activeTarget = null
      return hadActiveSession
    },
  }
}

export function releaseSvgPointerCaptureIfHeld(
  target: SvgPointerCaptureTarget,
  pointerId: number,
): void {
  if (target.hasPointerCapture(pointerId)) {
    target.releasePointerCapture(pointerId)
  }
}

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

  if (kind === 'concatenatedPath') {
    return `Path point ${index + 1}`
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
