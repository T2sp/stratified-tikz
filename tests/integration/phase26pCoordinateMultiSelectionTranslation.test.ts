import assert from 'node:assert/strict'
import test from 'node:test'
import { snapCursorPoint } from '../../src/geometry/cursorSnap.ts'
import {
  coordinateAnchorPositionPreview,
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
  createCoordinateAnchor,
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  parseSavedDiagramJson,
  parseTranslationVectorFromInputs,
  serializeDiagram,
  translateLayerWithResult,
  validateDiagram,
} from '../../src/model/index.ts'
import type {
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  Diagram,
  SymbolicVariable,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import type { ScalarInputValue } from '../../src/model/scalarExpressions.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyCoordinateAnchorDragToEditorState,
  applyCoordinateAnchorTranslateToEditorState,
  startCoordinateAnchorDragSession,
  translateSelectedCoordinateAnchors,
  type CoordinateAnchorDragSession,
} from '../../src/ui/coordinateAnchorEditing.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
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

test('Inspector coordinate multi-translation survives save/load and exports TikZ refs', () => {
  const diagram = createReferencedPathDiagram()
  const translated = applyCoordinateAnchorTranslateToEditorState(
    createState(diagram, coordinateMultiSelection()),
    parseTranslation(diagram, '1', '-1', '0'),
  )
  const loaded = saveAndLoad(translated.editableDiagram)
  const tikz = generateTikz(loaded)

  assert.equal(translated.layerOperationStatus, 'Translated 2 coordinates.')
  assert.equal(validateDiagram(loaded).valid, true)
  assert.deepEqual(anchorPreview(requiredAnchor(loaded, 'coord-a')), {
    x: 1,
    y: -1,
    z: 0,
  })
  assert.deepEqual(anchorPreview(requiredAnchor(loaded, 'coord-b')), {
    x: 3,
    y: 0,
    z: 0,
  })
  assert.match(tikz, /\\coordinate \(A\) at \(1,-1\);/)
  assert.match(tikz, /\\coordinate \(B\) at \(3,0\);/)
  assert.match(tikz, /\(A\) -- \(B\);/)
  assert.doesNotMatch(tikz, /\(1,-1\) -- \(3,0\);/)
})

test('coordinate drag multi-translation uses snapped target and is undoable', () => {
  const diagram = createReferencedPathDiagram()
  const selection = coordinateMultiSelection()
  const session = startDragSession(diagram, selection, 'coord-a')
  const snappedTarget = snapCursorPoint(
    { x: 1.26, y: 1.74, z: 9 },
    {
      ambientDimension: diagram.ambientDimension,
      snap: { enabled: true, step: 0.5 },
    },
  )

  assert.notEqual(snappedTarget, null)
  if (snappedTarget === null) {
    throw new Error('Expected snapped coordinate drag target.')
  }

  const dragged = applyCoordinateAnchorDragToEditorState(
    createState(diagram, selection),
    session,
    snappedTarget,
  )
  const undone = undoLastDiagramChange(dragged)
  const redone = redoLastDiagramChange(undone)

  assert.equal(dragged.layerOperationStatus, 'Translated 2 coordinates.')
  assert.deepEqual(anchorPreview(requiredAnchor(dragged.editableDiagram, 'coord-a')), {
    x: 1.5,
    y: 1.5,
    z: 0,
  })
  assert.deepEqual(anchorPreview(requiredAnchor(dragged.editableDiagram, 'coord-b')), {
    x: 3.5,
    y: 2.5,
    z: 0,
  })
  assert.deepEqual(anchorPreview(requiredAnchor(undone.editableDiagram, 'coord-a')), {
    x: 0,
    y: 0,
    z: 0,
  })
  assert.deepEqual(anchorPreview(requiredAnchor(redone.editableDiagram, 'coord-a')), {
    x: 1.5,
    y: 1.5,
    z: 0,
  })
  assert.equal(dragged.history.past.length, 1)
})

