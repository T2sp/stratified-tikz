import { tikzStyleTargets } from './types.ts'
import { createUserStylePresetFromStyle } from './stylePresets.ts'
import {
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
  defaultRegionStyle,
  defaultSheetStyle,
} from './styles.ts'
import type {
  CurveStyle,
  Diagram,
  ExternalTikzStyleSource,
  HexColor,
  ImportedTikzStyleReference,
  LabelStyle,
  LineStyle,
  PointFill,
  PointShape,
  PointStyle,
  RegionStyle,
  SheetStyle,
  StylePresetKind,
  TikzStyleTarget,
} from './types.ts'

const defaultExternalStyleSourceName = 'External TikZ style source'
const defaultImportedTikzStyleTargets = [...tikzStyleTargets]
const colorPresetKinds: readonly StylePresetKind[] = [
  'curve',
  'sheet',
  'region',
  'label',
  'point',
]
const shapePresetKinds: readonly StylePresetKind[] = ['point', 'label']
const colorStyleTargets: readonly TikzStyleTarget[] = [
  'draw',
  'filldraw',
  'node',
  'curve',
  'sheet',
  'point',
  'label',
  'region',
]
const shapeStyleTargets: readonly TikzStyleTarget[] = [
  'node',
  'point',
  'label',
]
const namedTikzColors: Record<string, HexColor> = {
  black: '#000000',
  white: '#FFFFFF',
  gray: '#808080',
  red: '#FF0000',
  blue: '#0000FF',
  green: '#00FF00',
  yellow: '#FFFF00',
  orange: '#FFA500',
  purple: '#800080',
}
const colorSignalTokens = Object.keys(namedTikzColors)
const compactLineStyleOptions: Record<string, LineStyle> = {
  dashed: 'dashed',
  dotted: 'dotted',
  'densely dotted': 'denselyDotted',
}
const compactPointShapeOptions: Record<string, PointShape> = {
  circle: 'circle',
  rectangle: 'square',
}

export type TikzStylePreviewApproximation = {
  color?: HexColor
  fillColor?: HexColor
  drawColor?: HexColor
  textColor?: HexColor
  opacity?: number
  fillOpacity?: number
  drawOpacity?: number
  lineStyle?: LineStyle
  lineWidth?: number
  pointShape?: PointShape
  pointFill?: PointFill
  pointSize?: number
}

export type ParsedTikzStyleDefinition = {
  key: string
  options: string
}

export type TikzsetParserWarning = {
  message: string
}

export type ParseTikzsetStylesResult = {
  styles: ParsedTikzStyleDefinition[]
  skipped: number
  warnings: TikzsetParserWarning[]
}

export type ImportTikzStyleFileResult = {
  diagram: Diagram
  source: ExternalTikzStyleSource | null
  references: ImportedTikzStyleReference[]
  parseResult: ParseTikzsetStylesResult
}

export function isTikzStyleTarget(value: string): value is TikzStyleTarget {
  return tikzStyleTargets.includes(value as TikzStyleTarget)
}

export function importedTikzStyleTargetsForPresetKind(
  kind: StylePresetKind,
): readonly TikzStyleTarget[] {
  switch (kind) {
    case 'region':
      return ['region', 'filldraw']
    case 'sheet':
      return ['sheet', 'filldraw']
    case 'curve':
      return ['curve', 'draw']
    case 'point':
      return ['point', 'node']
    case 'label':
      return ['label', 'node']
  }
}

export function importedTikzStyleTargetsMatchPresetKind(
  targets: readonly TikzStyleTarget[],
  kind: StylePresetKind,
): boolean {
  const expectedTargets = importedTikzStyleTargetsForPresetKind(kind)

  return targets.some((target) => expectedTargets.includes(target))
}

export function importedTikzStyleReferenceMatchesPresetKind(
  reference: ImportedTikzStyleReference,
  kind: StylePresetKind,
): boolean {
  return importedTikzStyleTargetsMatchPresetKind(reference.targets, kind)
}

