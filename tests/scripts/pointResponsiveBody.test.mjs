import assert from 'node:assert/strict'
import test from 'node:test'
import { assertResponsiveBody, assertResponsiveBackground, createResponsiveBodyBaseline, observeResponsiveBody, responsiveBodyFixture, responsiveBodyStructureInDocument } from '../../scripts/pointResponsiveBody.mjs'

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const properties = { 'font-family': '"Times New Roman", Times, serif', 'font-size': '12px', 'font-weight': '400',
  'font-style': 'normal', 'font-stretch': '100%', 'font-kerning': 'normal', 'letter-spacing': 'normal', 'word-spacing': '0px',
  'white-space': 'pre', 'tab-size': '4', 'text-rendering': 'optimizelegibility', direction: 'ltr', 'text-anchor': 'start', 'dominant-baseline': 'alphabetic' }
const width = 25.986328125, offset = { ...identity, e: -12.9931640625, f: 4 }
const metric = (width) => ({ width, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 0,
  actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, fontBoundingBoxAscent: 11, fontBoundingBoxDescent: 3 })
const treeNode = (name, attributes = [], children = []) => ({ namespace: 'http://www.w3.org/2000/svg', name, attributes, children })
const attribute = (name, value) => ({ namespace: null, name, value })
function fixture() {
  const attributes = { 'font-family': 'Times New Roman, Times, serif', 'font-size': '12', 'font-weight': '400', 'font-style': 'normal',
    'text-anchor': 'start', 'dominant-baseline': 'alphabetic', direction: 'ltr', 'xml:space': 'preserve', x: '0', y: '0',
    style: 'white-space:pre;tab-size:4;font-kerning:normal;text-rendering:optimizeLegibility' }
  const text = treeNode('text', Object.entries(attributes).map(([name, value]) => attribute(name, value)), [{ text: 'Scale' }])
  const contour = treeNode('circle', [attribute('r', '41.507105564650516'), attribute('stroke-width', '24')])
  const body = { attributes: [attribute('transform', 'translate(0 0)')], transform: { ...identity } }
  const saved = { tree: treeNode('svg', [attribute('viewBox', '0 0 520 360')], [contour, text]),
    declaration: { sourceTitles: ['Scale'], body, point: { attributes: [attribute('transform', 'translate(260 180)')], transform: { ...identity, e: 260, f: 180 } },
      rootToPoint: { ...identity, e: 260, f: 180 }, contentTransform: { ...identity },
      foreground: [{ text: 'Scale', attributes, node: text, transform: { ...identity } }],
      ancestors: [treeNode('g', [attribute('transform', 'translate(-12.9931640625 4)')])], contour },
    rootStyle: 'color:#94a3b8;font-family:Inter,Arial,sans-serif;', temporaryRootStyle: null, parserErrors: 0, runtimeAttributes: [] }
  saved.expectedBackground = 'transparent'
  saved.exportBackground = { root: { namespace: saved.tree.namespace, name: saved.tree.name, attributes: structuredClone(saved.tree.attributes) },
    markers: [], rootRectangles: [], stylingElements: [] }
  const baseline = { fixture: responsiveBodyFixture, expectedBackground: 'transparent', saved }
  // Reported parent pair: same declarations and placement, different native boxes.
  const atScale = (scale) => {
    const bounds = scale === .5 ? { x: -12.9931640625, y: -6, width: 26, height: 12 }
      : { x: -12.9931640625, y: -6.5, width: 25.9921875, height: 13 }
    const native = { minX: bounds.x, minY: bounds.y, maxX: bounds.x + bounds.width, maxY: bounds.y + bounds.height }
    const leafBounds = { x: 0, y: bounds.y - offset.f, width: bounds.width, height: bounds.height }
    return { structure: structuredClone(saved), settling: { documentUnchanged: true, initialFontStatus: 'loaded', status: 'loaded', faces: [],
      leaves: [{ text: 'Scale', properties: { ...properties }, readiness: { status: 'loaded', checked: true }, bounds: leafBounds,
        ctm: { a: scale, b: 0, c: 0, d: scale, e: 20 + scale * (260 + offset.e), f: 20 + scale * 184 } }] },
    // Produced by the existing independent observer in native acceptance. This
    // synthetic contract fixture deliberately imports no production layout.
    literal: { source: null, title: 'Scale', request: null, pointRequest: null, sanitized: true, xml: true, math: 0,
      documentUnchanged: true, coordinateContext: { rootToScreen: { a: scale, b: 0, c: 0, d: scale, e: 20, f: 20 },
        bodyToScreen: { a: scale, b: 0, c: 0, d: scale, e: 20 + scale * 260, f: 20 + scale * 180 } }, font: { properties: { ...properties } }, fontReadiness: { status: 'loaded', checked: true, faces: [] },
      canvasConfiguration: { requested: 'normal 400 12px "Times New Roman", Times, serif', effective: '12px "Times New Roman", Times, serif' },
      fontProbe: metric(16), space: metric(3), measurements: [{ text: 'Scale', line: 0, canvas: metric(width) }],
      fragments: [{ text: 'Scale', x: 0, y: 0, baseline: 0, transform: null, matrix: { ...identity },
        bounds: { minX: leafBounds.x, minY: leafBounds.y, maxX: leafBounds.x + leafBounds.width, maxY: leafBounds.y + leafBounds.height },
        font: { ...properties }, xmlSpace: 'preserve', visible: true }], expected: [{ text: 'Scale', x: 0, logicalX: 0, y: 0 }],
      lines: [{ width, baseline: 0, ascent: 11, descent: 3 }], tabs: [], offset: { ...offset },
      extent: { minX: 0, maxX: width, minY: -11, maxY: 3 }, native, bounds: null, measurementClones: 0 },
    measuredBodyBounds: bounds }
  }
  return { baseline, atScale }
}

