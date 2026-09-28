import type { PointStyle } from '../model/types.ts'
import { getPointPaint } from '../model/styles.ts'
import { svgPointNodeTexPointScale } from './svgPointNodeGeometry.ts'

/** The emitted SVG settings, in path-local units, shared by paint and layout. */
export function effectiveSvgPointStroke(style: PointStyle) {
  const stroke = getPointPaint(style).stroke
  const pattern = stroke.dashPattern ?? (stroke.lineStyle === 'dashed' ? [3, 3]
    : stroke.lineStyle === 'dotted' ? [stroke.width, 2]
      : stroke.lineStyle === 'denselyDotted' ? [stroke.width, 1] : undefined)
  const localPattern = pattern?.map((part) => part * svgPointNodeTexPointScale)
  // Native renderers lose dash positions for huge offsets even when finite.
  // Emit the signed remainder in the *emitted* pattern's units. Ordinary
  // in-period offsets keep their spelling/sign; geometry sees this same value.
  // If conversion itself overflows, reduce in TeX units first.
  const convertedPhase = stroke.dashPhase * svgPointNodeTexPointScale
  const period = pattern?.reduce((sum, part) => sum + part, 0)
  const finitePhase = Number.isFinite(convertedPhase) ? convertedPhase : pattern === undefined ? 0
    : period && Number.isFinite(period) ? (stroke.dashPhase % period) * svgPointNodeTexPointScale : convertedPhase
  const localPeriod = localPattern?.reduce((sum, part) => sum + part, 0)
  const phase = localPeriod && Number.isFinite(localPeriod) ? finitePhase % localPeriod : finitePhase
  return {
    enabled: stroke.enabled,
    width: stroke.width * svgPointNodeTexPointScale,
    pattern: localPattern,
    phase,
    cap: stroke.lineCap === 'rect' ? 'square' as const : stroke.lineCap,
    join: stroke.lineJoin,
    miterLimit: 10,
  }
}
export type SvgPointStroke = ReturnType<typeof effectiveSvgPointStroke>

export function sameSvgPointStroke(a: SvgPointStroke, b: SvgPointStroke): boolean {
  return a.enabled === b.enabled && a.width === b.width && a.phase === b.phase
    && a.cap === b.cap && a.join === b.join && a.miterLimit === b.miterLimit
    && (a.pattern === undefined ? b.pattern === undefined : b.pattern !== undefined
      && a.pattern.length === b.pattern.length && a.pattern.every((part, i) => part === b.pattern?.[i]))
}
