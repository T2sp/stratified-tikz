import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createTemplatePathStratum,
} from '../../src/model/constructors.ts'
import { pathInlineNodePoint } from '../../src/model/pathInlineNodes.ts'
import { reverseCurvePathDirection } from '../../src/model/paths.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import type { AmbientDimension, CurveStratum, Diagram, PathInlineNode, Vec3 } from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import {
  collectSvgPreviewSelectionCandidates,
  maxSvgPreviewSelectionCandidates,
  nextSvgPreviewSelectionCycle,
} from '../../src/rendering/svgHitTesting.ts'
import {
  maxSvgPathInlineNodePreviews,
  pathInlineNodesForSvgPreview,
} from '../../src/rendering/svgPathInlineNodes.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { duplicateSelectedElements, removeSelectedElements } from '../../src/ui/bulkEditing.ts'
import { updateStratumById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { removeSegmentFromConcatenatedPath } from '../../src/ui/pathEditing.ts'
import { updatePathInlineNodeText } from '../../src/ui/pathInlineNodeEditing.ts'
import { splitSelectedPath } from '../../src/ui/pathSplitting.ts'
import { updateSelectionForClick } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

const viewportHeight = 600
const raw = '  図 $\\frac{a}{b}$\t  \\unsupported{literal}\r\n\nend  '
const inlineFormattedRaw = '  図 $\\frac{a}{b}$\t  \\unsupported{literal}\nend  '
const point = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z })
const node = (id: string, text = raw, value = 0.25, segmentIndex = 0): PathInlineNode => ({
  id,
  position: { kind: 'segment', segmentIndex, value },
  text,
  options: { placement: 'above', marker: 'none', sloped: true, allowUpsideDown: true },
})

function fixture(ambientDimension: AmbientDimension = 2): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension })
  diagram.strata = [createCurveStratum({
    ambientDimension,
    id: 'path',
    pathLabel: 'saved-path',
    points: [point(0), point(4, 0, ambientDimension === 3 ? 2 : 0)],
    inlineNodes: [node('reused-node')],
  })]
  return diagram
}

function curve(diagram: Diagram, id = 'path'): CurveStratum {
  const found = diagram.strata.find((item) => item.id === id)
  assert.ok(found?.geometricKind === 'curve')
  return found
}

function editor(diagram: Diagram): UndoableEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: { kind: 'stratum', id: 'path' },
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function preview(diagram: Diagram, path = curve(diagram)) {
  return pathInlineNodesForSvgPreview(path, diagram.ambientDimension,
    (position) => projectToSvgPoint(diagram.camera, position, viewportHeight))
}

test('inline-node Inspector edits preserve exact source through save/load, Undo/Redo, and both TikZ modes', () => {
  for (const ambientDimension of [2, 3] as const) {
    const diagram = fixture(ambientDimension)
    const initial = editor(diagram)
    const sourceNode = curve(diagram).inlineNodes![0]
    const original = serializeDiagram(diagram)
    const editedSource = raw + ' $new$'
    const editedDiagram = updateStratumById(diagram, 'path', (path) =>
      updatePathInlineNodeText(path, 'reused-node', editedSource))
    const edited = commitDiagramChange(initial, { ...initial, editableDiagram: editedDiagram })
    const editedNode = curve(editedDiagram).inlineNodes![0]

    assert.equal(sourceNode.text, raw)
    assert.equal(editedNode.text, editedSource)
    assert.deepEqual(editedNode.position, sourceNode.position)
    assert.deepEqual(editedNode.options, sourceNode.options)
    assert.equal(curve(editedDiagram).pathLabel, 'saved-path')
    const json = serializeDiagram(editedDiagram)
    const loaded = parseSavedDiagramJson(json)
    assert.ok(loaded.ok)
    assert.equal(curve(loaded.diagram).inlineNodes![0].text, editedSource)
    assert.deepEqual(Object.keys(curve(loaded.diagram).inlineNodes![0]).sort(),
      ['id', 'options', 'position', 'text'])
    assert.ok(generateTikz(editedDiagram, { exportMode: 'standalone' })
      .includes(`node[pos=0.25, above, sloped, allow upside down] {${editedSource}}`))
    const inline = generateTikz(editedDiagram, { exportMode: 'inlineMath' })
    assert.ok(inline.includes(`{${inlineFormattedRaw} $new$}`))
    assert.ok(inline.split(/\r?\n/u).every((line) => line.trim().length > 0))
    const undone = undoLastDiagramChange(edited)
    assert.equal(serializeDiagram(undone.editableDiagram), original)
    const redone = redoLastDiagramChange(undone)
    assert.equal(serializeDiagram(redone.editableDiagram), json)
  }
})

