import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
} from '../../src/model/constructors.ts'
import { translateLayer } from '../../src/model/layers.ts'
import type { ScalarInputValue } from '../../src/model/scalarExpressions.ts'
import {
  diagramTranslationContext,
  translateStratum,
  translationVectorFromNumericVec3,
} from '../../src/model/translation.ts'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  Diagram,
  PointStratum,
  SymbolicVariable,
  Vec3,
  WorkPlane,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { addPointStratumFromDirectInput } from '../../src/ui/diagramUpdates.ts'
import { translateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'
import { concatenateSelectedPaths } from '../../src/ui/pathConcatenation.ts'

type TestEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

const baseFrame = xzFrame({ x: 10, y: 20, z: 30 })
const translation = { x: 1, y: -2, z: 3 }

test('global translation moves local frame origin and preserves local expressions and basis', () => {
  const diagram = diagramWithLocalPoint()
  const sourcePoint = findPoint(diagram, 'local-point')
  const source = requireLocalSource(sourcePoint.position)
  const vector = translationVectorFromNumericVec3(diagram, translation)
  const translated = translateStratum(
    sourcePoint,
    vector,
    diagramTranslationContext(diagram),
  )

  assert.equal(translated.geometricKind, 'point')
  if (translated.geometricKind !== 'point') {
    throw new Error('Expected a translated point.')
  }

  const moved = requireLocalSource(translated.position)

  assertVec3Close(moved.frame.origin, addVec3(source.frame.origin, translation))
  assert.deepEqual(moved.local, source.local)
  assert.deepEqual(moved.frame.u, source.frame.u)
  assert.deepEqual(moved.frame.v, source.frame.v)
  assert.deepEqual(moved.frame.normal, source.frame.normal)
  assertVec3Close(translated.position, addVec3(sourcePoint.position, translation))
})

test('global translation does not mutate the active work plane used to create local input', () => {
  const workPlane = customWorkPlane()
  const originalWorkPlane = structuredClone(workPlane) as WorkPlane
  const created = addPointStratumFromDirectInput(
    symbolicDiagram(),
    { x: 'R', y: '1', z: '0' },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane,
    },
  )

  assert.equal(created.ok, true)
  if (!created.ok) {
    throw new Error(created.error)
  }

  const vector = translationVectorFromNumericVec3(created.diagram, translation)
  const point = findPoint(created.diagram, created.id)
  translateStratum(point, vector, diagramTranslationContext(created.diagram))

  assert.deepEqual(workPlane, originalWorkPlane)
})

test('multi-selection translation moves each local frame origin without changing local scalars', () => {
  const diagram = diagramWithLocalPoints()
  const result = translateSelectedElements(
    diagram,
    selection('local-a', 'local-b'),
    translationVectorFromNumericVec3(diagram, translation),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  for (const id of ['local-a', 'local-b']) {
    const before = requireLocalSource(findPoint(diagram, id).position)
    const after = requireLocalSource(findPoint(result.diagram, id).position)

    assertVec3Close(after.frame.origin, addVec3(before.frame.origin, translation))
    assert.deepEqual(after.local, before.local)
  }
})

test('layer translation uses the same local frame-origin policy', () => {
  const diagram = diagramWithLocalPoints()
  const translated = translateLayer(diagram, 5, translation)
  const moved = requireLocalSource(findPoint(translated, 'local-a').position)
  const unmoved = requireLocalSource(findPoint(translated, 'local-b').position)

  assertVec3Close(
    moved.frame.origin,
    addVec3(requireLocalSource(findPoint(diagram, 'local-a').position).frame.origin, translation),
  )
  assert.deepEqual(
    moved.local,
    requireLocalSource(findPoint(diagram, 'local-a').position).local,
  )
  assertVec3Close(
    unmoved.frame.origin,
    requireLocalSource(findPoint(diagram, 'local-b').position).frame.origin,
  )
})

test('undo and redo restore local frame origins after translation', () => {
  const initial = createEditorState(diagramWithLocalPoint())
  const translated = translateLayer(initial.editableDiagram, 0, translation)
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: translated,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assertVec3Close(
    requireLocalSource(findPoint(undone.editableDiagram, 'local-point').position)
      .frame.origin,
    baseFrame.origin,
  )
  assertVec3Close(
    requireLocalSource(findPoint(redone.editableDiagram, 'local-point').position)
      .frame.origin,
    addVec3(baseFrame.origin, translation),
  )
})

test('direct local symbolic input is not snapped', () => {
  const snap = { enabled: true, step: 1 }
  const created = addPointStratumFromDirectInput(
    symbolicDiagram(),
    { x: 'R + 0.26', y: '0.74', z: '0' },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: customWorkPlane(),
    },
  )

  assert.equal(snap.enabled, true)
  assert.equal(created.ok, true)
  if (!created.ok) {
    throw new Error(created.error)
  }

  const point = findPoint(created.diagram, created.id)
  const source = requireLocalSource(point.position)

  assert.equal(source.local.a.kind, 'symbolic')
  assert.equal(
    source.local.a.kind === 'symbolic' ? source.local.a.expression : '',
    'R + 0.26',
  )
  assert.equal(source.local.b.kind, 'numeric')
  assert.equal(source.local.b.kind === 'numeric' ? source.local.b.value : null, 0.74)
  assertVec3Close(point.position, { x: 12.26, y: 20, z: 30.74 })
})

