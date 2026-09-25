import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { createImportedTikzResolutionContext, importTikzStyleFile, parseTikzsetStyles, resolveImportedTikzStyle } from '../../src/model/importedTikzStyles.ts'
import { literalTikzColor, resolveTikzPaint } from '../../src/model/importedTikzPaint.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import type { Diagram, ImportedTikzStyleReference } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

function diagram(): Diagram {
  const value = createEmptyDiagram({ ambientDimension: 2 })
  value.strata = [createPointStratum({ ambientDimension: 2, id: 'context-point', name: 'Context point', text: '$F$', position: { x: 0, y: 0, z: 0 } })]
  return value
}
function point(value: Diagram) {
  const result = value.strata[0]
  assert.equal(result.geometricKind, 'point')
  if (result.geometricKind !== 'point') throw new Error('Expected point')
  return result
}
function apply(value: Diagram, reference: ImportedTikzStyleReference): Diagram {
  const preset = value.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id)
  assert.ok(preset)
  return applyUserStylePresetToStratum(value, 'context-point', preset.id)
}
function reload(value: Diagram): Diagram {
  const loaded = parseSavedDiagramJson(serializeDiagram(value))
  assert.ok(loaded.ok)
  return loaded.diagram
}
function afterExternal(output: string, key: string): string {
  const block = output.match(/\\node\[([\s\S]*?)\] at/)?.[1]
  assert.ok(block, 'point node options exist')
  const options = block.split(',').map((part) => part.trim())
  const index = options.indexOf(key)
  assert.notEqual(index, -1, 'actual external key occurs in point options')
  return options.slice(index + 1).join(',')
}
function assertedColor(output: string, after: string, field: string, expected: string): void {
  const name = after.match(new RegExp(`(?:^|,)${field}=([^,]+)`))?.[1]
  assert.ok(name, `${field} occurs after the external key`)
  const definitions = [...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-F]+)\}/g)]
  assert.equal(definitions.find((entry) => entry[1] === name)?.[2], expected, field)
}

test('sequential imports resolve prior styles/colors with accurate diagnostics and ordered dependency hints', () => {
  const baseSource = String.raw`\definecolor{prior}{HTML}{123456}\tikzset{base/.style={fill=red,text=green},named/.style={text=prior}}`
  const base = importTikzStyleFile(diagram(), 'base.sty', baseSource, String.raw`\input{custom/base.sty}`)
  const outer = importTikzStyleFile(base.diagram, 'outer.sty', String.raw`\tikzset{outer/.style={base,draw=blue},colored/.style={named,fill=prior}}`)
  assert.deepEqual(outer.references.map((reference) => reference.previewDiagnostics), [[], []])
  assert.deepEqual(outer.parseResult.warnings, [])
  const applied = reload(apply(outer.diagram, outer.references[0]))
  const paint = getPointPaint(point(applied).style)
  assert.equal(paint.fill.color, '#FF0000')
  assert.equal(paint.text.color, '#00FF00')
  assert.equal(paint.stroke.color, '#0000FF')
  assert.equal(applied.externalTikzStyleSources?.[0].rawSource, baseSource)
  assert.equal(point(applied).importedTikzStyleReferenceId, outer.references[0].id)
  const context = createImportedTikzResolutionContext({ ...applied, importedTikzStyleReferences: [...applied.importedTikzStyleReferences!].reverse() })
  assert.deepEqual(resolveImportedTikzStyle(outer.references[0], context).sourceDependencies, [base.source?.id, outer.source?.id])
  const colored = getPointPaint(point(apply(applied, outer.references[1])).style)
  assert.equal(colored.fill.color, '#123456')
  assert.equal(colored.text.color, '#123456')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(applied, { exportMode })
    const after = afterExternal(output, 'outer')
    assertedColor(output, after, 'fill', 'FF0000')
    assertedColor(output, after, 'text', '00FF00')
    assertedColor(output, after, 'draw', '0000FF')
    assert.ok(output.indexOf(String.raw`\input{custom/base.sty}`) < output.indexOf(String.raw`\input{outer.sty}`))
    assert.equal(output.split(String.raw`\input{custom/base.sty}`).length, 2)
  }
})

