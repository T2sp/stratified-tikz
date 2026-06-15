import type {
  AmbientDimension,
  CurveStratum,
  PointStratum,
  SheetStratum,
} from '../../model/types.ts'
import { sheetVertices } from '../../model/sheets.ts'
import { describeCurvePoints, formatVec3 } from '../inspectorSummary.ts'

export function formatSelectedGeometry(
  stratum: SheetStratum | CurveStratum | PointStratum,
  ambientDimension: AmbientDimension,
): string {
  switch (stratum.geometricKind) {
    case 'sheet':
      return sheetVertices(stratum)
        .map(
          (vertex, index) =>
            `${stratum.kind === 'quadSheet' ? 'Corner' : 'Vertex'} ${index + 1} ${formatVec3(vertex, ambientDimension)}`,
        )
        .join('; ')
    case 'curve':
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
