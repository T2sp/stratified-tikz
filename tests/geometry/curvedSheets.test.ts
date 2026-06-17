import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_CURVED_SHEET_SAMPLING_SEGMENTS,
  sampleCurvedSheetPrimitive,
  sampleHemisphere,
  sampleSaddle,
  surfaceBoundaryPolylines,
  validateCurvedSheetPrimitive,
  validateSurfaceFrame,
  validateSurfaceSampling,
} from '../../src/geometry/curvedSheets.ts'
import { isFiniteVec3 } from '../../src/geometry/workPlane.ts'
import {
  createCurvedSheetStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  Diagram,
  HemisphereCurvedSheetPrimitive,
  SaddleCurvedSheetPrimitive,
  SurfaceFrame,
} from '../../src/model/types.ts'

test('valid hemisphere primitive validates', () => {
  const validation = validateCurvedSheetPrimitive(validHemisphere())

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('invalid hemisphere radius is rejected', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validHemisphere(),
    radius: 0,
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /radius.*positive/i)
})

test('hemisphere sampling produces finite mesh vertices and boundary', () => {
  const mesh = sampleHemisphere(validHemisphere())
  const boundaries = surfaceBoundaryPolylines(validHemisphere())

  assert.equal(mesh.vertices.length, (8 + 1) * (4 + 1))
  assert.equal(mesh.faces.length, 8 * 4)
  assert.equal(mesh.vertices.every(isFiniteVec3), true)
  assert.equal(boundaries.length, 1)
  assert.equal(boundaries[0].every(isFiniteVec3), true)
})

test('valid saddle primitive validates', () => {
  const validation = validateCurvedSheetPrimitive(validSaddle())

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('invalid saddle width, depth, and sampling are rejected', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validSaddle(),
    width: -1,
    depth: 0,
    sampling: { uSegments: 2.5, vSegments: 0 },
  })
  const messages = joinMessages(validation.errors)

  assert.equal(validation.valid, false)
  assert.match(messages, /width.*positive/i)
  assert.match(messages, /depth.*positive/i)
  assert.match(messages, /positive integer/i)
})

test('saddle sampling produces finite mesh vertices and perimeter', () => {
  const mesh = sampleSaddle(validSaddle())
  const sampled = sampleCurvedSheetPrimitive(validSaddle())
  const boundaries = surfaceBoundaryPolylines(validSaddle())

  assert.equal(mesh.vertices.length, (6 + 1) * (5 + 1))
  assert.equal(mesh.faces.length, 6 * 5)
  assert.deepEqual(sampled, mesh)
  assert.equal(mesh.vertices.every(isFiniteVec3), true)
  assert.equal(boundaries.length, 1)
  assert.equal(boundaries[0].every(isFiniteVec3), true)
  assert.deepEqual(boundaries[0][0], boundaries[0][boundaries[0].length - 1])
})

test('surface frame validation rejects non-orthonormal frames', () => {
  const validation = validateSurfaceFrame({
    ...xyFrame(),
    u: { x: 2, y: 0, z: 0 },
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /orthonormal right-handed/)
})

test('surface sampling validation enforces the segment cap', () => {
  const validation = validateSurfaceSampling({
    uSegments: MAX_CURVED_SHEET_SAMPLING_SEGMENTS + 1,
    vSegments: 1,
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /at most/)
})

test('curved sheet stratum stores codim 1 sheet geometry in 3D diagrams', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sheet = createCurvedSheetStratum({
    id: 'curved-sheet',
    primitive: validHemisphere(),
    layer: 3,
  })

  diagram.strata.push(sheet)

  assert.equal(sheet.geometricKind, 'sheet')
  assert.equal(sheet.codim, 1)
  assert.equal(sheet.kind, 'curvedSheet')
  assertValid(diagram)
})

test('curved sheet stratum save/load round-trips through JSON', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'round-trip-curved-sheet',
      name: 'Round Trip Curved Sheet',
      primitive: validSaddle(),
      layer: 7,
    }),
  )

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, diagram)
})

test('curved sheet stratum rejects invalid saved primitive data', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sheet = createCurvedSheetStratum({
    id: 'invalid-saved-curved-sheet',
    primitive: validHemisphere(),
  })
  diagram.strata.push({
    ...sheet,
    primitive: {
      ...validHemisphere(),
      radius: -1,
    },
  })

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid saved curved sheet to fail.')
  }
  assert.match(result.error, /radius.*positive/i)
})

function validHemisphere(): HemisphereCurvedSheetPrimitive {
  return {
    kind: 'hemisphere',
    center: { x: 0, y: 0, z: 0 },
    radius: 2,
    frame: xyFrame(),
    hemisphereSide: 'positive',
    sampling: { uSegments: 8, vSegments: 4 },
  }
}

function validSaddle(): SaddleCurvedSheetPrimitive {
  return {
    kind: 'saddle',
    frame: xyFrame(),
    width: 4,
    depth: 3,
    height: 1.5,
    sampling: { uSegments: 6, vSegments: 5 },
  }
}

function xyFrame(): SurfaceFrame {
  return {
    origin: { x: 0, y: 0, z: 0 },
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
    joinMessages(validation.errors),
  )
}

function joinMessages(
  errors:
    | ReturnType<typeof validateCurvedSheetPrimitive>['errors']
    | ReturnType<typeof validateDiagram>['errors'],
): string {
  return errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}