test('later canonical definitions replace the invoked root and nested keys without claiming local overrides', () => {
  const initial = importTikzStyleFile(diagram(), 'first.sty', String.raw`\tikzstyle{root}=[base,text=red]\tikzstyle{/other/base}=[text=yellow]`)
  const first = apply(initial.diagram, initial.references[0])
  assert.match(initial.references[0].previewDiagnostics?.join() ?? '', /base/)
  const next = importTikzStyleFile(first, 'later.sty', String.raw`\tikzstyle{base}=[fill=blue]\tikzstyle{/tikz/root}=[base,text=green]`)
  const refreshed = reload(next.diagram)
  assert.deepEqual(refreshed.importedTikzStyleReferences?.[0].previewDiagnostics, [])
  assert.equal(point(refreshed).importedTikzStyleReferenceId, initial.references[0].id)
  assert.deepEqual(point(refreshed).style.importedPaint?.overriddenFields, [])
  assert.equal(getPointPaint(point(refreshed).style).fill.color, '#0000FF')
  assert.equal(getPointPaint(point(refreshed).style).text.color, '#00FF00')
  const context = createImportedTikzResolutionContext(refreshed)
  assert.equal(resolveImportedTikzStyle(initial.references[0], context).textColor, '#00FF00')
  assert.equal(resolveTikzPaint('/other/base', context).textColor, '#FFFF00')
  assert.equal(resolveTikzPaint('/tikz/base', context).fillColor, '#0000FF')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(refreshed, { exportMode })
    assertedColor(output, afterExternal(output, 'root'), 'text', '00FF00')
    assertedColor(output, afterExternal(output, 'root'), 'fill', '0000FF')
    assert.ok(output.indexOf(String.raw`\input{first.sty}`) < output.indexOf(String.raw`\input{later.sty}`))
  }
  const reapplied = apply(refreshed, initial.references[0])
  assert.equal(getPointPaint(point(reapplied).style).text.color, '#00FF00', 'old preset tracks its unchanged imported snapshot')
})

test('later imports preserve local edits and legacy explicit values through reload and history', () => {
  const imported = importTikzStyleFile(diagram(), 'outer.sty', String.raw`\tikzstyle{outer}=[missing,text=red]`)
  const applied = apply(imported.diagram, imported.references[0])
  const edited = updateStratumStyleById(applied, 'context-point', (style) => {
    if (style.kind !== 'pointStyle') return style
    const paint = getPointPaint(style)
    return { ...style, paint: { ...paint, fill: { ...paint.fill, color: '#123456' } } }
  })
  const state: UndoableEditorState = {
    editableDiagram: edited, history: createDiagramHistory(edited), selectedElement: null,
    layerFilter: allLayersFilter, polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null,
  }
  const later = importTikzStyleFile(edited, 'dependency.sty', String.raw`\tikzstyle{missing}=[fill=blue,draw=green]`).diagram
  const committed = commitDiagramChange(state, { ...state, editableDiagram: later })
  const undone = undoLastDiagramChange(committed)
  assert.equal(getPointPaint(point(undone.editableDiagram).style).stroke.color, '#000000')
  const restored = reload(redoLastDiagramChange(undone).editableDiagram)
  assert.equal(getPointPaint(point(restored).style).fill.color, '#123456')
  assert.equal(getPointPaint(point(restored).style).stroke.color, '#00FF00')
  assert.deepEqual(point(restored).style.importedPaint?.overriddenFields, ['fill.color'])
  assert.equal(getPointPaint(point(applied).style).fill.color, '#000000', 'import leaves prior history immutable')
  const legacy = reload(applied)
  delete point(legacy).style.importedPaint
  const legacyAfter = importTikzStyleFile(legacy, 'dependency.sty', String.raw`\tikzstyle{missing}=[fill=blue]`).diagram
  assert.equal(getPointPaint(point(legacyAfter).style).fill.color, '#000000', 'authored legacy style is not regenerated')
  assert.equal(point(legacyAfter).style.importedPaint, undefined)
})

test('unsupported built-in and custom color redefinitions are unknown bindings in declaration/source order', () => {
  for (const name of ['red', 'Custom']) {
    const supported = `\\definecolor{${name}}{HTML}{123456}`
    const unsupported = `\\definecolor{${name}}{cmyk}{1,0,0,0}`
    for (const source of [unsupported, supported + unsupported]) {
      const parsed = parseTikzsetStyles(`${source}\\tikzstyle{myPoint}=[fill=${name},text=${name},draw=blue]`)
      assert.equal(parsed.colors?.[name], null)
      assert.equal(literalTikzColor(name, parsed.colors), null)
      assert.equal(literalTikzColor('blue', parsed.colors), '#0000FF')
      assert.match(parsed.warnings.map((warning) => warning.message).join(), /Unsupported literal/)
    }
    const reversed = parseTikzsetStyles(unsupported + supported)
    assert.equal(literalTikzColor(name, reversed.colors), '#123456')
    assert.equal(literalTikzColor(name.toUpperCase(), reversed.colors), null)
  }
  const first = importTikzStyleFile(diagram(), 'first.sty', String.raw`\definecolor{red}{HTML}{123456}\tikzstyle{myPoint}=[fill=red,text=red,draw=blue]`)
  const applied = apply(first.diagram, first.references[0])
  const last = importTikzStyleFile(applied, 'last.sty', String.raw`\definecolor{red}{cmyk}{1,0,0,0}\tikzstyle{other}=[draw=green]`)
  const result = reload(last.diagram)
  assert.equal(getPointPaint(point(result).style).fill.color, '#000000')
  const context = createImportedTikzResolutionContext(result)
  const preview = resolveImportedTikzStyle(first.references[0], context)
  assert.equal(preview.fillColor, undefined)
  assert.equal(preview.textColor, undefined)
  assert.equal(preview.drawColor, '#0000FF')
  assert.deepEqual(preview.sourceDependencies, [first.source?.id, last.source?.id])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(result, { exportMode })
    const after = afterExternal(output, 'myPoint')
    assert.doesNotMatch(after, /(?:^|,)(?:fill|text)=/)
    assertedColor(output, after, 'draw', '0000FF')
    assert.ok(output.indexOf(String.raw`\input{first.sty}`) < output.indexOf(String.raw`\input{last.sty}`))
  }
})

