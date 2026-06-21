import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_CURVED_SHEET_SAMPLING_SEGMENTS,
  boundaryEnd,
  boundaryStart,
  evaluateBoundary,
  reverseBoundary,
  sampleBoundary,
  sampleBoundaryPath,
  sampleCoonsPatch,
  sampleCurvedSheetPrimitive,
  sampleHemisphere,
  sampleRuledSurface,
  sampleSaddle,
  surfaceBoundaryPolylines,
  validateCoonsBoundarySnapshot,
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
import { refreshDiagramSymbolicCoordinatePreviews } from '../../src/model/symbolicCoordinates.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  BoundaryPathSnapshot,
  CoonsBoundarySnapshot,
  CoonsPatchPrimitive,
  Diagram,
  HemisphereCurvedSheetPrimitive,
  PathSegment,
  RuledSurfacePrimitive,
  SaddleCurvedSheetPrimitive,
  SurfaceFrame,
  Vec3,
} from '../../src/model/types.ts'

const coonsPatchBoundaryRoles = ['bottom', 'right', 'top', 'left'] as const
type CoonsPatchBoundaryRole = (typeof coonsPatchBoundaryRoles)[number]

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

test('validateDiagram accepts ruled surface symbolic boundary previews', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const primitive = symbolicRuledSurface()

  diagram.variables = [
    {
      id: 'var-len',
      name: 'Len',
      macroName: 'Len',
      expression: '4',
      previewValue: 4,
    },
  ]
  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'symbolic-ruled-validation',
      primitive,
    }),
  )

  assertValid(diagram)
  assert.equal(sampleRuledSurface(primitive).vertices.every(isFiniteVec3), true)
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

test('ruled surface still accepts two closed boundaries with matching closure status', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validRuledSurface(),
    boundary0: closedBoundary('closed-ruled-boundary-0', {
      x: 0,
      y: 0,
      z: 0,
    }),
    boundary1: closedBoundary('closed-ruled-boundary-1', {
      x: 0,
      y: 1,
      z: 1,
    }),
  })

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('valid Coons patch primitive validates', () => {
  const validation = validateCurvedSheetPrimitive(validCoonsPatch())

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('validateDiagram accepts Coons patch symbolic boundary previews', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const primitive = symbolicCoonsPatch()

  diagram.variables = [
    {
      id: 'var-len',
      name: 'Len',
      macroName: 'Len',
      expression: '4',
      previewValue: 4,
    },
    {
      id: 'var-r',
      name: 'R',
      macroName: 'R',
      expression: '1',
      previewValue: 1,
    },
  ]
  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'symbolic-coons-validation',
      primitive,
    }),
  )

  assertValid(diagram)
  assert.equal(sampleCoonsPatch(primitive).vertices.every(isFiniteVec3), true)
})

test('validateDiagram rejects unresolved symbolic boundary previews', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'unresolved-symbolic-coons',
      primitive: symbolicCoonsPatch(),
    }),
  )

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /Unknown variable "Len"/)
})

test('constant Coons boundary helpers use the same point for every endpoint and sample', () => {
  const point = { x: 1, y: 2, z: 3 }
  const boundary = constantBoundary('constant-helper', point)
  const samples = sampleBoundary(boundary, 4)
  const reversed = reverseBoundary(boundary)

  assert.deepEqual(boundaryStart(boundary), point)
  assert.deepEqual(boundaryEnd(boundary), point)
  assert.deepEqual(evaluateBoundary(boundary, 0), point)
  assert.deepEqual(evaluateBoundary(boundary, 0.5), point)
  assert.deepEqual(evaluateBoundary(boundary, 1), point)
  assert.equal(samples.length, 5)
  assert.equal(samples.every((sample) => isFiniteVec3(sample)), true)
  assert.deepEqual(samples, [point, point, point, point, point])
  assert.deepEqual(reversed, boundary)
})

