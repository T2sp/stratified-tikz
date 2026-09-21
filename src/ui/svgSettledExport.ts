import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LABEL_SERVICE_LIMITS, type LabelConversionResult } from '../rendering/labels/labelService.ts'
import { literalSvgLabelLayout } from '../rendering/labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from '../rendering/labels/svgLabelRuntime.ts'
import { getSvgLabelExportCapture, type SvgLabelExportCapture } from '../rendering/svgLabelExportRegistry.ts'
import { SvgTexLabelView } from '../rendering/svgLabelView.ts'
import {
  createSvgPreviewExportText,
  isExcludedSvgPreviewExportElement,
  svgPreviewExportSuccessMessage,
  type SvgPreviewBackgroundMode,
  type SvgPreviewExportOptions,
} from './svgPreviewExport.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'

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
    if (live.hasAttribute('data-label-request')) {
      throw new Error('The committed label revision is unavailable.')
    }
    const children = Array.from(clone.children)
    Array.from(live.children).forEach((child, index) => captureTree(child, children[index]))
  }
  captureTree(svg, root)
  return { root, labels, backgroundMode: options.backgroundMode }
}

function aborted(): Error { return new Error('SVG export cancelled.') }

/** A second bound protects the export boundary (including injected services and
 * literal font readiness). Production conversion itself remains bounded by the
 * service/worker's own timeout, cancellation, queue and retry policy. */
function within<T>(work: Promise<T>, milliseconds: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => finish(() => reject(aborted()))
    let finished = false
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), Math.max(0, milliseconds))
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
  options: Readonly<{ settlementMs?: number }> = {},
): Promise<readonly SvgLabelState[]> {
  if (signal?.aborted) throw aborted()
  const settlementMs = options.settlementMs ?? LABEL_SERVICE_LIMITS.settlementMs + 50
  if (!Number.isFinite(settlementMs) || settlementMs <= 0) throw new RangeError('Invalid export settlement limit.')
  return Promise.all(captures.map(async (capture): Promise<SvgLabelState> => {
    const { source, settings, runtime, ownerIdentity } = capture
    const requestIdentity = svgLabelRequestIdentity({ source, settings, ownerIdentity })
    const deadline = Date.now() + settlementMs
    let result: LabelConversionResult | undefined
    let reason: SvgLabelState['reason'] = 'output-error'
    try {
      result = await within(Promise.resolve().then(() =>
        runtime.service.peek(source, settings) ?? runtime.service.convert(source, settings)), settlementMs, signal)
      if (result?.source === source && result.kind === 'success') {
        return Object.freeze({ source, requestIdentity, status: 'ready', layout: result.layout, estimated: false, result })
      }
      if (result?.source === source && result.kind === 'fallback') reason = result.reason
      else result = undefined
    } catch (error) {
      if (signal?.aborted) throw aborted()
      if (error instanceof Error && error.message === 'timeout') reason = 'timeout'
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
    return Object.freeze({ source, requestIdentity, status: 'fallback', reason, result,
      ...literalSvgLabelLayout(source, settings, runtime.measurement) })
  }))
}

/** Synchronous shared rendering after settlement: no temporary React root,
 * commit timer, live-label replacement or dependence on the live DOM's state. */
export async function prepareSettledSvgExport(snapshot: SvgExportSnapshot, signal?: AbortSignal): Promise<string | null> {
  try {
    const entries = snapshot.labels.slice()
    const states = await settleSvgExportLabels(entries.map(({ capture }) => capture), signal)
    if (signal?.aborted) return null
    const parser = new DOMParser()
    entries.forEach(({ capture, target }, index) => {
      const markup = renderToStaticMarkup(createElement(SvgTexLabelView, { capture, state: states[index] }))
      // Only the shared renderer's escaped text and validated geometry enter
      // this parser. Raw user input is never interpolated as SVG markup.
      const document = parser.parseFromString(`<svg xmlns="${svgNamespace}">${markup}</svg>`, 'image/svg+xml')
      const label = document.documentElement.firstElementChild
      if (document.querySelector('parsererror') || label === null) throw new Error('Invalid label SVG.')
      target.replaceWith(snapshot.root.ownerDocument.importNode(label, true))
    })
    const text = createSvgPreviewExportText(snapshot.root, snapshot)
    if (text === null) return null
    const document = parser.parseFromString(text, 'image/svg+xml')
    return isStandaloneSvgDocument(document) ? text : null
  } catch { return null }
}

function isStandaloneSvgDocument(document: Document): boolean {
  if (document.documentElement.localName !== 'svg' ||
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
