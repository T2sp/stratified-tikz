import type {
  AmbientDimension,
  CurveStratum,
  PointStratum,
  SheetStratum,
} from '../../model/types.ts'
import { describeCurvePoints, formatVec3 } from '../inspector.ts'

export function formatSelectedGeometry(
  stratum: SheetStratum | CurveStratum | PointStratum,
  ambientDimension: AmbientDimension,
): string {
  switch (stratum.geometricKind) {
    case 'sheet':
      return stratum.corners
        .map(
          (corner, index) =>
            `Corner ${index + 1} ${formatVec3(corner, ambientDimension)}`,
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
