import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SVG_LIMITS,
  LabelSvgError,
  paintMathSvg,
  serializeMathSvg,
  validateMathSvg,
  type RawSvgElement,
} from '../../src/rendering/labels/labelSvg.ts'

function svg(children: readonly (RawSvgElement | string)[] = [], attributes: Record<string, string> = {}): RawSvgElement {
  return {
    tag: 'svg',
    attributes: { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 -900 1500 1200', width: '3ex', height: '2.4ex', ...attributes },
    children,
  }
}

function element(tag = 'path', attributes: Record<string, string> = { d: 'M0 0L200 300Z' }, children: readonly (RawSvgElement | string)[] = []): RawSvgElement {
  return { tag, attributes, children }
}

function fails(raw: RawSvgElement, category: LabelSvgError['category']): void {
  assert.throws(() => validateMathSvg(raw), (error: unknown) => error instanceof LabelSvgError && error.category === category)
}

test('SVG viewBox supplies em metrics and a baseline without guessing source height', () => {
  const result = validateMathSvg(svg([element()], { viewBox: '-120 -1250 1750 1775' }))
  assert.deepEqual(result.metrics, { width: 1.75, ascent: 1.25, descent: 0.525 })
  assert.deepEqual(result.viewBox, [0, -1250, 1750, 1775])
  assert.equal(result.offsetX, 0.12)
  assert.equal(result.svg.attributes.width, '1.75em')
  assert.equal(result.svg.attributes.height, '1.775em')
  assert.deepEqual(typeof result.svg.children[0] === 'object' && result.svg.children[0].attributes, { transform: 'translate(120,0)' })
})

test('empty MathJax geometry has finite zero metrics', () => {
  assert.deepEqual(validateMathSvg(svg([], { viewBox: '0 0 0 0' })).metrics,
    { width: 0, ascent: 0, descent: 0 })
})

test('formula ink wholly above or below baseline normalizes to a viewport positioned at minus ascent', () => {
  const below = validateMathSvg(svg([element()], { viewBox: '0 250 1000 500' }))
  assert.deepEqual(below.viewBox, [0, 0, 1000, 750])
  assert.deepEqual(below.metrics, { width: 1, ascent: 0, descent: 0.75 })
  assert.equal(below.svg.attributes.height, '0.75em')
  const above = validateMathSvg(svg([element()], { viewBox: '0 -1000 1000 500' }))
  assert.deepEqual(above.viewBox, [0, -1000, 1000, 1000])
  assert.deepEqual(above.metrics, { width: 1, ascent: 1, descent: 0 })
})

test('merror markers fail before their data attributes or classes can disappear', () => {
  for (const child of [
    element('merror', {}),
    element('g', { 'data-mml-node': 'merror' }),
    element('g', { 'data-mjx-error': 'bad command' }),
    element('g', { 'data-mjx-message': 'bad command' }),
    element('g', { class: 'mjx-merror' }),
  ]) fails(svg([child]), 'tex')
})

test('glyphs, frames, dashed and dotted lines retain their MathJax stylesheet paint', () => {
  const result = validateMathSvg(svg([
    element('path', { d: 'M0 0L200 300Z', 'data-c': '41' }),
    element('rect', { x: '0', y: '0', width: '10', height: '20', 'data-frame': 'true', class: 'mjx-dashed' }),
    element('line', { x1: '0', x2: '10', y1: '0', y2: '20', 'data-line': 'true', class: 'mjx-dotted' }),
  ], { style: 'vertical-align: -0.6ex;' }))
  const markup = serializeMathSvg(result, '#123456')
  assert.match(markup, /stroke-width="3"/)
  assert.match(markup, /stroke-width="70"/)
  assert.match(markup, /fill="none"/)
  assert.match(markup, /stroke-dasharray="140"/)
  assert.match(markup, /stroke-dasharray="0 140"/)
  assert.match(markup, /stroke-linecap="round"/)
  assert.match(markup, /fill="#123456"/)
  assert.doesNotMatch(markup, /currentColor|class=|data-|style=|href|\bid=/)
})

test('glyph stroke thickening does not change non-glyph paths or explicit stroke widths', () => {
  const result = validateMathSvg(svg([
    element('g', { 'stroke-width': '0' }, [
      element('path', { d: 'M0 0L20 30Z', 'data-c': '41' }),
      element('path', { d: 'M0 0L20 30Z' }),
      element('path', { d: 'M0 0L20 30Z', 'data-c': '42', 'stroke-width': '5' }),
    ]),
  ]))
  const group = result.svg.children[0]
  assert.ok(typeof group === 'object')
  const widths = group.children.map((child) => typeof child === 'object' && child.attributes['stroke-width'])
  assert.deepEqual(widths, ['3', undefined, '5'])
  assert.doesNotMatch(serializeMathSvg(result), /class=|data-/)
})

test('only outer dimensions can use font-relative units; child geometry cannot depend on page fonts', () => {
  const result = validateMathSvg(svg([
    element('rect', { x: '2px', y: '3', width: '40px', height: '50', 'stroke-width': '3px' }),
  ], { width: '3ex', height: '1.2em' }))
  assert.equal(result.svg.attributes.width, '1.5em')
  assert.equal(result.svg.attributes.height, '1.2em')
  for (const attributes of [
    { x: '1em' }, { y: '2ex' }, { width: '1em' }, { height: '2ex' },
    { 'stroke-width': '1em' }, { style: 'stroke-width: 1ex;' },
  ]) fails(svg([element('rect', attributes)]), 'output')
})

test('foreground painting preserves formula colors and cannot mutate reusable geometry', () => {
  const result = validateMathSvg(svg([
    element('g', { fill: 'currentColor', stroke: 'currentColor' }, [element()]),
    element('g', { fill: 'red', stroke: '#00ff00' }, [element()]),
  ]))
  const first = paintMathSvg(result, '#123456')
  const second = paintMathSvg(result, '#abcdef')
  assert.notEqual(first, second)
  assert.match(serializeMathSvg(result, '#123456'), /fill="#123456"/)
  assert.match(serializeMathSvg(result, '#abcdef'), /fill="#abcdef"/)
  assert.match(serializeMathSvg(result, '#abcdef'), /fill="red" stroke="#00ff00"/)
  assert.ok(Object.isFrozen(result))
  assert.ok(Object.isFrozen(result.svg))
  assert.ok(Object.isFrozen(result.svg.attributes))
  assert.ok(Object.isFrozen(result.svg.children))
  assert.ok(Object.isFrozen(first.attributes))
  assert.ok(Object.isFrozen(first.children))
  assert.equal(Reflect.set(result.svg.attributes, 'fill', 'orange'), false)
})

test('unknown math glyph text is rejected because its estimated font metrics cannot establish actual bounds', () => {
  const literal = '<script> "quoted" & \'single\' 日本'
  fails(svg([element('text', { 'font-family': 'serif', 'font-size': '884px', transform: 'scale(1,-1)' }, [literal])]), 'output')
})

test('unknown elements, events, IDs, hrefs, resource paints, and unsupported CSS reject the whole SVG', () => {
  for (const child of [
    element('script', {}), element('foreignObject', {}), element('image', {}), element('use', {}),
    element('a', {}), element('circle', {}), element('g', { onload: 'alert(1)' }),
    element('g', { id: 'shared' }), element('g', { href: '#glyph' }),
    element('g', { href: 'https://example.com/font.svg#glyph' }),
    element('g', { fill: 'url(#glyph)' }), element('g', { stroke: 'url(https://example.com/)' }),
    element('g', { style: 'color: var(--color)' }), element('g', { style: '@import: external' }),
    element('g', { style: 'display: none' }), element('g', { class: 'hidden-by-page-css' }),
    element('g', { fill: 'definitelynotacolor' }), element('g', { madeup: 'yes' }),
  ]) fails(svg([element(), child]), 'output')
})

test('non-finite, negative, malformed, or implausibly large bounds cannot become successful metrics', () => {
  for (const viewBox of ['0 NaN 1 2', '0 -Infinity 1 2', '0 0 -1 2', '0 0 1 -2', '0 0 1 0', '0 0 1', '0 0 1e100 2', '']) {
    fails(svg([], { viewBox }), 'invalid-metrics')
  }
  for (const attributes of [{ d: 'M0 0 LInfinity 3' }, { d: 'M0 0<script>' }, { d: 'M0' }, { d: 'M0 0Q1 2 3' }, { d: 'M0 0A1 2 3 4 5 6 7' }, { d: 'javascript:alert(1)' }, { transform: 'translate(NaN,0)' }, { transform: 'translate(1,2,3)' }]) {
    assert.throws(() => validateMathSvg(svg([element('path', attributes)])), LabelSvgError)
  }
})

test('finite limits bound nodes, paths, depth, and attribute storage', () => {
  for (const [raw, limits] of [
    [svg([element(), element()]), { ...DEFAULT_SVG_LIMITS, maxNodes: 2 }],
    [svg([element(), element()]), { ...DEFAULT_SVG_LIMITS, maxPaths: 1 }],
    [svg([element('g', {}, [element('g', {}, [element()])])]), { ...DEFAULT_SVG_LIMITS, maxDepth: 2 }],
    [svg([element()]), { ...DEFAULT_SVG_LIMITS, maxAttributeCharacters: 30 }],
  ] as const) {
    assert.throws(() => validateMathSvg(raw, limits), (error: unknown) => error instanceof LabelSvgError && error.category === 'work-limit')
  }
})

test('safe geometry is reusable without IDs or placement-dependent state', () => {
  const result = validateMathSvg(svg([element()]))
  const first = serializeMathSvg(result)
  const second = serializeMathSvg(result)
  assert.equal(first, second)
  assert.doesNotMatch(first, /\bid=|href|url\(|<defs|<use/)
})
