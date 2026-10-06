import assert from 'node:assert/strict'
import test from 'node:test'
import { calibrateConnectedPaintSampling, classifyConnectedPaintSampling, compareConnectedPaintSampling } from '../../scripts/connectedPaintSampling.mjs'

const captureAt = (scale) => ({ ctm: { a: scale, b: 0, c: 0, d: scale, e: 64 * scale, f: 64 * scale },
  width: 128 * scale, height: 128 * scale, clip: { x: 0, y: 0, width: 128 * scale, height: 128 * scale } })
const calibrationAt = (scale) => calibrateConnectedPaintSampling(captureAt(scale))

test('sampling calibration uses measured CTM and screenshot pixel cells at the native framing', () => {
  const native = calibrationAt(1), magnified = calibrationAt(16)
  assert.equal(native.halfDiagonalLocal, Math.hypot(.5, .5))
  assert.equal(magnified.halfDiagonalLocal, Math.hypot(.5, .5) / 16)
  assert.deepEqual(native.localPixelSize, { x: 1, y: 1 })
  assert.deepEqual(magnified.localPixelSize, { x: 1 / 16, y: 1 / 16 })
  assert.match(native.scope, /quantization only.*antialias.*not established/u)
  for (const [x, y] of [[-.5, -.5], [-.5, .5], [.5, -.5], [.5, .5]]) assert.ok(Math.hypot(x, y) <= native.halfDiagonalLocal)
  assert.equal(native.halfDiagonalLocal === .14, false, 'The high-resolution fixed uncertainty is not reused at native scale')
})

test('sampling calibration derives screenshot pixel size rather than assuming CSS or device resolution', () => {
  const capture = captureAt(2)
  capture.width *= 2; capture.height *= 2
  capture.clip.x = 20; capture.clip.y = 30
  const calibrated = calibrateConnectedPaintSampling(capture)
  assert.deepEqual(calibrated.screenPixelSize, { x: .5, y: .5 })
  assert.deepEqual(calibrated.localPixelSize, { x: .25, y: .25 })
  assert.equal(calibrated.halfDiagonalLocal, Math.hypot(.125, .125))
  assert.deepEqual(calibrated.clip, capture.clip)
})

for (const [name, damage] of [
  ['unmeasured CTM', (capture) => { capture.ctm.a = NaN }],
  ['sheared screen', (capture) => { capture.ctm.b = 1 }],
  ['nonuniform screen', (capture) => { capture.ctm.d = 2 }],
  ['zero screen scale', (capture) => { capture.ctm.a = 0; capture.ctm.d = 0 }],
  ['missing raster dimensions', (capture) => { delete capture.width }],
  ['empty clip', (capture) => { capture.clip.width = 0 }],
]) test(`sampling calibration rejects ${name}`, () => {
  const capture = captureAt(1); damage(capture)
  assert.throws(() => calibrateConnectedPaintSampling(capture))
})

test('retained full-closed witness is uncertain at native pixel-cell calibration while its strict magnified classification remains hit', () => {
  // Literal retained distance values exercise quantization arithmetic. This
  // helper test is not fresh native paint or an App pointer-action observation.
  const input = { solidDistance: 8.031310797435248, insideContour: false, hit: false }
  const native = classifyConnectedPaintSampling({ ...input, paintDistance: 6.519202405202649, calibration: calibrationAt(1) })
  const magnified = classifyConnectedPaintSampling({ ...input, paintDistance: 5.773220775702242, calibration: calibrationAt(16) })
  assert.equal(native.expected, 'uncertain'); assert.equal(native.definiteDiscrepancy, false)
  assert.ok(native.paintDistanceBounds.lower < 6 && native.paintDistanceBounds.upper > 6)
  assert.equal(magnified.expected, 'hit'); assert.equal(magnified.definiteDiscrepancy, true)
  assert.equal(5.773220775702242 < 6 - .14, true, 'Retained raw .14 strict classification is unchanged')
  assert.ok(Math.abs(native.paintDistance - magnified.paintDistance) <= calibrationAt(1).halfDiagonalLocal + calibrationAt(16).halfDiagonalLocal)
})

