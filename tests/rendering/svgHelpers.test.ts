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
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { pathCrossingStateFromCandidate } from '../../src/model/pathCrossings.ts'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
} from '../../src/model/stylePresets.ts'
import { setLayerVisibility } from '../../src/model/layers.ts'
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
  VisibilityOptions,
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
  hiddenCurveStyleToSvgStrokeAttributes,
  lineStyleToStrokeDasharray,
  svgPathCrossingMarkerStyle,
  svgLabelAnchorPlacement,
} from '../../src/rendering/svgStyle.ts'
import { mapClientPointToViewBox } from '../../src/rendering/svgViewBox.ts'
import {
  curveHandleLabel,
  shouldRenderSvgGeometryHandles,
  vertexHandleLabel,
} from '../../src/rendering/svgGeometryHandles.ts'
import {
  shouldRenderStratumInSvgPreview,
  shouldRenderTextLabelInSvgPreview,
} from '../../src/rendering/svgPreviewPolicy.ts'
import {
  curveArrowheadsForSvgPreview,
  type SvgArrowheadPreview,
} from '../../src/rendering/svgArrows.ts'
import { pathInlineNodesForSvgPreview } from '../../src/rendering/svgPathInlineNodes.ts'
import { svgPathCrossingOverlayPrimitives } from '../../src/rendering/svgPathCrossings.ts'
import {
  coordinateAnchorMarkerAppearance,
  coordinateAnchorMarkerClassNames,
  hitTestSvgCoordinateAnchorMarkers,
  svgCoordinateAnchorMarkers,
  svgCoordinateAnchorMarkersForPreview,
} from '../../src/rendering/svgCoordinateAnchors.ts'
import {
  collectSvgPreviewSelectionCandidates,
  createSvgSelectionCandidateVisibility,
  nextSvgPreviewSelectionCycle,
  pickSvgPreviewHitTestCandidate,
  svgPreviewHitTestPriorityRank,
} from '../../src/rendering/svgHitTesting.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { defaultVisibilityOptions } from '../../src/model/visibility.ts'

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

test('SVG arrow preview coordinates are finite for a 2D path', () => {
  const curve = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'svg-arrow-2d',
    name: 'SVG arrow 2D',
    arrows: {
      endpoint: 'both',
      mid: {
        enabled: true,
        position: 0.5,
        direction: 'forward',
        head: 'stealth',
      },
    },
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
      },
      {
        kind: 'cubicBezier',
        start: { x: 2, y: 0, z: 0 },
        control1: { x: 2.5, y: 1, z: 0 },
        control2: { x: 3.5, y: 1, z: 0 },
        end: { x: 4, y: 0, z: 0 },
      },
    ],
  })
  const arrowheads = curveArrowheadsForSvgPreview(curve, 2, (point) => ({
    x: point.x,
    y: point.y,
  }))

  assert.equal(arrowheads.length, 3)
  assert.equal(arrowheads.every(isFiniteSvgArrowhead), true)
})

test('SVG path inline node preview position is finite', () => {
  const curve = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'svg-inline-node-path',
    name: 'SVG inline node path',
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
      },
    ],
    inlineNodes: [
      {
        id: 'svg-inline-node',
        position: { kind: 'segment', segmentIndex: 0, value: 0.5 },
        text: '$f$',
        options: { placement: 'above' },
      },
    ],
  })
  const previews = pathInlineNodesForSvgPreview(curve, 2, (point) => ({
    x: point.x,
    y: point.y,
  }))

  assert.equal(previews.length, 1)
  assert.equal(Number.isFinite(previews[0]?.center.x), true)
  assert.equal(Number.isFinite(previews[0]?.center.y), true)
})

test('SVG preview renders coordinate anchor marker', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const anchor = createCoordinateAnchor(diagram, {
    id: 'svg-coordinate-anchor',
    name: 'Preview coordinate',
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: 0 },
        y: { kind: 'numeric', value: 0 },
        z: { kind: 'numeric', value: 0 },
      },
    },
  })
  const markers = svgCoordinateAnchorMarkers(
    {
      ...diagram,
      coordinateAnchors: [anchor],
    },
    diagram.camera,
    360,
    { kind: 'coordinate', id: anchor.id },
  )

  assert.equal(markers.length, 1)
  assert.equal(markers[0]?.anchor.id, 'svg-coordinate-anchor')
  assert.equal(markers[0]?.selected, true)
  assert.equal(markers[0]?.hitRadius, 11)
  assert.equal(Number.isFinite(markers[0]?.center.x), true)
  assert.equal(Number.isFinite(markers[0]?.center.y), true)
})

