import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LABEL_SERVICE_LIMITS, type LabelConversionResult } from '../rendering/labels/labelService.ts'
import type { ValidatedSvgElement } from '../rendering/labels/labelSvg.ts'
import { literalSvgLabelLayout } from '../rendering/labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from '../rendering/labels/svgLabelRuntime.ts'
import { getSvgLabelExportCapture, type SvgLabelExportCapture } from '../rendering/svgLabelExportRegistry.ts'
import { SvgPointNodeView } from '../rendering/svgPointNodeView.ts'
import { SvgTexLabelView } from '../rendering/svgLabelView.ts'
import {
  createSvgPreviewExportText,
  isExcludedSvgPreviewExportElement,
  svgPreviewExportSuccessMessage,
  type SvgPreviewBackgroundMode,
  type SvgPreviewExportOptions,
} from './svgPreviewExport.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'

export type SvgExportPreparationObservation = Readonly<
  | { kind: 'preparation-started'; startedAt: number; settlementMs: number }
  | { kind: 'label-settled'; source: string; ownerIdentity?: string; requestIdentity: string;
    startedAt: number; completedAt: number; deadline: number; settlementMs: number;
    outcome: 'success' | 'service-fallback' | 'export-timeout' | 'output-error'; state: SvgLabelState }
  | { kind: 'label-rendered'; source: string; ownerIdentity?: string; requestIdentity: string;
    renderedAt: number; markup: string }
  | { kind: 'preparation-completed'; completedAt: number; outcome: 'success' | 'failure' | 'cancelled' }
>
type SvgExportPreparationObserver = (observation: SvgExportPreparationObservation) => void

/** Optional runtime evidence only; observation cannot interrupt export or reach
 * the detached/live DOM. Callers choose which bounded summaries to retain. */
function observeExport(observer: SvgExportPreparationObserver | undefined, observation: SvgExportPreparationObservation): void {
  try { observer?.(Object.freeze(observation)) } catch { /* Diagnostics do not change output. */ }
}

/** The DOM clone is the complete committed render revision, including projection,
 * viewport, draw order, layer filters and inherited dimming. It never references
 * live geometry or mutable Diagram/camera objects. Only conversion capabilities
 * are shared with the preview; all label inputs are immutable committed copies. */
export type SvgExportSnapshot = {
  readonly backgroundMode: SvgPreviewBackgroundMode
  readonly root: SVGSVGElement
  readonly labels: { readonly target: Element; readonly capture: SvgLabelExportCapture }[]
}

/** Must run synchronously in the click handler, before any asynchronous work. */
export function captureSvgExportSnapshot(svg: SVGSVGElement, options: SvgPreviewExportOptions): SvgExportSnapshot {
  const root = svg.cloneNode(true) as SVGSVGElement
  const labels: SvgExportSnapshot['labels'] = []
  function captureTree(live: Element, clone: Element): void {
    if (isExcludedSvgPreviewExportElement(live)) {
      clone.remove()
      return
    }
    const capture = getSvgLabelExportCapture(live)
    if (capture !== undefined) {
      labels.push({ target: clone, capture })
      return
    }
    if (live.hasAttribute('data-label-request') || live.hasAttribute('data-point-request')) {
      throw new Error('The committed label revision is unavailable.')
    }
    const children = Array.from(clone.children)
    Array.from(live.children).forEach((child, index) => captureTree(child, children[index]))
  }
  captureTree(svg, root)
  return { root, labels, backgroundMode: options.backgroundMode }
}

function aborted(): Error { return new Error('SVG export cancelled.') }
class SvgExportTimeout extends Error {
  constructor() { super('timeout') }
}

/** A second bound protects the export boundary (including injected services and
 * literal font readiness). Production conversion itself remains bounded by the
 * service/worker's own timeout, cancellation, queue and retry policy. */
function within<T>(work: Promise<T>, milliseconds: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => finish(() => reject(aborted()))
    let finished = false
    const timer = setTimeout(() => finish(() => reject(new SvgExportTimeout())), Math.max(0, milliseconds))
    function finish(action: () => void): void {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      action()
    }
    signal?.addEventListener('abort', cancel, { once: true })
    work.then((value) => finish(() => resolve(value)), (error: unknown) => finish(() => reject(error)))
    if (signal?.aborted) cancel()
  })
}

