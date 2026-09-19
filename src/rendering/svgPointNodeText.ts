import { svgPointNodeTexPointScale } from './svgPointNodeGeometry.ts'

export { svgPointNodeTexPointScale } from './svgPointNodeGeometry.ts'

// Keep the canvas measurement and SVG text attributes in the same font. The
// preview approximates TikZ's default 10 pt text using a 12 px serif font.
export const svgPointNodeTextFontSize = 10 * svgPointNodeTexPointScale
export const svgPointNodeTextFontFamily = 'Times New Roman, Times, serif'
export const maxSvgPointNodeTextLayoutCacheSize = 512

export type SvgPointNodeTextLayout = {
  text: string
  width: number
  height: number
  // SVG y increases downwards, so this offsets an alphabetic baseline to put
  // the middle of the text's ink bounds at the node's center.
  baselineOffset: number
}

export type SvgPointNodeTextMetrics = {
  width: number
  actualBoundingBoxAscent?: number
  actualBoundingBoxDescent?: number
}

export type SvgPointNodeTextMeasurer = (
  text: string,
) => SvgPointNodeTextMetrics | null

const maxCachedTextLength = 4096
let canvasContext: CanvasRenderingContext2D | null | undefined

/**
 * A separate measurer keeps canvas access optional and lets geometry tests use
 * known font metrics without needing a DOM or platform-dependent fonts.
 */
export function createPointNodeTextLayoutMeasurer(
  measureText: SvgPointNodeTextMeasurer = measureTextOnCanvas,
): (text?: string) => SvgPointNodeTextLayout {
  const layouts = new Map<string, SvgPointNodeTextLayout>()

  return (rawText = '') => {
    // TikZ's ordinary node text is one line unless explicit TeX layout is
    // requested. Normalize ASCII whitespace for this single-line preview only;
    // preserve nonbreaking/wide spaces and all literal LaTeX source characters.
    const text = rawText.replace(/[ \t\r\n\f]+/g, ' ').replace(/^ | $/g, '')

    if (text.length === 0) {
      return { text, width: 0, height: 0, baselineOffset: 0 }
    }

    const cached = layouts.get(text)

    if (cached !== undefined) {
      // Refresh insertion order so repeatedly drawn nodes survive eviction.
      layouts.delete(text)
      layouts.set(text, cached)
      return cached
    }

    const fallback = fallbackTextMetrics(text)
    let metrics: SvgPointNodeTextMetrics | null

    try {
      metrics = measureText(text)
    } catch {
      metrics = null
    }

    const width =
      metrics !== null && Number.isFinite(metrics.width) && metrics.width >= 0
        ? metrics.width
        : fallback.width
    const measuredAscent = metrics?.actualBoundingBoxAscent
    const measuredDescent = metrics?.actualBoundingBoxDescent
    const hasInkBounds =
      measuredAscent !== undefined &&
      measuredDescent !== undefined &&
      Number.isFinite(measuredAscent) &&
      Number.isFinite(measuredDescent) &&
      measuredAscent + measuredDescent >= 0
    const ascent = hasInkBounds ? measuredAscent : fallback.ascent
    const descent = hasInkBounds ? measuredDescent : fallback.descent
    const layout = {
      text,
      width,
      height: ascent + descent,
      baselineOffset: (ascent - descent) / 2,
    }

    // Also bound the size of individual keys: a pasted document should not be
    // retained hundreds of times while its node text is being edited.
    if (text.length <= maxCachedTextLength) {
      if (layouts.size >= maxSvgPointNodeTextLayoutCacheSize) {
        const oldestKey = layouts.keys().next().value

        if (oldestKey !== undefined) {
          layouts.delete(oldestKey)
        }
      }

      layouts.set(text, layout)
    }

    return layout
  }
}

export const getPointNodeTextLayout = createPointNodeTextLayoutMeasurer()

function measureTextOnCanvas(text: string): SvgPointNodeTextMetrics | null {
  if (typeof document === 'undefined') {
    return null
  }

  if (canvasContext === undefined) {
    // Cache failure as well as success for environments without canvas support.
    canvasContext = null

    try {
      canvasContext = document.createElement('canvas').getContext('2d')

      if (canvasContext !== null) {
        canvasContext.font = `${svgPointNodeTextFontSize}px ${svgPointNodeTextFontFamily}`
        canvasContext.textAlign = 'left'
        canvasContext.textBaseline = 'alphabetic'
      }
    } catch {
      return null
    }
  }

  return canvasContext?.measureText(text) ?? null
}

function fallbackTextMetrics(text: string): {
  width: number
  ascent: number
  descent: number
} {
  let width = 0
  let ascent = 0
  let descent = 0

  for (const character of text) {
    if (/\p{Mark}/u.test(character)) {
      // Combining marks occupy no additional advance width.
      ascent = Math.max(ascent, 0.9)
      continue
    }

    if (character === ' ' || character === '\u00a0') {
      width += 0.25
      continue
    }

    if (/[\u3000-\u9fff\uac00-\ud7af]/u.test(character) || character.length > 1) {
      width += 1
      ascent = Math.max(ascent, 0.85)
      descent = Math.max(descent, 0.1)
      continue
    }

    if (/[iljI!|.,:;'`]/u.test(character)) {
      width += 0.28
    } else if (/[MW@%]/u.test(character)) {
      width += 0.9
    } else if (/[mw]/u.test(character)) {
      width += 0.75
    } else if (/[A-Z]/u.test(character)) {
      width += 0.67
    } else if (/[()[\]{}ft]/u.test(character)) {
      width += 0.33
    } else {
      width += 0.5
    }

    const isXHeightLetter =
      /[a-z]/u.test(character) && !/[bdfhklt]/u.test(character)
    ascent = Math.max(ascent, isXHeightLetter ? 0.46 : 0.7)

    if (/[gjpqy,;()[\]{}]/u.test(character)) {
      descent = Math.max(descent, 0.2)
    }
  }

  return {
    width: width * svgPointNodeTextFontSize,
    ascent: ascent * svgPointNodeTextFontSize,
    descent: descent * svgPointNodeTextFontSize,
  }
}
