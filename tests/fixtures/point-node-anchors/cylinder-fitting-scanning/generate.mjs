/** Independent additive PGF oracle. No runtime/application geometry imports. */
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
for (const file of ['pgfmathcalc.code.tex', 'pgfmathparser.code.tex']) {
  const path = `/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/math/${file}`
  sourceHashes[path] = hash(readFileSync(path))
}
for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(file)), expected, file)
const engine = process.env.STZ_PDFLATEX ?? '/Library/TeX/texbin/pdflatex'
const engineVersion = execFileSync(engine, ['--version'], { encoding: 'utf8' }).split('\n')[0]
assert.equal(engineVersion, original.engine)
const anchors = ['center', 'text', 'base', 'mid', 'east', 'north east', 'north', 'north west', 'west', 'south west', 'south', 'south east', 'base east', 'base west', 'mid east', 'mid west',
  'shape center', 'before top', 'top', 'after top', 'before bottom', 'bottom', 'after bottom']
const numeric = ['0', '37', '45', '90', '135', '180', '225', '270', '315', '450', '90.8', '+45.7', '-90.8', '-0.5']
const short = ['center', 'text', 'base', 'mid', 'shape center', 'top', 'bottom', 'west']
function entry(id, overrides = {}) {
  return { id, shape: 'cylinder', body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0,
    outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0, lineWidth: .4, anchors: short, ...overrides }
}
const sp = 1 / 65536, half = sp / 2
const candidates = [
  entry('folded', { innerXSep: -30, innerYSep: 5, minimumWidth: 1, minimumHeight: 1, anchor: 'bottom', anchors: [...anchors, ...numeric] }),
  entry('folded-custom-fill', { innerXSep: -30, innerYSep: 5, minimumWidth: 1, minimumHeight: 1, parameters: { cylinderUsesCustomFill: true, cylinderBodyFill: '#0000FF', cylinderEndFill: '#FF0000' }, options: ['/pgf/cylinder uses custom fill=true', '/pgf/cylinder body fill=blue', '/pgf/cylinder end fill=red'], anchors }),
  entry('positive-five-sp', { innerYSep: 5 * sp }),
  entry('negative-five-sp', { innerYSep: -5 * sp, minimumWidth: -20, minimumHeight: -20, anchors: ['center', 'text', 'base', 'mid', 'bottom'] }),
  entry('signed-nonzero', { innerXSep: -4, innerYSep: -3, minimumWidth: -20, minimumHeight: -20, anchors: ['center', 'text', 'base', 'mid', 'shape center', 'before top', 'top', 'after top', 'before bottom', 'bottom', 'after bottom', 'west'] }),
  entry('axial-minimum', { body: { width: 20, height: 8, depth: 2 }, innerXSep: 2, innerYSep: 3, minimumHeight: 80, anchors }),
  entry('transverse-minimum', { innerXSep: 5, innerYSep: 2, minimumWidth: 12, anchors }),
  entry('rx-zero', { minimumWidth: 10, minimumHeight: 20, anchors }),
  entry('folded-rotation90', { innerXSep: 5, innerYSep: -30, minimumWidth: 1, minimumHeight: 1, parameters: { borderRotate: 90 }, options: ['/pgf/shape border rotate=90'], anchors }),
  entry('folded-rotation270', { innerXSep: 5, innerYSep: -30, minimumWidth: 1, minimumHeight: 1, parameters: { borderRotate: 270 }, options: ['/pgf/shape border rotate=270'], anchors }),
  entry('incircle', { innerXSep: -30, innerYSep: 5, minimumWidth: 1, minimumHeight: 1, parameters: { borderUsesIncircle: true, borderRotate: 37 }, options: ['/pgf/shape border uses incircle=true', '/pgf/shape border rotate=37'], anchors }),
  entry('folded-unequal-signed-outer', { innerXSep: -30, innerYSep: 5, minimumWidth: 1, minimumHeight: 1, outerXSep: -2, outerYSep: -1, anchors }),
  entry('positive-tie', { innerYSep: half }),
  entry('negative-tie', { innerYSep: -half, minimumWidth: -20, minimumHeight: -20, anchors: ['center', 'text', 'base', 'mid', 'bottom'] }),
  entry('positive-first-sp', { innerYSep: sp }),
  entry('negative-first-sp', { innerYSep: -sp, minimumWidth: -20, minimumHeight: -20, anchors: ['center', 'text', 'base', 'mid', 'bottom'] }),
  entry('minimum-two-sp', { minimumWidth: 2 * sp }),
  entry('half-height-two-sp', { body: { width: 0, height: 2 * sp, depth: 0 } }),
  entry('separate-half-products-survive', { body: { width: 0, height: 3 * sp, depth: 3 * sp }, innerYSep: -sp }),
  entry('rotation90-first-sp', { innerXSep: sp, parameters: { borderRotate: 90 }, options: ['/pgf/shape border rotate=90'] }),
  entry('rotation270-first-sp', { innerXSep: sp, parameters: { borderRotate: 270 }, options: ['/pgf/shape border rotate=270'] }),
  entry('incircle-first-sp', { innerXSep: sp, parameters: { borderUsesIncircle: true }, options: ['/pgf/shape border uses incircle=true'] }),
  entry('contextual-em-tie', { innerYSep: half * 10, sources: { innerYSep: `${half}em` }, dimensionSources: { innerYSep: { source: `${half}em`, unit: 'em', texPoints: half * 10, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } } } }),
  entry('contextual-ex-tie', { innerYSep: half * 4.30554, sources: { innerYSep: `${half}ex` }, dimensionSources: { innerYSep: { source: `${half}ex`, unit: 'ex', texPoints: half * 4.30554, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } } } }),
  entry('physical-mm-tie', { innerYSep: half * 72.27 / 25.4, sources: { innerYSep: `${half}mm` }, dimensionSources: { innerYSep: { source: `${half}mm`, unit: 'mm', texPoints: half * 72.27 / 25.4 } } }),
]
const failures = [
  entry('subsp', { innerYSep: .000001, minimumHeight: 80 }),
  entry('nonempty-scanned-cancellation', { body: { width: 20, height: 8, depth: 2 }, innerYSep: -4.999999, minimumHeight: 80 }),
  entry('below-half-sp-positive', { innerYSep: half - 1e-10, minimumHeight: 80 }),
  entry('below-half-sp-negative', { innerYSep: -half + 1e-10, minimumWidth: -20, minimumHeight: -20 }),
  entry('minimum-one-sp', { minimumWidth: sp, minimumHeight: 80 }),
  entry('separate-odd-half-products-zero', { body: { width: 0, height: sp, depth: sp } }),
  entry('half-product-cancellation', { body: { width: 0, height: 3 * sp, depth: 3 * sp }, innerYSep: -2 * sp }),
  entry('rotation90-subsp', { innerXSep: .000001, innerYSep: 5, minimumHeight: 80, parameters: { borderRotate: 90 }, options: ['/pgf/shape border rotate=90'] }),
  entry('rotation270-subsp', { innerXSep: .000001, innerYSep: 5, minimumHeight: 80, parameters: { borderRotate: 270 }, options: ['/pgf/shape border rotate=270'] }),
  entry('incircle-subsp', { innerXSep: .000001, innerYSep: -.000001, minimumHeight: 80, parameters: { borderUsesIncircle: true }, options: ['/pgf/shape border uses incircle=true'] }),
  entry('subsp-outer-line-nonrescue', { innerYSep: .000001, minimumHeight: 80, outerXSep: 20, outerYSep: 25, lineWidth: 9 }),
  entry('contextual-em-subsp', { innerYSep: .000001 * 10, sources: { innerYSep: '0.000001em' }, dimensionSources: { innerYSep: { source: '0.000001em', unit: 'em', texPoints: .000001 * 10, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } } } }),
  entry('contextual-ex-subsp', { innerYSep: .000001 * 4.30554, sources: { innerYSep: '0.000001ex' }, dimensionSources: { innerYSep: { source: '0.000001ex', unit: 'ex', texPoints: .000001 * 4.30554, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } } } }),
]
const geometric = Object.keys(sourceHashes).find(path => path.endsWith('pgflibraryshapes.geometric.code.tex'))
const upstream = readFileSync(geometric, 'utf8')
let stage = upstream.split('\\pgfdeclareshape{cylinder}{%')[1].split('\\savedmacro\\getcylinderpoints{%')[1].split('        %\n        % Calculate how far')[0]
  .replace('\\addtosavedmacro\\rotate%', '')
  .replace('\\pgf@x\\pgf@xc%', '\\immediate\\write\\fixtureout{STAGE innerXSp; \\number\\pgf@xc}%\n        \\pgf@x\\pgf@xc%')
  .replace('\\pgf@y\\pgf@yc%', '\\immediate\\write\\fixtureout{STAGE innerYSp; \\number\\pgf@yc}%\n        \\pgf@y\\pgf@yc%')
  .replace('        \\ifpgfshapeborderusesincircle%', '\\immediate\\write\\fixtureout{STAGE initialXSp; \\number\\pgf@x}%\n\\immediate\\write\\fixtureout{STAGE initialYSp; \\number\\pgf@y}%\n        \\ifpgfshapeborderusesincircle%')
  .replace('        \\pgf@xa\\pgf@x%\n        \\pgf@ya\\pgf@y%', '\\immediate\\write\\fixtureout{STAGE fittedXSp; \\number\\pgf@x}%\n\\immediate\\write\\fixtureout{STAGE fittedYSp; \\number\\pgf@y}%\n\\immediate\\write\\fixtureout{STAGE transverseInnerSepSp; \\number\\pgf@yc}%\n        \\pgf@xa\\pgf@x%\n        \\pgf@ya\\pgf@y%')
  .replace('        \\ifdim\\pgfutil@tempdimb<.5\\pgf@xc', '\\immediate\\write\\fixtureout{STAGE minimumWidthSp; \\number\\pgf@xc}%\n        \\ifdim\\pgfutil@tempdimb<.5\\pgf@xc')
