import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { pointNodeDimensionFields, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { PointShape, PointStyle, Vec2, WorkPlane } from '../../src/model/types.ts'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { createSvgLabelController, createSvgLabelRuntime, initialSvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { svgPointNodeLayout, currentSvgPointNodeLayout, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { SvgPointNodeView } from '../../src/rendering/svgPointNodeView.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { collectSvgPreviewSelectionCandidates, nextSvgPreviewSelectionCycle } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

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

// These fixed metrics reproduce the independent PGF 20/8/3pt body at the
// production 1.2 SVG-unit/TeX-pt scale. They are not native/font evidence.
const signedMeasurement: TextMeasurementProvider = { identity: '32d-signed-fixed-20-8-3',
  measure: () => ({ width: 24, ascent: 9.6, descent: 3.6 }),
  lineMetrics: () => ({ ascent: 9.6, descent: 3.6 }) }
const signedRuntime = createSvgLabelRuntime({ measurement: signedMeasurement, service: createLabelService({ measurement: signedMeasurement }) })

function signedStyle(shape: PointShape, anchor = 'center', dimensions = [-100, -100, 0, 0, -160, -160]): PointStyle {
  let style: PointStyle = { ...pointStyle(shape, anchor), layout: { anchor, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } } }
  for (const [index, field] of pointNodeDimensionFields.entries()) {
    const updated = updatePointNodeDimension(style, [field], ` ${dimensions[index]}pt `)
    assert.ok(updated)
    style = updated
  }
  return style
}

function signedCommit(source: string, style: PointStyle, requestIdentity: string,
  layout: ReturnType<typeof svgPointNodeLayout>, id = 'p'): SvgPointNodeCommit {
  return { source, ownerIdentity: svgPointNodeOwner(1, id), fontGeneration: 0,
    shape: style.shape, size: style.size, requestIdentity, layout }
}

test('negative fitted axes keep PGF placement in pending/current/settled SVG and signed authored save/TikZ data', async () => {
  for (const shape of ['ellipse', 'rectangle'] as const) {
    for (const { source, dimensions, anchor, expected } of [
      { source: '', dimensions: [-100, -100, 0, 0, -160, -160], anchor: 'east', expected: { x: -96, y: 0 } },
      { source: '', dimensions: [-100, -100, 0, 0, -160, -160], anchor: 'north', expected: { x: 0, y: 96 } },
      { source: 'x', dimensions: [-30, -30, 0, 0, -2, -5], anchor: 'east', expected: { x: -1.2, y: 0 } },
      { source: 'x', dimensions: [-30, 2, 2, -20, -2, -5], anchor: 'east', expected: { x: 1.2, y: 0 } },
    ]) {
      const style = signedStyle(shape, anchor, dimensions)
      const diagram = createEmptyDiagram({ ambientDimension: 2 })
      const point = createPointStratum({ ambientDimension: 2, id: 'p', text: source, position: { x: 1, y: 2, z: 0 }, style })
      diagram.strata = [point]
      const before = structuredClone(point)
      assert.equal(validateDiagram(diagram).valid, true)
      const saved = serializeDiagram(diagram)
      assert.equal((JSON.parse(saved) as { version: number }).version, 2)
      const loaded = parseSavedDiagramJson(saved)
      assert.ok(loaded.ok)
      const loadedPoint = loaded.diagram.strata[0]
      assert.equal(loadedPoint.geometricKind, 'point')
      if (loadedPoint.geometricKind !== 'point') throw new Error('Expected loaded point')
      assert.deepEqual(loadedPoint.style.layout, point.style.layout)
      assert.equal(loadedPoint.style.layout?.units?.innerXSep?.source, ` ${dimensions[0]}pt `)
      assert.deepEqual(loadedPoint.position, { x: 1, y: 2, z: 0 })
      assert.equal(loadedPoint.text, source)
      const captured = capture(source, point.style, signedRuntime)
      const pending = initialSvgLabelState(captured, captured.runtime)
      const [settled] = await settleSvgExportLabels([captured])
      assert.equal(settled.status, 'ready')
      for (const state of [pending, settled]) {
        const layout = svgPointNodeLayout(point.style, state)
        assert.equal(layout.geometry.limitation, undefined)
        close(layout.selectedAnchor.x, expected.x)
        close(layout.selectedAnchor.y, expected.y)
        close(layout.placementOffset.x, -expected.x)
        close(layout.placementOffset.y, -expected.y)
        assert.ok(layout.geometry.bounds.minX <= layout.geometry.bounds.maxX && layout.geometry.bounds.minY <= layout.geometry.bounds.maxY)
        const commits = new Map([['p', signedCommit(source, point.style, state.requestIdentity, layout)]])
        assert.equal(currentSvgPointNodeLayout(point, commits, 1, 0), layout)
        const preview = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' },
          createElement(SvgPointNodeView, { capture: captured, state })))
        const exported = renderSettledSvgLabelDocument(captured, state)
        assert.equal(preview, exported, 'preview and detached export share the same body/contour placement')
        assert.ok(exported.includes(`data-point-anchor-offset="${layout.selectedAnchor.x} ${layout.selectedAnchor.y}"`))
        assert.ok(exported.includes(`transform="translate(${layout.placementOffset.x} ${layout.placementOffset.y})"`))
        assert.match(exported, /transform="translate\(123 87\)"/)
      }
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const tikz = generateTikz(loaded.diagram, { exportMode })
        for (const [index, key] of ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height'].entries()) {
          assert.ok(tikz.includes(`${key}=${dimensions[index]}pt`), `${shape} ${exportMode}: ${key}`)
        }
        assert.ok(tikz.includes(`anchor=${anchor}`))
        assert.match(tikz, /at \(1,2\)/)
        assert.ok(tikz.includes(`{${source}}`), 'raw source keeps its existing TikZ convention')
      }
      assert.deepEqual(point, before, 'placement and export leave the model and authored signed values untouched')
    }
  }
})

