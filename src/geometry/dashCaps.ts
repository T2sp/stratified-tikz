import type { Vec2 } from '../model/types.ts'

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type Repetitions = { first: number; last: number; step: number }
type CapFamily = Repetitions & { sign: -1 | 1 } & (
  { kind: 'line'; origin: Vec2; tangent: Vec2 }
  | { kind: 'circle'; radius: number })
export type DashCaps = {
  families: CapFamily[]; halfWidth: number; cap: 'square' | 'round' | 'butt'
  bounds: Bounds | null; radius: number
}
type Contour = { kind: 'circle' | 'polygon'; radius: number; vertices: readonly Vec2[] }

function mod(value: number, period: number): number {
  const remainder = value % period
  return remainder < 0 ? remainder + period : remainder
}

/** A clipped arithmetic progression, without visiting every repetition. */
function repetitions(offset: number, step: number, min: number, max: number,
  includeMin: boolean, includeMax: boolean): Repetitions | null {
  // Preserve a small initial offset when the period is much larger than the
  // contour: adding a huge period to a negative remainder can round away the
  // entire offset (for example offset=5, period=1e20).
  const remainder = offset < min ? mod(min - offset, step) : 0
  let first = offset >= min ? offset : min + (remainder === 0 ? 0 : step - remainder)
  if (!includeMin && first === min) first += step
  if (first > max) return null
  const span = max - first
  let last = first + (span - mod(span, step))
  if (!includeMax && last === max) last -= step
  // When a period is below one ULP, the representable endpoint is the limit
  // of this dense family. Work/storage still depend only on pattern/vertices.
  return first <= last ? { first, last, step } : null
}

function nearest(family: Repetitions, target: number): number[] {
  const at = Math.max(family.first, Math.min(family.last, target))
  const lower = at - mod(at - family.first, family.step)
  return [family.first, family.last, Math.max(family.first, lower), Math.min(family.last, lower + family.step)]
}

const binaryNumber = new DataView(new ArrayBuffer(8))
const fractionMask = (1n << 52n) - 1n

/** Exact multiples of the smallest binary64 unit. Supported patterns have at
 * most 64 finite entries: these integers have at most 2104 bits, independent
 * of dash count around the contour. Used only for extreme dynamic ranges. */
function binaryUnits(value: number): bigint {
  binaryNumber.setFloat64(0, value)
  const bits = binaryNumber.getBigUint64(0)
  const exponent = Number((bits >> 52n) & 2047n)
  const significand = (bits & fractionMask) | (exponent === 0 ? 0n : 1n << 52n)
  const magnitude = significand << BigInt(Math.max(0, exponent - 1))
  return bits >> 63n ? -magnitude : magnitude
}

function localNumber(units: bigint): number {
  if (units < 0n) return -localNumber(-units)
  const shift = Math.max(0, units.toString(2).length - 53)
  let leading = units >> BigInt(shift)
  if (shift > 0) {
    const remainder = units - (leading << BigInt(shift)), halfway = 1n << BigInt(shift - 1)
    if (remainder > halfway || (remainder === halfway && (leading & 1n) !== 0n)) leading++
  }
  return Number(leading) * 2 ** (shift - 1074)
}

function exactMod(value: bigint, period: bigint): bigint {
  const remainder = value % period
  return remainder < 0n ? remainder + period : remainder
}

function exactRepetitions(offset: bigint, step: bigint, min: bigint, max: bigint,
  includeMin: boolean, includeMax: boolean): { first: bigint; last: bigint } | null {
  const remainder = offset < min ? (min - offset) % step : 0n
  let first = offset >= min ? offset : min + (remainder === 0n ? 0n : step - remainder)
  if (!includeMin && first === min) first += step
  if (first > max) return null
  let last = first + ((max - first) / step) * step
  if (!includeMax && last === max) last -= step
  return first <= last ? { first, last } : null
}

/**
 * Actual dash endpoints on a closed contour. Families encode arbitrarily short
 * positive-total patterns in O(pattern length * edge count) space and work.
 * There is no path tessellation or loop proportional to perimeter / period.
 * A dash crossing a corner keeps going; it does not acquire an extra cap.
 */
