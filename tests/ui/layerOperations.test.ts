import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
} from '../../src/model/coordinateReferences.ts'
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
  applyMergeLayersToEditorState,
  applySwapLayersToEditorState,
  applyTranslateLayerToEditorState,
  layerMergeWarningMessage,
  layerCreationInputAfterLayerMerge,
  type LayerOperationEditorState,
} from '../../src/ui/layerOperations.ts'
import { parseTranslationVectorFromInputs } from '../../src/model/translation.ts'
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
import {
  createLayerThumbnail,
  layerButtonLabel,
  layerCreationInputForLayer,
  layerFilterFromSelectValue,
  layerFilterSelectValue,
  layerPaletteRows,
  nextLayerPaletteOpenState,
  parseDraggedLayerValue,
  resolveLayerDropSource,
  resolveLayerDropSwap,
  selectedLayerActionTarget,
} from '../../src/ui/layerPalette.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
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

test('delete layer cleans stale ids from multi-selection', () => {
  const state = createLayerOperationState(createTwoLayerDiagram(), {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'source-point' },
      { kind: 'stratum', id: 'other-point' },
    ],
  })
  const next = applyDeleteLayerToEditorState(state, 0)

  assert.equal(hasStratum(next.editableDiagram, 'source-point'), false)
  assert.deepEqual(next.selectedElement, { kind: 'stratum', id: 'other-point' })
})

test('merge layer moves source elements to target and retargets source view filter', () => {
  const state = createLayerOperationState(
    createTwoLayerDiagram(),
    { kind: 'stratum', id: 'source-point' },
    { kind: 'layer', layer: 0 },
  )
  const next = applyMergeLayersToEditorState(state, 0, 1)

  assert.equal(findPoint(next.editableDiagram, 'source-point').layer, 1)
  assert.equal(findLabel(next.editableDiagram, 'source-label').layer, 1)
  assert.equal(findPoint(next.editableDiagram, 'other-point').layer, 1)
  assert.deepEqual(next.layerFilter, { kind: 'layer', layer: 1 })
  assert.deepEqual(next.selectedElement, { kind: 'stratum', id: 'source-point' })
  assert.equal(next.history.past.length, 1)
  assert.equal(next.layerOperationStatus, 'Merged layer 0 into layer 1 (2 elements).')
})

test('delete layer does not delete global coordinate anchors', () => {
  const diagram = addLayerOperationCoordinateAnchor(createTwoLayerDiagram())
  const state = createLayerOperationState(diagram, {
    kind: 'coordinate',
    id: 'coord-a',
  })
  const next = applyDeleteLayerToEditorState(state, 0)

  assert.equal(hasStratum(next.editableDiagram, 'source-point'), false)
  assert.equal(hasCoordinateAnchor(next.editableDiagram, 'coord-a'), true)
  assert.deepEqual(next.selectedElement, { kind: 'coordinate', id: 'coord-a' })
  assert.match(generateTikz(next.editableDiagram), /\\coordinate \(A\) at \(10,0\);/)
})

test('merge layer does not move or delete global coordinate anchors', () => {
  const diagram = addLayerOperationCoordinateAnchor(createTwoLayerDiagram())
  const state = createLayerOperationState(diagram)
  const next = applyMergeLayersToEditorState(state, 0, 1)

  assert.equal(findPoint(next.editableDiagram, 'source-point').layer, 1)
  assert.equal(hasCoordinateAnchor(next.editableDiagram, 'coord-a'), true)
  assert.deepEqual(next.editableDiagram.coordinateAnchors, diagram.coordinateAnchors)
  assert.match(generateTikz(next.editableDiagram), /\\coordinate \(A\) at \(10,0\);/)
})

test('layer translation status reports detached coordinate references', () => {
  const state = createLayerOperationState(createLayerCoordinateReferenceDiagram())
  const next = applyTranslateLayerToEditorState(state, 0, { x: 1, y: 0, z: 0 })
  const point = findPoint(next.editableDiagram, 'reference-point')

  assert.equal(coordinateReferenceSourceForPoint(point.position), null)
  assert.deepEqual(point.position, { x: 11, y: 0, z: 0 })
  assert.equal(
    next.layerOperationStatus,
    'Translated layer 0 by (1, 0, 0) and detached 1 coordinate reference.',
  )
})

test('merge layer updates New layer input when source was the creation layer', () => {
  assert.equal(layerCreationInputAfterLayerMerge('0', 0, 1), '1')
  assert.equal(layerCreationInputAfterLayerMerge('2', 0, 1), '2')
  assert.equal(layerCreationInputAfterLayerMerge('bad', 0, 1), 'bad')
})

