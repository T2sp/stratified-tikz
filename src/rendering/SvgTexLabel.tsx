import { createElement, useCallback, useLayoutEffect, useMemo, useSyncExternalStore, type ReactElement } from 'react'
import type { LabelAnchor } from '../model/types.ts'
import { captureSvgLabelExport, registerSvgLabelExportCapture } from './svgLabelExportRegistry.ts'
import { SvgTexLabelView } from './svgLabelView.ts'
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

  const capture = useMemo(() => captureSvgLabelExport({
    runtime, source, position, fontSize, fontFamily, color, opacity, anchor,
    ownerIdentity, outline, boundsTarget, settings,
  }), [runtime, source, position, fontSize, fontFamily, color, opacity, anchor,
    ownerIdentity, outline, boundsTarget, settings])
  const elementRef = useCallback((node: SVGGElement | null) => node === null
    ? undefined : registerSvgLabelExportCapture(node, capture), [capture])

  return createElement(SvgTexLabelView, { capture, state, elementRef })
}
