/** Additive independent PGF oracle; no application geometry or support tables. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const review = JSON.parse(readFileSync(join(output, 'review/manifest.json'), 'utf8'))
const hash = (value) => createHash('sha256').update(value).digest('hex')
for (const [file, expected] of Object.entries(review.artifactHashes)) {
  assert.equal(hash(readFileSync(join(output, 'review', file))), expected, `Retained review artifact: ${file}`)
}
for (const [file, expected] of Object.entries(review.sourceHashes)) {
  assert.equal(hash(readFileSync(file)), expected, `Authenticated PGF source: ${file}`)
}
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const version = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
assert.equal(version, review.engine)
const work = mkdtempSync(join(tmpdir(), 'stz-32d-signed-axes-pgf-'))
const anchors = ['text', 'center', 'base', 'mid', 'east', 'west', 'north', 'south', 'north east', 'north west', 'south east', 'south west',
  'base east', 'base west', 'mid east', 'mid west', '0', '13', '45', '90', '181', '270', '315', '-30']
const cases = ['ellipse', 'rectangle'].flatMap((shape) => [
  { id: `${shape}-empty-strong`, shape, body: { width: 0, height: 0, depth: 0 }, innerXSep: -100, innerYSep: -100,
    outerXSep: 0, outerYSep: 0, minimumWidth: -160, minimumHeight: -160 },
  { id: `${shape}-small-minima`, shape, body: { width: 20, height: 8, depth: 3 }, innerXSep: -30, innerYSep: -30,
    outerXSep: 0, outerYSep: 0, minimumWidth: -2, minimumHeight: -5 },
  { id: `${shape}-mixed-axes`, shape, body: { width: 20, height: 8, depth: 3 }, innerXSep: -30, innerYSep: 2,
    outerXSep: 0, outerYSep: 0, minimumWidth: -2, minimumHeight: -5 },
  { id: `${shape}-outer-crossing`, shape, body: { width: 20, height: 8, depth: 3 }, innerXSep: -30, innerYSep: 2,
    outerXSep: 2, outerYSep: -20, minimumWidth: -2, minimumHeight: -5 },
].map((entry) => ({ ...entry, lineWidth: .4, anchors })))
const header = String.raw`\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{shapes.geometric}
\typeout{STZ PGF VERSION \pgfversion}
\pagestyle{empty}
\makeatletter
\newwrite\fixtureout
\immediate\openout\fixtureout=geometry.txt
\newcommand\fixedshape[8]{%
\begin{pgfpicture}\begingroup\normalfont
\pgfkeys{#7}%
\setbox\pgfnodeparttextbox=\hbox{}%
\wd\pgfnodeparttextbox=#3pt\ht\pgfnodeparttextbox=#4pt\dp\pgfnodeparttextbox=#5pt%
\pgfsetlinewidth{#6pt}%
\immediate\write\fixtureout{CASE #1}%
\pgfmathsetlength\pgf@x{1em}\pgfmathsetlength\pgf@y{1ex}%
\immediate\write\fixtureout{FONT \the\pgf@x,\the\pgf@y}%
\let\originalusepath\pgfusepath
\def\pgfusepath##1{\pgfgetpath\fixturepath\immediate\write\fixtureout{PAINT ##1; PATH \meaning\fixturepath}\originalusepath{##1}}%
\pgfmultipartnode{#2}{center}{fixture}{\pgfusepath{stroke}}%
\foreach\anchorname in {#8}{\pgfpointanchor{fixture}{\anchorname}\immediate\write\fixtureout{ANCHOR \anchorname; \the\pgf@x,\the\pgf@y}}%
\endgroup\end{pgfpicture}\par}
\makeatother
\begin{document}
`
const document = header + cases.map((entry) => {
  const keys = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
  const names = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
  const options = keys.map((key, index) => `/pgf/${names[index]}=${entry[key]}pt`).join(',')
  return String.raw`\fixedshape{${entry.id}}{${entry.shape}}{${entry.body.width}}{${entry.body.height}}{${entry.body.depth}}{${entry.lineWidth}}{${options}}{${entry.anchors.join(',')}}`
}).join('\n') + '\n\\end{document}\n'
writeFileSync(join(work, 'fixed-box.tex'), document)
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
const compilation = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 })
const pgfVersion = /STZ PGF VERSION (\S+)/.exec(compilation)?.[1]
assert.equal(pgfVersion, review.PGFVersion, 'The compiler-loaded PGF version must match the authenticated source version')
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
  } else if (line.startsWith('FONT ')) {
    const [, em, ex] = /^FONT (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(em && ex, line)
    records.at(-1).fontContext = { em: Number(em), ex: Number(ex) }
  } else if (line.startsWith('ANCHOR ')) {
    const [, name, x, y] = /^ANCHOR (.*?); (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(name && x && y, line)
    records.at(-1).expectedAnchors[name] = { x: Number(x), y: -Number(y) }
  } else throw new Error(`Unexpected PGF observation: ${line}`)
}
assert.equal(records.length, 8)
for (const entry of records) {
  assert.equal(entry.paints.length, 1)
  assert.equal(Object.keys(entry.expectedAnchors).length, entry.anchors.length)
}
mkdirSync(output, { recursive: true })
for (const [file, content] of [['fixed-box.tex', document], ['geometry.txt', raw], ['compilation.txt', compilation]]) {
  writeFileSync(join(output, file), content)
}
const reference = { schema: 'stz-pgf-signed-basic-axes-v1', pgfVersion, engine: version,
  command: [engine, ...args], exitCode: 0, sourceHashes: review.sourceHashes,
  units: 'TeX pt; parsed observations reverse PGF positive-Y-up once to SVG positive-Y-down; production uses 1.2 SVG units/TeX pt',
  sourceTexSha256: hash(document), geometrySha256: hash(raw), compilationSha256: hash(compilation),
  generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))), cases: records }
writeFileSync(join(output, 'references.json'), JSON.stringify(reference, null, 2) + '\n')
console.log(JSON.stringify({ result: 'generated', cases: records.length, anchors: records.length * anchors.length, output, work, engine: version }))
