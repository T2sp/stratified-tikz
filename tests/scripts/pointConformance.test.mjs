import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { populateSyntheticConformance, syntheticConformanceMaskPng } from './pointConformanceFixture.mjs'
import { captureConformancePaint } from '../../scripts/pointConformanceBrowser.mjs'
import { assertConformanceEvidence, assertConformancePlacement, assertConformancePaintProbe, compareConformancePng, measureConformanceTraversal, conformanceArtifacts, conformanceReference, pgfConformancePath, conformanceProbeSvg, oldConformancePath } from '../../scripts/pointConformanceContract.mjs'
import { layoutAnchorArtifacts, signedPolygonalScenario, layoutAnchorScenarios } from '../../scripts/pointLayoutAnchorsContract.mjs'

// Exercise the actual serialized page callback in both document kinds. These
// stubs test namespace ownership, bounded frame and cleanup, never native pixels.
for (const contentType of ['text/html', 'image/svg+xml']) test(`conformance paint creates an HTML canvas inside ${contentType} and cleans its owned resources`, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'stz-conformance-namespace-')); t.after(() => rmSync(directory, { recursive: true, force: true }))
  const calls = { namespace: [], generic: [], deadlines: [], cleared: [], images: [], paints: [], imageSources: [] }
  const reachedEncoding = new Error('Browser boundary reached PNG encoding')
  let canvas
  class ProbeImage {
    constructor() { calls.images.push(this) }
    set src(value) { this.source = value; calls.imageSources.push(value); if (value) queueMicrotask(() => this.onload()) }
    get src() { return this.source }
  }
  const createCanvas = () => {
    const context = {
      fillRect(...args) { calls.paints.push(['fill', this.fillStyle, ...args]) },
      drawImage(image, ...args) { assert.ok(image instanceof ProbeImage); calls.paints.push(['draw', ...args]) },
    }
    canvas = { width: 0, height: 0,
      getContext(kind) { assert.equal(kind, '2d'); assert.equal(this.width, 800); assert.equal(this.height, 800); return context },
      toDataURL(type) { assert.equal(type, 'image/png'); return 'data:image/png;base64,namespace-boundary' },
    }
    return canvas
  }
  const document = {
    contentType,
    createElement(name) { calls.generic.push(name); return contentType === 'text/html' ? createCanvas() : { localName: name, namespaceURI: null } },
    createElementNS(namespace, name) {
      calls.namespace.push([namespace, name]); assert.equal(namespace, 'http://www.w3.org/1999/xhtml'); assert.equal(name, 'canvas')
      return createCanvas()
    },
  }
  const page = { async evaluate(callback, svg) {
    const value = await runInNewContext(`(${callback.toString()})(svg)`, {
      document, svg, Image: ProbeImage,
      URL: { createObjectURL() { throw new Error('Paint probe must not add blob requests') },
        revokeObjectURL() { throw new Error('Data images own no object URL') } },
      setTimeout(callback, milliseconds) { const timer = setTimeout(callback, milliseconds); calls.deadlines.push(milliseconds); return timer },
      clearTimeout(timer) { calls.cleared.push(timer); clearTimeout(timer) },
    })
    assert.equal(value, 'namespace-boundary')
    assert.equal(calls.imageSources[0], 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      'The data image preserves exact SVG input bytes without creating an object URL')
    // Stop before fabricated encoding can become a PNG artifact or paint proof.
    throw reachedEncoding
  } }
  const key = 'ellipse-signed-dashes', reference = conformanceReference(key)
  const contour = { attributes: { d: 'M -1.2 0 A 1.2 12.727922061358 0 0 1 1.2 0 A 1.2 12.727922061358 0 0 1 -1.2 0 Z' } }
  await assert.rejects(captureConformancePaint({ page, key, stage: 'reopened', stem: 'namespace', artifactDir: directory,
    contour, reference, retain: async () => {} }), error => error === reachedEncoding)
  assert.deepEqual(calls.namespace, [['http://www.w3.org/1999/xhtml', 'canvas']]); assert.deepEqual(calls.generic, [])
  assert.deepEqual(calls.deadlines, [4000]); assert.equal(calls.cleared.length, 1)
  assert.equal(calls.images[0].src, ''); assert.equal(calls.imageSources.length, 2)
  assert.equal(calls.images[0].onload, null); assert.equal(calls.images[0].onerror, null)
  assert.deepEqual(calls.paints, [['fill', '#FFFFFF', 0, 0, 800, 800], ['draw', 0, 0]])
  assert.deepEqual([canvas.width, canvas.height], [800, 800])
})

