import assert from 'node:assert/strict'
import test from 'node:test'
import { twoDimensionalExample } from '../../src/examples/index.ts'
import {
  countElementsByLayer,
  deleteLayer,
  duplicateLayer,
  getLayerMetadata,
  getUsedLayerValues,
  isLayerLocked,
  isLayerVisible,
  mergeLayers,
  nextUnusedLayerValue,
  normalizeLayerMetadataForDiagram,
  renameLayer,
  setLayerLock,
  setLayerVisibility,
  swapLayers,
  translateLayer,
} from '../../src/model/layers.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
  findCoordinateAnchorReferences,
} from '../../src/model/coordinateReferences.ts'
import { createArcPathSegmentFromAngles } from '../../src/model/paths.ts'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createCurvedSheetStratum,
  createEmptyDiagram,
  createFilledRegion2DStratum,
  createGridStratum,
  createPointStratum,
  createSheetStratum,
  createTemplatePathStratum,
  createTextLabel,
  createWorkPlaneFilledSheet3DStratum,
} from '../../src/model/constructors.ts'
import { createNumericScalarInputValue } from '../../src/model/grids.ts'
import {
  parseSavedDiagramJson,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { defaultCurveStyle, defaultSheetStyle } from '../../src/model/styles.ts'
import { polylineToSvgPath } from '../../src/rendering/svgPath.ts'
import type {
  ClosedPathBoundary,
  CoordinateAnchorPosition,
  CoordinateComponent,
  CurveStratum,
  Diagram,
  PointStratum,
  PolygonSheetStratum,
  TextLabel,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import {
  diagramTranslationContext,
  translateVec3,
  translationVectorFromNumericVec3,
} from '../../src/model/translation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  allLayersFilter,
  clearSelectionForLayerFilter,
  normalizeLayerFilterForDiagram,
} from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  commitDiagramChange,
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
  type UndoableEditorState,
} from '../../src/ui/undo.ts'

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

test('layer visibility defaults visible and persists when hidden', () => {
  const hidden = setLayerVisibility(createNamedLayerTestDiagram(), 2, false)
  const result = parseSavedDiagramJson(serializeDiagram(hidden))

  assert.equal(isLayerVisible(createNamedLayerTestDiagram(), 2), true)
  assert.equal(isLayerVisible(hidden, 2), false)
  assert.deepEqual(
    hidden.layers?.find((layer) => layer.value === 2),
    { value: 2, name: 'Foreground', visible: false },
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.diagram.layers?.find((layer) => layer.value === 2),
    { value: 2, name: 'Foreground', visible: false },
  )
})

