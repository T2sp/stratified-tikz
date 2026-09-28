import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDashCaps, distanceToDashCaps } from '../../src/geometry/dashCaps.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import type { Vec2 } from '../../src/model/types.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { pendingSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'

const directory = new URL('../fixtures/dash-cap-native-original/', import.meta.url)
const stem = 'point-paint-dash-caps-square-exact-zero-scale-0.5'
const original = JSON.parse(readFileSync(new URL(`${stem}.json`, directory), 'utf8')) as {
  probes: unknown[]
  observation: {
    selectionRadius: number; rasterRadius: number; xml: string; resolution: number
    ctm: Record<string, number>; engineAudit: {
      originalVertices: Vec2[]; counts: { hits: number; misses: number; uncertain: number }
      mismatches: { local: Vec2; expected: string; candidates: string[] }[]
      samples: { local: Vec2; expected: 'hit' | 'miss' | 'uncertain'; paintCore: boolean
        paintAlpha: number; nativeStrokeContains: boolean; paintDistance: number; solidDistance: number; candidates: string[] }[]
    }
  }
}
const rawPoints = '5.000000000000001,-5 -5,-5.000000000000001 -5.000000000000002,5 5,5.000000000000002'
const rawVertices = rawPoints.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y } })
const square = [{ x: 5, y: -5 }, { x: -5, y: -5 }, { x: -5, y: 5 }, { x: 5, y: 5 }]
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
// Independent analytic distance: the four native 36-unit upright squares
// centered at (+/-5,+/-5) cover this entire square. No helper supplies this oracle.
const boxDistance = ({ x, y }: Vec2) => Math.hypot(Math.max(0, Math.abs(x) - 23), Math.max(0, Math.abs(y) - 23))

test('retain original failed Chrome source/raster/audit bytes and do not turn aborted clicks into acceptance', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')) as {
    browserVersion: string; files: Record<string, string>; rawPoints: string; checkout: { fingerprint: string }
  }
  assert.equal(manifest.browserVersion, '154.0.8037.57')
  assert.equal(manifest.checkout.fingerprint, 'ac28529b414946a27ff5b706976fbacaaecfdf94e3ab2ff8b08d53231c11e67b')
  assert.equal(Object.keys(manifest.files).length, 7)
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, directory))).digest('hex'), hash)
  }
  assert.equal(manifest.rawPoints, rawPoints)
  assert.match(original.observation.xml, new RegExp(`points="${rawPoints.replaceAll('.', '\\.')}"`))
  assert.deepEqual(original.probes, [])
  assert.equal(original.observation.resolution, 16)
  assert.deepEqual(original.observation.ctm, { a: .5, b: 0, c: 0, d: .5, e: 225, f: 175 })
  close(original.observation.selectionRadius, 26.419689627245816)
  close(original.observation.rasterRadius, 32.482717760757026)
  assert.ok(original.observation.rasterRadius - original.observation.selectionRadius > 6)
  assert.equal(original.observation.engineAudit.mismatches.length, 96)
  assert.deepEqual(original.observation.engineAudit.counts, { hits: 829, misses: 252, uncertain: 8 })
})

