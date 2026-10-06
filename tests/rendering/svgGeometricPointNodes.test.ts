import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { clonePointStyle, getPointPaint } from '../../src/model/styles.ts'
import type { PointShape } from '../../src/model/types.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { svgPointNodeLayout, currentSvgPointNodeLayout, svgPointNodeOwner } from '../../src/rendering/svgPointNodeLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { svgPointNodeGeometry } from '../../src/rendering/svgPointNodeGeometry.ts'

const shapes: PointShape[] = ['ellipse', 'diamond', 'regular polygon', 'star', 'trapezium', 'isosceles triangle',
  'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
const measurement = { identity: 'geometric-point-fixed-font',
  measure: (text: string, font: { sizePx: number }) => ({ width: text.length * font.sizePx / 2, ascent: .8 * font.sizePx, descent: .2 * font.sizePx }),
  lineMetrics: (font: { sizePx: number }) => ({ ascent: .8 * font.sizePx, descent: .2 * font.sizePx }) }
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
const settings = svgLabelLayoutSettings(12)
function capture(shape: PointShape, source: string) {
  const point = createPointStratum({ ambientDimension: 2, id: 'p', text: source, position: { x: 0, y: 0, z: 0 } })
  point.style.shape = shape
  return { point, capture: captureSvgLabelExport({ runtime, source, settings, pointStyle: point.style,
    position: { x: 0, y: 0 }, fontSize: 12, color: '#000000', opacity: 1, anchor: 'center', ownerIdentity: svgPointNodeOwner(1, 'p') }) }
}
for (const shape of shapes) test(`${shape}: shared actual math/plain/mixed body, contour and picking in 2D/3D`, async () => {
  for (const source of ['plain body', '$\\frac{x}{y}$', '前 $x_i$ 後']) {
    const value = capture(shape, source)
    const [state] = await settleSvgExportLabels([value.capture])
    assert.equal(state.status, 'ready')
    const layout = svgPointNodeLayout(value.point.style, state)
    const markup = renderSettledSvgLabelDocument(value.capture, state)
    assert.match(markup, /data-point-contour="true"/)
    assert.ok(markup.includes(`data-point-shape="${shape}"`))
    if (source.includes('$')) assert.match(markup, /data-label-math="true"/)
    for (const ambientDimension of [2, 3] as const) {
      const diagram = createEmptyDiagram({ ambientDimension })
      const point = { ...value.point, codim: ambientDimension }
      diagram.strata = [point]
      const entry = { source, ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0, shape, size: point.style.size,
        requestIdentity: state.requestIdentity, layout }
      const center = projectToSvgPoint(diagram.camera, point.position, 360)
      const options = { diagram, camera: diagram.camera, viewportHeight: 360,
        pointCommits: new Map([['p', entry]]), pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
      const boundary = layout.geometry.vertices[0]
      assert.ok(boundary)
      assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: center.x + boundary.x, y: center.y + boundary.y } })[0]?.id, 'p')
      assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: center.x + layout.selectionRadius + 8, y: center.y } }).length, 0)
      const changed = { ...point, style: { ...point.style, shapeParameters: { borderRotate: 37 } } }
      assert.equal(currentSvgPointNodeLayout(changed, options.pointCommits, 1, 0), null)
    }
  }
})
test('geometric export freezes shape options at click time and renders independent cylinder fills', async () => {
  const { point } = capture('cylinder', '$x$')
  point.style.shapeParameters = { aspect: .4, cylinderUsesCustomFill: true, cylinderBodyFill: '#1144AA', cylinderEndFill: '#EE3300' }
  point.style.paint = getPointPaint(point.style)
  point.style.paint.fill.enabled = false
  const captured = captureSvgLabelExport({ runtime, source: point.text!, settings, pointStyle: point.style,
    position: { x: 0, y: 0 }, fontSize: 12, color: '#000000', opacity: 1, anchor: 'center' })
  point.style.shapeParameters.aspect = 3
  point.style.shapeParameters.cylinderEndFill = '#000000'
  assert.equal(captured.pointStyle?.shapeParameters?.aspect, .4)
  assert.equal(captured.pointStyle?.shapeParameters?.cylinderEndFill, '#EE3300')
  assert.ok(Object.isFrozen(captured.pointStyle?.shapeParameters))
  const [state] = await settleSvgExportLabels([captured])
  const markup = renderSettledSvgLabelDocument(captured, state)
  assert.match(markup, /data-point-paint-region="body"/)
  assert.match(markup, /data-point-paint-region="end"/)
  assert.match(markup, /data-point-internal-border="true"/)
  assert.match(markup, /fill="#1144AA"/)
  assert.match(markup, /fill="#EE3300"/)
  assert.equal(clonePointStyle(point.style).shapeParameters?.aspect, 3)
})
test('concave dart and star retain excluded notches instead of a bounding-box fill', async () => {
  for (const shape of ['dart', 'star'] as const) {
    const value = capture(shape, 'wide text')
    const [state] = await settleSvgExportLabels([value.capture])
    const layout = svgPointNodeLayout(value.point.style, state)
    const diagram = createEmptyDiagram({ ambientDimension: 2 })
    diagram.strata = [value.point]
    const center = projectToSvgPoint(diagram.camera, value.point.position, 360)
    const entry = { source: value.point.text!, ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0,
      shape, size: value.point.style.size, requestIdentity: state.requestIdentity, layout }
    const corner = { x: center.x + layout.geometry.bounds.maxX - .01, y: center.y + layout.geometry.bounds.minY + .01 }
    assert.equal(collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360,
      pointCommits: new Map([['p', entry]]), pointDocumentRevision: 1, pointFontGeneration: 0,
      showCoordinateAnchors: false, point: corner }).length, 0)
  }
})
test('unsupported shape work remains explicit and preserves source instead of throwing or painting a circle', async () => {
  const value = capture('ellipse', 'raw $x$')
  const style = { ...value.point.style, size: 1e8 }
  const limited = captureSvgLabelExport({ ...value.capture, pointStyle: style })
  const [state] = await settleSvgExportLabels([limited])
  const layout = svgPointNodeLayout(style, state)
  assert.ok(layout.geometry.limitation)
  assert.equal(layout.stroke, 0)
  const markup = renderSettledSvgLabelDocument(limited, state)
  assert.match(markup, /Shape preview unavailable/)
  assert.doesNotMatch(markup, /data-point-contour|<circle/)
  assert.equal(limited.source, 'raw $x$')
  assert.equal(limited.pointStyle?.shape, 'ellipse')
  assert.equal(limited.pointStyle?.size, 1e8)
})
test('inactive parameters left by shape switching preserve accepted legacy contours', () => {
  for (const shape of ['circle', 'square', 'triangle'] as const) {
    const base = { shape, size: 3 }
    const retained = { ...base, shapeParameters: { starPoints: 7, starPointMode: 'height' as const, starPointHeight: 8 } }
    assert.deepEqual(svgPointNodeGeometry(retained, { width: 20, height: 10 }), svgPointNodeGeometry(base, { width: 20, height: 10 }))
  }
  const circle = { shape: 'circle' as const, size: 3, shapeParameters: { borderRotate: 37, borderUsesIncircle: true } }
  assert.equal(svgPointNodeGeometry(circle, { width: 20, height: 10 }).kind, 'circle')
  assert.ok(svgPointNodeGeometry({ shape: 'trapezium', size: .000001 }, { width: 0, height: 0 }).limitation)
})
