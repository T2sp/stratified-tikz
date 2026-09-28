// Retained independent paint oracle. No production geometry or candidate imports.
// Regeneration is manual: node tests/fixtures/polygon-stroke-svg/generate.mjs
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const scale = 16
const viewBox = { minX: -80, minY: -80, width: 160, height: 160 }
const dimension = viewBox.width * scale
const triangleRadius = 3.6 * Math.SQRT2
const triangle = [
  { x: 0, y: -triangleRadius },
  { x: -triangleRadius * Math.sqrt(3) / 2, y: triangleRadius / 2 },
  { x: triangleRadius * Math.sqrt(3) / 2, y: triangleRadius / 2 },
]
function star(radius) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 - index * Math.PI / 5
    const length = index % 2 === 0 ? radius : radius / 1.5
    return { x: length * Math.cos(angle), y: length * Math.sin(angle) }
  })
}
const commonProbes = [
  { x: 0, y: 28 }, { x: 0, y: -24 }, { x: 0, y: 0 },
  ...[-1, 1].flatMap((sign) => [5, 10, 15, 20, 25, 30, 40, 47].map((length) => ({ x: 0, y: sign * length }))),
]
const specifications = [
  ...['miter', 'bevel', 'round'].flatMap((lineJoin) => [
    { id: `triangle-${lineJoin}-wide`, shape: 'triangle', size: 3, vertices: triangle, width: 36, lineJoin },
    { id: `triangle-${lineJoin}-thin`, shape: 'triangle', size: 3, vertices: triangle, width: 1.2, lineJoin },
    { id: `star-${lineJoin}-wide`, shape: 'star', size: 3, vertices: star(2.7 * Math.SQRT2), width: 36, lineJoin },
    { id: `star-${lineJoin}-concave`, shape: 'star', size: 20, vertices: star(18 * Math.SQRT2), width: 2.4, lineJoin },
    { id: `star-${lineJoin}-thick-concave`, shape: 'star', size: 35, vertices: star(31.5 * Math.SQRT2), width: 36, lineJoin },
  ]),
  { id: 'acute-miter-limit', vertices: [{ x: 0, y: -30 }, { x: -1, y: 20 }, { x: 1, y: 20 }], width: 4, lineJoin: 'miter' },
  { id: 'acute-bevel-control', vertices: [{ x: 0, y: -30 }, { x: -1, y: 20 }, { x: 1, y: 20 }], width: 4, lineJoin: 'bevel' },
  { id: 'degenerate-miter', vertices: [{ x: -10, y: -10 }, { x: -10, y: -10 }, { x: 0, y: -10 }, { x: 10, y: -10 + 1e-12 }, { x: 10, y: 10 }, { x: -10, y: 10 }], width: 6, lineJoin: 'miter' },
]
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const observations = []
for (const specification of specifications) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="-80 -80 160 160"><polygon points="${specification.vertices.map(({ x, y }) => `${x},${y}`).join(' ')}" fill="none" stroke="black" stroke-width="${specification.width}" stroke-linejoin="${specification.lineJoin}" stroke-miterlimit="10"/></svg>\n`
  const input = join(directory, `${specification.id}.svg`)
  const output = join(directory, `${specification.id}.png`)
  writeFileSync(input, svg)
  execFileSync('rsvg-convert', ['--output', output, input])
  const alpha = execFileSync('magick', [output, '-alpha', 'extract', '-depth', '8', 'gray:-'], { maxBuffer: 12 * 1024 * 1024 })
  if (alpha.length !== dimension * dimension) throw new Error('Unexpected raster dimensions')
  let minX = dimension, minY = dimension, maxX = -1, maxY = -1
  const boundary = []
  let rasterRadius = 0
  for (let y = 1; y < dimension - 1; y++) {
    for (let x = 1; x < dimension - 1; x++) {
      const index = y * dimension + x
      if (alpha[index] < 128) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      rasterRadius = Math.max(rasterRadius, Math.hypot((x + .5) / scale + viewBox.minX, (y + .5) / scale + viewBox.minY))
      if ([index - 1, index + 1, index - dimension, index + dimension].some((neighbor) => alpha[neighbor] < 128)) {
        boundary.push({ x: (x + .5) / scale + viewBox.minX, y: (y + .5) / scale + viewBox.minY })
      }
    }
  }
  const probes = [...commonProbes]
  // Sample both turns near every vertex, not just the five convex star tips.
  for (const vertex of specification.vertices) {
    for (const dx of [-7, 0, 7]) for (const dy of [-7, 0, 7]) probes.push({ x: vertex.x + dx, y: vertex.y + dy })
    const radius = Math.hypot(vertex.x, vertex.y)
    if (radius > 0) for (const beyond of [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]) probes.push({ x: vertex.x * (radius + beyond) / radius, y: vertex.y * (radius + beyond) / radius })
  }
  for (let y = -40; y <= 40; y += 10) for (let x = -40; x <= 40; x += 10) probes.push({ x, y })
  observations.push({ ...specification, miterLimit: 10,
    rasterRadius, svgSha256: sha256(svg), pngSha256: sha256(readFileSync(output)),
    rasterBounds: { minX: minX / scale + viewBox.minX, minY: minY / scale + viewBox.minY,
      maxX: (maxX + 1) / scale + viewBox.minX, maxY: (maxY + 1) / scale + viewBox.minY },
    probes: probes.map((point) => {
      const x = Math.floor((point.x - viewBox.minX) * scale)
      const y = Math.floor((point.y - viewBox.minY) * scale)
      const painted = alpha[y * dimension + x] >= 128
      let nearestPaintCenterDistance = 0
      if (!painted) {
        nearestPaintCenterDistance = Infinity
        for (const pixel of boundary) nearestPaintCenterDistance = Math.min(nearestPaintCenterDistance, Math.hypot(point.x - pixel.x, point.y - pixel.y))
      }
      return { point, painted, nearestPaintCenterDistance }
    }),
  })
}
writeFileSync(join(directory, 'observations.json'), JSON.stringify({
  provenance: 'Independent librsvg/Cairo rasterization; no production geometry imports; threshold alpha >= 128',
  renderer: execFileSync('rsvg-convert', ['--version'], { encoding: 'utf8' }).trim(),
  pixelReader: execFileSync('magick', ['--version'], { encoding: 'utf8' }).split('\n')[0],
  scale, viewBox, distanceUncertainty: 2 / scale,
  distanceUncertaintyReason: 'Two pixels cover quantized nearest pixel centers and partial alpha-threshold coverage at pointed joins; exact triangle edge assertions use analytic distances separately.',
  boundsUncertainty: 1 / scale,
  observations,
}, null, 2) + '\n')
