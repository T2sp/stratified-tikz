import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import { updateSheetVertex } from '../model/sheets.ts'
import type { Diagram, SheetStratum, Vec3 } from '../model/types.ts'
import { updateLabelById } from './diagramUpdates.ts'

export type GeometryHandleTarget =
  | { kind: 'pointPosition'; stratumId: string }
  | { kind: 'labelPosition'; labelId: string }
  | { kind: 'curvePoint'; stratumId: string; pointIndex: number }
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
    case 'sheetVertex':
      return updateSheetVertexPosition(
        diagram,
        target.stratumId,
        target.vertexIndex,
        normalizedPosition,
      )
  }
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
  return sheet.kind === 'quadSheet' ? sheet.corners.length : sheet.vertices.length
}

function isFiniteVec3(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}
