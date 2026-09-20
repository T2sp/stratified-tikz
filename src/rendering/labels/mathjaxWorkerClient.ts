import {
  assertSupportedMathRuns, MathJaxFailure,
  type EngineMathRun, type EngineMathSvg, type MathLabelEngine,
} from './mathjaxShared.ts'
import { MATHJAX_IDENTITY, MATHJAX_WORKER_LIMITS } from './mathjaxConfig.ts'
import type { MathJaxWorkerReply, MathJaxWorkerRequest } from './mathjaxWorkerProtocol.ts'

/** Deterministic context-lifetime seam; production always uses a native Worker. */
export interface MathJaxWorkerPort {
  listen(receive: (reply: MathJaxWorkerReply) => void, fail: () => void): () => void
  postMessage(request: MathJaxWorkerRequest): void
  terminate(): void
}

function createWorker(): MathJaxWorkerPort {
  const worker = new Worker(new URL('./mathjaxWorker.ts', import.meta.url), { type: 'module' })
  return {
    listen(receive, fail) {
      const message = (event: MessageEvent<MathJaxWorkerReply>): void => receive(event.data)
      const error = (event: Event): void => { event.preventDefault(); fail() }
      worker.addEventListener('message', message)
      worker.addEventListener('error', error)
      worker.addEventListener('messageerror', error)
      return () => {
        worker.removeEventListener('message', message)
        worker.removeEventListener('error', error)
        worker.removeEventListener('messageerror', error)
      }
    },
    postMessage: (request) => worker.postMessage(request),
    terminate: () => worker.terminate(),
  }
}

/**
 * One fixed-URL execution context per service generation. Termination abandons
 * its entire native module map (including shared/font dependencies), rather
 * than retaining failed imports in the Window or accumulating retry URLs.
 */
export function loadWorkerMathJaxEngine(
  signal: AbortSignal,
  factory: () => MathJaxWorkerPort = createWorker,
): Promise<MathLabelEngine> {
  return new Promise((resolve, reject) => {
    const resourceError = () => new MathJaxFailure('resource-error', 'MathJax execution context unavailable')
    if (signal.aborted) { reject(resourceError()); return }
    let port: MathJaxWorkerPort
    try { port = factory() } catch (error) {
      reject(new MathJaxFailure('resource-error', 'MathJax Worker creation failed', { cause: error }))
      return
    }
    type Pending = {
      resolve: (value: readonly EngineMathSvg[]) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
    const pending = new Map<number, Pending>()
    let ready = false
    let stopped: Error | undefined
    let sequence = 0
    let unlisten = () => {}
    const timeoutError = () => Object.assign(new Error('MathJax Worker deadline exceeded'), { reason: 'timeout' })
    const timer = setTimeout(() => stop(timeoutError()), MATHJAX_WORKER_LIMITS.settlementMs)
    const abort = (): void => stop(resourceError())
    function stop(error: Error): void {
      if (stopped) return
      stopped = error
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      unlisten()
      port.terminate()
      reject(error)
      for (const task of pending.values()) {
        clearTimeout(task.timer)
        task.reject(error)
      }
      pending.clear()
    }
    const engine: MathLabelEngine = Object.freeze({
      identity: MATHJAX_IDENTITY,
      dispose: () => stop(resourceError()),
      convert: (runs: readonly EngineMathRun[]) => {
        if (stopped) return Promise.reject(stopped)
        try { assertSupportedMathRuns(runs) } catch (error) { return Promise.reject(error) }
        if (pending.size >= MATHJAX_WORKER_LIMITS.pendingRequests) {
          return Promise.reject(new MathJaxFailure('limit', 'MathJax Worker request limit'))
        }
        return new Promise<readonly EngineMathSvg[]>((resolveRun, rejectRun) => {
          const id = ++sequence
          pending.set(id, { resolve: resolveRun, reject: rejectRun,
            timer: setTimeout(() => stop(timeoutError()), MATHJAX_WORKER_LIMITS.settlementMs) })
          try { port.postMessage({ kind: 'convert', id, runs }) } catch { stop(resourceError()) }
        })
      },
    })
    signal.addEventListener('abort', abort, { once: true })
    try {
      unlisten = port.listen((reply) => {
        if (stopped) return
        if (reply.kind === 'ready') {
          if (ready) return
          ready = true
          clearTimeout(timer)
          resolve(engine)
        } else if (reply.kind === 'failure' && (reply.reason === 'resource-error' || reply.id === undefined)) {
          // All transactions in this module map must retire together. A font
          // failure may occur after earlier runs have produced local geometry.
          stop(resourceError())
        } else if ('id' in reply && reply.id !== undefined) {
          const task = pending.get(reply.id)
          if (!task) return
          pending.delete(reply.id)
          clearTimeout(task.timer)
          if (reply.kind === 'result') task.resolve(reply.result)
          else task.reject(new MathJaxFailure(reply.reason, 'MathJax conversion failed'))
        }
      }, () => stop(resourceError()))
      // A synchronous factory/listener seam can retire before subscription.
      if (stopped) unlisten()
      if (signal.aborted) abort()
    } catch { stop(resourceError()) }
  })
}
