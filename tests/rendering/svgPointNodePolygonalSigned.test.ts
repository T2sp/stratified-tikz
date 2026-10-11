import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { pointNodeDimensionFields, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { PointShape, PointStyle, Vec2 } from '../../src/model/types.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelRuntime, initialSvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { currentSvgPointNodeLayout, svgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

// Equal PGF fixed-box metrics. This does not claim native/font acceptance.
const measurement: TextMeasurementProvider = { identity: '32d-polygonal-fixed-20-8-3',
  measure: () => ({ width: 24, ascent: 9.6, descent: 3.6 }),
  lineMetrics: () => ({ ascent: 9.6, descent: 3.6 }) }
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
const settings = svgLabelLayoutSettings(12, svgPointNodeTextFontFamily)
const cases: readonly { shape: PointShape; anchor: string }[] = [
  { shape: 'regular polygon', anchor: 'corner 1' }, { shape: 'square', anchor: 'corner 1' },
  { shape: 'triangle', anchor: 'corner 1' }, { shape: 'star', anchor: 'outer point 1' },
  { shape: 'isosceles triangle', anchor: 'left corner' }, { shape: 'dart', anchor: 'tip' },
]

function expectedAnchor(shape: PointShape, profile: 'empty' | 'targeted', anchor: string): Vec2 {
  // Read only authenticated raw PGF coordinates, never the retained failing
  // production-results.json or a production fit. The reference suite checks hashes.
  const slug = shape.replaceAll(' ', '-')
  const raw = readFileSync(new URL(`../fixtures/point-node-anchors/signed-polygonal/review/${profile}/${slug}-3/geometry.txt`, import.meta.url), 'utf8')
  const line = raw.split('\n').find(value => value.startsWith(`ANCHOR ${anchor};`))
  assert.ok(line, `Missing independently compiled ${shape} ${profile} ${anchor}`)
  const match = /; (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line)
  assert.ok(match)
  // Raw TeX pt is positive-up. Reverse once, then apply the established scale.
  return { x: Number(match[1]) * 1.2, y: -Number(match[2]) * 1.2 }
}

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) <= .025 * 1.2, `${actual} != PGF ${expected}`)
}

function styleFor(shape: PointShape, anchor: string): PointStyle {
  let style: PointStyle = { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
    shape, layout: { anchor, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } } }
  const dimensions = [-30, -30, 3, 3, -20, -20]
  for (const [index, field] of pointNodeDimensionFields.entries()) {
    const next = updatePointNodeDimension(style, [field], ` ${dimensions[index]}pt `)
    assert.ok(next); style = next
  }
  return style
}

