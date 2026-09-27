import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { createImportedTikzResolutionContext, importTikzStyleFile, resolveImportedTikzStyle } from '../../src/model/importedTikzStyles.ts'
import { resolveTikzPaint, type TikzPaintPreview } from '../../src/model/importedTikzPaint.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, updateUserStylePresetStyle } from '../../src/model/stylePresets.ts'
import { clonePointStyle, getPointPaint } from '../../src/model/styles.ts'
import type { Diagram, HexColor, ImportedTikzStyleReference, PointPaintField, UserPointStylePreset } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

// The external blue result is independently established by PGF, not by this
// resolver. These application tests must never execute the retained TeX body.
const execution = String.raw`/utils/exec={\definecolor{red}{HTML}{0000FF}}`
const exactSource = String.raw`\tikzset{myPoint/.style={/utils/exec={\definecolor{red}{HTML}{0000FF}},text=red}}`
const paintFields = ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity', 'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin']

function diagram(): Diagram {
  const value = createEmptyDiagram({ ambientDimension: 2 })
  value.strata = [createPointStratum({ ambientDimension: 2, id: 'runtime-point', text: '  $F$\r\n  ', position: { x: 0, y: 0, z: 0 } })]
  return value
}
function point(value: Diagram) {
  const result = value.strata[0]
  assert.ok(result?.geometricKind === 'point')
  return result
}
function reference(value: Diagram, key = 'myPoint'): ImportedTikzStyleReference {
  const result = value.importedTikzStyleReferences?.find((entry) => entry.key === key)
  assert.ok(result, `retained reference ${key}`)
  return result
}
function preset(value: Diagram, key = 'myPoint'): UserPointStylePreset {
  const ref = reference(value, key)
  const result = value.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === ref.id)
  assert.ok(result?.kind === 'point')
  return result
}
function apply(value: Diagram, key = 'myPoint'): Diagram {
  return applyUserStylePresetToStratum(value, point(value).id, preset(value, key).id)
}
function reload(value: Diagram): Diagram {
  const result = parseSavedDiagramJson(serializeDiagram(value))
  assert.ok(result.ok)
  return result.diagram
}
function imported(source = exactSource, key = 'myPoint'): Diagram {
  const result = importTikzStyleFile(diagram(), 'runtime.sty', source, String.raw`\input{custom/runtime.sty}`)
  assert.ok(result.source, 'stored execution body does not execute at declaration time')
  assert.deepEqual(result.parseResult.executionDiagnostics ?? [], [])
  assert.equal(result.source.rawSource, source)
  return apply(result.diagram, key)
}
function assertUncertain(preview: TikzPaintPreview): void {
  assert.equal(preview.executionUncertain, true, 'binding and handler uncertainty survives resolution')
  assert.ok(preview.diagnostics?.length, 'invocation uncertainty has a diagnostic')
  for (const field of paintFields) assert.ok(preview.unresolvedFields?.includes(field), `${field} cannot regain certainty after arbitrary execution`)
}
function afterExternal(output: string, key = 'myPoint'): string {
  const block = output.match(/\\node\[([\s\S]*?)\] at/)?.[1]
  assert.ok(block, 'the actual exported point node exists')
  const options = block.split(',').map((part) => part.trim())
  const index = options.indexOf(key)
  assert.notEqual(index, -1, `the actual external key ${key} remains in the node`)
  return options.slice(index + 1).join(',')
}
function assertColor(output: string, tail: string, field: 'text' | 'fill', expected: HexColor): void {
  const name = tail.match(new RegExp(`(?:^|,)${field}=([^,]+)`))?.[1]
  assert.ok(name, `${field} follows the actual external key`)
  const colors = new Map([...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-F]+)\}/g)].map((entry) => [entry[1], `#${entry[2]}`]))
  assert.equal(colors.get(name), expected)
}
function assertUntouched(value: Diagram, key = 'myPoint'): void {
  const context = createImportedTikzResolutionContext(value)
  assert.deepEqual(context.sourceDiagnostics ?? [], [], 'runtime uncertainty is distinct from rejected source execution')
  assertUncertain(resolveImportedTikzStyle(reference(value, key), context))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    assert.equal(afterExternal(output, key), '', `${exportMode}: no uncertain paint follows the external key`)
  }
}
function edit(value: Diagram, field: 'text.color' | 'fill.color', color: HexColor): Diagram {
  return updateStratumStyleById(value, point(value).id, (style) => {
    assert.equal(style.kind, 'pointStyle')
    if (style.kind !== 'pointStyle') return style
    const next = clonePointStyle(style)
    getPointPaint(next)[field === 'text.color' ? 'text' : 'fill'].color = color
    return next
  }, [field])
}
function state(value: Diagram): UndoableEditorState {
  return { editableDiagram: value, selectedElement: { kind: 'stratum', id: 'runtime-point' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(value) }
}

for (const [name, source, key] of [
  ['exact independent reproduction', exactSource, 'myPoint'],
  ['nested style', `\\tikzset{inner/.style={${execution},text=red},myPoint/.style={inner,text=red}}`, 'myPoint'],
  ['alias and return to outer options', `\\tikzset{inner/.style={${execution}},alias/.style={inner},myPoint/.style={alias,text=red,fill=green,draw=blue}}`, 'myPoint'],
  ['absolute key spelling', `\\tikzset{/tikz/group/myPoint/.style={${execution},/tikz/text=red}}`, '/tikz/group/myPoint'],
] as const) test(`runtime execution preserves paint uncertainty through ${name}, application and JSON`, () => {
  const value = imported(source, key)
  assertUntouched(value, key)
  const loaded = reload(value)
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, source)
  assert.equal(loaded.externalTikzStyleSources?.[0].loadHint, String.raw`\input{custom/runtime.sty}`)
  assert.equal(reference(loaded, key).key, key)
  assert.ok(reference(loaded, key).previewDiagnostics?.length)
  assert.deepEqual(reference(reload(loaded), key).previewDiagnostics, reference(loaded, key).previewDiagnostics)
  assert.equal(point(loaded).text, '  $F$\r\n  ')
  assertUntouched(loaded, key)
  assertUntouched(reload(apply(loaded, key)), key)
})

