import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolvePointNodeAnchor, solvePointNodeShape, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import type { Vec2 } from '../../src/model/types.ts'

type Token = Vec2 & { kind: string }
type Reference = PointNodeShapeInput & { id: string; anchors: string[]; options?: string[]; exitCode: number;
  command: string[]; artifacts: Record<string, string>; expectedError?: string;
  expectedAnchors: Record<string, Vec2>; paints: { action: string; tokens: Token[] }[] }
const directory = new URL('../fixtures/point-node-anchors/cylinder-domain/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; engine: string; engineBinarySha256: string; pgfVersion: string; upstream: string;
  sourceHashes: Record<string, string>; originalReferenceSha256: string; generatorSha256: string;
  artifactHashes: Record<string, string>; retainedReviewHashes: Record<string, string>;
  actualGenerated: { command: string[]; exitCode: number; expectedError: string }; failures: Reference[]; controls: Reference[]
}
const hash = (url: URL): string => createHash('sha256').update(readFileSync(url)).digest('hex')
const original = JSON.parse(readFileSync(new URL('../references.json', directory), 'utf8')) as { sourceHashes: Record<string, string> }

function samples(tokens: readonly Token[]): Vec2[][] {
  const paths: Vec2[][] = []
  let points: Vec2[] = [], cursor: Vec2 = { x: 0, y: 0 }, a = cursor, b = cursor
  for (const token of tokens) {
    const end = { x: token.x, y: token.y }
    switch (token.kind) {
      case 'movetotoken': if (points.length > 1) paths.push(points); points = [end]; cursor = end; break
      case 'linetotoken': points.push(end); cursor = end; break
      case 'curvetosupportatoken': a = end; break
      case 'curvetosupportbtoken': b = end; break
      case 'curvetotoken': {
        const start = cursor
        for (let i = 1; i <= 96; i++) {
          const t = i / 96, u = 1 - t
          points.push({ x: u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x,
            y: u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y })
        }
        cursor = end; break
      }
      case 'closepathtoken': if (points.length) points.push(points[0]!); break
      case 'rectcornertoken': points = [end]; cursor = end; break
      case 'rectsizetoken': points.push({ x: cursor.x + end.x, y: cursor.y }, { x: cursor.x + end.x, y: cursor.y + end.y },
        { x: cursor.x, y: cursor.y + end.y }, cursor); break
      default: throw new Error(`Unexpected independent PGF token ${token.kind}`)
    }
  }
  if (points.length > 1) paths.push(points)
  return paths
}
function directedDistance(a: readonly Vec2[], b: readonly Vec2[]): number {
  return Math.max(...a.map(point => Math.min(...b.slice(1).map((end, index) => {
    const start = b[index]!, dx = end.x - start.x, dy = end.y - start.y
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy)
  }))))
}

