import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runPointDashCapMechanismChecks } from './checkPointDashCapMechanism.mjs'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { dashCapScenario, dashCapCases, dashCapScales, dashCapEditFields, triangleDashPhaseNegatives, dashCapProbeIsMiss, assertDashCapEvidence, assertDashCapObservation, assertDashCapEntry } from './pointDashCapContract.mjs'
const paint = (spec) => ({ text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#000000', opacity: 1 },
  stroke: { enabled: true, color: '#000000', opacity: 1, width: spec.widthPt, lineStyle: spec.lineStyle,
    ...(spec.pattern ? { dashPattern: spec.pattern } : {}), dashPhase: spec.phase, lineCap: 'rect', lineJoin: 'bevel' } })

// Native SVG image rasterization is independent from production stroke geometry.
async function observe(page, spec) {
  await page.evaluate(() => window.stzLabels.select({ kind: 'stratum', id: 'p' }))
  const browserVersion = page.context().browser()?.version() ?? 'unavailable'
  return page.evaluate(async ({ spec, browserVersion }) => {
    const contour = document.querySelector('[data-point-id="p"] [data-point-contour]'), point = contour.parentElement
    const css = getComputedStyle(contour), resolution = 16, half = 90, side = 2 * half * resolution
    const clean = contour.cloneNode(true)
    for (const attribute of [...clean.attributes]) if (attribute.name.startsWith('data-')) clean.removeAttribute(attribute.name)
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="-${half} -${half} ${2 * half} ${2 * half}">${clean.outerHTML}</svg>`
    const image = new Image(), url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side
    const context = canvas.getContext('2d', { willReadFrequently: true })
    try { image.src = url; await image.decode(); context.drawImage(image, 0, 0) } finally { URL.revokeObjectURL(url) }
    const bytes = context.getImageData(0, 0, side, side).data
    const alpha = (x, y) => x >= 0 && y >= 0 && x < side && y < side ? bytes[(y * side + x) * 4 + 3] : 0
    const at = (p) => alpha(Math.floor((p.x + half) * resolution), Math.floor((p.y + half) * resolution))
    const boundary = [], rasterBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    let rasterRadius = 0, coreRadius = 0, core = null
    for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
      if (alpha(x, y) < 128) continue
      const p = { x: (x + .5) / resolution - half, y: (y + .5) / resolution - half }, r = Math.hypot(p.x, p.y)
      rasterBounds.minX = Math.min(rasterBounds.minX, p.x - .5 / resolution); rasterBounds.minY = Math.min(rasterBounds.minY, p.y - .5 / resolution)
      rasterBounds.maxX = Math.max(rasterBounds.maxX, p.x + .5 / resolution); rasterBounds.maxY = Math.max(rasterBounds.maxY, p.y + .5 / resolution)
      rasterRadius = Math.max(rasterRadius, r)
      if ([-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => alpha(x + dx, y + dy) === 255)) && r > coreRadius) { core = p; coreRadius = r }
      if (alpha(x - 1, y) < 128 || alpha(x + 1, y) < 128 || alpha(x, y - 1) < 128 || alpha(x, y + 1) < 128) boundary.push(p)
    }
    const distance = (p) => at(p) >= 128 ? 0 : Math.sqrt(boundary.reduce((best, q) => Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2), Infinity))
    let engineAudit, solidXml, solidRasterPng, solidDistanceAt
    if (spec.audit) {
      const solid = clean.cloneNode(true); solid.setAttribute('stroke-dasharray', 'none'); solid.setAttribute('stroke-dashoffset', '0')
      solidXml = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="-${half} -${half} ${2 * half} ${2 * half}">${solid.outerHTML}</svg>`
      const solidImage = new Image(), solidUrl = URL.createObjectURL(new Blob([solidXml], { type: 'image/svg+xml' }))
      const solidCanvas = document.createElement('canvas'); solidCanvas.width = side; solidCanvas.height = side
      const solidContext = solidCanvas.getContext('2d', { willReadFrequently: true })
      try { solidImage.src = solidUrl; await solidImage.decode(); solidContext.drawImage(solidImage, 0, 0) } finally { URL.revokeObjectURL(solidUrl) }
      const solidBytes = solidContext.getImageData(0, 0, side, side).data
      const solidAlpha = (x, y) => x >= 0 && y >= 0 && x < side && y < side ? solidBytes[(y * side + x) * 4 + 3] : 0
      const solidAt = (p) => solidAlpha(Math.floor((p.x + half) * resolution), Math.floor((p.y + half) * resolution))
      const solidBoundary = []
      for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
        if (solidAlpha(x, y) >= 128 && (solidAlpha(x - 1, y) < 128 || solidAlpha(x + 1, y) < 128 || solidAlpha(x, y - 1) < 128 || solidAlpha(x, y + 1) < 128)) {
          solidBoundary.push({ x: (x + .5) / resolution - half, y: (y + .5) / resolution - half })
        }
      }
      const solidDistance = (p) => solidAt(p) >= 128 ? 0 : Math.sqrt(solidBoundary.reduce((best, q) => Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2), Infinity))
      solidDistanceAt = solidDistance
      const samples = []
      for (let y = -32; y <= 32; y += 2) for (let x = -32; x <= 32; x += 2) {
        const local = { x, y }, pixelX = Math.floor((x + half) * resolution), pixelY = Math.floor((y + half) * resolution)
        const paintDistance = distance(local), continuousDistance = solidDistance(local), insideContour = contour.isPointInFill(new DOMPoint(x, y))
        const minimum = Math.min(paintDistance, continuousDistance)
        samples.push({ local, point: { x: 450 + x, y: 350 + y }, paintAlpha: at(local), solidAlpha: solidAt(local), paintDistance, solidDistance: continuousDistance,
          paintCore: [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => alpha(pixelX + dx, pixelY + dy) === 255)),
          insideContour, nativeStrokeContains: contour.isPointInStroke(new DOMPoint(x, y)),
          expected: insideContour || minimum < 6 - .14 ? 'hit' : minimum > 6 + .14 ? 'miss' : 'uncertain' })
      }
      const before = window.stzLabels.state()
      const actual = window.stzLabels.emptyPointSelectionCandidates(samples.map(({ point }) => point))
      const after = window.stzLabels.state()
      samples.forEach((sample, index) => { sample.candidates = actual[index].candidates })
      const mismatches = samples.filter((sample) => sample.expected !== 'uncertain' && (sample.candidates.includes('p') !== (sample.expected === 'hit') || sample.candidates.some((id) => id !== 'p')))
        .map(({ local, expected, candidates }) => ({ local, expected, candidates }))
      const originalVertices = [...contour.points].map(({ x, y }) => ({ x, y }))
      engineAudit = { model: before.points.find(({ id }) => id === 'p'), rawPoints: contour.getAttribute('points'), pathLength: contour.getTotalLength(),
        browser: { version: browserVersion, userAgent: navigator.userAgent },
        raster: { resolution, half, side, uncertainty: .14, alphaThreshold: 128 }, grid: { min: -32, max: 32, step: 2, size: 33, samples: 1089, uncertainty: .14 },
        modelUnchanged: before.json === after.json && before.history === after.history, originalVertices,
        solidControl: { fill: solid.getAttribute('fill'), pattern: solid.getAttribute('stroke-dasharray'), strokeWidth: Number(solid.getAttribute('stroke-width')), join: solid.getAttribute('stroke-linejoin'), vertices: [...solid.points].map(({ x, y }) => ({ x, y })) },
        counts: { hits: samples.filter(({ expected }) => expected === 'hit').length, misses: samples.filter(({ expected }) => expected === 'miss').length, uncertain: samples.filter(({ expected }) => expected === 'uncertain').length },
        samples, mismatches }
      solidRasterPng = solidCanvas.toDataURL('image/png').split(',')[1]
    }
    const probes = [{ kind: 'paint', local: core }, { kind: 'outside', local: spec.exterior }, { kind: 'interior', local: { x: 0, y: 0 } },
      ...(spec.exact ?? []).map((local, i) => ({ kind: `exact-${i}`, local })),
      ...(spec.phaseNegatives ?? []).map((local, i) => ({ kind: `phase-outside-${i}`, local }))]
    if (engineAudit) {
      const cap = engineAudit.samples.filter((sample) => sample.paintCore && sample.solidDistance > .3 && !sample.insideContour)
        .sort((a, b) => Number(a.candidates.includes('p')) - Number(b.candidates.includes('p')) || b.solidDistance - a.solidDistance)[0]
      const outside = engineAudit.samples.filter((sample) => sample.expected === 'miss' && sample.paintDistance > 6.14 && sample.solidDistance > 6.14)
        .sort((a, b) => Number(b.candidates.includes('p')) - Number(a.candidates.includes('p')) || Math.min(a.paintDistance, a.solidDistance) - Math.min(b.paintDistance, b.solidDistance))[0]
      if (!cap || !outside) throw new Error('Missing independent native cap/outer audit witnesses')
      probes.push({ kind: 'audit-cap', local: cap.local }, { kind: 'audit-outside', local: outside.local })
    }
    const radius = contour.localName === 'circle' ? contour.r.baseVal.value : Number(contour.getAttribute('data-point-circle-radius')) || null
    if (spec.gap) {
      const gaps = Array.from({ length: 720 }, (_, i) => ({ x: radius * Math.cos(i * Math.PI / 360), y: radius * Math.sin(i * Math.PI / 360) }))
        .filter((p) => at(p) === 0).map((p) => ({ p, d: distance(p) })).sort((a, b) => b.d - a.d)
      if (!gaps.length) throw new Error('Sparse circle has no independent raster gap')
      probes.push({ kind: 'gap', local: gaps[0].p })
    }
    // A bevel join and each continuous segment stay within the vertex support
    // bounds expanded by half the width. This independently proves a lower
    // distance bound without invoking production geometry or synthesizing paint.
    const solidSupport = spec.phaseNegatives ? { method: 'independent continuous-bevel support bound', vertices: [...contour.points].map(({ x, y }) => ({ x, y })),
      strokeWidth: parseFloat(css.strokeWidth), join: css.strokeLinejoin, halfWidth: parseFloat(css.strokeWidth) / 2, minVertexY: Math.min(...[...contour.points].map(({ y }) => y)) } : undefined
    if (solidSupport) solidSupport.minY = solidSupport.minVertexY - solidSupport.halfWidth
    const matrix = contour.getScreenCTM(), declaredBounds = point.getAttribute('data-point-painted-bounds').split(' ').map(Number)
    return { solidSupport, engineAudit, solidXml, solidRasterPng, xml, rasterPng: canvas.toDataURL('image/png').split(',')[1], resolution, radius, rasterRadius, rasterBounds, declaredBounds,
      contourKind: contour.localName, vertexCount: contour.localName === 'polygon' ? contour.points.length : 0,
      selectionRadius: Number(point.querySelector('[data-svg-export-exclude]').getAttribute('r')) - 6,
      boundsEnclosePaint: ['minX', 'minY', 'maxX', 'maxY'].every((key, i) => i < 2 ? declaredBounds[i] <= rasterBounds[key] + .14 : declaredBounds[i] >= rasterBounds[key] - .14),
      boundaryPixelCount: boundary.length, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])),
      strokeWidth: parseFloat(css.strokeWidth), cap: css.strokeLinecap, join: css.strokeLinejoin, pattern: css.strokeDasharray, phase: parseFloat(css.strokeDashoffset), fill: css.fill, miterLimit: Number(css.strokeMiterlimit),
      source: point.querySelector('[data-label-state]').getAttribute('data-label-source'), bodyStatus: point.querySelector('[data-label-state]').getAttribute('data-label-state'),
      probes: probes.map((probe) => ({ ...probe, alpha: at(probe.local), rasterDistance: distance(probe.local), ...(solidDistanceAt ? { solidDistance: solidDistanceAt(probe.local) } : {}), ...(solidSupport ? { solidDistanceLowerBound: Math.max(0, solidSupport.minY - probe.local.y) } : {}), nativeStrokeContains: contour.isPointInStroke(new DOMPoint(probe.local.x, probe.local.y)) })) }
  }, { spec, browserVersion })
}
// This observes the actual App DOM paint. PNG decoding does not reconstruct SVG,
// and the zoom changes only the root framing while retaining the same contour.
async function observeLivePaint(page, artifactDir, stem, observation, persist) {
  await boundedPointDiagnostic(() => page.evaluate(() => window.stzLabels.select(null)), 'App live paint clear selection', 5000)
  const saved = await boundedPointDiagnostic(() => page.evaluate(() => {
    const root = document.querySelector('svg.svg-diagram'), state = window.stzLabels.state()
    return { style: root.getAttribute('style'), viewBox: root.getAttribute('viewBox'), json: state.json, history: state.history }
  }), 'App live paint original framing', 5000)
  const captures = []
  const live = { captures, restored: false, modelUnchanged: false,
    disagreements: observation.engineAudit.samples.filter((sample) => sample.paintCore && !sample.nativeStrokeContains).map(({ local }) => local) }
  observation.livePaint = live
  await persist()
  let primary
  try {
    for (const zoom of [false, true]) {
      if (zoom) await boundedPointDiagnostic(() => page.evaluate(() => {
        const root = document.querySelector('svg.svg-diagram')
        root.setAttribute('viewBox', '416 316 68 68')
        Object.assign(root.style, { width: '1088px', height: '1088px', position: 'fixed', left: '0', top: '0', zIndex: '2147483647', transform: '' })
      }), 'App live paint magnified framing', 5000)
      const before = await boundedPointDiagnostic(() => page.evaluate(() => {
        const contour = document.querySelector('[data-point-id="p"] [data-point-contour]'), css = getComputedStyle(contour), matrix = contour.getScreenCTM()
        const state = window.stzLabels.state()
        return { rawPoints: contour.getAttribute('points'), vertices: [...contour.points].map(({ x, y }) => ({ x, y })), pathLength: contour.getTotalLength(),
          ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])), selection: state.selection,
          stroke: { width: parseFloat(css.strokeWidth), pattern: css.strokeDasharray, phase: parseFloat(css.strokeDashoffset), cap: css.strokeLinecap, join: css.strokeLinejoin, fill: css.fill, miterLimit: Number(css.strokeMiterlimit), color: css.stroke, opacity: Number(css.strokeOpacity) },
          source: contour.outerHTML, overlays: contour.parentElement.querySelectorAll('[data-svg-export-exclude]').length }
      }), 'App live paint source before screenshot', 5000)
      const screenshot = `${stem}-${zoom ? 'live-zoom' : 'live'}.screen.png`
      const capture = { ...before, screenshot, zoom, method: 'actual App screenshot PNG; no SVG reconstruction', status: 'observed' }
      captures.push(capture); await persist()
      const png = await page.screenshot({ path: resolve(artifactDir, screenshot), timeout: 5000, scale: 'css' })
      Object.assign(capture, { status: 'captured', bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') }); await persist()
      const pixels = await boundedPointDiagnostic(() => page.evaluate(async ({ png, samples, ctm }) => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`
        let timer
        try { await Promise.race([image.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('App live PNG decode exceeded 5000ms')), 5000) })]) }
        finally { clearTimeout(timer) }
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0)
        const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data
        return { width: canvas.width, height: canvas.height, samples: samples.map(({ local }) => {
          const screen = { x: ctm.a * local.x + ctm.c * local.y + ctm.e, y: ctm.b * local.x + ctm.d * local.y + ctm.f }
          const pixel = { x: Math.floor(screen.x), y: Math.floor(screen.y) }
          if (pixel.x < 0 || pixel.y < 0 || pixel.x >= canvas.width || pixel.y >= canvas.height) throw new Error('App live sample is outside screenshot')
          const offset = (pixel.y * canvas.width + pixel.x) * 4
          return { local, screen, pixel, rgba: [...bytes.slice(offset, offset + 4)] }
        }) }
      }, { png: png.toString('base64'), samples: observation.engineAudit.samples.map(({ local }) => ({ local })), ctm: before.ctm }), 'App live PNG inspection', 6000)
      const after = await boundedPointDiagnostic(() => page.evaluate(() => {
        const contour = document.querySelector('[data-point-id="p"] [data-point-contour]'), matrix = contour.getScreenCTM()
        return { source: contour.outerHTML, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])) }
      }), 'App live paint source after screenshot', 5000)
      Object.assign(capture, { status: 'inspected', sourceUnchanged: before.source === after.source, afterCtm: after.ctm, ...pixels }); await persist()
    }
  } catch (error) {
    primary = error; live.error = { message: error.message }
    try { await boundedPointDiagnostic(persist, 'App live paint failure evidence') } catch (diagnosticError) { console.error('App live paint failure evidence:', diagnosticError) }
    throw error
  } finally {
    try {
      const restored = await boundedPointDiagnostic(() => page.evaluate((saved) => {
        const root = document.querySelector('svg.svg-diagram')
        for (const [key, value] of [['style', saved.style], ['viewBox', saved.viewBox]]) value === null ? root.removeAttribute(key) : root.setAttribute(key, value)
        const state = window.stzLabels.state(), matrix = document.querySelector('[data-point-id="p"] [data-point-contour]').getScreenCTM()
        return { style: root.getAttribute('style'), viewBox: root.getAttribute('viewBox'), json: state.json, history: state.history, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])) }
      }, saved), 'App live paint framing restoration')
      Object.assign(live, { restored: saved.style === restored.style && saved.viewBox === restored.viewBox, modelUnchanged: saved.json === restored.json && saved.history === restored.history, restoredCtm: restored.ctm })
      await boundedPointDiagnostic(persist, 'App live paint restoration evidence')
    } catch (error) { if (!primary) primary = error; else console.error('App live framing cleanup:', error) }
  }
  if (primary) throw primary
  return live
}

export async function runPointDashCapChecks({ page, artifactDir, begin, saved, diagnose }) {
  begin(dashCapScenario)
  const originalViewport = page.viewportSize(), cases = []
  let primary
  const state = () => page.evaluate(() => window.stzLabels.state())
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const rasterFiles = async (stem, observation) => {
    await writeFile(resolve(artifactDir, `${stem}.input.svg`), observation.xml)
    await writeFile(resolve(artifactDir, `${stem}.raster.png`), Buffer.from(observation.rasterPng, 'base64'))
    delete observation.rasterPng
    if (observation.engineAudit) {
      await writeFile(resolve(artifactDir, `${stem}-solid.input.svg`), observation.solidXml)
      await writeFile(resolve(artifactDir, `${stem}-solid.raster.png`), Buffer.from(observation.solidRasterPng, 'base64'))
      await writeFile(resolve(artifactDir, `${stem}-engine-audit.json`), JSON.stringify(observation.engineAudit, null, 2) + '\n')
      delete observation.solidRasterPng
    }
  }
  async function pointerProbe(probe, screenshot, persist, spec) {
    await page.evaluate((local) => { window.stzLabels.select(null); window.stzLabels.mutatePoint('control', { position: { x: local.x / 100, y: -local.y / 100, z: 0 } }) }, probe.local)
    await settle()
    const transform = await page.evaluate((local) => {
      const svg = document.querySelector('svg.svg-diagram'), contour = document.querySelector('[data-point-id="p"] [data-point-contour]')
      svg.style.transform = ''
      const before = new DOMPoint(local.x, local.y).matrixTransform(contour.getScreenCTM())
      svg.style.transform = `translate(${Math.round(before.x) - before.x}px, ${Math.round(before.y) - before.y}px)`
      const m = contour.getScreenCTM(), p = new DOMPoint(local.x, local.y).matrixTransform(m), clear = new DOMPoint(8, 8).matrixTransform(svg.getScreenCTM())
      return { screen: { x: Math.round(p.x), y: Math.round(p.y) }, clear: { x: clear.x, y: clear.y }, ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, m[key]])) }
    }, probe.local)
    probe.transform = transform
    await page.mouse.click(transform.clear.x, transform.clear.y); assert.equal((await state()).selection, null); probe.selectionCleared = true
    const before = await state()
    await page.evaluate(() => { window.stzDashClicks = window.stzLabels.observeEmptyPointSelectionClicks() })
    let primary
    try {
      for (const alt of [false, true, true, true]) {
        if (probe.actions.length === 1) { await page.mouse.click(transform.clear.x, transform.clear.y); assert.equal((await state()).selection, null) }
        if (alt) await page.keyboard.down('Alt')
        try { await page.mouse.click(transform.screen.x, transform.screen.y) } finally { if (alt) await page.keyboard.up('Alt') }
        const action = await page.evaluate(() => ({ ...window.stzDashClicks.read().at(-1), selection: window.stzLabels.state().selection, feedback: document.querySelector('.svg-selection-cycle-feedback text')?.textContent ?? null }))
        action.screen = transform.screen; probe.actions.push(action); await persist()
        assert.deepEqual([...action.candidates].sort(), dashCapProbeIsMiss(spec, probe.kind) ? ['control'] : ['control', 'p'])
      }
      const after = await state(); assert.equal(before.json, after.json); assert.equal(before.history, after.history)
      probe.screenshot = screenshot; await page.screenshot({ path: resolve(artifactDir, probe.screenshot), timeout: 5000 }); await persist()
    } catch (error) {
      primary = error
      probe.failure = { message: error.message }
      probe.screenshot = screenshot
      try { await boundedPointDiagnostic(() => page.screenshot({ path: resolve(artifactDir, screenshot), timeout: 5000 }), 'dash-cap pointer failure screenshot', 5000) }
      catch (captureError) { probe.failure.screenshot = captureError.message }
      try { await boundedPointDiagnostic(persist, 'dash-cap pointer failure evidence') }
      catch (diagnosticError) { console.error('Dash-cap pointer failure diagnostics:', diagnosticError) }
      throw error
    } finally {
      try { await boundedPointDiagnostic(() => page.evaluate(() => { window.stzDashClicks.dispose(); delete window.stzDashClicks }), 'dash-cap pointer listener cleanup') }
      catch (cleanupError) { if (!primary) throw cleanupError; console.error('Dash-cap pointer listener cleanup:', cleanupError) }
    }
  }
  try {
    await page.setViewportSize({ width: 1500, height: 1150 })
    for (const spec of dashCapCases) for (const scale of dashCapScales) {
      const finalPaint = paint(spec), stem = `${dashCapScenario}-${spec.key}-scale-${scale}`
      const entry = { key: spec.key, scale, specification: spec, result: 'observed', edits: [], probes: [], modelUnchanged: true }; cases.push(entry)
      const persist = async () => { await writeFile(resolve(artifactDir, `${stem}.json`), JSON.stringify(entry, null, 2) + '\n'); await diagnose({ boundary: 'dash-cap-observation', entry: { ...entry, observation: entry.observation && { ...entry.observation, engineAudit: entry.observation.engineAudit && { ...entry.observation.engineAudit, samples: undefined } } } }) }
      try {
        await page.evaluate(({ spec, scale, finalPaint }) => {
          const controlPaint = structuredClone(finalPaint); controlPaint.fill.enabled = true; controlPaint.fill.color = '#bbbbbb'; controlPaint.stroke.enabled = false
          window.stzLabels.mount({ labels: [], points: [{ id: 'control', text: '', layer: -1, position: { x: 3, y: 3, z: 0 }, style: { size: 12, shape: 'circle', paint: controlPaint } },
            { id: 'p', text: '', layer: 1, style: { size: spec.size, shape: spec.shape, paint: finalPaint } }] })
          window.stzLabels.setProps({ showGeometryHandles: false })
          const svg = document.querySelector('svg.svg-diagram'); svg.style.width = `${900 * scale}px`; svg.style.height = `${700 * scale}px`; svg.style.transform = ''
        }, { spec, scale, finalPaint })
        await settle()
        if (spec.key === 'triangle-square-wide') {
          const strokes = [
            { ...finalPaint.stroke, lineStyle: 'solid', lineCap: 'butt' },
            { ...finalPaint.stroke, lineCap: 'butt' }, finalPaint.stroke,
            { ...finalPaint.stroke, dashPattern: [10, 2] }, { ...finalPaint.stroke, dashPattern: [10, 2], dashPhase: 7 }, finalPaint.stroke,
          ]
          await page.evaluate((stroke) => window.stzLabels.mutatePoint('p', { style: { paint: { text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#000000', opacity: 1 }, stroke } } }), strokes[0]); await settle()
          for (const [i, field] of dashCapEditFields.entries()) {
            const before = await state()
            const sameNode = await page.evaluate((stroke) => {
              const node = document.querySelector('[data-point-id="p"] [data-point-contour]')
              const pointPaint = { text: { color: '#000000', opacity: 1 }, fill: { enabled: false, color: '#000000', opacity: 1 }, stroke }
              window.stzLabels.mutatePoint('p', { style: { paint: pointPaint } })
              return node === document.querySelector('[data-point-id="p"] [data-point-contour]')
            }, strokes[i + 1]); await settle()
            const observation = await observe(page, field === 'dashPhase' ? { ...spec, phaseNegatives: triangleDashPhaseNegatives } : spec); await rasterFiles(`${stem}-edit-${field}`, observation)
            const edit = { field, sameNode, modelChanged: before.json !== (await state()).json, observation,
              probe: { ...observation.probes.find((probe) => probe.kind === 'paint'), actions: [] } }
            entry.edits.push(edit); await persist(); assertDashCapObservation(observation)
            await pointerProbe(edit.probe, `${stem}-edit-${field}.screen.png`, persist, spec)
            if (field === 'dashPhase') {
              edit.negativeProbes = []
              for (const [index, original] of observation.probes.filter(({ kind }) => kind.startsWith('phase-outside-')).entries()) {
                const probe = { ...original, actions: [] }; edit.negativeProbes.push(probe); await persist()
                await pointerProbe(probe, `${stem}-edit-dashPhase-outside-${index}.screen.png`, persist, spec)
              }
            }
          }
        }
        entry.observation = await observe(page, spec); await rasterFiles(stem, entry.observation); await persist()
        if (spec.livePaint) { entry.observation.livePaint = await observeLivePaint(page, artifactDir, stem, entry.observation, persist); await persist() }
        await page.screenshot({ path: resolve(artifactDir, `${stem}.screen.png`), timeout: 5000 })
        assertDashCapObservation(entry.observation)
        for (const original of entry.observation.probes) {
          const probe = { ...original, actions: [] }; entry.probes.push(probe)
          await pointerProbe(probe, `${stem}-${probe.kind}.png`, persist, spec)
        }
        assertDashCapEntry({ ...entry, result: 'passed' }, spec, scale)
        entry.result = 'passed'; await persist()
      } catch (error) {
        primary ??= error; entry.result = 'failed'; entry.error = { message: error.message, stack: error.stack }
        try { await boundedPointDiagnostic(persist, 'dash-cap case failure evidence') }
        catch (diagnosticError) { console.error('Dash-cap case failure diagnostics:', diagnosticError) }
      }
    }
    try { await runPointDashCapMechanismChecks({ page, artifactDir }) } catch (error) { primary ??= error }
    if (primary) {
      try { await boundedPointDiagnostic(() => writeFile(resolve(artifactDir, `${dashCapScenario}.json`), JSON.stringify({ scenario: dashCapScenario, group: 'point-node-paint-import-persistence', result: 'failed', cases, error: { message: primary.message, stack: primary.stack } }, null, 2) + '\n'), 'dash-cap matrix failure evidence') }
      catch (diagnosticError) { console.error('Dash-cap matrix failure diagnostics:', diagnosticError) }
      throw primary
    }
    assertDashCapEvidence({ scenario: dashCapScenario, group: 'point-node-paint-import-persistence', result: 'passed', cases }); await saved({ cases })
  } catch (error) {
    primary = error
    throw error
  } finally {
    let cleanupFailure
    for (const [name, cleanup] of [
      ['dash-cap responsive style cleanup', () => page.evaluate(() => { const svg = document.querySelector('svg.svg-diagram'); svg?.style.removeProperty('width'); svg?.style.removeProperty('height'); svg?.style.removeProperty('transform') })],
      ['dash-cap viewport cleanup', () => page.setViewportSize(originalViewport)],
    ]) {
      try { await boundedPointDiagnostic(cleanup, name) }
      catch (error) { cleanupFailure ??= error; console.error('Dash-cap cleanup:', error) }
    }
    if (!primary && cleanupFailure) throw cleanupFailure
  }
}
