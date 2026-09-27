import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { createImportedTikzResolutionContext, importTikzStyleFile, parseTikzsetStyles, resolveImportedTikzStyle } from '../../src/model/importedTikzStyles.ts'
import { resolveTikzPaint } from '../../src/model/importedTikzPaint.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum, updateUserStylePresetStyle } from '../../src/model/stylePresets.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import type { Diagram, ImportedTikzStyleReference, PointPaintField } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

// These inputs are the independent PGF reproductions, not parser-derived
// expectations: external PGF paints blue in the first three and red in bounds.
const executionSources = {
  macro: String.raw`\tikzset{myPoint/.style={text=blue}}\newcommand{\unusedPaint}{\tikzset{myPoint/.style={text=red}}}`,
  conditional: String.raw`\tikzset{myPoint/.style={text=blue}}\iffalse\tikzset{myPoint/.style={text=red}}\fi`,
  groupedColor: String.raw`\definecolor{Custom}{HTML}{0000FF}{\definecolor{Custom}{HTML}{FF0000}}\tikzset{myPoint/.style={text=Custom}}`,
}

function declarationSource(count: number, form: 'commands' | 'block'): string {
  const entries = ['myPoint/.style={text=blue}', ...Array.from({ length: Math.min(count - 1, 511) }, (_, index) => `filler${index}/.style={text=black}`)]
  if (count === 513) entries.push('myPoint/.style={text=red}')
  return form === 'block' ? `\\tikzset{${entries.join(',')}}` : entries.map((entry) => `\\tikzset{${entry}}`).join('\n')
}

function diagram(): Diagram {
  const value = createEmptyDiagram({ ambientDimension: 2 })
  value.strata = [createPointStratum({ ambientDimension: 2, id: 'boundary-point', text: '  $F$\r\n  ', position: { x: 0, y: 0, z: 0 } })]
  return value
}

function point(value: Diagram) {
  const result = value.strata[0]
  assert.ok(result.geometricKind === 'point')
  return result
}

function reference(value: Diagram, key = 'myPoint'): ImportedTikzStyleReference {
  const result = value.importedTikzStyleReferences?.find((entry) => entry.key === key)
  assert.ok(result)
  return result
}

function apply(value: Diagram, key = 'myPoint'): Diagram {
  const ref = reference(value, key)
  const preset = value.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === ref.id)
  assert.ok(preset)
  return applyUserStylePresetToStratum(value, 'boundary-point', preset.id)
}

function reload(value: Diagram): Diagram {
  const result = parseSavedDiagramJson(serializeDiagram(value))
  assert.ok(result.ok)
  return result.diagram
}

function afterExternal(output: string, key = 'myPoint'): string {
  const block = output.match(/\\node\[([\s\S]*?)\] at/)?.[1]
  assert.ok(block, 'the actual exported point node exists')
  const options = block.split(',').map((part) => part.trim())
  const index = options.indexOf(key)
  assert.notEqual(index, -1, `the actual external key ${key} occurs in node options`)
  return options.slice(index + 1).join(',')
}

function assertColor(output: string, tail: string, field: 'text' | 'fill', expected: string): void {
  const name = tail.match(new RegExp(`(?:^|,)${field}=([^,]+)`))?.[1]
  assert.ok(name, `${field} follows the actual external key`)
  const colors = new Map([...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-F]+)\}/g)].map((entry) => [entry[1], `#${entry[2]}`]))
  assert.equal(colors.get(name), expected)
}

function assertUntouchedUncertain(value: Diagram, key = 'myPoint'): void {
  const context = createImportedTikzResolutionContext(value)
  assert.ok(context.sourceDiagnostics?.length)
  const preview = resolveImportedTikzStyle(reference(value, key), context)
  for (const field of ['textColor', 'fillColor', 'drawColor', 'textOpacity', 'fillOpacity', 'drawOpacity', 'lineWidth']) {
    assert.ok(preview.unresolvedFields?.includes(field), `${field} is uncertain`)
  }
  assert.ok(preview.diagnostics?.length)
  assert.deepEqual(preview.sourceDependencies, value.externalTikzStyleSources?.map((source) => source.id))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(value, { exportMode })
    assert.equal(afterExternal(output, key), '', `${exportMode}: untouched uncertain paint never follows the external key`)
    assert.deepEqual(output.match(/%\s+\\input\{[^}]+\}/g)?.map((hint) => hint.replace(/^%\s+/, '')), value.externalTikzStyleSources?.map((source) => source.loadHint))
  }
}