test('reported native bounds pair with unchanged saved declarations passes 0.5 → 2 → 0.5', () => {
  const { baseline, atScale } = fixture(), small = atScale(.5), large = atScale(2), returned = atScale(.5)
  assert.notDeepEqual(small.measuredBodyBounds, large.measuredBodyBounds)
  assert.deepEqual(small.structure, large.structure)
  for (const observation of [small, large, returned]) assertResponsiveBody(observation, baseline)
  assert.deepEqual(returned.structure, small.structure)
})

for (const [name, mutate, reason] of [
  ['missing observation', (observation) => { delete observation.literal }, /Missing independent literal observation/u],
  ['missing native bounds', (observation) => { delete observation.settling.leaves[0].bounds }, /missing\/nonfinite native bounds/u],
  ['nonfinite native bounds', (observation) => { observation.settling.leaves[0].bounds.width = NaN }, /missing\/nonfinite native bounds/u],
  ['zero native bounds', (observation) => { observation.settling.leaves[0].bounds.height = 0 }, /positive native bounds/u],
  ['nonfinite screen CTM', (observation) => { observation.settling.leaves[0].ctm.a = Infinity }, /finite screen CTM/u],
  ['singular screen CTM', (observation) => { observation.settling.leaves[0].ctm.a = 0 }, /invertible screen CTM/u],
  ['changed source', (observation) => { observation.structure.declaration.sourceTitles = ['Stale'] }, /exact source title/u],
  ['missing visible text', (observation) => { observation.structure.declaration.foreground = [] }, /foreground content\/order/u],
  ['changed foreground', (observation) => { observation.structure.declaration.foreground[0].text = 'Stale' }, /foreground content\/order/u],
  ['hidden native text', (observation) => { observation.literal.fragments[0].visible = false }, /visible whitespace/u],
  ['changed declared font', (observation) => { observation.structure.declaration.foreground[0].attributes['font-family'] = 'Arial' }, /text font family/u],
  ['changed declared size', (observation) => { observation.structure.declaration.foreground[0].attributes['font-size'] = '13' }, /text font-size/u],
  ['changed computed font', (observation) => { observation.settling.leaves[0].properties['font-family'] = 'Arial' }, /text font family/u],
  ['changed computed size', (observation) => { observation.settling.leaves[0].properties['font-size'] = '13px' }, /text font-size/u],
  ['unready font', (observation) => { observation.settling.leaves[0].readiness.checked = false }, /Actual leaf font check/u],
  ['changed baseline', (observation) => { observation.structure.declaration.foreground[0].attributes.y = '1' }, /text y declaration\/baseline/u],
  ['changed baseline mode', (observation) => { observation.structure.declaration.foreground[0].attributes['dominant-baseline'] = 'central' }, /dominant-baseline/u],
  ['displaced body inside circle', (observation) => { observation.structure.declaration.body.transform.e = 1 }, /body local placement/u],
  ['changed text transform', (observation) => { observation.structure.declaration.foreground[0].transform.e = 1 }, /foreground local placement/u],
  ['changed ancestor transform', (observation) => { observation.structure.declaration.ancestors[0].attributes[0].value = 'translate(-11.9931640625 4)' }, /Saved ancestor local placement/u],
  ['changed contour radius', (observation) => { observation.structure.declaration.contour.attributes[0].value = '42' }, /Saved contour geometry/u],
  ['changed root viewBox', (observation) => { observation.structure.tree.attributes[0].value = '0 0 500 360' }, /Saved full-root structure/u],
  ['injected runtime attributes', (observation) => { observation.structure.runtimeAttributes.push({ name: 'data-label-bounds' }) }, /sanitized runtime attributes/u],
  ['corrupt saved root style marker', (observation) => { observation.structure.temporaryRootStyle = 'null' }, /preserves original saved style/u],
  ['missing Canvas metric', (observation) => { delete observation.literal.measurements[0].canvas.width }, /missing\/nonfinite metrics/u],
  ['wrong independent Canvas font', (observation) => { observation.literal.canvasConfiguration.requested = '12px Arial' }, /Independent Canvas uses/u],
  ['missing Canvas source', (observation) => { observation.literal.measurements = [] }, /exact source contract/u],
  ['native observation mutation', (observation) => { observation.literal.documentUnchanged = false }, /positive document unchanged/u],
  ['settling mutation', (observation) => { observation.settling.documentUnchanged = false }, /positive document unchanged/u],
]) test(`responsive saved-body contract rejects ${name}`, () => {
  const { baseline, atScale } = fixture(), observation = atScale(.5)
  mutate(observation)
  assert.throws(() => assertResponsiveBody(observation, baseline), reason)
})

