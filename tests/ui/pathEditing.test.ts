import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import type {
  ConcatenatedPathStratum,
  Diagram,
  PathSegment,
  Vec3,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { pathSegmentsToSvgPath, type SvgPathSegment } from '../../src/rendering/svgPath.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type DiagramHistory,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'
import { updateStratumById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import type { ConcatenatedPathDraft } from '../../src/ui/pathDraft.ts'
import {
  appendCubicSegmentToConcatenatedPath,
  appendLineSegmentToConcatenatedPath,
  clearConcatenatedPathSegmentStyleOverride,
  describeConcatenatedPathSegments,
  removeLastSegmentFromConcatenatedPath,
  updateConcatenatedPathCoordinate,
  updateConcatenatedPathPoint,
  updateConcatenatedPathSegmentStyleOverrideField,
} from '../../src/ui/pathEditing.ts'

type TestEditorState = UndoableEditorState & {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: ConcatenatedPathDraft | null
  sheetPolygonDraft: null
  history: DiagramHistory
}

test('inspector helper lists concatenated path segments in order', () => {
  const path = createTestPath()
  const descriptions = describeConcatenatedPathSegments(path)

  assert.deepEqual(
    descriptions.map((segment) => ({
      segmentNumber: segment.segmentNumber,
      kindLabel: segment.kindLabel,
      pointLabels: segment.points.map((point) => point.label),
    })),
    [
      {
        segmentNumber: 1,
        kindLabel: 'Line',
        pointLabels: ['Start', 'End'],
      },
      {
        segmentNumber: 2,
        kindLabel: 'Cubic Bezier',
        pointLabels: ['Start', 'Control point 1', 'Control point 2', 'End'],
      },
    ],
  )
})

test('coordinate edit updates the selected concatenated path point', () => {
  const path = createTestPath()
  const updated = updateConcatenatedPathCoordinate(
    path,
    2,
    { segmentIndex: 1, role: 'control1' },
    'y',
    4,
  )

  assert.notEqual(updated, path)
  assert.equal(updated.segments[1].kind, 'cubicBezier')
  if (updated.segments[1].kind !== 'cubicBezier') {
    throw new Error('Expected a cubic segment.')
  }
  assert.deepEqual(updated.segments[1].control1, { x: 1.5, y: 4, z: 0 })
  assert.equal(path.segments[1].kind, 'cubicBezier')
  if (path.segments[1].kind !== 'cubicBezier') {
    throw new Error('Expected a cubic segment.')
  }
  assert.deepEqual(path.segments[1].control1, { x: 1.5, y: 1, z: 0 })
})

test('adjacent endpoint consistency is preserved after endpoint edit', () => {
  const path = createTestPath()
  const updated = updateConcatenatedPathCoordinate(
    path,
    2,
    { segmentIndex: 0, role: 'end' },
    'x',
    2,
  )

  assert.deepEqual(updated.segments[0].end, { x: 2, y: 0, z: 0 })
  assert.deepEqual(updated.segments[1].start, { x: 2, y: 0, z: 0 })
  assert.equal(validatePath(updated).valid, true)
})

test('invalid concatenated path coordinate edits are rejected', () => {
  const path = createTestPath()

  assert.equal(
    updateConcatenatedPathCoordinate(
      path,
      2,
      { segmentIndex: 0, role: 'end' },
      'x',
      Number.NaN,
    ),
    path,
  )
  assert.equal(
    updateConcatenatedPathPoint(
      path,
      2,
      { segmentIndex: 999, role: 'end' },
      { x: 1, y: 2, z: 0 },
    ),
    path,
  )
})

test('2D concatenated path point edits keep z equal to zero', () => {
  const path = createTestPath()
  const updated = updateConcatenatedPathPoint(
    path,
    2,
    { segmentIndex: 1, role: 'control2' },
    { x: 7, y: 8, z: 9 },
  )

  assert.equal(updated.segments[1].kind, 'cubicBezier')
  if (updated.segments[1].kind !== 'cubicBezier') {
    throw new Error('Expected a cubic segment.')
  }
  assert.deepEqual(updated.segments[1].control2, { x: 7, y: 8, z: 0 })
})

test('segment operations append line, append cubic, and remove last segment', () => {
  const path = createTestPath()
  const withLine = appendLineSegmentToConcatenatedPath(path, 2)
  const withCubic = appendCubicSegmentToConcatenatedPath(withLine, 2)
  const removed = removeLastSegmentFromConcatenatedPath(withCubic)

  assert.equal(withLine.segments.length, 3)
  assert.deepEqual(withLine.segments[2], {
    kind: 'line',
    start: { x: 3, y: 0, z: 0 },
    end: { x: 4, y: 0, z: 0 },
  })
  assert.equal(withCubic.segments.length, 4)
  assert.equal(withCubic.segments[3].kind, 'cubicBezier')
  assert.equal(removed.segments.length, 3)
  assert.equal(removeLastSegmentFromConcatenatedPath(createSingleSegmentPath()).segments.length, 1)
})

test('clearing concatenated path segment style override restores inheritance', () => {
  const path = createTestPath()
  const overridden = updateConcatenatedPathSegmentStyleOverrideField(
    path,
    0,
    'lineStyle',
    'dotted',
  )
  const cleared = clearConcatenatedPathSegmentStyleOverride(overridden, 0)

  assert.deepEqual(overridden.segments[0].styleOverride, {
    lineStyle: 'dotted',
  })
  assert.equal(cleared.segments[0].styleOverride, undefined)
  assert.equal(validatePath(cleared).valid, true)
})

test('TikZ output updates after concatenated path edit', () => {
  const path = updateConcatenatedPathPoint(
    createTestPath(),
    2,
    { segmentIndex: 0, role: 'end' },
    { x: 2, y: 2, z: 0 },
  )
  const diagram = diagramWithPath(path)
  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curvePathEditablePath0p1\) at \(2,2\);/)
  assert.match(
    tikz,
    /\(curvePathEditablePath0p0\) -- \(curvePathEditablePath0p1\) \.\. controls \(curvePathEditablePath0p2\) and \(curvePathEditablePath0p3\) \.\. \(curvePathEditablePath0p4\);/,
  )
})

