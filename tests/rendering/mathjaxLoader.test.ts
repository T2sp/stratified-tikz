import assert from 'node:assert/strict'
import test from 'node:test'
import { createLabelService } from '../../src/rendering/labels/labelService.ts'
import { MATHJAX_WORKER_LIMITS } from '../../src/rendering/labels/mathjaxConfig.ts'
import { MathJaxFailure, type EngineMathRun, type EngineMathSvg } from '../../src/rendering/labels/mathjaxEngine.ts'
import { loadWorkerMathJaxEngine, type MathJaxWorkerPort } from '../../src/rendering/labels/mathjaxWorkerClient.ts'
import type { MathJaxWorkerReply, MathJaxWorkerRequest } from '../../src/rendering/labels/mathjaxWorkerProtocol.ts'
import type { LabelLayoutSettings, TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'

const settings: LabelLayoutSettings = {
  font: { family: 'Test Serif', sizePx: 20, weight: '400', style: 'normal', fontReadinessGeneration: 0 },
  tabSize: 4, lineGapEm: 0.2,
}
const measurement: TextMeasurementProvider = {
  identity: 'worker-lifecycle-fixture',
  measure: (text, font) => ({ width: text.length * font.sizePx / 2, ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const converted: EngineMathSvg = {
  svg: { tag: 'svg', attributes: { viewBox: '0 -800 1000 1000' }, children: [
    { tag: 'path', attributes: { d: 'M0 0L100 100Z' }, children: [] },
  ] },
  advanceWidth: 1,
}
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve))
const isResourceFailure = (error: unknown) => error instanceof MathJaxFailure && error.reason === 'resource-error'
const isTimeoutFailure = (error: unknown) => error instanceof Error && 'reason' in error && error.reason === 'timeout'

class ManualWorker implements MathJaxWorkerPort {
  readonly requests: MathJaxWorkerRequest[] = []
  terminateCount = 0
  cleanupCount = 0
  receive: ((reply: MathJaxWorkerReply) => void) | undefined
  fail: (() => void) | undefined
  lateReceive: ((reply: MathJaxWorkerReply) => void) | undefined
  lateFail: (() => void) | undefined
  postFailure = false

  listen(receive: (reply: MathJaxWorkerReply) => void, fail: () => void): () => void {
    this.receive = this.lateReceive = receive
    this.fail = this.lateFail = fail
    return () => {
      this.cleanupCount++
      this.receive = undefined
      this.fail = undefined
    }
  }

  postMessage(request: MathJaxWorkerRequest): void {
    if (this.postFailure) throw new Error('Structured clone or worker delivery failed')
    this.requests.push(request)
  }

  terminate(): void { this.terminateCount++ }
}

test('an already-aborted loader never creates a worker or starts native loading', async () => {
  const controller = new AbortController()
  controller.abort()
  let created = 0
  await assert.rejects(loadWorkerMathJaxEngine(controller.signal, () => { created++; return new ManualWorker() }), isResourceFailure)
  assert.equal(created, 0)
})

test('worker creation failure rejects initialization through the resource category', async () => {
  await assert.rejects(loadWorkerMathJaxEngine(new AbortController().signal, () => {
    throw new Error('Worker unavailable')
  }), isResourceFailure)
})

for (const failure of ['native-error', 'runtime-rejection', 'abort'] as const) {
  test(`${failure} settles initialization and releases listeners and execution context once`, async () => {
    const controller = new AbortController()
    const worker = new ManualWorker()
    const pending = loadWorkerMathJaxEngine(controller.signal, () => worker)
    const rejection = assert.rejects(pending, isResourceFailure)
    if (failure === 'native-error') worker.fail?.()
    else if (failure === 'runtime-rejection') worker.receive?.({ kind: 'failure', reason: 'resource-error' })
    else controller.abort()
    await rejection
    controller.abort()
    worker.lateReceive?.({ kind: 'ready' })
    worker.lateFail?.()
    assert.equal(worker.terminateCount, 1)
    assert.equal(worker.cleanupCount, 1)
    assert.equal(worker.receive, undefined)
    assert.equal(worker.fail, undefined)
    assert.equal(worker.requests.length, 0)
  })
}

test('worker initialization deadline terminates the pending context and ignores a late ready event', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const worker = new ManualWorker()
  const pending = loadWorkerMathJaxEngine(new AbortController().signal, () => worker)
  const rejection = assert.rejects(pending, isTimeoutFailure)
  context.mock.timers.tick(MATHJAX_WORKER_LIMITS.settlementMs + 1)
  await rejection
  worker.lateReceive?.({ kind: 'ready' })
  assert.equal(worker.terminateCount, 1)
  assert.equal(worker.cleanupCount, 1)
})

test('conversion replies retain per-request identity and TeX failures do not discard a healthy worker', async () => {
  const worker = new ManualWorker()
  const loaded = loadWorkerMathJaxEngine(new AbortController().signal, () => worker)
  worker.receive?.({ kind: 'ready' })
  const engine = await loaded
  const first = engine.convert([{ tex: 'x', display: false }])
  const invalid = engine.convert([{ tex: 'bad', display: false }])
  const third = engine.convert([{ tex: 'z', display: true }])
  const rejected = assert.rejects(invalid, (error: unknown) => error instanceof MathJaxFailure && error.reason === 'tex-error')
  const [one, bad, three] = worker.requests
  assert.notEqual(one.id, bad.id)
  assert.notEqual(bad.id, three.id)
  worker.receive?.({ kind: 'result', id: three.id, result: [{ ...converted, advanceWidth: 3 }] })
  worker.receive?.({ kind: 'failure', id: bad.id, reason: 'tex-error' })
  worker.receive?.({ kind: 'result', id: one.id, result: [converted] })
  assert.equal((await third)[0].advanceWidth, 3)
  assert.equal((await first)[0].advanceWidth, 1)
  await rejected
  assert.equal(worker.terminateCount, 0)
  engine.dispose?.()
  assert.equal(worker.terminateCount, 1)
})

test('worker conversion queue is bounded and completing a request immediately releases its slot', async () => {
  const worker = new ManualWorker()
  const loaded = loadWorkerMathJaxEngine(new AbortController().signal, () => worker)
  worker.receive?.({ kind: 'ready' })
  const engine = await loaded
  const pending = Array.from({ length: MATHJAX_WORKER_LIMITS.pendingRequests }, () =>
    engine.convert([{ tex: 'x', display: false }]))
  await assert.rejects(engine.convert([{ tex: 'overflow', display: false }]),
    (error: unknown) => error instanceof MathJaxFailure && error.reason === 'limit')
  assert.equal(worker.requests.length, MATHJAX_WORKER_LIMITS.pendingRequests)
  worker.receive?.({ kind: 'result', id: worker.requests[0].id, result: [converted] })
  await pending[0]
  pending.push(engine.convert([{ tex: 'replacement', display: false }]))
  assert.equal(worker.requests.length, MATHJAX_WORKER_LIMITS.pendingRequests + 1)
  for (const request of worker.requests.slice(1)) {
    worker.receive?.({ kind: 'result', id: request.id, result: [converted] })
  }
  await Promise.all(pending)
  engine.dispose?.()
  assert.equal(worker.terminateCount, 1)
})

for (const failure of ['resource-rejection', 'native-error', 'abort', 'post-failure'] as const) {
  test(`${failure} releases concurrent requests and ignores all late events from the disposed worker`, async () => {
    const controller = new AbortController()
    const worker = new ManualWorker()
    const loaded = loadWorkerMathJaxEngine(controller.signal, () => worker)
    worker.receive?.({ kind: 'ready' })
    const engine = await loaded
    const first = engine.convert([{ tex: 'x', display: false }])
    const second = engine.convert([{ tex: 'y', display: false }])
    const rejections = [assert.rejects(first, isResourceFailure), assert.rejects(second, isResourceFailure)]
    if (failure === 'resource-rejection') worker.receive?.({ kind: 'failure', id: worker.requests[0].id, reason: 'resource-error' })
    else if (failure === 'native-error') worker.fail?.()
    else if (failure === 'abort') controller.abort()
    else {
      worker.postFailure = true
      rejections.push(assert.rejects(engine.convert([{ tex: 'z', display: false }]), isResourceFailure))
    }
    await Promise.all(rejections)
    worker.lateReceive?.({ kind: 'result', id: worker.requests[0].id, result: [converted] })
    worker.lateReceive?.({ kind: 'ready' })
    worker.lateFail?.()
    engine.dispose?.()
    controller.abort()
    await assert.rejects(engine.convert([{ tex: 'late', display: false }]), isResourceFailure)
    assert.equal(worker.terminateCount, 1)
    assert.equal(worker.cleanupCount, 1)
    assert.equal(worker.receive, undefined)
  })
}

test('conversion deadline rejects every queued request and frees the context despite late output', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const worker = new ManualWorker()
  const loaded = loadWorkerMathJaxEngine(new AbortController().signal, () => worker)
  worker.receive?.({ kind: 'ready' })
  const engine = await loaded
  const first = engine.convert([{ tex: 'x', display: false }])
  const second = engine.convert([{ tex: 'y', display: false }])
  const settled = Promise.all([assert.rejects(first, isTimeoutFailure), assert.rejects(second, isTimeoutFailure)])
  context.mock.timers.tick(MATHJAX_WORKER_LIMITS.settlementMs + 1)
  await settled
  worker.lateReceive?.({ kind: 'result', id: worker.requests[0].id, result: [converted] })
  engine.dispose?.()
  assert.equal(worker.terminateCount, 1)
  assert.equal(worker.cleanupCount, 1)
})

