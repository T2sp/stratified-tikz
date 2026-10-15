import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createCurveStratum, createEmptyDiagram, createPointStratum, createTextLabel } from '../../src/model/constructors.ts'
import { pointNodeDimensionFields, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { PointStyle, Vec2 } from '../../src/model/types.ts'
import type { PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelController, createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { currentSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { SvgTexLabelView } from '../../src/rendering/svgLabelView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { pathInlineNodesForSvgPreview, svgPathInlineNodeLabelAnchor, svgPathInlineNodeLabelIdentity } from '../../src/rendering/svgPathInlineNodes.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { createDiagramHistory } from '../../src/ui/undo.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

type Reference = PointNodeShapeInput & { id: string; parameters: { aspect: number }; expectedAnchors: Record<string, Vec2>;
  paints: { action: string; tokens: (Vec2 & { kind: string })[] }[] }
const fixture = JSON.parse(readFileSync(new URL('../fixtures/point-node-anchors/diamond-aspect-scanning/references.json', import.meta.url), 'utf8')) as { cases: Reference[] }
// Controlled PGF 20/8/3pt body. Native font/DOM/download acceptance is separate.
const measurement: TextMeasurementProvider = { identity: '32d-diamond-20-8-3',
  measure: () => ({ width: 24, ascent: 9.6, descent: 3.6 }), lineMetrics: () => ({ ascent: 9.6, descent: 3.6 }) }
const settings = svgLabelLayoutSettings(12, svgPointNodeTextFontFamily)
function styleFor(reference: Reference, anchor: string): PointStyle {
  let style: PointStyle = { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
    shape: 'diamond', shapeParameters: { ...reference.parameters }, layout: { anchor } }
  for (const field of pointNodeDimensionFields) {
    const updated = updatePointNodeDimension(style, [field], ` ${reference[field]}pt `)
    assert.ok(updated); style = updated
  }
  return style
}
function near(actual: number, expected: number, tolerance = .025 * 1.2): void {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from independent PGF ${expected}`)
}

for (const ambientDimension of [2, 3] as const) for (const aspect of [.01, .03, .1, .2, .6, 1.1, 100]) test(`${ambientDimension}D diamond ${aspect}: independent anchor/body/paint in live and detached SVG preserves attached/free/inline sources`, async () => {
  const reference = fixture.cases.find(value => value.id === `aspect-${aspect}`)!
  const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  try {
    for (const anchor of ['north', 'text', 'base', 'mid', '37', '90']) {
      const diagram = createEmptyDiagram({ ambientDimension })
      diagram.camera = diagram.camera.mode === '2d' ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
        : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
      const position = { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, source = 'diamond'
      const point = createPointStratum({ ambientDimension, id: 'p', position, text: source, style: styleFor(reference, anchor) })
      const free = createTextLabel({ ambientDimension, id: 'free', text: 'free $F$', position: { x: -3, y: 2, z: ambientDimension === 3 ? 1 : 0 } })
      const curve = createCurveStratum({ ambientDimension, id: 'curve', points: [{ x: -2, y: -1, z: 0 }, { x: 2, y: -1, z: ambientDimension === 3 ? 1 : 0 }],
        inlineNodes: [{ id: 'inline', text: '$I$', position: { kind: 'segment', segmentIndex: 0, value: .25 }, options: { placement: 'above', sloped: true } }] })
      diagram.strata = [point, curve]; diagram.labels = [free]
      assert.equal(validateDiagram(diagram).valid, true)
      const saved = serializeDiagram(diagram), history = createDiagramHistory(diagram), beforeHistory = structuredClone(history)
      const loaded = parseSavedDiagramJson(saved)
      assert.ok(loaded.ok); assert.equal(serializeDiagram(loaded.diagram), saved)
      const projected = projectToSvgPoint(diagram.camera, position, 360)
      const cursor = svgPointToModelOnWorkPlane(diagram.camera, projected, 360, ambientDimension === 2 ? { kind: 'xy', z: 0 } : { kind: 'xz', y: 2 })
      for (const axis of ['x', 'y', 'z'] as const) near(cursor[axis], position[axis], 1e-8)
      const captured = captureSvgLabelExport({ runtime, source, pointStyle: point.style, ownerIdentity: svgPointNodeOwner(31, 'p'),
        position: projected, fontSize: 12, fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center', settings })
      const freeCapture = captureSvgLabelExport({ runtime, source: free.text, ownerIdentity: JSON.stringify(['free-label', 31, free.id]),
        position: projectToSvgPoint(diagram.camera, free.position, 360), color: free.style.color, opacity: free.style.opacity,
        anchor: free.style.anchor, fontSize: 12, settings })
      const inline = pathInlineNodesForSvgPreview(curve, ambientDimension, value => projectToSvgPoint(diagram.camera, value, 360))[0]!
      const inlineCapture = captureSvgLabelExport({ runtime, source: inline.text, ownerIdentity: svgPathInlineNodeLabelIdentity(31, curve.id, inline.id),
        position: { x: inline.center.x + inline.labelOffset.x, y: inline.center.y + inline.labelOffset.y },
        color: '#111827', opacity: 1, anchor: svgPathInlineNodeLabelAnchor(inline.placement), fontSize: 12, settings, boundsTarget: false })
      const controller = createSvgLabelController(runtime), cancel = controller.start(captured)
      const pending = controller.getSnapshot()!
      const [settled, freeState, inlineState] = await settleSvgExportLabels([captured, freeCapture, inlineCapture])
      cancel()
      assert.equal(settled.status, 'ready'); assert.equal(freeState.status, 'ready'); assert.equal(inlineState.status, 'ready')
      const unaffected = [renderSettledSvgLabelDocument(freeCapture, freeState), renderSettledSvgLabelDocument(inlineCapture, inlineState)]
      assert.match(unaffected[0]!, /data-label-math="true"/); assert.match(unaffected[1]!, /data-label-math="true"/)
      for (const state of [pending, settled]) {
        const layout = svgPointNodeLayout(point.style, state)
        assert.equal(layout.geometry.limitation, undefined)
        near(layout.selectedAnchor.x, reference.expectedAnchors[anchor]!.x * 1.2)
        near(layout.selectedAnchor.y, reference.expectedAnchors[anchor]!.y * 1.2)
        near(layout.placementOffset.x + layout.selectedAnchor.x, 0, 1e-8)
        near(layout.placementOffset.y + layout.selectedAnchor.y, 0, 1e-8)
        const expectedVertices = reference.paints[0]!.tokens.filter(value => value.kind === 'movetotoken' || value.kind === 'linetotoken')
        const solution = layout.geometry.solution!
        assert.equal(solution.contours[0]!.vertices.length, 4)
        solution.contours[0]!.vertices.forEach((value, index) => {
          near(value.x, expectedVertices[index]!.x * 1.2, .03 * 1.2); near(value.y, expectedVertices[index]!.y * 1.2, .03 * 1.2)
        })
        near(layout.textOrigin.x, reference.expectedAnchors.text!.x * 1.2 - layout.selectedAnchor.x)
        near(layout.baseline, reference.expectedAnchors.base!.y * 1.2 - layout.selectedAnchor.y)
        const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, createElement(SvgPointNodeView, { capture: captured, state })))
        const detached = renderSettledSvgLabelDocument(captured, state)
        assert.equal(live, detached)
        assert.ok(detached.includes(`d="${solution.contours[0]!.path}"`))
        assert.ok(detached.includes(`data-point-anchor-offset="${layout.selectedAnchor.x} ${layout.selectedAnchor.y}"`))
        const completeRoot = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' },
          createElement(SvgPointNodeView, { capture: captured, state }), createElement(SvgTexLabelView, { capture: freeCapture, state: freeState }), createElement(SvgTexLabelView, { capture: inlineCapture, state: inlineState })))
        assert.match(completeRoot, /data-point-shape="diamond"/)
        assert.ok(completeRoot.includes('free $F$')); assert.ok(completeRoot.includes('$I$'))
        const entry: SvgPointNodeCommit = { source, ownerIdentity: svgPointNodeOwner(31, 'p'), fontGeneration: 0,
          shape: 'diamond', size: point.style.size, requestIdentity: state.requestIdentity, layout }
        const commits = new Map([['p', entry]])
        assert.equal(currentSvgPointNodeLayout(point, commits, 31, 0), layout)
        const vertex = solution.contours[0]!.vertices[0]!
        const picked = collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360,
          point: { x: projected.x + layout.placementOffset.x + vertex.x, y: projected.y + layout.placementOffset.y + vertex.y },
          showCoordinateAnchors: false, pointCommits: commits, pointDocumentRevision: 31, pointFontGeneration: 0 })
        assert.equal(picked[0]?.id, 'p')
        assert.equal(currentSvgPointNodeLayout({ ...point, style: { ...point.style, shapeParameters: { aspect: aspect === .01 ? .03 : .01 } } }, commits, 31, 0), null)
      }
      assert.deepEqual(unaffected, [renderSettledSvgLabelDocument(freeCapture, freeState), renderSettledSvgLabelDocument(inlineCapture, inlineState)])
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const tikz = generateTikz(diagram, { exportMode })
        assert.ok(tikz.includes(`aspect=${aspect}`)); assert.ok(tikz.includes(`anchor=${anchor}`))
        assert.ok(tikz.includes('{diamond}')); assert.ok(tikz.includes('{free $F$}')); assert.ok(tikz.includes('{$I$}'))
        assert.ok(tikz.includes(ambientDimension === 2 ? 'at (1,2)' : 'at (1,2,3)'))
        assert.doesNotMatch(tikz, /101\.135|1170\.061|signedFittedAxes|requestIdentity/)
      }
      assert.equal(serializeDiagram(diagram), saved)
      assert.deepEqual(history, beforeHistory)
      assert.deepEqual(point.position, position)
      assert.equal(point.codim, ambientDimension)
    }
  } finally { runtime.dispose() }
})
