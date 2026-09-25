// Literal inputs and independently specified expected paint for the three
// review reproductions. No production parser/resolver creates these values.
export const pointImportedPaintSources = {
  intent: String.raw`\tikzstyle{example}=[fill=\mycolor,text=red]
\tikzstyle{unknown controls}=[fill=\mycolor,text=\mytext,draw=\myborder,fill opacity=\myalpha,line width=\mywidth]
`,
  base: String.raw`\tikzset{base/.style={fill=red,text=green}}`,
  outer: String.raw`\tikzset{outer/.style={base,draw=blue}}`,
  colorBase: String.raw`\definecolor{PriorPaint}{HTML}{123456}
\tikzset{base/.style={fill=PriorPaint,text=green}}`,
  missing: String.raw`\tikzset{outer/.style={absent base,draw=blue}}`,
  later: String.raw`\tikzset{absent base/.style={fill=red,text=green}}`,
  redefined: String.raw`\tikzset{/tikz/outer/.style={fill=yellow,text=blue,draw=green}}`,
  unsupported: String.raw`\definecolor{red}{cmyk}{1,0,0,0}
\tikzstyle{myPoint}=[fill=red,text=red]`,
}
