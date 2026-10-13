import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { singularCylinderScenario, singularCylinderOwner, singularCylinderLayout, singularCylinderParameters,
  singularCylinderWarning, singularCylinderWarningPath, singularCylinderLimitation, observeSingularCylinderPixels } from '../../scripts/singularCylinderDiagnosticContract.mjs'
import { generateTikzForUi } from '../../src/ui/tikzExportMode.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'
import { signedPointStandaloneRootAttributes } from '../../scripts/signedPointStandaloneAssociation.mjs'

// Fabricated records and raster exercise strict offline policy only. Native
// acceptance always comes from the real App workflow and actual download.
const group = 'point-node-layout-anchors-combined', identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
function state(dimension, width = 0, selection = null, revision = 100) {
  const diagram = createEmptyDiagram({ ambientDimension: dimension }), layout = structuredClone(singularCylinderLayout)
  layout.minimumWidth = width; layout.units.minimumWidth = { source: `${width}pt`, unit: 'pt', texPoints: width }
  diagram.strata = [createPointStratum({ id: singularCylinderOwner, ambientDimension: dimension, text: '', layer: 0,
    position: { x: 3, y: 3, z: dimension === 3 ? .5 : 0 }, style: { kind: 'pointStyle', size: 8, shape: 'cylinder', color: '#203040', opacity: 1, fill: 'filled',
      layout, shapeParameters: structuredClone(singularCylinderParameters), paint: { text: { color: '#203040', opacity: 1 },
        fill: { enabled: true, color: '#d8ecff', opacity: .7 }, stroke: { enabled: true, color: '#203040', opacity: 1, width: .4,
          lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } } } })]
  return { json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), labelDocumentRevision: revision, uiSettings: JSON.stringify({ includeCoordinateAxesInTikz: false, ...(dimension === 3 ? { camera3d: diagram.camera } : {}) }), requests: 1, selection }
}
function observation(current, singular = true) {
  const point = JSON.parse(current.runtimeDiagramJson).strata[0], owner = JSON.stringify(['point-node', current.labelDocumentRevision, singularCylinderOwner])
  const request = JSON.stringify(['', 'fixture-runtime', 12, 'Inter,Arial,sans-serif', 'settings', 0, 1000, 0, owner])
  const diagram = JSON.parse(current.runtimeDiagramJson)
  const projected = projectToSvgPoint(resolveSvgCamera(diagram, 520, 360, { fitToView: true,
    extraPointsForFit: createCoordinateAxesGuide(diagram.ambientDimension).fitPoints }), point.position, 360)
  const matrix = { ...identity, e: Math.fround(projected.x), f: Math.fround(projected.y) }
  return { id: singularCylinderOwner, source: '', bodySource: '', shape: 'cylinder', state: 'ready', owner, request, bodyRequest: request,
    limitation: singular ? singularCylinderLimitation : null,
    resolvedLayout: Object.fromEntries(Object.entries(point.style.layout).filter(([key]) => key !== 'units')),
    warning: singular ? { tag: 'path', attributes: { d: singularCylinderWarningPath, fill: '#B45309' } } : null,
    warningTitle: singular ? singularCylinderWarning : null, contourCount: singular ? 0 : 1, warningCount: singular ? 1 : 0,
    internalBorderCount: singular ? 0 : 1, paintRegionCount: singular ? 0 : 2, bodyTargetCount: 0, glyphCount: 0,
    bodyTitle: '', bodyTitleCount: 1, bodyChildTags: ['title', 'g'], inkChildTags: ['g'], contentChildTags: [],
    nodeTransform: `translate(${projected.x} ${projected.y})`, bodyTransform: 'translate(0 0)', paintedBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    ring: current.selection ? { r: 19, cx: 0, cy: 0 } : null,
    matrices: { nodeCTM: matrix, nodeScreenCTM: matrix, bodyCTM: matrix, bodyScreenCTM: matrix } }
}
function nativeCase(dimension) {
  const selected = { kind: 'stratum', id: singularCylinderOwner }, transitions = [12, 0, 12, 0].map((width, index) => {
    const current = state(dimension, width, selected)
    return { state: current, rendered: observation(current, width === 0), ...(index ? { field: { key: 'minimumWidth', value: `${width}pt`, modelValue: width,
      requestsUnchanged: true, events: [{ type: 'input', trusted: true, value: `${width}pt` }] } } : {}) }
  })
  const before = structuredClone(transitions.at(-1).state), token = `${singularCylinderScenario}-${dimension}d:synthetic-diagnostic`
  const native = { result: 'passed', token, ambientDimension: dimension, before, preparation: { before, after: before, actions: [],
    uiBefore: { inspectorOpen: false, toolbarCollapsed: true }, selectPressed: 'true' }, clicks: [], secondaryErrors: [],
    cleanup: { observerPresentBefore: true, observerAbsentAfter: true } }
  let previous = before
  for (const kind of ['far', 'warning', 'far']) {
    const observed = observation(previous), local = kind === 'warning' ? { x: -7, y: 1 } : { x: 100, y: 0 }, screen = { x: observed.matrices.nodeScreenCTM.e + local.x, y: observed.matrices.nodeScreenCTM.f + local.y }
    const base = { tag: 'svg', id: '', connected: true, canvas: true, canvasToken: token, canvasRoot: true,
      background: false, pointId: null, ownerToken: null, pointRequest: null, bodyRequest: null, source: null, body: false, warning: false, ring: false, handle: false, overlay: false }
    const target = kind === 'warning' ? { ...base, tag: 'path', canvasRoot: false, warning: true, pointId: singularCylinderOwner,
      ownerToken: observed.owner, pointRequest: observed.request, bodyRequest: observed.request, source: '' } : base
    const after = { ...structuredClone(previous), selection: kind === 'warning' ? selected : null }
    const action = { kind, local, screen, before: previous, after, observation: observed, afterObservation: observation(after), hit: { target, stack: [target, base] },
      events: { errors: [], droppedEvents: 0, canvasCaptureAfterInput: false, events: ['pointerdown', 'pointerup', 'click'].map((type, order) => ({ type, order, trusted: true,
        epoch: 100, button: 0, buttons: type === 'pointerdown' ? 1 : 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
        x: screen.x, y: screen.y, pointerId: 1, canvasHasPointerCapture: false, target, path: [target, base], identity: { id: singularCylinderOwner, ambientDimension: dimension, shape: 'cylinder', epoch: 100, ownerToken: observed.owner,
          pointRequest: observed.request, bodyRequest: observed.request, source: '', anchor: 'center', canvasToken: token } })) } }
    action.inputObservation = structuredClone(observed); action.inputState = structuredClone(previous)
    action.inputHit = { screen: structuredClone(screen), hit: structuredClone(action.hit) }
    native.clicks.push(action); previous = after
  }
  native.restoration = { before: previous, after: previous, actions: [], uiAfter: { inspectorOpen: false, toolbarCollapsed: true } }
  native.after = previous
  return { ambientDimension: dimension, transitions, native }
}
function warningPng(ctm) {
  const width = 1500, height = 1150, stride = width * 4 + 1, scanlines = Buffer.alloc(height * stride, 255)
  for (let y = 0; y < height; y++) {
    scanlines[y * stride] = 0
    for (let x = Math.ceil(ctm.e - 8 - .5); x + .5 < ctm.e - 6; x++) if ((y + .5 >= ctm.f - 2 && y + .5 < ctm.f + 5) || (y + .5 >= ctm.f + 8 && y + .5 < ctm.f + 10)) {
      const offset = y * stride + 1 + x * 4
      scanlines[offset] = 180; scanlines[offset + 1] = 83; scanlines[offset + 2] = 9
    }
  }
  const chunk = (kind, content) => {
    const data = Buffer.concat([Buffer.from(kind), content]), crcBytes = Buffer.alloc(4)
    let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    crcBytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    const length = Buffer.alloc(4); length.writeUInt32BE(content.length)
    return Buffer.concat([length, data, crcBytes])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))])
}
export function syntheticSingularCylinderStandalone(directory, ambientDimension = 2) {
  const evidence = { scenario: singularCylinderScenario, group, result: 'passed', pageErrors: [], cases: [2, 3].map(nativeCase), downloads: [] }
  let png
  for (const dimension of [2, 3]) {
    const current = state(dimension, 0, null, 101), rendered = observation(current), point = JSON.parse(current.runtimeDiagramJson).strata[0]
    const runtime = { identity: 'fixture-runtime', fontGeneration: 0, documentRevision: 101 }
    const download = { scenario: `${singularCylinderScenario}-${dimension}d`, group, background: 'transparent', ambientDimension: dimension,
      beforeExportState: current, savedJson: current.json, expected: [{ id: point.id, source: '', shape: 'cylinder', modelPoint: point, rendered }],
      outputs: Object.fromEntries(['standalone', 'inlineMath'].map((mode) => [mode, generateTikzForUi(JSON.parse(current.runtimeDiagramJson), { ...JSON.parse(current.uiSettings), exportMode: mode })])),
      preExport: { url: 'http://localhost:5173/stratified-tikz/scripts/fixtures/freeLabelsApp.html', rootCount: 1, rootConnected: true,
        labelDocumentRevision: 101, runtime, point: rendered },
      click: { snapshot: { ...current, runtime, documentUnchanged: true, points: [{ id: point.id, source: '', modelSource: '', style: point.style, position: point.position,
        layout: JSON.stringify(rendered.resolvedLayout), status: 'ready', held: null, runtime, request: rendered.request, pointRequest: rendered.request,
        owner: rendered.owner, nodeTransform: rendered.nodeTransform }] } } }
    const raster = warningPng(rendered.matrices.nodeScreenCTM)
    if (dimension === ambientDimension) png = raster
    const svgPath = join(directory, `${download.scenario}.svg`), pngPath = join(directory, `${download.scenario}.png`), fileUrl = pathToFileURL(svgPath).href
    const root = { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }
    const measurement = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false, parserErrors: [],
      root: { ...root, bounds: { x: 0, y: 0, width: 520, height: 360 } }, viewport: { width: 1500, height: 1150 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 1 }
    download.capture = { status: 'saved', requestedPath: pngPath, retainedPath: pngPath, fileExists: true,
      options: { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 }, measurements: [measurement], before: measurement, after: structuredClone(measurement),
      coverage: { completeRoot: true, bounds: measurement.root.bounds, viewport: measurement.viewport }, coordinatesStable: true, png: { width: 1500, height: 1150, bytes: raster.length } }
    download.warningPixels = observeSingularCylinderPixels(raster, rendered.matrices.nodeScreenCTM)
    evidence.downloads.push(download)
  }
  const download = evidence.downloads.find(({ ambientDimension: dimension }) => dimension === ambientDimension), stem = download.scenario
  const svgPath = join(directory, `${stem}.svg`), pngPath = join(directory, `${stem}.png`), fileUrl = pathToFileURL(svgPath).href
  const paths = { node: [0, 0, 0], warning: [0, 0, 0, 0], warningTitle: [0, 0, 0, 0, 0], body: [0, 0, 0, 1], bodyTitle: [0, 0, 0, 1, 0], ink: [0, 0, 0, 1, 1], content: [0, 0, 0, 1, 1, 0] }
  const ctm = download.expected[0].rendered.matrices.nodeCTM, nodeTransform = download.expected[0].rendered.nodeTransform
  const raw = { ...structuredClone(download), result: 'observed', svgPath, fileUrl, requests: [fileUrl], pageErrors: [], standaloneErrors: [], cleanupErrors: [],
    reopened: [{ domOrdinal: 0, source: '', warning: download.expected[0].rendered.warning, warningTitle: singularCylinderWarning,
      nodeTransform, bodyTransform: 'translate(0 0)', paths,
      matrices: { nodeCTM: ctm, nodeScreenCTM: ctm, bodyCTM: ctm, bodyScreenCTM: ctm, warningCTM: ctm, warningScreenCTM: ctm } }],
    document: { root: { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' },
      rootAttributes: structuredClone(signedPointStandaloneRootAttributes), forbiddenCount: 0, externalReferences: [], backgroundCount: 0,
      inventory: { titleCount: 2, pathCount: 1, groupCount: 6, rootChildTags: ['g'] }, frame: { url: fileUrl, rootCTM: identity, rootScreenCTM: identity,
        rootBounds: { x: 0, y: 0, width: 520, height: 360 }, contentType: 'image/svg+xml', readyState: 'complete', scroll: { x: 0, y: 0 }, viewport: { width: 1500, height: 1150 } } } }
  const xml = `<svg ${Object.entries(raw.document.rootAttributes).map(([key, value]) => `${key}="${value}"`).join(' ')}><g><g><g transform="${nodeTransform}"><path d="${singularCylinderWarningPath}" fill="#B45309"><title>${singularCylinderWarning}</title></path><g transform="translate(0 0)"><title/><g transform="translate(0 0)" opacity="1" fill="#203040" color="#203040" pointer-events="none"><g/></g></g></g></g></g></svg>`
  raw.xml = xml
  const native = { scenario: singularCylinderScenario, group, result: 'observed', case: evidence.cases.find(({ ambientDimension: dimension }) => dimension === ambientDimension) }
  writeFileSync(svgPath, xml); writeFileSync(pngPath, png); writeFileSync(join(directory, `${stem}-native.json`), JSON.stringify(native))
  writeFileSync(join(directory, `${stem}-saved.json`), download.savedJson)
  for (const [mode, source] of Object.entries(download.outputs)) writeFileSync(join(directory, `${stem}-${mode}.tex`), source)
  return { evidence, download, raw, native, png, svgPath, pngPath }
}
