/** Bounded PGF 3.1.11a fixed-point/table arithmetic in TeX points. Separately
 * named LPPL 1.3c adaptation; source hashes accompany independent fixtures. */
const degree = Math.PI / 180
export const pgfRound = (value: number): number => Math.round(value * 65536) / 65536
/** TeX scans the scalar into a 16-bit fraction before dimensional multiplication. */
export const pgfMultiply = (factor: number, value: number, scale = 1): number => Math.trunc(pgfRound(factor) * pgfRound(value / scale) * 65536) / 65536 * scale
const tableValue = (value: number): number => Number(value.toFixed(5))

/** PGF's divide macro decreases a printed decimal divisor rather than using
 * floating division; its late decimal digits affect saved miter angles. */
export function pgfDivide(numerator: number, denominator: number): number {
  numerator = pgfRound(numerator); denominator = pgfRound(denominator)
  if (denominator === 0) throw new RangeError('A zero value cannot divide a PGF dimension.')
  if (Number.isInteger(denominator)) return Math.trunc(numerator * 65536 / denominator) / 65536
  const sign = Math.sign(numerator) * Math.sign(denominator)
  let x = Math.abs(numerator), y = Math.abs(denominator)
  if (y < 1) return sign * pgfMultiply(pgfReciprocal(y), x)
  let result = '0', period = false
  const small = pgfRound(.00002)
  for (let iteration = 0; iteration < 128 && x > small && y > small; iteration += 1) {
    if (y > x) {
      if (!period) { result += '.'; period = true }
      y = pgfRound(Number(y.toFixed(5)) / 10)
      if (y > x) result += '0'
    } else {
      let count = Math.trunc(Math.round(x * 65536) / Math.round(y * 65536))
      x = pgfRound(x - count * y)
      if (period && count > 9) {
        const digits = Math.min(result.split('.')[1]?.length ?? 0, 5)
        result = String(pgfRound(Number(result) + 10 ** -digits))
        count -= 10
        if (count === 0) continue
      }
      result += String(count)
    }
  }
  return sign * pgfRound(Number(result))
}

export function pgfReciprocal(value: number): number {
  value = pgfRound(value)
  if (value === 0) throw new RangeError('A zero value cannot be inverted by PGF.')
  const sign = Math.sign(value)
  // PGF parses TeX's printed five decimal digits, rather than the binary fraction.
  value = Number(Math.abs(value).toFixed(5))
  if (Number.isInteger(value)) return sign * Math.trunc(65536 / value) / 65536
  if (Math.trunc(value) > 100) return sign * Math.trunc(Math.trunc(1e9 / Math.trunc(value * 1000)) * 65536 / 1e6) / 65536
  const inverse = Math.trunc(1e9 / Math.round(value * 100000))
  const whole = Math.trunc(inverse / 10000)
  let fraction = (inverse - whole * 10000) * 65536
  // TeX's .1 dimension factor is 6554sp/65536, and each multiplication truncates.
  for (let index = 0; index < 4; index += 1) fraction = Math.trunc(fraction * 6554 / 65536)
  return sign * (whole + fraction / 65536)
}

export function pgfCos(angle: number): number {
  let normalized = ((pgfRound(angle) % 360) + 360) % 360
  if (normalized > 180) normalized = 360 - normalized
  const index = Math.floor(normalized), fraction = pgfRound(normalized - index)
  const first = tableValue(Math.cos(index * degree)), second = tableValue(Math.cos((index + 1) * degree))
  return pgfMultiply(first, 1 - fraction) + pgfMultiply(second, fraction)
}
export function pgfSin(angle: number): number { return pgfCos(angle - 90) }
export function pgfTan(angle: number): number { return pgfMultiply(pgfReciprocal(pgfCos(angle)), pgfSin(angle)) }
export function pgfCot(angle: number): number { return pgfMultiply(pgfReciprocal(pgfSin(angle)), pgfCos(angle)) }
export function pgfAsin(value: number): number {
  value = pgfRound(value)
  if (Math.abs(value) > 1) throw new RangeError('The cylinder or arc parameters exceed PGF’s asin domain.')
  const scaled = Math.abs(value) * 1000, index = Math.floor(scaled), fraction = pgfRound(scaled - index)
  const first = pgfRound(tableValue(Math.acos(index / 1000) / degree))
  const next = index === 1000 ? first : pgfRound(tableValue(Math.acos((index + 1) / 1000) / degree))
  return Math.sign(value) * pgfRound(90 - pgfRound(first + pgfRound((next - first) * fraction)))
}

function pgfAtan(value: number): number {
  value = pgfRound(value)
  const original = value
  value = Math.abs(value)
  if (value > 1) value = pgfReciprocal(value)
  const scaled = value * 1000, index = Math.floor(scaled), fraction = pgfRound(scaled - index)
  const first = pgfRound(tableValue(Math.atan(index / 1000) / degree)), next = pgfRound(tableValue(Math.atan((index + 1) / 1000) / degree))
  let result = pgfRound(first + pgfRound((next - first) * fraction))
  if (Math.abs(original) > 1) result = 90 - result
  return Math.sign(original) * result
}
export function pgfAtan2(y: number, x: number): number {
  x = pgfRound(x); y = pgfRound(y)
  if (Math.abs(y) < .001) return x < 0 ? 180 : x > 0 ? 0 : y < 0 ? -90 : 90
  let result: number
  if (Math.abs(y) > Math.abs(x)) result = 90 - pgfAtan(pgfDivide(x, Math.abs(y)))
  else { result = pgfAtan(pgfDivide(Math.abs(y), x)); if (x < 0) result += 180 }
  return y < 0 ? -result : result
}

/** The basic circle uses an integer-normalized vector, rather than veclen. */
export function pgfCircleRadius(x: number, y: number, unitScale = 1): number {
  const angle = pgfAtan2(y / unitScale, x / unitScale)
  const nx = pgfCos(angle), ny = pgfSin(angle)
  const component = nx > ny ? x : y
  const count = Math.trunc(Math.round((nx > ny ? nx : ny) * 65536) / 255)
  return count === 0 ? x : Math.trunc(16 * Math.round(component / unitScale * 65536) / count) * 16 / 65536 * unitScale
}
