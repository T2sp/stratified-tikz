import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ownPageEvent } from './ownedPageEvent.mjs'
import { captureStandaloneSvg } from './standaloneSvgCapture.mjs'
import { cleanupPointCheck, capturePointCheck } from './pointCheckDiagnostics.mjs'
import { observePointLiteral, assertPositionedLiteral, inspectStandalonePoint } from './pointLiteralOracle.mjs'
import { inspectPoint, assertPointLayout } from './checkPointNodes.mjs'
import { saveAppJson, checkAppJsonReload } from './appJsonPersistence.mjs'
import { selectPointCoordinateMode, checkPointCoordinateModeBoundary } from './pointNativeCoordinateMode.mjs'
import { captureNativePointSetup, diagnoseNativePointFailure } from './pointNativeSetupDiagnostics.mjs'

const nativeInvalidSource = '  $\\missingNativePoint$\t\n tail  '

export async function runNativePointChecks({ browser, origin, page: rendererPage, artifactDir, saved, startGroup, completeGroup, observe, diagnose, setStage }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
  const errors = [], owned = []
  page.on('pageerror', (e) => errors.push(e.message))
  let primary
  const bodyGroup = 'point-node-body-layout-lifecycle', exportGroup = 'point-node-settled-export'
  let scenario = 'point-native-direct-cursor-workplanes-inspector-persistence'
  setStage?.('point-node-native-input')
  const inspect = async (id) => {
    return capturePointCheck(() => inspectPoint(page, id), (details) => diagnose(scenario === 'point-native-direct-cursor-workplanes-inspector-persistence' ? bodyGroup : exportGroup, scenario, { id, ...details }))
  }
  const standaloneLiteral = (page, source) => capturePointCheck(
    () => observePointLiteral(page, { source, standalone: true }),
    (details) => diagnose(exportGroup, scenario, { source, standalone: true, ...details }))
  const state = () => page.evaluate(() => window.stzAppLabels.state())
  const model = async () => JSON.parse((await state()).json).diagram
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  async function eventAction(name, event, action) {
    const wait = ownPageEvent(page, event, { name, timeoutMs: 30_000 }); owned.push(wait)
    return wait.run(action)
  }
  async function load(json) {
    const before = await state()
    const { event } = await eventAction('point-load', 'filechooser', () => page.getByRole('button', { name: 'Load JSON', exact: true }).click({ timeout: 5000 }))
    await event.setFiles({ name: 'point.json', mimeType: 'application/json', buffer: Buffer.from(json) })
    await page.waitForFunction((r) => window.stzAppLabels.state().labelDocumentRevision > r, before.labelDocumentRevision)
  }
  const fixture = (dimension, text) => page.evaluate(({ dimension, text }) => window.stzAppLabels.pointDocumentJson(dimension, text), { dimension, text })
  async function selectInspector(id) {
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded()
    const point = await inspect(id)
    await page.mouse.click(point.center.x, point.center.y)
    const open = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
    if (await open.count()) await open.click()
    const inspector = page.locator('#preview-inspector-drawer')
    const expand = inspector.getByRole('button', { name: 'Expand', exact: true })
    if (await expand.count()) await expand.click()
    return inspector.getByRole('textbox', { name: 'Node text', exact: true })
  }
  async function tikz() {
    const output = {}
    for (const mode of ['standalone', 'inlineMath']) {
      await page.getByLabel(/^TikZ export mode:/).selectOption(mode)
      output[mode] = await page.getByRole('textbox', { name: 'Generated TikZ source' }).inputValue()
    }
    return output
  }
  try {
    await page.goto(`${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`)
    await page.waitForFunction(() => window.stzAppLabels !== undefined)
    const entries = []
    for (const ambientDimension of [2, 3]) {
      await load(await fixture(ambientDimension))
      await page.getByLabel('Add point menu', { exact: true }).click()
      await page.getByRole('button', { name: 'Direct input', exact: true }).click()
      const drawer = page.locator('#direct-input-drawer')
      const form = drawer.locator('.direct-input-drawer-form')
      const setup = await captureNativePointSetup(page)
      const locatorMatches = {
        exactLabelCount: await form.getByLabel('Coordinate mode', { exact: true }).count(),
        prefixLabelCount: await form.getByLabel(/^Coordinate mode/).count(),
        scopedSelectCount: await form.locator('.direct-coordinate-mode-field select').count(),
      }
      await diagnose(bodyGroup, scenario, { boundary: 'before-direct-coordinate-mode', ambientDimension, setup, locatorMatches })
      assert.equal((await model()).ambientDimension, ambientDimension, 'Loaded point document dimension')
      assert.equal(await form.count(), 1, 'One active direct creation form')
      assert.equal(await form.isVisible(), true)
      assert.equal(await form.getAttribute('aria-label'), 'Direct creation')
      assert.equal(await drawer.locator('#direct-input-drawer-heading').textContent(), 'Point')
      const pointMenu = page.locator('.preview-toolbar-menu').filter({ has: page.getByLabel('Add point menu', { exact: true }) })
      assert.equal(await pointMenu.count(), 1)
      assert.equal(await pointMenu.getByRole('button', { name: 'Direct input', exact: true, includeHidden: true }).getAttribute('aria-pressed'), 'true')
      if (ambientDimension === 3) {
        await checkPointCoordinateModeBoundary({ browser, form,
          diagnose: (details) => diagnose(bodyGroup, scenario, { ambientDimension, ...details }) })
        await selectPointCoordinateMode(form, 'global')
      } else {
        assert.equal(await form.locator('.direct-coordinate-mode-field select').count(), 0, '2D has no coordinate-mode select')
        assert.equal(await form.getByRole('textbox', { name: 'z', exact: true }).count(), 0, '2D enters x/y only')
      }
      for (const [axis, value] of [['x', '.4'], ['y', '.7'], ...(ambientDimension === 3 ? [['z', '.2']] : [])]) {
        const field = form.getByRole('textbox', { name: axis, exact: true })
        assert.equal(await field.count(), 1, `One ${axis} coordinate input`)
        assert.equal(await field.isVisible(), true)
        assert.equal(await field.isEnabled(), true)
        await field.fill(value)
        assert.equal(await field.inputValue(), value)
      }
      await diagnose(bodyGroup, scenario, { boundary: 'before-direct-create', ambientDimension, setup: await captureNativePointSetup(page) })
      await form.getByRole('button', { name: 'Create', exact: true }).click()
      let points = (await model()).strata.filter((s) => s.geometricKind === 'point')
      await diagnose(bodyGroup, scenario, { boundary: 'after-direct-create', ambientDimension, points, state: await state() })
      assert.equal(points.length, 1); assert.equal(points[0].geometricKind, 'point'); assert.equal(points[0].codim, ambientDimension)
      assert.deepEqual(points[0].position, { x: .4, y: .7, z: ambientDimension === 3 ? .2 : 0 })
      const close = page.getByRole('button', { name: 'Close direct input drawer', exact: true })
      if (await close.count()) await close.click()
      const field = await selectInspector(points[0].id)
      const source = ` 日本 ${ambientDimension}D $\\frac{a_1}{\\sqrt{x}}$ `
      await field.fill(source)
      const before = await state(), code = await tikz()
      await settle(); assert.equal((await state()).json, before.json); assert.equal((await state()).history, before.history)
      const rendered = await inspect(points[0].id); assertPointLayout(rendered); assert.equal(rendered.source, source)
      assert.ok(code.standalone.includes(source) && code.inlineMath.includes(source))
      const invalid = nativeInvalidSource
      await field.fill(invalid); await settle()
      const invalidBody = await inspect(points[0].id)
      // Same exact source/font at the real App viewport, a second native
      // viewport, and the isolated renderer. Keep CSS/viewBox/transforms intact;
      // collect both APIs before asserting, without attributing box differences.
      await rendererPage.evaluate(({ text, ambientDimension }) => window.stzLabels.mount({ ambientDimension, labels: [], points: [{ id: 'metric-reference', text }] }), { text: invalid, ambientDimension })
      await rendererPage.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'))
      const isolated = await capturePointCheck(() => inspectPoint(rendererPage, 'metric-reference'),
        (details) => diagnose(bodyGroup, scenario, { context: 'isolated-metric-reference', ambientDimension, ...details }))
      await page.setViewportSize({ width: 1440, height: 1080 })
      const resized = await inspect(points[0].id)
      await page.setViewportSize({ width: 1600, height: 1200 })
      const metricComparison = { ambientDimension, invalidBody, isolated, resized }
      await diagnose(bodyGroup, scenario, { metricComparison })
      assertPositionedLiteral(isolated.literalObservation, invalid)
      assertPositionedLiteral(resized.literalObservation, invalid)
      const ctm = invalidBody.literalObservation.coordinateContext.rootToScreen
      assert.ok(Math.abs(ctm.a - 1) > .001 || Math.abs(ctm.d - 1) > .001, 'Native App exercises nonidentity viewport scaling')
      assert.equal(invalidBody.status, 'fallback'); assertPositionedLiteral(invalidBody.literalObservation, invalid); assertPointLayout(invalidBody)
      assert.equal(await field.inputValue(), invalid)
      assert.equal((await model()).strata.find((s) => s.id === points[0].id).text, invalid)
      await page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click()
      await settle(); assert.equal((await inspect(points[0].id)).source, source)
      await page.getByRole('button', { name: 'Redo last undone diagram change', exact: true }).click()
      await settle(); assertPositionedLiteral((await inspect(points[0].id)).literalObservation, invalid)
      await field.fill(source); await settle()
      assert.equal((await inspect(points[0].id)).status, 'ready')
      await page.getByRole('button', { name: 'Close inspector drawer', exact: true }).click()
      const cursors = []
      for (const plane of ambientDimension === 3 ? ['xy', 'xz', 'yz'] : ['xy']) {
        if (ambientDimension === 3) {
          await page.locator('.preview-work-plane-toggle-button').click()
          await page.getByLabel('Work-plane preset', { exact: true }).selectOption(plane)
          const axis = { xy: 'z', xz: 'y', yz: 'x' }[plane]
          await page.getByLabel(`Fixed ${axis} coordinate`, { exact: true }).fill('1.25')
          await page.getByRole('button', { name: 'Close work-plane panel', exact: true }).click()
        }
        await page.getByLabel('Add point menu', { exact: true }).click()
        await page.getByRole('button', { name: 'Cursor placement', exact: true }).click()
        const svg = page.locator('svg.svg-diagram'); await svg.scrollIntoViewIfNeeded()
        const box = await svg.boundingBox(); assert.ok(box)
        await page.mouse.click(box.x + box.width * (.6 + cursors.length * .07), box.y + box.height * .6)
        points = (await model()).strata.filter((s) => s.geometricKind === 'point')
        const created = points.at(-1)
        assert.equal(points.length, 2 + cursors.length)
        assert.equal(created.codim, ambientDimension)
        assert.equal(created.position[ambientDimension === 2 ? 'z' : { xy: 'z', xz: 'y', yz: 'x' }[plane]], ambientDimension === 2 ? 0 : 1.25)
        const cursorField = await selectInspector(created.id)
        await cursorField.fill(`cursor ${plane} $g_j$`); await settle()
        const cursorBody = await inspect(created.id); assertPointLayout(cursorBody)
        cursors.push({ plane, created, body: cursorBody })
        await page.getByRole('button', { name: 'Close inspector drawer', exact: true }).click()
      }
      // Exercise both explicitly saved modes in each dimension. The first save
      // retains tikz()'s inline selection; the second overrides stored metadata.
      const persistence = []
      if (ambientDimension === 3) {
        if (!await page.getByRole('spinbutton', { name: 'theta value', exact: true }).count()) {
          await page.locator('.camera-summary-toggle').click()
        }
        for (const [label, value] of [['theta', '41'], ['phi', '-28'], ['zoom', '1.3'], ['pan x', '12'], ['pan y', '-9']]) {
          await page.getByRole('spinbutton', { name: `${label} value`, exact: true }).fill(value)
        }
      }
      for (const mode of ['inlineMath', 'standalone']) {
        await page.getByLabel(/^TikZ export mode:/).selectOption(mode)
        if (ambientDimension === 3) {
          await page.getByLabel('Show xyz axes in TikZ output', { exact: true }).setChecked(mode === 'standalone')
          await page.getByLabel('Enable approximate 3D visibility', { exact: true }).check()
          await page.getByLabel('Auto depth-sort surfaces', { exact: true }).uncheck()
        }
        const diagnosePersistence = (details) => diagnose(bodyGroup, scenario, { mode, ...details })
        const download = await saveAppJson({ page, artifactDir, owned,
          name: `point-native-${ambientDimension}d${mode === 'standalone' ? '-standalone' : ''}`, diagnose: diagnosePersistence })
        // Change real controls before loading: restoration cannot pass merely
        // because the pre-load settings happened to equal the saved ones.
        await page.getByLabel(/^TikZ export mode:/).selectOption(mode === 'inlineMath' ? 'standalone' : 'inlineMath')
        if (ambientDimension === 3) {
          await page.getByLabel('Show xyz axes in TikZ output', { exact: true }).setChecked(mode !== 'standalone')
          await page.getByLabel('Auto depth-sort surfaces', { exact: true }).check()
          await page.getByLabel('Enable approximate 3D visibility', { exact: true }).uncheck()
          await page.getByRole('spinbutton', { name: 'theta value', exact: true }).fill('63')
        }
        const beforeLoad = await state()
        await diagnosePersistence({ boundary: 'before-reload', beforeLoad, download })
        await load(download.json); await settle()
        const reloaded = await checkAppJsonReload({ page, saved: download, diagnose: diagnosePersistence })
        assert.equal(reloaded.loaded.labelDocumentRevision, beforeLoad.labelDocumentRevision + 1)
        assert.equal(reloaded.loaded.selection, null)
        assert.deepEqual(JSON.parse(reloaded.loaded.history).future, [], 'Document replacement clears the redo branch')
        persistence.push({ download, reloaded })
      }
      entries.push({ ambientDimension, setup, locatorMatches, direct: rendered, invalidBody, metricComparison, cursors, code, persistence,
        jsonPath: persistence[0].download.path, beforeSave: persistence[0].download.before, loaded: persistence[0].reloaded.loaded })
    }
    await saved('point-native-direct-cursor-workplanes-inspector-persistence', entries, bodyGroup)
    setStage?.('point-node-settled-export')
    await startGroup(exportGroup)
    const fallbackSource = '  $bad\t\t\r\n\r tail  \t\n'
    for (const [background, dimension, exportScenario] of [
      ['transparent', 2, 'point-native-pending-transparent-edit'], ['white', 3, 'point-native-pending-white-load'],
    ]) {
      scenario = exportScenario
      const source = `captured ${dimension} $\\frac{a_1}{\\sqrt{x}}$`
      await page.evaluate((s) => window.stzAppLabels.hold(s), source)
      const documentJson = JSON.parse(await fixture(dimension, source))
      const fallbackPoint = structuredClone(documentJson.diagram.strata[0])
      Object.assign(fallbackPoint, { id: 'fallback-point', text: fallbackSource, position: { x: 2, y: -1.6, z: 0 } })
      documentJson.diagram.strata.push(fallbackPoint)
      const metricPoint = structuredClone(fallbackPoint)
      Object.assign(metricPoint, { id: 'metric-point', text: nativeInvalidSource, position: { x: -2, y: -1.6, z: 0 } })
      documentJson.diagram.strata.push(metricPoint)
      await load(JSON.stringify(documentJson))
      await page.waitForFunction((s) => window.stzAppLabels.pending(s)?.started > 0, source)
      const field = await selectInspector('app-point')
      const pending = await inspect('app-point'); assert.equal(pending.status, 'pending'); assertPointLayout(pending); assertPositionedLiteral(pending.literalObservation, source)
      const pendingFallback = await inspect('fallback-point')
      assertPositionedLiteral(pendingFallback.literalObservation, fallbackSource)
      const pendingMetric = await inspect('metric-point')
      assertPositionedLiteral(pendingMetric.literalObservation, nativeInvalidSource)
      await page.getByLabel('SVG export background', { exact: true }).selectOption(background)
      const before = await state()
      const { event: download, value: after } = await eventAction(scenario, 'download', async ({ check }) => {
        await page.getByRole('button', { name: 'Export current diagram view as SVG', exact: true }).click()
        check()
        assert.equal((await state()).history, before.history)
        await field.fill('$laterPoint$'); check()
        if (background === 'white') await load(await fixture(2, '$loadedPoint$'))
        check()
        const edited = await state()
        await page.evaluate((s) => window.stzAppLabels.release(s), source)
        return edited
      })
      const svgName = `${scenario}.svg`, svgPath = resolve(artifactDir, svgName)
      await download.saveAs(svgPath)
      const xml = await readFile(svgPath, 'utf8')
      assert.ok(!xml.includes('data-svg-export-exclude'))
      const standalone = await browser.newPage({ viewport: { width: 1000, height: 800 } })
      const requests = [], standaloneErrors = []
      standalone.on('request', (r) => requests.push(r.url())); standalone.on('pageerror', (e) => standaloneErrors.push(e.message))
      let standaloneFailure
      try {
        await standalone.goto(pathToFileURL(svgPath).href)
        const output = await inspectStandalonePoint(standalone, source)
        const fallback = await standaloneLiteral(standalone, fallbackSource)
        const fallbackGeometry = await inspectStandalonePoint(standalone, fallbackSource)
        const standaloneMetric = await standaloneLiteral(standalone, nativeInvalidSource)
        await diagnose(exportGroup, scenario, { pendingMetric, standaloneMetric })
        assertPositionedLiteral(standaloneMetric, nativeInvalidSource)
        for (const property of ['font-family', 'font-size', 'font-style', 'font-weight', 'font-kerning', 'text-rendering']) {
          assert.equal(standaloneMetric.font.properties[property], pendingMetric.literalObservation.font.properties[property], `Standalone font ${property}`)
        }
        // A native settled body supplies the committed bounds removed by export
        // sanitization. Check the download's contour against that same source/font.
        await rendererPage.evaluate(({ source, fallbackSource }) => window.stzLabels.mount({ labels: [], points: [
          { id: 'export-reference', text: source, style: { shape: 'circle', size: 3 } },
          { id: 'fallback-reference', text: fallbackSource, style: { shape: 'circle', size: 3 } },
        ] }), { source, fallbackSource })
        await rendererPage.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'))
        const reference = await inspectPoint(rendererPage, 'export-reference')
        const fallbackReference = await inspectPoint(rendererPage, 'fallback-reference')
        await diagnose(exportGroup, scenario, { pending, pendingFallback, output, fallback, fallbackGeometry, reference, fallbackReference, before, after, requests, standaloneErrors, svgName })
        assert.equal(JSON.parse(pending.request)[0], source)
        assert.equal(output.source, source); assert.equal(output.math, 1); assert.ok(output.paths > 0)
        assert.deepEqual(output.texts, [`captured ${dimension} `])
        assert.equal(output.transform, pending.transform)
        const { body, shape } = output
        assert.ok(body.x >= shape.x && body.y >= shape.y && body.x + body.width <= shape.x + shape.width && body.y + body.height <= shape.y + shape.height)
        assert.notEqual(output.radius, pending.radius)
        assertPointLayout(reference); assertPointLayout(fallbackReference)
        const [x0, y0, x1, y1] = reference.bounds
        assert.ok(Math.abs(output.radius - Math.hypot((x1 - x0) / 2 + 1.8, (y1 - y0) / 2 + 1.8)) < 1e-8)
        assert.equal(output.radius, reference.radius)
        assert.equal(fallbackGeometry.radius, fallbackReference.radius)
        assertPositionedLiteral(fallbackReference.literalObservation, fallbackSource)
        assertPositionedLiteral(fallback, fallbackSource)
        assert.ok(fallbackGeometry.radius > 0)
        assert.equal(Number(output.opacity), .65)
        assert.equal(output.backgrounds, background === 'white' ? 1 : 0)
        assert.equal(output.forbidden, 0); assert.equal(output.unresolvedPaint, false); assert.deepEqual(output.externalReferences, [])
        assert.deepEqual(output.paints, { fill: '#ffffff', stroke: '#3870a0', text: '#000000' })
        assert.deepEqual(standaloneErrors, [])
        assert.deepEqual(requests, [pathToFileURL(svgPath).href])
        const details = { pending, pendingFallback, pendingMetric, standaloneMetric, output, fallback, fallbackGeometry, reference, fallbackReference, before, after, requests, standaloneErrors, svgName }
        const jsonName = `${scenario}-standalone.json`
        await writeFile(resolve(artifactDir, jsonName), JSON.stringify(details, null, 2))
        await observe(`${scenario}-standalone-observed`, details)
        await captureStandaloneSvg(standalone, resolve(artifactDir, `${scenario}.png`), async (capture) => {
          await writeFile(resolve(artifactDir, jsonName), JSON.stringify({ ...details, capture }, null, 2))
        })
        await settle()
        assert.equal((await inspect('app-point')).source, background === 'white' ? '$loadedPoint$' : '$laterPoint$')
        assert.equal((await state()).json, after.json); assert.equal((await state()).history, after.history)
        await saved(scenario, details, exportGroup)
      } catch (error) {
        standaloneFailure = error
        throw error
      } finally {
        await cleanupPointCheck(standaloneFailure, () => standalone.close())
      }
    }
    // Native DOM boundary: complete point capture, dimmed parent, exact fallback,
    // no nested capture and strict contour validation (including a negative control).
    scenario = 'point-whole-node-fallback-opacity-validation'
    await rendererPage.evaluate(() => window.stzLabels.mount({ labels: [], points: [{ id: 'fallback', text: '  $bad\t\n end  ', layer: 0 }] }))
    await rendererPage.evaluate(() => window.stzLabels.filter(1))
    const boundary = await rendererPage.evaluate(async () => {
      const api = await import('/stratified-tikz/src/ui/svgSettledExport.ts')
      const svg = document.querySelector('svg.svg-diagram')
      const capture = api.captureSvgExportSnapshot(svg, { backgroundMode: 'transparent' })
      if (capture.labels.length !== 1 || !capture.labels[0].capture.pointStyle) throw new Error('Nested/incomplete point capture')
      const states = await api.settleSvgExportLabels(capture.labels.map((x) => x.capture))
      const input = capture.labels[0].capture
      const parser = new DOMParser()
      const doc = parser.parseFromString(api.renderSettledSvgLabelDocument(input, states[0]), 'image/svg+xml')
      const rendered = new XMLSerializer().serializeToString(doc)
      const request = doc.querySelector('[data-label-state]').getAttribute('data-label-request')
      const pointRequest = doc.querySelector('[data-point-node]').getAttribute('data-point-request')
      doc.querySelector('[data-point-contour]').setAttribute('r', '1')
      let rejected = false
      try { api.extractSettledSvgLabel(doc, input, states[0]) } catch { rejected = true }
      const xml = await api.prepareSettledSvgExport(capture)
      api.releaseSvgExportSnapshot(capture)
      if (!xml) throw new Error('Whole point fallback export failed')
      return { rejected, xml, rendered, request, pointRequest, state: states[0].status, source: input.source }
    })
    await diagnose(exportGroup, scenario, { boundary })
    assert.equal(boundary.rejected, true); assert.equal(boundary.state, 'fallback')
    assert.equal(JSON.parse(boundary.request)[0], boundary.source); assert.equal(boundary.pointRequest, boundary.request)
    const fallbackPath = resolve(artifactDir, 'point-fallback.svg')
    await writeFile(fallbackPath, boundary.xml)
    const renderedPath = resolve(artifactDir, 'point-fallback-before-sanitization.svg')
    await writeFile(renderedPath, boundary.rendered)
    const reopened = await browser.newPage()
    let reopenFailure
    try {
      await reopened.goto(pathToFileURL(renderedPath).href)
      boundary.serialized = await standaloneLiteral(reopened, boundary.source)
      await diagnose(exportGroup, scenario, { boundary })
      assertPositionedLiteral(boundary.serialized, boundary.source)
      await reopened.goto(pathToFileURL(fallbackPath).href)
      boundary.visible = await standaloneLiteral(reopened, boundary.source)
      boundary.geometry = await inspectStandalonePoint(reopened, boundary.source)
      await diagnose(exportGroup, scenario, { boundary })
      assertPositionedLiteral(boundary.visible, boundary.source)
      assert.ok(Number(boundary.geometry.parentOpacity) < 1)
    } catch (error) { reopenFailure = error; throw error }
    finally { await cleanupPointCheck(reopenFailure, () => reopened.close()) }
    await saved('point-whole-node-fallback-opacity-validation', boundary, exportGroup)
    assert.deepEqual(errors, [])
    await completeGroup(exportGroup)
  } catch (error) {
    primary = error
    await diagnoseNativePointFailure({ page, primary: error,
      diagnose: async (details) => {
        await diagnose(scenario === 'point-native-direct-cursor-workplanes-inspector-persistence' ? bodyGroup : exportGroup, scenario, details)
        await observe('point-native-primary-failure', { message: error.message, stack: error.stack, errors })
      }, details: { errors } })
  } finally {
    for (const wait of owned) wait.dispose(primary)
    await cleanupPointCheck(primary, () => page.close())
    await Promise.all(owned.map((wait) => wait.drain()))
  }
}
