import type { LabelAnchor, LineStyle } from '../model/types'

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

export function anchorToTextAnchor(anchor: LabelAnchor): 'start' | 'middle' | 'end' {
  if (anchor.includes('east')) {
    return 'start'
  }

  if (anchor.includes('west')) {
    return 'end'
  }

  return 'middle'
}

export function anchorToDominantBaseline(
  anchor: LabelAnchor,
): 'auto' | 'central' | 'hanging' {
  if (anchor.includes('north')) {
    return 'hanging'
  }

  if (anchor.includes('south')) {
    return 'auto'
  }

  return 'central'
}
