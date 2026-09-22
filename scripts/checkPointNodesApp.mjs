import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ownPageEvent } from './ownedPageEvent.mjs'
import { captureStandaloneSvg } from './standaloneSvgCapture.mjs'
import { inspectPoint, assertPointLayout } from './checkPointNodes.mjs'

export async function runNativePointChecks({ browser, origin, page: rendererPage, artifactDir, saved, startGroup, completeGroup, observe }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
  const errors = [], owned = []
  page.on('pageerror', (e) => errors.push(e.message))
  let primary
  const bodyGroup = 'point-node-body-layout-lifecycle', exportGroup = 'point-node-settled-export'
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
    const point = await inspectPoint(page, id)
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
      const form = page.locator('.direct-input-drawer-form')
      if (ambientDimension === 3) await form.getByLabel('Coordinate mode', { exact: true }).selectOption('global')
      for (const [axis, value] of [['x', '.4'], ['y', '.7'], ...(ambientDimension === 3 ? [['z', '.2']] : [])]) {
        await form.getByRole('textbox', { name: axis, exact: true }).fill(value)
      }
      await form.getByRole('button', { name: 'Create', exact: true }).click()
      let points = (await model()).strata.filter((s) => s.geometricKind === 'point')
      assert.equal(points.length, 1); assert.equal(points[0].codim, ambientDimension)
      assert.deepEqual(points[0].position, { x: .4, y: .7, z: ambientDimension === 3 ? .2 : 0 })
      const close = page.getByRole('button', { name: 'Close direct input drawer', exact: true })
      if (await close.count()) await close.click()
      const field = await selectInspector(points[0].id)
      const source = ` 日本 ${ambientDimension}D $\\frac{a_1}{\\sqrt{x}}$ `
      await field.fill(source)
      const before = await state(), code = await tikz()
      await settle(); assert.equal((await state()).json, before.json); assert.equal((await state()).history, before.history)
      const rendered = await inspectPoint(page, points[0].id); assertPointLayout(rendered); assert.equal(rendered.source, source)
      assert.ok(code.standalone.includes(source) && code.inlineMath.includes(source))
      const invalid = '  $\\missingNativePoint$\t\n tail  '
      await field.fill(invalid); await settle()
      const invalidBody = await inspectPoint(page, points[0].id)
      assert.equal(invalidBody.status, 'fallback'); assert.equal(invalidBody.literal, invalid)
      await page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click()
      await settle(); assert.equal((await inspectPoint(page, points[0].id)).source, source)
      await page.getByRole('button', { name: 'Redo last undone diagram change', exact: true }).click()
      await settle(); assert.equal((await inspectPoint(page, points[0].id)).source, invalid)
      await field.fill(source); await settle()
      assert.equal((await inspectPoint(page, points[0].id)).status, 'ready')
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
        const cursorBody = await inspectPoint(page, created.id); assertPointLayout(cursorBody)
        cursors.push({ plane, created, body: cursorBody })
        await page.getByRole('button', { name: 'Close inspector drawer', exact: true }).click()
      }
      const beforeSave = await state()
      const { event: download } = await eventAction('point-json', 'download', () => page.getByRole('button', { name: 'Download JSON', exact: true }).click())
      const path = resolve(artifactDir, `point-native-${ambientDimension}d.json`); await download.saveAs(path)
      const json = await readFile(path, 'utf8'); assert.deepEqual(JSON.parse(json), JSON.parse(beforeSave.json))
      await load(json); await settle(); assert.deepEqual(await model(), JSON.parse(json).diagram)
      entries.push({ ambientDimension, direct: rendered, invalidBody, cursors, code, jsonPath: path, beforeSave, loaded: await state() })
    }
    await saved('point-native-direct-cursor-workplanes-inspector-persistence', entries, bodyGroup)
    await startGroup(exportGroup)
    for (const [background, dimension, scenario] of [
      ['transparent', 2, 'point-native-pending-transparent-edit'], ['white', 3, 'point-native-pending-white-load'],
    ]) {
      const source = `captured ${dimension} $\\frac{a_1}{\\sqrt{x}}$`
      await page.evaluate((s) => window.stzAppLabels.hold(s), source)
      await load(await fixture(dimension, source))
      await page.waitForFunction((s) => window.stzAppLabels.pending(s)?.started > 0, source)
      const field = await selectInspector('app-point')
      const pending = await inspectPoint(page, 'app-point'); assert.equal(pending.status, 'pending'); assertPointLayout(pending)
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
      assert.ok(xml.includes('data-point-node') && !xml.includes('data-svg-export-exclude'))
      const standalone = await browser.newPage({ viewport: { width: 1000, height: 800 } })
      const requests = [], standaloneErrors = []
      standalone.on('request', (r) => requests.push(r.url())); standalone.on('pageerror', (e) => standaloneErrors.push(e.message))
      let standaloneFailure
      try {
        await standalone.goto(pathToFileURL(svgPath).href)
        const output = await standalone.evaluate(() => {
          const p = document.querySelector('[data-point-node]'), body = p?.querySelector('[data-label-state]'), contour = p?.querySelector('[data-point-contour]')
          if (!p || !body || !contour) throw new Error('Missing standalone point')
          const bounds = body.getAttribute('data-label-bounds').split(' ').map(Number)
          return { source: body.getAttribute('data-label-source'), request: body.getAttribute('data-label-request'),
            pointRequest: p.getAttribute('data-point-request'), bounds, radius: Number(contour.getAttribute('r')),
            math: body.querySelectorAll('[data-label-math]').length, status: body.getAttribute('data-label-state'),
            transform: p.getAttribute('transform'), opacity: contour.getAttribute('opacity'),
            backgrounds: document.querySelectorAll('[data-stratified-tikz-export-background]').length,
            forbidden: document.querySelectorAll('parsererror, script, style, image, foreignObject').length,
            paints: { fill: contour.getAttribute('fill'), stroke: contour.getAttribute('stroke'),
              text: body.querySelector('[data-label-content]').parentElement.getAttribute('fill') },
            unresolvedPaint: [...document.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => /currentColor/i.test(a.value))),
            externalReferences: [...document.querySelectorAll('[href]')].map((e) => e.getAttribute('href')).filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))) }
        })
        assert.equal(output.source, source); assert.equal(output.status, 'ready'); assert.equal(output.math, 1)
        assert.equal(output.pointRequest, output.request); assert.equal(output.transform, pending.transform)
        const [x0, y0, x1, y1] = output.bounds
        assert.ok(Math.abs(output.radius - Math.hypot((x1 - x0) / 2 + 1.8, (y1 - y0) / 2 + 1.8)) < 1e-8)
        assert.notEqual(output.radius, pending.radius)
        assert.equal(Number(output.opacity), .65)
        assert.equal(output.backgrounds, background === 'white' ? 1 : 0)
        assert.equal(output.forbidden, 0); assert.equal(output.unresolvedPaint, false); assert.deepEqual(output.externalReferences, [])
        assert.deepEqual(output.paints, { fill: '#ffffff', stroke: '#3870a0', text: '#000000' })
        assert.deepEqual(standaloneErrors, [])
        assert.deepEqual(requests, [pathToFileURL(svgPath).href])
        const details = { pending, output, before, after, requests, standaloneErrors, svgName }
        const jsonName = `${scenario}-standalone.json`
        await writeFile(resolve(artifactDir, jsonName), JSON.stringify(details, null, 2))
        await observe(`${scenario}-standalone-observed`, details)
        await captureStandaloneSvg(standalone, resolve(artifactDir, `${scenario}.png`), async (capture) => {
          await writeFile(resolve(artifactDir, jsonName), JSON.stringify({ ...details, capture }, null, 2))
        })
        await settle()
        assert.equal((await inspectPoint(page, 'app-point')).source, background === 'white' ? '$loadedPoint$' : '$laterPoint$')
        assert.equal((await state()).json, after.json); assert.equal((await state()).history, after.history)
        await saved(scenario, details, exportGroup)
      } catch (error) {
        standaloneFailure = error
        throw error
      } finally {
        try { await standalone.close() } catch (error) { if (!standaloneFailure) throw error }
      }
    }
    // Native DOM boundary: complete point capture, dimmed parent, exact fallback,
    // no nested capture and strict contour validation (including a negative control).
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
      doc.querySelector('[data-point-contour]').setAttribute('r', '1')
      let rejected = false
      try { api.extractSettledSvgLabel(doc, input, states[0]) } catch { rejected = true }
      const xml = await api.prepareSettledSvgExport(capture)
      api.releaseSvgExportSnapshot(capture)
      if (!xml) throw new Error('Whole point fallback export failed')
      const final = parser.parseFromString(xml, 'image/svg+xml')
      return { rejected, xml, state: states[0].status, source: input.source,
        text: [...final.querySelectorAll('[data-label-literal]')].map((n) => n.textContent).join(''),
        parentOpacity: final.querySelector('[data-point-node]').parentElement.getAttribute('opacity') }
    })
    assert.equal(boundary.rejected, true); assert.equal(boundary.state, 'fallback'); assert.equal(boundary.text, boundary.source)
    assert.ok(Number(boundary.parentOpacity) < 1)
    await writeFile(resolve(artifactDir, 'point-fallback.svg'), boundary.xml)
    await saved('point-whole-node-fallback-opacity-validation', boundary, exportGroup)
    assert.deepEqual(errors, [])
    await completeGroup(exportGroup)
  } catch (error) {
    primary = error
    try { await observe('point-native-primary-failure', { message: error.message, stack: error.stack, errors }) }
    catch (diagnosticError) { console.error('Point failure diagnostics:', diagnosticError) }
    throw error
  } finally {
    for (const wait of owned) wait.dispose(primary)
    try { await page.close() } catch (error) { if (!primary) throw error }
    await Promise.all(owned.map((wait) => wait.drain()))
  }
}
