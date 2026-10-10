import { syntheticPointSourceVisibilityAction } from './pointSourceVisibilityFixture.mjs'

// These records are fabricated controls for the parent evidence policy. They
// never stand in for cumulative native App/browser acceptance.
export function syntheticGeometricVisibilityEvidence({ cameraExpanded = false, cameraAngles = { thetaDeg: 13, phiDeg: -23 } } = {}) {
  const paint = { text: { color: '#000000', opacity: 1 }, fill: { enabled: true, color: '#e0f0ff', opacity: 1 },
    stroke: { enabled: true, color: '#203040', opacity: 1, width: .4, lineStyle: 'solid' } }
  const point = { id: 'app-point', geometricKind: 'point', codim: 2, layer: 0, name: 'Point', text: '$locked$',
    position: { x: 3, y: 3, z: 0 }, style: { kind: 'pointStyle', shape: 'dart', size: 8, opacity: 1, paint } }
  const lockedModel = { ambientDimension: 2, strata: [point], labels: [],
    layers: [{ value: 0, name: 'locked', locked: true }],
    camera: { mode: '2d', scale: 1, origin: { x: 0, y: 0 } } }
  const visibility = { enabled: false, pointVisibility: 'dimHidden', labelVisibility: 'alwaysForeground',
    surfaceDepthSort: true, curveOcclusion: true, sortMode: 'layerThenDepth', depthEpsilon: 1e-9 }
  const settings = { exportMode: 'standalone', includeCoordinateAxesInTikz: false, visibility }
  const state = (model, uiSettings, revision) => ({ json: JSON.stringify({ format: 'stratified-tikz-diagram', version: 2, diagram: model }),
    runtimeDiagramJson: JSON.stringify(model), history: JSON.stringify({ past: [], present: model, future: [] }),
    selection: null, labelDocumentRevision: revision, uiSettings: JSON.stringify(uiSettings) })
  const render = (modelPoint, dimmed = false) => ({ id: modelPoint.id, source: modelPoint.text, shape: modelPoint.style.shape,
    state: 'ready', contourLength: 120, pointVisibility: dimmed ? 'dimmed' : 'visible',
    occludingSurfaceId: dimmed ? 'occluder' : null, effectiveFillOpacity: dimmed ? .25 : 1, effectiveOpacity: dimmed ? .25 : 1,
    opacityAncestors: [{ tag: 'path', opacity: '1', attributeOpacity: null, isPointOwner: false, connected: true },
      { tag: 'g', opacity: '1', attributeOpacity: null, isPointOwner: false, connected: true },
      { tag: 'g', opacity: '1', attributeOpacity: '1', isPointOwner: true, pointId: modelPoint.id, connected: true }] })
  const lockedBefore = state(lockedModel, settings, 100), lockedRender = render(point)
  const locked = { before: lockedBefore, stateAfter: structuredClone(lockedBefore), rendered: lockedRender,
    renderedAfter: structuredClone(lockedRender) }
  const hiddenModel = structuredClone(lockedModel); hiddenModel.layers = [{ value: 0, name: 'hidden', visible: false }]
  const hidden = { state: state(hiddenModel, settings, 101), rendered: null }
  const dimModel = structuredClone(lockedModel)
  dimModel.ambientDimension = 3; dimModel.layers = [{ value: 0, name: 'Layer 0' }]
  dimModel.camera = { mode: '3d', kind: 'orthographic', thetaDeg: 90, phiDeg: 0, zoom: 100, pan: { x: 450, y: 350 } }
  Object.assign(dimModel.strata[0], { codim: 3, text: '$dimmed$', position: { x: 0, y: -1, z: 0 } })
  dimModel.strata[0].style.shape = 'semicircle'
  dimModel.strata.push({ id: 'occluder', geometricKind: 'sheet', codim: 1, kind: 'quadSheet', layer: 0,
    corners: [{ x: -2, y: 0, z: -2 }, { x: 2, y: 0, z: -2 }, { x: 2, y: 0, z: 2 }, { x: -2, y: 0, z: 2 }],
    style: { kind: 'sheetStyle', fillColor: '#4D9DE0', fillOpacity: .35, strokeColor: '#4D9DE0', strokeOpacity: 1 } })
  const cameraBefore = state(dimModel, { ...settings,
    camera3d: { ...cameraAngles, zoom: 1, pan: { x: 0, y: 0 } } }, 102)
  const cameraControl = (label, current, available = true) => {
    const axis = label === 'theta value' ? 'thetaDeg' : 'phiDeg'
    const control = { tag: 'input', type: 'number', value: String(JSON.parse(current.uiSettings).camera3d[axis]),
      connected: true, visible: true, enabled: true, ariaLabel: label, scope: '.camera-panel' }
    return { label, count: Number(available), ...(available ? control : {}), controls: available ? [control] : [] }
  }
  const cameraPreparation = { before: cameraBefore,
    controlsBefore: ['theta value', 'phi value'].map((label) => cameraControl(label, cameraBefore, cameraExpanded)),
    renderedBefore: render(dimModel.strata[0]), actions: [] }
  if (!cameraExpanded) cameraPreparation.expansion = { before: structuredClone(cameraBefore),
    stateAfter: structuredClone(cameraBefore), count: 1, expandedBefore: 'false', expandedAfter: 'true' }
  let cameraState = cameraBefore
  for (const [label, axis, value] of [['theta value', 'thetaDeg', '90'], ['phi value', 'phiDeg', '0']]) {
    const nextSettings = JSON.parse(cameraState.uiSettings); nextSettings.camera3d[axis] = Number(value)
    const next = { ...structuredClone(cameraState), uiSettings: JSON.stringify(nextSettings) }
    cameraPreparation.actions.push({ label, value, before: { state: cameraState, control: cameraControl(label, cameraState) },
      after: { state: next, control: cameraControl(label, next) } })
    cameraState = next
  }
  cameraPreparation.after = cameraState
  cameraPreparation.controlsAfter = ['theta value', 'phi value'].map((label) => cameraControl(label, cameraState))
  cameraPreparation.renderedAfter = render(dimModel.strata[0])
  const enabledSettings = JSON.parse(cameraState.uiSettings); enabledSettings.visibility.enabled = true
  const enable = { before: structuredClone(cameraState), after: { ...structuredClone(cameraState), uiSettings: JSON.stringify(enabledSettings) },
    checkbox: { count: 1, connected: true, enabled: true, checked: true, tag: 'input', type: 'checkbox', scope: '.source-panel',
      labels: [{ text: 'Enable approximate 3D visibility', outerHTML: '<label><input type="checkbox"><span>Enable approximate 3D visibility</span></label>' }] } }
  let current = enable.after, beforeRendered = render(dimModel.strata[0], true)
  const actions = ['dimHidden', 'hideHidden', 'dimHidden'].map((value, index) => {
    const afterRendered = value === 'hideHidden' ? null : render(dimModel.strata[0], true)
    const action = syntheticPointSourceVisibilityAction({ state: current, sequence: index + 1, value, beforeRendered, afterRendered })
    current = action.afterAction.state; beforeRendered = afterRendered
    return action
  })
  return { scenario: 'point-geometric-visibility', group: 'point-node-geometric-shapes', result: 'passed', pageErrors: [],
    hiddenAbsent: true, lockedUnchanged: true, lockedNotSelected: true, dimmedVisible: true, dimmedOpacity: true,
    locked: structuredClone(lockedRender), dimmed: structuredClone(actions.at(-1).afterAction.rendered),
    visibility: { locked, hidden, cameraPreparation, enable, actions } }
}