// Deterministic native-module-map model. Failure is sticky for a fixed URL in
// each context, even when access returns. Actual native imports are covered by
// the independent production-build browser smoke, not by this fixture.
const moduleUrls = Object.freeze({
  runtime: '/stratified-tikz/assets/mathjaxRuntime-fixed.js',
  shared: '/stratified-tikz/assets/shared-fixed.js',
  font: '/stratified-tikz/assets/double-struck-fixed.js',
})

for (const boundary of ['runtime', 'shared', 'font'] as const) {
  test(`repeated sticky ${boundary} failures recover with fixed URLs in fresh bounded contexts of the same service`, async () => {
    const contexts: PoisonedModuleWorker[] = []
    const blocked = new Set<string>()
    const networkFailures: string[] = []
    let active = 0
    let peak = 0
    let completedRuns = 0

    class PoisonedModuleWorker extends ManualWorker {
      readonly poisoned = new Set<string>()
      readonly loaded = new Set<string>()
      readonly attemptedUrls: string[] = []

      override listen(receive: (reply: MathJaxWorkerReply) => void, fail: () => void): () => void {
        const cleanup = super.listen(receive, fail)
        queueMicrotask(() => {
          try {
            this.importIdentity(moduleUrls.runtime)
            this.importIdentity(moduleUrls.shared)
            this.receive?.({ kind: 'ready' })
          } catch {
            this.receive?.({ kind: 'failure', reason: 'resource-error' })
          }
        })
        return cleanup
      }

      importIdentity(url: string): void {
        this.attemptedUrls.push(url)
        if (this.poisoned.has(url)) throw new Error('Cached native module failure')
        if (this.loaded.has(url)) return
        if (blocked.has(url)) {
          this.poisoned.add(url)
          networkFailures.push(url)
          throw new Error('Native module download failed')
        }
        this.loaded.add(url)
      }

      override postMessage(request: MathJaxWorkerRequest): void {
        super.postMessage(request)
        queueMicrotask(() => {
          const result: EngineMathSvg[] = []
          try {
            for (const run of request.runs) {
              this.convertRun(run)
              result.push(converted)
            }
            this.receive?.({ kind: 'result', id: request.id, result })
          } catch {
            this.receive?.({ kind: 'failure', id: request.id, reason: 'resource-error' })
          }
        })
      }

      convertRun(run: EngineMathRun): void {
        if (run.tex.includes('mathbb')) this.importIdentity(moduleUrls.font)
        completedRuns++
      }

      override terminate(): void {
        super.terminate()
        active--
      }
    }

    const service = createLabelService({ measurement, loadEngine: (signal) => loadWorkerMathJaxEngine(signal, () => {
      active++
      peak = Math.max(peak, active)
      const worker = new PoisonedModuleWorker()
      contexts.push(worker)
      return worker
    }) })
    const source = '  \t$x$ \r\n then \\(\\mathbb{R}\\)  \t\n '
    assert.equal((await service.convert('plain before math', settings)).kind, 'success')
    assert.equal(contexts.length, 0, 'Plain text is lazy')
    for (let cycle = 0; cycle < 4; cycle++) {
      if (cycle > 0) service.invalidate()
      if (boundary === 'font') assert.equal((await service.convert('$x$', settings)).kind, 'success')
      blocked.add(moduleUrls[boundary])
      const completedBeforeFailure = completedRuns
      const pending = service.convert(source, settings)
      assert.equal(service.convert(source, settings), pending)
      const failed = await pending
      assert.equal(failed.kind === 'fallback' && failed.reason, 'resource-error')
      assert.equal(failed.source, source)
      assert.equal('runs' in failed, false)
      assert.equal('layout' in failed, false)
      if (boundary === 'font') assert.equal(completedRuns, completedBeforeFailure + 1, 'Earlier math succeeds before the later font failure')
      assert.equal(networkFailures.length, cycle + 1)
      assert.equal(networkFailures.at(-1), moduleUrls[boundary])
      const poisoned = contexts.at(-1)!
      assert.equal(poisoned.terminateCount, 1)
      assert.equal(poisoned.cleanupCount, 1)
      assert.equal(active, 0)
      blocked.clear()
      assert.throws(() => poisoned.importIdentity(moduleUrls[boundary]), /Cached native module failure/,
        'Merely restoring access cannot repair the simulated old native identity')
      const contextCount = contexts.length
      await service.convert(source, settings)
      assert.equal(contexts.length, contextCount, 'Cooldown prevents a new context for every repeated render')
      assert.equal((await service.convert('  ordinary\ttext\r\n', settings)).kind, 'success')
      service.invalidate()
      const recovered = await service.convert(source, settings)
      assert.equal(recovered.kind, 'success')
      assert.equal(recovered.source, source)
      assert.equal(await service.convert(source, settings), recovered)
      assert.ok(Object.isFrozen(recovered))
      assert.equal((await service.convert('$z+1$', settings)).kind, 'success')
      assert.equal(contexts.length, contextCount + 1)
      assert.notEqual(contexts.at(-1), poisoned)
      assert.ok(contexts.at(-1)!.loaded.has(moduleUrls[boundary]), 'The same fixed URL loads in the replacement context')
      assert.ok(contexts.every((item) => item.attemptedUrls.every((url) => Object.values(moduleUrls).some((known) => known === url))))
      assert.equal(service.stats().unsettledTasks, 0)
    }
    assert.equal(peak, 1)
    assert.equal(active, 1)
    service.invalidate()
    await nextTurn()
    assert.equal(active, 0)
    assert.ok(contexts.every((worker) => worker.terminateCount === 1 && worker.cleanupCount === 1))
  })
}
