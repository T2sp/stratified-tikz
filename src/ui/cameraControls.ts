import { validateCamera3D } from '../geometry/projection.ts'
import {
  cloneCamera3D,
  createInitialCamera3D,
  isOrthographicCamera3D,
} from '../model/camera.ts'
import type {
  AmbientDimension,
  Diagram,
  OrthographicCamera3D,
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
export type CameraDragMode = 'orbit' | 'pan'
export type CameraControlSliderGroup = 'orientation' | 'view'

export type CameraControlSliderSpec = {
  field: CameraControlField
  label: string
  group: CameraControlSliderGroup
  min: number
  max: number
  step: number
}

export type CameraDragStartInput = {
  cameraDragEnabled: boolean
  isBackgroundTarget: boolean
  button: number
  shiftKey: boolean
}

export type CameraPresetOption = {
  id: CameraPresetId
  label: string
}

export type CameraInputResult =
  | {
      ok: true
      camera: OrthographicCamera3D
    }
  | {
      ok: false
      camera: OrthographicCamera3D
      message: string
    }

export type CameraViewAdjustment = {
  zoom: number
  pan: Vec2
}

const defaultOrbitSensitivityDegPerPixel = 0.35
const defaultPanSensitivity = 1

export const cameraPresetOptions: CameraPresetOption[] = [
  { id: 'initial', label: 'Initial' },
  { id: 'top', label: 'Top (xy)' },
  { id: 'front', label: 'Front (xz)' },
  { id: 'side', label: 'Side (yz)' },
  { id: 'isometric', label: 'Isometric' },
]

export const cameraControlSliderFields: readonly CameraControlSliderSpec[] = [
  {
    field: 'thetaDeg',
    label: 'theta',
    group: 'orientation',
    min: 0,
    max: 180,
    step: 1,
  },
  {
    field: 'phiDeg',
    label: 'phi',
    group: 'orientation',
    min: -180,
    max: 180,
    step: 1,
  },
  {
    field: 'zoom',
    label: 'zoom',
    group: 'view',
    min: 0.1,
    max: 4,
    step: 0.05,
  },
  {
    field: 'panX',
    label: 'pan x',
    group: 'view',
    min: -120,
    max: 120,
    step: 1,
  },
  {
    field: 'panY',
    label: 'pan y',
    group: 'view',
    min: -120,
    max: 120,
    step: 1,
  },
]

export function shouldShowCameraControls(
  ambientDimension: AmbientDimension,
): boolean {
  return ambientDimension === 3
}

export function createInitialCameraControlState(): OrthographicCamera3D {
  return createInitialCamera3D()
}

export function resetCameraControlState(): OrthographicCamera3D {
  return createInitialCameraControlState()
}

export function cameraControlStateFromDiagramView(
  diagram: Diagram,
): OrthographicCamera3D {
  if (diagram.ambientDimension !== 3) {
    return createInitialCameraControlState()
  }

  if (
    diagram.view?.camera3d !== undefined &&
    isOrthographicCamera3D(diagram.view.camera3d)
  ) {
    return cloneCamera3D(diagram.view.camera3d)
  }

  return diagram.camera.mode === '3d' && isOrthographicCamera3D(diagram.camera)
    ? cloneCamera3D(diagram.camera)
    : createInitialCameraControlState()
}

export function fitCameraControlState(
  camera: OrthographicCamera3D,
): OrthographicCamera3D {
  return {
    ...cloneCamera3D(camera),
    zoom: 1,
    pan: { x: 0, y: 0 },
  }
}

export function cameraOrientationForPreview(
  camera: OrthographicCamera3D,
): OrthographicCamera3D {
  return {
    ...cloneCamera3D(camera),
    zoom: 1,
    pan: { x: 0, y: 0 },
  }
}

export function cameraViewAdjustmentFromControls(
  camera: OrthographicCamera3D,
): CameraViewAdjustment {
  return {
    zoom: camera.zoom,
    pan: { ...camera.pan },
  }
}

export function createCameraPresetCamera(
  presetId: CameraPresetId,
): OrthographicCamera3D {
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
  camera: OrthographicCamera3D,
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

export function applyCameraOrbitDrag(
  camera: OrthographicCamera3D,
  delta: Vec2,
  sensitivityDegPerPixel = defaultOrbitSensitivityDegPerPixel,
): OrthographicCamera3D {
  if (!isFiniteDelta(delta) || !isPositiveFinite(sensitivityDegPerPixel)) {
    return cloneCamera3D(camera)
  }

  const nextCamera = {
    ...cloneCamera3D(camera),
    thetaDeg: camera.thetaDeg + delta.y * sensitivityDegPerPixel,
    phiDeg: camera.phiDeg + delta.x * sensitivityDegPerPixel,
  }
  delete nextCamera.projectionBasis

  return validateCamera3D(nextCamera).valid ? nextCamera : cloneCamera3D(camera)
}

export function applyCameraPanDrag(
  camera: OrthographicCamera3D,
  delta: Vec2,
  sensitivity = defaultPanSensitivity,
): OrthographicCamera3D {
  if (!isFiniteDelta(delta) || !isPositiveFinite(sensitivity)) {
    return cloneCamera3D(camera)
  }

  const nextCamera = {
    ...cloneCamera3D(camera),
    pan: {
      x: camera.pan.x + delta.x * sensitivity,
      y: camera.pan.y + delta.y * sensitivity,
    },
  }

  return validateCamera3D(nextCamera).valid ? nextCamera : cloneCamera3D(camera)
}

export function cameraDragModeFromPointerInput({
  cameraDragEnabled,
  isBackgroundTarget,
  button,
  shiftKey,
}: CameraDragStartInput): CameraDragMode | null {
  if (!cameraDragEnabled || !isBackgroundTarget) {
    return null
  }

  if (shiftKey || button === 1) {
    return 'pan'
  }

  return button === 0 ? 'orbit' : null
}

export function cameraControlFieldValue(
  camera: OrthographicCamera3D,
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

export function cameraControlSliderValue(
  camera: OrthographicCamera3D,
  field: CameraControlField,
): number {
  switch (field) {
    case 'thetaDeg':
      return camera.thetaDeg
    case 'phiDeg':
      return camera.phiDeg
    case 'zoom':
      return camera.zoom
    case 'panX':
      return camera.pan.x
    case 'panY':
      return camera.pan.y
  }
}

export function cameraControlSliderBounds(
  camera: OrthographicCamera3D,
  field: CameraControlField,
): { min: number; max: number } {
  const spec = cameraControlSliderSpec(field)
  const value = cameraControlSliderValue(camera, field)

  return {
    min: Math.min(spec.min, value),
    max: Math.max(spec.max, value),
  }
}

export function cameraControlSliderSpec(
  field: CameraControlField,
): CameraControlSliderSpec {
  const spec = cameraControlSliderFields.find(
    (candidate) => candidate.field === field,
  )

  if (spec === undefined) {
    throw new Error(`Unknown camera control field: ${field}`)
  }

  return spec
}

export function cameraFieldDraftsFromCamera(
  camera: OrthographicCamera3D,
): Record<CameraControlField, string> {
  return {
    thetaDeg: cameraControlFieldValue(camera, 'thetaDeg'),
    phiDeg: cameraControlFieldValue(camera, 'phiDeg'),
    zoom: cameraControlFieldValue(camera, 'zoom'),
    panX: cameraControlFieldValue(camera, 'panX'),
    panY: cameraControlFieldValue(camera, 'panY'),
  }
}

export function cameraSummaryLabel(camera: OrthographicCamera3D): string {
  return `theta ${formatCameraNumber(camera.thetaDeg)}, phi ${formatCameraNumber(
    camera.phiDeg,
  )}, zoom ${formatCameraNumber(camera.zoom)}`
}

export function cameraPresetIdForCamera(
  camera: OrthographicCamera3D,
): CameraPresetId | null {
  return (
    cameraPresetIds.find((presetId) =>
      areCamera3DEqual(camera, createCameraPresetCamera(presetId)),
    ) ?? null
  )
}

function createAngleCamera(
  thetaDeg: number,
  phiDeg: number,
): OrthographicCamera3D {
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

function isFiniteDelta(delta: Vec2): boolean {
  return Number.isFinite(delta.x) && Number.isFinite(delta.y)
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function invalidCameraInput(
  camera: OrthographicCamera3D,
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

export function areCamera3DEqual(
  left: OrthographicCamera3D,
  right: OrthographicCamera3D,
): boolean {
  return (
    left.mode === right.mode &&
    left.kind === right.kind &&
    left.thetaDeg === right.thetaDeg &&
    left.phiDeg === right.phiDeg &&
    left.zoom === right.zoom &&
    left.pan.x === right.pan.x &&
    left.pan.y === right.pan.y
  )
}
