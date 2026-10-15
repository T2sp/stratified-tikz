import assert from 'node:assert/strict'
import test from 'node:test'
import type { PointShape, Vec2 } from '../../src/model/types.ts'
import { solvePointNodeShape, resolvePointNodeAnchor, pointNodeAnchorSupport, pointNodeAnchorIssue, type PointNodeShapeInput } from '../../src/geometry/pointNodeShapes/index.ts'
import { pgfCircleRadius, pgfReciprocal, pgfMultiply, pgfCos, pgfTan } from '../../src/geometry/pointNodeShapes/pgfMath.ts'

const shapes = Object.keys(pointNodeAnchorSupport) as PointShape[]
const fixed = (shape: PointShape): PointNodeShapeInput => ({ shape, body: { width: 20, height: 8, depth: 3 },
  innerXSep: 1.5, innerYSep: 1.5, outerXSep: .2, outerYSep: .2, minimumWidth: 1, minimumHeight: 1,
  fontContext: { em: 10, ex: 4.30554 } })
function close(actual: Vec2, expected: Vec2, tolerance = 1e-8): void {
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) <= tolerance, `${JSON.stringify(actual)} differs from ${JSON.stringify(expected)}`)
}

for (const shape of shapes) {
  test(`${shape}: declared standard and generated indexed anchors all resolve without center substitution`, () => {
    const input = fixed(shape), solution = solvePointNodeShape(input)
    for (const name of pointNodeAnchorSupport[shape].standard) assert.equal(resolvePointNodeAnchor(input, solution, name).supported, true, name)
    for (const name of Object.keys(solution.anchors)) assert.equal(pointNodeAnchorIssue(shape, name, input.parameters), undefined, name)
    assert.ok(Object.keys(solution.anchors).length >= 12)
    for (const name of ['unknown corner', 'corner 100', 'base invalid', 'NaN', 'Infinity']) {
      const unresolved = resolvePointNodeAnchor(input, solution, name)
      assert.equal(unresolved.supported, false, name)
      assert.match(unresolved.diagnostic!, /not supported/)
    }
    close(resolvePointNodeAnchor(input, solution, '13').position, resolvePointNodeAnchor(input, solution, '373').position)
  })
  test(`${shape}: selected placement uses the current body but does not mutate coordinates or paint for outer separation`, () => {
    const input = { ...fixed(shape), anchor: 'north east' }, before = JSON.stringify(input)
    const solution = solvePointNodeShape(input)
    close(solution.placementAnchor, solution.anchors['north east']!)
    const wide = solvePointNodeShape({ ...input, body: { width: 48, height: 7, depth: 2 } })
    assert.notDeepEqual(solution.placementAnchor, wide.placementAnchor)
    assert.deepEqual(input, JSON.parse(before))
    const spaced = solvePointNodeShape({ ...input, outerXSep: 9, outerYSep: 4 })
    if (shape === 'diamond') assert.ok(spaced.bounds.maxX < solution.bounds.maxX)
    else assert.deepEqual(solution.contours, spaced.contours)
    assert.deepEqual(solution.bodyBounds, spaced.bodyBounds)
    assert.notDeepEqual(solution.anchorBounds, spaced.anchorBounds)
  })
  test(`${shape}: zero and PGF-valid negative spacing remain finite with independent minima`, () => {
    const zero = solvePointNodeShape({ ...fixed(shape), innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 })
    const negative = solvePointNodeShape({ ...fixed(shape), innerXSep: -2, innerYSep: shape === 'cylinder' ? .5 : -.5, outerXSep: -.25, outerYSep: -.5 })
    assert.ok(Object.values(zero.bounds).every(Number.isFinite))
    assert.ok(Object.values(negative.anchorBounds).every(Number.isFinite))
    assert.notDeepEqual(zero.bounds, negative.bounds)
  })
}

test('text/base/mid distinguish actual ink origin, height, depth and contextual x-height', () => {
  const input = { ...fixed('ellipse'), body: { width: 20, height: 3, depth: 9, originX: -12 }, fontContext: { em: 12, ex: 5 } }
  const solution = solvePointNodeShape(input)
  close(solution.anchors.text!, { x: -12, y: -3 })
  close(solution.anchors.base!, { x: 0, y: -3 })
  close(solution.anchors.mid!, { x: 0, y: -5.5 })
  close(solution.textCenter, { x: 0, y: 0 })
  assert.equal(solution.bodyBounds.minX, -10)
})

test('ellipse eccentric compass diagonals differ from radial numeric border directions', () => {
  const input = { ...fixed('ellipse'), innerXSep: 4, innerYSep: 0 }
  const solution = solvePointNodeShape(input)
  assert.notDeepEqual(solution.anchors['north east'], resolvePointNodeAnchor(input, solution, '45').position)
  close(solution.anchors['north east']!, { x: solution.anchorBounds.maxX / Math.SQRT2, y: -solution.anchorBounds.maxY / Math.SQRT2 })
})