test('raw source, exact parsed vertices and winding retain every native grid cell and exact six-unit tolerance', () => {
  const audit = original.observation.engineAudit
  assert.deepEqual(audit.originalVertices, square)
  const edgeLengths = (vertices: readonly Vec2[]) => vertices.map((point, index) => {
    const end = vertices[(index + 1) % vertices.length]
    return Math.hypot(end.x - point.x, end.y - point.y)
  })
  const rawLengths = edgeLengths(rawVertices), nativeLengths = edgeLengths(audit.originalVertices)
  assert.deepEqual(rawLengths, [10, 10, 10.000000000000002, 10.000000000000002])
  assert.deepEqual(nativeLengths, [10, 10, 10, 10])
  // The tiny source differences do not move the scalar corner schedule in
  // this reproduction. They must not be "fixed" by rounding the emitted SVG.
  for (const lengths of [rawLengths, nativeLengths]) {
    let total = 0
    assert.deepEqual(lengths.map((length) => (total += length)), [10, 20, 30, 40])
  }
  assert.equal(audit.samples.length, 1089)
  for (const vertices of [rawVertices, square, [...rawVertices].reverse(), [...square].reverse()]) {
    const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices }, 36, [0, 10], 0, 'square')
    close(caps.radius, Math.hypot(23, 23))
    assert.ok(caps.radius + .14 >= original.observation.rasterRadius)
    for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) close(caps.bounds![key], key.startsWith('min') ? -23 : 23)
    for (const [index, sample] of audit.samples.entries()) {
      assert.deepEqual(sample.local, { x: -32 + index % 33 * 2, y: -32 + Math.floor(index / 33) * 2 })
      const actual = distanceToDashCaps(sample.local, caps)
      close(actual, boxDistance(sample.local))
      if (sample.paintCore) { assert.equal(sample.paintAlpha, 255); assert.equal(sample.nativeStrokeContains, true); close(actual, 0) }
      if (sample.expected !== 'uncertain') assert.equal(actual <= 6, sample.expected === 'hit')
    }
    for (const local of [{ x: -22, y: -22 }, { x: 20, y: 20 }]) close(distanceToDashCaps(local, caps), 0)
    close(distanceToDashCaps({ x: -22, y: -30 }, caps), 7)
    close(distanceToDashCaps({ x: 23, y: 29 }, caps), 6)
    assert.ok(distanceToDashCaps({ x: 23, y: 29.001 }, caps) > 6)
  }
  assert.equal(audit.samples.filter((sample) => sample.paintCore && sample.candidates.length === 0).length, 16)
  const exterior = audit.samples.find(({ local }) => local.x === -22 && local.y === -30)!
  assert.equal(exterior.paintAlpha, 0); assert.equal(exterior.nativeStrokeContains, false)
  assert.ok(exterior.paintDistance > 6.14 && exterior.paintDistance < 8 && exterior.solidDistance > 6.14)
})

function fixture() {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.camera = { mode: '2d', scale: 1, origin: { x: 450, y: 350 } }
  const point = createPointStratum({ ambientDimension: 2, id: 'p', text: '', position: { x: 0, y: 0, z: 0 } })
  Object.assign(point.style, { shape: 'square', size: 5.892556509887896 })
  getPointPaint(point.style).fill.enabled = false
  Object.assign(getPointPaint(point.style).stroke, { enabled: true, color: '#000000', opacity: 1,
    width: 30, lineStyle: 'solid', dashPattern: [0, 10 / 1.2], dashPhase: 0, lineCap: 'rect', lineJoin: 'bevel' })
  diagram.strata = [point]
  return { diagram, point }
}

test('exact production reproduction fixes all omitted candidates, pending/ready bounds and immutable SVG source', async () => {
  const { diagram, point } = fixture()
  const measurement = { identity: 'empty-native-zero', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  const captured = captureSvgLabelExport({ runtime, source: '', pointStyle: point.style, position: { x: 450, y: 350 },
    color: '#000000', opacity: 1, fontSize: 12, anchor: 'center', settings: svgLabelLayoutSettings(12), ownerIdentity: svgPointNodeOwner(9, 'p') })
  const [state] = await settleSvgExportLabels([captured])
  assert.equal(state.status, 'ready')
  const layout = svgPointNodeLayout(point.style, state), pending = pendingSvgPointNodeLayout(point)
  assert.deepEqual(layout.geometry.vertices, rawVertices)
  assert.deepEqual(pending.dashCaps, layout.dashCaps)
  close(layout.selectionRadius, Math.hypot(23, 23))
  const entry = { source: '', ownerIdentity: svgPointNodeOwner(9, 'p'), fontGeneration: 0, shape: point.style.shape,
    size: point.style.size, requestIdentity: state.requestIdentity, layout }
  for (const committed of [false, true]) for (const scale of [.5, 1.5]) {
    for (const sample of original.observation.engineAudit.samples) {
      const screen = { x: (450 + sample.local.x) * scale, y: (350 + sample.local.y) * scale }
      const candidates = collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 700,
        point: { x: screen.x / scale, y: screen.y / scale }, showCoordinateAnchors: false,
        ...(committed ? { pointCommits: new Map([['p', entry]]), pointDocumentRevision: 9, pointFontGeneration: 0 } : {}) })
      assert.equal(candidates.some(({ id }) => id === 'p'), boxDistance(sample.local) <= 6)
    }
  }
  const selected = renderToStaticMarkup(createElement(SvgPointNodeView, { capture: captured, state, selected: true }))
  close(Number(/<circle r="([^"]+)"/.exec(selected)?.[1]), Math.hypot(23, 23) + 6)
  getPointPaint(point.style).stroke.dashPattern = [5, 3]
  const exported = renderSettledSvgLabelDocument(captured, state)
  assert.ok(exported.includes(`points="${rawPoints}"`))
  assert.match(exported, /stroke-dasharray="0 10"/)
  assert.match(exported, /stroke-width="36"/)
  assert.match(exported, /stroke-linecap="square"/)
  runtime.dispose()
})