for (const { shape, anchor } of cases) test(`${shape}: signed PGF anchor survives saved/live/pending/settled placement and picking`, async () => {
  for (const profile of ['empty', 'targeted'] as const) {
    const source = profile === 'empty' ? '' : 'polygon'
    const expected = expectedAnchor(shape, profile, anchor)
    const style = styleFor(shape, anchor)
    for (const ambientDimension of [2, 3] as const) {
      const diagram = createEmptyDiagram({ ambientDimension })
      diagram.camera = diagram.camera.mode === '2d'
        ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
        : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
      const position = { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }
      const point = createPointStratum({ ambientDimension, id: 'p', text: source, position, style })
      diagram.strata = [point]
      const before = structuredClone(point)
      assert.equal(validateDiagram(diagram).valid, true)
      const saved = serializeDiagram(diagram)
      assert.equal((JSON.parse(saved) as { version: number }).version, 2)
      assert.ok(!saved.includes('polygonalFitting'), 'runtime PGF construction stays out of saved data')
      const loaded = parseSavedDiagramJson(saved)
      assert.ok(loaded.ok)
      const loadedPoint = loaded.diagram.strata[0]
      assert.equal(loadedPoint.geometricKind, 'point')
      if (loadedPoint.geometricKind !== 'point') throw new Error('Expected saved point')
      assert.deepEqual(loadedPoint.style.layout, point.style.layout)
      assert.deepEqual(loadedPoint.position, position)
      assert.equal(loadedPoint.text, source)
      for (const [index, field] of pointNodeDimensionFields.entries()) {
        assert.equal(loadedPoint.style.layout?.units?.[field]?.source, ` ${[-30, -30, 3, 3, -20, -20][index]}pt `)
      }
      const projected = projectToSvgPoint(diagram.camera, position, 360)
      const onPlane = svgPointToModelOnWorkPlane(diagram.camera, projected, 360,
        ambientDimension === 3 ? { kind: 'xz', y: 2 } : { kind: 'xy', z: 0 })
      for (const key of ['x', 'y', 'z'] as const) assert.ok(Math.abs(onPlane[key] - position[key]) < 1e-8)
      const captured = captureSvgLabelExport({ runtime, source, pointStyle: style,
        position: projected, fontSize: 12, fontFamily: svgPointNodeTextFontFamily,
        color: '#000000', opacity: 1, anchor: 'center', settings, ownerIdentity: svgPointNodeOwner(1, 'p') })
      const pending = initialSvgLabelState(captured, runtime)
      const [settled] = await settleSvgExportLabels([captured])
      assert.equal(settled.status, 'ready')
      for (const state of [pending, settled]) {
        const layout = svgPointNodeLayout(style, state)
        assert.equal(layout.geometry.limitation, undefined)
        close(layout.selectedAnchor.x, expected.x); close(layout.selectedAnchor.y, expected.y)
        assert.deepEqual(layout.placementOffset, { x: -layout.selectedAnchor.x || 0, y: -layout.selectedAnchor.y || 0 })
        const live = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' },
          createElement(SvgPointNodeView, { capture: captured, state })))
        const exported = renderSettledSvgLabelDocument(captured, state)
        assert.equal(live, exported)
        assert.ok(exported.includes(`data-point-anchor-offset="${layout.selectedAnchor.x} ${layout.selectedAnchor.y}"`))
        assert.ok(exported.includes(`d="${layout.geometry.solution?.contours[0].path}"`))
        const entry: SvgPointNodeCommit = { source, ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0,
          shape, size: style.size, requestIdentity: state.requestIdentity, layout }
        const commits = new Map([['p', entry]])
        assert.equal(currentSvgPointNodeLayout(point, commits, 1, 0), layout)
        const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: commits,
          pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
        const vertex = layout.geometry.vertices[0]
        const hit = { x: projected.x + layout.placementOffset.x + vertex.x,
          y: projected.y + layout.placementOffset.y + vertex.y }
        assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: hit })[0]?.id, 'p')
        const outside = { x: projected.x + Math.max(layout.paintedBounds.maxX, layout.body.bounds.maxX) + 9,
          y: projected.y + layout.placementOffset.y }
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: outside }), [])
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, pointDocumentRevision: 2 }), [])
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, pointFontGeneration: 1 }), [])
        assert.equal(currentSvgPointNodeLayout({ ...point, text: source + 'changed' }, commits, 1, 0), null)
        assert.equal(currentSvgPointNodeLayout({ ...point, style: { ...style, layout: { ...style.layout, outerXSep: 4 } } }, commits, 1, 0), null)
        assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, layerFilter: { kind: 'layer', layer: 1 } }), [])
      }
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const tikz = generateTikz(loaded.diagram, { exportMode })
        for (const option of ['inner xsep=-30pt', 'inner ysep=-30pt', 'outer xsep=3pt', 'outer ysep=3pt',
          'minimum width=-20pt', 'minimum height=-20pt', `anchor=${anchor}`]) assert.ok(tikz.includes(option))
        assert.ok(tikz.includes(ambientDimension === 3 ? 'at (1,2,3)' : 'at (1,2)'))
        assert.ok(tikz.includes(`{${source}}`))
      }
      assert.deepEqual(point, before)
      assert.equal(point.codim, ambientDimension)
    }
  }
})
