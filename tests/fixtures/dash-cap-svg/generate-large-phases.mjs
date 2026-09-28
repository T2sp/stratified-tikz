// Independent large-phase oracle; literal geometry/settings and JS remainder.
// No production imports. The local retained review manifest verifies byte identities.
// Existing original and corrected-circle fixture files are never written.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url)), scale = 16, side = 2560
const triangleRadius = 3.6 * Math.SQRT2
const triangle = [0, 1, 2].map((index) => ({ x: triangleRadius * Math.cos(-Math.PI / 2 - index * 2 * Math.PI / 3), y: triangleRadius * Math.sin(-Math.PI / 2 - index * 2 * Math.PI / 3) }))
const dashPattern = [3 * 1.2, 3 * 1.2], patternTotal = dashPattern.reduce((sum, part) => sum + part, 0)
const phases = [{ key: '1e12', rawPhase: 1e12 }, { key: '1e20', rawPhase: 1e20 }, { key: '1e200', rawPhase: 1e200 }]
const specifications = phases.flatMap(({ key, rawPhase }) => ['original', 'corrected'].map((variant) => {
  const convertedPhase = rawPhase * 1.2
  const emittedPhase = variant === 'original' ? convertedPhase : convertedPhase % patternTotal
  return { id: `triangle-phase-${key}-${variant}`, variant, rawPhase, convertedPhase, emittedPhase,
    shape: 'triangle', size: 3, vertices: triangle, width: 36, lineJoin: 'bevel', lineCap: 'square',
    lineStyle: 'dashed', dashPattern, dashPhase: emittedPhase,
    reviewedSource: `/private/tmp/stz-review-production-phase-${rawPhase}${variant === 'corrected' ? '-canonical' : ''}` }
}))
const outputDirectory = join(directory, 'large-phase')
mkdirSync(outputDirectory, { recursive: true })
const reviewed = JSON.parse(readFileSync(join(outputDirectory, 'review-evidence.json'), 'utf8'))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex'), observations = []
for (const spec of specifications) {
  const geometry = spec.shape === 'circle' ? `<circle r="${spec.radius}"` : `<polygon points="${spec.vertices.map(({ x, y }) => `${x},${y}`).join(' ')}"`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="-80 -80 160 160">${geometry} fill="none" stroke="black" stroke-width="${spec.width}" stroke-linejoin="${spec.lineJoin}" stroke-linecap="${spec.lineCap}" stroke-dasharray="${spec.dashPattern.join(' ')}" stroke-dashoffset="${spec.dashPhase}" stroke-miterlimit="10"/></svg>\n`
  const input = join(outputDirectory, `${spec.id}.svg`), output = join(outputDirectory, `${spec.id}.png`)
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
  const reviewedSvgSha256 = reviewed.pairs[spec.id].svgSha256
  const reviewedPngSha256 = reviewed.pairs[spec.id].pngSha256
  if (sha(svg) !== reviewedSvgSha256 || sha(readFileSync(output)) !== reviewedPngSha256) throw new Error(`Regenerated source/raster differs from retained independent reviewer evidence: ${spec.id}`)
  observations.push({ ...spec, svgFile: `large-phase/${spec.id}.svg`, pngFile: `large-phase/${spec.id}.png`,
    reviewedSvgSha256, reviewedPngSha256, miterLimit: 10, rasterRadius, farthest,
    svgSha256: sha(svg), pngSha256: sha(readFileSync(output)),
    rasterBounds: { minX: minX / scale - 80, minY: minY / scale - 80, maxX: (maxX + 1) / scale - 80, maxY: (maxY + 1) / scale - 80 },
    probes: probes.map((point) => {
      const a = alpha[Math.floor((point.y + 80) * scale) * side + Math.floor((point.x + 80) * scale)]
      let distance = 0
      if (a < 128) { distance = Infinity; for (const pixel of boundary) distance = Math.min(distance, Math.hypot(point.x - pixel.x, point.y - pixel.y)) }
      return { point, alpha: a, painted: a >= 128, nearestPaintCenterDistance: distance }
    }) })
}
writeFileSync(join(directory, 'large-phase-observations.json'), JSON.stringify({ provenance: 'Independent librsvg/Cairo SVG rasterization of literal triangle and settings; six source/raster pairs match retained independent reviewer evidence byte-for-byte; no production imports; alpha >= 128', phaseRule: 'Original uses rawPhase * 1.2; corrected uses (rawPhase * 1.2) % sum([3 * 1.2, 3 * 1.2]), preserving the actual emitted floating-point pattern period', renderer: execFileSync('rsvg-convert', ['--version'], { encoding: 'utf8' }).trim(), pixelReader: execFileSync('magick', ['--version'], { encoding: 'utf8' }).split('\n')[0], scale, viewBox: { minX: -80, minY: -80, width: 160, height: 160 }, boundsUncertainty: 1 / scale, distanceUncertainty: 2 / scale, observations }, null, 2) + '\n')