test('merge layer clears selection that becomes hidden by target layer metadata', () => {
  const diagram: Diagram = {
    ...createTwoLayerDiagram(),
    layers: [
      { value: 0, name: 'Source' },
      { value: 1, name: 'Hidden target', visible: false },
    ],
  }
  const state = createLayerOperationState(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'source-point' },
        { kind: 'label', id: 'source-label' },
      ],
    },
  )
  const next = applyMergeLayersToEditorState(state, 0, 1)

  assert.equal(findPoint(next.editableDiagram, 'source-point').layer, 1)
  assert.equal(next.selectedElement, null)
  assert.match(next.layerOperationStatus, /target layer is hidden/)
})

test('merge layer warns when the target layer is locked', () => {
  const diagram: Diagram = {
    ...createTwoLayerDiagram(),
    layers: [
      { value: 0, name: 'Source' },
      { value: 1, name: 'Locked target', locked: true },
    ],
  }
  const state = createLayerOperationState(diagram)
  const next = applyMergeLayersToEditorState(state, 0, 1)

  assert.match(next.layerOperationStatus, /target layer is locked/)
  assert.match(layerMergeWarningMessage(diagram, 1), /unlock it before editing/)
})

test('merge layer rejects source equal to target without mutation', () => {
  const state = createLayerOperationState(createTwoLayerDiagram())
  const next = applyMergeLayersToEditorState(state, 0, 0)

  assert.equal(next.editableDiagram, state.editableDiagram)
  assert.equal(next.history.past.length, 0)
  assert.equal(next.layerOperationStatus, 'Choose two different layers to merge.')
})

test('merge layer undo and redo restore layer membership', () => {
  const state = createLayerOperationState(createTwoLayerDiagram())
  const merged = applyMergeLayersToEditorState(state, 0, 1)
  const undone = undoLastDiagramChange(merged)
  const redone = redoLastDiagramChange(undone)

  assert.equal(findPoint(merged.editableDiagram, 'source-point').layer, 1)
  assert.equal(findPoint(undone.editableDiagram, 'source-point').layer, 0)
  assert.equal(findLabel(undone.editableDiagram, 'source-label').layer, 0)
  assert.equal(findPoint(redone.editableDiagram, 'source-point').layer, 1)
})

