import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPointNodeTextLayoutMeasurer,
  getPointNodeTextLayout,
  maxSvgPointNodeTextLayoutCacheSize,
  svgPointNodeTextFontSize,
} from '../../src/rendering/svgPointNodeText.ts'

test('missing and whitespace-only point text have no content dimensions', () => {
  const measure = createPointNodeTextLayoutMeasurer(() => {
    assert.fail('empty text does not need font measurement')
  })

  for (const text of [undefined, '', '  \r\n\t ']) {
    assert.deepEqual(measure(text), {
      text: '',
      width: 0,
      height: 0,
      baselineOffset: 0,
    })
  }
})

test('measured ink bounds center ascenders and descenders around the node', () => {
  const measure = createPointNodeTextLayoutMeasurer(() => ({
    width: 29,
    actualBoundingBoxAscent: 9,
    actualBoundingBoxDescent: 3,
  }))
  const layout = measure('Big')

  assert.deepEqual(layout, {
    text: 'Big',
    width: 29,
    height: 12,
    baselineOffset: 3,
  })
  assert.equal(layout.baselineOffset - 9, -layout.height / 2)
  assert.equal(layout.baselineOffset + 3, layout.height / 2)
})

test('ink entirely above the baseline keeps its negative descent', () => {
  const measure = createPointNodeTextLayoutMeasurer(() => ({
    width: 4,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: -5,
  }))

  assert.deepEqual(measure("'"), {
    text: "'",
    width: 4,
    height: 3,
    baselineOffset: 6.5,
  })
})

test('preview normalizes only ASCII whitespace and preserves literal TeX source', () => {
  const measuredTexts: string[] = []
  const measure = createPointNodeTextLayoutMeasurer((text) => {
    measuredTexts.push(text)
    return null
  })
  const raw = ' \t$F^{(1)}L$\r\n  \\alpha\t\u00a0\u3000 '
  const normalized = '$F^{(1)}L$ \\alpha \u00a0\u3000'

  assert.equal(measure(raw).text, normalized)
  assert.deepEqual(measuredTexts, [normalized])
})

test('fallback reflects text length, narrow/wide glyphs and descenders', () => {
  const measure = createPointNodeTextLayoutMeasurer(() => null)

  assert.ok(measure('longer node').width > measure('node').width)
  assert.ok(measure('WWW').width > measure('iii').width)
  assert.ok(measure('Hg').height > measure('H').height)
  assert.ok(measure('H').height > measure('x').height)
  assert.equal(measure('図').width, svgPointNodeTextFontSize)
  assert.equal(measure('🙂').width, svgPointNodeTextFontSize)
  assert.equal(measure('e\u0301').width, measure('e').width)
  assert.deepEqual(measure('sample'), measure('sample'))
})

test('Node and SSR rendering needs no document or canvas', () => {
  const layout = getPointNodeTextLayout('node')

  assert.equal(layout.text, 'node')
  assert.ok(layout.width > 0)
  assert.ok(layout.height > 0)
  assert.ok(Number.isFinite(layout.baselineOffset))
})

test('older canvas implementations retain measured widths without ink bounds', () => {
  const measure = createPointNodeTextLayoutMeasurer(() => ({ width: 37 }))
  const fallback = createPointNodeTextLayoutMeasurer(() => null)('Hgj')
  const layout = measure('Hgj')

  assert.equal(layout.width, 37)
  assert.equal(layout.height, fallback.height)
  assert.equal(layout.baselineOffset, fallback.baselineOffset)
})

test('unavailable or invalid canvas metrics fall back to finite dimensions', () => {
  const fallback = createPointNodeTextLayoutMeasurer(() => null)('node')
  const invalid = createPointNodeTextLayoutMeasurer(() => ({
    width: Number.NaN,
    actualBoundingBoxAscent: Number.POSITIVE_INFINITY,
    actualBoundingBoxDescent: -1,
  }))
  const unavailable = createPointNodeTextLayoutMeasurer(() => {
    throw new Error('canvas unavailable')
  })

  assert.deepEqual(invalid('node'), fallback)
  assert.deepEqual(unavailable('node'), fallback)
})

test('text layout cache is bounded and keeps recently rendered nodes', () => {
  const measured: string[] = []
  const measure = createPointNodeTextLayoutMeasurer((text) => {
    measured.push(text)
    return { width: 10 }
  })

  measure('keep')
  measure('evict')

  for (let index = 0; index < maxSvgPointNodeTextLayoutCacheSize - 2; index++) {
    measure(`node ${index}`)
  }

  measure('keep')
  measure('new node')
  measure('keep')
  measure('evict')

  assert.equal(measured.filter((text) => text === 'keep').length, 1)
  assert.equal(measured.filter((text) => text === 'evict').length, 2)
})

test('cache keys use preview text and very large contents are not retained', () => {
  let measurements = 0
  const measure = createPointNodeTextLayoutMeasurer(() => {
    measurements++
    return null
  })

  measure('node  text')
  measure(' node\ntext ')
  assert.equal(measurements, 1)

  const largeText = 'a'.repeat(10000)
  measure(largeText)
  measure(largeText)
  assert.equal(measurements, 3)
})
