import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { inspectConnectedLivePaintPng } from '../../scripts/connectedLivePaintOracle.mjs'
import { dashCapMechanismCases, dashCapMechanismColumns, dashCapMechanismGrid, dashCapMechanismStem, dashLivePaintColumns, retainedDashContainmentDisagreement } from '../../scripts/pointDashCapMechanismContract.mjs'

const pngCache = new Map(), pixelCache = new Map()
const variant = (key) => ['zero-butt-control', 'zero-terminal-seam', 'zero-off-continuous', 'positive-before-corner'].includes(key) ? key : 'rectangle'
function rectangles(key) {
  if (key === 'zero-butt-control') return []
  if (key === 'zero-terminal-seam') return [[-23, -23, 13, 13], [-18, -13, 18, 23]]
  if (key === 'zero-off-continuous') return [[-23, -23, 13, 23], [-23, -13, 23, 23]]
  if (key === 'positive-before-corner') return [[-23, -23, 5, 23], [-23, -13, 23, 23]]
  return [[-23, -23, 23, 23]]
}
function chunk(name, data) {
  const type = Buffer.from(name), content = Buffer.concat([type, data]), result = Buffer.alloc(data.length + 12)
  let crc = 0xffffffff
  for (const byte of content) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0) }
  result.writeUInt32BE(data.length); content.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8)
  return result
}
// Actual lossless PNG bytes for synthetic transport only, never native paint.
// A cached simple mask permits production policy to authenticate/redecode every
// claimed pixel distance without exempting synthetic browser identities.
export function syntheticMechanismLivePng(scale, key) {
  const kind = variant(key), cacheKey = `${scale}:${kind}`
  if (!pngCache.has(cacheKey)) {
    const side = 128 * scale, stride = side * 3 + 1, raw = Buffer.alloc(side * stride, 255)
    for (let y = 0; y < side; y++) {
      raw[y * stride] = 0
      for (const [minX, minY, maxX, maxY] of rectangles(kind)) if ((y + .5) / scale - 64 >= minY && (y + .5) / scale - 64 <= maxY) {
        const left = Math.ceil((minX + 64) * scale - .5), right = Math.floor((maxX + 64) * scale - .5)
        raw.fill(0, y * stride + 1 + left * 3, y * stride + 1 + (right + 1) * 3)
      }
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(side); header.writeUInt32BE(side, 4); header[8] = 8; header[9] = 2
    pngCache.set(cacheKey, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
  }
  return pngCache.get(cacheKey)
}
export function syntheticMechanismLiveSvg(entry) {
  const spec = entry.specification
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="-64 -64 128 128"><polygon points="${spec.points}" fill="none" stroke="#000000" stroke-width="${spec.width}" stroke-dasharray="${spec.pattern?.join(' ') ?? 'none'}" stroke-dashoffset="${spec.phase}" stroke-linecap="${spec.cap}" stroke-linejoin="${spec.join}" stroke-miterlimit="${spec.miterLimit}"></polygon></svg>`
}
function pixels(scale, key, samples) {
  const cacheKey = `${scale}:${variant(key)}:${JSON.stringify(samples)}`
  if (!pixelCache.has(cacheKey)) pixelCache.set(cacheKey, inspectConnectedLivePaintPng(syntheticMechanismLivePng(scale, key), {
    ctm: { a: scale, b: 0, c: 0, d: scale, e: 64 * scale, f: 64 * scale }, samples,
    region: { minX: -64, minY: -64, maxX: 64, maxY: 64 },
  }))
  return structuredClone(pixelCache.get(cacheKey))
}
// Synthetic policy transport only. This never supplies native acceptance or a
// geometric oracle, and retains no serialized multi-megabyte closure payload.
export function syntheticMechanismEvidence() {
  return { result: 'passed', scope: 'supplemental native SVG geometry; App pointer matrix remains separately required', fixture: 'synthetic policy validation; not native acceptance', cases: dashCapMechanismCases.map((specification) => {
    const spec = structuredClone(specification), empty = spec.cap === 'butt'
    const row = ({ x, y }) => {
      let paintDistance = empty ? null : Math.hypot(Math.max(0, Math.abs(x) - 23), Math.max(0, Math.abs(y) - 23))
      if (spec.key === 'zero-terminal-seam') paintDistance = Math.min(...[[-5, -5], [0, 5]].map(([cx, cy]) => Math.hypot(Math.max(0, Math.abs(x - cx) - 18), Math.max(0, Math.abs(y - cy) - 18))))
      const solidDistance = Math.max(0, Math.hypot(x, y) - 20), inside = Math.abs(x) < 5 && Math.abs(y) < 5
      const minimum = Math.min(paintDistance ?? Infinity, solidDistance), painted = paintDistance === 0
      return [x, y, painted ? 255 : 0, solidDistance === 0 ? 255 : 0, paintDistance, solidDistance, inside, painted && !retainedDashContainmentDisagreement(spec, x, y), painted,
        inside || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain', minimum, paintDistance, inside || minimum <= 6]
    }
    const samples = []
    for (let y = -32; y <= 32; y += 2) for (let x = -32; x <= 32; x += 2) samples.push(row({ x, y }))
    const vertices = spec.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y } })
    const entry = { key: spec.key, result: 'passed', specification: spec, source: { kind: 'literal-independent-SVG', rawPoints: spec.points, vertices, model: spec.model ?? null },
      native: { vertices: vertices.map(({ x, y }) => ({ x: Math.fround(x), y: Math.fround(y) })), pathLength: 40,
        browser: { version: 'synthetic-browser-policy-fixture', userAgent: 'synthetic policy validation; not native acceptance' }, ctm: { a: 1, b: 0, c: 0, d: 1, e: 64, f: 64 },
        stroke: { width: spec.width, pattern: spec.pattern, phase: spec.phase, cap: spec.cap, join: spec.join, miterLimit: spec.miterLimit, fill: 'none' } },
      raster: { resolution: 16, half: 64, side: 2048, uncertainty: .14, alphaThreshold: 128 }, paint: { bounds: empty ? null : { minX: -23, minY: -23, maxX: 23, maxY: 23 }, radius: empty ? 0 : 32.49 },
      grid: { ...dashCapMechanismGrid }, columns: [...dashCapMechanismColumns], geometry: { bounds: { minX: -23, minY: -23, maxX: 23, maxY: 23 }, radius: 33, capBounds: empty ? null : { minX: -23, minY: -23, maxX: 23, maxY: 23 }, capRadius: empty ? 0 : 32.5, familyCount: empty ? 0 : 4 },
      samples, probes: (spec.probes ?? []).map(row), counts: { hits: samples.filter((r) => r[9] === 'hit').length, misses: samples.filter((r) => r[9] === 'miss').length, uncertain: samples.filter((r) => r[9] === 'uncertain').length } }
    const stem = `${dashCapMechanismStem}-${spec.key}`, all = [...samples, ...entry.probes].map(([x, y]) => ({ local: { x, y } }))
    entry.livePaint = { method: 'actual live SVG screenshot PNG; no SVG reconstruction', sourceFile: `${stem}.live.svg`, sourcePoints: spec.points,
      sourceSha256: createHash('sha256').update(syntheticMechanismLiveSvg(entry)).digest('hex'), columns: [...dashLivePaintColumns],
      rasterCoreContainmentDisagreements: samples.filter((r) => r[8] && !r[7]).map((r) => ({ x: r[0], y: r[1] })), captures: [1, 16].map((scale) => {
        const side = 128 * scale, png = syntheticMechanismLivePng(scale, spec.key), ctm = { a: scale, b: 0, c: 0, d: scale, e: 64 * scale, f: 64 * scale }, pixelDistances = pixels(scale, spec.key, all)
        const liveRow = (r, i) => [r[0], r[1], ...pixelDistances.samples[i].rgba, pixelDistances.samples[i].paintCore, r[7]]
        return { scale, side, width: side, height: side, file: `${stem}.live-scale-${scale}.png`, sha256: createHash('sha256').update(png).digest('hex'), bytes: png.length,
          ctm, afterCtm: { ...ctm }, containmentResolutionChanges: { samples: [], probes: [] }, viewport: { width: 2048, height: 2048 }, clip: { x: 0, y: 0, width: side, height: side }, sourceUnchanged: true,
          stroke: structuredClone(entry.native.stroke), vertices: structuredClone(entry.native.vertices), pathLength: entry.native.pathLength, pixelDistances,
          samples: samples.map(liveRow), probes: entry.probes.map((r, i) => liveRow(r, samples.length + i)) }
      }) }
    const capture = entry.livePaint.captures[1]
    const liveRow = (r, i) => {
      const paintDistance = capture.pixelDistances.samples[i].paintDistance, minimum = Math.min(paintDistance ?? Infinity, r[5])
      r[10] = minimum; r[12] = r[6] || minimum <= 6
      return { local: { x: r[0], y: r[1] }, paintDistance, solidDistance: r[5], insideContour: r[6], expected: r[6] || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain', geometryDistance: minimum, hit: r[12] }
    }
    entry.interactionOracle = { method: 'connected-live-paint-plus-continuous-stroke-and-contour-interior', capture: capture.file, pngSha256: capture.sha256, sourceSha256: entry.livePaint.sourceSha256,
      tolerance: 6, uncertainty: .14, samples: samples.map(liveRow), probes: entry.probes.map((r, i) => liveRow(r, samples.length + i)), mismatches: [] }
    entry.mismatches = samples.filter((r) => r[9] !== 'uncertain' && r[12] !== (r[9] === 'hit')).map((r) => ({ local: { x: r[0], y: r[1] }, expected: r[9], hit: r[12] }))
    return entry
  }) }
}
