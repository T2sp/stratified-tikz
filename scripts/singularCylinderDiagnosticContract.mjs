import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { parseSignedPointSvg, signedPointStandaloneRootAttributes } from './signedPointStandaloneAssociation.mjs'
import { assertStandaloneReopeningRecord, validateStandaloneSvgCaptureEvidence } from './standaloneSvgCaptureContract.mjs'
import { generateTikzForUi } from '../src/ui/tikzExportMode.ts'
import { resolveSvgCamera } from '../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../src/rendering/svgProjection.ts'
import { createCoordinateAxesGuide } from '../src/rendering/coordinateAxesGuide.ts'
import { cameraOrientationForPreview, cameraViewAdjustmentFromControls } from '../src/ui/cameraControls.ts'
import { decodeConnectedPaintPng } from './connectedLivePaintOracle.mjs'
import { readEvidenceDocumentSync } from './evidencePublication.mjs'

export const singularCylinderScenario = 'point-layout-singular-cylinder-diagnostic'
export const singularCylinderOwner = 'singular-cylinder'
export const singularCylinderLimitation = 'Cylinder effective transverse radius is zero; PGF’s fitting division is undefined.'
export const singularCylinderWarning = `Shape preview unavailable: ${singularCylinderLimitation}`
export const singularCylinderLayout = Object.freeze({ innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0,
  minimumWidth: 0, minimumHeight: 0, anchor: 'center',
  units: Object.fromEntries(['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
    .map((key) => [key, { source: '0pt', unit: 'pt', texPoints: 0 }])),
  fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } })
export const subspCylinderScenario = 'point-layout-cylinder-subsp-diagnostic'
export const subspCylinderLayout = Object.freeze({ ...structuredClone(singularCylinderLayout), innerYSep: .000001, minimumHeight: 80,
  units: { ...structuredClone(singularCylinderLayout.units), innerYSep: { source: '0.000001pt', unit: 'pt', texPoints: .000001 },
    minimumHeight: { source: '80pt', unit: 'pt', texPoints: 80 } } })
export const cylinderDiagnosticScenarios = [singularCylinderScenario, subspCylinderScenario]
export function cylinderDiagnosticLayout(scenario) {
  assert.ok(cylinderDiagnosticScenarios.includes(scenario), 'A registered cylinder diagnostic scenario is required')
  return scenario === subspCylinderScenario ? subspCylinderLayout : singularCylinderLayout
}
function diagnosticScenarioFromLayout(layout) {
  const zeroMinimum = { ...structuredClone(layout), minimumWidth: 0,
    units: { ...structuredClone(layout.units), minimumWidth: { source: '0pt', unit: 'pt', texPoints: 0 } } }
  const matches = cylinderDiagnosticScenarios.filter(scenario => isDeepStrictEqual(zeroMinimum, cylinderDiagnosticLayout(scenario)))
  assert.equal(matches.length, 1, 'Raw authored dimensions belong to one registered cylinder diagnostic')
  return matches[0]
}
export const singularCylinderParameters = Object.freeze({ aspect: .55, cylinderUsesCustomFill: true,
  cylinderBodyFill: '#00FF00', cylinderEndFill: '#FF00FF' })
export const singularCylinderWarningPath = 'M -8 -2 h 2 v 7 h -2 Z M -8 8 h 2 v 2 h -2 Z'
const zeroBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
const matrixKeys = ['a', 'b', 'c', 'd', 'e', 'f']
const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const at = (root, path) => path.reduce((element, ordinal) => element?.children[ordinal], root)
function matrix(value) {
  assert.ok(value && matrixKeys.every((key) => Number.isFinite(value[key])))
  assert.ok(Math.abs(value.a * value.d - value.b * value.c) > 1e-12)
}
function transform(value, point) { return { x: value.a * point.x + value.c * point.y + value.e,
  y: value.b * point.x + value.d * point.y + value.f } }
