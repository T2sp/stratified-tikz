import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseCursorSnapStep,
  snapCoordinateToStep,
  snapCursorPoint,
  type CursorSnapSettings,
} from '../../src/geometry/cursorSnap.ts'
import { pointOnWorkPlane } from '../../src/geometry/workPlane.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import {
  addSymbolicVariableToDiagram,
  type SymbolicVariableInput,
} from '../../src/model/variables.ts'
import type {
  Diagram,
  PointStratum,
  Vec3,
  WorkPlane,
} from '../../src/model/types.ts'
import {
  addPointStratumFromDirectInput,
  addPointStratumWithResult,
} from '../../src/ui/diagramUpdates.ts'
import { updateDiagramGeometryHandle } from '../../src/ui/geometryHandles.ts'
import {
  appendConcatenatedPathDraftPoint,
  createConcatenatedPathDraft,
} from '../../src/ui/pathDraft.ts'

const snapOff: CursorSnapSettings = { enabled: false, step: 1 }
const snapStep01: CursorSnapSettings = { enabled: true, step: 0.1 }

test('snap off preserves a 3D cursor coordinate', () => {
  const point = { x: 0.26, y: -0.74, z: 1.99 }

  assert.deepEqual(
    snapCursorPoint(point, {
      ambientDimension: 3,
      snap: snapOff,
    }),
    point,
  )
})

test('2D snap step 0.1 rounds x and y while keeping z at 0', () => {
  const snapped = snapCursorPoint(
    { x: 0.26, y: -0.34, z: 12 },
    {
      ambientDimension: 2,
      snap: snapStep01,
    },
  )

  assert.deepEqual(snapped, { x: 0.3, y: -0.3, z: 0 })
  assert.equal(snapCoordinateToStep(0.30000000000000004, 0.1), 0.3)
})

test('2D snap step 0.001 rounds cleanly', () => {
  assert.deepEqual(
    snapCursorPoint(
      { x: 1.2344, y: -2.3456, z: 9 },
      {
        ambientDimension: 2,
        snap: { enabled: true, step: 0.001 },
      },
    ),
    { x: 1.234, y: -2.346, z: 0 },
  )
})

test('invalid snap steps are rejected', () => {
  assert.equal(parseCursorSnapStep(''), null)
  assert.equal(parseCursorSnapStep('0'), null)
  assert.equal(parseCursorSnapStep('-0.5'), null)
  assert.equal(parseCursorSnapStep('Infinity'), null)
  assert.equal(parseCursorSnapStep('NaN'), null)
  assert.equal(
    snapCursorPoint(
      { x: 1, y: 2, z: 3 },
      {
        ambientDimension: 3,
        snap: { enabled: true, step: 0 },
      },
    ),
    null,
  )
})

test('3D snap rounds work-plane-local coordinates', () => {
  const workPlane: WorkPlane = { kind: 'yz', x: 10 }
  const point = pointOnWorkPlane(workPlane, 0.26, 0.74)
  const snapped = snapCursorPoint(point, {
    ambientDimension: 3,
    snap: { enabled: true, step: 0.5 },
    workPlane,
  })

  assert.deepEqual(snapped, pointOnWorkPlane(workPlane, 0.5, 0.5))
})

test('cursor-created point uses snap before committing geometry', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const snapped = requireSnappedPoint(
    { x: 0.26, y: 0.74, z: 8 },
    diagram,
    snapStep01,
  )
  const result = addPointStratumWithResult(diagram, snapped, {
    id: 'snapped-cursor-point',
  })
  const point = findPoint(result.diagram, result.id)

  assert.deepEqual(point.position, { x: 0.3, y: 0.7, z: 0 })
})

