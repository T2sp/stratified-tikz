import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'
import { standaloneSvgViewport, assertStandaloneSvgCaptureStable } from './standaloneSvgCapture.mjs'

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function pngCrc(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

// Validate retained native raster bytes, not merely the IHDR metadata. This
// bounded scanline check accepts Chrome's RGB/RGBA format and rejects a mock
// header, incomplete chunks, corrupt compressed data, or absent image data.
function assertCompletePng(bytes, viewport) {
  assert.ok(bytes.length >= 57 && bytes.subarray(0, 8).equals(pngSignature), 'Retained complete PNG signature')
  const data = []
  let offset = 8, channels, ended = false, seenImage = false
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'Retained PNG chunk header is complete')
    const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8)
    assert.ok(offset + length + 12 <= bytes.length, 'Retained PNG chunk data is complete')
    assert.equal(pngCrc(bytes.subarray(offset + 4, offset + 8 + length)), bytes.readUInt32BE(offset + 8 + length), 'Retained PNG chunk checksum')
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (offset === 8) assert.equal(kind, 'IHDR', 'PNG starts with its image header')
    if (kind === 'IHDR') {
      assert.equal(offset, 8); assert.equal(length, 13)
      assert.deepEqual({ width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4) }, viewport, 'Actual PNG dimensions match the measured CSS viewport')
      assert.equal(chunk[8], 8); assert.ok([2, 6].includes(chunk[9]), 'Native PNG uses RGB or RGBA')
      assert.deepEqual([...chunk.subarray(10)], [0, 0, 0], 'Native PNG compression, filtering and interlace')
      channels = chunk[9] === 2 ? 3 : 4
    } else if (kind === 'IDAT') {
      assert.ok(channels && !ended); data.push(chunk); seenImage = true
    } else if (kind === 'IEND') {
      assert.ok(seenImage); assert.equal(length, 0); ended = true
    }
    offset += length + 12
    if (ended) { assert.equal(offset, bytes.length, 'PNG ends at IEND'); break }
  }
  assert.ok(ended && data.length > 0, 'PNG retains complete raster image data')
  const stride = viewport.width * channels + 1
  const raster = inflateSync(Buffer.concat(data), { maxOutputLength: viewport.height * stride })
  assert.equal(raster.length, viewport.height * stride, 'PNG has every viewport scanline')
  for (let row = 0; row < viewport.height; row++) assert.ok(raster[row * stride] <= 4, 'PNG scanline filter is valid')
}

