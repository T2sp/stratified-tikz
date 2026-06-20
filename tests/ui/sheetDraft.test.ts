import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyThreeDimensionalDiagram } from '../../src/examples/emptyDiagrams.ts'
import { defaultCurveStyle } from '../../src/model/styles.ts'
import type { ConcatenatedPathStratum, Diagram, Vec3 } from '../../src/model/types.ts'
import {
  areFinitePoints,
  arePointsOnWorkPlane,
  boundarySurfacePathClickWorkflow,
  coonsPatchBoundaryDraftCanCreate,
  coonsPatchBoundaryDraftPickedBoundaryForRole,
  coonsPatchBoundarySelectionsFromDraft,
  coonsPatchBoundaryDraftStatusMessage,
  coonsPatchBoundaryDraftPickedSourceIds,
  createCoonsPatchBoundaryDraft,
  createRuledSurfaceBoundaryDraft,
  createSheetPolygonDraft,
  isPointOnWorkPlane,
  pickCoonsPatchBoundaryDraftPoint,
  pickCoonsPatchBoundaryDraftPath,
  pickRuledSurfaceBoundaryDraftPath,
  resetCoonsPatchBoundaryDraft,
  resetRuledSurfaceBoundaryDraft,
  ruledSurfaceBoundaryDraftCanCreate,
  ruledSurfaceBoundaryDraftStatusMessage,
  sheetDraftBlocksWorkPlaneChange,
  toggleCoonsPatchBoundaryDraftReverse,
} from '../../src/ui/sheetDraft.ts'
import {
  coonsPatchCornerEquationStatuses,
  coonsPatchRequiredCornerEquations,
  validateCoonsPatchBoundaryPathSource,
  validateCoonsPatchBoundaryPointSource,
  validateRuledSurfaceBoundaryPathSource,
} from '../../src/ui/ruledSurface.ts'
import type { PointStratum, WorkPlane } from '../../src/model/types.ts'

test('sheet polygon draft captures the initial work plane', () => {
  const workPlane: WorkPlane = { kind: 'xy', z: 2 }
  const draft = createSheetPolygonDraft({ x: 1, y: 1, z: 2 }, workPlane)

  workPlane.z = 5

  assert.deepEqual(draft.workPlane, { kind: 'xy', z: 2 })
  assert.deepEqual(draft.points, [{ x: 1, y: 1, z: 2 }])
})

test('active sheet drafts block work-plane changes', () => {
  const draft = createSheetPolygonDraft({ x: 0, y: 0, z: 0 }, { kind: 'xy', z: 0 })

  assert.equal(sheetDraftBlocksWorkPlaneChange(draft), true)
  assert.equal(sheetDraftBlocksWorkPlaneChange(null), false)
})

test('work-plane membership accepts valid xy, xz, and yz sheet vertices', () => {
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 0, y: 0, z: 3 },
        { x: 1, y: 0, z: 3 },
        { x: 0, y: 1, z: 3 },
      ],
      { kind: 'xy', z: 3 },
    ),
    true,
  )
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 0, y: 4, z: 0 },
        { x: 1, y: 4, z: 0 },
        { x: 0, y: 4, z: 1 },
      ],
      { kind: 'xz', y: 4 },
    ),
    true,
  )
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 5, y: 0, z: 0 },
        { x: 5, y: 1, z: 0 },
        { x: 5, y: 0, z: 1 },
      ],
      { kind: 'yz', x: 5 },
    ),
    true,
  )
})

test('work-plane membership rejects mixed-plane sheet vertices', () => {
  assert.equal(
    arePointsOnWorkPlane(
      [
        { x: 0, y: 0, z: 3 },
        { x: 1, y: 0, z: 3 },
        { x: 0, y: 1, z: 4 },
      ],
      { kind: 'xy', z: 3 },
    ),
    false,
  )
  assert.equal(isPointOnWorkPlane({ x: 1, y: 4.1, z: 0 }, { kind: 'xz', y: 4 }), false)
  assert.equal(isPointOnWorkPlane({ x: 5.1, y: 0, z: 0 }, { kind: 'yz', x: 5 }), false)
})