test('wrong source/font/baseline/outer displacement cannot be legitimized by identical baseline and samples', () => {
  for (const mutate of [
    (saved) => { saved.declaration.sourceTitles = ['Stale'] },
    (saved) => { saved.declaration.foreground[0].attributes['font-family'] = 'Arial' },
    (saved) => { saved.declaration.foreground[0].attributes['font-size'] = '13' },
    (saved) => { saved.declaration.foreground[0].attributes.y = '1' },
    (saved) => { saved.declaration.body.transform.e = 1 },
    (saved) => { saved.declaration.point.transform.e = 261 },
    (saved) => { saved.declaration.rootToPoint.e = 261 },
    (saved) => { saved.declaration.contentTransform.e = 1 },
  ]) {
    const { baseline, atScale } = fixture(), observation = atScale(.5)
    mutate(baseline.saved); mutate(observation.structure)
    assert.throws(() => assertResponsiveBody(observation, baseline), /saved file:/u)
  }
})

test('independent centering rejects a saved inner displacement despite contour containment', () => {
  const { baseline, atScale } = fixture(), observation = atScale(.5)
  observation.literal.offset.e += 2
  observation.literal.native.minX += 2; observation.literal.native.maxX += 2
  assert.ok(observation.literal.native.maxX < 41.507105564650516)
  assert.throws(() => assertResponsiveBody(observation, baseline), /centered logical x extent/u)
})

test('existing native line-baseline and logical containment checks remain active', () => {
  const { baseline, atScale } = fixture(), shifted = atScale(2)
  shifted.literal.fragments[0].y = shifted.literal.fragments[0].baseline = 1
  assert.throws(() => assertResponsiveBody(shifted, baseline), /y \(line baseline\)/u)
  const escaped = atScale(2)
  escaped.literal.native.maxY = 9
  assert.throws(() => assertResponsiveBody(escaped, baseline), /native foreground\/logical containment/u)
})

// A minimal DOM adapter exercises snapshot canonicalization only. Native XML
// parsing/measurement is exercised by every real standalone download case.
function structuralRoot({ prefix = '', display = false, font = 'Inter, Arial, sans-serif', childTransform = 'translate(0 0)' } = {}) {
  const namespace = 'http://www.w3.org/2000/svg'
  const style = new Map([['color', 'rgb(148, 163, 184)'], ['font-family', font],
    ...(display ? [['width', '260px'], ['height', '180px'], ['position', 'fixed'], ['border-top-width', '0px']] : [])])
  const element = (localName, attributes, children, values = new Map()) => ({ namespaceURI: namespace, localName, attributes,
    childNodes: children, children, nodeType: 1, style: { [Symbol.iterator]: () => values.keys(),
      getPropertyValue: (key) => values.get(key), getPropertyPriority: () => '' },
    getAttribute: (key) => attributes.find((attribute) => attribute.localName === key)?.value ?? null,
    querySelectorAll: () => [] })
  const rawAttribute = (name, value, namespaceURI = null) => ({ name, localName: name.replace(/^.*:/u, ''), value, namespaceURI })
  const child = element('g', [rawAttribute('transform', childTransform)], [])
  const attrs = [rawAttribute(prefix ? `xmlns:${prefix}` : 'xmlns', namespace, 'http://www.w3.org/2000/xmlns/'),
    rawAttribute('viewBox', '0 0 520 360'), rawAttribute('style', 'serialization may differ')]
  if (display) attrs.push(rawAttribute('data-responsive-original-style', '"original"'))
  const root = element('svg', attrs.reverse(), [child], style)
  root.querySelectorAll = (selector) => selector === '*' ? [child] : []
  return { documentElement: root, querySelectorAll: () => [] }
}

test('namespace/attribute/CSS ordering normalize while only controlled root display styles vary', () => {
  const original = globalThis.document
  try {
    globalThis.document = structuralRoot()
    const saved = responsiveBodyStructureInDocument()
    globalThis.document = structuralRoot({ prefix: 'svg', display: true })
    assert.deepEqual(responsiveBodyStructureInDocument().tree, saved.tree)
    globalThis.document = structuralRoot({ font: 'Arial' })
    assert.notDeepEqual(responsiveBodyStructureInDocument().tree, saved.tree)
    globalThis.document = structuralRoot({ childTransform: 'translate(1 0)' })
    assert.notDeepEqual(responsiveBodyStructureInDocument().tree, saved.tree)
  } finally {
    if (original === undefined) delete globalThis.document
    else globalThis.document = original
  }
})

test('font rendering remains a verified part of the independent fixture contract', () => {
  const { baseline, atScale } = fixture(), observation = atScale(.5)
  observation.settling.leaves[0].properties['text-rendering'] = 'geometricprecision'
  assert.throws(() => assertResponsiveBody(observation, baseline), /text rendering/u)
})

