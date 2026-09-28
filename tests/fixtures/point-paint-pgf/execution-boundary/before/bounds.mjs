import {writeFileSync} from 'node:fs';
import { createEmptyDiagram, createPointStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/constructors.ts';
import { importTikzStyleFile, createImportedTikzResolutionContext, resolveImportedTikzStyle } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/importedTikzStyles.ts';
import { applyUserStylePresetToStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/stylePresets.ts';
import { generateTikz } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/tikz/generateTikz.ts';
const base='/private/tmp/stz-32b-model-review/';
const source=String.raw`\tikzset{myPoint/.style={text=blue}}`+Array.from({length:511},(_,i)=>`\\tikzset{filler${i}/.style={text=black}}`).join('\n')+String.raw`\tikzset{myPoint/.style={text=red}}`;
const d=createEmptyDiagram({ambientDimension:2});d.strata=[createPointStratum({ambientDimension:2,id:'p',text:'APP',position:{x:0,y:0,z:0}})];
const imported=importTikzStyleFile(d,'bounds.sty',source);const ref=imported.references.find(x=>x.key==='myPoint');const preset=imported.diagram.userStylePresets.find(x=>x.kind==='point'&&x.importedTikzStyleReferenceId===ref.id);
const applied=applyUserStylePresetToStratum(imported.diagram,'p',preset.id);
console.log(JSON.stringify({sourceLength:source.length,declarationCount:imported.parseResult.declarations.length,warnings:imported.parseResult.warnings,reference:ref,preview:resolveImportedTikzStyle(ref,createImportedTikzResolutionContext(applied))},null,2));
writeFileSync(base+'bounds.sty',source);
for(const exportMode of ['standalone','inlineMath'])writeFileSync(base+'bounds-'+exportMode+'.tex',generateTikz(applied,{exportMode}));
writeFileSync(base+'bounds.tex',String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{bounds.sty}
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
\input{bounds-standalone.tex}
\[\input{bounds-inlineMath.tex}\]
\end{document}
`);
