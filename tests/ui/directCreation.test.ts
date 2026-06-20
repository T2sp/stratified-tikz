import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import type {
  ConcatenatedPathStratum,
  CurvedSheetStratum,
  CurveStratum,
  Diagram,
  PointStratum,
  PolygonSheetStratum,
  SheetStyle,
  TemplatePathStratum,
  TextLabel,
  Vec3,
  WorkPlane,
} from '../../src/model/types.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { curvedSheetToSvgMesh } from '../../src/rendering/curvedSheetMesh.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addArcPathFromDirectInput,
  addCirclePathFromDirectInput,
  addConcatenatedPathFromDirectInput,
  addCurvedSheetStratumWithResult,
  addCubicBezierCurveFromDirectInput,
  addCubicBezierCurveStratumWithResult,
  addEllipsePathFromDirectInput,
  addGridStratumFromDirectInput,
  addPointStratumFromDirectInput,
  addPointStratumWithResult,
  addPolygonSheetFromDirectInput,
  addPolygonSheetStratumWithResult,
  addPolylineCurveFromDirectInput,
  addPolylineCurveStratumWithResult,
  addTextLabelFromDirectInput,
  applyDirectCreationCommitToEditorState,
  commitDirectCreationResult,
  localDirectCoordinateInputFromExistingSource,
  parseDirectCoordinateRows,
  parseDirectLayerInput,
  updateCurvedSheetPrimitiveById,
  updateStratumById,
  updateStratumStyleById,
} from '../../src/ui/diagramUpdates.ts'
import { gridPreviewSegments } from '../../src/model/grids.ts'
import {
  createExistingCoordinateSourceOptions,
  formatExistingCoordinateSourceLabel,
  resolveExistingCoordinateSource,
  type ExistingCoordinateSource,
} from '../../src/ui/coordinateSources.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  layerFilterIncludesLayer,
  type LayerFilter,
} from '../../src/ui/layerFilter.ts'
import {
  createRuledSurfaceFromBoundaryPaths,
  createRuledSurfaceFromBoundaryPathsErrorMessage,
} from '../../src/ui/ruledSurface.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type DiagramHistory,
} from '../../src/ui/undo.ts'

type TestEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  draftMarker: string
}

type UndoTestEditorState = TestEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
  history: DiagramHistory
}

test('direct point creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addPointStratumFromDirectInput(
    initialState.editableDiagram,
    { x: '10', y: '11', z: '99' },
    { layer: 5 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 5)
  const point = committed.editableDiagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(
    committed.editableDiagram.strata.length,
    initialState.editableDiagram.strata.length + 1,
  )
  assert.equal(point?.geometricKind, 'point')
  assert.equal(point?.layer, 5)
  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.equal('diagram' in committed, false)
  assert.match(generateTikz(committed.editableDiagram), /\(10,11\)/)
})

test('global direct point coordinates accept scientific notation', () => {
  const cases = [
    ['1e-3', 0.001],
    ['1E-3', 0.001],
    ['2e+4', 20000],
    ['-3.5e2', -350],
    ['+4.2E-1', 0.42],
    ['.5e2', 50],
    ['5.', 5],
  ] as const

  cases.forEach(([x, expectedX], index) => {
    const result = addPointStratumFromDirectInput(
      emptyThreeDimensionalDiagram,
      { x, y: '0', z: '0' },
      { id: `scientific-point-${index}` },
    )

    assert.equal(result.ok, true)
    if (!result.ok) {
      throw new Error(`Expected ${x} to be accepted.`)
    }

    assertVec3ApproximatelyEqual(
      findPoint(result.diagram, result.id).position,
      { x: expectedX, y: 0, z: 0 },
    )
  })
})

test('global direct point coordinates reject non-finite numeric inputs', () => {
  const invalidInputs = ['Infinity', '-Infinity', 'NaN', '1e309', '1/0']

  invalidInputs.forEach((x) => {
    const result = addPointStratumFromDirectInput(
      emptyThreeDimensionalDiagram,
      { x, y: '0', z: '0' },
    )

    assert.equal(result.ok, false)
  })
})

test('direct label creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addTextLabelFromDirectInput(
    initialState.editableDiagram,
    { x: '12', y: '13', z: '99' },
    '$L$',
    { layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct label creation to succeed.')
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'label',
    id: result.id,
  }, 6)
  const label = committed.editableDiagram.labels.find(
    (candidate) => candidate.id === result.id,
  )

  assert.equal(
    committed.editableDiagram.labels.length,
    initialState.editableDiagram.labels.length + 1,
  )
  assert.equal(label?.text, '$L$')
  assert.equal(label?.layer, 6)
  assert.deepEqual(label?.position, { x: 12, y: 13, z: 0 })
  assert.deepEqual(committed.selectedElement, { kind: 'label', id: result.id })
  assert.match(generateTikz(committed.editableDiagram), /\$L\$/)
})

test('direct polyline creation assigns 2D codim, layer, selection, and z normalization', () => {
  const result = addPolylineCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '1', z: '9' },
      { x: '2', y: '3', z: '9' },
    ],
    { layer: 7 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)
  assert.equal(curve.kind, 'polyline')
  assert.equal(curve.codim, 1)
  assert.equal(curve.layer, 7)
  assert.deepEqual(
    curve.points.map((point) => point.z),
    [0, 0],
  )

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    7,
    { kind: 'layer', layer: 0 },
  )

  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 7 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, curve.layer), true)
})

test('direct grid creation snapshots active work plane and preserves style and layer', () => {
  const style = {
    kind: 'curveStyle' as const,
    strokeColor: '#4D9DE0' as const,
    strokeOpacity: 0.5,
    lineWidth: 0.75,
    lineStyle: 'dashed' as const,
  }
  const result = addGridStratumFromDirectInput(
    emptyThreeDimensionalDiagram,
    {
      uRange: { min: '-1', max: '1', step: '1' },
      vRange: { min: '-1', max: '1', step: '1' },
      clip: { uMin: '-1', uMax: '1', vMin: '-1', vMax: '1' },
    },
    { kind: 'xz', y: 2 },
    {
      name: 'XZ grid',
      layer: 4,
      style,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const grid = findCurve(result.diagram, result.id)

  assert.equal(grid.kind, 'grid')
  if (grid.kind !== 'grid') {
    throw new Error('Expected a grid stratum.')
  }
  assert.equal(grid.codim, 2)
  assert.equal(grid.layer, 4)
  assert.deepEqual(grid.style, style)
  assert.equal(grid.frame.kind, 'workPlane')
  assert.deepEqual(grid.frame.frame.origin, { x: 0, y: 2, z: 0 })

  const preview = gridPreviewSegments(grid, 3)
  assert.equal(preview.ok, true)
  if (!preview.ok) {
    throw new Error(preview.errors[0]?.message ?? 'Invalid grid preview.')
  }
  assert.equal(preview.lineCount, 6)
})

test('direct polyline creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addPolylineCurveFromDirectInput(
    initialState.editableDiagram,
    [
      { x: '1', y: '2', z: '99' },
      { x: '3', y: '4', z: '99' },
    ],
    { layer: 7 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 7)
  const curve = findCurve(committed.editableDiagram, result.id)

  assert.equal(
    committed.editableDiagram.strata.length,
    initialState.editableDiagram.strata.length + 1,
  )
  assert.equal(curve.kind, 'polyline')
  assert.deepEqual(curve.points, [
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
  ])
  assert.equal(curve.layer, 7)
  assert.match(generateTikz(committed.editableDiagram), /\(curvePolyCurve\d+p0\) -- \(curvePolyCurve\d+p1\);/)
})

test('direct polyline creation assigns 3D curve codim and explicit layer', () => {
  const result = addPolylineCurveFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '1', z: '2' },
      { x: '3', y: '4', z: '5' },
    ],
    { layer: -2 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)
  assert.equal(curve.kind, 'polyline')
  assert.equal(curve.codim, 2)
  assert.equal(curve.layer, -2)
  assert.deepEqual(curve.points[1], { x: 3, y: 4, z: 5 })
})

test('direct cubic Bezier creation preserves point order and explicit layer', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '3', y: '4', z: '0' },
      { x: '5', y: '6', z: '0' },
    ],
    { layer: 4 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)
  assert.equal(curve.kind, 'cubicBezier')
  assert.equal(curve.layer, 4)
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
    { x: 5, y: 6, z: 0 },
  ])

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    4,
    { kind: 'all' },
  )
  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  assert.deepEqual(committed.layerFilter, { kind: 'all' })
})

