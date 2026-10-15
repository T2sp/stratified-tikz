import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertStandaloneReopeningRecord, validateStandaloneSvgCaptureEvidence } from './standaloneSvgCaptureContract.mjs'
import { assertPointNativeDragEvidence, assertPointCanvasPreparation } from './pointNativeDrag.mjs'
import { assertGeometricSelectionEvidence, assertPointToolbarPreparation } from './pointGeometricShapesContract.mjs'
import { assertUnsupportedDiagnosticEvidence } from './pointUnsupportedDiagnosticContract.mjs'
import { assertPendingLayoutPreparation, assertPendingLayoutClickContinuation } from './pointLayoutPendingPreparation.mjs'
import { assertPendingLayoutFixture } from './pointLayoutPendingFixture.mjs'
import { assertPendingLayoutViewEvidence } from './pointLayoutPendingView.mjs'
import { createHash } from 'node:crypto'
import { decodeConnectedPaintPng } from './connectedLivePaintOracle.mjs'
import { assertZeroAxisLiveCapture } from './zeroAxisLiveCapture.mjs'
import { assertSignedPointStandaloneAssociation, assertSignedPointStandaloneGeometry } from './signedPointStandaloneAssociation.mjs'
import { readEvidenceDocumentSync } from './evidencePublication.mjs'
import { singularCylinderScenario, subspCylinderScenario, cylinderDiagnosticScenarios, assertSingularCylinderEvidence } from './singularCylinderDiagnosticContract.mjs'
import { foldedCylinderScenario, assertFoldedCylinderEvidence } from './foldedCylinderContract.mjs'
import { conformanceArtifacts } from './pointConformanceContract.mjs'