export function createDashCaps(contour: Contour, width: number, pattern: readonly number[] | undefined,
  phase: number, cap: DashCaps['cap']): DashCaps {
  const result: DashCaps = { families: [], halfWidth: width / 2, cap, bounds: null, radius: 0 }
  if (!(width > 0) || !pattern?.length || cap === 'butt') return result
  if (!Number.isFinite(phase) || pattern.some((part) => !Number.isFinite(part) || part < 0)) return result
  const rawPeriod = pattern.reduce((sum, part) => sum + part, 0)
  if (!(rawPeriod > 0)) return result
  // SVG treats an all-zero off pattern as a continuous stroke. Mixed patterns
  // retain zero-length on entries (including their two endpoint caps).
  if (!pattern.some((part, index) => index % 2 === 1 && part > 0)) return result
  const smallest = Math.min(...pattern.filter((part) => part > 0))
  // Leave the ordinary paint path numeric. Extreme mixtures need exact sums,
  // phase reduction and corner comparisons: normalization alone can lose a
  // five-unit endpoint beside a 1e20 interval or underflow a tiny positive gap.
  const exactPrefix = rawPeriod / smallest > 2 ** 40 ? [0n] : null
  if (exactPrefix) for (const part of pattern) exactPrefix.push(exactPrefix.at(-1)! + binaryUnits(part))
  const exactPeriod = exactPrefix?.at(-1)
  const period = exactPeriod === undefined ? rawPeriod : localNumber(exactPeriod)
  const exactOffset = exactPeriod === undefined ? undefined : exactMod(binaryUnits(phase), exactPeriod)
  // Keep a negative remainder signed: period - 5 can round to period for a
  // huge pattern, although the five-unit shift remains visible on the contour.
  const offset = phase % period
  const suffix = new Array<number>(pattern.length + 1).fill(0)
  for (let index = pattern.length - 1; index >= 0; index--) suffix[index] = suffix[index + 1] + pattern[index]
  const endpoint = (prefix: number, remaining: number): number => offset < 0
    ? -offset >= remaining ? -offset - remaining : prefix - offset
    : prefix >= offset ? (prefix - offset) % period : (period - offset) + prefix
  const edges: { origin: Vec2; tangent: Vec2; start: number; end: number }[] = []
  let length = contour.kind === 'circle' ? 2 * Math.PI * contour.radius : 0
  if (contour.kind === 'polygon') {
    for (let i = 0; i < contour.vertices.length; i++) {
      const origin = contour.vertices[i], end = contour.vertices[(i + 1) % contour.vertices.length]
      const size = Math.hypot(end.x - origin.x, end.y - origin.y)
      if (!(size > 0)) continue
      edges.push({ origin, tangent: { x: (end.x - origin.x) / size, y: (end.y - origin.y) / size },
        start: length, end: length + size })
      length += size
    }
  }
  if (!(length > 0) || !Number.isFinite(length)) return result
  const rangeAt = (position: number | bigint, min: number, max: number, includeMin: boolean, includeMax: boolean) => {
    if (typeof position === 'number') return repetitions(position, period, min, max, includeMin, includeMax)
    const range = exactRepetitions(position, exactPeriod!, binaryUnits(min), binaryUnits(max), includeMin, includeMax)
    return range ? { first: localNumber(range.first), last: localNumber(range.last), step: period } : null
  }
  const add = (position: number | bigint, sign: -1 | 1, singleton = false, dot = false) => {
    if (contour.kind === 'circle') {
      const range = singleton ? { first: Number(position), last: Number(position), step: period }
        : rangeAt(position, 0, length, false, false)
      if (range) result.families.push({ ...range, sign, kind: 'circle', radius: contour.radius })
    } else for (const edge of edges) {
      // At an exact vertex positive dashes use the incoming tangent at both
      // ends. Zero-length dots instead leave their end on the outgoing edge.
      // A dash merely crossing the vertex does not acquire another cap.
      // Explicit seam endpoints below instead use their initial/final edge.
      const outgoing = singleton && !dot ? sign < 0 : dot && sign > 0
      let range: Repetitions | null
      if (typeof position === 'bigint') {
        const startUnits = binaryUnits(edge.start)
        const exactRange = exactRepetitions(position, exactPeriod!, startUnits, binaryUnits(edge.end),
          outgoing && edge.start !== 0, !outgoing && edge.end !== length)
        range = exactRange ? { first: localNumber(exactRange.first - startUnits),
          last: localNumber(exactRange.last - startUnits), step: period } : null
      } else {
        const absolute = singleton
          ? (position >= edge.start && position <= edge.end
            && (outgoing ? position < edge.end || position === length : position > edge.start || position === 0)
            ? { first: position, last: position, step: period } : null)
          : repetitions(position, period, edge.start, edge.end,
            outgoing && edge.start !== 0, !outgoing && edge.end !== length)
        range = absolute ? { first: absolute.first - edge.start, last: absolute.last - edge.start, step: period } : null
      }
      if (range) result.families.push({ ...range, sign, kind: 'line', origin: edge.origin, tangent: edge.tangent })
    }
  }
  let start = 0
  let rightAtStart = false, leftAtEnd = false, startsAtEnd = false
  let dotAtStart = false, dotAtEnd = false
  const tail = length % period
  const endOffset = offset >= 0 && offset >= period - tail ? offset - (period - tail) : offset + tail
  const exactEndOffset = exactPeriod === undefined ? undefined : exactMod(exactOffset! + binaryUnits(length), exactPeriod)
  for (let i = 0; i < pattern.length; i += 2) {
    const end = start + pattern[i]
    let previous = (i + pattern.length - 1) % pattern.length
    let next = (i + 1) % pattern.length
    for (let n = 0; n < pattern.length && pattern[previous] === 0; n++) previous = (previous + pattern.length - 1) % pattern.length
    for (let n = 0; n < pattern.length && pattern[next] === 0; n++) next = (next + 1) % pattern.length
    // Touching positive on intervals coalesce. A zero-length on interval is
    // still an independently capped dot, even beside a positive on interval.
    if (exactPrefix && exactPeriod !== undefined && exactOffset !== undefined && exactEndOffset !== undefined) {
      const first = exactPrefix[i], last = exactPrefix[i + 1]
      if (first === last || previous % 2 === 1) add(exactMod(first - exactOffset, exactPeriod), -1, false, first === last)
      if (first === last || next % 2 === 1) add(exactMod(last - exactOffset, exactPeriod), 1, false, first === last)
      rightAtStart ||= exactOffset >= first && exactOffset < last
      startsAtEnd ||= first < last && exactEndOffset === first
      leftAtEnd ||= (exactEndOffset > first && exactEndOffset <= last)
        || (exactEndOffset === 0n && last === exactPeriod && last > first)
      dotAtStart ||= first === last && exactOffset === first
      dotAtEnd ||= first === last && exactEndOffset === first
    } else {
      if (start === end || previous % 2 === 1) add(endpoint(start, suffix[i]), -1, false, start === end)
      if (start === end || next % 2 === 1) add(endpoint(end, suffix[i + 1]), 1, false, start === end)
      rightAtStart ||= offset >= 0 ? offset >= start && offset < end
        : offset >= -suffix[i] && offset < -suffix[i + 1]
      startsAtEnd ||= start < end && (endOffset >= 0 ? endOffset === start : endOffset === -suffix[i])
      leftAtEnd ||= (endOffset >= 0 ? endOffset > start && endOffset <= end
        : endOffset > -suffix[i] && endOffset <= -suffix[i + 1])
        || (endOffset === 0 && suffix[i + 1] === 0 && end > start)
      dotAtStart ||= start === end && (offset >= 0 ? offset === start : offset === -suffix[i])
      dotAtEnd ||= start === end && (endOffset >= 0 ? endOffset === start : endOffset === -suffix[i])
    }
    start = end + (pattern[i + 1] ?? pattern[i])
  }
  // Join the first and last painted intervals at the closepath seam, including
  // a zero-length terminal interval or a positive dash starting exactly there.
  // Only their outer endpoints retain caps. An isolated boundary dot has both
  // caps on that boundary's edge, rather than acquiring the other edge tangent.
  const firstPainted = rightAtStart || dotAtStart
  const lastPainted = leftAtEnd || startsAtEnd || dotAtEnd
  if (firstPainted && lastPainted) {
    if (!leftAtEnd) add(length, -1, true)
    if (!rightAtStart) add(0, 1, true, true)
  } else {
    if (firstPainted) {
      add(0, -1, true)
      if (!rightAtStart) add(0, 1, true, true)
    }
    if (lastPainted) {
      add(length, 1, true)
      if (!leftAtEnd) add(length, -1, true)
    }
  }
  measure(result)
  return result
}

