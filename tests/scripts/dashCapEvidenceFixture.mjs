import { createHash } from 'node:crypto'
import { dashCapScenario, dashCapCases, dashCapScales, dashCapProbeKinds, dashCapEditFields, triangleDashPhaseNegatives, dashCapProbeIsMiss, dashCapAuditGrid, rawDashCapSquarePoints } from '../../scripts/pointDashCapContract.mjs'

// Synthetic policy data only: these analytic regions exercise evidence validation,
// not the browser's dash geometry or the production geometry helper.
function syntheticRegionAt(specification, x, y) {
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
  // Deliberately synthetic literal rectangles: they validate roles and policy,
  // not native dash scheduling. The terminal example retains its two dot extents.
  const rectangles = specification.key === 'square-terminal-zero' ? [[-23, -23, 13, 13], [-18, -13, 18, 23]]
    : specification.key.startsWith('square-later-zero') ? [[-23, -23, 13, 13]] : [[-23, -23, 23, 23]]
  const paintDistance = Math.min(...rectangles.map(([minX, minY, maxX, maxY]) => Math.hypot(Math.max(minX - x, 0, x - maxX), Math.max(minY - y, 0, y - maxY))))
  return { paintDistance, solidDistance: solidDistanceAt(x, y), paintCore: rectangles.some(([minX, minY, maxX, maxY]) => x > minX && x < maxX && y > minY && y < maxY) }
}
function syntheticEngineAudit(specification) {
  const originalVertices = [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }]
  const counts = { hits: 0, misses: 0, uncertain: 0 }
  const samples = Array.from({ length: dashCapAuditGrid.samples }, (_, index) => {
    const x = -32 + index % 33 * 2, y = -32 + Math.floor(index / 33) * 2
    const { paintDistance, solidDistance, paintCore } = syntheticRegionAt(specification, x, y)
    const insideContour = Math.abs(x) <= 5 && Math.abs(y) <= 5
    const distance = Math.min(paintDistance, solidDistance)
    const expected = insideContour || distance < 5.86 ? 'hit' : distance > 6.14 ? 'miss' : 'uncertain'
    counts[expected === 'hit' ? 'hits' : expected === 'miss' ? 'misses' : 'uncertain']++
    return { local: { x, y }, point: { x: 450 + x, y: 350 + y }, paintDistance, solidDistance,
      paintAlpha: paintDistance === 0 ? 255 : 0, solidAlpha: solidDistance === 0 ? 255 : 0,
      insideContour, expected, nativeStrokeContains: paintDistance === 0 && !(specification.livePaint && x > (specification.key === 'square-zero-off' ? 13 : 5) && y < -5 && x - y > 28),
      paintCore, candidates: expected === 'miss' ? [] : ['p'] }
  })
  return { model: { id: 'p', text: '', geometricKind: 'point', codim: 2, style: { shape: specification.shape, size: specification.size,
    paint: { text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#000000', opacity: 1 }, stroke: { enabled: true, color: '#000000', opacity: 1, width: specification.widthPt, lineStyle: specification.lineStyle, dashPattern: [...specification.pattern], dashPhase: specification.phase, lineCap: 'rect', lineJoin: 'bevel' } } } }, rawPoints: rawDashCapSquarePoints, pathLength: 40, browser: { version: 'synthetic policy fixture', userAgent: 'synthetic policy validation; not native acceptance' },
    raster: { resolution: 16, half: 90, side: 2880, uncertainty: .14, alphaThreshold: 128 }, grid: { ...dashCapAuditGrid }, modelUnchanged: true, originalVertices,
    solidControl: { fill: 'none', pattern: 'none', strokeWidth: 36, join: 'bevel', vertices: structuredClone(originalVertices) },
    samples, counts, mismatches: [] }
}

export function dashCapEvidence() {
  return { fixture: 'synthetic policy validation; not native acceptance', scenario: dashCapScenario, group: 'point-node-paint-import-persistence', result: 'passed',
    cases: dashCapCases.flatMap((specification) => dashCapScales.map((scale) => {
      const triangle = specification.key === 'triangle-square-wide', circle = specification.key === 'circle-square-wide'
      const radius = specification.size * .6 * Math.SQRT2
      const observation = { source: '', bodyStatus: 'ready', resolution: 16, boundaryPixelCount: 100,
        rasterRadius: triangle ? 30.3804328989 : circle ? 52.6920779446 : specification.gap ? 26.06 : 69.88,
        selectionRadius: triangle ? 30.43 : circle ? 52.75 : specification.gap ? 26.1 : 70,
        radius, contourKind: 'polygon', vertexCount: specification.shape === 'circle' ? 256 : specification.shape === 'star' ? 10 : specification.shape === 'square' ? 4 : 3, boundsEnclosePaint: true,
        declaredBounds: triangle ? [-26.375, -29.6875, 27, 23.6875] : [-70, -70, 70, 70],
        rasterBounds: triangle ? { minX: -26.375, minY: -29.6875, maxX: 27, maxY: 23.6875 } : { minX: -70, minY: -70, maxX: 70, maxY: 70 },
        ctm: { a: scale, b: 0, c: 0, d: scale, e: 450 * scale, f: 350 * scale }, strokeWidth: specification.widthPt * 1.2,
        cap: 'square', join: 'bevel', fill: 'none', miterLimit: 10, pattern: (specification.pattern ?? [3, 3]).map((n) => `${n * 1.2}px`).join(', '), phase: specification.phase * 1.2,
        ...(specification.audit ? { engineAudit: syntheticEngineAudit(specification) } : {}) }
      if (specification.livePaint) observation.livePaint = syntheticLivePaint(specification, scale, observation)
      return { key: specification.key, scale, result: 'passed', specification: structuredClone(specification), modelUnchanged: true, observation,
        edits: triangle ? dashCapEditFields.map((field, i) => ({ field, sameNode: true, modelChanged: true,
          ...(field === 'dashPhase' ? { negativeProbes: syntheticTrianglePhaseNegatives(scale) } : {}),
          probe: { alpha: 255, nativeStrokeContains: true, selectionCleared: true, local: { x: 0, y: -24 },
            screenshot: `${dashCapScenario}-${specification.key}-scale-${scale}-edit-${field}.screen.png`,
            transform: { ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 } },
            actions: [false, true, true, true].map((alt, index) => ({ alt, trusted: true, overlayExcluded: true, candidates: ['control', 'p'],
              screen: { x: 10, y: 20 - 24 * scale }, point: { x: 450, y: 326 }, selection: { id: !alt || index % 2 === 0 ? 'p' : 'control' } })) },
          observation: { ...structuredClone(observation), ...(field === 'dashPhase' ? { solidSupport: syntheticTriangleSolidSupport() } : {}), cap: i === 0 ? 'butt' : 'square', pattern: i < 2 ? '3.6px, 3.6px' : '12px, 2.4px', phase: i === 3 ? 8.4 : 0,
            declaredBounds: i === 0 ? [-26.5, -30, 27.5, 24] : observation.declaredBounds } })) : [],
        probes: dashCapProbeKinds(specification).map((kind) => {
          const auditSample = kind === 'audit-cap' ? observation.engineAudit.samples.find((sample) => sample.paintCore && sample.solidDistance > .3 && !sample.insideContour)
            : kind === 'audit-outside' ? observation.engineAudit.samples.filter((sample) => sample.expected === 'miss').sort((a, b) => Math.min(a.paintDistance, a.solidDistance) - Math.min(b.paintDistance, b.solidDistance))[0] : undefined
          const local = auditSample?.local ?? (kind.startsWith('exact') ? specification.exact[Number(kind.slice(6))] : kind === 'outside' ? specification.exterior : kind === 'gap' ? { x: 0, y: radius } : { x: 0, y: 0 })
          const corresponding = observation.engineAudit?.samples.find((sample) => sample.local.x === local.x && sample.local.y === local.y)
          const sample = auditSample ?? corresponding
          const synthetic = specification.audit ? syntheticRegionAt(specification, local.x, local.y) : undefined
          const exterior = dashCapProbeIsMiss(specification, kind), candidates = exterior ? ['control'] : ['control', 'p']
          return { kind, local, alpha: sample?.paintAlpha ?? (exterior || kind === 'gap' ? 0 : 255), nativeStrokeContains: sample?.nativeStrokeContains ?? !(exterior || kind === 'gap'), rasterDistance: sample?.paintDistance ?? synthetic?.paintDistance ?? (kind === 'outside' ? 10 : kind === 'gap' ? 4 : 0),
            ...(synthetic ? { solidDistance: synthetic.solidDistance } : {}),
            selectionCleared: true, screenshot: `${dashCapScenario}-${specification.key}-scale-${scale}-${kind}.png`,
            transform: { ctm: { a: scale, b: 0, c: 0, d: scale, e: 10, f: 20 } },
            actions: [false, true, true, true].map((alt, i) => ({ alt, trusted: true, overlayExcluded: true, candidates: [...candidates],
              screen: { x: scale * local.x + 10, y: scale * local.y + 20 }, point: { x: 450 + local.x, y: 350 + local.y },
              selection: { id: !alt ? exterior ? 'control' : 'p' : candidates[i % candidates.length] } })) }
        }) }
    })) }
}

// Header-only fixture bytes are deliberately synthetic transport data, never a
// browser image. The parent policy fixture writes these exact authenticated bytes.
const syntheticPng = Buffer.alloc(32)
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(syntheticPng)
syntheticPng.writeUInt32BE(1500, 16); syntheticPng.writeUInt32BE(1150, 20)
export const syntheticDashCapLivePng = syntheticPng.toString('base64')
function syntheticLivePaint(spec, scale, observation) {
  const audit = observation.engineAudit
  return { restored: true, modelUnchanged: true, restoredCtm: { ...observation.ctm },
    disagreements: audit.samples.filter((sample) => sample.paintCore && !sample.nativeStrokeContains).map(({ local }) => local),
    captures: [false, true].map((zoom) => {
      const ctm = zoom ? { a: 16, b: 0, c: 0, d: 16, e: 544, f: 544 } : { ...observation.ctm }
      return { zoom, status: 'inspected', afterCtm: { ...ctm }, screenshot: `${dashCapScenario}-${spec.key}-scale-${scale}-${zoom ? 'live-zoom' : 'live'}.screen.png`,
        bytes: syntheticPng.length, sha256: createHash('sha256').update(syntheticPng).digest('hex'), width: 1500, height: 1150,
        method: 'actual App screenshot PNG; no SVG reconstruction', source: `<polygon points="${rawDashCapSquarePoints}"></polygon>`, sourceUnchanged: true,
        rawPoints: rawDashCapSquarePoints, vertices: structuredClone(audit.originalVertices), pathLength: 40, ctm, selection: null, overlays: 0,
        stroke: { width: 36, pattern: observation.pattern, phase: spec.phase * 1.2, cap: 'square', join: 'bevel', fill: 'none', miterLimit: 10, color: 'rgb(0, 0, 0)', opacity: 1 },
        samples: audit.samples.map(({ local, paintAlpha }) => {
          const screen = { x: ctm.a * local.x + ctm.c * local.y + ctm.e, y: ctm.b * local.x + ctm.d * local.y + ctm.f }
          return { local: { ...local }, screen, pixel: { x: Math.floor(screen.x), y: Math.floor(screen.y) }, rgba: paintAlpha >= 128 ? [0, 0, 0, 255] : [245, 245, 245, 255] }
        }) }
    }) }
}

function syntheticTriangleSolidSupport() {
  const vertices = [{ x: 0, y: -5.091168824543141 }, { x: -4.409081537009721, y: 2.545584412271569 }, { x: 4.409081537009718, y: 2.5455844122715727 }]
  const minVertexY = Math.min(...vertices.map(({ y }) => y))
  return { method: 'independent continuous-bevel support bound', vertices, minVertexY, minY: minVertexY - 18, strokeWidth: 36, halfWidth: 18, join: 'bevel' }
}
function syntheticTrianglePhaseNegatives(scale) {
  return triangleDashPhaseNegatives.map((local, index) => ({ kind: `phase-outside-${index}`, local: { ...local }, alpha: 0, nativeStrokeContains: false,
    rasterDistance: 10, solidDistanceLowerBound: syntheticTriangleSolidSupport().minY - local.y, selectionCleared: true,
    screenshot: `${dashCapScenario}-triangle-square-wide-scale-${scale}-edit-dashPhase-outside-${index}.screen.png`,
    transform: { ctm: { a: scale, b: 0, c: 0, d: scale, e: 450 * scale, f: 350 * scale } },
    actions: [false, true, true, true].map((alt) => ({ alt, trusted: true, overlayExcluded: true, candidates: ['control'], selection: { id: 'control' },
      screen: { x: (450 + local.x) * scale, y: (350 + local.y) * scale }, point: { x: 450 + local.x, y: 350 + local.y } })) }))
}
