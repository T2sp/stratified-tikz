import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import {
  defaultRegionStyle,
  defaultSheetStyle,
} from '../../src/model/styles.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  ClosedPathBoundary,
  Diagram,
  FillRule,
  FilledRegion2DStratum,
  PolygonSheetStratum,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'

test('valid 2D filled region with one closed boundary validates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'filled-region',
      boundaries: [squareBoundary2D('outer')],
    }),
  )

  assertValid(diagram)
})

test('valid 2D filled region with even-odd nested boundaries validates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'filled-region-with-hole',
      boundaries: [
        squareBoundary2D('outer', 0, 0, 3),
        squareBoundary2D('inner', 1, 1, 1),
      ],
      fillRule: 'evenOdd',
    }),
  )

  assertValid(diagram)
})

test('2D filled region rejects an open boundary', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'open-filled-region',
      boundaries: [openSquareBoundary2D('open')],
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /final endpoint/)
})

test('2D filled region rejects non-finite boundary coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'non-finite-filled-region',
      boundaries: [
        {
          ...squareBoundary2D('outer'),
          segments: [
            {
              kind: 'line',
              start: { x: 0, y: 0, z: 0 },
              end: { x: Number.NaN, y: 0, z: 0 },
            },
          ],
        },
      ],
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /finite number/)
})

test('2D filled region rejects nonzero saved z coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const region: FilledRegion2DStratum = {
    id: 'saved-nonzero-z-region',
    codim: 0,
    geometricKind: 'region',
    kind: 'filledRegion',
    name: 'Saved nonzero z region',
    visible: true,
    style: defaultRegionStyle,
    boundaries: [squareBoundary3D('outer', 1)],
    fillRule: 'nonzero',
    layer: 0,
  }
  diagram.strata.push(region)

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /z = 0/)
})

test('valid 3D work-plane filled sheet with one closed boundary validates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createWorkPlaneFilledSheet3DStratum({
      id: 'filled-sheet',
      planeFrame: xyPlaneFrameAtZ(2),
      boundaries: [squareBoundary3D('outer', 2)],
    }),
  )

  assertValid(diagram)
})

test('valid 3D work-plane filled sheet with even-odd boundaries validates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createWorkPlaneFilledSheet3DStratum({
      id: 'filled-sheet-with-hole',
      planeFrame: xyPlaneFrameAtZ(2),
      boundaries: [
        squareBoundary3D('outer', 2, 0, 0, 3),
        squareBoundary3D('inner', 2, 1, 1, 1),
      ],
      fillRule: 'evenOdd',
    }),
  )

  assertValid(diagram)
})

test('3D work-plane filled sheet rejects a non-planar boundary', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const boundary = squareBoundary3D('non-planar', 2)
  boundary.segments[0] = {
    kind: 'line',
    start: { x: 0, y: 0, z: 2 },
    end: { x: 2, y: 0, z: 2.25 },
  }
  boundary.segments[1] = {
    kind: 'line',
    start: { x: 2, y: 0, z: 2.25 },
    end: { x: 2, y: 2, z: 2 },
  }
  diagram.strata.push(
    createWorkPlaneFilledSheet3DStratum({
      id: 'non-planar-filled-sheet',
      planeFrame: xyPlaneFrameAtZ(2),
      boundaries: [boundary],
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /stored plane/)
})

test('filled stratum rejects an invalid fill rule', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const region = createFilledRegion2DStratum({
    id: 'invalid-fill-rule-region',
    boundaries: [squareBoundary2D('outer')],
  })
  diagram.strata.push({
    ...region,
    fillRule: 'oddEven' as FillRule,
  })

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /Fill rule/)
})

test('filled strata reject an empty boundary list', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createWorkPlaneFilledSheet3DStratum({
      id: 'empty-filled-sheet',
      planeFrame: xyPlaneFrameAtZ(0),
      boundaries: [],
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinValidationMessages(validation.errors), /at least one boundary/)
})

test('filled region save/load round-trips through JSON', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createFilledRegion2DStratum({
      id: 'round-trip-filled-region',
      name: 'Round Trip Filled Region',
      boundaries: [
        squareBoundary2D('outer', 0, 0, 3),
        squareBoundary2D('inner', 1, 1, 1),
      ],
      fillRule: 'evenOdd',
      layer: 4,
    }),
  )

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagram))
})

test('work-plane filled sheet save/load round-trips through JSON', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createWorkPlaneFilledSheet3DStratum({
      id: 'round-trip-filled-sheet',
      name: 'Round Trip Filled Sheet',
      planeFrame: xyPlaneFrameAtZ(5),
      boundaries: [squareBoundary3D('outer', 5)],
      fillRule: 'evenOdd',
      layer: 6,
    }),
  )

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagram))
})

test('existing polygon sheet and concatenated path validation still pass', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const polygonSheet: PolygonSheetStratum = {
    id: 'existing-polygon-sheet',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    name: 'Existing polygon sheet',
    style: defaultSheetStyle,
    vertices: [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 1, z: 1 },
    ],
    layer: 0,
  }

  diagram.strata.push(
    polygonSheet,
    createConcatenatedPathStratum({
      ambientDimension: 3,
      id: 'existing-concatenated-path',
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
      ],
    }),
  )

  assertValid(diagram)
})

function squareBoundary2D(
  id: string,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z: 0 },
    { x: x + size, y, z: 0 },
    { x: x + size, y: y + size, z: 0 },
    { x, y: y + size, z: 0 },
  ])
}

function squareBoundary3D(
  id: string,
  z: number,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z },
    { x: x + size, y, z },
    { x: x + size, y: y + size, z },
    { x, y: y + size, z },
  ])
}

function openSquareBoundary2D(id: string): ClosedPathBoundary {
  return {
    id,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 2, y: 0, z: 0 },
        end: { x: 2, y: 2, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 2, y: 2, z: 0 },
        end: { x: 0, y: 2, z: 0 },
      },
    ],
  }
}

function squareBoundaryFromPoints(
  id: string,
  points: [Vec3, Vec3, Vec3, Vec3],
): ClosedPathBoundary {
  return {
    id,
    segments: [
      { kind: 'line', start: points[0], end: points[1] },
      { kind: 'line', start: points[1], end: points[2] },
      { kind: 'line', start: points[2], end: points[3] },
      { kind: 'line', start: points[3], end: points[0] },
    ],
  }
}

function xyPlaneFrameAtZ(z: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y: 0, z },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function assertValid(diagram: Diagram): void {
  const validation = validateDiagram(diagram)

  assert.equal(
    validation.valid,
    true,
    joinValidationMessages(validation.errors),
  )
}

function joinValidationMessages(
  errors: ReturnType<typeof validateDiagram>['errors'],
): string {
  return errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}
