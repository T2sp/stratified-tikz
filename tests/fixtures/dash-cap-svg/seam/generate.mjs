// Independent literal SVG/native raster fixture generator. No production imports.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const directory = new URL('./', import.meta.url)
const retained = JSON.parse(readFileSync(new URL('reviewer-observations.json', directory), 'utf8'))
const side = 1280, scale = 16, min = -30, width = 36
const boundsUncertainty = 1 / scale, distanceUncertainty = 2 / scale
const vertices = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
// A 36-wide continuous bevel stroke around the literal 10-square, including
// its original interior, is precisely this convex octagon. This independent
// construction prevents deliberate dash-gap selection becoming a miss oracle.
const continuousStrokeOracle = {
  description: 'Literal continuous bevel octagon including the original contour interior; independent segment-distance and convex half-plane calculations',
  vertices: [{ x: -18, y: 0 }, { x: 0, y: -18 }, { x: 10, y: -18 }, { x: 28, y: 0 },
    { x: 28, y: 10 }, { x: 10, y: 28 }, { x: 0, y: 28 }, { x: -18, y: 10 }],
}

function continuousDistance(point) {
  let inside = true, nearest = Infinity
  for (let index = 0; index < continuousStrokeOracle.vertices.length; index++) {
    const a = continuousStrokeOracle.vertices[index]
    const b = continuousStrokeOracle.vertices[(index + 1) % continuousStrokeOracle.vertices.length]
    const dx = b.x - a.x, dy = b.y - a.y
    if (dx * (point.y - a.y) - dy * (point.x - a.x) < 0) inside = false
    const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
    nearest = Math.min(nearest, Math.hypot(point.x - a.x - fraction * dx, point.y - a.y - fraction * dy))
  }
  return inside ? 0 : nearest
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const observations = []
for (const reference of retained.observations) {
  const { id, pattern, phase, cap } = reference
  const svgFile = `${id}.svg`, pngFile = `${id}.png`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="-30 -30 80 80"><polygon points="0,0 10,0 10,10 0,10" fill="none" stroke="black" stroke-width="${width}" stroke-dasharray="${pattern.join(' ')}" stroke-dashoffset="${phase}" stroke-linecap="${cap}" stroke-linejoin="bevel"/></svg>`
  assert.equal(hash(svg), retained.retainedSourceAndRasterHashes[svgFile], 'literal source must preserve reviewer bytes')
  writeFileSync(new URL(svgFile, directory), svg)
  execFileSync('/opt/homebrew/bin/rsvg-convert', ['--output', fileURLToPath(new URL(pngFile, directory)), fileURLToPath(new URL(svgFile, directory))])
  const png = readFileSync(new URL(pngFile, directory))
  assert.equal(hash(png), retained.retainedSourceAndRasterHashes[pngFile], 'native output must preserve reviewer bytes')
  const alpha = execFileSync('/opt/homebrew/bin/magick', [fileURLToPath(new URL(pngFile, directory)), '-alpha', 'extract', '-depth', '8', 'gray:-'], { maxBuffer: 2 * 1024 * 1024 })
  assert.equal(alpha.length, side * side)
  const boundary = [], extremes = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, rasterRadius = 0
  for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
    const index = y * side + x
    if (alpha[index] < 128) continue
    const point = { x: min + (x + .5) / scale, y: min + (y + .5) / scale }
    if (point.x < minX) { minX = point.x; extremes[0] = point }
    if (point.y < minY) { minY = point.y; extremes[1] = point }
    if (point.x > maxX) { maxX = point.x; extremes[2] = point }
    if (point.y > maxY) { maxY = point.y; extremes[3] = point }
    const radius = Math.hypot(point.x, point.y)
    if (radius > rasterRadius) { rasterRadius = radius; extremes[4] = point }
    if ([index - 1, index + 1, index - side, index + side].some((neighbor) => alpha[neighbor] < 128)) boundary.push(point)
  }
  const paintDistance = (point) => {
    let distance = Infinity
    for (const sample of boundary) distance = Math.min(distance, Math.hypot(point.x - sample.x, point.y - sample.y))
    return distance
  }
  const samples = new Map()
  const observe = (point, reason) => {
    const alphaValue = alpha[Math.floor((point.y - min) * scale) * side + Math.floor((point.x - min) * scale)]
    const painted = alphaValue >= 128
    const observation = { point, reason, alpha: alphaValue, painted,
      nearestPaintCenterDistance: painted ? 0 : paintDistance(point), continuousStrokeDistance: continuousDistance(point) }
    samples.set(`${point.x},${point.y}`, observation)
    return observation
  }
  for (const point of extremes) observe(point, 'independent raster extremum')
  for (const example of reference.positiveExamples) observe(example.p, 'retained reviewer painted failure')
  for (const example of reference.negativeExamples) observe(example.p, 'retained reviewer exterior failure')
  // A two-unit grid is independent of endpoint scheduling. Retain opaque cap
  // extension samples and exterior controls where BOTH native paint and the
  // literal continuous-stroke octagon are farther than the six-unit allowance.
  for (let y = -28; y <= 38; y += 2) for (let x = -28; x <= 38; x += 2) {
    const point = { x, y }, alphaValue = alpha[(y - min) * scale * side + (x - min) * scale]
    const continuousStrokeDistance = continuousDistance(point)
    if (alphaValue === 255 && continuousStrokeDistance > distanceUncertainty) observe(point, 'opaque cap extension')
    else if (alphaValue === 0 && continuousStrokeDistance > 6 + distanceUncertainty
      && paintDistance(point) > 6 + distanceUncertainty) observe(point, 'independent exterior control')
  }
  const probes = [...samples.values()]
  assert.ok(probes.some((probe) => probe.reason === 'opaque cap extension'))
  assert.ok(probes.some((probe) => probe.reason === 'independent exterior control'))
  observations.push({ id, coordinateSpace: 'cartesian', vertices, width, lineJoin: 'bevel', lineCap: cap,
    dashPattern: pattern, dashPhase: phase, svgFile: `seam/${svgFile}`, pngFile: `seam/${pngFile}`,
    svgSha256: hash(svg), pngSha256: hash(png), reviewedSource: `${retained.source.slice(0, retained.source.lastIndexOf('/'))}/${id}`,
    rasterBounds: { minX, minY, maxX, maxY }, rasterRadius, probes })
}

const manifest = {
  provenance: 'Independent librsvg/Cairo literal square rasterization; eight source/raster pairs preserve independent reviewer bytes; no production imports; alpha >=128',
  renderer: execFileSync('/opt/homebrew/bin/rsvg-convert', ['--version'], { encoding: 'utf8' }).trim(),
  pixelReader: execFileSync('/opt/homebrew/bin/magick', ['--version'], { encoding: 'utf8' }).split('\n')[0],
  scale, viewBox: { minX: min, minY: min, width: 80, height: 80 }, boundsUncertainty, distanceUncertainty,
  originalMatrix: { path: retained.source, sha256: retained.sourceSha256, retainedExcerpt: 'seam/reviewer-observations.json' },
  continuousStrokeOracle, observations,
}
writeFileSync(new URL('../seam-observations.json', directory), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ pairs: observations.length, probes: observations.map(({ id, probes }) => ({ id, count: probes.length })) }))
