import assert from 'node:assert/strict'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'
import { assertDiagnosticMeasurement, resolveDiagnosticCandidates, assertDiagnosticAction, assertUnsupportedDiagnosticEvidence } from './pointUnsupportedDiagnosticContract.mjs'

// All DOM helpers below run in the owned production document. The registry
// retains object identity without adding attributes to production elements.
export function installUnsupportedDiagnosticObserver({ token, id }) {
  const registry = window.__stzUnsupportedDiagnostics ??= new Map()
  if (registry.has(token)) throw new Error('Unsupported diagnostic observer already owned')
  const canvas = document.querySelector('svg.svg-diagram')
  const elements = new WeakMap()
  let nextElement = 0
  const elementIdentity = (element) => {
    if (!(element instanceof Element)) return null
    if (!elements.has(element)) elements.set(element, `${token}:element:${++nextElement}`)
    return elements.get(element)
  }
  const describe = (element) => {
    if (!(element instanceof Element)) return null
    const pointGroup = element.closest('[data-point-id]')
    const pointNode = element.closest('[data-point-node]') ?? pointGroup?.querySelector('[data-point-node]')
    const label = pointNode?.querySelector('[data-label-state]')
    return {
      tag: element.localName, id: element.id, connected: element.isConnected,
      elementToken: elementIdentity(element), pointNodeToken: elementIdentity(pointNode), pointGroupToken: elementIdentity(pointGroup),
      canvas: !!canvas?.contains(element), canvasRoot: element === canvas,
      canvasToken: canvas?.contains(element) ? token : null,
      background: element.hasAttribute('data-svg-background'),
      pointId: element.closest('[data-point-id]')?.getAttribute('data-point-id') ?? null,
      ownerToken: pointNode?.getAttribute('data-point-node') ?? null,
      pointRequest: pointNode?.getAttribute('data-point-request') ?? null,
      bodyRequest: label?.getAttribute('data-label-request') ?? null,
      source: label?.getAttribute('data-label-source') ?? null,
      labelOwner: label?.getAttribute('data-label-owner') ?? null,
      pointGroup: element === pointGroup, pointNode: element === pointNode,
      bodyTarget: element.getAttribute('data-point-body-target') === 'true', exportExcluded: element.getAttribute('data-svg-export-exclude') === 'true',
      body: !!element.closest('[data-label-state]'), warning: !!element.closest('[data-point-shape-warning]'),
      ring: element.matches('circle[data-svg-export-exclude]'),
      handle: !!element.closest('[aria-label="Selected point drag handles"]'),
      overlay: !!element.closest('#preview-inspector-drawer,.preview-toolbar-overlay-stack,.context-quick-style-bar,.preview-history-overlay'),
      drawer: !!element.closest('#preview-inspector-drawer'),
      toolbar: !!element.closest('.preview-floating-toolbar,.context-quick-style-bar'),
      pointerEvents: getComputedStyle(element).pointerEvents,
    }
  }
  const owned = { canvas, describe, events: [], droppedEvents: 0, errors: [], active: false }
  owned.listener = (event) => {
    if (!owned.active) return
    if (owned.events.length >= 16) { owned.droppedEvents++; return }
    try {
      const state = window.stzAppLabels.state()
      const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
      const body = node?.querySelector('[data-label-state]')
      const point = JSON.parse(state.runtimeDiagramJson).strata.find((entry) => entry.id === id)
      owned.events.push({ type: event.type, trusted: event.isTrusted, x: event.clientX, y: event.clientY,
        order: owned.events.length, pointerId: event.pointerId ?? null, pointerType: event.pointerType ?? null,
        button: event.button, buttons: event.buttons, epoch: state.labelDocumentRevision,
        altKey: event.altKey, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
        canvasHasPointerCapture: Number.isInteger(event.pointerId) && (canvas?.hasPointerCapture(event.pointerId) ?? false),
        identity: { id, ambientDimension: JSON.parse(state.runtimeDiagramJson).ambientDimension, shape: node?.getAttribute('data-point-shape'),
          epoch: state.labelDocumentRevision, ownerToken: node?.getAttribute('data-point-node'),
          pointRequest: node?.getAttribute('data-point-request'), bodyRequest: body?.getAttribute('data-label-request'),
          source: body?.getAttribute('data-label-source'), anchor: point?.style.layout.anchor, canvasToken: token },
        target: describe(event.target), path: event.composedPath().slice(0, 16).map(describe) })
    } catch (error) { owned.errors.push({ name: 'native event observation', message: error.message }) }
  }
  registry.set(token, owned)
  for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, owned.listener, true)
}

