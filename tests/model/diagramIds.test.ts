import assert from 'node:assert/strict'
import test from 'node:test'
import { detachCoonsPatchBoundaryLinks } from '../../src/model/coonsPatchLinks.ts'
import { collectTopLevelDiagramIds } from '../../src/model/diagramIds.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  createEmptyDiagram,
  createCurvedSheetStratum,
  createPointStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import type {
  CoordinateAnchorPosition,
  CoordinateComponent,
  Diagram,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'

test('collectTopLevelDiagramIds includes validation-level diagram ids', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata = [
    createPointStratum({
      ambientDimension: 2,
      id: 'point-id',
      position: { x: 0, y: 0, z: 0 },
    }),
  ]
  diagram.labels = [
    createTextLabel({
      ambientDimension: 2,
      id: 'label-id',
      text: '$F$',
      position: { x: 1, y: 0, z: 0 },
    }),
  ]
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coordinate-id',
      name: 'Coordinate',
      position: globalAnchorPositionForIdTest(2, 0, 0),
    }),
  ]
  diagram.variables = [
    {
      id: 'variable-id',
      name: 'a',
      macroName: '\\a',
      expression: '1',
      previewValue: 1,
    },
  ]
  diagram.pathCrossings = [
    {
      id: 'crossing-id',
      pathAId: 'path-a',
      pathBId: 'path-b',
      point: { x: 0, y: 0, z: 0 },
      parameterA: 0,
      parameterB: 0,
      kind: 'none',
    },
  ]

  assert.deepEqual([...collectTopLevelDiagramIds(diagram)].sort(), [
    'coordinate-id',
    'crossing-id',
    'label-id',
    'point-id',
    'variable-id',
  ])
})

test('collectTopLevelDiagramIds handles diagrams with no coordinateAnchors field', () => {
  const base = createEmptyDiagram({ ambientDimension: 2 })
  const diagram: Diagram = {
    version: base.version,
    ambientDimension: base.ambientDimension,
    camera: base.camera,
    strata: [],
    labels: [],
  }

  assert.deepEqual([...collectTopLevelDiagramIds(diagram)], [])
})

test('collectTopLevelDiagramIds reserves dangling linked Coons path and point ids', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata = [
    createCurvedSheetStratum({
      id: 'linked-patch',
      primitive: {
        kind: 'coonsPatch',
        bottom: constantBoundary(),
        right: constantBoundary(),
        top: constantBoundary(),
        left: constantBoundary(),
        boundarySources: {
          bottom: {
            kind: 'path',
            sourcePathId: 'dangling-path-bottom',
            reversed: false,
          },
          right: {
            kind: 'point',
            sourcePointId: 'dangling-point-right',
          },
          top: {
            kind: 'path',
            sourcePathId: 'dangling-path-top',
            reversed: true,
          },
          left: {
            kind: 'point',
            sourcePointId: 'dangling-point-left',
          },
        },
        sampling: { uSegments: 2, vSegments: 2 },
      },
    }),
  ]

  assert.deepEqual([...collectTopLevelDiagramIds(diagram)].sort(), [
    'dangling-path-bottom',
    'dangling-path-top',
    'dangling-point-left',
    'dangling-point-right',
    'linked-patch',
  ])

  const detached = detachCoonsPatchBoundaryLinks(diagram, 'linked-patch')

  assert.deepEqual([...collectTopLevelDiagramIds(detached)], ['linked-patch'])
})

test('collectTopLevelDiagramIds ignores malformed linked Coons metadata', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const patch = createCurvedSheetStratum({
    id: 'malformed-patch',
    primitive: {
      kind: 'coonsPatch',
      bottom: constantBoundary(),
      right: constantBoundary(),
      top: constantBoundary(),
      left: constantBoundary(),
      sampling: { uSegments: 2, vSegments: 2 },
    },
  })

  ;(
    patch.primitive as unknown as { boundarySources: unknown }
  ).boundarySources = {
    bottom: { kind: 'path', sourcePathId: '', reversed: false },
  }
  diagram.strata = [patch]

  assert.doesNotThrow(() => collectTopLevelDiagramIds(diagram))
  assert.deepEqual([...collectTopLevelDiagramIds(diagram)], ['malformed-patch'])
})

test('validateDiagram rejects coordinate anchor ids duplicated by strata and labels', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata = [
    createPointStratum({
      ambientDimension: 2,
      id: 'shared-point-id',
      position: { x: 0, y: 0, z: 0 },
    }),
  ]
  diagram.labels = [
    createTextLabel({
      ambientDimension: 2,
      id: 'shared-label-id',
      text: '$L$',
      position: { x: 1, y: 0, z: 0 },
    }),
  ]
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'shared-point-id',
      name: 'Point duplicate',
      position: globalAnchorPositionForIdTest(2, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'shared-label-id',
      name: 'Label duplicate',
      position: globalAnchorPositionForIdTest(3, 0, 0),
    }),
  ]

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.equal(
    validation.errors.some(
      (issue) =>
        issue.path === 'coordinateAnchors[0].id' &&
        /strata\[0\]\.id/.test(issue.message),
    ),
    true,
  )
  assert.equal(
    validation.errors.some(
      (issue) =>
        issue.path === 'coordinateAnchors[1].id' &&
        /labels\[0\]\.id/.test(issue.message),
    ),
    true,
  )
})

function globalAnchorPositionForIdTest(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  const component = (value: number): CoordinateComponent => ({
    kind: 'numeric',
    value,
  })

  return {
    kind: 'global',
    value: {
      x: component(x),
      y: component(y),
      z: component(z),
    },
  }
}

function constantBoundary() {
  return {
    kind: 'constantPoint' as const,
    point: { x: 0, y: 0, z: 0 },
  }
}
