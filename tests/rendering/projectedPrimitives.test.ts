import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraBasisFromTikz3dplotAngles } from '../../src/geometry/projection.ts'
import {
  createCurvedSheetStratum,
  createEmptyDiagram,
  createGridStratum,
  createPointStratum,
  createConcatenatedPathStratum,
  createCurveStratum,
  createTemplatePathStratum,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import {
  createNumericScalarInputValue,
  workPlaneGridFrame,
} from '../../src/model/grids.ts'
import {
  defaultSheetStyle,
} from '../../src/model/styles.ts'
import type {
  BoundaryPathSnapshot,
  Camera3D,
  ClosedPathBoundary,
  CurvedSheetStratum,
  Diagram,
  PathSegment,
  PolygonSheetStratum,
  SurfaceFrame,
  Vec2,
  Vec3,
} from '../../src/model/types.ts'
import { curvedSheetToSvgMesh } from '../../src/rendering/curvedSheetMesh.ts'
import {
  collectProjectedSurfaceFacesForSorting,
  extractProjectedRenderPrimitives,
  PROJECTED_DEPTH_CONVENTION,
  projectedDepth,
  type ProjectedRenderPrimitive,
  type ProjectedSurfaceFace,
} from '../../src/rendering/projectedPrimitives.ts'
import { sortProjectedSurfaceFaces } from '../../src/rendering/surfaceDepthSort.ts'
import {
  compareSvgRenderItems,
  svgRenderSortKey,
  type SvgRenderableSortItem,
} from '../../src/rendering/svgRenderSort.ts'
import { sortedSvgSurfaceFaces } from '../../src/rendering/svgSurfaceDepthSort.ts'
import { generateTikz } from '../../src/tikz/index.ts'

const testCamera: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 70,
  phiDeg: 110,
  zoom: 12,
  pan: { x: 80, y: 45 },
}

const xyFrame: SurfaceFrame = {
  origin: { x: 0, y: 0, z: 0 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
}

test('surface face primitive extraction covers supported 3D sheet kinds with finite depth', () => {
  const primitives = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
    curveSegmentSamples: 4,
    templatePathSamples: 8,
  })
  const faces = primitives.filter(isSurfaceFace)
  const sourceIds = new Set(faces.map((face) => face.sourceId))

  assert.ok(faces.length > 0)
  assert.ok(sourceIds.has('polygon-sheet'))
  assert.ok(sourceIds.has('filled-sheet'))
  assert.ok(sourceIds.has('saddle-sheet'))
  assert.ok(sourceIds.has('ruled-sheet'))
  assert.ok(sourceIds.has('coons-sheet'))

  for (const face of faces) {
    assert.equal(face.projectedPolygon.length, face.vertices3D.length)
    assert.ok(face.vertices3D.length >= 3)
    assertFinitePrimitive(face)
  }
})

test('surface-only face collector returns projected faces under cap', () => {
  const result = collectProjectedSurfaceFacesForSorting(
    primitiveCoverageDiagram(),
    {
      camera: testCamera,
      curveSegmentSamples: 4,
      maxSurfaceFacesForSorting: 128,
      sourceIds: new Set(['polygon-sheet', 'filled-sheet']),
    },
  )

  assert.equal(result.kind, 'ok')
  assert.deepEqual(
    result.faces.map((face) => face.sourceId),
    ['polygon-sheet', 'filled-sheet'],
  )
  assert.equal(result.observedCount, 2)
  result.faces.forEach(assertFinitePrimitive)
})

test('surface-only face collector stops at cap plus one', () => {
  const result = collectProjectedSurfaceFacesForSorting(
    surfaceFaceCollectorCapDiagram(),
    {
      camera: testCamera,
      maxSurfaceFacesForSorting: 1,
    },
  )

  assert.equal(result.kind, 'capExceeded')
  assert.equal(result.cap, 1)
  assert.equal(result.observedCount, 2)
})

