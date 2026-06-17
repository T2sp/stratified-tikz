import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import type { Diagram, Vec3, WorkPlane } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addConcatenatedPathStratumWithResult,
  commitDirectCreationResult,
  applyDirectCreationCommitToEditorState,
} from '../../src/ui/diagramUpdates.ts'
import {
  appendConcatenatedPathDraftPoint,
  cancelConcatenatedPathDraft,
  concatenatedPathDraftBlocksWorkPlaneChange,
  concatenatedPathDraftCanFinish,
  createConcatenatedPathDraft,
  setConcatenatedPathDraftSegmentKind,
  type ConcatenatedPathDraft,
  type ConcatenatedPathWorkPlaneMode,
} from '../../src/ui/pathDraft.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type DiagramHistory,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'
import { arePointsOnWorkPlane } from '../../src/ui/sheetDraft.ts'
import { pathSegmentsToSvgPath, type SvgPathSegment } from '../../src/rendering/svgPath.ts'

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

const xyPlane: WorkPlane = { kind: 'xy', z: 0 }
const xzPlaneAtY0: WorkPlane = { kind: 'xz', y: 0 }
const xzPlaneAtY2: WorkPlane = { kind: 'xz', y: 2 }

test('2D path draft creates a line followed by a cubic segment', () => {
  const draft = createLineThenCubicDraft2D()

  assert.equal(draft.segments.length, 2)
  assert.equal(draft.segments[0].kind, 'line')
  assert.deepEqual(draft.segments[0], {
    kind: 'line',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1, y: 0, z: 0 },
  })
  assert.deepEqual(draft.segments[1], {
    kind: 'cubicBezier',
    start: { x: 1, y: 0, z: 0 },
    control1: { x: 1.5, y: 1, z: 0 },
    control2: { x: 2.5, y: 1, z: 0 },
    end: { x: 3, y: 0, z: 0 },
  })
  assert.equal(concatenatedPathDraftCanFinish(draft), true)
})

test('3D path draft accepts segments on one captured work plane', () => {
  let draft = mustCreateDraft(
    { x: 0, y: 2, z: 0 },
    xzPlaneAtY2,
    'line',
    3,
  )
  draft = mustAppendPoint(draft, { x: 1, y: 2, z: 0 }, 3)
  draft = mustSetSegmentKind(draft, 'cubicBezier')
  draft = mustAppendPoint(draft, { x: 1.5, y: 2, z: 1 }, 3)
  draft = mustAppendPoint(draft, { x: 2.5, y: 2, z: 1 }, 3)
  draft = mustAppendPoint(draft, { x: 3, y: 2, z: 0 }, 3)

  assert.deepEqual(draft.workPlane, xzPlaneAtY2)
  assert.equal(draft.segments.length, 2)
  assert.deepEqual(
    draft.segments.flatMap(segmentPoints).map((point) => point.y),
    [2, 2, 2, 2, 2, 2],
  )

  const result = addConcatenatedPathStratumWithResult(
    createEmptyDiagram({ ambientDimension: 3 }),
    draft.segments,
    { id: 'same-plane-path', layer: 4 },
  )

  assert.equal(result.id, 'same-plane-path')
  const path = result.diagram.strata.find((stratum) => stratum.id === result.id)
  assert.equal(path?.geometricKind, 'curve')
  assert.equal(path?.codim, 2)
  assert.equal(path?.layer, 4)
})

test('3D same-work-plane path draft rejects points from a different work plane', () => {
  const draft = mustCreateDraft({ x: 0, y: 0, z: 0 }, xyPlane, 'line', 3)
  const result = appendConcatenatedPathDraftPoint(
    draft,
    { x: 1, y: 0, z: 1 },
    3,
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected mixed-work-plane point to be rejected.')
  }
  assert.equal(result.reason, 'pointOffWorkPlane')
  assert.equal(result.draft, draft)
  assert.equal(concatenatedPathDraftBlocksWorkPlaneChange(draft), true)
})

