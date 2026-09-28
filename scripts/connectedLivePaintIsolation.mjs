import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { boundedPointDiagnostic } from './pointCheckDiagnostics.mjs'

/** Serializable browser operation. Own presentation CSS, never point source,
 * model, framing, or pointer-events. In particular, a root-level feedback group
 * is not a point child and need not carry data-svg-export-exclude. */
export function connectedLivePaintIsolationInDocument({ action, owner, pointId = 'p', lease = owner, region = { minX: -34, minY: -34, maxX: 34, maxY: 34 } }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(owner ?? '')) throw new Error('Invalid live capture isolation owner')
  if (!['install', 'inspect', 'restore'].includes(action)) throw new Error('Invalid live capture isolation action')
  const key = Symbol.for('stz.connectedLivePaintIsolation')
  const existing = document.getElementById(owner)
  if (existing && !existing[key]) throw new Error(`Live capture isolation ownership collision: ${owner}`)
  if (action === 'restore' && !existing) return { owner, restored: true, alreadyAbsent: true }
  if (action !== 'install' && !existing) throw new Error(`Live capture isolation missing: ${owner}`)
  if (action === 'install' && existing) throw new Error(`Live capture isolation already installed: ${owner}`)
  const describe = (element) => ({ tag: element.localName, id: element.id || null, class: element.getAttribute('class'),
    exportExcluded: element.hasAttribute('data-svg-export-exclude'), contour: element.hasAttribute('data-point-contour') })
  const presentation = (element) => {
    const css = getComputedStyle(element)
    return { visibility: css.visibility, display: css.display, pointerEvents: css.pointerEvents }
  }
  const paint = (element) => {
    const css = getComputedStyle(element)
    return Object.fromEntries(['stroke', 'strokeWidth', 'strokeOpacity', 'strokeDasharray', 'strokeDashoffset', 'strokeLinecap',
      'strokeLinejoin', 'strokeMiterlimit', 'fill', 'fillOpacity', 'opacity', 'filter', 'transform'].map((name) => [name, css[name]]))
  }
  const rootPresentation = (element) => {
    const css = getComputedStyle(element)
    return Object.fromEntries(['backgroundColor', 'backgroundImage', 'backgroundClip', 'borderColor', 'borderRadius', 'boxShadow', 'outline'].map((name) => [name, css[name]]))
  }
  const matrix = (element) => {
    const ctm = element.getScreenCTM()
    return ctm && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((name) => [name, ctm[name]]))
  }
  const inspect = (state) => {
    const elements = [...state.root.querySelectorAll('*')]
    const visibility = elements.map((element) => ({ ...describe(element), ...presentation(element), intendedPaint: element === state.contour }))
    const leaks = [document.body, ...document.body.querySelectorAll('*')].filter((element) => element !== state.root && element !== state.contour)
      .map((element) => ({ ...describe(element), ...presentation(element) }))
      .filter((entry) => entry.visibility !== 'hidden' && entry.display !== 'none')
    const contour = presentation(state.contour), root = presentation(state.root)
    const sourceUnchanged = state.contour.outerHTML === state.source
    const ctmUnchanged = JSON.stringify(matrix(state.contour)) === JSON.stringify(state.ctm)
    const paintUnchanged = JSON.stringify(paint(state.contour)) === JSON.stringify(state.paint)
    const pointerEventsUnchanged = state.presentations.every(({ element, before }) => presentation(element).pointerEvents === before.pointerEvents)
    const background = getComputedStyle(state.root).backgroundColor
    const css = getComputedStyle(state.contour), bbox = state.contour.getBBox(), width = parseFloat(css.strokeWidth)
    const geometricBounds = { minX: bbox.x, minY: bbox.y, maxX: bbox.x + bbox.width, maxY: bbox.y + bbox.height }
    // Every centerline point is in the native geometry box. A square endpoint
    // cap lies within sqrt(2)*halfWidth of its endpoint; bevel joins and stroke
    // strips lie within halfWidth. This bounds even disconnected dash caps.
    const expansion = width * Math.SQRT2 / 2
    const bounds = { minX: geometricBounds.minX - expansion, minY: geometricBounds.minY - expansion,
      maxX: geometricBounds.maxX + expansion, maxY: geometricBounds.maxY + expansion }
    const supported = ['polygon', 'circle'].includes(state.contour.localName) && css.strokeLinecap === 'square' && css.strokeLinejoin === 'bevel'
      && width > 0 && [width, ...Object.values(geometricBounds), ...Object.values(state.region)].every(Number.isFinite)
    const enclosed = supported && bounds.minX > state.region.minX && bounds.minY > state.region.minY
      && bounds.maxX < state.region.maxX && bounds.maxY < state.region.maxY
    const paintSupport = { method: 'native geometric bbox plus square-cap Euclidean support; independent of dash placement and production geometry',
      geometricBounds, width, cap: css.strokeLinecap, join: css.strokeLinejoin, expansion, bounds, region: state.region, supported, enclosed }
    return { owner, method: 'owned CSS: connected intended contour and calibrated white root only',
      connected: state.root.isConnected && state.contour.isConnected && state.root.contains(state.contour),
      contourIdentityPreserved: document.querySelector(state.selector) === state.contour,
      sourceUnchanged, ctmUnchanged, paintUnchanged, pointerEventsUnchanged, background, root, contour, paintSupport,
      rootDecorationVisibility: visibility, visibilityLeaks: leaks,
      feedback: [...state.root.querySelectorAll('.svg-selection-cycle-feedback, .svg-selection-cycle-feedback *')]
        .map((element) => ({ ...describe(element), ...presentation(element) })),
      ctm: matrix(state.contour), source: state.contour.outerHTML,
      valid: state.root.isConnected && state.contour.isConnected && document.querySelector(state.selector) === state.contour
        && sourceUnchanged && ctmUnchanged && paintUnchanged && pointerEventsUnchanged && !leaks.length && enclosed
        && contour.visibility === 'visible' && contour.display !== 'none' && root.visibility === 'visible'
        && root.display !== 'none' && background === 'rgb(255, 255, 255)' }
  }
  if (action === 'restore') {
    const state = existing[key]
    if (state.lease !== lease) throw new Error(`Live capture isolation lease collision: ${owner}`)
    existing.remove()
    const changedVisibility = state.presentations.flatMap(({ element, before }) => {
      const after = presentation(element)
      return element.isConnected && JSON.stringify(after) === JSON.stringify(before) ? [] : [{ ...describe(element), before, after, connected: element.isConnected }]
    })
    const result = { owner, removedOwnedStyle: !existing.isConnected, remainingOwner: Boolean(document.getElementById(owner)),
      connected: state.contour.isConnected, contourIdentityPreserved: document.querySelector(state.selector) === state.contour,
      sourceUnchanged: state.contour.outerHTML === state.source,
      paintUnchanged: JSON.stringify(paint(state.contour)) === JSON.stringify(state.paint),
      backgroundRestored: getComputedStyle(state.root).backgroundColor === state.background,
      rootPresentationRestored: JSON.stringify(rootPresentation(state.root)) === JSON.stringify(state.rootPresentation),
      rootStyleUnchanged: state.root.getAttribute('style') === state.rootStyle,
      ctmUnchanged: JSON.stringify(matrix(state.contour)) === JSON.stringify(state.ctm),
      changedVisibility, rootStyle: state.root.getAttribute('style'), ctm: matrix(state.contour) }
    result.restored = result.removedOwnedStyle && !result.remainingOwner && result.connected && result.contourIdentityPreserved
      && result.sourceUnchanged && result.paintUnchanged && result.backgroundRestored && result.rootPresentationRestored && result.rootStyleUnchanged && result.ctmUnchanged && !changedVisibility.length
    delete existing[key]
    return result
  }
  if (action === 'inspect') return inspect(existing[key])
  const roots = [...document.querySelectorAll('svg.svg-diagram')]
  if (roots.length !== 1) throw new Error('Live capture isolation requires exactly one diagram root')
  const root = roots[0]
  const selector = `svg.svg-diagram [data-point-id="${CSS.escape(pointId)}"] [data-point-contour]`
  const contours = [...document.querySelectorAll(selector)]
  if (contours.length !== 1 || !contours[0].isConnected) throw new Error('Live capture isolation requires one connected intended contour')
  const contour = contours[0]
  if (contour.querySelector('*')) throw new Error('Live capture isolation requires a leaf contour')
  const style = document.createElement('style')
  style.id = owner
  // Equal/higher specificity plus later ownership supersedes the prior broad
  // svg.svg-diagram * visibility rule without changing any inline attributes.
  style.textContent = `body, body * { visibility: hidden !important; }
svg.svg-diagram, svg.svg-diagram * { visibility: hidden !important; }
svg.svg-diagram { visibility: visible !important; background: #fff !important; border-color: transparent !important; border-radius: 0 !important; box-shadow: none !important; outline: none !important; }
${selector} { visibility: visible !important; }`
  const state = { root, contour, selector, lease, region, ctm: matrix(contour), rootStyle: root.getAttribute('style'), rootPresentation: rootPresentation(root), source: contour.outerHTML, paint: paint(contour), background: getComputedStyle(root).backgroundColor,
    presentations: [document.body, ...document.body.querySelectorAll('*')].map((element) => ({ element, before: presentation(element) })) }
  style[key] = state
  try {
    document.head.append(style)
    const result = inspect(state)
    result.before = { feedback: state.presentations.filter(({ element }) => element.matches('.svg-selection-cycle-feedback, .svg-selection-cycle-feedback *'))
      .map(({ element, before }) => ({ ...describe(element), ...before })), background: state.background }
    if (!result.valid) throw new Error(`Live capture isolation invalid: ${JSON.stringify(result)}`)
    return result
  } catch (error) {
    style.remove()
    delete style[key]
    throw error
  }
}