function assertRejected(source: string, diagnostic: RegExp = /unsupported|malformed|scope|execution/i): void {
  const initial = importTikzStyleFile(diagram(), 'accepted.sty', String.raw`\tikzset{myPoint/.style={text=green,fill=blue}}`).diagram
  const before = serializeDiagram(initial)
  const parsed = parseTikzsetStyles(source)
  assert.ok(parsed.executionDiagnostics?.length)
  assert.match(parsed.executionDiagnostics.join('\n'), diagnostic)
  assert.match(parsed.warnings.map((warning) => warning.message).join('\n'), diagnostic)
  assert.deepEqual(parsed.styles, [])
  assert.deepEqual(parsed.declarations, [])
  assert.deepEqual(Object.keys(parsed.colors ?? {}), [])
  assert.deepEqual(Object.keys(parsed.rawOptions ?? {}), [])
  const imported = importTikzStyleFile(initial, 'rejected.sty', source, String.raw`\input{custom/rejected.sty}`)
  assert.equal(imported.diagram, initial, 'rejection returns the exact original diagram')
  assert.equal(imported.source, null)
  assert.deepEqual(imported.references, [])
  assert.deepEqual(imported.parseResult, parsed)
  assert.equal(serializeDiagram(initial), before, 'sources, references, presets and model remain unchanged')
  const state = editorState(initial)
  const committed = commitDiagramChange(state, { ...state, editableDiagram: imported.diagram })
  assert.equal(committed.history.past.length, 0, 'a rejected import cannot add an undo entry')
}

function editorState(value: Diagram): UndoableEditorState {
  return { editableDiagram: value, selectedElement: { kind: 'stratum', id: 'boundary-point' }, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(value) }
}

function staleSavedSource(source: string, oldColor = 'red'): Diagram {
  const oldImport = importTikzStyleFile(diagram(), 'retained.sty', `\\tikzset{myPoint/.style={text=${oldColor}}}`, String.raw`\input{custom/retained.sty}`)
  const old = apply(oldImport.diagram)
  const retained = structuredClone(old)
  assert.ok(retained.externalTikzStyleSources?.[0])
  retained.externalTikzStyleSources[0].rawSource = source
  reference(retained).previewDiagnostics = ['Retained diagnostic from the original saved document.']
  return retained
}

for (const [name, source] of Object.entries(executionSources)) {
  test(`execution boundary atomically rejects the independent ${name} reproduction`, () => assertRejected(source))

  test(`saved ${name} reproduction cannot restore certainty from options, presets or point snapshots`, () => {
    const stale = staleSavedSource(source)
    assert.equal(reference(stale).options, 'text=red', 'simulate the old incorrect reference snapshot')
    assert.equal(getPointPaint(point(stale).style).text.color, '#FF0000', 'simulate the old incorrect preview snapshot')
    assertUntouchedUncertain(stale)
    const loaded = reload(stale)
    assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, source)
    assert.equal(loaded.externalTikzStyleSources?.[0].loadHint, String.raw`\input{custom/retained.sty}`)
    assert.equal(reference(loaded).key, 'myPoint')
    assert.ok(reference(loaded).previewDiagnostics?.includes('Retained diagnostic from the original saved document.'))
    assert.ok(reference(loaded).previewDiagnostics!.length > 1, 'reconstruction adds actionable execution diagnostics')
    assert.deepEqual(reference(reload(loaded)).previewDiagnostics, reference(loaded).previewDiagnostics, 'diagnostics are stable through another save/load')
    assert.equal(point(loaded).text, '  $F$\r\n  ')
    assertUntouchedUncertain(loaded)
    assertUntouchedUncertain(reload(apply(loaded)))
    const legacy = structuredClone(stale)
    delete point(legacy).style.importedPaint
    for (const preset of legacy.userStylePresets ?? []) if (preset.kind === 'point') delete preset.style.importedPaint
    assertUntouchedUncertain(reload(legacy))
    assertUntouchedUncertain(reload(apply(legacy)))
  })
}

for (const [name, source] of [
  ['grouped tikzset', String.raw`\tikzset{myPoint/.style={text=blue}}{\tikzset{myPoint/.style={text=red}}}`],
  ['grouped tikzstyle', String.raw`\tikzstyle{myPoint}=[text=blue]{\tikzstyle{myPoint}=[text=red]}`],
  ['explicit group commands', String.raw`\tikzstyle{myPoint}=[text=blue]\begingroup\tikzstyle{myPoint}=[text=red]\endgroup`],
  ['nested macro and condition', String.raw`\tikzset{myPoint/.style={text=blue}}\def\unused{\iftrue{\definecolor{Custom}{HTML}{FF0000}}\fi}`],
  ['commented macro arguments', String.raw`\tikzstyle{myPoint}=[text=blue]\newcommand % fake } \tikzset{ignored/.style={text=green}}
{\unusedPaint}{ {\tikzstyle{myPoint}=[text=red]} }`],
  ['malformed tikzset', String.raw`\tikzstyle{myPoint}=[text=blue]\tikzset{other/.style={text=red}`],
  ['malformed tikzstyle', String.raw`\tikzstyle{myPoint}=[text=blue]\tikzstyle{other}=[text=red`],
  ['missing tikzstyle equals', String.raw`\tikzstyle{myPoint}[text=blue]`],
  ['missing append equals', String.raw`\tikzstyle{myPoint}+[text=blue]`],
  ['malformed definecolor', String.raw`\tikzstyle{myPoint}=[text=blue]\definecolor{Custom}{HTML}`],
  ['unmatched group end', String.raw`\tikzstyle{myPoint}=[text=blue]}`],
  ['unknown top-level content', String.raw`\tikzstyle{myPoint}=[text=blue]unexpected text`],
] as const) {
  test(`closed execution boundary rejects ${name} without keeping a trusted prefix`, () => assertRejected(source))
}