test('referenced paths remain coordinateRefs and follow moved anchors', () => {
  const diagram = createReferencedPathDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    coordinateMultiSelection(),
    parseTranslation(diagram, '2', '3', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = requiredPolyline(result.diagram, 'referenced-path')

  assert.equal(referenceId(curve.points[0]), 'coord-a')
  assert.equal(referenceId(curve.points[1]), 'coord-b')
  assert.deepEqual(pointPreview(curve.points[0]), { x: 2, y: 3, z: 0 })
  assert.deepEqual(pointPreview(curve.points[1]), { x: 4, y: 4, z: 0 })
})

test('layer translation detaches coordinateRefs instead of moving anchors', () => {
  const diagram = createLayerReferencedPointDiagram()
  const translated = translateLayerWithResult(
    diagram,
    2,
    { x: 3, y: -1, z: 0 },
  )
  const point = requiredPoint(translated.diagram, 'layer-reference-point')
  const tikz = generateTikz(translated.diagram)

  assert.equal(translated.translated, true)
  assert.equal(translated.detachedCoordinateReferenceCount, 1)
  assert.deepEqual(anchorPreview(requiredAnchor(translated.diagram, 'coord-a')), {
    x: 1,
    y: 2,
    z: 0,
  })
  assert.deepEqual(point.position, { x: 4, y: 1, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(point.position), null)
  assert.match(tikz, /\\coordinate \(A\) at \(1,2\);/)
  assert.doesNotMatch(tikz, /\\coordinate \(A\) at \(4,1\);/)
})

test('coordinate translation preserves symbolic global positions', () => {
  const diagram = createSymbolicCoordinateDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    { kind: 'coordinate', id: 'coord-a' },
    parseTranslation(diagram, 'R/2', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const position = requiredGlobalPosition(result.diagram, 'coord-a')

  assert.equal(position.value.x.kind, 'symbolic')
  assert.equal(
    position.value.x.kind === 'symbolic' ? position.value.x.expression : '',
    '(R) + (R/2)',
  )
  assert.deepEqual(anchorPreview(requiredAnchor(result.diagram, 'coord-a')), {
    x: 3,
    y: 0,
    z: 0,
  })
})

test('coordinate translation moves work-plane-local frame origins', () => {
  const diagram = createLocalCoordinateDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    { kind: 'coordinate', id: 'coord-local' },
    parseTranslation(diagram, '1', '-2', '3'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const moved = requiredWorkPlaneLocalPosition(result.diagram, 'coord-local')

  assert.deepEqual(moved.frame.origin, { x: 11, y: 18, z: 33 })
  assert.deepEqual(moved.frame.u, localFrame.u)
  assert.deepEqual(moved.frame.v, localFrame.v)
  assert.deepEqual(moved.frame.normal, localFrame.normal)
  assert.deepEqual(moved.local, {
    a: symbolicScalar('R/2', 1),
    b: numericScalar(3),
  })
  assert.deepEqual(moved.preview, { x: 12, y: 18, z: 36 })
})

test('coordinate translation detaches internal coordinateRefs before moving', () => {
  const diagram = createInternalReferenceCoordinateDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    { kind: 'coordinate', id: 'coord-b' },
    parseTranslation(diagram, '1', '1', '1'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const b = requiredAnchor(result.diagram, 'coord-b')

  assert.deepEqual(anchorPreview(b), { x: 3, y: 4, z: 5 })
  assert.equal(positionContainsCoordinateRef(b.position), false)
  assert.deepEqual(anchorPreview(requiredAnchor(result.diagram, 'coord-a')), {
    x: 2,
    y: 3,
    z: 4,
  })
})

test('mixed coordinate and layer-bound translation rejection remains clear', () => {
  const diagram = createReferencedPathDiagram()
  const result = translateSelectedCoordinateAnchors(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'coordinate', id: 'coord-a' },
        { kind: 'stratum', id: 'referenced-path' },
      ],
    },
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected mixed selection translation to fail.')
  }
  assert.equal(
    result.error,
    'Cannot translate mixed selections. Select only coordinate anchors, or use bulk translation for layer-bound objects.',
  )
  assert.equal(result.diagram, diagram)
})

test('translated inline coordinate output has no blank lines', () => {
  const translated = translateRequired(
    createReferencedPathDiagram(),
    coordinateMultiSelection(),
    '1',
    '0',
    '0',
  )
  const tikz = generateTikz(translated, { exportMode: 'inlineMath' })

  assert.doesNotMatch(tikz, /\n[ \t]*\n/)
  assert.equal(tikz.startsWith('\n'), false)
  assert.equal(tikz.endsWith('\n'), false)
})

test('translated inline coordinate output uses four-space indentation', () => {
  const translated = translateRequired(
    createReferencedPathDiagram(),
    coordinateMultiSelection(),
    '1',
    '0',
    '0',
  )
  const tikz = generateTikz(translated, { exportMode: 'inlineMath' })

  assert.match(tikz, /\n    \\coordinate \(A\) at \(1,0\);/)
  assert.match(tikz, /\n    \\coordinate \(B\) at \(3,1\);/)
  assert.match(tikz, /\n    \\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  assert.doesNotMatch(tikz, /\n  \\(?:coordinate|draw|node|begin\{pgfonlayer\})/)
})

function createReferencedPathDiagram(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram = appendAnchor(
    diagram,
    'coord-a',
    'Anchor A',
    'A',
    globalAnchorPosition(0, 0, 0),
  )
  diagram = appendAnchor(
    diagram,
    'coord-b',
    'Anchor B',
    'B',
    globalAnchorPosition(2, 1, 0),
  )
  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'referenced-path',
      name: 'Referenced path',
      points: [
        requiredCoordinateReference(diagram, 'coord-a'),
        requiredCoordinateReference(diagram, 'coord-b'),
      ],
      layer: 0,
    }),
  )

  return diagram
}

