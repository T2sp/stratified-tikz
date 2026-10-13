import type { LabelAnchor, PointStyle } from '../model/types.ts'
import type { LabelLayoutSettings } from './labels/labelMetrics.ts'
import { normalizeSvgLabelFontSize, svgLabelFontFamily } from './labels/svgLabelLayout.ts'
import type { SvgLabelRuntime } from './labels/svgLabelRuntime.ts'
import { clonePointStyle } from '../model/styles.ts'
import { clonePointNodeDimensionSource } from '../model/pointNodeLayout.ts'
import type { CylinderDomainContext } from '../geometry/pointNodeShapes/cylinderDomain.ts'

/** Runtime-only committed label inputs. No model objects or callbacks are retained. */
export type SvgLabelExportCapture = Readonly<{
  runtime: SvgLabelRuntime
  /** When present this capture owns the entire point, including its contour. */
  pointStyle?: Readonly<PointStyle>
  /** Actual cylinder dimension source at this click; separate from saved style. */
  pointCylinderDomainContext?: Readonly<CylinderDomainContext>
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
    pointStyle: input.pointStyle === undefined ? undefined : freezePointStyle(input.pointStyle),
    ...(input.pointCylinderDomainContext === undefined ? {} : {
      pointCylinderDomainContext: freezeCylinderDomainContext(input.pointCylinderDomainContext),
    }),
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

function freezeCylinderDomainContext(context: Readonly<CylinderDomainContext>): Readonly<CylinderDomainContext> {
  const dimensionSources = Object.freeze(Object.fromEntries(Object.entries(context.dimensionSources).map(([field, value]) => {
    const source = clonePointNodeDimensionSource(value)
    if (source.fontContext) Object.freeze(source.fontContext)
    return [field, Object.freeze(source)]
  })))
  return Object.freeze({ dimensionSources, borderRotate: context.borderRotate, borderUsesIncircle: context.borderUsesIncircle })
}

function freezePointStyle(style: PointStyle): Readonly<PointStyle> {
  const copy = clonePointStyle(style)
  if (copy.shapeParameters) Object.freeze(copy.shapeParameters)
  if (copy.layout) {
    if (copy.layout.fontContext) Object.freeze(copy.layout.fontContext)
    if (copy.layout.units) {
      for (const unit of Object.values(copy.layout.units)) {
        if (unit.fontContext) Object.freeze(unit.fontContext)
        Object.freeze(unit)
      }
      Object.freeze(copy.layout.units)
    }
    Object.freeze(copy.layout)
  }
  if (copy.paint) {
    Object.freeze(copy.paint.text)
    Object.freeze(copy.paint.fill)
    if (copy.paint.stroke.dashPattern) Object.freeze(copy.paint.stroke.dashPattern)
    Object.freeze(copy.paint.stroke)
    Object.freeze(copy.paint)
  }
  return Object.freeze(copy)
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
