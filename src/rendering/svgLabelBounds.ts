import type { LabelAnchor, TextLabel } from '../model/types.ts'
import { normalizeSvgLabelFontSize } from './labels/svgLabelLayout.ts'

/** Committed renderer geometry only; never part of Diagram or its history. */
export type SvgFreeLabelBounds = Readonly<{
  source: string
  /** Display font size, including the established 1.35 preview scale. */
  fontSize: number
  anchor: LabelAnchor
  /** SVG viewport units, relative to the projected model position. */
  bounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>
}>

export type SvgFreeLabelBoundsSnapshot = ReadonlyMap<string, SvgFreeLabelBounds>

export function currentSvgLabelBounds(
  label: TextLabel,
  snapshot: SvgFreeLabelBoundsSnapshot,
): SvgFreeLabelBounds['bounds'] | null {
  const entry = snapshot.get(label.id)
  if (!entry || entry.source !== label.text
    || entry.fontSize !== normalizeSvgLabelFontSize(label.style.fontSize * 1.35)
    || entry.anchor !== label.style.anchor || label.text.length === 0) return null
  const bounds = entry.bounds
  if (!Object.values(bounds).every(Number.isFinite)
    || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return null
  return bounds
}
