import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import {
  parseSavedDiagramJson,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type { Diagram } from '../../src/model/types.ts'

test('serializeDiagram includes format, version, and diagram data', () => {
  const serialized = serializeDiagram(twoDimensionalExample)
  const parsed = JSON.parse(serialized) as {
    format: unknown
    version: unknown
    diagram: unknown
  }

  assert.equal(parsed.format, savedDiagramFormat)
  assert.equal(parsed.version, savedDiagramVersion)
  assert.deepEqual(parsed.diagram, twoDimensionalExample)
})

test('parseSavedDiagramJson returns a valid saved diagram', () => {
  const result = parseSavedDiagramJson(serializeDiagram(threeDimensionalExample))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(result.diagram, threeDimensionalExample)
})

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
  assert.deepEqual(result.diagram, threeDimensionalExample)
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
  assert.deepEqual(result.diagram, diagramWithPathLabel)
})

test('parseSavedDiagramJson accepts missing optional path labels', () => {
  const result = parseSavedDiagramJson(serializeDiagram(twoDimensionalExample))

  assert.equal(result.ok, true)
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
  assert.deepEqual(result.diagram, diagramWithRelativeBezier)
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
  assert.equal(serialized.includes('sheetPolygonDraft'), false)
  assert.equal(serialized.includes('history'), false)
  assert.equal(serialized.includes('past'), false)
  assert.equal(serialized.includes('present'), false)
  assert.equal(serialized.includes('future'), false)
  assert.equal(serialized.includes('undoDiagram'), false)
  assert.equal(serialized.includes('copyStatus'), false)
})
