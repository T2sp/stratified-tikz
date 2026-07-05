import assert from 'node:assert/strict'
import test from 'node:test'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import {
  coordinateReferenceSourceForPoint,
  resolveDiagramCoordinateRefs,
} from '../../src/model/coordinateReferences.ts'
import type {
  CoordinateAnchorPosition,
  Diagram,
  Vec3,
  WorkPlane,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addConcatenatedPathStratumWithResult,
  addPointStratumWithResult,
  addTextLabelWithResult,
  commitDirectCreationResult,
  applyDirectCreationCommitToEditorState,
} from '../../src/ui/diagramUpdates.ts'
import {
  appendConcatenatedPathDraftPoint,
  cancelConcatenatedPathDraft,
  concatenatedPathDraftBlocksWorkPlaneChange,
  concatenatedPathDraftCanFinish,
  concatenatedPathDraftNextPointCoordinateRefRejectionReason,
  concatenatedPathDraftNextPointSupportsCoordinateRef,
  createConcatenatedPathDraft,
  setConcatenatedPathDraftSegmentKind,
  type ConcatenatedPathDraft,
  type ConcatenatedPathSegmentKind,
  type ConcatenatedPathWorkPlaneMode,
} from '../../src/ui/pathDraft.ts'
import {
  resolveCoordinateAnchorReferenceForCursorCreation,
  resolvePointStratumCoordinateForCursorCreation,
} from '../../src/ui/coordinateSources.ts'
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

test('coordinate anchor cursor clicks create referenced line path endpoints', () => {
  const diagram = createCoordinateAnchorCursorDiagram()
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'line',
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    2,
  )

  const segment = draft.segments[0]

  assert.equal(segment?.kind, 'line')
  if (segment?.kind !== 'line') {
    throw new Error('Expected cursor-created line segment.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(segment.start)?.coordinateId,
    'coord-a',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.end)?.coordinateId,
    'coord-b',
  )

  const result = addConcatenatedPathStratumWithResult(
    diagram,
    draft.segments,
    { id: 'cursor-ref-path', name: 'Cursor Ref Path' },
  )
  const tikz = generateTikz(result.diagram)
  const inlineTikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })
  const definitionIndex = tikz.indexOf('\\coordinate (A) at (0,0);')
  const pathIndex = tikz.indexOf('(A) -- (B);')

  assert.ok(definitionIndex >= 0)
  assert.ok(pathIndex >= 0)
  assert.ok(definitionIndex < pathIndex)
  assert.doesNotMatch(tikz, /\\coordinate \(curvePathCursorRefPath0p0\)/)
  assert.doesNotMatch(inlineTikz, /\n\s*\n/)
})

test('coordinate anchor cursor-created path refs stay live after anchor movement', () => {
  const diagram = createCoordinateAnchorCursorDiagram()
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'line',
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    2,
  )
  const result = addConcatenatedPathStratumWithResult(
    diagram,
    draft.segments,
    { id: 'cursor-live-ref-path', name: 'Cursor Live Ref Path' },
  )
  const moved = {
    ...result.diagram,
    coordinateAnchors: result.diagram.coordinateAnchors?.map((anchor) =>
      anchor.id === 'coord-a'
        ? {
            ...anchor,
            position: globalCoordinateAnchorPosition(4, 2, 0),
          }
        : anchor,
    ),
  }
  const resolved = resolveDiagramCoordinateRefs(moved)
  const curve = resolved.strata.find(
    (stratum) => stratum.id === 'cursor-live-ref-path',
  )
  const tikz = generateTikz(moved)

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'concatenatedPath')
  if (curve?.geometricKind !== 'curve' || curve.kind !== 'concatenatedPath') {
    throw new Error('Expected resolved cursor-created path.')
  }
  assert.equal(curve.segments[0]?.kind, 'line')
  if (curve.segments[0]?.kind !== 'line') {
    throw new Error('Expected resolved cursor-created line segment.')
  }
  assert.deepEqual(curve.segments[0].start, {
    x: 4,
    y: 2,
    z: 0,
    symbolic: curve.segments[0].start.symbolic,
  })
  assert.equal(
    coordinateReferenceSourceForPoint(curve.segments[0].start)?.coordinateId,
    'coord-a',
  )
  assert.match(tikz, /\\coordinate \(A\) at \(4,2\);/)
  assert.match(tikz, /\(A\) -- \(B\);/)
})

