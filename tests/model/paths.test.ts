import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createTemplatePathStratum,
} from '../../src/model/constructors.ts'
import {
  MAX_TEMPLATE_PATH_SAMPLES,
  areSegmentsComposable,
  normalizePathForAmbientDimension,
  pathEndpoints,
  pathSegmentStyleRuns,
  pathSegmentsFromCubicBezier,
  pathSegmentsFromPolyline,
  reverseBoundaryPathSnapshot,
  reverseCurvePathDirection,
  resolvePathSegmentStyle,
  sampleTemplatePathPoints,
} from '../../src/model/paths.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { removeSelectedElement } from '../../src/ui/diagramUpdates.ts'
import type {
  BoundaryPathSnapshot,
  CurveStratum,
  Diagram,
  PathSegment,
  PathSegmentStyleOverride,
} from '../../src/model/types.ts'

test('valid 2D concatenated path with line and cubic segment validates', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, validation.errors.map((issue) => issue.message).join('\n'))
})

test('path inline node validates with pos 0.5', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const curve = diagram.strata[0]

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  curve.inlineNodes = [
    {
      id: 'inline-node-valid',
      position: { kind: 'segment', segmentIndex: 0, value: 0.5 },
      text: '$f$',
      options: { placement: 'above' },
    },
  ]

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, joinValidationMessages(validation.errors))
})

test('path inline node rejects invalid boundary positions', () => {
  const invalidValues = [0, 1]

  invalidValues.forEach((value) => {
    const diagram = createTwoDimensionalPathDiagram()
    const curve = diagram.strata[0]

    if (curve?.geometricKind !== 'curve') {
      throw new Error('Expected curve.')
    }

    curve.inlineNodes = [
      {
        id: `inline-node-${value}`,
        position: { kind: 'segment', segmentIndex: 0, value },
        text: '',
        options: {},
      },
    ]

    const validation = validateDiagram(diagram)

    assert.equal(validation.valid, false)
    assert.match(joinValidationMessages(validation.errors), /0 < value < 1/)
  })
})

test('path inline nodes round trip through save and load', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const curve = diagram.strata[0]

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  curve.inlineNodes = [
    {
      id: 'inline-node-roundtrip',
      position: { kind: 'segment', segmentIndex: 1, value: 0.25 },
      text: '$g$',
      options: {
        placement: 'below',
        sloped: true,
        allowUpsideDown: true,
      },
    },
  ]

  const parsed = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const loadedCurve = parsed.diagram.strata[0]

  assert.equal(loadedCurve?.geometricKind, 'curve')
  if (loadedCurve?.geometricKind !== 'curve') {
    throw new Error('Expected loaded curve.')
  }
  assert.deepEqual(loadedCurve.inlineNodes, curve.inlineNodes)
})

test('deleting a path removes its attached inline nodes with the path', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const curve = diagram.strata[0]

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  curve.inlineNodes = [
    {
      id: 'inline-node-delete',
      position: { kind: 'segment', segmentIndex: 0, value: 0.5 },
      text: '',
      options: { marker: 'dot' },
    },
  ]

  const result = removeSelectedElement(diagram, {
    kind: 'stratum',
    id: curve.id,
  })

  assert.equal(result.removed, true)
  assert.equal(
    result.diagram.strata.some(
      (stratum) =>
        stratum.geometricKind === 'curve' &&
        stratum.inlineNodes?.some((node) => node.id === 'inline-node-delete') ===
          true,
    ),
    false,
  )
  assert.equal(validateDiagram(result.diagram).valid, true)
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

test('valid circle and ellipse template paths validate', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createTemplatePathStratum({
      ambientDimension: 2,
      id: 'circle-template',
      name: 'Circle template',
      template: {
        kind: 'circleTemplate',
        center: { x: 1, y: 2, z: 0 },
        radius: 2,
      },
    }),
    createTemplatePathStratum({
      ambientDimension: 2,
      id: 'ellipse-template',
      name: 'Ellipse template',
      template: {
        kind: 'ellipseTemplate',
        center: { x: -1, y: 0, z: 0 },
        radiusX: 2,
        radiusY: 0.75,
        rotationDeg: 15,
      },
    }),
  )

  assert.equal(validateDiagram(diagram).valid, true)
})

