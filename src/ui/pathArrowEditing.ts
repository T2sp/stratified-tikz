import {
  isArrowHeadKind,
  isEndpointArrowMode,
  isMidArrowDirection,
  isValidMidArrowPosition,
  resolvePathArrowOptions,
} from '../model/pathArrows.ts'
import type {
  ArrowHeadKind,
  CurveStratum,
  EndpointArrowMode,
  MidArrowDirection,
  PathArrowOptions,
  Stratum,
} from '../model/types.ts'

export type PathArrowEditableCurve = Exclude<
  CurveStratum,
  Extract<CurveStratum, { kind: 'grid' }>
>

export function isPathArrowEditableCurve(
  stratum: Stratum,
): stratum is PathArrowEditableCurve {
  return stratum.geometricKind === 'curve' && stratum.kind !== 'grid'
}

export function updatePathEndpointArrow(
  stratum: Stratum,
  endpoint: EndpointArrowMode,
): Stratum {
  if (!isPathArrowEditableCurve(stratum) || !isEndpointArrowMode(endpoint)) {
    return stratum
  }

  return updatePathArrowOptions(stratum, (arrows) => ({
    ...arrows,
    endpoint,
  }))
}

export function updatePathMidArrowEnabled(
  stratum: Stratum,
  enabled: boolean,
): Stratum {
  if (!isPathArrowEditableCurve(stratum)) {
    return stratum
  }

  return updatePathArrowOptions(stratum, (arrows) => ({
    ...arrows,
    mid: {
      ...arrows.mid,
      enabled,
    },
  }))
}

export function updatePathMidArrowPosition(
  stratum: Stratum,
  position: number,
): Stratum {
  if (
    !isPathArrowEditableCurve(stratum) ||
    !isValidMidArrowPosition(position)
  ) {
    return stratum
  }

  return updatePathArrowOptions(stratum, (arrows) => ({
    ...arrows,
    mid: {
      ...arrows.mid,
      position,
    },
  }))
}

export function updatePathMidArrowDirection(
  stratum: Stratum,
  direction: MidArrowDirection,
): Stratum {
  if (
    !isPathArrowEditableCurve(stratum) ||
    !isMidArrowDirection(direction)
  ) {
    return stratum
  }

  return updatePathArrowOptions(stratum, (arrows) => ({
    ...arrows,
    mid: {
      ...arrows.mid,
      direction,
    },
  }))
}

export function updatePathMidArrowHead(
  stratum: Stratum,
  head: ArrowHeadKind,
): Stratum {
  if (!isPathArrowEditableCurve(stratum) || !isArrowHeadKind(head)) {
    return stratum
  }

  return updatePathArrowOptions(stratum, (arrows) => ({
    ...arrows,
    mid: {
      ...arrows.mid,
      head,
    },
  }))
}

function updatePathArrowOptions<T extends PathArrowEditableCurve>(
  curve: T,
  updater: (arrows: PathArrowOptions) => PathArrowOptions,
): T {
  return {
    ...curve,
    arrows: updater(resolvePathArrowOptions(curve.arrows)),
  }
}
