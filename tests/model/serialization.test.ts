import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import {
  sampleCoonsPatch,
  sampleRuledSurface,
} from '../../src/geometry/curvedSheets.ts'
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import {
  createCurveStratum,
  createCurvedSheetStratum,
  createEmptyDiagram,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import {
  applyUserStylePresetToStratum,
  addSymbolicVariableToDiagram,
  createCoordinateAnchor,
  coordinateReferenceSourceForPoint,
  createUserStylePresetFromStyle,
  coordinateReferenceVec3ForAnchorId,
  clonePathArrowOptions,
  defaultPathArrowOptions,
  pathCrossingStateFromCandidate,
  parseSavedDiagramJson,
  parseSavedDiagramJsonForImport,
  resolvePendingSymbolicDiagramImport,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
  validateDiagram,
  type PendingSymbolicDiagramImport,
} from '../../src/model/index.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import type {
  Camera3D,
  BoundaryPathSnapshot,
  ClosedPathBoundary,
  CoonsPatchPrimitive,
  CoordinateAnchorPosition,
  CrossingKind,
  Diagram,
  PerspectiveCamera3D,
  RuledSurfacePrimitive,
  Vec3,
  WorkPlane,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'

test('serializeDiagram includes format, version, and diagram data', () => {
  const serialized = serializeDiagram(twoDimensionalExample)
  const parsed = JSON.parse(serialized) as {
    format: unknown
    version: unknown
    diagram: {
      version?: unknown
      ambientDimension?: unknown
      camera?: unknown
      strata?: unknown
      labels?: unknown
    }
  }

  assert.equal(parsed.format, savedDiagramFormat)
  assert.equal(parsed.version, savedDiagramVersion)
  assert.equal(parsed.diagram.version, twoDimensionalExample.version)
  assert.equal(parsed.diagram.ambientDimension, twoDimensionalExample.ambientDimension)
  assert.equal('camera' in parsed.diagram, false)
  assert.deepEqual(parsed.diagram.strata, twoDimensionalExample.strata)
  assert.deepEqual(parsed.diagram.labels, twoDimensionalExample.labels)
})

test('old saved diagram without coordinate anchors loads with an empty anchor list', () => {
  const saved = JSON.parse(
    serializeDiagram(createEmptyDiagram({ ambientDimension: 2 })),
  ) as {
    diagram: {
      coordinateAnchors?: unknown
    }
  }

  delete saved.diagram.coordinateAnchors
  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.coordinateAnchors, [])
})

test('parseSavedDiagramJson rejects malformed global coordinate anchor positions without throwing', () => {
  const validComponent = savedNumericCoordinateComponent(0)
  const malformedCases: {
    name: string
    position: unknown
    expectedPath: RegExp
  }[] = [
    {
      name: 'empty global value',
      position: { kind: 'global', value: {} },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.x/,
    },
    {
      name: 'missing x',
      position: {
        kind: 'global',
        value: { y: validComponent, z: validComponent },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.x/,
    },
    {
      name: 'missing y',
      position: {
        kind: 'global',
        value: { x: validComponent, z: validComponent },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.y/,
    },
    {
      name: 'missing z',
      position: {
        kind: 'global',
        value: { x: validComponent, y: validComponent },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.z/,
    },
    {
      name: 'undefined x',
      position: {
        kind: 'global',
        value: { x: undefined, y: validComponent, z: validComponent },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.x/,
    },
    {
      name: 'malformed x component',
      position: {
        kind: 'global',
        value: { x: {}, y: validComponent, z: validComponent },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.x/,
    },
    {
      name: 'non-finite x component',
      position: {
        kind: 'global',
        value: {
          x: { kind: 'numeric', value: Number.POSITIVE_INFINITY },
          y: validComponent,
          z: validComponent,
        },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.x\.value/,
    },
    {
      name: 'unsupported symbolic component shape',
      position: {
        kind: 'global',
        value: {
          x: { kind: 'coordinateReference', coordinateName: 'A' },
          y: validComponent,
          z: validComponent,
        },
      },
      expectedPath: /coordinateAnchors\[0\]\.position\.value\.x\.kind/,
    },
  ]

  malformedCases.forEach(({ name, position, expectedPath }) => {
    const result = parseRawSavedDiagramWithoutThrow(
      savedDiagramWithRawCoordinateAnchor(position),
    )

    assert.equal(result.ok, false, name)
    if (result.ok) {
      throw new Error(`Expected ${name} to be rejected.`)
    }
    assert.match(result.error, expectedPath, name)
    assert.doesNotMatch(result.error, /Cannot read properties/, name)
  })
})

test('parseSavedDiagramJson loads valid symbolic and work-plane-local coordinate anchors', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.variables = [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
  ]
  diagram.coordinateAnchors = [
    {
      id: 'coord-symbolic',
      name: 'Symbolic',
      tikzName: 'S',
      position: {
        kind: 'global',
        value: {
          x: { kind: 'symbolic', expression: 'R + 1', previewValue: 99 },
          y: { kind: 'numeric', value: 0 },
          z: { kind: 'numeric', value: 0 },
        },
      },
    },
    {
      id: 'coord-local',
      name: 'Local',
      tikzName: 'L',
      position: workPlaneLocalAnchorPosition(),
    },
  ]

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const symbolicAnchor = result.diagram.coordinateAnchors?.[0]
  const localAnchor = result.diagram.coordinateAnchors?.[1]

  if (
    symbolicAnchor === undefined ||
    symbolicAnchor.position.kind !== 'global' ||
    symbolicAnchor.position.value.x.kind !== 'symbolic'
  ) {
    throw new Error('Expected symbolic global coordinate anchor to load.')
  }

  assert.equal(symbolicAnchor.position.value.x.previewValue, 3)
  assert.equal(localAnchor?.position.kind, 'workPlaneLocal')
})

test('parseSavedDiagramJson rejects coordinate anchors with forbidden layers', () => {
  const saved = savedDiagramWithRawCoordinateAnchor(globalAnchorPosition(0, 0, 0))

  if (!Array.isArray(saved.diagram.coordinateAnchors)) {
    throw new Error('Expected coordinate anchors fixture.')
  }

  const anchor = saved.diagram.coordinateAnchors[0]
  if (typeof anchor !== 'object' || anchor === null || Array.isArray(anchor)) {
    throw new Error('Expected coordinate anchor object fixture.')
  }
  const mutableAnchor = anchor as Record<string, unknown>
  mutableAnchor.layer = 2

  const result = parseRawSavedDiagramWithoutThrow(saved)

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected coordinate anchor layer to be rejected.')
  }
  assert.match(result.error, /coordinateAnchors\[0\]\.layer/)
})

test('coordinate anchor validation accepts valid anchors and rejects duplicate ids', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const anchor = createCoordinateAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })

  diagram.coordinateAnchors = [anchor]
  assert.equal(validateDiagram(diagram).valid, true)

  diagram.coordinateAnchors = [
    anchor,
    {
      ...anchor,
      name: 'B',
      tikzName: 'B',
    },
  ]

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.ok(
    validation.errors.some((issue) =>
      /Id must be unique/.test(issue.message),
    ),
  )
})

test('coordinate anchor TikZ names are generated safely and manual duplicates are rejected', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const first = createCoordinateAnchor(diagram, {
    id: 'coord-a',
    name: 'A',
    position: globalAnchorPosition(0, 0, 0),
  })
  const second = createCoordinateAnchor(
    { ...diagram, coordinateAnchors: [first] },
    {
      id: 'coord-b',
      name: 'A',
      position: globalAnchorPosition(1, 0, 0),
    },
  )

  assert.equal(first.tikzName, 'A')
  assert.equal(second.tikzName, 'A2')

  const duplicateDiagram = {
    ...diagram,
    coordinateAnchors: [
      first,
      {
        ...second,
        tikzName: 'A',
      },
    ],
  }
  const duplicateValidation = validateDiagram(duplicateDiagram)

  assert.equal(duplicateValidation.valid, false)
  assert.ok(
    duplicateValidation.errors.some(
      (issue) =>
        issue.path === 'coordinateAnchors[1].tikzName' &&
        /Id must be unique/.test(issue.message),
    ),
  )

  const invalidValidation = validateDiagram({
    ...diagram,
    coordinateAnchors: [
      {
        ...first,
        tikzName: '1bad',
      },
    ],
  })

  assert.equal(invalidValidation.valid, false)
  assert.ok(
    invalidValidation.errors.some(
      (issue) => issue.path === 'coordinateAnchors[0].tikzName',
    ),
  )
})

