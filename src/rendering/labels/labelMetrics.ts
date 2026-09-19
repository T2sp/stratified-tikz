import type { LabelRun } from '../labelText.ts'

/** All returned geometry uses em, with the first alphabetic baseline at y=0. */
export type LabelMetrics = Readonly<{
  /** Run advance width; the composed layout width includes ink overhang. */
  width: number
  ascent: number
  descent: number
  /** Optional ink x coordinates, relative to the advance origin. */
  inkLeft?: number
  inkRight?: number
}>

export type LabelFont = Readonly<{
  family: string
  /** Measurement normalization size, in CSS pixels. Apply final scale once. */
  sizePx: number
  weight: string
  style: 'normal' | 'italic' | 'oblique'
  /** Change after font readiness changes to invalidate derived text layout. */
  fontReadinessGeneration: number
}>

export type TextMeasurementProvider = Readonly<{
  /** Different providers must use different stable identities in layout caches. */
  identity: string
  /** Values are CSS pixels, not em. Text contains neither tabs nor newlines. */
  measure(text: string, font: LabelFont): LabelMetrics
  lineMetrics(font: LabelFont): Readonly<{ ascent: number; descent: number }>
  ready?(font: LabelFont, text?: string): Promise<void>
}>

export type LabelLayoutSettings = Readonly<{
  font: LabelFont
  /** Tab stops every tabSize measured ordinary-space advances from line start. */
  tabSize: number
  /** Additional distance between one line's bottom and the next line's top. */
  lineGapEm: number
}>

type Placement = Readonly<{
  runIndex: number
  lineIndex: number
  x: number
  baseline: number
  width: number
  ascent: number
  descent: number
}>

/** textStart/textEnd index cooked run.text, not the authoritative source. */
export type LabelRunPlacement =
  | (Placement & Readonly<{ kind: 'text'; text: string; textStart: number; textEnd: number }>)
  | (Placement & Readonly<{ kind: 'math' }>)
  | (Placement & Readonly<{ kind: 'tab'; text: '\t'; textStart: number; textEnd: number }>)
  | (Placement & Readonly<{ kind: 'newline'; text: string; textStart: number; textEnd: number }>)

export type LabelLine = Readonly<{
  baseline: number
  width: number
  ascent: number
  descent: number
  minX: number
  maxX: number
}>

export type LabelLayout = Readonly<{
  metrics: LabelMetrics
  bounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>
  lines: readonly LabelLine[]
  placements: readonly LabelRunPlacement[]
}>

/** Limits also protect independently called measurement/layout boundaries. */
export const MAX_LABEL_LAYOUT_FRAGMENTS = 32_768
export const MAX_LABEL_METRIC_EM = 1_000_000

export class LabelMetricsError extends Error {
  readonly reason: 'invalid-metrics' | 'work-limit' | 'font'

  constructor(reason: LabelMetricsError['reason'], message: string) {
    super(message)
    this.name = 'LabelMetricsError'
    this.reason = reason
  }
}

export function validateLabelLayoutSettings(settings: LabelLayoutSettings): void {
  const { font } = settings
  if (
    font.family.trim().length === 0 || font.family.length > 1024 ||
    !Number.isFinite(font.sizePx) || font.sizePx <= 0 || font.sizePx > 4096 ||
    !/^(?:normal|bold|bolder|lighter|[1-9]\d{0,2}|1000)$/u.test(font.weight) ||
    !['normal', 'italic', 'oblique'].includes(font.style) ||
    !Number.isSafeInteger(font.fontReadinessGeneration) || font.fontReadinessGeneration < 0 ||
    !Number.isInteger(settings.tabSize) || settings.tabSize < 1 || settings.tabSize > 32 ||
    !Number.isFinite(settings.lineGapEm) || settings.lineGapEm < 0 || settings.lineGapEm > 100
  ) {
    throw new LabelMetricsError('invalid-metrics', 'Invalid label font or layout settings')
  }
}

function validateMetrics(metrics: LabelMetrics): void {
  if (
    ![metrics.width, metrics.ascent, metrics.descent].every((value) =>
      Number.isFinite(value) && value >= 0 && value <= MAX_LABEL_METRIC_EM) ||
    (metrics.inkLeft !== undefined &&
      (!Number.isFinite(metrics.inkLeft) || Math.abs(metrics.inkLeft) > MAX_LABEL_METRIC_EM)) ||
    (metrics.inkRight !== undefined &&
      (!Number.isFinite(metrics.inkRight) || Math.abs(metrics.inkRight) > MAX_LABEL_METRIC_EM)) ||
    (metrics.inkLeft ?? 0) > (metrics.inkRight ?? metrics.width)
  ) {
    throw new LabelMetricsError('invalid-metrics', 'Invalid label metrics')
  }
}

