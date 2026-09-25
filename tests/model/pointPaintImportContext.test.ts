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
