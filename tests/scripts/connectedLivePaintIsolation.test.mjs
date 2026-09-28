import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { connectedLivePaintIsolationInDocument, withConnectedLivePaintIsolation } from '../../scripts/connectedLivePaintIsolation.mjs'

// This DOM ownership double tests cleanup, target identity and observed computed
// visibility diagnostics. It does not claim native CSS/pixel acceptance: the
// registered retained-PNG regressions and live parent captures own that evidence.
function documentDouble() {
  let head, body, root, contour, feedback, failAppend = false, leaked = false
  const nodes = []
  class Element {
    constructor(tag, attributes = {}) { this.localName = tag; this.attributes = new Map(Object.entries(attributes)); this.children = []; this.parentElement = null; nodes.push(this) }
    get id() { return this.getAttribute('id') ?? '' }
    set id(value) { this.attributes.set('id', value) }
    get isConnected() { return this === head || this === body || Boolean(this.parentElement?.isConnected) }
    get outerHTML() { return `<${this.localName}${[...this.attributes].map(([k, v]) => ` ${k}="${v}"`).join('')}>${this.children.map((c) => c.outerHTML).join('')}</${this.localName}>` }
    getAttribute(key) { return this.attributes.get(key) ?? null }
    hasAttribute(key) { return this.attributes.has(key) }
    append(child) { child.parentElement = this; this.children.push(child); if (this === head && failAppend) throw new Error('append failed after attachment') }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null }
    contains(child) { return this === child || this.children.some((c) => c.contains(child)) }
    querySelectorAll(selector) {
      const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')])
      if (selector === '*') return descendants
      if (selector === '.svg-selection-cycle-feedback, .svg-selection-cycle-feedback *') return descendants.filter((e) => e === feedback || feedback.contains(e))
      throw new Error(`Unexpected fixture selector ${selector}`)
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
    matches(selector) { assert.equal(selector, '.svg-selection-cycle-feedback, .svg-selection-cycle-feedback *'); return this === feedback || feedback.contains(this) }
    getBBox() { return { x: -12, y: -12, width: 24, height: 24 } }
    getScreenCTM() { return { a: 1, b: 0, c: 0, d: 1, e: 450, f: 350 } }
  }
  const append = (parent, tag, attributes) => { const child = new Element(tag, attributes); parent.append(child); return child }
  head = new Element('head'); body = new Element('body')
  const sibling = append(body, 'button', { id: 'unrelated', style: 'color:red' })
  root = append(body, 'svg', { class: 'svg-diagram', style: 'width:900px;height:700px', viewBox: '0 0 900 700' })
  const point = append(root, 'g', { 'data-point-id': 'p', transform: 'translate(450 350)' })
  contour = append(point, 'polygon', { 'data-point-contour': '', points: '-12,-12 12,-12 12,12 -12,12', stroke: '#000', 'stroke-width': '12', fill: 'none' })
  append(point, 'circle', { 'data-svg-export-exclude': '', r: '30' })
  feedback = append(root, 'g', { class: 'svg-selection-cycle-feedback', 'pointer-events': 'none' })
  append(feedback, 'rect', { fill: '#111827' }); append(feedback, 'text')
  const document = { head, body,
    getElementById: (id) => nodes.find((node) => node.id === id && node.isConnected) ?? null,
    createElement: (tag) => new Element(tag),
    querySelectorAll: (selector) => {
      if (selector === 'svg.svg-diagram') return root.isConnected ? [root] : []
      if (selector === 'svg.svg-diagram [data-point-id="p"] [data-point-contour]') return contour.isConnected ? [contour] : []
      return []
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null },
  }
  const context = { document, CSS: { escape: (value) => value }, getComputedStyle: (element) => {
    const installed = head.children.some((node) => node.id.startsWith('stz-'))
    return { visibility: !installed || element === root || element === contour || leaked && feedback.contains(element) ? 'visible' : 'hidden',
      display: 'block', pointerEvents: feedback.contains(element) ? 'none' : 'auto', backgroundColor: installed && element === root ? 'rgb(255, 255, 255)' : 'rgb(240, 240, 240)',
      stroke: 'rgb(0, 0, 0)', strokeWidth: '12px', strokeDasharray: '12px, 0px', strokeDashoffset: '1px', strokeLinecap: 'square',
      strokeLinejoin: 'bevel', strokeOpacity: '1', strokeMiterlimit: '4', fill: 'none', fillOpacity: '1', opacity: '1', filter: 'none', transform: 'none' }
  } }
  const invoke = (action, extra = {}) => runInNewContext(`(${connectedLivePaintIsolationInDocument.toString()})(${JSON.stringify({ action, owner: 'stz-test-isolation', ...extra })})`, context)
  return { invoke, document, root, contour, feedback, sibling, failAppend: () => { failAppend = true }, leak: () => { leaked = true } }
}