function createLayerReferencedPointDiagram(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram = appendAnchor(
    diagram,
    'coord-a',
    'Anchor A',
    'A',
    globalAnchorPosition(1, 2, 0),
  )
  diagram.strata.push(
    createPointStratum({
      ambientDimension: 2,
      id: 'layer-reference-point',
      name: 'Layer reference point',
      position: requiredCoordinateReference(diagram, 'coord-a'),
      layer: 2,
    }),
  )

  return diagram
}

function createSymbolicCoordinateDiagram(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram = {
    ...diagram,
    variables: [symbolicVariable('var-r', 'R', 2)],
  }
  diagram = appendAnchor(
    diagram,
    'coord-a',
    'Anchor A',
    'A',
    {
      kind: 'global',
      value: {
        x: symbolicComponent('R', 2),
        y: numericComponent(0),
        z: numericComponent(0),
      },
    },
  )

  return diagram
}

const localFrame: WorkPlaneFrameSnapshot = {
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}

function createLocalCoordinateDiagram(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram = {
    ...diagram,
    variables: [symbolicVariable('var-r', 'R', 2)],
  }
  diagram = appendAnchor(
    diagram,
    'coord-local',
    'Local coordinate',
    'Local',
    workPlaneLocalPosition(localFrame, symbolicScalar('R/2', 1), numericScalar(3)),
  )

  return diagram
}

function createInternalReferenceCoordinateDiagram(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram = appendAnchor(
    diagram,
    'coord-a',
    'Anchor A',
    'A',
    globalAnchorPosition(2, 3, 4),
  )
  diagram = appendAnchor(
    diagram,
    'coord-b',
    'Anchor B',
    'B',
    globalPositionReferencing(diagram, 'coord-a'),
  )

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

function appendAnchor(
  diagram: Diagram,
  id: string,
  name: string,
  tikzName: string,
  position: CoordinateAnchorPosition,
): Diagram {
  const anchor = createCoordinateAnchor(diagram, {
    id,
    name,
    tikzName,
    position,
  })

  return {
    ...diagram,
    coordinateAnchors: [...(diagram.coordinateAnchors ?? []), anchor],
  }
}

function globalAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: numericComponent(x),
      y: numericComponent(y),
      z: numericComponent(z),
    },
  }
}

function globalPositionReferencing(
  diagram: Diagram,
  coordinateId: string,
): CoordinateAnchorPosition {
  const reference = requiredCoordinateReference(diagram, coordinateId)

  if (reference.symbolic === undefined) {
    throw new Error(`Expected coordinate reference ${coordinateId}.`)
  }

  return {
    kind: 'global',
    value: reference.symbolic,
  }
}

function workPlaneLocalPosition(
  frame: WorkPlaneFrameSnapshot,
  a: ScalarInputValue,
  b: ScalarInputValue,
): CoordinateAnchorPosition {
  const aPreview = scalarPreview(a)
  const bPreview = scalarPreview(b)

  return {
    kind: 'workPlaneLocal',
    frame,
    local: { a, b },
    preview: {
      x: frame.origin.x + aPreview * frame.u.x + bPreview * frame.v.x,
      y: frame.origin.y + aPreview * frame.u.y + bPreview * frame.v.y,
      z: frame.origin.z + aPreview * frame.u.z + bPreview * frame.v.z,
    },
  }
}

function saveAndLoad(diagram: Diagram): Diagram {
  const parsed = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.diagram
}

