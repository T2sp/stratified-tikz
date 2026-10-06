import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

// These three functions run in the actual App document. They only observe;
// native mouse input and production selection remain owned by the caller.
export function installGeometricSelectionObserver({ token, id }) {
  const registry = window.__stzGeometricSelectionObservers ??= new Map()
  if (registry.has(token)) throw new Error(`Selection observer already owned: ${token}`)
  const describe = (element) => element instanceof Element ? {
    tag: element.localName, id: element.id, class: element.getAttribute('class'),
    pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    drawer: !!element.closest('#preview-inspector-drawer'),
    ariaLabel: element.getAttribute('aria-label'),
  } : null
  const owned = { events: [], droppedEvents: 0, errors: [] }
  owned.listener = (event) => {
    if (owned.events.length === 16) { owned.droppedEvents++; return }
    let state
    try { state = window.stzAppLabels.state() }
    catch (error) { owned.errors.push({ name: 'event App state', message: error.message }) }
    const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
    const body = node?.querySelector('[data-label-state]')
    const select = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Select')
    owned.events.push({ type: event.type, trusted: event.isTrusted, at: performance.now(),
      client: { x: event.clientX, y: event.clientY }, page: { x: event.pageX, y: event.pageY },
      screen: { x: event.screenX, y: event.screenY }, button: event.button,
      pointerType: event.pointerType ?? null, target: describe(event.target),
      App: { selection: state?.selection ?? null, labelDocumentRevision: state?.labelDocumentRevision ?? null,
        selectPressed: select?.getAttribute('aria-pressed') ?? null },
      layout: { owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
        shape: node?.getAttribute('data-point-shape') ?? null, source: body?.getAttribute('data-label-source') ?? null },
      path: event.composedPath().slice(0, 8).map(describe) })
  }
  registry.set(token, owned)
  for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, owned.listener, true)
}

export function observeGeometricSelection({ id, click, token }) {
  const errors = []
  const safe = (name, operation) => {
    try { return operation() } catch (error) { errors.push({ name, message: error.message }); return null }
  }
  const rect = (element) => {
    if (!element) return null
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }
  const matrix = (element, method) => {
    const value = element?.[method]?.()
    return value ? Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]])) : null
  }
  const describe = (element) => element ? { tag: element.localName, id: element.id,
    class: element.getAttribute('class'), pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
    drawer: !!element.closest('#preview-inspector-drawer'), ariaLabel: element.getAttribute('aria-label') } : null
  const outer = document.querySelector(`[data-point-id="${CSS.escape(id)}"]`)
  const node = outer?.querySelector('[data-point-node]'), contour = node?.querySelector('[data-point-contour]')
  const body = node?.querySelector('[data-label-state]'), canvas = document.querySelector('svg.svg-diagram')
  const drawer = document.getElementById('preview-inspector-drawer')
  const select = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Select')
  const state = safe('App state', () => window.stzAppLabels.state())
  const model = state && safe('model JSON', () => JSON.parse(state.runtimeDiagramJson))
  const owned = window.__stzGeometricSelectionObservers?.get(token)
  if (!owned) errors.push({ name: 'observer ownership', message: 'Selection observer is missing' })
  for (const [name, element] of [['canvas', canvas], ['point', node], ['contour', contour], ['body', body]]) {
    if (!element?.isConnected) errors.push({ name, message: 'Required connected selection element is missing' })
    else if (!element.getScreenCTM()) errors.push({ name, message: 'Required selection screen CTM is unavailable' })
  }
  const scrollAncestors = []
  for (let element = canvas; element && scrollAncestors.length < 8; element = element.parentElement) {
    scrollAncestors.push({ element: describe(element), bounds: rect(element), scrollTop: element.scrollTop, scrollLeft: element.scrollLeft })
  }
  return { at: performance.now(), requestedClick: click, readyState: document.readyState,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio,
      scrollX, scrollY, visual: visualViewport ? { width: visualViewport.width, height: visualViewport.height,
        offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null },
    model: model?.strata.find((point) => point.id === id) ?? null, camera: model?.camera ?? null,
    labelDocumentRevision: state?.labelDocumentRevision ?? null, selection: state?.selection ?? null,
    tool: { selectPressed: select?.getAttribute('aria-pressed') ?? null,
      selectedButtons: [...document.querySelectorAll('button[aria-pressed="true"]')].slice(0, 16).map(describe) },
    layout: { shape: node?.getAttribute('data-point-shape') ?? null,
      parameters: node?.getAttribute('data-point-shape-parameters') ?? null,
      owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
      bodyRequest: body?.getAttribute('data-label-request') ?? null,
      source: body?.getAttribute('data-label-source') ?? null, state: body?.getAttribute('data-label-state') ?? null },
    geometry: Object.fromEntries([['canvas', canvas], ['point', node], ['contour', contour], ['body', body]].map(([name, element]) => [name, {
      bounds: safe(`${name} bounds`, () => rect(element)),
      screenCTM: safe(`${name} screenCTM`, () => matrix(element, 'getScreenCTM')),
      CTM: safe(`${name} CTM`, () => matrix(element, 'getCTM')),
    }])), scrollAncestors,
    inspector: { open: !!drawer, bounds: rect(drawer), noSelection: drawer?.textContent.includes('No selection') ?? false,
      expansionControls: drawer ? [...drawer.querySelectorAll('button')].filter((element) => ['Expand', 'Collapse'].includes(element.textContent.trim()))
        .map((element) => ({ text: element.textContent.trim(), expanded: element.getAttribute('aria-expanded') })) : [],
      style: drawer ? { display: getComputedStyle(drawer).display, visibility: getComputedStyle(drawer).visibility,
        pointerEvents: getComputedStyle(drawer).pointerEvents, zIndex: getComputedStyle(drawer).zIndex } : null },
    selectionHandles: [...document.querySelectorAll('[aria-label="Selected point drag handles"]')].map((element) => ({ element: describe(element), bounds: rect(element) })),
    elementFromPoint: describe(document.elementFromPoint(click.x, click.y)),
    elementsFromPoint: document.elementsFromPoint(click.x, click.y).slice(0, 16).map(describe),
    events: owned ? [...owned.events] : [], droppedEvents: owned?.droppedEvents ?? null, errors: [...errors, ...(owned?.errors ?? [])] }
}

