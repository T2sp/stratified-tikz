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
    svg: element instanceof SVGElement, canvas: !!element.closest('svg.svg-diagram'),
    canvasRoot: element.matches('svg.svg-diagram'),
    pointHandle: element.matches('circle.svg-geometry-handle') && !!element.closest('[aria-label="Selected point drag handles"]'),
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
      pointerId: event.pointerId ?? null,
      canvasHasPointerCapture: typeof event.pointerId === 'number'
        && (document.querySelector('svg.svg-diagram')?.hasPointerCapture(event.pointerId) ?? false),
      App: { selection: state?.selection ?? null, labelDocumentRevision: state?.labelDocumentRevision ?? null,
        selectPressed: select?.getAttribute('aria-pressed') ?? null },
      layout: { owner: node?.getAttribute('data-point-node') ?? null, request: node?.getAttribute('data-point-request') ?? null,
        shape: node?.getAttribute('data-point-shape') ?? null, source: body?.getAttribute('data-label-source') ?? null },
      path: event.composedPath().slice(0, 16).map(describe) })
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
    drawer: !!element.closest('#preview-inspector-drawer'), ariaLabel: element.getAttribute('aria-label'),
    svg: element instanceof SVGElement, canvas: !!element.closest('svg.svg-diagram'),
    canvasRoot: element.matches('svg.svg-diagram'),
    pointHandle: element.matches('circle.svg-geometry-handle') && !!element.closest('[aria-label="Selected point drag handles"]') } : null
  const outer = document.querySelector(`[data-point-id="${CSS.escape(id)}"]`)
  const node = outer?.querySelector('[data-point-node]'), contour = node?.querySelector('[data-point-contour]')
  const body = node?.querySelector('[data-label-state]'), canvas = document.querySelector('svg.svg-diagram')
  const drawer = document.getElementById('preview-inspector-drawer')
  const select = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === 'Select')
  const state = safe('App state', () => window.stzAppLabels.state())
  const model = state && safe('model JSON', () => JSON.parse(state.runtimeDiagramJson))
  const owned = window.__stzGeometricSelectionObservers?.get(token)
  if (token && !owned) errors.push({ name: 'observer ownership', message: 'Selection observer is missing' })
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
    elementFromPoint: click ? describe(document.elementFromPoint(click.x, click.y)) : null,
    elementsFromPoint: click ? document.elementsFromPoint(click.x, click.y).slice(0, 16).map(describe) : [],
    events: owned ? [...owned.events] : [], droppedEvents: owned?.droppedEvents ?? null, errors: [...errors, ...(owned?.errors ?? [])] }
}

export function removeGeometricSelectionObserver(token) {
  const registry = window.__stzGeometricSelectionObservers, owned = registry?.get(token)
  if (owned) for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, owned.listener, true)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzGeometricSelectionObservers
}

// A selected point's production drag handle is outside its data-point-id group.
// Only that exact SVG handle path may substitute for the owned point path, and
// only when the intended point was already selected before this native click.
function intendedSelectionTarget(target, selection, id, requireUnselected) {
  return target?.svg === true && target.canvas === true && target.drawer === false
    && (target.pointId === id || (!requireUnselected && selection?.id === id && target.pointHandle === true))
}

function intendedSelectionPath(event, selection, id, requireUnselected) {
  return intendedSelectionTarget(event.target, selection, id, requireUnselected)
    && event.path.some((element) => element?.canvasRoot === true)
    && (event.target.pointId === id ? event.path.some((element) => element?.pointId === id)
      : event.path.some((element) => element?.ariaLabel === 'Selected point drag handles'))
}

/** Close an inherited Inspector through its real control before measuring.
 * Preserve primary native/assertion errors through bounded diagnostics/cleanup. */
