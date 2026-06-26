import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
} from '../../src/examples/index.ts'
import {
  addSymbolicVariableToDiagram,
  updateSymbolicVariableInDiagram,
} from '../../src/model/variables.ts'
import {
  parseSavedDiagramJson,
  parseSavedDiagramJsonForImport,
  resolvePendingSymbolicDiagramImport,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import {
  detectWorkPlaneLocalCoordinateVariables,
  evaluateWorkPlaneLocalCoordinate,
  type WorkPlaneLocalCoordinateExpressionContext,
} from '../../src/model/workPlaneLocalCoordinates.ts'
import type {
  ClosedPathBoundary,
  CoordinateComponent,
  CurveStyle,
  Diagram,
  PointStratum,
  SheetStyle,
  Stratum,
  SymbolicVariable,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
} from '../../src/model/types.ts'
import type { ScalarInputValue } from '../../src/model/scalarExpressions.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addConcatenatedPathFromDirectInput,
  addPointStratumFromDirectInput,
} from '../../src/ui/diagramUpdates.ts'

test('direct symbolic point input stores expressions and preview values', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: 'R',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const point = findPoint(result.diagram, result.id)

  assertClose(point.position.x, Math.sqrt(3))
  assertClose(point.position.y, 1)
  assert.equal(point.position.z, 0)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R*cos(q)')
  assertClose(point.position.symbolic?.x.previewValue ?? Number.NaN, Math.sqrt(3))
  assert.equal(point.position.symbolic?.y.kind, 'symbolic')
  assert.equal(point.position.symbolic?.y.expression, 'R*sin(q)')
  assertClose(point.position.symbolic?.y.previewValue ?? Number.NaN, 1)
  assert.equal(point.position.symbolic?.z.kind, 'numeric')
  assert.equal(point.position.symbolic?.z.value, 0)
})

test('symbolic point coordinates export as TikZ macro expressions', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const tikz = generateTikz(result.diagram)

  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
  assert.match(tikz, /\\pgfmathsetmacro\{\\q\}\{30\}/)
  assert.match(tikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

test('mixed numeric and symbolic coordinates export component-wise', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R',
    y: '0',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected mixed point creation to succeed.')
  }

  assert.match(generateTikz(result.diagram), /\(\{\\R\},0\)/)
})

test('variable updates recompute symbolic coordinate preview values', () => {
  const initial = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(initial.ok, true)
  if (!initial.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(initial.diagram, 'var-R', {
      expression: '4',
    }),
  )
  const point = findPoint(updated, initial.id)

  assertClose(point.position.x, 2 * Math.sqrt(3))
  assertClose(point.position.y, 2)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R*cos(q)')
  assertClose(
    point.position.symbolic?.x.previewValue ?? Number.NaN,
    2 * Math.sqrt(3),
  )
})

test('unknown variables and invalid coordinate expressions are rejected', () => {
  const unknownVariable = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'S',
    y: '0',
    z: '0',
  })
  const invalidExpression = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*',
    y: '0',
    z: '0',
  })

  assert.equal(unknownVariable.ok, false)
  assert.equal(invalidExpression.ok, false)
})

test('non-finite symbolic coordinate previews are rejected', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'sqrt(-1)',
    y: '0',
    z: '0',
  })

  assert.equal(result.ok, false)
})

test('direct symbolic path creation stores symbolic vertices and exports them', () => {
  const result = addConcatenatedPathFromDirectInput(symbolicDiagram(), {
    start: { x: 'R', y: '0', z: '0' },
    segments: [
      {
        kind: 'line',
        end: { x: 'R*cos(q)', y: 'R*sin(q)', z: '0' },
      },
    ],
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = result.diagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(path?.geometricKind, 'curve')
  assert.equal(path?.kind, 'concatenatedPath')
  if (path?.geometricKind !== 'curve' || path.kind !== 'concatenatedPath') {
    throw new Error('Expected a concatenated path.')
  }

  assert.equal(path.segments[0].start.symbolic?.x.kind, 'symbolic')
  assert.equal(path.segments[0].end.symbolic?.y.kind, 'symbolic')
  assert.match(generateTikz(result.diagram), /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

test('symbolic coordinate save and load round-trip preserves expressions', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const parsed = parseSavedDiagramJson(serializeDiagram(result.diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const point = findPoint(parsed.diagram, result.id)

  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R*cos(q)')
  assert.equal(point.position.symbolic?.y.kind, 'symbolic')
  assert.equal(point.position.symbolic?.y.expression, 'R*sin(q)')
})

test('parseSavedDiagramJson rejects symbolic Vec3 metadata with missing component fields cleanly', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)

  if (point.position.symbolic === undefined) {
    throw new Error('Expected saved point to have symbolic metadata.')
  }

  delete (point.position.symbolic as unknown as Record<string, unknown>).y

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved.file)),
    /strata\[0\]\.position\.symbolic\.y Coordinate component must be an object/,
  )
})

test('parseSavedDiagramJson rejects malformed symbolic component shape cleanly', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)

  if (point.position.symbolic === undefined) {
    throw new Error('Expected saved point to have symbolic metadata.')
  }

  const symbolicRecord = point.position.symbolic as unknown as Record<
    string,
    unknown
  >
  symbolicRecord.x = 'bad'

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved.file)),
    /strata\[0\]\.position\.symbolic\.x Coordinate component must be an object/,
  )
})

test('parseSavedDiagramJson rejects invalid saved symbolic expressions cleanly', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)
  const x = symbolicX(point)

  x.expression = 'R*'

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved.file)),
    /strata\[0\]\.position\.symbolic\.x\.expression Expression ended unexpectedly/,
  )
})

test('parseSavedDiagramJson rejects non-finite saved symbolic preview values cleanly', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)
  const x = symbolicX(point)

  x.previewValue = 12345

  assertParseError(
    parseSavedDiagramJson(
      JSON.stringify(saved.file).replace(
        '"previewValue":12345',
        '"previewValue":1e309',
      ),
    ),
    /strata\[0\]\.position\.symbolic\.x\.previewValue Symbolic coordinate preview value must be finite/,
  )
})

