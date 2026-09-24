import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { captureResponsivePointPaint, assertResponsivePointPaint, setPointDisplayScale, restorePointDisplayScale } from './pointPaintOracle.mjs'
import { captureStandaloneSvg } from './standaloneSvgCapture.mjs'
import { cleanupPointCheck } from './pointCheckDiagnostics.mjs'

const declared = Object.freeze({ widthPt: 20, localWidth: 24, halfWidth: 12, selectionTolerance: 6,
  triangleCornerDegrees: 60, triangleMiterExtension: 24, dashPt: [12, 8], dashPhasePt: 3 })

export async function runResponsivePointPaintChecks({ browser, page, artifactDir, state, load, settle, eventAction, begin, saved, diagnose }) {
  const fixture = (shape, variant) => page.evaluate(({ shape, variant }) => window.stzAppLabels.pointResponsivePaintDocumentJson(shape, variant), { shape, variant })
  async function capture(target, stem, options = {}) {
    const persist = async (observation) => {
      await writeFile(resolve(artifactDir, `${stem}.json`), JSON.stringify({ declared, ...observation }, null, 2) + '\n')
      if (observation.xml) await writeFile(resolve(artifactDir, `${stem}${options.standalone ? '.raster' : ''}.svg`), observation.xml)
      await diagnose({ boundary: 'responsive-native-paint', stem, declared, observation: { ...observation, xml: undefined } })
    }
    return captureResponsivePointPaint(target, { ...options, path: resolve(artifactDir, `${stem}.png`), persist })
  }
  async function loadCase(shape, variant, scale) {
    await restorePointDisplayScale(page)
    await load(await fixture(shape, variant)); await settle()
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true })
    if (await close.count()) await close.click()
    await setPointDisplayScale(page, scale)
  }
  async function probe(shape, variant, observation) {
    const m = observation.contour.ctm, root = observation.root.ctm
    const radius = shape === 'circle' ? observation.contour.radius : -Math.min(...observation.contour.vertices.map(({ y }) => y))
    const extension = variant === 'disabled' ? 0 : shape === 'circle' ? 12 : 24
    const localInside = shape === 'circle' ? { x: radius + (extension ? extension - 3 : -3), y: 0 }
      : { x: 0, y: -radius - (extension ? extension - 4 : -3) }
    const localOutside = shape === 'circle' ? { x: radius + extension + 9, y: 0 }
      : { x: 0, y: -radius - extension - 9 }
    const screen = ({ x, y }) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f })
    const clear = { x: root.e + root.a * 8, y: root.f + root.d * 8 }
    const probes = []
    for (const alt of [false, true]) for (const [kind, local] of [['inside', localInside], ['outside', localOutside]]) {
      await page.mouse.click(clear.x, clear.y)
      const before = await state(), position = screen(local)
      const entry = { kind, alt, local, screen: position, clear, beforeSelection: before.selection,
        expectedSelected: kind === 'inside', declared, ctm: m }
      await diagnose({ boundary: 'before-responsive-probe', shape, variant, entry })
      assert.equal(before.selection, null, 'Selection is cleared before every positive and negative probe')
      if (alt) await page.keyboard.down('Alt')
      try { await page.mouse.click(position.x, position.y) }
      finally { if (alt) await page.keyboard.up('Alt') }
      const after = await state()
      entry.afterSelection = after.selection
      entry.candidateFeedback = await page.locator('[role="status"]').allTextContents()
      probes.push(entry)
      await diagnose({ boundary: 'after-responsive-probe', shape, variant, entry })
      assert.deepEqual(after.selection, kind === 'inside' ? { kind: 'stratum', id: 'app-point' } : null,
        `${shape} ${variant} ${alt ? 'Alt candidate' : 'ordinary'} ${kind} border probe`)
      assert.equal(after.json, before.json); assert.equal(after.history, before.history)
    }
    await page.mouse.click(screen(localInside).x, screen(localInside).y)
    return probes
  }
  for (const shape of ['circle', 'triangle']) {
    const scenario = `point-paint-responsive-${shape}`
    begin(scenario)
    const cases = []
    for (const scale of [.5, 2]) {
      await loadCase(shape, 'solid', scale)
      const identity = await state(), stem = `${scenario}-scale-${scale}`
      const initial = await capture(page, `${stem}-initial`)
      const probes = await probe(shape, 'solid', initial)
      const observation = await capture(page, stem)
      const controlElement = page.locator('[data-point-id="app-point"] [data-point-contour]')
      const original = await controlElement.getAttribute('vector-effect')
      let control
      try {
        await controlElement.evaluate((element) => element.setAttribute('vector-effect', 'non-scaling-stroke'))
        control = await capture(page, `${stem}-non-scaling`)
      } finally {
        await controlElement.evaluate((element, original) => {
          if (original === null) element.removeAttribute('vector-effect')
          else element.setAttribute('vector-effect', original)
        }, original)
      }
      const entry = { scale, shape, declared, initial, observation, probes, control, variants: [] }
      cases.push(entry)
      await diagnose({ boundary: 'responsive-control-before-assertions', entry })
      assertResponsivePointPaint(initial, { scale, shape })
      assertResponsivePointPaint(observation, { scale, shape, selected: true })
      // Same actual DOM, CSS display size and declared width; only the old
      // contour vector effect is reintroduced. Reject its physical paint.
      assert.throws(() => assertResponsivePointPaint(control, { scale, shape, selected: true }),
        /Native physical paint extent|Physical border thickness/, 'Non-scaling negative control must fail native physical geometry')
      entry.negativeControlRejected = true
      assert.equal((await state()).json, identity.json); assert.equal((await state()).history, identity.history)
      for (const variant of ['disabled', 'transparent', ...(shape === 'circle' ? ['dashed'] : [])]) {
        await loadCase(shape, variant, scale)
        const first = await capture(page, `${stem}-${variant}-initial`)
        const variantProbes = variant === 'dashed' ? [] : await probe(shape, variant, first)
        const output = await capture(page, `${stem}-${variant}`)
        entry.variants.push({ variant, declared, output, probes: variantProbes })
        await diagnose({ boundary: 'responsive-variant-before-assertions', scale, shape, variant, output, probes: variantProbes })
        assertResponsivePointPaint(output, { scale, shape, variant, selected: variant !== 'dashed' })
        assert.deepEqual(output.body.bounds, initial.body.bounds, 'Paint changes retain body/font geometry')
        assert.equal(output.body.request, first.body.request, 'Display scaling and selection retain the loaded source request identity')
        assert.equal(output.body.source, initial.body.source, 'Each independent paint fixture uses the same body source')
      }
      await restorePointDisplayScale(page)
    }
    await saved({ declared, cases })
  }

  begin('point-paint-responsive-downloads')
  const cases = []
  for (const background of ['transparent', 'white']) for (const [shape, variant, suffix] of [
    ['circle', 'solid', ''], ['triangle', 'solid', '-triangle'], ['circle', 'dashed', '-dashed'],
  ]) {
    await restorePointDisplayScale(page)
    await load(await fixture(shape, variant)); await settle()
    await page.getByLabel('SVG export background', { exact: true }).selectOption(background)
    const before = await state(), stem = `point-paint-responsive-${background}${suffix}`
    const { event: download } = await eventAction(stem, 'download', () => page.getByRole('button', { name: 'Export current diagram view as SVG', exact: true }).click({ timeout: 5000 }))
    const svgPath = resolve(artifactDir, `${stem}.svg`)
    await download.saveAs(svgPath)
    const xml = await readFile(svgPath, 'utf8')
    const standalone = await browser.newPage({ viewport: { width: 1200, height: 900 } })
    const errors = [], requests = []
    standalone.on('pageerror', (error) => errors.push(error.message))
    standalone.on('request', (request) => requests.push(request.url()))
    let primary
    try {
      await standalone.goto(pathToFileURL(svgPath).href)
      const entry = { shape, variant, background, declared, svgPath, errors, requests, scales: [] }
      cases.push(entry)
      for (const scale of [.5, 2]) {
        await setPointDisplayScale(standalone, scale, true)
        const name = `${stem}-scale-${scale}`
        const output = await capture(standalone, name, { standalone: true })
        const envelope = await standalone.evaluate(() => ({
          backgroundCount: [...document.documentElement.children].filter((element) => element.localName === 'rect' && element.getAttribute('fill') === '#ffffff').length,
          forbidden: document.querySelectorAll('parsererror,foreignObject,image,script,[data-svg-export-exclude]').length,
          externalReferences: [...document.querySelectorAll('[href]')].map((element) => element.getAttribute('href')).filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))),
        }))
        const result = { scale, shape, variant, background, declared, output, envelope, errors, requests }
        entry.scales.push(result)
        const persist = (screenshot) => writeFile(resolve(artifactDir, `${name}.json`), JSON.stringify({ ...result, screenshot }, null, 2) + '\n')
        await persist(); await diagnose({ boundary: 'responsive-download-before-assertions', result })
        assertResponsivePointPaint(output, { scale, shape, variant, standalone: true })
        assert.equal(envelope.backgroundCount, background === 'white' ? 1 : 0)
        assert.equal(envelope.forbidden, 0); assert.deepEqual(envelope.externalReferences, [])
        assert.deepEqual(errors, []); assert.deepEqual(requests, [pathToFileURL(svgPath).href])
        // A separately retained complete-root image verifies uncropped output
        // while the required PNG above remains the exact pixel-mask input.
        await captureStandaloneSvg(standalone, resolve(artifactDir, `${name}-full.png`), persist)
      }
      const [small, large] = entry.scales.map(({ output }) => output)
      assert.deepEqual(small.body.bounds, large.body.bounds, 'Download body layout is invariant under CSS resize')
      assert.deepEqual(small.contour.shapeBounds, large.contour.shapeBounds, 'Download path geometry is invariant under CSS resize')
      assert.ok(!xml.includes('data-svg-export-exclude'))
      assert.equal((await state()).json, before.json); assert.equal((await state()).history, before.history)
    } catch (error) { primary = error; throw error }
    finally { await cleanupPointCheck(primary, () => standalone.close()) }
  }
  await saved({ declared, cases })
  await restorePointDisplayScale(page)
}