for (const phase of [-.25, -1e-9, 1e-9, .25]) test(`near corner/seam phase ${phase} preserves actual short intervals`, () => {
  const d = Math.abs(phase)
  const centers = phase > 0 ? [{ x: -5 + d, y: -5 }, { x: -5, y: 5 - d }, { x: 5 - d, y: 5 }, { x: 5, y: -5 + d }]
    : [{ x: 5 - d, y: -5 }, { x: -5, y: -5 + d }, { x: -5 + d, y: 5 }, { x: 5, y: 5 - d }]
  const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices: square }, 36, [0, 10], phase, 'square')
  for (const sample of original.observation.engineAudit.samples) {
    const expected = Math.min(...centers.map((c) => Math.hypot(Math.max(0, Math.abs(sample.local.x - c.x) - 18),
      Math.max(0, Math.abs(sample.local.y - c.y) - 18))))
    close(distanceToDashCaps(sample.local, caps), expected)
  }
})

test('isolated diagonal zero-on cap has upright extent; round/butt and positive-on keep distinct geometry', () => {
  const contour = { kind: 'polygon' as const, radius: 0, vertices: [{ x: 0, y: 0 }, { x: 8, y: 6 }, { x: 16, y: 0 }] }
  // Independently specified center at arclength 5 = (4,3). Skia's degenerate
  // line has no tangent; fresh mandatory browser mechanism audit checks this
  // source-informed rule. These analytic tests are not native acceptance.
  const square = createDashCaps(contour, 6, [0, 100], -5, 'square')
  assert.deepEqual(square.bounds, { minX: 1, minY: 0, maxX: 7, maxY: 6 })
  close(square.radius, Math.hypot(7, 6))
  close(distanceToDashCaps({ x: 6.8, y: 5.8 }, square), 0)
  close(distanceToDashCaps({ x: 8, y: 3 }, square), 1)
  const round = createDashCaps(contour, 6, [0, 100], -5, 'round')
  close(distanceToDashCaps({ x: 6.8, y: 5.8 }, round), Math.hypot(2.8, 2.8) - 3)
  assert.equal(createDashCaps(contour, 6, [0, 100], -5, 'butt').families.length, 0)
  const positive = createDashCaps(contour, 6, [1e-9, 100], -5, 'square')
  assert.ok(positive.families.every((family) => !family.isolatedDot), 'positive on lengths must not be normalized to zero')
  assert.ok(createDashCaps(contour, 6, [5, 0], 0, 'square').families.length > 0,
    'zero-length gaps preserve independently capped positive subpaths')
})

test('bounded dot families agree with finite independent line and circle constructions', () => {
  const vertices = [{ x: 0, y: 0 }, { x: 8, y: 6 }, { x: 16, y: 0 }]
  // Perimeter 36, explicit dots at 0,7,14,21,28,35. No production
  // scheduling is used to specify their Cartesian centers.
  const lineCenters = [{ x: 0, y: 0 }, { x: 5.6, y: 4.2 }, { x: 11.2, y: 3.6 },
    { x: 15, y: 0 }, { x: 8, y: 0 }, { x: 1, y: 0 }]
  const circleCenters = [0, 7, 14].map((at) => ({ x: 3 * Math.cos(at / 3), y: 3 * Math.sin(at / 3) }))
  for (const [contour, centers] of [[{ kind: 'polygon' as const, vertices, radius: 0 }, lineCenters],
    [{ kind: 'circle' as const, vertices: [], radius: 3 }, circleCenters]] as const) {
    for (const cap of ['square', 'round'] as const) {
      const caps = createDashCaps(contour, 6, [0, 7], 0, cap)
      for (let y = -10; y <= 20; y += 1.25) for (let x = -10; x <= 20; x += 1.25) {
        const expected = Math.min(...centers.map((c) => cap === 'round' ? Math.max(0, Math.hypot(x - c.x, y - c.y) - 3)
          : Math.hypot(Math.max(0, Math.abs(x - c.x) - 3), Math.max(0, Math.abs(y - c.y) - 3))))
        close(distanceToDashCaps({ x, y }, caps), expected)
      }
      for (const [key, coordinate, sign] of [['minX', 'x', -1], ['minY', 'y', -1], ['maxX', 'x', 1], ['maxY', 'y', 1]] as const) {
        close(caps.bounds![key], sign * Math.max(...centers.map((center) => sign * center[coordinate])) + sign * 3)
      }
      close(caps.radius, Math.max(...centers.map(({ x, y }) => cap === 'round' ? Math.hypot(x, y) + 3 : Math.hypot(Math.abs(x) + 3, Math.abs(y) + 3))))
    }
  }
})

