import assert from 'node:assert/strict'
import test from 'node:test'
import { createCurveStratum, createEmptyDiagram, createTextLabel } from '../../src/model/constructors.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { translationVectorFromNumericVec3 } from '../../src/model/translation.ts'
import type { AmbientDimension, CurveStratum, Diagram, TextLabel, Vec2 } from '../../src/model/types.ts'
import { MAX_LABEL_SOURCE_LENGTH } from '../../src/rendering/labelText.ts'
import { createLabelService, type LabelConversionResult } from '../../src/rendering/labels/labelService.ts'
import type { TextMeasurementProvider } from '../../src/rendering/labels/labelMetrics.ts'
import { loadMathJaxEngine, type MathLabelEngine } from '../../src/rendering/labels/mathjaxEngine.ts'
import { placeSvgLabel, svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { createSvgLabelController, createSvgLabelRuntime, type SvgLabelRuntime, type SvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { collectSvgPreviewSelectionCandidates } from '../../src/rendering/svgHitTesting.ts'
import type { SvgFreeLabelBounds } from '../../src/rendering/svgLabelBounds.ts'
import { captureSvgLabelExport, type SvgLabelExportCapture } from '../../src/rendering/svgLabelExportRegistry.ts'
import { pathInlineNodesForSvgPreview, svgPathInlineNodeLabelAnchor, svgPathInlineNodeLabelIdentity } from '../../src/rendering/svgPathInlineNodes.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { removeSelectedElements, translateSelectedElements } from '../../src/ui/bulkEditing.ts'
import { updateLabelById, updateStratumById } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter } from '../../src/ui/layerFilter.ts'
import { updatePathInlineNodeText } from '../../src/ui/pathInlineNodeEditing.ts'
import { updateSelectionForClick } from '../../src/ui/selection.ts'
import { renderSettledSvgLabelDocument, settleSvgExportLabels } from '../../src/ui/svgSettledExport.ts'
import { commitDiagramChange, createDiagramHistory, redoLastDiagramChange, undoLastDiagramChange, type UndoableEditorState } from '../../src/ui/undo.ts'

// Real MathJax geometry throughout. Only ordinary text measurement is deterministic;
// native fonts, DOM commits, downloads and standalone reopening belong to the browser gate.
const measurement: TextMeasurementProvider = {
  identity: 'phase31f-combined-text',
  measure: (text, font) => ({ width: [...text].length * font.sizePx / 2,
    ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
  lineMetrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }),
}
const viewportHeight = 600
const mixed = '射 $\\frac{a_1}{\\sqrt{b}}$ and \\(g^2\\)\n次の行'
const invalid = '  <svg onload="x"> &  $\\definitelyUndefined{x}$\t\r\n tail  '
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

function fixture(source = mixed, ambientDimension: AmbientDimension = 2): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension })
  diagram.labels = [createTextLabel({ ambientDimension, id: 'free', text: source,
    position: { x: 1, y: 3, z: ambientDimension === 3 ? 2 : 0 } })]
  diagram.strata = [createCurveStratum({ ambientDimension, id: 'path',
    pathLabel: 'saved-path', label: '$undisplayedMetadata$',
    points: [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: ambientDimension === 3 ? 3 : 0 }],
    inlineNodes: [{ id: 'node', text: source, position: { kind: 'segment', segmentIndex: 0, value: 0.5 },
      options: { placement: 'above', marker: 'dot' } }],
  })]
  return diagram
}

function curve(diagram: Diagram): CurveStratum {
  const path = diagram.strata.find((stratum) => stratum.id === 'path')
  assert.ok(path?.geometricKind === 'curve')
  return path
}

function editor(diagram: Diagram): UndoableEditorState {
  return { editableDiagram: diagram, selectedElement: null, layerFilter: allLayersFilter,
    polylineDraft: null, cubicBezierDraft: null, pathDraft: null, sheetPolygonDraft: null,
    history: createDiagramHistory(diagram) }
}

