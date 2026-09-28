import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'

const defaultRegion = { minX: -34, minY: -34, maxX: 34, maxY: 34 }
const screenRegionFor = (ctm, region) => ({ minX: region.minX * ctm.a + ctm.e, minY: region.minY * ctm.d + ctm.f,
  maxX: region.maxX * ctm.a + ctm.e, maxY: region.maxY * ctm.d + ctm.f })

// Save this record with the original PNG before inspecting its pixels. Reading
// the IHDR does not depend on whether the paint mask/calibration is acceptable.
export function connectedPaintCaptureMetadata(png, { source, ctm, region = defaultRegion, captureState }) {
  assert.ok(png.length >= 33 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && png.toString('ascii', 12, 16) === 'IHDR', 'PNG capture header')
  assert.equal(typeof source, 'string', 'Retained connected capture source')
  return { bytes: png.length, sha256: createHash('sha256').update(png).digest('hex'), width: png.readUInt32BE(16), height: png.readUInt32BE(20),
    sourceSha256: createHash('sha256').update(source).digest('hex'), ctm: { ...ctm }, region: { ...region }, screenRegion: screenRegionFor(ctm, region), captureState: structuredClone(captureState) }
}

function assertCapture(condition, message, diagnostic) {
  if (condition) return
  const error = new assert.AssertionError({ message: `${message}: ${JSON.stringify(diagnostic)}` })
  error.captureDiagnostic = diagnostic
  throw error
}

// Chrome screenshots are non-interlaced 8-bit RGB/RGBA PNGs. Decode their
// retained bytes directly; neither SVG reconstruction nor production geometry
// participates in this observation. Other formats fail explicitly.
export function decodeConnectedPaintPng(png) {
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  let width, height, channels, offset = 8
  const chunks = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset), kind = png.toString('ascii', offset + 4, offset + 8)
    assert.ok(offset + length + 12 <= png.length, 'Complete PNG chunks')
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      assert.ok(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'Bounded screenshot')
      assert.equal(data[8], 8); assert.ok([2, 6].includes(data[9])); assert.equal(data[12], 0)
      channels = data[9] === 2 ? 3 : 4
    } else if (kind === 'IDAT') chunks.push(data)
    offset += length + 12
  }
  assert.ok(channels && chunks.length)
  const stride = width * channels, raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: height * (stride + 1) })
  assert.equal(raw.length, height * (stride + 1))
  const decoded = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    assert.ok(filter <= 4, 'Known PNG filter')
    if (filter === 0) { raw.copy(decoded, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1)); continue }
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, left = x >= channels ? decoded[at - channels] : 0
      const up = y ? decoded[at - stride] : 0, corner = y && x >= channels ? decoded[at - stride - channels] : 0
      const p = left + up - corner
      const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
        : Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner) ? left : Math.abs(p - up) <= Math.abs(p - corner) ? up : corner
      decoded[at] = (raw[y * (stride + 1) + x + 1] + predictor) & 255
    }
  }
  const rgba = Buffer.alloc(width * height * 4, 255)
  for (let index = 0; index < width * height; index++) for (let channel = 0; channel < channels; channel++) rgba[index * 4 + channel] = decoded[index * channels + channel]
  return { width, height, rgba }
}

export function inspectConnectedLivePaintPng(png, options) {
  return inspectConnectedLivePaintRgba({ ...decodeConnectedPaintPng(png), ...options })
}

