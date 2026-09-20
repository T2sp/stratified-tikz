import { MathJaxFailure, type MathLabelEngine } from './mathjaxShared.ts'
import { loadWorkerMathJaxEngine } from './mathjaxWorkerClient.ts'

export * from './mathjaxShared.ts'

/** Browser math owns a disposable module map; ordinary text never gets here. */
export async function loadMathJaxEngine(signal: AbortSignal = new AbortController().signal): Promise<MathLabelEngine> {
  if (signal.aborted) throw new MathJaxFailure('resource-error', 'MathJax initialization retired')
  // Native Node tests use installed direct modules. This branch is not a browser
  // recovery mechanism and is deliberately excluded from Vite's browser graph.
  if (typeof window === 'undefined') {
    try {
      const runtimePath = './mathjaxRuntime.ts'
      const runtime = await import(/* @vite-ignore */ runtimePath) as typeof import('./mathjaxRuntime.ts')
      if (signal.aborted) throw new MathJaxFailure('resource-error', 'MathJax initialization retired')
      return runtime.createMathJaxEngine()
    } catch (error) {
      throw new MathJaxFailure('resource-error', 'MathJax initialization failed', { cause: error })
    }
  }
  return loadWorkerMathJaxEngine(signal)
}
