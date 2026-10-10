import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runPointDashCapMechanismChecks } from '../../scripts/checkPointDashCapMechanism.mjs'
import { dashCapMechanismStem } from '../../scripts/pointDashCapMechanismContract.mjs'
import { phase32cProfile, resolveVerificationProfile, mechanismNotRun, assertScopedMechanismEvidence,
  assertNamedStrict32BFailure, retainedLiteralOmissions } from '../../scripts/automation/phase32c-profile.mjs'
import { phase32CDispositionMatchesCheckout, pointNodeScenarioArtifacts, allPointNodeScenarios,
  runPhaseVerification, runPhase32CReviewVerification } from '../../scripts/automation/phase-verification.mjs'
import { geometricShapeManifest, geometricBodyVariants, geometricShapeScenarios, geometricShapeGroup,
  assertGeometricShapeEvidence } from '../../scripts/pointGeometricShapesContract.mjs'
import { syntheticMechanismEvidence } from './pointDashCapMechanismFixture.mjs'
import { selectGeometricPoint, installGeometricSelectionObserver, observeGeometricSelection,
  removeGeometricSelectionObserver } from '../../scripts/pointGeometricSelection.mjs'
import { syntheticPointNativeDragEvidence, syntheticPointToolbarRevisionRecords } from './pointNativeDragFixture.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'
import { syntheticGeometricVisibilityEvidence, mutateSyntheticVisibilityStageModels,
  syntheticVisibilityLayerFaults } from './pointGeometricVisibilityFixture.mjs'