stage += '\\immediate\\write\\fixtureout{STAGE divisorSp; \\number\\pgfutil@tempdimb}%\n'
const bodyHalves = String.raw`\pgf@xc.5\wd\pgfnodeparttextbox\immediate\write\fixtureout{STAGE bodyWidthHalfSp; \number\pgf@xc}%
\pgf@xc.5\ht\pgfnodeparttextbox\immediate\write\fixtureout{STAGE bodyHeightHalfSp; \number\pgf@xc}%
\pgf@xc.5\dp\pgfnodeparttextbox\immediate\write\fixtureout{STAGE bodyDepthHalfSp; \number\pgf@xc}%
\pgfmathsetlength\pgf@xc{\pgfkeysvalueof{/pgf/minimum width}}\pgf@xc.5\pgf@xc\immediate\write\fixtureout{STAGE minimumWidthHalfSp; \number\pgf@xc}%`
const trace = '\\def\\tracecylinder{\\begingroup\n' + stage + bodyHalves + '\n\\endgroup}\n'
let header = readFileSync(join(output, '../cylinder-domain/review/fixed-box.tex'), 'utf8').split('\\fixedshape{cylinder-empty-zero}')[0]
  .replace('\\pagestyle{empty}', '\\typeout{STZ PGF VERSION \\pgfversion}\n\\pagestyle{empty}')
  .replace('\\newcommand\\fixedshape', trace + '\\newcommand\\fixedshape')
  .replace('\\let\\originalusepath', '\\tracecylinder\n\\let\\originalusepath')
