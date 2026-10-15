import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Vec2 } from '../../src/model/types.ts'
import { solvePointNodeShape, resolvePointNodeAnchor, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { ShapeContourBuilder, ellipsePoint } from '../../src/geometry/pointNodeShapes/contours.ts'

type Token = { kind: string; x: number; y: number }
type Observation = { id: string; paints: { tokens: Token[] }[]; expectedAnchors: Record<string, Vec2> }
type NodeCase = Observation & PointNodeShapeInput & { kind: 'node' }
type ArcCase = Observation & { kind: 'arc'; rx: number; ry: number; start: number; end: number; rotation: number; center: Vec2; closed: boolean }
const directory = new URL('../fixtures/point-node-anchors/signed-traversal/', import.meta.url)
const references = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; engine: string; pgfVersion: string; command: string[]; exitCode: number; units: string;
  artifactHashes: Record<string, string>; sourceHashes: Record<string, string>; cases: (NodeCase | ArcCase)[]
}
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
function pgfSamples(tokens: Token[]): Vec2[] {
  const points: Vec2[] = []
  let cursor = { x: 0, y: 0 }, a = cursor, b = cursor
  for (const token of tokens) {
    const end = { x: token.x, y: token.y }
    if (token.kind === 'movetotoken') { if (points.length) break; points.push(end); cursor = end }
    else if (token.kind === 'curvetosupportatoken') a = end
    else if (token.kind === 'curvetosupportbtoken') b = end
    else if (token.kind === 'curvetotoken') {
      for (let index = 1; index <= 256; index++) {
        const t = index / 256, u = 1 - t
        points.push({ x: u ** 3 * cursor.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x,
          y: u ** 3 * cursor.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y })
      }
      cursor = end
    } else if (token.kind === 'closepathtoken') points.push(points[0]!)
    else throw new Error(`Unexpected PGF token ${token.kind}`)
  }
  return points
}
/** SVG endpoint-to-center conversion, independent of signed PGF parameterization. */
function svgSamples(path: string): Vec2[] {
  const words = path.split(/\s+/), points: Vec2[] = []
  let offset = 0, cursor: Vec2 = { x: 0, y: 0 }
  const next = () => Number(words[offset++])
  while (offset < words.length) {
    const command = words[offset++]
    if (command === 'M') { cursor = { x: next(), y: next() }; points.push(cursor) }
    else if (command === 'Z') points.push(points[0]!)
    else {
      assert.equal(command, 'A')
      const rx = next(), ry = next(), phi = next() * Math.PI / 180, large = next(), sweep = next()
      assert.ok(rx > 0 && ry > 0, 'SVG radius operands are positive magnitudes')
      const end = { x: next(), y: next() }, cos = Math.cos(phi), sin = Math.sin(phi)
      const dx = (cursor.x - end.x) / 2, dy = (cursor.y - end.y) / 2
      const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy
      const ratio = Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp))
      const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(ratio)
      const cxp = coefficient * rx * yp / ry, cyp = -coefficient * ry * xp / rx
      const center = { x: cos * cxp - sin * cyp + (cursor.x + end.x) / 2, y: sin * cxp + cos * cyp + (cursor.y + end.y) / 2 }
      const start = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx)
      const finish = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx)
      let span = finish - start
      if (sweep === 0 && span > 0) span -= 2 * Math.PI
      if (sweep === 1 && span < 0) span += 2 * Math.PI
      for (let index = 1; index <= 512; index++) {
        const theta = start + span * index / 512, x = rx * Math.cos(theta), y = ry * Math.sin(theta)
        points.push({ x: center.x + cos * x - sin * y, y: center.y + sin * x + cos * y })
      }
      cursor = end
    }
  }
  return points
}
function atLength(points: readonly Vec2[], fraction: number): Vec2 {
  const lengths = points.slice(1).map((point, index) => distance(point, points[index]!))
  let remaining = fraction * lengths.reduce((sum, length) => sum + length, 0)
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length && length > 0) {
      const a = points[index]!, b = points[index + 1]!, t = remaining / length
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    }
    remaining -= length
  }
  return points.at(-1)!
}
function pathLength(points: readonly Vec2[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index]!, point), 0)
}
function contourFor(entry: NodeCase | ArcCase, absolute = false) {
  if (entry.kind === 'node') return solvePointNodeShape(entry).contours[0]!
  const rx = absolute ? Math.abs(entry.rx) : entry.rx, ry = absolute ? Math.abs(entry.ry) : entry.ry
  const builder = new ShapeContourBuilder(entry.rotation).move(ellipsePoint(entry.center, rx, ry, entry.start))
    .arc(entry.center, rx, ry, entry.start, entry.end)
  return (entry.closed ? builder.close() : builder).finish()
}

