import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import ts from 'typescript'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { dashCapMechanismCases, dashCapMechanismColumns, dashCapMechanismGrid, dashCapMechanismStem, dashLivePaintColumns, assertDashCapMechanismEntry, assertDashCapMechanismEvidence } from './pointDashCapMechanismContract.mjs'

// Node 22.12 supports this browser command but does not strip .ts by default.
// Use the existing TypeScript dependency for these two type-only-import pure
// modules. No generated checkout files, dependency, loader flag, or global
// command change is needed. Production strict checking remains a separate gate.
export async function loadDashMechanismGeometry() {
  const modules = []
  for (const file of ['dashCaps.ts', 'polygonStroke.ts']) {
    const source = await readFile(new URL(`../src/geometry/${file}`, import.meta.url), 'utf8')
    const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true } })
    const errors = (result.diagnostics ?? []).filter(({ category }) => category === ts.DiagnosticCategory.Error)
    if (errors.length) throw new Error(`Cannot load ${file}: ${errors.map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n')).join('\n')}`)
    // Both production modules intentionally have only erased type imports.
    // Reject a future runtime import rather than resolving relative to data:.
    const output = ts.createSourceFile(file.replace(/\.ts$/u, '.mjs'), result.outputText, ts.ScriptTarget.ES2022, false, ts.ScriptKind.JS)
    if (output.statements.some((node) => ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier)) throw new Error(`Unexpected runtime dependency in ${file}`)
    modules.push(await import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString('base64')}`))
  }
  return { createDashCaps: modules[0].createDashCaps, distanceToDashCaps: modules[0].distanceToDashCaps,
    createPolygonStrokeRegion: modules[1].createPolygonStrokeRegion, distanceToPolygonStroke: modules[1].distanceToPolygonStroke }
}

// The browser observes literal SVG without importing the production geometry.
// Geometry under test is evaluated afterward in Node against every saved cell.
async function observe(page, spec) {
  const browserVersion = page.context().browser()?.version() ?? 'unavailable'
  const observed = await boundedPointDiagnostic(() => page.evaluate(async ({ spec, browserVersion }) => {
    const ns = 'http://www.w3.org/2000/svg', resolution = 16, half = 64, side = 2048
    const svg = document.createElementNS(ns, 'svg'), polygon = document.createElementNS(ns, 'polygon')
    svg.setAttribute('data-stz-dash-mechanism', spec.key); svg.setAttribute('xmlns', ns)
    svg.setAttribute('viewBox', '-64 -64 128 128'); svg.setAttribute('width', '128'); svg.setAttribute('height', '128')
    svg.setAttribute('style', 'position:fixed;left:0;top:0;width:128px;height:128px;opacity:0;pointer-events:none')
    for (const [key, value] of Object.entries({ points: spec.points, fill: 'none', stroke: '#000000', 'stroke-width': spec.width,
      'stroke-dasharray': spec.pattern?.join(' ') ?? 'none', 'stroke-dashoffset': spec.phase, 'stroke-linecap': spec.cap, 'stroke-linejoin': spec.join, 'stroke-miterlimit': spec.miterLimit })) polygon.setAttribute(key, String(value))
    svg.append(polygon); document.body.append(svg)
    try {
      async function raster(contour) {
        const xml = `<svg xmlns="${ns}" width="${side}" height="${side}" viewBox="-${half} -${half} ${2 * half} ${2 * half}">${contour.outerHTML}</svg>`
        const image = new Image(), url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
        const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side
        const context = canvas.getContext('2d', { willReadFrequently: true })
        let timer
        try {
          image.src = url
          const decoded = image.decode().then(() => ({ ok: true }), (error) => ({ ok: false, error }))
          const outcome = await Promise.race([decoded, new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, error: new Error('Mechanism SVG decode exceeded 5000ms') }), 5000) })])
          if (!outcome.ok) throw outcome.error
          context.drawImage(image, 0, 0)
        } finally { clearTimeout(timer); URL.revokeObjectURL(url) }
        const bytes = context.getImageData(0, 0, side, side).data, boundary = []
        const alpha = (x, y) => x >= 0 && y >= 0 && x < side && y < side ? bytes[(y * side + x) * 4 + 3] : 0
        const at = ({ x, y }) => alpha(Math.floor((x + half) * resolution), Math.floor((y + half) * resolution))
        const core = ({ x, y }) => { const px = Math.floor((x + half) * resolution), py = Math.floor((y + half) * resolution); return [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => alpha(px + dx, py + dy) === 255)) }
        let bounds = null, radius = 0
        for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
          if (alpha(x, y) < 128) continue
          const p = { x: (x + .5) / resolution - half, y: (y + .5) / resolution - half }
          radius = Math.max(radius, Math.hypot(p.x, p.y))
          if (!bounds) bounds = { minX: p.x - .5 / resolution, minY: p.y - .5 / resolution, maxX: p.x + .5 / resolution, maxY: p.y + .5 / resolution }
          else { bounds.minX = Math.min(bounds.minX, p.x - .5 / resolution); bounds.minY = Math.min(bounds.minY, p.y - .5 / resolution); bounds.maxX = Math.max(bounds.maxX, p.x + .5 / resolution); bounds.maxY = Math.max(bounds.maxY, p.y + .5 / resolution) }
          if (alpha(x - 1, y) < 128 || alpha(x + 1, y) < 128 || alpha(x, y - 1) < 128 || alpha(x, y + 1) < 128) boundary.push(p)
        }
        const distance = (p) => at(p) >= 128 ? 0 : Math.sqrt(boundary.reduce((best, q) => Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2), Infinity))
        return { xml, png: canvas.toDataURL('image/png').split(',')[1], bounds, radius, at, core, distance }
      }
      const solid = polygon.cloneNode(true); solid.setAttribute('stroke-dasharray', 'none'); solid.setAttribute('stroke-dashoffset', '0')
      const paint = await raster(polygon), continuous = await raster(solid)
      const sample = (p) => {
        const paintDistance = paint.distance(p), solidDistance = continuous.distance(p), inside = polygon.isPointInFill(new DOMPoint(p.x, p.y)), minimum = Math.min(paintDistance, solidDistance)
        return [p.x, p.y, paint.at(p), continuous.at(p), Number.isFinite(paintDistance) ? paintDistance : null, solidDistance, inside,
          polygon.isPointInStroke(new DOMPoint(p.x, p.y)), paint.core(p), inside || minimum < 5.86 ? 'hit' : minimum > 6.14 ? 'miss' : 'uncertain']
      }
      const samples = []
      for (let y = -32; y <= 32; y += 2) for (let x = -32; x <= 32; x += 2) samples.push(sample({ x, y }))
      const css = getComputedStyle(polygon), matrix = polygon.getScreenCTM()
      return { native: { vertices: [...polygon.points].map(({ x, y }) => ({ x, y })), pathLength: polygon.getTotalLength(),
        browser: { version: browserVersion, userAgent: navigator.userAgent }, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])),
        stroke: { width: parseFloat(css.strokeWidth), pattern: css.strokeDasharray === 'none' ? null : css.strokeDasharray.split(/[ ,]+/u).map(parseFloat), phase: parseFloat(css.strokeDashoffset), cap: css.strokeLinecap, join: css.strokeLinejoin, miterLimit: Number(css.strokeMiterlimit), fill: css.fill } },
      raster: { resolution, half, side, uncertainty: .14, alphaThreshold: 128 }, paint: { bounds: paint.bounds, radius: paint.radius }, samples, probes: (spec.probes ?? []).map(sample),
      polygonMarkup: polygon.outerHTML, xml: paint.xml, png: paint.png, solidXml: continuous.xml, solidPng: continuous.png }
    } catch (error) { svg.remove(); throw error }
  }, { spec, browserVersion }), `native dash mechanism ${spec.key}`, 15000)
  return observed
}

// This captures the connected, visible SVG from Chrome's actual compositor.
// Decoding these PNG bytes is distinct from cloning SVG into an Image/canvas.
// Resolution 1 retains ordinary live layout; resolution 16 matches the clone
// raster calibration. Both retain their actual local-to-screen transforms.
async function observeLivePaint(page, spec, observed, save, progress) {
  const stem = `${dashCapMechanismStem}-${spec.key}`
  const livePaint = { method: 'actual live SVG screenshot PNG; no SVG reconstruction', sourceFile: `${stem}.live.svg`, sourcePoints: spec.points,
    columns: dashLivePaintColumns, captures: [], rasterCoreContainmentDisagreements: observed.samples.filter((row) => row[8] && !row[7]).map((row) => ({ x: row[0], y: row[1] })) }
  await progress(livePaint)
  for (const scale of [1, 16]) {
    const side = 128 * scale
    const metadata = await boundedPointDiagnostic(() => page.evaluate(({ scale, markup }) => {
      const svg = document.querySelector('[data-stz-dash-mechanism]'), polygon = svg.querySelector('polygon'), side = 128 * scale
      svg.setAttribute('style', `position:fixed;left:0;top:0;width:${side}px;height:${side}px;opacity:1;pointer-events:none;background:#fff;z-index:2147483647`)
      const css = getComputedStyle(polygon), matrix = polygon.getScreenCTM()
      return { scale, side, viewport: { width: innerWidth, height: innerHeight }, sourceUnchanged: polygon.outerHTML === markup,
        ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])),
        vertices: [...polygon.points].map(({ x, y }) => ({ x, y })), pathLength: polygon.getTotalLength(), xml: svg.outerHTML,
        stroke: { width: parseFloat(css.strokeWidth), pattern: css.strokeDasharray === 'none' ? null : css.strokeDasharray.split(/[ ,]+/u).map(parseFloat), phase: parseFloat(css.strokeDashoffset), cap: css.strokeLinecap, join: css.strokeLinejoin, miterLimit: Number(css.strokeMiterlimit), fill: css.fill } }
    }, { scale, markup: observed.polygonMarkup }), `live mechanism ${spec.key} scale ${scale} source`, 5000)
    const clip = { x: 0, y: 0, width: side, height: side }, file = `${stem}.live-scale-${scale}.png`
    const png = await boundedPointDiagnostic(() => page.screenshot({ clip, scale: 'css', animations: 'disabled', timeout: 5000 }), `live mechanism ${spec.key} scale ${scale} screenshot`, 5000)
    await save(file, png)
    const decoded = await boundedPointDiagnostic(() => page.evaluate(async ({ png, scale, samples, probes, markup }) => {
      const image = new Image(); image.src = `data:image/png;base64,${png}`
      let timer
      try { await Promise.race([image.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Live mechanism PNG decode exceeded 5000ms')), 5000) })]) } finally { clearTimeout(timer) }
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0)
      const bytes = context.getImageData(0, 0, image.width, image.height).data, svg = document.querySelector('[data-stz-dash-mechanism]'), polygon = svg.querySelector('polygon')
      const rgba = (x, y) => [...bytes.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]
      const sample = ([x, y]) => {
        const pixelX = Math.floor((x + 64) * scale), pixelY = Math.floor((y + 64) * scale)
        const blackCore = [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => { const pixel = rgba(pixelX + dx, pixelY + dy); return pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 255 }))
        return [x, y, ...rgba(pixelX, pixelY), blackCore, polygon.isPointInStroke(new DOMPoint(x, y))]
      }
      const matrix = polygon.getScreenCTM()
      return { width: image.width, height: image.height, sourceUnchanged: polygon.outerHTML === markup,
        afterCtm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])), samples: samples.map(sample), probes: probes.map(sample) }
    }, { png: png.toString('base64'), scale, samples: observed.samples, probes: observed.probes, markup: observed.polygonMarkup }), `live mechanism ${spec.key} scale ${scale} PNG samples`, 6000)
    const { xml, ...source } = metadata
    if (scale === 16) { await save(livePaint.sourceFile, xml); livePaint.sourceSha256 = createHash('sha256').update(xml).digest('hex') }
    const containmentChanges = (originals, rows) => rows.filter((row, index) => row[7] !== originals[index][7]).map((row) => ({ x: row[0], y: row[1], before: !row[7], after: row[7] }))
    livePaint.captures.push({ ...source, ...decoded, containmentResolutionChanges: { samples: containmentChanges(observed.samples, decoded.samples), probes: containmentChanges(observed.probes, decoded.probes) }, sourceUnchanged: source.sourceUnchanged && decoded.sourceUnchanged, file, clip, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') })
    await progress(livePaint)
  }
  return livePaint
}