test('exact unsupported red reproduction keeps external fill/text; later known options resolve only their fields', () => {
  const imported = importTikzStyleFile(diagram(), 'unknown-red.sty', String.raw`\definecolor{red}{cmyk}{1,0,0,0}\tikzstyle{myPoint}=[fill=red,text=red]`)
  const result = reload(apply(imported.diagram, imported.references[0]))
  const preview = resolveImportedTikzStyle(imported.references[0], createImportedTikzResolutionContext(result))
  assert.ok(preview.unresolvedFields?.includes('fillColor'))
  assert.ok(preview.unresolvedFields?.includes('textColor'))
  assert.match(imported.references[0].previewDiagnostics?.join() ?? '', /fill=red/)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    assert.doesNotMatch(afterExternal(generateTikz(result, { exportMode }), 'myPoint'), /(?:^|,)(?:fill|text)=/)
  }
  let edited = result
  for (const color of ['#123456', '#000000'] as const) {
    edited = updateStratumStyleById(edited, 'context-point', (style) => {
      if (style.kind !== 'pointStyle') return style
      const paint = getPointPaint(style)
      return { ...style, paint: { ...paint, fill: { ...paint.fill, color } } }
    }, ['fill.color'])
  }
  const loadedEdit = reload(edited)
  assert.deepEqual(point(loadedEdit).style.importedPaint?.overriddenFields, ['fill.color'])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loadedEdit, { exportMode })
    const after = afterExternal(output, 'myPoint')
    assertedColor(output, after, 'fill', '000000')
    assert.doesNotMatch(after, /(?:^|,)text=/, 'fill edit does not claim unknown text')
  }
  const later = resolveTikzPaint('myPoint,fill=blue,text=green', createImportedTikzResolutionContext(result))
  assert.equal(later.fillColor, '#0000FF')
  assert.equal(later.textColor, '#00FF00')
  assert.ok(!later.unresolvedFields?.includes('fillColor'))
  assert.ok(!later.unresolvedFields?.includes('textColor'))
})

test('unknown color operands propagate through mixtures including implicit white without global mutation', () => {
  const colors = { red: null, white: null } as const
  for (const mixture of ['red!50!blue', 'blue!50!red', 'blue!50', 'green!50!blue!50']) {
    assert.equal(literalTikzColor(mixture, colors), null, mixture)
    const preview = resolveTikzPaint(`fill=${mixture},text=${mixture},draw=green`, { colors })
    assert.ok(preview.unresolvedFields?.includes('fillColor'), mixture)
    assert.ok(preview.unresolvedFields?.includes('textColor'), mixture)
    assert.equal(preview.drawColor, '#00FF00')
  }
  assert.equal(literalTikzColor('red'), '#FF0000')
  assert.equal(literalTikzColor('blue!50'), '#8080FF')
  const dependencies = resolveTikzPaint('fill=red!50!blue', {
    colors: { red: null, blue: '#123456' }, colorSourceIds: { red: 'first', blue: 'second' }, sourceIds: ['first', 'second'],
  })
  assert.deepEqual(dependencies.sourceDependencies, ['first', 'second'])
  for (const color of ['red', 'blue!50', 'red!50!blue']) {
    const preview = resolveTikzPaint(`fill,draw=green,line width=2pt,text opacity=.4,${color}`, { colors })
    assert.deepEqual(preview.unresolvedFields, ['fillColor', 'drawColor', 'textColor'])
    assert.equal(preview.lineWidth, 2)
    assert.equal(preview.textOpacity, .4)
    assert.equal(preview.fillEnabled, true)
  }
})

test('style invocation uses the final color environment even for declarations after its body', () => {
  const imported = importTikzStyleFile(diagram(), 'colors.sty', String.raw`\definecolor{late}{HTML}{111111}\tikzstyle{point}=[fill=late,text=late]\definecolor{late}{HTML}{ABCDEF}`)
  const paint = getPointPaint(point(apply(imported.diagram, imported.references[0])).style)
  assert.equal(paint.fill.color, '#ABCDEF')
  assert.equal(paint.text.color, '#ABCDEF')
})

test('later supported source restores formerly unknown bindings for old references and independent sources remain local', () => {
  const first = importTikzStyleFile(diagram(), 'unknown.sty', String.raw`\definecolor{red}{cmyk}{1,0,0,0}\tikzstyle{point}=[fill=red,text=red]`)
  const applied = apply(first.diagram, first.references[0])
  const restored = importTikzStyleFile(applied, 'known.sty', String.raw`\definecolor{red}{HTML}{ABCDEF}\tikzstyle{unrelated}=[text=blue]`)
  const loaded = reload(restored.diagram)
  assert.equal(getPointPaint(point(loaded).style).fill.color, '#ABCDEF')
  assert.equal(getPointPaint(point(loaded).style).text.color, '#ABCDEF')
  assert.deepEqual(point(loaded).style.importedPaint?.overriddenFields, [])
  assert.deepEqual(loaded.importedTikzStyleReferences?.[0].previewDiagnostics, [])
  assert.equal(resolveImportedTikzStyle(first.references[0], createImportedTikzResolutionContext(first.diagram)).fillColor, undefined)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded, { exportMode })
    const after = afterExternal(output, 'point')
    assertedColor(output, after, 'fill', 'ABCDEF')
    assertedColor(output, after, 'text', 'ABCDEF')
  }
})

