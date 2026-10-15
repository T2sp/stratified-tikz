/** Observe actual paint independently from PGF's recorded tokens and current output. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { solvePointNodeShape } from '../../../../src/geometry/pointNodeShapes/index.ts'
import { ShapeContourBuilder, ellipsePoint } from '../../../../src/geometry/pointNodeShapes/contours.ts'
import { decodeConnectedPaintPng } from '../../../../scripts/connectedLivePaintOracle.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const referenceBytes = readFileSync(`${root}references.json`), references = JSON.parse(referenceBytes)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const renderer = process.env.STZ_RSVG_CONVERT ?? '/opt/homebrew/bin/rsvg-convert'
const rendererVersion = execFileSync(renderer, ['--version'], { encoding: 'utf8' }).trim()
const styles = [
  { id: 'review-dash', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-dasharray="2 5" stroke-dashoffset="-2.7"' },
  { id: 'round-dash', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 2 1 2" stroke-dashoffset="1.3"' },
  { id: 'square-dash', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="square" stroke-linejoin="bevel" stroke-dasharray="2 5" stroke-dashoffset="0"' },
  { id: 'solid', attributes: 'fill="none" stroke="black" stroke-width=".4" stroke-linecap="butt" stroke-linejoin="miter"' },
  { id: 'fill', attributes: 'fill="black" stroke="none"' },
]
function pathFor(entry, absoluteAxes = false) {
  if (entry.kind === 'node') {
    const solution = solvePointNodeShape(entry)
    if (!absoluteAxes) return solution.contours[0].path
    const { x, y } = solution.signedFittedAxes
    const b = new ShapeContourBuilder().move({ x: Math.abs(x), y: 0 })
    return b.arc({ x: 0, y: 0 }, Math.abs(x), Math.abs(y), 0, 360).close().finish().path
  }
  const rx = absoluteAxes ? Math.abs(entry.rx) : entry.rx, ry = absoluteAxes ? Math.abs(entry.ry) : entry.ry
  const b = new ShapeContourBuilder(entry.rotation).move(ellipsePoint(entry.center, rx, ry, entry.start))
    .arc(entry.center, rx, ry, entry.start, entry.end)
  return (entry.closed ? b.close() : b).finish().path
}
function tokenPath(tokens) {
  let path = ''
  for (const { kind, x, y } of tokens) {
    if (kind === 'movetotoken') path += `M${x} ${y}`
    else if (kind === 'linetotoken') path += `L${x} ${y}`
    else if (kind === 'curvetosupportatoken') path += `C${x} ${y}`
    else if (kind === 'curvetosupportbtoken' || kind === 'curvetotoken') path += ` ${x} ${y}`
    else if (kind === 'closepathtoken') path += 'Z'
    else throw new Error(`Unexpected PGF path token ${kind}`)
  }
  return path
}
function mask(bytes) {
  const { width, height, rgba } = decodeConnectedPaintPng(bytes)
  assert.equal(width, 800); assert.equal(height, 800)
  return Uint8Array.from({ length: width * height }, (_, index) => rgba[index * 4] < 128 ? 1 : 0)
}
function difference(a, b) { return a.reduce((sum, value, index) => sum + (value === b[index] ? 0 : 1), 0) }
const records = [], artifactHashes = {}
mkdirSync(`${root}renders`, { recursive: true })
for (const entry of references.cases) for (const style of styles) {
  const productionPath = pathFor(entry), pgfPath = tokenPath(entry.paints[0].tokens)
  const paths = { production: productionPath, pgf: pgfPath }
  if (style.id === 'review-dash') {
    // The old implementation changed only sweep and left all signed endpoints.
    paths['old-sweep'] = productionPath.replace(/(A [-\d.e+]+ [-\d.e+]+ [-\d.e+]+ 0 )([01])( [-\d.e+]+ [-\d.e+]+)/g,
      (_, before, _sweep, after) => `${before}${entry.kind === 'node' || entry.end > entry.start ? 0 : 1}${after}`)
    paths['global-abs'] = pathFor(entry, true)
  }
  const observations = {}, masks = {}
  for (const [kind, path] of Object.entries(paths)) {
    const file = `renders/${entry.id}-${style.id}-${kind}`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="-40 -40 80 80"><rect x="-40" y="-40" width="80" height="80" fill="white"/><path d="${path}" ${style.attributes}/></svg>`
    writeFileSync(`${root}${file}.svg`, svg)
    const command = [renderer, '--output', `${file}.png`, `${file}.svg`]
    execFileSync(renderer, command.slice(1), { cwd: root })
    const pngBytes = readFileSync(`${root}${file}.png`)
    observations[kind] = { path, svg: `${file}.svg`, png: `${file}.png`, command, exitCode: 0,
      darkPixels: mask(pngBytes).reduce((sum, value) => sum + value, 0) }
    masks[kind] = mask(pngBytes)
    artifactHashes[`${file}.svg`] = hash(svg); artifactHashes[`${file}.png`] = hash(pngBytes)
  }
  records.push({ id: `${entry.id}-${style.id}`, caseId: entry.id, style, observations,
    darkMaskDifferencesFromPgf: Object.fromEntries(Object.entries(masks).map(([kind, value]) => [kind, difference(value, masks.pgf)])) })
}
const result = { schema: 'stz-independent-signed-traversal-render-v1', rendererVersion,
  referenceSha256: hash(referenceBytes), rendererScriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  productionSources: Object.fromEntries(['contours.ts', 'solve.ts'].map(file => [file, hash(readFileSync(new URL(`../../../../src/geometry/pointNodeShapes/${file}`, import.meta.url)))])),
  artifactHashes, records }
writeFileSync(`${root}render-results.json`, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ records: records.length, files: Object.keys(artifactHashes).length, rendererVersion,
  largestDarkMaskDifference: Math.max(...records.map(r => r.darkMaskDifferencesFromPgf.production)),
  review: records.find(r => r.id === 'review-mixed-axes-review-dash') }))