test('surface-only face collector does not touch curve primitive extraction', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.camera = testCamera
  diagram.view = { camera3d: testCamera }
  diagram.strata = [
    throwingCurveStratum(),
    polygonSheet(),
  ]

  const result = collectProjectedSurfaceFacesForSorting(diagram, {
    camera: testCamera,
    maxSurfaceFacesForSorting: 4,
  })

  assert.equal(result.kind, 'ok')
  assert.deepEqual(
    result.faces.map((face) => face.sourceId),
    ['polygon-sheet'],
  )
})

test('curve segment primitive extraction covers curves, paths, templates, and grids with finite depth', () => {
  const primitives = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
    curveSegmentSamples: 4,
    templatePathSamples: 8,
  })
  const segments = primitives.filter(
    (primitive) => primitive.kind === 'curveSegment',
  )
  const sourceIds = new Set(segments.map((segment) => segment.sourceId))

  assert.ok(segments.length > 0)
  assert.ok(sourceIds.has('polyline-curve'))
  assert.ok(sourceIds.has('cubic-curve'))
  assert.ok(sourceIds.has('path-curve'))
  assert.ok(sourceIds.has('template-curve'))
  assert.ok(sourceIds.has('grid-curve'))

  for (const segment of segments) {
    assertFinitePrimitive(segment)
  }
})

test('point primitive extraction returns finite projection and depth', () => {
  const primitives = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
  })
  const point = primitives.find(
    (primitive) => primitive.kind === 'point' && primitive.sourceId === 'point-a',
  )

  assert.notEqual(point, undefined)
  assertFinitePrimitive(point)
})

test('depth convention uses smaller depth for points closer to the camera', () => {
  const viewDirection = cameraBasisFromTikz3dplotAngles(
    testCamera.thetaDeg,
    testCamera.phiDeg,
  ).forward
  const closerPoint = scaleVec3(viewDirection, -2)
  const fartherPoint = scaleVec3(viewDirection, 2)

  assert.equal(PROJECTED_DEPTH_CONVENTION, 'smallerDepthIsCloser')
  assert.ok(
    projectedDepth(testCamera, closerPoint) <
      projectedDepth(testCamera, fartherPoint),
  )
})

test('layer and source id are preserved on projected primitives', () => {
  const primitives = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
  })
  const point = primitives.find(
    (primitive) => primitive.kind === 'point' && primitive.sourceId === 'point-a',
  )
  const polygon = primitives.find(
    (primitive) =>
      primitive.kind === 'surfaceFace' &&
      primitive.sourceId === 'polygon-sheet',
  )

  assert.notEqual(point, undefined)
  assert.equal(point.layer, 11)
  assert.notEqual(polygon, undefined)
  assert.equal(polygon.layer, 3)
})

test('original index is stable and usable as a tie breaker', () => {
  const first = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
    curveSegmentSamples: 4,
    templatePathSamples: 8,
  })
  const second = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
    curveSegmentSamples: 4,
    templatePathSamples: 8,
  })
  const expectedIndices = Array.from({ length: first.length }, (_, index) => index)

  assert.deepEqual(
    first.map((primitive) => primitive.originalIndex),
    expectedIndices,
  )
  assert.deepEqual(
    first.map(primitiveSignature),
    second.map(primitiveSignature),
  )
})

test('projected primitive extraction produces no NaN or Infinity values', () => {
  const primitives = extractProjectedRenderPrimitives(primitiveCoverageDiagram(), {
    camera: testCamera,
    curveSegmentSamples: 4,
    templatePathSamples: 8,
  })

  assert.ok(primitives.length > 0)

  for (const primitive of primitives) {
    assertFinitePrimitive(primitive)
  }
})

test('projected primitive extraction does not mutate diagram or existing SVG/TikZ output', () => {
  const diagram = primitiveCoverageDiagram()
  const curvedSheet = findCurvedSheet(diagram, 'saddle-sheet')
  const beforeDiagram = structuredClone(diagram)
  const tikzBefore = generateTikz(diagram)
  const svgMeshBefore = JSON.stringify(
    curvedSheetToSvgMesh(curvedSheet, testCamera, 240),
  )

  extractProjectedRenderPrimitives(diagram, {
    camera: testCamera,
    curveSegmentSamples: 4,
    templatePathSamples: 8,
  })

  assert.deepEqual(diagram, beforeDiagram)
  assert.equal(generateTikz(diagram), tikzBefore)
  assert.equal(
    JSON.stringify(curvedSheetToSvgMesh(curvedSheet, testCamera, 240)),
    svgMeshBefore,
  )
})

