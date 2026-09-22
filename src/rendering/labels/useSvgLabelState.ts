import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import { normalizeSvgLabelFontSize, svgLabelLayoutSettings } from './svgLabelLayout.ts'
import { createSvgLabelController, initialSvgLabelState, svgLabelRequestIdentity, type SvgLabelRuntime } from './svgLabelRuntime.ts'

/** Shared mount-scoped subscription. Only the layout effect starts async work. */
export function useSvgLabelState(runtime: SvgLabelRuntime, source: string, requestedFontSize: number,
  fontFamily: string, ownerIdentity?: string) {
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
  useLayoutEffect(() => controller.start(request), [controller, request])
  return { state, settings, fontSize, fontGeneration }
}
