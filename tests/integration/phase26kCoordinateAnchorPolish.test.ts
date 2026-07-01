import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
  createCoordinateAnchor,
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  findCoordinateAnchorReferences,
  parseSavedDiagramJson,
  serializeDiagram,
  translateLayerWithResult,
  validateDiagram,
} from '../../src/model/index.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { deleteCoordinateAnchorWithDetach } from '../../src/ui/coordinateAnchorDeletion.ts'
import { toggleCoordinateAnchorVisibility } from '../../src/ui/previewToolbar.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'
import type {
  CoordinateAnchorPosition,
  CoordinateComponent,
  Diagram,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'

type TestEditorState = UndoableEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
}

test('coordinate anchor path references survive save/load and export as readable TikZ', () => {
  const diagram = createReferencedPathDiagram()
  const loaded = saveAndLoad(diagram)
  const tikz = generateTikz(loaded)

  assert.equal(validateDiagram(loaded).valid, true)
  assert.match(tikz, /\\coordinate \(A\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(B\) at \(2,1\);/)
  assert.match(tikz, /\(A\) -- \(B\);/)
  assert.ok(tikz.indexOf('\\coordinate (A)') < tikz.indexOf('(A) -- (B);'))
})

test('show and hide coordinate UI state does not affect save/load or TikZ', () => {
  const diagram = createReferencedPathDiagram()
  const before = serializeDiagram(diagram)
  const beforeTikz = generateTikz(diagram)

  assert.equal(toggleCoordinateAnchorVisibility(true), false)
  assert.equal(toggleCoordinateAnchorVisibility(false), true)

  const loaded = saveAndLoad(diagram)
  const saved = JSON.parse(before) as { diagram: Record<string, unknown> }

  assert.equal('showCoordinateAnchors' in saved.diagram, false)
  assert.equal(serializeDiagram(loaded), before)
  assert.equal(generateTikz(loaded), beforeTikz)
})

test('deleting a referenced coordinate detaches, then save/load and TikZ stay clean', () => {
  const deleted = deleteCoordinateAnchorWithDetach(
    createReferencedPathDiagram(),
    'coord-a',
  )

  assert.equal(deleted.ok, true)
  if (!deleted.ok) {
    throw new Error(deleted.message)
  }

  const loaded = saveAndLoad(deleted.diagram)
  const curve = requiredPolyline(loaded, 'referenced-path')
  const tikz = generateTikz(loaded)

  assert.equal(deleted.detachedCount, 1)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[0]), null)
  assert.equal(
    coordinateReferenceSourceForPoint(curve.points[1])?.coordinateId,
    'coord-b',
  )
  assert.equal(findCoordinateAnchorReferences(loaded, 'coord-a').length, 0)
  assert.equal(JSON.stringify(loaded).includes('"coordinateId":"coord-a"'), false)
  assert.equal(validateDiagram(loaded).valid, true)
  assert.doesNotMatch(tikz, /\\coordinate \(A\)/)
  assert.doesNotMatch(tikz, /\(A\) --/)
  assert.match(tikz, /\\coordinate \(B\) at \(2,1\);/)
})