test('duplicate allocates node identities while preserving raw labels, options, model coordinates and history', () => {
  const diagram = fixture()
  const initial = editor(diagram)
  const duplicated = duplicateSelectedElements(diagram, initial.selectedElement)
  const copy = curve(duplicated.diagram, 'path-copy')
  const original = curve(diagram)
  assert.notEqual(copy.inlineNodes![0].id, original.inlineNodes![0].id)
  assert.deepEqual({ ...copy.inlineNodes![0], id: original.inlineNodes![0].id }, original.inlineNodes![0])
  assert.deepEqual(preview(duplicated.diagram, copy)[0].center, preview(diagram)[0].center)
  const committed = commitDiagramChange(initial, { ...initial, editableDiagram: duplicated.diagram })
  const undone = undoLastDiagramChange(committed)
  assert.equal(undone.editableDiagram.strata.length, 1)
  const redone = redoLastDiagramChange(undone)
  assert.deepEqual(curve(redone.editableDiagram, 'path-copy').inlineNodes, copy.inlineNodes)
  assert.equal(validateDiagram(redone.editableDiagram).valid, true)
})

test('split moves raw source to the appropriate new owner and reversal preserves each physical node position', () => {
  for (const ambientDimension of [2, 3] as const) {
    const diagram = fixture(ambientDimension)
    const original = curve(diagram)
    original.inlineNodes = [node('left', raw, 0.25), node('split', '$discarded$', 0.5),
      node('right', '  日本語 $g$  ', 0.75)]
    const originalPreviews = preview(diagram)
    const split = splitSelectedPath(diagram, { kind: 'stratum', id: 'path' },
      { segmentIndex: 0, t: 0.5 }, { firstId: 'left-path', secondId: 'right-path' })
    assert.ok(split.ok)
    assert.equal(split.diagram.strata.some((item) => item.id === 'path'), false)
    const left = curve(split.diagram, 'left-path')
    const right = curve(split.diagram, 'right-path')
    assert.deepEqual(left.inlineNodes?.map((item) => item.id), ['left'])
    assert.deepEqual(right.inlineNodes?.map((item) => item.id), ['right'])
    assert.equal(left.inlineNodes![0].text, raw)
    assert.equal(right.inlineNodes![0].text, '  日本語 $g$  ')
    assert.equal(left.inlineNodes![0].position.value, 0.5)
    assert.equal(right.inlineNodes![0].position.value, 0.5)
    assert.deepEqual(preview(split.diagram, left)[0].center, originalPreviews[0].center)
    assert.deepEqual(preview(split.diagram, right)[0].center, originalPreviews[2].center)
    const reversed = reverseCurvePathDirection(original)
    assert.ok(reversed)
    assert.deepEqual(reversed.inlineNodes?.map((item) => item.position.value), [0.75, 0.5, 0.25])
    assert.deepEqual(reversed.inlineNodes?.map((item) => item.text), original.inlineNodes.map((item) => item.text))
    assert.deepEqual(preview(diagram, reversed), originalPreviews)
    assert.equal(validateDiagram(split.diagram).valid, true)
    assert.ok(generateTikz(split.diagram, { exportMode: 'standalone' }).includes(`{${raw}}`))
  }
})