test('parseSavedDiagramJson rejects non-finite saved symbolic evaluation cleanly', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)
  const x = symbolicX(point)

  point.position.x = 0
  x.expression = 'sqrt(-1)'
  x.previewValue = 0

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved.file)),
    /strata\[0\]\.position\.symbolic\.x\.expression Expression evaluated to a non-finite number/,
  )
})

test('parseSavedDiagramJson refreshes valid stale symbolic Vec3 previews', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)
  const x = symbolicX(point)

  point.position.x = -10
  x.previewValue = -10

  const parsed = parseSavedDiagramJson(JSON.stringify(saved.file))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  assert.deepEqual(parsed.warnings, [
    'Saved symbolic coordinate preview values were recalculated.',
  ])
  assertClose(findPoint(parsed.diagram, saved.pointId).position.x, Math.sqrt(3))
})

test('parseSavedDiagramJson loads old Vec3 coordinates without symbolic metadata', () => {
  const saved = savedSymbolicPointFile()
  const point = findPoint(saved.diagram, saved.pointId)

  delete point.position.symbolic

  const parsed = parseSavedDiagramJson(JSON.stringify(saved.file))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  assert.equal(findPoint(parsed.diagram, saved.pointId).position.symbolic, undefined)
})

test('parseSavedDiagramJson loads saved symbolic arc coordinates after preview refresh', () => {
  const saved = JSON.parse(serializeDiagram(symbolicDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'symbolic-arc',
    name: 'Symbolic Arc',
    style: curveStyle(),
    segments: [
      {
        kind: 'arc',
        start: symbolicPoint(3, 0, 0, 'R + 1'),
        end: { x: 2, y: 1, z: 0 },
        center: symbolicPoint(2, 0, 0, 'R'),
        radius: 1,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const stratum = parsed.diagram.strata.find(
    (candidate) => candidate.id === 'symbolic-arc',
  )
  if (stratum?.kind !== 'concatenatedPath') {
    throw new Error('Expected symbolic arc path.')
  }
  const segment = stratum.segments[0]

  if (segment?.kind !== 'arc') {
    throw new Error('Expected symbolic arc segment.')
  }
  assert.equal(segment.start.x, 3)
  assert.equal(segment.start.symbolic?.x.kind, 'symbolic')
  assert.equal(segment.center.x, 2)
  assert.equal(segment.center.symbolic?.x.kind, 'symbolic')
  assert.doesNotMatch(generateTikz(parsed.diagram), /NaN|Infinity/)
})

test('parseSavedDiagramJsonForImport detects variables in symbolic arc scalars', () => {
  const saved = JSON.parse(serializeDiagram(emptyTwoDimensionalDiagram)) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'symbolic-scalar-arc',
    name: 'Symbolic Scalar Arc',
    style: curveStyle(),
    segments: [
      {
        kind: 'arc',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 1, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        radius: symbolicScalar('R + sin(q)', 1),
        startAngleDeg: symbolicScalar('q', 0),
        endAngleDeg: symbolicScalar('q + 90', 90),
        direction: 'counterclockwise',
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const pending = parseSavedDiagramJsonForImport(JSON.stringify(saved))

  assert.equal(pending.ok, true)
  if (!pending.ok) {
    throw new Error(pending.error)
  }
  assert.equal(pending.kind, 'needsVariableResolution')
  if (pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected symbolic variable resolution.')
  }
  assert.deepEqual(
    pending.pendingImport.variables.map((variable) => variable.name).sort(),
    ['R', 'q'],
  )

  const resolved = resolvePendingSymbolicDiagramImport(
    pending.pendingImport,
    [
      { name: 'R', expression: '1' },
      { name: 'q', expression: '0' },
    ],
  )

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }
  const tikz = generateTikz(resolved.diagram)

  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{1\}/)
  assert.match(tikz, /\\pgfmathsetmacro\{\\q\}\{0\}/)
  assert.match(tikz, /arc\[start angle=\{\\q\}, end angle=\{\\q \+ 90\}, radius=\{\\R \+ sin\(\\q\)\}\]/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('parseSavedDiagramJson rejects unresolved symbolic arc scalar cleanly', () => {
  const saved = JSON.parse(serializeDiagram(emptyTwoDimensionalDiagram)) as {
    diagram: Diagram
  }
  saved.diagram.strata.push(symbolicScalarArcStratum(symbolicScalar('Missing', 1)))

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved)),
    /strata\[0\]\.segments\[0\]\.radius\.expression Unknown variable "Missing"/,
  )
})

test('parseSavedDiagramJson rejects non-finite symbolic arc scalar evaluation cleanly', () => {
  const saved = JSON.parse(serializeDiagram(emptyTwoDimensionalDiagram)) as {
    diagram: Diagram
  }
  saved.diagram.strata.push(
    symbolicScalarArcStratum(symbolicScalar('sqrt(-1)', 0)),
  )

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved)),
    /strata\[0\]\.segments\[0\]\.radius\.expression Expression evaluated to a non-finite number/,
  )
})

test('parseSavedDiagramJson rejects non-positive evaluated symbolic arc radius', () => {
  const saved = JSON.parse(serializeDiagram(symbolicDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push(symbolicScalarArcStratum(symbolicScalar('-R', -2)))

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved)),
    /strata\[0\]\.segments\[0\]\.radius Arc radius must be positive/,
  )
})