test('constant Coons boundary validation rejects non-finite points', () => {
  const validation = validateCoonsBoundarySnapshot({
    kind: 'constantPoint',
    sourceId: 'bad-point',
    point: { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /point\.y/i)
})

test('Coons patch validates with a bottom constant point when adjacent starts match it', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    bottom: constantBoundary('coons-bottom-point', { x: 0, y: 0, z: 0 }),
    right: lineBoundary(
      'coons-right-from-bottom-point',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
    top: lineBoundary(
      'coons-top-for-bottom-point',
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
  })

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('Coons patch validates with a top constant point when adjacent ends match it', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    top: constantBoundary('coons-top-point', { x: 0, y: 1, z: 0 }),
    bottom: lineBoundary(
      'coons-bottom-for-top-point',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ),
    right: lineBoundary(
      'coons-right-to-top-point',
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ),
  })

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('Coons patch validates with a left constant point when left corners collapse', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    left: constantBoundary('coons-left-point', { x: 0, y: 0, z: 0 }),
    top: lineBoundary(
      'coons-top-from-left-point',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
    right: lineBoundary(
      'coons-right-for-left-point',
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
  })

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('Coons patch validates with a right constant point when right corners collapse', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    right: constantBoundary('coons-right-point', { x: 2, y: 0, z: 0 }),
    top: lineBoundary(
      'coons-top-to-right-point',
      { x: 0, y: 1, z: 0.5 },
      { x: 2, y: 0, z: 0 },
    ),
    left: lineBoundary(
      'coons-left-for-right-point',
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0.5 },
    ),
  })

  assert.equal(validation.valid, true, joinMessages(validation.errors))
})

test('Coons patch rejects mismatched adjacent endpoints for a constant boundary', () => {
  const validation = validateCurvedSheetPrimitive({
    ...validCoonsPatch(),
    bottom: constantBoundary('coons-bottom-mismatch-point', {
      x: 0,
      y: 0,
      z: 0,
    }),
  })

  assert.equal(validation.valid, false)
  assert.match(joinMessages(validation.errors), /corner must match/i)
})