test('path concatenation preserves same-frame local coordinate sources', () => {
  const diagram = diagramWithLocalPaths(false)
  const result = concatenateSelectedPaths(
    diagram,
    selection('path-a', 'path-b'),
    { id: 'joined-local-path', keepOriginals: false },
  )
  const path = expectConcatenatedPath(result, 'joined-local-path')
  const firstSource = requireLocalSource(path.segments[0].start)
  const lastSource = requireLocalSource(path.segments[1].end)
  const tikz = generateTikz(result.diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.equal(
    firstSource.local.a.kind === 'symbolic' ? firstSource.local.a.expression : '',
    'R',
  )
  assert.equal(
    lastSource.local.a.kind === 'symbolic' ? lastSource.local.a.expression : '',
    'R + 2',
  )
  assert.equal(countMatches(layerBlock, /canvas is plane/g), 1)
  assert.match(
    layerBlock,
    /\(\{\\R\},0\) -- \(\{\\R \+ 1\},0\) -- \(\{\\R \+ 2\},0\);/,
  )
})

test('mixed-frame path concatenation preserves sources and TikZ falls back explicitly', () => {
  const diagram = diagramWithLocalPaths(true)
  const result = concatenateSelectedPaths(
    diagram,
    selection('path-a', 'path-b'),
    { id: 'joined-mixed-local-path', keepOriginals: false },
  )
  const path = expectConcatenatedPath(result, 'joined-mixed-local-path')
  const firstSource = requireLocalSource(path.segments[0].start)
  const lastSource = requireLocalSource(path.segments[1].end)
  const tikz = generateTikz(result.diagram)

  assert.deepEqual(firstSource.frame, xyFrame())
  assert.deepEqual(lastSource.frame, xyFrame({ x: 1, y: 0, z: 0 }))
  assert.match(
    tikz,
    /uses global preview coordinates because Curve "Concatenated path" \[joined-mixed-local-path\] uses multiple work-plane-local frames/,
  )
  assert.match(
    tikz,
    /Work-plane-local symbolic expressions are not expanded into global symbolic coordinates/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('TikZ after translation uses the moved frame and unchanged local expressions', () => {
  const diagram = diagramWithLocalPoint()
  const translated = translateLayer(diagram, 0, translation)
  const source = requireLocalSource(findPoint(translated, 'local-point').position)
  const tikz = generateTikz(translated)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assertVec3Close(source.frame.origin, addVec3(baseFrame.origin, translation))
  assert.equal(
    source.local.a.kind === 'symbolic' ? source.local.a.expression : '',
    'R + 0.26',
  )
  assert.match(layerBlock, /plane origin=\{\(11,18,33\)\}/)
  assert.match(
    layerBlock,
    /\] at \(\{\\R \+ 0\.26\},0\.74\) \{\};/,
  )
})

function diagramWithLocalPoint(): Diagram {
  const diagram = symbolicDiagram()
  const source = localCoordinateSource(
    baseFrame,
    symbolicScalar('R + 0.26', 2.26),
    numericScalar(0.74),
  )

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'local-point',
      name: 'Local point',
      position: workPlaneLocalPoint({ x: 12.26, y: 20, z: 30.74 }, source),
      layer: 0,
    }),
  )

  return diagram
}

function diagramWithLocalPoints(): Diagram {
  const diagram = symbolicDiagram()

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'local-a',
      name: 'Local A',
      position: workPlaneLocalPoint(
        { x: 12, y: 20, z: 30 },
        localCoordinateSource(baseFrame, symbolicScalar('R', 2), numericScalar(0)),
      ),
      layer: 5,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'local-b',
      name: 'Local B',
      position: workPlaneLocalPoint(
        { x: 10, y: 20, z: 31 },
        localCoordinateSource(baseFrame, numericScalar(0), numericScalar(1)),
      ),
      layer: 0,
    }),
  )

  return diagram
}