test('finite point checks reject NaN and infinities', () => {
  assert.equal(
    areFinitePoints([
      { x: 0, y: 0, z: 0 },
      { x: Number.NaN, y: 0, z: 0 },
    ]),
    false,
  )
  assert.equal(
    areFinitePoints([
      { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
      { x: 1, y: 0, z: Number.NEGATIVE_INFINITY },
    ]),
    false,
  )
})

test('Coons patch boundary draft picks bottom, right, top, then left', () => {
  let draft = createCoonsPatchBoundaryDraft()

  assert.equal(draft.nextRole, 'bottom')
  assert.equal(
    coonsPatchBoundaryDraftStatusMessage(draft),
    'Pick bottom boundary path or point.',
  )

  const bottom = pickCoonsPatchBoundaryDraftPath(draft, 'bottom-path')

  assert.equal(bottom.ok, true)
  if (!bottom.ok) {
    throw new Error('Expected bottom pick to succeed.')
  }
  draft = bottom.draft
  assert.deepEqual(draft.bottom, {
    sourcePathId: 'bottom-path',
    reversed: false,
  })
  assert.deepEqual(coonsPatchBoundaryDraftPickedBoundaryForRole(draft, 'bottom'), {
    sourcePathId: 'bottom-path',
    reversed: false,
  })
  assert.equal(draft.nextRole, 'right')
  assert.equal(coonsPatchBoundaryDraftCanCreate(draft), false)

  const right = pickCoonsPatchBoundaryDraftPath(draft, 'right-path')

  assert.equal(right.ok, true)
  if (!right.ok) {
    throw new Error('Expected right pick to succeed.')
  }
  draft = right.draft
  assert.deepEqual(draft.right, {
    sourcePathId: 'right-path',
    reversed: false,
  })
  assert.equal(draft.nextRole, 'top')

  const top = pickCoonsPatchBoundaryDraftPath(draft, 'top-path')

  assert.equal(top.ok, true)
  if (!top.ok) {
    throw new Error('Expected top pick to succeed.')
  }
  draft = top.draft
  assert.deepEqual(draft.top, {
    sourcePathId: 'top-path',
    reversed: false,
  })
  assert.equal(draft.nextRole, 'left')
  assert.equal(
    coonsPatchBoundaryDraftStatusMessage(draft),
    'Coons patch: picked 3/4. Next: left.',
  )

  const left = pickCoonsPatchBoundaryDraftPath(draft, 'left-path')

  assert.equal(left.ok, true)
  if (!left.ok) {
    throw new Error('Expected left pick to succeed.')
  }
  draft = left.draft
  assert.deepEqual(draft.left, {
    sourcePathId: 'left-path',
    reversed: false,
  })
  assert.equal(draft.nextRole, 'left')
  assert.equal(coonsPatchBoundaryDraftCanCreate(draft), true)
  assert.deepEqual(coonsPatchBoundarySelectionsFromDraft(draft), {
    bottom: { sourcePathId: 'bottom-path', reversed: false },
    right: { sourcePathId: 'right-path', reversed: false },
    top: { sourcePathId: 'top-path', reversed: false },
    left: { sourcePathId: 'left-path', reversed: false },
  })
})

test('Coons patch boundary draft reset clears picks and duplicate does not clear previous picks', () => {
  const first = pickCoonsPatchBoundaryDraftPath(
    createCoonsPatchBoundaryDraft(),
    'shared-path',
  )

  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error('Expected first Coons pick to succeed.')
  }

  const duplicate = pickCoonsPatchBoundaryDraftPath(first.draft, 'shared-path')

  assert.equal(duplicate.ok, false)
  if (duplicate.ok) {
    throw new Error('Expected duplicate Coons pick to fail.')
  }
  assert.equal(duplicate.error, 'duplicatePath')
  assert.deepEqual(duplicate.draft, first.draft)

  const reset = resetCoonsPatchBoundaryDraft()

  assert.deepEqual(reset, createCoonsPatchBoundaryDraft())
})

