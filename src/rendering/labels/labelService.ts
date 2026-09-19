import { parseLabelText, type LabelRun, type ParsedLabel } from '../labelText.ts'
import {
  composeLabelLayout,
  validateLabelLayoutSettings,
  type LabelLayout,
  type LabelLayoutSettings,
  type TextMeasurementProvider,
} from './labelMetrics.ts'
import { validateMathSvg, type MathSvgGeometry } from './labelSvg.ts'
import { assertSupportedMathRuns, type MathLabelEngine } from './mathjaxEngine.ts'
import { MATHJAX_IDENTITY } from './mathjaxConfig.ts'

export type LabelFailureReason =
  | Extract<ParsedLabel, { kind: 'fallback' }>['reason']
  | 'unsupported-input' | 'tex-error' | 'output-error' | 'resource-error'
  | 'invalid-metrics' | 'timeout'

export type ConvertedLabelRun = LabelRun & Readonly<{ geometry?: MathSvgGeometry }>

/** Runtime-only values. Coordinates are em, baseline zero, y downward. */
export type LabelConversionResult = Readonly<{
  source: string
  identity: string
  configurationIdentity: string
  generation: number
}> & (
  | Readonly<{ kind: 'success'; runs: readonly ConvertedLabelRun[]; layout: LabelLayout }>
  | Readonly<{ kind: 'fallback'; reason: LabelFailureReason }>
)

export const LABEL_SERVICE_LIMITS = Object.freeze({
  pendingRequests: 32,
  unsettledTasks: 64,
  cacheEntries: 64,
  cacheBytes: 2 * 1024 * 1024,
  settlementMs: 10_000,
  retryDelayMs: 1_000,
})

export type LabelServiceOptions = Readonly<{
  measurement: TextMeasurementProvider
  loadEngine?: () => Promise<MathLabelEngine>
  /** Injected engines must identify every version, extension, and geometry option. */
  configurationIdentity?: string
  limits?: Partial<{ readonly [Key in keyof typeof LABEL_SERVICE_LIMITS]: number }>
  onDiagnostic?: (error: unknown) => void
}>

type GeometryResult = readonly ConvertedLabelRun[]
type Generation = {
  number: number
  cancellation: Promise<never>
  cancel: (error: ServiceFailure) => void
  engine?: Promise<MathLabelEngine>
  geometryPending: Map<string, Promise<GeometryResult>>
}

class ServiceFailure extends Error {
  readonly reason: LabelFailureReason
  readonly resource?: 'font'
  constructor(reason: LabelFailureReason, resource?: 'font') {
    super(reason)
    this.reason = reason
    this.resource = resource
  }
}

/** Deterministic LRU; approximate retained UTF-16 JSON bytes, including keys. */
class BoundedCache<T> {
  private entries = new Map<string, { value: T; bytes: number }>()
  private bytes = 0
  private readonly maxEntries: number
  private readonly maxBytes: number
  constructor(maxEntries: number, maxBytes: number) {
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
  }
  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }
  set(key: string, value: T): void {
    const bytes = 2 * (key.length + JSON.stringify(value).length)
    if (bytes > this.maxBytes || this.maxEntries === 0) return
    const prior = this.entries.get(key)
    if (prior) this.bytes -= prior.bytes
    this.entries.delete(key)
    this.entries.set(key, { value, bytes })
    this.bytes += bytes
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.bytes -= this.entries.get(oldest)!.bytes
      this.entries.delete(oldest)
    }
  }
  clear(): void {
    this.entries.clear()
    this.bytes = 0
  }
  stats(): Readonly<{ entries: number; bytes: number }> {
    return Object.freeze({ entries: this.entries.size, bytes: this.bytes })
  }
}

let serviceSequence = 0

/**
 * Independent from React, Diagram, positions, camera, selection, and paint.
 * The consumer shows its latest source while pending and checks identity/generation.
 */
