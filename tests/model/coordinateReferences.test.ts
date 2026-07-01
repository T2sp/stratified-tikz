import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
  detachCoordinateAnchorReferences,
  detachCoordinateAnchorReferencesMany,
  findCoordinateAnchorReferences,
} from '../../src/model/coordinateReferences.ts'
import {
  defaultCurveStyle,
  defaultLabelStyle,
  defaultPointStyle,
  defaultRegionStyle,
  defaultSheetStyle,
} from '../../src/model/styles.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  ClosedPathBoundary,
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  Diagram,
  GridStratum,
  PathSegment,
  Stratum,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'

test('findCoordinateAnchorReferences inventories coordinate-ref-enabled fields', () => {
  const diagram = createInventoryDiagram()
  const references = findCoordinateAnchorReferences(diagram, 'coord-a')
  const byPath = new Map(references.map((reference) => [reference.path, reference]))

  assert.equal(references.length, 17)
  assert.equal(byPath.get('strata[0].segments[0].start')?.location, 'pathCoordinate')
  assert.equal(
    byPath.get('strata[0].segments[0].controlMode.frame.origin')?.location,
    'workPlaneFrameField',
  )
  assert.equal(byPath.get('strata[0].segments[1].center')?.location, 'arcCenter')
  assert.equal(
    byPath.get('strata[1].template.center')?.location,
    'pathTemplateCenter',
  )
  assert.equal(
    byPath.get('strata[2].vertices[0]')?.location,
    'simpleSheetVertex',
  )
  assert.equal(
    byPath.get('strata[3].boundaries[0].segments[0].start')?.location,
    'pathCoordinate',
  )
  assert.equal(
    byPath.get('strata[4].frame.frame.origin')?.location,
    'workPlaneFrameField',
  )
  assert.equal(byPath.get('strata[5].position')?.location, 'pointPosition')
  assert.equal(
    byPath.get('strata[6].primitive.bottom.segments[0].start')?.location,
    'curvedSheetPrimitive',
  )
  assert.equal(
    byPath.get('strata[6].primitive.right.point')?.location,
    'curvedSheetPrimitive',
  )
  assert.equal(byPath.get('labels[0].position')?.location, 'labelPosition')
  assert.equal(byPath.get('strata[2].vertices[0]')?.exportPreserved, true)
  assert.equal(byPath.get('strata[1].template.center')?.exportPreserved, false)
  assert.equal(byPath.get('strata[4].frame.frame.origin')?.exportPreserved, false)
})

