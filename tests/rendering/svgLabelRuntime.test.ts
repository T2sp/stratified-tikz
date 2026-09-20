import assert from 'node:assert/strict'
import test from 'node:test'
import { createLabelService, type LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import { type TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { MATHJAX_IDENTITY, type MathLabelEngine } from '../../src/rendering/labels/mathjaxEngine.ts'
import { svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelController, createSvgLabelRuntime, initialSvgLabelState, type SvgLabelRequest } from '../../src/rendering/labels/svgLabelRuntime.ts'

const measurement: TextMeasurementProvider = {
  identity: 'svg-runtime-test',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2,
    ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const settings = svgLabelLayoutSettings(20)
const request = (source: string): SvgLabelRequest => ({ source, settings })
const engine: MathLabelEngine = {
  identity: MATHJAX_IDENTITY,
  convert: async (runs) => runs.map(() => ({ advanceWidth: 1,
    svg: { tag: 'svg', attributes: { viewBox: '0 -800 1000 1000' }, children: [
      { tag: 'path', attributes: { d: 'M0 0L100 100Z' }, children: [] },
    ] } })),
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (value: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve))

test('completion inversion and obsolete failure cannot replace the current successful revision', async () => {
  const base = createLabelService({ measurement, loadEngine: async () => engine })
  const oldResult = await base.convert('$old$', settings)
  const newResult = await base.convert('$new$', settings)
  const old = deferred<LabelConversionResult>()
  const newer = deferred<LabelConversionResult>()
  const runtime = createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined, convert: (source) => source === '$old$' ? old.promise : newer.promise,
  } })
  const controller = createSvgLabelController(runtime)
  const oldCleanup = controller.start(request('$old$'))
  await nextTurn()
  oldCleanup()
  const cleanup = controller.start(request('$new$'))
  assert.equal(controller.getSnapshot()?.source, '$new$')
  assert.equal(controller.getSnapshot()?.status, 'pending')
  newer.resolve(newResult)
  await nextTurn()
  assert.equal(controller.getSnapshot()?.status, 'ready')
  old.resolve(oldResult)
  await nextTurn()
  assert.equal(controller.getSnapshot()?.source, '$new$')
  assert.equal(controller.getSnapshot()?.result, newResult)
  cleanup()

  const rejected = deferred<LabelConversionResult>()
  const rejectRuntime = createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined, convert: (source) => source === '$old$' ? rejected.promise : Promise.resolve(newResult),
  } })
  const second = createSvgLabelController(rejectRuntime)
  const obsolete = second.start(request('$old$'))
  await nextTurn()
  obsolete()
  second.start(request('$new$'))
  await nextTurn()
  rejected.reject(new Error('obsolete output failure'))
  await nextTurn()
  assert.equal(second.getSnapshot()?.result, newResult)
})

test('valid-invalid-valid immediately displays each latest source and reuses an exact cached result', async () => {
  let conversions = 0
  const service = createLabelService({ measurement, loadEngine: async () => ({ ...engine,
    convert: (runs) => { conversions++; return engine.convert(runs) },
  }) })
  const runtime = createSvgLabelRuntime({ measurement, service })
  const controller = createSvgLabelController(runtime)
  controller.start(request('$F^{(1)}L$'))
  await nextTurn()
  const ready = controller.getSnapshot()
  assert.equal(ready?.status, 'ready')
  const invalid = request('  $unclosed\t\r\n <&> ')
  const immediate = initialSvgLabelState(invalid, runtime)
  assert.equal(immediate.source, invalid.source)
  assert.equal(immediate.status, 'pending')
  controller.start(invalid)
  await nextTurn()
  assert.equal(controller.getSnapshot()?.status, 'fallback')
  assert.equal(controller.getSnapshot()?.source, invalid.source)
  const again = initialSvgLabelState(request('$F^{(1)}L$'), runtime)
  assert.equal(again.status, 'ready')
  assert.equal(again.result, ready?.result)
  controller.start(request('$F^{(1)}L$'))
  await nextTurn()
  assert.equal(conversions, 1)
})

test('deleted/unmounted controllers and documents reusing IDs do not publish stale results', async () => {
  const service = createLabelService({ measurement, loadEngine: async () => engine })
  const firstResult = await service.convert('$first$', settings)
  const pending = deferred<LabelConversionResult>()
  const runtime = createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined, convert: () => pending.promise,
  } })
  const deleted = createSvgLabelController(runtime)
  let notifications = 0
  const unsubscribe = deleted.subscribe(() => notifications++)
  const cleanup = deleted.start(request('$first$'))
  await nextTurn()
  cleanup()
  unsubscribe()
  const importedSameId = createSvgLabelController(runtime)
  importedSameId.start(request('new document source'))
  const before = notifications
  pending.resolve(firstResult)
  await nextTurn()
  assert.equal(notifications, before)
  assert.equal(importedSameId.getSnapshot()?.source, 'new document source')
  assert.notEqual(importedSameId.getSnapshot()?.status, 'ready')
})

test('font changes remeasure, duplicates share immutable results, and geometry compilation stays cached', async () => {
  let conversions = 0
  const service = createLabelService({ measurement, loadEngine: async () => ({ ...engine,
    convert: (runs) => { conversions++; return engine.convert(runs) },
  }) })
  const runtime = createSvgLabelRuntime({ measurement, service })
  const first = createSvgLabelController(runtime)
  const second = createSvgLabelController(runtime)
  first.start(request('日本語 $x$'))
  second.start(request('日本語 $x$'))
  await nextTurn()
  assert.equal(first.getSnapshot()?.result, second.getSnapshot()?.result)
  assert.ok(Object.isFrozen(first.getSnapshot()?.result))
  const oldResult = first.getSnapshot()?.result
  first.start({ source: '日本語 $x$', settings: svgLabelLayoutSettings(40, 'Other Serif', 1) })
  await nextTurn()
  assert.equal(first.getSnapshot()?.status, 'ready')
  assert.notEqual(first.getSnapshot()?.result, oldResult)
  assert.equal(conversions, 1)
})

test('parse, output, loading, input-limit and measurement failure leave full finite literal fallback', async () => {
  for (const [source, loadEngine, provider] of [
    ['  $unclosed\t\r\n<&> ', async () => engine, measurement],
    ['$x$', async () => ({ ...engine, convert: async () => { throw new Error('output failed') } }), measurement],
    ['$x$', async () => { throw new Error('load failed') }, measurement],
    ['x'.repeat(16_385), async () => engine, measurement],
    ['$x$', async () => engine, { ...measurement, measure: () => { throw new Error('measure failed') },
      lineMetrics: () => { throw new Error('font failed') } }],
  ] as const) {
    const runtime = createSvgLabelRuntime({ measurement: provider,
      service: createLabelService({ measurement: provider, loadEngine }) })
    const controller = createSvgLabelController(runtime)
    controller.start(request(source))
    await nextTurn()
    const state = controller.getSnapshot()!
    assert.equal(state.source, source)
    assert.equal(state.status, 'fallback')
    assert.equal(state.layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join(''), source)
    assert.ok(Object.values(state.layout.bounds).every(Number.isFinite))
  }
})