for (const later of [
  'text=red', 'fill=green', 'draw=blue', 'color=red', 'red',
  'text=red!50!blue', 'fill=Custom!50', 'draw=blue!50!Custom', 'color=green!50!blue',
  '/tikz/text=red', '/tikz/fill=green', '/tikz/draw=blue', '/tikz/color=Custom',
  '/tikz/opacity=.5,/tikz/fill opacity=.2,/tikz/draw opacity=.3,/tikz/text opacity=.4',
  '/tikz/line width=2pt,/tikz/dash pattern=on 1pt off 2pt,/tikz/dash phase=1pt,/tikz/line cap=round,/tikz/line join=bevel',
  '/tikz/draw=none,/tikz/fill=none', '/tikz/thick,/tikz/solid',
] as const) test(`later ${later} cannot trust stale bindings or handlers after runtime execution`, () => {
  const source = `\\definecolor{Custom}{HTML}{123456}\\tikzset{myPoint/.style={${execution},${later}}}`
  const value = imported(source)
  assertUntouched(value)
  assertUntouched(reload(value))
})

test('a handler-changing execution payload remains opaque, including an absolute text key', () => {
  // This is a focused risk regression, not an assertion that the supplied
  // independent color-binding PDF demonstrated a second handler-side effect.
  const source = String.raw`\tikzset{myPoint/.style={/utils/exec={\pgfkeys{/tikz/text/.code={\color{blue}}}},/tikz/text=red}}`
  assertUntouched(reload(imported(source)))
})

for (const option of [
  String.raw`font={\definecolor{red}{HTML}{0000FF}}`,
  String.raw`node contents={\definecolor{red}{HTML}{0000FF}APP}`,
  String.raw`\runtimeDirectory/.cd`,
] as const) {
  for (const path of ['body', 'dependency'] as const) test(`${path} retains executable effects from deferred or nonliteral ${option}`, () => {
    const source = path === 'body'
      ? `\\tikzset{myPoint/.style={${option},/tikz/text=red}}`
      : `\\tikzset{base/.style={text=red},base/.append style={${option}},myPoint/.style={base,/tikz/text=red}}`
    assertUntouched(reload(imported(source)))
  })
}