test('negative ellipse paint is pickable at the review oblique point, empty center and dominant mixed axes in 2D/3D', async () => {
  const cases: { ambientDimension: 2 | 3; source: string; dimensions: number[]; localPoint: Vec2; plane: WorkPlane }[] = [
    { ambientDimension: 2, source: 'x', dimensions: [-100, -100, 0, 0, -160, -160], localPoint: { x: 67.2, y: -67.2 }, plane: { kind: 'xy', z: 7 } },
    { ambientDimension: 3, source: '', dimensions: [-100, -100, 0, 0, -160, -160], localPoint: { x: 0, y: 0 }, plane: { kind: 'xy', z: 3 } },
    { ambientDimension: 3, source: 'x', dimensions: [-100, 2, 0, 0, -160, -160], localPoint: { x: 67.2, y: -6 }, plane: { kind: 'xz', y: 2 } },
    { ambientDimension: 2, source: '', dimensions: [2, -100, 0, 0, -160, -160], localPoint: { x: 1.5, y: -67.2 }, plane: { kind: 'xy', z: 0 } },
  ]
  for (const { ambientDimension, source, dimensions, localPoint, plane } of cases) {
    const diagram = createEmptyDiagram({ ambientDimension })
    diagram.camera = diagram.camera.mode === '2d'
      ? { ...diagram.camera, scale: 43, origin: { x: 7, y: -4 } }
      : { ...diagram.camera, thetaDeg: 31, phiDeg: 27, zoom: 43, pan: { x: 7, y: -4 } }
    const point = createPointStratum({ ambientDimension, id: 'p', text: source,
      position: { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 }, style: signedStyle('ellipse', 'center', dimensions) })
    diagram.strata = [point]
    const captured = capture(source, point.style, signedRuntime)
    const [state] = await settleSvgExportLabels([captured])
    const layout = svgPointNodeLayout(point.style, state)
    assert.equal(layout.geometry.limitation, undefined)
    assert.ok(layout.geometry.solution)
    const center = projectToSvgPoint(diagram.camera, point.position, 360)
    const inverse = svgPointToModelOnWorkPlane(diagram.camera, center, 360, plane)
    close(inverse.x, point.position.x); close(inverse.y, point.position.y); close(inverse.z, point.position.z)
    if (ambientDimension === 2) assert.equal(inverse.z, 0, '2D cursor coordinates remain on z=0')
    const entry = signedCommit(source, point.style, state.requestIdentity, layout)
    const pointCommits = new Map([['p', entry]])
    const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits,
      pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
    const hit = { x: center.x + localPoint.x, y: center.y + localPoint.y }
    assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: hit })[0]?.id, 'p')
    const outside = { x: center.x + layout.geometry.bounds.maxX + 9, y: center.y }
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: outside }), [], 'existing six-unit clearance excludes genuinely outside paint')
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, pointDocumentRevision: 2 }), [], 'obsolete owner cannot pick')
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, pointFontGeneration: 1 }), [], 'obsolete font cannot pick')
    assert.equal(currentSvgPointNodeLayout({ ...point, text: `${source}changed` }, pointCommits, 1, 0), null, 'obsolete source cannot restore the contour')
    assert.equal(currentSvgPointNodeLayout({ ...point, style: { ...point.style, layout: { ...point.style.layout, minimumWidth: -2 } } }, pointCommits, 1, 0), null, 'obsolete layout cannot restore the contour')
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, layerFilter: { kind: 'layer', layer: 1 } }), [], 'filter remains authoritative')
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit, visibility: { hiddenPointIds: new Set(['p']) } }), [], 'hidden owner remains excluded')
    diagram.layers = [{ value: 0, name: 'Points', locked: true }]
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit }), [], 'locked layer remains excluded')
    diagram.layers = [{ value: 0, name: 'Points', visible: false }]
    assert.deepEqual(collectSvgPreviewSelectionCandidates({ ...options, point: hit }), [], 'hidden layer remains excluded')
    diagram.layers = [{ value: 0, name: 'Points' }]
    const overlap = { ...structuredClone(point), id: 'overlap' }
    diagram.strata.push(overlap)
    pointCommits.set('overlap', signedCommit(source, overlap.style, state.requestIdentity, layout, 'overlap'))
    const candidates = collectSvgPreviewSelectionCandidates({ ...options, point: hit })
    assert.deepEqual(new Set(candidates.map(candidate => candidate.id)), new Set(['p', 'overlap']))
    // Pure production cycling verifies the candidate contract. Native Alt
    // success is established only by the required browser workflow.
    const first = nextSvgPreviewSelectionCycle(null, hit, candidates)
    const second = nextSvgPreviewSelectionCycle(first.state, hit, candidates)
    assert.deepEqual(new Set([first.candidate?.id, second.candidate?.id]), new Set(['p', 'overlap']))
    assert.equal(first.count, 2); assert.equal(second.count, 2)
    assert.deepEqual(point.position, { x: 1, y: 2, z: ambientDimension === 3 ? 3 : 0 })
    assert.equal(point.codim, ambientDimension)
  }
})
