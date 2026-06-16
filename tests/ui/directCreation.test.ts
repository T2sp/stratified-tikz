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
  addCubicBezierCurveFromDirectInput,
  addPointStratumFromDirectInput,
  addPolygonSheetFromDirectInput,
  addPolylineCurveFromDirectInput,
  addTextLabelFromDirectInput,
  applyDirectCreationCommitToEditorState,
  commitDirectCreationResult,
  parseDirectCoordinateRows,
  parseDirectLayerInput,
} from '../../src/ui/diagramUpdates.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  layerFilterIncludesLayer,
  type LayerFilter,
} from '../../src/ui/layerFilter.ts'

type TestEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  draftMarker: string
}

test('direct point creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addPointStratumFromDirectInput(
    initialState.editableDiagram,
    { x: '10', y: '11', z: '99' },
    { layer: 5 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 5)
  const point = committed.editableDiagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(
    committed.editableDiagram.strata.length,
    initialState.editableDiagram.strata.length + 1,
  )
  assert.equal(point?.geometricKind, 'point')
  assert.equal(point?.layer, 5)
  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.equal('diagram' in committed, false)
  assert.match(generateTikz(committed.editableDiagram), /\(10,11\)/)
})

test('direct label creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addTextLabelFromDirectInput(
    initialState.editableDiagram,
    { x: '12', y: '13', z: '99' },
    '$L$',
    { layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct label creation to succeed.')
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'label',
    id: result.id,
  }, 6)
  const label = committed.editableDiagram.labels.find(
    (candidate) => candidate.id === result.id,
  )

  assert.equal(
    committed.editableDiagram.labels.length,
    initialState.editableDiagram.labels.length + 1,
  )
  assert.equal(label?.text, '$L$')
  assert.equal(label?.layer, 6)
  assert.deepEqual(label?.position, { x: 12, y: 13, z: 0 })
  assert.deepEqual(committed.selectedElement, { kind: 'label', id: result.id })
  assert.match(generateTikz(committed.editableDiagram), /\$L\$/)
})

test('direct polyline creation assigns 2D codim, layer, selection, and z normalization', () => {
  const result = addPolylineCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '1', z: '9' },
      { x: '2', y: '3', z: '9' },
    ],
    { layer: 7 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)
  assert.equal(curve.kind, 'polyline')
  assert.equal(curve.codim, 1)
  assert.equal(curve.layer, 7)
  assert.deepEqual(
    curve.points.map((point) => point.z),
    [0, 0],
  )

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    7,
    { kind: 'layer', layer: 0 },
  )

  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 7 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, curve.layer), true)
})

test('direct polyline creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addPolylineCurveFromDirectInput(
    initialState.editableDiagram,
    [
      { x: '1', y: '2', z: '99' },
      { x: '3', y: '4', z: '99' },
    ],
    { layer: 7 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 7)
  const curve = findCurve(committed.editableDiagram, result.id)

  assert.equal(
    committed.editableDiagram.strata.length,
    initialState.editableDiagram.strata.length + 1,
  )
  assert.equal(curve.kind, 'polyline')
  assert.deepEqual(curve.points, [
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
  ])
  assert.equal(curve.layer, 7)
  assert.match(generateTikz(committed.editableDiagram), /\(curvePolyCurve\d+p0\) -- \(curvePolyCurve\d+p1\);/)
})

test('direct polyline creation assigns 3D curve codim and explicit layer', () => {
  const result = addPolylineCurveFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '1', z: '2' },
      { x: '3', y: '4', z: '5' },
    ],
    { layer: -2 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)
  assert.equal(curve.kind, 'polyline')
  assert.equal(curve.codim, 2)
  assert.equal(curve.layer, -2)
  assert.deepEqual(curve.points[1], { x: 3, y: 4, z: 5 })
})

test('direct cubic Bezier creation preserves point order and explicit layer', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '3', y: '4', z: '0' },
      { x: '5', y: '6', z: '0' },
    ],
    { layer: 4 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)
  assert.equal(curve.kind, 'cubicBezier')
  assert.equal(curve.layer, 4)
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
    { x: 5, y: 6, z: 0 },
  ])

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    4,
    { kind: 'all' },
  )
  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  assert.deepEqual(committed.layerFilter, { kind: 'all' })
})

test('direct cubic Bezier creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addCubicBezierCurveFromDirectInput(
    initialState.editableDiagram,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '3', y: '4', z: '0' },
      { x: '5', y: '6', z: '0' },
    ],
    { layer: 8 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 8)
  const curve = findCurve(committed.editableDiagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
    { x: 5, y: 6, z: 0 },
  ])
  assert.equal(curve.layer, 8)
  assert.match(generateTikz(committed.editableDiagram), /\.\. controls/)
})

test('direct cubic Bezier creation rejects invalid and non-finite input', () => {
  const result = addCubicBezierCurveFromDirectInput(twoDimensionalExample, [
    { x: '0', y: '0', z: '0' },
    { x: '1', y: '2', z: '0' },
    { x: 'Infinity', y: '4', z: '0' },
    { x: '5', y: '6', z: '0' },
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected non-finite input to be rejected.')
  }
  assert.equal(result.error, 'invalidCoordinates')
})

test('direct relative Cartesian cubic Bezier creation stores metadata and absolute controls', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '10', y: '10', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '-3', y: '4', z: '0' },
    ],
    { directControlMode: 'relativeCartesian', layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 7, y: 14, z: 0 },
    { x: 10, y: 10, z: 0 },
  ])
  assert.deepEqual(curve.bezierControls, {
    kind: 'relativeCartesian',
    firstControlOffset: { x: 1, y: 2, z: 0 },
    secondControlOffset: { x: -3, y: 4, z: 0 },
    secondOffsetReference: 'end',
  })
  assert.match(
    generateTikz(result.diagram),
    /\.\. controls \+\(1,2\) and \+\(-3,4\) \.\./,
  )
})