// These are byte-identical failed parent artifacts, not a corrected browser
// run. Keeping complete grids exposes the old defects and the two distinct
// raster/containment disagreements while the native harness obtains live paint.
type EndpointSample = [number, number, number, number, number, number, boolean, boolean, boolean,
  'hit' | 'miss' | 'uncertain', number, number | null, boolean]
type EndpointObservation = {
  key: string; result: 'failed'; columns: string[]; error: unknown
  specification: { points: string; width: number; pattern: number[]; phase: number; cap: 'square'; join: 'bevel' }
  native: { vertices: Vec2[]; pathLength: number; browser: { version: string } }
  raster: { resolution: number; uncertainty: number }
  paint: { bounds: { minX: number; minY: number; maxX: number; maxY: number }; radius: number }
  samples: EndpointSample[]; mismatches: unknown[]
}
const endpointDirectory = new URL('../fixtures/dash-cap-native-endpoints/', import.meta.url)
const endpointKeys = ['zero-terminal-seam', 'zero-off-continuous', 'positive-exact-corner', 'positive-before-corner'] as const
const endpointObservations = endpointKeys.map((key) => JSON.parse(readFileSync(new URL(
  `point-paint-dash-cap-mechanism-${key}.json`, endpointDirectory), 'utf8')) as EndpointObservation)

test('retained native endpoint failures authenticate every source, raster, control and complete grid', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', endpointDirectory), 'utf8')) as {
    provenance: string; source: string; files: Record<string, string>
  }
  assert.match(manifest.provenance, /Historical failure, not corrected native acceptance/)
  assert.equal(Object.keys(manifest.files).length, 29)
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, endpointDirectory))).digest('hex'), hash)
  }
  for (const [index, observation] of endpointObservations.entries()) {
    assert.equal(observation.key, endpointKeys[index])
    assert.equal(observation.result, 'failed'); assert.ok(observation.error)
    assert.equal(observation.native.browser.version, '154.0.8037.57')
    assert.deepEqual(observation.native.vertices, square)
    assert.equal(observation.native.pathLength, 40)
    assert.equal(observation.raster.resolution, 16); assert.equal(observation.raster.uncertainty, .14)
    assert.equal(observation.samples.length, 1089)
    assert.equal(observation.mismatches.length, [45, 208, 76, 39][index])
    observation.samples.forEach(([x, y], cell) => assert.deepEqual([x, y], [-32 + cell % 33 * 2, -32 + Math.floor(cell / 33) * 2]))
    const disagreement = observation.samples.filter((cell) => cell[8] && !cell[7])
    assert.equal(disagreement.length, [0, 24, 0, 30][index])
    assert.ok(disagreement.every((cell) => cell[2] === 255 && cell[4] === 0), 'retain opaque raster and native exclusion together')
  }
})