export function updateImportedTikzStyleReferenceTargets(
  diagram: Diagram,
  referenceId: string,
  targets: readonly TikzStyleTarget[],
): Diagram {
  const currentReferences = diagram.importedTikzStyleReferences ?? []
  const nextTargets = uniqueTikzStyleTargets(targets)

  if (
    nextTargets.length === 0 ||
    !currentReferences.some((reference) => reference.id === referenceId)
  ) {
    return diagram
  }

  return {
    ...diagram,
    importedTikzStyleReferences: currentReferences.map((reference) =>
      reference.id === referenceId
        ? { ...reference, targets: nextTargets }
        : reference,
    ),
  }
}

export function normalizeExternalTikzStyleSourceName(name: string): string {
  return normalizeSingleLineCommentText(name, defaultExternalStyleSourceName)
}

export function normalizeExternalTikzStyleLoadHint(
  loadHint: string,
  sourceName: string,
): string {
  const fallback = `\\input{${sourceName}}`

  return normalizeSingleLineCommentText(loadHint, fallback)
}

export function normalizeImportedTikzStyleDisplayName(
  displayName: string,
  key: string,
): string {
  return normalizeSingleLineCommentText(displayName, key)
}

export function normalizeImportedTikzStyleKey(key: string): string {
  return key.trim()
}

export function normalizeImportedTikzStyleOptions(options: string): string {
  return normalizeOptionList(options)
}

export function parseTikzsetStyles(text: string): ParseTikzsetStylesResult {
  const warnings: TikzsetParserWarning[] = []
  const parsedStyles: ParsedTikzStyleDefinition[] = []
  let skipped = 0
  const textWithoutComments = stripTexComments(text)
  const blocks = findTikzsetBlocks(textWithoutComments, warnings)

  for (const block of blocks) {
    const blockResult = parseTikzsetBlock(block, warnings)
    parsedStyles.push(...blockResult.styles)
    skipped += blockResult.skipped
  }

  return mergeDuplicateParsedStyles(parsedStyles, skipped, warnings)
}

export function importTikzStyleFile(
  diagram: Diagram,
  sourceFileName: string,
  text: string,
  loadHint?: string,
): ImportTikzStyleFileResult {
  const parseResult = parseTikzsetStyles(text)

  if (parseResult.styles.length === 0) {
    return {
      diagram,
      source: null,
      references: [],
      parseResult,
    }
  }

  const sourceName = normalizeExternalTikzStyleSourceName(sourceFileName)
  const source: ExternalTikzStyleSource = {
    id: uniqueImportedStyleId(
      `external-style-source-${toKebabIdentifier(sourceName) || 'source'}`,
      (diagram.externalTikzStyleSources ?? []).map((existing) => existing.id),
    ),
    name: sourceName,
    loadHint: normalizeExternalTikzStyleLoadHint(
      loadHint ?? `\\input{${sourceName}}`,
      sourceName,
    ),
  }
  const existingReferenceIds = (diagram.importedTikzStyleReferences ?? []).map(
    (reference) => reference.id,
  )
  const usedReferenceIds = [...existingReferenceIds]
  const references = parseResult.styles.map((style, index) => {
    const id = uniqueImportedStyleId(
      `imported-style-${toKebabIdentifier(style.key) || index + 1}`,
      usedReferenceIds,
    )

    usedReferenceIds.push(id)

    return {
      id,
      key: style.key,
      sourceId: source.id,
      displayName: normalizeImportedTikzStyleDisplayName(
        readableImportedTikzStyleDisplayName(style.key),
        style.key,
      ),
      targets: inferImportedTikzStyleTargets(style.key, style.options),
      options: style.options,
    } satisfies ImportedTikzStyleReference
  })
  const diagramWithReferences: Diagram = {
    ...diagram,
    externalTikzStyleSources: [
      ...(diagram.externalTikzStyleSources ?? []),
      source,
    ],
    importedTikzStyleReferences: [
      ...(diagram.importedTikzStyleReferences ?? []),
      ...references,
    ],
  }

  return {
    diagram: addDetectedImportedStylePresets(diagramWithReferences, references),
    source,
    references,
    parseResult,
  }
}