test('invalid loaded coordinate anchor TikZ names are sanitized deterministically', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.coordinateAnchors = [
    {
      id: 'coord-a',
      name: 'A',
      tikzName: '1 invalid',
      position: globalAnchorPosition(0, 0, 0),
    },
  ]
  const saved = JSON.parse(serializeDiagram(diagram)) as {
    diagram: Diagram
  }
  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.equal(result.diagram.coordinateAnchors?.[0]?.tikzName, 'coord1Invalid')
})

test('coordinate anchors validate global symbolic and work-plane-local positions', () => {
  const symbolicDiagram = createEmptyDiagram({ ambientDimension: 3 })
  symbolicDiagram.variables = [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
  ]
  symbolicDiagram.coordinateAnchors = [
    {
      id: 'coord-symbolic',
      name: 'Symbolic',
      tikzName: 'S',
      position: {
        kind: 'global',
        value: {
          x: { kind: 'symbolic', expression: 'R + 1', previewValue: 3 },
          y: { kind: 'numeric', value: 0 },
          z: { kind: 'numeric', value: 0 },
        },
      },
    },
    {
      id: 'coord-local',
      name: 'Local',
      tikzName: 'L',
      position: workPlaneLocalAnchorPosition(),
    },
  ]

  assert.equal(validateDiagram(symbolicDiagram).valid, true)
})

test('coordinate anchor save and load round-trip preserves anchors', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPosition(1, 2, 3),
      locked: true,
    }),
  ]

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.coordinateAnchors, diagram.coordinateAnchors)
})

test('parseSavedDiagramJson rejects dangling coordinate refs after anchor removal', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPosition(1, 2, 0),
    }),
  ]
  const referencePoint = coordinateReferenceVec3ForAnchorId(diagram, 'coord-a')

  if (referencePoint === null) {
    throw new Error('Expected coordinate reference point.')
  }

  diagram.strata = [
    createCurveStratum({
      ambientDimension: 2,
      id: 'ref-path',
      points: [referencePoint, { x: 3, y: 2, z: 0 }],
    }),
  ]

  const saved = JSON.parse(serializeDiagram(diagram)) as {
    diagram: {
      coordinateAnchors: unknown[]
    }
  }
  saved.diagram.coordinateAnchors = []
  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, false)
  if (parsed.ok) {
    throw new Error('Expected dangling coordinate ref to fail.')
  }
  assert.match(
    parsed.error,
    /Coordinate reference must point to an existing coordinate anchor/,
  )
})

test('parseSavedDiagramJson migrates work-plane filled-sheet frame coordinateRefs', () => {
  const diagram = legacyFilledSheetFrameReferenceDiagram('origin')
  const saved = JSON.stringify({
    format: savedDiagramFormat,
    version: savedDiagramVersion,
    diagram,
  })
  const parsed = parseSavedDiagramJson(saved)

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const sheet = requireWorkPlaneFilledSheet(parsed.diagram)
  const tikz = generateTikz(parsed.diagram)

  assert.equal(coordinateReferenceSourceForPoint(sheet.planeFrame.origin), null)
  assert.deepEqual(sheet.planeFrame.origin, { x: 1, y: 2, z: 3 })
  assert.equal(validateDiagram(parsed.diagram).valid, true)
  assert.match(tikz, /Work-plane filled sheet "Legacy Filled Sheet"/)
  assert.match(tikz, /\\filldraw\[/)
  assert.doesNotMatch(tikz, /coordinateRef is not supported/)
})

test('parseSavedDiagramJson migrates work-plane filled-sheet basis coordinateRefs', () => {
  const cases: Array<{
    field: keyof WorkPlaneFrameSnapshot
    expected: Vec3
  }> = [
    { field: 'u', expected: { x: 1, y: 0, z: 0 } },
    { field: 'v', expected: { x: 0, y: 1, z: 0 } },
    { field: 'normal', expected: { x: 0, y: 0, z: 1 } },
  ]

  cases.forEach(({ field, expected }) => {
    const diagram = legacyFilledSheetFrameReferenceDiagram(field)
    const parsed = parseSavedDiagramJson(
      JSON.stringify({
        format: savedDiagramFormat,
        version: savedDiagramVersion,
        diagram,
      }),
    )

    assert.equal(parsed.ok, true, field)
    if (!parsed.ok) {
      throw new Error(parsed.error)
    }

    const sheet = requireWorkPlaneFilledSheet(parsed.diagram)

    assert.equal(coordinateReferenceSourceForPoint(sheet.planeFrame[field]), null)
    assert.deepEqual(sheet.planeFrame[field], expected)
    assert.equal(validateDiagram(parsed.diagram).valid, true)
  })
})

test('parseSavedDiagramJson rejects missing frame coordinateRef anchors with a path', () => {
  const diagram = legacyFilledSheetFrameReferenceDiagram('origin')
  diagram.coordinateAnchors = []
  const parsed = parseSavedDiagramJson(
    JSON.stringify({
      format: savedDiagramFormat,
      version: savedDiagramVersion,
      diagram,
    }),
  )

  assert.equal(parsed.ok, false)
  if (parsed.ok) {
    throw new Error('Expected missing frame coordinateRef anchor to fail.')
  }
  assert.match(parsed.error, /strata\[0\]\.planeFrame\.origin/)
  assert.match(parsed.error, /coordinate anchor does not exist/)
})

test('validateDiagram still rejects work-plane filled-sheet frame coordinateRefs', () => {
  const diagram = legacyFilledSheetFrameReferenceDiagram('origin')
  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.ok(
    validation.errors.some(
      (issue) =>
        issue.path === 'strata[0].planeFrame.origin.symbolic.source' &&
        /coordinateRef is not supported at strata\[0\]\.planeFrame\.origin/.test(
          issue.message,
        ),
    ),
  )
})

test('serializeDiagram writes 3D camera as view metadata', () => {
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 1.75,
    pan: { x: 4, y: -3 },
  }
  const serialized = serializeDiagram(threeDimensionalExample, {
    camera3d: camera,
    showCoordinateAxesInTikz: true,
  })
  const parsed = JSON.parse(serialized) as {
    diagram: {
      camera?: unknown
      view?: {
        camera3d?: unknown
        showCoordinateAxesInTikz?: unknown
      }
    }
  }

  assert.equal('camera' in parsed.diagram, false)
  assert.deepEqual(parsed.diagram.view?.camera3d, camera)
  assert.equal(parsed.diagram.view?.showCoordinateAxesInTikz, true)
})

test('serializeDiagram can persist TikZ export mode as view metadata', () => {
  const serialized = serializeDiagram(twoDimensionalExample, {
    exportMode: 'inlineMath',
  })
  const parsed = JSON.parse(serialized) as {
    diagram: {
      view?: {
        exportMode?: unknown
      }
    }
  }

  assert.equal(parsed.diagram.view?.exportMode, 'inlineMath')
})

test('parseSavedDiagramJson loads saved TikZ export mode metadata', () => {
  const result = parseSavedDiagramJson(
    serializeDiagram(twoDimensionalExample, { exportMode: 'inlineMath' }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.view?.exportMode, 'inlineMath')
})

test('visibility options save and load round-trip as view metadata', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.view = {
    ...diagram.view,
    visibility: {
      enabled: true,
      surfaceDepthSort: true,
      curveOcclusion: true,
      pointVisibility: 'hideHidden',
      labelVisibility: 'autoDim',
      sortMode: 'layerThenDepth',
      depthEpsilon: 0.000001,
      maxSurfaceFacesForSorting: 96,
      maxCurveSamples: 128,
      hiddenCurveStyle: {
        lineStyle: 'dashed',
        opacity: 0.35,
      },
    },
  }
  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram.view?.visibility, diagram.view.visibility)
})

test('visibility options without hidden curve style load with defaults', () => {
  const serialized = serializeDiagram(threeDimensionalExample, {
    visibility: {
      enabled: true,
      surfaceDepthSort: true,
      curveOcclusion: true,
      pointVisibility: 'dimHidden',
      labelVisibility: 'alwaysForeground',
      sortMode: 'layerThenDepth',
      depthEpsilon: 0.000001,
    },
  })
  const saved = JSON.parse(serialized) as {
    diagram: {
      view?: {
        visibility?: {
          hiddenCurveStyle?: unknown
        }
      }
    }
  }

  delete saved.diagram.view?.visibility?.hiddenCurveStyle
  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram.view?.visibility?.hiddenCurveStyle, {
    lineStyle: 'denselyDotted',
    opacity: 0.45,
  })
  assert.equal(
    result.diagram.view?.visibility?.maxSurfaceFacesForSorting,
    256,
  )
  assert.equal(result.diagram.view?.visibility?.maxCurveSamples, 512)
})