export function validateStandaloneSvgCaptureEvidence(capture, { pngPath, svgPath, root }) {
  pngPath = resolve(pngPath); svgPath = resolve(svgPath)
  assert.ok(capture && typeof capture === 'object', 'Standalone capture record is required')
  assert.equal(capture.status, 'saved', 'Standalone screenshot reached saved status')
  assert.equal(capture.requestedPath, pngPath); assert.equal(capture.retainedPath, pngPath)
  assert.equal(capture.fileExists, true); assert.equal(capture.error, undefined)
  assert.deepEqual(capture.options, { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 }, 'One bounded complete-root CSS viewport screenshot')
  assert.ok(Array.isArray(capture.measurements) && [1, 2].includes(capture.measurements.length), 'At most one measured viewport expansion')
  const fileUrl = pathToFileURL(svgPath).href
  for (const measured of [...capture.measurements, capture.before, capture.after]) {
    assert.equal(measured.url, fileUrl, 'Measurements belong to the actual downloaded SVG file')
    assert.equal(measured.contentType, 'image/svg+xml'); assert.equal(measured.readyState, 'complete')
    assert.equal(measured.bodyExists, false); assert.equal(measured.htmlBodyExists, false, 'SVG XML has no HTML body')
    assert.ok(Number.isFinite(Number(measured.root.width)) && Number(measured.root.width) > 0)
    assert.ok(Number.isFinite(Number(measured.root.height)) && Number(measured.root.height) > 0)
    assert.equal(measured.root.bounds.width, Number(measured.root.width), 'Fixed SVG width is preserved at native CSS scale')
    assert.equal(measured.root.bounds.height, Number(measured.root.height), 'Fixed SVG height is preserved at native CSS scale')
    const viewBox = measured.root.viewBox.trim().split(/\s+/u).map(Number)
    assert.equal(viewBox.length, 4); assert.ok(viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0)
    standaloneSvgViewport(measured)
  }
  const initial = capture.measurements[0], before = capture.measurements.at(-1)
  if (capture.measurements.length === 2) {
    assert.notDeepEqual(initial.viewport, before.viewport, 'Expansion changes the viewport once')
    assert.deepEqual(before.viewport, standaloneSvgViewport(initial), 'Expansion follows actual initial measurements')
    assert.deepEqual({ ...initial, viewport: before.viewport }, before, 'Viewport expansion preserves root coordinates and document identity')
  }
  assert.deepEqual(capture.before, before, 'Capture starts from its last fresh measurement')
  assert.deepEqual(Object.fromEntries(['localName', 'namespace', 'width', 'height', 'viewBox'].map((key) => [key, before.root[key]])), root,
    'Screenshot measures the same reopened root')
  assertStandaloneSvgCaptureStable(capture.before, capture.after)
  const required = standaloneSvgViewport(before)
  assert.ok(required.width <= before.viewport.width && required.height <= before.viewport.height, 'Measured viewport contains the complete root edges')
  assert.deepEqual(capture.coverage, { completeRoot: true, bounds: before.root.bounds, viewport: before.viewport })
  assert.equal(capture.coordinatesStable, true)
  assert.ok(statSync(pngPath).isFile(), 'Native PNG exists at its exact retained path')
  const bytes = readFileSync(pngPath)
  assertCompletePng(bytes, before.viewport)
  assert.deepEqual(capture.png, { width: before.viewport.width, height: before.viewport.height, bytes: bytes.length }, 'PNG metadata matches actual bytes')
}

export function assertStandaloneReopeningRecord(raw, evidence, artifactDir) {
  assert.equal(raw.scenario, evidence.scenario); assert.equal(raw.group, evidence.group)
  assert.equal(raw.result, 'observed', 'Reopening candidates retain observed status independently of terminal acceptance')
  assert.equal(raw.background, evidence.background)
  assert.equal(raw.error, undefined); assert.deepEqual(raw.cleanupErrors, [], 'Accepted standalone reopening completed owned cleanup')
  const svgPath = resolve(artifactDir, `${evidence.scenario}.svg`)
  assert.equal(raw.svgPath, svgPath); assert.equal(raw.fileUrl, pathToFileURL(svgPath).href)
  assert.deepEqual(raw.pageErrors, []); assert.deepEqual(raw.standaloneErrors, [])
  assert.deepEqual(raw.expected, evidence.expected); assert.deepEqual(raw.click, evidence.click)
  assert.deepEqual(raw.requests, [raw.fileUrl], 'Reopening requests belong only to the retained file')
  assert.equal(raw.reopened.length, evidence.expected.length)
  const xml = readFileSync(svgPath, 'utf8'), root = /<svg\b([^>]*)>/u.exec(xml)
  assert.ok(root, 'Retained SVG root exists')
  const attribute = (name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u').exec(root[1])?.[1] ?? null
  const rootRecord = { localName: 'svg', namespace: attribute('xmlns'), width: attribute('width'), height: attribute('height'), viewBox: attribute('viewBox') }
  assert.deepEqual(raw.document.root, rootRecord, 'Reopened root attributes match actual downloaded XML')
  assert.equal(raw.document.forbiddenCount, 0); assert.deepEqual(raw.document.externalReferences, [])
  assert.equal(raw.document.backgroundCount, evidence.background === 'white' ? 1 : 0)
  assert.ok(!/<(?:parsererror|foreignObject|image|script)\b/iu.test(xml), 'Downloaded XML has no forbidden content')
  const references = [...xml.matchAll(/\s(?:[\w-]+:)?href\s*=\s*["']([^"']*)["']/gu)].map((match) => match[1])
  assert.ok(references.every((reference) => reference.startsWith('#')), 'Downloaded SVG has no external references')
  assert.equal(xml.includes('data-stratified-tikz-export-background="white"'), evidence.background === 'white')
  return xml
}
