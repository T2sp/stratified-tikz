import { createElement, useCallback, useLayoutEffect, useMemo } from 'react'
import type { PointStyle, Vec2 } from '../model/types.ts'
import { useSvgLabelState } from './labels/useSvgLabelState.ts'
import type { SvgLabelRuntime } from './labels/svgLabelRuntime.ts'
import { captureSvgLabelExport, registerSvgLabelExportCapture } from './svgLabelExportRegistry.ts'
import { svgPointNodeLayout, type SvgPointNodeCommit } from './svgPointNodeLayout.ts'
import { svgPointNodeTextFontFamily, svgPointNodeTextFontSize } from './svgPointNodeText.ts'
import { SvgPointNodeView } from './svgPointNodeView.ts'
import { getPointPaint } from '../model/styles.ts'

export function SvgPointNode({ runtime, source, position, style, ownerIdentity, selected, onLayout }: {
  runtime: SvgLabelRuntime; source: string; position: Vec2; style: PointStyle; ownerIdentity: string
  selected: boolean; onLayout: (snapshot: SvgPointNodeCommit | null) => void
}) {
  const { state, settings, fontGeneration } = useSvgLabelState(runtime, source,
    svgPointNodeTextFontSize, svgPointNodeTextFontFamily, ownerIdentity)
  const snapshot = useMemo(() => Object.freeze({ source, ownerIdentity, fontGeneration,
    shape: style.shape, size: style.size, requestIdentity: state.requestIdentity,
    layout: svgPointNodeLayout(style, state) }), [source, ownerIdentity, fontGeneration, style, state])
  useLayoutEffect(() => {
    onLayout(snapshot)
    return () => onLayout(null)
  }, [onLayout, snapshot])
  const textPaint = getPointPaint(style).text
  const capture = useMemo(() => captureSvgLabelExport({ runtime, source, position,
    fontSize: svgPointNodeTextFontSize, fontFamily: svgPointNodeTextFontFamily,
    color: textPaint.color, opacity: style.opacity * textPaint.opacity, anchor: 'center', ownerIdentity,
    boundsTarget: false, settings, pointStyle: style }), [runtime, source, position, style, textPaint.color, textPaint.opacity, ownerIdentity, settings])
  const elementRef = useCallback((node: SVGGElement | null) => node === null
    ? undefined : registerSvgLabelExportCapture(node, capture), [capture])
  return createElement(SvgPointNodeView, { capture, state, selected, elementRef })
}