// These preparation and event-delivery controls are explicitly synthetic. They
// exercise ordering/error ownership; the reused native App shape loop is the
// browser acceptance gate.
function selectionDeliveryControl(options = {}) {
  const { observationFailure, evidenceFailure, cleanupFailure, mouseFailure } = options
  const calls = [], observations = [], secondaryErrors = []
  const screenOrigin = options.semicircle ? { x: 1296.4, y: 268.975 } : { x: 1250, y: 270 }
  const nativeLocalBoundary = { x: 5.418630123138428, y: -35.62142562866211 }
  const rendered = { shape: options.semicircle ? 'semicircle' : 'circle', source: options.semicircle ? 'drag $x_i$' : '  native shape\t\n',
    center: screenOrigin,
    boundary: options.nativeBoundaryFloat32 ? { x: Math.fround(3.1 * nativeLocalBoundary.x + screenOrigin.x),
      y: Math.fround(3.1 * nativeLocalBoundary.y + screenOrigin.y) }
      : options.semicircle ? { x: 1313.197754, y: 158.548584 } : { x: 1190, y: 280 } }
  const staleRendered = { ...rendered, center: { x: 1510, y: 140 }, boundary: { x: 1450, y: 150 } }
  const diagram = { ambientDimension: 2, camera: { mode: '2d', scale: 1, origin: { x: 0, y: 0 } }, strata: [{ id: 'app-point', geometricKind: 'point', codim: 2,
    position: { x: 3, y: 3, z: 0 }, text: rendered.source,
    style: { shape: options.semicircle ? 'semicircle' : 'circle', size: 8, opacity: 1,
      ...(options.semicircle ? { shapeParameters: { borderUsesIncircle: true, borderRotate: 33 } } : {}), layout: { anchor: 'center', innerXSep: 2,
      units: { innerXSep: { source: '2pt', unit: 'pt', texPoints: 2 } } } } }] }
  const authoritative = { json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), labelDocumentRevision: options.semicircle ? 102 : 10,
    uiSettings: JSON.stringify({ exportMode: 'standalone', includeCoordinateAxesInTikz: false }) }
  const current = { selection: options.initialSelection ?? null, drawerOpen: options.drawerOpen ?? false,
    scrolled: false, closeActions: 0, installed: false, events: [], preparationSnapshots: 0,
    toolbarExpanded: options.toolbarExpanded ?? true, collapseActions: 0, expandActions: 0, selectPressed: options.selectPressed ?? 'true',
    workPlaneControls: [], workPlaneStatus: [], measurementCount: 0, mouseActions: 0 }
  const pointTarget = { tag: 'circle', pointId: 'app-point', drawer: false, svg: true, canvas: true, canvasRoot: false, pointHandle: false }
  const handleTarget = { tag: 'circle', class: 'svg-geometry-handle', pointId: null, drawer: false,
    svg: true, canvas: true, canvasRoot: false, pointHandle: true }
  const overlayTarget = { tag: 'div', class: 'empty-inspector', pointId: null, drawer: true,
    svg: false, canvas: false, canvasRoot: false, pointHandle: false }
  const otherOverlayTarget = { ...overlayTarget, class: 'other-overlay', drawer: false }
  const toolbarTarget = { ...otherOverlayTarget, tag: 'span', class: 'preview-toolbar-status', creationToolbar: true,
    toolbarOverlay: true, toolbar: true, history: false, quickStyle: false }
  const historyTarget = { ...otherOverlayTarget, class: 'preview-history-toolbar', history: true, creationToolbar: false,
    toolbarOverlay: true, toolbar: false, quickStyle: false }
  const quickStyleTarget = { ...otherOverlayTarget, tag: 'button', class: 'context-quick-style-bar', history: false,
    creationToolbar: false, toolbarOverlay: true, toolbar: false, quickStyle: true }
  const canvasTarget = { tag: 'svg', class: 'svg-diagram', drawer: false, svg: true, canvas: true, canvasRoot: true, pointHandle: false }
  const target = () => {
    if (current.toolbarExpanded && options.quickStyleCovered) return quickStyleTarget
    if (current.toolbarExpanded && options.toolbarCovered) return toolbarTarget
    if (!current.toolbarExpanded && options.remainingObstruction) return { toolbar: toolbarTarget, history: historyTarget,
      other: otherOverlayTarget }[options.remainingObstruction]
    return ({ point: pointTarget, handle: handleTarget, drawer: overlayTarget, overlay: otherOverlayTarget,
      wrongPoint: { ...pointTarget, pointId: 'other-point' } }[options.targetKind ?? 'point'])
  }
  const pathFor = (eventTarget) => {
    if (eventTarget.creationToolbar) return [eventTarget, { ...toolbarTarget, tag: 'div', class: 'preview-fill-path-control' },
      { ...toolbarTarget, tag: 'section', class: 'preview-floating-toolbar', ariaLabel: 'Creation toolbar' },
      { ...toolbarTarget, tag: 'div', class: 'preview-toolbar-overlay-stack' }]
    if (!eventTarget.svg) return [eventTarget]
    return [eventTarget, ...(eventTarget.pointHandle ? [{ tag: 'g', pointId: null, drawer: false,
      svg: true, canvas: true, canvasRoot: false, pointHandle: false, ariaLabel: 'Selected point drag handles' }] : [
      { tag: 'g', pointId: eventTarget.pointId, drawer: false, svg: true, canvas: true, canvasRoot: false, pointHandle: false }]), canvasTarget]
  }
  const page = {
    getByRole: (role, { name, exact }) => {
      assert.equal(role, 'button'); assert.equal(exact, true)
      if (name === 'Select') return {
        count: async () => { calls.push('Select count'); return options.selectCount ?? Number(current.toolbarExpanded) },
        getAttribute: async (attribute) => { assert.equal(attribute, 'aria-pressed'); return current.selectPressed },
        click: async () => { calls.push('Select'); assert.equal(current.toolbarExpanded, true, 'Select is exposed by native toolbar expansion')
          if (options.selectFailure) throw options.selectFailure
          current.selectPressed = options.selectPressedAfter ?? 'true'; if (options.mutateOnSelect) options.mutateOnSelect(authoritative, current)
        },
      }
      if (name === 'Collapse preview toolbar' || name === 'Expand preview toolbar') {
        const collapsing = name === 'Collapse preview toolbar', action = collapsing ? 'collapse' : 'expand'
        return {
          count: async () => { calls.push(`${action} count`); return options[`${action}Count`] ?? Number(current.toolbarExpanded === collapsing) },
          getAttribute: async (attribute) => { assert.equal(attribute, 'aria-expanded'); return current.toolbarExpanded ? 'true' : 'false' },
          click: async (settings) => {
            assert.deepEqual(settings, { timeout: 5000 }); calls.push(action); current[`${action}Actions`]++
            if (options[`${action}Failure`]) throw options[`${action}Failure`]
            if (!options[`${action}DetachedFailure`] && !options[`${action}ReportedSuccess`]) current.toolbarExpanded = !collapsing
            if (collapsing && options.collapseFailureAfterToggle) throw options.collapseFailureAfterToggle
            if (options[`mutateOn${collapsing ? 'Collapse' : 'Expand'}`]) options[`mutateOn${collapsing ? 'Collapse' : 'Expand'}`](authoritative, current)
            if (current.installed) current.events.push(...['pointerdown', 'pointerup', 'click'].map((type) => ({ type, trusted: true,
              target: toolbarTarget, path: pathFor(toolbarTarget), client: { x: 1300, y: 150 }, pointerId: 7 })))
          },
          waitFor: async (settings) => { calls.push(`${action} control wait`); assert.equal(settings.timeout, 5000)
            if (options[`${action}ControlFailure`]) throw options[`${action}ControlFailure`]
            assert.equal(current.toolbarExpanded === collapsing, settings.state !== 'detached')
          },
        }
      }
      if (name === 'Close inspector drawer') return {
        count: async () => { calls.push('close count'); return options.closeCount ?? Number(current.drawerOpen) },
        click: async (settings) => {
          assert.deepEqual(settings, { timeout: 5000 }); calls.push('close'); current.closeActions++
          if (options.closeFailure) throw options.closeFailure
          if (!options.detachFailure && !options.detachReportedSuccess) current.drawerOpen = false
          if (options.mutateOnClose) options.mutateOnClose(authoritative)
        },
      }
      assert.equal(name, 'Open inspector drawer')
      return { count: async () => { calls.push('open count'); return options.openerCount ?? Number(!current.drawerOpen) },
        getAttribute: async (attribute) => {
          assert.equal(attribute, 'aria-expanded'); calls.push('open expanded')
          return options.openerExpanded ?? (current.drawerOpen ? 'true' : 'false')
        } }
    },
    locator: (selector) => {
      if (selector === 'svg.svg-diagram') return { scrollIntoViewIfNeeded: async () => { calls.push('scroll'); current.scrolled = true } }
      if (['.preview-floating-toolbar', 'section.preview-floating-toolbar', '.preview-toolbar-overlay-stack',
        '.preview-toolbar-overlay-stack.is-collapsed', '.preview-toolbar-overlay-stack:not(.is-collapsed)',
        '.preview-context-quick-style', '.preview-quick-style-bar'].includes(selector)) {
        const overlay = selector === '.preview-toolbar-overlay-stack', collapsed = selector === '.preview-toolbar-overlay-stack.is-collapsed'
        return {
          count: async () => { calls.push(`${selector} count`); return options.floatingCount ?? Number(overlay || (collapsed ? !current.toolbarExpanded : current.toolbarExpanded)) },
          getAttribute: async (attribute) => { assert.equal(attribute, 'class'); return `preview-toolbar-overlay-stack${current.toolbarExpanded ? '' : ' is-collapsed'}` },
          waitFor: async (settings) => { calls.push(`toolbar ${settings.state}`); assert.equal(settings.timeout, 5000)
            if (selector === 'section.preview-floating-toolbar') {
              if (options[`${settings.state === 'detached' ? 'collapse' : 'expand'}DetachedFailure`]) throw options[`${settings.state === 'detached' ? 'collapse' : 'expand'}DetachedFailure`]
              if (options[`${settings.state === 'detached' ? 'collapse' : 'expand'}ReportedSuccess`]) return
            }
            assert.equal(overlay || (collapsed ? !current.toolbarExpanded : current.toolbarExpanded), settings.state !== 'detached')
          },
        }
      }
      assert.equal(selector, '#preview-inspector-drawer')
      return { count: async () => { calls.push('drawer count'); return options.drawerCount ?? Number(current.drawerOpen) },
        waitFor: async (settings) => {
          assert.deepEqual(settings, { state: 'detached', timeout: 5000 }); calls.push('wait detached')
          if (options.detachFailure) throw options.detachFailure
          if (options.detachReportedSuccess) return
          assert.equal(current.drawerOpen, false)
        } }
    },
    mouse: { click: async (x, y) => {
      calls.push(['native click', x, y])
      current.mouseActions++
      if (mouseFailure) throw mouseFailure
      assert.equal(current.drawerOpen, false, 'synthetic canvas input follows verified drawer closure')
      assert.equal(current.scrolled, true, 'synthetic canvas input follows canvas scrolling')
      const expected = options.boundary ? rendered.boundary : rendered.center
      assert.deepEqual({ x, y }, expected, 'synthetic canvas input uses post-preparation coordinates')
      const eventTarget = options.eventTargetKind ? { ...target(), ...({ drawer: overlayTarget, overlay: otherOverlayTarget,
        toolbar: toolbarTarget, history: historyTarget }[options.eventTargetKind]) } : target()
      current.events = ['pointerdown', 'pointerup', 'click'].map((type) => {
        const capturedContinuation = options.handleCapture && type !== 'pointerdown'
        const deliveredTarget = capturedContinuation ? canvasTarget : eventTarget
        return { type, trusted: options.untrustedType !== type, target: deliveredTarget, button: 0,
          path: options.missingPath ? [] : capturedContinuation ? [canvasTarget] : pathFor(deliveredTarget),
          client: options.farClick && type === 'click' ? { x: x + 20, y: y + 20 } : { x, y },
          pointerId: options.mouseEventClick && type === 'click' ? null : options.wrongPointerId && type !== 'pointerdown' ? 8 : 7,
          canvasHasPointerCapture: capturedContinuation && type === 'pointerup' && !options.missingCapture,
          App: { labelDocumentRevision: authoritative.labelDocumentRevision } }
      })
      if (options.wrongEventOrder) current.events.reverse()
      if (!options.selectionFailure) current.selection = { id: 'app-point' }
    } },
    evaluate: async (operation, argument) => {
      if (operation === installGeometricSelectionObserver) { calls.push('install'); current.installed = true; current.events = []; return }
      if (operation === removeGeometricSelectionObserver) { calls.push('cleanup'); current.installed = false; if (cleanupFailure) throw cleanupFailure; return }
      assert.equal(operation, observeGeometricSelection)
      const preparationStage = current.preparationSnapshots === 0 ? 'inherited' : current.preparationSnapshots === 1 ? 'closed' : 'toolbar'
      calls.push(argument.click ? 'snapshot' : `${preparationStage} snapshot`)
      if (!argument.click) {
        current.preparationSnapshots++
        if (options.preparationObservationFailure === preparationStage) throw new Error(`controlled ${preparationStage} observation failure`)
      }
      if ((observationFailure && current.mouseActions > 0 || options.beforeObservationFailure && argument.click
        || options.beforeObservationFailureAfterCollapse && argument.click && current.collapseActions > 0
        || options.observationFailureAfterCollapse && current.collapseActions > 0 && !current.toolbarExpanded)) {
        throw observationFailure ?? options.beforeObservationFailure ?? options.beforeObservationFailureAfterCollapse ?? options.observationFailureAfterCollapse
      }
      return { errors: [], layout: { shape: rendered.shape, source: options.layoutSource ?? rendered.source,
        owner: Object.hasOwn(options, 'layoutOwner') ? options.layoutOwner : JSON.stringify(['point-node', authoritative.labelDocumentRevision, 'app-point']),
        request: options.layoutRequest ?? 'point-request', bodyRequest: options.layoutBodyRequest ?? 'point-request', state: 'ready' }, requestedClick: argument.click,
        selection: structuredClone(current.selection), inspector: { open: current.drawerOpen, noSelection: !current.selection,
          expansionControls: current.drawerOpen ? [{ text: 'Collapse', expanded: 'true' }] : [] },
        toolbar: { overlayCount: options.overlayCount ?? 1, count: 1, expanded: current.toolbarExpanded, collapsed: !current.toolbarExpanded,
          floatingCount: Number(current.toolbarExpanded), creationCount: Number(current.toolbarExpanded),
          expandCount: Number(!current.toolbarExpanded), collapseCount: Number(current.toolbarExpanded),
          expandControls: current.toolbarExpanded ? [] : [{ ariaLabel: 'Expand preview toolbar' }],
          collapseControls: current.toolbarExpanded ? [{ ariaLabel: 'Collapse preview toolbar' }] : [],
          quickStyleCount: Number(current.toolbarExpanded && options.quickStyleCovered), historyCount: 1 },
        model: structuredClone(JSON.parse(authoritative.runtimeDiagramJson).strata[0]),
        camera: structuredClone(JSON.parse(authoritative.runtimeDiagramJson).camera), labelDocumentRevision: authoritative.labelDocumentRevision,
        workPlaneControls: structuredClone(current.workPlaneControls), workPlaneStatus: structuredClone(current.workPlaneStatus),
        tool: { selectPressed: current.toolbarExpanded ? current.selectPressed : null },
        geometry: { contour: { connected: true, length: 400, fraction: .23,
          localBoundary: options.nativeBoundaryFloat32 ? nativeLocalBoundary
            : { x: (rendered.boundary.x - rendered.center.x) / 3.1, y: (rendered.boundary.y - rendered.center.y) / 3.1 },
          boundary: options.staleContourBoundary || options.staleContourBoundaryAfterCollapse && current.collapseActions > 0
            ? staleRendered.boundary : rendered.boundary,
          screenCTM: { a: 3.1, b: 0, c: 0, d: 3.1,
            e: options.staleContourCTM || options.staleContourCTMAfterCollapse && current.collapseActions > 0
              ? staleRendered.center.x : rendered.center.x,
            f: options.staleContourCTM || options.staleContourCTMAfterCollapse && current.collapseActions > 0
              ? staleRendered.center.y : rendered.center.y } },
          point: { center: rendered.center, screenCTM: { a: 3.1, b: 0, c: 0, d: 3.1,
          e: current.scrolled ? rendered.center.x : staleRendered.center.x,
          f: current.scrolled ? rendered.center.y : staleRendered.center.y } } },
        elementFromPoint: argument.click ? target() : null, elementsFromPoint: argument.click ? pathFor(target()) : [],
        events: argument.token && current.installed ? [...current.events] : [], droppedEvents: options.droppedEvents ?? 0 }
    },
  }
  return { calls, observations, secondaryErrors, rendered, staleRendered, page, current, authoritative,
    readState: async () => {
      calls.push('state')
      if (options.stateFailureAfterClick && current.mouseActions > 0) throw options.stateFailureAfterClick
      if (options.stateFailureAfterCollapse && current.collapseActions > 0 && !current.toolbarExpanded) throw options.stateFailureAfterCollapse
      return structuredClone({ ...authoritative, selection: current.selection })
    },
    observePoint: async () => {
      calls.push('rendered after scroll')
      current.measurementCount++
      assert.equal(current.drawerOpen, false); assert.equal(current.scrolled, true)
      if (options.inexactRequestedBoundary) return { ...rendered, boundary: { x: rendered.boundary.x + 5e-8, y: rendered.boundary.y } }
      return options.staleMeasurement || options.staleMeasurementAfterCollapse && current.collapseActions > 0 ? staleRendered : rendered
    },
    diagnose: async (details) => {
      calls.push(details.boundary)
      observations.push(structuredClone(details))
      if (details.boundary === 'selection-finished') current.preparationSnapshots = 0
      if (evidenceFailure) throw evidenceFailure
    } }
}
test('synthetic reused page closes inherited expanded/no-selection Inspector once before fresh diamond selection', async () => {
  const control = selectionDeliveryControl(), saved = structuredClone(control.authoritative)
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-ellipse', sequence: 1,
    requireUnselected: true }), control.rendered)
  // The wrapper opens/expands the Inspector; a later JSON load retains that
  // drawer while clearing selection and replacing the authoritative document.
  control.current.drawerOpen = true; control.current.selection = null; control.current.scrolled = false
  control.authoritative.labelDocumentRevision++; control.authoritative.history = JSON.stringify({ loaded: true, past: [], future: [] })
  const loaded = structuredClone(control.authoritative), callStart = control.calls.length
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2,
    requireUnselected: true }), control.rendered)
  assert.equal(control.current.closeActions, 1)
  const preparation = control.observations.find(({ boundary, observation }) => boundary === 'selection-prepared' && observation.sequence === 2)
  assert.equal(preparation.observation.preparation.inherited.inspector.open, true)
  assert.equal(preparation.observation.preparation.inherited.inspector.noSelection, true)
  assert.deepEqual(preparation.observation.preparation.inherited.inspector.expansionControls, [{ text: 'Collapse', expanded: 'true' }])
  assert.equal(preparation.observation.preparation.closed.inspector.open, false)
  assert.deepEqual(control.authoritative, loaded)
  assert.deepEqual(control.observations[0].observation.preparation.stateBefore.json, saved.json)
  const calls = control.calls.slice(callStart)
  for (const [earlier, later] of [['inherited snapshot', 'close'], ['close', 'wait detached'], ['wait detached', 'closed snapshot'],
    ['closed snapshot', 'Select'], ['Select', 'scroll'], ['scroll', 'rendered after scroll'], ['rendered after scroll', 'native click']]) {
    const at = (value) => calls.findIndex((call) => Array.isArray(call) ? call[0] === value : call === value)
    assert.ok(at(earlier) >= 0 && at(earlier) < at(later), `${earlier} precedes ${later}`)
  }
  assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'native click').length, 1)
  assert.deepEqual(calls.find(Array.isArray), ['native click', control.rendered.center.x, control.rendered.center.y])
  const before = control.observations.find(({ boundary, observation }) => boundary === 'before-native-click' && observation.sequence === 2).observation
  assert.notDeepEqual(before.requestedClick, control.staleRendered.center)
  assert.equal(before.before.geometry.point.screenCTM.e, control.rendered.center.x)
  assert.equal(before.before.elementFromPoint.pointId, 'app-point')
  assert.equal(control.current.installed, false)
})
test('synthetic already-closed Inspector is a no-op and fresh selection has intended event paths', async () => {
  const control = selectionDeliveryControl(), before = structuredClone(control.authoritative)
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-ellipse', sequence: 1, requireUnselected: true })
  assert.equal(control.current.closeActions, 0)
  assert.equal(control.calls.includes('close count'), false); assert.equal(control.calls.includes('wait detached'), false)
  assert.deepEqual(control.authoritative, before)
  const preparation = control.observations.find(({ boundary }) => boundary === 'selection-prepared').observation.preparation
  assert.equal(preparation.drawerCount, 0); assert.equal(preparation.closeActions, 0); assert.equal(preparation.closedDrawerCount, 0)
  assert.equal(preparation.openerCount, 1); assert.equal(preparation.openerExpanded, 'false')
  const after = control.observations.find(({ boundary }) => boundary === 'after-native-click-before-assertion').observation.after
  for (const event of after.events) {
    assert.equal(event.target.pointId, 'app-point'); assert.equal(event.target.svg, true)
    assert.ok(event.path.some(({ pointId }) => pointId === 'app-point'))
    assert.ok(event.path.some(({ tag, canvas }) => tag === 'svg' && canvas))
  }
})
for (const fault of ['closeFailure', 'detachFailure']) {
  test(`synthetic required drawer ${fault} stops native click and retains primary through diagnostic failures`, async () => {
    const primary = new Error(`controlled ${fault}`), control = selectionDeliveryControl({ drawerOpen: true, [fault]: primary,
      observationFailure: new Error('observation failed'), evidenceFailure: new Error('evidence failed'), cleanupFailure: new Error('cleanup failed') })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2,
      requireUnselected: true }), (error) => error === primary)
    assert.equal(control.current.closeActions, 1)
    assert.equal(control.calls.some(Array.isArray), false)
    assert.equal(control.calls.includes('cleanup'), false, 'A failed drawer action never owned a canvas observer')
    assert.equal(control.current.installed, false)
    assert.equal(control.observations.at(-1).primary.message, primary.message)
    assert.ok(control.secondaryErrors.some((message) => message.includes('evidence failed')))
  })
}
test('synthetic falsely successful detach cannot hide a remaining drawer', async () => {
  const control = selectionDeliveryControl({ drawerOpen: true, detachReportedSuccess: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2,
    requireUnselected: true }), /Inspector drawer is detached before selection/)
  assert.equal(control.current.closeActions, 1)
  assert.equal(control.calls.some(Array.isArray), false)
  const preparation = control.observations.find(({ boundary }) => boundary === 'selection-prepared').observation.preparation
  assert.equal(preparation.closedDrawerCount, 1); assert.equal(preparation.closed.inspector.open, true)
})
for (const stage of ['inherited', 'closed']) {
  for (const primaryKind of ['assertion', 'native']) {
    test(`synthetic ${stage} preparation observation failure preserves later ${primaryKind} primary`, async () => {
      const primary = new Error('controlled native mouse failure'), control = selectionDeliveryControl({ drawerOpen: true,
        preparationObservationFailure: stage, selectionFailure: true,
        ...(primaryKind === 'native' ? { mouseFailure: primary } : {}) })
      await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2,
        requireUnselected: true }), (error) => {
        if (primaryKind === 'native') return error === primary
        assert.equal(error.expected, 'app-point'); assert.match(error.message, /^Native contour click selects its point/); return true
      })
      assert.equal(control.current.closeActions, 1); assert.equal(control.calls.filter(Array.isArray).length, 1)
      assert.equal(control.current.drawerOpen, false); assert.equal(control.current.installed, false)
      assert.ok(control.secondaryErrors.some((message) => message.includes(`controlled ${stage} observation failure`)))
      assert.match(control.observations.at(-1).primary.message, primaryKind === 'native' ? /controlled native mouse failure/ : /^Native contour click selects its point/)
    })
  }
}
for (const fault of ['drawerCount', 'closeCount', 'openerCount', 'openerExpanded']) {
  test(`synthetic drawer preparation rejects invalid ${fault} without canvas input`, async () => {
    const control = selectionDeliveryControl({ drawerOpen: fault === 'closeCount', [fault]: fault === 'openerExpanded' ? 'true' : 2 })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2, requireUnselected: true }))
    assert.equal(control.calls.some(Array.isArray), false)
    assert.ok(control.observations.some(({ boundary }) => boundary === 'selection-prepared'))
  })
}
for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision']) {
  test(`synthetic native drawer close cannot mutate authoritative ${field}`, async () => {
    const control = selectionDeliveryControl({ drawerOpen: true, mutateOnClose: (state) => {
      state[field] = field === 'labelDocumentRevision' ? state[field] + 1 : `${state[field]} changed`
    } })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2, requireUnselected: true }))
    assert.equal(control.calls.some(Array.isArray), false)
    assert.ok(control.observations.some(({ boundary }) => boundary === 'selection-prepared'))
  })
}
for (const field of ['position', 'text', 'style']) {
  test(`synthetic native drawer close rejects ${field} mutation in model JSON`, async () => {
    const control = selectionDeliveryControl({ drawerOpen: true, mutateOnClose: (state) => {
      const model = JSON.parse(state.runtimeDiagramJson), point = model.strata[0]
      point[field] = field === 'position' ? { x: 4, y: 3, z: 0 } : field === 'text' ? 'normalized text' : { ...point.style, size: 9 }
      state.runtimeDiagramJson = JSON.stringify(model)
    } })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2, requireUnselected: true }))
    assert.equal(control.calls.some(Array.isArray), false)
  })
}
test('synthetic stale pre-close coordinates are rejected before the native mouse boundary', async () => {
  const control = selectionDeliveryControl({ drawerOpen: true, staleMeasurement: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2,
    requireUnselected: true }), /freshly measured connected geometry/)
  assert.equal(control.calls.filter(Array.isArray).length, 0)
})
for (const fault of ['drawer', 'overlay', 'wrongPoint']) {
  test(`synthetic current ${fault} target cannot establish success from trusted overlay events or selected state`, async () => {
    const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: fault })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.equal(control.current.selection.id, 'app-point')
    const prepared = control.observations.at(-1).observation.toolbarPreparation.prepared
    assert.equal(prepared.elementFromPoint.pointId, fault === 'wrongPoint' ? 'other-point' : null)
    assert.equal(prepared.events.length, 0)
  })
}
for (const fault of ['eventTargetKind', 'missingPath', 'untrustedType']) {
  test(`synthetic selected result cannot hide incorrect actual ${fault} delivery`, async () => {
    const control = selectionDeliveryControl({ [fault]: fault === 'eventTargetKind' ? 'overlay' : fault === 'untrustedType' ? 'pointerdown' : true })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-ellipse', sequence: 1, requireUnselected: true }))
    assert.equal(control.current.selection.id, 'app-point')
    assert.equal(control.calls.filter(Array.isArray).length, 1)
  })
}
test('synthetic initial circle setup rejects preexisting selection even with a point-target click', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' } })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2, requireUnselected: true }))
})
test('synthetic later selected-point handle uses its production target and composed path', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: 'handle', boundary: true })
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12,
    boundary: true }), control.rendered)
  assert.deepEqual(control.calls.find(Array.isArray), ['native click', 1190, 280])
  const after = control.observations.find(({ boundary }) => boundary === 'after-native-click-before-assertion').observation.after
  assert.equal(after.events[0].target.pointId, null); assert.equal(after.events[0].target.pointHandle, true)
  assert.ok(after.events[0].path.some(({ ariaLabel }) => ariaLabel === 'Selected point drag handles'))
})
test('synthetic selected-point handle accepts owned pointer capture to the canvas root', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: 'handle', handleCapture: true })
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }), control.rendered)
  const after = control.observations.find(({ boundary }) => boundary === 'after-native-click-before-assertion').observation.after
  assert.equal(after.events[0].target.pointHandle, true)
  assert.equal(after.events[1].target.canvasRoot, true); assert.equal(after.events[1].canvasHasPointerCapture, true)
  assert.equal(after.events[2].target.canvasRoot, true)
  assert.ok(after.events.every(({ pointerId }) => pointerId === 7))
})
test('synthetic captured handle root click accepts native MouseEvent identity at matching coordinates', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: 'handle',
    handleCapture: true, mouseEventClick: true })
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }), control.rendered)
  const after = control.observations.find(({ boundary }) => boundary === 'after-native-click-before-assertion').observation.after
  assert.equal(after.events[1].canvasHasPointerCapture, true); assert.equal(after.events[2].pointerId, null)
  assert.deepEqual(after.events[2].client, after.events[0].client)
})
test('synthetic captured handle MouseEvent cannot borrow capture from distant coordinates', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: 'handle',
    handleCapture: true, mouseEventClick: true, farClick: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }))
})
for (const fault of ['missingCapture', 'wrongPointerId', 'wrongEventOrder', 'droppedEvents']) {
  test(`synthetic handle root continuation rejects ${fault}`, async () => {
    const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: 'handle', handleCapture: true,
      [fault]: fault === 'droppedEvents' ? 1 : true })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }))
    assert.equal(control.calls.filter(Array.isArray).length, 1)
  })
}
test('synthetic unrelated canvas root input cannot use point capture continuation rules', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: 'point', handleCapture: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }))
})
test('synthetic selected handle for another point cannot borrow the intended point owner', async () => {
  const control = selectionDeliveryControl({ initialSelection: { id: 'other-point' }, targetKind: 'handle', handleCapture: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }))
})
test('synthetic handle cannot select an initially unselected circle', async () => {
  const control = selectionDeliveryControl({ targetKind: 'handle' })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2, requireUnselected: true }))
})
for (const failure of ['observationFailure', 'evidenceFailure', 'cleanupFailure']) {
  test(`failed native selection retains its assertion through ${failure}`, async () => {
    const control = selectionDeliveryControl({ selectionFailure: true, [failure]: new Error(`controlled ${failure}`) })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2 }), (error) => {
      assert.equal(error.expected, 'app-point'); assert.match(error.message, /^Native contour click selects its point/); return true
    })
    assert.equal(control.calls.filter((call) => Array.isArray(call) && call[0] === 'native click').length, 1)
    assert.ok(control.calls.includes('cleanup'))
    assert.ok(control.secondaryErrors.some((message) => message.includes(failure)))
  })
  test(`successful selection cannot hide ${failure}`, async () => {
    const control = selectionDeliveryControl({ [failure]: new Error(`controlled ${failure}`) })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-ellipse', sequence: 1 }))
    assert.ok(control.secondaryErrors.some((message) => message.includes(failure)))
  })
}
test('boundary selection keeps measured boundary input and native action failure ownership', async () => {
  const primary = new Error('native mouse action failed'), control = selectionDeliveryControl({ mouseFailure: primary,
    boundary: true, observationFailure: new Error('observation failed'), cleanupFailure: new Error('cleanup failed') })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12,
    boundary: true }), (error) => error === primary)
  assert.deepEqual(control.calls.find(Array.isArray), ['native click', 1190, 280])
  assert.equal(control.observations[0].observation.clickKind, 'boundary')
  assert.equal(control.observations.at(-1).primary.message, primary.message)
})

