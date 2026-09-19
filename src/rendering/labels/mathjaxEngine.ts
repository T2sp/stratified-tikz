import { MAX_LABEL_RUNS, MAX_LABEL_SOURCE_LENGTH } from '../labelText.ts'
import type { RawSvgElement } from './labelSvg.ts'
import { MATHJAX_IDENTITY, MATHJAX_LIMITS } from './mathjaxConfig.ts'

export type MathJaxFailureReason =
  | 'unsupported-input'
  | 'tex-error'
  | 'output-error'
  | 'resource-error'
  | 'limit'

export class MathJaxFailure extends Error {
  readonly reason: MathJaxFailureReason

  constructor(reason: MathJaxFailureReason, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MathJaxFailure'
    this.reason = reason
  }
}

export type EngineMathRun = Readonly<{ tex: string; display: boolean }>
export type EngineMathSvg = Readonly<{
  svg: RawSvgElement
  /** True logical advance in em, before MathJax clamps its SVG viewport. */
  advanceWidth: number
}>
export interface MathLabelEngine {
  readonly identity: string
  convert(runs: readonly EngineMathRun[]): Promise<readonly EngineMathSvg[]>
}

/** Only imported by a service after parsing finds supported mathematical input. */
export async function loadMathJaxEngine(): Promise<MathLabelEngine> {
  try {
    const { createMathJaxEngine } = await import('./mathjaxRuntime.ts')
    return createMathJaxEngine()
  } catch (error) {
    if (error instanceof MathJaxFailure) throw error
    throw new MathJaxFailure('resource-error', 'MathJax initialization failed', { cause: error })
  }
}

export { MATHJAX_IDENTITY }

// MathJax 4.1.3's TexError is a plain object, not an Error subclass. Match its
// pinned implementation IDs rather than mistaking syntax-error wording
// such as "Too many alignment characters" for a bounded-work failure.
const workLimitIds = new Set(['MaxBufferSize', 'MaxMacroSub1', 'MaxMacroSub2', 'MaxTemplateSubs', 'MaxColumns'])

/** The same request-scoped hooks are usable by deterministic failure fixtures. */
export function createMathJaxErrorCapture() {
  let failure: MathJaxFailure | undefined
  const capture = (reason: 'tex-error' | 'output-error', error: unknown): never => {
    const isLimit = typeof error === 'object' && error !== null && 'id' in error &&
      typeof error.id === 'string' && workLimitIds.has(error.id)
    failure = error instanceof MathJaxFailure
      ? error : new MathJaxFailure(isLimit ? 'limit' : reason, `MathJax ${reason}`, { cause: error })
    throw failure
  }
  return Object.freeze({
    formatError: (_jax: unknown, error: unknown) => capture('tex-error', error),
    compileError: (_document: unknown, _math: unknown, error: unknown) => capture('tex-error', error),
    typesetError: (_document: unknown, _math: unknown, error: unknown) => capture('output-error', error),
    check: () => { if (failure) throw failure },
  })
}

const unsupportedCommands = new Set([
  'DeclareMathOperator',
  'def', 'gdef', 'edef', 'xdef', 'let', 'futurelet', 'newcommand', 'renewcommand',
  'providecommand', 'newenvironment', 'renewenvironment', 'newif', 'csname',
  'endcsname', 'catcode', 'require', 'autoload', 'href', 'url', 'htmlClass',
  'htmlId', 'htmlStyle', 'htmlData', 'class', 'style', 'cssId', 'unicode',
  'mmlToken', 'newcolumntype',
  'label', 'ref', 'eqref', 'tag', 'notag', 'nonumber', 'definecolor',
  'documentclass', 'usepackage', 'include', 'input', 'write', 'read', 'openout',
  'special', 'includegraphics', 'hsize', 'vsize', 'setcounter', 'newcounter',
])

/** Reject configuration/state commands before invoking the synchronous parser. */
export function assertSupportedMathRuns(runs: readonly EngineMathRun[]): void {
  if (runs.length > MAX_LABEL_RUNS) {
    throw new MathJaxFailure('limit', 'Too many math runs')
  }
  let length = 0
  for (const { tex } of runs) {
    length += tex.length
    if (length > MAX_LABEL_SOURCE_LENGTH) {
      throw new MathJaxFailure('limit', 'Too much TeX source')
    }
    let nesting = 0
    for (let index = 0; index < tex.length; index++) {
      const character = tex[index]
      if (character === '%') {
        while (index + 1 < tex.length && !'\r\n'.includes(tex[index + 1])) index++
      } else if (character === '\\') {
        const start = ++index
        while (index < tex.length && /[a-zA-Z]/.test(tex[index])) index++
        const command = tex.slice(start, index)
        if (unsupportedCommands.has(command)) {
          throw new MathJaxFailure('unsupported-input', `Unsupported TeX command: ${command}`)
        }
        if (command) index--
      } else if (character === '{') {
        if (++nesting > MATHJAX_LIMITS.maxNesting) {
          throw new MathJaxFailure('limit', 'TeX nesting limit exceeded')
        }
      } else if (character === '}') {
        nesting--
      }
    }
  }
}
