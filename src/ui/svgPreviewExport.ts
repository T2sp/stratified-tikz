export const defaultSvgPreviewExportFilename = 'stratified-tikz-preview.svg'
export const svgPreviewExportMimeType = 'image/svg+xml;charset=utf-8'
export const svgPreviewExportButtonLabel =
  'Export current diagram view as SVG'

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

const svgXmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>'
const standaloneSvgStyle =
  'background:#ffffff;color:#94a3b8;font-family:Inter,Arial,sans-serif;'

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

export function createSvgPreviewExportText(
  svg: SVGSVGElement,
): string | null {
  if (typeof XMLSerializer === 'undefined') {
    return null
  }

  const clone = svg.cloneNode(true)

  if (!isSvgPreviewExportElementLike(clone)) {
    return null
  }

  sanitizeSvgPreviewExportTree(clone)

  return `${svgXmlDeclaration}\n${new XMLSerializer().serializeToString(clone)}\n`
}

export function sanitizeSvgPreviewExportTree(
  root: SvgPreviewExportElementLike,
): void {
  removeExcludedSvgPreviewExportChildren(root)
  removeSvgPreviewExportMetadataAttributes(root)
  ensureStandaloneSvgRootAttributes(root)
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
  if (element.getAttribute('data-svg-export-exclude') === 'true') {
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

  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  root.setAttribute('version', '1.1')
  root.setAttribute('style', standaloneSvgStyle)

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

function parseSvgViewBox(
  viewBox: string | null,
): { width: number; height: number } | null {
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
    width: values[2],
    height: values[3],
  }
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