test('runtime handler syntax in a deferred-looking layout key cannot become certain fallback paint', () => {
  const source = String.raw`\tikzset{myPoint/.style={shape aspect/.style={text=blue},shape aspect}}`
  const value = imported(source)
  assertUntouched(value)
  assertUntouched(reload(value))
  assertUntouched(reload(apply(value)))
})

for (const options of [
  'shape aspect/.style={text=blue},shape aspect',
  'shape aspect/ .style={text=blue},shape aspect',
  'shape custom/path',
  String.raw`inner foo/.code={\definecolor{red}{HTML}{0000FF}},inner foo`,
  String.raw`shape \command`,
] as const) {
  for (const path of ['body', 'append style', 'prefix style'] as const) test(`${path} cannot hide runtime handlers in deferred-looking options: ${options}`, () => {
    const source = path === 'body'
      ? `\\tikzset{myPoint/.style={${options},/tikz/text=red}}`
      : `\\tikzset{base/.style={text=red},base/.${path}={${options}},myPoint/.style={base,/tikz/text=red}}`
    const value = imported(source)
    assertUntouched(value)
    assertUntouched(reload(value))
    assertUntouched(reload(apply(value)))
  })
}

test('ordinary literal deferred layout options retain supported paint recovery', () => {
  const source = String.raw`\tikzset{myPoint/.style={shape aspect=2,inner sep=3pt,minimum width=4pt,/tikz/text=red}}`
  const value = reload(imported(source))
  const preview = resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value))
  assert.equal(preview.executionUncertain, undefined)
  assert.equal(preview.textColor, '#FF0000')
  assert.ok(!preview.unresolvedFields?.includes('textColor'))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    assertColor(output, afterExternal(output), 'text', '#FF0000')
  }
})

for (const handler of ['append style', 'prefix style'] as const) test(`a retained .${handler} list cannot ignore trailing executable value tokens`, () => {
  const source = `\\tikzset{base/.style={text=red},base/.${handler}={text=blue}\\runtimeEffect,myPoint/.style={base,/tikz/text=red}}`
  const original = diagram()
  const result = importTikzStyleFile(original, 'trailing.sty', source)
  if (result.source === null) {
    assert.equal(result.diagram, original, 'unsupported source execution rejects atomically')
    assert.ok(result.parseResult.executionDiagnostics?.length)
  } else {
    assert.equal(result.source.rawSource, source)
    assertUntouched(reload(apply(result.diagram)))
  }
})

for (const mutation of [
  `.append style={${execution}}`, `.prefix style={${execution}}`, `.add style={${execution}}{text=red}`,
  '.append style={nested}', '.prefix style={nested}', '.add style={nested}{text=red}',
  String.raw`.code={\definecolor{red}{HTML}{0000FF}}`,
  String.raw`.append code={\definecolor{red}{HTML}{0000FF}}`,
  String.raw`.prefix code={\definecolor{red}{HTML}{0000FF}}`,
] as const) test(`retained runtime mutation ${mutation} poisons outer certainty and retains source hints`, () => {
  const first = importTikzStyleFile(diagram(), 'base.sty', String.raw`\tikzset{base/.style={text=red}}`)
  const nested = importTikzStyleFile(first.diagram, 'nested.sty', `\\tikzset{nested/.style={${execution}}}`)
  const last = importTikzStyleFile(nested.diagram, 'mutation.sty', `\\tikzset{base/${mutation},myPoint/.style={base,/tikz/text=red,/tikz/fill=green}}`)
  assert.ok(last.source)
  const value = reload(apply(last.diagram))
  assertUntouched(value)
  const preview = resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value))
  assert.ok(preview.sourceDependencies?.includes(first.source!.id))
  assert.ok(preview.sourceDependencies?.includes(last.source.id))
  if (mutation.includes('nested')) assert.ok(preview.sourceDependencies?.includes(nested.source!.id))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    const hints = output.match(/%\s+\\input\{[^}]+\}/g)?.map((hint) => hint.replace(/^%\s+/, ''))
    const required = value.externalTikzStyleSources?.filter((source) => preview.sourceDependencies?.includes(source.id)).map((source) => source.loadHint)
    assert.deepEqual(hints, required, 'required external sources remain in their original load order')
  }
})

