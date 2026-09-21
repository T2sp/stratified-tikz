import assert from 'node:assert/strict'
import test from 'node:test'
import { labelAnchors } from '../../src/model/types.ts'
import { parseLabelText } from '../../src/rendering/labelText.ts'
import { composeLabelLayout, type LabelLayout, type TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { literalSvgLabelLayout, normalizeSvgLabelFontSize, placeSvgLabel, svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'

const measurement: TextMeasurementProvider = {
  identity: 'placement-test',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2,
    ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}

test('all nine anchors use the measured full extent, including tall math, descenders and multiple lines', () => {
  const parsed = parseLabelText('領域 $\\frac{1}{2}$ $g_i$\n next')
  assert.equal(parsed.kind, 'parsed')
  if (parsed.kind !== 'parsed') return
  const layout = composeLabelLayout(parsed.runs,
    parsed.runs.map((run) => run.kind === 'math'
      ? { width: 2, ascent: 2.5, descent: 1.3, inkLeft: -0.2, inkRight: 2.2 } : undefined),
    svgLabelLayoutSettings(20), measurement)
  for (const anchor of labelAnchors) {
    const placed = placeSvgLabel(layout, 20, anchor)
    const bounds = placed.bounds
    assert.equal(bounds.maxX - bounds.minX, (layout.bounds.maxX - layout.bounds.minX) * 20)
    assert.equal(bounds.maxY - bounds.minY, (layout.bounds.maxY - layout.bounds.minY) * 20)
    if (anchor.includes('east')) assert.equal(bounds.maxX, 0)
    else if (anchor.includes('west')) assert.equal(bounds.minX, 0)
    else assert.equal(bounds.minX + bounds.maxX, 0)
    if (anchor.includes('north')) assert.equal(bounds.minY, 0)
    else if (anchor.includes('south')) assert.equal(bounds.maxY, 0)
    else assert.equal(bounds.minY + bounds.maxY, 0)
  }
  const before = placeSvgLabel(layout, 20, 'center')
  const after = placeSvgLabel(layout, 40, 'center')
  assert.deepEqual(after.bounds, Object.fromEntries(Object.entries(before.bounds).map(([key, value]) => [key, 2 * value])))
})

test('literal source retains all whitespace, escapes and CRLF; tabs use measured space stops', () => {
  const source = '  <>& "\' \\bad  \t A\r\n $x$\n'
  const { layout, estimated } = literalSvgLabelLayout(source, svgLabelLayoutSettings(20), measurement)
  assert.equal(estimated, false)
  assert.equal(layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join(''), source)
  assert.equal(layout.lines.length, 3)
  const tab = layout.placements.find((item) => item.kind === 'tab')!
  assert.equal((tab.x + tab.width) % 2, 0)
  const newline = layout.placements.find((item) => item.kind === 'newline')!
  assert.equal(newline.kind === 'newline' && newline.text, '\r\n')
})

test('math-internal physical newlines remain one formula; text newlines make label lines', () => {
  const parsed = parseLabelText('before $\\begin{matrix}a\\\\\nb\\end{matrix}$\nafter')
  assert.equal(parsed.kind, 'parsed')
  if (parsed.kind !== 'parsed') return
  const layout = composeLabelLayout(parsed.runs,
    parsed.runs.map((run) => run.kind === 'math' ? { width: 2, ascent: 2, descent: 1 } : undefined),
    svgLabelLayoutSettings(20), measurement)
  assert.equal(layout.lines.length, 2)
  assert.equal(layout.placements.filter((item) => item.kind === 'math').length, 1)
})

test('empty, invalid and failed metrics cannot create non-finite or invented large bounds', () => {
  const empty = literalSvgLabelLayout('', svgLabelLayoutSettings(20), measurement)
  assert.deepEqual(placeSvgLabel(empty.layout, 20, 'center').bounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
  const broken = { ...measurement, measure: () => ({ width: NaN, ascent: Infinity, descent: -1 }) }
  const fallback = literalSvgLabelLayout('  \\oops\t\r\n <&>', svgLabelLayoutSettings(20), broken)
  assert.equal(fallback.estimated, true)
  assert.ok(Object.values(placeSvgLabel(fallback.layout, 20, 'south east').bounds).every(Number.isFinite))
  const invalid: LabelLayout = { ...empty.layout, bounds: { minX: NaN, minY: 0, maxX: Infinity, maxY: 2 } }
  assert.deepEqual(placeSvgLabel(invalid, 20, 'center').bounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
  assert.deepEqual(placeSvgLabel(fallback.layout, Infinity, 'center').bounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
})

test('input-limit failure retains the complete literal source with finite measured bounds', () => {
  const source = ' x'.repeat(9000)
  const value = literalSvgLabelLayout(source, svgLabelLayoutSettings(20), measurement)
  assert.equal(value.layout.placements.map((item) => item.kind === 'text' ? item.text : '').join(''), source)
  assert.ok(Object.values(value.layout.bounds).every(Number.isFinite))
})

test('extreme font sizes use one bounded display and measurement scale', () => {
  assert.equal(normalizeSvgLabelFontSize(5400), 4096)
  for (const requested of [5400, Infinity, NaN, -1, 0, 27]) {
    const fontSize = normalizeSvgLabelFontSize(requested)
    const settings = svgLabelLayoutSettings(requested)
    assert.equal(settings.font.sizePx, fontSize)
    const value = literalSvgLabelLayout('measured', settings, measurement)
    const bounds = placeSvgLabel(value.layout, fontSize, 'center').bounds
    assert.ok(bounds.maxX > bounds.minX)
    assert.ok(Object.values(bounds).every(Number.isFinite))
  }
})
