import assert from 'node:assert/strict'
import test from 'node:test'
import { absoluteCubicBezierPointsFromControlMode } from '../../src/geometry/bezierControls.ts'
import {
  cubicBezierToSvgPath,
  polylineToSvgPath,
  regularPolygonPoints,
  starPolygonPoints,
} from '../../src/rendering/svgPath.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'
import { projectVec3 } from '../../src/geometry/projection.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import type { CubicBezierControlMode, Diagram } from '../../src/model/types.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { addPolylineCurveStratum } from '../../src/ui/diagramUpdates.ts'
import {
  lineStyleToStrokeDasharray,
  svgLabelAnchorPlacement,
} from '../../src/rendering/svgStyle.ts'
import { mapClientPointToViewBox } from '../../src/rendering/svgViewBox.ts'
import {
  curveHandleLabel,
  shouldRenderSvgGeometryHandles,
  vertexHandleLabel,
} from '../../src/rendering/svgGeometryHandles.ts'

test('polylineToSvgPath emits a readable move and line path', () => {
  assert.equal(
    polylineToSvgPath([
      { x: 0, y: 1 },
      { x: 2.25, y: 3.5 },
      { x: -1, y: 0 },
    ]),
    'M 0,1 L 2.25,3.5 L -1,0',
  )
})

test('cubicBezierToSvgPath emits a cubic SVG path for four points', () => {
  assert.equal(
    cubicBezierToSvgPath([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 0 },
    ]),
    'M 0,0 C 1,2 3,2 4,0',
  )
})

test('cubic Bezier SVG path uses stored absolute points rather than control metadata', () => {
  const absolutePoints = [
    { x: 0, y: 0, z: 0 },
    { x: 99, y: 0, z: 1 },
    { x: 2, y: 0, z: 2 },
    { x: 3, y: 0, z: 3 },
  ]
  const metadata: CubicBezierControlMode = {
    kind: 'workPlaneRelativeCartesian',
    frame: {
      origin: { x: 0, y: 0, z: 0 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: -1, z: 0 },
    },
    localStart: { a: 0, b: 0 },
    localEnd: { a: 3, b: 3 },
    firstControlOffset: { dx: 1, dy: 1 },
    secondControlOffset: { dx: -1, dy: -1 },
    secondOffsetReference: 'end',
  }
  const metadataPoints = absoluteCubicBezierPointsFromControlMode(
    3,
    absolutePoints[0],
    absolutePoints[3],
    metadata,
  )
  const pathFromStoredPoints = cubicBezierToSvgPath(
    absolutePoints.map((point) => ({ x: point.x, y: point.z })),
  )
  const pathFromMetadata = cubicBezierToSvgPath(
    (metadataPoints ?? []).map((point) => ({ x: point.x, y: point.z })),
  )

  assert.equal(pathFromStoredPoints, 'M 0,0 C 99,1 2,2 3,3')
  assert.notEqual(pathFromStoredPoints, pathFromMetadata)
})

test('line styles map to SVG dash arrays', () => {
  assert.equal(lineStyleToStrokeDasharray('solid'), undefined)
  assert.equal(lineStyleToStrokeDasharray('dashed'), '8 5')
  assert.equal(lineStyleToStrokeDasharray('dotted'), '1 5')
  assert.equal(lineStyleToStrokeDasharray('denselyDotted'), '1 2')
})