test('layer locking defaults unlocked and persists when locked', () => {
  const locked = setLayerLock(createNamedLayerTestDiagram(), -1, true)
  const result = parseSavedDiagramJson(serializeDiagram(locked))

  assert.equal(isLayerLocked(createNamedLayerTestDiagram(), -1), false)
  assert.equal(isLayerLocked(locked, -1), true)
  assert.deepEqual(
    locked.layers?.find((layer) => layer.value === -1),
    { value: -1, name: 'Background', locked: true },
  )
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.deepEqual(
    result.diagram.layers?.find((layer) => layer.value === -1),
    { value: -1, name: 'Background', locked: true },
  )
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

test('hidden and locked layer metadata does not affect TikZ export by default', () => {
  const diagram = createLayerSwapTestDiagram()
  const hiddenAndLocked = setLayerLock(
    setLayerVisibility(
      {
        ...diagram,
        layers: getLayerMetadata(diagram),
      },
      2,
      false,
    ),
    2,
    true,
  )
  const tikz = generateTikz(hiddenAndLocked)
  const layerTwoBlock = tikzLayerBlock(tikz, 'stratifiedLayer2')

  assert.notEqual(generateTikz(hiddenAndLocked), '')
  assert.match(layerTwoBlock, /stzCurvelayertwostratumStroke/)
  assert.match(layerTwoBlock, /front label/)
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

test('duplicating a layer reserves coordinate anchor ids for copied strata and labels', () => {
  const diagram = createLayerOperationDiagram()

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'source-point-copy',
      name: 'Reserved point copy',
      position: globalAnchorPositionForLayerTest(0, 0, 0),
    }),
    createCoordinateAnchor(diagram, {
      id: 'source-label-copy',
      name: 'Reserved label copy',
      position: globalAnchorPositionForLayerTest(1, 0, 0),
    }),
  ]

  const result = duplicateLayer(diagram, 5, { targetLayerValue: 6 })

  assert.equal(
    result.idChanges.find((change) => change.sourceId === 'source-point')
      ?.copiedId,
    'source-point-copy-1',
  )
  assert.equal(
    result.idChanges.find((change) => change.sourceId === 'source-label')
      ?.copiedId,
    'source-label-copy-1',
  )
  assert.equal(findPoint(result.diagram, 'source-point-copy-1').layer, 6)
  assert.equal(findLabel(result.diagram, 'source-label-copy-1').layer, 6)
  assert.deepEqual(
    result.diagram.coordinateAnchors?.map((anchor) => anchor.id).sort(),
    ['source-label-copy', 'source-point-copy'],
  )
  assertLayerOperationInvariants(result.diagram)
})

test('duplicating a layer preserves coordinate refs to existing anchors', () => {
  const diagram = createLayerDuplicateCoordinateReferenceDiagram()
  const result = duplicateLayer(diagram, 5, { targetLayerValue: 6 })
  const copiedPoint = findPoint(result.diagram, 'ref-point-copy')

  assert.equal(result.diagram.coordinateAnchors?.length, 1)
  assert.equal(
    coordinateReferenceSourceForPoint(copiedPoint.position)?.coordinateId,
    'coord-a',
  )
  assertLayerOperationInvariants(result.diagram)
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
  assert.equal(copiedPolyline.inlineNodes?.[0]?.id, 'source-inline-node-copy')
  assert.deepEqual(copiedPolyline.inlineNodes?.[0]?.position, {
    kind: 'segment',
    segmentIndex: 0,
    value: 0.5,
  })
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

test('next unused layer defaults preserve ordinary, sparse, negative, and decimal behavior', () => {
  assert.equal(nextUnusedLayerValue(createLayerMetadataDiagram([0]), 0), 1)
  assert.equal(nextUnusedLayerValue(createLayerMetadataDiagram([0, 1, 2, 10]), 2), 3)
  assert.equal(nextUnusedLayerValue(createLayerMetadataDiagram([-1, 0]), -1), 1)
  assert.equal(nextUnusedLayerValue(createLayerMetadataDiagram([1.5]), 1.5), 2.5)
})

test('next unused layer defaults return null for non-progressing huge values', () => {
  const hugeLayer = 9_007_199_254_740_992
  const diagram = createLayerMetadataDiagram([hugeLayer])

  assert.equal(Number.isFinite(hugeLayer), true)
  assert.equal(hugeLayer + 1, hugeLayer)
  assert.equal(nextUnusedLayerValue(diagram, hugeLayer), null)
})

test('next unused layer defaults reject non-finite sources and unsafe collision tails', () => {
  const diagram = createLayerMetadataDiagram([0])

  assert.throws(
    () => nextUnusedLayerValue(diagram, Number.POSITIVE_INFINITY),
    /finite/,
  )
  assert.throws(
    () => nextUnusedLayerValue(diagram, Number.NEGATIVE_INFINITY),
    /finite/,
  )
  assert.throws(() => nextUnusedLayerValue(diagram, Number.NaN), /finite/)

  const lastProgressingSource = Number.MAX_SAFE_INTEGER - 1
  const collisionDiagram = createLayerMetadataDiagram([
    lastProgressingSource,
    Number.MAX_SAFE_INTEGER,
  ])

  assert.equal(nextUnusedLayerValue(collisionDiagram, lastProgressingSource), null)
})

test('duplicating a huge finite layer requires an explicit safe target', () => {
  const hugeLayer = 9_007_199_254_740_992
  const diagram = createHugeLayerDiagram(hugeLayer)

  assert.throws(() => duplicateLayer(diagram, hugeLayer), /No safe default/)

  const result = duplicateLayer(diagram, hugeLayer, { targetLayerValue: 0 })

  assert.equal(result.targetLayer, 0)
  assert.equal(findPoint(result.diagram, 'huge-point-copy').layer, 0)
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

test('merging a layer moves strata and labels into an existing target layer', () => {
  const result = mergeLayers(createLayerOperationDiagram(), 5, 1)

  assert.equal(result.sourceLayer, 5)
  assert.equal(result.targetLayer, 1)
  assert.equal(result.movedStrata, 8)
  assert.equal(result.movedLabels, 1)
  assert.equal(findPoint(result.diagram, 'source-point').layer, 1)
  assert.equal(findLabel(result.diagram, 'source-label').layer, 1)
  assert.equal(findCurve(result.diagram, 'other-curve').layer, 1)
  assert.equal(findLabel(result.diagram, 'other-label').layer, 1)
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('merging a layer removes source metadata and preserves target metadata', () => {
  const result = mergeLayers(createLayerOperationDiagram(), 5, 1)

  assert.deepEqual(result.diagram.layers, [
    { value: 1, name: 'Other' },
    { value: 99, name: 'Empty guide layer' },
  ])
})

test('merging a layer rejects same and missing layer values', () => {
  const diagram = createLayerOperationDiagram()

  assert.throws(
    () => mergeLayers(diagram, 5, 5),
    /targetLayerValue must differ/,
  )
  assert.throws(
    () => mergeLayers(diagram, 5, 123),
    /targetLayerValue must refer to an existing layer/,
  )
  assert.throws(
    () => mergeLayers(diagram, 123, 1),
    /sourceLayerValue must refer to an existing layer/,
  )
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

test('TikZ output reflects merged layer contents', () => {
  const merged = mergeLayers(createLayerOperationDiagram(), 5, 1).diagram
  const tikz = generateTikz(merged)
  const targetLayerBlock = tikzLayerBlock(tikz, 'stratifiedLayer1')

  assert.doesNotMatch(tikz, /stratifiedLayer5/)
  assert.match(targetLayerBlock, /source label/)
  assert.match(targetLayerBlock, /other label/)
  assert.match(targetLayerBlock, /spath\/save=sharedPath/)
})

test('translating a layer moves points and labels while preserving identity and other layers', () => {
  const diagram = createLayerTranslationDiagram()
  const original = structuredClone(diagram) as Diagram
  const translation = { x: 10, y: -2, z: 5 }
  const translated = translateLayer(diagram, 5, translation)
  const movedPoint = findPoint(translated, 'translate-point')
  const movedLabel = findLabel(translated, 'translate-label')

  assert.deepEqual(
    movedPoint.position,
    addVec3(findPoint(diagram, 'translate-point').position, translation),
  )
  assert.deepEqual(
    movedLabel.position,
    addVec3(findLabel(diagram, 'translate-label').position, translation),
  )
  assert.equal(movedPoint.id, 'translate-point')
  assert.equal(movedPoint.name, 'Movable point')
  assert.equal(movedPoint.layer, 5)
  assert.deepEqual(movedPoint.style, findPoint(diagram, 'translate-point').style)
  assert.deepEqual(findPoint(translated, 'other-point'), findPoint(diagram, 'other-point'))
  assert.deepEqual(findLabel(translated, 'other-label'), findLabel(diagram, 'other-label'))
  assert.deepEqual(diagram, original)
})

test('translating a layer moves polylines, cubic Beziers, and curve frame snapshots', () => {
  const diagram = createLayerTranslationDiagram()
  const translation = { x: 10, y: -2, z: 5 }
  const translated = translateLayer(diagram, 5, translation)
  const sourcePolyline = findCurve(diagram, 'translate-polyline')
  const movedPolyline = findCurve(translated, 'translate-polyline')
  const sourceCubic = findCubicBezierCurve(diagram, 'translate-cubic')
  const movedCubic = findCubicBezierCurve(translated, 'translate-cubic')

  if (sourcePolyline.kind !== 'polyline' || movedPolyline.kind !== 'polyline') {
    throw new Error('Expected polyline curves.')
  }

  assert.deepEqual(
    movedPolyline.points,
    sourcePolyline.points.map((point) => addVec3(point, translation)),
  )
  assert.equal(movedPolyline.pathLabel, sourcePolyline.pathLabel)
  assert.deepEqual(
    movedCubic.points,
    sourceCubic.points.map((point) => addVec3(point, translation)),
  )

  if (
    sourceCubic.bezierControls?.kind !== 'workPlaneRelativeCartesian' ||
    movedCubic.bezierControls?.kind !== 'workPlaneRelativeCartesian'
  ) {
    throw new Error('Expected work-plane-local cubic Bezier metadata.')
  }

  assert.deepEqual(
    movedCubic.bezierControls.frame.origin,
    addVec3(sourceCubic.bezierControls.frame.origin, translation),
  )
  assert.deepEqual(movedCubic.bezierControls.frame.u, sourceCubic.bezierControls.frame.u)
  assert.deepEqual(movedCubic.bezierControls.frame.v, sourceCubic.bezierControls.frame.v)
  assert.deepEqual(
    movedCubic.bezierControls.frame.normal,
    sourceCubic.bezierControls.frame.normal,
  )
  assert.deepEqual(movedCubic.bezierControls.localStart, sourceCubic.bezierControls.localStart)
  assert.deepEqual(movedCubic.bezierControls.localEnd, sourceCubic.bezierControls.localEnd)
})

test('translating a layer moves concatenated paths, arcs, and circle and ellipse templates', () => {
  const diagram = createLayerTranslationDiagram()
  const translation = { x: 10, y: -2, z: 5 }
  const translated = translateLayer(diagram, 5, translation)
  const sourcePath = findConcatenatedPath(diagram, 'translate-path')
  const movedPath = findConcatenatedPath(translated, 'translate-path')
  const sourceCircle = findTemplatePath(diagram, 'translate-circle-template')
  const movedCircle = findTemplatePath(translated, 'translate-circle-template')
  const sourceEllipse = findTemplatePath(diagram, 'translate-ellipse-template')
  const movedEllipse = findTemplatePath(translated, 'translate-ellipse-template')

  assert.equal(movedPath.pathLabel, sourcePath.pathLabel)
  assert.equal(movedPath.segments.length, 3)
  assert.deepEqual(movedPath.segments[0].start, addVec3(sourcePath.segments[0].start, translation))
  assert.deepEqual(movedPath.segments[0].end, addVec3(sourcePath.segments[0].end, translation))

  const sourceCubic = sourcePath.segments[1]
  const movedCubic = movedPath.segments[1]
  if (
    sourceCubic.kind !== 'cubicBezier' ||
    movedCubic.kind !== 'cubicBezier' ||
    sourceCubic.controlMode?.kind !== 'workPlaneRelativePolar' ||
    movedCubic.controlMode?.kind !== 'workPlaneRelativePolar'
  ) {
    throw new Error('Expected a work-plane-local cubic path segment.')
  }
  assert.deepEqual(movedCubic.control1, addVec3(sourceCubic.control1, translation))
  assert.deepEqual(movedCubic.control2, addVec3(sourceCubic.control2, translation))
  assert.deepEqual(
    movedCubic.controlMode.frame.origin,
    addVec3(sourceCubic.controlMode.frame.origin, translation),
  )
  assert.deepEqual(movedCubic.controlMode.frame.u, sourceCubic.controlMode.frame.u)
  assert.deepEqual(movedCubic.controlMode.localStart, sourceCubic.controlMode.localStart)

  const sourceArc = sourcePath.segments[2]
  const movedArc = movedPath.segments[2]
  if (sourceArc.kind !== 'arc' || movedArc.kind !== 'arc' || sourceArc.frame === undefined || movedArc.frame === undefined) {
    throw new Error('Expected an arc segment with a frame.')
  }
  assert.deepEqual(movedArc.start, addVec3(sourceArc.start, translation))
  assert.deepEqual(movedArc.end, addVec3(sourceArc.end, translation))
  assert.deepEqual(movedArc.center, addVec3(sourceArc.center, translation))
  assert.deepEqual(movedArc.frame.origin, addVec3(sourceArc.frame.origin, translation))
  assert.deepEqual(movedArc.frame.u, sourceArc.frame.u)
  assert.equal(movedArc.radius, sourceArc.radius)
  assert.equal(movedArc.startAngleDeg, sourceArc.startAngleDeg)
  assert.equal(movedArc.endAngleDeg, sourceArc.endAngleDeg)

  assert.deepEqual(movedCircle.template.center, addVec3(sourceCircle.template.center, translation))
  assert.deepEqual(movedEllipse.template.center, addVec3(sourceEllipse.template.center, translation))
  assertTemplateFrameTranslated(sourceCircle, movedCircle, translation)
  assertTemplateFrameTranslated(sourceEllipse, movedEllipse, translation)
})

test('translating a layer moves polygon sheets, filled objects, and curved sheet primitives', () => {
  const diagram = createLayerTranslationDiagram()
  const translation = { x: 10, y: -2, z: 5 }
  const translated = translateLayer(diagram, 5, translation)
  const sourcePolygon = findPolygonSheet(diagram, 'translate-polygon-sheet')
  const movedPolygon = findPolygonSheet(translated, 'translate-polygon-sheet')
  const sourceQuad = findQuadSheet(diagram, 'translate-quad-sheet')
  const movedQuad = findQuadSheet(translated, 'translate-quad-sheet')
  const sourceFilledSheet = findWorkPlaneFilledSheet(diagram, 'translate-filled-sheet')
  const movedFilledSheet = findWorkPlaneFilledSheet(translated, 'translate-filled-sheet')
  const sourceHemisphere = findCurvedSheet(diagram, 'translate-hemisphere')
  const movedHemisphere = findCurvedSheet(translated, 'translate-hemisphere')
  const sourceSaddle = findCurvedSheet(diagram, 'translate-saddle')
  const movedSaddle = findCurvedSheet(translated, 'translate-saddle')

  assert.deepEqual(
    movedPolygon.vertices,
    sourcePolygon.vertices.map((vertex) => addVec3(vertex, translation)),
  )
  assert.equal(movedPolygon.pathLabel, sourcePolygon.pathLabel)
  assert.deepEqual(
    movedQuad.corners,
    sourceQuad.corners.map((corner) => addVec3(corner, translation)),
  )
  assert.deepEqual(
    movedFilledSheet.planeFrame.origin,
    addVec3(sourceFilledSheet.planeFrame.origin, translation),
  )
  assert.deepEqual(movedFilledSheet.planeFrame.u, sourceFilledSheet.planeFrame.u)
  assert.deepEqual(
    movedFilledSheet.boundaries[0]?.segments[0]?.start,
    addVec3(sourceFilledSheet.boundaries[0]?.segments[0]?.start ?? zeroVec3(), translation),
  )

  if (
    sourceHemisphere.primitive.kind !== 'hemisphere' ||
    movedHemisphere.primitive.kind !== 'hemisphere' ||
    sourceSaddle.primitive.kind !== 'saddle' ||
    movedSaddle.primitive.kind !== 'saddle'
  ) {
    throw new Error('Expected hemisphere and saddle primitives.')
  }

  assert.deepEqual(
    movedHemisphere.primitive.center,
    addVec3(sourceHemisphere.primitive.center, translation),
  )
  assert.deepEqual(
    movedHemisphere.primitive.frame.origin,
    addVec3(sourceHemisphere.primitive.frame.origin, translation),
  )
  assert.deepEqual(movedHemisphere.primitive.frame.u, sourceHemisphere.primitive.frame.u)
  assert.deepEqual(
    movedSaddle.primitive.frame.origin,
    addVec3(sourceSaddle.primitive.frame.origin, translation),
  )
  assert.deepEqual(movedSaddle.primitive.frame.v, sourceSaddle.primitive.frame.v)
  assert.equal(validateDiagram(translated).valid, true)
})

test('translating a 2D layer moves filled regions and keeps z locked to zero', () => {
  const diagram = createTwoDimensionalLayerTranslationDiagram()
  const original = structuredClone(diagram) as Diagram
  const translated = translateLayer(diagram, 2, { x: 3, y: -1, z: 0 })
  const point = findPoint(translated, 'translate-2d-point')
  const label = findLabel(translated, 'translate-2d-label')
  const region = findFilledRegion(translated, 'translate-2d-filled-region')

  assert.deepEqual(point.position, { x: 4, y: 1, z: 0 })
  assert.deepEqual(label.position, { x: 5, y: 2, z: 0 })
  assert.equal(
    region.boundaries.every((boundary) =>
      boundary.segments.every((segment) =>
        segment.start.z === 0 && segment.end.z === 0,
      ),
    ),
    true,
  )
  assert.throws(
    () => translateLayer(diagram, 2, { x: 0, y: 0, z: 1 }),
    /2D layer translation does not allow dz/,
  )
  assert.deepEqual(diagram, original)
})

test('non-finite layer translation input and results are rejected without mutation', () => {
  const diagram = createLayerTranslationDiagram()
  const original = structuredClone(diagram) as Diagram

  assert.throws(
    () => translateLayer(diagram, 5, { x: Number.NaN, y: 0, z: 0 }),
    /finite/,
  )
  assert.deepEqual(diagram, original)

  const overflowDiagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    strata: [
      createPointStratum({
        ambientDimension: 3,
        id: 'overflow-point',
        position: { x: Number.MAX_VALUE, y: 0, z: 0 },
        layer: 5,
      }),
    ],
  }

  assert.throws(
    () =>
      translateLayer(overflowDiagram, 5, {
        x: Number.MAX_VALUE,
        y: 0,
        z: 0,
      }),
    /non-finite coordinate/,
  )
})

test('layer translation preserves symbolic point expressions and refreshes previews', () => {
  const diagram = createSymbolicTranslationDiagram()
  const translated = translateLayer(diagram, 7, { x: 2, y: 0, z: 0 })
  const point = findPoint(translated, 'symbolic-point')

  assert.equal(point.position.x, 5)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic?.x.expression, '(R) + 2')
  assert.equal(point.position.symbolic?.x.previewValue, 5)
  assert.equal(point.position.symbolic?.z.kind, 'numeric')
  assert.equal(point.position.symbolic?.z.value, 0)
})

test('layer translation detaches coordinate refs from current anchor positions', () => {
  const diagram = createLayerCoordinateReferenceTranslationDiagram()
  const translated = translateLayer(diagram, 2, { x: 1, y: 0, z: 0 })
  const movedPoint = findPoint(translated, 'ref-point')
  const otherPoint = findPoint(translated, 'other-ref-point')
  const anchor = translated.coordinateAnchors?.find(
    (candidate) => candidate.id === 'coord-a',
  )
  const tikz = generateTikz(translated)

  assert.equal(anchor?.position.kind, 'global')
  if (anchor?.position.kind !== 'global') {
    throw new Error('Expected global coordinate anchor.')
  }
  assert.equal(anchor.position.value.x.kind, 'numeric')
  assert.equal(anchor.position.value.y.kind, 'numeric')
  assert.equal(
    anchor.position.value.x.kind === 'numeric'
      ? anchor.position.value.x.value
      : NaN,
    5,
  )
  assert.equal(
    anchor.position.value.y.kind === 'numeric'
      ? anchor.position.value.y.value
      : NaN,
    5,
  )
  assert.deepEqual(movedPoint.position, { x: 6, y: 5, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(movedPoint.position), null)
  assert.equal(
    coordinateReferenceSourceForPoint(otherPoint.position)?.coordinateId,
    'coord-a',
  )
  assert.deepEqual(
    findCoordinateAnchorReferences(translated, 'coord-a').map(
      (reference) => reference.owner.id,
    ),
    ['other-ref-point'],
  )
  assert.equal(validateDiagram(translated).valid, true)
  assert.match(tikz, /\\coordinate \(A\) at \(5,5\);/)
  assert.match(tikz, /\\coordinate \(pointPoint0p0\) at \(6,5\);/)
  assert.match(tikz, /\\node\[[\s\S]*\] at \(pointPoint0p0\) \{\};/)
})

test('layer coordinate-reference translation is undoable and redoable', () => {
  const initial = createLayerOperationEditorState(
    createLayerCoordinateReferenceTranslationDiagram(),
  )
  const translated = translateLayer(initial.editableDiagram, 2, {
    x: 1,
    y: 0,
    z: 0,
  })
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: translated,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)
  const undonePoint = findPoint(undone.editableDiagram, 'ref-point')
  const redonePoint = findPoint(redone.editableDiagram, 'ref-point')
  const redoneOtherPoint = findPoint(redone.editableDiagram, 'other-ref-point')

  assert.equal(
    coordinateReferenceSourceForPoint(undonePoint.position)?.coordinateId,
    'coord-a',
  )
  assert.deepEqual(redonePoint.position, { x: 6, y: 5, z: 0 })
  assert.equal(coordinateReferenceSourceForPoint(redonePoint.position), null)
  assert.equal(
    coordinateReferenceSourceForPoint(redoneOtherPoint.position)?.coordinateId,
    'coord-a',
  )
  assert.deepEqual(
    undone.editableDiagram.coordinateAnchors,
    initial.editableDiagram.coordinateAnchors,
  )
  assert.deepEqual(
    redone.editableDiagram.coordinateAnchors,
    initial.editableDiagram.coordinateAnchors,
  )
  assert.deepEqual(
    findCoordinateAnchorReferences(redone.editableDiagram, 'coord-a').map(
      (reference) => reference.owner.id,
    ),
    ['other-ref-point'],
  )
  assertLayerOperationInvariants(undone.editableDiagram)
  assertLayerOperationInvariants(redone.editableDiagram)
})

test('layer translation detaches coordinate refs with symbolic current anchor source', () => {
  const diagram = createSymbolicCoordinateReferenceTranslationDiagram()
  const translated = translateLayer(diagram, 2, { x: 1, y: 0, z: 0 })
  const movedPoint = findPoint(translated, 'symbolic-ref-point')

  assert.equal(coordinateReferenceSourceForPoint(movedPoint.position), null)
  assert.equal(movedPoint.position.x, 6)
  assert.equal(movedPoint.position.symbolic?.x.kind, 'symbolic')
  assert.equal(movedPoint.position.symbolic.x.expression, '(R) + 1')
  assert.equal(movedPoint.position.symbolic.x.previewValue, 6)
})

test('layer translation detaches work-plane-local coordinate refs and moves copied frame origin', () => {
  const diagram = createLocalCoordinateReferenceTranslationDiagram()
  const translated = translateLayer(diagram, 2, { x: 1, y: 0, z: 0 })
  const movedPoint = findPoint(translated, 'local-ref-point')
  const source = movedPoint.position.symbolic?.source
  const anchor = translated.coordinateAnchors?.find(
    (candidate) => candidate.id === 'coord-local',
  )

  assert.equal(coordinateReferenceSourceForPoint(movedPoint.position), null)
  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected detached work-plane-local source.')
  }
  assert.deepEqual(source.frame.origin, { x: 1, y: 0, z: 0 })
  assert.equal(source.local.a.kind, 'numeric')
  assert.equal(source.local.b.kind, 'numeric')
  assert.equal(
    source.local.a.kind === 'numeric' ? source.local.a.value : NaN,
    2,
  )
  assert.equal(
    source.local.b.kind === 'numeric' ? source.local.b.value : NaN,
    3,
  )
  assert.equal(anchor?.position.kind, 'workPlaneLocal')
  if (anchor?.position.kind !== 'workPlaneLocal') {
    throw new Error('Expected original local coordinate anchor.')
  }
  assert.deepEqual(anchor.position.frame.origin, { x: 0, y: 0, z: 0 })
})

test('layer translation detaches nested work-plane-local source frame refs', () => {
  const diagram = createNestedLocalFrameReferenceTranslationDiagram()
  const originalAnchorJson = JSON.stringify(diagram.coordinateAnchors?.[0])
  const translated = translateLayer(diagram, 2, { x: 1, y: 0, z: 0 })
  const movedPoint = findPoint(translated, 'nested-local-ref-point')
  const source = movedPoint.position.symbolic?.source

  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected detached work-plane-local source.')
  }
  assert.equal(coordinateReferenceSourceForPoint(source.frame.origin), null)
  assert.deepEqual(source.frame.origin, { x: 6, y: 5, z: 0 })
  assert.deepEqual(
    { x: movedPoint.position.x, y: movedPoint.position.y, z: movedPoint.position.z },
    { x: 8, y: 8, z: 0 },
  )
  assert.equal(validateDiagram(translated).valid, true)
  assert.equal(
    JSON.stringify(translated.coordinateAnchors?.[0]),
    originalAnchorJson,
  )
  assert.equal(JSON.stringify(translated).includes('"coordinateId":"coord-a"'), false)
})

test('raw point translation rejects coordinate refs before stale previews can move', () => {
  const diagram = createLayerCoordinateReferenceTranslationDiagram()
  const point = coordinateReferencePointForLayerTest(diagram, 'coord-a')
  const translation = translationVectorFromNumericVec3(
    diagram,
    { x: 1, y: 0, z: 0 },
  )

  assert.throws(
    () => translateVec3(point, translation, diagramTranslationContext(diagram)),
    /Coordinate references must be detached before translation/,
  )
})

test('layer translation moves symbolic line cubic and arc segment coordinates', () => {
  const diagram = createSymbolicTranslationDiagram()
  const translated = translateLayer(diagram, 7, { x: 1, y: -1, z: 2 })
  const path = findConcatenatedPath(translated, 'symbolic-path')
  const line = path.segments[0]
  const cubic = path.segments[1]
  const arc = path.segments[2]

  if (
    line?.kind !== 'line' ||
    cubic?.kind !== 'cubicBezier' ||
    arc?.kind !== 'arc' ||
    arc.frame === undefined
  ) {
    throw new Error('Expected symbolic line, cubic, and arc segments.')
  }

  assert.equal(line.start.symbolic?.x.kind, 'symbolic')
  assert.equal(line.start.symbolic.x.expression, '(R) + 1')
  assert.equal(line.start.x, 4)
  assert.equal(cubic.control1.symbolic?.y.kind, 'symbolic')
  assert.equal(cubic.control1.symbolic.y.expression, '(R) + -1')
  assert.equal(cubic.control1.y, 2)
  assert.equal(arc.center.symbolic?.x.kind, 'symbolic')
  assert.equal(arc.center.symbolic.x.expression, '(R) + 1')
  assert.equal(arc.center.x, 4)
  assert.deepEqual(arc.frame.origin, { x: 1, y: -1, z: 2 })
  assert.deepEqual(arc.frame.u, { x: 1, y: 0, z: 0 })
})

test('layer translation moves ruled and Coons boundary snapshots', () => {
  const diagram = createBoundarySurfaceTranslationDiagram()
  const translated = translateLayer(diagram, 4, { x: 3, y: 0, z: -1 })
  const ruled = findCurvedSheet(translated, 'ruled-surface')
  const coons = findCurvedSheet(translated, 'coons-patch')

  if (
    ruled.primitive.kind !== 'ruledSurface' ||
    coons.primitive.kind !== 'coonsPatch' ||
    coons.primitive.left.kind !== 'constantPoint'
  ) {
    throw new Error('Expected ruled and Coons primitives.')
  }

  assert.deepEqual(ruled.primitive.boundary0.segments[0]?.start, {
    x: 3,
    y: 0,
    z: -1,
  })
  assert.deepEqual(ruled.primitive.boundary1.segments[0]?.end, {
    x: 4,
    y: 0,
    z: 0,
  })
  assert.deepEqual(coons.primitive.bottom.segments[0]?.start, {
    x: 3,
    y: 0,
    z: -1,
  })
  assert.deepEqual(coons.primitive.left.point, {
    x: 3,
    y: 0,
    z: -1,
  })
})

test('layer translation moves symbolic ruled and Coons boundary expressions', () => {
  const diagram = createSymbolicBoundarySurfaceTranslationDiagram()
  const translated = translateLayer(diagram, 4, { x: 2, y: 0, z: 0 })
  const ruled = findCurvedSheet(translated, 'symbolic-ruled-surface')
  const coons = findCurvedSheet(translated, 'symbolic-coons-patch')

  if (
    ruled.primitive.kind !== 'ruledSurface' ||
    coons.primitive.kind !== 'coonsPatch'
  ) {
    throw new Error('Expected symbolic ruled and Coons primitives.')
  }

  const ruledStart = ruled.primitive.boundary0.segments[0]?.start
  const coonsStart = coons.primitive.bottom.segments[0]?.start

  assert.equal(ruledStart?.symbolic?.x.kind, 'symbolic')
  assert.equal(ruledStart?.symbolic?.x.expression, '(R) + 2')
  assert.equal(ruledStart?.symbolic?.x.previewValue, 5)
  assert.equal(coonsStart?.symbolic?.x.kind, 'symbolic')
  assert.equal(coonsStart?.symbolic?.x.expression, '(R) + 2')
  assert.equal(coonsStart?.symbolic?.x.previewValue, 5)
})

test('layer translation moves grid frame origins without changing basis vectors', () => {
  const diagram = createGridTranslationDiagram()
  const translated = translateLayer(diagram, 3, { x: 2, y: 3, z: 4 })
  const grid = findCurve(translated, 'grid-to-translate')

  if (grid.kind !== 'grid') {
    throw new Error('Expected translated grid.')
  }

  assert.deepEqual(grid.frame.frame.origin, { x: 2, y: 3, z: 5 })
  assert.deepEqual(grid.frame.frame.u, { x: 1, y: 0, z: 0 })
  assert.deepEqual(grid.frame.frame.v, { x: 0, y: 1, z: 0 })
  assert.deepEqual(grid.frame.frame.normal, { x: 0, y: 0, z: 1 })
})

test('SVG path data and TikZ output reflect layer translation', () => {
  const diagram = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [
      createCurveStratum({
        ambientDimension: 2,
        id: 'translate-output-polyline',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        layer: 4,
      }),
    ],
  }
  const translated = translateLayer(diagram, 4, { x: 2, y: 3, z: 0 })
  const curve = findCurve(translated, 'translate-output-polyline')

  if (curve.kind !== 'polyline') {
    throw new Error('Expected translated output curve to be a polyline.')
  }

  const svgPath = polylineToSvgPath(
    curve.points.map((point) => ({ x: point.x, y: point.y })),
  )
  const tikz = generateTikz(translated)

  assert.equal(svgPath, 'M 2,3 L 3,3')
  assert.notEqual(tikz, generateTikz(diagram))
  assert.match(tikz, /\\coordinate \([^)]+\) at \(2,3\);/)
  assert.match(tikz, /\\coordinate \([^)]+\) at \(3,3\);/)
})

test('TikZ output preserves translated symbolic expressions without inline blank lines', () => {
  const translated = translateLayer(
    createSymbolicTranslationDiagram(),
    7,
    { x: 2, y: 0, z: 0 },
  )
  const tikz = generateTikz(translated)
  const inlineTikz = generateTikz(translated, { exportMode: 'inlineMath' })

  assert.match(tikz, /\{\\R \+ 2\}/)
  assert.doesNotMatch(inlineTikz, /\n\s*\n/)
  assert.match(inlineTikz, /\{\\R \+ 2\}/)
})

test('combined layer operation: rename then save/load preserves metadata', () => {
  const renamed = renameLayer(createNamedLayerTestDiagram(), 2, 'Presentation')
  const loaded = saveAndLoadDiagram(renamed)

  assert.deepEqual(
    loaded.layers?.find((layer) => layer.value === 2),
    { value: 2, name: 'Presentation' },
  )
  assertLayerOperationInvariants(loaded)
})

test('combined layer operation: duplicate then translate duplicated layer', () => {
  const duplicated = duplicateLayer(createLayerOperationDiagram(), 5, {
    targetLayerValue: 6,
  }).diagram
  const translated = translateLayer(duplicated, 6, { x: 10, y: 0, z: -1 })
  const sourcePoint = findPoint(translated, 'source-point')
  const copiedPoint = findPoint(translated, 'source-point-copy')
  const copiedLabel = findLabel(translated, 'source-label-copy')

  assert.deepEqual(sourcePoint.position, { x: 1, y: 2, z: 3 })
  assert.deepEqual(copiedPoint.position, { x: 11, y: 2, z: 2 })
  assert.deepEqual(copiedLabel.position, { x: 12, y: 0, z: -1 })
  assertLayerOperationInvariants(translated)
})

test('combined layer operation: swap then delete one layer', () => {
  const swapped = swapLayers(createLayerOperationDiagram(), 1, 5)
  const deleted = deleteLayer(swapped, 1)

  assert.equal(deleted.strata.some((stratum) => stratum.layer === 1), false)
  assert.equal(deleted.labels.some((label) => label.layer === 1), false)
  assert.equal(getLayerMetadata(deleted).some((layer) => layer.value === 1), false)
  assert.equal(findCurve(deleted, 'other-curve').layer, 5)
  assert.equal(findLabel(deleted, 'other-label').layer, 5)
  assertLayerOperationInvariants(deleted)
})

test('combined layer operation: hide clears selection on that layer', () => {
  const hidden = setLayerVisibility(createLayerOperationDiagram(), 5, false)
  const selection = clearSelectionForLayerFilter(
    hidden,
    { kind: 'stratum', id: 'source-point' },
    { kind: 'all' },
  )

  assert.equal(selection, null)
  assertLayerOperationInvariants(hidden, selection)
})

test('combined layer operation: duplicate is reflected in TikZ output', () => {
  const duplicated = duplicateLayer(createLayerOperationDiagram(), 5, {
    targetLayerValue: 6,
  }).diagram
  const tikz = generateTikz(duplicated)
  const layerSixBlock = tikzLayerBlock(tikz, 'stratifiedLayer6')

  assert.match(layerSixBlock, /source label/)
  assert.match(layerSixBlock, /stzPointsourcepointcopy/)
  assert.match(layerSixBlock, /spath\/save=sharedPathCopy2/)
  assertLayerOperationInvariants(duplicated)
})

test('combined layer operation: translate undo and redo restore layer coordinates', () => {
  const initial = createLayerOperationEditorState(createLayerTranslationDiagram())
  const translated = translateLayer(initial.editableDiagram, 5, {
    x: 4,
    y: -1,
    z: 2,
  })
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: translated,
  })
  const undone = undoLastDiagramChange(committed)
  const redone = redoLastDiagramChange(undone)

  assert.deepEqual(
    findPoint(undone.editableDiagram, 'translate-point').position,
    { x: 1, y: 2, z: 3 },
  )
  assert.deepEqual(
    findPoint(redone.editableDiagram, 'translate-point').position,
    { x: 5, y: 1, z: 5 },
  )
  assertLayerOperationInvariants(undone.editableDiagram)
  assertLayerOperationInvariants(redone.editableDiagram)
})

