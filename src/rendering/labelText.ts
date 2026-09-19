/** Maximum input length in JavaScript UTF-16 code units; never truncate source. */
export const MAX_LABEL_SOURCE_LENGTH = 16_384
/** Maximum total text/math runs in one label; empty text runs are omitted. */
export const MAX_LABEL_RUNS = 256

/**
 * Half-open JavaScript string offsets (UTF-16, not Unicode code points).
 * Runs partition source exactly; math spans include both outer delimiters.
 * Cooked text and TeX bodies are preview data, never fallback authorities.
 */
export type LabelRun =
  | Readonly<{
      kind: 'text'
      sourceStart: number
      sourceEnd: number
      text: string
    }>
  | Readonly<{
      kind: 'math'
      sourceStart: number
      sourceEnd: number
      tex: string
      display: boolean
    }>

export type ParsedLabel =
  | Readonly<{
      kind: 'parsed'
      source: string
      runs: readonly LabelRun[]
    }>
  | Readonly<{
      kind: 'fallback'
      source: string
      reason: 'invalid-delimiter' | 'unsupported-text' | 'limit'
    }>

type MathDelimiter = '$' | '$$' | '\\(' | '\\['

/**
 * Pure, linear preview scanner. No TeX validation/expansion or line layout.
 * Newlines stay inside their text/math run, and source is always authoritative.
 * $$ wins over $ when opening; a $ closer consumes only one dollar, so
 * $x$$y$ is two adjacent inline runs. A $$ closer requires both dollars.
 * Failures discard every derived run, including an already successful prefix.
 */
export function parseLabelText(source: string): ParsedLabel {
  const fallback = (reason: Extract<ParsedLabel, { kind: 'fallback' }>['reason']): ParsedLabel =>
    ({ kind: 'fallback', source, reason })

  if (source.length > MAX_LABEL_SOURCE_LENGTH) {
    return fallback('limit')
  }

  const runs: LabelRun[] = []
  let textParts: string[] = []
  let textStart = 0
  let cursor = 0

  const appendText = (): boolean => {
    if (textStart === cursor) return true
    if (runs.length >= MAX_LABEL_RUNS) return false
    runs.push({
      kind: 'text',
      sourceStart: textStart,
      sourceEnd: cursor,
      text: textParts.join(''),
    })
    textParts = []
    return true
  }

  while (cursor < source.length) {
    const character = source[cursor]
    const next = source[cursor + 1]
    let opener: MathDelimiter

    if (character === '$') {
      opener = next === '$' ? '$$' : '$'
    } else if (character === '\\') {
      if (next === '(' || next === '[') {
        opener = next === '(' ? '\\(' : '\\['
      } else if (next === ')' || next === ']') {
        return fallback('invalid-delimiter')
      } else if (next !== undefined && '$%&_#{}'.includes(next)) {
        textParts.push(next)
        cursor += 2
        continue
      } else {
        // Includes text-mode commands, a trailing backslash, and TeX \\.
        return fallback('unsupported-text')
      }
    } else {
      textParts.push(character)
      cursor++
      continue
    }

    if (!appendText() || runs.length >= MAX_LABEL_RUNS) {
      return fallback('limit')
    }
    const mathRun = scanMathRun(source, cursor, opener)
    if (mathRun === null) return fallback('invalid-delimiter')
    runs.push(mathRun)
    cursor = mathRun.sourceEnd
    textStart = cursor
  }

  if (!appendText()) return fallback('limit')
  return { kind: 'parsed', source, runs }
}

function scanMathRun(
  source: string,
  sourceStart: number,
  opener: MathDelimiter,
): Extract<LabelRun, { kind: 'math' }> | null {
  const closer = opener === '\\(' ? '\\)' : opener === '\\[' ? '\\]' : opener
  const bodyStart = sourceStart + opener.length
  let cursor = bodyStart
  let braceDepth = 0

  while (cursor < source.length) {
    const character = source[cursor]
    const next = source[cursor + 1]

    if (braceDepth === 0) {
      if (source.startsWith(closer, cursor)) {
        return {
          kind: 'math',
          sourceStart,
          sourceEnd: cursor + closer.length,
          tex: source.slice(bodyStart, cursor),
          display: opener === '$$' || opener === '\\[',
        }
      }
      if (
        character === '$' ||
        (character === '\\' && next !== undefined && '()[]'.includes(next))
      ) {
        return null
      }
    }

    if (character === '\\') {
      // Consume escaped tokens together, including \\, \$, \{ and \}.
      // This gives backslash parity without rescanning earlier characters.
      cursor += 2
      continue
    }
    if (character === '{') braceDepth++
    if (character === '}') {
      if (braceDepth === 0) return null
      braceDepth--
    }
    cursor++
  }

  return null
}
