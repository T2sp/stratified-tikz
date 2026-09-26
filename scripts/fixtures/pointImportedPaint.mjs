// Literal inputs and independently specified expected paint for the
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
  clear: String.raw`\tikzstyle{redpoint}=[fill=red]`,
  clearIndependent: String.raw`\tikzset{independent point/.style={fill=blue,fill opacity=.35,text=red,text opacity=.6,draw=green,draw opacity=.7,line width=2pt,dash pattern=on 3pt off 2pt,dash phase=1pt,line cap=round,line join=bevel}}`,
  mutation: String.raw`\tikzset{
  myPoint/.style={fill=red,text=red},
  myPoint/.append style={fill=blue,text=blue}
}`,
  directoryMutation: String.raw`\tikzset{
  myPoint/.style={fill=red,text=red},
  myPoint/.append style={/other/.cd},
  /other/text/.style={/tikz/text=blue,/tikz/.cd},
  outer/.style={myPoint,text=green}
}`,
  directoryIndependent: String.raw`\tikzset{independent/.style={fill=blue,text=green,draw=red}}`,
}
