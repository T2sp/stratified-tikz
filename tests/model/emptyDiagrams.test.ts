import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
} from '../../src/examples/index.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addPointStratumWithResult,
  addPolygonSheetStratumWithResult,
  addTextLabelWithResult,
} from '../../src/ui/diagramUpdates.ts'

test('empty 2D diagram is valid and generates TikZ', () => {
  assert.equal(emptyTwoDimensionalDiagram.ambientDimension, 2)
  assert.equal(emptyTwoDimensionalDiagram.strata.length, 0)
  assert.equal(emptyTwoDimensionalDiagram.labels.length, 0)
  assert.equal(validateDiagram(emptyTwoDimensionalDiagram).valid, true)
  assert.match(generateTikz(emptyTwoDimensionalDiagram), /\\begin\{tikzpicture\}/)
  assert.doesNotMatch(generateTikz(emptyTwoDimensionalDiagram), /\\coordinate/)
})

test('empty 3D diagram is valid and generates TikZ', () => {
  assert.equal(emptyThreeDimensionalDiagram.ambientDimension, 3)
  assert.equal(emptyThreeDimensionalDiagram.strata.length, 0)
  assert.equal(emptyThreeDimensionalDiagram.labels.length, 0)
  assert.equal(validateDiagram(emptyThreeDimensionalDiagram).valid, true)
  assert.match(generateTikz(emptyThreeDimensionalDiagram), /\\begin\{tikzpicture\}/)
  assert.doesNotMatch(generateTikz(emptyThreeDimensionalDiagram), /\\coordinate/)
})

test('empty diagrams serialize and load as ordinary diagrams', () => {
  for (const diagram of [
    emptyTwoDimensionalDiagram,
    emptyThreeDimensionalDiagram,
  ]) {
    const result = parseSavedDiagramJson(serializeDiagram(diagram))

    assert.equal(result.ok, true)
    if (!result.ok) {
      throw new Error(result.error)
    }
    assert.deepEqual(result.diagram, diagram)
  }
})

test('creation works from an empty 2D diagram', () => {
  const pointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 1, y: 2, z: 99 },
    { layer: 0 },
  )
  const labelResult = addTextLabelWithResult(
    pointResult.diagram,
    { x: 3, y: 4, z: 99 },
    { text: '$L$', layer: 0 },
  )
  const point = labelResult.diagram.strata[0]

  assert.equal(pointResult.diagram.strata.length, 1)
  assert.equal(labelResult.diagram.labels.length, 1)
  assert.equal(point.geometricKind, 'point')
  if (point.geometricKind !== 'point') {
    throw new Error('Expected first created stratum to be a point.')
  }
  assert.equal(point.codim, 2)
  assert.deepEqual(point.position, { x: 1, y: 2, z: 0 })
  assert.match(generateTikz(labelResult.diagram), /\(1,2\)/)
  assert.match(generateTikz(labelResult.diagram), /\$L\$/)
})

test('creation works from an empty 3D diagram', () => {
  const pointResult = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 1, y: 2, z: 3 },
    { layer: 0 },
  )
  const sheetResult = addPolygonSheetStratumWithResult(
    pointResult.diagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
    { layer: 0 },
  )

  assert.equal(pointResult.diagram.strata.length, 1)
  assert.notEqual(sheetResult.id, null)
  assert.equal(sheetResult.diagram.strata.length, 2)
  assert.match(generateTikz(sheetResult.diagram), /\(1,2,3\)/)
  assert.match(generateTikz(sheetResult.diagram), /-- cycle;/)
})