test('DOM ownership double records root feedback computed visibility and restores unchanged connected source and styles', () => {
  const fixture = documentDouble(), { invoke, root, contour, sibling } = fixture
  const source = contour.outerHTML, rootStyle = root.getAttribute('style'), siblingStyle = sibling.getAttribute('style')
  const installed = invoke('install')
  assert.equal(installed.valid, true)
  assert.equal(installed.before.feedback.length, 3)
  assert.ok(installed.before.feedback.every((entry) => entry.visibility === 'visible' && !entry.exportExcluded))
  assert.ok(installed.feedback.every((entry) => entry.visibility === 'hidden'))
  assert.equal(installed.pointerEventsUnchanged, true)
  assert.deepEqual(Array.from(installed.visibilityLeaks), [])
  assert.equal(invoke('inspect').valid, true)
  assert.equal(invoke('restore').restored, true)
  assert.equal(contour.outerHTML, source); assert.equal(root.getAttribute('style'), rootStyle); assert.equal(sibling.getAttribute('style'), siblingStyle)
  assert.equal(invoke('restore').alreadyAbsent, true)
})

test('DOM ownership double rejects leaked root tooltip despite zero point-local export assumptions and rolls back failed install', () => {
  const fixture = documentDouble(); fixture.leak()
  assert.throws(() => fixture.invoke('install'), /Live capture isolation invalid:.*svg-selection-cycle-feedback/)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
})

test('DOM ownership double rolls back an append error and leaves original connected source untouched', () => {
  const fixture = documentDouble(), source = fixture.contour.outerHTML
  fixture.failAppend()
  assert.throws(() => fixture.invoke('install'), /append failed after attachment/)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
  assert.equal(fixture.contour.outerHTML, source)
})

test('DOM ownership double refuses ownership/lease collisions and missing contour before mutating presentation', () => {
  const fixture = documentDouble()
  fixture.invoke('install', { lease: 'first' })
  assert.throws(() => fixture.invoke('install'), /already installed/)
  assert.throws(() => fixture.invoke('restore', { lease: 'second' }), /lease collision/)
  assert.ok(fixture.document.getElementById('stz-test-isolation'))
  assert.equal(fixture.invoke('restore', { lease: 'first' }).restored, true)
  const other = fixture.document.createElement('style'); other.id = 'stz-test-isolation'; fixture.document.head.append(other)
  assert.throws(() => fixture.invoke('install'), /ownership collision/)
  assert.throws(() => fixture.invoke('restore'), /ownership collision/)
  assert.equal(other.isConnected, true); other.remove()
  fixture.contour.remove()
  assert.throws(() => fixture.invoke('install'), /one connected intended contour/)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
})

test('DOM ownership double detects later source mutation or newly leaking feedback during inspect', () => {
  const fixture = documentDouble(); fixture.invoke('install')
  fixture.leak(); const leaked = fixture.invoke('inspect')
  assert.equal(leaked.valid, false); assert.ok(leaked.visibilityLeaks.some((entry) => entry.class === 'svg-selection-cycle-feedback'))
  fixture.contour.attributes.set('stroke-width', '13')
  assert.equal(fixture.invoke('inspect').sourceUnchanged, false)
  assert.equal(fixture.invoke('restore').restored, false)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
})

function wrapperFixture(overrides = {}) {
  const calls = [], record = { source: '<polygon/>', ctm: { a: 1, b: 0, c: 0, d: 1, e: 450, f: 350 } }
  const page = { async evaluate(operation, args) { assert.equal(operation, connectedLivePaintIsolationInDocument); calls.push(args.action); return overrides[args.action]?.(args) ?? (args.action === 'restore' ? { restored: true } : { valid: true, source: record.source, ctm: record.ctm }) } }
  let persisted = 0
  const persist = async () => { persisted++; calls.push('persist'); if (overrides.persist) await overrides.persist(persisted) }
  return { page, record, calls, persist, owner: 'stz-test-isolation' }
}

