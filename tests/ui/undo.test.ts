import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import {
  projectModelToScreen,
  screenToModelOnWorkPlane,
} from '../../src/geometry/projection.ts'
import { constructWorkPlaneFromThreePoints } from '../../src/geometry/workPlane.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import type { Camera3D, Diagram, Vec3, WorkPlane } from '../../src/model/types.ts'
import type { ConcatenatedPathDraft } from '../../src/ui/pathDraft.ts'
import { createCameraPresetCamera } from '../../src/ui/cameraControls.ts'
import {
  addCurvedSheetStratumWithResult,
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
  pathDraft: ConcatenatedPathDraft | null
  sheetPolygonDraft: null | { points: Vec3[] }
  directFormText: string
  activeWorkPlane: WorkPlane
  viewCamera: Camera3D
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

test('changing active work plane does not create a diagram history entry', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const customWorkPlane = constructWorkPlaneFromThreePoints(
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 1 },
    { x: 0, y: 1, z: 1 },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    activeWorkPlane: customWorkPlane,
  })

  assert.deepEqual(committed.activeWorkPlane, customWorkPlane)
  assert.equal(canUndoDiagramChange(committed.history), false)
})

test('changing editor-view camera does not create a diagram history entry', () => {
  const initial = createUndoState(createNamedPointDiagram('A'))
  const nextCamera = createCameraPresetCamera('isometric')
  const committed = commitDiagramChange(initial, {
    ...initial,
    viewCamera: nextCamera,
  })

  assert.deepEqual(committed.viewCamera, nextCamera)
  assert.deepEqual(committed.editableDiagram, initial.editableDiagram)
  assert.equal(canUndoDiagramChange(committed.history), false)
})

test('geometry creation under a changed camera creates a diagram history entry', () => {
  const initial = {
    ...createUndoState(createEmptyDiagram({ ambientDimension: 3 })),
    viewCamera: createCameraPresetCamera('isometric'),
  }
  const result = addPointStratumWithResult(
    initial.editableDiagram,
    { x: 1, y: 2, z: 3 },
    { id: 'camera-created-point', layer: 0 },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })
  const undone = undoLastDiagramChange(committed)

  assert.equal(canUndoDiagramChange(committed.history), true)
  assert.equal(hasStratum(committed.editableDiagram, result.id), true)
  assert.equal(hasStratum(undone.editableDiagram, result.id), false)
  assert.deepEqual(committed.viewCamera, initial.viewCamera)
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

test('creation undo removes curved sheet and redo restores primitive data', () => {
  const initial = createUndoState(createEmptyDiagram({ ambientDimension: 3 }))
  const result = addCurvedSheetStratumWithResult(
    initial.editableDiagram,
    { x: 1, y: 2, z: 3 },
    { kind: 'xy', z: 3 },
    {
      kind: 'hemisphere',
      radius: 1.25,
      hemisphereSide: 'positive',
      sampling: { uSegments: 4, vSegments: 2 },
    },
    { id: 'created-hemisphere', layer: 4 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected curved sheet creation to succeed.')
  }

  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(committed.editableDiagram, result.id), true)
  assert.equal(hasStratum(undone.editableDiagram, result.id), false)
  assert.equal(undone.selectedElement, null)
  assert.deepEqual(
    redone.editableDiagram.strata.find((stratum) => stratum.id === result.id),
    committed.editableDiagram.strata.find((stratum) => stratum.id === result.id),
  )
})

test('geometry created on a custom plane remains ordinary undoable diagram data', () => {
  const initial = createUndoState(createEmptyDiagram({ ambientDimension: 3 }))
  const customWorkPlane = constructWorkPlaneFromThreePoints(
    { x: 0, y: 0, z: 2 },
    { x: 1, y: 0, z: 2 },
    { x: 0, y: 1, z: 2 },
  )
  const committedModelPoint = screenToModelOnWorkPlane(
    projectModelToScreen({ x: 1, y: 1, z: 2 }, camera3D),
    customWorkPlane,
    camera3D,
  )
  const result = addPointStratumWithResult(
    initial.editableDiagram,
    committedModelPoint,
    { id: 'custom-plane-point', layer: 0 },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
    activeWorkPlane: customWorkPlane,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assertVec3AlmostEqual(committedModelPoint, { x: 1, y: 1, z: 2 })
  assert.equal(hasStratum(committed.editableDiagram, result.id), true)
  assert.equal(hasStratum(undone.editableDiagram, result.id), false)
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
    pathDraft: null,
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
    pathDraft: null,
    sheetPolygonDraft: null,
    directFormText: '',
    activeWorkPlane: { kind: 'xy', z: 0 },
    viewCamera: createCameraPresetCamera('initial'),
    history: createDiagramHistory(editableDiagram),
  }
}

const camera3D: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 13,
  phiDeg: -23,
  zoom: 10,
  pan: { x: 100, y: 50 },
  projectionBasis: {
    xVector: [1, 0],
    yVector: [0.5, 0.25],
    zVector: [0, 1],
  },
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

function assertVec3AlmostEqual(actual: Vec3, expected: Vec3): void {
  assert.ok(
    Math.abs(actual.x - expected.x) < 1e-10 &&
      Math.abs(actual.y - expected.y) < 1e-10 &&
      Math.abs(actual.z - expected.z) < 1e-10,
    `Expected ${JSON.stringify(actual)} to be approximately ${JSON.stringify(
      expected,
    )}.`,
  )
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}
