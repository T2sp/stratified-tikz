import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyTwoDimensionalDiagram } from '../../src/examples/index.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { defaultLabelStyle } from '../../src/model/styles.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { createLabelService, type LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { MATHJAX_IDENTITY, type MathLabelEngine } from '../../src/rendering/labels/mathjaxEngine.ts'
import { placeSvgLabel, svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelRuntime, initialSvgLabelState, type SvgLabelRuntime, type SvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { captureSvgLabelExport, getSvgLabelExportCapture, registerSvgLabelExportCapture, type SvgLabelExportCapture } from '../../src/rendering/svgLabelExportRegistry.ts'
import { SvgTexLabelView } from '../../src/rendering/svgLabelView.ts'
import { createSvgExportController, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { createDiagramHistory } from '../../src/ui/undo.ts'
import type { SvgPreviewBackgroundMode } from '../../src/ui/svgPreviewExport.ts'

const measurement: TextMeasurementProvider = {
  identity: 'settled-export-fixture',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2,
    ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const engine: MathLabelEngine = {
  identity: MATHJAX_IDENTITY,
  convert: async (runs) => runs.map(() => ({ advanceWidth: 1,
    svg: { tag: 'svg', attributes: { viewBox: '0 -800 1000 1000' }, children: [
      { tag: 'path', attributes: { d: 'M0 0L100 100Z' }, children: [] },
    ] } })),
}
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve))
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function runtime(): SvgLabelRuntime {
  return createSvgLabelRuntime({ measurement,
    service: createLabelService({ measurement, loadEngine: async () => engine }) })
}
function capture(source: string, labelRuntime: SvgLabelRuntime, overrides: Partial<SvgLabelExportCapture> = {}): SvgLabelExportCapture {
  return captureSvgLabelExport({ source, runtime: labelRuntime,
    position: { x: 123, y: 87 }, fontSize: 20, color: '#2456ab', opacity: 0.65,
    anchor: 'center', settings: svgLabelLayoutSettings(20), ...overrides })
}
function markup(captured: SvgLabelExportCapture, state: SvgLabelState): string {
  return renderToStaticMarkup(createElement(SvgTexLabelView, { capture: captured, state }))
}
function literal(state: SvgLabelState): string {
  return state.layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join('')
}

test('several pending free/path labels all settle before export and deferred live commits are irrelevant', async () => {
  const base = runtime()
  const sources = ['$a$', '$b$', '日本語 $c$']
  const results = await Promise.all(sources.map((source) => base.service.convert(source, svgLabelLayoutSettings(20))))
  const deferredResults = sources.map(() => deferred<LabelConversionResult>())
  const calls: string[] = []
  const held = createSvgLabelRuntime({ measurement, service: { peek: () => undefined,
    convert: (source) => { calls.push(source); return deferredResults[sources.indexOf(source)].promise } } })
  const captures = sources.map((source, index) => capture(source, held, {
    ownerIdentity: index === 0 ? 'doc/free/a' : `doc/path/owner-${index}/shared`,
    outline: index > 0 ? { color: '#ffffff', width: 3 } : undefined,
  }))
  // This represents the currently committed live tree; no render-commit update
  // is delivered when conversion resolves. Export must render its own results.
  const liveStates = captures.map((item) => initialSvgLabelState(item, held))
  const liveMarkup = captures.map((item, index) => markup(item, liveStates[index]))
  let complete = false
  const pending = settleSvgExportLabels(captures).then((states) => { complete = true; return states })
  await nextTurn()
  assert.deepEqual(calls, sources)
  deferredResults[2].resolve(results[2])
  deferredResults[0].resolve(results[0])
  await nextTurn()
  assert.equal(complete, false)
  deferredResults[1].resolve(results[1])
  const states = await pending
  assert.deepEqual(states.map((state) => state.status), ['ready', 'ready', 'ready'])
  for (const [index, state] of states.entries()) {
    const output = markup(captures[index], state)
    assert.match(output, /<path /)
    assert.doesNotMatch(output, /data-label-literal=/)
    assert.equal(liveStates[index].status, 'pending')
    assert.equal(markup(captures[index], liveStates[index]), liveMarkup[index])
    assert.doesNotMatch(liveMarkup[index], /<path /)
  }
})

test('ordinary, successful, malformed, and resource-failed labels coexist with complete isolated fallback', async () => {
  const base = runtime()
  const resourceSource = '  resource $x$\t<&>\n end  '
  const malformedSource = '  malformed $x\t<&>\n end  '
  const failedRuntime = createSvgLabelRuntime({ measurement,
    service: createLabelService({ measurement, loadEngine: async () => { throw new Error('unavailable') } }) })
  const captures = [capture('Region 日本語', base), capture('$x^2$', base),
    capture(malformedSource, base), capture(resourceSource, failedRuntime)]
  const states = await settleSvgExportLabels(captures)
  assert.deepEqual(states.map((state) => state.status), ['ready', 'ready', 'fallback', 'fallback'])
  assert.equal(literal(states[2]), malformedSource)
  assert.equal(literal(states[3]), resourceSource)
  assert.match(markup(captures[1], states[1]), /<path /)
  assert.match(markup(captures[0], states[0]), />Region 日本語<\/text>/)
  for (const index of [2, 3]) assert.doesNotMatch(markup(captures[index], states[index]), /<path /)
})

test('capture copies visual and settings revisions before asynchronous settlement and a later export sees edits', async () => {
  const base = runtime()
  const held = deferred<LabelConversionResult>()
  const originalSource = '$old$'
  const originalResult = await base.service.convert(originalSource, svgLabelLayoutSettings(20))
  const delayedRuntime = createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined, convert: (source, settings) => source === originalSource
      ? held.promise : base.service.convert(source, settings),
  } })
  const input = { source: originalSource, runtime: delayedRuntime, position: { x: 23, y: 91 },
    fontSize: 20, fontFamily: 'serif', color: '#112233', opacity: 0.28,
    anchor: 'south east' as const, outline: { color: '#ffffff', width: 3 },
    settings: { ...svgLabelLayoutSettings(20), font: { ...svgLabelLayoutSettings(20).font } } }
  const first = captureSvgLabelExport(input)
  const preparation = settleSvgExportLabels([first])
  input.source = '$new$'
  input.position.x = 333
  input.position.y = 444
  input.color = '#abcdef'
  input.opacity = 0.93
  input.fontSize = 30
  input.outline.width = 5
  input.settings.font.sizePx = 30
  held.resolve(originalResult)
  const [firstState] = await preparation
  assert.equal(first.source, '$old$')
  assert.deepEqual(first.position, { x: 23, y: 91 })
  assert.equal(first.settings.font.sizePx, 20)
  assert.equal(first.outline?.width, 3)
  const firstMarkup = markup(first, firstState)
  assert.match(firstMarkup, /translate\(23 91\)/)
  assert.match(firstMarkup, /opacity="0.28"/)
  assert.match(firstMarkup, /fill="#112233"/)
  assert.doesNotMatch(firstMarkup, /#abcdef|translate\(333 444\)/)
  const second = captureSvgLabelExport(input)
  const [secondState] = await settleSvgExportLabels([second])
  assert.equal(secondState.source, '$new$')
  const secondMarkup = markup(second, secondState)
  assert.match(secondMarkup, /translate\(333 444\)/)
  assert.match(secondMarkup, /opacity="0.93"/)
  assert.match(secondMarkup, /fill="#abcdef"/)
})