export function inferImportedTikzStyleTargets(
  key: string,
  options: string | undefined,
): TikzStyleTarget[] {
  const detectedTargets: TikzStyleTarget[] = []

  if (hasColorStyleSignal(key, options)) {
    detectedTargets.push(...colorStyleTargets)
  }

  if (hasShapeStyleSignal(key, options)) {
    detectedTargets.push(...shapeStyleTargets)
  }

  return detectedTargets.length === 0
    ? [...defaultImportedTikzStyleTargets]
    : uniqueTikzStyleTargets(detectedTargets)
}

export function importedStylePresetKindsForReference(
  reference: ImportedTikzStyleReference,
): StylePresetKind[] {
  const detectedKinds: StylePresetKind[] = []

  if (hasColorStyleSignal(reference.key, reference.options)) {
    detectedKinds.push(...colorPresetKinds)
  }

  if (hasShapeStyleSignal(reference.key, reference.options)) {
    detectedKinds.push(...shapePresetKinds)
  }

  return uniqueStylePresetKinds(detectedKinds)
}

export function parseTikzStylePreviewOptions(
  options: string,
): TikzStylePreviewApproximation {
  const preview: TikzStylePreviewApproximation = {}

  for (const option of splitTopLevelCommaList(options)) {
    applyPreviewOption(preview, option.trim())
  }

  return preview
}

export function importedStylePresetStyle(
  kind: StylePresetKind,
  options: string | undefined,
): CurveStyle | SheetStyle | RegionStyle | LabelStyle | PointStyle {
  const preview =
    options === undefined ? {} : parseTikzStylePreviewOptions(options)

  switch (kind) {
    case 'curve':
      return curveStyleFromPreview(preview)
    case 'sheet':
      return sheetStyleFromPreview(preview)
    case 'region':
      return regionStyleFromPreview(preview)
    case 'label':
      return labelStyleFromPreview(preview)
    case 'point':
      return pointStyleFromPreview(preview)
  }
}

export function hasTikzOptionLineBreak(value: string): boolean {
  return /[\r\n]/.test(value)
}

export function normalizeSingleLineCommentText(
  value: string,
  fallback: string,
): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .split('')
    .filter(isSafeSingleLineCommentCharacter)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length === 0 ? fallback : normalized
}

function isSafeSingleLineCommentCharacter(character: string): boolean {
  const code = character.charCodeAt(0)

  return (
    code > 31 &&
    code !== 127
  )
}

type TikzsetBlockParseResult = {
  styles: ParsedTikzStyleDefinition[]
  skipped: number
}

type BracedContentResult =
  | {
      ok: true
      content: string
      endIndex: number
    }
  | {
      ok: false
    }

function parseTikzsetBlock(
  block: string,
  warnings: TikzsetParserWarning[],
): TikzsetBlockParseResult {
  const entries = splitTopLevelCommaList(block)
  const styles: ParsedTikzStyleDefinition[] = []
  let currentDirectory = ''
  let skipped = 0

  for (const entry of entries) {
    const trimmedEntry = entry.trim()

    if (trimmedEntry.length === 0) {
      continue
    }

    const cdPath = parseCurrentDirectoryEntry(trimmedEntry)
    if (cdPath !== null) {
      currentDirectory = resolveTikzKeyPath(currentDirectory, cdPath)
      continue
    }

    const styleResult = parseStyleEntry(trimmedEntry, currentDirectory)

    if (styleResult.ok) {
      styles.push(styleResult.style)
      continue
    }

    skipped += 1
    warnings.push({ message: styleResult.warning })
  }

  return { styles, skipped }
}

