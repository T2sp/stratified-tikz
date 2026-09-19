import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLabelService,
  serializeMathSvg,
  type LabelConversionResult,
} from '../../src/rendering/labels/labelService.ts'
import type { LabelLayoutSettings, TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import type { MathSvgGeometry, ValidatedSvgElement } from '../../src/rendering/labels/labelSvg.ts'

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
    for (const value of Object.values(run.geometry.metrics)) assert.ok(Number.isFinite(value))
    for (const key of ['width', 'ascent', 'descent'] as const) assert.ok(run.geometry.metrics[key] >= 0)
  }
  return result
}

type Point = readonly [number, number]
type InkBox = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>
const TOLERANCE = 1e-8

/**
 * Independent fixture oracle: solve quadratic/cubic derivative roots for true
 * path extrema, rather than using the adapter's control-point hull or nominal
 * MathJax box. No production measurement helper participates in these checks.
 * The fixed SVG miterlimit also encloses strokes (including glyph blackening).
 */
function fixtureInkBounds(svg: ValidatedSvgElement): InkBox | undefined {
  const allPoints: Point[] = []
  let count = 0
  function pathPoints(d: string): Point[] {
    const tokens = d.match(/[A-Za-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []
    assert.ok(tokens.length < 200_000, 'Oracle fixtures remain bounded')
    const points: Point[] = []
    let at: Point = [0, 0]
    let start: Point = at
    let command = ''
    let index = 0
    const takePoint = (): Point => [Number(tokens[index++]), Number(tokens[index++])]
    const evaluate = (controls: readonly Point[], t: number): Point => {
      let row = [...controls]
      while (row.length > 1) row = row.slice(1).map((point, i): Point =>
        [row[i][0] * (1 - t) + point[0] * t, row[i][1] * (1 - t) + point[1] * t])
      return row[0]
    }
    const curve = (controls: readonly Point[]): void => {
      const times = [0, 1]
      for (const axis of [0, 1] as const) {
        const p = controls.map((point) => point[axis])
        if (p.length === 3) {
          const denominator = p[0] - 2 * p[1] + p[2]
          if (denominator !== 0) times.push((p[0] - p[1]) / denominator)
        } else {
          const a = -p[0] + 3 * p[1] - 3 * p[2] + p[3]
          const b = 2 * (p[0] - 2 * p[1] + p[2])
          const c = p[1] - p[0]
          if (Math.abs(a) < 1e-12) {
            if (Math.abs(b) >= 1e-12) times.push(-c / b)
          } else {
            const discriminant = b * b - 4 * a * c
            if (discriminant >= 0) {
              times.push((-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a))
            }
          }
        }
      }
      points.push(...times.filter((t) => t >= 0 && t <= 1).map((t) => evaluate(controls, t)))
      at = controls[controls.length - 1]
    }
    while (index < tokens.length) {
      if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++]
      if (command === 'M') {
        at = takePoint(); start = at; points.push(at); command = 'L'
      } else if (command === 'L') {
        at = takePoint(); points.push(at)
      } else if (command === 'H') {
        at = [Number(tokens[index++]), at[1]]; points.push(at)
      } else if (command === 'V') {
        at = [at[0], Number(tokens[index++])]; points.push(at)
      } else if (command === 'Q') {
        curve([at, takePoint(), takePoint()])
      } else if (command === 'C') {
        curve([at, takePoint(), takePoint(), takePoint()])
      } else if (command === 'Z') {
        at = start; points.push(at); command = ''
      } else assert.fail(`Fixture needs an independently verified oracle for ${command}`)
    }
    return points
  }
  type Paint = Readonly<{ fill: boolean; stroke: boolean; width: number; join: string; cap: string }>
  function visit(node: ValidatedSvgElement, parent: (point: Point) => Point, inherited: Paint): void {
    assert.ok(++count < 10_000)
    const string = (name: string, fallback = ''): string => {
      const value = node.attributes[name]
      return typeof value === 'string' ? value : fallback
    }
    const number = (name: string, fallback = 0): number => Number(string(name, String(fallback)).replace(/px$/, ''))
    const transforms = [...string('transform').matchAll(/(translate|scale)\(([^)]+)\)/g)]
    const transform = (point: Point): Point => parent(transforms.reduceRight<Point>((current, match) => {
      const values = match[2].trim().split(/[\s,]+/).map(Number)
      return match[1] === 'translate'
        ? [current[0] + values[0], current[1] + (values[1] ?? 0)]
        : [current[0] * values[0], current[1] * (values[1] ?? values[0])]
    }, point))
    const paint: Paint = {
      fill: node.attributes.fill === undefined ? inherited.fill : node.attributes.fill !== 'none',
      stroke: node.attributes.stroke === undefined ? inherited.stroke : node.attributes.stroke !== 'none',
      width: number('stroke-width', inherited.width),
      join: string('stroke-linejoin', inherited.join), cap: string('stroke-linecap', inherited.cap),
    }
    let points: Point[] = []
    if (node.tag === 'path') points = pathPoints(string('d'))
    else if (node.tag === 'rect') {
      const x = number('x'), y = number('y'), w = number('width'), h = number('height')
      if (w && h) points = [[x, y], [x + w, y + h]]
    } else if (node.tag === 'line') points = [[number('x1'), number('y1')], [number('x2'), number('y2')]]
    else if (node.tag === 'polygon' || node.tag === 'polyline') {
      const values = string('points').trim().split(/[\s,]+/).map(Number)
      for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]])
    } else assert.ok(node.tag === 'g' || node.tag === 'svg', `Unknown fixture shape ${node.tag}`)
    if (points.length && (paint.stroke || (paint.fill && node.tag !== 'line'))) {
      const stroke = paint.stroke ? paint.width / 2 * Math.max(paint.join === 'miter' ? 4 : 1,
        paint.cap === 'square' ? Math.SQRT2 : 1) : 0
      const xs = points.map((point) => point[0]), ys = points.map((point) => point[1])
      for (const x of [Math.min(...xs) - stroke, Math.max(...xs) + stroke]) {
        for (const y of [Math.min(...ys) - stroke, Math.max(...ys) + stroke]) allPoints.push(transform([x, y]))
      }
    }
    for (const child of node.children) if (typeof child !== 'string') visit(child, transform, paint)
  }
  visit(svg, (point) => point, { fill: true, stroke: false, width: 1, join: 'miter', cap: 'butt' })
  if (allPoints.length === 0) return undefined
  return {
    minX: Math.min(...allPoints.map((point) => point[0])), minY: Math.min(...allPoints.map((point) => point[1])),
    maxX: Math.max(...allPoints.map((point) => point[0])), maxY: Math.max(...allPoints.map((point) => point[1])),
  }
}

