import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { clonePointStyle, getPointPaint } from '../../src/model/styles.ts'
import type { Diagram } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseFiniteNumber,
  updateStratumStyleById,
  parseOpacity,
  parsePositiveFiniteNumber,
} from '../../src/ui/diagramUpdates.ts'
import {
  finiteNumberDraftWarning,
  inspectorNumericCommitValue,
  type InspectorNumberParser,
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

test('numeric focus then blur leaves unresolved imported paint and history untouched', () => {
  for (const [field, draft, parse] of [
    ['fill.opacity', '1', parseOpacity],
    ['stroke.width', '0.4', parsePositiveFiniteNumber],
  ] as const) {
    const original = importedNumericDiagram()
    const committed = acceptNumericDraft(original, field, draft, parse, 'blur', false)
    assert.equal(committed, original)
    const point = committed.strata[0]
    assert.ok(point.geometricKind === 'point')
    assert.deepEqual(point.style.importedPaint?.overriddenFields, [])
    for (const exportMode of ['standalone', 'inlineMath'] as const) {
      const options = generateTikz(committed, { exportMode }).match(/example,([\s\S]*?)\] at/)?.[1] ?? ''
      assert.doesNotMatch(options, /fill opacity=|line width=/)
    }
  }
})

test('numeric typing and Enter explicitly accept equal fallback values; blur after typing retains intent', () => {
  for (const [trigger, edited] of [['input', false], ['enter', false], ['blur', true]] as const) {
    for (const [field, draft, parse] of [
      ['fill.opacity', '1', parseOpacity],
      ['stroke.width', '0.4', parsePositiveFiniteNumber],
    ] as const) {
      const committed = acceptNumericDraft(importedNumericDiagram(), field, draft, parse, trigger, edited)
      const point = committed.strata[0]
      assert.ok(point.geometricKind === 'point')
      assert.deepEqual(point.style.importedPaint?.overriddenFields, [field])
    }
  }
})

test('invalid numeric drafts never create imported override intent for any acceptance trigger', () => {
  for (const trigger of ['input', 'blur', 'enter'] as const) {
    const original = importedNumericDiagram()
    assert.equal(acceptNumericDraft(original, 'stroke.width', '.', parsePositiveFiniteNumber, trigger, true), original)
  }
})

function importedNumericDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'numeric', position: { x: 0, y: 0, z: 0 } })]
  const imported = importTikzStyleFile(diagram, 'numeric.sty', String.raw`\tikzstyle{example}=[fill opacity=\alpha,line width=\width]`)
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point')
  assert.ok(preset)
  return applyUserStylePresetToStratum(imported.diagram, 'numeric', preset.id)
}

function acceptNumericDraft(diagram: Diagram, field: 'fill.opacity' | 'stroke.width', draft: string,
  parse: InspectorNumberParser, trigger: 'input' | 'blur' | 'enter', edited: boolean): Diagram {
  const accepted = inspectorNumericCommitValue(updateInspectorNumericDraft(draft, parse, 'Invalid'), trigger, edited)
  if (accepted === null) return diagram
  return updateStratumStyleById(diagram, 'numeric', (style) => {
    if (style.kind !== 'pointStyle') return style
    const next = clonePointStyle(style)
    const paint = getPointPaint(next)
    if (field === 'fill.opacity') paint.fill.opacity = accepted
    else paint.stroke.width = accepted
    return next
  }, [field])
}
