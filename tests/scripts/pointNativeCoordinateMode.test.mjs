import assert from 'node:assert/strict'
import test from 'node:test'
import { selectPointCoordinateMode } from '../../scripts/pointNativeCoordinateMode.mjs'

// These selector-aware doubles test orchestration and rejection contracts only.
// The real wrapped-label/select boundary is covered separately in the browser;
// these tests do not claim to implement Playwright's label engine or native DOM.
function coordinateForm(overrides = {}) {
  const state = {
    formCount: 1,
    formVisible: true,
    controlCount: 1,
    controlVisible: true,
    controlEnabled: true,
    optionValues: ['global', 'workPlaneLocal'],
    value: 'workPlaneLocal',
    ...overrides,
  }
  const selections = []
  const queries = []
  const control = {
    count: async () => state.controlCount,
    isVisible: async () => state.controlVisible,
    isEnabled: async () => state.controlEnabled,
    locator(selector) {
      assert.equal(selector, 'option', 'Only inspect this control’s options')
      queries.push(selector)
      return {
        evaluateAll: async (inspect) => inspect(state.optionValues.map((value) => ({ value }))),
      }
    },
    async selectOption(value, options) {
      assert.deepEqual(options, { timeout: 5000 }, 'Selection has a bounded timeout')
      selections.push(value)
      if (state.selectError) throw state.selectError
      if (!state.keepValue) state.value = value
      return state.selectionResult ?? [value]
    },
    inputValue: async () => state.value,
  }
  const form = {
    count: async () => state.formCount,
    isVisible: async () => state.formVisible,
    locator(selector) {
      assert.equal(selector, '.direct-coordinate-mode-field select', 'Select only the scoped coordinate-mode control')
      queries.push(selector)
      return control
    },
  }
  return { form, state, selections, queries }
}

test('coordinate selection orchestration selects global explicitly and verifies its resulting value', async () => {
  const fixture = coordinateForm()
  await selectPointCoordinateMode(fixture.form)
  assert.deepEqual(fixture.selections, ['global'])
  assert.equal(fixture.state.value, 'global')
  assert.deepEqual(fixture.queries, ['.direct-coordinate-mode-field select', 'option'])
})

test('coordinate selection orchestration supports the other valid option explicitly', async () => {
  const fixture = coordinateForm({ value: 'global' })
  await selectPointCoordinateMode(fixture.form, 'workPlaneLocal')
  assert.deepEqual(fixture.selections, ['workPlaneLocal'])
  assert.equal(fixture.state.value, 'workPlaneLocal')
})

for (const [name, overrides] of [
  ['absent form', { formCount: 0 }],
  ['ambiguous forms', { formCount: 2 }],
  ['hidden form', { formVisible: false }],
  ['absent control', { controlCount: 0 }],
  ['ambiguous controls', { controlCount: 2 }],
  ['hidden control', { controlVisible: false }],
  ['disabled control', { controlEnabled: false }],
  ['missing global option', { optionValues: ['workPlaneLocal'] }],
  ['missing work-plane option', { optionValues: ['global'] }],
  ['unexpected option', { optionValues: ['global', 'workPlaneLocal', 'unrelated'] }],
  ['duplicate option', { optionValues: ['global', 'global'] }],
  ['reordered options', { optionValues: ['workPlaneLocal', 'global'] }],
]) {
  test(`coordinate selection orchestration rejects ${name} before selecting`, async () => {
    const fixture = coordinateForm(overrides)
    await assert.rejects(selectPointCoordinateMode(fixture.form))
    assert.deepEqual(fixture.selections, [])
  })
}

test('coordinate selection orchestration rejects an invalid requested value before selecting', async () => {
  const fixture = coordinateForm()
  await assert.rejects(selectPointCoordinateMode(fixture.form, 'unrelated'))
  assert.deepEqual(fixture.selections, [])
})

test('coordinate selection orchestration rejects an unchanged selected value', async () => {
  const fixture = coordinateForm({ keepValue: true })
  await assert.rejects(selectPointCoordinateMode(fixture.form))
  assert.deepEqual(fixture.selections, ['global'])
  assert.equal(fixture.state.value, 'workPlaneLocal')
})

for (const selectionResult of [[], ['workPlaneLocal'], ['global', 'workPlaneLocal']]) {
  test(`coordinate selection orchestration rejects result ${JSON.stringify(selectionResult)}`, async () => {
    const fixture = coordinateForm({ selectionResult })
    await assert.rejects(selectPointCoordinateMode(fixture.form))
    assert.deepEqual(fixture.selections, ['global'])
  })
}

test('coordinate selection orchestration propagates the original selection rejection', async () => {
  const original = new Error('native selectOption failed')
  const fixture = coordinateForm({ selectError: original })
  await assert.rejects(selectPointCoordinateMode(fixture.form), (error) => error === original)
  assert.deepEqual(fixture.selections, ['global'])
})
