import assert from 'node:assert/strict'
import { observePointLiteral, assertPositionedLiteral } from './pointLiteralOracle.mjs'
import { boundedPointDiagnostic, cleanupPointCheck } from './pointCheckDiagnostics.mjs'

// Independently declared browser fixture contract, not exported layout records.
export const responsiveBodyFixture = Object.freeze({ source: 'Scale', family: 'Times New Roman, Times, serif',
  size: '12', weight: '400', style: 'normal', point: Object.freeze({ x: 260, y: 180 }) })

/** Runs unchanged against detached saved XML and the directly reopened document.
 * Expanded names ignore namespace-prefix/attribute-order serialization only.
 * Text/title whitespace and every non-display style/transform remain exact. */
export function responsiveBodyStructureInDocument({ xml, background } = {}) {
  const owner = xml === undefined ? document : new DOMParser().parseFromString(xml, 'image/svg+xml')
  const root = owner.documentElement
  const display = new Set(['position', 'left', 'top', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'z-index'])
  const controlled = (name) => display.has(name) || /^(?:margin|padding|border)(?:-|$)/u.test(name)
  const attributes = (element) => [...element.attributes]
    .filter((attribute) => attribute.namespaceURI !== 'http://www.w3.org/2000/xmlns/'
      && !(element === root && attribute.namespaceURI === null && attribute.name === 'data-responsive-original-style'))
    .map((attribute) => {
      let value = attribute.value
      // Foreign XML elements need not expose CSSStyleDeclaration. Preserve the
      // raw attribute so invalid namespace diagnostics survive collection.
      if (attribute.namespaceURI === null && attribute.localName === 'style' && element.style?.[Symbol.iterator]) {
        value = [...element.style].filter((name) => element !== root || !controlled(name))
          .sort().map((name) => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)])
        if (!value.length) return null
      }
      return { namespace: attribute.namespaceURI, name: attribute.localName, value }
    }).filter(Boolean).sort((a, b) => `${a.namespace}:${a.name}`.localeCompare(`${b.namespace}:${b.name}`))
  const snapshot = (element) => ({ namespace: element.namespaceURI, name: element.localName, attributes: attributes(element),
    children: [...element.childNodes].flatMap((child) => {
      if (child.nodeType === 1) return [snapshot(child)]
      if ([3, 4].includes(child.nodeType) && (child.textContent.trim() || ['text', 'tspan', 'title', 'desc'].includes(element.localName))) return [{ text: child.textContent }]
      return []
    }) })
  const matrix = (element) => {
    if (!element?.transform) return null
    let result = new DOMMatrix()
    for (const transform of element.transform.baseVal) result = result.multiply(transform.matrix)
    return Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, result[key]]))
  }
  const titles = [...root.querySelectorAll('g > title')]
  const body = titles[0]?.parentElement, point = body?.parentElement
  const paint = body && [...body.children].find((element) => element.localName === 'g')
  const content = paint && [...paint.children].filter((element) => element.localName === 'g').at(-1)
  const foreground = content ? [...content.children].filter((element) => element.localName === 'text') : []
  const contour = point && [...point.children].find((element) => ['circle', 'polygon'].includes(element.localName))
  const ancestors = []
  for (let element = content; element; element = element.parentElement) ancestors.unshift({ namespace: element.namespaceURI,
    name: element.localName, attributes: attributes(element), transform: matrix(element) })
  let rootToPoint = point ? new DOMMatrix() : null
  for (let element = point; element; element = element.parentElement) {
    const local = matrix(element)
    if (local) rootToPoint = new DOMMatrix([local.a, local.b, local.c, local.d, local.e, local.f]).multiply(rootToPoint)
  }
  const raw = (element) => element && Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value]))
  const elements = [root, ...root.querySelectorAll('*')]
  const markerName = 'data-stratified-tikz-export-background'
  // Collect even malformed/namespaced markers. Excluding them from runtime
  // metadata is not permission: both documents must pass the mode declaration.
  const exportBackground = { root: { namespace: root.namespaceURI, name: root.localName, attributes: attributes(root) },
    markers: elements.flatMap((element) => [...element.attributes]
      .filter((attribute) => attribute.localName === markerName)
      .map((attribute) => ({ attribute: { namespace: attribute.namespaceURI, name: attribute.localName, value: attribute.value },
        node: snapshot(element), directRootChild: element.parentElement === root,
        elementIndex: [...root.children].indexOf(element) }))),
    rootRectangles: [...root.children].filter((element) => element.localName === 'rect')
      .map((element) => ({ node: snapshot(element), elementIndex: [...root.children].indexOf(element) })),
    stylingElements: elements.filter((element) => ['style', 'link', 'animate', 'animateMotion', 'animateTransform', 'set'].includes(element.localName)).map(snapshot) }
  return { expectedBackground: background, exportBackground, tree: snapshot(root), declaration: { sourceTitles: titles.map((title) => title.textContent),
    body: body && { attributes: attributes(body), transform: matrix(body) },
    point: point && { attributes: attributes(point), transform: matrix(point) },
    rootToPoint: rootToPoint && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, rootToPoint[key]])),
    contentTransform: matrix(content),
    foreground: foreground.map((element) => ({ text: element.textContent, attributes: raw(element), node: snapshot(element), transform: matrix(element) })),
    ancestors, contour: contour && snapshot(contour) },
    rootStyle: root.getAttribute('style'), temporaryRootStyle: root.getAttribute('data-responsive-original-style'),
    parserErrors: owner.querySelectorAll('parsererror').length,
    runtimeAttributes: elements.flatMap((element) => [...element.attributes]
      .filter((attribute) => attribute.localName.startsWith('data-') && attribute.localName !== markerName
        && !(element === root && attribute.namespaceURI === null && attribute.name === 'data-responsive-original-style'))
      .map((attribute) => ({ element: element.localName, namespace: attribute.namespaceURI, name: attribute.name }))) }
}