test('direct cubic Bezier creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(twoDimensionalExample)
  const result = addCubicBezierCurveFromDirectInput(
    initialState.editableDiagram,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '3', y: '4', z: '0' },
      { x: '5', y: '6', z: '0' },
    ],
    { layer: 8 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 8)
  const curve = findCurve(committed.editableDiagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
    { x: 5, y: 6, z: 0 },
  ])
  assert.equal(curve.layer, 8)
  assert.match(generateTikz(committed.editableDiagram), /\.\. controls/)
})

test('direct cubic Bezier creation rejects invalid and non-finite input', () => {
  const result = addCubicBezierCurveFromDirectInput(twoDimensionalExample, [
    { x: '0', y: '0', z: '0' },
    { x: '1', y: '2', z: '0' },
    { x: 'Infinity', y: '4', z: '0' },
    { x: '5', y: '6', z: '0' },
  ])

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected non-finite input to be rejected.')
  }
  assert.equal(result.error, 'invalidCoordinates')
})

test('direct manual line path creates a concatenated path and normalizes 2D z', () => {
  const result = addConcatenatedPathFromDirectInput(
    twoDimensionalExample,
    {
      start: { x: '0', y: '0', z: '9' },
      segments: [{ kind: 'line', end: { x: '2', y: '3', z: '9' } }],
    },
    {
      layer: 5,
      name: 'Manual path',
      pathLabel: 'manual path',
      style: {
        kind: 'curveStyle',
        strokeColor: '#123456',
        strokeOpacity: 0.5,
        lineWidth: 2,
        lineStyle: 'denselyDotted',
      },
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findConcatenatedPath(result.diagram, result.id)
  assert.equal(path.codim, 1)
  assert.equal(path.layer, 5)
  assert.equal(path.name, 'Manual path')
  assert.equal(path.pathLabel, 'manual path')
  assert.deepEqual(path.style, {
    kind: 'curveStyle',
    strokeColor: '#123456',
    strokeOpacity: 0.5,
    lineWidth: 2,
    lineStyle: 'denselyDotted',
  })
  assert.deepEqual(path.segments, [
    {
      kind: 'line',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 2, y: 3, z: 0 },
    },
  ])

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    5,
    { kind: 'all' },
  )
  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  const tikz = generateTikz(result.diagram)
  assert.match(tikz, /--/)
  assert.match(tikz, /\{HTML\}\{123456\}/)
  assert.match(tikz, /draw opacity=0\.5/)
  assert.match(tikz, /line width=2pt/)
  assert.match(tikz, /densely dotted/)
})

test('direct manual line+cubic path preserves segment order and adjacency', () => {
  const result = addConcatenatedPathFromDirectInput(twoDimensionalExample, {
    start: { x: '0', y: '0', z: '0' },
    segments: [
      { kind: 'line', end: { x: '1', y: '0', z: '0' } },
      {
        kind: 'cubicBezier',
        control1: { x: '1.2', y: '0.5', z: '0' },
        control2: { x: '1.8', y: '0.5', z: '0' },
        end: { x: '2', y: '0', z: '0' },
      },
    ],
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findConcatenatedPath(result.diagram, result.id)
  assert.deepEqual(
    path.segments.map((segment) => segment.kind),
    ['line', 'cubicBezier'],
  )
  assert.deepEqual(path.segments[0].end, path.segments[1].start)
  assert.match(generateTikz(result.diagram), /\.\. controls/)
})

test('direct manual path can copy existing coordinate sources', () => {
  const pointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 4, y: 5, z: 9 },
    { id: 'path-source-point', name: 'Source point' },
  )
  const result = addConcatenatedPathFromDirectInput(pointResult.diagram, {
    start: sourceInput({
      kind: 'pointStratum',
      stratumId: 'path-source-point',
    }),
    segments: [{ kind: 'line', end: { x: '6', y: '7', z: '9' } }],
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findConcatenatedPath(result.diagram, result.id)
  assert.deepEqual(path.segments[0].start, { x: 4, y: 5, z: 0 })
  assert.deepEqual(path.segments[0].end, { x: 6, y: 7, z: 0 })
})

test('direct manual path rejects empty and incomplete segment input', () => {
  const emptyResult = addConcatenatedPathFromDirectInput(twoDimensionalExample, {
    start: { x: '0', y: '0', z: '0' },
    segments: [],
  })
  assert.equal(emptyResult.ok, false)
  if (emptyResult.ok) {
    throw new Error('Expected empty path input to be rejected.')
  }
  assert.equal(emptyResult.error, 'tooFewPoints')

  const incompleteResult = addConcatenatedPathFromDirectInput(twoDimensionalExample, {
    start: { x: '0', y: '0', z: '0' },
    segments: [
      {
        kind: 'cubicBezier',
        control1: { x: '', y: '1', z: '0' },
        control2: { x: '2', y: '1', z: '0' },
        end: { x: '3', y: '0', z: '0' },
      },
    ],
  })
  assert.equal(incompleteResult.ok, false)
  if (incompleteResult.ok) {
    throw new Error('Expected incomplete path input to be rejected.')
  }
  assert.equal(incompleteResult.error, 'invalidCoordinates')
})

test('plane-local direct manual path maps coordinates through the active work plane', () => {
  const result = addConcatenatedPathFromDirectInput(
    emptyThreeDimensionalDiagram,
    {
      start: { x: '0', y: '0', z: '0' },
      segments: [{ kind: 'line', end: { x: '1', y: '2', z: '0' } }],
    },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findConcatenatedPath(result.diagram, result.id)
  assert.equal(path.codim, 2)
  assert.deepEqual(path.segments[0].start, { x: 10, y: 20, z: 30 })
  assert.deepEqual(path.segments[0].end, { x: 11, y: 20, z: 32 })
})

test('direct circle template creates a persistent circle template path', () => {
  const result = addCirclePathFromDirectInput(
    emptyTwoDimensionalDiagram,
    {
      center: { x: '0', y: '0', z: '9' },
      radius: '2',
    },
    { pathLabel: 'circle template' },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findTemplatePath(result.diagram, result.id)
  assert.equal(path.template.kind, 'circleTemplate')
  assert.deepEqual(path.template.center, { x: 0, y: 0, z: 0 })
  assert.equal(path.template.radius, 2)
  assert.match(generateTikz(result.diagram), /circle\[radius=2\]/)
  assert.doesNotMatch(generateTikz(result.diagram), /\.\. controls/)
})

test('direct circle template rejects non-positive radius', () => {
  const result = addCirclePathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radius: '0',
  })

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid circle radius to be rejected.')
  }
  assert.equal(result.error, 'invalidRadius')
})

test('3D direct circle template lies in the active work plane', () => {
  const result = addCirclePathFromDirectInput(
    emptyThreeDimensionalDiagram,
    {
      center: { x: '2', y: '3', z: '0' },
      radius: '1',
    },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findTemplatePath(result.diagram, result.id)
  assert.equal(path.template.kind, 'circleTemplate')
  assert.deepEqual(path.template.center, { x: 12, y: 20, z: 33 })
  assert.deepEqual(path.template.frame, {
    origin: { x: 12, y: 20, z: 33 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  })
  const tikz = generateTikz(result.diagram)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /circle\[radius=1\]/)
})

test('3D direct template centers reject symbolic input because export uses local numeric coordinates', () => {
  const result = addCirclePathFromDirectInput(
    createSymbolicThreeDimensionalDiagram(),
    {
      center: { x: 'R', y: '20', z: '30' },
      radius: '1',
    },
    {
      coordinateMode: 'global',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected symbolic 3D template center to be rejected.')
  }
  assert.equal(result.error, 'invalidCoordinates')
})

test('direct ellipse template creates a persistent rotated ellipse template path', () => {
  const result = addEllipsePathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '9' },
    radiusX: '2',
    radiusY: '1',
    rotationDeg: '90',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findTemplatePath(result.diagram, result.id)
  assert.equal(path.template.kind, 'ellipseTemplate')
  assert.deepEqual(path.template.center, { x: 0, y: 0, z: 0 })
  assert.equal(path.template.radiusX, 2)
  assert.equal(path.template.radiusY, 1)
  assert.equal(path.template.rotationDeg, 90)
  const tikz = generateTikz(result.diagram)
  assert.match(tikz, /ellipse\[x radius=2, y radius=1\]/)
  assert.doesNotMatch(tikz, /\.\. controls/)
})

test('direct ellipse template rejects invalid radii and angle input', () => {
  const invalidRadius = addEllipsePathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radiusX: '-1',
    radiusY: '1',
    rotationDeg: '0',
  })
  assert.equal(invalidRadius.ok, false)
  if (invalidRadius.ok) {
    throw new Error('Expected invalid ellipse radius to be rejected.')
  }
  assert.equal(invalidRadius.error, 'invalidRadius')

  const invalidAngle = addEllipsePathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radiusX: '1',
    radiusY: '1',
    rotationDeg: 'NaN',
  })
  assert.equal(invalidAngle.ok, false)
  if (invalidAngle.ok) {
    throw new Error('Expected invalid ellipse rotation to be rejected.')
  }
  assert.equal(invalidAngle.error, 'invalidAngle')
})

