/** Straight RGBA values in byte units; calculated references may be fractional. */
export type Rgba = readonly [number, number, number, number]

/** Source-over of separately rasterized foreground and halo samples. */
export function sourceOverPixel(foreground: Rgba, halo: Rgba): Rgba {
  const frontAlpha = foreground[3] / 255
  const haloAlpha = halo[3] / 255
  const alpha = frontAlpha + haloAlpha * (1 - frontAlpha)
  const channel = (index: 0 | 1 | 2) => alpha === 0 ? 0 :
    (foreground[index] * frontAlpha + halo[index] * haloAlpha * (1 - frontAlpha)) / alpha
  return [channel(0), channel(1), channel(2), alpha * 255]
}

/**
 * Compare identical backdrops where the independent halo is opaque white.
 * The caller must rasterize foregroundOnWhite independently, with the same
 * viewport/transforms and a white rectangle behind the foreground. A direct
 * SVG paint need not equal source-over of a flattened transparent raster.
 * Every other halo sample retains the original source-over calculation.
 * This selector supplies no browser measurements or acceptance threshold.
 */
export function compareInlineCompositePixel(
  foreground: Rgba,
  halo: Rgba,
  foregroundOnWhite: Rgba,
  outlined: Rgba,
): {
  reference: 'opaque-white-backdrop' | 'source-over'
  expected: Rgba
  colorDifference: number
  alphaDifference: number
  premultipliedDifference: number
} {
  const reference = halo.every((channel) => channel === 255) ? 'opaque-white-backdrop' : 'source-over'
  const expected = reference === 'opaque-white-backdrop' ? foregroundOnWhite : sourceOverPixel(foreground, halo)
  const expectedAlpha = expected[3] / 255
  const outlinedAlpha = outlined[3] / 255
  return {
    reference,
    expected,
    colorDifference: Math.max(...[0, 1, 2].map((channel) => Math.abs(expected[channel] - outlined[channel]))),
    alphaDifference: Math.abs(expected[3] - outlined[3]),
    premultipliedDifference: Math.max(...[0, 1, 2].map((channel) =>
      Math.abs(expected[channel] * expectedAlpha - outlined[channel] * outlinedAlpha))),
  }
}
