import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
  findCoordinateAnchorReferences,
} from '../../src/model/coordinateReferences.ts'
import { defaultCurveStyle, defaultPointStyle } from '../../src/model/styles.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../src/model/translation.ts'
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
  applyCoordinateAnchorTranslateToEditorState,
  translateSelectedCoordinateAnchors,
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
  layerOperationStatus: string
}

const editableInspectorSource = readFileSync(
  new URL('../../src/ui/inspector/EditableInspector.tsx', import.meta.url),
  'utf8',
)

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
    'Usage',
    'Delete coordinate',
  ])
  assert.equal(model.sourceLabel, 'Global xyz')
  assert.equal(model.referenceCount, 0)
  assert.equal(model.usageCount, 0)
  assert.equal(model.usageMessage, 'Used by 0 objects')
  assert.equal(labels.includes('Layer'), false)
  assert.equal(labels.includes('Codimension'), false)
  assert.equal(labels.some((label) => label.toLowerCase().includes('style')), false)
  assert.equal(sectionLabels.includes('Layer'), false)
})

test('coordinate multi-selection inspector exposes direct translation controls', () => {
  const inspectorStart = editableInspectorSource.indexOf(
    'function CoordinateAnchorMultiSelectionInspector',
  )
  const inputStart = editableInspectorSource.indexOf(
    'function CoordinateTranslationInput',
    inspectorStart,
  )
  const inspectorSource = editableInspectorSource.slice(inspectorStart, inputStart)

  assert.ok(inspectorStart >= 0)
  assert.ok(inputStart > inspectorStart)
  assert.match(inspectorSource, /Translate selected coordinates/)
  assert.match(inspectorSource, /label="dx"/)
  assert.match(inspectorSource, /label="dy"/)
  assert.match(inspectorSource, /label="dz"/)
  assert.match(inspectorSource, /2D coordinates keep z = 0\./)
  assert.match(inspectorSource, /Apply/)
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

test('coordinate inspector usage count counts distinct referencing objects', () => {
  const diagram = createReferencedPathDiagram()
  const curve = findCurve(diagram, 'ref-path')

  if (curve.kind !== 'polyline') {
    throw new Error('Expected a polyline path.')
  }

  curve.points = [
    requiredCoordinateReference(diagram, 'coord-a'),
    requiredCoordinateReference(diagram, 'coord-a'),
  ]
  diagram.strata.push({
    codim: 2,
    geometricKind: 'point',
    id: 'ref-point',
    name: 'Reference point',
    style: { ...defaultPointStyle },
    position: requiredCoordinateReference(diagram, 'coord-a'),
    layer: 0,
  })

  const model = createCoordinateAnchorInspectorModel(
    diagram,
    findAnchor(diagram, 'coord-a'),
  )

  assert.equal(model.referenceCount, 3)
  assert.equal(model.usageCount, 2)
  assert.equal(model.usageMessage, 'Used by 2 objects')
  assert.equal(model.deleteMessage, 'Deleting will detach 3 coordinate references.')
})

test('coordinate inspector model allows referenced coordinate deletion', () => {
  const diagram = createReferencedPathDiagram()
  const model = createCoordinateAnchorInspectorModel(
    diagram,
    findAnchor(diagram, 'coord-a'),
  )

  assert.equal(model.referenceCount, 1)
  assert.equal(model.usageCount, 1)
  assert.equal(model.usageMessage, 'Used by 1 object')
  assert.equal(model.deleteDisabled, false)
  assert.equal(
    model.deleteMessage,
    'Deleting will detach 1 coordinate reference.',
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

test('inline TikZ after referenced coordinate delete has no blank lines', () => {
  const diagram = createReferencedPathDiagram()
  const result = deleteCoordinateAnchorWithDetach(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const inlineTikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })

  assert.doesNotMatch(inlineTikz, /\\coordinate \(A\)/)
  assert.match(inlineTikz, /\\coordinate \(curvePolyReferencePath0p0\) at \(0,0\);/)
  assert.doesNotMatch(inlineTikz, /\n[ \t]*\n/)
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
  assert.deepEqual(pointPreview(point.position), { x: 7, y: 8, z: 0 })
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

test('delete coordinate sanitizes self-referential replacement source frame refs', () => {
  const diagram = createCoordinateDiagram(3)

  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(10, 20, 30),
  })
  const selfOrigin = coordinateReferenceVec3ForAnchorId(diagram, 'coord-a')

  if (selfOrigin === null) {
    throw new Error('Expected coordinate reference point.')
  }

  const sourceFrame = {
    origin: selfOrigin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }

  diagram.coordinateAnchors = (diagram.coordinateAnchors ?? []).map((anchor) =>
    anchor.id === 'coord-a'
      ? {
          ...anchor,
          position: localAnchorPositionWithFrame(sourceFrame, 2, 3),
        }
      : anchor,
  )
  diagram.strata.push({
    codim: 3,
    geometricKind: 'point',
    id: 'self-ref-point',
    name: 'Self reference point',
    style: { ...defaultPointStyle },
    position: requiredCoordinateReference(diagram, 'coord-a'),
    layer: 0,
  })
  const originalJson = JSON.stringify(diagram)
  const result = deleteCoordinateAnchorWithDetach(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const point = result.diagram.strata[0]

  assert.equal(result.detachedCount, 3)
  assert.equal(hasAnchor(result.diagram, 'coord-a'), false)
  assert.equal(point?.geometricKind, 'point')
  if (point?.geometricKind !== 'point') {
    throw new Error('Expected a point stratum.')
  }
  assert.equal(point.position.symbolic, undefined)
  assert.deepEqual(pointPreview(point.position), { x: 12, y: 23, z: 30 })
  assert.equal(findCoordinateAnchorReferences(result.diagram, 'coord-a').length, 0)
  assert.equal(JSON.stringify(result.diagram).includes('"coordinateId":"coord-a"'), false)
  assert.equal(validateDiagram(result.diagram).valid, true)
  assert.equal(JSON.stringify(diagram), originalJson)
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

test('coordinate multi-translation applies dx and dy to all selected coordinates', () => {
  const diagram = createTwoCoordinateDiagram(2)
  const result = translateSelectedCoordinateAnchors(
    diagram,
    coordinateMultiSelection(),
    parseTranslation(diagram, '1', '-2', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.message, 'Translated 2 coordinates.')
  assert.deepEqual(anchorPreview(findAnchor(result.diagram, 'coord-a')), {
    x: 1,
    y: -2,
    z: 0,
  })
  assert.deepEqual(anchorPreview(findAnchor(result.diagram, 'coord-b')), {
    x: 3,
    y: -1,
    z: 0,
  })
})

test('coordinate multi-translation in 2D keeps z locked to zero', () => {
  const diagram = createTwoCoordinateDiagram(2)
  const result = translateSelectedCoordinateAnchors(
    diagram,
    coordinateMultiSelection(),
    parseTranslation(diagram, '1', '1', 'Len'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(anchorPreview(findAnchor(result.diagram, 'coord-a')).z, 0)
  assert.equal(anchorPreview(findAnchor(result.diagram, 'coord-b')).z, 0)
})

test('coordinate multi-translation moves work-plane-local anchors by frame origin', () => {
  const diagram = createCoordinateDiagram(3)

  addAnchor(diagram, {
    id: 'coord-local-a',
    name: 'Local A',
    tikzName: 'A',
    position: localAnchorPosition(2, 3),
  })
  addAnchor(diagram, {
    id: 'coord-local-b',
    name: 'Local B',
    tikzName: 'B',
    position: localAnchorPosition(4, 5),
  })

  const result = translateSelectedCoordinateAnchors(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'coordinate', id: 'coord-local-a' },
        { kind: 'coordinate', id: 'coord-local-b' },
      ],
    },
    parseTranslation(diagram, '1', '-2', '3'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const position = findAnchor(result.diagram, 'coord-local-a').position

  assert.equal(position.kind, 'workPlaneLocal')
  if (position.kind !== 'workPlaneLocal') {
    throw new Error('Expected work-plane-local coordinate.')
  }
  assert.deepEqual(position.frame.origin, { x: 11, y: 18, z: 33 })
  assert.deepEqual(position.local, localAnchorPosition(2, 3).local)
  assert.deepEqual(position.preview, { x: 13, y: 18, z: 36 })
})

test('coordinate multi-translation preserves symbolic coordinate expressions', () => {
  const diagram = createTwoCoordinateDiagram(3)

  diagram.variables = [
    {
      id: 'var-Len',
      name: 'Len',
      macroName: 'Len',
      expression: '4',
      previewValue: 4,
    },
  ]
  findAnchor(diagram, 'coord-a').position = {
    kind: 'global',
    value: {
      x: { kind: 'symbolic', expression: 'Len', previewValue: 4 },
      y: { kind: 'numeric', value: 0 },
      z: { kind: 'numeric', value: 0 },
    },
  }

  const result = translateSelectedCoordinateAnchors(
    diagram,
    { kind: 'coordinate', id: 'coord-a' },
    parseTranslation(diagram, 'Len/2', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const position = findAnchor(result.diagram, 'coord-a').position

  assert.equal(position.kind, 'global')
  if (position.kind !== 'global') {
    throw new Error('Expected global coordinate.')
  }
  assert.equal(position.value.x.kind, 'symbolic')
  assert.equal(
    position.value.x.kind === 'symbolic' ? position.value.x.expression : '',
    '(Len) + (Len/2)',
  )
  assert.equal(anchorPreview(findAnchor(result.diagram, 'coord-a')).x, 6)
})

test('coordinate multi-translation keeps layer-bound path refs live and updates preview', () => {
  const diagram = createReferencedPathDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    coordinateMultiSelection(),
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, 'ref-path')

  assert.equal(coordinateReferenceSourceForPoint(curve.points[0])?.coordinateId, 'coord-a')
  assert.equal(coordinateReferenceSourceForPoint(curve.points[1])?.coordinateId, 'coord-b')
  assert.deepEqual(pointPreview(curve.points[0]), { x: 1, y: 0, z: 0 })
  assert.deepEqual(pointPreview(curve.points[1]), { x: 2, y: 0, z: 0 })
})

test('coordinate multi-translation updates TikZ coordinate definitions but not draw refs', () => {
  const diagram = createReferencedPathDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    coordinateMultiSelection(),
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const tikz = generateTikz(result.diagram)

  assert.match(tikz, /\\coordinate \(A\) at \(1,0\);/)
  assert.match(tikz, /\\coordinate \(B\) at \(2,0\);/)
  assert.match(tikz, /\(A\) -- \(B\);/)
  assert.doesNotMatch(tikz, /\(1,0\) -- \(2,0\);/)
})

test('coordinate multi-translation is undoable and redoable', () => {
  const diagram = createTwoCoordinateDiagram(2)
  const initial = createState(diagram, coordinateMultiSelection())
  const translated = applyCoordinateAnchorTranslateToEditorState(
    initial,
    parseTranslation(diagram, '1', '0', '0'),
  )
  const undone = undoLastDiagramChange(translated)
  const redone = redoLastDiagramChange(undone)

  assert.equal(translated.layerOperationStatus, 'Translated 2 coordinates.')
  assert.deepEqual(anchorPreview(findAnchor(translated.editableDiagram, 'coord-a')), {
    x: 1,
    y: 0,
    z: 0,
  })
  assert.deepEqual(anchorPreview(findAnchor(undone.editableDiagram, 'coord-a')), {
    x: 0,
    y: 0,
    z: 0,
  })
  assert.deepEqual(anchorPreview(findAnchor(redone.editableDiagram, 'coord-a')), {
    x: 1,
    y: 0,
    z: 0,
  })
  assert.equal(translated.history.past.length, 1)
})

test('failed coordinate multi-translation reports error without mutation', () => {
  const diagram = createTwoCoordinateDiagram(2)
  const initial = createState(diagram, {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coord-a' },
      { kind: 'coordinate', id: 'missing-coordinate' },
    ],
  })
  const originalJson = JSON.stringify(diagram)
  const translated = applyCoordinateAnchorTranslateToEditorState(
    initial,
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.match(translated.layerOperationStatus, /does not exist/)
  assert.equal(translated.editableDiagram, initial.editableDiagram)
  assert.equal(JSON.stringify(diagram), originalJson)
  assert.deepEqual(translated.selectedElement, initial.selectedElement)
  assert.equal(translated.history.past.length, 0)
})

test('coordinate multi-translation preserves coordinate multi-selection after success', () => {
  const diagram = createTwoCoordinateDiagram(2)
  const initial = createState(diagram, coordinateMultiSelection())
  const translated = applyCoordinateAnchorTranslateToEditorState(
    initial,
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.deepEqual(translated.selectedElement, coordinateMultiSelection())
})

function createCoordinateDiagram(ambientDimension: 2 | 3): Diagram {
  return createEmptyDiagram({ ambientDimension })
}

function createTwoCoordinateDiagram(ambientDimension: 2 | 3): Diagram {
  const diagram = createCoordinateDiagram(ambientDimension)

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
    position: globalAnchorPosition(2, 1, ambientDimension === 2 ? 0 : 3),
  })

  return diagram
}

function coordinateMultiSelection(): SelectedElement {
  return {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coord-a' },
      { kind: 'coordinate', id: 'coord-b' },
    ],
  }
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

function requiredCoordinateReference(
  diagram: Diagram,
  coordinateId: string,
): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate reference ${coordinateId}.`)
  }

  return point
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
    position: globalAnchorPosition(1, 1, 0),
  })
  const origin = coordinateReferenceVec3ForAnchorId(diagram, 'coord-a')

  if (origin === null) {
    throw new Error('Expected coordinate reference point.')
  }

  diagram.coordinateAnchors = (diagram.coordinateAnchors ?? []).map((anchor) =>
    anchor.id === 'coord-a'
      ? {
          ...anchor,
          position: globalAnchorPosition(5, 5, 0),
        }
      : anchor,
  )
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
    layerOperationStatus: '',
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

function localAnchorPositionWithFrame(
  frame: WorkPlaneFrameSnapshot,
  a: number,
  b: number,
): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame,
    local: {
      a: { kind: 'numeric', value: a },
      b: { kind: 'numeric', value: b },
    },
    preview: {
      x: frame.origin.x + a * frame.u.x + b * frame.v.x,
      y: frame.origin.y + a * frame.u.y + b * frame.v.y,
      z: frame.origin.z + a * frame.u.z + b * frame.v.z,
    },
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

function parseTranslation(
  diagram: Diagram,
  dx: string,
  dy: string,
  dz: string,
): TranslationVector {
  const parsed = parseTranslationVectorFromInputs(diagram, { dx, dy, dz })

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.translation
}