test('3D direct ellipse template vertices lie in the active work plane', () => {
  const result = addEllipsePathFromDirectInput(
    emptyThreeDimensionalDiagram,
    {
      center: { x: '1', y: '1', z: '0' },
      radiusX: '2',
      radiusY: '0.5',
      rotationDeg: '30',
    },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findTemplatePath(result.diagram, result.id)
  assert.equal(path.template.kind, 'ellipseTemplate')
  assert.deepEqual(path.template.center, { x: 11, y: 20, z: 31 })
  assert.deepEqual(path.template.frame, {
    origin: { x: 11, y: 20, z: 31 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  })
  const tikz = generateTikz(result.diagram)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /ellipse\[x radius=2, y radius=0\.5\]/)
})

test('direct arc template creates an open first-class arc segment', () => {
  const result = addArcPathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radius: '1',
    startAngleDeg: '0',
    endAngleDeg: '270',
  })

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findConcatenatedPath(result.diagram, result.id)
  assert.equal(path.segments.length, 1)
  assert.equal(path.segments[0].kind, 'arc')
  assertVec3ApproximatelyEqual(path.segments[0].start, { x: 1, y: 0, z: 0 })
  assertVec3ApproximatelyEqual(path.segments[0].end, { x: 0, y: -1, z: 0 })
  assert.notDeepEqual(path.segments[0].start, path.segments[0].end)
  assert.match(generateTikz(result.diagram), /arc\[start angle=0, end angle=270, radius=1\]/)
})

test('direct arc template rejects symbolic center input because arc export derives numeric endpoints', () => {
  const result = addArcPathFromDirectInput(createSymbolicTwoDimensionalDiagram(), {
    center: { x: 'R', y: '0', z: '0' },
    radius: '1',
    startAngleDeg: '0',
    endAngleDeg: '90',
  })

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected symbolic arc center to be rejected.')
  }
  assert.equal(result.error, 'invalidCoordinates')
})

test('direct arc template rejects invalid radius and equal angles', () => {
  const invalidRadius = addArcPathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radius: '-1',
    startAngleDeg: '0',
    endAngleDeg: '90',
  })
  assert.equal(invalidRadius.ok, false)
  if (invalidRadius.ok) {
    throw new Error('Expected invalid arc radius to be rejected.')
  }
  assert.equal(invalidRadius.error, 'invalidRadius')

  const equalAngles = addArcPathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radius: '1',
    startAngleDeg: '45',
    endAngleDeg: '45',
  })
  assert.equal(equalAngles.ok, false)
  if (equalAngles.ok) {
    throw new Error('Expected equal arc angles to be rejected.')
  }
  assert.equal(equalAngles.error, 'invalidAngle')

  const fullSweep = addArcPathFromDirectInput(emptyTwoDimensionalDiagram, {
    center: { x: '0', y: '0', z: '0' },
    radius: '1',
    startAngleDeg: '0',
    endAngleDeg: '360',
  })
  assert.equal(fullSweep.ok, false)
  if (fullSweep.ok) {
    throw new Error('Expected full-sweep arc input to be rejected.')
  }
  assert.equal(fullSweep.error, 'invalidAngle')
})

test('direct arc template preserves direction and 3D work-plane placement', () => {
  const result = addArcPathFromDirectInput(
    emptyThreeDimensionalDiagram,
    {
      center: { x: '0', y: '0', z: '0' },
      radius: '1',
      startAngleDeg: '90',
      endAngleDeg: '0',
    },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const path = findConcatenatedPath(result.diagram, result.id)
  assertVec3ApproximatelyEqual(path.segments[0].start, {
    x: 10,
    y: 20,
    z: 31,
  })
  assertVec3ApproximatelyEqual(path.segments[0].end, {
    x: 11,
    y: 20,
    z: 30,
  })
})

test('direct relative Cartesian cubic Bezier creation stores metadata and absolute controls', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '10', y: '10', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '-3', y: '4', z: '0' },
    ],
    { directControlMode: 'relativeCartesian', layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 7, y: 14, z: 0 },
    { x: 10, y: 10, z: 0 },
  ])
  assert.deepEqual(curve.bezierControls, {
    kind: 'relativeCartesian',
    firstControlOffset: { x: 1, y: 2, z: 0 },
    secondControlOffset: { x: -3, y: 4, z: 0 },
    secondOffsetReference: 'end',
  })
  assert.match(
    generateTikz(result.diagram),
    /\.\. controls \+\(1,2\) and \+\(-3,4\) \.\./,
  )
})

test('direct relative polar cubic Bezier creation stores metadata and uses polar export', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '5', y: '5', z: '0' },
      { x: '0', y: '2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    { directControlMode: 'relativePolar', layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)

  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.bezierControls, {
    kind: 'relativePolar',
    firstControl: { angleDegrees: 0, radius: 2 },
    secondControl: { angleDegrees: 90, radius: 3 },
    secondOffsetReference: 'end',
  })
  assert.match(
    generateTikz(result.diagram),
    /\.\. controls \+\(0:2\) and \+\(90:3\) \.\./,
  )
})

test('direct relative polar cubic Bezier creation rejects negative radii', () => {
  const result = addCubicBezierCurveFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '5', y: '5', z: '0' },
      { x: '0', y: '-2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    { directControlMode: 'relativePolar' },
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected negative radius to be rejected.')
  }
  assert.equal(result.error, 'invalidCoordinates')
})

test('direct 3D polygon sheet creation commits ordinary sheet data on the selected layer', () => {
  const result = addPolygonSheetFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '0', z: '0' },
      { x: '0', y: '1', z: '0' },
    ],
    { layer: 6 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const sheet = findPolygonSheet(result.diagram, result.id)
  assert.equal(sheet.geometricKind, 'sheet')
  assert.equal(sheet.kind, 'polygonSheet')
  assert.equal(sheet.codim, 1)
  assert.equal(sheet.layer, 6)
  assert.equal(sheet.vertices.length, 3)

  const committed = commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    6,
    { kind: 'layer', layer: 0 },
  )
  assert.deepEqual(committed.selectedElement, {
    kind: 'stratum',
    id: result.id,
  })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 6 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, sheet.layer), true)
})

test('direct polygon sheet creation commits to editable diagram state', () => {
  const initialState = createTestEditorState(threeDimensionalExample)
  const result = addPolygonSheetFromDirectInput(
    initialState.editableDiagram,
    [
      { x: '0', y: '0', z: '2' },
      { x: '1', y: '0', z: '2' },
      { x: '0', y: '1', z: '2' },
    ],
    { layer: 9 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 9)
  const sheet = findPolygonSheet(committed.editableDiagram, result.id)

  assert.equal(
    committed.editableDiagram.strata.length,
    initialState.editableDiagram.strata.length + 1,
  )
  assert.deepEqual(sheet.vertices, [
    { x: 0, y: 0, z: 2 },
    { x: 1, y: 0, z: 2 },
    { x: 0, y: 1, z: 2 },
  ])
  assert.equal(sheet.layer, 9)
  assert.match(generateTikz(committed.editableDiagram), /-- cycle;/)
})

test('direct creation on a hidden layer updates the filter and keeps selection visible', () => {
  const initialState = createTestEditorState(twoDimensionalExample, {
    kind: 'layer',
    layer: 0,
  })
  const result = addPointStratumFromDirectInput(
    initialState.editableDiagram,
    { x: '1', y: '2', z: '99' },
    { layer: 42 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const committed = commitDirectCreationToTestState(initialState, result, {
    kind: 'stratum',
    id: result.id,
  }, 42)

  assert.deepEqual(committed.selectedElement, { kind: 'stratum', id: result.id })
  assert.deepEqual(committed.layerFilter, { kind: 'layer', layer: 42 })
  assert.equal(layerFilterIncludesLayer(committed.layerFilter, 42), true)
})

test('direct polygon sheet creation is unavailable in 2D and rejects invalid input', () => {
  const twoDimensionalResult = addPolygonSheetFromDirectInput(
    twoDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '0', z: '0' },
      { x: '0', y: '1', z: '0' },
    ],
  )
  assert.equal(twoDimensionalResult.ok, false)
  if (twoDimensionalResult.ok) {
    throw new Error('Expected 2D sheet creation to be rejected.')
  }
  assert.equal(twoDimensionalResult.error, 'unsupportedAmbientDimension')

  const invalidResult = addPolygonSheetFromDirectInput(threeDimensionalExample, [
    { x: '0', y: '0', z: '0' },
    { x: 'NaN', y: '0', z: '0' },
    { x: '0', y: '1', z: '0' },
  ])
  assert.equal(invalidResult.ok, false)
  if (invalidResult.ok) {
    throw new Error('Expected invalid sheet coordinates to be rejected.')
  }
  assert.equal(invalidResult.error, 'invalidCoordinates')
})

test('curved hemisphere sheet creation preserves work-plane frame, style, layer, SVG, TikZ, and save/load', () => {
  const style = sheetStyle({
    fillColor: '#112233',
    fillOpacity: 0.42,
    strokeColor: '#445566',
    strokeOpacity: 0.77,
  })
  const center = { x: 1, y: 20, z: 3 }
  const result = addCurvedSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    center,
    testCustomWorkPlane,
    {
      kind: 'hemisphere',
      radius: 1.5,
      hemisphereSide: 'negative',
      sampling: { uSegments: 4, vSegments: 2 },
    },
    {
      id: 'ui-hemisphere',
      name: 'UI Hemisphere',
      layer: 9,
      style,
    },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected hemisphere creation to succeed.')
  }

  const sheet = findCurvedSheet(result.diagram, result.id)
  assert.equal(sheet.codim, 1)
  assert.equal(sheet.layer, 9)
  assert.deepEqual(sheet.style, style)
  assert.equal(sheet.primitive.kind, 'hemisphere')
  assert.deepEqual(sheet.primitive.center, center)
  assert.deepEqual(sheet.primitive.frame, {
    ...expectedFrameSnapshot,
    origin: center,
  })
  assert.equal(sheet.primitive.hemisphereSide, 'negative')

  const mesh = curvedSheetToSvgMesh(
    sheet,
    createInitialCamera3D(),
    240,
  )
  assert.equal(mesh.primitiveKind, 'hemisphere')
  assert.equal(mesh.faces.length, 8)
  assert.equal(mesh.boundaryPathData.length, 1)

  const tikz = generateTikz(result.diagram)
  assert.match(tikz, /Primitive: hemisphere; sampling: u=4, v=2; faces=8/)
  assert.match(tikz, /\{HTML\}\{112233\}/)
  assert.match(tikz, /\{HTML\}\{445566\}/)
  assert.match(tikz, /fill opacity=0\.42/)
  assert.match(tikz, /draw opacity=0\.77/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer9,main\}/)

  const parsed = parseSavedDiagramJson(serializeDiagram(result.diagram))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  assert.deepEqual(findCurvedSheet(parsed.diagram, result.id), sheet)
})