// Mutate fabricated raw representations without normalizing them. Keeping the
// locked before/after observations equal lets corrupt controls reach the layer
// contract instead of failing only the native action continuity comparison.
export function mutateSyntheticVisibilityStageModels(evidence, stage, mutate, sources = ['saved', 'runtime', 'history']) {
  const states = stage === 'locked' ? [evidence.visibility.locked.before, evidence.visibility.locked.stateAfter]
    : [evidence.visibility.hidden.state]
  for (const state of states) {
    if (sources.includes('saved')) {
      const saved = JSON.parse(state.json); mutate(saved.diagram); state.json = JSON.stringify(saved)
    }
    if (sources.includes('runtime')) {
      const runtime = JSON.parse(state.runtimeDiagramJson); mutate(runtime); state.runtimeDiagramJson = JSON.stringify(runtime)
    }
    if (sources.includes('history')) {
      const history = JSON.parse(state.history); mutate(history.present); state.history = JSON.stringify(history)
    }
  }
}

export const syntheticVisibilityLayerFaults = [
  ['locked-missing-layer-collection', (model) => { delete model.layers }],
  ['locked-non-array-layer-collection', (model) => { model.layers = {} }],
  ['locked-missing-layer-record', (model) => { model.layers = [] }],
  ['locked-duplicate-layer-record', (model) => { model.layers.push(structuredClone(model.layers[0])) }],
  ['locked-unrelated-layer-record', (model) => { model.layers[0].value = 1 }],
  ['locked-invalid-layer-record', (model) => { model.layers[0] = null }],
  ['locked-wrong-layer-name', (model) => { model.layers[0].name = 'unrelated' }],
  ['locked-invalid-layer-identity', (model) => { model.layers[0].value = '0' }],
  ['locked-wrong-point-layer', (model) => { model.strata[0].layer = 1 }],
  ['locked-moved-owned-layer', (model) => { model.strata[0].layer = 1; model.layers[0].value = 1 }],
  ['locked-missing-lock', (model) => { delete model.layers[0].locked }],
  ['locked-false-lock', (model) => { model.layers[0].locked = false }],
  ['locked-false-visibility', (model) => { model.layers[0].visible = false }],
].map(([name, mutate]) => [name, (evidence) => mutateSyntheticVisibilityStageModels(evidence, 'locked', mutate)])
syntheticVisibilityLayerFaults.push(
  ['locked-missing-after-render', (evidence) => { delete evidence.visibility.locked.renderedAfter }],
  ['locked-wrong-after-render-owner', (evidence) => { evidence.visibility.locked.renderedAfter.id = 'another-point' }],
)