function encloses(outer: InkBox, inner: InkBox, description: string): void {
  assert.ok(outer.minX <= inner.minX + TOLERANCE && outer.minY <= inner.minY + TOLERANCE
    && outer.maxX >= inner.maxX - TOLERANCE && outer.maxY >= inner.maxY - TOLERANCE,
  `${description}: ${JSON.stringify(outer)} must enclose independent ink ${JSON.stringify(inner)}`)
}

function assertPortableInk(result: Extract<LabelConversionResult, { kind: 'success' }>): void {
  for (const placement of result.layout.placements) {
    if (placement.kind !== 'math') continue
    const geometry = result.runs[placement.runIndex].geometry
    assert.ok(geometry)
    const ink = fixtureInkBounds(geometry.svg)
    if (!ink) continue
    const [x, y, width, height] = geometry.viewBox
    encloses({ minX: x, minY: y, maxX: x + width, maxY: y + height }, ink, `${result.source}: portable viewport`)
    assert.equal(geometry.svg.attributes.viewBox, geometry.viewBox.join(' '))
    assert.equal(geometry.svg.attributes.width, `${width / 1000}em`)
    assert.equal(geometry.svg.attributes.height, `${height / 1000}em`)
    const relative = { minX: ink.minX / 1000 - geometry.offsetX, maxX: ink.maxX / 1000 - geometry.offsetX,
      minY: ink.minY / 1000, maxY: ink.maxY / 1000 }
    encloses({ minX: geometry.metrics.inkLeft, maxX: geometry.metrics.inkRight,
      minY: -geometry.metrics.ascent, maxY: geometry.metrics.descent }, relative, `${result.source}: run metrics`)
    encloses(result.layout.bounds, { minX: placement.x + relative.minX, maxX: placement.x + relative.maxX,
      minY: placement.baseline + relative.minY, maxY: placement.baseline + relative.maxY }, `${result.source}: composed label`)
  }
}

function firstGeometry(result: Extract<LabelConversionResult, { kind: 'success' }>): MathSvgGeometry {
  const geometry = result.runs.find((run) => run.kind === 'math')?.geometry
  assert.ok(geometry)
  return geometry
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
    assertPortableInk(result)
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
  assertPortableInk(result)
})

