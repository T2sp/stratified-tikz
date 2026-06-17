import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateTikz,
  layerToTikzLayerName,
  maxCurvedSheetTikzFaces,
  sanitizeTikzSpathSaveName,
  sanitizeTikzNameStem,
} from '../../src/tikz/index.ts'
import type {
  ClosedPathBoundary,
  CurveStyle,
  Diagram,
  PerspectiveCamera3D,
  PointShape,
  PointStratum,
  PointStyle,
  RegionStyle,
  SheetStyle,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlane,
} from '../../src/model/types.ts'
import {
  createInitialCamera3D,
  resetCameraToInitial,
} from '../../src/model/camera.ts'

test('2D TikZ output uses ordinary (x,y) coordinates', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyWire0p1\) at \(1,2\);/)
  assert.doesNotMatch(tikz, /\(0,0,0\)/)
})

test('3D TikZ output uses tikz-3dplot camera setup and 3D coordinates', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(createThreeDimensionalDiagram(), { camera3d: camera })

  assert.match(tikz, /% Requires \\usepackage\{tikz-3dplot\}/)
  assert.match(tikz, /\\tdplotsetmaincoords\{70\}\{110\}/)
  assert.match(tikz, /tdplot_main_coords/)
  assert.match(tikz, /\\coordinate \(curvePolyLine0p0\) at \(0,0,1\);/)
  assert.doesNotMatch(tikz, /x=\{\(1cm,0cm\)\}/)
  assert.doesNotMatch(tikz, /y=\{\(0\.45cm,0\.25cm\)\}/)
  assert.doesNotMatch(tikz, /z=\{\(0cm,1cm\)\}/)
  assert.ok(
    tikz.indexOf('\\tdplotsetmaincoords{70}{110}') <
      tikz.indexOf('\\begin{tikzpicture}['),
  )
})

test('3D TikZ output uses diagram view camera metadata by default', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 41,
    phiDeg: -82,
  }
  const diagram: Diagram = {
    ...createThreeDimensionalDiagram(),
    view: { camera3d: camera },
  }
  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\tdplotsetmaincoords\{41\}\{-82\}/)
})

test('current camera option overrides saved diagram camera metadata', () => {
  const savedCamera = {
    ...createInitialCamera3D(),
    thetaDeg: 20,
    phiDeg: 30,
  }
  const currentCamera = {
    ...createInitialCamera3D(),
    thetaDeg: 75,
    phiDeg: 125,
  }
  const diagram: Diagram = {
    ...createThreeDimensionalDiagram(),
    view: { camera3d: savedCamera },
  }
  const tikz = generateTikz(diagram, { camera3d: currentCamera })

  assert.match(tikz, /\\tdplotsetmaincoords\{75\}\{125\}/)
  assert.doesNotMatch(tikz, /\\tdplotsetmaincoords\{20\}\{30\}/)
})

test('changing camera theta and phi changes generated TikZ camera setup', () => {
  const diagram = createThreeDimensionalDiagram()
  const first = generateTikz(diagram, {
    camera3d: { ...createInitialCamera3D(), thetaDeg: 25, phiDeg: 35 },
  })
  const second = generateTikz(diagram, {
    camera3d: { ...createInitialCamera3D(), thetaDeg: 80, phiDeg: 120 },
  })

  assert.equal(extractMainCoords(first), '\\tdplotsetmaincoords{25}{35}')
  assert.equal(extractMainCoords(second), '\\tdplotsetmaincoords{80}{120}')
  assert.notEqual(extractMainCoords(first), extractMainCoords(second))
})

test('reset to initial camera restores initial TikZ camera values', () => {
  const diagram = createThreeDimensionalDiagram()
  const changed = generateTikz(diagram, {
    camera3d: { ...createInitialCamera3D(), thetaDeg: 80, phiDeg: 120 },
  })
  const reset = generateTikz(diagram, {
    camera3d: resetCameraToInitial(),
  })

  assert.match(changed, /\\tdplotsetmaincoords\{80\}\{120\}/)
  assert.match(reset, /\\tdplotsetmaincoords\{13\}\{-23\}/)
})

test('3D TikZ export rejects unsupported perspective cameras', () => {
  const camera: PerspectiveCamera3D = {
    mode: '3d',
    kind: 'perspective',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 1,
    pan: { x: 0, y: 0 },
    target: { x: 0, y: 0, z: 0 },
    distance: 8,
    fieldOfViewDeg: 45,
  }

  assert.throws(
    () => generateTikz(createThreeDimensionalDiagram(), { camera3d: camera }),
    /Perspective TikZ export is not supported/,
  )
})

test('TikZ output excludes coordinate axes by default', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.doesNotMatch(tikz, /Coordinate axes guide/)
  assert.doesNotMatch(tikz, /stratifiedGuideLayer/)
  assert.doesNotMatch(tikz, /\{\$x\$\}/)
  assert.doesNotMatch(tikz, /\{\$y\$\}/)
  assert.doesNotMatch(tikz, /\{\$z\$\}/)
})

test('2D TikZ output ignores the 3D coordinate axes export option', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram(), {
    includeCoordinateAxes: true,
    camera3d: createInitialCamera3D(),
  })

  assert.doesNotMatch(tikz, /Coordinate axes guide/)
  assert.doesNotMatch(tikz, /stratifiedGuideLayer/)
  assert.doesNotMatch(tikz, /\{\$x\$\}/)
  assert.doesNotMatch(tikz, /tikz-3dplot/)
  assert.doesNotMatch(tikz, /\\tdplotsetmaincoords/)
  assert.doesNotMatch(tikz, /tdplot_main_coords/)
})

test('TikZ output includes a guide layer when coordinate axes export is enabled', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    includeCoordinateAxes: true,
    camera3d: camera,
  })

  assert.match(tikz, /\\tdplotsetmaincoords\{70\}\{110\}/)
  assert.match(tikz, /tdplot_main_coords/)
  assert.match(tikz, /\\definecolor\{stzCoordinateAxesGuide\}\{HTML\}\{64748B\}/)
  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedGuideLayer\}/)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedGuideLayer,stratifiedLayer0,main\}/,
  )
  assert.match(tikz, /% Coordinate axes guide/)
  assert.match(
    tikz,
    /% Optional 3D coordinate axes guide\. This is not a stratum\./,
  )
  assert.match(tikz, /\(0,0,0\) -- \(2\.5,0,0\);/)
  assert.match(tikz, /\(0,0,0\) -- \(0,2\.5,0\);/)
  assert.match(tikz, /\(0,0,0\) -- \(0,0,2\.5\);/)
  assert.match(tikz, /\] at \(2\.75,0,0\) \{\$x\$\};/)
  assert.match(tikz, /\] at \(0,2\.75,0\) \{\$y\$\};/)
  assert.match(tikz, /\] at \(0,0,2\.75\) \{\$z\$\};/)
  assert.ok(
    tikz.indexOf('\\begin{tikzpicture}[') <
      tikz.indexOf('% Coordinate axes guide'),
  )
})

