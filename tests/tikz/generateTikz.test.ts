import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateTikz,
  layerToTikzLayerName,
  sanitizeTikzSpathSaveName,
  sanitizeTikzNameStem,
} from '../../src/tikz/index.ts'
import type {
  CurveStyle,
  Diagram,
  PointShape,
  PointStratum,
  PointStyle,
  SheetStyle,
} from '../../src/model/types.ts'

test('2D TikZ output uses ordinary (x,y) coordinates', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyWire0p1\) at \(1,2\);/)
  assert.doesNotMatch(tikz, /\(0,0,0\)/)
})

test('3D TikZ output uses (x,y,z) coordinates and a 2.5D basis', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.match(tikz, /x=\{\(1cm,0cm\)\}/)
  assert.match(tikz, /y=\{\(0\.45cm,0\.25cm\)\}/)
  assert.match(tikz, /z=\{\(0cm,1cm\)\}/)
  assert.match(tikz, /\\coordinate \(curvePolyLine0p0\) at \(0,0,1\);/)
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
        : {
            mode: '3d',
            projection: 'orthographic',
            xVector: [1, 0],
            yVector: [0.45, 0.25],
            zVector: [0, 1],
            scale: 1,
            origin: { x: 0, y: 0 },
          },
    strata: [],
    labels: [],
  }
}

function sheetStyle(): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
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