test('border-only rotation turns shape-specific anchors while base/text references remain upright', () => {
  const input = fixed('trapezium')
  const plain = solvePointNodeShape(input)
  const rotated = solvePointNodeShape({ ...input, parameters: { borderRotate: 90 } })
  close(rotated.anchors.text!, plain.anchors.text!)
  close(rotated.anchors.base!, plain.anchors.base!)
  const circleInput = { ...input, body: { width: 11, height: 8, depth: 3 }, innerXSep: 1, innerYSep: 1,
    parameters: { borderUsesIncircle: true } }
  const a = solvePointNodeShape(circleInput), b = solvePointNodeShape({ ...circleInput, parameters: { borderUsesIncircle: true, borderRotate: 37 } })
  const point = a.anchors['top left corner']!, angle = 37 * Math.PI / 180
  close(b.anchors['top left corner']!, { x: point.x * Math.cos(angle) + point.y * Math.sin(angle), y: -point.x * Math.sin(angle) + point.y * Math.cos(angle) })
  assert.notDeepEqual(a.anchors.north, b.anchors.north)
})

test('cylinder shape center differs from body center and painted bounds remain independent from anchor clearance', () => {
  const input = fixed('cylinder'), solution = solvePointNodeShape(input)
  assert.ok(Math.abs(solution.anchors['shape center']!.x) > 1)
  close(solution.shapeCenter, solution.anchors['shape center']!)
  close(solution.anchors.center!, { x: 0, y: 0 })
  const spaced = solvePointNodeShape({ ...input, outerXSep: 20, outerYSep: 1 })
  assert.deepEqual(solution.contours, spaced.contours)
  assert.deepEqual(solution.paintRegions, spaced.paintRegions)
  assert.ok(spaced.anchorBounds.maxX > solution.bounds.maxX + 19)
})

test('PGF undefined anchors and singular dimension branches retain explicit diagnostics', () => {
  for (const [shape, names] of [['diamond', ['base east']], ['star', ['base west', 'outer point 6']], ['circular sector', ['apex', 'chord center']], ['dart', ['tail', 'left tail side']]] as const) {
    for (const name of names) {
      const result = solvePointNodeShape({ ...fixed(shape), anchor: name })
      assert.match(result.anchorDiagnostic!, /not supported/)
      assert.equal(pointNodeAnchorIssue(shape, name), result.anchorDiagnostic)
    }
  }
  assert.throws(() => solvePointNodeShape({ ...fixed('cylinder'), innerYSep: -.5 }), /asin domain/)
  assert.throws(() => solvePointNodeShape({ ...fixed('cylinder'), innerYSep: -.5, minimumWidth: 40 }), /asin domain/)
  for (const shape of shapes) assert.ok(Object.values(solvePointNodeShape({ ...fixed(shape), minimumWidth: -2, minimumHeight: -5 }).bounds).every(Number.isFinite))
  for (const name of ['corner N', 'side N', 'outer point N', 'inner point N']) assert.match(pointNodeAnchorIssue('regular polygon', name)!, /not supported/)
})

test('PGF’s reciprocal and circle normalization are distinct from floating division and hypot', () => {
  assert.equal(pgfReciprocal(5.75).toFixed(5), '0.17393')
  assert.equal(pgfReciprocal(.86603).toFixed(5), '1.15463')
  assert.notEqual(pgfCircleRadius(10, 5.5), Math.hypot(10, 5.5))
  assert.equal(pgfCircleRadius(10, 5.5).toFixed(5), '11.37769')
})

test('signed negative clearance axes and zero basic shapes retain PGF anchor semantics', () => {
  for (const shape of ['circle', 'rectangle', 'ellipse', 'diamond'] as const) {
    const input = { ...fixed(shape), outerXSep: -30, outerYSep: -30 }, solution = solvePointNodeShape(input)
    assert.ok(solution.anchors.east!.x < 0)
    assert.ok(solution.anchors.north!.y > 0)
    assert.ok(resolvePointNodeAnchor(input, solution, '45').position.x < 0)
    close(resolvePointNodeAnchor(input, solution, '13.7').position, resolvePointNodeAnchor(input, solution, '13').position)
  }
  for (const shape of ['circle', 'rectangle', 'ellipse'] as const) {
    const input = { ...fixed(shape), body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0, anchor: 'east' }
    const solution = solvePointNodeShape(input)
    assert.equal(solution.anchorDiagnostic, undefined)
    for (const name of ['east', 'north', 'north east', '0', '90', '45']) {
      const resolved = resolvePointNodeAnchor(input, solution, name)
      assert.equal(resolved.supported, true, `${shape}/${name}`)
      close(resolved.position, { x: 0, y: 0 })
    }
  }
  const diamond = { ...fixed('diamond'), body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 }
  const solution = solvePointNodeShape(diamond)
  close(solution.anchors.east!, { x: 0, y: 0 })
  assert.match(resolvePointNodeAnchor(diamond, solution, '45').diagnostic!, /singular/)
})

