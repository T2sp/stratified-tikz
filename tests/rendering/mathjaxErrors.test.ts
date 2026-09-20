import assert from 'node:assert/strict'
import test from 'node:test'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { createMathJaxErrorCapture, type MathLabelEngine } from '../../src/rendering/labels/mathjaxEngine.ts'
import { MATHJAX_IDENTITY } from '../../src/rendering/labels/mathjaxConfig.ts'
import type { LabelLayoutSettings, TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import type { RawSvgElement } from '../../src/rendering/labels/labelSvg.ts'

const settings: LabelLayoutSettings = {
  font: { family: 'Arial', sizePx: 16, weight: 'normal', style: 'normal', fontReadinessGeneration: 0 },
  tabSize: 4, lineGapEm: 0.2,
}
const measurement: TextMeasurementProvider = {
  identity: 'errors-fixture',
  measure: (text) => ({ width: text.length * 8, ascent: 12, descent: 4 }),
  lineMetrics: () => ({ ascent: 12, descent: 4 }),
}
const svg: RawSvgElement = {
  tag: 'svg', attributes: { viewBox: '0 -800 1000 1000', width: '2ex', height: '2ex' },
  children: [{ tag: 'path', attributes: { d: 'M0 0L10 10Z' }, children: [] }],
}

for (const hook of ['formatError', 'compileError', 'typesetError'] as const) {
  test(`${hook} remains a whole-label failure even if an intermediate caller catches it`, async () => {
    const engine: MathLabelEngine = {
      identity: MATHJAX_IDENTITY,
      convert: async (runs) => {
        const capture = createMathJaxErrorCapture()
        const output = []
        for (const run of runs) {
          if (run.tex === 'bad') {
            try {
              if (hook === 'formatError') capture.formatError(undefined, new Error('fixture'))
              else capture[hook](undefined, undefined, new Error('fixture'))
            } catch { /* Simulate a library resolving after displaying its own error geometry. */ }
          }
          output.push({ svg, advanceWidth: 1 })
        }
        capture.check()
        return output
      },
    }
    const service = createLabelService({ measurement, loadEngine: async () => engine })
    const source = ' \t$x$ then $bad$\r\n '
    const failure = await service.convert(source, settings)
    assert.equal(failure.kind, 'fallback')
    assert.equal(failure.source, source)
    assert.equal('runs' in failure, false)
    assert.equal(failure.kind === 'fallback' && failure.reason, hook === 'typesetError' ? 'output-error' : 'tex-error')
    const success = await service.convert('$x$', settings)
    assert.equal(success.kind, 'success')
  })
}

test('concurrent hook failures are scoped to their own label transaction', async () => {
  let release!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  const service = createLabelService({ measurement, loadEngine: async () => ({
    identity: MATHJAX_IDENTITY,
    convert: async (runs) => {
      const capture = createMathJaxErrorCapture()
      if (runs[0].tex === 'bad') {
        try { capture.compileError(undefined, undefined, new Error('bad')) } catch { /* captured */ }
        await wait
      }
      capture.check()
      return runs.map(() => ({ svg, advanceWidth: 1 }))
    },
  }) })
  const pending = service.convert('$bad$', settings)
  const good = await service.convert('$good$', settings)
  release()
  const bad = await pending
  assert.equal(good.kind, 'success')
  assert.equal(bad.kind, 'fallback')
  assert.notEqual(good.identity, bad.identity)
})

test('sync and asynchronous unexpected failures and invalid output shapes settle through adapter', async () => {
  const fixtures: MathLabelEngine['convert'][] = [
    () => { throw new Error('sync') },
    async () => { throw new Error('async') },
    async () => [],
    // This unknown cast deliberately models an untyped library boundary.
    async () => null as unknown as Awaited<ReturnType<MathLabelEngine['convert']>>,
    async () => [{ svg: undefined as unknown as RawSvgElement, advanceWidth: 1 }],
  ]
  for (const fail of fixtures) {
    let calls = 0
    const service = createLabelService({ measurement, loadEngine: async () => ({
      identity: MATHJAX_IDENTITY,
      convert: (runs) => ++calls === 1 ? fail(runs) : Promise.resolve(runs.map(() => ({ svg, advanceWidth: 1 }))),
    }) })
    const source = ' \t$x$\n '
    const result = await service.convert(source, settings)
    assert.equal(result.kind, 'fallback')
    assert.equal(result.source, source)
    assert.equal((await service.convert('$y$', settings)).kind, 'success')
  }
})

test('MathJax plain TexError limit IDs differ from similarly worded ordinary syntax errors', async () => {
  for (const [id, expected] of [
    ['MaxBufferSize', 'limit'], ['MaxMacroSub1', 'limit'], ['MaxMacroSub2', 'limit'],
    ['MaxTemplateSubs', 'limit'], ['MaxColumns', 'limit'], ['TooManyAligns', 'tex-error'],
  ]) {
    const service = createLabelService({ measurement, loadEngine: async () => ({
      identity: MATHJAX_IDENTITY,
      convert: async () => {
        const capture = createMathJaxErrorCapture()
        // Installed MathJax TexError deliberately does not extend Error.
        capture.formatError(undefined, { id, message: 'Too many alignment characters' })
        return []
      },
    }) })
    const source = ' \t$x$\n '
    const result = await service.convert(source, settings)
    assert.equal(result.kind === 'fallback' && result.reason, expected, id)
    assert.equal(result.source, source)
  }
})
