/** Test-only structural oracle for detached/exported labels. Do not use CSS
 * descendant selectors whose implicit root can count diagram or halo paths. */
export const exportOracleSvgNamespace = 'http://www.w3.org/2000/svg'

export type ExportOracleElement = {
  readonly localName: string
  readonly namespaceURI: string | null
  readonly textContent: string | null
  readonly outerHTML: string
  readonly children: ArrayLike<ExportOracleElement>
  readonly parentElement: ExportOracleElement | null
  getAttribute(name: string): string | null
}

const geometryNames = ['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'use'] as const
const attributeNames = ['id', 'transform', 'opacity', 'fill', 'fill-opacity', 'color', 'stroke',
  'stroke-opacity', 'stroke-width', 'stroke-linejoin', 'vector-effect',
  'visibility', 'display', 'style', 'viewBox', 'width', 'height'] as const
const children = (element: ExportOracleElement) => Array.from(element.children)
const isSvg = (element: ExportOracleElement, name: string) =>
  element.namespaceURI === exportOracleSvgNamespace && element.localName === name
function descendants(element: ExportOracleElement): ExportOracleElement[] {
  return children(element).flatMap((child) => [child, ...descendants(child)])
}
function attributes(element: ExportOracleElement) {
  return Object.fromEntries(attributeNames.flatMap((name) => {
    const value = element.getAttribute(name)
    return value === null ? [] : [[name, value]]
  }))
}
function ancestry(element: ExportOracleElement) {
  const result = []
  for (let current: ExportOracleElement | null = element; current; current = current.parentElement) {
    result.push({ tag: current.localName, namespace: current.namespaceURI, attributes: attributes(current) })
  }
  return result
}
function effectiveOpacity(element: ExportOracleElement): number | null {
  let opacity = 1
  for (const ancestor of ancestry(element)) {
    // XML exports retain presentation attributes. Inline style, if present in
    // the separately retained live snapshot, has the normal CSS precedence.
    const inline = ancestor.attributes.style?.match(/(?:^|;)\s*opacity\s*:\s*([^;!]+)/u)?.[1]
    const value = inline ?? ancestor.attributes.opacity
    if (value === undefined) continue
    const parsed = Number(value.trim())
    if (!Number.isFinite(parsed)) return null
    opacity *= parsed
  }
  return opacity
}
function labelParts(root: ExportOracleElement, source: string) {
  const all = [root, ...descendants(root)]
  const titles = all.filter((element) => isSvg(element, 'title'))
  const labels = all.filter((element) => isSvg(element, 'g')
    && children(element).some((child) => isSvg(child, 'title')))
  const matches = labels.filter((element) => children(element).some((child) =>
    isSvg(child, 'title') && child.textContent === source))
  const label = matches.length === 1 ? matches[0] : null
  const paintGroups = label ? children(label).filter((child) => isSvg(child, 'g')) : []
  const paint = paintGroups.length === 1 ? paintGroups[0] : null
  // Shared SvgTexLabelView emits optional halo first, foreground last. Export
  // intentionally removes data markers; direct structure remains stable.
  const foreground = paint ? children(paint).filter((child) => isSvg(child, 'g')).at(-1) ?? null : null
  return { all, titles, labels, matches, label, paint, foreground }
}

/** Structural entry point also admits a small DOM-shaped tree in Node tests. */
export function inspectSettledSvgElement(root: ExportOracleElement, source: string) {
  const { all, titles, labels, matches, label, paint, foreground } = labelParts(root, source)
  const math = foreground ? children(foreground).filter((child) => isSvg(child, 'svg')) : []
  const mathGeometry = math.flatMap((svg) => descendants(svg)).filter((element) => {
    if (element.namespaceURI !== exportOracleSvgNamespace) return false
    for (let parent = element.parentElement; parent && parent !== foreground; parent = parent.parentElement) {
      if (['defs', 'clipPath', 'mask'].includes(parent.localName)) return false
    }
    return true
  })
  const textFragments = foreground ? descendants(foreground)
    .filter((element) => isSvg(element, 'text')).map((element) => element.textContent ?? '') : []
  const geometry = Object.fromEntries(geometryNames.map((name) =>
    [name, mathGeometry.filter((element) => element.localName === name).length]))
  const foregroundPaths = mathGeometry.filter((element) => {
    if (!isSvg(element, 'path') || (element.getAttribute('d') ?? '').trim() === '') return false
    // Halo leaves retain these explicit outline attributes after metadata is
    // stripped. They cannot become formula evidence if the actual foreground
    // group was entirely lost and the halo became the last paint child.
    if (element.getAttribute('vector-effect') === 'non-scaling-stroke'
      && element.getAttribute('stroke-linejoin') === 'round') return false
    for (let parent = element.parentElement; parent && parent !== paint; parent = parent.parentElement) {
      if (parent.getAttribute('aria-hidden') === 'true' || parent.getAttribute('data-label-halo') === 'true') return false
    }
    return true
  }).length
  return {
    source,
    parseErrors: all.filter((element) => element.localName === 'parsererror')
      .map((element) => (element.textContent ?? '').slice(0, 2000)),
    titleCount: titles.length, labelCount: labels.length, matchingLabelCount: matches.length,
    titles: titles.slice(0, 100).map((title) => ({ source: title.textContent, namespace: title.namespaceURI,
      parent: title.parentElement?.localName, parentNamespace: title.parentElement?.namespaceURI })),
    label: label ? { source: children(label).find((child) => isSvg(child, 'title'))?.textContent,
      namespace: label.namespaceURI, markup: label.outerHTML, attributes: attributes(label), ancestors: ancestry(label) } : null,
    paint: paint ? { namespace: paint.namespaceURI, attributes: attributes(paint), ancestors: ancestry(paint) } : null,
    foreground: foreground ? { namespace: foreground.namespaceURI, markup: foreground.outerHTML,
      attributes: attributes(foreground), ancestors: ancestry(foreground),
      nestedSvgCount: math.length, paths: foregroundPaths, geometry, textFragments,
      completeSourceLiteral: textFragments.join('') === source,
      effectiveOpacity: effectiveOpacity(foreground) } : null,
  }
}
export type SettledSvgLabelObservation = ReturnType<typeof inspectSettledSvgElement>

export function inspectSettledSvgLabel(root: Document | Element, source: string): SettledSvgLabelObservation {
  return inspectSettledSvgElement(root.nodeType === 9 ? (root as Document).documentElement : root as Element, source)
}

/** Expected-success math cannot be established by arbitrary paths, another
 * title/label, a halo, foreign-namespace markup, or whole-source literal text. */
export function hasExpectedSettledMath(observation: SettledSvgLabelObservation): boolean {
  return observation.parseErrors.length === 0 && observation.matchingLabelCount === 1
    && observation.label?.source === observation.source
    && observation.label.namespace === exportOracleSvgNamespace
    && observation.foreground?.namespace === exportOracleSvgNamespace
    && observation.foreground.nestedSvgCount > 0 && observation.foreground.paths > 0
    && !observation.foreground.completeSourceLiteral
}

/** Negative controls run on parsed copies, never on the live app or export. */
export function checkSettledSvgLabelControls(svg: string, source: string) {
  const evaluate = (alter: (document: Document, foreground: Element, paint: Element) => void) => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const parts = labelParts(document.documentElement, source)
    if (!parts.foreground || !parts.paint) return { rejected: true, missingControlTarget: true }
    const foreground = parts.foreground as Element, paint = parts.paint as Element
    alter(document, foreground, paint)
    const observation = inspectSettledSvgLabel(document, source)
    return { rejected: !hasExpectedSettledMath(observation), missingControlTarget: false,
      paths: observation.foreground?.paths, texts: observation.foreground?.textFragments }
  }
  const foreignGeometry = (document: Document) => {
    const svg = document.createElementNS(exportOracleSvgNamespace, 'svg')
    const path = document.createElementNS(exportOracleSvgNamespace, 'path')
    path.setAttribute('d', 'M0 0 L10 10 Z')
    svg.append(path)
    return svg
  }
  return {
    missingForegroundMath: evaluate((_document, foreground) => foreground.replaceChildren()),
    rawSourceFallback: evaluate((document, foreground) => {
      const text = document.createElementNS(exportOracleSvgNamespace, 'text')
      text.textContent = source
      foreground.replaceChildren(text)
    }),
    unrelatedAndHaloPaths: evaluate((document, foreground, paint) => {
      foreground.replaceChildren()
      const halo = document.createElementNS(exportOracleSvgNamespace, 'g')
      halo.append(foreignGeometry(document))
      paint.insertBefore(halo, foreground)
      document.documentElement.append(foreignGeometry(document))
      const other = document.createElementNS(exportOracleSvgNamespace, 'g')
      const title = document.createElementNS(exportOracleSvgNamespace, 'title')
      title.textContent = `${source} other label`
      other.append(title, foreignGeometry(document))
      document.documentElement.append(other)
    }),
    onlyHaloGroup: evaluate((document, foreground, paint) => {
      const halo = document.createElementNS(exportOracleSvgNamespace, 'g')
      const math = foreignGeometry(document)
      const path = math.firstElementChild!
      path.setAttribute('fill', '#ffffff')
      path.setAttribute('stroke', '#ffffff')
      path.setAttribute('stroke-width', '3')
      path.setAttribute('stroke-linejoin', 'round')
      path.setAttribute('vector-effect', 'non-scaling-stroke')
      halo.append(math)
      paint.replaceChildren(halo)
      foreground.remove()
    }),
  }
}
