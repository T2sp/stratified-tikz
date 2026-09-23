import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pointNodeScenarioArtifacts } from './automation/phase-verification.mjs'
import { inspectPoint, assertPointLayout } from './checkPointNodes.mjs'
import { observePointPaint, assertPointPaint, rasterPointOverlap, assertRasterPointOverlap } from './pointPaintOracle.mjs'
import { observePointLiteral, assertPositionedLiteral } from './pointLiteralOracle.mjs'
import { ownPageEvent } from './ownedPageEvent.mjs'
import { saveAppJson, checkAppJsonReload } from './appJsonPersistence.mjs'
import { captureStandaloneSvg } from './standaloneSvgCapture.mjs'
import { cleanupPointCheck, createPointDiagnostics } from './pointCheckDiagnostics.mjs'

const group = 'point-node-paint-import-persistence'
const mixed = { text: { color: '#ff0000', opacity: .6 }, fill: { enabled: true, color: '#0000ff', opacity: .35 },
  stroke: { enabled: true, color: '#008000', opacity: .7, width: 2, lineStyle: 'dashed', dashPhase: 0, lineCap: 'round', lineJoin: 'bevel' } }
const mixedExpected = { fill: 'rgb(0, 0, 255)', stroke: 'rgb(0, 128, 0)', fillAlpha: .35, strokeAlpha: .7,
  strokeWidth: 2.4, dashed: true, cap: 'round', join: 'bevel', text: 'rgb(255, 0, 0)', textAlpha: .6 }
const importedSource = String.raw`% Phase 32B native import acceptance; literal colors, ordered references.
\definecolor{PaintBlue}{HTML}{0000FF}
\tikzstyle{paint base node}=[circle,text=red,fill=PaintBlue,fill opacity=.35,draw=green,draw opacity=.7,line width=2pt,dashed]
\tikzset{paint imported node/.style={paint base node,text opacity=.6},
  paint text node/.style={text=red},
  paint ordered node/.style={circle,draw=green,fill=PaintBlue,draw opacity=.2,opacity=.8,fill opacity=.3,text opacity=.6},
  paint unsupported node/.style={circle,trapezium left angle=70}}
`

