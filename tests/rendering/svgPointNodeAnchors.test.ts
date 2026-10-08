import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import type { PointShape, PointStyle } from '../../src/model/types.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelController, createSvgLabelRuntime, initialSvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { svgPointNodeLayout, currentSvgPointNodeLayout, svgPointNodeOwner } from '../../src/rendering/svgPointNodeLayout.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'

const measurement: TextMeasurementProvider = { identity: '32d-point-layout-font',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2, ascent: .8 * font.sizePx, descent: .2 * font.sizePx }),
  lineMetrics: (font) => ({ ascent: .8 * font.sizePx, descent: .2 * font.sizePx }) }
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
const settings = svgLabelLayoutSettings(12, svgPointNodeTextFontFamily)
const shapes: readonly PointShape[] = ['circle', 'rectangle', 'ellipse', 'diamond', 'square', 'triangle', 'regular polygon',
  'star', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
const tick = () => new Promise<void>((done) => setImmediate(done))
function capture(source: string, style: PointStyle, labelRuntime = runtime) {
  return captureSvgLabelExport({ runtime: labelRuntime, source, pointStyle: style,
    position: { x: 123, y: 87 }, fontSize: 12, fontFamily: svgPointNodeTextFontFamily,
    color: '#000000', opacity: 1, anchor: 'center', settings, ownerIdentity: svgPointNodeOwner(1, 'p') })
}
function pointStyle(shape: PointShape, anchor = 'east'): PointStyle {
  return { ...createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style,
    shape, layout: { innerXSep: 2, innerYSep: .5, outerXSep: 1.25, outerYSep: .75,
      minimumWidth: 30, minimumHeight: 20, anchor } }
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`) }

for (const shape of shapes) test(`${shape}: one anchor placement serves contour, body and boundary picking in 2D/3D`, async () => {
  const style = pointStyle(shape)
  const source = '前 $\\frac{x}{y}$ 後'
  const captured = capture(source, style)
  const [state] = await settleSvgExportLabels([captured])
  assert.equal(state.status, 'ready')
  const layout = svgPointNodeLayout(style, state)
  assert.equal(layout.geometry.limitation, undefined)
  assert.ok(layout.geometry.solution)
  close(layout.selectedAnchor.x + layout.placementOffset.x, 0)
  close(layout.selectedAnchor.y + layout.placementOffset.y, 0)
  assert.ok(layout.selectedAnchor.x > 0)
  const markup = renderSettledSvgLabelDocument(captured, state)
  assert.match(markup, /transform="translate\(123 87\)"/)
  assert.match(markup, /data-point-anchor="east"/)
  assert.match(markup, /data-label-math="true"/)
  assert.ok(markup.includes(`data-point-shape-bounds="${Object.values(layout.shapeBounds).join(' ')}"`))
  for (const ambientDimension of [2, 3] as const) {
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.camera = diagram.camera.mode === '2d'
      ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
      : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
    const point = createPointStratum({ ambientDimension, id: 'p', text: source, position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 } })
    point.style = style
    diagram.strata = [point]
    const entry = { source, ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0,
      shape, size: style.size, requestIdentity: state.requestIdentity, layout }
    const placement = projectToSvgPoint(diagram.camera, point.position, 360)
    const boundary = layout.geometry.kind === 'circle' ? { x: layout.geometry.radius, y: 0 } : layout.geometry.vertices[0]
    const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: new Map([['p', entry]]),
      pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: {
      x: placement.x + layout.placementOffset.x + boundary.x, y: placement.y + layout.placementOffset.y + boundary.y } })[0]?.id, 'p')
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: {
      x: placement.x + layout.placementOffset.x + layout.geometry.radius + 9, y: placement.y + layout.placementOffset.y } }).length, 0)
    assert.deepEqual(point.position, { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 })
    for (const changed of [{ ...style, layout: { ...style.layout, anchor: 'west' } },
      { ...style, layout: { ...style.layout, outerXSep: 2 } }, { ...style, layout: { ...style.layout, minimumHeight: 90 } }]) {
      assert.equal(currentSvgPointNodeLayout({ ...point, style: changed }, options.pointCommits, 1, 0), null)
    }
  }
})

test('outer separation changes anchor clearance and placement, without enlarging paint or hit geometry', async () => {
  const style = pointStyle('rectangle', 'center')
  const [state] = await settleSvgExportLabels([capture('body', style)])
  const before = svgPointNodeLayout(style, state)
  const changed = svgPointNodeLayout({ ...style, layout: { ...style.layout, outerXSep: 80, outerYSep: 60 } }, state)
  assert.deepEqual(changed.geometry.bounds, before.geometry.bounds)
  assert.deepEqual(changed.paintedBounds, before.paintedBounds)
  assert.equal(changed.selectionRadius, before.selectionRadius)
  assert.ok(changed.anchorClearanceBounds.maxX > before.anchorClearanceBounds.maxX)
  assert.ok(changed.anchorClearanceBounds.maxY > before.anchorClearanceBounds.maxY)
})

test('visible body outside a negatively padded contour remains pickable without including anchor clearance', async () => {
  const source = 'wide visible body'
  const style = { ...pointStyle('rectangle'), layout: { innerXSep: -20, innerYSep: -3,
    outerXSep: 60, outerYSep: 50, minimumWidth: 0, minimumHeight: 0, anchor: 'east' } }
  const [state] = await settleSvgExportLabels([capture(source, style)])
  const layout = svgPointNodeLayout(style, state)
  assert.ok(layout.body.bounds.minX < layout.shapeBounds.minX - 6)
  const localBodyCorner = {
    x: layout.body.bounds.minX - layout.placementOffset.x,
    y: layout.body.bounds.minY - layout.placementOffset.y,
  }
  assert.ok(layout.selectionRadius >= Math.hypot(localBodyCorner.x, localBodyCorner.y))
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const point = createPointStratum({ ambientDimension: 2, id: 'p', text: source, position: { x: 0, y: 0, z: 0 } })
  point.style = style; diagram.strata = [point]
  const projected = projectToSvgPoint(diagram.camera, point.position, 360)
  const entry = { source, ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0,
    shape: style.shape, size: style.size, requestIdentity: state.requestIdentity, layout }
  const options = { diagram, camera: diagram.camera, viewportHeight: 360,
    pointCommits: new Map([['p', entry]]), pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
  assert.equal(collectSvgPreviewSelectionCandidates({ ...options,
    point: { x: projected.x + layout.body.bounds.minX + 1, y: projected.y + layout.placementOffset.y } })[0]?.id, 'p')
  assert.equal(collectSvgPreviewSelectionCandidates({ ...options,
    point: { x: projected.x + layout.anchorClearanceBounds.minX, y: projected.y } }).length, 0)
})

test('baseline, mid and text anchors use measured first baseline/depth and actual advance origin', async () => {
  const overhang: TextMeasurementProvider = { ...measurement, identity: '32d-overhanging-font',
    measure: (text, font) => ({ width: text.length * font.sizePx / 2, ascent: 8, descent: 4, inkLeft: -3, inkRight: text.length * font.sizePx / 2 + 1 }),
    lineMetrics: () => ({ ascent: 8, descent: 4 }) }
  const measuredRuntime = createSvgLabelRuntime({ measurement: overhang, service: createLabelService({ measurement: overhang }) })
  for (const anchor of ['base', 'mid', 'text']) {
    const style = pointStyle('rectangle', anchor)
    const [state] = await settleSvgExportLabels([capture('text\nnext', style, measuredRuntime)])
    const layout = svgPointNodeLayout(style, state)
    if (anchor === 'base' || anchor === 'text') close(layout.baseline, 0)
    if (anchor === 'mid') close(layout.baseline, 4.30554 * 1.2 / 2)
    if (anchor === 'text') close(layout.body.offsetX, 0)
    assert.notEqual(layout.body.bounds.minX, layout.body.offsetX)
  }
})

test('saved em/ex conversion context changes dimensions without inventing a typography or mid-anchor override', async () => {
  const style = pointStyle('rectangle', 'mid')
  style.layout!.fontContext = { fontSizePt: 12, xHeightPt: 5.2 }
  style.layout!.innerXSep = 24
  style.layout!.units = { innerXSep: { source: '2em', unit: 'em', texPoints: 24 } }
  const [state] = await settleSvgExportLabels([capture('same font', style)])
  const layout = svgPointNodeLayout(style, state)
  close(layout.baseline, 4.30554 * 1.2 / 2)
  const defaultContext = svgPointNodeLayout({ ...style, layout: { ...style.layout, fontContext: undefined, units: undefined } }, state)
  assert.deepEqual(layout.shapeBounds, defaultContext.shapeBounds)
  assert.deepEqual(layout.body, defaultContext.body)
  const markup = renderSettledSvgLabelDocument(capture('same font', style), state)
  assert.match(markup, /font-size="12"/)
})

test('pending-success-invalid-recovery and immutable export keep the selected model anchor', async () => {
  const style = pointStyle('isosceles triangle', 'apex')
  const sources = ['$x$', '$\\frac{xxxxxxxx}{\\sqrt{y}}$', '  $\\unknownPointAnchor$\t\n tail ', '$z_j$']
  const observedOffsets: number[] = []
  for (const source of sources) {
    const captured = capture(source, style)
    const pending = initialSvgLabelState(captured, captured.runtime)
    const [settled] = await settleSvgExportLabels([captured])
    for (const state of [pending, settled]) {
      const layout = svgPointNodeLayout(style, state)
      close(layout.selectedAnchor.x + layout.placementOffset.x, 0)
      close(layout.selectedAnchor.y + layout.placementOffset.y, 0)
      observedOffsets.push(layout.placementOffset.x)
      assert.match(renderSettledSvgLabelDocument(captured, state), /transform="translate\(123 87\)"/)
    }
  }
  assert.ok(new Set(observedOffsets).size > 2)
  const source = sources[1]
  style.layout!.units = { innerXSep: { source: '.2em', unit: 'em', texPoints: 2 } }
  style.layout!.fontContext = { fontSizePt: 10, xHeightPt: 4.30554 }
  const captured = capture(source, style)
  const immutable = JSON.stringify(captured.pointStyle)
  style.layout!.anchor = 'west'
  style.layout!.fontContext.fontSizePt = 20
  style.layout!.units.innerXSep!.source = '99pt'
  style.layout!.innerXSep = 99
  assert.equal(JSON.stringify(captured.pointStyle), immutable)
  assert.ok(Object.isFrozen(captured.pointStyle!.layout) && Object.isFrozen(captured.pointStyle!.layout!.fontContext)
    && Object.isFrozen(captured.pointStyle!.layout!.units!.innerXSep)
    && Object.isFrozen(captured.pointStyle!.layout!.units!.innerXSep!.fontContext))
  assert.equal(captured.pointStyle!.layout!.units!.innerXSep!.fontContext?.fontSizePt, 10)
  const [state] = await settleSvgExportLabels([captured])
  const markup = renderSettledSvgLabelDocument(captured, state)
  assert.match(markup, /data-point-anchor="apex"/)
  assert.match(markup, /data-label-math="true"/)
})

test('unsupported anchor remains diagnosed and does not paint a silently centered requested shape', async () => {
  const style = pointStyle('ellipse', 'apex')
  const [state] = await settleSvgExportLabels([capture('raw $x$', style)])
  const layout = svgPointNodeLayout(style, state)
  assert.ok(layout.geometry.limitation)
  assert.equal(layout.stroke, 0)
  const markup = renderSettledSvgLabelDocument(capture('raw $x$', style), state)
  assert.match(markup, /data-point-shape-warning/)
  assert.doesNotMatch(markup, /data-point-contour/)
  assert.equal(style.layout!.anchor, 'apex')
  const cylinder: PointStyle = { ...style, shape: 'cylinder', shapeParameters: {
    cylinderUsesCustomFill: true, cylinderBodyFill: '#1122AA', cylinderEndFill: '#CC3322' } }
  const markupCylinder = renderSettledSvgLabelDocument(capture('raw $x$', cylinder), state)
  assert.match(markupCylinder, /data-point-shape-warning/)
  assert.doesNotMatch(markupCylinder, /data-point-contour|data-point-paint-region|data-point-internal-border/)
})

test('unavailable contours do not retain hidden-shape picking, warning placement or selection bounds', async () => {
  for (const ambientDimension of [2, 3] as const) for (const shape of ['ellipse', 'circle', 'cylinder'] as const) {
    const source = 'x'
    const style = { ...pointStyle(shape, 'missing anchor'), layout: { anchor: 'missing anchor', minimumWidth: 1000, minimumHeight: 1000 } }
    const [state] = await settleSvgExportLabels([capture(source, style)])
    const layout = svgPointNodeLayout(style, state)
    assert.ok(layout.geometry.limitation)
    assert.ok(layout.shapeBounds.maxX > 500, 'requested shape metadata remains distinct')
    assert.ok(layout.selectionRadius < 30, 'selection encloses only the visible body and warning')
    assert.ok(layout.warningBounds && Math.abs(layout.warningBounds.minX) < 20)
    assert.deepEqual(layout.paintedBounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 }, 'no contour is painted')
    const diagram = createEmptyDiagram({ ambientDimension })
    const point = createPointStratum({ ambientDimension, id: 'p', text: source, position: { x: 0, y: 0, z: 0 } })
    point.style = style; diagram.strata = [point]
    const projected = projectToSvgPoint(diagram.camera, point.position, 360)
    const entry = { source, ownerIdentity: svgPointNodeOwner(1, 'p'), fontGeneration: 0,
      shape: style.shape, size: style.size, requestIdentity: state.requestIdentity, layout }
    const options = { diagram, camera: diagram.camera, viewportHeight: 360,
      pointCommits: new Map([['p', entry]]), pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: projected })[0]?.id, 'p')
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: projected.x + 100, y: projected.y } }).length, 0)
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options,
      point: { x: projected.x + layout.warningBounds.minX, y: projected.y + layout.warningBounds.minY } })[0]?.id, 'p')
  }
})

test('font readiness and stale owner completion cannot restore an obsolete noncentral placement', async () => {
  let ready!: () => void
  let width = .25
  const lateFont: TextMeasurementProvider = { ...measurement, identity: '32d-late-font',
    measure: (text, font) => ({ width: text.length * font.sizePx * width, ascent: 9, descent: 3 }),
    ready: () => new Promise<void>((resolve) => { ready = resolve }) }
  const controlled = createSvgLabelRuntime({ measurement: lateFont, service: { peek: () => undefined, convert: () => new Promise(() => {}) } })
  const controller = createSvgLabelController(controlled)
  const style = pointStyle('rectangle', 'east')
  const stop = controller.start({ source: 'pending wide body', settings, ownerIdentity: svgPointNodeOwner(1, 'p') })
  await tick()
  const before = svgPointNodeLayout(style, controller.getSnapshot()!)
  width = 1; ready(); await tick()
  const after = svgPointNodeLayout(style, controller.getSnapshot()!)
  assert.ok(after.selectedAnchor.x > before.selectedAnchor.x)
  close(after.selectedAnchor.x + after.placementOffset.x, 0)
  stop()
  controller.start({ source: 'loaded replacement', settings, ownerIdentity: svgPointNodeOwner(2, 'p') })()
  await tick()
  assert.equal(controller.getSnapshot()!.source, 'loaded replacement')
})
