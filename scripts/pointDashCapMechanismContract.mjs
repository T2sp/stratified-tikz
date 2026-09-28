import assert from 'node:assert/strict'

export const dashCapMechanismStem = 'point-paint-dash-cap-mechanism'
const rawSquare = '5.000000000000001,-5 -5,-5.000000000000001 -5.000000000000002,5 5,5.000000000000002'
const exactSquare = '5,-5 -5,-5 -5,5 5,5'
const square = { points: exactSquare, width: 36, pattern: [0, 10], phase: 0, cap: 'square', join: 'bevel', miterLimit: 10 }
// Literal source constructions, independent of production contour generation.
export const dashCapMechanismCases = [
  { ...square, key: 'raw-zero', points: rawSquare, model: { source: '', shape: 'square', size: 5.892556509887896, widthPt: 30, patternPt: [0, 10 / 1.2], phasePt: 0 }, probes: [{ x: -22, y: -22 }, { x: 20, y: 20 }, { x: -22, y: -30 }] },
  { ...square, key: 'exact-zero' },
  { ...square, key: 'zero-before-corner', phase: .25 },
  { ...square, key: 'zero-after-corner', phase: -.25 },
  { ...square, key: 'zero-reverse-winding', points: '5,-5 5,5 -5,5 -5,-5' },
  { ...square, key: 'zero-terminal-seam', pattern: [0, 15], phase: 5 },
  { ...square, key: 'zero-before-seam', pattern: [0, 15], phase: 5.25 },
  { ...square, key: 'zero-after-seam', pattern: [0, 15], phase: 4.75 },
  { ...square, key: 'zero-diagonal-interior', points: '0,0 8,6 16,0', width: 6, pattern: [0, 100], phase: -5, probes: [{ x: 6.8, y: 5.8 }, { x: 8, y: 3 }] },
  { ...square, key: 'zero-diagonal-corner', points: '0,0 8,6 16,0', width: 6, pattern: [0, 100], phase: -10, probes: [{ x: 10.8, y: 8.8 }, { x: 12, y: 6 }] },
  { ...square, key: 'zero-off-continuous', pattern: [10, 0] },
  { ...square, key: 'mixed-internal-zero', pattern: [5, 5, 0, 15] },
  { ...square, key: 'mixed-zero-off', pattern: [10, 0, 0, 15] },
  { ...square, key: 'positive-exact-corner', pattern: [10, 10] },
  { ...square, key: 'positive-before-corner', pattern: [10, 10], phase: .25 },
  { ...square, key: 'positive-after-corner', pattern: [10, 10], phase: -.25 },
  { ...square, key: 'zero-butt-control', cap: 'butt' },
  { ...square, key: 'zero-round-control', cap: 'round' },
  { ...square, key: 'solid-bevel-control', pattern: null },
]
export const dashCapMechanismColumns = ['x', 'y', 'paintAlpha', 'solidAlpha', 'paintDistance', 'solidDistance', 'insideContour', 'nativeStrokeContains', 'paintCore', 'expected', 'geometryDistance', 'capDistance', 'hit']
export const dashCapMechanismGrid = { min: -32, max: 32, step: 2, size: 33, samples: 1089, uncertainty: .14, tolerance: 6 }
export function dashCapMechanismArtifacts() {
  return [`${dashCapMechanismStem}.json`, ...dashCapMechanismCases.flatMap(({ key }) => ['json', 'input.svg', 'raster.png', 'solid.input.svg', 'solid.raster.png'].map((suffix) => `${dashCapMechanismStem}-${key}.${suffix}`))]
}
const distance = (value) => value === null ? Infinity : value
const finitePoint = ({ x, y }) => Number.isFinite(x) && Number.isFinite(y)

