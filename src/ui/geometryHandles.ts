import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import {
  updateCircleTemplateRadiusFromPoint,
  updateEllipseTemplateRadiusFromPoint,
} from '../model/paths.ts'
import { cleanPathCrossingStates } from '../model/pathCrossings.ts'
import { updateSheetVertex } from '../model/sheets.ts'
import type { Diagram, SheetStratum, Vec3 } from '../model/types.ts'
import { updateLabelById } from './diagramUpdates.ts'
import {
  updateConcatenatedPathPoint,
  type ConcatenatedPathPointRole,
} from './pathEditing.ts'

export type GeometryHandleTarget =
  | { kind: 'pointPosition'; stratumId: string }
  | { kind: 'labelPosition'; labelId: string }
  | { kind: 'curvePoint'; stratumId: string; pointIndex: number }
  | {
      kind: 'pathSegmentPoint'
      stratumId: string
      segmentIndex: number
      role: ConcatenatedPathPointRole
    }
  | { kind: 'circleTemplateRadius'; stratumId: string }
  | { kind: 'ellipseTemplateRadiusX'; stratumId: string }
  | { kind: 'ellipseTemplateRadiusY'; stratumId: string }
  | { kind: 'sheetVertex'; stratumId: string; vertexIndex: number }

export function updateDiagramGeometryHandle(
  diagram: Diagram,
  target: GeometryHandleTarget,
  position: Vec3,
): Diagram {
  const normalizedPosition = normalizePointForAmbientDimension(
    diagram.ambientDimension,
    position,
  )

  if (!isFiniteVec3(normalizedPosition)) {
    return diagram
  }

  const nextDiagram = (() => {
    switch (target.kind) {
      case 'pointPosition':
        return updatePointPosition(diagram, target.stratumId, normalizedPosition)
      case 'labelPosition':
        return updateLabelPosition(diagram, target.labelId, normalizedPosition)
      case 'curvePoint':
        return updateCurvePoint(
          diagram,
          target.stratumId,
          target.pointIndex,
          normalizedPosition,
        )
      case 'pathSegmentPoint':
        return updatePathSegmentPoint(
          diagram,
          target.stratumId,
          target.segmentIndex,
          target.role,
          normalizedPosition,
        )
      case 'circleTemplateRadius':
        return updateTemplatePathRadius(
          diagram,
          target.stratumId,
          'circle',
          normalizedPosition,
        )
      case 'ellipseTemplateRadiusX':
        return updateTemplatePathRadius(
          diagram,
          target.stratumId,
          'ellipseX',
          normalizedPosition,
        )
      case 'ellipseTemplateRadiusY':
        return updateTemplatePathRadius(
          diagram,
          target.stratumId,
          'ellipseY',
          normalizedPosition,
        )
      case 'sheetVertex':
        return updateSheetVertexPosition(
          diagram,
          target.stratumId,
          target.vertexIndex,
          normalizedPosition,
        )
    }
  })()

  return targetChangesCurveGeometry(target)
    ? cleanPathCrossingStates(nextDiagram)
    : nextDiagram
}

function targetChangesCurveGeometry(target: GeometryHandleTarget): boolean {
  switch (target.kind) {
    case 'curvePoint':
    case 'pathSegmentPoint':
    case 'circleTemplateRadius':
    case 'ellipseTemplateRadiusX':
    case 'ellipseTemplateRadiusY':
      return true
    case 'pointPosition':
    case 'labelPosition':
    case 'sheetVertex':
      return false
  }
}

