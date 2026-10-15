import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolvePointNodeAnchor, solvePointNodeShape, pointNodeAnchorSupport, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { cylinderDimensionDomain, scanTexPointsToSp } from '../../src/geometry/pointNodeShapes/cylinderDomain.ts'
import { restrictedBorderRotation } from '../../src/geometry/pointNodeShapes/solve.ts'
import type { Vec2 } from '../../src/model/types.ts'
type Token = Vec2 & { kind: string }
type Reference = PointNodeShapeInput & { id: string; anchors: string[]; exitCode: number; artifacts: Record<string, string>; expectedError?: string;
  expectedStages: Record<string, number>; expectedAnchors: Record<string, Vec2>; paints: { action: string; tokens: Token[] }[] }
const directory = new URL('../fixtures/point-node-anchors/cylinder-fitting-scanning/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; engine: string; engineBinarySha256: string; sourceHashes: Record<string, string>;
  originalReferenceSha256: string; generatorSha256: string; artifactHashes: Record<string, string>;
  namedAnchors: string[]; numericAnchors: string[]; retainedReviewHashes: Record<string, string>;
  failures: Reference[]; controls: Reference[]; nonzeroDomain: Reference[]
}
const hash = (url: URL): string => createHash('sha256').update(readFileSync(url)).digest('hex')
function scaled(value: Reference, scale: number): PointNodeShapeInput {
  return { ...value, unitScale: scale, body: { width: value.body.width * scale, height: value.body.height * scale, depth: value.body.depth * scale },
    innerXSep: value.innerXSep * scale, innerYSep: value.innerYSep * scale, outerXSep: value.outerXSep * scale, outerYSep: value.outerYSep * scale,
    minimumWidth: value.minimumWidth * scale, minimumHeight: value.minimumHeight * scale, lineWidth: (value.lineWidth ?? .4) * scale }
}
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