test('Coons patch boundary draft toggles one role direction without clearing picks', () => {
  const bottom = pickCoonsPatchBoundaryDraftPath(
    createCoonsPatchBoundaryDraft(),
    'bottom-path',
  )
  assert.equal(bottom.ok, true)
  if (!bottom.ok) {
    throw new Error('Expected bottom pick to succeed.')
  }

  const right = pickCoonsPatchBoundaryDraftPath(bottom.draft, 'right-path')
  assert.equal(right.ok, true)
  if (!right.ok) {
    throw new Error('Expected right pick to succeed.')
  }

  const top = pickCoonsPatchBoundaryDraftPath(right.draft, 'top-path')
  assert.equal(top.ok, true)
  if (!top.ok) {
    throw new Error('Expected top pick to succeed.')
  }

  const left = pickCoonsPatchBoundaryDraftPath(top.draft, 'left-path')
  assert.equal(left.ok, true)
  if (!left.ok) {
    throw new Error('Expected left pick to succeed.')
  }

  const reversedTop = toggleCoonsPatchBoundaryDraftReverse(left.draft, 'top')

  assert.deepEqual(reversedTop.bottom, left.draft.bottom)
  assert.deepEqual(reversedTop.right, left.draft.right)
  assert.deepEqual(reversedTop.left, left.draft.left)
  assert.deepEqual(reversedTop.top, {
    sourcePathId: 'top-path',
    reversed: true,
  })
  assert.equal(reversedTop.nextRole, 'left')

  const restoredTop = toggleCoonsPatchBoundaryDraftReverse(reversedTop, 'top')

  assert.deepEqual(restoredTop.top, {
    sourcePathId: 'top-path',
    reversed: false,
  })
  assert.deepEqual(
    toggleCoonsPatchBoundaryDraftReverse(createCoonsPatchBoundaryDraft(), 'left'),
    createCoonsPatchBoundaryDraft(),
  )
})

test('Coons patch boundary draft stores point inputs and mixed selections', () => {
  const bottom = pickCoonsPatchBoundaryDraftPoint(
    createCoonsPatchBoundaryDraft(),
    'bottom-point',
  )

  assert.equal(bottom.ok, true)
  if (!bottom.ok) {
    throw new Error('Expected bottom point pick to succeed.')
  }
  assert.deepEqual(bottom.draft.bottom, {
    kind: 'point',
    sourcePointId: 'bottom-point',
  })
  assert.deepEqual(coonsPatchBoundaryDraftPickedSourceIds(bottom.draft), [
    'bottom-point',
  ])

  const right = pickCoonsPatchBoundaryDraftPath(bottom.draft, 'right-path')
  assert.equal(right.ok, true)
  if (!right.ok) {
    throw new Error('Expected right path pick to succeed.')
  }

  assert.deepEqual(coonsPatchBoundarySelectionsFromDraft(right.draft), {
    bottom: { kind: 'point', sourcePointId: 'bottom-point' },
    right: { sourcePathId: 'right-path', reversed: false },
  })
  assert.deepEqual(
    toggleCoonsPatchBoundaryDraftReverse(right.draft, 'bottom'),
    right.draft,
  )
})

test('Coons patch corner equation helper returns required equations and status updates', () => {
  const selections = {
    bottom: 'coons-bottom',
    right: 'coons-right',
    top: 'coons-top',
    left: 'coons-left',
  }
  const validStatuses = coonsPatchCornerEquationStatuses(
    coonsStatusDiagram(),
    selections,
  )
  const reversedRightStatuses = coonsPatchCornerEquationStatuses(
    coonsStatusDiagram(),
    {
      ...selections,
      right: { sourcePathId: 'coons-right', reversed: true },
    },
  )

  assert.deepEqual(
    coonsPatchRequiredCornerEquations.map((equation) => equation.label),
    [
      'bottom start = left start',
      'bottom end = right start',
      'top start = left end',
      'top end = right end',
    ],
  )
  assert.deepEqual(
    validStatuses.map((status) => status.matches),
    [true, true, true, true],
  )
  assert.deepEqual(
    reversedRightStatuses
      .filter((status) => status.matches === false)
      .map((status) => status.label),
    ['bottom end = right start', 'top end = right end'],
  )
})

