import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import {
  areSegmentsComposable,
  normalizePathForAmbientDimension,
  pathEndpoints,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
} from '../../src/model/paths.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type { CurveStratum, Diagram, PathSegment } from '../../src/model/types.ts'

test('valid 2D concatenated path with line and cubic segment validates', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, validation.errors.map((issue) => issue.message).join('\n'))
})

test('valid 3D concatenated path validates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createConcatenatedPathStratum({
      ambientDimension: 3,
      id: 'space-path',
      name: 'Space path',
      segments: [
        {
          kind: 'line',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 1, z: 1 },
        },
        {
          kind: 'cubicBezier',
          start: { x: 1, y: 1, z: 1 },
          control1: { x: 1.5, y: 2, z: 1.5 },
          control2: { x: 2.5, y: 2, z: 2.5 },
          end: { x: 3, y: 1, z: 3 },
        },
      ],
    }),
  )

  assert.equal(validateDiagram(diagram).valid, true)
})

test('empty concatenated path segment list is rejected', () => {
  const validation = validateDiagram(diagramWithPathSegments([]))

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /at least one segment/)
})

test('non-finite concatenated path coordinates are rejected', () => {
  const validation = validateDiagram(
    diagramWithPathSegments([
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: Number.NaN, y: 1, z: 0 },
      },
    ]),
  )

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /finite number/)
})

test('adjacent concatenated path endpoint mismatch is rejected', () => {
  const validation = validateDiagram(
    diagramWithPathSegments([
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1.01, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
      },
    ]),
  )

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /must match/)
})

test('2D concatenated path z coordinates are rejected by validation', () => {
  const validation = validateDiagram(
    diagramWithPathSegments([
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 1 },
      },
    ]),
  )

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /z = 0/)
})

test('polyline conversion produces line segments in order', () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ]
  const segments = pathSegmentsFromPolyline(points)

  assert.deepEqual(segments, [
    { kind: 'line', start: points[0], end: points[1] },
    { kind: 'line', start: points[1], end: points[2] },
  ])
  assert.equal(areSegmentsComposable(segments), true)
  assert.deepEqual(pathEndpoints(segments), {
    start: points[0],
    end: points[2],
  })
})

test('cubic Bezier conversion preserves start, control, and end order', () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: 4, y: 0, z: 0 },
  ]

  assert.deepEqual(pathSegmentsFromCubicBezier(points), [
    {
      kind: 'cubicBezier',
      start: points[0],
      control1: points[1],
      control2: points[2],
      end: points[3],
    },
  ])
})

test('concatenated paths normalize for ambient dimension without mutating input', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 3,
    id: 'normalizable',
    name: 'Normalizable',
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 3 },
        end: { x: 1, y: 0, z: 4 },
      },
    ],
  })

  const normalized = normalizePathForAmbientDimension(path, 2)

  assert.equal(normalized.codim, 1)
  assert.deepEqual(normalized.segments[0], {
    kind: 'line',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1, y: 0, z: 0 },
  })
  assert.equal(path.codim, 2)
  assert.deepEqual(path.segments[0], {
    kind: 'line',
    start: { x: 0, y: 0, z: 3 },
    end: { x: 1, y: 0, z: 4 },
  })
})

test('concatenated path save/load round-trips through JSON', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, diagram)
})

test('invalid persisted concatenated path data is rejected on import', () => {
  const saved = JSON.parse(serializeDiagram(createTwoDimensionalPathDiagram())) as {
    diagram: Diagram
  }
  const path = saved.diagram.strata[0]

  if (path.geometricKind !== 'curve' || path.kind !== 'concatenatedPath') {
    throw new Error('Expected a concatenated path test fixture.')
  }

  path.segments[1] = {
    ...path.segments[1],
    start: { x: 9, y: 9, z: 0 },
  }

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid saved path data to fail.')
  }
  assert.match(result.error, /must match/)
})

test('existing polyline and cubic Bezier curves still validate', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'legacy-polyline',
      name: 'Legacy polyline',
      kind: 'polyline',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'legacy-cubic',
      name: 'Legacy cubic',
      kind: 'cubicBezier',
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: 3, y: 1, z: 0 },
      ],
    }),
  )

  assert.equal(validateDiagram(diagram).valid, true)
})

function createTwoDimensionalPathDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'path-2d',
      name: 'Path 2D',
      pathLabel: 'path 2d',
      segments: [
        {
          kind: 'line',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
        },
        {
          kind: 'cubicBezier',
          start: { x: 1, y: 0, z: 0 },
          control1: { x: 1.5, y: 1, z: 0 },
          control2: { x: 2.5, y: 1, z: 0 },
          end: { x: 3, y: 0, z: 0 },
        },
      ],
    }),
  )

  return diagram
}

function diagramWithPathSegments(segments: PathSegment[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const path: CurveStratum = {
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'invalid-path',
    name: 'Invalid path',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    segments,
    styleSegments: [],
    layer: 0,
  }

  diagram.strata.push(path)
  return diagram
}

function joinValidationMessages(
  errors: ReturnType<typeof validateDiagram>['errors'],
): string {
  return errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}