test('rlap and llap enclose real glyph overhang without changing zero advance or following run origins', async () => {
  const { service, diagnostics } = adapter()
  for (const tex of ['\\rlap{x}', '\\llap{x}']) {
    const result = success(await service.convert('$' + tex + '$A$y$', settings), diagnostics)
    assertPortableInk(result)
    const geometry = firstGeometry(result)
    assert.equal(geometry.metrics.width, 0, `${tex} has zero logical advance`)
    assert.deepEqual(result.layout.placements.map((placement) => placement.x), [0, 0, 0.5])
    const ink = fixtureInkBounds(geometry.svg)
    assert.ok(ink)
    if (tex.startsWith('\\rlap')) {
      // The pinned font's x path really reaches x=527 user units; this is not
      // evidence inferred from MathJax's 16-unit minimum nominal viewport.
      assert.ok(ink.maxX / 1000 - geometry.offsetX >= 0.527)
      assert.ok(geometry.metrics.inkRight >= 0.527)
    } else {
      // The glyph's x=29 point translated by -572 is left of the run origin.
      assert.ok(ink.minX / 1000 - geometry.offsetX <= -0.543)
      assert.ok(result.layout.bounds.minX <= -0.543)
      assert.ok(geometry.offsetX > 0)
    }
    assert.ok(geometry.viewBox[2] / 1000 > geometry.metrics.width)
  }
})

test('smash retains ink above and below its nominal box with an unchanged baseline and advance', async () => {
  const { service, diagnostics } = adapter()
  for (const expression of ['x', 'x_{gj}']) {
    const ordinary = success(await service.convert('$' + expression + '$', settings), diagnostics)
    const smashed = success(await service.convert('$\\smash{' + expression + '}$T', settings), diagnostics)
    assertPortableInk(smashed)
    const geometry = firstGeometry(smashed)
    assert.equal(geometry.metrics.width, firstGeometry(ordinary).metrics.width)
    assert.equal(smashed.layout.placements[0].baseline, 0)
    assert.equal(smashed.layout.placements[1].x, geometry.metrics.width)
    const ink = fixtureInkBounds(geometry.svg)
    assert.ok(ink && ink.minY <= -442, 'Pinned x glyph rises above smash\'s zero nominal ascent')
    if (expression === 'x_{gj}') {
      assert.ok(ink.maxY > 250, 'Descenders and subscripts extend below the nominal 16-unit minimum box')
      assert.ok(geometry.metrics.descent > 0.25)
    }
  }
})

test('negative spacing forms retain left or right ink while following runs use the true reduced advance', async () => {
  const { service, diagnostics } = adapter()
  const xAdvance = firstGeometry(success(await service.convert('$x$', settings), diagnostics)).metrics.width
  const fixtures = [
    { tex: '\\!x', adjustment: 0.167, side: 'left' },
    { tex: 'x\\!', adjustment: 0.167, side: 'right' },
    { tex: '\\kern-.2em x', adjustment: 0.2, side: 'left' },
    { tex: 'x\\kern-.2em', adjustment: 0.2, side: 'right' },
    { tex: '\\mkern-3mu x', adjustment: 0.167, side: 'left' },
    { tex: '\\hspace{-.2em}x', adjustment: 0.2, side: 'left' },
    { tex: '{\\kern-.2em {x}}', adjustment: 0.2, side: 'left' },
  ] as const
  for (const { tex, adjustment, side } of fixtures) {
    const result = success(await service.convert('$' + tex + '$T$y$', settings), diagnostics)
    assertPortableInk(result)
    const geometry = firstGeometry(result)
    assert.ok(Math.abs(geometry.metrics.width - (xAdvance - adjustment)) < TOLERANCE, tex)
    assert.equal(result.layout.placements[1].x, geometry.metrics.width, tex)
    assert.equal(result.layout.placements[2].x, geometry.metrics.width + 0.5, tex)
    if (side === 'left') assert.ok(geometry.metrics.inkLeft < 0, tex)
    else assert.ok(geometry.metrics.inkRight > geometry.metrics.width, tex)
  }
})

test('nested overflowing constructs and multiline mixed labels keep every glyph and run origin', async () => {
  const { service, diagnostics } = adapter()
  const y = firstGeometry(success(await service.convert('$y$', settings), diagnostics))
  for (const tex of ['{\\rlap{{x}}}y', '\\llap{\\smash{x_{gj}}}y', '\\smash{\\llap{x_{gj}}}y']) {
    const result = success(await service.convert('$' + tex + '$', settings), diagnostics)
    assertPortableInk(result)
    assert.equal(firstGeometry(result).metrics.width, y.metrics.width)
    assert.ok(firstGeometry(result).pathCount >= 2, 'Both overlapping and following content survive')
  }
  const source = ' \t$\\frac{1}{2}$  \r\nthen \\(\\smash{\\llap{x_{gj}}}y\\)\t$$x\\!$$ end\n '
  const mixed = success(await service.convert(source, settings), diagnostics)
  assert.equal(mixed.source, source)
  assert.equal(mixed.layout.lines.length, 3)
  assert.equal(mixed.runs.filter((run) => run.kind === 'math').length, 3)
  assertPortableInk(mixed)
  const repeated = await service.convert(source, settings)
  assert.equal(repeated, mixed, 'Successful repeated conversions reuse the immutable result')
  assert.ok(Object.isFrozen(mixed) && Object.isFrozen(mixed.runs) && Object.isFrozen(mixed.layout.bounds))
  const geometry = firstGeometry(mixed)
  assert.ok(Object.isFrozen(geometry.svg.attributes) && Object.isFrozen(geometry.metrics))
  assert.equal(Reflect.set(geometry.svg.attributes, 'viewBox', '0 0 1 1'), false, 'Frozen geometry must resist mutation')
  assertPortableInk(success(await service.convert(source, settings), diagnostics))
})

