import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
} from '../../src/model/coordinateReferences.ts'
import { defaultCurveStyle, defaultPointStyle } from '../../src/model/styles.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  CurveStratum,
  Diagram,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  createCoordinateAnchorInspectorModel,
  deleteCoordinateAnchorWithDetach,
  deleteUnusedCoordinateAnchor,
  updateCoordinateAnchorGlobalCoordinate,
  updateCoordinateAnchorName,
  updateCoordinateAnchorTikzName,
  updateCoordinateAnchorWorkPlaneLocalCoordinate,
} from '../../src/ui/coordinateAnchorEditing.ts'
import { updateDiagramGeometryHandle } from '../../src/ui/geometryHandles.ts'
import { createInspectorSections } from '../../src/ui/inspectorSummary.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  clearSelectionIfMissing,
  type SelectedElement,
} from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

type TestEditorState = UndoableEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
}

test('coordinate inspector model shows coordinate fields without layer or style fields', () => {
  const diagram = createCoordinateDiagram(3)
  const anchor = addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(1, 2, 3),
  })
  const model = createCoordinateAnchorInspectorModel(diagram, anchor)
  const labels = model.fields.map((field) => field.label)
  const sectionLabels = createInspectorSections(diagram, {
    kind: 'coordinate',
    id: anchor.id,
  }).flatMap((section) => section.fields.map((field) => field.label))

  assert.deepEqual(labels, [
    'Name',
    'TikZ name',
    'Source',
    'x',
    'y',
    'z',
    'Preview',
    'Delete coordinate',
  ])
  assert.equal(model.sourceLabel, 'Global xyz')
  assert.equal(labels.includes('Layer'), false)
  assert.equal(labels.includes('Codimension'), false)
  assert.equal(labels.some((label) => label.toLowerCase().includes('style')), false)
  assert.equal(sectionLabels.includes('Layer'), false)
})

test('coordinate rename updates the anchor name', () => {
  const diagram = createCoordinateDiagram(2)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })

  const renamed = updateCoordinateAnchorName(diagram, 'coord-a', '  Renamed  ')

  assert.equal(findAnchor(renamed, 'coord-a').name, 'Renamed')
  assert.equal(findAnchor(diagram, 'coord-a').name, 'A')
})

test('coordinate TikZ name update changes export while references keep using ids', () => {
  const diagram = createReferencedPathDiagram()
  const result = updateCoordinateAnchorTikzName(diagram, 'coord-a', 'RenamedA')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const tikz = generateTikz(result.diagram)

  assert.match(tikz, /\\coordinate \(RenamedA\) at \(0,0\);/)
  assert.match(tikz, /\(RenamedA\) -- \(B\);/)
  assert.doesNotMatch(tikz, /\\coordinate \(A\) at \(0,0\);/)
})

test('duplicate coordinate TikZ name is rejected', () => {
  const diagram = createReferencedPathDiagram()
  const before = JSON.stringify(diagram)
  const result = updateCoordinateAnchorTikzName(diagram, 'coord-b', 'A')

  assert.equal(result.ok, false)
  assert.equal(result.diagram, diagram)
  assert.equal(JSON.stringify(diagram), before)
  assert.equal(findAnchor(diagram, 'coord-b').tikzName, 'B')
})

test('global coordinate position edit updates preview and supports symbolic components', () => {
  const diagram = createCoordinateDiagram(3)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(0, 1, 2),
  })
  const component: CoordinateComponent = {
    kind: 'symbolic',
    expression: 'R',
    previewValue: 5,
  }

  const updated = updateCoordinateAnchorGlobalCoordinate(
    diagram,
    'coord-a',
    'x',
    component,
  )
  const anchor = findAnchor(updated, 'coord-a')

  assert.deepEqual(anchor.position.kind, 'global')
  if (anchor.position.kind !== 'global') {
    throw new Error('Expected a global coordinate anchor.')
  }
  assert.deepEqual(anchor.position.value.x, component)
  assert.deepEqual(anchorPreview(anchor), { x: 5, y: 1, z: 2 })
})

