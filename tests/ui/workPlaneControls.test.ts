import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  applyCustomOriginNormalThetaPhiWorkPlaneInput,
  applyPickedPointWorkPlane,
  applyCustomOriginNormalWorkPlaneInput,
  applyCustomThreePointWorkPlaneInput,
  canApplyCustomOriginNormalThetaPhiWorkPlaneInput,
  canApplyPickedPointWorkPlane,
  cancelWorkPlaneOriginPicking,
  cancelWorkPlanePointPicking,
  defaultCustomOriginNormalThetaPhiWorkPlaneInput,
  inactiveWorkPlaneOriginPickingState,
  inactiveWorkPlanePointPickingState,
  normalizeActiveWorkPlaneForDiagram,
  normalizeActiveWorkPlaneForAmbientDimension,
  normalVectorFromThetaPhiDegrees,
  normalAngleConventionText,
  normalPhiConventionText,
  normalThetaConventionText,
  pickWorkPlaneOriginCoordinateAnchor,
  pickWorkPlaneOriginPointStratum,
  pickWorkPlaneCoordinateAnchor,
  pickWorkPlanePointStratum,
  resetWorkPlanePointPicking,
  shouldBlockCreationForWorkPlanePointPicking,
  shouldShowWorkPlaneDetails,
  shouldShowWorkPlaneControls,
  shouldShowWorkPlaneOverlay,
  shouldShowWorkPlaneOverlayPanel,
  startWorkPlaneOriginPicking,
  startWorkPlanePointPicking,
  toggleWorkPlaneOverlayPanel,
  validateWorkPlanePointPickingState,
  workPlaneFrameDisplay,
  workPlaneNormalVectorPreviewGeometryFromInput,
  workPlaneOriginReferenceText,
  workPlanePointPickingCount,
  workPlaneDisplayName,
  workPlaneOverlayButtonLabel,
  workPlaneSelectValue,
  workPlaneSetupMethodOptions,
  workPlaneSummaryLabel,
  workPlaneVectorReferenceText,
} from '../../src/ui/workPlaneControls.ts'
import { validateWorkPlane } from '../../src/geometry/workPlane.ts'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import type { CoordinateAnchor, Diagram, WorkPlane } from '../../src/model/types.ts'

test('preview work-plane overlay setup methods use the required order', () => {
  assert.deepEqual(
    workPlaneSetupMethodOptions.map((method) => method.label),
    [
      'Pick 3 existing points',
      'Origin + normal vector',
      'Custom 3 points',
    ],
  )
})

test('work-plane editor is routed to the preview overlay instead of stale toolbar raw normal controls', () => {
  const source = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')

  assert.match(source, /Edit in preview/)
  assert.match(source, /Origin \+ normal vector/)
  assert.match(source, /Pick origin/)
  assert.match(source, /Normal θ/)
  assert.match(source, /Normal φ/)
  assert.match(source, /Custom 3 points/)
  assert.doesNotMatch(source, /Custom by origin \+ normal/)
  assert.doesNotMatch(source, /customWorkPlaneInput\[vector\]\[axis\]/)
})

test('preview origin-normal work-plane panel explains the theta and phi convention', () => {
  const source = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')

  assert.match(source, /normalAngleConventionText/)
  assert.match(source, /normalThetaConventionText/)
  assert.match(source, /normalPhiConventionText/)
  assert.match(source, /preview-work-plane-angle-convention/)
  assert.match(normalAngleConventionText, /θ is measured from \+z/)
  assert.match(
    normalAngleConventionText,
    /φ is measured in the xy-plane from \+x toward \+y/,
  )
  assert.match(normalAngleConventionText, /Angles are in degrees/)
})

test('normal theta and phi controls expose accessible angle descriptions', () => {
  const source = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')
  const describedByCount = source.match(/aria-describedby={describedBy}/g)?.length ?? 0

  assert.match(source, /preview-work-plane-normal-angle-convention/)
  assert.match(source, /preview-work-plane-normal-theta-help/)
  assert.match(source, /preview-work-plane-normal-phi-help/)
  assert.match(source, /className="preview-work-plane-angle-help"/)
  assert.equal(describedByCount, 2)
  assert.match(normalThetaConventionText, /\+z/)
  assert.match(normalThetaConventionText, /degrees/)
  assert.match(normalPhiConventionText, /\+x/)
  assert.match(normalPhiConventionText, /\+y/)
  assert.match(normalPhiConventionText, /degrees/)
})

