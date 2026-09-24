import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importedStylePresetStyle, importTikzStyleFile, parseTikzsetStyles, parseTikzStylePreviewOptions } from '../../src/model/importedTikzStyles.ts'
import { literalTikzColor, literalTikzDimension, resolveTikzPaint } from '../../src/model/importedTikzPaint.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import type { Diagram, PointStyle } from '../../src/model/types.ts'

function pointStyle(options: string): PointStyle {
  const style = importedStylePresetStyle('point', options)
  assert.equal(style.kind, 'pointStyle')
  if (style.kind !== 'pointStyle') throw new Error('Expected point style')
  return style
}
function diagram(): Diagram {
  const result = createEmptyDiagram({ ambientDimension: 2 })
  result.strata = [createPointStratum({ ambientDimension: 2, id: 'paint', name: 'Paint', text: '$F$', position: { x: 0, y: 0, z: 0 } })]
  return result
}
function applied(source: string, key: string): Diagram {
  const imported = importTikzStyleFile(diagram(), 'paint.sty', source)
  const reference = imported.references.find((entry) => entry.key === key)
  assert.ok(reference)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id)
  assert.ok(preset)
  return applyUserStylePresetToStratum(imported.diagram, 'paint', preset.id)
}

test('ordered paint matches independently compiled PGF 3.1.11a PDF observations', () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/point-paint-pgf/observations.json', import.meta.url), 'utf8')) as {
    pgfVersion: string
    observations: { options: string; fill: number; stroke: number; text: number; textColor: string; fillEnabled?: boolean; strokeEnabled?: boolean; strokeWidth?: number; dashPattern?: number[] }[]
  }
  assert.equal(fixture.pgfVersion, '3.1.11a')
  for (const row of fixture.observations) {
    const style = pointStyle(row.options)
    const paint = getPointPaint(style)
    assert.equal(style.opacity, 1)
    assert.equal(paint.fill.opacity, row.fill, row.options)
    assert.equal(paint.stroke.opacity, row.stroke, row.options)
    assert.equal(paint.text.opacity, row.text, row.options)
    assert.equal(paint.text.color, row.textColor, row.options)
    assert.equal(paint.fill.enabled, row.fillEnabled ?? true)
    assert.equal(paint.stroke.enabled, row.strokeEnabled ?? true)
    if (row.strokeWidth !== undefined) assert.equal(paint.stroke.width, row.strokeWidth)
    if (row.dashPattern !== undefined) {
      assert.equal(paint.stroke.lineStyle, 'dotted')
      assert.equal(paint.stroke.dashPattern, undefined)
      assert.deepEqual([paint.stroke.width, 2], row.dashPattern)
    }
  }
})

test('both declaration syntaxes retain order, comments, namespaces and raw source/options', () => {
  const source = String.raw`% ignored \tikzstyle{evil}=[red]
\tikzstyle{base}=[draw=red, node contents={[a,b]}, fill=none]
\tikzset{/tikz/.cd, named/.style={% exact comment
  text=blue, inner sep=2pt}}
\tikzstyle{base}=[draw=green]`
  const parsed = parseTikzsetStyles(source)
  assert.deepEqual(parsed.styles.map((entry) => [entry.key, entry.options]), [['base', 'draw=green'], ['/tikz/named', 'text=blue,inner sep=2pt']])
  assert.equal(parsed.skipped, 1)
  assert.match(parsed.rawOptions?.['/tikz/named'] ?? '', /% exact comment\n {2}text=blue/)
  const imported = importTikzStyleFile(diagram(), 'paint.sty', source)
  assert.equal(imported.source?.rawSource, source)
  assert.match(imported.references.find((entry) => entry.key === '/tikz/named')?.rawOptions ?? '', /% exact comment/)
})

test('qualified nested references retain the normal invocation directory and option order', () => {
  const source = String.raw`\tikzstyle{base}=[fill=blue,opacity=.4]
\tikzset{ns/.cd, base/.style={fill=red,opacity=.1}, inner/.style={base,text=red}, outer/.style={draw opacity=.8,ns/inner,fill opacity=.6}}`
  const result = importTikzStyleFile(diagram(), 'paint.sty', source)
  const ref = result.references.find((entry) => entry.key === 'ns/outer')
  const preset = result.diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === ref?.id)
  assert.ok(preset && preset.kind === 'point')
  const paint = getPointPaint(preset.style)
  assert.equal(paint.stroke.opacity, .4)
  assert.equal(paint.fill.opacity, .6)
  assert.equal(paint.text.opacity, .6)
  assert.equal(paint.text.color, '#FF0000')
  assert.deepEqual(ref?.previewDiagnostics, [])
})

