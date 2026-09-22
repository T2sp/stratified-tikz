// Development-only browser fixture. All drawing, picking, geometry editing,
// history, conversion, and export operations below use production modules.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { SvgDiagram } from '../../src/rendering/SvgDiagram.tsx'
import type { SvgDiagramProps } from '../../src/rendering/SvgDiagram.tsx'
import type { SvgTexLabelSnapshot } from '../../src/rendering/SvgTexLabel.tsx'
import type { PointStratum, PointStyle, CurveStratum, Diagram, LabelAnchor, LabelStyle, PathInlineNode, TextLabel, Vec3 } from '../../src/model/types.ts'
import { createPointStratum, createCurveStratum, createEmptyDiagram, createSheetStratum } from '../../src/model/constructors.ts'
import { defaultPointStyle, defaultLabelStyle, defaultSheetStyle } from '../../src/model/styles.ts'
import { defaultVisibilityOptions, resolveVisibilityOptions } from '../../src/model/visibility.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { pathInlineNodePoint } from '../../src/model/pathInlineNodes.ts'
import { reverseCurvePathDirection } from '../../src/model/paths.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { createBrowserTextMeasurementProvider, createLabelService, LABEL_SERVICE_LIMITS } from '../../src/rendering/labels/labelService.ts'
import { parseLabelText } from '../../src/rendering/labelText.ts'
import type { LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import { loadMathJaxEngine, MathJaxFailure } from '../../src/rendering/labels/mathjaxEngine.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { resolveSvgCamera } from '../../src/rendering/svgCamera.ts'
import { collectSvgPreviewSelectionCandidates, createSvgSelectionCandidateVisibility } from '../../src/rendering/svgHitTesting.ts'
import { mapClientPointToViewBox } from '../../src/rendering/svgViewBox.ts'
import { projectToSvgPoint, svgPointToModelOnWorkPlane } from '../../src/rendering/svgProjection.ts'
import { createSvgPreviewExportText } from '../../src/ui/svgPreviewExport.ts'
import { applyGeometryHandleDragToEditorState, startGeometryHandleDragSession } from '../../src/ui/geometryHandles.ts'
import type { GeometryHandleDragSession } from '../../src/ui/geometryHandles.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange } from '../../src/ui/undo.ts'
import type { UndoableEditorState } from '../../src/ui/undo.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import { inspectAndAssertLabelContent } from './labelBrowserOracle.ts'
import { applyBulkDeleteToEditorState, applyBulkDuplicateToEditorState } from '../../src/ui/bulkEditing.ts'
import { applySplitSelectedPathToEditorState } from '../../src/ui/pathSplitting.ts'

type LabelInput = { id: string; text: string; position?: Vec3; layer?: number; style?: Partial<LabelStyle> }
type CurveInput = { id: string; inlineNodes: PathInlineNode[]; points?: Vec3[]; layer?: number; color?: `#${string}`; kind?: 'polyline' | 'cubicBezier'; pathLabel?: string }
type FixtureOptions = {
  labels: LabelInput[]
  points?: { id: string; text: string; position?: Vec3; layer?: number; style?: Partial<PointStyle> }[]
  curves?: CurveInput[]
  paths?: CurveStratum[]
  ambientDimension?: 2 | 3
  layers?: Diagram['layers']
  occlusion?: 'autoHide' | 'autoDim'
}
type Deferred = { promise: Promise<void>; release(): void; fail: boolean; requests: Promise<LabelConversionResult>[]; heldAt: number; releasedAt?: number }
type RequestObservation = {
  id: number; serviceEpoch: number; source: string; fontSize: number; held: boolean
  phase: 'converting' | 'held' | 'delivered'; result?: string; reason?: string
  requestedAt: number; engineStartedAt?: number; engineCompletedAt?: number; convertedAt?: number
  heldAt?: number; releasedAt?: number; deliveredAt?: number
  conversion?: { kind: string; reason?: string; identity: string; generation: number; configurationIdentity: string }
}
const container = document.getElementById('root')!
let root = createRoot(container)
let sourceRevision = 0
let renderEpoch = 0
let editor: UndoableEditorState
let props: Partial<SvgDiagramProps> = {}
let dragSession: GeometryHandleDragSession | null = null
let serviceMode: 'real' | 'load-error' | 'output-error' = 'real'
let invocationCount = 0
let requestCount = 0
let dragCount = 0
const selectionEvents: SelectedElement[] = []
const callbackEvents: { selection: SelectedElement; options: unknown }[] = []
const requests: RequestObservation[] = []
const layouts = new Map<string, { id: string; source: string; requestIdentity: string; status: SvgTexLabelSnapshot['status'] }>()
const holds = new Map<string, Deferred>()
const measurement = createBrowserTextMeasurementProvider()
const fixtureSettlementMs = 20_000
let serviceEpoch = 0

function makeService() {
  const epoch = ++serviceEpoch
  return createLabelService({
    measurement,
    limits: { settlementMs: fixtureSettlementMs },
    async loadEngine(signal) {
      if (serviceMode === 'load-error') throw new MathJaxFailure('resource-error', 'Intentional fixture load failure')
      const engine = await loadMathJaxEngine(signal)
      return {
        identity: engine.identity,
        dispose: () => engine.dispose?.(),
        async convert(runs) {
          invocationCount++
          const matching = requests.filter((request) => {
            if (request.serviceEpoch !== epoch || request.phase !== 'converting') return false
            const parsed = parseLabelText(request.source)
            return parsed.kind === 'parsed'
              && JSON.stringify(parsed.runs.filter((run) => run.kind === 'math').map(({ tex, display }) => ({ tex, display }))) === JSON.stringify(runs)
          })
          matching.forEach((request) => { request.engineStartedAt = Date.now() })
          try {
            if (serviceMode === 'output-error') throw new MathJaxFailure('output-error', 'Intentional fixture output failure')
            return await engine.convert(runs)
          } finally { matching.forEach((request) => { request.engineCompletedAt = Date.now() }) }
        },
      }
    },
  })
}
let service = makeService()
function makeRuntime() {
  const ownedService = service
  const epoch = serviceEpoch
  return createSvgLabelRuntime({ measurement, service: {
    peek(source, settings) {
      return holds.has(source) ? undefined : ownedService.peek(source, settings)
    },
    convert(source, settings) {
      requestCount++
      const held = holds.get(source)
      const request: RequestObservation = { id: requestCount, serviceEpoch: epoch, source, fontSize: settings.font.sizePx,
        held: !!held, heldAt: held?.heldAt, requestedAt: Date.now(), phase: 'converting' }
      requests.push(request)
      const completion = ownedService.convert(source, settings).then(async (result) => {
        request.convertedAt = Date.now()
        request.conversion = { kind: result.kind, reason: result.kind === 'fallback' ? result.reason : undefined,
          identity: result.identity, generation: result.generation, configurationIdentity: result.configurationIdentity }
        if (held) { request.phase = 'held'; await held.promise }
        const delivered: LabelConversionResult = held?.fail
          ? { ...result, kind: 'fallback', reason: 'output-error' } : result
        request.phase = 'delivered'
        request.result = delivered.kind
        request.reason = delivered.kind === 'fallback' ? delivered.reason : undefined
        request.releasedAt = held?.releasedAt
        request.deliveredAt = Date.now()
        return delivered
      })
      held?.requests.push(completion)
      return completion
    },
  } })
}
let runtime = makeRuntime()

function redraw() {
  flushSync(() => root.render(<SvgDiagram
    key={renderEpoch}
    diagram={editor.editableDiagram}
    width={900}
    height={700}
    selectedElement={editor.selectedElement}
    layerFilter={editor.layerFilter}
    showGeometryHandles
    labelRuntime={runtime}
    labelDocumentRevision={sourceRevision}
    onLabelLayoutChange={(id, snapshot, ownerIdentity) => {
      if (snapshot === null) layouts.delete(ownerIdentity)
      else layouts.set(ownerIdentity, { id, source: snapshot.source, requestIdentity: snapshot.requestIdentity, status: snapshot.status })
    }}
    {...props}
    onSelectionChange={(selectedElement, options) => {
      selectionEvents.push(selectedElement)
      callbackEvents.push({ selection: selectedElement, options })
      editor = { ...editor, selectedElement }
      redraw()
    }}
    onGeometryHandleDragStart={() => { dragSession = startGeometryHandleDragSession(editor.editableDiagram) }}
    onGeometryHandleDrag={(target, point, height, camera) => {
      if (!dragSession) return
      dragCount++
      const position = svgPointToModelOnWorkPlane(camera, point, height, { kind: 'xy', z: 0 })
      editor = applyGeometryHandleDragToEditorState(editor, dragSession, target, position)
      redraw()
    }}
    onGeometryHandleDragEnd={() => { dragSession = null }}
  />))
  document.getElementById('interaction-status')!.textContent = JSON.stringify({
    selection: editor.selectedElement, clicks: selectionEvents.length, drags: dragCount,
    labels: editor.editableDiagram.labels.map(({ id, position }) => ({ id, position })),
  })
}

function mount(options: FixtureOptions) {
  sourceRevision++
  props = {}
  const diagram = createEmptyDiagram({ ambientDimension: options.ambientDimension ?? 2 })
  diagram.camera = diagram.ambientDimension === 2
    ? { mode: '2d', scale: 100, origin: { x: 450, y: 350 } }
    : { mode: '3d', kind: 'orthographic', thetaDeg: 45, phiDeg: 25, zoom: 100, pan: { x: 450, y: 350 } }
  diagram.labels = options.labels.map(({ id, text, position, layer, style }, index): TextLabel => ({
    id, name: id, geometricKind: 'label', text, layer: layer ?? index + 1,
    position: position ?? { x: ((index % 3) - 1) * 2.8, y: (1 - Math.floor(index / 3)) * 1.6, z: 0 },
    style: { ...defaultLabelStyle, fontSize: 18, ...style },
  }))
  diagram.strata = [...(options.points ?? []).map((point) => createPointStratum({
    ambientDimension: diagram.ambientDimension, ...point, position: point.position ?? { x: 0, y: 0, z: 0 },
    style: { ...defaultPointStyle, fill: 'hollow', ...point.style },
  })), ...(options.paths ?? []), ...(options.curves ?? []).map((curve, index) => {
    const result = createCurveStratum({ ambientDimension: diagram.ambientDimension, id: curve.id, name: curve.id,
      kind: curve.kind, inlineNodes: curve.inlineNodes, pathLabel: curve.pathLabel, layer: curve.layer ?? index,
      points: curve.points ?? [{ x: -1.5, y: 1.5 - index, z: 0 }, { x: 1.5, y: 1.5 - index, z: 0 }] })
    return curve.color ? { ...result, style: { ...result.style, strokeColor: curve.color } } : result
  })]
  if (options.layers) diagram.layers = options.layers
  if (options.occlusion) {
    diagram.camera = { mode: '3d', kind: 'orthographic', thetaDeg: 90, phiDeg: 0, zoom: 100, pan: { x: 450, y: 350 } }
    diagram.strata = [...diagram.strata, createSheetStratum({ ambientDimension: 3, id: 'sheet', name: 'Occluding sheet', style: defaultSheetStyle,
      corners: [{ x: -2, y: 0, z: -2 }, { x: 2, y: 0, z: -2 }, { x: 2, y: 0, z: 2 }, { x: -2, y: 0, z: 2 }], layer: 0 })]
    props.visibilityOptions = { ...defaultVisibilityOptions, enabled: true, labelVisibility: options.occlusion }
  }
  editor = { editableDiagram: diagram, selectedElement: null, layerFilter: { kind: 'all' },
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null, history: createDiagramHistory(diagram) }
  selectionEvents.length = 0
  callbackEvents.length = 0
  dragCount = 0
  redraw()
}

function mutateLabel(id: string, change: Partial<TextLabel>) {
  const diagram = { ...editor.editableDiagram, labels: editor.editableDiagram.labels.map((label) =>
    label.id === id ? { ...label, ...change, style: { ...label.style, ...change.style } } : label) }
  editor = commitDiagramChange(editor, { ...editor, editableDiagram: diagram })
  redraw()
}

function mutateCurve(id: string, update: (curve: CurveStratum) => CurveStratum) {
  const diagram = { ...editor.editableDiagram, strata: editor.editableDiagram.strata.map((stratum) =>
    stratum.id === id && stratum.geometricKind === 'curve' ? update(stratum) : stratum) }
  editor = commitDiagramChange(editor, { ...editor, editableDiagram: diagram })
  redraw()
}

function mutateInlineNode(pathId: string, nodeId: string, change: Partial<PathInlineNode>) {
  mutateCurve(pathId, (curve) => ({ ...curve, inlineNodes: curve.inlineNodes?.map((node) =>
    node.id === nodeId ? { ...node, ...change, options: { ...node.options, ...change.options } } : node) }))
}

function state() {
  const diagram = editor.editableDiagram
  const camera = resolveSvgCamera(diagram, 900, 700, { ...props, viewAdjustment: props.cameraViewAdjustment })
  return {
    invocationCount, requestCount, dragCount, serviceEpoch, serviceStats: service.stats(),
    selection: editor.selectedElement, selectionEvents, callbackEvents,
    layouts: Object.fromEntries(layouts),
    requests: requests.map((entry) => ({ ...entry })), sourceRevision, camera,
    labels: diagram.labels,
    points: diagram.strata.filter((stratum) => stratum.geometricKind === 'point'),
    curves: diagram.strata.filter((stratum) => stratum.geometricKind === 'curve'),
    nodePositions: Object.fromEntries(diagram.strata.flatMap((curve) => curve.geometricKind !== 'curve' ? []
      : (curve.inlineNodes ?? []).flatMap((node) => {
        const point = pathInlineNodePoint(curve, node, diagram.ambientDimension)
        return point ? [[JSON.stringify([curve.id, node.id]), projectToSvgPoint(camera, point, 700)]] : []
      }))),
    positions: Object.fromEntries(diagram.labels.map((label) => [label.id, projectToSvgPoint(camera, label.position, 700)])),
    json: serializeDiagram(diagram), history: JSON.stringify(editor.history),
    tikz: generateTikz(diagram), inlineTikz: generateTikz(diagram, { exportMode: 'inlineMath' }),
  }
}

/** Bounded, read-only native-event diagnostics for the curve-only 3D fixture.
 * Capture before React handles the click; read feedback after its real handler.
 * No cycle helper, selection setter, or mutable runtime state is exposed. */
function observeInlineSelectionClicks() {
  const svg = container.querySelector<SVGSVGElement>('svg.svg-diagram')!
  const mountedDiagram = editor.editableDiagram, mountedRuntime = runtime
  const elements = Array.from(svg.querySelectorAll('[data-path-inline-node-path-id], [data-label-state]'))
  const feedback = () => {
    const text = svg.querySelector('.svg-selection-cycle-feedback text')?.textContent ?? null
    const match = text === null ? null : /^Selected (\d+)\/(\d+): (.*)$/u.exec(text)
    return { text, index: match ? Number(match[1]) - 1 : null,
      count: match ? Number(match[2]) : null, description: match?.[3] ?? null }
  }
  function candidatesAt(event: MouseEvent) {
    const diagram = editor.editableDiagram
    // With only curves there are no free-label bounds or point/label occlusion
    // maps to mirror. Reject reuse on a scene where that would cease to hold.
    if (diagram.ambientDimension !== 3 || diagram.labels.length !== 0
      || diagram.strata.some((stratum) => stratum.geometricKind !== 'curve')) {
      throw new Error('Inline click diagnostics require the curve-only 3D fixture')
    }
    const camera = resolveSvgCamera(diagram, 900, 700, { ...props, viewAdjustment: props.cameraViewAdjustment })
    const visibilityOptions = resolveVisibilityOptions(diagram, props.visibilityOptions)
    const bounds = svg.getBoundingClientRect()
    const client = { x: event.clientX, y: event.clientY }
    const point = mapClientPointToViewBox(client, bounds, { width: 900, height: 700 })
    const collection = collectSvgPreviewSelectionCandidates({ diagram, camera, viewportHeight: 700, point,
      layerFilter: editor.layerFilter, showCoordinateAnchors: props.showCoordinateAnchors,
      visibility: createSvgSelectionCandidateVisibility({ visibilityOptions }), includeDiagnostics: true })
    return { altKey: event.altKey, isTrusted: event.isTrusted, client, point,
      bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      camera, sourceRevision, renderEpoch, layerFilter: editor.layerFilter, visibilityOptions,
      selectionBefore: editor.selectedElement, callbacksBefore: callbackEvents.length,
      feedbackBefore: feedback(), ...collection }
  }
  const events: ReturnType<typeof candidatesAt>[] = []
  const limit = 16
  let dropped = 0
  const capture = (event: MouseEvent) => {
    if (!(event.target instanceof Node) || !svg.contains(event.target)) return
    if (events.length === limit) { dropped++; return }
    events.push(candidatesAt(event))
  }
  document.addEventListener('click', capture, true)
  return {
    read() {
      return structuredClone({ events, limit, dropped, feedback: feedback(),
        continuity: { svg: svg === container.querySelector('svg.svg-diagram'),
          elements: elements.every((element) => element.isConnected && svg.contains(element)),
          diagram: mountedDiagram === editor.editableDiagram, runtime: mountedRuntime === runtime } })
    },
    dispose() { document.removeEventListener('click', capture, true) },
  }
}

const api = {
  mount, mutateLabel, mutateInlineNode, state, observeInlineSelectionClicks,
  mutatePoint(id: string, change: Partial<PointStratum>) {
    const diagram = { ...editor.editableDiagram, strata: editor.editableDiagram.strata.map((point) =>
      point.id === id && point.geometricKind === 'point'
        ? { ...point, ...change, style: { ...point.style, ...change.style } } : point) }
    editor = commitDiagramChange(editor, { ...editor, editableDiagram: diagram })
    redraw()
  },
  reverseCurve(id: string) { mutateCurve(id, (curve) => reverseCurvePathDirection(curve) ?? curve) },
  duplicateCurve(id: string) {
    editor = applyBulkDuplicateToEditorState({ ...editor, selectedElement: { kind: 'stratum', id }, layerOperationStatus: '' })
    redraw()
  },
  splitCurve(id: string, segmentIndex = 0, t = 0.5) {
    editor = applySplitSelectedPathToEditorState({ ...editor, selectedElement: { kind: 'stratum', id }, layerOperationStatus: '' }, { segmentIndex, t })
    redraw()
  },
  deleteCurve(id: string) {
    editor = applyBulkDeleteToEditorState({ ...editor, selectedElement: { kind: 'stratum', id }, layerOperationStatus: '' })
    redraw()
  },
  roundTrip() {
    const parsed = parseSavedDiagramJson(serializeDiagram(editor.editableDiagram))
    if (!parsed.ok) throw new Error(parsed.error)
    sourceRevision++
    editor = { ...editor, editableDiagram: parsed.diagram }
    redraw()
  },
  inspectContent(id: string) {
    const label = editor.editableDiagram.labels.find((entry) => entry.id === id)
    if (!label) throw new Error(`Unknown label ${id}`)
    return inspectAndAssertLabelContent(id, { fontSize: label.style.fontSize * 1.35 })
  },
  setLayers(layers: Diagram['layers']) {
    editor = { ...editor, editableDiagram: { ...editor.editableDiagram, layers } }
    redraw()
  },
  setVisibility(labelVisibility: 'autoHide' | 'autoDim' | 'alwaysForeground') {
    props = { ...props, visibilityOptions: { ...defaultVisibilityOptions, enabled: true, labelVisibility } }
    redraw()
  },
  deleteLabel(id: string) {
    editor = { ...editor, editableDiagram: { ...editor.editableDiagram, labels: editor.editableDiagram.labels.filter((label) => label.id !== id) } }
    redraw()
  },
  setProps(next: Partial<SvgDiagramProps>) { props = { ...props, ...next }; redraw() },
  refreshFonts() { document.fonts.dispatchEvent(new Event('loadingdone')) },
  select(selectedElement: SelectedElement) { editor = { ...editor, selectedElement }; redraw() },
  filter(layer: number | null) { editor = { ...editor, layerFilter: layer === null ? { kind: 'all' } : { kind: 'layer', layer } }; redraw() },
  undo() { editor = undoLastDiagramChange(editor); redraw() },
  redo() { editor = redoLastDiagramChange(editor); redraw() },
  hold(source: string) {
    let release = () => {}
    const promise = new Promise<void>((resolve) => { release = resolve })
    holds.set(source, { promise, release, fail: false, requests: [], heldAt: Date.now() })
  },
  async release(source: string, fail = false) {
    const held = holds.get(source)
    if (!held || held.requests.length === 0) throw new Error(`Release before request started: ${source}`)
    {
      held.fail = fail
      held.releasedAt = Date.now()
      holds.delete(source)
      held.release()
      await Promise.allSettled(held.requests)
      // Allow React to commit every released subscriber before observation.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }
  },
  exportDiagnostics(source: string) {
    const matching = requests.filter((request) => request.source === source)
    return { source, serviceEpoch, sourceRevision, now: Date.now(),
      limits: { serviceMs: fixtureSettlementMs, productionServiceMs: LABEL_SERVICE_LIMITS.settlementMs },
      requestCount: matching.length, requests: matching.slice(-8).map((request) => ({ ...request })),
      heldAt: holds.get(source)?.heldAt }
  },
  async changeService(mode: typeof serviceMode) {
    root.unmount()
    service.invalidate()
    serviceMode = mode
    holds.clear()
    service = makeService()
    runtime = makeRuntime()
    root = createRoot(container)
    renderEpoch++
  },
  // A transient resource outage can recover through the mounted production
  // runtime and the same public service. Unlike changeService this does not
  // replace the service, root, document, subscriptions, or current selection.
  setServiceMode(mode: typeof serviceMode) { serviceMode = mode },
  unmount() { flushSync(() => root.render(null)) },
  remount() { renderEpoch++; redraw() },
  export(backgroundMode: 'transparent' | 'white' = 'transparent') {
    return createSvgPreviewExportText(container.querySelector('svg.svg-diagram')!, { backgroundMode })
  },
  runSelfChecks,
}
declare global { interface Window { stzLabels: typeof api } }
window.stzLabels = api

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
function assertBrowser(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function displayed(id: string) {
  const element = container.querySelector<SVGGElement>(`[data-label-id="${id}"] [data-label-state]`)
  assertBrowser(element, `${id}: mounted production label`)
  return element
}
async function waitSettled() {
  const deadline = performance.now() + 30_000
  while (container.querySelector('[data-label-state="pending"]')) {
    assertBrowser(performance.now() < deadline, 'Labels settled within the bounded browser check')
    await nextFrame()
  }
}
function showOverlap(fallback = false) {
  mount({ labels: ['overlapA', 'overlapB'].map((id) => ({ id,
    text: fallback ? 'literal $invalid' : '$\\frac{F^{(1)}L}{\\alpha \\Rightarrow \\beta}$',
    position: { x: 0, y: 0, z: 0 }, style: { fontSize: 32 },
  })) })
}

/** Available to native UI automation without console/code injection. These are
 * real DOM assertions; native click/Alt-click/drag remain separate UI checks. */
async function runSelfChecks() {
  const status = document.getElementById('check-status')!
  const evidence: string[] = []
  const record = (message: string) => { evidence.push(message); status.textContent = evidence.join('\n') }
  status.textContent = 'Running checks against the production renderer…'
  try {
    const literal = '  "<>&" \\textbf{bad}\t keep \\slash\r\n tail  '
    const sources = [
      '$F^{(1)}L$', '$\\alpha \\colon f \\Rightarrow g$', '$\\frac{1}{1+\\frac{x}{y}}$',
      '日本語 $x_i$ と $\\beta$', 'first $x$\nsecond $y$',
      '$\\begin{matrix}a & b \\\\\n c & d\\end{matrix}$', literal, '$\\unknownPreviewMacro{x}$', 'invalid $',
    ]
    mount({ labels: sources.map((text, index) => ({ id: `check${index}`, text })) })
    const before = state()
    await waitSettled()
    for (const [index, text] of sources.entries()) {
      const element = displayed(`check${index}`)
      assertBrowser(element.getAttribute('data-label-source') === text, `Exact source ${index}`)
      assertBrowser(element.getAttribute('data-label-state') === (index < 6 ? 'ready' : 'fallback'), `Result ${index}`)
      assertBrowser((element.querySelectorAll('[data-label-math]').length > 0) === (index < 6), `Whole-label result ${index}`)
      await api.inspectContent(`check${index}`)
    }
    const after = state()
    assertBrowser(before.json === after.json && before.history === after.history && before.tikz === after.tikz && before.inlineTikz === after.inlineTikz,
      'Conversion did not change JSON/history/either TikZ output')
    assertBrowser(displayed('check3').querySelectorAll('[data-label-math]').length === 2, 'Multiple Japanese/math runs')
    assertBrowser(displayed('check5').querySelectorAll('[data-label-math]').length === 1, 'Math newline remains one formula')
    assertBrowser(!container.querySelector('foreignObject,image'), 'Only SVG text/geometry')
    const literalText = displayed('check6').querySelectorAll('text')
    assertBrowser(literalText.length === 3 && literalText[0].textContent?.startsWith('  "<>&"'), 'Literal spaces/tab/CRLF fragments')
    assertBrowser(Array.from(literalText).every((node) => getComputedStyle(node).whiteSpace === 'pre'), 'Whitespace preserved visually')
    record('PASS: real MathJax, Japanese, fractions, multiple runs, math/text newlines, exact literal fallback, JSON/history/TikZ unchanged')

    const anchors: LabelAnchor[] = ['center', 'north', 'south', 'east', 'west', 'north east', 'north west', 'south east', 'south west']
    mount({ labels: anchors.map((anchor, index) => ({ id: `a${index}`, text: '$\\frac{x_1}{y^2}$', style: { anchor, fontSize: 22, color: '#d02080', opacity: 0.6 } })) })
    await waitSettled()
    for (const [index, anchor] of anchors.entries()) {
      const element = displayed(`a${index}`)
      const [minX, minY, maxX, maxY] = element.getAttribute('data-label-bounds')!.split(' ').map(Number)
      await api.inspectContent(`a${index}`)
      assertBrowser(Math.abs(anchor.includes('west') ? minX : anchor.includes('east') ? maxX : minX + maxX) < 1e-6, `${anchor} horizontal anchor`)
      assertBrowser(Math.abs(anchor.includes('north') ? minY : anchor.includes('south') ? maxY : minY + maxY) < 1e-6, `${anchor} vertical anchor`)
    }
    const count = invocationCount
    mutateLabel('a0', { position: { x: 0.7, y: 0.2, z: 0 }, style: { ...editor.editableDiagram.labels[0].style, color: '#2040b0', opacity: 0.3, fontSize: 30 } })
    api.setProps({ cameraViewAdjustment: { zoom: 1.8, pan: { x: 20, y: -10 } } })
    api.select({ kind: 'label', id: 'a0' })
    await waitSettled()
    assertBrowser(invocationCount === count, 'Movement/font/color/opacity/camera/selection reuse math conversion')
    record(`PASS: nine anchors, independent visible-content extents, tall math, paint/font/camera reuse (engine count ${count})`)

    mount({ ambientDimension: 3, labels: [{ id: 'projected', text: '$\\alpha \\Rightarrow g$', position: { x: 0.6, y: 0.4, z: 0.7 } }] })
    await waitSettled()
    const beforeCamera = invocationCount
    api.setProps({ cameraOverride: { mode: '3d', kind: 'orthographic', thetaDeg: 70, phiDeg: 40, zoom: 130, pan: { x: 440, y: 320 } } })
    await nextFrame()
    const projectedPosition = state().positions.projected
    const projectionTransform = displayed('projected').getCTM()!
    assertBrowser(Math.abs(projectionTransform.e - projectedPosition.x) < 1e-6 && Math.abs(projectionTransform.f - projectedPosition.y) < 1e-6, '3D label follows model projection')
    assertBrowser(invocationCount === beforeCamera, '3D camera changes reuse math')
    mount({ labels: [
      { id: 'visible', text: '$x$', layer: 1 }, { id: 'locked', text: '$y$', layer: 2 }, { id: 'hidden', text: '$z$', layer: 3 },
    ], layers: [{ value: 1, name: 'Visible' }, { value: 2, name: 'Locked', locked: true }, { value: 3, name: 'Hidden', visible: false }] })
    await waitSettled()
    assertBrowser(!container.querySelector('[data-label-id="hidden"] [data-label-state]'), 'Hidden layer has no rendered label geometry')
    assertBrowser(getComputedStyle(displayed('locked').querySelector('rect')!).pointerEvents === 'none', 'Locked label descendants honor outer pointer policy')
    api.filter(2)
    assertBrowser(getComputedStyle(displayed('visible').querySelector('rect')!).pointerEvents === 'none', 'Filtered label descendants honor outer pointer policy')
    for (const policy of ['autoHide', 'autoDim'] as const) {
      mount({ ambientDimension: 3, occlusion: policy, labels: [{ id: 'occluded', text: '$x$', layer: 0, position: { x: 0, y: -1, z: 0 } }] })
      await waitSettled()
      const visibility = container.querySelector('[data-label-id="occluded"]')!.getAttribute('data-label-visibility')
      assertBrowser(visibility === (policy === 'autoHide' ? 'hidden' : 'dimmed'), `${policy} surface policy`)
      if (policy === 'autoHide') assertBrowser(!container.querySelector('[data-label-id="occluded"] [data-label-state]'), 'autoHide removes selectable formula geometry')
      else assertBrowser(Number(displayed('occluded').querySelector(':scope > g')!.getAttribute('opacity')) < 1, 'autoDim affects formula opacity')
    }
    record('PASS: 3D projection/reuse, locked/hidden/filtered descendants, autoHide/autoDim')

    api.hold('$browserOld$')
    api.hold('$browserNew$')
    mount({ labels: [{ id: 'race', text: '$browserOld$' }] })
    await nextFrame()
    mutateLabel('race', { text: '$browserNew$' })
    await nextFrame()
    assertBrowser(displayed('race').getAttribute('data-label-state') === 'pending', 'Controlled latest pending source')
    assertBrowser(api.export()?.includes('$browserNew$'), 'Pending source retained in SVG clone')
    await api.release('$browserNew$')
    await waitSettled()
    await api.release('$browserOld$', true)
    assertBrowser(displayed('race').getAttribute('data-label-source') === '$browserNew$' && displayed('race').getAttribute('data-label-state') === 'ready', 'Obsolete failure cannot overwrite success')
    mutateLabel('race', { text: 'invalid $' })
    assertBrowser(displayed('race').querySelectorAll('[data-label-math]').length === 0, 'No last-good math after invalid edit')
    await waitSettled()
    mutateLabel('race', { text: '$browserNew$' })
    await waitSettled()
    api.hold('$browserDeleted$')
    mutateLabel('race', { text: '$browserDeleted$' })
    await nextFrame()
    api.deleteLabel('race')
    await api.release('$browserDeleted$')
    assertBrowser(!container.querySelector('[data-label-id="race"]'), 'Deleted label not resurrected')
    api.hold('$browserOldDoc$')
    mount({ labels: [{ id: 'sameId', text: '$browserOldDoc$' }] })
    await nextFrame()
    mount({ labels: [{ id: 'sameId', text: '$browserNewDoc$' }] })
    await waitSettled()
    await api.release('$browserOldDoc$')
    assertBrowser(displayed('sameId').getAttribute('data-label-source') === '$browserNewDoc$', 'Reused document ID rejects obsolete request')
    api.hold('$browserUnmount$')
    mutateLabel('sameId', { text: '$browserUnmount$' })
    await nextFrame()
    api.unmount()
    await api.release('$browserUnmount$')
    assertBrowser(!container.querySelector('svg'), 'No resurrection after unmount')
    record('PASS: controlled inverted completions, obsolete failure, valid-invalid-valid, deletion, reused document IDs, unmount')

    for (const mode of ['load-error', 'output-error'] as const) {
      await api.changeService(mode)
      mount({ labels: [{ id: 'failed', text: '$x$' }, { id: 'sibling', text: '日本語 text' }] })
      await waitSettled()
      assertBrowser(displayed('failed').getAttribute('data-label-state') === 'fallback', `${mode} fallback`)
      assertBrowser(displayed('sibling').getAttribute('data-label-state') === 'ready', `${mode} sibling isolation`)
    }
    await api.changeService('real')
    mount({ labels: [{ id: 'limit', text: 'x'.repeat(16_385) }, { id: 'valid', text: '$x^2$' }] })
    await waitSettled()
    assertBrowser(displayed('limit').getAttribute('data-label-state') === 'fallback' && displayed('limit').getAttribute('data-label-source')?.length === 16_385, 'Complete bounded-input fallback')
    assertBrowser(displayed('valid').getAttribute('data-label-state') === 'ready', 'Input limit isolation')
    record('PASS: mounted load/output/input-limit failures are exact-source and isolated')

    mount({ labels: [{ id: 'exportMath', text: '$\\frac{a}{b}$' }, { id: 'exportLiteral', text: literal }] })
    await waitSettled()
    api.select({ kind: 'label', id: 'exportMath' })
    for (const background of ['transparent', 'white'] as const) {
      const exported = api.export(background)
      assertBrowser(exported, 'Current SVG export')
      const parsed = new DOMParser().parseFromString(exported, 'image/svg+xml')
      assertBrowser(!parsed.querySelector('parsererror, foreignObject, image') && parsed.querySelector('path'), 'Standalone normalized formula SVG')
      assertBrowser(exported.includes('&lt;&gt;&amp;') && !exported.includes('data-svg-export-exclude'), 'Literal text survives; overlays removed')
    }
    showOverlap()
    await waitSettled()
    assertBrowser(displayed('overlapA').querySelector('[data-label-math]') && displayed('overlapB').querySelector('[data-label-math]'), 'Duplicates have independent DOM geometry')
    const ids = Array.from(container.querySelectorAll('[data-label-state] [id]'), (node) => node.id)
    assertBrowser(ids.length === new Set(ids).size, 'No duplicate formula IDs')
    record('PASS: transparent/white current-view SVG clone, exact fallback, duplicate formulas')
    record('SELF-CHECKS PASSED. Native UI check remains: click the formula at canvas center, then Alt-click twice; drag the selected anchor. Use buttons for fallback/locked/3D cases.')
    return { result: 'passed', evidence, invocationCount, requestCount }
  } catch (error) {
    record(`FAILED: ${error instanceof Error ? error.message : String(error)}`)
    return { result: 'failed', evidence, invocationCount, requestCount }
  }
}

document.getElementById('run-checks')!.addEventListener('click', () => { void runSelfChecks() })
document.getElementById('show-overlap')!.addEventListener('click', () => showOverlap())
document.getElementById('show-fallback')!.addEventListener('click', () => showOverlap(true))
document.getElementById('show-locked')!.addEventListener('click', () => mount({
  labels: [{ id: 'locked', text: '$\\frac{x}{y}$', layer: 1, position: { x: 0, y: 0, z: 0 }, style: { fontSize: 40 } }],
  layers: [{ value: 1, name: 'Locked', locked: true }],
}))
document.getElementById('show-drag')!.addEventListener('click', () => {
  mount({ ambientDimension: 3, labels: [{ id: 'drag3d', text: '$F^{(1)}L$', position: { x: 0, y: 0, z: 0 }, style: { fontSize: 36 } }] })
  api.select({ kind: 'label', id: 'drag3d' })
})
mount({ labels: [
  { id: 'formula', text: '$F^{(1)}L$' },
  { id: 'alpha', text: '$\\alpha \\colon f \\Rightarrow g$' },
  { id: 'japanese', text: '日本語 $\\frac{x}{y}$' },
] })