test('valid origin and normal input applies a custom work plane in 3D', () => {
  const previous: WorkPlane = { kind: 'xy', z: 5 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '1', y: '2', z: '3' },
    normal: { x: '0', y: '0', z: '2' },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 'Custom plane applied.')
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.name, 'Custom plane')
  assert.deepEqual(result.workPlane.origin, { x: 1, y: 2, z: 3 })
  assert.deepEqual(result.workPlane.normal, { x: 0, y: 0, z: 1 })
  assert.equal(workPlaneSelectValue(result.workPlane), 'custom')
  assert.equal(workPlaneDisplayName(result.workPlane), 'Custom plane')
})

test('theta and phi normal input follows polar-from-z spherical coordinates', () => {
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(0, 37)),
    { x: 0, y: 0, z: 1 },
  )
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(90, 0)),
    { x: 1, y: 0, z: 0 },
  )
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(90, 90)),
    { x: 0, y: 1, z: 0 },
  )
})

test('theta and phi normal input handles poles, negative azimuths, and wraps', () => {
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(180, 91)),
    { x: 0, y: 0, z: -1 },
  )
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(90, 180)),
    { x: -1, y: 0, z: 0 },
  )
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(90, -90)),
    { x: 0, y: -1, z: 0 },
  )
  assertVec3Approx(
    nonNullVec3(normalVectorFromThetaPhiDegrees(90, 450)),
    { x: 0, y: 1, z: 0 },
  )
})

test('theta and phi origin-normal input applies a valid orthonormal frame', () => {
  const result = applyCustomOriginNormalThetaPhiWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      origin: { x: '1', y: '2', z: '3' },
      normalThetaDeg: '90',
      normalPhiDeg: '0',
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assertVec3Approx(result.workPlane.origin, { x: 1, y: 2, z: 3 })
  assertVec3Approx(result.workPlane.normal, { x: 1, y: 0, z: 0 })
  assertVec3Approx(result.workPlane.u, { x: 0, y: 1, z: 0 })
  assert.equal(validateWorkPlane(result.workPlane).valid, true)
})

test('theta and phi origin-normal input rejects invalid drafts without mutating the active plane', () => {
  const previous: WorkPlane = { kind: 'xz', y: -2 }
  const input = {
    ...defaultCustomOriginNormalThetaPhiWorkPlaneInput,
    normalThetaDeg: '',
  }
  const result = applyCustomOriginNormalThetaPhiWorkPlaneInput(previous, 3, input)

  assert.equal(canApplyCustomOriginNormalThetaPhiWorkPlaneInput(input), false)
  assert.equal(result.ok, false)
  assert.equal(result.status, 'Origin and normal angles must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('origin-normal method picks origin from a point stratum', () => {
  const diagram = createPointPickingDiagram()
  const started = startWorkPlaneOriginPicking(3)
  const picked = pickWorkPlaneOriginPointStratum(
    diagram,
    started.state,
    defaultCustomOriginNormalThetaPhiWorkPlaneInput,
    'p1',
  )
  const applied = applyCustomOriginNormalThetaPhiWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    picked.input,
  )

  assert.equal(started.state.active, true)
  assert.equal(picked.state.active, false)
  assert.deepEqual(picked.input.origin, { x: '1', y: '0', z: '0' })
  assert.match(picked.status, /Origin picked from point/)
  assert.equal(applied.ok, true)
  assert.equal(applied.workPlane.kind, 'custom')

  if (applied.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.deepEqual(applied.workPlane.origin, { x: 1, y: 0, z: 0 })
})

test('origin-normal method picks origin from a coordinate anchor', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [coordinateAnchor('coord-a', 'A', 2.5, -3, 4)]
  const picked = pickWorkPlaneOriginCoordinateAnchor(
    diagram,
    startWorkPlaneOriginPicking(3).state,
    defaultCustomOriginNormalThetaPhiWorkPlaneInput,
    'coord-a',
  )
  const applied = applyCustomOriginNormalThetaPhiWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    picked.input,
  )

  assert.equal(picked.state, inactiveWorkPlaneOriginPickingState)
  assert.deepEqual(picked.input.origin, { x: '2.5', y: '-3', z: '4' })
  assert.match(picked.status, /Origin picked from coordinate A/)
  assert.equal(applied.ok, true)
  assert.equal(applied.workPlane.kind, 'custom')

  if (applied.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.deepEqual(applied.workPlane.origin, { x: 2.5, y: -3, z: 4 })
})

