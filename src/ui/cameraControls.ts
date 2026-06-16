import { validateCamera3D } from '../geometry/projection.ts'
import {
  cloneCamera3D,
  createInitialCamera3D,
} from '../model/camera.ts'
import type {
  AmbientDimension,
  Camera3D,
  Diagram,
  Vec2,
} from '../model/types.ts'

export const cameraPresetIds = [
  'initial',
  'top',
  'front',
  'side',
  'isometric',
] as const

export type CameraPresetId = (typeof cameraPresetIds)[number]
export type CameraControlField = 'thetaDeg' | 'phiDeg' | 'zoom' | 'panX' | 'panY'

export type CameraPresetOption = {
  id: CameraPresetId
  label: string
}

export type CameraInputResult =
  | {
      ok: true
      camera: Camera3D
    }
  | {
      ok: false
      camera: Camera3D
      message: string
    }

export type CameraViewAdjustment = {
  zoom: number
  pan: Vec2
}

export const cameraPresetOptions: CameraPresetOption[] = [
  { id: 'initial', label: 'Initial' },
  { id: 'top', label: 'Top (xy)' },
  { id: 'front', label: 'Front (xz)' },
  { id: 'side', label: 'Side (yz)' },
  { id: 'isometric', label: 'Isometric' },
]

export function shouldShowCameraControls(
  ambientDimension: AmbientDimension,
): boolean {
  return ambientDimension === 3
}

export function createInitialCameraControlState(): Camera3D {
  return createInitialCamera3D()
}

export function resetCameraControlState(): Camera3D {
  return createInitialCameraControlState()
}

export function cameraControlStateFromDiagramView(diagram: Diagram): Camera3D {
  if (diagram.ambientDimension !== 3) {
    return createInitialCameraControlState()
  }

  if (diagram.view?.camera3d !== undefined) {
    return cloneCamera3D(diagram.view.camera3d)
  }

  return diagram.camera.mode === '3d'
    ? cloneCamera3D(diagram.camera)
    : createInitialCameraControlState()
}

export function fitCameraControlState(camera: Camera3D): Camera3D {
  return {
    ...cloneCamera3D(camera),
    zoom: 1,
    pan: { x: 0, y: 0 },
  }
}

export function cameraOrientationForPreview(camera: Camera3D): Camera3D {
  return {
    ...cloneCamera3D(camera),
    zoom: 1,
    pan: { x: 0, y: 0 },
  }
}

export function cameraViewAdjustmentFromControls(
  camera: Camera3D,
): CameraViewAdjustment {
  return {
    zoom: camera.zoom,
    pan: { ...camera.pan },
  }
}

export function createCameraPresetCamera(presetId: CameraPresetId): Camera3D {
  switch (presetId) {
    case 'initial':
      return createInitialCameraControlState()
    case 'top':
      return createAngleCamera(0, 0)
    case 'front':
      return createAngleCamera(90, 0)
    case 'side':
      return createAngleCamera(90, 90)
    case 'isometric':
      return createAngleCamera(70, 110)
  }
}

export function isCameraPresetId(value: string): value is CameraPresetId {
  return cameraPresetIds.some((presetId) => presetId === value)
}

export function applyCameraNumericInput(
  camera: Camera3D,
  field: CameraControlField,
  rawValue: string,
): CameraInputResult {
  const value = parseFiniteInput(rawValue)

  if (value === null) {
    return invalidCameraInput(camera, `${cameraControlFieldLabel(field)} must be finite.`)
  }

  if (field === 'zoom' && value <= 0) {
    return invalidCameraInput(camera, 'zoom must be greater than 0.')
  }

  const nextCamera = cloneCamera3D(camera)

  switch (field) {
    case 'thetaDeg':
      nextCamera.thetaDeg = value
      delete nextCamera.projectionBasis
      break
    case 'phiDeg':
      nextCamera.phiDeg = value
      delete nextCamera.projectionBasis
      break
    case 'zoom':
      nextCamera.zoom = value
      break
    case 'panX':
      nextCamera.pan = { ...nextCamera.pan, x: value }
      break
    case 'panY':
      nextCamera.pan = { ...nextCamera.pan, y: value }
      break
  }

  const validation = validateCamera3D(nextCamera)

  if (!validation.valid) {
    return invalidCameraInput(
      camera,
      validation.errors[0]?.message ?? 'Camera values are invalid.',
    )
  }

  return {
    ok: true,
    camera: nextCamera,
  }
}

export function cameraControlFieldValue(
  camera: Camera3D,
  field: CameraControlField,
): string {
  switch (field) {
    case 'thetaDeg':
      return formatCameraNumber(camera.thetaDeg)
    case 'phiDeg':
      return formatCameraNumber(camera.phiDeg)
    case 'zoom':
      return formatCameraNumber(camera.zoom)
    case 'panX':
      return formatCameraNumber(camera.pan.x)
    case 'panY':
      return formatCameraNumber(camera.pan.y)
  }
}

export function cameraSummaryLabel(camera: Camera3D): string {
  return `theta ${formatCameraNumber(camera.thetaDeg)}, phi ${formatCameraNumber(
    camera.phiDeg,
  )}, zoom ${formatCameraNumber(camera.zoom)}`
}

export function cameraPresetIdForCamera(
  camera: Camera3D,
): CameraPresetId | null {
  return (
    cameraPresetIds.find((presetId) =>
      areCamera3DEqual(camera, createCameraPresetCamera(presetId)),
    ) ?? null
  )
}

function createAngleCamera(thetaDeg: number, phiDeg: number): Camera3D {
  return {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg,
    phiDeg,
    zoom: 1,
    pan: { x: 0, y: 0 },
  }
}

function parseFiniteInput(rawValue: string): number | null {
  if (rawValue.trim() === '') {
    return null
  }

  const value = Number(rawValue)

  return Number.isFinite(value) ? value : null
}

function invalidCameraInput(
  camera: Camera3D,
  message: string,
): CameraInputResult {
  return {
    ok: false,
    camera: cloneCamera3D(camera),
    message,
  }
}

function cameraControlFieldLabel(field: CameraControlField): string {
  switch (field) {
    case 'thetaDeg':
      return 'theta'
    case 'phiDeg':
      return 'phi'
    case 'zoom':
      return 'zoom'
    case 'panX':
      return 'pan x'
    case 'panY':
      return 'pan y'
  }
}

function formatCameraNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toPrecision(12)))
}

export function areCamera3DEqual(left: Camera3D, right: Camera3D): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