function controlPage({ cleanupError } = {}) {
  const { baseline, atScale } = fixture()
  let current = atScale(.5), mutated = false, restorations = 0
  const context = { canvas: { namespaceURI: 'http://www.w3.org/1999/xhtml', localName: 'canvas', htmlCanvasElement: true,
    ownerDocumentMatches: true, isConnected: false, parentNodePresent: false, getContext: 'function', context2dAvailable: true, measureText: 'function' },
  bodyFound: true, url: 'file:///responsive.svg', contentType: 'image/svg+xml', root: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' }, body: null }
  const page = { async evaluate(fn, argument) {
    if (typeof argument === 'string') {
      mutated = true
      if (argument === 'text-mutation') current.structure.declaration.foreground[0].text = 'Stale'
      if (argument === 'body-displacement') current.structure.declaration.body.transform.e = 1
      if (argument === 'font-change') current.structure.declaration.foreground[0].attributes['font-family'] = 'monospace'
      return { text: 'Scale', family: responsiveBodyFixture.family, transform: 'translate(0 0)' }
    }
    if (argument?.family) {
      restorations++
      if (cleanupError) throw cleanupError
      mutated = false; current = atScale(.5)
      return
    }
    if (argument?.mode === 'context') return context
    if (argument?.mode === 'metrics') return { point: structuredClone(current.literal), documentUnchanged: true }
    if (fn === responsiveBodyStructureInDocument) return structuredClone(current.structure)
    if (fn.toString().includes('initialFontStatus')) return structuredClone(current.settling)
    if (fn.toString().includes('serializeToString(document)')) return mutated ? 'changed-document' : 'original-document'
    throw new Error('Unexpected control-page evaluation')
  } }
  return { page, baseline, restored: () => !mutated, restorations: () => restorations }
}

test('native negative controls persist intended rejection and exact restoration for every kind', async () => {
  const { responsiveBodyNegativeControls } = await import('../../scripts/pointResponsiveBody.mjs')
  const mock = controlPage(), records = []
  const results = await responsiveBodyNegativeControls(mock.page, mock.baseline, async (record) => records.push(record))
  assert.deepEqual(results.map(({ kind, rejected, documentUnchanged }) => ({ kind, rejected, documentUnchanged })),
    ['text-mutation', 'body-displacement', 'font-change'].map((kind) => ({ kind, rejected: true, documentUnchanged: true })))
  assert.match(results[0].reason, /foreground content\/order/u)
  assert.match(results[1].reason, /body local placement/u)
  assert.match(results[2].reason, /text font family/u)
  assert.equal(mock.restored(), true)
  assert.equal(mock.restorations(), 3)
  assert.equal(records.filter(({ boundary }) => boundary === 'responsive-body-control-cleanup').length, 3)
  assert.ok(records.some(({ boundary }) => boundary === 'responsive-body-controls-restored'))
})

test('native negative control restores DOM when observation diagnostics fail', async () => {
  const { responsiveBodyNegativeControls } = await import('../../scripts/pointResponsiveBody.mjs')
  const mock = controlPage(), primary = new Error('primary evidence failure')
  await assert.rejects(responsiveBodyNegativeControls(mock.page, mock.baseline, async (record) => {
    if (record.boundary === 'responsive-body-before-literal-metrics') throw primary
  }), (error) => error === primary)
  assert.equal(mock.restored(), true)
  assert.equal(mock.restorations(), 1)
})

test('native control cleanup failures remain failures without masking a primary error', async () => {
  const { responsiveBodyNegativeControls } = await import('../../scripts/pointResponsiveBody.mjs')
  const cleanupError = new Error('cleanup failed'), primary = new Error('observation failed')
  const first = controlPage({ cleanupError })
  await assert.rejects(responsiveBodyNegativeControls(first.page, first.baseline), (error) => error === cleanupError)
  const second = controlPage({ cleanupError })
  await assert.rejects(responsiveBodyNegativeControls(second.page, second.baseline, async () => { throw primary }), (error) => error === primary)
  assert.equal(first.restorations(), 1)
  assert.equal(second.restorations(), 1)
})

test('same saved/displayed CSS ancestor displacement fails independent native root-relative placement', () => {
  const { baseline, atScale } = fixture(), observation = atScale(.5)
  const css = attribute('style', [['transform', 'translate(1px, 0px)', '']])
  baseline.saved.declaration.ancestors[0].attributes.push(css)
  observation.structure.declaration.ancestors[0].attributes.push(structuredClone(css))
  observation.literal.coordinateContext.bodyToScreen.e += .5
  assert.throws(() => assertResponsiveBody(observation, baseline), /Independent native body placement e/u)
})

const svgNamespace = 'http://www.w3.org/2000/svg'
const backgroundMarker = 'data-stratified-tikz-export-background'

// Faithful DOM of the parent-run downloaded SVG, independently copied from its
// XML structure. No sanitizer, production export helper, or precomputed metadata
// list supplies the expected result. Only native font/paint metrics stay mocked.
class BackgroundFixtureElement {
  constructor(localName, values = {}, children = [], namespaceURI = svgNamespace) {
    this.localName = localName
    this.namespaceURI = namespaceURI
    this.nodeType = 1
    this.attributes = []
    this.childNodes = []
    this.parentElement = null
    for (const [name, value] of Object.entries(values)) this.setAttribute(name, value)
    for (const child of children) this.append(child)
  }
  get children() { return this.childNodes.filter(({ nodeType }) => nodeType === 1) }
  get textContent() { return this.childNodes.map(({ textContent }) => textContent).join('') }
  get style() {
    const values = new Map((this.getAttribute('style') ?? '').split(';').filter(Boolean).map((entry) => {
      const split = entry.indexOf(':')
      return [entry.slice(0, split).trim(), entry.slice(split + 1).trim()]
    }))
    return { [Symbol.iterator]: () => values.keys(), getPropertyValue: (name) => values.get(name) ?? '', getPropertyPriority: () => '' }
  }
  get transform() {
    const source = this.getAttribute('transform')
    const translate = source?.match(/^translate\(([-\d.]+)[ ,]+([-\d.]+)\)$/u)
    return { baseVal: source ? [{ matrix: { ...identity, e: Number(translate?.[1]), f: Number(translate?.[2]) } }] : [] }
  }
  getAttribute(name) { return this.attributes.find((entry) => entry.name === name)?.value ?? null }
  setAttribute(name, value) { this.setAttributeNS(name.startsWith('xml:') ? 'http://www.w3.org/XML/1998/namespace' : null, name, value) }
  setAttributeNS(namespaceURI, name, value) {
    this.removeAttribute(name)
    this.attributes.push({ namespaceURI, name, localName: name.replace(/^.*:/u, ''), value: String(value) })
  }
  removeAttribute(name) { this.attributes = this.attributes.filter((entry) => entry.name !== name) }
  append(child) {
    child.remove?.()
    child.parentElement = this
    this.childNodes.push(child)
    return child
  }
  prepend(child) {
    this.append(child)
    this.childNodes.unshift(this.childNodes.pop())
    return child
  }
  remove() {
    if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter((child) => child !== this)
    this.parentElement = null
  }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')])
    if (selector === '*') return descendants
    if (selector === 'g > title') return descendants.filter((child) => child.localName === 'title' && child.parentElement.localName === 'g')
    return descendants.filter((child) => child.localName === selector)
  }
}

