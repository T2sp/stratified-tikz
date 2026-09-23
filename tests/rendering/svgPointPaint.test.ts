import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { clonePointStyle, getPointPaint, normalizePointStyle, defaultPointStyle } from '../../src/model/styles.ts'
import { hiddenPointStyleFromBase } from '../../src/model/visibility.ts'
import { pointStyleToSvgPaint } from '../../src/rendering/svgPointPaint.ts'
import { svgPointNodeLayout, pendingSvgPointNodeLayout } from '../../src/rendering/svgPointNodeLayout.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelRuntime, initialSvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'

const style = () => {
  const result = normalizePointStyle(defaultPointStyle)
  result.paint = {
    text: { color: '#FF0000', opacity: .8 },
    fill: { enabled: true, color: '#0000FF', opacity: .3 },
    stroke: { enabled: true, color: '#00FF00', opacity: .6, width: 4,
      lineStyle: 'dashed', dashPhase: 1, lineCap: 'rect', lineJoin: 'miter' },
  }
  return result
}
const measurement = { identity: 'point-paint-test',
  measure: (text: string) => ({ width: text.length * 6, ascent: 9, descent: 3 }),
  lineMetrics: () => ({ ascent: 9, descent: 3 }) }
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
function capture(source = 'plain', pointStyle = style()) {
  return captureSvgLabelExport({ runtime, source, pointStyle, position: { x: 100, y: 100 },
    color: '#FF0000', opacity: .8, fontSize: 12, anchor: 'center', boundsTarget: false,
    settings: svgLabelLayoutSettings(12) })
}

test('point contour uses separate operation alphas, named PGF dash lengths and no group alpha', () => {
  const mixed = style()
  mixed.opacity = .5
  assert.deepEqual(pointStyleToSvgPaint(mixed), {
    fill: '#0000FF', fillOpacity: .15, stroke: '#00FF00', strokeOpacity: .3,
    strokeWidth: 4.8, strokeDasharray: '3.5999999999999996 3.5999999999999996',
    strokeDashoffset: 1.2, strokeLinecap: 'square', strokeLinejoin: 'miter',
    strokeMiterlimit: 10, vectorEffect: 'non-scaling-stroke',
  })
  const dimmed = pointStyleToSvgPaint(hiddenPointStyleFromBase(mixed))
  // Visibility's established multiplier is .28; applied once to each operation.
  assert.equal(dimmed.fillOpacity, .15 * .28)
  assert.equal(dimmed.strokeOpacity, .3 * .28)
  assert.equal(dimmed.opacity, undefined)
})

test('white hollow, transparent fill, disabled border and zero alpha remain distinct', () => {
  assert.equal(pointStyleToSvgPaint({ ...defaultPointStyle, fill: 'hollow' }).fill, '#FFFFFF')
  const explicit = style()
  explicit.paint!.fill.enabled = false
  explicit.paint!.stroke.enabled = false
  assert.equal(pointStyleToSvgPaint(explicit).fill, 'none')
  assert.equal(pointStyleToSvgPaint(explicit).stroke, 'none')
  explicit.paint!.fill.enabled = true
  explicit.paint!.fill.opacity = 0
  assert.equal(pointStyleToSvgPaint(explicit).fill, '#0000FF')
  assert.equal(pointStyleToSvgPaint(explicit).fillOpacity, 0)
})

test('real MathJax paths inherit text paint while explicit math color and measured layout survive repaint', async () => {
  const input = capture(String.raw`plain $x+{\color{blue}y}$`)
  const [state] = await settleSvgExportLabels([input])
  assert.equal(state.status, 'ready')
  const before = renderSettledSvgLabelDocument(input, state)
  assert.match(before, /fill="#FF0000"/)
  assert.match(before, /fill="blue"/)
  const recolored = clonePointStyle(input.pointStyle!)
  recolored.paint!.text.color = '#00FF00'
  const after = renderSettledSvgLabelDocument(capture(input.source, recolored), state)
  assert.match(after, /fill="#00FF00"/)
  assert.match(after, /fill="blue"/)
  assert.deepEqual(svgPointNodeLayout(input.pointStyle!, state), svgPointNodeLayout(recolored, state))
  assert.equal(runtime.service.peek(input.source, input.settings), state.result)
})

