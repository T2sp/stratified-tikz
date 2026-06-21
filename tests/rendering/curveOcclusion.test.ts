import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createSheetStratum,
} from '../../src/model/constructors.ts'
import {
  defaultCurveStyle,
  defaultSheetStyle,
} from '../../src/model/styles.ts'
import {
  defaultVisibilityOptions,
  hiddenLabelStyleFromBase,
  hiddenPointStyleFromBase,
} from '../../src/model/visibility.ts'
import type {
  Camera3D,
  CurveStratum,
  Diagram,
  PathSegmentStyleOverride,
  Vec3,
  VisibilityOptions,
  VisibilitySortMode,
} from '../../src/model/types.ts'
import {
  classifyCurveOcclusion,
  type CurveOcclusionResult,
} from '../../src/rendering/curveOcclusion.ts'
import {
  classifyAnchorOcclusion,
} from '../../src/rendering/pointOcclusion.ts'
import {
  curveStyleToSvgStrokeAttributes,
  hiddenCurveStyleToSvgStrokeAttributes,
} from '../../src/rendering/svgStyle.ts'

const occlusionCamera: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 90,
  phiDeg: 0,
  zoom: 1,
  pan: { x: 0, y: 0 },
}

test('curve in front of surface is classified visible', () => {
  const curve = polylineCurve('front-curve', [
    { x: -0.5, y: 1, z: 0 },
    { x: 0.5, y: 1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
  })

  assert.deepEqual(
    result?.segments.map((segment) => segment.visibility),
    ['visible'],
  )
})

test('curve behind surface is classified hidden', () => {
  const curve = polylineCurve('behind-curve', [
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
  })

  assert.deepEqual(
    result?.segments.map((segment) => segment.visibility),
    ['hidden'],
  )
  assert.equal(result?.segments[0]?.occludingFace?.sourceId, 'occluding-sheet')
})

test('curve partly behind surface produces visible and hidden segments', () => {
  const curve = polylineCurve('partial-curve', [
    { x: -2, y: -1, z: 0 },
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
  })

  assert.deepEqual(
    result?.segments.map((segment) => segment.visibility),
    ['visible', 'hidden', 'hidden', 'hidden', 'visible'],
  )
})

test('straight polyline edge subdivision samples one edge more than once', () => {
  const curve = polylineCurve('subdivided-polyline', [
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 4)
  assert.deepEqual(result?.segments[0]?.start, { x: -0.5, y: -1, z: 0 })
  assert.deepEqual(result?.segments[0]?.end, { x: 0.5, y: -1, z: 0 })
})

test('line path segment subdivision samples one line more than once', () => {
  const curve = linePathCurve(
    'subdivided-line-path',
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
  )
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 4)
  assert.deepEqual(result?.segments[0]?.start, { x: -0.5, y: -1, z: 0 })
  assert.deepEqual(result?.segments[0]?.end, { x: 0.5, y: -1, z: 0 })
})

test('straight subdivision keeps finite sampled run coordinates', () => {
  const curve = polylineCurve('finite-subdivision', [
    { x: -2, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 8,
  })

  assert.equal(result?.segments.every(segmentHasFiniteCoordinates), true)
})

test('zero-length straight line subdivision is skipped safely', () => {
  const curve = linePathCurve(
    'zero-length-line-path',
    { x: 0, y: -1, z: 0 },
    { x: 0, y: -1, z: 0 },
  )
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 0)
  assert.equal(result?.segments.length, 0)
})

test('single straight polyline crossing behind a surface splits visible hidden visible', () => {
  const curve = polylineCurve('single-segment-crossing-polyline', [
    { x: -2, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 4)
  assert.deepEqual(visibilityRuns(result), ['visible', 'hidden', 'visible'])
  assert.deepEqual(result?.segments[0]?.start, { x: -2, y: -1, z: 0 })
  assert.deepEqual(result?.segments.at(-1)?.end, { x: 2, y: -1, z: 0 })
})

test('single straight line path crossing behind a surface splits visible hidden visible', () => {
  const curve = linePathCurve(
    'single-segment-crossing-path',
    { x: -2, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
  )
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 4)
  assert.deepEqual(visibilityRuns(result), ['visible', 'hidden', 'visible'])
})

test('disabled curve visibility does not classify straight occlusion runs', () => {
  const curve = polylineCurve('disabled-crossing-polyline', [
    { x: -2, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
  ])
  const results = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: {
      ...enabledVisibility(),
      enabled: false,
    },
    curveSegmentSamples: 4,
  })

  assert.deepEqual(results, [])
})

test('fully visible straight segment remains one visible run', () => {
  const curve = polylineCurve('fully-visible-line', [
    { x: -0.5, y: 1, z: 0 },
    { x: 0.5, y: 1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 4)
  assert.deepEqual(visibilityRuns(result), ['visible'])
})

test('fully visible backtracking polyline preserves both directions', () => {
  const curve = polylineCurve('visible-backtracking-polyline', [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 1,
  })

  assert.equal(result?.capped, false)
  assert.deepEqual(visibilityRuns(result), ['visible', 'visible'])
  assert.deepEqual(result?.segments.map(segmentEndpoints), [
    {
      start: { x: 0, y: 1, z: 0 },
      end: { x: 1, y: 1, z: 0 },
    },
    {
      start: { x: 1, y: 1, z: 0 },
      end: { x: 0, y: 1, z: 0 },
    },
  ])
  assert.equal(
    result?.segments.some((segment) =>
      vec3ApproximatelyEqual(segment.start, segment.end),
    ),
    false,
  )
})

test('same-key same-direction collinear subdivisions merge to one run', () => {
  const curve = polylineCurve('same-key-forward-polyline', [
    { x: 0, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 2,
  })

  assert.equal(result?.sampledSegmentCount, 2)
  assert.deepEqual(result?.segments.map(segmentEndpoints), [
    {
      start: { x: 0, y: 1, z: 0 },
      end: { x: 2, y: 1, z: 0 },
    },
  ])
})

test('different merge keys do not merge adjacent collinear polyline edges', () => {
  const curve = polylineCurve('different-key-forward-polyline', [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 1,
  })

  assert.deepEqual(result?.segments.map(segmentEndpoints), [
    {
      start: { x: 0, y: 1, z: 0 },
      end: { x: 1, y: 1, z: 0 },
    },
    {
      start: { x: 1, y: 1, z: 0 },
      end: { x: 2, y: 1, z: 0 },
    },
  ])
})

test('different style overrides do not merge adjacent collinear path segments', () => {
  const curve = createConcatenatedPathStratum({
    ambientDimension: 3,
    id: 'different-style-path',
    name: 'different-style-path',
    style: defaultCurveStyle,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 1, z: 0 },
        end: { x: 1, y: 1, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 1, z: 0 },
        end: { x: 2, y: 1, z: 0 },
        styleOverride: {
          strokeColor: '#AA0033',
          strokeOpacity: 0.8,
          lineWidth: 2.4,
          lineStyle: 'dotted',
        },
      },
    ],
  })
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 1,
  })

  assert.deepEqual(result?.segments.map(segmentEndpoints), [
    {
      start: { x: 0, y: 1, z: 0 },
      end: { x: 1, y: 1, z: 0 },
    },
    {
      start: { x: 1, y: 1, z: 0 },
      end: { x: 2, y: 1, z: 0 },
    },
  ])
  assert.equal(
    result?.segments[0]?.style.strokeColor,
    defaultCurveStyle.strokeColor,
  )
  assert.equal(result?.segments[1]?.style.strokeColor, '#AA0033')
})