test('parseSavedDiagramJson loads saved symbolic 3D template centers with finite previews', () => {
  const saved = JSON.parse(serializeDiagram(symbolicThreeDimensionalDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'symbolic-template-3d',
    name: 'Symbolic Template 3D',
    style: curveStyle(),
    template: {
      kind: 'circleTemplate',
      center: symbolicPoint(2, 0, 0, 'R'),
      radius: 1,
      frame: {
        origin: { x: 2, y: 0, z: 0 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
    },
    styleSegments: [],
    layer: 0,
  })

  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const stratum = parsed.diagram.strata.find(
    (candidate) => candidate.id === 'symbolic-template-3d',
  )
  if (stratum?.kind !== 'templatePath') {
    throw new Error('Expected symbolic template path.')
  }
  assert.equal(stratum.template.center.x, 2)
  assert.equal(stratum.template.center.symbolic?.x.kind, 'symbolic')
  assert.doesNotMatch(generateTikz(parsed.diagram), /NaN|Infinity/)
})

test('parseSavedDiagramJson rejects malformed symbolic work-plane frame metadata cleanly', () => {
  const saved = JSON.parse(serializeDiagram(symbolicThreeDimensionalDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'workPlaneFilledSheet',
    id: 'symbolic-frame-sheet',
    name: 'Symbolic Frame Sheet',
    style: sheetStyle(),
    planeFrame: {
      origin: symbolicPoint(2, 0, 2, 'R'),
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    },
    boundaries: [squareBoundary3D('frame-boundary', 2)],
    fillRule: 'nonzero',
    layer: 0,
  })
  const sheet = saved.diagram.strata[saved.diagram.strata.length - 1]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }
  if (sheet.planeFrame.origin.symbolic === undefined) {
    throw new Error('Expected symbolic frame origin metadata.')
  }
  delete (sheet.planeFrame.origin.symbolic as unknown as Record<string, unknown>).y

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved)),
    /strata\[\d+\]\.planeFrame\.origin\.symbolic\.y Coordinate component must be an object/,
  )
})

