import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import type {
  ConcatenatedPathStratum,
  Diagram,
  FilledRegion2DStratum,
  LinePathSegment,
  PathSegment,
  Vec3,
  WorkPlaneFilledSheet3DStratum,
} from '../../src/model/types.ts'
import {
  createFillFromClosedPaths,
  type CreateFillFromClosedPathsResult,
} from '../../src/ui/fillFromPaths.ts'
import {
  cloneDiagram,
  updateStratumById,
} from '../../src/ui/diagramUpdates.ts'
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

type TestEditorState = UndoableEditorState & {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
  history: DiagramHistory
}

test('creates a 2D filled region from one selected closed path', () => {
  const sourcePath = squarePath2D('outer')
  const sourceBefore = cloneDiagram(diagramWithPaths(2, [sourcePath]))
  const result = createFillFromClosedPaths(sourceBefore, ['outer'], {
    id: 'created-region',
    layer: 4,
  })

  assertFillOk(result)
  const region = mustFindFilledRegion(result.diagram, 'created-region')

  assert.equal(region.codim, 0)
  assert.equal(region.geometricKind, 'region')
  assert.equal(region.kind, 'filledRegion')
  assert.equal(region.fillRule, 'nonzero')
  assert.equal(region.layer, 4)
  assert.equal(region.style.fillColor, '#4D9DE0')
  assert.equal(region.style.fillOpacity, 0.35)
  assert.equal(region.style.strokeOpacity, 1)
  assert.deepEqual(
    region.boundaries.map((boundary) => boundary.id),
    ['outer'],
  )
  assert.deepEqual(findPath(result.diagram, 'outer'), findPath(sourceBefore, 'outer'))
})

test('creates a 2D filled region from two closed paths with even-odd fill', () => {
  const diagram = diagramWithPaths(2, [
    squarePath2D('outer', 0, 0, 4),
    squarePath2D('inner', 1, 1, 1),
  ])
  const result = createFillFromClosedPaths(diagram, ['outer', 'inner'], {
    id: 'region-with-hole',
    fillRule: 'evenOdd',
  })

  assertFillOk(result)
  const region = mustFindFilledRegion(result.diagram, 'region-with-hole')

  assert.equal(region.fillRule, 'evenOdd')
  assert.deepEqual(
    region.boundaries.map((boundary) => boundary.id),
    ['outer', 'inner'],
  )
})

test('rejects an open selected path without modifying the diagram', () => {
  const diagram = diagramWithPaths(2, [openPath2D('open')])
  const result = createFillFromClosedPaths(diagram, ['open'])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected open path rejection.')
  }
  assert.equal(result.error, 'sourceOpenPath')
  assert.equal(result.diagram, diagram)
})

test('rejects a selected path with non-finite coordinates', () => {
  const diagram = diagramWithPaths(2, [nonFinitePath2D('bad')])
  const result = createFillFromClosedPaths(diagram, ['bad'])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected non-finite path rejection.')
  }
  assert.equal(result.error, 'sourceNonFinite')
  assert.equal(result.diagram, diagram)
})

test('creates a 3D work-plane filled sheet from one closed path on the active plane', () => {
  const diagram = diagramWithPaths(3, [squarePath3D('outer', 2)])
  const result = createFillFromClosedPaths(diagram, ['outer'], {
    id: 'created-sheet',
    activeWorkPlane: { kind: 'xy', z: 2 },
  })

  assertFillOk(result)
  const sheet = mustFindWorkPlaneFilledSheet(result.diagram, 'created-sheet')

  assert.equal(sheet.codim, 1)
  assert.equal(sheet.geometricKind, 'sheet')
  assert.equal(sheet.kind, 'workPlaneFilledSheet')
  assert.deepEqual(sheet.planeFrame, {
    origin: { x: 0, y: 0, z: 2 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  })
  assert.deepEqual(
    sheet.boundaries.map((boundary) => boundary.id),
    ['outer'],
  )
})

test('creates a 3D work-plane filled sheet from two coplanar paths with even-odd fill', () => {
  const diagram = diagramWithPaths(3, [
    squarePath3D('outer', 2, 0, 0, 4),
    squarePath3D('inner', 2, 1, 1, 1),
  ])
  const result = createFillFromClosedPaths(diagram, ['outer', 'inner'], {
    id: 'sheet-with-hole',
    fillRule: 'evenOdd',
    activeWorkPlane: { kind: 'xy', z: 2 },
  })

  assertFillOk(result)
  const sheet = mustFindWorkPlaneFilledSheet(result.diagram, 'sheet-with-hole')

  assert.equal(sheet.fillRule, 'evenOdd')
  assert.deepEqual(
    sheet.boundaries.map((boundary) => boundary.id),
    ['outer', 'inner'],
  )
})

test('rejects non-coplanar 3D selected paths', () => {
  const diagram = diagramWithPaths(3, [
    squarePath3D('outer', 0, 0, 0, 4),
    squarePath3D('inner', 1, 1, 1, 1),
  ])
  const result = createFillFromClosedPaths(diagram, ['outer', 'inner'], {
    activeWorkPlane: { kind: 'xy', z: 0 },
  })

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected non-coplanar path rejection.')
  }
  assert.equal(result.error, 'sourceNotCoplanar')
  assert.equal(result.diagram, diagram)
})

test('copies boundaries instead of live-linking source path segments', () => {
  const diagram = diagramWithPaths(2, [squarePath2D('outer')])
  const result = createFillFromClosedPaths(diagram, ['outer'], {
    id: 'copied-region',
  })

  assertFillOk(result)
  const source = findPath(result.diagram, 'outer')
  const region = mustFindFilledRegion(result.diagram, 'copied-region')

  assert.notEqual(region.boundaries[0].segments[0], source.segments[0])
  assert.deepEqual(region.boundaries[0].segments, source.segments)
})

