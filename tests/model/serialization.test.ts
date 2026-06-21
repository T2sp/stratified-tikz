import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { ensureLayerMetadata } from '../../src/model/layers.ts'
import {
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import {
  applyUserStylePresetToStratum,
  addSymbolicVariableToDiagram,
  createUserStylePresetFromStyle,
  parseSavedDiagramJson,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
} from '../../src/model/index.ts'
import type {
  Camera3D,
  Diagram,
  PerspectiveCamera3D,
  WorkPlane,
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
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagramWithPathLabel))
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
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagramWithRelativeBezier))
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
  assert.deepEqual(result.diagram, ensureLayerMetadata(diagramWithLocalBezier))
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

const localBezierFrame = {
  origin: { x: 10, y: 20, z: 30 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
}