test('a directory change in a retained mutation does not hide later executable dependencies', () => {
  const source = `\\tikzset{base/.style={text=red},base/.append style={/other/.cd,${execution}},myPoint/.style={base,/tikz/text=red}}`
  assertUntouched(reload(imported(source)))
})

for (const [name, declarations] of [
  ['ordinary body', 'myPoint/.style={/other/.cd,text=ignored,/tikz/text=red}'],
  ['single append list', 'base/.style={text=red},base/.append style={/other/.cd,text=ignored},myPoint/.style={base,/tikz/text=red}'],
  ['separate append lists', 'base/.style={text=red},base/.append style={/other/.cd},base/.append style={text=ignored},myPoint/.style={base,/tikz/text=red}'],
  ['prefix before original body', 'base/.style={text=ignored},base/.prefix style={/other/.cd},myPoint/.style={base,/tikz/text=red}'],
  ['two prefixes', 'base/.style={text=ignored},base/.prefix style={text=ignored},base/.prefix style={/other/.cd},myPoint/.style={base,/tikz/text=red}'],
  ['reversed prefixes', 'base/.style={text=ignored},base/.prefix style={/other/.cd},base/.prefix style={text=ignored},myPoint/.style={base,/tikz/text=red}'],
] as const) test(`namespaced runtime handlers remain executable after directory uncertainty in ${name}`, () => {
  // This application regression does not claim an additional PGF observation.
  const source = String.raw`\tikzset{/other/text/.code={\definecolor{red}{HTML}{0000FF}},` + declarations + '}'
  const value = imported(source)
  assertUntouched(value)
  assertUntouched(reload(value))
  assertUntouched(reload(apply(value)))
})

test('a supported namespaced style after a directory change preserves absolute-option recovery', () => {
  const source = String.raw`\tikzset{/other/text/.style={/tikz/text=blue},myPoint/.style={/other/.cd,text=ignored,/tikz/text=red}}`
  const value = imported(source)
  const preview = resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value))
  assert.equal(preview.executionUncertain, undefined)
  assert.equal(preview.textColor, '#FF0000')
  assert.ok(!preview.unresolvedFields?.includes('textColor'))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(reload(value), { exportMode })
    assertColor(output, afterExternal(output), 'text', '#FF0000')
  }
})

for (const body of ['font=ignored,text=red', 'nested,/tikz/text=red'] as const) test(`assigned executable layout handler cannot restore outer paint: ${body}`, () => {
  const source = String.raw`\tikzset{font/.code={\definecolor{red}{HTML}{0000FF}},nested/.style={font=ignored},myPoint/.style={` + body + '}}'
  assertUntouched(reload(imported(source)))
})

for (const position of ['body', 'dependency'] as const) {
  for (const bound of ['input', 'depth', 'work'] as const) test(`${position} ${bound} bound cannot make unvisited executable effects certain through outer absolute paint`, () => {
    let body: string
    const declarations: string[] = []
    if (bound === 'input') body = `font={${'x'.repeat(100_001)}},${execution}`
    else if (bound === 'work') body = `${Array<string>(4097).fill('text=red').join(',')},${execution}`
    else {
      for (let index = 0; index < 20; index += 1) declarations.push(`level${index}/.style={${index === 19 ? execution : `level${index + 1}`}}`)
      body = 'level0'
    }
    if (position === 'body') declarations.push(`base/.style={${body}}`)
    else declarations.push('base/.style={text=red}', `base/.append style={${body}}`)
    declarations.push('myPoint/.style={base,/tikz/text=red,/tikz/fill=green}')
    const source = `\\tikzset{${declarations.join(',')}}`
    const value = imported(source)
    const preview = resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value))
    assert.match(preview.diagnostics?.join() ?? '', /bound/)
    assertUntouched(value)
    assertUntouched(reload(value))
  })
}