export async function runPointNodePaintChecks(context) {
  const { browser, origin, page: rendererPage, artifactDir, startGroup, completeGroup, record, observe } = context
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
  const errors = [], owned = [], held = new Set()
  page.on('pageerror', (error) => errors.push(error.message))
  const diagnose = createPointDiagnostics({ artifactDir, artifactPrefix: 'point-paint-observation', observe: (name, details) => observe(`paint-${name}`, details) })
  let primary, cleanupFailure, scenario = 'point-paint-native-inspector-history'
  const observeCase = (details) => diagnose(group, scenario, details)
  const state = () => page.evaluate(() => window.stzAppLabels.state())
  const model = async () => JSON.parse((await state()).json).diagram
  const point = async (id = 'app-point') => (await model()).strata.find((item) => item.id === id)
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const inspector = page.locator('#preview-inspector-drawer')
  const field = (name) => inspector.getByLabel(name, { exact: true })
  const undo = () => page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click()
  const redo = () => page.getByRole('button', { name: 'Redo last undone diagram change', exact: true }).click()
  async function eventAction(name, event, action) {
    const wait = ownPageEvent(page, event, { name, timeoutMs: 30_000 }); owned.push(wait)
    return wait.run(action)
  }
  async function load(json) {
    const before = await state()
    const { event } = await eventAction('point-paint-load', 'filechooser', () => page.getByRole('button', { name: 'Load JSON', exact: true }).click({ timeout: 5000 }))
    await event.setFiles({ name: 'point-paint.json', mimeType: 'application/json', buffer: Buffer.from(json) })
    await page.waitForFunction((revision) => window.stzAppLabels.state().labelDocumentRevision > revision, before.labelDocumentRevision)
  }
  async function select(id = 'app-point', additive = false) {
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded()
    const rendered = await inspectPoint(page, id)
    assert.ok(rendered, `Native point ${id} exists`)
    if (additive) await page.keyboard.down('Shift')
    try { await page.mouse.click(rendered.center.x, rendered.center.y) }
    finally { if (additive) await page.keyboard.up('Shift') }
    const open = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
    if (await open.count()) await open.click()
    const expand = inspector.getByRole('button', { name: 'Expand', exact: true })
    if (await expand.count()) await expand.click()
  }
  async function paintObservation(id = 'app-point') {
    const observation = await observePointPaint(page, { id })
    await observeCase({ boundary: 'native-paint', id, observation, state: await state() })
    return observation
  }
  async function saved(details) {
    await writeFile(resolve(artifactDir, `${scenario}.json`), JSON.stringify({ scenario, group, result: 'passed', ...details }, null, 2) + '\n')
    await record(scenario, { group, result: 'passed', artifacts: pointNodeScenarioArtifacts(scenario) })
  }
  async function tikz() {
    const output = {}
    for (const mode of ['standalone', 'inlineMath']) {
      await page.getByLabel(/^TikZ export mode:/).selectOption(mode)
      output[mode] = await page.getByRole('textbox', { name: 'Generated TikZ source', exact: true }).inputValue()
    }
    return output
  }
  async function edit(label, value) {
    const input = field(label)
    if (await input.getAttribute('type') === 'color') {
      // Color pickers have no portable Playwright fill action. Dispatch the
      // native input/change events through React's actual production handler.
      await input.evaluate((element, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }, value)
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    } else await input.fill(value)
  }
  async function setMixedPaint() {
    for (const [label, value] of [['Text color', '#ff0000'], ['Text opacity', '.6'], ['Fill color', '#0000ff'], ['Fill opacity', '.35'],
      ['Border color', '#008000'], ['Border opacity', '.7'], ['Border width', '2']]) await edit(label, value)
    await field('Fill enabled').check(); await field('Border enabled').check()
    await field('Border line style').selectOption('dashed'); await field('Border cap').selectOption('round'); await field('Border join').selectOption('bevel')
  }
  try {
    context.setStage?.(group); await startGroup(group, scenario)
    await page.goto(`${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`)
    await page.waitForFunction(() => window.stzAppLabels !== undefined)
    const legacy = await page.evaluate(() => window.stzAppLabels.pointPaintLegacyDocumentJson())
    await writeFile(resolve(artifactDir, 'point-paint-legacy.json'), legacy)
    await load(legacy); await settle(); await select()
    const before = await paintObservation(), initial = await state()
    assertPointPaint(before, { fill: 'rgb(255, 255, 255)', stroke: 'rgb(56, 112, 160)', fillAlpha: 1, strokeAlpha: 1,
      strokeWidth: .48, text: 'rgb(0, 0, 0)', textAlpha: 1 })
    assert.equal((await point()).codim, 2)
    assert.equal((await model()).userStylePresets[0].style.paint.fill.color.toLowerCase(), '#ffffff')
    await setMixedPaint()
    const painted = await paintObservation()
    assert.deepEqual((await point()).style.paint, mixed)
    assertPointPaint(painted, { ...mixedExpected, explicitMathColor: 'rgb(128, 0, 128)' })
    assert.equal(painted.request, before.request); assert.deepEqual(painted.bodyBounds, before.bodyBounds)
    assert.deepEqual(painted.shapeBounds, before.shapeBounds); assert.equal((await state()).requests, initial.requests)
    const code = await tikz()
    for (const output of Object.values(code)) {
      for (const color of ['FF0000', '0000FF', '008000']) assert.ok(output.toUpperCase().includes(color), color)
      for (const option of ['fill opacity=0.35', 'draw opacity=0.7', 'text opacity=0.6', 'line width=2pt', 'dashed']) assert.ok(output.includes(option), option)
    }
    // A single native field event is a single undo step, including zero alpha.
    await field('Text opacity').fill('0'); assert.equal((await point()).style.paint.text.opacity, 0)
    const zero = await paintObservation(); assertPointPaint(zero, { ...mixedExpected, textAlpha: 0 })
    await undo(); assert.equal((await point()).style.paint.text.opacity, .6)
    await redo(); assert.equal((await point()).style.paint.text.opacity, 0)
    await field('Text opacity').fill('.6')
    const finiteBefore = await state(); await field('Border width').fill('NaN')
    assert.equal(await field('Border width').getAttribute('aria-invalid'), 'true')
    assert.equal((await state()).json, finiteBefore.json); assert.equal((await state()).history, finiteBefore.history)
    await field('Border width').fill('2')
    const variants = []
    await field('Fill enabled').uncheck(); variants.push(await paintObservation()); assertPointPaint(variants.at(-1), { fill: 'none' })
    await field('Border enabled').uncheck(); variants.push(await paintObservation()); assertPointPaint(variants.at(-1), { fill: 'none', stroke: 'none' })
    await field('Fill enabled').check(); await edit('Fill color', '#ffffff')
    await field('Fill opacity').fill('1'); variants.push(await paintObservation()); assertPointPaint(variants.at(-1), { fill: 'rgb(255, 255, 255)', fillAlpha: 1, stroke: 'none' })
    await setMixedPaint()
    await inspector.getByRole('button', { name: 'Copy style', exact: true }).click()
    await select('copy-point'); await inspector.getByRole('button', { name: 'Paste style', exact: true }).click()
    assert.deepEqual((await point('copy-point')).style.paint, mixed)
    await edit('Text color', '#123456'); assert.equal((await point()).style.paint.text.color, '#ff0000')
    await select('app-point'); await inspector.getByRole('button', { name: 'Copy style', exact: true }).click()
    await select('copy-point'); await select('bulk-point', true)
    await inspector.getByRole('button', { name: 'Paste style', exact: true }).click()
    for (const id of ['copy-point', 'bulk-point']) assert.deepEqual((await point(id)).style.paint, mixed)
    const beforeDuplicate = (await model()).strata.length
    await inspector.getByRole('button', { name: 'Duplicate', exact: true }).click()
    const duplicated = (await model()).strata.filter((item) => !['app-point', 'copy-point', 'bulk-point'].includes(item.id))
    assert.equal((await model()).strata.length, beforeDuplicate + 2)
    duplicated.forEach((item) => assert.deepEqual(item.style.paint, mixed))
    await undo(); assert.equal((await model()).strata.length, beforeDuplicate)
    await redo(); assert.equal((await model()).strata.length, beforeDuplicate + 2)
    await saved({ before, initial, painted, zero, variants, code, duplicated, final: await state() })

    scenario = 'point-paint-imported-presets-persistence'
    await load(legacy); await settle(); await select()
    await writeFile(resolve(artifactDir, 'point-paint-import.sty'), importedSource)
    const { event: chooser } = await eventAction('point-paint-import', 'filechooser', () => page.getByRole('button', { name: 'Choose .sty/.tex', exact: true }).click())
    await chooser.setFiles({ name: 'point-paint-import.sty', mimeType: 'text/plain', buffer: Buffer.from(importedSource) })
    await page.waitForFunction(() => JSON.parse(window.stzAppLabels.state().json).diagram.importedTikzStyleReferences?.some((reference) => reference.key === 'paint imported node'))
    const imported = []
    for (const key of ['paint imported node', 'paint text node', 'paint ordered node', 'paint unsupported node']) {
      const button = inspector.locator('.style-preset-list-item').filter({ hasText: key })
      assert.equal(await button.count(), 1, `One imported preset ${key}`); await button.click()
      await inspector.getByRole('button', { name: 'Apply', exact: true }).click()
      const observation = await paintObservation(), current = await point(), output = await tikz()
      imported.push({ key, observation, current, output })
      assert.ok(current.importedTikzStyleReferenceId)
      for (const value of Object.values(output)) assert.ok(value.includes(key), `External key ${key} retained`)
      if (key === 'paint imported node') assertPointPaint(observation, { ...mixedExpected, stroke: 'rgb(0, 255, 0)', cap: 'butt', join: 'miter' })
      if (key === 'paint text node') {
        assertPointPaint(observation, { text: 'rgb(255, 0, 0)', textAlpha: 1, fill: 'rgb(0, 0, 0)', stroke: 'rgb(0, 0, 0)',
          fillAlpha: 1, strokeAlpha: 1, strokeWidth: .48, dashed: false, cap: 'butt', join: 'miter' })
        assert.equal(current.style.shape, 'circle'); assert.equal(current.style.size, 3)
        for (const value of Object.values(output)) {
          assert.ok(value.includes('circle') && value.includes('inner sep=1.5pt'))
          const afterExternal = value.slice(value.lastIndexOf(key))
          for (const option of ['draw=', 'fill=', 'text=', 'line width=0.4pt', 'solid']) assert.ok(afterExternal.includes(option), `Partial imported style materializes ${option}`)
        }
      }
      if (key === 'paint ordered node') assertPointPaint(observation, { fill: 'rgb(0, 0, 255)', stroke: 'rgb(0, 255, 0)', fillAlpha: .3, strokeAlpha: .8, text: 'rgb(0, 0, 0)', textAlpha: .6 })
      if (key === 'paint unsupported node') {
        const reference = (await model()).importedTikzStyleReferences.find((entry) => entry.id === current.importedTikzStyleReferenceId)
        assert.ok(reference.options.includes('trapezium left angle=70'))
        assert.ok(reference.previewDiagnostics?.length > 0, 'Deferred layout is visibly diagnosed')
        assert.match(await inspector.innerText(), /unsupported|preview|deferred/i)
      }
    }
    await inspector.locator('.style-preset-list-item').filter({ hasText: 'paint imported node' }).click()
    await inspector.getByRole('button', { name: 'Apply', exact: true }).click()
    await edit('Border color', '#008000'); await field('Border cap').selectOption('round'); await field('Border join').selectOption('bevel')
    const importedMixed = structuredClone((await point()).style.paint)
    const canonicalPaint = (paint) => ({ ...paint, text: { ...paint.text, color: paint.text.color.toLowerCase() },
      fill: { ...paint.fill, color: paint.fill.color.toLowerCase() }, stroke: { ...paint.stroke, color: paint.stroke.color.toLowerCase() } })
    assert.deepEqual(canonicalPaint(importedMixed), mixed)
    const overrides = await tikz()
    for (const value of Object.values(overrides)) {
      const external = value.lastIndexOf('paint imported node')
      assert.ok(external >= 0 && /draw=/.test(value.slice(external)), 'Local border override is emitted after external style')
    }
    const download = await saveAppJson({ page, artifactDir, name: 'point-paint-saved', owned, diagnose: observeCase })
    await edit('Text color', '#654321'); await load(download.json); await settle()
    const reloaded = await checkAppJsonReload({ page, saved: download, diagnose: observeCase })
    assert.deepEqual((await point()).style.paint, importedMixed)
    assert.ok((await model()).userStylePresets.some((preset) => preset.id === 'legacy-paint-preset'))
    await saved({ imported, overrides, download, reloaded, final: await state() })

    scenario = 'point-paint-lifecycle-dimming'
    await select()
    const source = ' pending $\\frac{paint}{x}$\t\n tail  '
    await page.evaluate((source) => window.stzAppLabels.hold(source), source); held.add(source)
    await field('Node text').fill(source)
    await page.waitForFunction((source) => window.stzAppLabels.pending(source)?.started > 0, source)
    const pending = await inspectPoint(page, 'app-point'); assertPointLayout(pending); assertPositionedLiteral(pending.literalObservation, source)
    const pendingState = await state(); await field('Fill opacity').fill('.2'); await field('Border width').fill('3')
    const pendingPaint = await paintObservation(); assert.equal(pendingPaint.request, pending.request)
    assert.equal((await state()).requests, pendingState.requests)
    assertPointPaint(pendingPaint, { ...mixedExpected, fillAlpha: .2, strokeWidth: 3.6 })
    await page.evaluate((source) => window.stzAppLabels.release(source), source); held.delete(source); await settle()
    const settled = await inspectPoint(page, 'app-point'); assertPointLayout(settled); assert.equal(settled.status, 'ready')
    const fallbackSource = '  $\\missingPaintMacro$\t\n end  '
    await field('Node text').fill(fallbackSource); await settle()
    const fallback = await inspectPoint(page, 'app-point'); assertPointLayout(fallback); assertPositionedLiteral(fallback.literalObservation, fallbackSource)
    assertPointPaint(await paintObservation(), { ...mixedExpected, fillAlpha: .2, strokeWidth: 3.6 })
    // Production renderer's actual 3D occlusion policy, independent DOM alphas,
    // and raster source-over observation; no synthetic conversion replaces math.
    const overlapPaint = { ...mixed, fill: { ...mixed.fill, opacity: .4 }, stroke: { ...mixed.stroke, opacity: .6, width: 8, lineStyle: 'solid' } }
    await rendererPage.evaluate((paint) => window.stzLabels.mount({ ambientDimension: 3, labels: [], occlusion: 'autoDim', points: [
      { id: 'paint-dim', text: '$g_j$', position: { x: 0, y: -1, z: 0 }, style: { opacity: .5, size: 80, paint } },
    ] }), overlapPaint)
    await rendererPage.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'))
    const dimmed = await observePointPaint(rendererPage, { id: 'paint-dim' })
    assertPointPaint(dimmed, { fillAlpha: .2 * .28, strokeAlpha: .3 * .28, text: 'rgb(255, 0, 0)', textAlpha: .3 * .28 })
    await rendererPage.evaluate(() => window.stzLabels.setProps({ visibilityOptions: { enabled: false } }))
    const visible = await observePointPaint(rendererPage, { id: 'paint-dim' })
    assertPointPaint(visible, { fillAlpha: .2, strokeAlpha: .3, text: 'rgb(255, 0, 0)', textAlpha: .3 })
    const raster = await rasterPointOverlap(rendererPage, 'paint-dim'); await observeCase({ dimmed, visible, raster }); assertRasterPointOverlap(raster)
    await saved({ pending, pendingPaint, settled, fallback, dimmed, visible, raster })

    for (const background of ['transparent', 'white']) {
      scenario = `point-paint-pending-${background}-${background === 'white' ? 'load' : 'edit'}`
      const source = `captured ${background} $\\frac{x}{\\sqrt{y}}$`
      await load(legacy); await settle(); await select(); await setMixedPaint()
      await page.evaluate((source) => window.stzAppLabels.hold(source), source); held.add(source)
      await field('Node text').fill(source)
      await page.waitForFunction((source) => window.stzAppLabels.pending(source)?.started > 0, source)
      const pending = await inspectPoint(page, 'app-point'), paint = await paintObservation()
      assertPointLayout(pending); assertPositionedLiteral(pending.literalObservation, source); assertPointPaint(paint, mixedExpected)
      await page.getByLabel('SVG export background', { exact: true }).selectOption(background)
      await page.evaluate(() => window.stzAppLabels.armPointExportClick(['app-point']))
      let capture
      const { event: download, value: after } = await eventAction(scenario, 'download', async ({ check }) => {
        await page.getByRole('button', { name: 'Export current diagram view as SVG', exact: true }).click(); check()
        capture = await page.evaluate(() => window.stzAppLabels.pointExportClick())
        await observeCase({ boundary: 'download-click', capture, pending, paint })
        assert.equal(capture.error, undefined); assert.deepEqual(capture.snapshot.points[0].style.paint, mixed)
        await edit('Text color', '#123456'); await field('Fill enabled').uncheck(); await field('Border width').fill('7'); check()
        if (background === 'white') await load(legacy)
        const after = await state()
        await page.evaluate((source) => window.stzAppLabels.release(source), source); held.delete(source)
        return after
      })
      await page.evaluate(() => window.stzAppLabels.releasePointExportClick())
      const svgPath = resolve(artifactDir, `${scenario}.svg`); await download.saveAs(svgPath)
      const xml = await readFile(svgPath, 'utf8'); assert.ok(!xml.includes('data-svg-export-exclude'))
      const standalone = await browser.newPage({ viewport: { width: 1000, height: 800 } })
      const requests = [], standaloneErrors = []; let standaloneFailure
      standalone.on('request', (request) => requests.push(request.url())); standalone.on('pageerror', (error) => standaloneErrors.push(error.message))
      try {
        await standalone.goto(pathToFileURL(svgPath).href)
        const output = await observePointPaint(standalone, { source, standalone: true })
        const literal = await observePointLiteral(standalone, { source, standalone: true })
        const details = { pending, paint, capture, after, output, literal, requests, standaloneErrors, svgPath }
        const persist = async (screenshot) => writeFile(resolve(artifactDir, `${scenario}-standalone.json`), JSON.stringify({ ...details, screenshot }, null, 2) + '\n')
        await persist(); await observeCase(details)
        assertPointPaint(output, mixedExpected); assert.equal(output.source, source); assert.ok(output.mathPaths > 0)
        assert.equal(output.backgroundCount, background === 'white' ? 1 : 0)
        assert.equal(output.forbidden, 0); assert.deepEqual(output.externalReferences, []); assert.deepEqual(standaloneErrors, [])
        assert.deepEqual(requests, [pathToFileURL(svgPath).href])
        await rendererPage.evaluate(({ source, style }) => window.stzLabels.mount({ labels: [], points: [{ id: 'paint-export-reference', text: source, style }] }),
          { source, style: capture.snapshot.points[0].style })
        await rendererPage.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'))
        const reference = await inspectPoint(rendererPage, 'paint-export-reference'); assertPointLayout(reference)
        await observeCase({ boundary: 'settled-download-reference', output, reference })
        assert.equal(output.radius, reference.radius, 'Whole-node export uses settled captured body/contour geometry')
        for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(output.bodyBounds[key] - reference.body[key]) < .01, `Standalone native ink ${key} matches settled production body`)
        assert.notEqual(output.radius, pending.radius, 'Pending literal contour was rebuilt for captured math')
        await captureStandaloneSvg(standalone, resolve(artifactDir, `${scenario}.png`), persist)
        await settle(); assert.equal((await state()).json, after.json); assert.equal((await state()).history, after.history)
        await saved(details)
      } catch (error) { standaloneFailure = error; await observeCase({ boundary: 'standalone-failure', svgPath, error: { message: error.message, stack: error.stack }, requests, standaloneErrors }); throw error }
      finally { await cleanupPointCheck(standaloneFailure, () => standalone.close()) }
    }
    assert.deepEqual(errors, []); await completeGroup(group)
  } catch (error) {
    primary = error
    try { await observeCase({ boundary: 'primary-failure', error: { message: error.message, stack: error.stack }, errors, state: await state() }) }
    catch (diagnosticError) { console.error('Point paint failure diagnostics:', diagnosticError) }
  } finally {
    for (const wait of owned) wait.dispose(primary)
    const cleanup = async (operation) => {
      try { await operation() }
      catch (error) { cleanupFailure ??= error; console.error('Point paint cleanup:', error) }
    }
    for (const source of held) await cleanup(() => page.evaluate((source) => window.stzAppLabels.release(source), source))
    await cleanup(() => page.close())
    for (const wait of owned) await cleanup(() => wait.drain())
  }
  if (primary) throw primary
  if (cleanupFailure) throw cleanupFailure
}
