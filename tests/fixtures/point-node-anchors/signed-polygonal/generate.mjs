/** Additive PGF oracle. Imports no application fitting, math or support tables. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const retained = JSON.parse(readFileSync(join(output, 'review/artifact-hashes.json'), 'utf8'))
for (const [file, expected] of Object.entries(retained.artifactHashes)) {
  assert.equal(hash(readFileSync(join(output, 'review', file))), expected, `Retained reviewer bytes: ${file}`)
}
const review = JSON.parse(readFileSync(join(output, 'review/empty/manifest.json'), 'utf8'))
for (const [file, expected] of Object.entries(review.sourceHashes)) assert.equal(hash(readFileSync(file)), expected, file)
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
const engineVersion = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
assert.equal(engineVersion, review.engine)
const work = mkdtempSync(join(tmpdir(), 'stz-32d-signed-polygonal-pgf-'))
const common = ['center', 'text', 'base', 'mid', 'east', 'west', 'north', 'south', 'north east', 'north west', 'south east', 'south west',
  '0', '13', '45', '90', '181', '270', '315', '-30']
const textSides = ['base east', 'base west', 'mid east', 'mid west']
const kinds = [
  { shape: 'regular polygon', pgfShape: 'regular polygon', specific: ['corner 1', 'side 1'] },
  { shape: 'square', pgfShape: 'regular polygon', options: ['/pgf/regular polygon sides=4'], specific: ['corner 1', 'side 1'] },
  { shape: 'triangle', pgfShape: 'regular polygon', options: ['/pgf/regular polygon sides=3'], specific: ['corner 1', 'side 1'] },
  { shape: 'star', pgfShape: 'star', specific: ['outer point 1', 'inner point 1'] },
  { shape: 'isosceles triangle', pgfShape: 'isosceles triangle', specific: ['apex', 'left corner', 'right corner', 'left side', 'right side', 'lower side'] },
  { shape: 'dart', pgfShape: 'dart', specific: ['tip', 'left tail', 'right tail', 'tail center', 'left side', 'right side'] },
]
const retainedCases = ['empty', 'targeted'].flatMap((family) => kinds.flatMap((kind) => [0, 3, -3].map((sep) => {
  const caseName = kind.shape.replaceAll(' ', '-') + '-' + String(sep).replace('-', 'minus')
  return { id: `${family}-${caseName}`, ...kind, body: family === 'empty' ? { width: 0, height: 0, depth: 0 } : { width: 20, height: 8, depth: 3 },
    innerXSep: -30, innerYSep: -30, outerXSep: sep, outerYSep: sep, minimumWidth: -20, minimumHeight: -20, lineWidth: .4,
    anchors: [...common, ...kind.specific], rawArtifact: `review/${family}/${caseName}/geometry.txt`,
    inputArtifact: `review/${family}/${caseName}/fixed-box.tex`, compilationArtifact: `review/${family}/${caseName}/compilation.txt` }
})))
function entry(id, shape, overrides) {
  const kind = kinds.find((value) => value.shape === shape)
  assert.ok(kind)
  const merged = { id, ...kind, body: { width: 20, height: 8, depth: 3 }, innerXSep: -30, innerYSep: -30,
    outerXSep: 3, outerYSep: 3, minimumWidth: -20, minimumHeight: -20, lineWidth: .4, ...overrides }
  let specific = kind.specific
  if (shape === 'regular polygon' || shape === 'square' || shape === 'triangle') {
    const sides = shape === 'square' ? 4 : shape === 'triangle' ? 3 : merged.parameters?.regularPolygonSides ?? 5
    specific = Array.from({ length: sides }, (_, i) => [`corner ${i + 1}`, `side ${i + 1}`]).flat()
  } else if (shape === 'star') {
    specific = Array.from({ length: merged.parameters?.starPoints ?? 5 }, (_, i) => [`outer point ${i + 1}`, `inner point ${i + 1}`]).flat()
  }
  return { ...merged, anchors: [...common, ...(['isosceles triangle', 'dart'].includes(shape) ? textSides : []), ...specific],
    rawArtifact: 'geometry.txt', inputArtifact: 'fixed-box.tex', compilationArtifact: 'compilation.txt' }
}
const freshCases = [
  entry('polygon-signed-body-rotated', 'regular polygon', { minimumWidth: -200, minimumHeight: -200,
    parameters: { regularPolygonSides: 7, borderRotate: 23 }, options: ['/pgf/regular polygon sides=7', '/pgf/shape border rotate=23'] }),
  entry('polygon-radius-zero-transition', 'regular polygon', { body: { width: 0, height: 0, depth: 0 }, minimumWidth: 0, minimumHeight: 0 }),
  entry('polygon-positive-body-negative-clearance', 'regular polygon', { innerXSep: 2, innerYSep: 3, outerXSep: -3, outerYSep: -3,
    parameters: { regularPolygonSides: 6, borderRotate: 17 }, options: ['/pgf/regular polygon sides=6', '/pgf/shape border rotate=17'] }),
  entry('square-signed-rotated', 'square', { parameters: { borderRotate: -47 }, options: ['/pgf/regular polygon sides=4', '/pgf/shape border rotate=-47'] }),
  entry('triangle-signed-body-rotated', 'triangle', { minimumWidth: -200, minimumHeight: -200,
    parameters: { borderRotate: 21 }, options: ['/pgf/regular polygon sides=3', '/pgf/shape border rotate=21'] }),
  entry('star-negative-ratio-minimum', 'star', { parameters: { starPoints: 7, starPointRatio: 3 }, options: ['/pgf/star points=7', '/pgf/star point ratio=3'] }),
  entry('star-negative-height-body-rotated', 'star', { body: { width: 0, height: 0, depth: 0 }, minimumWidth: -200, minimumHeight: -200,
    parameters: { starPointMode: 'height', starPointHeight: 12, borderRotate: 31 }, options: ['/pgf/star point height=12pt', '/pgf/shape border rotate=31'] }),
  entry('star-mixed-height-body', 'star', { body: { width: 0, height: 0, depth: 0 }, innerXSep: -2, innerYSep: -2, minimumWidth: 0, minimumHeight: 0,
    parameters: { starPointMode: 'height', starPointHeight: 12 }, options: ['/pgf/star point height=12pt'] }),
  entry('star-mixed-height-minimum', 'star', { minimumWidth: 12, minimumHeight: 12,
    parameters: { starPointMode: 'height', starPointHeight: 15, borderRotate: -19 }, options: ['/pgf/star point height=15pt', '/pgf/shape border rotate=-19'] }),
  entry('star-positive-ratio-minimum', 'star', { innerXSep: 2, innerYSep: 2, minimumWidth: 60, minimumHeight: 50,
    parameters: { starPoints: 6, starPointRatio: 2 }, options: ['/pgf/star points=6', '/pgf/star point ratio=2'] }),
  entry('isosceles-negative-stretch', 'isosceles triangle', { parameters: { isoscelesTriangleStretches: true }, options: ['/pgf/isosceles triangle stretches=true'] }),
  entry('isosceles-mixed-stretch', 'isosceles triangle', { minimumWidth: 20, parameters: { isoscelesTriangleStretches: true }, options: ['/pgf/isosceles triangle stretches=true'] }),
  entry('isosceles-negative-incircle-rotated', 'isosceles triangle', { body: { width: 0, height: 0, depth: 0 }, innerXSep: -10, innerYSep: -10,
    parameters: { isoscelesTriangleApexAngle: 70, borderUsesIncircle: true, borderRotate: 31 },
    options: ['/pgf/isosceles triangle apex angle=70', '/pgf/shape border uses incircle=true', '/pgf/shape border rotate=31'] }),
  entry('isosceles-positive-stretch', 'isosceles triangle', { innerXSep: 2, innerYSep: 2, minimumWidth: 80, minimumHeight: 15,
    parameters: { isoscelesTriangleStretches: true }, options: ['/pgf/isosceles triangle stretches=true'] }),
  entry('dart-negative-height-minimum', 'dart', { body: { width: 0, height: 0, depth: 0 }, minimumWidth: -200 }),
  entry('dart-negative-width-minimum', 'dart', { body: { width: 0, height: 0, depth: 0 }, innerXSep: -5, innerYSep: -5, minimumWidth: -2, minimumHeight: -200 }),
  entry('dart-signed-offset-positive-length', 'dart', { body: { width: 0, height: 0, depth: 0 }, innerYSep: 30 }),
  entry('dart-positive-incircle-rotated-minima', 'dart', { innerXSep: 2, innerYSep: 2, minimumWidth: 80, minimumHeight: 100,
    parameters: { dartTipAngle: 38, dartTailAngle: 118, borderUsesIncircle: true, borderRotate: 32 },
    options: ['/pgf/dart tip angle=38', '/pgf/dart tail angle=118', '/pgf/shape border uses incircle=true', '/pgf/shape border rotate=32'] }),
]
const failureCases = [entry('star-zero-outer-negative-inner', 'star', { body: { width: 0, height: 0, depth: 0 }, innerXSep: -1, innerYSep: -1,
  minimumWidth: 0, minimumHeight: 0, parameters: { starPointMode: 'height', starPointHeight: 1 }, options: ['/pgf/star point height=1pt'] })]
const fittingTrace = String.raw`\newif\ifstzdartfitting
\let\stzoriginalreciprocal\pgfmathreciprocal@
\def\pgfmathreciprocal@#1{\edef\stzreciprocalinput{#1}\stzoriginalreciprocal{#1}\ifstzdartfitting\immediate\write\fixtureout{DARTRECIP \stzreciprocalinput; \pgfmathresult}\fi}
\let\stzoriginalresavedmacro\pgf@sh@resavedmacro
\def\pgf@sh@resavedmacro#1#2{\stzoriginalresavedmacro{#1}{%
\edef\stzmacroname{\string#1}\edef\stzdartname{\string\installdartparameters}%
\ifx\stzmacroname\stzdartname\stzdartfittingtrue\fi%
#2%
\ifstzdartfitting\immediate\write\fixtureout{DARTFITTING \dartlength,\taillength,\halftailseparation,\deltax}\stzdartfittingfalse\fi}}
`
const header = readFileSync(join(output, 'review/empty/regular-polygon-0/fixed-box.tex'), 'utf8').split('\\fixedshape{probe}')[0]
  .replace('\\makeatother', fittingTrace + '\\makeatother')
function shapeCommand(value) {
  const fields = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
  const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
  const options = fields.map((field, i) => `/pgf/${keys[i]}=${value[field]}pt`).concat(value.options ?? []).join(',')
  return String.raw`\fixedshape{${value.id}}{${value.pgfShape}}{${value.body.width}}{${value.body.height}}{${value.body.depth}}{${value.lineWidth}}{${options}}{${value.anchors.join(',')}}`
}
const reciprocals = [100.5, -100.5, 200.125, -200.125, -322.8842, 100, -100, .38268, -.38268]
const divides = [{ numerator: -10, denominator: -132.426 }, { numerator: 10, denominator: -132.426 }, { numerator: -10, denominator: -20 }]
const arithmetic = String.raw`\makeatletter
` + reciprocals.map((value) => String.raw`\pgfmathreciprocal{${value}}\immediate\write\fixtureout{RECIPROCAL ${value}; \pgfmathresult}`).join('\n') + '\n' +
  divides.map(({ numerator, denominator }) => String.raw`\pgfmathdivide{${numerator}}{${denominator}}\let\quotient\pgfmathresult\pgfmathatan{\quotient}\immediate\write\fixtureout{DIVIDEATAN ${numerator},${denominator}; \quotient,\pgfmathresult}`).join('\n') + '\n\\makeatother\n'
const document = header + freshCases.map(shapeCommand).join('\n') + '\n' + arithmetic + '\\end{document}\n'
writeFileSync(join(work, 'fixed-box.tex'), document)
const compilation = execFileSync(engine, args, { cwd: work, encoding: 'utf8', maxBuffer: 8e6 })
const pgfVersion = /STZ PGF VERSION (\S+)/.exec(compilation)?.[1]
assert.equal(pgfVersion, '3.1.11a')
const raw = readFileSync(join(work, 'geometry.txt'), 'utf8')
const expectedArithmetic = []
function parse(source, metadata, single = false) {
  const records = []
  for (const line of source.trim().split('\n')) {
    if (line.startsWith('CASE ')) {
      const value = single ? metadata[0] : metadata.find((item) => item.id === line.slice(5))
      assert.ok(value, line)
      records.push({ ...value, paints: [], expectedAnchors: {}, fittingReciprocals: [] })
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
    } else if (line.startsWith('DARTRECIP ')) {
      const [, value, expected] = /^DARTRECIP (-?[\d.]+); (-?[\d.]+)$/.exec(line) ?? []
      assert.ok(value && expected, line)
      records.at(-1).fittingReciprocals.push({ value: Number(value), expected: Number(expected) })
    } else if (line.startsWith('DARTFITTING ')) {
      const dimensions = line.slice(12).split(',').map((value) => Number(value.replace('pt', '')))
      assert.equal(dimensions.length, 4)
      assert.ok(dimensions.every(Number.isFinite))
      const [tipLength, tailLength, halfSeparation, offset] = dimensions
      records.at(-1).expectedDartFitting = { tipLength, tailLength, halfSeparation, offset }
    } else if (line.startsWith('RECIPROCAL ')) {
      const [, value, expected] = /^RECIPROCAL (-?[\d.]+); (-?[\d.]+)$/.exec(line) ?? []
      assert.ok(value && expected, line)
      expectedArithmetic.push({ kind: 'reciprocal', value: Number(value), expected: Number(expected) })
    } else if (line.startsWith('DIVIDEATAN ')) {
      const [, numerator, denominator, quotient, angle] = /^DIVIDEATAN (-?[\d.]+),(-?[\d.]+); (-?[\d.]+),(-?[\d.]+)$/.exec(line) ?? []
      assert.ok(numerator && denominator && quotient && angle, line)
      expectedArithmetic.push({ kind: 'divideAtan', numerator: Number(numerator), denominator: Number(denominator), quotient: Number(quotient), angle: Number(angle) })
    } else throw new Error(`Unexpected independent PGF observation: ${line}`)
  }
  for (const value of records) {
    assert.equal(value.paints.length, 1)
    assert.equal(Object.keys(value.expectedAnchors).length, value.anchors.length, value.id)
  }
  return records
}
const cases = [...retainedCases.flatMap((value) => parse(readFileSync(join(output, value.rawArtifact), 'utf8'), [value], true)), ...parse(raw, freshCases)]
assert.equal(cases.length, 54)
assert.equal(expectedArithmetic.length, reciprocals.length + divides.length)
for (const [file, content] of [['fixed-box.tex', document], ['geometry.txt', raw], ['compilation.txt', compilation]]) writeFileSync(join(output, file), content)
const failures = []
for (const value of failureCases) {
  const failureWork = join(work, value.id)
  mkdirSync(failureWork)
  const input = header + shapeCommand(value) + '\n\\end{document}\n'
  writeFileSync(join(failureWork, 'fixed-box.tex'), input)
  let failedCompilation, exitCode = 0
  try { failedCompilation = execFileSync(engine, args, { cwd: failureWork, encoding: 'utf8', maxBuffer: 8e6 }) }
  catch (error) { exitCode = error.status; failedCompilation = String(error.stdout ?? error) }
  assert.equal(exitCode, 1, value.id)
  const expectedError = "You asked me to calculate `1/0.0'"
  assert.ok(failedCompilation.includes(expectedError))
  const directory = join(output, 'failures', value.id)
  mkdirSync(directory, { recursive: true })
  const failedRaw = readFileSync(join(failureWork, 'geometry.txt'))
  const artifacts = { input: `failures/${value.id}/fixed-box.tex`, geometry: `failures/${value.id}/geometry.txt`, compilation: `failures/${value.id}/compilation.txt` }
  const hashes = {}
  for (const [key, bytes] of [['input', input], ['geometry', failedRaw], ['compilation', failedCompilation]]) {
    writeFileSync(join(output, artifacts[key]), bytes)
    hashes[key] = hash(bytes)
  }
  failures.push({ ...value, exitCode, command: [engine, ...args], expectedError, artifacts, hashes })
}
const reference = { schema: 'stz-pgf-signed-polygonal-v1', pgfVersion, engine: engineVersion, command: [engine, ...args], exitCode: 0,
  sourceHashes: review.sourceHashes, units: 'TeX pt; raw PGF positive-Y-up reversed exactly once to SVG positive-Y-down; no bp conversion',
  sourceTexSha256: hash(document), geometrySha256: hash(raw), compilationSha256: hash(compilation), generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  retainedManifestSha256: hash(readFileSync(join(output, 'review/artifact-hashes.json'))), retainedArtifactHashes: retained.artifactHashes,
  retainedCases: 36, freshCases: freshCases.length, cases, arithmetic: expectedArithmetic, failures }
writeFileSync(join(output, 'references.json'), JSON.stringify(reference, null, 2) + '\n')
console.log(JSON.stringify({ result: 'generated', cases: cases.length, anchors: cases.reduce((count, value) => count + value.anchors.length, 0), arithmetic: expectedArithmetic.length, work }))