export const layoutAnchorGroup = 'point-node-layout-anchors-combined'
export const layoutShapes = ['circle', 'rectangle', 'square', 'triangle', 'ellipse', 'diamond', 'regular polygon',
  'star', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
export const layoutRegimes = [
  { key: 'unequal-padding', layout: { innerXSep: 4, innerYSep: 1, outerXSep: 0, outerYSep: 0, anchor: 'center' } },
  { key: 'zero', layout: { innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, anchor: 'center' } },
  { key: 'negative', layout: { innerXSep: -1, innerYSep: -.5, outerXSep: -.2, outerYSep: -.1, anchor: 'center' } },
  { key: 'minimum-dominant', layout: { innerXSep: 0, innerYSep: 0, minimumWidth: 90, minimumHeight: 60, anchor: 'center' } },
  { key: 'unequal-minima', layout: { innerXSep: 2, innerYSep: 5, minimumWidth: 35, minimumHeight: 85, anchor: 'center' } },
  { key: 'outer-clearance', layout: { innerXSep: 4, innerYSep: 1, outerXSep: 8, outerYSep: 13, anchor: 'center' } },
]
export function layoutForShapeRegime(shape, regime) {
  return shape === 'cylinder' && regime.key === 'negative' ? { ...regime.layout, innerYSep: 0 } : regime.layout
}
export const standardPointAnchors = ['center', 'text', 'base', 'mid',
  'north', 'north east', 'east', 'south east', 'south', 'south west', 'west', 'north west', '17', '213']
const textSideShapes = new Set(['circle', 'rectangle', 'ellipse', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'cylinder'])
export function pointAnchorsForShape(shape) {
  return [...standardPointAnchors, ...(textSideShapes.has(shape) ? ['base west', 'base east', 'mid west', 'mid east'] : []), ...specificPointAnchors[shape]]
}
// Category representatives are literal PGF names. Indexed anchors exercise both
// ends of the configured family; tests below require every recorded identity.
export const specificPointAnchors = {
  circle: [], rectangle: [], square: ['corner 1', 'corner 4', 'side 1', 'side 4'],
  triangle: ['corner 1', 'corner 3', 'side 1', 'side 3'], ellipse: [], diamond: [],
  'regular polygon': ['corner 1', 'corner 7', 'side 1', 'side 7'],
  star: ['outer point 1', 'outer point 7', 'inner point 1', 'inner point 7'],
  trapezium: ['top left corner', 'top right corner', 'bottom left corner', 'bottom right corner', 'top side', 'bottom side', 'left side', 'right side'],
  'isosceles triangle': ['apex', 'left corner', 'right corner', 'left side', 'right side', 'lower side'],
  kite: ['upper vertex', 'lower vertex', 'left vertex', 'right vertex', 'upper left side', 'upper right side', 'lower left side', 'lower right side'],
  dart: ['tip', 'tail center', 'left tail', 'right tail', 'left side', 'right side'],
  semicircle: ['apex', 'arc start', 'arc end', 'chord center'],
  'circular sector': ['arc start', 'arc end', 'arc center', 'sector center'],
  cylinder: ['shape center', 'before top', 'after top', 'before bottom', 'after bottom', 'top', 'bottom'],
}
export const layoutShapeParameters = {
  'regular polygon': { regularPolygonSides: 7, borderRotate: 23 }, star: { starPoints: 7, starPointMode: 'height', starPointHeight: 8, borderRotate: 17 },
  diamond: { aspect: 1.8 }, trapezium: { trapeziumLeftAngle: 65, trapeziumRightAngle: 75, trapeziumStretches: true, trapeziumStretchesBody: true },
  'isosceles triangle': { isoscelesTriangleApexAngle: 65, isoscelesTriangleStretches: true, borderUsesIncircle: true, borderRotate: 31 },
  kite: { kiteUpperVertexAngle: 100, kiteLowerVertexAngle: 75, borderUsesIncircle: true, borderRotate: 20 },
  dart: { dartTipAngle: 55, dartTailAngle: 125 }, semicircle: { borderUsesIncircle: true, borderRotate: 33 },
  'circular sector': { circularSectorAngle: 110, borderRotate: 17 }, cylinder: { aspect: .55 },
}
export const layoutAnchorScenarios = ['point-layout-per-shape-spacing-minima', 'point-layout-anchor-support-rotation',
  'point-layout-native-controls-persistence', 'point-layout-import-order-units', 'point-layout-async-combined-isolation',
  'point-layout-native-interaction-2d-3d', 'point-layout-signed-polygonal-zero-axis', 'point-layout-pending-transparent-edit', 'point-layout-pending-white-load', singularCylinderScenario, subspCylinderScenario, foldedCylinderScenario]
export const layoutFieldKeys = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight', 'anchor']
// PGF 3.1.11a's signed maximum retains -80 TeX pt fitted axes for these
// authored dimensions. Preview uses 1.2 SVG units per TeX pt: east=-96.
export const signedAxisLayout = { innerXSep: -100, innerYSep: -100, minimumWidth: -160, minimumHeight: -160,
  outerXSep: 0, outerYSep: 0 }
export const signedAnchorCases = ['ellipse', 'rectangle'].map((shape) => ({ key: `${shape}-empty-east`, shape,
  ambientDimension: 2, source: '', layout: { ...signedAxisLayout, anchor: 'east' } }))
export const signedPickingCases = [{ key: 'ellipse-body-2d', ambientDimension: 2, source: 'x' },
  { key: 'ellipse-empty-3d', ambientDimension: 3, source: '' }]
  .map((entry) => ({ ...entry, shape: 'ellipse', layout: { ...signedAxisLayout, anchor: 'center' } }))
// Independent PGF 3.1.11a empty fixed-box observations, already converted once
// from PGF Y-up to SVG Y-down TeX pt. The lower isosceles corner is intentional:
// its apex alone did not expose the reviewed signed-angle fitting defect.
export const signedPolygonalScenario = 'point-layout-signed-polygonal-zero-axis'
export const signedPolygonalLayout = { innerXSep: -30, innerYSep: -30, minimumWidth: -20, minimumHeight: -20,
  outerXSep: 3, outerYSep: 3 }
export const signedPolygonalCases = [
  { shape: 'regular polygon', anchor: 'corner 1', expectedTeXpt: { x: 0, y: 6.29184 } },
  { shape: 'square', anchor: 'corner 1', expectedTeXpt: { x: -4.07089, y: 4.07089 } },
  { shape: 'triangle', anchor: 'corner 1', expectedTeXpt: { x: 0, y: 4 } },
  { shape: 'star', anchor: 'outer point 1', expectedTeXpt: { x: 0, y: 5.37004 } },
  { shape: 'isosceles triangle', anchor: 'left corner', expectedTeXpt: { x: -4.1154, y: 3.79349 } },
  { shape: 'dart', anchor: 'tip', expectedTeXpt: { x: -4.85109, y: 0 } },
].map((entry) => ({ ...entry, key: entry.shape.replaceAll(' ', '-'), source: '',
  layout: { ...signedPolygonalLayout, anchor: entry.anchor } }))
export const zeroAxisLayout = { innerXSep: 0, innerYSep: 20, minimumWidth: 0, minimumHeight: 0,
  outerXSep: 0, outerYSep: 0, anchor: 'center' }
export const zeroAxisHalfExtent = 20 * Math.SQRT2 * 1.2
export const layoutImportCases = [
  { key: 'layout ordered shorthand', options: 'inner xsep=2pt,inner sep=3pt,inner ysep=4pt,outer xsep=2pt,outer sep=5pt,outer ysep=6pt,minimum width=20pt,minimum size=30pt,minimum height=40pt', expected: { innerXSep: 3, innerYSep: 4, outerXSep: 5, outerYSep: 6, minimumWidth: 30, minimumHeight: 40 } },
  { key: 'layout ordered axis', options: 'inner sep=3pt,inner xsep=2pt,outer sep=5pt,outer xsep=2pt,minimum size=30pt,minimum width=20pt', expected: { innerXSep: 2, innerYSep: 3, outerXSep: 2, outerYSep: 5, minimumWidth: 20, minimumHeight: 30 } },
  { key: 'layout physical inches', options: 'inner xsep=1in,inner ysep=25.4mm,minimum width=2.54cm,minimum height=72.27pt', expected: { innerXSep: 72.27, innerYSep: 72.27, minimumWidth: 72.27, minimumHeight: 72.27 } },
  { key: 'layout physical bp', options: 'inner xsep=72bp,inner ysep=72.27pt', expected: { innerXSep: 72.27, innerYSep: 72.27 } },
  { key: 'layout contextual units', options: 'inner xsep=2em,inner ysep=2ex', expected: { innerXSep: 20, innerYSep: 8.61108 } },
  { key: 'layout signed zero', options: 'inner xsep=-1mm,inner ysep=0pt,outer sep=-.5pt,minimum size=0pt,anchor=base east', expected: { innerXSep: -72.27 / 25.4, innerYSep: 0, outerXSep: -.5, outerYSep: -.5, minimumWidth: 0, minimumHeight: 0, anchor: 'base east' } },
]
export function layoutAnchorArtifacts(name) {
  const files = [`${name}.json`]
  if (name === signedPolygonalScenario) for (const ambientDimension of [2, 3]) {
    const stem = `${name}-${ambientDimension}d`
    files.push(`${stem}-native.json`, `${stem}-live-capture.json`, `${stem}-live.png`, `${stem}.svg`, `${stem}.png`, `${stem}-standalone.json`,
      `${stem}-saved.json`, `${stem}-standalone.tex`, `${stem}-inlineMath.tex`)
  }
  if (name === signedPolygonalScenario) files.push(...conformanceArtifacts())
  if (cylinderDiagnosticScenarios.includes(name) || name === foldedCylinderScenario) for (const ambientDimension of [2, 3]) {
    const stem = `${name}-${ambientDimension}d`
    files.push(`${stem}-native.json`, `${stem}.svg`, `${stem}.png`, `${stem}-standalone.json`,
      `${stem}-saved.json`, `${stem}-standalone.tex`, `${stem}-inlineMath.tex`)
  }
  if (name.startsWith('point-layout-pending-')) files.push(`${name}-preparation.json`, `${name}.svg`, `${name}.png`, `${name}-standalone.json`, `${name}-standalone.tex`, `${name}-inlineMath.tex`)
  if (name === 'point-layout-pending-transparent-edit') files.push(`${name}-post-click-view.json`)
  if (name === 'point-layout-native-controls-persistence') files.push(`${name}-saved.json`, `${name}-standalone.tex`, `${name}-inlineMath.tex`)
  if (name === 'point-layout-import-order-units') files.push(`${name}.sty`, `${name}-saved.json`, `${name}-standalone.tex`, `${name}-inlineMath.tex`)
  return files
}
export function assertPointTikzSourceByMode(outputs, source) {
  assert.ok(outputs.standalone.includes(`{${source}}`), 'Standalone retains the exact raw node body')
  const inlineBody = source.replace(/\r\n?/g, '\n').replace(/[^\S\n]*\n+[^\S\n]*/g, ' ')
  assert.ok(outputs.inlineMath.includes(`{${inlineBody}}`), 'Inline retains the established physical-line folding convention')
}
export function assertLayoutPostClickViewDiagnostic(evidence, reportRecords) {
  assert.equal(evidence.scenario, 'point-layout-pending-transparent-edit')
  assert.ok(Array.isArray(reportRecords), 'The fresh browser report retains post-click view diagnostics')
  const related = reportRecords.filter(({ name }) => name === `${evidence.scenario}-post-click-view`)
  assert.ok(related.length > 0, 'The fresh browser report retains actual post-click view observations')
  for (const entry of related) {
    assert.equal(entry.group, layoutAnchorGroup); assert.equal(entry.result, 'observed')
    const view = entry.postClickView
    assert.ok(view, 'Every related view diagnostic retains its raw observations')
    assert.equal(view.scenario, evidence.scenario); assert.equal(view.source, evidence.pendingPreparation.source)
    assert.ok(['observed', 'passed'].includes(view.result)); assert.equal(view.error, undefined)
    assert.deepEqual(view.secondaryErrors, [], 'Secondary view diagnostic and cleanup errors cannot support acceptance')
    assert.deepEqual(view.click, evidence.click, 'Every view diagnostic preserves the same immutable old export click')
  }
  const accepted = related.filter(({ postClickView }) => postClickView.result === 'passed')
  assert.equal(accepted.length, 1, 'The fresh browser report contains one accepted actual post-click view observation')
  let preceding = -1
  for (const [stageIndex, boundary] of ['before', 'immediate-input', 'after'].entries()) {
    const index = related.findIndex(({ postClickView }) => postClickView.result === 'observed'
      && postClickView.stages?.at(-1)?.boundary === boundary)
    assert.ok(index > preceding && index < related.indexOf(accepted[0]), `Raw ${boundary} observations are persisted in order before view acceptance`)
    assert.deepEqual(related[index].postClickView.stages, evidence.postClickView.stages.slice(0, stageIndex + 1),
      `Persisted ${boundary} stage prefix retains the terminal native observations`)
    preceding = index
  }
  assert.deepEqual(related.at(-1).postClickView, evidence.postClickView, 'The last view diagnostic matches terminal acceptance')
  assert.deepEqual(accepted[0].postClickView, evidence.postClickView, 'The accepted diagnostic matches terminal control and geometry proof')
}
export function assertLayoutStandaloneEvidence(evidence, raw, artifactDir, { checkout } = {}) {
  assertLayoutAnchorEvidence(evidence, evidence.scenario)
  assert.ok(evidence.scenario.startsWith('point-layout-pending-'))
  assertStandaloneReopeningRecord(raw, evidence, artifactDir)
  assert.deepEqual(raw.pending, evidence.pending)
  assert.deepEqual(raw.pendingPreparation, evidence.pendingPreparation, 'Retained standalone record preserves the accepted native pending preparation')
  assert.deepEqual(raw.beforeExportClick, evidence.beforeExportClick, 'Retained standalone record preserves the held request immediately before export')
  assert.deepEqual(raw.capturedRelease, evidence.capturedRelease, 'Retained standalone record preserves the intended post-click release')
  const preparation = readEvidenceDocumentSync(artifactDir, `${evidence.scenario}-preparation.json`, { checkout })
  assert.equal(preparation.scenario, evidence.scenario); assert.equal(preparation.group, layoutAnchorGroup)
  assert.equal(preparation.result, 'observed', 'Preparation artifact retains raw observations before terminal download acceptance')
  assert.deepEqual(preparation.pendingPreparation, evidence.pendingPreparation, 'Retained native preparation matches the accepted terminal download')
  if (evidence.background === 'transparent') {
    assert.deepEqual(raw.postClickView, evidence.postClickView, 'Standalone and terminal records retain the same post-click native 2D view evidence')
    const view = readEvidenceDocumentSync(artifactDir, `${evidence.scenario}-post-click-view.json`, { checkout })
    assert.equal(view.scenario, `${evidence.scenario}-post-click-view`, 'The raw 2D view artifact belongs to this pending download')
    assert.equal(view.group, layoutAnchorGroup)
    assert.equal(view.result, 'observed', 'The raw 2D view artifact precedes terminal download acceptance')
    assert.deepEqual(view.postClickView, evidence.postClickView, 'Raw 2D view observations match the accepted terminal and standalone records')
  }
  for (const [index, expected] of evidence.expected.entries()) {
    const actual = raw.reopened[index], captured = evidence.click.snapshot.points.find(({ id }) => id === expected.id)
    assert.ok(captured); assert.equal(captured.source, expected.source); assert.equal(captured.style.shape, expected.shape)
    assert.deepEqual(captured.style.layout, expected.layout)
    assert.equal(actual.source, expected.source); assert.equal(actual.shape, expected.shape)
    assert.equal(actual.errors, 0); assert.ok(actual.glyphs > 0)
    assert.deepEqual(actual.contour, expected.rendered.contour)
    assert.equal(actual.nodeTransform, expected.rendered.nodeTransform); assert.equal(actual.nodeTransform, captured.nodeTransform)
    assert.equal(actual.bodyTransform, expected.rendered.bodyTransform)
  }
  assert.notDeepEqual(raw.pending.contour, evidence.expected[0].rendered.contour, 'Reopened export uses settled contour')
  for (const mode of ['standalone', 'inlineMath']) {
    assert.equal(raw.outputs[mode], readFileSync(resolve(artifactDir, `${evidence.scenario}-${mode}.tex`), 'utf8'), 'Retained captured TikZ output matches its actual artifact')
    assert.ok(raw.outputs[mode].includes('anchor=base') && raw.outputs[mode].includes('anchor=shape center'))
  }
  assertPointTikzSourceByMode(raw.outputs, evidence.expected[0].source)
  assert.deepEqual(evidence.capture, raw.capture, 'Terminal layout download retains its actual capture record')
  validateStandaloneSvgCaptureEvidence(raw.capture, { svgPath: raw.svgPath,
    pngPath: resolve(artifactDir, `${evidence.scenario}.png`), root: raw.document.root })
}
function finitePoint(point, message) {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), message)
}
export function assertObservedPointPlacement(entry) {
  assert.equal(entry.result, 'passed'); assert.equal(entry.rendered.source, entry.source)
  assert.equal(entry.rendered.shape, entry.shape); assert.equal(entry.rendered.anchor, entry.anchor)
  assert.equal(entry.rendered.pointRequest, entry.rendered.bodyRequest, 'One revision owns contour and body')
  assert.ok(['ready', 'pending', 'fallback'].includes(entry.rendered.state))
  for (const key of ['bodyOrigin', 'placement', 'anchorOffset', 'placedAnchor']) finitePoint(entry.rendered[key], key)
  for (const value of Object.values(entry.rendered.bounds)) assert.ok(Number.isFinite(value))
  assert.ok(entry.rendered.contourLength > 0)
  assert.ok(Math.abs(entry.rendered.placedAnchor.x - entry.rendered.placement.x) < .001)
  assert.ok(Math.abs(entry.rendered.placedAnchor.y - entry.rendered.placement.y) < .001)
  assert.equal(entry.modelPositionUnchanged, true)
}
export function assertPointOwnerCycleEvidence(entry, selectedId, expectedId) {
  assert.equal(entry.selectedId, selectedId); assert.equal(entry.expectedId, expectedId)
  assertPointCanvasPreparation(entry.preparation, selectedId)
  assertPointToolbarPreparation(entry.toolbarPreparation, entry.toolbarRestoration, selectedId)
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
    assert.deepEqual(entry.stateBefore[field], entry.toolbarPreparation.statePrepared[field], `Owner cycling starts from prepared toolbar ${field}`)
    assert.deepEqual(entry.toolbarRestoration.stateBefore[field], entry.stateAfter[field], `Owner cycling restores toolbar after expected ${field}`)
  }
  assert.deepEqual(entry.requestedClick, entry.toolbarPreparation.requestedClick, 'Owner cycling uses freshly prepared input coordinates')
  assert.deepEqual(entry.before.geometry.contour, entry.toolbarPreparation.prepared.geometry.contour, 'Owner cycling retains the current prepared contour/CTM')
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
    assert.deepEqual(entry.stateBefore[field], entry.preparation.statePrepared[field], `Owner cycling starts from preserved ${field}`)
  }
  assert.equal(entry.stateBefore.selection?.kind, 'stratum'); assert.equal(entry.stateBefore.selection.id, selectedId)
  assert.equal(entry.stateAfter.selection?.kind, 'stratum'); assert.equal(entry.stateAfter.selection.id, expectedId)
  const runtime = JSON.parse(entry.stateBefore.runtimeDiagramJson)
  for (const id of [selectedId, expectedId]) assert.ok(runtime.strata.some((point) => point.id === id && point.geometricKind === 'point'))
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings']) {
    assert.deepEqual(entry.stateAfter[field], entry.stateBefore[field], `Owner cycling preserves raw ${field}`)
  }
  assert.deepEqual(entry.secondaryErrors, []); assert.deepEqual(entry.before.errors, [])
  assert.equal(entry.before.inspector.open, false); assert.equal(entry.droppedEvents, 0)
  assert.deepEqual(entry.before.selection, entry.stateBefore.selection)
  assert.deepEqual(entry.before.model, runtime.strata.find((point) => point.id === selectedId))
  assert.equal(entry.before.labelDocumentRevision, entry.stateBefore.labelDocumentRevision)
  assert.deepEqual(entry.requestedClick, entry.rendered.boundary)
  assert.deepEqual(entry.before.requestedClick, entry.requestedClick)
  const intended = (target) => target?.pointId === selectedId && target.svg === true && target.canvas === true && target.drawer === false
  assert.ok(intended(entry.before.elementFromPoint), 'Fresh owner-cycle target belongs to the intended point')
  assert.deepEqual(entry.before.elementsFromPoint[0], entry.before.elementFromPoint, 'Fresh owner-cycle hit stack starts at the intended path')
  assert.equal(entry.events.length, 3, 'Owner-cycle observer retains exactly its one native gesture')
  let previous = -1, pointerId
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    const index = entry.events.findIndex((event, index) => index > previous && event.type === type
      && event.phase === 'owner-cycle' && event.selectedId === selectedId && event.trusted === true && event.altKey === true
      && event.button === 0 && event.buttons === (type === 'pointerdown' ? 1 : 0)
      && intended(event.target) && event.path.some((element) => element?.pointId === selectedId)
      && event.path.some((element) => element?.canvasRoot === true)
      && Math.abs(event.client.x - entry.requestedClick.x) < 1 && Math.abs(event.client.y - entry.requestedClick.y) < 1
      && (pointerId === undefined || event.pointerId === pointerId || (type === 'click' && event.pointerId === null)))
    assert.ok(index >= 0, `Raw trusted owner-cycle ${type} reaches the intended path`)
    assert.equal(entry.events[index].labelDocumentRevision, entry.stateBefore.labelDocumentRevision, `Owner-cycle ${type} retains the same document epoch`)
    if (type === 'pointerdown') {
      pointerId = entry.events[index].pointerId; assert.ok(Number.isInteger(pointerId))
      assert.deepEqual(entry.events[index].selection, entry.stateBefore.selection)
    }
    previous = index
  }
}
function assertSignedCaseState(state, spec, ids = ['app-point']) {
  const envelope = JSON.parse(state.json), runtime = JSON.parse(state.runtimeDiagramJson), history = JSON.parse(state.history)
  assert.equal(envelope.version, 2, 'Signed dimensions retain saved version 2')
  for (const diagram of [envelope.diagram, runtime, history.present]) {
    assert.equal(diagram.ambientDimension, spec.ambientDimension)
    for (const id of ids) {
      const point = diagram.strata.find((point) => point.id === id)
      assert.ok(point); assert.equal(point.geometricKind, 'point'); assert.equal(point.codim, spec.ambientDimension)
      assert.equal(point.text ?? '', spec.source); assert.equal(point.style.shape, spec.shape)
      assert.deepEqual(point.style.layout, spec.layout, 'Signed authored layout survives runtime, saved envelope and history')
      assert.deepEqual(point.position, { x: 3, y: 3, z: spec.ambientDimension === 3 ? .5 : 0 }, 'Signed geometry preserves model coordinates')
    }
  }
}
function assertSignedCasePlacement(entry, spec) {
  assert.equal(entry.key, spec.key); assert.equal(entry.ambientDimension, spec.ambientDimension)
  assert.equal(entry.source, spec.source); assert.equal(entry.shape, spec.shape); assert.equal(entry.anchor, spec.layout.anchor)
  assert.deepEqual(entry.layout, spec.layout)
  assertObservedPointPlacement(entry)
  assert.equal(entry.rendered.bodyUpright, true)
  for (const key of layoutFieldKeys) assert.equal(entry.rendered.layout[key], spec.layout[key], 'Resolved layout preserves signed authored dimensions')
  assertSignedCaseState(entry.state, spec)
}
export function assertLayoutAnchorEvidence(evidence, name) {
  assert.equal(evidence.scenario, name); assert.equal(evidence.group, layoutAnchorGroup); assert.equal(evidence.result, 'passed')
  assert.deepEqual(evidence.pageErrors, [])
  if (cylinderDiagnosticScenarios.includes(name)) {
    assertSingularCylinderEvidence(evidence)
  } else if (name === foldedCylinderScenario) {
    assertFoldedCylinderEvidence(evidence)
  } else if (name === 'point-layout-per-shape-spacing-minima') {
    assert.equal(evidence.cases.length, layoutShapes.length * layoutRegimes.length)
    for (const shape of layoutShapes) for (const regime of layoutRegimes) {
      const found = evidence.cases.filter((entry) => entry.shape === shape && entry.regime === regime.key)
      assert.equal(found.length, 1, `${shape}/${regime.key}`); assert.deepEqual(found[0].layout, layoutForShapeRegime(shape, regime))
      assertObservedPointPlacement(found[0]); assert.equal(found[0].rendered.state, 'ready')
    }
    assert.equal(evidence.outerSepPaintInvariant.length, layoutShapes.length)
    for (const shape of layoutShapes) {
      const invariant = evidence.outerSepPaintInvariant.filter((entry) => entry.shape === shape)
      assert.equal(invariant.length, 1)
      assert.equal(invariant[0].sameContour, shape !== 'diamond')
      assert.equal(invariant[0].samePaintedBounds, shape !== 'diamond'); assert.equal(invariant[0].differentAnchorBounds, true)
      if (shape === 'diamond') {
        // PGF 3.1.11a's background radius is fitted+(1-1.414213)*outer axis,
        // independently of its enlarged anchor axes (recorded lines329–341).
        const expected = { width: 2 * .414213 * 8 * 1.2, height: 2 * .414213 * 13 * 1.2 }
        for (const [axis, difference] of Object.entries(expected)) assert.ok(Math.abs(invariant[0].paintShrink[axis] - difference) < .001)
      }
    }
  } else if (name === 'point-layout-anchor-support-rotation') {
    const expected = layoutShapes.flatMap((shape) => pointAnchorsForShape(shape).map((anchor) => ({ shape, anchor })))
    assert.equal(evidence.cases.length, expected.length)
    for (const { shape, anchor } of expected) {
      const found = evidence.cases.filter((entry) => entry.shape === shape && entry.anchor === anchor)
      assert.equal(found.length, 1, `${shape}/${anchor}`); assertObservedPointPlacement(found[0]); assert.equal(found[0].rendered.state, 'ready')
      assert.equal(found[0].rendered.bodyUpright, true)
    }
    assert.ok(evidence.unsupportedAnchor.diagnostic.length > 0)
    assert.equal(evidence.unsupportedAnchor.savedAnchor, 'not a PGF anchor')
    assert.equal(evidence.unsupportedAnchor.nativeCases.length, 6)
    for (const ambientDimension of [2, 3]) for (const shape of ['ellipse', 'circle', 'cylinder']) {
      const found = evidence.unsupportedAnchor.nativeCases.filter((entry) => entry.ambientDimension === ambientDimension && entry.shape === shape)
      assert.equal(found.length, 1)
      assertUnsupportedDiagnosticEvidence(found[0])
      assert.equal(found[0].rendered.anchor, evidence.unsupportedAnchor.savedAnchor)
    }
  } else if (name === 'point-layout-native-controls-persistence') {
    for (const key of ['nativeInputs', 'historyRestored', 'clipboardRestored', 'presetRestored', 'saveReloadRestored', 'rawSourcePreserved', 'standaloneTikz', 'inlineTikz']) assert.equal(evidence[key], true, key)
    assert.equal(evidence.fields.length, 7)
    for (const key of layoutFieldKeys) {
      const found = evidence.fields.filter((field) => field.key === key)
      assert.equal(found.length, 1, `Native field identity ${key}`)
      const field = found[0]
      assert.ok(field.events.length > 0); assert.ok(field.events.every(({ type, trusted }) => type === 'input' && trusted === true))
      assert.equal(field.events.at(-1).value, field.expected, `Final trusted event ${key}`)
      assert.equal(field.value, field.expected); assert.equal(field.modelValue, field.expectedModel)
      assert.equal(field.requestsUnchanged, true)
    }
  } else if (name === 'point-layout-import-order-units') {
    assert.equal(evidence.cases.length, layoutImportCases.length)
    for (const spec of layoutImportCases) {
      const found = evidence.cases.filter((entry) => entry.key === spec.key)
      assert.equal(found.length, 1, `Imported unit/order identity ${spec.key}`)
      const entry = found[0]
      assert.equal(entry.result, 'passed'); assert.deepEqual(entry.expected, spec.expected)
      for (const [key, expected] of Object.entries(spec.expected)) {
        if (typeof expected === 'number') assert.ok(Number.isFinite(entry.actual[key]) && Math.abs(entry.actual[key] - expected) < .00001, `${spec.key}/${key}`)
        else assert.equal(entry.actual[key], expected)
      }
      assert.equal(entry.sourcePreserved, true)
    }
    for (const key of ['nativeImport', 'saveReloadRestored', 'standaloneTikz', 'inlineTikz', 'unsupportedTextMetricsDiagnosed']) assert.equal(evidence[key], true, key)
  } else if (name === 'point-layout-async-combined-isolation') {
    assert.deepEqual(evidence.transitions.map(({ key }) => key), ['pending-wide', 'ready-wide', 'fallback', 'ready-tall', 'stale-load', 'undo', 'redo', 'stale-undo', 'font-before', 'font-loaded', 'font-restored'])
    for (const entry of evidence.transitions) {
      assertObservedPointPlacement(entry); assert.equal(entry.siblingsUnchanged, true)
      assert.equal(entry.rendered.state, entry.key === 'pending-wide' ? 'pending' : entry.key === 'fallback' || entry.key.startsWith('font-') ? 'fallback' : 'ready')
      if (entry.rendered.state === 'ready') assert.ok(entry.rendered.math > 0)
    }
    assert.equal(evidence.actualMathJax, true); assert.equal(evidence.historyUnchangedOnSettle, true)
    assert.equal(evidence.nativeFontChanged, true); assert.equal(evidence.nativeFontRestored, true)
    const before = evidence.transitions.find(({ key }) => key === 'font-before').literalObservation.lines[0].width
    const loaded = evidence.transitions.find(({ key }) => key === 'font-loaded').literalObservation.lines[0].width
    const restored = evidence.transitions.find(({ key }) => key === 'font-restored').literalObservation.lines[0].width
    assert.ok(Number.isFinite(before) && Number.isFinite(loaded) && Number.isFinite(restored))
    assert.notEqual(loaded, before); assert.equal(restored, before)
    assert.equal(evidence.ownedFace.ownedFacePresent, true)
    assert.equal(evidence.fontLifecycle.restored.restored.ownedFacePresent, false)
    assert.ok(evidence.fontLifecycle.restored.restored.previousFaces.every(({ present }) => present))
  } else if (name === signedPolygonalScenario) {
    assertSignedPolygonalZeroAxisEvidence(evidence)
  } else if (name === 'point-layout-native-interaction-2d-3d') {
    assert.equal(evidence.cases.length, 4)
    for (const ambientDimension of [2, 3]) for (const shape of ['rectangle', 'circular sector']) {
      const found = evidence.cases.filter((entry) => entry.ambientDimension === ambientDimension && entry.shape === shape)
      assert.equal(found.length, 1); assert.equal(found[0].codim, ambientDimension)
      const entry = found[0]
      assertPointNativeDragEvidence(entry.nativeDrag)
      assert.equal(entry.nativeDrag.id, 'overlap-point'); assert.equal(entry.nativeDrag.scenario, name)
      assert.deepEqual(entry.nativeDrag.displacement, { x: 22, y: -14 }); assert.equal(entry.nativeDrag.steps, 4)
      const before = JSON.parse(entry.nativeDrag.stateBefore.runtimeDiagramJson)
      const after = JSON.parse(entry.nativeDrag.afterAction.state.runtimeDiagramJson)
      assert.equal(before.ambientDimension, ambientDimension); assert.equal(after.ambientDimension, ambientDimension)
      assert.deepEqual(entry.before, before.strata.find(({ id }) => id === entry.nativeDrag.id))
      assert.deepEqual(entry.after, after.strata.find(({ id }) => id === entry.nativeDrag.id))
      assert.equal(entry.before.style.shape, shape)
      assert.deepEqual(entry.events, entry.nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag'))
      assertPointOwnerCycleEvidence(entry.ownerCycleStart, 'overlap-point', 'overlap-point')
      assertPointOwnerCycleEvidence(entry.ownerCycle, 'overlap-point', 'app-point')
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
        assert.deepEqual(entry.ownerCycle.stateBefore[field], entry.ownerCycleStart.stateAfter[field], `Owner-cycle continuation preserves ${field}`)
      }
      for (const key of ['trustedBoundaryClick', 'trustedDrag', 'anchorStayedAtModel', 'undoRestored', 'redoRestored', 'altCycling', 'lockedUnchanged', 'hiddenAbsent', 'cameraPlacement', 'referenceUnchanged']) assert.equal(found[0][key], true, key)
      const selection = found[0].observed.nativeSelection
      assertGeometricSelectionEvidence(selection, 'overlap-point')
      assert.equal(selection.scenario, name)
      assert.equal(selection.selected.id, selection.id)
      assert.deepEqual(selection.requestedClick, found[0].observed.boundary)
      for (const type of ['pointerdown', 'pointerup', 'click']) assert.ok(selection.events.some((event) => event.type === type && event.trusted === true))
      for (const type of ['pointerdown', 'pointermove']) assert.ok(found[0].events.some((event) => event.type === type && event.trusted === true))
      assert.ok(found[0].referenceCode.includes('at (LayoutReference)'))
    }
    assert.equal(evidence.bodyOverflowCases.length, 2)
    for (const ambientDimension of [2, 3]) {
      const found = evidence.bodyOverflowCases.filter((entry) => entry.ambientDimension === ambientDimension)
      assert.equal(found.length, 1)
      const entry = found[0]; assertObservedPointPlacement(entry)
      assert.equal(entry.shape, 'rectangle'); assert.equal(entry.anchor, 'base east'); assert.equal(entry.layout.innerXSep, -15)
      assert.equal(entry.diagramUnchanged, true)
      const { localBodyClick: click, characterBounds: ink, clickInContour: local, contourBounds: bounds, distance } = entry.rendered.bodyOverflow
      assert.ok(click.x >= ink.x && click.x <= ink.x + ink.width && click.y >= ink.y && click.y <= ink.y + ink.height)
      const measured = Math.max(bounds.x - local.x, local.x - bounds.x - bounds.width, bounds.y - local.y, local.y - bounds.y - bounds.height, 0)
      assert.ok(Number.isFinite(measured) && measured > 6); assert.equal(distance, measured)
      const ring = entry.rendered.bodyOverflow.selectionRing
      assert.ok(Number.isFinite(ring.radius) && Number.isFinite(ring.inkRadius) && ring.inkRadius > 6 && ring.radius >= ring.inkRadius)
      assert.deepEqual(entry.rendered.nativeSelection.requestedClick, entry.rendered.boundary)
      assertGeometricSelectionEvidence(entry.rendered.nativeSelection, 'overflow-overlap', 'body')
      assert.equal(entry.rendered.nativeSelection.scenario, name)
      assert.equal(entry.rendered.nativeSelection.selected.id, 'overflow-overlap'); assert.equal(entry.altSelection.id, 'app-point')
      assertPointOwnerCycleEvidence(entry.ownerCycleStart, 'overflow-overlap', 'overflow-overlap')
      assertPointOwnerCycleEvidence(entry.ownerCycle, 'overflow-overlap', 'app-point')
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
        assert.deepEqual(entry.ownerCycle.stateBefore[field], entry.ownerCycleStart.stateAfter[field], `Body owner-cycle continuation preserves ${field}`)
      }
      assert.deepEqual(entry.altSelection.events, entry.ownerCycle.events)
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        assert.ok(entry.rendered.nativeSelection.events.some((event) => event.type === type && event.trusted === true))
        assert.ok(entry.altSelection.events.some((event) => event.type === type && event.trusted === true && event.altKey === true))
      }
    }
    assert.equal(evidence.signedAnchorCases.length, signedAnchorCases.length)
    for (const spec of signedAnchorCases) {
      const found = evidence.signedAnchorCases.filter(({ key }) => key === spec.key)
      assert.equal(found.length, 1)
      const entry = found[0]; assertSignedCasePlacement(entry, spec)
      assert.deepEqual(entry.rendered.anchorOffset, { x: -96, y: 0 }, 'PGF east retains its signed fitted x axis')
      assert.ok(Math.abs(entry.rendered.placementOffset.x - 96) < .001 && Math.abs(entry.rendered.placementOffset.y) < .001,
        'Actual contour CTM placement offsets the signed east anchor')
      assert.equal(entry.rendered.contour.attributes.transform, 'translate(96 0)')
      assert.deepEqual(entry.rendered.bounds, { x: -96, y: -96, width: 192, height: 192 }, 'Signed anchors coexist with ordered absolute paint bounds')
    }
    assert.equal(evidence.signedPickingCases.length, signedPickingCases.length)
    for (const spec of signedPickingCases) {
      const found = evidence.signedPickingCases.filter(({ key }) => key === spec.key)
      assert.equal(found.length, 1)
      const entry = found[0]; assertSignedCasePlacement(entry, spec)
      assert.deepEqual(entry.rendered.anchorOffset, { x: 0, y: 0 })
      assert.ok(Math.abs(entry.rendered.placementOffset.x) < .001 && Math.abs(entry.rendered.placementOffset.y) < .001)
      assert.equal(entry.rendered.contour.tag, 'path')
      const path = entry.rendered.contour.attributes.d
      assert.equal(typeof path, 'string'); assert.match(path, /\bZ\s*$/)
      // SVG radius operands are magnitudes. Both negative PGF axes survive in
      // the left-hand start, ordered half-arc endpoints and Y-reflected sweep:
      // (-96,0) -> (0,96) -> (96,0) -> (0,-96) -> (-96,0).
      const commands = path.trim().split(/\s+/u).map((token) => /^[MAZ]$/u.test(token) ? token : Number(token))
      assert.deepEqual(commands,
        ['M', -96, 0, 'A', 96, 96, 0, 0, 0, 96, 0, 'A', 96, 96, 0, 0, 0, -96, 0, 'Z'],
        'Actual SVG uses positive radius magnitudes while retaining signed start, endpoints and traversal')
      assert.deepEqual(entry.rendered.bounds, { x: -96, y: -96, width: 192, height: 192 })
      const selection = entry.rendered.nativeSelection
      assertGeometricSelectionEvidence(selection, 'signed-overlap')
      assert.equal(selection.scenario, name); assert.equal(selection.selected.id, 'signed-overlap')
      assert.deepEqual(selection.requestedClick, entry.rendered.boundary)
      assertSignedCaseState(selection.stateBefore, spec, ['app-point', 'signed-overlap'])
      const contour = selection.before.geometry.contour, local = contour.localBoundary
      assert.equal(contour.fraction, .23)
      assert.deepEqual(contour.bounds, entry.rendered.contourScreenBounds, 'Fresh native input uses the current painted contour in screen coordinates')
      assert.ok((Math.abs(local.x) + Math.abs(local.y) - 96) / Math.SQRT2 > 6,
        'The native oblique click lies beyond the old four-cardinal picking contour and six-unit tolerance')
      assertPointOwnerCycleEvidence(entry.ownerCycleStart, 'signed-overlap', 'signed-overlap')
      assertPointOwnerCycleEvidence(entry.ownerCycle, 'signed-overlap', 'app-point')
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
        assert.deepEqual(entry.ownerCycle.stateBefore[field], entry.ownerCycleStart.stateAfter[field], `Signed owner-cycle continuation preserves ${field}`)
      }
      for (const cycle of [entry.ownerCycleStart, entry.ownerCycle]) {
        assertSignedCaseState(cycle.stateBefore, spec, ['app-point', 'signed-overlap'])
        assertSignedCaseState(cycle.stateAfter, spec, ['app-point', 'signed-overlap'])
        const local = cycle.before.geometry.contour.localBoundary
        assert.equal(cycle.before.geometry.contour.fraction, .23)
        assert.deepEqual(cycle.before.geometry.contour.bounds, cycle.rendered.contourScreenBounds,
          'Each owner cycle measures its current painted contour in screen coordinates')
        assert.ok((Math.abs(local.x) + Math.abs(local.y) - 96) / Math.SQRT2 > 6)
      }
    }
  } else {
    assert.ok(name.startsWith('point-layout-pending-'))
    assert.equal(evidence.background, name.includes('transparent') ? 'transparent' : 'white')
    for (const key of ['actualDownload', 'capturedPending', 'reopened', 'immutableSource', 'immutableLayout', 'immutablePlacement', 'settledContour', 'combinedLabels', 'noExternalAssets']) assert.equal(evidence[key], true, key)
    assert.equal(evidence.capture?.status, 'saved', 'Terminal layout download requires a completed capture')
    assert.equal(evidence.expected.length, layoutShapes.length)
    assert.equal(evidence.click.error, undefined)
    assert.equal(evidence.click.snapshot.points.length, layoutShapes.length)
    assert.ok(evidence.pendingPreparation, 'Terminal pending download retains its native selection preparation')
    assert.equal(evidence.pendingPreparation.source, `captured ${evidence.background} $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$`,
      'Pending preparation retains the complete declared captured source')
    assertPendingLayoutFixture(evidence.pendingPreparation?.fixture, evidence.pendingPreparation?.source, layoutShapes, layoutShapeParameters)
    assertPendingLayoutPreparation(evidence.pendingPreparation)
    assert.equal(evidence.pendingPreparation.result, 'passed', 'Terminal pending download requires accepted complete native preparation')
    assert.equal(evidence.pendingPreparation.scenario, name, 'Native pending preparation belongs to this download scenario')
    assertPendingLayoutClickContinuation(evidence.pendingPreparation, evidence.click, evidence.beforeExportClick)
    if (evidence.background === 'transparent') {
      assert.ok(evidence.postClickView, 'Transparent pending download requires actual post-click 2D view observations')
      assert.equal(evidence.postClickView.scenario, name, 'Post-click 2D view observations belong to this pending download')
      assert.equal(evidence.postClickView.source, evidence.pendingPreparation.source, 'Post-click view evidence retains the original held captured source')
      assert.equal(evidence.postClickView.result, 'passed', 'Transparent pending download requires accepted native control and geometry proof')
      assertPendingLayoutViewEvidence(evidence.postClickView, evidence.click)
    }
    const release = evidence.capturedRelease
    assert.equal(release?.source, evidence.pendingPreparation.source, 'The intended post-click boundary releases the captured source')
    if (evidence.background === 'transparent') assert.deepEqual(release.before, evidence.postClickView.cleanup.observation.hold,
      'The captured source stays held through view restoration until the intended release')
    assert.ok(Number.isInteger(release.before?.started) && release.before.started > 0)
    assert.equal(release.before.completed, 0); assert.equal(release.before.released, false)
    assert.equal(release.result?.source, release.source)
    assert.equal(release.result.started, release.before.started); assert.equal(release.result.completed, release.before.started)
    assert.equal(release.result.fail, false); assert.equal(release.after, null, 'The captured hold is removed only at the intended release boundary')
    const ids = layoutShapes.map((shape) => `layout-${shape.replaceAll(' ', '-')}`)
    assert.deepEqual(evidence.expected.map(({ id }) => id), ids, 'Settled expectations retain all fifteen declared owners in order')
    assert.deepEqual(evidence.click.snapshot.points.map(({ id }) => id), ids, 'Click snapshots retain the captured circle at index zero and every sibling')
    for (const shape of layoutShapes) {
      const found = evidence.expected.filter((entry) => entry.shape === shape)
      assert.equal(found.length, 1); assertObservedPointPlacement(found[0]); assert.equal(found[0].rendered.state, 'ready')
      assert.ok(found[0].rendered.math > 0)
      const captured = evidence.click.snapshot.points.find(({ id }) => id === found[0].id)
      assert.equal(captured.source, found[0].source, 'Settled comparison retains the exact click-time source')
      assert.equal(captured.style.shape, found[0].shape)
      assert.deepEqual(captured.style.layout, found[0].layout, 'Settled comparison retains the exact click-time layout')
      assert.equal(captured.nodeTransform, found[0].rendered.nodeTransform, 'Settled comparison preserves immutable model placement')
    }
  }
}