test('origin picking can be canceled without changing the origin draft', () => {
  const input = {
    ...defaultCustomOriginNormalThetaPhiWorkPlaneInput,
    origin: { x: '7', y: '8', z: '9' },
  }
  const result = cancelWorkPlaneOriginPicking(input)

  assert.equal(result.state, inactiveWorkPlaneOriginPickingState)
  assert.strictEqual(result.input, input)
  assert.equal(result.status, 'Origin picking canceled.')
})

test('normal-vector preview geometry renders and changes with theta and phi', () => {
  const zPreview = workPlaneNormalVectorPreviewGeometryFromInput(
    defaultCustomOriginNormalThetaPhiWorkPlaneInput,
  )
  const xPreview = workPlaneNormalVectorPreviewGeometryFromInput({
    ...defaultCustomOriginNormalThetaPhiWorkPlaneInput,
    normalThetaDeg: '90',
    normalPhiDeg: '0',
  })

  assert.notEqual(zPreview, null)
  assert.notEqual(xPreview, null)

  if (zPreview === null || xPreview === null) {
    throw new Error('Expected preview geometry.')
  }

  assert.equal(zPreview.axes.length, 3)
  assert.equal(zPreview.normal.label, 'n')
  assert.notDeepEqual(zPreview.normal.to, xPreview.normal.to)
})

test('zero normal input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xz', y: -2 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '1', y: '2', z: '3' },
    normal: { x: '0', y: '0', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Normal vector must be nonzero.')
  assert.strictEqual(result.workPlane, previous)
})

test('non-finite origin or normal input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'yz', x: 4 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '1', y: 'Infinity', z: '3' },
    normal: { x: '0', y: '1', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Origin and normal must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('blank numeric input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xy', z: 1 }
  const result = applyCustomOriginNormalWorkPlaneInput(previous, 3, {
    origin: { x: '', y: '0', z: '0' },
    normal: { x: '0', y: '0', z: '1' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Origin and normal must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('valid three-point input applies a custom work plane in 3D', () => {
  const previous: WorkPlane = { kind: 'xy', z: 5 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '1', y: '2', z: '3' },
    p1: { x: '3', y: '2', z: '3' },
    p2: { x: '1', y: '5', z: '3' },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 'Custom plane applied.')
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.source.kind, 'threePoints')
  assert.deepEqual(result.workPlane.origin, { x: 1, y: 2, z: 3 })
  assert.deepEqual(result.workPlane.u, { x: 1, y: 0, z: 0 })
})

test('three-point input uses P0 as origin and P1 minus P0 as u direction', () => {
  const result = applyCustomThreePointWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      p0: { x: '2', y: '3', z: '4' },
      p1: { x: '2', y: '6', z: '4' },
      p2: { x: '2', y: '3', z: '8' },
    },
  )

  assert.equal(result.ok, true)

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.deepEqual(result.workPlane.origin, { x: 2, y: 3, z: 4 })
  assert.deepEqual(result.workPlane.u, { x: 0, y: 1, z: 0 })
})

test('collinear three-point input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xz', y: -2 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '1', z: '1' },
    p2: { x: '2', y: '2', z: '2' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must not be collinear.')
  assert.strictEqual(result.workPlane, previous)
})

test('coincident three-point input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'yz', x: 4 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '0', z: '0' },
    p2: { x: '1', y: '0', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must be distinct.')
  assert.strictEqual(result.workPlane, previous)
})