test('work-plane-local coordinate position edit updates global preview', () => {
  const diagram = createCoordinateDiagram(3)
  diagram.variables = [
    {
      id: 'var-r',
      name: 'R',
      macroName: 'R',
      expression: '4',
      previewValue: 4,
    },
  ]
  addAnchor(diagram, {
    id: 'coord-local',
    name: 'Local',
    tikzName: 'Local',
    position: localAnchorPosition(2, 3),
  })

  const updated = updateCoordinateAnchorWorkPlaneLocalCoordinate(
    diagram,
    'coord-local',
    'a',
    { kind: 'symbolic', expression: 'R', previewValue: 4 },
  )
  const anchor = findAnchor(updated, 'coord-local')

  assert.equal(anchor.position.kind, 'workPlaneLocal')
  if (anchor.position.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local coordinate anchor.')
  }
  assert.deepEqual(anchor.position.local.a, {
    kind: 'symbolic',
    expression: 'R',
    previewValue: 4,
  })
  assert.deepEqual(anchor.position.preview, { x: 14, y: 20, z: 33 })
})

test('moving a coordinate anchor updates referenced path preview', () => {
  const diagram = createReferencedPathDiagram()

  const moved = updateDiagramGeometryHandle(
    diagram,
    { kind: 'coordinateAnchor', coordinateId: 'coord-a' },
    { x: 3, y: 4, z: 99 },
  )
  const curve = findCurve(moved, 'ref-path')
  const source = coordinateReferenceSourceForPoint(curve.points[0])

  assert.deepEqual(pointPreview(curve.points[0]), { x: 3, y: 4, z: 0 })
  assert.equal(source?.coordinateId, 'coord-a')
  assert.deepEqual(source?.preview, { x: 3, y: 4, z: 0 })
  assert.match(generateTikz(moved), /\\coordinate \(A\) at \(3,4\);/)
})

test('coordinate inspector model allows referenced coordinate deletion', () => {
  const diagram = createReferencedPathDiagram()
  const model = createCoordinateAnchorInspectorModel(
    diagram,
    findAnchor(diagram, 'coord-a'),
  )

  assert.equal(model.referenceCount, 1)
  assert.equal(model.deleteDisabled, false)
  assert.equal(
    model.deleteMessage,
    'Used by 1 coordinate reference. Deleting will detach it.',
  )
})

test('delete unused coordinate removes it', () => {
  const diagram = createCoordinateDiagram(2)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })

  const result = deleteCoordinateAnchorWithDetach(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }
  assert.equal(result.detachedCount, 0)
  assert.equal(result.message, 'Deleted coordinate "A".')
  assert.equal(result.diagram.coordinateAnchors?.length, 0)
})

test('delete referenced coordinate detaches references and removes it', () => {
  const diagram = createReferencedPathDiagram()
  const result = deleteCoordinateAnchorWithDetach(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const curve = findCurve(result.diagram, 'ref-path')
  const tikz = generateTikz(result.diagram)

  assert.equal(result.detachedCount, 1)
  assert.equal(result.deletedCoordinateName, 'A')
  assert.equal(
    result.message,
    'Deleted coordinate "A" and detached 1 coordinate reference.',
  )
  assert.equal(hasAnchor(result.diagram, 'coord-a'), false)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[0]), null)
  assert.deepEqual(pointPreview(curve.points[0]), { x: 0, y: 0, z: 0 })
  assert.equal(
    coordinateReferenceSourceForPoint(curve.points[1])?.coordinateId,
    'coord-b',
  )
  assert.equal(JSON.stringify(result.diagram).includes('"coordinateId":"coord-a"'), false)
  assert.equal(validateDiagram(result.diagram).valid, true)
  assert.doesNotMatch(tikz, /\\coordinate \(A\)/)
  assert.doesNotMatch(tikz, /\(A\)/)
  assert.match(tikz, /\\coordinate \(curvePolyReferencePath0p0\) at \(0,0\);/)
  assert.match(tikz, /\(curvePolyReferencePath0p0\) -- \(B\);/)
})

test('delete coordinate detaches nested work-plane-local source frame references', () => {
  const initial = createState(createNestedWorkPlaneLocalReferenceDiagram(), {
    kind: 'coordinate',
    id: 'coord-a',
  })
  const result = deleteCoordinateAnchorWithDetach(
    initial.editableDiagram,
    'coord-a',
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const point = result.diagram.strata[0]
  const tikz = generateTikz(result.diagram)

  assert.equal(result.detachedCount, 1)
  assert.equal(hasAnchor(result.diagram, 'coord-a'), false)
  assert.equal(point?.geometricKind, 'point')
  if (point?.geometricKind !== 'point') {
    throw new Error('Expected a point stratum.')
  }
  assert.equal(point.position.symbolic?.source?.kind, 'workPlaneLocal')
  if (point.position.symbolic?.source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local source.')
  }
  assert.deepEqual(point.position.symbolic.source.frame.origin, {
    x: 5,
    y: 5,
    z: 0,
  })
  assert.equal(
    coordinateReferenceSourceForPoint(point.position.symbolic.source.frame.origin),
    null,
  )
  assert.equal(JSON.stringify(result.diagram).includes('"coordinateId":"coord-a"'), false)
  assert.equal(validateDiagram(result.diagram).valid, true)
  assert.doesNotMatch(tikz, /\\coordinate \(A\)/)
  assert.doesNotMatch(tikz, /\(A\)/)

  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: null,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasAnchor(undone.editableDiagram, 'coord-a'), true)
  assert.equal(hasAnchor(redone.editableDiagram, 'coord-a'), false)
  assert.equal(
    JSON.stringify(redone.editableDiagram).includes('"coordinateId":"coord-a"'),
    false,
  )
})

