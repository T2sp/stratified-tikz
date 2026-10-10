import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

export const HIDDEN_POINT_VALUES = Object.freeze(['dimHidden', 'hideHidden'])
const scope = '.source-panel', caption = 'Hidden points:', selector = 'select.toolbar-select'
const provenance = 'native-select-input-change-observer'

function locators(page) {
  const panels = page.locator(scope)
  // The associated wrapping label also contains option text. Match its direct
  // caption, then validate the production label and its own native select.
  const captions = panels.locator('span').filter({ hasText: /^Hidden points:$/ })
  const wrappers = captions.locator('..')
  return { panels, captions, wrappers, controls: wrappers.locator(selector) }
}

export function observeSourceVisibilityContext() {
  const workPlaneControls = [...document.querySelectorAll('input,select,button')].filter((element) =>
    !element.closest('#preview-inspector-drawer,.preview-floating-toolbar,.context-quick-style-bar')
    && (element.closest('#preview-work-plane-panel,.work-plane-control')
      || /work.?plane/i.test([element.getAttribute('aria-label'), element.id, element.className].join(' ')))).slice(0, 48)
    .map((element) => ({ tag: element.localName, id: element.id, ariaLabel: element.getAttribute('aria-label'),
      value: element.value ?? null, pressed: element.getAttribute('aria-pressed'), checked: element.checked ?? null }))
  return { workPlaneControls,
    workPlaneStatus: [...document.querySelectorAll('.work-plane-status,.preview-work-plane-status,.work-plane-summary')]
      .map((element) => element.textContent) }
}

/** Read-only DOM evidence, including unsuccessful/ambiguous lookups. */
export async function inspectSourceHiddenPoints(page) {
  const { panels, captions, wrappers, controls } = locators(page)
  const describe = (elements) => elements.map((element) => {
    const rect = (node) => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    }
    const bounds = rect(element)
    const scrollAncestors = []
    let visible = bounds.width > 0 && bounds.height > 0
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const computed = getComputedStyle(ancestor)
      if (computed.display === 'none' || ['hidden', 'collapse'].includes(computed.visibility)) visible = false
      if (ancestor === element) continue
      const clipsX = /^(auto|scroll|hidden|clip)$/.test(computed.overflowX)
      const clipsY = /^(auto|scroll|hidden|clip)$/.test(computed.overflowY)
      const ancestorBounds = rect(ancestor)
      scrollAncestors.push({ tag: ancestor.tagName.toLowerCase(), class: ancestor.getAttribute('class'),
        bounds: ancestorBounds, scrollTop: ancestor.scrollTop, scrollLeft: ancestor.scrollLeft,
        clientWidth: ancestor.clientWidth, clientHeight: ancestor.clientHeight,
        scrollWidth: ancestor.scrollWidth, scrollHeight: ancestor.scrollHeight, clipsX, clipsY,
        scrollport: { x: ancestorBounds.x + ancestor.clientLeft, y: ancestorBounds.y + ancestor.clientTop,
          width: ancestor.clientWidth, height: ancestor.clientHeight } })
    }
    const inScrollport = scrollAncestors.every((ancestor) => {
      const port = ancestor.scrollport
      return (!ancestor.clipsX || bounds.x >= port.x - 1 && bounds.x + bounds.width <= port.x + port.width + 1)
        && (!ancestor.clipsY || bounds.y >= port.y - 1 && bounds.y + bounds.height <= port.y + port.height + 1)
    }) && bounds.x >= -1 && bounds.y >= -1
      && bounds.x + bounds.width <= window.innerWidth + 1 && bounds.y + bounds.height <= window.innerHeight + 1
    const owner = element.parentElement
    const directCaptions = (node) => [...node.children].filter((child) => child.tagName === 'SPAN' && child.textContent.trim() === 'Hidden points:')
    const directControls = (node) => [...node.children].filter((child) => child.matches('select.toolbar-select'))
    const productionOwner = owner?.matches('label.tikz-export-mode-control') === true
      && owner.closest('.source-panel') !== null && directCaptions(owner).length === 1 && directControls(owner).length === 1
    return {
      tag: element.tagName.toLowerCase(), text: element.textContent, outerHTML: element.outerHTML,
      class: element.getAttribute('class'), connected: element.isConnected, visible, bounds, scrollAncestors, inScrollport,
      disabledProperty: 'disabled' in element ? element.disabled : null,
      matchesDisabled: element.matches(':disabled'), ariaDisabled: element.getAttribute('aria-disabled'),
      enabledPredicate: !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true',
      ariaLabel: element.getAttribute('aria-label'), ariaLabelledby: element.getAttribute('aria-labelledby'),
      matchesProductionLabel: element.matches('label.tikz-export-mode-control'),
      directCaptionCount: directCaptions(element).length, directControlCount: directControls(element).length,
      labelControlMatches: element.tagName === 'LABEL' && directControls(element).length === 1
        && element.control === directControls(element)[0],
      directOwningProductionLabel: productionOwner,
      associatedOwningLabel: element.tagName === 'SELECT' && productionOwner
        && owner.control === element && Array.from(element.labels ?? []).includes(owner),
      value: 'value' in element ? element.value : null,
      labels: Array.from(element.labels ?? [], (label) => ({ text: label.textContent, outerHTML: label.outerHTML })),
      options: element.tagName === 'SELECT' ? Array.from(element.options, (option) => ({ value: option.value,
        text: option.textContent, selected: option.selected,
        disabled: option.disabled || option.parentElement?.matches('optgroup:disabled') === true })) : null,
    }
  })
  return {
    ...await page.evaluate(observeSourceVisibilityContext),
    scope, caption, selector, sourcePanelCount: await panels.count(), captionCount: await captions.count(),
    wrapperCount: await wrappers.count(), correctedControlCount: await controls.count(),
    exactLabelCount: await panels.getByLabel(caption, { exact: true }).count(),
    panels: await panels.evaluateAll(describe), captions: await captions.evaluateAll(describe),
    wrappers: await wrappers.evaluateAll(describe), controls: await controls.evaluateAll(describe),
  }
}

