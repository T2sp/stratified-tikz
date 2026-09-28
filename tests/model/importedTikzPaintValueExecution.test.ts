import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { resolveTikzPaint, type TikzPaintPreview, type TikzPreviewContext } from '../../src/model/importedTikzPaint.ts'
import { createImportedTikzResolutionContext, importTikzStyleFile, resolveImportedTikzStyle } from '../../src/model/importedTikzStyles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, updateUserStylePresetStyle } from '../../src/model/stylePresets.ts'
import { clonePointStyle, getPointPaint } from '../../src/model/styles.ts'
import type { Diagram, HexColor } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

// Only the exact width payload has independent PGF evidence. Other families
// establish the conservative classification boundary; they never execute TeX.
const executableWidth = String.raw`line width={+1pt\relax\globalcolorstrue\definecolor{red}{HTML}{0000FF}}`
const exactSource = String.raw`\tikzset{myPoint/.style={line width={+1pt\relax\globalcolorstrue\definecolor{red}{HTML}{0000FF}},text=red}}`
const paintFields = ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity', 'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin']

function diagram(): Diagram {
  const value = createEmptyDiagram({ ambientDimension: 2 })
  value.strata = [createPointStratum({ ambientDimension: 2, id: 'value-point', text: '  $F$\r\n  ', position: { x: 0, y: 0, z: 0 } })]
  return value
}
function point(value: Diagram) {
  const result = value.strata[0]
  assert.ok(result?.geometricKind === 'point')
  return result
}
function reference(value: Diagram, key = 'myPoint') {
  const result = value.importedTikzStyleReferences?.find((entry) => entry.key === key)
  assert.ok(result, `retained reference ${key}`)
  return result
}
function preset(value: Diagram, key = 'myPoint') {
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
  const result = importTikzStyleFile(diagram(), 'value-runtime.sty', source, String.raw`\input{custom/value-runtime.sty}`)
  assert.ok(result.source, 'the stored value remains opaque at declaration time')
  assert.deepEqual(result.parseResult.executionDiagnostics ?? [], [])
  assert.equal(result.source.rawSource, source)
  return apply(result.diagram, key)
}
function assertUncertain(preview: TikzPaintPreview): void {
  assert.equal(preview.executionUncertain, true)
  assert.match(preview.diagnostics?.join('\n') ?? '', /executable.*(?:value|option)|execution/i)
  assert.match(preview.diagnostics?.join('\n') ?? '', /bindings.*handlers.*unknown/)
  for (const field of paintFields) assert.ok(preview.unresolvedFields?.includes(field), `${field} remains uncertain after an executable value`)
}
function afterExternal(output: string, key = 'myPoint'): string {
  const block = output.match(/\\node\[([\s\S]*?)\] at/)?.[1]
  assert.ok(block, 'actual exported application node')
  const options = block.split(',').map((part) => part.trim())
  const index = options.indexOf(key)
  assert.notEqual(index, -1, `external reference spelling ${key} is preserved`)
  return options.slice(index + 1).join(',')
}
function assertColor(output: string, tail: string, field: 'text' | 'fill', expected: HexColor): void {
  const name = tail.match(new RegExp(`(?:^|,)${field}=([^,]+)`))?.[1]
  assert.ok(name, `${field} follows the external key`)
  const colors = new Map([...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-F]+)\}/g)].map((entry) => [entry[1], `#${entry[2]}`]))
  assert.equal(colors.get(name), expected)
}
function assertUntouched(value: Diagram, key = 'myPoint'): void {
  const context = createImportedTikzResolutionContext(value)
  assert.deepEqual(context.sourceDiagnostics ?? [], [], 'invocation uncertainty is distinct from rejected source')
  assertUncertain(resolveImportedTikzStyle(reference(value, key), context))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    assert.equal(afterExternal(output, key), '', `${exportMode}: untouched paint stays external`)
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
  return { editableDiagram: value, selectedElement: { kind: 'stratum', id: 'value-point' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(value) }
}

test('exact +1pt executable width invalidates handlers and bindings before literal dimension parsing', () => {
  const direct = resolveTikzPaint(`${executableWidth},text=red`, { sourceIds: ['external-source', 'color-source'] })
  assertUncertain(direct)
  assert.equal(direct.textColor, undefined, 'the following color cannot use stale built-in red')
  assert.equal(direct.lineWidth, undefined, 'the importer must not accept only the leading +1pt')
  assert.deepEqual(direct.sourceDependencies, ['external-source', 'color-source'])
  assert.match(direct.diagnostics?.join('\n') ?? '', /line width=\{\+1pt\\relax\\globalcolorstrue\\definecolor\{red\}\{HTML\}\{0000FF\}\}/)
  const value = imported()
  assert.equal(reference(value).options, `${executableWidth},text=red`)
  assertUntouched(value)
  assertUntouched(reload(value))
})

// Every recognized value family and supported alias passes the same bounded
// rule, including keys normally used without values (thickness/line style).
const recognized = [
  ['line width', '+1pt'], ['dash phase', '-1pt'],
  ['opacity', '.5'], ['fill opacity', '.5'], ['draw opacity', '.5'], ['text opacity', '.5'],
  ['color', 'red!50!blue'], ['text', 'red'], ['fill', 'red!50'], ['draw', 'blue'],
  ['dash pattern', 'on 1pt off 2pt'], ['line cap', 'round'], ['cap', 'butt'], ['line join', 'bevel'], ['join', 'miter'],
  ['ultra thin', ''], ['very thin', ''], ['thin', ''], ['semithick', ''], ['thick', ''], ['very thick', ''], ['ultra thick', ''],
  ['solid', ''], ['dashed', ''], ['dotted', ''], ['densely dotted', ''],
] as const

for (const [key, literal] of recognized) {
  for (const absolute of [false, true]) {
    for (const braced of [false, true]) {
      for (const path of ['ordinary', 'dependency'] as const) test(`${path}: ${absolute ? '/tikz/' : ''}${key} detects ${braced ? 'braced' : 'unbraced'} executable values`, () => {
        const spelling = `${absolute ? '/tikz/' : ''}${key.replaceAll(' ', '  ')}`
        const value = `${literal}\\runtimeEffect`
        const option = `${spelling}=${braced ? `{${value}}` : value}`
        const context: TikzPreviewContext = { sourceIds: ['base-source', 'value-source'] }
        if (path === 'dependency') context.styles = [{
          key: 'base', options: 'text=green', state: 'unresolved', diagnostics: ['Retained list requires external evaluation.'], dependencyOptions: [option],
        }]
        const preview = resolveTikzPaint(`${path === 'ordinary' ? option : 'base'},text=red,/tikz/text=red,/tikz/fill=green`, context)
        assertUncertain(preview)
        assert.notEqual(preview.textColor, '#FF0000', 'neither relative nor absolute text may restore stale red')
        assert.deepEqual(preview.sourceDependencies, ['base-source', 'value-source'])
      })
    }
  }
}

for (const token of [String.raw`\arbitraryMacro`, '#1', '~', '^', '$', '&', '%'] as const) {
  for (const key of ['line width', 'opacity', 'text', 'dash pattern', 'cap', 'join'] as const) test(`${key} keeps executable token ${token} opaque`, () => {
    assertUncertain(resolveTikzPaint(`${key}={${token}},/tikz/text=red`))
  })
}

for (const later of ['text=red', '/tikz/text=red'] as const) {
  for (const [name, declarations] of [
    ['nested alias', `inner/.style={${executableWidth}},alias/.style={inner},myPoint/.style={alias,${later}}`],
    ['append list', `base/.style={text=green},base/.append style={${executableWidth}},myPoint/.style={base,${later}}`],
    ['prefix list', `base/.style={text=green},base/.prefix style={${executableWidth}},myPoint/.style={base,${later}}`],
    ['nested retained append', `inner/.style={${executableWidth}},alias/.style={inner},base/.style={text=green},base/.append style={alias},myPoint/.style={base,${later}}`],
    ['nested retained prefix', `inner/.style={${executableWidth}},alias/.style={inner},base/.style={text=green},base/.prefix style={alias},myPoint/.style={base,${later}}`],
    ['unknown directory body', `myPoint/.style={/other/.cd,${executableWidth},${later}}`],
    ['unknown directory append', `base/.style={text=green},base/.append style={/other/.cd,${executableWidth}},myPoint/.style={base,${later}}`],
    ['unknown directory separate lists', `base/.style={text=green},base/.append style={/other/.cd},base/.append style={${executableWidth}},myPoint/.style={base,${later}}`],
    ['unknown directory prefix before body', `base/.style={${executableWidth}},base/.prefix style={/other/.cd},myPoint/.style={base,${later}}`],
    ['unknown directory absolute value', `base/.style={text=green},base/.prefix style={/other/.cd,/tikz/${executableWidth}},myPoint/.style={base,${later}}`],
  ] as const) test(`${name} preserves value execution uncertainty on return to ${later}`, () => {
    const source = `\\tikzset{${declarations}}`
    const value = imported(source)
    assertUntouched(value)
    assertUntouched(reload(value))
    assertUntouched(reload(apply(value)))
    assert.equal(reload(value).externalTikzStyleSources?.[0].rawSource, source)
  })
}

test('dependency-only nested values retain every source hint in original load order', () => {
  const first = importTikzStyleFile(diagram(), 'base.sty', String.raw`\tikzset{base/.style={text=red}}`)
  const nested = importTikzStyleFile(first.diagram, 'nested.sty', `\\tikzset{nested/.style={${executableWidth}}}`)
  const last = importTikzStyleFile(nested.diagram, 'mutation.sty', String.raw`\tikzset{base/.append style={nested},myPoint/.style={base,/tikz/text=red}}`)
  assert.ok(first.source && nested.source && last.source)
  const value = reload(apply(last.diagram))
  const preview = resolveImportedTikzStyle(reference(value), createImportedTikzResolutionContext(value))
  assertUncertain(preview)
  assert.deepEqual(preview.sourceDependencies, [first.source.id, nested.source.id, last.source.id])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    assert.equal(afterExternal(output), '')
    assert.deepEqual(output.match(/%\s+\\input\{[^}]+\}/g)?.map((hint) => hint.replace(/^%\s+/, '')), value.externalTikzStyleSources?.map((source) => source.loadHint))
  }
})