test('findCoordinateAnchorReferences inventories work-plane-local source frame references', () => {
  const diagram = createNestedWorkPlaneLocalFrameReferenceDiagram()
  const originalJson = JSON.stringify(diagram)
  const references = findCoordinateAnchorReferences(diagram, 'coord-a')
  const byPath = new Map(references.map((reference) => [reference.path, reference]))

  assert.equal(references.length, 4)
  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-b').length, 0)
  assert.equal(
    byPath.get(
      'labels[0].position.symbolic.source.frame.origin',
    )?.location,
    'workPlaneFrameField',
  )
  assert.equal(
    byPath.get('labels[0].position.symbolic.source.frame.u')?.location,
    'workPlaneFrameField',
  )
  assert.equal(
    byPath.get('labels[0].position.symbolic.source.frame.v')?.location,
    'workPlaneFrameField',
  )
  assert.equal(
    byPath.get('labels[0].position.symbolic.source.frame.normal')?.location,
    'workPlaneFrameField',
  )
  assert.equal(
    byPath.get('labels[0].position.symbolic.source.frame.origin')?.exportPreserved,
    false,
  )
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferences detaches global numeric references', () => {
  const diagram = createReferencedPolylineDiagram(globalAnchorPosition(1, 2, 0))
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const curve = firstPolyline(result.value.diagram)
  const point = curve.points[0]

  assert.equal(result.value.detachedCount, 1)
  assert.equal(coordinateReferenceSourceForPoint(point), null)
  assert.deepEqual(pointPreview(point), { x: 1, y: 2, z: 0 })
  assert.equal(findCoordinateAnchorReferences(result.value.diagram, 'coord-a').length, 0)
  assert.equal(JSON.stringify(result.value.diagram).includes('"coordinateId":"coord-a"'), false)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferences detaches work-plane-local source frame references', () => {
  for (const field of workPlaneFrameFieldNames) {
    const diagram = createNestedWorkPlaneLocalFrameDetachDiagram(field)
    const originalJson = JSON.stringify(diagram)
    const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

    assert.equal(result.ok, true)
    if (!result.ok) {
      throw new Error(result.error.message)
    }

    const position = requiredPoint(result.value.diagram.labels[0]?.position)
    const source = position.symbolic?.source

    assert.equal(result.value.detachedCount, 1)
    assert.equal(source?.kind, 'workPlaneLocal')
    if (source?.kind !== 'workPlaneLocal') {
      throw new Error('Expected work-plane-local source.')
    }
    assert.deepEqual(source.frame[field], frameFieldReplacement(field))
    assert.equal(coordinateReferenceSourceForPoint(source.frame[field]), null)
    assert.deepEqual(source.local.a, { kind: 'numeric', value: 2 })
    assert.deepEqual(source.local.b, { kind: 'numeric', value: 3 })
    assert.deepEqual(pointPreview(position), workPlaneLocalPreview(source.frame, 2, 3))
    assert.deepEqual(position.symbolic?.x, numericComponent(position.x))
    assert.deepEqual(position.symbolic?.y, numericComponent(position.y))
    assert.deepEqual(position.symbolic?.z, numericComponent(position.z))
    assert.equal(findCoordinateAnchorReferences(result.value.diagram, 'coord-a').length, 0)
    assert.equal(JSON.stringify(result.value.diagram).includes('"coordinateId":"coord-a"'), false)
    assertDiagramValid(result.value.diagram)
    assert.equal(JSON.stringify(diagram), originalJson)
  }
})

test('detachCoordinateAnchorReferences recomputes nested work-plane-local preview from moved anchor', () => {
  const diagram = createMovedNestedWorkPlaneLocalFrameReferenceDiagram()
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const position = requiredPoint(result.value.diagram.labels[0]?.position)
  const source = position.symbolic?.source

  assert.equal(result.value.detachedCount, 1)
  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local source.')
  }
  assert.deepEqual(source.frame.origin, { x: 5, y: 5, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(source.frame.origin), null)
  assert.deepEqual(source.local.a, { kind: 'numeric', value: 2 })
  assert.deepEqual(source.local.b, { kind: 'numeric', value: 3 })
  assert.deepEqual(pointPreview(position), { x: 7, y: 8, z: 0 })
  assert.deepEqual(position.symbolic?.x, numericComponent(7))
  assert.deepEqual(position.symbolic?.y, numericComponent(8))
  assert.deepEqual(position.symbolic?.z, numericComponent(0))
  assert.deepEqual(pointPreview(position), workPlaneLocalPreview(source.frame, 2, 3))
  assert.equal(JSON.stringify(result.value.diagram).includes('"x":3'), false)
  assert.equal(JSON.stringify(result.value.diagram).includes('"y":4'), false)
  assert.equal(findCoordinateAnchorReferences(result.value.diagram, 'coord-a').length, 0)
  assertDiagramValid(result.value.diagram)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferences recomputes work-plane-local anchor preview from moved nested frame ref', () => {
  const diagram = createMovedNestedWorkPlaneLocalAnchorPositionDiagram()
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const anchor = requiredAnchor(result.value.diagram, 'coord-local')

  assert.equal(result.value.detachedCount, 1)
  assert.equal(anchor.position.kind, 'workPlaneLocal')
  if (anchor.position.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local coordinate anchor position.')
  }
  assert.deepEqual(anchor.position.frame.origin, { x: 5, y: 5, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(anchor.position.frame.origin), null)
  assert.deepEqual(anchor.position.local.a, { kind: 'numeric', value: 2 })
  assert.deepEqual(anchor.position.local.b, { kind: 'numeric', value: 3 })
  assert.deepEqual(pointPreview(anchor.position.preview), { x: 7, y: 8, z: 0 })
  assert.deepEqual(
    pointPreview(anchor.position.preview),
    workPlaneLocalPreview(anchor.position.frame, 2, 3),
  )
  assert.equal(findCoordinateAnchorReferences(result.value.diagram, 'coord-a').length, 0)
  assertDiagramValid(result.value.diagram)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferences preserves global symbolic coordinates', () => {
  const symbolicX: CoordinateComponent = {
    kind: 'symbolic',
    expression: 'R + 1',
    previewValue: 4,
  }
  const diagram = createReferencedLabelDiagram(
    globalAnchorPositionFromComponents(
      symbolicX,
      numericComponent(2),
      numericComponent(0),
    ),
    2,
  )
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const position = result.value.diagram.labels[0]?.position

  assert.notEqual(position, undefined)
  assert.equal(position?.symbolic?.source, undefined)
  assert.deepEqual(position?.symbolic?.x, symbolicX)
  assert.deepEqual(pointPreview(requiredPoint(position)), { x: 4, y: 2, z: 0 })
})

test('detachCoordinateAnchorReferences preserves work-plane-local coordinate sources', () => {
  const diagram = createReferencedLabelDiagram(workPlaneLocalAnchorPosition(), 3)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const position = requiredPoint(result.value.diagram.labels[0]?.position)
  const source = position.symbolic?.source

  assert.equal(result.value.detachedCount, 1)
  assert.equal(source?.kind, 'workPlaneLocal')
  assert.deepEqual(pointPreview(position), { x: 14, y: 20, z: 32 })
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local source.')
  }
  assert.deepEqual(source.local.a, {
    kind: 'symbolic',
    expression: 'L',
    previewValue: 4,
  })
  assert.deepEqual(source.local.b, { kind: 'numeric', value: 2 })
})