for (const [name, source] of [
  ['one block', String.raw`\tikzset{myPoint/.style={fill=red,text=red},myPoint/.append style={fill=blue,text=blue}}`],
  ['separate blocks', String.raw`\tikzset{myPoint/.style={fill=red,text=red}}\tikzset{myPoint/.append style={fill=blue,text=blue}}`],
]) test(`unsupported mutation retains ordered uncertainty and red fallback in ${name}`, () => {
  const imported = importTikzStyleFile(diagram(), 'append.sty', source)
  const reference = imported.references[0]
  assert.deepEqual(imported.parseResult.declarations?.map((entry) => entry.kind), ['definition', 'mutation'])
  assert.match(imported.parseResult.warnings.map((warning) => warning.message).join(), /myPoint\/\.append style/)
  assert.match(reference.previewDiagnostics?.join() ?? '', /myPoint\/\.append style/)
  assert.equal(reference.options, 'fill=red,text=red')
  assert.equal(reference.rawOptions, 'fill=red,text=red')
  const applied = reload(apply(imported.diagram, reference))
  assert.equal(applied.externalTikzStyleSources?.[0].rawSource, source)
  assert.equal(point(applied).importedTikzStyleReferenceId, reference.id)
  assert.deepEqual(point(applied).style.importedPaint?.overriddenFields, [])
  const preview = resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(applied))
  assert.equal(preview.fillColor, '#FF0000', 'last known red is a preview approximation, never evaluated append blue')
  assert.equal(preview.textColor, '#FF0000')
  for (const field of ['fillColor', 'fillEnabled', 'textColor', 'drawColor', 'fillOpacity', 'textOpacity', 'drawOpacity', 'lineWidth', 'dashPattern']) {
    assert.ok(preview.unresolvedFields?.includes(field), field)
  }
  const paint = getPointPaint(point(applied).style)
  assert.equal(paint.fill.color, '#FF0000')
  assert.equal(paint.text.color, '#FF0000')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    assert.doesNotMatch(afterExternal(generateTikz(applied, { exportMode }), 'myPoint'), /(?:^|,)(?:fill|text|draw|fill opacity|draw opacity|text opacity|line width)=/)
  }
})

test('declaration cd and canonical aliases invalidate only their literal target', () => {
  const source = String.raw`\tikzset{myPoint/.style={fill=red,text=red},/other/myPoint/.style={fill=blue,text=blue},/tikz/.cd,myPoint/.append style={fill=green}}`
  const imported = importTikzStyleFile(diagram(), 'aliases.sty', source)
  const context = createImportedTikzResolutionContext(imported.diagram)
  for (const key of ['myPoint', '/tikz/myPoint']) {
    const preview = resolveTikzPaint(key, context)
    assert.equal(preview.fillColor, '#FF0000')
    assert.ok(preview.unresolvedFields?.includes('fillColor'))
    assert.match(preview.diagnostics?.join() ?? '', /\/tikz\/myPoint\/\.append style/)
  }
  const other = resolveTikzPaint('/other/myPoint', context)
  assert.equal(other.fillColor, '#0000FF')
  assert.equal(other.textColor, '#0000FF')
  assert.equal(other.unresolvedFields, undefined)
  assert.equal(other.diagnostics, undefined)
  const namespaced = importTikzStyleFile(diagram(), 'directory.sty', String.raw`\tikzset{/tikz/group/.cd,myPoint/.style={fill=red},myPoint/.prefix style={draw=blue}}`)
  assert.ok(resolveTikzPaint('group/myPoint', createImportedTikzResolutionContext(namespaced.diagram)).unresolvedFields?.includes('fillColor'))
})

test('a full supported definition restores certainty only after the last mutation in declaration order', () => {
  const before = String.raw`\tikzset{myPoint/.style={fill=red,text=red},/tikz/myPoint/.append style={fill=blue,text=blue}}`
  const unknown = importTikzStyleFile(diagram(), 'unknown.sty', before)
  assert.ok(resolveImportedTikzStyle(unknown.references[0], createImportedTikzResolutionContext(unknown.diagram)).unresolvedFields?.length)
  for (const restoration of [
    String.raw`\tikzset{myPoint/.style={fill=green,text=green}}`,
    String.raw`\tikzstyle{/tikz/myPoint}=[fill=green,text=green]`,
  ]) {
    const restored = importTikzStyleFile(diagram(), 'restored.sty', before + restoration)
    const preview = resolveImportedTikzStyle(restored.references[0], createImportedTikzResolutionContext(restored.diagram))
    assert.equal(preview.fillColor, '#00FF00')
    assert.equal(preview.textColor, '#00FF00')
    assert.equal(preview.unresolvedFields, undefined)
    assert.equal(preview.diagnostics, undefined)
    assert.deepEqual(restored.references[0].previewDiagnostics, [])
    assert.deepEqual(restored.parseResult.declarations?.map((entry) => entry.kind), ['definition', 'mutation', 'definition'])
    const applied = apply(restored.diagram, restored.references[0])
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const output = generateTikz(applied, { exportMode })
      const after = afterExternal(output, restored.references[0].key)
      assertedColor(output, after, 'fill', '00FF00')
      assertedColor(output, after, 'text', '00FF00')
    }
  }
})