test('fully hidden straight segment remains one hidden run', () => {
  const curve = polylineCurve('fully-hidden-line', [
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
  ])
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.sampledSegmentCount, 4)
  assert.deepEqual(visibilityRuns(result), ['hidden'])
})

test('line path style override is preserved after subdivision', () => {
  const curve = linePathCurve(
    'styled-line-path',
    { x: -2, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
    {
      strokeColor: '#AA0033',
      strokeOpacity: 0.8,
      lineWidth: 2.4,
      lineStyle: 'dotted',
    },
  )
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })

  assert.equal(result?.segments.every((segment) => (
    segment.style.strokeColor === '#AA0033' &&
    segment.style.strokeOpacity === 0.8 &&
    segment.style.lineWidth === 2.4 &&
    segment.style.lineStyle === 'dotted'
  )), true)
})

test('SVG hidden and visible styles use subdivided line segment styles', () => {
  const curve = linePathCurve(
    'svg-styled-line-path',
    { x: -2, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
    {
      strokeColor: '#AA0033',
      strokeOpacity: 0.8,
      lineWidth: 2.4,
      lineStyle: 'dotted',
    },
  )
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    curveSegmentSamples: 4,
  })
  const hiddenRun = result?.segments.find((segment) => segment.visibility === 'hidden')
  const visibleRun = result?.segments.find((segment) => segment.visibility === 'visible')

  assert.ok(hiddenRun)
  assert.ok(visibleRun)
  assert.deepEqual(curveStyleToSvgStrokeAttributes(visibleRun.style), {
    stroke: '#AA0033',
    strokeOpacity: 0.8,
    strokeWidth: 2.4,
    strokeDasharray: '1 5',
  })
  assert.deepEqual(
    hiddenCurveStyleToSvgStrokeAttributes(hiddenRun.style, {
      lineStyle: 'denselyDotted',
      opacity: 0.5,
    }),
    {
      stroke: '#AA0033',
      strokeOpacity: 0.4,
      strokeWidth: 2.4,
      strokeDasharray: '1 2',
    },
  )
})

