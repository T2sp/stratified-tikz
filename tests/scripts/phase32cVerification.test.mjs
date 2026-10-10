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
import { syntheticPointNativeDragEvidence } from './pointNativeDragFixture.mjs'

// These preparation and event-delivery controls are explicitly synthetic. They
// exercise ordering/error ownership; the reused native App shape loop is the
// browser acceptance gate.
function selectionDeliveryControl(options = {}) {
  const { observationFailure, evidenceFailure, cleanupFailure, mouseFailure } = options
  const calls = [], observations = [], secondaryErrors = []
  const rendered = { shape: 'circle', source: 'native shape', center: { x: 1250, y: 270 }, boundary: { x: 1190, y: 280 } }
  const staleRendered = { ...rendered, center: { x: 1510, y: 140 }, boundary: { x: 1450, y: 150 } }
  const diagram = { ambientDimension: 2, strata: [{ id: 'app-point', geometricKind: 'point', codim: 2,
    position: { x: 3, y: 3, z: 0 }, text: '  native shape\t\n',
    style: { shape: 'circle', size: 8, opacity: 1, layout: { anchor: 'center', innerXSep: 2,
      units: { innerXSep: { source: '2pt', unit: 'pt', texPoints: 2 } } } } }] }
  const authoritative = { json: JSON.stringify({ version: 2, diagram }), runtimeDiagramJson: JSON.stringify(diagram),
    history: JSON.stringify({ past: [], present: diagram, future: [] }), labelDocumentRevision: 10 }
  const current = { selection: options.initialSelection ?? null, drawerOpen: options.drawerOpen ?? false,
    scrolled: false, closeActions: 0, installed: false, events: [], preparationSnapshots: 0 }
  const pointTarget = { tag: 'circle', pointId: 'app-point', drawer: false, svg: true, canvas: true, canvasRoot: false, pointHandle: false }
  const handleTarget = { tag: 'circle', class: 'svg-geometry-handle', pointId: null, drawer: false,
    svg: true, canvas: true, canvasRoot: false, pointHandle: true }
  const overlayTarget = { tag: 'div', class: 'empty-inspector', pointId: null, drawer: true,
    svg: false, canvas: false, canvasRoot: false, pointHandle: false }
  const otherOverlayTarget = { ...overlayTarget, class: 'other-overlay', drawer: false }
  const canvasTarget = { tag: 'svg', class: 'svg-diagram', drawer: false, svg: true, canvas: true, canvasRoot: true, pointHandle: false }
  const target = () => ({ point: pointTarget, handle: handleTarget, drawer: overlayTarget, overlay: otherOverlayTarget,
    wrongPoint: { ...pointTarget, pointId: 'other-point' } }[options.targetKind ?? 'point'])
  const pathFor = (eventTarget) => {
    if (options.missingPath) return []
    if (!eventTarget.svg) return [eventTarget]
    return [eventTarget, ...(eventTarget.pointHandle ? [{ tag: 'g', pointId: null, drawer: false,
      svg: true, canvas: true, canvasRoot: false, pointHandle: false, ariaLabel: 'Selected point drag handles' }] : [
      { tag: 'g', pointId: eventTarget.pointId, drawer: false, svg: true, canvas: true, canvasRoot: false, pointHandle: false }]), canvasTarget]
  }
  const page = {
    getByRole: (role, { name, exact }) => {
      assert.equal(role, 'button'); assert.equal(exact, true)
      if (name === 'Select') return { click: async () => { calls.push('Select') } }
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
      if (mouseFailure) throw mouseFailure
      assert.equal(current.drawerOpen, false, 'synthetic canvas input follows verified drawer closure')
      assert.equal(current.scrolled, true, 'synthetic canvas input follows canvas scrolling')
      const expected = options.boundary ? rendered.boundary : rendered.center
      assert.deepEqual({ x, y }, expected, 'synthetic canvas input uses post-preparation coordinates')
      const eventTarget = options.eventTargetKind ? { ...target(), ...({ drawer: overlayTarget, overlay: otherOverlayTarget }[options.eventTargetKind]) } : target()
      current.events = ['pointerdown', 'pointerup', 'click'].map((type) => {
        const capturedContinuation = options.handleCapture && type !== 'pointerdown'
        const deliveredTarget = capturedContinuation ? canvasTarget : eventTarget
        return { type, trusted: options.untrustedType !== type, target: deliveredTarget,
          path: capturedContinuation ? [canvasTarget] : pathFor(deliveredTarget),
          client: options.farClick && type === 'click' ? { x: x + 20, y: y + 20 } : { x, y },
          pointerId: options.mouseEventClick && type === 'click' ? null : options.wrongPointerId && type !== 'pointerdown' ? 8 : 7,
          canvasHasPointerCapture: capturedContinuation && type === 'pointerup' && !options.missingCapture }
      })
      if (options.wrongEventOrder) current.events.reverse()
      if (!options.selectionFailure) current.selection = { id: 'app-point' }
    } },
    evaluate: async (operation, argument) => {
      if (operation === installGeometricSelectionObserver) { calls.push('install'); current.installed = true; current.events = []; return }
      if (operation === removeGeometricSelectionObserver) { calls.push('cleanup'); current.installed = false; if (cleanupFailure) throw cleanupFailure; return }
      assert.equal(operation, observeGeometricSelection)
      const preparationStage = current.preparationSnapshots % 2 === 0 ? 'inherited' : 'closed'
      calls.push(argument.click ? 'snapshot' : `${preparationStage} snapshot`)
      if (!argument.click) {
        current.preparationSnapshots++
        if (options.preparationObservationFailure === preparationStage) throw new Error(`controlled ${preparationStage} observation failure`)
      }
      if (observationFailure && argument.click) throw observationFailure
      return { errors: [], layout: { shape: 'circle', source: 'native shape' }, requestedClick: argument.click,
        selection: structuredClone(current.selection), inspector: { open: current.drawerOpen, noSelection: !current.selection,
          expansionControls: current.drawerOpen ? [{ text: 'Collapse', expanded: 'true' }] : [] },
        geometry: { point: { screenCTM: { a: 3.1, b: 0, c: 0, d: 3.1,
          e: current.scrolled ? rendered.center.x : staleRendered.center.x,
          f: current.scrolled ? rendered.center.y : staleRendered.center.y } } },
        elementFromPoint: argument.click ? target() : null, elementsFromPoint: argument.click ? pathFor(target()) : [],
        events: [...current.events], droppedEvents: options.droppedEvents ?? 0 }
    },
  }
  return { calls, observations, secondaryErrors, rendered, staleRendered, page, current, authoritative,
    readState: async () => { calls.push('state'); return structuredClone({ ...authoritative, selection: current.selection }) },
    observePoint: async () => {
      calls.push('rendered after scroll')
      assert.equal(current.drawerOpen, false); assert.equal(current.scrolled, true)
      return options.staleMeasurement ? staleRendered : rendered
    },
    diagnose: async (details) => {
      calls.push(details.boundary)
      observations.push(structuredClone(details))
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
    assert.ok(control.calls.includes('cleanup'))
    assert.equal(control.observations.at(-1).primary.message, primary.message)
    assert.ok(control.secondaryErrors.some((message) => message.includes('evidence failed')))
    assert.ok(control.secondaryErrors.some((message) => message.includes('cleanup failed')))
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
test('synthetic stale pre-close coordinates are rejected by the one native mouse boundary', async () => {
  const control = selectionDeliveryControl({ drawerOpen: true, staleMeasurement: true })
  await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-diamond', sequence: 2,
    requireUnselected: true }), /post-preparation coordinates/)
  assert.equal(control.calls.filter(Array.isArray).length, 1)
})
for (const fault of ['drawer', 'overlay', 'wrongPoint']) {
  test(`synthetic current ${fault} target cannot establish success from trusted overlay events or selected state`, async () => {
    const control = selectionDeliveryControl({ initialSelection: { id: 'app-point' }, targetKind: fault })
    await assert.rejects(selectGeometricPoint({ ...control, scenario: 'point-geometric-native-contours-2d-3d', sequence: 12 }))
    assert.equal(control.calls.filter(Array.isArray).length, 1)
    assert.equal(control.current.selection.id, 'app-point')
    const after = control.observations.find(({ boundary }) => boundary === 'after-native-click-before-assertion').observation.after
    assert.equal(after.events.length, 3); assert.ok(after.events.every(({ trusted }) => trusted))
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
      return { ambientDimension, shape, codim: ambientDimension, nativeDrag,
        observed: { shape }, before: JSON.parse(nativeDrag.stateBefore.runtimeDiagramJson).strata[0],
        after: JSON.parse(nativeDrag.afterAction.state.runtimeDiagramJson).strata[0],
        events: nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag'),
        selected: true, trustedDown: true, trustedMove: true, dragged: true, undoRestored: true, redoRestored: true }
    })) }
}
test('synthetic 32C policy requires eight raw handle drags and exact history restorations', () => {
  const evidence = geometricInteractionEvidence()
  assertGeometricShapeEvidence(evidence, evidence.scenario)
})
function setSyntheticRevision(records, revision) {
  for (const record of records) {
    if (revision === undefined) delete record.labelDocumentRevision
    else record.labelDocumentRevision = revision
  }
}
function syntheticRevisionRecords(raw) {
  return [raw.preparation.stateBefore, raw.preparation.stateAfter, raw.preparation.statePrepared,
    raw.preparation.inherited, raw.preparation.closed, raw.preparation.prepared, raw.stateBefore, raw.before,
    raw.afterAction.state, raw.afterAction.observation, raw.undo.stateBefore, raw.undo.stateAfter, raw.undo.observation,
    raw.redo.stateBefore, raw.redo.stateAfter, raw.redo.observation,
    ...raw.afterAction.observation.events, ...raw.undo.observation.events, ...raw.redo.observation.events]
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
