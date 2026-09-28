// Independent literal SVG corner oracle. No production geometry/paint imports.
// Existing 28 fixture pairs are never written; retained review hashes are local.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url)), outputDirectory = join(directory, 'corner')
const scale = 16, side = 2560, viewBox = { minX: -80, minY: -80, width: 160, height: 160 }
const reviewed = JSON.parse(readFileSync(join(outputDirectory, 'review-evidence.json'), 'utf8'))
const cartesian = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
const specifications = [
  ...[6, 36].flatMap((width) => ['square', 'round'].map((lineCap) => ({
    id: `cartesian-zero-corner-${width}-${lineCap}`, coordinateSpace: 'cartesian', shape: 'square', vertices: cartesian,
    width, lineJoin: 'bevel', lineCap, dashPattern: [0, 10], dashPhase: 0,
  }))),
  { id: 'production-zero-exact-corner', coordinateSpace: 'production-local', shape: 'square', size: 5.892556509887896,
    vertices: [{ x: 5.000000000000001, y: -5 }, { x: -5, y: -5.000000000000001 }, { x: -5.000000000000002, y: 5 }, { x: 5, y: 5.000000000000002 }],
    width: 36, lineJoin: 'bevel', lineCap: 'square', dashPattern: [0, 10], dashPhase: 0,
    modelStroke: { width: 30, lineStyle: 'solid', dashPattern: [0, 10 / 1.2], dashPhase: 0, lineCap: 'rect', lineJoin: 'bevel' } },
  ...[6, 36].flatMap((width) => ['square', 'round'].flatMap((lineCap) => [
    { placement: 'exact', key: 'corner', dashPhase: 0 },
    { placement: 'after', key: 'after-corner', dashPhase: -.25 },
    { placement: 'before', key: 'before-corner', dashPhase: .25 },
  ].map(({ placement, key, dashPhase }) => ({ id: `cartesian-positive-${key}-${width}-${lineCap}`,
    endpointPlacement: placement, coordinateSpace: 'cartesian', shape: 'square', vertices: cartesian,
    width, lineJoin: 'bevel', lineCap, dashPattern: [10, 10], dashPhase })))),
]
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex'), observations = []
for (const spec of specifications) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="-80 -80 160 160"><polygon points="${spec.vertices.map(({ x, y }) => `${x},${y}`).join(' ')}" fill="none" stroke="black" stroke-width="${spec.width}" stroke-dasharray="${spec.dashPattern.join(' ')}" stroke-dashoffset="${spec.dashPhase}" stroke-linecap="${spec.lineCap}" stroke-linejoin="${spec.lineJoin}"/></svg>`
  const input = join(outputDirectory, `${spec.id}.svg`), output = join(outputDirectory, `${spec.id}.png`)
  writeFileSync(input, svg); execFileSync('rsvg-convert', ['--output', output, input])
  const svgSha256 = sha(svg), pngSha256 = sha(readFileSync(output)), retained = reviewed.pairs[spec.id]
  if (retained && (svgSha256 !== retained.svgSha256 || pngSha256 !== retained.pngSha256)) throw new Error(`Changed independent reviewer source/raster: ${spec.id}`)
  const alpha = execFileSync('magick', [output, '-alpha', 'extract', '-depth', '8', 'gray:-'], { maxBuffer: 8 * 1024 * 1024 })
  const boundary = []; let minX = side, minY = side, maxX = -1, maxY = -1, rasterRadius = 0, coreRadius = 0, paintedPositive = null
  for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
    const i = y * side + x; if (alpha[i] < 128) continue
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    const point = { x: (x + .5) / scale - 80, y: (y + .5) / scale - 80 }, radius = Math.hypot(point.x, point.y)
    rasterRadius = Math.max(rasterRadius, radius)
    if (radius > coreRadius && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => alpha[(y + dy) * side + x + dx] === 255))) { paintedPositive = point; coreRadius = radius }
    if ([i - 1, i + 1, i - side, i + side].some((j) => alpha[j] < 128)) boundary.push(point)
  }
  if (!paintedPositive) throw new Error(`No fully opaque positive probe: ${spec.id}`)
  const probes = [paintedPositive, { x: 25, y: 25 }, { x: 20, y: 20 }, { x: -25, y: -25 }, { x: -20, y: -20 },
    { x: 40, y: 40 }, { x: -35, y: -35 }, { x: 25, y: -25 }, { x: -25, y: 25 }, { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: -2 }, { x: 10, y: 12 }, { x: 11.5, y: 11.5 }, { x: 12, y: 11.5 }, { x: 12, y: 12 }, { x: 11.5, y: 1.5 },
    ...[-30, -20, -10, 0, 10, 20, 30].flatMap((y) => [-30, -20, -10, 0, 10, 20, 30].map((x) => ({ x, y })))]
  observations.push({ ...spec, miterLimit: 4, miterLimitNote: 'SVG default; bevel join does not consult it',
    svgFile: `corner/${spec.id}.svg`, pngFile: `corner/${spec.id}.png`, svgSha256, pngSha256,
    ...(retained ? { reviewedSource: retained.reviewedSource, reviewedSvgSha256: retained.svgSha256, reviewedPngSha256: retained.pngSha256 } : {}),
    rasterRadius, paintedPositive,
    rasterBounds: { minX: minX / scale - 80, minY: minY / scale - 80, maxX: (maxX + 1) / scale - 80, maxY: (maxY + 1) / scale - 80 },
    probes: probes.map((point) => {
      const a = alpha[Math.floor((point.y + 80) * scale) * side + Math.floor((point.x + 80) * scale)]
      let distance = 0
      if (a < 128) { distance = Infinity; for (const pixel of boundary) distance = Math.min(distance, Math.hypot(point.x - pixel.x, point.y - pixel.y)) }
      return { point, alpha: a, painted: a >= 128, nearestPaintCenterDistance: distance }
    }) })
}
writeFileSync(join(directory, 'corner-observations.json'), JSON.stringify({ provenance: 'Independent librsvg/Cairo literal polygon rasterization; five source/raster pairs retain reviewer bytes, twelve independent positive-on controls; no production imports; alpha >=128', renderer: execFileSync('rsvg-convert', ['--version'], { encoding: 'utf8' }).trim(), pixelReader: execFileSync('magick', ['--version'], { encoding: 'utf8' }).split('\n')[0], scale, viewBox, boundsUncertainty: 1 / scale, distanceUncertainty: 2 / scale, observations }, null, 2) + '\n')
