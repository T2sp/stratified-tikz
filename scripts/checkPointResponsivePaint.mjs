import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { captureResponsivePointPaint, assertResponsivePointPaint, setPointDisplayScale, restorePointDisplayScale, measureResponsivePointPaint, settleResponsivePointCapture } from './pointPaintOracle.mjs'
import { captureStandaloneSvg } from './standaloneSvgCapture.mjs'
import { cleanupPointCheck } from './pointCheckDiagnostics.mjs'
import { responsivePointProbes, responsivePointFraming } from './pointResponsiveFraming.mjs'
import { createResponsiveBodyBaseline, observeResponsiveBody, assertResponsiveBody,
  responsiveBodyNegativeControls } from './pointResponsiveBody.mjs'

async function cleanupResponsive(primary, operations) {
  let failure = primary
  for (const operation of operations) {
    try { await operation() } catch (error) { failure ??= error }
  }
  if (!primary && failure) throw failure
}

const declared = Object.freeze({ widthPt: 20, localWidth: 24, halfWidth: 12, selectionTolerance: 6,
  triangleCornerDegrees: 60, triangleMiterExtension: 24, dashPt: [12, 8], dashPhasePt: 3 })

export async function runResponsivePointPaintChecks({ browser, page, artifactDir, state, load, settle, eventAction, begin, saved, diagnose }) {
  const originalViewport = page.viewportSize()
  let activeIdentity
  const fixture = (shape, variant) => page.evaluate(({ shape, variant }) => window.stzAppLabels.pointResponsivePaintDocumentJson(shape, variant), { shape, variant })
  async function capture(target, stem, options = {}) {
    const persist = async (observation) => {
      await writeFile(resolve(artifactDir, `${stem}.json`), JSON.stringify({ declared,
        bodyObservation: options.bodyObservation, ...observation }, null, 2) + '\n')
      if (observation.xml) await writeFile(resolve(artifactDir, `${stem}${options.standalone ? '.raster' : ''}.svg`), observation.xml)
      await diagnose({ boundary: 'responsive-native-paint', stem, declared, observation: { ...observation, xml: undefined } })
    }
    return captureResponsivePointPaint(target, { ...options, path: resolve(artifactDir, `${stem}.png`), persist })
  }
  async function loadCase(shape, variant, scale) {
    await restoreCase()
    await load(await fixture(shape, variant)); await settle()
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true })
    if (await close.count()) await close.click()
    await settle()
    // Model-space framing is complete before this baseline. CSS scaling and
    // all measured interactions must retain model/history and body identity.
    const identity = { state: await state(), rootStyle: await page.locator('svg.svg-diagram').getAttribute('style'),
      request: await page.locator('[data-point-id="app-point"] [data-label-state]').getAttribute('data-label-request') }
    activeIdentity = identity
    await setPointDisplayScale(page, scale)
    await assertIdentity(identity)
    return identity
  }
  async function restoreCase() {
    await restorePointDisplayScale(page)
    if (!activeIdentity) return
    await settle()
    await assertIdentity(activeIdentity)
    assert.equal(await page.locator('svg.svg-diagram').getAttribute('style'), activeIdentity.rootStyle,
      'Responsive cleanup restores the original root style')
    activeIdentity = undefined
  }
  async function assertIdentity(identity) {
    const current = await state()
    assert.equal(current.json, identity.state.json, 'Responsive setup/interactions preserve the model')
    assert.equal(current.history, identity.state.history, 'Responsive setup/interactions preserve history')
    assert.equal(current.requests, identity.state.requests, 'Responsive setup/interactions do not request new body conversions')
    assert.equal(await page.locator('[data-point-id="app-point"] [data-label-state]').getAttribute('data-label-request'),
      identity.request, 'Responsive setup/interactions preserve the source request identity')
  }
  async function probe(shape, variant, observation) {
    const m = observation.contour.ctm, positions = responsivePointProbes(observation, variant)
    const clear = positions.clear.screen
    const probes = []
    async function confirmCoordinates() {
      await settleResponsivePointCapture(page)
      const current = await measureResponsivePointPaint(page)
      const framing = responsivePointFraming(current, { scale: observation.root.ctm.a, variant })
      await diagnose({ boundary: 'responsive-probe-framing', shape, variant, framing,
        root: current.root, contour: current.contour, body: current.body, framingState: current.framingState })
      for (const key of ['root', 'contour', 'body', 'viewport', 'scroll', 'framingState']) {
        assert.deepEqual(current[key], observation[key], `Native probe retains ${key} coordinates after selection/layout changes`)
      }
    }
    for (const alt of [false, true]) for (const kind of ['inside', 'outside']) {
      await confirmCoordinates()
      await page.mouse.click(clear.x, clear.y)
      await confirmCoordinates()
      const before = await state(), { local, screen: position } = positions[kind]
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
    await confirmCoordinates()
    await page.mouse.click(positions.inside.screen.x, positions.inside.screen.y)
    return probes
  }
  let primary
  try {
    for (const shape of ['circle', 'triangle']) {
      const scenario = `point-paint-responsive-${shape}`
      begin(scenario)
      const cases = []
      for (const scale of [.5, 2]) {
        const identity = await loadCase(shape, 'solid', scale), stem = `${scenario}-scale-${scale}`
        const initial = await capture(page, `${stem}-initial`, { shape, scale })
        const probes = await probe(shape, 'solid', initial)
        const observation = await capture(page, stem, { shape, scale, selected: true })
        const controlElement = page.locator('[data-point-id="app-point"] [data-point-contour]')
        const original = await controlElement.getAttribute('vector-effect')
        const originalContour = await controlElement.evaluate((element) => element.outerHTML)
        let control, controlPrimary
        try {
          await controlElement.evaluate((element) => element.setAttribute('vector-effect', 'non-scaling-stroke'))
          control = await capture(page, `${stem}-non-scaling`, { shape, scale, selected: true })
        } catch (error) { controlPrimary = error; throw error }
        finally {
          await cleanupPointCheck(controlPrimary, () => controlElement.evaluate((element, original) => {
            if (original === null) element.removeAttribute('vector-effect')
            else element.setAttribute('vector-effect', original)
          }, original))
        }
        assert.equal(await controlElement.evaluate((element) => element.outerHTML), originalContour,
          'Negative control restores the exact original contour geometry/style')
        const entry = { scale, shape, declared, identity, initial, observation, probes, control, variants: [] }
        cases.push(entry)
        await diagnose({ boundary: 'responsive-control-before-assertions', entry })
        assertResponsivePointPaint(initial, { scale, shape })
        assertResponsivePointPaint(observation, { scale, shape, selected: true })
        // Same actual DOM, CSS display size and declared width; only the old
        // contour vector effect is reintroduced. Reject its physical paint.
        assert.throws(() => assertResponsivePointPaint(control, { scale, shape, selected: true }),
          /Native physical paint extent|Physical border thickness/, 'Non-scaling negative control must fail native physical geometry')
        entry.negativeControlRejected = true
        assert.deepEqual(observation.body.bounds, initial.body.bounds, 'Selection retains body/font geometry')
        assert.deepEqual(observation.contour.shapeBounds, initial.contour.shapeBounds, 'Selection retains contour geometry')
        assert.equal(observation.body.request, initial.body.request)
        await assertIdentity(identity)
        for (const variant of ['disabled', 'transparent', ...(shape === 'circle' ? ['dashed'] : [])]) {
          const variantIdentity = await loadCase(shape, variant, scale)
          const first = await capture(page, `${stem}-${variant}-initial`, { shape, scale, variant })
          const variantProbes = variant === 'dashed' ? [] : await probe(shape, variant, first)
          const output = await capture(page, `${stem}-${variant}`, { shape, scale, variant, selected: variant !== 'dashed' })
          entry.variants.push({ variant, declared, identity: variantIdentity, output, probes: variantProbes })
          await diagnose({ boundary: 'responsive-variant-before-assertions', scale, shape, variant, output, probes: variantProbes })
          assertResponsivePointPaint(output, { scale, shape, variant, selected: variant !== 'dashed' })
          assert.deepEqual(output.body.bounds, initial.body.bounds, 'Paint changes retain body/font geometry')
          assert.equal(output.body.request, first.body.request, 'Display scaling and selection retain the loaded source request identity')
          assert.equal(output.body.source, initial.body.source, 'Each independent paint fixture uses the same body source')
          await assertIdentity(variantIdentity)
        }
        await restoreCase()
      }
      await saved({ declared, cases })
    }

    begin('point-paint-responsive-downloads')
    const cases = []
    for (const background of ['transparent', 'white']) for (const [shape, variant, suffix] of [
      ['circle', 'solid', ''], ['triangle', 'solid', '-triangle'], ['circle', 'dashed', '-dashed'],
    ]) {
      const identity = await loadCase(shape, variant, 1)
      await page.getByLabel('SVG export background', { exact: true }).selectOption(background)
      const before = await state(), stem = `point-paint-responsive-${background}${suffix}`
      // Prove that the actual App's framed content fits before asking the real
      // export action to freeze it. The downloaded XML is never repaired.
      const framed = await capture(page, `${stem}-app-framed`, { shape, variant, scale: 1 })
      await restoreCase()
      await assertIdentity(identity)
      const { event: download } = await eventAction(stem, 'download', () => page.getByRole('button', { name: 'Export current diagram view as SVG', exact: true }).click({ timeout: 5000 }))
      const svgPath = resolve(artifactDir, `${stem}.svg`)
      await download.saveAs(svgPath)
      const xml = await readFile(svgPath, 'utf8')
      const standalone = await browser.newPage({ viewport: { width: 1200, height: 900 } })
      const errors = [], requests = []
      standalone.on('pageerror', (error) => errors.push(error.message))
      standalone.on('request', (request) => requests.push(request.url()))
      let standalonePrimary
      try {
        await standalone.goto(pathToFileURL(svgPath).href)
        const originalDocument = await standalone.evaluate(() => new XMLSerializer().serializeToString(document))
        // Parse the actual immutable bytes, not a later sample whose corruption
        // could otherwise become the reference for all display scales.
        const baseline = await createResponsiveBodyBaseline(standalone, xml)
        await writeFile(resolve(artifactDir, `${stem}-body-baseline.json`), JSON.stringify(baseline, null, 2) + '\n')
        const entry = { shape, variant, background, declared, identity, framed, svgPath, baseline, errors, requests, scales: [] }
        cases.push(entry)
        for (const [index, scale] of [.5, 2, .5].entries()) {
          await setPointDisplayScale(standalone, scale, true)
          const name = `${stem}-${index === 2 ? 'return-' : ''}scale-${scale}`
          const bodyObservation = await observeResponsiveBody(standalone, { diagnose: (observation) =>
            diagnose({ boundary: 'responsive-download-literal', name, observation }) })
          // Retain the independent literal/font/structure observation even if
          // coverage, the native screenshot or its pixel-mask assertion fails.
          const output = await capture(standalone, name, { standalone: true, shape, variant, scale, bodyObservation })
          const envelope = await standalone.evaluate(() => ({
            backgroundCount: [...document.documentElement.children].filter((element) => element.localName === 'rect' && element.getAttribute('fill') === '#ffffff').length,
            forbidden: document.querySelectorAll('parsererror,foreignObject,image,script,[data-svg-export-exclude]').length,
            externalReferences: [...document.querySelectorAll('[href]')].map((element) => element.getAttribute('href')).filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))),
          }))
          const result = { scale, shape, variant, background, declared, bodyObservation, output, envelope, errors, requests }
          if (index === 2) entry.returnScale = result
          else entry.scales.push(result)
          const persist = (screenshot) => {
            if (screenshot) result.screenshot = screenshot
            return writeFile(resolve(artifactDir, `${name}.json`), JSON.stringify(result, null, 2) + '\n')
          }
          await persist(); await diagnose({ boundary: 'responsive-download-before-assertions', result })
          assertResponsiveBody(bodyObservation, baseline)
          assert.deepEqual(output.body.texts.map(({ text, bounds, ctm }) => ({ text, bounds, ctm })),
            bodyObservation.settling.leaves.map(({ text, bounds, ctm }) => ({ text, bounds, ctm })),
            'Independent literal observation and this native capture use the same text geometry and screen coordinates')
          result.bodyContractPassed = true
          assertResponsivePointPaint(output, { scale, shape, variant, standalone: true })
          assert.equal(envelope.backgroundCount, background === 'white' ? 1 : 0)
          assert.equal(envelope.forbidden, 0); assert.deepEqual(envelope.externalReferences, [])
          assert.deepEqual(errors, []); assert.deepEqual(requests, [pathToFileURL(svgPath).href])
          // A separately retained complete-root image verifies uncropped output
          // while the required PNG above remains the exact pixel-mask input.
          await captureStandaloneSvg(standalone, resolve(artifactDir, `${name}-full.png`), persist)
        }
        const [small, large] = entry.scales.map(({ output }) => output)
        assert.deepEqual(small.contour.shapeBounds, large.contour.shapeBounds, 'Download path geometry is invariant under CSS resize')
        assert.deepEqual(small.contour.shapeBounds, entry.returnScale.output.contour.shapeBounds, 'Return-scale path geometry is invariant')
        assert.deepEqual(small.body.ctm, entry.returnScale.output.body.ctm, 'Return-scale body screen placement is restored')
        assert.deepEqual(small.body.texts.map(({ ctm }) => ctm), entry.returnScale.output.body.texts.map(({ ctm }) => ctm),
          'Return-scale text screen placement is restored')
        entry.negativeControls = await responsiveBodyNegativeControls(standalone, baseline, async (observation) => {
          await writeFile(resolve(artifactDir, `${stem}-body-controls.json`), JSON.stringify(observation, null, 2) + '\n')
          await diagnose({ boundary: 'responsive-download-body-control', stem, observation })
        })
        await writeFile(resolve(artifactDir, `${stem}-body-controls.json`), JSON.stringify(entry.negativeControls, null, 2) + '\n')
        await restorePointDisplayScale(standalone)
        assert.equal(await standalone.evaluate(() => new XMLSerializer().serializeToString(document)), originalDocument,
          'Responsive observation, controls and root-style cleanup restore the complete positive document')
        entry.documentRestored = true
        assert.equal(await readFile(svgPath, 'utf8'), xml, 'The downloaded SVG bytes remain unchanged through every scale/control')
        entry.fileUnchanged = true
        await diagnose({ boundary: 'responsive-download-complete', entry })
        assert.ok(!xml.includes('data-svg-export-exclude'))
        assert.equal((await state()).json, before.json); assert.equal((await state()).history, before.history)
        await assertIdentity(identity)
      } catch (error) { standalonePrimary = error; throw error }
      finally {
        await cleanupResponsive(standalonePrimary, [() => restorePointDisplayScale(standalone), () => standalone.close()])
      }
    }
    await saved({ declared, cases })
  } catch (error) { primary = error; throw error }
  finally {
    await cleanupResponsive(primary, [restoreCase, async () => { if (originalViewport) await page.setViewportSize(originalViewport) }])
  }
}