test('nested invalidated invocation keeps all other paint uncertain after known text while unrelated styles stay resolved', () => {
  const imported = importTikzStyleFile(diagram(), 'nested.sty', String.raw`\tikzset{myPoint/.style={fill=red,text=red},myPoint/.append style={fill=blue,text=blue},outer/.style={myPoint,text=green},unrelated/.style={fill=blue,text=blue}}`)
  const context = createImportedTikzResolutionContext(imported.diagram)
  const outer = resolveTikzPaint('outer', context)
  assert.equal(outer.fillColor, '#FF0000')
  assert.equal(outer.textColor, '#00FF00')
  assert.ok(outer.unresolvedFields?.includes('fillColor'))
  assert.ok(outer.unresolvedFields?.includes('drawColor'))
  assert.ok(!outer.unresolvedFields?.includes('textColor'))
  assert.match(outer.diagnostics?.join() ?? '', /myPoint\/\.append style/)
  const unrelated = resolveTikzPaint('unrelated', context)
  assert.equal(unrelated.fillColor, '#0000FF')
  assert.equal(unrelated.unresolvedFields, undefined)
  assert.equal(unrelated.diagnostics, undefined)
  const reference = imported.references.find((entry) => entry.key === 'outer')!
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(apply(imported.diagram, reference), { exportMode })
    const after = afterExternal(output, 'outer')
    assert.doesNotMatch(after, /(?:^|,)(?:fill|draw)=/)
    assertedColor(output, after, 'text', '00FF00')
  }
})

for (const handler of ['prefix style', 'add style', 'append code', 'code', 'style args']) {
  test(`recognizable unsupported .${handler} invalidates paint without executing its body`, () => {
    const imported = importTikzStyleFile(diagram(), 'handler.sty', `\\tikzset{myPoint/.style={fill=red,text=red},myPoint/.${handler}={fill=blue,text=blue}}`)
    const preview = resolveTikzPaint('myPoint', createImportedTikzResolutionContext(imported.diagram))
    assert.equal(preview.fillColor, '#FF0000')
    assert.ok(preview.unresolvedFields?.includes('fillColor'))
    assert.ok(preview.unresolvedFields?.includes('textColor'))
    assert.ok(preview.diagnostics?.some((message) => message.includes(`/.${handler}`)))
  })
}

test('saved-reference fallback cannot restore an explicitly invalidated missing or stale definition', () => {
  const initial = importTikzStyleFile(diagram(), 'source.sty', String.raw`\tikzset{myPoint/.style={fill=red,text=red}}`)
  const reference = initial.references[0]
  const mutationSource = { ...initial.source!, rawSource: String.raw`\tikzset{myPoint/.append style={fill=blue,text=blue}}` }
  for (const stale of [reference, { ...reference, id: 'stale-legacy', sourceId: 'missing-source' }]) {
    const context = createImportedTikzResolutionContext({ externalTikzStyleSources: [mutationSource], importedTikzStyleReferences: [stale] })
    const preview = resolveTikzPaint('myPoint', context)
    assert.equal(preview.fillColor, undefined, 'stale red body is not substituted for the unknown definition')
    assert.equal(preview.textColor, undefined)
    assert.ok(preview.unresolvedFields?.includes('fillColor'))
    assert.match(preview.diagnostics?.join() ?? '', /append style/)
  }
  const later = importTikzStyleFile(initial.diagram, 'mutation.sty', String.raw`\tikzset{myPoint/.append style={fill=blue},other/.style={text=green}}`)
  const withStaleReference = {
    ...later.diagram,
    externalTikzStyleSources: [...later.diagram.externalTikzStyleSources!, { id: 'legacy-source', name: 'legacy.sty', loadHint: String.raw`\input{legacy.sty}` }],
    importedTikzStyleReferences: [...later.diagram.importedTikzStyleReferences!, { ...reference, id: 'stale-legacy', sourceId: 'legacy-source', options: 'fill=green' }],
  }
  const preview = resolveTikzPaint('myPoint', createImportedTikzResolutionContext(withStaleReference))
  assert.equal(preview.fillColor, '#FF0000')
  assert.ok(preview.unresolvedFields?.includes('fillColor'))
})