test('parseSavedDiagramJson refreshes symbolic arc frame previews', () => {
  const saved = JSON.parse(serializeDiagram(symbolicThreeDimensionalDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'symbolic-arc-frame',
    name: 'Symbolic Arc Frame',
    style: curveStyle(),
    segments: [
      {
        kind: 'arc',
        start: { x: 3, y: 0, z: 0 },
        end: { x: 2, y: 1, z: 0 },
        center: { x: 2, y: 0, z: 0 },
        radius: 1,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
        frame: {
          origin: symbolicPoint(-99, 0, 0, 'R'),
          u: symbolicPoint(1, 0, 0, '1'),
          v: { x: 0, y: 1, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
        },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const stratum = parsed.diagram.strata.find(
    (candidate) => candidate.id === 'symbolic-arc-frame',
  )

  if (stratum?.kind !== 'concatenatedPath') {
    throw new Error('Expected symbolic arc frame path.')
  }
  const segment = stratum.segments[0]

  if (segment?.kind !== 'arc' || segment.frame === undefined) {
    throw new Error('Expected symbolic arc frame segment.')
  }
  assert.equal(segment.frame.origin.x, 2)
  assert.equal(segment.frame.origin.symbolic?.x.kind, 'symbolic')
  assert.equal(segment.frame.origin.symbolic.x.previewValue, 2)
  assert.equal(segment.frame.u.symbolic?.x.kind, 'symbolic')
  assert.equal(segment.frame.u.symbolic.x.previewValue, 1)
})

test('parseSavedDiagramJson refreshes symbolic concatenated Bezier control-mode frames', () => {
  const saved = JSON.parse(serializeDiagram(symbolicThreeDimensionalDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'symbolic-segment-frame',
    name: 'Symbolic Segment Frame',
    style: curveStyle(),
    segments: [
      {
        kind: 'cubicBezier',
        start: { x: 3, y: 0, z: 0 },
        control1: { x: 3.5, y: 0, z: 0 },
        control2: { x: 3.5, y: 0, z: 0 },
        end: { x: 4, y: 0, z: 0 },
        controlMode: {
          kind: 'workPlaneRelativeCartesian',
          frame: {
            origin: symbolicPoint(-99, 0, 0, 'R'),
            u: { x: 1, y: 0, z: 0 },
            v: { x: 0, y: 1, z: 0 },
            normal: { x: 0, y: 0, z: 1 },
          },
          localStart: { a: 1, b: 0 },
          localEnd: { a: 2, b: 0 },
          firstControlOffset: { dx: 0.5, dy: 0 },
          secondControlOffset: { dx: -0.5, dy: 0 },
          secondOffsetReference: 'end',
        },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const stratum = parsed.diagram.strata.find(
    (candidate) => candidate.id === 'symbolic-segment-frame',
  )

  if (stratum?.kind !== 'concatenatedPath') {
    throw new Error('Expected symbolic Bezier frame path.')
  }
  const segment = stratum.segments[0]

  if (
    segment?.kind !== 'cubicBezier' ||
    segment.controlMode?.kind !== 'workPlaneRelativeCartesian'
  ) {
    throw new Error('Expected symbolic Bezier frame control mode.')
  }
  assert.equal(segment.controlMode.frame.origin.x, 2)
  assert.equal(segment.controlMode.frame.origin.symbolic?.x.kind, 'symbolic')
  assert.equal(segment.controlMode.frame.origin.symbolic.x.previewValue, 2)
})

test('parseSavedDiagramJson refreshes symbolic curved sheet frames for mesh previews', () => {
  const saved = JSON.parse(serializeDiagram(symbolicThreeDimensionalDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    id: 'symbolic-curved-frame',
    name: 'Symbolic Curved Frame',
    style: sheetStyle(),
    primitive: {
      kind: 'saddle',
      frame: {
        origin: symbolicPoint(-99, 0, 0, 'R'),
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: {
          x: 0,
          y: 0,
          z: -99,
          symbolic: {
            x: { kind: 'numeric', value: 0 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'symbolic', expression: '1', previewValue: -99 },
          },
        },
      },
      width: 2,
      depth: 2,
      height: 1,
      sampling: { uSegments: 2, vSegments: 2 },
    },
    layer: 0,
  })

  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const stratum = parsed.diagram.strata.find(
    (candidate) => candidate.id === 'symbolic-curved-frame',
  )

  if (stratum?.kind !== 'curvedSheet' || stratum.primitive.kind !== 'saddle') {
    throw new Error('Expected symbolic saddle frame sheet.')
  }
  assert.equal(stratum.primitive.frame.origin.x, 2)
  assert.equal(stratum.primitive.frame.origin.symbolic?.x.kind, 'symbolic')
  assert.equal(stratum.primitive.frame.normal.z, 1)
  assert.equal(stratum.primitive.frame.normal.symbolic?.z.kind, 'symbolic')
  assert.equal(stratum.primitive.frame.normal.symbolic.z.previewValue, 1)

  const tikz = generateTikz(parsed.diagram, { exportMode: 'inlineMath' })

  assert.doesNotMatch(tikz, /NaN|Infinity/)
  assert.doesNotMatch(tikz, /\n\s*\n/)
})

test('parseSavedDiagramJson rejects unresolved symbolic frame variables cleanly', () => {
  const saved = JSON.parse(serializeDiagram(symbolicThreeDimensionalDiagram())) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    id: 'unresolved-symbolic-frame',
    name: 'Unresolved Symbolic Frame',
    style: sheetStyle(),
    primitive: {
      kind: 'saddle',
      frame: {
        origin: symbolicPoint(2, 0, 0, 'Missing'),
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
      width: 2,
      depth: 2,
      height: 1,
      sampling: { uSegments: 2, vSegments: 2 },
    },
    layer: 0,
  })

  assertParseError(
    parseSavedDiagramJson(JSON.stringify(saved)),
    /primitive\.frame\.origin\.symbolic\.x\.expression Unknown variable "Missing"/,
  )
})

test('existing numeric coordinate input remains numeric-only in the model', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: '1.5',
    y: '-2',
    z: 'R',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected numeric point creation to succeed.')
  }

  const point = findPoint(result.diagram, result.id)

  assert.deepEqual(point.position, { x: 1.5, y: -2, z: 0 })
})

test('inline math output with symbolic coordinates has no blank lines', () => {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const tikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })

  assert.doesNotMatch(tikz, /\n\s*\n/)
  assert.match(tikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
})

test('numeric work-plane-local coordinate evaluates to a finite global preview', () => {
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    localCoordinateSource({
      frame: xyFrame({ x: 1, y: 2, z: 3 }),
      a: numericScalar(4),
      b: numericScalar(-1),
    }),
  )

  assert.equal(evaluated.ok, true)
  if (!evaluated.ok) {
    throw new Error(evaluated.errors[0]?.message ?? 'Expected evaluation.')
  }

  assert.deepEqual(evaluated.point, { x: 5, y: 1, z: 3 })
})

test('symbolic work-plane-local coordinate evaluates with variables', () => {
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    localCoordinateSource({
      frame: xyFrame(),
      a: symbolicScalar('R*cos(q)', Math.sqrt(3)),
      b: symbolicScalar('R*sin(q)', 1),
    }),
    symbolicContext([
      ['R', 2],
      ['q', 30],
    ]),
  )

  assert.equal(evaluated.ok, true)
  if (!evaluated.ok) {
    throw new Error(evaluated.errors[0]?.message ?? 'Expected evaluation.')
  }

  assertClose(evaluated.point.x, Math.sqrt(3))
  assertClose(evaluated.point.y, 1)
  assert.equal(evaluated.point.z, 0)
})

test('work-plane-local variable detection finds local and frame variables', () => {
  const detected = detectWorkPlaneLocalCoordinateVariables(
    localCoordinateSource({
      frame: {
        ...xyFrame(symbolicPoint(2, 0, 0, 'R')),
        u: symbolicPoint(1, 0, 0, '1'),
      },
      a: symbolicScalar('R*cos(q)', Math.sqrt(3)),
      b: symbolicScalar('sqrt(R) + sin(q)', Math.sqrt(2) + 0.5),
    }),
  )

  assert.equal(detected.ok, true)
  if (!detected.ok) {
    throw new Error(detected.errors[0]?.message ?? 'Expected detection.')
  }

  assert.deepEqual(detected.variables, ['R', 'q'])
})

test('work-plane-local source rejects unknown variables', () => {
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    localCoordinateSource({
      frame: xyFrame(),
      a: symbolicScalar('Missing', 0),
      b: numericScalar(0),
    }),
    symbolicContext([]),
  )

  assert.equal(evaluated.ok, false)
  if (evaluated.ok) {
    throw new Error('Expected unknown variable rejection.')
  }
  assert.match(
    evaluated.errors[0]?.message ?? '',
    /Unknown variable "Missing"/,
  )
})

test('work-plane-local coordinate evaluates symbolic frame origin', () => {
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    localCoordinateSource({
      frame: xyFrame(symbolicPoint(2, 0, 0, 'R')),
      a: numericScalar(1),
      b: numericScalar(2),
    }),
    symbolicContext([['R', 2]]),
  )

  assert.equal(evaluated.ok, true)
  if (!evaluated.ok) {
    throw new Error(evaluated.errors[0]?.message ?? 'Expected evaluation.')
  }

  assert.deepEqual(evaluated.point, { x: 3, y: 2, z: 0 })
})

test('work-plane-local source rejects invalid frames', () => {
  const evaluated = evaluateWorkPlaneLocalCoordinate(
    localCoordinateSource({
      frame: {
        ...xyFrame(),
        u: { x: 2, y: 0, z: 0 },
      },
      a: numericScalar(0),
      b: numericScalar(0),
    }),
  )

  assert.equal(evaluated.ok, false)
  if (evaluated.ok) {
    throw new Error('Expected invalid frame rejection.')
  }
  assert.match(evaluated.errors[0]?.message ?? '', /Work-plane frame is invalid/)
})

test('work-plane-local source rejects non-finite local scalars', () => {
  const evaluated = evaluateWorkPlaneLocalCoordinate({
    kind: 'workPlaneLocal',
    frame: xyFrame(),
    local: {
      a: { kind: 'numeric', value: Number.POSITIVE_INFINITY },
      b: numericScalar(0),
    },
  })

  assert.equal(evaluated.ok, false)
  if (evaluated.ok) {
    throw new Error('Expected non-finite scalar rejection.')
  }
  assert.match(evaluated.errors[0]?.path ?? '', /local\.a\.value/)
})

test('work-plane-local source save and load round-trip preserves local expressions', () => {
  const diagram = symbolicThreeDimensionalDiagramWithRq()
  const position = workPlaneLocalPoint(
    Math.sqrt(3),
    1,
    0,
    localCoordinateSource({
      frame: xyFrame(),
      a: symbolicScalar('R*cos(q)', Math.sqrt(3)),
      b: symbolicScalar('R*sin(q)', 1),
    }),
  )
  diagram.strata.push({
    id: 'local-symbolic-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Local Symbolic Point',
    style: pointStyle(),
    position,
    layer: 0,
  })

  const parsed = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const point = findPoint(parsed.diagram, 'local-symbolic-point')
  const source = point.position.symbolic?.source

  assert.equal(source?.kind, 'workPlaneLocal')
  assert.equal(source?.local.a.kind, 'symbolic')
  assert.equal(source?.local.a.kind === 'symbolic' ? source.local.a.expression : '', 'R*cos(q)')
  assert.equal(source?.local.b.kind, 'symbolic')
  assert.equal(source?.local.b.kind === 'symbolic' ? source.local.b.expression : '', 'R*sin(q)')
  assertClose(point.position.x, Math.sqrt(3))
  assertClose(point.position.y, 1)
})

test('work-plane-local source variables use import variable-resolution flow', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'import-local-symbolic-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Import Local Symbolic Point',
    style: pointStyle(),
    position: workPlaneLocalPoint(
      Math.sqrt(3),
      1,
      0,
      localCoordinateSource({
        frame: xyFrame(),
        a: symbolicScalar('R*cos(q)', Math.sqrt(3)),
        b: symbolicScalar('R*sin(q)', 1),
      }),
    ),
    layer: 0,
  })

  const pending = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(pending.ok, true)
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

  const resolved = resolvePendingSymbolicDiagramImport(
    pending.pendingImport,
    [
      { name: 'R', expression: '2' },
      { name: 'q', expression: '30' },
    ],
  )

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }
  assertClose(
    findPoint(resolved.diagram, 'import-local-symbolic-point').position.x,
    Math.sqrt(3),
  )
})

