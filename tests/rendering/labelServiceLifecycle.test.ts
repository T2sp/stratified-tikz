import assert from 'node:assert/strict'
import test from 'node:test'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { LabelMetricsError, type LabelLayoutSettings, type TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { MATHJAX_IDENTITY, type MathLabelEngine } from '../../src/rendering/labels/mathjaxEngine.ts'
import { type RawSvgElement } from '../../src/rendering/labels/labelSvg.ts'

const settings: LabelLayoutSettings = {
  font: { family: 'Test Serif', sizePx: 20, weight: '400', style: 'normal', fontReadinessGeneration: 0 },
  tabSize: 4,
  lineGapEm: 0.2,
}
const measurement: TextMeasurementProvider = {
  identity: 'lifecycle-deterministic',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2, ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const svg: RawSvgElement = {
  tag: 'svg', attributes: { viewBox: '0 -800 1000 1000' }, children: [
    { tag: 'path', attributes: { d: 'M0 0L100 100Z' }, children: [] },
  ],
}
const engine: MathLabelEngine = {
  identity: MATHJAX_IDENTITY,
  convert: async (runs) => runs.map(() => ({ svg })),
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve))

test('in-flight settings are snapshots; later font edits cannot change earlier request geometry or metrics', async () => {
  const loader = deferred<MathLabelEngine>()
  const observed: LabelLayoutSettings['font'][] = []
  const service = createLabelService({
    measurement: { ...measurement, measure: (text, font) => { observed.push(font); return measurement.measure(text, font) } },
    loadEngine: () => loader.promise,
  })
  const mutable = { ...settings, font: { ...settings.font } }
  const first = service.convert('A $x$', mutable)
  mutable.font.sizePx = 40
  mutable.font.family = 'Changed Serif'
  mutable.font.fontReadinessGeneration = 2
  mutable.tabSize = 8
  loader.resolve(engine)
  const before = await first
  const after = await service.convert('A $x$', mutable)
  assert.equal(before.kind, 'success')
  assert.equal(after.kind, 'success')
  assert.notEqual(before.identity, after.identity)
  assert.equal(observed[0]?.sizePx, 20)
  assert.equal(observed[0]?.family, 'Test Serif')
  assert.equal(observed[1]?.sizePx, 40)
  assert.equal(observed[1]?.family, 'Changed Serif')
  assert.equal(Object.isFrozen(observed[0]), true)
})

test('bounded abandoned loaders settle all requests, stop launching work at the cap, and recover when late resources settle', async () => {
  const loaders = [deferred<MathLabelEngine>(), deferred<MathLabelEngine>()]
  let loads = 0
  const service = createLabelService({ measurement, limits: { unsettledTasks: 2, settlementMs: 10, retryDelayMs: 0 },
    loadEngine: () => loaders[loads++]?.promise ?? Promise.resolve(engine) })
  try {
    for (const source of ['$first$', '$second$']) {
      const result = await service.convert(source, settings)
      assert.equal(result.kind === 'fallback' && result.reason, 'timeout')
    }
    const exhausted = await service.convert('  $third$\n', settings)
    assert.equal(exhausted.kind === 'fallback' && exhausted.reason, 'limit')
    assert.equal(exhausted.source, '  $third$\n')
    assert.equal(loads, 2)
    assert.equal(service.stats().pending, 0)
    assert.equal(service.stats().unsettledTasks, 2)
    loaders[0].resolve(engine)
    await nextTurn()
    assert.equal((await service.convert('$third$', settings)).kind, 'success')
    assert.equal(loads, 3)
  } finally {
    loaders.forEach((loader) => loader.resolve(engine))
    await nextTurn()
  }
  assert.equal(service.stats().unsettledTasks, 0)
})

test('exhausted math-loader work does not block new ordinary-text labels', async () => {
  const loader = deferred<MathLabelEngine>()
  const service = createLabelService({ measurement, limits: { unsettledTasks: 1, settlementMs: 10, retryDelayMs: 0 },
    loadEngine: () => loader.promise })
  try {
    assert.equal((await service.convert('$pending$', settings)).kind, 'fallback')
    const plain = await service.convert('領域 \t new text', settings)
    assert.equal(plain.kind, 'success')
    assert.equal(plain.source, '領域 \t new text')
  } finally {
    loader.resolve(engine)
    await nextTurn()
  }
})

test('plain-text font failures respect controlled retry rather than reloading on every render', async () => {
  let attempts = 0
  let ready = false
  const service = createLabelService({ measurement: { ...measurement, ready: async () => {
    attempts++
    if (!ready) throw new Error('Font resource unavailable')
  } } })
  const first = await service.convert('ordinary text', settings)
  const second = await service.convert('ordinary text', settings)
  assert.equal(first.kind === 'fallback' && first.reason, 'resource-error')
  assert.equal(second.kind === 'fallback' && second.reason, 'resource-error')
  assert.equal(attempts, 1)
  ready = true
  service.invalidate()
  assert.equal((await service.convert('ordinary text', settings)).kind, 'success')
  assert.equal(attempts, 2)
})

test('timeout during font readiness releases the current request and late readiness cannot replace a fresh result', async () => {
  const font = deferred<void>()
  let readiness = 0
  const service = createLabelService({
    measurement: { ...measurement, ready: () => ++readiness === 1 ? font.promise : Promise.resolve() },
    limits: { settlementMs: 10 },
  })
  const previous = await service.convert('same source', settings)
  assert.equal(previous.kind === 'fallback' && previous.reason, 'timeout')
  service.invalidate()
  const fresh = await service.convert('same source', settings)
  assert.equal(fresh.kind, 'success')
  assert.notEqual(fresh.generation, previous.generation)
  font.resolve()
  await nextTurn()
  assert.equal(await service.convert('same source', settings), fresh)
  assert.equal(service.stats().unsettledTasks, 0)
})

test('invalidation settles pending consumers before initialization finishes and preserves replacement cache', async () => {
  const oldLoader = deferred<MathLabelEngine>()
  let loads = 0
  let obsoleteConversions = 0
  const service = createLabelService({ measurement,
    loadEngine: () => ++loads === 1 ? oldLoader.promise : Promise.resolve(engine) })
  const oldGeneration = service.generation
  const pending = service.convert('$same$', settings)
  // Let the initializer start so it really belongs to the retired generation.
  await nextTurn()
  service.invalidate()
  const obsolete = await pending
  assert.equal(obsolete.kind === 'fallback' && obsolete.reason, 'resource-error')
  assert.equal(obsolete.generation, oldGeneration)
  const fresh = await service.convert('$same$', settings)
  assert.equal(fresh.kind, 'success')
  oldLoader.resolve({ ...engine, convert: async () => { obsoleteConversions++; return [{ svg }] } })
  await nextTurn()
  assert.equal(obsoleteConversions, 0)
  assert.equal(await service.convert('$same$', settings), fresh)
  assert.equal(service.stats().unsettledTasks, 0)
})

test('a throwing diagnostic observer never rejects the public result Promise or poisons retries', async () => {
  let loads = 0
  const service = createLabelService({ measurement,
    onDiagnostic: () => { throw new Error('Development observer failed') },
    loadEngine: async () => { if (++loads === 1) throw new Error('Resource unavailable'); return engine },
  })
  const source = ' \t$failed$\n '
  const failed = await service.convert(source, settings)
  assert.equal(failed.kind === 'fallback' && failed.reason, 'resource-error')
  assert.equal(failed.source, source)
  service.invalidate()
  assert.equal((await service.convert('$valid$', settings)).kind, 'success')
})

test('measurement exceptions are scoped to their label and latest raw source remains authoritative', async () => {
  const service = createLabelService({ measurement: { ...measurement, measure: (text, font) => {
    if (text.includes('bad')) throw new LabelMetricsError('invalid-metrics', 'Invalid platform measurement')
    return measurement.measure(text, font)
  } } })
  const source = ' bad \t\n '
  const [bad, good] = await Promise.all([service.convert(source, settings), service.convert('good', settings)])
  assert.equal(bad.kind === 'fallback' && bad.reason, 'invalid-metrics')
  assert.equal(bad.source, source)
  assert.equal(good.kind, 'success')
  assert.equal((await service.convert('good', settings)).identity, good.identity)
})

test('synchronous platform-font failures use the same controlled retry as font readiness rejection', async () => {
  let attempts = 0
  let failed = true
  const service = createLabelService({ measurement: { ...measurement, measure: (text, font) => {
    attempts++
    if (failed) throw new LabelMetricsError('font', 'Canvas font metrics unavailable')
    return measurement.measure(text, font)
  } } })
  const first = await service.convert('ordinary text', settings)
  const second = await service.convert('ordinary text', settings)
  assert.equal(first.kind === 'fallback' && first.reason, 'resource-error')
  assert.equal(second.kind === 'fallback' && second.reason, 'resource-error')
  assert.equal(attempts, 1)
  failed = false
  service.invalidate()
  assert.equal((await service.convert('ordinary text', settings)).kind, 'success')
})