test('pending and literal-fallback bodies share current paint and complete source', async () => {
  const source = '  $\\unknownPaintMacro$\t\n tail  '
  const input = capture(source)
  const pending = initialSvgLabelState(input, runtime)
  const [fallback] = await settleSvgExportLabels([input])
  assert.equal(fallback.status, 'fallback')
  for (const state of [pending, fallback]) {
    assert.equal(state.source, source)
    const markup = renderSettledSvgLabelDocument(input, state)
    assert.match(markup, /fill-opacity="0.3"/)
    assert.match(markup, /stroke-opacity="0.6"/)
    assert.match(markup, /opacity="0.8"/)
    assert.match(markup, /white-space:pre/)
    assert.equal(state.layout.placements.map((part) => part.kind === 'math' ? '' : part.text).join(''), source)
  }
})

test('whole-node click capture freezes every nested paint value and dash entry', async () => {
  const live = style()
  live.paint!.stroke.dashPattern = [2, 4]
  const input = capture('$x$', live)
  live.paint!.fill.color = '#FFFFFF'
  live.paint!.text.opacity = 0
  live.paint!.stroke.dashPattern[0] = 20
  const [state] = await settleSvgExportLabels([input])
  const markup = renderSettledSvgLabelDocument(input, state)
  assert.match(markup, /fill="#0000FF"/)
  assert.match(markup, /opacity="0.8"/)
  assert.match(markup, /stroke-dasharray="2.4 4.8"/)
  for (const value of [input.pointStyle, input.pointStyle!.paint, input.pointStyle!.paint!.text,
    input.pointStyle!.paint!.fill, input.pointStyle!.paint!.stroke, input.pointStyle!.paint!.stroke.dashPattern]) {
    assert.ok(Object.isFrozen(value))
  }
})

test('wide border expands painted bounds and picking without changing body or shape bounds', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const point = createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 }, style: style() })
  point.style.paint!.stroke.width = 20
  diagram.strata = [point]
  const layout = pendingSvgPointNodeLayout(point)
  assert.equal(layout.paintedBounds.maxX, layout.geometry.radius + 12)
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  const target = { x: center.x + layout.geometry.radius + 10, y: center.y }
  assert.equal(collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360, point: target })[0]?.id, 'p')
  getPointPaint(point.style).stroke.enabled = false
  const disabled = pendingSvgPointNodeLayout(point)
  assert.deepEqual(disabled.geometry, layout.geometry)
  assert.deepEqual(disabled.body, layout.body)
  assert.deepEqual(disabled.paintedBounds, disabled.geometry.bounds)
  assert.equal(collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360, point: target }).length, 0)
})

test('triangle miter tip has the independent 60-degree join extent and remains pickable', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const point = createPointStratum({ ambientDimension: 2, id: 'miter', position: { x: 0, y: 0, z: 0 }, style: style() })
  point.style.shape = 'triangle'
  point.style.paint!.stroke.width = 30
  diagram.strata = [point]
  const layout = pendingSvgPointNodeLayout(point)
  // 60-degree corner: half-width / sin(30 degrees) = full stroke width.
  assert.ok(Math.abs(layout.paintedBounds.minY - (layout.geometry.bounds.minY - 36)) < 1e-10)
  const center = projectToSvgPoint(diagram.camera, point.position, 360)
  const target = { x: center.x, y: center.y + layout.geometry.bounds.minY - 32 }
  assert.equal(collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360, point: target })[0]?.id, 'miter')
  point.style.paint!.stroke.lineJoin = 'bevel'
  assert.equal(collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight: 360, point: target }).length, 0)
})