test('variable updates recompute work-plane-local coordinate previews', () => {
  const diagram = symbolicThreeDimensionalDiagram()
  diagram.strata.push({
    id: 'local-variable-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Local Variable Point',
    style: pointStyle(),
    position: localXPoint(2, 0, 0, 'R'),
    layer: 0,
  })

  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(diagram, 'var-R', {
      expression: '4',
    }),
  )
  const point = findPoint(updated, 'local-variable-point')
  const source = point.position.symbolic?.source

  assert.equal(point.position.x, 4)
  assert.equal(point.position.y, 0)
  assert.equal(source?.local.a.kind, 'symbolic')
  if (source?.local.a.kind !== 'symbolic') {
    throw new Error('Expected symbolic local a coordinate.')
  }
  assert.equal(source.local.a.previewValue, 4)
  assert.doesNotMatch(serializeDiagram(updated), /NaN|Infinity/)
})

test('JSON import detects variables in work-plane-local frame fields', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'import-local-frame-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Import Local Frame Point',
    style: pointStyle(),
    position: workPlaneLocalPoint(
      3,
      0,
      0,
      localCoordinateSource({
        frame: xyFrame(symbolicPoint(2, 0, 0, 'Offset')),
        a: numericScalar(1),
        b: numericScalar(0),
      }),
    ),
    layer: 0,
  })

  const pending = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected work-plane-local frame variable resolution.')
  }
  assert.deepEqual(
    pending.pendingImport.variables.map((variable) => ({
      name: variable.name,
      expression: variable.expression,
      defined: variable.defined,
    })),
    [{ name: 'Offset', expression: '', defined: false }],
  )

  const resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
    { name: 'Offset', expression: '4' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }
  assert.equal(findPoint(resolved.diagram, 'import-local-frame-point').position.x, 5)
})

test('JSON import rejects unsupported nested work-plane-local sources', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '4',
        previewValue: 4,
      },
    ],
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'point-with-unsupported-local',
    codim: 3,
    geometricKind: 'point',
    name: 'Point With Unsupported Local',
    style: pointStyle(),
    position: { x: 0, y: 0, z: 0 },
    layer: 0,
  })
  const saved = JSON.parse(serializeDiagram(diagram)) as MutableSavedDiagramFile
  const point = saved.diagram.strata[0] as unknown as Record<string, unknown>

  point.unsupportedLocal = localCoordinateSource({
    frame: xyFrame(),
    a: symbolicScalar('R', 2),
    b: numericScalar(0),
  })

  const pending = parseSavedDiagramJsonForImport(JSON.stringify(saved))

  assert.equal(pending.ok, false)
  if (pending.ok) {
    throw new Error('Expected unsupported local source rejection.')
  }
  assert.match(
    pending.error,
    /strata\[0\]\.unsupportedLocal Unsupported work-plane-local coordinate source/,
  )
})

test('JSON import rejects unsupported nested symbolic scalars instead of collecting them', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'point-with-unsupported-symbolic',
    codim: 3,
    geometricKind: 'point',
    name: 'Point With Unsupported Symbolic',
    style: pointStyle(),
    position: { x: 0, y: 0, z: 0 },
    layer: 0,
  })
  const saved = JSON.parse(serializeDiagram(diagram)) as MutableSavedDiagramFile
  const point = saved.diagram.strata[0] as unknown as Record<string, unknown>

  point.metadata = {
    unsupportedSymbolic: symbolicScalar('R', 2),
  }

  const pending = parseSavedDiagramJsonForImport(JSON.stringify(saved))

  assert.equal(pending.ok, false)
  if (pending.ok) {
    throw new Error('Expected unsupported symbolic source rejection.')
  }
  assert.match(
    pending.error,
    /strata\[0\]\.metadata\.unsupportedSymbolic Unsupported symbolic coordinate source/,
  )
})

test('pending symbolic import refreshes supported global stale previews', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'stale-supported-global-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Stale Supported Global Point',
    style: pointStyle(),
    position: symbolicPoint(2, 0, 0, 'R'),
    layer: 0,
  })

  const pending = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected symbolic variable resolution.')
  }

  const resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
    { name: 'R', expression: '4' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }
  const point = findPoint(resolved.diagram, 'stale-supported-global-point')

  assert.equal(point.position.x, 4)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(
    point.position.symbolic?.x.kind === 'symbolic'
      ? point.position.symbolic.x.previewValue
      : Number.NaN,
    4,
  )
})

