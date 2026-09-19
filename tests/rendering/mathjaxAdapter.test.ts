import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLabelService,
  serializeMathSvg,
  type LabelConversionResult,
} from '../../src/rendering/labels/labelService.ts'
import type { LabelLayoutSettings, TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'

const settings: LabelLayoutSettings = Object.freeze({
  font: Object.freeze({ family: 'serif', sizePx: 16, weight: 'normal', style: 'normal', fontReadinessGeneration: 0 }),
  tabSize: 4,
  lineGapEm: 0.2,
})

const measurement: TextMeasurementProvider = Object.freeze({
  identity: 'deterministic-real-engine-fixture',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2, ascent: font.sizePx * 0.75, descent: font.sizePx * 0.25 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.75, descent: font.sizePx * 0.25 }),
})

function adapter() {
  const diagnostics: unknown[] = []
  const service = createLabelService({ measurement, onDiagnostic: (error) => diagnostics.push(error) })
  return { service, diagnostics }
}

function success(result: LabelConversionResult, diagnostics: readonly unknown[] = []): Extract<LabelConversionResult, { kind: 'success' }> {
  const describe = (error: unknown): string => error instanceof Error
    ? `${error.name}: ${error.message}${error.cause ? '\nCaused by ' + describe(error.cause) : ''}` : String(error)
  assert.equal(result.kind, 'success', `${result.source}: ${JSON.stringify(result)}\n${diagnostics.map(describe).join('\n')}`)
  if (result.kind !== 'success') assert.fail('Expected successful real-engine typesetting')
  assert.equal(result.configurationIdentity.includes('@mathjax/src@4.1.3'), true)
  for (const value of Object.values(result.layout.bounds)) assert.ok(Number.isFinite(value))
  for (const run of result.runs) {
    if (run.kind !== 'math') continue
    assert.ok(run.geometry, 'Every successful math run has reusable geometry')
    for (const value of Object.values(run.geometry.metrics)) assert.ok(Number.isFinite(value) && value >= 0)
  }
  return result
}

test('installed MathJax through the adapter produces geometry for fractions, radicals, indices, and matrices', async () => {
  const { service, diagnostics } = adapter()
  for (const source of [
    '$\\frac{1}{2}$', '$\\sqrt{x^2+y^2}$', '$F^{(1)}_{a_{b}}$',
    '$$\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$$',
    '$\\int_0^1 x^2\\,dx$',
    '$\\mathbb{R}\\to\\mathcal{C}$',
  ]) {
    const result = success(await service.convert(source, settings), diagnostics)
    const run = result.runs[0]
    assert.ok(run?.geometry && run.geometry.pathCount > 0)
    assert.ok(run.geometry.metrics.width > 0)
    assert.ok(run.geometry.metrics.ascent > 0)
    assert.doesNotMatch(serializeMathSvg(run.geometry), /class=|data-|currentColor|href=|\bid=|<use|foreignObject/)
  }
})

test('all four delimiter styles use the correct real inline/display math conversion', async () => {
  const { service, diagnostics } = adapter()
  const result = success(await service.convert('$\\frac{1}{2}$\\(\\frac{1}{2}\\)$$\\frac{1}{2}$$\\[\\frac{1}{2}\\]', settings), diagnostics)
  assert.deepEqual(result.runs.map((run) => run.kind === 'math' && run.display), [false, false, true, true])
  const metrics = result.runs.map((run) => run.geometry?.metrics)
  assert.deepEqual(metrics[0], metrics[1])
  assert.deepEqual(metrics[2], metrics[3])
  assert.ok(metrics[0] && metrics[2] && metrics[2].ascent > metrics[0].ascent,
    'Display fractions have actual display-style geometry')
  assert.equal(result.layout.lines.length, 1, 'Display delimiters do not introduce label line breaks')
})

test('mixed Unicode, literal spaces, tabs, and physical matrix newlines preserve parser runs and layout lines', async () => {
  const { service, diagnostics } = adapter()
  const tex = '\\begin{matrix}\na&b\\\\\r\nc&d\n\\end{matrix}'
  const source = '  領域\t$x_i$  → \\(y^2\\)\r\n$$' + tex + '$$  end\n'
  const result = success(await service.convert(source, settings), diagnostics)
  assert.equal(result.source, source)
  assert.deepEqual(result.runs.map((run) => run.kind === 'math' ? run.tex : run.text),
    ['  領域\t', 'x_i', '  → ', 'y^2', '\r\n', tex, '  end\n'])
  assert.equal(result.runs.filter((run) => run.kind === 'math').length, 3)
  assert.equal(result.layout.lines.length, 3)
  assert.deepEqual(result.layout.placements.filter((placement) => placement.kind === 'newline')
    .map((placement) => placement.text), ['\r\n', '\n'])
  assert.equal(result.layout.placements.filter((placement) => placement.kind === 'tab').length, 1)
})