test('non-finite three-point input is rejected without changing the active work plane', () => {
  const previous: WorkPlane = { kind: 'xy', z: 1 }
  const result = applyCustomThreePointWorkPlaneInput(previous, 3, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: 'Infinity', y: '0', z: '0' },
    p2: { x: '0', y: '1', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must be finite numbers.')
  assert.strictEqual(result.workPlane, previous)
})

test('three-point custom work planes are rejected outside 3D mode', () => {
  const previous: WorkPlane = {
    kind: 'custom',
    id: 'previous',
    name: 'Previous plane',
    origin: { x: 1, y: 1, z: 1 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: { kind: 'threePoints' },
  }
  const result = applyCustomThreePointWorkPlaneInput(previous, 2, {
    p0: { x: '0', y: '0', z: '0' },
    p1: { x: '1', y: '0', z: '0' },
    p2: { x: '0', y: '1', z: '0' },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Custom work planes are available only in 3D.')
  assert.deepEqual(result.workPlane, { kind: 'xy', z: 0 })
})

test('work plane controls are hidden outside 3D mode', () => {
  assert.equal(shouldShowWorkPlaneControls(2), false)
  assert.equal(shouldShowWorkPlaneControls(3), true)
})

test('work plane details expand only in 3D mode', () => {
  assert.equal(shouldShowWorkPlaneDetails(3, true), true)
  assert.equal(shouldShowWorkPlaneDetails(3, false), false)
  assert.equal(shouldShowWorkPlaneDetails(2, true), false)
})

test('preview work-plane overlay appears only in 3D mode', () => {
  assert.equal(shouldShowWorkPlaneOverlay(3), true)
  assert.equal(shouldShowWorkPlaneOverlay(2), false)
  assert.equal(
    workPlaneOverlayButtonLabel({ kind: 'xz', y: 2 }),
    'Work plane: xz plane ▾',
  )
})

test('preview work-plane overlay panel opens and closes only when available', () => {
  assert.equal(toggleWorkPlaneOverlayPanel(false), true)
  assert.equal(toggleWorkPlaneOverlayPanel(true), false)
  assert.equal(shouldShowWorkPlaneOverlayPanel(3, true), true)
  assert.equal(shouldShowWorkPlaneOverlayPanel(3, false), false)
  assert.equal(shouldShowWorkPlaneOverlayPanel(2, true), false)
})

test('work-plane frame display renders current origin and plane vectors', () => {
  const workPlane: WorkPlane = {
    kind: 'custom',
    id: 'display-plane',
    name: 'Display plane',
    origin: { x: 1, y: 2, z: 3 },
    u: { x: 0, y: 1, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 1, y: 0, z: 0 },
    source: { kind: 'originNormal' },
  }
  const display = workPlaneFrameDisplay(workPlane)

  assert.deepEqual(display?.origin, { x: 1, y: 2, z: 3 })
  assert.equal(workPlaneOriginReferenceText(workPlane), 'Active work-plane origin: (1, 2, 3)')
  assert.equal(
    workPlaneVectorReferenceText(workPlane),
    'Plane x (0, 1, 0); plane y (0, 0, 1)',
  )
})

test('active work plane summary names the fixed coordinate in 3D', () => {
  assert.equal(workPlaneSummaryLabel({ kind: 'xy', z: 0 }), 'xy plane at z = 0')
  assert.equal(workPlaneSummaryLabel({ kind: 'xz', y: -2 }), 'xz plane at y = -2')
  assert.equal(workPlaneSummaryLabel({ kind: 'yz', x: 4 }), 'yz plane at x = 4')
})

test('switching to 2D resets active work plane to xy at z equals 0', () => {
  const customResult = applyCustomOriginNormalWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      origin: { x: '1', y: '2', z: '3' },
      normal: { x: '1', y: '1', z: '1' },
    },
  )

  assert.equal(customResult.ok, true)
  assert.deepEqual(
    normalizeActiveWorkPlaneForAmbientDimension(2, customResult.workPlane),
    { kind: 'xy', z: 0 },
  )
})

test('loading a diagram can reset active custom work-plane UI state', () => {
  const diagram = createPointPickingDiagram()
  const activeWorkPlane = applyPickedPointWorkPlane(
    { kind: 'xy', z: 0 },
    3,
    diagram,
    { active: true, pickedPointIds: ['p0', 'p1', 'p2'] },
  ).workPlane
  const loadedDiagram = createEmptyDiagram({ ambientDimension: 3 })

  assert.deepEqual(
    normalizeActiveWorkPlaneForDiagram(loadedDiagram, activeWorkPlane),
    { kind: 'xy', z: 0 },
  )
})

test('loading a diagram does not reset snapshot origin-normal active work planes', () => {
  const result = applyCustomOriginNormalThetaPhiWorkPlaneInput(
    { kind: 'xy', z: 0 },
    3,
    {
      origin: { x: '1', y: '2', z: '3' },
      normalThetaDeg: '45',
      normalPhiDeg: '30',
    },
  )
  const loadedDiagram = createEmptyDiagram({ ambientDimension: 3 })

  assert.equal(result.ok, true)
  assert.strictEqual(
    normalizeActiveWorkPlaneForDiagram(loadedDiagram, result.workPlane),
    result.workPlane,
  )
})

test('active custom planes from existing points are valid only while source points exist', () => {
  const diagram = createPointPickingDiagram()
  const activeWorkPlane = applyPickedPointWorkPlane(
    { kind: 'xy', z: 0 },
    3,
    diagram,
    { active: true, pickedPointIds: ['p0', 'p1', 'p2'] },
  ).workPlane

  assert.strictEqual(
    normalizeActiveWorkPlaneForDiagram(diagram, activeWorkPlane),
    activeWorkPlane,
  )

  assert.deepEqual(
    normalizeActiveWorkPlaneForDiagram(
      {
        ...diagram,
        strata: diagram.strata.filter((stratum) => stratum.id !== 'p1'),
      },
      activeWorkPlane,
    ),
    { kind: 'xy', z: 0 },
  )
})

test('active custom planes from existing points reset through undo and redo diagram changes', () => {
  const diagramWithSourcePoints = createPointPickingDiagram()
  const activeWorkPlane = applyPickedPointWorkPlane(
    { kind: 'xy', z: 0 },
    3,
    diagramWithSourcePoints,
    { active: true, pickedPointIds: ['p0', 'p1', 'p2'] },
  ).workPlane
  const diagramAfterUndoingSourcePoint: Diagram = {
    ...diagramWithSourcePoints,
    strata: diagramWithSourcePoints.strata.filter(
      (stratum) => stratum.id !== 'p2',
    ),
  }
  const resetWorkPlane = normalizeActiveWorkPlaneForDiagram(
    diagramAfterUndoingSourcePoint,
    activeWorkPlane,
  )

  assert.deepEqual(resetWorkPlane, { kind: 'xy', z: 0 })
  assert.deepEqual(
    normalizeActiveWorkPlaneForDiagram(diagramWithSourcePoints, resetWorkPlane),
    { kind: 'xy', z: 0 },
  )
})

test('picking three distinct point strata creates a custom work plane', () => {
  const diagram = createPointPickingDiagram()
  const started = startWorkPlanePointPicking(3)
  const first = pickWorkPlanePointStratum(started.state, 'p0')
  const second = pickWorkPlanePointStratum(first.state, 'p1')
  const third = pickWorkPlanePointStratum(second.state, 'p2')
  const result = applyPickedPointWorkPlane(
    { kind: 'xy', z: 5 },
    3,
    diagram,
    third.state,
  )

  assert.equal(result.ok, true)
  assert.equal(result.status, 'Custom plane applied from picked points.')
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.source.kind, 'existingPointStrata')

  if (result.workPlane.source.kind !== 'existingPointStrata') {
    throw new Error('Expected existing point stratum source metadata.')
  }

  assert.deepEqual(result.workPlane.source.pointIds, ['p0', 'p1', 'p2'])
  assert.deepEqual(result.workPlane.origin, { x: 0, y: 0, z: 0 })
  assert.deepEqual(result.workPlane.u, { x: 1, y: 0, z: 0 })
})

test('picked point work-plane Apply is enabled only with exactly three active picks', () => {
  const started = startWorkPlanePointPicking(3)
  const first = pickWorkPlanePointStratum(started.state, 'p0')
  const second = pickWorkPlanePointStratum(first.state, 'p1')
  const third = pickWorkPlanePointStratum(second.state, 'p2')

  assert.equal(canApplyPickedPointWorkPlane(started.state), false)
  assert.equal(canApplyPickedPointWorkPlane(first.state), false)
  assert.equal(canApplyPickedPointWorkPlane(second.state), false)
  assert.equal(canApplyPickedPointWorkPlane(third.state), true)
  assert.equal(
    canApplyPickedPointWorkPlane({
      active: false,
      pickedPointIds: ['p0', 'p1', 'p2'],
    }),
    false,
  )
})

test('picking three coordinate anchors creates a snapshot custom work plane', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [
    coordinateAnchor('coord-a', 'A', 0, 0, 0),
    coordinateAnchor('coord-b', 'B', 1, 0, 0),
    coordinateAnchor('coord-c', 'C', 0, 1, 0),
  ]
  const first = pickWorkPlaneCoordinateAnchor(
    diagram,
    startWorkPlanePointPicking(3).state,
    'coord-a',
  )
  const second = pickWorkPlaneCoordinateAnchor(diagram, first.state, 'coord-b')
  const third = pickWorkPlaneCoordinateAnchor(diagram, second.state, 'coord-c')
  const result = applyPickedPointWorkPlane(
    { kind: 'xy', z: 5 },
    3,
    diagram,
    third.state,
  )

  assert.equal(workPlanePointPickingCount(third.state), 3)
  assert.deepEqual(third.state.pickedPointIds, [])
  assert.equal(result.ok, true)
  assert.equal(result.status, 'Custom plane applied from picked points and coordinates.')
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.source.kind, 'threePoints')
  assert.deepEqual(result.workPlane.origin, { x: 0, y: 0, z: 0 })
  assert.deepEqual(result.workPlane.u, { x: 1, y: 0, z: 0 })
})