export async function settleSvgExportLabels(
  captures: readonly SvgLabelExportCapture[],
  signal?: AbortSignal,
  options: Readonly<{ settlementMs?: number; observe?: SvgExportPreparationObserver }> = {},
): Promise<readonly SvgLabelState[]> {
  if (signal?.aborted) throw aborted()
  const settlementMs = options.settlementMs ?? LABEL_SERVICE_LIMITS.settlementMs + 50
  if (!Number.isFinite(settlementMs) || settlementMs <= 0) throw new RangeError('Invalid export settlement limit.')
  return Promise.all(captures.map(async (capture): Promise<SvgLabelState> => {
    const { source, settings, runtime, ownerIdentity } = capture
    const requestIdentity = svgLabelRequestIdentity({ source, settings, ownerIdentity })
    const startedAt = Date.now()
    const deadline = startedAt + settlementMs
    let result: LabelConversionResult | undefined
    let reason: SvgLabelState['reason'] = 'output-error'
    let outcome: Extract<SvgExportPreparationObservation, { kind: 'label-settled' }>['outcome'] = 'output-error'
    function observed(state: SvgLabelState): SvgLabelState {
      observeExport(options.observe, { kind: 'label-settled', source, ownerIdentity, requestIdentity,
        startedAt, completedAt: Date.now(), deadline, settlementMs, outcome, state })
      return state
    }
    try {
      result = await within(Promise.resolve().then(() =>
        runtime.service.peek(source, settings) ?? runtime.service.convert(source, settings)), settlementMs, signal)
      if (result?.source === source && result.kind === 'success') {
        outcome = 'success'
        return observed(Object.freeze({ source, requestIdentity, status: 'ready', layout: result.layout, estimated: false, result }))
      }
      if (result?.source === source && result.kind === 'fallback') {
        reason = result.reason
        outcome = 'service-fallback'
      }
      else result = undefined
    } catch (error) {
      if (signal?.aborted) throw aborted()
      if (error instanceof Error && error.message === 'timeout') reason = 'timeout'
      if (error instanceof SvgExportTimeout) outcome = 'export-timeout'
    }
    // Parser failure may precede font loading in the service. Keep the same
    // measured multiline/tab layout as the preview, with one shared deadline.
    if (Date.now() < deadline) {
      try {
        await within(Promise.resolve().then(() => runtime.measurement.ready?.(settings.font, source)),
          deadline - Date.now(), signal)
      } catch { /* Font failure retains the complete finite literal layout. */ }
    }
    if (signal?.aborted) throw aborted()
    return observed(Object.freeze({ source, requestIdentity, status: 'fallback', reason, result,
      ...literalSvgLabelLayout(source, settings, runtime.measurement) }))
  }))
}

/** Supply SVG context to React itself: wrapping an already rendered string is
 * too late, because the HTML server renderer hoists title out of its label. */
export function renderSettledSvgLabelDocument(capture: SvgLabelExportCapture, state: SvgLabelState): string {
  return renderToStaticMarkup(createElement('svg', { xmlns: svgNamespace },
    createElement(capture.pointStyle ? SvgPointNodeView : SvgTexLabelView, { capture, state })))
}

function hasSettledGeometryStructure(element: Element, geometry: ValidatedSvgElement): boolean {
  const expected = geometry.children.filter((child): child is ValidatedSvgElement => typeof child !== 'string')
  const children = Array.from(element.children)
  return element.localName === geometry.tag && children.length === expected.length &&
    expected.every((child, index) => hasSettledGeometryStructure(children[index], child))
}

/** Validate the exact direct subtree before replacement. A parseable document or
 * a non-null first child does not prove that the captured label survived SSR. */