function translateRequired(
  diagram: Diagram,
  selection: SelectedElement,
  dx: string,
  dy: string,
  dz: string,
): Diagram {
  const result = translateSelectedCoordinateAnchors(
    diagram,
    selection,
    parseTranslation(diagram, dx, dy, dz),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}

function startDragSession(
  diagram: Diagram,
  selection: SelectedElement,
  coordinateId: string,
): CoordinateAnchorDragSession {
  const result = startCoordinateAnchorDragSession(
    diagram,
    selection,
    coordinateId,
    { showCoordinateAnchors: true },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  return result.session
}

function createState(
  diagram: Diagram,
  selectedElement: SelectedElement,
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

function requiredAnchor(diagram: Diagram, id: string): CoordinateAnchor {
  const anchor = (diagram.coordinateAnchors ?? []).find(
    (candidate) => candidate.id === id,
  )

  if (anchor === undefined) {
    throw new Error(`Expected coordinate anchor ${id}.`)
  }

  return anchor
}

function requiredGlobalPosition(
  diagram: Diagram,
  id: string,
): Extract<CoordinateAnchorPosition, { kind: 'global' }> {
  const position = requiredAnchor(diagram, id).position

  if (position.kind !== 'global') {
    throw new Error(`Expected global coordinate anchor ${id}.`)
  }

  return position
}

function requiredWorkPlaneLocalPosition(
  diagram: Diagram,
  id: string,
): Extract<CoordinateAnchorPosition, { kind: 'workPlaneLocal' }> {
  const position = requiredAnchor(diagram, id).position

  if (position.kind !== 'workPlaneLocal') {
    throw new Error(`Expected work-plane-local coordinate anchor ${id}.`)
  }

  return position
}

function requiredPolyline(diagram: Diagram, id: string) {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
    throw new Error(`Expected polyline ${id}.`)
  }

  return stratum
}

function requiredPoint(diagram: Diagram, id: string) {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Expected point ${id}.`)
  }

  return stratum
}

function anchorPreview(anchor: CoordinateAnchor): Vec3 {
  return coordinateAnchorPositionPreview(anchor.position, 3)
}

function pointPreview(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function referenceId(point: Vec3): string | undefined {
  const source = coordinateReferenceSourceForPoint(point)

  return source?.coordinateId
}

function positionContainsCoordinateRef(position: CoordinateAnchorPosition): boolean {
  if (position.kind === 'global') {
    return position.value.source?.kind === 'coordinateRef'
  }

  return (
    pointContainsCoordinateRef(position.preview) ||
    pointContainsCoordinateRef(position.frame.origin) ||
    pointContainsCoordinateRef(position.frame.u) ||
    pointContainsCoordinateRef(position.frame.v) ||
    pointContainsCoordinateRef(position.frame.normal)
  )
}

function pointContainsCoordinateRef(point: Vec3): boolean {
  const source = coordinateReferenceSourceForPoint(point)

  if (source !== null) {
    return true
  }

  const symbolicSource = point.symbolic?.source

  if (symbolicSource?.kind !== 'workPlaneLocal') {
    return false
  }

  return (
    pointContainsCoordinateRef(symbolicSource.frame.origin) ||
    pointContainsCoordinateRef(symbolicSource.frame.u) ||
    pointContainsCoordinateRef(symbolicSource.frame.v) ||
    pointContainsCoordinateRef(symbolicSource.frame.normal)
  )
}

function parseTranslation(
  diagram: Diagram,
  dx: string,
  dy: string,
  dz: string,
) {
  const parsed = parseTranslationVectorFromInputs(diagram, { dx, dy, dz })

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.translation
}

function numericComponent(value: number): CoordinateComponent {
  return {
    kind: 'numeric',
    value,
  }
}

function symbolicComponent(
  expression: string,
  previewValue: number,
): CoordinateComponent {
  return {
    kind: 'symbolic',
    expression,
    previewValue,
  }
}

function numericScalar(value: number): ScalarInputValue {
  return {
    kind: 'numeric',
    value,
  }
}

function symbolicScalar(
  expression: string,
  previewValue: number,
): ScalarInputValue {
  return {
    kind: 'symbolic',
    expression,
    previewValue,
  }
}

function scalarPreview(value: ScalarInputValue): number {
  return value.kind === 'numeric' ? value.value : value.previewValue
}

function symbolicVariable(
  id: string,
  name: string,
  previewValue: number,
): SymbolicVariable {
  return {
    id,
    name,
    macroName: name,
    expression: String(previewValue),
    previewValue,
  }
}
