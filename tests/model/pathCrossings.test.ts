import assert from 'node:assert/strict'
import test from 'node:test'
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import { deleteLayer } from '../../src/model/layers.ts'
import {
  createCurveStratum,
  createEmptyDiagram,
  createGridStratum,
  createPointStratum,
  createSheetStratum,
} from '../../src/model/constructors.ts'
import {
  createNumericScalarInputValue,
  xyGridFrame,
} from '../../src/model/grids.ts'
import {
  cleanPathCrossingStates,
  filterPathCrossingStatesForExisting2DCurves,
  pathCrossingStateFromCandidate,
  pathCrossingKindForCandidate,
  togglePathCrossingStateForCandidate,
} from '../../src/model/pathCrossings.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { removeSelectedElement } from '../../src/ui/diagramUpdates.ts'
import { findSelectedElement } from '../../src/ui/selection.ts'
import type {
  CurveStratum,
  Diagram,
  GridParameterRange,
  PathArrowOptions,
  PathCrossingState,
  PathIntersectionCandidate,
  Stratum,
  Vec3,
} from '../../src/model/types.ts'

test('toggling a crossing candidate cycles none braiding anti-braiding none', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)

  assert.equal(pathCrossingKindForCandidate(diagram, candidate), 'none')

  const first = togglePathCrossingStateForCandidate(diagram, candidate)
  assert.equal(first.ok, true)
  if (!first.ok) {
    throw new Error(first.reason)
  }
  assert.equal(first.kind, 'braiding')
  assert.equal(first.state.kind, 'braiding')
  assert.equal(first.diagram.pathCrossings?.[0]?.kind, 'braiding')

  const second = togglePathCrossingStateForCandidate(first.diagram, candidate)
  assert.equal(second.ok, true)
  if (!second.ok) {
    throw new Error(second.reason)
  }
  assert.equal(second.kind, 'antiBraiding')
  assert.equal(second.diagram.pathCrossings?.[0]?.kind, 'antiBraiding')

  const third = togglePathCrossingStateForCandidate(second.diagram, candidate)
  assert.equal(third.ok, true)
  if (!third.ok) {
    throw new Error(third.reason)
  }
  assert.equal(third.kind, 'none')
  assert.equal(third.diagram.pathCrossings?.[0]?.kind, 'none')
})

test('crossing state saves and loads', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const toggled = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(toggled.ok, true)
  if (!toggled.ok) {
    throw new Error(toggled.reason)
  }

  const loaded = parseSavedDiagramJson(serializeDiagram(toggled.diagram))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  assert.equal(loaded.diagram.pathCrossings?.length, 1)
  assert.equal(loaded.diagram.pathCrossings?.[0]?.kind, 'braiding')
  assert.equal(loaded.diagram.pathCrossings?.[0]?.id, candidate.id)
})

test('crossing state saves and loads with path arrows', () => {
  const arrows: PathArrowOptions = {
    endpoint: 'both',
    mid: {
      enabled: true,
      position: 0.5,
      direction: 'forward',
      head: 'stealthHarpoon',
    },
  }
  const diagram = diagramWithCurves([
    lineCurve('path-a', point(-1, 0), point(1, 0), arrows),
    lineCurve('path-b', point(0, -1), point(0, 1)),
  ])
  const candidate = onlyCandidate(diagram)
  const toggled = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(toggled.ok, true)
  if (!toggled.ok) {
    throw new Error(toggled.reason)
  }

  const loaded = parseSavedDiagramJson(serializeDiagram(toggled.diagram))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  const loadedPathA = loaded.diagram.strata.find(
    (stratum) => stratum.id === 'path-a',
  )

  assert.equal(loaded.diagram.pathCrossings?.length, 1)
  assert.equal(loaded.diagram.pathCrossings?.[0]?.kind, 'braiding')
  assert.equal(loadedPathA?.geometricKind, 'curve')
  if (loadedPathA?.geometricKind !== 'curve') {
    throw new Error('Expected path-a to load as a curve.')
  }
  assert.deepEqual(loadedPathA.arrows, arrows)
})