function addDetectedImportedStylePresets(
  diagram: Diagram,
  references: readonly ImportedTikzStyleReference[],
): Diagram {
  let nextDiagram = diagram

  for (const reference of references) {
    for (const kind of importedStylePresetKindsForReference(reference)) {
      const style = importedStylePresetStyle(kind, reference.options)
      const result = createUserStylePresetFromStyle(
        nextDiagram,
        kind,
        reference.displayName,
        style,
        reference.id,
      )

      if (result !== null) {
        nextDiagram = result.diagram
      }
    }
  }

  return nextDiagram
}

function hasColorStyleSignal(
  key: string,
  options: string | undefined,
): boolean {
  const normalizedKey = key.toLowerCase()

  if (normalizedKey.includes('/color/')) {
    return true
  }

  const normalizedOptions = normalizeSignalText(options)

  if (normalizedOptions.length === 0) {
    return false
  }

  return (
    colorSignalTokens.some((token) =>
      new RegExp(`(^|[^a-z])${token}([^a-z]|$)`).test(normalizedOptions),
    ) ||
    hasSignalOption(normalizedOptions, 'opacity') ||
    hasSignalOption(normalizedOptions, 'fill opacity') ||
    hasSignalOption(normalizedOptions, 'draw opacity')
  )
}

function hasShapeStyleSignal(
  key: string,
  options: string | undefined,
): boolean {
  const normalizedKey = key.toLowerCase()

  if (normalizedKey.includes('/shape/')) {
    return true
  }

  const normalizedOptions = normalizeSignalText(options)

  if (normalizedOptions.length === 0) {
    return false
  }

  return (
    hasSignalOption(normalizedOptions, 'circle') ||
    hasSignalOption(normalizedOptions, 'rectangle') ||
    hasSignalOption(normalizedOptions, 'draw') ||
    hasSignalOption(normalizedOptions, 'fill') ||
    hasSignalOption(normalizedOptions, 'inner sep') ||
    hasSignalOption(normalizedOptions, 'minimum size')
  )
}

