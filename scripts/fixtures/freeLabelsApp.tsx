// Development-only entry: real App with a controlled conversion adapter and
// serialized read-only diagnostics. No fixture model/history mutation helpers.
import { createRoot } from 'react-dom/client'
import App from '../../src/App.tsx'
import type { AppLabelBrowserSnapshot } from '../../src/App.tsx'
import '../../src/index.css'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { defaultLabelStyle } from '../../src/model/styles.ts'
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
        ? { ...result, kind: 'fallback', reason: 'output-error' }
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
    held.set(source, { promise, release, fail: false, requests: [], completed: 0, released: false })
  },
  pending(source: string) {
    const hold = held.get(source)
    return hold ? { started: hold.requests.length, completed: hold.completed, released: hold.released } : null
  },
  async release(source: string, fail = false) {
    const hold = held.get(source)
    if (!hold || hold.requests.length === 0) throw new Error(`No started held request: ${source}`)
    hold.fail = fail
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
}
declare global { interface Window { stzAppLabels: typeof api } }
window.stzAppLabels = api
const labelBrowserTest = { runtime, observe(next: AppLabelBrowserSnapshot) { snapshot = next } }
createRoot(document.getElementById('root')!).render(<App labelBrowserTest={labelBrowserTest} />)
