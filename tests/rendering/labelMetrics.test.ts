import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLabelText, type LabelRun } from '../../src/rendering/labelText.ts'
import {
  composeLabelLayout,
  createBrowserTextMeasurementProvider,
  LabelMetricsError,
  MAX_LABEL_LAYOUT_FRAGMENTS,
  type LabelLayoutSettings,
  type LabelMetrics,
  type TextMeasurementProvider,
} from '../../src/rendering/labels/labelMetrics.ts'

const settings: LabelLayoutSettings = Object.freeze({
  font: Object.freeze({ family: 'Test Serif', sizePx: 20, weight: '400', style: 'normal', fontReadinessGeneration: 0 }),
  tabSize: 4,
  lineGapEm: 0.2,
})

const provider: TextMeasurementProvider = Object.freeze({
  identity: 'deterministic-test-font-v1',
  measure: (text, font) => ({ width: Array.from(text).length * font.sizePx / 2, ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
})

function runs(source: string): readonly LabelRun[] {
  const result = parseLabelText(source)
  if (result.kind !== 'parsed') assert.fail('Expected parsed fixture')
  return result.runs
}

function layout(source: string, math: readonly (LabelMetrics | undefined)[] = []) {
  return composeLabelLayout(runs(source), math, settings, provider)
}

test('ordinary Unicode and spaces are measured as exact text, normalized to em', () => {
  const calls: string[] = []
  const measured = composeLabelLayout(runs('  日🙂  é '), [], settings, {
    ...provider,
    measure(text, font) {
      calls.push(text)
      return provider.measure(text, font)
    },
  })
  assert.deepEqual(calls, ['  日🙂  é '])
  assert.equal(measured.metrics.width, 4.5)
  assert.equal(measured.metrics.ascent, 0.8)
  assert.equal(measured.metrics.descent, 0.2)
  assert.equal(measured.placements[0]?.kind, 'text')
  assert.equal(measured.placements[0]?.baseline, 0)
})

test('text, formulas, tabs, and explicit CRLF/newlines preserve run and fragment order', () => {
  const result = layout(' A\t$x$\r\nB\n\tC ', [undefined, { width: 1.2, ascent: 1.4, descent: 0.5 }])
  assert.deepEqual(result.placements.map((placement) => placement.kind), [
    'text', 'tab', 'math', 'newline', 'text', 'newline', 'tab', 'text',
  ])
  assert.deepEqual(result.placements.map((placement) => placement.runIndex), [0, 0, 1, 2, 2, 2, 2, 2])
  assert.deepEqual(result.placements.map((placement) => 'text' in placement ? placement.text : '$x$'), [
    ' A', '\t', '$x$', '\r\n', 'B', '\n', '\t', 'C ',
  ])
  assert.equal(result.placements[1]?.width, 1)
  assert.equal(result.placements[2]?.x, 2)
  assert.equal(result.placements[6]?.width, 2)
  assert.equal(result.lines.length, 3)
  assert.equal(result.lines[0]?.ascent, 1.4)
  assert.equal(result.lines[0]?.descent, 0.5)
  assert.equal(result.lines[1]?.baseline, 1.5)
  assert.equal(result.lines[2]?.baseline, 2.7)
})

test('math bodies with physical newlines and display delimiters do not make visual breaks', () => {
  const source = '$$\\begin{matrix}\na & b \\\\\nc & d\n\\end{matrix}$$$x$'
  const result = layout(source, [
    { width: 3, ascent: 2, descent: 1.5 },
    { width: 0.6, ascent: 0.7, descent: 0 },
  ])
  assert.equal(result.lines.length, 1)
  assert.equal(result.placements.length, 2)
  assert.equal(result.placements[1]?.x, 3)
  assert.equal(result.lines[0]?.ascent, 2)
  assert.equal(result.lines[0]?.descent, 1.5)
})

test('each line is separated using actual tall formula extents without overlap', () => {
  const result = layout('$a$\n$b$', [
    { width: 1, ascent: 2, descent: 1 }, undefined,
    { width: 2, ascent: 3, descent: 2 },
  ])
  assert.equal(result.lines[1]?.baseline, 4.2)
  assert.deepEqual(result.bounds, { minX: 0, minY: -2, maxX: 2, maxY: 6.2 })
  assert.equal(result.metrics.ascent, 2)
  assert.equal(result.metrics.descent, 6.2)
})

test('leading, consecutive, and trailing newlines retain empty visual lines', () => {
  const result = layout('\r\n\nX\r')
  assert.equal(result.lines.length, 4)
  assert.deepEqual(result.placements.map((placement) => placement.kind), ['newline', 'newline', 'text', 'newline'])
  assert.deepEqual(result.lines.map((line) => line.width), [0, 0, 0.5, 0])
})

test('a tab at a tab stop advances to the next stop after text or math', () => {
  const result = layout('aaaa\t$x$\t', [undefined, { width: 2, ascent: 0.8, descent: 0.2 }])
  assert.deepEqual(result.placements.filter((placement) => placement.kind === 'tab').map((placement) => [placement.x, placement.width]), [[2, 2], [6, 2]])
  assert.equal(result.metrics.width, 8)
})

test('text glyph overhang contributes to bounds without changing following advance positions', () => {
  const result = composeLabelLayout(runs('f$x$'), [undefined, { width: 1, ascent: 0.8, descent: 0.2 }], settings, {
    ...provider,
    measure: () => ({ width: 10, ascent: 16, descent: 4, inkLeft: -4, inkRight: 15 }),
  })
  assert.equal(result.placements[1]?.x, 0.5)
  assert.deepEqual(result.bounds, { minX: -0.2, minY: -0.8, maxX: 1.5, maxY: 0.2 })
  assert.equal(result.metrics.width, 1.7)
})

test('measurement normalization does not apply the final label scale twice', () => {
  const result = composeLabelLayout(runs('text $x$'), [undefined, { width: 1, ascent: 1, descent: 0.5 }], {
    ...settings, font: { ...settings.font, sizePx: 40 },
  }, provider)
  assert.equal(result.metrics.width, 3.5)
  assert.equal(result.placements[1]?.x, 2.5)
})

test('empty source and empty math have valid finite zero width', () => {
  assert.deepEqual(layout('').bounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
  const result = layout('\\(\\)', [{ width: 0, ascent: 0, descent: 0 }])
  assert.equal(result.metrics.width, 0)
  assert.equal(result.placements.length, 1)
})

test('raw markup characters remain ordinary text data', () => {
  const source = '<svg onload="x"> & \'quotes\' >'
  const result = layout(source)
  assert.equal(result.placements[0]?.kind === 'text' && result.placements[0].text, source)
})

test('all returned arrays, placements, line records and bounds are immutable', () => {
  const result = layout('A\t$x$\nB', [undefined, { width: 1, ascent: 1, descent: 0 }])
  for (const value of [result, result.bounds, result.metrics, result.lines, ...result.lines, result.placements, ...result.placements]) {
    assert.equal(Object.isFrozen(value), true)
  }
  assert.throws(() => Object.assign(result.placements[0]!, { x: 100 }), TypeError)
  assert.equal(result.placements[0]?.x, 0)
})

test('missing, nonfinite, negative, and inverted metrics fail instead of guessing dimensions', () => {
  for (const metrics of [
    undefined,
    { width: NaN, ascent: 1, descent: 0 },
    { width: 1, ascent: Infinity, descent: 0 },
    { width: 1, ascent: 1, descent: -1 },
    { width: 1, ascent: 1, descent: 0, inkLeft: 2, inkRight: 1 },
  ]) {
    assert.throws(() => layout('$x$', [metrics]), (error: unknown) => error instanceof LabelMetricsError && error.reason === 'invalid-metrics')
  }
  assert.throws(() => composeLabelLayout(runs('x'), [], settings, {
    ...provider, measure: () => ({ width: Infinity, ascent: 1, descent: 0 }),
  }), LabelMetricsError)
  assert.throws(() => composeLabelLayout(runs('\t'), [], settings, {
    ...provider, measure: () => ({ width: 0, ascent: 0, descent: 0 }),
  }), LabelMetricsError)
})

test('invalid font and spacing inputs cannot produce plausible cached metrics', () => {
  for (const changed of [
    { ...settings, font: { ...settings.font, sizePx: 0 } },
    { ...settings, font: { ...settings.font, family: ' ' } },
    { ...settings, font: { ...settings.font, fontReadinessGeneration: -1 } },
    { ...settings, tabSize: 0 },
    { ...settings, lineGapEm: NaN },
  ]) {
    assert.throws(() => composeLabelLayout(runs('a'), [], changed, provider), LabelMetricsError)
  }
})

test('layout fragment and accumulated extent limits settle with an explicit error', () => {
  const many: readonly LabelRun[] = [{ kind: 'text', sourceStart: 0, sourceEnd: MAX_LABEL_LAYOUT_FRAGMENTS + 1, text: '\n'.repeat(MAX_LABEL_LAYOUT_FRAGMENTS + 1) }]
  assert.throws(() => composeLabelLayout(many, [], settings, provider), (error: unknown) => error instanceof LabelMetricsError && error.reason === 'work-limit')
  assert.throws(() => layout('$x$$y$', [{ width: 1_000_000, ascent: 1, descent: 0 }, { width: 1, ascent: 1, descent: 0 }]), (error: unknown) => error instanceof LabelMetricsError && error.reason === 'work-limit')
  // Finite individual ink coordinates can still span more than the allowed
  // whole-label width when a glyph has both left and right overhang.
  assert.throws(() => composeLabelLayout(runs('x'), [], settings, {
    ...provider,
    measure: () => ({ width: 20, ascent: 16, descent: 4, inkLeft: -18_000_000, inkRight: 18_000_000 }),
  }), (error: unknown) => error instanceof LabelMetricsError && error.reason === 'work-limit')
  assert.throws(() => layout('$x$', [{ width: 1, ascent: 900_000, descent: 900_000 }]),
    (error: unknown) => error instanceof LabelMetricsError && error.reason === 'work-limit')
})

test('browser-only provider does not silently invent metrics when canvas is unavailable', async () => {
  const browser = createBrowserTextMeasurementProvider()
  assert.throws(() => browser.measure('text', settings.font), (error: unknown) => error instanceof LabelMetricsError && error.reason === 'font')
  await assert.rejects(browser.ready!(settings.font), (error: unknown) => error instanceof LabelMetricsError && error.reason === 'font')
})