for (const provenance of ['recorded', 'legacy'] as const) test(`stale ${provenance} point/preset/reference snapshots cannot restore runtime certainty`, () => {
  const stale = imported(String.raw`\tikzset{myPoint/.style={text=red,fill=green}}`)
  assert.equal(getPointPaint(point(stale).style).text.color, '#FF0000')
  stale.externalTikzStyleSources![0].rawSource = exactSource
  reference(stale).previewDiagnostics = ['Retained saved diagnostic.']
  if (provenance === 'legacy') {
    delete point(stale).style.importedPaint
    delete preset(stale).style.importedPaint
  }
  assert.equal(reference(stale).options, 'text=red,fill=green')
  assertUntouched(stale)
  const loaded = reload(stale)
  assertUntouched(loaded)
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, exactSource)
  assert.ok(reference(loaded).previewDiagnostics?.includes('Retained saved diagnostic.'))
  assert.ok(reference(loaded).previewDiagnostics!.length > 1)
  assertUntouched(reload(apply(loaded)))
})

test('a legacy retained reference without raw source still carries executable-option uncertainty', () => {
  const value = imported()
  delete value.externalTikzStyleSources![0].rawSource
  delete point(value).style.importedPaint
  delete preset(value).style.importedPaint
  assert.equal(reference(value).options, `${execution},text=red`)
  assertUntouched(value)
  assertUntouched(reload(value))
  assertUntouched(reload(apply(value)))
})

test('snapshot value differences alone cannot claim local intent after runtime execution', () => {
  const stale = imported()
  getPointPaint(point(stale).style).text.color = '#FF0000'
  getPointPaint(point(stale).style).fill.color = '#00FF00'
  assert.deepEqual(point(stale).style.importedPaint?.overriddenFields, [])
  assertUntouched(stale)
  const loaded = reload(stale)
  assertUntouched(loaded)
  assertUntouched(reload(apply(loaded)))
  // Accepting a text control with that same stale visible value is new,
  // explicit intent; the unrelated stale fill must still stay external.
  const edited = reload(edit(loaded, 'text.color', '#FF0000'))
  assert.deepEqual(point(edited).style.importedPaint?.overriddenFields, ['text.color'])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(edited, { exportMode })
    const tail = afterExternal(output)
    assertColor(output, tail, 'text', '#FF0000')
    assert.equal(tail.split(',').length, 1)
  }
})

test('exact CRLF source, key spelling and diagnostics survive reload and existing-preset reapplication', () => {
  const source = `% retained comment\r\n\\tikzset{/tikz/group/myPoint/.style={${execution},\r\n/tikz/text=red}}\r\n`
  const original = imported(source, '/tikz/group/myPoint')
  const loaded = reload(apply(reload(original), '/tikz/group/myPoint'))
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, source)
  assert.deepEqual(reference(loaded, '/tikz/group/myPoint').previewDiagnostics, reference(original, '/tikz/group/myPoint').previewDiagnostics)
  assertUntouched(loaded, '/tikz/group/myPoint')
})

for (const values of ['changed', 'fallback-equal'] as const) test(`explicit ${values} text/fill edits survive history and persistence while untouched channels stay external`, () => {
  const original = imported()
  const paint = getPointPaint(point(original).style)
  const expected = values === 'fallback-equal' ? { text: paint.text.color, fill: paint.fill.color } : { text: '#123456' as const, fill: '#654321' as const }
  const before = serializeDiagram(original)
  let current = state(original)
  current = commitDiagramChange(current, { ...current, editableDiagram: edit(current.editableDiagram, 'text.color', expected.text) })
  current = commitDiagramChange(current, { ...current, editableDiagram: edit(current.editableDiagram, 'fill.color', expected.fill) })
  assert.equal(current.history.past.length, 2)
  assert.deepEqual(point(current.editableDiagram).style.importedPaint?.overriddenFields, ['text.color', 'fill.color'])
  const undone = undoLastDiagramChange(current)
  assert.deepEqual(point(undone.editableDiagram).style.importedPaint?.overriddenFields, ['text.color'])
  assert.equal(serializeDiagram(undoLastDiagramChange(undone).editableDiagram), before)
  const loaded = reload(redoLastDiagramChange(undone).editableDiagram)
  assertUncertain(resolveImportedTikzStyle(reference(loaded), createImportedTikzResolutionContext(loaded)))
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, exactSource)
  assert.equal(serializeDiagram(original), before, 'history leaves the source and baseline immutable')
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded, { exportMode })
    const tail = afterExternal(output)
    assertColor(output, tail, 'text', expected.text)
    assertColor(output, tail, 'fill', expected.fill)
    assert.equal(tail.split(',').length, 2, 'only explicit local channels follow the actual external key')
  }
  assertUntouched(reload(apply(loaded)))
})

