import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { inspectConnectedLivePaintPng } from '../../scripts/connectedLivePaintOracle.mjs'
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
      const entry = { key: specification.key, scale, result: 'passed', specification: structuredClone(specification), modelUnchanged: true, observation,
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
      if (specification.livePaint) {
        observation.cloneProbes = structuredClone(entry.probes)
        const interaction = observation.livePaint.interaction
        const cap = interaction.samples.filter((sample) => sample.paintCore && sample.solidDistance > .3 && !sample.insideContour)
          .sort((a, b) => b.solidDistance - a.solidDistance || a.local.x - b.local.x || a.local.y - b.local.y)[0]
        const outside = interaction.samples.filter((sample) => sample.expected === 'miss' && sample.paintDistance > 6.14 && sample.solidDistance > 6.14)
          .sort((a, b) => Math.min(a.paintDistance, a.solidDistance) - Math.min(b.paintDistance, b.solidDistance))[0]
        for (const probe of entry.probes) {
          const sample = ['paint', 'audit-cap'].includes(probe.kind) ? cap : probe.kind === 'audit-outside' ? outside
            : interaction.samples.find((sample) => sample.local.x === probe.local.x && sample.local.y === probe.local.y)
          probe.local = { ...sample.local }
          const clone = observation.engineAudit.samples.find((p) => p.local.x === sample.local.x && p.local.y === sample.local.y)
          Object.assign(probe, { alpha: clone.paintAlpha, rasterDistance: clone.paintDistance, solidDistance: clone.solidDistance, nativeStrokeContains: clone.nativeStrokeContains,
            live: Object.fromEntries(Object.entries(sample).filter(([key]) => key !== 'candidates')), transform: { ctm: { ...observation.ctm } } })
          const candidates = sample.expected === 'miss' ? ['control'] : ['control', 'p']
          probe.actions = [false, true, true, true].map((alt, i) => ({ alt, trusted: true, overlayExcluded: true, candidates: [...candidates],
            screen: { x: scale * probe.local.x + observation.ctm.e, y: scale * probe.local.y + observation.ctm.f }, point: { x: 450 + probe.local.x, y: 350 + probe.local.y },
            selection: { id: alt ? candidates[i % candidates.length] : sample.expected === 'miss' ? 'control' : 'p' } }))
          const reference = observation.livePaint.captures[0], pixelDistances = syntheticPixels(reference, [probe], specification.key)
          probe.liveCapture = { ...reference, screenshot: probe.screenshot, ...pixelDistances, pixelDistances }
        }
      }
      return entry
    })) }
}

// Valid lossless synthetic transport PNGs. These simple literal masks exercise
// independent byte re-decoding policy; they are never browser acceptance.
const pngCache = new Map(), pixelCache = new Map()
function pngChunk(name, data) {
  const content = Buffer.concat([Buffer.from(name), data]), out = Buffer.alloc(data.length + 12)
  let crc = 0xffffffff
  for (const byte of content) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0) }
  out.writeUInt32BE(data.length); content.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8)
  return out
}
export function syntheticDashCapLivePng(capture, syntheticVariant) {
  const { ctm } = capture, key = JSON.stringify([ctm, syntheticVariant])
  if (!pngCache.has(key)) {
    const width = 1500, height = 1150, stride = width * 3 + 1, raw = Buffer.alloc(height * stride, 245)
    for (let y = 0; y < height; y++) {
      raw[y * stride] = 0
      const localY = (y + .5 - ctm.f) / ctm.d
      if (localY < -23 || localY > 23) continue
      const maxX = syntheticVariant === 'square-zero-off' ? localY >= -13 ? 23 : Math.max(13, localY + 28) : Math.min(23, localY + 28)
      const left = Math.ceil(-23 * ctm.a + ctm.e - .5), right = Math.floor(maxX * ctm.a + ctm.e - .5)
      raw.fill(0, y * stride + 1 + left * 3, y * stride + 1 + (right + 1) * 3)
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
    pngCache.set(key, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]))
  }
  return pngCache.get(key)
}
function syntheticPixels(capture, samples, keyName) {
  const key = JSON.stringify([capture.ctm, keyName, samples.map(({ local }) => local)])
  if (!pixelCache.has(key)) pixelCache.set(key, inspectConnectedLivePaintPng(syntheticDashCapLivePng(capture, keyName), { ctm: capture.ctm, samples }))
  return structuredClone(pixelCache.get(key))
}
function syntheticLivePaint(spec, scale, observation) {
  const audit = observation.engineAudit
  const captures = [false, true].map((zoom) => {
    const ctm = zoom ? { a: 16, b: 0, c: 0, d: 16, e: 544, f: 544 } : { ...observation.ctm }
    const source = `<polygon points="${rawDashCapSquarePoints}"></polygon>`
    const capture = { zoom, status: 'inspected', afterCtm: { ...ctm }, screenshot: `${dashCapScenario}-${spec.key}-scale-${scale}-${zoom ? 'live-zoom' : 'live'}.screen.png`,
      source, sourceSha256: createHash('sha256').update(source).digest('hex'), sourceUnchanged: true,
      rawPoints: rawDashCapSquarePoints, vertices: structuredClone(audit.originalVertices), pathLength: 40, ctm, selection: null, overlays: 0,
      viewport: { width: 1500, height: 1150 },
      stroke: { width: 36, pattern: observation.pattern, phase: spec.phase * 1.2, cap: 'square', join: 'bevel', fill: 'none', miterLimit: 10, color: 'rgb(0, 0, 0)', opacity: 1 } }
    const png = syntheticDashCapLivePng(capture, spec.key), pixelDistances = syntheticPixels(capture, audit.samples, spec.key)
    return { ...capture, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex'), ...pixelDistances, pixelDistances, method: 'actual App screenshot PNG; no SVG reconstruction' }
  })
  const samples = audit.samples.map((sample, index) => {
    const pixel = captures[1].samples[index], minimum = Math.min(pixel.paintDistance, sample.solidDistance)
    const expected = sample.insideContour || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain'
    sample.nativeStrokeContains = pixel.paintDistance === 0
    sample.candidates = expected === 'miss' ? [] : ['p']
    return { ...pixel, insideContour: sample.insideContour, solidDistance: sample.solidDistance, expected, candidates: [...sample.candidates] }
  })
  audit.mismatches = audit.samples.filter((sample) => sample.expected !== 'uncertain' && sample.candidates.includes('p') !== (sample.expected === 'hit')).map(({ local, expected, candidates }) => ({ local, expected, candidates }))
  return { restored: true, modelUnchanged: true, restoredCtm: { ...observation.ctm }, captures,
    disagreements: audit.samples.filter((sample) => sample.paintCore && !sample.nativeStrokeContains).map(({ local }) => local),
    interaction: { method: 'connected live paint plus continuous stroke and contour interior', tolerance: 6, uncertainty: .14, selectionDecorationAllowance: 0,
      screenshot: captures[1].screenshot, sha256: captures[1].sha256, samples, mismatches: [] } }
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