test('curved saddle sheet editing accepts valid primitive updates and rejects invalid parameters', () => {
  const result = addCurvedSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { kind: 'xy', z: 0 },
    {
      kind: 'saddle',
      width: 2,
      depth: 3,
      height: 0.5,
      sampling: { uSegments: 3, vSegments: 2 },
    },
    { id: 'ui-saddle', layer: -3 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected saddle creation to succeed.')
  }

  const invalidWidth = updateCurvedSheetPrimitiveById(
    result.diagram,
    result.id,
    (primitive) =>
      primitive.kind === 'saddle' ? { ...primitive, width: 0 } : primitive,
  )
  assert.deepEqual(findCurvedSheet(invalidWidth, result.id), findCurvedSheet(result.diagram, result.id))

  const invalidSampling = updateCurvedSheetPrimitiveById(
    result.diagram,
    result.id,
    (primitive) => ({
      ...primitive,
      sampling: { ...primitive.sampling, uSegments: 65 },
    }),
  )
  assert.deepEqual(
    findCurvedSheet(invalidSampling, result.id),
    findCurvedSheet(result.diagram, result.id),
  )

  const edited = updateCurvedSheetPrimitiveById(
    result.diagram,
    result.id,
    (primitive) =>
      primitive.kind === 'saddle'
        ? {
            ...primitive,
            height: -1.25,
            sampling: { uSegments: 4, vSegments: 3 },
          }
        : primitive,
  )
  const sheet = findCurvedSheet(edited, result.id)

  assert.equal(sheet.primitive.kind, 'saddle')
  assert.equal(sheet.primitive.height, -1.25)
  assert.deepEqual(sheet.primitive.sampling, { uSegments: 4, vSegments: 3 })
  assert.match(
    generateTikz(edited),
    /Primitive: saddle; sampling: u=4, v=3; faces=12/,
  )
})

test('curved sheet layer and style edits update TikZ output', () => {
  const result = addCurvedSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { kind: 'xy', z: 0 },
    {
      kind: 'saddle',
      width: 2,
      depth: 2,
      height: 1,
      sampling: { uSegments: 2, vSegments: 2 },
    },
    { id: 'style-layer-saddle', layer: 0 },
  )

  assert.notEqual(result.id, null)
  if (result.id === null) {
    throw new Error('Expected curved sheet creation to succeed.')
  }

  const editedLayer = updateStratumById(result.diagram, result.id, (stratum) => ({
    ...stratum,
    layer: 7,
  }))
  const editedStyle = updateStratumStyleById(editedLayer, result.id, (style) =>
    style.kind === 'sheetStyle'
      ? {
          ...style,
          fillColor: '#AA5500',
          fillOpacity: 0.31,
          strokeColor: '#0055AA',
          strokeOpacity: 0.64,
        }
      : style,
  )
  const tikz = generateTikz(editedStyle)

  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer7,main\}/)
  assert.match(tikz, /\{HTML\}\{AA5500\}/)
  assert.match(tikz, /\{HTML\}\{0055AA\}/)
  assert.match(tikz, /fill opacity=0\.31/)
  assert.match(tikz, /draw opacity=0\.64/)
})

test('curved sheet creation rejects unsupported ambient dimension and invalid primitive parameters', () => {
  const twoDimensionalResult = addCurvedSheetStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { kind: 'xy', z: 0 },
    {
      kind: 'hemisphere',
      radius: 1,
      hemisphereSide: 'positive',
      sampling: { uSegments: 4, vSegments: 2 },
    },
  )
  assert.equal(twoDimensionalResult.id, null)
  assert.equal(twoDimensionalResult.diagram, emptyTwoDimensionalDiagram)

  const invalidRadius = addCurvedSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { kind: 'xy', z: 0 },
    {
      kind: 'hemisphere',
      radius: 0,
      hemisphereSide: 'positive',
      sampling: { uSegments: 4, vSegments: 2 },
    },
  )
  assert.equal(invalidRadius.id, null)

  const invalidSampling = addCurvedSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { kind: 'xy', z: 0 },
    {
      kind: 'saddle',
      width: 2,
      depth: 2,
      height: 1,
      sampling: { uSegments: 2.5, vSegments: 2 },
    },
  )
  assert.equal(invalidSampling.id, null)
})

