/* Cylinder dimension-register stages from PGF 3.1.11a. This evaluator only
 * classifies the divisor; it neither rounds paint nor rewrites authored values.
 * Independent TeX scanner/stage traces accompany the cylinder fitting fixtures. */
import type { PointNodeDimensionField, PointNodeDimensionSource, PointStyle } from '../../model/types.ts'
import { clonePointNodeDimensionSource, resolvePointNodeLayoutOptions } from '../../model/pointNodeLayout.ts'
import { resolvePointShapeParameters } from '../../model/pointShapeParameters.ts'
import type { PointNodeShapeInput } from './types.ts'

const spPerPt = 65536

export type CylinderDimensionSources = Partial<Record<PointNodeDimensionField, PointNodeDimensionSource>>

export type CylinderDomainContext = {
  dimensionSources: CylinderDimensionSources
  borderRotate: number
  borderUsesIncircle: boolean
}

export function cylinderDomainContextForStyle(style: Pick<PointStyle, 'size' | 'paint' | 'layout' | 'importedLayout' | 'shapeParameters'>): CylinderDomainContext {
  const parameters = resolvePointShapeParameters(style.shapeParameters)
  return { dimensionSources: cylinderDimensionSourcesForStyle(style), borderRotate: parameters.borderRotate,
    borderUsesIncircle: parameters.borderUsesIncircle }
}

/** Match the dimensions PGF actually receives. Direct/local layout options use
 * the existing exporter's six-decimal resolved pt literals. A named imported
 * style can override those preceding literals with its raw inherited options;
 * only its unchanged, unoverridden baseline supplies raw unit/context scans.
 * This source choice is runtime-only and does not canonicalize saved options. */
export function cylinderDimensionSourcesForStyle(style: Pick<PointStyle, 'size' | 'paint' | 'layout' | 'importedLayout'>):
  CylinderDimensionSources {
  const resolved = resolvePointNodeLayoutOptions(style)
  const intent = style.importedLayout
  const result: Partial<Record<PointNodeDimensionField, PointNodeDimensionSource>> = {}
  for (const field of ['innerXSep', 'innerYSep', 'minimumWidth'] as const) {
    const inherited = intent !== undefined && !intent.overriddenFields.includes(field)
      && style.layout?.[field] === intent.baseline[field]
    const source = inherited ? intent.baseline.units?.[field] : undefined
    if (source) result[field] = clonePointNodeDimensionSource(source, intent!.baseline.fontContext)
    else {
      const texPoints = Number(resolved[field].toFixed(6)) || 0
      result[field] = { source: `${texPoints}pt`, unit: 'pt', texPoints }
    }
  }
  return result
}

/** TeX scans a magnitude first and applies the sign afterwards. In particular
 * both positive and negative half-sp ties survive, unlike Math.round(-.5). */
export function scanTexPointsToSp(points: number): number {
  return Math.sign(points) * Math.floor(Math.abs(points) * spPerPt + .5) || 0
}

function scanDimension(value: number, unitScale: number, source?: PointNodeDimensionSource): number {
  if (!source) return scanTexPointsToSp(value / unitScale)
  const literal = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(pt|mm|cm|in|bp|em|ex)?\s*$/.exec(source.source)
  if (!literal) return scanTexPointsToSp(value / unitScale)
  const coefficient = scanTexPointsToSp(Number(literal[1]))
  switch (source.unit) {
    case 'pt': return coefficient
    case 'mm': return Math.trunc(coefficient * 7227 / 2540) || 0
    case 'cm': return Math.trunc(coefficient * 7227 / 254) || 0
    case 'in': return Math.trunc(coefficient * 7227 / 100) || 0
    case 'bp': return Math.trunc(coefficient * 7227 / 7200) || 0
    case 'em': return Math.trunc(coefficient * scanTexPointsToSp(source.fontContext?.fontSizePt ?? 10) / spPerPt) || 0
    case 'ex': return Math.trunc(coefficient * scanTexPointsToSp(source.fontContext?.xHeightPt ?? 4.30554) / spPerPt) || 0
  }
}

export type CylinderDimensionDomain = {
  innerXSp: number
  innerYSp: number
  bodyWidthHalfSp: number
  bodyHeightHalfSp: number
  bodyDepthHalfSp: number
  initialXSp: number
  initialYSp: number
  fittedXSp: number
  fittedYSp: number
  transverseInnerSepSp: number
  minimumWidthSp: number
  minimumWidthHalfSp: number
  divisorSp: number
}

/** rotation is the already resolved PGF cylinder rotation. Dimensional .5
 * products truncate separately before each advance; the incircle coefficient
 * has its own 16-bit scan, distinct from scalar divide/reciprocal arithmetic. */
export function cylinderDimensionDomain(input: PointNodeShapeInput, rotation: number, incircle: boolean): CylinderDimensionDomain {
  const scale = input.unitScale ?? 1
  const innerXSp = scanDimension(input.innerXSep, scale, input.dimensionSources?.innerXSep)
  const innerYSp = scanDimension(input.innerYSep, scale, input.dimensionSources?.innerYSep)
  const bodyWidthHalfSp = Math.trunc(scanTexPointsToSp(input.body.width / scale) / 2)
  const bodyHeightHalfSp = Math.trunc(scanTexPointsToSp(input.body.height / scale) / 2)
  const bodyDepthHalfSp = Math.trunc(scanTexPointsToSp(input.body.depth / scale) / 2)
  const initialXSp = innerXSp + bodyWidthHalfSp
  const initialYSp = innerYSp + bodyHeightHalfSp + bodyDepthHalfSp
  let fittedXSp = initialXSp, fittedYSp = initialYSp, transverseInnerSepSp = innerYSp
  if (incircle) {
    const coefficient = scanTexPointsToSp(1.414213)
    fittedXSp = fittedYSp = Math.trunc(Math.max(initialXSp, initialYSp) * coefficient / spPerPt) || 0
  } else if (rotation === 90 || rotation === 270) {
    fittedXSp = initialYSp; fittedYSp = initialXSp; transverseInnerSepSp = innerXSp
  }
  const minimumWidthSp = scanDimension(input.minimumWidth, scale, input.dimensionSources?.minimumWidth)
  const minimumWidthHalfSp = Math.trunc(minimumWidthSp / 2) || 0
  return { innerXSp, innerYSp, bodyWidthHalfSp, bodyHeightHalfSp, bodyDepthHalfSp, initialXSp, initialYSp,
    fittedXSp, fittedYSp, transverseInnerSepSp, minimumWidthSp, minimumWidthHalfSp,
    divisorSp: Math.max(fittedYSp, minimumWidthHalfSp) }
}
