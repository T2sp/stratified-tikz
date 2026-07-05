import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
} from '../../src/examples/index.ts'
import type { CoordinateAnchor, Diagram } from '../../src/model/types.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addCubicBezierCurveStratumWithResult,
  addPointStratumWithResult,
  addPolygonSheetStratumWithResult,
  addPolylineCurveStratumWithResult,
} from '../../src/ui/diagramUpdates.ts'
import {
  createDirectCoordinateSourceHighlights,
  createWorkPlanePointPickingHighlights,
  type CoordinateSourceHighlight,
} from '../../src/ui/coordinateSourceHighlights.ts'

test('selected point source produces direct highlight data', () => {
  const pointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 2, y: 3, z: 0 },
    { id: 'source-point' },
  )
  const highlights = createDirectCoordinateSourceHighlights(pointResult.diagram, [
    {
      source: { kind: 'pointStratum', stratumId: 'source-point' },
      label: 'selected',
    },
  ])

  assert.equal(highlights.length, 1)
  assert.deepEqual(highlights[0], {
    kind: 'directSource',
    id: 'direct-source:pointStratum:source-point',
    position: { x: 2, y: 3, z: 0 },
    source: { kind: 'pointStratum', stratumId: 'source-point' },
    label: 'selected',
  })
})

test('selected polyline vertex source produces direct highlight data', () => {
  const curveResult = addPolylineCurveStratumWithResult(
    emptyTwoDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 5, z: 0 },
    ],
    { id: 'source-polyline' },
  )
  assert.notEqual(curveResult.id, null)

  const highlights = createDirectCoordinateSourceHighlights(curveResult.diagram, [
    {
      source: {
        kind: 'polylineVertex',
        curveId: 'source-polyline',
        vertexIndex: 1,
      },
      label: 'row 2',
    },
  ])

  assert.equal(highlights.length, 1)
  assert.equal(highlights[0]?.kind, 'directSource')
  assert.deepEqual(highlights[0]?.position, { x: 4, y: 5, z: 0 })
  assert.equal(highlights[0]?.label, 'row 2')
})

test('selected polygon sheet vertex source produces direct highlight data', () => {
  const sheetResult = addPolygonSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 },
    ],
    { id: 'source-sheet' },
  )
  assert.notEqual(sheetResult.id, null)

  const highlights = createDirectCoordinateSourceHighlights(sheetResult.diagram, [
    {
      source: {
        kind: 'sheetVertex',
        sheetId: 'source-sheet',
        vertexIndex: 2,
      },
      label: 'row 3',
    },
  ])

  assert.equal(highlights.length, 1)
  assert.equal(highlights[0]?.kind, 'directSource')
  assert.deepEqual(highlights[0]?.position, { x: 1, y: 2, z: 3 })
  assert.equal(highlights[0]?.label, 'row 3')
})

test('selected cubic Bezier point source produces direct highlight data', () => {
  const curveResult = addCubicBezierCurveStratumWithResult(
    emptyTwoDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 3, z: 0 },
      { x: 4, y: 5, z: 0 },
      { x: 6, y: 7, z: 0 },
    ],
    { id: 'source-bezier' },
  )
  assert.notEqual(curveResult.id, null)

  const highlights = createDirectCoordinateSourceHighlights(curveResult.diagram, [
    {
      source: {
        kind: 'cubicBezierPoint',
        curveId: 'source-bezier',
        pointRole: 'control2',
      },
      label: 'row 3',
    },
  ])

  assert.equal(highlights.length, 1)
  assert.equal(highlights[0]?.kind, 'directSource')
  assert.deepEqual(highlights[0]?.position, { x: 4, y: 5, z: 0 })
})

test('duplicate direct source highlights merge labels', () => {
  const pointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 2, y: 3, z: 0 },
    { id: 'source-point' },
  )
  const source = { kind: 'pointStratum', stratumId: 'source-point' } as const
  const highlights = createDirectCoordinateSourceHighlights(pointResult.diagram, [
    { source, label: 'row 1' },
    { source, label: 'selected' },
  ])

  assert.equal(highlights.length, 1)
  assert.equal(highlights[0]?.label, 'row 1, selected')
})

