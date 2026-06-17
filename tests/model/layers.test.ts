import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import {
  countElementsByLayer,
  deleteLayer,
  duplicateLayer,
  getLayerMetadata,
  getUsedLayerValues,
  nextUnusedLayerValue,
  normalizeLayerMetadataForDiagram,
  renameLayer,
  swapLayers,
} from '../../src/model/layers.ts'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createCurvedSheetStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createPointStratum,
  createSheetStratum,
  createTemplatePathStratum,
  createTextLabel,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import {
  parseSavedDiagramJson,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { defaultCurveStyle, defaultSheetStyle } from '../../src/model/styles.ts'
import type {
  ClosedPathBoundary,
  CurveStratum,
  Diagram,
  PointStratum,
  PolygonSheetStratum,
  TextLabel,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  clearSelectionForLayerFilter,
  normalizeLayerFilterForDiagram,
} from '../../src/ui/layerFilter.ts'

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

test('duplicating a layer copies point strata and labels with new ids on the target layer', () => {
  const diagram = createLayerOperationDiagram()
  const original = structuredClone(diagram) as Diagram
  const result = duplicateLayer(diagram, 5, { targetLayerValue: 6 })
  const copiedPoint = findPoint(result.diagram, 'source-point-copy')
  const copiedLabel = findLabel(result.diagram, 'source-label-copy')

  assert.equal(result.duplicatedStrata, 8)
  assert.equal(result.duplicatedLabels, 1)
  assert.deepEqual(diagram, original)
  assert.equal(copiedPoint.layer, 6)
  assert.equal(copiedLabel.layer, 6)
  assert.notEqual(copiedPoint.id, 'source-point')
  assert.notEqual(copiedLabel.id, 'source-label')
  assert.deepEqual(copiedPoint.position, findPoint(diagram, 'source-point').position)
  assert.deepEqual(copiedLabel.position, findLabel(diagram, 'source-label').position)
  assert.equal(findPoint(result.diagram, 'source-point').layer, 5)
  assert.equal(findLabel(result.diagram, 'source-label').layer, 5)
})

test('duplicating a layer deep-clones curve/path geometry and disambiguates path labels', () => {
  const result = duplicateLayer(createLayerOperationDiagram(), 5, {
    targetLayerValue: 6,
  })
  const sourcePolyline = findCurve(result.diagram, 'source-polyline')
  const copiedPolyline = findCurve(result.diagram, 'source-polyline-copy')
  const sourcePath = findCurve(result.diagram, 'source-path')
  const copiedPath = findCurve(result.diagram, 'source-path-copy')
  const sourceTemplate = findCurve(result.diagram, 'source-circle-template')
  const copiedTemplate = findCurve(result.diagram, 'source-circle-template-copy')

  assert.equal(copiedPolyline.layer, 6)
  assert.equal(copiedPath.layer, 6)
  assert.equal(copiedTemplate.layer, 6)
  assert.equal(copiedPolyline.pathLabel, 'shared path copy 2')
  assert.deepEqual(result.pathLabelChanges, [
    { sourcePathLabel: 'shared path', copiedPathLabel: 'shared path copy 2' },
    { sourcePathLabel: 'source path', copiedPathLabel: 'source path copy' },
    { sourcePathLabel: 'circle path', copiedPathLabel: 'circle path copy' },
    { sourcePathLabel: 'sheet path', copiedPathLabel: 'sheet path copy' },
  ])

  if (sourcePolyline.kind !== 'polyline' || copiedPolyline.kind !== 'polyline') {
    throw new Error('Expected polyline strata.')
  }
  if (sourcePath.kind !== 'concatenatedPath' || copiedPath.kind !== 'concatenatedPath') {
    throw new Error('Expected concatenated path strata.')
  }
  if (sourceTemplate.kind !== 'templatePath' || copiedTemplate.kind !== 'templatePath') {
    throw new Error('Expected template path strata.')
  }

  assert.notEqual(copiedPolyline.points, sourcePolyline.points)
  assert.notEqual(copiedPath.segments, sourcePath.segments)
  assert.notEqual(copiedTemplate.template, sourceTemplate.template)
  copiedPolyline.points[0].x = 99
  copiedPath.segments[0].start.x = 88
  copiedTemplate.template.center.x = 77
  assert.equal(sourcePolyline.points[0].x, 0)
  assert.equal(sourcePath.segments[0].start.x, 0)
  assert.equal(sourceTemplate.template.center.x, 1.5)
  assert.equal(copiedPolyline.styleSegments[0]?.id, 'source-run-copy')
})

test('duplicating a layer copies sheets, filled objects, and curved sheet primitives', () => {
  const result3D = duplicateLayer(createLayerOperationDiagram(), 5, {
    targetLayerValue: 6,
  })
  const copiedQuad = result3D.diagram.strata.find(
    (stratum) => stratum.id === 'source-quad-sheet-copy',
  )
  const copiedPolygon = findPolygonSheet(
    result3D.diagram,
    'source-polygon-sheet-copy',
  )
  const copiedFilledSheet = result3D.diagram.strata.find(
    (stratum) => stratum.id === 'source-filled-sheet-copy',
  )
  const copiedCurved = result3D.diagram.strata.find(
    (stratum) => stratum.id === 'source-curved-sheet-copy',
  )
  const result2D = duplicateLayer(createFilledRegionLayerDiagram(), 2, {
    targetLayerValue: 3,
  })
  const sourceRegion = result2D.diagram.strata.find(
    (stratum) => stratum.id === 'source-filled-region',
  )
  const copiedRegion = result2D.diagram.strata.find(
    (stratum) => stratum.id === 'source-filled-region-copy',
  )

  assert.equal(copiedQuad?.layer, 6)
  assert.equal(copiedPolygon.layer, 6)
  assert.equal(copiedFilledSheet?.layer, 6)
  assert.equal(copiedCurved?.layer, 6)
  assert.equal(copiedPolygon.pathLabel, 'sheet path copy')

  if (
    copiedFilledSheet === undefined ||
    copiedFilledSheet.geometricKind !== 'sheet' ||
    copiedFilledSheet.kind !== 'workPlaneFilledSheet'
  ) {
    throw new Error('Expected copied work-plane filled sheet.')
  }
  if (
    copiedCurved === undefined ||
    copiedCurved.geometricKind !== 'sheet' ||
    copiedCurved.kind !== 'curvedSheet'
  ) {
    throw new Error('Expected copied curved sheet.')
  }
  if (
    sourceRegion === undefined ||
    sourceRegion.geometricKind !== 'region' ||
    sourceRegion.kind !== 'filledRegion' ||
    copiedRegion === undefined ||
    copiedRegion.geometricKind !== 'region' ||
    copiedRegion.kind !== 'filledRegion'
  ) {
    throw new Error('Expected source and copied filled regions.')
  }

  assert.notEqual(copiedFilledSheet.boundaries, findWorkPlaneFilledSheet(result3D.diagram, 'source-filled-sheet').boundaries)
  assert.notEqual(copiedFilledSheet.boundaries[0]?.id, 'sheet-boundary')
  assert.notEqual(copiedCurved.primitive, findCurvedSheet(result3D.diagram, 'source-curved-sheet').primitive)
  assert.equal(copiedRegion.layer, 3)
  assert.notEqual(copiedRegion.boundaries, sourceRegion.boundaries)
  assert.notEqual(copiedRegion.boundaries[0]?.id, 'region-boundary')
})

test('duplicating a layer creates target metadata with the default unused layer policy', () => {
  const diagram = createLayerOperationDiagram()
  const result = duplicateLayer(diagram, 5)

  assert.equal(nextUnusedLayerValue(diagram, 5), 6)
  assert.equal(result.targetLayer, 6)
  assert.deepEqual(
    result.diagram.layers?.find((layer) => layer.value === 6),
    { value: 6, name: 'Foreground copy' },
  )
  assert.deepEqual(
    result.diagram.layers?.find((layer) => layer.value === 5),
    { value: 5, name: 'Foreground' },
  )
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('deleting a layer removes its strata, labels, and metadata only', () => {
  const deleted = deleteLayer(createLayerOperationDiagram(), 5)

  assert.equal(deleted.strata.some((stratum) => stratum.layer === 5), false)
  assert.equal(deleted.labels.some((label) => label.layer === 5), false)
  assert.equal(deleted.strata.some((stratum) => stratum.id === 'other-curve'), true)
  assert.equal(deleted.labels.some((label) => label.id === 'other-label'), true)
  assert.deepEqual(deleted.layers, [
    { value: 1, name: 'Other' },
    { value: 99, name: 'Empty guide layer' },
  ])
  assert.equal(validateDiagram(deleted).valid, true)
})

test('deleting a layer clears stale selection and validates a deleted layer filter', () => {
  const deleted = deleteLayer(createLayerOperationDiagram(), 5)
  const nextFilter = normalizeLayerFilterForDiagram(deleted, {
    kind: 'layer',
    layer: 5,
  })
  const nextSelection = clearSelectionForLayerFilter(
    deleted,
    { kind: 'stratum', id: 'source-point' },
    nextFilter,
  )

  assert.deepEqual(nextFilter, { kind: 'all' })
  assert.equal(nextSelection, null)
})

test('TikZ output reflects duplicated and deleted layer contents', () => {
  const duplicated = duplicateLayer(createLayerOperationDiagram(), 5, {
    targetLayerValue: 6,
  }).diagram
  const duplicatedTikz = generateTikz(duplicated)
  const targetLayerBlock = tikzLayerBlock(duplicatedTikz, 'stratifiedLayer6')
  const deleted = deleteLayer(duplicated, 6)
  const deletedTikz = generateTikz(deleted)

  assert.match(targetLayerBlock, /source label/)
  assert.match(targetLayerBlock, /spath\/save=sharedPathCopy2/)
  assert.doesNotMatch(deletedTikz, /stratifiedLayer6/)
  assert.match(deletedTikz, /stratifiedLayer5/)
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

function createLayerOperationDiagram(): Diagram {
  const frame = xyFrame(0)
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const sourceLayer = 5

  return {
    ...diagram,
    layers: [
      { value: 1, name: 'Other' },
      { value: sourceLayer, name: 'Foreground' },
      { value: 99, name: 'Empty guide layer' },
    ],
    strata: [
      createPointStratum({
        ambientDimension: 3,
        id: 'source-point',
        position: { x: 1, y: 2, z: 3 },
        layer: sourceLayer,
      }),
      createCurveStratum({
        ambientDimension: 3,
        id: 'source-polyline',
        name: 'Source polyline',
        pathLabel: 'shared path',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        styleSegments: [
          {
            id: 'source-run',
            from: 0,
            to: 1,
            style: { lineStyle: 'dashed' },
          },
        ],
        layer: sourceLayer,
      }),
      createConcatenatedPathStratum({
        ambientDimension: 3,
        id: 'source-path',
        name: 'Source path',
        pathLabel: 'source path',
        segments: [
          {
            kind: 'line',
            start: { x: 0, y: 1, z: 0 },
            end: { x: 1, y: 1, z: 0 },
            styleOverride: { lineStyle: 'dotted' },
          },
        ],
        layer: sourceLayer,
      }),
      createTemplatePathStratum({
        ambientDimension: 3,
        id: 'source-circle-template',
        name: 'Source circle template',
        pathLabel: 'circle path',
        template: {
          kind: 'circleTemplate',
          center: { x: 1.5, y: 1.5, z: 0 },
          radius: 0.5,
          frame,
        },
        layer: sourceLayer,
      }),
      createSourcePolygonSheet(sourceLayer),
      createSheetStratum({
        ambientDimension: 3,
        id: 'source-quad-sheet',
        corners: [
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
          { x: 1, y: 1, z: 1 },
          { x: 0, y: 1, z: 1 },
        ],
        layer: sourceLayer,
      }),
      createWorkPlaneFilledSheet3DStratum({
        id: 'source-filled-sheet',
        planeFrame: xyFrame(2),
        boundaries: [squareBoundary3D('sheet-boundary', 2)],
        layer: sourceLayer,
      }),
      createCurvedSheetStratum({
        id: 'source-curved-sheet',
        primitive: {
          kind: 'hemisphere',
          center: { x: 0, y: 0, z: 2 },
          radius: 1,
          frame: xyFrame(2),
          hemisphereSide: 'positive',
          sampling: { uSegments: 4, vSegments: 2 },
        },
        layer: sourceLayer,
      }),
      createCurveStratum({
        ambientDimension: 3,
        id: 'other-curve',
        pathLabel: 'shared-path-copy',
        points: [
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
        ],
        layer: 1,
      }),
    ],
    labels: [
      createTextLabel({
        ambientDimension: 3,
        id: 'source-label',
        text: 'source label',
        position: { x: 2, y: 0, z: 0 },
        layer: sourceLayer,
      }),
      createTextLabel({
        ambientDimension: 3,
        id: 'other-label',
        text: 'other label',
        position: { x: -1, y: 0, z: 0 },
        layer: 1,
      }),
    ],
  }
}

function createFilledRegionLayerDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    layers: [{ value: 2, name: 'Filled regions' }],
    strata: [
      createFilledRegion2DStratum({
        id: 'source-filled-region',
        boundaries: [squareBoundary2D('region-boundary')],
        layer: 2,
      }),
    ],
  }
}

function createSourcePolygonSheet(layer: number): PolygonSheetStratum {
  return {
    id: 'source-polygon-sheet',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    name: 'Source polygon sheet',
    style: { ...defaultSheetStyle },
    vertices: [
      { x: 0, y: 0, z: 3 },
      { x: 1, y: 0, z: 3 },
      { x: 0, y: 1, z: 3 },
    ],
    pathLabel: 'sheet path',
    layer,
  }
}

function squareBoundary2D(id: string): ClosedPathBoundary {
  return {
    id,
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 1, y: 1, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 1, z: 0 },
        end: { x: 0, y: 1, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 0, y: 1, z: 0 },
        end: { x: 0, y: 0, z: 0 },
      },
    ],
  }
}