function assertControl(control, value, prepared = false) {
  assert.ok(control, 'Raw Hidden points control observation retained')
  assert.equal(control.scope, scope); assert.equal(control.caption, caption); assert.equal(control.selector, selector)
  for (const [count, list] of [['sourcePanelCount', 'panels'], ['captionCount', 'captions'],
    ['wrapperCount', 'wrappers'], ['correctedControlCount', 'controls']]) {
    assert.equal(control[count], 1, `One source-panel Hidden points ${list}`)
    assert.equal(control[list]?.length, control[count], `Raw ${list} matches lookup count`)
    assert.equal(control[list][0].connected, true, `Connected Hidden points ${list}`)
    assert.equal(control[list][0].visible, true, `Visible Hidden points ${list}`)
  }
  const text = control.captions[0], wrapper = control.wrappers[0], native = control.controls[0]
  assert.equal(text.tag, 'span'); assert.equal(text.text.trim(), caption, 'Exact caption text')
  assert.equal(wrapper.tag, 'label'); assert.equal(wrapper.matchesProductionLabel, true, 'Direct production label owns caption')
  assert.equal(wrapper.directCaptionCount, 1); assert.equal(wrapper.directControlCount, 1)
  assert.equal(wrapper.labelControlMatches, true, 'Wrapping label.control is the unique native select')
  assert.equal(native.tag, 'select'); assert.equal(native.directOwningProductionLabel, true)
  assert.equal(native.associatedOwningLabel, true, 'Native select is associated with its direct production label')
  assert.equal(native.labels?.length, 1, 'One actual native associated label')
  assert.equal(native.labels[0].outerHTML, wrapper.outerHTML, 'Associated label is the resolved production wrapper')
  assert.equal(native.labels[0].text, wrapper.text, 'Associated label text is retained verbatim')
  assert.ok(wrapper.text.includes(caption), 'Production label contains its exact caption')
  assert.equal(native.disabledProperty, false); assert.equal(native.matchesDisabled, false)
  assert.notEqual(native.ariaDisabled, 'true'); assert.equal(native.enabledPredicate, true, 'Enabled native Hidden points select')
  assert.deepEqual(native.options?.map((option) => option.value), HIDDEN_POINT_VALUES, 'Exact available Hidden points option values')
  for (const option of native.options) {
    assert.equal(typeof option.disabled, 'boolean'); assert.equal(typeof option.selected, 'boolean')
    assert.equal(typeof option.text, 'string')
  }
  const requested = native.options.filter((option) => option.value === value)
  assert.equal(requested.length, 1, `Available requested Hidden points option ${value}`)
  assert.equal(requested[0].disabled, false, `Enabled requested Hidden points option ${value}`)
  assert.deepEqual(native.options.filter((option) => option.selected).map((option) => option.value), [native.value], 'Actual selected option matches DOM value')
  assert.ok(HIDDEN_POINT_VALUES.includes(native.value), 'Actual current Hidden points value is supported')
  assert.ok(Number.isInteger(control.exactLabelCount) && control.exactLabelCount >= 0, 'Old exact-label count retained')
  if (!native.ariaLabel && !native.ariaLabelledby && wrapper.text.trim() !== caption) {
    assert.equal(control.exactLabelCount, 0, 'Option descendants contaminate the complete associated label')
  }
  assert.ok(native.bounds && Object.values(native.bounds).every(Number.isFinite), 'Actual control bounds retained')
  assert.ok(native.bounds.width > 0 && native.bounds.height > 0)
  assert.ok(Array.isArray(native.scrollAncestors) && native.scrollAncestors.length > 0, 'Native scroll ancestors retained')
  assert.ok(Array.isArray(control.workPlaneControls) && Array.isArray(control.workPlaneStatus), 'Actual active work-plane controls/status retained')
  if (prepared) assert.equal(native.inScrollport, true, 'Hidden points select is inside its scrollports after native preparation')
}

