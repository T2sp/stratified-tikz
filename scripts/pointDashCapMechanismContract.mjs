import assert from 'node:assert/strict'
import { compareConnectedPaintSampling } from './connectedPaintSampling.mjs'

export const dashCapMechanismStem = 'point-paint-dash-cap-mechanism'
const rawSquare = '5.000000000000001,-5 -5,-5.000000000000001 -5.000000000000002,5 5,5.000000000000002'
const exactSquare = '5,-5 -5,-5 -5,5 5,5'
const square = { points: exactSquare, width: 36, pattern: [0, 10], phase: 0, cap: 'square', join: 'bevel', miterLimit: 10 }
// Literal source constructions, independent of production contour generation.
// Retained connected scale-16 paint corrects the two (16,-22) witnesses:
// zero-off is background but 3.0314 units from paint, so remains a required hit;
// before-corner is 7.1153 from paint and 7.0712 from continuous stroke, a miss.
// The exact-positive corner retains its separately corroborated painted hit.
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
  { ...square, key: 'zero-off-continuous', pattern: [10, 0], probes: [{ x: -22, y: -22, expected: 'paint' }, { x: 16, y: -22, expected: 'near-paint' }, { x: -22, y: -30, expected: 'miss' }] },
  { ...square, key: 'mixed-internal-zero', pattern: [5, 5, 0, 15] },
  { ...square, key: 'mixed-zero-off', pattern: [10, 0, 0, 15] },
  { ...square, key: 'positive-exact-corner', pattern: [10, 10], probes: [{ x: 20, y: 20, expected: 'paint' }, { x: 16, y: -22, expected: 'paint' }, { x: 22, y: -22, expected: 'paint' }, { x: -22, y: -30, expected: 'miss' }] },
  { ...square, key: 'positive-before-corner', pattern: [10, 10], phase: .25, probes: [{ x: -22, y: -22, expected: 'paint' }, { x: 16, y: -22, expected: 'miss' }, { x: -22, y: -30, expected: 'miss' }] },
  { ...square, key: 'positive-after-corner', pattern: [10, 10], phase: -.25 },
  { ...square, key: 'zero-butt-control', cap: 'butt' },
  { ...square, key: 'zero-round-control', cap: 'round' },
  { ...square, key: 'solid-bevel-control', pattern: null },
  { ...square, key: 'positive-triangle-seam', points: '0,0 24,0 12,16', width: 12, pattern: [32, 32], phase: .25 },
  { ...square, key: 'positive-full-closed-control', points: '0,0 24,0 12,16', width: 12, pattern: [100, 100], phase: 1 },
]
export const dashCapMechanismColumns = ['x', 'y', 'paintAlpha', 'solidAlpha', 'paintDistance', 'solidDistance', 'insideContour', 'nativeStrokeContains', 'paintCore', 'expected', 'geometryDistance', 'capDistance', 'hit']
export const dashCapMechanismGrid = { min: -32, max: 32, step: 2, size: 33, samples: 1089, uncertainty: .14, tolerance: 6 }
// Existing grid cells retain the disputed threshold witness and a definite
// native-scale omission even after a justified fix changes current candidates.
export const dashCapMechanismScaleWitnesses = (spec) => spec.key === 'positive-full-closed-control' ? [{ x: 0, y: -14 }, { x: -8, y: -8 }] : []
export function dashCapMechanismArtifacts() {
  return [`${dashCapMechanismStem}.json`, ...dashCapMechanismCases.flatMap(({ key }) => ['json', 'input.svg', 'raster.png', 'solid.input.svg', 'solid.raster.png', 'live.svg', 'live-scale-1.png', 'live-scale-16.png'].map((suffix) => `${dashCapMechanismStem}-${key}.${suffix}`))]
}
const distance = (value) => value === null ? Infinity : value
const finitePoint = ({ x, y }) => Number.isFinite(x) && Number.isFinite(y)

