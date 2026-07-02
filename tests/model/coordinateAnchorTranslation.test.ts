import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCoordinateAnchor,
  createCurveStratum,
  createEmptyDiagram,
  coordinateReferenceVec3ForAnchorId,
  resolveDiagramCoordinateRefs,
  translateCoordinateAnchors,
  validateDiagram,
} from '../../src/model/index.ts'
import type {
  CoordinateAnchor,
  CoordinateAnchorPosition,
  CoordinateComponent,
  Diagram,
  ScalarInputValue,
  SymbolicVariable,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'

const delta = { x: 1, y: -2, z: 3 }

test('translateCoordinateAnchors translates a numeric global coordinate', () => {
  const diagram = diagramWithGlobalAnchor('coord-a', 'A', { x: 1, y: 2, z: 3 })
  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(diagram, ['coord-a'], delta)

  assertTranslateOk(result)

  const anchor = requiredAnchor(result.value.diagram, 'coord-a')

  assert.equal(result.value.translatedCount, 1)
  assert.equal(result.value.detachedCoordinateReferenceCount, 0)
  assert.deepEqual(globalPositionPreview(anchor.position), { x: 2, y: 0, z: 6 })
  assert.equal(JSON.stringify(diagram), originalJson)
  assertDiagramValid(result.value.diagram)
})

test('translateCoordinateAnchors preserves symbolic global expressions', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.variables = [
    symbolicVariable('var-R', 'R', 2),
    symbolicVariable('var-q', 'q', 0),
  ]
  appendAnchor(
    diagram,
    'coord-a',
    'A',
    {
      kind: 'global',
      value: {
        x: symbolicComponent('R*cos(q)', 2),
        y: numericComponent(0),
        z: numericComponent(0),
      },
    },
  )

  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: 1, y: 0, z: 0 },
  )

  assertTranslateOk(result)

  const x = requiredGlobalPosition(result.value.diagram, 'coord-a').value.x

  assert.equal(x.kind, 'symbolic')
  if (x.kind !== 'symbolic') {
    throw new Error('Expected symbolic x coordinate.')
  }
  assert.equal(x.expression, '(R*cos(q)) + 1')
  assert.equal(x.previewValue, 3)
  assertDiagramValid(result.value.diagram)
})

test('translateCoordinateAnchors treats zero translation as a clean no-op', () => {
  const diagram = diagramWithGlobalAnchor('coord-a', 'A', { x: 1, y: 2, z: 0 })
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a', 'coord-a'],
    { x: 0, y: 0, z: 0 },
  )

  assertTranslateOk(result)
  assert.equal(result.value.diagram, diagram)
  assert.equal(result.value.translatedCount, 0)
})

test('translateCoordinateAnchors rejects non-finite numeric deltas', () => {
  const diagram = diagramWithGlobalAnchor('coord-a', 'A', { x: 1, y: 2, z: 0 })
  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.error.message, /finite dx, dy, and dz/)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('translateCoordinateAnchors recomputes symbolic global previews', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.variables = [symbolicVariable('var-R', 'R', 4)]
  appendAnchor(
    diagram,
    'coord-a',
    'A',
    {
      kind: 'global',
      value: {
        x: symbolicComponent('R', 1),
        y: numericComponent(0),
        z: numericComponent(0),
      },
    },
  )

  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: 1, y: 0, z: 0 },
  )

  assertTranslateOk(result)

  const x = requiredGlobalPosition(result.value.diagram, 'coord-a').value.x

  assert.equal(x.kind, 'symbolic')
  assert.equal(x.kind === 'symbolic' ? x.previewValue : Number.NaN, 5)
})

test('translateCoordinateAnchors moves a work-plane-local coordinate by translating frame origin', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const frame = xyFrame({ x: 10, y: 20, z: 30 })
  const position = workPlaneLocalPosition(frame, 2, 3)

  appendAnchor(diagram, 'coord-local', 'Local', position)

  const result = translateCoordinateAnchors(diagram, ['coord-local'], delta)

  assertTranslateOk(result)

  const moved = requiredWorkPlaneLocalPosition(
    result.value.diagram,
    'coord-local',
  )

  assert.deepEqual(moved.frame.origin, { x: 11, y: 18, z: 33 })
  assert.deepEqual(moved.local, position.local)
  assert.deepEqual(moved.frame.u, position.frame.u)
  assert.deepEqual(moved.frame.v, position.frame.v)
  assert.deepEqual(moved.frame.normal, position.frame.normal)
  assert.deepEqual(moved.preview, { x: 13, y: 21, z: 33 })
  assertDiagramValid(result.value.diagram)
})