test('direct relative polar cubic Bezier creation stores metadata and uses polar export', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '5', y: '5', z: '0' },
      { x: '0', y: '2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    { directControlMode: 'relativePolar', layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.bezierControls, {
    kind: 'relativePolar',
    firstControl: { angleDegrees: 0, radius: 2 },
    secondControl: { angleDegrees: 90, radius: 3 },
    secondOffsetReference: 'end',
  })
  assert.match(
    generateTikz(result.diagram),
    /\.\. controls \+\(0:2\) and \+\(90:3\) \.\./,
  )
})

test('direct relative polar cubic Bezier creation rejects negative radii', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '5', y: '5', z: '0' },
      { x: '0', y: '-2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    { directControlMode: 'relativePolar' },
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected negative radius to be rejected.')
  }
  assert.equal(result.error, 'invalidCoordinates')
})

test('direct 3D polygon sheet creation commits ordinary sheet data on the selected layer', () => {
  const result = addPolygonSheetFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '0', z: '0' },
      { x: '0', y: '1', z: '0' },
    ],
    { layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const sheet = findPolygonSheet(result.diagram, result.id)
  assert.equal(sheet.geometricKind, 'sheet')
  assert.equal(sheet.kind, 'polygonSheet')
  assert.equal(sheet.codim, 1)
  assert.equal(sheet.layer, 6)
  assert.equal(sheet.vertices.length, 3)

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    6,
    { kind: 'layer', layer: 0 },
  )
  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 6 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, sheet.layer), true)
})

test('direct polygon sheet creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(threeDimensionalExample)
  const result = addPolygonSheetFromDirectInput(
    initialState.editableDiagram,
    [
      { x: '0', y: '0', z: '2' },
      { x: '1', y: '0', z: '2' },
      { x: '0', y: '1', z: '2' },
    ],
    { layer: 9 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 9)
  const sheet = findPolygonSheet(committed.editableDiagram, result.id)

  assert.equal(
    committed.editableDiagram.strata.length,
    initialState.editableDiagram.strata.length + 1,
  )
  assert.deepEqual(sheet.vertices, [
    { x: 0, y: 0, z: 2 },
    { x: 1, y: 0, z: 2 },
    { x: 0, y: 1, z: 2 },
  ])
  assert.equal(sheet.layer, 9)
  assert.match(generateTikz(committed.editableDiagram), /-- cycle;/)
})

test('direct creation on a hidden layer updates the filter and keeps selection visible', () => {
  const initialState = createTestEditorState(twoDimensionalExample, {
    kind: 'layer',
    layer: 0,
  })
  const result = addPointStratumFromDirectInput(
    initialState.editableDiagram,
    { x: '1', y: '2', z: '99' },
    { layer: 42 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 42)

  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 42 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, 42), true)
})

test('direct polygon sheet creation is unavailable in 2D and rejects invalid input', () => {
  const twoDimensionalResult = addPolygonSheetFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '0', z: '0' },
      { x: '0', y: '1', z: '0' },
    ],
  )
  assert.equal(twoDimensionalResult.ok, false)
  if (twoDimensionalResult.ok) {
    throw new Error('Expected 2D sheet creation to be rejected.')
  }
  assert.equal(twoDimensionalResult.error, 'unsupportedAmbientDimension')

  const invalidResult = addPolygonSheetFromDirectInput(threeDimensionalExample, [
    { x: '0', y: '0', z: '0' },
    { x: 'NaN', y: '0', z: '0' },
    { x: '0', y: '1', z: '0' },
  ])
  assert.equal(invalidResult.ok, false)
  if (invalidResult.ok) {
    throw new Error('Expected invalid sheet coordinates to be rejected.')
  }
  assert.equal(invalidResult.error, 'invalidCoordinates')
})

test('direct creation layer helpers reject invalid layer input and keep TikZ UI-state independent', () => {
  assert.equal(parseDirectLayerInput(''), null)
  assert.equal(parseDirectLayerInput('Infinity'), null)
  assert.equal(parseDirectLayerInput('3'), 3)

  const result = addPointStratumFromDirectInput(
    twoDimensionalExample,
    { x: '1', y: '2', z: '9' },
    { layer: 8 },
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const before = generateTikz(result.diagram)
  commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    8,
    { kind: 'layer', layer: 0 },
  )

  assert.equal(generateTikz(result.diagram), before)
})

test('direct coordinate rows parse only exposed axes for the ambient dimension', () => {
  assert.deepEqual(parseDirectCoordinateRows('0 1\n2,3', 2), [
    { x: '0', y: '1', z: '0' },
    { x: '2', y: '3', z: '0' },
  ])
  assert.deepEqual(parseDirectCoordinateRows('0 1 2\n3,4,5', 3), [
    { x: '0', y: '1', z: '2' },
    { x: '3', y: '4', z: '5' },
  ])
  assert.equal(parseDirectCoordinateRows('0 1 2', 2), null)
})

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

function createTestEditorState(
  diagram: Diagram,
  layerFilter: LayerFilter = { kind: 'all' },
): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter,
    draftMarker: 'preserve unrelated editor state',
  }
}

function commitDirectCreationToTestState(
  state: TestEditorState,
  result: { diagram: Diagram },
  selectedElement: Exclude<SelectedElement, null>,
  createdLayer: number,
): TestEditorState {
  return applyDirectCreationCommitToEditorState(
    state,
    commitDirectCreationResult(
      result.diagram,
      selectedElement,
      createdLayer,
      state.layerFilter,
    ),
  )
}
