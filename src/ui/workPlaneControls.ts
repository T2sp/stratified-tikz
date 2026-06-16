import {
  constructWorkPlaneFromOriginNormal,
  validateWorkPlane,
} from '../geometry/workPlane.ts'
import type {
  AmbientDimension,
  AxisAlignedWorkPlaneName,
  Vec3,
  WorkPlane,
} from '../model/types.ts'

export type WorkPlaneVectorInput = {
  x: string
  y: string
  z: string
}

export type CustomOriginNormalWorkPlaneInput = {
  origin: WorkPlaneVectorInput
  normal: WorkPlaneVectorInput
}

export type CustomWorkPlaneApplyResult =
  | {
      ok: true
      workPlane: WorkPlane
      status: string
    }
  | {
      ok: false
      workPlane: WorkPlane
      status: string
    }

export type WorkPlaneSelectValue = AxisAlignedWorkPlaneName | 'custom'

export const defaultCustomOriginNormalWorkPlaneInput: CustomOriginNormalWorkPlaneInput =
  {
    origin: { x: '0', y: '0', z: '0' },
    normal: { x: '0', y: '0', z: '1' },
  }

export function applyCustomOriginNormalWorkPlaneInput(
  currentWorkPlane: WorkPlane,
  ambientDimension: AmbientDimension,
  input: CustomOriginNormalWorkPlaneInput,
): CustomWorkPlaneApplyResult {
  if (ambientDimension !== 3) {
    return {
      ok: false,
      workPlane: normalizeActiveWorkPlaneForAmbientDimension(
        ambientDimension,
        currentWorkPlane,
      ),
      status: 'Custom work planes are available only in 3D.',
    }
  }

  const origin = parseWorkPlaneVectorInput(input.origin)
  const normal = parseWorkPlaneVectorInput(input.normal)

  if (origin === null || normal === null) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Origin and normal must be finite numbers.',
    }
  }

  if (isZeroVector(normal)) {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Normal vector must be nonzero.',
    }
  }

  try {
    return {
      ok: true,
      workPlane: constructWorkPlaneFromOriginNormal(origin, normal, {
        id: 'custom-origin-normal-work-plane',
        name: 'Custom plane',
      }),
      status: 'Custom plane applied.',
    }
  } catch {
    return {
      ok: false,
      workPlane: currentWorkPlane,
      status: 'Custom plane inputs are invalid.',
    }
  }
}

export function normalizeActiveWorkPlaneForAmbientDimension(
  ambientDimension: AmbientDimension,
  workPlane: WorkPlane,
): WorkPlane {
  if (ambientDimension === 2) {
    return { kind: 'xy', z: 0 }
  }

  return validateWorkPlane(workPlane).valid ? workPlane : { kind: 'xy', z: 0 }
}

export function shouldShowWorkPlaneControls(
  ambientDimension: AmbientDimension,
): boolean {
  return ambientDimension === 3
}

export function workPlaneSelectValue(
  workPlane: WorkPlane,
): WorkPlaneSelectValue {
  switch (workPlane.kind) {
    case 'xy':
    case 'xz':
    case 'yz':
      return workPlane.kind
    case 'axisAligned':
      return workPlane.plane
    case 'custom':
      return 'custom'
  }
}

export function workPlaneDisplayName(workPlane: WorkPlane): string {
  switch (workPlane.kind) {
    case 'xy':
      return 'xy plane'
    case 'xz':
      return 'xz plane'
    case 'yz':
      return 'yz plane'
    case 'axisAligned':
      return `${workPlane.plane} plane`
    case 'custom':
      return workPlane.name
  }
}

function parseWorkPlaneVectorInput(input: WorkPlaneVectorInput): Vec3 | null {
  const x = parseFiniteNumberInput(input.x)
  const y = parseFiniteNumberInput(input.y)
  const z = parseFiniteNumberInput(input.z)

  if (x === null || y === null || z === null) {
    return null
  }

  return { x, y, z }
}

function parseFiniteNumberInput(value: string): number | null {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function isZeroVector(vector: Vec3): boolean {
  return vector.x === 0 && vector.y === 0 && vector.z === 0
}
