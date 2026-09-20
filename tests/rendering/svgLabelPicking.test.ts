import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import {
  labelAnchors,
  type AmbientDimension,
  type Camera,
  type Diagram,
  type TextLabel,
  type Vec2,
} from '../../src/model/types.ts'
import {
  collectSvgPreviewSelectionCandidates,
  createSvgSelectionCandidateVisibility,
  nextSvgPreviewSelectionCycle,
  type CollectSvgPreviewSelectionCandidatesOptions,
} from '../../src/rendering/svgHitTesting.ts'
import type { SvgFreeLabelBounds } from '../../src/rendering/svgLabelBounds.ts'
import { parseLabelText } from '../../src/rendering/labelText.ts'
import { composeLabelLayout, type TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import {
  literalSvgLabelLayout,
  placeSvgLabel,
  svgLabelLayoutSettings,
} from '../../src/rendering/labels/svgLabelLayout.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { mapClientPointToViewBox } from '../../src/rendering/svgViewBox.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { updateSelectionForClick } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

const viewportHeight = 600
const compactBounds = Object.freeze({ minX: -12, minY: -40, maxX: 12, maxY: 40 })

function fixture(ambientDimension: AmbientDimension = 2, source = '$\\frac{F^{(1)}L}{g}$') {
  const diagram = createEmptyDiagram({ ambientDimension })
  const label = createTextLabel({
    ambientDimension,
    id: 'free-label',
    text: source,
    position: { x: 1, y: 2, z: 3 },
  })
  diagram.labels = [label]
  return { diagram, label }
}

function snapshot(
  label: TextLabel,
  bounds: SvgFreeLabelBounds['bounds'] = compactBounds,
): SvgFreeLabelBounds {
  return Object.freeze({
    source: label.text,
    fontSize: label.style.fontSize * 1.35,
    anchor: label.style.anchor,
    bounds,
  })
}

function optionsAt(
  diagram: Diagram,
  label: TextLabel,
  offset: Vec2 = { x: 0, y: 0 },
  bounds = snapshot(label),
  camera = diagram.camera,
): CollectSvgPreviewSelectionCandidatesOptions {
  const position = projectToSvgPoint(camera, label.position, viewportHeight)
  return {
    diagram,
    camera,
    viewportHeight,
    point: { x: position.x + offset.x, y: position.y + offset.y },
    labelBounds: new Map([[label.id, bounds]]),
    showCoordinateAnchors: false,
  }
}

function labelIds(options: CollectSvgPreviewSelectionCandidatesOptions): string[] {
  return collectSvgPreviewSelectionCandidates(options)
    .filter((candidate) => candidate.kind === 'label')
    .map((candidate) => candidate.id)
}

test('compiled free-label picking uses displayed tall bounds instead of raw TeX character count', () => {
  const { diagram, label } = fixture(2, '$\\frac{\\mathrm{manySourceCharacters}}{\\mathrm{stillMoreCharacters}}$')
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 39 })), [label.id])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 100, y: 0 })), [])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: -100, y: 0 })), [])
})