function include(result: DashCaps, x: number, y: number) {
  const bounds = result.bounds
  if (!bounds) result.bounds = { minX: x, minY: y, maxX: x, maxY: y }
  else {
    bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y)
  }
  result.radius = Math.max(result.radius, Math.hypot(x, y))
}

function circleCandidates(family: Repetitions & { radius: number }, angles: readonly number[]): number[] {
  // Every family lies in [0, 2pi*r]; include adjacent turns at the seam.
  const candidates = [family.first, family.last]
  for (const angle of angles) {
    const position = mod(angle, 2 * Math.PI) * family.radius
    for (const turn of [-1, 0, 1]) candidates.push(...nearest(family, position + turn * 2 * Math.PI * family.radius))
  }
  return candidates
}

function measure(result: DashCaps) {
  const h = result.halfWidth
  for (const family of result.families) {
    if (family.kind === 'line') {
      const { origin, tangent: t } = family
      for (const at of [family.first, family.last]) {
        const x = origin.x + at * t.x, y = origin.y + at * t.y
        if (result.cap === 'round') {
          include(result, x - h * t.y, y + h * t.x)
          include(result, x + h * t.y, y - h * t.x)
          for (const direction of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
            if (family.sign * (direction.x * t.x + direction.y * t.y) >= 0) {
              include(result, x + h * direction.x, y + h * direction.y)
            }
          }
          const radius = Math.hypot(x, y)
          if (radius > 0 && family.sign * (x * t.x + y * t.y) >= 0) {
            result.radius = Math.max(result.radius, radius + h)
          }
        } else for (const along of [0, family.sign * h]) for (const normal of [-h, h]) {
          include(result, x + along * t.x - normal * t.y, y + along * t.y + normal * t.x)
        }
      }
    } else {
      const radial = result.cap === 'round' ? [family.radius] : [family.radius - h, family.radius + h]
      const tangential = result.cap === 'round' ? [0] : [0, family.sign * h]
      for (const r of radial) for (const t of tangential) {
        const direction = Math.atan2(t, r)
        for (const at of circleCandidates(family, [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((a) => a - direction))) {
          const angle = at / family.radius, c = Math.cos(angle), s = Math.sin(angle)
          const x = r * c - t * s, y = r * s + t * c
          if (result.cap === 'round') {
            include(result, x - h, y - h); include(result, x + h, y + h)
          } else include(result, x, y)
        }
      }
    }
  }
  if (result.cap === 'round') {
    // Circle disks are contained in the continuous circular stroke neighborhood.
    // Polygon semicircle extents above must not be replaced by full disks.
    for (const family of result.families) if (family.kind === 'circle') result.radius = family.radius + h
  }
}

/** Exact distance to the union of cap families (six-unit allowance is separate). */
export function distanceToDashCaps(point: Vec2, caps: DashCaps): number {
  const h = caps.halfWidth
  let best = Infinity
  for (const family of caps.families) {
    if (family.kind === 'line') {
      const x = point.x - family.origin.x, y = point.y - family.origin.y, t = family.tangent
      const along = x * t.x + y * t.y, normal = -x * t.y + y * t.x
      for (const at of nearest(family, along - (caps.cap === 'square' ? family.sign * h / 2 : 0))) {
        const outward = family.sign * (along - at)
        best = Math.min(best, caps.cap === 'round' ? outward >= 0
          ? Math.max(0, Math.hypot(outward, normal) - h) : Math.hypot(outward, Math.max(0, Math.abs(normal) - h))
          : Math.hypot(Math.max(0, -family.sign * (along - at), family.sign * (along - at) - h),
            Math.max(0, Math.abs(normal) - h)))
      }
    } else {
      const rho = Math.hypot(point.x, point.y), alpha = Math.atan2(point.y, point.x), r = family.radius
      const angles = [alpha, alpha + Math.PI / 2, alpha + Math.PI, alpha - Math.PI / 2]
      if (caps.cap === 'square') {
        // Stationary corner/edge distances and all changes of nearest feature.
        // Between them distance is monotone or constant, so neighboring members
        // of the arithmetic progression suffice; no angular sampling is used.
        for (const radial of [r - h, r + h]) {
          for (const tangent of [0, family.sign * h]) angles.push(alpha - Math.atan2(tangent, radial))
          if (rho > 0 && Math.abs(radial / rho) <= 1) {
            const a = Math.acos(radial / rho); angles.push(alpha - a, alpha + a)
          }
        }
        if (rho > 0 && h <= rho) {
          const a = Math.asin(family.sign * h / rho); angles.push(alpha - a, alpha - Math.PI + a)
        }
      }
      for (const at of circleCandidates(family, angles)) {
        const angle = at / r, c = Math.cos(angle), s = Math.sin(angle)
        const normal = point.x * c + point.y * s - r
        const along = family.sign * (-point.x * s + point.y * c)
        best = Math.min(best, caps.cap === 'round' ? Math.max(0, Math.hypot(normal, along) - h)
          : Math.hypot(Math.max(0, Math.abs(normal) - h), Math.max(0, -along, along - h)))
      }
    }
  }
  return best
}
