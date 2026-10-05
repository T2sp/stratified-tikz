import assert from 'node:assert/strict'

// A screenshot reports painted pixel centers, not exact vector boundaries. The
// only error established here is the inverse-CTM distance from a center to any
// point in its pixel cell. Antialias filtering and scale-dependent rendering
// remain separate observations; this bound never changes picking tolerance.
export function calibrateConnectedPaintSampling({ ctm, width, height, clip = { x: 0, y: 0, width, height } }) {
  assert.ok(Object.values(ctm).every(Number.isFinite) && ctm.a > 0 && ctm.d === ctm.a && ctm.b === 0 && ctm.c === 0, 'Measured uniform sampling CTM')
  assert.ok(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0, 'Measured PNG dimensions')
  assert.ok(Object.values(clip).every(Number.isFinite) && clip.width > 0 && clip.height > 0, 'Measured screenshot clipping')
  const screenPixelSize = { x: clip.width / width, y: clip.height / height }
  const localPixelSize = { x: screenPixelSize.x / ctm.a, y: screenPixelSize.y / ctm.d }
  return { method: 'inverse-measured-CTM-pixel-cell', scope: 'pixel-center-to-cell quantization only; vector antialias boundary is not established',
    ctm: { ...ctm }, dimensions: { width, height }, clip: { ...clip }, screenPixelSize, localPixelSize,
    halfDiagonalLocal: Math.hypot(localPixelSize.x / 2, localPixelSize.y / 2) }
}

const boundsAround = (distance, uncertainty) => distance === null ? { lower: null, upper: null }
  : { lower: Math.max(0, distance - uncertainty), upper: distance + uncertainty }
const finiteDistance = (value) => value === null ? Infinity : value

export function classifyConnectedPaintSampling({ paintDistance, solidDistance, insideContour, hit, calibration, tolerance = 6, continuousUncertainty = .14 }) {
  for (const value of [paintDistance, solidDistance]) assert.ok(value === null || Number.isFinite(value) && value >= 0, 'Observed paint distance')
  assert.equal(typeof insideContour, 'boolean'); assert.equal(typeof hit, 'boolean')
  assert.ok(Number.isFinite(tolerance) && tolerance >= 0 && Number.isFinite(continuousUncertainty) && continuousUncertainty >= 0, 'Independent distance calibration')
  assert.ok(Number.isFinite(calibration.halfDiagonalLocal) && calibration.halfDiagonalLocal > 0, 'Measured pixel cell')
  const paintDistanceBounds = boundsAround(paintDistance, calibration.halfDiagonalLocal)
  const solidDistanceBounds = boundsAround(solidDistance, continuousUncertainty)
  const combinedDistanceBounds = { lower: Math.min(finiteDistance(paintDistanceBounds.lower), finiteDistance(solidDistanceBounds.lower)),
    upper: Math.min(finiteDistance(paintDistanceBounds.upper), finiteDistance(solidDistanceBounds.upper)) }
  // Empty masks have no finite observed distance. Keep their serialized bounds
  // explicit instead of turning Infinity into a misleading JSON null implicitly.
  for (const key of ['lower', 'upper']) if (!Number.isFinite(combinedDistanceBounds[key])) combinedDistanceBounds[key] = null
  const expected = insideContour || finiteDistance(combinedDistanceBounds.upper) < tolerance ? 'hit'
    : finiteDistance(combinedDistanceBounds.lower) > tolerance ? 'miss' : 'uncertain'
  return { paintDistance, solidDistance, insideContour, paintDistanceBounds, solidDistanceBounds, combinedDistanceBounds,
    expected, hit, definiteDiscrepancy: expected !== 'uncertain' && hit !== (expected === 'hit') }
}

export function compareConnectedPaintSampling(entry, witnessCoordinates = []) {
  const captures = entry.livePaint.captures
  assert.deepEqual(captures.map(({ scale }) => scale), [1, 16], 'Bounded same-setting native and magnified captures')
  const calibrated = captures.map((capture) => {
    const calibration = calibrateConnectedPaintSampling(capture)
    const rows = entry.samples.map((original, index) => ({ local: { x: original[0], y: original[1] },
      ...classifyConnectedPaintSampling({ paintDistance: capture.pixelDistances.samples[index].paintDistance, solidDistance: original[5],
        insideContour: original[6], hit: original[12], calibration }) }))
    return { scale: capture.scale, capture: capture.file, pngSha256: capture.sha256, contourSha256: capture.contourSha256, calibration, rows,
      counts: { hits: rows.filter(({ expected }) => expected === 'hit').length, misses: rows.filter(({ expected }) => expected === 'miss').length,
        uncertain: rows.filter(({ expected }) => expected === 'uncertain').length, definiteDiscrepancies: rows.filter(({ definiteDiscrepancy }) => definiteDiscrepancy).length } }
  })
  const compareAt = (local) => {
    const index = entry.samples.findIndex(([x, y]) => x === local.x && y === local.y)
    assert.ok(index >= 0, 'Scale comparison coordinate belongs to original grid')
    const [native, magnified] = calibrated.map(({ rows }) => rows[index])
    const difference = native.paintDistance === null || magnified.paintDistance === null ? null : native.paintDistance - magnified.paintDistance
    const combinedCenterQuantization = calibrated.reduce((sum, { calibration }) => sum + calibration.halfDiagonalLocal, 0)
    return { local: { ...local }, native, magnified, paintDistanceDifference: difference,
      combinedCenterQuantization, withinCenterQuantization: difference === null ? null : Math.abs(difference) <= combinedCenterQuantization }
  }
  const retainedStrictMismatches = entry.interactionOracle.mismatches.map((raw) => ({ ...compareAt(raw.local), rawScale16Expected: raw.expected, rawScale16Hit: raw.hit }))
  return { method: 'same-source-scale-1-versus-16-pixel-cell-diagnostic', scope: 'retains strict scale-16 .14 classifications; no trusted App pointer actions in supplemental fixture',
    tolerance: 6, continuousUncertainty: .14, sourceSha256: entry.livePaint.sourceSha256, contourSha256: entry.livePaint.contourSha256,
    captures: calibrated.map(({ scale, capture, pngSha256, contourSha256, calibration, counts }) => ({ scale, capture, pngSha256, contourSha256, calibration, counts })),
    retainedStrictMismatches, witnesses: witnessCoordinates.map(compareAt) }
}