test('combined layer operation: delete undo then save/load restores layer data', () => {
  const initial = createLayerOperationEditorState(createLayerOperationDiagram())
  const deleted = deleteLayer(initial.editableDiagram, 5)
  const committed = commitDiagramChange(initial, {
    ...initial,
    editableDiagram: deleted,
    selectedElement: null,
  })
  const undone = undoLastDiagramChange(committed)
  const loaded = saveAndLoadDiagram(undone.editableDiagram)

  assert.equal(findPoint(loaded, 'source-point').layer, 5)
  assert.equal(findLabel(loaded, 'source-label').layer, 5)
  assert.deepEqual(
    loaded.layers?.find((layer) => layer.value === 5),
    { value: 5, name: 'Foreground' },
  )
  assertLayerOperationInvariants(loaded, { kind: 'stratum', id: 'source-point' })
})

function saveAndLoadDiagram(diagram: Diagram): Diagram {
  const result = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}

function createLayerOperationEditorState(
  editableDiagram: Diagram,
): UndoableEditorState {
  return {
    editableDiagram,
    selectedElement: null,
    layerFilter: allLayersFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    history: createDiagramHistory(editableDiagram),
  }
}

function assertLayerOperationInvariants(
  diagram: Diagram,
  selection: SelectedElement = null,
): void {
  const validation = validateDiagram(diagram)

  assert.equal(
    validation.valid,
    true,
    validation.errors
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('\n'),
  )
  assertNoDuplicateTopLevelElementIds(diagram)
  assertNoNonFiniteCoordinates(diagram)
  assertSelectionAvailableAndVisible(diagram, selection)
  assert.doesNotThrow(() => generateTikz(diagram))
}