test('ruled surface creation copies two valid boundary paths and leaves sources unchanged', () => {
  const diagram = createRuledSurfaceSourceDiagram()
  const source0Before = findConcatenatedPath(diagram, 'ruled-boundary-0')
  const source1Before = findConcatenatedPath(diagram, 'ruled-boundary-1')
  const style = sheetStyle({
    fillColor: '#AA8844',
    fillOpacity: 0.37,
    strokeColor: '#2255AA',
    strokeOpacity: 0.68,
  })
  const result = createRuledSurfaceFromBoundaryPaths(
    diagram,
    ['ruled-boundary-0', 'ruled-boundary-1'],
    {
      id: 'ui-ruled-surface',
      name: 'UI Ruled Surface',
      layer: 6,
      style,
      samplingSegments: 5,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(createRuledSurfaceFromBoundaryPathsErrorMessage(result.error))
  }

  assert.deepEqual(findConcatenatedPath(result.diagram, 'ruled-boundary-0'), source0Before)
  assert.deepEqual(findConcatenatedPath(result.diagram, 'ruled-boundary-1'), source1Before)

  const sheet = findCurvedSheet(result.diagram, result.id)

  assert.equal(sheet.codim, 1)
  assert.equal(sheet.layer, 6)
  assert.deepEqual(sheet.style, style)
  assert.equal(sheet.primitive.kind, 'ruledSurface')
  assert.deepEqual(sheet.primitive.sampling, { segments: 5 })
  assert.notEqual(sheet.primitive.boundary0.segments, source0Before.segments)
  assert.notEqual(sheet.primitive.boundary1.segments, source1Before.segments)
  assert.deepEqual(sheet.primitive.boundary0.segments, source0Before.segments)
  assert.deepEqual(sheet.primitive.boundary1.segments, source1Before.segments)

  const editedSources = updateStratumById(result.diagram, 'ruled-boundary-0', (stratum) =>
    stratum.geometricKind === 'curve' && stratum.kind === 'concatenatedPath'
      ? {
          ...stratum,
          segments: [
            {
              kind: 'line',
              start: { x: 10, y: 0, z: 0 },
              end: { x: 12, y: 0, z: 0 },
            },
          ],
        }
      : stratum,
  )

  assert.deepEqual(
    findCurvedSheet(editedSources, result.id).primitive,
    sheet.primitive,
  )

  const mesh = curvedSheetToSvgMesh(sheet, createInitialCamera3D(), 240)

  assert.equal(mesh.primitiveKind, 'ruledSurface')
  assert.equal(mesh.uSegments, 5)
  assert.equal(mesh.vSegments, 1)
  assert.equal(mesh.faces.length, 5)
  assert.equal(mesh.boundaryPathData.length, 1)
  assert.doesNotMatch(
    [...mesh.faces.map((face) => face.points), ...mesh.boundaryPathData].join('\n'),
    /NaN|Infinity/,
  )

  const tikz = generateTikz(result.diagram)

  assert.match(tikz, /Ruled surface generated from two boundary paths/)
  assert.match(tikz, /Primitive: ruledSurface; sampling: u=5, v=1; faces=5/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer0,stratifiedLayer6,main\}/)
  assert.match(tikz, /\{HTML\}\{AA8844\}/)
  assert.match(tikz, /\{HTML\}\{2255AA\}/)
  assert.match(tikz, /fill opacity=0\.37/)
  assert.match(tikz, /draw opacity=0\.68/)
  assert.equal((tikz.match(/\\filldraw/g) ?? []).length, 5)
  assert.doesNotMatch(tikz, /NaN|Infinity/)

  const parsed = parseSavedDiagramJson(serializeDiagram(result.diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  assert.deepEqual(findCurvedSheet(parsed.diagram, result.id), sheet)
})

test('ruled surface creation rejects invalid boundary selections safely', () => {
  const diagram = createRuledSurfaceSourceDiagram()

  assertRuledSurfaceCreationError(
    createRuledSurfaceFromBoundaryPaths(diagram, ['ruled-boundary-0']),
    'wrongBoundaryCount',
  )
  assertRuledSurfaceCreationError(
    createRuledSurfaceFromBoundaryPaths(
      diagram,
      ['ruled-boundary-0', 'ruled-boundary-0'],
    ),
    'duplicateSourcePath',
  )
  assertRuledSurfaceCreationError(
    createRuledSurfaceFromBoundaryPaths(
      diagram,
      ['ruled-boundary-0', 'missing-path'],
    ),
    'missingSourcePath',
  )
  assertRuledSurfaceCreationError(
    createRuledSurfaceFromBoundaryPaths(
      createRuledSurfaceSourceDiagramWithPoint(),
      ['ruled-boundary-0', 'not-a-boundary'],
    ),
    'sourceNotBoundaryPath',
  )
  assertRuledSurfaceCreationError(
    createRuledSurfaceFromBoundaryPaths(
      diagram,
      ['ruled-boundary-0', 'ruled-boundary-1'],
      { samplingSegments: 0 },
    ),
    'invalidSampling',
  )
})

test('ruled surface sampling edits update SVG mesh and TikZ export', () => {
  const result = createRuledSurfaceFromBoundaryPaths(
    createRuledSurfaceSourceDiagram(),
    ['ruled-boundary-0', 'ruled-boundary-1'],
    { id: 'editable-ruled-surface', samplingSegments: 3 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected ruled surface creation to succeed.')
  }

  const edited = updateCurvedSheetPrimitiveById(
    result.diagram,
    result.id,
    (primitive) =>
      primitive.kind === 'ruledSurface'
        ? { ...primitive, sampling: { segments: 7 } }
        : primitive,
  )
  const sheet = findCurvedSheet(edited, result.id)
  const mesh = curvedSheetToSvgMesh(sheet, createInitialCamera3D(), 240)

  assert.equal(mesh.faces.length, 7)
  assert.match(
    generateTikz(edited),
    /Primitive: ruledSurface; sampling: u=7, v=1; faces=7/,
  )
})

test('ruled surface creation is undoable and redoable through diagram history', () => {
  const initial = createUndoTestEditorState(createRuledSurfaceSourceDiagram())
  const result = createRuledSurfaceFromBoundaryPaths(
    initial.editableDiagram,
    ['ruled-boundary-0', 'ruled-boundary-1'],
    { id: 'undoable-ruled-surface', layer: 4 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected ruled surface creation to succeed.')
  }

  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: result.diagram,
    selectedElement: { kind: 'stratum', id: result.id },
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.equal(
    undone.editableDiagram.strata.some((stratum) => stratum.id === result.id),
    false,
  )
  assert.equal(
    redone.editableDiagram.strata.some((stratum) => stratum.id === result.id),
    true,
  )
})

test('ruled surface inline TikZ output has no blank lines', () => {
  const result = createRuledSurfaceFromBoundaryPaths(
    createRuledSurfaceSourceDiagram(),
    ['ruled-boundary-0', 'ruled-boundary-1'],
    { id: 'inline-ruled-surface', samplingSegments: 4 },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected ruled surface creation to succeed.')
  }

  const tikz = generateTikz(result.diagram, { exportMode: 'inlineMath' })

  assert.match(tikz, /Ruled surface generated from two boundary paths/)
  assertNoBlankLines(tikz)
})

test('direct creation layer helpers reject invalid layer input and keep TikZ UI-state independent', () => {
  assert.equal(parseDirectLayerInput(''), null)
  assert.equal(parseDirectLayerInput('Infinity'), null)
  assert.equal(parseDirectLayerInput('3'), 3)

  const result = addPointStratumFromDirectInput(
    twoDimensionalExample,
    { x: '1', y: '2', z: '9' },
    { layer: 8 },
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const before = generateTikz(result.diagram)
  commitDirectCreationResult(
    result.diagram,
    { kind: 'stratum', id: result.id },
    8,
    { kind: 'layer', layer: 0 },
  )

  assert.equal(generateTikz(result.diagram), before)
})

test('direct coordinate rows parse only exposed axes for the ambient dimension', () => {
  assert.deepEqual(parseDirectCoordinateRows('0 1\n2,3', 2), [
    { x: '0', y: '1', z: '0' },
    { x: '2', y: '3', z: '0' },
  ])
  assert.deepEqual(parseDirectCoordinateRows('0 1 2\n3,4,5', 3), [
    { x: '0', y: '1', z: '2' },
    { x: '3', y: '4', z: '5' },
  ])
  assert.deepEqual(
    parseDirectCoordinateRows('0 1\n2,3', 3, {
      coordinateMode: 'workPlaneLocal',
    }),
    [
      { x: '0', y: '1', z: '0' },
      { x: '2', y: '3', z: '0' },
    ],
  )
  assert.equal(parseDirectCoordinateRows('0 1 2', 2), null)
  assert.equal(
    parseDirectCoordinateRows('0 1 2', 3, {
      coordinateMode: 'workPlaneLocal',
    }),
    null,
  )
})

test('plane-local point direct creation converts input through a custom work plane', () => {
  const result = addPointStratumFromDirectInput(
    threeDimensionalExample,
    { x: '2', y: '3', z: '99' },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected plane-local point creation to succeed.')
  }

  assert.deepEqual(findPoint(result.diagram, result.id).position, {
    x: 12,
    y: 20,
    z: 33,
  })
})

test('plane-local label direct creation converts the label position', () => {
  const result = addTextLabelFromDirectInput(
    threeDimensionalExample,
    { x: '-4', y: '5', z: '99' },
    '$F$',
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected plane-local label creation to succeed.')
  }

  assert.deepEqual(findLabel(result.diagram, result.id).position, {
    x: 6,
    y: 20,
    z: 35,
  })
})

test('plane-local polyline direct creation converts every vertex', () => {
  const result = addPolylineCurveFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '-3', y: '4', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findCurve(result.diagram, result.id).points, [
    { x: 10, y: 20, z: 30 },
    { x: 11, y: 20, z: 32 },
    { x: 7, y: 20, z: 34 },
  ])
})

test('plane-local cubic Bezier direct creation converts absolute point-like inputs', () => {
  const result = addCubicBezierCurveFromDirectInput(
    emptyThreeDimensionalDiagram,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '2', z: '0' },
      { x: '3', y: '4', z: '0' },
      { x: '5', y: '6', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
      directControlMode: 'absolute',
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findCurve(result.diagram, result.id).points, [
    { x: 10, y: 20, z: 30 },
    { x: 11, y: 20, z: 32 },
    { x: 13, y: 20, z: 34 },
    { x: 15, y: 20, z: 36 },
  ])
})

test('plane-local relative Cartesian cubic Bezier creation stores frame metadata and absolute controls', () => {
  const result = addCubicBezierCurveFromDirectInput(
    emptyThreeDimensionalDiagram,
    [
      { x: '2', y: '3', z: '0' },
      { x: '6', y: '7', z: '0' },
      { x: '2', y: '-1', z: '0' },
      { x: '-3', y: '4', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
      directControlMode: 'relativeCartesian',
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)

  assert.deepEqual(curve.points, [
    { x: 12, y: 20, z: 33 },
    { x: 14, y: 20, z: 32 },
    { x: 13, y: 20, z: 41 },
    { x: 16, y: 20, z: 37 },
  ])
  assert.deepEqual(curve.bezierControls, {
    kind: 'workPlaneRelativeCartesian',
    frame: expectedFrameSnapshot,
    localStart: { a: 2, b: 3 },
    localEnd: { a: 6, b: 7 },
    firstControlOffset: { dx: 2, dy: -1 },
    secondControlOffset: { dx: -3, dy: 4 },
    secondOffsetReference: 'end',
  })
})

test('plane-local relative polar cubic Bezier creation stores frame metadata and angle-radius controls', () => {
  const result = addCubicBezierCurveFromDirectInput(
    threeDimensionalExample,
    [
      { x: '1', y: '2', z: '0' },
      { x: '5', y: '6', z: '0' },
      { x: '0', y: '2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
      directControlMode: 'relativePolar',
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, result.id)

  assert.equal(curve.bezierControls?.kind, 'workPlaneRelativePolar')
  assert.deepEqual(curve.points[1], { x: 13, y: 20, z: 32 })
  assert.ok(Math.abs(curve.points[2].x - 15) < 1e-9)
  assert.ok(Math.abs(curve.points[2].y - 20) < 1e-9)
  assert.ok(Math.abs(curve.points[2].z - 39) < 1e-9)
  assert.deepEqual(curve.bezierControls, {
    kind: 'workPlaneRelativePolar',
    frame: expectedFrameSnapshot,
    localStart: { a: 1, b: 2 },
    localEnd: { a: 5, b: 6 },
    firstControl: { angleDegrees: 0, radius: 2 },
    secondControl: { angleDegrees: 90, radius: 3 },
    secondOffsetReference: 'end',
  })
})

test('plane-local relative Bezier metadata does not depend on later active work-plane changes', () => {
  const result = addCubicBezierCurveFromDirectInput(
    emptyThreeDimensionalDiagram,
    [
      { x: '1', y: '2', z: '0' },
      { x: '5', y: '6', z: '0' },
      { x: '0', y: '2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
      directControlMode: 'relativePolar',
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const laterActiveWorkPlane: WorkPlane = {
    kind: 'axisAligned',
    plane: 'xy',
    offset: 999,
  }
  const tikz = generateTikz(result.diagram)

  assert.equal(laterActiveWorkPlane.offset, 999)
  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /plane origin=\{\(10,20,30\)\}/)
  assert.match(tikz, /plane x=\{\(11,20,30\)\}/)
  assert.match(tikz, /plane y=\{\(10,20,31\)\}/)
  assert.match(
    tikz,
    /\(1,2\) \.\. controls \+\(0:2\) and \+\(90:3\) \.\. \(5,6\);/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierCubicBezier0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierCubicBezier0p2\)/)
})

test('global 3D relative polar cubic Bezier creation remains unsupported', () => {
  const result = addCubicBezierCurveFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '1', y: '0', z: '0' },
      { x: '0', y: '2', z: '0' },
      { x: '90', y: '3', z: '0' },
    ],
    { directControlMode: 'relativePolar' },
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected global 3D relative polar creation to be rejected.')
  }
  assert.equal(result.error, 'unsupportedAmbientDimension')
})

test('plane-local sheet direct creation converts vertices onto the plane', () => {
  const result = addPolygonSheetFromDirectInput(
    threeDimensionalExample,
    [
      { x: '0', y: '0', z: '0' },
      { x: '2', y: '0', z: '0' },
      { x: '0', y: '2', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const sheet = findPolygonSheet(result.diagram, result.id)
  assert.deepEqual(sheet.vertices, [
    { x: 10, y: 20, z: 30 },
    { x: 12, y: 20, z: 30 },
    { x: 10, y: 20, z: 32 },
  ])
  assert.equal(sheet.vertices.every((vertex) => vertex.y === 20), true)
})

test('axis-aligned work-plane local direct input uses existing basis mappings', () => {
  assert.deepEqual(
    createPlaneLocalPoint({ kind: 'xy', z: 7 }, { x: '1', y: '2', z: '0' }),
    { x: 1, y: 2, z: 7 },
  )
  assert.deepEqual(
    createPlaneLocalPoint({ kind: 'xz', y: 4 }, { x: '1', y: '2', z: '0' }),
    { x: 1, y: 4, z: 2 },
  )
  assert.deepEqual(
    createPlaneLocalPoint({ kind: 'yz', x: 9 }, { x: '1', y: '2', z: '0' }),
    { x: 9, y: 1, z: 2 },
  )
})

test('plane-local direct creation rejects non-finite input, invalid planes, and non-finite results', () => {
  const nonFiniteInput = addPointStratumFromDirectInput(
    threeDimensionalExample,
    { x: 'Infinity', y: '0', z: '0' },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )
  assert.equal(nonFiniteInput.ok, false)

  const invalidPlane = addPointStratumFromDirectInput(
    threeDimensionalExample,
    { x: '1', y: '0', z: '0' },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: {
        ...testCustomWorkPlane,
        u: { x: 2, y: 0, z: 0 },
      },
    },
  )
  assert.equal(invalidPlane.ok, false)

  const nonFiniteResult = addPointStratumFromDirectInput(
    threeDimensionalExample,
    { x: String(Number.MAX_VALUE), y: '0', z: '0' },
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: {
        ...testCustomWorkPlane,
        origin: { x: Number.MAX_VALUE, y: 0, z: 0 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
    },
  )
  assert.equal(nonFiniteResult.ok, false)
})

test('global 3D direct creation remains unchanged when coordinate mode is global', () => {
  const result = addPointStratumFromDirectInput(
    threeDimensionalExample,
    { x: '1', y: '2', z: '3' },
    {
      coordinateMode: 'global',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected global direct point creation to succeed.')
  }

  assert.deepEqual(findPoint(result.diagram, result.id).position, {
    x: 1,
    y: 2,
    z: 3,
  })
})

test('existing point coordinate source copies the current point position', () => {
  const pointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 2, y: 3, z: 0 },
    { id: 'source-point', name: 'P' },
  )
  const result = addPolylineCurveFromDirectInput(
    pointResult.diagram,
    [
      sourceInput({ kind: 'pointStratum', stratumId: 'source-point' }),
      { x: '4', y: '5', z: '0' },
    ],
    { id: 'copied-from-point' },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findCurve(result.diagram, result.id).points[0], {
    x: 2,
    y: 3,
    z: 0,
  })
})

test('existing coordinate source labels disambiguate duplicate point names', () => {
  const firstPointResult = addPointStratumWithResult(
    emptyTwoDimensionalDiagram,
    { x: 1.2, y: 0.5, z: 9 },
    { id: 'pt-3', name: 'point' },
  )
  const secondPointResult = addPointStratumWithResult(
    firstPointResult.diagram,
    { x: -1, y: 2, z: 9 },
    { id: 'p-left', name: 'point' },
  )
  const options = createExistingCoordinateSourceOptions(secondPointResult.diagram)
  const labels = options
    .filter((option) => option.source.kind === 'pointStratum')
    .map((option) => option.label)

  assert.deepEqual(labels, [
    'Point: point [pt-3] @ (1.2, 0.5)',
    'Point: point [p-left] @ (-1, 2)',
  ])
  assert.equal(new Set(labels).size, labels.length)
})

test('existing coordinate source labels include roles, ids, and formatted coordinates', () => {
  const polylineResult = addPolylineCurveStratumWithResult(
    emptyThreeDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 5 },
    ],
    { id: 'curve-main', name: 'Boundary' },
  )
  assert.notEqual(polylineResult.id, null)

  const sheetResult = addPolygonSheetStratumWithResult(
    polylineResult.diagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ],
    { id: 'sheet-top', name: 'Surface' },
  )
  assert.notEqual(sheetResult.id, null)

  const cubicResult = addCubicBezierCurveStratumWithResult(
    sheetResult.diagram,
    [
      { x: 0, y: 1, z: 2 },
      { x: 3, y: 4, z: 5 },
      { x: 6, y: 7, z: 8 },
      { x: 9, y: 10, z: 11 },
    ],
    { id: 'bezier-arc', name: 'FLine' },
  )
  assert.notEqual(cubicResult.id, null)

  assert.equal(
    formatExistingCoordinateSourceLabel(
      cubicResult.diagram,
      { kind: 'polylineVertex', curveId: 'curve-main', vertexIndex: 1 },
      3,
    ),
    'Polyline: Boundary [curve-main] / Vertex 2 @ (3, 4, 5)',
  )
  assert.equal(
    formatExistingCoordinateSourceLabel(
      cubicResult.diagram,
      { kind: 'sheetVertex', sheetId: 'sheet-top', vertexIndex: 1 },
      3,
    ),
    'Sheet: Surface [sheet-top] / Vertex 2 @ (1, 2, 3)',
  )
  assert.equal(
    formatExistingCoordinateSourceLabel(
      cubicResult.diagram,
      { kind: 'cubicBezierPoint', curveId: 'bezier-arc', pointRole: 'start' },
      3,
    ),
    'Bezier: FLine [bezier-arc] / Start @ (0, 1, 2)',
  )
  assert.equal(
    formatExistingCoordinateSourceLabel(
      cubicResult.diagram,
      { kind: 'cubicBezierPoint', curveId: 'bezier-arc', pointRole: 'control1' },
      3,
    ),
    'Bezier: FLine [bezier-arc] / Control point 1 @ (3, 4, 5)',
  )
  assert.equal(
    formatExistingCoordinateSourceLabel(
      cubicResult.diagram,
      { kind: 'cubicBezierPoint', curveId: 'bezier-arc', pointRole: 'control2' },
      3,
    ),
    'Bezier: FLine [bezier-arc] / Control point 2 @ (6, 7, 8)',
  )
  assert.equal(
    formatExistingCoordinateSourceLabel(
      cubicResult.diagram,
      { kind: 'cubicBezierPoint', curveId: 'bezier-arc', pointRole: 'end' },
      3,
    ),
    'Bezier: FLine [bezier-arc] / End @ (9, 10, 11)',
  )
})

test('existing coordinate source labels handle missing sources gracefully', () => {
  assert.equal(
    formatExistingCoordinateSourceLabel(
      emptyTwoDimensionalDiagram,
      { kind: 'pointStratum', stratumId: 'deleted-point' },
      2,
    ),
    'Missing source: deleted-point',
  )
})

test('existing 2D polyline vertex source copies the vertex with z normalized to zero', () => {
  const sourceResult = addPolylineCurveStratumWithResult(
    emptyTwoDimensionalDiagram,
    [
      { x: 0, y: 0, z: 9 },
      { x: 6, y: 7, z: 9 },
    ],
    { id: 'source-polyline-2d', name: 'Boundary' },
  )
  assert.notEqual(sourceResult.id, null)

  const result = addPolylineCurveFromDirectInput(
    sourceResult.diagram,
    [
      sourceInput({
        kind: 'polylineVertex',
        curveId: 'source-polyline-2d',
        vertexIndex: 1,
      }),
      { x: '8', y: '9', z: '0' },
    ],
    { id: 'copied-from-2d-polyline' },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findCurve(result.diagram, result.id).points[0], {
    x: 6,
    y: 7,
    z: 0,
  })
})

test('existing 3D polyline vertex source copies the full Vec3', () => {
  const sourceResult = addPolylineCurveStratumWithResult(
    emptyThreeDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 3, z: 4 },
    ],
    { id: 'source-polyline-3d' },
  )
  assert.notEqual(sourceResult.id, null)

  const result = addPolylineCurveFromDirectInput(
    sourceResult.diagram,
    [
      sourceInput({
        kind: 'polylineVertex',
        curveId: 'source-polyline-3d',
        vertexIndex: 1,
      }),
      { x: '5', y: '6', z: '7' },
    ],
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findCurve(result.diagram, result.id).points[0], {
    x: 2,
    y: 3,
    z: 4,
  })
})

test('existing 3D polygon sheet vertex source copies the full Vec3', () => {
  const sourceResult = addPolygonSheetStratumWithResult(
    emptyThreeDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 5 },
      { x: 0, y: 2, z: 0 },
    ],
    { id: 'source-sheet', name: 'Surface' },
  )
  assert.notEqual(sourceResult.id, null)

  const result = addPolygonSheetFromDirectInput(
    sourceResult.diagram,
    [
      sourceInput({ kind: 'sheetVertex', sheetId: 'source-sheet', vertexIndex: 1 }),
      { x: '6', y: '4', z: '5' },
      { x: '3', y: '8', z: '5' },
    ],
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findPolygonSheet(result.diagram, result.id).vertices[0], {
    x: 3,
    y: 4,
    z: 5,
  })
})

test('existing coordinate sources are copy-on-create and do not store live references', () => {
  const pointResult = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 1, y: 2, z: 3 },
    { id: 'anchor-point' },
  )
  const result = addPolylineCurveFromDirectInput(
    pointResult.diagram,
    [
      sourceInput({ kind: 'pointStratum', stratumId: 'anchor-point' }),
      { x: '4', y: '5', z: '6' },
    ],
    { id: 'copied-curve' },
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const moved = updateStratumById(result.diagram, 'anchor-point', (stratum) =>
    stratum.geometricKind === 'point'
      ? { ...stratum, position: { x: 9, y: 9, z: 9 } }
      : stratum,
  )
  const copiedCurve = findCurve(moved, result.id)

  assert.deepEqual(copiedCurve.points[0], { x: 1, y: 2, z: 3 })
  assert.equal('source' in copiedCurve.points[0], false)
  assert.equal(JSON.stringify(copiedCurve).includes('anchor-point'), false)
})

