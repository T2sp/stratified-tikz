/**
 * Actual-browser Phase 31C checks against production SvgDiagram and its event
 * handlers. Uses the existing external-Playwright convention; adds no package.
 *
 * STZ_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
 * STZ_BROWSER_EXECUTABLE=/absolute/path/to/chrome node scripts/checkFreeLabels.mjs
 */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const playwrightModule = process.env.STZ_PLAYWRIGHT_MODULE ?? 'playwright'
let chromium
try {
  ;({ chromium } = await import(isAbsolute(playwrightModule) ? pathToFileURL(playwrightModule).href : playwrightModule))
} catch (error) {
  throw new Error('Browser check unavailable: provide STZ_PLAYWRIGHT_MODULE (no browser check has passed)', { cause: error })
}
const server = process.env.STZ_BROWSER_BASE_URL ? null
  : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
if (server) await server.listen()
const address = server?.httpServer.address()
assert.ok(process.env.STZ_BROWSER_BASE_URL || (address && typeof address !== 'string'))
const origin = process.env.STZ_BROWSER_BASE_URL ?? `http://127.0.0.1:${address.port}`
const evidence = []
let browser
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.STZ_BROWSER_EXECUTABLE ? { executablePath: process.env.STZ_BROWSER_EXECUTABLE } : {}) })
  const environment = { browserVersion: browser.version(), nodeVersion: process.version }
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${origin}/stratified-tikz/scripts/fixtures/freeLabels.html`)
  await page.waitForFunction(() => window.stzLabels !== undefined)

  const mount = (labels, extra = {}) => page.evaluate((options) => window.stzLabels.mount(options), { labels, ...extra })
  const state = () => page.evaluate(() => window.stzLabels.state())
  const settled = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  const label = (id) => page.locator(`[data-label-id="${id}"] [data-label-state]`)
  const inspect = (id) => page.evaluate((labelId) => {
    const outer = document.querySelector(`[data-label-id="${labelId}"]`)
    const node = outer?.querySelector('[data-label-state]')
    if (!node) return null
    const box = node.getBBox()
    const rect = node.getBoundingClientRect()
    return {
      source: node.getAttribute('data-label-source'), state: node.getAttribute('data-label-state'),
      math: node.querySelectorAll('[data-label-math]').length,
      literal: Array.from(node.querySelectorAll('[data-label-literal]')).map((text) => text.textContent).join(''),
      text: Array.from(node.querySelectorAll('text')).map((text) => text.textContent).join(''),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      transform: node.getAttribute('transform'), color: node.getAttribute('color'), opacity: node.getAttribute('opacity'),
      paint: node.querySelector(':scope > g')?.getAttribute('color'), paintOpacity: node.querySelector(':scope > g')?.getAttribute('opacity'),
      attrs: Object.fromEntries(Array.from(node.attributes, ({ name, value }) => [name, value])),
    }
  }, id)
  const click = async (id) => {
    const found = await inspect(id)
    assert.ok(found, `Rendered label ${id} exists`)
    await page.mouse.click(found.rect.x + found.rect.width / 2, found.rect.y + found.rect.height / 2)
  }
  async function record(name, details = {}) {
    evidence.push({ name, ...details })
    console.log(JSON.stringify({ result: 'passed', name, ...details }))
  }

  const fallbackSource = '  "<>&"  \\textbf{bad}\t keep \\slash\r\n tail  '
  const sources = [
    { id: 'F', text: '$F^{(1)}L$' },
    { id: 'alpha', text: '$\\alpha \\colon f \\Rightarrow g$' },
    { id: 'fraction', text: '$\\frac{1}{1+\\frac{x}{y}}$' },
    { id: 'japanese', text: '日本語 $x_i$ と $\\beta$' },
    { id: 'lines', text: 'first $x$\nsecond $y$' },
    { id: 'matrix', text: '$\\begin{matrix}a & b \\\\\n c & d\\end{matrix}$' },
    { id: 'fallback', text: fallbackSource },
    { id: 'undefined', text: '$\\definitelyUndefinedCommand{x}$' },
    { id: 'parse', text: 'prefix $unclosed' },
  ]
  await mount(sources)
  const initial = await state()
  await settled()
  for (const entry of sources) {
    const displayed = await inspect(entry.id)
    assert.equal(displayed.source, entry.text)
    const fallback = ['fallback', 'undefined', 'parse'].includes(entry.id)
    assert.equal(displayed.state, fallback ? 'fallback' : 'ready', entry.id)
    assert.equal(displayed.math > 0, !fallback, entry.id)
    assert.ok(Object.values(displayed.box).every(Number.isFinite))
  }
  assert.equal((await inspect('japanese')).math, 2)
  assert.equal((await inspect('matrix')).math, 1, 'A physical newline inside math stays in one formula')
  assert.ok((await inspect('lines')).box.height > (await inspect('F')).box.height)
  const after = await state()
  for (const key of ['json', 'history', 'tikz', 'inlineTikz']) assert.equal(after[key], initial[key], `${key} unaffected by arrivals`)
  assert.equal(await page.locator('foreignObject, image').count(), 0)
  assert.equal(await page.locator('script:not([type="module"])').count(), 0)
  const fallbackSpacing = await page.evaluate(() => {
    const node = document.querySelector('[data-label-id="fallback"] [data-label-state]')
    return Array.from(node.querySelectorAll('text'), (text) => ({
      text: text.textContent, whiteSpace: getComputedStyle(text).whiteSpace, xmlSpace: text.getAttribute('xml:space'),
      x: text.x.baseVal.getItem(0).value, y: text.y.baseVal.getItem(0).value, width: text.getComputedTextLength(),
      spaceWidth: (() => { const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); context.font = getComputedStyle(text).font; return context.measureText(' ').width })(),
      tspans: Array.from(text.querySelectorAll('tspan'), (span) => ({ text: span.textContent, x: span.getAttribute('x'), y: span.getAttribute('y') })),
    }))
  })
  assert.ok(fallbackSpacing.every((text) => /pre|break-spaces/.test(text.whiteSpace) || text.xmlSpace === 'preserve'))
  assert.ok(fallbackSpacing.map((text) => text.text).join('').includes('  "<>&"  \\textbf{bad}'))
  assert.equal(fallbackSpacing.length, 3, 'Tab and CRLF split the literal into positioned fragments')
  const stop = fallbackSpacing[0].spaceWidth * 4
  assert.ok(Math.abs(fallbackSpacing[1].x - (Math.floor(fallbackSpacing[0].width / stop) + 1) * stop) < 0.5, 'Tab advances to a measured four-space stop')
  assert.equal(fallbackSpacing[0].y, fallbackSpacing[1].y)
  assert.ok(fallbackSpacing[2].y > fallbackSpacing[1].y, 'CRLF is exactly one physical line break')
  await record('real MathJax, Japanese/multiple runs/newlines, whole-source failure, raw model/TikZ/history preservation', { mathInvocations: after.invocationCount })

  const anchors = ['center', 'north', 'south', 'east', 'west', 'north east', 'north west', 'south east', 'south west']
  await mount(anchors.map((anchor, index) => ({ id: `anchor${index}`, text: '$\\frac{x_1}{y^2}$', style: { anchor, fontSize: 20, color: '#d02080', opacity: 0.6 } })))
  await settled()
  const anchored = await state()
  for (const [index, anchor] of anchors.entries()) {
    const item = await inspect(`anchor${index}`)
    assert.equal(item.paint, '#d02080')
    assert.equal(item.paintOpacity, '0.6')
    const projected = anchored.positions[`anchor${index}`]
    // Native layout bounds must be on the requested side of the projected
    // anchor. Vertical font line metrics may leave harmless leading around ink.
    const x = item.rect.x, y = item.rect.y, w = item.rect.width, h = item.rect.height
    if (anchor.includes('west')) assert.ok(Math.abs(x - projected.x) < 2, `${anchor} left`)
    else if (anchor.includes('east')) assert.ok(Math.abs(x + w - projected.x) < 2, `${anchor} right`)
    else assert.ok(Math.abs(x + w / 2 - projected.x) < 2, `${anchor} horizontal center`)
    if (anchor.includes('north')) assert.ok(Math.abs(y - projected.y) < 2, `${anchor} top`)
    else if (anchor.includes('south')) assert.ok(Math.abs(y + h - projected.y) < 2, `${anchor} bottom`)
    else assert.ok(Math.abs(y + h / 2 - projected.y) < 2, `${anchor} vertical center`)
  }
  const beforeColor = await state()
  await page.evaluate(() => window.stzLabels.mutateLabel('anchor0', { style: { kind: 'labelStyle', color: '#2040b0', opacity: 0.4, fontSize: 32, anchor: 'center' } }))
  await settled()
  assert.equal((await state()).invocationCount, beforeColor.invocationCount, 'Font/style update reuses math geometry')
  assert.equal((await inspect('anchor0')).paint, '#2040b0')
  assert.equal((await inspect('anchor0')).paintOpacity, '0.4')
  assert.ok((await inspect('anchor0')).rect.height > (await inspect('anchor1')).rect.height)
  await record('all nine measured anchors, tall math, font scaling, explicit paint and opacity')

  await mount([{ id: 'dupA', text: '$\\frac{x}{y}$', position: { x: 0, y: 0, z: 0 } }, { id: 'dupB', text: '$\\frac{x}{y}$', position: { x: 0, y: 0, z: 0 } }])
  await settled()
  assert.equal((await inspect('dupA')).math, 1)
  assert.equal((await inspect('dupB')).math, 1)
  const duplicateIds = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[data-label-state] [id]'), (node) => node.id)
    return ids.length !== new Set(ids).size
  })
  assert.equal(duplicateIds, false)
  await click('dupB')
  assert.equal((await state()).selection.id, 'dupB')
  assert.equal((await state()).selectionEvents.length, 1, 'Formula paths do not create duplicate events')
  await page.keyboard.down('Alt')
  await click('dupA')
  const firstCycle = (await state()).selection.id
  await click('dupA')
  const secondCycle = (await state()).selection.id
  await page.keyboard.up('Alt')
  assert.notEqual(firstCycle, secondCycle, 'Production Alt-click cycles compiled overlap')
  assert.deepEqual(new Set([firstCycle, secondCycle]), new Set(['dupA', 'dupB']))
  await record('duplicate immutable output, native formula click, production overlap cycling')

  const reuseBefore = await state()
  await page.evaluate(() => window.stzLabels.mutateLabel('dupB', { position: { x: 1.2, y: 0.3, z: 0 }, style: { color: '#cc4400' } }))
  await page.evaluate(() => window.stzLabels.setProps({ cameraViewAdjustment: { zoom: 1.7, pan: { x: 25, y: -15 } } }))
  await settled()
  await click('dupB')
  assert.equal((await state()).selection.id, 'dupB')
  await page.keyboard.down('Alt')
  await click('dupB')
  await page.keyboard.up('Alt')
  assert.equal((await state()).selection.id, 'dupB', 'Measured picking follows pan/zoom')
  assert.equal((await state()).invocationCount, reuseBefore.invocationCount, 'Moves/paint/selection/pan/zoom reuse conversion')
  const dragHandle = page.locator('[aria-label="Selected label drag handles"] circle')
  const handle = await dragHandle.boundingBox()
  assert.ok(handle)
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 - 20, { steps: 3 })
  await page.mouse.up()
  const dragged = await state()
  assert.ok(dragged.dragCount > 0)
  assert.notDeepEqual(dragged.labels[1].position, { x: 1.2, y: 0.3, z: 0 })
  assert.equal(dragged.invocationCount, reuseBefore.invocationCount)
  await page.evaluate(() => window.stzLabels.undo())
  assert.deepEqual((await state()).labels[1].position, { x: 1.2, y: 0.3, z: 0 })
  await page.evaluate(() => window.stzLabels.redo())
  assert.deepEqual((await state()).labels[1].position, dragged.labels[1].position)
  await record('2D pan/zoom measured picking, selection markers, production drag/history, conversion reuse', { mathInvocations: dragged.invocationCount })

  await mount([{ id: 'threeD', text: '$\\alpha \\Rightarrow \\beta$', position: { x: 0.6, y: 0.4, z: 0.7 } }], { ambientDimension: 3 })
  await settled()
  const before3d = await state()
  await page.evaluate(() => window.stzLabels.setProps({ cameraOverride: { mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 130, pan: { x: 440, y: 320 } } }))
  await click('threeD')
  await page.keyboard.down('Alt')
  await click('threeD')
  await page.keyboard.up('Alt')
  assert.equal((await state()).selection.id, 'threeD')
  assert.equal((await state()).invocationCount, before3d.invocationCount)
  await record('3D camera projection and production measured picking reuse geometry')

  await mount([{ id: 'fallbackA', text: 'bad $', position: { x: 0, y: 0, z: 0 } }, { id: 'fallbackB', text: 'bad $', position: { x: 0, y: 0, z: 0 } }])
  await settled()
  await click('fallbackB')
  assert.equal((await state()).selection.id, 'fallbackB')
  await page.keyboard.down('Alt')
  await click('fallbackA')
  const fallbackCycleA = (await state()).selection.id
  await click('fallbackA')
  const fallbackCycleB = (await state()).selection.id
  await page.keyboard.up('Alt')
  assert.deepEqual(new Set([fallbackCycleA, fallbackCycleB]), new Set(['fallbackA', 'fallbackB']))
  await record('literal fallback labels retain native click and measured overlap cycling')

  await mount([
    { id: 'visible', text: '$x$', layer: 1, position: { x: -2, y: 0, z: 0 } },
    { id: 'locked', text: '$y$', layer: 2, position: { x: 0, y: 0, z: 0 } },
    { id: 'hidden', text: '$z$', layer: 3, position: { x: 2, y: 0, z: 0 } },
  ], { layers: [{ value: 1, name: 'visible' }, { value: 2, name: 'locked', locked: true }, { value: 3, name: 'hidden', visible: false }] })
  await settled()
  assert.equal(await label('hidden').count(), 0)
  await click('locked')
  assert.equal((await state()).selection, null)
  await page.keyboard.down('Alt')
  await click('locked')
  await page.keyboard.up('Alt')
  assert.equal((await state()).selection, null)
  await page.evaluate(() => window.stzLabels.filter(2))
  await click('visible')
  assert.equal((await state()).selection, null)
  for (const policy of ['autoHide', 'autoDim']) {
    await mount([{ id: 'occluded', text: '$x$', position: { x: 0, y: -1, z: 0 } }], { ambientDimension: 3, occlusion: policy })
    await settled()
    assert.equal(await page.locator(`[data-label-visibility="${policy === 'autoHide' ? 'hidden' : 'dimmed'}"]`).count(), 1)
    if (policy === 'autoHide') {
      assert.equal(await label('occluded').count(), 0)
      await page.keyboard.down('Alt')
      await page.mouse.click(450, 350)
      await page.keyboard.up('Alt')
      assert.notEqual((await state()).selection?.kind, 'label')
    } else {
      await click('occluded')
      assert.equal((await state()).selection.id, 'occluded')
    }
  }
  await record('locked/hidden/filtered layers and autoHide/autoDim preserve picking policy')

  await page.evaluate(() => window.stzLabels.hold('$oldA$'))
  await page.evaluate(() => window.stzLabels.hold('$newB$'))
  await mount([{ id: 'race', text: '$oldA$', position: { x: 0, y: 0, z: 0 } }])
  assert.equal((await inspect('race')).state, 'pending')
  await page.evaluate(() => window.stzLabels.mutateLabel('race', { text: '$newB$' }))
  assert.equal((await inspect('race')).source, '$newB$')
  assert.equal((await inspect('race')).state, 'pending')
  const pendingExport = await page.evaluate(() => window.stzLabels.export())
  assert.ok(pendingExport.includes('$newB$'))
  await page.evaluate(() => {
    window.stzLabels.mutateLabel('race', { position: { x: 1, y: 1, z: 0 }, style: { color: '#2070b0', opacity: 0.3 } })
    window.stzLabels.select({ kind: 'label', id: 'race' })
  })
  await page.evaluate(() => window.stzLabels.release('$newB$'))
  await settled()
  await page.evaluate(() => window.stzLabels.release('$oldA$', true))
  assert.equal((await inspect('race')).source, '$newB$')
  assert.equal((await inspect('race')).state, 'ready')
  assert.equal((await inspect('race')).paint, '#2070b0')
  assert.equal((await inspect('race')).paintOpacity, '0.3')
  assert.equal((await state()).selection.id, 'race')
  assert.deepEqual((await state()).labels[0].position, { x: 1, y: 1, z: 0 })
  await page.evaluate(() => window.stzLabels.mutateLabel('race', { text: 'invalid $' }))
  assert.equal((await inspect('race')).source, 'invalid $')
  assert.equal((await inspect('race')).math, 0)
  await settled()
  await page.evaluate(() => window.stzLabels.mutateLabel('race', { text: '$newB$' }))
  await settled()
  assert.equal((await inspect('race')).state, 'ready')
  await record('controlled completion inversion and obsolete failure, valid-invalid-valid, pending export')

  await page.evaluate(() => window.stzLabels.hold('$deleteMe$'))
  await page.evaluate(() => window.stzLabels.mutateLabel('race', { text: '$deleteMe$' }))
  await page.evaluate(() => window.stzLabels.deleteLabel('race'))
  await page.evaluate(() => window.stzLabels.release('$deleteMe$'))
  assert.equal(await label('race').count(), 0)
  await page.evaluate(() => window.stzLabels.hold('$oldDocument$'))
  await mount([{ id: 'reused', text: '$oldDocument$' }])
  await mount([{ id: 'reused', text: '$newDocument$' }])
  await settled()
  await page.evaluate(() => window.stzLabels.release('$oldDocument$'))
  assert.equal((await inspect('reused')).source, '$newDocument$')
  await page.evaluate(() => window.stzLabels.hold('$unmounted$'))
  await page.evaluate(() => window.stzLabels.mutateLabel('reused', { text: '$unmounted$' }))
  await page.evaluate(() => window.stzLabels.unmount())
  await page.evaluate(() => window.stzLabels.release('$unmounted$'))
  assert.equal(await page.locator('svg.svg-diagram').count(), 0)
  await record('deleted labels, reused imported IDs, and unmount reject stale completions')

  for (const mode of ['load-error', 'output-error']) {
    await page.evaluate((value) => window.stzLabels.changeService(value), mode)
    await mount([{ id: 'failed', text: '$x$' }, { id: 'sibling', text: 'ordinary 日本語' }])
    await settled()
    assert.equal((await inspect('failed')).state, 'fallback')
    assert.equal((await inspect('failed')).source, '$x$')
    assert.equal((await inspect('failed')).math, 0)
    assert.equal((await inspect('sibling')).state, 'ready')
  }
  await page.evaluate(() => window.stzLabels.changeService('real'))
  const longSource = 'x'.repeat(16_385)
  await mount([{ id: 'limit', text: longSource }, { id: 'good', text: '$x^2$' }])
  await settled()
  assert.equal((await inspect('limit')).state, 'fallback')
  assert.equal((await inspect('limit')).source, longSource)
  assert.equal((await inspect('good')).state, 'ready')
  await record('actual mounted load/output/input-limit failures remain isolated exact-source fallback')

  await mount([{ id: 'exportMath', text: '$\\frac{a}{b}$' }, { id: 'exportFallback', text: fallbackSource }])
  await settled()
  await page.evaluate(() => window.stzLabels.select({ kind: 'label', id: 'exportMath' }))
  for (const background of ['transparent', 'white']) {
    const exported = await page.evaluate((value) => window.stzLabels.export(value), background)
    assert.ok(exported && exported.includes('<path'))
    assert.ok(exported.includes('&lt;&gt;&amp;'))
    assert.ok(!exported.includes('svg-geometry-handle'))
    assert.ok(!exported.includes('data-svg-export-exclude'))
    const parsed = await page.evaluate((source) => {
      const svg = new DOMParser().parseFromString(source, 'image/svg+xml')
      return { errors: svg.querySelectorAll('parsererror').length, paths: svg.querySelectorAll('path').length, foreign: svg.querySelectorAll('foreignObject,image').length }
    }, exported)
    assert.equal(parsed.errors, 0)
    assert.ok(parsed.paths > 0)
    assert.equal(parsed.foreign, 0)
  }
  await record('currently visible transparent/white SVG export retains settled geometry and literal fallback; editor overlays removed')
  assert.deepEqual(pageErrors, [], 'Browser raised no uncaught errors')
  if (process.env.STZ_SMOKE_ARTIFACT_DIR) {
    const output = resolve(process.env.STZ_SMOKE_ARTIFACT_DIR)
    await mkdir(output, { recursive: true })
    await page.screenshot({ path: resolve(output, 'free-labels.png'), fullPage: true })
    await writeFile(resolve(output, 'free-labels-evidence.json'), JSON.stringify({ result: 'passed', ...environment, evidence, pageErrors }, null, 2) + '\n')
  }
  console.log(JSON.stringify({ result: 'free-label-browser-check-passed', ...environment, checks: evidence.length }))
} finally {
  await browser?.close()
  await server?.close()
}