test('curve occlusion respects layerThenDepth and depthThenLayer options', () => {
  const curve = polylineCurve(
    'upper-layer-curve',
    [
      { x: -0.5, y: -1, z: 0 },
      { x: 0.5, y: -1, z: 0 },
    ],
    1,
  )
  const diagram = occlusionDiagram(curve)
  const layerThenDepth = classifyCurveOcclusion(diagram, {
    camera: occlusionCamera,
    visibility: enabledVisibility('layerThenDepth'),
  })
  const depthThenLayer = classifyCurveOcclusion(diagram, {
    camera: occlusionCamera,
    visibility: enabledVisibility('depthThenLayer'),
  })

  assert.equal(layerThenDepth[0]?.segments[0]?.visibility, 'visible')
  assert.equal(depthThenLayer[0]?.segments[0]?.visibility, 'hidden')
})

test('curve occlusion surface face cap falls back before sorting projected faces', () => {
  const curve = polylineCurve('over-face-cap-curve', [
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
  ])
  const diagram = occlusionDiagramWithTwoSheets(curve)
  const originalSort = Array.prototype.sort

  Array.prototype.sort = function sortSpy<T>(
    this: T[],
  ): T[] {
    throw new Error(`unexpected sort of ${this.length} projected faces`)
  }

  try {
    const [result] = classifyCurveOcclusion(diagram, {
      camera: occlusionCamera,
      visibility: {
        ...enabledVisibility(),
        maxSurfaceFacesForSorting: 1,
      },
      curveSegmentSamples: 4,
    })

    assert.equal(result?.capped, true)
    assert.equal(result?.fallbackReason, 'surfaceFaceCapExceeded')
    assert.equal(result?.sampledSegmentCount, 0)
    assert.deepEqual(result?.segments, [])
  } finally {
    Array.prototype.sort = originalSort
  }
})

test('curve occlusion sampling cap falls back instead of exposing a prefix', () => {
  const points = longPolylinePoints(30, 1)
  const curve = polylineCurve('long-curve', points)
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    maxCurveSegmentsPerCurve: 5,
  })

  assert.equal(result?.sampledSegmentCount, 5)
  assert.equal(result?.capped, true)
  assert.equal(result?.fallbackReason, 'sampleCapExceeded')
  assert.deepEqual(result?.segments, [])
})

test('hidden capped curve also falls back without exposing a prefix', () => {
  const curve = polylineCurve('long-hidden-curve', longPolylinePoints(30, -1))
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    maxCurveSegmentsPerCurve: 5,
  })

  assert.equal(result?.sampledSegmentCount, 5)
  assert.equal(result?.capped, true)
  assert.equal(result?.fallbackReason, 'sampleCapExceeded')
  assert.deepEqual(result?.segments, [])
})