for (const [name, declaration] of [
  ['binding name macro', String.raw`\definecolor{\colorName}{HTML}{FF0000}`],
  ['model macro', String.raw`\definecolor{Custom}{\colorModel}{FF0000}`],
  ['value macro', String.raw`\definecolor{Custom}{HTML}{\paintEffect}`],
  ['active token', String.raw`\definecolor{Custom}{HTML}{~FF0000}`],
  ['nested value group', String.raw`\definecolor{Custom}{HTML}{{FF0000}}`],
  ['parameter token', String.raw`\definecolor{Custom}{HTML}{#1}`],
] as const) {
  test(`nonliteral definecolor ${name} rejects atomically and invalidates retained saved paint`, () => {
    const source = String.raw`\tikzset{myPoint/.style={text=blue}}` + declaration
    assertRejected(source)
    assertUntouchedUncertain(reload(staleSavedSource(source)))
  })
}

for (const [name, source] of [
  ['try invokes code during source execution', String.raw`\tikzset{myPoint/.style={text=blue},run/.code={\tikzset{myPoint/.style={text=red}}},run/.try={}}`],
  ['retry invokes code during source execution', String.raw`\tikzset{myPoint/.style={text=blue},run/.code={\tikzset{myPoint/.style={text=red}}},run/.retry={}}`],
  ['unknown handler', String.raw`\tikzset{myPoint/.style={text=blue},run/.unknownhandler={}}`],
  ['handler execution chain', String.raw`\tikzset{myPoint/.style={text=blue},run/.code/.try={text=red}}`],
  ['standalone expansion handler', String.raw`\tikzset{myPoint/.style={text=blue},run/.expanded={text=red}}`],
  ['repeated expansion handler', String.raw`\tikzset{myPoint/.style={text=blue},run/.style/.expanded/.expanded={text=red}}`],
  ['unsupported expansion chain', String.raw`\tikzset{myPoint/.style={text=blue},run/.style/.expand once={text=red}}`],
  ['expansion argument macro', String.raw`\tikzset{myPoint/.style={text=blue},run/.style/.expanded={text=\paintEffect}}`],
  ['expansion argument parameter', String.raw`\tikzset{myPoint/.style={text=blue},run/.style/.expanded={text=#1}}`],
  ['expansion argument active token', String.raw`\tikzset{myPoint/.style={text=blue},run/.style/.expanded={text=~}}`],
  ['expanded code body', String.raw`\tikzset{myPoint/.style={text=blue},run/.code/.expanded={\tikzset{myPoint/.style={text=red}}}}`],
  ['code args with executing trailing command', String.raw`\tikzset{myPoint/.style={text=blue},run/.code args={#1}{}\tikzset{myPoint/.style={text=red}}}`],
  ['code args unsupported parameter semantics', String.raw`\tikzset{myPoint/.style={text=blue},run/.code args={#1}{\color{red}}}`],
  ['style args missing second braced argument', String.raw`\tikzset{myPoint/.style={text=blue},run/.style args={text=red}}`],
  ['add style missing second braced argument', String.raw`\tikzset{myPoint/.style={text=blue},run/.add style={text=red}}`],
  ['style args trailing command', String.raw`\tikzset{myPoint/.style={text=blue},run/.style args={#1}{text=#1}\tikzset{myPoint/.style={text=red}}}`],
  ['add style trailing command', String.raw`\tikzset{myPoint/.style={text=blue},run/.add style={text=red}{fill=blue}\tikzset{myPoint/.style={text=red}}}`],
  ['style args third argument', String.raw`\tikzset{myPoint/.style={text=blue},run/.style args={#1}{text=#1}{text=red}}`],
  ['add style third argument', String.raw`\tikzset{myPoint/.style={text=blue},run/.add style={text=red}{fill=blue}{draw=green}}`],
  ['root text implementation', String.raw`\tikzset{text/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['root fill implementation', String.raw`\tikzset{/tikz/fill/.style={red},myPoint/.style={text=blue}}`],
  ['root color implementation', String.raw`\tikzset{color/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['root opacity implementation', String.raw`\tikzset{opacity/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['legacy root draw declaration', String.raw`\tikzstyle{draw}=[blue]\tikzstyle{myPoint}=[text=blue]`],
  ['directory-relative root text implementation', String.raw`\tikzset{/tikz/.cd,text/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['absolute special handler hook', String.raw`\tikzset{/handlers/.style/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['directory-relative special handler hook', String.raw`\tikzset{/handlers/.cd,.style/.code={\color{red}},/tikz/myPoint/.style={text=blue}}`],
  ['unknown-key hook', String.raw`\tikzset{/tikz/.unknown/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['legacy special handler hook', String.raw`\tikzstyle{/handlers/.style}=[text=red]\tikzstyle{myPoint}=[text=blue]`],
  ['legacy comma-separated key name', String.raw`\tikzstyle{myPoint,other}=[text=red]\tikzstyle{myPoint}=[text=blue]`],
  ['spaced root-key alias', String.raw`\tikzset{/ tikz / text/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['repeated-slash root-key alias', String.raw`\tikzset{//tikz//text/.code={\color{red}},myPoint/.style={text=blue}}`],
  ['legacy spaced root-key alias', String.raw`\tikzstyle{/ tikz / text}=[red]\tikzstyle{myPoint}=[text=blue]`],
  ['legacy repeated-slash root-key alias', String.raw`\tikzstyle{//tikz//text}=[red]\tikzstyle{myPoint}=[text=blue]`],
] as const) {
  test(`source execution boundary rejects ${name} and cannot trust retained source snapshots`, () => {
    assertRejected(source)
    const saved = reload(staleSavedSource(source, 'blue'))
    assert.equal(saved.externalTikzStyleSources?.[0].rawSource, source)
    assertUntouchedUncertain(saved)
    assertUntouchedUncertain(reload(apply(saved)))
  })
}

for (const handler of [
  '.append style={fill=red}',
  '.prefix style={fill=red}',
  '.add style={fill=red}{draw=blue}',
  '.add style/.expanded={fill={red}}{text={blue}}',
  '.style args={#1/#2}{fill=#1,text=#2}',
  String.raw`.code={\color{red}}`,
  '.style 2 args={fill=#1,text=#2}',
  '.style/.expanded={text={red},fill={blue}}',
] as const) {
  test(`passive declaration ${handler} retains local uncertainty without losing unrelated supported paint`, () => {
    const source = `\\tikzset{myPoint/.style={text=blue},unrelated/.style={text=green},myPoint/${handler}}`
    const imported = importTikzStyleFile(diagram(), 'passive.sty', source)
    assert.ok(imported.source)
    assert.deepEqual(imported.parseResult.executionDiagnostics ?? [], [])
    assert.deepEqual(imported.parseResult.declarations?.map((entry) => entry.kind), ['definition', 'definition', 'mutation'])
    const ref = reference(imported.diagram)
    assert.equal(ref.options, 'text=blue')
    assert.equal(ref.rawOptions, 'text=blue')
    const loaded = reload(apply(imported.diagram))
    const context = createImportedTikzResolutionContext(loaded)
    assert.deepEqual(context.sourceDiagnostics ?? [], [])
    const affected = resolveImportedTikzStyle(ref, context)
    assert.ok(affected.unresolvedFields?.includes('textColor'))
    assert.match(affected.diagnostics?.join() ?? '', /Unsupported style mutation/)
    const unaffected = resolveTikzPaint('unrelated', context)
    assert.equal(unaffected.textColor, '#00FF00')
    assert.equal(unaffected.unresolvedFields, undefined)
    assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, source)
    for (const exportMode of ['standalone', 'inlineMath'] as const) assert.equal(afterExternal(generateTikz(loaded, { exportMode })), '')
  })
}

test('an ordinary namespaced text declaration remains a supported key and does not redefine root paint', () => {
  const source = String.raw`\tikzset{/other/.cd,text/.style={/tikz/text=red},/tikz/myPoint/.style={text=blue}}`
  const imported = importTikzStyleFile(diagram(), 'namespaced-text.sty', source)
  assert.ok(imported.source)
  assert.deepEqual(imported.parseResult.executionDiagnostics ?? [], [])
  const context = createImportedTikzResolutionContext(imported.diagram)
  assert.equal(resolveTikzPaint('/other/text', context).textColor, '#FF0000')
  assert.equal(resolveTikzPaint('/tikz/myPoint', context).textColor, '#0000FF')
  assert.equal(resolveTikzPaint('/tikz/myPoint', context).unresolvedFields, undefined)
  const loaded = reload(apply(imported.diagram, '/tikz/myPoint'))
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded, { exportMode })
    assertColor(output, afterExternal(output, '/tikz/myPoint'), 'text', '#0000FF')
  }
})

test('top-level literal commands retain comments, nested option braces, namespace spelling and source order', () => {
  const source = '% \\newcommand{\\unused}{\\tikzset{bad/.style={text=red}}}\r\n' + String.raw`\definecolor{Custom}{RGB}{0,0,255}
\tikzset{/tikz/group/.cd,base/.style={fill={blue}},myPoint/.style={group/base,text={Custom},label={a,{b}}}}
\tikzstyle{/tikz/group/myPoint}=[group/base,text={Custom},fill={red}]
\definecolor{Custom}{HTML}{00FF00}`
  const imported = importTikzStyleFile(diagram(), 'supported.sty', source)
  assert.deepEqual(imported.parseResult.executionDiagnostics ?? [], [])
  assert.ok(imported.source)
  assert.equal(imported.source.rawSource, source)
  assert.equal(imported.parseResult.colors?.Custom, '#00FF00')
  const ref = reference(imported.diagram, '/tikz/group/myPoint')
  assert.equal(ref.rawOptions, 'group/base,text={Custom},fill={red}')
  assert.equal(ref.key, '/tikz/group/myPoint')
  const applied = reload(apply(imported.diagram, ref.key))
  const preview = resolveImportedTikzStyle(ref, createImportedTikzResolutionContext(applied))
  assert.equal(preview.textColor, '#00FF00')
  assert.equal(preview.fillColor, '#FF0000')
  assert.equal(preview.unresolvedFields, undefined)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(applied, { exportMode })
    assertColor(output, afterExternal(output, ref.key), 'text', '#00FF00')
    assertColor(output, afterExternal(output, ref.key), 'fill', '#FF0000')
  }
})

test('tikzstyle brackets inside nested or escaped braces do not end the top-level declaration', () => {
  const body = String.raw`label={nested {a] [b},escaped \} brace},text=blue,fill=red`
  const source = `\\tikzstyle{myPoint}=[${body}] % fake ] } \\iffalse\r\n\\definecolor{Custom}{HTML}{123456}`
  const parsed = parseTikzsetStyles(source)
  assert.deepEqual(parsed.executionDiagnostics ?? [], [])
  assert.deepEqual(parsed.styles.map((style) => style.key), ['myPoint'])
  assert.equal(parsed.rawOptions?.myPoint, body)
  assert.equal(parsed.colors?.Custom, '#123456', 'the command after the real closing bracket remains visible')
  const imported = importTikzStyleFile(diagram(), 'brackets.sty', source)
  const preview = resolveImportedTikzStyle(reference(imported.diagram), createImportedTikzResolutionContext(imported.diagram))
  assert.equal(preview.textColor, '#0000FF')
  assert.equal(preview.fillColor, '#FF0000')
  assert.ok(!preview.unresolvedFields?.includes('textColor'))
  assert.ok(!preview.unresolvedFields?.includes('fillColor'))
})

for (const form of ['commands', 'block'] as const) {
  test(`exactly 512 declarations remain supported across ${form}`, () => {
    const source = declarationSource(512, form)
    const imported = importTikzStyleFile(diagram(), 'limit.sty', source)
    assert.ok(imported.source)
    assert.deepEqual(imported.parseResult.executionDiagnostics ?? [], [])
    assert.equal(imported.parseResult.declarations?.length, 512)
    assert.equal(imported.parseResult.styles.length, 512)
    assert.equal(imported.references.length, 512)
    assert.deepEqual(imported.parseResult.warnings, [])
    const ref = reference(imported.diagram)
    assert.equal(ref.options, 'text=blue')
    assert.equal(ref.rawOptions, 'text=blue')
    assert.deepEqual(ref.previewDiagnostics, [])
    const applied = reload(apply(imported.diagram))
    assert.equal(getPointPaint(point(applied).style).text.color, '#0000FF')
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const output = generateTikz(applied, { exportMode })
      assertColor(output, afterExternal(output), 'text', '#0000FF')
    }
  })

  test(`declaration 513 across ${form} rejects its prefix and late redefinition atomically`, () => {
    assertRejected(declarationSource(513, form), /512.*(?:bound|limit)/i)
  })

  test(`saved ${form} overflow ignores inconsistent blue options and red rawOptions through reapplication`, () => {
    const raw = declarationSource(513, form)
    const stale = staleSavedSource(raw, 'blue')
    reference(stale).rawOptions = 'text=red'
    reference(stale).previewDiagnostics = []
    assertUntouchedUncertain(stale)
    const loaded = reload(stale)
    assert.equal(reference(loaded).options, 'text=blue', 'the saved snapshot remains inspectable, never authoritative')
    assert.equal(reference(loaded).rawOptions, 'text=red', 'raw snapshot is not silently rewritten')
    assert.match(reference(loaded).previewDiagnostics?.join() ?? '', /512.*(?:bound|limit)/i)
    assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, raw)
    assertUntouchedUncertain(loaded)
    assertUntouchedUncertain(reload(apply(loaded)))
    const legacy = structuredClone(stale)
    delete point(legacy).style.importedPaint
    assertUntouchedUncertain(reload(legacy))
  })
}

test('color and mutation declaration events share the finite source bound', () => {
  const prefix = declarationSource(511, 'commands')
  for (const final of [String.raw`\definecolor{Custom}{HTML}{0000FF}`, String.raw`\tikzset{myPoint/.append style={fill=blue}}`]) {
    const exact = parseTikzsetStyles(prefix + final)
    assert.deepEqual(exact.executionDiagnostics ?? [], [])
    assert.ok(exact.styles.length)
    assertRejected(prefix + final + String.raw`\definecolor{Custom}{HTML}{FF0000}`, /512.*(?:bound|limit)/i)
  }
})

test('the existing input-length bound rejects atomically and cannot resurrect saved reference snapshots', () => {
  const supported = String.raw`\tikzset{myPoint/.style={text=blue}}`.padEnd(1_000_000, ' ')
  assert.deepEqual(parseTikzsetStyles(supported).executionDiagnostics ?? [], [])
  const oversized = supported + ' '
  assertRejected(oversized, /1000000-character preview bound/)
  const stale = staleSavedSource(oversized, 'blue')
  assertUntouchedUncertain(stale)
  const loaded = reload(stale)
  assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, oversized)
  assert.match(reference(loaded).previewDiagnostics?.join() ?? '', /1000000-character preview bound/)
  assertUntouchedUncertain(loaded)
  assertUntouchedUncertain(reload(apply(loaded)))
})

for (const [name, uncertain] of [['macro', executionSources.macro], ['overflow', declarationSource(513, 'commands')]] as const) {
  test(`later saved ${name} source invalidates earlier aliases, color dependencies and unrelated imported keys`, () => {
    const first = importTikzStyleFile(diagram(), 'first.sty', String.raw`\definecolor{Custom}{HTML}{0000FF}\tikzset{base/.style={text=Custom},myPoint/.style={base,fill=blue},unrelated/.style={text=green}}`)
    const second = importTikzStyleFile(apply(first.diagram), 'later.sty', String.raw`\tikzstyle{other}=[draw=blue]`, String.raw`\input{custom/later.sty}`)
    const stale = structuredClone(second.diagram)
    assert.ok(stale.externalTikzStyleSources?.[1])
    stale.externalTikzStyleSources[1].rawSource = uncertain
    const loaded = reload(stale)
    const context = createImportedTikzResolutionContext(loaded)
    for (const key of ['base', 'myPoint', 'unrelated', 'other']) {
      const ref = reference(loaded, key)
      assert.ok(ref.previewDiagnostics?.length, key)
      const preview = resolveImportedTikzStyle(ref, context)
      assert.ok(preview.unresolvedFields?.includes('textColor'), key)
      assert.deepEqual(preview.sourceDependencies, loaded.externalTikzStyleSources?.map((source) => source.id))
    }
    assert.ok(resolveTikzPaint('base,text=blue', context).unresolvedFields?.includes('textColor'), 'a literal after an imported reference cannot erase unknown source execution effects')
    assertUntouchedUncertain(loaded)
    assertUntouchedUncertain(reload(apply(loaded)))
    assert.equal(loaded.externalTikzStyleSources?.[0].rawSource, first.source?.rawSource)
    assert.equal(loaded.externalTikzStyleSources?.[1].rawSource, uncertain)
    const restored = importTikzStyleFile(loaded, 'new-literal.sty', String.raw`\tikzset{myPoint/.style={text=blue}}`).diagram
    assertUntouchedUncertain(reload(restored))
  })
}

for (const [name, raw] of [['macro', executionSources.macro], ['overflow', declarationSource(513, 'commands')]] as const) {
  for (const editTarget of ['point', 'preset'] as const) {
    test(`${name} legacy ${editTarget} fill intent never promotes stale overall opacity through later import`, () => {
      const legacy = staleSavedSource(raw)
      point(legacy).style.opacity = 0.4
      delete point(legacy).style.importedPaint
      for (const preset of legacy.userStylePresets ?? []) {
        if (preset.kind !== 'point') continue
        preset.style.opacity = 0.4
        delete preset.style.importedPaint
      }
      const loaded = reload(legacy)
      assertUntouchedUncertain(loaded)
      const ref = reference(loaded)
      const preset = loaded.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === ref.id)
      assert.ok(preset?.kind === 'point')
      const fill = getPointPaint(point(loaded).style).fill.color
      const edited = editTarget === 'point'
        ? updateStratumStyleById(loaded, 'boundary-point', (style) => style, ['fill.color'])
        : updateUserStylePresetStyle(loaded, preset.id, preset.style, ['fill.color'])
      assert.deepEqual(point(edited).style.importedPaint?.overriddenFields, ['fill.color'])
      const saved = reload(edited)
      const later = importTikzStyleFile(saved, 'later-supported.sty', String.raw`\tikzset{later/.style={text=green}}`)
      assert.ok(later.source, 'the later supported declaration is accepted')
      const final = reload(later.diagram)
      assert.deepEqual(point(final).style, point(saved).style, 'uncertain source context does not refresh fallback paint or infer opacity intent')
      assert.equal(point(final).style.opacity, 0.4)
      assert.equal(final.externalTikzStyleSources?.[0].rawSource, raw)
      for (const value of [edited, saved, final]) {
        for (const exportMode of ['standalone', 'inlineMath'] as const) {
          const output = generateTikz(value, { exportMode })
          const tail = afterExternal(output)
          assertColor(output, tail, 'fill', fill)
          assert.equal(tail.split(',').length, 1, 'only the accepted fill edit follows the key; stale overall alpha is not authored intent')
          assert.doesNotMatch(tail, /(?:fill|draw|text) opacity=/)
        }
      }
      const currentPreset = final.userStylePresets?.find((entry) => entry.id === preset.id)
      assert.ok(currentPreset?.kind === 'point')
      const explicitOpacity = editTarget === 'point'
        ? updateStratumStyleById(final, 'boundary-point', (style) => style, ['opacity'])
        : updateUserStylePresetStyle(final, preset.id, currentPreset.style, ['opacity'])
      const explicitSaved = reload(explicitOpacity)
      assert.deepEqual(point(explicitSaved).style.importedPaint?.overriddenFields, ['fill.color', 'opacity'])
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const output = generateTikz(explicitSaved, { exportMode })
        const tail = afterExternal(output)
        assertColor(output, tail, 'fill', fill)
        for (const channel of ['fill', 'draw', 'text']) assert.match(tail, new RegExp(`(?:^|,)${channel} opacity=0\\.4(?:,|$)`))
        assert.equal(tail.split(',').length, 4, 'explicit equal-valued overall opacity authorizes the three effective alphas')
      }
      const reapplied = reload(apply(explicitSaved))
      if (editTarget === 'point') assertUntouchedUncertain(reapplied)
      else assert.deepEqual(point(reapplied).style, point(explicitSaved).style, 'an edited preset retains its own explicit fill and opacity intent when reapplied')
    })
  }

  for (const channel of ['text', 'fill'] as const) {
    test(`${name} legacy snapshot first equal ${channel} edit cannot promote other stale paint`, () => {
      const legacy = staleSavedSource(raw)
      delete point(legacy).style.importedPaint
      for (const preset of legacy.userStylePresets ?? []) if (preset.kind === 'point') delete preset.style.importedPaint
      const loaded = reload(legacy)
      const fallback = getPointPaint(point(loaded).style)[channel].color
      const field: PointPaintField = channel === 'text' ? 'text.color' : 'fill.color'
      const edited = updateStratumStyleById(loaded, 'boundary-point', (style) => style, [field])
      assert.deepEqual(point(edited).style.importedPaint?.overriddenFields, [field])
      const saved = reload(edited)
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const output = generateTikz(saved, { exportMode })
        const tail = afterExternal(output)
        assertColor(output, tail, channel, fallback)
        assert.equal(tail.split(',').length, 1, 'an explicit equal edit cannot authorize any other old fallback channel')
      }
    })
  }

  test(`${name} retained source keeps new explicit text/fill edits authoritative after save/load`, () => {
    const loaded = reload(staleSavedSource(raw))
    const edited = updateStratumStyleById(loaded, 'boundary-point', (style) => {
      if (style.kind !== 'pointStyle') return style
      const paint = getPointPaint(style)
      return { ...style, paint: { ...paint, text: { ...paint.text, color: '#123456' }, fill: { ...paint.fill, color: '#ABCDEF' } } }
    }, ['text.color', 'fill.color'])
    const saved = reload(edited)
    assert.equal(saved.externalTikzStyleSources?.[0].rawSource, raw)
    assert.deepEqual(point(saved).style.importedPaint?.overriddenFields, ['text.color', 'fill.color'])
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const output = generateTikz(saved, { exportMode })
      const tail = afterExternal(output)
      assertColor(output, tail, 'text', '#123456')
      assertColor(output, tail, 'fill', '#ABCDEF')
      assert.equal(tail.split(',').length, 2)
    }
  })

  test(`${name} uncertainty and exact CRLF source survive history while intentional fallback-valued text/fill edits export`, () => {
    const source = `% retained comment { \\iffalse\r\n${raw}\r\n`
    const old = staleSavedSource(source, name === 'overflow' ? 'blue' : 'red')
    const loaded = reload(old)
    const before = serializeDiagram(loaded)
    let state = editorState(loaded)
    const expected = { text: getPointPaint(point(loaded).style).text.color, fill: getPointPaint(point(loaded).style).fill.color }
    for (const channel of ['text', 'fill'] as const) {
      const field: PointPaintField = channel === 'text' ? 'text.color' : 'fill.color'
      const edited = updateStratumStyleById(state.editableDiagram, 'boundary-point', (style) => {
        if (style.kind !== 'pointStyle') return style
        const paint = getPointPaint(style)
        return { ...style, paint: { ...paint, [channel]: { ...paint[channel], color: expected[channel] } } }
      }, [field])
      state = commitDiagramChange(state, { ...state, editableDiagram: edited })
    }
    assert.equal(state.history.past.length, 2, 'equal-valued edits are separate, intentional history changes')
    assert.deepEqual(point(state.editableDiagram).style.importedPaint?.overriddenFields, ['text.color', 'fill.color'])
    const onceUndone = undoLastDiagramChange(state)
    assert.deepEqual(point(onceUndone.editableDiagram).style.importedPaint?.overriddenFields, ['text.color'])
    assert.equal(serializeDiagram(undoLastDiagramChange(onceUndone).editableDiagram), before)
    const redone = reload(redoLastDiagramChange(onceUndone).editableDiagram)
    assert.equal(redone.externalTikzStyleSources?.[0].rawSource, source)
    assert.deepEqual(reference(redone).previewDiagnostics, reference(loaded).previewDiagnostics)
    assert.equal(serializeDiagram(loaded), before, 'history leaves the original snapshot immutable')
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const output = generateTikz(redone, { exportMode })
      const tail = afterExternal(output)
      assertColor(output, tail, 'text', expected.text)
      assertColor(output, tail, 'fill', expected.fill)
      assert.equal(tail.split(',').length, 2, 'only the two explicit local paint edits follow the external key')
    }
    assertUntouchedUncertain(reload(apply(redone)), 'myPoint')
  })
}