test('surface faces sort by depth inside the same layer', () => {
  const sorted = sortProjectedSurfaceFaces(
    [
      projectedTestFace('near', 0, 1, 0),
      projectedTestFace('far', 0, 3, 1),
    ],
    enabledVisibilityOptions('layerThenDepth'),
  )

  assert.deepEqual(
    sorted.map((face) => face.sourceId),
    ['far', 'near'],
  )
})

test('layerThenDepth keeps layer order before depth order', () => {
  const sorted = sortProjectedSurfaceFaces(
    [
      projectedTestFace('near-upper-layer', 2, 1, 0),
      projectedTestFace('far-lower-layer', 1, 3, 1),
    ],
    enabledVisibilityOptions('layerThenDepth'),
  )

  assert.deepEqual(
    sorted.map((face) => face.sourceId),
    ['far-lower-layer', 'near-upper-layer'],
  )
})

test('depthThenLayer sorts by depth before layer order', () => {
  const sorted = sortProjectedSurfaceFaces(
    [
      projectedTestFace('near-lower-layer', 1, 1, 0),
      projectedTestFace('far-upper-layer', 2, 3, 1),
    ],
    enabledVisibilityOptions('depthThenLayer'),
  )

  assert.deepEqual(
    sorted.map((face) => face.sourceId),
    ['far-upper-layer', 'near-lower-layer'],
  )
})

test('surface face sorting uses original index as stable depth tie breaker', () => {
  const sorted = sortProjectedSurfaceFaces(
    [
      projectedTestFace('second', 0, 2, 8),
      projectedTestFace('first', 0, 2, 3),
    ],
    {
      ...enabledVisibilityOptions('layerThenDepth'),
      depthEpsilon: 1,
    },
  )

  assert.deepEqual(
    sorted.map((face) => face.sourceId),
    ['first', 'second'],
  )
})

test('SVG surface render order changes only when surface depth sort is enabled', () => {
  const diagram = twoSurfaceSortDiagram()
  const disabledFaces = sortedSvgSurfaceFaces(
    diagram,
    testCamera,
    180,
    {
      ...enabledVisibilityOptions('layerThenDepth'),
      enabled: false,
    },
  )
  const enabledFaces = sortedSvgSurfaceFaces(
    diagram,
    testCamera,
    180,
    enabledVisibilityOptions('layerThenDepth'),
  )

  assert.equal(disabledFaces, null)
  assert.deepEqual(
    enabledFaces?.map((face) => face.sheet.id),
    ['z-far', 'a-near'],
  )
})

test('SVG render comparator is transitive for mixed same-layer surface and curve items', () => {
  const farSurface = svgSurfaceRenderItem(
    projectedTestFace('zSurface', 0, 3, 0),
    0,
    0,
    'zSurface',
  )
  const nearSurface = svgSurfaceRenderItem(
    projectedTestFace('aSurface', 0, 1, 1),
    1,
    1,
    'aSurface',
  )
  const curve = svgNonSurfaceRenderItem('curve', 'mCurve', 0, 2)
  const items = [curve, nearSurface, farSurface]

  assert.deepEqual(sortedSvgRenderItemIds(items), [
    'zSurface',
    'aSurface',
    'mCurve',
  ])
  assert.equal(compareSvgRenderItems(farSurface, nearSurface) < 0, true)
  assert.equal(compareSvgRenderItems(nearSurface, curve) < 0, true)
  assert.equal(compareSvgRenderItems(curve, farSurface) > 0, true)
  assertSvgRenderComparatorTransitive(items)
})