test('SVG path output updates after concatenated path edit', () => {
  const path = updateConcatenatedPathPoint(
    createTestPath(),
    2,
    { segmentIndex: 0, role: 'end' },
    { x: 2, y: 2, z: 0 },
  )

  assert.equal(
    pathSegmentsToSvgPath(path.segments.map(pathSegmentToSvgSegment)),
    'M 0,0 L 2,2 C 1.5,1 2.5,1 3,0',
  )
})

test('undo and redo restore concatenated path edits as one diagram change', () => {
  const initialDiagram = diagramWithPath(createTestPath())
  const initial = createTestEditorState(initialDiagram)
  const editedDiagram = updateStratumById(
    initial.editableDiagram,
    'editable-path',
    (stratum) => {
      if (
        stratum.geometricKind !== 'curve' ||
        stratum.kind !== 'concatenatedPath'
      ) {
        return stratum
      }

      return updateConcatenatedPathPoint(
        stratum,
        initial.editableDiagram.ambientDimension,
        { segmentIndex: 0, role: 'end' },
        { x: 2, y: 2, z: 0 },
      )
    },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: editedDiagram,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.deepEqual(findPath(committed.editableDiagram).segments[0].end, {
    x: 2,
    y: 2,
    z: 0,
  })
  assert.deepEqual(findPath(undone.editableDiagram).segments[0].end, {
    x: 1,
    y: 0,
    z: 0,
  })
  assert.deepEqual(findPath(redone.editableDiagram).segments[0].end, {
    x: 2,
    y: 2,
    z: 0,
  })
})

function createTestPath(): ConcatenatedPathStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'editable-path',
    name: 'Editable Path',
    segments: createTestSegments(),
  })
}

function createSingleSegmentPath(): ConcatenatedPathStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'single-path',
    name: 'Single Path',
    segments: [createTestSegments()[0]],
  })
}

function createTestSegments(): PathSegment[] {
  return [
    {
      kind: 'line',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1, y: 0, z: 0 },
    },
    {
      kind: 'cubicBezier',
      start: { x: 1, y: 0, z: 0 },
      control1: { x: 1.5, y: 1, z: 0 },
      control2: { x: 2.5, y: 1, z: 0 },
      end: { x: 3, y: 0, z: 0 },
    },
  ]
}

function diagramWithPath(path: ConcatenatedPathStratum): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(path)
  return diagram
}

function validatePath(path: ConcatenatedPathStratum) {
  return validateDiagram(diagramWithPath(path))
}

function pathSegmentToSvgSegment(segment: PathSegment): SvgPathSegment {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        start: vec3ToSvgPoint(segment.start),
        end: vec3ToSvgPoint(segment.end),
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        start: vec3ToSvgPoint(segment.start),
        control1: vec3ToSvgPoint(segment.control1),
        control2: vec3ToSvgPoint(segment.control2),
        end: vec3ToSvgPoint(segment.end),
      }
  }
}

function vec3ToSvgPoint(point: Vec3): { x: number; y: number } {
  return { x: point.x, y: point.y }
}

function createTestEditorState(diagram: Diagram): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function findPath(diagram: Diagram): ConcatenatedPathStratum {
  const stratum = diagram.strata.find(
    (candidate) => candidate.id === 'editable-path',
  )

  if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'concatenatedPath') {
    throw new Error('Expected editable path in test diagram.')
  }

  return stratum
}
