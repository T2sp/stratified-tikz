// Offline fixture only; application imports and previews never execute TeX.
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
import { generateTikz } from '../../../../../src/tikz/generateTikz.ts'

const fixture = new URL('./', import.meta.url)
const source = readFileSync(new URL('try.sty', fixture), 'utf8')
assert.equal(source, readFileSync(new URL('before/try.sty', fixture), 'utf8'))
const original = createEmptyDiagram({ ambientDimension: 2 })
original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
const originalJson = serializeDiagram(original)
const rejected = importTikzStyleFile(original, 'try.sty', source)
assert.equal(rejected.diagram, original)
assert.equal(serializeDiagram(original), originalJson)
assert.equal(rejected.references.length, 0)
assert.equal(rejected.parseResult.styles.length, 0)
assert.equal(rejected.parseResult.declarations.length, 0)
assert.deepEqual(rejected.parseResult.colors, {})
assert.equal(Object.keys(rejected.parseResult.rawOptions).length, 0)
assert.ok(rejected.parseResult.executionDiagnostics.length > 0)

// Seed the old false-blue snapshot using real supported import/application,
// then restore the independently supplied source before the JSON reload.
const imported = importTikzStyleFile(original, 'try.sty', String.raw`\tikzset{myPoint/.style={text=blue}}`)
const reference = imported.references.find((entry) => entry.key === 'myPoint')
assert.ok(reference)
const preset = imported.diagram.userStylePresets.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference.id)
assert.ok(preset)
const applied = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
const stale = {
  ...applied,
  externalTikzStyleSources: applied.externalTikzStyleSources.map((entry) => ({ ...entry, rawSource: source })),
  importedTikzStyleReferences: applied.importedTikzStyleReferences.map((entry) => ({ ...entry, previewDiagnostics: [] })),
}
const staleJson = serializeDiagram(stale)
const loaded = parseSavedDiagramJson(staleJson)
assert.equal(loaded.ok, true)
assert.equal(loaded.diagram.externalTikzStyleSources[0].rawSource, source)
const reloadedReference = loaded.diagram.importedTikzStyleReferences.find((entry) => entry.id === reference.id)
assert.ok(reloadedReference)
const resolved = resolveImportedTikzStyle(reloadedReference, createImportedTikzResolutionContext(loaded.diagram))
assert.ok(resolved.unresolvedFields.includes('textColor'))
assert.ok(resolved.diagnostics.length > 0)
const reapplied = applyUserStylePresetToStratum(loaded.diagram, 'p', preset.id)
const roundTrip = parseSavedDiagramJson(serializeDiagram(reapplied))
assert.equal(roundTrip.ok, true)
assert.equal(roundTrip.diagram.externalTikzStyleSources[0].rawSource, source)
for (const mode of ['standalone', 'inlineMath']) {
  for (const [suffix, diagram] of [['', loaded.diagram], ['-reapplied', roundTrip.diagram]]) {
    const output = generateTikz(diagram, { exportMode: mode })
    const afterKey = output.match(/\\node\[[\s\S]*?\bmyPoint\b([\s\S]*?)\]\s+at/)
    assert.ok(afterKey)
    assert.doesNotMatch(afterKey[1], /\btext\s*=/)
    writeFileSync(new URL(`try${suffix}-${mode}.tex`, fixture), output)
  }
}
writeFileSync(new URL('try-stale.json', fixture), staleJson)
writeFileSync(new URL('try-observations.json', fixture), JSON.stringify({
  rejected: {
    sameDiagramIdentity: rejected.diagram === original,
    unchangedJson: serializeDiagram(original) === originalJson,
    references: rejected.references.length,
    styles: rejected.parseResult.styles.length,
    declarations: rejected.parseResult.declarations.length,
    colors: rejected.parseResult.colors,
    rawOptions: rejected.parseResult.rawOptions,
    diagnostics: rejected.parseResult.executionDiagnostics,
  },
  reloaded: {
    rawSourceUnchanged: loaded.diagram.externalTikzStyleSources[0].rawSource === source,
    reference: reloadedReference,
    resolution: resolved,
    presetReapplicationRoundTrip: roundTrip.ok,
  },
}, null, 2) + '\n')
writeFileSync(new URL('try.tex', fixture), String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{try.sty}
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
\input{try-standalone.tex}
\[\input{try-inlineMath.tex}\]
\input{try-reapplied-standalone.tex}
\[\input{try-reapplied-inlineMath.tex}\]
\end{document}
`)
