import assert from 'node:assert/strict'

/** Independent bounded endpoint rectangles for the saved literal triangle.
 * These are a subset of its paint, so a short distance proves proximity; a
 * long distance cannot prove a miss. No production dash/contour helper is used. */
export function observeClosedDashTriangleEndpointCaps({ source, local, insideContour, nativeStrokeContains, background }) {
  assert.match(source, /^<polygon\s/u)
  const attribute = (name) => {
    const match = source.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u'))
    assert.ok(match, `Saved literal triangle ${name}`)
    return match[1]
  }
  assert.equal(attribute('data-point-contour'), 'true')
  assert.equal(attribute('fill'), 'none')
  assert.equal(attribute('stroke'), '#000000')
  assert.equal(attribute('stroke-opacity'), '1')
  const width = Number(attribute('stroke-width')), phase = Number(attribute('stroke-dashoffset'))
  const pattern = attribute('stroke-dasharray').split(/\s+/u).map(Number)
  assert.equal(width, 12); assert.equal(phase, 1)
  assert.deepEqual(pattern, [100.00000000000001, 100.00000000000001])
  assert.equal(attribute('stroke-linecap'), 'square'); assert.equal(attribute('stroke-linejoin'), 'bevel')
  const vertices = attribute('points').trim().split(/\s+/u).map((pair) => {
    const coordinates = pair.split(',').map(Number)
    assert.equal(coordinates.length, 2); assert.ok(coordinates.every(Number.isFinite))
    return { x: coordinates[0], y: coordinates[1] }
  })
  assert.equal(vertices.length, 3)
  for (const [index, expected] of [{ x: 0, y: -10 }, { x: -5 * Math.sqrt(3), y: 5 }, { x: 5 * Math.sqrt(3), y: 5 }].entries()) {
    assert.ok(Math.abs(vertices[index].x - expected.x) < 1e-12 && Math.abs(vertices[index].y - expected.y) < 1e-12, 'Retained literal triangle contour')
  }
  const perimeter = vertices.reduce((length, point, index) => {
    const next = vertices[(index + 1) % vertices.length]
    return length + Math.hypot(next.x - point.x, next.y - point.y)
  }, 0)
  assert.ok(perimeter < pattern[0] - phase, 'One literal positive interval covers the complete triangle')
  const origin = vertices[0], halfWidth = width / 2
  const rectangle = (from, to, outward) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const tangent = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
    const relative = { x: local.x - origin.x, y: local.y - origin.y }
    const along = outward * (relative.x * tangent.x + relative.y * tangent.y)
    const normal = -relative.x * tangent.y + relative.y * tangent.x
    const distance = Math.hypot(Math.max(0, -along, along - halfWidth), Math.max(0, Math.abs(normal) - halfWidth))
    return { origin, tangent, outward, halfWidth, along, normal, distance }
  }
  const rectangles = [rectangle(vertices[0], vertices[1], -1), rectangle(vertices[2], vertices[0], 1)]
  const distance = Math.min(...rectangles.map((entry) => entry.distance))
  assert.equal(typeof insideContour, 'boolean'); assert.equal(typeof nativeStrokeContains, 'boolean')
  assert.equal(background, 'rgb(255, 255, 255)', 'Authenticated white connected capture background')
  return { method: 'independent literal square endpoint rectangles; bounded triangle paint subset', vertices, perimeter,
    width, pattern, phase, cap: 'square', join: 'bevel', rectangles, distance, insideContour, nativeStrokeContains,
    background, threshold: 5.86, definiteHit: !insideContour && !nativeStrokeContains && distance < 5.86 }
}

/** The unchanged magnified paint oracle governs geometric candidates. Native
 * pixel-cell classifications only diagnose sampling: their calibration does
 * not establish a vector antialias boundary. Ordinary SVG events select their
 * actual DOM target; Alt traverses the independently observed candidates. */
export function assertClosedDashTransferAction(action, strictSample) {
  assert.deepEqual(action.local, strictSample.local, 'Native action retains its authenticated strict sample')
  assert.equal(action.candidateExpected, strictSample.expected, 'Native candidate expectation retains the strict scale-16 oracle')
  assert.ok(['hit', 'miss', 'uncertain'].includes(action.rawCellExpected), 'Retain the raw quantization-only diagnosis')
  assert.ok(['hit', 'miss', 'uncertain'].includes(strictSample.expected), 'Strict candidate classification')
  assert.equal(action.trusted, true)
  assert.equal(action.overlayExcluded, true)
  assert.equal(typeof action.alt, 'boolean')
  assert.ok(['triangle', 'square', 'star', 'circle'].includes(action.shape), 'Supported finite action shape')
  assert.equal(action.ordinaryTarget.insideRoot, true, 'Pre-action DOM target belongs to the owned SVG')
  assert.ok(action.ordinaryTarget.pointId === null || action.ordinaryTarget.pointId === 'p', 'Point-only fixture DOM target')
  assert.ok(action.candidates.every((id) => id === 'p'), 'Point-only fixture candidate inventory')
  if (strictSample.expected !== 'uncertain') {
    assert.deepEqual(action.candidates, strictSample.expected === 'hit' ? ['p'] : [], 'Strict native candidate requirement')
  }
  if (action.shape === 'triangle') {
    const literal = action.independentEndpointCaps
    assert.ok(literal, 'Triangle action retains its independent literal endpoint-cap observation')
    assert.equal(literal.sourceAuthenticated, true, 'Literal endpoint rectangles retain authenticated source and capture')
    assert.equal(literal.background, 'rgb(255, 255, 255)')
    assert.equal(literal.threshold, 5.86); assert.ok(Number.isFinite(literal.distance))
    assert.equal(literal.definiteHit, !literal.insideContour && !literal.nativeStrokeContains && literal.distance < literal.threshold)
    if (literal.definiteHit) {
      assert.deepEqual(action.candidates, ['p'], 'Independent literal endpoint-cap proximity requirement')
      assert.equal(action.ordinaryTarget.pointId, null, 'Endpoint-cap proximity retains the native background target')
    }
  }
  if (action.role === 'painted-positive') {
    assert.equal(strictSample.expected, 'hit')
    assert.equal(action.rawCellExpected, 'hit')
    assert.equal(action.ordinaryTarget.pointId, 'p', 'Opaque positive control is a native DOM target')
  } else if (action.role === 'exterior') {
    assert.equal(strictSample.expected, 'miss')
    assert.equal(action.rawCellExpected, 'miss')
    assert.equal(action.ordinaryTarget.pointId, null, 'Genuine exterior has no native point target')
  }
  if (!action.alt) assert.equal(action.beforeSelection, null, 'Ordinary action starts from cleared selection')
  const selected = action.alt ? action.candidates.includes('p') : action.ordinaryTarget.pointId === 'p'
  assert.deepEqual(action.selection, selected ? { kind: 'stratum', id: 'p' } : null,
    action.alt ? 'Alt action uses geometric candidate cycling' : 'Ordinary action uses the native DOM target')
}