function updateTemplatePathRadius(
  diagram: Diagram,
  stratumId: string,
  radiusKind: 'circle' | 'ellipseX' | 'ellipseY',
  position: Vec3,
): Diagram {
  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (
      stratum.id !== stratumId ||
      stratum.geometricKind !== 'curve' ||
      stratum.kind !== 'templatePath'
    ) {
      return stratum
    }

    if (stratum.template.kind === 'circleTemplate' && radiusKind === 'circle') {
      const template = updateCircleTemplateRadiusFromPoint(
        stratum.template,
        diagram.ambientDimension,
        position,
      )

      if (template === stratum.template || template.radius === stratum.template.radius) {
        return stratum
      }

      changed = true
      return { ...stratum, template }
    }

    if (
      stratum.template.kind === 'ellipseTemplate' &&
      (radiusKind === 'ellipseX' || radiusKind === 'ellipseY')
    ) {
      const axis = radiusKind === 'ellipseX' ? 'radiusX' : 'radiusY'
      const template = updateEllipseTemplateRadiusFromPoint(
        stratum.template,
        diagram.ambientDimension,
        axis,
        position,
      )

      if (
        template === stratum.template ||
        template[axis] === stratum.template[axis]
      ) {
        return stratum
      }

      changed = true
      return { ...stratum, template }
    }

    return stratum
  })

  return changed ? { ...diagram, strata } : diagram
}

function updatePointPosition(
  diagram: Diagram,
  stratumId: string,
  position: Vec3,
): Diagram {
  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (stratum.id !== stratumId || stratum.geometricKind !== 'point') {
      return stratum
    }

    changed = true
    return { ...stratum, position }
  })

  return changed ? { ...diagram, strata } : diagram
}

function updateLabelPosition(
  diagram: Diagram,
  labelId: string,
  position: Vec3,
): Diagram {
  return updateLabelById(diagram, labelId, (label) => ({
    ...label,
    position,
  }))
}

function updateCurvePoint(
  diagram: Diagram,
  stratumId: string,
  pointIndex: number,
  position: Vec3,
): Diagram {
  if (!Number.isInteger(pointIndex) || pointIndex < 0) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (
      stratum.id !== stratumId ||
      stratum.geometricKind !== 'curve' ||
      stratum.kind === 'concatenatedPath' ||
      stratum.kind === 'templatePath' ||
      stratum.kind === 'grid' ||
      pointIndex >= stratum.points.length ||
      (stratum.kind === 'cubicBezier' && stratum.points.length !== 4)
    ) {
      return stratum
    }

    changed = true
    const updatedStratum = {
      ...stratum,
      points: stratum.points.map((point, index) =>
        index === pointIndex ? position : point,
      ),
    }

    return stratum.kind === 'cubicBezier'
      ? { ...updatedStratum, bezierControls: { kind: 'absolute' as const } }
      : updatedStratum
  })

  return changed ? { ...diagram, strata } : diagram
}

function updatePathSegmentPoint(
  diagram: Diagram,
  stratumId: string,
  segmentIndex: number,
  role: ConcatenatedPathPointRole,
  position: Vec3,
): Diagram {
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (
      stratum.id !== stratumId ||
      stratum.geometricKind !== 'curve' ||
      stratum.kind !== 'concatenatedPath'
    ) {
      return stratum
    }

    const updatedPath = updateConcatenatedPathPoint(
      stratum,
      diagram.ambientDimension,
      { segmentIndex, role },
      position,
    )

    if (updatedPath === stratum) {
      return stratum
    }

    changed = true
    return updatedPath
  })

  return changed ? { ...diagram, strata } : diagram
}

function updateSheetVertexPosition(
  diagram: Diagram,
  stratumId: string,
  vertexIndex: number,
  position: Vec3,
): Diagram {
  if (!Number.isInteger(vertexIndex) || vertexIndex < 0) {
    return diagram
  }

  let changed = false
  const strata = diagram.strata.map((stratum) => {
    if (
      stratum.id !== stratumId ||
      stratum.geometricKind !== 'sheet' ||
      vertexIndex >= sheetVertexCount(stratum)
    ) {
      return stratum
    }

    changed = true
    return updateSheetVertex(stratum, vertexIndex, () => position)
  })

  return changed ? { ...diagram, strata } : diagram
}

function sheetVertexCount(sheet: SheetStratum): number {
  switch (sheet.kind) {
    case 'quadSheet':
      return sheet.corners.length
    case 'polygonSheet':
      return sheet.vertices.length
    case 'workPlaneFilledSheet':
      return 0
    case 'curvedSheet':
      return 0
  }
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}
