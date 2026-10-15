/** Additive PGF oracle. No production geometry, path or style value is imported. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const engineVersion = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
const sourcePaths = ['basiclayer/pgfcorepathconstruct.code.tex', 'basiclayer/pgfcorepoints.code.tex',
  'basiclayer/pgfcoretransformations.code.tex', 'modules/pgfmoduleshapes.code.tex',
  'libraries/shapes/pgflibraryshapes.geometric.code.tex', 'math/pgfmathfunctions.trigonometric.code.tex']
  .map(path => `/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/${path}`)
const arcCases = [[11, 7], [-11, 7], [11, -7], [-11, -7]].flatMap(([rx, ry]) => [
  { suffix: 'full-forward', start: 0, end: 360, rotation: 0, closed: true },
  { suffix: 'full-reverse', start: 0, end: -360, rotation: -23, closed: true },
  { suffix: 'partial-forward', start: 30, end: 210, rotation: 37, closed: false },
  { suffix: 'partial-reverse', start: 210, end: 30, rotation: 37, closed: false },
].map(({ suffix, ...entry }) => ({ ...entry, id: `${rx < 0 ? 'negative' : 'positive'}-x-${ry < 0 ? 'negative' : 'positive'}-y-${suffix}`,
  kind: 'arc', rx, ry, center: { x: 3, y: -5 }, lineWidth: .4 })))
const nodeCases = [
  { id: 'review-mixed-axes', body: { width: 20, height: 8, depth: 3 }, innerXSep: -30, innerYSep: 2 },
  { id: 'native-empty-mixed-axes', body: { width: 0, height: 0, depth: 0 }, innerXSep: -20, innerYSep: 7.5 },
].map(entry => ({ ...entry, kind: 'node', shape: 'ellipse', minimumWidth: -2, minimumHeight: -5,
  outerXSep: 0, outerYSep: 0, lineWidth: .4, anchor: 'center' }))
const cases = [...arcCases, ...nodeCases]
const header = String.raw`\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{shapes.geometric}
\typeout{STZ PGF VERSION \pgfversion}
\pagestyle{empty}
\makeatletter
\newwrite\fixtureout
\immediate\openout\fixtureout=geometry.txt
\newcommand\recordpaint{\pgfgetpath\fixturepath\immediate\write\fixtureout{PAINT stroke; PATH \meaning\fixturepath}\pgfusepath{stroke}}
\newcommand\fixedarc[9]{%
\begin{pgfpicture}\begingroup\pgfsetlinewidth{.4pt}\pgftransformrotate{#6}%
\immediate\write\fixtureout{CASE #1}%
\pgfpathmoveto{\pgfpointadd{\pgfpoint{#7pt}{#8pt}}{\pgfpointpolar{#4}{#2pt and #3pt}}}%
\pgfpatharc{#4}{#5}{#2pt and #3pt}%
\ifnum#9=1\pgfpathclose\fi\recordpaint
\endgroup\end{pgfpicture}\par}
\newcommand\fixedellipse[6]{%
\begin{pgfpicture}\begingroup\normalfont
\pgfkeys{/pgf/inner xsep=#5pt,/pgf/inner ysep=#6pt,/pgf/outer xsep=0pt,/pgf/outer ysep=0pt,/pgf/minimum width=-2pt,/pgf/minimum height=-5pt}%
\setbox\pgfnodeparttextbox=\hbox{}%
\wd\pgfnodeparttextbox=#2pt\ht\pgfnodeparttextbox=#3pt\dp\pgfnodeparttextbox=#4pt%
\pgfsetlinewidth{.4pt}\immediate\write\fixtureout{CASE #1}%
\pgfmultipartnode{ellipse}{center}{fixture}{\recordpaint}%
\foreach\anchorname in {text,center,base,mid,east,west,north,south,north east,north west,south east,south west,base east,base west,mid east,mid west,0,13,45,90,181,270,315,-30}{\pgfpointanchor{fixture}{\anchorname}\immediate\write\fixtureout{ANCHOR \anchorname; \the\pgf@x,\the\pgf@y}}%
\endgroup\end{pgfpicture}\par}
\makeatother
\begin{document}
`
const document = header + arcCases.map(e => String.raw`\fixedarc{${e.id}}{${e.rx}}{${e.ry}}{${e.start}}{${e.end}}{${e.rotation}}{${e.center.x}}{${e.center.y}}{${e.closed ? 1 : 0}}`).join('\n')
  + '\n' + nodeCases.map(e => String.raw`\fixedellipse{${e.id}}{${e.body.width}}{${e.body.height}}{${e.body.depth}}{${e.innerXSep}}{${e.innerYSep}}`).join('\n')
  + '\n\\end{document}\n'
const work = mkdtempSync(join(tmpdir(), 'stz-32d-signed-traversal-pgf-'))
writeFileSync(join(work, 'fixed-box.tex'), document)
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
const compilation = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 })
assert.equal(/STZ PGF VERSION (\S+)/.exec(compilation)?.[1], '3.1.11a')
const raw = readFileSync(join(work, 'geometry.txt'), 'utf8'), records = []
for (const line of raw.trim().split('\n')) {
  if (line.startsWith('CASE ')) {
    const entry = cases.find(({ id }) => id === line.slice(5)); assert.ok(entry, line)
    records.push({ ...entry, paints: [], expectedAnchors: {} })
  } else if (line.startsWith('PAINT ')) {
    const [, action, path] = /^PAINT (.*?); PATH macro:->(.*)$/.exec(line) ?? []
    assert.ok(action && path, line)
    const tokens = [...path.matchAll(/\\pgfsyssoftpath@(\w+token)\s*\{(-?[\d.]+)pt\}\{(-?[\d.]+)pt\}/g)]
      .map(([, kind, x, y]) => ({ kind, x: +x, y: -Number(y) }))
    assert.ok(tokens.length); records.at(-1).paints.push({ action, tokens })
  } else if (line.startsWith('ANCHOR ')) {
    const [, name, x, y] = /^ANCHOR (.*?); (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(name && x && y, line); records.at(-1).expectedAnchors[name] = { x: +x, y: -Number(y) }
  } else throw new Error(`Unexpected independent PGF record: ${line}`)
}
assert.equal(records.length, 18); assert.ok(records.every(e => e.paints.length === 1))
for (const file of ['fixed-box.tex', 'fixed-box.log', 'fixed-box.pdf', 'geometry.txt']) writeFileSync(join(output, file), readFileSync(join(work, file)))
writeFileSync(join(output, 'compilation.txt'), compilation)
const artifactHashes = Object.fromEntries(['fixed-box.tex', 'fixed-box.log', 'fixed-box.pdf', 'geometry.txt', 'compilation.txt', 'generate.mjs']
  .map(file => [file, hash(readFileSync(join(output, file)))]))
const references = { schema: 'stz-pgf-signed-traversal-v1', engine: engineVersion, pgfVersion: '3.1.11a', command: [engine, ...args], exitCode: 0,
  units: 'TeX pt; raw PGF Y is negated once for SVG; rotations apply before that reflection; no bp conversion',
  sourceHashes: Object.fromEntries(sourcePaths.map(file => [file, hash(readFileSync(file))])), artifactHashes, cases: records }
writeFileSync(join(output, 'references.json'), JSON.stringify(references, null, 2) + '\n')
console.log(JSON.stringify({ cases: records.length, work, engine: engineVersion, pgfVersion: references.pgfVersion }))