test('template path validation rejects invalid radii and missing 3D frames', () => {
  const invalidCircle = createEmptyDiagram({ ambientDimension: 2 })
  invalidCircle.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'bad-circle',
    name: 'Bad Circle',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1,
      lineStyle: 'solid',
    },
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'circleTemplate',
      center: { x: 0, y: 0, z: 0 },
      radius: 0,
    },
  })

  assert.equal(validateDiagram(invalidCircle).valid, false)

  const missingFrame = createEmptyDiagram({ ambientDimension: 3 })
  missingFrame.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'bad-ellipse',
    name: 'Bad Ellipse',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1,
      lineStyle: 'solid',
    },
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'ellipseTemplate',
      center: { x: 0, y: 0, z: 0 },
      radiusX: 1,
      radiusY: 1,
    },
  })

  assert.equal(validateDiagram(missingFrame).valid, false)
})

test('template path sampling caps huge counts and preserves default count', () => {
  const template = {
    kind: 'circleTemplate' as const,
    center: { x: 0, y: 0, z: 0 },
    radius: 1,
  }

  assert.equal(sampleTemplatePathPoints(template, 2).length, 65)
  assert.equal(
    sampleTemplatePathPoints(template, 2, 1_000_000).length,
    MAX_TEMPLATE_PATH_SAMPLES + 1,
  )
  assert.equal(
    sampleTemplatePathPoints(template, 2, 1_000_000, {
      maxSamples: 32,
    }).length,
    33,
  )
  assert.equal(
    sampleTemplatePathPoints(
      template,
      2,
      Number.POSITIVE_INFINITY,
    ).length,
    9,
  )
})

test('cross-work-plane 3D concatenated path validates with absolute segment coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createConcatenatedPathStratum({
      ambientDimension: 3,
      id: 'cross-plane-path',
      name: 'Cross Plane Path',
      segments: [
        {
          kind: 'line',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
        },
        {
          kind: 'line',
          start: { x: 1, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 1 },
        },
      ],
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, joinValidationMessages(validation.errors))
})

test('cross-work-plane 3D concatenated path still rejects endpoint gaps', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createConcatenatedPathStratum({
      ambientDimension: 3,
      id: 'gapped-cross-plane-path',
      name: 'Gapped Cross Plane Path',
      segments: [
        {
          kind: 'line',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 1, y: 0, z: 0 },
        },
        {
          kind: 'line',
          start: { x: 1, y: 0, z: 0.01 },
          end: { x: 1, y: 0, z: 1 },
        },
      ],
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /must match/)
})

test('concatenated path segment without override inherits path style', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'inherited-style-path',
    name: 'Inherited Style Path',
    style: {
      kind: 'curveStyle',
      strokeColor: '#336699',
      strokeOpacity: 0.7,
      lineWidth: 2.5,
      lineStyle: 'dashed',
    },
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
    ],
  })

  assert.deepEqual(resolvePathSegmentStyle(path.style, path.segments[0]), path.style)
})

test('concatenated path segment style override resolves against path style', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'overridden-style-path',
    name: 'Overridden Style Path',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        styleOverride: {
          strokeColor: '#AA0000',
          strokeOpacity: 0.45,
          lineWidth: 2,
          lineStyle: 'denselyDotted',
        },
      },
    ],
  })

  assert.deepEqual(resolvePathSegmentStyle(path.style, path.segments[0]), {
    kind: 'curveStyle',
    strokeColor: '#AA0000',
    strokeOpacity: 0.45,
    lineWidth: 2,
    lineStyle: 'denselyDotted',
  })
})

test('empty concatenated path segment list is rejected', () => {
  const validation = validateDiagram(diagramWithPathSegments([]))

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /at least one segment/)
})

test('invalid concatenated path segment style override is rejected', () => {
  const validation = validateDiagram(
    diagramWithPathSegments([
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        styleOverride: {
          lineStyle: 'dashDot' as PathSegmentStyleOverride['lineStyle'],
        },
      },
    ]),
  )

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /solid, dashed, dotted/)
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

test('boundary snapshot reversal swaps line endpoints without mutating source', () => {
  const boundary: BoundaryPathSnapshot = {
    id: 'line-boundary',
    name: 'Line boundary',
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
    ],
  }
  const before = structuredClone(boundary)

  const reversed = reverseBoundaryPathSnapshot(boundary)

  assert.deepEqual(reversed, {
    id: 'line-boundary',
    name: 'Line boundary',
    segments: [
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 },
      },
    ],
  })
  assert.deepEqual(boundary, before)
  assert.notEqual(reversed.segments, boundary.segments)
  assert.notEqual(reversed.segments[0].start, boundary.segments[0].end)
})