test('coordinate axes export does not affect ordinary strata or labels', () => {
  const diagram = createThreeDimensionalDiagram()
  diagram.labels.push({
    geometricKind: 'label',
    id: 'ordinary-label',
    name: 'Ordinary label',
    text: '$L$',
    position: { x: 2, y: 2, z: 2 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  const withoutAxes = generateTikz(diagram)
  const withAxes = generateTikz(diagram, { includeCoordinateAxes: true })

  assert.deepEqual(
    extractCoordinateNames(withAxes),
    extractCoordinateNames(withoutAxes),
  )
  assert.match(withAxes, /\\coordinate \(curvePolyLine0p0\) at \(0,0,1\);/)
  assert.match(withAxes, /\\node at \(2,2,2\) \{\$L\$\};/)
})

test('empty 3D TikZ output includes only axes when the option is enabled', () => {
  const tikz = generateTikz(createEmptyDiagram({ ambientDimension: 3 }), {
    includeCoordinateAxes: true,
  })

  assert.match(tikz, /\\pgfsetlayers\{stratifiedGuideLayer,main\}/)
  assert.match(tikz, /\(0,0,0\) -- \(2\.5,0,0\);/)
  assert.match(tikz, /\] at \(0,0,2\.75\) \{\$z\$\};/)
  assert.doesNotMatch(tikz, /\\coordinate /)
  assert.match(tikz, /% Codimension 1 strata: sheets/)
  assert.match(tikz, /% Labels/)
})

test('TikZ 3d library is not emitted when no scoped 3D export is used', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.doesNotMatch(tikz, /\\usetikzlibrary\{3d\}/)
})

test('TikZ export excludes active work-plane guide and UI state', () => {
  const activeWorkPlane: WorkPlane = {
    kind: 'custom',
    id: 'tikz-leak-sentinel-plane',
    name: 'TikZ Leak Sentinel',
    origin: { x: 10, y: 20, z: 30 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: { kind: 'threePoints' },
  }
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.equal(activeWorkPlane.kind, 'custom')
  assert.doesNotMatch(tikz, /tikz-leak-sentinel-plane/)
  assert.doesNotMatch(tikz, /TikZ Leak Sentinel/)
  assert.doesNotMatch(tikz, /work-plane-preview/)
  assert.doesNotMatch(tikz, /custom work plane/)
})

test('2D output has codim 1 curves and codim 2 points', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /% Codimension 1 strata: curves/)
  assert.match(tikz, /% Codimension 2 strata: points/)
  assert.match(tikz, /\\draw\[/)
  assert.match(tikz, /\\node\[/)
})

test('2D output contains readable section headers', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assertIncludesSection(tikz, 'Styles and colors')
  assertIncludesSection(tikz, 'Coordinates')
  assertIncludesSection(tikz, 'Codimension 1 strata: curves')
  assertIncludesSection(tikz, 'Codimension 2 strata: points')
  assertIncludesSection(tikz, 'Labels')
  assert.doesNotMatch(tikz, /% Codimension 3 strata/)
})

test('3D output has codim 1 sheets, codim 2 curves, and codim 3 points', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.match(tikz, /% Codimension 1 strata: sheets/)
  assert.match(tikz, /% Codimension 2 strata: curves/)
  assert.match(tikz, /% Codimension 3 strata: points/)
  assert.match(tikz, /\\path\[/)
  assert.match(tikz, /\\draw\[/)
  assert.match(tikz, /\\node\[/)
})

test('3D output contains readable section headers', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assertIncludesSection(tikz, 'Styles and colors')
  assertIncludesSection(tikz, 'Coordinates')
  assertIncludesSection(tikz, 'Codimension 1 strata: sheets')
  assertIncludesSection(tikz, 'Codimension 2 strata: curves')
  assertIncludesSection(tikz, 'Codimension 3 strata: points')
  assertIncludesSection(tikz, 'Labels')
})

test('custom colors are emitted as definecolor commands', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.match(tikz, /\\definecolor\{stzSheetpageFill\}\{HTML\}\{4D9DE0\}/)
  assert.match(tikz, /\\definecolor\{stzCurvelineStroke\}\{HTML\}\{FF00AA\}/)
  assert.match(tikz, /\\definecolor\{stzPointjunction\}\{HTML\}\{00AA33\}/)
})

test('TikZ layer names are deterministic and TikZ-safe', () => {
  assert.equal(layerToTikzLayerName(0), 'stratifiedLayer0')
  assert.equal(layerToTikzLayerName(2), 'stratifiedLayer2')
  assert.equal(layerToTikzLayerName(-1), 'stratifiedLayerMinus1')
  assert.equal(layerToTikzLayerName(1.5), 'stratifiedLayer1Point5')
  assert.equal(layerToTikzLayerName(Number.NaN), 'stratifiedLayer0')
  assert.equal(layerToTikzLayerName(Number.POSITIVE_INFINITY), 'stratifiedLayer0')
})

test('generated TikZ declares used layers in numeric order', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())

  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayerMinus1\}/)
  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayer0\}/)
  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayer2\}/)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedLayerMinus1,stratifiedLayer0,stratifiedLayer2,main\}/,
  )
})

test('generated TikZ groups drawing commands in pgfonlayer blocks', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())
  const layerMinusOne = extractLayerBlock(tikz, 'stratifiedLayerMinus1')
  const layerZero = extractLayerBlock(tikz, 'stratifiedLayer0')
  const layerTwo = extractLayerBlock(tikz, 'stratifiedLayer2')

  assert.match(layerMinusOne, /\\node at \(0\.5,1\) \{\$L\$\};/)
  assert.match(
    layerZero,
    /\(curvePolyBackWire0p0\) -- \(curvePolyBackWire0p1\);/,
  )
  assert.match(
    layerTwo,
    /\(curvePolyFrontWire1p0\) -- \(curvePolyFrontWire1p1\);/,
  )
  assert.match(layerTwo, /\] at \(pointFrontPoint0p0\) \{\};/)
})

test('same-layer drawing command order is preserved', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())
  const layerTwo = extractLayerBlock(tikz, 'stratifiedLayer2')

  assert.ok(
    layerTwo.indexOf('(curvePolyFrontWire1p0)') <
      layerTwo.indexOf('(pointFrontPoint0p0)'),
  )
})

test('same-kind same-layer drawing order follows diagram order, not id order', () => {
  const tikz = generateTikz(createSameLayerOppositeIdCurveDiagram())
  const layerZero = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(tikz, /\\coordinate \(curvePolyZCurve0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyACurve1p0\) at \(0,1\);/)
  assert.ok(
    tikz.indexOf('\\coordinate (curvePolyZCurve0p0)') <
      tikz.indexOf('\\coordinate (curvePolyACurve1p0)'),
  )
  assert.ok(
    layerZero.indexOf('(curvePolyZCurve0p0)') <
      layerZero.indexOf('(curvePolyACurve1p0)'),
  )
})

test('layer blocks use separated codimension comments', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())
  const layerZero = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(
    layerZero,
    /%---+\n\s*% Codimension 1 strata: curves\n\s*%---+/,
  )
})

