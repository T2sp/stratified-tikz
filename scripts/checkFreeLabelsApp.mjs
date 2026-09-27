/** Real-App acceptance. All model edits, imports, downloads and history changes
 * go through production controls; the fixture only holds adapter completions. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ownPageEvent } from './ownedPageEvent.mjs'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { saveAppJson, checkAppJsonReload } from './appJsonPersistence.mjs'
import { createOwnedAppPage } from './ownedAppPage.mjs'
import { clickAppPointer, createAppGeometryDiagnostics, readAppGeometry, waitForAppFrames, waitForStableAppGeometry } from './appGeometryDiagnostics.mjs'

export async function runAppChecks({ browser, origin, record, artifactDir }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true })
  const errors = []
  let droppedErrors = 0
  const onError = (error) => {
    errors.push(error.message.slice(0, 4000))
    if (errors.length > 64) { errors.shift(); droppedErrors++ }
  }
  page.on('pageerror', onError)
  const actions = []
  const downloads = new Map(), owned = []
  const expectedUrl = `${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`
  const app = createOwnedAppPage({ page, expectedUrl, artifactDir, prefix: 'app' })
  const diagnostics = createAppGeometryDiagnostics({ page, artifactDir })
  let primary, cleanupFailure, persistenceIndex = 0, stage = { name: 'startup' }, generation
  const boundary = async (name, operation, details = {}, timeoutMs = 30_000) => {
    const context = { stage, ...details }
    return diagnostics.around(name, async () => {
      await app.checkpoint(`${name}:before`)
      const result = await operation()
      await app.checkpoint(`${name}:after`)
      return result
    }, context, timeoutMs)
  }
  const diagnosePersistence = async (details) => {
    await boundedPointDiagnostic(() => writeFile(resolve(artifactDir, `app-persistence-${String(++persistenceIndex).padStart(4, '0')}.json`),
      JSON.stringify({ scenario: 'real-App-input-JSON-history-reused-ID-load', result: 'observed', ...details }, null, 2)), 'App persistence evidence')
    await diagnostics.capture(`persistence:${details.boundary}`, { stage, name: details.name, path: details.path })
  }
  const state = () => app.readState()
  const waitFor = (operation, argument) => boundedPointDiagnostic(
    () => page.waitForFunction(operation, argument, { timeout: 30_000 }), 'App condition wait', 35_000)
  const model = async () => JSON.parse((await state()).json).diagram
  const history = async () => JSON.parse((await state()).history)
  const source = async () => (await model()).labels[0].text
  const hold = (text) => boundedPointDiagnostic(() => page.evaluate((input) => window.stzAppLabels.hold(input), text), 'App hold request')
  const pending = async (text) => {
    await waitFor((input) => {
      window.__stzAppGeometryDiagnostics.assertOwnership()
      const request = window.stzAppLabels.pending(input)
      return request && request.started > 0 && request.completed === 0 && !request.released
    }, text)
    return boundedPointDiagnostic(() => page.evaluate((input) => window.stzAppLabels.pending(input), text), 'App pending request')
  }
  const release = async (text, fail = false) => {
    const result = await boundary('release', () => page.evaluate(({ input, failure }) => window.stzAppLabels.release(input, failure),
      { input: text, failure: fail }), { source: text, fail })
    assert.equal(result.completed, result.started, 'Every actually started held request completed before observation')
    actions.push({ action: 'release', ...result })
    return result
  }
  const settled = (expected = 'ready') => boundary('ready-wait', () => page.waitForFunction(({ status, generation, url }) => {
    const marker = window.__stzOwnedAppDocument
    if (location.href !== url || marker?.generation !== generation || marker.api !== window.stzAppLabels) {
      throw new Error('Owned App continuity lost during ready wait')
    }
    return document.querySelector('[data-label-id="app-label"] [data-label-state]')?.getAttribute('data-label-state') === status
  }, { status: expected, generation, url: expectedUrl }, { timeout: 30_000 }), { expected })
  const documentJson = (text, options = {}) => boundedPointDiagnostic(() => page.evaluate(({ input, settings }) =>
    window.stzAppLabels.documentJson(input, settings), { input: text, settings: options }), 'App input document')
  async function load(text, name) {
    const before = await state()
    await diagnosePersistence({ boundary: 'before-load', name, before, payload: text })
    const wait = ownPageEvent(page, 'filechooser', { name, timeoutMs: 30_000 }); owned.push(wait)
    const { event: chooser } = await wait.run(() => page.getByRole('button', { name: 'Load JSON', exact: true }).click({ timeout: 5000 }))
    await chooser.setFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(text) })
    await waitFor((revision) => {
      window.__stzAppGeometryDiagnostics.assertOwnership()
      return window.stzAppLabels.state().labelDocumentRevision > revision
    }, before.labelDocumentRevision)
    const after = await state()
    await diagnosePersistence({ boundary: 'after-load', name, before, loaded: after, payload: text })
    if (downloads.has(text)) await checkAppJsonReload({ page, saved: downloads.get(text), diagnose: diagnosePersistence })
    assert.equal(after.labelDocumentRevision, before.labelDocumentRevision + 1, 'Production JSON load advances document ownership once')
    assert.equal(after.selection, null, 'Production load clears the current selection')
    actions.push({ action: 'Load JSON', name, beforeRevision: before.labelDocumentRevision, afterRevision: after.labelDocumentRevision,
      history: JSON.parse(after.history) })
  }
  async function save(name) {
    const saved = await boundary('pending-or-ready-download', () => saveAppJson({ page, artifactDir, name,
      diagnose: diagnosePersistence, owned, waitForFrames: () => waitForAppFrames(page) }), { name })
    downloads.set(saved.json, saved)
    actions.push({ action: 'Download JSON', path: saved.path, source: saved.payload.diagram.labels[0].text })
    return saved.json
  }

  async function tikz() {
    const result = {}
    // The wrapping label also contains the option text in its label string.
    const select = page.getByLabel(/^TikZ export mode:/)
    for (const mode of ['standalone', 'inlineMath']) {
      await select.selectOption(mode)
      result[mode] = await page.getByRole('textbox', { name: 'Generated TikZ source' }).inputValue()
      if (mode === 'inlineMath') assert.ok(!/\n\s*\n/.test(result[mode]), 'Existing inline-math formatting removes blank lines')
    }
    actions.push({ action: 'read both production TikZ modes' })
    return result
  }
  async function invariant() {
    const current = await state()
    return { json: current.json, history: current.history, tikz: await tikz() }
  }
  async function closeInspector() {
    const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true })
    if (await close.count()) await close.click()
  }
  async function clearSelection() {
    // Escape follows App's production selection handler; remove text focus so it
    // is intentionally a canvas shortcut, not a textarea editing keystroke.
    await readAppGeometry(page, () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
    await boundedPointDiagnostic(() => page.keyboard.press('Escape'), 'App clear-selection key', 5000)
    await boundedPointDiagnostic(() => page.waitForFunction(({ generation, url }) => {
      const marker = window.__stzOwnedAppDocument
      if (location.href !== url || marker?.generation !== generation || marker.api !== window.stzAppLabels) {
        throw new Error('Owned App continuity lost during selection wait')
      }
      return window.stzAppLabels.state().selection === null
    }, { generation, url: expectedUrl }, { timeout: 30_000 }), 'App clear-selection wait', 35_000)
  }
  async function geometry(preserveView = false) {
    await diagnostics.capture('framing:before', { stage, preserveView })
    // App's initial Fit uses model positions, not text extents. A long pending
    // source can extend beyond that view. Pan through the real controls before
    // measuring; never clamp probes or shorten the source to make them fit.
    const framing = await readAppGeometry(page, () => {
      const svg = document.querySelector('svg.svg-diagram')
      const node = document.querySelector('[data-label-id="app-label"] [data-label-state]')
      const [minX, minY, maxX, maxY] = node.getAttribute('data-label-bounds').split(' ').map(Number)
      const matrix = svg.getScreenCTM().inverse().multiply(node.getScreenCTM())
      const center = new DOMPoint((minX + maxX) / 2, (minY + maxY) / 2).matrixTransform(matrix)
      const view = svg.viewBox.baseVal
      return { dx: view.x + view.width / 2 - center.x, dy: center.y - view.y - view.height / 2,
        width: maxX - minX, height: maxY - minY, viewWidth: view.width, viewHeight: view.height }
    })
    await diagnostics.capture('framing:measured', { stage, preserveView, framing })
    assert.ok(framing.width + 32 < framing.viewWidth && framing.height + 28 < framing.viewHeight,
      'App fixture fits the label and every outside boundary probe in the viewBox')
    if (preserveView) assert.ok(Math.abs(framing.dx) <= 0.001 && Math.abs(framing.dy) <= 0.001,
      'Obsolete completion must preserve the framed position without corrective pan')
    if (Math.abs(framing.dx) > 0.001 || Math.abs(framing.dy) > 0.001) {
      const before = await state()
      if (!await page.getByRole('spinbutton', { name: 'pan x value', exact: true }).count()) {
        await page.locator('.camera-summary-toggle').click()
      }
      for (const [axis, delta] of [['x', framing.dx], ['y', framing.dy]]) {
        const field = page.getByRole('spinbutton', { name: `pan ${axis} value`, exact: true })
        await field.fill(String(Number((Number(await field.inputValue()) + delta).toFixed(6))))
      }
      const after = await state()
      assert.equal(after.json, before.json, 'Preview pan preserves the authoritative diagram')
      assert.equal(after.history, before.history, 'Preview pan adds no diagram history entry')
      actions.push({ action: 'pan preview to frame pointer probes', ...framing })
    }
    await diagnostics.capture('pan:complete', { stage, preserveView, framing })
    // Preserve the native scroll and its original deadline. Diagnose failures;
    // do not replace stability with a force action or a different scroll path.
    await boundary('scroll', () => page.locator('svg.svg-diagram').scrollIntoViewIfNeeded({ timeout: 30_000 }), { preserveView })
    await boundary('stable-geometry', () => waitForStableAppGeometry(page), { preserveView })
    await assertUsableGeometry(await coordinates())
    return boundedPointDiagnostic(() => page.evaluate(() => window.stzAppLabels.inspectContent('app-label')), 'App painted geometry')
  }
  async function assertUsableGeometry(points) {
    const visible = await readAppGeometry(page, () => {
      const svg = document.querySelector('svg.svg-diagram'), rect = svg.getBoundingClientRect()
      const viewport = window.visualViewport
      const left = Math.max(rect.left, viewport?.offsetLeft ?? 0, 0)
      const top = Math.max(rect.top, viewport?.offsetTop ?? 0, 0)
      const right = Math.min(rect.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth), innerWidth)
      const bottom = Math.min(rect.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight), innerHeight)
      return { left, top, right, bottom }
    })
    for (const point of [...points.corners, points.center, ...points.probes.flatMap(({ inside, outside }) => [inside, outside])]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && point.x > visible.left && point.x < visible.right
        && point.y > visible.top && point.y < visible.bottom, `Complete App label/probe fits canvas viewport: ${JSON.stringify({ point, visible })}`)
    }
  }
  async function coordinates() {
    return readAppGeometry(page, () => {
      const element = document.querySelector('[data-label-id="app-label"] [data-label-state]')
      if (!(element instanceof SVGGraphicsElement)) throw new Error('Missing App label geometry')
      const [minX, minY, maxX, maxY] = element.getAttribute('data-label-bounds').split(' ').map(Number)
      const matrix = element.getScreenCTM()
      if (!matrix) throw new Error('Missing canvas/client transform')
      const point = (x, y) => { const result = new DOMPoint(x, y).matrixTransform(matrix); return { x: result.x, y: result.y } }
      const midX = (minX + maxX) / 2
      const midY = (minY + maxY) / 2
      return { bounds: { minX, minY, maxX, maxY }, matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f },
        center: point(midX, midY), corners: [point(minX, minY), point(maxX, minY), point(minX, maxY), point(maxX, maxY)], probes: [
          { edge: 'west', inside: point(minX + 0.5, midY), outside: point(minX - 16, midY) },
          { edge: 'east', inside: point(maxX - 0.5, midY), outside: point(maxX + 16, midY) },
          { edge: 'north', inside: point(midX, minY + 0.5), outside: point(midX, minY - 14) },
          { edge: 'south', inside: point(midX, maxY - 0.5), outside: point(midX, maxY + 14) },
        ] }
    })
  }
  async function pointer(point, expected, alt = false) {
    await clearSelection()
    await waitForStableAppGeometry(page)
    const surface = await readAppGeometry(page, ({ x, y }) => {
      const target = document.elementFromPoint(x, y)
      return { tag: target?.tagName, onCanvas: !!target?.closest('svg.svg-diagram'),
        handle: !!target?.closest('[data-geometry-handle], [data-coordinate-anchor-handle]') }
    }, point)
    assert.ok(surface.onCanvas && !surface.handle, `App pointer probe avoids controls/handles: ${JSON.stringify({ point, surface })}`)
    await clickAppPointer(page, point, alt)
    await waitForAppFrames(page)
    const selected = (await state()).selection
    assert.deepEqual(selected, expected, `Real App ${alt ? 'Alt-' : ''}click at ${JSON.stringify(point)}`)
    return { point, alt, selection: selected, surface }
  }
  async function inspectStage(name, text, status, obsoletePoint, preserveView = false) {
    stage = { name, source: text, status }
    await boundary('inspector-close', closeInspector)
    await settled(status)
    const painted = await geometry(preserveView)
    const actual = await readAppGeometry(page.locator('[data-label-id="app-label"] [data-label-state]'), (element) => ({
      source: element.getAttribute('data-label-source'), status: element.getAttribute('data-label-state'),
      request: JSON.parse(element.getAttribute('data-label-request')),
      literal: [...element.querySelectorAll('[data-label-literal]')].map((node) => node.textContent).join(''),
      math: element.querySelectorAll('[data-label-math]').length,
      paint: element.querySelector(':scope > g')?.getAttribute('color'),
      opacity: Number(element.querySelector(':scope > g')?.getAttribute('opacity')),
    }))
    assert.equal(actual.source, text)
    assert.equal(actual.request[0], text, 'Published layout belongs to the current source revision')
    assert.equal(await source(), text, 'The real App model retains authoritative raw source')
    const currentLabel = (await model()).labels[0]
    assert.equal(actual.paint, currentLabel.style.color, 'Visible output uses the current model paint')
    assert.equal(actual.opacity, currentLabel.style.opacity, 'Visible output uses the current model opacity')
    assert.equal(actual.request[2], currentLabel.style.fontSize * 1.35, 'Revision-matched output uses the current font size')
    if (status !== 'ready') {
      assert.equal(actual.literal, text, 'Pending/failure displays the latest complete single-line source')
      assert.equal(actual.math, 0)
    }
    const points = await coordinates()
    const { minX, minY, maxX, maxY } = points.bounds
    const anchor = currentLabel.style.anchor
    assert.ok(Math.abs(anchor.includes('west') ? minX : anchor.includes('east') ? maxX : minX + maxX) < 1e-6,
      'The current horizontal anchor agrees with independently bounded visible content')
    assert.ok(Math.abs(anchor.includes('north') ? minY : anchor.includes('south') ? maxY : minY + maxY) < 1e-6,
      'The current vertical anchor agrees with independently bounded visible content')
    const pointerEvidence = []
    const obsoleteClientPoint = obsoletePoint ? {
      x: points.matrix.a * obsoletePoint.x + points.matrix.c * obsoletePoint.y + points.matrix.e,
      y: points.matrix.b * obsoletePoint.x + points.matrix.d * obsoletePoint.y + points.matrix.f,
    } : null
    for (const alt of [false, true]) {
      for (const edge of points.probes) {
        pointerEvidence.push({ edge: edge.edge, location: 'inside', ...await pointer(edge.inside, { kind: 'label', id: 'app-label' }, alt) })
        pointerEvidence.push({ edge: edge.edge, location: 'outside', ...await pointer(edge.outside, null, alt) })
      }
      if (obsoleteClientPoint) pointerEvidence.push({ location: 'obsolete-layout-only', local: obsoletePoint,
        ...await pointer(obsoleteClientPoint, null, alt) })
    }
    await pointer(points.center, { kind: 'label', id: 'app-label' })
    await waitForStableAppGeometry(page)
    const finalPoints = await coordinates()
    assert.deepEqual(finalPoints, points, 'Pointer and selection events retain the measured canvas/client transform and bounds')
    await assertUsableGeometry(finalPoints)
    const screenshot = resolve(artifactDir, `app-${name}.png`)
    await boundedPointDiagnostic(() => page.screenshot({ path: screenshot, fullPage: true, timeout: 5000 }), 'App stage screenshot', 5500)
    const result = { name, actual, painted, ...points, pointerEvidence, screenshot, app: await state() }
    await record(`app-${name}`, result)
    return result
  }
  async function editor() {
    await closeInspector()
    await geometry()
    const points = await coordinates()
    await pointer(points.center, { kind: 'label', id: 'app-label' })
    await page.getByRole('button', { name: 'Open inspector drawer', exact: true }).click()
    const expand = page.locator('#preview-inspector-drawer').getByRole('button', { name: 'Expand', exact: true })
    if (await expand.count()) await expand.click()
    return page.locator('#preview-inspector-drawer').getByRole('textbox', { name: 'Text', exact: true })
  }
  async function edit(text) {
    const before = await history()
    const field = await editor()
    await field.fill(text)
    assert.equal(await field.inputValue(), text, 'The production textarea retains the exact input')
    await waitFor((input) => {
      window.__stzAppGeometryDiagnostics.assertOwnership()
      return JSON.parse(window.stzAppLabels.state().json).diagram.labels[0].text === input
    }, text)
    const after = await history()
    assert.equal(after.past.length, before.past.length + 1, 'One textarea input event commits one normal edit (no slider coalescing)')
    assert.equal(after.future.length, 0)
    actions.push({ action: 'label editor fill', text, pastBefore: before.past.length, pastAfter: after.past.length })
  }
  async function historyAction(kind, expected) {
    const label = kind === 'Undo' ? 'Undo last diagram change' : 'Redo last undone diagram change'
    await page.getByRole('button', { name: label, exact: true }).click()
    await waitFor((input) => {
      window.__stzAppGeometryDiagnostics.assertOwnership()
      return JSON.parse(window.stzAppLabels.state().json).diagram.labels[0].text === input
    }, expected)
    actions.push({ action: kind, expected, history: await history() })
  }
  function oldLayoutOnlyPoint(old, current) {
    // Use an actually painted, settled earlier layout, never its raw-source
    // pending estimate. Compare local rectangles, then transform the probe with
    // the current canvas/client matrix when clicking, so scroll never makes the
    // obsolete-only point accidentally land outside the actual canvas.
    const oldBox = old.painted.published
    const box = current.painted.published
    const tolerance = 16
    const candidates = [
      { x: oldBox.maxX - 2, y: (oldBox.minY + oldBox.maxY) / 2 },
      { x: oldBox.minX + 2, y: (oldBox.minY + oldBox.maxY) / 2 },
    ]
    const point = candidates.find((candidate) => candidate.x < box.minX - tolerance || candidate.x > box.maxX + tolerance)
    assert.ok(point, 'The independently inspected settled old layout has a probe outside the current layout and picking tolerance')
    assert.ok(point.x > oldBox.minX && point.x < oldBox.maxX && point.y > oldBox.minY && point.y < oldBox.maxY)
    return point
  }
  try {
    await app.install()
    await page.goto(expectedUrl)
    generation = (await boundedPointDiagnostic(() => app.start(), 'App startup readiness', 35_000)).document.generation
    await diagnostics.install()
    await waitFor(() => {
      window.__stzAppGeometryDiagnostics.assertOwnership()
      return window.stzAppLabels !== undefined && document.querySelector('svg.svg-diagram')
    })
    const initial = '$F^{(1)}L$'
    await load(await documentJson(initial), 'app-initial')
    await inspectStage('valid-initial', initial, 'ready')

    const invalid = 'Unicode 日本語  \\unknown{raw} invalid $'
    await hold(invalid)
    await edit(invalid)
    const invalidPending = await pending(invalid)
    await inspectStage('invalid-pending', invalid, 'pending')
    const beforeInvalid = await invariant()
    await release(invalid)
    await inspectStage('invalid-fallback', invalid, 'fallback')
    assert.deepEqual(await invariant(), beforeInvalid, 'Invalid completion changes neither model, history nor either TikZ mode')

    const valid = '$\\mathord{\\mathrm{i}}$'
    await hold(valid)
    await edit(valid)
    await pending(valid)
    await inspectStage('valid-again-pending', valid, 'pending')
    const beforeReady = await invariant()
    const pendingJson = await save('app-valid-pending')
    await release(valid)
    await inspectStage('valid-again-ready', valid, 'ready')
    assert.deepEqual(await invariant(), beforeReady, 'Successful completion changes neither model, history nor either TikZ mode')
    assert.equal(await (await editor()).inputValue(), valid)
    assert.equal(await save('app-valid-ready'), pendingJson, 'Actual Download JSON is independent of conversion completion')
    await closeInspector()
    await historyAction('Undo', invalid)
    await inspectStage('undo-invalid', invalid, 'fallback')
    await historyAction('Redo', valid)
    await inspectStage('redo-valid', valid, 'ready')
    await record('app-authoritative-editor-valid-invalid-valid', { invalidPending, actions: [...actions] })

    const obsolete = '$\\frac{MMMMMMMM}{WWWWWWWW}$'
    await edit(obsolete)
    const oldCompiled = await inspectStage('old-layout-calibration', obsolete, 'ready')
    await historyAction('Undo', valid)
    const currentCompiled = await inspectStage('before-held-undo', valid, 'ready')
    const staleOnly = oldLayoutOnlyPoint(oldCompiled, currentCompiled)
    await hold(obsolete)
    await edit(obsolete)
    const undoPending = await pending(obsolete)
    await inspectStage('undo-held-before', obsolete, 'pending')
    await historyAction('Undo', valid)
    await inspectStage('undo-held-restored', valid, 'ready', staleOnly)
    await historyAction('Redo', obsolete)
    const redoPending = await pending(obsolete)
    assert.ok(redoPending.started >= 2, 'Redo while held starts the restored source request through the mounted App')
    await inspectStage('redo-while-still-held', obsolete, 'pending')
    await historyAction('Undo', valid)
    await inspectStage('undo-again-before-release', valid, 'ready', staleOnly)
    const redoBranch = await invariant()
    assert.ok((await history()).future.length > 0, 'Undo has an existing redo branch before the old result arrives')
    await release(obsolete)
    await inspectStage('undo-held-obsolete-completed', valid, 'ready', staleOnly, true)
    assert.deepEqual(await invariant(), redoBranch, 'Obsolete completion preserves the restored model and existing redo branch')
    await historyAction('Redo', obsolete)
    await inspectStage('redo-after-held-completion', obsolete, 'ready')
    await record('app-undo-during-held-conversion', { undoPending, redoPending, actions: [...actions] })

    // Native textarea normalizes CRLF. Import and download the exact byte-level
    // string before touching the textarea, then separately observe that control.
    const raw = '  日本語 $\\alpha$  \\$ literal\r\nnext \\(x\\)\n tail  '
    await load(await documentJson(raw), 'raw-crlf-import')
    const rawSaved = await save('app-raw-crlf-roundtrip')
    assert.equal(JSON.parse(rawSaved).diagram.labels[0].text, raw)
    assert.equal(await source(), raw)
    assert.ok(!/data-label|requestIdentity|fontReadinessGeneration|unitsPerEm|"layout"|"metrics"/.test(rawSaved), 'Saved schema excludes runtime output/metrics')
    await load(rawSaved, 'raw-crlf-reload')
    assert.equal(await source(), raw)
    await settled('ready')
    const rawField = await editor()
    assert.equal(await rawField.inputValue(), raw.replace(/\r\n/g, '\n'), 'Textarea normalization is observed without changing the authoritative imported CRLF source')
    assert.equal(await source(), raw)
    await boundedPointDiagnostic(() => page.screenshot({ path: resolve(artifactDir, 'app-raw-crlf-editor.png'), fullPage: true, timeout: 5000 }), 'App CRLF screenshot', 5500)
    await record('app-json-exact-source-and-crlf', { raw, saved: JSON.parse(rawSaved), textarea: await rawField.inputValue(), app: await state() })
    await closeInspector()
    const multilineEdit = raw.replace(/\r\n/g, '\n') + ' edited'
    await hold(multilineEdit)
    await edit(multilineEdit)
    await pending(multilineEdit)
    const multilineBefore = await invariant()
    const multilinePending = await geometry()
    await release(multilineEdit)
    await settled('ready')
    assert.deepEqual(await invariant(), multilineBefore)
    const multilineSaved = await save('app-multiline-editor')
    assert.equal(JSON.parse(multilineSaved).diagram.labels[0].text, multilineEdit)
    await closeInspector()
    const multilineReady = await geometry()
    await boundedPointDiagnostic(() => page.screenshot({ path: resolve(artifactDir, 'app-multiline-editor-ready.png'), fullPage: true, timeout: 5000 }), 'App multiline screenshot', 5500)
    await record('app-supported-physical-newline-editor', { source: multilineEdit, pending: multilinePending, ready: multilineReady, app: await state() })

    const documentA = '$\\frac{AAAAAAAA}{BBBBBBBB}$'
    const documentB = '$\\mathord{\\mathrm{j}}$'
    await load(await documentJson(documentA), 'document-a-calibration')
    const oldDocument = await inspectStage('document-a-settled-calibration', documentA, 'ready')
    await hold(documentA)
    await load(await documentJson(documentA), 'held-document-a')
    const pendingA = await pending(documentA)
    await inspectStage('document-a-pending', documentA, 'pending')
    await hold(documentB)
    await load(await documentJson(documentB, { position: { x: 1, y: 0.4, z: 0 }, style: { fontSize: 24, anchor: 'east', color: '#c02060', opacity: 0.45 } }), 'reused-id-document-b')
    await pending(documentB)
    await inspectStage('document-b-pending', documentB, 'pending')
    await release(documentB)
    const b = await inspectStage('document-b-ready', documentB, 'ready')
    const oldOnly = oldLayoutOnlyPoint(oldDocument, b)
    const beforeA = await invariant()
    const revisionB = (await state()).labelDocumentRevision
    const selectionB = (await state()).selection
    await release(documentA)
    assert.equal((await state()).labelDocumentRevision, revisionB)
    assert.deepEqual((await state()).selection, selectionB, 'Obsolete document completion cannot restore its old selection')
    const afterA = await inspectStage('document-b-after-a-completes', documentB, 'ready', oldOnly, true)
    for (const key of ['ink', 'published', 'localToSvg']) {
      assert.deepEqual(afterA.painted[key], b.painted[key], `Document B ${key} remains unchanged after the obsolete document completes`)
    }
    assert.deepEqual(await invariant(), beforeA, 'Document A completion changes neither document B, its history nor either TikZ mode')
    const bLabel = (await model()).labels[0]
    assert.deepEqual(bLabel.position, { x: 1, y: 0.4, z: 0 })
    assert.deepEqual({ color: bLabel.style.color, opacity: bLabel.style.opacity, fontSize: bLabel.style.fontSize, anchor: bLabel.style.anchor },
      { color: '#c02060', opacity: 0.45, fontSize: 24, anchor: 'east' })
    await record('app-reused-id-production-document-load', { pendingA, revisionB, completionOrder: (await state()).completionOrder, actions: [...actions] })
    assert.deepEqual(errors, [], 'No App browser errors')
  } catch (error) {
    primary = error
    // Host evidence is saved before any potentially unavailable browser call.
    for (const capture of [() => diagnostics.failure(error, { stage, errors, droppedErrors, actions }),
      () => app.failure(error, { stage, errors, droppedErrors, actions })]) {
      try { await capture() } catch (secondary) { console.error('App failure capture:', secondary) }
    }
  } finally {
    for (const wait of owned) wait.dispose()
    for (const [name, cleanup] of [
      ['diagnostics', () => diagnostics.dispose()], ['page', () => page.close()], ['ownership', () => app.dispose()],
      ...owned.map((wait) => ['event', () => wait.drain()]),
    ]) {
      try { await boundedPointDiagnostic(cleanup, `App ${name} cleanup`, 2500) }
      catch (error) { cleanupFailure ??= error; console.error(`App ${name} cleanup:`, error) }
    }
    page.off('pageerror', onError)
  }
  if (primary) throw primary
  if (cleanupFailure) throw cleanupFailure
}
