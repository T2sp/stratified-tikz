import assert from 'node:assert/strict'
import test from 'node:test'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { type LabelLayoutSettings, type TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { MATHJAX_IDENTITY } from '../../src/rendering/labels/mathjaxConfig.ts'
import { type MathLabelEngine, MathJaxFailure } from '../../src/rendering/labels/mathjaxEngine.ts'
import { serializeMathSvg, type RawSvgElement } from '../../src/rendering/labels/labelSvg.ts'

export const settings: LabelLayoutSettings = Object.freeze({
  font: Object.freeze({ family: 'Arial', sizePx: 20, weight: 'normal', style: 'normal', fontReadinessGeneration: 0 }),
  tabSize: 4, lineGapEm: 0.2,
})
export const measurement: TextMeasurementProvider = {
  identity: 'deterministic',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2, ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const validSvg = (): RawSvgElement => ({
  tag: 'svg', attributes: { viewBox: '0 -800 1000 1000', width: '2ex', height: '2ex' },
  children: [{ tag: 'g', attributes: { fill: 'currentColor', stroke: 'currentColor' }, children: [
    { tag: 'path', attributes: { d: 'M0 0L100 100Z', 'data-c': '78' }, children: [] },
  ] }],
})
function fakeEngine(convert?: MathLabelEngine['convert']): MathLabelEngine {
  return { identity: MATHJAX_IDENTITY, convert: convert ?? (async (runs) => runs.map(() => ({ svg: validSvg() }))) }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test('Unicode/text, parser failures, unsupported state and parser limits never initialize', async () => {
  let loads = 0
  const service = createLabelService({ measurement, loadEngine: async () => { loads++; return fakeEngine() } })
  for (const source of ['領域 🙂 < > & "', '', ' \t\n']) assert.equal((await service.convert(source, settings)).kind, 'success')
  for (const source of [' $x', '\\textbf{x}', 'x'.repeat(16_385), '$\\require{html}$', '$\\def\\x{1}$']) {
    const result = await service.convert(source, settings)
    assert.equal(result.kind, 'fallback')
    assert.equal(result.source, source)
  }
  assert.equal(loads, 0)
})

test('all delimiters pass complete bodies and modes; ordered text whitespace and math newlines survive', async () => {
  const seen: { tex: string; display: boolean }[][] = []
  const service = createLabelService({ measurement, loadEngine: async () => fakeEngine(async (runs) => {
    seen.push([...runs]); return runs.map(() => ({ svg: validSvg() }))
  }) })
  const source = ' 領域 $x$  \t\\(y\\)\n$$a\nb$$ \\[z\\] '
  const result = await service.convert(source, settings)
  assert.equal(result.kind, 'success')
  if (result.kind !== 'success') return
  assert.deepEqual(seen, [[{ tex: 'x', display: false }, { tex: 'y', display: false },
    { tex: 'a\nb', display: true }, { tex: 'z', display: true }]])
  assert.deepEqual(result.runs.map((run) => run.kind === 'text' ? run.text : run.tex), [' 領域 ', 'x', '  \t', 'y', '\n', 'a\nb', ' ', 'z', ' '])
  assert.equal(result.layout.lines.length, 2)
  assert.ok(result.layout.placements.some((item) => item.kind === 'tab'))
})

test('resolved error geometry and a failed later math run discard the entire result', async () => {
  const source = ' \t$x$ then $y$\n '
  const service = createLabelService({ measurement, loadEngine: async () => fakeEngine(async () => [
    { svg: validSvg() }, { svg: { ...validSvg(), children: [{ tag: 'g', attributes: { 'data-mml-node': 'merror' }, children: [] }] } },
  ]) })
  const result = await service.convert(source, settings)
  assert.equal(result.kind, 'fallback')
  assert.equal(result.source, source)
  assert.equal(result.kind === 'fallback' && result.reason, 'tex-error')
  assert.equal('runs' in result, false)
})

test('sync throw, async rejection and hook failures do not poison following conversions', async () => {
  for (const reason of ['tex-error', 'output-error', 'resource-error', 'limit'] as const) {
    let fail = true
    const service = createLabelService({ measurement, loadEngine: async () => fakeEngine((runs) => {
      if (fail) { fail = false; throw new MathJaxFailure(reason, 'development diagnostics') }
      return Promise.resolve(runs.map(() => ({ svg: validSvg() })))
    }) })
    const result = await service.convert(' $bad$ \n', settings)
    assert.equal(result.kind === 'fallback' && result.reason, reason)
    service.invalidate()
    assert.equal((await service.convert('$good$', settings)).kind, 'success')
  }
  const service = createLabelService({ measurement, loadEngine: async () => fakeEngine(async () => { throw new Error('reject') }) })
  assert.equal((await service.convert('$x$', settings)).kind, 'fallback')
})

test('same requests coalesce, different requests retain their own identity and errors', async () => {
  let loads = 0
  let conversions = 0
  const ready = deferred<MathLabelEngine>()
  const service = createLabelService({ measurement, loadEngine: () => { loads++; return ready.promise } })
  const first = service.convert('$x$', settings)
  assert.equal(service.convert('$x$', settings), first)
  const second = service.convert('$y$', settings)
  const bad = service.convert('$bad$', settings)
  ready.resolve(fakeEngine(async (runs) => {
    conversions++
    if (runs[0].tex === 'bad') throw new MathJaxFailure('tex-error', 'bad')
    return runs.map(() => ({ svg: validSvg() }))
  }))
  const [x, y, failure] = await Promise.all([first, second, bad])
  assert.equal(x.kind, 'success'); assert.equal(y.kind, 'success'); assert.equal(failure.kind, 'fallback')
  assert.notEqual(x.identity, y.identity)
  assert.equal(await service.convert('$x$', settings), x)
  assert.equal(loads, 1); assert.equal(conversions, 3)
})

test('font generations/layout settings recompute layout without recompiling neutral geometry', async () => {
  let conversions = 0
  const service = createLabelService({ measurement, loadEngine: async () => fakeEngine(async (runs) => {
    conversions++; return runs.map(() => ({ svg: validSvg() }))
  }) })
  const first = await service.convert('A $x$', settings)
  const second = await service.convert('A $x$', { ...settings, font: { ...settings.font, fontReadinessGeneration: 1 } })
  const third = await service.convert('A $x$', { ...settings, font: { ...settings.font, family: 'serif', weight: 'bold', style: 'italic', sizePx: 22 } })
  assert.equal(first.kind, 'success'); assert.equal(second.kind, 'success'); assert.equal(third.kind, 'success')
  assert.notEqual(first.identity, second.identity)
  assert.equal(conversions, 1)
  if (first.kind !== 'success') return
  const geometry = first.runs.find((run) => run.kind === 'math')?.geometry
  assert.ok(geometry)
  assert.match(serializeMathSvg(geometry, '#ff0000'), /#ff0000/)
  assert.match(serializeMathSvg(geometry, '#0000ff'), /#0000ff/)
  assert.equal(conversions, 1)
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.runs) && Object.isFrozen(geometry.svg.attributes))
  assert.throws(() => Object.assign(geometry.svg.attributes, { fill: 'red' }), TypeError)
  service.invalidate()
  const next = await service.convert('A $x$', settings)
  assert.notEqual(first.generation, next.generation)
  assert.equal(conversions, 2)
})

test('loader rejection, font failure, cooldown, and explicit retry', async () => {
  let loads = 0
  const service = createLabelService({ measurement, loadEngine: async () => {
    if (++loads === 1) throw new Error('network')
    return fakeEngine()
  } })
  const first = await service.convert('$x$', settings)
  assert.equal(first.kind === 'fallback' && first.reason, 'resource-error')
  await service.convert('$x$', settings)
  assert.equal(loads, 1)
  assert.equal((await service.convert('plain', settings)).kind, 'success')
  service.invalidate()
  assert.equal((await service.convert('$x$', settings)).kind, 'success')
  let ready = false
  const fonts = createLabelService({ measurement: { ...measurement, ready: async () => { if (!ready) throw new Error('font unavailable') } }, loadEngine: async () => fakeEngine() })
  const failed = await fonts.convert('領域 $x$', settings)
  assert.equal(failed.kind === 'fallback' && failed.reason, 'resource-error')
  ready = true
  fonts.invalidate()
  assert.equal((await fonts.convert('領域 $x$', settings)).kind, 'success')
})

test('timeout retires generation; late initialization cannot compile or populate replacement cache', async () => {
  const late = deferred<MathLabelEngine>()
  let loads = 0
  let oldConversions = 0
  const service = createLabelService({ measurement, limits: { settlementMs: 20 }, loadEngine: () => {
    loads++; return loads === 1 ? late.promise : Promise.resolve(fakeEngine())
  } })
  const one = service.convert('$x$', settings)
  const two = service.convert('$y$', settings)
  assert.equal((await one).kind, 'fallback')
  assert.equal((await two).kind, 'fallback')
  service.invalidate()
  const fresh = await service.convert('$x$', settings)
  assert.equal(fresh.kind, 'success')
  late.resolve(fakeEngine(async () => { oldConversions++; return [] }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(oldConversions, 0)
  assert.equal(await service.convert('$x$', settings), fresh)
  assert.equal(service.stats().unsettledTasks, 0)
})

test('late conversion cannot write cache; pending and abandoned work are finitely bounded', async () => {
  const late = deferred<readonly { svg: RawSvgElement }[]>()
  let loads = 0
  const service = createLabelService({ measurement, limits: { pendingRequests: 1, unsettledTasks: 2, settlementMs: 20 },
    loadEngine: async () => ++loads === 1 ? fakeEngine(() => late.promise) : fakeEngine() })
  const pending = service.convert('$old$', settings)
  const overflow = await service.convert('$overflow$', settings)
  assert.equal(overflow.kind === 'fallback' && overflow.reason, 'limit')
  assert.equal((await pending).kind, 'fallback')
  service.invalidate()
  const fresh = await service.convert('$old$', settings)
  assert.equal(fresh.kind, 'success')
  late.resolve([{ svg: validSvg() }])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(await service.convert('$old$', settings), fresh)
})

test('LRU entry and byte limits are enforced, cache configuration is independent', async () => {
  let conversions = 0
  const engine = fakeEngine(async (runs) => { conversions++; return runs.map(() => ({ svg: validSvg() })) })
  const service = createLabelService({ measurement, loadEngine: async () => engine, limits: { cacheEntries: 2 } })
  await service.convert('$a$', settings); await service.convert('$b$', settings)
  await service.convert('$a$', settings); await service.convert('$c$', settings)
  await service.convert('$b$', settings)
  // Layout and geometry maintain independent LRUs; b still had geometry.
  assert.equal(conversions, 3)
  await service.convert('$a$', settings)
  assert.equal(conversions, 4)
  assert.equal(service.stats().geometry.entries, 2)
  const tiny = createLabelService({ measurement, loadEngine: async () => engine, limits: { cacheBytes: 1 } })
  await tiny.convert('$a$', settings); await tiny.convert('$a$', settings)
  assert.equal(tiny.stats().geometry.entries, 0)
  assert.equal(tiny.stats().results.entries, 0)
  const changed = createLabelService({ measurement, configurationIdentity: 'other-config', loadEngine: async () => ({ ...engine, identity: 'other-config' }) })
  const result = await changed.convert('$a$', settings)
  assert.equal(result.configurationIdentity, 'other-config')
  assert.equal(result.kind, 'success')
})

test('invalid numbers, shapes, output URLs, and settings all give exact raw fallback', async () => {
  for (const svg of [
    { ...validSvg(), attributes: { viewBox: '0 0 NaN 10' } },
    { ...validSvg(), children: [{ tag: 'script', attributes: {}, children: ['alert(1)'] }] },
    { ...validSvg(), children: [{ tag: 'path', attributes: { fill: 'url(https://example.com/p)' }, children: [] }] },
  ]) {
    const service = createLabelService({ measurement, loadEngine: async () => fakeEngine(async () => [{ svg }]) })
    const source = ' \t$x$\n '
    const result = await service.convert(source, settings)
    assert.equal(result.kind, 'fallback'); assert.equal(result.source, source)
  }
  const service = createLabelService({ measurement })
  const result = await service.convert('hello', { ...settings, font: { ...settings.font, sizePx: NaN } })
  assert.equal(result.kind === 'fallback' && result.reason, 'invalid-metrics')
})
