import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { serializeDiagram, parseSavedDiagramJson } from '../../src/model/serialization.ts'
import { createLabelService, type LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelRuntime, createSvgLabelController, initialSvgLabelState, type SvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { svgPointNodeLayout, currentSvgPointNodeGeometry, svgPointNodeOwner, type SvgPointNodeCommit } from '../../src/rendering/svgPointNodeLayout.ts'
import { svgPointNodeGeometry } from '../../src/rendering/svgPointNodeGeometry.ts'
import { svgPointNodeTextFontFamily } from '../../src/rendering/svgPointNodeText.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { captureSvgLabelExport } from '../../src/rendering/svgLabelExportRegistry.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { createDiagramHistory } from '../../src/ui/undo.ts'

const measurement: TextMeasurementProvider = {
  identity: 'point-test',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2, ascent: font.sizePx * .8, descent: font.sizePx * .2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * .8, descent: font.sizePx * .2 }),
}
const settings = svgLabelLayoutSettings(12, svgPointNodeTextFontFamily)
const runtime = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
const tick = () => new Promise<void>((done) => setImmediate(done))
function captured(source: string, shape: 'circle' | 'square' | 'triangle' | 'star' = 'circle') {
  const point = createPointStratum({ ambientDimension: 2, id: 'p', text: source, position: { x: 0, y: 0, z: 0 } })
  point.style.shape = shape
  return captureSvgLabelExport({ runtime, source, position: { x: 200, y: 180 }, fontSize: 12,
    fontFamily: svgPointNodeTextFontFamily, color: '#000000', opacity: 1, anchor: 'center',
    boundsTarget: false, ownerIdentity: svgPointNodeOwner(1, 'p'), settings, pointStyle: point.style })
}
function commit(state: SvgLabelState, shape: 'circle' | 'square' | 'triangle' | 'star' = 'circle'): SvgPointNodeCommit {
  const capture = captured(state.source, shape)
  return { source: state.source, ownerIdentity: capture.ownerIdentity!, fontGeneration: 0,
    shape, size: capture.pointStyle!.size, requestIdentity: state.requestIdentity,
    layout: svgPointNodeLayout(capture.pointStyle!, state) }
}

test('real point bodies share measured view, contour and native picking policy in both ambient dimensions', async () => {
  const sources = ['', '   ', '日本語 plain', '$x_1^2$', '\\(\\sqrt{x}\\)', '$$\\frac{a}{b}$$', '\\[g_j\\]',
    ' 前 $\\frac{a}{\\sqrt{b}}$ 後\nnext', '  $\\badPointMacro$\t\\bad\n tail  ']
  for (const source of sources) {
    const [state] = await settleSvgExportLabels([captured(source)])
    assert.equal(state.status, source.includes('bad') ? 'fallback' : 'ready')
    for (const shape of ['circle', 'square', 'triangle', 'star'] as const) {
      const entry = commit(state, shape)
      const { geometry, body, paintedBounds } = entry.layout
      assert.ok(Object.values(paintedBounds).every(Number.isFinite))
      assert.ok(geometry.bounds.minX <= body.bounds.minX && geometry.bounds.maxX >= body.bounds.maxX)
      const markup = renderSettledSvgLabelDocument(captured(source, shape), state)
      assert.match(markup, /data-point-contour="true"/)
      assert.ok(markup.includes(`data-point-shape-bounds="${Object.values(geometry.bounds).join(' ')}"`))
      if (source === '') assert.deepEqual(geometry, svgPointNodeGeometry(captured('', shape).pointStyle!, { width: 0, height: 0 }))
      if (source.includes('bad')) assert.equal(state.layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join(''), source)
      for (const ambientDimension of [2, 3] as const) {
        const diagram = createEmptyDiagram({ ambientDimension })
        const point = createPointStratum({ ambientDimension, id: 'p', text: source, position: { x: 0, y: 0, z: 1 } })
        point.style.shape = shape
        diagram.strata = [point]
        assert.equal(point.codim, ambientDimension)
        const center = projectToSvgPoint(diagram.camera, point.position, 360)
        const vertex = geometry.kind === 'circle' ? { x: geometry.radius, y: 0 } : geometry.vertices[0]
        const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointCommits: new Map([['p', entry]]),
          pointDocumentRevision: 1, pointFontGeneration: 0, showCoordinateAnchors: false }
        assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: center.x + vertex.x, y: center.y + vertex.y } })[0]?.id, 'p')
        assert.equal(collectSvgPreviewSelectionCandidates({ ...options, point: { x: center.x + geometry.radius + 8, y: center.y } }).length, 0)
        for (const changed of [{ ...point, text: 'obsolete' }, { ...point, style: { ...point.style, size: 50 } }])
          assert.equal(currentSvgPointNodeGeometry(changed, options.pointCommits, 1, 0), null)
        assert.equal(currentSvgPointNodeGeometry(point, options.pointCommits, 2, 0), null)
        assert.equal(currentSvgPointNodeGeometry(point, options.pointCommits, 1, 1), null)
        assert.equal(currentSvgPointNodeGeometry(point, new Map(), 1, 0), null)
      }
    }
  }
})