test('fresh conformance remains mandatory within the existing twelve-scenario inventory', () => {
  assert.equal(layoutAnchorScenarios.length, 12)
  for (const artifact of conformanceArtifacts()) assert.ok(layoutAnchorArtifacts(signedPolygonalScenario).includes(artifact))
  assert.throws(() => assertConformanceEvidence({}, '/tmp'), /geometryConformance/)
  assert.throws(() => assertConformanceEvidence({ geometryConformance: [] }, '/tmp'), /Both corrections/)
})
test('independent PGF native inputs retain the reproduced small-aspect and signed traversal cases', () => {
  const diamond = conformanceReference('diamond-small-aspect'), ellipse = conformanceReference('ellipse-signed-dashes')
  assert.equal(diamond.control.expectedStages.anchorYSp, 6664080)
  assert.ok(pgfConformancePath(diamond).includes('-122.022947'))
  assert.equal(ellipse.control.innerXSep, -20); assert.equal(ellipse.control.innerYSep, 7.5)
  assert.match(pgfConformancePath(ellipse), /^M -1\.2 0 C -1\.2 -7/u)
  assert.equal(oldConformancePath('ellipse-signed-dashes', 'M -1.2 0 A 1.2 12.7 0 0 1 1.2 0'), 'M -1.2 0 A 1.2 12.7 0 0 0 1.2 0')
  assert.ok(conformanceProbeSvg('diamond-small-aspect', 'M 0 0', {}).includes('-15 -130 30 260'))
})
test('observed CTM roundoff does not invent renderer transforms while genuine placement changes remain rejected', t => {
  const directory = mkdtempSync(join(tmpdir(), 'stz-conformance-ctm-policy-')); t.after(() => rmSync(directory, { recursive: true, force: true }))
  const fixture = populateSyntheticConformance(directory)
  for (const raw of fixture.raws) {
    const entry = raw.native
    if (raw.key === 'ellipse-signed-dashes') {
      assert.ok(entry.rendered.anchorOffset.x === 0 && entry.rendered.anchorOffset.y === 0, 'The independent center anchor is exactly zero')
      assert.equal(Object.hasOwn(entry.rendered.contour.attributes, 'transform'), false)
      for (const sign of [-1, 1]) {
        const rounded = structuredClone(entry)
        rounded.rendered.placementOffset = { x: sign * 2.842170943040401e-14, y: -sign * 5.684341886080802e-14 }
        assertConformancePlacement(rounded, raw.reference)
        assert.equal(Object.hasOwn(rounded.rendered.contour.attributes, 'transform'), false,
          'Inverse/composed CTM arithmetic cannot change the renderer attribute inventory')
      }
    } else assertConformancePlacement(entry, raw.reference)
    const faults = raw.key === 'ellipse-signed-dashes' ? [
      ['nonzero renderer transform', current => { current.rendered.contour.attributes.transform = 'translate(0.001 0)' }],
      ['actual CTM displacement', current => { current.rendered.placementOffset.x = .001 }],
      ['coherent invented center placement', current => {
        current.rendered.anchorOffset.x = .001; current.rendered.placementOffset.x = -.001
        current.rendered.contour.attributes.transform = 'translate(-0.001 0)'
      }],
    ] : [
      ['missing north-anchor transform', current => { delete current.rendered.contour.attributes.transform }],
      ['wrong actual north-anchor transform', current => { current.rendered.contour.attributes.transform = 'translate(0 1)' }],
      ['actual north-anchor CTM displacement', current => { current.rendered.placementOffset.y += .001 }],
    ]
    for (const [name, mutate] of faults) {
      const current = structuredClone(entry); mutate(current)
      assert.throws(() => assertConformancePlacement(current, raw.reference), `${raw.native.ambientDimension}D ${raw.key}: ${name}`)
    }
  }
})
test('spatial paint comparison preserves raw mismatches and rejects displaced, reversed, empty and truncated masks', () => {
  const expected = syntheticConformanceMaskPng(), near = compareConformancePng(syntheticConformanceMaskPng(1), expected)
  assert.equal(near.actualDark, 400); assert.equal(near.expectedDark, 400)
  assert.ok(near.mismatches > 0, 'Raster quantization evidence retains every raw differing pixel')
  assert.equal(near.spatial.outside, 0)
  for (const shift of [3, 30, 590]) {
    const result = compareConformancePng(syntheticConformanceMaskPng(shift), expected)
    assert.equal(result.actualDark, result.expectedDark, 'Equal dark-pixel counts cannot establish geometric agreement')
    assert.ok(result.spatial.outside > 0, `Shift/reversal ${shift} exceeds the independently derived pixel-cell bound`)
  }
  const blank = compareConformancePng(syntheticConformanceMaskPng(0, false), expected)
  assert.equal(blank.actualDark, 0); assert.ok(blank.spatial.outside > 0)
  assert.throws(() => compareConformancePng(expected.subarray(0, 33), expected), 'A header-only PNG cannot become spatial evidence')
})
test('ordered traversal accepts independent signed PGF geometry and rejects old sweeps and global absolute axes', () => {
  const key = 'ellipse-signed-dashes', reference = conformanceReference(key)
  const actual = 'M -1.2 0 A 1.2 12.727922061358 0 0 1 1.2 0 A 1.2 12.727922061358 0 0 1 -1.2 0 Z'
  const metrics = measureConformanceTraversal(actual, reference)
  assert.ok(metrics.maxOrderedDistancePt < .03 && metrics.lengthDifferencePt < .03)
  assert.ok(metrics.startTangentDot > 0 && metrics.endTangentDot > 0)
  assert.ok(metrics.actualSamples <= 2048 && metrics.pgfSamples <= 2048)
  for (const path of [oldConformancePath(key, actual),
    'M 1.2 0 A 1.2 12.727922061358 0 0 0 -1.2 0 A 1.2 12.727922061358 0 0 0 1.2 0 Z']) {
    const control = measureConformanceTraversal(path, reference)
    assert.ok(control.maxOrderedDistancePt > .03 || control.startTangentDot <= 0 || control.endTangentDot <= 0,
      'Equal bounds and a closed ellipse cannot mask reversed traversal or a globally absolute start')
  }
})
test('authenticated paint probes retain bounded raster disagreement while rejecting coherently rehashed displaced paint', t => {
  const directory = mkdtempSync(join(tmpdir(), 'stz-conformance-spatial-policy-')); t.after(() => rmSync(directory, { recursive: true, force: true }))
  const fixture = populateSyntheticConformance(directory), raw = fixture.raws.find(entry => entry.key === 'ellipse-signed-dashes')
  const probe = structuredClone(raw.live), pngPath = join(directory, `${raw.scenario}-live-actual.png`)
  const expected = readFileSync(join(directory, `${raw.scenario}-live-pgf.png`))
  const replaceActual = png => {
    writeFileSync(pngPath, png); probe.actual.bytes = png.length
    probe.actual.pngSha256 = createHash('sha256').update(png).digest('hex')
    probe.comparison = compareConformancePng(png, expected)
  }
  replaceActual(syntheticConformanceMaskPng(1))
  assert.ok(probe.comparison.mismatches > 0); assert.equal(probe.comparison.spatial.outside, 0)
  assertConformancePaintProbe(probe, directory, raw.scenario, 'live')
  replaceActual(syntheticConformanceMaskPng(3))
  assert.ok(probe.comparison.spatial.outside > 0)
  assert.throws(() => assertConformancePaintProbe(probe, directory, raw.scenario, 'live'),
    'Matching current PNG hashes and recomputed comparisons cannot hide displaced geometry')
  replaceActual(syntheticConformanceMaskPng(0, false))
  assert.throws(() => assertConformancePaintProbe(probe, directory, raw.scenario, 'live'), 'Empty paint cannot satisfy conformance')
})
test('complete synthetic schema replays both shapes in both dimensions and rejects missing/mismatched evidence', t => {
  const directory = mkdtempSync(join(tmpdir(), 'stz-conformance-policy-')); t.after(() => rmSync(directory, { recursive: true, force: true }))
  const fixture = populateSyntheticConformance(directory)
  assert.equal(assertConformanceEvidence(fixture, directory).length, 28)
  for (const raw of fixture.raws) {
    const path = join(directory, `${raw.scenario}.json`), original = readFileSync(path)
    for (const [name, mutate] of [
      ['old-sweep-or-axis', current => { current.native.rendered.anchorOffset.y += 1 }],
      ['missing-live-paint', current => { delete current.live }],
      ['unbound-reference', current => { current.reference.sha256 = '0'.repeat(64) }],
      ['wrong-image-path', current => { current.live.actual.svg = current.live.old.svg }],
      ['reused-control-pixels', current => { current.live.negativeControl = current.live.comparison }],
      ['edited-authored-style', current => { current.click.snapshot.points[0].style.paint.stroke.dashPhase++ }],
      ['wrong-click-runtime-document-revision', current => { current.click.snapshot.runtime.documentRevision++ }],
      ['wrong-file-contour', current => { current.reopened[0].contour.attributes.d += ' M 20 20' }],
      ['broken-native-click-continuity', current => { current.beforeExportState.labelDocumentRevision++ }],
      ['wrong-native-stroke-width', current => { current.native.rendered.contour.attributes['stroke-width'] = '3' }],
      ['wrong-native-dimension', current => { current.native.ambientDimension = 5 - current.native.ambientDimension }],
      ['wrong-export-dimension', current => { current.ambientDimension = 5 - current.ambientDimension }],
    ]) {
      const current = JSON.parse(original); mutate(current); writeFileSync(path, JSON.stringify(current))
      assert.throws(() => assertConformanceEvidence(fixture, directory), name)
    }
    writeFileSync(path, original)
    const svgPath = join(directory, `${raw.scenario}.svg`), svg = readFileSync(svgPath, 'utf8')
    for (const change of [value => value.replace(raw.native.rendered.nodeTransform, 'translate(999 999)'), value => value.replace('<title/>', '<title/><title/>'),
      value => value.replace('<svg ', '<svg opacity="0" '), value => value.replace('<svg ', '<svg transform="translate(999 999)" '),
      value => value.replace(/<g\/><\/svg>$/u, '</svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g opacity="0"/></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g transform="translate(999 999)"/></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g><g/></g></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g><path d="M 0 0 L 1 1"/></g></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g><title/></g></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g>foreign</g></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<path/></svg>'),
      value => value.replace(/<g\/><\/svg>$/u, '<g/><g/></svg>'),
      value => value.replace(/(<svg[^>]*>)([\s\S]*)<g\/><\/svg>$/u, '$1<g/>$2</svg>')]) {
      const corrupt = change(svg), current = JSON.parse(original); current.xml = corrupt
      assert.notEqual(corrupt, svg, 'The SVG structure corruption changes actual file bytes')
      writeFileSync(svgPath, corrupt); writeFileSync(path, JSON.stringify(current))
      assert.throws(() => assertConformanceEvidence(fixture, directory), 'Actual file-only ancestry/owner corruption cannot use copied reopening records')
    }
    writeFileSync(svgPath, svg); writeFileSync(path, original)
    const stale = JSON.parse(original), oldPath = oldConformancePath(stale.key, stale.native.rendered.contour.attributes.d)
    const staleSvg = svg.replace(stale.native.rendered.contour.attributes.d, oldPath)
    stale.native.rendered.contour.attributes.d = oldPath; stale.reopened[0].contour.attributes.d = oldPath; stale.xml = staleSvg
    writeFileSync(svgPath, staleSvg); writeFileSync(path, JSON.stringify(stale))
    assert.throws(() => assertConformanceEvidence(fixture, directory), 'Correct detached probes cannot authenticate old actual DOM/downloaded contour')
    writeFileSync(svgPath, svg); writeFileSync(path, original)
  }
  const missing = { ...fixture, geometryConformance: fixture.geometryConformance.slice(1) }
  assert.throws(() => assertConformanceEvidence(missing, directory), /Both corrections/)
})
