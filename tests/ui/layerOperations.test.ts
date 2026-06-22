import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import type { Diagram, PointStratum, TextLabel, Vec3 } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
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
import {
  canSubmitLayerDuplicateTarget,
  duplicateLayerTargetInput,
  resolveDuplicateLayerTarget,
} from '../../src/ui/layerDuplicateTarget.ts'
import {
  layerManagerSummary,
  nextLayerManagerExpandedState,
  shouldShowLayerManagerDetails,
} from '../../src/ui/layerManagerFold.ts'
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

test('duplicate target helper disables blank submits when no default exists', () => {
  const sourceLayer = 9_007_199_254_740_992
  const defaultTarget = null

  assert.equal(duplicateLayerTargetInput(defaultTarget), '')
  assert.equal(canSubmitLayerDuplicateTarget(sourceLayer, '', defaultTarget), false)
  assert.deepEqual(resolveDuplicateLayerTarget(sourceLayer, '', defaultTarget), {
    ok: false,
    message: 'Choose target layer manually.',
  })
  assert.equal(canSubmitLayerDuplicateTarget(sourceLayer, '0', defaultTarget), true)
  assert.deepEqual(resolveDuplicateLayerTarget(sourceLayer, '0', defaultTarget), {
    ok: true,
    targetLayerValue: 0,
  })
})

test('duplicate target helper rejects invalid and same-layer manual targets', () => {
  assert.deepEqual(resolveDuplicateLayerTarget(0, 'Infinity', 1), {
    ok: false,
    message: 'Enter a finite target layer.',
  })
  assert.deepEqual(resolveDuplicateLayerTarget(0, '0', 1), {
    ok: false,
    message: 'Duplicate target must differ from the source layer.',
  })
})

test('layer manager fold helpers toggle and hide details predictably', () => {
  assert.equal(nextLayerManagerExpandedState(false), true)
  assert.equal(nextLayerManagerExpandedState(true), false)
  assert.equal(shouldShowLayerManagerDetails(false, 2), false)
  assert.equal(shouldShowLayerManagerDetails(true, 0), false)
  assert.equal(shouldShowLayerManagerDetails(true, 2), true)
})

test('layer manager summary counts layers and elements', () => {
  assert.equal(
    layerManagerSummary(
      [
        { value: 0, name: 'Layer 0' },
        { value: 2, name: 'Layer 2' },
      ],
      new Map([
        [0, 3],
        [2, 1],
      ]),
    ),
    '2 layers, 4 elements',
  )
  assert.equal(
    layerManagerSummary([{ value: 0, name: 'Layer 0' }], new Map([[0, 1]])),
    '1 layer, 1 element',
  )
})

test('layer manager fold helpers do not affect generated TikZ', () => {
  const diagram = createTwoLayerDiagram()
  const before = generateTikz(diagram)

  nextLayerManagerExpandedState(false)
  shouldShowLayerManagerDetails(false, 2)
  layerManagerSummary([{ value: 0, name: 'Layer 0' }], new Map([[0, 1]]))

  assert.equal(generateTikz(diagram), before)
})

test('duplicate operation reports missing huge-layer default without mutation', () => {
  const state = createLayerOperationState(createHugeLayerDiagram())
  const next = applyDuplicateLayerToEditorState(state, 9_007_199_254_740_992)

  assert.equal(next.editableDiagram, state.editableDiagram)
  assert.equal(next.history.past.length, 0)
  assert.equal(next.layerOperationStatus, 'No safe default target layer is available.')
  assert.equal(hasStratum(next.editableDiagram, 'huge-point-copy'), false)
})

test('duplicate operation accepts a manual target for a huge finite layer', () => {
  const state = createLayerOperationState(createHugeLayerDiagram())
  const next = applyDuplicateLayerToEditorState(
    state,
    9_007_199_254_740_992,
    0,
  )

  assert.equal(findPoint(next.editableDiagram, 'huge-point-copy').layer, 0)
  assert.equal(next.history.past.length, 1)
  assert.equal(
    next.layerOperationStatus,
    'Duplicated layer 9007199254740992 to layer 0 (1 element).',
  )
})

test('duplicate operation rejects invalid manual target layer', () => {
  const state = createLayerOperationState(createTwoLayerDiagram())
  const next = applyDuplicateLayerToEditorState(
    state,
    0,
    Number.POSITIVE_INFINITY,
  )

  assert.equal(next.editableDiagram, state.editableDiagram)
  assert.equal(next.history.past.length, 0)
  assert.equal(next.layerOperationStatus, 'targetLayerValue must be a finite number.')
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

function createHugeLayerDiagram(): Diagram {
  return addPointStratumWithResult(
    createEmptyDiagram({ ambientDimension: 2 }),
    { x: 0, y: 0, z: 0 },
    {
      id: 'huge-point',
      name: 'Huge point',
      layer: 9_007_199_254_740_992,
    },
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
