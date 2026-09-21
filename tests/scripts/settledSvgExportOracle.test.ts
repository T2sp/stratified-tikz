import assert from 'node:assert/strict'
import test from 'node:test'
import { exportOracleSvgNamespace, hasExpectedSettledMath, inspectSettledSvgElement,
  type ExportOracleElement } from '../../scripts/fixtures/settledSvgExportOracle.ts'

class ElementTree implements ExportOracleElement {
  localName: string
  namespaceURI: string
  parentElement: ElementTree | null = null
  children: ElementTree[]
  attributes: Record<string, string>
  text: string
  constructor(name: string, children: ElementTree[] = [], attributes: Record<string, string> = {}, text = '',
    namespace = exportOracleSvgNamespace) {
    this.localName = name
    this.children = children
    this.attributes = attributes
    this.text = text
    this.namespaceURI = namespace
    for (const child of children) child.parentElement = this
  }
  getAttribute(name: string) { return this.attributes[name] ?? null }
  get textContent(): string { return this.text + this.children.map((child) => child.textContent).join('') }
  get outerHTML(): string { return `<${this.localName}>${this.text}${this.children.map((child) => child.outerHTML).join('')}</${this.localName}>` }
}
const source = '$\\frac{autoDim}{x}$'
const path = (namespace = exportOracleSvgNamespace) => new ElementTree('path', [], { d: 'M0 0L10 10Z' }, '', namespace)
const math = (nodes = [path()]) => new ElementTree('svg', nodes)
const title = (text: string) => new ElementTree('title', [], {}, text)
function label(text = source, foreground: ElementTree[] = [math()], halo: ElementTree[] = [math()]) {
  return new ElementTree('g', [title(text), new ElementTree('g', [new ElementTree('g', halo),
    new ElementTree('g', foreground)], { opacity: '0.7', fill: '#802080' })])
}
const inspect = (target: ElementTree) => inspectSettledSvgElement(target, source)

test('settled oracle selects the exact direct source title and foreground beneath the paint group', () => {
  const root = new ElementTree('svg', [title('diagram'), label('$different$'),
    new ElementTree('g', [label()], { opacity: '0.25', transform: 'translate(3 4)' }), path()])
  const result = inspect(root)
  assert.equal(result.titleCount, 3)
  assert.equal(result.labelCount, 2)
  assert.equal(result.matchingLabelCount, 1)
  assert.equal(result.foreground?.nestedSvgCount, 1)
  assert.equal(result.foreground?.paths, 1, 'Halo and unrelated paths are excluded')
  assert.equal(result.foreground?.effectiveOpacity, 0.175)
  assert.equal(result.paint?.attributes.fill, '#802080')
  assert.equal(hasExpectedSettledMath(result), true)
})

test('a title nested inside a label cannot make an enclosing diagram group the selected label', () => {
  const root = new ElementTree('svg', [new ElementTree('g', [label(), math([path(), path()])])])
  const result = inspect(root)
  assert.equal(result.labelCount, 1)
  assert.equal(result.matchingLabelCount, 1)
  assert.equal(result.foreground?.paths, 1)
})

test('missing foreground math is rejected despite halo, diagram, and other-label paths', () => {
  const root = new ElementTree('svg', [math(), label(source, []), label('$other$')])
  const result = inspect(root)
  assert.equal(result.foreground?.paths, 0)
  assert.equal(hasExpectedSettledMath(result), false)
})

test('whole-source fallback is rejected even if a stray math path coexists with it', () => {
  const texts = [new ElementTree('text', [], {}, '$\\frac{autoDim}'), new ElementTree('text', [], {}, '{x}$')]
  const result = inspect(label(source, [math(), ...texts]))
  assert.equal(result.foreground?.completeSourceLiteral, true)
  assert.equal(result.foreground?.paths, 1)
  assert.equal(hasExpectedSettledMath(result), false)
})

test('a surviving halo cannot become positive evidence when the complete foreground group is missing', () => {
  const outline = path()
  outline.attributes = { ...outline.attributes, fill: '#ffffff', stroke: '#ffffff',
    'stroke-width': '3', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }
  const onlyHalo = new ElementTree('g', [title(source), new ElementTree('g', [new ElementTree('g', [math([outline])])])])
  const result = inspect(onlyHalo)
  assert.equal(result.foreground?.geometry.path, 1, 'Diagnostic geometry count still shows the surviving outline')
  assert.equal(result.foreground?.paths, 0, 'Halo cannot prove successful foreground math')
  assert.equal(hasExpectedSettledMath(result), false)
})

test('arbitrary foreground paths, foreign namespace paths, definitions, and empty paths do not prove formula geometry', () => {
  for (const foreground of [[path()], [math([path('http://www.w3.org/1999/xhtml')])],
    [math([new ElementTree('defs', [path()])])], [math([new ElementTree('path')])]]) {
    const result = inspect(label(source, foreground))
    assert.equal(result.foreground?.paths, 0)
    assert.equal(hasExpectedSettledMath(result), false)
  }
})

test('duplicate exact-source labels are ambiguous instead of silently selecting the first', () => {
  const result = inspect(new ElementTree('svg', [label(), label()]))
  assert.equal(result.matchingLabelCount, 2)
  assert.equal(result.label, null)
  assert.equal(hasExpectedSettledMath(result), false)
})

test('parse errors remain visible and reject otherwise successful label geometry', () => {
  const result = inspect(new ElementTree('svg', [label(), new ElementTree('parsererror', [], {}, 'bad XML', 'parse')]))
  assert.deepEqual(result.parseErrors, ['bad XML'])
  assert.equal(result.foreground?.paths, 1)
  assert.equal(hasExpectedSettledMath(result), false)
})

test('ancestor opacity follows inline style precedence and records malformed opacity without a numeric guess', () => {
  const styled = inspect(new ElementTree('svg', [label()], { opacity: '0.9', style: 'fill: red; opacity: 0.2;' }))
  assert.equal(styled.foreground?.effectiveOpacity, 0.13999999999999999)
  const malformed = inspect(new ElementTree('svg', [label()], { opacity: 'invalid' }))
  assert.equal(malformed.foreground?.effectiveOpacity, null)
})
