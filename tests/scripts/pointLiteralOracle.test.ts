import assert from 'node:assert/strict'
import test from 'node:test'
import { createPointStratum } from '../../src/model/constructors.ts'
import { literalSvgLabelLayout, svgLabelLayoutSettings } from '../../src/rendering/labels/svgLabelLayout.ts'
import { svgLabelRequestIdentity, type SvgLabelState } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { createSvgLabelRuntime } from '../../src/rendering/labels/svgLabelRuntime.ts'
import { renderSettledSvgLabelDocument } from '../../src/ui/svgSettledExport.ts'
import { type SvgLabelExportCapture } from '../../src/rendering/svgLabelExportRegistry.ts'
import { assertPositionedLiteral, type LiteralObservation } from '../../scripts/fixtures/positionedLiteralAssertions.ts'

const settings = svgLabelLayoutSettings(12, 'Times New Roman')
const measurement = { identity: 'oracle-boundary-test',
  measure: (text: string) => ({ width: text.length * 6, ascent: 9, descent: 3 }),
  lineMetrics: () => ({ ascent: 9, descent: 3 }) }
const runtime = createSvgLabelRuntime({ measurement })
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Restricted SSR observation adapter for these plain-text fixtures, not a DOM
 * parser or native-metrics claim. Actual fragment text/x/y come ONLY from the
 * production rendered SVG, never the layout placements. Native collection,
 * font measurement and DOM mutations also run in the browser acceptance suite. */