test('negative total advances reject the exact complete source, discard prior geometry, and preserve request isolation', async () => {
  const { service, diagnostics } = adapter()
  const good = success(await service.convert('$\\sqrt{2}+1$', settings), diagnostics)
  for (const tex of [
    '\\kern-1em x', 'x\\kern-1em', '\\mkern-18mu x', '\\hspace{-1em}x',
    '\\!\\!\\!\\!x', '{\\kern-1em {x}}', '\\smash{\\kern-1em x}',
  ]) {
    const before = service.stats()
    const source = '  \t$\\frac{1}{2}$\r\n before \\(' + tex + '\\)  \t\n'
    const first = await service.convert(source, settings)
    const repeated = await service.convert(source, settings)
    for (const result of [first, repeated]) {
      assert.equal(result.kind, 'fallback', tex)
      assert.equal(result.kind === 'fallback' && result.reason, 'invalid-metrics', tex)
      assert.equal(result.source, source, 'Every delimiter, space, tab, and physical newline is authoritative')
      assert.equal('runs' in result, false, 'No earlier successful fraction may leak from a rejected label')
      assert.equal('layout' in result, false)
      assert.ok(Object.isFrozen(result))
      assert.equal(result.generation, good.generation)
    }
    assert.notEqual(first.identity, repeated.identity, 'Conversion failures preserve the existing non-cached request identity policy')
    assert.deepEqual(service.stats().geometry, before.geometry, 'Rejected labels cannot populate reusable geometry caches')
    assert.equal(await service.convert('$\\sqrt{2}+1$', settings), good, 'Failure leaves a prior immutable cache entry reusable')
    assertPortableInk(success(await service.convert('$x+1$', settings), diagnostics))
  }
})

test('safe positive spacing and valid empty formulas retain normal following-run advance', async () => {
  const { service, diagnostics } = adapter()
  for (const source of ['$x\\,y\\quad z$', '$x\\kern.2em y$', '$x\\mkern3mu y$', '$x\\hspace{.2em}y$', '\\(\\)']) {
    const result = success(await service.convert(source + 'T', settings), diagnostics)
    assertPortableInk(result)
    const geometry = firstGeometry(result)
    assert.equal(result.layout.placements[1].x, geometry.metrics.width)
  }
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
  assertPortableInk(colored)
  const framed = success(await service.convert('$\\begin{array}{|c|c|}\\hline a&b\\\\\\hline c&d\\\\\\hline\\end{array}$', settings), diagnostics)
  assert.ok(framed.runs[0]?.geometry)
  const frameMarkup = serializeMathSvg(framed.runs[0].geometry)
  assert.match(frameMarkup, /stroke-width="70"/)
  assert.match(frameMarkup, /fill="none"/)
  assert.doesNotMatch(frameMarkup, /class=|data-|style=/)
  assertPortableInk(framed)
  const dashed = success(await service.convert('$\\begin{array}{c:c}a&b\\\\\\hdashline c&d\\end{array}$', settings), diagnostics)
  assert.ok(dashed.runs[0]?.geometry)
  const dashedMarkup = serializeMathSvg(dashed.runs[0].geometry)
  assert.match(dashedMarkup, /stroke-dasharray="140"/)
  assert.match(dashedMarkup, /stroke-width="70"/)
  assert.doesNotMatch(dashedMarkup, /class=|data-|style=/)
  assertPortableInk(dashed)
})

test('actual successful empty math is distinct from parse/output errors', async () => {
  const { service, diagnostics } = adapter()
  const result = success(await service.convert('before \\(\\) after', settings), diagnostics)
  assert.equal(result.source, 'before \\(\\) after')
  assert.equal(result.runs[1]?.geometry?.pathCount, 0)
  // MathJax 4.1.3 gives empty SVGs a finite minimum viewport. Its logical
  // advance is still zero, so following content is not pushed right.
  assert.deepEqual(result.runs[1]?.geometry?.metrics, { width: 0, ascent: 0, descent: 0.016, inkLeft: 0, inkRight: 0.016 })
  assert.equal(result.layout.placements[2].x, result.layout.placements[1].x)
  assertPortableInk(result)
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