test('runtime namespace and alias resolution matches independent PGF PDF observations', () => {
  const fixtureRoot = new URL('../fixtures/point-paint-pgf/namespaces/', import.meta.url)
  const fixture = JSON.parse(readFileSync(new URL('observations.json', fixtureRoot), 'utf8')) as {
    pgfVersion: string
    compilationExitCode: number
    observations: { body: string; source: string; invocation: string; textColor: string }[]
    negative: { source: string; invocation: string; compilationExitCode: number; diagnostic: string }
  }
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.compilationExitCode, 0)
  const operators = readFileSync(new URL('pdf-operators.txt', fixtureRoot), 'utf8')
  for (const row of fixture.observations) {
    assert.ok(operators.includes(`(${row.body})`), `retained PDF text operator ${row.body}`)
    const parsed = parseTikzsetStyles(row.source)
    const preview = resolveTikzPaint(row.invocation, { styles: parsed.styles })
    assert.equal(preview.textColor, row.textColor, row.body)
    assert.equal(preview.diagnostics, undefined, row.body)
  }
  assert.equal(fixture.negative.compilationExitCode, 1, 'unknown root is expected negative PGF evidence')
  assert.ok(readFileSync(new URL('missing-root-compilation.txt', fixtureRoot), 'utf8').includes(fixture.negative.diagnostic))
  const preview = resolveTikzPaint(fixture.negative.invocation, { styles: parseTikzsetStyles(fixture.negative.source).styles })
  assert.equal(preview.textColor, undefined)
  assert.match(preview.diagnostics?.join() ?? '', /base/)
  assert.ok(preview.unresolvedFields?.includes('textColor'))
})

test('canonical duplicate handling keeps the last declaration and its original spelling and raw body', () => {
  for (const [source, key] of [
    [String.raw`\tikzset{base/.style={text=red},/tikz/base/.style={text=blue},base/.style={% winning relative
 text=green}}`, 'base'],
    [String.raw`\tikzset{/tikz/base/.style={text=red},base/.style={text=blue},/tikz/base/.style={% winning absolute
 text=green}}`, '/tikz/base'],
  ]) {
    const imported = importTikzStyleFile(diagram(), 'aliases.sty', source, String.raw`\input{raw-aliases.sty}`)
    assert.deepEqual(imported.parseResult.styles, [{ key, options: 'text=green' }])
    assert.equal(imported.parseResult.skipped, 2)
    assert.equal(imported.references.length, 1)
    assert.equal(imported.references[0].key, key)
    assert.match(imported.references[0].rawOptions ?? '', /% winning/)
    assert.equal(imported.source?.rawSource, source)
    assert.equal(imported.source?.loadHint, String.raw`\input{raw-aliases.sty}`)
    const loaded = parseSavedDiagramJson(serializeDiagram(imported.diagram))
    assert.ok(loaded.ok)
    assert.deepEqual(loaded.diagram.importedTikzStyleReferences, imported.references)
    assert.deepEqual(loaded.diagram.externalTikzStyleSources, imported.diagram.externalTikzStyleSources)
    for (const invocation of ['base', '/tikz/base']) {
      assert.equal(resolveTikzPaint(invocation, { styles: imported.references }).textColor, '#00FF00')
    }
  }
})

