import assert from 'node:assert/strict'
import test from 'node:test'
import type { PointShape, PointShapeParameters, Vec2 } from '../../src/model/types.ts'
import { solvePointNodeShape, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { restrictedBorderRotation } from '../../src/geometry/pointNodeShapes/solve.ts'

const shapes: PointShape[] = ['ellipse', 'diamond', 'regular polygon', 'star', 'trapezium',
  'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
const fixed = (shape: PointShape, parameters: PointShapeParameters = {}): PointNodeShapeInput => ({
  shape, parameters, body: { width: 20, height: 8, depth: 3 }, innerXSep: 1.5, innerYSep: 1.5,
  outerXSep: 0, outerYSep: 0, minimumWidth: 1, minimumHeight: 1, lineWidth: .4,
})
function close(actual: number, expected: number, tolerance = 1e-8): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}
function inside(point: Vec2, vertices: Vec2[]): boolean {
  let result = false
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const a = vertices[index]!
    const b = vertices[previous]!
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result
  }
  return result
}

for (const shape of shapes) {
  for (const [name, body] of Object.entries({ empty: { width: 0, height: 0, depth: 0 }, wide: { width: 48, height: 7, depth: 2 },
    tall: { width: 8, height: 28, depth: 5 }, asymmetric: { width: 20, height: 8, depth: 3 } })) {
    test(`${shape}: ${name} fixed box has finite closed geometry and upright baseline`, () => {
      const input = { ...fixed(shape), body }
      const result = solvePointNodeShape(input)
      assert.equal(result.contours[0]?.closed, true)
      assert.ok(Object.values(result.bounds).every(Number.isFinite))
      assert.ok(result.contours.every((contour) => contour.vertices.length <= 8200))
      close(result.baseline, (body.height - body.depth) / 2)
      assert.deepEqual(result.bodyOrigin, { x: -body.width / 2, y: -(body.height + body.depth) / 2 })
      for (const corner of [{ x: -body.width / 2, y: -(body.height + body.depth) / 2 },
        { x: body.width / 2, y: -(body.height + body.depth) / 2 },
        { x: -body.width / 2, y: (body.height + body.depth) / 2 },
        { x: body.width / 2, y: (body.height + body.depth) / 2 }]) {
        assert.ok(inside(corner, result.contours[0]!.vertices), `${shape} does not enclose ${JSON.stringify(corner)}`)
      }
    })
  }
  test(`${shape}: geometry does not mutate its explicit input or retain it`, () => {
    const input = fixed(shape)
    const before = JSON.stringify(input)
    const result = solvePointNodeShape(input)
    assert.equal(JSON.stringify(input), before)
    input.body.width = 99
    assert.equal(result.bodyBounds.maxX, 10)
  })
}

test('ellipse and diamond fit their padded body independently on each axis', () => {
  const ellipse = solvePointNodeShape(fixed('ellipse'))
  close(ellipse.bounds.maxX, Math.SQRT2 * 11.5)
  close(ellipse.bounds.maxY, Math.SQRT2 * 7)
  assert.match(ellipse.contours[0]!.path, / A /)
  const diamond = solvePointNodeShape(fixed('diamond', { aspect: 2 }))
  close(diamond.bounds.maxX, 25.5)
  close(diamond.bounds.maxY, 12.75)
})

test('regular polygon minima constrain circumcircle; legacy square is distinct from rectangle', () => {
  const polygon = solvePointNodeShape({ ...fixed('regular polygon', { regularPolygonSides: 7 }), minimumWidth: 70 })
  close(polygon.radius, 35)
  assert.equal(polygon.contours[0]!.vertices.length, 7)
  assert.notDeepEqual(solvePointNodeShape(fixed('square')).bounds, solvePointNodeShape(fixed('rectangle')).bounds)
  const regular = solvePointNodeShape(fixed('triangle'))
  const isosceles = solvePointNodeShape(fixed('isosceles triangle'))
  assert.ok(regular.contours[0]!.vertices[0]!.y < 0)
  assert.ok(isosceles.contours[0]!.vertices[0]!.x > 0)
})