test('pending symbolic import refreshes supported work-plane-local stale previews', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'stale-supported-local-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Stale Supported Local Point',
    style: pointStyle(),
    position: localXPoint(2, 0, 0, 'R'),
    layer: 0,
  })

  const pending = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected work-plane-local variable resolution.')
  }

  const resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
    { name: 'R', expression: '4' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }
  const point = findPoint(resolved.diagram, 'stale-supported-local-point')
  const source = point.position.symbolic?.source

  assert.equal(point.position.x, 4)
  assert.equal(source?.local.a.kind, 'symbolic')
  assert.equal(
    source?.local.a.kind === 'symbolic'
      ? source.local.a.previewValue
      : Number.NaN,
    4,
  )
})

test('resolvePendingSymbolicDiagramImport reports missing stratum id without throwing', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'malformed-pending-local-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Malformed Pending Local Point',
    style: pointStyle(),
    position: localXPoint(2, 0, 0, 'R'),
    layer: 0,
  })
  const pending = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected pending import.')
  }

  delete (
    pending.pendingImport.diagram.strata[0] as unknown as Record<string, unknown>
  ).id

  let resolved:
    | ReturnType<typeof resolvePendingSymbolicDiagramImport>
    | undefined

  assert.doesNotThrow(() => {
    resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
      { name: 'R', expression: '4' },
    ])
  })
  assert.equal(resolved?.ok, false)
  if (resolved?.ok !== false) {
    throw new Error('Expected pending resolution failure.')
  }
  assert.match(resolved.error, /strata\[0\]\.id Stratum id is missing or invalid/)
  assert.doesNotMatch(resolved.error, /Cannot read properties/)
})

test('resolvePendingSymbolicDiagramImport reports malformed local source without throwing', () => {
  const diagram = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  diagram.strata.push({
    id: 'malformed-pending-source-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Malformed Pending Source Point',
    style: pointStyle(),
    position: localXPoint(2, 0, 0, 'R'),
    layer: 0,
  })
  const pending = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected pending import.')
  }

  const point = findPoint(
    pending.pendingImport.diagram,
    'malformed-pending-source-point',
  )
  const source = point.position.symbolic?.source as unknown as {
    local: Record<string, unknown>
  }

  delete source.local.b

  let resolved:
    | ReturnType<typeof resolvePendingSymbolicDiagramImport>
    | undefined

  assert.doesNotThrow(() => {
    resolved = resolvePendingSymbolicDiagramImport(pending.pendingImport, [
      { name: 'R', expression: '4' },
    ])
  })
  assert.equal(resolved?.ok, false)
  if (resolved?.ok !== false) {
    throw new Error('Expected pending resolution failure.')
  }
  assert.match(
    resolved.error,
    /symbolic\.source\.local\.b Work-plane-local scalar must be a scalar input object/,
  )
})

test('pending symbolic import parsing leaves the current diagram unchanged', () => {
  const currentDiagramBefore = serializeDiagram(emptyTwoDimensionalDiagram)
  const imported = {
    ...emptyThreeDimensionalDiagram,
    strata: [...emptyThreeDimensionalDiagram.strata],
    labels: [...emptyThreeDimensionalDiagram.labels],
  }
  imported.strata.push({
    id: 'uncommitted-local-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Uncommitted Local Point',
    style: pointStyle(),
    position: localXPoint(2, 0, 0, 'R'),
    layer: 0,
  })

  const pending = parseSavedDiagramJsonForImport(serializeDiagram(imported))

  assert.equal(pending.ok, true)
  if (!pending.ok || pending.kind !== 'needsVariableResolution') {
    throw new Error('Expected pending import.')
  }
  assert.equal(serializeDiagram(emptyTwoDimensionalDiagram), currentDiagramBefore)
})

test('path and sheet work-plane-local coordinates refresh with variables', () => {
  const diagram = symbolicThreeDimensionalDiagram()
  diagram.strata.push(
    {
      id: 'local-path-vertex',
      codim: 2,
      geometricKind: 'curve',
      kind: 'concatenatedPath',
      name: 'Local Path Vertex',
      style: curveStyle(),
      segments: [
        {
          kind: 'cubicBezier',
          start: localXPoint(2, 0, 0, 'R'),
          control1: localXPoint(2.5, 0, 0, 'R + .5'),
          control2: localXPoint(3.5, 0, 0, 'R + 1.5'),
          end: localXPoint(4, 0, 0, 'R + 2'),
        },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      id: 'local-sheet-vertex',
      codim: 1,
      geometricKind: 'sheet',
      kind: 'polygonSheet',
      name: 'Local Sheet Vertex',
      style: sheetStyle(),
      vertices: [
        localXPoint(2, 0, 0, 'R'),
        localXPoint(3, 0, 0, 'R + 1'),
        localXPoint(3, 1, 0, 'R + 1'),
        localXPoint(2, 1, 0, 'R'),
      ],
      layer: 0,
    },
  )

  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(diagram, 'var-R', {
      expression: '4',
    }),
  )
  const path = updated.strata.find((stratum) => stratum.id === 'local-path-vertex')
  const sheet = updated.strata.find((stratum) => stratum.id === 'local-sheet-vertex')

  if (path?.kind !== 'concatenatedPath' || path.segments[0]?.kind !== 'cubicBezier') {
    throw new Error('Expected local cubic path.')
  }
  if (sheet?.kind !== 'polygonSheet') {
    throw new Error('Expected local polygon sheet.')
  }

  assert.equal(path.segments[0].start.x, 4)
  assert.equal(path.segments[0].control1.x, 4.5)
  assert.equal(path.segments[0].control2.x, 5.5)
  assert.equal(path.segments[0].end.x, 6)
  assert.equal(sheet.vertices[0]?.x, 4)
  assert.equal(sheet.vertices[1]?.x, 5)
  assert.doesNotMatch(serializeDiagram(updated), /NaN|Infinity/)
})