test('detachCoordinateAnchorReferences sanitizes self-referential replacement work-plane-local sources', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sourceFrame = frame(coordinateReferencePoint('coord-a', 10, 20, 30))

  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: workPlaneLocalAnchorPositionWithFrame(sourceFrame, 2, 3),
  })
  const originalPreview = pointPreview(requiredPoint(reference(diagram, 'coord-a')))
  diagram.labels.push({
    geometricKind: 'label',
    id: 'self-replacement-label',
    name: 'Self replacement label',
    text: '$A$',
    position: reference(diagram, 'coord-a'),
    style: { ...defaultLabelStyle },
    layer: 0,
  })
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const position = requiredPoint(result.value.diagram.labels[0]?.position)

  assert.equal(result.value.detachedCount, 3)
  assert.equal(position.symbolic, undefined)
  assert.deepEqual(pointPreview(position), originalPreview)
  assertNoReferences(result.value.diagram, ['coord-a'])
  assert.equal(JSON.stringify(result.value.diagram).includes('"coordinateId":"coord-a"'), false)
  assertDiagramValid(result.value.diagram)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferencesMany sanitizes batch replacement work-plane-local frame refs', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  addAnchor(diagram, {
    id: 'coord-b',
    name: 'B',
    tikzName: 'B',
    position: globalAnchorPosition(5, 5, 0),
  })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: workPlaneLocalAnchorPositionWithFrame(
      frame(reference(diagram, 'coord-b')),
      2,
      3,
    ),
  })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'batch-replacement-label',
    name: 'Batch replacement label',
    text: '$A$',
    position: reference(diagram, 'coord-a'),
    style: { ...defaultLabelStyle },
    layer: 0,
  })
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferencesMany(diagram, [
    'coord-a',
    'coord-b',
  ])

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const position = requiredPoint(result.value.diagram.labels[0]?.position)
  const source = position.symbolic?.source

  assert.equal(result.value.detachedCount, 3)
  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected a work-plane-local source.')
  }
  assert.deepEqual(source.frame.origin, { x: 5, y: 5, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(source.frame.origin), null)
  assert.deepEqual(pointPreview(position), { x: 7, y: 8, z: 0 })
  assertNoReferences(result.value.diagram, ['coord-a', 'coord-b'])
  assertDiagramValid(result.value.diagram)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferences fails atomically when replacement source frame ref is missing', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: workPlaneLocalAnchorPositionWithFrame(
      frame(coordinateReferencePoint('coord-missing', 1, 1, 0)),
      2,
      3,
    ),
  })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'missing-replacement-label',
    name: 'Missing replacement label',
    text: '$A$',
    position: reference(diagram, 'coord-a'),
    style: { ...defaultLabelStyle },
    layer: 0,
  })
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected detach to fail.')
  }
  assert.match(result.error.message, /does not exist/)
  assert.equal(JSON.stringify(diagram), originalJson)
  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-a').length, 1)
})