type LiteralBox = readonly [number, number, number, number]
function literalBoxDistance({ x, y }: Vec2, [minX, minY, maxX, maxY]: LiteralBox): number {
  return Math.hypot(Math.max(0, minX - x, x - maxX), Math.max(0, minY - y, y - maxY))
}
// The intentional continuous stroke plus original interior is the literal
// bevel octagon. Its distance is independent of the production stroke helper.
const bevelOctagon = [[-23, -5], [-5, -23], [5, -23], [23, -5], [23, 5], [5, 23], [-5, 23], [-23, 5]]
function literalBevelDistance(point: Vec2): number {
  let inside = true, distance = Infinity
  for (const [index, [x, y]] of bevelOctagon.entries()) {
    const [endX, endY] = bevelOctagon[(index + 1) % bevelOctagon.length], dx = endX - x, dy = endY - y
    if (dx * (point.y - y) - dy * (point.x - x) < 0) inside = false
    const at = Math.max(0, Math.min(1, ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy)))
    distance = Math.min(distance, Math.hypot(point.x - x - at * dx, point.y - y - at * dy))
  }
  return inside ? 0 : distance
}
function literalEndpointDistance(key: string, point: Vec2): number {
  // These Cartesian rectangles are specified directly. No production helper,
  // cap schedule, path parsing or family output supplies expected endpoints.
  const boxes: LiteralBox[] = key === 'zero-terminal-seam'
    ? [[-23, -23, 13, 13], [-18, -13, 18, 23]] // only dots at (-5,-5) and (0,5)
    : key === 'positive-before-corner'
      ? [[-22.75, -23, -4.75, 13], [-23, -13.25, 13, 4.75],
        [4.75, -13, 22.75, 23], [-13, -4.75, 23, 13.25]]
      : key === 'zero-off-continuous' ? [[-23, -23, 13, 13], [-23, -13, 23, 23]]
        : [[-23, -23, 23, 23]] // exact positive endpoint rectangles cover this square
  return Math.min(literalBevelDistance(point), ...boxes.map((box) => literalBoxDistance(point, box)))
}

for (const observation of endpointObservations) test(`${observation.key}: historical diagnostic retains all cells and quantifies unresolved native paint gaps`, () => {
  for (const vertices of [square, rawVertices]) {
    const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices }, 36,
      observation.specification.pattern, observation.specification.phase, 'square')
    const expectedBounds = observation.key === 'zero-terminal-seam'
      ? { minX: -23, minY: -23, maxX: 18, maxY: 23 } : { minX: -23, minY: -23, maxX: 23, maxY: 23 }
    for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) close(caps.bounds![key], expectedBounds[key])
    close(caps.radius, observation.key === 'positive-before-corner' ? Math.hypot(23, 22.75) : Math.hypot(23, 23))
    let unresolvedHits = 0, unresolvedCores = 0
    for (const [x, y, , , paintDistance, solidDistance, , nativeContains, paintCore, expected] of observation.samples) {
      const point = { x, y }, analytic = literalEndpointDistance(observation.key, point)
      const actual = Math.min(distanceToDashCaps(point, caps), literalBevelDistance(point))
      close(actual, analytic)
      const disagreement = Math.abs(actual - Math.min(paintDistance, solidDistance)) > .14
      if (disagreement) assert.ok(['zero-off-continuous', 'positive-before-corner'].includes(observation.key),
        'only the explicitly unresolved seam mechanisms may disagree with retained raster')
      if (paintCore && actual > .14) {
        unresolvedCores++
        assert.equal(nativeContains, false, 'preserve the contradictory containment observation')
      }
      if (expected !== 'uncertain' && (actual <= 6) !== (expected === 'hit')) {
        unresolvedHits++
        assert.equal(expected, 'hit', 'no new false candidates are accepted')
      }
    }
    assert.equal(unresolvedHits, observation.key === 'zero-off-continuous' ? 24 : observation.key === 'positive-before-corner' ? 39 : 0)
    assert.equal(unresolvedCores, observation.key === 'zero-off-continuous' ? 24 : observation.key === 'positive-before-corner' ? 30 : 0)
    // This diagnostic describes the limitation. The native acceptance harness
    // still requires zero mismatches and these two cases therefore remain open.
  }
})