test('3D cross-work-plane path draft allows mixed-plane segments', () => {
  let draft = mustCreateDraft(
    { x: 0, y: 0, z: 0 },
    xyPlane,
    'line',
    3,
    'crossWorkPlane',
  )
  draft = mustAppendPoint(draft, { x: 1, y: 0, z: 0 }, 3)
  draft = mustAppendPoint(draft, { x: 1, y: 0, z: 1 }, 3)

  assert.equal(draft.workPlaneMode, 'crossWorkPlane')
  assert.equal(concatenatedPathDraftBlocksWorkPlaneChange(draft), false)
  assert.deepEqual(draft.segments, [
    {
      kind: 'line',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1, y: 0, z: 0 },
    },
    {
      kind: 'line',
      start: { x: 1, y: 0, z: 0 },
      end: { x: 1, y: 0, z: 1 },
    },
  ])
})

test('cross-work-plane path draft still requires finite coordinates', () => {
  const draft = mustCreateDraft(
    { x: 0, y: 0, z: 0 },
    xyPlane,
    'line',
    3,
    'crossWorkPlane',
  )
  const result = appendConcatenatedPathDraftPoint(
    draft,
    { x: 1, y: Number.NaN, z: 1 },
    3,
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected non-finite cross-work-plane point to be rejected.')
  }
  assert.equal(result.reason, 'nonFinitePoint')
  assert.equal(result.draft, draft)
})

test('work-plane switching during cross-work-plane path creation keeps one draft', () => {
  let draft = mustCreateDraft(
    { x: 0, y: 0, z: 0 },
    xyPlane,
    'line',
    3,
    'crossWorkPlane',
  )

  assert.equal(arePointsOnWorkPlane([draft.anchor], xyPlane), true)
  draft = mustAppendPoint(draft, { x: 1, y: 0, z: 0 }, 3)
  assert.equal(arePointsOnWorkPlane([draft.anchor], xzPlaneAtY0), true)
  draft = mustAppendPoint(draft, { x: 1, y: 0, z: 1 }, 3)

  assert.equal(draft.segments.length, 2)
  assert.deepEqual(draft.segments[0].end, draft.segments[1].start)
  assert.equal(concatenatedPathDraftCanFinish(draft), true)
})

test('finishing a path draft commits one selected concatenated path', () => {
  const initial = createTestEditorState(createEmptyDiagram({ ambientDimension: 2 }))
  const draft = createLineThenCubicDraft2D()
  const result = addConcatenatedPathStratumWithResult(
    initial.editableDiagram,
    draft.segments,
    { id: 'finished-path', layer: 5 },
  )

  assert.equal(result.id, 'finished-path')
  if (result.id === null) {
    throw new Error('Expected path creation to succeed.')
  }

  const commit = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    5,
    initial.layerFilter,
  )
  const committed = commitDiagramChange(initial, {
    ...applyDirectCreationCommitToEditorState(initial, commit),
    pathDraft: null,
  })

  assert.equal(committed.editableDiagram.strata.length, 1)
  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: 'finished-path',
  })
  assert.equal(committed.history.past.length, 1)
})

test('canceling a path draft does not commit diagram data', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const draft = createLineThenCubicDraft2D()

  assert.equal(cancelConcatenatedPathDraft(), null)
  assert.equal(draft.segments.length, 2)
  assert.deepEqual(diagram, createEmptyDiagram({ ambientDimension: 2 }))
})

test('path draft is not exported to TikZ before finish', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const draft = mustCreateDraft({ x: 9, y: 9, z: 0 }, xyPlane, 'line', 2)
  const tikz = generateTikz(diagram)

  assert.equal(draft.anchor.x, 9)
  assert.doesNotMatch(tikz, /9,9/)
  assert.doesNotMatch(tikz, /\\draw\[/)
})

test('TikZ export preserves committed path segment order', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const draft = createLineThenCubicDraft2D()
  const result = addConcatenatedPathStratumWithResult(diagram, draft.segments, {
    id: 'ordered-path',
    name: 'Ordered Path',
  })

  assert.equal(result.id, 'ordered-path')
  const tikz = generateTikz(result.diagram)

  assert.match(
    tikz,
    /\(curvePathOrderedPath0p0\) -- \(curvePathOrderedPath0p1\) \.\. controls \(curvePathOrderedPath0p2\) and \(curvePathOrderedPath0p3\) \.\. \(curvePathOrderedPath0p4\);/,
  )
})

