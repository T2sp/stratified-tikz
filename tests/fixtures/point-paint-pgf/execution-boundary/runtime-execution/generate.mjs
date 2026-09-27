// Offline comparison only. The application importer and preview never run TeX.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createEmptyDiagram, createPointStratum } from '../../../../../src/model/constructors.ts'
import {
  createImportedTikzResolutionContext,
  importTikzStyleFile,
  resolveImportedTikzStyle,
} from '../../../../../src/model/importedTikzStyles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../../../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../../../../src/model/stylePresets.ts'
import { getPointPaint } from '../../../../../src/model/styles.ts'
import { updateStratumStyleById } from '../../../../../src/ui/diagramUpdates.ts'
import { generateTikz } from '../../../../../src/tikz/generateTikz.ts'

const fixture = new URL('./', import.meta.url)
const source = readFileSync(new URL('runtime.sty', fixture), 'utf8')
assert.equal(source, readFileSync(new URL('before/runtime.sty', fixture), 'utf8'))
const original = createEmptyDiagram({ ambientDimension: 2 })
original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
const imported = importTikzStyleFile(original, 'runtime.sty', source)
const reference = imported.references.find((entry) => entry.key === 'myPoint')
assert.ok(reference)
const preset = imported.diagram.userStylePresets.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id)
assert.ok(preset)
const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)

function reload(diagram) {
  const loaded = parseSavedDiagramJson(serializeDiagram(diagram))
  assert.equal(loaded.ok, true)
  assert.equal(loaded.diagram.externalTikzStyleSources[0].rawSource, source)
  return loaded.diagram
}
function resolution(diagram) {
  const actual = diagram.importedTikzStyleReferences.find((entry) => entry.key === 'myPoint')
  assert.ok(actual)
  const preview = resolveImportedTikzStyle(actual, createImportedTikzResolutionContext(diagram))
  for (const field of ['textColor', 'fillColor', 'drawColor']) assert.ok(preview.unresolvedFields.includes(field), field)
  assert.ok(preview.diagnostics.length > 0)
  return preview
}
function edit(diagram, channel, color) {
  return updateStratumStyleById(diagram, 'p', (style) => {
    assert.equal(style.kind, 'pointStyle')
    const paint = getPointPaint(style)
    return { ...style, paint: { ...paint, [channel]: { ...paint[channel], color } } }
  }, [`${channel}.color`])
}

// Construct a genuine old red snapshot through supported import/application,
// then restore the exact independent runtime source before loading that save.
const oldImported = importTikzStyleFile(original, 'runtime.sty', String.raw`\tikzset{myPoint/.style={text=red}}`)
const oldReference = oldImported.references.find((entry) => entry.key === 'myPoint')
assert.ok(oldReference)
const oldPreset = oldImported.diagram.userStylePresets.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === oldReference.id)
assert.ok(oldPreset)
const oldApplied = applyUserStylePresetToStratum(oldImported.diagram, 'p', oldPreset.id)
const stale = {
  ...oldApplied,
  externalTikzStyleSources: oldApplied.externalTikzStyleSources.map((entry) => ({ ...entry, rawSource: source })),
  importedTikzStyleReferences: oldApplied.importedTikzStyleReferences.map((entry) => ({ ...entry, previewDiagnostics: [] })),
}
writeFileSync(new URL('runtime-stale.json', fixture), serializeDiagram(stale))
const staleLoaded = reload(stale)
const reapplied = reload(applyUserStylePresetToStratum(staleLoaded, 'p', oldPreset.id))
const fallback = getPointPaint(applied.strata[0].style)
assert.equal(fallback.text.color, '#000000')
assert.equal(fallback.fill.color, '#000000')
const variants = [
  { name: 'untouched', diagram: applied },
  { name: 'reloaded', diagram: reload(applied) },
  { name: 'stale-reloaded', diagram: staleLoaded },
  { name: 'preset-reapplied', diagram: reapplied },
  { name: 'local-text-red', diagram: reload(edit(applied, 'text', '#FF0000')), local: { text: '#FF0000' } },
  { name: 'local-text-fallback', diagram: reload(edit(applied, 'text', fallback.text.color)), local: { text: '#000000' } },
  { name: 'local-fill-yellow', diagram: reload(edit(applied, 'fill', '#FFFF00')), local: { fill: '#FFFF00' } },
  { name: 'local-fill-fallback', diagram: reload(edit(applied, 'fill', fallback.fill.color)), local: { fill: '#000000' } },
]
const observations = []
for (const variant of variants) {
  const preview = resolution(variant.diagram)
  const modes = {}
  for (const mode of ['standalone', 'inlineMath']) {
    const output = generateTikz(variant.diagram, { exportMode: mode })
    const node = output.match(/\\node\[([\s\S]*?)\]\s+at/)
    assert.ok(node)
    const options = node[1].split(',').map((option) => option.trim())
    const index = options.indexOf('myPoint')
    assert.ok(index >= 0, 'actual external key preserved')
    const after = options.slice(index + 1)
    const definitions = new Map([...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-Fa-f]{6})\}/g)].map((match) => [match[1], `#${match[2].toUpperCase()}`]))
    for (const key of ['text', 'fill', 'draw']) {
      const assignment = after.filter((option) => option.startsWith(`${key}=`)).at(-1)
      assert.equal(assignment === undefined ? undefined : definitions.get(assignment.slice(key.length + 1)), variant.local?.[key], `${variant.name} ${mode} ${key}`)
    }
    if (variant.local === undefined) assert.deepEqual(after, [], 'untouched uncertain paint stays before external invocation')
    modes[mode] = { optionsAfterExternalKey: after }
    writeFileSync(new URL(`${variant.name}-${mode}.tex`, fixture), output)
  }
  observations.push({ name: variant.name, resolution: preview, local: variant.local ?? {}, overriddenFields: variant.diagram.strata[0].style.importedPaint?.overriddenFields, modes })
}
writeFileSync(new URL('production-observations.json', fixture), JSON.stringify({ exactRawSource: source, rawSourcePreserved: true, variants: observations }, null, 2) + '\n')
for (const mode of ['standalone', 'inlineMath']) {
  const rows = variants.map(({ name }) => `\\par\\noindent\\texttt{${name}}\\par\n${mode === 'inlineMath' ? '\\[\\input{' : '\\input{'}${name}-${mode}.tex}${mode === 'inlineMath' ? '\\]' : ''}\n`)
  writeFileSync(new URL(`runtime-${mode}.tex`, fixture), String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{runtime.sty}
\noindent External reference\par
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
` + rows.join('\n') + '\\end{document}\n')
}