export function inspectConnectedLivePaintRgba({ width, height, rgba, ctm, samples, region = defaultRegion, captureState }) {
  const context = { dimensions: { width, height }, ctm, region, captureState }
  assertCapture(Object.values(ctm).every(Number.isFinite) && ctm.a > 0 && ctm.d === ctm.a && ctm.b === 0 && ctm.c === 0, 'Measured uniform live CTM', context)
  assertCapture(Object.values(region).every(Number.isFinite) && region.minX < region.maxX && region.minY < region.maxY, 'Finite nonempty live capture region', context)
  assert.equal(rgba.length, width * height * 4)
  const scale = ctm.a, threshold = 127
  const screenRegion = screenRegionFor(ctm, region)
  Object.assign(context, { screenRegion })
  // The continuous region may end exactly at the screenshot edge, where the
  // last existing pixel is width/height - 1. A region beyond it is clipped and
  // cannot establish complete paint, even when its remaining pixels are white.
  assertCapture(screenRegion.minX >= 0 && screenRegion.minY >= 0 && screenRegion.maxX <= width && screenRegion.maxY <= height,
    'Requested live paint region is not clipped', context)
  const rect = { minX: Math.floor(screenRegion.minX), minY: Math.floor(screenRegion.minY),
    maxX: Math.min(width - 1, Math.ceil(screenRegion.maxX)), maxY: Math.min(height - 1, Math.ceil(screenRegion.maxY)) }
  Object.assign(context, { pixelRegion: rect })
  const at = (x, y) => [...rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)]
  const black = (x, y) => {
    const offset = (y * width + x) * 4
    return x >= rect.minX && y >= rect.minY && x <= rect.maxX && y <= rect.maxY
      && rgba[offset + 3] === 255 && rgba[offset] <= threshold && rgba[offset + 1] <= threshold && rgba[offset + 2] <= threshold
  }
  const core = (x, y) => {
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const offset = ((y + dy) * width + x + dx) * 4
      if (rgba[offset] !== 0 || rgba[offset + 1] !== 0 || rgba[offset + 2] !== 0 || rgba[offset + 3] !== 255) return false
    }
    return true
  }
  const boundary = [], bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  let paintedPixelCount = 0, positiveControl = null, paintRadius = 0
  for (let y = rect.minY; y <= rect.maxY; y++) for (let x = rect.minX; x <= rect.maxX; x++) {
    if (!black(x, y)) continue
    if (x === rect.minX || x === rect.maxX || y === rect.minY || y === rect.maxY) assertCapture(false, 'Live paint mask has an exterior margin',
      { ...context, pixel: { x, y }, rgba: at(x, y), boundary: [x === rect.minX ? 'left' : null, x === rect.maxX ? 'right' : null,
        y === rect.minY ? 'top' : null, y === rect.maxY ? 'bottom' : null].filter(Boolean) })
    paintedPixelCount++
    const local = { x: (x + .5 - ctm.e) / scale, y: (y + .5 - ctm.f) / scale }
    paintRadius = Math.max(paintRadius, Math.hypot(local.x, local.y))
    bounds.minX = Math.min(bounds.minX, local.x - .5 / scale); bounds.maxX = Math.max(bounds.maxX, local.x + .5 / scale)
    bounds.minY = Math.min(bounds.minY, local.y - .5 / scale); bounds.maxY = Math.max(bounds.maxY, local.y + .5 / scale)
    if (!positiveControl && core(x, y)) positiveControl = { local, pixel: { x, y }, rgba: at(x, y) }
    if (!black(x - 1, y) || !black(x + 1, y) || !black(x, y - 1) || !black(x, y + 1)) boundary.push(local)
  }
  assertCapture(!paintedPixelCount || boundary.length && positiveControl, 'Independent opaque positive calibration', { ...context, paintedPixelCount, boundaryPixelCount: boundary.length })
  const backgroundControl = { pixel: { x: rect.minX, y: rect.minY }, rgba: at(rect.minX, rect.minY) }
  assertCapture(backgroundControl.rgba.slice(0, 3).every((n) => n >= 230) && backgroundControl.rgba[3] === 255, 'Independent background calibration', { ...context, ...backgroundControl })
  return { width, height, method: 'connected screenshot black-pixel boundary distance', region, calibration: { threshold, pixelCenters: true, positiveControl, backgroundControl },
    boundaryPixelCount: boundary.length, paintedPixelCount, paintBounds: paintedPixelCount ? bounds : null, paintRadius,
    samples: samples.map((sample) => {
      const local = sample.local ?? sample
      const screen = { x: scale * local.x + ctm.e, y: scale * local.y + ctm.f }, pixel = { x: Math.floor(screen.x), y: Math.floor(screen.y) }
      assertCapture(pixel.x >= rect.minX && pixel.x <= rect.maxX && pixel.y >= rect.minY && pixel.y <= rect.maxY, 'Live probe inside measured region', { ...context, local, screen, pixel })
      const paintDistance = black(pixel.x, pixel.y) ? 0 : boundary.length ? Math.sqrt(boundary.reduce((best, q) => Math.min(best, (local.x - q.x) ** 2 + (local.y - q.y) ** 2), Infinity)) : null
      return { local, screen, pixel, rgba: at(pixel.x, pixel.y), paintDistance, paintCore: core(pixel.x, pixel.y) }
    }) }
}