test('old visibility options without point and label policies load with defaults', () => {
  const serialized = serializeDiagram(threeDimensionalExample, {
    visibility: {
      enabled: true,
      surfaceDepthSort: true,
      curveOcclusion: true,
      pointVisibility: 'hideHidden',
      labelVisibility: 'autoHide',
      sortMode: 'layerThenDepth',
      depthEpsilon: 0.000001,
      hiddenCurveStyle: {
        lineStyle: 'dashed',
        opacity: 0.35,
      },
    },
  })
  const saved = JSON.parse(serialized) as {
    diagram: {
      view?: {
        visibility?: {
          curveOcclusion?: unknown
          pointVisibility?: unknown
          labelVisibility?: unknown
        }
      }
    }
  }

  delete saved.diagram.view?.visibility?.curveOcclusion
  delete saved.diagram.view?.visibility?.pointVisibility
  delete saved.diagram.view?.visibility?.labelVisibility
  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.view?.visibility?.curveOcclusion, true)
  assert.equal(result.diagram.view?.visibility?.pointVisibility, 'dimHidden')
  assert.equal(
    result.diagram.view?.visibility?.labelVisibility,
    'alwaysForeground',
  )
  assert.equal(
    result.diagram.view?.visibility?.maxSurfaceFacesForSorting,
    256,
  )
  assert.equal(result.diagram.view?.visibility?.maxCurveSamples, 512)
})

test('old visibility options without performance caps load with defaults', () => {
  const serialized = serializeDiagram(threeDimensionalExample, {
    visibility: {
      enabled: true,
      surfaceDepthSort: true,
      curveOcclusion: true,
      pointVisibility: 'dimHidden',
      labelVisibility: 'alwaysForeground',
      sortMode: 'layerThenDepth',
      depthEpsilon: 0.000001,
      hiddenCurveStyle: {
        lineStyle: 'dashed',
        opacity: 0.35,
      },
    },
  })
  const saved = JSON.parse(serialized) as {
    diagram: {
      view?: {
        visibility?: {
          maxSurfaceFacesForSorting?: unknown
          maxCurveSamples?: unknown
        }
      }
    }
  }

  delete saved.diagram.view?.visibility?.maxSurfaceFacesForSorting
  delete saved.diagram.view?.visibility?.maxCurveSamples
  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(
    result.diagram.view?.visibility?.maxSurfaceFacesForSorting,
    256,
  )
  assert.equal(result.diagram.view?.visibility?.maxCurveSamples, 512)
})

test('oversized saved visibility caps are clamped on load', () => {
  const serialized = serializeDiagram(threeDimensionalExample, {
    visibility: {
      enabled: true,
      surfaceDepthSort: true,
      curveOcclusion: true,
      pointVisibility: 'dimHidden',
      labelVisibility: 'alwaysForeground',
      sortMode: 'layerThenDepth',
      depthEpsilon: 0.000001,
      maxSurfaceFacesForSorting: 99999,
      maxCurveSamples: 99999,
      hiddenCurveStyle: {
        lineStyle: 'dashed',
        opacity: 0.35,
      },
    },
  })
  const result = parseSavedDiagramJson(serialized)

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(
    result.diagram.view?.visibility?.maxSurfaceFacesForSorting,
    2048,
  )
  assert.equal(result.diagram.view?.visibility?.maxCurveSamples, 2048)
})

test('boundary surfaces and visibility options save and load round-trip', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.view = {
    ...diagram.view,
    visibility: {
      enabled: true,
      surfaceDepthSort: true,
      curveOcclusion: true,
      pointVisibility: 'dimHidden',
      labelVisibility: 'autoDim',
      sortMode: 'depthThenLayer',
      depthEpsilon: 0.00001,
      maxSurfaceFacesForSorting: 64,
      maxCurveSamples: 96,
      hiddenCurveStyle: {
        lineStyle: 'dotted',
        opacity: 0.5,
      },
    },
  }
  diagram.strata.push(
    createCurvedSheetStratum({
      id: 'saved-ruled-surface',
      name: 'Saved ruled surface',
      primitive: {
        kind: 'ruledSurface',
        boundary0: lineBoundarySnapshot(
          'saved-ruled-bottom',
          { x: -1, y: 0, z: -1 },
          { x: 1, y: 0, z: -1 },
        ),
        boundary1: lineBoundarySnapshot(
          'saved-ruled-top',
          { x: -1, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
        ),
        sampling: { segments: 4 },
      },
      layer: 0,
    }),
    createCurvedSheetStratum({
      id: 'saved-coons-patch',
      name: 'Saved Coons patch',
      primitive: {
        kind: 'coonsPatch',
        bottom: lineBoundarySnapshot(
          'saved-coons-bottom',
          { x: -1, y: -1, z: 0 },
          { x: 1, y: -1, z: 0.2 },
        ),
        right: lineBoundarySnapshot(
          'saved-coons-right',
          { x: 1, y: -1, z: 0.2 },
          { x: 1, y: 1, z: -0.2 },
        ),
        top: lineBoundarySnapshot(
          'saved-coons-top',
          { x: -1, y: 1, z: 0.35 },
          { x: 1, y: 1, z: -0.2 },
        ),
        left: lineBoundarySnapshot(
          'saved-coons-left',
          { x: -1, y: -1, z: 0 },
          { x: -1, y: 1, z: 0.35 },
        ),
        sampling: { uSegments: 4, vSegments: 3 },
      },
      layer: 1,
    }),
  )

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram.view?.visibility, diagram.view.visibility)
  assert.deepEqual(result.diagram.strata, diagram.strata)
})

test('invalid saved visibility options are ignored with a warning', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: {
      view: {
        visibility?: unknown
      }
    }
  }
  saved.diagram.view.visibility = {
    enabled: true,
    surfaceDepthSort: true,
    sortMode: 'unknown',
    depthEpsilon: 0.001,
  }
  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.view?.visibility, undefined)
  assert.match(result.warnings.join(' '), /visibility options are invalid/)
})

test('variables save and load round-trip', () => {
  const withR = addSymbolicVariableToDiagram(
    createEmptyDiagram({ ambientDimension: 2 }),
    {
      id: 'var-R',
      name: 'R',
      expression: '2',
    },
  )

  assert.equal(withR.ok, true)
  if (!withR.ok) {
    throw new Error(withR.error)
  }

  const withSmallR = addSymbolicVariableToDiagram(withR.diagram, {
    id: 'var-r',
    name: 'r',
    expression: 'R/2',
  })

  assert.equal(withSmallR.ok, true)
  if (!withSmallR.ok) {
    throw new Error(withSmallR.error)
  }

  const result = parseSavedDiagramJson(serializeDiagram(withSmallR.diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram.variables, withSmallR.diagram.variables)
})

test('old diagrams without variables still load', () => {
  const saved = JSON.parse(serializeDiagram(twoDimensionalExample)) as {
    diagram: {
      variables?: unknown
    }
  }
  delete saved.diagram.variables

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.variables, undefined)
})

test('parseSavedDiagramJson rejects a saved variable with reserved implicit macro name', () => {
  const result = parseSavedDiagramJson(
    savedDiagramTextWithVariables([
      {
        id: 'var-draw',
        name: 'draw',
        expression: '2',
        previewValue: 2,
      },
    ]),
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected reserved implicit variable macro name to fail.')
  }
  assert.match(result.error, /variables\[0\]\.name .*reserved/)
})

test('parseSavedDiagramJson rejects a saved variable with reserved explicit macro name', () => {
  const result = parseSavedDiagramJson(
    savedDiagramTextWithVariables([
      {
        id: 'var-radius',
        name: 'radius',
        macroName: 'draw',
        expression: '2',
        previewValue: 2,
      },
    ]),
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected reserved explicit variable macro name to fail.')
  }
  assert.match(result.error, /variables\[0\]\.macroName .*reserved/)
})

test('serializeDiagram omits deprecated 3D projectionBasis metadata', () => {
  const camera: Camera3D = {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 41,
    phiDeg: -82,
    zoom: 1.5,
    pan: { x: 7, y: -4 },
    projectionBasis: {
      xVector: [1, 0],
      yVector: [0.5, 0.25],
      zVector: [0, 1],
    },
  }
  const serialized = serializeDiagram(threeDimensionalExample, {
    camera3d: camera,
  })
  const parsed = JSON.parse(serialized) as {
    diagram: {
      view?: {
        camera3d?: Camera3D
      }
    }
  }

  assert.deepEqual(parsed.diagram.view?.camera3d, {
    mode: '3d',
    kind: 'orthographic',
    thetaDeg: 41,
    phiDeg: -82,
    zoom: 1.5,
    pan: { x: 7, y: -4 },
  })
})