test('layer translation detaches global coordinate refs before save/load/export', () => {
  const diagram = createLayerReferencedPointDiagram()
  const translated = translateLayerWithResult(diagram, 2, { x: 3, y: -1, z: 0 })
  const loaded = saveAndLoad(translated.diagram)
  const point = requiredPoint(loaded, 'layer-reference-point')
  const tikz = generateTikz(loaded)

  assert.equal(translated.translated, true)
  assert.equal(translated.detachedCoordinateReferenceCount, 1)
  assert.deepEqual(point.position, { x: 4, y: 1, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(point.position), null)
  assert.equal(findCoordinateAnchorReferences(loaded, 'coord-a').length, 0)
  assert.match(tikz, /\\coordinate \(A\) at \(1,2\);/)
  assert.match(tikz, /\\coordinate \(pointLayerReferencePoint0p0\) at \(4,1\);/)
})

test('undo and redo restore delete detach state', () => {
  const initial = createState(createReferencedPathDiagram())
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

  assert.equal(hasAnchor(undone.editableDiagram, 'coord-a'), true)
  assert.equal(
    coordinateReferenceSourceForPoint(
      requiredPolyline(undone.editableDiagram, 'referenced-path').points[0],
    )?.coordinateId,
    'coord-a',
  )
  assert.equal(hasAnchor(redone.editableDiagram, 'coord-a'), false)
  assert.equal(
    coordinateReferenceSourceForPoint(
      requiredPolyline(redone.editableDiagram, 'referenced-path').points[0],
    ),
    null,
  )
})

test('undo and redo restore layer translation detach state', () => {
  const initial = createState(createLayerReferencedPointDiagram())
  const translated = translateLayerWithResult(
    initial.editableDiagram,
    2,
    { x: 3, y: -1, z: 0 },
  )
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: translated.diagram,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(
    coordinateReferenceSourceForPoint(
      requiredPoint(undone.editableDiagram, 'layer-reference-point').position,
    )?.coordinateId,
    'coord-a',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(
      requiredPoint(redone.editableDiagram, 'layer-reference-point').position,
    ),
    null,
  )
  assert.deepEqual(
    requiredPoint(redone.editableDiagram, 'layer-reference-point').position,
    { x: 4, y: 1, z: 0 },
  )
})

test('work-plane-local coordinate ref detach preserves local expressions', () => {
  const deleted = deleteCoordinateAnchorWithDetach(
    createLocalReferencedPointDiagram(),
    'coord-local',
  )

  assert.equal(deleted.ok, true)
  if (!deleted.ok) {
    throw new Error(deleted.message)
  }

  const loaded = saveAndLoad(deleted.diagram)
  const point = requiredPoint(loaded, 'local-reference-point')
  const source = point.position.symbolic?.source
  const tikz = generateTikz(loaded)

  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected work-plane-local source.')
  }
  assert.deepEqual(source.local.a, symbolicComponent('R/2', 1))
  assert.deepEqual(source.local.b, symbolicComponent('R', 2))
  assert.deepEqual(source.frame.origin, localFrame.origin)
  assert.equal(JSON.stringify(loaded).includes('"coordinateId":"coord-local"'), false)
  assert.equal(validateDiagram(loaded).valid, true)
  assert.doesNotMatch(tikz, /LocalAnchor/)
  assert.match(tikz, /\\R/)
})

test('inline coordinate-anchor output has no blank lines and four-space body indentation', () => {
  const tikz = generateTikz(createReferencedPathDiagram(), {
    exportMode: 'inlineMath',
  })

  assert.doesNotMatch(tikz, /\n[ \t]*\n/)
  assert.equal(tikz.startsWith('\n'), false)
  assert.equal(tikz.endsWith('\n'), false)
  assert.match(tikz, /\n    \\coordinate \(A\) at \(0,0\);/)
  assert.match(tikz, /\n    \\coordinate \(B\) at \(2,1\);/)
  assert.match(tikz, /\n    \\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  assert.doesNotMatch(tikz, /\n  \\(?:coordinate|draw|node|begin\{pgfonlayer\})/)
})

test('coordinate reference traversal remains bounded on many objects', () => {
  const diagram = createManyCoordinateReferenceDiagram(2_000)
  const before = JSON.stringify(diagram)
  const startMs = performance.now()
  const references = findCoordinateAnchorReferences(diagram, 'coord-a')
  const elapsedMs = performance.now() - startMs

  assert.equal(references.length, 2_000)
  assert.equal(JSON.stringify(diagram), before)
  assert.ok(
    elapsedMs < 1_000,
    `coordinate reference traversal took ${elapsedMs.toFixed(1)}ms`,
  )
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

function createLocalReferencedPointDiagram(): Diagram {
  let diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [
      {
        id: 'var-r',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 2,
      },
    ],
  }

  diagram = appendAnchor(
    diagram,
    'coord-local',
    'Local anchor',
    'LocalAnchor',
    localAnchorPosition(),
  )
  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'local-reference-point',
      name: 'Local reference point',
      position: requiredCoordinateReference(diagram, 'coord-local'),
      layer: 0,
    }),
  )

  return diagram
}

function createManyCoordinateReferenceDiagram(count: number): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram = appendAnchor(
    diagram,
    'coord-a',
    'Anchor A',
    'A',
    globalAnchorPosition(0, 0, 0),
  )

  for (let index = 0; index < count; index += 1) {
    diagram.strata.push(
      createPointStratum({
        ambientDimension: 2,
        id: `reference-point-${index}`,
        name: `Reference point ${index}`,
        position: requiredCoordinateReference(diagram, 'coord-a'),
        layer: index % 4,
      }),
    )
  }

  return diagram
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

const localFrame: WorkPlaneFrameSnapshot = {
  origin: { x: -1, y: 0, z: 0 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}

function localAnchorPosition(): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: localFrame,
    local: {
      a: symbolicComponent('R/2', 1),
      b: symbolicComponent('R', 2),
    },
    preview: { x: 0, y: 0, z: 2 },
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

function saveAndLoad(diagram: Diagram): Diagram {
  const parsed = parseSavedDiagramJson(serializeDiagram(diagram))

  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.diagram
}

function createState(diagram: Diagram): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
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

function hasAnchor(diagram: Diagram, id: string): boolean {
  return (diagram.coordinateAnchors ?? []).some((anchor) => anchor.id === id)
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