function normalizeSignalText(options: string | undefined): string {
  return (options ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasSignalOption(normalizedOptions: string, option: string): boolean {
  const escapedOption = option.replaceAll(' ', '\\s+')
  const pattern = new RegExp(`(^|,)\\s*${escapedOption}(\\s*=|\\s*(,|$))`)

  return pattern.test(normalizedOptions)
}

function uniqueTikzStyleTargets(
  targets: readonly TikzStyleTarget[],
): TikzStyleTarget[] {
  return tikzStyleTargets.filter((target) => targets.includes(target))
}

function uniqueStylePresetKinds(
  kinds: readonly StylePresetKind[],
): StylePresetKind[] {
  const usedKinds = new Set<StylePresetKind>()
  const uniqueKinds: StylePresetKind[] = []

  for (const kind of kinds) {
    if (!usedKinds.has(kind)) {
      usedKinds.add(kind)
      uniqueKinds.push(kind)
    }
  }

  return uniqueKinds
}

function readableImportedTikzStyleDisplayName(key: string): string {
  const normalizedKey = key.replace(/^\/+/, '')
  const [namespace, ...rest] = normalizedKey.split('/')

  if (namespace === undefined || namespace.length === 0 || rest.length === 0) {
    return key
  }

  return `${namespace}: ${rest.join('/')}`
}

function applyPreviewOption(
  preview: TikzStylePreviewApproximation,
  option: string,
): void {
  if (option.length === 0) {
    return
  }

  const normalizedOption = option.toLowerCase().replace(/\s+/g, ' ').trim()
  const assignment = parseTikzOptionAssignment(option)

  if (assignment !== null) {
    applyPreviewAssignment(preview, assignment.key, assignment.value)
    return
  }

  const compactLineStyle = compactLineStyleOptions[normalizedOption]
  if (compactLineStyle !== undefined) {
    preview.lineStyle = compactLineStyle
    return
  }

  if (normalizedOption === 'thick') {
    preview.lineWidth = 2
    return
  }

  if (normalizedOption === 'thin') {
    preview.lineWidth = 0.8
    return
  }

  const pointShape = compactPointShapeOptions[normalizedOption]
  if (pointShape !== undefined) {
    preview.pointShape = pointShape
    return
  }

  const color = parsePreviewColor(normalizedOption)

  if (color !== null) {
    preview.color = color
  }
}

function applyPreviewAssignment(
  preview: TikzStylePreviewApproximation,
  rawKey: string,
  rawValue: string,
): void {
  const key = rawKey.toLowerCase().replace(/\s+/g, ' ').trim()
  const value = rawValue.trim()
  const normalizedValue = value.toLowerCase().replace(/\s+/g, ' ').trim()

  switch (key) {
    case 'opacity':
      preview.opacity = parsePreviewOpacity(value) ?? preview.opacity
      return
    case 'fill opacity':
      preview.fillOpacity =
        parsePreviewOpacity(value) ?? preview.fillOpacity
      return
    case 'draw opacity':
      preview.drawOpacity =
        parsePreviewOpacity(value) ?? preview.drawOpacity
      return
    case 'draw': {
      const color = parsePreviewColor(value)
      if (color !== null) {
        preview.drawColor = color
      }
      return
    }
    case 'fill': {
      if (normalizedValue === 'none') {
        preview.pointFill = 'hollow'
        return
      }

      const color = parsePreviewColor(value)
      if (color !== null) {
        preview.fillColor = color
        preview.pointFill = 'filled'
      }
      return
    }
    case 'color': {
      const color = parsePreviewColor(value)
      if (color !== null) {
        preview.color = color
      }
      return
    }
    case 'text': {
      const color = parsePreviewColor(value)
      if (color !== null) {
        preview.textColor = color
      }
      return
    }
    case 'line width':
      preview.lineWidth =
        parsePreviewDimensionPt(value) ?? preview.lineWidth
      return
    case 'inner sep': {
      const innerSep = parsePreviewDimensionPt(value)
      if (innerSep !== null) {
        preview.pointSize = innerSep * 2
      }
      return
    }
    case 'minimum size':
      preview.pointSize =
        parsePreviewDimensionPt(value) ?? preview.pointSize
      return
    case 'shape': {
      const pointShape = compactPointShapeOptions[normalizedValue]
      if (pointShape !== undefined) {
        preview.pointShape = pointShape
      }
      return
    }
  }
}

function parseTikzOptionAssignment(
  option: string,
): { key: string; value: string } | null {
  const equalsIndex = option.indexOf('=')

  if (equalsIndex < 0) {
    return null
  }

  const key = option.slice(0, equalsIndex).trim()
  const value = option.slice(equalsIndex + 1).trim()

  return key.length === 0 || value.length === 0 ? null : { key, value }
}

function parsePreviewOpacity(value: string): number | null {
  const parsed = Number(normalizeLeadingDecimal(value.trim()))

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return null
  }

  return parsed
}

function parsePreviewDimensionPt(value: string): number | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(pt|mm|cm|in)?$/)

  if (match === null) {
    return null
  }

  const numericText = match[1]
  const unit = match[2] ?? 'pt'

  if (numericText === undefined) {
    return null
  }

  const parsed = Number(normalizeLeadingDecimal(numericText))

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  switch (unit) {
    case 'pt':
      return parsed
    case 'mm':
      return parsed * 2.83465
    case 'cm':
      return parsed * 28.3465
    case 'in':
      return parsed * 72
    default:
      return null
  }
}

function normalizeLeadingDecimal(value: string): string {
  return value.startsWith('.') ? `0${value}` : value
}