test('parseSavedDiagramJson returns a valid saved diagram', () => {
  const result = parseSavedDiagramJson(serializeDiagram(threeDimensionalExample))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram, ensureLayerMetadata(threeDimensionalExample))
})

test('user style presets save and load with element references', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'wire',
    name: 'Wire',
    style: {
      kind: 'curveStyle',
      strokeColor: '#CC0033',
      strokeOpacity: 0.75,
      lineWidth: 1.8,
      lineStyle: 'dashed',
    },
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Reusable wire',
    diagram.strata[0].style,
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    'wire',
    created?.preset.id ?? '',
  )
  const result = parseSavedDiagramJson(serializeDiagram(withPreset))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram.userStylePresets, withPreset.userStylePresets)
  assert.equal(result.diagram.strata[0]?.stylePresetId, created?.preset.id)
})

test('external TikZ style source metadata save and load round-trips', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.externalTikzStyleSources = [
    {
      id: 'source-mygeometry',
      name: 'mygeometry.sty',
      loadHint: '\\input{mygeometry.sty}',
    },
  ]

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(
    result.diagram.externalTikzStyleSources,
    diagram.externalTikzStyleSources,
  )
})

test('imported TikZ style key save and load round-trips', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.externalTikzStyleSources = [
    {
      id: 'source-mygeometry',
      name: 'mygeometry.sty',
      loadHint: '\\input{mygeometry.sty}',
    },
  ]
  diagram.importedTikzStyleReferences = [
    {
      id: 'external-draw',
      key: '3cat/phys/1strata/color/x',
      sourceId: 'source-mygeometry',
      displayName: 'Wire x',
      targets: ['draw', 'curve'],
    },
  ]

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(
    result.diagram.importedTikzStyleReferences,
    diagram.importedTikzStyleReferences,
  )
})

test('parseSavedDiagramJson rejects a blank imported TikZ style key', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.externalTikzStyleSources = [
    {
      id: 'source-mygeometry',
      name: 'mygeometry.sty',
      loadHint: '\\input{mygeometry.sty}',
    },
  ]
  diagram.importedTikzStyleReferences = [
    {
      id: 'blank-key',
      key: '   ',
      sourceId: 'source-mygeometry',
      displayName: 'Blank',
      targets: ['draw'],
    },
  ]

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected blank imported style key to be rejected.')
  }
  assert.match(result.error, /importedTikzStyleReferences\[0\]\.key must be non-empty/)
})

test('old diagrams without user style presets still load', () => {
  const saved = JSON.parse(serializeDiagram(twoDimensionalExample)) as {
    diagram: {
      userStylePresets?: unknown
      externalTikzStyleSources?: unknown
      importedTikzStyleReferences?: unknown
    }
  }
  delete saved.diagram.userStylePresets
  delete saved.diagram.externalTikzStyleSources
  delete saved.diagram.importedTikzStyleReferences

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.userStylePresets, undefined)
  assert.equal(result.diagram.externalTikzStyleSources, undefined)
  assert.equal(result.diagram.importedTikzStyleReferences, undefined)
})

test('old saved diagrams without TikZ export mode still load as standalone', () => {
  const saved = JSON.parse(
    serializeDiagram(twoDimensionalExample, { exportMode: 'inlineMath' }),
  ) as {
    diagram: {
      view?: {
        exportMode?: unknown
      }
    }
  }

  if (saved.diagram.view !== undefined) {
    delete saved.diagram.view.exportMode
  }

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.view?.exportMode ?? 'standalone', 'standalone')
})

test('parseSavedDiagramJson rejects duplicate user style preset ids', () => {
  const created = createUserStylePresetFromStyle(
    createEmptyDiagram({ ambientDimension: 2 }),
    'curve',
    'Duplicate',
    {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
  )
  const saved = JSON.parse(
    serializeDiagram(created?.diagram ?? createEmptyDiagram({ ambientDimension: 2 })),
  ) as {
    diagram: {
      userStylePresets: unknown[]
    }
  }

  saved.diagram.userStylePresets.push(saved.diagram.userStylePresets[0])

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected duplicate preset ids to be rejected.')
  }
  assert.match(result.error, /duplicates an earlier preset id/)
})

test('parseSavedDiagramJson migrates legacy 3D projected-basis cameras', () => {
  const legacyProjectionBasis = {
    xVector: [1, 0] as [number, number],
    yVector: [0.45, 0.25] as [number, number],
    zVector: [0, 1] as [number, number],
  }
  const savedDiagram = JSON.parse(JSON.stringify(threeDimensionalExample)) as {
    camera?: unknown
    view?: unknown
  }
  delete savedDiagram.view
  savedDiagram.camera = {
    mode: '3d',
    projection: 'orthographic',
    ...legacyProjectionBasis,
    scale: 2,
    origin: { x: 30, y: 40 },
  }
  const saved = {
    format: savedDiagramFormat,
    version: savedDiagramVersion,
    diagram: savedDiagram,
  }

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal(result.diagram.camera.mode, '3d')
  if (result.diagram.camera.mode !== '3d') {
    throw new Error('Expected migrated 3D camera.')
  }
  assert.equal(result.diagram.camera.kind, 'orthographic')
  assert.equal(result.diagram.camera.zoom, 2)
  assert.deepEqual(result.diagram.camera.pan, { x: 30, y: 40 })
  assert.equal(result.diagram.camera.projectionBasis, undefined)
  assert.deepEqual(result.diagram.view?.camera3d, result.diagram.camera)
})

test('parseSavedDiagramJson drops deprecated 3D projectionBasis metadata', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: {
      view: {
        camera3d: Camera3D & {
          projectionBasis?: {
            xVector: [number, number]
            yVector: [number, number]
            zVector: [number, number]
          }
        }
      }
    }
  }
  saved.diagram.view.camera3d = {
    ...saved.diagram.view.camera3d,
    thetaDeg: 41,
    phiDeg: -82,
    projectionBasis: {
      xVector: [1, 0],
      yVector: [0.5, 0.25],
      zVector: [0, 1],
    },
  }

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.equal(result.diagram.camera.mode, '3d')
  if (result.diagram.camera.mode !== '3d') {
    throw new Error('Expected 3D camera.')
  }
  assert.equal(result.diagram.camera.thetaDeg, 41)
  assert.equal(result.diagram.camera.phiDeg, -82)
  assert.equal(result.diagram.camera.projectionBasis, undefined)
  assert.deepEqual(result.diagram.view?.camera3d, result.diagram.camera)
})

test('parseSavedDiagramJson defaults a missing 3D camera to initial view metadata', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: {
      camera?: unknown
      view?: unknown
    }
  }
  delete saved.diagram.camera
  delete saved.diagram.view

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.camera, createInitialCamera3D())
  assert.deepEqual(result.diagram.view?.camera3d, createInitialCamera3D())
  assert.deepEqual(result.warnings, [])
})

test('parseSavedDiagramJson falls back safely for invalid 3D camera metadata', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: {
      view: {
        camera3d: {
          zoom: unknown
        }
      }
    }
  }
  saved.diagram.view.camera3d.zoom = 0

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.camera, createInitialCamera3D())
  assert.deepEqual(result.diagram.view?.camera3d, createInitialCamera3D())
  assert.match(result.warnings.join(' '), /camera metadata is invalid/)
})

test('parseSavedDiagramJson rejects unsupported perspective camera metadata', () => {
  const perspectiveCamera: PerspectiveCamera3D = {
    mode: '3d',
    kind: 'perspective',
    thetaDeg: 13,
    phiDeg: -23,
    zoom: 1,
    pan: { x: 0, y: 0 },
    target: { x: 0, y: 0, z: 0 },
    distance: 8,
    fieldOfViewDeg: 45,
  }
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: {
      view: {
        camera3d: Camera3D
      }
    }
  }
  saved.diagram.view.camera3d = perspectiveCamera

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.camera, createInitialCamera3D())
  assert.deepEqual(result.diagram.view?.camera3d, createInitialCamera3D())
  assert.match(result.warnings.join(' '), /perspective 3D camera metadata is unsupported/)
})

