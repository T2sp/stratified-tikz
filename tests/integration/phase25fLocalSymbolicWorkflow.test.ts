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
  parseSavedDiagramJson,
  parseSavedDiagramJsonForImport,
  resolvePendingSymbolicDiagramImport,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type {
  CoordinateComponent,
  Diagram,
  PointStratum,
  SymbolicVariable,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'

const frame = xzFrame({ x: 10, y: 20, z: 30 })
const translation = { x: 1, y: -2, z: 3 }
const resolvedPointPreview = {
  x: 10 + Math.sqrt(3),
  y: 20,
  z: 31,
}

test('local symbolic point survives save, variable resolution, global translation, and TikZ export', () => {
  const pending = parseSavedDiagramJsonForImport(
    serializeDiagram(diagramWithUnresolvedLocalSymbolicPoint()),
  )

  assert.equal(pending.ok, true, pending.ok ? undefined : pending.error)
  if (!pending.ok) {
    throw new Error(pending.error)
  }
  assert.equal(pending.kind, 'needsVariableResolution')
  if (pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected variable resolution.')
  }
  assert.deepEqual(
    pending.pendingImport.variables.map((variable) => variable.name).sort(),
    ['R', 'q'],
  )

  const resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
    { name: 'R', expression: '2' },
    { name: 'q', expression: '30' },
  ])

  assert.equal(resolved.ok, true, resolved.ok ? undefined : resolved.error)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const loadedPoint = findPoint(resolved.diagram, 'local-symbolic-point')
  const loadedSource = requireLocalSource(loadedPoint.position)

  assertVec3Close(loadedPoint.position, resolvedPointPreview)
  assert.equal(localExpression(loadedSource, 'a'), 'R*cos(q)')
  assert.equal(localExpression(loadedSource, 'b'), 'R*sin(q)')

  const translated = translateLayer(resolved.diagram, 0, translation)
  const movedPoint = findPoint(translated, 'local-symbolic-point')
  const movedSource = requireLocalSource(movedPoint.position)

  assertVec3Close(movedSource.frame.origin, addVec3(frame.origin, translation))
  assert.equal(localExpression(movedSource, 'a'), 'R*cos(q)')
  assert.equal(localExpression(movedSource, 'b'), 'R*sin(q)')

  const tikz = generateTikz(translated)
  const inlineTikz = generateTikz(translated, { exportMode: 'inlineMath' })

  assert.match(tikz, /plane origin=\{\(11,18,33\)\}/)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
  expectNoBlankLines(inlineTikz)
})

test('path with local symbolic coordinates and arrows exports in a canvas plane scope', () => {
  const diagram = diagramWithLocalSymbolicArrowPath()
  const tikz = generateTikz(diagram)
  const inlineTikz = generateTikz(diagram, { exportMode: 'inlineMath' })

  assert.match(tikz, /Curve "Local symbolic arrow path"/)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /\(0,0\) -- \(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\);/)
  assert.match(tikz, /\n\s+->,\n/)
  assert.match(tikz, /mark=at position 0\.5/)
  assert.match(tikz, /\\arrow\{Stealth\}/)
  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
  expectNoBlankLines(inlineTikz)
})

test('layer translation moves each local symbolic frame on the layer only', () => {
  const diagram = diagramWithLocalPointsOnDifferentLayers()
  const translated = translateLayer(diagram, 5, translation)
  const moved = requireLocalSource(findPoint(translated, 'local-layer-5').position)
  const unmoved = requireLocalSource(findPoint(translated, 'local-layer-0').position)

  assertVec3Close(moved.frame.origin, addVec3(frame.origin, translation))
  assert.equal(localExpression(moved, 'a'), 'R*cos(q)')
  assert.equal(localExpression(moved, 'b'), 'R*sin(q)')
  assertVec3Close(unmoved.frame.origin, frame.origin)
})

test('numeric and global symbolic diagrams keep their global coordinate export', () => {
  const diagram = diagramWithNumericAndGlobalSymbolicCoordinates()
  const loaded = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(loaded.ok, true, loaded.ok ? undefined : loaded.error)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  const translated = translateLayer(loaded.diagram, 0, { x: 1, y: 2, z: 3 })
  const numericPoint = findPoint(translated, 'numeric-global-point')
  const symbolicPoint = findPoint(translated, 'symbolic-global-point')
  const tikz = generateTikz(translated)

  assert.equal(numericPoint.position.symbolic?.source, undefined)
  assert.equal(symbolicPoint.position.symbolic?.source, undefined)
  assertVec3Close(numericPoint.position, { x: 2, y: 4, z: 6 })
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.match(tikz, /\(pointNumericGlobalPoint0p0\)/)
  assert.match(tikz, /\{\\R \+ 1\}/)
})