function parsePreviewColor(value: string): HexColor | null {
  const normalizedValue = value.toLowerCase().trim()
  const directColor = namedTikzColors[normalizedValue]

  if (directColor !== undefined) {
    return directColor
  }

  const mixMatch = normalizedValue.match(
    /^(black|white|gray|red|blue|green|yellow|orange|purple)!(\d+(?:\.\d*)?|\.\d+)$/,
  )

  if (mixMatch === null) {
    return null
  }

  const baseName = mixMatch[1]
  const percentText = mixMatch[2]

  if (baseName === undefined || percentText === undefined) {
    return null
  }

  const baseColor = namedTikzColors[baseName]
  const percent = Number(normalizeLeadingDecimal(percentText))

  if (baseColor === undefined || !Number.isFinite(percent)) {
    return null
  }

  return mixColors(baseColor, '#FFFFFF', clamp(percent / 100, 0, 1))
}

function mixColors(first: HexColor, second: HexColor, firstWeight: number): HexColor {
  const firstRgb = hexToRgb(first)
  const secondRgb = hexToRgb(second)
  const mixed = firstRgb.map((channel, index) =>
    Math.round(channel * firstWeight + secondRgb[index] * (1 - firstWeight)),
  )

  return rgbToHex(mixed)
}

function hexToRgb(color: HexColor): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}