function parsed(state) {
  assert.ok(state && ['json', 'runtimeDiagramJson', 'history', 'uiSettings'].every((field) => typeof state[field] === 'string'),
    'Raw saved/runtime/history/UI settings retained')
  assert.ok(Number.isInteger(state.labelDocumentRevision) && state.labelDocumentRevision >= 0, 'Valid same-document epoch retained')
  assert.ok(Object.hasOwn(state, 'selection'), 'Actual selection retained')
  const saved = JSON.parse(state.json), runtime = JSON.parse(state.runtimeDiagramJson), history = JSON.parse(state.history), settings = JSON.parse(state.uiSettings)
  assert.equal(saved.version, 2)
  // Saved JSON has its own normalization contract; retain and compare the raw
  // saved and runtime forms independently rather than conflating their cameras.
  assert.equal(saved.diagram?.ambientDimension, 3, 'Saved document is also 3D')
  assert.deepEqual(history.present, runtime, 'History present agrees with runtime model')
  assert.equal(runtime.ambientDimension, 3, 'Hidden points policy requires the actual 3D document')
  assert.equal(settings.visibility?.enabled, true, 'Approximate visibility is authoritatively enabled')
  return { saved, runtime, history, settings }
}

function assertBoundary(boundary, id, value, prepared) {
  const model = parsed(boundary.state)
  assertControl(boundary.control, value, prepared)
  assert.equal(boundary.control.controls[0].value, model.settings.visibility.pointVisibility, 'Control value matches authoritative visibility settings')
  const point = model.runtime.strata.find((point) => point.id === id)
  assert.ok(point?.geometricKind === 'point', 'Observed policy owner is the current geometric point')
  if (boundary.rendered !== null) {
    assert.ok(boundary.rendered, 'Raw rendering observation retained')
    assert.equal(boundary.rendered.source, point.text ?? '', 'Rendered source agrees with exact model source')
    assert.equal(boundary.rendered.shape, point.style.shape, 'Rendered shape agrees with exact model shape')
  }
  return model
}

function assertPreserved(before, after, policyAllowed) {
  for (const field of ['json', 'runtimeDiagramJson', 'history', 'selection', 'labelDocumentRevision']) {
    assert.deepEqual(after[field], before[field], `Policy action preserves ${field}`)
  }
  const expected = JSON.parse(before.uiSettings), actual = JSON.parse(after.uiSettings)
  if (policyAllowed) expected.visibility.pointVisibility = actual.visibility.pointVisibility
  assert.deepEqual(actual, expected, 'Policy action preserves every other UI setting including camera and active work plane')
}

function assertIdentity(record) {
  assert.equal(record?.scenario, 'point-geometric-visibility')
  assert.ok(Number.isInteger(record.sequence) && record.sequence > 0, 'Visibility action has an owned sequence')
  assert.ok(typeof record.id === 'string' && record.id.length > 0)
  assert.ok(HIDDEN_POINT_VALUES.includes(record.value), 'Supported requested Hidden points value')
}

