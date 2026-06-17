import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import { setLayerLock, setLayerVisibility } from '../../src/model/layers.ts'
import type { Diagram } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { addPointStratumWithResult } from '../../src/ui/diagramUpdates.ts'
import {
  clearSelectionForLayerFilter,
  deriveAvailableLayers,
  isLayerSelectableByLayerFilter,
  isStratumSelectableInEditor,
  isTextLabelSelectableInEditor,
  isStratumSelectableByLayerFilter,
  isTextLabelSelectableByLayerFilter,
  normalizeLayerFilterForDiagram,
  type LayerFilter,
} from '../../src/ui/layerFilter.ts'

test('deriveAvailableLayers returns sorted unique layers from strata and labels', () => {
  assert.deepEqual(deriveAvailableLayers(createLayerFilterDiagram()), [-1, 0, 2])
})

test('layer filter selectability decisions apply to strata and labels', () => {
  const diagram = createLayerFilterDiagram()
  const layerTwoFilter: LayerFilter = { kind: 'layer', layer: 2 }

  assert.equal(
    isStratumSelectableByLayerFilter(diagram.strata[0], layerTwoFilter),
    true,
  )
  assert.equal(
    isStratumSelectableByLayerFilter(diagram.strata[1], layerTwoFilter),
    false,
  )
  assert.equal(
    isTextLabelSelectableByLayerFilter(diagram.labels[0], layerTwoFilter),
    false,
  )
  assert.equal(
    isTextLabelSelectableByLayerFilter(diagram.labels[1], layerTwoFilter),
    true,
  )
})

test('clearSelectionForLayerFilter preserves compatible selections', () => {
  const diagram = createLayerFilterDiagram()

  assert.deepEqual(
    clearSelectionForLayerFilter(
      diagram,
      { kind: 'label', id: 'layer-two-label' },
      { kind: 'layer', layer: 2 },
    ),
    { kind: 'label', id: 'layer-two-label' },
  )
})

test('clearSelectionForLayerFilter clears incompatible selections', () => {
  const diagram = createLayerFilterDiagram()

  assert.equal(
    clearSelectionForLayerFilter(
      diagram,
      { kind: 'label', id: 'layer-zero-label' },
      { kind: 'layer', layer: 2 },
    ),
    null,
  )
})

test('hidden layers are not selectable and clear selected elements', () => {
  const diagram = setLayerVisibility(createLayerFilterDiagram(), 2, false)
  const layerTwoFilter: LayerFilter = { kind: 'layer', layer: 2 }

  assert.equal(isLayerSelectableByLayerFilter(diagram, layerTwoFilter, 2), false)
  assert.equal(
    isStratumSelectableInEditor(diagram, diagram.strata[0], layerTwoFilter),
    false,
  )
  assert.equal(
    isTextLabelSelectableInEditor(diagram, diagram.labels[1], layerTwoFilter),
    false,
  )
  assert.equal(
    clearSelectionForLayerFilter(
      diagram,
      { kind: 'label', id: 'layer-two-label' },
      layerTwoFilter,
    ),
    null,
  )
})

test('locked layers remain filter-visible but are not selectable', () => {
  const diagram = setLayerLock(createLayerFilterDiagram(), 2, true)
  const layerTwoFilter: LayerFilter = { kind: 'layer', layer: 2 }

  assert.equal(layerTwoFilter.layer, 2)
  assert.equal(isStratumSelectableByLayerFilter(diagram.strata[0], layerTwoFilter), true)
  assert.equal(isLayerSelectableByLayerFilter(diagram, layerTwoFilter, 2), false)
  assert.equal(
    clearSelectionForLayerFilter(
      diagram,
      { kind: 'stratum', id: 'layer-two-stratum' },
      layerTwoFilter,
    ),
    null,
  )
})

test('layer filter and visibility combine before lock selectability', () => {
  const diagram = setLayerLock(
    setLayerVisibility(createLayerFilterDiagram(), -1, false),
    2,
    true,
  )

  assert.equal(isLayerSelectableByLayerFilter(diagram, { kind: 'all' }, -1), false)
  assert.equal(isLayerSelectableByLayerFilter(diagram, { kind: 'all' }, 2), false)
  assert.equal(
    isLayerSelectableByLayerFilter(diagram, { kind: 'layer', layer: -1 }, 2),
    false,
  )
  assert.equal(isLayerSelectableByLayerFilter(diagram, { kind: 'all' }, 0), true)
})

test('normalizeLayerFilterForDiagram resets missing specific layers to all layers', () => {
  assert.deepEqual(
    normalizeLayerFilterForDiagram(createLayerFilterDiagram(), {
      kind: 'layer',
      layer: 99,
    }),
    { kind: 'all' },
  )
})

test('layer filter helpers do not affect TikZ output', () => {
  const diagram = createLayerFilterDiagram()
  const before = generateTikz(diagram)

  deriveAvailableLayers(diagram)
  clearSelectionForLayerFilter(
    diagram,
    { kind: 'label', id: 'layer-zero-label' },
    { kind: 'layer', layer: 2 },
  )

  assert.equal(generateTikz(diagram), before)
})

test('creation helpers keep default next-layer behavior independent of filters', () => {
  const diagram = createLayerFilterDiagram()
  const result = addPointStratumWithResult(diagram, { x: 2, y: 2, z: 0 })
  const created = result.diagram.strata.find(
    (stratum) => stratum.id === result.id,
  )

  assert.equal(created?.layer, 3)
})

function createLayerFilterDiagram(): Diagram {
  return {
    ...twoDimensionalExample,
    strata: [
      {
        ...twoDimensionalExample.strata[0],
        id: 'layer-two-stratum',
        layer: 2,
      },
      {
        ...twoDimensionalExample.strata[1],
        id: 'layer-minus-one-stratum',
        layer: -1,
      },
    ],
    labels: [
      {
        ...twoDimensionalExample.labels[0],
        id: 'layer-zero-label',
        layer: 0,
      },
      {
        ...twoDimensionalExample.labels[1],
        id: 'layer-two-label',
        layer: 2,
      },
    ],
  }
}
