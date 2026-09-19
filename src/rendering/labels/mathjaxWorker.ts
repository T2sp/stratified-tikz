import { MathJaxFailure, type MathLabelEngine } from './mathjaxShared.ts'
import { MATHJAX_WORKER_LIMITS } from './mathjaxConfig.ts'
import type { MathJaxWorkerReply, MathJaxWorkerRequest } from './mathjaxWorkerProtocol.ts'

// This module executes only in the dedicated Worker. No browser DOM is used by
// the lite adaptor. Runtime, shared dependencies, and font imports all belong
// to this Worker's module map, never the owning Window's map.
const send = (reply: MathJaxWorkerReply): void => globalThis.postMessage(reply)
let engine: MathLabelEngine | undefined
let active = 0
globalThis.onmessage = (event: MessageEvent<MathJaxWorkerRequest>): void => {
  const request = event.data
  if (!engine || request.kind !== 'convert') return
  if (active >= MATHJAX_WORKER_LIMITS.pendingRequests) {
    send({ kind: 'failure', id: request.id, reason: 'limit' })
    return
  }
  active++
  void engine.convert(request.runs).then(
    (result) => send({ kind: 'result', id: request.id, result }),
    (error: unknown) => send({ kind: 'failure', id: request.id,
      reason: error instanceof MathJaxFailure ? error.reason : 'output-error' }),
  ).finally(() => { active-- })
}

void import('./mathjaxRuntime.ts').then(({ createMathJaxEngine }) => {
  engine = createMathJaxEngine()
  send({ kind: 'ready' })
}).catch(() => send({ kind: 'failure', reason: 'resource-error' }))