test('SVG path rendering works for committed path draft segments', () => {
  const draft = createLineThenCubicDraft2D()
  const svgSegments: SvgPathSegment[] = draft.segments.map((segment) => {
    switch (segment.kind) {
      case 'line':
        return {
          kind: 'line',
          start: { x: segment.start.x, y: segment.start.y },
          end: { x: segment.end.x, y: segment.end.y },
        }
      case 'cubicBezier':
        return {
          kind: 'cubicBezier',
          start: { x: segment.start.x, y: segment.start.y },
          control1: { x: segment.control1.x, y: segment.control1.y },
          control2: { x: segment.control2.x, y: segment.control2.y },
          end: { x: segment.end.x, y: segment.end.y },
        }
    }
  })

  assert.equal(
    pathSegmentsToSvgPath(svgSegments),
    'M 0,0 L 1,0 C 1.5,1 2.5,1 3,0',
  )
})

test('undo and redo treat path finish as one diagram change', () => {
  const initial = createTestEditorState(createEmptyDiagram({ ambientDimension: 2 }))
  const draft = createLineThenCubicDraft2D()
  const result = addConcatenatedPathStratumWithResult(
    initial.editableDiagram,
    draft.segments,
    { id: 'undoable-path' },
  )

  assert.equal(result.id, 'undoable-path')
  if (result.id === null) {
    throw new Error('Expected path creation to succeed.')
  }

  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
    pathDraft: null,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(committed.history.past.length, 1)
  assert.equal(hasStratum(committed.editableDiagram, 'undoable-path'), true)
  assert.equal(hasStratum(undone.editableDiagram, 'undoable-path'), false)
  assert.equal(hasStratum(redone.editableDiagram, 'undoable-path'), true)
})

function createLineThenCubicDraft2D(): ConcatenatedPathDraft {
  let draft = mustCreateDraft({ x: 0, y: 0, z: 7 }, xyPlane, 'line', 2)
  draft = mustAppendPoint(draft, { x: 1, y: 0, z: 7 }, 2)
  draft = mustSetSegmentKind(draft, 'cubicBezier')
  draft = mustAppendPoint(draft, { x: 1.5, y: 1, z: 7 }, 2)
  draft = mustAppendPoint(draft, { x: 2.5, y: 1, z: 7 }, 2)
  return mustAppendPoint(draft, { x: 3, y: 0, z: 7 }, 2)
}

function mustCreateDraft(
  point: Vec3,
  workPlane: WorkPlane,
  segmentKind: 'line' | 'cubicBezier',
  ambientDimension: 2 | 3,
  workPlaneMode: ConcatenatedPathWorkPlaneMode = 'sameWorkPlane',
): ConcatenatedPathDraft {
  const result = createConcatenatedPathDraft(
    point,
    workPlane,
    segmentKind,
    ambientDimension,
    workPlaneMode,
  )

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.draft
}

function mustAppendPoint(
  draft: ConcatenatedPathDraft,
  point: Vec3,
  ambientDimension: 2 | 3,
): ConcatenatedPathDraft {
  const result = appendConcatenatedPathDraftPoint(
    draft,
    point,
    ambientDimension,
  )

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.draft
}

function mustSetSegmentKind(
  draft: ConcatenatedPathDraft,
  segmentKind: 'line' | 'cubicBezier',
): ConcatenatedPathDraft {
  const result = setConcatenatedPathDraftSegmentKind(draft, segmentKind)

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.draft
}

function segmentPoints(segment: ConcatenatedPathDraft['segments'][number]): Vec3[] {
  switch (segment.kind) {
    case 'line':
      return [segment.start, segment.end]
    case 'cubicBezier':
      return [segment.start, segment.control1, segment.control2, segment.end]
  }
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

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}
