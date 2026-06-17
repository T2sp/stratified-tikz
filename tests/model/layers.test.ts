import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import {
  countElementsByLayer,
  getLayerMetadata,
  getUsedLayerValues,
  normalizeLayerMetadataForDiagram,
} from '../../src/model/layers.ts'
import {
  parseSavedDiagramJson,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type { Diagram } from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'

test('used layer values are enumerated from strata and labels', () => {
  assert.deepEqual(getUsedLayerValues(createLayerTestDiagram()), [-1, 0, 2])
})

test('default layer metadata is derived for diagrams without metadata', () => {
  assert.deepEqual(getLayerMetadata(createLayerTestDiagram()), [
    { value: -1, name: 'Layer -1' },
    { value: 0, name: 'Layer 0' },
    { value: 2, name: 'Layer 2' },
  ])
})

test('layer element counts include strata and labels', () => {
  const counts = countElementsByLayer(createLayerTestDiagram())

  assert.equal(counts.get(-1), 1)
  assert.equal(counts.get(0), 1)
  assert.equal(counts.get(2), 2)
})

test('duplicate layer metadata values are normalized and raw duplicates validate as invalid', () => {
  const diagram: Diagram = {
    ...createLayerTestDiagram(),
    layers: [
      { value: 2, name: 'Foreground' },
      { value: 2, name: 'Duplicate foreground' },
    ],
  }
  const normalization = normalizeLayerMetadataForDiagram(diagram)
  const validation = validateDiagram(diagram)

  assert.deepEqual(
    normalization.layers.find((layer) => layer.value === 2),
    { value: 2, name: 'Foreground' },
  )
  assert.match(normalization.warnings.join(' '), /Duplicate metadata/)
  assert.equal(validation.valid, false)
  assert.match(validation.errors.map((issue) => issue.message).join(' '), /unique/)
})

test('non-finite layer metadata values are rejected', () => {
  const diagram: Diagram = {
    ...createLayerTestDiagram(),
    layers: [{ value: Number.POSITIVE_INFINITY, name: 'Invalid' }],
  }
  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors.map((issue) => `${issue.path} ${issue.message}`).join(' '),
    /layers\[0\]\.value .*finite/,
  )

  const saved = savedDiagramJson(createLayerTestDiagram(), [
    { value: '1e999', name: 'Invalid' },
  ])
  const result = parseSavedDiagramJson(saved)

  assert.equal(result.ok, false)
  if (result.ok) {
    throw new Error('Expected non-finite layer metadata to fail.')
  }
  assert.match(result.error, /finite/)
})

test('blank layer metadata names are replaced with safe defaults when normalized', () => {
  const normalization = normalizeLayerMetadataForDiagram({
    ...createLayerTestDiagram(),
    layers: [{ value: 2, name: '   ' }],
  })

  assert.deepEqual(
    normalization.layers.find((layer) => layer.value === 2),
    { value: 2, name: 'Layer 2' },
  )
  assert.match(normalization.warnings.join(' '), /blank/)
})

test('save and load preserves layer names', () => {
  const diagram: Diagram = {
    ...createLayerTestDiagram(),
    layers: [
      { value: -1, name: 'Background' },
      { value: 2, name: 'Foreground' },
      { value: 99, name: 'Empty guide layer' },
    ],
  }
  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.layers, [
    { value: -1, name: 'Background' },
    { value: 0, name: 'Layer 0' },
    { value: 2, name: 'Foreground' },
    { value: 99, name: 'Empty guide layer' },
  ])
})

test('existing diagrams without layer metadata still validate and load', () => {
  const oldDiagram = withoutLayerMetadata(createLayerTestDiagram())
  const validation = validateDiagram(oldDiagram)
  const result = parseSavedDiagramJson(
    JSON.stringify(
      {
        format: savedDiagramFormat,
        version: savedDiagramVersion,
        diagram: oldDiagram,
      },
      null,
      2,
    ),
  )

  assert.equal(validation.valid, true)
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(result.diagram.layers, getLayerMetadata(oldDiagram))
})

test('TikZ output is unchanged by metadata-only layer names', () => {
  const diagram = createLayerTestDiagram()
  const withMetadata: Diagram = {
    ...diagram,
    layers: [
      { value: -1, name: 'Back' },
      { value: 0, name: 'Middle' },
      { value: 2, name: 'Front' },
    ],
  }

  assert.equal(generateTikz(withMetadata), generateTikz(diagram))
})

function createLayerTestDiagram(): Diagram {
  const diagram = withoutLayerMetadata(twoDimensionalExample)

  return {
    ...diagram,
    strata: [
      {
        ...diagram.strata[0],
        id: 'layer-two-stratum',
        layer: 2,
      },
      {
        ...diagram.strata[1],
        id: 'layer-minus-one-stratum',
        layer: -1,
      },
    ],
    labels: [
      {
        ...diagram.labels[0],
        id: 'layer-zero-label',
        layer: 0,
      },
      {
        ...diagram.labels[1],
        id: 'layer-two-label',
        layer: 2,
      },
    ],
  }
}

function withoutLayerMetadata(diagram: Diagram): Diagram {
  const clone = structuredClone(diagram) as Diagram
  delete clone.layers
  return clone
}

function savedDiagramJson(
  diagram: Diagram,
  layers: Array<{ value: string; name: string }>,
): string {
  const layerJson = layers
    .map(
      (layer) =>
        `{"value":${layer.value},"name":${JSON.stringify(layer.name)}}`,
    )
    .join(',')
  const diagramWithoutLayers = JSON.stringify(withoutLayerMetadata(diagram))
  const diagramJson = diagramWithoutLayers.replace(
    /"strata":/u,
    `"layers":[${layerJson}],"strata":`,
  )

  return `{"format":"${savedDiagramFormat}","version":${savedDiagramVersion},"diagram":${diagramJson}}`
}