test('synthetic configured semicircle preserves the .23 boundary through owned native toolbar preparation and restoration', async () => {
  const control = selectionDeliveryControl({ semicircle: true, toolbarCovered: true, boundary: true })
  const before = structuredClone(control.authoritative)
  assert.equal(await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14,
    boundary: true }), control.rendered)
  assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
  assert.equal(control.current.toolbarExpanded, true); assert.equal(control.current.measurementCount, 2)
  assert.deepEqual(control.authoritative, before)
  assert.equal(control.calls.filter(Array.isArray).length, 1)
  assert.deepEqual(control.calls.find(Array.isArray), ['native click', 1313.197754, 158.548584])
  const at = (value) => control.calls.findIndex((call) => Array.isArray(call) ? call[0] === value : call === value)
  for (const [earlier, later] of [['Select', 'collapse'], ['collapse', 'toolbar detached'], ['toolbar detached', 'install'],
    ['install', 'native click'], ['native click', 'cleanup'], ['cleanup', 'expand']]) {
    assert.ok(at(earlier) >= 0 && at(earlier) < at(later), `${earlier} precedes ${later}`)
  }
  const raw = control.rendered.nativeSelection, preparation = raw.toolbarPreparation
  assert.equal(preparation.inherited.toolbar.collapsed, false)
  assert.deepEqual(preparation.actions.map(({ name, purpose }) => ({ name, purpose })), [
    { name: 'Select', purpose: 'select' }, { name: 'collapse', purpose: 'obstruction' }, { name: 'expand', purpose: 'restore' }])
  const obstructed = preparation.obstructed.observation
  assert.equal(obstructed.elementFromPoint.class, 'preview-toolbar-status')
  assert.ok(obstructed.elementsFromPoint.some(({ class: className }) => className === 'preview-floating-toolbar'))
  assert.equal(raw.before.geometry.contour.fraction, .23)
  assert.deepEqual(raw.before.geometry.contour.screenCTM, { a: 3.1, b: 0, c: 0, d: 3.1, e: 1296.4, f: 268.975 })
  assert.deepEqual(raw.before.requestedClick, control.rendered.boundary)
  assert.equal(raw.before.elementFromPoint.pointId, 'app-point')
  assert.ok(raw.after.events.every(({ target: delivered }) => delivered.pointId === 'app-point'))
  assert.equal(raw.toolbarRestoration.before.selection.id, 'app-point')
  assert.equal(raw.toolbarRestoration.after.selection.id, 'app-point')
  assert.equal(raw.toolbarRestoration.after.toolbar.collapsed, false)
  assert.equal(control.current.installed, false)
})

