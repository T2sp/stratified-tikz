import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
} from '../../src/model/visibility.ts'
import type {
  Camera3D,
  CurveStratum,
  Diagram,
  Vec3,
  VisibilityOptions,
  VisibilitySortMode,
} from '../../src/model/types.ts'
import {
  classifyCurveOcclusion,
} from '../../src/rendering/curveOcclusion.ts'

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
    ['visible', 'hidden', 'visible'],
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

test('curve occlusion sampling cap prevents excessive sampled segments', () => {
  const points = Array.from({ length: 40 }, (_, index) => ({
    x: -0.2 + index * 0.01,
    y: -1,
    z: 0,
  }))
  const curve = polylineCurve('long-curve', points)
  const [result] = classifyCurveOcclusion(occlusionDiagram(curve), {
    camera: occlusionCamera,
    visibility: enabledVisibility(),
    maxCurveSegmentsPerCurve: 5,
  })

  assert.equal(result?.sampledSegmentCount, 5)
  assert.equal(result?.segments.length, 5)
  assert.equal(result?.capped, true)
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