for (const [name, value] of [['null', null], ['string', 'true'], ['number', 1], ['object', {}], ['array', []]]) {
  syntheticVisibilityLayerFaults.push([`locked-invalid-${name}-visibility`, (evidence) => {
    mutateSyntheticVisibilityStageModels(evidence, 'locked', (model) => { model.layers[0].visible = value })
  }])
}
for (const stage of ['locked', 'hidden']) for (const source of ['saved', 'runtime', 'history']) {
  syntheticVisibilityLayerFaults.push([`${stage}-${source}-layer-disagreement`, (evidence) => {
    mutateSyntheticVisibilityStageModels(evidence, stage, (model) => { model.layers[0].name = 'disagrees' }, [source])
  }])
}
for (const source of ['saved', 'runtime', 'history']) {
  syntheticVisibilityLayerFaults.push([`locked-${source}-visibility-representation-disagreement`, (evidence) => {
    mutateSyntheticVisibilityStageModels(evidence, 'locked', (model) => { model.layers[0].visible = true }, [source])
  }])
}
for (const [name, mutate] of [
  ['hidden-omitted-visibility', (model) => { delete model.layers[0].visible }],
  ['hidden-true-visibility', (model) => { model.layers[0].visible = true }],
  ['hidden-missing-layer-record', (model) => { model.layers = [] }],
  ['hidden-duplicate-layer-record', (model) => { model.layers.push(structuredClone(model.layers[0])) }],
  ['hidden-wrong-point-layer', (model) => { model.strata[0].layer = 1 }],
  ['hidden-source-edit', (model) => { model.strata[0].text = '$changed$' }],
  ['hidden-style-edit', (model) => { model.strata[0].style.paint.fill.color = '#ff0000' }],
  ['hidden-coordinate-edit', (model) => { model.strata[0].position.x = 4 }],
]) syntheticVisibilityLayerFaults.push([name, (evidence) => mutateSyntheticVisibilityStageModels(evidence, 'hidden', mutate)])
