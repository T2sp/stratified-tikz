import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { geometricShapeGroup, geometricShapeManifest } from '../../scripts/pointGeometricShapesContract.mjs'
import { layoutAnchorGroup, layoutShapes, layoutShapeParameters } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { buildPendingLayoutFixture } from '../../scripts/pointLayoutPendingFixture.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'
import { syntheticPendingLayoutViewEvidence } from './pointLayoutPendingViewFixture.mjs'

// Fabricated policy records use a complete retained PNG only to exercise byte
// validation. They do not assert native download or screenshot acceptance.
const fixturePng = readFileSync(new URL('../fixtures/dash-cap-native-endpoints/point-paint-dash-caps-triangle-square-wide-scale-0.5-edit-dashPhase.screen.png', import.meta.url))
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// Fabricated preparation exercises the exact parent policy schema. Every hit,
// matrix and event below is controlled Node data, never native acceptance.
export function syntheticPendingLayoutPreparation(background = 'transparent') {
  const scenario = `point-layout-pending-${background}-${background === 'transparent' ? 'edit' : 'load'}`
  const source = `captured ${background} $\\frac{anchor_{32D}}{1+\\frac{x}{y}}$`
  const base = syntheticGeometricSelectionEvidence({ id: 'layout-circle', shape: 'circle', requireUnselected: true })
  const diagram = JSON.parse(base.stateBefore.runtimeDiagramJson)
  diagram.strata[0].text = source
  diagram.strata.push({ id: 'export-path', geometricKind: 'curve', kind: 'polyline', codim: 1, layer: 0,
    inlineNodes: [
      { id: 'repeated', text: '$\\frac{x_1}{y^2}$', position: { kind: 'segment', segmentIndex: 0, value: .3 },
        options: { placement: 'above', marker: 'dot' } },
      { id: 'mixed', text: '経路 $\\sum_{k=1}^{n}k$', position: { kind: 'segment', segmentIndex: 0, value: .8 },
        options: { placement: 'below', marker: 'none' } },
    ] })
  diagram.labels = [{ id: 'free-a', text: 'free $a$', position: { x: 0, y: 1, z: 0 } },
    { id: 'free-b', text: 'free $b$', position: { x: 1, y: 0, z: 0 } }]
  const fixture = buildPendingLayoutFixture({ version: 2, diagram }, source, layoutShapes, layoutShapeParameters)
  const stateBefore = { ...base.stateBefore, json: JSON.stringify(fixture), runtimeDiagramJson: JSON.stringify(fixture.diagram),
    history: JSON.stringify({ past: [], present: fixture.diagram, future: [] }), requests: 15,
    uiSettings: JSON.stringify({ exportMode: 'standalone' }) }
  const nativeSelection = syntheticGeometricSelectionEvidence({ scenario, id: 'layout-circle', shape: 'circle', requireUnselected: true, state: stateBefore })
  const pendingLayouts = (value) => {
    if (!value || typeof value !== 'object') return
    if (value.layout?.owner) value.layout.state = 'pending'
    for (const child of Object.values(value)) pendingLayouts(child)
  }
  pendingLayouts(nativeSelection); nativeSelection.rendered.state = 'pending'
  const { stateAfter, requestedClick } = nativeSelection
  const contour = nativeSelection.before.geometry.contour
  const geometry = (bbox, matrix) => ({ connected: true, bbox: structuredClone(bbox),
    bounds: { x: matrix.a * bbox.x + matrix.e, y: matrix.d * bbox.y + matrix.f,
      width: matrix.a * bbox.width, height: matrix.d * bbox.height },
    screenCTM: structuredClone(matrix), CTM: structuredClone(matrix) })
  const points = fixture.diagram.strata.filter(({ geometricKind }) => geometricKind === 'point').map((model, index) => {
    const matrix = index ? { a: 1, b: 0, c: 0, d: 1, e: 100 + index * 50, f: 500 } : contour.screenCTM
    const box = index ? { x: -10, y: -10, width: 20, height: 20 } : contour.bounds
    const owner = JSON.stringify(['point-node', stateBefore.labelDocumentRevision, model.id])
    const request = index ? `request:${stateBefore.labelDocumentRevision}:${model.id}` : nativeSelection.before.layout.request
    return { id: model.id, modelIndex: index, model: structuredClone(model), owner, request, bodyRequest: request,
      source: model.text, state: index ? 'ready' : 'pending', shape: model.style.shape,
      parameters: JSON.stringify({ aspect: 1, ...model.style.shapeParameters }),
      layout: JSON.stringify({ ...model.style.layout, fontContext: { fontSizePt: 10, xHeightPt: 4.30554 } }),
      targetIdentity: { owner, request, source: model.text },
      geometry: Object.fromEntries(['node', 'body', 'bodyTarget', 'contour'].map((name) => [name, geometry(box, matrix)])),
      paintedContours: [{ tag: index ? 'path' : 'circle', ...geometry(box, matrix) }] }
  })
  const target = { tag: 'circle', pointId: 'layout-circle', bodyTarget: false, contour: true,
    drawer: false, svg: true, canvas: true, canvasRoot: false, toolbar: false }
  const root = { tag: 'svg', pointId: null, svg: true, canvas: true, canvasRoot: true, drawer: false, toolbar: false }
  const canvasBounds = { x: 0, y: 0, width: 1612, height: 1116 }
  const measurement = { at: 100, id: 'layout-circle', source, labelDocumentRevision: stateBefore.labelDocumentRevision,
    hold: { started: 1, completed: 0, released: false }, modelOrder: fixture.diagram.strata.map(({ id }) => id),
    fixtureOrder: fixture.diagram.strata.map(({ id }) => id), renderOrder: points.map(({ id }) => id), points,
    requestedClick: structuredClone(requestedClick), contour: { fraction: .23, length: contour.length,
      local: structuredClone(contour.localBoundary), screen: structuredClone(contour.boundary) },
    canvas: { geometry: geometry(canvasBounds, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      viewBox: '0 0 520 360', preserveAspectRatio: 'xMidYMid meet' },
    viewport: { width: 1700, height: 1300, devicePixelRatio: 1, scrollX: 0, scrollY: 0, visual: null },
    exportBackground: { count: 1, tag: 'select', ariaLabel: 'SVG export background', value: 'transparent' },
    scrollAncestors: [{ element: root, bounds: canvasBounds, scrollTop: 0, scrollLeft: 0 }], clipFrames: [],
    elementFromPoint: target, elementsFromPoint: [target, root], eligibility: { eligible: true, reasons: [] }, errors: [] }
  const stage = (boundary, state) => ({ boundary, state: structuredClone(state), measurement: structuredClone(measurement) })
  const captured = points[0]
  const pendingPreparation = { scenario, sequence: nativeSelection.sequence, id: 'layout-circle', source, fixture,
    result: 'passed', stateBefore: structuredClone(stateBefore), stateAfter: structuredClone(stateAfter), nativeSelection,
    stages: [stage('current-contour-measurement', stateBefore), stage('immediate-before-input', stateBefore), stage('after-native-selection', stateAfter)],
    modifiers: { droppedEvents: 0, events: ['pointerdown', 'pointerup', 'click'].map((type) => ({ type, trusted: true,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, button: 0, buttons: type === 'pointerdown' ? 1 : 0,
      pointerId: 1, client: structuredClone(requestedClick), target: structuredClone(target), path: [structuredClone(target), root],
      owner: captured.owner, request: captured.request, source, documentRevision: stateBefore.labelDocumentRevision })) },
    cleanup: { observerRemoved: true }, secondaryErrors: [] }
  const beforeExportClick = { state: structuredClone(stateAfter), measurement: structuredClone(measurement) }
  beforeExportClick.measurement.exportBackground.value = background
  const click = { snapshot: { json: beforeExportClick.state.json, history: beforeExportClick.state.history,
    runtimeDiagramJson: beforeExportClick.state.runtimeDiagramJson, selection: structuredClone(beforeExportClick.state.selection),
    uiSettings: beforeExportClick.state.uiSettings,
    exportBackground: structuredClone(beforeExportClick.measurement.exportBackground),
    runtime: { documentRevision: stateBefore.labelDocumentRevision }, camera: fixture.diagram.camera, documentUnchanged: true,
    points: points.map((point, index) => ({ id: point.id, source: point.source, modelSource: point.source,
      style: structuredClone(point.model.style), position: structuredClone(point.model.position),
      owner: point.owner, request: point.request, pointRequest: point.request, status: point.state,
      held: index ? null : { started: 1, completed: 0, released: false },
      nodeTransform: `translate(${index * 10},20)` })) } }
  return { pendingPreparation, beforeExportClick, click }
}

export function syntheticStandalonePointDownload(directory, scenario) {
  const geometric = scenario.startsWith('point-geometric-download-')
  const background = scenario.includes('transparent') ? 'transparent' : 'white'
  const group = geometric ? geometricShapeGroup : layoutAnchorGroup
  const preparation = geometric ? null : syntheticPendingLayoutPreparation(background)
  const postClickView = !geometric && background === 'transparent'
    ? syntheticPendingLayoutViewEvidence({ click: preparation.click, source: preparation.pendingPreparation.source }) : null
  const models = preparation?.pendingPreparation.fixture.diagram.strata.filter(({ geometricKind }) => geometricKind === 'point')
  const specs = geometric ? geometricShapeManifest : layoutShapes.map((shape) => ({ shape, slug: shape.replaceAll(' ', '-'), parameters: layoutShapeParameters[shape] ?? {} }))
  const expected = specs.map((spec, index) => {
    const shape = spec.shape, source = geometric ? `${spec.slug} $x_i$` : models[index].text, id = `${geometric ? 'geometric' : 'layout'}-${spec.slug}`
    const anchor = shape === 'cylinder' ? 'shape center' : 'base', layout = geometric ? { innerXSep: 4, innerYSep: 2, anchor } : models[index].style.layout
    const contour = { tag: 'path', attributes: { d: `M${index},0 L${index + 3},0 L${index + 3},3 Z`, stroke: '#000000', fill: 'none' } }
    const paintRegions = shape === 'cylinder' ? ['#99ddff', '#ffcc66'].map((fill, index) => ({ role: index ? 'body' : 'end',
      tag: 'path', attributes: { d: `M${index},0 L3,0 L3,3 Z`, stroke: 'none', fill } })) : []
    const rendered = { source, shape, state: 'ready', math: 1, contourLength: 120, parameters: spec.parameters,
      contour, paintRegions, anchor, pointRequest: 'settled', bodyRequest: 'settled',
      bodyOrigin: { x: -20, y: -12 }, placement: { x: 310, y: 290 }, anchorOffset: { x: 20, y: 4 },
      placedAnchor: { x: 310, y: 290 }, bounds: { x: -20, y: -10, width: 40, height: 20 },
      nodeTransform: `translate(${index * 10},20)`, bodyTransform: 'translate(-20,-12)' }
    return { id, source, shape, ...(geometric ? {} : { result: 'passed', anchor, layout, modelPositionUnchanged: true }), rendered }
  })
  const click = geometric ? { snapshot: { points: expected.map((entry, index) => ({ id: entry.id, source: entry.source, status: index ? 'ready' : 'pending',
    nodeTransform: entry.rendered.nodeTransform, style: { shape: entry.shape, shapeParameters: specs[index].parameters } })) } } : preparation.click
  const svgPath = resolve(directory, `${scenario}.svg`), pngPath = resolve(directory, `${scenario}.png`)
  const fileUrl = pathToFileURL(svgPath).href
  const root = { localName: 'svg', namespace: 'http://www.w3.org/2000/svg', width: '520', height: '360', viewBox: '0 0 520 360' }
  const measurements = { url: fileUrl, contentType: 'image/svg+xml', readyState: 'complete', bodyExists: false, htmlBodyExists: false, parserErrors: [],
    root: { ...root, bounds: { x: 0, y: 0, width: 520, height: 360 } }, viewport: { width: 1500, height: 1150 }, scroll: { x: 0, y: 0 }, devicePixelRatio: 2 }
  const capture = { status: 'saved', requestedPath: pngPath, retainedPath: pngPath, fileExists: true,
    options: { path: pngPath, fullPage: false, scale: 'css', timeout: 5000 }, measurements: [measurements], before: measurements, after: structuredClone(measurements),
    coverage: { completeRoot: true, bounds: measurements.root.bounds, viewport: measurements.viewport }, coordinatesStable: true,
    png: { width: 1500, height: 1150, bytes: fixturePng.length } }
  const pending = { contour: { tag: 'path', attributes: { d: 'M0,0 L1,0 Z' } } }
  const releasedRequests = postClickView ? postClickView.cleanup.observation.hold.started : 1
  const capturedRelease = geometric ? null : { source: preparation.pendingPreparation.source,
    before: postClickView ? structuredClone(postClickView.cleanup.observation.hold) : { started: 1, completed: 0, released: false },
    result: { source: preparation.pendingPreparation.source, started: releasedRequests, completed: releasedRequests, fail: false }, after: null }
  const outputs = Object.fromEntries(['standalone', 'inlineMath'].map((mode) => [mode,
    expected.map((entry) => `\\node[anchor=${entry.shape === 'cylinder' ? 'shape center' : 'base'}] {${entry.source}};`).join('\n')]))
  const evidence = { scenario, group, result: 'passed', pageErrors: [], background, expected, click, capture,
    actualDownload: true, reopened: true, immutableSource: true, noExternalAssets: true,
    ...(geometric ? { shapes: specs.map(({ shape }) => shape), immutableParameters: true, separateCylinderPaints: true }
      : { capturedPending: true, immutableLayout: true, immutablePlacement: true, settledContour: true, combinedLabels: true, pending,
        ...(postClickView ? { postClickView } : {}),
        pendingPreparation: preparation.pendingPreparation, beforeExportClick: preparation.beforeExportClick, capturedRelease }) }
  const reopened = expected.map((entry) => ({ source: entry.source, shape: entry.shape, contour: entry.rendered.contour, glyphs: 1, errors: 0,
    ...(geometric ? { regions: entry.rendered.paintRegions.map((region) => ({ tag: region.tag, attributes: region.attributes })) }
      : { nodeTransform: entry.rendered.nodeTransform, bodyTransform: entry.rendered.bodyTransform }) }))
  const raw = { scenario, group, result: 'observed', background, svgPath, fileUrl, expected: structuredClone(expected), click: structuredClone(click), capture,
    requests: [fileUrl], pageErrors: [], standaloneErrors: [], cleanupErrors: [], reopened: structuredClone(reopened),
    document: { root, forbiddenCount: 0, externalReferences: [], backgroundCount: background === 'white' ? 1 : 0 },
    ...(geometric ? {} : { pending: structuredClone(pending), outputs,
      ...(postClickView ? { postClickView: structuredClone(postClickView) } : {}),
      pendingPreparation: structuredClone(preparation.pendingPreparation), beforeExportClick: structuredClone(preparation.beforeExportClick),
      capturedRelease: structuredClone(capturedRelease) }) }
  const element = ({ tag, attributes }) => `<${tag} ${Object.entries(attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}/>`
  const svg = `<svg xmlns="${root.namespace}" width="520" height="360" viewBox="0 0 520 360">${background === 'white' ? '<rect data-stratified-tikz-export-background="white" width="520" height="360" fill="white"/>' : ''}`
    + expected.map((entry) => `<g transform="${entry.rendered.nodeTransform}">${element(entry.rendered.contour)}${entry.rendered.paintRegions.map(element).join('')}<g transform="${entry.rendered.bodyTransform}"><title>${escape(entry.source)}</title><path d="M0,0 L1,1"/></g></g>`).join('') + '</svg>'
  writeFileSync(svgPath, svg); writeFileSync(pngPath, fixturePng)
  if (!geometric) writeFileSync(resolve(directory, `${scenario}-preparation.json`), JSON.stringify({ scenario, group, result: 'observed',
    pendingPreparation: preparation.pendingPreparation }, null, 2) + '\n')
  if (postClickView) writeFileSync(resolve(directory, `${scenario}-post-click-view.json`), JSON.stringify({ scenario: `${scenario}-post-click-view`,
    group, result: 'observed', postClickView }, null, 2) + '\n')
  for (const [mode, source] of Object.entries(outputs)) if (!geometric) writeFileSync(resolve(directory, `${scenario}-${mode}.tex`), source)
  return { evidence, raw, svgPath, pngPath, svg, png: Buffer.from(fixturePng) }
}