class BackgroundFixtureMatrix {
  constructor(values = [1, 0, 0, 1, 0, 0]) { Object.assign(this, Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => [key, values[index]]))) }
  multiply(other) {
    return new BackgroundFixtureMatrix([this.a * other.a + this.c * other.b, this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d, this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e, this.b * other.e + this.d * other.f + this.f])
  }
}

function backgroundDom({ mode = 'white', viewBox = '0 0 520 360', display = false } = {}) {
  const element = (name, values, children) => new BackgroundFixtureElement(name, values, children)
  const textNode = (textContent) => ({ nodeType: 3, textContent })
  const text = element('text', { 'font-family': responsiveBodyFixture.family, 'font-size': '12', 'font-weight': '400', 'font-style': 'normal',
    'text-anchor': 'start', 'dominant-baseline': 'alphabetic', direction: 'ltr', 'xml:space': 'preserve',
    style: 'white-space:pre;tab-size:4;font-kerning:normal;text-rendering:optimizeLegibility', fill: '#000000', x: '0', y: '0' }, [textNode('Scale')])
  const content = element('g', {}, [text])
  const body = element('g', { transform: 'translate(0 0)' }, [element('title', {}, [textNode('Scale')]),
    element('g', { transform: 'translate(-12.9931640625 4)', opacity: '1', fill: '#000000', color: '#000000', 'pointer-events': 'none' }, [content])])
  const point = element('g', { transform: 'translate(260 180)' }, [element('circle', { fill: '#cceeff', 'fill-opacity': '1', stroke: '#cc0000',
    'stroke-opacity': '1', 'stroke-width': '24', 'stroke-dashoffset': '0', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter',
    'stroke-miterlimit': '10', r: '41.507105564650516' }), body])
  const style = 'color:#94a3b8;font-family:Inter,Arial,sans-serif;'
  const root = element('svg', { viewBox, preserveAspectRatio: 'xMidYMid meet', version: '1.1', style,
    width: '520', height: '360' }, [element('g', {}, [element('g', {}, [point])])])
  root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', svgNamespace)
  const [x, y, width, height] = viewBox.split(/[ ,]+/u)
  const background = element('rect', { x, y, width, height, fill: '#ffffff', [backgroundMarker]: 'white' })
  if (mode === 'white') root.prepend(background)
  if (display) {
    root.setAttribute('data-responsive-original-style', JSON.stringify(style))
    root.setAttribute('style', `${style}position:fixed;left:20px;top:20px;width:1040px;height:720px;`)
  }
  return { root, background, point, text, content, element,
    documentElement: root, querySelectorAll: (selector) => root.querySelectorAll(selector) }
}