test('translateCoordinateAnchors leaves original work-plane-local frames and active work-plane-like state untouched', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const activeWorkPlane = {
    kind: 'axisAligned' as const,
    plane: 'xy' as const,
    offset: 5,
  }
  const originalActiveWorkPlane = structuredClone(activeWorkPlane)
  const frame = xyFrame({ x: 10, y: 20, z: 30 })

  appendAnchor(diagram, 'coord-local', 'Local', workPlaneLocalPosition(frame, 2, 3))

  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(diagram, ['coord-local'], delta)

  assertTranslateOk(result)
  assert.deepEqual(activeWorkPlane, originalActiveWorkPlane)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('translateCoordinateAnchors detaches a selected global coordinateRef before moving it', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  appendAnchor(diagram, 'coord-a', 'A', globalPosition({ x: 2, y: 3, z: 4 }))
  appendAnchor(diagram, 'coord-b', 'B', globalPositionReferencing(diagram, 'coord-a'))

  const result = translateCoordinateAnchors(
    diagram,
    ['coord-b'],
    { x: 1, y: 1, z: 1 },
  )

  assertTranslateOk(result)

  const b = requiredAnchor(result.value.diagram, 'coord-b')

  assert.equal(result.value.detachedCoordinateReferenceCount, 1)
  assert.deepEqual(globalPositionPreview(b.position), { x: 3, y: 4, z: 5 })
  assert.equal(positionContainsCoordinateRef(b.position), false)
  assert.deepEqual(
    globalPositionPreview(requiredAnchor(result.value.diagram, 'coord-a').position),
    { x: 2, y: 3, z: 4 },
  )
})

test('translateCoordinateAnchors detaches selected coordinate dependencies using pre-translation positions', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  appendAnchor(diagram, 'coord-a', 'A', globalPosition({ x: 2, y: 3, z: 4 }))
  appendAnchor(diagram, 'coord-b', 'B', globalPositionReferencing(diagram, 'coord-a'))

  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a', 'coord-b'],
    { x: 10, y: 0, z: 0 },
  )

  assertTranslateOk(result)

  assert.deepEqual(
    globalPositionPreview(requiredAnchor(result.value.diagram, 'coord-a').position),
    { x: 12, y: 3, z: 4 },
  )
  assert.deepEqual(
    globalPositionPreview(requiredAnchor(result.value.diagram, 'coord-b').position),
    { x: 12, y: 3, z: 4 },
  )
  assert.equal(
    positionContainsCoordinateRef(requiredAnchor(result.value.diagram, 'coord-b').position),
    false,
  )
})

test('translateCoordinateAnchors detaches work-plane-local frame coordinateRefs then translates frame origin', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  appendAnchor(diagram, 'coord-a', 'A', globalPosition({ x: 5, y: 6, z: 7 }))
  appendAnchor(
    diagram,
    'coord-local',
    'Local',
    workPlaneLocalPosition(
      {
        ...xyFrame(),
        origin: requiredCoordinateReference(diagram, 'coord-a'),
      },
      2,
      3,
      { x: 7, y: 9, z: 7 },
    ),
  )

  const result = translateCoordinateAnchors(
    diagram,
    ['coord-local'],
    { x: 1, y: 1, z: 1 },
  )

  assertTranslateOk(result)

  const moved = requiredWorkPlaneLocalPosition(
    result.value.diagram,
    'coord-local',
  )

  assert.equal(result.value.detachedCoordinateReferenceCount, 1)
  assert.deepEqual(moved.frame.origin, { x: 6, y: 7, z: 8 })
  assert.deepEqual(moved.local, {
    a: numericScalar(2),
    b: numericScalar(3),
  })
  assert.deepEqual(moved.preview, { x: 8, y: 10, z: 8 })
  assert.equal(positionContainsCoordinateRef(moved), false)
})

test('translateCoordinateAnchors handles duplicate ids deterministically', () => {
  const diagram = diagramWithGlobalAnchor('coord-a', 'A', { x: 1, y: 2, z: 3 })
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a', 'coord-a'],
    { x: 1, y: 0, z: 0 },
  )

  assertTranslateOk(result)
  assert.equal(result.value.translatedCount, 1)
  assert.deepEqual(
    globalPositionPreview(requiredAnchor(result.value.diagram, 'coord-a').position),
    { x: 2, y: 2, z: 3 },
  )
})