test('detachCoordinateAnchorReferences falls back for frame fields', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: workPlaneLocalAnchorPosition(),
  })
  diagram.strata.push(gridStratum(reference(diagram, 'coord-a')))

  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const grid = result.value.diagram.strata[0]

  assert.equal(result.value.detachedCount, 1)
  assert.equal(grid?.kind, 'grid')
  if (grid?.kind !== 'grid') {
    throw new Error('Expected a grid stratum.')
  }
  assert.equal(grid.frame.frame.origin.symbolic, undefined)
  assert.deepEqual(grid.frame.frame.origin, { x: 14, y: 20, z: 32 })
})

test('detachCoordinateAnchorReferences leaves no dangling refs and does not mutate source anchors', () => {
  const diagram = createReferencedPolylineDiagram(globalAnchorPosition(3, 4, 0))
  const sourceAnchorBefore = JSON.stringify(diagram.coordinateAnchors?.[0])
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  assert.equal(JSON.stringify(diagram.coordinateAnchors?.[0]), sourceAnchorBefore)
  assert.equal(
    JSON.stringify(
      result.value.diagram.coordinateAnchors?.find((anchor) => anchor.id === 'coord-a'),
    ),
    sourceAnchorBefore,
  )
  assert.equal(findCoordinateAnchorReferences(result.value.diagram, 'coord-a').length, 0)
  assert.equal(JSON.stringify(result.value.diagram).includes('"coordinateId":"coord-a"'), false)
})

test('detachCoordinateAnchorReferences fails atomically when fallback is unavailable', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.coordinateAnchors = [
    {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalAnchorPosition(Number.NaN, 0, 0),
    },
  ]
  diagram.strata.push(gridStratum(coordinateReferencePoint('coord-a', 0, 0, 0)))
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferences(diagram, 'coord-a')

  assert.equal(result.ok, false)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('detachCoordinateAnchorReferences fails atomically for nested source frame refs', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalAnchorPosition(Number.NaN, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-b',
      name: 'B',
      tikzName: 'B',
      position: globalAnchorPosition(1, 0, 0),
    }),
  ]
  diagram.strata.push({
    codim: 3,
    geometricKind: 'point',
    id: 'direct-ref-point',
    name: 'Direct reference point',
    style: { ...defaultPointStyle },
    position: reference(diagram, 'coord-b'),
    layer: 0,
  })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'nested-ref-label',
    name: 'Nested reference label',
    text: '$p$',
    position: workPlaneLocalPoint(
      frame(coordinateReferencePoint('coord-a', 0, 0, 0)),
    ),
    style: { ...defaultLabelStyle },
    layer: 0,
  })
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferencesMany(
    diagram,
    ['coord-b', 'coord-a'],
  )
  const firstStratum = diagram.strata[0]

  assert.equal(result.ok, false)
  assert.equal(JSON.stringify(diagram), originalJson)
  assert.equal(firstStratum?.geometricKind, 'point')
  if (firstStratum?.geometricKind !== 'point') {
    throw new Error('Expected a point stratum.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(firstStratum.position)?.coordinateId,
    'coord-b',
  )
  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-b').length, 1)
  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-a').length, 1)
})

