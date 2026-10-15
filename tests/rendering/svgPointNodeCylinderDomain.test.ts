import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { pointNodeDimensionFields, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { Diagram, PointStratum, PointStyle, Vec2 } from '../../src/model/types.ts'
import type { PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelController, createSvgLabelRuntime, initialSvgLabelState, type SvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { currentSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

type Reference = PointNodeShapeInput & { id: string }
const fixture = JSON.parse(readFileSync(new URL('../fixtures/point-node-anchors/cylinder-domain/references.json', import.meta.url), 'utf8')) as {
  failures: Reference[]; controls: Reference[]
}
const diagnostic = 'Cylinder effective transverse radius is zero; PGF’s fitting division is undefined.'
// Controlled fixed-box body metrics are independently authenticated by the
// geometry suite. Native fonts and downloaded artifacts are separate acceptance.
const measurement: TextMeasurementProvider = { identity: '32d-cylinder-domain-20-8-2',
  measure: () => ({ width: 24, ascent: 9.6, descent: 2.4 }), lineMetrics: () => ({ ascent: 9.6, descent: 2.4 }) }
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
const settings = svgLabelLayoutSettings(12, svgPointNodeTextFontFamily)
function styleFor(value: Reference): PointStyle {
  let style: PointStyle = { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
    shape: value.shape, shapeParameters: { ...value.parameters, cylinderUsesCustomFill: true,
      cylinderBodyFill: '#1122AA', cylinderEndFill: '#CC3322' }, layout: { anchor: 'center', fontContext: { fontSizePt: 12, xHeightPt: 5.2 } } }
  for (const field of pointNodeDimensionFields) {
    const updated = updatePointNodeDimension(style, [field], ` ${value[field]}pt `)
    assert.ok(updated); style = updated
  }
  return style
}
function point(value: Diagram): PointStratum {
  const result = value.strata[0]
  if (result.geometricKind !== 'point') throw new Error('Expected point')
  return result
}
function capture(style: PointStyle, source: string, ownerIdentity: string, position: Vec2, currentRuntime: SvgLabelRuntime = runtime) {
  return captureSvgLabelExport({ runtime: currentRuntime, source, pointStyle: style, position, fontSize: 12,
    fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center', settings, ownerIdentity })
}
function commit(value: PointStratum, ownerIdentity: string, requestIdentity: string, layout: ReturnType<typeof svgPointNodeLayout>): SvgPointNodeCommit {
  return { source: value.text ?? '', ownerIdentity, fontGeneration: 0, shape: value.style.shape, size: value.style.size, requestIdentity, layout }
}
function close(actual: number, expected: number): void { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`) }

const profiles = ['empty-zero', 'incircle-zero', 'signed-radius-clamped-zero', 'axial-minimum-nonrescue',
  'outer-separation-nonrescue', 'line-width-custom-fill-nonrescue', 'nonempty-cancellation', 'incircle-nonempty-cancellation']
for (const ambientDimension of [2, 3] as const) for (const id of profiles) test(`${ambientDimension}D ${id}: shared pending/live/settled warning suppresses all requested cylinder paint and hidden picking`, async () => {
  const reference = fixture.failures.find(value => value.id === id)!
  const source = reference.body.width ? 'cylinder' : ''
  const style = styleFor(reference)
  const diagram = createEmptyDiagram({ ambientDimension })
  diagram.camera = diagram.camera.mode === '2d' ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
    : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
  const position = { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }
  const value = createPointStratum({ ambientDimension, id: 'p', text: source, position, style })
  diagram.strata = [value]
  const before = structuredClone(diagram)
  assert.equal(validateDiagram(diagram).valid, true)
  assert.equal(value.codim, ambientDimension)
  const serialized = serializeDiagram(diagram), loaded = parseSavedDiagramJson(serialized)
  assert.equal((JSON.parse(serialized) as { version: number }).version, 2)
  assert.ok(loaded.ok); assert.deepEqual(loaded.diagram.strata, diagram.strata)
  assert.doesNotMatch(serialized, /effective transverse radius|requestIdentity|paintRegions|limitation/)
  for (const field of pointNodeDimensionFields) assert.equal(point(loaded.diagram).style.layout?.units?.[field]?.source, ` ${reference[field]}pt `)
  assert.deepEqual(point(loaded.diagram).style.layout?.fontContext, { fontSizePt: 12, xHeightPt: 5.2 })
  const projected = projectToSvgPoint(diagram.camera, position, 360)
  const cursor = svgPointToModelOnWorkPlane(diagram.camera, projected, 360, ambientDimension === 2 ? { kind: 'xy', z: 0 } : { kind: 'xz', y: 2 })
  for (const axis of ['x', 'y', 'z'] as const) close(cursor[axis], position[axis])
  const currentRuntime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  const owner = svgPointNodeOwner(19, 'p'), captured = capture(style, source, owner, projected, currentRuntime)
  const controller = createSvgLabelController(currentRuntime), cancel = controller.start(captured)
  const pending = controller.getSnapshot()
  assert.ok(pending); assert.equal(pending.status, 'pending')
  const [settled] = await settleSvgExportLabels([captured])
  cancel(); currentRuntime.dispose()
  assert.equal(settled.status, 'ready')
  for (const state of [pending, settled]) {
    const layout = svgPointNodeLayout(style, state)
    assert.equal(layout.geometry.limitation, diagnostic)
    assert.equal(layout.geometry.solution, undefined)
    assert.deepEqual(layout.paintedBounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
    assert.equal(layout.stroke, 0); assert.ok(layout.warningBounds)
    assert.ok(layout.selectionRadius < (source ? 25 : 13))
    assert.deepEqual(layout.placementOffset, { x: 0, y: 0 })
    const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture: captured, state })))
    const exported = renderSettledSvgLabelDocument(captured, state)
    assert.equal(live, exported)
    assert.match(exported, /data-point-shape-warning="true"/)
    assert.ok(exported.includes(diagnostic)); assert.ok(exported.includes(`<title>${source}</title>`))
    assert.doesNotMatch(exported, /data-point-contour|data-point-paint-region|data-point-internal-border|fill="#(?:1122AA|CC3322)"/)
    const commits = new Map([['p', commit(value, owner, state.requestIdentity, layout)]])
    assert.equal(currentSvgPointNodeLayout(value, commits, 19, 0), layout)
    const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: commits,
      pointDocumentRevision: 19, pointFontGeneration: 0, showCoordinateAnchors: false }
    const warning = { x: projected.x + layout.warningBounds.minX + 1, y: projected.y + layout.warningBounds.minY + 1 }
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: warning })[0]?.id, 'p')
    if (source) assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: projected })[0]?.id, 'p')
    const far = { x: projected.x + 30, y: projected.y + 30 }
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: far }), [])
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: warning, layerFilter: { kind: 'layer', layer: 1 } }), [])
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: warning, visibility: { hiddenPointIds: new Set(['p']) } }), [])
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options,
      diagram: { ...diagram, layers: [{ value: 0, name: 'Points', locked: true }] }, point: warning }), [])
    assert.equal(currentSvgPointNodeLayout(value, commits, 20, 0), null)
    assert.equal(currentSvgPointNodeLayout({ ...value, text: source + 'stale' }, commits, 19, 0), null)
  }
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const tikz = generateTikz(loaded.diagram, { exportMode })
    assert.ok(tikz.includes('cylinder,')); assert.ok(tikz.includes(`{${source}}`))
    assert.ok(tikz.includes(ambientDimension === 2 ? 'at (1,2)' : 'at (1,2,3)'))
    for (const [index, name] of ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height'].entries()) {
      assert.ok(tikz.includes(`${name}=${reference[pointNodeDimensionFields[index]!]}pt`))
    }
    assert.ok(tikz.includes('cylinder uses custom fill')); assert.doesNotMatch(tikz, /effective transverse radius|warning/)
  }
  assert.deepEqual(diagram, before)
})

test('retained independent actual generated cylinder source still equals the production authored model output', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'zero-cylinder', position: { x: 0, y: 0, z: 0 }, text: '',
    style: { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
      shape: 'cylinder', layout: { innerXSep: 0, innerYSep: 0, minimumWidth: 0, minimumHeight: 0 } } })]
  assert.equal(generateTikz(diagram), readFileSync(new URL('../fixtures/point-node-anchors/cylinder-domain/actual-generated.tex', import.meta.url), 'utf8'))
})

for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D valid rx-zero/positive-width/signed-cylinder and zero-axis basic neighbors retain shared live/settled contours`, async () => {
  for (const id of ['positive-minimum-width-rescue', 'rx-zero-ry-positive', 'signed-nonzero-radii', 'ellipse-zero-axes',
    'ellipse-zero-x', 'ellipse-zero-y', 'rectangle-zero-axes', 'circle-zero-axes']) {
    const reference = fixture.controls.find(value => value.id === id)!, style = styleFor(reference)
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.strata = [createPointStratum({ ambientDimension, id: 'p', text: '', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, style })]
    assert.equal(validateDiagram(diagram).valid, true)
    const captured = capture(style, '', svgPointNodeOwner(7, 'p'), { x: 50, y: 60 })
    const pending = initialSvgLabelState(captured, runtime), [settled] = await settleSvgExportLabels([captured])
    for (const state of [pending, settled]) {
      const layout = svgPointNodeLayout(style, state)
      assert.equal(layout.geometry.limitation, undefined, id)
      assert.ok(layout.geometry.solution)
      const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture: captured, state })))
      assert.equal(live, renderSettledSvgLabelDocument(captured, state))
      assert.match(live, /data-point-contour="true"/)
      assert.doesNotMatch(live, /data-point-shape-warning/)
      if (reference.shape === 'cylinder') {
        assert.match(live, /data-point-internal-border="true"/)
        assert.match(live, /data-point-paint-region="body"/)
        assert.match(live, /data-point-paint-region="end"/)
      }
    }
    for (const exportMode of ['standalone', 'inlineMath'] as const) assert.ok(generateTikz(diagram, { exportMode }).includes(`${reference.shape},`))
  }
})

for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D valid→singular→valid transitions keep owner/request authority, exact saved/history source and both TikZ modes`, async () => {
  const initial = createEmptyDiagram({ ambientDimension })
  const validStyle = styleFor(fixture.controls.find(value => value.id === 'positive-minimum-width-rescue')!)
  const value = createPointStratum({ ambientDimension, id: 'p', text: '', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, style: validStyle })
  initial.strata = [value]
  const changed = updatePointNodeDimension(validStyle, ['minimumWidth'], ' -0em ')
  assert.ok(changed)
  const singular: Diagram = { ...initial, strata: [{ ...value, style: changed }] }
  const recovered = updatePointNodeDimension(changed, ['minimumWidth'], ' .5em ')
  assert.ok(recovered)
  const final: Diagram = { ...initial, strata: [{ ...value, style: recovered }] }
  let editor: UndoableEditorState = { editableDiagram: initial, selectedElement: { kind: 'stratum', id: 'p' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(initial) }
  editor = commitDiagramChange(editor, { ...editor, editableDiagram: singular })
  const committed = commitDiagramChange(editor, { ...editor, editableDiagram: final })
  const undone = undoLastDiagramChange(committed)
  assert.deepEqual(undone.editableDiagram, singular)
  assert.deepEqual(undoLastDiagramChange(undone).editableDiagram, initial)
  assert.deepEqual(redoLastDiagramChange(undone).editableDiagram, final)
  let previous: SvgPointNodeCommit | undefined
  for (const [index, diagram] of [initial, singular, final].entries()) {
    const current = point(diagram), owner = svgPointNodeOwner(31 + index, 'p')
    const captured = capture(current.style, '', owner, { x: 50, y: 60 })
    const [state] = await settleSvgExportLabels([captured]), layout = svgPointNodeLayout(current.style, state)
    assert.equal(layout.geometry.limitation, index === 1 ? diagnostic : undefined)
    const currentCommit = commit(current, owner, state.requestIdentity, layout)
    const commits = new Map([['p', currentCommit]])
    assert.equal(currentSvgPointNodeLayout(current, commits, 31 + index, 0), layout)
    if (previous) assert.equal(currentSvgPointNodeLayout(current, new Map([['p', previous]]), 31 + index, 0), null)
    previous = currentCommit
    const saved = serializeDiagram(diagram), loaded = parseSavedDiagramJson(saved)
    assert.ok(loaded.ok); assert.equal(serializeDiagram(loaded.diagram), saved)
    if (index === 1) assert.equal(point(loaded.diagram).style.layout?.units?.minimumWidth?.source, ' -0em ')
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const tikz = generateTikz(loaded.diagram, { exportMode })
      assert.ok(tikz.includes('cylinder,')); assert.ok(tikz.includes(`minimum width=${index === 0 ? 10 : index === 1 ? 0 : 6}pt`))
    }
    const changedSource = { ...current, text: 'request changed' }
    const changedCapture = capture(current.style, changedSource.text, owner, { x: 50, y: 60 })
    assert.notEqual(initialSvgLabelState(changedCapture, runtime).requestIdentity, state.requestIdentity)
    assert.equal(currentSvgPointNodeLayout(changedSource, commits, 31 + index, 0), null)
  }
})

for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D imported singular cylinder retains external raw options, layout provenance and authored TikZ intent`, async () => {
  const base = createEmptyDiagram({ ambientDimension })
  base.strata = [createPointStratum({ ambientDimension, id: 'p', text: '', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 } })]
  const source = String.raw`\tikzset{singular/.style={cylinder,inner sep=0pt,minimum size=0pt,minimum height=8em,outer sep=2ex,cylinder uses custom fill,cylinder body fill=blue,cylinder end fill=red}}`
  const imported = importTikzStyleFile(base, 'singular.sty', source)
  const preset = imported.diagram.userStylePresets?.find(value => value.kind === 'point')
  assert.ok(preset)
  const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
  const original = structuredClone(point(applied))
  const loaded = parseSavedDiagramJson(serializeDiagram(applied))
  assert.ok(loaded.ok); assert.deepEqual(point(loaded.diagram), original)
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, source)
  assert.deepEqual(point(loaded.diagram).style.importedLayout, original.style.importedLayout)
  const captured = capture(point(applied).style, '', svgPointNodeOwner(4, 'p'), { x: 50, y: 60 })
  const [state] = await settleSvgExportLabels([captured])
  assert.equal(svgPointNodeLayout(point(applied).style, state).geometry.limitation, diagnostic)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const tikz = generateTikz(loaded.diagram, { exportMode })
    assert.ok(tikz.includes('singular,')); assert.ok(tikz.includes('{}'))
    assert.doesNotMatch(tikz, /effective transverse radius|minimum width=0\.001|ellipse,/)
  }
})
