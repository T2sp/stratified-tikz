import { createElement, useLayoutEffect, useMemo, useSyncExternalStore, type ReactElement, type SVGProps } from 'react'
import type { LabelAnchor } from '../model/types.ts'
import type { ValidatedSvgElement } from './labels/labelSvg.ts'
import {
  placeSvgLabel,
  normalizeSvgLabelFontSize,
  svgLabelFontFamily,
  svgLabelLayoutSettings,
  type SvgLabelBounds,
  type SvgLabelPlacement,
} from './labels/svgLabelLayout.ts'
import {
  createSvgLabelController,
  initialSvgLabelState,
  svgLabelRequestIdentity,
  type SvgLabelRuntime,
  type SvgLabelState,
} from './labels/svgLabelRuntime.ts'

export type SvgTexLabelSnapshot = SvgLabelState & Readonly<{
  ownerIdentity?: string
  fontSize: number
  fontFamily: string
  anchor: LabelAnchor
  placement: SvgLabelPlacement
  bounds: SvgLabelBounds
}>

export type SvgTexLabelProps = Readonly<{
  runtime: SvgLabelRuntime
  source: string
  position: Readonly<{ x: number; y: number }>
  /** Final SVG units; callers retain the established free-label 1.35 scale. */
  fontSize: number
  fontFamily?: string
  color: string
  opacity: number
  anchor: LabelAnchor
  ownerIdentity?: string
  /** Display-unit halo behind the complete foreground, never inside its paint. */
  outline?: Readonly<{ color: string; width: number }>
  /** Inline nodes retain marker-only picking; free labels keep their bounds target. */
  boundsTarget?: boolean
  /** Identity-matched committed view, removed when this mount no longer owns it. */
  onLayout?: (snapshot: SvgTexLabelSnapshot | null) => void
}>

const attributeNames: Readonly<Record<string, string>> = {
  'stroke-width': 'strokeWidth', 'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset', 'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin', 'fill-rule': 'fillRule',
  'fill-opacity': 'fillOpacity', 'stroke-opacity': 'strokeOpacity',
}

type GeometryPaint = Readonly<{
  fill: string; stroke: string; fillOpacity: number; strokeOpacity: number; strokeWidth: number
}>

function inheritedGeometryPaint(attributes: Readonly<Record<string, string | number>>, parent: GeometryPaint): GeometryPaint {
  return {
    fill: String(attributes.fill ?? parent.fill), stroke: String(attributes.stroke ?? parent.stroke),
    fillOpacity: Number(attributes.fillOpacity ?? parent.fillOpacity),
    strokeOpacity: Number(attributes.strokeOpacity ?? parent.strokeOpacity),
    strokeWidth: Number(attributes.strokeWidth ?? parent.strokeWidth),
  }
}

function paintAlpha(paint: string): number {
  if (paint === 'none' || paint === 'transparent') return 0
  // The adapter only admits validated explicit CSS paints (including rgba).
  const alpha = /^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]*)\)$/i.exec(paint)?.[1].trim()
  return alpha === undefined ? 1 : Number.parseFloat(alpha) / (alpha.endsWith('%') ? 100 : 1)
}

/** The adapter's allowlisted immutable tree becomes fresh React-owned SVG. */
function svgGeometryElement(node: ValidatedSvgElement, color: string, key: number | string,
  outline: SvgTexLabelProps['outline'], inheritedPaint: GeometryPaint): ReactElement {
  const attributes: Record<string, string | number> = { key }
  for (const [name, value] of Object.entries(node.attributes)) {
    attributes[attributeNames[name] ?? name] = typeof value === 'string' ? value : color
  }
  const paint = inheritedGeometryPaint(attributes, inheritedPaint)
  if (outline !== undefined && node.tag !== 'g') {
    // Geometry may contain several nested MathJax scales (e.g. subscripts).
    // Non-scaling strokes on each primitive keep the halo in display units.
    const fillAlpha = paintAlpha(paint.fill) * paint.fillOpacity
    const strokeAlpha = paint.strokeWidth > 0 ? paintAlpha(paint.stroke) * paint.strokeOpacity : 0
    attributes.fill = fillAlpha > 0 ? outline.color : 'none'
    attributes.fillOpacity = fillAlpha
    attributes.stroke = fillAlpha > 0 || strokeAlpha > 0 ? outline.color : 'none'
    attributes.strokeOpacity = Math.max(fillAlpha, strokeAlpha)
    attributes.strokeWidth = outline.width
    attributes.strokeLinejoin = 'round'
    attributes.vectorEffect = 'non-scaling-stroke'
  }
  return createElement(node.tag, attributes,
    node.children.map((child, index) => typeof child === 'string' ? child : svgGeometryElement(child, color, index, outline, paint)))
}

