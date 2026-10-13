/** Independent additive PGF domain oracle; imports no application geometry. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const originalBytes = readFileSync(join(output, '../references.json'))
const original = JSON.parse(originalBytes)
const sourceHashes = { ...original.sourceHashes }
for (const file of ['pgfmathfunctions.basic.code.tex', 'pgfmathfunctions.trigonometric.code.tex']) {
  const path = `/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/math/${file}`
  sourceHashes[path] = hash(readFileSync(path))
}
for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(file)), expected, file)
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const engineVersion = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
assert.equal(engineVersion, original.engine)
const anchors = ['center', 'text', 'base', 'mid', 'east', 'north', 'south', 'west']
function entry(id, overrides = {}) {
  return { id, shape: 'cylinder', body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0,
    outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0, lineWidth: .4, anchors, ...overrides }
}
const failures = [
  entry('empty-zero'),
  entry('axial-only', { body: { width: 20, height: 0, depth: 0 } }),
  entry('rotation90-zero', { body: { width: 0, height: 8, depth: 2 }, parameters: { borderRotate: 90 }, options: ['/pgf/shape border rotate=90'] }),
  entry('rotation270-zero', { body: { width: 0, height: 8, depth: 2 }, parameters: { borderRotate: 270 }, options: ['/pgf/shape border rotate=270'] }),
  entry('incircle-zero', { parameters: { borderUsesIncircle: true, borderRotate: 37 }, options: ['/pgf/shape border uses incircle=true', '/pgf/shape border rotate=37'] }),
  entry('nonempty-cancellation', { body: { width: 20, height: 8, depth: 2 }, innerYSep: -5 }),
  entry('signed-radius-clamped-zero', { innerXSep: -4, innerYSep: -3, minimumHeight: -20 }),
  entry('incircle-nonempty-cancellation', { body: { width: 20, height: 8, depth: 2 }, innerXSep: -10, innerYSep: -5,
    parameters: { borderUsesIncircle: true }, options: ['/pgf/shape border uses incircle=true'] }),
  entry('axial-minimum-nonrescue', { minimumHeight: 80 }),
  entry('outer-separation-nonrescue', { outerXSep: 20, outerYSep: 25 }),
  entry('line-width-custom-fill-nonrescue', { lineWidth: 9, parameters: { cylinderUsesCustomFill: true, cylinderBodyFill: '#1122AA', cylinderEndFill: '#CC3322' },
    options: ['/pgf/cylinder uses custom fill=true', '/pgf/cylinder body fill=blue', '/pgf/cylinder end fill=red'] }),
]
const controls = [
  entry('positive-minimum-width-rescue', { minimumWidth: 10 }),
  entry('positive-minimum-width-nonempty-rescue', { body: { width: 20, height: 8, depth: 2 }, innerYSep: 0, minimumWidth: 20 }),
  entry('rx-zero-ry-positive', { minimumWidth: 10, minimumHeight: 20 }),
  entry('rotation90-exchange-rescue', { body: { width: 20, height: 0, depth: 0 }, parameters: { borderRotate: 90 }, options: ['/pgf/shape border rotate=90'] }),
  entry('rotation270-exchange-rescue', { body: { width: 20, height: 0, depth: 0 }, parameters: { borderRotate: 270 }, options: ['/pgf/shape border rotate=270'] }),
  entry('incircle-axial-rescue', { body: { width: 20, height: 0, depth: 0 }, parameters: { borderUsesIncircle: true, borderRotate: 37 }, options: ['/pgf/shape border uses incircle=true', '/pgf/shape border rotate=37'] }),
  entry('signed-nonzero-radii', { innerXSep: -4, innerYSep: -3, minimumWidth: -20, minimumHeight: -20,
    anchors: ['center', 'text', 'base', 'mid', 'west'] }),
  entry('ellipse-zero-axes', { shape: 'ellipse' }),
  entry('ellipse-zero-x', { shape: 'ellipse', innerYSep: 5 }),
  entry('ellipse-zero-y', { shape: 'ellipse', innerXSep: 5 }),
  entry('rectangle-zero-axes', { shape: 'rectangle' }),
  entry('circle-zero-axes', { shape: 'circle' }),
]
const header = readFileSync(join(output, 'review/fixed-box.tex'), 'utf8').split('\\fixedshape{cylinder-empty-zero}')[0]
  .replace('\\pagestyle{empty}', '\\typeout{STZ PGF VERSION \\pgfversion}\n\\pagestyle{empty}')
const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
const fields = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
const work = mkdtempSync(join(tmpdir(), 'stz-cylinder-domain-pgf-'))
const artifactHashes = {}
function retain(file, bytes) { writeFileSync(join(output, file), bytes); artifactHashes[file] = hash(bytes) }
function compile(value, expectedExit) {
  const path = join(work, value.id); mkdirSync(path)
  const options = fields.map((field, index) => `/pgf/${keys[index]}=${value[field]}pt`).concat(value.options ?? []).join(',')
  const command = String.raw`\fixedshape{${value.id}}{${value.shape}}{${value.body.width}}{${value.body.height}}{${value.body.depth}}{${value.lineWidth}}{${options}}{${value.anchors.join(',')}}`
  const input = header + command + '\n\\end{document}\n'
  writeFileSync(join(path, 'fixed-box.tex'), input)
  const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
  const execution = spawnSync(engine, args, { cwd: path, encoding: 'utf8', maxBuffer: 8e6 })
  assert.equal(execution.status, expectedExit, `${value.id}: ${execution.stdout}`)
  assert.equal(/STZ PGF VERSION (\S+)/.exec(execution.stdout)?.[1], '3.1.11a')
  const raw = readFileSync(join(path, 'geometry.txt'), 'utf8')
  const expectedError = "You've asked me to divide"
  if (expectedExit) { assert.ok(execution.stdout.includes(expectedError)); assert.doesNotMatch(raw, /PAINT|ANCHOR/) }
  const directory = `${expectedExit ? 'failures' : 'controls'}/${value.id}`
  mkdirSync(join(output, directory), { recursive: true })
  const artifacts = {}
  for (const [kind, file, bytes] of [['input', 'fixed-box.tex', input], ['geometry', 'geometry.txt', raw],
    ['compilation', 'compilation.txt', execution.stdout], ['compilerLog', 'fixed-box.log', readFileSync(join(path, 'fixed-box.log'))]]) {
    artifacts[kind] = `${directory}/${file}`; retain(artifacts[kind], bytes)
  }
  const expectedAnchors = Object.fromEntries([...raw.matchAll(/^ANCHOR (.*?); (-?[\d.]+)pt,(-?[\d.]+)pt$/gm)]
    .map(([, name, x, y]) => [name, { x: Number(x) || 0, y: -Number(y) || 0 }]))
  const paints = [...raw.matchAll(/^PAINT (.*?); PATH macro:->(.*)$/gm)].map(([, action, source]) => ({ action,
    tokens: [...source.matchAll(/\\pgfsyssoftpath@(\w+token)\s*\{(-?[\d.]+)pt\}\{(-?[\d.]+)pt\}/g)]
      .map(([, kind, x, y]) => ({ kind, x: Number(x) || 0, y: -Number(y) || 0 })) }))
  if (!expectedExit) { assert.equal(Object.keys(expectedAnchors).length, value.anchors.length); assert.ok(paints.length) }
  return { ...value, exitCode: execution.status, command: [engine, ...args], artifacts, expectedError: expectedExit ? expectedError : undefined, expectedAnchors, paints }
}
const failedRecords = failures.map(value => compile(value, 1)), controlRecords = controls.map(value => compile(value, 0))
const reviewArtifacts = ['fixed-box.tex', 'fixed-box.log', 'geometry.txt', 'compilation.txt', 'actual-generated.tex',
  'actual-generated-wrapped.tex', 'actual-generated-wrapped.log', 'actual-generated-wrapped-compilation.txt', 'production-layout.json', 'production.svg']
const retainedReviewHashes = Object.fromEntries(reviewArtifacts.map(file => [file, hash(readFileSync(join(output, 'review', file)))]))
// Recompile the retained real generator output in its correct document context.
const actualWork = join(work, 'actual-generated'); mkdirSync(actualWork)
const generated = readFileSync(join(output, 'review/actual-generated.tex'), 'utf8')
const wrapped = '\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric,shapes.symbols}\n\\typeout{STZ PGF VERSION \\pgfversion}\n\\begin{document}\n' + generated + '\n\\end{document}\n'
writeFileSync(join(actualWork, 'actual-generated-wrapped.tex'), wrapped)
const actualArgs = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'actual-generated-wrapped.tex']
const actualExecution = spawnSync(engine, actualArgs, { cwd: actualWork, encoding: 'utf8', maxBuffer: 8e6 })
assert.equal(actualExecution.status, 1); assert.ok(actualExecution.stdout.includes("You've asked me to divide"))
for (const [file, bytes] of [['actual-generated.tex', generated], ['actual-generated-wrapped.tex', wrapped],
  ['actual-generated-wrapped-compilation.txt', actualExecution.stdout], ['actual-generated-wrapped.log', readFileSync(join(actualWork, 'actual-generated-wrapped.log'))]]) retain(file, bytes)
const references = { schema: 'stz-pgf-cylinder-domain-v1', pgfVersion: '3.1.11a', upstream: original.upstream,
  engine: engineVersion, engineBinarySha256: hash(readFileSync(engine)), sourceHashes,
  originalReferenceSha256: hash(originalBytes), generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  units: 'TeX pt; raw PGF positive-Y-up is reversed once in parsed paint and anchor coordinates',
  retainedReviewPath: '/private/tmp/stz-review-cylinder-zero-IrjltG/', retainedReviewHashes, artifactHashes,
  actualGenerated: { provenance: 'Exact retained independent reviewer production generateTikz source; recompiled in the complete correct wrapper.',
    command: [engine, ...actualArgs], exitCode: actualExecution.status, expectedError: "You've asked me to divide" },
  failures: failedRecords, controls: controlRecords }
writeFileSync(join(output, 'references.json'), JSON.stringify(references, null, 2) + '\n')
console.log(JSON.stringify({ result: 'generated', failures: failures.length, controls: controls.length, work }))