test('SVG render comparator preserves sorted same-layer surface face order', () => {
  const sortedFaces = sortProjectedSurfaceFaces(
    [
      projectedTestFace('a-near', 0, 1, 0),
      projectedTestFace('z-far', 0, 3, 1),
    ],
    enabledVisibilityOptions('layerThenDepth'),
  )
  const items = sortedFaces.map((face, surfaceSortIndex) =>
    svgSurfaceRenderItem(face, surfaceSortIndex, surfaceSortIndex, face.sourceId),
  )

  assert.deepEqual(
    sortedSvgRenderItemIds(items),
    ['z-far', 'a-near'],
  )
})

test('SVG render comparator keeps non-surface same-layer id ordering', () => {
  const items: SvgRenderableSortItem[] = [
    svgNonSurfaceRenderItem('curve', 'zCurve', 0, 0),
    svgNonSurfaceRenderItem('point', 'mPoint', 0, 1),
    svgNonSurfaceRenderItem('label', 'aLabel', 0, 2),
  ]

  assert.deepEqual(sortedSvgRenderItemIds(items), [
    'aLabel',
    'mPoint',
    'zCurve',
  ])
})

test('SVG render comparator draws same-layer sorted surfaces before other items', () => {
  const items: SvgRenderableSortItem[] = [
    svgNonSurfaceRenderItem('point', 'xPoint', 0, 3),
    svgSurfaceRenderItem(projectedTestFace('zzzSurface', 0, 3, 0), 0, 0),
    svgNonSurfaceRenderItem('label', 'bLabel', 0, 2),
    svgSurfaceRenderItem(projectedTestFace('aaaSurface', 0, 1, 1), 1, 1),
    svgNonSurfaceRenderItem('curve', 'mCurve', 0, 4),
  ]

  assert.deepEqual(sortedSvgRenderItemIds(items), [
    'zzzSurface',
    'aaaSurface',
    'bLabel',
    'mCurve',
    'xPoint',
  ])
})

test('SVG render comparator keeps layer order before category and depth order', () => {
  const lowerLayerCurve = svgNonSurfaceRenderItem('curve', 'zCurve', 0, 2)
  const upperLayerSurface = svgSurfaceRenderItem(
    projectedTestFace('aSurface', 1, 3, 0),
    0,
    0,
  )

  assert.deepEqual(
    sortedSvgRenderItemIds([upperLayerSurface, lowerLayerCurve]),
    ['zCurve', 'aSurface'],
  )
})

test('SVG render comparator uses stable index as deterministic duplicate-id tie breaker', () => {
  const later = svgNonSurfaceRenderItem('point', 'duplicate', 0, 5)
  const earlier = svgNonSurfaceRenderItem('curve', 'duplicate', 0, 2)

  assert.deepEqual(
    sortedSvgRenderItems([later, earlier]).map(
      (item) => `${item.id}:${item.stableIndex}`,
    ),
    ['duplicate:2', 'duplicate:5'],
  )
  assert.equal(compareSvgRenderItems(earlier, later) < 0, true)
})

test('SVG render sort key exposes the mixed item ordering tuple', () => {
  assert.deepEqual(
    svgRenderSortKey(
      svgSurfaceRenderItem(projectedTestFace('surface', 2, 4, 0), 7, 3),
    ),
    {
      layer: 2,
      categoryRank: 0,
      surfaceDepthOrder: 7,
      id: 'surface',
      stableIndex: 3,
      kindRank: 0,
    },
  )
  assert.deepEqual(
    svgRenderSortKey(svgNonSurfaceRenderItem('label', 'label', 2, 4)),
    {
      layer: 2,
      categoryRank: 1,
      surfaceDepthOrder: 0,
      id: 'label',
      stableIndex: 4,
      kindRank: 5,
    },
  )
})

function primitiveCoverageDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.camera = testCamera
  diagram.view = { camera3d: testCamera }
  diagram.strata = [
    polygonSheet(),
    createWorkPlaneFilledSheet3DStratum({
      id: 'filled-sheet',
      name: 'Filled sheet',
      planeFrame: xyFrame,
      boundaries: [closedBoundary('filled-boundary', squarePoints(0, 0, 1, 0.2))],
      layer: 4,
    }),
    createCurvedSheetStratum({
      id: 'saddle-sheet',
      name: 'Saddle sheet',
      primitive: {
        kind: 'saddle',
        frame: xyFrame,
        width: 1.2,
        depth: 1,
        height: 0.35,
        sampling: { uSegments: 2, vSegments: 2 },
      },
      layer: 5,
    }),
    createCurvedSheetStratum({
      id: 'ruled-sheet',
      name: 'Ruled sheet',
      primitive: {
        kind: 'ruledSurface',
        boundary0: boundaryPath('ruled-bottom', [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0.2 },
        ]),
        boundary1: boundaryPath('ruled-top', [
          { x: -1, y: 0.8, z: 0.7 },
          { x: 1, y: 0.8, z: 0.9 },
        ]),
        sampling: { segments: 2 },
      },
      layer: 6,
    }),
    createCurvedSheetStratum({
      id: 'coons-sheet',
      name: 'Coons sheet',
      primitive: {
        kind: 'coonsPatch',
        bottom: boundaryPath('coons-bottom', [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0.1 },
        ]),
        right: boundaryPath('coons-right', [
          { x: 1, y: 0, z: 0.1 },
          { x: 1, y: 1, z: 0.3 },
        ]),
        top: boundaryPath('coons-top', [
          { x: 0, y: 1, z: 0.2 },
          { x: 1, y: 1, z: 0.3 },
        ]),
        left: boundaryPath('coons-left', [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 1, z: 0.2 },
        ]),
        sampling: { uSegments: 2, vSegments: 2 },
      },
      layer: 7,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'polyline-curve',
      name: 'Polyline curve',
      points: [
        { x: -1, y: -0.8, z: 0 },
        { x: 0, y: -0.6, z: 0.5 },
        { x: 1, y: -0.8, z: 0.1 },
      ],
      layer: 8,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'cubic-curve',
      kind: 'cubicBezier',
      name: 'Cubic curve',
      points: [
        { x: -1, y: -1.2, z: 0 },
        { x: -0.4, y: -1.5, z: 1 },
        { x: 0.4, y: -0.9, z: -0.2 },
        { x: 1, y: -1.2, z: 0.4 },
      ],
      layer: 8,
    }),
    createConcatenatedPathStratum({
      ambientDimension: 3,
      id: 'path-curve',
      name: 'Path curve',
      segments: [
        {
          kind: 'line',
          start: { x: -1, y: -1.6, z: 0 },
          end: { x: 0, y: -1.6, z: 0.3 },
        },
        {
          kind: 'cubicBezier',
          start: { x: 0, y: -1.6, z: 0.3 },
          control1: { x: 0.2, y: -1.2, z: 0.8 },
          control2: { x: 0.8, y: -2, z: 0.1 },
          end: { x: 1, y: -1.6, z: 0.5 },
        },
      ],
      layer: 8,
    }),
    createTemplatePathStratum({
      ambientDimension: 3,
      id: 'template-curve',
      name: 'Template curve',
      template: {
        kind: 'circleTemplate',
        center: { x: 1.8, y: 0, z: 0.6 },
        radius: 0.35,
        frame: xyFrame,
      },
      layer: 9,
    }),
    createGridStratum({
      ambientDimension: 3,
      id: 'grid-curve',
      name: 'Grid curve',
      frame: workPlaneGridFrame(xyFrame),
      uRange: numericRange(0, 1, 1),
      vRange: numericRange(0, 1, 1),
      clip: {
        kind: 'rectangle',
        uMin: createNumericScalarInputValue(0),
        uMax: createNumericScalarInputValue(1),
        vMin: createNumericScalarInputValue(0),
        vMax: createNumericScalarInputValue(1),
      },
      layer: 10,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'point-a',
      name: 'Point A',
      position: { x: 0.2, y: 0.2, z: 1.4 },
      layer: 11,
    }),
  ]

  return diagram
}

function twoSurfaceSortDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const viewDirection = cameraBasisFromTikz3dplotAngles(
    testCamera.thetaDeg,
    testCamera.phiDeg,
  ).forward

  diagram.camera = testCamera
  diagram.view = { camera3d: testCamera }
  diagram.strata = [
    surfaceSortSheet('a-near', 'Near sheet', '#AA0000', viewDirection, -0.6),
    surfaceSortSheet('z-far', 'Far sheet', '#00AA00', viewDirection, 0.6),
  ]

  return diagram
}

function surfaceFaceCollectorCapDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const viewDirection = cameraBasisFromTikz3dplotAngles(
    testCamera.thetaDeg,
    testCamera.phiDeg,
  ).forward

  diagram.camera = testCamera
  diagram.view = { camera3d: testCamera }
  diagram.strata = [
    surfaceSortSheet('collector-sheet-0', 'Collector sheet 0', '#AA0000', viewDirection, 0),
    surfaceSortSheet('collector-sheet-1', 'Collector sheet 1', '#00AA00', viewDirection, 1),
    throwingCurveStratum(),
  ]

  return diagram
}

function throwingCurveStratum(): Diagram['strata'][number] {
  return {
    id: 'throwing-curve',
    codim: 2,
    geometricKind: 'curve',
    name: 'Throwing curve',
    layer: 0,
    get kind() {
      throw new Error('Curve primitives should not be sampled.')
    },
  } as unknown as Diagram['strata'][number]
}

function surfaceSortSheet(
  id: string,
  name: string,
  fillColor: '#AA0000' | '#00AA00',
  viewDirection: Vec3,
  depthOffset: number,
): PolygonSheetStratum {
  return {
    id,
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    name,
    style: {
      ...defaultSheetStyle,
      fillColor,
      strokeColor: fillColor,
      fillOpacity: 0.5,
      strokeOpacity: 1,
    },
    vertices: squarePoints(-0.5, -0.5, 1, 0).map((point) =>
      addVec3(point, scaleVec3(viewDirection, depthOffset)),
    ),
    layer: 0,
  }
}

function polygonSheet(): PolygonSheetStratum {
  return {
    id: 'polygon-sheet',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    name: 'Polygon sheet',
    style: defaultSheetStyle,
    vertices: squarePoints(-1.4, 0.2, 0.8, 0.4),
    layer: 3,
  }
}

function squarePoints(x: number, y: number, size: number, z: number): Vec3[] {
  return [
    { x, y, z },
    { x: x + size, y, z },
    { x: x + size, y: y + size, z },
    { x, y: y + size, z },
  ]
}

function closedBoundary(id: string, points: readonly Vec3[]): ClosedPathBoundary {
  return {
    id,
    segments: closedLineSegments(points),
  }
}

function boundaryPath(
  id: string,
  points: readonly [Vec3, Vec3],
): BoundaryPathSnapshot {
  return {
    id,
    segments: [
      {
        kind: 'line',
        start: points[0],
        end: points[1],
      },
    ],
  }
}

function closedLineSegments(points: readonly Vec3[]): PathSegment[] {
  return points.map((point, index) => ({
    kind: 'line',
    start: point,
    end: points[(index + 1) % points.length],
  }))
}

function numericRange(min: number, max: number, step: number) {
  return {
    min: createNumericScalarInputValue(min),
    max: createNumericScalarInputValue(max),
    step: createNumericScalarInputValue(step),
  }
}

function projectedTestFace(
  sourceId: string,
  layer: number,
  depth: number,
  originalIndex: number,
): ProjectedSurfaceFace {
  return {
    kind: 'surfaceFace',
    sourceId,
    layer,
    projectedPolygon: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    vertices3D: [
      { x: 0, y: 0, z: depth },
      { x: 1, y: 0, z: depth },
      { x: 1, y: 1, z: depth },
    ],
    depth: {
      min: depth,
      max: depth,
      avg: depth,
    },
    faceIndex: originalIndex,
    originalIndex,
  }
}

function svgSurfaceRenderItem(
  face: ProjectedSurfaceFace,
  surfaceSortIndex: number,
  stableIndex: number,
  id = face.sourceId,
): SvgRenderableSortItem {
  return {
    id,
    layer: face.layer,
    renderKind: 'surfaceFace',
    stableIndex,
    surfaceFace: face,
    surfaceSortIndex,
  }
}