function assertCurrentEmptyPoint(state, id, ambientDimension, shape, layout, position) {
  assert.ok(Number.isInteger(state.labelDocumentRevision) && state.labelDocumentRevision >= 0)
  const saved = JSON.parse(state.json), runtime = JSON.parse(state.runtimeDiagramJson), history = JSON.parse(state.history)
  assert.equal(saved.version, 2)
  for (const diagram of [saved.diagram, runtime, history.present]) {
    assert.equal(diagram.ambientDimension, ambientDimension)
    const point = diagram.strata.find((entry) => entry.id === id)
    assert.equal(point.geometricKind, 'point'); assert.equal(point.codim, ambientDimension)
    assert.equal(point.text ?? '', ''); assert.equal(point.style.shape, shape)
    assert.deepEqual(point.style.layout, layout)
    assert.deepEqual(point.position, position)
    if (ambientDimension === 2) assert.equal(point.position.z, 0)
  }
}
function assertPolygonalPlacement(entry, spec) {
  assertObservedPointPlacement(entry)
  assert.equal(entry.key, spec.key); assert.equal(entry.source, '')
  assert.equal(entry.shape, spec.shape); assert.equal(entry.anchor, spec.anchor)
  assert.deepEqual(entry.layout, spec.layout); assert.equal(entry.rendered.bodyUpright, true)
  for (const field of layoutFieldKeys) assert.equal(entry.rendered.layout[field], spec.layout[field])
  for (const axis of ['x', 'y']) {
    const expected = spec.expectedTeXpt[axis] * 1.2
    assert.ok(Math.abs(entry.rendered.anchorOffset[axis] - expected) <= .025 * 1.2,
      `${spec.shape} selected ${spec.anchor} preserves the signed PGF fitting/clearance`)
    assert.ok(Math.abs(entry.rendered.placementOffset[axis] + entry.rendered.anchorOffset[axis]) < .001,
      'Actual contour CTM applies the selected PGF anchor translation')
  }
}
export function assertZeroAxisTraversal(rendered) {
  assert.equal(rendered.contour.tag, 'path'); assert.equal(rendered.contour.attributes.fill, 'none')
  assert.equal(rendered.shape, 'ellipse'); assert.equal(rendered.source, ''); assert.equal(rendered.state, 'ready')
  assert.deepEqual(rendered.anchorOffset, { x: 0, y: 0 })
  assert.ok(Math.abs(rendered.contourLength - 4 * zeroAxisHalfExtent) < .005,
    'Native SVG arclength retains the full retraced ellipse traversal')
  assert.ok(!/\bA\s/u.test(rendered.contour.attributes.d), 'Zero-axis contour uses actual traversed paths')
  assert.match(rendered.contour.attributes.d, /\bZ\s*$/u)
  assert.equal(rendered.contour.attributes['stroke-width'], '0.48')
  assert.equal(rendered.contour.attributes.stroke, '#B000C0')
  assert.equal(rendered.contour.attributes['stroke-linecap'], 'butt')
  assert.equal(rendered.contour.attributes['stroke-linejoin'], 'miter')
  assert.equal(rendered.contour.attributes['stroke-dashoffset'], '0')
  assert.equal(rendered.bounds.width, 0)
  assert.ok(Math.abs(rendered.bounds.y + zeroAxisHalfExtent) < .005 && Math.abs(rendered.bounds.height - 2 * zeroAxisHalfExtent) < .005)
  assert.equal(rendered.nativeTraversal.length, 5)
  for (const [index, y] of [0, -zeroAxisHalfExtent, 0, zeroAxisHalfExtent, 0].entries()) {
    assert.ok(Math.abs(rendered.nativeTraversal[index].x) < .005 && Math.abs(rendered.nativeTraversal[index].y - y) < .005,
      'Native SVG traversal retains center, upper extremum, center, lower extremum, center in order')
  }
}
// Inspect retained real screenshot bytes. The magenta border distinguishes the
// narrow stroke from the App's grid, blue selection decoration and white fill.
// Raster uncertainty is one pixel cell; geometry and picking tolerances do not
// change. Replayed bounds must reach both independently known PGF extrema.
export function observeZeroAxisPixels(png, ctm) {
  const { width, height, rgba } = decodeConnectedPaintPng(png)
  assert.ok(Object.values(ctm).every(Number.isFinite))
  const determinant = ctm.a * ctm.d - ctm.b * ctm.c
  assert.ok(Math.abs(determinant) > 1e-12)
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  let pixels = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4, r = rgba[at], g = rgba[at + 1], b = rgba[at + 2]
    if (!(r - g > 8 && b - g > 8 && rgba[at + 3] > 0)) continue
    const dx = x + .5 - ctm.e, dy = y + .5 - ctm.f
    const local = { x: (ctm.d * dx - ctm.c * dy) / determinant, y: (-ctm.b * dx + ctm.a * dy) / determinant }
    if (Math.abs(local.x) > 2 || Math.abs(local.y) > zeroAxisHalfExtent + 2) continue
    pixels++
    for (const axis of ['X', 'Y']) {
      const value = local[axis.toLowerCase()]
      bounds[`min${axis}`] = Math.min(bounds[`min${axis}`], value)
      bounds[`max${axis}`] = Math.max(bounds[`max${axis}`], value)
    }
  }
  return { method: 'actual-native-PNG-magenta-stroke-pixel-centers', sha256: createHash('sha256').update(png).digest('hex'),
    bytes: png.length, width, height, ctm: { ...ctm }, pixels, bounds: pixels ? bounds : null }
}
export function assertZeroAxisPixelEvidence(pixels) {
  assert.equal(pixels.method, 'actual-native-PNG-magenta-stroke-pixel-centers')
  assert.match(pixels.sha256, /^[a-f0-9]{64}$/u); assert.ok(pixels.bytes > 57 && pixels.pixels > 0)
  const scale = Math.min(Math.hypot(pixels.ctm.a, pixels.ctm.b), Math.hypot(pixels.ctm.c, pixels.ctm.d))
  const pixelCell = 1.5 / scale
  assert.ok(pixels.bounds.minY <= -zeroAxisHalfExtent + pixelCell && pixels.bounds.maxY >= zeroAxisHalfExtent - pixelCell,
    'Actual native raster visibly reaches both zero-axis PGF stroke extrema')
  assert.ok(Math.abs(pixels.bounds.minX) <= .24 + pixelCell && Math.abs(pixels.bounds.maxX) <= .24 + pixelCell)
}
// Outside input is owned only by the currently connected canvas itself or its
// unique production background, never by an arbitrary SVG descendant.
function assertCurrentCanvasObservation(observation) {
  assert.equal(observation.rootCount, 1); assert.equal(observation.backgroundCount, 1)
  const root = observation.root, background = observation.background
  for (const target of [root, background]) {
    assert.equal(target.connected, true); assert.equal(target.svg, true); assert.equal(target.canvas, true)
    assert.equal(target.currentCanvas, true); assert.equal(target.pointId, null)
    for (const flag of ['drawer', 'pointHandle', 'creationToolbar', 'toolbarOverlay', 'quickStyle', 'history']) assert.equal(target[flag], false)
  }
  assert.ok(typeof root.class === 'string' && root.class.split(/\s+/u).includes('svg-diagram'))
  assert.equal(root.tag, 'svg'); assert.equal(root.canvasRoot, true); assert.equal(root.currentCanvasRoot, true)
  assert.equal(root.canvasDirectChild, false); assert.equal(root.svgBackground, false)
  assert.equal(root.svgBackgroundAttribute, null, 'Current root retains its actual absent background marker')
  assert.equal(background.tag, 'rect'); assert.equal(background.canvasRoot, false); assert.equal(background.currentCanvasRoot, false)
  assert.equal(background.canvasDirectChild, true); assert.equal(background.svgBackgroundAttribute, 'true'); assert.equal(background.svgBackground, true)
}
function assertCurrentCanvasPath(target, path, observation) {
  assertCurrentCanvasObservation(observation)
  assert.ok(Array.isArray(path)); assert.deepEqual(path[0], target, 'Hit stack / composed path begins at the actual observed target')
  const roots = path.filter((element) => element?.canvasRoot === true)
  assert.equal(roots.length, 1); assert.deepEqual(roots[0], observation.root, 'Input path reaches the unique actual current canvas root')
  assert.equal(target.connected, true); assert.equal(target.svg, true); assert.equal(target.canvas, true); assert.equal(target.currentCanvas, true)
  for (const flag of ['drawer', 'pointHandle', 'creationToolbar', 'toolbarOverlay', 'quickStyle', 'history']) assert.equal(target[flag], false)
}
function assertOutsideCanvasTarget(target, path, observation) {
  assertCurrentCanvasPath(target, path, observation)
  assert.equal(target.pointId, null)
  if (target.currentCanvasRoot === true) assert.deepEqual(target, observation.root)
  else {
    assert.equal(target.tag, 'rect'); assert.equal(target.canvasRoot, false); assert.equal(target.canvasDirectChild, true)
    assert.equal(target.svgBackgroundAttribute, 'true', 'Background branch retains the exact raw production marker')
    assert.equal(target.svgBackground, true); assert.deepEqual(target, observation.background)
  }
}
function assertInvertibleZeroAxisMatrix(matrix) {
  assert.ok(matrix && ['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(matrix[key])))
  assert.ok(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12)
}
function assertCurrentCoincidentZeroAxisContours(snapshot, state) {
  const runtime = JSON.parse(state.runtimeDiagramJson), ids = ['app-point', 'zero-overlap']
  assert.deepEqual(snapshot.coincidentContours.map(({ id }) => id), ids)
  const position = { x: 3, y: 3, z: runtime.ambientDimension === 3 ? .5 : 0 }
  for (const entry of snapshot.coincidentContours) {
    assertCurrentEmptyPoint(state, entry.id, runtime.ambientDimension, 'ellipse', zeroAxisLayout, position)
    assert.equal(entry.count, 1); assert.equal(entry.currentCanvas, true)
    assert.deepEqual(JSON.parse(entry.owner), ['point-node', state.labelDocumentRevision, entry.id])
    assert.ok(entry.request); assert.equal(entry.request, entry.bodyRequest); assert.equal(entry.source, '')
    assert.equal(entry.state, 'ready'); assert.equal(entry.shape, 'ellipse'); assert.deepEqual(entry.layout, { ...zeroAxisLayout, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } })
    assert.deepEqual(JSON.parse(entry.parameters), JSON.parse(snapshot.layout.parameters))
    assert.equal(entry.contour.connected, true)
    assertInvertibleZeroAxisMatrix(entry.pointScreenCTM)
    for (const key of ['CTM', 'screenCTM']) assertInvertibleZeroAxisMatrix(entry.contour[key])
    assert.deepEqual(entry.pointScreenCTM, snapshot.geometry.point.screenCTM)
    assert.deepEqual(entry.contour.screenCTM, snapshot.geometry.contour.screenCTM)
    assert.deepEqual(entry.contour.CTM, snapshot.geometry.contour.CTM)
    assert.equal(entry.contour.bounds.x, 0)
    assertZeroAxisTraversal({ shape: entry.shape, source: entry.source, state: entry.state, anchorOffset: { x: 0, y: 0 },
      contour: { tag: entry.contour.tag, attributes: entry.contour.attributes }, bounds: entry.contour.bounds,
      contourLength: entry.contour.length, nativeTraversal: entry.contour.traversal })
    const point = runtime.strata.find(({ id }) => id === entry.id)
    assert.equal(point.style.paint.fill.enabled, false)
    assert.deepEqual(point.style.paint.stroke, { enabled: true, color: '#B000C0', opacity: 1, width: .4,
      lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' })
    if (entry.id === 'zero-overlap') {
      for (const key of ['owner', 'request', 'bodyRequest', 'source', 'state', 'shape', 'parameters']) assert.equal(entry[key], snapshot.layout[key])
    }
  }
  assert.deepEqual(snapshot.coincidentContours[0].contour, snapshot.coincidentContours[1].contour,
    'Both current independently observed contours remain the intended coincident fixture')
}
export function assertFreshZeroAxisAction(action) {
  const snapshot = action.before, state = action.stateBefore
  assert.ok(['outside-clear', 'ordinary-axis', 'alt-start', 'alt-next', 'outside-final'].includes(action.key))
  const inside = !action.key.startsWith('outside-')
  assert.deepEqual(action.local, { x: inside ? 0 : 12, y: 20 })
  assert.equal(action.altKey, action.key === 'alt-start' || action.key === 'alt-next')
  assert.deepEqual(snapshot.errors, [])
  assert.equal(snapshot.labelDocumentRevision, state.labelDocumentRevision)
  assert.deepEqual(snapshot.selection, state.selection)
  const runtime = JSON.parse(state.runtimeDiagramJson), point = runtime.strata.find(({ id }) => id === 'zero-overlap')
  assert.deepEqual(snapshot.model, point); assert.deepEqual(snapshot.camera, runtime.camera ?? null)
  assert.equal(snapshot.layout.shape, 'ellipse'); assert.equal(snapshot.layout.state, 'ready'); assert.equal(snapshot.layout.source, '')
  assert.deepEqual(JSON.parse(snapshot.layout.owner), ['point-node', state.labelDocumentRevision, 'zero-overlap'])
  assert.ok(snapshot.layout.request); assert.equal(snapshot.layout.request, snapshot.layout.bodyRequest)
  assert.ok(Array.isArray(snapshot.workPlaneControls) && Array.isArray(snapshot.workPlaneStatus))
  const parameters = JSON.parse(snapshot.layout.parameters)
  assert.equal(parameters.borderRotate, 0)
  for (const kind of ['canvas', 'point', 'contour']) {
    const geometry = snapshot.geometry[kind]
    assert.equal(geometry.connected, true); assert.equal(geometry.currentCanvas, true)
    assertInvertibleZeroAxisMatrix(geometry.screenCTM); assertInvertibleZeroAxisMatrix(geometry.CTM)
  }
  assertCurrentCoincidentZeroAxisContours(snapshot, state)
  assert.deepEqual(snapshot.requestedClick, action.click)
  const matrix = snapshot.geometry.contour.screenCTM
  const expected = { x: matrix.a * action.local.x + matrix.c * action.local.y + matrix.e,
    y: matrix.b * action.local.x + matrix.d * action.local.y + matrix.f }
  for (const axis of ['x', 'y']) assert.ok(Math.abs(expected[axis] - action.click[axis]) < 1e-7)
  assert.equal(snapshot.inspector.open, false)
  const target = snapshot.elementFromPoint
  assertCurrentCanvasPath(target, snapshot.elementsFromPoint, snapshot.canvasObservation)
  if (inside) {
    assert.equal(target.tag, 'path'); assert.equal(target.pointId, 'zero-overlap')
  } else {
    assertOutsideCanvasTarget(target, snapshot.elementsFromPoint, snapshot.canvasObservation)
    for (const entry of snapshot.coincidentContours) assert.ok(action.local.x - entry.contour.bounds.x
      - entry.contour.bounds.width - Number(entry.contour.attributes['stroke-width']) / 2 > 6,
    'Fixed outside input exceeds every current coincident contour and unchanged six-unit picking tolerance')
  }
}
export function assertZeroAxisNativeAction(action) {
  const inside = !action.key.startsWith('outside-')
  assertFreshZeroAxisAction(action)
  assertFreshZeroAxisAction({ ...action, before: action.after, stateBefore: action.stateAfter })
  assert.deepEqual(action.after.errors, [])
  assert.deepEqual(action.after.layout, action.before.layout)
  assert.deepEqual(action.after.canvasObservation, action.before.canvasObservation)
  assert.deepEqual(action.after.coincidentContours, action.before.coincidentContours)
  for (const kind of ['canvas', 'point', 'contour']) for (const matrix of ['CTM', 'screenCTM']) {
    assert.deepEqual(action.after.geometry[kind][matrix], action.before.geometry[kind][matrix])
  }
  assert.equal(action.before.inspector.open, false)
  assert.equal(action.before.tool.selectPressed, action.before.toolbar.collapsed ? null : 'true')
  assert.equal(action.before.geometry.contour.connected, true)
  assert.ok(Math.abs(action.before.geometry.contour.length - 4 * zeroAxisHalfExtent) < .005)
  assert.deepEqual(action.before.requestedClick, action.click)
  const matrix = action.before.geometry.contour.screenCTM
  for (const axis of ['x', 'y']) {
    const expected = axis === 'x' ? matrix.a * action.local.x + matrix.c * action.local.y + matrix.e
      : matrix.b * action.local.x + matrix.d * action.local.y + matrix.f
    assert.ok(Math.abs(action.click[axis] - expected) < 1e-7)
  }
  const actualSelection = action.stateAfter.selection
  assert.equal(actualSelection?.id ?? null, { 'outside-clear': null, 'ordinary-axis': 'zero-overlap', 'alt-start': 'zero-overlap', 'alt-next': 'app-point', 'outside-final': null }[action.key], 'Actual trusted native input selects/cycles only the current axis owner')
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings']) {
    assert.deepEqual(action.stateAfter[field], action.stateBefore[field], `Native zero-axis input preserves ${field}`)
  }
  for (const [snapshot, state] of [[action.before, action.stateBefore], [action.after, action.stateAfter]]) {
    assert.equal(snapshot.labelDocumentRevision, state.labelDocumentRevision)
    assert.deepEqual(snapshot.selection, state.selection)
    assert.deepEqual(JSON.parse(snapshot.layout.owner), ['point-node', action.stateBefore.labelDocumentRevision, 'zero-overlap'])
    assert.equal(snapshot.layout.request, snapshot.layout.bodyRequest); assert.equal(snapshot.layout.source, '')
    assert.deepEqual(snapshot.model, JSON.parse(action.stateBefore.runtimeDiagramJson).strata.find(({ id }) => id === 'zero-overlap'))
  }
  assert.equal(action.events.length, 3); assert.equal(action.droppedEvents, 0)
  let pointerId
  for (const [eventIndex, type] of ['pointerdown', 'pointerup', 'click'].entries()) {
    const event = action.events[eventIndex]
    assert.equal(event.type, type); assert.equal(event.trusted, true); assert.equal(event.altKey, action.altKey)
    assert.equal(event.button, 0); assert.equal(event.buttons, type === 'pointerdown' ? 1 : 0)
    if (type === 'pointerdown') { pointerId = event.pointerId; assert.ok(Number.isInteger(pointerId)); assert.deepEqual(event.selection, action.stateBefore.selection) }
    else assert.ok(event.pointerId === pointerId || (type === 'click' && event.pointerId === null))
    assert.equal(event.labelDocumentRevision, action.stateBefore.labelDocumentRevision)
    assert.equal(event.layout.owner, action.before.layout.owner); assert.equal(event.layout.request, action.before.layout.request)
    assert.equal(event.layout.source, ''); assert.equal(event.layout.shape, 'ellipse'); assert.equal(event.layout.state, 'ready')
    assert.equal(event.layout.bodyRequest, action.before.layout.bodyRequest)
    assert.deepEqual(event.canvasObservation, action.before.canvasObservation)
    assertCurrentCanvasPath(event.target, event.path, event.canvasObservation)
    assert.equal(typeof event.canvasHasPointerCapture, 'boolean')
    if (!inside) assertOutsideCanvasTarget(event.target, event.path, event.canvasObservation)
    if (type === 'pointerdown') assert.deepEqual(event.target, action.before.elementFromPoint, 'Trusted pointerdown reaches the freshly observed hit-stack owner')
    if (inside) {
      assert.equal(event.target.tag, 'path'); assert.equal(event.target.pointId, 'zero-overlap', 'Native axis input reaches the actual visible stroke')
      assert.equal(event.canvasHasPointerCapture, false)
    } else if (type === 'pointerdown' || type === 'click') assert.equal(event.canvasHasPointerCapture, false)
    if (!inside && type === 'pointerup') {
      assert.equal(event.canvasHasPointerCapture, action.before.elementFromPoint.svgBackground)
      if (event.canvasHasPointerCapture) assert.deepEqual(event.target, action.before.canvasObservation.root)
    }
    for (const axis of ['x', 'y']) {
      if (type === 'click') assert.equal(event.client[axis], Math.trunc(action.click[axis]), 'Native click preserves browser integer coordinate propagation')
      else assert.equal(event.client[axis], Math.fround(action.click[axis]), 'Native pointer input preserves precise browser binary32 coordinate propagation')
    }
  }
}
function assertZeroAxisNativeCase(entry, ambientDimension) {
  assert.equal(entry.ambientDimension, ambientDimension)
  assert.deepEqual(entry.layout, zeroAxisLayout); assertZeroAxisTraversal(entry.rendered)
  const ids = ['app-point', 'zero-overlap'], position = { x: 3, y: 3, z: ambientDimension === 3 ? .5 : 0 }
  assertCurrentEmptyPoint(entry.state, 'app-point', ambientDimension, 'ellipse', zeroAxisLayout, position)
  assertCurrentEmptyPoint(entry.state, 'zero-overlap', ambientDimension, 'ellipse', zeroAxisLayout, position)
  const nativePoint = JSON.parse(entry.state.runtimeDiagramJson).strata.find(({ id }) => id === 'zero-overlap')
  assert.equal(nativePoint.style.paint.fill.enabled, false)
  assert.deepEqual(nativePoint.style.paint.stroke, { enabled: true, color: '#B000C0', opacity: 1, width: .4,
    lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' })
  assertGeometricSelectionEvidence(entry.rendered.nativeSelection, 'zero-overlap')
  assert.equal(entry.rendered.nativeSelection.scenario, signedPolygonalScenario)
  const workflow = entry.axisInteraction
  assert.equal(workflow.result, 'observed'); assert.equal(workflow.primary, undefined); assert.deepEqual(workflow.secondaryErrors, [])
  assert.deepEqual(workflow.cleanup, { altKeyUp: 'completed', observer: { tokenPresent: false, registryPresent: false, remaining: 0 } })
  assertPointCanvasPreparation(workflow.preparation, 'zero-overlap')
  assertPointToolbarPreparation(workflow.toolbarPreparation, workflow.toolbarRestoration, 'zero-overlap')
  assert.deepEqual(workflow.actions.map(({ key }) => key), ['outside-clear', 'ordinary-axis', 'alt-start', 'alt-next', 'outside-final'])
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) assert.deepEqual(workflow.preparation.stateBefore[field], entry.state[field])
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
    assert.deepEqual(workflow.actions[0].stateBefore[field], workflow.toolbarPreparation.statePrepared[field], 'First input continues the owned native preparation')
    assert.deepEqual(workflow.toolbarRestoration.stateBefore[field], workflow.actions.at(-1).stateAfter[field], 'Owned restoration follows the final native input')
  }
  for (const [index, action] of workflow.actions.entries()) {
    const inside = index > 0 && index < 4, local = inside ? { x: 0, y: 20 } : { x: 12, y: 20 }
    assert.deepEqual(action.local, local); assert.equal(action.altKey, index === 2 || index === 3)
    assertZeroAxisNativeAction(action)
    if (index) {
      const previous = workflow.actions[index - 1]
      assert.deepEqual(action.before.layout, previous.after.layout)
      assert.deepEqual(action.before.canvasObservation, previous.after.canvasObservation)
      assert.deepEqual(action.before.coincidentContours, previous.after.coincidentContours)
      for (const kind of ['canvas', 'point', 'contour']) for (const matrix of ['CTM', 'screenCTM']) assert.deepEqual(action.before.geometry[kind][matrix], previous.after.geometry[kind][matrix])
    }
    if (index) for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision', 'uiSettings']) {
      assert.deepEqual(action.stateBefore[field], workflow.actions[index - 1].stateAfter[field])
    }
    if (!inside) assert.ok(local.x - Number(entry.rendered.contour.attributes['stroke-width']) / 2 > 6,
      'Native outside point exceeds the unchanged six-unit picking tolerance')
    for (const id of ids) assertCurrentEmptyPoint(action.stateBefore, id, ambientDimension, 'ellipse', zeroAxisLayout, position)
  }
  const live = entry.liveObservation
  assert.ok(live, 'Actual live paint capture retains a separate lifecycle after completed interaction restoration')
  assertZeroAxisLiveCapture(live, workflow, entry.livePaint)
  for (const [state, snapshot] of [[live.capture.inheritedState, live.capture.inherited], [live.state, live.snapshot],
    [live.afterState, live.afterSnapshot], [live.capture.restoration.stateAfter, live.capture.restoration.after]]) {
    assertCurrentCoincidentZeroAxisContours(snapshot, state)
    assert.deepEqual(snapshot.layout, workflow.actions.at(-1).after.layout, 'Every capture boundary keeps the authenticated native owner/source/request')
  }
  assert.deepEqual(live.pixels, entry.livePaint, 'Live lifecycle retains the exact inspected image evidence')
  assertZeroAxisPixelEvidence(entry.livePaint)
}
export function assertSignedPolygonalZeroAxisEvidence(evidence) {
  assert.equal(evidence.polygonalCases.length, signedPolygonalCases.length * 2)
  for (const ambientDimension of [2, 3]) for (const spec of signedPolygonalCases) {
    const found = evidence.polygonalCases.filter((entry) => entry.ambientDimension === ambientDimension && entry.key === spec.key)
    assert.equal(found.length, 1)
    const entry = found[0]; assertPolygonalPlacement(entry, spec)
    assertCurrentEmptyPoint(entry.state, 'app-point', ambientDimension, spec.shape, spec.layout,
      { x: 3, y: 3, z: ambientDimension === 3 ? .5 : 0 })
    assertGeometricSelectionEvidence(entry.rendered.nativeSelection, 'app-point')
    assert.equal(entry.rendered.nativeSelection.scenario, signedPolygonalScenario)
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings']) {
      assert.deepEqual(entry.state[field], entry.rendered.nativeSelection.stateAfter[field], 'Actual polygon placement and native selected owner share current model/source/revision')
    }
  }
  assert.equal(evidence.zeroAxisCases.length, 2); assert.equal(evidence.downloads.length, 2)
  for (const ambientDimension of [2, 3]) {
    const entries = evidence.zeroAxisCases.filter((entry) => entry.ambientDimension === ambientDimension)
    assert.equal(entries.length, 1); assertZeroAxisNativeCase(entries[0], ambientDimension)
    const downloads = evidence.downloads.filter((entry) => entry.ambientDimension === ambientDimension)
    assert.equal(downloads.length, 1)
    const download = downloads[0]
    assert.equal(download.scenario, `${signedPolygonalScenario}-${ambientDimension}d`)
    assert.equal(download.group, layoutAnchorGroup); assert.equal(download.background, 'transparent')
    assert.equal(download.expected.length, signedPolygonalCases.length + 1)
    assert.equal(download.capture.status, 'saved')
    assert.equal(download.click.snapshot.points.length, download.expected.length)
    assert.equal(download.click.error, undefined)
    const beforeExportState = download.beforeExportState, snapshot = download.click.snapshot
    assert.ok(beforeExportState)
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'uiSettings']) assert.deepEqual(snapshot[field], beforeExportState[field])
    assert.equal(snapshot.runtime.documentRevision, beforeExportState.labelDocumentRevision)
    assert.equal(snapshot.documentUnchanged, true)
    assert.deepEqual(snapshot.exportBackground, { count: 1, tag: 'select', ariaLabel: 'SVG export background', value: 'transparent' })
    const saved = JSON.parse(download.savedJson), capturedModel = JSON.parse(snapshot.json).diagram,
      runtime = JSON.parse(snapshot.runtimeDiagramJson), history = JSON.parse(snapshot.history).present
    assert.equal(saved.version, 2)
    for (const diagram of [capturedModel, runtime, history]) {
      assert.equal(diagram.ambientDimension, ambientDimension)
      assert.deepEqual(diagram.strata, saved.diagram.strata)
      assert.deepEqual(diagram.labels, saved.diagram.labels)
    }
    assert.deepEqual(snapshot.camera, capturedModel.camera)

    for (const [index, expected] of download.expected.entries()) {
      assertObservedPointPlacement(expected)
      const captured = download.click.snapshot.points[index]
      assert.equal(captured.id, expected.id); assert.equal(captured.source, '')
      assert.equal(captured.status, 'ready'); assert.equal(captured.style.shape, expected.shape)
      assert.deepEqual(captured.style.layout, expected.layout)
      assert.equal(captured.nodeTransform, expected.rendered.nodeTransform)
      const modelPoint = saved.diagram.strata[index]
      assert.equal(modelPoint.id, expected.id); assert.deepEqual(expected.modelPoint, modelPoint)
      const expectedPosition = { x: index < signedPolygonalCases.length ? 1 + index % 3 * 2 : 7,
        y: index < signedPolygonalCases.length ? 1 + Math.floor(index / 3) * 2 : 3, z: ambientDimension === 3 ? .5 : 0 }
      assert.deepEqual(modelPoint.position, expectedPosition)
      assert.deepEqual(captured.position, modelPoint.position); assert.deepEqual(captured.style, modelPoint.style)
      assert.equal(captured.modelSource, '')
      assert.deepEqual(JSON.parse(captured.owner), ['point-node', beforeExportState.labelDocumentRevision, expected.id])
      assert.equal(captured.owner, expected.rendered.pointOwner)
      assert.equal(captured.request, expected.rendered.bodyRequest); assert.equal(captured.pointRequest, expected.rendered.pointRequest)
      assert.equal(captured.request, captured.pointRequest); assert.deepEqual(captured.runtime, snapshot.runtime)
      assert.equal(captured.held, null)

      if (index < signedPolygonalCases.length) assertPolygonalPlacement(expected, signedPolygonalCases[index])
      else assertZeroAxisTraversal(expected.rendered)
    }
    assertZeroAxisPixelEvidence(download.strokePixels)
  }
}
export function assertSignedPolygonalStandaloneEvidence(evidence, raw, artifactDir, ambientDimension, { checkout } = {}) {
  assertLayoutAnchorEvidence(evidence, signedPolygonalScenario)
  const download = evidence.downloads.find((entry) => entry.ambientDimension === ambientDimension)
  const stem = `${signedPolygonalScenario}-${ambientDimension}d`
  const xml = assertStandaloneReopeningRecord(raw, download, artifactDir)
  assert.equal(raw.xml, xml)
  assert.equal(raw.savedJson, download.savedJson)
  assert.equal(raw.ambientDimension, ambientDimension)
  assert.deepEqual(raw.capture, download.capture)
  assert.deepEqual(raw.outputs, download.outputs)
  assert.deepEqual(raw.beforeExportState, download.beforeExportState)
  assert.deepEqual(raw.preExport, download.preExport)
  assert.equal(readFileSync(resolve(artifactDir, `${stem}-saved.json`), 'utf8'), download.savedJson)
  for (const mode of ['standalone', 'inlineMath']) {
    assert.equal(readFileSync(resolve(artifactDir, `${stem}-${mode}.tex`), 'utf8'), raw.outputs[mode])
    for (const anchor of signedPolygonalCases.map(({ anchor }) => anchor)) assert.ok(raw.outputs[mode].includes(`anchor=${anchor}`))
    assert.ok(raw.outputs[mode].includes('inner xsep=0pt') && raw.outputs[mode].includes('inner ysep=20pt'))
  }
  const binding = assertSignedPointStandaloneAssociation(raw, xml)
  assertSignedPointStandaloneGeometry(raw, binding)
  validateStandaloneSvgCaptureEvidence(raw.capture, { svgPath: raw.svgPath,
    pngPath: resolve(artifactDir, `${stem}.png`), root: raw.document.root })
  assert.deepEqual(raw.strokePixels, download.strokePixels)
  assert.deepEqual(observeZeroAxisPixels(readFileSync(resolve(artifactDir, `${stem}.png`)), binding.zeroAxis.screenCTM), raw.strokePixels)
  const native = readEvidenceDocumentSync(artifactDir, `${stem}-native.json`, { checkout })
  assert.equal(native.scenario, signedPolygonalScenario); assert.equal(native.group, layoutAnchorGroup); assert.equal(native.result, 'observed')
  assert.deepEqual(native.polygonalCases, evidence.polygonalCases.filter((entry) => entry.ambientDimension === ambientDimension))
  assert.deepEqual(native.zeroAxisCase, evidence.zeroAxisCases.find((entry) => entry.ambientDimension === ambientDimension))
  const capture = readEvidenceDocumentSync(artifactDir, `${stem}-live-capture.json`, { checkout })
  assert.deepEqual(capture, native.zeroAxisCase.liveObservation, 'Parent replays the actual complete capture lifecycle raw file')
  assert.equal(capture.capture.image.path, resolve(artifactDir, `${stem}-live.png`), 'Live PNG path is the exact owned artifact')
  const liveBytes = readFileSync(capture.capture.image.path)
  assert.equal(liveBytes.length, capture.capture.image.bytes)
  assert.equal(createHash('sha256').update(liveBytes).digest('hex'), capture.capture.image.sha256)
  assert.deepEqual(observeZeroAxisPixels(liveBytes, capture.capture.image.frame.ctm), native.zeroAxisCase.livePaint)
}
