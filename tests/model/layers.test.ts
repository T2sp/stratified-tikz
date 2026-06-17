import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import {
  countElementsByLayer,
  getLayerMetadata,
  getUsedLayerValues,
  normalizeLayerMetadataForDiagram,
  renameLayer,
  swapLayers,
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

test('renaming a layer updates metadata without changing element membership', () => {
  const diagram = createNamedLayerTestDiagram()
  const renamed = renameLayer(diagram, 2, 'Presentation layer')

  assert.deepEqual(renamed.strata, diagram.strata)
  assert.deepEqual(renamed.labels, diagram.labels)
  assert.deepEqual(renamed.layers, [
    { value: -1, name: 'Background' },
    { value: 0, name: 'Middle' },
    { value: 2, name: 'Presentation layer' },
    { value: 99, name: 'Empty guide layer' },
  ])
})

test('renaming a layer with a blank name uses a safe default', () => {
  const renamed = renameLayer(createNamedLayerTestDiagram(), 2, '   ')

  assert.deepEqual(
    renamed.layers?.find((layer) => layer.value === 2),
    { value: 2, name: 'Layer 2' },
  )
})

test('duplicate layer names are allowed because numeric values disambiguate them', () => {
  const renamed = renameLayer(createNamedLayerTestDiagram(), -1, 'Foreground')
  const validation = validateDiagram(renamed)

  assert.deepEqual(
    renamed.layers?.filter((layer) => layer.name === 'Foreground'),
    [
      { value: -1, name: 'Foreground' },
      { value: 2, name: 'Foreground' },
    ],
  )
  assert.equal(validation.valid, true)
})

test('renamed layer metadata persists through save and load', () => {
  const renamed = renameLayer(createNamedLayerTestDiagram(), 2, 'Presentation layer')
  const result = parseSavedDiagramJson(serializeDiagram(renamed))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.diagram.layers?.find((layer) => layer.value === 2),
    { value: 2, name: 'Presentation layer' },
  )
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

test('swapping layers updates strata and labels on both layers only', () => {
  const diagram = createLayerSwapTestDiagram()
  const swapped = swapLayers(diagram, -1, 2)

  assert.equal(stratumLayer(swapped, 'layer-minus-one-stratum'), 2)
  assert.equal(stratumLayer(swapped, 'layer-two-stratum'), -1)
  assert.equal(labelLayer(swapped, 'layer-minus-one-label'), 2)
  assert.equal(labelLayer(swapped, 'layer-two-label'), -1)
  assert.equal(labelLayer(swapped, 'layer-zero-label'), 0)
})

test('swapping layers exchanges metadata names with visual layer identity', () => {
  const swapped = swapLayers(createNamedLayerSwapTestDiagram(), -1, 2)

  assert.deepEqual(swapped.layers, [
    { value: -1, name: 'Foreground' },
    { value: 0, name: 'Middle' },
    { value: 2, name: 'Background' },
    { value: 99, name: 'Empty guide layer' },
  ])
})

test('swapping layers changes TikZ layer membership', () => {
  const swapped = swapLayers(createLayerSwapTestDiagram(), -1, 2)
  const tikz = generateTikz(swapped)
  const backBlock = tikzLayerBlock(tikz, 'stratifiedLayerMinus1')
  const frontBlock = tikzLayerBlock(tikz, 'stratifiedLayer2')

  assert.match(backBlock, /stzCurvelayertwostratumStroke/)
  assert.match(backBlock, /front label/)
  assert.doesNotMatch(backBlock, /stzCurvelayerminusonestratumStroke/)
  assert.doesNotMatch(backBlock, /back label/)
  assert.match(frontBlock, /stzCurvelayerminusonestratumStroke/)
  assert.match(frontBlock, /back label/)
  assert.doesNotMatch(frontBlock, /stzCurvelayertwostratumStroke/)
  assert.doesNotMatch(frontBlock, /front label/)
})

test('layer metadata display order is deterministic by numeric value', () => {
  const renamed = renameLayer(
    {
      ...createLayerTestDiagram(),
      layers: [
        { value: 99, name: 'Guide' },
        { value: 2, name: 'Foreground' },
        { value: -1, name: 'Background' },
      ],
    },
    0,
    'Middle',
  )
  const swapped = swapLayers(renamed, -1, 2)

  assert.deepEqual(
    renamed.layers?.map((layer) => layer.value),
    [-1, 0, 2, 99],
  )
  assert.deepEqual(
    swapped.layers?.map((layer) => layer.value),
    [-1, 0, 2, 99],
  )
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

function createNamedLayerTestDiagram(): Diagram {
  return {
    ...createLayerTestDiagram(),
    layers: [
      { value: -1, name: 'Background' },
      { value: 0, name: 'Middle' },
      { value: 2, name: 'Foreground' },
      { value: 99, name: 'Empty guide layer' },
    ],
  }
}

function createLayerSwapTestDiagram(): Diagram {
  const diagram = createLayerTestDiagram()

  return {
    ...diagram,
    labels: [
      {
        ...diagram.labels[0],
        id: 'layer-minus-one-label',
        text: 'back label',
        layer: -1,
      },
      {
        ...diagram.labels[1],
        id: 'layer-two-label',
        text: 'front label',
        layer: 2,
      },
      {
        ...diagram.labels[0],
        id: 'layer-zero-label',
        text: 'middle label',
        layer: 0,
      },
    ],
  }
}

function createNamedLayerSwapTestDiagram(): Diagram {
  return {
    ...createLayerSwapTestDiagram(),
    layers: [
      { value: -1, name: 'Background' },
      { value: 0, name: 'Middle' },
      { value: 2, name: 'Foreground' },
      { value: 99, name: 'Empty guide layer' },
    ],
  }
}

function withoutLayerMetadata(diagram: Diagram): Diagram {
  const clone = structuredClone(diagram) as Diagram
  delete clone.layers
  return clone
}

function stratumLayer(diagram: Diagram, id: string): number {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined) {
    throw new Error(`Expected stratum ${id} to exist.`)
  }

  return stratum.layer
}

function labelLayer(diagram: Diagram, id: string): number {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Expected label ${id} to exist.`)
  }

  return label.layer
}

function tikzLayerBlock(tikz: string, layerName: string): string {
  const start = tikz.indexOf(`\\begin{pgfonlayer}{${layerName}}`)

  if (start < 0) {
    throw new Error(`Expected TikZ layer ${layerName} to exist.`)
  }

  const end = tikz.indexOf('\\end{pgfonlayer}', start)

  if (end < 0) {
    throw new Error(`Expected TikZ layer ${layerName} to be closed.`)
  }

  return tikz.slice(start, end)
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
