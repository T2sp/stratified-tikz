import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { solvePointNodeShape, resolvePointNodeAnchor, pointNodeAnchorSupport, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { fitDiamond, type DiamondFitting } from '../../src/geometry/pointNodeShapes/diamondFitting.ts'
import { pgfReciprocal } from '../../src/geometry/pointNodeShapes/pgfMath.ts'
import type { Vec2 } from '../../src/model/types.ts'

type Reference = PointNodeShapeInput & {
  id: string; parameters: { aspect: number }; anchors: string[]; expectedStages: DiamondFitting['stages']
  expectedAnchors: Record<string, Vec2>; paints: { action: string; tokens: (Vec2 & { kind: string })[] }[]
}
const directory = new URL('../fixtures/point-node-anchors/diamond-aspect-scanning/', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('references.json', directory), 'utf8')) as {
  schema: string; pgfVersion: string; engine: string; engineBinarySha256: string; command: string[]; exitCode: number
  originalReferenceSha256: string; generatorSha256: string; sourceHashes: Record<string, string>; artifactHashes: Record<string, string>
  namedAnchors: string[]; numericAnchors: string[]; cases: Reference[]
}
const hash = (url: URL): string => createHash('sha256').update(readFileSync(url)).digest('hex')
function scaled(value: Reference, scale: number): PointNodeShapeInput {
  return { ...value, unitScale: scale, body: { width: value.body.width * scale, height: value.body.height * scale, depth: value.body.depth * scale },
    innerXSep: value.innerXSep * scale, innerYSep: value.innerYSep * scale, outerXSep: value.outerXSep * scale, outerYSep: value.outerYSep * scale,
    minimumWidth: value.minimumWidth * scale, minimumHeight: value.minimumHeight * scale, lineWidth: (value.lineWidth ?? .4) * scale,
    fontContext: { em: value.fontContext!.em * scale, ex: value.fontContext!.ex * scale } }
}
function near(actual: Vec2, expected: Vec2, tolerance: number, label: string): void {
  const residual = Math.hypot(actual.x - expected.x, actual.y - expected.y)
  assert.ok(residual < tolerance, `${label}: ${residual}pt exceeds ${tolerance}pt`)
}

test('additive diamond oracle authenticates actual PGF input/stages/paths and 558 anchors without changing inherited references', () => {
  assert.equal(fixture.schema, 'stz-pgf-diamond-aspect-scanning-v1')
  assert.equal(fixture.pgfVersion, '3.1.11a')
  assert.equal(fixture.engine, 'pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026)')
  assert.match(fixture.engineBinarySha256, /^[a-f\d]{64}$/)
  assert.equal(fixture.exitCode, 0)
  assert.deepEqual(fixture.command.slice(1), ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'fixed-box.tex'])
  assert.equal(hash(new URL('../references.json', directory)), fixture.originalReferenceSha256)
  assert.equal(hash(new URL('generate.mjs', directory)), fixture.generatorSha256)
  assert.doesNotMatch(readFileSync(new URL('generate.mjs', directory), 'utf8'), /from ['"][^'"]*src\//)
  for (const [file, expected] of Object.entries(fixture.artifactHashes)) assert.equal(hash(new URL(file, directory)), expected, file)
  const original = JSON.parse(readFileSync(new URL('../references.json', directory), 'utf8')) as { sourceHashes: Record<string, string> }
  assert.deepEqual(fixture.sourceHashes, original.sourceHashes)
  assert.deepEqual(new Set(fixture.namedAnchors), new Set(pointNodeAnchorSupport.diamond.standard))
  assert.equal(fixture.numericAnchors.length, 14)
  assert.equal(fixture.cases.length, 22)
  assert.equal(fixture.cases.reduce((sum, value) => sum + value.anchors.length, 0), 558)
  const input = readFileSync(new URL('fixed-box.tex', directory), 'utf8')
  const raw = readFileSync(new URL('geometry.txt', directory), 'utf8')
  for (const value of fixture.cases) {
    assert.ok(input.includes(`\\fixedshape{${value.id}}{diamond}`))
    assert.ok(input.includes(`/pgf/aspect=${value.parameters.aspect}`))
    assert.ok(raw.includes(`CASE ${value.id}\nFONT `))
    const observed = raw.split(`CASE ${value.id}\n`)[1]!.split('CASE ')[0]!
    for (const [name, expected] of Object.entries(value.expectedStages)) assert.ok(observed.includes(`STAGE ${name}; ${expected}\n`))
    for (const [name, expected] of Object.entries(value.expectedAnchors)) {
      const pattern = new RegExp(`^ANCHOR ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}; (-?[\\d.]+)pt,(-?[\\d.]+)pt$`, 'm')
      const match = pattern.exec(observed)!
      assert.deepEqual(expected, { x: Number(match[1]) || 0, y: -Number(match[2]) || 0 }, 'one PGF-to-SVG Y conversion')
    }
  }
})

for (const value of fixture.cases) test(`diamond literal PGF aspect inverse/dimensional stages, ordered paint and placement: ${value.id}`, () => {
  for (const scale of [1, 1.2, 2.7]) {
    const input = scaled(value, scale), fit = fitDiamond(input, value.parameters.aspect), actual = solvePointNodeShape(input)
    assert.deepEqual(fit.stages, value.expectedStages, `independent source register trace at unitScale ${scale}`)
    assert.equal(actual.anchorDiagnostic, undefined)
    const tokens = value.paints.find(paint => paint.action === 'stroke')!.tokens
    const expectedVertices = tokens.filter(token => token.kind === 'movetotoken' || token.kind === 'linetotoken')
      .filter((token, index, points) => !index || token.x !== points[index - 1]!.x || token.y !== points[index - 1]!.y)
    assert.equal(actual.contours[0]!.vertices.length, expectedVertices.length)
    actual.contours[0]!.vertices.forEach((point, index) => near({ x: point.x / scale, y: point.y / scale }, expectedVertices[index]!, .03, `${value.id} ordered vertex ${index}`))
    const expectedBounds = { minX: -Math.abs(fit.paintedAxes.x), minY: -Math.abs(fit.paintedAxes.y), maxX: Math.abs(fit.paintedAxes.x), maxY: Math.abs(fit.paintedAxes.y) }
    for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) assert.ok(actual.bounds[key] === expectedBounds[key], `${value.id}/${key}`)
    for (const name of value.anchors) {
      const resolved = resolvePointNodeAnchor(input, actual, name)
      assert.equal(resolved.supported, true, `${value.id}/${name}: ${resolved.diagnostic}`)
      near({ x: resolved.position.x / scale, y: resolved.position.y / scale }, value.expectedAnchors[name]!, .025, `${value.id}/${name}`)
      const placed = solvePointNodeShape({ ...input, anchor: name })
      assert.deepEqual(placed.placementAnchor, resolved.position)
      assert.deepEqual(placed.contours, actual.contours, 'placement keeps fitted paint fixed in node-local coordinates')
      near({ x: (placed.anchors.north!.x - placed.placementAnchor.x) / scale, y: (placed.anchors.north!.y - placed.placementAnchor.y) / scale },
        { x: value.expectedAnchors.north!.x - value.expectedAnchors[name]!.x, y: value.expectedAnchors.north!.y - value.expectedAnchors[name]!.y }, .025, `${value.id}/${name} placed north`)
    }
    for (const name of ['base east', 'base west', 'mid east', 'mid west']) {
      assert.equal(resolvePointNodeAnchor(input, actual, name).supported, false, 'unsupported text-side inventory is unchanged')
      assert.match(solvePointNodeShape({ ...input, anchor: name }).anchorDiagnostic!, /not supported by diamond/)
    }
  }
})

