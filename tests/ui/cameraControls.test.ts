import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCamera3D } from '../../src/geometry/projection.ts'
import {
  areCamera3DEqual,
  applyCameraNumericInput,
  cameraControlStateFromDiagramView,
  cameraControlFieldValue,
  cameraOrientationForPreview,
  cameraPresetIdForCamera,
  cameraPresetIds,
  cameraPresetOptions,
  cameraViewAdjustmentFromControls,
  createCameraPresetCamera,
  createInitialCameraControlState,
  fitCameraControlState,
  resetCameraControlState,
  shouldShowCameraControls,
  type CameraControlField,
} from '../../src/ui/cameraControls.ts'
import type { Camera3D, PerspectiveCamera3D } from '../../src/model/types.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'

test('camera control input updates camera values', () => {
  let camera = createInitialCameraControlState()

  camera = expectCameraInputOk(camera, 'thetaDeg', '70')
  camera = expectCameraInputOk(camera, 'phiDeg', '110')
  camera = expectCameraInputOk(camera, 'zoom', '1.5')
  camera = expectCameraInputOk(camera, 'panX', '12')
  camera = expectCameraInputOk(camera, 'panY', '-8')

  assert.equal(camera.thetaDeg, 70)
  assert.equal(camera.phiDeg, 110)
  assert.equal(camera.zoom, 1.5)
  assert.deepEqual(camera.pan, { x: 12, y: -8 })
  assert.equal(camera.projectionBasis, undefined)
})

test('invalid camera control input is rejected', () => {
  const camera = createInitialCameraControlState()
  const invalidInputs: Array<[CameraControlField, string]> = [
    ['thetaDeg', ''],
    ['thetaDeg', 'NaN'],
    ['phiDeg', 'Infinity'],
    ['zoom', 'not-a-number'],
    ['panX', ''],
    ['panY', '-Infinity'],
  ]

  invalidInputs.forEach(([field, rawValue]) => {
    const result = applyCameraNumericInput(camera, field, rawValue)

    assert.equal(result.ok, false)
    assert.deepEqual(result.camera, camera)
  })
})

test('zoom cannot become zero or negative', () => {
  const camera = createInitialCameraControlState()
  const invalidZoomValues = ['0', '-0.1', '-10']

  invalidZoomValues.forEach((rawValue) => {
    const result = applyCameraNumericInput(camera, 'zoom', rawValue)

    assert.equal(result.ok, false)
    assert.deepEqual(result.camera, camera)
  })
})

test('reset returns initial camera and fit resets relative view only', () => {
  const changedCamera = expectCameraInputOk(
    expectCameraInputOk(
      expectCameraInputOk(createInitialCameraControlState(), 'zoom', '2'),
      'panX',
      '20',
    ),
    'panY',
    '-5',
  )
  const fitted = fitCameraControlState(changedCamera)

  assert.deepEqual(resetCameraControlState(), createInitialCameraControlState())
  assert.equal(fitted.thetaDeg, changedCamera.thetaDeg)
  assert.equal(fitted.phiDeg, changedCamera.phiDeg)
  assert.deepEqual(fitted.projectionBasis, changedCamera.projectionBasis)
  assert.equal(fitted.zoom, 1)
  assert.deepEqual(fitted.pan, { x: 0, y: 0 })
})

test('camera presets produce valid camera states', () => {
  cameraPresetIds.forEach((presetId) => {
    const camera = createCameraPresetCamera(presetId)

    assert.equal(validateCamera3D(camera).valid, true)
    assert.equal(cameraPresetIdForCamera(camera), presetId)
    assert.equal(camera.zoom, 1)
    assert.deepEqual(camera.pan, { x: 0, y: 0 })
  })
})

test('deprecated projectionBasis does not affect camera preset matching', () => {
  const camera: Camera3D = {
    ...createCameraPresetCamera('initial'),
    projectionBasis: {
      xVector: [1, 0],
      yVector: [0.5, 0.25],
      zVector: [0, 1],
    },
  }

  assert.equal(
    areCamera3DEqual(camera, createCameraPresetCamera('initial')),
    true,
  )
  assert.equal(cameraPresetIdForCamera(camera), 'initial')
})

