// Fabricated records exercise acceptance/corruption policy only. Their PNG masks
// intentionally have simple shapes and are never native/PGF paint evidence.
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { syntheticFoldedCylinderStandalone } from './foldedCylinderFixture.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'
import { conformanceCases, conformanceStem, conformanceSpec, conformancePaint, conformanceReference, pgfConformancePath,
  conformanceProbeSvg, oldConformancePath, compareConformancePng } from '../../scripts/pointConformanceContract.mjs'
import { solvePointNodeShape } from '../../src/geometry/pointNodeShapes/index.ts'
import { generateTikzForUi } from '../../src/ui/tikzExportMode.ts'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const attrs = values => Object.entries(values).map(([key, value]) => `${key}="${value}"`).join(' ')
export function syntheticConformanceMaskPng(shift = 0, painted = true) {
  const width = 800, height = 800, rows = Buffer.alloc(height * (width * 4 + 1), 255)
  for (let y = 0; y < height; y++) { rows[y * (width * 4 + 1)] = 0; for (let x = 100 + shift; x < 110 + shift; x++) if (painted && y >= 100 && y < 140) {
    const at = y * (width * 4 + 1) + 1 + x * 4; rows[at] = 0; rows[at + 1] = 0; rows[at + 2] = 0
  } }
  const chunk = (kind, content) => {
    const data = Buffer.concat([Buffer.from(kind), content]), crcBytes = Buffer.alloc(4), length = Buffer.alloc(4)
    let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    crcBytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0); length.writeUInt32BE(content.length)
    return Buffer.concat([length, data, crcBytes])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
function replaceStem(value, from, to) {
  if (typeof value === 'string') return value.replaceAll(from, to)
  if (Array.isArray(value)) return value.map(entry => replaceStem(entry, from, to))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceStem(entry, from, to)]))
  return value
}
export function populateSyntheticConformance(directory) {
  const entries = [], raws = [], masks = [syntheticConformanceMaskPng(), syntheticConformanceMaskPng(30)]
  for (const dimension of [2, 3]) {
    const template = syntheticFoldedCylinderStandalone(directory, dimension)
    for (const key of conformanceCases) {
      const stem = conformanceStem(key, dimension), raw = replaceStem(template.raw, template.raw.scenario, stem), spec = conformanceSpec(key), reference = conformanceReference(key)
      const current = structuredClone(raw.beforeExportState), diagram = JSON.parse(current.runtimeDiagramJson), point = diagram.strata[0]
      point.id = 'app-point'; point.style.shape = spec.shape; point.style.shapeParameters = spec.parameters; point.style.layout = spec.layout; point.style.paint = conformancePaint(key)
      current.selection = { kind: 'stratum', id: point.id }; current.runtimeDiagramJson = JSON.stringify(diagram)
      current.json = JSON.stringify({ version: 2, diagram }); current.history = JSON.stringify({ past: [], present: diagram, future: [] })
      const solution = solvePointNodeShape({ shape: spec.shape, body: { width: 0, height: 0, depth: 0 },
        ...Object.fromEntries(Object.entries(spec.layout).filter(([key]) => key !== 'anchor').map(([key, value]) => [key, value * 1.2])),
        anchor: spec.layout.anchor, parameters: spec.parameters, unitScale: 1.2, fontContext: { em: 12, ex: 4.30554 * 1.2 } })
      const observed = structuredClone(raw.expected[0].rendered), offset = { x: -solution.placementAnchor.x || 0, y: -solution.placementAnchor.y || 0 }
      observed.shape = spec.shape; observed.anchor = spec.layout.anchor; observed.layout = spec.layout; observed.anchorOffset = solution.placementAnchor
      // A native inverse-CTM product can retain roundoff even though the
      // center-anchored contour has no literal geometric transform.
      observed.placementOffset = key === 'ellipse-signed-dashes' ? { x: Number.EPSILON, y: -Number.EPSILON } : offset
      observed.pointOwner = JSON.stringify(['point-node', current.labelDocumentRevision, point.id])
      const request = JSON.parse(observed.pointRequest); request[8] = observed.pointOwner; observed.pointRequest = JSON.stringify(request); observed.bodyRequest = observed.pointRequest
      observed.contour = { tag: 'path', attributes: { fill: 'none', 'fill-opacity': '1', stroke: '#000000', 'stroke-width': '.48', 'stroke-opacity': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': '10', 'stroke-dashoffset': '0',
        ...(key === 'ellipse-signed-dashes' ? { 'stroke-dasharray': '2.4 6', 'stroke-dashoffset': '-3.24' } : {}),
        ...(offset.x || offset.y ? { transform: `translate(${offset.x} ${offset.y})` } : {}), d: solution.contours[0].path } }
      observed.seams = []; observed.nativeTraversal = [{ x: -1.2, y: 0 }, { x: 0, y: -12.72793 }, { x: 1.2, y: 0 }, { x: 0, y: 12.72793 }, { x: -1.2, y: 0 }]
      observed.bodyTransform = `translate(${offset.x} ${offset.y})`
      observed.nativeSelection = syntheticGeometricSelectionEvidence({ scenario: 'point-layout-signed-polygonal-zero-axis', id: point.id, shape: spec.shape, ambientDimension: dimension, state: current })
      raw.key = key; raw.reference = reference; raw.native = { key, ambientDimension: dimension, rendered: observed, state: current }
      raw.beforeExportState = current; raw.afterLive = structuredClone(current); raw.savedJson = current.json
      raw.expected = [{ id: point.id, source: '', shape: spec.shape, modelPoint: point, rendered: observed }]
      raw.click.snapshot = { ...structuredClone(current), runtime: raw.click.snapshot.runtime, documentUnchanged: true,
        points: [{ id: point.id, source: '', modelSource: '', style: point.style, position: point.position, owner: observed.pointOwner, request: observed.pointRequest,
          pointRequest: observed.pointRequest, nodeTransform: observed.nodeTransform }] }
      delete raw.click.snapshot.labelDocumentRevision
      raw.click.snapshot.runtime.documentRevision = current.labelDocumentRevision
      raw.outputs = Object.fromEntries(['standalone', 'inlineMath'].map(mode => [mode, generateTikzForUi(diagram, { ...JSON.parse(current.uiSettings), exportMode: mode })]))
      raw.reopened = [{ source: '', errors: 0, nodeTransform: observed.nodeTransform, bodyTransform: observed.bodyTransform, contour: observed.contour }]
      raw.xml = `<svg ${attrs(raw.document.rootAttributes)}><g><g><g transform="${observed.nodeTransform}"><path ${attrs(observed.contour.attributes)}/><g transform="${observed.bodyTransform}"><title/></g></g></g></g><g/></svg>`
      raw.fileUrl = pathToFileURL(join(directory, `${stem}.svg`)).href; raw.svgPath = join(directory, `${stem}.svg`)
      raw.terminal = { key, ambientDimension: dimension, artifact: `${stem}.json`, svg: `${stem}.svg`, result: 'passed' }
      const liveBytes = readFileSync(template.pngPath)
      raw.liveCapture = { attempts: 1, bytes: liveBytes.length, sha256: hash(liveBytes), width: liveBytes.readUInt32BE(16), height: liveBytes.readUInt32BE(20) }
      writeFileSync(join(directory, `${stem}-live.png`), liveBytes); writeFileSync(join(directory, `${stem}.png`), liveBytes)
      for (const stage of ['live', 'reopened']) {
        const probe = { key, stage, reference, observedContour: observed.contour, actualPath: observed.contour.attributes.d, pgfPath: pgfConformancePath(reference) }
        probe.oldPath = oldConformancePath(key, probe.actualPath)
        for (const kind of ['actual', 'pgf', 'old']) {
          const svg = conformanceProbeSvg(key, probe[`${kind}Path`], observed.contour.attributes), pngBytes = masks[kind === 'old' ? 1 : 0]
          writeFileSync(join(directory, `${stem}-${stage}-${kind}.input.svg`), svg); writeFileSync(join(directory, `${stem}-${stage}-${kind}.png`), pngBytes)
          probe[kind] = { svg, svgSha256: hash(svg), pngSha256: hash(pngBytes), bytes: pngBytes.length }
        }
        probe.comparison = compareConformancePng(masks[0], masks[0]); probe.negativeControl = compareConformancePng(masks[1], masks[0])
        raw[stage === 'live' ? 'live' : 'reopenedPaint'] = probe
      }
      writeFileSync(join(directory, `${stem}.svg`), raw.xml); writeFileSync(join(directory, `${stem}-saved.json`), raw.savedJson)
      for (const mode of ['standalone', 'inlineMath']) writeFileSync(join(directory, `${stem}-${mode}.tex`), raw.outputs[mode])
      writeFileSync(join(directory, `${stem}.json`), JSON.stringify(raw)); writeFileSync(join(directory, `${stem}-standalone.json`), JSON.stringify(raw))
      entries.push(raw.terminal); raws.push(raw)
    }
  }
  return { geometryConformance: entries, raws }
}