test('additive cylinder oracle authenticates eleven failures, twelve valid neighbors, exact reviewer bytes and correctly wrapped actual generated failure', () => {
  assert.equal(fixture.schema, 'stz-pgf-cylinder-domain-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.match(fixture.engineBinarySha256, /^[a-f\d]{64}$/)
  assert.equal(fixture.upstream, 'https://github.com/pgf-tikz/pgf/releases/tag/3.1.11a')
  assert.deepEqual(fixture.sourceHashes, original.sourceHashes)
  assert.equal(hash(new URL('../references.json', directory)), fixture.originalReferenceSha256)
  assert.equal(hash(new URL('generate.mjs', directory)), fixture.generatorSha256)
  assert.doesNotMatch(readFileSync(new URL('generate.mjs', directory), 'utf8'), /from ['"][^'"]*src\//)
  for (const [file, expected] of Object.entries(fixture.artifactHashes)) assert.equal(hash(new URL(file, directory)), expected, file)
  for (const [file, expected] of Object.entries(fixture.retainedReviewHashes)) assert.equal(hash(new URL(`review/${file}`, directory)), expected, file)
  assert.equal(fixture.failures.length, 11); assert.equal(fixture.controls.length, 12)
  assert.equal(new Set([...fixture.failures, ...fixture.controls].map(({ id }) => id)).size, 23)
  const generated = readFileSync(new URL('actual-generated.tex', directory), 'utf8')
  const wrapped = readFileSync(new URL('actual-generated-wrapped.tex', directory), 'utf8')
  assert.equal(generated, readFileSync(new URL('review/actual-generated.tex', directory), 'utf8'))
  assert.equal(wrapped, '\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric,shapes.symbols}\n\\typeout{STZ PGF VERSION \\pgfversion}\n\\begin{document}\n' + generated + '\n\\end{document}\n')
  assert.equal(fixture.actualGenerated.exitCode, 1)
  assert.deepEqual(fixture.actualGenerated.command, ['/Library/TeX/texbin/pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'actual-generated-wrapped.tex'])
  assert.ok(readFileSync(new URL('actual-generated-wrapped-compilation.txt', directory), 'utf8').includes(fixture.actualGenerated.expectedError))
  for (const value of [...fixture.failures, ...fixture.controls]) {
    assert.deepEqual(value.command, ['/Library/TeX/texbin/pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex'])
    const input = readFileSync(new URL(value.artifacts.input!, directory), 'utf8')
    const fields = ['innerXSep', 'innerYSep', 'outerXSep', 'outerYSep', 'minimumWidth', 'minimumHeight'] as const
    const keys = ['inner xsep', 'inner ysep', 'outer xsep', 'outer ysep', 'minimum width', 'minimum height']
    const options = fields.map((field, index) => `/pgf/${keys[index]}=${value[field]}pt`).concat(value.options ?? []).join(',')
    assert.ok(input.includes(String.raw`\fixedshape{${value.id}}{${value.shape}}{${value.body.width}}{${value.body.height}}{${value.body.depth}}{${value.lineWidth}}{${options}}{${value.anchors.join(',')}}`))
    const compilation = readFileSync(new URL(value.artifacts.compilation!, directory), 'utf8')
    assert.ok(compilation.includes('STZ PGF VERSION 3.1.11a'))
    const raw = readFileSync(new URL(value.artifacts.geometry!, directory), 'utf8')
    assert.ok(raw.startsWith(`CASE ${value.id}\nFONT `))
    for (const name of Object.keys(value.expectedAnchors)) {
      const line = raw.split('\n').find(entry => entry.startsWith(`ANCHOR ${name}; `))!
      const [, x, y] = /; (-?[\d.]+)pt,(-?[\d.]+)pt$/.exec(line)!
      assert.deepEqual(value.expectedAnchors[name], { x: Number(x) || 0, y: -Number(y) || 0 }, 'one raw PGF Y conversion')
    }
  }
})

for (const value of fixture.failures) test(`computed zero transverse cylinder radius is diagnosed before contours: ${value.id}`, () => {
  assert.equal(value.exitCode, 1)
  const raw = readFileSync(new URL(value.artifacts.geometry!, directory), 'utf8')
  assert.doesNotMatch(raw, /PAINT|ANCHOR/)
  assert.ok(readFileSync(new URL(value.artifacts.compilation!, directory), 'utf8').includes(value.expectedError!))
  const before = structuredClone(value)
  assert.throws(() => solvePointNodeShape(value), { name: 'RangeError', message: 'Cylinder effective transverse radius is zero; PGF’s fitting division is undefined.' })
  assert.deepEqual(value, before)
  assert.throws(() => solvePointNodeShape({ ...value, innerXSep: value.innerXSep * 1.2, innerYSep: value.innerYSep * 1.2,
    body: { width: value.body.width * 1.2, height: value.body.height * 1.2, depth: value.body.depth * 1.2 },
    minimumWidth: value.minimumWidth * 1.2, minimumHeight: value.minimumHeight * 1.2, unitScale: 1.2 }), /effective transverse radius is zero/)
})

for (const value of fixture.controls) test(`independent valid cylinder/basic/ellipse neighbor retains contours and anchors: ${value.id}`, () => {
  assert.equal(value.exitCode, 0)
  const actual = solvePointNodeShape(value)
  assert.equal(actual.anchorDiagnostic, undefined)
  const expected = samples(value.paints.find(({ action }) => action === 'stroke')!.tokens)
  assert.equal(actual.contours.length, expected.length)
  actual.contours.forEach((contour, index) => {
    const points = contour.closed ? [...contour.vertices, contour.vertices[0]!] : contour.vertices
    const residual = Math.max(directedDistance(points, expected[index]!), directedDistance(expected[index]!, points))
    assert.ok(residual < .03, `${value.id} contour ${index}: ${residual}pt exceeds .03pt`)
  })
  for (const name of value.anchors) {
    const resolved = resolvePointNodeAnchor(value, actual, name)
    assert.equal(resolved.supported, true, `${value.id}/${name}: ${resolved.diagnostic}`)
    assert.ok(Math.hypot(resolved.position.x - value.expectedAnchors[name]!.x,
      resolved.position.y - value.expectedAnchors[name]!.y) < .025, `${value.id}/${name}: .025pt anchor tolerance`)
  }
})

test('signed zero is singular but the retained nonzero negative-radius and asin-domain branches stay distinct', () => {
  const empty = fixture.failures.find(({ id }) => id === 'empty-zero')!
  assert.throws(() => solvePointNodeShape({ ...empty, innerYSep: -0, minimumWidth: -0 }), /effective transverse radius is zero/)
  const signed = fixture.controls.find(({ id }) => id === 'signed-nonzero-radii')!
  assert.equal(solvePointNodeShape(signed).contours.length, 2)
  assert.throws(() => solvePointNodeShape({ ...empty, body: { width: 20, height: 8, depth: 3 }, innerYSep: -.5 }), /asin domain/)
})
