import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createTemplatePathStratum,
} from '../../src/model/constructors.ts'
import {
  createCoordinateAnchor,
  symbolicVec3FromVec3,
} from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
} from '../../src/model/coordinateReferences.ts'
import { createArcPathSegmentFromAngles } from '../../src/model/paths.ts'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  CurveStyle,
  Diagram,
  PathArrowOptions,
  PathCrossingState,
  PathInlineNode,
  PathSegment,
  Stratum,
  Vec3,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { pathSplitTargetFromSvgPoint } from '../../src/rendering/svgPathSplitPicking.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import {
  applySplitSelectedPathToEditorState,
  splitSelectedPath,
  type PathSplittingEditorState,
} from '../../src/ui/pathSplitting.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type TestEditorState = PathSplittingEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
}

const splitStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#AA2244',
  strokeOpacity: 0.7,
  lineWidth: 2.5,
  lineStyle: 'dashed',
}

test('split line segment replaces source path with two paths', () => {
  const diagram = diagramWithStrata([
    linePath('source-path', point(0, 0), point(2, 0)),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('source-path'),
    { segmentIndex: 0, t: 0.25 },
    { firstId: 'first-path', secondId: 'second-path' },
  )
  const first = expectSplitPath(result, 'first-path')
  const second = expectSplitPath(result, 'second-path')

  assert.equal(result.diagram.strata.some((stratum) => stratum.id === 'source-path'), false)
  assert.equal(first.segments[0]?.kind, 'line')
  assert.equal(second.segments[0]?.kind, 'line')
  assertPointNear(first.segments[0]?.start, point(0, 0))
  assertPointNear(first.segments[0]?.end, point(0.5, 0))
  assertPointNear(second.segments[0]?.start, point(0.5, 0))
  assertPointNear(second.segments[0]?.end, point(2, 0))
})

test('split polyline interior segment keeps earlier and later line segments', () => {
  const diagram = diagramWithStrata([
    createCurveStratum({
      ambientDimension: 2,
      id: 'poly-path',
      name: 'Polyline',
      points: [point(0, 0), point(1, 0), point(3, 0)],
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('poly-path'),
    { segmentIndex: 1, t: 0.5 },
    { firstId: 'poly-first', secondId: 'poly-second' },
  )
  const first = expectSplitPath(result, 'poly-first')
  const second = expectSplitPath(result, 'poly-second')

  assert.equal(first.segments.length, 2)
  assert.equal(second.segments.length, 1)
  assertPointNear(first.segments[0]?.start, point(0, 0))
  assertPointNear(first.segments[0]?.end, point(1, 0))
  assertPointNear(first.segments[1]?.start, point(1, 0))
  assertPointNear(first.segments[1]?.end, point(2, 0))
  assertPointNear(second.segments[0]?.start, point(2, 0))
  assertPointNear(second.segments[0]?.end, point(3, 0))
})

test('split cubic Bezier uses De Casteljau controls', () => {
  const diagram = diagramWithStrata([
    createCurveStratum({
      ambientDimension: 2,
      id: 'cubic-path',
      kind: 'cubicBezier',
      name: 'Cubic',
      points: [point(0, 0), point(0, 3), point(3, 3), point(3, 0)],
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('cubic-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'cubic-first', secondId: 'cubic-second' },
  )
  const first = expectSplitPath(result, 'cubic-first')
  const second = expectSplitPath(result, 'cubic-second')
  const left = expectCubic(first.segments[0])
  const right = expectCubic(second.segments[0])

  assertPointNear(left.start, point(0, 0))
  assertPointNear(left.control1, point(0, 1.5))
  assertPointNear(left.control2, point(0.75, 2.25))
  assertPointNear(left.end, point(1.5, 2.25))
  assertPointNear(right.start, point(1.5, 2.25))
  assertPointNear(right.control1, point(2.25, 2.25))
  assertPointNear(right.control2, point(3, 1.5))
  assertPointNear(right.end, point(3, 0))
  assert.deepEqual(left.controlMode, { kind: 'absolute' })
  assert.deepEqual(right.controlMode, { kind: 'absolute' })
})

test('split numeric arc segment preserves arc metadata', () => {
  const arc = createArcPathSegmentFromAngles({
    center: point(0, 0),
    radius: 1,
    startAngleDeg: 0,
    endAngleDeg: 90,
    direction: 'counterclockwise',
    ambientDimension: 2,
  })

  if (arc === null) {
    throw new Error('Expected test arc.')
  }

  const diagram = diagramWithStrata([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'arc-path',
      segments: [arc],
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('arc-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'arc-first', secondId: 'arc-second' },
  )
  const first = expectArc(expectSplitPath(result, 'arc-first').segments[0])
  const second = expectArc(expectSplitPath(result, 'arc-second').segments[0])

  assert.equal(first.startAngleDeg, 0)
  assert.equal(first.endAngleDeg, 45)
  assert.equal(second.startAngleDeg, 45)
  assert.equal(second.endAngleDeg, 90)
  assert.equal(first.direction, 'counterclockwise')
  assert.equal(second.direction, 'counterclockwise')
  assertPointNear(first.end, point(Math.SQRT1_2, Math.SQRT1_2))
  assertPointNear(second.start, point(Math.SQRT1_2, Math.SQRT1_2))
})

test('split rejects unsupported template paths cleanly', () => {
  const diagram = diagramWithStrata([
    createTemplatePathStratum({
      ambientDimension: 2,
      id: 'circle-template',
      template: {
        kind: 'circleTemplate',
        center: point(0, 0),
        radius: 1,
      },
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('circle-template'),
    { segmentIndex: 0, t: 0.5 },
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected template split rejection.')
  }
  assert.equal(result.error, 'unsupportedTemplatePath')
})

test('split keep-original option controls source removal', () => {
  const diagram = diagramWithStrata([
    linePath('source-path', point(0, 0), point(2, 0)),
  ])
  const destructive = splitSelectedPath(
    diagram,
    selection('source-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'first-destructive', secondId: 'second-destructive' },
  )
  const kept = splitSelectedPath(
    diagram,
    selection('source-path'),
    { segmentIndex: 0, t: 0.5 },
    {
      keepOriginal: true,
      firstId: 'first-kept',
      secondId: 'second-kept',
    },
  )

  assert.equal(destructive.ok, true)
  assert.equal(kept.ok, true)
  assert.equal(
    destructive.diagram.strata.some((stratum) => stratum.id === 'source-path'),
    false,
  )
  assert.equal(
    kept.diagram.strata.some((stratum) => stratum.id === 'source-path'),
    true,
  )
})

test('split creates unique ids when requested ids collide', () => {
  const diagram = diagramWithStrata([
    linePath('source-path', point(0, 0), point(2, 0)),
    linePath('source-path-part-a-1', point(0, 1), point(1, 1)),
    linePath('source-path-part-b-1', point(0, 2), point(1, 2)),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('source-path'),
    { segmentIndex: 0, t: 0.5 },
    {
      firstId: 'source-path',
      secondId: 'source-path-part-a-2',
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected split success.')
  }
  assert.equal(result.firstId, 'source-path-part-a-2')
  assert.equal(result.secondId, 'source-path-part-b-2')
  assert.notEqual(result.firstId, result.secondId)
})

test('split applies path style and preserves segment style overrides', () => {
  const diagram = diagramWithStrata([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'styled-path',
      style: splitStyle,
      segments: [
        {
          kind: 'line',
          start: point(0, 0),
          end: point(2, 0),
          styleOverride: {
            lineStyle: 'dotted',
            strokeOpacity: 0.4,
          },
        },
      ],
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('styled-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'styled-first', secondId: 'styled-second' },
  )
  const first = expectSplitPath(result, 'styled-first')
  const second = expectSplitPath(result, 'styled-second')

  assert.deepEqual(first.style, splitStyle)
  assert.deepEqual(second.style, splitStyle)
  assert.deepEqual(first.segments[0]?.styleOverride, {
    lineStyle: 'dotted',
    strokeOpacity: 0.4,
  })
  assert.deepEqual(second.segments[0]?.styleOverride, {
    lineStyle: 'dotted',
    strokeOpacity: 0.4,
  })
})

test('split preserves coordinateRef endpoints and creates finite numeric split point', () => {
  const diagram = diagramWithCoordinateAnchors([
    { id: 'coord-a', name: 'A', point: point(0, 0) },
    { id: 'coord-b', name: 'B', point: point(2, 0) },
  ])
  diagram.strata.push(
    linePath(
      'ref-path',
      coordinateReferencePoint(diagram, 'coord-a'),
      coordinateReferencePoint(diagram, 'coord-b'),
    ),
  )

  const result = splitSelectedPath(
    diagram,
    selection('ref-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'ref-first', secondId: 'ref-second' },
  )
  const first = expectSplitPath(result, 'ref-first')
  const second = expectSplitPath(result, 'ref-second')
  const firstLine = expectLine(first.segments[0])
  const secondLine = expectLine(second.segments[0])

  assert.equal(
    coordinateReferenceSourceForPoint(firstLine.start)?.coordinateId,
    'coord-a',
  )
  assert.equal(coordinateReferenceSourceForPoint(firstLine.end), null)
  assert.equal(coordinateReferenceSourceForPoint(secondLine.start), null)
  assert.equal(
    coordinateReferenceSourceForPoint(secondLine.end)?.coordinateId,
    'coord-b',
  )
  assertPointNear(firstLine.end, point(1, 0))
  assertPointNear(secondLine.start, point(1, 0))
  assert.ok(isFinitePoint(firstLine.end))
  assert.ok(isFinitePoint(secondLine.start))
})

test('split redistributes inline nodes and drops nodes at the split point', () => {
  const inlineNodes: PathInlineNode[] = [
    inlineNode('before-segment', 0, 0.5),
    inlineNode('before-split', 1, 0.25),
    inlineNode('at-split', 1, 0.5),
    inlineNode('after-split', 1, 0.75),
    inlineNode('after-segment', 2, 0.5),
  ]
  const diagram = diagramWithStrata([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'node-path',
      segments: [
        lineSegment(point(0, 0), point(1, 0)),
        lineSegment(point(1, 0), point(2, 0)),
        lineSegment(point(2, 0), point(3, 0)),
      ],
      inlineNodes,
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('node-path'),
    { segmentIndex: 1, t: 0.5 },
    { firstId: 'node-first', secondId: 'node-second' },
  )
  const first = expectSplitPath(result, 'node-first')
  const second = expectSplitPath(result, 'node-second')

  assert.deepEqual(first.inlineNodes?.map((node) => node.id), [
    'before-segment',
    'before-split',
  ])
  assert.deepEqual(
    first.inlineNodes?.map((node) => node.position),
    [
      { kind: 'segment', segmentIndex: 0, value: 0.5 },
      { kind: 'segment', segmentIndex: 1, value: 0.5 },
    ],
  )
  assert.deepEqual(second.inlineNodes?.map((node) => node.id), [
    'after-split',
    'after-segment',
  ])
  assert.deepEqual(
    second.inlineNodes?.map((node) => node.position),
    [
      { kind: 'segment', segmentIndex: 0, value: 0.5 },
      { kind: 'segment', segmentIndex: 1, value: 0.5 },
    ],
  )
})

test('split adjusts endpoint arrows and drops mid-arrow decorations', () => {
  const arrows: PathArrowOptions = {
    endpoint: 'both',
    mid: {
      enabled: true,
      position: 0.35,
      direction: 'forward',
      head: 'stealth',
    },
  }
  const diagram = diagramWithStrata([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'arrow-path',
      segments: [lineSegment(point(0, 0), point(2, 0))],
      arrows,
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('arrow-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'arrow-first', secondId: 'arrow-second' },
  )
  const first = expectSplitPath(result, 'arrow-first')
  const second = expectSplitPath(result, 'arrow-second')

  assert.equal(first.arrows?.endpoint, 'backward')
  assert.equal(second.arrows?.endpoint, 'forward')
  assert.equal(first.arrows?.mid.enabled, false)
  assert.equal(second.arrows?.mid.enabled, false)
})

test('split cleans crossing states involving removed original path', () => {
  const diagram = diagramWithStrata([
    linePath('source-path', point(0, 0), point(2, 0)),
    linePath('other-path', point(1, -1), point(1, 1)),
  ])
  diagram.pathCrossings = [crossingState('source-path', 'other-path')]

  const result = splitSelectedPath(
    diagram,
    selection('source-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'crossing-first', secondId: 'crossing-second' },
  )

  assert.equal(result.ok, true)
  assert.equal(result.diagram.pathCrossings, undefined)
})

test('split works with undo and redo', () => {
  const initialDiagram = diagramWithStrata([
    linePath('source-path', point(0, 0), point(2, 0)),
  ])
  const initial = createTestEditorState(initialDiagram, selection('source-path'))
  const split = applySplitSelectedPathToEditorState(
    initial,
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'undo-first', secondId: 'undo-second' },
  )
  const undone = undoLastDiagramChange(split)
  const redone = redoLastDiagramChange(undone)

  assert.equal(split.editableDiagram.strata.some((stratum) => stratum.id === 'undo-first'), true)
  assert.deepEqual(undone.editableDiagram, initialDiagram)
  assert.deepEqual(redone.editableDiagram, split.editableDiagram)
})

test('split output validates and exports readable TikZ without inline blank lines', () => {
  const diagram = diagramWithStrata([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'tikz-path',
      style: splitStyle,
      segments: [lineSegment(point(0, 0), point(2, 0))],
      inlineNodes: [inlineNode('left-node', 0, 0.25), inlineNode('right-node', 0, 0.75)],
    }),
  ])
  const result = splitSelectedPath(
    diagram,
    selection('tikz-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'tikz-first', secondId: 'tikz-second' },
  )
  const validation = validateDiagram(result.diagram)
  const tikz = generateTikz(result.diagram)
  const inlineTikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })

  assert.equal(validation.valid, true)
  assert.match(tikz, /\\draw\[/)
  assert.match(tikz, /node\[pos=0\.5, above\]/)
  assert.doesNotMatch(tikz, /omitted because/)
  expectNoBlankLines(inlineTikz)
})

test('preview split picker returns segment-local target for a line click', () => {
  const curve = linePath('pick-path', point(0, 0), point(2, 0))
  const target = pathSplitTargetFromSvgPoint(
    curve,
    2,
    { mode: '2d', scale: 10, origin: { x: 0, y: 0 } },
    100,
    { x: 5, y: 100 },
  )

  assert.equal(target?.segmentIndex, 0)
  assertNear(target?.t, 0.25)
})

function diagramWithStrata(strata: Stratum[]): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata,
  }
}

function diagramWithCoordinateAnchors(
  anchors: Array<{ id: string; name: string; point: Vec3 }>,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = anchors.map((anchor) =>
    createCoordinateAnchor(diagram, {
      id: anchor.id,
      name: anchor.name,
      tikzName: anchor.name,
      position: {
        kind: 'global',
        value: symbolicVec3FromVec3(anchor.point),
      },
    }),
  )

  return diagram
}

function linePath(id: string, start: Vec3, end: Vec3): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    name: id,
    points: [start, end],
  })
}

function lineSegment(start: Vec3, end: Vec3): PathSegment {
  return {
    kind: 'line',
    start,
    end,
  }
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function selection(id: string): SelectedElement {
  return { kind: 'stratum', id }
}

function expectSplitPath(
  result: ReturnType<typeof splitSelectedPath>,
  id: string,
): ConcatenatedPathStratum {
  assert.equal(result.ok, true)

  const path = result.diagram.strata.find(
    (stratum): stratum is ConcatenatedPathStratum =>
      stratum.id === id &&
      stratum.geometricKind === 'curve' &&
      stratum.kind === 'concatenatedPath',
  )

  if (path === undefined) {
    throw new Error(`Expected split path ${id}.`)
  }

  return path
}

function expectLine(segment: PathSegment | undefined): Extract<PathSegment, { kind: 'line' }> {
  if (segment?.kind !== 'line') {
    throw new Error('Expected line segment.')
  }

  return segment
}

function expectCubic(
  segment: PathSegment | undefined,
): Extract<PathSegment, { kind: 'cubicBezier' }> {
  if (segment?.kind !== 'cubicBezier') {
    throw new Error('Expected cubic segment.')
  }

  return segment
}

function expectArc(segment: PathSegment | undefined): Extract<PathSegment, { kind: 'arc' }> {
  if (segment?.kind !== 'arc') {
    throw new Error('Expected arc segment.')
  }

  return segment
}

function coordinateReferencePoint(diagram: Diagram, coordinateId: string): Vec3 {
  const pointForCoordinate = coordinateReferenceVec3ForAnchorId(
    diagram,
    coordinateId,
  )

  if (pointForCoordinate === null) {
    throw new Error(`Expected coordinate ${coordinateId}.`)
  }

  return pointForCoordinate
}

function inlineNode(
  id: string,
  segmentIndex: number,
  value: number,
): PathInlineNode {
  return {
    id,
    position: {
      kind: 'segment',
      segmentIndex,
      value,
    },
    text: `$${id}$`,
    options: {
      placement: 'above',
    },
  }
}

function crossingState(pathAId: string, pathBId: string): PathCrossingState {
  return {
    id: `${pathAId}-${pathBId}-crossing`,
    pathAId,
    pathBId,
    point: point(1, 0),
    parameterA: 0.5,
    parameterB: 0.5,
    kind: 'braiding',
  }
}

function createTestEditorState(
  diagram: Diagram,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter = allLayersFilter,
): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement,
    layerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: '',
    history: createDiagramHistory(diagram),
  }
}

function assertPointNear(
  actual: Vec3 | undefined,
  expected: Vec3,
  epsilon = 1e-9,
): void {
  if (actual === undefined) {
    throw new Error('Expected point.')
  }

  assertNear(actual.x, expected.x, epsilon)
  assertNear(actual.y, expected.y, epsilon)
  assertNear(actual.z, expected.z, epsilon)
}

function assertNear(
  actual: number | undefined,
  expected: number,
  epsilon = 1e-9,
): void {
  if (actual === undefined) {
    throw new Error('Expected number.')
  }

  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}.`,
  )
}

function isFinitePoint(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function expectNoBlankLines(tikz: string): void {
  assert.doesNotMatch(tikz, /\n\s*\n/)
}
