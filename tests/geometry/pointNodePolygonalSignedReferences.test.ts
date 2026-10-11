import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { solvePointNodeShape, resolvePointNodeAnchor, pointNodeAnchorIssue, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { pgfReciprocal, pgfDivide, pgfAtan } from '../../src/geometry/pointNodeShapes/pgfMath.ts'
import type { Vec2 } from '../../src/model/types.ts'

type Token = { kind: string; x: number; y: number }
type Reference = PointNodeShapeInput & { id: string; anchors: string[]; paints: { action: string; tokens: Token[] }[];
  pgfShape: string; options?: string[];
  expectedAnchors: Record<string, Vec2>; rawArtifact: string; inputArtifact: string; compilationArtifact: string;
  fittingReciprocals: { value: number; expected: number }[];
  expectedDartFitting?: { tipLength: number; tailLength: number; halfSeparation: number; offset: number } }
type Arithmetic = { kind: 'reciprocal'; value: number; expected: number }
  | { kind: 'divideAtan'; numerator: number; denominator: number; quotient: number; angle: number }
type Failure = Reference & { exitCode: number; expectedError: string; artifacts: Record<string, string>; hashes: Record<string, string> }
const directory = new URL('../fixtures/point-node-anchors/signed-polygonal/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; engine: string; command: string[]; exitCode: number; sourceHashes: Record<string, string>;
  sourceTexSha256: string; geometrySha256: string; compilationSha256: string; generatorSha256: string; retainedManifestSha256: string;
  retainedArtifactHashes: Record<string, string>; retainedCases: number; freshCases: number; cases: Reference[]; arithmetic: Arithmetic[]; failures: Failure[]
}
const hash = (url: URL): string => createHash('sha256').update(readFileSync(url)).digest('hex')
const anchorTolerance = .025
const contourTolerance = .03
function compareAnchor(actual: Vec2, expected: Vec2, label: string): void {
  const error = Math.hypot(actual.x - expected.x, actual.y - expected.y)
  assert.ok(error < anchorTolerance, `${label}: ${error} TeX pt exceeds ${anchorTolerance}`)
}
function lineDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const x = b.x - a.x, y = b.y - a.y
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * x + (point.y - a.y) * y) / (x * x + y * y || 1)))
  return Math.hypot(point.x - a.x - t * x, point.y - a.y - t * y)
}
function directedDistance(a: readonly Vec2[], b: readonly Vec2[]): number {
  return Math.max(...a.map((point) => Math.min(...b.map((end, index) => lineDistance(point, end, b[(index + 1) % b.length]!)))))
}
function geometricMiter(points: readonly Vec2[], sep: number): Vec2[] {
  const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x
  const sign = points.reduce((area, point, i) => area + cross(point, points[(i + 1) % points.length]!), 0) < 0 ? -1 : 1
  return points.map((point, i) => {
    const before = points[(i + points.length - 1) % points.length]!, after = points[(i + 1) % points.length]!
    const firstLength = Math.hypot(point.x - before.x, point.y - before.y), secondLength = Math.hypot(after.x - point.x, after.y - point.y)
    const first = { x: sign * (point.y - before.y) / firstLength, y: sign * (before.x - point.x) / firstLength }
    const second = { x: sign * (after.y - point.y) / secondLength, y: sign * (point.x - after.x) / secondLength }
    const denominator = 1 + first.x * second.x + first.y * second.y
    return { x: point.x + sep * (first.x + second.x) / denominator, y: point.y + sep * (first.y + second.y) / denominator }
  })
}