export function SvgTexLabel({ runtime, source, position, fontSize: requestedFontSize, fontFamily = svgLabelFontFamily,
  color, opacity, anchor, ownerIdentity, outline, boundsTarget = true, onLayout }: SvgTexLabelProps): ReactElement {
  const fontSize = normalizeSvgLabelFontSize(requestedFontSize)
  const fontGeneration = useSyncExternalStore(runtime.subscribeFontChanges,
    runtime.getFontGeneration, runtime.getFontGeneration)
  const settings = useMemo(() => svgLabelLayoutSettings(fontSize, fontFamily, fontGeneration),
    [fontSize, fontFamily, fontGeneration])
  const request = useMemo(() => Object.freeze({ source, settings, ownerIdentity }), [source, settings, ownerIdentity])
  const requestIdentity = svgLabelRequestIdentity(request)
  const controller = useMemo(() => createSvgLabelController(runtime), [runtime])
  const committed = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const immediate = useMemo(() => initialSvgLabelState(request, runtime), [request, runtime])
  const state = committed?.requestIdentity === requestIdentity ? committed : immediate
  const placement = useMemo(() => placeSvgLabel(state.layout, fontSize, anchor), [state.layout, fontSize, anchor])
  const snapshot = useMemo(() => Object.freeze({ ...state, ownerIdentity, fontSize, fontFamily, anchor,
    placement, bounds: placement.bounds }), [state, ownerIdentity, fontSize, fontFamily, anchor, placement])

  useLayoutEffect(() => controller.start(request), [controller, request])
  useLayoutEffect(() => {
    onLayout?.(snapshot)
    return () => onLayout?.(null)
  }, [onLayout, snapshot])

  const textAttributes: SVGProps<SVGTextElement> = {
    fontFamily, fontSize, fontWeight: '400', fontStyle: 'normal',
    textAnchor: 'start', dominantBaseline: 'alphabetic', direction: 'ltr',
    xmlSpace: 'preserve', style: { whiteSpace: 'pre', tabSize: settings.tabSize,
      fontKerning: 'normal', textRendering: 'optimizeLegibility' }, fill: color,
  }
  const bounds = placement.bounds
  const successful = state.status === 'ready' && state.result?.kind === 'success' ? state.result : undefined

  function content(halo?: SvgTexLabelProps['outline']): ReactElement[] {
    return state.layout.placements.flatMap((item, index) => {
      if (item.kind === 'math') {
        const geometry = successful?.runs[item.runIndex]?.geometry
        if (geometry === undefined) return []
        const rootAttributes: Record<string, string> = {}
        for (const [name, value] of Object.entries(geometry.svg.attributes)) {
          if (!['width', 'height', 'viewBox', 'xmlns'].includes(name)) {
            rootAttributes[attributeNames[name] ?? name] = typeof value === 'string' ? value : color
          }
        }
        const rootPaint = inheritedGeometryPaint(rootAttributes,
          { fill: color, stroke: 'none', fillOpacity: 1, strokeOpacity: 1, strokeWidth: 1 })
        return [
          <svg key={index} {...rootAttributes} data-label-math={halo ? undefined : 'true'}
            x={(item.x - geometry.offsetX) * fontSize}
            y={(item.baseline + geometry.viewBox[1] / geometry.unitsPerEm) * fontSize}
            width={geometry.viewBox[2] / geometry.unitsPerEm * fontSize}
            height={geometry.viewBox[3] / geometry.unitsPerEm * fontSize}
            viewBox={geometry.viewBox.join(' ')} overflow="visible">
            {geometry.svg.children.map((child, childIndex) => typeof child === 'string'
              ? child : svgGeometryElement(child, color, childIndex, halo, rootPaint))}
          </svg>,
        ]
      }
      if (item.kind !== 'text') return []
      return [
        <text key={index} {...textAttributes} data-label-literal={successful || halo ? undefined : 'true'}
          fill={halo?.color ?? color} stroke={halo?.color} strokeWidth={halo?.width}
          strokeLinejoin={halo ? 'round' : undefined} vectorEffect={halo ? 'non-scaling-stroke' : undefined}
          x={item.x * fontSize} y={item.baseline * fontSize}
          textLength={state.estimated && item.width > 0 ? item.width * fontSize : undefined}
          lengthAdjust={state.estimated ? 'spacingAndGlyphs' : undefined}>
          {item.text}
        </text>,
      ]
    })
  }

  return (
    <g
      transform={`translate(${position.x} ${position.y})`}
      data-label-state={state.status}
      data-label-source={source}
      data-label-request={requestIdentity}
      data-label-owner={ownerIdentity}
      data-label-bounds={`${bounds.minX} ${bounds.minY} ${bounds.maxX} ${bounds.maxY}`}
      aria-label={source}
      role="img"
    >
      <title>{source}</title>
      {boundsTarget && source !== '' && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY && (
        <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX - bounds.minX} height={bounds.maxY - bounds.minY}
          fill="transparent" data-svg-export-exclude="true" />
      )}
      <g transform={`translate(${placement.offsetX} ${placement.offsetY})`} opacity={opacity}
        fill={color} color={color} pointerEvents="none">
        {outline && <g data-label-halo="true" aria-hidden="true" pointerEvents="none">{content(outline)}</g>}
        <g data-label-content="true">{content()}</g>
      </g>
    </g>
  )
}
