import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseFiniteNumber,
  parseOpacity,
  parsePositiveFiniteNumber,
} from '../../src/ui/diagramUpdates.ts'
import {
  finiteNumberDraftWarning,
  opacityDraftWarning,
  positiveNumberDraftWarning,
  updateInspectorNumericDraft,
} from '../../src/ui/inspector/numericInput.ts'

test('Inspector numeric draft keeps temporary dot text without committing', () => {
  const result = updateInspectorNumericDraft(
    '.',
    parseFiniteNumber,
    finiteNumberDraftWarning('x'),
  )

  assert.equal(result.draft, '.')
  assert.equal(result.commitValue, null)
  assert.equal(result.warning, 'x must be a finite number.')
})

test('Inspector numeric draft accepts leading decimal and commits 0.5', () => {
  const result = updateInspectorNumericDraft(
    '.5',
    parseFiniteNumber,
    finiteNumberDraftWarning('x'),
  )

  assert.equal(result.draft, '.5')
  assert.equal(result.commitValue, 0.5)
  assert.equal(result.warning, null)
})

test('Inspector numeric invalid draft shows a warning and does not mutate last value', () => {
  let diagramValue = 3
  const result = updateInspectorNumericDraft(
    '1e',
    parseFiniteNumber,
    finiteNumberDraftWarning('x'),
  )

  if (result.commitValue !== null) {
    diagramValue = result.commitValue
  }

  assert.equal(result.draft, '1e')
  assert.equal(result.warning, 'x must be a finite number.')
  assert.equal(diagramValue, 3)
})

test('Inspector numeric draft commits ordinary valid edits', () => {
  const result = updateInspectorNumericDraft(
    '4.5',
    parseFiniteNumber,
    finiteNumberDraftWarning('x'),
  )

  assert.equal(result.commitValue, 4.5)
  assert.equal(result.warning, null)
})

test('Inspector numeric draft rejects NaN and Infinity', () => {
  for (const draft of ['NaN', 'Infinity', '-Infinity']) {
    const result = updateInspectorNumericDraft(
      draft,
      parseFiniteNumber,
      finiteNumberDraftWarning('x'),
    )

    assert.equal(result.commitValue, null, draft)
    assert.equal(result.warning, 'x must be a finite number.', draft)
  }
})

test('Inspector opacity and positive numeric drafts use their constraints', () => {
  const opacity = updateInspectorNumericDraft(
    '.5',
    parseOpacity,
    opacityDraftWarning('Opacity'),
  )
  const invalidOpacity = updateInspectorNumericDraft(
    '1.5',
    parseOpacity,
    opacityDraftWarning('Opacity'),
  )
  const lineWidth = updateInspectorNumericDraft(
    '.5',
    parsePositiveFiniteNumber,
    positiveNumberDraftWarning('Line width'),
  )
  const invalidLineWidth = updateInspectorNumericDraft(
    '0',
    parsePositiveFiniteNumber,
    positiveNumberDraftWarning('Line width'),
  )

  assert.equal(opacity.commitValue, 0.5)
  assert.equal(invalidOpacity.commitValue, null)
  assert.equal(invalidOpacity.warning, 'Opacity must be a number from 0 to 1.')
  assert.equal(lineWidth.commitValue, 0.5)
  assert.equal(invalidLineWidth.commitValue, null)
  assert.equal(
    invalidLineWidth.warning,
    'Line width must be a finite number greater than 0.',
  )
})