test('ruled and Coons boundary work-plane-local coordinates refresh with variables', () => {
  const diagram = symbolicThreeDimensionalDiagram()
  diagram.strata.push(localRuledSurfaceStratum(), localCoonsPatchStratum())

  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(diagram, 'var-R', {
      expression: '4',
    }),
  )
  const ruled = updated.strata.find((stratum) => stratum.id === 'local-ruled')
  const coons = updated.strata.find((stratum) => stratum.id === 'local-coons')

  if (
    ruled?.kind !== 'curvedSheet' ||
    ruled.primitive.kind !== 'ruledSurface' ||
    coons?.kind !== 'curvedSheet' ||
    coons.primitive.kind !== 'coonsPatch'
  ) {
    throw new Error('Expected local boundary surfaces.')
  }
  if (
    !('segments' in coons.primitive.bottom) ||
    !('segments' in coons.primitive.right)
  ) {
    throw new Error('Expected Coons path boundaries.')
  }

  assert.equal(ruled.primitive.boundary0.segments[0]?.start.x, 4)
  assert.equal(ruled.primitive.boundary1.segments[0]?.end.x, 5)
  assert.equal(coons.primitive.bottom.segments[0]?.start.x, 4)
  assert.equal(coons.primitive.right.segments[0]?.end.x, 5)
  assert.doesNotMatch(serializeDiagram(updated), /NaN|Infinity/)
})

