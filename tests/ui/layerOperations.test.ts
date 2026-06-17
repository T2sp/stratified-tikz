import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import type { Diagram, PointStratum, TextLabel, Vec3 } from '../../src/model/types.ts'
import {
  addPointStratumWithResult,
  addTextLabelWithResult,
} from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import {
  applyDeleteLayerToEditorState,
  applyDuplicateLayerToEditorState,
  applySwapLayersToEditorState,
  applyTranslateLayerToEditorState,
  type LayerOperationEditorState,
} from '../../src/ui/layerOperations.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type TestEditorState = LayerOperationEditorState & {
  polylineDraft: null | { points: Vec3[] }
  cubicBezierDraft: null | { points: Vec3[] }
  pathDraft: null
  sheetPolygonDraft: null | { points: Vec3[] }
}

test('sequential duplicate then translate uses the latest diagram', () => {
  let state = createLayerOperationState(createTwoLayerDiagram())

  state = applyDuplicateLayerToEditorState(state, 0, 2)
  state = applyTranslateLayerToEditorState(state, 2, { x: 5, y: 0, z: 0 })

  assert.deepEqual(findPoint(state.editableDiagram, 'source-point').position, {
    x: 1,
    y: 2,
    z: 0,
  })
  assert.deepEqual(findPoint(state.editableDiagram, 'source-point-copy').position, {
    x: 6,
    y: 2,
    z: 0,
  })
  assert.equal(findLabel(state.editableDiagram, 'source-label-copy').layer, 2)
  assert.equal(state.history.past.length, 2)
  assert.equal(state.layerOperationStatus, 'Translated layer 2 by (5, 0, 0).')

  const undone = undoLastDiagramChange(state)

  assert.deepEqual(
    findPoint(undone.editableDiagram, 'source-point-copy').position,
    { x: 1, y: 2, z: 0 },
  )
})

test('sequential swap then delete uses the post-swap diagram', () => {
  let state = createLayerOperationState(createTwoLayerDiagram())

  state = applySwapLayersToEditorState(state, 0, 1)
  state = applyDeleteLayerToEditorState(state, 0)

  assert.equal(hasStratum(state.editableDiagram, 'source-point'), true)
  assert.equal(hasLabel(state.editableDiagram, 'source-label'), true)
  assert.equal(hasStratum(state.editableDiagram, 'other-point'), false)
  assert.equal(findPoint(state.editableDiagram, 'source-point').layer, 1)
  assert.equal(findLabel(state.editableDiagram, 'source-label').layer, 1)
  assert.equal(state.history.past.length, 2)
  assert.equal(state.layerOperationStatus, 'Deleted layer 0 (1 element).')

  const undone = undoLastDiagramChange(state)

  assert.equal(hasStratum(undone.editableDiagram, 'other-point'), true)
  assert.equal(findPoint(undone.editableDiagram, 'other-point').layer, 0)
})

test('sequential duplicate then delete does not resurrect stale state', () => {
  let state = createLayerOperationState(createTwoLayerDiagram())

  state = applyDuplicateLayerToEditorState(state, 0, 2)
  state = applyDeleteLayerToEditorState(state, 0)

  assert.equal(hasStratum(state.editableDiagram, 'source-point'), false)
  assert.equal(hasLabel(state.editableDiagram, 'source-label'), false)
  assert.equal(hasStratum(state.editableDiagram, 'source-point-copy'), true)
  assert.equal(hasLabel(state.editableDiagram, 'source-label-copy'), true)
  assert.equal(findPoint(state.editableDiagram, 'source-point-copy').layer, 2)
  assert.equal(state.history.past.length, 2)
  assert.equal(state.layerOperationStatus, 'Deleted layer 0 (2 elements).')

  const undone = undoLastDiagramChange(state)

  assert.equal(hasStratum(undone.editableDiagram, 'source-point'), true)
  assert.equal(hasLabel(undone.editableDiagram, 'source-label'), true)
  assert.equal(hasStratum(undone.editableDiagram, 'source-point-copy'), true)
  assert.equal(hasLabel(undone.editableDiagram, 'source-label-copy'), true)
})

function createLayerOperationState(
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
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: '',
    history: createDiagramHistory(editableDiagram),
  }
}

function createTwoLayerDiagram(): Diagram {
  const empty = createEmptyDiagram({ ambientDimension: 2 })
  const withSourcePoint = addPointStratumWithResult(
    empty,
    { x: 1, y: 2, z: 0 },
    { id: 'source-point', name: 'Source', layer: 0 },
  ).diagram
  const withSourceLabel = addTextLabelWithResult(
    withSourcePoint,
    { x: 1, y: 3, z: 0 },
    { id: 'source-label', text: '$F$', layer: 0 },
  ).diagram

  return addPointStratumWithResult(
    withSourceLabel,
    { x: -1, y: -2, z: 0 },
    { id: 'other-point', name: 'Other', layer: 1 },
  ).diagram
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const point = diagram.strata.find(
    (stratum): stratum is PointStratum =>
      stratum.id === id && stratum.geometricKind === 'point',
  )

  if (point === undefined) {
    throw new Error(`Expected point ${id} to exist.`)
  }

  return point
}

function findLabel(diagram: Diagram, id: string): TextLabel {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Expected label ${id} to exist.`)
  }

  return label
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}

function hasLabel(diagram: Diagram, id: string): boolean {
  return diagram.labels.some((label) => label.id === id)
}
