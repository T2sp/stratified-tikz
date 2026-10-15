/** Additive offline PGF oracle: literal upstream register stages and real nodes.
 * Never imports application geometry or uses application output as expected data. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const originalBytes = readFileSync(join(output, '../references.json'))
const original = JSON.parse(originalBytes)
const sourceHashes = { ...original.sourceHashes }
for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(file)), expected, file)
const sourcePath = Object.keys(sourceHashes).find(file => file.endsWith('pgflibraryshapes.geometric.code.tex'))
const upstream = readFileSync(sourcePath, 'utf8')
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const engineVersion = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
assert.equal(engineVersion, original.engine)
const named = ['center', 'text', 'base', 'mid', 'east', 'north east', 'north', 'north west', 'west', 'south west', 'south', 'south east']
const numeric = ['0', '37', '45', '90', '135', '180', '225', '270', '315', '450', '90.8', '+45.7', '-90.8', '-0.5']
const entry = (id, aspect, overrides = {}) => ({ id, shape: 'diamond', body: { width: 20, height: 8, depth: 3 },
  innerXSep: 1.5, innerYSep: 1.5, outerXSep: 0, outerYSep: 0, minimumWidth: 1, minimumHeight: 1,
  lineWidth: .4, parameters: { aspect }, anchor: 'north', anchors: [...named, ...numeric], ...overrides })
const cases = [
  ...[.01, .01001, .0101, .02999, .03, .03001, .09999, .1, .10001, .2, .6, 1.1, 100].map(aspect => entry(`aspect-${aspect}`, aspect)),
  entry('independent-width-minimum', .03, { minimumWidth: 90 }),
  entry('independent-height-minimum', .6, { minimumHeight: 90 }),
  entry('asymmetric-signed-separation', .03, { innerXSep: -8.125, innerYSep: 4.25, outerXSep: -1.75, outerYSep: 2.125 }),
  entry('signed-fitted-axes', .1, { innerXSep: -30, innerYSep: -10, minimumWidth: -100, minimumHeight: -100, outerXSep: 2.25, outerYSep: -1.25 }),
  // Decimal spellings immediately below negative half-sp ties are intentional.
  entry('odd-sp-body-and-products', .03, { body: { width: 20.0000152587890625, height: 8.0000152587890625, depth: 3.0000152587890625 }, innerXSep: Number('-1.1250076293945312'), innerYSep: .333333, outerXSep: .37500762939453125, outerYSep: Number('-.6250076293945312') }),
  entry('empty-body', .01, { body: { width: 0, height: 0, depth: 0 }, innerXSep: 10, innerYSep: 5.5 }),
  entry('native-empty-width-minimum', .01, { body: { width: 0, height: 0, depth: 0 }, innerXSep: 1, innerYSep: .55, minimumWidth: 20 }),
  entry('zero-body-zero-axes', .01, { body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0, minimumWidth: 0, minimumHeight: 0, anchors: named }),
  entry('empty-independent-minima', 100, { body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0, minimumWidth: 13, minimumHeight: 17 }),
]
const stage = (name, register) => `\\immediate\\write\\fixtureout{STAGE ${name}; \\number${register}}%\n`
let inverse = upstream.split('\\def\\pgfsetshapeaspect#1{%')[1].split('\n}%')[0]
inverse = inverse.replace('\\pgfutil@tempdima=#1pt%', '\\pgfutil@tempdima=#1pt%\n' + stage('aspectSp', '\\pgfutil@tempdima'))
  .replace('\\pgfutil@tempdima=.125\\pgfutil@tempdima%', '\\pgfutil@tempdima=.125\\pgfutil@tempdima%\n' + stage('aspectEighthSp', '\\pgfutil@tempdima'))
  .replace('\\divide\\pgfutil@tempdima by\\c@pgf@counta%', '\\divide\\pgfutil@tempdima by\\c@pgf@counta%\n' + stage('inverseSp', '\\pgfutil@tempdima'))
let fit = upstream.split('\\pgfdeclareshape{diamond}')[1].split('\\savedanchor\\outernortheast{%')[1].split('\n  }%')[0]
fit = fit.replace('\\pgf@x=\\pgf@xa%', stage('initialXSp', '\\pgf@xa') + stage('initialYSp', '\\pgf@ya') + '\\pgf@x=\\pgf@xa%')
  .replace('\\advance\\pgf@x by\\pgfshapeaspect\\pgf@ya%', '\\advance\\pgf@x by\\pgfshapeaspect\\pgf@ya%\n\\pgf@xb=\\pgf@x\\advance\\pgf@xb by-\\pgf@xa%\n' + stage('aspectYSp', '\\pgf@xb'))
  .replace('\\pgf@y=\\pgfshapeaspectinverse\\pgf@xa%', '\\pgf@y=\\pgfshapeaspectinverse\\pgf@xa%\n' + stage('inverseXSp', '\\pgf@y'))
  .replace('\\advance\\pgf@y by\\pgf@ya%', '\\advance\\pgf@y by\\pgf@ya%\n' + stage('fittedXSp', '\\pgf@x') + stage('fittedYSp', '\\pgf@y'))
  .replace('\\pgf@xb=.5\\pgf@xb%', '\\pgf@xb=.5\\pgf@xb%\n' + stage('minimumWidthHalfSp', '\\pgf@xb'))
  .replace('\\pgf@yb=.5\\pgf@yb%', '\\pgf@yb=.5\\pgf@yb%\n' + stage('minimumHeightHalfSp', '\\pgf@yb'))
  .replace('    % Add outer border', stage('limitedXSp', '\\pgf@x') + stage('limitedYSp', '\\pgf@y') + '    % Add outer border')
  .replace('\\advance\\pgf@x by\\pgf@xa%', stage('outerXSp', '\\pgf@xa') + '\\advance\\pgf@x by\\pgf@xa%')
  .replace('\\pgfmathsetlength\\pgf@ya{\\pgfkeysvalueof{/pgf/outer ysep}}%', '\\pgfmathsetlength\\pgf@ya{\\pgfkeysvalueof{/pgf/outer ysep}}%\n' + stage('outerYSp', '\\pgf@ya'))
fit += '\n' + stage('anchorXSp', '\\pgf@x') + stage('anchorYSp', '\\pgf@y')
fit += String.raw`\pgf@xc=\pgf@x\pgf@yc=\pgf@y
\advance\pgf@xc by-1.414213\pgf@xa
\advance\pgf@yc by-1.414213\pgf@ya
` + stage('paintedXSp', '\\pgf@xc') + stage('paintedYSp', '\\pgf@yc')
const trace = '\\def\\traceaspect#1{\n' + inverse + '\n}\n\\def\\tracediamond{\\begingroup\n\\expandafter\\traceaspect\\expandafter{\\pgfshapeaspect}\n' + fit + '\n\\endgroup}\n'
const header = String.raw`\documentclass{article}
\usepackage{tikz}\usetikzlibrary{shapes.geometric}
\typeout{STZ PGF VERSION \pgfversion}\pagestyle{empty}\makeatletter
\newwrite\fixtureout\immediate\openout\fixtureout=geometry.txt
` + trace + String.raw`
\newcommand\fixedshape[8]{%
\begin{pgfpicture}\begingroup\normalfont\pgfkeys{#7}%
\setbox\pgfnodeparttextbox=\hbox{}%
\wd\pgfnodeparttextbox=#3pt\ht\pgfnodeparttextbox=#4pt\dp\pgfnodeparttextbox=#5pt%
\pgfsetlinewidth{#6pt}\immediate\write\fixtureout{CASE #1}%
\pgfmathsetlength\pgf@x{1em}\pgfmathsetlength\pgf@y{1ex}%
\immediate\write\fixtureout{FONT \the\pgf@x,\the\pgf@y}\tracediamond
\let\originalusepath\pgfusepath
\def\pgfusepath##1{\pgfgetpath\fixturepath\immediate\write\fixtureout{PAINT ##1; PATH \meaning\fixturepath}\originalusepath{##1}}%
\pgfmultipartnode{#2}{center}{fixture}{\pgfusepath{stroke}}%
\foreach\anchorname in {#8}{\pgfpointanchor{fixture}{\anchorname}\immediate\write\fixtureout{ANCHOR \anchorname; \the\pgf@x,\the\pgf@y}}%
\endgroup\end{pgfpicture}\par}
\makeatother\begin{document}
`
const fields = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
const tex = header + cases.map(value => {
  const options = fields.map((field, index) => `/pgf/${keys[index]}=${value[field]}pt`).concat(`/pgf/aspect=${value.parameters.aspect}`).join(',')
  return String.raw`\fixedshape{${value.id}}{diamond}{${value.body.width}}{${value.body.height}}{${value.body.depth}}{${value.lineWidth}}{${options}}{${value.anchors.join(',')}}`
}).join('\n') + '\n\\end{document}\n'
const work = mkdtempSync(join(tmpdir(), 'stz-diamond-aspect-pgf-'))
mkdirSync(output, { recursive: true }); writeFileSync(join(work, 'fixed-box.tex'), tex)
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
const compilation = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 })
const raw = readFileSync(join(work, 'geometry.txt'), 'utf8'), records = []
for (const line of raw.trim().split('\n')) {
  if (line.startsWith('CASE ')) records.push({ ...cases.find(value => value.id === line.slice(5)), expectedStages: {}, paints: [], expectedAnchors: {} })
  else if (line.startsWith('FONT ')) {
    const [, em, ex] = /^FONT (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(em && ex, line); records.at(-1).fontContext = { em: +em, ex: +ex }
  } else if (line.startsWith('STAGE ')) {
    const [, name, value] = /^STAGE (\w+); (-?\d+)$/.exec(line) ?? []
    assert.ok(name && value, line); assert.ok(!Object.hasOwn(records.at(-1).expectedStages, name), line)
    records.at(-1).expectedStages[name] = +value
  } else if (line.startsWith('PAINT ')) {
    const [, action, path] = /^PAINT (.*?); PATH macro:->(.*)$/.exec(line) ?? []
    assert.ok(action && path, line)
    const tokens = [...path.matchAll(/\\pgfsyssoftpath@(\w+token)\s*\{(-?[\d.]+)pt\}\{(-?[\d.]+)pt\}/g)].map(([, kind, x, y]) => ({ kind, x: +x || 0, y: -Number(y) || 0 }))
    assert.ok(tokens.length, line); records.at(-1).paints.push({ action, tokens })
  } else if (line.startsWith('ANCHOR ')) {
    const [, name, x, y] = /^ANCHOR (.*?); (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line) ?? []
    assert.ok(name && x && y, line); records.at(-1).expectedAnchors[name] = { x: +x || 0, y: -Number(y) || 0 }
  } else throw new Error(`Unexpected independent PGF evidence: ${line}`)
}
for (const value of records) {
  assert.equal(Object.keys(value.expectedStages).length, 19, value.id)
  assert.equal(Object.keys(value.expectedAnchors).length, value.anchors.length, value.id)
  assert.equal(value.paints.filter(paint => paint.action === 'stroke').length, 1, value.id)
}
const artifactHashes = {}
for (const [file, bytes] of Object.entries({ 'fixed-box.tex': tex, 'geometry.txt': raw, 'compilation.txt': compilation, 'staged-upstream-source.tex': trace,
  'fixed-box.log': readFileSync(join(work, 'fixed-box.log')), 'fixed-box.pdf': readFileSync(join(work, 'fixed-box.pdf')) })) {
  writeFileSync(join(output, file), bytes); artifactHashes[file] = hash(bytes)
}
writeFileSync(join(output, 'references.json'), JSON.stringify({ schema: 'stz-pgf-diamond-aspect-scanning-v1', pgfVersion: '3.1.11a', engine: engineVersion,
  engineBinarySha256: hash(readFileSync(engine)), command: [engine, ...args], exitCode: 0,
  units: 'TeX pt; integer register stages in TeX sp; y reversed exactly once for path/anchor SVG coordinates; unitScale tests convert only units',
  upstream: original.upstream, sourceHashes, originalReferenceSha256: hash(originalBytes), generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  artifactHashes, namedAnchors: named, numericAnchors: numeric, cases: records }, null, 2) + '\n')
console.log(JSON.stringify({ output, work, cases: records.length, anchors: records.reduce((sum, value) => sum + value.anchors.length, 0), artifactHashes }, null, 2))