// Historical clone/core-versus-containment disagreements remain diagnostics.
// They are not proof of connected paint and never define expected interaction.
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
  assert.ok(hash(live.contourSha256))
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
    assert.equal(capture.contourSha256, live.contourSha256)
    assert.deepEqual(capture.stroke, entry.native.stroke); assert.deepEqual(capture.vertices, entry.native.vertices)
    assert.equal(capture.pathLength, entry.native.pathLength)
    const pixels = capture.pixelDistances
    assert.equal(pixels.method, 'connected screenshot black-pixel boundary distance')
    assert.equal(pixels.width, side); assert.equal(pixels.height, side)
    assert.deepEqual(pixels.region, { minX: -64, minY: -64, maxX: 64, maxY: 64 })
    assert.equal(pixels.calibration.threshold, 127); assert.equal(pixels.calibration.pixelCenters, true)
    assert.deepEqual(pixels.calibration.backgroundControl.rgba, [255, 255, 255, 255])
    if (spec.key === 'zero-butt-control') { assert.equal(pixels.boundaryPixelCount, 0); assert.equal(pixels.calibration.positiveControl, null) }
    else { assert.ok(pixels.boundaryPixelCount > 0); assert.deepEqual(pixels.calibration.positiveControl.rgba, [0, 0, 0, 255]) }
    assert.equal(pixels.samples.length, entry.samples.length + entry.probes.length)
    assert.equal(capture.samples.length, entry.samples.length); assert.equal(capture.probes.length, entry.probes.length)
    for (const field of ['samples', 'probes']) {
      const expectedChanges = capture[field].filter((row, index) => row[7] !== entry[field][index][7]).map((row) => ({ x: row[0], y: row[1], before: !row[7], after: row[7] }))
      assert.deepEqual(capture.containmentResolutionChanges[field], expectedChanges)
      if (scale === 1) assert.deepEqual(expectedChanges, [], 'Opacity visibility does not silently replace the original containment observation')
      for (const change of expectedChanges) {
        assert.equal(change.before, false); assert.equal(change.after, true)
        assert.equal(retainedDashContainmentDisagreement(spec, change.x, change.y), true, 'Unexpected containment change remains a separate strict diagnostic')
      }
    }
    for (const [originals, observed] of [[entry.samples, capture.samples], [entry.probes, capture.probes]]) for (const [i, row] of observed.entries()) {
      const original = originals[i]
      assert.equal(row.length, dashLivePaintColumns.length); assert.deepEqual(row.slice(0, 2), original.slice(0, 2))
      for (const value of row.slice(2, 6)) assert.ok(Number.isInteger(value) && value >= 0 && value <= 255)
      assert.equal(row[5], 255); assert.equal(typeof row[6], 'boolean'); assert.equal(typeof row[7], 'boolean')
      // Scale-16 distances are decoded from this same PNG. Clone alpha and
      // containment are deliberately separate observations, including conflicts.
      const offset = originals === entry.samples ? 0 : entry.samples.length
      const pixel = capture.pixelDistances.samples[offset + i]
      assert.deepEqual(pixel.local, { x: row[0], y: row[1] })
      assert.deepEqual(pixel.rgba, row.slice(2, 6))
      assert.equal(pixel.paintCore, row[6])
      assert.ok(pixel.paintDistance === null || Number.isFinite(pixel.paintDistance) && pixel.paintDistance >= 0)
      if (row[6]) assert.equal(pixel.paintDistance, 0)

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
  if (alpha >= 128) assert.equal(paintDistance, 0)
  if (solidAlpha >= 128) assert.equal(solidDistance, 0)
  if (core) assert.equal(alpha, 255)
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
  assert.deepEqual(entry.mismatches, entry.samples.filter((r) => r[9] !== 'uncertain' && r[12] !== (r[9] === 'hit')).map((r) => ({ local: { x: r[0], y: r[1] }, expected: r[9], hit: r[12] })))
  assert.ok(Number.isFinite(entry.geometry.radius) && entry.geometry.radius >= 0)
  assert.ok(Number.isFinite(entry.paint.radius) && entry.paint.radius >= 0)
  assert.ok(Number.isFinite(entry.geometry.capRadius) && entry.geometry.capRadius >= 0)
  if (entry.samples.some((row) => row[8])) assert.ok(entry.paint.bounds && entry.paint.radius > 0)
  for (const row of entry.samples.filter((sample) => sample[8])) assert.ok(Math.hypot(row[0], row[1]) <= entry.paint.radius + .14)
  if (entry.paint.bounds) for (const value of Object.values(entry.paint.bounds)) assert.ok(Number.isFinite(value))
  assert.equal(entry.probes.length, spec.probes?.length ?? 0)
  for (const [index, row] of entry.probes.entries()) { assert.equal(row[0], spec.probes[index].x); assert.equal(row[1], spec.probes[index].y); assertSample(row, spec) }
  assertLivePaint(entry, spec)
  const oracle = entry.interactionOracle, capture = entry.livePaint.captures[1]
  assert.equal(oracle.method, 'connected-live-paint-plus-continuous-stroke-and-contour-interior')
  assert.equal(oracle.capture, capture.file); assert.equal(oracle.pngSha256, capture.sha256)
  assert.equal(oracle.sourceSha256, entry.livePaint.sourceSha256)
  assert.equal(oracle.tolerance, 6); assert.equal(oracle.uncertainty, .14)
  for (const field of ['samples', 'probes']) {
    assert.equal(oracle[field].length, entry[field].length)
    for (const [index, row] of oracle[field].entries()) {
      const original = entry[field][index], pixel = capture.pixelDistances.samples[(field === 'samples' ? 0 : entry.samples.length) + index]
      const minimum = Math.min(distance(pixel.paintDistance), distance(original[5]))
      assert.deepEqual(row, { local: { x: original[0], y: original[1] }, paintDistance: pixel.paintDistance, solidDistance: original[5], insideContour: original[6],
        expected: original[6] || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain', geometryDistance: original[10], hit: original[12] })
      if (row.expected !== 'uncertain') assert.equal(row.hit, row.expected === 'hit', `${spec.key}: connected-live candidate ${original[0]},${original[1]}`)
      if (pixel.paintCore) assert.ok(distance(row.geometryDistance) <= .14, `${spec.key}: connected-live painted core`)
    }
  }
  assert.deepEqual(oracle.mismatches, [])
  assert.deepEqual(entry.sameSettingScaleComparison, compareConnectedPaintSampling(entry, dashCapMechanismScaleWitnesses(spec)), 'Retain action-framing calibration separately from the unchanged strict scale-16 oracle')
  const live = capture.pixelDistances
  assert.ok(Number.isFinite(live.paintRadius) && live.paintRadius >= 0)
  assert.ok(entry.geometry.radius + .14 >= live.paintRadius)
  if (spec.pattern?.every((part, index) => index % 2 === 1 || part === 0)) assert.ok(Math.abs(entry.geometry.capRadius - live.paintRadius) <= .14, `${spec.key}: zero-on cap radius matches connected paint`)
  if (live.paintBounds) for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
    assert.ok(Number.isFinite(entry.geometry.bounds[key]) && Number.isFinite(live.paintBounds[key]))
    assert.ok(key.startsWith('min') ? entry.geometry.bounds[key] <= live.paintBounds[key] + .14 : entry.geometry.bounds[key] >= live.paintBounds[key] - .14)
  }
  for (const [index, probe] of (spec.probes ?? []).entries()) {
    const row = oracle.probes[index], pixel = capture.pixelDistances.samples[entry.samples.length + index]
    if (probe.expected === 'paint') { assert.deepEqual(pixel.rgba, [0, 0, 0, 255]); assert.equal(pixel.paintCore, true); assert.equal(row.hit, true) }
    if (probe.expected === 'near-paint') { assert.deepEqual(pixel.rgba, [255, 255, 255, 255]); assert.ok(row.paintDistance > 0 && row.paintDistance < 5.86); assert.equal(row.hit, true) }
    if (probe.expected === 'miss') { assert.deepEqual(pixel.rgba, [255, 255, 255, 255]); assert.equal(row.insideContour, false); assert.equal(row.hit, false); assert.ok(row.paintDistance > 6.14 && row.solidDistance > 6.14) }
  }
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
