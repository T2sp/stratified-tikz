import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { solvePointNodeShape, resolvePointNodeAnchor, pointNodeAnchorIssue, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import type { Vec2 } from '../../src/model/types.ts'

type Token = { kind: string; x: number; y: number }
type Reference = PointNodeShapeInput & { id: string; anchors: string[]; paints: { action: string; tokens: Token[] }[]; expectedAnchors: Record<string, Vec2> }
type FailureReference = PointNodeShapeInput & { id: string; anchors: string[]; expectedError: string; diagnostic: string; exitCode: number;
  artifacts: Record<'input' | 'compilation' | 'geometry', string>; hashes: Record<'input' | 'compilation' | 'geometry', string> }
const directory = new URL('../fixtures/point-node-anchors/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; sourceHashes: Record<string, string>; sourceTexSha256: string; geometrySha256: string; cases: Reference[]; failures: FailureReference[]
}
// Retain 32C's 0.025 TeX-pt precision. It includes fixed-point trigonometric
// tables, miter/intersection arithmetic and the PGF cubic-circle approximation.
const tolerance = .025
const contourTolerance = .03 // up to80pt radius: .000273r PGF cubic deviation + .005 solver sagitta
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
      case 'closepathtoken': if (points.length) points.push(points[0]!); break
      case 'rectcornertoken': points = [end]; cursor = end; break
      case 'rectsizetoken': points.push({ x: cursor.x + end.x, y: cursor.y }, { x: cursor.x + end.x, y: cursor.y + end.y },
        { x: cursor.x, y: cursor.y + end.y }, cursor); break
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
    for (let i = 1; i < b.length; i++) distance = Math.min(distance, segmentDistance(point, b[i - 1]!, b[i]!))
    return distance
  }))
}
function compare(actual: Vec2[], expected: Vec2[], label: string): void {
  const residual = Math.max(directedDistance(actual, expected), directedDistance(expected, actual))
  assert.ok(residual < contourTolerance, `${label}: contour residual ${residual}pt exceeds ${contourTolerance}pt`)
}
function compareAnchor(actual: Vec2, expected: Vec2, label: string): void {
  const residual = Math.hypot(actual.x - expected.x, actual.y - expected.y)
  assert.ok(residual < tolerance, `${label}: anchor residual ${residual}pt exceeds ${tolerance}pt`)
}

test('Phase32D PGF oracle authenticates 172 fixed boxes, all fifteen identities, 4925 independent anchors and eleven expected PGF failures', () => {
  assert.equal(fixture.schema, 'stz-pgf-point-anchors-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.deepEqual(Object.values(fixture.sourceHashes).sort(), ['01dd81e3f2c56a8db7864916ada1a5036964aff2e8176aafd4773244e236bb27',
    'bbd6abe9df51153e2f4f61cca3ad669de34a6648cf37795df44da931402b69ee',
    '7533dd80c95a5124726b0a617a5f458226d4a7490bcd209e3fd7e717e24dc127',
    '58fcc94547646458470315a6d10953a9729e7962e3def5273633b06fb444a5aa',
    '1c8834abe00807467a52d31ef96032d5084b2560eea45995018084d13a3cde3c',
    'c94abbd89ad0556546d9e5053af16b58ce7f38d19c379b27309e5fefd23908f8',
    'bdea875774b4ad7a1e12debc67c46286245031f5c2e287c9e192f3ca4b6193b6'].sort())
  for (const [file, hash] of [['fixed-box.tex', fixture.sourceTexSha256], ['geometry.txt', fixture.geometrySha256]]) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file!, directory))).digest('hex'), hash)
  }
  assert.equal(new Set(fixture.cases.map(({ shape }) => shape)).size, 15)
  assert.equal(new Set(fixture.cases.map(({ id }) => id)).size, 172)
  assert.equal(fixture.cases.length, 172)
  assert.equal(fixture.cases.reduce((count, entry) => count + entry.anchors.length, 0), 4925)
  assert.equal(fixture.failures.length, 11)
  assert.ok(fixture.cases.every(({ fontContext }) => fontContext && fontContext.em > 0 && fontContext.ex > 0))
})

