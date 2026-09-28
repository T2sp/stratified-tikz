import { dashCapScenario, dashCapCases, dashCapScales, dashCapProbeKinds, dashCapEditFields, dashCapAuditGrid } from '../../scripts/pointDashCapContract.mjs'

// Synthetic policy data only: these analytic regions exercise evidence validation,
// not the browser's dash geometry or the production geometry helper.
function syntheticEngineAudit() {
  const originalVertices = [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }]
  const solidBoundary = [[-5, -23], [5, -23], [23, -5], [23, 5], [5, 23], [-5, 23], [-23, 5], [-23, -5]]
  const solidDistanceAt = (x, y) => {
    if (Math.abs(x) <= 23 && Math.abs(y) <= 23 && Math.abs(x) + Math.abs(y) <= 28) return 0
    return Math.min(...solidBoundary.map(([ax, ay], i) => {
      const [bx, by] = solidBoundary[(i + 1) % solidBoundary.length]
      const dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
      return Math.hypot(x - ax - t * dx, y - ay - t * dy)
    }))
  }
  const counts = { hits: 0, misses: 0, uncertain: 0 }
  const samples = Array.from({ length: dashCapAuditGrid.samples }, (_, index) => {
    const x = -32 + index % 33 * 2, y = -32 + Math.floor(index / 33) * 2
    // One wide square cap extends past the bevel, while the opposite contour
    // remains a deliberate gap selected using the continuous solid neighborhood.
    const paintDistance = Math.hypot(Math.max(-23 - x, 0, x - 13), Math.max(-23 - y, 0, y - 13))
    const solidDistance = solidDistanceAt(x, y), insideContour = Math.abs(x) <= 5 && Math.abs(y) <= 5
    const distance = Math.min(paintDistance, solidDistance)
    const expected = insideContour || distance < 5.86 ? 'hit' : distance > 6.14 ? 'miss' : 'uncertain'
    counts[expected === 'hit' ? 'hits' : expected === 'miss' ? 'misses' : 'uncertain']++
    return { local: { x, y }, point: { x: 450 + x, y: 350 + y }, paintDistance, solidDistance,
      paintAlpha: paintDistance === 0 ? 255 : 0, solidAlpha: solidDistance === 0 ? 255 : 0,
      insideContour, expected, nativeStrokeContains: paintDistance === 0,
      paintCore: x > -23 && x < 13 && y > -23 && y < 13, candidates: expected === 'miss' ? [] : ['p'] }
  })
  return { grid: { ...dashCapAuditGrid }, modelUnchanged: true, originalVertices,
    solidControl: { fill: 'none', pattern: 'none', strokeWidth: 36, join: 'bevel', vertices: structuredClone(originalVertices) },
    samples, counts, mismatches: [] }
}

export function dashCapEvidence() {
  return { scenario: dashCapScenario, group: 'point-node-paint-import-persistence', result: 'passed',
    cases: dashCapCases.flatMap((specification) => dashCapScales.map((scale) => {
      const triangle = specification.key === 'triangle-square-wide', circle = specification.key === 'circle-square-wide'
      const radius = specification.size * .6 * Math.SQRT2
      const observation = { source: '', bodyStatus: 'ready', resolution: 16, boundaryPixelCount: 100,
        rasterRadius: triangle ? 30.3804328989 : circle ? 52.6920779446 : specification.gap ? 26.06 : 69.88,
        selectionRadius: triangle ? 30.43 : circle ? 52.75 : specification.gap ? 26.1 : 70,
        radius, contourKind: 'polygon', vertexCount: specification.shape === 'circle' ? 256 : specification.shape === 'star' ? 10 : specification.shape === 'square' ? 4 : 3, boundsEnclosePaint: true,
        declaredBounds: triangle ? [-26.375, -29.6875, 27, 23.6875] : [-70, -70, 70, 70],
        rasterBounds: triangle ? { minX: -26.375, minY: -29.6875, maxX: 27, maxY: 23.6875 } : { minX: -70, minY: -70, maxX: 70, maxY: 70 },
        ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 }, strokeWidth: specification.widthPt * 1.2,
        cap: 'square', join: 'bevel', fill: 'none', miterLimit: 10, pattern: (specification.pattern ?? [3, 3]).map((n) => `${n * 1.2}px`).join(', '), phase: specification.phase * 1.2,
        ...(specification.audit ? { engineAudit: syntheticEngineAudit() } : {}) }
      return { key: specification.key, scale, specification: structuredClone(specification), modelUnchanged: true, observation,
        edits: triangle ? dashCapEditFields.map((field, i) => ({ field, sameNode: true, modelChanged: true,
          probe: { alpha: 255, nativeStrokeContains: true, selectionCleared: true, local: { x: 0, y: -24 },
            screenshot: `${dashCapScenario}-${specification.key}-scale-${scale}-edit-${field}.screen.png`,
            transform: { ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 } },
            actions: [false, true, true, true].map((alt, index) => ({ alt, trusted: true, overlayExcluded: true, candidates: ['control', 'p'],
              screen: { x: 10, y: 20 - 24 * scale }, point: { x: 450, y: 326 }, selection: { id: !alt || index % 2 === 0 ? 'p' : 'control' } })) },
          observation: { ...structuredClone(observation), cap: i === 0 ? 'butt' : 'square', pattern: i < 2 ? '3.6px, 3.6px' : '12px, 2.4px', phase: i === 3 ? 8.4 : 0,
            declaredBounds: i === 0 ? [-26.5, -30, 27.5, 24] : observation.declaredBounds } })) : [],
        probes: dashCapProbeKinds(specification).map((kind) => {
          const auditSample = kind === 'audit-cap' ? observation.engineAudit.samples.find((sample) => sample.paintCore && sample.solidDistance > .3 && !sample.insideContour)
            : kind === 'audit-outside' ? observation.engineAudit.samples.filter((sample) => sample.expected === 'miss').sort((a, b) => Math.min(a.paintDistance, a.solidDistance) - Math.min(b.paintDistance, b.solidDistance))[0] : undefined
          const local = auditSample?.local ?? (kind.startsWith('exact') ? specification.exact[Number(kind.slice(6))] : kind === 'outside' ? specification.exterior : kind === 'gap' ? { x: 0, y: radius } : { x: 0, y: 0 })
          const exterior = ['outside', 'audit-outside'].includes(kind), candidates = exterior ? ['control'] : ['control', 'p']
          return { kind, local, alpha: auditSample?.paintAlpha ?? (['outside', 'gap'].includes(kind) ? 0 : 255), nativeStrokeContains: auditSample?.nativeStrokeContains ?? !['outside', 'gap'].includes(kind), rasterDistance: auditSample?.paintDistance ?? (kind === 'outside' ? 10 : kind === 'gap' ? 4 : 0),
            selectionCleared: true, screenshot: `${dashCapScenario}-${specification.key}-scale-${scale}-${kind}.png`,
            transform: { ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 } },
            actions: [false, true, true, true].map((alt, i) => ({ alt, trusted: true, overlayExcluded: true, candidates: [...candidates],
              screen: { x: scale * local.x + 10, y: scale * local.y + 20 }, point: { x: 450 + local.x, y: 350 + local.y },
              selection: { id: !alt ? exterior ? 'control' : 'p' : candidates[i % candidates.length] } })) }
        }) }
    })) }
}