function assertSample(row, spec) {
  assert.equal(row.length, dashCapMechanismColumns.length)
  const [x, y, alpha, solidAlpha, paintDistance, solidDistance, inside, native, core, expected, geometryDistance, capDistance, hit] = row
  assert.ok(Number.isFinite(x) && Number.isFinite(y))
  for (const opacity of [alpha, solidAlpha]) assert.ok(Number.isInteger(opacity) && opacity >= 0 && opacity <= 255)
  for (const value of [paintDistance, solidDistance, geometryDistance, capDistance]) assert.ok(value === null || Number.isFinite(value) && value >= 0)
  for (const value of [inside, native, core, hit]) assert.equal(typeof value, 'boolean')
  const minimum = Math.min(distance(paintDistance), distance(solidDistance))
  assert.equal(expected, inside || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain')
  assert.equal(hit, inside || distance(geometryDistance) <= 6)
  if (expected !== 'uncertain') assert.equal(hit, expected === 'hit', `${spec.key}: candidate ${x},${y}`)
  if (core) { assert.equal(alpha, 255); assert.equal(native, true); assert.ok(distance(geometryDistance) <= .14, `${spec.key}: painted core ${x},${y}`) }
  const zeroOnly = spec.pattern?.every((part, index) => index % 2 === 1 || part === 0)
  if (zeroOnly) {
    if (paintDistance === null || capDistance === null) assert.equal(capDistance, paintDistance, `${spec.key}: empty zero-on paint`)
    else assert.ok(Math.abs(capDistance - paintDistance) <= .14, `${spec.key}: zero-on paint distance ${x},${y}`)
  }
}

export function assertDashCapMechanismEntry(entry, spec) {
  assert.equal(entry.result, 'passed'); assert.deepEqual(entry.specification, spec)
  assert.equal(entry.key, spec.key); assert.equal(entry.source.kind, 'literal-independent-SVG')
  assert.equal(entry.source.rawPoints, spec.points)
  assert.deepEqual(entry.source.vertices, spec.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y } }))
  assert.deepEqual(entry.source.model, spec.model ?? null)
  assert.equal(entry.native.vertices.length, entry.source.vertices.length)
  assert.ok(entry.native.vertices.every(finitePoint)); assert.ok(Number.isFinite(entry.native.pathLength) && entry.native.pathLength > 0)
  for (const [index, point] of entry.native.vertices.entries()) for (const key of ['x', 'y']) {
    const source = entry.source.vertices[index][key]
    assert.ok(Math.abs(point[key] - source) <= Math.max(1, Math.abs(source)) * 2 ** -23, 'Retain the actual native parse of this source')
  }
  assert.equal(typeof entry.native.browser.version, 'string'); assert.ok(entry.native.browser.version.length > 0)
  assert.notEqual(entry.native.browser.version, 'unavailable')
  assert.equal(typeof entry.native.browser.userAgent, 'string'); assert.ok(entry.native.browser.userAgent.length > 0)
  assert.deepEqual(entry.native.stroke, { width: spec.width, pattern: spec.pattern, phase: spec.phase, cap: spec.cap, join: spec.join, miterLimit: spec.miterLimit, fill: 'none' })
  assert.deepEqual(entry.native.ctm, { a: 1, b: 0, c: 0, d: 1, e: 64, f: 64 })
  assert.deepEqual(entry.raster, { resolution: 16, half: 64, side: 2048, uncertainty: .14, alphaThreshold: 128 })
  assert.deepEqual(entry.grid, dashCapMechanismGrid); assert.deepEqual(entry.columns, dashCapMechanismColumns)
  assert.equal(entry.samples.length, 1089)
  for (const [index, row] of entry.samples.entries()) {
    assert.equal(row[0], -32 + index % 33 * 2); assert.equal(row[1], -32 + Math.floor(index / 33) * 2)
    assertSample(row, spec)
  }
  assert.deepEqual(entry.counts, { hits: entry.samples.filter((r) => r[9] === 'hit').length, misses: entry.samples.filter((r) => r[9] === 'miss').length, uncertain: entry.samples.filter((r) => r[9] === 'uncertain').length })
  assert.ok(entry.counts.hits > 0 && entry.counts.misses > 0)
  assert.deepEqual(entry.mismatches, [])
  assert.ok(Number.isFinite(entry.geometry.radius) && entry.geometry.radius >= 0)
  assert.ok(Number.isFinite(entry.paint.radius) && entry.paint.radius >= 0)
  assert.ok(entry.geometry.radius + .14 >= entry.paint.radius)
  assert.ok(Number.isFinite(entry.geometry.capRadius) && entry.geometry.capRadius >= 0)
  if (spec.pattern?.every((part, index) => index % 2 === 1 || part === 0)) {
    assert.ok(Math.abs(entry.geometry.capRadius - entry.paint.radius) <= .14, `${spec.key}: zero-on cap radius matches paint`)
  }
  if (entry.samples.some((row) => row[8])) assert.ok(entry.paint.bounds && entry.paint.radius > 0)
  for (const row of entry.samples.filter((sample) => sample[8])) assert.ok(Math.hypot(row[0], row[1]) <= entry.paint.radius + .14)
  if (entry.paint.bounds) for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
    assert.ok(Number.isFinite(entry.geometry.bounds[key]) && Number.isFinite(entry.paint.bounds[key]))
    assert.ok(key.startsWith('min') ? entry.geometry.bounds[key] <= entry.paint.bounds[key] + .14 : entry.geometry.bounds[key] >= entry.paint.bounds[key] - .14)
  }
  assert.equal(entry.probes.length, spec.probes?.length ?? 0)
  for (const [index, row] of entry.probes.entries()) { assert.equal(row[0], spec.probes[index].x); assert.equal(row[1], spec.probes[index].y); assertSample(row, spec) }
  if (spec.key === 'raw-zero') {
    for (const row of entry.probes.slice(0, 2)) { assert.equal(row[2], 255); assert.equal(row[7], true); assert.equal(row[8], true); assert.equal(row[12], true) }
    const exterior = entry.probes[2]
    assert.equal(exterior[2], 0); assert.equal(exterior[7], false); assert.equal(exterior[6], false); assert.equal(exterior[12], false)
    assert.ok(exterior[4] > 6.2 && exterior[4] < 8 && exterior[5] > 6.14)
  }
}

export function assertDashCapMechanismEvidence(evidence) {
  assert.equal(evidence.result, 'passed'); assert.equal(evidence.scope, 'supplemental native SVG geometry; App pointer matrix remains separately required')
  assert.equal(evidence.cases.length, dashCapMechanismCases.length)
  for (const spec of dashCapMechanismCases) {
    const entries = evidence.cases.filter(({ key }) => key === spec.key)
    assert.equal(entries.length, 1); assertDashCapMechanismEntry(entries[0], spec)
  }
}
