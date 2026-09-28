import { createHash } from 'node:crypto'
import { dashCapMechanismCases, dashCapMechanismColumns, dashCapMechanismGrid, dashCapMechanismStem, dashLivePaintColumns, retainedDashContainmentDisagreement } from '../../scripts/pointDashCapMechanismContract.mjs'

// Deliberately synthetic signature/dimension transport, not a rendered image.
export function syntheticMechanismLivePng(scale) {
  const bytes = Buffer.alloc(25)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes)
  bytes.writeUInt32BE(128 * scale, 16); bytes.writeUInt32BE(128 * scale, 20)
  return bytes
}
export function syntheticMechanismLiveSvg(entry) {
  const spec = entry.specification
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="-64 -64 128 128"><polygon points="${spec.points}" fill="none" stroke="#000000" stroke-width="${spec.width}" stroke-dasharray="${spec.pattern?.join(' ') ?? 'none'}" stroke-dashoffset="${spec.phase}" stroke-linecap="${spec.cap}" stroke-linejoin="${spec.join}" stroke-miterlimit="${spec.miterLimit}"></polygon></svg>`
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
      samples, probes: (spec.probes ?? []).map(row), counts: { hits: samples.filter((r) => r[9] === 'hit').length, misses: samples.filter((r) => r[9] === 'miss').length, uncertain: samples.filter((r) => r[9] === 'uncertain').length }, mismatches: [] }
    const stem = `${dashCapMechanismStem}-${spec.key}`
    entry.livePaint = { method: 'actual live SVG screenshot PNG; no SVG reconstruction', sourceFile: `${stem}.live.svg`, sourcePoints: spec.points,
      sourceSha256: createHash('sha256').update(syntheticMechanismLiveSvg(entry)).digest('hex'), columns: [...dashLivePaintColumns],
      rasterCoreContainmentDisagreements: samples.filter((r) => r[8] && !r[7]).map((r) => ({ x: r[0], y: r[1] })), captures: [1, 16].map((scale) => {
        const side = 128 * scale, png = syntheticMechanismLivePng(scale), ctm = { a: scale, b: 0, c: 0, d: scale, e: 64 * scale, f: 64 * scale }
        const liveRow = (r) => [r[0], r[1], ...(r[8] ? [0, 0, 0, 255] : [255, 255, 255, 255]), r[8], r[7]]
        return { scale, side, width: side, height: side, file: `${stem}.live-scale-${scale}.png`, sha256: createHash('sha256').update(png).digest('hex'), bytes: png.length,
          ctm, afterCtm: { ...ctm }, containmentResolutionChanges: { samples: [], probes: [] }, viewport: { width: 2048, height: 2048 }, clip: { x: 0, y: 0, width: side, height: side }, sourceUnchanged: true,
          stroke: structuredClone(entry.native.stroke), vertices: structuredClone(entry.native.vertices), pathLength: entry.native.pathLength,
          samples: samples.map(liveRow), probes: entry.probes.map(liveRow) }
      }) }
    return entry
  }) }
}