test('independent small-aspect control rejects old division and unrelated pgfmath reciprocal algorithms', () => {
  const value = fixture.cases.find(value => value.id === 'aspect-0.01')!
  assert.equal(value.expectedAnchors.north!.y, -1170.06155)
  const x = value.body.width / 2 + value.innerXSep, y = (value.body.height + value.body.depth) / 2 + value.innerYSep
  const oldNorth = { x: 0, y: -(x / value.parameters.aspect + y) }
  assert.equal(oldNorth.y, -1157)
  assert.throws(() => near(oldNorth, value.expectedAnchors.north!, .025, 'old analytic division'))
  assert.throws(() => near({ x: 0, y: -(x * pgfReciprocal(value.parameters.aspect) + y) }, value.expectedAnchors.north!, .025, 'pgfmath reciprocal'))
  assert.throws(() => near({ x: 0, y: oldNorth.y * 2 }, { x: 0, y: value.expectedAnchors.north!.y * 2 }, .03, 'old contour north-to-south traversal'))
})

test('diamond width and height minima remain independent and outer clearance stays separate from paint', () => {
  const width = fixture.cases.find(value => value.id === 'independent-width-minimum')!, height = fixture.cases.find(value => value.id === 'independent-height-minimum')!
  for (const value of [width, height]) {
    const fit = fitDiamond(value, value.parameters.aspect), unclamped = fitDiamond({ ...value, minimumWidth: -100, minimumHeight: -100 }, value.parameters.aspect)
    const axis = value === width ? 'y' : 'x'
    assert.equal(fit.anchorAxes[axis], unclamped.anchorAxes[axis], 'opposite axis must not be stretched')
  }
  const signed = fixture.cases.find(value => value.id === 'asymmetric-signed-separation')!
  const fit = fitDiamond(signed, signed.parameters.aspect)
  assert.notDeepEqual(fit.anchorAxes, fit.paintedAxes)
  assert.ok(fit.anchorAxes.x < fit.paintedAxes.x && fit.anchorAxes.y > fit.paintedAxes.y)
  const zero = fixture.cases.find(value => value.id === 'zero-body-zero-axes')!
  const actual = solvePointNodeShape(zero)
  assert.deepEqual(fitDiamond(zero, .01).paintedAxes, { x: 0, y: 0 })
  assert.equal(resolvePointNodeAnchor(zero, actual, '45').supported, false, 'zero numeric anchor stays singular')
})
