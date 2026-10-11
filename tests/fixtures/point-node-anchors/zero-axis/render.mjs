/** Recorded independent renderer observations; PGF references are never derived from production. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { solvePointNodeShape } from '../../../../src/geometry/pointNodeShapes/index.ts'
import { ShapeContourBuilder, ellipsePoint } from '../../../../src/geometry/pointNodeShapes/contours.ts'
import { decodeConnectedPaintPng } from '../../../../scripts/connectedLivePaintOracle.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const referenceBytes = readFileSync(`${root}references.json`)
const references = JSON.parse(referenceBytes)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const renderer = process.env.STZ_RSVG_CONVERT ?? '/opt/homebrew/bin/rsvg-convert'
const rendererVersion = execFileSync(renderer, ['--version'], { encoding: 'utf8' }).trim()
mkdirSync(`${root}renders`, { recursive: true })
function referencePath(tokens) {
  let path = ''
  for (const { kind, x, y } of tokens) {
    if (kind === 'movetotoken') path += ` M ${x} ${y}`
    else if (kind === 'linetotoken') path += ` L ${x} ${y}`
    else if (kind === 'curvetosupportatoken') path += ` C ${x} ${y}`
    else if (kind === 'curvetosupportbtoken' || kind === 'curvetotoken') path += ` ${x} ${y}`
    else if (kind === 'closepathtoken') path += ' Z'
    else throw new Error(`Unexpected authenticated PGF token ${kind}`)
  }
  return path.trim()
}
// Cairo may discard a single solid stroked cubic whose endpoints coincide,
// despite its nonconstant controls. Subdivide the authenticated cubic exactly
// at its derivative roots; de Casteljau changes neither its geometry nor length.
// Keep the unmodified raw SVG/raster as a separately identified observation.
function splitReferencePath(tokens) {
  let cursor = { x: 0, y: 0 }, a = cursor, b = cursor, path = ''
  const text = ({ x, y }) => `${x} ${y}`
  const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const split = ([p, q, r, s], t) => {
    const pq = mix(p, q, t), qr = mix(q, r, t), rs = mix(r, s, t)
    const pqr = mix(pq, qr, t), qrs = mix(qr, rs, t), middle = mix(pqr, qrs, t)
    return [[p, pq, pqr, middle], [middle, qrs, rs, s]]
  }
  for (const { kind, x, y } of tokens) {
    const end = { x, y }
    if (kind === 'movetotoken') { path += ` M ${text(end)}`; cursor = end }
    else if (kind === 'curvetosupportatoken') a = end
    else if (kind === 'curvetosupportbtoken') b = end
    else if (kind === 'curvetotoken') {
      const roots = []
      for (const axis of ['x', 'y']) {
        const A = -cursor[axis] + 3 * a[axis] - 3 * b[axis] + end[axis]
        const B = 2 * (cursor[axis] - 2 * a[axis] + b[axis]), C = a[axis] - cursor[axis]
        if (Math.abs(A) < 1e-12) { if (Math.abs(B) > 1e-12) roots.push(-C / B) }
        else if (B * B - 4 * A * C >= 0) {
          const d = Math.sqrt(B * B - 4 * A * C)
          roots.push((-B - d) / (2 * A), (-B + d) / (2 * A))
        }
      }
      let remaining = [cursor, a, b, end], previous = 0
      const turns = [...new Set(roots.filter((t) => t > 1e-9 && t < 1 - 1e-9).map((t) => Math.round(t * 1e12) / 1e12))].sort((p, q) => p - q)
      for (const t of turns) {
        const [left, right] = split(remaining, (t - previous) / (1 - previous))
        path += ` C ${text(left[1])} ${text(left[2])} ${text(left[3])}`
        remaining = right; previous = t
      }
      path += ` C ${text(remaining[1])} ${text(remaining[2])} ${text(remaining[3])}`
      cursor = end
    } else if (kind === 'closepathtoken') path += ' Z'
    else if (kind === 'linetotoken') { path += ` L ${text(end)}`; cursor = end }
    else throw new Error(`Unexpected authenticated PGF token ${kind}`)
  }
  return path.trim()
}
const styles = [
  { id: 'butt-miter', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="butt" stroke-linejoin="miter"' },
  { id: 'round-round', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round"' },
  { id: 'square-bevel-dashed', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="square" stroke-linejoin="bevel" stroke-dasharray="3 2 1 2" stroke-dashoffset="1.3"' },
  { id: 'round-round-dashed', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 5" stroke-dashoffset="-2.7"' },
  { id: 'zero-area-fill', attributes: 'fill="black" stroke="none"' },
]
function observation(bytes) {
  const { width, height, rgba } = decodeConnectedPaintPng(bytes)
  let count = 0
  const bounds = { minX: width, minY: height, maxX: -1, maxY: -1 }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4] >= 127) continue
    count++
    bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y)
  }
  return { width, height, blackPixelCount: count, bounds: count ? bounds : null }
}
const records = [], artifactHashes = {}
for (const entry of references.cases) {
  const contour = entry.kind === 'node' ? solvePointNodeShape(entry).contours[0]
    : new ShapeContourBuilder(entry.rotation).move(ellipsePoint(entry.center, entry.rx, entry.ry, entry.start))
      .arc(entry.center, entry.rx, entry.ry, entry.start, entry.end).finish()
  const rawIndependentPath = referencePath(entry.paints[0].tokens)
  const independentPath = entry.kind === 'arc' ? splitReferencePath(entry.paints[0].tokens) : rawIndependentPath
  for (const style of entry.kind === 'node' ? styles : [styles[0], styles[3]]) {
    const record = { id: `${entry.id}-${style.id}`, caseId: entry.id, style, observations: {} }
    for (const [kind, path] of [['production', contour.path], ['pgf', independentPath],
      ...(entry.kind === 'arc' ? [['pgf-raw', rawIndependentPath]] : [])]) {
      const stem = `renders/${record.id}-${kind}`
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -40 80 80" width="800" height="800"><rect x="-40" y="-40" width="80" height="80" fill="white"/><path d="${path}" ${style.attributes}/></svg>\n`
      writeFileSync(`${root}${stem}.svg`, svg)
      const args = ['--output', `${root}${stem}.png`, `${root}${stem}.svg`]
      execFileSync(renderer, args)
      const png = readFileSync(`${root}${stem}.png`)
      artifactHashes[`${stem}.svg`] = hash(svg); artifactHashes[`${stem}.png`] = hash(png)
      record.observations[kind] = { path, svg: `${stem}.svg`, png: `${stem}.png`, command: [renderer, ...args], exitCode: 0, ...observation(png) }
    }
    records.push(record)
  }
}
assert.equal(records.length, 37)
writeFileSync(`${root}render-results.json`, JSON.stringify({ schema: 'stz-independent-zero-axis-render-v1',
  evidenceKind: 'Actual librsvg render of emitted production and independently parsed authenticated PGF paths; not native browser acceptance',
  partialReferenceNormalization: 'Only partial PGF cubics are subdivided exactly at derivative roots by independent de Casteljau interpolation; unmodified raw PGF SVG/PNG retained separately because Cairo drops solid coincident-endpoint cubic interior. Full ellipse PGF paths are unmodified.',
  rendererVersion, referenceSha256: hash(referenceBytes), rendererScriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  artifactHashes, records }, null, 2) + '\n')
console.log(JSON.stringify({ records: records.length, rendererVersion }))
