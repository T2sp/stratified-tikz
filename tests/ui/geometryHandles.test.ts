import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import type {
  CurveStratum,
  Diagram,
  PointStratum,
  PolygonSheetStratum,
  TextLabel,
} from '../../src/model/types.ts'
import {
  addCubicBezierCurveStratumWithResult,
  addPointStratumWithResult,
  addPolygonSheetStratumWithResult,
  addPolylineCurveStratumWithResult,
  addTextLabelWithResult,
} from '../../src/ui/diagramUpdates.ts'
import { updateDiagramGeometryHandle } from '../../src/ui/geometryHandles.ts'

test('geometry handle update moves a point stratum position immutably', () => {
  const result = addPointStratumWithResult(
    twoDimensionalExample,
    { x: 0, y: 0, z: 0 },
    { id: 'drag-point', name: 'Dragged point', layer: 4 },
  )
  const beforePoint = findPoint(result.diagram, result.id)
  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'pointPosition', stratumId: result.id },
    { x: 2, y: 3, z: 99 },
  )
  const afterPoint = findPoint(updated, result.id)

  assert.notEqual(updated, result.diagram)
  assert.deepEqual(beforePoint.position, { x: 0, y: 0, z: 0 })
  assert.deepEqual(afterPoint.position, { x: 2, y: 3, z: 0 })
  assert.equal(afterPoint.id, beforePoint.id)
  assert.equal(afterPoint.name, beforePoint.name)
  assert.equal(afterPoint.layer, beforePoint.layer)
  assert.equal(afterPoint.codim, beforePoint.codim)
  assert.equal(afterPoint.geometricKind, beforePoint.geometricKind)
  assert.deepEqual(afterPoint.style, beforePoint.style)
})

test('geometry handle update moves a free text label position immutably', () => {
  const result = addTextLabelWithResult(
    twoDimensionalExample,
    { x: 0, y: 0, z: 0 },
    { id: 'drag-label', text: '$L$', layer: 5 },
  )
  const beforeLabel = findLabel(result.diagram, result.id)
  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'labelPosition', labelId: result.id },
    { x: -1, y: 2.5, z: 3 },
  )
  const afterLabel = findLabel(updated, result.id)

  assert.deepEqual(beforeLabel.position, { x: 0, y: 0, z: 0 })
  assert.deepEqual(afterLabel.position, { x: -1, y: 2.5, z: 0 })
  assert.equal(afterLabel.text, '$L$')
  assert.equal(afterLabel.layer, beforeLabel.layer)
  assert.deepEqual(afterLabel.style, beforeLabel.style)
})

test('geometry handle update moves a polyline vertex and preserves point order', () => {
  const result = addPolylineCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
    { id: 'drag-polyline', layer: 6 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected polyline creation to succeed.')
  }

  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'curvePoint', stratumId: result.id, pointIndex: 1 },
    { x: 4, y: 5, z: 8 },
  )
  const curve = findCurve(updated, result.id)

  assert.equal(curve.kind, 'polyline')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 5, z: 0 },
    { x: 2, y: 0, z: 0 },
  ])
})

test('geometry handle update moves a cubic Bezier control point preserving roles', () => {
  const result = addCubicBezierCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 4, z: 0 },
      { x: 5, y: 6, z: 0 },
    ],
    { id: 'drag-bezier', layer: 7 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected cubic Bezier creation to succeed.')
  }

  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'curvePoint', stratumId: result.id, pointIndex: 2 },
    { x: -3, y: -4, z: 9 },
  )
  const curve = findCurve(updated, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: -3, y: -4, z: 0 },
    { x: 5, y: 6, z: 0 },
  ])
})

test('geometry handle update converts relative cubic Bezier controls to absolute mode', () => {
  const result = addCubicBezierCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 7, y: 14, z: 0 },
      { x: 10, y: 10, z: 0 },
    ],
    {
      id: 'drag-relative-bezier',
      layer: 7,
      bezierControls: {
        kind: 'relativeCartesian',
        firstControlOffset: { x: 1, y: 2, z: 0 },
        secondControlOffset: { x: -3, y: 4, z: 0 },
        secondOffsetReference: 'end',
      },
    },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected cubic Bezier creation to succeed.')
  }

  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'curvePoint', stratumId: result.id, pointIndex: 1 },
    { x: 2, y: 3, z: 0 },
  )
  const curve = findCurve(updated, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points[1], { x: 2, y: 3, z: 0 })
  assert.deepEqual(curve.bezierControls, { kind: 'absolute' })
})

test('geometry handle update moves polygon sheet vertices preserving order', () => {
  const result = addPolygonSheetStratumWithResult(
    threeDimensionalExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
    { id: 'drag-sheet', layer: 8 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected polygon sheet creation to succeed.')
  }

  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'sheetVertex', stratumId: result.id, vertexIndex: 0 },
    { x: -1, y: -2, z: -3 },
  )
  const sheet = findPolygonSheet(updated, result.id)

  assert.deepEqual(sheet.vertices, [
    { x: -1, y: -2, z: -3 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ])
})

test('geometry handle update preserves 3D coordinates on finite updates', () => {
  const result = addTextLabelWithResult(
    threeDimensionalExample,
    { x: 0, y: 0, z: 0 },
    { id: 'drag-3d-label' },
  )
  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'labelPosition', labelId: result.id },
    { x: 1, y: 2, z: 3 },
  )

  assert.deepEqual(findLabel(updated, result.id).position, { x: 1, y: 2, z: 3 })
})

test('geometry handle update rejects non-finite coordinates without changing diagram', () => {
  const result = addPointStratumWithResult(
    threeDimensionalExample,
    { x: 0, y: 0, z: 0 },
    { id: 'reject-non-finite' },
  )
  const updated = updateDiagramGeometryHandle(
    result.diagram,
    { kind: 'pointPosition', stratumId: result.id },
    { x: Number.POSITIVE_INFINITY, y: 2, z: 3 },
  )

  assert.equal(updated, result.diagram)
  assert.deepEqual(findPoint(updated, result.id).position, { x: 0, y: 0, z: 0 })
})

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Point ${id} was not found.`)
  }

  return stratum
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Curve ${id} was not found.`)
  }

  return stratum
}

function findPolygonSheet(diagram: Diagram, id: string): PolygonSheetStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'sheet' || stratum.kind !== 'polygonSheet') {
    throw new Error(`Polygon sheet ${id} was not found.`)
  }

  return stratum
}

function findLabel(diagram: Diagram, id: string): TextLabel {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Label ${id} was not found.`)
  }

  return label
}
