import { writeFileSync } from 'node:fs';
import { createEmptyDiagram, createPointStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/constructors.ts';
import { importTikzStyleFile, createImportedTikzResolutionContext, resolveImportedTikzStyle } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/importedTikzStyles.ts';
import { applyUserStylePresetToStratum } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/stylePresets.ts';
import { getPointPaint } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/styles.ts';
import { generateTikz } from '/Users/takamatoshinori/Desktop/stratified-tikz/src/tikz/generateTikz.ts';
const base = '/private/tmp/stz-32b-model-review/';
const sources = {
 macro: String.raw`\tikzset{myPoint/.style={text=blue}}\newcommand{\unusedPaint}{\tikzset{myPoint/.style={text=red}}}`,
 conditional: String.raw`\tikzset{myPoint/.style={text=blue}}\iffalse\tikzset{myPoint/.style={text=red}}\fi`,
 groupedColor: String.raw`\definecolor{Custom}{HTML}{0000FF}{\definecolor{Custom}{HTML}{FF0000}}\tikzset{myPoint/.style={text=Custom}}`,
};
for (const [name, source] of Object.entries(sources)) {
 const d=createEmptyDiagram({ambientDimension:2}); d.strata=[createPointStratum({ambientDimension:2,id:'p',text:'APP',position:{x:0,y:0,z:0}})];
 const imported=importTikzStyleFile(d, name+'.sty',source); const ref=imported.references.find(x=>x.key==='myPoint');
 const preset=imported.diagram.userStylePresets.find(x=>x.kind==='point'&&x.importedTikzStyleReferenceId===ref.id);
 const applied=applyUserStylePresetToStratum(imported.diagram,'p',preset.id);
 console.log(name, JSON.stringify({parseWarnings:imported.parseResult.warnings, preview: resolveImportedTikzStyle(ref,createImportedTikzResolutionContext(applied)),paint:getPointPaint(applied.strata[0].style)}));
 writeFileSync(base+name+'.sty',source);
 for(const exportMode of ['standalone','inlineMath'])writeFileSync(base+name+'-'+exportMode+'.tex',generateTikz(applied,{exportMode}));
 writeFileSync(base+name+'.tex',String.raw`\documentclass{article}
\usepackage{tikz}
\pagestyle{empty}
\pdfcompresslevel=0
\pdfobjcompresslevel=0
\begin{document}
\typeout{STZ-PGF-VERSION=\pgfversion}
\input{`+name+String.raw`.sty}
\begin{tikzpicture}\node[myPoint] at (0,0) {PGF};\end{tikzpicture}
\input{`+name+String.raw`-standalone.tex}
\[\input{`+name+String.raw`-inlineMath.tex}\]
\end{document}
`);
}