test('label anchor placement maps every supported anchor to TikZ-like SVG placement', () => {
  const fontSize = 20

  assert.deepEqual(svgLabelAnchorPlacement('center', fontSize), {
    textAnchor: 'middle',
    dominantBaseline: 'middle',
    dx: 0,
    dy: 0,
  })
  assert.deepEqual(svgLabelAnchorPlacement('north', fontSize), {
    textAnchor: 'middle',
    dominantBaseline: 'middle',
    dx: 0,
    dy: 10,
  })
  assert.deepEqual(svgLabelAnchorPlacement('south', fontSize), {
    textAnchor: 'middle',
    dominantBaseline: 'middle',
    dx: 0,
    dy: -10,
  })
  assert.deepEqual(svgLabelAnchorPlacement('east', fontSize), {
    textAnchor: 'end',
    dominantBaseline: 'middle',
    dx: 0,
    dy: 0,
  })
  assert.deepEqual(svgLabelAnchorPlacement('west', fontSize), {
    textAnchor: 'start',
    dominantBaseline: 'middle',
    dx: 0,
    dy: 0,
  })
  assert.deepEqual(svgLabelAnchorPlacement('north east', fontSize), {
    textAnchor: 'end',
    dominantBaseline: 'middle',
    dx: 0,
    dy: 10,
  })
  assert.deepEqual(svgLabelAnchorPlacement('north west', fontSize), {
    textAnchor: 'start',
    dominantBaseline: 'middle',
    dx: 0,
    dy: 10,
  })
  assert.deepEqual(svgLabelAnchorPlacement('south east', fontSize), {
    textAnchor: 'end',
    dominantBaseline: 'middle',
    dx: 0,
    dy: -10,
  })
  assert.deepEqual(svgLabelAnchorPlacement('south west', fontSize), {
    textAnchor: 'start',
    dominantBaseline: 'middle',
    dx: 0,
    dy: -10,
  })
})

test('label vertical offsets are applied after model-to-SVG y conversion', () => {
  const diagram = createCameraTestDiagram()
  const camera = resolveSvgCamera(diagram, 200, 120)
  const lower = projectToSvgPoint(camera, { x: 0, y: -1, z: 0 }, 120)
  const upper = projectToSvgPoint(camera, { x: 0, y: 1, z: 0 }, 120)

  assert.ok(upper.y < lower.y)
  assert.ok(svgLabelAnchorPlacement('north', 20).dy > 0)
  assert.ok(svgLabelAnchorPlacement('south', 20).dy < 0)
})

test('regularPolygonPoints creates one vertex per requested side', () => {
  const square = regularPolygonPoints({ x: 10, y: 20 }, 5, 4, Math.PI / 4)
  const triangle = regularPolygonPoints({ x: 0, y: 0 }, 2, 3, -Math.PI / 2)

  assert.equal(square.length, 4)
  assert.equal(triangle.length, 3)
})

test('starPolygonPoints creates a simple five-point star polygon', () => {
  const star = starPolygonPoints({ x: 0, y: 0 }, 10, 4)

  assert.equal(star.length, 10)
  assert.ok(Math.abs(star[0].x) < 1e-12)
  assert.equal(star[0].y, -10)
})

test('resolveSvgCamera uses diagram camera by default', () => {
  const diagram = createCameraTestDiagram()
  const camera = resolveSvgCamera(diagram, 200, 120)
  const viewPoint = projectVec3(camera, { x: 2, y: 3, z: 0 })
  const svgPoint = projectToSvgPoint(camera, { x: 2, y: 3, z: 0 }, 120)

  assert.deepEqual(camera, diagram.camera)
  assert.deepEqual(viewPoint, { x: 34, y: 51 })
  assert.deepEqual(svgPoint, { x: 34, y: 69 })
})

test('resolveSvgCamera uses fitted camera only when explicitly requested', () => {
  const diagram = createCameraTestDiagram()
  const defaultCamera = resolveSvgCamera(diagram, 200, 120)
  const fittedCamera = resolveSvgCamera(diagram, 200, 120, { fitToView: true })

  assert.deepEqual(defaultCamera, diagram.camera)
  assert.notDeepEqual(fittedCamera, diagram.camera)
})

test('resolveSvgCamera fitted bounds include optional extra fit points', () => {
  const diagram = createCameraTestDiagram()
  const extraPoint = { x: 10, y: 3, z: 0 }
  const withoutExtra = resolveSvgCamera(diagram, 200, 120, { fitToView: true })
  const withExtra = resolveSvgCamera(diagram, 200, 120, {
    fitToView: true,
    extraPointsForFit: [extraPoint],
  })

  assert.notDeepEqual(withExtra, withoutExtra)
  assert.ok(projectToSvgPoint(withoutExtra, extraPoint, 120).x > 200)
  assert.ok(projectToSvgPoint(withExtra, extraPoint, 120).x <= 200)
  assert.deepEqual(diagram, createCameraTestDiagram())
})