test('grid frame work-plane-local previews refresh with variables', () => {
  const diagram = symbolicThreeDimensionalDiagram()
  diagram.strata.push({
    id: 'local-grid-frame',
    codim: 2,
    geometricKind: 'curve',
    kind: 'grid',
    name: 'Local Grid Frame',
    style: curveStyle(),
    styleSegments: [],
    frame: {
      kind: 'workPlane',
      frame: {
        origin: localXPoint(2, 0, 0, 'R'),
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
    },
    uRange: scalarRange(0, 1, 1),
    vRange: scalarRange(0, 1, 1),
    clip: scalarClip(0, 1, 0, 1),
    layer: 0,
  })

  const updated = expectVariableDiagramOk(
    updateSymbolicVariableInDiagram(diagram, 'var-R', {
      expression: '4',
    }),
  )
  const grid = updated.strata.find((stratum) => stratum.id === 'local-grid-frame')

  if (grid?.kind !== 'grid') {
    throw new Error('Expected local grid frame.')
  }
  assert.equal(grid.frame.frame.origin.x, 4)
  assert.equal(grid.frame.frame.origin.symbolic?.source?.local.a.kind, 'symbolic')
  assert.doesNotMatch(serializeDiagram(updated), /NaN|Infinity/)
})

test('old global-coordinate 3D diagram still loads', () => {
  const parsed = parseSavedDiagramJson(serializeDiagram(emptyThreeDimensionalDiagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  assert.equal(parsed.diagram.ambientDimension, 3)
})

test('malformed work-plane-local source returns a clean validation error', () => {
  const diagram = symbolicThreeDimensionalDiagramWithRq()
  const source = localCoordinateSource({
    frame: xyFrame(),
    a: numericScalar(0),
    b: numericScalar(0),
  }) as unknown as { local: Record<string, unknown> }
  delete source.local.b
  diagram.strata.push({
    id: 'malformed-local-source-point',
    codim: 3,
    geometricKind: 'point',
    name: 'Malformed Local Source Point',
    style: pointStyle(),
    position: workPlaneLocalPoint(0, 0, 0, source as WorkPlaneLocalCoordinateSource),
    layer: 0,
  })

  assertParseError(
    parseSavedDiagramJson(serializeDiagram(diagram)),
    /symbolic\.source\.local\.b Work-plane-local scalar must be a scalar input object/,
  )
})

test('work-plane-local variable detection does not treat function names as variables', () => {
  const detected = detectWorkPlaneLocalCoordinateVariables(
    localCoordinateSource({
      frame: xyFrame(),
      a: symbolicScalar('sqrt(R) + sin(q)', Math.sqrt(2) + 0.5),
      b: symbolicScalar('cos(q)', Math.sqrt(3) / 2),
    }),
  )

  assert.equal(detected.ok, true)
  if (!detected.ok) {
    throw new Error(detected.errors[0]?.message ?? 'Expected detection.')
  }

  assert.deepEqual(detected.variables, ['R', 'q'])
})

function localXPoint(
  x: number,
  y: number,
  z: number,
  aExpression: string,
): Vec3 {
  return workPlaneLocalPoint(
    x,
    y,
    z,
    localCoordinateSource({
      frame: xyFrame({ x: 0, y: 0, z }),
      a: symbolicScalar(aExpression, x),
      b: numericScalar(y),
    }),
  )
}

function localRuledSurfaceStratum(): Stratum {
  return {
    id: 'local-ruled',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Local Ruled Surface',
    style: sheetStyle(),
    primitive: {
      kind: 'ruledSurface',
      boundary0: lineBoundarySnapshot(
        'local-ruled-bottom',
        localXPoint(2, 0, 0, 'R'),
        localXPoint(3, 0, 0, 'R + 1'),
      ),
      boundary1: lineBoundarySnapshot(
        'local-ruled-top',
        localXPoint(2, 1, 1, 'R'),
        localXPoint(3, 1, 1, 'R + 1'),
      ),
      sampling: { segments: 2 },
    },
    layer: 0,
  }
}

function localCoonsPatchStratum(): Stratum {
  return {
    id: 'local-coons',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Local Coons Patch',
    style: sheetStyle(),
    primitive: {
      kind: 'coonsPatch',
      bottom: lineBoundarySnapshot(
        'local-coons-bottom',
        localXPoint(2, 0, 0, 'R'),
        localXPoint(3, 0, 0, 'R + 1'),
      ),
      right: lineBoundarySnapshot(
        'local-coons-right',
        localXPoint(3, 0, 0, 'R + 1'),
        localXPoint(3, 1, 0, 'R + 1'),
      ),
      top: lineBoundarySnapshot(
        'local-coons-top',
        localXPoint(2, 1, 0, 'R'),
        localXPoint(3, 1, 0, 'R + 1'),
      ),
      left: lineBoundarySnapshot(
        'local-coons-left',
        localXPoint(2, 0, 0, 'R'),
        localXPoint(2, 1, 0, 'R'),
      ),
      sampling: { uSegments: 2, vSegments: 2 },
    },
    layer: 0,
  }
}

function lineBoundarySnapshot(
  id: string,
  start: Vec3,
  end: Vec3,
): BoundaryPathSnapshot {
  return {
    id,
    segments: [
      {
        kind: 'line',
        start,
        end,
      },
    ],
  }
}

function scalarRange(min: number, max: number, step: number) {
  return {
    min: numericScalar(min),
    max: numericScalar(max),
    step: numericScalar(step),
  }
}

function scalarClip(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
) {
  return {
    kind: 'rectangle' as const,
    uMin: numericScalar(uMin),
    uMax: numericScalar(uMax),
    vMin: numericScalar(vMin),
    vMax: numericScalar(vMax),
  }
}

function symbolicDiagram(): Diagram {
  const withR = expectVariableDiagramOk(
    addSymbolicVariableToDiagram(emptyTwoDimensionalDiagram, variable('var-R', 'R', '2')),
  )

  return expectVariableDiagramOk(
    addSymbolicVariableToDiagram(withR, variable('var-q', 'q', '30')),
  )
}

function symbolicThreeDimensionalDiagram(): Diagram {
  return expectVariableDiagramOk(
    addSymbolicVariableToDiagram(
      emptyThreeDimensionalDiagram,
      variable('var-R', 'R', '2'),
    ),
  )
}

function symbolicThreeDimensionalDiagramWithRq(): Diagram {
  const withR = symbolicThreeDimensionalDiagram()

  return expectVariableDiagramOk(
    addSymbolicVariableToDiagram(withR, variable('var-q', 'q', '30')),
  )
}

function symbolicContext(
  values: readonly (readonly [string, number])[],
): WorkPlaneLocalCoordinateExpressionContext {
  return {
    variableNames: values.map(([name]) => name),
    previewValues: new Map(values),
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

function localCoordinateSource(input: {
  frame: WorkPlaneFrameSnapshot
  a: ScalarInputValue
  b: ScalarInputValue
}): WorkPlaneLocalCoordinateSource {
  return {
    kind: 'workPlaneLocal',
    frame: input.frame,
    local: {
      a: input.a,
      b: input.b,
    },
  }
}

function workPlaneLocalPoint(
  x: number,
  y: number,
  z: number,
  source: WorkPlaneLocalCoordinateSource,
): Vec3 {
  return {
    x,
    y,
    z,
    symbolic: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
      source,
    },
  }
}

type MutableSavedDiagramFile = {
  diagram: Diagram
  [key: string]: unknown
}

function savedSymbolicPointFile(): {
  file: MutableSavedDiagramFile
  diagram: Diagram
  pointId: string
} {
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R*cos(q)',
    y: 'R*sin(q)',
    z: '0',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const file = JSON.parse(serializeDiagram(result.diagram)) as MutableSavedDiagramFile

  return {
    file,
    diagram: file.diagram,
    pointId: result.id,
  }
}

function symbolicX(
  point: PointStratum,
): Extract<CoordinateComponent, { kind: 'symbolic' }> {
  const component = point.position.symbolic?.x

  assert.equal(component?.kind, 'symbolic')
  if (component?.kind !== 'symbolic') {
    throw new Error('Expected symbolic x component.')
  }

  return component
}

function symbolicPoint(
  x: number,
  y: number,
  z: number,
  xExpression: string,
): Vec3 {
  return {
    x,
    y,
    z,
    symbolic: {
      x: {
        kind: 'symbolic',
        expression: xExpression,
        previewValue: x,
      },
      y: {
        kind: 'numeric',
        value: y,
      },
      z: {
        kind: 'numeric',
        value: z,
      },
    },
  }
}

function symbolicScalarArcStratum(radius: ScalarInputValue): Stratum {
  return {
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'symbolic-scalar-arc',
    name: 'Symbolic Scalar Arc',
    style: curveStyle(),
    segments: [
      {
        kind: 'arc',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 1, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        radius,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
      },
    ],
    styleSegments: [],
    layer: 0,
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

function numericScalar(value: number): ScalarInputValue {
  return {
    kind: 'numeric',
    value,
  }
}

function variable(
  id: string,
  name: string,
  expression: string,
): Omit<SymbolicVariable, 'previewValue'> {
  return {
    id,
    name,
    macroName: name,
    expression,
  }
}

function expectVariableDiagramOk(
  result: ReturnType<
    typeof addSymbolicVariableToDiagram | typeof updateSymbolicVariableInDiagram
  >,
): Diagram {
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const point = diagram.strata.find(
    (stratum): stratum is PointStratum =>
      stratum.id === id && stratum.geometricKind === 'point',
  )

  if (point === undefined) {
    throw new Error(`Point ${id} not found.`)
  }

  return point
}

function curveStyle(): CurveStyle {
  return {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
  }
}

function sheetStyle(): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
  }
}

function pointStyle() {
  return {
    kind: 'pointStyle' as const,
    color: '#000000' as const,
    opacity: 1,
    shape: 'circle' as const,
    fill: 'filled' as const,
    size: 3,
  }
}

function squareBoundary3D(id: string, z: number): ClosedPathBoundary {
  const points: [Vec3, Vec3, Vec3, Vec3] = [
    { x: 0, y: 0, z },
    { x: 2, y: 0, z },
    { x: 2, y: 2, z },
    { x: 0, y: 2, z },
  ]

  return {
    id,
    segments: [
      { kind: 'line', start: points[0], end: points[1] },
      { kind: 'line', start: points[1], end: points[2] },
      { kind: 'line', start: points[2], end: points[3] },
      { kind: 'line', start: points[3], end: points[0] },
    ],
  }
}

function assertParseError(
  result: ReturnType<typeof parseSavedDiagramJson>,
  pattern: RegExp,
): void {
  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected saved diagram parsing to fail.')
  }
  assert.match(result.error, pattern)
}

function assertClose(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `Expected ${actual} to be close to ${expected}.`,
  )
}
