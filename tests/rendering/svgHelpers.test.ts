import assert from 'node:assert/strict'
import test from 'node:test'
import { absoluteCubicBezierPointsFromControlMode } from '../../src/geometry/bezierControls.ts'
import { threeDimensionalExample } from '../../src/examples/index.ts'
import {
  closedBoundariesToSvgPathData,
  cubicBezierToSvgPath,
  pathSegmentsToSvgPath,
  polylineToSvgPath,
  regularPolygonPoints,
  starPolygonPoints,
  svgFillRuleValue,
} from '../../src/rendering/svgPath.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'
import { projectVec3 } from '../../src/geometry/projection.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import {
  pathSegmentStyleRuns,
  resolvePathSegmentStyle,
} from '../../src/model/paths.ts'
import type {
  Camera3D,
  ClosedPathBoundary,
  CurveStyle,
  CurvedSheetStratum,
  CubicBezierControlMode,
  Diagram,
  PathSegment,
  RegionStyle,
  SheetStyle,
  SurfaceFrame,
  Vec3,
} from '../../src/model/types.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { curvedSheetToSvgMesh } from '../../src/rendering/curvedSheetMesh.ts'
import {
  projectToSvgPoint,
  svgPointToModelOnWorkPlane,
} from '../../src/rendering/svgProjection.ts'
import { createCameraPresetCamera } from '../../src/ui/cameraControls.ts'
import { addPolylineCurveStratum } from '../../src/ui/diagramUpdates.ts'
import {
  curveStyleToSvgStrokeAttributes,
  filledSurfaceStyleToSvgAttributes,
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

test('pathSegmentsToSvgPath emits a continuous line and cubic path', () => {
  assert.equal(
    pathSegmentsToSvgPath([
      {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
      },
      {
        kind: 'cubicBezier',
        start: { x: 1, y: 0 },
        control1: { x: 1.5, y: 1 },
        control2: { x: 2.5, y: 1 },
        end: { x: 3, y: 0 },
      },
    ]),
    'M 0,0 L 1,0 C 1.5,1 2.5,1 3,0',
  )
})

test('2D filled-region boundaries produce non-empty closed SVG path data', () => {
  const pathData = closedBoundariesToSvgPathData(
    [squareBoundary2D('outer')],
    (point) => ({ x: point.x, y: point.y }),
  )

  assert.equal(pathData, 'M 0,0 L 2,0 L 2,2 L 0,2 L 0,0 Z')
  assert.notEqual(pathData, '')
})

test('closed boundary SVG path data supports cubic Bezier segments', () => {
  const pathData = closedBoundariesToSvgPathData(
    [
      {
        id: 'cubic-loop',
        segments: [
          {
            kind: 'cubicBezier',
            start: { x: 0, y: 0, z: 0 },
            control1: { x: 0.5, y: 1, z: 0 },
            control2: { x: 1.5, y: 1, z: 0 },
            end: { x: 2, y: 0, z: 0 },
          },
          {
            kind: 'line',
            start: { x: 2, y: 0, z: 0 },
            end: { x: 0, y: 0, z: 0 },
          },
        ],
      },
    ],
    (point) => ({ x: point.x, y: point.y }),
  )

  assert.equal(pathData, 'M 0,0 C 0.5,1 1.5,1 2,0 L 0,0 Z')
})

test('2D filled-region multiple boundaries use compound path data and even-odd fill rule', () => {
  const pathData = closedBoundariesToSvgPathData(
    [squareBoundary2D('outer', 0, 0, 4), squareBoundary2D('inner', 1, 1, 1)],
    (point) => ({ x: point.x, y: point.y }),
  )

  assert.equal((pathData.match(/M /g) ?? []).length, 2)
  assert.equal(svgFillRuleValue('evenOdd'), 'evenodd')
  assert.equal(svgFillRuleValue('nonzero'), 'nonzero')
})

test('closed boundary SVG path data omits non-finite projected output', () => {
  const pathData = closedBoundariesToSvgPathData(
    [
      {
        ...squareBoundary2D('non-finite'),
        segments: [
          {
            kind: 'line',
            start: { x: 0, y: 0, z: 0 },
            end: { x: Number.NaN, y: 1, z: 0 },
          },
        ],
      },
    ],
    (point) => ({ x: point.x, y: point.y }),
  )

  assert.equal(pathData, '')
  assert.doesNotMatch(pathData, /NaN/)
  assert.doesNotMatch(pathData, /Infinity/)
})

test('3D work-plane-filled sheet boundaries produce projected SVG path data', () => {
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 13,
    phiDeg: -23,
    zoom: 18,
    pan: { x: 110, y: 65 },
    projectionBasis: {
      xVector: [1, 0],
      yVector: [0.45, 0.25],
      zVector: [0, 1],
    },
  }
  const pathData = closedBoundariesToSvgPathData(
    [squareBoundary3D('sheet-boundary', 2)],
    (point) => projectToSvgPoint(camera, point, 160),
  )

  assert.notEqual(pathData, '')
  assert.match(pathData, /^M /)
  assert.match(pathData, / Z$/)
})

