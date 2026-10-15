import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { markPointLayoutOverrides, parsePointNodeDimension, updateLegacyPointSize, updatePointNodeDimension } from '../../src/model/pointNodeLayout.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, createUserStylePresetFromStyle } from '../../src/model/stylePresets.ts'
import { defaultPointStyle } from '../../src/model/styles.ts'
import type { Diagram, PointNodeLayoutOptions, PointStratum } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'

function diagram(layout?: PointNodeLayoutOptions): Diagram {
  return { ...createEmptyDiagram({ ambientDimension: 2 }), strata: [createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 1, y: 2, z: 0 }, text: ' \t $F$ \n ', style: { ...defaultPointStyle, shape: 'rectangle', layout } })] }
}
function point(value: Diagram): PointStratum {
  const result = value.strata[0]
  if (result.geometricKind !== 'point') throw Error('Expected point')
  return result
}
function options(value: string): string[] {
  const match = value.match(/\\node\[([\s\S]*?)\] at/)
  assert.ok(match)
  return match[1].split(',').map((option) => option.trim())
}
function importApply(source: string): Diagram {
  const imported = importTikzStyleFile(diagram(), 'layout.sty', source)
  const reference = imported.references.find((entry) => entry.key === 'layout'); assert.ok(reference)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id); assert.ok(preset)
  return applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
}
for (const exportMode of ['standalone', 'inlineMath'] as const) test(`${exportMode} emits independent padding/minima/clearance/anchor while retaining model position and raw body`, () => {
  const value = diagram({ innerXSep: 0, innerYSep: -2, outerXSep: 3, outerYSep: -1, minimumWidth: 40, minimumHeight: 12, anchor: 'base east' })
  const output = generateTikz(value, { exportMode })
  const node = options(output)
  for (const expected of ['inner sep=1.5pt', 'inner xsep=0pt', 'inner ysep=-2pt', 'outer xsep=3pt', 'outer ysep=-1pt', 'minimum width=40pt', 'minimum height=12pt', 'anchor=base east']) assert.ok(node.includes(expected), expected)
  assert.match(output, /at \(1,2\)/)
  assert.ok(output.includes(exportMode === 'standalone' ? '{ \t $F$ \n }' : '{ \t $F$ }'), 'existing inline physical-line convention remains unchanged')
  assert.equal(point(value).text, ' \t $F$ \n ', 'saved source remains authoritative')
  assert.deepEqual(point(value).position, { x: 1, y: 2, z: 0 })
})
test('omitted layout does not invent axes, minimum dimensions or placement anchor', () => {
  const node = options(generateTikz(diagram()))
  assert.ok(node.includes('inner sep=1.5pt'))
  assert.ok(!node.some((option) => /^(?:inner [xy]sep|outer |minimum |anchor=)/.test(option)))
  const explicit = options(generateTikz(diagram({ innerXSep: 1.5, minimumWidth: 1, anchor: 'center' })))
  assert.ok(explicit.includes('inner xsep=1.5pt'))
  assert.ok(explicit.includes('minimum width=1pt'))
  assert.ok(explicit.includes('anchor=center'))
})
test('contextual units save source/context and export normalized TeX points in both modes', () => {
  const base = diagram()
  const changed = updateStratumStyleById(base, 'p', (style) => style.kind === 'pointStyle' ? updatePointNodeDimension({ ...style, layout: { fontContext: { fontSizePt: 12, xHeightPt: 5.2 } } }, ['innerXSep'], '2em')! : style)
  const changed2 = updateStratumStyleById(changed, 'p', (style) => style.kind === 'pointStyle' ? updatePointNodeDimension(style, ['innerYSep'], '-2ex')! : style)
  const loaded = parseSavedDiagramJson(serializeDiagram(changed2)); assert.ok(loaded.ok)
  assert.equal(point(loaded.diagram).style.layout?.units?.innerXSep?.source, '2em')
  assert.equal(point(loaded.diagram).style.layout?.units?.innerYSep?.source, '-2ex')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const node = options(generateTikz(loaded.diagram, { exportMode }))
    assert.ok(node.includes('inner xsep=24pt'))
    assert.ok(node.includes('inner ysep=-10.4pt'))
    assert.ok(!node.some((option) => /(?:em|ex)$/.test(option)))
  }
  assert.equal(parsePointNodeDimension('1in')?.texPoints, 72.27)
})
test('unchanged imported ordered layout remains governed by the external style; actual local zero/negative edits follow it', () => {
  const source = String.raw`\tikzset{layout/.style={rectangle,inner xsep=8pt,inner sep=0pt,inner ysep=-2pt,outer sep=3pt,minimum size=20pt,minimum width=30pt,anchor=base}}`
  const value = importApply(source)
  assert.equal(point(value).style.layout?.innerXSep, 0)
  assert.equal(point(value).style.layout?.innerYSep, -2)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const node = options(generateTikz(value, { exportMode })); const post = node.slice(node.indexOf('layout') + 1)
    assert.ok(!post.some((option) => /^(?:inner |outer |minimum |anchor=)/.test(option)))
  }
  const edited = updateStratumStyleById(value, 'p', (style) => style.kind === 'pointStyle' ? updatePointNodeDimension(style, ['innerXSep'], '0pt')! : style)
  const moved = updateStratumStyleById(edited, 'p', (style) => style.kind === 'pointStyle' ? markPointLayoutOverrides({ ...style, layout: { ...style.layout, anchor: 'south east' } }, ['anchor']) : style)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const node = options(generateTikz(moved, { exportMode })); const post = node.slice(node.indexOf('layout') + 1)
    assert.ok(post.includes('inner xsep=0pt'), 'equal-valued accepted edit is an explicit post-key override')
    assert.ok(post.includes('anchor=south east'))
    assert.ok(!post.some((option) => option.startsWith('inner ysep=')))
  }
})
test('unsupported external layout execution stays raw and does not receive invented post-key defaults', () => {
  const value = importApply(String.raw`\tikzset{layout/.style={inner sep=\padding,outer sep=auto,minimum height=unknown,text height=5pt,text depth=2pt,anchor=missing anchor}}`)
  assert.ok(value.importedTikzStyleReferences?.[0].previewDiagnostics?.length)
  const loaded = parseSavedDiagramJson(serializeDiagram(value)); assert.ok(loaded.ok)
  assert.ok(loaded.diagram.externalTikzStyleSources?.[0].rawSource?.includes(String.raw`inner sep=\padding`))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const node = options(generateTikz(loaded.diagram, { exportMode })); const post = node.slice(node.indexOf('layout') + 1)
    assert.ok(!post.some((option) => /^(?:inner |outer |minimum |anchor=)/.test(option)))
  }
  const edited = updateStratumStyleById(loaded.diagram, 'p', (style) => style.kind === 'pointStyle' ? updatePointNodeDimension(style, ['outerYSep'], '-1pt')! : style)
  const node = options(generateTikz(edited)); const post = node.slice(node.indexOf('layout') + 1)
  assert.ok(post.includes('outer ysep=-1pt'))
  assert.ok(!post.some((option) => option.startsWith('outer xsep=')))
})
test('legacy size returns both imported padding axes to one source with explicit post-key values', () => {
  const value = importApply(String.raw`\tikzset{layout/.style={inner xsep=2pt,inner ysep=4pt,minimum size=30pt}}`)
  const edited = updateStratumStyleById(value, 'p', (style) => style.kind === 'pointStyle' ? updateLegacyPointSize(style, 8) : style)
  assert.equal(point(edited).style.layout?.innerXSep, undefined)
  assert.equal(point(edited).style.layout?.innerYSep, undefined)
  const node = options(generateTikz(edited)); const post = node.slice(node.indexOf('layout') + 1)
  assert.ok(post.includes('inner xsep=4pt'))
  assert.ok(post.includes('inner ysep=4pt'))
  assert.ok(!post.some((option) => option.startsWith('minimum ')))
})
test('unsupported direct literal anchor survives both output modes without replacing it with center', () => {
  for (const exportMode of ['standalone', 'inlineMath'] as const) assert.ok(options(generateTikz(diagram({ anchor: 'missing anchor' }), { exportMode })).includes('anchor=missing anchor'))
})
for (const transform of ['rotate=37', 'transform shape,rotate=37']) test(`imported ${transform} remains diagnosed and external instead of becoming border rotation`, () => {
  const source = `\\tikzset{layout/.style={rectangle,${transform}}}`
  const value = importApply(source)
  assert.ok(value.importedTikzStyleReferences?.[0].previewDiagnostics?.length)
  assert.equal(point(value).style.shapeParameters?.borderRotate ?? 0, 0)
  const loaded = parseSavedDiagramJson(serializeDiagram(value)); assert.ok(loaded.ok)
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, source)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const node = options(generateTikz(loaded.diagram, { exportMode }))
    assert.ok(node.includes('layout'))
    assert.ok(!node.some((option) => option.startsWith('shape border rotate=')))
  }
  const border = importApply(String.raw`\tikzset{layout/.style={rectangle,shape border rotate=37,anchor=east}}`)
  assert.equal(point(border).style.shapeParameters?.borderRotate, 37)
  assert.equal(point(border).style.layout?.anchor, 'east')
  assert.equal(border.importedTikzStyleReferences?.[0].previewDiagnostics?.length ?? 0, 0)
})
test('direct and matching imported-preset reference routes preserve pre-key legacy padding and omit default axes', () => {
  const applied = importApply(String.raw`\tikzset{layout/.style={rectangle}}`)
  const directOnly: Diagram = { ...applied, strata: applied.strata.map((stratum) => {
    const result = { ...stratum }; delete result.stylePresetId; return result
  }) }
  const presetOnly: Diagram = { ...applied, strata: applied.strata.map((stratum) => {
    const result = { ...stratum }; delete result.importedTikzStyleReferenceId; return result
  }) }
  for (const value of [applied, directOnly, presetOnly]) for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const node = options(generateTikz(value, { exportMode }))
    assert.ok(node.indexOf('inner sep=1.5pt') < node.indexOf('layout'))
    assert.ok(node.includes('layout'))
    assert.ok(!node.some((option) => /^(?:inner [xy]sep|outer |minimum |anchor=)/.test(option)))
  }
  const local = createUserStylePresetFromStyle(diagram(), 'point', 'Local layout', point(diagram()).style); assert.ok(local)
  const value = applyUserStylePresetToStratum(local.diagram, 'p', local.preset.id)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    assert.match(output, /\.style=\{[\s\S]*?inner sep=1\.5pt/)
    assert.ok(options(output).includes(local.preset.tikzStyleName))
  }
})
