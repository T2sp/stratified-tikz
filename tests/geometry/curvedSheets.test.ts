import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_CURVED_SHEET_SAMPLING_SEGMENTS,
  sampleBoundaryPath,
  sampleCoonsPatch,
  sampleCurvedSheetPrimitive,
  sampleHemisphere,
  sampleRuledSurface,
  sampleSaddle,
  surfaceBoundaryPolylines,
  validateCurvedSheetPrimitive,
  validateSurfaceFrame,
  validateSurfaceSampling,
} from '../../src/geometry/curvedSheets.ts'
import { isFiniteVec3 } from '../../src/geometry/workPlane.ts'
import {
  createConcatenatedPathStratum,
  createCurvedSheetStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
} from '../../src/model/constructors.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  BoundaryPathSnapshot,
  CoonsPatchPrimitive,
  Diagram,
  HemisphereCurvedSheetPrimitive,
  RuledSurfacePrimitive,
  SaddleCurvedSheetPrimitive,
  SurfaceFrame,
  Vec3,
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
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagram))
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

test('valid ruled surface primitive validates', () => {
  const validation = validateCurvedSheetPrimitive(validRuledSurface())

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('ruled surface rejects empty boundaries', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validRuledSurface(),
    boundary0: { id: 'empty-boundary', segments: [] },
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /at least one segment/i)
})

test('ruled surface rejects non-finite sampled points', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validRuledSurface(),
    boundary0: lineBoundary(
      'overflow-boundary',
      { x: -1.7e308, y: 0, z: 0 },
      { x: 1.7e308, y: 0, z: 0 },
    ),
    sampling: { segments: 2 },
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /non-finite/i)
})

test('ruled surface sampling produces finite mesh vertices and boundary', () => {
  const ruledSurface = validRuledSurface()
  const mesh = sampleRuledSurface(ruledSurface)
  const boundarySamples = sampleBoundaryPath(ruledSurface.boundary0, 4)
  const boundaries = surfaceBoundaryPolylines(ruledSurface)

  assert.equal(mesh.uSegments, 4)
  assert.equal(mesh.vSegments, 1)
  assert.equal(mesh.vertices.length, (4 + 1) * (1 + 1))
  assert.equal(mesh.faces.length, 4)
  assert.equal(mesh.vertices.every(isFiniteVec3), true)
  assert.equal(boundarySamples.every(isFiniteVec3), true)
  assert.equal(boundaries.length, 1)
  assert.equal(boundaries[0].every(isFiniteVec3), true)
})

test('ruled surface boundary closure mismatch is rejected', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validRuledSurface(),
    boundary0: {
      id: 'closed-boundary',
      segments: [
        lineSegment({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
        lineSegment({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      ],
    },
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /same closure status/i)
})

test('valid Coons patch primitive validates', () => {
  const validation = validateCurvedSheetPrimitive(validCoonsPatch())

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('Coons patch rejects inconsistent corners', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    top: lineBoundary(
      'bad-top',
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 1, z: 0.25 },
    ),
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /corner must match/i)
})

test('Coons patch sampling produces finite mesh vertices and boundary', () => {
  const coonsPatch = validCoonsPatch()
  const mesh = sampleCoonsPatch(coonsPatch)
  const sampled = sampleCurvedSheetPrimitive(coonsPatch)
  const boundaries = surfaceBoundaryPolylines(coonsPatch)

  assert.equal(mesh.vertices.length, (4 + 1) * (3 + 1))
  assert.equal(mesh.faces.length, 4 * 3)
  assert.deepEqual(sampled, mesh)
  assert.equal(mesh.vertices.every(isFiniteVec3), true)
  assert.equal(boundaries.length, 1)
  assert.equal(boundaries[0].every(isFiniteVec3), true)
})

test('boundary surface sampling validation enforces the segment cap', () => {
  const ruledValidation = validateCurvedSheetPrimitive({
    ...validRuledSurface(),
    sampling: { segments: MAX_CURVED_SHEET_SAMPLING_SEGMENTS + 1 },
  })
  const coonsValidation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    sampling: {
      uSegments: MAX_CURVED_SHEET_SAMPLING_SEGMENTS + 1,
      vSegments: 1,
    },
  })

  assert.equal(ruledValidation.valid, false)
  assert.equal(coonsValidation.valid, false)
  assert.match(joinMessages(ruledValidation.errors), /at most/)
  assert.match(joinMessages(coonsValidation.errors), /at most/)
})

test('boundary surface curved sheet save/load round-trips through JSON', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'round-trip-ruled-surface',
      name: 'Round Trip Ruled Surface',
      primitive: validRuledSurface(),
      layer: 2,
    }),
    createCurvedSheetStratum({
      id: 'round-trip-coons-patch',
      name: 'Round Trip Coons Patch',
      primitive: validCoonsPatch(),
      layer: 3,
    }),
  )

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagram))
})

test('boundary surface stratum rejects invalid saved boundary data', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sheet = createCurvedSheetStratum({
    id: 'invalid-saved-ruled-surface',
    primitive: validRuledSurface(),
  })
  diagram.strata.push({
    ...sheet,
    primitive: {
      ...validRuledSurface(),
      boundary0: { id: 'empty-boundary', segments: [] },
    },
  })

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid saved boundary surface to fail.')
  }
  assert.match(result.error, /at least one segment/i)
})

test('existing curved sheets, filled boundaries, and paths still validate', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'existing-path',
      segments: [
        lineSegment({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
      ],
    }),
    createFilledRegion2DStratum({
      id: 'existing-fill',
      boundaries: [
        {
          id: 'square',
          segments: [
            lineSegment({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
            lineSegment({ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }),
            lineSegment({ x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }),
            lineSegment({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }),
          ],
        },
      ],
    }),
  )

  assert.equal(validateCurvedSheetPrimitive(validHemisphere()).valid, true)
  assert.equal(validateCurvedSheetPrimitive(validSaddle()).valid, true)
  assertValid(diagram)
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

function validRuledSurface(): RuledSurfacePrimitive {
  return {
    kind: 'ruledSurface',
    boundary0: lineBoundary(
      'ruled-boundary-0',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ),
    boundary1: lineBoundary(
      'ruled-boundary-1',
      { x: 0, y: 1, z: 1 },
      { x: 2, y: 1, z: 1 },
    ),
    sampling: { segments: 4 },
  }
}

function validCoonsPatch(): CoonsPatchPrimitive {
  return {
    kind: 'coonsPatch',
    bottom: lineBoundary(
      'coons-bottom',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ),
    right: lineBoundary(
      'coons-right',
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 1, z: 0 },
    ),
    top: lineBoundary(
      'coons-top',
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 1, z: 0 },
    ),
    left: lineBoundary(
      'coons-left',
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ),
    sampling: { uSegments: 4, vSegments: 3 },
  }
}

function lineBoundary(
  id: string,
  start: Vec3,
  end: Vec3,
): BoundaryPathSnapshot {
  return {
    id,
    segments: [lineSegment(start, end)],
  }
}

function lineSegment(
  start: Vec3,
  end: Vec3,
): BoundaryPathSnapshot['segments'][number] {
  return {
    kind: 'line',
    start,
    end,
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
