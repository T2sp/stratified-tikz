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
  /** Identity-matched committed view, removed when this mount no longer owns it. */
  onLayout?: (snapshot: SvgTexLabelSnapshot | null) => void
}>

const attributeNames: Readonly<Record<string, string>> = {
  'stroke-width': 'strokeWidth', 'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset', 'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin', 'fill-rule': 'fillRule',
  'fill-opacity': 'fillOpacity', 'stroke-opacity': 'strokeOpacity',
}

/** The adapter's allowlisted immutable tree becomes fresh React-owned SVG. */
function svgGeometryElement(node: ValidatedSvgElement, color: string, key: number | string): ReactElement {
  const attributes: Record<string, string | number> = { key }
  for (const [name, value] of Object.entries(node.attributes)) {
    attributes[attributeNames[name] ?? name] = typeof value === 'string' ? value : color
  }
  return createElement(node.tag, attributes,
    node.children.map((child, index) => typeof child === 'string' ? child : svgGeometryElement(child, color, index)))
}

export function SvgTexLabel({ runtime, source, position, fontSize: requestedFontSize, fontFamily = svgLabelFontFamily,
  color, opacity, anchor, onLayout }: SvgTexLabelProps): ReactElement {
  const fontSize = normalizeSvgLabelFontSize(requestedFontSize)
  const fontGeneration = useSyncExternalStore(runtime.subscribeFontChanges,
    runtime.getFontGeneration, runtime.getFontGeneration)
  const settings = useMemo(() => svgLabelLayoutSettings(fontSize, fontFamily, fontGeneration),
    [fontSize, fontFamily, fontGeneration])
  const request = useMemo(() => Object.freeze({ source, settings }), [source, settings])
  const requestIdentity = svgLabelRequestIdentity(request)
  const controller = useMemo(() => createSvgLabelController(runtime), [runtime])
  const committed = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const immediate = useMemo(() => initialSvgLabelState(request, runtime), [request, runtime])
  const state = committed?.requestIdentity === requestIdentity ? committed : immediate
  const placement = useMemo(() => placeSvgLabel(state.layout, fontSize, anchor), [state.layout, fontSize, anchor])
  const snapshot = useMemo(() => Object.freeze({ ...state, fontSize, fontFamily, anchor,
    placement, bounds: placement.bounds }), [state, fontSize, fontFamily, anchor, placement])

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

  return (
    <g
      transform={`translate(${position.x} ${position.y})`}
      data-label-state={state.status}
      data-label-source={source}
      data-label-request={requestIdentity}
      data-label-bounds={`${bounds.minX} ${bounds.minY} ${bounds.maxX} ${bounds.maxY}`}
      aria-label={source}
      role="img"
    >
      <title>{source}</title>
      {source !== '' && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY && (
        <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX - bounds.minX} height={bounds.maxY - bounds.minY}
          fill="transparent" data-svg-export-exclude="true" />
      )}
      <g transform={`translate(${placement.offsetX} ${placement.offsetY})`} opacity={opacity}
        fill={color} color={color} pointerEvents="none">
        {state.layout.placements.map((item, index) => {
          if (item.kind === 'math') {
            const geometry = successful?.runs[item.runIndex]?.geometry
            if (geometry === undefined) return null
            const rootAttributes: Record<string, string> = {}
            for (const [name, value] of Object.entries(geometry.svg.attributes)) {
              if (!['width', 'height', 'viewBox', 'xmlns'].includes(name)) {
                rootAttributes[attributeNames[name] ?? name] = typeof value === 'string' ? value : color
              }
            }
            return (
              <svg key={index} {...rootAttributes} data-label-math="true"
                x={(item.x - geometry.offsetX) * fontSize}
                y={(item.baseline + geometry.viewBox[1] / geometry.unitsPerEm) * fontSize}
                width={geometry.viewBox[2] / geometry.unitsPerEm * fontSize}
                height={geometry.viewBox[3] / geometry.unitsPerEm * fontSize}
                viewBox={geometry.viewBox.join(' ')} overflow="visible">
                {geometry.svg.children.map((child, childIndex) => typeof child === 'string'
                  ? child : svgGeometryElement(child, color, childIndex))}
              </svg>
            )
          }
          if (item.kind !== 'text') return null
          return (
            <text key={index} {...textAttributes} data-label-literal={successful ? undefined : 'true'}
              x={item.x * fontSize} y={item.baseline * fontSize}
              textLength={state.estimated && item.width > 0 ? item.width * fontSize : undefined}
              lengthAdjust={state.estimated ? 'spacingAndGlyphs' : undefined}>
              {item.text}
            </text>
          )
        })}
      </g>
    </g>
  )
}
