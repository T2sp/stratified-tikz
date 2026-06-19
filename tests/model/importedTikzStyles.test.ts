import assert from 'node:assert/strict'
import test from 'node:test'
import {
  importedStylePresetKindsForReference,
  importedStylePresetStyle,
  inferImportedTikzStyleTargets,
  importTikzStyleFile,
  parseTikzStylePreviewOptions,
  parseTikzsetStyles,
} from '../../src/model/importedTikzStyles.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import {
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
  deleteUserStylePreset,
} from '../../src/model/stylePresets.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { curveStylePresets } from '../../src/model/styles.ts'
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

test('parser preserves absolute /tikz .cd style keys', () => {
  const result = parseTikzsetStyles(
    String.raw`\tikzset{/tikz/.cd, wire/.style={draw=red}}`,
  )
  const style = result.styles[0]

  assert.equal(result.skipped, 0)
  assert.equal(style?.key, '/tikz/wire')
  assert.notEqual(style?.key, 'tikz/wire')
  assert.equal(style?.options, 'draw=red')
})

test('parser preserves absolute /tikz style keys', () => {
  const result = parseTikzsetStyles(
    String.raw`\tikzset{/tikz/wire/.style={draw=red}}`,
  )
  const style = result.styles[0]

  assert.equal(result.skipped, 0)
  assert.equal(style?.key, '/tikz/wire')
  assert.notEqual(style?.key, 'tikz/wire')
  assert.equal(style?.options, 'draw=red')
})

