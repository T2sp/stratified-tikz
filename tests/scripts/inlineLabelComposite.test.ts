import assert from 'node:assert/strict'
import test from 'node:test'
import { compareInlineCompositePixel, sourceOverPixel } from '../../scripts/fixtures/inlineLabelComposite.ts'
import type { Rgba } from '../../scripts/fixtures/inlineLabelComposite.ts'

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10,
  `${actual} must equal ${expected} within floating-point precision`)
const white: Rgba = [255, 255, 255, 255]
const clear: Rgba = [0, 0, 0, 0]

test('retained worst pixel validates the failed source-over operand without claiming a white-backdrop observation', () => {
  // Only these three RGBA samples were measured in the retained parent run.
  // A foreground-on-white reference must be obtained by a new browser run.
  const foreground: Rgba = [16, 23, 38, 222]
  const outlined: Rgba = [43, 49, 61, 255]
  const expected = sourceOverPixel(foreground, white)
  near(expected[0], 46.929411764705875)
  near(expected[1], 53.0235294117647)
  near(expected[2], 66.08235294117647)
  assert.equal(expected[3], 255)
  near(Math.max(...expected.map((channel, index) => Math.abs(channel - outlined[index]))), 5.082352941176467)
})

test('source-over retains colored partial layers and transparent identities', () => {
  const expected = sourceOverPixel([255, 0, 0, 128], [0, 255, 0, 128])
  near(expected[0], 65025 / 382)
  near(expected[1], 32385 / 382)
  assert.equal(expected[2], 0)
  near(expected[3], 48896 / 255)
  assert.deepEqual(sourceOverPixel([100, 90, 80, 0], [20, 30, 40, 255]), [20, 30, 40, 255])
  assert.deepEqual(sourceOverPixel([20, 30, 40, 255], white), [20, 30, 40, 255])
  assert.deepEqual(sourceOverPixel(clear, clear), clear)
})

test('an exact opaque-white halo selects the independently supplied direct reference', () => {
  // Synthetic inputs exercise reference selection, not browser raster results.
  const direct: Rgba = [70, 80, 90, 255]
  const comparison = compareInlineCompositePixel([10, 20, 30, 128], white, direct, direct)
  assert.deepEqual(comparison, {
    reference: 'opaque-white-backdrop', expected: direct,
    colorDifference: 0, alphaDifference: 0, premultipliedDifference: 0,
  })
  assert.notDeepEqual(direct, sourceOverPixel([10, 20, 30, 128], white))
})

test('partial alpha and every nonwhite color channel retain source-over rather than the direct reference', () => {
  const foreground: Rgba = [20, 40, 60, 96]
  const halos: Rgba[] = [[254, 255, 255, 255], [255, 254, 255, 255],
    [255, 255, 254, 255], [255, 255, 255, 254], [0, 80, 160, 127], clear]
  for (const halo of halos) {
    const expected = sourceOverPixel(foreground, halo)
    const comparison = compareInlineCompositePixel(foreground, halo, [1, 2, 3, 4], expected)
    assert.equal(comparison.reference, 'source-over')
    assert.deepEqual(comparison.expected, expected)
    assert.equal(comparison.colorDifference, 0)
    assert.equal(comparison.alphaDifference, 0)
    assert.equal(comparison.premultipliedDifference, 0)
  }
})

test('retained partially transparent halo sample keeps its original precise comparison', () => {
  const comparison = compareInlineCompositePixel([12, 24, 36, 21], [255, 255, 255, 204],
    [1, 2, 3, 255], [230, 232, 233, 208])
  assert.equal(comparison.reference, 'source-over')
  near(comparison.expected[0], 230.48991354466858)
  near(comparison.expected[3], 208.2)
  near(comparison.colorDifference, 0.48991354466858184)
  near(comparison.alphaDifference, 0.2)
})

test('wrong foreground color and halo obscuration remain visible in the direct comparison', () => {
  const direct: Rgba = [20, 40, 60, 255]
  const wrongColor = compareInlineCompositePixel([20, 40, 60, 200], white, direct, [20, 47, 60, 255])
  assert.equal(wrongColor.colorDifference, 7)
  assert.equal(wrongColor.premultipliedDifference, 7)
  assert.equal(wrongColor.alphaDifference, 0)
  const obscured = compareInlineCompositePixel([20, 40, 60, 200], white, direct, white)
  assert.equal(obscured.colorDifference, 235)
  assert.equal(obscured.premultipliedDifference, 235)
})

test('wrong output alpha remains independently detectable with unchanged straight color', () => {
  const direct: Rgba = [20, 40, 60, 255]
  const comparison = compareInlineCompositePixel([20, 40, 60, 200], white, direct, [20, 40, 60, 200])
  assert.equal(comparison.colorDifference, 0)
  assert.equal(comparison.alphaDifference, 55)
  near(comparison.premultipliedDifference, 60 * 55 / 255)
})

test('low-alpha and transparent pixels are compared without an alpha cutoff or division by zero', () => {
  const lowAlpha = compareInlineCompositePixel([255, 0, 0, 1], clear, white, [0, 0, 0, 1])
  assert.equal(lowAlpha.reference, 'source-over')
  assert.equal(lowAlpha.colorDifference, 255)
  assert.equal(lowAlpha.alphaDifference, 0)
  assert.equal(lowAlpha.premultipliedDifference, 1)
  const transparent = compareInlineCompositePixel(clear, clear, white, clear)
  assert.deepEqual(transparent.expected, clear)
  assert.equal(transparent.colorDifference, 0)
  assert.equal(transparent.alphaDifference, 0)
  assert.equal(transparent.premultipliedDifference, 0)
})