test('SVG preview marks multiple selected coordinate anchors', () => {
  const diagram = coordinateAnchorMultiPreviewDiagram()
  const markers = svgCoordinateAnchorMarkers(
    diagram,
    diagram.camera,
    360,
    {
      kind: 'multi',
      elements: [
        { kind: 'coordinate', id: 'preview-coordinate-a' },
        { kind: 'coordinate', id: 'preview-coordinate-c' },
      ],
    },
  )
  const selectedMarkers = markers
    .filter((marker) => marker.selected)
    .map((marker) => marker.anchor.id)

  assert.equal(markers.length, 3)
  assert.deepEqual(selectedMarkers, [
    'preview-coordinate-a',
    'preview-coordinate-c',
  ])
})

test('SVG coordinate anchor marker design uses a dot and dotted halo', () => {
  assert.equal(
    coordinateAnchorMarkerClassNames.marker,
    'coordinate-anchor-marker',
  )
  assert.equal(
    coordinateAnchorMarkerClassNames.halo,
    'coordinate-anchor-marker__halo',
  )
  assert.equal(
    coordinateAnchorMarkerClassNames.dot,
    'coordinate-anchor-marker__dot',
  )
  assert.equal(coordinateAnchorMarkerAppearance.haloStrokeDasharray, '1.5 2')
  assert.ok(
    coordinateAnchorMarkerAppearance.dotRadius <
      coordinateAnchorMarkerAppearance.haloRadius,
  )
  assert.ok(
    coordinateAnchorMarkerAppearance.haloRadius <
      coordinateAnchorMarkerAppearance.hitRadius,
  )
})

test('shown coordinate anchors render preview markers', () => {
  const diagram = coordinateAnchorPreviewDiagram()
  const markers = svgCoordinateAnchorMarkersForPreview(
    diagram,
    diagram.camera,
    360,
    null,
    true,
  )

  assert.equal(markers.length, 1)
  assert.equal(markers[0]?.anchor.id, 'preview-coordinate')
})

test('hidden coordinate anchors render no preview markers', () => {
  const diagram = coordinateAnchorPreviewDiagram()
  const markers = svgCoordinateAnchorMarkersForPreview(
    diagram,
    diagram.camera,
    360,
    null,
    false,
  )

  assert.deepEqual(markers, [])
})

test('hidden coordinate anchors do not hit-test', () => {
  const diagram = coordinateAnchorPreviewDiagram()
  const shownMarkers = svgCoordinateAnchorMarkersForPreview(
    diagram,
    diagram.camera,
    360,
    null,
    true,
  )
  const hiddenMarkers = svgCoordinateAnchorMarkersForPreview(
    diagram,
    diagram.camera,
    360,
    null,
    false,
  )
  const center = shownMarkers[0]?.center

  assert.notEqual(center, undefined)
  if (center === undefined) {
    throw new Error('Expected a coordinate marker center.')
  }
  assert.equal(
    hitTestSvgCoordinateAnchorMarkers(shownMarkers, center)?.anchor.id,
    'preview-coordinate',
  )
  assert.equal(hitTestSvgCoordinateAnchorMarkers(hiddenMarkers, center), null)
})

test('shown coordinate anchors have hit-test priority over paths and sheets', () => {
  const picked = pickSvgPreviewHitTestCandidate([
    { kind: 'sheetOrRegion', id: 'sheet-under-coordinate', hit: true },
    { kind: 'curve', id: 'path-under-coordinate', hit: true },
    { kind: 'coordinateAnchor', id: 'preview-coordinate', hit: true },
  ])
  const handlePicked = pickSvgPreviewHitTestCandidate([
    { kind: 'coordinateAnchor', id: 'preview-coordinate', hit: true },
    { kind: 'geometryHandle', id: 'active-handle', hit: true },
  ])

  assert.deepEqual(picked, {
    kind: 'coordinateAnchor',
    id: 'preview-coordinate',
    hit: true,
  })
  assert.equal(handlePicked.kind, 'geometryHandle')
  assert.ok(
    svgPreviewHitTestPriorityRank('coordinateAnchor') <
      svgPreviewHitTestPriorityRank('curve'),
  )
  assert.ok(
    svgPreviewHitTestPriorityRank('coordinateAnchor') <
      svgPreviewHitTestPriorityRank('sheetOrRegion'),
  )
})

