/** Independent PGF input/oracle; deliberately imports no production module. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const retained = JSON.parse(readFileSync(join(output, 'review/manifest.json'), 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
for (const [file, expected] of Object.entries(retained.artifactHashes)) {
  assert.equal(hash(readFileSync(join(output, 'review', file))), expected, file)
}
for (const [file, expected] of Object.entries(retained.sourceHashes)) assert.equal(hash(readFileSync(file)), expected, file)
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const engineVersion = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
assert.equal(engineVersion, retained.engine)
const nodeCases = [
  { id: 'zero-x-positive', innerXSep: 0, innerYSep: 20, minimumWidth: 0, minimumHeight: 0 },
  { id: 'zero-y-positive', innerXSep: 20, innerYSep: 0, minimumWidth: 0, minimumHeight: 0 },
  { id: 'both-zero', innerXSep: 0, innerYSep: 0, minimumWidth: 0, minimumHeight: 0 },
  { id: 'zero-x-negative', innerXSep: 0, innerYSep: -20, minimumWidth: 0, minimumHeight: -100 },
  { id: 'zero-y-negative', innerXSep: -20, innerYSep: 0, minimumWidth: -100, minimumHeight: 0 },
].map((entry) => ({ ...entry, kind: 'node', shape: 'ellipse', body: { width: 0, height: 0, depth: 0 },
  outerXSep: 0, outerYSep: 0, lineWidth: .4, anchor: 'center' }))
const arcCases = [
  { id: 'partial-zero-x-turn', rx: 0, ry: 20, start: 45, end: 135, rotation: 0 },
  { id: 'partial-zero-x-reversed', rx: 0, ry: 20, start: 135, end: 45, rotation: 0 },
  { id: 'partial-zero-x-signed-rotated', rx: 0, ry: -20, start: 45, end: 135, rotation: 37 },
  { id: 'partial-zero-y-turn', rx: 20, ry: 0, start: -45, end: 45, rotation: 0 },
  { id: 'partial-zero-y-signed-reversed', rx: -20, ry: 0, start: 45, end: -45, rotation: -23 },
  { id: 'partial-zero-x-extra-cycle', rx: 0, ry: 20, start: 405, end: 495, rotation: 37 },
].map((entry) => ({ ...entry, kind: 'arc', center: { x: 0, y: 0 }, lineWidth: .4 }))
const cases = [...nodeCases, ...arcCases]
const header = String.raw`\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{shapes.geometric}
\typeout{STZ PGF VERSION \pgfversion}
\pagestyle{empty}
\makeatletter
\newwrite\fixtureout
\immediate\openout\fixtureout=geometry.txt
\newcommand\recordpaint{\pgfgetpath\fixturepath\immediate\write\fixtureout{PAINT stroke; PATH \meaning\fixturepath}\pgfusepath{stroke}}
\newcommand\fixedellipse[5]{%
\begin{pgfpicture}\begingroup\normalfont
\pgfkeys{/pgf/inner xsep=#2pt,/pgf/inner ysep=#3pt,/pgf/outer xsep=0pt,/pgf/outer ysep=0pt,/pgf/minimum width=#4pt,/pgf/minimum height=#5pt}%
\setbox\pgfnodeparttextbox=\hbox{}%
\wd\pgfnodeparttextbox=0pt\ht\pgfnodeparttextbox=0pt\dp\pgfnodeparttextbox=0pt%
\pgfsetlinewidth{.4pt}%
\immediate\write\fixtureout{CASE #1}%
\pgfmultipartnode{ellipse}{center}{fixture}{\recordpaint}%
\foreach\anchorname in {center,north,south,east,west}{\pgfpointanchor{fixture}{\anchorname}\immediate\write\fixtureout{ANCHOR \anchorname; \the\pgf@x,\the\pgf@y}}%
\endgroup\end{pgfpicture}\par}
\newcommand\fixedarc[6]{%
\begin{pgfpicture}\begingroup
\pgfsetlinewidth{.4pt}\pgftransformrotate{#6}%
\immediate\write\fixtureout{CASE #1}%
\pgfpathmoveto{\pgfpointpolar{#4}{#2pt and #3pt}}%
\pgfpatharc{#4}{#5}{#2pt and #3pt}%
\recordpaint
\endgroup\end{pgfpicture}\par}
\makeatother
\begin{document}
`
const document = header + nodeCases.map((entry) =>
  String.raw`\fixedellipse{${entry.id}}{${entry.innerXSep}}{${entry.innerYSep}}{${entry.minimumWidth}}{${entry.minimumHeight}}`).join('\n')
  + '\n' + arcCases.map((entry) => String.raw`\fixedarc{${entry.id}}{${entry.rx}}{${entry.ry}}{${entry.start}}{${entry.end}}{${entry.rotation}}`).join('\n')
  + '\n\\end{document}\n'
const work = mkdtempSync(join(tmpdir(), 'stz-32d-zero-axis-pgf-'))
writeFileSync(join(work, 'fixed-box.tex'), document)
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
const compilation = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 })
assert.equal(/STZ PGF VERSION (\S+)/.exec(compilation)?.[1], retained.pgfVersion)
const raw = readFileSync(join(work, 'geometry.txt'), 'utf8')
const records = []
for (const line of raw.trim().split('\n')) {
  if (line.startsWith('CASE ')) {
    const entry = cases.find(({ id }) => id === line.slice(5))
    assert.ok(entry, line)
    records.push({ ...entry, paints: [], expectedAnchors: {} })
  } else if (line.startsWith('PAINT ')) {
    const [, action, path] = /^PAINT (.*?); PATH macro:->(.*)$/.exec(line) ?? []
    assert.ok(action && path, line)
    const tokens = [...path.matchAll(/\\pgfsyssoftpath@(\w+token)\s*\{(-?[\d.]+)pt\}\{(-?[\d.]+)pt\}/g)]
      .map(([, kind, x, y]) => ({ kind, x: Number(x), y: -Number(y) }))
    assert.ok(tokens.length, line)
    records.at(-1).paints.push({ action, tokens })
  } else if (line.startsWith('ANCHOR ')) {
    const [, name, x, y] = /^ANCHOR (.*?); (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(name && x && y, line)
    records.at(-1).expectedAnchors[name] = { x: Number(x), y: -Number(y) }
  } else throw new Error(`Unexpected PGF record: ${line}`)
}
assert.equal(records.length, 11)
assert.ok(records.every((entry) => entry.paints.length === 1))
for (const [file, bytes] of [['fixed-box.tex', document], ['geometry.txt', raw], ['compilation.txt', compilation]]) writeFileSync(join(output, file), bytes)
const references = { schema: 'stz-pgf-zero-axis-paths-v1', engine: engineVersion, pgfVersion: retained.pgfVersion,
  sourceHashes: retained.sourceHashes, command: [engine, ...args], exitCode: 0,
  units: 'TeX pt; parser reverses raw PGF positive-Y-up once to SVG positive-Y-down; production uses 1.2 SVG units/TeX pt',
  sourceTexSha256: hash(document), geometrySha256: hash(raw), compilationSha256: hash(compilation),
  generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))), cases: records }
writeFileSync(join(output, 'references.json'), JSON.stringify(references, null, 2) + '\n')
console.log(JSON.stringify({ cases: records.length, work, engine: engineVersion, pgfVersion: retained.pgfVersion }))