function rgbToHex(rgb: readonly number[]): HexColor {
  const hex = rgb
    .map((channel) => clamp(Math.round(channel), 0, 255))
    .map((channel) => channel.toString(16).padStart(2, '0').toUpperCase())
    .join('')

  return `#${hex}`
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function curveStyleFromPreview(
  preview: TikzStylePreviewApproximation,
): CurveStyle {
  return {
    ...defaultCurveStyle,
    strokeColor:
      preview.drawColor ??
      preview.color ??
      preview.fillColor ??
      defaultCurveStyle.strokeColor,
    strokeOpacity:
      preview.drawOpacity ?? preview.opacity ?? defaultCurveStyle.strokeOpacity,
    lineWidth: preview.lineWidth ?? defaultCurveStyle.lineWidth,
    lineStyle: preview.lineStyle ?? defaultCurveStyle.lineStyle,
  }
}

function sheetStyleFromPreview(
  preview: TikzStylePreviewApproximation,
): SheetStyle {
  return filledSurfaceStyleFromPreview(defaultSheetStyle, preview)
}

function regionStyleFromPreview(
  preview: TikzStylePreviewApproximation,
): RegionStyle {
  return filledSurfaceStyleFromPreview(
    {
      ...defaultRegionStyle,
      fillOpacity:
        preview.fillColor !== undefined || preview.color !== undefined
          ? 0.35
          : defaultRegionStyle.fillOpacity,
    },
    preview,
  )
}

function filledSurfaceStyleFromPreview<TStyle extends RegionStyle | SheetStyle>(
  defaultStyle: TStyle,
  preview: TikzStylePreviewApproximation,
): TStyle {
  return {
    ...defaultStyle,
    fillColor:
      preview.fillColor ??
      preview.color ??
      preview.drawColor ??
      defaultStyle.fillColor,
    fillOpacity:
      preview.fillOpacity ?? preview.opacity ?? defaultStyle.fillOpacity,
    strokeColor:
      preview.drawColor ??
      preview.color ??
      preview.fillColor ??
      defaultStyle.strokeColor,
    strokeOpacity:
      preview.drawOpacity ?? preview.opacity ?? defaultStyle.strokeOpacity,
  }
}

function labelStyleFromPreview(
  preview: TikzStylePreviewApproximation,
): LabelStyle {
  return {
    ...defaultLabelStyle,
    color:
      preview.textColor ??
      preview.color ??
      preview.drawColor ??
      preview.fillColor ??
      defaultLabelStyle.color,
    opacity: preview.opacity ?? preview.drawOpacity ?? defaultLabelStyle.opacity,
  }
}

function pointStyleFromPreview(
  preview: TikzStylePreviewApproximation,
): PointStyle {
  return {
    ...defaultPointStyle,
    color:
      preview.drawColor ??
      preview.fillColor ??
      preview.color ??
      preview.textColor ??
      defaultPointStyle.color,
    opacity:
      preview.opacity ??
      preview.drawOpacity ??
      preview.fillOpacity ??
      defaultPointStyle.opacity,
    shape: preview.pointShape ?? defaultPointStyle.shape,
    fill: preview.pointFill ?? defaultPointStyle.fill,
    size: preview.pointSize ?? defaultPointStyle.size,
  }
}

function parseCurrentDirectoryEntry(entry: string): string | null {
  const marker = '/.cd'
  const markerIndex = entry.indexOf(marker)

  if (markerIndex < 0) {
    return null
  }

  const suffix = entry.slice(markerIndex + marker.length).trim()

  if (suffix.length > 0) {
    return null
  }

  return entry.slice(0, markerIndex).trim()
}

function parseStyleEntry(
  entry: string,
  currentDirectory: string,
):
  | { ok: true; style: ParsedTikzStyleDefinition }
  | { ok: false; warning: string } {
  const marker = '/.style'
  const markerIndex = entry.indexOf(marker)

  if (markerIndex < 0) {
    return {
      ok: false,
      warning: `Skipped unsupported tikzset entry: ${summarizeEntry(entry)}`,
    }
  }

  const rawKey = entry.slice(0, markerIndex).trim()

  if (rawKey.length === 0) {
    return {
      ok: false,
      warning: `Skipped style entry with an empty key: ${summarizeEntry(entry)}`,
    }
  }

  let index = markerIndex + marker.length
  index = skipWhitespace(entry, index)

  if (entry[index] !== '=') {
    return {
      ok: false,
      warning: `Skipped unsupported style handler syntax: ${summarizeEntry(
        entry,
      )}`,
    }
  }

  index = skipWhitespace(entry, index + 1)

  if (entry[index] !== '{') {
    return {
      ok: false,
      warning: `Skipped style entry without a braced option body: ${summarizeEntry(
        entry,
      )}`,
    }
  }

  const bracedContent = readBracedContent(entry, index)

  if (!bracedContent.ok) {
    return {
      ok: false,
      warning: `Skipped style entry with unbalanced braces: ${summarizeEntry(
        entry,
      )}`,
    }
  }

  if (entry.slice(bracedContent.endIndex + 1).trim().length > 0) {
    return {
      ok: false,
      warning: `Skipped style entry with unsupported trailing text: ${summarizeEntry(
        entry,
      )}`,
    }
  }

  return {
    ok: true,
    style: {
      key: resolveTikzKeyPath(currentDirectory, rawKey),
      options: normalizeImportedTikzStyleOptions(bracedContent.content),
    },
  }
}

function findTikzsetBlocks(
  text: string,
  warnings: TikzsetParserWarning[],
): string[] {
  const blocks: string[] = []
  let searchIndex = 0

  while (searchIndex < text.length) {
    const commandIndex = text.indexOf('\\tikzset', searchIndex)

    if (commandIndex < 0) {
      break
    }

    const openBraceIndex = skipWhitespace(
      text,
      commandIndex + '\\tikzset'.length,
    )

    if (text[openBraceIndex] !== '{') {
      warnings.push({
        message: 'Skipped \\tikzset without a braced argument.',
      })
      searchIndex = commandIndex + '\\tikzset'.length
      continue
    }

    const bracedContent = readBracedContent(text, openBraceIndex)

    if (!bracedContent.ok) {
      warnings.push({
        message: 'Skipped \\tikzset block with unbalanced braces.',
      })
      break
    }

    blocks.push(bracedContent.content)
    searchIndex = bracedContent.endIndex + 1
  }

  return blocks
}

function readBracedContent(text: string, openBraceIndex: number): BracedContentResult {
  if (text[openBraceIndex] !== '{') {
    return { ok: false }
  }

  let depth = 1
  let index = openBraceIndex + 1

  while (index < text.length) {
    const char = text[index]

    if (char === '\\') {
      index += 2
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return {
          ok: true,
          content: text.slice(openBraceIndex + 1, index),
          endIndex: index,
        }
      }
    }

    index += 1
  }

  return { ok: false }
}