test('undefined macros and malformed TeX resolve to the exact whole-source fallback, then valid requests still succeed', async () => {
  const { service, diagnostics } = adapter()
  for (const source of [
    ' \t$\\unknowncommand{x}$  \r\n',
    'prefix $\\frac{1}$ suffix',
    ' \\$5 $x$\n  then $\\unknowncommand{x}$  \t\r\n',
    'prefix $x$ then $\\left(x$ end',
  ]) {
    const result = await service.convert(source, settings)
    assert.equal(result.kind, 'fallback', source)
    assert.equal(result.source, source)
    assert.equal(result.kind === 'fallback' && result.reason, 'tex-error')
    assert.equal('runs' in result, false, 'Never retain a successful earlier formula on a failed label')
  }
  success(await service.convert('$\\sqrt{2}$', settings), diagnostics)
})

test('macro definitions and tag/reference state are rejected in both orders and cannot poison isolated labels', async () => {
  for (const reverse of [false, true]) {
    const { service, diagnostics } = adapter()
    const sources = ['$\\def\\stzMacro{x}\\stzMacro$', '$\\stzMacro$',
      '$\\DeclareMathOperator{\\stzOperator}{op}\\stzOperator$', '$\\stzOperator$',
      '$x\\tag{7}\\label{stzEquation}$', '$\\ref{stzEquation}$']
    for (const source of reverse ? sources.toReversed() : sources) {
      const result = await service.convert(source, settings)
      assert.equal(result.kind, 'fallback', source)
      assert.equal(result.source, source)
      assert.equal(result.kind === 'fallback' && result.reason,
        ['$\\stzMacro$', '$\\stzOperator$'].includes(source) ? 'tex-error' : 'unsupported-input')
    }
    success(await service.convert('$x+1$', settings), diagnostics)
  }
})

test('independent concurrent real conversions keep failure capture and result identity scoped', async () => {
  const { service, diagnostics } = adapter()
  const [good, bad, other] = await Promise.all([
    service.convert('$\\frac{2}{3}$', settings),
    service.convert('$\\undefinedForThisLabel$', settings),
    service.convert('$\\sqrt{5}$', settings),
  ])
  success(good, diagnostics)
  success(other, diagnostics)
  assert.equal(bad.kind, 'fallback')
  assert.equal(bad.source, '$\\undefinedForThisLabel$')
  assert.notEqual(good.identity, other.identity)
  assert.notEqual(good.identity, bad.identity)
})

test('inline binary operators retain every glyph in one reusable SVG', async () => {
  const { service, diagnostics } = adapter()
  const result = success(await service.convert('$x+y$', settings), diagnostics)
  const geometry = result.runs[0]?.geometry
  assert.ok(geometry)
  assert.equal(geometry.pathCount, 3, 'Both variables and the plus sign must survive conversion')
  assert.ok(geometry.metrics.width > 2, 'The complete formula is wider than a single glyph')
})

test('real color and framed array geometry remains portable after metadata removal and repainting', async () => {
  const { service, diagnostics } = adapter()
  const colored = success(await service.convert('$\\color{red}{x}+\\color[rgb]{0,0,1}{y}$', settings), diagnostics)
  assert.ok(colored.runs[0]?.geometry)
  const markup = serializeMathSvg(colored.runs[0].geometry, '#123456')
  assert.match(markup, /(?:fill|stroke)="red"/)
  assert.match(markup, /(?:fill|stroke)="(?:blue|#0000ff|rgb\(0%,\s*0%,\s*100%\))"/i)
  assert.doesNotMatch(markup, /class=|data-|style=|currentColor|href=|\bid=/)
  const framed = success(await service.convert('$\\begin{array}{|c|c|}\\hline a&b\\\\\\hline c&d\\\\\\hline\\end{array}$', settings), diagnostics)
  assert.ok(framed.runs[0]?.geometry)
  const frameMarkup = serializeMathSvg(framed.runs[0].geometry)
  assert.match(frameMarkup, /stroke-width="70"/)
  assert.match(frameMarkup, /fill="none"/)
  assert.doesNotMatch(frameMarkup, /class=|data-|style=/)
  const dashed = success(await service.convert('$\\begin{array}{c:c}a&b\\\\\\hdashline c&d\\end{array}$', settings), diagnostics)
  assert.ok(dashed.runs[0]?.geometry)
  const dashedMarkup = serializeMathSvg(dashed.runs[0].geometry)
  assert.match(dashedMarkup, /stroke-dasharray="140"/)
  assert.match(dashedMarkup, /stroke-width="70"/)
  assert.doesNotMatch(dashedMarkup, /class=|data-|style=/)
})

