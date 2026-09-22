import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPointExportCompatibility } from '../../scripts/pointExportReference.mjs'

function fixture(source = 'native body') {
  const properties = { 'font-family': '"Times New Roman", Times, serif', 'font-size': '12px',
    'font-style': 'normal', 'font-weight': '400', 'font-stretch': '100%', 'font-kerning': 'normal',
    'letter-spacing': 'normal', 'word-spacing': '0px', 'text-rendering': 'optimizelegibility', 'tab-size': '4' }
  const metric = (text) => ({ width: text.length * 3, actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 3,
    fontBoundingBoxAscent: 11, fontBoundingBoxDescent: 3 })
  const observation = { font: { properties }, canvasConfiguration: {
    requested: 'normal 400 12px "Times New Roman", Times, serif', effective: '12px "Times New Roman", Times, serif',
    textAlign: 'left', textBaseline: 'alphabetic', direction: 'ltr', fontKerning: 'normal',
    textRendering: 'optimizeLegibility', fontStretch: 'normal', letterSpacing: '0px', wordSpacing: '0px',
  }, fontReadiness: { status: 'loaded', checked: true, faces: [] }, fontProbe: metric('Mg'), space: metric(' '),
  measurements: source.split(/\r\n|[\r\n]/u).flatMap((line, index) => line.split('\t').filter(Boolean)
    .map((text) => ({ text, line: index, canvas: metric(text), svg: { advance: 99 } }))),
  lines: source.split(/\r\n|[\r\n]/u).map((line, index) => ({ width: metric(line).width,
    svgWidth: 99, ascent: 11, descent: 3, baseline: index * 16.4 })),
  lineContract: { ascent: 11, descent: 3, method: 'independent native metrics' }, lineGap: 12 * .2 }
  const point = (generation, revision, id, status) => {
    const owner = JSON.stringify(['point-node', revision, id])
    const request = JSON.stringify([source, 'Times New Roman, Times, serif', 12, '400', 'normal', generation, 4, .2, owner])
    return { source, style: { kind: 'pointStyle', shape: 'circle', size: 3, color: '#3870a0', opacity: .65, fill: 'hollow' },
      request, pointRequest: request, owner, runtime: { fontGeneration: generation, documentRevision: revision }, status,
      literalObservation: { ...structuredClone(observation), request, pointRequest: request, source, title: source, status } }
  }
  return { click: point(0, 7, 'app-point', 'pending'), reference: point(42, 900, 'export-reference', 'ready'),
    saved: { source: source.replace(/\r\n?/gu, '\n'), literalObservation: { ...structuredClone(observation), source: null,
      title: source.replace(/\r\n?/gu, '\n'), request: null, pointRequest: null, status: null, sanitized: true },
    contourKind: 'circle', opacity: '.65', paints: { fill: '#ffffff', stroke: '#3870a0', text: '#000000' } } }
}

test('export comparison permits local generation/owner differences and later live App edits', () => {
  const data = fixture()
  // Only the frozen click record matters; no current live-App argument exists.
  assert.doesNotThrow(() => assertPointExportCompatibility(data))
  data.reference.status = data.reference.literalObservation.status = 'fallback'
  assert.doesNotThrow(() => assertPointExportCompatibility(data))
})

test('XML CRLF normalization and viewport-dependent SVG advances do not invalidate native Canvas compatibility', () => {
  const data = fixture('  body\r\n\r tail  ')
  data.reference.literalObservation.measurements[0].svg.advance = 300
  data.saved.literalObservation.lines[0].svgWidth = 301
  data.click.literalObservation.font.properties['font-synthesis'] = 'none'
  data.reference.literalObservation.font.properties['font-synthesis'] = 'weight style small-caps'
  assert.doesNotThrow(() => assertPointExportCompatibility(data))
})