export function assertHiddenPointVisibilityAction(record) {
  assertIdentity(record)
  assert.equal(record.actionError, undefined, 'Native policy action has no retained failure')
  assertBoundary(record.before, record.id, record.value, false)
  assertBoundary(record.prepared, record.id, record.value, true)
  assertBoundary(record.afterAction, record.id, record.value, true)
  assertPreserved(record.before.state, record.prepared.state, false)
  assertPreserved(record.before.state, record.afterAction.state, true)
  for (const field of ['workPlaneControls', 'workPlaneStatus']) {
    assert.deepEqual(record.prepared.control[field], record.before.control[field], `Native scrolling preserves ${field}`)
    assert.deepEqual(record.afterAction.control[field], record.before.control[field], `Policy action preserves ${field}`)
  }
  assert.deepEqual(record.afterAction.selection, [record.value], 'Actual bounded selectOption returned the requested selection')
  assert.equal(record.afterAction.control.controls[0].value, record.value, 'Actual final DOM value matches requested policy')
  assert.equal(JSON.parse(record.afterAction.state.uiSettings).visibility.pointVisibility, record.value, 'Actual final authoritative policy matches requested value')
  const priorValue = record.before.control.controls[0].value, finalValue = record.afterAction.control.controls[0].value
  assert.deepEqual(record.afterAction.transition, { priorValue, finalValue, effective: priorValue !== finalValue },
    'Transition classification derives only from actual before/final control values')
  const observer = record.observer, observed = record.afterAction.events
  assert.equal(observer?.provenance, provenance); assert.equal(observed?.provenance, provenance)
  assert.equal(observer.token, `hidden-points:${record.scenario}:${record.sequence}:${record.id}`)
  assert.equal(observed.token, observer.token); assert.equal(observed.connected, true)
  assert.deepEqual(observed.errors, []); assert.equal(observed.droppedEvents, 0)
  const target = (entry) => {
    assert.equal(entry?.tag, 'select'); assert.equal(entry.inSourcePanel, true)
    assert.ok(entry.class?.split(/\s+/).includes('toolbar-select'), 'Observed native select has the production class')
    assert.equal(entry.exactCaption, caption); assert.equal(entry.owningLabel, true)
    assert.equal(entry.sameOwnedControl, true, 'Input/change belongs to the uniquely owned real select')
  }
  target(observed.control)
  assert.deepEqual(observed.events?.map((event) => event.type), ['input', 'change'], 'Actual select input/change observations retained')
  for (const event of observed.events) {
    target(event.target); assert.equal(event.connected, true); assert.equal(typeof event.trusted, 'boolean')
    assert.ok(Number.isFinite(event.at)); assert.equal(event.value, record.value)
    assert.equal(event.labelDocumentRevision, record.before.state.labelDocumentRevision, 'Observed event belongs to the current document')
    const expected = JSON.parse(record.before.state.uiSettings).visibility
    const actual = event.visibility
    assert.ok(actual && HIDDEN_POINT_VALUES.includes(actual.pointVisibility), 'Actual event visibility settings retained')
    assert.ok(actual.pointVisibility === expected.pointVisibility || actual.pointVisibility === record.value)
    assert.deepEqual({ ...actual, pointVisibility: expected.pointVisibility }, expected, 'Event settings preserve unrelated visibility settings')
  }
  // Same-value selections are valid observations, with no invented transition.
}

/** Observer functions only read native events/state. They never dispatch input. */
export function installHiddenPointObserver(element, token) {
  const registry = window.__stzHiddenPointObservers ??= new Map()
  if (registry.has(token)) throw new Error(`Hidden points observer already owned: ${token}`)
  const owned = { element, events: [], droppedEvents: 0, errors: [] }
  const describe = (target) => ({ tag: target?.tagName?.toLowerCase() ?? null,
    class: target?.getAttribute?.('class') ?? null, inSourcePanel: !!target?.closest?.('.source-panel'),
    exactCaption: target?.parentElement?.querySelector(':scope > span')?.textContent?.trim() ?? null,
    owningLabel: target?.parentElement?.matches('label.tikz-export-mode-control') === true
      && target.parentElement.control === target,
    sameOwnedControl: target === element })
  owned.describe = describe
  owned.listener = (event) => {
    if (owned.events.length >= 16) { owned.droppedEvents++; return }
    let state, visibility
    try { state = window.stzAppLabels.state(); visibility = JSON.parse(state.uiSettings).visibility }
    catch (error) { owned.errors.push({ name: 'event authoritative visibility', message: error.message }) }
    owned.events.push({ type: event.type, trusted: event.isTrusted, at: performance.now(), value: element.value,
      connected: element.isConnected, target: describe(event.target), visibility,
      labelDocumentRevision: state?.labelDocumentRevision ?? null })
  }
  registry.set(token, owned)
  element.addEventListener('input', owned.listener)
  element.addEventListener('change', owned.listener)
}

