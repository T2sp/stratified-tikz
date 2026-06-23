import {
  defaultPathCrossingOverlaySegmentLength,
  pathCrossingOverlaysForDiagram,
} from '../geometry/pathCrossingOverlays.ts'
import { resolvePathSegmentStyle } from '../model/paths.ts'
import type {
  CurveStratum,
  CurveStyle,
  Diagram,
  Vec2,
  Vec3,
} from '../model/types.ts'
import {
  lineStyleToStrokeDasharray,
  type SvgCurveStrokeAttributes,
} from './svgStyle.ts'
import { polylineToSvgPath } from './svgPath.ts'

export const defaultSvgBraidingBackgroundColor = '#ffffff'
export const defaultSvgBraidingMaskStrokeGap = 4

export type SvgPathCrossingOverlayOptions = {
  backgroundColor?: string
  includeCurve?: (curve: CurveStratum) => boolean
  maskStrokeGap?: number
  segmentLength?: number
}

export type SvgPathCrossingOverlayPrimitive = SvgCurveStrokeAttributes & {
  kind: 'underMask' | 'overRedraw'
  crossingId: string
  pathId: string
  pathData: string
}

export function svgPathCrossingOverlayPrimitives(
  diagram: Diagram,
  project: (point: Vec3) => Vec2,
  options: SvgPathCrossingOverlayOptions = {},
): SvgPathCrossingOverlayPrimitive[] {
  if (diagram.ambientDimension !== 2) {
    return []
  }

  const curvesById = new Map(
    diagram.strata.flatMap((stratum) =>
      stratum.geometricKind === 'curve' && stratum.codim === 1
        ? [[stratum.id, stratum] as const]
        : [],
    ),
  )
  const backgroundColor =
    options.backgroundColor ?? defaultSvgBraidingBackgroundColor
  const maskStrokeGap = normalizeMaskStrokeGap(options.maskStrokeGap)

  return pathCrossingOverlaysForDiagram(diagram, {
    ...(options.includeCurve === undefined
      ? {}
      : { includeCurve: options.includeCurve }),
    segmentLength:
      options.segmentLength ?? defaultPathCrossingOverlaySegmentLength,
  }).flatMap((overlay) => {
    const overCurve = curvesById.get(overlay.overPathId)
    const underCurve = curvesById.get(overlay.underPathId)

    if (overCurve === undefined || underCurve === undefined) {
      return []
    }

    const underStyle = curveStyleAtPathParameter(
      underCurve,
      overlay.underMask.parameter,
    )
    const overStyle = curveStyleAtPathParameter(
      overCurve,
      overlay.overRedraw.parameter,
    )
    const underMaskPath = projectedSegmentPathData(
      overlay.underMask.start,
      overlay.underMask.end,
      project,
    )
    const overRedrawPath = projectedSegmentPathData(
      overlay.overRedraw.start,
      overlay.overRedraw.end,
      project,
    )

    if (underMaskPath === null || overRedrawPath === null) {
      return []
    }

    const maskStrokeWidth =
      positiveNumberOrDefault(underStyle.lineWidth, 1.2) + maskStrokeGap

    return [
      {
        kind: 'underMask',
        crossingId: overlay.crossingId,
        pathId: overlay.underPathId,
        pathData: underMaskPath,
        stroke: backgroundColor,
        strokeOpacity: 1,
        strokeWidth: maskStrokeWidth,
      },
      {
        kind: 'overRedraw',
        crossingId: overlay.crossingId,
        pathId: overlay.overPathId,
        pathData: overRedrawPath,
        stroke: overStyle.strokeColor,
        strokeOpacity: overStyle.strokeOpacity,
        strokeWidth: positiveNumberOrDefault(overStyle.lineWidth, 1.2),
        ...strokeDasharrayForStyle(overStyle),
      },
    ]
  })
}

function projectedSegmentPathData(
  start: Vec3,
  end: Vec3,
  project: (point: Vec3) => Vec2,
): string | null {
  const projectedStart = project(start)
  const projectedEnd = project(end)

  if (!isFiniteVec2(projectedStart) || !isFiniteVec2(projectedEnd)) {
    return null
  }

  return polylineToSvgPath([projectedStart, projectedEnd])
}

function curveStyleAtPathParameter(
  curve: CurveStratum,
  parameter: number,
): CurveStyle {
  if (curve.kind !== 'concatenatedPath' || curve.segments.length === 0) {
    return curve.style
  }

  const segmentIndex = Math.min(
    curve.segments.length - 1,
    Math.max(0, Math.floor(clampUnit(parameter) * curve.segments.length)),
  )
  const segment = curve.segments[segmentIndex]

  return segment === undefined
    ? curve.style
    : resolvePathSegmentStyle(curve.style, segment)
}

function strokeDasharrayForStyle(
  style: CurveStyle,
): Pick<SvgCurveStrokeAttributes, 'strokeDasharray'> {
  const strokeDasharray = lineStyleToStrokeDasharray(style.lineStyle)

  return strokeDasharray === undefined ? {} : { strokeDasharray }
}

function normalizeMaskStrokeGap(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : defaultSvgBraidingMaskStrokeGap
}

function positiveNumberOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function clampUnit(value: number): number {
  return Number.isFinite(value)
    ? Math.min(1, Math.max(0, Object.is(value, -0) ? 0 : value))
    : 0
}

function isFiniteVec2(point: Vec2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}
