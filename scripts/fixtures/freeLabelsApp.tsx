// Development-only entry: real App with a controlled conversion adapter and
// serialized read-only diagnostics. No fixture model/history mutation helpers.
import { createRoot } from 'react-dom/client'
import App from '../../src/App.tsx'
import { jsonPersistenceExpectation } from './jsonPersistenceExpectation.ts'
import { pointPaintModelDiagnostics } from './pointPaintModelDiagnostics.ts'
import type { AppLabelBrowserSnapshot } from '../../src/App.tsx'
import '../../src/index.css'
import { createPointStratum, createCurveStratum, createEmptyDiagram } from '../../src/model/constructors.ts'
import { defaultCurveStyle, defaultLabelStyle } from '../../src/model/styles.ts'
import type { LabelStyle, Vec3 } from '../../src/model/types.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { createBrowserTextMeasurementProvider, createLabelService } from '../../src/rendering/labels/labelService.ts'
import type { LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { createCoordinateAxesGuide } from '../../src/rendering/coordinateAxesGuide.ts'
import { inspectAndAssertLabelContent, inspectPositionedLiteral, inspectOracleDocumentContext } from './labelBrowserOracle.ts'
import type { Diagram, PointStratum } from '../../src/model/types.ts'

type Held = {
  promise: Promise<void>
  release(): void
  fail: boolean
  reason: 'output-error' | 'resource-error'
  requests: Promise<LabelConversionResult>[]
  completed: number
  released: boolean
  heldAt: number
  releasedAt?: number
}
type ConversionObservation = {
  id: number; source: string; requestedAt: number; convertedAt?: number; deliveredAt?: number
  heldAt?: number; releasedAt?: number; conversionKind?: string; conversionReason?: string
  deliveredKind?: string; deliveredReason?: string; identity?: string
}
const measurement = createBrowserTextMeasurementProvider()
const service = createLabelService({ measurement, limits: { settlementMs: 30_000 } })
const held = new Map<string, Held>()
const completionOrder: { source: string; kind: string }[] = []
let snapshot: AppLabelBrowserSnapshot | undefined
let requests = 0
const conversions: ConversionObservation[] = []
const runtime = createSvgLabelRuntime({ measurement, service: {
  peek(source, settings) { return held.has(source) ? undefined : service.peek(source, settings) },
  convert(source, settings) {
    requests++
    const hold = held.get(source)
    const observation: ConversionObservation = { id: requests, source, requestedAt: Date.now(), heldAt: hold?.heldAt }
    conversions.push(observation)
    const conversion = service.convert(source, settings).then((result) => {
      Object.assign(observation, { convertedAt: Date.now(), conversionKind: result.kind,
        conversionReason: result.kind === 'fallback' ? result.reason : undefined, identity: result.identity })
      if (!hold) Object.assign(observation, { deliveredAt: Date.now(), deliveredKind: result.kind,
        deliveredReason: result.kind === 'fallback' ? result.reason : undefined })
      return result
    })
    if (!hold) return conversion
    const pending = conversion.then(async (result): Promise<LabelConversionResult> => {
      await hold.promise
      const delivered: LabelConversionResult = hold.fail
        ? { ...result, kind: 'fallback', reason: hold.reason }
        : result
      hold.completed++
      Object.assign(observation, { releasedAt: hold.releasedAt, deliveredAt: Date.now(), deliveredKind: delivered.kind,
        deliveredReason: delivered.kind === 'fallback' ? delivered.reason : undefined })
      completionOrder.push({ source, kind: delivered.kind })
      return delivered
    })
    hold.requests.push(pending)
    return pending
  },
} })
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const pointRuntime = () => ({ identity: measurement.identity,
  fontGeneration: runtime.getFontGeneration(), documentRevision: snapshot?.labelDocumentRevision })
function pointExportClickSnapshot(ids: string[]) {
  if (!snapshot) throw new Error('App has not committed its diagnostics')
  const model = JSON.parse(snapshot.json) as { diagram: Diagram }
  const serialize = () => new XMLSerializer().serializeToString(document)
  const before = serialize()
  const points = ids.map((id) => {
    const stratum = model.diagram.strata.find((item): item is PointStratum => item.id === id && item.geometricKind === 'point')
    const point = document.querySelector<SVGGElement>(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
    const body = point?.querySelector<SVGGElement>('[data-label-state]')
    if (!stratum || !point || !body) throw new Error(`Missing export-click point ${id}`)
    const source = stratum.text ?? ''
    const documentContext = inspectOracleDocumentContext(body)
    const literalObservation = inspectPositionedLiteral(body, source)
    return { id, source, modelSource: source, style: structuredClone(stratum.style),
      request: body.getAttribute('data-label-request'), pointRequest: point.getAttribute('data-point-request'),
      owner: point.getAttribute('data-point-node'), status: body.getAttribute('data-label-state'), runtime: pointRuntime(),
      literalObservation: { ...literalObservation, documentContext, documentUnchanged: before === serialize() } }
  })
  return { json: snapshot.json, history: snapshot.history, runtime: pointRuntime(), points,
    documentUnchanged: before === serialize() }
}
let exportClick: ReturnType<typeof pointExportClickSnapshot> | undefined
let exportClickError: string | undefined
let releaseExportClick: (() => void) | undefined
const api = {
  jsonPersistenceExpectation,
  pointRuntime,
  pointPaintModelDiagnostics(id = 'app-point') {
    if (!snapshot) throw new Error('App has not committed its diagnostics')
    return pointPaintModelDiagnostics(snapshot.runtimeDiagramJson, id)
  },
  // Capture at the native click boundary, before the production handler owns
  // its immutable snapshot. Later edits/loads must not supply these inputs.
  armPointExportClick(ids: string[]) {
    releaseExportClick?.()
    exportClick = undefined; exportClickError = undefined
    const button = document.querySelector('button[aria-label="Export current diagram view as SVG"]')
    if (!button) throw new Error('SVG export button missing')
    const capture = () => {
      try { exportClick = pointExportClickSnapshot(ids) }
      catch (error) { exportClickError = error instanceof Error ? error.message : String(error) }
    }
    button.addEventListener('click', capture, { capture: true, once: true })
    releaseExportClick = () => button.removeEventListener('click', capture, true)
  },
  pointExportClick() { return { snapshot: exportClick, error: exportClickError } },
  releasePointExportClick() { releaseExportClick?.(); releaseExportClick = undefined },
  state() {
    if (!snapshot) throw new Error('App has not committed its diagnostics')
    return { ...snapshot, selection: JSON.parse(snapshot.selection) as unknown, requests,
      fontGeneration: runtime.getFontGeneration(),
      completionOrder: [...completionOrder] }
  },
  hold(source: string) {
    if (held.has(source)) throw new Error(`Already held: ${source}`)
    let release = () => {}
    const promise = new Promise<void>((resolve) => { release = resolve })
    held.set(source, { promise, release, fail: false, reason: 'output-error', requests: [], completed: 0, released: false, heldAt: Date.now() })
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
    hold.releasedAt = Date.now()
    held.delete(source)
    hold.release()
    await Promise.all(hold.requests)
    await frame()
    await frame()
    return { source, started: hold.requests.length, completed: hold.completed, fail }
  },
  exportDiagnostics(sources: string[]) {
    return { now: Date.now(), serviceSettlementMs: 30_000,
      labelDocumentRevision: snapshot?.labelDocumentRevision,
      sources: sources.map((source) => {
        const matching = conversions.filter((conversion) => conversion.source === source)
        return { source, requestCount: matching.length, requests: matching.slice(-8).map((entry) => ({ ...entry })) }
      }) }
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
  pointDocumentJson(ambientDimension: 2 | 3 = 2, text?: string) {
    const diagram = createEmptyDiagram({ ambientDimension })
    if (text !== undefined) diagram.strata = [createPointStratum({ ambientDimension, id: 'app-point', text,
      position: { x: 0, y: 0, z: 0 }, style: { kind: 'pointStyle', shape: 'circle', size: 3,
        color: '#3870a0', opacity: .65, fill: 'hollow' } })]
    return serializeDiagram(diagram)
  },
  // Literal version-1 input intentionally lacks paint on both point strata and
  // saved presets. Only the native Load JSON action may normalize this fixture.
  pointPaintLegacyDocumentJson() {
    const diagram = createEmptyDiagram({ ambientDimension: 2 })
    const style = { kind: 'pointStyle' as const, shape: 'circle' as const, size: 3,
      color: '#3870a0' as const, opacity: 1, fill: 'hollow' as const }
    diagram.strata = ['app-point', 'copy-point', 'bulk-point'].map((id, index) => createPointStratum({
      ambientDimension: 2, id, text: index === 0 ? ' 日本 $x+\\color{purple}{y}$ ' : `copy ${index} $g_j$`,
      position: { x: index === 0 ? 0 : index === 1 ? -2 : 2, y: index === 0 ? 0 : -1.5, z: 0 }, style,
    }))
    const raw = JSON.parse(serializeDiagram(diagram)) as { version: number; diagram: Diagram }
    raw.version = 1
    for (const stratum of raw.diagram.strata) if (stratum.geometricKind === 'point') delete stratum.style.paint
    raw.diagram.userStylePresets = [{ id: 'legacy-paint-preset', name: 'Legacy hollow', kind: 'point',
      tikzStyleName: 'legacyHollow', style: { ...style, shape: 'square' } }]
    return JSON.stringify(raw)
  },
  // Input documents only: native Load JSON, selection and export remain the
  // production App paths. Literal declarations are independent oracle inputs.
  pointResponsivePaintDocumentJson(shape: 'circle' | 'triangle' = 'circle', variant: 'solid' | 'disabled' | 'transparent' | 'dashed' = 'solid') {
    const diagram = createEmptyDiagram({ ambientDimension: 2 })
    // App fit-to-view includes the coordinate axes, even for a one-point input.
    // Their model-space midpoint is deliberately interior; an origin fixture
    // leaves only the fit padding below it and clips the declared 20pt border.
    // Native preflight separately proves the complete shape/control envelope.
    const axes = createCoordinateAxesGuide(2)
    if (!axes) throw new Error('Responsive point fixture requires coordinate axes')
    const xs = axes.fitPoints.map(({ x }) => x), ys = axes.fitPoints.map(({ y }) => y)
    const position = { x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2, z: 0 }
    diagram.strata = [createPointStratum({ ambientDimension: 2, id: 'app-point', text: 'Scale',
      position, style: { kind: 'pointStyle', shape, size: 32,
        color: '#cc0000', opacity: 1, fill: 'filled', paint: {
          text: { color: '#000000', opacity: 1 }, fill: { enabled: true, color: '#cceeff', opacity: 1 },
          stroke: { enabled: variant !== 'disabled', color: '#cc0000', opacity: variant === 'transparent' ? 0 : 1,
            width: 20, lineStyle: variant === 'dashed' ? 'dashed' : 'solid',
            ...(variant === 'dashed' ? { dashPattern: [12, 8] } : {}),
            dashPhase: variant === 'dashed' ? 3 : 0, lineCap: 'butt', lineJoin: 'miter' },
        } } })]
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