test('an equal-valued imported-preset edit records local intent independently of stale preview equality', () => {
  const original = imported()
  const importedPreset = preset(original)
  const expected = getPointPaint(importedPreset.style).text.color
  const fields: PointPaintField[] = ['text.color']
  const edited = reload(updateUserStylePresetStyle(original, importedPreset.id, importedPreset.style, fields))
  assert.deepEqual(preset(edited).style.importedPaint?.overriddenFields, fields)
  const applied = reload(apply(edited))
  assert.deepEqual(point(applied).style.importedPaint?.overriddenFields, fields)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(applied, { exportMode })
    const tail = afterExternal(output)
    assertColor(output, tail, 'text', expected)
    assert.equal(tail.split(',').length, 1)
  }
})

test('runtime certainty is local to each resolution and a full replacement can recover supported literal paint', () => {
  const original = imported(exactSource + String.raw`\tikzset{independent/.style={fill=green,text=blue}}`)
  const context = createImportedTikzResolutionContext(original)
  assertUncertain(resolveImportedTikzStyle(reference(original), context))
  const independent = resolveTikzPaint('independent', context)
  assert.equal(independent.textColor, '#0000FF')
  assert.equal(independent.fillColor, '#00FF00')
  assert.equal(independent.unresolvedFields, undefined)
  const replacement = importTikzStyleFile(original, 'replacement.sty', String.raw`\tikzset{myPoint/.style={text=blue,fill=green}}`)
  const loaded = reload(replacement.diagram)
  const restored = resolveImportedTikzStyle(reference(loaded), createImportedTikzResolutionContext(loaded))
  assert.equal(restored.textColor, '#0000FF')
  assert.equal(restored.fillColor, '#00FF00')
  assert.equal(restored.unresolvedFields, undefined)
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, original.externalTikzStyleSources?.[0].rawSource)
})

for (const provenance of ['tracked', 'legacy'] as const) {
  for (const explicit of [false, true]) test(`${provenance} recovery from runtime uncertainty preserves ${explicit ? 'recorded text intent only' : 'no inferred stale snapshot intent'}`, () => {
    let stale = imported()
    for (const style of [point(stale).style, preset(stale).style]) {
      style.shape = 'square'
      style.size = 12
      getPointPaint(style).text.color = '#FF0000'
      getPointPaint(style).fill.color = '#0000FF'
      if (provenance === 'legacy') delete style.importedPaint
      else assert.deepEqual(style.importedPaint?.overriddenFields, [])
    }
    assertUncertain(resolveImportedTikzStyle(reference(stale), createImportedTikzResolutionContext(stale)))
    if (explicit) stale = edit(stale, 'text.color', '#FF0000')
    const replacement = importTikzStyleFile(stale, 'recovered.sty', String.raw`\tikzset{myPoint/.style={text=green,fill=yellow}}`)
    assert.ok(replacement.source)
    const loaded = reload(replacement.diagram)
    const expectedText = explicit ? '#FF0000' : '#00FF00'
    for (const style of [point(loaded).style, preset(loaded).style]) {
      assert.equal(style.shape, 'square', 'paint recovery preserves authored point and preset geometry')
      assert.equal(style.size, 12)
    }
    assert.equal(getPointPaint(point(loaded).style).text.color, expectedText)
    assert.equal(getPointPaint(point(loaded).style).fill.color, '#FFFF00')
    assert.deepEqual(point(loaded).style.importedPaint?.overriddenFields, explicit ? ['text.color'] : [])
    assert.equal(getPointPaint(preset(loaded).style).text.color, '#00FF00', 'old preset fallback cannot become an edit')
    assert.equal(getPointPaint(preset(loaded).style).fill.color, '#FFFF00')
    assert.deepEqual(preset(loaded).style.importedPaint?.overriddenFields, [])
    assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, exactSource)
    const preview = resolveImportedTikzStyle(reference(loaded), createImportedTikzResolutionContext(loaded))
    assert.equal(preview.executionUncertain, undefined)
    assert.equal(preview.unresolvedFields, undefined)
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const output = generateTikz(loaded, { exportMode })
      const tail = afterExternal(output)
      assertColor(output, tail, 'text', expectedText)
      assertColor(output, tail, 'fill', '#FFFF00')
      const reapplied = generateTikz(reload(apply(loaded)), { exportMode })
      assertColor(reapplied, afterExternal(reapplied), 'text', '#00FF00')
    }
  })
}

