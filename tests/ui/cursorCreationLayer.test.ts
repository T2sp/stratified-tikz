import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import {
  projectVec3,
  screenToModelOnWorkPlane,
} from '../../src/geometry/projection.ts'
import {
  constructWorkPlaneFromThreePoints,
  pointOnWorkPlane,
} from '../../src/geometry/workPlane.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import type {
  Camera3D,
  CurveStratum,
  Diagram,
  PolygonSheetStratum,
  Vec3,
  WorkPlane,
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
import { isPointOnWorkPlane } from '../../src/ui/sheetDraft.ts'

type TestEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
}

const cursorTestCamera: Camera3D = {
  mode: '3d',
  projection: 'orthographic',
  xVector: [1, 0],
  yVector: [0.5, 0.25],
  zVector: [0, 1],
  scale: 10,
  origin: { x: 100, y: 50 },
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

test('cursor point creation projects clicks to an active custom work plane', () => {
  const state = createState(createEmptyDiagram({ ambientDimension: 3 }))
  const workPlane = createCustomPlaneForCursorTests()
  const position = cursorPointFromModelPoint(
    pointOnWorkPlane(workPlane, 1.5, -0.5),
    workPlane,
  )
  const result = addPointStratumWithResult(state.editableDiagram, position, {
    layer: 2,
  })
  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'stratum',
    id: result.id,
  }, 2)
  const point = committed.editableDiagram.strata.find(
    (candidate) => candidate.id === result.id,
  )

  assert.equal(point?.geometricKind, 'point')
  assert.equal(point?.layer, 2)
  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.equal(
    point?.geometricKind === 'point' &&
      isPointOnWorkPlane(point.position, workPlane),
    true,
  )
  assert.match(generateTikz(committed.editableDiagram), /\\coordinate/)
})

test('cursor label creation projects clicks to an active custom work plane', () => {
  const state = createState(createEmptyDiagram({ ambientDimension: 3 }))
  const workPlane = createCustomPlaneForCursorTests()
  const position = cursorPointFromModelPoint(
    pointOnWorkPlane(workPlane, -0.25, 1.25),
    workPlane,
  )
  const result = addTextLabelWithResult(state.editableDiagram, position, {
    layer: 1,
  })
  const committed = commitCursorCreation(state, result.diagram, {
    kind: 'label',
    id: result.id,
  }, 1)
  const label = committed.editableDiagram.labels.find(
    (candidate) => candidate.id === result.id,
  )

  assert.equal(label?.layer, 1)
  assert.deepEqual(committed.selectedElement, { kind: 'label', id: result.id })
  assert.equal(
    label !== undefined && isPointOnWorkPlane(label.position, workPlane),
    true,
  )
  assert.match(generateTikz(committed.editableDiagram), /\\node at/)
})

test('cursor polyline creation commits vertices on an active custom work plane', () => {
  const state = createState(createEmptyDiagram({ ambientDimension: 3 }))
  const workPlane = createCustomPlaneForCursorTests()
  const points = [
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 0, 0), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 1, 0.75), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 2, -0.25), workPlane),
  ]
  const result = addPolylineCurveStratumWithResult(state.editableDiagram, points, {
    layer: 3,
  })

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
  assert.equal(
    curve.points.every((point) => isPointOnWorkPlane(point, workPlane)),
    true,
  )
  assert.match(generateTikz(committed.editableDiagram), /--/)
})

test('cursor cubic Bezier creation commits controls on an active custom work plane', () => {
  const state = createState(createEmptyDiagram({ ambientDimension: 3 }))
  const workPlane = createCustomPlaneForCursorTests()
  const points = [
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 0, 0), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 0.5, 1), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 1.5, 1), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 2, 0), workPlane),
  ]
  const result = addCubicBezierCurveStratumWithResult(
    state.editableDiagram,
    points,
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
  assert.equal(
    curve.points.every((point) => isPointOnWorkPlane(point, workPlane)),
    true,
  )
  assert.match(generateTikz(committed.editableDiagram), /\.\. controls/)
})

test('cursor polygon sheet creation commits vertices on an active custom work plane', () => {
  const state = createState(createEmptyDiagram({ ambientDimension: 3 }))
  const workPlane = createCustomPlaneForCursorTests()
  const vertices = [
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 0, 0), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 1.5, 0), workPlane),
    cursorPointFromModelPoint(pointOnWorkPlane(workPlane, 0.75, 1), workPlane),
  ]
  const result = addPolygonSheetStratumWithResult(
    state.editableDiagram,
    vertices,
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

  assert.equal(
    sheet.vertices.every((vertex) => isPointOnWorkPlane(vertex, workPlane)),
    true,
  )
  assert.match(generateTikz(committed.editableDiagram), /-- cycle;/)
})

test('cursor point creation still works on an axis-aligned work plane', () => {
  const state = createState(createEmptyDiagram({ ambientDimension: 3 }))
  const workPlane: WorkPlane = { kind: 'xz', y: 4 }
  const position = cursorPointFromModelPoint({ x: 2, y: 4, z: -1 }, workPlane)
  const result = addPointStratumWithResult(state.editableDiagram, position, {
    layer: 6,
  })
  const point = result.diagram.strata.find((candidate) => candidate.id === result.id)

  assert.equal(point?.geometricKind, 'point')
  assert.equal(point?.geometricKind === 'point' && point.position.y, 4)
  assert.equal(
    point?.geometricKind === 'point' &&
      isPointOnWorkPlane(point.position, workPlane),
    true,
  )
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

function createCustomPlaneForCursorTests(): WorkPlane {
  return constructWorkPlaneFromThreePoints(
    { x: 1, y: 0, z: 1 },
    { x: 3, y: 0, z: 1 },
    { x: 1, y: 2, z: 3 },
  )
}

function cursorPointFromModelPoint(
  modelPoint: Vec3,
  workPlane: WorkPlane,
): Vec3 {
  const screenPoint = projectVec3(cursorTestCamera, modelPoint)

  return screenToModelOnWorkPlane(cursorTestCamera, screenPoint, workPlane)
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