test('invalid referenced path is rejected by validation and cleaned on load', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const toggled = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(toggled.ok, true)
  if (!toggled.ok) {
    throw new Error(toggled.reason)
  }

  const invalidDiagram: Diagram = {
    ...toggled.diagram,
    pathCrossings: [
      {
        ...toggled.state,
        pathAId: 'missing-path',
      },
    ],
  }
  const validation = validateDiagram(invalidDiagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors.map((issue) => `${issue.path} ${issue.message}`).join('\n'),
    /pathAId/,
  )

  const saved = JSON.parse(serializeDiagram(toggled.diagram)) as {
    diagram: {
      pathCrossings?: Array<{ pathAId: string }>
    }
  }
  if (saved.diagram.pathCrossings === undefined) {
    throw new Error('Expected saved path crossing state.')
  }

  saved.diagram.pathCrossings[0].pathAId = 'missing-path'
  const loaded = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  assert.equal(loaded.diagram.pathCrossings, undefined)
  assert.equal(
    loaded.warnings.some((warning) => warning.includes('stale path crossing')),
    true,
  )
})

test('candidate pathA and pathB order is deterministic', () => {
  const diagram = diagramWithCurves([
    lineCurve('z-path', point(-1, 0), point(1, 0)),
    lineCurve('a-path', point(0, -1), point(0, 1)),
  ])
  const candidate = onlyCandidate(diagram)
  const toggled = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(candidate.pathAId, 'a-path')
  assert.equal(candidate.pathBId, 'z-path')
  assert.equal(toggled.ok, true)
  if (!toggled.ok) {
    throw new Error(toggled.reason)
  }
  assert.equal(toggled.state.pathAId, 'a-path')
  assert.equal(toggled.state.pathBId, 'z-path')
})

test('3D diagrams cannot create crossing state', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const candidate: PathIntersectionCandidate = {
    id: 'crossing:path-a:path-b:0p500000:0p500000',
    pathAId: 'path-a',
    pathBId: 'path-b',
    point: point(0, 0, 0),
    parameterA: 0.5,
    parameterB: 0.5,
    tangentA: { x: 1, y: 0 },
    tangentB: { x: 0, y: 1 },
  }
  const result = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(result.ok, false)
  assert.equal(result.diagram.pathCrossings, undefined)
  if (result.ok) {
    throw new Error('Expected 3D toggle to fail.')
  }
  assert.equal(result.reason, 'unsupportedAmbientDimension')
})

test('stale crossing state is invalidated when curve geometry changes', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const toggled = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(toggled.ok, true)
  if (!toggled.ok) {
    throw new Error(toggled.reason)
  }

  const moved: Diagram = {
    ...toggled.diagram,
    strata: toggled.diagram.strata.map((stratum) =>
      stratum.id === 'path-b' && stratum.geometricKind === 'curve'
        ? lineCurve('path-b', point(0, 2), point(1, 2))
        : stratum,
    ),
  }
  const cleaned = cleanPathCrossingStates(moved)

  assert.equal(cleaned.pathCrossings, undefined)
})

test('valid crossing state is preserved by cleanup', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const state = pathCrossingStateFromCandidate(candidate, 'braiding')
  const cleaned = cleanPathCrossingStates({
    ...diagram,
    pathCrossings: [state],
  })

  assert.equal(cleaned.pathCrossings?.length, 1)
  assert.equal(cleaned.pathCrossings?.[0]?.id, candidate.id)
  assert.equal(cleaned.pathCrossings?.[0]?.kind, 'braiding')
})

test('stale crossing state can be reconciled by path pair when requested', () => {
  const diagram = diagramWithCurves([
    lineCurve('path-a', point(0, 0), point(2, 0)),
    lineCurve('path-b', point(1, -1), point(1, 1)),
  ])
  const oldCandidate = onlyCandidate(diagram)
  const staleState = pathCrossingStateFromCandidate(oldCandidate, 'braiding')
  const stretched: Diagram = {
    ...diagram,
    strata: diagram.strata.map((stratum) =>
      stratum.id === 'path-a' && stratum.geometricKind === 'curve'
        ? lineCurve('path-a', point(0, 0), point(4, 0))
        : stratum,
    ),
    pathCrossings: [staleState],
  }

  assert.equal(validateDiagram(stretched).valid, false)

  const cleaned = cleanPathCrossingStates(stretched, {
    reconcileStalePathPairs: true,
  })
  const currentCandidate = onlyCandidate(cleaned)

  assert.equal(cleaned.pathCrossings?.length, 1)
  assert.equal(cleaned.pathCrossings?.[0]?.id, currentCandidate.id)
  assert.equal(cleaned.pathCrossings?.[0]?.parameterA, 0.25)
  assert.equal(cleaned.pathCrossings?.[0]?.kind, 'braiding')
  assert.equal(validateDiagram(cleaned).valid, true)
})