for (const [key, invalid, valid, fields, field, expected] of [
  ['line width', 'wide', '+2pt', ['lineWidth'], 'lineWidth', 2],
  ['opacity', '2', '.3', ['fillOpacity', 'drawOpacity'], 'opacity', .3],
  ['fill opacity', '-1', '.4', ['fillOpacity'], 'fillOpacity', .4],
  ['text opacity', 'opaque', '.6', ['textOpacity'], 'textOpacity', .6],
  ['text', 'unsupportedPlainColor', 'red', ['textColor'], 'textColor', '#FF0000'],
  ['fill', 'unsupportedPlainColor', 'blue', ['fillColor', 'fillEnabled'], 'fillColor', '#0000FF'],
  ['dash phase', 'later', '-1pt', ['dashPhase'], 'dashPhase', -1],
  ['cap', 'unknown', 'round', ['lineCap'], 'lineCap', 'round'],
  ['join', 'unknown', 'bevel', ['lineJoin'], 'lineJoin', 'bevel'],
] as const) {
  for (const braced of [false, true]) test(`${key}: ${braced ? 'braced' : 'plain'} ordinary invalid literal remains field-specific and permits later recovery`, () => {
    const option = `${key}=${braced ? `{${invalid}}` : invalid}`
    const failed = resolveTikzPaint(option)
    assert.equal(failed.executionUncertain, undefined)
    assert.deepEqual(failed.unresolvedFields, fields)
    assert.deepEqual(failed.diagnostics, [`Unsupported or invalid preview option: ${option}`])
    const recovered = resolveTikzPaint(`${option},/tikz/${key}={${valid}},text={red}`)
    assert.equal(recovered.executionUncertain, undefined)
    assert.equal(recovered.unresolvedFields, undefined)
    assert.equal(recovered[field], expected)
    assert.equal(recovered.textColor, '#FF0000')
    assert.deepEqual(recovered.diagnostics, failed.diagnostics)
  })
}