test('strong negative geometric clearance retains declaration order, signed named directions and finite selected-anchor isolation', () => {
  for (const shape of shapes) {
    const input = { ...fixed(shape), outerXSep: -30, outerYSep: -30, anchor: 'east' }, solution = solvePointNodeShape(input)
    assert.equal(solution.anchorDiagnostic, undefined, shape)
    assert.ok(Object.values(solution.anchors).every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)), shape)
    const names = [...pointNodeAnchorSupport[shape].standard, ...Object.keys(solution.anchors), '0', '13', '45', '90', '181', '270', '315', '-30', '450']
    for (const name of names) {
      const resolved = resolvePointNodeAnchor(input, solution, name)
      assert.ok(Number.isFinite(resolved.position.x) && Number.isFinite(resolved.position.y), `${shape}/${name}`)
      if (shape === 'circular sector' && ['45', 'south west'].includes(name)) {
        assert.equal(resolved.supported, false)
        assert.match(resolved.diagnostic!, /asin domain/)
      } else assert.equal(resolved.supported, true, `${shape}/${name}: ${resolved.diagnostic}`)
    }
    if (['regular polygon', 'square', 'triangle', 'star', 'trapezium', 'semicircle'].includes(shape)) {
      assert.notDeepEqual(solution.anchors.north, resolvePointNodeAnchor(input, solution, '90').position, shape)
    }
  }
  const sector = { ...fixed('circular sector'), outerXSep: -30, outerYSep: -30, anchor: '45' }
  const failed = solvePointNodeShape(sector), finite = solvePointNodeShape({ ...sector, anchor: 'east' })
  assert.match(failed.anchorDiagnostic!, /asin domain/)
  assert.equal(finite.anchorDiagnostic, undefined)
  assert.deepEqual(failed.contours, finite.contours)
})

test('one-axis-zero ellipse numeric anchors use the PGF zero-vector normalization', () => {
  const xZero = { ...fixed('ellipse'), body: { width: 0, height: 8, depth: 3 }, innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 }
  const x = solvePointNodeShape(xZero)
  close(resolvePointNodeAnchor(xZero, x, '90').position, x.anchors.north!)
  close(resolvePointNodeAnchor(xZero, x, '45').position, { x: 0, y: 0 })
  const yZero = { ...xZero, body: { width: 20, height: 0, depth: 0 } }, y = solvePointNodeShape(yZero)
  close(resolvePointNodeAnchor(yZero, y, '0').position, { x: 0, y: 0 })
  assert.ok(y.anchors.east!.x > 14)
})

test('PGF numeric count grammar preserves integer prefixes, dimensional minus rounding and invalid source diagnostics', () => {
  const input = fixed('circle'), solution = solvePointNodeShape(input)
  for (const name of ['16383.99999999999999', '+16383.99999999999999']) {
    assert.equal(pointNodeAnchorIssue('circle', name), undefined)
    close(resolvePointNodeAnchor(input, solution, name).position, resolvePointNodeAnchor(input, solution, '16383').position)
  }
  close(resolvePointNodeAnchor(input, solution, '-13.999999').position, resolvePointNodeAnchor(input, solution, '-14').position)
  close(resolvePointNodeAnchor(input, solution, '-0.99999237060546875').position, resolvePointNodeAnchor(input, solution, '-1').position)
  close(resolvePointNodeAnchor(input, solution, '+13.999999').position, resolvePointNodeAnchor(input, solution, '13').position)
  close(resolvePointNodeAnchor(input, solution, '-.999999').position, resolvePointNodeAnchor(input, solution, '-1').position)
  for (const anchor of ['16384', '+16384', '-16384', '-16383.999999', '.999999', '+.999999']) {
    const result = solvePointNodeShape({ ...input, anchor })
    assert.ok(result.anchorDiagnostic?.includes(anchor), result.anchorDiagnostic)
    assert.equal(pointNodeAnchorIssue('circle', anchor), result.anchorDiagnostic)
    assert.equal(resolvePointNodeAnchor(input, solution, anchor).supported, false)
    assert.deepEqual(result.contours, solution.contours)
  }
  const kite = { ...fixed('kite'), innerXSep: -30, innerYSep: -30, outerXSep: 0, outerYSep: 0, anchor: '-30' }
  const invalid = solvePointNodeShape(kite), finite = solvePointNodeShape({ ...kite, anchor: 'east' })
  assert.match(invalid.anchorDiagnostic!, /dimensional range/)
  assert.equal(finite.anchorDiagnostic, undefined)
  assert.deepEqual(invalid.contours, finite.contours)
})

test('TeX dimensional multiplication truncates scaled-point products and PGF trig interpolation preserves that precision', () => {
  assert.equal(pgfMultiply(.5, 1 / 65536), 0)
  assert.equal(pgfMultiply(1.41421, 11.5).toFixed(5), '16.26347')
  assert.equal(pgfCos(30.000655).toFixed(5), '0.86600')
  assert.equal(pgfTan(30.000655).toFixed(5), '0.57736')
})