test('picked work-plane targets can mix point strata and coordinate anchors', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [
    coordinateAnchor('coord-b', 'B', 1, 0, 0),
    coordinateAnchor('coord-c', 'C', 0, 1, 0),
  ]
  const first = pickWorkPlanePointStratum(startWorkPlanePointPicking(3).state, 'p0')
  const second = pickWorkPlaneCoordinateAnchor(diagram, first.state, 'coord-b')
  const third = pickWorkPlaneCoordinateAnchor(diagram, second.state, 'coord-c')
  const result = applyPickedPointWorkPlane(
    { kind: 'xy', z: 5 },
    3,
    diagram,
    third.state,
  )

  assert.equal(result.ok, true)
  assert.equal(result.workPlane.kind, 'custom')

  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  assert.equal(result.workPlane.source.kind, 'threePoints')
  assert.deepEqual(result.workPlane.origin, { x: 0, y: 0, z: 0 })
})

test('work-plane-local coordinate anchors can be picked from finite previews', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [
    workPlaneLocalCoordinateAnchor('coord-a', 'A', 0, 0, 0),
    workPlaneLocalCoordinateAnchor('coord-b', 'B', 1, 0, 0),
    workPlaneLocalCoordinateAnchor('coord-c', 'C', 0, 1, 0),
  ]
  const first = pickWorkPlaneCoordinateAnchor(
    diagram,
    startWorkPlanePointPicking(3).state,
    'coord-a',
  )
  const second = pickWorkPlaneCoordinateAnchor(diagram, first.state, 'coord-b')
  const third = pickWorkPlaneCoordinateAnchor(diagram, second.state, 'coord-c')
  const result = applyPickedPointWorkPlane(
    { kind: 'xy', z: 5 },
    3,
    diagram,
    third.state,
  )

  assert.equal(result.ok, true)
  assert.equal(result.workPlane.kind, 'custom')
})