/** Bound cleanup and persistence separately; the observation's primary failure
 * remains primary even if restoring/persisting diagnostics also fails. */
export async function withConnectedLivePaintIsolation({ page, owner, pointId = 'p', record, persist, region }, operation) {
  let primary, value
  const lease = randomUUID()
  try {
    record.isolation = await boundedPointDiagnostic(() => page.evaluate(connectedLivePaintIsolationInDocument, { action: 'install', owner, pointId, lease, region }), 'connected live capture isolation install', 5000)
    assert.equal(record.isolation.valid, true, 'Complete connected live capture presentation isolation')
    await boundedPointDiagnostic(persist, 'connected live capture isolation evidence')
    value = await operation()
  } catch (error) {
    primary = error
    record.isolationOperationError = { message: error.message, stack: error.stack, captureDiagnostic: error.captureDiagnostic }
  } finally {
    if (record.isolation) {
      try {
        record.isolationAfter = await boundedPointDiagnostic(() => page.evaluate(connectedLivePaintIsolationInDocument, { action: 'inspect', owner, pointId }), 'connected live capture isolation after observation', 5000)
        assert.equal(typeof record.source, 'string', 'Retained live capture source is present')
        assert.equal(record.source, record.isolation.source, 'Retained live capture source matches isolated contour')
        assert.deepEqual(record.ctm, record.isolation.ctm, 'Retained live capture CTM matches isolated contour')
        assert.equal(record.isolationAfter.valid, true, 'Connected live capture isolation still valid after observation')
        assert.equal(record.isolationAfter.source, record.isolation.source, 'Connected live capture source unchanged across observation')
        assert.deepEqual(record.isolationAfter.ctm, record.isolation.ctm, 'Connected live capture CTM unchanged across observation')
        assert.deepEqual(record.isolationAfter.paintSupport, record.isolation.paintSupport, 'Independent complete paint support unchanged across observation')
      } catch (error) {
        record.isolationAfterError = { message: error.message, stack: error.stack }
        primary ??= error
      }
    }
    try {
      record.isolationRestoration = await boundedPointDiagnostic(() => page.evaluate(connectedLivePaintIsolationInDocument, { action: 'restore', owner, pointId, lease }), 'connected live capture isolation restoration', 5000)
      assert.equal(record.isolationRestoration.restored, true, 'Owned live capture presentation restored')
    } catch (error) {
      record.isolationCleanupError = { message: error.message, stack: error.stack }
      primary ??= error
    }
    try { await boundedPointDiagnostic(persist, 'connected live capture isolation final evidence') }
    catch (error) { record.isolationPersistenceError = { message: error.message, stack: error.stack }; primary ??= error }
  }
  if (primary) throw primary
  return value
}