function editBoth(state: UndoableEditorState, source: string): UndoableEditorState {
  const free = updateLabelById(state.editableDiagram, 'free', (label) => ({ ...label, text: source }))
  const diagram = updateStratumById(free, 'path', (path) => updatePathInlineNodeText(path, 'node', source))
  return commitDiagramChange(state, { ...state, editableDiagram: diagram })
}

function captures(diagram: Diagram, runtime: SvgLabelRuntime, revision = 1): SvgLabelExportCapture[] {
  const free = diagram.labels.map((label) => {
    const fontSize = label.style.fontSize * 1.35
    return captureSvgLabelExport({ runtime, source: label.text,
      ownerIdentity: JSON.stringify(['free-label', revision, label.id]),
      position: projectToSvgPoint(diagram.camera, label.position, viewportHeight),
      color: label.style.color, opacity: label.style.opacity, anchor: label.style.anchor,
      fontSize, settings: svgLabelLayoutSettings(fontSize) })
  })
  const inline = diagram.strata.flatMap((stratum) => stratum.geometricKind !== 'curve' ? []
    : pathInlineNodesForSvgPreview(stratum, diagram.ambientDimension,
      (point) => projectToSvgPoint(diagram.camera, point, viewportHeight))
      // Keep the established UI policy: blank inline text leaves only its marker.
      .filter((node) => node.text.trim().length > 0)
      .map((node) => captureSvgLabelExport({ runtime, source: node.text,
        ownerIdentity: svgPathInlineNodeLabelIdentity(revision, stratum.id, node.id),
        position: { x: node.center.x + node.labelOffset.x, y: node.center.y + node.labelOffset.y },
        color: '#111827', opacity: 1, fontSize: 12, settings: svgLabelLayoutSettings(12),
        anchor: svgPathInlineNodeLabelAnchor(node.placement), boundsTarget: false,
        outline: { color: '#ffffff', width: 3 } })))
  return [...free, ...inline]
}

function literal(state: SvgLabelState): string {
  return state.layout.placements.map((item) => item.kind === 'math' ? '' : item.text).join('')
}

function bounds(label: TextLabel, state: SvgLabelState): SvgFreeLabelBounds {
  const fontSize = label.style.fontSize * 1.35
  return { source: state.source, fontSize, anchor: label.style.anchor,
    bounds: placeSvgLabel(state.layout, fontSize, label.style.anchor).bounds }
}

function picked(diagram: Diagram, snapshot: SvgFreeLabelBounds, offset?: Vec2) {
  const label = diagram.labels[0]
  const anchor = projectToSvgPoint(diagram.camera, label.position, viewportHeight)
  const center = offset ?? { x: (snapshot.bounds.minX + snapshot.bounds.maxX) / 2,
    y: (snapshot.bounds.minY + snapshot.bounds.maxY) / 2 }
  return collectSvgPreviewSelectionCandidates({ diagram, camera: diagram.camera, viewportHeight,
    point: { x: anchor.x + center.x, y: anchor.y + center.y }, showCoordinateAnchors: false,
    labelBounds: new Map([[label.id, snapshot]]), tolerance: 0 }).filter((candidate) => candidate.kind === 'label')
}

function savedOutputs(state: UndoableEditorState) {
  return { json: serializeDiagram(state.editableDiagram), history: JSON.stringify(state.history),
    standalone: generateTikz(state.editableDiagram, { exportMode: 'standalone' }),
    inline: generateTikz(state.editableDiagram, { exportMode: 'inlineMath' }) }
}

function assertRoundTrip(state: UndoableEditorState): void {
  const before = savedOutputs(state)
  const parsed = parseSavedDiagramJson(before.json)
  assert.ok(parsed.ok)
  assert.equal(serializeDiagram(parsed.diagram), before.json)
  assert.equal(generateTikz(parsed.diagram, { exportMode: 'standalone' }), before.standalone)
  assert.equal(generateTikz(parsed.diagram, { exportMode: 'inlineMath' }), before.inline)
  assert.doesNotMatch(before.inline, /\n\s*\n/u)
  for (const line of before.standalone.split('\n').filter((line) => /^ +\\(?:node|draw)/u.test(line))) {
    assert.match(line, /^(?: {4})+\\/u, 'Generated diagram commands keep four-space indentation levels')
  }
}