function savedDiagramTextWithVariables(variables: unknown[]): string {
  const saved = JSON.parse(
    serializeDiagram(createEmptyDiagram({ ambientDimension: 2 })),
  ) as {
    diagram: {
      variables?: unknown[]
    }
  }
  saved.diagram.variables = variables

  return JSON.stringify(saved)
}

test('parseSavedDiagramJson rejects malformed JSON', () => {
  const result = parseSavedDiagramJson('{not json')

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected malformed JSON to fail.')
  }
  assert.match(result.error, /valid JSON/)
})

test('parseSavedDiagramJson rejects the wrong format', () => {
  const result = parseSavedDiagramJson(
    JSON.stringify({
      format: 'other-format',
      version: savedDiagramVersion,
      diagram: twoDimensionalExample,
    }),
  )

  assert.equal(result.ok, false)
})

test('parseSavedDiagramJson rejects unsupported versions', () => {
  const result = parseSavedDiagramJson(
    JSON.stringify({
      format: savedDiagramFormat,
      version: savedDiagramVersion + 1,
      diagram: twoDimensionalExample,
    }),
  )

  assert.equal(result.ok, false)
})

test('parseSavedDiagramJson rejects missing diagrams', () => {
  const result = parseSavedDiagramJson(
    JSON.stringify({
      format: savedDiagramFormat,
      version: savedDiagramVersion,
    }),
  )

  assert.equal(result.ok, false)
})

test('parseSavedDiagramJson rejects invalid diagram data', () => {
  const invalidDiagram: Diagram = {
    ...twoDimensionalExample,
    strata: [
      {
        ...twoDimensionalExample.strata[0],
        name: '',
      },
    ],
  }
  const result = parseSavedDiagramJson(serializeDiagram(invalidDiagram))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid diagram to fail.')
  }
  assert.match(result.error, /Name must be non-empty/)
})

test('parseSavedDiagramJson rejects non-finite coordinates through validation', () => {
  const saved = JSON.parse(serializeDiagram(twoDimensionalExample)) as {
    diagram: {
      labels: Array<{
        position: {
          x: unknown
        }
      }>
    }
  }
  saved.diagram.labels[0].position.x = null

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid coordinate to fail.')
  }
  assert.match(result.error, /finite number/)
})

test('diagram serialization round trips without changing diagram data', () => {
  const result = parseSavedDiagramJson(serializeDiagram(threeDimensionalExample))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram, ensureLayerMetadata(threeDimensionalExample))
})

test('diagram serialization preserves optional path labels', () => {
  const diagramWithPathLabel: Diagram = {
    ...twoDimensionalExample,
    strata: twoDimensionalExample.strata.map((stratum) =>
      stratum.geometricKind === 'curve'
        ? { ...stratum, pathLabel: 'wire path' }
        : stratum,
    ),
  }

  const result = parseSavedDiagramJson(serializeDiagram(diagramWithPathLabel))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.diagram,
    ensureLayerMetadataAndPathArrowDefaults(diagramWithPathLabel),
  )
})

test('parseSavedDiagramJson accepts missing optional path labels', () => {
  const result = parseSavedDiagramJson(serializeDiagram(twoDimensionalExample))

  assert.equal(result.ok, true)
})

test('parseSavedDiagramJson strips editor-only active work-plane state before round-trip', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: Diagram & {
      activeWorkPlane?: WorkPlane
    }
  }
  saved.diagram.activeWorkPlane = {
    kind: 'custom',
    id: 'loaded-editor-only-plane',
    name: 'Loaded editor-only plane',
    origin: { x: 1, y: 2, z: 3 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: {
      kind: 'existingPointStrata',
      pointIds: ['p0', 'p1', 'p2'],
    },
  }

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.equal('activeWorkPlane' in result.diagram, false)
  assert.equal(serializeDiagram(result.diagram).includes('activeWorkPlane'), false)
  assert.equal(
    serializeDiagram(result.diagram).includes('loaded-editor-only-plane'),
    false,
  )
})

test('parseSavedDiagramJson accepts cubic Bezier curves without control metadata as absolute', () => {
  const result = parseSavedDiagramJson(serializeDiagram(twoDimensionalExample))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const cubicBezier = result.diagram.strata.find(
    (stratum) =>
      stratum.geometricKind === 'curve' && stratum.kind === 'cubicBezier',
  )

  assert.equal(cubicBezier?.bezierControls, undefined)
})

test('diagram serialization round trips relative Bezier control metadata', () => {
  const diagramWithRelativeBezier: Diagram = {
    ...twoDimensionalExample,
    strata: [
      ...twoDimensionalExample.strata,
      {
        codim: 1,
        geometricKind: 'curve',
        kind: 'cubicBezier',
        id: 'relative-round-trip',
        name: 'Relative round trip',
        style: {
          kind: 'curveStyle',
          strokeColor: '#000000',
          strokeOpacity: 1,
          lineWidth: 1.2,
          lineStyle: 'solid',
        },
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 2, z: 0 },
          { x: 7, y: 14, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
        bezierControls: {
          kind: 'relativeCartesian',
          firstControlOffset: { x: 1, y: 2, z: 0 },
          secondControlOffset: { x: -3, y: 4, z: 0 },
          secondOffsetReference: 'end',
        },
        styleSegments: [],
        layer: 3,
      },
    ],
  }

  const result = parseSavedDiagramJson(serializeDiagram(diagramWithRelativeBezier))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.diagram,
    ensureLayerMetadataAndPathArrowDefaults(diagramWithRelativeBezier),
  )
})

test('diagram serialization round trips work-plane-local Bezier control metadata', () => {
  const diagramWithLocalBezier: Diagram = {
    ...threeDimensionalExample,
    strata: [
      ...threeDimensionalExample.strata,
      {
        codim: 2,
        geometricKind: 'curve',
        kind: 'cubicBezier',
        id: 'local-relative-round-trip',
        name: 'Local relative round trip',
        style: {
          kind: 'curveStyle',
          strokeColor: '#000000',
          strokeOpacity: 1,
          lineWidth: 1.2,
          lineStyle: 'solid',
        },
        points: [
          { x: 12, y: 20, z: 33 },
          { x: 14, y: 20, z: 32 },
          { x: 13, y: 20, z: 41 },
          { x: 16, y: 20, z: 37 },
        ],
        bezierControls: {
          kind: 'workPlaneRelativeCartesian',
          frame: localBezierFrame,
          localStart: { a: 2, b: 3 },
          localEnd: { a: 6, b: 7 },
          firstControlOffset: { dx: 2, dy: -1 },
          secondControlOffset: { dx: -3, dy: 4 },
          secondOffsetReference: 'end',
        },
        styleSegments: [],
        layer: 3,
      },
    ],
  }

  const result = parseSavedDiagramJson(serializeDiagram(diagramWithLocalBezier))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.diagram,
    ensureLayerMetadataAndPathArrowDefaults(diagramWithLocalBezier),
  )
})