function svgNonSurfaceRenderItem(
  renderKind: Exclude<SvgRenderableSortItem['renderKind'], 'surfaceFace'>,
  id: string,
  layer: number,
  stableIndex: number,
): SvgRenderableSortItem {
  return {
    id,
    layer,
    renderKind,
    stableIndex,
  }
}

function sortedSvgRenderItems(
  items: readonly SvgRenderableSortItem[],
): SvgRenderableSortItem[] {
  return [...items].sort(compareSvgRenderItems)
}

function sortedSvgRenderItemIds(
  items: readonly SvgRenderableSortItem[],
): string[] {
  return sortedSvgRenderItems(items).map((item) => item.id)
}

function assertSvgRenderComparatorTransitive(
  items: readonly SvgRenderableSortItem[],
): void {
  for (const first of items) {
    for (const second of items) {
      for (const third of items) {
        if (
          compareSvgRenderItems(first, second) <= 0 &&
          compareSvgRenderItems(second, third) <= 0
        ) {
          assert.ok(
            compareSvgRenderItems(first, third) <= 0,
            `${first.id} <= ${second.id} and ${second.id} <= ${third.id}, but ${first.id} > ${third.id}`,
          )
        }
      }
    }
  }
}

function enabledVisibilityOptions(sortMode: 'layerThenDepth' | 'depthThenLayer') {
  return {
    enabled: true,
    surfaceDepthSort: true,
    curveOcclusion: true,
    pointVisibility: 'dimHidden',
    labelVisibility: 'alwaysForeground',
    sortMode,
    depthEpsilon: 1e-9,
  } as const
}

function isSurfaceFace(
  primitive: ProjectedRenderPrimitive,
): primitive is ProjectedSurfaceFace {
  return primitive.kind === 'surfaceFace'
}

function primitiveSignature(primitive: ProjectedRenderPrimitive) {
  return {
    kind: primitive.kind,
    sourceId: primitive.sourceId,
    layer: primitive.layer,
    originalIndex: primitive.originalIndex,
  }
}

function assertFinitePrimitive(primitive: ProjectedRenderPrimitive): void {
  assert.equal(Number.isFinite(primitive.layer), true)
  assert.equal(Number.isFinite(primitive.depth.min), true)
  assert.equal(Number.isFinite(primitive.depth.max), true)
  assert.equal(Number.isFinite(primitive.depth.avg), true)
  assert.equal(Number.isFinite(primitive.originalIndex), true)

  switch (primitive.kind) {
    case 'surfaceFace':
      primitive.projectedPolygon.forEach(assertFiniteVec2)
      primitive.vertices3D.forEach(assertFiniteVec3)
      break
    case 'curveSegment':
      assertFiniteVec2(primitive.projectedStart)
      assertFiniteVec2(primitive.projectedEnd)
      primitive.endpoints3D.forEach(assertFiniteVec3)
      break
    case 'point':
      assertFiniteVec2(primitive.projectedPosition)
      assertFiniteVec3(primitive.position3D)
      break
  }
}

function assertFiniteVec2(point: Vec2): void {
  assert.equal(Number.isFinite(point.x), true)
  assert.equal(Number.isFinite(point.y), true)
}

function assertFiniteVec3(point: Vec3): void {
  assert.equal(Number.isFinite(point.x), true)
  assert.equal(Number.isFinite(point.y), true)
  assert.equal(Number.isFinite(point.z), true)
}

function findCurvedSheet(diagram: Diagram, id: string): CurvedSheetStratum {
  const sheet = diagram.strata.find(
    (stratum): stratum is CurvedSheetStratum =>
      stratum.geometricKind === 'sheet' &&
      stratum.kind === 'curvedSheet' &&
      stratum.id === id,
  )

  assert.notEqual(sheet, undefined)

  return sheet
}

function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

function scaleVec3(point: Vec3, scalar: number): Vec3 {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar,
  }
}