const measurement: TextMeasurementProvider = {
  identity: 'svg-label-picking-metrics',
  measure: (text, font) => ({ width: [...text].length * font.sizePx * 0.5,
    ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}

test('all nine anchors pick the shared measured multiline math bounds in 2D and 3D', () => {
  const source = '$\\frac{F^{(1)}L}{g}$\r\n図と降下字 g'
  const parsed = parseLabelText(source)
  assert.equal(parsed.kind, 'parsed')
  if (parsed.kind !== 'parsed') assert.fail('Expected mixed text/math runs')
  for (const { ambientDimension, camera } of cameraCases) {
    for (const anchor of labelAnchors) {
      for (const modelFontSize of [10, 24]) {
        const { diagram, label } = fixture(ambientDimension, source)
        label.style.anchor = anchor
        label.style.fontSize = modelFontSize
        const fontSize = modelFontSize * 1.35
        const layout = composeLabelLayout(parsed.runs,
          [{ width: 4.5, ascent: 2, descent: 1.2 }], svgLabelLayoutSettings(fontSize), measurement)
        assert.equal(layout.lines.length, 2)
        const { bounds } = placeSvgLabel(layout, fontSize, anchor)
        assert.ok(Math.abs(bounds.maxX - bounds.minX - layout.metrics.width * fontSize) < 1e-8)
        assert.ok(Math.abs(bounds.maxY - bounds.minY - (layout.bounds.maxY - layout.bounds.minY) * fontSize) < 1e-8)
        if (anchor.includes('north')) assert.equal(bounds.minY, 0)
        else if (anchor.includes('south')) assert.equal(bounds.maxY, 0)
        else assert.ok(Math.abs(bounds.minY + bounds.maxY) < 1e-8)
        if (anchor.includes('east')) assert.equal(bounds.maxX, 0)
        else if (anchor.includes('west')) assert.equal(bounds.minX, 0)
        else assert.ok(Math.abs(bounds.minX + bounds.maxX) < 1e-8)
        const committed = snapshot(label, bounds)
        for (const corner of [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.minX, y: bounds.maxY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
        ]) {
          assert.deepEqual(labelIds(optionsAt(diagram, label, corner, committed, camera)), [label.id])
        }
        assert.deepEqual(labelIds(optionsAt(diagram, label,
          { x: bounds.maxX + 15, y: bounds.maxY }, committed, camera)), [])
      }
    }
  }
})

test('literal source fallback and compatibility picking share physical-line and tab layout', () => {
  const source = '  <>& "quotes" \\bad\t  \r\nsecond line\nlast  '
  const { diagram, label } = fixture(2, source)
  label.style.anchor = 'north west'
  const fontSize = label.style.fontSize * 1.35
  const literal = literalSvgLabelLayout(source, svgLabelLayoutSettings(fontSize))
  assert.equal(literal.layout.lines.length, 3)
  const { bounds } = placeSvgLabel(literal.layout, fontSize, label.style.anchor)
  const point = { x: bounds.maxX - 1, y: bounds.maxY - 1 }
  const withSnapshot = optionsAt(diagram, label, point, snapshot(label, bounds))
  assert.deepEqual(labelIds(withSnapshot), [label.id])
  const withoutSnapshot = { ...withSnapshot, labelBounds: undefined }
  assert.deepEqual(labelIds(withoutSnapshot), [label.id])
  assert.deepEqual(labelIds({ ...withoutSnapshot, point: {
    x: withoutSnapshot.point.x + 40, y: withoutSnapshot.point.y,
  } }), [])
  label.text = ''
  assert.deepEqual(labelIds(optionsAt(diagram, label)), [])
  const empty = optionsAt(diagram, label)
  delete empty.labelBounds
  assert.deepEqual(labelIds(empty), [])
})

test('picking preserves six/four SVG-unit padding and the existing Euclidean tolerance', () => {
  const { diagram, label } = fixture()
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 26, y: 0 })), [label.id])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 26.01, y: 0 })), [])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 52 })), [label.id])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 52.01 })), [])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 23, y: 49 })), [label.id])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 24, y: 50 })), [])
  const zeroTolerance = optionsAt(diagram, label, { x: 18, y: 44 })
  assert.deepEqual(labelIds({ ...zeroTolerance, tolerance: 0 }), [label.id])
  assert.deepEqual(labelIds({
    ...zeroTolerance,
    point: { ...zeroTolerance.point, x: zeroTolerance.point.x + 0.01 },
    tolerance: 0,
  }), [])
})

test('missing or mismatched runtime revisions cannot pick old successful geometry', () => {
  const { diagram, label } = fixture()
  const current = optionsAt(diagram, label)
  assert.deepEqual(labelIds({ ...current, labelBounds: new Map() }), [])
  for (const obsolete of [
    { ...snapshot(label), source: '$old$' },
    { ...snapshot(label), fontSize: label.style.fontSize + 1 },
    { ...snapshot(label), anchor: 'north' as const },
  ]) {
    assert.deepEqual(labelIds({ ...current, labelBounds: new Map([[label.id, obsolete]]) }), [])
  }
  label.text = '$unfinished'
  assert.deepEqual(labelIds(current), [])
  const literal = snapshot(label, { minX: -70, minY: -9, maxX: 70, maxY: 9 })
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 60, y: 0 }, literal)), [label.id])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 39 }, literal)), [])
})