test('actual successful empty math is distinct from parse/output errors', async () => {
  const { service, diagnostics } = adapter()
  const result = success(await service.convert('before \\(\\) after', settings), diagnostics)
  assert.equal(result.source, 'before \\(\\) after')
  assert.equal(result.runs[1]?.geometry?.pathCount, 0)
  // MathJax 4.1.3 gives empty SVGs a minimum viewport of em / 1000.
  // The adapter uses em=16 and preserves that finite, nonnegative viewport.
  assert.deepEqual(result.runs[1]?.geometry?.metrics, { width: 0.016, ascent: 0, descent: 0.016 })
})

test('literal markup characters remain text data alongside actual math geometry', async () => {
  const { service, diagnostics } = adapter()
  const literal = '<svg onload="alert(1)"> & \'quoted\' > '
  const result = success(await service.convert(literal + '$x$', settings), diagnostics)
  assert.equal(result.runs[0]?.kind, 'text')
  assert.equal(result.runs[0]?.kind === 'text' && result.runs[0].text, literal)
  assert.equal(result.runs[0]?.geometry, undefined)
  assert.equal(result.runs[1]?.kind, 'math')
})

test('actual additional font-data rejection settles as complete source and controlled retry can recover', async () => {
  const { createMathJaxEngine } = await import('../../src/rendering/labels/mathjaxRuntime.ts')
  let failFont = true
  const requested: string[] = []
  const diagnostics: unknown[] = []
  const service = createLabelService({
    measurement,
    onDiagnostic: (error) => diagnostics.push(error),
    loadEngine: async () => createMathJaxEngine({
      loadFontData: async (name, load) => {
        requested.push(name)
        if (failFont) throw new Error('Deterministic local font resource rejection')
        return load()
      },
    }),
  })
  const source = ' \t$\\mathbb{R}$  \n'
  const first = await service.convert(source, settings)
  assert.ok(requested.length > 0, 'Fixture must exercise an actual additional font-data request')
  assert.equal(first.kind, 'fallback')
  assert.equal(first.kind === 'fallback' && first.reason, 'resource-error')
  assert.equal(first.source, source)
  failFont = false
  service.invalidate()
  success(await service.convert(source, settings), diagnostics)
})

test('real TeX work limits include macro expansion and array templates before large allocations', async () => {
  const { service, diagnostics } = adapter()
  for (const source of [
    ' prefix $' + '\\TeX '.repeat(1_001) + '$ \t\n',
    ' prefix $\\begin{array}{*{100000000}{c}}x\\end{array}$ \t\n',
    // Empty repeated templates also used to allocate an enormous Array first.
    ' prefix $\\begin{array}{*{100000000}{}}x\\end{array}$ \t\n',
    ' prefix $\\begin{array}{*{256}{' + 'c'.repeat(65) + '}}x\\end{array}$ \t\n',
    ' prefix $\\begin{array}{' + 'c'.repeat(257) + '}x\\end{array}$ \t\n',
    ...['alignat', 'alignat*', 'alignedat', 'xalignat', 'xalignat*', 'xxalignat'].map((name) =>
      ' prefix $\\begin{' + name + '}{' + '9'.repeat(400) + '}a&b\\end{' + name + '}$ \t\n'),
    ' prefix $\\begin{alignedat}[t]{129}a&b\\end{alignedat}$ \t\n',
  ]) {
    const result = await service.convert(source, settings)
    assert.equal(result.kind, 'fallback')
    assert.equal(result.kind === 'fallback' && result.reason, 'limit', source)
    assert.equal(result.source, source)
    assert.equal('runs' in result, false)
    success(await service.convert('$\\sqrt{2}+1$', settings), diagnostics)
  }
  success(await service.convert('$\\begin{array}{*{2}{c}}a&b\\\\c&d\\end{array}$', settings), diagnostics)
  success(await service.convert('$\\begin{alignedat}[t]{1}a&=b\\end{alignedat}$', settings), diagnostics)
})

test('array definitions and direct MathML attribute injection are unsupported before engine loading', async () => {
  let loads = 0
  const service = createLabelService({ measurement, loadEngine: async () => {
    loads++
    throw new Error('Unsupported input must not initialize MathJax')
  } })
  for (const source of [
    ' $\\newcolumntype{Q}{c}\\begin{array}{Q}x\\end{array}$\n',
    ' $\\mmlToken{mi}[href="https://example.com"]{x}$\t ',
    ' $\\mmlToken{mi}[style="background:url(https://example.com)"]{x}$ ',
  ]) {
    const result = await service.convert(source, settings)
    assert.equal(result.kind === 'fallback' && result.reason, 'unsupported-input')
    assert.equal(result.source, source)
  }
  assert.equal(loads, 0)

  // Built-in MathJax macros legitimately expand to mmlToken internally. Source
  // restrictions must leave that controlled engine implementation usable.
  const actual = adapter()
  success(await actual.service.convert('$x\\bmod y\\pmod{2}$', settings), actual.diagnostics)
})
