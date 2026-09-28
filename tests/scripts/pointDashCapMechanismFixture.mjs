import { dashCapMechanismCases, dashCapMechanismColumns, dashCapMechanismGrid } from '../../scripts/pointDashCapMechanismContract.mjs'

// Synthetic policy transport only. This never supplies native acceptance or a
// geometric oracle, and retains no serialized multi-megabyte closure payload.
export function syntheticMechanismEvidence() {
  return { result: 'passed', scope: 'supplemental native SVG geometry; App pointer matrix remains separately required', fixture: 'synthetic policy validation; not native acceptance', cases: dashCapMechanismCases.map((specification) => {
    const spec = structuredClone(specification), empty = spec.cap === 'butt'
    const row = ({ x, y }) => {
      const paintDistance = empty ? null : Math.hypot(Math.max(0, Math.abs(x) - 23), Math.max(0, Math.abs(y) - 23))
      const solidDistance = Math.max(0, Math.hypot(x, y) - 20), inside = Math.abs(x) < 5 && Math.abs(y) < 5
      const minimum = Math.min(paintDistance ?? Infinity, solidDistance), painted = paintDistance === 0
      return [x, y, painted ? 255 : 0, solidDistance === 0 ? 255 : 0, paintDistance, solidDistance, inside, painted, painted,
        inside || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain', minimum, paintDistance, inside || minimum <= 6]
    }
    const samples = []
    for (let y = -32; y <= 32; y += 2) for (let x = -32; x <= 32; x += 2) samples.push(row({ x, y }))
    const vertices = spec.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y } })
    return { key: spec.key, result: 'passed', specification: spec, source: { kind: 'literal-independent-SVG', rawPoints: spec.points, vertices, model: spec.model ?? null },
      native: { vertices: vertices.map(({ x, y }) => ({ x: Math.fround(x), y: Math.fround(y) })), pathLength: 40,
        browser: { version: 'synthetic-browser-policy-fixture', userAgent: 'synthetic policy validation; not native acceptance' }, ctm: { a: 1, b: 0, c: 0, d: 1, e: 64, f: 64 },
        stroke: { width: spec.width, pattern: spec.pattern, phase: spec.phase, cap: spec.cap, join: spec.join, miterLimit: spec.miterLimit, fill: 'none' } },
      raster: { resolution: 16, half: 64, side: 2048, uncertainty: .14, alphaThreshold: 128 }, paint: { bounds: empty ? null : { minX: -23, minY: -23, maxX: 23, maxY: 23 }, radius: empty ? 0 : 32.49 },
      grid: { ...dashCapMechanismGrid }, columns: [...dashCapMechanismColumns], geometry: { bounds: { minX: -23, minY: -23, maxX: 23, maxY: 23 }, radius: 33, capBounds: empty ? null : { minX: -23, minY: -23, maxX: 23, maxY: 23 }, capRadius: empty ? 0 : 32.5, familyCount: empty ? 0 : 4 },
      samples, probes: (spec.probes ?? []).map(row), counts: { hits: samples.filter((r) => r[9] === 'hit').length, misses: samples.filter((r) => r[9] === 'miss').length, uncertain: samples.filter((r) => r[9] === 'uncertain').length }, mismatches: [] }
  }) }
}