test('settlement reuses exact cached success and retains visible dimmed opacity', async () => {
  const base = runtime()
  const result = await base.service.convert('$cached$', svgLabelLayoutSettings(20))
  let calls = 0
  const cached = createSvgLabelRuntime({ measurement, service: {
    peek: base.service.peek,
    convert: () => { calls++; throw new Error('cache should avoid conversion') },
  } })
  const captured = capture('$cached$', cached, { opacity: 0.125 })
  const [state] = await settleSvgExportLabels([captured])
  assert.equal(state.result, result)
  assert.equal(calls, 0)
  assert.match(markup(captured, state), /opacity="0.125"/)
})

test('adapter rejection, synchronous failure, and mismatched source never leak an old successful formula', async () => {
  const base = runtime()
  const old = await base.service.convert('$old$', svgLabelLayoutSettings(20))
  for (const convert of [
    () => Promise.reject(new Error('adapter rejected')),
    () => { throw new Error('adapter threw') },
    () => Promise.resolve(old),
  ]) {
    const guarded = createSvgLabelRuntime({ measurement, service: { peek: () => undefined, convert } })
    const captured = capture('  latest $new$\t\n<&>  ', guarded)
    const [state] = await settleSvgExportLabels([captured])
    assert.equal(state.status, 'fallback')
    assert.equal(literal(state), captured.source)
    assert.doesNotMatch(markup(captured, state), /<path /)
  }
})

