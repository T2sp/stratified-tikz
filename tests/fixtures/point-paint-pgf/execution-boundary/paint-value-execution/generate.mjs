// Offline comparison only. Application import and preview never execute TeX.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createImportedTikzResolutionContext, resolveImportedTikzStyle } from '../../../../../src/model/importedTikzStyles.ts'
import { serializeDiagram } from '../../../../../src/model/serialization.ts'
import { generateTikz } from '../../../../../src/tikz/generateTikz.ts'
import { createPaintValueExecutionVariants, exactSource, point } from './model.ts'

const fixture = new URL('./', import.meta.url)
const source = readFileSync(new URL('runtime.sty', fixture), 'utf8')
assert.equal(source, exactSource)
assert.equal(source, readFileSync(new URL('before/runtime.sty', fixture), 'utf8'))
const { variants, stale } = createPaintValueExecutionVariants()
writeFileSync(new URL('runtime-stale.json', fixture), serializeDiagram(stale))
const observations = []
for (const variant of variants) {
  const reference = variant.diagram.importedTikzStyleReferences.find((entry) => entry.key === 'myPoint')
  assert.ok(reference)
  const preview = resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(variant.diagram))
  assert.equal(preview.executionUncertain, true)
  for (const field of ['textColor', 'fillColor', 'drawColor', 'lineWidth']) assert.ok(preview.unresolvedFields.includes(field), field)
  assert.ok(preview.diagnostics.some((diagnostic) => /executable/.test(diagnostic)))
  assert.ok(preview.sourceDependencies.includes(reference.sourceId))
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
    assert.equal(after.length, Object.keys(variant.local ?? {}).length, 'only recorded local edits follow the external key')
    modes[mode] = { optionsAfterExternalKey: after }
    writeFileSync(new URL(`${variant.name}-${mode}.tex`, fixture), output)
  }
  observations.push({ name: variant.name, resolution: preview, local: variant.local ?? {}, overriddenFields: point(variant.diagram).style.importedPaint?.overriddenFields, modes })
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
