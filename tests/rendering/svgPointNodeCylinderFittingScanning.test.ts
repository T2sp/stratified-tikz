import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { pointNodeDimensionFields, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { Diagram, PointStratum, PointStyle, Vec2 } from '../../src/model/types.ts'
import type { PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelController, createSvgLabelRuntime, type SvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
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

type Reference = PointNodeShapeInput & { id: string; sources?: Record<string, string>; expectedAnchors: Record<string, Vec2> }
const fixture = JSON.parse(readFileSync(new URL('../fixtures/point-node-anchors/cylinder-fitting-scanning/references.json', import.meta.url), 'utf8')) as {
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
      cylinderBodyFill: '#1122AA', cylinderEndFill: '#CC3322' }, layout: { anchor: value.anchor ?? 'center', fontContext: { fontSizePt: 12, xHeightPt: 5.2 } } }
  for (const field of pointNodeDimensionFields) {
    const updated = updatePointNodeDimension(style, [field], ` ${value.sources?.[field] ?? `${value[field]}pt`} `)
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

const profiles = ['subsp', 'contextual-em-subsp', 'contextual-ex-subsp', 'nonempty-scanned-cancellation']
for (const ambientDimension of [2, 3] as const) for (const id of profiles) test(`${ambientDimension}D ${id}: shared pending/live/settled warning suppresses all requested cylinder paint and hidden picking`, async () => {
  const reference = fixture.failures.find(value => value.id === id)!
  const source = reference.body.width ? 'cylinder' : ''
  let style = styleFor(reference)
  let diagram = createEmptyDiagram({ ambientDimension })
  diagram.camera = diagram.camera.mode === '2d' ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
    : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
  const position = { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }
  diagram.strata = [createPointStratum({ ambientDimension, id: 'p', text: source, position, style })]
  if (reference.sources) {
    const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
    const raw = String.raw`\tikzset{sourceDomain/.style={cylinder,${pointNodeDimensionFields.map((field, index) => `${keys[index]}=${reference.sources?.[field] ?? `${reference[field]}pt`}`).join(',')},cylinder uses custom fill,cylinder body fill=blue,cylinder end fill=red}}`
    const imported = importTikzStyleFile(diagram, 'source-domain.sty', raw)
    const preset = imported.diagram.userStylePresets?.find(value => value.kind === 'point')
    assert.ok(preset)
    diagram = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
    assert.equal(diagram.externalTikzStyleSources?.[0].rawSource, raw)
    style = point(diagram).style
    assert.deepEqual(style.importedLayout?.overriddenFields, [])
  }
  const value = point(diagram)
  const before = structuredClone(diagram)
  assert.equal(validateDiagram(diagram).valid, true)
  assert.equal(value.codim, ambientDimension)
  const serialized = serializeDiagram(diagram), loaded = parseSavedDiagramJson(serialized)
  assert.equal((JSON.parse(serialized) as { version: number }).version, 2)
  assert.ok(loaded.ok); assert.deepEqual(loaded.diagram.strata, diagram.strata)
  assert.doesNotMatch(serialized, /effective transverse radius|requestIdentity|paintRegions|limitation/)
  for (const field of pointNodeDimensionFields) assert.equal(point(loaded.diagram).style.layout?.units?.[field]?.source, reference.sources ? reference.sources[field] ?? `${reference[field]}pt` : ` ${reference[field]}pt `)
  assert.deepEqual(point(loaded.diagram).style.layout?.fontContext, reference.sources ? { fontSizePt: 10, xHeightPt: 4.30554 } : { fontSizePt: 12, xHeightPt: 5.2 })
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
      assert.ok(tikz.includes(`${name}=${Number(value.style.layout?.[pointNodeDimensionFields[index]!]?.toFixed(6))}pt`))
    }
    assert.ok(tikz.includes('cylinder uses custom fill')); assert.doesNotMatch(tikz, /effective transverse radius|warning/)
  }
  assert.deepEqual(diagram, before)
})