test('3D work-plane-filled sheet multiple boundaries use compound path data and even-odd fill rule', () => {
  const camera = createInitialCamera3D()
  const pathData = closedBoundariesToSvgPathData(
    [
      squareBoundary3D('outer', 2, 0, 0, 4),
      squareBoundary3D('inner', 2, 1, 1, 1),
    ],
    (point) => projectToSvgPoint(camera, point, 160),
  )

  assert.equal((pathData.match(/M /g) ?? []).length, 2)
  assert.equal(svgFillRuleValue('evenOdd'), 'evenodd')
})

test('hemisphere curved sheet projects to deterministic SVG mesh polygons', () => {
  const sheet = curvedHemisphereSheet()
  const mesh = curvedSheetToSvgMesh(sheet, createInitialCamera3D(), 240)

  assert.equal(mesh.primitiveKind, 'hemisphere')
  assert.equal(mesh.uSegments, 8)
  assert.equal(mesh.vSegments, 4)
  assert.equal(mesh.faces.length, 32)
  assert.equal(mesh.boundaryPathData.length, 1)
  assert.match(mesh.boundaryPathData[0], /^M /)
  assert.equal(mesh.faces[0].points.split(' ').length, 4)
  assert.doesNotMatch(
    mesh.faces.map((face) => face.points).join('\n'),
    /NaN|Infinity/,
  )
})

test('saddle curved sheet projects to one SVG polygon per sampled face', () => {
  const sheet = curvedSaddleSheet()
  const mesh = curvedSheetToSvgMesh(sheet, createInitialCamera3D(), 240)

  assert.equal(mesh.primitiveKind, 'saddle')
  assert.equal(mesh.uSegments, 6)
  assert.equal(mesh.vSegments, 5)
  assert.equal(mesh.faces.length, 30)
  assert.equal(mesh.boundaryPathData.length, 1)
  assert.doesNotMatch(
    [
      ...mesh.faces.map((face) => face.points),
      ...mesh.boundaryPathData,
    ].join('\n'),
    /NaN|Infinity/,
  )
})

test('filled surface SVG attributes preserve fill and stroke style values', () => {
  const regionStyle: RegionStyle = {
    kind: 'regionStyle',
    fillColor: '#112233',
    fillOpacity: 0.42,
    strokeColor: '#445566',
    strokeOpacity: 0.73,
  }
  const sheetStyle: SheetStyle = {
    kind: 'sheetStyle',
    fillColor: '#AABBCC',
    fillOpacity: 0.35,
    strokeColor: '#DDEEFF',
    strokeOpacity: 0.9,
  }

  assert.deepEqual(filledSurfaceStyleToSvgAttributes(regionStyle), {
    fill: '#112233',
    fillOpacity: 0.42,
    stroke: '#445566',
    strokeOpacity: 0.73,
    strokeWidth: 1.5,
  })
  assert.deepEqual(filledSurfaceStyleToSvgAttributes(sheetStyle, 2), {
    fill: '#AABBCC',
    fillOpacity: 0.35,
    stroke: '#DDEEFF',
    strokeOpacity: 0.9,
    strokeWidth: 2,
  })
})

