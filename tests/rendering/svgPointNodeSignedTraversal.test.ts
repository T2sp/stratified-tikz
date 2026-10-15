import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { solvePointNodeShape, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { ShapeContourBuilder, ellipsePoint } from '../../src/geometry/pointNodeShapes/contours.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { pointNodeDimensionFields, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import type { PointStyle, Vec2 } from '../../src/model/types.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelController, createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { currentSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

type NodeCase = PointNodeShapeInput & { id: string; kind: 'node' }
type ArcCase = { id: string; kind: 'arc'; rx: number; ry: number; start: number; end: number; rotation: number; center: Vec2; closed: boolean }
type PaintObservation = { path: string; svg: string; png: string; command: string[]; exitCode: number; darkPixels: number }
type RecordObservation = { id: string; caseId: string; style: { id: string; attributes: string };
  observations: { production: PaintObservation; pgf: PaintObservation; 'old-sweep'?: PaintObservation; 'global-abs'?: PaintObservation };
  darkMaskDifferencesFromPgf: Record<string, number> }
const directory = new URL('../fixtures/point-node-anchors/signed-traversal/', import.meta.url)
const referenceBytes = readFileSync(new URL('references.json', directory))
const references = JSON.parse(referenceBytes.toString()) as { cases: (NodeCase | ArcCase)[] }
const renders = JSON.parse(readFileSync(new URL('render-results.json', directory), 'utf8')) as {
  schema: string; rendererVersion: string; referenceSha256: string; rendererScriptSha256: string;
  artifactHashes: Record<string, string>; records: RecordObservation[]
}
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
function mask(bytes: Buffer): Uint8Array {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  const chunks: Buffer[] = []
  let offset = 8, channels = 0, ended = false
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8)
    assert.ok(offset + size + 12 <= bytes.length)
    const data = bytes.subarray(offset + 8, offset + 8 + size)
    if (kind === 'IHDR') {
      assert.equal(data.readUInt32BE(0), 800); assert.equal(data.readUInt32BE(4), 800)
      assert.equal(data[8], 8); assert.ok(data[9] === 2 || data[9] === 6); assert.equal(data[12], 0)
      channels = data[9] === 2 ? 3 : 4
    } else if (kind === 'IDAT') chunks.push(data)
    else if (kind === 'IEND') ended = true
    offset += size + 12
  }
  assert.ok(ended && channels > 0)
  const stride = 800 * channels, raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: 800 * (stride + 1) })
  assert.equal(raw.length, 800 * (stride + 1))
  const decoded = Buffer.alloc(800 * stride)
  for (let y = 0; y < 800; y++) {
    const filter = raw[y * (stride + 1)]!; assert.ok(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, left = x >= channels ? decoded[at - channels]! : 0
      const up = y ? decoded[at - stride]! : 0, corner = y && x >= channels ? decoded[at - stride - channels]! : 0
      const p = left + up - corner
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
        : Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner) ? left : Math.abs(p - up) <= Math.abs(p - corner) ? up : corner
      decoded[at] = (raw[y * (stride + 1) + x + 1]! + predictor) & 255
    }
  }
  return Uint8Array.from({ length: 800 * 800 }, (_, index) => decoded[index * channels]! < 128 ? 1 : 0)
}
const difference = (a: Uint8Array, b: Uint8Array) => a.reduce((sum, value, index) => sum + (value === b[index] ? 0 : 1), 0)
function pathFor(entry: NodeCase | ArcCase): string {
  if (entry.kind === 'node') return solvePointNodeShape(entry).contours[0]!.path
  const b = new ShapeContourBuilder(entry.rotation).move(ellipsePoint(entry.center, entry.rx, entry.ry, entry.start))
    .arc(entry.center, entry.rx, entry.ry, entry.start, entry.end)
  return (entry.closed ? b.close() : b).finish().path
}