test('boundary snapshot reversal swaps cubic endpoints and control points', () => {
  const boundary: BoundaryPathSnapshot = {
    segments: [
      {
        kind: 'cubicBezier',
        start: { x: 0, y: 0, z: 0 },
        control1: { x: 1, y: 2, z: 0 },
        control2: { x: 3, y: 2, z: 0 },
        end: { x: 4, y: 0, z: 0 },
      },
    ],
  }

  assert.deepEqual(reverseBoundaryPathSnapshot(boundary).segments[0], {
    kind: 'cubicBezier',
    start: { x: 4, y: 0, z: 0 },
    control1: { x: 3, y: 2, z: 0 },
    control2: { x: 1, y: 2, z: 0 },
    end: { x: 0, y: 0, z: 0 },
  })
})

test('boundary snapshot reversal reverses multi-segment order', () => {
  const boundary: BoundaryPathSnapshot = {
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'cubicBezier',
        start: { x: 1, y: 0, z: 0 },
        control1: { x: 1, y: 1, z: 0 },
        control2: { x: 2, y: 1, z: 0 },
        end: { x: 2, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 2, y: 0, z: 0 },
        end: { x: 3, y: 0, z: 0 },
      },
    ],
  }

  const reversed = reverseBoundaryPathSnapshot(boundary)

  assert.deepEqual(
    reversed.segments.map((segment) => segment.kind),
    ['line', 'cubicBezier', 'line'],
  )
  assert.deepEqual(pathEndpoints(reversed.segments), {
    start: { x: 3, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
  })
  assert.equal(areSegmentsComposable(reversed.segments), true)
})

test('boundary snapshot reversal preserves symbolic coordinate metadata', () => {
  const symbolicEnd = {
    x: 1,
    y: 2,
    z: 0,
    symbolic: {
      x: { kind: 'symbolic' as const, expression: 'a', previewValue: 1 },
      y: { kind: 'numeric' as const, value: 2 },
      z: { kind: 'numeric' as const, value: 0 },
    },
  }
  const boundary: BoundaryPathSnapshot = {
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: symbolicEnd,
      },
    ],
  }

  const reversed = reverseBoundaryPathSnapshot(boundary)

  assert.deepEqual(reversed.segments[0].start, symbolicEnd)
  assert.notEqual(reversed.segments[0].start, symbolicEnd)
  assert.notEqual(reversed.segments[0].start.symbolic, symbolicEnd.symbolic)
})

test('boundary snapshot reversal swaps arc endpoints, angles, and direction', () => {
  const boundary: BoundaryPathSnapshot = {
    segments: [
      {
        kind: 'arc',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 1, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        radius: 1,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
        frame: {
          origin: { x: 0, y: 0, z: 0 },
          u: { x: 1, y: 0, z: 0 },
          v: { x: 0, y: 1, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
        },
      },
    ],
  }

  const reversed = reverseBoundaryPathSnapshot(boundary)

  assert.deepEqual(reversed.segments[0], {
    kind: 'arc',
    start: { x: 0, y: 1, z: 0 },
    end: { x: 1, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    radius: 1,
    startAngleDeg: 90,
    endAngleDeg: 0,
    direction: 'clockwise',
    frame: {
      origin: { x: 0, y: 0, z: 0 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    },
  })
  assert.notEqual(reversed.segments[0], boundary.segments[0])
})

test('curve direction reversal reverses polyline point order', () => {
  const curve = createCurveStratum({
    ambientDimension: 2,
    id: 'reverse-polyline',
    name: 'Reverse polyline',
    kind: 'polyline',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 1, z: 0 },
    ],
  })

  const reversed = reverseCurvePathDirection(curve)

  assert.equal(reversed?.kind, 'polyline')
  if (reversed?.kind !== 'polyline') {
    throw new Error('Expected a reversed polyline.')
  }

  assert.deepEqual(reversed.points, [
    { x: 2, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ])
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 },
  ])
})

test('curve direction reversal swaps cubic controls correctly', () => {
  const curve = createCurveStratum({
    ambientDimension: 2,
    id: 'reverse-cubic',
    name: 'Reverse cubic',
    kind: 'cubicBezier',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 2, z: 0 },
      { x: 4, y: 0, z: 0 },
    ],
    bezierControls: { kind: 'absolute' },
  })

  const reversed = reverseCurvePathDirection(curve)

  assert.equal(reversed?.kind, 'cubicBezier')
  if (reversed?.kind !== 'cubicBezier') {
    throw new Error('Expected a reversed cubic Bezier.')
  }

  assert.deepEqual(reversed.points, [
    { x: 4, y: 0, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 0, y: 0, z: 0 },
  ])
  assert.deepEqual(reversed.bezierControls, { kind: 'absolute' })
})