for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D folded full named/numeric placement matches PGF in pending/live/settled/picking and both TikZ modes`, async () => {
  const reference = fixture.controls.find(value => value.id === 'folded')!
  for (const [anchor, expected] of Object.entries(reference.expectedAnchors)) {
    const style = { ...styleFor(reference), layout: { ...styleFor(reference).layout, anchor } }
    const diagram = createEmptyDiagram({ ambientDimension })
    const position = { x: 7, y: 6.5, z: ambientDimension === 3 ? 2 : 0 }
    const value = createPointStratum({ ambientDimension, id: 'p', position, text: '', style })
    diagram.strata = [value]
    const before = structuredClone(diagram), saved = serializeDiagram(diagram), loaded = parseSavedDiagramJson(saved)
    assert.ok(loaded.ok); assert.equal(serializeDiagram(loaded.diagram), saved)
    assert.equal(point(loaded.diagram).style.layout?.innerXSep, -30)
    assert.equal(point(loaded.diagram).style.layout?.units?.innerXSep?.source, ' -30pt ')
    assert.doesNotMatch(saved, /cylinderFitting|dimensionSources|bodyExtension|endCenter|baseCenter/)
    const projected = projectToSvgPoint(diagram.camera, position, 360), owner = svgPointNodeOwner(92, 'p')
    const currentRuntime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
    const captured = capture(style, '', owner, projected, currentRuntime)
    const controller = createSvgLabelController(currentRuntime), cancel = controller.start(captured)
    const pending = controller.getSnapshot()!
    const [settled] = await settleSvgExportLabels([captured]); cancel(); currentRuntime.dispose()
    assert.equal(pending.status, 'pending'); assert.equal(settled.status, 'ready')
    for (const state of [pending, settled]) {
      const layout = svgPointNodeLayout(style, state)
      assert.equal(layout.geometry.limitation, undefined)
      assert.ok(Math.hypot(layout.selectedAnchor.x / 1.2 - expected.x, layout.selectedAnchor.y / 1.2 - expected.y) < .025, anchor)
      close(layout.placementOffset.x, -layout.selectedAnchor.x); close(layout.placementOffset.y, -layout.selectedAnchor.y)
      const fitting = layout.geometry.solution!.cylinderFitting!
      close(fitting.rx, 6); close(fitting.ry, 6)
      close(fitting.endCenter.x, .72); close(fitting.baseCenter.x, 11.52)
      assert.equal(layout.geometry.solution!.contours.length, 2)
      assert.equal(layout.geometry.solution!.paintRegions.length, 2)
      const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture: captured, state })))
      assert.equal(live, renderSettledSvgLabelDocument(captured, state))
      assert.match(live, /data-point-contour="true"/); assert.match(live, /data-point-internal-border="true"/)
      assert.doesNotMatch(live, /data-point-shape-warning/)
      const commits = new Map([['p', commit(value, owner, state.requestIdentity, layout)]])
      assert.equal(currentSvgPointNodeLayout(value, commits, 92, 0), layout)
      const vertex = layout.geometry.solution!.contours[0].vertices[0]!
      const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: commits, pointDocumentRevision: 92, pointFontGeneration: 0 }
      const painted = { x: projected.x + layout.placementOffset.x + vertex.x, y: projected.y + layout.placementOffset.y + vertex.y }
      assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: painted })[0]?.id, 'p', 'current fitted contour picking')
      assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: { x: projected.x + 100, y: projected.y + 100 } }), [])
      assert.equal(currentSvgPointNodeLayout(value, commits, 93, 0), null)
    }
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const tikz = generateTikz(loaded.diagram, { exportMode })
      assert.ok(tikz.includes(`anchor=${anchor}`)); assert.ok(tikz.includes('inner xsep=-30pt'))
      assert.ok(tikz.includes(ambientDimension === 2 ? 'at (7,6.5)' : 'at (7,6.5,2)'))
    }
    assert.deepEqual(diagram, before)
  }
})

for (const ambientDimension of [2, 3] as const) test(`${ambientDimension}D same-owner folded→subsp→folded keeps current source/request/revision, JSON/history/context and both exports`, async () => {
  const folded = fixture.controls.find(value => value.id === 'folded')!, subsp = fixture.failures.find(value => value.id === 'subsp')!
  const initial = createEmptyDiagram({ ambientDimension })
  initial.strata = [createPointStratum({ ambientDimension, id: 'p', text: '', position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, style: styleFor(folded) })]
  const invalid = structuredClone(initial); point(invalid).style = styleFor(subsp)
  const final = structuredClone(initial)
  let history: UndoableEditorState = { editableDiagram: initial, selectedElement: { kind: 'stratum', id: 'p' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(initial) }
  history = commitDiagramChange(history, { ...history, editableDiagram: invalid }); history = commitDiagramChange(history, { ...history, editableDiagram: final })
  assert.deepEqual(undoLastDiagramChange(history).editableDiagram, invalid)
  assert.deepEqual(redoLastDiagramChange(undoLastDiagramChange(history)).editableDiagram, final)
  const owner = svgPointNodeOwner(100, 'p')
  let previous: SvgPointNodeCommit | undefined
  for (const [index, diagram] of [initial, invalid, final].entries()) {
    const value = point(diagram), captured = capture(value.style, '', owner, { x: 50, y: 60 })
    const [state] = await settleSvgExportLabels([captured]), layout = svgPointNodeLayout(value.style, state)
    assert.equal(layout.geometry.limitation, index === 1 ? diagnostic : undefined)
    assert.equal(state.source, ''); assert.equal(captured.ownerIdentity, owner)
    const current = commit(value, owner, state.requestIdentity, layout), commits = new Map([['p', current]])
    assert.equal(currentSvgPointNodeLayout(value, commits, 100, 0), layout)
    if (previous) assert.equal(currentSvgPointNodeLayout(value, new Map([['p', previous]]), 100, 0), null)
    previous = current
    const saved = serializeDiagram(diagram), loaded = parseSavedDiagramJson(saved)
    assert.ok(loaded.ok); assert.equal(serializeDiagram(loaded.diagram), saved)
    assert.equal(point(loaded.diagram).style.layout?.units?.innerYSep?.source, index === 1 ? ' 0.000001pt ' : ' 5pt ')
    assert.deepEqual(value.position, point(initial).position)
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const tikz = generateTikz(loaded.diagram, { exportMode })
      assert.ok(tikz.includes(index === 1 ? 'inner ysep=0.000001pt' : 'inner xsep=-30pt'))
      assert.ok(tikz.includes('{}'))
    }
    const changed = { ...value, text: 'latest raw source' }
    assert.equal(currentSvgPointNodeLayout(changed, commits, 100, 0), null)
    assert.equal(currentSvgPointNodeLayout(value, commits, 101, 0), null)
  }
})

test('retained folded/subsp actual generated reviewer TikZ remains exact after runtime-only fixes', () => {
  const directory = new URL('../fixtures/point-node-anchors/cylinder-fitting-scanning/review/', import.meta.url)
  const comparison = JSON.parse(readFileSync(new URL('folded/comparison.json', directory), 'utf8')) as { production: { model: Diagram } }
  assert.equal(generateTikz(comparison.production.model), readFileSync(new URL('folded/actual-generated.tex', directory), 'utf8'))
  const subsp = structuredClone(comparison.production.model)
  const value = point(subsp)
  value.id = 'subsp-cylinder'
  value.style.layout = { innerXSep: 0, innerYSep: .000001, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 80 }
  assert.equal(generateTikz(subsp), readFileSync(new URL('subsp/actual-generated.tex', directory), 'utf8'))
})