function collectedBackground(dom, background, { parsed = false } = {}) {
  const original = Object.fromEntries(['document', 'DOMMatrix', 'DOMParser'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    globalThis.document = dom
    globalThis.DOMMatrix = BackgroundFixtureMatrix
    globalThis.DOMParser = class { parseFromString(xml, type) {
      assert.equal(xml, 'faithful downloaded DOM fixture')
      assert.equal(type, 'image/svg+xml')
      return dom
    } }
    return responsiveBodyStructureInDocument({ background, ...(parsed ? { xml: 'faithful downloaded DOM fixture' } : {}) })
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

function bodyFromCollected(snapshot, background) {
  const result = fixture(), nativeAtScale = result.atScale
  result.baseline.expectedBackground = background
  result.baseline.saved = structuredClone(snapshot)
  result.atScale = (scale) => ({ ...nativeAtScale(scale), structure: structuredClone(snapshot) })
  return result
}

for (const background of ['transparent', 'white']) test(`collected ${background} export passes independent body/background checks at 0.5 → 2 → 0.5`, () => {
  const saved = collectedBackground(backgroundDom({ mode: background }), background, { parsed: true })
  const displayed = collectedBackground(backgroundDom({ mode: background, display: true }), background)
  assert.equal(saved.expectedBackground, background)
  assert.deepEqual(saved.runtimeAttributes, [])
  assert.equal(saved.exportBackground.markers.length, background === 'white' ? 1 : 0)
  assert.deepEqual(saved.tree, displayed.tree)
  const { baseline, atScale } = bodyFromCollected(saved, background)
  for (const scale of [.5, 2, .5]) assertResponsiveBody({ ...atScale(scale), structure: displayed }, baseline)
  if (background === 'white') {
    const marker = saved.exportBackground.markers[0]
    assert.deepEqual(marker.attribute, attribute(backgroundMarker, 'white'))
    assert.equal(marker.directRootChild, true)
    assert.equal(marker.elementIndex, 0)
    assert.equal(marker.node.namespace, svgNamespace)
    assert.deepEqual(saved.tree.children[0], marker.node)
    assert.equal(marker.node.attributes.find(({ name }) => name === backgroundMarker).value, 'white')
  }
})

test('background geometry uses nonzero local viewBox bounds independently of CSS screenshot dimensions', () => {
  for (const display of [false, true]) {
    const snapshot = collectedBackground(backgroundDom({ viewBox: '-12.5 8 520.25 360.5', display }), 'white')
    assertResponsiveBackground(snapshot, 'white', 'fixture')
    assert.deepEqual(snapshot.exportBackground.markers[0].node.attributes.filter(({ name }) => ['x', 'y', 'width', 'height'].includes(name)),
      [attribute('height', '360.5'), attribute('width', '520.25'), attribute('x', '-12.5'), attribute('y', '8')])
  }
})

test('ordinary white-filled point and diagram content remain valid in transparent exports', () => {
  const dom = backgroundDom({ mode: 'transparent' })
  dom.point.children[0].setAttribute('fill', '#ffffff')
  dom.root.append(dom.element('rect', { x: '30', y: '40', width: '15', height: '20', fill: '#ffffff' }))
  const snapshot = collectedBackground(dom, 'transparent'), { baseline, atScale } = bodyFromCollected(snapshot, 'transparent')
  assertResponsiveBody(atScale(.5), baseline)
  assert.deepEqual(snapshot.exportBackground.markers, [])
  assert.deepEqual(snapshot.runtimeAttributes, [])
})

const backgroundCorruptions = [
  ['missing marker', ({ background }) => background.removeAttribute(backgroundMarker)],
  ['missing rectangle', ({ background }) => background.remove()],
  ['duplicate marker', ({ root, element }) => root.append(element('rect', { x: '0', y: '0', width: '520', height: '360', fill: '#ffffff', [backgroundMarker]: 'white' }))],
  ['wrong marker value', ({ background }) => background.setAttribute(backgroundMarker, 'transparent')],
  ['wrong marker case', ({ background }) => background.setAttribute(backgroundMarker, 'White')],
  ['wrong marker element', ({ background }) => { background.localName = 'circle' }],
  ['wrong element namespace', ({ background }) => { background.namespaceURI = 'http://www.w3.org/1999/xhtml' }],
  ['null element namespace', ({ background }) => { background.namespaceURI = null }],
  ['namespaced marker', ({ background }) => { background.removeAttribute(backgroundMarker); background.setAttributeNS('urn:unexpected', `bad:${backgroundMarker}`, 'white') }],
  ['namespaced x coordinate', ({ background }) => { background.removeAttribute('x'); background.setAttributeNS('urn:unexpected', 'bad:x', '0') }],
  ['nested marker', ({ content, background }) => content.append(background)],
  ['marker on root', ({ root, background }) => { background.removeAttribute(backgroundMarker); root.setAttribute(backgroundMarker, 'white') }],
  ['background after drawing', ({ root, background }) => root.append(background)],
  ['background preceded by defs', ({ root, element }) => root.prepend(element('defs'))],
  ['wrong x', ({ background }) => background.setAttribute('x', '1')],
  ['wrong y', ({ background }) => background.setAttribute('y', '-1')],
  ['wrong width', ({ background }) => background.setAttribute('width', '1040')],
  ['wrong height', ({ background }) => background.setAttribute('height', '720')],
  ['nonfinite width', ({ background }) => background.setAttribute('width', 'NaN')],
  ['percentage width', ({ background }) => background.setAttribute('width', '100%')],
  ['missing fill', ({ background }) => background.removeAttribute('fill')],
  ['wrong fill', ({ background }) => background.setAttribute('fill', '#000000')],
  ['transparent fill', ({ background }) => background.setAttribute('fill', 'none')],
  ['background fill opacity', ({ background }) => background.setAttribute('fill-opacity', '0')],
  ['background opacity', ({ background }) => background.setAttribute('opacity', '0')],
  ['background visibility', ({ background }) => background.setAttribute('visibility', 'hidden')],
  ['background display', ({ background }) => background.setAttribute('display', 'none')],
  ['background CSS override', ({ background }) => background.setAttribute('style', 'fill:black')],
  ['background transform', ({ background }) => background.setAttribute('transform', 'translate(1 0)')],
  ['background CSS transform', ({ background }) => background.setAttribute('style', 'transform:translate(1px,0px)')],
  ['background clipping', ({ background }) => background.setAttribute('clip-path', 'url(#hidden)')],
  ['background masking', ({ background }) => background.setAttribute('mask', 'url(#hidden)')],
  ['background rounded corners', ({ background }) => background.setAttribute('rx', '10')],
  ['background child animation', ({ background, element }) => background.append(element('animate', { attributeName: 'fill', to: 'black' }))],
  ['root fill opacity', ({ root }) => root.setAttribute('fill-opacity', '0')],
  ['root opacity', ({ root }) => root.setAttribute('opacity', '0')],
  ['root visibility', ({ root }) => root.setAttribute('visibility', 'hidden')],
  ['root transform', ({ root }) => root.setAttribute('transform', 'translate(1 0)')],
  ['root CSS opacity', ({ root }) => root.setAttribute('style', 'opacity:0')],
  ['root CSS transform', ({ root }) => root.setAttribute('style', 'transform:translate(1px,0px)')],
  ['global background stylesheet', ({ root, element }) => root.append(element('style', {}, [{ nodeType: 3, textContent: 'rect { fill:black }' }]))],
  ['global paint animation', ({ root, element }) => root.append(element('animate', { attributeName: 'opacity', to: '0' }))],
]

for (const [name, mutate] of backgroundCorruptions) test(`collection-boundary background contract rejects ${name}, including identical invalid baseline/sample`, () => {
  const dom = backgroundDom()
  mutate(dom)
  const snapshot = collectedBackground(dom, 'white')
  assert.throws(() => assertResponsiveBackground(snapshot, 'white', 'saved file'), /background/iu)
  const { baseline, atScale } = bodyFromCollected(snapshot, 'white')
  assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /saved file:.*background/iu)
  const valid = bodyFromCollected(collectedBackground(backgroundDom(), 'white'), 'white')
  const observation = valid.atScale(.5)
  observation.structure = snapshot
  assert.throws(() => assertResponsiveBody(observation, valid.baseline), /displayed file:.*background/iu)
})

for (const [name, background, mode] of [['white marker in transparent mode', 'transparent', 'white'], ['transparent file in white mode', 'white', 'transparent']]) {
  test(`expected mode comes from the test case: rejects ${name}`, () => {
    const snapshot = collectedBackground(backgroundDom({ mode }), background)
    assert.equal(snapshot.expectedBackground, background)
    const { baseline, atScale } = bodyFromCollected(snapshot, background)
    assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /saved file:.*background/iu)
  })
}

test('transparent mode rejects an unmarked full-viewBox export background', () => {
  const dom = backgroundDom()
  dom.background.removeAttribute(backgroundMarker)
  const snapshot = collectedBackground(dom, 'transparent')
  assert.deepEqual(snapshot.exportBackground.markers, [])
  assert.deepEqual(snapshot.runtimeAttributes, [])
  const { baseline, atScale } = bodyFromCollected(snapshot, 'transparent')
  assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /saved file:.*background/iu)
})