for (const [name, expectedTextOperator, oldWrongOperator, subdirectory] of [
  ['macro', '0 0 1 rg', '1 0 0 rg', ''],
  ['conditional', '0 0 1 rg', '1 0 0 rg', ''],
  ['groupedColor', '0 0 1 rg', '1 0 0 rg', ''],
  ['bounds', '1 0 0 rg', '0 0 1 rg', ''],
  ['try', '1 0 0 rg', '0 0 1 rg', 'handler-execution/'],
] as const) {
  test(`${name} current saved/reapplied exports equal independently compiled PGF bytes and preserve actual external paint`, () => {
    const fixture = new URL(`../fixtures/point-paint-pgf/execution-boundary/${subdirectory}`, import.meta.url)
    const raw = readFileSync(new URL(`${name}.sty`, fixture), 'utf8')
    assert.equal(raw, readFileSync(new URL(`before/${name}.sty`, fixture), 'utf8'), 'external PGF source is the unchanged independent input')
    const loaded = parseSavedDiagramJson(readFileSync(new URL(`${name}-stale.json`, fixture), 'utf8'))
    assert.ok(loaded.ok)
    const ref = reference(loaded.diagram)
    const preset = loaded.diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === ref.id)
    assert.ok(preset)
    const reapplied = reload(applyUserStylePresetToStratum(loaded.diagram, point(loaded.diagram).id, preset.id))
    assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, raw)
    for (const [suffix, value] of [['', loaded.diagram], ['-reapplied', reapplied]] as const) {
      for (const exportMode of ['standalone', 'inlineMath'] as const) {
        const output = generateTikz(value, { exportMode })
        assert.equal(output, readFileSync(new URL(`${name}${suffix}-${exportMode}.tex`, fixture), 'utf8'), 'the current output is exactly the independently compiled output')
        assert.equal(afterExternal(output), '')
      }
    }
    const log = readFileSync(new URL(`${name}.log.txt`, fixture), 'utf8')
    assert.match(log, /STZ-PGF-VERSION=3\.1\.11a/)
    assert.match(log, /pdfTeX.*1\.40\.29/)
    const actualNodes = pdfTextPaint(new URL(`${name}.pdf`, fixture))
    assert.deepEqual(actualNodes.map((node) => node.body), ['PGF', 'APP', 'APP', 'APP', 'APP'])
    assert.deepEqual(actualNodes.map((node) => node.operator), Array<string>(5).fill(expectedTextOperator), 'external node and both modes, including reapplication, agree in actual PDF operators')
    const oldNodes = pdfTextPaint(new URL(`before/${name}.pdf`, fixture))
    assert.deepEqual(oldNodes.map((node) => node.body), ['PGF', 'APP', 'APP'])
    assert.deepEqual(oldNodes.map((node) => node.operator), [expectedTextOperator, oldWrongOperator, oldWrongOperator], 'the independent failing PDF evidence remains intact')
  })
}

function pdfTextPaint(file: URL): { body: string; operator: string }[] {
  const pdf = readFileSync(file).toString('latin1')
  const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => match[1]).filter((stream) => stream.includes('[(PGF)]TJ'))
  assert.equal(streams.length, 1, 'one actual uncompressed independent PDF stream contains the comparison nodes')
  return [...streams[0].matchAll(/\[\((PGF|APP)\)\]TJ/g)].map((match) => {
    const operators = [...streams[0].slice(0, match.index).matchAll(/(?:^|\s)([\d.]+ [\d.]+ [\d.]+ rg)(?=\s)/g)]
    const finalOperator = operators.at(-1)
    assert.ok(finalOperator, 'the PDF records a text color before this node')
    return { body: match[1], operator: finalOperator[1] }
  })
}