test('SVG preview selection candidates include overlapping selectable objects', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectOverlappingSelectionCandidates(diagram)
  const keys = candidates.map((candidate) => candidate.stableId)

  assert.ok(keys.includes('coordinateAnchor:coord-overlap'))
  assert.ok(keys.includes('label:label-overlap'))
  assert.ok(keys.includes('point:point-overlap'))
  assert.ok(keys.includes('curve:path-overlap'))
  assert.ok(keys.includes('sheetOrRegion:region-overlap'))
  assert.ok(candidates.length >= 5)
})

test('normal SVG preview hit ordering selects the top-priority overlap candidate', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const [topCandidate] = collectOverlappingSelectionCandidates(diagram)

  assert.deepEqual(topCandidate?.selection, {
    kind: 'coordinate',
    id: 'coord-overlap',
  })
})

test('Alt-click cycling selects the second overlapping preview candidate', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const point = overlappingCandidateClickPoint(diagram)
  const candidates = collectOverlappingSelectionCandidates(diagram)
  const result = nextSvgPreviewSelectionCycle(null, point, candidates)

  assert.equal(result.index, 1)
  assert.equal(result.count, candidates.length)
  assert.deepEqual(result.candidate, candidates[1])
})

test('repeated SVG preview selection cycling wraps around candidates', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const point = overlappingCandidateClickPoint(diagram)
  const candidates = collectOverlappingSelectionCandidates(diagram)
  const first = nextSvgPreviewSelectionCycle(null, point, candidates)
  const visited = [first.index]
  let state = first.state

  for (let index = 1; index < candidates.length; index += 1) {
    const next = nextSvgPreviewSelectionCycle(state, point, candidates)

    visited.push(next.index)
    state = next.state
  }

  assert.deepEqual(visited, [1, 2, 3, 4, 0])
})

test('SVG preview selection cycling resets when cursor location changes significantly', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const point = overlappingCandidateClickPoint(diagram)
  const candidates = collectOverlappingSelectionCandidates(diagram)
  const first = nextSvgPreviewSelectionCycle(null, point, candidates)
  const moved = nextSvgPreviewSelectionCycle(
    first.state,
    { x: point.x + 40, y: point.y },
    candidates,
  )

  assert.equal(moved.reset, true)
  assert.equal(moved.index, 1)
})

test('hidden coordinate anchors are not SVG preview selection candidates', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: overlappingCandidateViewportHeight,
    point: overlappingCandidateClickPoint(diagram),
    showCoordinateAnchors: false,
  })

  assert.equal(
    candidates.some((candidate) => candidate.kind === 'coordinateAnchor'),
    false,
  )
})

test('layer-filter-hidden objects are not SVG preview selection candidates', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: overlappingCandidateViewportHeight,
    point: overlappingCandidateClickPoint(diagram),
    layerFilter: { kind: 'layer', layer: 1 },
  })

  assert.equal(
    candidates.some((candidate) => candidate.stableId === 'curve:path-overlap'),
    false,
  )
  assert.equal(
    candidates.some((candidate) => candidate.stableId === 'point:point-overlap'),
    true,
  )
})

test('visible 3D points remain SVG preview selection candidates', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      pointOcclusions: [['point-overlap-3d', 'visible']],
    }),
  })

  assert.equal(candidateStableIds(candidates).includes('point:point-overlap-3d'), true)
})

test('3D points hidden by hideHidden are not SVG preview selection candidates', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      pointOcclusions: [['point-overlap-3d', 'hidden']],
    }),
  })

  assert.equal(candidateStableIds(candidates).includes('point:point-overlap-3d'), false)
  assert.equal(candidateStableIds(candidates).includes('curve:path-overlap-3d'), true)
})

test('hidden 3D point occlusion does not exclude candidates unless hideHidden is enabled', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      visibilityOptions: {
        ...autoHiddenSelectionVisibilityOptions,
        pointVisibility: 'dimHidden',
      },
      pointOcclusions: [['point-overlap-3d', 'hidden']],
    }),
  })

  assert.equal(candidateStableIds(candidates).includes('point:point-overlap-3d'), true)
})

test('visible 3D labels remain SVG preview selection candidates', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      labelOcclusions: [['label-overlap-3d', 'visible']],
    }),
  })

  assert.equal(candidateStableIds(candidates).includes('label:label-overlap-3d'), true)
})

test('3D labels hidden by autoHide are not SVG preview selection candidates', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      labelOcclusions: [['label-overlap-3d', 'hidden']],
    }),
  })

  assert.equal(candidateStableIds(candidates).includes('label:label-overlap-3d'), false)
  assert.equal(candidateStableIds(candidates).includes('point:point-overlap-3d'), true)
})

