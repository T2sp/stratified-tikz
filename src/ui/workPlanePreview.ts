import { createWorkPlanePatch } from '../geometry/workPlanePatch.ts'
import { addVec3, scaleVec3, workPlaneToBasis } from '../geometry/workPlane.ts'
import type { AmbientDimension, Vec3, WorkPlane } from '../model/types'

export type WorkPlanePreviewTool =
  | 'select'
  | 'createCoordinate'
  | 'createPoint'
  | 'createLabel'
  | 'createPolyline'
  | 'createCubicBezier'
  | 'createPath'
  | 'createSheet'
  | 'createGrid'

export type WorkPlaneDirectionIndicator = {
  from: Vec3
  to: Vec3
  label: string
}

export type WorkPlanePreview = {
  corners: [Vec3, Vec3, Vec3, Vec3]
  origin: Vec3
  uIndicator: WorkPlaneDirectionIndicator
  vIndicator: WorkPlaneDirectionIndicator
  normalIndicator: WorkPlaneDirectionIndicator
  label: string
  pointerEvents: 'none'
  selectable: false
}

export type CreateWorkPlanePreviewOptions = {
  label?: string
  patchSize?: number
  axisLength?: number
  normalLength?: number
}

export function shouldShowWorkPlanePreview(
  ambientDimension: AmbientDimension,
  tool: WorkPlanePreviewTool,
): boolean {
  switch (tool) {
    case 'select':
    case 'createCoordinate':
    case 'createPoint':
    case 'createLabel':
    case 'createPolyline':
    case 'createCubicBezier':
    case 'createPath':
    case 'createSheet':
    case 'createGrid':
      return ambientDimension === 3
  }
}

export function shouldShowCustomWorkPlanePreview(
  ambientDimension: AmbientDimension,
  tool: WorkPlanePreviewTool,
  workPlane: WorkPlane,
): boolean {
  return shouldShowWorkPlanePreview(ambientDimension, tool) && workPlane.kind === 'custom'
}

export function createCustomWorkPlanePreview(
  ambientDimension: AmbientDimension,
  tool: WorkPlanePreviewTool,
  workPlane: WorkPlane,
  options: CreateWorkPlanePreviewOptions = {},
): WorkPlanePreview | undefined {
  if (!shouldShowCustomWorkPlanePreview(ambientDimension, tool, workPlane)) {
    return undefined
  }

  const basis = workPlaneToBasis(workPlane)
  const axisLength = finitePositiveOrDefault(options.axisLength, 1.25)
  const normalLength = finitePositiveOrDefault(options.normalLength, 0.9)

  return {
    ...createWorkPlanePatch(workPlane, {
      size: options.patchSize,
      center: basis.origin,
    }),
    origin: basis.origin,
    uIndicator: {
      from: basis.origin,
      to: addVec3(basis.origin, scaleVec3(basis.u, axisLength)),
      label: 'u',
    },
    vIndicator: {
      from: basis.origin,
      to: addVec3(basis.origin, scaleVec3(basis.v, axisLength)),
      label: 'v',
    },
    normalIndicator: {
      from: basis.origin,
      to: addVec3(basis.origin, scaleVec3(basis.normal, normalLength)),
      label: 'n',
    },
    label: options.label ?? 'custom work plane',
    pointerEvents: 'none',
    selectable: false,
  }
}

function finitePositiveOrDefault(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value <= 0
    ? fallback
    : value
}