test('namespace imports retain correct paint, source and reference identity through apply, local edit and JSON reload', () => {
  const source = String.raw`\tikzset{base/.style={text=red},ns/.cd,base/.style={text=blue},outer/.style={base}}`
  const result = applied(source, 'ns/outer')
  const point = result.strata[0]
  if (point.geometricKind !== 'point' || !point.style.paint) throw new Error('Expected point paint')
  assert.equal(point.style.paint.text.color, '#FF0000')
  const referenceId = point.importedTikzStyleReferenceId
  const reference = result.importedTikzStyleReferences?.find((entry) => entry.id === referenceId)
  assert.equal(reference?.key, 'ns/outer')
  assert.equal(reference?.rawOptions, 'base')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(result, { exportMode })
    assert.match(output, /\{HTML\}\{FF0000\}/)
    assert.doesNotMatch(output, /\{HTML\}\{0000FF\}/)
    assert.match(output, /ns\/outer,[\s\S]*text=stzPointpaintText/)
  }
  point.style = { ...point.style, paint: { ...point.style.paint, text: { color: '#123456', opacity: .4 } } }
  const loaded = parseSavedDiagramJson(serializeDiagram(result))
  assert.ok(loaded.ok)
  assert.deepEqual(loaded.diagram.importedTikzStyleReferences, result.importedTikzStyleReferences)
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, source)
  assert.equal(loaded.diagram.strata[0].importedTikzStyleReferenceId, referenceId)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded.diagram, { exportMode })
    assert.match(output, /\{HTML\}\{123456\}/)
    assert.match(output, /ns\/outer,[\s\S]*text=stzPointpaintText,[\s\S]*text opacity=0\.4/)
  }
})

test('missing root remains unresolved despite nearby namespace paint until known options or local edits resolve it', () => {
  const source = String.raw`\tikzset{ns/.cd,base/.style={text=blue},outer/.style={base}}`
  const result = applied(source, 'ns/outer')
  const reference = result.importedTikzStyleReferences?.find((entry) => entry.key === 'ns/outer')
  assert.match(reference?.previewDiagnostics?.join() ?? '', /base/)
  assert.equal(reference?.rawOptions, 'base')
  const loaded = parseSavedDiagramJson(serializeDiagram(result))
  assert.ok(loaded.ok)
  assert.deepEqual(loaded.diagram.importedTikzStyleReferences, result.importedTikzStyleReferences)
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, source)
  const point = loaded.diagram.strata[0]
  if (point.geometricKind !== 'point' || !point.style.paint) throw new Error('Expected point paint')
  assert.equal(point.style.paint.text.color, '#000000')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded.diagram, { exportMode })
    const nodeBlock = output.match(/\\node\[[\s\S]*?\] at/)?.[0] ?? ''
    assert.match(nodeBlock, /ns\/outer/)
    assert.doesNotMatch(nodeBlock.slice(nodeBlock.indexOf('ns/outer')), /text=|fill=|draw=|opacity=|line width=/)
    assert.doesNotMatch(output, /\{HTML\}\{0000FF\}/)
  }
  point.style = { ...point.style, paint: { ...point.style.paint, text: { ...point.style.paint.text, color: '#123456' } } }
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    assert.match(generateTikz(loaded.diagram, { exportMode }), /ns\/outer,[\s\S]*text=stzPointpaintText/)
  }
  const knownLater = resolveTikzPaint('ns/outer,text=red', { styles: result.importedTikzStyleReferences })
  assert.equal(knownLater.textColor, '#FF0000')
  assert.ok(!knownLater.unresolvedFields?.includes('textColor'))
  assert.ok(knownLater.unresolvedFields?.includes('fillColor'))
})

test('alias-aware cycles, nested depth and work remain bounded without owner-relative fallback', () => {
  assert.match(resolveTikzPaint('/tikz/base', { key: 'base', styles: [{ key: 'base', options: '/tikz/base' }] }).diagnostics?.join() ?? '', /Cyclic style reference: \/tikz\/base → \/tikz\/base/)
  const cyclic = resolveTikzPaint('base', { styles: [{ key: '/tikz/base', options: 'ns/inner' }, { key: 'ns/inner', options: '/tikz/base' }] })
  assert.match(cyclic.diagnostics?.join() ?? '', /Cyclic style reference: \/tikz\/base → \/tikz\/ns\/inner → \/tikz\/base/)
  assert.ok(cyclic.unresolvedFields?.includes('textColor'))
  const deep = Array.from({ length: 20 }, (_, index) => ({ key: index % 2 ? `/tikz/n${index}` : `n${index}`, options: `/tikz/n${index + 1}` }))
  assert.match(resolveTikzPaint('/tikz/n0', { styles: deep }).diagnostics?.join() ?? '', /16-level/)
  const broad = Array.from({ length: 12 }, (_, index) => ({ key: `/tikz/n${index}`, options: index === 11 ? 'red,blue,green' : `n${index + 1},/tikz/n${index + 1}` }))
  const expanded = resolveTikzPaint('n0', { styles: broad })
  assert.match(expanded.diagnostics?.join() ?? '', /4096-option/)
  assert.ok(expanded.unresolvedFields?.includes('textColor'))
})