test('hidden 3D label occlusion does not exclude candidates unless autoHide is enabled', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      visibilityOptions: {
        ...autoHiddenSelectionVisibilityOptions,
        labelVisibility: 'autoDim',
      },
      labelOcclusions: [['label-overlap-3d', 'hidden']],
    }),
  })

  assert.equal(candidateStableIds(candidates).includes('label:label-overlap-3d'), true)
})

test('2D point and label candidates are unchanged when 3D visibility maps are absent', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: overlappingCandidateViewportHeight,
    point: overlappingCandidateClickPoint(diagram),
    visibility: createAutoHiddenSelectionVisibility(),
  })
  const keys = candidateStableIds(candidates)

  assert.equal(keys.includes('point:point-overlap'), true)
  assert.equal(keys.includes('label:label-overlap'), true)
})

test('coordinate anchor visibility still excludes anchor cycling candidates', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: overlappingCandidateViewportHeight,
    point: overlappingCandidateClickPoint(diagram),
    visibility: createAutoHiddenSelectionVisibility(),
    showCoordinateAnchors: false,
  })

  assert.equal(
    candidates.some((candidate) => candidate.kind === 'coordinateAnchor'),
    false,
  )
})

test('layer filtering still excludes hidden-layer cycling candidates with preview visibility', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: overlappingCandidateViewportHeight,
    point: overlappingCandidateClickPoint(diagram),
    layerFilter: { kind: 'layer', layer: 1 },
    visibility: createAutoHiddenSelectionVisibility(),
  })
  const keys = candidateStableIds(candidates)

  assert.equal(keys.includes('curve:path-overlap'), false)
  assert.equal(keys.includes('point:point-overlap'), true)
})

test('Alt-click cycling skips auto-hidden 3D point candidates', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram({
    includeLabel: false,
  })
  const point = threeDimensionalCandidateClickPoint(diagram)
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      pointOcclusions: [['point-overlap-3d', 'hidden']],
    }),
  })
  const first = nextSvgPreviewSelectionCycle(null, point, candidates)
  const second = nextSvgPreviewSelectionCycle(first.state, point, candidates)

  assert.deepEqual(candidateStableIds(candidates), ['curve:path-overlap-3d'])
  assert.equal(first.candidate?.stableId, 'curve:path-overlap-3d')
  assert.equal(second.candidate?.stableId, 'curve:path-overlap-3d')
})

test('cycling order among remaining visible candidates is deterministic after auto-hide', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram()
  const point = threeDimensionalCandidateClickPoint(diagram)
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      pointOcclusions: [['point-overlap-3d', 'hidden']],
    }),
  })
  const first = nextSvgPreviewSelectionCycle(null, point, candidates)
  const second = nextSvgPreviewSelectionCycle(first.state, point, candidates)

  assert.deepEqual(candidateStableIds(candidates), [
    'label:label-overlap-3d',
    'curve:path-overlap-3d',
  ])
  assert.equal(first.candidate?.stableId, 'curve:path-overlap-3d')
  assert.equal(second.candidate?.stableId, 'label:label-overlap-3d')
})

test('Alt-click cycling skips auto-hidden 3D label candidates', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram({
    includePoint: false,
  })
  const point = threeDimensionalCandidateClickPoint(diagram)
  const candidates = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      labelOcclusions: [['label-overlap-3d', 'hidden']],
    }),
  })
  const first = nextSvgPreviewSelectionCycle(null, point, candidates)
  const second = nextSvgPreviewSelectionCycle(first.state, point, candidates)

  assert.deepEqual(candidateStableIds(candidates), ['curve:path-overlap-3d'])
  assert.equal(first.candidate?.stableId, 'curve:path-overlap-3d')
  assert.equal(second.candidate?.stableId, 'curve:path-overlap-3d')
})

test('normal hit ordering selects the top visible candidate when a point is auto-hidden', () => {
  const diagram = createThreeDimensionalSelectionCandidateDiagram({
    includeLabel: false,
  })
  const [topCandidate] = collectThreeDimensionalSelectionCandidates(diagram, {
    visibility: createAutoHiddenSelectionVisibility({
      pointOcclusions: [['point-overlap-3d', 'hidden']],
    }),
  })

  assert.equal(topCandidate?.stableId, 'curve:path-overlap-3d')
  assert.deepEqual(topCandidate?.selection, {
    kind: 'stratum',
    id: 'path-overlap-3d',
  })
})

