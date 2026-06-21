import { visibilitySortModes } from './types.ts'
import type {
  CurveStyle,
  Diagram,
  HiddenCurveStyle,
  LabelStyle,
  LabelVisibilityPolicy,
  PointStyle,
  PointVisibilityPolicy,
  VisibilityOptions,
  VisibilitySortMode,
} from './types.ts'

export const defaultHiddenCurveStyle: HiddenCurveStyle = {
  lineStyle: 'denselyDotted',
  opacity: 0.45,
}

export const hiddenPointOpacityMultiplier = 0.28
export const hiddenLabelOpacityMultiplier = 0.35

export const defaultVisibilityOptions: VisibilityOptions = {
  enabled: false,
  surfaceDepthSort: true,
  curveOcclusion: true,
  pointVisibility: 'dimHidden',
  labelVisibility: 'alwaysForeground',
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
    curveOcclusion: options.curveOcclusion,
    pointVisibility: options.pointVisibility,
    labelVisibility: options.labelVisibility,
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

export function curveOcclusionEnabled(options: VisibilityOptions): boolean {
  return options.enabled && options.curveOcclusion
}

export function pointAutoVisibilityEnabled(
  options: VisibilityOptions,
): boolean {
  return options.enabled
}

export function labelAutoVisibilityEnabled(
  options: VisibilityOptions,
): boolean {
  return options.enabled && options.labelVisibility !== 'alwaysForeground'
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
    left.curveOcclusion === right.curveOcclusion &&
    left.pointVisibility === right.pointVisibility &&
    left.labelVisibility === right.labelVisibility &&
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

export function isPointVisibilityPolicy(
  value: string,
): value is PointVisibilityPolicy {
  return value === 'dimHidden' || value === 'hideHidden'
}

export function isLabelVisibilityPolicy(
  value: string,
): value is LabelVisibilityPolicy {
  return (
    value === 'alwaysForeground' ||
    value === 'autoDim' ||
    value === 'autoHide'
  )
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

export function hiddenPointStyleFromBase(baseStyle: PointStyle): PointStyle {
  return {
    ...baseStyle,
    kind: 'pointStyle',
    opacity: clampOpacity(baseStyle.opacity * hiddenPointOpacityMultiplier),
  }
}

export function hiddenLabelStyleFromBase(baseStyle: LabelStyle): LabelStyle {
  return {
    ...baseStyle,
    kind: 'labelStyle',
    opacity: clampOpacity(baseStyle.opacity * hiddenLabelOpacityMultiplier),
  }
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return defaultHiddenCurveStyle.opacity
  }

  return Math.max(0, Math.min(1, value))
}