test('synthetic native SVGPoint binary32 boundary projection preserves the exact current requested contour input', async () => {
  const control = selectionDeliveryControl({ semicircle: true, nativeBoundaryFloat32: true, toolbarCovered: true, boundary: true })
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true })
  const raw = control.rendered.nativeSelection, contour = raw.before.geometry.contour
  const projected = { x: contour.screenCTM.a * contour.localBoundary.x + contour.screenCTM.e,
    y: contour.screenCTM.d * contour.localBoundary.y + contour.screenCTM.f }
  assert.ok(Math.abs(projected.x - contour.boundary.x) > 1e-7)
  assert.deepEqual(contour.boundary, { x: Math.fround(projected.x), y: Math.fround(projected.y) })
  assert.deepEqual(raw.requestedClick, contour.boundary)
  assert.deepEqual(contour.localBoundary, { x: 5.418630123138428, y: -35.62142562866211 })
  assert.equal(contour.fraction, .23)
  assert.equal(control.calls.filter(Array.isArray).length, 1)
  assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
})

for (const fault of ['staleContourCTMAfterCollapse', 'staleContourBoundaryAfterCollapse', 'inexactRequestedBoundary']) {
  test(`synthetic native binary32 ${fault} cannot borrow the fresh contour input`, async () => {
    const control = selectionDeliveryControl({ semicircle: true, nativeBoundaryFloat32: true, toolbarCovered: true, boundary: true,
      [fault]: true })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.equal(control.current.toolbarExpanded, true)
    if (fault !== 'inexactRequestedBoundary') {
      assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
    }
  })
}

test('synthetic quick style hit owned by the expanded toolbar uses the same bounded temporary collapse', async () => {
  const control = selectionDeliveryControl({ boundary: true, quickStyleCovered: true })
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true })
  assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
  assert.equal(control.calls.filter(Array.isArray).length, 1)
  assert.equal(control.current.toolbarExpanded, true)
  const obstructed = control.rendered.nativeSelection.toolbarPreparation.obstructed.observation
  assert.equal(obstructed.elementFromPoint.creationToolbar, false)
  assert.equal(obstructed.elementFromPoint.quickStyle, true)
  assert.equal(obstructed.elementFromPoint.toolbarOverlay, true)
  assert.equal(control.rendered.nativeSelection.before.elementFromPoint.pointId, 'app-point')
})

test('synthetic expanded unobstructed toolbar remains untouched and supplies the next native Select', async () => {
  const control = selectionDeliveryControl({ boundary: true })
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12, boundary: true })
  assert.equal(control.current.collapseActions, 0); assert.equal(control.current.expandActions, 0)
  assert.equal(control.current.toolbarExpanded, true)
  assert.deepEqual(control.rendered.nativeSelection.toolbarPreparation.actions.map(({ name }) => name), ['Select'])
  await control.page.getByRole('button', { name: 'Select', exact: true }).click()
  assert.equal(await control.page.getByRole('button', { name: 'Select', exact: true }).getAttribute('aria-pressed'), 'true')
})

test('synthetic inherited collapsed toolbar uses one native Select expansion and restores the caller state', async () => {
  const control = selectionDeliveryControl({ toolbarExpanded: false, boundary: true })
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 13, boundary: true })
  assert.equal(control.current.expandActions, 1); assert.equal(control.current.collapseActions, 1)
  assert.equal(control.current.toolbarExpanded, false)
  const actions = control.rendered.nativeSelection.toolbarPreparation.actions
  assert.deepEqual(actions.map(({ name, purpose }) => ({ name, purpose })), [
    { name: 'expand', purpose: 'select-access' }, { name: 'Select', purpose: 'select' }, { name: 'collapse', purpose: 'restore' }])
  assert.ok(control.calls.indexOf('expand') < control.calls.indexOf('Select'))
})

test('synthetic inherited collapsed covered contour collapses only once and stays restored before the next selection', async () => {
  const control = selectionDeliveryControl({ toolbarExpanded: false, toolbarCovered: true, boundary: true })
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 13, boundary: true })
  assert.equal(control.current.expandActions, 1); assert.equal(control.current.collapseActions, 1)
  assert.equal(control.current.toolbarExpanded, false)
  control.current.selection = null; control.current.scrolled = false
  await selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true })
  assert.equal(control.current.expandActions, 2); assert.equal(control.current.collapseActions, 2)
  assert.equal(control.current.toolbarExpanded, false)
})

