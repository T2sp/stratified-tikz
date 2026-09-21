import assert from 'node:assert/strict'

// Harness-only bound for numeric SVG attributes versus native CSSOM opacity.
// The visibility fixture captures 0.7 * 0.35 = 0.24499999999999997, while
// Chrome serializes its computed opacity as "0.245" (error ~2.8e-17).
// On [0, 1], 1e-12 admits that representation error but rejects even 1e-10
// drift, as well as missing/doubled dimming. Raw attribute checks stay exact.
export const standaloneSvgOpacityTolerance = 1e-12

/** @param {unknown} computed @param {unknown} captured */
export function assertStandaloneSvgOpacity(computed, captured) {
  for (const [name, value] of [['computed', computed], ['captured', captured]]) {
    assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1,
      `${name} opacity must be a finite number in [0, 1]; received ${String(value)}`)
  }
  const absoluteError = Math.abs(computed - captured)
  assert.ok(absoluteError <= standaloneSvgOpacityTolerance,
    `Standalone computed opacity ${computed} differs from captured opacity ${captured}: `
      + `absolute error ${absoluteError} exceeds tolerance ${standaloneSvgOpacityTolerance}`)
}
