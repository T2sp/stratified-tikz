import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { solvePointNodeShape, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import type { Vec2 } from '../../src/model/types.ts'

type Token = { kind: string; x: number; y: number }
type Reference = PointNodeShapeInput & { id: string; paints: { action: string; tokens: Token[] }[]; text: Vec2; center: Vec2 }
const directory = new URL('../fixtures/point-node-shapes/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; sourceHash: string; sourceTexSha256: string; geometrySha256: string; cases: Reference[]
}

// PGF's own cubic approximation is compared with the solver's analytic arcs.
// 0.025pt includes PGF fixed-point trig and <=0.000273r cubic radial error
// for the largest reference radius (<80pt). It is 0.03 preview units, far
// below a pixel or the separate six-unit native proximity tolerance.
const tolerance = .025
function samples(tokens: Token[]): Vec2[][] {
  const paths: Vec2[][] = []
  let points: Vec2[] = [], cursor: Vec2 = { x: 0, y: 0 }, a = cursor, b = cursor
  for (const token of tokens) {
    const end = { x: token.x, y: token.y }
    switch (token.kind) {
      case 'movetotoken':
        if (points.length > 1) paths.push(points)
        points = [end]; cursor = end; break
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
      case 'closepathtoken': if (points.length) points.push(points[0]); break
      default: throw new Error(`Unsupported independent PGF token ${token.kind}`)
    }
  }
  if (points.length > 1) paths.push(points)
  return paths
}
function segmentDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}
function directedDistance(a: Vec2[], b: Vec2[]): number {
  return Math.max(...a.map((point) => {
    let distance = Infinity
    for (let i = 1; i < b.length; i++) distance = Math.min(distance, segmentDistance(point, b[i - 1], b[i]))
    return distance
  }))
}
function compare(actual: Vec2[], expected: Vec2[], label: string) {
  const residual = Math.max(directedDistance(actual, expected), directedDistance(expected, actual))
  assert.ok(residual < tolerance, `${label}: contour residual ${residual}pt exceeds ${tolerance}pt`)
}
test('PGF oracle is complete and authenticates the retained TeX and raw outputs', () => {
  assert.equal(fixture.schema, 'stz-pgf-point-shapes-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.sourceHash, 'bbd6abe9df51153e2f4f61cca3ad669de34a6648cf37795df44da931402b69ee')
  for (const [file, hash] of [['fixed-box.tex', fixture.sourceTexSha256], ['geometry.txt', fixture.geometrySha256]])
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, directory))).digest('hex'), hash)
  assert.equal(new Set(fixture.cases.map(({ shape }) => shape)).size, 11)
  assert.equal(fixture.cases.length, 92)
})
for (const entry of fixture.cases) test(`PGF fixed box: ${entry.id}`, () => {
  const actual = solvePointNodeShape(entry)
  const expected = samples(entry.paints.find(({ action }) => action === 'stroke')!.tokens)
  assert.equal(actual.contours.length, expected.length, 'All closed contours and open cylinder seam present')
  actual.contours.forEach((contour, index) => compare(contour.closed ? [...contour.vertices, contour.vertices[0]] : contour.vertices,
    expected[index], `${entry.id} contour ${index}`))
  assert.ok(Math.abs(actual.bodyOrigin.x - entry.text.x) < .001)
  assert.ok(Math.abs(actual.baseline - entry.text.y) < .001, `${entry.id}: text baseline`)
  assert.deepEqual(entry.center, { x: 0, y: 0 })
  const fills = entry.paints.filter(({ action }) => action === 'fill')
  if (fills.length) {
    assert.deepEqual(actual.paintRegions.map(({ role }) => role), ['body', 'end'])
    fills.forEach((fill, index) => compare([...actual.paintRegions[index].vertices, actual.paintRegions[index].vertices[0]],
      samples(fill.tokens)[0], `${entry.id} ${actual.paintRegions[index].role} fill`))
  }
})
test('independent distance controls reject wrong radius, body offset and omitted cylinder paints', () => {
  const entry = fixture.cases.find(({ id }) => id === 'ellipse-asymmetric')!
  const actual = solvePointNodeShape(entry).contours[0]
  const expected = samples(entry.paints[0].tokens)[0]
  assert.throws(() => compare(actual.vertices.map(({ x, y }) => ({ x: 1.1 * x, y })), expected, 'wrong radius'))
  assert.throws(() => compare(actual.vertices.map(({ x, y }) => ({ x: x + 1, y })), expected, 'wrong offset'))
  assert.equal(fixture.cases.find(({ id }) => id === 'cylinder-fills')!.paints.filter(({ action }) => action === 'fill').length, 2)
})
