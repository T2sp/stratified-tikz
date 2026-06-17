import { isLayerVisible } from '../model/layers.ts'
import type { Diagram, Stratum, TextLabel } from '../model/types.ts'

export function shouldRenderStratumInSvgPreview(
  diagram: Diagram,
  stratum: Stratum,
): boolean {
  return (
    isLayerVisible(diagram, stratum.layer) &&
    shouldRenderStratumGeometry(diagram.ambientDimension, stratum)
  )
}

export function shouldRenderTextLabelInSvgPreview(
  diagram: Diagram,
  label: TextLabel,
): boolean {
  return isLayerVisible(diagram, label.layer)
}

function shouldRenderStratumGeometry(
  ambientDimension: Diagram['ambientDimension'],
  stratum: Stratum,
): boolean {
  if (ambientDimension === 2) {
    return (
      (stratum.geometricKind === 'region' &&
        stratum.codim === 0 &&
        stratum.kind === 'filledRegion' &&
        stratum.visible) ||
      (stratum.geometricKind === 'curve' && stratum.codim === 1) ||
      (stratum.geometricKind === 'point' && stratum.codim === 2)
    )
  }

  return (
    (stratum.geometricKind === 'sheet' && stratum.codim === 1) ||
    (stratum.geometricKind === 'curve' && stratum.codim === 2) ||
    (stratum.geometricKind === 'point' && stratum.codim === 3)
  )
}