test('valid braced paint values, mixtures and normalized aliases do not imply execution', () => {
  const preview = resolveTikzPaint('/tikz/line  width={+1pt},/tikz/opacity={.5},/tikz/fill opacity={.2},draw opacity={.3},text opacity={.4},fill={green},draw={blue},text={red!50!blue},dash pattern={on 1pt off 2pt},dash phase={-1pt},cap={round},join={bevel}')
  assert.equal(preview.executionUncertain, undefined)
  assert.equal(preview.diagnostics, undefined)
  assert.equal(preview.unresolvedFields, undefined)
  assert.equal(preview.lineWidth, 1)
  assert.equal(preview.opacity, .5)
  assert.equal(preview.fillOpacity, .2)
  assert.equal(preview.drawOpacity, .3)
  assert.equal(preview.textOpacity, .4)
  assert.equal(preview.fillColor, '#00FF00')
  assert.equal(preview.drawColor, '#0000FF')
  assert.equal(preview.textColor, '#800080')
  assert.deepEqual(preview.dashPattern, [1, 2])
  assert.equal(preview.dashPhase, -1)
  assert.equal(preview.lineCap, 'round')
  assert.equal(preview.lineJoin, 'bevel')
})

test('exact raw CRLF, reference spelling, external load hint and diagnostics survive preset reapplication and JSON', () => {
  const key = '/tikz/group/myPoint'
  const source = `% retained comment\r\n\\tikzset{${key}/.style={${executableWidth},\r\n/tikz/text=red}}\r\n`
  const original = imported(source, key)
  const loaded = reload(apply(reload(original), key))
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, source)
  assert.equal(loaded.externalTikzStyleSources?.[0].loadHint, String.raw`\input{custom/value-runtime.sty}`)
  assert.equal(reference(loaded, key).key, key)
  assert.deepEqual(reference(loaded, key).previewDiagnostics, reference(original, key).previewDiagnostics)
  assert.equal(point(loaded).text, '  $F$\r\n  ')
  assertUntouched(loaded, key)
})