test('coordinate anchors outrank paths in collected SVG preview candidates', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const candidates = collectOverlappingSelectionCandidates(diagram)

  assert.equal(candidates[0]?.kind, 'coordinateAnchor')
  assert.equal(
    svgPreviewHitTestPriorityRank('coordinateAnchor') <
      svgPreviewHitTestPriorityRank('curve'),
    true,
  )
})

test('SVG preview selection cycling does not mutate the diagram model', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const before = JSON.stringify(diagram)
  const point = overlappingCandidateClickPoint(diagram)
  const candidates = collectOverlappingSelectionCandidates(diagram)

  nextSvgPreviewSelectionCycle(null, point, candidates)

  assert.equal(JSON.stringify(diagram), before)
})

test('SVG preview selection cycling does not affect TikZ output', () => {
  const diagram = createOverlappingSelectionCandidateDiagram()
  const before = generateTikz(diagram)
  const point = overlappingCandidateClickPoint(diagram)
  const candidates = collectOverlappingSelectionCandidates(diagram)

  nextSvgPreviewSelectionCycle(null, point, candidates)

  assert.equal(generateTikz(diagram), before)
})

test('braiding marker hit-test priority is preserved for non-cycling clicks', () => {
  const picked = pickSvgPreviewHitTestCandidate([
    { kind: 'curve', id: 'path-under-crossing', hit: true },
    {
      kind: 'pathIntersectionCandidate',
      id: 'crossing-over-path',
      hit: true,
    },
  ])

  assert.deepEqual(picked, {
    kind: 'pathIntersectionCandidate',
    id: 'crossing-over-path',
    hit: true,
  })
})

test('SVG coordinate anchor markers are independent of layer visibility', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const anchor = createCoordinateAnchor(diagram, {
    id: 'svg-global-coordinate-anchor',
    name: 'Global coordinate',
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: 2 },
        y: { kind: 'numeric', value: 1 },
        z: { kind: 'numeric', value: 0 },
      },
    },
  })
  const hiddenLayerDiagram = setLayerVisibility(
    {
      ...diagram,
      coordinateAnchors: [anchor],
      strata: [
        createPointStratum({
          ambientDimension: 2,
          id: 'hidden-point',
          name: 'Hidden point',
          position: { x: 0, y: 0, z: 0 },
          layer: 7,
        }),
      ],
    },
    7,
    false,
  )
  const markers = svgCoordinateAnchorMarkers(
    hiddenLayerDiagram,
    hiddenLayerDiagram.camera,
    360,
    null,
  )

  assert.equal(
    shouldRenderStratumInSvgPreview(
      hiddenLayerDiagram,
      hiddenLayerDiagram.strata[0],
    ),
    false,
  )
  assert.equal(markers.length, 1)
  assert.equal(markers[0]?.anchor.id, 'svg-global-coordinate-anchor')
})

test('SVG arrow preview coordinates are finite for a projected 3D path', () => {
  const camera = createInitialCamera3D()
  const curve = createConcatenatedPathStratum({
    ambientDimension: 3,
    id: 'svg-arrow-3d',
    name: 'SVG arrow 3D',
    arrows: {
      endpoint: 'forward',
      mid: {
        enabled: true,
        position: 0.4,
        direction: 'backward',
        head: 'latex',
      },
    },
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 1, z: 1 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 1, z: 1 },
        end: { x: 2, y: 0, z: 2 },
      },
    ],
  })
  const arrowheads = curveArrowheadsForSvgPreview(curve, 3, (point) =>
    projectToSvgPoint(camera, point, 160),
  )

  assert.equal(arrowheads.length, 2)
  assert.equal(arrowheads.every(isFiniteSvgArrowhead), true)
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

test('SVG style attributes update when a user curve preset is applied', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'preview-curve',
    name: 'Preview curve',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })
  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Preview preset',
    {
      kind: 'curveStyle',
      strokeColor: '#CC0033',
      strokeOpacity: 0.5,
      lineWidth: 2,
      lineStyle: 'dashed',
    },
  )
  const applied = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    'preview-curve',
    created?.preset.id ?? '',
  )
  const curve = applied.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  assert.deepEqual(curveStyleToSvgStrokeAttributes(curve.style), {
    stroke: '#CC0033',
    strokeOpacity: 0.5,
    strokeWidth: 2,
    strokeDasharray: '8 5',
  })
})