export function extractSettledSvgLabel(
  document: Document, capture: SvgLabelExportCapture, state: SvgLabelState,
): Element {
  const invalid = () => { throw new Error('Invalid settled label SVG.') }
  const isSvg = (element: Element | undefined | null, name: string): element is Element =>
    element?.namespaceURI === svgNamespace && element.localName === name
  const root = document.documentElement
  if (!isSvg(root, 'svg') || document.querySelector('parsererror') || root.childNodes.length !== 1) invalid()
  if (capture.pointStyle) {
    const point = root.firstElementChild
    if (!isSvg(point, 'g') || point.getAttribute('data-point-request') !== state.requestIdentity
      || point.children.length !== 2 || point.childNodes.length !== 2) throw new Error('Invalid settled point SVG.')
    // Compare the complete pure reconstruction, including contour, placement and
    // paint, then apply the existing strict body validator in SVG context.
    const expected = new DOMParser().parseFromString(renderSettledSvgLabelDocument(capture, state), 'image/svg+xml')
    if (!point.isEqualNode(expected.documentElement.firstElementChild)) throw new Error('Invalid settled point SVG.')
    const body = point.lastElementChild!
    root.replaceChildren(body)
    try {
      extractSettledSvgLabel(document, { ...capture, pointStyle: undefined, position: { x: 0, y: 0 } }, state)
    } finally {
      point.appendChild(body)
      root.replaceChildren(point)
    }
    return point
  }
  const label = root.firstElementChild
  if (!isSvg(label, 'g') || label.childNodes.length !== label.children.length) throw new Error('Invalid settled label SVG.')
  if (Array.from(root.querySelectorAll('*')).some((element) => element.namespaceURI !== svgNamespace)) invalid()
  if (state.status === 'pending' || state.source !== capture.source ||
    state.requestIdentity !== svgLabelRequestIdentity(capture) ||
    label.getAttribute('data-label-request') !== state.requestIdentity ||
    label.getAttribute('data-label-state') !== state.status ||
    label.getAttribute('data-label-owner') !== (capture.ownerIdentity ?? null)) invalid()

  const [title, ...body] = Array.from(label.children)
  // XML normalizes physical line endings; request identity above retains the
  // complete source (JSON-escaped), including whitespace, without normalization.
  if (!isSvg(title, 'title') || title.children.length !== 0 ||
    title.textContent !== capture.source.replace(/\r\n?/g, '\n')) invalid()
  if (body.length === 2 && isSvg(body[0], 'rect') &&
    body[0].getAttribute('data-svg-export-exclude') === 'true') body.shift()
  const paint = body[0]
  if (body.length !== 1 || !isSvg(paint, 'g')) invalid()
  const groups = Array.from(paint.children)
  const foreground = groups.at(-1)
  if (groups.length !== (capture.outline ? 2 : 1) ||
    !isSvg(foreground, 'g') || foreground.getAttribute('data-label-content') !== 'true') {
    throw new Error('Invalid settled label SVG.')
  }
  if (capture.outline && (!isSvg(groups[0], 'g') ||
    groups[0].getAttribute('data-label-halo') !== 'true' ||
    groups[0].getAttribute('aria-hidden') !== 'true')) invalid()

  // Require the renderer's visible runs, rather than a path anywhere in the
  // document (which could belong to a sheet, another label, or only the halo).
  // Empty labels and legitimate empty math are allowed by their settled layout.
  const runs = state.layout.placements.filter((item) => item.kind === 'math' || item.kind === 'text')
  for (const group of groups) {
    const children = Array.from(group.children)
    if (children.length !== runs.length || runs.some((run, index) => {
      const child = children[index]
      if (!isSvg(child, run.kind === 'math' ? 'svg' : 'text')) return true
      if (run.kind === 'text') return child.children.length !== 0 ||
        child.textContent !== run.text.replace(/\r\n?/g, '\n')
      const geometry = state.result?.kind === 'success' ? state.result.runs[run.runIndex]?.geometry : undefined
      return geometry === undefined || !hasSettledGeometryStructure(child, geometry.svg)
    })) invalid()
  }
  return label
}

/** Synchronous shared rendering after settlement: no temporary React root,
 * commit timer, live-label replacement or dependence on the live DOM's state. */
export async function prepareSettledSvgExport(
  snapshot: SvgExportSnapshot,
  signal?: AbortSignal,
  options: Readonly<{ observe?: SvgExportPreparationObserver }> = {},
): Promise<string | null> {
  const complete = (text: string | null): string | null => {
    observeExport(options.observe, { kind: 'preparation-completed', completedAt: Date.now(),
      outcome: signal?.aborted ? 'cancelled' : text === null ? 'failure' : 'success' })
    return text
  }
  observeExport(options.observe, { kind: 'preparation-started', startedAt: Date.now(),
    settlementMs: LABEL_SERVICE_LIMITS.settlementMs + 50 })
  try {
    const entries = snapshot.labels.slice()
    const states = await settleSvgExportLabels(entries.map(({ capture }) => capture), signal, options)
    if (signal?.aborted) return complete(null)
    const parser = new DOMParser()
    entries.forEach(({ capture, target }, index) => {
      const markup = renderSettledSvgLabelDocument(capture, states[index])
      // Only the shared renderer's escaped text and validated geometry enter
      // this parser. Raw user input is never interpolated as SVG markup.
      const document = parser.parseFromString(markup, 'image/svg+xml')
      const label = extractSettledSvgLabel(document, capture, states[index])
      if (options.observe !== undefined) {
        observeExport(options.observe, { kind: 'label-rendered', source: capture.source,
          ownerIdentity: capture.ownerIdentity, requestIdentity: states[index].requestIdentity,
          renderedAt: Date.now(), markup: label.outerHTML })
      }
      target.replaceWith(snapshot.root.ownerDocument.importNode(label, true))
    })
    const text = createSvgPreviewExportText(snapshot.root, snapshot)
    if (text === null) return complete(null)
    const document = parser.parseFromString(text, 'image/svg+xml')
    return complete(isStandaloneSvgDocument(document) ? text : null)
  } catch { return complete(null) }
}