test('star minimum growth preserves the explicitly active ratio or height', () => {
  for (const mode of ['ratio', 'height'] as const) {
    const result = solvePointNodeShape({ ...fixed('star', { starPoints: 7, starPointRatio: 2.2, starPointHeight: 8, starPointMode: mode }), minimumWidth: 90 })
    const [outerPoint, innerPoint] = result.contours[0]!.vertices
    const outer = Math.hypot(outerPoint!.x, outerPoint!.y)
    const inner = Math.hypot(innerPoint!.x, innerPoint!.y)
    close(outer, 45)
    if (mode === 'ratio') close(outer / inner, 2.2)
    else close(outer - inner, 8)
  }
})

test('trapezium stretch and stretch-body follow different minimum-width behavior', () => {
  const input = { ...fixed('trapezium'), minimumWidth: 100, minimumHeight: 40 }
  const normal = solvePointNodeShape(input)
  const stretch = solvePointNodeShape({ ...input, parameters: { trapeziumStretches: true } })
  const body = solvePointNodeShape({ ...input, parameters: { trapeziumStretchesBody: true } })
  assert.notDeepEqual(normal.bounds, stretch.bounds)
  assert.notDeepEqual(stretch.contours[0]!.vertices, body.contours[0]!.vertices)
  close(stretch.bounds.maxY - stretch.bounds.minY, 40)
  close(body.bounds.maxX - body.bounds.minX, 100)
})

test('isosceles stretch changes its effective angle under independent minima', () => {
  const input = { ...fixed('isosceles triangle'), minimumWidth: 100, minimumHeight: 80 }
  const normal = solvePointNodeShape(input)
  const stretched = solvePointNodeShape({ ...input, parameters: { isoscelesTriangleStretches: true } })
  assert.notDeepEqual(normal.bounds, stretched.bounds)
  close(stretched.bounds.maxX - stretched.bounds.minX, 80)
  close(stretched.bounds.maxY - stretched.bounds.minY, 100)
})

test('asymmetric contours retain their actual offset from the body center', () => {
  for (const shape of ['semicircle', 'kite', 'dart', 'isosceles triangle', 'circular sector', 'cylinder'] as const) {
    const { bounds, bodyBounds } = solvePointNodeShape(fixed(shape))
    assert.ok(Math.abs(bounds.minX + bounds.maxX) > .01 || Math.abs(bounds.minY + bounds.maxY) > .01, shape)
    close(bodyBounds.minX + bodyBounds.maxX, 0)
    close(bodyBounds.minY + bodyBounds.maxY, 0)
  }
})

test('PGF restricted rotation preserves its shape-specific negative-angle ordering', () => {
  assert.equal(restrictedBorderRotation(-90), 0)
  assert.equal(restrictedBorderRotation(-90, true), 270)
  assert.equal(restrictedBorderRotation(44.9), 0)
  assert.equal(restrictedBorderRotation(45), 90)
  assert.equal(solvePointNodeShape(fixed('trapezium', { borderRotate: -90 })).rotation, 0)
  assert.equal(solvePointNodeShape(fixed('isosceles triangle', { borderRotate: -90 })).rotation, 270)
  assert.equal(solvePointNodeShape(fixed('cylinder', { borderRotate: -90 })).rotation, 270)
})

test('border rotations leave body origin and baseline upright and obey incircle rules', () => {
  for (const shape of shapes) {
    const normal = solvePointNodeShape(fixed(shape))
    const rotated = solvePointNodeShape(fixed(shape, { borderRotate: 37, borderUsesIncircle: true }))
    assert.deepEqual(normal.bodyOrigin, rotated.bodyOrigin)
    close(normal.baseline, rotated.baseline)
    if (shape === 'ellipse' || shape === 'diamond') {
      assert.equal(rotated.rotation, 0)
      assert.deepEqual(normal.contours, rotated.contours)
    } else assert.equal(rotated.rotation, 37)
  }
})

test('outer separation is independent clearance, never additional paint or fill hits', () => {
  for (const shape of shapes) {
    const normal = solvePointNodeShape(fixed(shape))
    const spaced = solvePointNodeShape({ ...fixed(shape), outerXSep: 4, outerYSep: 7 })
    assert.deepEqual(normal.contours, spaced.contours)
    assert.deepEqual(normal.bounds, spaced.bounds)
    assert.ok(spaced.anchorBounds.minX < normal.bounds.minX)
    assert.ok(spaced.anchorBounds.maxY > normal.bounds.maxY)
  }
})