test('curve occlusion does not mutate original curve geometry', () => {
  const curve = polylineCurve('immutable-curve', [
    { x: -0.5, y: -1, z: 0 },
    { x: 0.5, y: -1, z: 0 },
  ])
  const diagram = occlusionDiagram(curve)
  const before = structuredClone(diagram)

  classifyCurveOcclusion(diagram, {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
  })

  assert.deepEqual(diagram, before)
})

test('default visibility options keep automatic anchor visibility disabled', () => {
  const results = classifyAnchorOcclusion(
    occlusionDiagram(polylineCurve('unused-curve', [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ])),
    [
      {
        id: 'hidden-point',
        layer: 0,
        position: { x: 0, y: -1, z: 0 },
      },
    ],
    {
      camera: occlusionCamera,
      visibility: defaultVisibilityOptions,
      kind: 'point',
    },
  )

  assert.equal(defaultVisibilityOptions.enabled, false)
  assert.equal(defaultVisibilityOptions.pointVisibility, 'dimHidden')
  assert.equal(defaultVisibilityOptions.labelVisibility, 'alwaysForeground')
  assert.deepEqual(results, [])
})

test('point anchor behind surface is classified hidden', () => {
  const [result] = classifyAnchorOcclusion(
    occlusionDiagram(polylineCurve('unused-curve', [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ])),
    [
      {
        id: 'behind-point',
        layer: 0,
        position: { x: 0, y: -1, z: 0 },
      },
    ],
    {
      camera: occlusionCamera,
      visibility: enabledVisibility(),
      kind: 'point',
    },
  )

  assert.equal(result?.visibility, 'hidden')
  assert.equal(result?.occludingFace?.sourceId, 'occluding-sheet')
})

test('label anchor auto mode classifies hidden labels', () => {
  const [result] = classifyAnchorOcclusion(
    occlusionDiagram(polylineCurve('unused-curve', [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ])),
    [
      {
        id: 'behind-label',
        layer: 0,
        position: { x: 0, y: -1, z: 0 },
      },
    ],
    {
      camera: occlusionCamera,
      visibility: {
        ...enabledVisibility(),
        labelVisibility: 'autoDim',
      },
      kind: 'label',
    },
  )

  assert.equal(result?.visibility, 'hidden')
})

test('always foreground label policy skips label anchor classification', () => {
  const results = classifyAnchorOcclusion(
    occlusionDiagram(polylineCurve('unused-curve', [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ])),
    [
      {
        id: 'behind-label',
        layer: 0,
        position: { x: 0, y: -1, z: 0 },
      },
    ],
    {
      camera: occlusionCamera,
      visibility: enabledVisibility(),
      kind: 'label',
    },
  )

  assert.deepEqual(results, [])
})

test('anchor occlusion respects layerThenDepth and depthThenLayer options', () => {
  const diagram = occlusionDiagram(polylineCurve('unused-curve', [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
  ]))
  const targets = [
    {
      id: 'upper-layer-point',
      layer: 1,
      position: { x: 0, y: -1, z: 0 },
    },
  ]
  const layerThenDepth = classifyAnchorOcclusion(diagram, targets, {
    camera: occlusionCamera,
    visibility: enabledVisibility('layerThenDepth'),
    kind: 'point',
  })
  const depthThenLayer = classifyAnchorOcclusion(diagram, targets, {
    camera: occlusionCamera,
    visibility: enabledVisibility('depthThenLayer'),
    kind: 'point',
  })

  assert.equal(layerThenDepth[0]?.visibility, 'visible')
  assert.equal(depthThenLayer[0]?.visibility, 'hidden')
})

test('anchor occlusion respects explicit occluding surface ids', () => {
  const results = classifyAnchorOcclusion(
    occlusionDiagram(polylineCurve('unused-curve', [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ])),
    [
      {
        id: 'behind-point',
        layer: 0,
        position: { x: 0, y: -1, z: 0 },
      },
    ],
    {
      camera: occlusionCamera,
      visibility: enabledVisibility(),
      occludingSurfaceIds: new Set(['not-the-sheet']),
      kind: 'point',
    },
  )

  assert.deepEqual(results, [])
})