function normalizeTextMetrics(metrics: LabelMetrics, sizePx: number): LabelMetrics {
  const normalized = {
    width: metrics.width / sizePx,
    ascent: metrics.ascent / sizePx,
    descent: metrics.descent / sizePx,
    inkLeft: (metrics.inkLeft ?? 0) / sizePx,
    inkRight: (metrics.inkRight ?? metrics.width) / sizePx,
  }
  validateMetrics(normalized)
  return normalized
}

/**
 * Compose parser runs without changing their source or splitting math bodies.
 * mathMetrics is indexed by the original run index, with holes for text runs.
 * Text fragments retain spaces; tabs and CR/LF are explicit placement records.
 * No DOM nodes, model references, final paint, or camera state are retained.
 */
export function composeLabelLayout(
  runs: readonly LabelRun[],
  mathMetrics: readonly (LabelMetrics | undefined)[],
  settings: LabelLayoutSettings,
  provider: TextMeasurementProvider,
): LabelLayout {
  validateLabelLayoutSettings(settings)
  if (runs.length > MAX_LABEL_LAYOUT_FRAGMENTS) {
    throw new LabelMetricsError('work-limit', 'Too many label runs')
  }
  if (runs.length === 0) {
    return Object.freeze({
      metrics: Object.freeze({ width: 0, ascent: 0, descent: 0 }),
      bounds: Object.freeze({ minX: 0, minY: 0, maxX: 0, maxY: 0 }),
      lines: Object.freeze([]),
      placements: Object.freeze([]),
    })
  }

  const fontLine = provider.lineMetrics(settings.font)
  const lineMetrics = normalizeTextMetrics({ width: 0, ...fontLine }, settings.font.sizePx)
  type MutableLine = { baseline: number; width: number; ascent: number; descent: number; minX: number; maxX: number }
  const newLine = (): MutableLine => ({ baseline: 0, width: 0, ascent: lineMetrics.ascent, descent: lineMetrics.descent, minX: 0, maxX: 0 })
  const lines: MutableLine[] = [newLine()]
  const placements: LabelRunPlacement[] = []
  let lineIndex = 0
  let spaceAdvance: number | undefined

  const add = (placement: LabelRunPlacement, metrics: LabelMetrics): void => {
    if (placements.length >= MAX_LABEL_LAYOUT_FRAGMENTS) {
      throw new LabelMetricsError('work-limit', 'Too many label fragments')
    }
    validateMetrics(metrics)
    const line = lines[lineIndex]
    placements.push(placement)
    line.minX = Math.min(line.minX, line.width + (metrics.inkLeft ?? 0))
    line.maxX = Math.max(line.maxX, line.width + metrics.width, line.width + (metrics.inkRight ?? metrics.width))
    line.width += metrics.width
    line.ascent = Math.max(line.ascent, metrics.ascent)
    line.descent = Math.max(line.descent, metrics.descent)
    if (line.width > MAX_LABEL_METRIC_EM || Math.abs(line.minX) > MAX_LABEL_METRIC_EM || line.maxX > MAX_LABEL_METRIC_EM) {
      throw new LabelMetricsError('work-limit', 'Label layout exceeds metric limit')
    }
  }

  for (const [runIndex, run] of runs.entries()) {
    if (run.kind === 'math') {
      const metrics = mathMetrics[runIndex]
      if (metrics === undefined) {
        throw new LabelMetricsError('invalid-metrics', 'Missing math run metrics')
      }
      add({ kind: 'math', runIndex, lineIndex, x: lines[lineIndex].width, baseline: 0, ...metrics }, metrics)
      continue
    }
    // matchAll preserves CRLF as one break and never treats a math newline here.
    const fragments = run.text.matchAll(/\r\n|[\r\n\t]|[^\r\n\t]+/gu)
    for (const fragment of fragments) {
      const text = fragment[0]
      const textStart = fragment.index
      const textEnd = textStart + text.length
      const common = { runIndex, lineIndex, x: lines[lineIndex].width, baseline: 0, textStart, textEnd }
      if (text === '\n' || text === '\r' || text === '\r\n') {
        add({ kind: 'newline', text, ...common, width: 0, ascent: 0, descent: 0 }, { width: 0, ascent: 0, descent: 0 })
        lines.push(newLine())
        lineIndex++
      } else if (text === '\t') {
        spaceAdvance ??= normalizeTextMetrics(provider.measure(' ', settings.font), settings.font.sizePx).width
        if (spaceAdvance <= 0) {
          throw new LabelMetricsError('invalid-metrics', 'Space advance must be positive for tabs')
        }
        const tabWidth = settings.tabSize * spaceAdvance
        const x = lines[lineIndex].width
        // A tab precisely on a stop advances a full stop, including at x=0.
        const width = (Math.floor(x / tabWidth) + 1) * tabWidth - x
        const metrics = { width, ascent: 0, descent: 0 }
        add({ kind: 'tab', text, ...common, ...metrics }, metrics)
      } else {
        const metrics = normalizeTextMetrics(provider.measure(text, settings.font), settings.font.sizePx)
        add({ kind: 'text', text, ...common, ...metrics }, metrics)
      }
    }
  }

  for (let index = 1; index < lines.length; index++) {
    const previous = lines[index - 1]
    lines[index].baseline = previous.baseline + previous.descent + settings.lineGapEm + lines[index].ascent
  }
  const minX = Math.min(...lines.map((line) => line.minX))
  const maxX = Math.max(...lines.map((line) => line.maxX))
  const minY = -lines[0].ascent
  const last = lines[lines.length - 1]
  const maxY = last.baseline + last.descent
  if (![minX, maxX, minY, maxY].every((value) => Number.isFinite(value) && Math.abs(value) <= MAX_LABEL_METRIC_EM)
    || maxX - minX > MAX_LABEL_METRIC_EM || maxY - minY > MAX_LABEL_METRIC_EM) {
    throw new LabelMetricsError('work-limit', 'Label bounds exceed metric limit')
  }
  return Object.freeze({
    metrics: Object.freeze({ width: maxX - minX, ascent: -minY, descent: maxY, inkLeft: minX, inkRight: maxX }),
    bounds: Object.freeze({ minX, minY, maxX, maxY }),
    lines: Object.freeze(lines.map((line) => Object.freeze(line))),
    placements: Object.freeze(placements.map((placement) => Object.freeze({ ...placement, baseline: lines[placement.lineIndex].baseline }))),
  })
}

