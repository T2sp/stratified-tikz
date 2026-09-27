import { writeFileSync } from 'node:fs'
import { createEmptyDiagram, createPointStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/constructors.ts'
import { importTikzStyleFile, createImportedTikzResolutionContext, resolveImportedTikzStyle } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/importedTikzStyles.ts'
import { applyUserStylePresetToStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/stylePresets.ts'
import { generateTikz } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/tikz/generateTikz.ts'
const source=String.raw`\tikzset{myPoint/.style={text=blue},run/.code={\tikzset{myPoint/.style={text=red}}},run/.try={}}`
const base=createEmptyDiagram({ambientDimension:2});base.strata=[createPointStratum({ambientDimension:2,id:'p',text:'APP',position:{x:0,y:0,z:0}})]
const result=importTikzStyleFile(base,'try.sty',source)
const ref=result.references.find(x=>x.key==='myPoint')
const preset=result.diagram.userStylePresets.find(x=>x.kind==='point'&&x.importedTikzStyleReferenceId===ref.id)
const diagram=applyUserStylePresetToStratum(result.diagram,'p',preset.id)
writeFileSync('try.sty',source)
for (const mode of ['standalone','inlineMath'])writeFileSync(`try-${mode}.tex`,generateTikz(diagram,{exportMode:mode}))
console.log(JSON.stringify({parse:result.parseResult,resolution:resolveImportedTikzStyle(ref,createImportedTikzResolutionContext(diagram))},null,2))
writeFileSync('try.tex',String.raw`\documentclass{article}
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
\end{document}
`)
