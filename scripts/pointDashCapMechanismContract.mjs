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
  { ...square, key: 'zero-terminal-seam', pattern: [0, 15], phase: 5, probes: [{ x: -22, y: -22, expected: 'paint' }, { x: 21, y: -21, expected: 'miss' }, { x: 22, y: -22, expected: 'miss' }, { x: 22, y: -18, expected: 'miss' }] },
  { ...square, key: 'zero-before-seam', pattern: [0, 15], phase: 5.25 },
  { ...square, key: 'zero-after-seam', pattern: [0, 15], phase: 4.75 },
  { ...square, key: 'zero-diagonal-interior', points: '0,0 8,6 16,0', width: 6, pattern: [0, 100], phase: -5, probes: [{ x: 6.8, y: 5.8 }, { x: 8, y: 3 }] },
  { ...square, key: 'zero-diagonal-corner', points: '0,0 8,6 16,0', width: 6, pattern: [0, 100], phase: -10, probes: [{ x: 10.8, y: 8.8 }, { x: 12, y: 6 }] },
  { ...square, key: 'zero-off-continuous', pattern: [10, 0], probes: [{ x: -22, y: -22, expected: 'paint' }, { x: 16, y: -22, expected: 'paint' }, { x: -22, y: -30, expected: 'miss' }] },
  { ...square, key: 'mixed-internal-zero', pattern: [5, 5, 0, 15] },
  { ...square, key: 'mixed-zero-off', pattern: [10, 0, 0, 15] },
  { ...square, key: 'positive-exact-corner', pattern: [10, 10], probes: [{ x: 20, y: 20, expected: 'paint' }, { x: 16, y: -22, expected: 'paint' }, { x: 22, y: -22, expected: 'paint' }, { x: -22, y: -30, expected: 'miss' }] },
  { ...square, key: 'positive-before-corner', pattern: [10, 10], phase: .25, probes: [{ x: -22, y: -22, expected: 'paint' }, { x: 16, y: -22, expected: 'paint' }, { x: -22, y: -30, expected: 'miss' }] },
  { ...square, key: 'positive-after-corner', pattern: [10, 10], phase: -.25 },
  { ...square, key: 'zero-butt-control', cap: 'butt' },
  { ...square, key: 'zero-round-control', cap: 'round' },
  { ...square, key: 'solid-bevel-control', pattern: null },
  { ...square, key: 'positive-triangle-seam', points: '0,0 24,0 12,16', width: 12, pattern: [32, 32], phase: .25 },
  { ...square, key: 'positive-full-closed-control', points: '0,0 24,0 12,16', width: 12, pattern: [100, 100], phase: 1 },
]
export const dashCapMechanismColumns = ['x', 'y', 'paintAlpha', 'solidAlpha', 'paintDistance', 'solidDistance', 'insideContour', 'nativeStrokeContains', 'paintCore', 'expected', 'geometryDistance', 'capDistance', 'hit']
export const dashCapMechanismGrid = { min: -32, max: 32, step: 2, size: 33, samples: 1089, uncertainty: .14, tolerance: 6 }
export function dashCapMechanismArtifacts() {
  return [`${dashCapMechanismStem}.json`, ...dashCapMechanismCases.flatMap(({ key }) => ['json', 'input.svg', 'raster.png', 'solid.input.svg', 'solid.raster.png', 'live.svg', 'live-scale-1.png', 'live-scale-16.png'].map((suffix) => `${dashCapMechanismStem}-${key}.${suffix}`))]
}
const distance = (value) => value === null ? Infinity : value
const finitePoint = ({ x, y }) => Number.isFinite(x) && Number.isFinite(y)