test('coordinate anchor cursor click creates referenced point without snap replacement', () => {
  const diagram = createOffGridCoordinateAnchorCursorDiagram()
  const point = mustResolveCoordinateAnchorReference(diagram, 'coord-a')
  const result = addPointStratumWithResult(diagram, point, {
    id: 'cursor-anchor-point',
    name: 'Cursor Anchor Point',
  })
  const created = result.diagram.strata.find(
    (stratum) => stratum.id === 'cursor-anchor-point',
  )

  assert.equal(created?.geometricKind, 'point')
  if (created?.geometricKind !== 'point') {
    throw new Error('Expected cursor-created point stratum.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(created.position)?.coordinateId,
    'coord-a',
  )
  assert.equal(created.position.x, 0.26)
  assert.equal(created.position.y, 0.74)

  const moved = moveCoordinateAnchor(result.diagram, 'coord-a', 1.5, 2.5, 0)
  const resolved = resolveDiagramCoordinateRefs(moved)
  const resolvedPoint = resolved.strata.find(
    (stratum) => stratum.id === 'cursor-anchor-point',
  )
  const tikz = generateTikz(result.diagram)
  const coordinateIndex = tikz.indexOf('\\coordinate (A) at (0.26,0.74);')
  const pointIndex = tikz.indexOf('] at (A) {};')

  assert.equal(resolvedPoint?.geometricKind, 'point')
  if (resolvedPoint?.geometricKind !== 'point') {
    throw new Error('Expected resolved cursor-created point stratum.')
  }
  assert.equal(resolvedPoint.position.x, 1.5)
  assert.equal(resolvedPoint.position.y, 2.5)
  assert.equal(
    coordinateReferenceSourceForPoint(resolvedPoint.position)?.coordinateId,
    'coord-a',
  )
  assert.ok(coordinateIndex >= 0)
  assert.ok(pointIndex >= 0)
  assert.ok(coordinateIndex < pointIndex)
})

test('coordinate anchor cursor click creates referenced label without snap replacement', () => {
  const diagram = createOffGridCoordinateAnchorCursorDiagram()
  const point = mustResolveCoordinateAnchorReference(diagram, 'coord-a')
  const result = addTextLabelWithResult(diagram, point, {
    id: 'cursor-anchor-label',
    name: 'Cursor Anchor Label',
    text: '$F$',
  })
  const created = result.diagram.labels.find(
    (label) => label.id === 'cursor-anchor-label',
  )

  assert.notEqual(created, undefined)
  if (created === undefined) {
    throw new Error('Expected cursor-created label.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(created.position)?.coordinateId,
    'coord-a',
  )
  assert.equal(created.position.x, 0.26)
  assert.equal(created.position.y, 0.74)

  const moved = moveCoordinateAnchor(result.diagram, 'coord-a', 1.5, 2.5, 0)
  const resolved = resolveDiagramCoordinateRefs(moved)
  const resolvedLabel = resolved.labels.find(
    (label) => label.id === 'cursor-anchor-label',
  )
  const tikz = generateTikz(result.diagram)
  const coordinateIndex = tikz.indexOf('\\coordinate (A) at (0.26,0.74);')
  const labelIndex = tikz.indexOf('\\node at (A) {$F$};')

  assert.notEqual(resolvedLabel, undefined)
  if (resolvedLabel === undefined) {
    throw new Error('Expected resolved cursor-created label.')
  }
  assert.equal(resolvedLabel.position.x, 1.5)
  assert.equal(resolvedLabel.position.y, 2.5)
  assert.equal(
    coordinateReferenceSourceForPoint(resolvedLabel.position)?.coordinateId,
    'coord-a',
  )
  assert.ok(coordinateIndex >= 0)
  assert.ok(labelIndex >= 0)
  assert.ok(coordinateIndex < labelIndex)
})

test('coordinate anchor cursor clicks create cubic path control references', () => {
  const diagram = createCoordinateAnchorCursorDiagram()
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'cubicBezier',
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-c'),
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-d'),
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    2,
  )

  const segment = draft.segments[0]

  assert.equal(segment?.kind, 'cubicBezier')
  if (segment?.kind !== 'cubicBezier') {
    throw new Error('Expected cursor-created cubic segment.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(segment.start)?.coordinateId,
    'coord-a',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.control1)?.coordinateId,
    'coord-c',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.control2)?.coordinateId,
    'coord-d',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.end)?.coordinateId,
    'coord-b',
  )
})

