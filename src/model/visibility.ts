import { visibilitySortModes } from './types.ts'
import type {
  CurveStyle,
  Diagram,
  HiddenCurveStyle,
  VisibilityOptions,
  VisibilitySortMode,
} from './types.ts'

export const defaultHiddenCurveStyle: HiddenCurveStyle = {
  lineStyle: 'denselyDotted',
  opacity: 0.45,
}

export const defaultVisibilityOptions: VisibilityOptions = {
  enabled: false,
  surfaceDepthSort: true,
  sortMode: 'layerThenDepth',
  depthEpsilon: 1e-9,
  hiddenCurveStyle: defaultHiddenCurveStyle,
}

export function cloneVisibilityOptions(
  options: VisibilityOptions,
): VisibilityOptions {
  return {
    enabled: options.enabled,
    surfaceDepthSort: options.surfaceDepthSort,
    sortMode: options.sortMode,
    depthEpsilon: options.depthEpsilon,
    hiddenCurveStyle: cloneHiddenCurveStyle(
      options.hiddenCurveStyle ?? defaultHiddenCurveStyle,
    ),
  }
}

export function resolveVisibilityOptions(
  diagram: Diagram,
  options: VisibilityOptions | undefined,
): VisibilityOptions {
  return cloneVisibilityOptions(
    options ?? diagram.view?.visibility ?? defaultVisibilityOptions,
  )
}

export function surfaceDepthSortEnabled(options: VisibilityOptions): boolean {
  return options.enabled && options.surfaceDepthSort
}

export function visibilityOptionsEqual(
  left: VisibilityOptions,
  right: VisibilityOptions,
): boolean {
  const leftHiddenStyle = left.hiddenCurveStyle ?? defaultHiddenCurveStyle
  const rightHiddenStyle = right.hiddenCurveStyle ?? defaultHiddenCurveStyle

  return (
    left.enabled === right.enabled &&
    left.surfaceDepthSort === right.surfaceDepthSort &&
    left.sortMode === right.sortMode &&
    left.depthEpsilon === right.depthEpsilon &&
    leftHiddenStyle.lineStyle === rightHiddenStyle.lineStyle &&
    leftHiddenStyle.opacity === rightHiddenStyle.opacity
  )
}

export function isVisibilitySortMode(
  value: string,
): value is VisibilitySortMode {
  return visibilitySortModes.includes(value as VisibilitySortMode)
}

export function cloneHiddenCurveStyle(
  style: HiddenCurveStyle,
): HiddenCurveStyle {
  return {
    lineStyle: style.lineStyle,
    opacity: style.opacity,
  }
}

export function hiddenCurveStyleFromBase(
  baseStyle: CurveStyle,
  hiddenStyle: HiddenCurveStyle = defaultHiddenCurveStyle,
): CurveStyle {
  return {
    ...baseStyle,
    kind: 'curveStyle',
    strokeOpacity: clampOpacity(baseStyle.strokeOpacity * hiddenStyle.opacity),
    lineStyle: hiddenStyle.lineStyle,
  }
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return defaultHiddenCurveStyle.opacity
  }

  return Math.max(0, Math.min(1, value))
}