for (const target of ['background', 'text']) for (const namespaced of [false, true]) {
  test(`collection retains unrelated ${namespaced ? 'namespaced ' : ''}runtime data on ${target}`, () => {
    const dom = backgroundDom(), name = 'data-label-request'
    if (namespaced) dom[target].setAttributeNS('urn:unexpected', `bad:${name}`, 'stale')
    else dom[target].setAttribute(name, 'stale')
    const snapshot = collectedBackground(dom, 'white')
    assert.equal(snapshot.exportBackground.markers.length, 1)
    assert.equal(snapshot.runtimeAttributes.length, 1)
    assert.ok(snapshot.runtimeAttributes[0].name.endsWith(name))
    const { baseline, atScale } = bodyFromCollected(snapshot, 'white')
    assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /saved file: sanitized runtime attributes/u)
  })
}

test('background mode must be explicit in baseline and cannot change across observations', () => {
  const snapshot = collectedBackground(backgroundDom(), 'white'), { baseline, atScale } = bodyFromCollected(snapshot, 'white')
  delete baseline.expectedBackground
  assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /background/iu)
  baseline.expectedBackground = 'white'
  const observation = atScale(2)
  observation.structure.expectedBackground = 'transparent'
  assert.throws(() => assertResponsiveBody(observation, baseline), /background/iu)
  baseline.expectedBackground = snapshot.expectedBackground = 'invalid'
  assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /background/iu)
})