test('terminal witnesses are demonstrated negatives while positive endpoints and zero-off corners remain reachable', async () => {
  const witnesses = [
    { key: 'zero-terminal-seam', pattern: [0, 15], phase: 5, hit: [{ x: -22, y: -22 }],
      miss: [{ x: 22, y: -18 }, { x: 21, y: -21 }, { x: 22, y: -22 }] },
    { key: 'positive-exact-corner', pattern: [10, 10], phase: 0, hit: [{ x: 20, y: 20 }, { x: 16, y: -22 }, { x: 22, y: -22 }],
      miss: [{ x: -22, y: -30 }] },
    { key: 'zero-off-continuous', pattern: [10, 0], phase: 0, hit: [{ x: -22, y: -22 }], miss: [{ x: -22, y: -30 }] },
    { key: 'positive-before-corner', pattern: [10, 10], phase: .25, hit: [{ x: -22, y: -22 }], miss: [{ x: -22, y: -30 }] },
  ]
  const { diagram, point } = fixture()
  const measurement = { identity: 'native-endpoint-regression', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  try {
    for (const witness of witnesses) {
      const paint = getPointPaint(point.style)
      paint.stroke.dashPattern = witness.pattern.map((value) => value / 1.2); paint.stroke.dashPhase = witness.phase / 1.2
      const captured = captureSvgLabelExport({ runtime, source: '', pointStyle: point.style, position: { x: 450, y: 350 },
        color: '#000000', opacity: 1, fontSize: 12, anchor: 'center', settings: svgLabelLayoutSettings(12), ownerIdentity: svgPointNodeOwner(11, 'p') })
      const [state] = await settleSvgExportLabels([captured])
      const layout = svgPointNodeLayout(point.style, state)
      assert.deepEqual(layout.dashCaps, pendingSvgPointNodeLayout(point).dashCaps)
      const entry = { source: '', ownerIdentity: svgPointNodeOwner(11, 'p'), fontGeneration: 0, shape: point.style.shape,
        size: point.style.size, requestIdentity: state.requestIdentity, layout }
      for (const committed of [false, true]) for (const scale of [.5, 1.5]) {
        for (const [expected, points] of [[true, witness.hit], [false, witness.miss]] as const) for (const local of points) {
          const screen = { x: (450 + local.x) * scale, y: (350 + local.y) * scale }
          const candidates = collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 700,
            point: { x: screen.x / scale, y: screen.y / scale }, showCoordinateAnchors: false,
            ...(committed ? { pointCommits: new Map([['p', entry]]), pointDocumentRevision: 11, pointFontGeneration: 0 } : {}) })
          assert.equal(candidates.some(({ id }) => id === 'p'), expected, `${witness.key}: ${JSON.stringify(local)}`)
          assert.equal(literalEndpointDistance(witness.key, local) <= 6, expected)
        }
      }
      const selected = renderToStaticMarkup(createElement(SvgPointNodeView, { capture: captured, state, selected: true }))
      close(Number(/<circle r="([^"]+)"/.exec(selected)?.[1]), layout.selectionRadius + 6)
      paint.stroke.dashPattern = [3, 4]; paint.stroke.dashPhase = 7
      const exported = renderSettledSvgLabelDocument(captured, state)
      assert.ok(exported.includes(`stroke-dasharray="${witness.pattern.join(' ')}"`))
      assert.ok(exported.includes(`points="${rawPoints}"`))
    }
  } finally { runtime.dispose() }
})

for (const displacement of [-1e-9, 0, 1e-9]) test(`terminal-only zero seam remains half-open at displacement ${displacement}`, () => {
  const phase = 5 + displacement
  const centers = displacement < 0
    ? [{ x: -5, y: -5 - displacement }, { x: -displacement, y: 5 }]
    : displacement > 0
      ? [{ x: -5 + displacement, y: -5 }, { x: -displacement, y: 5 }, { x: 5, y: -5 + displacement }]
      : [{ x: -5, y: -5 }, { x: 0, y: 5 }]
  const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices: square }, 36, [0, 15], phase, 'square')
  for (const [x, y] of endpointObservations[0].samples) {
    const expected = Math.min(...centers.map((center) => Math.hypot(Math.max(0, Math.abs(x - center.x) - 18), Math.max(0, Math.abs(y - center.y) - 18))))
    close(distanceToDashCaps({ x, y }, caps), expected)
  }
})

test('positive exact starts use outgoing tangents for both square windings and preserve near-endpoint intervals', () => {
  for (const vertices of [square, [...square].reverse()]) {
    const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices }, 36, [10, 10], 0, 'square')
    // Two independently specified length-ten sides are painted. Their square
    // cap rectangles, together with the continuous stroke, cover [-23,23]^2.
    for (const local of [{ x: -22, y: -22 }, { x: 22, y: -22 }, { x: 22, y: 22 }, { x: -22, y: 22 }]) close(distanceToDashCaps(local, caps), 0)
    for (const displacement of [-1e-9, 1e-9]) {
      const shifted = createDashCaps({ kind: 'polygon', radius: 0, vertices }, 36, [10, 10], displacement, 'square')
      assert.ok(shifted.families.every(({ isolatedDot }) => !isolatedDot))
      assert.ok(shifted.families.some(({ first, last }) => first !== 0 && first < 1e-8 || last > 10 - 1e-8 && last < 10),
        'near endpoints retain their actual short side, not an epsilon-snapped corner')
    }
  }
})

