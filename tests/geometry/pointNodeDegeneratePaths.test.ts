import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Vec2 } from '../../src/model/types.ts'
import { solvePointNodeShape, resolvePointNodeAnchor, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { ShapeContourBuilder, ellipseContour, ellipsePoint, svgPoint } from '../../src/geometry/pointNodeShapes/contours.ts'

type Token = { kind: string; x: number; y: number }
type Observation = { id: string; paints: { action: string; tokens: Token[] }[]; expectedAnchors: Record<string, Vec2> }
type NodeReference = Observation & PointNodeShapeInput & { kind: 'node' }
type ArcReference = Observation & { kind: 'arc'; center: Vec2; rx: number; ry: number; start: number; end: number; rotation: number }
const directory = new URL('../fixtures/point-node-anchors/zero-axis/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; engine: string; command: string[]; exitCode: number; sourceHashes: Record<string, string>;
  sourceTexSha256: string; geometrySha256: string; compilationSha256: string; generatorSha256: string; cases: (NodeReference | ArcReference)[]
}
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')
function close(actual: number, expected: number, tolerance = .03) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`)
}
function distance(a: Vec2, b: Vec2): number { return Math.hypot(b.x - a.x, b.y - a.y) }
function length(points: readonly Vec2[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index]!, point), 0)
}
function linePath(path: string): Vec2[] {
  assert.ok(!path.includes(' A '), 'Collapsed ellipse paints a traversal rather than omitted SVG arcs')
  return [...path.matchAll(/[ML] (-?[\d.e+]+) (-?[\d.e+]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }))
}
function pgfSamples(tokens: readonly Token[]): Vec2[] {
  const result: Vec2[] = []
  let cursor: Vec2 = { x: 0, y: 0 }, a = cursor, b = cursor, first = cursor
  for (const token of tokens) {
    const point = { x: token.x, y: token.y }
    if (token.kind === 'movetotoken') {
      // PGF's final move after close starts no additional painted subpath.
      if (result.length) break
      result.push(point); cursor = point; first = point
    } else if (token.kind === 'curvetosupportatoken') a = point
    else if (token.kind === 'curvetosupportbtoken') b = point
    else if (token.kind === 'curvetotoken') {
      const start = cursor
      for (let index = 1; index <= 96; index++) {
        const t = index / 96, u = 1 - t
        result.push({ x: u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * point.x,
          y: u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * point.y })
      }
      cursor = point
    } else if (token.kind === 'linetotoken') { result.push(point); cursor = point }
    else if (token.kind === 'closepathtoken') result.push(first)
    else throw new Error(`Unknown PGF token ${token.kind}`)
  }
  return result
}

test('zero-axis oracle authenticates retained independent failing probes and eleven additive PGF paths', () => {
  assert.equal(fixture.schema, 'stz-pgf-zero-axis-paths-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.equal(fixture.exitCode, 0)
  assert.deepEqual(fixture.command.slice(1), ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex'])
  assert.equal(fixture.cases.length, 11)
  assert.equal(fixture.cases.filter(({ kind }) => kind === 'node').length, 5)
  assert.equal(Object.keys(fixture.sourceHashes).length, 8)
  assert.equal(fixture.sourceHashes['/usr/local/texlive/2026/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex'],
    '64b0b4193616b937a2b4520c678f8863ae06ab38385bb58db437b39a8f27719b')
  for (const [file, expected] of [['fixed-box.tex', fixture.sourceTexSha256], ['geometry.txt', fixture.geometrySha256],
    ['compilation.txt', fixture.compilationSha256], ['generate.mjs', fixture.generatorSha256]]) {
    assert.equal(hash(readFileSync(new URL(file!, directory))), expected, file)
  }
  const retained = JSON.parse(readFileSync(new URL('review/manifest.json', directory), 'utf8')) as { artifactHashes: Record<string, string> }
  assert.equal(Object.keys(retained.artifactHashes).length, 29)
  for (const [file, expected] of Object.entries(retained.artifactHashes)) assert.equal(hash(readFileSync(new URL(`review/${file}`, directory))), expected, file)
  const generator = readFileSync(new URL('generate.mjs', directory), 'utf8')
  assert.ok(!generator.includes('src/') && !generator.includes('solvePointNodeShape'), 'Oracle input/parsing is independent of production')
  const prior = JSON.parse(readFileSync(new URL('review/render-results.json', directory), 'utf8')) as { renders: { name: string; metrics: string }[] }
  assert.equal(prior.renders[0]!.metrics, '1 1 1 0x0+800+800', 'The retained original production raster is genuinely blank')
  assert.equal(prior.renders[1]!.metrics, '0.996464 0 1 4x566+398+117', 'Independent PGF paint was visible')
})

for (const entry of fixture.cases) test(`PGF signed degenerate traversal: ${entry.id}`, () => {
  const contour = entry.kind === 'node' ? solvePointNodeShape(entry).contours[0]!
    : new ShapeContourBuilder(entry.rotation).move(ellipsePoint(entry.center, entry.rx, entry.ry, entry.start))
      .arc(entry.center, entry.rx, entry.ry, entry.start, entry.end).finish()
  const actual = linePath(contour.path), expected = pgfSamples(entry.paints[0]!.tokens)
  close(length(actual), length(expected))
  for (const axis of ['x', 'y'] as const) {
    close(Math.min(...actual.map(point => point[axis])), Math.min(...expected.map(point => point[axis])))
    close(Math.max(...actual.map(point => point[axis])), Math.max(...expected.map(point => point[axis])))
    close(actual[0]![axis], expected[0]![axis])
    close(actual.at(-1)![axis], expected.at(-1)![axis])
  }
  assert.equal(contour.closed, entry.kind === 'node')
  close(length(contour.closed ? [...contour.vertices, contour.vertices[0]!] : contour.vertices), length(actual), 1e-8)
  if (entry.kind === 'node') {
    const result = solvePointNodeShape(entry)
    for (const [name, point] of Object.entries(entry.expectedAnchors)) {
      const anchor = resolvePointNodeAnchor(entry, result, name)
      assert.equal(anchor.supported, true)
      close(anchor.position.x, point.x, .025); close(anchor.position.y, point.y, .025)
    }
    const quarterEndpoints = entry.paints[0]!.tokens.filter(({ kind }) => kind === 'movetotoken' || kind === 'curvetotoken').slice(0, 5)
    assert.equal(actual.length, 5, 'All four quarter traversals including closure start/end remain explicit')
    quarterEndpoints.forEach((point, index) => { close(actual[index]!.x, point.x); close(actual[index]!.y, point.y) })
  } else {
    assert.equal(actual.length, 3, 'A partial sweep with equal endpoints retains its intervening extremum')
    assert.ok(distance(actual[0]!, actual[1]!) > 1)
    assert.ok(distance(actual[1]!, actual[2]!) > 1)
  }
})

test('zero-x ellipse retains signed order, total retracing length and zero-area fill, excluding shortened-line/absolute-axis controls', () => {
  for (const surviving of [20, -20]) {
    const contour = ellipseContour(0, surviving)
    assert.deepEqual(linePath(contour.path), [{ x: 0, y: 0 }, { x: 0, y: -surviving }, { x: 0, y: 0 }, { x: 0, y: surviving }, { x: 0, y: 0 }])
    close(length(linePath(contour.path)), 4 * Math.abs(surviving), 1e-10)
    assert.ok(contour.path.endsWith(' Z'), 'Closure keeps the original join rather than creating new open caps')
    const twiceArea = contour.vertices.reduce((area, point, index) => {
      const next = contour.vertices[(index + 1) % contour.vertices.length]!
      return area + point.x * next.y - next.x * point.y
    }, 0)
    assert.equal(twiceArea, 0)
    assert.notEqual(length([{ x: 0, y: -surviving }, { x: 0, y: surviving }]), length(linePath(contour.path)), 'Shortened segment changes dash phase/traversal length')
  }
  assert.notEqual(ellipseContour(0, -20).path, ellipseContour(0, 20).path, 'Absolute surviving radius changes authored angular direction')
})

test('degenerate partial sweeps preserve turning extrema after signed reversal and rotation; nonzero arc encoding/work limit stays unchanged', () => {
  for (const [rx, ry, from, to, rotation] of [[0, 20, 45, 135, 37], [0, -20, 135, 45, -23], [20, 0, -45, 45, 37], [-20, 0, 45, -45, -23]]) {
    const contour = new ShapeContourBuilder(rotation).move(ellipsePoint({ x: 0, y: 0 }, rx!, ry!, from!))
      .arc({ x: 0, y: 0 }, rx!, ry!, from!, to!).finish()
    const turn = svgPoint(ellipsePoint({ x: 0, y: 0 }, rx!, ry!, rx === 0 ? 90 : 0), rotation)
    close(linePath(contour.path)[1]!.x, turn.x, 1e-8); close(linePath(contour.path)[1]!.y, turn.y, 1e-8)
  }
  assert.equal(ellipseContour(8, 3).path, 'M 8 0 A 8 3 0 0 0 -8 0 A 8 3 0 0 0 8 0 Z')
  assert.throws(() => ellipseContour(0, -1e8), /2048-sample arc budget/)
})
