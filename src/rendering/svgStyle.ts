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
    return 'end'
  }

  if (anchor.includes('west')) {
    return 'start'
  }

  return 'middle'
}

export function anchorToDominantBaseline(
  anchor: LabelAnchor,
): 'central' | 'text-after-edge' | 'text-before-edge' {
  if (anchor.includes('north')) {
    return 'text-before-edge'
  }

  if (anchor.includes('south')) {
    return 'text-after-edge'
  }

  return 'central'
}