test('picked work-plane points produce numbered highlight data', () => {
  const diagram = createPointPickingDiagram()
  const highlights = createWorkPlanePointPickingHighlights(diagram, {
    active: true,
    pickedPointIds: ['p0', 'p1', 'p2'],
  })

  assert.deepEqual(
    highlights.map((highlight) =>
      highlight.kind === 'workPlanePick'
        ? {
            pointId: highlight.pointId,
            pickedIndex: highlight.pickedIndex,
            label: highlight.label,
            position: highlight.position,
          }
        : null,
    ),
    [
      {
        pointId: 'p0',
        pickedIndex: 1,
        label: '1',
        position: { x: 0, y: 0, z: 0 },
      },
      {
        pointId: 'p1',
        pickedIndex: 2,
        label: '2',
        position: { x: 1, y: 0, z: 0 },
      },
      {
        pointId: 'p2',
        pickedIndex: 3,
        label: '3',
        position: { x: 0, y: 1, z: 0 },
      },
    ],
  )
})

test('picked work-plane coordinate anchors produce numbered highlight data', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [coordinateAnchor('coord-a', 'A', 2, 3, 0)]
  const highlights = createWorkPlanePointPickingHighlights(diagram, {
    active: true,
    pickedPointIds: [],
    pickedTargets: [{ kind: 'coordinateAnchor', id: 'coord-a' }],
  })

  assert.deepEqual(
    highlights.map((highlight) =>
      highlight.kind === 'workPlanePick'
        ? {
            coordinateId: highlight.coordinateId,
            pickedIndex: highlight.pickedIndex,
            label: highlight.label,
            position: highlight.position,
          }
        : null,
    ),
    [
      {
        coordinateId: 'coord-a',
        pickedIndex: 1,
        label: '1',
        position: { x: 2, y: 3, z: 0 },
      },
    ],
  )
})

test('missing work-plane coordinate anchor picks produce no highlights', () => {
  assert.deepEqual(
    createWorkPlanePointPickingHighlights(emptyThreeDimensionalDiagram, {
      active: true,
      pickedPointIds: [],
      pickedTargets: [{ kind: 'coordinateAnchor', id: 'deleted-coordinate' }],
    }),
    [],
  )
})

test('missing coordinate sources produce no highlights and no crash', () => {
  assert.deepEqual(
    createDirectCoordinateSourceHighlights(emptyTwoDimensionalDiagram, [
      {
        source: { kind: 'pointStratum', stratumId: 'deleted-point' },
        label: 'selected',
      },
      {
        source: {
          kind: 'polylineVertex',
          curveId: 'deleted-curve',
          vertexIndex: 0,
        },
        label: 'row 1',
      },
    ]),
    [],
  )
  assert.deepEqual(
    createWorkPlanePointPickingHighlights(emptyThreeDimensionalDiagram, {
      active: true,
      pickedPointIds: ['deleted-point'],
    }),
    [],
  )
})

test('coordinate source highlights are not included in TikZ or saved JSON', () => {
  const pointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 2, y: 3, z: 0 },
    { id: 'source-point' },
  )
  const highlights = createDirectCoordinateSourceHighlights(pointResult.diagram, [
    {
      source: { kind: 'pointStratum', stratumId: 'source-point' },
      label: 'selected-source-highlight-sentinel',
    },
  ])
  const highlightedDiagram: Diagram & {
    coordinateSourceHighlights: CoordinateSourceHighlight[]
  } = {
    ...pointResult.diagram,
    coordinateSourceHighlights: highlights,
  }
  const tikz = generateTikz(highlightedDiagram)
  const serialized = serializeDiagram(highlightedDiagram)

  assert.doesNotMatch(tikz, /coordinateSourceHighlights/)
  assert.doesNotMatch(tikz, /selected-source-highlight-sentinel/)
  assert.doesNotMatch(serialized, /coordinateSourceHighlights/)
  assert.doesNotMatch(serialized, /selected-source-highlight-sentinel/)
})

function createPointPickingDiagram(): Diagram {
  const p0 = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { id: 'p0' },
  )
  const p1 = addPointStratumWithResult(
    p0.diagram,
    { x: 1, y: 0, z: 0 },
    { id: 'p1' },
  )
  const p2 = addPointStratumWithResult(
    p1.diagram,
    { x: 0, y: 1, z: 0 },
    { id: 'p2' },
  )

  return p2.diagram
}

function coordinateAnchor(
  id: string,
  name: string,
  x: number,
  y: number,
  z: number,
): CoordinateAnchor {
  return {
    id,
    name,
    tikzName: name,
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: x },
        y: { kind: 'numeric', value: y },
        z: { kind: 'numeric', value: z },
      },
    },
  }
}
