import { createElement, type ReactElement, type Ref, type SVGProps } from 'react'
import type { ValidatedSvgElement } from './labels/labelSvg.ts'
import { placeSvgLabel } from './labels/svgLabelLayout.ts'
import type { SvgLabelState } from './labels/svgLabelRuntime.ts'
import type { SvgLabelExportCapture } from './svgLabelExportRegistry.ts'

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
  outline: SvgLabelExportCapture['outline'], inheritedPaint: GeometryPaint): ReactElement {
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

export type SvgTexLabelViewProps = Readonly<{
  capture: SvgLabelExportCapture
  state: SvgLabelState
  elementRef?: Ref<SVGGElement>
}>

/**
 * One synchronous view for preview commits and detached export rendering.
 * The caller supplies the state; rendering never schedules conversion or effects.
 */
export function SvgTexLabelView({ capture, state, elementRef }: SvgTexLabelViewProps): ReactElement {
  const { source, position, fontSize, fontFamily, color, opacity, anchor,
    ownerIdentity, outline, boundsTarget, settings } = capture
  const placement = placeSvgLabel(state.layout, fontSize, anchor)
  const textAttributes: SVGProps<SVGTextElement> = {
    fontFamily, fontSize, fontWeight: '400', fontStyle: 'normal',
    textAnchor: 'start', dominantBaseline: 'alphabetic', direction: 'ltr',
    xmlSpace: 'preserve', style: { whiteSpace: 'pre', tabSize: settings.tabSize,
      fontKerning: 'normal', textRendering: 'optimizeLegibility' }, fill: color,
  }
  const bounds = placement.bounds
  const successful = state.status === 'ready' && state.result?.kind === 'success' ? state.result : undefined

  function content(halo?: SvgLabelExportCapture['outline']): ReactElement[] {
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
        return [createElement('svg', {
          key: index, ...rootAttributes, 'data-label-math': halo ? undefined : 'true',
          x: (item.x - geometry.offsetX) * fontSize,
          y: (item.baseline + geometry.viewBox[1] / geometry.unitsPerEm) * fontSize,
          width: geometry.viewBox[2] / geometry.unitsPerEm * fontSize,
          height: geometry.viewBox[3] / geometry.unitsPerEm * fontSize,
          viewBox: geometry.viewBox.join(' '), overflow: 'visible',
        }, geometry.svg.children.map((child, childIndex) => typeof child === 'string'
          ? child : svgGeometryElement(child, color, childIndex, halo, rootPaint)))]
      }
      if (item.kind !== 'text') return []
      return [createElement('text', {
        key: index, ...textAttributes, 'data-label-literal': successful || halo ? undefined : 'true',
        fill: halo?.color ?? color, stroke: halo?.color, strokeWidth: halo?.width,
        strokeLinejoin: halo ? 'round' : undefined, vectorEffect: halo ? 'non-scaling-stroke' : undefined,
        x: item.x * fontSize, y: item.baseline * fontSize,
        textLength: state.estimated && item.width > 0 ? item.width * fontSize : undefined,
        lengthAdjust: state.estimated ? 'spacingAndGlyphs' : undefined,
      }, item.text)]
    })
  }

  return createElement('g', {
    ref: elementRef,
    transform: `translate(${position.x} ${position.y})`,
    'data-label-state': state.status,
    'data-label-source': source,
    'data-label-request': state.requestIdentity,
    'data-label-owner': ownerIdentity,
    'data-label-bounds': `${bounds.minX} ${bounds.minY} ${bounds.maxX} ${bounds.maxY}`,
    'aria-label': source,
    role: 'img',
  },
  createElement('title', null, source),
  boundsTarget && source !== '' && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY
    ? createElement('rect', {
      x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY,
      fill: 'transparent', 'data-svg-export-exclude': 'true',
    }) : null,
  createElement('g', {
    transform: `translate(${placement.offsetX} ${placement.offsetY})`, opacity,
    fill: color, color, pointerEvents: 'none',
  },
  outline ? createElement('g', {
    'data-label-halo': 'true', 'aria-hidden': 'true', pointerEvents: 'none',
  }, content(outline)) : null,
  createElement('g', { 'data-label-content': 'true' }, content())))
}