test('signed polygonal references authenticate all retained review bytes, 54 fixed boxes, 1386 anchors, 12 arithmetic controls and one PGF singular boundary', () => {
  assert.equal(fixture.schema, 'stz-pgf-signed-polygonal-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.deepEqual(fixture.command, ['/Library/TeX/texbin/pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex'])
  assert.equal(fixture.exitCode, 0)
  const original = JSON.parse(readFileSync(new URL('../references.json', directory), 'utf8')) as { sourceHashes: Record<string, string> }
  assert.deepEqual(fixture.sourceHashes, original.sourceHashes)
  for (const [file, expected] of [['fixed-box.tex', fixture.sourceTexSha256], ['geometry.txt', fixture.geometrySha256],
    ['compilation.txt', fixture.compilationSha256], ['generate.mjs', fixture.generatorSha256], ['review/artifact-hashes.json', fixture.retainedManifestSha256]]) {
    assert.equal(hash(new URL(file!, directory)), expected, file)
  }
  for (const [file, expected] of Object.entries(fixture.retainedArtifactHashes)) assert.equal(hash(new URL(`review/${file}`, directory)), expected, file)
  assert.equal(fixture.retainedCases, 36)
  assert.equal(fixture.freshCases, 18)
  assert.equal(fixture.cases.length, 54)
  assert.equal(new Set(fixture.cases.map(({ id }) => id)).size, 54)
  assert.equal(fixture.cases.reduce((count, value) => count + value.anchors.length, 0), 1386)
  assert.equal(new Set(fixture.cases.map(({ shape }) => shape)).size, 6)
  assert.equal(fixture.arithmetic.length, 12)
  assert.equal(fixture.failures.length, 1)
  assert.equal(fixture.cases.filter(({ expectedDartFitting }) => expectedDartFitting).length, 4)
  assert.ok(readFileSync(new URL('compilation.txt', directory), 'utf8').includes('STZ PGF VERSION 3.1.11a'))
  assert.doesNotMatch(readFileSync(new URL('generate.mjs', directory), 'utf8'), /from ['"][^'"]*src\//, 'Oracle generation imports no production module')
  for (const value of fixture.cases) {
    const raw = readFileSync(new URL(value.rawArtifact, directory), 'utf8')
    const observations = value.rawArtifact.startsWith('review/') ? raw : raw.split(`CASE ${value.id}\n`)[1]!.split('CASE ')[0]!
    for (const name of value.anchors) {
      const line = observations.split('\n').find((entry) => entry.startsWith(`ANCHOR ${name}; `))!
      const [, x, y] = /; (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line)!
      assert.deepEqual(value.expectedAnchors[name], { x: Number(x) || 0, y: -Number(y) || 0 }, `${value.id}/${name}: one Y conversion`)
    }
    const fields = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight'] as const
    const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
    const options = fields.map((field, i) => `/pgf/${keys[i]}=${value[field]}pt`).concat(value.options ?? []).join(',')
    const id = value.rawArtifact.startsWith('review/') ? 'probe' : value.id
    const width = value.rawArtifact.startsWith('review/') ? '.4' : String(value.lineWidth)
    const command = String.raw`\fixedshape{${id}}{${value.pgfShape}}{${value.body.width}}{${value.body.height}}{${value.body.depth}}{${width}}{${options}}{${value.anchors.join(',')}}`
    assert.ok(readFileSync(new URL(value.inputArtifact, directory), 'utf8').includes(command), `${value.id}: complete independent fixed-box dimensions/options`)
    assert.ok(readFileSync(new URL(value.compilationArtifact, directory), 'utf8').includes('STZ PGF VERSION 3.1.11a'))
    if (value.expectedDartFitting) {
      const line = observations.split('\n').find((entry) => entry.startsWith('DARTFITTING '))!
      const [tipLength, tailLength, halfSeparation, offset] = line.slice(12).split(',').map((dimension) => Number(dimension.replace('pt', '')))
      assert.deepEqual(value.expectedDartFitting, { tipLength, tailLength, halfSeparation, offset })
      const reciprocals = observations.split('\n').filter((entry) => entry.startsWith('DARTRECIP ')).map((entry) => {
        const [, input, expected] = /^DARTRECIP (-?[\d.]+); (-?[\d.]+)$/.exec(entry)!
        return { value: Number(input), expected: Number(expected) }
      })
      assert.deepEqual(value.fittingReciprocals, reciprocals)
    }
  }
})

for (const value of fixture.cases) test(`PGF signed polygonal fitting, paint envelope and all anchors: ${value.id}`, () => {
  const actual = solvePointNodeShape(value)
  assert.equal(actual.anchorDiagnostic, undefined)
  assert.ok(actual.polygonalFitting)
  assert.ok(actual.bounds.minX <= actual.bounds.maxX && actual.bounds.minY <= actual.bounds.maxY)
  assert.equal(actual.contours.length, 1)
  const expectedPaint = value.paints[0]!.tokens.filter(({ kind }) => ['movetotoken', 'linetotoken'].includes(kind))
  const vertices = actual.contours[0]!.vertices
  const residual = Math.max(directedDistance(vertices, expectedPaint), directedDistance(expectedPaint, vertices))
  assert.ok(residual < contourTolerance, `${value.id}: paint residual ${residual} TeX pt exceeds ${contourTolerance}`)
  if (value.expectedDartFitting) {
    const fitting = actual.polygonalFitting
    if (fitting?.kind !== 'dart') throw new Error('Expected dart fitted dimensions')
    for (const name of ['tipLength', 'tailLength', 'halfSeparation', 'offset'] as const) {
      assert.ok(Math.abs(fitting[name] - value.expectedDartFitting[name]) < 1 / 65536, `${value.id}/${name}: sequential TeX dimension arithmetic`)
    }
    for (const observation of value.fittingReciprocals) {
      assert.ok(Math.abs(pgfReciprocal(observation.value) - observation.expected) < 1 / 65536, `${value.id}: raw fitting reciprocal ${observation.value}`)
    }
  }
  for (const name of value.anchors) {
    assert.equal(pointNodeAnchorIssue(value.shape, name, value.parameters), undefined, name)
    const anchor = resolvePointNodeAnchor(value, actual, name)
    assert.equal(anchor.supported, true, `${value.id}/${name}: ${anchor.diagnostic}`)
    compareAnchor(anchor.position, value.expectedAnchors[name]!, `${value.id}/${name}`)
  }
  const scale = 1.2
  const input = { ...value, anchor: value.anchors.at(-1)!, unitScale: scale,
    body: { width: value.body.width * scale, height: value.body.height * scale, depth: value.body.depth * scale },
    innerXSep: value.innerXSep * scale, innerYSep: value.innerYSep * scale, outerXSep: value.outerXSep * scale, outerYSep: value.outerYSep * scale,
    minimumWidth: value.minimumWidth * scale, minimumHeight: value.minimumHeight * scale, lineWidth: value.lineWidth! * scale,
    parameters: value.parameters ? { ...value.parameters, ...(value.parameters.starPointHeight !== undefined ? { starPointHeight: value.parameters.starPointHeight * scale } : {}) } : undefined,
    fontContext: { em: value.fontContext!.em * scale, ex: value.fontContext!.ex * scale } }
  const scaled = solvePointNodeShape(input)
  for (const name of value.anchors) {
    const resolved = resolvePointNodeAnchor(input, scaled, name)
    assert.equal(resolved.supported, true, `${value.id}/${name}: SVG-scale support`)
    compareAnchor({ x: resolved.position.x / scale, y: resolved.position.y / scale }, value.expectedAnchors[name]!, `${value.id}/${name}: SVG-scale placement`)
  }
  compareAnchor({ x: scaled.placementAnchor.x / scale, y: scaled.placementAnchor.y / scale }, value.expectedAnchors[input.anchor]!, `${value.id}: chosen anchor`)
})

test('direct authenticated reciprocal controls preserve the signed >100 branch and divide then atan stretch semantics', () => {
  for (const value of fixture.arithmetic) {
    if (value.kind === 'reciprocal') {
      assert.ok(Math.abs(pgfReciprocal(value.value) - value.expected) < 1 / 65536, `reciprocal ${value.value}`)
    } else {
      const quotient = pgfDivide(value.numerator, value.denominator)
      assert.ok(Math.abs(quotient - value.quotient) < 1 / 65536)
      assert.ok(Math.abs(pgfAtan(quotient) - value.angle) < .0005, 'PGF atan table and printed decimal interpolation')
      assert.ok(Math.abs(Math.atan2(value.numerator, value.denominator) * 180 / Math.PI - value.angle) > 90, 'atan2 would infer a different quadrant')
    }
  }
  const signed = fixture.arithmetic.find((value): value is Extract<Arithmetic, { kind: 'reciprocal' }> => value.kind === 'reciprocal' && value.value === -200.125)!
  assert.ok(Math.abs(-pgfReciprocal(200.125) - signed.expected) > 4 / 65536, 'abs then reciprocal chooses the wrong lane')
  const dart = fixture.cases.find(({ id }) => id === 'dart-negative-height-minimum')!
  const fittingReciprocal = dart.fittingReciprocals.find(({ value }) => value < -100)!
  assert.ok(Math.abs(-pgfReciprocal(-fittingReciprocal.value) - fittingReciprocal.expected) > 2 / 65536, 'The actual signed dart minimum uses the different PGF lane')
})

test('independent controls reject unsigned radius, reversed separation and generic geometric miters with identical paint', () => {
  for (const shape of ['regular polygon', 'square', 'triangle'] as const) {
    const value = fixture.cases.find(({ id }) => id === `empty-${shape.replaceAll(' ', '-')}-3`)!
    const actual = solvePointNodeShape(value)
    const fitting = actual.polygonalFitting!
    assert.equal(fitting.kind, 'regular polygon')
    if (fitting.kind !== 'regular polygon') throw new Error('Expected regular polygon fitting')
    const unsigned = { ...actual, polygonalFitting: { ...fitting, radius: Math.abs(fitting.radius) } }
    assert.deepEqual(unsigned.contours, actual.contours)
    assert.deepEqual(unsigned.bounds, actual.bounds)
    assert.throws(() => compareAnchor(resolvePointNodeAnchor(value, unsigned, 'corner 1').position, value.expectedAnchors['corner 1']!, 'absolute fitted radius'))
    const flipped = { ...value, outerXSep: -value.outerXSep, outerYSep: -value.outerYSep }
    assert.deepEqual(solvePointNodeShape(flipped).contours, actual.contours)
    assert.throws(() => compareAnchor(resolvePointNodeAnchor(flipped, actual, 'corner 1').position, value.expectedAnchors['corner 1']!, 'sign-flipped separation'))
  }
  for (const [id, anchor] of [['empty-star-3', 'outer point 1'], ['empty-dart-3', 'tip']]) {
    const value = fixture.cases.find((entry) => entry.id === id)!
    const actual = solvePointNodeShape(value)
    const miter = geometricMiter(actual.contours[0]!.vertices.map(({ x, y }) => ({ x, y: -y })), value.outerXSep)[0]!
    assert.throws(() => compareAnchor({ x: miter.x, y: -miter.y }, value.expectedAnchors[anchor!]!, 'winding-derived geometric outward miter'))
  }
  const triangle = fixture.cases.find(({ id }) => id === 'empty-isosceles-triangle-3')!
  const solution = solvePointNodeShape(triangle)
  const fitting = solution.polygonalFitting!
  if (fitting.kind !== 'isosceles triangle') throw new Error('Expected triangle fitting')
  const [apex, left, right] = solution.contours[0]!.vertices
  const inferred = Math.atan2(right!.y - left!.y, 2 * (apex!.x - left!.x)) * 180 / Math.PI
  assert.throws(() => compareAnchor(resolvePointNodeAnchor(triangle, { ...solution, polygonalFitting: { ...fitting, effectiveHalfAngle: inferred } }, 'left corner').position,
    triangle.expectedAnchors['left corner']!, 'signed vertices cannot reconstruct the fitting angle'))
})

for (const value of fixture.failures) test(`independently singular signed polygonal boundary stays diagnosed: ${value.id}`, () => {
  assert.equal(value.exitCode, 1)
  for (const [kind, file] of Object.entries(value.artifacts)) assert.equal(hash(new URL(file, directory)), value.hashes[kind])
  assert.ok(readFileSync(new URL(value.artifacts.compilation!, directory), 'utf8').includes(value.expectedError))
  assert.throws(() => solvePointNodeShape(value), /cannot be inverted by PGF/)
})