test('runtime cd is explicitly unsupported and never approximated by declaration-directory lookup', () => {
  const styles = [{ key: 'ns/base', options: 'text=blue' }, { key: 'outer', options: 'ns/.cd,base' }]
  const preview = resolveTikzPaint('outer,text=green,/tikz/draw=red', { styles })
  assert.match(preview.diagnostics?.join() ?? '', /Unsupported runtime key directory change: ns\/\.cd/)
  assert.equal(preview.textColor, undefined)
  assert.ok(preview.unresolvedFields?.includes('textColor'))
  assert.equal(preview.drawColor, '#FF0000')
  assert.ok(!preview.unresolvedFields?.includes('drawColor'))
  const absoluteLater = resolveTikzPaint('outer,/tikz/text=green', { styles })
  assert.equal(absoluteLater.textColor, '#00FF00')
  assert.ok(!absoluteLater.unresolvedFields?.includes('textColor'))
  const absoluteReference = resolveTikzPaint('outer,/other/known,/other/text=blue', {
    styles: [...styles, { key: '/other/known', options: '/tikz/text=red' }],
  })
  assert.equal(absoluteReference.textColor, '#FF0000')
  assert.match(absoluteReference.diagnostics?.join() ?? '', /Unsupported or invalid preview option: \/other\/text=blue/)
  assert.ok(absoluteReference.unresolvedFields?.includes('textColor'))
})

test('cyclic, depth, work and file-size bounds produce explicit diagnostics', () => {
  const styles = [{ key: 'a', options: 'b,fill=red' }, { key: 'b', options: 'a,text=blue' }]
  assert.match(resolveTikzPaint('a', { styles }).diagnostics?.join() ?? '', /Cyclic style reference/)
  const deep = Array.from({ length: 20 }, (_, index) => ({ key: `n${index}`, options: index < 19 ? `n${index + 1}` : 'red' }))
  assert.match(resolveTikzPaint('n0', { styles: deep }).diagnostics?.join() ?? '', /16-level/)
  assert.match(resolveTikzPaint(Array(4098).fill('red').join(',')).diagnostics?.join() ?? '', /4096-option/)
  assert.match(parseTikzsetStyles(' '.repeat(1_000_001)).warnings[0].message, /1000000-character/)
})

test('common xcolor names, chained mixtures and literal definecolor models are bounded', () => {
  assert.equal(literalTikzColor('blue!25!red'), '#BF0040')
  assert.equal(literalTikzColor('red!50!blue!50!white'), '#BF80BF')
  assert.equal(literalTikzColor('orange'), '#FF8000')
  assert.equal(literalTikzColor('purple'), '#BF0040')
  assert.equal(literalTikzColor('red!101'), null)
  const source = String.raw`\definecolor{A}{HTML}{1234Ab}\definecolor{B}{RGB}{10,20,30}\definecolor{C}{rgb}{.2,.4,.6}\definecolor{D}{gray}{.5}\tikzstyle{node}=[text=A,fill=B,draw=C]`
  const parsed = parseTikzsetStyles(source)
  assert.deepEqual(parsed.colors, { A: '#1234AB', B: '#0A141E', C: '#336699', D: '#808080' })
  const result = applied(source, 'node')
  const point = result.strata[0]
  assert.equal(point.geometricKind, 'point')
  if (point.geometricKind !== 'point') throw new Error('Expected point')
  assert.equal(getPointPaint(point.style).text.color, '#1234AB')
  const loaded = parseSavedDiagramJson(serializeDiagram(result))
  assert.ok(loaded.ok)
  if (loaded.ok) assert.deepEqual(loaded.diagram.externalTikzStyleSources, result.externalTikzStyleSources)
})