test('outstanding conversion is bounded and timeout fallback allows a later success', async () => {
  const base = runtime()
  const result = await base.service.convert('$retry$', svgLabelLayoutSettings(20))
  const held = deferred<LabelConversionResult>()
  let attempts = 0
  const bounded = createSvgLabelRuntime({ measurement, service: { peek: () => undefined,
    convert: () => ++attempts === 1 ? held.promise : Promise.resolve(result) } })
  const captured = capture('$retry$', bounded)
  const [timedOut] = await settleSvgExportLabels([captured], undefined, { settlementMs: 5 })
  assert.equal(timedOut.status, 'fallback')
  assert.equal(timedOut.reason, 'timeout')
  assert.equal(literal(timedOut), '$retry$')
  const [retried] = await settleSvgExportLabels([captured], undefined, { settlementMs: 50 })
  assert.equal(retried.status, 'ready')
  held.resolve(result)
  await nextTurn()
  assert.equal(timedOut.status, 'fallback')
})

test('real resource loading deadline retires the adapter and same-service export retry succeeds', async () => {
  let loads = 0
  const service = createLabelService({ measurement,
    limits: { settlementMs: 5, retryDelayMs: 0 },
    loadEngine: () => ++loads === 1 ? new Promise<MathLabelEngine>(() => undefined) : Promise.resolve(engine) })
  const captured = capture('$retryResource$', createSvgLabelRuntime({ measurement, service }))
  const [first] = await settleSvgExportLabels([captured], undefined, { settlementMs: 50 })
  assert.equal(first.status, 'fallback')
  assert.equal(first.reason, 'timeout')
  const [second] = await settleSvgExportLabels([captured], undefined, { settlementMs: 50 })
  assert.equal(second.status, 'ready')
  assert.equal(loads, 2)
})

test('parser fallback cannot wait forever for a literal font and cancellation removes timers/listeners', async (context) => {
  const provider: TextMeasurementProvider = { ...measurement, ready: () => new Promise<void>(() => undefined) }
  const labelRuntime = createSvgLabelRuntime({ measurement: provider,
    service: createLabelService({ measurement: provider, loadEngine: async () => engine }) })
  const source = '  unmatched $x\t\n<&> '
  const [fallback] = await settleSvgExportLabels([capture(source, labelRuntime)], undefined, { settlementMs: 5 })
  assert.equal(fallback.status, 'fallback')
  assert.equal(literal(fallback), source)

  const held = deferred<LabelConversionResult>()
  const delayed = createSvgLabelRuntime({ measurement, service: {
    peek: () => undefined, convert: () => held.promise,
  } })
  const abort = new AbortController()
  const added = context.mock.method(abort.signal, 'addEventListener')
  const removed = context.mock.method(abort.signal, 'removeEventListener')
  const timers = context.mock.method(globalThis, 'setTimeout')
  const cleared = context.mock.method(globalThis, 'clearTimeout')
  const preparation = settleSvgExportLabels([capture('$x$', delayed)], abort.signal)
  await nextTurn()
  assert.equal(added.mock.calls.length, 1)
  assert.equal(timers.mock.calls.length, 1)
  abort.abort()
  await assert.rejects(preparation, /cancelled/i)
  assert.equal(removed.mock.calls.length, 1)
  assert.equal(removed.mock.calls[0].arguments[1], added.mock.calls[0].arguments[1])
  assert.equal(cleared.mock.calls.length, 1)
  assert.equal(cleared.mock.calls[0].arguments[0], timers.mock.calls[0].result)
  held.reject(new Error('late adapter failure'))
  await nextTurn()
  assert.equal(removed.mock.calls.length, 1)
  assert.equal(cleared.mock.calls.length, 1)
})

test('committed capture registration ignores obsolete cleanup and releases its current node owner', () => {
  // The registry needs object identity only; it does not inspect DOM contents.
  const node = {} as SVGGElement
  const labelRuntime = runtime()
  const oldCapture = capture('$old$', labelRuntime)
  const currentCapture = capture('$new$', labelRuntime)
  const oldCleanup = registerSvgLabelExportCapture(node, oldCapture)
  const currentCleanup = registerSvgLabelExportCapture(node, currentCapture)
  oldCleanup()
  assert.equal(getSvgLabelExportCapture(node), currentCapture)
  currentCleanup()
  assert.equal(getSvgLabelExportCapture(node), undefined)
})