test('work-plane coordinate picks snapshot anchor positions', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [
    coordinateAnchor('coord-a', 'A', 0, 0, 0),
    coordinateAnchor('coord-b', 'B', 1, 0, 0),
    coordinateAnchor('coord-c', 'C', 0, 1, 0),
  ]
  let state = startWorkPlanePointPicking(3).state
  state = pickWorkPlaneCoordinateAnchor(diagram, state, 'coord-a').state
  state = pickWorkPlaneCoordinateAnchor(diagram, state, 'coord-b').state
  state = pickWorkPlaneCoordinateAnchor(diagram, state, 'coord-c').state
  const result = applyPickedPointWorkPlane({ kind: 'xy', z: 5 }, 3, diagram, state)

  assert.equal(result.ok, true)
  if (result.workPlane.kind !== 'custom') {
    throw new Error('Expected a custom work plane.')
  }

  diagram.coordinateAnchors = [
    coordinateAnchor('coord-a', 'A', 10, 10, 10),
    coordinateAnchor('coord-b', 'B', 11, 10, 10),
    coordinateAnchor('coord-c', 'C', 10, 11, 10),
  ]

  assert.deepEqual(result.workPlane.origin, { x: 0, y: 0, z: 0 })
})

test('duplicate point picks are rejected', () => {
  const started = startWorkPlanePointPicking(3)
  const first = pickWorkPlanePointStratum(started.state, 'p0')
  const duplicate = pickWorkPlanePointStratum(first.state, 'p0')

  assert.equal(duplicate.status, 'Point already picked.')
  assert.deepEqual(duplicate.state.pickedPointIds, ['p0'])
})

