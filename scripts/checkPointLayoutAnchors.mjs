import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { layoutAnchorGroup as group, layoutShapes, layoutRegimes, layoutForShapeRegime, pointAnchorsForShape,
  layoutShapeParameters, layoutAnchorArtifacts, assertLayoutAnchorEvidence, assertPointTikzSourceByMode } from './pointLayoutAnchorsContract.mjs'
import { layoutImportCases as importCases } from './pointLayoutAnchorsContract.mjs'
import { createOwnedAppPage } from './ownedAppPage.mjs'
import { ownPageEvent } from './ownedPageEvent.mjs'
import { resolvePointInspectorField } from './pointInspectorFields.mjs'
import { observeGeometricSelection, selectGeometricPoint } from './pointGeometricSelection.mjs'
import { dragSelectedPoint, prepareSelectedPointCanvas } from './pointNativeDrag.mjs'
import { boundedPointDiagnostic, createPointDiagnostics } from './pointCheckDiagnostics.mjs'
import { saveAppJson } from './appJsonPersistence.mjs'
import { observePointLiteral, assertPositionedLiteral } from './pointLiteralOracle.mjs'
import { withOwnedFontFace, observeOwnedFontFace } from './ownedFontFace.mjs'

const paint = { text: { color: '#203040', opacity: 1 }, fill: { enabled: true, color: '#d8ecff', opacity: .7 },
  stroke: { enabled: true, color: '#203040', opacity: 1, width: .4, lineStyle: 'solid', dashPhase: 0, lineCap: 'butt', lineJoin: 'miter' } }
const source = ' body $\\frac{x_1}{y^2}$ gyp '
const captions = { innerXSep: 'Inner xsep', innerYSep: 'Inner ysep', outerXSep: 'Outer xsep', outerYSep: 'Outer ysep',
  minimumWidth: 'Minimum width', minimumHeight: 'Minimum height', anchor: 'Anchor' }
const importedSource = String.raw`% Phase 32D literal dimensions; no TeX execution.
\tikzset{` + importCases.map(({ key, options }) => `${key}/.style={rectangle,${options}}`).join(',\n') + String.raw`,
layout unsupported text metrics/.style={rectangle,text height=8pt,text depth=3pt,text width=2cm,align=center}}
`

// Production DOM observations use native SVG matrices. The expected placement
// is the outer model-coordinate transform; selected-anchor translation is read
// from the actual painted contour, never recomputed with the solver under test.
export async function observeLayoutPoint(page, id = 'app-point') {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
    if (!node) return null
    const contour = node.querySelector('[data-point-contour]'), body = node.querySelector('[data-label-state]')
    if (!contour || !body) return { limitation: node.getAttribute('data-point-shape-limitation'), anchor: node.getAttribute('data-point-anchor') }
    const pair = (name) => { const values = node.getAttribute(name)?.trim().split(/\s+/).map(Number); return values?.length === 2 ? { x: values[0], y: values[1] } : null }
    const coordinate = (point) => ({ x: point.x, y: point.y })
    const anchorOffset = pair('data-point-anchor-offset'), matrix = contour.getScreenCTM(), inkMatrix = body.getScreenCTM()
    const local = node.getCTM().inverse().multiply(body.getCTM()), bounds = contour.getBBox()
    const at = contour.getPointAtLength(contour.getTotalLength() * .23).matrixTransform(matrix)
    const clean = (element) => ({ tag: element.localName, attributes: Object.fromEntries([...element.attributes]
      .filter(({ name }) => !name.startsWith('data-') && name !== 'pointer-events').map(({ name, value }) => [name, value])) })
    return { source: body.getAttribute('data-label-source'), state: body.getAttribute('data-label-state'),
      shape: node.getAttribute('data-point-shape'), anchor: node.getAttribute('data-point-anchor'),
      layout: JSON.parse(node.getAttribute('data-point-layout')), pointRequest: node.getAttribute('data-point-request'), bodyRequest: body.getAttribute('data-label-request'),
      anchorOffset, bodyOrigin: pair('data-point-body-origin'), baseline: Number(node.getAttribute('data-point-body-baseline')),
      placement: coordinate(new DOMPoint().matrixTransform(node.getScreenCTM())),
      placedAnchor: anchorOffset && coordinate(new DOMPoint(anchorOffset.x, anchorOffset.y).matrixTransform(matrix)),
      boundary: coordinate(at), center: coordinate(at), contour: clean(contour), nodeTransform: node.getAttribute('transform'), bodyTransform: body.getAttribute('transform'),
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      shapeBounds: node.getAttribute('data-point-shape-bounds'), paintedBounds: node.getAttribute('data-point-painted-bounds'),
      bodyBounds: node.getAttribute('data-point-body-bounds'), anchorBounds: node.getAttribute('data-point-anchor-bounds'),
      contourLength: contour.getTotalLength(), math: body.querySelectorAll('[data-label-math]').length,
      bodyUpright: Math.abs(local.b) < 1e-10 && Math.abs(local.c) < 1e-10,
      inkMatrix: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, inkMatrix[key]])),
      literal: [...body.querySelectorAll('[data-label-literal]')].map((text) => text.textContent).join('') }
  }, id)
}