test('actual signed-traversal SVG/PNG artifacts authenticate their independent reference and renderer inputs', () => {
  assert.equal(renders.schema, 'stz-independent-signed-traversal-render-v1')
  assert.match(renders.rendererVersion, /^rsvg-convert version 2\.63\.0/)
  assert.equal(renders.referenceSha256, hash(referenceBytes))
  assert.equal(renders.rendererScriptSha256, hash(readFileSync(new URL('render.mjs', directory))))
  assert.equal(renders.records.length, 90); assert.equal(Object.keys(renders.artifactHashes).length, 432)
  for (const [file, expected] of Object.entries(renders.artifactHashes)) assert.equal(hash(readFileSync(new URL(file, directory))), expected, file)
})

for (const record of renders.records) test(`independent direction-sensitive SVG/PNG paint: ${record.id}`, () => {
  const entry = references.cases.find(value => value.id === record.caseId)!
  assert.equal(pathFor(entry), record.observations.production.path)
  const masks: Record<string, Uint8Array> = {}
  for (const [kind, observation] of Object.entries(record.observations)) {
    assert.equal(observation.exitCode, 0)
    const svg = readFileSync(new URL(observation.svg, directory), 'utf8')
    assert.ok(svg.includes(`d="${observation.path}" ${record.style.attributes}`))
    assert.equal(observation.command.at(-1), observation.svg)
    const actual = mask(readFileSync(new URL(observation.png, directory)))
    assert.equal(actual.reduce((sum, value) => sum + value, 0), observation.darkPixels)
    masks[kind] = actual
  }
  for (const [kind, actual] of Object.entries(masks)) assert.equal(difference(actual, masks.pgf!), record.darkMaskDifferencesFromPgf[kind], kind)
  // Four-cubic PGF ellipses and exact SVG arcs differ only along a tiny boundary.
  // At 10 pixels/pt these masks remain within 20 pixels out of 640,000;
  // the direction controls differ by hundreds despite often equal pixel counts.
  assert.ok(record.darkMaskDifferencesFromPgf.production! <= 20)
  if (record.style.id === 'review-dash') {
    const mixed = entry.kind === 'node' || (entry.rx < 0) !== (entry.ry < 0)
    if (mixed) {
      assert.ok(record.darkMaskDifferencesFromPgf['old-sweep']! > 100)
      assert.ok(record.darkMaskDifferencesFromPgf['global-abs']! > 100)
    }
  }
  if (record.id === 'review-mixed-axes-review-dash') {
    assert.equal(record.observations.production.darkPixels, 480)
    assert.equal(record.observations.pgf.darkPixels, 480)
    assert.equal(record.darkMaskDifferencesFromPgf.production, 0)
    assert.equal(record.darkMaskDifferencesFromPgf['old-sweep'], 298)
    assert.equal(hash(readFileSync(new URL(record.observations.production.png, directory))), '7e29b9db2533c9e41672f63cffe547232155c0dfd669f51dcd7de4ab51d39d55')
  }
})