test('global coordinate mode copies source model-space Vec3 exactly', () => {
  const pointResult = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: -1, y: 2.5, z: 8 },
    { id: 'global-source' },
  )
  const result = addPolylineCurveFromDirectInput(
    pointResult.diagram,
    [
      sourceInput({ kind: 'pointStratum', stratumId: 'global-source' }),
      { x: '0', y: '0', z: '0' },
    ],
    { coordinateMode: 'global', workPlane: testCustomWorkPlane },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findCurve(result.diagram, result.id).points[0], {
    x: -1,
    y: 2.5,
    z: 8,
  })
})

test('plane-local existing coordinate sources require on-plane coordinates and compute local coordinates', () => {
  const onPlaneResult = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 12, y: 20, z: 33 },
    { id: 'on-plane-source' },
  )
  const source: ExistingCoordinateSource = {
    kind: 'pointStratum',
    stratumId: 'on-plane-source',
  }
  const localInput = localDirectCoordinateInputFromExistingSource(
    onPlaneResult.diagram,
    source,
    testCustomWorkPlane,
  )

  assert.deepEqual(localInput, {
    x: '2',
    y: '3',
    z: '0',
    source,
  })

  const onPlaneCreation = addPolylineCurveFromDirectInput(
    onPlaneResult.diagram,
    [sourceInput(source), { x: '0', y: '0', z: '0' }],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(onPlaneCreation.ok, true)
  if (!onPlaneCreation.ok) {
    throw new Error(onPlaneCreation.error)
  }
  assert.deepEqual(findCurve(onPlaneCreation.diagram, onPlaneCreation.id).points[0], {
    x: 12,
    y: 20,
    z: 33,
  })

  const offPlaneResult = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 12, y: 21, z: 33 },
    { id: 'off-plane-source' },
  )
  const offPlaneCreation = addPolylineCurveFromDirectInput(
    offPlaneResult.diagram,
    [
      sourceInput({ kind: 'pointStratum', stratumId: 'off-plane-source' }),
      { x: '0', y: '0', z: '0' },
    ],
    {
      coordinateMode: 'workPlaneLocal',
      workPlane: testCustomWorkPlane,
    },
  )

  assert.equal(offPlaneCreation.ok, false)
  if (offPlaneCreation.ok) {
    throw new Error('Expected off-plane source to be rejected.')
  }
  assert.equal(offPlaneCreation.error, 'invalidCoordinates')
  assert.strictEqual(offPlaneCreation.diagram, offPlaneResult.diagram)
})