test('later source mutation refreshes diagnostics, preserves local intent, and survives saved sources and history', () => {
  const base = importTikzStyleFile(diagram(), 'base.sty', String.raw`\tikzset{base/.style={fill=red},myPoint/.style={base,text=red}}`, String.raw`\input{custom/base.sty}`)
  const reference = base.references.find((entry) => entry.key === 'myPoint')!
  const applied = apply(base.diagram, reference)
  const beforeSnapshot = serializeDiagram(applied)
  const edited = updateStratumStyleById(applied, 'context-point', (style) => {
    if (style.kind !== 'pointStyle') return style
    const paint = getPointPaint(style)
    return { ...style, paint: { ...paint, fill: { ...paint.fill, color: '#123456' } } }
  }, ['fill.color'])
  const mutation = String.raw`\tikzset{/tikz/myPoint/.append style={fill=blue,text=blue},unrelated/.style={text=green}}`
  const later = importTikzStyleFile(edited, 'mutation.sty', mutation, String.raw`\input{custom/mutation.sty}`)
  assert.equal(later.references.length, 1, 'mutating source needs no new reference for the mutated key')
  assert.equal(later.references[0].key, 'unrelated')
  const state: UndoableEditorState = {
    editableDiagram: edited, history: createDiagramHistory(edited), selectedElement: null,
    layerFilter: allLayersFilter, polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null,
  }
  const committed = commitDiagramChange(state, { ...state, editableDiagram: later.diagram })
  assert.equal(committed.history.past.length, 1)
  const undone = undoLastDiagramChange(committed)
  assert.deepEqual(resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(undone.editableDiagram)).unresolvedFields, undefined)
  const loaded = reload(redoLastDiagramChange(undone).editableDiagram)
  assert.equal(loaded.externalTikzStyleSources?.[1].rawSource, mutation)
  assert.equal(point(loaded).importedTikzStyleReferenceId, reference.id)
  assert.deepEqual(point(loaded).style.importedPaint?.overriddenFields, ['fill.color'])
  assert.equal(getPointPaint(point(loaded).style).fill.color, '#123456')
  assert.equal(getPointPaint(point(loaded).style).text.color, '#FF0000')
  assert.equal(serializeDiagram(applied), beforeSnapshot, 'prior import/apply snapshots remain immutable')
  assert.deepEqual(applied.importedTikzStyleReferences?.find((entry) => entry.id === reference.id)?.previewDiagnostics, [])
  assert.match(loaded.importedTikzStyleReferences?.find((entry) => entry.id === reference.id)?.previewDiagnostics?.join() ?? '', /append style/)
  const context = createImportedTikzResolutionContext(loaded)
  assert.deepEqual(resolveImportedTikzStyle(reference, context).sourceDependencies, [base.source?.id, later.source?.id])
  assert.ok(resolveImportedTikzStyle(reference, context).unresolvedFields?.includes('textColor'))
  const reapplied = apply(loaded, reference)
  assert.equal(getPointPaint(point(reapplied).style).fill.color, '#FF0000', 'old preset refreshed to unresolved fallback without inherited local edit')
  assert.deepEqual(point(reapplied).style.importedPaint?.overriddenFields, [])
  const appliedAfterMutation = apply(importTikzStyleFile(base.diagram, 'mutation.sty', mutation).diagram, reference)
  assert.equal(getPointPaint(point(appliedAfterMutation).style).fill.color, '#FF0000')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded, { exportMode })
    const after = afterExternal(output, 'myPoint')
    assertedColor(output, after, 'fill', '123456')
    assert.doesNotMatch(after, /(?:^|,)text=/)
    const hints = output.match(/%\s+\\input\{[^}]+\}/g) ?? []
    assert.equal(hints.length, 2)
    assert.ok(hints[0].includes('custom/base.sty'))
    assert.ok(hints[1].includes('custom/mutation.sty'))
    assert.doesNotMatch(output, /^\\input\{/m, 'hints stay comments')
  }
})

test('recognizable handler chains and legacy tikzstyle append retain uncertainty within literal parser boundaries', () => {
  const prefix = String.raw`\tikzset{myPoint/.style={fill=red,text=red}}`
  for (const mutation of [
    String.raw`\tikzstyle{myPoint}+=[fill=blue,text=blue]`,
    String.raw`\tikzset{myPoint/.style/.expanded={fill=blue,text=blue}}`,
    String.raw`\tikzset{myPoint/.style 2 args={fill=blue,text=blue}}`,
    '\\tikzset{myPoint/.append\n style={fill=blue,text=blue}}',
  ]) {
    const imported = importTikzStyleFile(diagram(), 'literal.sty', prefix + mutation)
    const preview = resolveTikzPaint('myPoint', createImportedTikzResolutionContext(imported.diagram))
    assert.equal(preview.fillColor, '#FF0000', mutation)
    assert.ok(preview.unresolvedFields?.includes('fillColor'), mutation)
    assert.match(preview.diagnostics?.join() ?? '', /Unsupported style mutation myPoint/, mutation)
    assert.equal(imported.references[0].rawOptions, 'fill=red,text=red')
  }
  for (const target of [String.raw`\target`, '#1', '{myPoint}', 'myPoint~']) {
    const parsed = parseTikzsetStyles(`\\tikzset{${target}/.append style={fill=blue}}`)
    assert.deepEqual(parsed.declarations, [], `unsupported nonliteral target ${target} is not guessed`)
    assert.ok(parsed.warnings.length)
  }
  const invocation = importTikzStyleFile(diagram(), 'invocation.sty', prefix + String.raw`\tikzset{myPoint=blue}`)
  assert.equal(resolveTikzPaint('myPoint', createImportedTikzResolutionContext(invocation.diagram)).unresolvedFields, undefined, 'ordinary unsupported invocation is not a definition mutation')
})

