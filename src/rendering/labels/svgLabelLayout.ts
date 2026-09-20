import type { LabelAnchor } from '../../model/types.ts'
import {
  composeLabelLayout,
  type LabelLayout,
  type LabelLayoutSettings,
  type TextMeasurementProvider,
} from './labelMetrics.ts'

/** The previous inherited preview font, now explicit for rendering and measuring. */
export const svgLabelFontFamily = "Inter, ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"

export type SvgLabelBounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>
export type SvgLabelPlacement = Readonly<{
  offsetX: number
  offsetY: number
  /** SVG user units, relative to the projected model position. */
  bounds: SvgLabelBounds
}>

/** Keep the displayed font, measurement, and runtime bounds on one safe scale. */
export function normalizeSvgLabelFontSize(fontSize: number): number {
  return Number.isFinite(fontSize) && fontSize > 0 ? Math.min(fontSize, 4096) : 16
}

export function svgLabelLayoutSettings(
  fontSize: number,
  fontFamily = svgLabelFontFamily,
  fontReadinessGeneration = 0,
): LabelLayoutSettings {
  return Object.freeze({
    font: Object.freeze({ family: fontFamily, sizePx: normalizeSvgLabelFontSize(fontSize), weight: '400',
      style: 'normal' as const, fontReadinessGeneration }),
    tabSize: 4,
    lineGapEm: 0.2,
  })
}

/** Used only until real measurement is available, or when that boundary fails. */
const emergencyMeasurement: TextMeasurementProvider = Object.freeze({
  identity: 'svg-label-finite-emergency-v1',
  measure: (text, font) => ({ width: Math.min([...text].length * 0.6, 65_536) * font.sizePx,
    ascent: 0.8 * font.sizePx, descent: 0.2 * font.sizePx }),
  lineMetrics: (font) => ({ ascent: 0.8 * font.sizePx, descent: 0.2 * font.sizePx }),
})

/** Unknown metrics must not manufacture a diagram-sized picking rectangle. */
function boundEmergencyLayout(layout: LabelLayout): LabelLayout {
  const widthScale = Math.min(1, 256 / Math.max(layout.bounds.maxX, 1))
  const lastBaseline = layout.lines.at(-1)?.baseline ?? 0
  const heightScale = Math.min(1, 255 / Math.max(lastBaseline, 1))
  if (widthScale === 1 && heightScale === 1) return layout
  const maxY = lastBaseline * heightScale + (layout.lines.at(-1)?.descent ?? 0)
  return Object.freeze({
    metrics: Object.freeze({ ...layout.metrics, width: layout.metrics.width * widthScale,
      descent: maxY, inkLeft: (layout.metrics.inkLeft ?? 0) * widthScale,
      inkRight: (layout.metrics.inkRight ?? layout.metrics.width) * widthScale }),
    bounds: Object.freeze({ minX: layout.bounds.minX * widthScale, minY: layout.bounds.minY,
      maxX: layout.bounds.maxX * widthScale, maxY }),
    lines: Object.freeze(layout.lines.map((line) => Object.freeze({ ...line,
      baseline: line.baseline * heightScale, width: line.width * widthScale,
      minX: line.minX * widthScale, maxX: line.maxX * widthScale }))),
    placements: Object.freeze(layout.placements.map((item) => Object.freeze({ ...item,
      x: item.x * widthScale, baseline: item.baseline * heightScale, width: item.width * widthScale,
      inkLeft: (item.inkLeft ?? 0) * widthScale,
      inkRight: (item.inkRight ?? item.width) * widthScale }))),
  })
}

export type LiteralLabelLayout = Readonly<{ layout: LabelLayout; estimated: boolean }>

/** Always uses the complete original input, never the parser's cooked runs. */
export function literalSvgLabelLayout(
  source: string,
  settings: LabelLayoutSettings,
  measurement?: TextMeasurementProvider,
): LiteralLabelLayout {
  const runs = source === '' ? [] : [{ kind: 'text' as const, text: source,
    sourceStart: 0, sourceEnd: source.length }]
  if (measurement !== undefined) {
    try {
      return Object.freeze({ layout: composeLabelLayout(runs, [], settings, measurement), estimated: false })
    } catch { /* A measurement error must not replace or erase the source. */ }
  }
  const safeSettings = svgLabelLayoutSettings(
    Number.isFinite(settings.font.sizePx) && settings.font.sizePx > 0 && settings.font.sizePx <= 4096
      ? settings.font.sizePx : 16,
  )
  try {
    return Object.freeze({ layout: boundEmergencyLayout(composeLabelLayout(runs, [], safeSettings, emergencyMeasurement)), estimated: true })
  } catch {
    // A source exceeding the fragment/layout work bound still remains fully
    // visible. Lay it out as physical lines, with finite, compressed emergency
    // dimensions. SVG textLength enforces these widths without losing characters.
    const lines = source.split(/\r\n|[\r\n]/u)
    const lineStep = Math.min(1.2, 65_536 / Math.max(lines.length, 1))
    const placements = lines.map((text, lineIndex) => Object.freeze({
      kind: 'text' as const, runIndex: 0, lineIndex, text,
      textStart: 0, textEnd: text.length, x: 0, baseline: lineIndex * lineStep,
      width: Math.min([...text].length * 0.6, 65_536), ascent: 0.8, descent: 0.2,
    }))
    const width = placements.reduce((value, item) => Math.max(value, item.width), 0)
    const maxY = (lines.length - 1) * lineStep + 0.2
    return Object.freeze({ estimated: true, layout: boundEmergencyLayout(Object.freeze({
      bounds: Object.freeze({ minX: 0, minY: -0.8, maxX: width, maxY }),
      metrics: Object.freeze({ width, ascent: 0.8, descent: maxY }),
      placements: Object.freeze(placements),
      lines: Object.freeze(placements.map((item) => Object.freeze({ baseline: item.baseline,
        width: item.width, ascent: item.ascent, descent: item.descent, minX: 0, maxX: item.width }))),
    })) })
  }
}

/** A single measured placement policy for display and hit testing. */
export function placeSvgLabel(
  layout: LabelLayout,
  fontSize: number,
  anchor: LabelAnchor,
): SvgLabelPlacement {
  const scale = Number.isFinite(fontSize) && fontSize > 0 && fontSize <= 4096 ? fontSize : 0
  const input = layout.bounds
  const usable = [input.minX, input.minY, input.maxX, input.maxY].every((value) =>
    Number.isFinite(value) && Math.abs(value) <= 1_000_000)
    && input.minX <= input.maxX && input.minY <= input.maxY
  const bounds = usable ? {
    minX: input.minX * scale, minY: input.minY * scale,
    maxX: input.maxX * scale, maxY: input.maxY * scale,
  } : { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const offsetX = anchor.includes('west') ? -bounds.minX
    : anchor.includes('east') ? -bounds.maxX : -(bounds.minX + bounds.maxX) / 2
  const offsetY = anchor.includes('north') ? -bounds.minY
    : anchor.includes('south') ? -bounds.maxY : -(bounds.minY + bounds.maxY) / 2
  return Object.freeze({ offsetX, offsetY, bounds: Object.freeze({
    minX: bounds.minX + offsetX || 0, minY: bounds.minY + offsetY || 0,
    maxX: bounds.maxX + offsetX || 0, maxY: bounds.maxY + offsetY || 0,
  }) })
}
