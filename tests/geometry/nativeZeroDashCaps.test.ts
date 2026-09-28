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
  assert.equal(createDashCaps(contour, 6, [5, 0], 0, 'square').families.length, 0)
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