function assertNoDuplicateTopLevelElementIds(diagram: Diagram): void {
  const ids = [
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
    ...(diagram.coordinateAnchors ?? []).map((anchor) => anchor.id),
    ...(diagram.variables ?? []).map((variable) => variable.id),
    ...(diagram.pathCrossings ?? []).map((state) => state.id),
  ]

  assert.equal(
    new Set(ids).size,
    ids.length,
    'Expected unique top-level diagram ids.',
  )
}

function assertSelectionAvailableAndVisible(
  diagram: Diagram,
  selection: SelectedElement,
): void {
  if (selection === null) {
    return
  }

  const selected =
    selection.kind === 'stratum'
      ? diagram.strata.find((stratum) => stratum.id === selection.id)
      : diagram.labels.find((label) => label.id === selection.id)

  assert.notEqual(selected, undefined, 'Expected selected element to exist.')
  if (selected === undefined) {
    return
  }

  assert.equal(
    isLayerVisible(diagram, selected.layer),
    true,
    'Expected selected element layer to be visible.',
  )
}

function assertNoNonFiniteCoordinates(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoNonFiniteCoordinates)
    return
  }

  if (!isRecord(value)) {
    return
  }

  if (
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.z === 'number'
  ) {
    assert.equal(Number.isFinite(value.x), true, 'Expected finite x coordinate.')
    assert.equal(Number.isFinite(value.y), true, 'Expected finite y coordinate.')
    assert.equal(Number.isFinite(value.z), true, 'Expected finite z coordinate.')
  }

  Object.values(value).forEach(assertNoNonFiniteCoordinates)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

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

