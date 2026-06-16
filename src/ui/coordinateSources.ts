import {
  DEFAULT_WORK_PLANE_EPSILON,
  dot,
  isFiniteVec3,
  projectPointToWorkPlaneCoordinates,
  pointOnWorkPlane,
  subtractVec3,
  validateWorkPlane,
  workPlaneToBasis,
} from '../geometry/workPlane.ts'
import { normalizePointForAmbientDimension } from '../geometry/projection.ts'
import type { AmbientDimension, Diagram, Vec3, WorkPlane } from '../model/types.ts'

export type ExistingCoordinateSource =
  | {
      kind: 'pointStratum'
      stratumId: string
    }
  | {
      kind: 'polylineVertex'
      curveId: string
      vertexIndex: number
    }
  | {
      kind: 'sheetVertex'
      sheetId: string
      vertexIndex: number
    }
  | {
      kind: 'cubicBezierPoint'
      curveId: string
      pointRole: 'start' | 'control1' | 'control2' | 'end'
    }

export type ExistingCoordinateSourceOption = {
  key: string
  label: string
  source: ExistingCoordinateSource
}

type CubicBezierPointRole = Extract<
  ExistingCoordinateSource,
  { kind: 'cubicBezierPoint' }
>['pointRole']

export type ResolveExistingCoordinateForModeOptions = {
  ambientDimension: AmbientDimension
  coordinateMode?: 'global' | 'workPlaneLocal'
  workPlane?: WorkPlane
  epsilon?: number
}

export function resolveExistingCoordinateSource(
  diagram: Diagram,
  source: ExistingCoordinateSource,
): Vec3 | null {
  switch (source.kind) {
    case 'pointStratum': {
      const stratum = diagram.strata.find(
        (candidate) => candidate.id === source.stratumId,
      )

      if (stratum?.geometricKind !== 'point') {
        return null
      }

      return cloneFiniteVec3(stratum.position)
    }
    case 'polylineVertex': {
      const stratum = diagram.strata.find(
        (candidate) => candidate.id === source.curveId,
      )

      if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
        return null
      }

      return cloneFiniteVec3(stratum.points[source.vertexIndex])
    }
    case 'sheetVertex': {
      const stratum = diagram.strata.find(
        (candidate) => candidate.id === source.sheetId,
      )

      if (stratum?.geometricKind !== 'sheet' || stratum.kind !== 'polygonSheet') {
        return null
      }

      return cloneFiniteVec3(stratum.vertices[source.vertexIndex])
    }
    case 'cubicBezierPoint': {
      const stratum = diagram.strata.find(
        (candidate) => candidate.id === source.curveId,
      )

      if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'cubicBezier') {
        return null
      }

      return cloneFiniteVec3(stratum.points[cubicBezierPointRoleIndex(source.pointRole)])
    }
  }
}

export function resolveExistingCoordinateForDirectCreation(
  diagram: Diagram,
  source: ExistingCoordinateSource,
  options: ResolveExistingCoordinateForModeOptions,
): Vec3 | null {
  const modelPoint = resolveExistingCoordinateSource(diagram, source)

  if (modelPoint === null) {
    return null
  }

  const normalizedPoint = normalizePointForAmbientDimension(
    options.ambientDimension,
    modelPoint,
  )

  if (
    options.ambientDimension !== 3 ||
    options.coordinateMode !== 'workPlaneLocal'
  ) {
    return isFiniteVec3(normalizedPoint) ? normalizedPoint : null
  }

  if (options.workPlane === undefined || !isPointOnWorkPlane(normalizedPoint, options.workPlane, options.epsilon)) {
    return null
  }

  try {
    const local = projectPointToWorkPlaneCoordinates(normalizedPoint, options.workPlane)
    const recreatedPoint = pointOnWorkPlane(options.workPlane, local.a, local.b)
    return isFiniteVec3(recreatedPoint) ? recreatedPoint : null
  } catch {
    return null
  }
}