test('Coons patch corner equation status supports constant point boundaries', () => {
  const statuses = coonsPatchCornerEquationStatuses(coonsPointStatusDiagram(), {
    bottom: { kind: 'point', sourcePointId: 'coons-bottom-point' },
    right: 'coons-point-right',
    top: 'coons-point-top',
    left: 'coons-point-left',
  })
  const pointValidation = validateCoonsPatchBoundaryPointSource(
    coonsPointStatusDiagram(),
    'coons-bottom-point',
  )

  assert.deepEqual(
    statuses.map((status) => status.matches),
    [true, true, true, true],
  )
  assert.equal(pointValidation.ok, true)
  if (!pointValidation.ok) {
    throw new Error('Expected point source validation to succeed.')
  }
  assert.equal(pointValidation.boundary.kind, 'constantPoint')
  assert.deepEqual(pointValidation.boundary.point, { x: 0, y: 0, z: 0 })
})

test('ruled surface boundary draft picks first then second boundary', () => {
  let draft = createRuledSurfaceBoundaryDraft()

  assert.equal(draft.nextRole, 'boundary0')
  assert.equal(ruledSurfaceBoundaryDraftStatusMessage(draft), 'Pick first boundary path.')

  const first = pickRuledSurfaceBoundaryDraftPath(draft, 'first-path')

  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error('Expected first ruled boundary pick to succeed.')
  }
  draft = first.draft
  assert.equal(draft.boundary0Id, 'first-path')
  assert.equal(draft.nextRole, 'boundary1')
  assert.equal(ruledSurfaceBoundaryDraftCanCreate(draft), false)
  assert.equal(
    ruledSurfaceBoundaryDraftStatusMessage(draft),
    'Ruled surface: picked 1/2. Next: second boundary.',
  )

  const second = pickRuledSurfaceBoundaryDraftPath(draft, 'second-path')

  assert.equal(second.ok, true)
  if (!second.ok) {
    throw new Error('Expected second ruled boundary pick to succeed.')
  }
  draft = second.draft
  assert.equal(draft.boundary1Id, 'second-path')
  assert.equal(draft.nextRole, 'boundary1')
  assert.equal(ruledSurfaceBoundaryDraftCanCreate(draft), true)
})

test('ruled surface boundary draft reset clears picks and duplicate does not clear previous pick', () => {
  const first = pickRuledSurfaceBoundaryDraftPath(
    createRuledSurfaceBoundaryDraft(),
    'shared-path',
  )

  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error('Expected first ruled pick to succeed.')
  }

  const duplicate = pickRuledSurfaceBoundaryDraftPath(first.draft, 'shared-path')

  assert.equal(duplicate.ok, false)
  if (duplicate.ok) {
    throw new Error('Expected duplicate ruled pick to fail.')
  }
  assert.equal(duplicate.error, 'duplicatePath')
  assert.deepEqual(duplicate.draft, first.draft)

  const reset = resetRuledSurfaceBoundaryDraft()

  assert.deepEqual(reset, createRuledSurfaceBoundaryDraft())
})

test('boundary path click workflow preserves select mode and routes Add sheet boundary modes', () => {
  assert.equal(
    boundarySurfacePathClickWorkflow({
      tool: 'select',
      sheetCreationKind: 'other',
      workPlanePointPickingActive: false,
    }),
    'select',
  )
  assert.equal(
    boundarySurfacePathClickWorkflow({
      tool: 'createSheet',
      sheetCreationKind: 'coonsPatch',
      workPlanePointPickingActive: false,
    }),
    'coonsPatch',
  )
  assert.equal(
    boundarySurfacePathClickWorkflow({
      tool: 'createSheet',
      sheetCreationKind: 'ruledSurface',
      workPlanePointPickingActive: false,
    }),
    'ruledSurface',
  )
  assert.equal(
    boundarySurfacePathClickWorkflow({
      tool: 'createSheet',
      sheetCreationKind: 'coonsPatch',
      workPlanePointPickingActive: true,
    }),
    null,
  )
  assert.equal(
    boundarySurfacePathClickWorkflow({
      tool: 'createSheet',
      sheetCreationKind: 'other',
      workPlanePointPickingActive: false,
    }),
    null,
  )
})

