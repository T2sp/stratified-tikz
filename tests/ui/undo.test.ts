import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import type { Diagram, Vec3 } from '../../src/model/types.ts'
import {
  addPointStratumWithResult,
  addPolylineCurveStratumWithResult,
  cloneDiagram,
  updateStratumById,
  updateStratumNameById,
} from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  canRedoDiagramChange,
  canUndoDiagramChange,
  commitDiagramChange,
  createDiagramHistory,
  maxDiagramHistorySize,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

type TestEditorState = UndoableEditorState & {
  polylineDraft: null | { points: Vec3[] }
  cubicBezierDraft: null | { points: Vec3[] }
  sheetPolygonDraft: null | { points: Vec3[] }
  directFormText: string
}

test('multi-step undo restores previous diagrams in reverse order', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const committedB = commitName(initial, 'B')
  const committedC = commitName(committedB, 'C')
  const committedD = commitName(committedC, 'D')

  assert.equal(pointName(committedD.editableDiagram), 'D')
  assert.equal(committedD.history.past.length, 3)

  const undoneToC = undoLastDiagramChange(committedD)
  const undoneToB = undoLastDiagramChange(undoneToC)
  const undoneToA = undoLastDiagramChange(undoneToB)

  assert.equal(pointName(undoneToC.editableDiagram), 'C')
  assert.equal(pointName(undoneToB.editableDiagram), 'B')
  assert.equal(pointName(undoneToA.editableDiagram), 'A')
  assert.equal(undoLastDiagramChange(undoneToA), undoneToA)
})

test('redo restores undone diagrams forward', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const committedB = commitName(initial, 'B')
  const committedC = commitName(committedB, 'C')
  const committedD = commitName(committedC, 'D')
  const undoneToC = undoLastDiagramChange(committedD)
  const undoneToB = undoLastDiagramChange(undoneToC)

  assert.equal(pointName(undoneToB.editableDiagram), 'B')
  assert.equal(undoneToB.history.future.length, 2)

  const redoneToC = redoLastDiagramChange(undoneToB)
  const redoneToD = redoLastDiagramChange(redoneToC)

  assert.equal(pointName(redoneToC.editableDiagram), 'C')
  assert.equal(pointName(redoneToD.editableDiagram), 'D')
  assert.equal(redoLastDiagramChange(redoneToD), redoneToD)
})

test('new edits clear redo future', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const committedB = commitName(initial, 'B')
  const committedC = commitName(committedB, 'C')
  const undoneToB = undoLastDiagramChange(committedC)

  assert.equal(pointName(undoneToB.editableDiagram), 'B')
  assert.equal(canRedoDiagramChange(undoneToB.history), true)

  const committedD = commitName(undoneToB, 'D')

  assert.equal(pointName(committedD.editableDiagram), 'D')
  assert.equal(canRedoDiagramChange(committedD.history), false)
  assert.deepEqual(committedD.history.past.map(pointName), ['A', 'B'])
})

test('history is bounded to the configured limit', () => {
  let state = createUndoState(createNamedPointDiagram('0'))

  for (let index = 1; index <= maxDiagramHistorySize + 10; index += 1) {
    state = commitName(state, String(index))
  }

  assert.equal(state.history.past.length, maxDiagramHistorySize)
  assert.equal(pointName(state.history.past[0]), '10')
  assert.equal(pointName(state.editableDiagram), String(maxDiagramHistorySize + 10))
})

test('UI-only state changes do not create history entries', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const nextSelection: SelectedElement = { kind: 'stratum', id: 'undo-point' }
  const committed = commitDiagramChange(initial, {
    ...initial,
    selectedElement: nextSelection,
    layerFilter: { kind: 'layer', layer: 0 },
    polylineDraft: { points: [{ x: 0, y: 0, z: 0 }] },
    directFormText: 'typed but uncommitted',
  })

  assert.deepEqual(committed.selectedElement, nextSelection)
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 0 })
  assert.deepEqual(committed.polylineDraft, { points: [{ x: 0, y: 0, z: 0 }] })
  assert.equal(committed.directFormText, 'typed but uncommitted')
  assert.equal(canUndoDiagramChange(committed.history), false)
})

test('creation undo removes point and redo restores it', () => {
  const initial = createUndoState(createEmptyExampleDiagram())
  const result = addPointStratumWithResult(
    initial.editableDiagram,
    { x: 1, y: 2, z: 0 },
    { id: 'created-point', name: 'Created', layer: 2 },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })

  assert.equal(hasStratum(committed.editableDiagram, result.id), true)

  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(undone.editableDiagram, result.id), false)
  assert.equal(undone.selectedElement, null)
  assert.equal(hasStratum(redone.editableDiagram, result.id), true)
})

