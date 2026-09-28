import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { polygonJoinScenario, polygonJoinCases, polygonJoinScales, assertPolygonJoinEvidence } from './pointPolygonJoinContract.mjs'

const paint = (join, width) => ({ text: { color: '#000000', opacity: 1 },
  fill: { enabled: false, color: '#000000', opacity: 1 },
  stroke: { enabled: true, color: '#000000', opacity: 1, width, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: join } })

/** Native SVG raster is the distance oracle. No stroke-region, bounds or
 * candidate helper is used to choose the probes or calculate their distances. */
async function rasterObservation(page, specification) {
  return page.evaluate(async (specification) => {
    const contour = document.querySelector('[data-point-id="p"] [data-point-contour]')
    const point = contour.parentElement, css = getComputedStyle(contour), resolution = 16, half = 120, side = half * 2 * resolution
    const clean = contour.cloneNode(true)
    for (const attribute of [...clean.attributes]) if (attribute.name.startsWith('data-')) clean.removeAttribute(attribute.name)
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="${-half} ${-half} ${2 * half} ${2 * half}">${clean.outerHTML}</svg>`
    const image = new Image(), url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side
    const context = canvas.getContext('2d', { willReadFrequently: true })
    try { image.src = url; await image.decode(); context.drawImage(image, 0, 0) } finally { URL.revokeObjectURL(url) }
    const bytes = context.getImageData(0, 0, side, side).data
    const painted = (x, y) => x >= 0 && y >= 0 && x < side && y < side && bytes[(y * side + x) * 4 + 3] >= 128
    const boundary = [], rasterBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
      if (!painted(x, y)) continue
      const px = (x + .5) / resolution - half, py = (y + .5) / resolution - half
      rasterBounds.minX = Math.min(rasterBounds.minX, px - .5 / resolution)
      rasterBounds.minY = Math.min(rasterBounds.minY, py - .5 / resolution)
      rasterBounds.maxX = Math.max(rasterBounds.maxX, px + .5 / resolution)
      rasterBounds.maxY = Math.max(rasterBounds.maxY, py + .5 / resolution)
      if (!painted(x - 1, y) || !painted(x + 1, y) || !painted(x, y - 1) || !painted(x, y + 1)) boundary.push({ x: px, y: py })
    }
    const distance = (point) => {
      if (painted(Math.floor((point.x + half) * resolution), Math.floor((point.y + half) * resolution))) return 0
      let squared = Infinity
      for (const pixel of boundary) squared = Math.min(squared, (point.x - pixel.x) ** 2 + (point.y - pixel.y) ** 2)
      return Math.sqrt(squared)
    }
    const angle = specification.edge === 'concave' ? -Math.PI / 2 - Math.PI / 5 : specification.edge === 'bottom' ? Math.PI / 2 : -Math.PI / 2
    const direction = { x: Math.cos(angle), y: Math.sin(angle) }
    const along = (radius) => ({ x: direction.x * radius, y: direction.y * radius })
    // Bounded radial raster scan includes the opposite edge's overlapping strip.
    let lastPaint = 0
    for (let radius = 0; radius <= 110; radius += 1 / resolution) if (distance(along(radius)) === 0) lastPaint = radius
    const allowance = (target) => {
      let low = lastPaint, high = lastPaint + 12
      for (let iteration = 0; iteration < 24; iteration++) {
        const mid = (low + high) / 2
        if (distance(along(mid)) < target) low = mid; else high = mid
      }
      return along((low + high) / 2)
    }
    const probes = [
      { kind: 'paint', local: along(lastPaint - .25) },
      { kind: 'within', local: allowance(5.5) }, { kind: 'outside', local: allowance(6.5) },
      { kind: 'interior', local: { x: 0, y: 0 } },
      ...(specification.exact ? [{ kind: 'exact', local: specification.exact }] : []),
      ...(specification.key === 'triangle-bevel-wide' ? [{ kind: 'bevel-edge', local: { x: 10, y: -14 } }] : []),
      ...(specification.key === 'triangle-miter-wide' ? [{ kind: 'miter-tip', local: { x: 0, y: -40.8 } }] : []),
    ].map((probe) => ({ ...probe, rasterDistance: distance(probe.local), nativeStrokeContains: contour.isPointInStroke(new DOMPoint(probe.local.x, probe.local.y)) }))
    const m = contour.getScreenCTM(), ctm = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, m[key]]))
    const declaredBounds = point.getAttribute('data-point-painted-bounds').split(' ').map(Number)
    return { xml, rasterPng: canvas.toDataURL('image/png').split(',')[1], resolution, boundaryPixelCount: boundary.length, rasterBounds,
      declaredBounds, ctm, probes, strokeWidth: parseFloat(css.strokeWidth), join: css.strokeLinejoin, miterLimit: Number(css.strokeMiterlimit),
      fill: css.fill, vertices: [...contour.points].map(({ x, y }) => ({ x, y })), boundaryRay: { direction, lastPaint },
      bodyStatus: point.querySelector('[data-label-state]').getAttribute('data-label-state'),
      source: point.querySelector('[data-label-state]').getAttribute('data-label-source') }
  }, specification)
}

export async function runPointPolygonJoinChecks({ page, artifactDir, begin, saved, diagnose }) {
  begin(polygonJoinScenario)
  const originalViewport = page.viewportSize(), cases = []
  const state = () => page.evaluate(() => window.stzLabels.state())
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  async function mount(specification, scale, controlPosition = { x: 3, y: 3, z: 0 }) {
    const controlPaint = paint('round', .4); controlPaint.fill.enabled = true; controlPaint.fill.color = '#bbbbbb'; controlPaint.stroke.enabled = false
    await page.evaluate(({ specification, scale, controlPosition, pointPaint, controlPaint }) => {
      window.stzLabels.mount({ labels: [], points: [
        { id: 'control', text: '', layer: -1, position: controlPosition, style: { size: 12, shape: 'circle', paint: controlPaint } },
        { id: 'p', text: '', layer: 1, style: { size: specification.size, shape: specification.shape, paint: pointPaint } },
      ] })
      window.stzLabels.setProps({ showGeometryHandles: false })
      const svg = document.querySelector('svg.svg-diagram')
      svg.style.width = `${900 * scale}px`; svg.style.height = `${700 * scale}px`
      svg.style.transform = ''
    }, { specification, scale, controlPosition, pointPaint: paint(specification.join, specification.widthPt), controlPaint })
    await settle()
  }
  try {
    await page.setViewportSize({ width: 1500, height: 1150 })
    for (const specification of polygonJoinCases) for (const scale of polygonJoinScales) {
      await mount(specification, scale)
      const stem = `${polygonJoinScenario}-${specification.key}-scale-${scale}`
      const observation = await rasterObservation(page, specification)
      await writeFile(resolve(artifactDir, `${stem}.input.svg`), observation.xml)
      await writeFile(resolve(artifactDir, `${stem}.raster.png`), Buffer.from(observation.rasterPng, 'base64'))
      delete observation.rasterPng
      const entry = { key: specification.key, scale, specification, observation, probes: [], modelUnchanged: true }
      cases.push(entry)
      const persist = async () => {
        await writeFile(resolve(artifactDir, `${stem}.json`), JSON.stringify(entry, null, 2) + '\n')
        await diagnose({ boundary: 'polygon-join-observation', entry })
      }
      await persist()
      await page.screenshot({ path: resolve(artifactDir, `${stem}.screen.png`), timeout: 5000 })
      assert.equal(observation.source, '')
      assert.equal(observation.bodyStatus, 'ready')
      for (const [index, key] of ['minX', 'minY', 'maxX', 'maxY'].entries()) {
        assert.ok(Math.abs(observation.rasterBounds[key] - observation.declaredBounds[index]) < .14,
          `${specification.key} ${key}: native raster ${observation.rasterBounds[key]} versus layout ${observation.declaredBounds[index]}`)
      }
      if (specification.key === 'triangle-miter-wide') assert.ok(Math.abs(observation.rasterBounds.maxY - 20.5455844123) < .07)
      if (specification.key === 'triangle-bevel-wide') assert.ok(Math.abs(observation.rasterBounds.minY + 15.4544155877) < .07)
      observation.boundsMatch = true
      for (const original of observation.probes) {
        const probe = { ...original, actions: [] }; entry.probes.push(probe)
        await mount(specification, scale, { x: probe.local.x / 100, y: -probe.local.y / 100, z: 0 })
        // Preserve fractional model coordinates while aligning the native event
        // to integer CSS pixels (MouseEvent client coordinates are integral).
        const transform = await page.evaluate((local) => {
          const svg = document.querySelector('svg.svg-diagram'), contour = document.querySelector('[data-point-id="p"] [data-point-contour]')
          const before = new DOMPoint(local.x, local.y).matrixTransform(contour.getScreenCTM())
          svg.style.transform = `translate(${Math.round(before.x) - before.x}px, ${Math.round(before.y) - before.y}px)`
          const matrix = contour.getScreenCTM(), screen = new DOMPoint(local.x, local.y).matrixTransform(matrix)
          const clear = new DOMPoint(8, 8).matrixTransform(svg.getScreenCTM())
          return { screen: { x: Math.round(screen.x), y: Math.round(screen.y) }, clear: { x: clear.x, y: clear.y },
            ctm: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])) }
        }, probe.local)
        probe.transform = transform
        const before = await state()
        await page.mouse.click(transform.clear.x, transform.clear.y)
        assert.equal((await state()).selection, null); probe.selectionCleared = true
        await page.evaluate(() => { window.stzJoinClicks = window.stzLabels.observeEmptyPointSelectionClicks() })
        try {
          for (const alt of [false, true, true, true]) {
            if (probe.actions.length === 1) {
              await page.mouse.click(transform.clear.x, transform.clear.y)
              assert.equal((await state()).selection, null)
            }
            if (alt) await page.keyboard.down('Alt')
            try { await page.mouse.click(transform.screen.x, transform.screen.y) }
            finally { if (alt) await page.keyboard.up('Alt') }
            const action = await page.evaluate(() => ({ ...window.stzJoinClicks.read().at(-1), selection: window.stzLabels.state().selection,
              feedback: document.querySelector('.svg-selection-cycle-feedback text')?.textContent ?? null }))
            action.screen = transform.screen; probe.actions.push(action)
            assert.ok(Math.abs(action.point.x - 450 - probe.local.x) < .01 && Math.abs(action.point.y - 350 - probe.local.y) < .01,
              'Native pointer maps back into the declared local geometry space')
            await persist()
            const expected = ['outside', 'exact'].includes(probe.kind) ? ['control'] : ['control', 'p']
            assert.deepEqual([...action.candidates].sort(), expected)
            if (!alt && ['paint', 'miter-tip', 'bevel-edge'].includes(probe.kind)) assert.equal(action.selection?.id, 'p', 'Ordinary click reaches genuinely painted edge')
            if (!alt && ['outside', 'exact'].includes(probe.kind)) assert.equal(action.selection?.id, 'control', 'Ordinary outside click reaches only underlying control')
          }
          const after = await state()
          assert.equal(after.json, before.json); assert.equal(after.history, before.history)
          probe.screenshot = `${stem}-${probe.kind}.png`
          await persist()
          await page.screenshot({ path: resolve(artifactDir, probe.screenshot), timeout: 5000 })
        } finally { await page.evaluate(() => { window.stzJoinClicks.dispose(); delete window.stzJoinClicks }) }
      }
      await persist()
    }
    const evidence = { scenario: polygonJoinScenario, group: 'point-node-paint-import-persistence', result: 'passed', cases }
    assertPolygonJoinEvidence(evidence)
    await saved({ cases })
  } finally {
    await page.evaluate(() => {
      const svg = document.querySelector('svg.svg-diagram')
      svg?.style.removeProperty('width'); svg?.style.removeProperty('height'); svg?.style.removeProperty('transform')
    })
    await page.setViewportSize(originalViewport)
  }
}