test('mutating and required dependency sources remain ordered, and a later full source restores old-reference resolution', () => {
  const dependency = importTikzStyleFile(diagram(), 'dependency.sty', String.raw`\tikzset{base/.style={fill=red}}`)
  const definition = importTikzStyleFile(dependency.diagram, 'definition.sty', String.raw`\tikzset{myPoint/.style={base,text=red}}`)
  const reference = definition.references[0]
  const mutation = importTikzStyleFile(definition.diagram, 'mutation.sty', String.raw`\tikzset{myPoint/.append style={fill=blue,text=blue},other/.style={text=green}}`)
  const applied = reload(apply(mutation.diagram, reference))
  const preview = resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(applied))
  assert.deepEqual(preview.sourceDependencies, [dependency.source?.id, definition.source?.id, mutation.source?.id])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(applied, { exportMode })
    assert.deepEqual(output.match(/%\s+\\input\{[^}]+\}/g)?.map((hint) => hint.replace(/^%\s+/, '')), [
      String.raw`\input{dependency.sty}`, String.raw`\input{definition.sty}`, String.raw`\input{mutation.sty}`,
    ])
  }
  const restored = importTikzStyleFile(applied, 'restored.sty', String.raw`\tikzset{/tikz/myPoint/.style={fill=green,text=blue}}`)
  const loaded = reload(restored.diagram)
  assert.equal(point(loaded).importedTikzStyleReferenceId, reference.id)
  assert.equal(getPointPaint(point(loaded).style).fill.color, '#00FF00')
  assert.equal(getPointPaint(point(loaded).style).text.color, '#0000FF')
  assert.deepEqual(point(loaded).style.importedPaint?.overriddenFields, [])
  assert.deepEqual(loaded.importedTikzStyleReferences?.find((entry) => entry.id === reference.id)?.previewDiagnostics, [])
  assert.equal(resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(loaded)).unresolvedFields, undefined)
})

test('literal mutation-body dependencies retain their source hints without applying append paint', () => {
  const root = importTikzStyleFile(diagram(), 'root.sty', String.raw`\tikzset{myPoint/.style={fill=red,text=red}}`)
  const dependency = importTikzStyleFile(root.diagram, 'dependency.sty', String.raw`\tikzset{bluePaint/.style={fill=blue,text=blue}}`)
  const mutation = importTikzStyleFile(dependency.diagram, 'mutation.sty', String.raw`\tikzset{myPoint/.append style={bluePaint},unrelated/.style={fill=green}}`)
  const loaded = reload(apply(mutation.diagram, root.references[0]))
  const preview = resolveImportedTikzStyle(root.references[0], createImportedTikzResolutionContext(loaded))
  assert.deepEqual(preview.sourceDependencies, [root.source?.id, dependency.source?.id, mutation.source?.id])
  assert.equal(preview.fillColor, '#FF0000', 'dependency discovery does not apply the blue append body')
  assert.equal(preview.textColor, '#FF0000')
  assert.ok(preview.unresolvedFields?.includes('fillColor'))
  assert.ok(preview.unresolvedFields?.includes('textColor'))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded, { exportMode })
    assert.deepEqual(output.match(/%\s+\\input\{[^}]+\}/g)?.map((hint) => hint.replace(/^%\s+/, '')), [
      String.raw`\input{root.sty}`, String.raw`\input{dependency.sty}`, String.raw`\input{mutation.sty}`,
    ])
    assert.doesNotMatch(afterExternal(output, 'myPoint'), /(?:^|,)(?:fill|text)=/)
  }
  const restored = importTikzStyleFile(loaded, 'restored.sty', String.raw`\tikzset{/tikz/myPoint/.style={fill=green,text=green}}`)
  const restoredPreview = resolveImportedTikzStyle(root.references[0], createImportedTikzResolutionContext(reload(restored.diagram)))
  assert.equal(restoredPreview.fillColor, '#00FF00')
  assert.equal(restoredPreview.unresolvedFields, undefined)
  assert.deepEqual(restoredPreview.sourceDependencies, [root.source?.id, restored.source?.id], 'full replacement clears obsolete mutation-only dependencies')
})

