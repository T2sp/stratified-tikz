import assert from 'node:assert/strict'
import test from 'node:test'
import { createOracleCanvas, inspectOracleDocumentContext } from '../../scripts/fixtures/labelBrowserOracle.ts'

const xhtml = 'http://www.w3.org/1999/xhtml'
type CanvasDouble = {
  localName: string; namespaceURI: string | null; ownerDocument: Document | null
  isConnected: boolean; parentNode: object | null
  getContext?: ((kind: string, options?: CanvasRenderingContext2DSettings) => CanvasRenderingContext2D | null) | string
}

/** These controlled DOM-boundary doubles test dispatch, capability errors and
 * diagnostics, not native interfaces or fonts. The browser harness must also
 * run this observer in the live App and a saved, top-level file:// SVG. */
function fixture() {
  const calls: { namespace: string; name: string }[] = []
  const contextCalls: { receiver: CanvasDouble; kind: string; options?: CanvasRenderingContext2DSettings }[] = []
  const context = { measureText: () => ({ width: 7 }) } as unknown as CanvasRenderingContext2D
  const canvas: CanvasDouble = { localName: 'canvas', namespaceURI: xhtml, ownerDocument: null,
    isConnected: false, parentNode: null, getContext(kind, options) {
      contextCalls.push({ receiver: this, kind, options })
      return context
    } }
  const owner = {
    URL: 'file:///fixture.svg', contentType: 'image/svg+xml', defaultView: null, body: null, fonts: undefined,
    documentElement: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg', isConnected: true, parentNode: {} },
    createElement() { throw new Error('HTML-assuming creation must not be used for measurements') },
    createElementNS(namespace: string, name: string) { calls.push({ namespace, name }); return canvas },
  } as unknown as Document
  canvas.ownerDocument = owner
  const node = { ownerDocument: owner, localName: 'g', namespaceURI: 'http://www.w3.org/2000/svg',
    isConnected: true, parentNode: {}, querySelector: () => null } as unknown as Element
  return { canvas, context, node, owner, calls, contextCalls }
}

test('Canvas creation uses the observed owner document and XHTML namespace, stays detached and returns a usable 2D context', () => {
  const f = fixture()
  const { canvas, context } = createOracleCanvas(f.node)
  assert.equal(canvas, f.canvas)
  assert.equal(canvas.ownerDocument, f.owner)
  assert.equal(canvas.namespaceURI, xhtml)
  assert.equal(canvas.isConnected, false)
  assert.equal(canvas.parentNode, null)
  assert.equal(context, f.context)
  assert.equal(context.measureText('Mg').width, 7)
  assert.deepEqual(f.calls, [{ namespace: xhtml, name: 'canvas' }])
  assert.deepEqual(f.contextCalls, [{ receiver: f.canvas, kind: '2d', options: undefined }])
})

test('raster Canvas creation preserves the same document boundary and context options', () => {
  const f = fixture(), options = { willReadFrequently: true }
  createOracleCanvas(f.node, options)
  assert.equal(f.contextCalls[0].options, options)
  assert.equal(f.contextCalls[0].receiver, f.canvas)
  assert.equal(f.contextCalls[0].kind, '2d')
})

for (const [name, mutate, error] of [
  ['wrong namespace', (canvas: CanvasDouble) => { canvas.namespaceURI = null }, /XHTML canvas/],
  ['wrong local name', (canvas: CanvasDouble) => { canvas.localName = 'svg' }, /XHTML canvas/],
  ['wrong owner', (canvas: CanvasDouble) => { canvas.ownerDocument = {} as Document }, /wrong owner document/],
  ['connected Canvas', (canvas: CanvasDouble) => { canvas.isConnected = true }, /must remain detached/],
  ['parented Canvas', (canvas: CanvasDouble) => { canvas.parentNode = {} }, /must remain detached/],
  ['missing getContext', (canvas: CanvasDouble) => { delete canvas.getContext }, /getContext capability unavailable/],
  ['noncallable getContext', (canvas: CanvasDouble) => { canvas.getContext = 'unavailable' }, /getContext capability unavailable/],
] as const) {
  test(`Canvas boundary rejects ${name} before any context call`, () => {
    const f = fixture(); mutate(f.canvas)
    assert.throws(() => createOracleCanvas(f.node), error)
    assert.equal(f.contextCalls.length, 0)
  })
}