test('translateCoordinateAnchors fails atomically for a missing coordinate id', () => {
  const diagram = diagramWithGlobalAnchor('coord-a', 'A', { x: 1, y: 2, z: 3 })
  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(
    diagram,
    ['missing-coordinate'],
    { x: 1, y: 0, z: 0 },
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.error.message, /does not exist/)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('translateCoordinateAnchors fails atomically when one selected coordinate is invalid', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  appendAnchor(diagram, 'coord-a', 'A', globalPosition({ x: 1, y: 2, z: 3 }))
  appendAnchor(
    diagram,
    'coord-invalid',
    'Invalid',
    globalPosition({ x: Number.POSITIVE_INFINITY, y: 0, z: 0 }),
  )

  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a', 'coord-invalid'],
    { x: 1, y: 0, z: 0 },
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.error.message, /finite|valid/)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('translateCoordinateAnchors fails atomically when recomputed preview is non-finite', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  appendAnchor(
    diagram,
    'coord-local',
    'Local',
    workPlaneLocalPosition(xyFrame(), Number.MAX_VALUE, 0, {
      x: Number.MAX_VALUE,
      y: 0,
      z: 0,
    }),
  )

  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-local'],
    { x: Number.MAX_VALUE, y: 0, z: 0 },
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.error.message, /finite/)
  assert.equal(JSON.stringify(diagram), originalJson)
})

test('translateCoordinateAnchors leaves layer-bound coordinate references intact', () => {
  const diagram = createReferencedPathDiagram()
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: 3, y: 4, z: 0 },
  )

  assertTranslateOk(result)

  const curve = requiredPolyline(result.value.diagram, 'referenced-path')

  assert.equal(result.value.diagram.strata, diagram.strata)
  assert.equal(referenceId(curve.points[0]), 'coord-a')
  assert.equal(referenceId(curve.points[1]), 'coord-b')
})

test('translateCoordinateAnchors makes referencing geometry previews follow the moved anchor', () => {
  const diagram = createReferencedPathDiagram()
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: 3, y: 4, z: 0 },
  )

  assertTranslateOk(result)

  const resolved = resolveDiagramCoordinateRefs(result.value.diagram)
  const curve = requiredPolyline(resolved, 'referenced-path')

  assert.deepEqual(pointPreview(curve.points[0]), { x: 3, y: 4, z: 0 })
  assert.equal(referenceId(curve.points[0]), 'coord-a')
})

test('translateCoordinateAnchors updates TikZ coordinate definitions while preserving path refs', () => {
  const diagram = createReferencedPathDiagram()
  const before = generateTikz(diagram)
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: 3, y: 4, z: 0 },
  )

  assertTranslateOk(result)

  const after = generateTikz(result.value.diagram)

  assert.match(before, /\\coordinate \(A\) at \(0,0\);/)
  assert.match(after, /\\coordinate \(A\) at \(3,4\);/)
  assert.match(after, /\(A\) -- \(B\);/)
  assert.doesNotMatch(after, /\(3,4\) -- \(B\);/)
})

test('translateCoordinateAnchors is pure enough for deferred undo integration', () => {
  const diagram = createReferencedPathDiagram()
  const originalJson = JSON.stringify(diagram)
  const result = translateCoordinateAnchors(
    diagram,
    ['coord-a'],
    { x: 3, y: 4, z: 0 },
  )

  assertTranslateOk(result)
  assert.notEqual(result.value.diagram, diagram)
  assert.equal(JSON.stringify(diagram), originalJson)
})

function createReferencedPathDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  appendAnchor(diagram, 'coord-a', 'A', globalPosition({ x: 0, y: 0, z: 0 }))
  appendAnchor(diagram, 'coord-b', 'B', globalPosition({ x: 2, y: 1, z: 0 }))
  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'referenced-path',
      name: 'Referenced path',
      points: [
        requiredCoordinateReference(diagram, 'coord-a'),
        requiredCoordinateReference(diagram, 'coord-b'),
      ],
      layer: 0,
    }),
  )

  return diagram
}

function diagramWithGlobalAnchor(
  id: string,
  name: string,
  point: Vec3,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  appendAnchor(diagram, id, name, globalPosition(point))

  return diagram
}

function appendAnchor(
  diagram: Diagram,
  id: string,
  name: string,
  position: CoordinateAnchorPosition,
): void {
  diagram.coordinateAnchors = [
    ...(diagram.coordinateAnchors ?? []),
    createCoordinateAnchor(diagram, {
      id,
      name,
      tikzName: name,
      position,
    }),
  ]
}

function globalPosition(point: Vec3): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: numericComponent(point.x),
      y: numericComponent(point.y),
      z: numericComponent(point.z),
    },
  }
}

function globalPositionReferencing(
  diagram: Diagram,
  coordinateId: string,
): CoordinateAnchorPosition {
  const reference = requiredCoordinateReference(diagram, coordinateId)

  if (reference.symbolic === undefined) {
    throw new Error(`Expected coordinate reference ${coordinateId}.`)
  }

  return {
    kind: 'global',
    value: reference.symbolic,
  }
}