test('duplicate coordinate anchor picks are rejected', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [coordinateAnchor('coord-a', 'A', 0, 0, 0)]
  const first = pickWorkPlaneCoordinateAnchor(
    diagram,
    startWorkPlanePointPicking(3).state,
    'coord-a',
  )
  const duplicate = pickWorkPlaneCoordinateAnchor(diagram, first.state, 'coord-a')

  assert.equal(duplicate.status, 'Coordinate anchor already picked.')
  assert.equal(workPlanePointPickingCount(duplicate.state), 1)
})

test('hidden coordinate anchors are not pickable for work-plane setup', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [coordinateAnchor('coord-a', 'A', 0, 0, 0)]
  const pointPick = pickWorkPlaneCoordinateAnchor(
    diagram,
    startWorkPlanePointPicking(3).state,
    'coord-a',
    { showCoordinateAnchors: false },
  )
  const originPick = pickWorkPlaneOriginCoordinateAnchor(
    diagram,
    startWorkPlaneOriginPicking(3).state,
    defaultCustomOriginNormalThetaPhiWorkPlaneInput,
    'coord-a',
    { showCoordinateAnchors: false },
  )

  assert.equal(pointPick.status, 'Coordinate anchors are hidden.')
  assert.equal(workPlanePointPickingCount(pointPick.state), 0)
  assert.equal(originPick.status, 'Coordinate anchors are hidden.')
  assert.equal(originPick.state.active, true)
  assert.strictEqual(
    originPick.input,
    defaultCustomOriginNormalThetaPhiWorkPlaneInput,
  )
})