const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
const fields = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight']
const work = mkdtempSync(join(tmpdir(), 'stz-cylinder-fitting-scanning-pgf-'))
const artifactHashes = {}
function retain(file, bytes) { writeFileSync(join(output, file), bytes); artifactHashes[file] = hash(bytes) }
retain('.gitignore', '# Keep independent compiler logs in the authenticated checkout inventory.\n!**/*.log\n')
retain('staged-upstream-source.tex', trace)
function compile(value, expectedExit, expectedError = "You've asked me to divide") {
  const path = join(work, value.id); mkdirSync(path)
  const options = fields.map((field, index) => `/pgf/${keys[index]}=${value.sources?.[field] ?? `${value[field]}pt`}`).concat(value.options ?? []).join(',')
  const command = String.raw`\fixedshape{${value.id}}{${value.shape}}{${value.body.width}}{${value.body.height}}{${value.body.depth}}{${value.lineWidth}}{${options}}{${value.anchors.join(',')}}`
  const input = header + command + '\n\\end{document}\n'
  writeFileSync(join(path, 'fixed-box.tex'), input)
  const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex']
  const execution = spawnSync(engine, args, { cwd: path, encoding: 'utf8', maxBuffer: 8e6 })
  assert.equal(execution.status, expectedExit, `${value.id}: ${execution.stdout}`)
  assert.equal(/STZ PGF VERSION (\S+)/.exec(execution.stdout)?.[1], '3.1.11a')
  const raw = readFileSync(join(path, 'geometry.txt'), 'utf8')
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
  const expectedStages = Object.fromEntries([...raw.matchAll(/^STAGE (.*?); (-?\d+)$/gm)].map(([, name, value]) => [name, Number(value)]))
  if (!expectedExit) { assert.equal(Object.keys(expectedAnchors).length, value.anchors.length); assert.ok(paints.length) }
  return { ...value, exitCode: execution.status, command: [engine, ...args], artifacts, expectedError: expectedExit ? expectedError : undefined, expectedStages, expectedAnchors, paints }
}
const nonzeroIds = new Set(['positive-tie', 'negative-tie', 'positive-first-sp', 'negative-first-sp', 'minimum-two-sp', 'half-height-two-sp',
  'separate-half-products-survive', 'rotation90-first-sp', 'rotation270-first-sp', 'incircle-first-sp', 'contextual-ex-tie', 'physical-mm-tie'])
