export const defaultSvgPreviewExportFilename = 'stratified-tikz-preview.svg'
export const svgPreviewExportMimeType = 'image/svg+xml;charset=utf-8'
export const svgPreviewExportButtonLabel =
  'Export current diagram view as SVG'
export const svgPreviewExportBackgroundSelectLabel = 'SVG export background'

export type SvgPreviewBackgroundMode = 'transparent' | 'white'

export type SvgPreviewExportOptions = {
  backgroundMode: SvgPreviewBackgroundMode
}

export const defaultSvgPreviewBackgroundMode: SvgPreviewBackgroundMode =
  'transparent'

export const svgPreviewBackgroundModeOptions: ReadonlyArray<{
  value: SvgPreviewBackgroundMode
  label: string
}> = [
  { value: 'transparent', label: 'Transparent background' },
  { value: 'white', label: 'White background' },
]

export function svgPreviewBackgroundModeFromSelectValue(
  value: string,
): SvgPreviewBackgroundMode {
  return value === 'white' ? 'white' : defaultSvgPreviewBackgroundMode
}

export function svgPreviewExportSuccessMessage(
  mode: SvgPreviewBackgroundMode,
): string {
  return `SVG exported with ${mode} background.`
}

export type SvgPreviewExportAttributeLike = {
  readonly name: string
  readonly value: string
}

export type SvgPreviewExportElementLike = {
  readonly tagName: string
  readonly attributes: ArrayLike<SvgPreviewExportAttributeLike>
  readonly children: ArrayLike<SvgPreviewExportElementLike>
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
  remove: () => void
}

export type SvgPreviewExportCloneSourceLike = {
  cloneNode: (deep?: boolean) => unknown
}

const svgXmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>'
const svgNamespace = 'http://www.w3.org/2000/svg'
const exportBackgroundMarkerAttribute =
  'data-stratified-tikz-export-background'
const standaloneSvgStyleDefaults = [
  ['color', '#94a3b8'],
  ['font-family', 'Inter,Arial,sans-serif'],
] as const

const exportExcludedClassNames = new Set([
  'svg-coordinate-anchors',
  'svg-coordinate-source-highlights',
  'svg-coordinate-axes-guide',
  'svg-geometry-handle',
  'svg-path-draft',
  'svg-path-intersection-candidates',
  'svg-selection-cycle-feedback',
  'svg-work-plane-preview',
])

const metadataAttributePrefixes = ['aria-', 'data-', 'on']
const metadataAttributeNames = new Set([
  'class',
  'focusable',
  'role',
  'tabindex',
])

const defaultSvgPreviewExportOptions: SvgPreviewExportOptions = {
  backgroundMode: defaultSvgPreviewBackgroundMode,
}

export function createSvgPreviewExportText(
  svg: SVGSVGElement,
  options: SvgPreviewExportOptions = defaultSvgPreviewExportOptions,
): string | null {
  if (typeof XMLSerializer === 'undefined') {
    return null
  }

  try {
    const clone = prepareSvgPreviewExportClone(svg, options)

    if (clone === null) {
      return null
    }

    return `${svgXmlDeclaration}\n${new XMLSerializer().serializeToString(
      clone as unknown as Node,
    )}\n`
  } catch {
    return null
  }
}

export function prepareSvgPreviewExportClone(
  svg: SvgPreviewExportCloneSourceLike,
  options: SvgPreviewExportOptions = defaultSvgPreviewExportOptions,
): SvgPreviewExportElementLike | null {
  const clone = svg.cloneNode(true)

  if (!isSvgPreviewExportElementLike(clone)) {
    return null
  }

  return sanitizeSvgPreviewExportTree(clone, options) ? clone : null
}

export function sanitizeSvgPreviewExportTree(
  root: SvgPreviewExportElementLike,
  options: SvgPreviewExportOptions = defaultSvgPreviewExportOptions,
): boolean {
  removeExcludedSvgPreviewExportChildren(root)
  removeSvgPreviewExportMetadataAttributes(root)
  ensureStandaloneSvgRootAttributes(root)

  if (options.backgroundMode === 'transparent') {
    return true
  }

  const bounds = svgExportBackgroundBounds(root)

  if (bounds === null) {
    return false
  }

  return insertWhiteSvgExportBackground(root, bounds)
}

function removeExcludedSvgPreviewExportChildren(
  element: SvgPreviewExportElementLike,
): void {
  for (const child of Array.from(element.children)) {
    if (isExcludedSvgPreviewExportElement(child)) {
      child.remove()
      continue
    }

    removeExcludedSvgPreviewExportChildren(child)
    removeSvgPreviewExportMetadataAttributes(child)
  }
}

function isExcludedSvgPreviewExportElement(
  element: SvgPreviewExportElementLike,
): boolean {
  if (
    element.getAttribute('data-svg-export-exclude') === 'true' ||
    element.getAttribute('data-svg-background') === 'true' ||
    element.getAttribute(exportBackgroundMarkerAttribute) !== null
  ) {
    return true
  }

  const className = element.getAttribute('class')

  if (className === null) {
    return false
  }

  return className
    .split(/\s+/)
    .some((name) => exportExcludedClassNames.has(name))
}