test('pixel-cell calibration retains definite native omissions and genuine exterior negatives', () => {
  const calibration = calibrationAt(1)
  const omission = classifyConnectedPaintSampling({ paintDistance: Math.hypot(2.5, 2.5), solidDistance: 8.063832254269679, insideContour: false, hit: false, calibration })
  assert.equal(omission.expected, 'hit'); assert.equal(omission.definiteDiscrepancy, true)
  const exterior = classifyConnectedPaintSampling({ paintDistance: 15, solidDistance: 13, insideContour: false, hit: false, calibration })
  assert.equal(exterior.expected, 'miss'); assert.equal(exterior.definiteDiscrepancy, false)
  const phantom = classifyConnectedPaintSampling({ paintDistance: 15, solidDistance: 13, insideContour: false, hit: true, calibration })
  assert.equal(phantom.expected, 'miss'); assert.equal(phantom.definiteDiscrepancy, true)
})

test('fresh native continuous control uses its own calibration without transferring clone-raster .14', () => {
  const calibration = calibrationAt(1), input = { paintDistance: 20, solidDistance: 6.5, insideContour: false, hit: false, calibration }
  assert.equal(classifyConnectedPaintSampling(input).expected, 'miss', 'Retained magnified continuous control has its separate .14')
  const nativeControl = classifyConnectedPaintSampling({ ...input, continuousUncertainty: calibration.halfDiagonalLocal })
  assert.equal(nativeControl.expected, 'uncertain')
  assert.ok(nativeControl.solidDistanceBounds.lower < 6)
})

test('empty painted masks and contour interiors retain explicit classification', () => {
  const calibration = calibrationAt(1)
  const empty = classifyConnectedPaintSampling({ paintDistance: null, solidDistance: null, insideContour: false, hit: false, calibration })
  assert.deepEqual(empty.combinedDistanceBounds, { lower: null, upper: null })
  assert.equal(empty.expected, 'miss')
  assert.equal(classifyConnectedPaintSampling({ paintDistance: null, solidDistance: null, insideContour: true, hit: true, calibration }).expected, 'hit')
})

test('scale comparison retains raw strict failure and calibrated native result with source and capture identities', () => {
  const local = { x: 0, y: -14 }, raw = { local, expected: 'hit', hit: false }
  const entry = { samples: [[0, -14, 0, 0, 5.773220775702242, 8.031310797435248, false, false, false, 'hit', 8, null, false]],
    interactionOracle: { mismatches: [raw] }, livePaint: { sourceSha256: 'source-hash', captures: [1, 16].map((scale) => ({ ...captureAt(scale), scale,
      file: `scale-${scale}.png`, sha256: `png-${scale}`, pixelDistances: { samples: [{ paintDistance: scale === 1 ? 6.519202405202649 : 5.773220775702242 }] } })) } }
  const snapshot = structuredClone(entry), compared = compareConnectedPaintSampling(entry)
  assert.deepEqual(entry, snapshot, 'Original strict classifications and capture evidence stay immutable')
  assert.equal(compared.sourceSha256, 'source-hash')
  assert.equal(compared.retainedStrictMismatches.length, 1)
  const row = compared.retainedStrictMismatches[0]
  assert.equal(row.rawScale16Expected, 'hit'); assert.equal(row.rawScale16Hit, false)
  assert.equal(row.native.expected, 'uncertain'); assert.equal(row.magnified.expected, 'hit')
  assert.equal(row.withinCenterQuantization, true)
  assert.deepEqual(compared.captures.map(({ counts }) => counts.definiteDiscrepancies), [0, 1])
  entry.livePaint.captures.reverse()
  assert.throws(() => compareConnectedPaintSampling(entry), /same-setting native and magnified/u)
})
