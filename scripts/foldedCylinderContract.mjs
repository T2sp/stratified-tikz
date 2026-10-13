import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readEvidenceDocumentSync } from './evidencePublication.mjs'
import { parseSignedPointSvg, signedPointStandaloneRootAttributes } from './signedPointStandaloneAssociation.mjs'
import { assertStandaloneReopeningRecord, validateStandaloneSvgCaptureEvidence } from './standaloneSvgCaptureContract.mjs'
import { assertGeometricSelectionEvidence } from './pointGeometricShapesContract.mjs'
import { decodeConnectedPaintPng } from './connectedLivePaintOracle.mjs'
import { generateTikzForUi } from '../src/ui/tikzExportMode.ts'
import { resolveSvgCamera } from '../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../src/rendering/coordinateAxesGuide.ts'
import { cameraOrientationForPreview, cameraViewAdjustmentFromControls } from '../src/ui/cameraControls.ts'

export const foldedCylinderScenario = 'point-layout-cylinder-folded-anchors'
export const foldedCylinderOwner = 'folded-cylinder'
export const foldedCylinderReferenceFile = 'tests/fixtures/point-node-anchors/cylinder-fitting-scanning/references.json'
export const foldedCylinderLayout = Object.freeze({ innerXSep: -30, innerYSep: 5, outerXSep: 0, outerYSep: 0,
  minimumWidth: 1, minimumHeight: 1, anchor: 'bottom', units: Object.fromEntries([
    ['innerXSep', '-30pt', -30], ['innerYSep', '5pt', 5], ['outerXSep', '0pt', 0], ['outerYSep', '0pt', 0],
    ['minimumWidth', '1pt', 1], ['minimumHeight', '1pt', 1],
  ].map(([key, source, texPoints]) => [key, { source, unit: 'pt', texPoints }])), fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export function foldedCylinderReference() {
  const bytes = readFileSync(new URL(`../${foldedCylinderReferenceFile}`, import.meta.url)), reference = JSON.parse(bytes)
  assert.equal(reference.schema, 'stz-pgf-cylinder-fitting-scanning-v1')
  const control = reference.controls.find(({ id }) => id === 'folded')
  assert.ok(control)
  assert.deepEqual(reference.namedAnchors, ['center', 'text', 'base', 'mid', 'east', 'north east', 'north', 'north west',
    'west', 'south west', 'south', 'south east', 'base east', 'base west', 'mid east', 'mid west', 'shape center',
    'before top', 'top', 'after top', 'before bottom', 'bottom', 'after bottom'])
  assert.deepEqual(reference.numericAnchors, ['0', '37', '45', '90', '135', '180', '225', '270', '315', '450', '90.8', '+45.7', '-90.8', '-0.5'])
  assert.deepEqual(control.anchors, [...reference.namedAnchors, ...reference.numericAnchors])
  assert.deepEqual(Object.keys(control.expectedAnchors).sort(), [...control.anchors].sort())
  return { file: foldedCylinderReferenceFile, sha256: hash(bytes), pgfVersion: reference.pgfVersion,
    anchors: control.anchors, expectedAnchors: control.expectedAnchors }
}
function pointState(state, anchor) {
  const diagram = JSON.parse(state.runtimeDiagramJson), saved = JSON.parse(state.json), history = JSON.parse(state.history)
  assert.equal(saved.version, 2); assert.deepEqual(saved.diagram.strata, diagram.strata); assert.deepEqual(history.present, diagram)
  assert.equal(diagram.strata.length, 1); assert.deepEqual(diagram.labels, [])
  assert.ok([2, 3].includes(diagram.ambientDimension)); assert.ok(Number.isInteger(state.labelDocumentRevision) && state.labelDocumentRevision >= 0)
  const point = diagram.strata[0]
  assert.equal(point.id, foldedCylinderOwner); assert.equal(point.codim, diagram.ambientDimension); assert.equal(point.geometricKind, 'point')
  assert.equal(point.text, ''); assert.equal(point.layer, 0); assert.equal(point.style.shape, 'cylinder')
  assert.deepEqual(point.style.shapeParameters, { aspect: 1 })
  assert.deepEqual(point.position, { x: 3, y: 3, z: diagram.ambientDimension === 3 ? .5 : 0 })
  assert.deepEqual(point.style.layout, { ...foldedCylinderLayout, anchor })
  assert.equal(point.style.paint.stroke.width, .4)
  return { point, diagram }
}
const keys = ['a', 'b', 'c', 'd', 'e', 'f']
function matrix(value) { assert.ok(value && keys.every(key => Number.isFinite(value[key]))); assert.ok(Math.abs(value.a * value.d - value.b * value.c) > 1e-12) }
function closePoint(actual, expected, tolerance = .025 * 1.2) {
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) <= tolerance, 'Native cylinder anchor matches independent PGF coordinates')
}
export function assertFoldedCylinderPlacement(entry, reference = foldedCylinderReference()) {
  const { point, diagram } = pointState(entry.state, entry.anchor), observed = entry.rendered
  assert.equal(entry.ambientDimension, diagram.ambientDimension); assert.equal(observed.source, '')
  assert.equal(observed.state, 'ready'); assert.equal(observed.shape, 'cylinder'); assert.equal(observed.anchor, entry.anchor)
  assert.deepEqual(JSON.parse(observed.pointOwner), ['point-node', entry.state.labelDocumentRevision, point.id])
  assert.equal(observed.pointRequest, observed.bodyRequest)
  const request = JSON.parse(observed.pointRequest)
  assert.equal(request.length, 9); assert.equal(request[0], ''); assert.equal(request[8], observed.pointOwner)
  assert.ok(typeof request[1] === 'string' && request[1].length > 0 && Number.isFinite(request[2]) && request[2] > 0)
  assert.ok(Number.isInteger(request[5]) && request[5] >= 0)
  const expected = reference.expectedAnchors[entry.anchor]
  assert.ok(expected); closePoint(observed.anchorOffset, { x: expected.x * 1.2, y: expected.y * 1.2 })
  closePoint(observed.placementOffset, { x: -observed.anchorOffset.x, y: -observed.anchorOffset.y }, 1e-4)
  closePoint(observed.placedAnchor, observed.placement, 1e-4)
  // PGF's empty box origin is (0,0) in the unplaced construction frame.
  // DOM body origins/baselines already include the selected anchor placement.
  closePoint(observed.bodyOrigin, observed.placementOffset, .001)
  assert.ok(Math.abs(observed.baseline - observed.placementOffset.y) < .001,
    'Empty DOM baseline belongs to the placed body frame')
  for (const [key, value] of Object.entries({ x: .72, y: -6, width: 10.8, height: 12 })) assert.ok(Math.abs(observed.bounds[key] - value) < .03 * 1.2)
  assert.equal(observed.contour.tag, 'path'); assert.equal(observed.seams.length, 1)
  assert.equal(observed.warningCount, 0); assert.equal(observed.paintRegionCount, 0)
  matrix(observed.screenCTM); matrix(observed.inkMatrix)
  const ui = JSON.parse(entry.state.uiSettings)
  const projection = resolveSvgCamera(diagram, 520, 360, { fitToView: true, extraPointsForFit: createCoordinateAxesGuide(diagram.ambientDimension).fitPoints,
    ...(ui.camera3d ? { cameraOverride: cameraOrientationForPreview(ui.camera3d), viewAdjustment: cameraViewAdjustmentFromControls(ui.camera3d) } : {}) })
  const projected = projectToSvgPoint(projection, point.position, 360)
  assert.equal(observed.nodeTransform, `translate(${projected.x} ${projected.y})`)
  const layout = { ...point.style.layout }; delete layout.units
  assert.deepEqual(observed.layout, layout)
}
function paintWithoutPlacement(value) { const result = structuredClone(value); delete result.attributes.transform; return result }
export function assertFoldedCylinderEvidence(evidence) {
  assert.equal(evidence.scenario, foldedCylinderScenario); assert.equal(evidence.group, 'point-node-layout-anchors-combined')
  assert.equal(evidence.result, 'passed'); assert.deepEqual(evidence.pageErrors, [])
  const reference = foldedCylinderReference(); assert.deepEqual(evidence.reference, reference)
  assert.equal(evidence.cases.length, 2); assert.equal(evidence.downloads.length, 2)
  for (const dimension of [2, 3]) {
    const cases = evidence.cases.filter(entry => entry.ambientDimension === dimension); assert.equal(cases.length, 1)
    const entry = cases[0]
    assert.deepEqual(entry.anchors.map(item => item.anchor), reference.anchors)
    const first = entry.anchors[0]
    for (const [index, item] of entry.anchors.entries()) {
      assertFoldedCylinderPlacement(item, reference)
      assert.deepEqual(paintWithoutPlacement(item.rendered.contour), paintWithoutPlacement(first.rendered.contour), 'Anchor edits preserve painted outline')
      assert.deepEqual(item.rendered.seams.map(paintWithoutPlacement), first.rendered.seams.map(paintWithoutPlacement), 'Anchor edits preserve painted seam')
      if (index > 0) {
        const previous = entry.anchors[index - 1], oldModel = JSON.parse(previous.state.runtimeDiagramJson)
        oldModel.strata[0].style.layout.anchor = item.anchor
        assert.deepEqual(JSON.parse(item.state.runtimeDiagramJson), oldModel)
        assert.equal(item.state.labelDocumentRevision, previous.state.labelDocumentRevision)
        assert.equal(item.rendered.pointOwner, previous.rendered.pointOwner); assert.equal(item.rendered.pointRequest, previous.rendered.pointRequest)
      }
      assert.equal(item.field.key, 'anchor'); assert.equal(item.field.modelValue, item.anchor); assert.equal(item.field.value, item.anchor)
      assert.equal(item.field.requestsUnchanged, true); assert.ok(item.field.events.length > 0)
      assert.ok(item.field.events.every(event => event.type === 'input' && event.trusted && event.value === item.anchor))
    }
    assertFoldedCylinderPlacement(entry.final, reference); assert.equal(entry.final.anchor, 'bottom')
    assertGeometricSelectionEvidence(entry.final.rendered.nativeSelection, foldedCylinderOwner)
    const native = entry.final.rendered.nativeSelection
    assert.equal(native.scenario, foldedCylinderScenario)
    assert.deepEqual(entry.final.rendered.boundary, native.requestedClick)
    for (const key of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings', 'requests']) assert.deepEqual(native.stateAfter[key], entry.final.state[key])
    for (const snapshot of [native.before, native.after]) {
      assert.equal(snapshot.layout.owner, entry.final.rendered.pointOwner); assert.equal(snapshot.layout.request, entry.final.rendered.pointRequest)
      assert.equal(snapshot.layout.bodyRequest, entry.final.rendered.pointRequest)
      assert.deepEqual(snapshot.geometry.contour.screenCTM, entry.final.rendered.screenCTM)
    }
    const download = evidence.downloads.find(item => item.ambientDimension === dimension)
    assert.ok(download); assertFoldedCylinderDownload(download)
    assert.deepEqual(download.expected[0].modelPoint, pointState(entry.final.state, 'bottom').point)
    assert.equal(download.beforeExportState.labelDocumentRevision, entry.final.state.labelDocumentRevision + 1)
  }
}
export function assertFoldedCylinderDownload(input) {
  assert.equal(input.scenario, `${foldedCylinderScenario}-${input.ambientDimension}d`)
  assert.equal(input.background, 'transparent'); assert.equal(input.expected.length, 1)
  const expected = input.expected[0], state = input.beforeExportState, { point, diagram } = pointState(state, 'bottom')
  assert.deepEqual(expected.modelPoint, point); assert.equal(expected.id, point.id); assert.equal(expected.source, '')
  assertFoldedCylinderPlacement({ ambientDimension: input.ambientDimension, anchor: 'bottom', state, rendered: expected.rendered })
  assert.equal(input.savedJson, state.json)
  assert.equal(input.click.error, undefined)
  const snapshot = input.click.snapshot
  assert.equal(snapshot.documentUnchanged, true); assert.equal(snapshot.runtime.documentRevision, state.labelDocumentRevision)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'uiSettings']) assert.deepEqual(snapshot[field], state[field])
  assert.equal(snapshot.points.length, 1)
  const captured = snapshot.points[0]
  assert.equal(captured.id, point.id); assert.equal(captured.source, ''); assert.equal(captured.modelSource, '')
  assert.equal(captured.status, 'ready'); assert.equal(captured.held, null); assert.deepEqual(captured.style, point.style); assert.deepEqual(captured.position, point.position)
  assert.deepEqual(captured.runtime, snapshot.runtime); assert.equal(captured.request, expected.rendered.pointRequest)
  assert.equal(captured.pointRequest, captured.request); assert.equal(captured.owner, expected.rendered.pointOwner)
  assert.deepEqual(JSON.parse(captured.layout), expected.rendered.layout); assert.equal(captured.nodeTransform, expected.rendered.nodeTransform)
  assert.equal(input.preExport.rootCount, 1); assert.equal(input.preExport.rootConnected, true)
  assert.equal(new URL(input.preExport.url).pathname, '/stratified-tikz/scripts/fixtures/freeLabelsApp.html')
  assert.equal(input.preExport.labelDocumentRevision, state.labelDocumentRevision); assert.deepEqual(input.preExport.runtime, snapshot.runtime)
  assert.equal(input.preExport.points.length, 1)
  const native = input.preExport.points[0]
  assert.equal(native.id, point.id); assert.equal(native.source, ''); assert.equal(native.bodySource, '')
  assert.equal(native.owner, captured.owner); assert.equal(native.request, captured.request); assert.equal(native.bodyRequest, captured.request)
  assert.equal(native.nodeTransform, expected.rendered.nodeTransform); assert.equal(native.bodyTransform, expected.rendered.bodyTransform)
  assert.equal(JSON.parse(captured.request)[5], snapshot.runtime.fontGeneration)
  for (const mode of ['standalone', 'inlineMath']) assert.equal(input.outputs[mode], generateTikzForUi(diagram, { ...JSON.parse(state.uiSettings), exportMode: mode }))
}
export function observeFoldedCylinderReopening() {
  const root = document.documentElement, matrix = value => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map(key => [key, value[key]]))
  const clean = element => ({ tag: element.localName, attributes: Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value])) })
  const path = element => { const result = []; for (let current = element; current && current !== root; current = current.parentElement) result.unshift([...current.parentElement.children].indexOf(current)); return result }
  const reopened = [...root.querySelectorAll('g > title')].map((title, domOrdinal) => {
    const body = title.parentElement, node = body.parentElement, paths = [...node.children].filter(element => element.localName === 'path')
    return { domOrdinal, source: title.textContent, nodeTransform: node.getAttribute('transform'), bodyTransform: body.getAttribute('transform'),
      paths: { node: path(node), body: path(body), title: path(title), outline: path(paths[0]), seam: path(paths[1]) }, paint: paths.map(clean),
      matrices: { nodeCTM: matrix(node.getCTM()), nodeScreenCTM: matrix(node.getScreenCTM()), bodyCTM: matrix(body.getCTM()), bodyScreenCTM: matrix(body.getScreenCTM()),
        outlineCTM: matrix(paths[0]?.getCTM()), outlineScreenCTM: matrix(paths[0]?.getScreenCTM()), seamCTM: matrix(paths[1]?.getCTM()), seamScreenCTM: matrix(paths[1]?.getScreenCTM()) } }
  })
  const bounds = root.getBoundingClientRect()
  return { reopened, document: { root: { localName: root.localName, namespace: root.namespaceURI, width: root.getAttribute('width'), height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox') },
    rootAttributes: Object.fromEntries([...root.attributes].map(({ name, value }) => [name, value])), forbiddenCount: root.querySelectorAll('parsererror,foreignObject,image,script,[data-svg-export-exclude]').length,
    externalReferences: [...root.querySelectorAll('[href]')].map(element => element.getAttribute('href')).filter(href => !href.startsWith('#') || !document.getElementById(href.slice(1))),
    backgroundCount: root.querySelectorAll('[data-stratified-tikz-export-background]').length,
    frame: { url: location.href, contentType: document.contentType, readyState: document.readyState, rootCTM: matrix(root.getCTM()), rootScreenCTM: matrix(root.getScreenCTM()),
      rootBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, scroll: { x: scrollX, y: scrollY }, viewport: { width: innerWidth, height: innerHeight } } } }
}
function translated(base, text) {
  const found = /^translate\(([^\s,)]+)[\s,]+([^\s,)]+)\)$/u.exec(text ?? 'translate(0 0)')
  assert.ok(found)
  const x = Math.fround(Number(found[1])), y = Math.fround(Number(found[2]))
  return { ...base, e: base.a * x + base.c * y + base.e, f: base.b * x + base.d * y + base.f }
}
export function assertFoldedCylinderSvg(input, xml) {
  assertFoldedCylinderDownload(input)
  const { root, titles } = parseSignedPointSvg(xml), actual = input.reopened[0], observed = input.expected[0].rendered
  assert.equal(input.reopened.length, 1); assert.equal(actual.domOrdinal, 0); assert.equal(actual.source, '')
  assert.equal(Object.hasOwn(actual, 'id'), false); assert.equal(Object.hasOwn(actual, 'shape'), false)
  assert.deepEqual(root.attributes, signedPointStandaloneRootAttributes); assert.deepEqual(input.document.rootAttributes, root.attributes)
  assert.equal(input.document.forbiddenCount, 0); assert.deepEqual(input.document.externalReferences, []); assert.equal(input.document.backgroundCount, 0)
  const frame = input.document.frame, identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  assert.equal(frame.url, input.fileUrl); assert.equal(frame.contentType, 'image/svg+xml'); assert.equal(frame.readyState, 'complete')
  assert.deepEqual(frame.scroll, { x: 0, y: 0 }); assert.deepEqual(frame.rootCTM, identity); assert.deepEqual(frame.rootScreenCTM, identity)
  assert.deepEqual(input.document.root, { localName: 'svg', namespace: root.attributes.xmlns, width: root.attributes.width, height: root.attributes.height, viewBox: root.attributes.viewBox })
  assert.deepEqual(frame.rootBounds, { x: 0, y: 0, width: 520, height: 360 })
  if (input.capture !== undefined) assert.deepEqual(frame.viewport, input.capture.measurements[0].viewport)
  assert.equal(root.children.length, 1); assert.deepEqual(root.children[0].attributes, {}); assert.equal(root.children[0].children.length, 1)
  const wrapper = root.children[0].children[0], node = wrapper.children[0], body = node.children[2]
  assert.equal(wrapper.tag, 'g'); assert.deepEqual(wrapper.attributes, {}); assert.equal(wrapper.children.length, 1)
  assert.equal(node.tag, 'g'); assert.deepEqual(node.attributes, { transform: observed.nodeTransform }); assert.deepEqual(node.children.map(item => item.tag), ['path', 'path', 'g'])
  const strip = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'pointer-events'))
  for (const [index, paint] of [observed.contour, ...observed.seams].entries()) {
    assert.deepEqual({ tag: node.children[index].tag, attributes: strip(node.children[index].attributes) }, paint)
    assert.deepEqual(node.children[index].children, []); assert.equal(node.children[index].text, '')
    assert.deepEqual(strip(actual.paint[index].attributes), paint.attributes)
  }
  assert.equal(body.tag, 'g'); assert.deepEqual(body.attributes, { transform: observed.bodyTransform }); assert.deepEqual(body.children.map(item => item.tag), ['title', 'g'])
  assert.equal(titles.length, 1); assert.equal(titles[0], body.children[0]); assert.equal(titles[0].text, ''); assert.deepEqual(titles[0].attributes, {}); assert.deepEqual(titles[0].children, [])
  const ink = body.children[1], content = ink.children[0], style = input.expected[0].modelPoint.style
  assert.equal(ink.tag, 'g'); assert.equal(ink.children.length, 1); assert.deepEqual(ink.attributes, { transform: 'translate(0 0)', opacity: String(style.opacity * style.paint.text.opacity),
    fill: style.paint.text.color, color: style.paint.text.color, 'pointer-events': 'none' })
  assert.equal(content.tag, 'g'); assert.deepEqual(content.attributes, {}); assert.deepEqual(content.children, []); assert.equal(content.text, '')
  const all = [], visit = element => { all.push(element); for (const child of element.children) visit(child) }; visit(root)
  assert.ok(all.every(element => element.text === '' && ['svg', 'g', 'path', 'title'].includes(element.tag)
    && Object.keys(element.attributes).every(key => !key.startsWith('data-') && !key.startsWith('aria-'))))
  assert.deepEqual(actual.paths, { node: node.path, body: body.path, title: titles[0].path, outline: node.children[0].path, seam: node.children[1].path })
  assert.equal(actual.nodeTransform, observed.nodeTransform); assert.equal(actual.bodyTransform, observed.bodyTransform)
  for (const suffix of ['CTM', 'ScreenCTM']) {
    const rootMatrix = input.document.frame[`root${suffix}`], outer = translated(rootMatrix, observed.nodeTransform)
    for (const [kind, local] of [['node', outer], ['body', translated(outer, observed.bodyTransform)], ['outline', translated(outer, observed.contour.attributes.transform)], ['seam', translated(outer, observed.seams[0].attributes.transform)]]) {
      const value = actual.matrices[`${kind}${suffix}`]; matrix(value); matrix(local)
      for (const key of keys) assert.ok(Math.abs(value[key] - local[key]) <= 1e-7, 'Reopened cylinder matrix belongs to exact file-local placement')
    }
  }
  return { schema: 'stz-folded-cylinder-artifact-v1', scenario: input.scenario, ambientDimension: input.ambientDimension,
    svgSha256: hash(Buffer.from(xml)), source: '', owner: input.click.snapshot.points[0].owner, request: input.click.snapshot.points[0].request,
    revision: input.beforeExportState.labelDocumentRevision, svgPath: input.svgPath }
}
export function observeFoldedCylinderPixels(bytes, ctm) {
  matrix(ctm)
  const { width, height, rgba } = decodeConnectedPaintPng(bytes), determinant = ctm.a * ctm.d - ctm.b * ctm.c
  let pixels = 0, seamPixels = 0, forbiddenWarningPixels = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b, alpha] = rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)
    if (!alpha) continue
    if (r > g + 35 && g > b + 35) forbiddenWarningPixels++
    if (!(b >= r && b >= g && r < 240)) continue
    const dx = x + .5 - ctm.e, dy = y + .5 - ctm.f, local = { x: (ctm.d * dx - ctm.c * dy) / determinant, y: (-ctm.b * dx + ctm.a * dy) / determinant }
    assert.ok(local.x >= -7 && local.x <= 12 && local.y >= -7 && local.y <= 7, 'All folded-cylinder paint belongs to the current placed contour')
    pixels++; if (local.x < -2 && Math.abs(local.y) < 5) seamPixels++
  }
  return { method: 'actual-native-PNG-folded-cylinder-pixel-centers', sha256: hash(bytes), bytes: bytes.length, width, height, ctm: { ...ctm }, pixels, seamPixels, forbiddenWarningPixels }
}
export function assertFoldedCylinderPixels(value) {
  assert.equal(value.method, 'actual-native-PNG-folded-cylinder-pixel-centers'); assert.ok(value.pixels > 0); assert.ok(value.seamPixels > 0); assert.equal(value.forbiddenWarningPixels, 0)
}
export function assertFoldedCylinderStandaloneEvidence(evidence, raw, artifactDir, ambientDimension, { checkout } = {}) {
  assertFoldedCylinderEvidence(evidence)
  const download = evidence.downloads.find(item => item.ambientDimension === ambientDimension), xml = assertStandaloneReopeningRecord(raw, download, artifactDir)
  assert.equal(raw.xml, xml)
  for (const key of ['savedJson', 'outputs', 'beforeExportState', 'preExport', 'capture']) assert.deepEqual(raw[key], download[key])
  const stem = download.scenario, native = readEvidenceDocumentSync(artifactDir, `${stem}-native.json`, { checkout })
  assert.equal(native.scenario, foldedCylinderScenario); assert.equal(native.group, evidence.group); assert.equal(native.result, 'observed')
  assert.deepEqual(native.case, evidence.cases.find(item => item.ambientDimension === ambientDimension)); assert.deepEqual(native.reference, evidence.reference)
  assert.equal(readFileSync(resolve(artifactDir, `${stem}-saved.json`), 'utf8'), raw.savedJson)
  for (const mode of ['standalone', 'inlineMath']) assert.equal(readFileSync(resolve(artifactDir, `${stem}-${mode}.tex`), 'utf8'), raw.outputs[mode])
  const context = assertFoldedCylinderSvg(raw, xml)
  validateStandaloneSvgCaptureEvidence(raw.capture, { svgPath: raw.svgPath, pngPath: resolve(artifactDir, `${stem}.png`), root: raw.document.root })
  const pixels = observeFoldedCylinderPixels(readFileSync(resolve(artifactDir, `${stem}.png`)), raw.reopened[0].matrices.outlineScreenCTM)
  assert.deepEqual(raw.paintPixels, pixels); assert.deepEqual(download.paintPixels, pixels); assertFoldedCylinderPixels(pixels)
  assert.deepEqual(raw.document.frame.rootBounds, raw.capture.measurements[0].root.bounds)
  assert.equal(raw.document.frame.url, raw.capture.measurements[0].url)
  return { ...context, pngSha256: pixels.sha256 }
}
