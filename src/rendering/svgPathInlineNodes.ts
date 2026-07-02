import {
  pathInlineNodePoint,
} from '../model/pathInlineNodes.ts'
import type {
  AmbientDimension,
  CurveStratum,
  PathInlineNode,
  PathInlineNodePlacement,
  Vec2,
  Vec3,
} from '../model/types.ts'

export type SvgPathInlineNodePreview = {
  id: string
  pathId: string
  center: Vec2
  text: string
  placement: PathInlineNodePlacement
  marker: PathInlineNode['options']['marker']
  labelOffset: Vec2
}

const labelOffsetDistance = 14
export const maxSvgPathInlineNodePreviews = 128

export function pathInlineNodesForSvgPreview(
  curve: CurveStratum,
  ambientDimension: AmbientDimension,
  project: (point: Vec3) => Vec2,
): SvgPathInlineNodePreview[] {
  return (curve.inlineNodes ?? [])
    .slice(0, maxSvgPathInlineNodePreviews)
    .flatMap((node) => {
      const modelPoint = pathInlineNodePoint(curve, node, ambientDimension)

      if (modelPoint === null) {
        return []
      }

      const center = project(modelPoint)

      if (!isFiniteVec2(center)) {
        return []
      }

      const placement = node.options.placement ?? 'above'

      return [
        {
          id: node.id,
          pathId: curve.id,
          center,
          text: node.text,
          placement,
          marker: node.options.marker ?? 'none',
          labelOffset: placementOffset(placement),
        },
      ]
    })
}

export function placementOffset(placement: PathInlineNodePlacement): Vec2 {
  switch (placement) {
    case 'above':
      return { x: 0, y: -labelOffsetDistance }
    case 'below':
      return { x: 0, y: labelOffsetDistance }
    case 'left':
      return { x: -labelOffsetDistance, y: 0 }
    case 'right':
      return { x: labelOffsetDistance, y: 0 }
    case 'center':
      return { x: 0, y: 0 }
  }
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