test('cursor-created path vertex uses snap before draft append', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const workPlane: WorkPlane = { kind: 'xy', z: 0 }
  const firstPoint = requireSnappedPoint(
    { x: 0.24, y: 0.26, z: 4 },
    diagram,
    snapStep01,
    workPlane,
  )
  const draftResult = createConcatenatedPathDraft(
    firstPoint,
    workPlane,
    'line',
    diagram.ambientDimension,
  )

  assert.equal(draftResult.ok, true)
  if (!draftResult.ok) {
    throw new Error('Expected path draft creation to succeed.')
  }

  const secondPoint = requireSnappedPoint(
    { x: 1.24, y: 1.26, z: 4 },
    diagram,
    snapStep01,
    workPlane,
  )
  const appendResult = appendConcatenatedPathDraftPoint(
    draftResult.draft,
    secondPoint,
    diagram.ambientDimension,
  )

  assert.equal(appendResult.ok, true)
  if (!appendResult.ok) {
    throw new Error('Expected path draft append to succeed.')
  }

  assert.deepEqual(appendResult.draft.segments, [
    {
      kind: 'line',
      start: { x: 0.2, y: 0.3, z: 0 },
      end: { x: 1.2, y: 1.3, z: 0 },
    },
  ])
})

test('drag handle update uses snap when fed cursor-drag coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const pointResult = addPointStratumWithResult(diagram, { x: 0, y: 0, z: 0 }, {
    id: 'drag-snap-point',
  })
  const snapped = requireSnappedPoint(
    { x: 0.26, y: 0.74, z: 9 },
    pointResult.diagram,
    snapStep01,
  )
  const updated = updateDiagramGeometryHandle(
    pointResult.diagram,
    { kind: 'pointPosition', stratumId: pointResult.id },
    snapped,
  )

  assert.deepEqual(findPoint(updated, pointResult.id).position, {
    x: 0.3,
    y: 0.7,
    z: 0,
  })
})

test('direct input ignores cursor snap settings', () => {
  const snap: CursorSnapSettings = { enabled: true, step: 1 }
  const result = addPointStratumFromDirectInput(
    createEmptyDiagram({ ambientDimension: 2 }),
    { x: '0.26', y: '0.74', z: '8' },
  )

  assert.equal(snap.enabled, true)
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  assert.deepEqual(findPoint(result.diagram, result.id).position, {
    x: 0.26,
    y: 0.74,
    z: 0,
  })
})

test('symbolic input ignores cursor snap settings', () => {
  const snap: CursorSnapSettings = { enabled: true, step: 1 }
  const result = addPointStratumFromDirectInput(symbolicDiagram(), {
    x: 'R + 0.26',
    y: '0.74',
    z: '0',
  })

  assert.equal(snap.step, 1)
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('Expected symbolic point creation to succeed.')
  }

  const point = findPoint(result.diagram, result.id)

  assert.equal(point.position.x, 2.26)
  assert.equal(point.position.y, 0.74)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, 'R + 0.26')
  assert.equal(point.position.symbolic?.y.kind, 'numeric')
  assert.equal(point.position.symbolic?.y.value, 0.74)
})

test('existing cursor behavior is unchanged when snap is off', () => {
  const snapped = snapCursorPoint(
    { x: 0.26, y: 0.74, z: 8 },
    {
      ambientDimension: 2,
      snap: snapOff,
      workPlane: { kind: 'xy', z: 0 },
    },
  )

  assert.deepEqual(snapped, { x: 0.26, y: 0.74, z: 0 })
})

function requireSnappedPoint(
  point: Vec3,
  diagram: Diagram,
  snap: CursorSnapSettings,
  workPlane: WorkPlane = { kind: 'xy', z: 0 },
): Vec3 {
  const snapped = snapCursorPoint(point, {
    ambientDimension: diagram.ambientDimension,
    snap,
    workPlane,
  })

  if (snapped === null) {
    throw new Error('Expected snap to produce a point.')
  }

  return snapped
}

function symbolicDiagram(): Diagram {
  const result = addSymbolicVariableToDiagram(
    createEmptyDiagram({ ambientDimension: 2 }),
    variable('var-R', 'R', '2'),
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}

function variable(
  id: string,
  name: string,
  expression: string,
): SymbolicVariableInput {
  return {
    id,
    name,
    expression,
    macroName: name,
  }
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Point ${id} was not found.`)
  }

  return stratum
}