export async function selectGeometricPoint({ page, readState, observePoint, diagnose, secondaryErrors,
  scenario, sequence, id = 'app-point', boundary = false, requireUnselected = false }) {
  const token = `${scenario}:${sequence}:${id}`
  const observation = { scenario, sequence, id, clickKind: boundary ? 'boundary' : 'center', requireUnselected,
    preparation: { closeActions: 0 }, secondaryErrors: [] }
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
    const preparation = observation.preparation
    preparation.stateBefore = await diagnostic('state before preparation', readState)
    preparation.inherited = await diagnostic('inherited drawer', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
    const drawer = page.locator('#preview-inspector-drawer')
    let preparationPrimary
    try {
      preparation.drawerCount = await drawer.count()
      assert.ok(preparation.drawerCount === 0 || preparation.drawerCount === 1, 'Inspector drawer is unique')
      if (preparation.drawerCount === 1) {
        const close = page.getByRole('button', { name: 'Close inspector drawer', exact: true })
        assert.equal(await close.count(), 1, 'Open Inspector has one native close control')
        preparation.closeActions++
        await close.click({ timeout: 5000 })
        await drawer.waitFor({ state: 'detached', timeout: 5000 })
      }
      preparation.closedDrawerCount = await drawer.count()
      const open = page.getByRole('button', { name: 'Open inspector drawer', exact: true })
      preparation.openerCount = await open.count()
      preparation.openerExpanded = await open.getAttribute('aria-expanded', { timeout: 5000 })
    } catch (error) {
      preparationPrimary = error
      preparation.error = { message: error.message, stack: error.stack }
    }
    preparation.closed = await diagnostic('closed drawer', () => page.evaluate(observeGeometricSelection, { id, click: null, token: null }))
    preparation.stateAfter = await diagnostic('state after preparation', readState)
    await diagnostic('preparation evidence', () => diagnose({ boundary: 'selection-prepared', observation }))
    if (preparationPrimary) throw preparationPrimary
    assert.equal(preparation.closedDrawerCount, 0, 'Inspector drawer is detached before selection')
    assert.equal(preparation.openerCount, 1, 'Closed Inspector has one native open control')
    assert.equal(preparation.openerExpanded, 'false', 'Inspector is closed before selection')
    // Drawer state is UI state; exact saved/runtime data and history include
    // coordinates, raw source and all explicit style/provenance fields.
    if (preparation.stateBefore && preparation.stateAfter) {
      for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) {
        assert.deepEqual(preparation.stateAfter[field], preparation.stateBefore[field], `Inspector preparation preserves ${field}`)
      }
    }
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
    for (const snapshot of [preparation.inherited, preparation.closed, observation.before, observation.after]) {
      assert.deepEqual(snapshot?.errors, [], 'Selection snapshot completed without observation errors')
    }
    if (requireUnselected) assert.equal(observation.before.selection, null, 'Initial circle setup is unselected before the native click')
    assert.equal(observation.before.inspector.open, false, 'Inspector stays closed at click time')
    assert.ok(intendedSelectionTarget(observation.before.elementFromPoint, observation.before.selection, id, requireUnselected),
      'Current native click target is the intended SVG point or its selected drag handle')
    assert.equal(observation.after.droppedEvents, 0, 'All owned native selection events were retained')
    const events = observation.after.events
    const downIndex = events.findIndex((event) => event.type === 'pointerdown' && event.trusted === true
      && intendedSelectionPath(event, observation.before.selection, id, requireUnselected))
    assert.ok(downIndex >= 0, 'Observed trusted selection pointerdown delivered to the intended SVG production path')
    const down = events[downIndex]
    let previousIndex = downIndex, capturedUp = false
    for (const type of ['pointerup', 'click']) {
      const index = events.findIndex((event, index) => index > previousIndex && event.type === type && event.trusted === true
        && (intendedSelectionPath(event, observation.before.selection, id, requireUnselected)
          || (down.target.pointHandle === true && Number.isInteger(down.pointerId)
            && (event.pointerId === down.pointerId || (type === 'click' && event.pointerId === null
              && Math.abs(event.client?.x - down.client?.x) <= 1 && Math.abs(event.client?.y - down.client?.y) <= 1))
            && event.target?.canvasRoot === true && event.target.drawer === false
            && event.path.some((element) => element?.canvasRoot === true)
            && (type === 'pointerup' ? event.canvasHasPointerCapture === true : capturedUp))))
      assert.ok(index >= 0, `Observed trusted selection ${type} delivered to the intended SVG production path`)
      capturedUp = events[index].canvasHasPointerCapture === true
      previousIndex = index
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