for (const entry of fixture.failures) test(`PGF independently singular anchor/fitting branch: ${entry.id}`, () => {
  assert.ok(entry.exitCode !== 0, 'An expected PGF failure is retained separately from successful geometry evidence')
  for (const kind of ['input', 'compilation', 'geometry'] as const) {
    const content = readFileSync(new URL(`failures/${entry.artifacts[kind]}`, directory))
    assert.equal(createHash('sha256').update(content).digest('hex'), entry.hashes[kind])
  }
  assert.ok(readFileSync(new URL(`failures/${entry.artifacts.compilation}`, directory), 'utf8').includes(entry.expectedError))
  const input = { ...entry, anchor: entry.anchors[0]! }
  if (entry.shape === 'cylinder') assert.throws(() => solvePointNodeShape(input), /asin domain/)
  else {
    const solution = solvePointNodeShape(input)
    assert.ok(solution.anchorDiagnostic?.includes(entry.diagnostic), solution.anchorDiagnostic)
    const resolved = resolvePointNodeAnchor(input, solution, input.anchor)
    assert.equal(resolved.supported, false)
    assert.ok(resolved.diagnostic?.includes(entry.diagnostic), resolved.diagnostic)
    assert.ok(Object.values(solution.bounds).every(Number.isFinite), 'An unused singular anchor does not poison a valid contour')
  }
})

for (const entry of fixture.cases) test(`PGF spacing/minimum/anchor reference: ${entry.id}`, () => {
  const actual = solvePointNodeShape(entry)
  const expected = samples(entry.paints.find(({ action }) => action === 'stroke')!.tokens)
  assert.equal(actual.contours.length, expected.length, 'All closed contours and open cylinder seam present')
  actual.contours.forEach((contour, index) => compare(contour.closed ? [...contour.vertices, contour.vertices[0]!] : contour.vertices,
    expected[index]!, `${entry.id} contour ${index}`))
  for (const name of entry.anchors) {
    assert.equal(pointNodeAnchorIssue(entry.shape, name, entry.parameters), undefined, name)
    const resolved = resolvePointNodeAnchor(entry, actual, name)
    assert.equal(resolved.supported, true, `${entry.id}/${name}: ${resolved.diagnostic}`)
    compareAnchor(resolved.position, entry.expectedAnchors[name]!, `${entry.id}/${name}`)
  }
  compareAnchor({ x: actual.bodyOrigin.x, y: actual.baseline }, entry.expectedAnchors.text!, `${entry.id} authoritative text origin`)
  assert.deepEqual(actual.placementAnchor, { x: 0, y: 0 })
})

test('independent controls reject incorrect circle diameter, independently stretched triangle, body offset and omitted outer clearance', () => {
  const circle = fixture.cases.find(({ id }) => id === 'circle-zero')!
  const actualCircle = solvePointNodeShape(circle).contours[0]!
  assert.throws(() => compare(actualCircle.vertices.map(({ x, y }) => ({ x: x / 2, y: y / 2 })), samples(circle.paints[0]!.tokens)[0]!, 'incorrect diameter'))
  const triangle = fixture.cases.find(({ id }) => id === 'isosceles-triangle-minima')!
  const actualTriangle = solvePointNodeShape(triangle).contours[0]!
  assert.throws(() => compare(actualTriangle.vertices.map(({ x, y }) => ({ x: x * 1.1, y })), samples(triangle.paints[0]!.tokens)[0]!, 'independently stretched triangle'))
  assert.throws(() => compareAnchor({ x: triangle.expectedAnchors.text!.x + 1, y: triangle.expectedAnchors.text!.y }, triangle.expectedAnchors.text!, 'wrong body offset'))
  const outer = fixture.cases.find(({ id }) => id === 'trapezium-unequal')!
  const omitted = { ...outer, outerXSep: 0, outerYSep: 0 }
  const omittedShape = solvePointNodeShape(omitted)
  assert.throws(() => compareAnchor(resolvePointNodeAnchor(omitted, omittedShape, 'top left corner').position, outer.expectedAnchors['top left corner']!, 'ignored outer sep'))
})