export async function runPointDashCapMechanismChecks({ page, artifactDir }) {
  const evidence = { result: 'observed', scope: 'supplemental native SVG geometry; App pointer matrix remains separately required', cases: [] }
  const save = (name, data) => boundedPointDiagnostic(() => writeFile(resolve(artifactDir, name), data), `write ${name}`, 5000)
  const persist = () => save(`${dashCapMechanismStem}.json`, JSON.stringify(evidence, null, 2) + '\n')
  const originalViewport = page.viewportSize()
  let geometry
  try {
    await page.setViewportSize({ width: Math.max(2048, originalViewport.width), height: Math.max(2048, originalViewport.height) })
    geometry = await boundedPointDiagnostic(loadDashMechanismGeometry, 'load production dash geometry', 5000) }
  catch (error) {
    evidence.result = 'failed'; evidence.error = { message: error.message, stack: error.stack }
    try { await persist() } catch (writeError) { console.error('Dash mechanism loader failure evidence:', writeError) }
    try { await page.setViewportSize(originalViewport) } catch (cleanupError) { console.error('Dash mechanism viewport cleanup:', cleanupError) }
    throw error
  }
  const { createDashCaps, distanceToDashCaps, createPolygonStrokeRegion, distanceToPolygonStroke } = geometry
  let primary
  for (const spec of dashCapMechanismCases) {
    const stem = `${dashCapMechanismStem}-${spec.key}`
    const vertices = spec.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y } })
    const entry = { key: spec.key, result: 'observed', specification: spec, source: { kind: 'literal-independent-SVG', rawPoints: spec.points, vertices, model: spec.model ?? null } }
    evidence.cases.push(entry)
    try {
      const observed = await observe(page, spec)
      for (const [suffix, content] of [['input.svg', observed.xml], ['raster.png', Buffer.from(observed.png, 'base64')], ['solid.input.svg', observed.solidXml], ['solid.raster.png', Buffer.from(observed.solidPng, 'base64')]]) await save(`${stem}.${suffix}`, content)
      // Persist the clone/native contradictions before live capture can fail.
      Object.assign(entry, { native: observed.native, raster: observed.raster, paint: observed.paint, observedSamples: observed.samples, observedProbes: observed.probes })
      await save(`${stem}.json`, JSON.stringify(entry, null, 2) + '\n'); await persist()
      const solid = createPolygonStrokeRegion(vertices, spec.width, spec.join, spec.miterLimit)
      const caps = createDashCaps({ kind: 'polygon', radius: 0, vertices }, spec.width, spec.pattern ?? undefined, spec.phase, spec.cap)
      const bounds = { ...solid.bounds }
      if (caps.bounds) for (const key of ['minX', 'minY', 'maxX', 'maxY']) bounds[key] = key.startsWith('min') ? Math.min(bounds[key], caps.bounds[key]) : Math.max(bounds[key], caps.bounds[key])
      const compare = (row) => {
        const point = { x: row[0], y: row[1] }, capDistance = distanceToDashCaps(point, caps)
        const geometryDistance = Math.min(distanceToPolygonStroke(point, solid), capDistance)
        return [...row, geometryDistance, Number.isFinite(capDistance) ? capDistance : null, row[6] || geometryDistance <= 6]
      }
      const samples = observed.samples.map(compare), probes = observed.probes.map(compare)
      Object.assign(entry, { native: observed.native, raster: observed.raster, paint: observed.paint, grid: dashCapMechanismGrid, columns: dashCapMechanismColumns,
        geometry: { bounds, radius: Math.max(solid.radius, caps.radius), capBounds: caps.bounds, capRadius: caps.radius, familyCount: caps.families.length }, samples, probes,
        counts: { hits: samples.filter((r) => r[9] === 'hit').length, misses: samples.filter((r) => r[9] === 'miss').length, uncertain: samples.filter((r) => r[9] === 'uncertain').length },
        mismatches: samples.filter((r) => r[9] !== 'uncertain' && r[12] !== (r[9] === 'hit')).map((r) => ({ local: { x: r[0], y: r[1] }, expected: r[9], hit: r[12] })) })
      delete entry.observedSamples; delete entry.observedProbes
      await save(`${stem}.json`, JSON.stringify(entry, null, 2) + '\n'); await persist()
      entry.livePaint = await observeLivePaint(page, spec, observed, save, async (livePaint) => { entry.livePaint = livePaint; await save(`${stem}.json`, JSON.stringify(entry, null, 2) + '\n'); await persist() })
      assertDashCapMechanismEntry({ ...entry, result: 'passed' }, spec)
      entry.result = 'passed'
    } catch (error) {
      primary ??= error; entry.result = 'failed'; entry.error = { message: error.message, stack: error.stack }
    }
    try { await boundedPointDiagnostic(() => page.evaluate(() => document.querySelector('[data-stz-dash-mechanism]')?.remove()), `remove mechanism ${spec.key}`, 5000) }
    catch (error) { if (primary) console.error('Dash mechanism cleanup:', error); else { primary = error; entry.result = 'failed'; entry.error = { message: error.message, stack: error.stack } } }
    try { await save(`${stem}.json`, JSON.stringify(entry, null, 2) + '\n'); await persist() }
    catch (error) { if (primary) console.error('Dash mechanism failure evidence:', error); else primary = error }
  }
  try { await page.setViewportSize(originalViewport) } catch (error) { if (primary) console.error('Dash mechanism viewport cleanup:', error); else primary = error }
  evidence.result = primary ? 'failed' : 'passed'
  try { await persist() } catch (error) { if (primary) console.error('Dash mechanism final evidence:', error); else primary = error }
  if (primary) throw primary
  assertDashCapMechanismEvidence(evidence)
  return evidence
}