test('31F grammar fixture: real free/path rendering, full fallback and JSON/TikZ agree', async () => {
  const runtime = createSvgLabelRuntime({ measurement })
  const cases: readonly { source: string; status: 'ready' | 'fallback'; math?: boolean; lines?: number }[] = [
    { source: '', status: 'ready', lines: 0 },
    { source: '  \t  ', status: 'ready' },
    { source: 'Region 日本語 Ω', status: 'ready' },
    { source: '$\\frac{1}{2}$', status: 'ready', math: true },
    { source: '\\(x_i^2\\)', status: 'ready', math: true },
    { source: '$$\\sqrt{x}$$', status: 'ready', math: true },
    { source: '\\[\\frac{x}{y}\\]', status: 'ready', math: true },
    { source: 'Cost \\$5 \\% \\& \\_ \\# \\{ \\}', status: 'ready' },
    { source: '前 $x\n+ y$ and $g_i$\n後', status: 'ready', math: true, lines: 2 },
    { source: '  $x\t\n tail ', status: 'fallback' },
    { source: 'before \\(x\\] after', status: 'fallback' },
    { source: 'prefix $\\frac{1}$ suffix', status: 'fallback' },
    { source: invalid, status: 'fallback' },
    { source: 'prefix \\textbf{A} $x$', status: 'fallback' },
    { source: '$\\usepackage{other}$', status: 'fallback' },
    { source: '$\\newcommand{\\f}{x}\\f$', status: 'fallback' },
    { source: '$' + '{'.repeat(129) + 'x' + '}'.repeat(129) + '$', status: 'fallback' },
    { source: 'x'.repeat(MAX_LABEL_SOURCE_LENGTH + 1), status: 'fallback' },
  ]
  try {
    for (const sample of cases) {
      const state = editor(fixture(sample.source))
      const before = savedOutputs(state)
      const captured = captures(state.editableDiagram, runtime)
      const settled = await settleSvgExportLabels(captured)
      for (const [index, result] of settled.entries()) {
        assert.equal(result.status, sample.status, sample.source.slice(0, 80))
        assert.equal(result.source, sample.source)
        assert.ok(Object.values(result.layout.bounds).every(Number.isFinite))
        if (sample.lines !== undefined) assert.equal(result.layout.lines.length, sample.lines)
        const output = renderSettledSvgLabelDocument(captured[index], result)
        assert.doesNotMatch(output, /foreignObject|<image|<script|currentColor|href=/u)
        if (sample.math) assert.match(output, /<path /u)
        if (sample.status === 'fallback') {
          assert.equal(literal(result), sample.source)
          assert.doesNotMatch(output, /<path /u)
        }
        if (sample.source === invalid) assert.match(output, /&lt;svg onload=&quot;x&quot;&gt; &amp;/u)
        for (const [lineIndex, line] of result.layout.lines.entries()) {
          const baselines = result.layout.placements.filter((item) => item.lineIndex === lineIndex)
            .map((item) => item.baseline)
          assert.ok(baselines.every((baseline) => baseline === line.baseline))
        }
      }
      assert.deepEqual(savedOutputs(state), before)
      assertRoundTrip(state)
    }
  } finally { runtime.dispose() }
})

