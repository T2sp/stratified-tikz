import { tikzStyleTargets } from './types.ts'
import type {
  Diagram,
  ExternalTikzStyleSource,
  ImportedTikzStyleReference,
  TikzStyleTarget,
} from './types.ts'

const defaultExternalStyleSourceName = 'External TikZ style source'
const defaultImportedTikzStyleTargets = [...tikzStyleTargets]

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
      displayName: normalizeImportedTikzStyleDisplayName(style.key, style.key),
      targets: [...defaultImportedTikzStyleTargets],
      options: style.options,
    } satisfies ImportedTikzStyleReference
  })

  return {
    diagram: {
      ...diagram,
      externalTikzStyleSources: [
        ...(diagram.externalTikzStyleSources ?? []),
        source,
      ],
      importedTikzStyleReferences: [
        ...(diagram.importedTikzStyleReferences ?? []),
        ...references,
      ],
    },
    source,
    references,
    parseResult,
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
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length === 0 ? fallback : normalized
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
  return path
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('/')
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