test('invalid boundary source validation rejects without clearing previous draft picks', () => {
  const first = pickRuledSurfaceBoundaryDraftPath(
    createRuledSurfaceBoundaryDraft(),
    'first-boundary',
  )

  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error('Expected first ruled boundary pick to succeed.')
  }

  const invalidClickedObject = pointStratum('not-a-path')
  const sourceValidation = validateRuledSurfaceBoundaryPathSource(
    {
      ...emptyThreeDimensionalDiagram,
      strata: [openBoundaryPath('first-boundary'), invalidClickedObject],
    },
    invalidClickedObject.id,
  )

  const sourceValidationFailed = !sourceValidation.ok

  assert.equal(sourceValidationFailed, true)
  if (sourceValidation.ok) {
    throw new Error('Expected point source validation to fail.')
  }
  assert.equal(sourceValidation.error, 'sourceNotBoundaryPath')

  const uncommittedPick = pickRuledSurfaceBoundaryDraftPath(
    first.draft,
    invalidClickedObject.id,
  )

  assert.equal(uncommittedPick.ok, true)
  if (!uncommittedPick.ok) {
    throw new Error('Expected raw draft pick to accept a non-empty id.')
  }
  assert.notDeepEqual(uncommittedPick.draft, first.draft)

  const committedDraft = sourceValidationFailed
    ? first.draft
    : uncommittedPick.draft

  assert.deepEqual(committedDraft, {
    kind: 'ruledSurface',
    boundary0Id: 'first-boundary',
    nextRole: 'boundary1',
  })
})

test('Coons patch pick-time validation rejects closed boundary paths', () => {
  const closedPath: ConcatenatedPathStratum = {
    id: 'closed-boundary',
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    name: 'Closed boundary',
    style: defaultCurveStyle,
    styleSegments: [],
    layer: 0,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 1, y: 1, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 1, z: 0 },
        end: { x: 0, y: 1, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 0, y: 1, z: 0 },
        end: { x: 0, y: 0, z: 0 },
      },
    ],
  }
  const result = validateCoonsPatchBoundaryPathSource(
    {
      ...emptyThreeDimensionalDiagram,
      strata: [closedPath],
    },
    'closed-boundary',
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected closed Coons boundary validation to fail.')
  }
  assert.equal(result.error, 'sourceClosedPath')
})

function coonsStatusDiagram(): Diagram {
  return {
    ...emptyThreeDimensionalDiagram,
    strata: [
      boundaryPath('coons-bottom', { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
      boundaryPath('coons-right', { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }),
      boundaryPath('coons-top', { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }),
      boundaryPath('coons-left', { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    ],
  }
}

function coonsPointStatusDiagram(): Diagram {
  return {
    ...emptyThreeDimensionalDiagram,
    strata: [
      pointStratum('coons-bottom-point'),
      boundaryPath(
        'coons-point-right',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ),
      boundaryPath(
        'coons-point-top',
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ),
      boundaryPath(
        'coons-point-left',
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ),
    ],
  }
}

function openBoundaryPath(id: string): ConcatenatedPathStratum {
  return boundaryPath(id, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })
}

function boundaryPath(
  id: string,
  start: Vec3,
  end: Vec3,
): ConcatenatedPathStratum {
  return {
    id,
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    name: 'Open boundary',
    style: defaultCurveStyle,
    styleSegments: [],
    layer: 0,
    segments: [
      {
        kind: 'line',
        start,
        end,
      },
    ],
  }
}

function pointStratum(id: string): PointStratum {
  return {
    id,
    codim: 3,
    geometricKind: 'point',
    kind: 'point',
    name: 'Point source',
    position: { x: 0, y: 0, z: 0 },
    style: {
      kind: 'pointStyle',
      color: '#000000',
      opacity: 1,
      shape: 'circle',
      fill: 'filled',
      size: 3,
    },
    layer: 0,
  }
}