test('empty and invalid runtime bounds produce no selectable area', () => {
  const { diagram, label } = fixture()
  for (const bounds of [
    { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    { minX: 10, minY: -10, maxX: -10, maxY: 10 },
    { minX: -10, minY: 10, maxX: 10, maxY: -10 },
    { minX: Number.NaN, minY: -10, maxX: 10, maxY: 10 },
    { minX: -10, minY: -10, maxX: Number.POSITIVE_INFINITY, maxY: 10 },
  ]) {
    assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 0 }, snapshot(label, bounds))), [])
  }
})

test('presentation-only style edits and model moves retain matching runtime bounds', () => {
  const { diagram, label } = fixture()
  const bounds = snapshot(label)
  const original = optionsAt(diagram, label, { x: 0, y: 39 }, bounds)
  label.style.color = '#245ABC'
  label.style.opacity = 0.2
  assert.deepEqual(labelIds(original), [label.id])
  label.position = { x: 200, y: 200, z: 0 }
  assert.deepEqual(labelIds(original), [])
  assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 39 }, bounds)), [label.id])
})

const cameraCases: readonly { ambientDimension: AmbientDimension; camera: Camera }[] = [
  { ambientDimension: 2, camera: { mode: '2d', scale: 1, origin: { x: 230, y: 200 } } },
  { ambientDimension: 2, camera: { mode: '2d', scale: 3.5, origin: { x: 270, y: 220 } } },
  { ambientDimension: 3, camera: { mode: '3d', kind: 'orthographic', thetaDeg: 30, phiDeg: 45, zoom: 20, pan: { x: 220, y: 200 } } },
  { ambientDimension: 3, camera: { mode: '3d', kind: 'orthographic', thetaDeg: 80, phiDeg: 20, zoom: 42, pan: { x: 300, y: 190 } } },
  { ambientDimension: 3, camera: { mode: '3d', kind: 'orthographic', thetaDeg: 30, phiDeg: 45, zoom: 20,
    pan: { x: 220, y: 200 }, projectionBasis: { xVector: [1, 0], yVector: [0, 1], zVector: [0.4, 0.3] } } },
]

test('label bounds follow current 2D/3D projection after pan, zoom, rotation, and viewport scaling', () => {
  for (const { ambientDimension, camera } of cameraCases) {
    const { diagram, label } = fixture(ambientDimension)
    const options = optionsAt(diagram, label, { x: 0, y: 39 }, snapshot(label), camera)
    // This client rectangle adds vertical letterboxing as well as a 1.5x scale.
    const clientBounds = { left: 40, top: 50, width: 1200, height: 1000 }
    const clientPoint = { x: 40 + options.point.x * 1.5, y: 100 + options.point.y * 1.5 }
    const remapped = mapClientPointToViewBox(clientPoint, clientBounds, { width: 800, height: viewportHeight })
    assert.ok(Math.abs(remapped.x - options.point.x) < 1e-8)
    assert.ok(Math.abs(remapped.y - options.point.y) < 1e-8)
    assert.deepEqual(labelIds({ ...options, point: remapped }), [label.id])
    assert.deepEqual(labelIds(optionsAt(diagram, label, { x: 0, y: 53 }, snapshot(label), camera)), [])
  }
})

test('ordinary selection and overlap cycling treat each compiled or fallback label as one object', () => {
  const { diagram, label } = fixture()
  const fallback = { ...label, id: 'literal-label', text: '$broken' }
  diagram.labels.push(fallback)
  diagram.strata.push(createPointStratum({ ambientDimension: 2, id: 'point', position: label.position }))
  diagram.strata.push(createCurveStratum({ ambientDimension: 2, id: 'curve', points: [
    { ...label.position, x: label.position.x - 100 },
    { ...label.position, x: label.position.x + 100 },
  ] }))
  const options = optionsAt(diagram, label)
  options.labelBounds = new Map([
    [label.id, snapshot(label)],
    [fallback.id, snapshot(fallback, { minX: -60, minY: -9, maxX: 60, maxY: 9 })],
  ])
  const candidates = collectSvgPreviewSelectionCandidates(options)
  assert.deepEqual(candidates.map((candidate) => candidate.stableId), [
    'label:free-label', 'label:literal-label', 'point:point', 'curve:curve',
  ])
  const first = candidates[0]?.selection
  assert.ok(first)
  assert.deepEqual(updateSelectionForClick(diagram, null, first, 'replace'), { kind: 'label', id: label.id })
  const cycle = nextSvgPreviewSelectionCycle(null, options.point, candidates)
  assert.equal(cycle.candidate?.id, fallback.id)
  const next = nextSvgPreviewSelectionCycle(cycle.state, options.point, candidates)
  assert.equal(next.candidate?.id, 'point')
  const last = nextSvgPreviewSelectionCycle(next.state, options.point, candidates)
  assert.equal(last.candidate?.id, 'curve')
  assert.equal(nextSvgPreviewSelectionCycle(last.state, options.point, candidates).candidate?.id, label.id)
})