test('line styles map to SVG dash arrays', () => {
  assert.equal(lineStyleToStrokeDasharray('solid'), undefined)
  assert.equal(lineStyleToStrokeDasharray('dashed'), '8 5')
  assert.equal(lineStyleToStrokeDasharray('dotted'), '1 5')
  assert.equal(lineStyleToStrokeDasharray('denselyDotted'), '1 2')
})

test('segment style override changes resolved SVG stroke attributes', () => {
  const pathStyle: CurveStyle = {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
  }
  const segment: PathSegment = {
    kind: 'line',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1, y: 0, z: 0 },
    styleOverride: {
      strokeColor: '#AA0033',
      strokeOpacity: 0.5,
      lineWidth: 2.4,
      lineStyle: 'denselyDotted',
    },
  }

  assert.deepEqual(
    curveStyleToSvgStrokeAttributes(resolvePathSegmentStyle(pathStyle, segment)),
    {
      stroke: '#AA0033',
      strokeOpacity: 0.5,
      strokeWidth: 2.4,
      strokeDasharray: '1 2',
    },
  )
})

test('SVG style runs split adjacent concatenated path segments by resolved style', () => {
  const pathStyle: CurveStyle = {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
  }
  const segments: PathSegment[] = [
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
  ]
  const runs = pathSegmentStyleRuns(segments, pathStyle)

  assert.deepEqual(
    runs.map((run) => ({
      startIndex: run.startIndex,
      lineStyle: run.style.lineStyle,
      segmentCount: run.segments.length,
    })),
    [
      { startIndex: 0, lineStyle: 'solid', segmentCount: 1 },
      { startIndex: 1, lineStyle: 'dotted', segmentCount: 1 },
    ],
  )
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

test('resolveSvgCamera camera override changes preview without mutating diagram', () => {
  const before = JSON.stringify(threeDimensionalExample)
  const camera = resolveSvgCamera(threeDimensionalExample, 200, 120, {
    fitToView: true,
    cameraOverride: createCameraPresetCamera('isometric'),
    viewAdjustment: {
      zoom: 1.25,
      pan: { x: 8, y: -6 },
    },
  })

  assert.equal(camera.mode, '3d')
  assert.notDeepEqual(camera, threeDimensionalExample.camera)
  assert.equal(JSON.stringify(threeDimensionalExample), before)
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

test('resolveSvgCamera fitted bounds include curved sheet sampled vertices', () => {
  const diagram = createThreeDimensionalCurvedSheetDiagram()
  const camera = resolveSvgCamera(diagram, 200, 120, { fitToView: true })
  const mesh = curvedSheetToSvgMesh(diagram.strata[0] as CurvedSheetStratum, camera, 120)
  const coordinates = mesh.faces.flatMap((face) =>
    face.points.split(' ').map((point) => point.split(',').map(Number)),
  )

  assert.ok(coordinates.length > 0)
  assert.equal(
    coordinates.every(
      ([x, y]) =>
        x !== undefined &&
        y !== undefined &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        x >= 0 &&
        x <= 200 &&
        y >= 0 &&
        y <= 120,
    ),
    true,
  )
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
  assert.equal(Number.isFinite(empty3dCamera.zoom), true)
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

test('svgPointToModelOnWorkPlane preserves initial-camera cursor placement', () => {
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 13,
    phiDeg: -23,
    zoom: 18,
    pan: { x: 110, y: 65 },
    projectionBasis: {
      xVector: [1, 0],
      yVector: [0.45, 0.25],
      zVector: [0, 1],
    },
  }
  const modelPoint = { x: 2, y: 4, z: 0 }
  const svgPoint = projectToSvgPoint(camera, modelPoint, 160)

  assertVec3AlmostEqual(
    svgPointToModelOnWorkPlane(camera, svgPoint, 160, { kind: 'xy', z: 0 }),
    modelPoint,
  )
})

test('svgPointToModelOnWorkPlane uses changed camera angles for 3D cursor placement', () => {
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 14,
    pan: { x: 90, y: 40 },
  }
  const workPlane = { kind: 'yz' as const, x: 1.25 }
  const modelPoint = { x: 1.25, y: -2, z: 3.5 }
  const svgPoint = projectToSvgPoint(camera, modelPoint, 160)

  assertVec3AlmostEqual(
    svgPointToModelOnWorkPlane(camera, svgPoint, 160, workPlane),
    modelPoint,
  )
})

test('svgPointToModelOnWorkPlane keeps 2D inverse behavior unchanged', () => {
  const camera = {
    mode: '2d' as const,
    scale: 12,
    origin: { x: 10, y: 15 },
  }
  const modelPoint = { x: 2, y: -3, z: 99 }
  const svgPoint = projectToSvgPoint(camera, modelPoint, 120)

  assert.deepEqual(
    svgPointToModelOnWorkPlane(camera, svgPoint, 120, { kind: 'xy', z: 4 }),
    { x: 2, y: -3, z: 0 },
  )
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

function createThreeDimensionalCurvedSheetDiagram(): Diagram {
  return {
    version: 1,
    ambientDimension: 3,
    camera: createInitialCamera3D(),
    strata: [curvedHemisphereSheet()],
    labels: [],
  }
}

function curvedHemisphereSheet(): CurvedSheetStratum {
  return {
    id: 'svg-hemisphere',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'SVG Hemisphere',
    style: sheetStyle(),
    primitive: {
      kind: 'hemisphere',
      center: { x: 0, y: 0, z: 0 },
      radius: 2,
      frame: xyPlaneFrameAtZ(0),
      hemisphereSide: 'positive',
      sampling: { uSegments: 8, vSegments: 4 },
    },
    layer: 0,
  }
}

function curvedSaddleSheet(): CurvedSheetStratum {
  return {
    id: 'svg-saddle',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'SVG Saddle',
    style: sheetStyle({
      fillColor: '#55AAEE',
      fillOpacity: 0.41,
      strokeColor: '#114477',
      strokeOpacity: 0.88,
    }),
    primitive: {
      kind: 'saddle',
      frame: xyPlaneFrameAtZ(0),
      width: 4,
      depth: 3,
      height: 1.5,
      sampling: { uSegments: 6, vSegments: 5 },
    },
    layer: 0,
  }
}

function sheetStyle(overrides: Partial<SheetStyle> = {}): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
    ...overrides,
  }
}

function xyPlaneFrameAtZ(z: number): SurfaceFrame {
  return {
    origin: { x: 0, y: 0, z },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function squareBoundary2D(
  id: string,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z: 0 },
    { x: x + size, y, z: 0 },
    { x: x + size, y: y + size, z: 0 },
    { x, y: y + size, z: 0 },
  ])
}

function squareBoundary3D(
  id: string,
  z: number,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z },
    { x: x + size, y, z },
    { x: x + size, y: y + size, z },
    { x, y: y + size, z },
  ])
}

function squareBoundaryFromPoints(
  id: string,
  points: [Vec3, Vec3, Vec3, Vec3],
): ClosedPathBoundary {
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

function assertVec3AlmostEqual(actual: Vec3, expected: Vec3): void {
  assertAlmostEqual(actual.x, expected.x)
  assertAlmostEqual(actual.y, expected.y)
  assertAlmostEqual(actual.z, expected.z)
}

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-10,
    `Expected ${actual} to be approximately ${expected}.`,
  )
}