test('missing, invalid-index, and non-finite existing coordinate sources are rejected', () => {
  const sourceResult = addPolylineCurveStratumWithResult(
    emptyThreeDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
    ],
    { id: 'valid-polyline-source' },
  )
  assert.notEqual(sourceResult.id, null)

  const missing = addPolylineCurveFromDirectInput(sourceResult.diagram, [
    sourceInput({ kind: 'pointStratum', stratumId: 'missing-point' }),
    { x: '0', y: '0', z: '0' },
  ])
  assert.equal(missing.ok, false)
  if (missing.ok) {
    throw new Error('Expected missing source to be rejected.')
  }
  assert.equal(missing.error, 'invalidCoordinates')
  assert.strictEqual(missing.diagram, sourceResult.diagram)

  const invalidIndex = addPolylineCurveFromDirectInput(sourceResult.diagram, [
    sourceInput({
      kind: 'polylineVertex',
      curveId: 'valid-polyline-source',
      vertexIndex: 9,
    }),
    { x: '0', y: '0', z: '0' },
  ])
  assert.equal(invalidIndex.ok, false)

  const nonFiniteDiagram: Diagram = {
    ...sourceResult.diagram,
    strata: sourceResult.diagram.strata.map((stratum) =>
      stratum.id === 'valid-polyline-source' && stratum.geometricKind === 'curve'
        ? {
            ...stratum,
            points: [
              { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
              ...stratum.points.slice(1),
            ],
          }
        : stratum,
    ),
  }
  const nonFinite = addPolylineCurveFromDirectInput(nonFiniteDiagram, [
    sourceInput({
      kind: 'polylineVertex',
      curveId: 'valid-polyline-source',
      vertexIndex: 0,
    }),
    { x: '0', y: '0', z: '0' },
  ])
  assert.equal(nonFinite.ok, false)
})

