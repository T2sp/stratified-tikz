import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTikz } from '../../src/tikz/index.ts'
import type {
  CurveStyle,
  Diagram,
  PointShape,
  PointStyle,
  SheetStyle,
} from '../../src/model/types.ts'

test('2D TikZ output uses ordinary (x,y) coordinates', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\coordinate \(curvewire0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvewire1\) at \(1,2\);/)
  assert.doesNotMatch(tikz, /\(0,0,0\)/)
})

test('3D TikZ output uses (x,y,z) coordinates and a 2.5D basis', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.match(tikz, /x=\{\(1cm,0cm\)\}/)
  assert.match(tikz, /y=\{\(0\.45cm,0\.25cm\)\}/)
  assert.match(tikz, /z=\{\(0cm,1cm\)\}/)
  assert.match(tikz, /\\coordinate \(curveline0\) at \(0,0,1\);/)
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

function assertIncludesSection(tikz: string, title: string): void {
  assert.match(tikz, new RegExp(`% ${escapeRegExp(title)}`))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