for (const provenance of ['tracked', 'legacy'] as const) {
  for (const explicit of [false, true]) test(`${provenance} supported recovery ${explicit ? 'preserves recorded' : 'resets unrecorded'} overall opacity`, () => {
    let stale = imported()
    for (const style of [point(stale).style, preset(stale).style]) {
      style.opacity = .3
      if (provenance === 'legacy') delete style.importedPaint
      else assert.deepEqual(style.importedPaint?.overriddenFields, [])
    }
    if (explicit) {
      stale = updateStratumStyleById(stale, point(stale).id, (style) => style, ['opacity'])
      stale = updateUserStylePresetStyle(stale, preset(stale).id, preset(stale).style, ['opacity'])
    }
    const replacement = importTikzStyleFile(stale, 'recovered-opacity.sty', String.raw`\tikzset{myPoint/.style={text=green,fill=yellow,draw=blue}}`)
    assert.ok(replacement.source)
    const loaded = reload(replacement.diagram)
    const expected = explicit ? .3 : 1
    for (const style of [point(loaded).style, preset(loaded).style]) {
      assert.equal(style.opacity, expected)
      assert.deepEqual(style.importedPaint?.overriddenFields, explicit ? ['opacity'] : [])
    }
    for (const value of [loaded, reload(apply(loaded))]) {
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const tail = afterExternal(generateTikz(value, { exportMode }))
        for (const key of ['fill opacity', 'draw opacity', 'text opacity']) {
          const opacity = tail.split(',').find((option) => option.startsWith(`${key}=`))
          assert.equal(opacity, `${key}=${expected}`, 'only recorded overall opacity can multiply recovered paint')
        }
      }
    }
  })
}

test('ordinary invalid literals, paint-only mutation and directory-only uncertainty retain justified recovery', () => {
  const literal = resolveTikzPaint('text=invalid,fill opacity=2,text=red,fill opacity=.3')
  assert.equal(literal.textColor, '#FF0000')
  assert.equal(literal.fillOpacity, .3)
  assert.equal(literal.unresolvedFields, undefined)
  const source = String.raw`\tikzset{base/.style={text=blue},base/.append style={fill=green},myPoint/.style={base,text=red}}`
  const value = imported(source)
  const paintOnly = resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value))
  assert.equal(paintOnly.textColor, '#FF0000')
  assert.ok(!paintOnly.unresolvedFields?.includes('textColor'))
  assert.ok(paintOnly.unresolvedFields?.includes('fillColor'))
  const directory = resolveTikzPaint('/other/.cd,/tikz/text=red,/tikz/fill=green')
  assert.equal(directory.textColor, '#FF0000')
  assert.equal(directory.fillColor, '#00FF00')
  assert.ok(!directory.unresolvedFields?.includes('textColor'))
  assert.ok(!directory.unresolvedFields?.includes('fillColor'))
})