/** Browser-only measurement, created lazily; tests can supply deterministic metrics. */
export function createBrowserTextMeasurementProvider(): TextMeasurementProvider {
  let context: CanvasRenderingContext2D | null | undefined
  const getContext = (font: LabelFont): CanvasRenderingContext2D => {
    if (typeof document === 'undefined') {
      throw new LabelMetricsError('font', 'Browser canvas is unavailable')
    }
    context ??= document.createElement('canvas').getContext('2d')
    if (context === null) throw new LabelMetricsError('font', 'Canvas text metrics are unavailable')
    context.font = fontCss(font)
    context.textAlign = 'left'
    context.textBaseline = 'alphabetic'
    context.direction = 'ltr'
    return context
  }
  return Object.freeze({
    identity: 'browser-canvas-text-v1',
    async ready(font: LabelFont, text = 'Mg'): Promise<void> {
      if (typeof document === 'undefined' || document.fonts === undefined) {
        throw new LabelMetricsError('font', 'Browser font readiness is unavailable')
      }
      await document.fonts.load(fontCss(font), text)
      await document.fonts.ready
      if (!document.fonts.check(fontCss(font), text)) {
        throw new LabelMetricsError('font', 'Preview font did not become ready')
      }
    },
    measure(text: string, font: LabelFont): LabelMetrics {
      const measured = getContext(font).measureText(text)
      const metrics = {
        width: measured.width,
        ascent: Math.max(0, measured.actualBoundingBoxAscent),
        descent: Math.max(0, measured.actualBoundingBoxDescent),
        inkLeft: -measured.actualBoundingBoxLeft,
        inkRight: measured.actualBoundingBoxRight,
      }
      normalizeTextMetrics(metrics, font.sizePx)
      return metrics
    },
    lineMetrics(font: LabelFont): Readonly<{ ascent: number; descent: number }> {
      const measured = getContext(font).measureText('Mg')
      // Font boxes include normal line leading. Older browsers still provide
      // actual ink bounds; use measured glyphs, never a source-length heuristic.
      const ascent = measured.fontBoundingBoxAscent ?? measured.actualBoundingBoxAscent
      const descent = measured.fontBoundingBoxDescent ?? measured.actualBoundingBoxDescent
      normalizeTextMetrics({ width: 0, ascent, descent }, font.sizePx)
      return { ascent, descent }
    },
  })
}

function fontCss(font: LabelFont): string {
  return `${font.style} ${font.weight} ${font.sizePx}px ${font.family}`
}