test('retained native triangle style edit rules out either generic extra seam cap and preserves exterior picking', async () => {
  const decoded = JSON.parse(readFileSync(new URL('independent-triangle-cap-counterexample.json', endpointDirectory), 'utf8')) as {
    scope: string; samples: { local: Vec2; alpha: number; paintDistance: number; solidDistance: number; capDistance: number }[]
  }
  assert.match(decoded.scope, /Independent PNG decoding of historical native triangle/)
  const { diagram, point } = fixture()
  point.style.shape = 'triangle'; point.style.size = 3
  Object.assign(getPointPaint(point.style).stroke, { dashPattern: [10, 2], dashPhase: 7 })
  const measurement = { identity: 'native-triangle-preservation', measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  try {
    const captured = captureSvgLabelExport({ runtime, source: '', pointStyle: point.style, position: { x: 450, y: 350 },
      color: '#000000', opacity: 1, fontSize: 12, anchor: 'center', settings: svgLabelLayoutSettings(12), ownerIdentity: svgPointNodeOwner(12, 'p') })
    const [state] = await settleSvgExportLabels([captured])
    const layout = svgPointNodeLayout(point.style, state)
    const entry = { source: '', ownerIdentity: svgPointNodeOwner(12, 'p'), fontGeneration: 0, shape: point.style.shape,
      size: point.style.size, requestIdentity: state.requestIdentity, layout }
    for (const scale of [.5, 1.5]) {
      const stem = `point-paint-dash-caps-triangle-square-wide-scale-${scale}`
      const native = JSON.parse(readFileSync(new URL(`${stem}.json`, endpointDirectory), 'utf8')) as {
        result: string; scale: number; edits: { field: string; sameNode: boolean; modelChanged: boolean;
          observation: { xml: string; selectionRadius: number; rasterRadius: number; declaredBounds: number[]; phase: number; pattern: string } }[]
      }
      assert.equal(native.result, 'passed'); assert.equal(native.scale, scale)
      const edit = native.edits.find(({ field }) => field === 'dashPhase')!
      assert.equal(edit.sameNode, true); assert.equal(edit.modelChanged, true)
      assert.equal(edit.observation.xml, readFileSync(new URL(`${stem}-edit-dashPhase.input.svg`, endpointDirectory), 'utf8'))
      assert.equal(edit.observation.pattern, '12px, 2.4px'); assert.equal(edit.observation.phase, 8.4)
      close(edit.observation.rasterRadius, 28.399940856012357)
      close(edit.observation.selectionRadius, 28.426450393138133)
      for (const current of [pendingSvgPointNodeLayout(point), layout]) {
        close(current.selectionRadius, edit.observation.selectionRadius)
        const actualBounds = [current.paintedBounds.minX, current.paintedBounds.minY, current.paintedBounds.maxX, current.paintedBounds.maxY]
        actualBounds.forEach((value, index) => close(value, edit.observation.declaredBounds[index]))
        // Either added seam orientation has a literal corner of radius
        // 30.4021, more than two units beyond independently retained paint.
        assert.ok(Math.hypot(6.5884572681199, -29.6796260926630) > current.selectionRadius + 1.9)
        for (const sample of decoded.samples) {
          assert.equal(sample.alpha, 0)
          assert.ok(sample.paintDistance > 6.14)
          // The decoder's solidDistance is a retained production diagnostic.
          // Independently, every centerline point has y >= -5.091168824543141;
          // a width-36 bevel stroke cannot extend below that minus 18.
          const continuousDistanceLowerBound = -5.091168824543141 - 18 - sample.local.y
          assert.ok(continuousDistanceLowerBound > 6.14)
          assert.ok(sample.solidDistance >= continuousDistanceLowerBound)
          assert.ok(distanceToDashCaps(sample.local, current.dashCaps) > 6)
        }
      }
      for (const committed of [false, true]) for (const { local } of decoded.samples) {
        const screen = { x: (450 + local.x) * scale, y: (350 + local.y) * scale }
        const candidates = collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 700,
          point: { x: screen.x / scale, y: screen.y / scale }, showCoordinateAnchors: false,
          ...(committed ? { pointCommits: new Map([['p', entry]]), pointDocumentRevision: 12, pointFontGeneration: 0 } : {}) })
        assert.equal(candidates.some(({ id }) => id === 'p'), false)
      }
    }
  } finally { runtime.dispose() }
})