test('Canvas boundary reports an unavailable 2D context instead of fabricating metrics', () => {
  const f = fixture(); f.canvas.getContext = () => null
  assert.throws(() => createOracleCanvas(f.node), /Oracle Canvas 2D context unavailable/)
})

test('Canvas boundary reports a missing measureText capability', () => {
  const f = fixture(); f.canvas.getContext = () => ({} as CanvasRenderingContext2D)
  assert.throws(() => createOracleCanvas(f.node), /2D measureText capability unavailable/)
})

test('native context creation errors retain the original error', () => {
  const f = fixture(), failure = new Error('native context refused')
  f.canvas.getContext = () => { throw failure }
  assert.throws(() => createOracleCanvas(f.node), (error: unknown) => error === failure)
})

test('document diagnostics retain XML/legacy Canvas differences without connecting either Canvas', () => {
  const f = fixture()
  const legacy = { ...f.canvas, namespaceURI: null }; delete legacy.getContext
  f.owner.createElement = (() => legacy) as unknown as Document['createElement']
  const observed = inspectOracleDocumentContext(f.node)
  assert.equal(observed.url, 'file:///fixture.svg')
  assert.equal(observed.contentType, 'image/svg+xml')
  assert.equal(observed.root?.localName, 'svg')
  assert.equal(observed.root?.namespaceURI, 'http://www.w3.org/2000/svg')
  assert.equal(observed.body, null)
  assert.equal(observed.fonts, null)
  assert.ok('namespaceURI' in observed.legacyCanvas)
  assert.equal(observed.legacyCanvas.namespaceURI, null)
  assert.equal(observed.legacyCanvas.getContext, 'undefined')
  assert.equal(observed.legacyCanvas.context2dAvailable, false)
  assert.ok('namespaceURI' in observed.canvas)
  assert.equal(observed.canvas.namespaceURI, xhtml)
  assert.equal(observed.canvas.ownerDocumentMatches, true)
  assert.equal(observed.canvas.isConnected, false)
  assert.equal(observed.canvas.parentNodePresent, false)
  assert.equal(observed.canvas.context2dAvailable, true)
  assert.equal(observed.canvas.measureText, 'function')
  assert.equal(observed.canvas.error, null)
  assert.equal(f.canvas.isConnected, false)
  assert.equal(f.canvas.parentNode, null)
  assert.equal(legacy.parentNode, null)
})

test('document diagnostics retain unavailable Canvas capability and context errors', () => {
  for (const unavailable of [undefined, () => null]) {
    const f = fixture(); f.canvas.getContext = unavailable
    const observed = inspectOracleDocumentContext(f.node)
    assert.ok('error' in observed.canvas)
    assert.equal(observed.canvas.context2dAvailable, false)
    assert.match(observed.canvas.error ?? '', /Oracle Canvas (getContext capability|2D context) unavailable/)
    assert.ok('creationError' in observed.legacyCanvas)
    assert.match(observed.legacyCanvas.creationError ?? '', /HTML-assuming creation/)
  }
})

test('document diagnostics record a native getContext failure instead of replacing it with a diagnostic exception', () => {
  const f = fixture(); f.canvas.getContext = () => { throw new Error('native failure') }
  const observed = inspectOracleDocumentContext(f.node)
  assert.ok('error' in observed.canvas)
  assert.equal(observed.canvas.context2dAvailable, false)
  assert.equal(observed.canvas.error, 'Error: native failure')
})