for (const controlName of ['collapse', 'expand', 'select']) for (const count of [0, 2]) {
  test(`synthetic native toolbar ${controlName} rejects ${count} controls before a canvas click`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: controlName === 'collapse',
      toolbarExpanded: controlName !== 'expand', [`${controlName}Count`]: count })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14,
      boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.ok(control.observations.some(({ boundary: stage }) => stage === 'selection-finished'))
  })
}

for (const count of [0, 2]) {
  test(`synthetic native toolbar rejects ${count} overlay owners before canvas input`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, overlayCount: count })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
  })
}

test('synthetic native Select must report pressed before hiding its toolbar', async () => {
  const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, selectPressedAfter: 'false' })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
  assert.equal(control.current.collapseActions, 0); assert.equal(control.calls.filter(Array.isArray).length, 0)
})

test('synthetic trusted toolbar-only delivery cannot satisfy the scoped native canvas observer', async () => {
  const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, eventTargetKind: 'toolbar' })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
  assert.equal(control.calls.filter(Array.isArray).length, 1)
  assert.equal(control.current.toolbarExpanded, true)
  const after = control.observations.find(({ boundary: stage }) => stage === 'after-native-click-before-assertion').observation.after
  assert.equal(after.events.length, 3)
  assert.ok(after.events.every(({ trusted, target: delivered }) => trusted && delivered.creationToolbar))
})

for (const failure of ['collapseFailure', 'collapseDetachedFailure', 'selectFailure']) {
  test(`synthetic native toolbar ${failure} retains its first action error through diagnostics and cleanup`, async () => {
    const primary = new Error(`controlled ${failure}`), control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      [failure]: primary, observationFailure: new Error('late observation failure'), evidenceFailure: new Error('evidence failure'),
      cleanupFailure: new Error('cleanup failure'), expandFailure: new Error('restoration failure') })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14,
      boundary: true }), (error) => error === primary)
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.equal(control.observations.at(-1).primary.message, primary.message)
    assert.ok(control.secondaryErrors.some((message) => message.includes('evidence failure')))
  })
}

test('synthetic falsely successful toolbar detachment retains expanded-state evidence and stops input', async () => {
  const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, collapseReportedSuccess: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
  assert.equal(control.current.collapseActions, 1); assert.equal(control.calls.filter(Array.isArray).length, 0)
  const final = control.observations.at(-1).observation
  assert.equal(final.toolbarPreparation.actions.find(({ name }) => name === 'collapse').after.toolbar.collapsed, false)
})

for (const obstruction of ['toolbar', 'history', 'other']) {
  test(`synthetic remaining ${obstruction} obstruction retains its hit stack and performs no native click`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, remainingObstruction: obstruction })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
    assert.equal(control.calls.filter(Array.isArray).length, 0); assert.equal(control.current.toolbarExpanded, true)
    const raw = control.observations.at(-1).observation.toolbarPreparation.finalMeasurement.observation
    assert.equal(raw.elementFromPoint.pointId, null)
    assert.ok(raw.elementsFromPoint.length > 0)
  })
}

for (const failure of ['staleMeasurementAfterCollapse', 'staleContourBoundaryAfterCollapse',
  'staleContourCTMAfterCollapse', 'beforeObservationFailureAfterCollapse']) {
  test(`synthetic post-collapse ${failure} cannot reach a native boundary click`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      [failure]: failure === 'beforeObservationFailureAfterCollapse' ? new Error('before observation failure') : true })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
    assert.equal(control.current.toolbarExpanded, true)
  })
}

for (const action of ['Collapse', 'Expand', 'Select']) for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'selection', 'uiSettings']) {
  test(`synthetic native toolbar ${action} preserves exact ${field} around its own UI action`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      [`mutateOn${action}`]: (state, current) => {
        if (field === 'selection') current.selection = { id: 'other-point' }
        else state[field] = field === 'labelDocumentRevision' ? state[field] + 1 : `${state[field]} changed`
      } })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, action === 'Expand' ? 1 : 0)
    assert.equal(control.current.installed, false)
  })
}

for (const action of ['Collapse', 'Expand', 'Select']) for (const field of ['camera', 'workPlaneControls', 'workPlaneStatus']) {
  test(`synthetic native toolbar ${action} preserves observed ${field}`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      [`mutateOn${action}`]: (state, current) => {
        if (field === 'camera') {
          const runtime = JSON.parse(state.runtimeDiagramJson); runtime.camera.scale = 2; state.runtimeDiagramJson = JSON.stringify(runtime)
        } else current[field] = field === 'workPlaneControls' ? [{ value: 'xz' }] : ['xz at y=1']
      } })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, action === 'Expand' ? 1 : 0)
  })
}

for (const failure of ['expandFailure', 'expandDetachedFailure', 'expandReportedSuccess']) {
  test(`synthetic owned toolbar restoration ${failure} prevents successful return after one valid click`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      [failure]: failure === 'expandReportedSuccess' ? true : new Error(`controlled ${failure}`) })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 1)
    assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
    assert.equal(control.current.installed, false)
  })
}

for (const primaryKind of ['native', 'assertion']) {
  test(`synthetic ${primaryKind} selection failure survives owned toolbar restoration, artifacts and cleanup failure`, async () => {
    const primary = new Error('first native selection failure'), control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      selectionFailure: true, ...(primaryKind === 'native' ? { mouseFailure: primary } : {}),
      expandFailure: new Error('restoration failed'), evidenceFailure: new Error('artifact failed'), cleanupFailure: new Error('observer cleanup failed') })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }), (error) => {
      if (primaryKind === 'native') return error === primary
      assert.match(error.message, /^Native contour click selects its point/); return true
    })
    assert.equal(control.calls.filter(Array.isArray).length, 1)
    assert.equal(control.current.expandActions, 1)
    assert.ok(control.secondaryErrors.some((message) => message.includes('restoration failed')))
    assert.ok(control.secondaryErrors.some((message) => message.includes('artifact failed')))
    assert.ok(control.secondaryErrors.some((message) => message.includes('observer cleanup failed')))
  })
}

for (const primaryKind of ['native', 'action', 'assertion']) for (const restorationFails of [false, true]) {
  test(`synthetic first ${primaryKind} failure still attempts owned restoration after unavailable raw reads${restorationFails ? ' and failed expansion' : ''}`, async () => {
    const primary = new Error(`first ${primaryKind} failure`), readFailure = new Error('after action raw read failure')
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true,
      ...(primaryKind === 'action' ? { collapseFailureAfterToggle: primary, observationFailureAfterCollapse: readFailure,
        stateFailureAfterCollapse: readFailure } : { observationFailure: readFailure,
        ...(primaryKind === 'native' ? { mouseFailure: primary, stateFailureAfterClick: readFailure } : { selectionFailure: true }) }),
      ...(restorationFails ? { expandFailure: new Error('owned expand failed') } : {}),
      evidenceFailure: new Error('bounded evidence failure'), cleanupFailure: new Error('owned observer cleanup failure') })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14,
      boundary: true }), (error) => {
      if (primaryKind === 'assertion') { assert.match(error.message, /^Native contour click selects its point/); return true }
      return error === primary
    })
    assert.equal(control.current.collapseActions, 1); assert.equal(control.current.expandActions, 1)
    assert.equal(control.current.toolbarExpanded, !restorationFails)
    assert.equal(control.calls.filter(Array.isArray).length, primaryKind === 'action' ? 0 : 1)
    assert.equal(control.current.installed, false)
    if (primaryKind !== 'action') assert.ok(control.calls.indexOf('cleanup') < control.calls.indexOf('expand'))
    const retained = control.observations.at(-1)
    assert.match(retained.primary.message, primaryKind === 'assertion' ? /^Native contour click selects its point/ : new RegExp(`first ${primaryKind} failure`))
    assert.equal(retained.observation.toolbarRestoration.before, undefined)
    assert.equal(retained.observation.toolbarRestoration.expandCount, 1)
    assert.equal(retained.observation.toolbarRestoration.collapseCount, 0)
    assert.ok(control.secondaryErrors.some((message) => message.includes('after action raw read failure')))
    assert.ok(control.secondaryErrors.some((message) => message.includes('bounded evidence failure')))
    if (restorationFails) assert.ok(control.secondaryErrors.some((message) => message.includes('owned expand failed')))
    if (primaryKind !== 'action') assert.ok(control.secondaryErrors.some((message) => message.includes('owned observer cleanup failure')))
  })
}

for (const [fault, owner] of [['missing', undefined], ['null', null], ['malformed', '{broken'],
  ['wrong-epoch', JSON.stringify(['point-node', 9, 'app-point'])], ['wrong-point', JSON.stringify(['point-node', 10, 'other-point'])],
  ['wrong-kind', JSON.stringify(['free-label', 10, 'app-point'])]]) {
  test(`synthetic ${fault} rendered layout owner cannot reach native canvas selection`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, layoutOwner: owner })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.equal(control.current.collapseActions, 0)
    assert.equal(control.current.toolbarExpanded, true)
    assert.equal(control.observations.at(-1).observation.toolbarPreparation.inherited.layout.owner, owner)
  })
}

for (const [fault, options] of [['body-request-mismatch', { layoutBodyRequest: 'obsolete-body-request' }],
  ['point-request-missing', { layoutRequest: '' }], ['source-mismatch', { layoutSource: 'normalized source' }]]) {
  test(`synthetic ${fault} is rejected before native toolbar collapse or canvas input`, async () => {
    const control = selectionDeliveryControl({ boundary: true, toolbarCovered: true, ...options })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 14, boundary: true }))
    assert.equal(control.calls.filter(Array.isArray).length, 0)
    assert.equal(control.current.collapseActions, 0)
    assert.equal(control.current.toolbarExpanded, true)
  })
}

