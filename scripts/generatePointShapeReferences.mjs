/** Offline PGF oracle. Application code and solver outputs are never imported. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pointShapeReferenceCases } from './pointShapeReferenceCases.mjs'

const output = resolve(process.argv[2] ?? 'tests/fixtures/point-node-shapes')
const work = mkdtempSync(join(tmpdir(), 'stz-32c-pgf-'))
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const sourcePath = '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex'
const sourceHash = createHash('sha256').update(readFileSync(sourcePath)).digest('hex')
const header = String.raw`\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{shapes.geometric}
\pagestyle{empty}
\makeatletter
\newwrite\fixtureout
\immediate\openout\fixtureout=geometry.txt
\newcommand\fixedshape[7]{%
\begin{pgfpicture}\begingroup
\pgfkeys{#7}%
\setbox\pgfnodeparttextbox=\hbox{}%
\wd\pgfnodeparttextbox=#3pt\ht\pgfnodeparttextbox=#4pt\dp\pgfnodeparttextbox=#5pt%
\pgfsetlinewidth{#6pt}%
\immediate\write\fixtureout{CASE #1}%
\let\originalusepath\pgfusepath
\def\pgfusepath##1{\pgfgetpath\fixturepath\immediate\write\fixtureout{PAINT ##1; PATH \meaning\fixturepath}\originalusepath{##1}}%
\pgfmultipartnode{#2}{center}{fixture}{\pgfusepath{stroke}}%
\pgfpointanchor{fixture}{center}\immediate\write\fixtureout{CENTER \the\pgf@x,\the\pgf@y}%
\pgfpointanchor{fixture}{text}\immediate\write\fixtureout{TEXT \the\pgf@x,\the\pgf@y}%
\endgroup\end{pgfpicture}\par}
\makeatother
\begin{document}
`
const document = header + pointShapeReferenceCases.map((entry) => {
  const keys = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
  const pgfKeys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
  const options = keys.map((key, i) => `/pgf/${pgfKeys[i]}=${entry[key]}pt`).concat(entry.options || []).join(',')
  return String.raw`\fixedshape{${entry.id}}{${entry.shape}}{${entry.body.width}}{${entry.body.height}}{${entry.body.depth}}{${entry.lineWidth}}{${options}}`
}).join('\n') + '\n\\end{document}\n'
mkdirSync(output, { recursive: true })
writeFileSync(join(work, 'fixed-box.tex'), document)
writeFileSync(join(output, 'fixed-box.tex'), document)
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
let log
try { log = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 }) }
catch (error) { writeFileSync(join(work, 'command.log'), error.stdout ?? String(error)); throw error }
writeFileSync(join(work, 'command.log'), log)
const raw = readFileSync(join(work, 'geometry.txt'), 'utf8')
writeFileSync(join(output, 'geometry.txt'), raw)
const records = []
for (const line of raw.trim().split('\n')) {
  if (line.startsWith('CASE ')) records.push({ ...pointShapeReferenceCases.find((entry) => entry.id === line.slice(5)), paints: [] })
  else if (line.startsWith('PAINT ')) {
    const [, action, path] = /^PAINT (.*?); PATH macro:->(.*)$/.exec(line) ?? []
    assert.ok(action && path, line)
    const tokens = [...path.matchAll(/\\pgfsyssoftpath@(\w+token)\s*\{(-?[\d.]+)pt\}\{(-?[\d.]+)pt\}/g)]
      .map(([, kind, x, y]) => ({ kind, x: +x, y: -Number(y) }))
    assert.ok(tokens.length, line)
    records.at(-1).paints.push({ action, tokens })
  } else if (/^(CENTER|TEXT) /.test(line)) {
    const [, key, x, y] = /^(CENTER|TEXT) (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(key, line)
    records.at(-1)[key.toLowerCase()] = { x: +x, y: -Number(y) }
  } else throw new Error(`Unexpected PGF evidence: ${line}`)
}
assert.equal(records.length, pointShapeReferenceCases.length)
assert.ok(records.every((entry) => entry.paints.some((paint) => paint.action === 'stroke') && entry.center && entry.text))
const version = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
const reference = { schema: 'stz-pgf-point-shapes-v1', pgfVersion: '3.1.11a', sourcePath, sourceHash,
  upstream: 'https://github.com/pgf-tikz/pgf/releases/tag/3.1.11a', engine: version,
  command: [engine, ...args], units: 'TeX pt; y sign reversed for SVG; no CSS/PDF bp conversion',
  sourceTexSha256: createHash('sha256').update(document).digest('hex'),
  geometrySha256: createHash('sha256').update(raw).digest('hex'), cases: records }
writeFileSync(join(output, 'references.json'), JSON.stringify(reference, null, 2) + '\n')
console.log(JSON.stringify({ result: 'generated', cases: records.length, output, work, sourceHash, engine: version }, null, 2))