test('layer operation translation accepts symbolic deltas for symbolic points', () => {
  const diagram = createSymbolicLayerOperationDiagram()
  const parsed = parseTranslationVectorFromInputs(diagram, {
    dx: 'Len/2',
    dy: '0',
    dz: '0',
  })

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const state = createLayerOperationState(diagram)
  const next = applyTranslateLayerToEditorState(state, 3, parsed.translation)
  const point = findPoint(next.editableDiagram, 'symbolic-point')

  assert.equal(point.position.x, 5)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic.x.expression, '(R) + (Len/2)')
  assert.equal(point.position.symbolic.x.previewValue, 5)
  assert.equal(next.layerOperationStatus, 'Translated layer 3 by (2, 0, 0).')
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

test('layer palette button displays creation layer value and total count', () => {
  assert.equal(layerButtonLabel('2', 7), 'L2 / 7')
  assert.equal(layerButtonLabel('2.5', 7), 'L2.5 / 7')
  assert.equal(layerButtonLabel('', 7), 'L? / 7')
})

test('layer palette rows keep creation layer and filter state separate', () => {
  const rows = layerPaletteRows(
    createTwoLayerDiagram(),
    { kind: 'layer', layer: 1 },
    '0',
  )

  assert.equal(rows.length, 2)
  assert.equal(rows[0].layer.value, 0)
  assert.equal(rows[0].isCreationLayer, true)
  assert.equal(rows[0].isFilterActive, false)
  assert.equal(rows[1].layer.value, 1)
  assert.equal(rows[1].isCreationLayer, false)
  assert.equal(rows[1].isFilterActive, true)
  assert.equal(layerCreationInputForLayer(rows[1].layer.value), '1')
})

test('layer palette View changes do not rewrite the New layer input', () => {
  const diagram = createThreeLayerDiagram()
  const creationLayerInput = '0'
  const viewFilter = layerFilterFromSelectValue('1')
  const rows = layerPaletteRows(diagram, viewFilter, creationLayerInput)

  assert.deepEqual(viewFilter, { kind: 'layer', layer: 1 })
  assert.equal(layerButtonLabel(creationLayerInput, rows.length), 'L0 / 3')
  assert.equal(rows[0].isCreationLayer, true)
  assert.equal(rows[0].isFilterActive, false)
  assert.equal(rows[1].isCreationLayer, false)
  assert.equal(rows[1].isFilterActive, true)
})

test('layer palette New changes update creation label without changing View', () => {
  const diagram = createThreeLayerDiagram()
  const viewFilter = layerFilterFromSelectValue('1')
  const creationLayerInput = layerCreationInputForLayer(2)
  const rows = layerPaletteRows(diagram, viewFilter, creationLayerInput)

  assert.deepEqual(viewFilter, { kind: 'layer', layer: 1 })
  assert.equal(layerFilterSelectValue(viewFilter), '1')
  assert.equal(layerButtonLabel(creationLayerInput, rows.length), 'L2 / 3')
  assert.equal(rows[1].isFilterActive, true)
  assert.equal(rows[2].isCreationLayer, true)
  assert.equal(rows[2].isFilterActive, false)
})

test('layer palette drag/drop resolves to a layer swap only for valid targets', () => {
  assert.deepEqual(resolveLayerDropSwap(0, 1), {
    ok: true,
    leftLayerValue: 0,
    rightLayerValue: 1,
  })
  assert.deepEqual(resolveLayerDropSwap(1, 1), { ok: false })
  assert.deepEqual(resolveLayerDropSwap(null, 1), { ok: false })
})

test('layer drag payload parser rejects empty and invalid payloads', () => {
  assert.equal(parseDraggedLayerValue(''), null)
  assert.equal(parseDraggedLayerValue('   '), null)
  assert.equal(parseDraggedLayerValue('0'), 0)
  assert.equal(parseDraggedLayerValue('1'), 1)
  assert.equal(parseDraggedLayerValue('-1'), -1)
  assert.equal(parseDraggedLayerValue('NaN'), null)
  assert.equal(parseDraggedLayerValue('Infinity'), null)
  assert.equal(parseDraggedLayerValue('abc'), null)
})

test('layer drop source rejects empty payloads without an active internal drag', () => {
  const calls = resolvedLayerSwapCalls({
    customPayload: '',
    plainPayload: '',
    draggedLayerValue: null,
    targetLayerValue: 1,
  })

  assert.deepEqual(calls, [])
})

test('layer drop source allows empty payload fallback during active layer zero drag', () => {
  const calls = resolvedLayerSwapCalls({
    customPayload: '',
    plainPayload: '',
    draggedLayerValue: 0,
    targetLayerValue: 1,
  })

  assert.deepEqual(calls, [[0, 1]])
})

test('layer drop source rejects external plain text and invalid payloads', () => {
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '',
      plainPayload: '1',
      draggedLayerValue: null,
      targetLayerValue: 0,
    }),
    [],
  )
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '',
      plainPayload: 'abc',
      draggedLayerValue: null,
      targetLayerValue: 0,
    }),
    [],
  )
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: 'Infinity',
      plainPayload: 'Infinity',
      draggedLayerValue: null,
      targetLayerValue: 0,
    }),
    [],
  )
})

test('layer drop source rejects missing layers and same-layer drops', () => {
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '99',
      plainPayload: '99',
      draggedLayerValue: null,
      targetLayerValue: 1,
    }),
    [],
  )
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '0',
      plainPayload: '0',
      draggedLayerValue: null,
      targetLayerValue: 99,
    }),
    [],
  )
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '1',
      plainPayload: '1',
      draggedLayerValue: null,
      targetLayerValue: 1,
    }),
    [],
  )
})

test('layer drop source accepts valid internal payloads and active fallbacks', () => {
  assert.equal(
    resolveLayerDropSource({
      customPayload: '1',
      plainPayload: '1',
      draggedLayerValue: null,
      validLayerValues: [0, 1, 2],
    }),
    1,
  )
  assert.equal(
    resolveLayerDropSource({
      customPayload: '',
      plainPayload: '1',
      draggedLayerValue: 2,
      validLayerValues: [0, 1, 2],
    }),
    2,
  )
})

test('layer drag/drop regression preserves normal layer swaps', () => {
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '0',
      plainPayload: '0',
      draggedLayerValue: 0,
      targetLayerValue: 1,
    }),
    [[0, 1]],
  )
  assert.deepEqual(
    resolvedLayerSwapCalls({
      customPayload: '2',
      plainPayload: '2',
      draggedLayerValue: 2,
      targetLayerValue: 1,
    }),
    [[2, 1]],
  )
})

test('selected layer action target stays scoped to the selected layer', () => {
  const layers = [
    { value: 0, name: 'Layer 0' },
    { value: 2, name: 'Layer 2' },
  ]

  assert.equal(selectedLayerActionTarget(layers, 2, '0'), 2)
  assert.equal(selectedLayerActionTarget(layers, 99, '2'), 2)
  assert.equal(selectedLayerActionTarget(layers, 99, '99'), 0)
  assert.equal(selectedLayerActionTarget([], 99, '99'), null)
})

