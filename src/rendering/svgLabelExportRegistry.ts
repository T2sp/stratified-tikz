import type { LabelAnchor, PointStyle } from '../model/types.ts'
import type { LabelLayoutSettings } from './labels/labelMetrics.ts'
import { normalizeSvgLabelFontSize, svgLabelFontFamily } from './labels/svgLabelLayout.ts'
import type { SvgLabelRuntime } from './labels/svgLabelRuntime.ts'

/** Runtime-only committed label inputs. No model objects or callbacks are retained. */
export type SvgLabelExportCapture = Readonly<{
  runtime: SvgLabelRuntime
  /** When present this capture owns the entire point, including its contour. */
  pointStyle?: Readonly<PointStyle>
  source: string
  position: Readonly<{ x: number; y: number }>
  fontSize: number
  fontFamily: string
  color: string
  opacity: number
  anchor: LabelAnchor
  ownerIdentity?: string
  outline?: Readonly<{ color: string; width: number }>
  boundsTarget: boolean
  settings: LabelLayoutSettings
}>

type SvgLabelExportCaptureInput = Omit<SvgLabelExportCapture, 'fontFamily' | 'boundsTarget'>
  & Readonly<{ fontFamily?: string; boundsTarget?: boolean }>

/** Copy mutable visual values before the first export suspension. */
export function captureSvgLabelExport(input: SvgLabelExportCaptureInput): SvgLabelExportCapture {
  return Object.freeze({
    runtime: input.runtime,
    pointStyle: input.pointStyle === undefined ? undefined : Object.freeze({ ...input.pointStyle }),
    source: input.source,
    position: Object.freeze({ x: input.position.x, y: input.position.y }),
    fontSize: normalizeSvgLabelFontSize(input.fontSize),
    fontFamily: input.fontFamily ?? svgLabelFontFamily,
    color: input.color,
    opacity: input.opacity,
    anchor: input.anchor,
    ownerIdentity: input.ownerIdentity,
    outline: input.outline === undefined ? undefined
      : Object.freeze({ color: input.outline.color, width: input.outline.width }),
    boundsTarget: input.boundsTarget ?? true,
    settings: Object.freeze({
      font: Object.freeze({ ...input.settings.font }),
      tabSize: input.settings.tabSize,
      lineGapEm: input.settings.lineGapEm,
    }),
  })
}

const captures = new WeakMap<Element, SvgLabelExportCapture>()

/** Ref callbacks register only committed nodes, never a speculative React render. */
export function registerSvgLabelExportCapture(
  node: SVGGElement,
  capture: SvgLabelExportCapture,
): () => void {
  captures.set(node, capture)
  return () => {
    if (captures.get(node) === capture) captures.delete(node)
  }
}

export function getSvgLabelExportCapture(node: Element): SvgLabelExportCapture | undefined {
  return captures.get(node)
}