function translation(text) {
  const found = /^translate\(([^\s,)]+)[\s,]+([^\s,)]+)\)$/u.exec(text ?? '')
  assert.ok(found); const result = { ...identity, e: Math.fround(Number(found[1])), f: Math.fround(Number(found[2])) }
  matrix(result); return result
}
function multiply(left, right) {
  return { a: left.a * right.a + left.c * right.b, b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d, d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e, f: left.b * right.e + left.d * right.f + left.f }
}
function closeMatrix(actual, expected) {
  matrix(actual); matrix(expected)
  for (const key of matrixKeys) assert.ok(Math.abs(actual[key] - expected[key]) <= 1e-7, `Current ${key} belongs to the diagnostic file placement`)
}
function pointFromState(state) {
  assert.ok(Number.isInteger(state.labelDocumentRevision) && state.labelDocumentRevision >= 0)
  const saved = JSON.parse(state.json), diagram = JSON.parse(state.runtimeDiagramJson), history = JSON.parse(state.history)
  assert.equal(saved.version, 2); assert.deepEqual(saved.diagram.strata, diagram.strata); assert.deepEqual(history.present, diagram)
  assert.equal(diagram.strata.length, 1); assert.deepEqual(diagram.labels, [])
  assert.ok([2, 3].includes(diagram.ambientDimension))
  const point = diagram.strata[0]
  assert.equal(point.id, singularCylinderOwner); assert.equal(point.geometricKind, 'point'); assert.equal(point.codim, diagram.ambientDimension)
  assert.equal(point.text, ''); assert.equal(point.style.shape, 'cylinder'); assert.equal(point.layer, 0)
  assert.deepEqual(point.position, { x: 3, y: 3, z: diagram.ambientDimension === 3 ? .5 : 0 })
  assert.deepEqual(point.style.shapeParameters, singularCylinderParameters)
  diagnosticScenarioFromLayout(point.style.layout)
  return { point, diagram }
}
function assertCurrentOwner(observed, state) {
  const { point } = pointFromState(state)
  assert.equal(observed.id, point.id); assert.equal(observed.source, ''); assert.equal(observed.bodySource, '')
  assert.equal(observed.shape, 'cylinder'); assert.equal(observed.state, 'ready')
  assert.deepEqual(JSON.parse(observed.owner), ['point-node', state.labelDocumentRevision, point.id])
  assert.equal(observed.request, observed.bodyRequest)
  const request = JSON.parse(observed.request)
  assert.equal(request.length, 9); assert.equal(request[0], ''); assert.equal(request[8], observed.owner)
  assert.ok(typeof request[1] === 'string' && request[1].length > 0); assert.ok(Number.isFinite(request[2]) && request[2] > 0)
  assert.ok(typeof request[3] === 'string' && typeof request[4] === 'string')
  assert.ok(Number.isInteger(request[5]) && request[5] >= 0)
  assert.ok(Number.isFinite(request[6]) && request[6] > 0 && Number.isFinite(request[7]) && request[7] >= 0)
  for (const value of Object.values(observed.matrices)) matrix(value)
  return point
}
export function assertSingularCylinderObservation(observed, state, { singular = true } = {}) {
  const point = assertCurrentOwner(observed, state)
  assert.deepEqual(observed.resolvedLayout, Object.fromEntries(Object.entries(point.style.layout)
    .filter(([key]) => !['units', 'source', 'unsupportedOptions', 'unsupportedDeclarations', 'warnings', 'importedDeclarations'].includes(key))))
  assert.equal(observed.contourCount, singular ? 0 : 1); assert.equal(observed.warningCount, singular ? 1 : 0)
  assert.equal(observed.internalBorderCount, singular ? 0 : 1); assert.equal(observed.paintRegionCount, singular ? 0 : 2)
  assert.equal(observed.bodyTargetCount, 0); assert.equal(observed.glyphCount, 0)
  assert.equal(observed.bodyTransform, 'translate(0 0)'); assert.deepEqual(observed.bodyChildTags, ['title', 'g'])
  assert.deepEqual(observed.inkChildTags, ['g']); assert.deepEqual(observed.contentChildTags, [])
  assert.equal(observed.bodyTitle, ''); assert.equal(observed.bodyTitleCount, 1)
  if (singular) {
    assert.deepEqual(point.style.layout, cylinderDiagnosticLayout(diagnosticScenarioFromLayout(point.style.layout)))
    assert.equal(observed.limitation, singularCylinderLimitation)
    assert.equal(observed.warningTitle, singularCylinderWarning)
    assert.deepEqual(observed.warning, { tag: 'path', attributes: { d: singularCylinderWarningPath, fill: '#B45309' } })
    assert.deepEqual(observed.paintedBounds, zeroBounds)
    assert.ok(observed.ring === null || (Number.isFinite(observed.ring.r) && observed.ring.r <= 20), 'Selection remains bounded by the visible warning')
  } else { assert.equal(observed.limitation, null); assert.equal(observed.warning, null) }
}
function unchanged(before, after, selection = false) {
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'requests', 'uiSettings', ...(selection ? ['selection'] : [])]) {
    assert.deepEqual(after[field], before[field], `Native diagnostic preserves ${field}`)
  }
}
export function assertSingularCylinderNative(entry) {
  assert.equal(entry.result, 'passed'); assert.deepEqual(entry.secondaryErrors, []); assert.equal(entry.error, undefined)
  assert.equal(entry.ambientDimension, pointFromState(entry.before).diagram.ambientDimension)
  assert.deepEqual(entry.clicks.map(({ kind }) => kind), ['far', 'warning', 'far'])
  unchanged(entry.before, entry.after)
  assert.equal(entry.after.selection, null)
  assert.equal(entry.preparation.selectPressed, 'true')
  assert.deepEqual(entry.cleanup, { observerPresentBefore: true, observerAbsentAfter: true })
  for (const action of entry.preparation.actions) {
    assert.equal(action.controlCount, 1); unchanged(action.before, action.after, true)
  }
  let previous = entry.preparation.after
  for (const action of entry.clicks) {
    assert.deepEqual(action.before, previous); unchanged(action.before, action.after)
    assert.deepEqual(action.inputObservation, action.observation)
    assert.deepEqual(action.inputState, action.before)
    assert.deepEqual(action.inputHit, { screen: action.screen, hit: action.hit })
    assertSingularCylinderObservation(action.observation, action.before)
    assertSingularCylinderObservation(action.afterObservation, action.after)
    for (const key of ['owner', 'request', 'bodyRequest', 'nodeTransform', 'bodyTransform', 'warning', 'matrices']) assert.deepEqual(action.afterObservation[key], action.observation[key])
    const point = action.observation, local = action.kind === 'warning' ? { x: -7, y: 1 } : { x: 100, y: 0 }
    assert.deepEqual(action.local, local); assert.deepEqual(action.screen, transform(point.matrices.nodeScreenCTM, local))
    const hit = action.hit.target
    assert.ok(hit?.connected && hit.canvas && !hit.overlay && !hit.handle); assert.equal(hit.canvasToken, entry.token)
    if (action.kind === 'warning') {
      assert.equal(hit.warning, true); assert.equal(hit.pointId, singularCylinderOwner); assert.equal(hit.ownerToken, point.owner)
      assert.equal(hit.pointRequest, point.request); assert.equal(hit.bodyRequest, point.request); assert.equal(hit.source, '')
    } else { assert.equal(hit.pointId, null); assert.ok(hit.canvasRoot || hit.background) }
    assert.deepEqual(action.hit.stack[0], hit)
    assert.equal(action.events.errors.length, 0); assert.equal(action.events.droppedEvents, 0); assert.equal(action.events.canvasCaptureAfterInput, false)
    assert.deepEqual(action.events.events.map(({ type }) => type), ['pointerdown', 'pointerup', 'click'])
    let pointer, previousOrder = -1
    for (const event of action.events.events) {
      assert.ok(Number.isInteger(event.order) && event.order > previousOrder); previousOrder = event.order
      assert.deepEqual(event.identity, { id: singularCylinderOwner, ambientDimension: entry.ambientDimension, shape: 'cylinder',
        epoch: action.before.labelDocumentRevision, ownerToken: point.owner, pointRequest: point.request, bodyRequest: point.request,
        source: '', anchor: 'center', canvasToken: entry.token })
      assert.ok(event.target?.connected && event.target.canvas && !event.target.overlay && !event.target.handle)
      assert.equal(event.target.canvasToken, entry.token)
      assert.equal(event.trusted, true); assert.equal(event.epoch, action.before.labelDocumentRevision)
      assert.equal(event.button, 0); assert.equal(event.buttons, event.type === 'pointerdown' ? 1 : 0)
      assert.equal(event.altKey, false); assert.equal(event.ctrlKey, false); assert.equal(event.metaKey, false); assert.equal(event.shiftKey, false)
      assert.ok(Math.abs(event.x - action.screen.x) < 1 && Math.abs(event.y - action.screen.y) < 1)
      assert.equal(typeof event.canvasHasPointerCapture, 'boolean')
      if (event.type === 'pointerdown') { pointer = event.pointerId; assert.ok(Number.isInteger(pointer)); assert.equal(event.canvasHasPointerCapture, false) }
      if (event.type === 'click') assert.equal(event.canvasHasPointerCapture, false)
      else if (event.type !== 'click' || event.pointerId !== null) assert.equal(event.pointerId, pointer)
      const capturedRoot = event.target?.canvasRoot === true && event.target?.canvasToken === entry.token
      if (event.type === 'pointerdown') assert.deepEqual(event.target, hit)
      else if (capturedRoot && hit.canvasRoot !== true) {
        assert.equal(action.kind, 'far', 'Only canvas background gestures have captured root continuation')
        assert.equal(action.events.events[1].canvasHasPointerCapture, true, 'Root continuation follows current owned pointer capture')
        assert.equal(action.events.events[1].pointerId, pointer)
      } else assert.deepEqual(event.target, hit)
      assert.deepEqual(event.path[0], event.target)
      assert.ok(event.path.some((item) => item?.canvasRoot && item.canvas && item.canvasToken === entry.token))
      assert.equal(event.identity.ownerToken, point.owner); assert.equal(event.identity.pointRequest, point.request)
      assert.equal(event.identity.bodyRequest, point.request); assert.equal(event.identity.source, '')
    }
    assert.deepEqual(action.after.selection, action.kind === 'warning' ? { kind: 'stratum', id: singularCylinderOwner } : null)
    previous = action.after
  }
  assert.deepEqual(entry.restoration.before, previous)
  unchanged(entry.restoration.before, entry.restoration.after, true)
  for (const action of entry.restoration.actions) { assert.equal(action.controlCount, 1); unchanged(action.before, action.after, true) }
  assert.deepEqual(entry.restoration.uiAfter, entry.preparation.uiBefore)
  assert.deepEqual(entry.after, entry.restoration.after)
}
export function assertSingularCylinderEvidence(evidence) {
  assert.ok(cylinderDiagnosticScenarios.includes(evidence.scenario)); assert.equal(evidence.group, 'point-node-layout-anchors-combined')
  assert.equal(evidence.result, 'passed'); assert.deepEqual(evidence.pageErrors, [])
  assert.equal(evidence.cases.length, 2); assert.equal(evidence.downloads.length, 2)
  for (const ambientDimension of [2, 3]) {
    const cases = evidence.cases.filter((entry) => entry.ambientDimension === ambientDimension); assert.equal(cases.length, 1)
    const entry = cases[0]
    assert.equal(entry.transitions.length, 4)
    for (const [index, transition] of entry.transitions.entries()) {
      const singular = index % 2 === 1
      assert.equal(diagnosticScenarioFromLayout(pointFromState(transition.state).point.style.layout), evidence.scenario,
        'Every native transition belongs to this diagnostic scenario')
      assertSingularCylinderObservation(transition.rendered, transition.state, { singular })
      if (index > 0) {
        const previous = entry.transitions[index - 1], field = transition.field
        assert.equal(field.key, 'minimumWidth'); assert.equal(field.modelValue, singular ? 0 : 12)
        assert.equal(field.value, singular ? '0pt' : '12pt'); assert.equal(field.requestsUnchanged, true)
        assert.ok(field.events.length > 0 && field.events.every(({ type, trusted, value }) => type === 'input' && trusted === true && value === field.value))
        assert.equal(transition.state.labelDocumentRevision, previous.state.labelDocumentRevision)
        assert.equal(transition.rendered.owner, previous.rendered.owner); assert.equal(transition.rendered.request, previous.rendered.request)
        const oldModel = JSON.parse(previous.state.runtimeDiagramJson), newModel = JSON.parse(transition.state.runtimeDiagramJson)
        oldModel.strata[0].style.layout.minimumWidth = singular ? 0 : 12
        oldModel.strata[0].style.layout.units.minimumWidth = { source: singular ? '0pt' : '12pt', unit: 'pt', texPoints: singular ? 0 : 12 }
        assert.deepEqual(newModel, oldModel, 'Native authored minimum edits preserve all other model bytes')
      }
    }
    assert.deepEqual(entry.native.before, entry.transitions.at(-1).state,
      'Native diagnostic starts from the final recorded Inspector transition')
    assertSingularCylinderNative(entry.native)
    const download = evidence.downloads.find((item) => item.ambientDimension === ambientDimension)
    assert.ok(download); assert.equal(download.scenario, `${evidence.scenario}-${ambientDimension}d`)
    assert.equal(download.group, evidence.group); assert.equal(download.background, 'transparent')
    assertCurrentDownload(download)
    assert.deepEqual(download.expected[0].modelPoint, pointFromState(entry.native.after).point, 'Saved/reloaded export preserves the actual native diagnostic point')
    assert.equal(download.beforeExportState.labelDocumentRevision, entry.native.after.labelDocumentRevision + 1, 'Ordinary saved JSON reload advances the document owner exactly once')
  }
}
function assertCurrentDownload(input) {
  const { beforeExportState, click, expected, preExport, savedJson } = input, snapshot = click.snapshot
  assert.equal(click.error, undefined); assert.equal(snapshot.documentUnchanged, true)
  const { point, diagram } = pointFromState(beforeExportState)
  const scenario = diagnosticScenarioFromLayout(point.style.layout)
  assert.equal(input.scenario, `${scenario}-${input.ambientDimension}d`)
  assert.deepEqual(point.style.layout, cylinderDiagnosticLayout(scenario)); assert.equal(diagram.ambientDimension, input.ambientDimension)
  assert.deepEqual(JSON.parse(savedJson).diagram.strata, diagram.strata); assert.equal(JSON.parse(savedJson).version, 2)
  assert.equal(expected.length, 1); assert.equal(expected[0].id, point.id); assert.deepEqual(expected[0].modelPoint, point)
  assert.equal(expected[0].shape, 'cylinder'); assert.equal(expected[0].source, '')
  assertSingularCylinderObservation(expected[0].rendered, beforeExportState)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'uiSettings']) assert.deepEqual(snapshot[field], beforeExportState[field])
  assert.equal(snapshot.runtime.documentRevision, beforeExportState.labelDocumentRevision)
  assert.equal(snapshot.points.length, 1)
  const ui = JSON.parse(beforeExportState.uiSettings)
  const projection = resolveSvgCamera(diagram, 520, 360, { fitToView: true,
    extraPointsForFit: createCoordinateAxesGuide(diagram.ambientDimension).fitPoints,
    ...(ui.camera3d ? { cameraOverride: cameraOrientationForPreview(ui.camera3d), viewAdjustment: cameraViewAdjustmentFromControls(ui.camera3d) } : {}) })
  const projected = projectToSvgPoint(projection, point.position, 360)
  assert.equal(expected[0].rendered.nodeTransform, `translate(${projected.x} ${projected.y})`, 'Outer placement follows the current model coordinate and authenticated preview camera')
  const captured = snapshot.points[0]
  assert.equal(captured.id, point.id); assert.equal(captured.source, ''); assert.equal(captured.modelSource, '')
  assert.deepEqual(captured.style, point.style); assert.deepEqual(captured.position, point.position); assert.equal(captured.status, 'ready'); assert.equal(captured.held, null)
  assert.deepEqual(captured.runtime, snapshot.runtime); assert.equal(captured.request, expected[0].rendered.request)
  assert.equal(captured.pointRequest, captured.request); assert.equal(captured.owner, expected[0].rendered.owner)
  assert.equal(JSON.parse(captured.request)[5], snapshot.runtime.fontGeneration)
  assert.equal(captured.nodeTransform, expected[0].rendered.nodeTransform)
  assert.deepEqual(JSON.parse(captured.layout), expected[0].rendered.resolvedLayout)
  assert.equal(preExport.rootCount, 1); assert.equal(preExport.rootConnected, true)
  assert.equal(preExport.url && new URL(preExport.url).pathname, '/stratified-tikz/scripts/fixtures/freeLabelsApp.html')
  assert.equal(preExport.labelDocumentRevision, beforeExportState.labelDocumentRevision)
  assert.deepEqual(preExport.runtime, snapshot.runtime); assertSingularCylinderObservation(preExport.point, beforeExportState)
  assert.deepEqual(preExport.point, expected[0].rendered)
  for (const mode of ['standalone', 'inlineMath']) {
    const source = input.outputs[mode]
    assert.equal(source, generateTikzForUi(diagram, { ...ui, exportMode: mode }), 'Both TikZ modes reproduce the entire current authored model/source/coordinate/options')
    const layout = cylinderDiagnosticLayout(scenario)
    assert.ok(source.includes('cylinder') && source.includes('inner xsep=0pt') && source.includes(`inner ysep=${layout.units.innerYSep.source}`)
      && source.includes('minimum width=0pt') && source.includes(`minimum height=${layout.units.minimumHeight.source}`)
      && source.includes('cylinder uses custom fill'), 'TikZ retains authored unsupported cylinder intent')
    assert.ok(/\{\};/u.test(source)); assert.ok(!source.includes('preview unavailable'))
  }
}
export function assertSingularCylinderSvg(input, xml) {
  assertCurrentDownload(input)
  const { root, titles } = parseSignedPointSvg(xml), actual = input.reopened[0]
  assert.equal(input.reopened.length, 1); assert.equal(actual.domOrdinal, 0); assert.equal(actual.source, '')
  assert.equal(Object.hasOwn(actual, 'id'), false); assert.equal(Object.hasOwn(actual, 'shape'), false)
  assert.deepEqual(root.attributes, signedPointStandaloneRootAttributes); assert.deepEqual(input.document.rootAttributes, root.attributes)
  assert.equal(input.document.forbiddenCount, 0); assert.deepEqual(input.document.externalReferences, []); assert.equal(input.document.backgroundCount, 0)
  assert.deepEqual(root.children.map(({ tag }) => tag), ['g']); assert.deepEqual(root.children[0].attributes, {})
  assert.equal(root.children[0].children.length, 1)
  const wrapper = root.children[0].children[0], node = wrapper.children[0], warning = node.children[0], body = node.children[1]
  assert.deepEqual(wrapper.attributes, {}); assert.equal(wrapper.tag, 'g'); assert.equal(wrapper.children.length, 1)
  assert.equal(node.tag, 'g'); assert.deepEqual(node.children.map(({ tag }) => tag), ['path', 'g'])
  assert.deepEqual(node.attributes, { transform: input.expected[0].rendered.nodeTransform })
  assert.deepEqual(warning.attributes, { d: singularCylinderWarningPath, fill: '#B45309' }); assert.equal(warning.text, '')
  assert.equal(warning.children.length, 1); assert.equal(warning.children[0].tag, 'title')
  assert.deepEqual(warning.children[0].attributes, {}); assert.equal(warning.children[0].text, singularCylinderWarning); assert.equal(warning.children[0].children.length, 0)
  assert.equal(body.tag, 'g'); assert.deepEqual(body.attributes, { transform: 'translate(0 0)' })
  assert.deepEqual(body.children.map(({ tag }) => tag), ['title', 'g']); assert.deepEqual(body.children[0].attributes, {})
  assert.equal(body.children[0].text, ''); assert.equal(body.children[0].children.length, 0)
  const ink = body.children[1], content = ink.children[0], paint = input.expected[0].modelPoint.style.paint.text
  assert.equal(ink.tag, 'g'); assert.equal(ink.children.length, 1)
  assert.deepEqual(ink.attributes, { transform: 'translate(0 0)', opacity: String(input.expected[0].modelPoint.style.opacity * paint.opacity),
    fill: paint.color, color: paint.color, 'pointer-events': 'none' })
  assert.equal(content.tag, 'g'); assert.deepEqual(content.attributes, {}); assert.deepEqual(content.children, [])
  assert.equal(titles.length, 2)
  const nodes = [], visit = (entry) => { nodes.push(entry); for (const child of entry.children) visit(child) }; visit(root)
  assert.equal(nodes.filter(({ tag }) => tag === 'path').length, 1); assert.equal(nodes.filter(({ tag }) => tag === 'g').length, 6)
  assert.ok(nodes.every(({ tag }) => ['svg', 'g', 'path', 'title'].includes(tag)))
  assert.ok(nodes.every(({ tag, text, attributes }) => (tag === 'title' || text === '')
    && Object.keys(attributes).every((name) => !name.startsWith('data-') && !name.startsWith('aria-'))))
  assert.deepEqual(actual.warning, input.expected[0].rendered.warning); assert.equal(actual.warningTitle, singularCylinderWarning)
  assert.equal(actual.nodeTransform, node.attributes.transform); assert.equal(actual.bodyTransform, body.attributes.transform)
  assert.deepEqual(actual.paths, { node: node.path, warning: warning.path, warningTitle: warning.children[0].path, body: body.path,
    bodyTitle: body.children[0].path, ink: ink.path, content: content.path })
  assert.deepEqual(input.document.inventory, { titleCount: 2, pathCount: 1, groupCount: 6, rootChildTags: ['g'] })
  matrix(input.document.frame.rootCTM); matrix(input.document.frame.rootScreenCTM)
  for (const kind of ['node', 'warning', 'body']) {
    const local = kind === 'body' ? multiply(translation(node.attributes.transform), translation(body.attributes.transform)) : translation(node.attributes.transform)
    closeMatrix(actual.matrices[`${kind}CTM`], multiply(input.document.frame.rootCTM, local))
    closeMatrix(actual.matrices[`${kind}ScreenCTM`], multiply(input.document.frame.rootScreenCTM, local))
  }
  for (const local of [{ x: -8, y: -2 }, { x: -6, y: -2 }, { x: -8, y: 10 }, { x: -6, y: 10 }]) {
    const screen = transform(actual.matrices.warningScreenCTM, local), bounds = input.document.frame.rootBounds
    assert.ok(screen.x >= bounds.x && screen.y >= bounds.y && screen.x <= bounds.x + bounds.width && screen.y <= bounds.y + bounds.height,
      'Every warning edge lies within the complete root before capture')
  }
  assert.equal(at(root, actual.paths.warning), warning)
  return { schema: 'stz-singular-cylinder-diagnostic-artifact-v1', scenario: input.scenario, ambientDimension: input.ambientDimension,
    source: '', owner: input.click.snapshot.points[0].owner, request: input.click.snapshot.points[0].request,
    revision: input.beforeExportState.labelDocumentRevision, svgSha256: hash(Buffer.from(xml)), warningPath: singularCylinderWarningPath,
    warningTitle: singularCylinderWarning, bodyTitlePath: actual.paths.bodyTitle }
}
// Raster replay is independent of geometry rendering. The warning is the only
// permitted paint in this empty fixture; custom green/magenta regions must not
// survive either the downloaded SVG or its actual complete-root PNG.
export function observeSingularCylinderPixels(png, ctm) {
  matrix(ctm)
  const { width, height, rgba } = decodeConnectedPaintPng(png), determinant = ctm.a * ctm.d - ctm.b * ctm.c
  let pixels = 0, forbiddenPaintPixels = 0
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4, [r, g, b, alpha] = rgba.subarray(offset, offset + 4)
    if (!alpha) continue
    if ((g > r + 40 && g > b + 40) || (r > g + 40 && b > g + 40)) forbiddenPaintPixels++
    if (!(r > g + 35 && g > b + 35)) continue
    const dx = x + .5 - ctm.e, dy = y + .5 - ctm.f
    const local = { x: (ctm.d * dx - ctm.c * dy) / determinant, y: (-ctm.b * dx + ctm.a * dy) / determinant }
    assert.ok(local.x >= -9.5 && local.x <= -4.5 && local.y >= -3.5 && local.y <= 11.5, 'All diagnostic paint belongs to its current warning')
    pixels++
    bounds.minX = Math.min(bounds.minX, local.x); bounds.maxX = Math.max(bounds.maxX, local.x)
    bounds.minY = Math.min(bounds.minY, local.y); bounds.maxY = Math.max(bounds.maxY, local.y)
  }
  return { method: 'actual-native-PNG-singular-cylinder-warning-pixel-centers', sha256: hash(png), bytes: png.length,
    width, height, ctm: { ...ctm }, pixels, forbiddenPaintPixels, bounds: pixels ? bounds : null }
}
export function assertSingularCylinderPixels(pixels) {
  assert.equal(pixels.method, 'actual-native-PNG-singular-cylinder-warning-pixel-centers')
  assert.ok(pixels.pixels > 0); assert.equal(pixels.forbiddenPaintPixels, 0); assert.match(pixels.sha256, /^[a-f0-9]{64}$/u)
  const scale = Math.min(Math.hypot(pixels.ctm.a, pixels.ctm.b), Math.hypot(pixels.ctm.c, pixels.ctm.d)), cell = 1.5 / scale
  assert.ok(pixels.bounds.minY <= -2 + cell && pixels.bounds.maxY >= 10 - cell, 'Native PNG retains both warning strokes')
}
export function assertSingularCylinderStandaloneEvidence(evidence, raw, artifactDir, ambientDimension, { checkout } = {}) {
  assertSingularCylinderEvidence(evidence)
  const download = evidence.downloads.find((entry) => entry.ambientDimension === ambientDimension)
  const xml = assertStandaloneReopeningRecord(raw, download, artifactDir)
  assert.equal(raw.xml, xml, 'Before-assert XML evidence belongs to exact downloaded bytes')
  for (const field of ['savedJson', 'outputs', 'beforeExportState', 'preExport', 'capture']) assert.deepEqual(raw[field], download[field])
  const stem = download.scenario
  const native = readEvidenceDocumentSync(artifactDir, `${stem}-native.json`, { checkout })
  assert.equal(native.scenario, evidence.scenario); assert.equal(native.result, 'observed'); assert.equal(native.group, evidence.group)
  assert.deepEqual(native.case, evidence.cases.find((entry) => entry.ambientDimension === ambientDimension))
  assert.equal(readFileSync(resolve(artifactDir, `${stem}-saved.json`), 'utf8'), raw.savedJson)
  for (const mode of ['standalone', 'inlineMath']) assert.equal(readFileSync(resolve(artifactDir, `${stem}-${mode}.tex`), 'utf8'), raw.outputs[mode])
  const context = assertSingularCylinderSvg(raw, xml)
  validateStandaloneSvgCaptureEvidence(raw.capture, { svgPath: raw.svgPath, pngPath: resolve(artifactDir, `${stem}.png`), root: raw.document.root })
  const warningPixels = observeSingularCylinderPixels(readFileSync(resolve(artifactDir, `${stem}.png`)), raw.reopened[0].matrices.warningScreenCTM)
  assert.deepEqual(raw.warningPixels, warningPixels); assert.deepEqual(download.warningPixels, warningPixels); assertSingularCylinderPixels(warningPixels)
  assert.deepEqual(raw.document.frame.rootBounds, raw.capture.measurements[0].root.bounds)
  assert.equal(raw.document.frame.url, raw.capture.measurements[0].url)
  return { ...context, svgPath: raw.svgPath, pngSha256: hash(readFileSync(resolve(artifactDir, `${stem}.png`))) }
}