test('real MathJax success, actual TeX failure, repeated geometry, and literal XML characters remain portable', async () => {
  const real = createSvgLabelRuntime({ measurement, service: createLabelService({ measurement }) })
  const raw = '  日本語 <svg onload="x"> & \'quote\'\t$\\unknowncommand{x}$\n tail \\  '
  const sources = ['混合 $\\frac{1}{2}$', '$\\sqrt{x_1^2}$', '$\\sqrt{x_1^2}$', raw]
  const captures = sources.map((source) => capture(source, real, { outline: { color: '#ffffff', width: 3 } }))
  const states = await settleSvgExportLabels(captures)
  assert.deepEqual(states.map((state) => state.status), ['ready', 'ready', 'ready', 'fallback'])
  assert.equal(literal(states[3]), raw)
  const rendered = captures.map((item, index) => markup(item, states[index]))
  for (const svg of rendered.slice(0, 3)) {
    assert.match(svg, /<path /)
    assert.match(svg, /stroke="#ffffff"/)
    assert.match(svg, /vector-effect="non-scaling-stroke"/)
    assert.doesNotMatch(svg, /currentColor|href=|\bid=|<use|foreignObject|<image|<script/)
  }
  assert.match(rendered[0], />混合 <\/text>/)
  assert.match(rendered[3], /&lt;svg onload=&quot;x&quot;&gt; &amp;/)
  assert.match(rendered[3], /xml:space="preserve"/)
  assert.match(rendered[3], /white-space:pre/)
  assert.doesNotMatch(rendered[3], /<path |<svg onload=/)
  assert.equal(states[3].layout.lines.length, 2)
  const tab = states[3].layout.placements.find((item) => item.kind === 'tab')
  assert.ok(tab && tab.width > 0)
  // A genuine compilation failure rather than an earlier unsupported-text parse.
  const invalid = capture('prefix $\\definitelyUndefined{x}$ suffix', real)
  const [invalidState] = await settleSvgExportLabels([invalid])
  assert.equal(invalidState.reason, 'tex-error')
  assert.equal(literal(invalidState), invalid.source)
})

test('shared detached view keeps measured anchors, projected positions, explicit colors, and halos', async () => {
  const labelRuntime = runtime()
  for (const position of [{ x: 150, y: 100 }, { x: -31.5, y: 84.25 }]) {
    for (const anchor of ['center', 'north', 'south', 'east', 'west', 'north east', 'north west', 'south east', 'south west'] as const) {
      const captured = capture('label $x$', labelRuntime, { position, anchor,
        outline: { color: '#ffffff', width: 3 }, color: '#8754ba', opacity: 0.37 })
      const [state] = await settleSvgExportLabels([captured])
      const placed = placeSvgLabel(state.layout, captured.fontSize, anchor)
      const output = markup(captured, state)
      assert.ok(output.includes(`translate(${position.x} ${position.y})`))
      assert.ok(output.includes(`translate(${placed.offsetX} ${placed.offsetY})`))
      assert.match(output, /fill="#8754ba"/)
      assert.match(output, /opacity="0.37"/)
      assert.match(output, /stroke="#ffffff"/)
      assert.doesNotMatch(output, /class=|currentColor/)
    }
  }
})

test('settling and rendering leave diagram JSON, history and generated TikZ unchanged', async () => {
  const diagram = structuredClone(emptyTwoDimensionalDiagram)
  diagram.labels.push({ id: 'raw-label', geometricKind: 'label', name: 'label',
    text: '  map $F^{(1)}L$  ', position: { x: 1, y: 2, z: 0 },
    style: { ...defaultLabelStyle }, layer: 0 })
  const history = createDiagramHistory(diagram)
  const before = { json: serializeDiagram(diagram), history: JSON.stringify(history), tikz: generateTikz(diagram),
    inlineTikz: generateTikz(diagram, { exportMode: 'inlineMath' }) }
  const labelRuntime = runtime()
  const captured = capture(diagram.labels[0].text, labelRuntime)
  const [state] = await settleSvgExportLabels([captured])
  assert.match(markup(captured, state), /<path /)
  assert.equal(serializeDiagram(diagram), before.json)
  assert.equal(JSON.stringify(history), before.history)
  assert.equal(generateTikz(diagram), before.tikz)
  assert.equal(generateTikz(diagram, { exportMode: 'inlineMath' }), before.inlineTikz)
})

type Request = { backgroundMode: SvgPreviewBackgroundMode; revision: number }