test('undo and redo restore coordinate rename, move, and delete', () => {
  const renameInitial = createStateWithCoordinate()
  const renamed = commitCoordinateChange(
    renameInitial,
    updateCoordinateAnchorName(
      renameInitial.editableDiagram,
      'coord-a',
      'Renamed',
    ),
  )
  const renameUndone = undoLastDiagramChange(renamed)
  const renameRedone = redoLastDiagramChange(renameUndone)

  assert.equal(findAnchor(renamed.editableDiagram, 'coord-a').name, 'Renamed')
  assert.equal(findAnchor(renameUndone.editableDiagram, 'coord-a').name, 'A')
  assert.equal(findAnchor(renameRedone.editableDiagram, 'coord-a').name, 'Renamed')

  const moveInitial = createStateWithCoordinate()
  const moved = commitCoordinateChange(
    moveInitial,
    updateCoordinateAnchorGlobalCoordinate(
      moveInitial.editableDiagram,
      'coord-a',
      'x',
      { kind: 'numeric', value: 9 },
    ),
  )
  const moveUndone = undoLastDiagramChange(moved)
  const moveRedone = redoLastDiagramChange(moveUndone)

  assert.equal(anchorPreview(findAnchor(moved.editableDiagram, 'coord-a')).x, 9)
  assert.equal(anchorPreview(findAnchor(moveUndone.editableDiagram, 'coord-a')).x, 0)
  assert.equal(anchorPreview(findAnchor(moveRedone.editableDiagram, 'coord-a')).x, 9)

  const deleteInitial = createStateWithCoordinate()
  const deleted = deleteCoordinateAnchorWithDetach(
    deleteInitial.editableDiagram,
    'coord-a',
  )

  assert.equal(deleted.ok, true)
  if (!deleted.ok) {
    throw new Error(deleted.message)
  }

  const deleteCommitted = commitDiagramChange(deleteInitial, {
    ...deleteInitial,
    editableDiagram: deleted.diagram,
    selectedElement: null,
  })
  const deleteUndone = undoLastDiagramChange(deleteCommitted)
  const deleteRedone = redoLastDiagramChange(deleteUndone)

  assert.equal(hasAnchor(deleteCommitted.editableDiagram, 'coord-a'), false)
  assert.equal(hasAnchor(deleteUndone.editableDiagram, 'coord-a'), true)
  assert.equal(hasAnchor(deleteRedone.editableDiagram, 'coord-a'), false)
})

test('undo and redo restore coordinate refs around inspector coordinate delete', () => {
  const initial = createState(createReferencedPathDiagram(), {
    kind: 'coordinate',
    id: 'coord-a',
  })
  const deleted = deleteCoordinateAnchorWithDetach(
    initial.editableDiagram,
    'coord-a',
  )

  assert.equal(deleted.ok, true)
  if (!deleted.ok) {
    throw new Error(deleted.message)
  }

  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: deleted.diagram,
    selectedElement: null,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasAnchor(committed.editableDiagram, 'coord-a'), false)
  assert.equal(
    coordinateReferenceSourceForPoint(
      findCurve(committed.editableDiagram, 'ref-path').points[0],
    ),
    null,
  )
  assert.equal(hasAnchor(undone.editableDiagram, 'coord-a'), true)
  assert.equal(
    coordinateReferenceSourceForPoint(
      findCurve(undone.editableDiagram, 'ref-path').points[0],
    )?.coordinateId,
    'coord-a',
  )
  assert.equal(hasAnchor(redone.editableDiagram, 'coord-a'), false)
  assert.equal(
    coordinateReferenceSourceForPoint(
      findCurve(redone.editableDiagram, 'ref-path').points[0],
    ),
    null,
  )
})

test('selection is cleaned after unused coordinate delete', () => {
  const diagram = createCoordinateDiagram(2)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })
  const result = deleteUnusedCoordinateAnchor(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }
  assert.equal(
    clearSelectionIfMissing(result.diagram, {
      kind: 'coordinate',
      id: 'coord-a',
    }),
    null,
  )
})

