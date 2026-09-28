import assert from 'node:assert/strict'
import { boundedPointDiagnostic, cleanupPointCheck } from './pointCheckDiagnostics.mjs'

export const POINT_PAINT_SELECT_OPTIONS = Object.freeze({
  'Border line style': Object.freeze(['solid', 'dashed', 'dotted', 'denselyDotted']),
  'Border cap': Object.freeze(['butt', 'round', 'rect']),
  'Border join': Object.freeze(['miter', 'round', 'bevel']),
})

// Playwright follows label.control for isEnabled(): a disabled select may be
// rejected at its wrapping label before the resolver reaches the select.
export const DISABLED_BORDER_LINE_STYLE_REJECTION = Object.freeze({
  name: 'AssertionError', code: 'ERR_ASSERTION', actual: false, expected: true, operator: 'strictEqual',
  message: /^Enabled (?:Inspector field wrapper: Border line style|native select for Inspector field: Border line style)\n/,
})

const inspectorSelector = '#preview-inspector-drawer'
const nativeSelectors = new Set(['select', 'textarea', 'input[type="text"]', 'input[type="color"]', 'input[type="checkbox"]'])

function fieldLocators(page, caption, selector) {
  assert.equal(typeof caption, 'string', 'Inspector caption is text')
  assert.ok(caption.length > 0, 'Inspector caption is not empty')
  assert.ok(nativeSelectors.has(selector), `Explicit supported native Inspector control: ${selector}`)
  const inspector = page.locator(inspectorSelector)
  // Match only the caption, never the surrounding label's options or warnings.
  const exactCaption = new RegExp(`^${caption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  const captions = inspector.locator('.inspector-field-label').filter({ hasText: exactCaption })
  // Production InspectorField captions are direct children of their field.
  // Validate that contract instead of choosing an arbitrary matching ancestor.
  const wrappers = captions.locator('..')
  return { inspector, captions, wrappers, controls: wrappers.locator(selector) }
}

async function assertUsable(locator, name) {
  assert.equal(await locator.count(), 1, `One ${name}`)
  assert.equal(await locator.isVisible(), true, `Visible ${name}`)
  assert.equal(await locator.isEnabled(), true, `Enabled ${name}`)
  assert.notEqual(await locator.getAttribute('aria-disabled'), 'true', `Enabled ${name}`)
}

/** Re-resolve on every action, including after React adds a numeric warning. */
export async function resolvePointInspectorField(page, caption, selector) {
  const { inspector, captions, wrappers, controls } = fieldLocators(page, caption, selector)
  await assertUsable(inspector, 'active Inspector')
  assert.equal(await captions.count(), 1, `One exact Inspector caption: ${caption}`)
  assert.equal(await captions.isVisible(), true, `Visible Inspector caption: ${caption}`)
  await assertUsable(wrappers, `Inspector field wrapper: ${caption}`)
  assert.equal(await wrappers.evaluate((element) => element.matches('.inspector-field')), true,
    `Caption belongs directly to an Inspector field: ${caption}`)
  await assertUsable(controls, `native ${selector} for Inspector field: ${caption}`)
  return controls
}

export async function selectPointInspectorField(page, caption, value, { options } = {}) {
  const control = await resolvePointInspectorField(page, caption, 'select')
  const available = await control.locator('option').evaluateAll((elements) => elements.map((option) => ({
    value: option.value, disabled: option.disabled || option.parentElement?.matches('optgroup:disabled') === true,
  })))
  const values = available.map((option) => option.value)
  assert.ok(Array.isArray(options) && options.length > 0, `Expected native options supplied: ${caption}`)
  assert.deepEqual(values, options, `Native option values: ${caption}`)
  assert.equal(new Set(values).size, values.length, `Unique native option values: ${caption}`)
  const requested = available.filter((option) => option.value === value)
  assert.equal(requested.length, 1, `Available native option ${value}: ${caption}`)
  assert.equal(requested[0].disabled, false, `Enabled native option ${value}: ${caption}`)
  const selection = await control.selectOption(value, { timeout: 5000 })
  assert.deepEqual(selection, [value], `Native selectOption result: ${caption}`)
  const actual = await control.inputValue()
  assert.equal(actual, value, `Selected native value: ${caption}`)
  return { options: values, selection, value: actual }
}

/** Non-asserting read-only evidence; missing/ambiguous controls remain visible. */
export async function inspectPointInspectorField(page, caption, selector) {
  const { inspector, captions, wrappers, controls } = fieldLocators(page, caption, selector)
  const describe = (elements, selector) => elements.map((element) => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
    const localDomState = {
      disabledProperty: 'disabled' in element ? element.disabled : null,
      matchesDisabled: element.matches(':disabled'), ariaDisabled: element.getAttribute('aria-disabled'),
      enabledPredicate: !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true',
    }
    const labelControl = element.tagName === 'LABEL' ? element.control : null
    return {
      tag: element.tagName.toLowerCase(), outerHTML: element.outerHTML, text: element.textContent,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && rect.width > 0 && rect.height > 0,
      // Preserve the historical local-only measurement for existing consumers.
      enabled: localDomState.enabledPredicate, localDomState,
      labelControl: labelControl ? {
        tag: labelControl.tagName.toLowerCase(), id: labelControl.id,
        disabledProperty: labelControl.disabled, matchesDisabled: labelControl.matches(':disabled'),
        ariaDisabled: labelControl.getAttribute('aria-disabled'),
        sameAsResolvedControl: element.querySelectorAll(selector).length === 1
          && element.querySelector(selector) === labelControl,
      } : null,
      ariaLabel: element.getAttribute('aria-label'), ariaLabelledby: element.getAttribute('aria-labelledby'),
      ariaExpanded: element.getAttribute('aria-expanded'), ariaHidden: element.getAttribute('aria-hidden'),
      ariaInvalid: element.getAttribute('aria-invalid'), ariaDescribedby: element.getAttribute('aria-describedby'),
      value: 'value' in element ? element.value : null,
      labels: Array.from(element.labels ?? [], (label) => ({ text: label.textContent, outerHTML: label.outerHTML })),
      descriptions: (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).map((id) => ({
        id, text: element.ownerDocument.getElementById(id)?.textContent ?? null,
      })),
      options: element.tagName === 'SELECT' ? Array.from(element.options, (option) => ({
        value: option.value, text: option.textContent, selected: option.selected, disabled: option.disabled,
      })) : null,
    }
  })
  const exactLabelCount = await inspector.getByLabel(caption, { exact: true }).count()
  const correctedControlCount = await controls.count()
  const queriedState = async (locator) => {
    const count = await locator.count()
    if (count !== 1) return { count, enabled: null }
    try {
      return { count, enabled: await boundedPointDiagnostic(() => locator.isEnabled(), 'Inspector enabled-state observation') }
    } catch (error) {
      return { count, enabled: null, error: { message: error.message, stack: error.stack } }
    }
  }
  return {
    caption, selector, inspectorCount: await inspector.count(), captionCount: await captions.count(),
    wrapperCount: await wrappers.count(), correctedControlCount, exactLabelCount,
    labelSemantics: exactLabelCount === 0 && correctedControlCount === 1
      ? 'exact-associated-label-mismatch-reproduced' : 'current-exact-associated-label-count-recorded',
    playwrightState: { wrapper: await queriedState(wrappers), control: await queriedState(controls) },
    enabledObservation: 'enabled is the local DOM predicate; playwrightState records Locator.isEnabled()',
    inspectors: await inspector.evaluateAll(describe, selector), captions: await captions.evaluateAll(describe, selector),
    wrappers: await wrappers.evaluateAll(describe, selector), controls: await controls.evaluateAll(describe, selector),
    drawerControls: await page.locator('[aria-controls="preview-inspector-drawer"], #preview-inspector-drawer button[aria-expanded], #preview-inspector-drawer button[aria-label="Expand"], #preview-inspector-drawer button[aria-label="Collapse"]').evaluateAll(describe, selector),
  }
}

function assertCurrentWrappedLabelMismatch(observation) {
  const control = observation.controls[0], wrapper = observation.wrappers[0]
  // Assert the mismatch only while the inspected production DOM still has the
  // reported naming contract. A future explicit ARIA name is reported as a
  // changed contract, rather than being mistaken for a resolver regression.
  const wrappedLabel = control?.labels?.find((label) => label.outerHTML === wrapper?.outerHTML)
  if (wrapper?.tag === 'label' && wrappedLabel && !control.ariaLabel && !control.ariaLabelledby
    && wrappedLabel.text.trim() !== observation.caption) {
    assert.equal(observation.exactLabelCount, 0, 'Current associated label includes option or warning descendants')
    assert.equal(observation.labelSemantics, 'exact-associated-label-mismatch-reproduced')
  }
}

/** Clone actual production markup, never handwritten substitutes. This only
 * tests browser lookup/actions; the real App scenario proves handler/history. */
export async function checkPointInspectorFieldBoundary({ browser, page: appPage, diagnose, numericSnapshots }) {
  const html = await appPage.locator(inspectorSelector).evaluate((element) => element.outerHTML)
  const page = await browser.newPage()
  const checks = [], observations = []
  let primary, currentCaption = 'Border line style', currentSelector = 'select'
  try {
    const reset = async (markup = html) => {
      await page.setContent(markup, { timeout: 5000 })
      const original = await resolvePointInspectorField(page, 'Border line style', 'select')
      // The outside decoy is itself cloned from a production field.
      await original.evaluate((element) => {
        const outside = document.createElement('section')
        outside.id = 'outside-inspector-control'
        outside.append(element.closest('.inspector-field').cloneNode(true))
        document.body.append(outside)
      })
    }
    await reset()
    const outsideInitial = await page.locator('#outside-inspector-control select').inputValue()
    const cases = [['Border line style', 'solid', 'dashed'], ['Border cap', 'butt', 'round'], ['Border join', 'miter', 'bevel']]
    for (const [caption, initial, desired] of cases) {
      currentCaption = caption
      const options = POINT_PAINT_SELECT_OPTIONS[caption]
      await selectPointInspectorField(page, caption, initial, { options })
      await selectPointInspectorField(page, `Preset ${caption}`, initial, { options })
      const before = await inspectPointInspectorField(page, caption, 'select')
      await diagnose({ boundary: 'wrapped-inspector-select-before', source: 'production-App-Inspector-clone', ...before })
      assert.equal(before.captionCount, 1); assert.equal(before.wrapperCount, 1); assert.equal(before.correctedControlCount, 1)
      assertCurrentWrappedLabelMismatch(before)
      assert.notEqual(initial, desired, 'A skipped selection cannot satisfy the desired value')
      await selectPointInspectorField(page, caption, desired, { options })
      assert.equal(await (await resolvePointInspectorField(page, `Preset ${caption}`, 'select')).inputValue(), initial,
        'Live field leaves saved-preset field unchanged')
      // Replace the production wrapper to prove the next lookup re-resolves.
      await (await resolvePointInspectorField(page, caption, 'select')).evaluate((element) => {
        const wrapper = element.closest('.inspector-field')
        wrapper.replaceWith(wrapper.cloneNode(true))
      })
      await selectPointInspectorField(page, caption, initial, { options })
      await selectPointInspectorField(page, caption, desired, { options })
      await selectPointInspectorField(page, `Preset ${caption}`, desired, { options })
      await selectPointInspectorField(page, `Preset ${caption}`, initial, { options })
      assert.equal(await (await resolvePointInspectorField(page, caption, 'select')).inputValue(), desired,
        'Saved-preset field leaves live field unchanged')
      const after = await inspectPointInspectorField(page, caption, 'select')
      const preset = await inspectPointInspectorField(page, `Preset ${caption}`, 'select')
      observations.push({ caption, initial, desired, before, after, preset })
      checks.push(`${caption}:native-selection-and-reresolution`, `Preset ${caption}:independent-selection`)
    }
    assert.equal(await page.locator('#outside-inspector-control select').inputValue(), outsideInitial,
      'Unrelated control outside Inspector remains unchanged')
    checks.push('outside-Inspector-control-unchanged')

    currentCaption = 'Border width'; currentSelector = 'input[type="text"]'
    assert.ok(numericSnapshots?.before && numericSnapshots.invalid && numericSnapshots.recovered,
      'Actual production numeric markup is captured before warning, during warning, and after recovery')
    for (const [stage, value, invalid] of [['before', '2', 'false'], ['invalid', 'NaN', 'true'], ['recovered', '2', 'false']]) {
      await reset(numericSnapshots[stage])
      const observation = await inspectPointInspectorField(page, currentCaption, currentSelector)
      await diagnose({ boundary: `wrapped-inspector-width-${stage}`, source: 'production-App-Inspector-clone', ...observation })
      const control = await resolvePointInspectorField(page, currentCaption, currentSelector)
      assert.equal(await control.inputValue(), value)
      assert.equal(await control.getAttribute('aria-invalid'), invalid)
      if (stage === 'invalid') {
        assertCurrentWrappedLabelMismatch(observation)
        const describedby = await control.getAttribute('aria-describedby')
        assert.ok(describedby, 'Invalid draft preserves aria-describedby')
        assert.deepEqual(observation.controls[0].descriptions.map((description) => description.text),
          ['Border width must be a finite number greater than 0.'])
      } else assert.equal(await control.getAttribute('aria-describedby'), null)
      observations.push({ numericStage: stage, observation })
      checks.push(`numeric-width-${stage}`)
    }

    currentCaption = 'Border line style'; currentSelector = 'select'
    const options = POINT_PAINT_SELECT_OPTIONS[currentCaption]
    const reject = async (name, mutate, pattern, {
      verifyBefore = () => {},
      action = () => selectPointInspectorField(page, currentCaption, 'dashed', { options }),
    } = {}) => {
      await reset()
      await selectPointInspectorField(page, currentCaption, 'solid', { options })
      await fieldLocators(page, currentCaption, currentSelector).controls.evaluate((control) => {
        const events = []
        // Retain the exact original element, including in absent/duplicate cases.
        window.stzInspectorRejection = { control, events }
        for (const type of ['input', 'change']) control.addEventListener(type, () => events.push({ type, value: control.value }))
      })
      await mutate(fieldLocators(page, currentCaption, currentSelector))
      const before = await inspectPointInspectorField(page, currentCaption, currentSelector)
      const mutationState = () => page.evaluate(() => {
        const { control, events } = window.stzInspectorRejection
        return { value: control.value, events: [...events] }
      })
      const beforeMutation = await mutationState()
      const expectedRejection = pattern instanceof RegExp ? pattern.toString() : { ...pattern, message: pattern.message.toString() }
      await diagnose({ boundary: `wrapped-inspector-rejection-${name}`, negativeCase: name, expectedRejection,
        beforeMutation, ...before })
      await verifyBefore(before, beforeMutation)
      let actualRejection = null, rejectionFailure
      try {
        await assert.rejects(async () => {
          try { await action() } catch (error) {
            actualRejection = { name: error.name, code: error.code, message: error.message, stack: error.stack,
              actual: error.actual, expected: error.expected, operator: error.operator }
            throw error
          }
        }, pattern)
      } catch (error) { rejectionFailure = error }
      let afterMutation
      try {
        afterMutation = await boundedPointDiagnostic(mutationState, 'Inspector rejection mutation capture')
        const result = { negativeCase: name, expectedRejection, actualRejection, beforeMutation, afterMutation,
          valueUnchanged: afterMutation.value === beforeMutation.value,
          eventsUnchanged: JSON.stringify(afterMutation.events) === JSON.stringify(beforeMutation.events) }
        await boundedPointDiagnostic(() => diagnose({ boundary: `wrapped-inspector-rejection-result-${name}`, ...result }),
          'Inspector rejection evidence')
        observations.push(result)
      } catch (error) { throw rejectionFailure ?? error }
      if (rejectionFailure) throw rejectionFailure
      assert.equal(afterMutation.value, beforeMutation.value, `${name}: rejection leaves native value unchanged`)
      assert.deepEqual(beforeMutation.events, [], `${name}: no events before rejection`)
      assert.deepEqual(afterMutation.events, [], `${name}: rejection dispatches no input/change events`)
      checks.push(name)
    }
    await reject('absent-inspector', ({ inspector }) => inspector.evaluate((element) => element.remove()), /One active Inspector/)
    await reject('duplicate-inspector', ({ inspector }) => inspector.evaluate((element) => element.after(element.cloneNode(true))), /One active Inspector/)
    await reject('hidden-inspector', ({ inspector }) => inspector.evaluate((element) => { element.hidden = true }), /Visible active Inspector/)
    await reject('disabled-inspector', ({ inspector }) => inspector.evaluate((element) => element.setAttribute('aria-disabled', 'true')), /Enabled active Inspector/)
    await reject('absent-caption', ({ captions }) => captions.evaluate((element) => element.remove()), /One exact Inspector caption/)
    await reject('duplicate-caption', ({ captions }) => captions.evaluate((element) => element.after(element.cloneNode(true))), /One exact Inspector caption/)
    await reject('hidden-caption', ({ captions }) => captions.evaluate((element) => { element.hidden = true }), /Visible Inspector caption/)
    await reject('absent-wrapper', ({ wrappers }) => wrappers.evaluate((element) => element.remove()), /One exact Inspector caption/)
    await reject('duplicate-wrapper', ({ wrappers }) => wrappers.evaluate((element) => element.after(element.cloneNode(true))), /One exact Inspector caption/)
    await reject('hidden-wrapper', ({ wrappers }) => wrappers.evaluate((element) => { element.hidden = true }), /Visible Inspector caption|Visible Inspector field wrapper/)
    await reject('disabled-wrapper', ({ wrappers }) => wrappers.evaluate((element) => element.setAttribute('aria-disabled', 'true')), /Enabled Inspector field wrapper/)
    await reject('wrong-wrapper', ({ wrappers }) => wrappers.evaluate((element) => element.classList.remove('inspector-field')), /Caption belongs directly/)
    await reject('absent-control', ({ controls }) => controls.evaluate((element) => element.remove()), /One native select/)
    await reject('duplicate-control', ({ controls }) => controls.evaluate((element) => element.after(element.cloneNode(true))), /One native select/)
    await reject('hidden-control', ({ controls }) => controls.evaluate((element) => { element.hidden = true }), /Visible native select/)
    await reject('disabled-control', ({ controls }) => controls.evaluate((element) => { element.disabled = true }),
      DISABLED_BORDER_LINE_STYLE_REJECTION, { verifyBefore: async (before, mutation) => {
        for (const count of ['inspectorCount', 'captionCount', 'wrapperCount', 'correctedControlCount']) assert.equal(before[count], 1, count)
        const { wrappers, controls } = fieldLocators(page, currentCaption, currentSelector)
        assert.equal(await wrappers.isVisible(), true, 'Disabled field wrapper remains visible')
        assert.equal(await controls.isVisible(), true, 'Disabled native select remains visible')
        assert.equal(before.wrappers[0].tag, 'label')
        assert.equal(before.wrappers[0].labelControl?.sameAsResolvedControl, true, 'Label delegates to the unique intended select')
        assert.equal(before.controls[0].localDomState.disabledProperty, true, 'Native disabled property is set')
        assert.equal(before.controls[0].localDomState.matchesDisabled, true, 'Native select matches :disabled')
        assert.deepEqual(before.playwrightState, { wrapper: { count: 1, enabled: false }, control: { count: 1, enabled: false } })
        assert.equal(mutation.value, 'solid'); assert.notEqual(mutation.value, 'dashed')
        assert.deepEqual(before.controls[0].options.map((option) => option.value), options)
        assert.equal(before.controls[0].options.find((option) => option.value === 'dashed').disabled, false)
      } })
    await fieldLocators(page, currentCaption, currentSelector).controls.evaluate((element) => { element.disabled = false })
    const restoredBefore = await inspectPointInspectorField(page, currentCaption, currentSelector)
    assert.deepEqual(restoredBefore.playwrightState, { wrapper: { count: 1, enabled: true }, control: { count: 1, enabled: true } })
    const restoredSelection = await selectPointInspectorField(page, currentCaption, 'dashed', { options })
    const restoredEvents = await page.evaluate(() => window.stzInspectorRejection.events)
    await diagnose({ boundary: 'wrapped-inspector-disabled-control-restored', restoredBefore, restoredSelection, restoredEvents })
    assert.deepEqual(restoredEvents, [{ type: 'input', value: 'dashed' }, { type: 'change', value: 'dashed' }])
    checks.push('restored-control-native-selection')
    await reject('unavailable-option', ({ controls }) => controls.locator('option[value="dashed"]').evaluate((element) => element.remove()), /Native option values/)
    await reject('disabled-option', ({ controls }) => controls.locator('option[value="dashed"]').evaluate((element) => { element.disabled = true }), /Enabled native option/)
    await reject('unavailable-requested-value', () => {}, /Available native option/, {
      action: () => selectPointInspectorField(page, currentCaption, 'unavailable', { options }),
    })
    await reject('wrong-requested-value-type', () => {}, /Available native option/, {
      action: () => selectPointInspectorField(page, currentCaption, 1, { options }),
    })
    await reject('caption-substring-rejected', () => {}, /One exact Inspector caption/, {
      action: () => resolvePointInspectorField(page, 'Border', 'select'),
    })
    await reject('wrong-control-type-rejected', () => {}, /One native input/, {
      action: () => resolvePointInspectorField(page, currentCaption, 'input[type="text"]'),
    })
    await diagnose({ boundary: 'wrapped-inspector-field-regressions-complete', source: 'production-App-Inspector-clone', checks, observations })
    return { checks, observations }
  } catch (error) {
    primary = error
    const failure = { boundary: 'wrapped-inspector-field-regression-failure', error: {
      message: error.message, stack: error.stack, ...(error.log === undefined ? {} : { log: error.log }),
    }, checks }
    try { failure.field = await boundedPointDiagnostic(() => inspectPointInspectorField(page, currentCaption, currentSelector), 'Inspector clone failure capture') }
    catch (captureError) { failure.captureError = { message: captureError.message, stack: captureError.stack } }
    try { await boundedPointDiagnostic(() => diagnose(failure), 'Inspector clone failure evidence') }
    catch (diagnosticError) { console.error('Inspector clone diagnostics:', diagnosticError) }
    throw error
  } finally { await cleanupPointCheck(primary, () => page.close()) }
}
