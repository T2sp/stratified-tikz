// Independent librsvg/Cairo oracle: deliberately imports no application code.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url)), scale = 16, side = 2560
const specifications = [
  { id: 'circle-square-wide-linearized', shape: 'circle', size: 3, radius: 1.8 * Math.SQRT2, width: 72, lineJoin: 'bevel', lineStyle: 'dashed', lineCap: 'square', dashPattern: [3.6, 3.6], dashPhase: 0 },
  { id: 'circle-square-thin-linearized', shape: 'circle', size: 30, radius: 18 * Math.SQRT2, width: 1.2, lineJoin: 'bevel', lineStyle: 'solid', lineCap: 'square', dashPattern: [2.4, 9.6], dashPhase: 4.8 },
  { id: 'circle-zero-entry-linearized', shape: 'circle', size: 3, radius: 1.8 * Math.SQRT2, width: 7.2, lineJoin: 'bevel', lineStyle: 'dashed', lineCap: 'square', dashPattern: [0, 3.6, 2.4, 0], dashPhase: 12 },
].map((spec) => ({ ...spec, segments: 256, strokeVertices: Array.from({ length: 256 }, (_, i) => ({ x: spec.radius * Math.cos(i * 2 * Math.PI / 256), y: spec.radius * Math.sin(i * 2 * Math.PI / 256) })), centerlineErrorBound: spec.radius * (1 - Math.cos(Math.PI / 256)), tangentAngleErrorBound: Math.PI / 256 }))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex'), observations = []
for (const spec of specifications) {
  const geometry = `<polygon points="${spec.strokeVertices.map(({ x, y }) => `${x},${y}`).join(' ')}"`
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
  const probes = [{ x: 0, y: -24 }, { x: -6, y: -28 }, { x: 20, y: 20 }, { x: 0, y: -50 }, { x: 9, y: -50 }, { x: 0, y: 0 }, farthest,
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
writeFileSync(join(directory, 'corrected-circle-observations.json'), JSON.stringify({ provenance: 'Independent librsvg/Cairo rasterization of fixed 256-segment circle approximation; originals preserved separately; no production imports; alpha >= 128', renderer: execFileSync('rsvg-convert', ['--version'], { encoding: 'utf8' }).trim(), pixelReader: execFileSync('magick', ['--version'], { encoding: 'utf8' }).split('\n')[0], scale, viewBox: { minX: -80, minY: -80, width: 160, height: 160 }, boundsUncertainty: 2 / scale, boundsUncertaintyReason: 'Two alpha-threshold pixels cover sharp square-cap corner quantization; the independent wide-circle cap edge differs by 0.0699 local units, exceeding one pixel.', distanceUncertainty: 2 / scale, observations }, null, 2) + '\n')