export function removeGeometricSelectionObserver(token) {
  const registry = window.__stzGeometricSelectionObservers, owned = registry?.get(token)
  if (owned) for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, owned.listener, true)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzGeometricSelectionObservers
}

/** Measure after the real toolbar action and canvas scrolling. Preserve the
 * original selection assertion even when observation/evidence/cleanup fails.
 * This deliberately does not repair an unconfirmed overlay or timing cause. */
export async function selectGeometricPoint({ page, readState, observePoint, diagnose, secondaryErrors,
  scenario, sequence, id = 'app-point', boundary = false }) {
  const token = `${scenario}:${sequence}:${id}`
  const observation = { scenario, sequence, id, clickKind: boundary ? 'boundary' : 'center', secondaryErrors: [] }
  const failures = []
  let primary, rendered
  const diagnostic = async (name, operation) => {
    try { return await boundedPointDiagnostic(operation, `Geometric selection ${name}`) }
    catch (error) {
      failures.push(error)
      observation.secondaryErrors.push({ name, message: error.message })
      secondaryErrors.push(`Geometric selection ${name}: ${error.message}`)
    }
  }
  try {
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.locator('svg.svg-diagram').scrollIntoViewIfNeeded()
    rendered = await observePoint(page, id)
    assert.ok(rendered)
    observation.rendered = rendered
    const click = boundary ? rendered.boundary : rendered.center
    observation.requestedClick = click
    await diagnostic('observer install', () => page.evaluate(installGeometricSelectionObserver, { token, id }))
    observation.before = await diagnostic('before click', () => page.evaluate(observeGeometricSelection, { id, click, token }))
    await diagnostic('before evidence', () => diagnose({ boundary: 'before-native-click', observation }))
    try { await page.mouse.click(click.x, click.y) } catch (error) { primary = error }
    try { observation.selected = (await readState()).selection } catch (error) { primary ??= error }
    observation.after = await diagnostic('after click', () => page.evaluate(observeGeometricSelection, { id, click, token }))
    await diagnostic('after evidence', () => diagnose({ boundary: 'after-native-click-before-assertion', observation }))
    if (primary) throw primary
    assert.equal(observation.selected?.id, id, 'Native contour click selects its point')
    if (failures.length) throw new AggregateError(failures, 'Geometric selection diagnostics failed')
    for (const snapshot of [observation.before, observation.after]) {
      assert.deepEqual(snapshot?.errors, [], 'Selection snapshot completed without observation errors')
    }
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      assert.ok(observation.after.events.some((event) => event.type === type && event.trusted === true), `Observed trusted selection ${type}`)
    }
  } catch (error) { primary ??= error }
  finally {
    await diagnostic('observer cleanup', () => page.evaluate(removeGeometricSelectionObserver, token))
    await diagnostic('final evidence', () => diagnose({ boundary: 'selection-finished', observation,
      ...(primary ? { primary: { message: primary.message, stack: primary.stack } } : {}) }))
  }
  if (primary) throw primary
  if (failures.length) throw new AggregateError(failures, 'Geometric selection diagnostics failed')
  return rendered
}