test('camera preset options provide stable names for every preset', () => {
  assert.deepEqual(
    cameraPresetOptions.map((preset) => preset.id),
    cameraPresetIds,
  )
  assert.deepEqual(
    cameraPresetOptions.map((preset) => preset.label),
    ['Initial', 'Top (xy)', 'Front (xz)', 'Side (yz)', 'Isometric'],
  )
})

test('angle camera presets use tikz-3dplot axis views', () => {
  const anglePresets = [
    { presetId: 'top', thetaDeg: 0, phiDeg: 0 },
    { presetId: 'front', thetaDeg: 90, phiDeg: 0 },
    { presetId: 'side', thetaDeg: 90, phiDeg: 90 },
    { presetId: 'isometric', thetaDeg: 70, phiDeg: 110 },
  ] as const

  anglePresets.forEach(({ presetId, thetaDeg, phiDeg }) => {
    const camera = createCameraPresetCamera(presetId)

    assert.equal(camera.thetaDeg, thetaDeg)
    assert.equal(camera.phiDeg, phiDeg)
    assert.equal(camera.projectionBasis, undefined)
  })
})

test('camera controls expose orientation and view adjustment separately', () => {
  const camera = expectCameraInputOk(
    expectCameraInputOk(
      expectCameraInputOk(createCameraPresetCamera('isometric'), 'zoom', '1.25'),
      'panX',
      '7',
    ),
    'panY',
    '-4',
  )
  const orientation = cameraOrientationForPreview(camera)
  const adjustment = cameraViewAdjustmentFromControls(camera)

  assert.equal(orientation.thetaDeg, 70)
  assert.equal(orientation.phiDeg, 110)
  assert.equal(orientation.zoom, 1)
  assert.deepEqual(orientation.pan, { x: 0, y: 0 })
  assert.deepEqual(adjustment, { zoom: 1.25, pan: { x: 7, y: -4 } })
})

test('camera control state prefers diagram view camera metadata', () => {
  const viewCamera = createCameraPresetCamera('isometric')
  const diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    view: {
      camera3d: viewCamera,
    },
  }
  const camera = cameraControlStateFromDiagramView(diagram)

  assert.deepEqual(camera, viewCamera)
  assert.notEqual(camera, viewCamera)
  assert.equal(areCamera3DEqual(camera, viewCamera), true)
})

test('camera control state disables unsupported perspective camera metadata', () => {
  const perspectiveCamera: PerspectiveCamera3D = {
    mode: '3d',
    kind: 'perspective',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 1,
    pan: { x: 0, y: 0 },
    target: { x: 0, y: 0, z: 0 },
    distance: 8,
    fieldOfViewDeg: 45,
  }
  const diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    view: {
      camera3d: perspectiveCamera,
    },
  }
  const camera = cameraControlStateFromDiagramView(diagram)

  assert.deepEqual(camera, createInitialCameraControlState())
  assert.equal(camera.kind, 'orthographic')
})

test('2D mode hides camera controls and 3D mode shows them', () => {
  assert.equal(shouldShowCameraControls(2), false)
  assert.equal(shouldShowCameraControls(3), true)
})

test('camera control field values use theta and phi camera state', () => {
  const camera = createCameraPresetCamera('isometric')

  assert.equal(cameraControlFieldValue(camera, 'thetaDeg'), '70')
  assert.equal(cameraControlFieldValue(camera, 'phiDeg'), '110')
  assert.equal(cameraControlFieldValue(camera, 'zoom'), '1')
})

function expectCameraInputOk(
  camera: Camera3D,
  field: CameraControlField,
  rawValue: string,
): Camera3D {
  const result = applyCameraNumericInput(camera, field, rawValue)

  if (!result.ok) {
    throw new Error(result.message)
  }

  return result.camera
}