const controls = candidates.filter(value => !nonzeroIds.has(value.id)), nonzero = candidates.filter(value => nonzeroIds.has(value.id))
const failedRecords = failures.map(value => compile(value, 1)), controlRecords = controls.map(value => compile(value, 0)),
  nonzeroRecords = nonzero.map(value => compile(value, 1, 'Dimension too large'))
// Retain immutable reviewer inputs/actual generated sources and recompile the latter.
const retainedReviewHashes = {}
for (const [name, review] of [['folded', '/private/tmp/stz-review-cylinder-empty-folded-2yP0XK'], ['subsp', '/private/tmp/stz-review-cylinder-subsp-y0liua']]) {
  const directory = `review/${name}`; mkdirSync(join(output, directory), { recursive: true })
  const files = name === 'folded' ? ['comparison.json', 'fixed-box.tex', 'geometry.txt', 'fixed-box.log', 'command.log', 'actual-generated.tex']
    : ['comparison.json', 'command.log', 'actual-generated.tex', 'actual-generated-wrapped.tex', 'actual-generated-wrapped.log']
  for (const file of files) { const bytes = readFileSync(join(review, file)); retain(`${directory}/${file}`, bytes); retainedReviewHashes[`${name}/${file}`] = hash(bytes) }
  const generated = readFileSync(join(review, 'actual-generated.tex'), 'utf8')
  const wrapped = '\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric,shapes.symbols}\n\\typeout{STZ PGF VERSION \\pgfversion}\n\\begin{document}\n' + generated + '\n\\end{document}\n'
  const actualPath = join(work, `actual-${name}`); mkdirSync(actualPath); writeFileSync(join(actualPath, 'actual-generated-wrapped.tex'), wrapped)
  const args = ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'actual-generated-wrapped.tex']
  const execution = spawnSync(engine, args, { cwd: actualPath, encoding: 'utf8', maxBuffer: 8e6 })
  assert.equal(execution.status, name === 'folded' ? 0 : 1)
  if (name === 'subsp') assert.ok(execution.stdout.includes("You've asked me to divide"))
  for (const [file, bytes] of [['recompiled-wrapped.tex', wrapped], ['recompiled-compilation.txt', execution.stdout], ['recompiled-wrapped.log', readFileSync(join(actualPath, 'actual-generated-wrapped.log'))]]) retain(`${directory}/${file}`, bytes)
}
const references = { schema: 'stz-pgf-cylinder-fitting-scanning-v1', pgfVersion: '3.1.11a', upstream: original.upstream,
  engine: engineVersion, engineBinarySha256: hash(readFileSync(engine)), sourceHashes,
  originalReferenceSha256: hash(originalBytes), generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  units: 'TeX pt; raw PGF positive-Y-up is reversed once in parsed paint and anchor coordinates; stage traces are signed scaled-point registers.',
  namedAnchors: anchors, numericAnchors: numeric, retainedReviewHashes, artifactHashes,
  failures: failedRecords, controls: controlRecords, nonzeroDomain: nonzeroRecords }
writeFileSync(join(output, 'references.json'), JSON.stringify(references, null, 2) + '\n')
console.log(JSON.stringify({ result: 'generated', failures: failures.length, controls: controls.length, nonzeroDomain: nonzero.length, work }))
