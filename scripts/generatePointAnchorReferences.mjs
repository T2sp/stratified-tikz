/** Offline PGF oracle. Application code and solver outputs are never imported. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pointAnchorReferenceCases, pointAnchorFailureCases } from './pointAnchorReferenceCases.mjs'

const output = resolve(process.argv[2] ?? 'tests/fixtures/point-node-anchors')
const work = mkdtempSync(join(tmpdir(), 'stz-32d-pgf-'))
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const sourcePaths = ['/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex',
  '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex',
  '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex',
  '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/math/pgfmathcalc.code.tex',
  '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.trigonometric.code.tex',
  '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.basic.code.tex',
  '/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex']
const hash = (source) => createHash('sha256').update(source).digest('hex')
assert.equal(new Set(pointAnchorReferenceCases.map(({ id }) => id)).size, pointAnchorReferenceCases.length, 'Independent scenario identities must be unique')
const header = String.raw`\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{shapes.geometric}
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
function shapeCommand(entry) {
  const keys = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
  const pgfKeys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
  const options = keys.map((key, i) => `/pgf/${pgfKeys[i]}=${entry[key]}pt`).concat(entry.options || []).join(',')
  return String.raw`\fixedshape{${entry.id}}{${entry.pgfShape}}{${entry.body.width}}{${entry.body.height}}{${entry.body.depth}}{${entry.lineWidth}}{${options}}{${entry.anchors.join(',')}}`
}
const document = header + pointAnchorReferenceCases.map(shapeCommand).join('\n') + '\n\\end{document}\n'
mkdirSync(output, { recursive: true })
writeFileSync(join(work, 'fixed-box.tex'), document)
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
let log
try { log = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 }) }
catch (error) { writeFileSync(join(work, 'command.log'), error.stdout ?? String(error)); throw error }
writeFileSync(join(output, 'compilation.txt'), log)
const raw = readFileSync(join(work, 'geometry.txt'), 'utf8')
const records = []
for (const line of raw.trim().split('\n')) {
  if (line.startsWith('CASE ')) records.push({ ...pointAnchorReferenceCases.find((entry) => entry.id === line.slice(5)), paints: [], expectedAnchors: {} })
  else if (line.startsWith('PAINT ')) {
    const [, action, path] = /^PAINT (.*?); PATH macro:->(.*)$/.exec(line) ?? []
    assert.ok(action && path, line)
    const tokens = [...path.matchAll(/\\pgfsyssoftpath@(\w+token)\s*\{(-?[\d.]+)pt\}\{(-?[\d.]+)pt\}/g)]
      .map(([, kind, x, y]) => ({ kind, x: +x, y: -Number(y) }))
    assert.ok(tokens.length, line)
    records.at(-1).paints.push({ action, tokens })
  } else if (line.startsWith('FONT ')) {
    const [, em, ex] = /^FONT (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(em && ex, line)
    records.at(-1).fontContext = { em: +em, ex: +ex }
  } else if (line.startsWith('ANCHOR ')) {
    const [, anchor, x, y] = /^ANCHOR (.*?); (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(anchor && x && y, line)
    records.at(-1).expectedAnchors[anchor] = { x: +x, y: -Number(y) }
  } else throw new Error(`Unexpected PGF evidence: ${line}`)
}
assert.equal(records.length, pointAnchorReferenceCases.length)
for (const entry of records) {
  assert.ok(entry.paints.some((paint) => paint.action === 'stroke'), `${entry.id}: missing stroke evidence`)
  assert.equal(Object.keys(entry.expectedAnchors).length, entry.anchors.length, `${entry.id}: ${JSON.stringify(Object.keys(entry.expectedAnchors))}`)
}
const version = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
const reference = { schema: 'stz-pgf-point-anchors-v1', pgfVersion: '3.1.11a', sourceHashes: Object.fromEntries(sourcePaths.map((path) => [path, hash(readFileSync(path))])),
  upstream: 'https://github.com/pgf-tikz/pgf/releases/tag/3.1.11a', engine: version,
  command: [engine, ...args], units: 'TeX pt; y sign reversed for SVG; no CSS/PDF bp conversion',
  sourceTexSha256: hash(document), geometrySha256: hash(raw), cases: records, failures: [] }
const failureOutput = join(output, 'failures')
mkdirSync(failureOutput, { recursive: true })
for (const entry of pointAnchorFailureCases) {
  const input = header + shapeCommand(entry) + '\n\\end{document}\n'
  const failureWork = join(work, entry.id)
  mkdirSync(failureWork)
  writeFileSync(join(failureWork, 'fixed-box.tex'), input)
  let exitCode = 0, compilation
  try { compilation = execFileSync(engine, args, { cwd: failureWork, encoding: 'utf8', maxBuffer: 8e6 }) }
  catch (error) { exitCode = error.status; compilation = String(error.stdout ?? error) }
  assert.ok(Number.isInteger(exitCode) && exitCode !== 0, `${entry.id}: the independent PGF singular branch must fail`)
  assert.ok(compilation.includes(entry.expectedError), `${entry.id}: retain the expected primary PGF domain failure`)
  const geometry = readFileSync(join(failureWork, 'geometry.txt'), 'utf8')
  assert.ok(!geometry.includes(`ANCHOR ${entry.anchors[0]};`), `${entry.id}: invalid anchor must not have a fabricated coordinate`)
  const artifacts = { input: `${entry.id}.tex`, compilation: `${entry.id}.txt`, geometry: `${entry.id}-geometry.txt` }
  for (const [kind, value] of [['input', input], ['compilation', compilation], ['geometry', geometry]]) writeFileSync(join(failureOutput, artifacts[kind]), value)
  reference.failures.push({ ...entry, exitCode, artifacts, hashes: { input: hash(input), compilation: hash(compilation), geometry: hash(geometry) } })
}
writeFileSync(join(output, 'fixed-box.tex'), document)
writeFileSync(join(output, 'geometry.txt'), raw)
writeFileSync(join(output, 'references.json'), JSON.stringify(reference, null, 2) + '\n')
console.log(JSON.stringify({ result: 'generated', cases: records.length, anchors: records.reduce((sum, item) => sum + item.anchors.length, 0),
  independentExpectedFailures: reference.failures.length, output, work, sourceHashes: reference.sourceHashes, engine: version }, null, 2))
