import type {
  Camera,
  Diagram,
  SheetStratum,
  VisibilityOptions,
} from '../model/types.ts'
import {
  normalizeVisibilityMaxSurfaceFacesForSorting,
  surfaceDepthSortEnabled,
} from '../model/visibility.ts'
import { shouldRenderStratumInSvgPreview } from './svgPreviewPolicy.ts'
import { viewToSvgPoint } from './svgProjection.ts'
import { svgPointList } from './svgPath.ts'
import {
  extractProjectedRenderPrimitives,
  type ProjectedSurfaceFace,
} from './projectedPrimitives.ts'
import { compareProjectedSurfaceFaces } from './surfaceDepthSort.ts'

export type SvgSortedSurfaceFace = {
  sheet: SheetStratum
  face: ProjectedSurfaceFace
  points: string
}

export type SvgPreparedSortedSurfaceFace = {
  face: ProjectedSurfaceFace
  points: string
}

export function sortedSvgSurfaceFaces(
  diagram: Diagram,
  camera: Camera,
  viewportHeight: number,
  visibilityOptions: VisibilityOptions,
): SvgSortedSurfaceFace[] | null {
  if (
    diagram.ambientDimension !== 3 ||
    camera.mode !== '3d' ||
    !surfaceDepthSortEnabled(visibilityOptions)
  ) {
    return null
  }

  const sheetById = new Map(
    diagram.strata
      .filter(
        (stratum): stratum is SheetStratum =>
          stratum.geometricKind === 'sheet' &&
          stratum.codim === 1 &&
          shouldRenderStratumInSvgPreview(diagram, stratum),
      )
      .map((sheet) => [sheet.id, sheet]),
  )

  try {
    const faces = extractProjectedRenderPrimitives(diagram, { camera })
      .filter(
        (primitive): primitive is ProjectedSurfaceFace =>
          primitive.kind === 'surfaceFace' && sheetById.has(primitive.sourceId),
      )

    const preparedFaces = sortedPreparedSvgSurfaceFaces(
      faces,
      viewportHeight,
      visibilityOptions,
    )

    if (preparedFaces === null) {
      return null
    }

    return preparedFaces.flatMap(({ face, points }): SvgSortedSurfaceFace[] => {
        const sheet = sheetById.get(face.sourceId)

        if (sheet === undefined) {
          return []
        }

        return [{ sheet, face, points }]
      })
  } catch {
    return null
  }
}

export function sortedPreparedSvgSurfaceFaces(
  faces: readonly ProjectedSurfaceFace[],
  viewportHeight: number,
  visibilityOptions: VisibilityOptions,
): SvgPreparedSortedSurfaceFace[] | null {
  if (!surfaceDepthSortEnabled(visibilityOptions)) {
    return null
  }

  if (
    faces.length >
    normalizeVisibilityMaxSurfaceFacesForSorting(
      visibilityOptions.maxSurfaceFacesForSorting,
    )
  ) {
    return null
  }

  return [...faces]
    .sort((left, right) =>
      compareProjectedSurfaceFaces(left, right, visibilityOptions),
    )
    .flatMap((face): SvgPreparedSortedSurfaceFace[] => {
      const points = face.projectedPolygon.map((point) =>
        viewToSvgPoint(point, viewportHeight),
      )

      return points.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      )
        ? [{ face, points: svgPointList(points) }]
        : []
    })
}