function removeSvgPreviewExportMetadataAttributes(
  element: SvgPreviewExportElementLike,
): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name
    const lowerName = name.toLowerCase()

    if (
      metadataAttributeNames.has(lowerName) ||
      metadataAttributePrefixes.some((prefix) => lowerName.startsWith(prefix))
    ) {
      element.removeAttribute(name)
    }
  }
}

function ensureStandaloneSvgRootAttributes(
  root: SvgPreviewExportElementLike,
): void {
  if (root.tagName.toLowerCase() !== 'svg') {
    return
  }

  root.setAttribute('xmlns', svgNamespace)
  root.setAttribute('version', '1.1')
  root.removeAttribute('background')
  root.removeAttribute('background-color')
  root.setAttribute(
    'style',
    standaloneSvgRootStyle(root.getAttribute('style')),
  )

  const viewBox = parseSvgViewBox(root.getAttribute('viewBox'))

  if (viewBox === null) {
    return
  }

  if (root.getAttribute('width') === null) {
    root.setAttribute('width', formatSvgExportNumber(viewBox.width))
  }

  if (root.getAttribute('height') === null) {
    root.setAttribute('height', formatSvgExportNumber(viewBox.height))
  }
}

function standaloneSvgRootStyle(style: string | null): string {
  const declarations = (style ?? '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0)
    .filter((declaration) => {
      const separatorIndex = declaration.indexOf(':')
      const property = (
        separatorIndex < 0 ? declaration : declaration.slice(0, separatorIndex)
      )
        .trim()
        .toLowerCase()

      return property !== 'background' && property !== 'background-color'
    })

  const properties = new Set(
    declarations.map((declaration) =>
      declaration.slice(0, declaration.indexOf(':')).trim().toLowerCase(),
    ),
  )

  for (const [property, value] of standaloneSvgStyleDefaults) {
    if (!properties.has(property)) {
      declarations.push(`${property}:${value}`)
    }
  }

  return `${declarations.join(';')};`
}

type SvgExportBounds = {
  x: number
  y: number
  width: number
  height: number
}

function svgExportBackgroundBounds(
  root: SvgPreviewExportElementLike,
): SvgExportBounds | null {
  const viewBox = parseSvgViewBox(root.getAttribute('viewBox'))

  if (viewBox !== null) {
    return viewBox
  }

  const width = parseSvgExportLength(root.getAttribute('width'))
  const height = parseSvgExportLength(root.getAttribute('height'))

  if (width === null || height === null) {
    return null
  }

  return { x: 0, y: 0, width, height }
}

function insertWhiteSvgExportBackground(
  root: SvgPreviewExportElementLike,
  bounds: SvgExportBounds,
): boolean {
  const rectangle = createSvgExportElement(root, 'rect')

  if (rectangle === null) {
    return false
  }

  rectangle.setAttribute('x', formatSvgExportNumber(bounds.x))
  rectangle.setAttribute('y', formatSvgExportNumber(bounds.y))
  rectangle.setAttribute('width', formatSvgExportNumber(bounds.width))
  rectangle.setAttribute('height', formatSvgExportNumber(bounds.height))
  rectangle.setAttribute('fill', '#ffffff')
  rectangle.setAttribute(exportBackgroundMarkerAttribute, 'white')

  const insertBefore = methodFromUnknown(root, 'insertBefore')

  if (insertBefore === null) {
    return false
  }

  insertBefore.call(root, rectangle, root.children[0] ?? null)
  return true
}

function createSvgExportElement(
  root: SvgPreviewExportElementLike,
  tagName: string,
): SvgPreviewExportElementLike | null {
  const ownerDocument = propertyFromUnknown(root, 'ownerDocument')
  const createElement = methodFromUnknown(ownerDocument, 'createElementNS')

  if (createElement === null) {
    return null
  }

  const element = createElement.call(ownerDocument, svgNamespace, tagName)

  return isSvgPreviewExportElementLike(element) ? element : null
}

function propertyFromUnknown(value: unknown, name: string): unknown {
  if (typeof value !== 'object' || value === null || !(name in value)) {
    return null
  }

  return value[name as keyof typeof value]
}

function methodFromUnknown(
  value: unknown,
  name: string,
): ((...parameters: readonly unknown[]) => unknown) | null {
  const property = propertyFromUnknown(value, name)

  return typeof property === 'function'
    ? (property as (...parameters: readonly unknown[]) => unknown)
    : null
}

function parseSvgViewBox(viewBox: string | null): SvgExportBounds | null {
  if (viewBox === null) {
    return null
  }

  const values = viewBox.trim().split(/[\s,]+/).map(Number)

  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value)) ||
    values[2] <= 0 ||
    values[3] <= 0
  ) {
    return null
  }

  return {
    x: values[0],
    y: values[1],
    width: values[2],
    height: values[3],
  }
}

function parseSvgExportLength(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const match = value
    .trim()
    .match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?$/i)

  if (match === null) {
    return null
  }

  const parsed = Number(match[1])

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatSvgExportNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

function isSvgPreviewExportElementLike(
  value: unknown,
): value is SvgPreviewExportElementLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tagName' in value &&
    'attributes' in value &&
    'children' in value &&
    'getAttribute' in value &&
    'setAttribute' in value &&
    'removeAttribute' in value &&
    'remove' in value
  )
}