test('cleanup removes crossing state with missing referenced path', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const cleaned = cleanPathCrossingStates(
    {
      ...diagram,
      pathCrossings: [
        {
          ...pathCrossingStateFromCandidate(candidate, 'antiBraiding'),
          pathAId: 'missing-path',
        },
      ],
    },
    { reconcileStalePathPairs: true },
  )

  assert.equal(cleaned.pathCrossings, undefined)
})

test('reference-aware crossing filter removes states with missing path A', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const state = pathCrossingStateFromCandidate(candidate, 'braiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves(
    [{ ...state, pathAId: 'missing-path' }],
    diagram,
  )

  assert.deepEqual(filtered, [])
})

test('reference-aware crossing filter removes states with missing path B', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const state = pathCrossingStateFromCandidate(candidate, 'braiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves(
    [{ ...state, pathBId: 'missing-path' }],
    diagram,
  )

  assert.deepEqual(filtered, [])
})

test('reference-aware crossing filter removes states referencing one path twice', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const state = pathCrossingStateFromCandidate(candidate, 'braiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves(
    [{ ...state, pathBId: state.pathAId }],
    diagram,
  )

  assert.deepEqual(filtered, [])
})

test('reference-aware crossing filter removes states referencing a point', () => {
  const pathA = lineCurve('path-a', point(-1, 0), point(1, 0))
  const pointB = createPointStratum({
    ambientDimension: 2,
    id: 'point-b',
    name: 'Point B',
    position: point(0, 0),
  })
  const state = crossingStateForIds('path-a', 'point-b', 'braiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves(
    [state],
    diagramWithStrata([pathA, pointB]),
  )

  assert.deepEqual(filtered, [])
})

test('reference-aware crossing filter removes states referencing a sheet', () => {
  const pathA = lineCurve('path-a', point(-1, 0), point(1, 0))
  const sheetB = createSheetStratum({
    ambientDimension: 3,
    id: 'sheet-b',
    name: 'Sheet B',
    corners: [
      point(-1, -1),
      point(1, -1),
      point(1, 1),
      point(-1, 1),
    ],
  })
  const state = crossingStateForIds('path-a', 'sheet-b', 'braiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves(
    [state],
    diagramWithStrata([pathA, sheetB]),
  )

  assert.deepEqual(filtered, [])
})

test('reference-aware crossing filter removes states referencing a grid', () => {
  const pathA = lineCurve('path-a', point(-1, 0), point(1, 0))
  const gridB = gridCurve('grid-b')
  const state = crossingStateForIds('path-a', 'grid-b', 'braiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves(
    [state],
    diagramWithStrata([pathA, gridB]),
  )

  assert.deepEqual(filtered, [])
})

test('reference-aware crossing filter keeps distinct existing 2D curves', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const state = pathCrossingStateFromCandidate(candidate, 'antiBraiding')
  const filtered = filterPathCrossingStatesForExisting2DCurves([state], diagram)

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.pathAId, state.pathAId)
  assert.equal(filtered[0]?.pathBId, state.pathBId)
  assert.equal(filtered[0]?.kind, 'antiBraiding')
})

test('reference-aware crossing filter removes states from 3D diagrams', () => {
  const state = pathCrossingStateFromCandidate(
    onlyCandidate(crossingDiagram()),
    'braiding',
  )
  const diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    strata: [
      createCurveStratum({
        ambientDimension: 3,
        id: 'path-a',
        name: 'Path A',
        points: [point(-1, 0), point(1, 0)],
      }),
      createCurveStratum({
        ambientDimension: 3,
        id: 'path-b',
        name: 'Path B',
        points: [point(0, -1), point(0, 1)],
      }),
    ],
  }
  const filtered = filterPathCrossingStatesForExisting2DCurves([state], diagram)

  assert.deepEqual(filtered, [])
})

