import type {
  AmbientDimension,
  CurveStratum,
  PointStratum,
  SheetStratum,
} from '../../model/types.ts'
import { sheetVertices } from '../../model/sheets.ts'
import { gridPreviewSegments } from '../../model/grids.ts'
import { describeCurvePoints, formatVec3 } from '../inspectorSummary.ts'

export function formatSelectedGeometry(
  stratum: SheetStratum | CurveStratum | PointStratum,
  ambientDimension: AmbientDimension,
): string {
  switch (stratum.geometricKind) {
    case 'sheet':
      if (stratum.kind === 'curvedSheet') {
        const sampling =
          stratum.primitive.kind === 'ruledSurface'
            ? String(stratum.primitive.sampling.segments)
            : `${stratum.primitive.sampling.uSegments} x ${stratum.primitive.sampling.vSegments}`

        return `${stratum.primitive.kind}; sampling ${sampling}`
      }

      return sheetVertices(stratum)
        .map(
          (vertex, index) =>
            `${stratum.kind === 'quadSheet' ? 'Corner' : 'Vertex'} ${index + 1} ${formatVec3(vertex, ambientDimension)}`,
        )
        .join('; ')
    case 'curve':
      if (stratum.kind === 'grid') {
        const preview = gridPreviewSegments(stratum, ambientDimension)

        return preview.ok ? `${preview.lineCount} preview lines` : 'invalid grid'
      }

      return describeCurvePoints(stratum)
        .map(
          (description) =>
            `${description.label} ${formatVec3(description.point, ambientDimension)}`,
        )
        .join('; ')
    case 'point':
      return formatVec3(stratum.position, ambientDimension)
  }
}