test('detachCoordinateAnchorReferences fails atomically when nested frame recomputation fails', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalAnchorPosition(2, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-b',
      name: 'B',
      tikzName: 'B',
      position: globalAnchorPosition(1, 0, 0),
    }),
  ]
  diagram.strata.push({
    codim: 3,
    geometricKind: 'point',
    id: 'direct-ref-point',
    name: 'Direct reference point',
    style: { ...defaultPointStyle },
    position: reference(diagram, 'coord-b'),
    layer: 0,
  })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'invalid-nested-frame-label',
    name: 'Invalid nested frame label',
    text: '$p$',
    position: workPlaneLocalPoint(
      frameWithField('u', reference(diagram, 'coord-a')),
    ),
    style: { ...defaultLabelStyle },
    layer: 0,
  })
  const originalJson = JSON.stringify(diagram)
  const result = detachCoordinateAnchorReferencesMany(
    diagram,
    ['coord-b', 'coord-a'],
  )
  const firstStratum = diagram.strata[0]

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected detach to fail.')
  }
  assert.match(result.error.message, /failed to recompute work-plane-local preview/)
  assert.equal(JSON.stringify(diagram), originalJson)
  assert.equal(firstStratum?.geometricKind, 'point')
  if (firstStratum?.geometricKind !== 'point') {
    throw new Error('Expected a point stratum.')
  }
  assert.equal(
    coordinateReferenceSourceForPoint(firstStratum.position)?.coordinateId,
    'coord-b',
  )
  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-b').length, 1)
  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-a').length, 1)
})

test('reference inventory does not change existing coordinate-ref export', () => {
  const diagram = createReferencedPolylineDiagram(globalAnchorPosition(0, 0, 0))
  addAnchor(diagram, {
    id: 'coord-b',
    name: 'B',
    tikzName: 'B',
    position: globalAnchorPosition(2, 1, 0),
  })
  const curve = firstPolyline(diagram)
  curve.points[1] = reference(diagram, 'coord-b')
  const before = generateTikz(diagram)

  assert.equal(findCoordinateAnchorReferences(diagram, 'coord-a').length, 1)
  assert.equal(generateTikz(diagram), before)
  assert.match(before, /\\coordinate \(A\) at \(0,0\);/)
  assert.match(before, /\(A\) -- \(B\);/)
})

const workPlaneFrameFieldNames = ['origin', 'u', 'v', 'normal'] as const

function createInventoryDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(1, 2, 3),
  })

  diagram.strata.push(
    concatenatedPathStratum(diagram),
    templatePathStratum(diagram),
    polygonSheetStratum(diagram),
    workPlaneFilledSheetStratum(diagram),
    gridStratum(reference(diagram, 'coord-a')),
    pointStratum(diagram),
    coonsPatchStratum(diagram),
    filledRegionStratum(diagram),
  )
  diagram.labels.push({
    geometricKind: 'label',
    id: 'label-ref',
    name: 'Reference label',
    text: '$A$',
    position: reference(diagram, 'coord-a'),
    style: { ...defaultLabelStyle },
    layer: 0,
  })

  return diagram
}

function createNestedWorkPlaneLocalFrameReferenceDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(1, 2, 3),
  })

  diagram.labels.push({
    geometricKind: 'label',
    id: 'nested-frame-label',
    name: 'Nested frame label',
    text: '$p$',
    position: workPlaneLocalPoint({
      origin: reference(diagram, 'coord-a'),
      u: reference(diagram, 'coord-a'),
      v: reference(diagram, 'coord-a'),
      normal: reference(diagram, 'coord-a'),
    }),
    style: { ...defaultLabelStyle },
    layer: 0,
  })

  return diagram
}

function createNestedWorkPlaneLocalFrameDetachDiagram(
  field: (typeof workPlaneFrameFieldNames)[number],
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPositionForFrameField(field),
  })
  const sourceFrame = frameWithField(field, reference(diagram, 'coord-a'))

  diagram.labels.push({
    geometricKind: 'label',
    id: `nested-frame-${field}-label`,
    name: `Nested frame ${field} label`,
    text: '$p$',
    position: workPlaneLocalPoint(sourceFrame),
    style: { ...defaultLabelStyle },
    layer: 0,
  })

  return diagram
}

