import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCamera3D } from '../../src/geometry/projection.ts'
import {
  areCamera3DEqual,
  applyCameraOrbitDrag,
  applyCameraNumericInput,
  applyCameraPanDrag,
  cameraControlStateFromDiagramView,
  cameraControlFieldValue,
  cameraDragModeFromPointerInput,
  cameraOrientationForPreview,
  cameraPresetIdForCamera,
  cameraPresetIds,
  cameraPresetOptions,
  cameraControlSliderFieldsForAmbientDimension,
  cameraControlSliderBounds,
  cameraControlSliderFields,
  cameraControlSliderValue,
  cameraFieldDraftsFromCamera,
  cameraViewAdjustmentFromControls,
  createCameraPresetCamera,
  createInitialCameraControlState,
  fitCameraControlState,
  resetCameraControlState,
  shouldShowCameraControls,
  shouldShowCameraOrientationControls,
  type CameraControlField,
} from '../../src/ui/cameraControls.ts'
import type {
  Camera3D,
  Diagram,
  PerspectiveCamera3D,
} from '../../src/model/types.ts'
import {
  createEmptyDiagram,
  createPointStratum,
} from '../../src/model/constructors.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

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

test('2D and 3D modes both show preview camera controls', () => {
  assert.equal(shouldShowCameraControls(2), true)
  assert.equal(shouldShowCameraControls(3), true)
  assert.equal(shouldShowCameraOrientationControls(2), false)
  assert.equal(shouldShowCameraOrientationControls(3), true)
})

test('2D camera panel exposes only view controls', () => {
  assert.deepEqual(
    cameraControlSliderFieldsForAmbientDimension(2).map((field) => field.field),
    ['zoom', 'panX', 'panY'],
  )
  assert.deepEqual(
    cameraControlSliderFieldsForAmbientDimension(3).map((field) => field.field),
    ['thetaDeg', 'phiDeg', 'zoom', 'panX', 'panY'],
  )
})

test('2D preview pan and zoom state is finite and resettable', () => {
  const changedCamera = expectCameraInputOk(
    expectCameraInputOk(
      expectCameraInputOk(createInitialCameraControlState(), 'zoom', '1.75'),
      'panX',
      '42',
    ),
    'panY',
    '-18',
  )
  const adjustment = cameraViewAdjustmentFromControls(changedCamera)
  const fitted = fitCameraControlState(changedCamera)

  assert.deepEqual(adjustment, { zoom: 1.75, pan: { x: 42, y: -18 } })
  assert.equal(Number.isFinite(adjustment.zoom), true)
  assert.equal(Number.isFinite(adjustment.pan.x), true)
  assert.equal(Number.isFinite(adjustment.pan.y), true)
  assert.equal(fitted.zoom, 1)
  assert.deepEqual(fitted.pan, { x: 0, y: 0 })
})

test('2D preview pan state does not affect TikZ output', () => {
  const diagram = createTwoDimensionalPointDiagram()
  const before = generateTikz(diagram)
  const pannedView = expectCameraInputOk(
    expectCameraInputOk(createInitialCameraControlState(), 'panX', '64'),
    'panY',
    '-32',
  )
  const adjustment = cameraViewAdjustmentFromControls(pannedView)
  const after = generateTikz(diagram)

  assert.deepEqual(adjustment, { zoom: 1, pan: { x: 64, y: -32 } })
  assert.equal(after, before)
})

test('camera control field values use theta and phi camera state', () => {
  const camera = createCameraPresetCamera('isometric')

  assert.equal(cameraControlFieldValue(camera, 'thetaDeg'), '70')
  assert.equal(cameraControlFieldValue(camera, 'phiDeg'), '110')
  assert.equal(cameraControlFieldValue(camera, 'zoom'), '1')
})

test('camera slider specs expose orientation and view controls in panel order', () => {
  assert.deepEqual(
    cameraControlSliderFields.map((field) => field.field),
    ['thetaDeg', 'phiDeg', 'zoom', 'panX', 'panY'],
  )
  assert.deepEqual(
    cameraControlSliderFields
      .filter((field) => field.group === 'orientation')
      .map((field) => [field.field, field.min, field.max, field.step]),
    [
      ['thetaDeg', 0, 180, 1],
      ['phiDeg', -180, 180, 1],
    ],
  )
  assert.deepEqual(
    cameraControlSliderFields
      .filter((field) => field.group === 'view')
      .map((field) => field.field),
    ['zoom', 'panX', 'panY'],
  )
})

