import assert from 'node:assert/strict'
import test from 'node:test'
import { assertResponsiveBody, responsiveBodyFixture, responsiveBodyStructureInDocument } from '../../scripts/pointResponsiveBody.mjs'

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
  const baseline = { fixture: responsiveBodyFixture, saved }
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