function isStandaloneSvgDocument(document: Document): boolean {
  if (document.documentElement.localName !== 'svg' || document.documentElement.namespaceURI !== svgNamespace ||
    document.querySelector('parsererror, script, style, foreignObject, image')) return false
  const root = document.documentElement
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (viewBox !== undefined && (viewBox.length !== 4 || !viewBox.every(Number.isFinite) ||
    viewBox[2] <= 0 || viewBox[3] <= 0)) return false
  for (const name of ['width', 'height']) {
    const value = root.getAttribute(name)
    if (value === null || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px)?$/i.test(value) ||
      !Number.isFinite(Number.parseFloat(value)) || Number.parseFloat(value) <= 0) return false
  }
  const ids = new Set<string>()
  for (const node of document.querySelectorAll('[id]')) {
    if (ids.has(node.id)) return false
    ids.add(node.id)
  }
  for (const node of document.querySelectorAll('*')) {
    for (const { name, value } of Array.from(node.attributes)) {
      if (name === 'href' || name === 'xlink:href') {
        if (!value.startsWith('#') || !ids.has(value.slice(1))) return false
      }
      for (const match of value.matchAll(/url\(\s*['"]?([^\s)'"]+)['"]?\s*\)/gi)) {
        if (!match[1].startsWith('#') || !ids.has(match[1].slice(1))) return false
      }
    }
  }
  return true
}

export function releaseSvgExportSnapshot(snapshot: SvgExportSnapshot): void {
  snapshot.root.replaceChildren()
  snapshot.labels.length = 0
}

export type SvgExportStatus = Readonly<{ kind: 'pending' | 'success' | 'failure'; message: string }>

/** One pending export. Identity guards cover duplicate clicks, cancellation,
 * unmount, late completion, download handoff and status/resource ownership. */
export function createSvgExportController<Request extends { backgroundMode: SvgPreviewBackgroundMode }>(environment: {
  prepare(request: Request, signal: AbortSignal): Promise<string | null>
  download(text: string, request: Request): boolean
  release(request: Request): void
  onStatus(status: SvgExportStatus): void
}) {
  let active: { controller: AbortController; request?: Request } | undefined
  function release(token: NonNullable<typeof active>): void {
    const request = token.request
    token.request = undefined
    if (request !== undefined) {
      try { environment.release(request) } catch { /* Cleanup must restore the action. */ }
    }
  }
  return Object.freeze({
    get pending() { return active !== undefined },
    async start(capture: () => Request): Promise<boolean> {
      if (active !== undefined) return false
      const token = { controller: new AbortController(), request: undefined as Request | undefined }
      active = token
      try {
        // Capture is called before the first await, never from a promise callback.
        const request = capture()
        token.request = request
        environment.onStatus({ kind: 'pending', message: 'Preparing SVG export…' })
        const text = await environment.prepare(request, token.controller.signal)
        if (active !== token) return false
        if (text === null) throw new Error('SVG export failed.')
        if (!environment.download(text, request)) throw new Error('SVG export download failed.')
        environment.onStatus({ kind: 'success', message: svgPreviewExportSuccessMessage(request.backgroundMode) })
        return true
      } catch (error) {
        if (active === token) environment.onStatus({ kind: 'failure',
          message: error instanceof Error && error.message === 'SVG export download failed.'
            ? error.message : 'SVG export failed. The captured view could not be prepared.' })
        return false
      } finally {
        release(token)
        if (active === token) active = undefined
      }
    },
    cancel(): void {
      if (active === undefined) return
      const token = active
      active = undefined
      token.controller.abort()
      release(token)
    },
  })
}
