import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { assertStandaloneReopeningRecord, validateStandaloneSvgCaptureEvidence } from './standaloneSvgCaptureContract.mjs'
import { assertPointNativeDragEvidence } from './pointNativeDrag.mjs'
import { assertHiddenPointVisibilityAction } from './pointSourceVisibility.mjs'

export const geometricShapeGroup = 'point-node-geometric-shapes'
export const geometricShapeManifest = [
  { shape: 'ellipse', parameters: {} },
  { shape: 'diamond', parameters: { aspect: 1.8 } },
  { shape: 'regular polygon', parameters: { regularPolygonSides: 7, borderRotate: 23 } },
  { shape: 'star', parameters: { starPoints: 7, starPointMode: 'height', starPointHeight: 8, borderRotate: 17 } },
  { shape: 'trapezium', parameters: { trapeziumLeftAngle: 65, trapeziumRightAngle: 75, trapeziumStretches: true, trapeziumStretchesBody: true } },
  { shape: 'isosceles triangle', parameters: { isoscelesTriangleApexAngle: 65, isoscelesTriangleStretches: true, borderUsesIncircle: true, borderRotate: 31 } },
  { shape: 'kite', parameters: { kiteUpperVertexAngle: 100, kiteLowerVertexAngle: 75, borderUsesIncircle: true, borderRotate: 20 } },
  { shape: 'dart', parameters: { dartTipAngle: 55, dartTailAngle: 125 } },
  { shape: 'semicircle', parameters: { borderUsesIncircle: true, borderRotate: 33 } },
  { shape: 'circular sector', parameters: { circularSectorAngle: 110, borderRotate: 17 } },
  { shape: 'cylinder', parameters: { aspect: .55, cylinderUsesCustomFill: true, cylinderEndFill: '#ffcc66', cylinderBodyFill: '#99ddff' } },
].map((entry) => ({ ...entry, slug: entry.shape.replaceAll(' ', '-') }))
export const geometricBodyVariants = [
  { key: 'empty', source: '' }, { key: 'plain', source: 'Wide plain body' },
  { key: 'math', source: '$\\frac{x_1}{y^2}$' }, { key: 'mixed', source: ' 日本 $x_i$ Ω ' },
]
export const geometricShapeScenarios = [
  ...geometricShapeManifest.map(({ slug }) => `point-geometric-${slug}`),
  'point-geometric-native-contours-2d-3d', 'point-geometric-visibility',
  'point-geometric-download-transparent', 'point-geometric-download-white',
]
export function geometricShapeArtifacts(name) {
  return [`${name}.json`, ...(name.startsWith('point-geometric-download-')
    ? [`${name}.svg`, `${name}.png`, `${name}-standalone.json`] : [])]
}

