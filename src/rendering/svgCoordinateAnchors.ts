import type {
  CoordinateAnchor,
  Diagram,
  Vec2,
} from '../model/types.ts'
import { coordinateAnchorPositionPreview } from '../model/coordinateAnchors.ts'
import {
  isSelectedElement,
  type SelectedElement,
} from '../ui/selection.ts'
import { projectToSvgPoint } from './svgProjection.ts'

export type SvgCoordinateAnchorMarker = {
  anchor: CoordinateAnchor
  center: Vec2
  hitRadius: number
  selected: boolean
}

export const coordinateAnchorMarkerHitRadius = 11

export function svgCoordinateAnchorMarkers(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
): SvgCoordinateAnchorMarker[] {
  return (diagram.coordinateAnchors ?? []).flatMap((anchor) => {
    const marker = svgCoordinateAnchorMarker(
      diagram,
      anchor,
      camera,
      viewportHeight,
      selectedElement,
    )

    return marker === null ? [] : [marker]
  })
}

export function svgCoordinateAnchorMarker(
  diagram: Diagram,
  anchor: CoordinateAnchor,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
): SvgCoordinateAnchorMarker | null {
  try {
    const position = coordinateAnchorPositionPreview(
      anchor.position,
      diagram.ambientDimension,
    )

    return {
      anchor,
      center: projectToSvgPoint(camera, position, viewportHeight),
      hitRadius: coordinateAnchorMarkerHitRadius,
      selected: isSelectedElement(selectedElement, {
        kind: 'coordinate',
        id: anchor.id,
      }),
    }
  } catch {
    return null
  }
}
