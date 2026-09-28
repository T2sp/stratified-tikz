import {writeFileSync} from 'node:fs';
import { createEmptyDiagram, createPointStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/constructors.ts';
import { importTikzStyleFile, createImportedTikzResolutionContext, resolveImportedTikzStyle } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/importedTikzStyles.ts';
import { applyUserStylePresetToStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/stylePresets.ts';
import { generateTikz } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/tikz/generateTikz.ts';
const source = String.raw`\tikzset{myPoint/.style={line width={+1pt\relax\globalcolorstrue\definecolor{red}{HTML}{0000FF}},text=red}}`;
const diagram=createEmptyDiagram({ambientDimension:2});
diagram.strata=[createPointStratum({ambientDimension:2,id:'p',text:'APP',position:{x:0,y:0,z:0}})];
const imported=importTikzStyleFile(diagram,'runtime.sty',source);
const ref=imported.references.find(r=>r.key==='myPoint');
const preset=imported.diagram.userStylePresets.find(p=>p.kind==='point'&&p.importedTikzStyleReferenceId===ref.id);
const applied=applyUserStylePresetToStratum(imported.diagram,'p',preset.id);
const preview=resolveImportedTikzStyle(ref,createImportedTikzResolutionContext(applied));
console.log(JSON.stringify({preview,parse:imported.parseResult},null,2));
writeFileSync('/private/tmp/stz-review-paint-value-exec/runtime.sty',source);
for(const exportMode of ['standalone','inlineMath']) writeFileSync(`/private/tmp/stz-review-paint-value-exec/${exportMode}.tex`,generateTikz(applied,{exportMode}));
writeFileSync('/private/tmp/stz-review-paint-value-exec/probe.tex',String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{runtime.sty}
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
\input{standalone.tex}
\[\input{inlineMath.tex}\]
\end{document}
`);