const mechanisms = syntheticMechanismEvidence()
test('supplemental primary and independent cleanup failures remain structured and unclassifiable', async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'stz-32c-secondary-control-'))
  const page = { viewportSize: () => ({ width: 800, height: 600 }),
    setViewportSize: async () => {}, context: () => ({ browser: () => ({ version: () => 'controlled-failure' }) }),
    evaluate: async () => { throw new Error('controlled native and cleanup failure') } }
  try {
    await assert.rejects(runPointDashCapMechanismChecks({ page, artifactDir, profile: phase32cProfile }), (error) => {
      assert.ok(error instanceof AggregateError)
      assert.match(error.message, /^Additional dash mechanism failures/)
      assert.match(error.cause.message, /controlled native/)
      return true
    })
    const evidence = JSON.parse(await readFile(join(artifactDir, `${dashCapMechanismStem}.json`), 'utf8'))
    assert.equal(evidence.result, 'failed')
    assert.ok(evidence.secondaryErrors.some(({ stage }) => stage === 'cleanup'))
    assert.throws(() => assertScopedMechanismEvidence(evidence))
  } finally { await rm(artifactDir, { recursive: true, force: true }) }
})
function scoped() {
  return { ...structuredClone(mechanisms), profile: phase32cProfile,
    cases: mechanisms.cases.map((entry) => entry.key === 'positive-full-closed-control' ? mechanismNotRun() : entry) }
}
function literalFailure() {
  const observed = structuredClone(mechanisms)
  observed.result = 'failed'
  const literal = observed.cases.find(({ key }) => key === 'positive-full-closed-control')
  const error = { message: 'positive-full-closed-control: connected-live candidate 0,-14\n\nfalse !== true\n' }
  literal.result = 'failed'; literal.error = error
  const mismatches = retainedLiteralOmissions.map(([x, y, geometryDistance]) => ({ local: { x, y }, expected: 'hit', hit: false,
    geometryDistance, paintDistance: 5.7732207757, insideContour: false }))
  literal.interactionOracle.mismatches = mismatches
  literal.interactionOracle.samples = [...mismatches, ...Array.from({ length: 1089 - mismatches.length }, () => ({ expected: 'hit', hit: true }))]
  return { evidence: { result: 'failed', stage: 'point-node-paint-import-persistence', pageErrors: [], error }, mechanisms: observed,
    app: { result: 'failed', error, cases: [{ result: 'passed' }] } }
}
function shapeEvidence(spec) {
  return { scenario: `point-geometric-${spec.slug}`, group: geometricShapeGroup, result: 'passed', pageErrors: [], shape: spec.shape,
    parameters: spec.parameters, nativeShapeControl: true, nativeStyle: { shape: spec.shape, shapeParameters: spec.parameters },
    nativeColorInputs: spec.shape === 'cylinder' ? [
      ['cylinderEndFill', 'Cylinder end fill hex'], ['cylinderBodyFill', 'Cylinder body fill hex'],
    ].map(([parameter, caption]) => ({ parameter, caption, expectedValue: spec.parameters[parameter],
      inputType: 'text', beforeValue: '#FFFFFF', finalInputType: 'text', finalValue: spec.parameters[parameter],
      finalModelValue: spec.parameters[parameter], events: [{ type: 'input', trusted: true, value: spec.parameters[parameter] }] })) : [],
    cases: ['default', 'configured'].flatMap((mode) => geometricBodyVariants.map(({ key, source }) => ({ mode, body: key, source, modelUnchanged: true,
      rendered: { shape: spec.shape, parameters: mode === 'configured' ? spec.parameters : {}, source, state: 'ready', contourLength: 20,
        bounds: { x: -10, y: -10, width: 20, height: 20 }, math: ['math', 'mixed'].includes(key) ? 1 : 0, bodyUpright: true,
        bodyCorners: source ? Array.from({ length: 4 }, () => ({ x: 0, y: 0, inside: true })) : [] } }))) }
}