test('camera slider values are synchronized with camera state', () => {
  const camera = expectCameraInputOk(
    expectCameraInputOk(
      expectCameraInputOk(
        expectCameraInputOk(
          expectCameraInputOk(createInitialCameraControlState(), 'thetaDeg', '80'),
          'phiDeg',
          '120',
        ),
        'zoom',
        '1.75',
      ),
      'panX',
      '-12',
    ),
    'panY',
    '9',
  )

  assert.equal(cameraControlSliderValue(camera, 'thetaDeg'), 80)
  assert.equal(cameraControlSliderValue(camera, 'phiDeg'), 120)
  assert.equal(cameraControlSliderValue(camera, 'zoom'), 1.75)
  assert.equal(cameraControlSliderValue(camera, 'panX'), -12)
  assert.equal(cameraControlSliderValue(camera, 'panY'), 9)
})

test('camera slider bounds expand around valid custom camera values', () => {
  const camera = expectCameraInputOk(
    expectCameraInputOk(
      expectCameraInputOk(createInitialCameraControlState(), 'thetaDeg', '220'),
      'zoom',
      '6',
    ),
    'panX',
    '-150',
  )

  assert.deepEqual(cameraControlSliderBounds(camera, 'thetaDeg'), {
    min: 0,
    max: 220,
  })
  assert.deepEqual(cameraControlSliderBounds(camera, 'zoom'), {
    min: 0.1,
    max: 6,
  })
  assert.deepEqual(cameraControlSliderBounds(camera, 'panX'), {
    min: -150,
    max: 120,
  })
})

test('camera numeric field drafts mirror formatted camera values', () => {
  const camera = expectCameraInputOk(
    expectCameraInputOk(createCameraPresetCamera('isometric'), 'zoom', '1.25'),
    'panY',
    '-4',
  )

  assert.deepEqual(cameraFieldDraftsFromCamera(camera), {
    thetaDeg: '70',
    phiDeg: '110',
    zoom: '1.25',
    panX: '0',
    panY: '-4',
  })
})

test('camera orbit drag updates theta and phi without changing zoom or pan', () => {
  const camera = createCameraPresetCamera('isometric')
  const dragged = applyCameraOrbitDrag(camera, { x: 20, y: -10 })

  assert.equal(dragged.phiDeg, 117)
  assert.equal(dragged.thetaDeg, 66.5)
  assert.equal(dragged.zoom, camera.zoom)
  assert.deepEqual(dragged.pan, camera.pan)
  assert.equal(dragged.projectionBasis, undefined)
  assert.equal(validateCamera3D(dragged).valid, true)
})

test('camera orbit drag rejects non-finite deltas without mutating camera', () => {
  const camera = createCameraPresetCamera('isometric')

  assert.deepEqual(applyCameraOrbitDrag(camera, { x: Number.NaN, y: 2 }), camera)
  assert.notEqual(applyCameraOrbitDrag(camera, { x: Number.NaN, y: 2 }), camera)
})

test('camera pan drag updates pan without changing orientation or zoom', () => {
  const camera = createCameraPresetCamera('isometric')
  const dragged = applyCameraPanDrag(camera, { x: 12, y: -8 })

  assert.equal(dragged.thetaDeg, camera.thetaDeg)
  assert.equal(dragged.phiDeg, camera.phiDeg)
  assert.equal(dragged.zoom, camera.zoom)
  assert.deepEqual(dragged.pan, { x: 12, y: -8 })
  assert.equal(validateCamera3D(dragged).valid, true)
})

test('camera drag mode starts only for enabled background pointer gestures', () => {
  assert.equal(
    cameraDragModeFromPointerInput({
      cameraDragEnabled: true,
      isBackgroundTarget: true,
      button: 0,
      shiftKey: false,
    }),
    'orbit',
  )
  assert.equal(
    cameraDragModeFromPointerInput({
      cameraDragEnabled: true,
      isBackgroundTarget: true,
      button: 0,
      shiftKey: true,
    }),
    'pan',
  )
  assert.equal(
    cameraDragModeFromPointerInput({
      cameraDragEnabled: true,
      isBackgroundTarget: true,
      button: 1,
      shiftKey: false,
    }),
    'pan',
  )
  assert.equal(
    cameraDragModeFromPointerInput({
      cameraDragEnabled: false,
      isBackgroundTarget: true,
      button: 0,
      shiftKey: false,
    }),
    null,
  )
  assert.equal(
    cameraDragModeFromPointerInput({
      cameraDragEnabled: true,
      isBackgroundTarget: false,
      button: 0,
      shiftKey: false,
    }),
    null,
  )
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

function createTwoDimensionalPointDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createPointStratum({
        ambientDimension: 2,
        id: 'point-for-2d-view-pan',
        position: { x: 1, y: 2, z: 0 },
      }),
    ],
  }
}