export function readHiddenPointObserver(token) {
  const owned = window.__stzHiddenPointObservers?.get(token)
  if (!owned) throw new Error(`Missing owned Hidden points observer: ${token}`)
  return { token, provenance: 'native-select-input-change-observer', events: [...owned.events],
    droppedEvents: owned.droppedEvents, errors: [...owned.errors], connected: owned.element.isConnected,
    control: owned.describe(owned.element) }
}

export function removeHiddenPointObserver(token) {
  const registry = window.__stzHiddenPointObservers, owned = registry?.get(token)
  if (owned) {
    owned.element.removeEventListener('input', owned.listener)
    owned.element.removeEventListener('change', owned.listener)
  }
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzHiddenPointObservers
}

/** A one-caller source-panel action; each lookup is scoped and re-resolved. */
export async function selectHiddenPointVisibility({ page, readState, observePoint, diagnose,
  secondaryErrors, scenario, sequence, value, id = 'app-point' }) {
  const token = `hidden-points:${scenario}:${sequence}:${id}`
  const record = { scenario, sequence, id, value, observer: { token, provenance } }
  let primary, installed = false
  const capture = async () => ({ state: await readState(), control: await inspectSourceHiddenPoints(page),
    rendered: await observePoint(page, id) })
  const evidence = async (boundary, check) => {
    try { await boundedPointDiagnostic(() => diagnose({ boundary, record }), `Hidden points ${boundary} evidence`) }
    catch (error) { check(); throw error }
    check()
  }
  try {
    record.before = await boundedPointDiagnostic(capture, 'Hidden points precondition observation')
    await evidence('hidden-points-before', () => { assertIdentity(record); assertBoundary(record.before, id, value, false) })
    await locators(page).controls.scrollIntoViewIfNeeded({ timeout: 5000 })
    record.prepared = await boundedPointDiagnostic(capture, 'Hidden points prepared observation')
    await evidence('hidden-points-prepared', () => {
      assertBoundary(record.prepared, id, value, true)
      assertPreserved(record.before.state, record.prepared.state, false)
    })
    const control = locators(page).controls
    installed = true
    await boundedPointDiagnostic(() => control.evaluate(installHiddenPointObserver, token), 'Hidden points observer installation')
    let selection
    try { selection = await control.selectOption(value, { timeout: 5000 }) } catch (error) { primary = error }
    try {
      record.afterAction = { ...await boundedPointDiagnostic(capture, 'Hidden points after-action observation'),
        selection: selection ?? null,
        events: await boundedPointDiagnostic(() => page.evaluate(readHiddenPointObserver, token), 'Hidden points native event observation') }
      const priorValue = record.before.control.controls[0].value, finalValue = record.afterAction.control.controls[0]?.value ?? null
      record.afterAction.transition = { priorValue, finalValue, effective: priorValue !== finalValue }
      if (primary) record.actionError = { message: primary.message, stack: primary.stack }
      await evidence('hidden-points-after-action', () => { if (primary) throw primary; assertHiddenPointVisibilityAction(record) })
    } catch (error) { if (primary && error !== primary) secondaryErrors.push(`Hidden points after-action evidence: ${error.message}`); throw primary ?? error }
  } catch (error) {
    primary ??= error
    try { await boundedPointDiagnostic(() => diagnose({ boundary: 'hidden-points-failure', record,
      error: { message: primary.message, stack: primary.stack } }), 'Hidden points failure evidence') }
    catch (error) { secondaryErrors.push(`Hidden points failure evidence: ${error.message}`) }
  }
  if (installed) {
    try { await boundedPointDiagnostic(() => page.evaluate(removeHiddenPointObserver, token), 'Hidden points observer cleanup') }
    catch (error) {
      if (!primary) primary = error
      else secondaryErrors.push(`Hidden points observer cleanup: ${error.message}`)
    }
  }
  if (primary) throw primary
  return record
}