for (const exportMode of ['standalone', 'inlineMath'] as const) test(`${exportMode} current runtime exports match compiled PGF fixtures and actual text/fill operators`, () => {
  const fixture = new URL('../fixtures/point-paint-pgf/execution-boundary/runtime-execution/', import.meta.url)
  const raw = readFileSync(new URL('runtime.sty', fixture), 'utf8')
  assert.equal(raw, exactSource)
  assert.equal(raw, readFileSync(new URL('before/runtime.sty', fixture), 'utf8'), 'the external source is the identical independent input')
  const original = createEmptyDiagram({ ambientDimension: 2 })
  original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
  const applied = apply(importTikzStyleFile(original, 'runtime.sty', raw).diagram)
  const stale = parseSavedDiagramJson(readFileSync(new URL('runtime-stale.json', fixture), 'utf8'))
  assert.ok(stale.ok)
  const fallback = getPointPaint(point(applied).style)
  const variants: { name: string; value: Diagram; local?: { field: 'text' | 'fill'; color: HexColor } }[] = [
    { name: 'untouched', value: applied },
    { name: 'reloaded', value: reload(applied) },
    { name: 'stale-reloaded', value: stale.diagram },
    { name: 'preset-reapplied', value: reload(apply(stale.diagram)) },
    { name: 'local-text-red', value: reload(edit(applied, 'text.color', '#FF0000')), local: { field: 'text', color: '#FF0000' } },
    { name: 'local-text-fallback', value: reload(edit(applied, 'text.color', fallback.text.color)), local: { field: 'text', color: '#000000' } },
    { name: 'local-fill-yellow', value: reload(edit(applied, 'fill.color', '#FFFF00')), local: { field: 'fill', color: '#FFFF00' } },
    { name: 'local-fill-fallback', value: reload(edit(applied, 'fill.color', fallback.fill.color)), local: { field: 'fill', color: '#000000' } },
  ]
  for (const { name, value, local } of variants) {
    assert.equal(value.externalTikzStyleSources?.[0].rawSource, raw)
    assertUncertain(resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value)))
    const output = generateTikz(value, { exportMode })
    assert.equal(output, readFileSync(new URL(`${name}-${exportMode}.tex`, fixture), 'utf8'), `${name}: production output equals the actual independently compiled bytes`)
    const tail = afterExternal(output)
    if (local === undefined) assert.equal(tail, '')
    else {
      assertColor(output, tail, local.field, local.color)
      assert.equal(tail.split(',').length, 1, 'only the intentional local channel follows the external key')
    }
  }
  const log = readFileSync(new URL(`runtime-${exportMode}.log.txt`, fixture), 'utf8')
  assert.match(log, /STZ-PGF-VERSION=3\.1\.11a/)
  assert.match(log, /pdfTeX.*1\.40\.29/)
  const actual = pdfPaint(new URL(`runtime-${exportMode}.pdf`, fixture))
  assert.deepEqual(actual.map((node) => node.body), ['PGF', ...Array<string>(8).fill('APP')])
  assert.deepEqual(actual.map((node) => node.textOperator), [
    '0 0 1 rg', '0 0 1 rg', '0 0 1 rg', '0 0 1 rg', '0 0 1 rg', '1 0 0 rg', '0 0 0 rg', '0 0 1 rg', '0 0 1 rg',
  ], 'external and untouched text stay blue; explicit red/black text retains the requested color')
  assert.deepEqual(actual.map((node) => node.fillOperator), [undefined, ...Array<string>(6).fill('0 0 0 rg'), '1 1 0 rg', '0 0 0 rg'], 'explicit yellow and fallback-equal black fills survive real PGF compilation')
  const failed = pdfPaint(new URL('before/probe.pdf', fixture))
  assert.deepEqual(failed.map((node) => node.body), ['PGF', 'APP', 'APP'])
  assert.deepEqual(failed.map((node) => node.textOperator), ['0 0 1 rg', '1 0 0 rg', '1 0 0 rg'], 'original failed independent PDF evidence remains intact')
})

function pdfPaint(file: URL): { body: string; textOperator: string; fillOperator?: string }[] {
  const pdf = readFileSync(file).toString('latin1')
  const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => match[1]).filter((stream) => stream.includes('[(PGF)]TJ'))
  assert.equal(streams.length, 1, 'one actual uncompressed PDF stream contains the comparison nodes')
  const stream = streams[0]
  const latestPaint = (prefix: string) => [...prefix.matchAll(/(?:^|\s)([\d.]+ [\d.]+ [\d.]+ rg)(?=\s)/g)].at(-1)?.[1]
  let previousEnd = 0
  return [...stream.matchAll(/\[\((PGF|APP)\)\]TJ/g)].map((match) => {
    const prefix = stream.slice(previousEnd, match.index)
    previousEnd = match.index + match[0].length
    const textOperator = latestPaint(prefix)
    assert.ok(textOperator, 'actual PDF records a text color before this node')
    const fill = [...prefix.matchAll(/(?:^|\s)B(?=\s)/g)].at(-1)
    return { body: match[1], textOperator, ...(fill === undefined ? {} : { fillOperator: latestPaint(prefix.slice(0, fill.index)) }) }
  })
}
