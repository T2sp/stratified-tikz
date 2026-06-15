import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import type {
  CurveStratum,
  Diagram,
  PolygonSheetStratum,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addCubicBezierCurveStratumWithResult,
  addPointStratumWithResult,
  addPolygonSheetStratumWithResult,
  addPolylineCurveStratumWithResult,
  addTextLabelWithResult,
  applyDirectCreationCommitToEditorState,
  commitDirectCreationResult,
  parseDirectLayerInput,
} from '../../src/ui/diagramUpdates.ts'
import type { LayerFilter } from '../../src/ui/layerFilter.ts'
import { layerFilterIncludesLayer } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'

type TestEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
}

test('cursor point creation uses the selected creation layer', () => {
  const state = createState(twoDimensionalExample)
  const result = addPointStratumWithResult(
    state.editableDiagram,
    { x: 1, y: 2, z: 99 },
    { layer: 7 },
  )
  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'stratum',
    id: result.id,
  }, 7)
  const point = committed.editableDiagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(point?.geometricKind, 'point')
  assert.equal(point?.layer, 7)
  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.match(generateTikz(committed.editableDiagram), /\(1,2\)/)
})

test('cursor label creation uses the selected creation layer', () => {
  const state = createState(twoDimensionalExample)
  const result = addTextLabelWithResult(
    state.editableDiagram,
    { x: 3, y: 4, z: 99 },
    { layer: -2 },
  )
  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'label',
    id: result.id,
  }, -2)
  const label = committed.editableDiagram.labels.find(
    (candidate) => candidate.id === result.id,
  )

  assert.equal(label?.layer, -2)
  assert.deepEqual(label?.position, { x: 3, y: 4, z: 0 })
  assert.deepEqual(committed.selectedElement, { kind: 'label', id: result.id })
  assert.match(generateTikz(committed.editableDiagram), /Label/)
})

test('cursor polyline finish uses the selected creation layer', () => {
  const state = createState(twoDimensionalExample)
  const result = addPolylineCurveStratumWithResult(
    state.editableDiagram,
    [
      { x: 0, y: 0, z: 99 },
      { x: 1, y: 1, z: 99 },
    ],
    { layer: 3 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected polyline creation to succeed.')
  }

  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'stratum',
    id: result.id,
  }, 3)
  const curve = findCurve(committed.editableDiagram, result.id)

  assert.equal(curve.kind, 'polyline')
  assert.equal(curve.layer, 3)
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ])
})

test('cursor cubic Bezier creation uses the selected creation layer', () => {
  const state = createState(twoDimensionalExample)
  const result = addCubicBezierCurveStratumWithResult(
    state.editableDiagram,
    [
      { x: 0, y: 0, z: 99 },
      { x: 1, y: 2, z: 99 },
      { x: 3, y: 2, z: 99 },
      { x: 4, y: 0, z: 99 },
    ],
    { layer: 4 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected cubic Bezier creation to succeed.')
  }

  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'stratum',
    id: result.id,
  }, 4)
  const curve = findCurve(committed.editableDiagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.equal(curve.layer, 4)
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: 4, y: 0, z: 0 },
  ])
  assert.match(generateTikz(committed.editableDiagram), /\.\. controls/)
})

test('cursor polygon sheet finish uses the selected creation layer', () => {
  const state = createState(threeDimensionalExample)
  const result = addPolygonSheetStratumWithResult(
    state.editableDiagram,
    [
      { x: 0, y: 0, z: 2 },
      { x: 1, y: 0, z: 2 },
      { x: 0, y: 1, z: 2 },
    ],
    { layer: 5 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected polygon sheet creation to succeed.')
  }

  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'stratum',
    id: result.id,
  }, 5)
  const sheet = findPolygonSheet(committed.editableDiagram, result.id)

  assert.equal(sheet.layer, 5)
  assert.deepEqual(sheet.vertices, [
    { x: 0, y: 0, z: 2 },
    { x: 1, y: 0, z: 2 },
    { x: 0, y: 1, z: 2 },
  ])
  assert.match(generateTikz(committed.editableDiagram), /-- cycle;/)
})

test('cursor creation updates a hidden active layer filter to keep selection visible', () => {
  const state = createState(twoDimensionalExample, { kind: 'layer', layer: 0 })
  const result = addPointStratumWithResult(
    state.editableDiagram,
    { x: 0, y: 0, z: 0 },
    { layer: 12 },
  )
  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'stratum',
    id: result.id,
  }, 12)

  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 12 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, 12), true)
})

test('invalid cursor creation layer input is rejected before commit', () => {
  assert.equal(parseDirectLayerInput('NaN'), null)
  assert.equal(parseDirectLayerInput('Infinity'), null)
  assert.equal(parseDirectLayerInput(''), null)
})

function createState(
  diagram: Diagram,
  layerFilter: LayerFilter = { kind: 'all' },
): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter,
  }
}

function commitCursorCreation(
  state: TestEditorState,
  diagram: Diagram,
  selectedElement: Exclude<SelectedElement, null>,
  createdLayer: number,
): TestEditorState {
  return applyDirectCreationCommitToEditorState(
    state,
    commitDirectCreationResult(
      diagram,
      selectedElement,
      createdLayer,
      state.layerFilter,
    ),
  )
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Curve ${id} was not created.`)
  }

  return stratum
}

function findPolygonSheet(
  diagram: Diagram,
  id: string,
): PolygonSheetStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'sheet' || stratum.kind !== 'polygonSheet') {
    throw new Error(`Polygon sheet ${id} was not created.`)
  }

  return stratum
}