export function observeUnsupportedDiagnostic({ token, id }) {
  const owned = window.__stzUnsupportedDiagnostics?.get(token), errors = []
  const safe = (name, operation) => { try { return operation() } catch (error) { errors.push({ name, message: error.message }); return null } }
  const canvas = document.querySelector('svg.svg-diagram')
  const node = document.querySelector(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`)
  const body = node?.querySelector('[data-label-state]'), text = body?.querySelector('text'), warning = node?.querySelector('[data-point-shape-warning]')
  const bodyTarget = node?.querySelector('[data-point-body-target]')
  const ring = node?.querySelector(':scope > circle[data-svg-export-exclude]')
  const stateSnapshot = safe('authoritative state', () => window.stzAppLabels.state())
  const model = stateSnapshot && safe('runtime model', () => JSON.parse(stateSnapshot.runtimeDiagramJson))
  const rect = (element) => { const box = element.getBoundingClientRect(); return Object.fromEntries(['left', 'top', 'right', 'bottom', 'width', 'height'].map((key) => [key, box[key]])) }
  const matrix = (value) => value && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, value[key]]))
  const nodeScreen = safe('node screen CTM', () => node.getScreenCTM()), canvasScreen = safe('canvas screen CTM', () => canvas.getScreenCTM())
  const inverse = safe('node inverse CTM', () => nodeScreen.inverse()), rootInverse = safe('canvas inverse CTM', () => canvasScreen.inverse())
  const nativeBox = (element) => { const box = element.getBBox(); return { x: box.x, y: box.y, width: box.width, height: box.height } }
  const localBounds = (element) => {
    const box = element.getBBox(), own = element.getScreenCTM()
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(own).matrixTransform(inverse))
    return { minX: Math.min(...corners.map(({ x }) => x)), maxX: Math.max(...corners.map(({ x }) => x)),
      minY: Math.min(...corners.map(({ y }) => y)), maxY: Math.max(...corners.map(({ y }) => y)) }
  }
  const attrBounds = (name) => {
    const values = node.getAttribute(name)?.trim().split(/\s+/).map(Number)
    if (values?.length !== 4) throw new Error(`Malformed ${name}`)
    const [minX, minY, maxX, maxY] = values; return { minX, minY, maxX, maxY }
  }
  const click = (local) => {
    const projected = new DOMPoint(local.x, local.y).matrixTransform(nodeScreen), root = projected.matrixTransform(rootInverse)
    return { local, screen: { x: projected.x, y: projected.y }, root: { x: root.x, y: root.y },
      hit: { target: owned.describe(document.elementFromPoint(projected.x, projected.y)),
        stack: document.elementsFromPoint(projected.x, projected.y).slice(0, 16).map(owned.describe) } }
  }
  const bodyBounds = safe('native body bounds', () => localBounds(text)), warningBounds = safe('native warning bounds', () => localBounds(warning))
  const bodyClick = safe('body glyph probe', () => {
    const character = text.getExtentOfChar(0)
    const point = new DOMPoint(character.x + character.width / 2, character.y + character.height * .55).matrixTransform(text.getScreenCTM()).matrixTransform(inverse)
    return click({ x: point.x, y: point.y })
  })
  const warningClick = safe('warning probe', () => click({ x: (warningBounds.minX + warningBounds.maxX) / 2, y: warningBounds.minY + 3 }))
  const candidates = safe('fixed diagnostic candidates', () => {
    const bounds = { minX: Math.min(bodyBounds.minX, warningBounds.minX), maxX: Math.max(bodyBounds.maxX, warningBounds.maxX),
      minY: Math.min(bodyBounds.minY, warningBounds.minY), maxY: Math.max(bodyBounds.maxY, warningBounds.maxY) }
    return [ ['right', { x: bodyBounds.maxX + 100, y: (bodyBounds.minY + bodyBounds.maxY) / 2 }],
      ['left', { x: bounds.minX - 100, y: (bounds.minY + bounds.maxY) / 2 }],
      ['below', { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY + 100 }],
      ['above', { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY - 100 }] ].map(([name, local]) => ({ name, ...click(local) }))
  })
  const buttons = [...document.querySelectorAll('button')]
  const controls = (name) => buttons.filter((element) => (element.getAttribute('aria-label') ?? element.textContent.trim()) === name)
  const overlays = document.querySelectorAll('.preview-toolbar-overlay-stack')
  const clipAncestors = []
  for (let element = canvas; element && clipAncestors.length < 16; element = element.parentElement) {
    const style = getComputedStyle(element)
    clipAncestors.push({ bounds: rect(element), overflowX: style.overflowX, overflowY: style.overflowY,
      scrollLeft: element.scrollLeft, scrollTop: element.scrollTop })
  }
  const workPlaneControls = [...document.querySelectorAll('input,select,button')].filter((element) =>
    !element.closest('#preview-inspector-drawer,.preview-floating-toolbar,.context-quick-style-bar')
    && (element.closest('#preview-work-plane-panel,.work-plane-control')
      || /work.?plane/i.test([element.getAttribute('aria-label'), element.id, element.className].join(' ')))).slice(0, 48)
    .map((element) => ({ tag: element.localName, id: element.id, value: element.value ?? null, ariaLabel: element.getAttribute('aria-label'),
      pressed: element.getAttribute('aria-pressed'), checked: element.checked ?? null }))
  return { identity: { id, ambientDimension: model?.ambientDimension, shape: node?.getAttribute('data-point-shape'), epoch: stateSnapshot?.labelDocumentRevision,
    pointRequest: node?.getAttribute('data-point-request'), bodyRequest: body?.getAttribute('data-label-request'), source: body?.getAttribute('data-label-source'),
    anchor: node?.getAttribute('data-point-anchor'), ownerToken: node?.getAttribute('data-point-node'), canvasToken: owned?.canvas === canvas ? token : null },
    stateSnapshot, ui: { inspector: { open: !!document.getElementById('preview-inspector-drawer'),
      openerExpanded: controls('Open inspector drawer')[0]?.getAttribute('aria-expanded') ?? null },
      toolbar: { collapsed: overlays.length === 1 && overlays[0].classList.contains('is-collapsed'), overlayCount: overlays.length,
        floatingCount: document.querySelectorAll('section.preview-floating-toolbar').length,
        expandCount: controls('Expand preview toolbar').length, collapseCount: controls('Collapse preview toolbar').length },
      selectPressed: controls('Select')[0]?.getAttribute('aria-pressed') ?? null, workPlaneControls,
      workPlaneStatus: [...document.querySelectorAll('.work-plane-status,.preview-work-plane-status,.work-plane-summary')].map((element) => element.textContent) },
    connected: { canvasCount: document.querySelectorAll('svg.svg-diagram').length,
      nodeCount: document.querySelectorAll(`[data-point-id="${CSS.escape(id)}"] [data-point-node]`).length,
      bodyCount: node?.querySelectorAll('[data-label-state]').length, warningCount: node?.querySelectorAll('[data-point-shape-warning]').length,
      bodyTargetCount: node?.querySelectorAll('[data-point-body-target]').length,
      canvas: canvas?.isConnected && owned?.canvas === canvas, node: !!node?.isConnected, body: !!body?.isConnected, warning: !!warning?.isConnected,
      bodyTarget: !!bodyTarget?.isConnected },
    source: body?.getAttribute('data-label-source'), anchor: node?.getAttribute('data-point-anchor'), layout: safe('layout', () => JSON.parse(node.getAttribute('data-point-layout'))),
    state: body?.getAttribute('data-label-state'), diagnostic: warning?.getAttribute('aria-label'), contourCount: node?.querySelectorAll('[data-point-contour]').length,
    bodyBounds, warningBounds, shapeBounds: safe('requested shape bounds', () => attrBounds('data-point-shape-bounds')),
    paintedBounds: safe('painted bounds', () => attrBounds('data-point-painted-bounds')), anchorBounds: safe('anchor bounds', () => attrBounds('data-point-anchor-bounds')),
    modelBodyBounds: safe('model body bounds', () => attrBounds('data-point-body-bounds')),
    nativeBounds: { body: safe('body bbox', () => nativeBox(text)), warning: safe('warning bbox', () => nativeBox(warning)) },
    bodyTarget: bodyTarget ? {
      descriptor: owned.describe(bodyTarget), ownerNode: owned.describe(node), ownerGroup: owned.describe(node.closest('[data-point-id]')),
      label: owned.describe(body), parentIsPointNode: bodyTarget.parentElement === node,
      attributes: { x: Number(bodyTarget.getAttribute('x')), y: Number(bodyTarget.getAttribute('y')),
        width: Number(bodyTarget.getAttribute('width')), height: Number(bodyTarget.getAttribute('height')),
        fill: bodyTarget.getAttribute('fill'), transform: bodyTarget.getAttribute('transform') },
      nativeBounds: safe('body target bbox', () => nativeBox(bodyTarget)), bounds: safe('body target bounds', () => localBounds(bodyTarget)),
      screenMatrix: safe('body target screen CTM', () => matrix(bodyTarget.getScreenCTM())),
    } : null,
    nodeMatrix: matrix(nodeScreen), canvasMatrix: matrix(canvasScreen),
    matrices: { node: safe('node CTM', () => matrix(node.getCTM())), canvas: safe('canvas CTM', () => matrix(canvas.getCTM())),
      bodyScreen: safe('body screen CTM', () => matrix(text.getScreenCTM())), warningScreen: safe('warning screen CTM', () => matrix(warning.getScreenCTM())) },
    viewBox: safe('viewBox', () => { const box = canvas.viewBox.baseVal; return { x: box.x, y: box.y, width: box.width, height: box.height } }),
    preserveAspectRatio: safe('preserveAspectRatio', () => ({ attribute: canvas.getAttribute('preserveAspectRatio'),
      align: canvas.preserveAspectRatio.baseVal.align, meetOrSlice: canvas.preserveAspectRatio.baseVal.meetOrSlice })),
    canvasClient: safe('canvas client bounds', () => rect(canvas)), clipAncestors,
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio,
      visual: visualViewport ? { width: visualViewport.width, height: visualViewport.height, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null },
    ring: ring ? { cx: Number(ring.getAttribute('cx')), cy: Number(ring.getAttribute('cy')), radius: Number(ring.getAttribute('r')) } : null,
    bodyClick, warningClick, candidates, errors }
}

export function unsupportedDiagnosticEvents({ token, active }) {
  const owned = window.__stzUnsupportedDiagnostics?.get(token)
  if (!owned) throw new Error('Owned diagnostic observer is missing')
  if (active) { owned.events = []; owned.errors = []; owned.droppedEvents = 0 }
  owned.active = active
  const pointerId = owned.events.find(({ type }) => type === 'pointerdown')?.pointerId
  return { events: owned.events, errors: owned.errors, droppedEvents: owned.droppedEvents,
    canvasCaptureAfterInput: Number.isInteger(pointerId) && owned.canvas.hasPointerCapture(pointerId) }
}
export function removeUnsupportedDiagnosticObserver(token) {
  const registry = window.__stzUnsupportedDiagnostics, owned = registry?.get(token)
  if (owned) for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, owned.listener, true)
  registry?.delete(token)
  if (registry?.size === 0) delete window.__stzUnsupportedDiagnostics
}

export async function runUnsupportedDiagnosticCase({ page, readState, diagnose, expected, token, secondaryErrors }) {
  const entry = { result: 'observed', id: expected.id, expected, token, ambientDimension: expected.ambientDimension, shape: expected.shape,
    preparation: { actions: [] }, restoration: { actions: [] }, clicks: [], secondaryErrors: [] }
  let primary, installed = false
  const bounded = (name, operation) => boundedPointDiagnostic(operation, `Unsupported diagnostic ${name}`, 5000)
  const persist = (stage) => bounded('evidence', () => diagnose({ stage, entry }))
  const measure = async (stage, prepared = false) => {
    const measured = await bounded('measurement', () => page.evaluate(observeUnsupportedDiagnostic, { token, id: expected.id }))
    entry.latestMeasurement = measured
    // Persist native candidates even when the resolver or an assertion fails.
    await persist(stage)
    const resolved = resolveDiagnosticCandidates(measured)
    const result = { ...measured, ...resolved }
    entry.latestMeasurement = result
    await persist(`${stage}-resolved`)
    assertDiagnosticMeasurement(result, { expected, requireCandidate: prepared, allowObstructedClicks: !prepared })
    return result
  }
  const preserve = (before, after, selection = true) => {
    for (const field of ['json', 'runtimeDiagramJson', 'history', 'labelDocumentRevision', 'uiSettings', 'requests', ...(selection ? ['selection'] : [])]) {
      assert.deepEqual(after[field], before[field], `Unsupported diagnostic preserves ${field}`)
    }
  }
  const uiAction = async (name, purpose) => {
    const action = { name, purpose, stateBefore: await bounded('UI before state', readState) }
    ;(purpose === 'restore' ? entry.restoration : entry.preparation).actions.push(action)
    let actionPrimary
    try {
      const control = page.getByRole('button', { name, exact: true })
      action.controlCount = await control.count(); assert.equal(action.controlCount, 1, `${name} is unique`)
      await control.click({ timeout: 5000 })
      if (name === 'Close inspector drawer') await page.locator('#preview-inspector-drawer').waitFor({ state: 'detached', timeout: 5000 })
      if (name === 'Open inspector drawer') await page.locator('#preview-inspector-drawer').waitFor({ state: 'visible', timeout: 5000 })
      if (/preview toolbar/.test(name)) {
        const collapsed = name.startsWith('Collapse')
        await page.locator('section.preview-floating-toolbar').waitFor({ state: collapsed ? 'detached' : 'visible', timeout: 5000 })
        await page.locator(`.preview-toolbar-overlay-stack${collapsed ? '.is-collapsed' : ':not(.is-collapsed)'}`).waitFor({ state: 'visible', timeout: 5000 })
        const opposite = page.getByRole('button', { name: `${collapsed ? 'Expand' : 'Collapse'} preview toolbar`, exact: true })
        action.oppositeCount = await opposite.count()
        assert.equal(action.oppositeCount, 1, 'Diagnostic toolbar transition has one opposite real control')
      }
    } catch (error) { actionPrimary = error; action.error = { message: error.message } }
    try { action.stateAfter = await bounded('UI state', readState); await persist(`ui-${purpose}-${name}`) }
    catch (error) {
      if (actionPrimary) { entry.secondaryErrors.push({ name: 'UI diagnostics', message: error.message }); secondaryErrors.push(`Unsupported diagnostic UI diagnostics: ${error.message}`) }
      else actionPrimary = error
    }
    if (actionPrimary) throw actionPrimary
    preserve(action.stateBefore, action.stateAfter)
  }
  try {
    await bounded('observer install', () => page.evaluate(installUnsupportedDiagnosticObserver, { token, id: expected.id })); installed = true
    entry.preparation.before = await bounded('before state', readState)
    let current = await measure('inherited')
    entry.preparation.uiBefore = current.ui
    if (current.ui.selectPressed !== 'true') {
      if (current.ui.toolbar.collapsed) await uiAction('Expand preview toolbar', 'select-access')
      await uiAction('Select', 'select')
      current = await measure('select-prepared')
    }
    const viewportClipped = (click) => click && (click.screen.x < 0 || click.screen.y < 0
      || click.screen.x >= current.viewport.width || click.screen.y >= current.viewport.height)
    if (viewportClipped(current.bodyClick) || viewportClipped(current.warningClick)) {
      const action = { name: 'canvas-scroll', purpose: 'prepare', stateBefore: await bounded('scroll before state', readState) }
      entry.preparation.actions.push(action)
      const canvas = page.locator('svg.svg-diagram'); action.controlCount = await canvas.count()
      assert.equal(action.controlCount, 1, 'Scroll uses the unique production canvas')
      await canvas.scrollIntoViewIfNeeded({ timeout: 5000 })
      action.stateAfter = await bounded('scroll after state', readState); preserve(action.stateBefore, action.stateAfter)
      current = await measure('scrolled')
    }
    if (current.ui.inspector.open && (current.bodyClick.hit.target?.drawer || current.warningClick.hit.target?.drawer
      || (!current.farClick && current.candidates.some((candidate) => candidate.hit.target?.drawer)))) {
      await uiAction('Close inspector drawer', 'prepare'); current = await measure('drawer-closed')
    }
    if (!current.ui.toolbar.collapsed && (current.bodyClick.hit.target?.toolbar || current.warningClick.hit.target?.toolbar
      || (!current.farClick && current.candidates.some((candidate) => candidate.hit.target?.toolbar)))) {
      await uiAction('Collapse preview toolbar', 'prepare'); current = await measure('toolbar-collapsed')
    }
    entry.preparation.after = current.stateSnapshot; entry.preparation.uiAfter = current.ui
    preserve(entry.preparation.before, entry.preparation.after)
    entry.rendered = current
    await persist('prepared-before-assertion')
    assert.ok(current.farClick, 'An eligible measured far diagnostic candidate exists')
    assert.equal(current.nativeCanvasAtFarClick, true, 'Far diagnostic click reaches the native SVG canvas')
    for (const kind of ['body', 'far', 'warning']) {
      // Selection adds/removes a ring. Never reuse a pre-selection hit/CTM.
      const measurement = await measure(`${kind}-fresh-before-input`, true)
      const click = measurement[`${kind}Click`]
      assert.ok(click, `Fresh ${kind} probe exists`)
      const previous = entry.clicks.at(-1)?.after ?? entry.preparation.after
      assert.deepEqual(measurement.stateSnapshot, previous, 'Fresh diagnostic measurement follows the preceding authoritative state')
      assert.deepEqual(measurement.stateSnapshot, await bounded('fresh authoritative state', readState), 'Fresh measurement matches current authoritative state before input')
      preserve(entry.preparation.before, measurement.stateSnapshot, false)
      assert.equal(measurement.adopted, entry.rendered.adopted, 'Selection does not change the adopted negative candidate')
      assert.deepEqual(measurement.farClick.local, entry.rendered.farClick.local, 'The measured negative candidate retains its geometric location')
      for (const field of ['identity', 'nodeMatrix', 'canvasMatrix', 'bodyBounds', 'warningBounds', 'shapeBounds', 'paintedBounds', 'anchorBounds', 'bodyTarget']) {
        assert.deepEqual(measurement[field], entry.rendered[field], `Fresh diagnostic measurement preserves ${field}`)
      }
      const action = { kind, measurement, click, before: measurement.stateSnapshot }
      entry.clicks.push(action)
      if (kind === 'far') { entry.ring = measurement.ring; assert.ok(entry.ring, 'Body selection has a visible ring') }
      const target = click.hit.target
      assert.ok(target?.canvas && target.canvasToken === token && !target.overlay && !target.handle, `${kind} probe reaches the owned canvas`)
      assert.deepEqual(click.hit.stack[0], target, 'Fresh native hit stack agrees')
      await bounded('activate observer', () => page.evaluate(unsupportedDiagnosticEvents, { token, active: true }))
      await persist(`${kind}-bound-before-click`)
      let actionPrimary
      try {
        action.inputMeasurement = await bounded('immediate input measurement', () => page.evaluate(observeUnsupportedDiagnostic, { token, id: expected.id }))
        await persist(`${kind}-input-measured-before-assertion`)
        const inputMeasurement = { ...action.inputMeasurement, ...resolveDiagnosticCandidates(action.inputMeasurement) }
        assertDiagnosticMeasurement(inputMeasurement, { expected, requireCandidate: true })
        assert.deepEqual(inputMeasurement.stateSnapshot, action.before, 'Immediate native measurement retains the bound authoritative state')
        assert.deepEqual(inputMeasurement.identity, measurement.identity, 'Immediate native input retains current owner/request/source/canvas')
        for (const field of ['nodeMatrix', 'canvasMatrix', 'bodyBounds', 'warningBounds', 'shapeBounds', 'paintedBounds', 'anchorBounds', 'bodyTarget', 'ring', 'viewBox', 'canvasClient', 'viewport', 'clipAncestors']) {
          assert.deepEqual(inputMeasurement[field], measurement[field], `Immediate native input retains measured ${field}`)
        }
        assert.deepEqual(inputMeasurement[`${kind}Click`], click, 'Immediate native geometry and hit route match the requested click')
        assert.deepEqual(await bounded('input authoritative state', readState), action.before, 'The bound measurement is still current at native input')
        await bounded('native mouse input', () => page.mouse.click(click.screen.x, click.screen.y))
      }
      catch (error) { actionPrimary = error; action.error = { message: error.message } }
      try {
        Object.assign(action, await bounded('native events', () => page.evaluate(unsupportedDiagnosticEvents, { token, active: false })))
        action.after = await bounded('after input state', readState)
        action.selectedId = action.after.selection?.id ?? null
        action.afterMeasurement = await bounded('after input measurement', () => page.evaluate(observeUnsupportedDiagnostic, { token, id: expected.id }))
        await persist(`${kind}-after-input-before-assertion`)
      } catch (error) {
        if (actionPrimary) {
          entry.secondaryErrors.push({ name: 'after-input diagnostics', message: error.message })
          secondaryErrors.push(`Unsupported diagnostic after-input diagnostics: ${error.message}`)
        } else actionPrimary = error
      }
      if (actionPrimary) throw actionPrimary
      preserve(action.before, action.after, false)
      if (kind === 'far') assert.notEqual(action.selectedId, expected.id, 'Hidden requested contour cannot receive hits')
      else assert.equal(action.selectedId, expected.id, `${kind} selects the owned point`)
      assertDiagnosticAction(action, expected)
    }
    entry.diagramUnchanged = true
  } catch (error) { primary = error; entry.error = { message: error.message, stack: error.stack } }
  finally {
    const secondary = async (name, operation) => {
      try { await bounded(name, operation) } catch (error) {
        if (!primary) primary = error
        else { entry.secondaryErrors.push({ name, message: error.message }); secondaryErrors.push(`Unsupported diagnostic ${name}: ${error.message}`) }
      }
    }
    await secondary('restoration', async () => {
      entry.restoration.before = await readState()
      const fresh = await bounded('restoration UI measurement', () => page.evaluate(observeUnsupportedDiagnostic, { token, id: expected.id }))
      entry.restoration.uiBefore = fresh.ui
      const initial = entry.preparation.uiBefore, current = fresh.ui
      // Restore only native toggles performed by this case, keeping terminal selection.
      if (initial && current && entry.preparation.actions.some(({ name }) => /preview toolbar/.test(name))) {
        if (initial.toolbar.collapsed !== current.toolbar.collapsed) await uiAction(initial.toolbar.collapsed ? 'Collapse preview toolbar' : 'Expand preview toolbar', 'restore')
      }
      if (initial?.inspector.open && !current?.inspector.open
        && entry.preparation.actions.some(({ name }) => name === 'Close inspector drawer')) await uiAction('Open inspector drawer', 'restore')
      entry.restoration.after = await readState(); preserve(entry.restoration.before, entry.restoration.after)
      const restored = await bounded('restored UI measurement', () => page.evaluate(observeUnsupportedDiagnostic, { token, id: expected.id }))
      entry.restoration.uiAfter = restored.ui
      entry.restoration.measurement = restored
    })
    if (installed) await secondary('observer cleanup', () => page.evaluate(removeUnsupportedDiagnosticObserver, token))
    await secondary('final evidence', () => persist('finished'))
  }
  if (primary) throw primary
  // Contract validation is mandatory before this raw candidate becomes terminal.
  const accepted = { ...entry, result: 'passed' }
  try { assertUnsupportedDiagnosticEvidence(accepted) }
  catch (error) {
    entry.error = { message: error.message, stack: error.stack }
    try { await persist('contract-failed') } catch (diagnosticError) { secondaryErrors.push(`Unsupported diagnostic contract evidence: ${diagnosticError.message}`) }
    throw error
  }
  entry.result = 'passed'
  return entry
}