test('31F editing fixture: real rendered and picked bounds follow valid → invalid → repaired source', async () => {
  const runtime = createSvgLabelRuntime({ measurement })
  const controller = createSvgLabelController(runtime)
  let state = editor(fixture('$\\frac{a_1}{\\sqrt{b}}$'))
  let previousBounds: SvgFreeLabelBounds | undefined
  try {
    for (const source of [state.editableDiagram.labels[0].text, invalid, mixed]) {
      state = editBoth(state, source)
      const [capture] = captures(state.editableDiagram, runtime)
      controller.start(capture)
      const pending = controller.getSnapshot()!
      assert.equal(pending.source, source)
      assert.equal(literal(pending), source)
      if (previousBounds) assert.deepEqual(picked(state.editableDiagram, previousBounds), [])
      const pendingBounds = bounds(state.editableDiagram.labels[0], pending)
      assert.equal(picked(state.editableDiagram, pendingBounds)[0]?.id, 'free')
      await runtime.service.convert(source, capture.settings)
      await tick()
      const current = controller.getSnapshot()!
      assert.equal(current.status, source === invalid ? 'fallback' : 'ready')
      previousBounds = bounds(state.editableDiagram.labels[0], current)
      const markup = renderSettledSvgLabelDocument(capture, current)
      assert.ok(markup.includes(`data-label-bounds="${Object.values(previousBounds.bounds).join(' ')}"`))
      assert.equal(picked(state.editableDiagram, previousBounds)[0]?.id, 'free')
      assert.deepEqual(picked(state.editableDiagram, previousBounds,
        { x: previousBounds.bounds.maxX + 20, y: previousBounds.bounds.maxY + 20 }), [])
      if (source === invalid) {
        assert.equal(current.reason, 'tex-error')
        assert.equal(literal(current), source)
        assert.doesNotMatch(markup, /<path /u)
      } else assert.match(markup, /<path /u)
      assertRoundTrip(state)
    }
    const before = savedOutputs(state)
    const reverted = undoLastDiagramChange(state)
    assert.equal(reverted.editableDiagram.labels[0].text, invalid)
    assert.equal(curve(reverted.editableDiagram).inlineNodes![0].text, invalid)
    assert.equal(serializeDiagram(redoLastDiagramChange(reverted).editableDiagram), before.json)
  } finally { runtime.dispose() }
})

