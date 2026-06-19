import assert from 'node:assert/strict'
import test from 'node:test'
import {
  importTikzStyleFile,
  parseTikzsetStyles,
} from '../../src/model/importedTikzStyles.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import type { CurveStyle, Diagram } from '../../src/model/types.ts'

test('parser extracts one simple TikZ style', () => {
  const result = parseTikzsetStyles(String.raw`\tikzset{wire/.style={draw=red}}`)

  assert.equal(result.skipped, 0)
  assert.deepEqual(result.styles, [
    {
      key: 'wire',
      options: 'draw=red',
    },
  ])
})

test('parser applies .cd prefix to relative style keys', () => {
  const result = parseTikzsetStyles(String.raw`
    \tikzset{
      3cat/.cd,
        phys/1strata/color/x/.style={
          red!60,opacity=.4
        }
    }
  `)

  assert.deepEqual(result.styles, [
    {
      key: '3cat/phys/1strata/color/x',
      options: 'red!60,opacity=.4',
    },
  ])
})

test('parser extracts styles from multiple tikzset blocks', () => {
  const result = parseTikzsetStyles(String.raw`
    \tikzset{first/.style={draw=black}}
    \tikzset{second/.style={fill=white}}
  `)

  assert.deepEqual(
    result.styles.map((style) => style.key),
    ['first', 'second'],
  )
})

test('parser handles multiline option bodies and nested braces', () => {
  const result = parseTikzsetStyles(String.raw`
    \tikzset{
      label/.style={
        circle,
        node contents={$\alpha,\beta$},
        inner sep=1.5pt
      }
    }
  `)

  assert.deepEqual(result.styles, [
    {
      key: 'label',
      options: String.raw`circle,node contents={$\alpha,\beta$},inner sep=1.5pt`,
    },
  ])
})

test('parser skips ordinary TeX comments', () => {
  const result = parseTikzsetStyles(String.raw`
    % before
    \tikzset{
      3cat/.cd, % path prefix
      wire/.style={
        draw=red, % comment in body
        opacity=.4
      }
    }
  `)

  assert.deepEqual(result.styles, [
    {
      key: '3cat/wire',
      options: 'draw=red,opacity=.4',
    },
  ])
})

test('parser skips unsupported malformed entries safely', () => {
  const result = parseTikzsetStyles(String.raw`
    \tikzset{
      good/.style={draw=black},
      noBraces/.style=draw=red,
      handler/.code={\def\x{1}},
      alsoGood/.style={fill=white}
    }
  `)

  assert.equal(result.skipped, 2)
  assert.deepEqual(
    result.styles.map((style) => style.key),
    ['good', 'alsoGood'],
  )
  assert.equal(result.warnings.length, 2)
})

test('import creates external source metadata', () => {
  const result = importTikzStyleFile(
    createEmptyDiagram({ ambientDimension: 2 }),
    'mygeometry.sty',
    String.raw`\tikzset{wire/.style={draw=red}}`,
  )

  assert.equal(result.source?.name, 'mygeometry.sty')
  assert.equal(result.source?.loadHint, String.raw`\input{mygeometry.sty}`)
  assert.deepEqual(result.diagram.externalTikzStyleSources, [result.source])
})

test('import creates imported style references with extracted options', () => {
  const result = importTikzStyleFile(
    createEmptyDiagram({ ambientDimension: 2 }),
    'mygeometry.sty',
    String.raw`\tikzset{wire/.style={draw=red,opacity=.4}}`,
  )
  const reference = result.references[0]

  assert.equal(reference?.key, 'wire')
  assert.equal(reference?.sourceId, result.source?.id)
  assert.equal(reference?.options, 'draw=red,opacity=.4')
  assert.ok(reference?.targets.includes('curve'))
  assert.deepEqual(result.diagram.importedTikzStyleReferences, result.references)
})

test('generated TikZ from imported parser output does not inline tikzset', () => {
  const importResult = importTikzStyleFile(
    createDiagramWithCurve(),
    'mygeometry.sty',
    String.raw`\tikzset{wireStyle/.style={draw=red}}`,
  )
  const reference = importResult.references[0]

  if (reference === undefined) {
    throw new Error('Expected imported style reference.')
  }

  const diagram: Diagram = {
    ...importResult.diagram,
    strata: importResult.diagram.strata.map((stratum) =>
      stratum.id === 'wire'
        ? { ...stratum, importedTikzStyleReferenceId: reference.id }
        : stratum,
    ),
  }
  const tikz = generateTikz(diagram)

  assert.doesNotMatch(tikz, /\\tikzset\{/)
  assert.match(tikz, /wireStyle/)
})

test('generated TikZ from imported parser output includes only load comments', () => {
  const importResult = importTikzStyleFile(
    createDiagramWithCurve(),
    'mygeometry.sty',
    String.raw`\tikzset{wireStyle/.style={draw=red}}`,
  )
  const reference = importResult.references[0]

  if (reference === undefined) {
    throw new Error('Expected imported style reference.')
  }

  const diagram: Diagram = {
    ...importResult.diagram,
    strata: importResult.diagram.strata.map((stratum) =>
      stratum.id === 'wire'
        ? { ...stratum, importedTikzStyleReferenceId: reference.id }
        : stratum,
    ),
  }
  const tikz = generateTikz(diagram)

  assert.match(tikz, /% External TikZ styles referenced below\./)
  assert.match(tikz, /% - mygeometry\.sty/)
  assert.match(tikz, /%   \\input\{mygeometry\.sty\}/)
  assert.doesNotMatch(tikz, /^\\input\{mygeometry\.sty\}/m)
  assert.ok(
    tikz.indexOf('% External TikZ styles referenced below.') <
      tikz.indexOf('\\begin{tikzpicture}['),
  )
})

test('duplicate imported keys are handled deterministically', () => {
  const result = parseTikzsetStyles(String.raw`
    \tikzset{
      repeated/.style={draw=black},
      repeated/.style={draw=blue}
    }
  `)

  assert.equal(result.skipped, 1)
  assert.deepEqual(result.styles, [
    {
      key: 'repeated',
      options: 'draw=blue',
    },
  ])
})

function createDiagramWithCurve(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push({
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
  })

  return diagram
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