const measurement: TextMeasurementProvider = { identity: '32d-signed-traversal-empty',
  measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
function styleFor(entry: NodeCase, anchor: string, phase: number): PointStyle {
  let style: PointStyle = { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
    shape: 'ellipse', layout: { anchor } }
  for (const field of pointNodeDimensionFields) {
    const changed = updatePointNodeDimension(style, [field], ` ${entry[field]}pt `)
    assert.ok(changed); style = changed
  }
  style.paint = structuredClone(getPointPaint(style))
  style.paint.fill.enabled = false; style.paint.stroke.enabled = true; style.paint.stroke.width = .4
  style.paint.stroke.dashPattern = [2, 5]; style.paint.stroke.dashPhase = phase
  style.paint.stroke.lineCap = 'round'; style.paint.stroke.lineJoin = 'bevel'
  return style
}

for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D signed dashed ellipse keeps live/detached settled paths, exact saved styles, anchors/picking/projection and TikZ`, async () => {
  const entry = references.cases.find((value): value is NodeCase => value.kind === 'node' && value.id === 'native-empty-mixed-axes')!
  for (const anchor of ['center', 'north', 'east', 'base', 'mid', '13']) for (const phase of [-2.7, 0, 1.3]) {
    const style = styleFor(entry, anchor, phase)
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.camera = diagram.camera.mode === '2d' ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
      : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
    const point = createPointStratum({ ambientDimension, id: 'p', text: '', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, style })
    diagram.strata = [point]
    const before = structuredClone(diagram), saved = serializeDiagram(diagram), loaded = parseSavedDiagramJson(saved)
    assert.ok(loaded.ok); assert.equal(serializeDiagram(loaded.diagram), saved)
    const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
    const projected = projectToSvgPoint(diagram.camera, point.position, 360), owner = svgPointNodeOwner(32, 'p')
    const capture = captureSvgLabelExport({ runtime, source: '', pointStyle: point.style, position: projected,
      fontSize: 12, fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center',
      settings: svgLabelLayoutSettings(12, svgPointNodeTextFontFamily), ownerIdentity: owner })
    const controller = createSvgLabelController(runtime), cancel = controller.start(capture), pending = controller.getSnapshot()!
    const [settled] = await settleSvgExportLabels([capture]); cancel(); runtime.dispose()
    assert.equal(pending.status, 'pending'); assert.equal(settled.status, 'ready')
    for (const state of [pending, settled]) {
      const layout = svgPointNodeLayout(style, state), solution = layout.geometry.solution!
      assert.ok(solution); assert.equal(layout.geometry.limitation, undefined)
      assert.equal(solution.signedFittedAxes!.x, -1.2)
      assert.ok(Math.abs(solution.signedFittedAxes!.y / 1.2 - 10.606601717798) < 1e-10)
      assert.ok(solution.contours[0]!.path.startsWith('M -1.2 0 A 1.2 '))
      assert.ok(solution.contours[0]!.path.includes(' 0 0 1 1.2 0 A '))
      assert.equal(layout.placementOffset.x + layout.selectedAnchor.x, 0)
      assert.equal(layout.placementOffset.y + layout.selectedAnchor.y, 0)
      const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture, state })))
      assert.equal(live, renderSettledSvgLabelDocument(capture, state))
      assert.ok(live.includes(`d="${solution.contours[0]!.path}"`))
      assert.ok(live.includes('stroke-dasharray="2.4 6"')); assert.ok(live.includes(`stroke-dashoffset="${phase * 1.2}"`))
      assert.ok(live.includes('stroke-linecap="round"') && live.includes('stroke-linejoin="bevel"'))
      const commits = new Map([['p', { source: '', ownerIdentity: owner, fontGeneration: 0, shape: style.shape, size: style.size,
        requestIdentity: state.requestIdentity, layout }]])
      assert.equal(currentSvgPointNodeLayout(point, commits, 32, 0), layout)
      const cursor = svgPointToModelOnWorkPlane(diagram.camera, projected, 360, ambientDimension === 2 ? { kind: 'xy', z: 0 } : { kind: 'xz', y: 2 })
      for (const axis of ['x', 'y', 'z'] as const) assert.ok(Math.abs(cursor[axis] - point.position[axis]) < 1e-8)
      const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: commits,
        pointDocumentRevision: 32, pointFontGeneration: 0, showCoordinateAnchors: false }
      // A point inside the signed narrow ellipse has the same owner regardless
      // of the noncentral placement anchor or dash phase.
      const hit = { x: projected.x + layout.placementOffset.x, y: projected.y + layout.placementOffset.y }
      assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: hit })[0]?.id, 'p')
      assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: { x: hit.x + 20, y: hit.y + 30 } }), [])
      assert.equal(currentSvgPointNodeLayout(point, commits, 33, 0), null)
    }
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const tikz = generateTikz(loaded.diagram, { exportMode })
      assert.ok(tikz.includes('ellipse,')); assert.ok(tikz.includes(`anchor=${anchor}`))
      assert.ok(tikz.includes('inner xsep=-20pt') && tikz.includes('inner ysep=7.5pt'))
      assert.ok(tikz.includes('dash pattern=on 2pt off 5pt')); assert.ok(tikz.includes(`dash phase=${phase}pt`))
      assert.ok(tikz.includes(ambientDimension === 2 ? 'at (1,2)' : 'at (1,2,3)'))
    }
    assert.deepEqual(diagram, before)
  }
})