test('parser preserves non-/tikz absolute .cd style keys', () => {
  const result = parseTikzsetStyles(
    String.raw`\tikzset{/3cat/.cd, phys/1strata/color/x/.style={red!60}}`,
  )
  const style = result.styles[0]

  assert.equal(result.skipped, 0)
  assert.equal(style?.key, '/3cat/phys/1strata/color/x')
  assert.notEqual(style?.key, '3cat/phys/1strata/color/x')
  assert.equal(style?.options, 'red!60')
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

test('/color/ imported key is auto-detected as a color preset target', () => {
  const targets = inferImportedTikzStyleTargets(
    '3cat/phys/1strata/color/x',
    '',
  )

  assert.ok(targets.includes('curve'))
  assert.ok(targets.includes('sheet'))
  assert.ok(targets.includes('region'))
  assert.ok(targets.includes('label'))
  assert.ok(targets.includes('point'))
})

test('/shape/ imported key is auto-detected as a point and label preset target', () => {
  const reference = importTikzStyleFile(
    createEmptyDiagram({ ambientDimension: 2 }),
    '3cat.sty',
    String.raw`\tikzset{3cat/.cd, phys/3strata/shape/L/.style={circle,inner sep=1.5pt}}`,
  ).references[0]

  if (reference === undefined) {
    throw new Error('Expected imported style reference.')
  }

  assert.ok(reference.targets.includes('node'))
  assert.ok(reference.targets.includes('point'))
  assert.ok(reference.targets.includes('label'))
  assert.deepEqual(importedStylePresetKindsForReference(reference), [
    'point',
    'label',
  ])
})

test('preview parser reads opacity shorthand', () => {
  assert.deepEqual(parseTikzStylePreviewOptions('opacity=.4'), {
    opacity: 0.4,
  })
})

test('preview parser reads fill and draw opacity', () => {
  assert.deepEqual(
    parseTikzStylePreviewOptions('fill opacity=.25,draw opacity=.8'),
    {
      fillOpacity: 0.25,
      drawOpacity: 0.8,
    },
  )
})

test('preview parser approximates xcolor mixes against white', () => {
  assert.deepEqual(parseTikzStylePreviewOptions('red!60'), {
    color: '#FF6666',
  })
})

test('preview parser reads common line styles', () => {
  assert.equal(parseTikzStylePreviewOptions('dashed').lineStyle, 'dashed')
  assert.equal(parseTikzStylePreviewOptions('dotted').lineStyle, 'dotted')
  assert.equal(
    parseTikzStylePreviewOptions('densely dotted').lineStyle,
    'denselyDotted',
  )
})

test('preview parser approximates thick line width', () => {
  assert.equal(parseTikzStylePreviewOptions('thick').lineWidth, 2)
})

test('imported color styles create editable presets in the preset list', () => {
  const result = importTikzStyleFile(
    createEmptyDiagram({ ambientDimension: 2 }),
    '3cat.sty',
    String.raw`\tikzset{3cat/.cd, phys/1strata/color/x/.style={red!60,opacity=.4,dashed}}`,
  )
  const presets = result.diagram.userStylePresets ?? []

  assert.equal(result.references[0]?.displayName, '3cat: phys/1strata/color/x')
  assert.deepEqual(
    presets.map((preset) => preset.kind),
    ['curve', 'sheet', 'region', 'label', 'point'],
  )
  assert.ok(
    presets.every(
      (preset) =>
        preset.importedTikzStyleReferenceId === result.references[0]?.id,
    ),
  )
})

test('imported preview style ignores unsupported options but keeps parsed values', () => {
  const style = importedStylePresetStyle(
    'curve',
    'red!60,decorate,decoration={snake},dashed',
  )

  assert.deepEqual(style, {
    kind: 'curveStyle',
    strokeColor: '#FF6666',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'dashed',
  })
})

test('applying an imported preset stores the imported style key reference', () => {
  const importResult = importTikzStyleFile(
    createDiagramWithCurve(),
    '3cat.sty',
    String.raw`\tikzset{3cat/.cd, phys/1strata/color/x/.style={blue!40,opacity=.4,dotted}}`,
  )
  const curvePreset = importResult.diagram.userStylePresets?.find(
    (preset) => preset.kind === 'curve',
  )

  if (curvePreset === undefined) {
    throw new Error('Expected imported curve preset.')
  }

  const applied = applyUserStylePresetToStratum(
    importResult.diagram,
    'wire',
    curvePreset.id,
  )
  const curve = applied.strata[0]

  assert.equal(curve.stylePresetId, curvePreset.id)
  assert.equal(
    curve.importedTikzStyleReferenceId,
    curvePreset.importedTikzStyleReferenceId,
  )
  assert.deepEqual(curve.style, curvePreset.style)
})

test('TikZ output for an auto-detected imported preset uses the imported key and load comment only', () => {
  const importResult = importTikzStyleFile(
    createDiagramWithCurve(),
    '3cat.sty',
    String.raw`\tikzset{3cat/.cd, phys/1strata/color/x/.style={red!60,decorate,decoration={snake}}}`,
  )
  const reference = importResult.references[0]
  const curvePreset = importResult.diagram.userStylePresets?.find(
    (preset) => preset.kind === 'curve',
  )

  if (reference === undefined || curvePreset === undefined) {
    throw new Error('Expected imported reference and curve preset.')
  }

  const applied = applyUserStylePresetToStratum(
    importResult.diagram,
    'wire',
    curvePreset.id,
  )
  const tikz = generateTikz(applied)

  assert.equal(
    reference.options,
    'red!60,decorate,decoration={snake}',
  )
  assert.match(tikz, /3cat\/phys\/1strata\/color\/x/)
  assert.match(tikz, /% External TikZ styles referenced below\./)
  assert.match(tikz, /% - 3cat\.sty/)
  assert.match(tikz, /% {3}\\input\{3cat\.sty\}/)
  assert.doesNotMatch(tikz, /\\tikzset\{/)
  assert.doesNotMatch(tikz, /^\\input\{3cat\.sty\}/m)
  assert.doesNotMatch(tikz, /decorate/)
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

test('generated TikZ uses absolute key imported from /tikz .cd', () => {
  const { tikz, referenceKey } = generatedTikzForImportedCurveStyle(
    String.raw`\tikzset{/tikz/.cd, wire/.style={draw=red}}`,
  )

  assert.equal(referenceKey, '/tikz/wire')
  assert.match(tikz, /\/tikz\/wire/)
  assertNoRelativeTikzWireOption(tikz)
  assertIncludesOnlyExternalLoadComments(tikz)
})

test('generated TikZ uses absolute key imported from /tikz/name .style', () => {
  const { tikz, referenceKey } = generatedTikzForImportedCurveStyle(
    String.raw`\tikzset{/tikz/wire/.style={draw=red}}`,
  )

  assert.equal(referenceKey, '/tikz/wire')
  assert.match(tikz, /\/tikz\/wire/)
  assertNoRelativeTikzWireOption(tikz)
  assertIncludesOnlyExternalLoadComments(tikz)
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
  assert.match(tikz, /% {3}\\input\{mygeometry\.sty\}/)
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

test('combined imported and user preset workflow preserves export and persistence rules', () => {
  const importResult = importTikzStyleFile(
    createDiagramWithCurve(),
    '3cat.sty',
    String.raw`\tikzset{3cat/.cd, phys/1strata/color/x/.style={draw=blue,opacity=.4,dashed}}`,
  )
  const reference = importResult.references[0]
  const importedCurvePreset = importResult.diagram.userStylePresets?.find(
    (preset) =>
      preset.kind === 'curve' &&
      preset.importedTikzStyleReferenceId === reference?.id,
  )

  if (reference === undefined || importedCurvePreset === undefined) {
    throw new Error('Expected imported style reference and curve preset.')
  }

  assert.equal(reference.key, '3cat/phys/1strata/color/x')
  assert.ok(reference.targets.includes('curve'))
  assert.equal(importedCurvePreset.style.strokeColor, '#0000FF')

  const withImportedPreset = applyUserStylePresetToStratum(
    importResult.diagram,
    'wire',
    importedCurvePreset.id,
  )
  const importedTikz = generateTikz(withImportedPreset)

  assert.match(importedTikz, /% External TikZ styles referenced below\./)
  assert.match(importedTikz, /% {3}\\input\{3cat\.sty\}/)
  assert.doesNotMatch(importedTikz, /\\tikzset\{/)
  assert.match(
    importedTikz,
    /\\draw\[[\s\S]*3cat\/phys\/1strata\/color\/x[\s\S]*\]/,
  )

  const localPresetStyle = curveStyle({
    strokeColor: '#006633',
    strokeOpacity: 0.85,
    lineWidth: 1.6,
    lineStyle: 'dotted',
  })
  const createdUserPreset = createUserStylePresetFromStyle(
    withImportedPreset,
    'curve',
    'Local curve',
    localPresetStyle,
  )

  if (createdUserPreset === null) {
    throw new Error('Expected local user preset creation to succeed.')
  }

  const withUserPreset = applyUserStylePresetToStratum(
    createdUserPreset.diagram,
    'wire',
    createdUserPreset.preset.id,
  )
  const userPresetTikz = generateTikz(withUserPreset)
  const localStyleDefinition = `${createdUserPreset.preset.tikzStyleName}/.style=`

  assert.ok(
    userPresetTikz.indexOf(localStyleDefinition) >
      userPresetTikz.indexOf('\\begin{tikzpicture}['),
  )
  assert.ok(
    userPresetTikz.indexOf(localStyleDefinition) <
      userPresetTikz.indexOf('% Coordinates'),
  )

  const loaded = parseSavedDiagramJson(serializeDiagram(withUserPreset))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  assert.ok(
    loaded.diagram.userStylePresets?.some(
      (preset) => preset.id === createdUserPreset.preset.id,
    ),
  )
  assert.ok(
    loaded.diagram.userStylePresets?.some(
      (preset) => preset.importedTikzStyleReferenceId === reference.id,
    ),
  )
  assert.deepEqual(
    loaded.diagram.importedTikzStyleReferences,
    withUserPreset.importedTikzStyleReferences,
  )
  assert.deepEqual(
    loaded.diagram.externalTikzStyleSources,
    withUserPreset.externalTikzStyleSources,
  )

  const deleted = deleteUserStylePreset(
    loaded.diagram,
    createdUserPreset.preset.id,
  )

  assert.equal(
    deleted.userStylePresets?.some(
      (preset) => preset.id === createdUserPreset.preset.id,
    ),
    false,
  )
  assert.ok(
    deleted.userStylePresets?.some(
      (preset) => preset.importedTikzStyleReferenceId === reference.id,
    ),
  )
  assert.deepEqual(
    curveStylePresets.map((preset) => preset.id),
    ['blackSolidCurve', 'blackDenselyDottedCurve'],
  )
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

function generatedTikzForImportedCurveStyle(styleText: string): {
  tikz: string
  referenceKey: string
} {
  const importResult = importTikzStyleFile(
    createDiagramWithCurve(),
    'mygeometry.sty',
    styleText,
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

  return {
    tikz: generateTikz(diagram),
    referenceKey: reference.key,
  }
}

function assertNoRelativeTikzWireOption(tikz: string): void {
  assert.doesNotMatch(tikz, /(?:\[|,)\s*tikz\/wire\s*(?=,|\])/)
}

function assertIncludesOnlyExternalLoadComments(tikz: string): void {
  assert.match(tikz, /% External TikZ styles referenced below\./)
  assert.match(tikz, /% - mygeometry\.sty/)
  assert.match(tikz, /% {3}\\input\{mygeometry\.sty\}/)
  assert.doesNotMatch(tikz, /\\tikzset\{/)
  assert.doesNotMatch(tikz, /^\\input\{mygeometry\.sty\}/m)
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