test('creation undo removes path-like strata and redo restores them', () => {
  const initial = createUndoState(createEmptyExampleDiagram())
  const result = addPolylineCurveStratumWithResult(
    initial.editableDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
    ],
    { id: 'created-polyline', layer: 4 },
  )

  if (result.id === null) {
    throw new Error('Expected polyline creation to succeed.')
  }

  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(undone.editableDiagram, result.id), false)
  assert.equal(hasStratum(redone.editableDiagram, result.id), true)
})

test('inspector-style edits undo and redo committed diagram data', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const movedDiagram = updateStratumById(
    initial.editableDiagram,
    'undo-point',
    (stratum) =>
      stratum.geometricKind === 'point'
        ? { ...stratum, layer: 7, position: { x: 3, y: 4, z: 0 } }
        : stratum,
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: movedDiagram,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.deepEqual(pointPosition(undone.editableDiagram), { x: 0, y: 0, z: 0 })
  assert.equal(pointLayer(undone.editableDiagram), 0)
  assert.deepEqual(pointPosition(redone.editableDiagram), { x: 3, y: 4, z: 0 })
  assert.equal(pointLayer(redone.editableDiagram), 7)
})

test('drag-style commits group repeated pointer updates into one undo step', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const firstMove = commitDiagramChange(
    initial,
    {
      ...initial,
      editableDiagram: updatePointPosition(initial.editableDiagram, {
        x: 1,
        y: 1,
        z: 0,
      }),
    },
    { undoSourceDiagram: initial.editableDiagram },
  )
  const secondMove = commitDiagramChange(
    firstMove,
    {
      ...firstMove,
      editableDiagram: updatePointPosition(firstMove.editableDiagram, {
        x: 2,
        y: 2,
        z: 0,
      }),
    },
    { undoSourceDiagram: initial.editableDiagram },
  )

  assert.equal(secondMove.history.past.length, 1)
  assert.deepEqual(pointPosition(secondMove.editableDiagram), { x: 2, y: 2, z: 0 })

  const undone = undoLastDiagramChange(secondMove)

  assert.deepEqual(pointPosition(undone.editableDiagram), { x: 0, y: 0, z: 0 })
})

test('loading a replacement diagram is undoable', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const loadedDiagram = createNamedPointDiagram('Loaded')
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: loadedDiagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    sheetPolygonDraft: null,
  })

  assert.equal(pointName(committed.editableDiagram), 'Loaded')
  assert.equal(pointName(undoLastDiagramChange(committed).editableDiagram), 'A')
})

test('save serialization excludes undo and redo history', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const committed = commitName(commitName(initial, 'B'), 'C')
  const undone = undoLastDiagramChange(committed)
  const serialized = serializeDiagram(undone.editableDiagram)

  assert.equal(serialized.includes('history'), false)
  assert.equal(serialized.includes('past'), false)
  assert.equal(serialized.includes('present'), false)
  assert.equal(serialized.includes('future'), false)
  assert.equal(serialized.includes('undoDiagram'), false)
})

function commitName<T extends TestEditorState>(state: T, name: string): T {
  return commitDiagramChange(state, {
    ...state,
    editableDiagram: updateStratumNameById(
      state.editableDiagram,
      'undo-point',
      name,
    ),
  })
}

function createUndoState(
  editableDiagram: Diagram,
  selectedElement: SelectedElement = null,
  layerFilter: LayerFilter = allLayersFilter,
): TestEditorState {
  return {
    editableDiagram,
    selectedElement,
    layerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    sheetPolygonDraft: null,
    directFormText: '',
    history: createDiagramHistory(editableDiagram),
  }
}

function createNamedPointDiagram(name: string): Diagram {
  return addPointStratumWithResult(
    createEmptyExampleDiagram(),
    { x: 0, y: 0, z: 0 },
    { id: 'undo-point', name, layer: 0 },
  ).diagram
}

function createEmptyExampleDiagram(): Diagram {
  return {
    ...cloneDiagram(twoDimensionalExample),
    strata: [],
    labels: [],
  }
}

function pointName(diagram: Diagram): string {
  const point = diagram.strata.find((stratum) => stratum.id === 'undo-point')

  if (point === undefined) {
    throw new Error('Expected undo-point to exist.')
  }

  return point.name
}

function pointPosition(diagram: Diagram): Vec3 {
  const point = diagram.strata.find((stratum) => stratum.id === 'undo-point')

  if (point === undefined || point.geometricKind !== 'point') {
    throw new Error('Expected undo-point to be a point stratum.')
  }

  return point.position
}

function pointLayer(diagram: Diagram): number {
  const point = diagram.strata.find((stratum) => stratum.id === 'undo-point')

  if (point === undefined) {
    throw new Error('Expected undo-point to exist.')
  }

  return point.layer
}

function updatePointPosition(diagram: Diagram, position: Vec3): Diagram {
  return updateStratumById(diagram, 'undo-point', (stratum) =>
    stratum.geometricKind === 'point' ? { ...stratum, position } : stratum,
  )
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}