function createLayerMetadataDiagram(layerValues: number[]): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    layers: layerValues.map((value) => ({
      value,
      name: `Layer ${value}`,
    })),
  }
}

function createHugeLayerDiagram(layer: number): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    layers: [{ value: layer, name: 'Huge layer' }],
    strata: [
      createPointStratum({
        ambientDimension: 2,
        id: 'huge-point',
        position: { x: 0, y: 0, z: 0 },
        layer,
      }),
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
        inlineNodes: [
          {
            id: 'source-inline-node',
            position: { kind: 'segment', segmentIndex: 0, value: 0.5 },
            text: '$f$',
            options: { placement: 'above' },
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

function createLayerDuplicateCoordinateReferenceDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPositionForLayerTest(1, 1, 0),
    }),
  ]
  diagram.strata = [
    createPointStratum({
      ambientDimension: 2,
      id: 'ref-point',
      position: coordinateReferencePointForLayerTest(diagram, 'coord-a'),
      layer: 5,
    }),
  ]

  return diagram
}

function createLayerTranslationDiagram(): Diagram {
  const sourceLayer = 5
  const otherLayer = 1
  const pathFrame = xyFrame(1)
  const cubicFrame: WorkPlaneFrameSnapshot = {
    origin: { x: 0, y: 1, z: 0 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
  const arcSegment = createTranslatedArcSegment()
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  return {
    ...diagram,
    layers: [
      { value: otherLayer, name: 'Other' },
      { value: sourceLayer, name: 'Translate me' },
    ],
    strata: [
      createPointStratum({
        ambientDimension: 3,
        id: 'translate-point',
        name: 'Movable point',
        position: { x: 1, y: 2, z: 3 },
        layer: sourceLayer,
      }),
      createCurveStratum({
        ambientDimension: 3,
        id: 'translate-polyline',
        name: 'Movable polyline',
        pathLabel: 'movable polyline',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        layer: sourceLayer,
      }),
      createCurveStratum({
        ambientDimension: 3,
        id: 'translate-cubic',
        kind: 'cubicBezier',
        name: 'Movable cubic',
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1.5, z: 0 },
          { x: 2, y: 1.5, z: 0 },
          { x: 3, y: 1, z: 0 },
        ],
        bezierControls: {
          kind: 'workPlaneRelativeCartesian',
          frame: cubicFrame,
          localStart: { a: 0, b: 0 },
          localEnd: { a: 3, b: 0 },
          firstControlOffset: { dx: 1, dy: 0.5 },
          secondControlOffset: { dx: -1, dy: 0.5 },
          secondOffsetReference: 'end',
        },
        layer: sourceLayer,
      }),
      createConcatenatedPathStratum({
        ambientDimension: 3,
        id: 'translate-path',
        name: 'Movable path',
        pathLabel: 'movable path',
        segments: [
          {
            kind: 'line',
            start: { x: 0, y: 0, z: 1 },
            end: { x: 1, y: 0, z: 1 },
          },
          {
            kind: 'cubicBezier',
            start: { x: 1, y: 0, z: 1 },
            control1: { x: 1.5, y: 0.5, z: 1 },
            control2: { x: 2.5, y: 0.5, z: 1 },
            end: { x: 3, y: 0, z: 1 },
            controlMode: {
              kind: 'workPlaneRelativePolar',
              frame: pathFrame,
              localStart: { a: 1, b: 0 },
              localEnd: { a: 3, b: 0 },
              firstControl: {
                angleDegrees: 45,
                radius: Math.SQRT1_2,
              },
              secondControl: {
                angleDegrees: 135,
                radius: Math.SQRT1_2,
              },
              secondOffsetReference: 'end',
            },
          },
          arcSegment,
        ],
        layer: sourceLayer,
      }),
      createTemplatePathStratum({
        ambientDimension: 3,
        id: 'translate-circle-template',
        name: 'Movable circle template',
        template: {
          kind: 'circleTemplate',
          center: { x: 2, y: 2, z: 1 },
          radius: 0.5,
          frame: pathFrame,
        },
        layer: sourceLayer,
      }),
      createTemplatePathStratum({
        ambientDimension: 3,
        id: 'translate-ellipse-template',
        name: 'Movable ellipse template',
        template: {
          kind: 'ellipseTemplate',
          center: { x: 3, y: 2, z: 1 },
          radiusX: 1,
          radiusY: 0.5,
          rotationDeg: 20,
          frame: pathFrame,
        },
        layer: sourceLayer,
      }),
      {
        id: 'translate-polygon-sheet',
        codim: 1,
        geometricKind: 'sheet',
        kind: 'polygonSheet',
        name: 'Movable polygon sheet',
        style: { ...defaultSheetStyle },
        vertices: [
          { x: 0, y: 0, z: 3 },
          { x: 1, y: 0, z: 3 },
          { x: 0, y: 1, z: 3 },
        ],
        pathLabel: 'movable sheet',
        layer: sourceLayer,
      },
      createSheetStratum({
        ambientDimension: 3,
        id: 'translate-quad-sheet',
        corners: [
          { x: 0, y: 0, z: 4 },
          { x: 1, y: 0, z: 4 },
          { x: 1, y: 1, z: 4 },
          { x: 0, y: 1, z: 4 },
        ],
        layer: sourceLayer,
      }),
      createWorkPlaneFilledSheet3DStratum({
        id: 'translate-filled-sheet',
        planeFrame: xyFrame(2),
        boundaries: [squareBoundary3D('translate-sheet-boundary', 2)],
        layer: sourceLayer,
      }),
      createCurvedSheetStratum({
        id: 'translate-hemisphere',
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
      createCurvedSheetStratum({
        id: 'translate-saddle',
        primitive: {
          kind: 'saddle',
          frame: xyFrame(3),
          width: 2,
          depth: 2,
          height: 0.5,
          sampling: { uSegments: 4, vSegments: 3 },
        },
        layer: sourceLayer,
      }),
      createPointStratum({
        ambientDimension: 3,
        id: 'other-point',
        position: { x: 9, y: 9, z: 9 },
        layer: otherLayer,
      }),
    ],
    labels: [
      createTextLabel({
        ambientDimension: 3,
        id: 'translate-label',
        text: 'move me',
        position: { x: 4, y: 5, z: 6 },
        layer: sourceLayer,
      }),
      createTextLabel({
        ambientDimension: 3,
        id: 'other-label',
        text: 'do not move',
        position: { x: -1, y: -1, z: -1 },
        layer: otherLayer,
      }),
    ],
  }
}

function createLayerCoordinateReferenceTranslationDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPositionForLayerTest(1, 1, 0),
    }),
  ]
  diagram.strata = [
    createPointStratum({
      ambientDimension: 2,
      id: 'ref-point',
      position: coordinateReferencePointForLayerTest(diagram, 'coord-a'),
      layer: 2,
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'other-ref-point',
      position: coordinateReferencePointForLayerTest(diagram, 'coord-a'),
      layer: 3,
    }),
  ]
  diagram.coordinateAnchors = diagram.coordinateAnchors.map((anchor) =>
    anchor.id === 'coord-a'
      ? {
          ...anchor,
          position: globalAnchorPositionForLayerTest(5, 5, 0),
        }
      : anchor,
  )

  return diagram
}

