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

export type SvgCoordinateAnchorMarkerAppearance = {
  haloRadius: number
  dotRadius: number
  selectedRadius: number
  hitRadius: number
  haloStrokeDasharray: string
}

export const coordinateAnchorMarkerClassNames = {
  marker: 'coordinate-anchor-marker',
  halo: 'coordinate-anchor-marker__halo',
  dot: 'coordinate-anchor-marker__dot',
  selection: 'coordinate-anchor-marker__selection',
} as const

export const coordinateAnchorMarkerAppearance: SvgCoordinateAnchorMarkerAppearance = {
  haloRadius: 7,
  dotRadius: 2.6,
  selectedRadius: 10,
  hitRadius: 11,
  haloStrokeDasharray: '1.5 2',
}

export const coordinateAnchorMarkerHitRadius =
  coordinateAnchorMarkerAppearance.hitRadius

export function shouldRenderSvgCoordinateAnchorMarkers(
  showCoordinateAnchors: boolean,
): boolean {
  return showCoordinateAnchors
}

export function svgCoordinateAnchorMarkersForPreview(
  diagram: Diagram,
  camera: Diagram['camera'],
  viewportHeight: number,
  selectedElement: SelectedElement,
  showCoordinateAnchors: boolean,
): SvgCoordinateAnchorMarker[] {
  return shouldRenderSvgCoordinateAnchorMarkers(showCoordinateAnchors)
    ? svgCoordinateAnchorMarkers(diagram, camera, viewportHeight, selectedElement)
    : []
}

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

export function hitTestSvgCoordinateAnchorMarkers(
  markers: readonly SvgCoordinateAnchorMarker[],
  point: Vec2,
): SvgCoordinateAnchorMarker | null {
  let bestMarker: SvgCoordinateAnchorMarker | null = null
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestIndex = -1

  markers.forEach((marker, index) => {
    const distanceSquared = squaredDistance(marker.center, point)
    const hitRadiusSquared = marker.hitRadius * marker.hitRadius

    if (distanceSquared > hitRadiusSquared) {
      return
    }

    if (
      bestMarker === null ||
      distanceSquared < bestDistanceSquared ||
      (distanceSquared === bestDistanceSquared && index > bestIndex)
    ) {
      bestMarker = marker
      bestDistanceSquared = distanceSquared
      bestIndex = index
    }
  })

  return bestMarker
}

function squaredDistance(left: Vec2, right: Vec2): number {
  const dx = left.x - right.x
  const dy = left.y - right.y

  return dx * dx + dy * dy
}