test('layer manager fold helpers do not affect generated TikZ', () => {
  const diagram = createTwoLayerDiagram()
  const before = generateTikz(diagram)

  nextLayerManagerExpandedState(false)
  shouldShowLayerManagerDetails(false, 2)
  layerManagerSummary([{ value: 0, name: 'Layer 0' }], new Map([[0, 1]]))

  assert.equal(generateTikz(diagram), before)
})

test('layer palette open state does not affect generated TikZ', () => {
  const diagram = createTwoLayerDiagram()
  const before = generateTikz(diagram)

  nextLayerPaletteOpenState(false)
  nextLayerPaletteOpenState(true)
  layerButtonLabel('0', 2)

  assert.equal(generateTikz(diagram), before)
})

test('layer thumbnail handles empty layers and caps many elements', () => {
  const emptyLayerDiagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    layers: [{ value: 5, name: 'Empty' }],
  }
  let manyElementDiagram = createEmptyDiagram({ ambientDimension: 2 })

  for (let index = 0; index < 21; index += 1) {
    manyElementDiagram = addPointStratumWithResult(
      manyElementDiagram,
      { x: index, y: 0, z: 0 },
      { id: `point-${index}`, layer: 0 },
    ).diagram
  }

  const emptyThumbnail = createLayerThumbnail(emptyLayerDiagram, 5)
  const cappedThumbnail = createLayerThumbnail(manyElementDiagram, 0, 5)

  assert.equal(emptyThumbnail.totalElementCount, 0)
  assert.equal(emptyThumbnail.marks.length, 0)
  assert.equal(cappedThumbnail.totalElementCount, 21)
  assert.equal(cappedThumbnail.marks.length, 5)
  assert.equal(cappedThumbnail.hiddenElementCount, 16)
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

function createThreeLayerDiagram(): Diagram {
  return addPointStratumWithResult(
    createTwoLayerDiagram(),
    { x: 0, y: 0, z: 0 },
    { id: 'third-point', name: 'Third', layer: 2 },
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

function createSymbolicLayerOperationDiagram(): Diagram {
  const diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [
      {
        id: 'var-r',
        name: 'R',
        macroName: 'R',
        expression: '3',
        previewValue: 3,
      },
      {
        id: 'var-len',
        name: 'Len',
        macroName: 'Len',
        expression: '4',
        previewValue: 4,
      },
    ],
  }

  return addPointStratumWithResult(
    diagram,
    {
      x: 3,
      y: 0,
      z: 0,
      symbolic: {
        x: { kind: 'symbolic', expression: 'R', previewValue: 3 },
        y: { kind: 'numeric', value: 0 },
        z: { kind: 'numeric', value: 0 },
      },
    },
    { id: 'symbolic-point', name: 'Symbolic', layer: 3 },
  ).diagram
}

function addLayerOperationCoordinateAnchor(diagram: Diagram): Diagram {
  return {
    ...diagram,
    coordinateAnchors: [
      createCoordinateAnchor(diagram, {
        id: 'coord-a',
        name: 'A',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 10 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
    ],
  }
}

function createLayerCoordinateReferenceDiagram(): Diagram {
  const diagram = addLayerOperationCoordinateAnchor(
    createEmptyDiagram({ ambientDimension: 2 }),
  )
  const reference = coordinateReferenceVec3ForAnchorId(diagram, 'coord-a')

  if (reference === null) {
    throw new Error('Expected coordinate reference.')
  }

  return addPointStratumWithResult(
    diagram,
    reference,
    { id: 'reference-point', name: 'Reference point', layer: 0 },
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

function hasCoordinateAnchor(diagram: Diagram, id: string): boolean {
  return (diagram.coordinateAnchors ?? []).some((anchor) => anchor.id === id)
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

type ResolvedLayerSwapCallInput = {
  customPayload: string
  plainPayload: string
  draggedLayerValue: number | null
  targetLayerValue: number
  validLayerValues?: readonly number[]
}

function resolvedLayerSwapCalls(
  input: ResolvedLayerSwapCallInput,
): [number, number][] {
  const validLayerValues = input.validLayerValues ?? [0, 1, 2]
  const sourceLayerValue = resolveLayerDropSource({
    customPayload: input.customPayload,
    plainPayload: input.plainPayload,
    draggedLayerValue: input.draggedLayerValue,
    validLayerValues,
  })
  const swap = resolveLayerDropSwap(
    sourceLayerValue,
    input.targetLayerValue,
    validLayerValues,
  )

  return swap.ok ? [[swap.leftLayerValue, swap.rightLayerValue]] : []
}