test('invalid values and deferred shape/layout options are retained and diagnosed', () => {
  const options = String.raw`fill=\myColor,text=unknown,draw opacity=1.2,line width=NaN,opacity=0x1,minimum size=1cm,rectangle,isosceles triangle,text width=3cm`
  const preview = parseTikzStylePreviewOptions(options)
  assert.equal(preview.fillColor, undefined)
  assert.equal(preview.textColor, undefined)
  assert.equal(preview.pointShape, undefined)
  assert.equal(preview.pointSize, undefined)
  assert.equal(preview.diagnostics?.length, 9)
  const result = importTikzStyleFile(diagram(), 'paint.sty', `\\tikzstyle{node}=[${options}]`)
  assert.equal(result.references[0].options, options)
  assert.equal(result.references[0].previewDiagnostics?.length, 9)
  assert.equal(result.parseResult.warnings.length, 9)
})

test('draw/fill none, white fill, zero opacity and bare draw/fill remain distinct', () => {
  const noPaint = getPointPaint(pointStyle('fill=none,draw=none,text opacity=0'))
  assert.equal(noPaint.fill.enabled, false)
  assert.equal(noPaint.stroke.enabled, false)
  assert.equal(noPaint.text.opacity, 0)
  const white = getPointPaint(pointStyle('fill=white,draw=none,fill opacity=0,draw'))
  assert.equal(white.fill.enabled, true)
  assert.equal(white.fill.color, '#FFFFFF')
  assert.equal(white.fill.opacity, 0)
  assert.equal(white.stroke.enabled, true)
})

test('dimension grammar uses TeX points and ordered dash state is explicit', () => {
  assert.equal(literalTikzDimension('1in'), 72.27)
  assert.equal(literalTikzDimension('2.54cm'), 72.27)
  assert.equal(literalTikzDimension('1bp'), 72.27 / 72)
  assert.equal(literalTikzDimension('1em'), null)
  assert.equal(literalTikzDimension('calc(2pt)'), null)
  const paint = getPointPaint(pointStyle('very thick,dash pattern=on 2pt off 1pt on .5pt off 3pt,dash phase=-1pt,line cap=round,line join=bevel'))
  assert.equal(paint.stroke.width, 1.2)
  assert.deepEqual(paint.stroke.dashPattern, [2, 1, .5, 3])
  assert.equal(paint.stroke.dashPhase, -1)
  assert.equal(paint.stroke.lineCap, 'round')
  assert.equal(paint.stroke.lineJoin, 'bevel')
  assert.equal(getPointPaint(pointStyle('dash pattern=on 2pt off 1pt,solid')).stroke.dashPattern, undefined)
  assert.ok(parseTikzStylePreviewOptions('dash pattern=on 0pt off 0pt').diagnostics?.length)
})

test('partial imported point defaults and independent paint materialize consistently in both TikZ modes', () => {
  const result = applied(String.raw`\tikzstyle{text only}=[text=red]`, 'text only')
  const point = result.strata[0]
  if (point.geometricKind !== 'point') throw new Error('Expected point')
  const paint = getPointPaint(point.style)
  assert.equal(point.style.shape, 'circle')
  assert.equal(point.style.size, 3)
  assert.equal(paint.fill.enabled, true)
  assert.equal(paint.fill.color, '#000000')
  assert.equal(paint.stroke.width, .4)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(result, { exportMode })
    assert.match(output, /circle,[\s\S]*inner sep=1\.5pt,[\s\S]*text only,[\s\S]*fill=stzPointpaintFill,[\s\S]*draw=stzPointpaintStroke,[\s\S]*text=stzPointpaintText/)
    assert.match(output, /\\definecolor\{stzPointpaintText\}\{HTML\}\{FF0000\}/)
    assert.match(output, /text opacity=1/)
    assert.match(output, /line width=0\.4pt/)
    assert.match(output, /\\input\{paint.sty\}/)
  }
})

