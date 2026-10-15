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
import { getPointPaint } from '../../src/model/styles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { PointStyle, Vec2, WorkPlane } from '../../src/model/types.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelRuntime, initialSvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { svgPointNodeLayout, currentSvgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { collectSvgPreviewSelectionCandidates, nextSvgPreviewSelectionCycle } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

type NodeReference = PointNodeShapeInput & { id: string; kind: 'node' }
type ArcReference = { id: string; kind: 'arc'; center: Vec2; rx: number; ry: number; start: number; end: number; rotation: number }
type RenderObservation = { path: string; svg: string; png: string; command: string[]; exitCode: number;
  width: number; height: number; blackPixelCount: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } | null }
const directory = new URL('../fixtures/point-node-anchors/zero-axis/', import.meta.url)
const referenceBytes = readFileSync(new URL('references.json', directory))
const references = JSON.parse(referenceBytes.toString()) as { cases: (NodeReference | ArcReference)[] }
const renders = JSON.parse(readFileSync(new URL('render-results.json', directory), 'utf8')) as {
  schema: string; rendererVersion: string; referenceSha256: string; rendererScriptSha256: string; artifactHashes: Record<string, string>;
  partialReferenceNormalization: string; records: { id: string; caseId: string; style: { id: string; attributes: string };
    observations: { production: RenderObservation; pgf: RenderObservation; 'pgf-raw'?: RenderObservation } }[]
}
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')
function close(actual: number, expected: number, tolerance = 1e-8) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`) }

// Inspect actual retained PNG scanlines, independently of reported pixel metrics.
function decodePng(bytes: Buffer): { width: number; height: number; rgba: Buffer } {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  let offset = 8, width = 0, height = 0, channels = 0, ended = false
  const chunks: Buffer[] = []
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8)
    assert.ok(offset + size + 12 <= bytes.length)
    const data = bytes.subarray(offset + 8, offset + 8 + size)
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      assert.equal(data[8], 8); assert.ok(data[9] === 2 || data[9] === 6); assert.equal(data[12], 0)
      channels = data[9] === 2 ? 3 : 4
    } else if (kind === 'IDAT') chunks.push(data)
    else if (kind === 'IEND') ended = true
    offset += size + 12
  }
  assert.ok(ended && width === 800 && height === 800 && channels > 0)
  const stride = width * channels, raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: height * (stride + 1) })
  assert.equal(raw.length, height * (stride + 1))
  const decoded = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    assert.ok(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, left = x >= channels ? decoded[at - channels]! : 0
      const up = y ? decoded[at - stride]! : 0, corner = y && x >= channels ? decoded[at - stride - channels]! : 0
      const p = left + up - corner
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
        : Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner) ? left : Math.abs(p - up) <= Math.abs(p - corner) ? up : corner
      decoded[at] = (raw[y * (stride + 1) + x + 1]! + predictor) & 255
    }
  }
  const rgba = Buffer.alloc(width * height * 4, 255)
  for (let index = 0; index < width * height; index++) for (let channel = 0; channel < channels; channel++) rgba[index * 4 + channel] = decoded[index * channels + channel]!
  return { width, height, rgba }
}
function pixels(png: ReturnType<typeof decodePng>) {
  let count = 0
  const bounds = { minX: png.width, minY: png.height, maxX: -1, maxY: -1 }
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.rgba[(y * png.width + x) * 4]! >= 127) continue
    count++
    bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y)
  }
  return { count, bounds: count ? bounds : null }
}

test('independent zero-axis renderer evidence authenticates actual SVG/PNG, full PGF paths and explicitly separated partial normalization', () => {
  assert.equal(renders.schema, 'stz-independent-zero-axis-render-v1')
  assert.match(renders.rendererVersion, /^rsvg-convert version 2\.63\.0/)
  assert.equal(renders.referenceSha256, hash(referenceBytes))
  assert.equal(renders.rendererScriptSha256, hash(readFileSync(new URL('render.mjs', directory))))
  assert.equal(renders.records.length, 37)
  assert.equal(renders.records.filter(({ caseId }) => references.cases.find(({ id }) => id === caseId)?.kind === 'node').length, 25)
  assert.match(renders.partialReferenceNormalization, /de Casteljau/)
  for (const [file, expected] of Object.entries(renders.artifactHashes)) assert.equal(hash(readFileSync(new URL(file, directory))), expected, file)
})

for (const record of renders.records) test(`actual independent stroke/fill raster: ${record.id}`, () => {
  const entry = references.cases.find(({ id }) => id === record.caseId)!
  const contour = entry.kind === 'node' ? solvePointNodeShape(entry).contours[0]!
    : new ShapeContourBuilder(entry.rotation).move(ellipsePoint(entry.center, entry.rx, entry.ry, entry.start))
      .arc(entry.center, entry.rx, entry.ry, entry.start, entry.end).finish()
  assert.equal(contour.path, record.observations.production.path, 'The retained actual renderer input is the current emitted production path')
  for (const observation of Object.values(record.observations)) {
    assert.equal(observation.exitCode, 0)
    assert.ok(readFileSync(new URL(observation.svg, directory), 'utf8').includes(`d="${observation.path}" ${record.style.attributes}`))
    const raster = decodePng(readFileSync(new URL(observation.png, directory))), mask = pixels(raster)
    assert.equal(mask.count, observation.blackPixelCount)
    assert.deepEqual(mask.bounds, observation.bounds)
  }
  const production = decodePng(readFileSync(new URL(record.observations.production.png, directory)))
  const independent = decodePng(readFileSync(new URL(record.observations.pgf.png, directory)))
  let totalDifference = 0, greatestDifference = 0
  for (let index = 0; index < production.rgba.length; index += 4) {
    const difference = Math.abs(production.rgba[index]! - independent.rgba[index]!)
    totalDifference += difference; greatestDifference = Math.max(greatestDifference, difference)
  }
  assert.ok(greatestDifference <= 10 && totalDifference <= 80, 'PGF fixed-point differences only affect boundary antialias values, including dash phase/cap/join')
  assert.deepEqual(record.observations.production.bounds, record.observations.pgf.bounds)
  assert.ok(Math.abs(record.observations.production.blackPixelCount - record.observations.pgf.blackPixelCount) <= 1)
  if (record.style.id === 'zero-area-fill') assert.equal(record.observations.production.blackPixelCount, 0, 'Retracing never creates fill area')
  if (entry.kind === 'node' && entry.id !== 'both-zero' && record.style.id === 'butt-miter') {
    assert.equal(record.observations.production.blackPixelCount, 2264)
    assert.deepEqual(record.observations.production.bounds, entry.id.startsWith('zero-x')
      ? { minX: 398, minY: 117, maxX: 401, maxY: 682 } : { minX: 117, minY: 398, maxX: 682, maxY: 401 })
  }
})

const measurement: TextMeasurementProvider = { identity: '32d-empty-zero-axis',
  measure: () => ({ width: 0, ascent: 0, descent: 0 }), lineMetrics: () => ({ ascent: 0, descent: 0 }) }
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
const settings = svgLabelLayoutSettings(12, svgPointNodeTextFontFamily)
function styleFor(entry: NodeReference): PointStyle {
  let style: PointStyle = { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
    shape: 'ellipse', layout: { anchor: 'center' } }
  style.paint = structuredClone(getPointPaint(style))
  style.paint.stroke.enabled = true; style.paint.stroke.width = .4
  for (const field of pointNodeDimensionFields) {
    const changed = updatePointNodeDimension(style, [field], ` ${entry[field]}pt `)
    assert.ok(changed); style = changed
  }
  return style
}
function commit(style: PointStyle, requestIdentity: string, layout: ReturnType<typeof svgPointNodeLayout>, id = 'p'): SvgPointNodeCommit {
  return { source: '', ownerIdentity: svgPointNodeOwner(1, id), fontGeneration: 0, shape: style.shape, size: style.size, requestIdentity, layout }
}

for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D: zero axes retain exact saved/raw provenance and current/live/pending/settled paint/picking/TikZ`, async () => {
  for (const entry of references.cases.filter((value): value is NodeReference => value.kind === 'node')) {
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.camera = diagram.camera.mode === '2d' ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
      : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
    const point = createPointStratum({ ambientDimension, id: 'p', text: '', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, style: styleFor(entry) })
    diagram.strata = [point]
    const original = structuredClone(point)
    assert.equal(validateDiagram(diagram).valid, true)
    const saved = serializeDiagram(diagram), loaded = parseSavedDiagramJson(saved)
    assert.equal((JSON.parse(saved) as { version: number }).version, 2)
    assert.ok(loaded.ok)
    assert.deepEqual(loaded.diagram.strata, diagram.strata)
    const capture = captureSvgLabelExport({ runtime, source: '', pointStyle: point.style, position: { x: 123, y: 87 },
      fontSize: 12, fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center', settings, ownerIdentity: svgPointNodeOwner(1, 'p') })
    const pending = initialSvgLabelState(capture, runtime), [settled] = await settleSvgExportLabels([capture])
    assert.equal(settled.status, 'ready')
    for (const state of [pending, settled]) {
      const layout = svgPointNodeLayout(point.style, state)
      assert.equal(layout.geometry.limitation, undefined)
      assert.ok(layout.geometry.solution)
      const expected = solvePointNodeShape({ ...entry, innerXSep: entry.innerXSep * 1.2, innerYSep: entry.innerYSep * 1.2,
        minimumWidth: entry.minimumWidth * 1.2, minimumHeight: entry.minimumHeight * 1.2 }).contours[0]!
      assert.equal(layout.geometry.solution.contours[0]!.path, expected.path)
      assert.ok(!expected.path.includes(' A '))
      const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture, state })))
      const detached = renderSettledSvgLabelDocument(capture, state)
      assert.equal(live, detached)
      assert.ok(live.includes(`d="${expected.path}"`))
      assert.ok(live.includes('stroke-width="0.48"') && live.includes('stroke-linecap="butt"') && live.includes('stroke-linejoin="miter"'))
      if (entry.id === 'zero-x-positive') close(layout.shapeBounds.maxY, 33.941125496954285)
      const pointCommits = new Map([['p', commit(point.style, state.requestIdentity, layout)]])
      assert.equal(currentSvgPointNodeLayout(point, pointCommits, 1, 0), layout)
      const center = projectToSvgPoint(diagram.camera, point.position, 360)
      const plane: WorkPlane = ambientDimension === 2 ? { kind: 'xy', z: 0 } : { kind: 'xz', y: 2 }
      const cursor = svgPointToModelOnWorkPlane(diagram.camera, center, 360, plane)
      close(cursor.x, point.position.x); close(cursor.y, point.position.y); close(cursor.z, point.position.z)
      if (entry.id !== 'both-zero') {
        const local = entry.innerXSep === 0 ? { x: 0, y: 20 } : { x: 20, y: 0 }
        const hit = { x: center.x + local.x, y: center.y + local.y }
        const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits,
          pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
        assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: hit })[0]?.id, 'p')
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: { x: hit.x + 9, y: hit.y + 9 } }), [])
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, pointDocumentRevision: 2 }), [])
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, pointFontGeneration: 1 }), [])
        assert.equal(currentSvgPointNodeLayout({ ...point, text: 'stale source' }, pointCommits, 1, 0), null)
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, layerFilter: { kind: 'layer', layer: 1 } }), [])
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, visibility: { hiddenPointIds: new Set(['p']) } }), [])
        diagram.layers = [{ value: 0, name: 'Points', locked: true }]
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit }), [])
        diagram.layers = [{ value: 0, name: 'Points' }]
        const overlap = { ...structuredClone(point), id: 'overlap' }
        diagram.strata.push(overlap); pointCommits.set('overlap', commit(point.style, state.requestIdentity, layout, 'overlap'))
        const candidates = collectSvgPreviewSelectionCandidates({ ...options, point: hit })
        const first = nextSvgPreviewSelectionCycle(null, hit, candidates), second = nextSvgPreviewSelectionCycle(first.state, hit, candidates)
        assert.deepEqual(new Set([first.candidate?.id, second.candidate?.id]), new Set(['p', 'overlap']))
        diagram.strata.pop()
      }
    }
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const tikz = generateTikz(loaded.diagram, { exportMode })
      for (const [index, name] of ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height'].entries()) {
        assert.ok(tikz.includes(`${name}=${entry[pointNodeDimensionFields[index]!]}pt`))
      }
      assert.ok(tikz.includes('anchor=center'))
      assert.ok(tikz.includes('{}'), 'The empty authored raw body remains empty')
    }
    assert.deepEqual(point, original)
  }
})