test('Coons patch with constant boundaries samples finite meshes', () => {
  const oneConstant = {
    ...validCoonsPatch(),
    bottom: constantBoundary('coons-bottom-point-sampled', {
      x: 0,
      y: 0,
      z: 0,
    }),
    right: lineBoundary(
      'coons-right-point-sampled',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
    top: lineBoundary(
      'coons-top-point-sampled',
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
  } satisfies CoonsPatchPrimitive
  const twoConstants = {
    ...oneConstant,
    left: constantBoundary('coons-left-point-sampled', { x: 0, y: 0, z: 0 }),
    top: lineBoundary(
      'coons-top-two-points-sampled',
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 1, z: 1 },
    ),
  } satisfies CoonsPatchPrimitive

  for (const primitive of [oneConstant, twoConstants]) {
    const validation = validateCurvedSheetPrimitive(primitive)
    const mesh = sampleCoonsPatch(primitive)

    assert.equal(validation.valid, true, joinMessages(validation.errors))
    assert.equal(mesh.vertices.every(isFiniteVec3), true)
    assert.equal(mesh.faces.length, primitive.sampling.uSegments * primitive.sampling.vSegments)
  }
})

for (const role of coonsPatchBoundaryRoles) {
  test(`Coons patch primitive rejects closed ${role} boundary`, () => {
    const validation = validateCurvedSheetPrimitive({
      ...validCoonsPatch(),
      [role]: closedBoundary(
        `closed-coons-${role}`,
        coonsPatchBoundaryStart(role),
      ),
    })

    assert.equal(validation.valid, false)
    assert.match(
      joinMessages(validation.errors),
      new RegExp(`Coons patch ${role} boundary must be an open path`, 'i'),
    )
  })
}

test('Coons patch primitive rejects a closed boundary even if corners match', () => {
  const validation = validateCurvedSheetPrimitive(
    coonsPatchWithClosedBottomAndMatchingCorners(),
  )
  const messages = joinMessages(validation.errors)

  assert.equal(validation.valid, false)
  assert.match(messages, /Coons patch bottom boundary must be an open path/i)
  assert.doesNotMatch(messages, /corner must match/i)
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

test('parseSavedDiagramJson rejects ruled surface boundary line missing start without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validRuledSurface(),
      boundary0: boundaryWithSegments('missing-start', [
        malformedPathSegment({
          kind: 'line',
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /boundary0\.segments\[0\]\.start.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects ruled surface boundary line missing end without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validRuledSurface(),
      boundary0: boundaryWithSegments('missing-end', [
        malformedPathSegment({
          kind: 'line',
          start: { x: 0, y: 0, z: 0 },
        }),
      ]),
    },
    /boundary0\.segments\[0\]\.end.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects ruled surface boundary cubic missing control1 without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validRuledSurface(),
      boundary0: boundaryWithSegments('missing-control1', [
        malformedPathSegment({
          kind: 'cubicBezier',
          start: { x: 0, y: 0, z: 0 },
          control2: { x: 1.5, y: 0.25, z: 0 },
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /boundary0\.segments\[0\]\.control1.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects ruled surface boundary cubic missing start without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validRuledSurface(),
      boundary0: boundaryWithSegments('missing-cubic-start', [
        malformedPathSegment({
          kind: 'cubicBezier',
          control1: { x: 0.5, y: 0.25, z: 0 },
          control2: { x: 1.5, y: 0.25, z: 0 },
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /boundary0\.segments\[0\]\.start.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects ruled surface boundary unknown segment kind without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validRuledSurface(),
      boundary0: boundaryWithSegments('unknown-kind', [
        malformedPathSegment({
          kind: 'quadraticBezier',
          start: { x: 0, y: 0, z: 0 },
          control: { x: 1, y: 0.5, z: 0 },
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /boundary0\.segments\[0\]\.kind.*line, cubicBezier, or arc/,
  )
})

test('parseSavedDiagramJson rejects ruled surface boundary whose segments are not an array without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validRuledSurface(),
      boundary0: boundaryWithSegments('non-array-segments', 'not-segments'),
    },
    /boundary0\.segments.*array/,
  )
})

test('parseSavedDiagramJson rejects Coons patch boundary line missing start without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validCoonsPatch(),
      bottom: boundaryWithSegments('coons-missing-start', [
        malformedPathSegment({
          kind: 'line',
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /bottom\.segments\[0\]\.start.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects Coons patch malformed constant boundary without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validCoonsPatch(),
      bottom: {
        kind: 'constantPoint',
        sourceId: 'malformed-constant',
        point: { x: 0, y: Number.NaN, z: 0 },
      },
    },
    /bottom\.point\.y.*finite/,
  )
})

test('parseSavedDiagramJson rejects Coons patch boundary cubic missing control2 without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validCoonsPatch(),
      bottom: boundaryWithSegments('coons-missing-control2', [
        malformedPathSegment({
          kind: 'cubicBezier',
          start: { x: 0, y: 0, z: 0 },
          control1: { x: 0.5, y: 0.25, z: 0 },
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /bottom\.segments\[0\]\.control2.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects Coons patch malformed arc boundary without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validCoonsPatch(),
      bottom: boundaryWithSegments('coons-malformed-arc', [
        malformedPathSegment({
          kind: 'arc',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 2, y: 0, z: 0 },
          radius: 1,
          startAngleDeg: 180,
          endAngleDeg: 0,
          direction: 'clockwise',
          frame: xyFrame(),
        }),
      ]),
    },
    /bottom\.segments\[0\]\.center.*Coordinate must be an object/,
  )
})

test('parseSavedDiagramJson rejects Coons patch unknown boundary segment kind without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validCoonsPatch(),
      bottom: boundaryWithSegments('coons-unknown-kind', [
        malformedPathSegment({
          kind: 'quadraticBezier',
          start: { x: 0, y: 0, z: 0 },
          control: { x: 1, y: 0.5, z: 0 },
          end: { x: 2, y: 0, z: 0 },
        }),
      ]),
    },
    /bottom\.segments\[0\]\.kind.*line, cubicBezier, or arc/,
  )
})

test('parseSavedDiagramJson rejects a Coons patch with one malformed boundary without throwing', () => {
  assertBoundarySurfaceParseError(
    {
      ...validCoonsPatch(),
      right: boundaryWithSegments('coons-one-bad-boundary', [
        malformedPathSegment({
          kind: 'line',
          end: { x: 2, y: 1, z: 0 },
        }),
      ]),
    },
    /right\.segments\[0\]\.start.*Coordinate must be an object/,
  )
})

for (const role of coonsPatchBoundaryRoles) {
  test(`parseSavedDiagramJson rejects Coons patch with closed ${role} boundary without throwing`, () => {
    assertBoundarySurfaceParseError(
      {
        ...validCoonsPatch(),
        [role]: closedBoundary(
          `saved-closed-coons-${role}`,
          coonsPatchBoundaryStart(role),
        ),
      },
      new RegExp(`Coons patch ${role} boundary must be an open path`, 'i'),
    )
  })
}

test('valid ruled surface saved diagram still loads', () => {
  const result = parseBoundarySurfacePrimitiveNoThrow(validRuledSurface())

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
})

test('valid Coons patch saved diagram still loads', () => {
  const result = parseBoundarySurfacePrimitiveNoThrow(validCoonsPatch())

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
})

test('symbolic coordinates in valid boundary snapshots still refresh', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sheet = createCurvedSheetStratum({
    id: 'symbolic-boundary-refresh',
    primitive: validRuledSurface(),
  })
  const symbolicStart: Vec3 = {
    x: -10,
    y: 0,
    z: 0,
    symbolic: {
      x: { kind: 'symbolic', expression: 'R', previewValue: -10 },
      y: { kind: 'numeric', value: 0 },
      z: { kind: 'numeric', value: 0 },
    },
  }

  diagram.strata.push({
    ...sheet,
    primitive: {
      ...validRuledSurface(),
      boundary0: lineBoundary(
        'symbolic-ruled-boundary',
        symbolicStart,
        { x: 2, y: 0, z: 0 },
      ),
    },
  })

  const refreshed = refreshDiagramSymbolicCoordinatePreviews(diagram, {
    variableNames: ['R'],
    previewValues: new Map([['R', 0.75]]),
  })

  assert.equal(refreshed.ok, true)
  if (!refreshed.ok) {
    throw new Error(joinMessages(refreshed.errors))
  }

  const refreshedSheet = refreshed.diagram.strata[0]
  if (
    refreshedSheet === undefined ||
    refreshedSheet.kind !== 'curvedSheet' ||
    refreshedSheet.primitive.kind !== 'ruledSurface'
  ) {
    throw new Error('Expected refreshed ruled surface stratum.')
  }

  const refreshedStart = refreshedSheet.primitive.boundary0.segments[0].start

  assert.equal(refreshedStart.x, 0.75)
  assert.equal(refreshedStart.symbolic?.x.kind, 'symbolic')
  assert.equal(refreshedStart.symbolic?.x.previewValue, 0.75)
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

function assertBoundarySurfaceParseError(
  primitive: RuledSurfacePrimitive | CoonsPatchPrimitive,
  expectedMessage: RegExp,
): void {
  const result = parseBoundarySurfacePrimitiveNoThrow(primitive)

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected malformed boundary surface to fail.')
  }
  assert.match(result.error, expectedMessage)
}

function parseBoundarySurfacePrimitiveNoThrow(
  primitive: RuledSurfacePrimitive | CoonsPatchPrimitive,
): ReturnType<typeof parseSavedDiagramJson> {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sheet = createCurvedSheetStratum({
    id: 'parse-boundary-surface',
    primitive: validRuledSurface(),
  })
  diagram.strata.push({
    ...sheet,
    primitive,
  })
  const json = serializeDiagram(diagram)
  let result: ReturnType<typeof parseSavedDiagramJson> | undefined

  assert.doesNotThrow(() => {
    result = parseSavedDiagramJson(json)
  })

  if (result === undefined) {
    throw new Error('Expected parseSavedDiagramJson to return a result.')
  }

  return result
}

function boundaryWithSegments(
  id: string,
  segments: unknown,
): BoundaryPathSnapshot {
  return {
    id,
    segments,
  } as unknown as BoundaryPathSnapshot
}

function malformedPathSegment(segment: Record<string, unknown>): PathSegment {
  return segment as unknown as PathSegment
}

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

function symbolicRuledSurface(): RuledSurfacePrimitive {
  return {
    kind: 'ruledSurface',
    boundary0: lineBoundary(
      'symbolic-ruled-boundary-0',
      symbolicVec3(-2, 0, 0, { x: '-.5*Len' }),
      symbolicVec3(2, 0, 0, { x: '.5*Len' }),
    ),
    boundary1: lineBoundary(
      'symbolic-ruled-boundary-1',
      symbolicVec3(-2, 1, 1, { x: '-.5*Len' }),
      symbolicVec3(2, 1, 1, { x: '.5*Len' }),
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

function symbolicCoonsPatch(): CoonsPatchPrimitive {
  return {
    kind: 'coonsPatch',
    bottom: lineBoundary(
      'symbolic-coons-bottom',
      symbolicVec3(-2, 0, 0, { x: '-.5*Len' }),
      symbolicVec3(2, 0, 0, { x: '.5*Len' }),
    ),
    right: lineBoundary(
      'symbolic-coons-right',
      symbolicVec3(2, 0, 0, { x: '.5*Len' }),
      symbolicVec3(2, 1, 0, { x: '.5*Len', y: 'R' }),
    ),
    top: lineBoundary(
      'symbolic-coons-top',
      symbolicVec3(-2, 1, 0, { x: '-.5*Len', y: 'R' }),
      symbolicVec3(2, 1, 0, { x: '.5*Len', y: 'R' }),
    ),
    left: lineBoundary(
      'symbolic-coons-left',
      symbolicVec3(-2, 0, 0, { x: '-.5*Len' }),
      symbolicVec3(-2, 1, 0, { x: '-.5*Len', y: 'R' }),
    ),
    sampling: { uSegments: 4, vSegments: 3 },
  }
}

function coonsPatchWithClosedBottomAndMatchingCorners(): CoonsPatchPrimitive {
  const sharedBottomCorner = { x: 0, y: 0, z: 0 }
  const topLeft = { x: 0, y: 1, z: 0 }
  const topRight = { x: 1, y: 1, z: 0 }

  return {
    kind: 'coonsPatch',
    bottom: closedBoundary('coons-closed-bottom-matching', sharedBottomCorner),
    right: lineBoundary('coons-right-matching', sharedBottomCorner, topRight),
    top: lineBoundary('coons-top-matching', topLeft, topRight),
    left: lineBoundary('coons-left-matching', sharedBottomCorner, topLeft),
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

function constantBoundary(id: string, point: Vec3): CoonsBoundarySnapshot {
  return {
    kind: 'constantPoint',
    sourceId: id,
    name: id,
    point,
  }
}

function closedBoundary(id: string, start: Vec3): BoundaryPathSnapshot {
  const middle = {
    x: start.x + 0.5,
    y: start.y + 0.25,
    z: start.z,
  }

  return {
    id,
    segments: [lineSegment(start, middle), lineSegment(middle, start)],
  }
}

function coonsPatchBoundaryStart(role: CoonsPatchBoundaryRole): Vec3 {
  switch (role) {
    case 'bottom':
    case 'left':
      return { x: 0, y: 0, z: 0 }
    case 'right':
      return { x: 2, y: 0, z: 0 }
    case 'top':
      return { x: 0, y: 1, z: 0 }
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

function symbolicVec3(
  x: number,
  y: number,
  z: number,
  expressions: Partial<Record<'x' | 'y' | 'z', string>>,
): Vec3 {
  return {
    x,
    y,
    z,
    symbolic: {
      x:
        expressions.x === undefined
          ? { kind: 'numeric', value: x }
          : { kind: 'symbolic', expression: expressions.x, previewValue: x },
      y:
        expressions.y === undefined
          ? { kind: 'numeric', value: y }
          : { kind: 'symbolic', expression: expressions.y, previewValue: y },
      z:
        expressions.z === undefined
          ? { kind: 'numeric', value: z }
          : { kind: 'symbolic', expression: expressions.z, previewValue: z },
    },
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