function createCoordinateDiagram(ambientDimension: 2 | 3): Diagram {
  return createEmptyDiagram({ ambientDimension })
}

function addAnchor(
  diagram: Diagram,
  input: {
    id: string
    name: string
    tikzName: string
    position: CoordinateAnchorPosition
  },
): CoordinateAnchor {
  const anchor = createCoordinateAnchor(diagram, input)
  diagram.coordinateAnchors = [...(diagram.coordinateAnchors ?? []), anchor]

  return anchor
}

function createReferencedPathDiagram(): Diagram {
  const diagram = createCoordinateDiagram(2)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })
  addAnchor(diagram, {
    id: 'coord-b',
    name: 'B',
    tikzName: 'B',
    position: globalAnchorPosition(1, 0, 0),
  })
  const start = coordinateReferenceVec3ForAnchorId(diagram, 'coord-a')
  const end = coordinateReferenceVec3ForAnchorId(diagram, 'coord-b')

  if (start === null || end === null) {
    throw new Error('Expected coordinate reference points.')
  }

  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'ref-path',
    name: 'Reference path',
    style: { ...defaultCurveStyle },
    styleSegments: [],
    points: [start, end],
    layer: 0,
  })

  return diagram
}

function createNestedWorkPlaneLocalReferenceDiagram(): Diagram {
  const diagram = createCoordinateDiagram(3)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(5, 5, 0),
  })
  const origin = coordinateReferenceVec3ForAnchorId(diagram, 'coord-a')

  if (origin === null) {
    throw new Error('Expected coordinate reference point.')
  }

  diagram.strata.push({
    codim: 3,
    geometricKind: 'point',
    id: 'nested-local-point',
    name: 'Nested local point',
    style: { ...defaultPointStyle },
    position: workPlaneLocalPoint({
      origin,
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    }),
    layer: 0,
  })

  return diagram
}

function createStateWithCoordinate(): TestEditorState {
  const diagram = createCoordinateDiagram(2)
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })

  return createState(diagram, { kind: 'coordinate', id: 'coord-a' })
}

function createState(
  diagram: Diagram,
  selectedElement: SelectedElement = null,
): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function commitCoordinateChange(
  state: TestEditorState,
  diagram: Diagram,
): TestEditorState {
  return commitDiagramChange(state, {
    ...state,
    editableDiagram: diagram,
  })
}

function globalAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
    },
  }
}

function localAnchorPosition(a: number, b: number): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: {
      origin: { x: 10, y: 20, z: 30 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: -1, z: 0 },
    },
    local: {
      a: { kind: 'numeric', value: a },
      b: { kind: 'numeric', value: b },
    },
    preview: { x: 10 + a, y: 20, z: 30 + b },
  }
}

function workPlaneLocalPoint(
  frame: WorkPlaneFrameSnapshot,
  a = 2,
  b = 3,
): Vec3 {
  const preview = {
    x: frame.origin.x + a * frame.u.x + b * frame.v.x,
    y: frame.origin.y + a * frame.u.y + b * frame.v.y,
    z: frame.origin.z + a * frame.u.z + b * frame.v.z,
  }

  return {
    ...preview,
    symbolic: {
      x: { kind: 'numeric', value: preview.x },
      y: { kind: 'numeric', value: preview.y },
      z: { kind: 'numeric', value: preview.z },
      source: {
        kind: 'workPlaneLocal',
        frame,
        local: {
          a: { kind: 'numeric', value: a },
          b: { kind: 'numeric', value: b },
        },
      },
    },
  }
}

function findAnchor(diagram: Diagram, id: string): CoordinateAnchor {
  const anchor = (diagram.coordinateAnchors ?? []).find(
    (candidate) => candidate.id === id,
  )

  if (anchor === undefined) {
    throw new Error(`Expected coordinate anchor ${id}.`)
  }

  return anchor
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Expected curve ${id}.`)
  }

  return stratum
}

function hasAnchor(diagram: Diagram, id: string): boolean {
  return (diagram.coordinateAnchors ?? []).some((anchor) => anchor.id === id)
}

function anchorPreview(anchor: CoordinateAnchor): Vec3 {
  switch (anchor.position.kind) {
    case 'global':
      return {
        x: previewValue(anchor.position.value.x),
        y: previewValue(anchor.position.value.y),
        z: previewValue(anchor.position.value.z),
      }
    case 'workPlaneLocal':
      return anchor.position.preview
  }
}

function pointPreview(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function previewValue(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}
