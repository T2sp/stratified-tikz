import type {
  CurveStyle,
  LabelAnchor,
  LineStyle,
  RegionStyle,
  SheetStyle,
} from '../model/types'

export type SvgCurveStrokeAttributes = {
  stroke: string
  strokeOpacity: number
  strokeWidth: number
  strokeDasharray?: string
}

export type SvgFilledSurfaceAttributes = {
  fill: string
  fillOpacity: number
  stroke: string
  strokeOpacity: number
  strokeWidth: number
}

export type SvgLabelAnchorPlacement = {
  textAnchor: 'start' | 'middle' | 'end'
  dominantBaseline: 'middle'
  dx: number
  dy: number
}

export function lineStyleToStrokeDasharray(
  lineStyle: LineStyle,
): string | undefined {
  switch (lineStyle) {
    case 'solid':
      return undefined
    case 'dashed':
      return '8 5'
    case 'dotted':
      return '1 5'
    case 'denselyDotted':
      return '1 2'
  }
}

export function curveStyleToSvgStrokeAttributes(
  style: CurveStyle,
): SvgCurveStrokeAttributes {
  const strokeDasharray = lineStyleToStrokeDasharray(style.lineStyle)

  return {
    stroke: style.strokeColor,
    strokeOpacity: style.strokeOpacity,
    strokeWidth: style.lineWidth,
    ...(strokeDasharray === undefined ? {} : { strokeDasharray }),
  }
}

export function filledSurfaceStyleToSvgAttributes(
  style: RegionStyle | SheetStyle,
  strokeWidth = 1.5,
): SvgFilledSurfaceAttributes {
  return {
    fill: style.fillColor,
    fillOpacity: style.fillOpacity,
    stroke: style.strokeColor,
    strokeOpacity: style.strokeOpacity,
    strokeWidth,
  }
}

export function svgLabelAnchorPlacement(
  anchor: LabelAnchor,
  fontSize: number,
): SvgLabelAnchorPlacement {
  const halfFontSize = Number.isFinite(fontSize) ? fontSize / 2 : 0

  return {
    textAnchor: anchorToTextAnchor(anchor),
    dominantBaseline: 'middle',
    dx: 0,
    dy: anchorToVerticalOffset(anchor, halfFontSize),
  }
}

function anchorToTextAnchor(anchor: LabelAnchor): 'start' | 'middle' | 'end' {
  if (anchor.includes('east')) {
    return 'end'
  }

  if (anchor.includes('west')) {
    return 'start'
  }

  return 'middle'
}

function anchorToVerticalOffset(anchor: LabelAnchor, halfFontSize: number): number {
  // Model coordinates have already been projected into SVG screen coordinates
  // when this placement is applied. Positive dy therefore moves text downward.
  if (anchor.includes('north')) {
    return halfFontSize
  }

  if (anchor.includes('south')) {
    return -halfFontSize
  }

  return 0
}