test('cleanup removes crossing states from 3D diagrams', () => {
  const candidate = onlyCandidate(crossingDiagram())
  const diagram: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    pathCrossings: [pathCrossingStateFromCandidate(candidate, 'braiding')],
  }
  const cleaned = cleanPathCrossingStates(diagram, {
    reconcileStalePathPairs: true,
  })

  assert.equal(cleaned.pathCrossings, undefined)
})

test('cleanup preserves reference-valid crossing states when detection is capped', () => {
  const diagram = denseCappedCrossingDiagram('braiding')
  const cappedState = diagram.pathCrossings?.[0]

  if (cappedState === undefined) {
    throw new Error('Expected capped crossing fixture to contain a state.')
  }

  const cleaned = cleanPathCrossingStates({
    ...diagram,
    pathCrossings: [cappedState],
  })
  const loaded = parseSavedDiagramJson(serializeDiagram(cleaned))

  assert.equal(cleaned.pathCrossings?.length, 1)
  assert.equal(cleaned.pathCrossings?.[0]?.id, cappedState.id)
  assert.equal(validateDiagram(cleaned).valid, true)
  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  assert.equal(loaded.diagram.pathCrossings?.[0]?.id, cappedState.id)
})

test('capped cleanup preserves anti-braiding kind for kept states', () => {
  const diagram = denseCappedCrossingDiagram('antiBraiding')
  const cleaned = cleanPathCrossingStates(diagram)

  assert.equal(cleaned.pathCrossings?.length, 1)
  assert.equal(cleaned.pathCrossings?.[0]?.kind, 'antiBraiding')
  assert.equal(validateDiagram(cleaned).valid, true)
})

test('capped cleanup removes stale crossings after deleting path A', () => {
  const diagram = denseCappedCrossingDiagram('braiding')
  const removed = removeSelectedElement(diagram, {
    kind: 'stratum',
    id: 'path-a',
  })

  assert.equal(removed.removed, true)
  assert.equal(removed.diagram.pathCrossings, undefined)
  assertNoPathCrossingReference(removed.diagram, 'path-a')
  assertValidDiagram(removed.diagram)
})

test('capped cleanup removes stale crossings after deleting path B', () => {
  const diagram = denseCappedCrossingDiagram('braiding')
  const removed = removeSelectedElement(diagram, {
    kind: 'stratum',
    id: 'path-b',
  })

  assert.equal(removed.removed, true)
  assert.equal(removed.diagram.pathCrossings, undefined)
  assertNoPathCrossingReference(removed.diagram, 'path-b')
  assertValidDiagram(removed.diagram)
})

test('capped cleanup removes stale crossings after deleting both crossed paths', () => {
  const diagram = denseCappedCrossingDiagram('braiding')
  const cleaned = cleanPathCrossingStates({
    ...diagram,
    strata: diagram.strata.filter(
      (stratum) => stratum.id !== 'path-a' && stratum.id !== 'path-b',
    ),
  })

  assert.equal(cleaned.pathCrossings, undefined)
  assertNoPathCrossingReference(cleaned, 'path-a')
  assertNoPathCrossingReference(cleaned, 'path-b')
  assertValidDiagram(cleaned)
})

test('capped cleanup removes stale crossings after deleting a layer with one crossed path', () => {
  const diagram = denseCappedCrossingDiagram('braiding', {
    pathALayer: 7,
  })
  const deleted = deleteLayer(diagram, 7)

  assert.equal(deleted.pathCrossings, undefined)
  assertNoPathCrossingReference(deleted, 'path-a')
  assertValidDiagram(deleted)
})

test('capped cleanup removes stale crossings after deleting a layer with both crossed paths', () => {
  const diagram = denseCappedCrossingDiagram('braiding', {
    pathALayer: 7,
    pathBLayer: 7,
  })
  const deleted = deleteLayer(diagram, 7)

  assert.equal(deleted.pathCrossings, undefined)
  assertNoPathCrossingReference(deleted, 'path-a')
  assertNoPathCrossingReference(deleted, 'path-b')
  assertValidDiagram(deleted)
})