test('background cursor-created path points remain numeric', () => {
  let draft = mustCreateDraft({ x: 0, y: 0, z: 0 }, xyPlane, 'line', 2)
  draft = mustAppendPoint(draft, { x: 1, y: 0, z: 0 }, 2)

  const segment = draft.segments[0]

  assert.equal(segment?.kind, 'line')
  if (segment?.kind !== 'line') {
    throw new Error('Expected numeric line segment.')
  }
  assert.equal(coordinateReferenceSourceForPoint(segment.start), null)
  assert.equal(coordinateReferenceSourceForPoint(segment.end), null)
})

test('ordinary point stratum cursor source still copies numeric coordinates', () => {
  const pointResult = addPointStratumWithResult(
    createEmptyDiagram({ ambientDimension: 2 }),
    { x: 2, y: 3, z: 0 },
    { id: 'source-point' },
  )
  const source = resolvePointStratumCoordinateForCursorCreation(
    pointResult.diagram,
    'source-point',
    { workPlane: xyPlane },
  )

  assert.equal(source.ok, true)
  if (!source.ok) {
    throw new Error('Expected point source resolution to succeed.')
  }
  assert.deepEqual(source.point, { x: 2, y: 3, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(source.point), null)
})

test('arc cursor coordinate anchor refs are supported for 2D start center end picks', () => {
  const diagram = createArcCoordinateAnchorCursorDiagram()
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'arc',
    2,
  )

  assert.equal(
    concatenatedPathDraftNextPointSupportsCoordinateRef(null, 'arc', 2),
    true,
  )
  assert.equal(
    concatenatedPathDraftNextPointCoordinateRefRejectionReason(null, 'arc', 2),
    null,
  )
  assert.equal(
    concatenatedPathDraftNextPointCoordinateRefRejectionReason(null, 'arc', 3),
    null,
  )
  assert.equal(
    concatenatedPathDraftNextPointCoordinateRefRejectionReason(
      draft,
      'line',
      2,
    ),
    null,
  )

  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-o'),
    2,
  )

  assert.equal(
    concatenatedPathDraftNextPointCoordinateRefRejectionReason(
      draft,
      'line',
      2,
    ),
    null,
  )

  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    2,
  )

  const segment = draft.segments[0]

  assert.equal(segment?.kind, 'arc')
  if (segment?.kind !== 'arc') {
    throw new Error('Expected cursor-created arc segment.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(segment.start)?.coordinateId,
    'coord-a',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.center)?.coordinateId,
    'coord-o',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.end)?.coordinateId,
    'coord-b',
  )
})

test('arc cursor coordinate anchor refs are supported for 3D start center end picks', () => {
  const diagram = createArcCoordinateAnchorCursorDiagram(3)
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'arc',
    3,
  )

  assert.equal(
    concatenatedPathDraftNextPointSupportsCoordinateRef(null, 'arc', 3),
    true,
  )
  assert.equal(
    concatenatedPathDraftNextPointCoordinateRefRejectionReason(null, 'arc', 3),
    null,
  )

  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-o'),
    3,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    3,
  )

  const segment = draft.segments[0]

  assert.equal(segment?.kind, 'arc')
  if (segment?.kind !== 'arc') {
    throw new Error('Expected cursor-created 3D arc segment.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(segment.start)?.coordinateId,
    'coord-a',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.center)?.coordinateId,
    'coord-o',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(segment.end)?.coordinateId,
    'coord-b',
  )
  assert.equal(segment.frame?.origin.x, 0)
  assert.equal(segment.frame?.origin.y, 0)
  assert.equal(segment.frame?.origin.z, 0)
  assert.equal(
    segment.frame === undefined
      ? null
      : coordinateReferenceSourceForPoint(segment.frame.origin),
    null,
  )
})

test('coordinate anchor arc refs refresh derived radius and angles after anchor movement', () => {
  const diagram = createArcCoordinateAnchorCursorDiagram()
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'arc',
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-o'),
    2,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    2,
  )
  const result = addConcatenatedPathStratumWithResult(diagram, draft.segments, {
    id: 'cursor-ref-arc',
  })
  const moved = moveCoordinateAnchor(result.diagram, 'coord-o', 0.5, 0.5, 0)
  const resolved = resolveDiagramCoordinateRefs(moved)
  const curve = resolved.strata.find((stratum) => stratum.id === 'cursor-ref-arc')

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'concatenatedPath')
  if (curve?.geometricKind !== 'curve' || curve.kind !== 'concatenatedPath') {
    throw new Error('Expected resolved arc path.')
  }

  const segment = curve.segments[0]

  assert.equal(segment?.kind, 'arc')
  if (segment?.kind !== 'arc') {
    throw new Error('Expected resolved arc segment.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(segment.center)?.coordinateId,
    'coord-o',
  )
  assert.equal(segment.center.x, 0.5)
  assert.equal(segment.center.y, 0.5)
  assert.ok(Math.abs(Number(segment.radius) - Math.SQRT1_2) < 1e-9)
  assert.ok(Math.abs(Number(segment.startAngleDeg) - -45) < 1e-9)
  assert.ok(Math.abs(Number(segment.endAngleDeg) - 135) < 1e-9)
})

