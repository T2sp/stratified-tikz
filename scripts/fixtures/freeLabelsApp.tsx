// Development-only entry: real App with a controlled conversion adapter and
// serialized read-only diagnostics. No fixture model/history mutation helpers.
import { createRoot } from 'react-dom/client'
import App from '../../src/App.tsx'
import type { AppLabelBrowserSnapshot } from '../../src/App.tsx'
import '../../src/index.css'
import { createCurveStratum, createEmptyDiagram } from '../../src/model/constructors.ts'
import { defaultCurveStyle, defaultLabelStyle } from '../../src/model/styles.ts'
import type { LabelStyle, Vec3 } from '../../src/model/types.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { createBrowserTextMeasurementProvider, createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { inspectAndAssertLabelContent } from './labelBrowserOracle.ts'

type Held = {
  promise: Promise<void>
  release(): void
  fail: boolean
  reason: 'output-error' | 'resource-error'
  requests: Promise<LabelConversionResult>[]
  completed: number
  released: boolean
}
const measurement = createBrowserTextMeasurementProvider()
const service = createLabelService({ measurement, limits: { settlementMs: 30_000 } })
const held = new Map<string, Held>()
const completionOrder: { source: string; kind: string }[] = []
let snapshot: AppLabelBrowserSnapshot | undefined
let requests = 0
const runtime = createSvgLabelRuntime({ measurement, service: {
  peek(source, settings) { return held.has(source) ? undefined : service.peek(source, settings) },
  convert(source, settings) {
    requests++
    const hold = held.get(source)
    const conversion = service.convert(source, settings)
    if (!hold) return conversion
    const pending = conversion.then(async (result): Promise<LabelConversionResult> => {
      await hold.promise
      const delivered: LabelConversionResult = hold.fail
        ? { ...result, kind: 'fallback', reason: hold.reason }
        : result
      hold.completed++
      completionOrder.push({ source, kind: delivered.kind })
      return delivered
    })
    hold.requests.push(pending)
    return pending
  },
} })
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const api = {
  state() {
    if (!snapshot) throw new Error('App has not committed its diagnostics')
    return { ...snapshot, selection: JSON.parse(snapshot.selection) as unknown, requests,
      completionOrder: [...completionOrder] }
  },
  hold(source: string) {
    if (held.has(source)) throw new Error(`Already held: ${source}`)
    let release = () => {}
    const promise = new Promise<void>((resolve) => { release = resolve })
    held.set(source, { promise, release, fail: false, reason: 'output-error', requests: [], completed: 0, released: false })
  },
  pending(source: string) {
    const hold = held.get(source)
    return hold ? { started: hold.requests.length, completed: hold.completed, released: hold.released } : null
  },
  async release(source: string, fail = false, reason: Held['reason'] = 'output-error') {
    const hold = held.get(source)
    if (!hold || hold.requests.length === 0) throw new Error(`No started held request: ${source}`)
    hold.fail = fail
    hold.reason = reason
    hold.released = true
    held.delete(source)
    hold.release()
    await Promise.all(hold.requests)
    await frame()
    await frame()
    return { source, started: hold.requests.length, completed: hold.completed, fail }
  },
  inspectContent(id: string) {
    if (!snapshot) throw new Error('App has not committed')
    const document = JSON.parse(snapshot.json) as { diagram: { labels: { id: string; style: LabelStyle }[] } }
    const label = document.diagram.labels.find((entry) => entry.id === id)
    if (!label) throw new Error(`Missing label ${id}`)
    return inspectAndAssertLabelContent(id, { fontSize: label.style.fontSize * 1.35 })
  },
  documentJson(source: string, options: { position?: Vec3; style?: Partial<LabelStyle> } = {}) {
    const diagram = createEmptyDiagram({ ambientDimension: 2 })
    diagram.labels = [{ id: 'app-label', name: 'App acceptance label', geometricKind: 'label', layer: 0,
      text: source, position: options.position ?? { x: 0, y: 0, z: 0 },
      style: { ...defaultLabelStyle, fontSize: 18, ...options.style } }]
    return serializeDiagram(diagram)
  },
  exportDocumentJson(ambientDimension: 2 | 3 = 2) {
    const diagram = createEmptyDiagram({ ambientDimension })
    const z = ambientDimension === 3 ? 0.5 : 0
    const sources = {
      edit: 'Before $\\alpha^2$', after: 'After $\\beta^3$', ordinary: '日本語 Ω ordinary',
      repeated: '$\\frac{x_1}{y^2}$', inline: '経路 $\\sum_{k=1}^{n}k$',
      malformed: '  "<>&"  $\\undefinedExportCommand{raw}$\t keep literal\n tail  ',
      resource: 'resource $\\gamma$', hidden: '$\\hiddenExportCommand$',
    }
    diagram.layers = [{ value: 0, name: 'Visible', visible: true }, { value: 1, name: 'Hidden', visible: false }]
    diagram.labels = [
      { id: 'export-edit', text: sources.edit, position: { x: -2, y: 1.7, z }, color: '#c02060', anchor: 'west' as const },
      { id: 'export-ordinary', text: sources.ordinary, position: { x: -1, y: 0.9, z }, color: '#304060', anchor: 'center' as const },
      { id: 'export-repeat', text: sources.repeated, position: { x: 1.4, y: 1.7, z }, color: '#7030b0', anchor: 'east' as const },
      { id: 'export-malformed', text: sources.malformed, position: { x: -2, y: -0.3, z }, color: '#602040', anchor: 'west' as const },
      { id: 'export-resource', text: sources.resource, position: { x: 1, y: -1.1, z }, color: '#406020', anchor: 'center' as const },
      { id: 'export-hidden', text: sources.hidden, position: { x: 0, y: 0, z }, color: '#ff0000', anchor: 'center' as const },
    ].map(({ id, text, position, color, anchor }) => ({
      id, name: id, geometricKind: 'label', text, position, layer: id === 'export-hidden' ? 1 : 0,
      style: { ...defaultLabelStyle, color: color as `#${string}`, fontSize: 12, opacity: id === 'export-edit' ? 0.65 : 1, anchor },
    }))
    diagram.strata = [createCurveStratum({ ambientDimension, id: 'export-path', layer: 0,
      points: [{ x: -2, y: -1.8, z: 0 }, { x: 2, y: -1.8, z }],
      style: { ...defaultCurveStyle, strokeColor: '#008080' },
      inlineNodes: [
        { id: 'repeated', text: sources.repeated, position: { kind: 'segment', segmentIndex: 0, value: 0.3 }, options: { placement: 'above', marker: 'dot' } },
        { id: 'mixed', text: sources.inline, position: { kind: 'segment', segmentIndex: 0, value: 0.8 }, options: { placement: 'below', marker: 'none' } },
      ],
    })]
    return { json: serializeDiagram(diagram), sources }
  },
}
declare global { interface Window { stzAppLabels: typeof api } }
window.stzAppLabels = api
const labelBrowserTest = { runtime, observe(next: AppLabelBrowserSnapshot) { snapshot = next } }
createRoot(document.getElementById('root')!).render(<App labelBrowserTest={labelBrowserTest} />)
