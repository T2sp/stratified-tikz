import type { AmbientDimension, Vec3, WorkPlane } from '../model/types.ts'
import { normalizePointForAmbientDimension } from './projection.ts'
import {
  isFiniteVec3,
  pointOnWorkPlane,
  projectPointToWorkPlaneCoordinates,
} from './workPlane.ts'

export type CursorSnapSettings = {
  enabled: boolean
  step: number
}

export type CursorSnapPointOptions = {
  ambientDimension: AmbientDimension
  snap: CursorSnapSettings
  workPlane?: WorkPlane
}

export const cursorSnapPresetSteps = [1, 0.5, 0.1, 0.01, 0.001] as const

export const defaultCursorSnapSettings: CursorSnapSettings = {
  enabled: false,
  step: 1,
}

const maxSnapDecimalPlaces = 15

export function isValidCursorSnapStep(step: number): boolean {
  return Number.isFinite(step) && step > 0
}

export function parseCursorSnapStep(rawValue: string): number | null {
  const trimmed = rawValue.trim()

  if (trimmed.length === 0) {
    return null
  }

  const step = Number(trimmed)

  return isValidCursorSnapStep(step) ? step : null
}

export function normalizeCursorSnapSettings(
  settings: CursorSnapSettings,
): CursorSnapSettings | null {
  if (!isValidCursorSnapStep(settings.step)) {
    return null
  }

  return {
    enabled: settings.enabled,
    step: settings.step,
  }
}

export function cursorSnapHelpText(
  settings: CursorSnapSettings,
  ambientDimension: AmbientDimension,
): string {
  const scope =
    ambientDimension === 2
      ? 'Cursor placement and drag handles round x/y; z stays 0.'
      : 'Cursor placement and drag handles round active work-plane local coordinates.'
  const prefix = settings.enabled
    ? `Snap step ${formatCursorSnapStep(settings.step)}.`
    : 'Snap is off.'

  return `${prefix} ${scope} Direct and symbolic input are unchanged.`
}

function formatCursorSnapStep(step: number): string {
  return Number.isFinite(step) ? String(step) : '?'
}

export function snapCursorPoint(
  point: Vec3,
  options: CursorSnapPointOptions,
): Vec3 | null {
  const normalizedPoint = normalizePointForAmbientDimension(
    options.ambientDimension,
    point,
  )

  if (!isFiniteVec3(normalizedPoint)) {
    return null
  }

  const settings = normalizeCursorSnapSettings(options.snap)

  if (settings === null) {
    return null
  }

  if (!settings.enabled) {
    return normalizedPoint
  }

  if (options.ambientDimension === 2) {
    return snapCursorPoint2D(normalizedPoint, settings.step)
  }

  if (options.workPlane !== undefined) {
    return snapCursorPointOnWorkPlane(normalizedPoint, options.workPlane, settings.step)
  }

  return snapCursorPoint3DGlobally(normalizedPoint, settings.step)
}

export function snapCoordinateToStep(
  coordinate: number,
  step: number,
): number | null {
  if (!Number.isFinite(coordinate) || !isValidCursorSnapStep(step)) {
    return null
  }

  const snapped = Math.round(coordinate / step) * step

  if (!Number.isFinite(snapped)) {
    return null
  }

  const decimalPlaces = decimalPlacesForStep(step)
  const rounded =
    decimalPlaces === 0
      ? Math.round(snapped)
      : Number(snapped.toFixed(decimalPlaces))

  return Object.is(rounded, -0) ? 0 : rounded
}

function snapCursorPoint2D(point: Vec3, step: number): Vec3 | null {
  const x = snapCoordinateToStep(point.x, step)
  const y = snapCoordinateToStep(point.y, step)

  if (x === null || y === null) {
    return null
  }

  return { x, y, z: 0 }
}

function snapCursorPoint3DGlobally(point: Vec3, step: number): Vec3 | null {
  const x = snapCoordinateToStep(point.x, step)
  const y = snapCoordinateToStep(point.y, step)
  const z = snapCoordinateToStep(point.z, step)

  if (x === null || y === null || z === null) {
    return null
  }

  return { x, y, z }
}

function snapCursorPointOnWorkPlane(
  point: Vec3,
  workPlane: WorkPlane,
  step: number,
): Vec3 | null {
  try {
    const local = projectPointToWorkPlaneCoordinates(point, workPlane)
    const a = snapCoordinateToStep(local.a, step)
    const b = snapCoordinateToStep(local.b, step)

    if (a === null || b === null) {
      return null
    }

    const snappedPoint = pointOnWorkPlane(workPlane, a, b)

    return isFiniteVec3(snappedPoint) ? snappedPoint : null
  } catch {
    return null
  }
}

function decimalPlacesForStep(step: number): number {
  if (!isValidCursorSnapStep(step)) {
    return 0
  }

  const [coefficient, exponentText] = step.toString().toLowerCase().split('e')
  const coefficientDecimals = coefficient.split('.')[1]?.length ?? 0
  const exponent = exponentText === undefined ? 0 : Number(exponentText)
  const decimalPlaces = coefficientDecimals - exponent

  if (!Number.isFinite(decimalPlaces)) {
    return maxSnapDecimalPlaces
  }

  return Math.min(
    maxSnapDecimalPlaces,
    Math.max(0, Math.trunc(decimalPlaces)),
  )
}