function createSymbolicCoordinateReferenceTranslationDiagram(): Diagram {
  const diagram = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '5',
        previewValue: 5,
      },
    ],
  }

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-symbolic',
      name: 'A',
      position: {
        kind: 'global',
        value: {
          x: { kind: 'symbolic', expression: 'R', previewValue: 5 },
          y: { kind: 'numeric', value: 5 },
          z: { kind: 'numeric', value: 0 },
        },
      },
    }),
  ]
  diagram.strata = [
    createPointStratum({
      ambientDimension: 2,
      id: 'symbolic-ref-point',
      position: coordinateReferencePointForLayerTest(diagram, 'coord-symbolic'),
      layer: 2,
    }),
  ]

  return diagram
}

function createLocalCoordinateReferenceTranslationDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const frame = xyFrame(0)

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-local',
      name: 'L',
      position: {
        kind: 'workPlaneLocal',
        frame,
        local: {
          a: { kind: 'numeric', value: 2 },
          b: { kind: 'numeric', value: 3 },
        },
        preview: { x: 2, y: 3, z: 0 },
      },
    }),
  ]
  diagram.strata = [
    createPointStratum({
      ambientDimension: 3,
      id: 'local-ref-point',
      position: coordinateReferencePointForLayerTest(diagram, 'coord-local'),
      layer: 2,
    }),
  ]

  return diagram
}

function createNestedLocalFrameReferenceTranslationDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPositionForLayerTest(1, 1, 0),
    }),
  ]
  const origin = coordinateReferencePointForLayerTest(diagram, 'coord-a')

  diagram.coordinateAnchors = diagram.coordinateAnchors.map((anchor) =>
    anchor.id === 'coord-a'
      ? {
          ...anchor,
          position: globalAnchorPositionForLayerTest(5, 5, 0),
        }
      : anchor,
  )
  diagram.strata = [
    createPointStratum({
      ambientDimension: 3,
      id: 'nested-local-ref-point',
      position: workPlaneLocalPointForLayerTest({
        origin,
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      }),
      layer: 2,
    }),
  ]

  return diagram
}

function createSymbolicTranslationDiagram(): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '3',
        previewValue: 3,
      },
    ],
    strata: [
      createPointStratum({
        ambientDimension: 3,
        id: 'symbolic-point',
        position: symbolicXPoint(1, 0, 0, 'R'),
        layer: 7,
      }),
      createConcatenatedPathStratum({
        ambientDimension: 3,
        id: 'symbolic-path',
        segments: [
          {
            kind: 'line',
            start: symbolicXPoint(3, 0, 0, 'R'),
            end: { x: 1, y: 0, z: 0 },
          },
          {
            kind: 'cubicBezier',
            start: { x: 1, y: 0, z: 0 },
            control1: symbolicYPoint(1, 3, 0, 'R'),
            control2: { x: 2, y: 3, z: 0 },
            end: { x: 3, y: 0, z: 0 },
          },
          {
            kind: 'arc',
            start: { x: 2, y: 0, z: 0 },
            end: { x: 3, y: 1, z: 0 },
            center: symbolicXPoint(3, 0, 0, 'R'),
            radius: 1,
            startAngleDeg: 0,
            endAngleDeg: 90,
            direction: 'counterclockwise',
            frame: xyFrame(0),
          },
        ],
        layer: 7,
      }),
    ],
    labels: [],
  }
}

function createBoundarySurfaceTranslationDiagram(): Diagram {
  const boundary0 = squareBoundary3D('boundary-0', 0)
  const boundary1 = squareBoundary3D('boundary-1', 1)

  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    strata: [
      createCurvedSheetStratum({
        id: 'ruled-surface',
        primitive: {
          kind: 'ruledSurface',
          boundary0,
          boundary1,
          sampling: { segments: 4 },
        },
        layer: 4,
      }),
      createCurvedSheetStratum({
        id: 'coons-patch',
        primitive: {
          kind: 'coonsPatch',
          bottom: boundary0,
          right: boundary1,
          top: squareBoundary3D('boundary-top', 0),
          left: {
            kind: 'constantPoint',
            point: { x: 0, y: 0, z: 0 },
          },
          sampling: { uSegments: 4, vSegments: 4 },
        },
        layer: 4,
      }),
    ],
    labels: [],
  }
}