test('changing a still-valid background declaration between scales fails full-root comparison', () => {
  const snapshot = collectedBackground(backgroundDom(), 'white'), { baseline, atScale } = bodyFromCollected(snapshot, 'white')
  const dom = backgroundDom()
  dom.background.setAttribute('x', '0.0')
  const changed = collectedBackground(dom, 'white')
  assertResponsiveBackground(changed, 'white', 'displayed file')
  assert.notDeepEqual(snapshot.tree.children[0], changed.tree.children[0])
  assertResponsiveBody(atScale(.5), baseline)
  assert.throws(() => assertResponsiveBody({ ...atScale(2), structure: changed }, baseline), /Saved full-root structure/u)
  assertResponsiveBody(atScale(.5), baseline)
})

test('removing a valid background at a later scale fails the independent declaration check', () => {
  const snapshot = collectedBackground(backgroundDom(), 'white'), { baseline, atScale } = bodyFromCollected(snapshot, 'white')
  assertResponsiveBody(atScale(.5), baseline)
  const removed = collectedBackground(backgroundDom({ mode: 'transparent' }), 'white')
  assert.notDeepEqual(removed.tree, snapshot.tree)
  assert.throws(() => assertResponsiveBody({ ...atScale(2), structure: removed }, baseline), /displayed file:.*background/iu)
})

for (const background of ['transparent', 'white']) test(`baseline/observation callers persist explicit ${background} mode before assertions`, async () => {
  const snapshot = collectedBackground(backgroundDom({ mode: background }), background), calls = []
  const baseline = await createResponsiveBodyBaseline({ async evaluate(fn, input) {
    assert.equal(fn, responsiveBodyStructureInDocument)
    calls.push(input)
    return structuredClone(snapshot)
  } }, '<unchanged downloaded SVG bytes>', background)
  assert.deepEqual(calls, [{ xml: '<unchanged downloaded SVG bytes>', background }])
  assert.equal(baseline.expectedBackground, background)
  assert.deepEqual(baseline.saved.exportBackground, snapshot.exportBackground)
  const mock = controlPage(), records = []
  const observation = await observeResponsiveBody({ async evaluate(fn, input) {
    if (fn === responsiveBodyStructureInDocument) {
      assert.deepEqual(input, { background })
      return structuredClone(snapshot)
    }
    return mock.page.evaluate(fn, input)
  } }, { background, diagnose: async (record) => records.push(record) })
  assert.equal(records[0].boundary, 'responsive-body-before-settling')
  assert.equal(records[0].structure.expectedBackground, background)
  assert.deepEqual(records[0].structure.exportBackground, snapshot.exportBackground)
  assertResponsiveBody(observation, baseline)
})

test('temporary root-style bookkeeping exemption applies only to its exact owned root attribute', () => {
  for (const inject of [
    ({ root }) => root.setAttributeNS('urn:unexpected', 'bad:data-responsive-original-style', 'null'),
    ({ background }) => background.setAttribute('data-responsive-original-style', 'null'),
  ]) {
    const dom = backgroundDom()
    inject(dom)
    const snapshot = collectedBackground(dom, 'white')
    assert.equal(snapshot.runtimeAttributes.length, 1)
    const { baseline, atScale } = bodyFromCollected(snapshot, 'white')
    assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /sanitized runtime attributes/u)
  }
})

test('foreign-namespace background without a CSS style object preserves raw diagnostics before rejection', () => {
  const dom = backgroundDom()
  dom.background.namespaceURI = 'urn:foreign'
  dom.background.setAttribute('style', 'fill:black')
  Object.defineProperty(dom.background, 'style', { value: undefined })
  const snapshot = collectedBackground(dom, 'white')
  assert.deepEqual(snapshot.exportBackground.markers[0].node.attributes.find(({ name }) => name === 'style'), attribute('style', 'fill:black'))
  assert.equal(snapshot.exportBackground.markers[0].node.namespace, 'urn:foreign')
  assert.deepEqual(snapshot.runtimeAttributes, [])
  const { baseline, atScale } = bodyFromCollected(snapshot, 'white')
  assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /saved file: background rect SVG namespace/u)
})

test('transparent mode preserves ordinary full-viewBox white diagram rectangles with drawing attributes', () => {
  const dom = backgroundDom({ mode: 'transparent' })
  dom.root.append(dom.element('rect', { x: '0', y: '0', width: '520', height: '360', fill: '#ffffff', stroke: '#000000' }))
  const snapshot = collectedBackground(dom, 'transparent')
  assert.equal(snapshot.exportBackground.rootRectangles.length, 1)
  assert.deepEqual(snapshot.exportBackground.markers, [])
  const { baseline, atScale } = bodyFromCollected(snapshot, 'transparent')
  assertResponsiveBody(atScale(.5), baseline)
})

test('white mode rejects a second plain export rectangle even when its marker is missing', () => {
  const dom = backgroundDom()
  dom.root.append(dom.element('rect', { x: '0', y: '0', width: '520', height: '360', fill: '#ffffff' }))
  const snapshot = collectedBackground(dom, 'white')
  assert.equal(snapshot.exportBackground.markers.length, 1)
  assert.equal(snapshot.exportBackground.rootRectangles.length, 2)
  assert.deepEqual(snapshot.runtimeAttributes, [])
  const { baseline, atScale } = bodyFromCollected(snapshot, 'white')
  assert.throws(() => assertResponsiveBody(atScale(.5), baseline), /saved file: exactly one export background rectangle/u)
})
