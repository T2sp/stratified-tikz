/* PGF 3.1.11a diamond register arithmetic. Separately named LPPL 1.3c
 * adaptation; additive fixed-box stage/path/anchor references record the source.
 * In particular shape aspect has its own scanned inverse, not pgfmathreciprocal.
 */
import type { Vec2 } from '../../model/types.ts'
import type { PointNodeShapeInput } from './types.ts'

const spPerPt = 65536
/** TeX's round_decimals consumes at most 17 decimal digits. Keeping the
 * decimal spelling matters immediately below a half-sp (binary multiplication
 * can round it onto the tie before the dimensional scanner gets to see it). */
function scan(value: number): number {
  const [mantissa, exponentText] = Math.abs(value).toString().split('e')
  const [whole, fraction = ''] = mantissa!.split('.')
  const digits = whole! + fraction
  const decimal = whole!.length + Number(exponentText ?? 0)
  const integer = decimal <= 0 ? '0' : digits.slice(0, decimal).padEnd(decimal, '0')
  const decimals = (decimal < 0 ? '0'.repeat(-decimal) + digits : digits.slice(decimal)).slice(0, 17)
  let rounded = 0
  for (let index = decimals.length - 1; index >= 0; index -= 1) rounded = Math.trunc((rounded + Number(decimals[index]) * 131072) / 10)
  return Math.sign(value) * (Number(integer) * spPerPt + Math.trunc((rounded + 1) / 2)) || 0
}
const multiply = (scalarSp: number, valueSp: number): number => Math.trunc(scalarSp * valueSp / spPerPt) || 0

export type DiamondFitting = {
  anchorAxes: Vec2
  paintedAxes: Vec2
  stages: {
    aspectSp: number; aspectEighthSp: number; inverseSp: number
    initialXSp: number; initialYSp: number; aspectYSp: number; inverseXSp: number
    fittedXSp: number; fittedYSp: number; minimumWidthHalfSp: number; minimumHeightHalfSp: number
    limitedXSp: number; limitedYSp: number; outerXSp: number; outerYSp: number
    anchorXSp: number; anchorYSp: number; paintedXSp: number; paintedYSp: number
  }
}

/** Follow the source's scan, .125 product, count conversion and 8192pt integer
 * divide in that order. Every dimension product truncates before its advance;
 * minima apply independently before clearance. unitScale changes only units.
 */
export function fitDiamond(input: PointNodeShapeInput, aspect: number): DiamondFitting {
  const scale = input.unitScale ?? 1
  const dimension = (value: number): number => scan(value / scale)
  const half = (value: number): number => Math.trunc(dimension(value) / 2) || 0
  const aspectSp = scan(aspect)
  const aspectEighthSp = Math.trunc(aspectSp / 8)
  if (aspectEighthSp === 0) throw new RangeError('The diamond aspect inverse has a zero PGF divisor.')
  const inverseSp = Math.trunc(8192 * spPerPt / aspectEighthSp)
  const initialXSp = half(input.body.width) + dimension(input.innerXSep)
  const initialYSp = half(input.body.height) + half(input.body.depth) + dimension(input.innerYSep)
  const aspectYSp = multiply(aspectSp, initialYSp), inverseXSp = multiply(inverseSp, initialXSp)
  const fittedXSp = initialXSp + aspectYSp, fittedYSp = inverseXSp + initialYSp
  const minimumWidthHalfSp = half(input.minimumWidth), minimumHeightHalfSp = half(input.minimumHeight)
  const limitedXSp = Math.max(fittedXSp, minimumWidthHalfSp), limitedYSp = Math.max(fittedYSp, minimumHeightHalfSp)
  const outerXSp = dimension(input.outerXSep), outerYSp = dimension(input.outerYSep)
  const anchorXSp = limitedXSp + outerXSp, anchorYSp = limitedYSp + outerYSp
  // This documented diamond-only subtraction belongs to paint, after clearance.
  const paintedXSp = anchorXSp - multiply(scan(1.414213), outerXSp)
  const paintedYSp = anchorYSp - multiply(scan(1.414213), outerYSp)
  const axes = (x: number, y: number): Vec2 => ({ x: x / spPerPt * scale, y: y / spPerPt * scale })
  return { anchorAxes: axes(anchorXSp, anchorYSp), paintedAxes: axes(paintedXSp, paintedYSp), stages: {
    aspectSp, aspectEighthSp, inverseSp, initialXSp, initialYSp, aspectYSp, inverseXSp, fittedXSp, fittedYSp,
    minimumWidthHalfSp, minimumHeightHalfSp, limitedXSp, limitedYSp, outerXSp, outerYSp, anchorXSp, anchorYSp, paintedXSp, paintedYSp,
  } }
}