export function createExistingCoordinateSourceOptions(
  diagram: Diagram,
): ExistingCoordinateSourceOption[] {
  const options: ExistingCoordinateSourceOption[] = []

  for (const stratum of diagram.strata) {
    const stratumName = sourceObjectName(stratum.name, stratum.id)

    if (stratum.geometricKind === 'point') {
      const source: ExistingCoordinateSource = {
        kind: 'pointStratum',
        stratumId: stratum.id,
      }

      options.push({
        key: existingCoordinateSourceKey(source),
        label: `Point: ${stratumName}`,
        source,
      })
      continue
    }

    if (stratum.geometricKind === 'curve' && stratum.kind === 'polyline') {
      stratum.points.forEach((_point, index) => {
        const source: ExistingCoordinateSource = {
          kind: 'polylineVertex',
          curveId: stratum.id,
          vertexIndex: index,
        }

        options.push({
          key: existingCoordinateSourceKey(source),
          label: `Polyline: ${stratumName} / Vertex ${index + 1}`,
          source,
        })
      })
      continue
    }

    if (stratum.geometricKind === 'curve' && stratum.kind === 'cubicBezier') {
      cubicBezierPointRoles.forEach((pointRole) => {
        const source: ExistingCoordinateSource = {
          kind: 'cubicBezierPoint',
          curveId: stratum.id,
          pointRole,
        }

        options.push({
          key: existingCoordinateSourceKey(source),
          label: `Bezier: ${stratumName} / ${cubicBezierPointRoleLabel(pointRole)}`,
          source,
        })
      })
      continue
    }

    if (diagram.ambientDimension === 3 && stratum.geometricKind === 'sheet' && stratum.kind === 'polygonSheet') {
      stratum.vertices.forEach((_vertex, index) => {
        const source: ExistingCoordinateSource = {
          kind: 'sheetVertex',
          sheetId: stratum.id,
          vertexIndex: index,
        }

        options.push({
          key: existingCoordinateSourceKey(source),
          label: `Sheet: ${stratumName} / Vertex ${index + 1}`,
          source,
        })
      })
    }
  }

  return options
}

export function existingCoordinateSourceKey(
  source: ExistingCoordinateSource,
): string {
  switch (source.kind) {
    case 'pointStratum':
      return `pointStratum:${source.stratumId}`
    case 'polylineVertex':
      return `polylineVertex:${source.curveId}:${source.vertexIndex}`
    case 'sheetVertex':
      return `sheetVertex:${source.sheetId}:${source.vertexIndex}`
    case 'cubicBezierPoint':
      return `cubicBezierPoint:${source.curveId}:${source.pointRole}`
  }
}

function isPointOnWorkPlane(
  point: Vec3,
  workPlane: WorkPlane,
  epsilon = DEFAULT_WORK_PLANE_EPSILON,
): boolean {
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    return false
  }

  const validation = validateWorkPlane(workPlane, epsilon)

  if (!validation.valid) {
    return false
  }

  try {
    const basis = workPlaneToBasis(workPlane)
    const signedDistance = dot(subtractVec3(point, basis.origin), basis.normal)
    return Number.isFinite(signedDistance) && Math.abs(signedDistance) <= epsilon
  } catch {
    return false
  }
}

function cloneFiniteVec3(point: Vec3 | undefined): Vec3 | null {
  if (point === undefined || !isFiniteVec3(point)) {
    return null
  }

  return { ...point }
}

const cubicBezierPointRoles: CubicBezierPointRole[] = [
  'start',
  'control1',
  'control2',
  'end',
]

function cubicBezierPointRoleIndex(pointRole: CubicBezierPointRole): number {
  switch (pointRole) {
    case 'start':
      return 0
    case 'control1':
      return 1
    case 'control2':
      return 2
    case 'end':
      return 3
  }
}

function cubicBezierPointRoleLabel(pointRole: CubicBezierPointRole): string {
  switch (pointRole) {
    case 'start':
      return 'Start'
    case 'control1':
      return 'Control point 1'
    case 'control2':
      return 'Control point 2'
    case 'end':
      return 'End'
  }
}

function sourceObjectName(name: string, id: string): string {
  const trimmedName = name.trim()

  return trimmedName.length === 0 ? id : trimmedName
}