test('segment removal, path deletion and document replacement retain only their own raw node data', () => {
  const diagram = fixture()
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'path',
    segments: [0, 1, 2].map((index) => ({ kind: 'line', start: point(index), end: point(index + 1) })),
    inlineNodes: [node('first', '$f$', 0.25, 0), node('removed', '$gone$', 0.25, 1),
      node('last', raw, 0.25, 2)],
  })
  diagram.strata = [path]
  const pruned = removeSegmentFromConcatenatedPath(path, 1)
  assert.deepEqual(pruned.inlineNodes?.map((item) => [item.id, item.position.segmentIndex, item.text]),
    [['first', 0, '$f$'], ['last', 1, raw]])
  const initial = editor(diagram)
  const deleted = removeSelectedElements(diagram, initial.selectedElement)
  const committed = commitDiagramChange(initial, { ...initial, editableDiagram: deleted.diagram })
  assert.equal(committed.editableDiagram.strata.length, 0)
  assert.deepEqual(curve(undoLastDiagramChange(committed).editableDiagram).inlineNodes, path.inlineNodes)
  assert.equal(redoLastDiagramChange(undoLastDiagramChange(committed)).editableDiagram.strata.length, 0)
  const replacement = fixture()
  curve(replacement).inlineNodes![0].text = 'replacement $z$'
  const replaced = commitDiagramChange(initial, { ...initial, editableDiagram: replacement }, { replaceDiagram: true })
  assert.equal(curve(replaced.editableDiagram).inlineNodes![0].text, 'replacement $z$')
  assert.equal(curve(undoLastDiagramChange(replaced).editableDiagram).inlineNodes![2].text, raw)
})

test('reused inline-node IDs on different paths have distinct owning-curve candidates and cycle in existing priority', () => {
  const diagram = fixture()
  const second = { ...curve(diagram), id: 'other-path', inlineNodes: [node('reused-node', '$g$')] }
  diagram.strata.push(second)
  const center = preview(diagram)[0].center
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram, camera: diagram.camera, viewportHeight, point: center, showCoordinateAnchors: false,
  })
  assert.deepEqual(candidates.map((item) => item.stableId), [
    'pathInlineNode:other-path:reused-node', 'pathInlineNode:path:reused-node',
    'curve:other-path', 'curve:path',
  ])
  assert.deepEqual(candidates[0].selection, { kind: 'stratum', id: 'other-path' })
  assert.deepEqual(updateSelectionForClick(diagram, null, candidates[0].selection, 'replace'),
    { kind: 'stratum', id: 'other-path' })
  const next = nextSvgPreviewSelectionCycle(null, center, candidates)
  assert.equal(next.candidate?.stableId, 'pathInlineNode:path:reused-node')
  assert.deepEqual(next.candidate?.selection, { kind: 'stratum', id: 'path' })
  const third = nextSvgPreviewSelectionCycle(next.state, center, candidates)
  assert.equal(third.candidate?.stableId, 'curve:other-path')
})

test('inline-node picking stays within 10 units of markers regardless of glyph width, placement, or dot style', () => {
  const diagram = fixture()
  const path = curve(diagram)
  for (const placement of ['above', 'below', 'left', 'right', 'center'] as const) {
    for (const marker of ['dot', 'none'] as const) {
      path.inlineNodes = [{ ...node('reused-node', 'long $\\frac{a}{b}$ '.repeat(10)),
        options: { placement, marker } }]
      const center = preview(diagram)[0].center
      const candidatesAt = (dx: number, dy: number) => collectSvgPreviewSelectionCandidates({
        diagram, camera: diagram.camera, viewportHeight,
        point: { x: center.x + dx, y: center.y + dy },
        showCoordinateAnchors: false,
        tolerance: 100,
      }).filter((item) => item.kind === 'pathInlineNode')
      assert.equal(candidatesAt(6, 8).length, 1)
      assert.equal(candidatesAt(6, 8.01).length, 0)
      assert.equal(candidatesAt(0, -14).length, 0)
      assert.equal(candidatesAt(80, 0).length, 0)
      assert.deepEqual(candidatesAt(0, 0)[0].selection, { kind: 'stratum', id: 'path' })
    }
  }
})