export function createLabelService(options: LabelServiceOptions) {
  const limits = { ...LABEL_SERVICE_LIMITS, ...options.limits }
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value) ||
      (['pendingRequests', 'unsettledTasks', 'settlementMs'].includes(key) && value === 0)) {
      throw new RangeError(`Invalid label service limit: ${key}`)
    }
  }
  const configurationIdentity = options.configurationIdentity ?? MATHJAX_IDENTITY
  const serviceId = ++serviceSequence
  let requestSequence = 0
  let generationNumber = 0
  let retryAfter = 0
  let fontRetryAfter = 0
  let lastTransient: LabelFailureReason = 'resource-error'
  let unsettledTasks = 0
  let unsettledMathTasks = 0
  let unsettledPlainTasks = 0
  const geometryCache = new BoundedCache<GeometryResult>(limits.cacheEntries, limits.cacheBytes)
  const resultCache = new BoundedCache<LabelConversionResult>(limits.cacheEntries, limits.cacheBytes)
  const pending = new Map<string, Promise<LabelConversionResult>>()
  const loadEngine = options.loadEngine ?? (async () =>
    (await import('./mathjaxEngine.ts')).loadMathJaxEngine())

  function diagnose(error: unknown): void {
    try { options.onDiagnostic?.(error) } catch { /* Diagnostics cannot change label output. */ }
  }

  function newGeneration(): Generation {
    let cancel!: (error: ServiceFailure) => void
    const cancellation = new Promise<never>((_, reject) => { cancel = reject })
    // A plain-text generation may never start a race against cancellation.
    void cancellation.catch(() => undefined)
    return { number: ++generationNumber, cancellation, cancel, geometryPending: new Map() }
  }
  let current = newGeneration()

  function retire(generation: Generation, reason: LabelFailureReason): void {
    if (current !== generation) return
    generation.cancel(new ServiceFailure(reason))
    current = newGeneration()
    pending.clear()
    geometryCache.clear()
    resultCache.clear()
  }

  function fallback(source: string, reason: LabelFailureReason, generation: Generation): LabelConversionResult {
    return Object.freeze({ kind: 'fallback', source, reason, generation: generation.number,
      configurationIdentity, identity: `${serviceId}:${generation.number}:${++requestSequence}` })
  }

  async function geometry(parsed: Extract<ParsedLabel, { kind: 'parsed' }>, generation: Generation) {
    const key = JSON.stringify([configurationIdentity, parsed.source])
    const cached = geometryCache.get(key)
    if (cached) return cached
    const coalesced = generation.geometryPending.get(key)
    if (coalesced) return coalesced
    const work = (async (): Promise<GeometryResult> => {
      const mathRuns = parsed.runs.filter((run) => run.kind === 'math')
      if (mathRuns.length === 0) return freezeDeep(parsed.runs)
      // A single shared lazy initialization per service generation.
      generation.engine ??= Promise.resolve().then(loadEngine).catch((error: unknown) => {
        diagnose(error)
        throw new ServiceFailure('resource-error')
      })
      const engine = await generation.engine
      if (generation !== current) throw new ServiceFailure('resource-error')
      if (engine.identity !== configurationIdentity) throw new ServiceFailure('output-error')
      const converted = await engine.convert(mathRuns.map(({ tex, display }) => ({ tex, display })))
      if (!Array.isArray(converted) || converted.length !== mathRuns.length) {
        throw new ServiceFailure('output-error')
      }
      let index = 0
      const runs = parsed.runs.map((run): ConvertedLabelRun => run.kind === 'math'
        ? { ...run, geometry: validateMathSvg(converted[index++].svg) }
        : { ...run })
      const value = freezeDeep(runs)
      // A retired transaction may finish, but cannot populate any live cache.
      if (generation === current) geometryCache.set(key, value)
      return value
    })()
    generation.geometryPending.set(key, work)
    try { return await work } finally { generation.geometryPending.delete(key) }
  }

  function convert(source: string, settings: LabelLayoutSettings): Promise<LabelConversionResult> {
    const generation = current
    const parsed = parseLabelText(source)
    if (parsed.kind === 'fallback') return Promise.resolve(fallback(source, parsed.reason, generation))
    // Copy settings immediately so a caller mutation cannot change an in-flight revision.
    const snapshot = freezeDeep({
      font: {
        family: settings.font.family,
        sizePx: settings.font.sizePx,
        weight: settings.font.weight,
        style: settings.font.style,
        fontReadinessGeneration: settings.font.fontReadinessGeneration,
      },
      tabSize: settings.tabSize,
      lineGapEm: settings.lineGapEm,
    })
    try {
      validateLabelLayoutSettings(snapshot)
      assertSupportedMathRuns(parsed.runs.filter((run) => run.kind === 'math'))
    } catch (error) {
      return Promise.resolve(fallback(source, failureReason(error), generation))
    }
    const key = JSON.stringify([configurationIdentity, options.measurement.identity, source, snapshot])
    const cached = resultCache.get(key)
    if (cached) return Promise.resolve(cached)
    const coalesced = pending.get(key)
    if (coalesced) return coalesced
    const hasMath = parsed.runs.some((run) => run.kind === 'math')
    const poolSize = hasMath ? unsettledMathTasks : unsettledPlainTasks
    if (pending.size >= limits.pendingRequests || poolSize >= limits.unsettledTasks) {
      return Promise.resolve(fallback(source, 'limit', generation))
    }
    if (Date.now() < fontRetryAfter) return Promise.resolve(fallback(source, 'resource-error', generation))
    if (hasMath && Date.now() < retryAfter) {
      return Promise.resolve(fallback(source, lastTransient, generation))
    }

    unsettledTasks++
    if (hasMath) unsettledMathTasks++
    else unsettledPlainTasks++
    let awaitingFont = false
    const work = (async (): Promise<LabelConversionResult> => {
      try {
        const runs = await geometry(parsed, generation)
        awaitingFont = true
        try {
          await options.measurement.ready?.(snapshot.font,
            ' Mg' + runs.filter((run) => run.kind === 'text').map((run) => run.text).join(''))
        } catch (error) {
          diagnose(error)
          throw new ServiceFailure('resource-error', 'font')
        }
        awaitingFont = false
        if (generation !== current) throw new ServiceFailure('resource-error')
        const layout = composeLabelLayout(runs, runs.map((run) => run.geometry?.metrics), snapshot, options.measurement)
        return freezeDeep({ kind: 'success' as const, source, runs, layout,
          generation: generation.number, configurationIdentity,
          identity: `${serviceId}:${generation.number}:${++requestSequence}` })
      } finally {
        unsettledTasks--
        if (hasMath) unsettledMathTasks--
        else unsettledPlainTasks--
      }
    })()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ServiceFailure('timeout')), limits.settlementMs)
    })
    const settled = Promise.race([work, timeout, generation.cancellation])
      .then((result) => {
        if (current === generation) resultCache.set(key, result)
        return result
      })
      .catch((error: unknown) => {
        diagnose(error)
        const reason = failureReason(error)
        if (reason === 'resource-error' || reason === 'timeout') {
          if (generation === current) {
            lastTransient = reason
            retryAfter = Date.now() + limits.retryDelayMs
            if (awaitingFont || (error instanceof ServiceFailure && error.resource === 'font') ||
              (typeof error === 'object' && error !== null && 'reason' in error && error.reason === 'font')) {
              fontRetryAfter = retryAfter
            }
            retire(generation, reason)
          }
        }
        return fallback(source, reason, generation)
      })
      .finally(() => {
        clearTimeout(timer)
        if (pending.get(key) === settled) pending.delete(key)
      })
    pending.set(key, settled)
    return settled
  }

  return Object.freeze({
    convert,
    /** Explicit resource retry or document/config lifecycle reset; no automatic render loop. */
    invalidate: () => { retryAfter = 0; fontRetryAfter = 0; retire(current, 'resource-error') },
    get generation() { return current.number },
    configurationIdentity,
    stats: () => Object.freeze({ generation: current.number, pending: pending.size, unsettledTasks,
      unsettledMathTasks, unsettledPlainTasks, retryAfter, fontRetryAfter,
      geometry: geometryCache.stats(), results: resultCache.stats() }),
  })
}

function failureReason(error: unknown): LabelFailureReason {
  if (typeof error !== 'object' || error === null) return 'output-error'
  const value = 'reason' in error ? error.reason : 'category' in error ? error.category : undefined
  switch (value) {
    case 'unsupported-input': case 'tex-error': case 'output-error':
    case 'resource-error': case 'invalid-metrics': case 'limit': case 'timeout': return value
    case 'tex': return 'tex-error'
    case 'output': return 'output-error'
    case 'font': return 'resource-error'
    case 'work-limit': return 'limit'
    default: return 'output-error'
  }
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

// Phase 31C entry points; importing them does not initialize MathJax.
export { createBrowserTextMeasurementProvider } from './labelMetrics.ts'
export { paintMathSvg, serializeMathSvg } from './labelSvg.ts'