test('3D coordinate anchor arc refs refresh derived frame values after anchor movement', () => {
  const diagram = createArcCoordinateAnchorCursorDiagram(3)
  let draft = mustCreateDraft(
    mustResolveCoordinateAnchorReference(diagram, 'coord-a'),
    xyPlane,
    'arc',
    3,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-o'),
    3,
  )
  draft = mustAppendPoint(
    draft,
    mustResolveCoordinateAnchorReference(diagram, 'coord-b'),
    3,
  )
  const result = addConcatenatedPathStratumWithResult(diagram, draft.segments, {
    id: 'cursor-ref-arc-3d',
  })
  const moved = moveCoordinateAnchor(result.diagram, 'coord-o', 0.5, 0.5, 0)
  const resolved = resolveDiagramCoordinateRefs(moved)
  const curve = resolved.strata.find((stratum) => stratum.id === 'cursor-ref-arc-3d')

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'concatenatedPath')
  if (curve?.geometricKind !== 'curve' || curve.kind !== 'concatenatedPath') {
    throw new Error('Expected resolved 3D arc path.')
  }

  const segment = curve.segments[0]

  assert.equal(segment?.kind, 'arc')
  if (segment?.kind !== 'arc') {
    throw new Error('Expected resolved 3D arc segment.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(segment.center)?.coordinateId,
    'coord-o',
  )
  assert.equal(segment.center.x, 0.5)
  assert.equal(segment.center.y, 0.5)
  assert.equal(segment.frame?.origin.x, 0.5)
  assert.equal(segment.frame?.origin.y, 0.5)
  assert.equal(segment.frame?.origin.z, 0)
  assert.ok(Math.abs(Number(segment.radius) - Math.SQRT1_2) < 1e-9)
  assert.ok(Math.abs(Number(segment.startAngleDeg) - -45) < 1e-9)
  assert.ok(Math.abs(Number(segment.endAngleDeg) - 135) < 1e-9)
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
  segmentKind: ConcatenatedPathSegmentKind,
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
  segmentKind: ConcatenatedPathSegmentKind,
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
    case 'arc':
      return [segment.start, segment.center, segment.end]
  }
}

function createCoordinateAnchorCursorDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalCoordinateAnchorPosition(0, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-b',
      name: 'B',
      tikzName: 'B',
      position: globalCoordinateAnchorPosition(2, 1, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-c',
      name: 'C',
      tikzName: 'C',
      position: globalCoordinateAnchorPosition(0.5, 1, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-d',
      name: 'D',
      tikzName: 'D',
      position: globalCoordinateAnchorPosition(1.5, 1, 0),
    }),
  ]

  return diagram
}

function createArcCoordinateAnchorCursorDiagram(
  ambientDimension: 2 | 3 = 2,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalCoordinateAnchorPosition(1, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-o',
      name: 'O',
      tikzName: 'O',
      position: globalCoordinateAnchorPosition(0, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-b',
      name: 'B',
      tikzName: 'B',
      position: globalCoordinateAnchorPosition(0, 1, 0),
    }),
  ]

  return diagram
}

function createOffGridCoordinateAnchorCursorDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalCoordinateAnchorPosition(0.26, 0.74, 0),
    }),
  ]

  return diagram
}

function moveCoordinateAnchor(
  diagram: Diagram,
  coordinateId: string,
  x: number,
  y: number,
  z: number,
): Diagram {
  return {
    ...diagram,
    coordinateAnchors: diagram.coordinateAnchors?.map((anchor) =>
      anchor.id === coordinateId
        ? {
            ...anchor,
            position: globalCoordinateAnchorPosition(x, y, z),
          }
        : anchor,
    ),
  }
}

function mustResolveCoordinateAnchorReference(
  diagram: Diagram,
  coordinateId: string,
): Vec3 {
  const result = resolveCoordinateAnchorReferenceForCursorCreation(
    diagram,
    coordinateId,
    { workPlane: xyPlane },
  )

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.point
}

function globalCoordinateAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
    },
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