export function assertGeometricStandaloneEvidence(evidence, raw, artifactDir) {
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  assert.ok(evidence.scenario.startsWith('point-geometric-download-'))
  assertStandaloneReopeningRecord(raw, evidence, artifactDir)
  for (const [index, expected] of evidence.expected.entries()) {
    const actual = raw.reopened[index]
    assert.equal(actual.source, expected.source); assert.equal(actual.shape, expected.shape)
    assert.equal(actual.missing, undefined); assert.equal(actual.errors, 0); assert.ok(actual.glyphs > 0)
    assert.deepEqual(actual.contour, expected.rendered.contour, 'Reopened contour matches settled click-time inputs')
    const regions = expected.rendered.paintRegions.map((region) => ({ tag: region.tag, attributes: region.attributes }))
    assert.deepEqual(actual.regions, regions, 'Reopened cylinder regions match captured paints')
  }
  assert.deepEqual(evidence.capture, raw.capture, 'Terminal scenario retains the actual capture record')
  validateStandaloneSvgCaptureEvidence(raw.capture, { svgPath: raw.svgPath,
    pngPath: resolve(artifactDir, `${evidence.scenario}.png`), root: raw.document.root })
}
const selectionStateFields = ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'selection', 'uiSettings']
function assertSelectionRevision(state, message) {
  assert.ok(Number.isInteger(state?.labelDocumentRevision) && state.labelDocumentRevision >= 0,
    `${message}: labelDocumentRevision must be a nonnegative integer`)
}
function assertSelectionStateUnchanged(before, after, message, includeSelection = true) {
  assertSelectionRevision(before, message); assertSelectionRevision(after, message)
  for (const field of selectionStateFields) {
    if (field === 'selection' && !includeSelection) continue
    assert.ok(Object.hasOwn(before, field) && Object.hasOwn(after, field), `${message}: raw ${field} is retained`)
    assert.deepEqual(after[field], before[field], `${message}: preserves ${field}`)
  }
}
function assertSelectionSnapshot(snapshot, state, id, message) {
  assert.ok(snapshot && state, `${message}: raw observation and authoritative state exist`)
  assert.deepEqual(snapshot.errors, [], `${message}: observations completed`)
  assertSelectionRevision(snapshot, message); assertSelectionRevision(state, message)
  assert.equal(snapshot.labelDocumentRevision, state.labelDocumentRevision, `${message}: observed document epoch matches authoritative state`)
  assert.deepEqual(snapshot.selection, state.selection, `${message}: observed selected owner matches authoritative state`)
  const runtime = JSON.parse(state.runtimeDiagramJson), model = runtime.strata.find((point) => point.id === id)
  assert.ok(model && model.geometricKind === 'point', `${message}: expected geometric point exists`)
  assert.deepEqual(snapshot.model, model, `${message}: observed point matches authoritative model`)
  assert.deepEqual(snapshot.camera, runtime.camera ?? null, `${message}: camera matches authoritative model`)
  assert.ok(Array.isArray(snapshot.workPlaneControls), `${message}: raw work plane controls exist`)
  assert.ok(Array.isArray(snapshot.workPlaneStatus), `${message}: raw work plane status exists`)
  assert.ok(snapshot.layout?.owner && snapshot.layout.request, `${message}: connected layout owner and request exist`)
  assert.deepEqual(JSON.parse(snapshot.layout.owner), ['point-node', state.labelDocumentRevision, id], `${message}: layout belongs to current document and point`)
  assert.equal(snapshot.layout.request, snapshot.layout.bodyRequest, `${message}: body and contour share one request`)
  assert.equal(snapshot.layout.source, model.text ?? '', `${message}: source agrees with the raw point`)
}
function assertToolbarSnapshot(snapshot, message) {
  const toolbar = snapshot?.toolbar
  assert.ok(toolbar && typeof toolbar.collapsed === 'boolean', `${message}: raw toolbar state exists`)
  assert.equal(toolbar.overlayCount, 1, `${message}: unique toolbar overlay`)
  assert.equal(toolbar.historyCount, 1, `${message}: History remains mounted`)
  assert.equal(toolbar.floatingCount, Number(!toolbar.collapsed), `${message}: bounded Creation toolbar state`)
  assert.equal(toolbar.expandCount, Number(toolbar.collapsed), `${message}: unique native expand control`)
  assert.equal(toolbar.collapseCount, Number(!toolbar.collapsed), `${message}: unique native collapse control`)
  assert.ok(toolbar.quickStyleCount === 0 || toolbar.quickStyleCount === 1, `${message}: bounded quick style state`)
  if (toolbar.collapsed) assert.equal(toolbar.quickStyleCount, 0, `${message}: quick style controls detach`)
}
function transformedSelectionPoint(point, matrix, message) {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), `${message}: finite local coordinates`)
  assert.ok(matrix && ['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(matrix[key])), `${message}: finite screen CTM`)
  assert.ok(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-12, `${message}: nonsingular screen CTM`)
  return { x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f }
}
function assertClickMeasurement(rendered, snapshot, requestedClick, clickKind, message) {
  assert.ok(rendered && snapshot?.geometry?.contour, `${message}: connected fresh geometry exists`)
  const contour = snapshot.geometry.contour
  assert.equal(contour.connected, true, `${message}: measured contour is connected`)
  assert.ok(Number.isFinite(contour.length) && contour.length > 0, `${message}: positive native contour length`)
  assert.equal(contour.fraction, .23, `${message}: original contour arclength is retained`)
  const boundary = transformedSelectionPoint(contour.localBoundary, contour.screenCTM, message)
  // Native SVGPoint projection may return the exact binary32 representation.
  // This permits that machine conversion, without widening geometry tolerances.
  for (const axis of ['x', 'y']) assert.ok(Math.abs(boundary[axis] - contour.boundary[axis]) < 1e-7
    || contour.boundary[axis] === Math.fround(boundary[axis]),
    `${message}: contour boundary follows current CTM`)
  assert.deepEqual(requestedClick, snapshot.requestedClick, `${message}: raw hit observation uses requested coordinates`)
  if (clickKind === 'body') {
    assert.ok(rendered.bodyOverflow, `${message}: body input retains independent ink measurement`)
    const bodyClick = transformedSelectionPoint(rendered.bodyOverflow.clickInContour, contour.screenCTM, message)
    for (const axis of ['x', 'y']) assert.ok(Math.abs(bodyClick[axis] - requestedClick[axis]) < 1e-7,
      `${message}: body input follows current contour CTM`)
    assert.deepEqual(requestedClick, rendered.boundary, `${message}: native body coordinates stay authoritative`)
  } else if (clickKind === 'boundary') {
    assert.deepEqual(requestedClick, rendered.boundary, `${message}: requested original boundary is freshly measured`)
    assert.deepEqual(requestedClick, contour.boundary, `${message}: requested original boundary equals the native CTM projection`)
  } else {
    assert.equal(clickKind, 'center', `${message}: known native input kind`)
    assert.deepEqual(requestedClick, rendered.center, `${message}: requested center is freshly measured`)
    assert.deepEqual(requestedClick, snapshot.geometry.point.center, `${message}: center uses current connected point geometry`)
  }
}
function intendedSelectionTarget(target, selection, id, requireUnselected) {
  return target?.svg === true && target.canvas === true && target.drawer === false
    && (target.pointId === id || (!requireUnselected && selection?.id === id && target.pointHandle === true))
}
function intendedSelectionPath(event, selection, id, requireUnselected) {
  return intendedSelectionTarget(event.target, selection, id, requireUnselected)
    && event.path.some((element) => element?.canvasRoot === true)
    && (event.target.pointId === id ? event.path.some((element) => element?.pointId === id)
      : event.path.some((element) => element?.ariaLabel === 'Selected point drag handles'))
}

// This raw contract is shared by contour selection and the layout owner cycle.
// Toolbar action counts alone cannot establish preparation or restoration.
export function assertPointToolbarPreparation(preparation, restoration, id) {
  assert.ok(preparation && restoration, 'Native selection retains owned toolbar preparation and restoration')
  assertSelectionSnapshot(preparation.inherited, preparation.stateBefore, id, 'Inherited toolbar')
  assertToolbarSnapshot(preparation.inherited, 'Inherited toolbar')
  assert.ok(Array.isArray(preparation.actions), 'Raw toolbar UI actions are retained')
  const selects = preparation.actions.filter(({ name }) => name === 'Select')
  assert.equal(selects.length, 1, 'Exactly one real native Select action is retained')
  let selected = false, collapsedForObstruction = false, previousState = preparation.stateBefore
  let previousSnapshot = preparation.inherited
  for (const action of preparation.actions) {
    assert.equal(action.error, undefined, 'Owned native toolbar action succeeded')
    assert.ok(['Select', 'expand', 'collapse'].includes(action.name), 'Known native toolbar action')
    assert.equal(action.controlCount, 1, 'Native toolbar action has one actual control')
    assertSelectionSnapshot(action.before, action.stateBefore, id, `Before ${action.name}`)
    assertSelectionSnapshot(action.after, action.stateAfter, id, `After ${action.name}`)
    assertToolbarSnapshot(action.before, `Before ${action.name}`); assertToolbarSnapshot(action.after, `After ${action.name}`)
    assertSelectionStateUnchanged(action.stateBefore, action.stateAfter, `Native toolbar ${action.name}`)
    for (const field of ['camera', 'workPlaneControls', 'workPlaneStatus', 'layout']) {
      assert.deepEqual(action.after[field], action.before[field], `Native toolbar ${action.name} preserves ${field}`)
    }
    if (action.purpose !== 'restore') {
      assertSelectionStateUnchanged(previousState, action.stateBefore, 'Toolbar preparation action continuity')
      assert.equal(action.before.toolbar.collapsed, previousSnapshot.toolbar.collapsed, 'Toolbar preparation state continuity')
      previousState = action.stateAfter; previousSnapshot = action.after
    }
    if (action.name === 'Select') {
      assert.equal(action.purpose, 'select', 'Select is an explicit native mode action')
      assert.equal(action.before.toolbar.collapsed, false, 'Native Select runs while Creation controls are available')
      assert.equal(action.after.toolbar.collapsed, false, 'Native Select retains Creation controls')
      assert.equal(action.after.tool.selectPressed, 'true', 'Actual native Select mode is observed pressed')
      selected = true
    } else {
      assert.equal(action.oppositeCount, 1, 'Native toolbar transition confirms one opposite control')
      assert.equal(action.after.toolbar.collapsed, action.name === 'collapse', 'Native toolbar action reaches the requested state')
      assert.notEqual(action.after.toolbar.collapsed, action.before.toolbar.collapsed, 'Owned toolbar action changes its inherited state once')
      if (action.purpose === 'select-access') {
        assert.equal(selected, false, 'Select access precedes native Select')
        assert.equal(action.name, 'expand', 'Collapsed Select access uses the native expand control')
        assert.equal(preparation.inherited.toolbar.collapsed, true, 'Expansion is owned only for inherited collapse')
      } else if (action.purpose === 'obstruction') {
        assert.equal(selected, true, 'Obstruction collapse follows native Select')
        assert.equal(action.name, 'collapse', 'Creation obstruction uses one native collapse action')
        assert.equal(collapsedForObstruction, false, 'Creation obstruction is collapsed only once')
        collapsedForObstruction = true
        const obstructed = preparation.obstructed
        assert.ok(obstructed?.observation?.elementFromPoint?.creationToolbar === true
          || obstructed?.observation?.elementFromPoint?.quickStyle === true,
        'Retained raw first hit establishes expanded Creation toolbar obstruction')
        assert.equal(obstructed.observation.toolbar.collapsed, false, 'Obstruction was observed with Creation controls expanded')
        assertClickMeasurement(obstructed.rendered, obstructed.observation, obstructed.observation.requestedClick,
          obstructed.rendered.bodyOverflow ? 'body' : preparation.clickKind ?? 'boundary', 'Obstructed toolbar geometry')
      } else assert.equal(action.purpose, 'restore', 'Toolbar action has an explicitly owned restoration purpose')
    }
  }
  assertSelectionStateUnchanged(preparation.stateBefore, preparation.statePrepared, 'Completed toolbar preparation')
  assertSelectionSnapshot(preparation.prepared, preparation.statePrepared, id, 'Prepared toolbar')
  assertToolbarSnapshot(preparation.prepared, 'Prepared toolbar')
  const clickKind = preparation.rendered?.bodyOverflow ? 'body' : preparation.clickKind ?? 'boundary'
  assertClickMeasurement(preparation.rendered, preparation.prepared, preparation.requestedClick, clickKind, 'Prepared native geometry')
  assert.ok(intendedSelectionTarget(preparation.prepared.elementFromPoint, preparation.statePrepared.selection, id, false),
    'Prepared raw first hit reaches the intended SVG owner/path')
  assert.deepEqual(preparation.prepared.elementsFromPoint[0], preparation.prepared.elementFromPoint, 'Prepared raw hit stack retains first target')
  assertSelectionStateUnchanged(previousState, preparation.statePrepared, 'Toolbar preparation terminal continuity')
  assert.equal(previousSnapshot.toolbar.collapsed, preparation.prepared.toolbar.collapsed, 'Prepared toolbar uses final owned state')
  assertSelectionSnapshot(restoration.before, restoration.stateBefore, id, 'Before toolbar restoration')
  assertSelectionSnapshot(restoration.after, restoration.stateAfter, id, 'After toolbar restoration')
  assertSelectionStateUnchanged(restoration.stateBefore, restoration.stateAfter, 'Native toolbar restoration')
  assertToolbarSnapshot(restoration.before, 'Before toolbar restoration'); assertToolbarSnapshot(restoration.after, 'After toolbar restoration')
  assert.equal(restoration.after.toolbar.collapsed, preparation.inherited.toolbar.collapsed, 'Toolbar restoration returns caller inherited state')
  assert.equal(restoration.error, undefined, 'Native toolbar restoration succeeded')
  for (const field of ['camera', 'workPlaneControls', 'workPlaneStatus', 'layout']) {
    assert.deepEqual(restoration.after[field], restoration.before[field], `Native toolbar restoration preserves ${field}`)
  }
  const restores = preparation.actions.filter(({ purpose }) => purpose === 'restore')
  assert.equal(restores.length, Number(restoration.before.toolbar.collapsed !== preparation.inherited.toolbar.collapsed),
    'Only a toolbar change owned by this preparation is restored')
  if (restores.length) {
    assertSelectionStateUnchanged(restoration.stateBefore, restores[0].stateBefore, 'Restoration action starts from post-canvas state')
    assertSelectionStateUnchanged(restores[0].stateAfter, restoration.stateAfter, 'Restoration action terminal continuity')
  }
}
export function assertGeometricSelectionEvidence(selection, id, expectedClickKind = 'boundary') {
  assert.ok(selection && typeof selection === 'object', 'Raw native point selection is retained')
  assert.equal(selection.id, id); assert.equal(selection.clickKind, expectedClickKind)
  assert.equal(selection.primary, undefined); assert.equal(selection.actionError, undefined)
  assert.deepEqual(selection.secondaryErrors, [], 'Native selection diagnostics completed')
  const preparation = selection.preparation
  assert.ok(preparation, 'Native selection drawer preparation is retained')
  assertSelectionStateUnchanged(preparation.stateBefore, preparation.stateAfter, 'Inspector preparation')
  assert.equal(preparation.closeActions, Number(preparation.inherited.inspector.open), 'Inspector close action is owned')
  assert.equal(preparation.closedDrawerCount, 0); assert.equal(preparation.openerCount, 1); assert.equal(preparation.openerExpanded, 'false')
  assert.equal(preparation.closed.inspector.open, false)
  assertPointToolbarPreparation(selection.toolbarPreparation, selection.toolbarRestoration, id)
  assertSelectionStateUnchanged(selection.toolbarPreparation.statePrepared, selection.stateBefore, 'Canvas click begins after preserved toolbar preparation')
  assertSelectionSnapshot(selection.before, selection.stateBefore, id, 'Before native point input')
  assertSelectionSnapshot(selection.after, selection.stateAfter, id, 'After native point input')
  assertSelectionStateUnchanged(selection.stateBefore, selection.stateAfter, 'Native point selection', false)
  assert.deepEqual(selection.selected, selection.stateAfter.selection)
  assert.equal(selection.selected?.kind, 'stratum'); assert.equal(selection.selected.id, id)
  if (selection.requireUnselected) assert.equal(selection.before.selection, null, 'Native initial point input starts unselected')
  assert.equal(selection.before.inspector.open, false, 'Inspector is detached before native point input')
  assertClickMeasurement(selection.rendered, selection.before, selection.requestedClick, expectedClickKind, 'Fresh native point input')
  assert.ok(intendedSelectionTarget(selection.before.elementFromPoint, selection.before.selection, id, selection.requireUnselected),
    'Fresh pre-input first hit belongs to the intended SVG owner/path')
  assert.deepEqual(selection.before.elementsFromPoint[0], selection.before.elementFromPoint, 'Raw hit stack starts with intended first target')
  assert.equal(selection.before.events.length, 0, 'Canvas observer excludes preparation actions')
  assert.equal(selection.after.droppedEvents, 0, 'Native point input retains all scoped events')
  assert.deepEqual(selection.events, selection.after.events, 'Published native point events retain raw after-input records')
  const events = selection.after.events
  assert.equal(events.length, 3, 'Exactly one native down/up/click gesture is retained')
  let previous = -1, down, capturedUp = false
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    const index = events.findIndex((event, index) => index > previous && event.type === type && event.trusted === true
      && event.button === 0 && Math.abs(event.client?.x - selection.requestedClick.x) < 1
      && Math.abs(event.client?.y - selection.requestedClick.y) < 1
      && (intendedSelectionPath(event, selection.before.selection, id, selection.requireUnselected)
        || (down?.target.pointHandle === true && Number.isInteger(down.pointerId)
          && (event.pointerId === down.pointerId || (type === 'click' && event.pointerId === null))
          && event.target?.canvasRoot === true && event.target.drawer === false && event.path.some((element) => element?.canvasRoot === true)
          && (type === 'pointerup' ? event.canvasHasPointerCapture === true : capturedUp))))
    assert.ok(index >= 0, `Raw trusted point selection ${type} reaches the intended SVG production path in order`)
    const event = events[index]
    assertSelectionRevision(event.App, `Native ${type}`)
    assert.equal(event.App.labelDocumentRevision, selection.stateBefore.labelDocumentRevision, `Native ${type} retains current document epoch`)
    assert.equal(event.layout.owner, selection.before.layout.owner); assert.equal(event.layout.request, selection.before.layout.request)
    assert.equal(event.layout.source, selection.before.layout.source); assert.equal(event.layout.shape, selection.before.layout.shape)
    if (type === 'pointerdown') { down = event; assert.ok(Number.isInteger(event.pointerId)); assert.deepEqual(event.App.selection, selection.before.selection) }
    else assert.ok(event.pointerId === down.pointerId || (type === 'click' && event.pointerId === null), 'Native selection retains pointer identity')
    capturedUp = event.canvasHasPointerCapture === true; previous = index
  }
  assertSelectionStateUnchanged(selection.stateAfter, selection.toolbarRestoration.stateBefore, 'Toolbar restoration follows expected selected owner')
}
function geometricVisibilityState(state, message) {
  assertSelectionRevision(state, message)
  for (const field of selectionStateFields) assert.ok(Object.hasOwn(state, field), `${message}: raw ${field} is retained`)
  const model = JSON.parse(state.runtimeDiagramJson), saved = JSON.parse(state.json), history = JSON.parse(state.history)
  assert.equal(saved.version, 2, `${message}: current saved envelope is retained`)
  assert.ok(saved.diagram && history.present, `${message}: saved and current history diagrams exist`)
  const points = [model, saved.diagram, history.present].map((diagram) => {
    assert.ok(Array.isArray(diagram.strata), `${message}: raw point collections exist`)
    const matching = diagram.strata.filter((point) => point?.id === 'app-point')
    assert.equal(matching.length, 1, `${message}: exactly one expected point exists in each raw model`)
    assert.ok(Array.isArray(diagram.layers), `${message}: explicit raw layer metadata collections exist`)
    return matching[0]
  })
  const [point, savedPoint, historyPoint] = points
  assert.equal(point.geometricKind, 'point'); assert.equal(point.codim, model.ambientDimension)
  assert.deepEqual(savedPoint, point, `${message}: exact raw saved/runtime point data agrees`)
  assert.deepEqual(historyPoint, point, `${message}: exact raw current history/runtime point data agrees`)
  assert.deepEqual(saved.diagram.layers, model.layers, `${message}: exact raw saved/runtime layer metadata agrees`)
  assert.deepEqual(history.present.layers, model.layers, `${message}: exact raw current history/runtime layer metadata agrees`)
  return { model, point, settings: JSON.parse(state.uiSettings) }
}
function geometricVisibilityLayer({ model, point }, expectedName, message) {
  assert.equal(point.layer, 0, `${message}: the expected point retains its configured layer identity`)
  for (const layer of model.layers) {
    assert.ok(layer && typeof layer === 'object' && !Array.isArray(layer), `${message}: raw layer metadata records are valid objects`)
    assert.ok(Object.hasOwn(layer, 'value') && typeof layer.value === 'number' && Number.isFinite(layer.value),
      `${message}: raw layer identity is a finite number`)
    assert.ok(Object.hasOwn(layer, 'name') && typeof layer.name === 'string' && layer.name.trim().length > 0,
      `${message}: raw layer name is retained`)
    for (const field of ['visible', 'locked']) if (Object.hasOwn(layer, field)) {
      assert.equal(typeof layer[field], 'boolean', `${message}: present raw layer ${field} is boolean`)
    }
  }
  const matching = model.layers.filter(({ value }) => value === point.layer)
  assert.equal(matching.length, 1, `${message}: exactly one actual layer record owns the expected point`)
  const layer = matching[0]
  assert.equal(layer.name, expectedName, `${message}: actual owned layer retains its configured name`)
  return layer
}
function assertVisibilitySettingsChange(before, after, key, value, message) {
  const previous = geometricVisibilityState(before, `${message} before`)
  const current = geometricVisibilityState(after, `${message} after`)
  for (const field of selectionStateFields.filter((field) => field !== 'uiSettings')) {
    assert.deepEqual(after[field], before[field], `${message}: preserves ${field}`)
  }
  assert.ok(previous.settings.visibility && current.settings.visibility, `${message}: authoritative visibility settings exist`)
  assert.deepEqual(current.settings, { ...previous.settings, visibility: { ...previous.settings.visibility, [key]: value } },
    `${message}: changes only the intended visibility setting`)
  return current
}
function assertGeometricVisibilityRender(rendered, state, message, dimmed = false) {
  const { point } = geometricVisibilityState(state, message)
  assert.ok(rendered && typeof rendered === 'object', `${message}: connected production point render exists`)
  assert.equal(rendered.id, point.id, `${message}: rendering belongs to the actual expected point`)
  assert.equal(rendered.source, point.text, `${message}: rendered raw source matches the model`)
  assert.equal(rendered.shape, point.style.shape, `${message}: rendered shape matches the model`)
  assert.equal(rendered.state, 'ready', `${message}: the actual body settled`)
  assert.ok(Number.isFinite(rendered.contourLength) && rendered.contourLength > 0, `${message}: actual contour is nonempty`)
  assert.equal(rendered.pointVisibility, dimmed ? 'dimmed' : 'visible', `${message}: actual visibility classification`)
  if (dimmed) assert.equal(rendered.occludingSurfaceId, 'occluder', `${message}: actual occluding production sheet`)
  assert.ok(Number.isFinite(rendered.effectiveFillOpacity) && rendered.effectiveFillOpacity > 0 && rendered.effectiveFillOpacity <= 1,
    `${message}: raw computed contour fill opacity`)
  if (dimmed) assert.ok(rendered.effectiveFillOpacity < 1, `${message}: the actual dimmed contour fill opacity remains below one`)
  assert.ok(Array.isArray(rendered.opacityAncestors) && rendered.opacityAncestors.length > 0,
    `${message}: actual cumulative ancestor opacity is retained`)
  assert.equal(rendered.opacityAncestors.filter(({ isPointOwner }) => isPointOwner).length, 1,
    `${message}: opacity measurement includes exactly one expected point owner`)
  assert.equal(rendered.opacityAncestors.find(({ isPointOwner }) => isPointOwner).pointId, point.id,
    `${message}: cumulative opacity belongs to the expected connected point owner`)
  let opacity = rendered.effectiveFillOpacity
  for (const ancestor of rendered.opacityAncestors) {
    assert.equal(ancestor.connected, true, `${message}: opacity ancestor remains connected`)
    assert.equal(typeof ancestor.tag, 'string', `${message}: raw opacity ancestor tag`)
    assert.equal(typeof ancestor.opacity, 'string', `${message}: raw computed opacity text`)
    assert.ok(Object.hasOwn(ancestor, 'attributeOpacity'), `${message}: raw opacity attribute exists`)
    const value = Number(ancestor.opacity)
    assert.ok(ancestor.opacity.length > 0 && Number.isFinite(value) && value >= 0 && value <= 1, `${message}: finite actual ancestor opacity`)
    opacity *= value
  }
  assert.equal(rendered.effectiveOpacity, opacity, `${message}: effective opacity is computed from the retained actual ancestor chain`)
  assert.ok(opacity > 0 && (dimmed ? opacity < 1 : opacity <= 1), `${message}: actual ${dimmed ? 'dimmed' : 'visible'} opacity`)
}
function assertVisibilityCameraControl(observation, label, state, available = true) {
  assert.equal(observation?.label, label, 'Camera observation belongs to the exact native coordinate field')
  assert.equal(observation.count, available ? 1 : observation.count, 'Unique actual camera field')
  assert.ok(observation.count === 0 || observation.count === 1, 'Missing/unique camera field is explicitly observed')
  assert.equal(observation.controls?.length, observation.count, 'Raw camera controls agree with actual lookup count')
  if (observation.count === 0) return
  const control = observation.controls[0]
  assert.equal(control.scope, '.camera-panel'); assert.equal(control.ariaLabel, label)
  assert.equal(control.tag, 'input'); assert.equal(control.type, 'number'); assert.equal(control.connected, true)
  const settings = JSON.parse(state.uiSettings), axis = label === 'theta value' ? 'thetaDeg' : 'phiDeg'
  assert.equal(Number(control.value), settings.camera3d?.[axis], 'Native camera value matches authoritative UI camera settings')
  for (const field of ['tag', 'type', 'value', 'connected', 'visible', 'enabled', 'ariaLabel', 'scope']) {
    assert.deepEqual(observation[field], control[field], `Published camera ${field} retains its actual control observation`)
  }
  if (available) {
    assert.equal(control.visible, true, 'Native camera field is visible before real input')
    assert.equal(control.enabled, true, 'Native camera field is enabled before real input')
  }
}
export function assertVisibilityCameraPreparation(preparation) {
  assert.ok(preparation && Array.isArray(preparation.actions), 'Native visibility camera preparation is retained')
  const { before, after, controlsBefore, controlsAfter, expansion, actions } = preparation
  const { settings } = geometricVisibilityState(before, 'Camera preparation')
  assert.ok(settings.camera3d && Number.isFinite(settings.camera3d.thetaDeg) && Number.isFinite(settings.camera3d.phiDeg),
    'Actual precondition camera angles exist')
  for (const [controls, state, available] of [[controlsBefore, before, false], [controlsAfter, after, true]]) {
    assert.equal(controls?.length, 2, 'Both exact native camera controls are retained')
    for (const label of ['theta value', 'phi value']) {
      const observations = controls.filter((control) => control.label === label)
      assert.equal(observations.length, 1, 'Exact camera coordinate caption is unique')
      assertVisibilityCameraControl(observations[0], label, state, available)
    }
  }
  let previous = before
  if (expansion) {
    assertSelectionStateUnchanged(previous, expansion.before, 'Camera expansion starts from observed inherited state')
    assertSelectionStateUnchanged(expansion.before, expansion.stateAfter, 'Native camera-details expansion')
    assert.equal(expansion.count, 1); assert.equal(expansion.expandedBefore, 'false'); assert.equal(expansion.expandedAfter, 'true')
    previous = expansion.stateAfter
  }
  assert.equal(actions.length, 2, 'Both actual camera angles are set through native controls')
  for (const [index, [label, axis, value]] of [['theta value', 'thetaDeg', '90'], ['phi value', 'phiDeg', '0']].entries()) {
    const action = actions[index]
    assert.equal(action.label, label); assert.equal(action.value, value)
    assertSelectionStateUnchanged(previous, action.before.state, 'Native camera action continuity')
    assertVisibilityCameraControl(action.before.control, label, action.before.state)
    assertVisibilityCameraControl(action.after.control, label, action.after.state)
    for (const field of selectionStateFields.filter((field) => field !== 'uiSettings')) {
      assert.deepEqual(action.after.state[field], action.before.state[field], `Native camera preparation preserves ${field}`)
    }
    const beforeSettings = JSON.parse(action.before.state.uiSettings), afterSettings = JSON.parse(action.after.state.uiSettings)
    assert.deepEqual(afterSettings, { ...beforeSettings, camera3d: { ...beforeSettings.camera3d, [axis]: Number(value) } },
      'Native camera angle action changes only its intended UI angle')
    assert.equal(action.after.control.value, value, 'Native camera input retains its exact requested final value')
    assert.equal(action.error, undefined, 'Native camera angle input succeeded')
    previous = action.after.state
  }
  assertSelectionStateUnchanged(previous, after, 'Native camera preparation terminal continuity')
  const finalSettings = JSON.parse(after.uiSettings)
  assert.equal(finalSettings.camera3d.thetaDeg, 90); assert.equal(finalSettings.camera3d.phiDeg, 0)
  assertGeometricVisibilityRender(preparation.renderedBefore, before, 'Precondition visibility camera rendering')
  assertGeometricVisibilityRender(preparation.renderedAfter, after, 'Prepared visibility camera rendering')
}
export function assertGeometricVisibilityEvidence(evidence) {
  const visibility = evidence.visibility
  assert.ok(visibility?.locked && visibility.hidden && visibility.enable && Array.isArray(visibility.actions),
    'Geometric visibility retains raw locked, hidden, enabled and control observations')
  const { locked, hidden, cameraPreparation, enable, actions } = visibility
  const lockedBefore = geometricVisibilityState(locked.before, 'Locked geometric point')
  assert.equal(lockedBefore.model.ambientDimension, 2)
  assert.equal(lockedBefore.point.text, '$locked$'); assert.equal(lockedBefore.point.style.shape, 'dart')
  const lockedLayer = geometricVisibilityLayer(lockedBefore, 'locked', 'Locked geometric point')
  assert.equal(lockedLayer.locked, true,
    'Locked point belongs to the actual locked layer')
  // Production omits the visible default. Interpret only its effective state;
  // the raw saved/runtime/history metadata above remains exact and unchanged.
  assert.equal(!Object.hasOwn(lockedLayer, 'visible') || lockedLayer.visible === true, true,
    'Locked point layer remains visible')
  assertSelectionStateUnchanged(locked.before, locked.stateAfter, 'Locked native point input')
  assert.notEqual(locked.stateAfter.selection?.id, 'app-point', 'Actual locked point was not selected')
  assertGeometricVisibilityRender(locked.rendered, locked.before, 'Locked geometric rendering')
  assertGeometricVisibilityRender(locked.renderedAfter, locked.stateAfter, 'After locked native point input')
  const hiddenState = geometricVisibilityState(hidden.state, 'Hidden geometric point')
  assert.equal(hidden.state.labelDocumentRevision, locked.stateAfter.labelDocumentRevision + 1,
    'Native hidden JSON load advances the document epoch exactly once')
  assert.deepEqual(hiddenState.point, lockedBefore.point, 'Layer hiding preserves exact source, coordinates and style')
  const hiddenLayer = geometricVisibilityLayer(hiddenState, 'hidden', 'Hidden geometric point')
  assert.equal(hiddenLayer.visible, false,
    'Hidden point belongs to the actual hidden layer')
  assert.equal(hidden.rendered, null, 'Actual hidden-layer point has no rendered node')
  assertVisibilityCameraPreparation(cameraPreparation)
  const dimBefore = geometricVisibilityState(cameraPreparation.before, 'Approximate visibility prerequisite')
  assert.equal(cameraPreparation.before.labelDocumentRevision, hidden.state.labelDocumentRevision + 1,
    'Native occlusion JSON load advances the document epoch exactly once')
  assert.equal(dimBefore.model.ambientDimension, 3); assert.equal(dimBefore.point.codim, 3)
  assert.equal(dimBefore.point.text, '$dimmed$'); assert.equal(dimBefore.point.style.shape, 'semicircle')
  assert.deepEqual(dimBefore.point.position, { x: 0, y: -1, z: 0 }, 'Occluded point retains actual 3D model coordinates')
  const occluder = dimBefore.model.strata.find(({ id }) => id === 'occluder')
  assert.ok(occluder && occluder.geometricKind === 'sheet' && occluder.codim === 1 && occluder.kind === 'quadSheet',
    'Visibility setup contains the actual codimension-one sheet')
  assert.deepEqual(occluder.corners, [{ x: -2, y: 0, z: -2 }, { x: 2, y: 0, z: -2 }, { x: 2, y: 0, z: 2 }, { x: -2, y: 0, z: 2 }],
    'Visibility setup retains the actual occluding sheet coordinates')
  assertSelectionStateUnchanged(cameraPreparation.after, enable.before, 'Visibility checkbox uses the actually prepared native camera')
  assertVisibilitySettingsChange(enable.before, enable.after, 'enabled', true, 'Approximate visibility checkbox action')
  const checkbox = enable.checkbox
  assert.ok(checkbox, 'Actual approximate-visibility checkbox observation exists')
  assert.equal(checkbox.scope, '.source-panel'); assert.equal(checkbox.tag, 'input'); assert.equal(checkbox.type, 'checkbox')
  assert.equal(checkbox.count, 1); assert.equal(checkbox.connected, true); assert.equal(checkbox.enabled, true); assert.equal(checkbox.checked, true)
  assert.equal(checkbox.labels?.length, 1, 'Actual checkbox has exactly one associated source-panel label')
  assert.equal(checkbox.labels[0].text.trim(), 'Enable approximate 3D visibility', 'Actual checkbox is associated with the correct source-panel field')
  assert.ok(typeof checkbox.labels[0].outerHTML === 'string' && checkbox.labels[0].outerHTML.startsWith('<label'),
    'Actual checkbox associated wrapper markup is retained')
  assert.equal(actions.length, 3, 'Same-value dim observation and both real policy transitions are retained')
  let previous = enable.after, previousSequence
  for (const [index, value] of ['dimHidden', 'hideHidden', 'dimHidden'].entries()) {
    const action = actions[index]
    assertHiddenPointVisibilityAction(action)
    assert.equal(action.scenario, 'point-geometric-visibility'); assert.equal(action.id, 'app-point'); assert.equal(action.value, value)
    assert.ok(Number.isInteger(action.sequence) && action.sequence >= 1, 'Visibility action sequence is explicit')
    if (previousSequence !== undefined) assert.equal(action.sequence, previousSequence + 1, 'Visibility actions preserve actual sequential ownership')
    assertSelectionStateUnchanged(previous, action.before.state, 'Visibility policy action continuity')
    assertVisibilitySettingsChange(action.before.state, action.afterAction.state, 'pointVisibility', value, 'Hidden-points policy action')
    if (value === 'hideHidden') assert.equal(action.afterAction.rendered, null, 'Actual hideHidden policy removes the occluded point render')
    else assertGeometricVisibilityRender(action.afterAction.rendered, action.afterAction.state, 'Dimmed geometric rendering', true)
    previous = action.afterAction.state; previousSequence = action.sequence
  }
  const finalRender = actions.at(-1).afterAction.rendered
  assert.deepEqual(evidence.locked, locked.rendered, 'Published locked rendering is the retained actual raw rendering')
  assert.deepEqual(evidence.dimmed, finalRender, 'Published dimmed rendering is the retained actual terminal rendering')
  for (const key of ['hiddenAbsent', 'lockedUnchanged', 'lockedNotSelected', 'dimmedVisible', 'dimmedOpacity']) assert.equal(evidence[key], true)
}
export function assertGeometricShapeEvidence(evidence, name) {
  assert.equal(evidence.scenario, name); assert.equal(evidence.group, geometricShapeGroup); assert.equal(evidence.result, 'passed')
  assert.deepEqual(evidence.pageErrors, [])
  const spec = geometricShapeManifest.find(({ slug }) => name === `point-geometric-${slug}`)
  if (spec) {
    assert.equal(evidence.shape, spec.shape)
    assert.deepEqual(evidence.parameters, spec.parameters)
    assert.equal(evidence.cases.length, geometricBodyVariants.length * 2)
    for (const mode of ['default', 'configured']) for (const body of geometricBodyVariants) {
      const cases = evidence.cases.filter((entry) => entry.mode === mode && entry.body === body.key)
      assert.equal(cases.length, 1, `Required geometric variant ${spec.shape}/${mode}/${body.key}`)
      const entry = cases[0]
      assert.equal(entry.source, body.source); assert.equal(entry.rendered.source, body.source)
      assert.equal(entry.rendered.shape, spec.shape); assert.equal(entry.rendered.state, 'ready')
      assert.ok(entry.rendered.contourLength > 0)
      assert.ok(entry.rendered.bounds.width > 0 && entry.rendered.bounds.height > 0)
      for (const value of Object.values(entry.rendered.bounds)) assert.ok(Number.isFinite(value))
      for (const [key, value] of Object.entries(mode === 'configured' ? spec.parameters : {})) assert.equal(entry.rendered.parameters[key], value)
      assert.equal(entry.modelUnchanged, true)
      assert.equal(entry.rendered.bodyCorners.length, body.source ? 4 : 0)
      assert.ok(entry.rendered.bodyCorners.every(({ x, y, inside }) => Number.isFinite(x) && Number.isFinite(y) && inside === true))
      if (body.key === 'math' || body.key === 'mixed') assert.ok(entry.rendered.math > 0)
      assert.equal(entry.rendered.bodyUpright, true)
    }
    assert.equal(evidence.nativeShapeControl, true)
    assert.equal(evidence.nativeStyle.shape, spec.shape)
    for (const [key, value] of Object.entries(spec.parameters)) assert.equal(evidence.nativeStyle.shapeParameters[key], value)
    const colorParameters = spec.shape === 'cylinder' ? [
      ['cylinderEndFill', 'Cylinder end fill hex'], ['cylinderBodyFill', 'Cylinder body fill hex'],
    ] : []
    assert.ok(Array.isArray(evidence.nativeColorInputs), 'Native color input observations are explicit')
    assert.equal(evidence.nativeColorInputs.length, colorParameters.length)
    for (const [parameter, caption] of colorParameters) {
      const inputs = evidence.nativeColorInputs.filter((entry) => entry.parameter === parameter)
      assert.equal(inputs.length, 1, `Unique native input for ${parameter}`)
      const input = inputs[0], value = spec.parameters[parameter]
      assert.equal(input.caption, caption); assert.equal(input.expectedValue, value)
      assert.equal(input.inputType, 'text'); assert.equal(input.finalInputType, 'text')
      assert.equal(input.beforeValue.toLowerCase(), '#ffffff', `${parameter}: observed default color`)
      assert.notEqual(input.beforeValue.toLowerCase(), value.toLowerCase(), `${parameter}: native edit changes default`)
      assert.equal(input.actionError, undefined)
      assert.ok(Array.isArray(input.events) && input.events.length > 0, `${parameter}: observed input event`)
      assert.ok(input.events.every((event) => event.type === 'input' && event.trusted === true), `${parameter}: all inputs are trusted`)
      const finalInput = input.events.at(-1)
      assert.equal(finalInput.trusted, true, `${parameter}: final input is trusted`)
      assert.equal(finalInput.value, value)
      assert.equal(input.finalValue, value); assert.equal(input.finalModelValue, value)
    }
  } else if (name === 'point-geometric-native-contours-2d-3d') {
    assert.equal(evidence.cases.length, 8)
    for (const dimension of [2, 3]) for (const shape of ['diamond', 'star', 'semicircle', 'dart']) {
      const found = evidence.cases.filter((item) => item.ambientDimension === dimension && item.shape === shape)
      assert.equal(found.length, 1, `Unique native geometric interaction ${dimension}/${shape}`)
      const entry = found[0]
      assert.equal(entry.codim, dimension); assert.equal(entry.selected, true)
      assertGeometricSelectionEvidence(entry.observed.nativeSelection, 'app-point')
      assert.equal(entry.observed.nativeSelection.scenario, name, 'Raw contour selection belongs to the named cumulative scenario')
      assert.deepEqual(entry.observed.boundary, entry.observed.nativeSelection.requestedClick, 'Geometric interaction retains the prepared native boundary')
      assertPointNativeDragEvidence(entry.nativeDrag)
      assert.equal(entry.nativeDrag.id, 'app-point')
      assert.equal(entry.nativeDrag.scenario, name)
      assert.deepEqual(entry.nativeDrag.displacement, { x: 28, y: -16 }); assert.equal(entry.nativeDrag.steps, 4)
      const before = JSON.parse(entry.nativeDrag.stateBefore.runtimeDiagramJson)
      const after = JSON.parse(entry.nativeDrag.afterAction.state.runtimeDiagramJson)
      assert.equal(before.ambientDimension, dimension); assert.equal(after.ambientDimension, dimension)
      assert.deepEqual(entry.before, before.strata.find(({ id }) => id === entry.nativeDrag.id))
      assert.deepEqual(entry.after, after.strata.find(({ id }) => id === entry.nativeDrag.id))
      assert.equal(entry.before.style.shape, shape); assert.equal(entry.observed.shape, shape)
      assert.deepEqual(entry.events, entry.nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag'))
      assert.equal(entry.trustedDown, true); assert.equal(entry.trustedMove, true); assert.equal(entry.dragged, true)
      assert.equal(entry.undoRestored, true); assert.equal(entry.redoRestored, true)
    }
  } else if (name === 'point-geometric-visibility') {
    assertGeometricVisibilityEvidence(evidence)
  } else {
    assert.ok(name.startsWith('point-geometric-download-'))
    assert.equal(evidence.background, name.slice('point-geometric-download-'.length))
    assert.deepEqual(evidence.shapes, geometricShapeManifest.map(({ shape }) => shape))
    assert.equal(evidence.reopened, true); assert.equal(evidence.immutableSource, true); assert.equal(evidence.immutableParameters, true)
    assert.equal(evidence.separateCylinderPaints, true); assert.equal(evidence.noExternalAssets, true)
    assert.equal(evidence.actualDownload, true)
    assert.equal(evidence.capture?.status, 'saved', 'Terminal download requires a completed capture')
    assert.equal(evidence.click.error, undefined)
    assert.equal(evidence.click.snapshot.points.length, geometricShapeManifest.length)
    assert.equal(evidence.expected.length, geometricShapeManifest.length)
    for (const [index, spec] of geometricShapeManifest.entries()) {
      const captured = evidence.click.snapshot.points[index], expected = evidence.expected[index]
      assert.equal(captured.id, `geometric-${spec.slug}`); assert.equal(captured.style.shape, spec.shape)
      assert.deepEqual(captured.style.shapeParameters, spec.parameters)
      assert.equal(expected.id, captured.id); assert.equal(expected.source, captured.source); assert.equal(expected.shape, spec.shape)
      assert.equal(expected.rendered.shape, spec.shape); assert.equal(expected.rendered.state, 'ready')
      assert.ok(expected.rendered.math > 0); assert.ok(expected.rendered.contourLength > 0)
      for (const [key, value] of Object.entries(spec.parameters)) assert.equal(expected.rendered.parameters[key], value)
    }
  }
}