test('layer-aware output preserves Phase 9A coordinate names', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyBackWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyFrontWire1p0\) at \(0,0\.5\);/)
  assert.match(tikz, /\\coordinate \(pointFrontPoint0p0\) at \(1,0\.5\);/)
  assert.doesNotMatch(tikz, /curvePolycurve/)
})

test('single-layer diagrams still generate valid layer output', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayer0\}/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer0,main\}/)
  assert.match(tikz, /\\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  assert.match(tikz, /\\end\{pgfonlayer\}/)
})

test('denselyDotted maps to densely dotted', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'hidden',
      name: 'Hidden curve',
      style: curveStyle({ lineStyle: 'denselyDotted' }),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  assert.match(generateTikz(diagram), /densely dotted/)
})

test('curve with empty path label emits no spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'unlabeled',
      name: 'Unlabeled curve',
      pathLabel: '   ',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.doesNotMatch(tikz, /spath\/save=/)
  assert.doesNotMatch(tikz, /spath3/)
})

test('polyline curve with path label emits spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'wire-path',
      name: 'Wire path',
      pathLabel: 'wire path',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /% \\usetikzlibrary\{spath3\}/)
  assert.match(tikz, /spath\/save=wirePath/)
  assert.match(tikz, /\(curvePolyWirePath0p0\) -- \(curvePolyWirePath0p1\);/)
})

test('cubic Bezier curve with path label emits spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'cubicBezier',
      id: 'arc-path',
      name: 'Arc path',
      pathLabel: 'arc path',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 1, z: 0 },
        { x: 3, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /spath\/save=arcPath/)
  assert.match(
    tikz,
    /\(curveBezierArcPath0p0\) \.\. controls \(curveBezierArcPath0p1\) and \(curveBezierArcPath0p2\) \.\. \(curveBezierArcPath0p3\);/,
  )
})

test('concatenated path exports as a continuous TikZ path', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'composite-path',
    name: 'Composite Path',
    pathLabel: 'composite path',
    style: curveStyle(),
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
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /spath\/save=compositePath/)
  assert.match(tikz, /\\coordinate \(curvePathCompositePath0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePathCompositePath0p4\) at \(3,0\);/)
  assert.match(
    tikz,
    /\(curvePathCompositePath0p0\) -- \(curvePathCompositePath0p1\) \.\. controls \(curvePathCompositePath0p2\) and \(curvePathCompositePath0p3\) \.\. \(curvePathCompositePath0p4\);/,
  )
  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 1)
})

test('template paths export using native 2D TikZ circle and ellipse syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'templatePath',
      id: 'circle-template',
      name: 'Circle Template',
      style: curveStyle(),
      styleSegments: [],
      layer: 0,
      template: {
        kind: 'circleTemplate',
        center: { x: 0, y: 0, z: 0 },
        radius: 1.5,
      },
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'templatePath',
      id: 'ellipse-template',
      name: 'Ellipse Template',
      style: curveStyle(),
      styleSegments: [],
      layer: 0,
      template: {
        kind: 'ellipseTemplate',
        center: { x: 2, y: 0, z: 0 },
        radiusX: 2,
        radiusY: 0.5,
      },
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /circle\[radius=1\.5\]/)
  assert.match(tikz, /ellipse\[x radius=2, y radius=0\.5\]/)
  assert.doesNotMatch(tikz, /\.\. controls/)
})

test('3D template paths export in a TikZ canvas-is-plane scope', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'circle-template-3d',
    name: 'Circle Template 3D',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'circleTemplate',
      center: { x: 1, y: 2, z: 3 },
      radius: 2,
      frame: {
        origin: { x: 1, y: 2, z: 3 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
    },
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /\(0,0\) circle\[radius=2\]/)
})

test('2D arc path segment exports using readable TikZ arc syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'arc-segment-path',
    name: 'Arc Segment Path',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
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

  assert.match(
    generateTikz(diagram),
    /arc\[start angle=0, end angle=90, radius=1\]/,
  )
})

test('3D cross-work-plane concatenated path exports absolute coordinates in segment order', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'cross-plane-path',
    name: 'Cross Plane Path',
    style: curveStyle(),
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
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curvePathCrossPlanePath0p0\) at \(0,0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePathCrossPlanePath0p1\) at \(1,0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePathCrossPlanePath0p2\) at \(1,0,1\);/)
  assert.match(
    tikz,
    /\(curvePathCrossPlanePath0p0\) -- \(curvePathCrossPlanePath0p1\) -- \(curvePathCrossPlanePath0p2\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('single concatenated path segment override changes TikZ style', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'segment-style',
    name: 'Segment Style',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        styleOverride: {
          strokeColor: '#CC0033',
          strokeOpacity: 0.45,
          lineWidth: 2.6,
          lineStyle: 'dashed',
        },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\{HTML\}\{CC0033\}/)
  assert.match(tikz, /draw opacity=0\.45/)
  assert.match(tikz, /line width=2\.6pt/)
  assert.match(tikz, /dashed/)
  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 1)
})

test('3D cross-work-plane concatenated path preserves segment style overrides', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'cross-plane-style',
    name: 'Cross Plane Style',
    style: curveStyle(),
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
        styleOverride: {
          strokeColor: '#CC0033',
          strokeOpacity: 0.45,
          lineWidth: 2.6,
          lineStyle: 'denselyDotted',
        },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const firstSegment =
    '(curvePathCrossPlaneStyle0p0) -- (curvePathCrossPlaneStyle0p1);'
  const secondSegment =
    '(curvePathCrossPlaneStyle0p1) -- (curvePathCrossPlaneStyle0p2);'
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 2)
  assert.match(tikz, /\{HTML\}\{CC0033\}/)
  assert.match(tikz, /draw opacity=0\.45/)
  assert.match(tikz, /line width=2\.6pt/)
  assert.match(tikz, /densely dotted/)
  assert.ok(splitDrawSection.indexOf(firstSegment) < splitDrawSection.indexOf(secondSegment))
})

test('mixed-style concatenated path exports split draw commands in segment order', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'mixed-style-path',
    name: 'Mixed Style Path',
    pathLabel: 'mixed style path',
    style: curveStyle(),
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
        styleOverride: { lineStyle: 'denselyDotted' },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const firstSegment = '(curvePathMixedStylePath0p0) -- (curvePathMixedStylePath0p1);'
  const secondSegment = '(curvePathMixedStylePath0p1) -- (curvePathMixedStylePath0p2);'
  const thirdSegment = '(curvePathMixedStylePath0p2) -- (curvePathMixedStylePath0p3);'
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.match(tikz, /% Segment style overrides split this concatenated path/)
  assert.match(tikz, /% Saved full concatenated path for spath operations\./)
  assert.match(tikz, /\\path\[[\s\S]*spath\/save=mixedStylePath/)
  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 3)
  assert.match(tikz, /dotted/)
  assert.match(tikz, /densely dotted/)
  assert.ok(splitDrawSection.indexOf(firstSegment) < splitDrawSection.indexOf(secondSegment))
  assert.ok(splitDrawSection.indexOf(secondSegment) < splitDrawSection.indexOf(thirdSegment))
  assert.match(
    tikz,
    /\(curvePathMixedStylePath0p0\) -- \(curvePathMixedStylePath0p1\) -- \(curvePathMixedStylePath0p2\) -- \(curvePathMixedStylePath0p3\);/,
  )
})