test('mixed paint local overrides follow external style and overall alpha multiplies only once', () => {
  const result = applied(String.raw`\tikzstyle{node}=[text=red,fill=blue,fill opacity=.35,draw=green,draw opacity=.7,line width=2pt,dashed]`, 'node')
  const point = result.strata[0]
  if (point.geometricKind !== 'point' || !point.style.paint) throw new Error('Expected point paint')
  point.style = { ...point.style, opacity: .5, paint: { ...point.style.paint, text: { color: '#FF0000', opacity: .6 } } }
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(result, { exportMode })
    assert.match(output, /node,[\s\S]*fill opacity=0\.175,[\s\S]*draw opacity=0\.35,[\s\S]*text opacity=0\.3,[\s\S]*line width=2pt,[\s\S]*dashed/)
    assert.match(output, /\{HTML\}\{0000FF\}/)
    assert.match(output, /\{HTML\}\{00FF00\}/)
    assert.match(output, /\{HTML\}\{FF0000\}/)
  }
})

test('unknown external paint retains its TikZ meaning until explicitly overridden', () => {
  const result = applied(String.raw`\tikzstyle{node}=[fill=\unknownColor,text=red,rectangle]`, 'node')
  const nodeBlock = generateTikz(result).match(/\\node\[[\s\S]*?\] at/)?.[0] ?? ''
  assert.match(nodeBlock, /node,/)
  assert.doesNotMatch(nodeBlock.slice(nodeBlock.indexOf('node,')), /fill=/)
  const point = result.strata[0]
  if (point.geometricKind !== 'point' || !point.style.paint) throw new Error('Expected point paint')
  point.style = { ...point.style, paint: { ...point.style.paint, fill: { ...point.style.paint.fill, color: '#123456' } } }
  assert.match(generateTikz(result), /node,[\s\S]*fill=stzPointpaintFill/)
})


test('object prototype property names are unknown colors/options, never executable values', () => {
  for (const value of ['constructor', 'toString', '__proto__']) {
    assert.equal(literalTikzColor(value), null)
    const preview = parseTikzStylePreviewOptions(value)
    assert.equal(preview.lineWidth, undefined)
    assert.equal(preview.lineStyle, undefined)
    assert.equal(preview.diagnostics?.length, 1)
  }
})


test('zero-width PGF device hairlines are diagnosed instead of previewed as absent stroke', () => {
  const preview = parseTikzStylePreviewOptions('line width=0pt')
  assert.equal(preview.lineWidth, undefined)
  assert.match(preview.diagnostics?.join() ?? '', /line width=0pt/)
})

test('prototype-looking style names retain raw option strings safely', () => {
  const result = importTikzStyleFile(diagram(), 'paint.sty', String.raw`\tikzstyle{__proto__}=[text=red]`)
  assert.equal(result.references[0].key, '__proto__')
  assert.equal(result.references[0].rawOptions, 'text=red')
})


test('unknown referenced styles retain arbitrary paint while later known options still override', () => {
  const result = applied(String.raw`\tikzstyle{node}=[mystery,text=red]`, 'node')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const nodeBlock = generateTikz(result, { exportMode }).match(/\\node\[[\s\S]*?\] at/)?.[0] ?? ''
    const externalIndex = nodeBlock.indexOf('node,')
    assert.ok(externalIndex > nodeBlock.indexOf('fill=stzPointpaintFill'))
    assert.doesNotMatch(nodeBlock.slice(0, externalIndex), /text opacity=/)
    const afterExternal = nodeBlock.slice(externalIndex)
    assert.match(afterExternal, /text=stzPointpaintText/)
    assert.doesNotMatch(afterExternal, /fill=|draw=|fill opacity=|draw opacity=|text opacity=|line width=/)
  }
  const point = result.strata[0]
  if (point.geometricKind !== 'point' || !point.style.paint) throw new Error('Expected point paint')
  point.style = { ...point.style, paint: { ...point.style.paint, fill: { ...point.style.paint.fill, color: '#123456' } } }
  const output = generateTikz(result)
  assert.match(output, /node,[\s\S]*fill=stzPointpaintFill/)
})

test('known options resolve only their own uncertain fields after unknown references', () => {
  const preview = parseTikzStylePreviewOptions('mystery,color=red,draw=none,text opacity=.5,line width=2pt')
  assert.ok(preview.unresolvedFields?.includes('fillEnabled'))
  assert.ok(!preview.unresolvedFields?.includes('drawEnabled'))
  assert.ok(!preview.unresolvedFields?.includes('textColor'))
  assert.ok(!preview.unresolvedFields?.includes('textOpacity'))
  assert.ok(!preview.unresolvedFields?.includes('lineWidth'))
})