function workPlaneLocalPosition(
  frame: WorkPlaneFrameSnapshot,
  a: number,
  b: number,
  preview: Vec3 = {
    x: frame.origin.x + a * frame.u.x + b * frame.v.x,
    y: frame.origin.y + a * frame.u.y + b * frame.v.y,
    z: frame.origin.z + a * frame.u.z + b * frame.v.z,
  },
): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame,
    local: {
      a: numericScalar(a),
      b: numericScalar(b),
    },
    preview,
  }
}

function xyFrame(origin: Vec3 = { x: 0, y: 0, z: 0 }): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function requiredAnchor(diagram: Diagram, id: string): CoordinateAnchor {
  const anchor = diagram.coordinateAnchors?.find((candidate) => candidate.id === id)

  if (anchor === undefined) {
    throw new Error(`Expected coordinate anchor ${id}.`)
  }

  return anchor
}

function requiredGlobalPosition(
  diagram: Diagram,
  id: string,
): Extract<CoordinateAnchorPosition, { kind: 'global' }> {
  const position = requiredAnchor(diagram, id).position

  if (position.kind !== 'global') {
    throw new Error(`Expected global coordinate anchor ${id}.`)
  }

  return position
}

function requiredWorkPlaneLocalPosition(
  diagram: Diagram,
  id: string,
): Extract<CoordinateAnchorPosition, { kind: 'workPlaneLocal' }> {
  const position = requiredAnchor(diagram, id).position

  if (position.kind !== 'workPlaneLocal') {
    throw new Error(`Expected work-plane-local coordinate anchor ${id}.`)
  }

  return position
}

function requiredCoordinateReference(
  diagram: Diagram,
  coordinateId: string,
): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate reference ${coordinateId}.`)
  }

  return point
}

function requiredPolyline(diagram: Diagram, id: string) {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
    throw new Error(`Expected polyline ${id}.`)
  }

  return stratum
}

function referenceId(point: Vec3): string | undefined {
  const source = point.symbolic?.source

  return source?.kind === 'coordinateRef' ? source.coordinateId : undefined
}

function pointPreview(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function globalPositionPreview(position: CoordinateAnchorPosition): Vec3 {
  if (position.kind !== 'global') {
    throw new Error('Expected a global coordinate anchor position.')
  }

  return {
    x: coordinateComponentPreview(position.value.x),
    y: coordinateComponentPreview(position.value.y),
    z: coordinateComponentPreview(position.value.z),
  }
}

function coordinateComponentPreview(component: CoordinateComponent): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function numericComponent(value: number): CoordinateComponent {
  return {
    kind: 'numeric',
    value,
  }
}

function symbolicComponent(
  expression: string,
  previewValue: number,
): CoordinateComponent {
  return {
    kind: 'symbolic',
    expression,
    previewValue,
  }
}

function numericScalar(value: number): ScalarInputValue {
  return {
    kind: 'numeric',
    value,
  }
}

function symbolicVariable(
  id: string,
  name: string,
  previewValue: number,
): SymbolicVariable {
  return {
    id,
    name,
    macroName: name,
    expression: String(previewValue),
    previewValue,
  }
}

function positionContainsCoordinateRef(position: CoordinateAnchorPosition): boolean {
  if (position.kind === 'global') {
    return position.value.source?.kind === 'coordinateRef'
  }

  return (
    pointContainsCoordinateRef(position.preview) ||
    frameContainsCoordinateRef(position.frame)
  )
}

function frameContainsCoordinateRef(frame: WorkPlaneFrameSnapshot): boolean {
  return (
    pointContainsCoordinateRef(frame.origin) ||
    pointContainsCoordinateRef(frame.u) ||
    pointContainsCoordinateRef(frame.v) ||
    pointContainsCoordinateRef(frame.normal)
  )
}

function pointContainsCoordinateRef(point: Vec3): boolean {
  const source = point.symbolic?.source

  if (source?.kind === 'coordinateRef') {
    return true
  }

  return source?.kind === 'workPlaneLocal'
    ? frameContainsCoordinateRef(source.frame)
    : false
}

function assertTranslateOk(
  result: ReturnType<typeof translateCoordinateAnchors>,
): asserts result is Extract<
  ReturnType<typeof translateCoordinateAnchors>,
  { ok: true }
> {
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : `${result.error.path}: ${result.error.message}`,
  )
}

function assertDiagramValid(diagram: Diagram): void {
  const validation = validateDiagram(diagram)

  assert.equal(
    validation.valid,
    true,
    validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
  )
}
