import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'
import { generateTikzForUi } from '../../src/ui/tikzExportMode.ts'
import { signedPointStandaloneRootAttributes } from '../../scripts/signedPointStandaloneAssociation.mjs'
import { foldedCylinderScenario, foldedCylinderOwner, foldedCylinderLayout, foldedCylinderReference, observeFoldedCylinderPixels } from '../../scripts/foldedCylinderContract.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'

// Fabricated complete raw records exercise offline acceptance/corruption policy.
// They never replace App native inputs, downloaded files or measured PNG paint.
const group = 'point-node-layout-anchors-combined', identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
function state(dimension, anchor = 'bottom', revision = 100) {
  const diagram = createEmptyDiagram({ ambientDimension: dimension })
  diagram.strata = [createPointStratum({ id: foldedCylinderOwner, ambientDimension: dimension, text: '', layer: 0,
    position: { x: 3, y: 3, z: dimension === 3 ? .5 : 0 }, style: { kind: 'pointStyle', shape: 'cylinder', shapeParameters: { aspect: 1 },
      size: 8, color: '#203040', opacity: 1, fill: 'filled', layout: { ...structuredClone(foldedCylinderLayout), anchor },
      paint: { text: { color: '#203040', opacity: 1 }, fill: { enabled: true, color: '#d8ecff', opacity: .7 },
        stroke: { enabled: true, color: '#203040', opacity: 1, width: .4, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } } } })]
  return { json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), labelDocumentRevision: revision,
    uiSettings: JSON.stringify({ includeCoordinateAxesInTikz: false, ...(dimension === 3 ? { camera3d: diagram.camera } : {}) }), requests: 1,
    selection: { kind: 'stratum', id: foldedCylinderOwner } }
}
const field = anchor => ({ key: 'anchor', modelValue: anchor, value: anchor, requestsUnchanged: true, events: [{ type: 'input', trusted: true, value: anchor }] })
function rendered(current, anchor, reference) {
  const diagram = JSON.parse(current.runtimeDiagramJson), point = diagram.strata[0], projected = projectToSvgPoint(resolveSvgCamera(diagram, 520, 360, {
    fitToView: true, extraPointsForFit: createCoordinateAxesGuide(diagram.ambientDimension).fitPoints }), point.position, 360)
  const expected = reference.expectedAnchors[anchor], anchorOffset = { x: expected.x * 1.2, y: expected.y * 1.2 }, placementOffset = { x: -anchorOffset.x || 0, y: -anchorOffset.y || 0 }
  const transform = placementOffset.x === 0 && placementOffset.y === 0 ? {} : { transform: `translate(${placementOffset.x} ${placementOffset.y})` }
  const paint = { fill: '#d8ecff', 'fill-opacity': '0.7', stroke: '#203040', 'stroke-opacity': '1', 'stroke-width': '0.48', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', ...transform }
  const owner = JSON.stringify(['point-node', current.labelDocumentRevision, point.id]), request = JSON.stringify(['', 'fixture-runtime', 12, 'Inter,Arial,sans-serif', 'settings', 0, 1000, 0, owner])
  const matrix = { ...identity, e: Math.fround(projected.x) + Math.fround(placementOffset.x), f: Math.fround(projected.y) + Math.fround(placementOffset.y) }
  return { source: '', shape: 'cylinder', anchor, state: 'ready', pointOwner: owner, pointRequest: request, bodyRequest: request,
    layout: { ...Object.fromEntries(Object.entries(point.style.layout).filter(([key]) => key !== 'units')) }, anchorOffset, placementOffset,
    bodyOrigin: { ...placementOffset }, baseline: placementOffset.y,
    placement: { x: projected.x, y: projected.y }, placedAnchor: { x: projected.x, y: projected.y },
    contour: { tag: 'path', attributes: { ...paint, d: 'M 11.52 -6 A 6 6 0 0 0 11.52 6 L 0.72 6 A 6 6 0 0 0 0.72 -6 Z' } },
    seams: [{ tag: 'path', attributes: { ...paint, fill: 'none', d: 'M 0.72 -6 A 6 6 0 0 0 0.72 6' } }], warningCount: 0, paintRegionCount: 0,
    nodeTransform: `translate(${projected.x} ${projected.y})`, bodyTransform: `translate(${placementOffset.x} ${placementOffset.y})`,
    bounds: { x: .72, y: -6, width: 10.8, height: 12 }, screenCTM: matrix, inkMatrix: matrix }
}
function nativeCase(dimension, reference) {
  const anchors = reference.anchors.map(anchor => { const current = state(dimension, anchor); return { ambientDimension: dimension, anchor, state: current, field: field(anchor), rendered: rendered(current, anchor, reference) } })
  const current = state(dimension), observed = rendered(current, 'bottom', reference)
  const selection = syntheticGeometricSelectionEvidence({ scenario: foldedCylinderScenario, id: foldedCylinderOwner, shape: 'cylinder', ambientDimension: dimension, state: current,
    initialSelection: current.selection })
  // The fabricated raw selection keeps all its dependent input/state/matrix
  // records coherent; native acceptance still comes only from the App runner.
  const local = { x: 11.52, y: -6 }, screen = { x: observed.screenCTM.e + local.x, y: observed.screenCTM.f + local.y }
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.layout?.owner) Object.assign(value.layout, { owner: observed.pointOwner, request: observed.pointRequest, bodyRequest: observed.pointRequest })
    if (value.geometry?.contour) Object.assign(value.geometry.contour, { localBoundary: local, boundary: screen,
      screenCTM: observed.screenCTM, CTM: observed.screenCTM, bounds: { x: observed.screenCTM.e + .72, y: observed.screenCTM.f - 6, width: 10.8, height: 12 } })
    if (Object.hasOwn(value, 'boundary')) value.boundary = screen
    if (value.requestedClick) value.requestedClick = screen
    if (value.type && ['pointerdown', 'pointerup', 'click'].includes(value.type)) value.client = screen
    for (const child of Object.values(value)) visit(child)
  }
  visit(selection)
  observed.nativeSelection = selection; observed.boundary = selection.requestedClick
  return { ambientDimension: dimension, anchors, final: { ambientDimension: dimension, anchor: 'bottom', state: current, rendered: observed, field: field('bottom') } }
}
function png(ctm) {
  const width = 1500, height = 1150, stride = width * 4 + 1, rows = Buffer.alloc(height * stride, 255)
  for (let y = 0; y < height; y++) {
    rows[y * stride] = 0
    for (let x = 0; x < width; x++) {
      const local = { x: x + .5 - ctm.e, y: y + .5 - ctm.f }
      const seam = local.x <= .72 && Math.abs(Math.hypot(local.x - .72, local.y) - 6) <= .6
      const body = local.x >= .72 && local.x <= 11.52 && Math.abs(local.y) <= 6
      if (!seam && !body) continue
      const offset = y * stride + 1 + x * 4; rows[offset] = 32; rows[offset + 1] = 48; rows[offset + 2] = 64
    }
  }
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
export function syntheticFoldedCylinderStandalone(directory, ambientDimension = 2) {
  const reference = foldedCylinderReference(), evidence = { scenario: foldedCylinderScenario, group, result: 'passed', pageErrors: [], reference,
    cases: [2, 3].map(dimension => nativeCase(dimension, reference)), downloads: [] }
  let pngBytes
  for (const dimension of [2, 3]) {
    const current = state(dimension, 'bottom', 101), observed = rendered(current, 'bottom', reference), point = JSON.parse(current.runtimeDiagramJson).strata[0]
    const runtime = { identity: 'fixture-runtime', fontGeneration: 0, documentRevision: 101 }, stem = `${foldedCylinderScenario}-${dimension}d`
    const svgPath = join(directory, `${stem}.svg`), fileUrl = pathToFileURL(svgPath).href, pngPath = join(directory, `${stem}.png`)
    const raster = png(observed.screenCTM); if (dimension === ambientDimension) pngBytes = raster
    const root = { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }
    const measurement = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false, parserErrors: [], root: { ...root,
      bounds: { x: 0, y: 0, width: 520, height: 360 } }, viewport: { width: 1500, height: 1150 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 1 }
    evidence.downloads.push({ scenario: stem, group, background: 'transparent', ambientDimension: dimension, beforeExportState: current, savedJson: current.json,
      expected: [{ id: point.id, source: '', shape: 'cylinder', modelPoint: point, rendered: observed }],
      outputs: Object.fromEntries(['standalone', 'inlineMath'].map(mode => [mode, generateTikzForUi(JSON.parse(current.runtimeDiagramJson), { ...JSON.parse(current.uiSettings), exportMode: mode })])),
      preExport: { url: 'http://localhost:5173/stratified-tikz/scripts/fixtures/freeLabelsApp.html', rootCount: 1, rootConnected: true, labelDocumentRevision: 101, runtime,
        points: [{ id: point.id, source: '', bodySource: '', owner: observed.pointOwner, request: observed.pointRequest, bodyRequest: observed.pointRequest, nodeTransform: observed.nodeTransform, bodyTransform: observed.bodyTransform }] },
      click: { snapshot: { ...current, runtime, documentUnchanged: true, points: [{ id: point.id, source: '', modelSource: '', style: point.style, position: point.position,
        status: 'ready', held: null, runtime, request: observed.pointRequest, pointRequest: observed.pointRequest, owner: observed.pointOwner, nodeTransform: observed.nodeTransform, layout: JSON.stringify(observed.layout) }] } },
      capture: { status: 'saved', requestedPath: pngPath, retainedPath: pngPath, fileExists: true, options: { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 },
        measurements: [measurement], before: measurement, after: structuredClone(measurement), coverage: { completeRoot: true, bounds: measurement.root.bounds, viewport: measurement.viewport },
        coordinatesStable: true, png: { width: 1500, height: 1150, bytes: raster.length } }, paintPixels: observeFoldedCylinderPixels(raster, observed.screenCTM) })
  }
  const download = evidence.downloads.find(item => item.ambientDimension === ambientDimension), stem = download.scenario, observed = download.expected[0].rendered
  const svgPath = join(directory, `${stem}.svg`), pngPath = join(directory, `${stem}.png`), fileUrl = pathToFileURL(svgPath).href
  const outer = { ...identity, e: Math.fround(Number(/translate\(([^ ]+)/u.exec(observed.nodeTransform)[1])), f: Math.fround(Number(/ ([^)]+)/u.exec(observed.nodeTransform)[1])) }, placed = observed.screenCTM
  const raw = { ...structuredClone(download), result: 'observed', svgPath, fileUrl, requests: [fileUrl], pageErrors: [], standaloneErrors: [], cleanupErrors: [],
    reopened: [{ domOrdinal: 0, source: '', nodeTransform: observed.nodeTransform, bodyTransform: observed.bodyTransform, paint: [observed.contour, ...observed.seams],
      paths: { node: [0, 0, 0], outline: [0, 0, 0, 0], seam: [0, 0, 0, 1], body: [0, 0, 0, 2], title: [0, 0, 0, 2, 0] },
      matrices: { nodeCTM: outer, nodeScreenCTM: outer, bodyCTM: placed, bodyScreenCTM: placed, outlineCTM: placed, outlineScreenCTM: placed, seamCTM: placed, seamScreenCTM: placed } }],
    document: { root: { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }, rootAttributes: signedPointStandaloneRootAttributes,
      forbiddenCount: 0, externalReferences: [], backgroundCount: 0, frame: { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', rootCTM: identity, rootScreenCTM: identity,
        rootBounds: { x: 0, y: 0, width: 520, height: 360 }, scroll: { x: 0, y: 0 }, viewport: { width: 1500, height: 1150 } } } }
  const attrs = value => Object.entries(value).map(([key, val]) => `${key}="${val}"`).join(' ')
  raw.xml = `<svg ${attrs(signedPointStandaloneRootAttributes)}><g><g><g transform="${observed.nodeTransform}">${[observed.contour, ...observed.seams].map(item => `<path ${attrs(item.attributes)}/>`).join('')}<g transform="${observed.bodyTransform}"><title/><g transform="translate(0 0)" opacity="1" fill="#203040" color="#203040" pointer-events="none"><g/></g></g></g></g></g></svg>`
  const native = { scenario: foldedCylinderScenario, group, result: 'observed', reference, case: evidence.cases.find(item => item.ambientDimension === ambientDimension) }
  writeFileSync(svgPath, raw.xml); writeFileSync(pngPath, pngBytes); writeFileSync(join(directory, `${stem}-native.json`), JSON.stringify(native))
  writeFileSync(join(directory, `${stem}-saved.json`), download.savedJson)
  for (const [mode, source] of Object.entries(download.outputs)) writeFileSync(join(directory, `${stem}-${mode}.tex`), source)
  return { evidence, download, raw, native, png: pngBytes, svgPath, pngPath }
}