test('signed traversal oracle authenticates PGF inputs, raw paths, engine/source and additive artifact identities', () => {
  assert.equal(references.schema, 'stz-pgf-signed-traversal-v1'); assert.equal(references.pgfVersion, '3.1.11a')
  assert.equal(references.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.equal(references.exitCode, 0); assert.equal(references.cases.length, 18)
  assert.equal(Object.keys(references.sourceHashes).length, 6)
  assert.deepEqual(references.command.slice(1), ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex'])
  for (const [file, expected] of Object.entries(references.artifactHashes)) assert.equal(hash(readFileSync(new URL(file, directory))), expected, file)
  assert.equal(references.sourceHashes['/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex'],
    '64b0b4193616b937a2b4520c678f8863ae06ab38385bb58db437b39a8f27719b')
  const generator = readFileSync(new URL('generate.mjs', directory), 'utf8')
  assert.doesNotMatch(generator, /src\/|solvePointNodeShape|ShapeContourBuilder/, 'Independent generator cannot consume production geometry')
})

for (const entry of references.cases) test(`signed traversal follows independent ordered PGF path: ${entry.id}`, () => {
  const contour = contourFor(entry), expected = pgfSamples(entry.paints[0]!.tokens), painted = svgSamples(contour.path)
  const sampled = contour.closed ? [...contour.vertices, contour.vertices[0]!] : contour.vertices
  assert.equal(contour.closed, entry.kind === 'node' || entry.closed)
  assert.ok(Math.abs(pathLength(painted) - pathLength(expected)) < .03, 'Ordered SVG stroke length follows PGF')
  assert.ok(Math.abs(pathLength(sampled) - pathLength(expected)) < .03, 'Picking density retains stroke length')
  for (let index = 0; index <= 128; index++) {
    const reference = atLength(expected, index / 128)
    assert.ok(distance(atLength(painted, index / 128), reference) < .03, `${index}: SVG traversal differs from PGF`)
    assert.ok(distance(atLength(sampled, index / 128), reference) < .03, `${index}: ordered picking contour differs from PGF`)
  }
  // First and last tangents retain direction, independently of equal bounds.
  for (const [from, to] of [[0, 1 / 128], [127 / 128, 1]] as const) {
    const a = atLength(painted, from), b = atLength(painted, to), c = atLength(expected, from), d = atLength(expected, to)
    assert.ok((b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y) > 0)
  }
  if (entry.kind === 'node') {
    const solution = solvePointNodeShape(entry)
    for (const [name, expectedAnchor] of Object.entries(entry.expectedAnchors)) {
      const anchor = resolvePointNodeAnchor(entry, solution, name)
      assert.equal(anchor.supported, true)
      assert.ok(distance(anchor.position, expectedAnchor) < .025, name)
    }
  }
})

test('independent direction checks reject old sweep and global absolute-axis controls', () => {
  for (const entry of references.cases.filter((entry): entry is ArcCase => entry.kind === 'arc' && (entry.rx < 0) !== (entry.ry < 0))) {
    const contour = contourFor(entry), expected = pgfSamples(entry.paints[0]!.tokens)
    const old = contour.path.replace(/(A [-\d.e+]+ [-\d.e+]+ [-\d.e+]+ 0 )([01])( [-\d.e+]+ [-\d.e+]+)/g, (_, before: string, _sweep: string, after: string) => `${before}${entry.end > entry.start ? 0 : 1}${after}`)
    for (const control of [old, contourFor(entry, true).path]) {
      const mismatch = Math.max(...Array.from({ length: 33 }, (_, index) => distance(atLength(svgSamples(control), index / 32), atLength(expected, index / 32))))
      assert.ok(mismatch > 5, `${entry.id}: control must fail the unchanged .03pt traversal tolerance`)
    }
  }
})