test('31F shared fixture: duplicate geometry survives style, marker selection, drag and 2D/3D camera changes', async () => {
  let conversions = 0
  const service = createLabelService({ measurement, loadEngine: async (signal) => {
    const engine = await loadMathJaxEngine(signal)
    return { ...engine, convert: (runs) => { conversions++; return engine.convert(runs) } }
  } })
  const runtime = createSvgLabelRuntime({ measurement, service })
  try {
    for (const ambientDimension of [2, 3] as const) {
      const diagram = fixture(mixed, ambientDimension)
      diagram.labels.push({ ...structuredClone(diagram.labels[0]), id: 'duplicate',
        position: { x: -4, y: -4, z: 0 }, style: { ...diagram.labels[0].style, color: '#f00abb' } })
      let state = editor(diagram)
      const first = captures(state.editableDiagram, runtime)
      const results = await settleSvgExportLabels(first)
      assert.equal(results[0].result, results[1].result)
      assert.notEqual(first[0].ownerIdentity, first[1].ownerIdentity)
      const callsBeforePresentation = conversions
      let changed = updateLabelById(state.editableDiagram, 'free', (label) => ({ ...label,
        style: { ...label.style, anchor: 'north east', fontSize: 24, opacity: 0.35, color: '#2475ab' } }))
      changed = updateStratumById(changed, 'path', (path) => path.geometricKind !== 'curve' ? path
        : { ...path, inlineNodes: path.inlineNodes!.map((node) => ({ ...node, options: { ...node.options, placement: 'right' } })) })
      const changedCapture = captures(changed, runtime)
      const styled = await settleSvgExportLabels(changedCapture)
      const snapshot = bounds(changed.labels[0], styled[0])
      const hit = picked(changed, snapshot)[0]
      assert.ok(hit?.selection)
      const selection = updateSelectionForClick(changed, null, hit.selection, 'replace')
      assert.deepEqual(selection, { kind: 'label', id: 'free' })
      const moved = translateSelectedElements(changed, selection,
        translationVectorFromNumericVec3(changed, { x: 2, y: 1, z: 0 }))
      assert.ok(moved.ok)
      assert.equal(moved.translatedCount, 1)
      changed = moved.diagram
      changed.camera = changed.camera.mode === '2d'
        ? { ...changed.camera, scale: changed.camera.scale * 1.4, origin: { x: 30, y: 90 } }
        : { ...changed.camera, thetaDeg: 72, phiDeg: 24, zoom: 60, pan: { x: 30, y: 90 } }
      const movedCapture = captures(changed, runtime)
      const movedResults = await settleSvgExportLabels(movedCapture)
      assert.notDeepEqual(movedCapture[0].position, first[0].position)
      assert.notDeepEqual(movedCapture.at(-1)!.position, first.at(-1)!.position)
      assert.equal(conversions, callsBeforePresentation, 'Style/layout, dragging and camera projection do not compile unchanged TeX')
      assert.equal(picked(changed, bounds(changed.labels[0], movedResults[0]))[0]?.id, 'free')
      const output = renderSettledSvgLabelDocument(movedCapture[0], movedResults[0])
      assert.match(output, /fill="#2475ab"/u)
      assert.match(output, /opacity="0.35"/u)
      assert.match(renderSettledSvgLabelDocument(movedCapture[1], movedResults[1]), /fill="#f00abb"/u)
      const pathCapture = movedCapture.at(-1)!
      const pathOutput = renderSettledSvgLabelDocument(pathCapture, movedResults.at(-1)!)
      assert.match(pathOutput, /stroke="#ffffff"/u)
      assert.match(pathOutput, /pointer-events="none"/u)
      assert.doesNotMatch(pathOutput, /data-svg-export-exclude=/u, 'Path text introduces no free-label hit target')
      const marker = pathInlineNodesForSvgPreview(curve(changed), ambientDimension,
        (point) => projectToSvgPoint(changed.camera, point, viewportHeight))[0]
      const markerHit = collectSvgPreviewSelectionCandidates({ diagram: changed, camera: changed.camera,
        viewportHeight, point: marker.center, showCoordinateAnchors: false }).find((candidate) => candidate.kind === 'pathInlineNode')
      assert.deepEqual(markerHit?.selection, { kind: 'stratum', id: 'path' })
      state = commitDiagramChange(state, { ...state, editableDiagram: changed, selectedElement: selection })
      const removed = removeSelectedElements(state.editableDiagram, { kind: 'label', id: 'duplicate' })
      state = commitDiagramChange(state, { ...state, editableDiagram: removed.diagram })
      state = commitDiagramChange(state, { ...state, editableDiagram:
        updateLabelById(state.editableDiagram, 'free', (label) => ({ ...label, text: '$new$' })) })
      const newResults = await settleSvgExportLabels(captures(state.editableDiagram, runtime))
      assert.ok(newResults.every((result) => result.status === 'ready'))
      assert.deepEqual(newResults.map((result) => result.source), ['$new$', mixed])
      assert.equal(newResults[1].result, results[2].result, 'Editing a free label retains its unchanged path sibling result')
      assert.equal(results[1].source, mixed, 'Removed duplicate retains immutable old conversion state only')
      assertRoundTrip(state)
    }
  } finally { runtime.dispose() }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

test('31F history fixture: delayed A → B → C results cannot cross Undo/Redo, deletion, load or unmount', async () => {
  const real = createLabelService({ measurement })
  const requests: { source: string; gate: ReturnType<typeof deferred<LabelConversionResult>>; result: Promise<LabelConversionResult> }[] = []
  const runtime = createSvgLabelRuntime({ measurement, service: { peek: () => undefined,
    convert: (source, settings) => {
      const gate = deferred<LabelConversionResult>()
      requests.push({ source, gate, result: real.convert(source, settings) })
      return gate.promise
    } } })
  let state = editor(fixture('$A$'))
  const free = createSvgLabelController(runtime)
  const path = createSvgLabelController(runtime)
  let stopFree = () => {}
  let stopPath = () => {}
  const start = async (revision = 1) => {
    stopFree(); stopPath()
    const inputs = captures(state.editableDiagram, runtime, revision)
    if (inputs[0]) stopFree = free.start(inputs[0])
    if (inputs[1]) stopPath = path.start(inputs[1])
    await tick()
    return requests.slice(-inputs.length)
  }
  const resolve = async (pending: typeof requests) => {
    for (const request of pending) request.gate.resolve(await request.result)
    await tick()
  }
  try {
    const a = await start()
    state = editBoth(state, invalid)
    const b = await start()
    state = editBoth(state, '$C$')
    const c = await start()
    await resolve(c)
    const current = [free.getSnapshot(), path.getSnapshot()]
    await resolve([...b, ...a])
    assert.deepEqual([free.getSnapshot(), path.getSnapshot()], current)
    assert.equal(free.getSnapshot()?.source, '$C$')

    state = undoLastDiagramChange(state)
    const undo = await start()
    assert.equal(free.getSnapshot()?.source, invalid)
    assert.equal(literal(free.getSnapshot()!), invalid)
    state = redoLastDiagramChange(state)
    const redo = await start()
    await resolve(redo)
    await resolve(undo)
    assert.equal(free.getSnapshot()?.source, '$C$')
    assert.equal(path.getSnapshot()?.status, 'ready')

    state = editBoth(state, '$deleted$')
    const deleted = await start()
    stopFree(); stopPath()
    const removed = removeSelectedElements(state.editableDiagram,
      { kind: 'multi', elements: [{ kind: 'label', id: 'free' }, { kind: 'stratum', id: 'path' }] })
    state = commitDiagramChange(state, { ...state, editableDiagram: removed.diagram })
    const afterDelete = [free.getSnapshot(), path.getSnapshot()]
    await resolve(deleted.slice(0, 1))
    assert.deepEqual([free.getSnapshot(), path.getSnapshot()], afterDelete)
    assert.equal(state.editableDiagram.labels.length + state.editableDiagram.strata.length, 0)

    const loaded = parseSavedDiagramJson(serializeDiagram(fixture('$loaded$', 3)))
    assert.ok(loaded.ok)
    state = commitDiagramChange(state, { ...state, editableDiagram: loaded.diagram }, { replaceDiagram: true })
    const replacement = await start(2)
    const historyBefore = JSON.stringify(state.history)
    await resolve(replacement)
    assert.equal(free.getSnapshot()?.source, '$loaded$')
    assert.equal(path.getSnapshot()?.source, '$loaded$')
    const loadedStates = [free.getSnapshot(), path.getSnapshot()]
    await resolve(deleted.slice(1))
    assert.deepEqual([free.getSnapshot(), path.getSnapshot()], loadedStates, 'A deleted path result cannot overwrite reused IDs in a loaded document')
    assert.equal(JSON.stringify(state.history), historyBefore)
    assertRoundTrip(state)

    state = editBoth(state, '$unmounted$')
    const unmounted = await start(2)
    let notifications = 0
    const unsub = free.subscribe(() => notifications++)
    stopFree(); stopPath(); unsub()
    const finalState = free.getSnapshot()
    await resolve(unmounted)
    assert.equal(free.getSnapshot(), finalState)
    assert.equal(notifications, 0)
  } finally { stopFree(); stopPath(); real.invalidate() }
})

test('31F settlement fixture: pending free/path exports retain click-time inputs while edits and history continue', async () => {
  const real = createLabelService({ measurement })
  const gates: { gate: ReturnType<typeof deferred<LabelConversionResult>>; result: Promise<LabelConversionResult> }[] = []
  const runtime = createSvgLabelRuntime({ measurement, service: { peek: () => undefined,
    convert: (source, settings) => {
      const gate = deferred<LabelConversionResult>()
      gates.push({ gate, result: real.convert(source, settings) })
      return gate.promise
    } } })
  let state = editor(updateStratumById(fixture(mixed, 3), 'path',
    (path) => updatePathInlineNodeText(path, 'node', invalid)))
  const before = savedOutputs(state)
  const clicked = captures(state.editableDiagram, runtime)
  const work = settleSvgExportLabels(clicked)
  await tick()
  state = editBoth(state, '$later$')
  const translated = translateSelectedElements(state.editableDiagram,
    { kind: 'multi', elements: [{ kind: 'label', id: 'free' }, { kind: 'stratum', id: 'path' }] },
    translationVectorFromNumericVec3(state.editableDiagram, { x: 10, y: -2, z: 3 }))
  assert.ok(translated.ok)
  assert.equal(translated.diagram.camera.mode, '3d')
  if (translated.diagram.camera.mode === '3d') {
    translated.diagram.camera = { ...translated.diagram.camera, thetaDeg: 80, zoom: 70, pan: { x: 40, y: 90 } }
  }
  state = commitDiagramChange(state, { ...state, editableDiagram: translated.diagram })
  state = redoLastDiagramChange(undoLastDiagramChange(state))
  const liveBeforeSettlement = savedOutputs(state)
  try {
    for (const item of [...gates].reverse()) item.gate.resolve(await item.result)
    const settled = await work
    assert.deepEqual(settled.map((result) => result.status), ['ready', 'fallback'])
    assert.equal(settled[0].source, mixed)
    assert.equal(literal(settled[1]), invalid)
    for (const [index, capture] of clicked.entries()) {
      const output = renderSettledSvgLabelDocument(capture, settled[index])
      assert.ok(output.includes(`translate(${capture.position.x} ${capture.position.y})`))
      assert.ok(!output.includes('$later$'))
    }
    assert.deepEqual(savedOutputs(state), liveBeforeSettlement, 'Settlement and detached rendering do not enter history')
    const loadedBefore = parseSavedDiagramJson(before.json)
    assert.ok(loadedBefore.ok)
    assert.equal(loadedBefore.diagram.labels[0].text, mixed)
    assert.equal(curve(loadedBefore.diagram).inlineNodes![0].text, invalid)
    assertRoundTrip(state)
    assert.equal(undoLastDiagramChange(undoLastDiagramChange(state)).editableDiagram.labels[0].text, mixed)
  } finally { real.invalidate() }
})

test('31F recovery fixture: a bounded resource failure preserves sibling text, geometry and history, then real math retries', async () => {
  // Load the real engine first so this test's short bound concerns the controlled
  // unavailable resource only, not machine-dependent initial import duration.
  const engine = await loadMathJaxEngine()
  let loads = 0
  const service = createLabelService({ measurement, limits: { settlementMs: 1_000, retryDelayMs: 0 },
    loadEngine: () => ++loads === 1 ? new Promise<MathLabelEngine>(() => undefined) : Promise.resolve(engine) })
  const runtime = createSvgLabelRuntime({ measurement, service })
  const diagram = fixture(mixed)
  diagram.labels.push(createTextLabel({ ambientDimension: 2, id: 'ordinary',
    text: 'Still usable 日本語', position: { x: 5, y: 5, z: 0 } }))
  const state = editor(diagram)
  const before = savedOutputs(state)
  try {
    const inputs = captures(state.editableDiagram, runtime)
    const first = await settleSvgExportLabels(inputs)
    assert.deepEqual(first.map((item) => item.status), ['fallback', 'ready', 'fallback'])
    for (const index of [0, 2]) {
      assert.equal(first[index].reason, 'timeout')
      assert.equal(literal(first[index]), mixed)
      assert.ok(Object.values(first[index].layout.bounds).every(Number.isFinite))
    }
    assert.equal(picked(state.editableDiagram, bounds(state.editableDiagram.labels[0], first[0]))[0]?.id, 'free')
    const path = curve(state.editableDiagram)
    const marker = pathInlineNodesForSvgPreview(path, 2,
      (point) => projectToSvgPoint(state.editableDiagram.camera, point, viewportHeight))[0]
    assert.ok(collectSvgPreviewSelectionCandidates({ diagram: state.editableDiagram,
      camera: state.editableDiagram.camera, viewportHeight, point: marker.center,
      showCoordinateAnchors: false }).some((candidate) => candidate.kind === 'curve'))
    const retry = await settleSvgExportLabels(inputs)
    assert.ok(retry.every((item) => item.status === 'ready'))
    assert.equal(loads, 2)
    assert.match(renderSettledSvgLabelDocument(inputs[0], retry[0]), /<path /u)
    assert.deepEqual(savedOutputs(state), before)
    assertRoundTrip(state)
  } finally { runtime.dispose() }
})
