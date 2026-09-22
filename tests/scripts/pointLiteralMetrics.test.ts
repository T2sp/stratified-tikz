import assert from 'node:assert/strict'
import test from 'node:test'
import { collectLiteralMetrics, configureLiteralCanvas, type OracleCanvasMetrics } from '../../scripts/fixtures/labelBrowserOracle.ts'

const nativeSource = '  $\\missingNativePoint$\t\n tail  '
function collect(source: string, svgAscent = 9.75, svgDescent = 2.5, fontBoxes = true) {
  const calls: string[] = []
  const canvas = (text: string): OracleCanvasMetrics => {
    calls.push(text)
    return { width: text.length * 6, actualBoundingBoxAscent: text === 'tall' ? 22 : text.trim() ? 10 : 0,
      actualBoundingBoxDescent: text === 'deep' ? 8 : text.trim() ? 2 : 0,
      actualBoundingBoxLeft: text === 'tall' ? 2 : 0, actualBoundingBoxRight: text.length * 6,
      ...(fontBoxes ? { fontBoundingBoxAscent: 13, fontBoundingBoxDescent: 4 } : {}) }
  }
  const svg = (text: string) => ({ text, advance: text.length * 6,
    bounds: { minX: 0, minY: -svgAscent, maxX: text.length * 6, maxY: svgDescent } })
  const tab = (x: number) => {
    const index = Math.floor(x / 24) + 1
    return { method: 'svg-whitespace-grid', advance: index * 24, index, tabSize: 4, next: svg(' '.repeat(index * 4)) }
  }
  return { ...collectLiteralMetrics(source, 20, 4, canvas, svg, tab), calls }
}

test('metric collection separates differing SVG Mg boxes from Canvas font lines for exact Inspector input', () => {
  const result = collect(nativeSource)
  assert.deepEqual(result.expected.map(({ text, x, y }) => ({ text, x, y })), [
    { text: '  $\\missingNativePoint$', x: 0, y: 0 }, { text: ' tail  ', x: 0, y: 21 },
  ])
  assert.equal(result.extent.minY, -13)
  assert.equal(result.extent.maxY, 25)
  assert.equal(result.extent.maxY - result.extent.minY, 38)
  assert.equal(result.svgProbe.bounds.minY, -9.75)
  assert.equal(result.lineContract.ascent, 13)
  assert.equal(result.lineGap, 4)
  assert.deepEqual(result.calls, ['Mg', ' ', '  $\\missingNativePoint$', ' tail  '])
  assert.deepEqual(result.measurements.map((m) => m.line), [0, 1])
  assert.ok(result.tabs[0].next.text.length > 0)
  const differentSvgBox = collect(nativeSource, 17.2, 6.1)
  assert.deepEqual(result.lines, differentSvgBox.lines)
  assert.deepEqual(result.extent, differentSvgBox.extent)
  assert.deepEqual(result.expected, differentSvgBox.expected)
})

test('per-line ink expansion uses previous descent and NEXT ascent, with empty and whitespace lines', () => {
  const result = collect('deep\ntall\n\n \r\n\t\r')
  assert.deepEqual(result.lines.map((line) => [line.ascent, line.descent, line.baseline]), [
    [13, 8, 0], [22, 4, 34], [13, 4, 55], [13, 4, 76], [13, 4, 97], [13, 4, 118],
  ])
  assert.deepEqual(result.extent, { minX: -2, maxX: 24, minY: -13, maxY: 122 })
  assert.deepEqual(result.expected.map((e) => e.y), [0, 34, 76])
})

for (const newline of ['\n', '\r\n', '\r']) {
  test(`physical lines and boundary tabs: ${JSON.stringify(newline)}`, () => {
    const result = collect(`\t${newline}    \t${newline}${newline}tail\t`)
    assert.deepEqual(result.lines.map((line) => [line.width, line.baseline]), [[24, 0], [48, 21], [0, 42], [48, 63]])
    assert.deepEqual(result.expected.map((e) => [e.text, e.x, e.logicalX, e.y]), [['    ', 0, 0, 21], ['tail', 0, 0, 63]])
    assert.deepEqual(result.tabs.map((tab) => tab.next.text.length), [4, 8, 8])
  })
}

test('missing font-box support falls back to independently measured ink; empty source has zero extent', () => {
  const result = collect('deep\ntall', 9.75, 2.5, false)
  assert.equal(result.lineContract.ascent, 10)
  assert.equal(result.lineContract.descent, 2)
  assert.equal(result.lines[1].baseline, 34)
  const empty = collect('')
  assert.equal(empty.lines.length, 0)
  assert.equal(empty.expected.length, 0)
  assert.equal(empty.extent.maxY - empty.extent.minY, 0)
})

const properties = { 'font-style': 'italic', 'font-weight': '600', 'font-size': '19px',
  'font-family': '"Fixture Serif", serif', 'font-kerning': 'normal', 'text-rendering': 'optimizelegibility',
  'font-stretch': '100%', 'letter-spacing': 'normal', 'word-spacing': '0px' }

test('Canvas boundary constructs font from longhands and records effective configuration', () => {
  // Configuration-only test double; actual font resolution requires browser evidence.
  const context = { font: '10px sans-serif' } as CanvasRenderingContext2D
  const config = configureLiteralCanvas(context, properties)
  assert.equal(config.requested, 'italic 600 19px "Fixture Serif", serif')
  assert.equal(config.effective, config.requested)
  assert.equal(config.textBaseline, 'alphabetic')
  assert.equal(config.direction, 'ltr')
  assert.equal(config.fontKerning, 'normal')
  assert.equal(config.textRendering, 'optimizeLegibility')
})

test('Canvas boundary rejects silently ignored font assignment and unsupported spacing', () => {
  let font = '10px sans-serif'
  const context = { get font() { return font }, set font(value: string) {
    if (value === '1px monospace' || value === '2px serif') font = value
  } } as CanvasRenderingContext2D
  assert.throws(() => configureLiteralCanvas(context, properties), /rejected font/)
  assert.throws(() => configureLiteralCanvas({} as CanvasRenderingContext2D, { ...properties, 'letter-spacing': '2px' }), /spacing/)
})