test('moving a source path after fill creation does not change the filled object', () => {
  const diagram = diagramWithPaths(2, [squarePath2D('outer')])
  const result = createFillFromClosedPaths(diagram, ['outer'], {
    id: 'stable-region',
  })

  assertFillOk(result)
  const regionBefore = mustFindFilledRegion(result.diagram, 'stable-region')
  const copiedBoundariesBefore = structuredClone(regionBefore.boundaries)
  const movedDiagram = updateStratumById(result.diagram, 'outer', (stratum) =>
    stratum.geometricKind === 'curve' && stratum.kind === 'concatenatedPath'
      ? {
          ...stratum,
          segments: stratum.segments.map((segment) =>
            translateLineSegment(segment, { x: 10, y: 0, z: 0 }),
          ),
        }
      : stratum,
  )
  const regionAfter = mustFindFilledRegion(movedDiagram, 'stable-region')

  assert.deepEqual(regionAfter.boundaries, copiedBoundariesBefore)
})

test('committed fill creation selects the created filled object', () => {
  const initial = createTestEditorState(
    diagramWithPaths(2, [squarePath2D('outer')]),
  )
  const result = createFillFromClosedPaths(initial.editableDiagram, ['outer'], {
    id: 'selected-region',
  })

  assertFillOk(result)
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })

  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: 'selected-region',
  })
})

test('fill creation is undoable and redoable', () => {
  const initial = createTestEditorState(
    diagramWithPaths(2, [squarePath2D('outer')]),
  )
  const result = createFillFromClosedPaths(initial.editableDiagram, ['outer'], {
    id: 'undoable-region',
  })

  assertFillOk(result)
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(committed.editableDiagram, 'undoable-region'), true)
  assert.equal(hasStratum(undone.editableDiagram, 'undoable-region'), false)
  assert.equal(hasStratum(redone.editableDiagram, 'undoable-region'), true)
})

test('source paths remain unchanged after fill creation', () => {
  const sourcePath = squarePath2D('outer')
  const diagram = diagramWithPaths(2, [sourcePath])
  const sourceBefore = structuredClone(findPath(diagram, 'outer'))
  const result = createFillFromClosedPaths(diagram, ['outer'], {
    id: 'unchanged-source-region',
  })

  assertFillOk(result)
  assert.deepEqual(findPath(result.diagram, 'outer'), sourceBefore)
})

function diagramWithPaths(
  ambientDimension: 2 | 3,
  paths: ConcatenatedPathStratum[],
): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension }),
    strata: paths,
  }
}

function squarePath2D(
  id: string,
  x = 0,
  y = 0,
  size = 2,
): ConcatenatedPathStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 2,
    id,
    name: id,
    segments: squareSegments([
      { x, y, z: 0 },
      { x: x + size, y, z: 0 },
      { x: x + size, y: y + size, z: 0 },
      { x, y: y + size, z: 0 },
    ]),
  })
}

function squarePath3D(
  id: string,
  z: number,
  x = 0,
  y = 0,
  size = 2,
): ConcatenatedPathStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 3,
    id,
    name: id,
    segments: squareSegments([
      { x, y, z },
      { x: x + size, y, z },
      { x: x + size, y: y + size, z },
      { x, y: y + size, z },
    ]),
  })
}

function openPath2D(id: string): ConcatenatedPathStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 2,
    id,
    name: id,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 1, y: 1, z: 0 },
      },
    ],
  })
}

function nonFinitePath2D(id: string): ConcatenatedPathStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 2,
    id,
    name: id,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: Number.NaN, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: Number.NaN, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 },
      },
    ],
  })
}

function squareSegments(points: [Vec3, Vec3, Vec3, Vec3]): LinePathSegment[] {
  return [
    { kind: 'line', start: points[0], end: points[1] },
    { kind: 'line', start: points[1], end: points[2] },
    { kind: 'line', start: points[2], end: points[3] },
    { kind: 'line', start: points[3], end: points[0] },
  ]
}

function translateLineSegment(segment: PathSegment, offset: Vec3): PathSegment {
  if (segment.kind !== 'line') {
    return segment
  }

  return {
    kind: 'line',
    start: addVec3(segment.start, offset),
    end: addVec3(segment.end, offset),
  }
}

function addVec3(point: Vec3, offset: Vec3): Vec3 {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y,
    z: point.z + offset.z,
  }
}

function assertFillOk(
  result: CreateFillFromClosedPathsResult,
): asserts result is Extract<CreateFillFromClosedPathsResult, { ok: true }> {
  assert.equal(
    result.ok,
    true,
    result.ok ? '' : `${result.error} ${result.sourcePathId ?? ''}`,
  )
}

function findPath(diagram: Diagram, id: string): ConcatenatedPathStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'curve' ||
    stratum.kind !== 'concatenatedPath'
  ) {
    throw new Error(`Expected ${id} to be a concatenated path.`)
  }

  return stratum
}

function mustFindFilledRegion(
  diagram: Diagram,
  id: string,
): FilledRegion2DStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'region' ||
    stratum.kind !== 'filledRegion'
  ) {
    throw new Error(`Expected ${id} to be a filled region.`)
  }

  return stratum
}

function mustFindWorkPlaneFilledSheet(
  diagram: Diagram,
  id: string,
): WorkPlaneFilledSheet3DStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'workPlaneFilledSheet'
  ) {
    throw new Error(`Expected ${id} to be a work-plane filled sheet.`)
  }

  return stratum
}

function createTestEditorState(
  editableDiagram: Diagram,
  selectedElement: SelectedElement = null,
): TestEditorState {
  return {
    editableDiagram,
    selectedElement,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(editableDiagram),
  }
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}