test('SVG preview style conversion ignores unknown imported TikZ style keys', () => {
  const style: CurveStyle = {
    kind: 'curveStyle',
    strokeColor: '#123456',
    strokeOpacity: 0.4,
    lineWidth: 1.6,
    lineStyle: 'dotted',
  }
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'imported-style-preview',
    name: 'Imported style preview',
    importedTikzStyleReferenceId: 'unknown-external-style',
    style,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  assert.deepEqual(curveStyleToSvgStrokeAttributes(curve.style), {
    stroke: '#123456',
    strokeOpacity: 0.4,
    strokeWidth: 1.6,
    strokeDasharray: '1 5',
  })
})

test('line styles map to SVG dash arrays', () => {
  assert.equal(lineStyleToStrokeDasharray('solid'), undefined)
  assert.equal(lineStyleToStrokeDasharray('dashed'), '8 5')
  assert.equal(lineStyleToStrokeDasharray('dotted'), '1 5')
  assert.equal(lineStyleToStrokeDasharray('denselyDotted'), '1 2')
})

test('SVG path crossing marker style differs by crossing state', () => {
  const none = svgPathCrossingMarkerStyle('none', false)
  const braiding = svgPathCrossingMarkerStyle('braiding', false)
  const antiBraiding = svgPathCrossingMarkerStyle('antiBraiding', false)

  assert.notEqual(none.stroke, braiding.stroke)
  assert.notEqual(braiding.stroke, antiBraiding.stroke)
  assert.equal(none.strokeDasharray, undefined)
  assert.equal(antiBraiding.strokeDasharray, '3 2')
})

test('SVG braiding helper creates a background mask and over-strand redraw', () => {
  const diagram = createSvgBraidingCrossingDiagram('braiding')
  const overlays = svgPathCrossingOverlayPrimitives(diagram, (point) => ({
    x: point.x,
    y: point.y,
  }))
  const mask = overlays.find((overlay) => overlay.kind === 'underMask')
  const redraw = overlays.find((overlay) => overlay.kind === 'overRedraw')
  const threeDimensional = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    pathCrossings: diagram.pathCrossings,
  }

  assert.equal(overlays.length, 2)
  assert.equal(mask?.pathId, 'path-b')
  assert.equal(mask?.pathData, 'M 0,-0.12 L 0,0.12')
  assert.equal(mask?.stroke, '#ffffff')
  assert.equal(mask?.strokeWidth, 5.2)
  assert.equal(redraw?.pathId, 'path-a')
  assert.equal(redraw?.pathData, 'M -0.12,0 L 0.12,0')
  assert.equal(redraw?.stroke, '#AA0033')
  assert.equal(redraw?.strokeDasharray, undefined)
  assert.doesNotMatch(
    overlays.map((overlay) => overlay.pathData).join('\n'),
    /NaN|Infinity/,
  )
  assert.deepEqual(
    svgPathCrossingOverlayPrimitives(threeDimensional, (point) => ({
      x: point.x,
      y: point.y,
    })),
    [],
  )
})

