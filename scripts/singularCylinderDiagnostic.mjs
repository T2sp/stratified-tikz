import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { installUnsupportedDiagnosticObserver, unsupportedDiagnosticEvents, removeUnsupportedDiagnosticObserver } from './pointUnsupportedDiagnostic.mjs'
import { assertSingularCylinderNative, assertSingularCylinderObservation } from './singularCylinderDiagnosticContract.mjs'

// Browser-only read observations. The exported file has no owner/shape data;
// reopening retains document paths, and identity is authenticated separately.
export function observeSingularCylinderPoint(id) {
  const root = document.querySelector('svg.svg-diagram'), node = root?.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
  if (!node) throw new Error('Current singular cylinder owner missing')
  const body = node.querySelector('[data-label-state]'), warning = node.querySelector('[data-point-shape-warning]')
  const bodyTitle = body?.querySelector(':scope > title'), ink = body?.querySelector(':scope > g'), content = ink?.querySelector(':scope > g')
  const clean = (element) => element ? { tag: element.localName, attributes: Object.fromEntries([...element.attributes]
    .filter(({ name }) => !name.startsWith('data-') && !name.startsWith('aria-') && name !== 'pointer-events').map(({ name, value }) => [name, value])) } : null
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const bounds = (name) => {
    const [minX, minY, maxX, maxY] = node.getAttribute(name).split(/\s+/u).map(Number)
    return { minX, minY, maxX, maxY }
  }
  const ring = node.querySelector(':scope > circle[data-svg-export-exclude]')
  return { id, source: bodyTitle?.textContent ?? null, bodySource: body?.getAttribute('data-label-source') ?? null,
    shape: node.getAttribute('data-point-shape'), state: body?.getAttribute('data-label-state'),
    owner: node.getAttribute('data-point-node'), request: node.getAttribute('data-point-request'), bodyRequest: body?.getAttribute('data-label-request'),
    limitation: node.getAttribute('data-point-shape-limitation'), resolvedLayout: JSON.parse(node.getAttribute('data-point-layout')),
    warning: clean(warning), warningTitle: warning?.querySelector(':scope > title')?.textContent ?? null,
    contourCount: node.querySelectorAll('[data-point-contour]').length, warningCount: node.querySelectorAll('[data-point-shape-warning]').length,
    internalBorderCount: node.querySelectorAll('[data-point-internal-border]').length, paintRegionCount: node.querySelectorAll('[data-point-paint-region]').length,
    bodyTargetCount: node.querySelectorAll('[data-point-body-target]').length, glyphCount: body?.querySelectorAll('path,text,use').length ?? null,
    bodyTitle: bodyTitle?.textContent ?? null, bodyTitleCount: body?.querySelectorAll(':scope > title').length ?? null,
    bodyChildTags: body ? [...body.children].map(({ localName }) => localName) : [], inkChildTags: ink ? [...ink.children].map(({ localName }) => localName) : [],
    contentChildTags: content ? [...content.children].map(({ localName }) => localName) : [],
    nodeTransform: node.getAttribute('transform'), bodyTransform: body?.getAttribute('transform'), paintedBounds: bounds('data-point-painted-bounds'),
    ring: ring ? { r: Number(ring.getAttribute('r')), cx: Number(ring.getAttribute('cx')), cy: Number(ring.getAttribute('cy')) } : null,
    matrices: { nodeCTM: matrix(node.getCTM()), nodeScreenCTM: matrix(node.getScreenCTM()),
      bodyCTM: matrix(body?.getCTM()), bodyScreenCTM: matrix(body?.getScreenCTM()) } }
}
export function observeSingularCylinderPreExport() {
  const roots = [...document.querySelectorAll('svg.svg-diagram')], root = roots[0], state = window.stzAppLabels.state()
  return { url: location.href, rootCount: roots.length, rootConnected: root?.isConnected === true,
    labelDocumentRevision: state.labelDocumentRevision, runtime: window.stzAppLabels.pointRuntime() }
}
export function observeSingularCylinderReopening() {
  const root = document.documentElement
  const path = (element) => {
    const result = []
    for (let current = element; current && current !== root; current = current.parentElement) {
      if (!current.parentElement) return null
      result.unshift([...current.parentElement.children].indexOf(current))
    }
    return element && root.contains(element) ? result : null
  }
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const clean = (element) => element && ({ tag: element.localName, attributes: Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value])) })
  // A body has an immediate title and ink g. Warning titles stay with paths.
  const bodies = [...root.querySelectorAll('g')].filter((element) => element.children.length === 2
    && element.children[0].localName === 'title' && element.children[1].localName === 'g')
  const reopened = bodies.map((body, domOrdinal) => {
    const node = body.parentElement, warning = node.children[0], title = body.children[0], ink = body.children[1], content = ink.children[0]
    return { domOrdinal, source: title.textContent, warning: clean(warning), warningTitle: warning.querySelector(':scope > title')?.textContent ?? null,
      nodeTransform: node.getAttribute('transform'), bodyTransform: body.getAttribute('transform'),
      paths: { node: path(node), warning: path(warning), warningTitle: path(warning.children[0]), body: path(body), bodyTitle: path(title), ink: path(ink), content: path(content) },
      matrices: { nodeCTM: matrix(node.getCTM()), nodeScreenCTM: matrix(node.getScreenCTM()), bodyCTM: matrix(body.getCTM()), bodyScreenCTM: matrix(body.getScreenCTM()),
        warningCTM: matrix(warning.getCTM()), warningScreenCTM: matrix(warning.getScreenCTM()) } }
  })
  const bounds = root.getBoundingClientRect()
  return { reopened, document: { root: { localName: root.localName, namespace: root.namespaceURI, width: root.getAttribute('width'),
    height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox') }, rootAttributes: Object.fromEntries([...root.attributes].map(({ name, value }) => [name, value])),
    forbiddenCount: root.querySelectorAll('parsererror,foreignObject,image,script,[data-svg-export-exclude]').length,
    externalReferences: [...root.querySelectorAll('[href]')].map((element) => element.getAttribute('href')).filter((href) => !href.startsWith('#') || !document.getElementById(href.slice(1))),
    backgroundCount: root.querySelectorAll('[data-stratified-tikz-export-background]').length,
    inventory: { titleCount: root.querySelectorAll('title').length, pathCount: root.querySelectorAll('path').length, groupCount: root.querySelectorAll('g').length,
      rootChildTags: [...root.children].map(({ localName }) => localName) },
    frame: { url: location.href, contentType: document.contentType, readyState: document.readyState,
      rootCTM: matrix(root.getCTM()), rootScreenCTM: matrix(root.getScreenCTM()), rootBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      scroll: { x: scrollX, y: scrollY }, viewport: { width: innerWidth, height: innerHeight } } } }
}
export function observeSingularCylinderUi() {
  const overlays = [...document.querySelectorAll('.preview-toolbar-overlay-stack')]
  if (overlays.length !== 1) throw new Error('One current preview toolbar overlay required')
  return { inspectorOpen: !!document.getElementById('preview-inspector-drawer'), toolbarCollapsed: overlays[0].classList.contains('is-collapsed') }
}
export function observeSingularCylinderHit({ token, id, local }) {
  const owned = window.__stzUnsupportedDiagnostics?.get(token), node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
  if (!owned || !node) throw new Error('Current diagnostic hit observer missing')
  const point = new DOMPoint(local.x, local.y).matrixTransform(node.getScreenCTM())
  return { screen: { x: point.x, y: point.y }, hit: { target: owned.describe(document.elementFromPoint(point.x, point.y)),
    stack: document.elementsFromPoint(point.x, point.y).slice(0, 16).map(owned.describe) } }
}
export async function runSingularCylinderNative({ page, readState, diagnose, id, token, secondaryErrors }) {
  const entry = { result: 'observed', token, before: await readState(), preparation: { actions: [] }, restoration: { actions: [] }, clicks: [], secondaryErrors: [], cleanup: {} }
  entry.ambientDimension = JSON.parse(entry.before.runtimeDiagramJson).ambientDimension
  const bounded = (name, operation) => boundedPointDiagnostic(operation, `Singular cylinder ${name}`, 5000)
  const retain = (stage) => bounded('evidence', () => diagnose({ stage, entry }))
  let primary, installed = false
  const uiAction = async (name, phase) => {
    const action = { name, before: await readState() }; entry[phase].actions.push(action)
    const control = page.getByRole('button', { name, exact: true }); action.controlCount = await control.count(); assert.equal(action.controlCount, 1)
    await control.click({ timeout: 5000 })
    if (name === 'Close inspector drawer') await page.locator('#preview-inspector-drawer').waitFor({ state: 'detached', timeout: 5000 })
    if (name === 'Open inspector drawer') await page.locator('#preview-inspector-drawer').waitFor({ state: 'visible', timeout: 5000 })
    if (name === 'Collapse preview toolbar') await page.locator('section.preview-floating-toolbar').waitFor({ state: 'detached', timeout: 5000 })
    if (name === 'Expand preview toolbar') await page.locator('section.preview-floating-toolbar').waitFor({ state: 'visible', timeout: 5000 })
    action.after = await readState(); await retain(`${phase}-${name}`)
  }
  try {
    await page.evaluate(installUnsupportedDiagnosticObserver, { token, id }); installed = true
    entry.preparation.before = await readState(); entry.preparation.uiBefore = await page.evaluate(observeSingularCylinderUi)
    if (entry.preparation.uiBefore.inspectorOpen) await uiAction('Close inspector drawer', 'preparation')
    if (entry.preparation.uiBefore.toolbarCollapsed) await uiAction('Expand preview toolbar', 'preparation')
    const select = page.getByRole('button', { name: 'Select', exact: true })
    assert.equal(await select.count(), 1)
    if (await select.getAttribute('aria-pressed') !== 'true') await uiAction('Select', 'preparation')
    entry.preparation.selectPressed = await select.getAttribute('aria-pressed')
    const scroll = { name: 'canvas-scroll', controlCount: await page.locator('svg.svg-diagram').count(), before: await readState() }
    entry.preparation.actions.push(scroll); assert.equal(scroll.controlCount, 1)
    await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded({ timeout: 5000 })
    scroll.after = await readState(); await retain('canvas-scrolled')
    if (!(await page.evaluate(observeSingularCylinderUi)).toolbarCollapsed) await uiAction('Collapse preview toolbar', 'preparation')
    entry.preparation.after = await readState(); await retain('prepared')
    for (const kind of ['far', 'warning', 'far']) {
      const local = kind === 'warning' ? { x: -7, y: 1 } : { x: 100, y: 0 }, action = { kind, local, before: await readState() }
      entry.clicks.push(action)
      action.observation = await page.evaluate(observeSingularCylinderPoint, id)
      Object.assign(action, await page.evaluate(observeSingularCylinderHit, { token, id, local }))
      await retain(`before-${kind}`)
      assertSingularCylinderObservation(action.observation, action.before)
      assert.ok(action.hit.target?.canvas && !action.hit.target.overlay)
      action.inputObservation = await page.evaluate(observeSingularCylinderPoint, id)
      action.inputState = await readState()
      action.inputHit = await page.evaluate(observeSingularCylinderHit, { token, id, local })
      await retain(`${kind}-input-before-assertion`)
      assert.deepEqual(action.inputObservation, action.observation); assert.deepEqual(action.inputState, action.before)
      assert.deepEqual(action.inputHit, { screen: action.screen, hit: action.hit })
      await page.evaluate(unsupportedDiagnosticEvents, { token, active: true })
      await page.mouse.click(action.screen.x, action.screen.y)
      action.events = await page.evaluate(unsupportedDiagnosticEvents, { token, active: false })
      action.after = await readState(); action.afterObservation = await page.evaluate(observeSingularCylinderPoint, id)
      await retain(`after-${kind}`)
    }
  } catch (error) { primary = error }
  finally {
    try {
      entry.restoration.before = await readState()
      const current = await page.evaluate(observeSingularCylinderUi), original = entry.preparation.uiBefore
      if (original && current.toolbarCollapsed !== original.toolbarCollapsed) await uiAction(original.toolbarCollapsed ? 'Collapse preview toolbar' : 'Expand preview toolbar', 'restoration')
      if (original && current.inspectorOpen !== original.inspectorOpen) await uiAction(original.inspectorOpen ? 'Open inspector drawer' : 'Close inspector drawer', 'restoration')
      entry.restoration.after = await readState(); entry.restoration.uiAfter = await page.evaluate(observeSingularCylinderUi)
      entry.after = entry.restoration.after
    } catch (error) { primary ??= error; entry.secondaryErrors.push({ operation: 'UI restoration', message: error.message }); secondaryErrors.push(error.message) }
    if (installed) try {
      entry.cleanup.observerPresentBefore = await page.evaluate((token) => window.__stzUnsupportedDiagnostics?.has(token) === true, token)
      await page.evaluate(removeUnsupportedDiagnosticObserver, token)
      entry.cleanup.observerAbsentAfter = await page.evaluate((token) => window.__stzUnsupportedDiagnostics?.has(token) !== true, token)
    }
    catch (error) { primary ??= error; entry.secondaryErrors.push({ operation: 'observer cleanup', message: error.message }); secondaryErrors.push(error.message) }
    if (primary) entry.error = { message: primary.message, stack: primary.stack }
    try { await retain('finished') }
    catch (error) {
      if (primary) { entry.secondaryErrors.push({ operation: 'finished evidence', message: error.message }); secondaryErrors.push(error.message) }
      else primary = error
    }
  }
  if (primary) throw primary
  entry.result = 'passed'; assertSingularCylinderNative(entry); await retain('accepted'); return entry
}