test('cylinder has two separate paint regions and a genuinely open seam', () => {
  const result = solvePointNodeShape(fixed('cylinder', { aspect: .4, cylinderUsesCustomFill: true }))
  assert.equal(result.contours.length, 2)
  assert.equal(result.contours[0]!.closed, true)
  assert.equal(result.contours[1]!.closed, false)
  assert.doesNotMatch(result.contours[1]!.path, /Z/)
  assert.deepEqual(result.paintRegions.map((region) => region.role), ['body', 'end'])
  assert.notEqual(result.paintRegions[0]!.path, result.paintRegions[1]!.path)
  const wideStroke = solvePointNodeShape({ ...fixed('cylinder', { aspect: .4 }), lineWidth: 5 })
  assert.ok(wideStroke.bounds.maxX > result.bounds.maxX)
  close(wideStroke.bounds.minX, result.bounds.minX)
})

test('dart retains a concave notch rather than bounding-box fill picking', () => {
  const dart = solvePointNodeShape(fixed('dart'))
  const notch = dart.contours[0]!.vertices[2]!
  assert.ok(!inside({ x: notch.x - 1, y: 0 }, dart.contours[0]!.vertices))
  assert.ok(inside({ x: notch.x + 1, y: 0 }, dart.contours[0]!.vertices))
})

test('invalid finite-domain and count inputs are rejected rather than substituted', () => {
  const bad: PointShapeParameters[] = [{ aspect: 0 }, { aspect: Infinity }, { starPointRatio: .5 },
    { starPoints: 65 }, { regularPolygonSides: 2 }, { regularPolygonSides: 3.5 },
    { starPointHeight: -1 }, { borderRotate: NaN }, { trapeziumLeftAngle: 0 },
    { kiteUpperVertexAngle: 180 }, { dartTipAngle: 120, dartTailAngle: 60 },
    { circularSectorAngle: 0 }, { circularSectorAngle: 180 }, { circularSectorAngle: 240 },
    { circularSectorAngle: 300 }, { circularSectorAngle: 359 }, { circularSectorAngle: 360 }]
  for (const parameters of bad) assert.throws(() => solvePointNodeShape(fixed('star', parameters)), RangeError)
  assert.throws(() => solvePointNodeShape({ ...fixed('ellipse'), body: { width: -1, height: 3, depth: 1 } }), RangeError)
})

test('maximum legal polygon/star counts remain bounded', () => {
  assert.equal(solvePointNodeShape(fixed('regular polygon', { regularPolygonSides: 64 })).contours[0]!.vertices.length, 64)
  assert.equal(solvePointNodeShape(fixed('star', { starPoints: 64 })).contours[0]!.vertices.length, 128)
})

test('sector preview domain excludes reflex contours that fail tall body enclosure', () => {
  for (const circularSectorAngle of [240, 300, 359]) {
    assert.throws(() => solvePointNodeShape({ ...fixed('circular sector', { circularSectorAngle }),
      body: { width: 8, height: 28, depth: 5 } }), /reflex sectors do not preserve PGF body enclosure/)
  }
  const obtuse = solvePointNodeShape({ ...fixed('circular sector', { circularSectorAngle: 150 }),
    body: { width: 8, height: 28, depth: 5 } })
  for (const x of [-4, 4]) for (const y of [-16.5, 16.5]) assert.ok(inside({ x, y }, obtuse.contours[0]!.vertices))
})

test('curved shapes reject excessive sampling work without degrading hit precision', () => {
  assert.throws(() => solvePointNodeShape({ ...fixed('ellipse'), body: { width: 1_000_000, height: 8, depth: 3 } }),
    /bounded 2048-sample arc budget/)
  assert.throws(() => solvePointNodeShape({ ...fixed('trapezium'), body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0 }),
    /zero-area body/)
})

test('geometry unit scaling preserves PGF minimum arithmetic independently of preview scale', () => {
  for (const shape of ['trapezium', 'kite', 'dart', 'circular sector'] as const) {
    const input = { ...fixed(shape), minimumWidth: 65, minimumHeight: 80 }
    const plain = solvePointNodeShape(input)
    const unitScale = 1.2
    const scaled = solvePointNodeShape({ ...input, unitScale,
      body: { width: 24, height: 9.6, depth: 3.6 }, innerXSep: 1.8, innerYSep: 1.8,
      minimumWidth: 78, minimumHeight: 96, lineWidth: .48 })
    for (const axis of ['minX', 'minY', 'maxX', 'maxY'] as const) close(scaled.bounds[axis], unitScale * plain.bounds[axis])
  }
})
