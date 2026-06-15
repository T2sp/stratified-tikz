import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import type { Diagram } from '../../src/model/types.ts'
import {
  addPointStratumWithResult,
  cloneDiagram,
  updateStratumNameById,
} from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

type TestEditorState = UndoableEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  sheetPolygonDraft: null
}

test('one-step undo restores previous diagram after a committed edit', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: updateStratumNameById(
      initial.editableDiagram,
      'undo-point',
      'B',
    ),
  })

  assert.equal(pointName(committed.editableDiagram), 'B')
  assert.notEqual(committed.undoDiagram, null)

  const undone = undoLastDiagramChange(committed)

  assert.equal(pointName(undone.editableDiagram), 'A')
  assert.equal(undone.undoDiagram, null)
  assert.equal(undoLastDiagramChange(undone), undone)
})

test('one-step undo snapshot is replaced by the latest committed change', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const firstCommit = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: updateStratumNameById(
      initial.editableDiagram,
      'undo-point',
      'B',
    ),
  })
  const secondCommit = commitDiagramChange(firstCommit, {
    ...firstCommit,
    editableDiagram: updateStratumNameById(
      firstCommit.editableDiagram,
      'undo-point',
      'C',
    ),
  })

  const undone = undoLastDiagramChange(secondCommit)

  assert.equal(pointName(undone.editableDiagram), 'B')
  assert.equal(undone.undoDiagram, null)
  assert.equal(undoLastDiagramChange(undone), undone)
})

test('UI-only state changes do not create undo snapshots', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const nextSelection: SelectedElement = { kind: 'stratum', id: 'undo-point' }
  const committed = commitDiagramChange(initial, {
    ...initial,
    selectedElement: nextSelection,
  })

  assert.deepEqual(committed.selectedElement, nextSelection)
  assert.equal(committed.undoDiagram, null)
})

test('undo clears stale selection after restoring a diagram without the selected element', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const result = addPointStratumWithResult(
    initial.editableDiagram,
    { x: 1, y: 1, z: 0 },
    { id: 'created-point', name: 'Created', layer: 2 },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })

  const undone = undoLastDiagramChange(committed)

  assert.equal(
    undone.editableDiagram.strata.some((stratum) => stratum.id === result.id),
    false,
  )
  assert.equal(undone.selectedElement, null)
})

test('drag-style commits can use the pre-drag diagram as the undo snapshot', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const firstMove = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: updateStratumNameById(
      initial.editableDiagram,
      'undo-point',
      'B',
    ),
  })
  const secondMove = commitDiagramChange(
    firstMove,
    {
      ...firstMove,
      editableDiagram: updateStratumNameById(
        firstMove.editableDiagram,
        'undo-point',
        'C',
      ),
    },
    { undoSourceDiagram: initial.editableDiagram },
  )

  assert.equal(pointName(undoLastDiagramChange(secondMove).editableDiagram), 'A')
})

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
    undoDiagram: null,
  }
}

function createNamedPointDiagram(name: string): Diagram {
  const baseDiagram = {
    ...cloneDiagram(twoDimensionalExample),
    strata: [],
    labels: [],
  }
  return addPointStratumWithResult(
    baseDiagram,
    { x: 0, y: 0, z: 0 },
    { id: 'undo-point', name, layer: 0 },
  ).diagram
}

function pointName(diagram: Diagram): string {
  const point = diagram.strata.find((stratum) => stratum.id === 'undo-point')

  if (point === undefined) {
    throw new Error('Expected undo-point to exist.')
  }

  return point.name
}