for (const target of ['reference', 'saved']) {
  test(`${target}: matching declared fonts do not hide leaked quoted-family FontFace`, () => {
    const data = fixture()
    data[target].literalObservation.fontReadiness.faces.push({ family: '"Times New Roman"', style: 'normal', weight: 'normal', status: 'loaded' })
    assert.throws(() => assertPointExportCompatibility(data), /compatible native font environment/)
  })
  for (const [name, corrupt] of [
    ['exact-source width', (value) => { value.measurements[0].canvas.width += 1 }],
    ['font-box ascent', (value) => { value.fontProbe.fontBoundingBoxAscent += 1 }],
    ['space width', (value) => { value.space.width += 1 }],
    ['line width', (value) => { value.lines[0].width += 1 }],
    ['line descent', (value) => { value.lineContract.descent += 1 }],
    ['Canvas effective font', (value) => { value.canvasConfiguration.effective = '12px Courier' }],
  ]) {
    test(`${target}: rejects shifted ${name}`, () => {
      const data = fixture(); corrupt(data[target].literalObservation)
      assert.throws(() => assertPointExportCompatibility(data), /compatible native font environment/)
    })
  }
}

test('FontFaceSet order can differ but descriptors, including family quotes, stay exact', () => {
  const data = fixture()
  const a = { family: '"Other Family"', style: 'normal', weight: '400', status: 'loaded' }
  const b = { family: 'Unrelated', style: 'italic', weight: '700', status: 'loaded' }
  for (const key of ['click', 'reference', 'saved']) data[key].literalObservation.fontReadiness.faces = [a, b]
  data.saved.literalObservation.fontReadiness.faces = [b, a]
  assert.doesNotThrow(() => assertPointExportCompatibility(data))
  data.reference.literalObservation.fontReadiness.faces = [{ ...a, family: 'Other Family' }, b]
  assert.throws(() => assertPointExportCompatibility(data), /compatible native font environment/)
})

for (const target of ['click', 'reference']) {
  for (const [name, corrupt, reason] of [
    ['generation', (point) => { point.runtime.fontGeneration++ }, /stale local font generation/],
    ['owner', (point) => { point.owner = '["point-node",900,"wrong-id"]' }, /stale local owner/],
    ['revision', (point) => { point.runtime.documentRevision++ }, /stale document revision/],
    ['body request', (point) => { point.pointRequest = '[]' }, /contour\/body request/],
    ['source observation', (point) => { point.literalObservation.source = '$laterPoint$' }, /native observation source/],
    ['font size', (point) => { point.literalObservation.font.properties['font-size'] = '13px' }, /request font size/],
  ]) {
    test(`${target}: rejects stale/mismatched ${name}`, () => {
      const data = fixture(); corrupt(data[target])
      assert.throws(() => assertPointExportCompatibility(data), reason)
    })
  }
}

test('reference must be settled and keep captured source/style', () => {
  const pending = fixture(); pending.reference.status = pending.reference.literalObservation.status = 'pending'
  assert.throws(() => assertPointExportCompatibility(pending), /must be settled/)
  const stale = fixture(); stale.reference = fixture('$laterPoint$').reference
  assert.throws(() => assertPointExportCompatibility(stale), /captured source/)
  for (const [key, value] of Object.entries({ shape: 'square', size: 9, color: '#ff0000', opacity: .1, fill: 'filled' })) {
    const data = fixture(); data.reference.style[key] = value
    assert.throws(() => assertPointExportCompatibility(data), /captured point style/)
  }
})

test('saved source, contour style and native measurement coverage remain required', () => {
  for (const [mutate, reason] of [
    [(data) => { data.saved.source = '$laterPoint$' }, /captured source/],
    [(data) => { data.saved.contourKind = 'polygon' }, /captured contour kind/],
    [(data) => { data.saved.paints.fill = '#3870a0' }, /captured point fill/],
    [(data) => { data.saved.opacity = '1' }, /captured point opacity/],
    [(data) => { data.saved.literalObservation.measurements = [] }, /exact source measurement tokens/],
    [(data) => { data.reference.literalObservation.fontReadiness.checked = false }, /intended native font ready/],
    [(data) => { delete data.saved.literalObservation.fontProbe.width }, /nonfinite width/],
  ]) {
    const data = fixture(); mutate(data)
    assert.throws(() => assertPointExportCompatibility(data), reason)
  }
})