test('point A-B-C controller delivery, removal and reused owners cannot restore stale contour/body', async () => {
  const sources = ['$A$', '$\\frac{B}{B}$', '$C_j$']
  const results = await Promise.all(sources.map((source) => runtime.service.convert(source, settings)))
  const releases = new Map<string, (result: LabelConversionResult) => void>()
  const delayed = createSvgLabelRuntime({ measurement, service: { peek: () => undefined,
    convert: (source) => new Promise((resolve) => releases.set(source, resolve)) } })
  const controller = createSvgLabelController(delayed)
  let cleanup = () => {}
  for (const source of sources) {
    cleanup()
    cleanup = controller.start({ source, settings, ownerIdentity: svgPointNodeOwner(1, 'p') })
    await tick()
    assert.equal(controller.getSnapshot()!.source, source)
  }
  let current: SvgLabelState | undefined
  for (const index of [2, 0, 1]) {
    releases.get(sources[index])!(results[index]); await tick()
    assert.equal(controller.getSnapshot()!.source, sources[2])
    current ??= controller.getSnapshot()!
    assert.deepEqual(controller.getSnapshot(), current)
    assert.deepEqual(commit(controller.getSnapshot()!).layout.geometry, commit(current).layout.geometry)
  }
  cleanup()
  controller.start({ source: '  $bad\t\n ', settings, ownerIdentity: svgPointNodeOwner(2, 'p') })()
  await tick()
  assert.equal(controller.getSnapshot()!.source, '  $bad\t\n ')
})

test('pending whole-point export settles an immutable captured source/style/position and leaves model/history/TikZ unchanged', async () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const raw = ' 日本 $\\frac{a_1}{\\sqrt{x}}$ '
  const point = createPointStratum({ ambientDimension: 3, id: 'p', text: raw, position: { x: 1, y: 2, z: 3 } })
  diagram.strata = [point]
  const history = createDiagramHistory(diagram)
  const before = [serializeDiagram(diagram), JSON.stringify(history), generateTikz(diagram), generateTikz(diagram, { exportMode: 'inlineMath' })]
  const capture = captured(raw, 'star')
  const pending = initialSvgLabelState(capture, createSvgLabelRuntime({ measurement, service: { peek: () => undefined, convert: runtime.service.convert } }))
  const [settled] = await settleSvgExportLabels([capture])
  assert.notEqual(svgPointNodeLayout(capture.pointStyle!, pending).geometry.radius, svgPointNodeLayout(capture.pointStyle!, settled).geometry.radius)
  const markup = renderSettledSvgLabelDocument(capture, settled)
  assert.match(markup, /data-label-math="true"/)
  assert.match(markup, /translate\(200 180\)/)
  assert.ok(Object.isFrozen(capture.pointStyle) && Object.isFrozen(capture.position))
  assert.deepEqual([serializeDiagram(diagram), JSON.stringify(history), generateTikz(diagram), generateTikz(diagram, { exportMode: 'inlineMath' })], before)
  const loaded = parseSavedDiagramJson(before[0]); assert.ok(loaded.ok)
  assert.equal(loaded.diagram.strata[0].geometricKind, 'point')
  assert.ok(before[2].includes(raw) && before[3].includes(raw))
})

test('point export deadline and failed conversions retain exact literal source and use its contour', async () => {
  const source = '  <>& $\\bad$\t\n tail  '
  const capture = captured(source)
  const failed = { ...capture, runtime: createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined, convert: () => new Promise(() => {}),
  } }) }
  const [state] = await settleSvgExportLabels([failed], undefined, { settlementMs: 5 })
  assert.equal(state.status, 'fallback')
  assert.equal(state.layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join(''), source)
  const view = renderSettledSvgLabelDocument(failed, state)
  assert.doesNotMatch(view, /data-label-math/)
  assert.match(view, /white-space:pre/)
  assert.match(view, /&lt;&gt;&amp;/)
})

test('font readiness remeasurement changes pending point body, contour and matching picking together', async () => {
  let ready!: () => void
  let widthScale = .25
  const fontMeasurement: TextMeasurementProvider = { ...measurement,
    identity: 'point-late-font', measure: (text, font) => ({ width: text.length * font.sizePx * widthScale, ascent: 9, descent: 3 }),
    ready: () => new Promise<void>((resolve) => { ready = resolve }),
  }
  const controlled = createSvgLabelRuntime({ measurement: fontMeasurement, service: {
    peek: () => undefined, convert: () => new Promise(() => {}),
  } })
  const controller = createSvgLabelController(controlled)
  const source = '  pending $font\t\n '
  const stop = controller.start({ source, settings, ownerIdentity: svgPointNodeOwner(1, 'p') })
  await tick()
  const before = commit(controller.getSnapshot()!)
  widthScale = 1
  ready(); await tick()
  const after = commit(controller.getSnapshot()!)
  assert.ok(after.layout.geometry.radius > before.layout.geometry.radius)
  assert.ok(after.layout.body.bounds.maxX > before.layout.body.bounds.maxX)
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: source, position: { x: 0, y: 0, z: 0 } })]
  const center = projectToSvgPoint(diagram.camera, { x: 0, y: 0, z: 0 }, 360)
  const options = { diagram, camera: diagram.camera, viewportHeight: 360, pointDocumentRevision: 1,
    point: { x: center.x + after.layout.geometry.radius - 1, y: center.y } }
  assert.equal(collectSvgPreviewSelectionCandidates({ ...options, pointCommits: new Map([['p', before]]) }).length, 0)
  assert.equal(collectSvgPreviewSelectionCandidates({ ...options, pointCommits: new Map([['p', after]]) })[0]?.id, 'p')
  const markup = renderSettledSvgLabelDocument(captured(source), controller.getSnapshot()!)
  assert.match(markup, new RegExp(`r="${after.layout.geometry.radius}"`))
  stop()
})
