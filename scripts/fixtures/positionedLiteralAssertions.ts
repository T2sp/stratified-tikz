/** Test-only contract. Independent Canvas logical lines and native SVG geometry;
 * never production layout records. Tolerances are in local SVG units. */
export type LiteralObservation = {
  source: string | null; request: string | null; pointRequest: string | null; title: string | null
  status: string | null; math: number; xml: boolean; sanitized: boolean
  fragments: { text: string; x: number; y: number; baseline: number; transform: string | null
    matrix: { a: number; b: number; c: number; d: number; e: number; f: number }
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    font: Record<string, string>; xmlSpace: string | null; visible: boolean }[]
  expected: { text: string; x: number; y: number; logicalX?: number }[]
  lines: { width: number; baseline: number; ascent: number; descent: number }[]
  bounds: number[] | null; native: { minX: number; minY: number; maxX: number; maxY: number }
  tabs: { method: string; advance: number; index: number; next: { text: string }; tabSize: number }[]
  offset: { a: number; b: number; c: number; d: number; e: number; f: number }
  extent: { minX: number; minY: number; maxX: number; maxY: number }
  measurementClones: number
}
export function assertPositionedLiteral(observed: LiteralObservation, source: string): void {
  const check = (ok: boolean, message: string) => { if (!ok) throw new Error(`Positioned literal: ${message}`) }
  const close = (a: number, b: number, tolerance = .5) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance
  const metric = (actual: number, expected: number, name: string, tolerance = .5) =>
    check(close(actual, expected, tolerance), `${name}: actual=${actual}, expected=${expected}, delta=${actual - expected}, tolerance=${tolerance} local units`)
  if (!observed.sanitized) {
    check(observed.request !== null && JSON.parse(observed.request)[0] === source, 'exact request source')
    check(observed.pointRequest === observed.request, 'contour/body request identity')
    const normalized = observed.xml ? source.replace(/\r\n?/gu, '\n').replace(/[\t\n]/gu, ' ') : source
    check(observed.source === normalized, 'source attribute (XML normalization only)')
  }
  check(observed.title === (observed.xml ? source.replace(/\r\n?/gu, '\n') : source), 'source title')
  check(observed.math === 0, 'literal state has no compiled math')
  // Independent source splitting, including empty lines and CRLF as one break.
  const tokens = source.split(/\r\n|[\r\n]/u).flatMap((line) => line.split('\t').filter((text) => text !== ''))
  check(observed.fragments.length === tokens.length, 'foreground fragment count')
  check(observed.expected.length === tokens.length, 'measured expectation count')
  observed.fragments.forEach((fragment, index) => {
    const expected = observed.expected[index]
    check(fragment.text === tokens[index] && expected.text === tokens[index], `fragment ${index} content/order/edge spaces`)
    check(fragment.visible && (fragment.font['white-space'].includes('pre') || fragment.xmlSpace === 'preserve'), `fragment ${index} visible whitespace`)
    metric(fragment.x, expected.x, `fragment ${index} x (SVG whitespace advance)`)
    if (expected.logicalX !== undefined) metric(fragment.x, expected.logicalX, `fragment ${index} x (Canvas logical advance)`)
    metric(fragment.y, expected.y, `fragment ${index} y (line baseline)`)
    metric(fragment.baseline, expected.y, `fragment ${index} transformed baseline`)
    const m = fragment.matrix
    check(close(m.a, 1, .001) && close(m.d, 1, .001) && [m.b, m.c, m.e, m.f].every((n) => close(n, 0, .001)), `fragment ${index} transform`)
    check(Object.values(fragment.bounds).every(Number.isFinite), `fragment ${index} native bounds`)
    if (fragment.text.trim()) check(fragment.bounds.maxX > fragment.bounds.minX && fragment.bounds.maxY > fragment.bounds.minY, `fragment ${index} native glyph bounds`)
  })
  for (const tab of observed.tabs) check(tab.method === 'svg-whitespace-grid' && tab.next.text.length === tab.index * tab.tabSize, 'complete SVG space-prefix tab measurement')
  const lines = observed.lines
  check(lines.length === (source === '' ? 0 : source.split(/\r\n|[\r\n]/u).length), 'physical line count')
  if (lines.length) {
    const { offset, extent } = observed
    check(close(offset.a, 1, .001) && close(offset.d, 1, .001) && close(offset.b, 0, .001) && close(offset.c, 0, .001), 'body scale/rotation')
    metric(offset.e, -(extent.minX + extent.maxX) / 2, 'centered logical x extent', 1)
    metric(offset.f, -(extent.minY + extent.maxY) / 2, 'centered logical y extent', 1)
    // Also applies to sanitized exports, whose runtime bounds are removed.
    if (source.trim()) {
      const ink = observed.native
      check(ink.minX >= extent.minX + offset.e - 1 && ink.maxX <= extent.maxX + offset.e + 1
        && ink.minY >= extent.minY + offset.f - 1 && ink.maxY <= extent.maxY + offset.f + 1, 'native foreground/logical containment')
    }
  }
  if (observed.bounds && lines.length) {
    const [x0, y0, x1, y1] = observed.bounds
    const height = lines[0].ascent + lines.at(-1)!.baseline + lines.at(-1)!.descent
    metric(y1 - y0, height, 'line/empty-line height', 1)
    metric(x1 - x0, observed.extent.maxX - observed.extent.minX, 'logical width', 1)
    metric(y0, observed.extent.minY + observed.offset.f, 'published top', 1)
    metric(y1, observed.extent.maxY + observed.offset.f, 'published bottom', 1)
    metric(x0, observed.extent.minX + observed.offset.e, 'published left', 1)
    metric(x1, observed.extent.maxX + observed.offset.e, 'published right', 1)
    check(x1 - x0 >= Math.max(...lines.map((line) => line.width)) - .5, 'trailing/boundary tab extent')
    const ink = observed.native
    if (source.trim()) check(ink.minX >= x0 - 1 && ink.maxX <= x1 + 1 && ink.minY >= y0 - 1 && ink.maxY <= y1 + 1, 'native foreground containment')
  }
  check(observed.measurementClones === 0, 'measurement clone cleanup')
}