test('polygon sheet with path label emits spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'polygonSheet',
      id: 'surface-path',
      name: 'Surface path',
      pathLabel: 'surface boundary',
      style: sheetStyle(),
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /spath\/save=surfaceBoundary/)
  assert.match(
    tikz,
    /\(sheetPolySurfacePath0p0\) -- \(sheetPolySurfacePath0p1\) -- \(sheetPolySurfacePath0p2\) -- cycle;/,
  )
})

test('2D one-boundary filledRegion exports as a filled closed path', () => {
  const tikz = generateTikz(createFilledRegionDiagram())

  assert.match(tikz, /% Codimension 0 strata: regions/)
  assert.match(tikz, /\\coordinate \(regionFilledFilledRegion0b0p0\) at \(0,0\);/)
  assert.match(tikz, /\\filldraw\[/)
  assert.match(
    tikz,
    /\(regionFilledFilledRegion0b0p0\) -- \(regionFilledFilledRegion0b0p1\) -- \(regionFilledFilledRegion0b0p2\) -- \(regionFilledFilledRegion0b0p3\) -- \(regionFilledFilledRegion0b0p4\) -- cycle;/,
  )
  assert.doesNotMatch(tikz, /deferred/)
})

test('2D multi-boundary filledRegion with evenOdd exports even odd rule', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      fillRule: 'evenOdd',
      boundaries: [
        squareBoundary2D('outer', 0, 0, 4),
        squareBoundary2D('inner', 1, 1, 1),
      ],
    }),
  )

  assert.match(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('2D filledRegion with nonzero fill rule omits even odd rule', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      fillRule: 'nonzero',
      boundaries: [
        squareBoundary2D('outer', 0, 0, 4),
        squareBoundary2D('inner', 1, 1, 1),
      ],
    }),
  )

  assert.doesNotMatch(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('2D filledRegion exports cubic boundary segments', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      boundaries: [cubicBoundary2D('cubic-loop')],
    }),
  )

  assert.match(tikz, /\\coordinate \(regionFilledFilledRegion0b0p1\) at \(0\.5,1\);/)
  assert.match(tikz, /\\coordinate \(regionFilledFilledRegion0b0p2\) at \(1\.5,1\);/)
  assert.match(
    tikz,
    /\(regionFilledFilledRegion0b0p0\) \.\. controls \(regionFilledFilledRegion0b0p1\) and \(regionFilledFilledRegion0b0p2\) \.\. \(regionFilledFilledRegion0b0p3\) -- \(regionFilledFilledRegion0b0p4\) -- cycle;/,
  )
})

test('2D filledRegion TikZ preserves fill and stroke color opacity', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      style: regionStyle({
        fillColor: '#112233',
        fillOpacity: 0.42,
        strokeColor: '#445566',
        strokeOpacity: 0.73,
      }),
    }),
  )

  assert.match(tikz, /\{HTML\}\{112233\}/)
  assert.match(tikz, /\{HTML\}\{445566\}/)
  assert.match(tikz, /fill opacity=0\.42/)
  assert.match(tikz, /draw opacity=0\.73/)
})