test('hidden curve style maps to SVG stroke attributes', () => {
  assert.deepEqual(
    hiddenCurveStyleToSvgStrokeAttributes(
      {
        kind: 'curveStyle',
        strokeColor: '#123456',
        strokeOpacity: 0.8,
        lineWidth: 1.6,
        lineStyle: 'solid',
      },
      {
        lineStyle: 'dashed',
        opacity: 0.5,
      },
    ),
    {
      stroke: '#123456',
      strokeOpacity: 0.4,
      strokeWidth: 1.6,
      strokeDasharray: '8 5',
    },
  )
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

test('2D coordinate axes guide data is available for preview rendering', () => {
  const guide = createCoordinateAxesGuide(2)

  assert.notEqual(guide, null)
  if (guide === null) {
    throw new Error('Expected a 2D coordinate axes guide.')
  }

  assert.deepEqual(
    guide.axes.map((axis) => axis.axis),
    ['x', 'y'],
  )
  assert.deepEqual(guide.axes[0].from, { x: 0, y: 0, z: 0 })
  assert.deepEqual(guide.axes[0].to, { x: 2.5, y: 0, z: 0 })
  assert.deepEqual(guide.axes[1].to, { x: 0, y: 2.5, z: 0 })
  assert.equal(guide.fitPoints.length, 6)
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

test('empty 2D coordinate axes guide projects with the SVG camera', () => {
  const guide = createCoordinateAxesGuide(2)

  assert.notEqual(guide, null)
  if (guide === null) {
    throw new Error('Expected a 2D coordinate axes guide.')
  }

  const camera = resolveSvgCamera(
    createEmptyDiagram({ ambientDimension: 2 }),
    200,
    120,
    {
      fitToView: true,
      extraPointsForFit: guide.fitPoints,
    },
  )
  const projectedOrigin = projectToSvgPoint(camera, { x: 0, y: 0, z: 0 }, 120)
  const projectedX = projectToSvgPoint(camera, { x: 2.5, y: 0, z: 0 }, 120)
  const projectedY = projectToSvgPoint(camera, { x: 0, y: 2.5, z: 0 }, 120)
  const projectedPoints = guide.fitPoints.map((point) =>
    projectToSvgPoint(camera, point, 120),
  )

  assert.equal(camera.mode, '2d')
  assert.ok(projectedX.x > projectedOrigin.x)
  assert.ok(projectedY.y < projectedOrigin.y)
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

test('SVG preview policy omits hidden layer strata and labels', () => {
  const point = createPointStratum({
    ambientDimension: 2,
    id: 'preview-hidden-point',
    position: { x: 0, y: 0, z: 0 },
    layer: 3,
  })
  const label = createTextLabel({
    ambientDimension: 2,
    id: 'preview-hidden-label',
    position: { x: 1, y: 0, z: 0 },
    layer: 3,
  })
  const diagram = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [point],
    labels: [label],
  }
  const hidden = setLayerVisibility(diagram, 3, false)

  assert.equal(shouldRenderStratumInSvgPreview(diagram, point), true)
  assert.equal(shouldRenderTextLabelInSvgPreview(diagram, label), true)
  assert.equal(shouldRenderStratumInSvgPreview(hidden, point), false)
  assert.equal(shouldRenderTextLabelInSvgPreview(hidden, label), false)
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

function coordinateAnchorPreviewDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const anchor = createCoordinateAnchor(diagram, {
    id: 'preview-coordinate',
    name: 'Preview coordinate',
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: 0 },
        y: { kind: 'numeric', value: 0 },
        z: { kind: 'numeric', value: 0 },
      },
    },
  })

  return {
    ...diagram,
    coordinateAnchors: [anchor],
  }
}

function coordinateAnchorMultiPreviewDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    coordinateAnchors: [
      createCoordinateAnchor(diagram, {
        id: 'preview-coordinate-a',
        name: 'A',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 0 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
      createCoordinateAnchor(diagram, {
        id: 'preview-coordinate-b',
        name: 'B',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 1 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
      createCoordinateAnchor(diagram, {
        id: 'preview-coordinate-c',
        name: 'C',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 2 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
    ],
  }
}

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

function createSvgBraidingCrossingDiagram(
  crossingKind: 'none' | 'braiding' | 'antiBraiding',
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'path-a',
      name: 'Path A',
      style: curveStyle({
        strokeColor: '#AA0033',
      }),
      points: [
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'path-b',
      name: 'Path B',
      style: curveStyle(),
      points: [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )
  diagram.pathCrossings = [
    pathCrossingStateFromCandidate(
      onlySvgPathIntersectionCandidate(diagram),
      crossingKind,
    ),
  ]

  return diagram
}

const overlappingCandidateViewportHeight = 300
const threeDimensionalCandidateViewportHeight = 300
const autoHiddenSelectionVisibilityOptions: VisibilityOptions = {
  ...defaultVisibilityOptions,
  enabled: true,
  pointVisibility: 'hideHidden',
  labelVisibility: 'autoHide',
}

function createOverlappingSelectionCandidateDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const origin = { x: 0, y: 0, z: 0 }
  const anchor = createCoordinateAnchor(diagram, {
    id: 'coord-overlap',
    name: 'A',
    tikzName: 'A',
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: 0 },
        y: { kind: 'numeric', value: 0 },
        z: { kind: 'numeric', value: 0 },
      },
    },
  })

  return {
    ...diagram,
    camera: {
      mode: '2d',
      scale: 30,
      origin: { x: 120, y: 140 },
    },
    coordinateAnchors: [anchor],
    strata: [
      {
        id: 'region-overlap',
        codim: 0,
        geometricKind: 'region',
        kind: 'filledRegion',
        name: 'R',
        visible: true,
        style: regionStyle(),
        boundaries: [squareBoundary2D('overlap-region-boundary', -1, -1, 2)],
        fillRule: 'nonzero',
        layer: 0,
      },
      createCurveStratum({
        ambientDimension: 2,
        id: 'path-overlap',
        name: 'f',
        points: [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        layer: 0,
      }),
      createPointStratum({
        ambientDimension: 2,
        id: 'point-overlap',
        name: 'p',
        position: origin,
        layer: 1,
      }),
    ],
    labels: [
      createTextLabel({
        ambientDimension: 2,
        id: 'label-overlap',
        name: 'L',
        text: '$L$',
        position: origin,
        layer: 0,
      }),
    ],
  }
}

function collectOverlappingSelectionCandidates(diagram: Diagram) {
  return collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: overlappingCandidateViewportHeight,
    point: overlappingCandidateClickPoint(diagram),
  })
}

function overlappingCandidateClickPoint(diagram: Diagram) {
  return projectToSvgPoint(
    diagram.camera,
    { x: 0, y: 0, z: 0 },
    overlappingCandidateViewportHeight,
  )
}

type ThreeDimensionalSelectionCandidateDiagramOptions = {
  includePoint?: boolean
  includeLabel?: boolean
}

function createThreeDimensionalSelectionCandidateDiagram({
  includePoint = true,
  includeLabel = true,
}: ThreeDimensionalSelectionCandidateDiagramOptions = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 30,
    pan: { x: 120, y: 140 },
  }
  const origin = { x: 0, y: 0, z: 0 }

  return {
    ...diagram,
    camera,
    view: { ...diagram.view, camera3d: camera },
    strata: [
      createCurveStratum({
        ambientDimension: 3,
        id: 'path-overlap-3d',
        name: 'f',
        points: [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        layer: 0,
      }),
      ...(includePoint
        ? [
            createPointStratum({
              ambientDimension: 3,
              id: 'point-overlap-3d',
              name: 'p',
              position: origin,
              layer: 0,
            }),
          ]
        : []),
    ],
    labels: includeLabel
      ? [
          createTextLabel({
            ambientDimension: 3,
            id: 'label-overlap-3d',
            name: 'L',
            text: '$L$',
            position: origin,
            layer: 0,
          }),
        ]
      : [],
  }
}

type AnchorVisibilityForTest = 'visible' | 'hidden'

type AutoHiddenSelectionVisibilityOptions = {
  visibilityOptions?: VisibilityOptions
  pointOcclusions?: readonly (readonly [string, AnchorVisibilityForTest])[]
  labelOcclusions?: readonly (readonly [string, AnchorVisibilityForTest])[]
}

function createAutoHiddenSelectionVisibility({
  visibilityOptions = autoHiddenSelectionVisibilityOptions,
  pointOcclusions = [],
  labelOcclusions = [],
}: AutoHiddenSelectionVisibilityOptions = {}) {
  return createSvgSelectionCandidateVisibility({
    visibilityOptions,
    pointOcclusionById: occlusionMapForTest(pointOcclusions),
    labelOcclusionById: occlusionMapForTest(labelOcclusions),
  })
}

function occlusionMapForTest(
  entries: readonly (readonly [string, AnchorVisibilityForTest])[],
) {
  return new Map(
    entries.map(([id, visibility]) => [
      id,
      {
        visibility,
      },
    ]),
  )
}

function collectThreeDimensionalSelectionCandidates(
  diagram: Diagram,
  options: {
    visibility?: ReturnType<typeof createSvgSelectionCandidateVisibility>
  } = {},
) {
  return collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: threeDimensionalCandidateViewportHeight,
    point: threeDimensionalCandidateClickPoint(diagram),
    visibility: options.visibility,
  })
}

function threeDimensionalCandidateClickPoint(diagram: Diagram) {
  return projectToSvgPoint(
    diagram.camera,
    { x: 0, y: 0, z: 0 },
    threeDimensionalCandidateViewportHeight,
  )
}

function candidateStableIds(
  candidates: readonly {
    stableId: string
  }[],
): string[] {
  return candidates.map((candidate) => candidate.stableId)
}

function regionStyle(overrides: Partial<RegionStyle> = {}): RegionStyle {
  return {
    kind: 'regionStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
    ...overrides,
  }
}

function curveStyle(overrides: Partial<CurveStyle> = {}): CurveStyle {
  return {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
    ...overrides,
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

function onlySvgPathIntersectionCandidate(diagram: Diagram) {
  const candidates = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(candidates.length, 1)

  const candidate = candidates[0]

  if (candidate === undefined) {
    throw new Error('Expected one path intersection candidate.')
  }

  return candidate
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

function isFiniteSvgArrowhead(arrowhead: SvgArrowheadPreview): boolean {
  return [arrowhead.tip, arrowhead.left, arrowhead.right].every(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  )
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