// These local cells preserve the two contradictions actually recorded by Chrome
// 154 in epviae. A later native run may resolve them, but may not silently add
// another exception. Any retained exception additionally needs actual live paint
// from both screen resolutions (assertLivePaint), never geometry as its oracle.
export function retainedDashContainmentDisagreement(spec, x, y) {
  if (spec.key === 'zero-off-continuous') return y >= -22 && y <= -14 && x >= 14 && x <= 22 && x % 2 === 0 && y % 2 === 0 && x - y >= 30
  if (spec.key === 'positive-before-corner') return y >= -22 && y <= -14 && x >= 8 && x <= 22 && x % 2 === 0 && y % 2 === 0 && x - y >= 30
  return false
}
export const dashLivePaintColumns = ['x', 'y', 'red', 'green', 'blue', 'alpha', 'blackCore', 'nativeStrokeContains']
const hash = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value)
function assertLivePaint(entry, spec) {
  const live = entry.livePaint, stem = `${dashCapMechanismStem}-${spec.key}`
  assert.equal(live.method, 'actual live SVG screenshot PNG; no SVG reconstruction')
  assert.equal(live.sourceFile, `${stem}.live.svg`); assert.ok(hash(live.sourceSha256))
  assert.equal(live.sourcePoints, spec.points); assert.deepEqual(live.columns, dashLivePaintColumns)
  assert.equal(live.captures.length, 2)
  const disagreements = entry.samples.filter((row) => row[8] && !row[7]).map((row) => ({ x: row[0], y: row[1] }))
  assert.deepEqual(live.rasterCoreContainmentDisagreements, disagreements)
  for (const [index, capture] of live.captures.entries()) {
    const scale = [1, 16][index], side = scale * 128
    assert.equal(capture.scale, scale); assert.equal(capture.side, side); assert.equal(capture.width, side); assert.equal(capture.height, side)
    assert.equal(capture.file, `${stem}.live-scale-${scale}.png`); assert.ok(hash(capture.sha256)); assert.ok(capture.bytes > 24)
    assert.deepEqual(capture.clip, { x: 0, y: 0, width: side, height: side })
    assert.deepEqual(capture.ctm, { a: scale, b: 0, c: 0, d: scale, e: 64 * scale, f: 64 * scale })
    assert.deepEqual(capture.afterCtm, capture.ctm)
    assert.equal(capture.sourceUnchanged, true); assert.equal(capture.viewport.width >= side && capture.viewport.height >= side, true)
    assert.deepEqual(capture.stroke, entry.native.stroke); assert.deepEqual(capture.vertices, entry.native.vertices)
    assert.equal(capture.pathLength, entry.native.pathLength)
    assert.equal(capture.samples.length, entry.samples.length); assert.equal(capture.probes.length, entry.probes.length)
    for (const field of ['samples', 'probes']) {
      const expectedChanges = capture[field].filter((row, index) => row[7] !== entry[field][index][7]).map((row) => ({ x: row[0], y: row[1], before: !row[7], after: row[7] }))
      assert.deepEqual(capture.containmentResolutionChanges[field], expectedChanges)
      if (scale === 1) assert.deepEqual(expectedChanges, [], 'Opacity visibility does not silently replace the original containment observation')
      for (const change of expectedChanges) {
        assert.equal(change.before, false); assert.equal(change.after, true)
        assert.equal(retainedDashContainmentDisagreement(spec, change.x, change.y), true, 'A scale-dependent correction is confined to the retained containment contradiction')
        assert.equal(entry[field].find((row) => row[0] === change.x && row[1] === change.y)[8], true)
      }
    }
    for (const [originals, observed] of [[entry.samples, capture.samples], [entry.probes, capture.probes]]) for (const [i, row] of observed.entries()) {
      const original = originals[i]
      assert.equal(row.length, dashLivePaintColumns.length); assert.deepEqual(row.slice(0, 2), original.slice(0, 2))
      for (const value of row.slice(2, 6)) assert.ok(Number.isInteger(value) && value >= 0 && value <= 255)
      assert.equal(row[5], 255); assert.equal(typeof row[6], 'boolean'); assert.equal(typeof row[7], 'boolean')
      if (scale === 16 && original[8] || original[8] && !original[7]) {
        assert.deepEqual(row.slice(2, 6), [0, 0, 0, 255], `${spec.key}: live opaque paint at ${row[0]},${row[1]} scale ${scale}`)
        if (scale === 16) assert.equal(row[6], true, 'The independently rendered 3x3 opaque core is preserved')
      }
      // Pure exterior controls at both resolutions reject a blank/dark/stale
      // screenshot as well as masks that merely echo the opaque raster samples.
      if (original[9] === 'miss') assert.deepEqual(row.slice(2, 6), [255, 255, 255, 255], `${spec.key}: live exterior ${row[0]},${row[1]} scale ${scale}`)
    }
  }
}
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
  if (core) { assert.equal(alpha, 255); if (!retainedDashContainmentDisagreement(spec, x, y)) assert.equal(native, true); assert.ok(distance(geometryDistance) <= .14, `${spec.key}: painted core ${x},${y}`) }
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
  for (const [index, probe] of (spec.probes ?? []).entries()) {
    if (probe.expected === 'paint') { const row = entry.probes[index]; assert.equal(row[2], 255); assert.equal(row[8], true); assert.equal(row[12], true) }
    if (probe.expected === 'miss') { const row = entry.probes[index]; assert.equal(row[2], 0); assert.equal(row[7], false); assert.equal(row[6], false); assert.equal(row[12], false); assert.ok(row[4] > 6.14 && row[5] > 6.14) }
  }
  assertLivePaint(entry, spec)
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