test('2D filledRegion TikZ stays inside the correct layer block', () => {
  const tikz = generateTikz(createFilledRegionDiagram({ layer: 5 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer5')

  assert.match(layerBlock, /% Codimension 0 strata: regions/)
  assert.match(layerBlock, /\\filldraw\[/)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedLayer5,main\}/,
  )
})

test('3D one-boundary workPlaneFilledSheet exports a styled filled path', () => {
  const tikz = generateTikz(createWorkPlaneFilledSheetDiagram())

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /\\begin\{scope\}\[/)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /\\filldraw\[/)
  assert.match(tikz, /\(0,0\) -- \(2,0\) -- \(2,2\) -- \(0,2\) -- \(0,0\) -- cycle;/)
  assert.doesNotMatch(tikz, /deferred/)
})

test('3D multi-boundary workPlaneFilledSheet with evenOdd exports even odd rule', () => {
  const tikz = generateTikz(
    createWorkPlaneFilledSheetDiagram({
      fillRule: 'evenOdd',
      boundaries: [
        squareBoundary3D('outer', 2, 0, 0, 4),
        squareBoundary3D('inner', 2, 1, 1, 1),
      ],
    }),
  )

  assert.match(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('3D workPlaneFilledSheet falls back to absolute coordinates when local scope is invalid', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const sheet = diagram.strata[0]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }

  sheet.planeFrame = {
    ...sheet.planeFrame,
    u: { x: Number.NaN, y: 0, z: 0 },
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /local plane scope could not be used/)
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.match(tikz, /\\coordinate \(sheetFilledFilledSheet0b0p0\) at \(0,0,2\);/)
  assert.match(
    tikz,
    /\(sheetFilledFilledSheet0b0p0\) -- \(sheetFilledFilledSheet0b0p1\) -- \(sheetFilledFilledSheet0b0p2\) -- \(sheetFilledFilledSheet0b0p3\) -- \(sheetFilledFilledSheet0b0p4\) -- cycle;/,
  )
})

test('3D workPlaneFilledSheet TikZ preserves fill and stroke color opacity', () => {
  const tikz = generateTikz(
    createWorkPlaneFilledSheetDiagram({
      style: sheetStyle({
        fillColor: '#ABCDEF',
        fillOpacity: 0.28,
        strokeColor: '#123ABC',
        strokeOpacity: 0.66,
      }),
    }),
  )

  assert.match(tikz, /\{HTML\}\{ABCDEF\}/)
  assert.match(tikz, /\{HTML\}\{123ABC\}/)
  assert.match(tikz, /fill opacity=0\.28/)
  assert.match(tikz, /draw opacity=0\.66/)
})

test('3D workPlaneFilledSheet TikZ stays inside the correct layer block', () => {
  const tikz = generateTikz(createWorkPlaneFilledSheetDiagram({ layer: 6 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer6')

  assert.match(layerBlock, /% Codimension 1 strata: sheets/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /\\filldraw\[/)
})

test('3D curvedSheet hemisphere exports sampled mesh faces inside the sheet layer', () => {
  const tikz = generateTikz(createCurvedHemisphereSheetDiagram({ layer: 8 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer8')

  assert.match(layerBlock, /% Codimension 1 strata: sheets/)
  assert.match(
    layerBlock,
    /Curved sheet "Curved Hemisphere" \[curved-hemisphere\] sampled mesh export/,
  )
  assert.match(layerBlock, /Primitive: hemisphere; sampling: u=8, v=4; faces=32/)
  assert.match(
    tikz,
    /\\coordinate \(sheetCurvedCurvedHemisphere0p0\) at \(0,0,1\);/,
  )
  assert.match(layerBlock, /\\begin\{scope\}\[/)
  assert.equal((layerBlock.match(/\\filldraw/g) ?? []).length, 32)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('3D curvedSheet saddle export preserves style and layer', () => {
  const tikz = generateTikz(
    createCurvedSaddleSheetDiagram({
      layer: 5,
      style: sheetStyle({
        fillColor: '#ABCDEF',
        fillOpacity: 0.28,
        strokeColor: '#123ABC',
        strokeOpacity: 0.66,
      }),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer5')

  assert.match(layerBlock, /Primitive: saddle; sampling: u=6, v=5; faces=30/)
  assert.equal((layerBlock.match(/\\filldraw/g) ?? []).length, 30)
  assert.match(tikz, /\{HTML\}\{ABCDEF\}/)
  assert.match(tikz, /\{HTML\}\{123ABC\}/)
  assert.match(layerBlock, /fill opacity=0\.28/)
  assert.match(layerBlock, /draw opacity=0\.66/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer5,main\}/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('3D curvedSheet default sampled TikZ output remains bounded', () => {
  const tikz = generateTikz(createCurvedHemisphereSheetDiagram())

  assert.ok(tikz.length < 16000)
  assert.equal((tikz.match(/\\filldraw/g) ?? []).length, 32)
  assert.doesNotMatch(tikz, /omitted/)
})

test('3D curvedSheet TikZ export omits meshes above the readable face cap', () => {
  const diagram = createCurvedHemisphereSheetDiagram()
  const sheet = diagram.strata[0]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'curvedSheet') {
    throw new Error('Expected a curved sheet.')
  }

  sheet.primitive = {
    ...sheet.primitive,
    sampling: { uSegments: 32, vSegments: 9 },
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /omitted because its sampled mesh has 288 faces/)
  assert.match(
    tikz,
    new RegExp(`Reduce sampling to at most ${maxCurvedSheetTikzFaces} faces`),
  )
  assert.doesNotMatch(tikz, /sheetCurvedCurvedHemisphere0p0/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('existing 3D vertex sheet export remains a single closed path', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\path\[/)
  assert.match(
    layerBlock,
    /\(sheetQuadPage0p0\) -- \(sheetQuadPage0p1\) -- \(sheetQuadPage0p2\) -- \(sheetQuadPage0p3\) -- cycle;/,
  )
  assert.doesNotMatch(layerBlock, /sampled mesh export/)
})

test('filled-object TikZ output has no NaN or Infinity values', () => {
  const tikz = [
    generateTikz(createFilledRegionDiagram()),
    generateTikz(createWorkPlaneFilledSheetDiagram()),
    generateTikz(createCurvedHemisphereSheetDiagram()),
    generateTikz(createCurvedSaddleSheetDiagram()),
  ].join('\n')

  assert.doesNotMatch(tikz, /NaN/)
  assert.doesNotMatch(tikz, /Infinity/)
})

test('ordinary non-finite TikZ geometry is omitted instead of emitting invalid coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      id: 'bad-sheet',
      name: 'Bad Sheet',
      style: sheetStyle(),
      corners: [
        { x: 0, y: 0, z: 0 },
        { x: Number.NaN, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'bad-curve',
      name: 'Bad Curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: Number.POSITIVE_INFINITY, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'bad-point',
      name: 'Bad Point',
      style: pointStyle(),
      position: { x: 0, y: 0, z: Number.NaN },
      layer: 0,
    },
  )
  diagram.labels.push({
    geometricKind: 'label',
    id: 'bad-label',
    name: 'Bad Label',
    text: '$B$',
    position: { x: Number.NEGATIVE_INFINITY, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /Sheet "Bad Sheet" \[bad-sheet\] omitted/)
  assert.match(tikz, /Curve "Bad Curve" \[bad-curve\] omitted/)
  assert.match(tikz, /Point "Bad Point" \[bad-point\] omitted/)
  assert.match(tikz, /Label "Bad Label" \[bad-label\] omitted/)
  assert.doesNotMatch(tikz, /\\coordinate \(sheetQuadBadSheet0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(curvePolyBadCurve0p1\)/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('filled-object TikZ omits non-finite fill boundaries instead of emitting invalid coordinates', () => {
  const tikz = [
    generateTikz(
      createFilledRegionDiagram({
        boundaries: [nonFiniteBoundary2D('bad-region-boundary')],
      }),
    ),
    generateTikz(
      createWorkPlaneFilledSheetDiagram({
        boundaries: [nonFiniteBoundary3D('bad-sheet-boundary')],
      }),
    ),
  ].join('\n')

  assert.match(tikz, /Filled region "Filled Region" \[filled-region\] omitted/)
  assert.match(
    tikz,
    /Work-plane filled sheet "Filled Sheet" \[filled-sheet\] omitted/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(regionFilledFilledRegion0b0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(sheetFilledFilledSheet0b0p1\)/)
  assert.doesNotMatch(tikz, /NaN/)
  assert.doesNotMatch(tikz, /Infinity/)
})

test('point stratum path label is not emitted as spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const point = {
    codim: 2,
    geometricKind: 'point',
    id: 'point-path',
    name: 'Point path',
    pathLabel: 'point path',
    style: pointStyle(),
    position: { x: 0, y: 0, z: 0 },
    layer: 0,
  } satisfies PointStratum & { pathLabel: string }
  diagram.strata.push(point)

  assert.doesNotMatch(generateTikz(diagram), /spath\/save=/)
})

test('free text labels are not emitted as spath save options', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'path-text',
    name: 'Path text',
    text: 'spath/save=notAPathLabel',
    position: { x: 0, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\{spath\/save=notAPathLabel\}/)
  assert.doesNotMatch(tikz, /spath\/save=notAPathLabel,/)
  assert.doesNotMatch(tikz, /% \\usetikzlibrary\{spath3\}/)
})

test('non-default label styles are emitted', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'styledLabel',
    name: 'Styled label',
    text: '$\\alpha \\colon f \\Rightarrow g$',
    position: { x: 0, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#A23E48',
      opacity: 0.65,
      fontSize: 14,
      anchor: 'north east',
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\definecolor\{stzLabelstyledLabel\}\{HTML\}\{A23E48\}/)
  assert.match(tikz, /text=stzLabelstyledLabel/)
  assert.match(tikz, /opacity=0\.65/)
  assert.match(tikz, /font=\\fontsize\{14pt\}\{16\.8pt\}\\selectfont/)
  assert.match(tikz, /anchor=north east/)
  assert.match(tikz, /\$\\alpha \\colon f \\Rightarrow g\$/)
})

test('label text is preserved without automatic math wrapping', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\node at \(2,3\) \{\$F\^\{\(1\)\}L\$\};/)
})

test('point shapes include circle, square, triangle, and star', () => {
  for (const shape of ['circle', 'square', 'triangle', 'star'] satisfies PointShape[]) {
    const tikz = generateTikz(createPointShapeDiagram(shape))

    if (shape === 'circle') {
      assert.match(tikz, /circle/)
    }

    if (shape === 'square') {
      assert.match(tikz, /regular polygon sides=4/)
    }

    if (shape === 'triangle') {
      assert.match(tikz, /regular polygon sides=3/)
    }

    if (shape === 'star') {
      assert.match(tikz, /star points=5/)
    }
  }
})

test('non-circular point shapes document required TikZ libraries', () => {
  for (const shape of ['square', 'triangle', 'star'] satisfies PointShape[]) {
    const tikz = generateTikz(createPointShapeDiagram(shape))

    assert.match(
      tikz,
      /% Required TikZ libraries for non-circular point shapes:/,
    )
    assert.match(tikz, /% \\usetikzlibrary\{shapes\.geometric,shapes\.symbols\}/)
  }
})

test('hollow points are emitted with white fill', () => {
  const tikz = generateTikz(
    createPointShapeDiagram('circle', {
      fill: 'hollow',
    }),
  )

  assert.match(tikz, /fill=white/)
})

test('curve coordinate names distinguish polyline and cubic Bezier curves', () => {
  const tikz = generateTikz(createCurveNamingDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyWire0p1\) at \(1,0\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p0\) at \(0,1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p1\) at \(1,2\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p2\) at \(2,2\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p3\) at \(3,1\);/)
  assert.match(tikz, /\(curvePolyWire0p0\) -- \(curvePolyWire0p1\);/)
  assert.match(
    tikz,
    /\(curveBezierArc1p0\) \.\. controls \(curveBezierArc1p1\) and \(curveBezierArc1p2\) \.\. \(curveBezierArc1p3\);/,
  )
  assert.doesNotMatch(tikz, /curvecurve/)
})

test('relative Cartesian cubic Bezier export uses TikZ relative control syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'relative-cartesian',
    name: 'Relative Cartesian',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 7, y: 14, z: 0 },
      { x: 10, y: 10, z: 0 },
    ],
    bezierControls: {
      kind: 'relativeCartesian',
      firstControlOffset: { x: 1, y: 2, z: 0 },
      secondControlOffset: { x: -3, y: 4, z: 0 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curveBezierRelativeCartesian0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curveBezierRelativeCartesian0p3\) at \(10,10\);/)
  assert.match(
    tikz,
    /\(curveBezierRelativeCartesian0p0\) \.\. controls \+\(1,2\) and \+\(-3,4\) \.\. \(curveBezierRelativeCartesian0p3\);/,
  )
  assert.doesNotMatch(tikz, /curveBezierRelativeCartesian0p1/)
  assert.doesNotMatch(tikz, /curveBezierRelativeCartesian0p2/)
})

test('relative polar cubic Bezier export uses TikZ polar control syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'relative-polar',
    name: 'Relative Polar',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 5, y: 8, z: 0 },
      { x: 5, y: 5, z: 0 },
    ],
    bezierControls: {
      kind: 'relativePolar',
      firstControl: { angleDegrees: 0, radius: 2 },
      secondControl: { angleDegrees: 90, radius: 3 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\(curveBezierRelativePolar0p0\) \.\. controls \+\(0:2\) and \+\(90:3\) \.\. \(curveBezierRelativePolar0p3\);/,
  )
  assert.doesNotMatch(tikz, /curveBezierRelativePolar0p1/)
  assert.doesNotMatch(tikz, /curveBezierRelativePolar0p2/)
})

test('work-plane-local relative polar 3D Bezier exports in a TikZ 3d canvas scope', () => {
  const tikz = generateTikz(createWorkPlaneRelativePolarBezierDiagram())

  assert.match(tikz, /% Requires \\usepackage\{tikz-3dplot\}/)
  assert.match(tikz, /\\tdplotsetmaincoords\{13\}\{-23\}/)
  assert.match(tikz, /tdplot_main_coords/)
  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /\\begin\{scope\}\[/)
  assert.match(tikz, /plane origin=\{\(10,20,30\)\}/)
  assert.match(tikz, /plane x=\{\(11,20,30\)\}/)
  assert.match(tikz, /plane y=\{\(10,20,31\)\}/)
  assert.match(tikz, /canvas is plane/)
  assert.match(
    tikz,
    /\(2,3\) \.\. controls \+\(0:2\) and \+\(90:4\) \.\. \(6,7\);/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierLocalRelativePolar0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierLocalRelativePolar0p2\)/)
  assert.ok(
    tikz.indexOf('tdplot_main_coords') < tikz.indexOf('canvas is plane'),
  )
})

test('work-plane-local relative Cartesian 3D Bezier uses local relative controls', () => {
  const tikz = generateTikz(createWorkPlaneRelativeCartesianBezierDiagram())

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(
    tikz,
    /\(2,3\) \.\. controls \+\(2,-1\) and \+\(-3,4\) \.\. \(6,7\);/,
  )
  assert.doesNotMatch(
    tikz,
    /\\coordinate \(curveBezierLocalRelativeCartesian0p1\)/,
  )
  assert.doesNotMatch(
    tikz,
    /\\coordinate \(curveBezierLocalRelativeCartesian0p2\)/,
  )
})

test('work-plane-local 3D Bezier scope remains inside the curve layer block', () => {
  const tikz = generateTikz(createWorkPlaneRelativePolarBezierDiagram({ layer: 4 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer4')

  assert.match(layerBlock, /\\begin\{scope\}\[/)
  assert.match(
    layerBlock,
    /\(2,3\) \.\. controls \+\(0:2\) and \+\(90:4\) \.\. \(6,7\);/,
  )
})

test('absolute 3D cubic Bezier fallback keeps control-point coordinate declarations', () => {
  const tikz = generateTikz(createAbsoluteThreeDimensionalBezierDiagram())

  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p0\) at \(0,0,0\);/)
  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p1\) at \(1,0,1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p2\) at \(2,1,1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p3\) at \(3,1,0\);/)
  assert.match(
    tikz,
    /\(curveBezierAbsoluteArc0p0\) \.\. controls \(curveBezierAbsoluteArc0p1\) and \(curveBezierAbsoluteArc0p2\) \.\. \(curveBezierAbsoluteArc0p3\);/,
  )
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{3d\}/)
})

test('inconsistent work-plane-local 3D Bezier metadata falls back to absolute controls', () => {
  const diagram = createWorkPlaneRelativeCartesianBezierDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve' || curve.kind !== 'cubicBezier') {
    throw new Error('Expected a cubic Bezier curve.')
  }

  if (curve.bezierControls?.kind !== 'workPlaneRelativeCartesian') {
    throw new Error('Expected work-plane-relative Cartesian controls.')
  }

  curve.bezierControls = {
    ...curve.bezierControls,
    localStart: { a: 20, b: 30 },
  }

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(curveBezierLocalRelativeCartesian0p1\) at \(14,20,32\);/,
  )
  assert.match(
    tikz,
    /\(curveBezierLocalRelativeCartesian0p0\) \.\. controls \(curveBezierLocalRelativeCartesian0p1\) and \(curveBezierLocalRelativeCartesian0p2\) \.\. \(curveBezierLocalRelativeCartesian0p3\);/,
  )
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{3d\}/)
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('absolute cubic Bezier export keeps control-point coordinate declarations', () => {
  const tikz = generateTikz(createCurveNamingDiagram())

  assert.match(tikz, /\\coordinate \(curveBezierArc1p1\) at \(1,2\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p2\) at \(2,2\);/)
  assert.match(
    tikz,
    /\(curveBezierArc1p0\) \.\. controls \(curveBezierArc1p1\) and \(curveBezierArc1p2\) \.\. \(curveBezierArc1p3\);/,
  )
})

test('layer-aware output keeps relative Bezier curves in their layer block', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'layered-relative',
    name: 'Layered Relative',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 3, y: 0, z: 0 },
    ],
    bezierControls: {
      kind: 'relativeCartesian',
      firstControlOffset: { x: 1, y: 2, z: 0 },
      secondControlOffset: { x: -1, y: 2, z: 0 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 4,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer4')

  assert.match(
    layerBlock,
    /\(curveBezierLayeredRelative0p0\) \.\. controls \+\(1,2\) and \+\(-1,2\) \.\. \(curveBezierLayeredRelative0p3\);/,
  )
})

test('TikZ name stem sanitizer keeps readable safe names', () => {
  assert.equal(sanitizeTikzNameStem('Particle', 'point'), 'Particle')
  assert.equal(sanitizeTikzNameStem('F line', 'curve'), 'FLine')
  assert.equal(sanitizeTikzNameStem('alpha-beta', 'curve'), 'alphaBeta')
  assert.equal(sanitizeTikzNameStem('$F$', 'curve'), 'F')
})

test('TikZ name stem sanitizer falls back for blank or unsafe names', () => {
  assert.equal(sanitizeTikzNameStem('  ', 'sheet'), 'sheet')
  assert.equal(sanitizeTikzNameStem('\\{$%#&_ ^~}', 'curve'), 'curve')
  assert.equal(sanitizeTikzNameStem('123', 'point'), 'point123')
})

test('spath save name sanitizer keeps TikZ-safe non-empty names', () => {
  assert.equal(sanitizeTikzSpathSaveName('my path'), 'myPath')
  assert.equal(sanitizeTikzSpathSaveName('$F_{1}$'), 'F1')
  assert.equal(sanitizeTikzSpathSaveName('123'), 'savedPath123')
  assert.equal(sanitizeTikzSpathSaveName('\\{$%#&_ ^~}'), 'savedPath')
})

test('coordinate names include sanitized point, curve, and sheet names', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'polygonSheet',
      id: 'surface',
      name: 'Surface layer',
      style: sheetStyle(),
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'boundary',
      name: 'Boundary wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'cubicBezier',
      id: 'f-line',
      name: 'F line',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: 3, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 2,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'particle',
      name: 'Particle $P$',
      style: pointStyle(),
      position: { x: 1, y: 1, z: 0 },
      layer: 3,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(sheetPolySurfaceLayer0p0\) at \(0,0,0\);/)
  assert.match(
    tikz,
    /\(sheetPolySurfaceLayer0p0\) -- \(sheetPolySurfaceLayer0p1\) -- \(sheetPolySurfaceLayer0p2\) -- cycle;/,
  )
  assert.match(tikz, /\\coordinate \(curvePolyBoundaryWire0p0\) at \(0,0,0\);/)
  assert.match(tikz, /\(curvePolyBoundaryWire0p0\) -- \(curvePolyBoundaryWire0p1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierFLine1p0\) at \(0,1,0\);/)
  assert.match(
    tikz,
    /\(curveBezierFLine1p0\) \.\. controls \(curveBezierFLine1p1\) and \(curveBezierFLine1p2\) \.\. \(curveBezierFLine1p3\);/,
  )
  assert.match(tikz, /\\coordinate \(pointParticleP0p0\) at \(1,1,0\);/)
  assert.match(tikz, /\] at \(pointParticleP0p0\) \{\};/)
  assert.doesNotMatch(tikz, /curvePolycurve/)
  assert.doesNotMatch(tikz, /curveBeziercurve/)
  assert.doesNotMatch(tikz, /sheetPolysheet/)
})

test('same stratum names still produce unique coordinate names', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'first',
      name: 'Boundary',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'second',
      name: 'Boundary',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curvePolyBoundary0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyBoundary1p0\) at \(0,1\);/)
  assert.equal(new Set(extractCoordinateNames(tikz)).size, 4)
})

test('changing a stratum name changes only generated coordinate names', () => {
  const original = createTwoDimensionalDiagram()
  const renamed: Diagram = {
    ...original,
    strata: original.strata.map((stratum) =>
      stratum.id === 'wire' ? { ...stratum, name: 'Boundary' } : stratum,
    ),
  }
  const originalTikz = generateTikz(original)
  const renamedTikz = generateTikz(renamed)

  assert.match(originalTikz, /curvePolyWire0p0/)
  assert.match(renamedTikz, /curvePolyBoundary0p0/)
  assert.equal(
    normalizeGeneratedCoordinateNames(originalTikz),
    normalizeGeneratedCoordinateNames(renamedTikz),
  )
})

function assertIncludesSection(tikz: string, title: string): void {
  assert.match(tikz, new RegExp(`% ${escapeRegExp(title)}`))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractCoordinateNames(tikz: string): string[] {
  return [...tikz.matchAll(/\\coordinate \(([^)]+)\) at/g)].map(
    (match) => match[1],
  )
}

function extractMainCoords(tikz: string): string {
  const match = tikz.match(/\\tdplotsetmaincoords\{[^}]+\}\{[^}]+\}/)

  assert.notEqual(match, null)

  return match[0]
}

function extractLayerBlock(tikz: string, layerName: string): string {
  const blockPattern = new RegExp(
    `\\\\begin\\{pgfonlayer\\}\\{${escapeRegExp(layerName)}\\}([\\s\\S]*?)\\\\end\\{pgfonlayer\\}`,
  )
  const match = tikz.match(blockPattern)

  assert.notEqual(match, null)

  return match[1]
}

function normalizeGeneratedCoordinateNames(tikz: string): string {
  const coordinateNames = extractCoordinateNames(tikz)
  let normalized = tikz

  coordinateNames.forEach((name, index) => {
    normalized = normalized.replaceAll(name, `coord${index}`)
  })

  return normalized
}

function createLayeredTwoDimensionalDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'back-wire',
      name: 'Back wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'front-wire',
      name: 'Front wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0.5, z: 0 },
        { x: 1, y: 0.5, z: 0 },
      ],
      styleSegments: [],
      layer: 2,
    },
    {
      codim: 2,
      geometricKind: 'point',
      id: 'front-point',
      name: 'Front point',
      style: pointStyle(),
      position: { x: 1, y: 0.5, z: 0 },
      layer: 2,
    },
  )
  diagram.labels.push({
    geometricKind: 'label',
    id: 'negative-label',
    name: 'Negative label',
    text: '$L$',
    position: { x: 0.5, y: 1, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: -1,
  })

  return diagram
}

function createSameLayerOppositeIdCurveDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'z-curve',
      name: 'Z curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'a-curve',
      name: 'A curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  return diagram
}

function createCurveNamingDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'wire',
      name: 'Wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'cubicBezier',
      id: 'arc',
      name: 'Arc',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: 3, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
  )

  return diagram
}

function createTwoDimensionalDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'wire',
      name: 'Wire',
      style: curveStyle({ strokeColor: '#123456' }),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'point',
      id: 'vertex',
      name: 'Vertex',
      style: pointStyle({ color: '#654321' }),
      position: { x: 1, y: 2, z: 0 },
      layer: 0,
    },
  )
  diagram.labels.push(
    {
      geometricKind: 'label',
      id: 'formula',
      name: 'Formula',
      text: '$F^{(1)}L$',
      position: { x: 2, y: 3, z: 0 },
      style: {
        kind: 'labelStyle',
        color: '#000000',
        opacity: 1,
        fontSize: 10,
        anchor: 'center',
      },
      layer: 0,
    },
  )

  return diagram
}

function createThreeDimensionalDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      id: 'page',
      name: 'Page',
      style: sheetStyle(),
      corners: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'line',
      name: 'Line',
      style: curveStyle({ strokeColor: '#FF00AA' }),
      points: [
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 1, z: 2 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'junction',
      name: 'Junction',
      style: pointStyle({ color: '#00AA33', shape: 'star' }),
      position: { x: 1, y: 1, z: 2 },
      layer: 0,
    },
  )

  return diagram
}