test('parseSavedDiagramJson rejects invalid relative Bezier metadata', () => {
  const saved = JSON.parse(serializeDiagram(twoDimensionalExample)) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'invalid-relative-polar',
    name: 'Invalid relative polar',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    points: [
      { x: 0, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 2, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    bezierControls: {
      kind: 'relativePolar',
      firstControl: { angleDegrees: 0, radius: -1 },
      secondControl: { angleDegrees: 90, radius: 1 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid relative Bezier metadata to fail.')
  }
  assert.match(result.error, /radius/)
})

test('parseSavedDiagramJson rejects invalid work-plane-local Bezier metadata', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'invalid-local-relative',
    name: 'Invalid local relative',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    points: [
      { x: 12, y: 20, z: 33 },
      { x: 14, y: 20, z: 32 },
      { x: 13, y: 20, z: 41 },
      { x: 16, y: 20, z: 37 },
    ],
    bezierControls: {
      kind: 'workPlaneRelativeCartesian',
      frame: {
        ...localBezierFrame,
        u: { x: 2, y: 0, z: 0 },
      },
      localStart: { a: 2, b: 3 },
      localEnd: { a: 6, b: 7 },
      firstControlOffset: { dx: 2, dy: -1 },
      secondControlOffset: { dx: -3, dy: 4 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid local relative Bezier metadata to fail.')
  }
  assert.match(result.error, /frame/)
})

test('parseSavedDiagramJson rejects inconsistent work-plane-local Bezier endpoint metadata', () => {
  const saved = JSON.parse(serializeDiagram(threeDimensionalExample)) as {
    diagram: Diagram
  }
  saved.diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'invalid-local-endpoint',
    name: 'Invalid local endpoint',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    points: [
      { x: 12, y: 20, z: 33 },
      { x: 14, y: 20, z: 32 },
      { x: 13, y: 20, z: 41 },
      { x: 16, y: 20, z: 37 },
    ],
    bezierControls: {
      kind: 'workPlaneRelativeCartesian',
      frame: localBezierFrame,
      localStart: { a: 99, b: 3 },
      localEnd: { a: 6, b: 7 },
      firstControlOffset: { dx: 2, dy: -1 },
      secondControlOffset: { dx: -3, dy: 4 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected inconsistent endpoint metadata to fail.')
  }
  assert.match(result.error, /localStart/)
})

test('parseSavedDiagramJson rejects non-string path labels', () => {
  const saved = JSON.parse(serializeDiagram(twoDimensionalExample)) as {
    diagram: {
      strata: Array<{
        pathLabel?: unknown
      }>
    }
  }
  saved.diagram.strata[0].pathLabel = 123

  const result = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected invalid path label to fail.')
  }
  assert.match(result.error, /Path label must be a string/)
})

test('parseSavedDiagramJsonForImport detects symbolic Coons boundaries with saved variables', () => {
  const result = parseSavedDiagramJsonForImport(
    serializeDiagram(symbolicCoonsDiagram()),
  )

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'needsVariableResolution') {
    throw new Error('Expected symbolic Coons import to need variable resolution.')
  }

  assert.deepEqual(
    result.pendingImport.variables.map((variable) => ({
      name: variable.name,
      expression: variable.expression,
      defined: variable.defined,
    })),
    [
      { name: 'Len', expression: '4', defined: true },
      { name: 'R', expression: '1', defined: true },
    ],
  )
})

test('parseSavedDiagramJsonForImport asks for missing symbolic boundary variables', () => {
  const diagram = symbolicCoonsDiagram()
  delete diagram.variables

  const result = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'needsVariableResolution') {
    throw new Error('Expected missing variable import to need resolution.')
  }

  assert.deepEqual(
    result.pendingImport.variables.map((variable) => ({
      name: variable.name,
      expression: variable.expression,
      defined: variable.defined,
    })),
    [
      { name: 'Len', expression: '', defined: false },
      { name: 'R', expression: '', defined: false },
    ],
  )
})

test('parseSavedDiagramJsonForImport detects variables in boundary frame coordinates', () => {
  const diagram = symbolicCoonsFrameDiagram()
  delete diagram.variables

  const result = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'needsVariableResolution') {
    throw new Error('Expected frame variable import to need resolution.')
  }

  assert.deepEqual(
    result.pendingImport.variables.map((variable) => ({
      name: variable.name,
      expression: variable.expression,
      defined: variable.defined,
    })),
    [{ name: 'Len', expression: '', defined: false }],
  )
})

test('parseSavedDiagramJsonForImport does not treat function names as variables', () => {
  const diagram = symbolicCoonsDiagram()
  diagram.variables = [
    ...(diagram.variables ?? []),
    {
      id: 'var-q',
      name: 'q',
      macroName: 'q',
      expression: '0',
      previewValue: 0,
    },
  ]
  const sheet = diagram.strata[0]
  if (sheet?.kind !== 'curvedSheet' || sheet.primitive.kind !== 'coonsPatch') {
    throw new Error('Expected symbolic Coons fixture.')
  }
  const bottom = coonsPathBoundary(sheet.primitive.bottom)
  bottom.segments[0].end = symbolicPoint(
    1,
    0,
    0,
    { x: 'R*cos(q)' },
  )

  const result = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'needsVariableResolution') {
    throw new Error('Expected symbolic import to need resolution.')
  }

  assert.deepEqual(
    result.pendingImport.variables.map((variable) => variable.name),
    ['Len', 'R', 'q'],
  )
})

test('parseSavedDiagramJsonForImport loads numeric-only diagrams immediately', () => {
  const result = parseSavedDiagramJsonForImport(serializeDiagram(twoDimensionalExample))

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'ready') {
    throw new Error('Expected numeric diagram to be ready.')
  }

  assert.deepEqual(
    result.diagram,
    ensureLayerMetadataAndPathArrowDefaults(twoDimensionalExample),
  )
})

test('parseSavedDiagramJson refreshes valid symbolic Coons boundaries with saved variables', () => {
  const diagram = symbolicCoonsDiagram()
  const primitive = resolvedCoonsPrimitive(diagram)

  coonsPathBoundary(primitive.bottom).segments[0].end.x = -99

  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const resolvedPrimitive = resolvedCoonsPrimitive(result.diagram)

  assert.equal(coonsPathBoundary(resolvedPrimitive.bottom).segments[0].end.x, 2)
  assert.equal(
    sampleCoonsPatch(resolvedPrimitive).vertices.every(isFinitePoint),
    true,
  )
})

test('resolvePendingSymbolicDiagramImport refreshes symbolic Coons previews', () => {
  const pending = pendingImportForDiagram(symbolicCoonsDiagram())
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '4' },
    { name: 'R', expression: '1' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const primitive = resolvedCoonsPrimitive(resolved.diagram)
  assert.equal(coonsPathBoundary(primitive.bottom).segments[0].start.x, -2)
  assert.equal(coonsPathBoundary(primitive.bottom).segments[0].end.x, 2)
  assert.equal(coonsPathBoundary(primitive.right).segments[0].end.y, 1)
  assert.equal(
    coonsPathBoundary(primitive.bottom).segments[0].end.symbolic?.x.previewValue,
    2,
  )
})

test('resolvePendingSymbolicDiagramImport uses edited import values before validation', () => {
  const pending = pendingImportForDiagram(symbolicCoonsDiagram())
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '6' },
    { name: 'R', expression: '1' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const primitive = resolvedCoonsPrimitive(resolved.diagram)
  assert.equal(coonsPathBoundary(primitive.bottom).segments[0].start.x, -3)
  assert.equal(coonsPathBoundary(primitive.bottom).segments[0].end.x, 3)
})

test('resolvePendingSymbolicDiagramImport reconciles stale path crossing parameters', () => {
  const pending = pendingImportForDiagram(symbolicPathCrossingDiagram('none'))
  const staleCrossing = pending.diagram.pathCrossings?.[0]
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '4' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const currentCandidate = onlyPathIntersectionCandidate(resolved.diagram)

  assert.equal(currentCandidate.parameterA, 0.25)
  assert.notEqual(staleCrossing?.id, currentCandidate.id)
  assert.equal(resolved.diagram.pathCrossings?.length, 1)
  assert.equal(resolved.diagram.pathCrossings?.[0]?.id, currentCandidate.id)
  assert.equal(resolved.diagram.pathCrossings?.[0]?.kind, 'none')
})

test('resolvePendingSymbolicDiagramImport preserves braiding kind when rebinding a stale crossing', () => {
  const resolved = resolvePendingSymbolicDiagramImport(
    pendingImportForDiagram(symbolicPathCrossingDiagram('braiding')),
    [{ name: 'Len', expression: '4' }],
  )

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const currentCandidate = onlyPathIntersectionCandidate(resolved.diagram)

  assert.equal(resolved.diagram.pathCrossings?.length, 1)
  assert.equal(resolved.diagram.pathCrossings?.[0]?.id, currentCandidate.id)
  assert.equal(resolved.diagram.pathCrossings?.[0]?.kind, 'braiding')
})

test('resolvePendingSymbolicDiagramImport refreshes symbolic ruled previews', () => {
  const pending = pendingImportForDiagram(symbolicRuledDiagram())
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '6' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const primitive = resolvedRuledPrimitive(resolved.diagram)

  assert.equal(primitive.boundary0.segments[0].start.x, -3)
  assert.equal(primitive.boundary0.segments[0].end.x, 3)
  assert.equal(sampleRuledSurface(primitive).vertices.every(isFinitePoint), true)
})

