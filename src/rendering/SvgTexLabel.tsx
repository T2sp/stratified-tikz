import { useSvgLabelState } from './labels/useSvgLabelState.ts'
import { createElement, useCallback, useLayoutEffect, useMemo, type ReactElement } from 'react'
import type { LabelAnchor } from '../model/types.ts'
import { captureSvgLabelExport, registerSvgLabelExportCapture } from './svgLabelExportRegistry.ts'
import { SvgTexLabelView } from './svgLabelView.ts'
import {
  placeSvgLabel,
  svgLabelFontFamily,
  type SvgLabelBounds,
  type SvgLabelPlacement,
} from './labels/svgLabelLayout.ts'
import {
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

export function SvgTexLabel({ runtime, source, position, fontSize: requestedFontSize, fontFamily = svgLabelFontFamily,
  color, opacity, anchor, ownerIdentity, outline, boundsTarget = true, onLayout }: SvgTexLabelProps): ReactElement {
  const { state, settings, fontSize } = useSvgLabelState(runtime, source, requestedFontSize, fontFamily, ownerIdentity)
  const placement = useMemo(() => placeSvgLabel(state.layout, fontSize, anchor), [state.layout, fontSize, anchor])
  const snapshot = useMemo(() => Object.freeze({ ...state, ownerIdentity, fontSize, fontFamily, anchor,
    placement, bounds: placement.bounds }), [state, ownerIdentity, fontSize, fontFamily, anchor, placement])

  useLayoutEffect(() => {
    onLayout?.(snapshot)
    return () => onLayout?.(null)
  }, [onLayout, snapshot])

  const capture = useMemo(() => captureSvgLabelExport({
    runtime, source, position, fontSize, fontFamily, color, opacity, anchor,
    ownerIdentity, outline, boundsTarget, settings,
  }), [runtime, source, position, fontSize, fontFamily, color, opacity, anchor,
    ownerIdentity, outline, boundsTarget, settings])
  const elementRef = useCallback((node: SVGGElement | null) => node === null
    ? undefined : registerSvgLabelExportCapture(node, capture), [capture])

  return createElement(SvgTexLabelView, { capture, state, elementRef })
}