for (const dependencyPosition of ['before mutation', 'after mutation']) {
  test(`nested style and literal color mutation dependencies resolve ${dependencyPosition} in source order only`, () => {
    const root = importTikzStyleFile(diagram(), 'root.sty', String.raw`\tikzset{myPoint/.style={fill=red,text=red},/other/myPoint/.style={fill=green}}`)
    const colorsSource = String.raw`\definecolor{ImportedBlue}{HTML}{0000FF}\definecolor{Unknown}{cmyk}{1,0,0,0}\tikzset{unused/.style={text=green}}`
    const nestedSource = String.raw`\tikzset{leaf/.style={draw=ImportedBlue},/tikz/bluePaint/.style={leaf,fill=ImportedBlue,text=ImportedBlue},/other/bluePaint/.style={fill=green}}`
    const mutationSource = String.raw`\tikzset{/tikz/.cd,myPoint/.append style={bluePaint,text=Unknown!50!ImportedBlue},outer/.style={myPoint,text=green}}`
    let next = root.diagram
    const sourceInputs = dependencyPosition === 'before mutation'
      ? [['colors.sty', colorsSource], ['nested.sty', nestedSource], ['mutation.sty', mutationSource]]
      : [['mutation.sty', mutationSource], ['colors.sty', colorsSource], ['nested.sty', nestedSource]]
    for (const [name, source] of sourceInputs) next = importTikzStyleFile(next, name, source).diagram
    const loaded = reload(apply(next, root.references[0]))
    const context = createImportedTikzResolutionContext(loaded)
    const preview = resolveImportedTikzStyle(root.references[0], context)
    assert.deepEqual(preview.sourceDependencies, loaded.externalTikzStyleSources?.map((source) => source.id))
    assert.equal(preview.fillColor, '#FF0000')
    assert.equal(preview.textColor, '#FF0000')
    assert.equal(preview.drawColor, undefined, 'nested blue border is never applied by a dependency scan')
    assert.ok(preview.unresolvedFields?.includes('drawColor'))
    assert.ok(preview.unresolvedFields?.includes('textColor'))
    const outer = resolveTikzPaint('outer', context)
    assert.equal(outer.fillColor, '#FF0000')
    assert.equal(outer.textColor, '#00FF00', 'supported outer text still regains only its own certainty')
    assert.ok(!outer.unresolvedFields?.includes('textColor'))
    assert.ok(outer.unresolvedFields?.includes('fillColor'))
    const distinct = resolveTikzPaint('/other/myPoint', context)
    assert.equal(distinct.fillColor, '#00FF00')
    assert.equal(distinct.unresolvedFields, undefined)
    assert.deepEqual(distinct.sourceDependencies, [root.source?.id])
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const output = generateTikz(loaded, { exportMode })
      const hints = output.match(/%\s+\\input\{[^}]+\}/g)?.map((hint) => hint.replace(/^%\s+/, ''))
      assert.deepEqual(hints, loaded.externalTikzStyleSources?.map((source) => source.loadHint))
      assert.doesNotMatch(afterExternal(output, 'myPoint'), /(?:^|,)(?:fill|text|draw)=/)
    }
  })
}

for (const declaration of [
  String.raw`\tikzset{myPoint/.prefix style={bluePaint}}`,
  String.raw`\tikzset{myPoint/.append style=bluePaint}`,
  String.raw`\tikzset{myPoint/.prefix style=bluePaint}`,
  String.raw`\tikzset{myPoint/.append style/.expanded={bluePaint}}`,
  String.raw`\tikzset{myPoint/.add style={bluePaint}{text=ImportedBlue}}`,
  String.raw`\tikzstyle{myPoint}+=[bluePaint]`,
]) test(`dependency-only scanning handles recognizable style-list mutation ${declaration}`, () => {
  const root = importTikzStyleFile(diagram(), 'root.sty', String.raw`\tikzset{myPoint/.style={fill=red,text=red}}`)
  const dependency = importTikzStyleFile(root.diagram, 'dependency.sty', String.raw`\definecolor{ImportedBlue}{HTML}{0000FF}\tikzset{bluePaint/.style={fill=ImportedBlue,text=ImportedBlue}}`)
  const mutation = importTikzStyleFile(dependency.diagram, 'mutation.sty', `${declaration}\\tikzset{other/.style={text=green}}`)
  const preview = resolveImportedTikzStyle(root.references[0], createImportedTikzResolutionContext(reload(mutation.diagram)))
  assert.deepEqual(preview.sourceDependencies, [root.source?.id, dependency.source?.id, mutation.source?.id])
  assert.equal(preview.fillColor, '#FF0000')
  assert.equal(preview.textColor, '#FF0000')
  assert.ok(preview.unresolvedFields?.includes('fillColor'))
})

test('mutation dependency scanning follows nested invalidated styles and remains bounded on cycles', () => {
  const root = importTikzStyleFile(diagram(), 'root.sty', String.raw`\tikzset{myPoint/.style={fill=red,text=red}}`)
  const nested = importTikzStyleFile(root.diagram, 'nested.sty', String.raw`\tikzset{nested/.style={fill=green},nested/.append style={bluePaint},bluePaint/.style={nested,fill=blue}}`)
  const mutation = importTikzStyleFile(nested.diagram, 'mutation.sty', String.raw`\tikzset{myPoint/.append style={nested},other/.style={text=green}}`)
  const preview = resolveImportedTikzStyle(root.references[0], createImportedTikzResolutionContext(mutation.diagram))
  assert.deepEqual(preview.sourceDependencies, [root.source?.id, nested.source?.id, mutation.source?.id])
  assert.equal(preview.fillColor, '#FF0000')
  assert.ok(preview.unresolvedFields?.includes('fillColor'))
  assert.match(preview.diagnostics?.join() ?? '', /myPoint\/\.append style/)
})