test('resolveSvgCamera matches draft and committed polyline framing', () => {
  const diagram = createCameraTestDiagram()
  const draftPoints = [
    { x: 2, y: 3, z: 0 },
    { x: 10, y: 3, z: 0 },
  ]
  const draftCamera = resolveSvgCamera(diagram, 200, 120, {
    fitToView: true,
    extraPointsForFit: draftPoints,
  })
  const committedDiagram = addPolylineCurveStratum(diagram, draftPoints, {
    id: 'curve-1',
  })
  const committedCamera = resolveSvgCamera(committedDiagram, 200, 120, {
    fitToView: true,
  })

  assert.deepEqual(draftCamera, committedCamera)
  assert.equal(diagram.strata.length, 1)
})

test('resolveSvgCamera returns a safe fitted camera for empty diagrams', () => {
  const empty2dCamera = resolveSvgCamera(
    createEmptyDiagram({ ambientDimension: 2 }),
    200,
    120,
    { fitToView: true },
  )
  const empty3dCamera = resolveSvgCamera(
    createEmptyDiagram({ ambientDimension: 3 }),
    200,
    120,
    { fitToView: true },
  )
  const origin = projectToSvgPoint(empty2dCamera, { x: 0, y: 0, z: 0 }, 120)

  assert.equal(empty2dCamera.mode, '2d')
  assert.equal(empty3dCamera.mode, '3d')
  assert.equal(Number.isFinite(empty2dCamera.scale), true)
  assert.equal(Number.isFinite(empty3dCamera.scale), true)
  assert.deepEqual(origin, { x: 100, y: 60 })
})

test('3D coordinate axes guide data is available for preview rendering', () => {
  const guide = createCoordinateAxesGuide(3)

  assert.notEqual(guide, null)
  if (guide === null) {
    throw new Error('Expected a 3D coordinate axes guide.')
  }

  assert.deepEqual(
    guide.axes.map((axis) => axis.axis),
    ['x', 'y', 'z'],
  )
  assert.deepEqual(guide.axes[0].from, { x: 0, y: 0, z: 0 })
  assert.deepEqual(guide.axes[0].to, { x: 2.5, y: 0, z: 0 })
  assert.equal(guide.fitPoints.length, 9)
})

test('2D diagrams do not create a 3D coordinate axes guide', () => {
  assert.equal(createCoordinateAxesGuide(2), null)
})

test('coordinate axes guide is preview-only and not selectable', () => {
  const guide = createCoordinateAxesGuide(3)

  assert.notEqual(guide, null)
  if (guide === null) {
    throw new Error('Expected a 3D coordinate axes guide.')
  }

  assert.equal(guide.pointerEvents, 'none')
  assert.equal(guide.selectable, false)
})

test('empty 3D coordinate axes guide projects with the SVG camera', () => {
  const guide = createCoordinateAxesGuide(3)

  assert.notEqual(guide, null)
  if (guide === null) {
    throw new Error('Expected a 3D coordinate axes guide.')
  }

  const camera = resolveSvgCamera(
    createEmptyDiagram({ ambientDimension: 3 }),
    200,
    120,
    {
      fitToView: true,
      extraPointsForFit: guide.fitPoints,
    },
  )
  const projectedPoints = guide.fitPoints.map((point) =>
    projectToSvgPoint(camera, point, 120),
  )

  assert.equal(camera.mode, '3d')
  assert.ok(
    projectedPoints.every(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 200 &&
        point.y >= 0 &&
        point.y <= 120,
    ),
  )
})

test('projectToSvgPoint keeps positive x right and makes positive y appear upward', () => {
  const diagram = createCameraTestDiagram()
  const camera = resolveSvgCamera(diagram, 200, 120)
  const left = projectToSvgPoint(camera, { x: -1, y: 0, z: 0 }, 120)
  const right = projectToSvgPoint(camera, { x: 1, y: 0, z: 0 }, 120)
  const lower = projectToSvgPoint(camera, { x: 0, y: -1, z: 0 }, 120)
  const upper = projectToSvgPoint(camera, { x: 0, y: 1, z: 0 }, 120)

  assert.ok(right.x > left.x)
  assert.ok(upper.y < lower.y)
})