test('empty and whitespace-only nodes retain markers and count toward the unchanged preview cap', () => {
  const diagram = fixture()
  const path = curve(diagram)
  path.inlineNodes = Array.from({ length: maxSvgPathInlineNodePreviews + 3 }, (_, index) => ({
    ...node(`node-${index}`, index === 0 ? '' : index === 1 ? ' \t\r\n ' : `$x_${index}$`, 0.5),
    options: { placement: 'above', marker: index === 0 ? 'dot' : 'none' },
  }))
  const previews = preview(diagram)
  assert.equal(previews.length, 128)
  assert.equal(previews[0].text, '')
  assert.equal(previews[0].marker, 'dot')
  assert.equal(previews[1].text, ' \t\r\n ')
  assert.equal(previews[1].marker, 'none')
  assert.equal(previews.at(-1)?.id, 'node-127')
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram, camera: diagram.camera, viewportHeight, point: previews[0].center, showCoordinateAnchors: false,
  }).filter((item) => item.kind === 'pathInlineNode')
  assert.equal(candidates.length, maxSvgPreviewSelectionCandidates)
  assert.deepEqual(new Set(candidates.map((item) => item.id)),
    new Set(Array.from({ length: maxSvgPreviewSelectionCandidates }, (_, index) => `node-${index}`)))
})

test('inline-node projected geometry remains finite for all supported paths in 2D and 3D', () => {
  for (const ambientDimension of [2, 3] as const) {
    const diagram = fixture(ambientDimension)
    const start = point(0)
    const end = point(4, 2, ambientDimension === 3 ? 3 : 0)
    const nodes = [node('geometry-node', '図 $\\frac{a}{b}$')]
    const frame = { origin: start, u: point(1), v: point(0, 1), normal: point(0, 0, 1) }
    const paths: CurveStratum[] = [
      createCurveStratum({ ambientDimension, id: 'poly', points: [start, end], inlineNodes: nodes }),
      createCurveStratum({ ambientDimension, id: 'cubic', kind: 'cubicBezier',
        points: [start, point(1, 2), point(3, 2), end], inlineNodes: nodes }),
      createConcatenatedPathStratum({ ambientDimension, id: 'segments',
        segments: [{ kind: 'line', start, end }], inlineNodes: nodes }),
      createTemplatePathStratum({ ambientDimension, id: 'circle',
        template: { kind: 'circleTemplate', center: start, radius: 2, frame }, inlineNodes: nodes }),
      createTemplatePathStratum({ ambientDimension, id: 'ellipse',
        template: { kind: 'ellipseTemplate', center: start, radiusX: 2, radiusY: 1, frame }, inlineNodes: nodes }),
    ]
    diagram.strata = paths
    assert.equal(validateDiagram(diagram).valid, true)
    for (const path of paths) {
      const position = pathInlineNodePoint(path, nodes[0], ambientDimension)
      assert.ok(position)
      const projected = preview(diagram, path)[0]
      assert.deepEqual(projected.center, projectToSvgPoint(diagram.camera, position, viewportHeight))
      assert.ok(Object.values(projected.center).every(Number.isFinite))
      assert.equal(projected.text, nodes[0].text)
    }
    const tikz = generateTikz(diagram, { exportMode: 'standalone' })
    assert.equal(tikz.split('node[pos=0.25, above, sloped, allow upside down]').length - 1, paths.length)
  }
})
