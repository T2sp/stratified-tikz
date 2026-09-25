import { tikzStyleTargets } from './types.ts'
import { canonicalTikzStyleKey, literalDefinedColor, namedTikzColors, resolveTikzPaint, splitTikzOptions } from './importedTikzPaint.ts'
import type { TikzColorBindings, TikzPaintPreview, TikzPreviewContext, TikzStylePreviewDefinition } from './importedTikzPaint.ts'
import { createUserStylePresetFromStyle } from './stylePresets.ts'
import {
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
  getPointPaint,
  defaultRegionStyle,
  defaultSheetStyle,
  createImportedPointPaintSnapshot,
  refreshImportedPointPaintSnapshot,
} from './styles.ts'
import type {
  CurveStyle,
  Diagram,
  ExternalTikzStyleSource,
  HexColor,
  ImportedTikzStyleReference,
  LabelStyle,
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
const colorSignalTokens = Object.keys(namedTikzColors)
export type TikzStylePreviewApproximation = TikzPaintPreview

export type ParsedTikzStyleDefinition = {
  key: string
  options: string
}

export type ParsedTikzStyleDeclaration =
  | ({ kind: 'definition' } & ParsedTikzStyleDefinition)
  | { kind: 'mutation'; key: string; diagnostic: string; dependencyOptions?: readonly string[] }

export type TikzsetParserWarning = {
  message: string
}

export type ParseTikzsetStylesResult = {
  styles: ParsedTikzStyleDefinition[]
  declarations?: ParsedTikzStyleDeclaration[]
  skipped: number
  warnings: TikzsetParserWarning[]
  rawOptions?: Record<string, string>
  colors?: TikzColorBindings
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
  if (text.length > 1_000_000) return { styles: [], skipped: 1, warnings: [{ message: 'Style file exceeds the 1000000-character preview bound.' }] }
  const declarations: ParsedTikzStyleDeclaration[] = []
  const colors: Record<string, HexColor | null> = {}
  const rawOptions: Record<string, string> = Object.create(null) as Record<string, string>
  let skipped = 0
  // Mask comments without changing offsets, retaining the exact source separately.
  const stripped = maskTexComments(text)
  const commands = /\\(tikzset|tikzstyle|definecolor)\b/g
  for (let command = commands.exec(stripped); command !== null; command = commands.exec(stripped)) {
    const first = readBracedContent(stripped, skipWhitespace(stripped, commands.lastIndex))
    if (!first.ok) { warnings.push({ message: `Skipped malformed \\${command[1]} argument.` }); skipped += 1; continue }
    if (command[1] === 'tikzset') {
      const parsed = parseTikzsetBlock(first.content, warnings, text.slice(first.endIndex - first.content.length, first.endIndex), rawOptions)
      declarations.push(...parsed.declarations)
      skipped += parsed.skipped
      commands.lastIndex = first.endIndex + 1
    } else if (command[1] === 'tikzstyle') {
      let index = skipWhitespace(stripped, first.endIndex + 1)
      const append = stripped[index] === '+'
      if (append) index = skipWhitespace(stripped, index + 1)
      if (stripped[index] === '=') index = skipWhitespace(stripped, index + 1)
      const body = readDelimitedContent(stripped, index, '[', ']')
      if (!body.ok || !first.content.trim()) { warnings.push({ message: 'Skipped malformed \\tikzstyle declaration.' }); skipped += 1; continue }
      const key = normalizeTikzPath(first.content)
      if (append) {
        const mutation = parseUnsupportedStyleMutation(`${key}/.append style={${body.content}}`, '')
        if (mutation !== null) declarations.push(mutation)
        warnings.push({ message: mutation?.diagnostic ?? 'Skipped unsupported nonliteral \\tikzstyle append target.' })
        skipped += 1
      } else {
        const style = { key, options: normalizeImportedTikzStyleOptions(body.content) }
        declarations.push({ kind: 'definition', ...style })
        rawOptions[key] = text.slice(index + 1, body.endIndex)
      }
      commands.lastIndex = body.endIndex + 1
    } else {
      const model = readBracedContent(stripped, skipWhitespace(stripped, first.endIndex + 1))
      const value = model.ok ? readBracedContent(stripped, skipWhitespace(stripped, model.endIndex + 1)) : { ok: false as const }
      const color = model.ok && value.ok ? literalDefinedColor(model.content, value.content) : null
      const nameSupported = /^[a-zA-Z][a-zA-Z0-9:_-]*$/.test(first.content)
      // A recognized declaration shadows an earlier binding even when its
      // model/value is outside our literal grammar. In particular, CMYK red
      // cannot silently fall back to the built-in red table.
      if (nameSupported) colors[first.content] = color
      if (color === null || !nameSupported) warnings.push({ message: `Unsupported literal \\definecolor: ${first.content}` })
      commands.lastIndex = value.ok ? value.endIndex + 1 : first.endIndex + 1
    }
    if (declarations.length > 512) { warnings.push({ message: 'Style file exceeds the 512-definition preview bound.' }); declarations.length = 512; break }
  }
  return { ...mergeDuplicateParsedStyles(declarations.flatMap((declaration) => declaration.kind === 'definition' ? [{ key: declaration.key, options: declaration.options }] : []), skipped, warnings), declarations, rawOptions, colors }
}

/**
 * The diagram's source array is the load order. Reconstruct the final color
 * environment and canonical style definitions in that same order everywhere.
 * Raw sources describe what loading a file defines; saved reference options
 * remain the fallback for old files that predate raw-source preservation.
 */
export function createImportedTikzResolutionContext(
  diagram: {
    externalTikzStyleSources?: readonly ExternalTikzStyleSource[]
    importedTikzStyleReferences?: readonly ImportedTikzStyleReference[]
  },
): TikzPreviewContext {
  const styles = new Map<string, TikzStylePreviewDefinition>()
  const addFallback = (reference: ImportedTikzStyleReference) => {
    const identity = canonicalTikzStyleKey(reference.key)
    // A saved option snapshot is not a later supported source declaration.
    // Never let it turn an explicitly invalidated definition back into known.
    if (styles.get(identity)?.state !== 'unresolved') {
      styles.set(identity, { key: reference.key, options: reference.options, sourceId: reference.sourceId })
    }
  }
  const colors: Record<string, HexColor | null> = {}
  const colorSourceIds: Record<string, string> = {}
  const sources = diagram.externalTikzStyleSources ?? []
  const references = diagram.importedTikzStyleReferences ?? []
  const sourceIds = sources.map((source) => source.id)
  for (const source of sources) {
    const parsed = source.rawSource === undefined ? undefined : parseTikzsetStyles(source.rawSource)
    const parsedKeys = new Set((parsed?.declarations ?? []).map((declaration) => canonicalTikzStyleKey(declaration.key)))
    for (const declaration of parsed?.declarations ?? []) {
      const identity = canonicalTikzStyleKey(declaration.key)
      if (declaration.kind === 'definition') {
        styles.set(identity, { key: declaration.key, options: declaration.options, sourceId: source.id })
      } else {
        const previous = styles.get(identity)
        styles.set(identity, {
          key: declaration.key,
          options: previous?.options,
          sourceId: source.id,
          state: 'unresolved',
          diagnostics: [...new Set([...(previous?.state === 'unresolved' ? previous.diagnostics : []), declaration.diagnostic])],
          dependencyOptions: [...(previous?.dependencyOptions ?? []), ...(declaration.dependencyOptions ?? [])],
          sourceDependencies: [...new Set([
            ...(previous?.sourceDependencies ?? []),
            ...(previous?.sourceId === undefined ? [] : [previous.sourceId]),
            source.id,
          ])],
        })
      }
    }
    for (const reference of references) {
      if (reference.sourceId === source.id && !parsedKeys.has(canonicalTikzStyleKey(reference.key))) {
        addFallback(reference)
      }
    }
    for (const [name, value] of Object.entries(parsed?.colors ?? {})) {
      colors[name] = value
      colorSourceIds[name] = source.id
    }
  }
  // Preserve readable legacy references even when their source metadata is
  // missing. Their stable reference order follows all known source loads.
  for (const reference of references) {
    if (!sourceIds.includes(reference.sourceId)) {
      addFallback(reference)
    }
  }
  return { styles: [...styles.values()], colors, colorSourceIds, sourceIds: [...new Set([...sourceIds, ...references.map((reference) => reference.sourceId)])] }
}

/** Invoke the key, so an older reference ID never selects a stale root body. */
export function resolveImportedTikzStyle(
  reference: ImportedTikzStyleReference,
  context: TikzPreviewContext,
): TikzPaintPreview {
  const preview = resolveTikzPaint(reference.key, { ...context, key: undefined })
  const dependencies = new Set([reference.sourceId, ...(preview.sourceDependencies ?? [])])
  return {
    ...preview,
    sourceDependencies: [...new Set([...(context.sourceIds ?? []), ...dependencies])].filter((sourceId) => dependencies.has(sourceId)),
  }
}

export function importedTikzStylePresetStyle(kind: 'point', reference: ImportedTikzStyleReference, context: TikzPreviewContext): PointStyle
export function importedTikzStylePresetStyle(kind: StylePresetKind, reference: ImportedTikzStyleReference, context: TikzPreviewContext): CurveStyle | SheetStyle | RegionStyle | LabelStyle | PointStyle
export function importedTikzStylePresetStyle(
  kind: StylePresetKind,
  reference: ImportedTikzStyleReference,
  context: TikzPreviewContext,
): CurveStyle | SheetStyle | RegionStyle | LabelStyle | PointStyle {
  return styleFromPreview(kind, resolveImportedTikzStyle(reference, context))
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
    rawSource: text,
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
      rawOptions: parseResult.rawOptions?.[style.key] ?? style.options,
      previewDiagnostics: [] as string[],
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
  const context = createImportedTikzResolutionContext(diagramWithReferences)
  for (const reference of references) {
    reference.previewDiagnostics = resolveImportedTikzStyle(reference, context).diagnostics ?? []
    for (const message of reference.previewDiagnostics) parseResult.warnings.push({ message: `${reference.key}: ${message}` })
  }
  diagramWithReferences.importedTikzStyleReferences = diagramWithReferences.importedTikzStyleReferences?.map((reference) => ({
    ...reference,
    previewDiagnostics: resolveImportedTikzStyle(reference, context).diagnostics ?? [],
  }))

  return {
    diagram: refreshImportedPointSnapshots(addDetectedImportedStylePresets(diagramWithReferences, references, context), context),
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

  return uniqueStylePresetKinds(detectedKinds.length === 0 ? ['point'] : detectedKinds)
}

export function parseTikzStylePreviewOptions(
  options: string,
  context: TikzPreviewContext = {},
): TikzStylePreviewApproximation {
  return resolveTikzPaint(options, context)
}

export function importedStylePresetStyle(
  kind: StylePresetKind,
  options: string | undefined,
  context: TikzPreviewContext = {},
): CurveStyle | SheetStyle | RegionStyle | LabelStyle | PointStyle {
  const preview =
    options === undefined ? {} : parseTikzStylePreviewOptions(options, context)
  return styleFromPreview(kind, preview)
}

function styleFromPreview(
  kind: StylePresetKind,
  preview: TikzStylePreviewApproximation,
): CurveStyle | SheetStyle | RegionStyle | LabelStyle | PointStyle {
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
  declarations: ParsedTikzStyleDeclaration[]
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
  rawBlock?: string,
  rawOptions?: Record<string, string>,
): TikzsetBlockParseResult {
  const entries = splitTopLevelCommaList(block)
  const declarations: ParsedTikzStyleDeclaration[] = []
  let currentDirectory = ''
  let skipped = 0
  let entryOffset = 0

  for (const entry of entries) {
    const rawEntry = rawBlock?.slice(entryOffset, entryOffset + entry.length)
    entryOffset += entry.length + 1
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
      declarations.push({ kind: 'definition', ...styleResult.style })
      if (rawOptions && rawEntry !== undefined) {
        const opening = entry.indexOf('{', entry.indexOf('/.style'))
        const body = readBracedContent(entry, opening)
        if (body.ok) rawOptions[styleResult.style.key] = rawEntry.slice(opening + 1, body.endIndex)
      }
      continue
    }

    const mutation = parseUnsupportedStyleMutation(trimmedEntry, currentDirectory)
    if (mutation !== null) declarations.push(mutation)
    skipped += 1
    warnings.push({ message: mutation?.diagnostic ?? styleResult.warning })
  }

  return { declarations, skipped }
}

function addDetectedImportedStylePresets(
  diagram: Diagram,
  references: readonly ImportedTikzStyleReference[],
  context: TikzPreviewContext,
): Diagram {
  let nextDiagram = diagram

  for (const reference of references) {
    for (const kind of importedStylePresetKindsForReference(reference)) {
      const resolvedStyle = importedTikzStylePresetStyle(kind, reference, context)
      const style = resolvedStyle.kind === 'pointStyle'
        ? createImportedPointPaintSnapshot(resolvedStyle, reference.id)
        : resolvedStyle
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

/** Only importer-owned snapshots follow later definitions; authored values stay. */
function refreshImportedPointSnapshots(diagram: Diagram, context: TikzPreviewContext): Diagram {
  const references = new Map((diagram.importedTikzStyleReferences ?? []).map((reference) => [reference.id, reference]))
  const refresh = (style: PointStyle, referenceId: string | undefined): PointStyle => {
    if (referenceId === undefined || style.importedPaint?.referenceId !== referenceId) return style
    const reference = references.get(referenceId)
    return reference === undefined ? style : refreshImportedPointPaintSnapshot(style, importedTikzStylePresetStyle('point', reference, context), referenceId)
  }
  return {
    ...diagram,
    strata: diagram.strata.map((stratum) => stratum.geometricKind === 'point'
      ? { ...stratum, style: refresh(stratum.style, stratum.importedTikzStyleReferenceId) }
      : stratum),
    userStylePresets: diagram.userStylePresets?.map((preset) => preset.kind === 'point'
      ? { ...preset, style: refresh(preset.style, preset.importedTikzStyleReferenceId) }
      : preset),
  }
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
    ...(preview.lineWidth === undefined ? {} : { lineWidth: preview.lineWidth }),
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
  const defaults = getPointPaint(defaultPointStyle)
  const fillColor = preview.fillColor ?? preview.color ?? defaults.fill.color
  const strokeColor = preview.drawColor ?? preview.color ?? defaults.stroke.color
  return {
    ...defaultPointStyle,
    color: strokeColor,
    opacity: 1,
    shape: preview.pointShape ?? defaultPointStyle.shape,
    fill: defaultPointStyle.fill,
    size: preview.pointSize ?? defaultPointStyle.size,
    paint: {
      text: { color: preview.textColor ?? preview.color ?? defaults.text.color, opacity: preview.textOpacity ?? preview.fillOpacity ?? preview.opacity ?? 1 },
      fill: { enabled: preview.fillEnabled ?? defaults.fill.enabled, color: fillColor, opacity: preview.fillOpacity ?? preview.opacity ?? 1 },
      stroke: {
        ...defaults.stroke,
        enabled: preview.drawEnabled ?? defaults.stroke.enabled,
        color: strokeColor,
        opacity: preview.drawOpacity ?? preview.opacity ?? 1,
        width: preview.lineWidth ?? defaults.stroke.width,
        lineStyle: preview.lineStyle ?? defaults.stroke.lineStyle,
        ...(preview.dashPattern === undefined ? {} : { dashPattern: [...preview.dashPattern] }),
        dashPhase: preview.dashPhase ?? defaults.stroke.dashPhase,
        lineCap: preview.lineCap ?? defaults.stroke.lineCap,
        lineJoin: preview.lineJoin ?? defaults.stroke.lineJoin,
      },
    },
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

/** Recognize literal targets, without interpreting or executing handler bodies. */
function parseUnsupportedStyleMutation(entry: string, currentDirectory: string): Extract<ParsedTikzStyleDeclaration, { kind: 'mutation' }> | null {
  const marker = entry.indexOf('/.')
  if (marker < 0) return null
  const target = entry.slice(0, marker).trim()
  // TeX control sequences, parameter tokens, groups and active characters do
  // not identify a literal target. Handler chains are still recognizable even
  // though their expansion/argument semantics remain unsupported.
  if (!target || /[\\{}#=$%~^&]/.test(target)) return null
  const handlerMatch = entry.slice(marker + 2).match(/^([a-zA-Z][a-zA-Z0-9\s]*(?:\/\.[a-zA-Z][a-zA-Z0-9\s]*)*)=/)
  if (handlerMatch === null) return null
  const handler = handlerMatch[1].trim().replace(/\s+/g, ' ')
  const dependencyOptions: string[] = []
  // These handlers take option lists. Retain their bounded literal arguments
  // only to discover required load hints, never to apply their paint semantics.
  const baseHandler = handler.split('/.')[0]
  const bodies = baseHandler === 'add style' ? 2 : ['append style', 'prefix style'].includes(baseHandler) ? 1 : 0
  let index = marker + 2 + handlerMatch[0].length
  for (let bodyIndex = 0; bodyIndex < bodies; bodyIndex += 1) {
    const body = readBracedContent(entry, skipWhitespace(entry, index))
    if (!body.ok) {
      if (bodies === 1) dependencyOptions.push(entry.slice(index).trim())
      break
    }
    dependencyOptions.push(body.content)
    index = body.endIndex + 1
  }
  const key = resolveTikzKeyPath(currentDirectory, target)
  return {
    kind: 'mutation',
    key,
    diagnostic: `Unsupported style mutation ${key}/.${handler}; paint preview uses a fallback and remains unresolved.`,
    ...(dependencyOptions.length === 0 ? {} : { dependencyOptions }),
  }
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

function maskTexComments(text: string): string {
  return text.split(/(\r?\n)/).map((line) => {
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === '\\') { index += 1; continue }
      if (line[index] === '%') return line.slice(0, index) + ' '.repeat(line.length - index)
    }
    return line
  }).join('')
}

function readDelimitedContent(text: string, start: number, open: string, close: string): BracedContentResult {
  if (text[start] !== open) return { ok: false }
  let depth = 1
  let braces = 0
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\\') { index += 1; continue }
    if (char === '{') braces += 1
    if (char === '}') braces -= 1
    if (braces !== 0) continue
    if (char === open) depth += 1
    if (char === close) depth -= 1
    if (depth === 0) return { ok: true, content: text.slice(start + 1, index), endIndex: index }
  }
  return { ok: false }
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

function splitTopLevelCommaList(text: string): string[] { return splitTikzOptions(text) }

function mergeDuplicateParsedStyles(
  styles: ParsedTikzStyleDefinition[],
  skipped: number,
  warnings: TikzsetParserWarning[],
): ParseTikzsetStylesResult {
  const keyOrder: string[] = []
  const stylesByKey = new Map<string, ParsedTikzStyleDefinition>()
  let skippedDuplicates = 0

  for (const style of styles) {
    const identity = canonicalTikzStyleKey(style.key)
    if (stylesByKey.has(identity)) {
      skippedDuplicates += 1
      warnings.push({
        message: `Duplicate style key "${style.key}" imported once using the later definition.`,
      })
    } else {
      keyOrder.push(identity)
    }

    stylesByKey.set(identity, style)
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