function createMovedNestedWorkPlaneLocalFrameReferenceDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(1, 1, 0),
  })
  const origin = reference(diagram, 'coord-a')

  moveAnchor(diagram, 'coord-a', globalAnchorPosition(5, 5, 0))
  diagram.labels.push({
    geometricKind: 'label',
    id: 'moved-nested-frame-label',
    name: 'Moved nested frame label',
    text: '$p$',
    position: workPlaneLocalPoint(frame(origin)),
    style: { ...defaultLabelStyle },
    layer: 0,
  })

  return diagram
}

function createMovedNestedWorkPlaneLocalAnchorPositionDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position: globalAnchorPosition(1, 1, 0),
  })
  const origin = reference(diagram, 'coord-a')

  addAnchor(diagram, {
    id: 'coord-local',
    name: 'Local',
    tikzName: 'Local',
    position: workPlaneLocalAnchorPositionWithFrame(frame(origin), 2, 3),
  })
  moveAnchor(diagram, 'coord-a', globalAnchorPosition(5, 5, 0))

  return diagram
}

function createReferencedPolylineDiagram(position: CoordinateAnchorPosition): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position,
  })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'ref-path',
    name: 'Reference path',
    style: { ...defaultCurveStyle },
    styleSegments: [],
    points: [reference(diagram, 'coord-a'), { x: 1, y: 0, z: 0 }],
    layer: 0,
  })

  return diagram
}

function createReferencedLabelDiagram(
  position: CoordinateAnchorPosition,
  ambientDimension: 2 | 3,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension })
  addAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    tikzName: 'A',
    position,
  })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'label-ref',
    name: 'Reference label',
    text: '$A$',
    position: reference(diagram, 'coord-a'),
    style: { ...defaultLabelStyle },
    layer: 0,
  })

  return diagram
}

function concatenatedPathStratum(diagram: Diagram): Stratum {
  return {
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'path-ref',
    name: 'Reference path',
    style: { ...defaultCurveStyle },
    styleSegments: [],
    segments: [
      {
        kind: 'cubicBezier',
        start: reference(diagram, 'coord-a'),
        control1: reference(diagram, 'coord-a'),
        control2: { x: 1, y: 1, z: 0 },
        end: reference(diagram, 'coord-a'),
        controlMode: {
          kind: 'workPlaneRelativeCartesian',
          frame: frame(reference(diagram, 'coord-a')),
          localStart: { a: 0, b: 0 },
          localEnd: { a: 1, b: 0 },
          firstControlOffset: { dx: 0.25, dy: 0 },
          secondControlOffset: { dx: -0.25, dy: 0 },
          secondOffsetReference: 'end',
        },
      },
      {
        kind: 'arc',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 1, z: 0 },
        center: reference(diagram, 'coord-a'),
        radius: 1,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
        frame: frame(reference(diagram, 'coord-a')),
      },
    ],
    layer: 0,
  }
}

function templatePathStratum(diagram: Diagram): Stratum {
  return {
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'template-ref',
    name: 'Template reference',
    style: { ...defaultCurveStyle },
    styleSegments: [],
    template: {
      kind: 'circleTemplate',
      center: reference(diagram, 'coord-a'),
      radius: 1,
      frame: frame(reference(diagram, 'coord-a')),
    },
    layer: 0,
  }
}