function diagramWithUnresolvedLocalSymbolicPoint(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'local-symbolic-point',
      name: 'Local symbolic point',
      position: localPoint(
        frame,
        symbolicScalar('R*cos(q)', Math.sqrt(3)),
        symbolicScalar('R*sin(q)', 1),
      ),
      layer: 0,
    }),
  )

  return diagram
}

function diagramWithLocalSymbolicArrowPath(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.variables = polarVariables()

  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 3,
      id: 'local-symbolic-arrow-path',
      name: 'Local symbolic arrow path',
      points: [
        localPoint(frame, numericScalar(0), numericScalar(0)),
        localPoint(
          frame,
          symbolicScalar('R*cos(q)', Math.sqrt(3)),
          symbolicScalar('R*sin(q)', 1),
        ),
      ],
      arrows: {
        endpoint: 'forward',
        mid: {
          enabled: true,
          position: 0.5,
          direction: 'forward',
          head: 'stealth',
        },
      },
      layer: 0,
    }),
  )

  return diagram
}

function diagramWithLocalPointsOnDifferentLayers(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.variables = polarVariables()

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'local-layer-5',
      name: 'Local layer 5',
      position: localPoint(
        frame,
        symbolicScalar('R*cos(q)', Math.sqrt(3)),
        symbolicScalar('R*sin(q)', 1),
      ),
      layer: 5,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'local-layer-0',
      name: 'Local layer 0',
      position: localPoint(frame, numericScalar(0), numericScalar(1)),
      layer: 0,
    }),
  )

  return diagram
}

function diagramWithNumericAndGlobalSymbolicCoordinates(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.variables = [
    {
      id: 'global-var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
  ]

  diagram.strata.push(
    createPointStratum({
      ambientDimension: 3,
      id: 'numeric-global-point',
      name: 'Numeric global point',
      position: { x: 1, y: 2, z: 3 },
      layer: 0,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'symbolic-global-point',
      name: 'Symbolic global point',
      position: symbolicVec3(
        symbolicComponent('R', 2),
        numericComponent(0),
        numericComponent(0),
      ),
      layer: 0,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'numeric-global-path',
      name: 'Numeric global path',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      layer: 0,
    }),
  )

  return diagram
}

function polarVariables(): SymbolicVariable[] {
  return [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
    {
      id: 'var-q',
      name: 'q',
      macroName: 'q',
      expression: '30',
      previewValue: 30,
    },
  ]
}

function localPoint(
  sourceFrame: WorkPlaneFrameSnapshot,
  a: ScalarInputValue,
  b: ScalarInputValue,
): Vec3 {
  const aPreview = scalarPreview(a)
  const bPreview = scalarPreview(b)
  const point = {
    x:
      sourceFrame.origin.x +
      aPreview * sourceFrame.u.x +
      bPreview * sourceFrame.v.x,
    y:
      sourceFrame.origin.y +
      aPreview * sourceFrame.u.y +
      bPreview * sourceFrame.v.y,
    z:
      sourceFrame.origin.z +
      aPreview * sourceFrame.u.z +
      bPreview * sourceFrame.v.z,
  }
  const source: WorkPlaneLocalCoordinateSource = {
    kind: 'workPlaneLocal',
    frame: sourceFrame,
    local: { a, b },
  }

  return {
    ...point,
    symbolic: {
      x: numericComponent(point.x),
      y: numericComponent(point.y),
      z: numericComponent(point.z),
      source,
    },
  }
}

function symbolicVec3(
  x: CoordinateComponent,
  y: CoordinateComponent,
  z: CoordinateComponent,
): Vec3 {
  return {
    x: componentPreview(x),
    y: componentPreview(y),
    z: componentPreview(z),
    symbolic: { x, y, z },
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

function numericComponent(value: number): CoordinateComponent {
  return { kind: 'numeric', value }
}

function symbolicComponent(
  expression: string,
  previewValue: number,
): CoordinateComponent {
  return { kind: 'symbolic', expression, previewValue }
}

function componentPreview(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function xzFrame(origin: Vec3): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
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

function localExpression(
  source: WorkPlaneLocalCoordinateSource,
  axis: 'a' | 'b',
): string {
  const value = source.local[axis]

  return value.kind === 'symbolic' ? value.expression : String(value.value)
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  assert.equal(stratum?.geometricKind, 'point')
  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Expected ${id} to be a point.`)
  }

  return stratum
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

function expectNoBlankLines(tikz: string): void {
  assert.doesNotMatch(tikz, /\n\s*\n/)
}
