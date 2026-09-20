import type { EngineMathRun, EngineMathSvg, MathJaxFailureReason } from './mathjaxShared.ts'

export type MathJaxWorkerRequest = Readonly<{
  kind: 'convert'
  id: number
  runs: readonly EngineMathRun[]
}>

// Errors cross the context boundary as explicit categories, never Error prototypes.
export type MathJaxWorkerReply =
  | Readonly<{ kind: 'ready' }>
  | Readonly<{ kind: 'result'; id: number; result: readonly EngineMathSvg[] }>
  | Readonly<{ kind: 'failure'; id?: number; reason: MathJaxFailureReason }>