export async function runPointLayoutAnchorChecks({ browser, origin, artifactDir, record, observe, startGroup, completeGroup, setStage }) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1300 }, acceptDownloads: true })
  const pageErrors = [], waits = [], held = new Set()
  context.on('page', (page) => { page.on('pageerror', (error) => pageErrors.push(error.message)); page.on('crash', () => pageErrors.push('Owned layout page crashed')) })
  const page = await context.newPage(), url = `${origin}/stratified-tikz/scripts/fixtures/freeLabelsApp.html`
  const app = createOwnedAppPage({ page, expectedUrl: url, artifactDir, prefix: 'point-layout-app' })
  const diagnostic = createPointDiagnostics({ artifactDir, observe, artifactPrefix: 'point-layout-selection' })
  let scenario = 'point-layout-per-shape-spacing-minima', primary, selectionSequence = 0
  async function retainFailure(name, details) {
    try { await writeFile(resolve(artifactDir, name), JSON.stringify(details, null, 2) + '\n') }
    catch (error) { pageErrors.push(`Failure evidence ${name}: ${error.message}`); console.error(`Layout failure evidence ${name}: ${error.message}`) }
  }
  const inspector = page.locator('#preview-inspector-drawer')
  const state = () => app.readState()
  const model = async () => JSON.parse((await state()).json).diagram
  const settle = () => page.waitForFunction(() => !document.querySelector('[data-label-state="pending"]'), undefined, { timeout: 30_000 })
  async function event(name, kind, action) { const wait = ownPageEvent(page, kind, { name, timeoutMs: 30_000 }); waits.push(wait); return wait.run(action) }
  async function load(input) {
    const before = await state(), json = typeof input === 'string' ? input : JSON.stringify(input)
    const { event: chooser } = await event(scenario + '-load', 'filechooser', () => page.getByRole('button', { name: 'Load JSON', exact: true }).click())
    await chooser.setFiles({ name: 'point-layout.json', mimeType: 'application/json', buffer: Buffer.from(json) })
    await page.waitForFunction((revision) => window.stzAppLabels.state().labelDocumentRevision > revision, before.labelDocumentRevision)
  }
  async function document(shape = 'rectangle', layout = { anchor: 'base east' }, text = source, ambientDimension = 2, combined = false) {
    const input = JSON.parse(await page.evaluate(({ ambientDimension, text }) => window.stzAppLabels.pointDocumentJson(ambientDimension, text), { ambientDimension, text }))
    const point = input.diagram.strata[0]
    point.position = { x: 3, y: 3, z: ambientDimension === 3 ? .5 : 0 }
    point.style = { ...point.style, shape, size: 8, opacity: 1, paint: structuredClone(paint), layout: structuredClone(layout),
      shapeParameters: structuredClone(layoutShapeParameters[shape] ?? {}) }
    if (combined) {
      const siblings = await page.evaluate(() => window.stzAppLabels.exportDocumentJson(2))
      const siblingModel = JSON.parse(siblings.json).diagram
      input.diagram.labels = siblingModel.labels.filter(({ layer }) => layer === 0).slice(0, 2)
      input.diagram.strata.push(siblingModel.strata[0])
    }
    return input
  }
  async function select(id = 'app-point', observePoint = observeLayoutPoint) {
    let nativeSelection
    const rendered = await selectGeometricPoint({ page, readState: state, observePoint, diagnose: async (details) => {
      if (details.observation?.after) nativeSelection = details.observation
      await diagnostic(group, scenario, details)
    },
      secondaryErrors: pageErrors, scenario, sequence: ++selectionSequence, id, boundary: true })
    rendered.nativeSelection = { id, selected: nativeSelection.selected, requestedClick: nativeSelection.requestedClick, events: nativeSelection.after.events }
    const beforeInspector = await state()
    const open = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
    if (await open.count()) await open.click()
    const expand = inspector.getByRole('button', { name: 'Expand', exact: true })
    if (await expand.count()) await expand.click()
    const afterInspector = await state()
    await boundedPointDiagnostic(() => diagnostic(group, scenario, { boundary: 'inspector-reopened',
      sequence: selectionSequence, beforeInspector, afterInspector }), 'Layout Inspector reopening evidence')
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) {
      assert.equal(afterInspector[field], beforeInspector[field], `Native Inspector reopening preserves ${field}`)
    }
    return rendered
  }
  async function cycleOwner(selectedId, expectedId, observePoint = observeLayoutPoint) {
    const sequence = ++selectionSequence, token = `${scenario}:owner-cycle:${sequence}:${selectedId}`
    const entry = { selectedId, expectedId, sequence, secondaryErrors: [] }
    let cyclePrimary, installed = false
    const retain = async (name, operation) => {
      try { return await boundedPointDiagnostic(operation, `Layout owner cycling ${name}`) }
      catch (error) {
        entry.secondaryErrors.push({ name, message: error.message })
        pageErrors.push(`Layout owner cycling ${name}: ${error.message}`)
      }
    }
    try {
      entry.preparation = await prepareSelectedPointCanvas({ page, readState: state,
        diagnose: (details) => diagnostic(group, scenario, details), secondaryErrors: pageErrors,
        scenario, sequence, id: selectedId })
      await page.evaluate(({ token, selectedId }) => {
        const registry = window.__stzLayoutOwnerCycles ??= new Map()
        if (registry.has(token)) throw new Error(`Owner-cycle observer already owned: ${token}`)
        const describe = (element) => element instanceof Element ? {
          tag: element.localName, pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
          drawer: !!element.closest('#preview-inspector-drawer'), svg: element instanceof SVGElement,
          canvas: !!element.closest('svg.svg-diagram'), canvasRoot: element.matches('svg.svg-diagram'),
          pointHandle: element.matches('circle.svg-geometry-handle') && !!element.closest('[aria-label="Selected point drag handles"]'),
        } : null
        const owned = { events: [], droppedEvents: 0 }
        owned.listener = (event) => {
          if (owned.events.length === 16) { owned.droppedEvents++; return }
          owned.events.push({ phase: 'owner-cycle', selectedId, type: event.type, trusted: event.isTrusted,
            altKey: event.altKey, pointerId: event.pointerId ?? null, button: event.button, buttons: event.buttons,
            client: { x: event.clientX, y: event.clientY }, target: describe(event.target),
            path: event.composedPath().slice(0, 16).map(describe), selection: window.stzAppLabels.state().selection })
        }
        registry.set(token, owned)
        for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, owned.listener, true)
      }, { token, selectedId })
      installed = true
      entry.stateBefore = await state()
      // The selection wrapper has reopened the Inspector. Preparation above
      // closes it and completes native mode/scroll changes before this measure.
      entry.rendered = await observePoint(page, selectedId)
      assert.ok(entry.rendered, 'Owner cycling has connected freshly measured point geometry')
      entry.requestedClick = entry.rendered.boundary
      entry.before = await page.evaluate(observeGeometricSelection, { id: selectedId, click: entry.requestedClick, token: null })
      await retain('before evidence', () => diagnostic(group, scenario, { boundary: 'before-native-owner-cycle', ownerCycle: entry }))
      assert.deepEqual(entry.before.errors, [], 'Owner-cycle geometry observation is complete')
      assert.equal(entry.before.inspector.open, false, 'Owner cycling starts with a closed Inspector')
      assert.equal(entry.stateBefore.selection?.id, selectedId, 'Owner cycling begins with the selected owner')
      const intended = (target) => target?.pointId === selectedId && target.svg === true && target.canvas === true && target.drawer === false
      assert.ok(intended(entry.before.elementFromPoint), 'Fresh owner-cycle click reaches the intended SVG point')
      try {
        await page.keyboard.down('Alt')
        await page.mouse.click(entry.requestedClick.x, entry.requestedClick.y)
      } catch (error) { cyclePrimary = error }
      entry.stateAfter = await retain('after state', state)
      const retained = await retain('after events', () => page.evaluate((token) => {
        const owned = window.__stzLayoutOwnerCycles?.get(token)
        return owned ? { events: [...owned.events], droppedEvents: owned.droppedEvents } : null
      }, token))
      if (retained) Object.assign(entry, retained)
      await retain('after evidence', () => diagnostic(group, scenario, { boundary: 'after-native-owner-cycle-before-assertion', ownerCycle: entry }))
      if (cyclePrimary) throw cyclePrimary
      assert.equal(entry.stateAfter?.selection?.id, expectedId, 'Alt cycles to the actual next owner')
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) {
        assert.deepEqual(entry.stateAfter[field], entry.stateBefore[field], `Owner cycling preserves ${field}`)
      }
      assert.equal(entry.droppedEvents, 0, 'All native owner-cycle events were retained')
      let previous = -1, pointerId
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        const index = entry.events.findIndex((event, index) => index > previous && event.type === type && event.phase === 'owner-cycle'
          && event.trusted === true && event.altKey === true && intended(event.target)
          && event.path.some((element) => element?.pointId === selectedId) && event.path.some((element) => element?.canvasRoot === true)
          && Math.abs(event.client.x - entry.requestedClick.x) < 1 && Math.abs(event.client.y - entry.requestedClick.y) < 1
          && (pointerId === undefined || event.pointerId === pointerId || (type === 'click' && event.pointerId === null)))
        assert.ok(index >= 0, `Native owner-cycle ${type} reached the intended point path`)
        if (type === 'pointerdown') pointerId = entry.events[index].pointerId
        previous = index
      }
      assert.ok(Number.isInteger(pointerId), 'Native owner cycling retains its pointer identity')
      assert.deepEqual(entry.secondaryErrors, [], 'Owner-cycle observations completed')
    } catch (error) { cyclePrimary ??= error }
    finally {
      await retain('Alt release', () => page.keyboard.up('Alt'))
      if (installed) await retain('observer cleanup', () => page.evaluate((token) => {
        const registry = window.__stzLayoutOwnerCycles, owned = registry?.get(token)
        if (owned) for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, owned.listener, true)
        registry?.delete(token)
        if (registry?.size === 0) delete window.__stzLayoutOwnerCycles
      }, token))
      await retain('final evidence', () => diagnostic(group, scenario, { boundary: 'native-owner-cycle-finished', ownerCycle: entry,
        ...(cyclePrimary ? { primary: { message: cyclePrimary.message, stack: cyclePrimary.stack } } : {}) }))
    }
    if (cyclePrimary) throw cyclePrimary
    assert.deepEqual(entry.secondaryErrors, [], 'Owner-cycle observation and cleanup completed')
    return entry
  }
  async function observeEntry(input, extra = {}, id = 'app-point') {
    const point = input.diagram.strata.find((point) => point.id === id), rendered = await observeLayoutPoint(page, id)
    const current = (await model()).strata.find((point) => point.id === id)
    const entry = { result: 'passed', shape: point.style.shape, source: point.text ?? '', anchor: point.style.layout?.anchor ?? 'center',
      layout: point.style.layout, rendered, modelPositionUnchanged: JSON.stringify(current.position) === JSON.stringify(point.position), ...extra }
    await observe(`${scenario}-${extra.regime ?? extra.key ?? entry.shape}-${entry.anchor}`, { group, entry })
    return entry
  }
  async function save(details) {
    const evidence = { scenario, group, result: 'passed', pageErrors: [...pageErrors], ...details }
    assertLayoutAnchorEvidence(evidence, scenario)
    await writeFile(resolve(artifactDir, `${scenario}.json`), JSON.stringify(evidence, null, 2) + '\n')
    await record(scenario, { group, result: 'passed', artifacts: layoutAnchorArtifacts(scenario) })
  }
  async function tikzArtifacts(stem = scenario) {
    const outputs = {}
    for (const mode of ['standalone', 'inlineMath']) {
      await page.getByLabel(/^TikZ export mode:/).selectOption(mode)
      outputs[mode] = await page.getByRole('textbox', { name: 'Generated TikZ source', exact: true }).inputValue()
      await writeFile(resolve(artifactDir, `${stem}-${mode}.tex`), outputs[mode])
    }
    return outputs
  }
  async function siblingSnapshot() {
    return page.evaluate(() => {
      const model = JSON.parse(window.stzAppLabels.state().json).diagram
      return { labels: model.labels, paths: model.strata.filter(({ geometricKind }) => geometricKind === 'curve'),
        rendered: [...document.querySelectorAll('[data-label-id], [data-path-inline-node-path-id]')].map((node) => ({
          source: node.querySelector('[data-label-source]')?.getAttribute('data-label-source'),
          state: node.querySelector('[data-label-state]')?.getAttribute('data-label-state'),
          paths: [...node.querySelectorAll('path')].map((path) => path.getAttribute('d')),
          text: [...node.querySelectorAll('text')].map((text) => text.textContent) })) }
    })
  }
  async function nativeField(key, value, expectedModel = value) {
    const control = await resolvePointInspectorField(page, captions[key], 'input[type="text"]'), token = `${scenario}:${key}`
    const requestCountBefore = (await state()).requests
    await control.evaluate((element, token) => {
      const registry = window.__stzLayoutInputs ??= new Map(), owned = { element, events: [] }
      owned.listener = (event) => owned.events.push({ type: event.type, trusted: event.isTrusted, value: element.value })
      registry.set(token, owned); element.addEventListener('input', owned.listener)
    }, token)
    let fieldPrimary, completedField
    try {
      await control.fill(String(value))
      const field = await page.evaluate((token) => {
        const owned = window.__stzLayoutInputs.get(token)
        return { value: owned.element.value, events: [...owned.events] }
      }, token)
      const selectedId = (await state()).selection?.id
      field.modelValue = (await model()).strata.find(({ id }) => id === selectedId).style.layout[key]
      Object.assign(field, { key, expected: String(value), expectedModel })
      field.requestsUnchanged = (await state()).requests === requestCountBefore
      await observe(`${scenario}-${key}-native-input`, { group, field })
      assert.equal(field.value, field.expected); assert.equal(field.modelValue, expectedModel)
      assert.ok(field.events.length > 0 && field.events.every(({ trusted }) => trusted === true))
      assert.equal(field.requestsUnchanged, true, 'Layout/anchor edits reuse the existing body conversion')
      completedField = field
    } catch (error) { fieldPrimary = error }
    finally {
      try { await page.evaluate((token) => { const registry = window.__stzLayoutInputs, owned = registry?.get(token); if (owned) owned.element.removeEventListener('input', owned.listener); registry?.delete(token) }, token) }
      catch (error) { fieldPrimary ??= error; pageErrors.push(`Layout input cleanup: ${error.message}`) }
    }
    if (fieldPrimary) throw fieldPrimary
    return completedField
  }
  async function diagnosticClick(kind, click) {
    await page.evaluate(() => {
      window.__stzLayoutDiagnosticEvents = []
      window.__stzLayoutDiagnosticListener = (event) => window.__stzLayoutDiagnosticEvents.push({ type: event.type, trusted: event.isTrusted, x: event.clientX, y: event.clientY })
      for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, window.__stzLayoutDiagnosticListener, true)
    })
    let clickPrimary, events, selected
    try { await page.mouse.click(click.screen.x, click.screen.y); selected = (await state()).selection }
    catch (error) { clickPrimary = error }
    finally {
      try { events = await page.evaluate(() => {
        for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, window.__stzLayoutDiagnosticListener, true)
        const events = window.__stzLayoutDiagnosticEvents; delete window.__stzLayoutDiagnosticEvents; delete window.__stzLayoutDiagnosticListener; return events
      }) } catch (error) { clickPrimary ??= error }
    }
    if (clickPrimary) throw clickPrimary
    const entry = { kind, click, events, selectedId: selected?.id ?? null }
    await observe(`${scenario}-diagnostic-${kind}`, { group, entry })
    return entry
  }
  try {
    setStage?.(group); await startGroup(group); await app.install(); await page.goto(url); await app.start()
    const sizing = [], outerSepPaintInvariant = []
    for (const shape of layoutShapes) {
      const observed = new Map()
      for (const regime of layoutRegimes) {
        const input = await document(shape, layoutForShapeRegime(shape, regime))
        await load(input); await settle()
        const entry = await observeEntry(input, { regime: regime.key }); sizing.push(entry); observed.set(regime.key, entry.rendered)
      }
      const small = observed.get('unequal-padding'), large = observed.get('outer-clearance')
      outerSepPaintInvariant.push({ shape, sameContour: JSON.stringify(small.contour) === JSON.stringify(large.contour),
        samePaintedBounds: small.paintedBounds === large.paintedBounds, differentAnchorBounds: small.anchorBounds !== large.anchorBounds,
        ...(shape === 'diamond' ? { paintShrink: { width: small.bounds.width - large.bounds.width, height: small.bounds.height - large.bounds.height } } : {}) })
    }
    await save({ cases: sizing, outerSepPaintInvariant })

    scenario = 'point-layout-anchor-support-rotation'
    const anchorCases = []
    for (const shape of layoutShapes) for (const anchor of pointAnchorsForShape(shape)) {
      const input = await document(shape, { innerXSep: 3, innerYSep: 1, outerXSep: 2, outerYSep: 4, anchor })
      await load(input); await settle(); anchorCases.push(await observeEntry(input))
    }
    const unsupported = await document('rectangle', { anchor: 'not a PGF anchor' })
    await load(unsupported); await settle()
    const unsupportedAnchor = { savedAnchor: (await model()).strata[0].style.layout.anchor,
      diagnostic: await page.locator('[data-point-shape-warning]').getAttribute('aria-label') ?? '', nativeCases: [] }
    for (const ambientDimension of [2, 3]) for (const shape of ['ellipse', 'circle', 'cylinder']) {
      const input = await document(shape, { anchor: unsupportedAnchor.savedAnchor, minimumWidth: 1000, minimumHeight: 1000 }, 'WWWW diagnostic', ambientDimension)
      await load(input); await settle()
      const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true }); if (await close.count()) await close.click()
      await page.getByRole('button', { name: 'Select', exact: true }).click(); await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded()
      const rendered = await page.evaluate(() => {
        const node = document.querySelector('[data-point-id="app-point"] [data-point-node]'), body = node.querySelector('[data-label-state]')
        const text = body.querySelector('text'), warning = node.querySelector('[data-point-shape-warning]'), matrix = node.getScreenCTM(), inverse = matrix.inverse()
        const attrBounds = (name) => { const [minX, minY, maxX, maxY] = node.getAttribute(name).split(/\s+/).map(Number); return { minX, minY, maxX, maxY } }
        const localBounds = (element) => {
          const box = element.getBBox(), own = element.getScreenCTM()
          const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
            .map(([x, y]) => new DOMPoint(x, y).matrixTransform(own).matrixTransform(inverse))
          return { minX: Math.min(...corners.map(({ x }) => x)), maxX: Math.max(...corners.map(({ x }) => x)), minY: Math.min(...corners.map(({ y }) => y)), maxY: Math.max(...corners.map(({ y }) => y)) }
        }
        const click = (local) => { const screen = new DOMPoint(local.x, local.y).matrixTransform(matrix); return { local, screen: { x: screen.x, y: screen.y } } }
        const character = text.getExtentOfChar(0), bodyPoint = new DOMPoint(character.x + character.width / 2, character.y + character.height * .55).matrixTransform(text.getScreenCTM()).matrixTransform(inverse)
        const bodyBounds = localBounds(text), warningBounds = localBounds(warning)
        const bodyClick = click({ x: bodyPoint.x, y: bodyPoint.y }), warningClick = click({ x: (warningBounds.minX + warningBounds.maxX) / 2, y: warningBounds.minY + 3 })
        const farClick = click({ x: bodyBounds.maxX + 100, y: (bodyBounds.minY + bodyBounds.maxY) / 2 })
        return { source: body.getAttribute('data-label-source'), anchor: node.getAttribute('data-point-anchor'), layout: JSON.parse(node.getAttribute('data-point-layout')),
          state: body.getAttribute('data-label-state'), diagnostic: warning.getAttribute('aria-label'), contourCount: node.querySelectorAll('[data-point-contour]').length,
          bodyBounds, warningBounds, shapeBounds: attrBounds('data-point-shape-bounds'), paintedBounds: attrBounds('data-point-painted-bounds'), anchorBounds: attrBounds('data-point-anchor-bounds'), bodyClick, warningClick, farClick,
          nativeCanvasAtFarClick: document.querySelector('svg.svg-diagram').contains(document.elementFromPoint(farClick.screen.x, farClick.screen.y)) }
      })
      assert.equal(rendered.nativeCanvasAtFarClick, true, 'Far diagnostic click reaches the native SVG canvas')
      const before = await state(), body = await diagnosticClick('body', rendered.bodyClick); assert.equal(body.selectedId, 'app-point')
      const ring = await page.evaluate(() => {
        const node = document.querySelector('[data-point-id="app-point"] [data-point-node]'), ring = node.querySelector(':scope > circle[data-svg-export-exclude]')
        return { radius: Number(ring.getAttribute('r')), cx: Number(ring.getAttribute('cx')), cy: Number(ring.getAttribute('cy')) }
      })
      const far = await diagnosticClick('far', rendered.farClick); assert.notEqual(far.selectedId, 'app-point', 'Hidden requested contour cannot receive hits')
      const warning = await diagnosticClick('warning', rendered.warningClick); assert.equal(warning.selectedId, 'app-point')
      assert.equal((await state()).json, before.json)
      const entry = { result: 'passed', ambientDimension, shape, rendered, ring, clicks: [body, far, warning], diagramUnchanged: true }
      unsupportedAnchor.nativeCases.push(entry); await observe(`${scenario}-unsupported-${shape}-${ambientDimension}d`, { group, entry })
    }
    await save({ cases: anchorCases, unsupportedAnchor })

    scenario = 'point-layout-native-controls-persistence'
    const raw = '  native $x_i$\t\\keep\n tail  ', input = await document('rectangle', {}, raw)
    input.diagram.strata.push({ ...structuredClone(input.diagram.strata[0]), id: 'copy-point', position: { x: -1, y: 3, z: 0 } })
    await load(input); await settle(); await select()
    const fields = []
    for (const [key, value] of Object.entries({ innerXSep: -1, innerYSep: 0, outerXSep: 3, outerYSep: 5, minimumWidth: 64, minimumHeight: 38, anchor: 'base east' })) fields.push(await nativeField(key, value))
    const configured = structuredClone((await model()).strata.find(({ id }) => id === 'app-point').style.layout)
    const beforePaintRequests = (await state()).requests
    await (await resolvePointInspectorField(page, 'Fill opacity', 'input[type="text"]')).fill('.45')
    assert.equal((await state()).requests, beforePaintRequests, 'Paint changes reuse existing conversion')
    await page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click()
    await page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click()
    assert.notEqual((await model()).strata[0].style.layout.anchor, 'base east')
    await page.getByRole('button', { name: 'Redo last undone diagram change', exact: true }).click()
    assert.deepEqual((await model()).strata[0].style.layout, configured)
    await inspector.getByRole('button', { name: 'Copy style', exact: true }).click()
    await select('copy-point'); await inspector.getByRole('button', { name: 'Paste style', exact: true }).click()
    assert.deepEqual((await model()).strata.find(({ id }) => id === 'copy-point').style.layout, configured)
    await select()
    const dialog = ownPageEvent(page, 'dialog', { name: scenario + '-preset', timeoutMs: 30_000 }); waits.push(dialog)
    const accepted = dialog.outcome.then(async (outcome) => {
      if (!outcome.ok) return { error: outcome.error }
      try { await outcome.event.accept('Layout acceptance preset'); return { accepted: true } }
      catch (error) { return { error } }
    })
    await dialog.run(() => inspector.getByRole('button', { name: 'Save current', exact: true }).click())
    const promptResult = await accepted; if (promptResult.error) throw promptResult.error
    await page.waitForFunction(() => JSON.parse(window.stzAppLabels.state().json).diagram.userStylePresets?.some(({ name }) => name === 'Layout acceptance preset'))
    const preset = (await model()).userStylePresets.find(({ name }) => name === 'Layout acceptance preset')
    assert.deepEqual(preset.style.layout, configured)
    await nativeField('minimumWidth', 80)
    await inspector.locator('.style-preset-list-item').filter({ hasText: 'Layout acceptance preset' }).click()
    await inspector.getByRole('button', { name: 'Apply', exact: true }).click()
    assert.deepEqual((await model()).strata[0].style.layout, configured)
    const saved = await saveAppJson({ page, artifactDir, name: `${scenario}-saved`, owned: waits, diagnose: (details) => observe(scenario + '-save', { group, details }) })
    await nativeField('anchor', 'north'); await load(saved.json); await settle()
    assert.deepEqual((await model()).strata[0].style.layout, configured); assert.equal((await model()).strata[0].text, raw)
    const outputs = await tikzArtifacts()
    for (const code of Object.values(outputs)) { assert.ok(code.includes('anchor=base east')); assert.ok(code.includes('inner xsep=-1pt')) }
    assertPointTikzSourceByMode(outputs, raw)
    await save({ fields, configured, preset, nativeInputs: true, historyRestored: true, clipboardRestored: true, presetRestored: true,
      saveReloadRestored: true, rawSourcePreserved: true, standaloneTikz: true, inlineTikz: true })

    scenario = 'point-layout-import-order-units'
    await load(await document('rectangle', {})); await settle(); await select()
    await writeFile(resolve(artifactDir, `${scenario}.sty`), importedSource)
    const { event: chooser } = await event(scenario + '-import', 'filechooser', () => page.getByRole('button', { name: 'Choose .sty/.tex', exact: true }).click())
    await chooser.setFiles({ name: 'point-layout-import.sty', mimeType: 'text/plain', buffer: Buffer.from(importedSource) })
    await page.waitForFunction(() => JSON.parse(window.stzAppLabels.state().json).diagram.importedTikzStyleReferences?.some(({ key }) => key === 'layout signed zero'))
    const imports = []
    for (const spec of importCases) {
      await inspector.locator('.style-preset-list-item').filter({ hasText: spec.key }).click(); await inspector.getByRole('button', { name: 'Apply', exact: true }).click(); await settle()
      const rendered = await observeLayoutPoint(page), current = await model(), point = current.strata[0]
      const actual = Object.fromEntries(Object.keys(spec.expected).map((key) => [key, key === 'anchor' ? rendered.anchor : rendered.layout[key]]))
      for (const [key, expected] of Object.entries(spec.expected)) {
        if (typeof expected === 'number') assert.ok(Math.abs(actual[key] - expected) < .00001, `${spec.key}/${key}`)
        else assert.equal(actual[key], expected)
      }
      const reference = current.importedTikzStyleReferences.find(({ id }) => id === point.importedTikzStyleReferenceId)
      assert.ok(reference.options.includes(spec.options.split(',')[0]))
      const entry = { key: spec.key, result: 'passed', expected: spec.expected, actual, rendered, reference, sourcePreserved: true }
      imports.push(entry); await observe(scenario + '-' + spec.key, { group, entry })
    }
    await inspector.locator('.style-preset-list-item').filter({ hasText: 'layout unsupported text metrics' }).click(); await inspector.getByRole('button', { name: 'Apply', exact: true }).click()
    const diagnostics = (await model()).importedTikzStyleReferences.find(({ key }) => key === 'layout unsupported text metrics').previewDiagnostics
    assert.ok(diagnostics?.some((entry) => /text height|text depth/.test(JSON.stringify(entry))))
    const savedImport = await saveAppJson({ page, artifactDir, name: `${scenario}-saved`, owned: waits, diagnose: (details) => observe(scenario + '-save', { group, details }) })
    await load(savedImport.json); await settle()
    const outputsImport = await tikzArtifacts()
    for (const code of Object.values(outputsImport)) assert.ok(code.includes('layout unsupported text metrics'))
    await save({ cases: imports, nativeImport: true, saveReloadRestored: true, standaloneTikz: true, inlineTikz: true, unsupportedTextMetricsDiagnosed: true, diagnostics })

    scenario = 'point-layout-async-combined-isolation'
    const wide = '$\\frac{wide_{32D}}{1+\\frac{x}{y}}$', tall = '$\\sum_{j=1}^{n}\\frac{x_j}{y_j}$', invalid = '  $\\unknownLayoutMacro$\t\\slash\n tail  '
    const asyncInput = await document('circular sector', { anchor: 'arc start', outerXSep: 4, outerYSep: 7 }, '$initial$', 2, true)
    await load(asyncInput); await settle(); await select()
    const siblings = await siblingSnapshot(), transitions = []
    async function transition(key, text, expectedState) {
      const input = structuredClone(asyncInput); input.diagram.strata[0].text = text
      const current = await observeEntry(input, { key, siblingsUnchanged: JSON.stringify(await siblingSnapshot()) === JSON.stringify(siblings) })
      assert.equal(current.rendered.state, expectedState)
      if (expectedState !== 'ready') {
        current.literalObservation = await observePointLiteral(page, { id: 'app-point' })
        assertPositionedLiteral(current.literalObservation, text)
      }
      transitions.push(current)
    }
    await page.evaluate((source) => window.stzAppLabels.hold(source), wide); held.add(wide)
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(wide)
    await page.waitForFunction((source) => window.stzAppLabels.pending(source)?.started > 0, wide)
    await transition('pending-wide', wide, 'pending')
    const pendingHistory = (await state()).history
    await page.evaluate((source) => window.stzAppLabels.release(source), wide); held.delete(wide); await settle(); await transition('ready-wide', wide, 'ready')
    assert.equal((await state()).history, pendingHistory)
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(invalid); await settle(); await transition('fallback', invalid, 'fallback')
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(tall); await settle(); await transition('ready-tall', tall, 'ready')
    const stale = '$stale_{layout32D}$'
    await page.evaluate((source) => window.stzAppLabels.hold(source), stale); held.add(stale)
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(stale)
    await page.waitForFunction((source) => window.stzAppLabels.pending(source)?.started > 0, stale)
    const replacement = structuredClone(asyncInput); replacement.diagram.strata[0].text = tall
    await load(replacement); await settle(); await page.evaluate((source) => window.stzAppLabels.release(source), stale); held.delete(stale)
    await transition('stale-load', tall, 'ready'); await select()
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(wide); await settle()
    await page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click(); await settle(); await transition('undo', tall, 'ready')
    await page.getByRole('button', { name: 'Redo last undone diagram change', exact: true }).click(); await settle(); await transition('redo', wide, 'ready')
    const undoLate = '$undoLate_{layout32D}$'
    await page.evaluate((source) => window.stzAppLabels.hold(source), undoLate); held.add(undoLate)
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(undoLate)
    await page.waitForFunction((source) => window.stzAppLabels.pending(source)?.started > 0, undoLate)
    await page.getByRole('button', { name: 'Undo last diagram change', exact: true }).click(); await settle()
    await page.evaluate((source) => window.stzAppLabels.release(source), undoLate); held.delete(undoLate); await transition('stale-undo', wide, 'ready')
    const fontSource = 'mmmm WWWW $unclosed'
    await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill(fontSource); await settle(); await transition('font-before', fontSource, 'fallback')
    const fontBefore = transitions.at(-1), fontModelBefore = await state()
    const settleFont = async () => {
      await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-point-id="app-point"] [data-point-node]'), request = node?.getAttribute('data-point-request')
        return document.fonts.status === 'loaded' && node?.querySelector('[data-label-state]')?.getAttribute('data-label-state') !== 'pending'
          && request && JSON.parse(request)[5] === window.stzAppLabels.state().fontGeneration
      }, undefined, { timeout: 30_000 })
    }
    let fontLoaded, fontRestored, ownedFace
    const fontLifecycle = await withOwnedFontFace(page, { family: 'Times New Roman', source: 'local("Courier New")',
      use: async (handle) => {
        await settleFont(); await transition('font-loaded', fontSource, 'fallback'); fontLoaded = transitions.at(-1)
        ownedFace = await observeOwnedFontFace(handle)
        assert.equal(ownedFace.ownedFacePresent, true)
        assert.notEqual(fontLoaded.literalObservation.lines[0].width, fontBefore.literalObservation.lines[0].width, 'Actual native font width changes')
        assert.equal((await state()).history, fontModelBefore.history)
      },
      restore: async (removal, handle) => {
        await settleFont(); await transition('font-restored', fontSource, 'fallback'); fontRestored = transitions.at(-1)
        const restored = await observeOwnedFontFace(handle)
        assert.equal(restored.ownedFacePresent, false); assert.ok(restored.previousFaces.every(({ present }) => present))
        assert.equal(fontRestored.literalObservation.lines[0].width, fontBefore.literalObservation.lines[0].width)
        assert.deepEqual(fontRestored.rendered.bounds, fontBefore.rendered.bounds)
        assert.equal((await state()).history, fontModelBefore.history)
        return { removal, restored }
      },
      diagnoseFailure: (details) => observe(scenario + '-font-failure', { group, details }) })
    assert.ok(transitions.filter(({ rendered }) => rendered.state === 'ready').every(({ rendered }) => rendered.math > 0))
    await save({ transitions, actualMathJax: true, historyUnchangedOnSettle: true, fontLifecycle, ownedFace, nativeFontChanged: true, nativeFontRestored: true })

    scenario = 'point-layout-native-interaction-2d-3d'
    const interactions = [], bodyOverflowCases = []
    for (const ambientDimension of [2, 3]) for (const shape of ['rectangle', 'circular sector']) {
      const interactionInput = await document(shape, { anchor: shape === 'rectangle' ? 'base east' : 'arc start', outerXSep: 4, outerYSep: 7 }, source, ambientDimension)
      const refPosition = structuredClone(interactionInput.diagram.strata[0].position)
      const components = Object.fromEntries(['x', 'y', 'z'].map((key) => [key, { kind: 'numeric', value: refPosition[key] }]))
      interactionInput.diagram.coordinateAnchors = [{ id: 'layout-reference', name: 'Layout reference', tikzName: 'LayoutReference', position: { kind: 'global', value: components } }]
      interactionInput.diagram.strata[0].position.symbolic = { ...components, source: { kind: 'coordinateRef', coordinateId: 'layout-reference', preview: refPosition } }
      interactionInput.diagram.strata.push({ ...structuredClone(interactionInput.diagram.strata[0]), id: 'overlap-point' })
      delete interactionInput.diagram.strata[1].position.symbolic
      await load(interactionInput); await settle()
      const observed = await select('overlap-point'), before = (await model()).strata.find(({ id }) => id === 'overlap-point')
      // compareSvgPreviewSelectionCandidates breaks this position tie by
      // stableId, putting app-point first. A null cycle state uses
      // initialCycleIndex(count) = 1; the observed continuation reaches
      // app-point. Both actions prepare/measure anew; an initial failure aborts.
      const ownerCycleStart = await cycleOwner('overlap-point', 'overlap-point')
      const ownerCycle = await cycleOwner('overlap-point', 'app-point')
      await select('overlap-point')
      const nativeDrag = await dragSelectedPoint({ page, readState: state,
        diagnose: (details) => diagnostic(group, scenario, details), secondaryErrors: pageErrors,
        scenario, sequence: ++selectionSequence, id: 'overlap-point', displacement: { x: 22, y: -14 }, steps: 4 })
      const after = JSON.parse(nativeDrag.afterAction.state.runtimeDiagramJson).strata.find(({ id }) => id === 'overlap-point')
      const events = nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag')
      assert.notDeepEqual(after.position, before.position)
      const dragged = await observeLayoutPoint(page, 'overlap-point')
      assert.ok(Math.hypot(dragged.placedAnchor.x - dragged.placement.x, dragged.placedAnchor.y - dragged.placement.y) < .001)
      const lockedInput = structuredClone(interactionInput); lockedInput.diagram.layers = [{ value: 0, name: 'Locked', visible: true, locked: true }]
      await load(lockedInput); await settle(); const lockedBefore = await state()
      await page.getByRole('button', { name: 'Select', exact: true }).click(); await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded()
      const locked = await observeLayoutPoint(page)
      await page.mouse.click(locked.boundary.x, locked.boundary.y)
      assert.equal((await state()).json, lockedBefore.json); assert.notEqual((await state()).selection?.id, 'app-point')
      const hidden = structuredClone(lockedInput); hidden.diagram.layers[0] = { value: 0, name: 'Hidden', visible: false }
      await load(hidden); await settle(); assert.equal(await observeLayoutPoint(page), null)
      await load(interactionInput); await settle(); const cameraBefore = await observeLayoutPoint(page)
      const zoom = page.getByRole('spinbutton', { name: 'zoom value', exact: true })
      if (!await zoom.count()) await page.locator('.camera-summary-toggle').click()
      const beforeCameraRequests = (await state()).requests
      if (ambientDimension === 3) {
        const theta = page.getByRole('spinbutton', { name: 'theta value', exact: true })
        await theta.fill('63')
      }
      await zoom.fill('1.4')
      await page.getByRole('spinbutton', { name: 'pan x value', exact: true }).fill('12')
      await page.getByRole('spinbutton', { name: 'pan y value', exact: true }).fill('-9')
      const cameraAfter = await observeLayoutPoint(page)
      assert.ok(Math.hypot(cameraAfter.placedAnchor.x - cameraAfter.placement.x, cameraAfter.placedAnchor.y - cameraAfter.placement.y) < .001)
      assert.notDeepEqual(cameraAfter.placement, cameraBefore.placement)
      assert.equal((await state()).requests, beforeCameraRequests)
      assert.deepEqual((await model()).strata[0].position, interactionInput.diagram.strata[0].position)
      const referenceCode = await page.getByRole('textbox', { name: 'Generated TikZ source', exact: true }).inputValue()
      assert.ok(referenceCode.includes('at (LayoutReference)'))
      interactions.push({ ambientDimension, shape, codim: before.codim, observed, dragged, before, after, events, nativeDrag, ownerCycleStart, ownerCycle,
        trustedBoundaryClick: true, trustedDrag: events.some(({ type, trusted }) => type === 'pointerdown' && trusted) && events.some(({ type, trusted }) => type === 'pointermove' && trusted),
        anchorStayedAtModel: true, undoRestored: true, redoRestored: true, altCycling: true, lockedUnchanged: true, hiddenAbsent: true, cameraPlacement: true,
        referenceUnchanged: JSON.stringify((await model()).strata[0].position) === JSON.stringify(interactionInput.diagram.strata[0].position), referenceCode, cameraBefore, cameraAfter })
      if (shape === 'rectangle') {
        const overflowInput = await document('rectangle', { innerXSep: -15, innerYSep: 0, outerXSep: 0, outerYSep: 0, anchor: 'base east' }, 'WWWWWWWWWWWWWWWWWWWW', ambientDimension)
        overflowInput.diagram.strata.push({ ...structuredClone(overflowInput.diagram.strata[0]), id: 'overflow-overlap' })
        await load(overflowInput); await settle()
        const observeOverflow = async (page, id) => {
          const rendered = await observeLayoutPoint(page, id)
          const ink = await page.evaluate((id) => {
            const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
            const text = node.querySelector('[data-label-state] text'), contour = node.querySelector('[data-point-contour]')
            const character = text.getExtentOfChar(0), localBodyClick = { x: character.x + character.width / 2, y: character.y + character.height * .55 }
            const screen = new DOMPoint(localBodyClick.x, localBodyClick.y).matrixTransform(text.getScreenCTM())
            const local = screen.matrixTransform(contour.getScreenCTM().inverse()), box = contour.getBBox()
            const contourBounds = { x: box.x, y: box.y, width: box.width, height: box.height }
            const distance = Math.max(box.x - local.x, local.x - box.x - box.width, box.y - local.y, local.y - box.y - box.height, 0)
            return { click: { x: screen.x, y: screen.y }, localBodyClick, clickInContour: { x: local.x, y: local.y }, contourBounds,
              characterBounds: { x: character.x, y: character.y, width: character.width, height: character.height }, distance }
          }, id)
          assert.ok(ink.distance > 6, 'Native text click is beyond the contour picking tolerance')
          return { ...rendered, boundary: ink.click, bodyOverflow: ink }
        }
        const overflowObserved = await select('overflow-overlap', observeOverflow)
        overflowObserved.bodyOverflow.selectionRing = await page.evaluate(() => {
          const node = document.querySelector('[data-point-id="overflow-overlap"] [data-point-node]'), text = node.querySelector('[data-label-state] text')
          const ring = node.querySelector(':scope > circle[data-svg-export-exclude]'), box = text.getBBox(), inverse = ring.getScreenCTM().inverse()
          const cx = Number(ring.getAttribute('cx')), cy = Number(ring.getAttribute('cy')), radius = Number(ring.getAttribute('r'))
          const inkRadius = Math.max(...[[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => {
            const local = new DOMPoint(x, y).matrixTransform(text.getScreenCTM()).matrixTransform(inverse)
            return Math.hypot(local.x - cx, local.y - cy)
          }))
          return { radius, inkRadius }
        })
        assert.ok(overflowObserved.bodyOverflow.selectionRing.radius >= overflowObserved.bodyOverflow.selectionRing.inkRadius, 'Selection ring encloses the actual overflowing text ink')
        // The same stableId ordering and initial index 1 apply to the two
        // overlapping body owners; retain both planned native cycle actions.
        const ownerCycleStart = await cycleOwner('overflow-overlap', 'overflow-overlap', observeOverflow)
        const ownerCycle = await cycleOwner('overflow-overlap', 'app-point', observeOverflow)
        assert.deepEqual((await model()).strata[0].position, overflowInput.diagram.strata[0].position)
        const entry = { result: 'passed', ambientDimension, shape: 'rectangle', anchor: 'base east', source: overflowInput.diagram.strata[0].text,
          layout: overflowInput.diagram.strata[0].style.layout, rendered: overflowObserved, modelPositionUnchanged: true,
          altSelection: { id: ownerCycle.stateAfter.selection.id, events: ownerCycle.events }, ownerCycleStart, ownerCycle, diagramUnchanged: true }
        bodyOverflowCases.push(entry); await observe(scenario + `-body-overflow-${ambientDimension}d`, { group, entry })
      }
    }
    await save({ cases: interactions, bodyOverflowCases })

    for (const background of ['transparent', 'white']) {
      scenario = `point-layout-pending-${background}-${background === 'transparent' ? 'edit' : 'load'}`
      const captured = `captured ${background} $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$`, input = await document('circle', {}, captured, 2, true), template = input.diagram.strata[0]
      const siblings = input.diagram.strata.slice(1)
      input.diagram.strata = [...layoutShapes.map((shape, index) => ({ ...structuredClone(template), id: `layout-${shape.replaceAll(' ', '-')}`,
        text: index === 0 ? captured : `${shape} $x_j$`, position: { x: (index % 4) * 4, y: 13 - Math.floor(index / 4) * 4, z: 0 },
        style: { ...structuredClone(template.style), shape, shapeParameters: structuredClone(layoutShapeParameters[shape] ?? {}),
          layout: { innerXSep: 3, innerYSep: 1, outerXSep: 5, outerYSep: 2, minimumWidth: 35, minimumHeight: 25, anchor: shape === 'cylinder' ? 'shape center' : 'base' } } })), ...siblings]
      await page.evaluate((source) => window.stzAppLabels.hold(source), captured); held.add(captured); await load(input)
      await page.waitForFunction((source) => window.stzAppLabels.pending(source)?.started > 0, captured)
      const pending = await observeLayoutPoint(page, 'layout-circle')
      await select('layout-circle'); await page.getByLabel('SVG export background', { exact: true }).selectOption(background)
      const points = input.diagram.strata.filter(({ geometricKind }) => geometricKind === 'point')
      await page.evaluate((ids) => window.stzAppLabels.armPointExportClick(ids), points.map(({ id }) => id))
      let click
      const { event: download } = await event(scenario, 'download', async ({ check }) => {
        await page.getByRole('button', { name: 'Export current diagram view as SVG', exact: true }).click(); check()
        click = await page.evaluate(() => window.stzAppLabels.pointExportClick()); assert.equal(click.error, undefined)
        if (background === 'transparent') {
          await (await resolvePointInspectorField(page, 'Node text', 'textarea')).fill('later $changed$')
          await nativeField('anchor', 'north'); await nativeField('minimumWidth', 110)
          const changedView = await state()
          const zoom = page.getByRole('spinbutton', { name: 'zoom value', exact: true })
          if (!await zoom.count()) await page.locator('.camera-summary-toggle').click()
          await zoom.fill('1.4')
          assert.notEqual((await state()).uiSettings, changedView.uiSettings)
          await observe(scenario + '-post-click-view', { group, before: changedView, after: await state() })
        } else await load(await document('rectangle', { anchor: 'west', minimumWidth: 110 }, 'replacement $loaded$'))
        check(); await page.evaluate((source) => window.stzAppLabels.release(source), captured); held.delete(captured)
      })
      const svgPath = resolve(artifactDir, `${scenario}.svg`); await download.saveAs(svgPath)
      const xml = await readFile(svgPath, 'utf8'); assert.ok(xml.includes(captured)); assert.ok(!xml.includes('later $changed$') && !xml.includes('replacement $loaded$'))
      await load(input); await settle()
      const expected = []
      for (const point of points) expected.push(await observeEntry(input, { id: point.id }, point.id))
      const outputs = await tikzArtifacts()
      for (const code of Object.values(outputs)) { assert.ok(code.includes('anchor=base')); assert.ok(code.includes('anchor=shape center')) }
      assertPointTikzSourceByMode(outputs, captured)
      const standalone = await context.newPage(), requests = []; standalone.on('request', (request) => requests.push(request.url()))
      let reopenPrimary
      try {
        await standalone.goto(pathToFileURL(svgPath).href)
        const reopened = await standalone.evaluate((expected) => {
          const clean = (element) => ({ tag: element.localName, attributes: Object.fromEntries([...element.attributes].filter(({ name }) => !name.startsWith('data-') && name !== 'pointer-events').map(({ name, value }) => [name, value])) })
          return expected.map((entry) => {
            const title = [...document.querySelectorAll('title')].find((element) => element.textContent === entry.source), body = title?.parentElement, node = body?.parentElement
            const contour = node && [...node.children].find((element) => ['path', 'polygon', 'circle', 'ellipse', 'rect'].includes(element.localName) && element.hasAttribute('stroke') && element.getAttribute('stroke') !== 'none')
            return { source: title?.textContent, shape: entry.shape, contour: contour && clean(contour), nodeTransform: node?.getAttribute('transform'), bodyTransform: body?.getAttribute('transform'),
              glyphs: body?.querySelectorAll('path,use').length, errors: document.querySelectorAll('parsererror,foreignObject,image,script').length }
          })
        }, expected)
        for (const [index, actual] of reopened.entries()) {
          assert.equal(actual.source, expected[index].source); assert.equal(actual.errors, 0); assert.ok(actual.glyphs > 0)
          assert.deepEqual(actual.contour, expected[index].rendered.contour); assert.equal(actual.nodeTransform, expected[index].rendered.nodeTransform)
          assert.equal(actual.bodyTransform, expected[index].rendered.bodyTransform)
        }
        assert.notDeepEqual(pending.contour, expected[0].rendered.contour, 'The accepted settled export cannot retain a pending-sized contour')
        assert.ok(input.diagram.labels.every(({ text }) => xml.includes(text.replaceAll('&', '&amp;').replaceAll('<', '&lt;'))))
        const inline = siblings[0].inlineNodes
        assert.ok(inline.every(({ text }) => xml.includes(text.replaceAll('&', '&amp;').replaceAll('<', '&lt;'))))
        assert.ok(requests.length > 0 && requests.every((url) => url.startsWith('file:')))
        // Retain identity/bounds/source observations before the bounded image.
        await writeFile(resolve(artifactDir, `${scenario}-standalone.json`), JSON.stringify({ reopened, requests, pageErrors, expected, click, pending }, null, 2) + '\n')
        await standalone.screenshot({ path: resolve(artifactDir, `${scenario}.png`), fullPage: true, timeout: 5000 })
        await save({ background, actualDownload: true, capturedPending: click.snapshot.points[0].status === 'pending', reopened: true, immutableSource: true, immutableLayout: true,
          immutablePlacement: true, settledContour: true, combinedLabels: true, noExternalAssets: true, expected, click, pending })
      } catch (error) { reopenPrimary = error }
      finally { try { await standalone.close() } catch (error) { reopenPrimary ??= error; pageErrors.push(`Standalone layout cleanup: ${error.message}`) } }
      if (reopenPrimary) throw reopenPrimary
    }
    assert.deepEqual(pageErrors, []); await completeGroup(group)
  } catch (error) {
    primary = error
    await retainFailure('point-layout-failure.json', { scenario, group, result: 'failed', pageErrors, error: { message: error.message, stack: error.stack } })
    try { await app.failure(error, { scenario, pageErrors }) } catch (diagnosticError) {
      await retainFailure('point-layout-secondary-failure.json', { primary: error.message, diagnostic: diagnosticError.message })
    }
    throw error
  } finally {
    for (const wait of waits) wait.dispose()
    for (const source of held) { try { await page.evaluate((source) => window.stzAppLabels.release(source), source) } catch (error) { if (!primary) primary = error; pageErrors.push(`Held layout conversion cleanup: ${error.message}`) } }
    try { await context.close() } catch (error) { primary ??= error; await retainFailure('point-layout-cleanup-failure.json', { primary: primary.message, cleanup: error.message }) }
    await Promise.allSettled(waits.map((wait) => wait.drain()))
  }
  if (primary) throw primary
}