/** Collect first; callers persist this saved-file baseline before asserting it. */
export async function createResponsiveBodyBaseline(page, xml, background) {
  return { fixture: responsiveBodyFixture, expectedBackground: background, saved: await boundedPointDiagnostic(() =>
    page.evaluate(responsiveBodyStructureInDocument, { xml, background }), 'responsive saved body structure', 5000) }
}

export async function observeResponsiveBody(page, { background, diagnose } = {}) {
  const structure = await boundedPointDiagnostic(() => page.evaluate(responsiveBodyStructureInDocument, { background }), 'responsive body structure', 5000)
  if (diagnose) await diagnose({ boundary: 'responsive-body-before-settling', structure })
  const settling = await boundedPointDiagnostic(() => page.evaluate(async () => {
    const before = new XMLSerializer().serializeToString(document), initialFontStatus = document.fonts.status
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const properties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-kerning',
      'letter-spacing', 'word-spacing', 'white-space', 'tab-size', 'text-rendering', 'text-anchor', 'dominant-baseline', 'direction']
    const leaves = [...document.querySelectorAll('text')].map((element) => {
      const css = getComputedStyle(element), font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`
      const box = element.getBBox(), matrix = element.getScreenCTM()
      return { text: element.textContent, font: css.font, requestedFont: font,
        properties: Object.fromEntries(properties.map((name) => [name, css.getPropertyValue(name)])),
        readiness: { status: document.fonts.status, checked: document.fonts.check(font, element.textContent || 'Mg') },
        bounds: { x: box.x, y: box.y, width: box.width, height: box.height },
        ctm: matrix && Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, matrix[key]])) }
    })
    return { initialFontStatus, status: document.fonts.status, leaves,
      faces: [...document.fonts].map(({ family, style, weight, status }) => ({ family, style, weight, status })),
      documentUnchanged: before === new XMLSerializer().serializeToString(document) }
  }), 'responsive body font/layout settling', 5000)
  const result = { structure, settling }
  if (diagnose) await diagnose({ boundary: 'responsive-body-before-literal-metrics', ...result })
  try { result.literal = await observePointLiteral(page, { source: responsiveBodyFixture.source, standalone: true, diagnose }) }
  catch (error) { result.literalError = { name: error.name, message: error.message, stack: error.stack } }
  if (diagnose) await diagnose({ boundary: 'responsive-body-observed', ...result })
  return result
}

const families = (value) => value?.split(',').map((part) => part.trim().replace(/^(["'])(.*)\1$/u, '$2'))
const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const svgNamespace = 'http://www.w3.org/2000/svg'
const backgroundMarker = 'data-stratified-tikz-export-background'
const localAttribute = (node, name) => node?.attributes.find((attribute) => attribute.namespace === null && attribute.name === name)?.value
const localNumber = (value) => typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim())
  ? Number(value) : NaN
const whiteFill = (value) => typeof value === 'string' && /^(?:white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/iu.test(value.trim())
const rectangleBounds = (node) => ['x', 'y', 'width', 'height'].map((name) => localNumber(localAttribute(node, name)))

/** Independent fixture declaration, never inferred from the inspected marker or
 * obtained by rerunning production sanitization. Local viewBox units, not CSS
 * screenshot dimensions, define the background in both saved and live XML. */
export function assertResponsiveBackground(snapshot, expectedBackground, name) {
  assert.ok(['transparent', 'white'].includes(expectedBackground), `${name}: explicit expected background mode`)
  assert.equal(snapshot.expectedBackground, expectedBackground, `${name}: fixture background mode`)
  const background = snapshot.exportBackground
  assert.ok(background, `${name}: missing export background structure`)
  assert.equal(background.root.namespace, svgNamespace, `${name}: background SVG root namespace`)
  assert.equal(background.root.name, 'svg', `${name}: background SVG root element`)
  const viewBox = localAttribute(background.root, 'viewBox')?.trim().split(/[\s,]+/u).map(localNumber)
  assert.ok(viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0,
    `${name}: background finite positive local viewBox`)
  const rectAttributes = new Set(['x', 'y', 'width', 'height', 'fill', backgroundMarker])
  // Recognize an unmarked copy of the exporter's plain rectangle too, without
  // classifying ordinary white-filled diagram content as export metadata.
  const coveringWhiteRectangles = background.rootRectangles.filter(({ node }) => node.namespace === svgNamespace
    && node.children.length === 0 && node.attributes.every((attribute) => attribute.namespace === null && rectAttributes.has(attribute.name))
    && whiteFill(localAttribute(node, 'fill')) && rectangleBounds(node).every((value, index) => value === viewBox[index]))
  if (expectedBackground === 'transparent') {
    assert.deepEqual(background.markers, [], `${name}: transparent export has no background marker`)
    assert.deepEqual(coveringWhiteRectangles, [], `${name}: transparent export has no export background rectangle`)
    return
  }
  assert.equal(background.markers.length, 1, `${name}: white export has exactly one background marker`)
  const marker = background.markers[0], node = marker.node
  assert.deepEqual(marker.attribute, { namespace: null, name: backgroundMarker, value: 'white' }, `${name}: background marker namespace/value`)
  assert.equal(node.namespace, svgNamespace, `${name}: background rect SVG namespace`)
  assert.equal(node.name, 'rect', `${name}: background rect element`)
  assert.equal(marker.directRootChild, true, `${name}: background direct root child`)
  assert.equal(marker.elementIndex, 0, `${name}: background first root element child`)
  assert.deepEqual(rectangleBounds(node), viewBox, `${name}: background bounds cover local viewBox`)
  assert.ok(whiteFill(localAttribute(node, 'fill')), `${name}: background white fill`)
  // These fixtures export a plain rect. Reject declarations that can override
  // its geometry/paint (CSS geometry, transform, opacity, visibility, rounded
  // corners, clipping, filters, etc.), including inherited root overrides.
  assert.deepEqual(node.attributes.filter((attribute) => attribute.namespace !== null || !rectAttributes.has(attribute.name)), [],
    `${name}: background has no paint/transform overrides`)
  assert.deepEqual(node.children, [], `${name}: background has no overriding children`)
  assert.equal(coveringWhiteRectangles.length, 1, `${name}: exactly one export background rectangle`)
  const rootAttributes = new Set(['viewBox', 'preserveAspectRatio', 'version', 'width', 'height', 'style', 'color', 'font-family'])
  assert.deepEqual(background.root.attributes.filter((attribute) => attribute.namespace !== null || !rootAttributes.has(attribute.name)), [],
    `${name}: background root has no paint/transform overrides`)
  const rootStyle = localAttribute(background.root, 'style') ?? []
  assert.ok(Array.isArray(rootStyle), `${name}: background canonical root style`)
  assert.deepEqual(rootStyle.filter(([property]) => !['color', 'font-family'].includes(property)), [],
    `${name}: background root style has no paint/transform overrides`)
  assert.deepEqual(background.stylingElements, [], `${name}: background has no stylesheet/animation overrides`)
}

function assertDeclaration(snapshot, name, background) {
  assert.ok(snapshot, `${name}: missing structure`)
  assert.equal(snapshot.parserErrors, 0, `${name}: standalone parsing`)
  assert.deepEqual(snapshot.runtimeAttributes, [], `${name}: sanitized runtime attributes`)
  assertResponsiveBackground(snapshot, background, name)
  const declaration = snapshot.declaration
  assert.deepEqual(declaration?.sourceTitles, [responsiveBodyFixture.source], `${name}: exact source title`)
  assert.deepEqual(declaration.foreground.map(({ text }) => text), [responsiveBodyFixture.source], `${name}: foreground content/order`)
  for (const text of declaration.foreground) {
    const attributes = text.attributes
    assert.deepEqual(families(attributes['font-family']), families(responsiveBodyFixture.family), `${name}: text font family`)
    for (const [key, value] of Object.entries({ 'font-size': responsiveBodyFixture.size, 'font-weight': responsiveBodyFixture.weight,
      'font-style': responsiveBodyFixture.style, 'text-anchor': 'start', 'dominant-baseline': 'alphabetic', direction: 'ltr', x: '0', y: '0', 'xml:space': 'preserve' })) {
      assert.equal(attributes[key], value, `${name}: text ${key} declaration/baseline`)
    }
    assert.deepEqual(text.transform, identity, `${name}: foreground local placement transform`)
  }
  assert.deepEqual(declaration.body?.transform, identity, `${name}: body local placement transform`)
  assert.deepEqual(declaration.point?.transform, { ...identity, e: responsiveBodyFixture.point.x, f: responsiveBodyFixture.point.y }, `${name}: point local placement transform`)
  assert.deepEqual(declaration.rootToPoint, { ...identity, e: responsiveBodyFixture.point.x, f: responsiveBodyFixture.point.y }, `${name}: independent ancestor local placement transform`)
  assert.deepEqual(declaration.contentTransform, identity, `${name}: content local placement transform`)
  assert.ok(declaration.contour, `${name}: missing contour geometry`)
}

function assertFont(properties, name) {
  assert.ok(properties, `${name}: missing actual text font`)
  assert.deepEqual(families(properties['font-family']), families(responsiveBodyFixture.family), `${name}: text font family`)
  for (const [key, value] of Object.entries({ 'font-size': '12px', 'font-weight': '400', 'font-style': 'normal', 'font-kerning': 'normal',
    'white-space': 'pre', 'tab-size': '4', direction: 'ltr' })) assert.equal(properties[key], value, `${name}: text ${key}`)
  assert.equal(properties['text-rendering']?.toLowerCase(), 'optimizelegibility', `${name}: text rendering`)
  assert.ok(['normal', '100%'].includes(properties['font-stretch']), `${name}: text font stretch`)
  for (const key of ['letter-spacing', 'word-spacing']) assert.ok(['normal', '0px'].includes(properties[key]), `${name}: text ${key}`)
}

function finiteBounds(bounds, name) {
  assert.ok(bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])), `${name}: missing/nonfinite native bounds`)
  assert.ok(bounds.width > 0 && bounds.height > 0, `${name}: positive native bounds`)
}

/** Saved local placement and independent local-font expectations are invariants.
 * Native SVG bounds are diagnostics/visibility inputs; different CSS scales are
 * never required to produce identical glyph boxes or Canvas ink measurements. */
export function assertResponsiveBody(observation, baseline) {
  assertDeclaration(baseline?.saved, 'saved file', baseline?.expectedBackground)
  assertDeclaration(observation?.structure, 'displayed file', baseline?.expectedBackground)
  const original = baseline.saved.declaration, current = observation.structure.declaration
  assert.deepEqual(current.foreground, original.foreground, 'Saved foreground text/font/coordinates remain invariant')
  assert.deepEqual(current.body, original.body, 'Saved body local placement remains invariant')
  assert.deepEqual(current.ancestors, original.ancestors, 'Saved ancestor local placement/styles remain invariant')
  assert.deepEqual(current.contour, original.contour, 'Saved contour geometry remains invariant')
  assert.deepEqual(observation.structure.tree, baseline.saved.tree, 'Saved full-root structure remains invariant under CSS display resize')
  if (observation.structure.temporaryRootStyle !== null) assert.equal(observation.structure.temporaryRootStyle,
    JSON.stringify(baseline.saved.rootStyle), 'Root display override preserves original saved style')
  const { settling, literal } = observation
  assert.equal(settling?.documentUnchanged, true, 'Font/layout settling leaves positive document unchanged')
  assert.equal(settling.status, 'loaded', 'Actual text fonts settled')
  assert.equal(settling.leaves.length, 1, 'Actual foreground text is present')
  for (const leaf of settling.leaves) {
    assert.equal(leaf.text, responsiveBodyFixture.source, 'Actual foreground content/order')
    assertFont(leaf.properties, 'actual leaf')
    assert.equal(leaf.properties['text-anchor'], 'start', 'Actual leaf text anchor')
    assert.equal(leaf.properties['dominant-baseline'], 'alphabetic', 'Actual leaf alphabetic baseline')
    assert.equal(leaf.readiness.status, 'loaded', 'Actual leaf font readiness')
    assert.equal(leaf.readiness.checked, true, 'Actual leaf font check')
    finiteBounds(leaf.bounds, 'actual leaf')
    assert.ok(leaf.ctm && Object.values(leaf.ctm).every(Number.isFinite), 'Actual leaf finite screen CTM')
    assert.ok(Math.abs(leaf.ctm.a * leaf.ctm.d - leaf.ctm.b * leaf.ctm.c) > 0, 'Actual leaf invertible screen CTM')
  }
  assert.ok(literal, `Missing independent literal observation: ${observation.literalError?.message ?? 'not collected'}`)
  assert.equal(literal.documentUnchanged, true, 'Literal observation leaves positive document unchanged')
  assertFont(literal.font?.properties, 'independent literal')
  assert.equal(literal.fontReadiness?.status, 'loaded', 'Independent literal fonts ready')
  assert.equal(literal.fontReadiness?.checked, true, 'Independent literal font check')
  assert.equal(literal.canvasConfiguration?.requested,
    `${literal.font.properties['font-style']} ${literal.font.properties['font-weight']} ${literal.font.properties['font-size']} ${literal.font.properties['font-family']}`,
    'Independent Canvas uses the actual verified text font')
  for (const [name, metric] of [['font probe', literal.fontProbe], ['space probe', literal.space],
    ...(literal.measurements ?? []).map(({ text, canvas }) => [`source ${text}`, canvas])]) {
    assert.ok(metric && ['width', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'actualBoundingBoxLeft', 'actualBoundingBoxRight']
      .every((key) => Number.isFinite(metric[key])), `Independent Canvas ${name}: missing/nonfinite metrics`)
    assert.ok(metric.width > 0, `Independent Canvas ${name}: positive width`)
  }
  assert.deepEqual(literal.measurements?.map(({ text, line }) => ({ text, line })), [{ text: responsiveBodyFixture.source, line: 0 }], 'Independent Canvas exact source contract')
  const context = literal.coordinateContext, root = context?.rootToScreen, body = context?.bodyToScreen
  for (const [name, matrix] of [['root', root], ['body', body]]) assert.ok(matrix && ['a', 'b', 'c', 'd', 'e', 'f']
    .every((key) => Number.isFinite(matrix[key])), `Independent ${name} finite screen CTM`)
  const determinant = root.a * root.d - root.b * root.c
  assert.ok(Number.isFinite(determinant) && determinant !== 0, 'Independent root invertible screen CTM')
  const local = { a: (root.d * body.a - root.c * body.b) / determinant, b: (-root.b * body.a + root.a * body.b) / determinant,
    c: (root.d * body.c - root.c * body.d) / determinant, d: (-root.b * body.c + root.a * body.d) / determinant,
    e: (root.d * (body.e - root.e) - root.c * (body.f - root.f)) / determinant,
    f: (-root.b * (body.e - root.e) + root.a * (body.f - root.f)) / determinant }
  for (const [key, expected] of Object.entries({ ...identity, e: responsiveBodyFixture.point.x, f: responsiveBodyFixture.point.y })) {
    assert.ok(Number.isFinite(local[key]) && Math.abs(local[key] - expected) <= .001,
      `Independent native body placement ${key}: actual=${local[key]}, expected=${expected}, tolerance=0.001 local units`)
  }
  assertPositionedLiteral(literal, responsiveBodyFixture.source)
}

/** Native controls change DOM only; original source/file bytes never change. */
export async function responsiveBodyNegativeControls(page, baseline, diagnose) {
  const results = []
  const serialize = () => page.evaluate(() => new XMLSerializer().serializeToString(document))
  for (const [kind, reason] of [['text-mutation', /foreground content\/order/u], ['body-displacement', /body local placement/u], ['font-change', /text font family/u]]) {
    const before = await serialize()
    const original = await page.evaluate((kind) => {
      const body = document.querySelector('g > title').parentElement, text = body.querySelector('text')
      const saved = { text: text.textContent, family: text.getAttribute('font-family'), transform: body.getAttribute('transform') }
      if (kind === 'text-mutation') text.textContent = 'Stale'
      if (kind === 'body-displacement') body.setAttribute('transform', 'translate(1 0)')
      if (kind === 'font-change') text.setAttribute('font-family', 'monospace')
      return saved
    }, kind)
    let primary, result
    try {
      const observation = await observeResponsiveBody(page, { background: baseline.expectedBackground, diagnose })
      result = { kind, observation, rejected: false }
      if (diagnose) await diagnose({ boundary: 'responsive-body-control-before-assertions', ...result })
      assert.throws(() => assertResponsiveBody(observation, baseline), (error) => {
        result.reason = error.message
        return reason.test(error.message)
      }, `${kind}: rejected for intended content/placement/font reason`)
      result.rejected = true
    } catch (error) { primary = error; throw error }
    finally {
      await cleanupPointCheck(primary, async () => {
        await page.evaluate((original) => {
          const body = document.querySelector('g > title').parentElement, text = body.querySelector('text')
          text.textContent = original.text
          for (const [element, name, value] of [[text, 'font-family', original.family], [body, 'transform', original.transform]]) {
            if (value === null) element.removeAttribute(name)
            else element.setAttribute(name, value)
          }
        }, original)
        const unchanged = await serialize() === before
        if (result) result.documentUnchanged = unchanged
        if (diagnose) await diagnose({ boundary: 'responsive-body-control-cleanup', kind, documentUnchangedAfterCleanup: unchanged, result })
        assert.equal(unchanged, true, 'Native body negative control restores the exact original document')
      })
    }
    results.push(result)
  }
  const restored = await observeResponsiveBody(page, { background: baseline.expectedBackground, diagnose })
  if (diagnose) await diagnose({ boundary: 'responsive-body-controls-restored', restored })
  assertResponsiveBody(restored, baseline)
  return results
}