test('capture wrapper persists isolation before clean capture and restores once before returning', async () => {
  const fixture = wrapperFixture()
  const result = await withConnectedLivePaintIsolation(fixture, async () => { fixture.calls.push('capture'); return 42 })
  assert.equal(result, 42)
  assert.deepEqual(fixture.calls, ['install', 'persist', 'capture', 'inspect', 'restore', 'persist'])
  assert.equal(fixture.record.isolationRestoration.restored, true)
})

test('capture wrapper preserves pixel failure through bounded cleanup and persistence errors', async () => {
  const primary = new Error('Live paint mask has an exterior margin'), cleanup = new Error('cleanup failed'), persistence = new Error('persist failed')
  const fixture = wrapperFixture({ restore: () => { throw cleanup }, persist: (count) => { if (count === 2) throw persistence } })
  await assert.rejects(withConnectedLivePaintIsolation(fixture, async () => { throw primary }), (error) => error === primary)
  assert.equal(fixture.record.isolationOperationError.message, primary.message)
  assert.equal(fixture.record.isolationCleanupError.message, cleanup.message)
  assert.equal(fixture.record.isolationPersistenceError.message, persistence.message)
})

test('capture wrapper restores after failed initial evidence persistence without executing capture', async () => {
  const primary = new Error('persist failed'), fixture = wrapperFixture({ persist: (count) => { if (count === 1) throw primary } })
  let captured = false
  await assert.rejects(withConnectedLivePaintIsolation(fixture, async () => { captured = true }), (error) => error === primary)
  assert.equal(captured, false); assert.equal(fixture.record.isolationRestoration.restored, true)
  assert.deepEqual(fixture.calls, ['install', 'persist', 'inspect', 'restore', 'persist'])
})

test('capture wrapper fails successful observation on failed restoration', async () => {
  const fixture = wrapperFixture({ restore: () => ({ restored: false, changedVisibility: ['tooltip'] }) })
  await assert.rejects(withConnectedLivePaintIsolation(fixture, async () => 'captured'), /Owned live capture presentation restored/)
  assert.ok(fixture.record.isolationCleanupError)
})


test('DOM ownership double rejects a crop without complete independent square-cap support', () => {
  const fixture = documentDouble()
  assert.throws(() => fixture.invoke('install', { region: { minX: -19, minY: -19, maxX: 19, maxY: 19 } }), /Live capture isolation invalid:.*"enclosed":false/)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
})

test('capture wrapper retains failing PNG diagnostic and checks source/CTM after observation', async () => {
  const primary = new Error('contaminated boundary pixel'); primary.captureDiagnostic = { boundary: 'right', pixel: { x: 242, y: 174 } }
  const fixture = wrapperFixture()
  await assert.rejects(withConnectedLivePaintIsolation(fixture, async () => { throw primary }), (error) => error === primary)
  assert.deepEqual(fixture.record.isolationOperationError.captureDiagnostic, primary.captureDiagnostic)
  assert.equal(fixture.record.isolationAfter.valid, true)
  assert.equal(fixture.record.isolationRestoration.restored, true)
})

test('capture wrapper refuses a changed isolated transform and still restores', async () => {
  const fixture = wrapperFixture({ inspect: () => ({ valid: true, source: '<polygon/>', ctm: { a: 1, b: 0, c: 0, d: 1, e: 451, f: 350 } }) })
  await assert.rejects(withConnectedLivePaintIsolation(fixture, async () => 'captured'), /CTM unchanged across observation/)
  assert.equal(fixture.record.isolationRestoration.restored, true)
})


test('DOM ownership double rejects changed framing in after-observation and restoration diagnostics', () => {
  const fixture = documentDouble(); fixture.invoke('install')
  fixture.contour.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 451, f: 350 })
  assert.equal(fixture.invoke('inspect').ctmUnchanged, false)
  assert.equal(fixture.invoke('inspect').valid, false)
  assert.equal(fixture.invoke('restore').restored, false)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
})

test('DOM ownership double removes its CSS but reports a changed root inline style', () => {
  const fixture = documentDouble(); fixture.invoke('install')
  fixture.root.attributes.set('style', 'width:901px;height:700px')
  const restored = fixture.invoke('restore')
  assert.equal(restored.rootStyleUnchanged, false)
  assert.equal(restored.restored, false)
  assert.equal(fixture.document.getElementById('stz-test-isolation'), null)
})