test('runtime bounds never make hidden, locked, filtered, or auto-hidden labels selectable', () => {
  const { diagram, label } = fixture(3)
  label.layer = 2
  const options = optionsAt(diagram, label)
  diagram.layers = [{ value: 2, name: 'labels', locked: true }]
  assert.deepEqual(labelIds(options), [])
  diagram.layers = [{ value: 2, name: 'labels', visible: false }]
  assert.deepEqual(labelIds(options), [])
  diagram.layers = [{ value: 2, name: 'labels', visible: true }]
  assert.deepEqual(labelIds({ ...options, layerFilter: { kind: 'layer', layer: 0 } }), [])
  const occlusion = new Map([[label.id, { visibility: 'hidden' as const }]])
  for (const labelVisibility of ['autoHide', 'autoDim', 'alwaysForeground'] as const) {
    const visibility = createSvgSelectionCandidateVisibility({
      visibilityOptions: { pointVisibility: 'dimHidden', labelVisibility },
      labelOcclusionById: occlusion,
    })
    assert.deepEqual(labelIds({ ...options, visibility }), labelVisibility === 'autoHide' ? [] : [label.id])
  }
})

test('deleted labels and imported documents reusing IDs cannot pick obsolete source bounds', () => {
  const { diagram, label } = fixture()
  const options = optionsAt(diagram, label)
  diagram.labels = []
  assert.deepEqual(labelIds(options), [])
  const imported = fixture(2, 'a new document $g$')
  assert.equal(imported.label.id, label.id)
  assert.deepEqual(labelIds({ ...options, diagram: imported.diagram }), [])
  assert.deepEqual(labelIds(optionsAt(imported.diagram, imported.label)), [label.id])
})

test('runtime bounds changes and picking do not enter JSON, history, or either TikZ export mode', () => {
  const { diagram, label } = fixture(2, '  図 $F^{(1)}L$\r\nnext\tline  ')
  const initial: UndoableEditorState = {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
  const editedDiagram = structuredClone(diagram)
  editedDiagram.labels[0].text += '$g$'
  const edited = commitDiagramChange(initial, { ...initial, editableDiagram: editedDiagram })
  const current = editedDiagram.labels[0]
  const json = serializeDiagram(editedDiagram)
  const tikz = generateTikz(editedDiagram, { exportMode: 'standalone' })
  const inline = generateTikz(editedDiagram, { exportMode: 'inlineMath' })
  const history = structuredClone(edited.history)
  for (const bounds of [
    { minX: -200, minY: -8, maxX: 200, maxY: 30 },
    compactBounds,
  ]) {
    const options = optionsAt(editedDiagram, current, { x: 0, y: 0 }, snapshot(current, bounds))
    nextSvgPreviewSelectionCycle(null, options.point, collectSvgPreviewSelectionCandidates(options))
  }
  assert.equal(serializeDiagram(editedDiagram), json)
  assert.equal(generateTikz(editedDiagram, { exportMode: 'standalone' }), tikz)
  assert.equal(generateTikz(editedDiagram, { exportMode: 'inlineMath' }), inline)
  assert.deepEqual(edited.history, history)
  const undone = undoLastDiagramChange(edited)
  assert.equal(undone.editableDiagram.labels[0].text, label.text)
  const redone = redoLastDiagramChange(undone)
  assert.equal(redone.editableDiagram.labels[0].text, current.text)
  assert.equal(serializeDiagram(redone.editableDiagram), json)
})