function polygonSheetStratum(diagram: Diagram): Stratum {
  return {
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id: 'sheet-ref',
    name: 'Sheet reference',
    style: { ...defaultSheetStyle },
    vertices: [
      reference(diagram, 'coord-a'),
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
    layer: 0,
  }
}

function workPlaneFilledSheetStratum(diagram: Diagram): Stratum {
  return {
    codim: 1,
    geometricKind: 'sheet',
    kind: 'workPlaneFilledSheet',
    id: 'filled-sheet-ref',
    name: 'Filled sheet reference',
    style: { ...defaultSheetStyle },
    planeFrame: frame(reference(diagram, 'coord-a')),
    boundaries: [lineBoundary(reference(diagram, 'coord-a'))],
    fillRule: 'nonzero',
    layer: 0,
  }
}

function gridStratum(origin: Vec3): GridStratum {
  return {
    codim: 2,
    geometricKind: 'curve',
    kind: 'grid',
    id: 'grid-ref',
    name: 'Grid reference',
    style: { ...defaultCurveStyle },
    styleSegments: [],
    frame: {
      kind: 'workPlane',
      frame: frame(origin),
    },
    uRange: range(),
    vRange: range(),
    clip: {
      kind: 'rectangle',
      uMin: { kind: 'numeric', value: -1 },
      uMax: { kind: 'numeric', value: 1 },
      vMin: { kind: 'numeric', value: -1 },
      vMax: { kind: 'numeric', value: 1 },
    },
    layer: 0,
  }
}

function pointStratum(diagram: Diagram): Stratum {
  return {
    codim: 3,
    geometricKind: 'point',
    id: 'point-ref',
    name: 'Point reference',
    style: { ...defaultPointStyle },
    position: reference(diagram, 'coord-a'),
    layer: 0,
  }
}

function coonsPatchStratum(diagram: Diagram): Stratum {
  return {
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    id: 'coons-ref',
    name: 'Coons reference',
    style: { ...defaultSheetStyle },
    primitive: {
      kind: 'coonsPatch',
      bottom: {
        segments: [lineSegment(reference(diagram, 'coord-a'))],
      },
      right: {
        kind: 'constantPoint',
        point: reference(diagram, 'coord-a'),
      },
      top: {
        segments: [lineSegment({ x: 1, y: 1, z: 0 })],
      },
      left: {
        segments: [lineSegment({ x: 0, y: 1, z: 0 })],
      },
      sampling: { uSegments: 2, vSegments: 2 },
    },
    layer: 0,
  }
}

function filledRegionStratum(diagram: Diagram): Stratum {
  return {
    codim: 0,
    geometricKind: 'region',
    kind: 'filledRegion',
    id: 'filled-region-ref',
    name: 'Filled region reference',
    visible: true,
    style: { ...defaultRegionStyle },
    boundaries: [lineBoundary(reference(diagram, 'coord-a'))],
    fillRule: 'nonzero',
    layer: 0,
  }
}

function lineBoundary(start: Vec3): ClosedPathBoundary {
  return {
    id: 'boundary',
    segments: [lineSegment(start)],
  }
}

function lineSegment(start: Vec3): PathSegment {
  return {
    kind: 'line',
    start,
    end: { x: start.x + 1, y: start.y, z: start.z },
  }
}

function range() {
  return {
    min: { kind: 'numeric' as const, value: -1 },
    max: { kind: 'numeric' as const, value: 1 },
    step: { kind: 'numeric' as const, value: 1 },
  }
}

function frame(origin: Vec3 = { x: 0, y: 0, z: 0 }): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function frameWithField(
  field: (typeof workPlaneFrameFieldNames)[number],
  point: Vec3,
): WorkPlaneFrameSnapshot {
  const sourceFrame = frame()
  sourceFrame[field] = point

  return sourceFrame
}

function globalAnchorPositionForFrameField(
  field: (typeof workPlaneFrameFieldNames)[number],
): CoordinateAnchorPosition {
  const replacement = frameFieldReplacement(field)

  return globalAnchorPosition(replacement.x, replacement.y, replacement.z)
}

function frameFieldReplacement(
  field: (typeof workPlaneFrameFieldNames)[number],
): Vec3 {
  switch (field) {
    case 'origin':
      return { x: 5, y: 5, z: 0 }
    case 'u':
      return { x: 1, y: 0, z: 0 }
    case 'v':
      return { x: 0, y: 1, z: 0 }
    case 'normal':
      return { x: 0, y: 0, z: 1 }
  }
}

function workPlaneLocalPoint(
  sourceFrame: WorkPlaneFrameSnapshot,
  a = 2,
  b = 3,
): Vec3 {
  const preview = workPlaneLocalPreview(sourceFrame, a, b)

  return {
    ...preview,
    symbolic: {
      x: numericComponent(preview.x),
      y: numericComponent(preview.y),
      z: numericComponent(preview.z),
      source: {
        kind: 'workPlaneLocal',
        frame: sourceFrame,
        local: {
          a: { kind: 'numeric', value: a },
          b: { kind: 'numeric', value: b },
        },
      },
    },
  }
}

function workPlaneLocalPreview(
  sourceFrame: WorkPlaneFrameSnapshot,
  a: number,
  b: number,
): Vec3 {
  return {
    x: sourceFrame.origin.x + a * sourceFrame.u.x + b * sourceFrame.v.x,
    y: sourceFrame.origin.y + a * sourceFrame.u.y + b * sourceFrame.v.y,
    z: sourceFrame.origin.z + a * sourceFrame.u.z + b * sourceFrame.v.z,
  }
}

function addAnchor(
  diagram: Diagram,
  input: {
    id: string
    name: string
    tikzName: string
    position: CoordinateAnchorPosition
  },
): CoordinateAnchor {
  const anchor = createCoordinateAnchor(diagram, input)
  diagram.coordinateAnchors = [...(diagram.coordinateAnchors ?? []), anchor]

  return anchor
}

function moveAnchor(
  diagram: Diagram,
  coordinateId: string,
  position: CoordinateAnchorPosition,
): void {
  diagram.coordinateAnchors = (diagram.coordinateAnchors ?? []).map((anchor) =>
    anchor.id === coordinateId
      ? {
          ...anchor,
          position,
        }
      : anchor,
  )
}

function reference(diagram: Diagram, coordinateId: string): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate reference ${coordinateId}.`)
  }

  return point
}

function coordinateReferencePoint(
  coordinateId: string,
  x: number,
  y: number,
  z: number,
): Vec3 {
  return {
    x,
    y,
    z,
    symbolic: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
      source: {
        kind: 'coordinateRef',
        coordinateId,
        preview: { x, y, z },
      },
    },
  }
}

function globalAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return globalAnchorPositionFromComponents(
    numericComponent(x),
    numericComponent(y),
    numericComponent(z),
  )
}

function globalAnchorPositionFromComponents(
  x: CoordinateComponent,
  y: CoordinateComponent,
  z: CoordinateComponent,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: { x, y, z },
  }
}

function workPlaneLocalAnchorPosition(): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: {
      origin: { x: 10, y: 20, z: 30 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: -1, z: 0 },
    },
    local: {
      a: { kind: 'symbolic', expression: 'L', previewValue: 4 },
      b: { kind: 'numeric', value: 2 },
    },
    preview: { x: 14, y: 20, z: 32 },
  }
}

function workPlaneLocalAnchorPositionWithFrame(
  sourceFrame: WorkPlaneFrameSnapshot,
  a: number,
  b: number,
): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: sourceFrame,
    local: {
      a: { kind: 'numeric', value: a },
      b: { kind: 'numeric', value: b },
    },
    preview: workPlaneLocalPreview(sourceFrame, a, b),
  }
}

function numericComponent(value: number): CoordinateComponent {
  return {
    kind: 'numeric',
    value,
  }
}

function firstPolyline(diagram: Diagram) {
  const stratum = diagram.strata[0]

  if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
    throw new Error('Expected the first stratum to be a polyline.')
  }

  return stratum
}

function requiredPoint(point: Vec3 | undefined): Vec3 {
  if (point === undefined) {
    throw new Error('Expected a point.')
  }

  return point
}

function requiredAnchor(diagram: Diagram, coordinateId: string): CoordinateAnchor {
  const anchor = (diagram.coordinateAnchors ?? []).find(
    (candidate) => candidate.id === coordinateId,
  )

  if (anchor === undefined) {
    throw new Error(`Expected coordinate anchor ${coordinateId}.`)
  }

  return anchor
}

function pointPreview(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function assertDiagramValid(diagram: Diagram): void {
  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, JSON.stringify(validation.errors))
}

function assertNoReferences(
  diagram: Diagram,
  coordinateIds: readonly string[],
): void {
  for (const coordinateId of coordinateIds) {
    assert.equal(findCoordinateAnchorReferences(diagram, coordinateId).length, 0)
  }
}