test('controller captures synchronously, ignores duplicate clicks, and hands off exactly one download before success', async () => {
  const prepared = deferred<string | null>()
  const events: string[] = []
  let captures = 0
  const controller = createSvgExportController<Request>({
    prepare: async (request) => { events.push(`prepare:${request.revision}`); return prepared.promise },
    download: (text, request) => { events.push(`download:${request.revision}:${text}`); return true },
    release: (request) => { events.push(`release:${request.revision}`) },
    onStatus: (status) => { events.push(status.kind) },
  })
  const first = controller.start(() => { captures++; events.push('capture'); return { backgroundMode: 'white', revision: 1 } })
  assert.equal(captures, 1)
  assert.equal(events[0], 'capture')
  assert.ok(events.includes('pending'))
  assert.equal(await controller.start(() => { captures++; return { backgroundMode: 'transparent', revision: 2 } }), false)
  assert.equal(captures, 1)
  assert.equal(events.some((event) => event.startsWith('download:')), false)
  prepared.resolve('<svg/>')
  assert.equal(await first, true)
  assert.equal(events.filter((event) => event.startsWith('download:')).length, 1)
  assert.ok(events.indexOf('download:1:<svg/>') < events.indexOf('success'))
  assert.equal(events.filter((event) => event === 'release:1').length, 1)
})

test('controller failure releases resources, restores action, and permits a subsequent successful export', async () => {
  for (const failure of ['null', 'prepare-rejection', 'download-false', 'download-throw'] as const) {
    let attempt = 0
    const released: number[] = []
    const statuses: string[] = []
    const controller = createSvgExportController<Request>({
      prepare: async () => {
        if (++attempt === 1 && failure === 'null') return null
        if (attempt === 1 && failure === 'prepare-rejection') throw new Error('serialization failed')
        return '<svg/>'
      },
      download: () => {
        if (attempt === 1 && failure === 'download-throw') throw new Error('object URL unavailable')
        return !(attempt === 1 && failure === 'download-false')
      },
      release: (request) => { released.push(request.revision) },
      onStatus: (status) => { statuses.push(status.kind) },
    })
    assert.equal(await controller.start(() => ({ backgroundMode: 'transparent', revision: 1 })), false, failure)
    assert.equal(statuses.at(-1), 'failure')
    assert.equal(await controller.start(() => ({ backgroundMode: 'white', revision: 2 })), true)
    assert.equal(statuses.at(-1), 'success')
    assert.deepEqual(released, [1, 2])
  }
})

test('capture failure settles status and does not prevent a later click', async () => {
  const statuses: string[] = []
  let downloads = 0
  const controller = createSvgExportController<Request>({
    prepare: async () => '<svg/>', download: () => { downloads++; return true },
    release: () => undefined, onStatus: (status) => { statuses.push(status.kind) },
  })
  assert.equal(await controller.start(() => { throw new Error('no valid snapshot') }), false)
  assert.equal(statuses.at(-1), 'failure')
  assert.equal(downloads, 0)
  assert.equal(await controller.start(() => ({ backgroundMode: 'transparent', revision: 2 })), true)
  assert.equal(downloads, 1)
})

test('cancellation/unmount aborts and releases immediately, ignores stale resolution, and protects the next request', async () => {
  const old = deferred<string | null>()
  const current = deferred<string | null>()
  const signals: AbortSignal[] = []
  const released: number[] = []
  const downloaded: number[] = []
  const statuses: string[] = []
  const controller = createSvgExportController<Request>({
    prepare: (request, signal) => { signals.push(signal); return request.revision === 1 ? old.promise : current.promise },
    download: (_text, request) => { downloaded.push(request.revision); return true },
    release: (request) => { released.push(request.revision) },
    onStatus: (status) => { statuses.push(status.kind) },
  })
  const first = controller.start(() => ({ backgroundMode: 'white', revision: 1 }))
  await nextTurn()
  controller.cancel()
  assert.equal(signals[0].aborted, true)
  assert.deepEqual(released, [1])
  const second = controller.start(() => ({ backgroundMode: 'transparent', revision: 2 }))
  const afterSecondStarted = [...statuses]
  old.resolve('<svg>obsolete</svg>')
  assert.equal(await first, false)
  assert.deepEqual(statuses, afterSecondStarted)
  assert.deepEqual(downloaded, [])
  assert.deepEqual(released, [1])
  current.resolve('<svg>current</svg>')
  assert.equal(await second, true)
  assert.deepEqual(downloaded, [2])
  assert.deepEqual(released, [1, 2])
  controller.cancel()
  assert.deepEqual(released, [1, 2])
})
