/** Phase 31E: production App downloads reopened as standalone file:// SVGs.
 * The fixture controls conversion timing only; edits, imports and downloads use
 * the real controls. No application CSS or runtime is present in reopened files. */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const buttonName = 'Export current diagram view as SVG'
const excluded = '[data-svg-export-exclude="true"], [data-svg-background="true"], .svg-coordinate-anchors, .svg-coordinate-source-highlights, .svg-coordinate-axes-guide, .svg-geometry-handle, .svg-path-draft, .svg-path-intersection-candidates, .svg-selection-cycle-feedback, .svg-work-plane-preview'

export async function runSettledSvgExportChecks({ browser, origin, record, observe, artifactDir }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
  const errors = []
  const downloads = []
  let currentSources = []
  let checkpoint = 'app-startup'
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('download', (download) => downloads.push(download))
  const state = () => page.evaluate(() => window.stzAppLabels.state())
  const button = () => page.getByRole('button', { name: buttonName, exact: true })
  const status = () => page.locator('.svg-export-status')
  const hold = (source) => page.evaluate((text) => window.stzAppLabels.hold(text), source)
  const release = (source, fail = false) => page.evaluate(({ text, failure }) =>
    window.stzAppLabels.release(text, failure, 'resource-error'), { text: source, failure: fail })
  const frame = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
  async function diagnostic(name, details = {}) {
    checkpoint = name
    const app = await page.evaluate((sources) => ({
      conversion: window.stzAppLabels?.exportDiagnostics(sources),
      status: document.querySelector('.svg-export-status')?.textContent,
      pending: document.querySelector('.svg-export-button')?.getAttribute('aria-busy'),
      labels: [...document.querySelectorAll('[data-label-state]')].map((node) => ({
        source: node.getAttribute('data-label-source'), state: node.getAttribute('data-label-state'),
        requestIdentity: node.getAttribute('data-label-request'), ownerIdentity: node.getAttribute('data-label-owner'),
      })),
    }), currentSources)
    await observe(name, { ...details, app, downloads: downloads.length, pageErrors: [...errors] })
  }
  async function load(json, name) {
    const revision = (await state()).labelDocumentRevision
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Load JSON', exact: true }).click()
    await (await chooser).setFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(json) })
    await page.waitForFunction((before) => window.stzAppLabels.state().labelDocumentRevision > before, revision)
    await frame()
  }
  async function capturedView() {
    return page.evaluate((exclusions) => {
      const svg = document.querySelector('svg.svg-diagram')
      const bounds = svg.viewBox.baseVal
      return {
        viewBox: svg.getAttribute('viewBox'), width: svg.getAttribute('width') ?? String(bounds.width), height: svg.getAttribute('height') ?? String(bounds.height),
        geometry: [...svg.querySelectorAll('path')].filter((node) => !node.closest('[data-label-state]') && !node.closest(exclusions)).map((node) => node.getAttribute('d')),
        labels: [...svg.querySelectorAll('[data-label-state]')].map((node) => ({
          source: node.getAttribute('data-label-source'), position: node.getAttribute('transform'),
          color: node.querySelector(':scope > g').getAttribute('color'),
          opacity: Number(node.querySelector(':scope > g').getAttribute('opacity')),
        })),
      }
    }, excluded)
  }
  async function readStandalone(download, name, background, captured) {
    assert.equal(download.suggestedFilename(), 'stratified-tikz-preview.svg', 'Filename policy is unchanged')
    const path = resolve(artifactDir, `${name}.svg`)
    await download.saveAs(path)
    assert.equal(await download.failure(), null, 'Browser accepted the download handoff')
    const text = await readFile(path, 'utf8')
    const standalone = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
    const requests = []
    standalone.on('request', (request) => requests.push(request.url()))
    standalone.on('pageerror', (error) => errors.push(error.message))
    try {
      await standalone.goto(pathToFileURL(path).href)
      const observed = await standalone.evaluate(async () => {
        const svg = document.documentElement
        if (svg.localName !== 'svg' || document.querySelector('parsererror')) throw new Error('Downloaded file is not well-formed SVG')
        const labels = [...svg.querySelectorAll('title')].filter((title) => title.parentElement.localName === 'g').map((title) => {
          const outer = title.parentElement
          const paint = outer.querySelector(':scope > g')
          const foreground = paint?.querySelector(':scope > g:last-child')
          if (!paint || !foreground) throw new Error('Missing standalone label foreground')
          const box = foreground.getBBox()
          const matrix = foreground.getCTM()
          return {
            source: title.textContent, position: outer.getAttribute('transform'),
            color: paint.getAttribute('color'), opacity: Number(paint.getAttribute('opacity')),
            paths: foreground.querySelectorAll('path').length, formulas: foreground.querySelectorAll('svg').length,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f },
            texts: [...foreground.querySelectorAll('text')].map((node) => ({ text: node.textContent,
              x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')), fill: getComputedStyle(node).fill,
              whiteSpace: getComputedStyle(node).whiteSpace, xmlSpace: node.getAttribute('xml:space'),
              fontSize: Number.parseFloat(getComputedStyle(node).fontSize), advance: node.getComputedTextLength() })),
            halo: [...paint.querySelectorAll('[aria-hidden="true"] path, [aria-hidden="true"] text')].map((node) => ({
              stroke: getComputedStyle(node).stroke, width: getComputedStyle(node).strokeWidth,
              vectorEffect: node.getAttribute('vector-effect'),
            })),
          }
        })
        const all = [svg, ...svg.querySelectorAll('*')]
        const ids = all.filter((node) => node.id).map((node) => node.id)
        const references = all.flatMap((node) => [...node.attributes].flatMap(({ name, value }) => {
          if (name === 'href' || name === 'xlink:href') return [value]
          return [...value.matchAll(/url\(['"]?([^)'"\s]+)/g)].map((match) => match[1])
        }))
        const unexpectedAttributes = all.flatMap((node) => [...node.attributes].filter(({ name }) =>
          name === 'class' || /^on/i.test(name) || (/^data-/.test(name) && name !== 'data-stratified-tikz-export-background')).map(({ name }) => name))
        const serialized = new XMLSerializer().serializeToString(svg)
        const image = new Image()
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
        await image.decode()
        const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        let painted = 0, white = 0, magenta = 0, teal = 0
        for (let index = 0; index < data.length; index += 4) {
          const [r, g, b, a] = data.subarray(index, index + 4)
          if (a > 0) painted++
          if (a > 240 && r > 245 && g > 245 && b > 245) white++
          if (a > 40 && r > g * 1.8 && b > g * 1.5) magenta++
          if (a > 100 && r < 30 && g > 80 && b > 80) teal++
        }
        return {
          viewBox: svg.getAttribute('viewBox'), width: svg.getAttribute('width'), height: svg.getAttribute('height'), labels,
          geometry: [...svg.querySelectorAll('path')].filter((node) => ![...svg.querySelectorAll('title')]
            .some((title) => title.parentElement.localName === 'g' && title.parentElement.contains(node))).map((node) => node.getAttribute('d')),
          ids, references, unexpectedAttributes, currentColor: /currentColor/i.test(serialized),
          forbidden: svg.querySelectorAll('foreignObject,image,script,style,link').length,
          backgrounds: [...svg.querySelectorAll('[data-stratified-tikz-export-background]')].map((node) => ({
            tag: node.localName, first: node === svg.firstElementChild, fill: node.getAttribute('fill'),
            bounds: ['x', 'y', 'width', 'height'].map((attribute) => Number(node.getAttribute(attribute))),
          })),
          transparentRects: svg.querySelectorAll('rect[fill="transparent"]').length,
          raster: { width: canvas.width, height: canvas.height, corner: [...data.slice(0, 4)], painted, white, magenta, teal },
          png: canvas.toDataURL(),
        }
      })
      await writeFile(resolve(artifactDir, `${name}-raster.png`), Buffer.from(observed.png.split(',')[1], 'base64'))
      delete observed.png
      await standalone.screenshot({ path: resolve(artifactDir, `${name}-standalone.png`), fullPage: true })
      const observedPath = resolve(artifactDir, `${name}-standalone.json`)
      await writeFile(observedPath, JSON.stringify({ path, observed, requests }, null, 2) + '\n')
      await diagnostic(`${name}-reopened-before-assertions`, { path, observedPath })
      assert.equal(observed.forbidden, 0, 'Only self-contained SVG geometry and ordinary text remain')
      assert.deepEqual(observed.unexpectedAttributes, [], 'Metadata, events and CSS classes are removed')
      assert.equal(observed.currentColor, false, 'Standalone paint does not depend on currentColor')
      assert.equal(new Set(observed.ids).size, observed.ids.length, 'Repeated formulas introduce no duplicate IDs')
      for (const reference of observed.references) {
        assert.ok(reference.startsWith('#') && observed.ids.includes(reference.slice(1)), `Local target exists: ${reference}`)
      }
      assert.deepEqual(requests, [pathToFileURL(path).href], 'Reopening requests no remote fonts, CSS, scripts or other resources')
      assert.deepEqual([observed.viewBox, observed.width, observed.height], [captured.viewBox, captured.width, captured.height])
      assert.deepEqual(observed.labels.map(({ source, position, color, opacity }) => ({ source, position, color, opacity })), captured.labels,
        'Standalone label order, placement and paint belong entirely to the captured view')
      assert.deepEqual(observed.geometry, captured.geometry, 'Captured diagram geometry survives label settling and overlay removal')
      assert.equal(observed.transparentRects, 0, 'Label bounds/selection hit rectangles are editor-only')
      if (background === 'white') {
        assert.deepEqual(observed.backgrounds, [{ tag: 'rect', first: true, fill: '#ffffff', bounds: captured.viewBox.split(/[ ,]+/).map(Number) }])
        assert.deepEqual(observed.raster.corner, [255, 255, 255, 255])
      } else {
        assert.deepEqual(observed.backgrounds, [])
        assert.equal(observed.raster.corner[3], 0, 'Transparent download has no gray editor background')
        assert.ok(observed.raster.white > 10, 'White path-label outlines remain visible pixels on the transparent file')
      }
      assert.ok(observed.raster.painted > 200 && observed.raster.magenta > 10 && observed.raster.teal > 10,
        'Actual standalone pixels contain diagram geometry and captured label colors')
      for (const label of observed.labels) {
        assert.ok(Object.values(label.box).every(Number.isFinite) && label.box.width > 0 && label.box.height > 0)
        assert.ok(Object.values(label.matrix).every(Number.isFinite))
        for (const text of label.texts) assert.ok(text.xmlSpace === 'preserve' && /pre|break-spaces/.test(text.whiteSpace))
      }
      return { path, text, observed }
    } catch (error) {
      const screenshot = resolve(artifactDir, `${name}-standalone-failure.png`)
      await standalone.screenshot({ path: screenshot, fullPage: true }).catch(() => {})
      await diagnostic(`${name}-reopen-failure`, { path, requests, screenshot, message: error.message }).catch(() => {})
      throw error
    } finally {
      await standalone.close()
    }
  }
  function assertLabels(result, sources, resourceFailed) {
    const find = (source) => result.labels.filter((label) => label.source === source)
    for (const source of [sources.edit, sources.repeated, sources.inline]) {
      const labels = find(source)
      assert.equal(labels.length, source === sources.repeated ? 2 : 1)
      for (const label of labels) assert.ok(label.formulas > 0 && label.paths > 0, 'A pending successful formula is exported as geometry')
    }
    const ordinary = find(sources.ordinary)[0]
    assert.equal(ordinary.texts.map(({ text }) => text).join(''), sources.ordinary)
    assert.equal(ordinary.formulas, 0)
    const malformed = find(sources.malformed)[0]
    assert.equal(malformed.formulas, 0)
    assert.deepEqual(malformed.texts.map(({ text }) => text), sources.malformed.split(/\t|\n/u),
      'Literal XML text preserves markup, backslashes and all spaces in each positioned fragment')
    assert.equal(malformed.texts[0].y, malformed.texts[1].y)
    assert.ok(malformed.texts[1].x > malformed.texts[0].x + malformed.texts[0].advance, 'Tab advances beyond preceding literal text')
    assert.ok(malformed.texts[2].y > malformed.texts[1].y, 'Physical newline remains a separate baseline')
    const resource = find(sources.resource)[0]
    assert.equal(resource.formulas > 0, !resourceFailed)
    if (resourceFailed) assert.equal(resource.texts.map(({ text }) => text).join(''), sources.resource)
    const inline = find(sources.inline)[0]
    assert.ok(inline.halo.length > 0, 'Path labels retain a separate white outline')
    for (const halo of inline.halo) {
      assert.equal(halo.stroke, 'rgb(255, 255, 255)')
      assert.equal(halo.width, '3px')
      assert.equal(halo.vectorEffect, 'non-scaling-stroke')
    }
  }
  try {
    await page.goto(`${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`)
    await page.waitForFunction(() => window.stzAppLabels !== undefined && document.querySelector('svg.svg-diagram'))
    const fixture = await page.evaluate(() => window.stzAppLabels.exportDocumentJson(2))
    const { sources } = fixture
    currentSources = Object.values(sources)
    for (const source of [sources.edit, sources.repeated, sources.inline, sources.resource, sources.hidden]) await hold(source)
    await load(fixture.json, 'settled-export-2d')
    await page.waitForFunction((inputs) => inputs.every((source) => window.stzAppLabels.pending(source)?.started > 0),
      [sources.edit, sources.repeated, sources.inline, sources.resource])
    await page.locator('[data-label-id="export-edit"] [data-label-state]').click()
    const openInspector = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
    if (await openInspector.count()) await openInspector.click()
    const inspector = page.locator('#preview-inspector-drawer')
    const expand = inspector.getByRole('button', { name: 'Expand', exact: true })
    if (await expand.count()) await expand.click()
    const field = inspector.getByRole('textbox', { name: 'Text', exact: true })
    assert.equal(await field.inputValue(), sources.edit)
    await page.getByLabel('SVG export background', { exact: true }).selectOption('transparent')
    const captured = await capturedView()
    const before = await state()
    await diagnostic('settled-export-App-pending-capture', { captured, documentRevision: before.labelDocumentRevision })
    const firstDownloading = page.waitForEvent('download')
    await button().evaluate((element) => { element.click(); element.click() })
    await page.waitForFunction(() => document.querySelector('.svg-export-button')?.getAttribute('aria-busy') === 'true')
    assert.equal(await button().isDisabled(), true)
    assert.match(await status().innerText(), /Preparing SVG export/)
    await frame()
    await diagnostic('settled-export-App-held-after-duplicate-click')
    assert.equal(downloads.length, 0, 'No download occurs while represented labels are held')
    assert.equal((await state()).json, before.json)
    assert.equal((await state()).history, before.history)
    await field.fill(sources.after)
    await inspector.getByRole('textbox', { name: 'Font size', exact: true }).fill('16')
    await page.waitForFunction((source) => JSON.parse(window.stzAppLabels.state().json).diagram.labels.find(({ id }) => id === 'export-edit').text === source, sources.after)
    await page.getByLabel('SVG export background', { exact: true }).selectOption('white')
    const next = await page.evaluate(() => window.stzAppLabels.exportDocumentJson(3))
    const nextModel = JSON.parse(next.json)
    const changed = nextModel.diagram.labels.find(({ id }) => id === 'export-edit')
    changed.text = sources.after
    changed.position = { x: -1.5, y: 1.3, z: 1 }
    changed.style = { ...changed.style, color: '#9020a0', fontSize: 16, opacity: 0.8, anchor: 'east' }
    nextModel.diagram.layers[1].visible = true
    nextModel.diagram.labels.find(({ id }) => id === 'export-hidden').text = 'Now visible Ω'
    await load(JSON.stringify(nextModel), 'settled-export-later-3d')
    const afterEdits = await state()
    await diagnostic('settled-export-App-later-document-before-release', { documentRevision: afterEdits.labelDocumentRevision })
    await release(sources.edit)
    await release(sources.repeated)
    await release(sources.inline)
    await frame()
    assert.equal(downloads.length, 0, 'One outstanding represented label still blocks the captured file')
    await release(sources.resource, true)
    const first = await readStandalone(await firstDownloading, 'export-click-time-2d-transparent', 'transparent', captured)
    assertLabels(first.observed, sources, true)
    assert.ok(!first.observed.labels.some(({ source }) => [sources.after, sources.hidden, 'Now visible Ω'].includes(source)))
    assert.equal((await page.evaluate((source) => window.stzAppLabels.pending(source), sources.hidden)).started, 0,
      'Hidden labels are never converted or awaited by export')
    await page.waitForFunction(() => !document.querySelector('.svg-export-button')?.disabled)
    assert.equal(await status().innerText(), 'SVG exported with transparent background.')
    assert.equal(downloads.length, 1, 'Synchronous repeated clicks create exactly one file')
    const afterFirst = await state()
    assert.equal(afterFirst.json, afterEdits.json)
    assert.equal(afterFirst.history, afterEdits.history, 'Settling a captured earlier document never changes current history')
    await record('settled-export-click-time-edit-load-duplicate-isolation', { captured, standalone: first.observed,
      path: first.path, beforeRevision: before.labelDocumentRevision, laterRevision: afterEdits.labelDocumentRevision })

    await page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'))
    const captured3d = await capturedView()
    await diagnostic('settled-export-App-3d-before-download', { captured: captured3d })
    assert.notDeepEqual(captured3d.labels, captured.labels, 'Second capture observes the later 3D document and styles')
    const liveBefore = await page.locator('svg.svg-diagram').evaluate((node) => node.outerHTML)
    const secondDownloading = page.waitForEvent('download')
    await button().click()
    const second = await readStandalone(await secondDownloading, 'export-later-3d-white', 'white', captured3d)
    assertLabels(second.observed, { ...sources, edit: sources.after }, false)
    assert.ok(second.observed.labels.some(({ source }) => source === 'Now visible Ω'))
    await page.waitForFunction(() => !document.querySelector('.svg-export-button')?.disabled)
    assert.equal(await status().innerText(), 'SVG exported with white background.')
    assert.equal(downloads.length, 2)
    assert.equal(await page.locator('svg.svg-diagram').evaluate((node) => node.outerHTML), liveBefore,
      'Detached export does not mutate the live SVG, including after a transient resource fallback')
    assert.equal((await state()).json, afterEdits.json)
    assert.equal((await state()).history, afterEdits.history)
    await record('settled-export-retry-3d-white-standalone', { captured: captured3d, standalone: second.observed, path: second.path })

    await page.evaluate(() => {
      const original = XMLSerializer.prototype.serializeToString
      window.stzRestoreExportSerializer = () => { XMLSerializer.prototype.serializeToString = original }
      XMLSerializer.prototype.serializeToString = () => { throw new Error('Injected serialization infrastructure failure') }
    })
    try {
      await button().click()
      await page.waitForFunction(() => document.querySelector('.svg-export-status')?.textContent.includes('SVG export failed.'))
      await diagnostic('settled-export-App-serialization-failure-before-assertions')
      assert.equal(await button().isDisabled(), false, 'Serialization failure restores the export action')
      assert.equal(downloads.length, 2, 'Serialization failure never downloads malformed output')
      assert.equal(await page.locator('svg.svg-diagram').evaluate((node) => node.outerHTML), liveBefore)
    } finally {
      await page.evaluate(() => { window.stzRestoreExportSerializer(); delete window.stzRestoreExportSerializer })
    }
    const retryDownloading = page.waitForEvent('download')
    await button().click()
    const retry = await readStandalone(await retryDownloading, 'export-serialization-retry', 'white', captured3d)
    assertLabels(retry.observed, { ...sources, edit: sources.after }, false)
    await page.waitForFunction(() => !document.querySelector('.svg-export-button')?.disabled)
    assert.equal(downloads.length, 3)
    assert.equal(await status().innerText(), 'SVG exported with white background.')
    await record('settled-export-serialization-failure-and-successful-retry', { path: retry.path, downloads: downloads.length })
    assert.deepEqual(errors, [], 'Export and standalone reopen cause no browser errors')
  } catch (error) {
    const failedCheckpoint = checkpoint
    await diagnostic('settled-export-App-failure', { failedCheckpoint, message: error.message }).catch(() => {})
    const livePath = resolve(artifactDir, 'settled-export-failure-live-preview.svg')
    const live = await page.locator('svg.svg-diagram').evaluate((node) => node.outerHTML).catch(() => null)
    if (live !== null) await writeFile(livePath, live)
    await page.screenshot({ path: resolve(artifactDir, 'settled-export-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await page.close()
  }
}

/** Exercise production occlusion/layer policy before DOM capture. Filtering and
 * autoDim retain visible dimmed labels; autoHide and hidden layers remove them. */
export async function runSettledSvgVisibilityChecks({ page, record, observe, artifactDir }) {
  await page.evaluate(() => window.stzLabels.changeService('real'))
  for (const policy of ['autoHide', 'autoDim', 'layerFilter', 'hiddenLayer']) {
    const source = `$\\frac{${policy}}{x}$`
    const name = `settled-export-${policy}`
    async function retain(checkpoint) {
      const bundle = await page.evaluate(() => window.stzVisibilityExport.report())
      const paths = {}
      for (const key of ['serialized', 'liveAtCapture', 'liveAfter', 'cloneAtCapture', 'detachedBeforeSanitization']) {
        if (bundle[key] !== null) {
          paths[key] = resolve(artifactDir, `${name}-${checkpoint}-${key}.svg`)
          await writeFile(paths[key], bundle[key])
        }
        delete bundle[key]
      }
      for (const [index, event] of bundle.events.entries()) {
        if (event.kind !== 'label-rendered') continue
        const path = resolve(artifactDir, `${name}-${checkpoint}-label-${index}-before-sanitize.svg`)
        await writeFile(path, event.markup)
        event.markupPath = path
        delete event.markup
      }
      paths.diagnostic = resolve(artifactDir, `${name}-${checkpoint}.json`)
      await writeFile(paths.diagnostic, JSON.stringify({ ...bundle, paths }, null, 2) + '\n')
      await observe(`${name}-${checkpoint}`, { policy, source, paths, done: bundle.done,
        observed: bundle.observed, events: bundle.events, conversion: bundle.conversion })
      return { ...bundle, paths }
    }
    await observe(`${name}-setup`, { policy, source })
    await page.evaluate(({ source, policy }) => {
      window.stzLabels.hold(source)
      window.stzLabels.mount({ ambientDimension: 3, occlusion: ['autoHide', 'autoDim'].includes(policy) ? policy : undefined,
        layers: policy === 'hiddenLayer' ? [{ value: 0, name: 'Hidden', visible: false }] : undefined,
        labels: [{ id: 'export-visibility', text: source, layer: 0, position: { x: 0, y: -1, z: 0 },
          style: { color: '#802080', opacity: 0.7 } }] })
      if (policy === 'layerFilter') window.stzLabels.filter(1)
    }, { source, policy })
    const before = await page.evaluate(() => window.stzLabels.state())
    const capture = await page.evaluate(async ({ policy, source }) => {
      const { captureSvgExportSnapshot, prepareSettledSvgExport, releaseSvgExportSnapshot } = await import('/stratified-tikz/src/ui/svgSettledExport.ts')
      const { inspectSettledSvgLabel, hasExpectedSettledMath, checkSettledSvgLabelControls } = await import('/stratified-tikz/scripts/fixtures/settledSvgExportOracle.ts')
      const svg = document.querySelector('svg.svg-diagram')
      const capturedAt = Date.now()
      const snapshot = captureSvgExportSnapshot(svg, { backgroundMode: 'transparent' })
      const paintOpacity = (node) => {
        let result = 1
        for (let current = node; current; current = current.parentElement) {
          if (current.hasAttribute('opacity')) result *= Number(current.getAttribute('opacity'))
        }
        return result
      }
      const visible = svg.querySelector('[data-label-state] > g')
      const model = window.stzLabels.state()
      const captured = { capturedAt, count: snapshot.labels.length, opacity: visible ? paintOpacity(visible) : null,
        documentRevision: model.sourceRevision, camera: model.camera, backgroundMode: snapshot.backgroundMode,
        liveLabel: inspectSettledSvgLabel(svg, source),
        labels: snapshot.labels.map(({ capture, target }) => {
          const inputs = { ...capture }
          delete inputs.runtime
          return { ...inputs, requestIdentity: target.getAttribute('data-label-request'),
            capturedState: target.getAttribute('data-label-state'), attributes: Object.fromEntries([...target.attributes].map(({ name, value }) => [name, value])) }
        }) }
      // XMLSerializer retains namespace bindings when saving HTML-owned SVG
      // nodes; outerHTML alone is not a standalone XML namespace snapshot.
      const serialize = (node) => new XMLSerializer().serializeToString(node)
      const liveAtCapture = serialize(svg)
      const cloneAtCapture = serialize(snapshot.root)
      const state = { done: false, result: null, events: [], captured, liveAtCapture, cloneAtCapture,
        detachedBeforeSanitization: null, detachedLabel: null, liveBeforeSerialization: null, liveAtCompletion: null }
      window.stzVisibilityExport = state
      state.report = () => {
        const document = state.result === null ? null : new DOMParser().parseFromString(state.result, 'image/svg+xml')
        const first = document?.querySelector('g > title')?.parentElement
        const exactTitle = document && [...document.querySelectorAll('g > title')].find((title) => title.textContent === source)
        const exact = exactTitle?.parentElement
        const paint = exact && [...exact.children].find((node) => node.localName === 'g')
        const oracle = document ? inspectSettledSvgLabel(document, source) : null
        return { policy, source, done: state.done, captured, events: state.events,
          clock: 'Date.now() milliseconds since Unix epoch',
          serialized: state.result, liveAtCapture, cloneAtCapture, liveAfter: serialize(svg),
          detachedBeforeSanitization: state.detachedBeforeSanitization,
          conversion: window.stzLabels.exportDiagnostics(source),
          detachedLabel: state.detachedLabel,
          livePreservedDuringSerialization: state.liveBeforeSerialization === state.liveAtCompletion,
          observed: document ? { oracle, expectedMath: hasExpectedSettledMath(oracle),
            labels: document.querySelectorAll('g > title').length,
            opacity: paint ? paintOpacity(paint) : null,
            originalSelector: { source: first?.querySelector('title')?.textContent,
              namespace: first?.namespaceURI, formulas: first?.querySelectorAll('svg path').length ?? 0 },
            negativeControls: checkSettledSvgLabelControls(state.result, source) } : null }
      }
      state.promise = prepareSettledSvgExport(snapshot, undefined, { observe(event) {
        if (event.kind === 'label-settled') {
          const { state: settled, ...timing } = event
          const result = settled.result
          const geometryTags = (node) => [node.tag, ...node.children.flatMap((child) => typeof child === 'string' ? [] : geometryTags(child))]
          state.events.push({ ...timing, status: settled.status, reason: settled.reason, estimated: settled.estimated,
            layout: settled.layout,
            conversion: result ? { source: result.source, kind: result.kind, reason: result.kind === 'fallback' ? result.reason : undefined,
              identity: result.identity, configurationIdentity: result.configurationIdentity, generation: result.generation,
              runs: result.kind === 'success' ? result.runs.map((run) => ({ kind: run.kind,
                geometry: run.geometry ? { viewBox: run.geometry.viewBox,
                  tags: geometryTags(run.geometry.svg).reduce((counts, tag) => ({ ...counts, [tag]: (counts[tag] ?? 0) + 1 }), {}) } : null })) : null } : null })
        } else state.events.push(event)
        if (event.kind === 'label-rendered') state.liveBeforeSerialization = svg.outerHTML
        if (event.kind === 'preparation-completed') {
          state.detachedBeforeSanitization = serialize(snapshot.root)
          state.detachedLabel = inspectSettledSvgLabel(snapshot.root, source)
          state.liveAtCompletion = svg.outerHTML
          // Empty captures still have a synchronous serialization boundary.
          state.liveBeforeSerialization ??= state.liveAtCompletion
        }
      } }).then((result) => {
        state.result = result
        state.done = true
        state.completedAt = Date.now()
        releaseSvgExportSnapshot(snapshot)
      })
      return captured
    }, { policy, source })
    try {
      await retain('captured')
      const dimmed = policy === 'autoDim' || policy === 'layerFilter'
      if (dimmed) {
        assert.equal(capture.count, 1, 'Dimmed label is represented in the captured view')
        assert.ok(capture.opacity > 0 && capture.opacity < 0.7)
        assert.equal(capture.labels[0].source, source)
        assert.equal(capture.labels[0].capturedState, 'pending', 'Delivery is held at capture')
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
        await retain('held-before-release')
        assert.equal(await page.evaluate(() => window.stzVisibilityExport.done), false, 'Dimmed label is settled normally')
        await page.evaluate((source) => window.stzLabels.release(source), source)
      } else assert.equal(capture.count, 0, 'Hidden label is absent from export settlement')
      await page.waitForFunction(() => window.stzVisibilityExport.done)
      const bundle = await retain('completed')
      // The file and screenshot below are the detached export, never the live preview.
      if (bundle.paths.serialized) {
        const standalone = await page.context().newPage()
        try {
          await standalone.goto(pathToFileURL(bundle.paths.serialized).href)
          const reopened = await standalone.evaluate((source) => {
            const titles = [...document.querySelectorAll('g > title')].filter((node) => node.textContent === source)
            const label = titles[0]?.parentElement
            const paint = label && [...label.children].find((node) => node.localName === 'g')
            const foreground = paint?.lastElementChild
            const box = foreground?.getBBox()
            let opacity = 1
            for (let current = foreground; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity)
            return { source: titles[0]?.textContent, matchingTitles: titles.length,
              parseErrors: document.querySelectorAll('parsererror').length,
              foregroundPaths: foreground?.querySelectorAll('svg path').length ?? 0, opacity,
              box: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null }
          }, source)
          const screenshot = resolve(artifactDir, `${name}-standalone.png`)
          await standalone.screenshot({ path: screenshot, fullPage: true })
          await observe(`${name}-standalone-reopen`, { policy, source, reopened, screenshot, svg: bundle.paths.serialized })
          assert.equal(reopened.parseErrors, 0)
          assert.equal(reopened.matchingTitles, capture.count)
          if (dimmed) {
            assert.equal(reopened.source, source)
            assert.ok(reopened.foregroundPaths > 0, 'Saved dimmed SVG reopens with its own foreground formula paths')
            assert.ok(Object.values(reopened.box).every(Number.isFinite) && reopened.box.width > 0 && reopened.box.height > 0)
            assert.equal(reopened.opacity, capture.opacity)
          }
        } finally { await standalone.close() }
      }
      await page.screenshot({ path: resolve(artifactDir, `${name}-live-preview.png`), fullPage: true })
      const observed = bundle.observed
      assert.ok(observed, 'Settled serialization succeeded')
      assert.equal(observed.labels, capture.count)
      if (dimmed) {
        assert.equal(observed.expectedMath, true, 'The exact captured label foreground contains successful math, not raw fallback or unrelated paths')
        for (const [control, result] of Object.entries(observed.negativeControls)) {
          assert.equal(result.missingControlTarget, false, `Negative control exercised the captured label: ${control}`)
          assert.equal(result.rejected, true, `Reject genuinely missing foreground formula: ${control}`)
        }
        assert.ok(observed.originalSelector.formulas > 0, 'Retain the original positive geometry assertion')
        assert.equal(observed.opacity, capture.opacity, 'Captured opacity including occlusion dimming survives class removal')
        const settlement = bundle.events.filter(({ kind }) => kind === 'label-settled')
        assert.equal(settlement.length, 1)
        assert.equal(settlement[0].outcome, 'success', 'Expected valid math must settle successfully')
      }
      const after = await page.evaluate(() => window.stzLabels.state())
      if (!dimmed) assert.equal(after.requestCount, before.requestCount, 'Excluded labels cause no export conversion requests')
      for (const key of ['json', 'history', 'tikz', 'inlineTikz']) assert.equal(after[key], before[key])
      assert.equal(bundle.livePreservedDuringSerialization, true, 'Detached serialization leaves live geometry untouched')
      await record(`${name}-visibility`, { capture, observed, diagnostic: bundle.paths.diagnostic })
    } catch (error) {
      await retain('failure').catch(() => {})
      await page.screenshot({ path: resolve(artifactDir, `${name}-failure-live-preview.png`), fullPage: true }).catch(() => {})
      throw error
    }
  }
  await observe('settled-export-invalid-viewport-started', {})
  const invalidViewport = await page.evaluate(async () => {
    const { captureSvgExportSnapshot, prepareSettledSvgExport, releaseSvgExportSnapshot } = await import('/stratified-tikz/src/ui/svgSettledExport.ts')
    const svg = document.querySelector('svg.svg-diagram')
    const before = svg.outerHTML
    const invalid = captureSvgExportSnapshot(svg, { backgroundMode: 'transparent' })
    invalid.root.setAttribute('viewBox', '0 0 Infinity 600')
    const failure = await prepareSettledSvgExport(invalid)
    releaseSvgExportSnapshot(invalid)
    const retry = captureSvgExportSnapshot(svg, { backgroundMode: 'transparent' })
    const success = await prepareSettledSvgExport(retry)
    releaseSvgExportSnapshot(retry)
    return { failure, retrySucceeded: success !== null, livePreserved: before === svg.outerHTML }
  })
  await observe('settled-export-invalid-viewport-observed', invalidViewport)
  assert.deepEqual(invalidViewport, { failure: null, retrySucceeded: true, livePreserved: true },
    'Malformed detached viewport fails without mutating live SVG and a later valid capture succeeds')
  await record('settled-export-invalid-viewport-retry', invalidViewport)
}