test('resolvePendingSymbolicDiagramImport refreshes symbolic Coons boundary frame previews', () => {
  const pending = pendingImportForDiagram(symbolicCoonsFrameDiagram())
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '4' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const primitive = resolvedCoonsPrimitive(resolved.diagram)
  const frame = coonsPathBoundary(primitive.bottom).segments[0].frame

  assert.equal(frame?.origin.x, -2)
  assert.equal(frame?.origin.symbolic?.x.kind, 'symbolic')
  assert.equal(frame?.origin.symbolic.x.previewValue, -2)
  assert.equal(sampleCoonsPatch(primitive).vertices.every(isFinitePoint), true)

  const tikz = generateTikz(resolved.diagram, { exportMode: 'inlineMath' })

  assert.equal(tikz.includes('\n\n'), false)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('resolvePendingSymbolicDiagramImport refreshes symbolic ruled boundary frame previews', () => {
  const pending = pendingImportForDiagram(symbolicRuledFrameDiagram())
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '4' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const primitive = resolvedRuledPrimitive(resolved.diagram)
  const frame = primitive.boundary0.segments[0].frame

  assert.equal(frame?.origin.x, -2)
  assert.equal(frame?.origin.symbolic?.x.kind, 'symbolic')
  assert.equal(frame?.origin.symbolic.x.previewValue, -2)
  assert.equal(sampleRuledSurface(primitive).vertices.every(isFinitePoint), true)
})

test('resolvePendingSymbolicDiagramImport rejects invalid boundary frame geometry', () => {
  const diagram = symbolicCoonsFrameDiagram()
  const primitive = resolvedCoonsPrimitive(diagram)
  const segment = coonsPathBoundary(primitive.bottom).segments[0]

  if (segment.frame === undefined) {
    throw new Error('Expected symbolic frame.')
  }
  segment.frame.u = symbolicPoint(2, 0, 0, { x: '.5*Len' })

  const resolved = resolvePendingSymbolicDiagramImport(
    pendingImportForDiagram(diagram),
    [{ name: 'Len', expression: '4' }],
  )

  assert.equal(resolved.ok, false)
  if (resolved.ok) {
    throw new Error('Expected invalid frame geometry to fail.')
  }
  assert.match(resolved.error, /frame.*orthonormal right-handed frame/)
})

test('resolvePendingSymbolicDiagramImport rejects invalid values without mutating pending diagram', () => {
  const pending = pendingImportForDiagram(symbolicCoonsDiagram())
  const before = serializeDiagram(pending.diagram)
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '4' },
    { name: 'R', expression: '1/' },
  ])

  assert.equal(resolved.ok, false)
  if (resolved.ok) {
    throw new Error('Expected invalid import value to fail.')
  }
  assert.match(resolved.error, /Could not load diagram/)
  assert.equal(serializeDiagram(pending.diagram), before)
})

test('parseSavedDiagramJsonForImport lets invalid saved variable expressions be corrected', () => {
  const diagram = symbolicCoonsDiagram()
  const variable = diagram.variables?.find((candidate) => candidate.name === 'R')

  if (variable === undefined) {
    throw new Error('Expected R variable.')
  }
  variable.expression = '1/'

  const result = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'needsVariableResolution') {
    throw new Error('Expected invalid saved variable to open resolver.')
  }

  const failed = resolvePendingSymbolicDiagramImport(result.pendingImport, [
    { name: 'Len', expression: '4' },
    { name: 'R', expression: '1/' },
  ])
  const corrected = resolvePendingSymbolicDiagramImport(result.pendingImport, [
    { name: 'Len', expression: '4' },
    { name: 'R', expression: '1' },
  ])

  assert.equal(failed.ok, false)
  assert.equal(corrected.ok, true)
})

test('resolvePendingSymbolicDiagramImport rejects cyclic and non-finite variables', () => {
  const cycle = resolvePendingSymbolicDiagramImport(
    pendingImportForDiagram(symbolicCoonsDiagram()),
    [
      { name: 'Len', expression: 'R' },
      { name: 'R', expression: 'Len' },
    ],
  )
  const nonFinite = resolvePendingSymbolicDiagramImport(
    pendingImportForDiagram(symbolicCoonsDiagram()),
    [
      { name: 'Len', expression: '1/0' },
      { name: 'R', expression: '1' },
    ],
  )

  assert.equal(cycle.ok, false)
  assert.equal(nonFinite.ok, false)
  if (cycle.ok || nonFinite.ok) {
    throw new Error('Expected invalid symbolic imports to fail.')
  }
  assert.match(cycle.error, /cycle/i)
  assert.match(nonFinite.error, /Division by zero|non-finite/)
})

test('symbolic Coons import preserves expressions and exports TikZ', () => {
  const pending = pendingImportForDiagram(symbolicCoonsDiagram())
  const resolved = resolvePendingSymbolicDiagramImport(pending, [
    { name: 'Len', expression: '4' },
    { name: 'R', expression: '1' },
  ])

  assert.equal(resolved.ok, true)
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }

  const serialized = serializeDiagram(resolved.diagram)
  assert.equal(serialized.includes('"expression": "-.5*Len"'), true)
  assert.equal(serialized.includes('"expression": "R"'), true)

  const tikz = generateTikz(resolved.diagram, { exportMode: 'inlineMath' })

  assert.equal(tikz.includes('\n\n'), false)
  assert.match(tikz, /\\pgfmathsetmacro/)
})

test('serializeDiagram does not include editor-only state', () => {
  const serialized = serializeDiagram(twoDimensionalExample)

  assert.equal(serialized.includes('selectedElement'), false)
  assert.equal(serialized.includes('creationTool'), false)
  assert.equal(serialized.includes('coordinateInputMode'), false)
  assert.equal(serialized.includes('activeWorkPlane'), false)
  assert.equal(serialized.includes('polylineDraft'), false)
  assert.equal(serialized.includes('cubicBezierDraft'), false)
  assert.equal(serialized.includes('pathDraft'), false)
  assert.equal(serialized.includes('sheetPolygonDraft'), false)
  assert.equal(serialized.includes('history'), false)
  assert.equal(serialized.includes('past'), false)
  assert.equal(serialized.includes('present'), false)
  assert.equal(serialized.includes('future'), false)
  assert.equal(serialized.includes('undoDiagram'), false)
  assert.equal(serialized.includes('copyStatus'), false)
})

test('serializeDiagram excludes active custom work-plane UI state', () => {
  const activeWorkPlane: WorkPlane = {
    kind: 'custom',
    id: 'camera-leak-sentinel-plane',
    name: 'Camera Leak Sentinel',
    origin: { x: 91, y: 92, z: 93 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: {
      kind: 'existingPointStrata',
      pointIds: ['camera-leak-p0', 'camera-leak-p1', 'camera-leak-p2'],
    },
  }
  const serialized = serializeDiagram(twoDimensionalExample)

  assert.equal(activeWorkPlane.kind, 'custom')
  assert.equal(serialized.includes('camera-leak-sentinel-plane'), false)
  assert.equal(serialized.includes('Camera Leak Sentinel'), false)
  assert.equal(serialized.includes('camera-leak-p0'), false)
  assert.equal(serialized.includes('existingPointStrata'), false)
})

function symbolicCoonsDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

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
      id: 'symbolic-coons',
      primitive: {
        kind: 'coonsPatch',
        bottom: lineBoundarySnapshot(
          'coons-bottom',
          symbolicPoint(-2, 0, 0, { x: '-.5*Len' }),
          symbolicPoint(2, 0, 0, { x: '.5*Len' }),
        ),
        right: lineBoundarySnapshot(
          'coons-right',
          symbolicPoint(2, 0, 0, { x: '.5*Len' }),
          symbolicPoint(2, 1, 0, { x: '.5*Len', y: 'R' }),
        ),
        top: lineBoundarySnapshot(
          'coons-top',
          symbolicPoint(-2, 1, 0, { x: '-.5*Len', y: 'R' }),
          symbolicPoint(2, 1, 0, { x: '.5*Len', y: 'R' }),
        ),
        left: lineBoundarySnapshot(
          'coons-left',
          symbolicPoint(-2, 0, 0, { x: '-.5*Len' }),
          symbolicPoint(-2, 1, 0, { x: '-.5*Len', y: 'R' }),
        ),
        sampling: { uSegments: 2, vSegments: 2 },
      },
    }),
  )

  return diagram
}

function symbolicPathCrossingDiagram(kind: CrossingKind): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.variables = [
    {
      id: 'var-len',
      name: 'Len',
      macroName: 'Len',
      expression: '2',
      previewValue: 2,
    },
  ]
  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'path-a',
      name: 'Path A',
      points: [
        point(0, 0, 0),
        symbolicPoint(2, 0, 0, { x: 'Len' }),
      ],
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'path-b',
      name: 'Path B',
      points: [point(1, -1, 0), point(1, 1, 0)],
    }),
  )
  diagram.pathCrossings = [
    pathCrossingStateFromCandidate(onlyPathIntersectionCandidate(diagram), kind),
  ]

  return diagram
}

function symbolicRuledDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

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
      id: 'symbolic-ruled',
      primitive: {
        kind: 'ruledSurface',
        boundary0: lineBoundarySnapshot(
          'ruled-bottom',
          symbolicPoint(-2, 0, 0, { x: '-.5*Len' }),
          symbolicPoint(2, 0, 0, { x: '.5*Len' }),
        ),
        boundary1: lineBoundarySnapshot(
          'ruled-top',
          symbolicPoint(-2, 1, 1, { x: '-.5*Len' }),
          symbolicPoint(2, 1, 1, { x: '.5*Len' }),
        ),
        sampling: { segments: 2 },
      },
    }),
  )

  return diagram
}

function symbolicCoonsFrameDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

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
      id: 'symbolic-coons-frame',
      primitive: {
        kind: 'coonsPatch',
        bottom: arcBoundarySnapshot(
          'coons-bottom-frame',
          symbolicBoundaryFrame(),
        ),
        right: lineBoundarySnapshot(
          'coons-right-frame',
          { x: 2, y: 0, z: 0 },
          { x: 2, y: 1, z: 0 },
        ),
        top: lineBoundarySnapshot(
          'coons-top-frame',
          { x: -2, y: 1, z: 0 },
          { x: 2, y: 1, z: 0 },
        ),
        left: lineBoundarySnapshot(
          'coons-left-frame',
          { x: -2, y: 0, z: 0 },
          { x: -2, y: 1, z: 0 },
        ),
        sampling: { uSegments: 2, vSegments: 2 },
      },
    }),
  )

  return diagram
}

function symbolicRuledFrameDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

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
      id: 'symbolic-ruled-frame',
      primitive: {
        kind: 'ruledSurface',
        boundary0: arcBoundarySnapshot(
          'ruled-bottom-frame',
          symbolicBoundaryFrame(),
        ),
        boundary1: lineBoundarySnapshot(
          'ruled-top-frame',
          { x: -2, y: 1, z: 1 },
          { x: 2, y: 1, z: 1 },
        ),
        sampling: { segments: 2 },
      },
    }),
  )

  return diagram
}

function symbolicBoundaryFrame(): WorkPlaneFrameSnapshot {
  return {
    origin: symbolicPoint(-99, 0, 0, { x: '-.5*Len' }),
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function legacyFilledSheetFrameReferenceDiagram(
  field: keyof WorkPlaneFrameSnapshot,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const anchorPoint = frameFieldReferencePoint(field)

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-frame',
      name: 'Frame coordinate',
      position: globalAnchorPosition(
        anchorPoint.x,
        anchorPoint.y,
        anchorPoint.z,
      ),
    }),
  ]

  const reference = coordinateReferenceVec3ForAnchorId(diagram, 'coord-frame')

  if (reference === null) {
    throw new Error('Expected frame coordinate reference.')
  }

  const frame = legacyFilledSheetFrame()
  frame[field] = reference

  diagram.strata.push(
    createWorkPlaneFilledSheet3DStratum({
      id: 'legacy-filled-sheet',
      name: 'Legacy Filled Sheet',
      planeFrame: frame,
      boundaries: [squareFilledSheetBoundary(frame.origin)],
    }),
  )

  return diagram
}

function legacyFilledSheetFrame(): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 1, y: 2, z: 3 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function frameFieldReferencePoint(field: keyof WorkPlaneFrameSnapshot): Vec3 {
  switch (field) {
    case 'origin':
      return { x: 1, y: 2, z: 3 }
    case 'u':
      return { x: 1, y: 0, z: 0 }
    case 'v':
      return { x: 0, y: 1, z: 0 }
    case 'normal':
      return { x: 0, y: 0, z: 1 }
  }
}

function squareFilledSheetBoundary(origin: Vec3): ClosedPathBoundary {
  const points: [Vec3, Vec3, Vec3, Vec3] = [
    origin,
    { x: origin.x + 1, y: origin.y, z: origin.z },
    { x: origin.x + 1, y: origin.y + 1, z: origin.z },
    { x: origin.x, y: origin.y + 1, z: origin.z },
  ]

  return {
    id: 'legacy-filled-boundary',
    name: 'Legacy filled boundary',
    segments: [
      { kind: 'line', start: points[0], end: points[1] },
      { kind: 'line', start: points[1], end: points[2] },
      { kind: 'line', start: points[2], end: points[3] },
      { kind: 'line', start: points[3], end: points[0] },
    ],
  }
}

function requireWorkPlaneFilledSheet(diagram: Diagram) {
  const sheet = diagram.strata[0]

  if (
    sheet === undefined ||
    sheet.geometricKind !== 'sheet' ||
    sheet.kind !== 'workPlaneFilledSheet'
  ) {
    throw new Error('Expected a work-plane filled sheet.')
  }

  return sheet
}

function pendingImportForDiagram(diagram: Diagram): PendingSymbolicDiagramImport {
  const result = parseSavedDiagramJsonForImport(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'needsVariableResolution') {
    throw new Error('Expected pending symbolic import.')
  }

  return result.pendingImport
}

function onlyPathIntersectionCandidate(diagram: Diagram) {
  const candidates = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(candidates.length, 1)

  const candidate = candidates[0]

  if (candidate === undefined) {
    throw new Error('Expected one path intersection candidate.')
  }

  return candidate
}

function resolvedCoonsPrimitive(diagram: Diagram): CoonsPatchPrimitive {
  const sheet = diagram.strata[0]

  if (sheet?.kind !== 'curvedSheet' || sheet.primitive.kind !== 'coonsPatch') {
    throw new Error('Expected a Coons patch.')
  }

  return sheet.primitive
}

function resolvedRuledPrimitive(diagram: Diagram): RuledSurfacePrimitive {
  const sheet = diagram.strata[0]

  if (sheet?.kind !== 'curvedSheet' || sheet.primitive.kind !== 'ruledSurface') {
    throw new Error('Expected a ruled surface.')
  }

  return sheet.primitive
}

function coonsPathBoundary(
  boundary: CoonsPatchPrimitive['bottom'],
): BoundaryPathSnapshot {
  if ('segments' in boundary) {
    return boundary
  }

  throw new Error('Expected a Coons path boundary.')
}

function isFinitePoint(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  )
}

function point(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function symbolicPoint(
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

function lineBoundarySnapshot(
  id: string,
  start: Vec3,
  end: Vec3,
): BoundaryPathSnapshot {
  return {
    id,
    segments: [
      {
        kind: 'line',
        start,
        end,
      },
    ],
  }
}

function arcBoundarySnapshot(
  id: string,
  frame: WorkPlaneFrameSnapshot,
): BoundaryPathSnapshot {
  return {
    id,
    segments: [
      {
        kind: 'arc',
        start: { x: -2, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        radius: 2,
        startAngleDeg: 180,
        endAngleDeg: 0,
        direction: 'clockwise',
        frame,
      },
    ],
  }
}

function ensureLayerMetadataAndPathArrowDefaults(diagram: Diagram): Diagram {
  const layered = ensureLayerMetadata(diagram)

  return {
    ...layered,
    strata: layered.strata.map((stratum) =>
      stratum.geometricKind === 'curve' && stratum.arrows === undefined
        ? {
            ...stratum,
            arrows: clonePathArrowOptions(defaultPathArrowOptions),
          }
        : stratum,
    ),
  }
}

type RawSavedDiagramFixture = {
  format: unknown
  version: unknown
  diagram: {
    coordinateAnchors?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

function savedDiagramWithRawCoordinateAnchor(
  position: unknown,
): RawSavedDiagramFixture {
  const saved = JSON.parse(
    serializeDiagram(createEmptyDiagram({ ambientDimension: 3 })),
  ) as RawSavedDiagramFixture

  saved.diagram.coordinateAnchors = [
    {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position,
    },
  ]

  return saved
}

function parseRawSavedDiagramWithoutThrow(
  saved: unknown,
): ReturnType<typeof parseSavedDiagramJson> {
  let result: ReturnType<typeof parseSavedDiagramJson> | undefined

  assert.doesNotThrow(() => {
    result = parseSavedDiagramJson(JSON.stringify(saved))
  })

  if (result === undefined) {
    throw new Error('Expected parseSavedDiagramJson to return a result.')
  }

  return result
}

function savedNumericCoordinateComponent(value: number): unknown {
  return {
    kind: 'numeric',
    value,
  }
}

function globalAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
    },
  }
}

function workPlaneLocalAnchorPosition(): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: {
      origin: { x: 0, y: 0, z: 0 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    },
    local: {
      a: { kind: 'numeric', value: 1 },
      b: { kind: 'numeric', value: 2 },
    },
    preview: { x: 1, y: 2, z: 0 },
  }
}

const localBezierFrame = {
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}