function squareBoundary3D(id: string, z: number): ClosedPathBoundary {
  return {
    id,
    segments: squareBoundary2D(id).segments.map((segment) => ({
      ...segment,
      start: { ...segment.start, z },
      end: { ...segment.end, z },
    })),
  }
}

function xyFrame(z: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y: 0, z },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
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

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'point') {
    throw new Error(`Expected point ${id} to exist.`)
  }

  return stratum
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'curve') {
    throw new Error(`Expected curve ${id} to exist.`)
  }

  return stratum
}

function findPolygonSheet(diagram: Diagram, id: string): PolygonSheetStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'polygonSheet'
  ) {
    throw new Error(`Expected polygon sheet ${id} to exist.`)
  }

  return stratum
}

function findWorkPlaneFilledSheet(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { kind: 'workPlaneFilledSheet' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'workPlaneFilledSheet'
  ) {
    throw new Error(`Expected work-plane filled sheet ${id} to exist.`)
  }

  return stratum
}

function findCurvedSheet(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { kind: 'curvedSheet' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'curvedSheet'
  ) {
    throw new Error(`Expected curved sheet ${id} to exist.`)
  }

  return stratum
}

function findLabel(diagram: Diagram, id: string): TextLabel {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Expected label ${id} to exist.`)
  }

  return label
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