function createSymbolicBoundarySurfaceTranslationDiagram(): Diagram {
  const boundary0 = squareBoundary3D('symbolic-boundary-0', 0)
  const boundary1 = squareBoundary3D('symbolic-boundary-1', 1)
  const symbolicStart = symbolicXPoint(3, 0, 0, 'R')

  boundary0.segments[0] = {
    ...boundary0.segments[0],
    start: symbolicStart,
  }

  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '3',
        previewValue: 3,
      },
    ],
    strata: [
      createCurvedSheetStratum({
        id: 'symbolic-ruled-surface',
        primitive: {
          kind: 'ruledSurface',
          boundary0,
          boundary1,
          sampling: { segments: 4 },
        },
        layer: 4,
      }),
      createCurvedSheetStratum({
        id: 'symbolic-coons-patch',
        primitive: {
          kind: 'coonsPatch',
          bottom: boundary0,
          right: boundary1,
          top: squareBoundary3D('symbolic-boundary-top', 0),
          left: {
            kind: 'constantPoint',
            point: { x: 0, y: 0, z: 0 },
          },
          sampling: { uSegments: 4, vSegments: 4 },
        },
        layer: 4,
      }),
    ],
    labels: [],
  }
}

function createGridTranslationDiagram(): Diagram {
  const range = {
    min: createNumericScalarInputValue(-1),
    max: createNumericScalarInputValue(1),
    step: createNumericScalarInputValue(1),
  }
  const clip = {
    kind: 'rectangle' as const,
    uMin: createNumericScalarInputValue(-1),
    uMax: createNumericScalarInputValue(1),
    vMin: createNumericScalarInputValue(-1),
    vMax: createNumericScalarInputValue(1),
  }

  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    strata: [
      createGridStratum({
        ambientDimension: 3,
        id: 'grid-to-translate',
        frame: { kind: 'workPlane', frame: xyFrame(1) },
        uRange: range,
        vRange: range,
        clip,
        layer: 3,
      }),
    ],
    labels: [],
  }
}

function createTwoDimensionalLayerTranslationDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createPointStratum({
        ambientDimension: 2,
        id: 'translate-2d-point',
        position: { x: 1, y: 2, z: 0 },
        layer: 2,
      }),
      createFilledRegion2DStratum({
        id: 'translate-2d-filled-region',
        boundaries: [squareBoundary2D('translate-2d-boundary')],
        layer: 2,
      }),
    ],
    labels: [
      createTextLabel({
        ambientDimension: 2,
        id: 'translate-2d-label',
        text: '2d label',
        position: { x: 2, y: 3, z: 0 },
        layer: 2,
      }),
    ],
  }
}

function createTranslatedArcSegment(): NonNullable<ReturnType<typeof createArcPathSegmentFromAngles>> {
  const segment = createArcPathSegmentFromAngles({
    center: { x: 3, y: 1, z: 1 },
    radius: 1,
    startAngleDeg: 270,
    endAngleDeg: 360,
    direction: 'counterclockwise',
    frame: xyFrame(1),
    ambientDimension: 3,
  })

  if (segment === null) {
    throw new Error('Expected arc segment fixture to be valid.')
  }

  return segment
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

function globalAnchorPositionForLayerTest(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  const component = (value: number): CoordinateComponent => ({
    kind: 'numeric',
    value,
  })

  return {
    kind: 'global',
    value: {
      x: component(x),
      y: component(y),
      z: component(z),
    },
  }
}

function coordinateReferencePointForLayerTest(
  diagram: Diagram,
  coordinateId: string,
): WorkPlaneFrameSnapshot['origin'] {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate anchor ${coordinateId}.`)
  }

  return point
}

function workPlaneLocalPointForLayerTest(
  frame: WorkPlaneFrameSnapshot,
  a = 2,
  b = 3,
): WorkPlaneFrameSnapshot['origin'] {
  const preview = {
    x: frame.origin.x + a * frame.u.x + b * frame.v.x,
    y: frame.origin.y + a * frame.u.y + b * frame.v.y,
    z: frame.origin.z + a * frame.u.z + b * frame.v.z,
  }

  return {
    ...preview,
    symbolic: {
      x: { kind: 'numeric', value: preview.x },
      y: { kind: 'numeric', value: preview.y },
      z: { kind: 'numeric', value: preview.z },
      source: {
        kind: 'workPlaneLocal',
        frame,
        local: {
          a: { kind: 'numeric', value: a },
          b: { kind: 'numeric', value: b },
        },
      },
    },
  }
}

function symbolicXPoint(
  x: number,
  y: number,
  z: number,
  expression: string,
): WorkPlaneFrameSnapshot['origin'] {
  return {
    x,
    y,
    z,
    symbolic: {
      x: { kind: 'symbolic', expression, previewValue: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
    },
  }
}

function symbolicYPoint(
  x: number,
  y: number,
  z: number,
  expression: string,
): WorkPlaneFrameSnapshot['origin'] {
  return {
    x,
    y,
    z,
    symbolic: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'symbolic', expression, previewValue: y },
      z: { kind: 'numeric', value: z },
    },
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

function findCubicBezierCurve(
  diagram: Diagram,
  id: string,
): Extract<CurveStratum, { kind: 'cubicBezier' }> {
  const curve = findCurve(diagram, id)

  if (curve.kind !== 'cubicBezier') {
    throw new Error(`Expected cubic Bezier curve ${id} to exist.`)
  }

  return curve
}

function findConcatenatedPath(
  diagram: Diagram,
  id: string,
): Extract<CurveStratum, { kind: 'concatenatedPath' }> {
  const curve = findCurve(diagram, id)

  if (curve.kind !== 'concatenatedPath') {
    throw new Error(`Expected concatenated path ${id} to exist.`)
  }

  return curve
}

function findTemplatePath(
  diagram: Diagram,
  id: string,
): Extract<CurveStratum, { kind: 'templatePath' }> {
  const curve = findCurve(diagram, id)

  if (curve.kind !== 'templatePath') {
    throw new Error(`Expected template path ${id} to exist.`)
  }

  return curve
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

function findQuadSheet(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { kind: 'quadSheet' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'quadSheet'
  ) {
    throw new Error(`Expected quad sheet ${id} to exist.`)
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

function findFilledRegion(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { kind: 'filledRegion' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'region' ||
    stratum.kind !== 'filledRegion'
  ) {
    throw new Error(`Expected filled region ${id} to exist.`)
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

function assertTemplateFrameTranslated(
  source: Extract<CurveStratum, { kind: 'templatePath' }>,
  moved: Extract<CurveStratum, { kind: 'templatePath' }>,
  translation: WorkPlaneFrameSnapshot['origin'],
): void {
  const sourceFrame = source.template.frame
  const movedFrame = moved.template.frame

  if (sourceFrame === undefined || movedFrame === undefined) {
    throw new Error('Expected template paths to store frame snapshots.')
  }

  assert.deepEqual(movedFrame.origin, addVec3(sourceFrame.origin, translation))
  assert.deepEqual(movedFrame.u, sourceFrame.u)
  assert.deepEqual(movedFrame.v, sourceFrame.v)
  assert.deepEqual(movedFrame.normal, sourceFrame.normal)
}

function addVec3(
  point: WorkPlaneFrameSnapshot['origin'],
  translation: WorkPlaneFrameSnapshot['origin'],
): WorkPlaneFrameSnapshot['origin'] {
  return {
    x: point.x + translation.x,
    y: point.y + translation.y,
    z: point.z + translation.z,
  }
}

function zeroVec3(): WorkPlaneFrameSnapshot['origin'] {
  return { x: 0, y: 0, z: 0 }
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
