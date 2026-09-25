// Focused offline verification fixture. This does not execute TeX or run in the app.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createEmptyDiagram, createPointStratum } from '../../../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../../../src/model/importedTikzStyles.ts'
import { applyUserStylePresetToStratum } from '../../../../src/model/stylePresets.ts'
import { generateTikz } from '../../../../src/tikz/generateTikz.ts'

const fixture = new URL('./', import.meta.url)
const source = readFileSync(new URL('append.sty', fixture), 'utf8')
const original = createEmptyDiagram({ ambientDimension: 2 })
original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
const imported = importTikzStyleFile(original, 'append.sty', source)
const preset = imported.diagram.userStylePresets.find((entry) => entry.kind === 'point')
assert.ok(preset)
const diagram = applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
for (const mode of ['standalone', 'inlineMath']) {
  writeFileSync(new URL(`generated-${mode}.tex`, fixture), generateTikz(diagram, { exportMode: mode }))
}
writeFileSync(new URL('reference.tex', fixture), String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{append.sty}
\noindent External definition and append (PGF):\par
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
\par\bigskip\noindent Corrected standalone output (APP):\par
\input{generated-standalone.tex}
\par\bigskip\noindent Corrected inline math output (APP):\par
\[
\input{generated-inlineMath.tex}
\]
\end{document}
`)