function createWorkPlaneRelativeCartesianBezierDiagram({
  layer = 0,
}: {
  layer?: number
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'local-relative-cartesian',
    name: 'Local Relative Cartesian',
    style: curveStyle(),
    points: [
      { x: 12, y: 20, z: 33 },
      { x: 14, y: 20, z: 32 },
      { x: 13, y: 20, z: 41 },
      { x: 16, y: 20, z: 37 },
    ],
    bezierControls: {
      kind: 'workPlaneRelativeCartesian',
      frame: {
        origin: { x: 10, y: 20, z: 30 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 1 },
        normal: { x: 0, y: -1, z: 0 },
      },
      localStart: { a: 2, b: 3 },
      localEnd: { a: 6, b: 7 },
      firstControlOffset: { dx: 2, dy: -1 },
      secondControlOffset: { dx: -3, dy: 4 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer,
  })

  return diagram
}

function createWorkPlaneRelativePolarBezierDiagram({
  layer = 0,
}: {
  layer?: number
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'local-relative-polar',
    name: 'Local Relative Polar',
    style: curveStyle(),
    points: [
      { x: 12, y: 20, z: 33 },
      { x: 14, y: 20, z: 33 },
      { x: 16, y: 20, z: 41 },
      { x: 16, y: 20, z: 37 },
    ],
    bezierControls: {
      kind: 'workPlaneRelativePolar',
      frame: {
        origin: { x: 10, y: 20, z: 30 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 1 },
        normal: { x: 0, y: -1, z: 0 },
      },
      localStart: { a: 2, b: 3 },
      localEnd: { a: 6, b: 7 },
      firstControl: { angleDegrees: 0, radius: 2 },
      secondControl: { angleDegrees: 90, radius: 4 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer,
  })

  return diagram
}

function createAbsoluteThreeDimensionalBezierDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'absolute-arc',
    name: 'Absolute Arc',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 2, y: 1, z: 1 },
      { x: 3, y: 1, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })

  return diagram
}

