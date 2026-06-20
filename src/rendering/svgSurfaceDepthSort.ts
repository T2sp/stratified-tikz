import type {
  Camera,
  Diagram,
  SheetStratum,
  VisibilityOptions,
} from '../model/types.ts'
import { surfaceDepthSortEnabled } from '../model/visibility.ts'
import { shouldRenderStratumInSvgPreview } from './svgPreviewPolicy.ts'
import { projectToSvgPoint } from './svgProjection.ts'
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
    return extractProjectedRenderPrimitives(diagram, { camera })
      .filter(
        (primitive): primitive is ProjectedSurfaceFace =>
          primitive.kind === 'surfaceFace' && sheetById.has(primitive.sourceId),
      )
      .sort((left, right) =>
        compareProjectedSurfaceFaces(left, right, visibilityOptions),
      )
      .flatMap((face): SvgSortedSurfaceFace[] => {
        const sheet = sheetById.get(face.sourceId)

        if (sheet === undefined) {
          return []
        }

        const points = face.vertices3D.map((vertex) =>
          projectToSvgPoint(camera, vertex, viewportHeight),
        )

        return points.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        )
          ? [
              {
                sheet,
                face,
                points: svgPointList(points),
              },
            ]
          : []
      })
  } catch {
    return null
  }
}
