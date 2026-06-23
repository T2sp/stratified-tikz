import assert from 'node:assert/strict'
import test from 'node:test'
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import {
  createCurveStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import {
  cleanPathCrossingStates,
  pathCrossingStateFromCandidate,
  pathCrossingKindForCandidate,
  togglePathCrossingStateForCandidate,
} from '../../src/model/pathCrossings.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { findSelectedElement } from '../../src/ui/selection.ts'
import type {
  CurveStratum,
  Diagram,
  PathArrowOptions,
  PathIntersectionCandidate,
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

test('cleanup preserves structurally valid crossing states when detection is capped', () => {
  const curves = Array.from({ length: 50 }, (_, index) =>
    lineCurve(
      `path-${index.toString().padStart(2, '0')}`,
      point(-1, index),
      point(1, index),
    ),
  )
  const diagram = diagramWithCurves(curves)
  const cappedState = {
    id: 'crossing:path-48:path-49:0p500000:0p500000',
    pathAId: 'path-48',
    pathBId: 'path-49',
    point: point(0, 48.5),
    parameterA: 0.5,
    parameterB: 0.5,
    kind: 'braiding' as const,
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