test('mapClientPointToViewBox is unchanged when aspect ratios match', () => {
  assert.deepEqual(
    mapClientPointToViewBox(
      { x: 260, y: 180 },
      { left: 0, top: 0, width: 1040, height: 720 },
      { width: 520, height: 360 },
    ),
    { x: 130, y: 90 },
  )
})

test('mapClientPointToViewBox ignores horizontal letterbox padding for xMidYMid meet', () => {
  const bounds = { left: 10, top: 20, width: 1200, height: 720 }
  const viewBox = { width: 520, height: 360 }

  assert.deepEqual(
    mapClientPointToViewBox({ x: 90, y: 20 }, bounds, viewBox),
    { x: 0, y: 0 },
  )
  assert.deepEqual(
    mapClientPointToViewBox({ x: 600, y: 380 }, bounds, viewBox),
    { x: 255, y: 180 },
  )
  assert.deepEqual(
    mapClientPointToViewBox({ x: 610, y: 380 }, bounds, viewBox),
    { x: 260, y: 180 },
  )
  assert.deepEqual(
    mapClientPointToViewBox({ x: 1130, y: 740 }, bounds, viewBox),
    { x: 520, y: 360 },
  )
})

test('mapClientPointToViewBox ignores vertical letterbox padding for xMidYMid meet', () => {
  const bounds = { left: 10, top: 20, width: 1040, height: 900 }
  const viewBox = { width: 520, height: 360 }

  assert.deepEqual(
    mapClientPointToViewBox({ x: 10, y: 110 }, bounds, viewBox),
    { x: 0, y: 0 },
  )
  assert.deepEqual(
    mapClientPointToViewBox({ x: 530, y: 470 }, bounds, viewBox),
    { x: 260, y: 180 },
  )
  assert.deepEqual(
    mapClientPointToViewBox({ x: 1050, y: 830 }, bounds, viewBox),
    { x: 520, y: 360 },
  )
})

test('mapClientPointToViewBox clamps clicks inside letterbox padding to the visible edge', () => {
  assert.deepEqual(
    mapClientPointToViewBox(
      { x: 30, y: 380 },
      { left: 10, top: 20, width: 1200, height: 720 },
      { width: 520, height: 360 },
    ),
    { x: 0, y: 180 },
  )
  assert.deepEqual(
    mapClientPointToViewBox(
      { x: 530, y: 50 },
      { left: 10, top: 20, width: 1040, height: 900 },
      { width: 520, height: 360 },
    ),
    { x: 260, y: 0 },
  )
})

test('geometry handles render only when visible and draggable', () => {
  assert.equal(shouldRenderSvgGeometryHandles(true, true), true)
  assert.equal(shouldRenderSvgGeometryHandles(false, true), false)
  assert.equal(shouldRenderSvgGeometryHandles(true, false), false)
  assert.equal(shouldRenderSvgGeometryHandles(false, false), false)
})

test('geometry handle user-facing vertex labels are one-based', () => {
  assert.equal(vertexHandleLabel(0), 'Vertex 1')
  assert.equal(vertexHandleLabel(2), 'Vertex 3')
  assert.equal(curveHandleLabel('polyline', 0), 'Vertex 1')
  assert.equal(curveHandleLabel('polyline', 1), 'Vertex 2')
  assert.equal(curveHandleLabel('cubicBezier', 0), 'Start')
  assert.equal(curveHandleLabel('cubicBezier', 1), 'Control point 1')
  assert.equal(curveHandleLabel('cubicBezier', 2), 'Control point 2')
  assert.equal(curveHandleLabel('cubicBezier', 3), 'End')
  assert.equal(curveHandleLabel('cubicBezier', 4), 'Point 5')
})

function createCameraTestDiagram(): Diagram {
  return {
    version: 1,
    ambientDimension: 2,
    camera: {
      mode: '2d',
      scale: 12,
      origin: { x: 10, y: 15 },
    },
    strata: [
      {
        id: 'testPoint',
        codim: 2,
        geometricKind: 'point',
        name: 'Test point',
        style: {
          kind: 'pointStyle',
          color: '#000000',
          opacity: 1,
          shape: 'circle',
          fill: 'filled',
          size: 3,
        },
        position: { x: 2, y: 3, z: 0 },
        layer: 0,
      },
    ],
    labels: [],
  }
}