test('source kind validation rejects mismatched stratum kinds', () => {
  const pointResult = addPointStratumWithResult(
    emptyThreeDimensionalDiagram,
    { x: 0, y: 0, z: 0 },
    { id: 'point-source-kind' },
  )
  const cubicResult = addCubicBezierCurveStratumWithResult(
    pointResult.diagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ],
    { id: 'cubic-source-kind' },
  )
  assert.notEqual(cubicResult.id, null)

  assert.equal(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'pointStratum',
      stratumId: 'cubic-source-kind',
    }),
    null,
  )
  assert.equal(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'polylineVertex',
      curveId: 'cubic-source-kind',
      vertexIndex: 0,
    }),
    null,
  )
  assert.equal(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'sheetVertex',
      sheetId: 'point-source-kind',
      vertexIndex: 0,
    }),
    null,
  )
})

test('cubic Bezier points can be used as existing coordinate sources', () => {
  const cubicResult = addCubicBezierCurveStratumWithResult(
    emptyTwoDimensionalDiagram,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 4, z: 0 },
      { x: 5, y: 6, z: 0 },
    ],
    { id: 'source-bezier', name: 'FLine' },
  )
  assert.notEqual(cubicResult.id, null)

  assert.deepEqual(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'cubicBezierPoint',
      curveId: 'source-bezier',
      pointRole: 'start',
    }),
    { x: 0, y: 0, z: 0 },
  )
  assert.deepEqual(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'cubicBezierPoint',
      curveId: 'source-bezier',
      pointRole: 'control1',
    }),
    { x: 1, y: 2, z: 0 },
  )
  assert.deepEqual(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'cubicBezierPoint',
      curveId: 'source-bezier',
      pointRole: 'control2',
    }),
    { x: 3, y: 4, z: 0 },
  )
  assert.deepEqual(
    resolveExistingCoordinateSource(cubicResult.diagram, {
      kind: 'cubicBezierPoint',
      curveId: 'source-bezier',
      pointRole: 'end',
    }),
    { x: 5, y: 6, z: 0 },
  )
})

const testCustomWorkPlane: WorkPlane = {
  kind: 'custom',
  id: 'test-custom-plane',
  name: 'Test custom plane',
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
  source: { kind: 'originNormal' },
}

const expectedFrameSnapshot = {
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}

function createRuledSurfaceSourceDiagram(): Diagram {
  const firstPath = addConcatenatedPathFromDirectInput(
    emptyThreeDimensionalDiagram,
    {
      start: { x: '0', y: '0', z: '0' },
      segments: [
        {
          kind: 'line',
          end: { x: '2', y: '0', z: '0' },
        },
      ],
    },
    {
      id: 'ruled-boundary-0',
      name: 'Ruled boundary 0',
      layer: 0,
    },
  )

  assert.equal(firstPath.ok, true)
  if (!firstPath.ok) {
    throw new Error('Expected first ruled source path to be created.')
  }

  const secondPath = addConcatenatedPathFromDirectInput(
    firstPath.diagram,
    {
      start: { x: '0', y: '1', z: '1' },
      segments: [
        {
          kind: 'line',
          end: { x: '2', y: '1', z: '1' },
        },
      ],
    },
    {
      id: 'ruled-boundary-1',
      name: 'Ruled boundary 1',
      layer: 0,
    },
  )

  assert.equal(secondPath.ok, true)
  if (!secondPath.ok) {
    throw new Error('Expected second ruled source path to be created.')
  }

  return secondPath.diagram
}

function createRuledSurfaceSourceDiagramWithPoint(): Diagram {
  return addPointStratumWithResult(
    createRuledSurfaceSourceDiagram(),
    { x: 0, y: 0, z: 0 },
    { id: 'not-a-boundary' },
  ).diagram
}

function createUndoTestEditorState(diagram: Diagram): UndoTestEditorState {
  return {
    ...createTestEditorState(diagram),
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(diagram),
  }
}

function assertRuledSurfaceCreationError(
  result: ReturnType<typeof createRuledSurfaceFromBoundaryPaths>,
  expectedError: Parameters<
    typeof createRuledSurfaceFromBoundaryPathsErrorMessage
  >[0],
): void {
  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected ruled surface creation to fail.')
  }

  assert.equal(result.error, expectedError)
}

function assertNoBlankLines(tikz: string): void {
  assert.deepEqual(
    tikz
      .split(/\r?\n/)
      .filter((line) => line.trim().length === 0),
    [],
  )
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Curve ${id} was not created.`)
  }

  return stratum
}

function findConcatenatedPath(
  diagram: Diagram,
  id: string,
): ConcatenatedPathStratum {
  const stratum = findCurve(diagram, id)

  if (stratum.kind !== 'concatenatedPath') {
    throw new Error(`Concatenated path ${id} was not created.`)
  }

  return stratum
}

function findTemplatePath(
  diagram: Diagram,
  id: string,
): TemplatePathStratum {
  const stratum = findCurve(diagram, id)

  if (stratum.kind !== 'templatePath') {
    throw new Error(`Template path ${id} was not created.`)
  }

  return stratum
}

function findPolygonSheet(
  diagram: Diagram,
  id: string,
): PolygonSheetStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'sheet' || stratum.kind !== 'polygonSheet') {
    throw new Error(`Polygon sheet ${id} was not created.`)
  }

  return stratum
}

function findCurvedSheet(diagram: Diagram, id: string): CurvedSheetStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'sheet' || stratum.kind !== 'curvedSheet') {
    throw new Error(`Curved sheet ${id} was not created.`)
  }

  return stratum
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Point ${id} was not created.`)
  }

  return stratum
}

function findLabel(diagram: Diagram, id: string): TextLabel {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Label ${id} was not created.`)
  }

  return label
}

function assertVec3ApproximatelyEqual(
  actual: Vec3,
  expected: Vec3,
  epsilon = 1e-9,
): void {
  assert.equal(approximatelyEqual(actual.x, expected.x, epsilon), true)
  assert.equal(approximatelyEqual(actual.y, expected.y, epsilon), true)
  assert.equal(approximatelyEqual(actual.z, expected.z, epsilon), true)
}

function approximatelyEqual(
  actual: number,
  expected: number,
  epsilon = 1e-9,
): boolean {
  return Math.abs(actual - expected) <= epsilon
}

function createPlaneLocalPoint(
  workPlane: WorkPlane,
  coordinates: { x: string; y: string; z: string },
): Vec3 {
  const result = addPointStratumFromDirectInput(
    threeDimensionalExample,
    coordinates,
    {
      coordinateMode: 'workPlaneLocal',
      workPlane,
    },
  )

  if (!result.ok) {
    throw new Error('Expected axis-aligned plane-local point creation to succeed.')
  }

  return findPoint(result.diagram, result.id).position
}

function createSymbolicTwoDimensionalDiagram(): Diagram {
  return {
    ...emptyTwoDimensionalDiagram,
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 2,
      },
    ],
  }
}

function createSymbolicThreeDimensionalDiagram(): Diagram {
  return {
    ...emptyThreeDimensionalDiagram,
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '10',
        previewValue: 10,
      },
    ],
  }
}

function sourceInput(source: ExistingCoordinateSource): {
  x: string
  y: string
  z: string
  source: ExistingCoordinateSource
} {
  return {
    x: '0',
    y: '0',
    z: '0',
    source,
  }
}

function sheetStyle(overrides: Partial<SheetStyle> = {}): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#2F80C0',
    strokeOpacity: 1,
    ...overrides,
  }
}

function createTestEditorState(
  diagram: Diagram,
  layerFilter: LayerFilter = { kind: 'all' },
): TestEditorState {
  return {
    editableDiagram: diagram,
    selectedElement: null,
    layerFilter,
    draftMarker: 'preserve unrelated editor state',
  }
}

function commitDirectCreationToTestState(
  state: TestEditorState,
  result: { diagram: Diagram },
  selectedElement: Exclude<SelectedElement, null>,
  createdLayer: number,
): TestEditorState {
  return applyDirectCreationCommitToEditorState(
    state,
    commitDirectCreationResult(
      result.diagram,
      selectedElement,
      createdLayer,
      state.layerFilter,
    ),
  )
}