for (const provenance of ['recorded', 'legacy'] as const) test(`stale ${provenance} saved snapshots reconstruct value uncertainty without inferring new intent`, () => {
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
  assert.ok(reference(loaded).previewDiagnostics?.includes('Retained saved diagnostic.'))
  assert.ok(reference(loaded).previewDiagnostics!.length > 1)
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, exactSource)
  assertUntouched(reload(apply(loaded)))
  const edited = reload(edit(loaded, 'text.color', '#FF0000'))
  assert.deepEqual(point(edited).style.importedPaint?.overriddenFields, ['text.color'])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(edited, { exportMode })
    const tail = afterExternal(output)
    assertColor(output, tail, 'text', '#FF0000')
    assert.equal(tail.split(',').length, 1, 'first edit leaves unrelated stale fill external')
  }
})

test('saved references without raw source reconstruct executable recognized values', () => {
  const value = imported()
  delete value.externalTikzStyleSources![0].rawSource
  delete point(value).style.importedPaint
  delete preset(value).style.importedPaint
  assert.equal(reference(value).options, `${executableWidth},text=red`)
  assertUntouched(value)
  assertUntouched(reload(value))
  assertUntouched(reload(apply(value)))
})

for (const values of ['changed', 'fallback-equal'] as const) test(`explicit ${values} text and fill edits survive refresh, Undo/Redo and persistence`, () => {
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
  const restored = reload(redoLastDiagramChange(undone).editableDiagram)
  const refreshed = reload(importTikzStyleFile(restored, 'refresh.sty', exactSource).diagram)
  assertUncertain(resolveImportedTikzStyle(reference(refreshed), createImportedTikzResolutionContext(refreshed)))
  assert.equal(refreshed.externalTikzStyleSources?.[0].rawSource, exactSource)
  assert.equal(serializeDiagram(original), before)
  assert.deepEqual(point(refreshed).style.importedPaint?.overriddenFields, ['text.color', 'fill.color'])
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(refreshed, { exportMode })
    const tail = afterExternal(output)
    assertColor(output, tail, 'text', expected.text)
    assertColor(output, tail, 'fill', expected.fill)
    assert.equal(tail.split(',').length, 2, 'untouched channels remain external after refresh')
  }
  assertUntouched(reload(apply(refreshed)))
})

test('a fallback-equal imported preset edit retains explicit intent through refresh and reapplication', () => {
  const original = imported()
  const importedPreset = preset(original)
  const expected = getPointPaint(importedPreset.style).text.color
  const edited = updateUserStylePresetStyle(original, importedPreset.id, importedPreset.style, ['text.color'])
  const refreshed = reload(importTikzStyleFile(edited, 'refresh.sty', exactSource).diagram)
  assert.deepEqual(preset(refreshed).style.importedPaint?.overriddenFields, ['text.color'])
  const applied = reload(apply(refreshed))
  assert.deepEqual(point(applied).style.importedPaint?.overriddenFields, ['text.color'])
  assertUncertain(resolveImportedTikzStyle(reference(applied), createImportedTikzResolutionContext(applied)))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(applied, { exportMode })
    const tail = afterExternal(output)
    assertColor(output, tail, 'text', expected)
    assert.equal(tail.split(',').length, 1)
  }
})