test('separate full-cylinder fitting/scanning bundle authenticates immutable input/raw/compiler/source and actual-generated reviewer bytes', () => {
  assert.equal(fixture.schema, 'stz-pgf-cylinder-fitting-scanning-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.match(fixture.engineBinarySha256, /^[a-f\d]{64}$/)
  assert.equal(hash(new URL('../references.json', directory)), fixture.originalReferenceSha256)
  assert.equal(hash(new URL('generate.mjs', directory)), fixture.generatorSha256)
  assert.doesNotMatch(readFileSync(new URL('generate.mjs', directory), 'utf8'), /from ['"][^'"]*src\//)
  for (const [file, expected] of Object.entries(fixture.artifactHashes)) assert.equal(hash(new URL(file, directory)), expected, file)
  for (const [file, expected] of Object.entries(fixture.retainedReviewHashes)) assert.equal(hash(new URL(`review/${file}`, directory)), expected, file)
  assert.equal(fixture.namedAnchors.length, 23)
  assert.deepEqual(new Set(fixture.namedAnchors), new Set([...pointNodeAnchorSupport.cylinder.standard, ...pointNodeAnchorSupport.cylinder.specific]))
  assert.equal(fixture.numericAnchors.length, 14)
  for (const value of [...fixture.failures, ...fixture.controls, ...fixture.nonzeroDomain]) {
    const input = readFileSync(new URL(value.artifacts.input!, directory), 'utf8')
    assert.ok(input.includes(`\\fixedshape{${value.id}}{cylinder}`))
    const raw = readFileSync(new URL(value.artifacts.geometry!, directory), 'utf8')
    assert.ok(raw.startsWith(`CASE ${value.id}\nFONT `))
    assert.ok(readFileSync(new URL(value.artifacts.compilation!, directory), 'utf8').includes('STZ PGF VERSION 3.1.11a'))
    for (const [name, expected] of Object.entries(value.expectedAnchors)) {
      const match = new RegExp(`^ANCHOR ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}; (-?[\\d.]+)pt,(-?[\\d.]+)pt$`, 'm').exec(raw)!
      assert.deepEqual(expected, { x: Number(match[1]) || 0, y: -Number(match[2]) || 0 }, 'exactly one PGF Y conversion')
    }
  }
  assert.ok(readFileSync(new URL('review/subsp/recompiled-compilation.txt', directory), 'utf8').includes("You've asked me to divide"))
  assert.match(readFileSync(new URL('review/folded/recompiled-compilation.txt', directory), 'utf8'), /Output written on/)
})

for (const value of [...fixture.failures, ...fixture.controls, ...fixture.nonzeroDomain]) test(`authenticated staged cylinder register domain, signed ties and unitScale: ${value.id}`, () => {
  const rotation = value.parameters?.borderUsesIncircle ? value.parameters?.borderRotate ?? 0 : restrictedBorderRotation(value.parameters?.borderRotate ?? 0, true)
  for (const scale of [1, 1.2, 2.7]) {
    const actual = cylinderDimensionDomain(scaled(value, scale), rotation, value.parameters?.borderUsesIncircle ?? false)
    assert.deepEqual(actual, value.expectedStages, `independent literal upstream register trace in TeX sp at scale ${scale}`)
  }
  if (value.expectedStages.divisorSp === 0) {
    assert.equal(value.exitCode, 1)
    assert.throws(() => solvePointNodeShape(value), /Cylinder effective transverse radius is zero/)
    assert.doesNotMatch(readFileSync(new URL(value.artifacts.geometry!, directory), 'utf8'), /PAINT|ANCHOR/)
  } else {
    assert.notEqual(value.expectedStages.divisorSp, 0)
    try { solvePointNodeShape(value) } catch (error) {
      assert.ok(error instanceof RangeError); assert.doesNotMatch(error.message, /effective transverse radius is zero/, 'later existing limitations are distinct from zero-domain classification')
    }
  }
})

for (const value of fixture.controls) test(`independent complete PGF cylinder paint/seam and declared-anchor roles: ${value.id}`, () => {
  assert.equal(value.exitCode, 0)
  for (const scale of [1, 1.2]) {
    const input = scaled(value, scale), actual = solvePointNodeShape(input)
    assert.equal(actual.anchorDiagnostic, undefined)
    const expected = samples(value.paints.find(({ action }) => action === 'stroke')!.tokens)
    assert.equal(actual.contours.length, expected.length)
    actual.contours.forEach((contour, index) => {
      const points = (contour.closed ? [...contour.vertices, contour.vertices[0]!] : contour.vertices).map(p => ({ x: p.x / scale, y: p.y / scale }))
      const residual = Math.max(directedDistance(points, expected[index]!), directedDistance(expected[index]!, points))
      assert.ok(residual < .03, `${value.id} contour/seam ${index}: ${residual}pt exceeds .03pt`)
      assert.ok(contour.bounds.minX <= contour.bounds.maxX && contour.bounds.minY <= contour.bounds.maxY)
    })
    const fills = value.paints.filter(({ action }) => action === 'fill')
    if (fills.length) {
      assert.equal(fills.length, 2)
      actual.paintRegions.forEach((region, index) => {
        assert.equal(region.role, index === 0 ? 'body' : 'end')
        const expectedRegion = samples(fills[index]!.tokens)[0]!
        const points = [...region.vertices, region.vertices[0]!].map(p => ({ x: p.x / scale, y: p.y / scale }))
        const residual = Math.max(directedDistance(points, expectedRegion), directedDistance(expectedRegion, points))
        assert.ok(residual < .03, `${value.id} custom ${region.role}: ${residual}pt exceeds .03pt`)
      })
    }
    for (const name of value.anchors) {
      const resolved = resolvePointNodeAnchor(input, actual, name)
      assert.equal(resolved.supported, true, `${value.id}/${name}: ${resolved.diagnostic}`)
      const residual = Math.hypot(resolved.position.x / scale - value.expectedAnchors[name]!.x, resolved.position.y / scale - value.expectedAnchors[name]!.y)
      assert.ok(residual < .025, `${value.id}/${name}: ${residual}pt exceeds .025pt`)
      const placed = solvePointNodeShape({ ...input, anchor: name })
      assert.deepEqual(placed.placementAnchor, resolved.position)
      assert.deepEqual(placed.contours, actual.contours, 'clearance/placement cannot alter paint')
      assert.deepEqual(placed.paintRegions, actual.paintRegions)
    }
  }
})

test('folded cylinder retains signed roles while ordered bounds cannot recover them', () => {
  const folded = fixture.controls.find(({ id }) => id === 'folded')!
  const actual = solvePointNodeShape(folded), fit = actual.cylinderFitting!
  assert.equal(fit.rx, 5); assert.equal(fit.ry, 5)
  assert.ok(fit.halfLength < 0 && fit.endCenter.x < fit.baseCenter.x)
  assert.ok(Math.abs(fit.endCenter.x - .6) < 1e-8); assert.ok(Math.abs(fit.baseCenter.x - 9.6) < 1e-8)
  assert.ok(Math.abs(actual.anchors.bottom.x - 4.6) < 1e-8)
  assert.ok(Math.abs(actual.shapeCenter.x - 5.1) < 1e-8)
  assert.notEqual(actual.bounds.minX + Math.abs(fit.rx), fit.baseCenter.x)
  assert.equal(scanTexPointsToSp(-1 / 131072), -1)
  assert.equal(scanTexPointsToSp(1 / 131072), 1)
  const min1 = fixture.failures.find(({ id }) => id === 'minimum-one-sp')!, min2 = fixture.nonzeroDomain.find(({ id }) => id === 'minimum-two-sp')!
  assert.equal(min1.expectedStages.minimumWidthHalfSp, 0)
  assert.equal(min2.expectedStages.minimumWidthHalfSp, 1)
  assert.equal(min2.expectedError, 'Dimension too large', 'later reciprocal overflow is distinct from zero-divisor scanning')
})