function createFilledRegionDiagram({
  boundaries = [squareBoundary2D('outer')],
  fillRule = 'nonzero',
  layer = 0,
  style = regionStyle(),
}: {
  boundaries?: ClosedPathBoundary[]
  fillRule?: 'nonzero' | 'evenOdd'
  layer?: number
  style?: RegionStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 0,
    geometricKind: 'region',
    kind: 'filledRegion',
    id: 'filled-region',
    name: 'Filled Region',
    visible: true,
    style,
    boundaries,
    fillRule,
    layer,
  })

  return diagram
}

function createWorkPlaneFilledSheetDiagram({
  boundaries = [squareBoundary3D('outer', 2)],
  fillRule = 'nonzero',
  layer = 0,
  style = sheetStyle(),
}: {
  boundaries?: ClosedPathBoundary[]
  fillRule?: 'nonzero' | 'evenOdd'
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'workPlaneFilledSheet',
    id: 'filled-sheet',
    name: 'Filled Sheet',
    style,
    planeFrame: xyPlaneFrameAtZ(2),
    boundaries,
    fillRule,
    layer,
  })

  return diagram
}

function createCurvedHemisphereSheetDiagram({
  layer = 0,
  style = sheetStyle(),
}: {
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    id: 'curved-hemisphere',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Curved Hemisphere',
    style,
    primitive: {
      kind: 'hemisphere',
      center: { x: 0, y: 0, z: 0 },
      radius: 1,
      frame: xyPlaneFrameAtZ(0),
      hemisphereSide: 'positive',
      sampling: { uSegments: 8, vSegments: 4 },
    },
    layer,
  })

  return diagram
}

function createCurvedSaddleSheetDiagram({
  layer = 0,
  style = sheetStyle(),
}: {
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    id: 'curved-saddle',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Curved Saddle',
    style,
    primitive: {
      kind: 'saddle',
      frame: xyPlaneFrameAtZ(0),
      width: 4,
      depth: 3,
      height: 1.5,
      sampling: { uSegments: 6, vSegments: 5 },
    },
    layer,
  })

  return diagram
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

function cubicBoundary2D(id: string): ClosedPathBoundary {
  return {
    id,
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
  }
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

function nonFiniteBoundary2D(id: string): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x: 0, y: 0, z: 0 },
    { x: Number.NaN, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
  ])
}

function nonFiniteBoundary3D(id: string): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x: 0, y: 0, z: 2 },
    { x: Number.POSITIVE_INFINITY, y: 0, z: 2 },
    { x: 1, y: 1, z: 2 },
    { x: 0, y: 1, z: 2 },
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

function xyPlaneFrameAtZ(z: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y: 0, z },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function createPointShapeDiagram(
  shape: PointShape,
  overrides: Partial<PointStyle> = {},
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 2,
      geometricKind: 'point',
      id: shape,
      name: shape,
      style: pointStyle({ shape, ...overrides }),
      position: { x: 0, y: 0, z: 0 },
      layer: 0,
    },
  )

  return diagram
}

function createEmptyDiagram({
  ambientDimension,
}: {
  ambientDimension: 2 | 3
}): Diagram {
  return {
    version: 1,
    ambientDimension,
    camera:
      ambientDimension === 2
        ? { mode: '2d', scale: 1, origin: { x: 0, y: 0 } }
        : createInitialCamera3D(),
    strata: [],
    labels: [],
  }
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

function pointStyle(overrides: Partial<PointStyle> = {}): PointStyle {
  return {
    kind: 'pointStyle',
    color: '#000000',
    opacity: 1,
    shape: 'circle',
    fill: 'filled',
    size: 3,
    ...overrides,
  }
}
