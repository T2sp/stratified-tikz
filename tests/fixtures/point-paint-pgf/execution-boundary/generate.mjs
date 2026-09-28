// Explicit offline fixture generator; application code never invokes a compiler.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { generateTikz } from '../../../../src/tikz/generateTikz.ts'
import { buildExecutionFixture, executionCases } from './model.mjs'

const fixture = new URL('./', import.meta.url)
for (const name of executionCases) {
  const source = readFileSync(new URL(`${name}.sty`, fixture), 'utf8')
  assert.equal(source, readFileSync(new URL(`before/${name}.sty`, fixture), 'utf8'))
  const result = buildExecutionFixture(name, source)
  for (const mode of ['standalone', 'inlineMath']) {
    const output = generateTikz(result.diagram, { exportMode: mode })
    const reappliedOutput = generateTikz(result.reapplied, { exportMode: mode })
    // Inspect only the node options after the actual external key.
    const afterKey = output.match(/\\node\[[\s\S]*?\bmyPoint\b([\s\S]*?)\]\s+at/)
    const reappliedAfterKey = reappliedOutput.match(/\\node\[[\s\S]*?\bmyPoint\b([\s\S]*?)\]\s+at/)
    assert.ok(afterKey)
    assert.ok(reappliedAfterKey)
    assert.doesNotMatch(afterKey[1], /\btext\s*=/)
    assert.doesNotMatch(reappliedAfterKey[1], /\btext\s*=/)
    writeFileSync(new URL(`${name}-${mode}.tex`, fixture), output)
    writeFileSync(new URL(`${name}-reapplied-${mode}.tex`, fixture), reappliedOutput)
  }
  writeFileSync(new URL(`${name}-stale.json`, fixture), result.staleJson)
  writeFileSync(new URL(`${name}-observations.json`, fixture), JSON.stringify(result.observations, null, 2) + '\n')
  writeFileSync(new URL(`${name}.tex`, fixture), String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{` + name + String.raw`.sty}
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
\input{` + name + String.raw`-standalone.tex}
\[\input{` + name + String.raw`-inlineMath.tex}\]
\input{` + name + String.raw`-reapplied-standalone.tex}
\[\input{` + name + String.raw`-reapplied-inlineMath.tex}\]
\end{document}
`)
}
