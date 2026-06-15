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
  commitDirectCreationResult,
  parseDirectCoordinateRows,
  parseDirectLayerInput,
} from '../../src/ui/diagramUpdates.ts'
import { layerFilterIncludesLayer } from '../../src/ui/layerFilter.ts'

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