test('curve direction reversal reverses concatenated path geometry order', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'reverse-path',
    name: 'Reverse path',
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
  })

  const reversed = reverseCurvePathDirection(path)

  assert.equal(reversed?.kind, 'concatenatedPath')
  if (reversed?.kind !== 'concatenatedPath') {
    throw new Error('Expected a reversed concatenated path.')
  }

  assert.deepEqual(
    reversed.segments.map((segment) => segment.kind),
    ['cubicBezier', 'line'],
  )
  assert.deepEqual(pathEndpoints(reversed.segments), {
    start: { x: 3, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
  })
  assert.equal(areSegmentsComposable(reversed.segments), true)
})

test('curve direction reversal swaps arc segment direction', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'reverse-arc-path',
    name: 'Reverse arc path',
    segments: [
      {
        kind: 'arc',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 1, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        radius: 1,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
      },
    ],
  })

  const reversed = reverseCurvePathDirection(path)

  assert.equal(reversed?.kind, 'concatenatedPath')
  if (reversed?.kind !== 'concatenatedPath') {
    throw new Error('Expected a reversed concatenated path.')
  }

  assert.deepEqual(reversed.segments[0], {
    kind: 'arc',
    start: { x: 0, y: 1, z: 0 },
    end: { x: 1, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    radius: 1,
    startAngleDeg: 90,
    endAngleDeg: 0,
    direction: 'clockwise',
  })
})

test('curve direction reversal preserves style, layer, name, id, labels, and arrows', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'preserved-path',
    name: 'Preserved path',
    label: 'attached',
    pathLabel: 'saved path label',
    style: {
      kind: 'curveStyle',
      strokeColor: '#123456',
      strokeOpacity: 0.8,
      lineWidth: 2,
      lineStyle: 'dotted',
    },
    importedTikzStyleReferenceId: 'imported-style',
    arrows: {
      endpoint: 'forward',
      mid: {
        enabled: true,
        position: 0.3,
        direction: 'backward',
        head: 'stealth',
      },
    },
    layer: 4,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
    ],
  })

  const reversed = reverseCurvePathDirection(path)

  assert.equal(reversed?.id, path.id)
  assert.equal(reversed?.name, path.name)
  assert.equal(reversed?.label, path.label)
  assert.equal(reversed?.pathLabel, path.pathLabel)
  assert.equal(reversed?.layer, path.layer)
  assert.deepEqual(reversed?.style, path.style)
  assert.equal(
    reversed?.importedTikzStyleReferenceId,
    path.importedTikzStyleReferenceId,
  )
  assert.deepEqual(reversed?.arrows, path.arrows)
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
        styleOverride: {
          lineStyle: 'dotted',
        },
      },
    ],
  })

  const normalized = normalizePathForAmbientDimension(path, 2)

  assert.equal(normalized.codim, 1)
  assert.deepEqual(normalized.segments[0], {
    kind: 'line',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1, y: 0, z: 0 },
    styleOverride: {
      lineStyle: 'dotted',
    },
  })
  assert.equal(path.codim, 2)
  assert.deepEqual(path.segments[0], {
    kind: 'line',
    start: { x: 0, y: 0, z: 3 },
    end: { x: 1, y: 0, z: 4 },
    styleOverride: {
      lineStyle: 'dotted',
    },
  })
})

test('path segment style runs preserve segment order', () => {
  const path = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'style-run-path',
    name: 'Style Run Path',
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
        styleOverride: { lineStyle: 'dotted' },
      },
      {
        kind: 'line',
        start: { x: 2, y: 0, z: 0 },
        end: { x: 3, y: 0, z: 0 },
        styleOverride: { lineStyle: 'dotted' },
      },
      {
        kind: 'line',
        start: { x: 3, y: 0, z: 0 },
        end: { x: 4, y: 0, z: 0 },
      },
    ],
  })

  assert.deepEqual(
    pathSegmentStyleRuns(path.segments, path.style).map((run) => ({
      startIndex: run.startIndex,
      segmentCount: run.segments.length,
      lineStyle: run.style.lineStyle,
      startX: run.segments[0].start.x,
    })),
    [
      { startIndex: 0, segmentCount: 1, lineStyle: 'solid', startX: 0 },
      { startIndex: 1, segmentCount: 2, lineStyle: 'dotted', startX: 1 },
      { startIndex: 3, segmentCount: 1, lineStyle: 'solid', startX: 3 },
    ],
  )
})

test('concatenated path save/load round-trips through JSON', () => {
  const diagram = createTwoDimensionalPathDiagram()
  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagram))
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
