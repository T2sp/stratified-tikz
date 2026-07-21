import type {
  Camera,
  Diagram,
  SheetStratum,
  VisibilityOptions,
} from '../model/types.ts'
import {
  curveOcclusionEnabled,
  labelAutoVisibilityEnabled,
  pointAutoVisibilityEnabled,
} from '../model/visibility.ts'
import {
  classifyCurveOcclusion,
  type CurveOcclusionResult,
} from './curveOcclusion.ts'
import {
  classifyAnchorOcclusion,
  type AnchorOcclusionResult,
} from './pointOcclusion.ts'
import type { ProjectedSurfaceFace } from './projectedPrimitives.ts'
import {
  shouldRenderStratumInSvgPreview,
  shouldRenderTextLabelInSvgPreview,
} from './svgPreviewPolicy.ts'

export type SvgCurveOcclusionById = ReadonlyMap<
  string,
  CurveOcclusionResult
>
export type SvgAnchorOcclusionById = ReadonlyMap<
  string,
  AnchorOcclusionResult
>

export type SvgVisibilityPreparation = {
  curveOcclusionById: SvgCurveOcclusionById
  pointOcclusionById: SvgAnchorOcclusionById
  labelOcclusionById: SvgAnchorOcclusionById
}

export type SvgVisibilityPreparationDependencies = {
  classifyCurves?: typeof classifyCurveOcclusion
  classifyAnchors?: typeof classifyAnchorOcclusion
}

export function prepareSvgVisibility(
  diagram: Diagram,
  camera: Camera,
  visibilityOptions: VisibilityOptions,
  projectedSurfaceFaces: readonly ProjectedSurfaceFace[],
  dependencies: SvgVisibilityPreparationDependencies = {},
): SvgVisibilityPreparation {
  if (diagram.ambientDimension !== 3 || camera.mode !== '3d') {
    return emptySvgVisibilityPreparation()
  }

  const classifyCurves = dependencies.classifyCurves ?? classifyCurveOcclusion
  const classifyAnchors =
    dependencies.classifyAnchors ?? classifyAnchorOcclusion
  const visibleSheetIds = visibleSvgSheetIds(diagram)
  let curveOcclusionById: SvgCurveOcclusionById = new Map()
  let pointOcclusionById: SvgAnchorOcclusionById = new Map()
  let labelOcclusionById: SvgAnchorOcclusionById = new Map()

  if (curveOcclusionEnabled(visibilityOptions)) {
    try {
      curveOcclusionById = new Map(
        classifyCurves(diagram, {
          camera,
          visibility: visibilityOptions,
          occludingSurfaceIds: visibleSheetIds,
          projectedSurfaceFaces,
        }).map((result) => [result.curveId, result]),
      )
    } catch {
      curveOcclusionById = new Map()
    }
  }

  if (pointAutoVisibilityEnabled(visibilityOptions)) {
    const targets = diagram.strata.flatMap((stratum) =>
      stratum.geometricKind === 'point' &&
      stratum.codim === 3 &&
      shouldRenderStratumInSvgPreview(diagram, stratum)
        ? [
            {
              id: stratum.id,
              layer: stratum.layer,
              position: stratum.position,
            },
          ]
        : [],
    )

    try {
      pointOcclusionById = new Map(
        classifyAnchors(diagram, targets, {
          camera,
          visibility: visibilityOptions,
          occludingSurfaceIds: visibleSheetIds,
          projectedSurfaceFaces,
          kind: 'point',
        }).map((result) => [result.id, result]),
      )
    } catch {
      pointOcclusionById = new Map()
    }
  }

  if (labelAutoVisibilityEnabled(visibilityOptions)) {
    const targets = diagram.labels
      .filter((label) => shouldRenderTextLabelInSvgPreview(diagram, label))
      .map((label) => ({
        id: label.id,
        layer: label.layer,
        position: label.position,
      }))

    try {
      labelOcclusionById = new Map(
        classifyAnchors(diagram, targets, {
          camera,
          visibility: visibilityOptions,
          occludingSurfaceIds: visibleSheetIds,
          projectedSurfaceFaces,
          kind: 'label',
        }).map((result) => [result.id, result]),
      )
    } catch {
      labelOcclusionById = new Map()
    }
  }

  return {
    curveOcclusionById,
    pointOcclusionById,
    labelOcclusionById,
  }
}

export function visibleSvgSheetIds(diagram: Diagram): ReadonlySet<string> {
  return new Set(
    diagram.strata
      .filter(
        (stratum): stratum is SheetStratum =>
          stratum.geometricKind === 'sheet' &&
          stratum.codim === 1 &&
          shouldRenderStratumInSvgPreview(diagram, stratum),
      )
      .map((sheet) => sheet.id),
  )
}

function emptySvgVisibilityPreparation(): SvgVisibilityPreparation {
  return {
    curveOcclusionById: new Map(),
    pointOcclusionById: new Map(),
    labelOcclusionById: new Map(),
  }
}