function rendered(source: string, status: 'pending' | 'fallback' = 'fallback'): LiteralObservation {
  const capture: SvgLabelExportCapture = { runtime, source, settings, fontSize: 12, fontFamily: settings.font.family,
    position: { x: 0, y: 0 }, boundsTarget: false, anchor: 'center', opacity: 1, color: '#000000', ownerIdentity: 'same-owner',
    pointStyle: createPointStratum({ ambientDimension: 2, id: 'p', position: { x: 0, y: 0, z: 0 } }).style }
  const state: SvgLabelState = { source, status, requestIdentity: svgLabelRequestIdentity(capture), ...literalSvgLabelLayout(source, settings, measurement) }
  const markup = renderSettledSvgLabelDocument(capture, state)
  const attr = (tag: string, name: string) => decode(tag.match(new RegExp(` ${name}="([^"]*)"`))![1])
  const bounds = attr(markup, 'data-label-bounds').split(' ').map(Number)
  const fragments = [...markup.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((match) => {
    const x = Number(attr(match[0], 'x')), y = Number(attr(match[0], 'y')), text = decode(match[2])
    return { text, x, y, baseline: y, transform: null, matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      bounds: { minX: x, minY: y - 9, maxX: x + text.length * 6, maxY: y + 3 },
      font: { 'white-space': 'pre' }, xmlSpace: 'preserve', visible: true }
  })
  const expected: LiteralObservation['expected'] = [], lines: LiteralObservation['lines'] = [], tabs: LiteralObservation['tabs'] = []
  for (const [index, line] of (source === '' ? [] : source.split(/\r\n|[\r\n]/u)).entries()) {
    let x = 0
    for (const [part, text] of line.split('\t').entries()) {
      if (part) { x = (Math.floor(x / 24) + 1) * 24; tabs.push({ method: 'svg-whitespace-grid', advance: x, index: x / 24, next: { text: ' '.repeat(x / 6) }, tabSize: 4 }) }
      if (text) { expected.push({ text, x, y: index * 14.4 }); x += text.length * 6 }
    }
    lines.push({ width: x, baseline: index * 14.4, ascent: 9, descent: 3 })
  }
  return { source: attr(markup, 'data-label-source'), request: attr(markup, 'data-label-request'), pointRequest: attr(markup, 'data-point-request'),
    title: decode(markup.match(/<title>([\s\S]*?)<\/title>/)![1]), status, math: (markup.match(/data-label-math=/g) ?? []).length,
    xml: false, sanitized: false, fragments, expected, lines, bounds,
    native: { minX: bounds[0], minY: bounds[1], maxX: bounds[2], maxY: bounds[3] }, tabs,
    offset: { a: 1, b: 0, c: 0, d: 1, e: -(Math.max(0, ...lines.map((l) => l.width))) / 2, f: lines.length ? (9 - lines.at(-1)!.baseline - 3) / 2 : 0 },
    extent: { minX: 0, maxX: Math.max(0, ...lines.map((l) => l.width)), minY: lines.length ? -9 : 0, maxY: lines.length ? lines.at(-1)!.baseline + 3 : 0 }, measurementClones: 0 }
}
const reported = '  $\\unknownPointMacro$\t\\slash\n tail  '
for (const source of [reported, '  $pending$\t\tend  ', '\n\t$bad\r\n\r tail  \t\n', '\t\n\r\n\r\t', '  $bad\t\n end  ', '', '   ']) {
  test(`rendered point observation retains positioned whitespace ${JSON.stringify(source)}`, () => {
    for (const status of ['pending', 'fallback'] as const) assertPositionedLiteral(rendered(source, status), source)
  })
}
test('reported false failure uses actual SVG foreground extraction, not layout records', () => {
  const output = rendered(reported)
  assert.equal(output.fragments.map((f) => f.text).join(''), '  $\\unknownPointMacro$\\slash tail  ')
  assert.notEqual(output.fragments.map((f) => f.text).join(''), reported)
  assertPositionedLiteral(output, reported)
})
test('correct source metadata cannot hide missing text, spaces, tab/line collapse, transforms or stale content', () => {
  for (const mutate of [
    (o: LiteralObservation) => { o.fragments.splice(1, 1) },
    (o: LiteralObservation) => { o.fragments[0].text = o.fragments[0].text.trimStart() },
    (o: LiteralObservation) => { o.fragments[1].x = o.fragments[0].x },
    (o: LiteralObservation) => { o.fragments[2].y = o.fragments[2].baseline = 0 },
    (o: LiteralObservation) => { o.fragments[1].matrix.e = -24 },
    (o: LiteralObservation) => { o.fragments[0].text = '$previous$' },
    (o: LiteralObservation) => { o.bounds![3] = o.bounds![1] + 12 },
  ]) {
    const output = rendered(reported), identity = output.request
    mutate(output); assert.equal(output.request, identity)
    assert.throws(() => assertPositionedLiteral(output, reported), /Positioned literal/)
  }
})
test('XML normalized attributes/title use exact JSON-escaped source independently', () => {
  const source = '  $bad\t\r\n\r tail  '
  const output = rendered(source)
  output.xml = true; output.source = source.replace(/\r\n?/g, '\n').replace(/[\t\n]/g, ' ')
  output.title = source.replace(/\r\n?/g, '\n')
  assertPositionedLiteral(output, source)
  output.request = JSON.stringify([output.source])
  assert.throws(() => assertPositionedLiteral(output, source), /exact request source/)
})
test('same-owner pending/failure/recovery observations cannot retain prior visible content', () => {
  for (const source of [' $held$\t\ttext ', reported, ' recovered literal ']) {
    const output = rendered(source, 'pending')
    assertPositionedLiteral(output, source)
    output.fragments = rendered('previous').fragments
    assert.throws(() => assertPositionedLiteral(output, source))
  }
})


test('a displaced final line inside unchanged bounds fails the baseline contract with axis diagnostics', () => {
  const output = rendered(reported)
  const last = output.fragments.at(-1)!
  last.y -= 1; last.baseline -= 1; last.bounds.minY -= 1; last.bounds.maxY -= 1
  assert.ok(last.bounds.minY + output.offset.f >= output.bounds![1])
  assert.ok(last.bounds.maxY + output.offset.f <= output.bounds![3])
  assert.throws(() => assertPositionedLiteral(output, reported), /fragment 2 y \(line baseline\): actual=.*expected=.*delta=-1[^,]*, tolerance=0.5 local units/)
})