test('hidden point and label styles only reduce opacity', () => {
  assert.deepEqual(
    hiddenPointStyleFromBase({
      kind: 'pointStyle',
      color: '#123456',
      opacity: 0.5,
      shape: 'square',
      fill: 'hollow',
      size: 4,
    }),
    {
      kind: 'pointStyle',
      color: '#123456',
      opacity: 0.14,
      shape: 'square',
      fill: 'hollow',
      size: 4,
    },
  )
  assert.deepEqual(
    hiddenLabelStyleFromBase({
      kind: 'labelStyle',
      color: '#654321',
      opacity: 0.8,
      fontSize: 12,
      anchor: 'north east',
    }),
    {
      kind: 'labelStyle',
      color: '#654321',
      opacity: 0.27999999999999997,
      fontSize: 12,
      anchor: 'north east',
    },
  )
})

function occlusionDiagram(curve: CurveStratum): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.camera = occlusionCamera
  diagram.view = { camera3d: occlusionCamera }
  diagram.strata = [
    createSheetStratum({
      ambientDimension: 3,
      id: 'occluding-sheet',
      name: 'Occluding sheet',
      style: defaultSheetStyle,
      corners: [
        { x: -1, y: 0, z: -1 },
        { x: 1, y: 0, z: -1 },
        { x: 1, y: 0, z: 1 },
        { x: -1, y: 0, z: 1 },
      ],
      layer: 0,
    }),
    curve,
  ]

  return diagram
}

function occlusionDiagramWithTwoSheets(curve: CurveStratum): Diagram {
  const diagram = occlusionDiagram(curve)

  diagram.strata.splice(
    1,
    0,
    createSheetStratum({
      ambientDimension: 3,
      id: 'second-occluding-sheet',
      name: 'Second occluding sheet',
      style: defaultSheetStyle,
      corners: [
        { x: -1, y: 0, z: -1 },
        { x: 1, y: 0, z: -1 },
        { x: 1, y: 0, z: 1 },
        { x: -1, y: 0, z: 1 },
      ],
      layer: 0,
    }),
  )

  return diagram
}

function polylineCurve(
  id: string,
  points: Vec3[],
  layer = 0,
): CurveStratum {
  return createCurveStratum({
    ambientDimension: 3,
    id,
    name: id,
    kind: 'polyline',
    style: defaultCurveStyle,
    points,
    layer,
  })
}

function linePathCurve(
  id: string,
  start: Vec3,
  end: Vec3,
  styleOverride?: PathSegmentStyleOverride,
): CurveStratum {
  return createConcatenatedPathStratum({
    ambientDimension: 3,
    id,
    name: id,
    style: defaultCurveStyle,
    segments: [
      {
        kind: 'line',
        start,
        end,
        ...(styleOverride === undefined ? {} : { styleOverride }),
      },
    ],
  })
}

function visibilityRuns(
  result: CurveOcclusionResult | undefined,
): string[] {
  return result?.segments.map((segment) => segment.visibility) ?? []
}

function segmentEndpoints(segment: { start: Vec3; end: Vec3 }): {
  start: Vec3
  end: Vec3
} {
  return {
    start: segment.start,
    end: segment.end,
  }
}

function segmentHasFiniteCoordinates(segment: {
  start: Vec3
  end: Vec3
  midpoint: Vec3
}): boolean {
  return (
    isFiniteVec3(segment.start) &&
    isFiniteVec3(segment.end) &&
    isFiniteVec3(segment.midpoint)
  )
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function vec3ApproximatelyEqual(first: Vec3, second: Vec3): boolean {
  return (
    Math.abs(first.x - second.x) <= 1e-9 &&
    Math.abs(first.y - second.y) <= 1e-9 &&
    Math.abs(first.z - second.z) <= 1e-9
  )
}

function longPolylinePoints(finalX: number, y: number): Vec3[] {
  return Array.from({ length: finalX + 1 }, (_, index) => ({
    x: index,
    y,
    z: 0,
  }))
}

function enabledVisibility(
  sortMode: VisibilitySortMode = 'layerThenDepth',
): VisibilityOptions {
  return {
    ...defaultVisibilityOptions,
    enabled: true,
    surfaceDepthSort: true,
    sortMode,
    depthEpsilon: 1e-9,
  }
}
