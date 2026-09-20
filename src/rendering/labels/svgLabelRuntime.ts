import {
  createLabelService,
  type LabelConversionResult,
  type LabelFailureReason,
} from './labelService.ts'
import {
  createBrowserTextMeasurementProvider,
  type LabelLayout,
  type LabelLayoutSettings,
  type TextMeasurementProvider,
} from './labelMetrics.ts'
import { literalSvgLabelLayout } from './svgLabelLayout.ts'

export type SvgLabelService = Pick<ReturnType<typeof createLabelService>, 'convert' | 'peek'>
  & Partial<Pick<ReturnType<typeof createLabelService>, 'invalidate'>>

export type SvgLabelRequest = Readonly<{ source: string; settings: LabelLayoutSettings }>
export type SvgLabelState = Readonly<{
  source: string
  requestIdentity: string
  status: 'pending' | 'ready' | 'fallback'
  layout: LabelLayout
  estimated: boolean
  result?: LabelConversionResult
  reason?: LabelFailureReason
}>

export type SvgLabelRuntime = Readonly<{
  measurement: TextMeasurementProvider
  service: SvgLabelService
  getFontGeneration(): number
  subscribeFontChanges(listener: () => void): () => void
  dispose(): void
}>

/** One owner per preview, shared by its labels. Nothing is stored in Diagram. */
export function createSvgLabelRuntime(options: Readonly<{
  measurement?: TextMeasurementProvider
  service?: SvgLabelService
}> = {}): SvgLabelRuntime {
  const measurement = options.measurement ?? createBrowserTextMeasurementProvider()
  const service = options.service ?? createLabelService({ measurement })
  let fontGeneration = 0
  const listeners = new Set<() => void>()
  let fonts: FontFaceSet | undefined
  const fontChanged = () => {
    fontGeneration++
    for (const listener of listeners) listener()
  }
  return Object.freeze({
    measurement,
    service,
    getFontGeneration: () => fontGeneration,
    subscribeFontChanges(listener: () => void) {
      if (listeners.size === 0 && typeof document !== 'undefined') {
        fonts = document.fonts
        fonts?.addEventListener('loadingdone', fontChanged)
        fonts?.addEventListener('loadingerror', fontChanged)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          fonts?.removeEventListener('loadingdone', fontChanged)
          fonts?.removeEventListener('loadingerror', fontChanged)
          fonts = undefined
        }
      }
    },
    // invalidate retires owned async work but permits React StrictMode's next
    // effect setup to reuse this runtime safely.
    dispose: () => service.invalidate?.(),
  })
}

export function svgLabelRequestIdentity(request: SvgLabelRequest): string {
  const { font, tabSize, lineGapEm } = request.settings
  return JSON.stringify([request.source, font.family, font.sizePx, font.weight,
    font.style, font.fontReadinessGeneration, tabSize, lineGapEm])
}

function readyState(request: SvgLabelRequest, result: Extract<LabelConversionResult, { kind: 'success' }>): SvgLabelState {
  return Object.freeze({ source: request.source, requestIdentity: svgLabelRequestIdentity(request),
    status: 'ready', layout: result.layout, estimated: false, result })
}

/** Pure immediate view; a new source can never read a previous source's SVG. */
export function initialSvgLabelState(request: SvgLabelRequest, runtime: SvgLabelRuntime): SvgLabelState {
  const cached = runtime.service.peek(request.source, request.settings)
  if (cached?.kind === 'success' && cached.source === request.source) return readyState(request, cached)
  return Object.freeze({ source: request.source, requestIdentity: svgLabelRequestIdentity(request),
    status: 'pending', ...literalSvgLabelLayout(request.source, request.settings) })
}

/**
 * Per-mounted-label transaction controller. start is effect-only; getSnapshot is
 * pure. A generation belongs to this mount, not to a reusable diagram/model ID.
 */
export function createSvgLabelController(runtime: SvgLabelRuntime) {
  let generation = 0
  let state: SvgLabelState | undefined
  const listeners = new Set<() => void>()
  const publish = (next: SvgLabelState) => {
    state = next
    for (const listener of listeners) listener()
  }
  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    start(request: SvgLabelRequest): () => void {
      const token = ++generation
      const current = () => generation === token
      const requestIdentity = svgLabelRequestIdentity(request)
      const cached = runtime.service.peek(request.source, request.settings)
      if (cached?.kind === 'success' && cached.source === request.source) {
        publish(readyState(request, cached))
        return () => { if (current()) generation++ }
      }
      const literal = () => literalSvgLabelLayout(request.source, request.settings, runtime.measurement)
      publish(Object.freeze({ source: request.source, requestIdentity, status: 'pending', ...literal() }))

      // Parser failures also need font readiness: the adapter intentionally
      // returns those before touching font or engine resources.
      void Promise.resolve().then(() => current()
        ? runtime.measurement.ready?.(request.settings.font, request.source) : undefined)
        .then(() => {
          if (current() && state?.requestIdentity === requestIdentity && state.status !== 'ready') {
            publish(Object.freeze({ ...state, ...literal() }))
          }
        }).catch(() => { /* Keep the complete finite literal view on font failure. */ })

      void Promise.resolve().then(() => current()
        ? runtime.service.convert(request.source, request.settings) : undefined)
        .then((result) => {
          if (!current() || result === undefined || result.source !== request.source) return
          if (result.kind === 'success') {
            publish(readyState(request, result))
          } else {
            publish(Object.freeze({ source: request.source, requestIdentity, status: 'fallback',
              result, reason: result.reason, ...literal() }))
          }
        }).catch(() => {
          if (current()) publish(Object.freeze({ source: request.source, requestIdentity,
            status: 'fallback', reason: 'output-error', ...literal() }))
        })
      return () => { if (current()) generation++ }
    },
  })
}