test('toggling a crossing does not disturb existing selection targets', () => {
  const diagram = crossingDiagram()
  const candidate = onlyCandidate(diagram)
  const selection = { kind: 'stratum' as const, id: 'path-b' }
  const toggled = togglePathCrossingStateForCandidate(diagram, candidate)

  assert.equal(toggled.ok, true)
  if (!toggled.ok) {
    throw new Error(toggled.reason)
  }

  assert.deepEqual(toggled.diagram.strata, diagram.strata)
  assert.deepEqual(toggled.diagram.labels, diagram.labels)
  assert.equal(findSelectedElement(toggled.diagram, selection)?.kind, 'stratum')
})

function crossingDiagram(): Diagram {
  return diagramWithCurves([
    lineCurve('path-a', point(-1, 0), point(1, 0)),
    lineCurve('path-b', point(0, -1), point(0, 1)),
  ])
}

function diagramWithCurves(curves: CurveStratum[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(...curves)

  return diagram
}

function diagramWithStrata(strata: Stratum[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(...strata)

  return diagram
}

function lineCurve(
  id: string,
  start: Vec3,
  end: Vec3,
  arrows?: PathArrowOptions,
): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    name: id,
    points: [start, end],
    ...(arrows === undefined ? {} : { arrows }),
  })
}

function gridCurve(id: string): CurveStratum {
  return createGridStratum({
    ambientDimension: 2,
    id,
    name: id,
    frame: xyGridFrame(),
    uRange: gridRange(-1, 1, 1),
    vRange: gridRange(-1, 1, 1),
    clip: {
      kind: 'rectangle',
      uMin: createNumericScalarInputValue(-1),
      uMax: createNumericScalarInputValue(1),
      vMin: createNumericScalarInputValue(-1),
      vMax: createNumericScalarInputValue(1),
    },
  })
}

function gridRange(
  min: number,
  max: number,
  step: number,
): GridParameterRange {
  return {
    min: createNumericScalarInputValue(min),
    max: createNumericScalarInputValue(max),
    step: createNumericScalarInputValue(step),
  }
}

function denseCappedCrossingDiagram(
  kind: 'braiding' | 'antiBraiding',
  layers: { pathALayer?: number; pathBLayer?: number } = {},
): Diagram {
  const pathA = lineCurve('path-a', point(-1, 0), point(1, 0))
  const pathB = lineCurve('path-b', point(0, -1), point(0, 1))
  const baseDiagram = diagramWithCurves([pathA, pathB])
  const candidate = onlyCandidate(baseDiagram)
  const crossingState = pathCrossingStateFromCandidate(candidate, kind)
  const layeredPathA = { ...pathA, layer: layers.pathALayer ?? pathA.layer }
  const layeredPathB = { ...pathB, layer: layers.pathBLayer ?? pathB.layer }
  const fillers = Array.from({ length: 50 }, (_, index) =>
    lineCurve(
      `filler-${index.toString().padStart(2, '0')}`,
      point(10, index + 10),
      point(11, index + 10),
    ),
  )

  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [layeredPathA, layeredPathB, ...fillers],
    pathCrossings: [crossingState],
  }
}

function crossingStateForIds(
  pathAId: string,
  pathBId: string,
  kind: 'braiding' | 'antiBraiding',
): PathCrossingState {
  return {
    id: `crossing:${pathAId}:${pathBId}:0p500000:0p500000`,
    pathAId,
    pathBId,
    point: point(0, 0),
    parameterA: 0.5,
    parameterB: 0.5,
    kind,
  }
}

function onlyCandidate(diagram: Diagram): PathIntersectionCandidate {
  const candidates = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(candidates.length, 1)

  const candidate = candidates[0]

  if (candidate === undefined) {
    throw new Error('Expected one path intersection candidate.')
  }

  return candidate
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function assertNoPathCrossingReference(diagram: Diagram, pathId: string): void {
  assert.equal(
    diagram.pathCrossings?.some(
      (state) => state.pathAId === pathId || state.pathBId === pathId,
    ) ?? false,
    false,
  )
}

function assertValidDiagram(diagram: Diagram): void {
  const validation = validateDiagram(diagram)

  assert.equal(
    validation.valid,
    true,
    validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n'),
  )
}