test('collinear picked point positions are rejected without changing active plane', () => {
  const previous: WorkPlane = { kind: 'yz', x: 4 }
  const diagram = createPointPickingDiagram([
    { id: 'p0', position: { x: 0, y: 0, z: 0 } },
    { id: 'p1', position: { x: 1, y: 1, z: 1 } },
    { id: 'p2', position: { x: 2, y: 2, z: 2 } },
  ])
  const result = applyPickedPointWorkPlane(previous, 3, diagram, {
    active: true,
    pickedPointIds: ['p0', 'p1', 'p2'],
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must not be collinear.')
  assert.strictEqual(result.workPlane, previous)
})

test('cancel and reset clear work-plane point picking state', () => {
  const picked = pickWorkPlanePointStratum(startWorkPlanePointPicking(3).state, 'p0')
  const reset = resetWorkPlanePointPicking()
  const canceled = cancelWorkPlanePointPicking()

  assert.deepEqual(picked.state.pickedPointIds, ['p0'])
  assert.equal(reset.state.active, true)
  assert.deepEqual(reset.state.pickedPointIds, [])
  assert.deepEqual(canceled.state, inactiveWorkPlanePointPickingState)
})

test('active work-plane point picking blocks ordinary geometry creation', () => {
  assert.equal(
    shouldBlockCreationForWorkPlanePointPicking({ active: true, pickedPointIds: [] }),
    true,
  )
  assert.equal(
    shouldBlockCreationForWorkPlanePointPicking(inactiveWorkPlanePointPickingState),
    false,
  )
})

test('stale picked point ids are cleared when point strata disappear', () => {
  const diagram = createPointPickingDiagram()
  const deletedDiagram: Diagram = {
    ...diagram,
    strata: diagram.strata.filter((stratum) => stratum.id !== 'p1'),
  }
  const validation = validateWorkPlanePointPickingState(deletedDiagram, {
    active: true,
    pickedPointIds: ['p0', 'p1', 'p2'],
  })

  assert.deepEqual(validation.removedStalePointIds, ['p1'])
  assert.deepEqual(validation.state.pickedPointIds, ['p0', 'p2'])
})

test('stale picked coordinate ids are cleared when anchors disappear', () => {
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [
    coordinateAnchor('coord-a', 'A', 0, 0, 0),
    coordinateAnchor('coord-b', 'B', 1, 0, 0),
  ]
  const validation = validateWorkPlanePointPickingState(
    { ...diagram, coordinateAnchors: [coordinateAnchor('coord-a', 'A', 0, 0, 0)] },
    {
      active: true,
      pickedPointIds: [],
      pickedTargets: [
        { kind: 'coordinateAnchor', id: 'coord-a' },
        { kind: 'coordinateAnchor', id: 'coord-b' },
      ],
    },
  )

  assert.deepEqual(validation.removedStaleCoordinateIds, ['coord-b'])
  assert.equal(workPlanePointPickingCount(validation.state), 1)
})

test('collinear coordinate anchor picks are rejected without changing active plane', () => {
  const previous: WorkPlane = { kind: 'yz', x: 4 }
  const diagram = createPointPickingDiagram()
  diagram.coordinateAnchors = [
    coordinateAnchor('coord-a', 'A', 0, 0, 0),
    coordinateAnchor('coord-b', 'B', 1, 1, 1),
    coordinateAnchor('coord-c', 'C', 2, 2, 2),
  ]
  const result = applyPickedPointWorkPlane(previous, 3, diagram, {
    active: true,
    pickedPointIds: [],
    pickedTargets: [
      { kind: 'coordinateAnchor', id: 'coord-a' },
      { kind: 'coordinateAnchor', id: 'coord-b' },
      { kind: 'coordinateAnchor', id: 'coord-c' },
    ],
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, 'Plane points must not be collinear.')
  assert.strictEqual(result.workPlane, previous)
})

function createPointPickingDiagram(
  points: Array<{ id: string; position: { x: number; y: number; z: number } }> = [
    { id: 'p0', position: { x: 0, y: 0, z: 0 } },
    { id: 'p1', position: { x: 1, y: 0, z: 0 } },
    { id: 'p2', position: { x: 0, y: 1, z: 0 } },
  ],
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  return {
    ...diagram,
    strata: points.map((point) =>
      createPointStratum({
        ambientDimension: 3,
        id: point.id,
        position: point.position,
      }),
    ),
  }
}

function coordinateAnchor(
  id: string,
  name: string,
  x: number,
  y: number,
  z: number,
): CoordinateAnchor {
  return {
    id,
    name,
    tikzName: name,
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: x },
        y: { kind: 'numeric', value: y },
        z: { kind: 'numeric', value: z },
      },
    },
  }
}

function workPlaneLocalCoordinateAnchor(
  id: string,
  name: string,
  x: number,
  y: number,
  z: number,
): CoordinateAnchor {
  return {
    id,
    name,
    tikzName: name,
    position: {
      kind: 'workPlaneLocal',
      frame: {
        origin: { x: 0, y: 0, z: 0 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
      local: {
        a: { kind: 'numeric', value: x },
        b: { kind: 'numeric', value: y },
      },
      preview: { x, y, z },
    },
  }
}

function nonNullVec3(value: ReturnType<typeof normalVectorFromThetaPhiDegrees>) {
  if (value === null) {
    throw new Error('Expected a finite normal vector.')
  }

  return value
}

function assertVec3Approx(
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
  epsilon = 1e-9,
): void {
  assert.ok(Math.abs(actual.x - expected.x) <= epsilon)
  assert.ok(Math.abs(actual.y - expected.y) <= epsilon)
  assert.ok(Math.abs(actual.z - expected.z) <= epsilon)
}