function splitTopLevelCommaList(text: string): string[] {
  const entries: string[] = []
  let startIndex = 0
  let depth = 0
  let index = 0

  while (index < text.length) {
    const char = text[index]

    if (char === '\\') {
      index += 2
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      entries.push(text.slice(startIndex, index))
      startIndex = index + 1
    }

    index += 1
  }

  entries.push(text.slice(startIndex))

  return entries
}

function stripTexComments(text: string): string {
  const lines = text.split(/\r?\n/)

  return lines.map(stripTexCommentLine).join('\n')
}

function stripTexCommentLine(line: string): string {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '%' && !isEscaped(line, index)) {
      return line.slice(0, index)
    }
  }

  return line
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0
  let currentIndex = index - 1

  while (currentIndex >= 0 && text[currentIndex] === '\\') {
    slashCount += 1
    currentIndex -= 1
  }

  return slashCount % 2 === 1
}

function mergeDuplicateParsedStyles(
  styles: ParsedTikzStyleDefinition[],
  skipped: number,
  warnings: TikzsetParserWarning[],
): ParseTikzsetStylesResult {
  const keyOrder: string[] = []
  const stylesByKey = new Map<string, ParsedTikzStyleDefinition>()
  let skippedDuplicates = 0

  for (const style of styles) {
    if (stylesByKey.has(style.key)) {
      skippedDuplicates += 1
      warnings.push({
        message: `Duplicate style key "${style.key}" imported once using the later definition.`,
      })
    } else {
      keyOrder.push(style.key)
    }

    stylesByKey.set(style.key, style)
  }

  return {
    styles: keyOrder.flatMap((key) => {
      const style = stylesByKey.get(key)

      return style === undefined ? [] : [style]
    }),
    skipped: skipped + skippedDuplicates,
    warnings,
  }
}

function resolveTikzKeyPath(currentDirectory: string, rawPath: string): string {
  const trimmedPath = rawPath.trim()

  if (trimmedPath.startsWith('/')) {
    return normalizeTikzPath(trimmedPath)
  }

  return normalizeTikzPath(
    currentDirectory.length === 0
      ? trimmedPath
      : `${currentDirectory}/${trimmedPath}`,
  )
}

function normalizeTikzPath(path: string): string {
  const trimmedPath = path.trim()
  const isAbsolute = trimmedPath.startsWith('/')
  const normalizedPath = trimmedPath
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('/')

  // Absolute TikZ key paths are semantically different from relative ones:
  // `/tikz/wire` is usable as an explicit option key, while `tikz/wire` is a
  // relative path under the current TikZ key directory.
  return isAbsolute ? `/${normalizedPath}` : normalizedPath
}

function normalizeOptionList(options: string): string {
  return splitTopLevelCommaList(options)
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter((entry) => entry.length > 0)
    .join(',')
}

function skipWhitespace(text: string, startIndex: number): number {
  let index = startIndex

  while (index < text.length && /\s/.test(text[index])) {
    index += 1
  }

  return index
}

function summarizeEntry(entry: string): string {
  return normalizeSingleLineCommentText(entry, 'empty entry').slice(0, 120)
}

function uniqueImportedStyleId(
  preferredId: string,
  existingIds: readonly string[],
): string {
  const usedIds = new Set(existingIds)

  if (!usedIds.has(preferredId)) {
    return preferredId
  }

  let suffix = 2
  while (usedIds.has(`${preferredId}-${suffix}`)) {
    suffix += 1
  }

  return `${preferredId}-${suffix}`
}

function toKebabIdentifier(rawName: string): string {
  return (rawName.match(/[a-zA-Z0-9]+/g) ?? [])
    .map((word) => word.toLowerCase())
    .join('-')
}