// Policy controls are fabricated records, separate from cumulative native App
// acceptance. A success flag cannot supply missing handle delivery/history.
function geometricInteractionEvidence() {
  const scenario = 'point-geometric-native-contours-2d-3d'
  return { scenario, group: geometricShapeGroup, result: 'passed', pageErrors: [],
    cases: [2, 3].flatMap((ambientDimension) => ['diamond', 'star', 'semicircle', 'dart'].map((shape) => {
      const nativeDrag = syntheticPointNativeDragEvidence({ scenario, ambientDimension, shape,
        id: 'app-point', displacement: { x: 28, y: -16 }, steps: 4 })
      const nativeSelection = syntheticGeometricSelectionEvidence({ scenario, ambientDimension, shape, id: 'app-point',
        state: nativeDrag.stateBefore })
      return { ambientDimension, shape, codim: ambientDimension, nativeDrag,
        observed: { shape, boundary: nativeSelection.requestedClick, nativeSelection }, before: JSON.parse(nativeDrag.stateBefore.runtimeDiagramJson).strata[0],
        after: JSON.parse(nativeDrag.afterAction.state.runtimeDiagramJson).strata[0],
        events: nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag'),
        selected: true, trustedDown: true, trustedMove: true, dragged: true, undoRestored: true, redoRestored: true }
    })) }
}
test('synthetic 32C policy requires eight raw handle drags and exact history restorations', () => {
  const evidence = geometricInteractionEvidence()
  assertGeometricShapeEvidence(evidence, evidence.scenario)
})
for (const cameraExpanded of [false, true]) {
  test(`synthetic 32C visibility policy requires exact wrapped native select and raw transitions with camera expanded=${cameraExpanded}`, () => {
    const evidence = syntheticGeometricVisibilityEvidence({ cameraExpanded }), actions = evidence.visibility.actions
    assertGeometricShapeEvidence(evidence, evidence.scenario)
    const first = actions[0]
    assert.equal(first.before.control.exactLabelCount, 0, 'Complete associated label contains option descendants')
    assert.equal(first.before.control.captions[0].text, 'Hidden points:')
    assert.notEqual(first.before.control.wrappers[0].text, 'Hidden points:')
    assert.equal(first.before.control.correctedControlCount, 1)
    assert.deepEqual(first.afterAction.selection, ['dimHidden'])
    assert.equal(first.afterAction.state.uiSettings, first.before.state.uiSettings, 'Same-value selection creates no policy transition')
    assert.equal(JSON.parse(actions[1].afterAction.state.uiSettings).visibility.pointVisibility, 'hideHidden')
    assert.equal(actions[1].afterAction.rendered, null)
    assert.equal(JSON.parse(actions[2].afterAction.state.uiSettings).visibility.pointVisibility, 'dimHidden')
    assert.ok(actions[2].afterAction.rendered.effectiveFillOpacity > 0 && actions[2].afterAction.rendered.effectiveFillOpacity < 1)
    assert.ok(actions[2].afterAction.rendered.effectiveOpacity > 0 && actions[2].afterAction.rendered.effectiveOpacity < 1)
    assert.ok(first.afterAction.events.events.every(({ trusted }) => trusted === false), 'Actual event provenance does not invent trusted pointer delivery')
  })
}
const visibilityPolicyFaults = [
  ['observed-candidate', (evidence) => { evidence.result = 'observed' }],
  ['flags-only', (evidence) => { delete evidence.visibility }],
  ['missing-locked-state', (evidence) => { delete evidence.visibility.locked.before }],
  ['locked-model-mutation', (evidence) => { evidence.visibility.locked.stateAfter.json += 'changed' }],
  ['locked-selected', (evidence) => { evidence.visibility.locked.stateAfter.selection = { kind: 'stratum', id: 'app-point' } }],
  ['missing-hidden-state', (evidence) => { delete evidence.visibility.hidden.state }],
  ['hidden-rendered', (evidence) => { evidence.visibility.hidden.rendered = evidence.locked }],
  ['hidden-load-no-epoch', (evidence) => { evidence.visibility.hidden.state.labelDocumentRevision -= 1 }],
  ['missing-camera', (evidence) => { delete evidence.visibility.cameraPreparation }],
  ['wrong-camera-control', (evidence) => { evidence.visibility.cameraPreparation.actions[0].before.control.controls[0].ariaLabel = 'zoom value' }],
  ['wrong-camera-scope', (evidence) => { evidence.visibility.cameraPreparation.actions[0].after.control.controls[0].scope = '.preview-panel' }],
  ['unobserved-camera-control', (evidence) => { evidence.visibility.cameraPreparation.controlsAfter[0].controls = [] }],
  ['camera-disabled', (evidence) => { evidence.visibility.cameraPreparation.actions[0].before.control.enabled = false }],
  ['camera-closed', (evidence) => { evidence.visibility.cameraPreparation.expansion.expandedAfter = 'false' }],
  ['camera-history-edit', (evidence) => { evidence.visibility.cameraPreparation.actions[0].after.state.history += 'changed' }],
  ['camera-moved-selection', (evidence) => { evidence.visibility.cameraPreparation.after.selection = { kind: 'stratum', id: 'occluder' } }],
  ['missing-enable', (evidence) => { delete evidence.visibility.enable }],
  ['wrong-checkbox', (evidence) => { evidence.visibility.enable.checkbox.labels[0].text = 'Enable some other visibility' }],
  ['checkbox-unchecked', (evidence) => { evidence.visibility.enable.checkbox.checked = false }],
  ['checkbox-disabled', (evidence) => { evidence.visibility.enable.checkbox.enabled = false }],
  ['checkbox-unrelated-control', (evidence) => { evidence.visibility.enable.checkbox.scope = '#preview-inspector-drawer' }],
  ['policy-no-authoritative-enable', (evidence) => { evidence.visibility.enable.after.uiSettings = evidence.visibility.enable.before.uiSettings }],
  ['missing-policy-action', (evidence) => { evidence.visibility.actions.pop() }],
  ['duplicate-policy-action', (evidence) => { evidence.visibility.actions[1] = structuredClone(evidence.visibility.actions[0]) }],
  ['policy-reordered', (evidence) => { evidence.visibility.actions.reverse() }],
  ['policy-sequence', (evidence) => { evidence.visibility.actions[1].sequence = 9 }],
  ['policy-unrelated-caption', (evidence) => { evidence.visibility.actions[0].before.control.captions[0].text = 'Hidden curves:' }],
  ['policy-unrelated-wrapper', (evidence) => { evidence.visibility.actions[0].before.control.wrappers[0].matchesProductionLabel = false }],
  ['policy-unassociated-select', (evidence) => { evidence.visibility.actions[0].before.control.controls[0].associatedOwningLabel = false }],
  ['policy-unavailable-option', (evidence) => { evidence.visibility.actions[1].before.control.controls[0].options.pop() }],
  ['policy-disabled-option', (evidence) => { evidence.visibility.actions[1].before.control.controls[0].options[1].disabled = true }],
  ['policy-unrelated-event', (evidence) => { evidence.visibility.actions[1].afterAction.events.events[0].target.sameOwnedControl = false }],
  ['policy-stale-epoch', (evidence) => { evidence.visibility.actions[1].afterAction.state.labelDocumentRevision += 1 }],
  ['policy-stale-settings', (evidence) => { evidence.visibility.actions[1].afterAction.state.uiSettings = evidence.visibility.actions[1].before.state.uiSettings }],
  ['policy-wrong-returned-selection', (evidence) => { evidence.visibility.actions[1].afterAction.selection = ['dimHidden'] }],
  ['hide-policy-render-present', (evidence) => { evidence.visibility.actions[1].afterAction.rendered = structuredClone(evidence.dimmed) }],
  ['dim-policy-render-absent', (evidence) => { evidence.visibility.actions[2].afterAction.rendered = null }],
  ['dimmed-wrong-owner', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.id = 'another-point' }],
  ['dimmed-wrong-occluder', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.occludingSurfaceId = 'unrelated-sheet' }],
  ['dimmed-classified-visible', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.pointVisibility = 'visible' }],
  ['dimmed-no-fill-opacity', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.effectiveFillOpacity = 1 }],
  ['dimmed-zero-opacity', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.effectiveOpacity = 0 }],
  ['dimmed-invented-opacity', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.effectiveOpacity = .1 }],
  ['dimmed-no-ancestor-observation', (evidence) => { delete evidence.visibility.actions[2].afterAction.rendered.opacityAncestors }],
  ['dimmed-disconnected-ancestor', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.opacityAncestors[0].connected = false }],
  ['dimmed-unrelated-opacity-owner', (evidence) => { evidence.visibility.actions[2].afterAction.rendered.opacityAncestors.at(-1).pointId = 'another-point' }],
  ['dimmed-fabricated-summary', (evidence) => { evidence.dimmed.source = '$stale$' }],
]
test('synthetic 32C visibility policy accepts omitted canonical visibility and retains explicit hidden metadata', () => {
  const evidence = syntheticGeometricVisibilityEvidence()
  for (const state of [evidence.visibility.locked.before, evidence.visibility.locked.stateAfter,
    evidence.visibility.cameraPreparation.before, evidence.visibility.actions.at(-1).afterAction.state]) {
    const models = [JSON.parse(state.json).diagram, JSON.parse(state.runtimeDiagramJson), JSON.parse(state.history).present]
    assert.ok(models.every((model) => !Object.hasOwn(model.layers[0], 'visible')), 'Visible defaults are omitted in all canonical model observations')
  }
  assert.equal(JSON.parse(evidence.visibility.locked.before.runtimeDiagramJson).layers[0].locked, true)
  assert.equal(JSON.parse(evidence.visibility.hidden.state.runtimeDiagramJson).layers[0].visible, false)
  const before = structuredClone(evidence)
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  assert.deepEqual(evidence, before, 'The contract preserves the observed raw canonical representation')
})
test('synthetic 32C visibility policy permits valid explicit true without treating it as canonical production output', () => {
  const evidence = syntheticGeometricVisibilityEvidence()
  mutateSyntheticVisibilityStageModels(evidence, 'locked', (model) => { model.layers[0].visible = true })
  const before = structuredClone(evidence)
  assertGeometricShapeEvidence(evidence, evidence.scenario)
  assert.deepEqual(evidence, before, 'The contract does not rewrite explicit raw visibility')
})
for (const [fault, mutate] of syntheticVisibilityLayerFaults) {
  test(`synthetic 32C raw layer visibility policy rejects ${fault}`, () => {
    const evidence = syntheticGeometricVisibilityEvidence()
    mutate(evidence)
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const [fault, mutate] of visibilityPolicyFaults) {
  test(`synthetic 32C raw visibility evidence rejects ${fault} despite success flags`, () => {
    const evidence = syntheticGeometricVisibilityEvidence()
    mutate(evidence)
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
function setSyntheticRevision(records, revision) {
  for (const record of records) {
    if (revision === undefined) delete record.labelDocumentRevision
    else record.labelDocumentRevision = revision
    if (record.layout && record.model) record.layout.owner = JSON.stringify(['point-node', revision, record.model.id])
  }
}
function syntheticRevisionRecords(raw) {
  return [raw.preparation.stateBefore, raw.preparation.stateAfter, raw.preparation.statePrepared,
    raw.preparation.inherited, raw.preparation.closed, raw.preparation.prepared, raw.stateBefore, raw.before,
    raw.afterAction.state, raw.afterAction.observation, raw.undo.stateBefore, raw.undo.stateAfter, raw.undo.observation,
    raw.redo.stateBefore, raw.redo.stateAfter, raw.redo.observation,
    ...raw.afterAction.observation.events, ...raw.undo.observation.events, ...raw.redo.observation.events,
    ...syntheticPointToolbarRevisionRecords(raw)]
}
function setSyntheticActionRevision(raw, action, revision) {
  const records = action === 'drag' ? [raw.afterAction.state, raw.afterAction.observation, raw.undo.stateBefore]
    : action === 'undo' ? [raw.undo.stateAfter, raw.undo.observation, raw.redo.stateBefore]
      : [raw.redo.stateAfter, raw.redo.observation]
  // Keep each observed state and its successor's before-state consistent, so
  // these controls reach document ownership rather than record continuity.
  setSyntheticRevision(records, revision)
}
for (const revision of [0, 100]) {
  test(`synthetic 32C raw drag policy accepts unchanged document epoch ${revision} with movement and history`, () => {
    const evidence = geometricInteractionEvidence()
    for (const { nativeDrag } of evidence.cases) {
      setSyntheticRevision(syntheticRevisionRecords(nativeDrag), revision)
      assert.ok(syntheticRevisionRecords(nativeDrag).every((record) => record.labelDocumentRevision === revision))
    }
    assertGeometricShapeEvidence(evidence, evidence.scenario)
  })
}
for (const action of ['drag', 'undo', 'redo']) {
  for (const [fault, revision] of [['increased', 101], ['decreased', 99], ['missing', undefined], ['null', null],
    ['negative', -1], ['fractional', 100.5], ['string', '100'], ['nonfinite', Infinity]]) {
    test(`synthetic 32C raw ${action} policy rejects ${fault} document revision`, () => {
      const evidence = geometricInteractionEvidence()
      setSyntheticActionRevision(evidence.cases[0].nativeDrag, action, revision)
      const expected = ['increased', 'decreased'].includes(fault)
        ? new RegExp(`Native point ${action}: same document revision`)
        : /labelDocumentRevision must be a nonnegative integer/u
      assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario), expected)
    })
  }
}
for (const [fault, revision] of [['missing', undefined], ['negative', -1], ['fractional', 100.5], ['string', '100']]) {
  test(`synthetic 32C raw drag policy rejects a consistently ${fault} preparation epoch`, () => {
    const evidence = geometricInteractionEvidence()
    setSyntheticRevision(syntheticRevisionRecords(evidence.cases[0].nativeDrag), revision)
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario), /labelDocumentRevision must be a nonnegative integer/u)
  })
}
for (const boundary of ['before', 'after', 'undo', 'redo']) {
  test(`synthetic 32C raw ${boundary} policy rejects observed and authoritative revision disagreement`, () => {
    const evidence = geometricInteractionEvidence(), raw = evidence.cases[0].nativeDrag
    const observed = boundary === 'before' ? raw.before : boundary === 'after' ? raw.afterAction.observation : raw[boundary].observation
    observed.labelDocumentRevision += 1
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario), /observed revision matches authoritative state/u)
  })
}
for (const fault of ['flags-only', 'selection-events', 'overlay-down', 'wrong-owner', 'wrong-pointer',
  'untrusted-down', 'cancelled', 'no-model-movement', 'camera-only', 'extra-history-commit',
  'bad-undo', 'bad-redo', 'wrong-displacement', 'wrong-steps', 'different-summary', 'duplicate-case']) {
  test(`synthetic 32C raw drag policy rejects ${fault} despite fabricated success booleans`, () => {
    const evidence = geometricInteractionEvidence(), entry = evidence.cases[0], raw = entry.nativeDrag
    const events = raw.afterAction.observation.events
    const down = events.find(({ type, phase }) => type === 'pointerdown' && phase === 'drag')
    const up = events.find(({ type, phase }) => type === 'pointerup' && phase === 'drag')
    if (fault === 'flags-only') delete entry.nativeDrag
    if (fault === 'selection-events') events.forEach((event) => { event.phase = 'selection' })
    if (fault === 'overlay-down') down.target = { drawer: true, svg: false, canvas: false }
    if (fault === 'wrong-owner') raw.id = 'another-point'
    if (fault === 'wrong-pointer') up.pointerId += 1
    if (fault === 'untrusted-down') down.trusted = false
    if (fault === 'cancelled') events.push({ ...up, type: 'pointercancel' })
    if (fault === 'no-model-movement' || fault === 'camera-only') {
      raw.afterAction.state.runtimeDiagramJson = raw.stateBefore.runtimeDiagramJson
      raw.afterAction.state.json = raw.stateBefore.json
      if (fault === 'camera-only') {
        const model = JSON.parse(raw.afterAction.state.runtimeDiagramJson); model.camera = { mode: '2d', zoom: 99 }
        raw.afterAction.state.runtimeDiagramJson = JSON.stringify(model)
      }
    }
    if (fault === 'extra-history-commit') {
      const history = JSON.parse(raw.afterAction.state.history); history.past.push(history.present)
      raw.afterAction.state.history = JSON.stringify(history)
    }
    if (fault === 'bad-undo') raw.undo.stateAfter.json = raw.afterAction.state.json
    if (fault === 'bad-redo') raw.redo.stateAfter.json = raw.stateBefore.json
    if (fault === 'wrong-displacement') raw.displacement.x += 1
    if (fault === 'wrong-steps') raw.steps = 1
    if (fault === 'different-summary') entry.before.position.x += 1
    if (fault === 'duplicate-case') evidence.cases[1] = structuredClone(entry)
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}

test('32C profile is explicit, phase-specific, and never an alias for strict', () => {
  assert.equal(resolveVerificationProfile(undefined), 'strict')
  assert.equal(resolveVerificationProfile('strict', '32B'), 'strict')
  assert.equal(resolveVerificationProfile(phase32cProfile, '32C'), phase32cProfile)
  for (const phase of ['32A', '32B', '32D', undefined]) assert.throws(() => resolveVerificationProfile(phase32cProfile, phase))
  for (const profile of ['stz-32b-core-v1', 'allow-nonzero', '32c']) assert.throws(() => resolveVerificationProfile(profile, '32C'))
  assert.throws(() => runPhaseVerification({ phase: '32C', env: { STZ_VERIFICATION_PROFILE: phase32cProfile } }), /Strict verifier/)
  assert.throws(() => runPhase32CReviewVerification({ phase: '32B' }), /only to phase 32C/)
})
test('scoped mechanism report explicitly leaves only named literal not_run', () => {
  const evidence = scoped()
  assertScopedMechanismEvidence(evidence)
  assert.equal(evidence.cases.filter(({ result }) => result === 'not_run').length, 1)
  const strictArtifacts = pointNodeScenarioArtifacts('point-paint-dash-caps')
  const scopedArtifacts = pointNodeScenarioArtifacts('point-paint-dash-caps', phase32cProfile)
  assert.equal(strictArtifacts.length - scopedArtifacts.length, 8)
  assert.ok(strictArtifacts.filter((file) => !scopedArtifacts.includes(file)).every((file) => file.includes('positive-full-closed-control.')))
})
for (const fault of ['another-skip', 'wrong-specification', 'result-passed', 'missing-case', 'failed-nondeferred', 'wrong-profile']) {
  test(`32C mechanism evidence rejects ${fault}`, () => {
    const evidence = scoped()
    if (fault === 'another-skip') evidence.cases[0] = { ...mechanismNotRun(), key: evidence.cases[0].key }
    if (fault === 'wrong-specification') evidence.cases.at(-1).specification = { ...evidence.cases.at(-1).specification, width: 13 }
    if (fault === 'result-passed') evidence.cases.at(-1).result = 'passed'
    if (fault === 'missing-case') evidence.cases.pop()
    if (fault === 'failed-nondeferred') evidence.cases[0] = { ...evidence.cases[0], result: 'failed' }
    if (fault === 'wrong-profile') evidence.profile = 'strict'
    assert.throws(() => assertScopedMechanismEvidence(evidence))
  })
}
test('raw diagnostic classifier binds the exact retained literal case without changing failed records', () => {
  const input = literalFailure(), before = JSON.stringify(input)
  assertNamedStrict32BFailure(input.evidence, input.mechanisms, input.app)
  assert.equal(JSON.stringify(input), before)
})
for (const fault of ['same-stack-new-shape', 'changed-angle', 'shifted-omission', 'extra-omission', 'other-case', 'page-error', 'cleanup-error', 'not-run-app', 'wrong-stage']) {
  test(`named 32B classifier rejects unrelated failure disguised as ${fault}`, () => {
    const { evidence, mechanisms, app } = literalFailure(), literal = mechanisms.cases.at(-1)
    if (fault === 'same-stack-new-shape') literal.specification.points = '0,0 28,0 12,16'
    if (fault === 'changed-angle') literal.specification.join = 'miter'
    if (fault === 'shifted-omission') literal.interactionOracle.mismatches[1].local.x = 4
    if (fault === 'extra-omission') literal.interactionOracle.mismatches.push({ ...literal.interactionOracle.mismatches[0] })
    if (fault === 'other-case') mechanisms.cases[0].result = 'failed'
    if (fault === 'page-error') evidence.pageErrors.push('unexpected asynchronous rejection')
    if (fault === 'cleanup-error') mechanisms.secondaryErrors = ['context closed unexpectedly']
    if (fault === 'not-run-app') app.cases[0].result = 'not_run'
    if (fault === 'wrong-stage') evidence.stage = 'point-node-geometric-shapes'
    assert.throws(() => assertNamedStrict32BFailure(evidence, mechanisms, app))
  })
}
test('eleven-shape finite manifest has all terminal variants and no count-only acceptance', () => {
  assert.equal(geometricShapeManifest.length, 11)
  assert.equal(new Set(geometricShapeManifest.map(({ shape }) => shape)).size, 11)
  assert.deepEqual(allPointNodeScenarios[geometricShapeGroup], geometricShapeScenarios)
  for (const spec of geometricShapeManifest) assertGeometricShapeEvidence(shapeEvidence(spec), `point-geometric-${spec.slug}`)
})
for (const fault of ['missing-body', 'duplicate-body', 'missing-parameter', 'out-of-shape-body', 'unrotated-border-rotates-glyph', 'missing-native-control', 'page-error', 'wrong-shape', 'nonterminal']) {
  test(`32C shape manifest rejects ${fault}`, () => {
    const spec = geometricShapeManifest.find(({ shape }) => shape === 'star'), evidence = shapeEvidence(spec)
    if (fault === 'missing-body') evidence.cases.pop()
    if (fault === 'duplicate-body') evidence.cases[1] = structuredClone(evidence.cases[0])
    if (fault === 'missing-parameter') evidence.cases.at(-1).rendered.parameters = { starPoints: 7 }
    if (fault === 'out-of-shape-body') evidence.cases[1].rendered.bodyCorners[0].inside = false
    if (fault === 'unrotated-border-rotates-glyph') evidence.cases[2].rendered.bodyUpright = false
    if (fault === 'missing-native-control') evidence.nativeStyle = { shape: 'circle' }
    if (fault === 'page-error') evidence.pageErrors.push('unexpected')
    if (fault === 'wrong-shape') evidence.shape = 'circle'
    if (fault === 'nonterminal') evidence.result = 'started'
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
for (const fault of ['missing-color', 'duplicate-key', 'wrong-key', 'wrong-value', 'untrusted-input', 'no-input',
  'wrong-event-type', 'wrong-control-type', 'changed-control-type', 'already-configured', 'wrong-final-control', 'wrong-final-model', 'action-failed']) {
  test(`32C cylinder native color evidence rejects ${fault}`, () => {
    const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
    const input = evidence.nativeColorInputs[0]
    if (fault === 'missing-color') evidence.nativeColorInputs.pop()
    if (fault === 'duplicate-key') evidence.nativeColorInputs[1] = structuredClone(input)
    if (fault === 'wrong-key') input.parameter = 'cylinderUsesCustomFill'
    if (fault === 'wrong-value') input.expectedValue = '#123456'
    if (fault === 'untrusted-input') input.events[0].trusted = false
    if (fault === 'no-input') input.events = []
    if (fault === 'wrong-event-type') input.events[0].type = 'change'
    if (fault === 'wrong-control-type') input.inputType = 'color'
    if (fault === 'changed-control-type') input.finalInputType = 'color'
    if (fault === 'already-configured') input.beforeValue = input.expectedValue
    if (fault === 'wrong-final-control') input.finalValue = '#123456'
    if (fault === 'wrong-final-model') input.finalModelValue = '#123456'
    if (fault === 'action-failed') input.actionError = { message: 'native input failed' }
    assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
  })
}
test('32C cylinder model equality alone cannot replace final-valued trusted input', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
  const input = evidence.nativeColorInputs[0]
  input.events = [{ type: 'input', trusted: true, value: '#FFFFFF' }]
  assert.equal(input.finalValue, input.expectedValue)
  assert.equal(input.finalModelValue, input.expectedValue)
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('32C cylinder evidence rejects a synthetic final event after a trusted intermediate edit', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
  evidence.nativeColorInputs[0].events.push({ type: 'input', trusted: false, value: spec.parameters.cylinderEndFill })
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('32C cylinder evidence rejects an untrusted intermediate event before a trusted final edit', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'cylinder'), evidence = shapeEvidence(spec)
  evidence.nativeColorInputs[0].events.unshift({ type: 'input', trusted: false, value: '#123456' })
  assert.equal(evidence.nativeColorInputs[0].events.at(-1).trusted, true)
  assert.equal(evidence.nativeColorInputs[0].events.at(-1).value, spec.parameters.cylinderEndFill)
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('32C non-cylinder scenarios cannot carry unrelated color input observations', () => {
  const spec = geometricShapeManifest.find(({ shape }) => shape === 'ellipse'), evidence = shapeEvidence(spec)
  evidence.nativeColorInputs = shapeEvidence(geometricShapeManifest.find(({ shape }) => shape === 'cylinder')).nativeColorInputs
  assert.throws(() => assertGeometricShapeEvidence(evidence, evidence.scenario))
})
test('review-only disposition rejects malformed, wrong-profile, failed, incomplete, or stale envelopes', () => {
  for (const response of [{}, { report: {} }, { report: { kind: 'phase32c-review-only', phase: '32B' }, disposition: { status: 'accepted' } },
    { report: { kind: 'phase32c-review-only', phase: '32C', profile: phase32cProfile }, disposition: { phase: '32C', status: 'accepted', profile: 'strict' } }]) {
    assert.equal(phase32CDispositionMatchesCheckout(response), false)
  }
})