function diagramWithLocalPaths(mixedFrames: boolean): Diagram {
  const diagram = symbolicDiagram()
  const firstFrame = xyFrame()
  const secondFrame = mixedFrames ? xyFrame({ x: 1, y: 0, z: 0 }) : xyFrame()

  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 3,
      id: 'path-a',
      name: 'Path A',
      points: [
        workPlaneLocalPoint(
          { x: 2, y: 0, z: 0 },
          localCoordinateSource(firstFrame, symbolicScalar('R', 2), numericScalar(0)),
        ),
        workPlaneLocalPoint(
          { x: 3, y: 0, z: 0 },
          localCoordinateSource(
            firstFrame,
            symbolicScalar('R + 1', 3),
            numericScalar(0),
          ),
        ),
      ],
      layer: 0,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'path-b',
      name: 'Path B',
      points: [
        workPlaneLocalPoint(
          { x: 3, y: 0, z: 0 },
          localCoordinateSource(
            secondFrame,
            symbolicScalar(mixedFrames ? 'R' : 'R + 1', mixedFrames ? 2 : 3),
            numericScalar(0),
          ),
        ),
        workPlaneLocalPoint(
          { x: 4, y: 0, z: 0 },
          localCoordinateSource(
            secondFrame,
            symbolicScalar(mixedFrames ? 'R + 1' : 'R + 2', mixedFrames ? 3 : 4),
            numericScalar(0),
          ),
        ),
      ],
      layer: 0,
    }),
  )

  return diagram
}

function symbolicDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.variables = [
    variable('var-R', 'R', '2', 2),
  ]

  return diagram
}

function variable(
  id: string,
  name: string,
  expression: string,
  previewValue: number,
): SymbolicVariable {
  return {
    id,
    name,
    macroName: name,
    expression,
    previewValue,
  }
}

function localCoordinateSource(
  frame: WorkPlaneFrameSnapshot,
  a: ScalarInputValue,
  b: ScalarInputValue,
): WorkPlaneLocalCoordinateSource {
  return {
    kind: 'workPlaneLocal',
    frame,
    local: { a, b },
  }
}

function workPlaneLocalPoint(
  point: Vec3,
  source: WorkPlaneLocalCoordinateSource,
): Vec3 {
  return {
    ...point,
    symbolic: {
      x: { kind: 'numeric', value: point.x },
      y: { kind: 'numeric', value: point.y },
      z: { kind: 'numeric', value: point.z },
      source,
    },
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

function xyFrame(origin: Vec3 = { x: 0, y: 0, z: 0 }): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function xzFrame(origin: Vec3): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  }
}

function customWorkPlane(): WorkPlane {
  return {
    kind: 'custom',
    id: 'phase25e-work-plane',
    name: 'Phase 25E plane',
    origin: { x: 10, y: 20, z: 30 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
    source: { kind: 'originNormal' },
  }
}

function requireLocalSource(point: Vec3): WorkPlaneLocalCoordinateSource {
  const source = point.symbolic?.source

  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local coordinate source.')
  }

  return source
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  assert.equal(stratum?.geometricKind, 'point')
  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Expected ${id} to be a point.`)
  }

  return stratum
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  assert.equal(stratum?.geometricKind, 'curve')
  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Expected ${id} to be a curve.`)
  }

  return stratum
}

function expectConcatenatedPath(
  result: ReturnType<typeof concatenateSelectedPaths>,
  id: string,
): ConcatenatedPathStratum {
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, id)

  assert.equal(curve.kind, 'concatenatedPath')
  if (curve.kind !== 'concatenatedPath') {
    throw new Error(`Expected ${id} to be a concatenated path.`)
  }

  return curve
}

function selection(...ids: string[]): SelectedElement {
  return {
    kind: 'multi',
    elements: ids.map((id) => ({ kind: 'stratum', id })),
  }
}

function createEditorState(editableDiagram: Diagram): TestEditorState {
  return {
    editableDiagram,
    selectedElement: { kind: 'stratum', id: 'local-point' },
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: '',
    history: createDiagramHistory(editableDiagram),
  }
}

function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

function assertVec3Close(actual: Vec3, expected: Vec3): void {
  assert.ok(Math.abs(actual.x - expected.x) <= 1e-9)
  assert.ok(Math.abs(actual.y - expected.y) <= 1e-9)
  assert.ok(Math.abs(actual.z - expected.z) <= 1e-9)
}

function extractLayerBlock(tikz: string, layerName: string): string {
  const start = tikz.indexOf(`\\begin{pgfonlayer}{${layerName}}`)
  const end = tikz.indexOf('\\end{pgfonlayer}', start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  return tikz.slice(start, end)
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length
}
