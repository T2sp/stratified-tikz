import type { Vec2 } from '../model/types'

export type SvgClientRect = {
  left: number
  top: number
  width: number
  height: number
}

export type SvgViewBoxSize = {
  width: number
  height: number
}

export function mapClientPointToViewBox(
  clientPoint: Vec2,
  bounds: SvgClientRect,
  viewBox: SvgViewBoxSize,
): Vec2 {
  const scale = Math.min(bounds.width / viewBox.width, bounds.height / viewBox.height)

  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(viewBox.width) ||
    !Number.isFinite(viewBox.height)
  ) {
    return {
      x: viewBox.width / 2,
      y: viewBox.height / 2,
    }
  }

  const visibleWidth = viewBox.width * scale
  const visibleHeight = viewBox.height * scale
  const letterboxX = (bounds.width - visibleWidth) / 2
  const letterboxY = (bounds.height - visibleHeight) / 2

  return {
    x: clamp((clientPoint.x - bounds.left - letterboxX) / scale, 0, viewBox.width),
    y: clamp((clientPoint.y - bounds.top - letterboxY) / scale, 0, viewBox.height),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
