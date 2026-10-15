import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { compareConformancePng, pgfConformancePath, assertConformancePaintProbe, conformanceProbeSvg, oldConformancePath } from './pointConformanceContract.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
// Render actual connected/reopened DOM path tokens and independent raw PGF
// tokens in the same bounded image frame. This never asks the solver for an
// oracle, changes the live DOM/model, or substitutes for the actual download.
export async function captureConformancePaint({ page, key, stage, stem, artifactDir, contour, reference, retain }) {
  const actualPath = contour.attributes.d, pgfPath = pgfConformancePath(reference), oldPath = oldConformancePath(key, actualPath)
  assert.notEqual(actualPath, oldPath)
  const probe = { key, stage, reference, observedContour: structuredClone(contour), actualPath, pgfPath, oldPath }
  for (const [kind, path] of [['actual', actualPath], ['pgf', pgfPath], ['old', oldPath]]) {
    const svg = conformanceProbeSvg(key, path, contour.attributes), svgPath = resolve(artifactDir, `${stem}-${stage}-${kind}.input.svg`)
    await writeFile(svgPath, svg)
    probe[kind] = { svg, svgSha256: hash(svg), svgPath }
    await retain(probe)
    const base64 = await boundedPointDiagnostic(() => page.evaluate(async svg => {
      // Data images avoid adding blob requests to the actual downloaded file's
      // unfiltered request ledger while retaining these exact SVG input bytes.
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      let image, timer
      try {
        image = new Image()
        await new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Independent conformance image deadline')), 4000)
          image.onload = resolve; image.onerror = () => reject(new Error('Independent conformance SVG failed')); image.src = url
        })
        // Reopened exports are SVG/XML documents; their createElement() does
        // not construct an HTMLCanvasElement. Keep the raster surface in XHTML.
        const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas'); canvas.width = 800; canvas.height = 800
        const context = canvas.getContext('2d'); if (!context) throw new Error('Missing bounded paint-probe context')
        context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, 800, 800); context.drawImage(image, 0, 0)
        return canvas.toDataURL('image/png').split(',')[1]
      } finally { clearTimeout(timer); if (image) { image.onload = null; image.onerror = null; image.src = '' } }
    }, svg), `Conformance ${stage} ${kind} paint`, 5000)
    const png = Buffer.from(base64, 'base64'), pngPath = resolve(artifactDir, `${stem}-${stage}-${kind}.png`)
    await writeFile(pngPath, png); Object.assign(probe[kind], { pngPath, pngSha256: hash(png), bytes: png.length })
    await retain(probe)
  }
  const { readFile } = await import('node:fs/promises')
  const actual = await readFile(probe.actual.pngPath), pgf = await readFile(probe.pgf.pngPath), old = await readFile(probe.old.pngPath)
  probe.comparison = compareConformancePng(actual, pgf); probe.negativeControl = compareConformancePng(old, pgf)
  await retain(probe)
  assertConformancePaintProbe(probe, artifactDir, stem, stage)
  return probe
}
