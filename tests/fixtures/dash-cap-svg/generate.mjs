// Independent librsvg/Cairo oracle: deliberately imports no application code.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url)), scale = 16, side = 2560
const triangleRadius = 3.6 * Math.SQRT2
const triangle = [0, 1, 2].map((index) => ({ x: triangleRadius * Math.cos(-Math.PI / 2 - index * 2 * Math.PI / 3), y: triangleRadius * Math.sin(-Math.PI / 2 - index * 2 * Math.PI / 3) }))
const star = Array.from({ length: 10 }, (_, index) => { const radius = 31.5 * Math.SQRT2 / (index % 2 ? 1.5 : 1), angle = -Math.PI / 2 - index * Math.PI / 5; return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) } })
const common = { shape: 'triangle', size: 3, vertices: triangle, width: 36, lineJoin: 'bevel', lineCap: 'square', dashPattern: [3.6, 3.6], dashPhase: 0 }
const specifications = [
  { ...common, id: 'triangle-square-wide', lineStyle: 'dashed' },
  { ...common, id: 'triangle-butt-wide', lineStyle: 'dashed', lineCap: 'butt' },
  { ...common, id: 'triangle-round-wide', lineStyle: 'dashed', lineCap: 'round' },
  { ...common, id: 'triangle-round-sparse', lineStyle: 'solid', lineCap: 'round', dashPattern: [5, 10] },
  { ...common, id: 'triangle-square-thin', lineStyle: 'dashed', width: .48 },
  { ...common, id: 'triangle-dotted', lineStyle: 'dotted', width: 1.2, dashPattern: [1.2, 2.4] },
  { ...common, id: 'triangle-densely-dotted', lineStyle: 'denselyDotted', width: 1.2, dashPattern: [1.2, 1.2] },
  { ...common, id: 'triangle-explicit-corner', lineStyle: 'dotted', dashPattern: [12, 2.4], dashPhase: 1.2 },
  { ...common, id: 'triangle-explicit-seam', lineStyle: 'solid', dashPattern: [12, 2.4], dashPhase: 8.4 },
  { ...common, id: 'triangle-touching-on', lineStyle: 'solid', dashPattern: [2.4, 0, 2.4, 2.4], dashPhase: 0 },
  { ...common, id: 'triangle-zero-on', lineStyle: 'solid', width: 4.8, dashPattern: [0, 3.6], dashPhase: 0 },
  { ...common, id: 'triangle-zero-off', lineStyle: 'solid', width: 4.8, dashPattern: [3.6, 0], dashPhase: 0 },
  { ...common, id: 'triangle-zero-entry', lineStyle: 'dashed', width: 4.8, dashPattern: [0, 3.6, 2.4, 0], dashPhase: -7.2 },
  { ...common, id: 'star-concave-square', lineStyle: 'dashed', shape: 'star', size: 35, vertices: star, dashPhase: 2.4 },
  ...['square', 'butt', 'round'].map((lineCap) => ({ id: `circle-${lineCap}-wide`, shape: 'circle', size: 3, radius: 1.8 * Math.SQRT2, width: 72, lineJoin: 'bevel', lineStyle: 'dashed', lineCap, dashPattern: [3.6, 3.6], dashPhase: 0 })),
  { id: 'circle-square-thin', shape: 'circle', size: 30, radius: 18 * Math.SQRT2, width: 1.2, lineJoin: 'bevel', lineStyle: 'solid', lineCap: 'square', dashPattern: [2.4, 9.6], dashPhase: 4.8 },
  { id: 'circle-zero-entry', shape: 'circle', size: 3, radius: 1.8 * Math.SQRT2, width: 7.2, lineJoin: 'bevel', lineStyle: 'dashed', lineCap: 'square', dashPattern: [0, 3.6, 2.4, 0], dashPhase: 12 },
]
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex'), observations = []
for (const spec of specifications) {
  const geometry = spec.shape === 'circle' ? `<circle r="${spec.radius}"` : `<polygon points="${spec.vertices.map(({ x, y }) => `${x},${y}`).join(' ')}"`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="-80 -80 160 160">${geometry} fill="none" stroke="black" stroke-width="${spec.width}" stroke-linejoin="${spec.lineJoin}" stroke-linecap="${spec.lineCap}" stroke-dasharray="${spec.dashPattern.join(' ')}" stroke-dashoffset="${spec.dashPhase}" stroke-miterlimit="10"/></svg>\n`
  const input = join(directory, `${spec.id}.svg`), output = join(directory, `${spec.id}.png`)
  writeFileSync(input, svg); execFileSync('rsvg-convert', ['--output', output, input])
  const alpha = execFileSync('magick', [output, '-alpha', 'extract', '-depth', '8', 'gray:-'], { maxBuffer: 8 * 1024 * 1024 })
  const boundary = []; let minX = side, minY = side, maxX = -1, maxY = -1, rasterRadius = 0, farthest = { x: 0, y: 0 }
  for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
    const i = y * side + x; if (alpha[i] < 128) continue
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    const point = { x: (x + .5) / scale - 80, y: (y + .5) / scale - 80 }, radius = Math.hypot(point.x, point.y)
    if (radius > rasterRadius) { rasterRadius = radius; farthest = point }
    if ([i - 1, i + 1, i - side, i + side].some((j) => alpha[j] < 128)) boundary.push(point)
  }
  const probes = [{ x: 0, y: -24 }, { x: -6, y: -28 }, { x: 20, y: 20 }, { x: 0, y: -50 }, { x: 9, y: -50 }, { x: 0, y: 0 }, farthest, ...(spec.id === 'triangle-round-sparse' ? [{ x: 27, y: -2.5 }] : []),
    ...[-65, -45, -35, -25, -15, 15, 25, 35, 45, 65].flatMap((y) => [-65, -45, -35, -25, -15, 0, 15, 25, 35, 45, 65].map((x) => ({ x, y })))]
  observations.push({ ...spec, miterLimit: 10, rasterRadius, farthest,
    svgSha256: sha(svg), pngSha256: sha(readFileSync(output)),
    rasterBounds: { minX: minX / scale - 80, minY: minY / scale - 80, maxX: (maxX + 1) / scale - 80, maxY: (maxY + 1) / scale - 80 },
    probes: probes.map((point) => {
      const a = alpha[Math.floor((point.y + 80) * scale) * side + Math.floor((point.x + 80) * scale)]
      let distance = 0
      if (a < 128) { distance = Infinity; for (const pixel of boundary) distance = Math.min(distance, Math.hypot(point.x - pixel.x, point.y - pixel.y)) }
      return { point, alpha: a, painted: a >= 128, nearestPaintCenterDistance: distance }
    }) })
}
writeFileSync(join(directory, 'observations.json'), JSON.stringify({ provenance: 'Independent librsvg/Cairo SVG rasterization; no production imports; alpha >= 128', renderer: execFileSync('rsvg-convert', ['--version'], { encoding: 'utf8' }).trim(), pixelReader: execFileSync('magick', ['--version'], { encoding: 'utf8' }).split('\n')[0], scale, viewBox: { minX: -80, minY: -80, width: 160, height: 160 }, boundsUncertainty: 1 / scale, distanceUncertainty: 2 / scale, observations }, null, 2) + '\n')
