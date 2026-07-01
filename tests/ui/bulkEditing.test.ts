import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
} from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
} from '../../src/model/coordinateReferences.ts'
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import { pathCrossingStateFromCandidate } from '../../src/model/pathCrossings.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../src/model/translation.ts'
import type {
  CoordinateAnchorPosition,
  CoordinateComponent,
  CurveStratum,
  Diagram,
  PointStratum,
  Stratum,
  TextLabel,
  Vec3,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyBulkDeleteToEditorState,
  applyBulkDuplicateToEditorState,
  applyBulkStyleField,
  applyBulkTranslateToEditorState,
  createBulkStyleEditorModel,
  duplicateSelectedElements,
  removeSelectedElements,
  translateSelectedElements,
  updateSelectedElementsLayer,
  type BulkOperationEditorState,
} from '../../src/ui/bulkEditing.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type TestEditorState = BulkOperationEditorState & {
  polylineDraft: null | { points: Vec3[] }
  cubicBezierDraft: null | { points: Vec3[] }
  pathDraft: null
  sheetPolygonDraft: null | { points: Vec3[] }
}

test('multi-selected curves show common style editor fields', () => {
  const model = createBulkStyleEditorModel(createBulkCurveDiagram(), curveSelection())

  assert.equal(model?.geometricKind, 'curve')
  assert.deepEqual(
    model?.fields.map((field) => field.label),
    ['Stroke color', 'Opacity', 'Line width', 'Line style'],
  )
  assert.deepEqual(
    model?.arrowFields.map((field) => field.label),
    ['End arrow', 'Mid arrow', 'Mid position', 'Mid direction', 'Arrow head'],
  )
})

test('mixed style value is displayed as mixed', () => {
  const model = createBulkStyleEditorModel(createBulkCurveDiagram(), curveSelection())
  const strokeColor = model?.fields.find((field) => field.id === 'curve.strokeColor')
  const lineWidth = model?.fields.find((field) => field.id === 'curve.lineWidth')

  assert.deepEqual(strokeColor?.value, { kind: 'mixed' })
  assert.deepEqual(lineWidth?.value, { kind: 'value', value: 1.2 })
})

test('editing stroke color applies to all selected curves', () => {
  const diagram = applyBulkStyleField(
    createBulkCurveDiagram(),
    curveSelection(),
    'curve.strokeColor',
    '#AA00AA',
  )

  assert.equal(findCurve(diagram, 'curve-a').style.strokeColor, '#AA00AA')
  assert.equal(findCurve(diagram, 'curve-b').style.strokeColor, '#AA00AA')
  assert.equal(findCurve(diagram, 'curve-c').style.strokeColor, '#333333')
})

test('bulk layer change applies to all selected objects', () => {
  const diagram = updateSelectedElementsLayer(
    createBulkCurveDiagram(),
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'curve-a' },
        { kind: 'label', id: 'label-a' },
      ],
    },
    5,
  )

  assert.equal(findCurve(diagram, 'curve-a').layer, 5)
  assert.equal(findLabel(diagram, 'label-a').layer, 5)
  assert.equal(findCurve(diagram, 'curve-b').layer, 1)
  assert.equal(diagram.layers?.some((layer) => layer.value === 5), true)
})

test('bulk delete removes all selected objects and clears selection', () => {
  const result = removeSelectedElements(createBulkCurveDiagram(), curveSelection())

  assert.equal(result.removed, true)
  assert.equal(result.removedCount, 2)
  assert.equal(result.selectedElement, null)
  assert.equal(hasStratum(result.diagram, 'curve-a'), false)
  assert.equal(hasStratum(result.diagram, 'curve-b'), false)
  assert.equal(hasStratum(result.diagram, 'curve-c'), true)
})

test('bulk delete detaches kept references to deleted coordinate anchors', () => {
  const result = removeSelectedElements(createBulkCoordinateReferenceDiagram(), {
    kind: 'coordinate',
    id: 'coord-a',
  })
  const curve = findCurve(result.diagram, 'ref-path')

  assert.equal(result.removed, true)
  assert.equal(result.removedCount, 1)
  assert.equal(result.detachedCoordinateReferenceCount, 1)
  assert.equal(validateDiagram(result.diagram).valid, true)
  assert.equal(result.diagram.coordinateAnchors?.some((anchor) => anchor.id === 'coord-a'), false)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[0]), null)
  assert.deepEqual(pointPreviewForBulkTest(curve.points[0]), { x: 1, y: 0, z: 0 })
  assert.equal(
    coordinateReferenceSourceForPoint(curve.points[1])?.coordinateId,
    'coord-b',
  )
})

test('bulk delete multiple coordinate anchors detaches each and keeps other refs', () => {
  const result = removeSelectedElements(createBulkCoordinateReferenceDiagram(), {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coord-a' },
      { kind: 'coordinate', id: 'coord-b' },
    ],
  })
  const curve = findCurve(result.diagram, 'ref-path')
  const point = findPoint(result.diagram, 'ref-point-c')

  assert.equal(result.removed, true)
  assert.equal(result.removedCount, 2)
  assert.equal(result.detachedCoordinateReferenceCount, 2)
  assert.equal(validateDiagram(result.diagram).valid, true)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[0]), null)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[1]), null)
  assert.deepEqual(curve.points.map(pointPreviewForBulkTest), [
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
  ])
  assert.equal(
    coordinateReferenceSourceForPoint(point.position)?.coordinateId,
    'coord-c',
  )
})

test('bulk delete coordinate anchor and referencing object succeeds without dangling refs', () => {
  const result = removeSelectedElements(createBulkCoordinateReferenceDiagram(), {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coord-a' },
      { kind: 'stratum', id: 'ref-path' },
    ],
  })

  assert.equal(result.removed, true)
  assert.equal(result.removedCount, 2)
  assert.equal(result.detachedCoordinateReferenceCount, 1)
  assert.equal(hasStratum(result.diagram, 'ref-path'), false)
  assert.equal(JSON.stringify(result.diagram).includes('"coordinateId":"coord-a"'), false)
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('bulk delete coordinate anchor plus ordinary point deletes both and detaches kept refs', () => {
  const result = removeSelectedElements(createBulkCoordinateReferenceDiagram(), {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coord-a' },
      { kind: 'stratum', id: 'ordinary-point' },
    ],
  })
  const curve = findCurve(result.diagram, 'ref-path')

  assert.equal(result.removed, true)
  assert.equal(result.removedCount, 2)
  assert.equal(result.detachedCoordinateReferenceCount, 1)
  assert.equal(hasStratum(result.diagram, 'ordinary-point'), false)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[0]), null)
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('bulk duplicate creates new ids and disambiguates path labels', () => {
  const result = duplicateSelectedElements(createBulkCurveDiagram(), curveSelection())
  const copiedIds = result.idChanges.map((change) => change.copiedId)

  assert.deepEqual(copiedIds, ['curve-a-copy', 'curve-b-copy'])
  assert.equal(hasStratum(result.diagram, 'curve-a-copy'), true)
  assert.equal(hasStratum(result.diagram, 'curve-b-copy'), true)
  assert.deepEqual(result.pathLabelChanges, [
    {
      sourcePathLabel: 'alpha path',
      copiedPathLabel: 'alpha path copy',
    },
  ])
})

test('bulk duplicate preserves geometry, style, and symbolic expressions', () => {
  const sourceDiagram = createBulkCurveDiagram()
  const result = duplicateSelectedElements(sourceDiagram, curveSelection())
  const source = findCurve(sourceDiagram, 'curve-a')
  const copied = findCurve(result.diagram, 'curve-a-copy')

  assert.notEqual(copied.id, source.id)
  assert.deepEqual(copied.points, source.points)
  assert.deepEqual(copied.style, source.style)
  assert.deepEqual(copied.styleSegments[0]?.style, source.styleSegments[0]?.style)
  assert.equal(copied.pathLabel, 'alpha path copy')
  assert.notEqual(copied.points, source.points)
  assert.notEqual(copied.style, source.style)
})

test('bulk duplicate does not duplicate crossing states', () => {
  const diagram = createBulkCurveDiagramWithCrossing()
  const result = duplicateSelectedElements(diagram, curveSelection())

  assert.deepEqual(result.diagram.pathCrossings, diagram.pathCrossings)
  assert.equal(result.diagram.pathCrossings?.length, 1)
  assert.equal(
    result.diagram.pathCrossings?.some((state) =>
      state.pathAId.includes('copy') || state.pathBId.includes('copy'),
    ),
    false,
  )
})

test('bulk translation moves numeric selected points', () => {
  const diagram = createBulkPointDiagram()
  const result = translateSelectedElements(
    diagram,
    pointSelection(),
    parseTranslation(diagram, '1', '-2', '3'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  assert.deepEqual(findPoint(result.diagram, 'point-a').position, {
    x: 2,
    y: 0,
    z: 3,
  })
  assert.deepEqual(findPoint(result.diagram, 'point-b').position, {
    x: 3,
    y: 0,
    z: 4,
  })
})

test('bulk translation adds symbolic deltas to symbolic point expressions', () => {
  const diagram = createBulkPointDiagram()
  const result = translateSelectedElements(
    diagram,
    { kind: 'stratum', id: 'symbolic-point' },
    parseTranslation(diagram, 'Len/2', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const point = findPoint(result.diagram, 'symbolic-point')

  assert.equal(point.position.x, 5)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic.x.expression, '(R) + (Len/2)')
  assert.equal(point.position.symbolic.x.previewValue, 5)
})

test('bulk translation detaches coordinate refs from current anchor positions', () => {
  const diagram = createBulkStaleCoordinateReferenceDiagram()
  const result = translateSelectedElements(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'coordinate', id: 'coord-a' },
        { kind: 'stratum', id: 'ref-path' },
      ],
    },
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const curve = findCurve(result.diagram, 'ref-path')
  const otherPoint = findPoint(result.diagram, 'ref-point-c')
  const anchor = result.diagram.coordinateAnchors?.find(
    (candidate) => candidate.id === 'coord-a',
  )

  assert.equal(curve.kind, 'polyline')
  if (curve.kind !== 'polyline') {
    throw new Error('Expected referenced polyline.')
  }
  assert.deepEqual(pointPreviewForBulkTest(curve.points[0]), {
    x: 6,
    y: 5,
    z: 0,
  })
  assert.deepEqual(pointPreviewForBulkTest(curve.points[1]), {
    x: 3,
    y: 0,
    z: 0,
  })
  assert.equal(coordinateReferenceSourceForPoint(curve.points[0]), null)
  assert.equal(coordinateReferenceSourceForPoint(curve.points[1]), null)
  assert.equal(
    coordinateReferenceSourceForPoint(otherPoint.position)?.coordinateId,
    'coord-c',
  )
  assert.equal(anchor?.position.kind, 'global')
  if (anchor?.position.kind !== 'global') {
    throw new Error('Expected global coordinate anchor.')
  }
  assert.equal(anchor.position.value.x.kind, 'numeric')
  assert.equal(
    anchor.position.value.x.kind === 'numeric'
      ? anchor.position.value.x.value
      : NaN,
    5,
  )
})

test('bulk translation detaches symbolic coordinate refs before translating', () => {
  const diagram = createBulkSymbolicCoordinateReferenceDiagram()
  const result = translateSelectedElements(
    diagram,
    { kind: 'stratum', id: 'symbolic-ref-point' },
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const point = findPoint(result.diagram, 'symbolic-ref-point')

  assert.equal(coordinateReferenceSourceForPoint(point.position), null)
  assert.equal(point.position.x, 6)
  assert.equal(point.position.symbolic?.x.kind, 'symbolic')
  assert.equal(point.position.symbolic.x.expression, '(R) + 1')
  assert.equal(point.position.symbolic.x.previewValue, 6)
})

test('bulk translation input rejects unknown symbolic delta variables', () => {
  const parsed = parseTranslationVectorFromInputs(createBulkPointDiagram(), {
    dx: 'Missing',
    dy: '0',
    dz: '0',
  })

  assert.equal(parsed.ok, false)
  if (parsed.ok) {
    throw new Error('Expected unknown delta variable to be rejected.')
  }
  assert.match(parsed.error, /Unknown variable "Missing"/)
})

test('bulk translation in 2D keeps z numeric and locked to zero', () => {
  const diagram = createBulkPointDiagram(2)
  const result = translateSelectedElements(
    diagram,
    pointSelection(),
    parseTranslation(diagram, '1', '1', 'Len'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  for (const id of ['point-a', 'point-b']) {
    const point = findPoint(result.diagram, id)

    assert.equal(point.position.z, 0)
    assert.equal(point.position.symbolic?.z.kind, undefined)
  }
})

test('bulk translation rejects unsupported objects without partial mutation', () => {
  const diagram = {
    ...createBulkPointDiagram(),
    strata: [
      ...createBulkPointDiagram().strata,
      unsupportedCurveStratum(),
    ],
  }
  const original = structuredClone(diagram) as Diagram
  const result = translateSelectedElements(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'point-a' },
        { kind: 'stratum', id: 'unsupported-curve' },
      ],
    },
    parseTranslation(diagram, '1', '0', '0'),
  )

  assert.equal(result.ok, false)
  assert.deepEqual(result.diagram, original)
})

test('bulk translation is undoable', () => {
  const diagram = createBulkPointDiagram()
  const initial = createBulkState(diagram, pointSelection())
  const translated = applyBulkTranslateToEditorState(
    initial,
    parseTranslation(diagram, '1', '0', '0'),
  )
  const undone = undoLastDiagramChange(translated)
  const redone = redoLastDiagramChange(undone)

  assert.deepEqual(findPoint(translated.editableDiagram, 'point-a').position, {
    x: 2,
    y: 2,
    z: 0,
  })
  assert.deepEqual(findPoint(undone.editableDiagram, 'point-a').position, {
    x: 1,
    y: 2,
    z: 0,
  })
  assert.deepEqual(findPoint(redone.editableDiagram, 'point-a').position, {
    x: 2,
    y: 2,
    z: 0,
  })
  assert.equal(translated.history.past.length, 1)
})

test('bulk translation runs crossing cleanup for translated paths', () => {
  const diagram = createCrossingTranslationDiagram()
  const result = translateSelectedElements(
    diagram,
    { kind: 'stratum', id: 'path-a' },
    parseTranslation(diagram, '0', '2', '0'),
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }
  assert.equal(result.diagram.pathCrossings, undefined)
})

test('undo and redo work for bulk delete', () => {
  const initial = createBulkState(createBulkCurveDiagram(), curveSelection())
  const deleted = applyBulkDeleteToEditorState(initial)
  const undone = undoLastDiagramChange(deleted)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(deleted.editableDiagram, 'curve-a'), false)
  assert.equal(deleted.selectedElement, null)
  assert.equal(hasStratum(undone.editableDiagram, 'curve-a'), true)
  assert.equal(hasStratum(redone.editableDiagram, 'curve-a'), false)
})

test('undo and redo restore coordinate refs around bulk coordinate delete', () => {
  const initial = createBulkState(createBulkCoordinateReferenceDiagram(), {
    kind: 'coordinate',
    id: 'coord-a',
  })
  const deleted = applyBulkDeleteToEditorState(initial)
  const undone = undoLastDiagramChange(deleted)
  const redone = redoLastDiagramChange(undone)

  assert.equal(
    coordinateReferenceSourceForPoint(
      findCurve(deleted.editableDiagram, 'ref-path').points[0],
    ),
    null,
  )
  assert.equal(
    coordinateReferenceSourceForPoint(
      findCurve(undone.editableDiagram, 'ref-path').points[0],
    )?.coordinateId,
    'coord-a',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(
      findCurve(redone.editableDiagram, 'ref-path').points[0],
    ),
    null,
  )
  assert.equal(
    deleted.editableDiagram.coordinateAnchors?.some((anchor) => anchor.id === 'coord-a'),
    false,
  )
  assert.equal(
    undone.editableDiagram.coordinateAnchors?.some((anchor) => anchor.id === 'coord-a'),
    true,
  )
  assert.match(
    deleted.layerOperationStatus,
    /Deleted 1 selected object and detached 1 coordinate reference\./,
  )
})

test('undo and redo work for bulk duplicate', () => {
  const initial = createBulkState(createBulkCurveDiagram(), curveSelection())
  const duplicated = applyBulkDuplicateToEditorState(initial)
  const undone = undoLastDiagramChange(duplicated)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(duplicated.editableDiagram, 'curve-a-copy'), true)
  assert.deepEqual(duplicated.selectedElement, {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'curve-a-copy' },
      { kind: 'stratum', id: 'curve-b-copy' },
    ],
  })
  assert.equal(hasStratum(undone.editableDiagram, 'curve-a-copy'), false)
  assert.equal(hasStratum(redone.editableDiagram, 'curve-a-copy'), true)
})

test('TikZ output reflects bulk style and layer edits', () => {
  const styled = applyBulkStyleField(
    createBulkCurveDiagram(),
    curveSelection(),
    'curve.strokeColor',
    '#AA00AA',
  )
  const layered = updateSelectedElementsLayer(styled, curveSelection(), 5)
  const tikz = generateTikz(layered)

  assert.match(tikz, /\\definecolor\{[^}]+\}\{HTML\}\{AA00AA\}/)
  assert.match(tikz, /stratifiedLayer5/)
})

test('selection state is not saved after bulk operations', () => {
  const result = duplicateSelectedElements(createBulkCurveDiagram(), curveSelection())
  const serialized = serializeDiagram(result.diagram)
  const parsed = JSON.parse(serialized) as Record<string, unknown>

  assert.notEqual(result.selectedElement, null)
  assert.equal('selectedElement' in parsed, false)
  assert.equal('selection' in parsed, false)
})

function createBulkCurveDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    variables: [
      {
        id: 'var-a',
        name: 'a',
        macroName: '\\a',
        expression: '1',
        previewValue: 1,
      },
    ],
    strata: [curveA(), curveB(), curveC()],
    labels: [labelA()],
  }
}

function createBulkCoordinateReferenceDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPositionForBulkTest(1, 0, 0),
    }),
  ]
  diagram.coordinateAnchors.push(
    createCoordinateAnchor(
      {
        ...diagram,
        coordinateAnchors: diagram.coordinateAnchors,
      },
      {
        id: 'coord-b',
        name: 'B',
        position: globalAnchorPositionForBulkTest(2, 0, 0),
      },
    ),
    createCoordinateAnchor(
      {
        ...diagram,
        coordinateAnchors: diagram.coordinateAnchors,
      },
      {
        id: 'coord-c',
        name: 'C',
        position: globalAnchorPositionForBulkTest(3, 0, 0),
      },
    ),
  )
  diagram.strata = [
    createCurveStratum({
      ambientDimension: 2,
      id: 'ref-path',
      name: 'Reference Path',
      points: [
        coordinateReferencePointForBulkTest(diagram, 'coord-a'),
        coordinateReferencePointForBulkTest(diagram, 'coord-b'),
      ],
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'ref-point-c',
      position: coordinateReferencePointForBulkTest(diagram, 'coord-c'),
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'ordinary-point',
      position: { x: 0, y: 1, z: 0 },
    }),
  ]

  return diagram
}

function createBulkStaleCoordinateReferenceDiagram(): Diagram {
  const diagram = createBulkCoordinateReferenceDiagram()

  diagram.coordinateAnchors = (diagram.coordinateAnchors ?? []).map((anchor) =>
    anchor.id === 'coord-a'
      ? {
          ...anchor,
          position: globalAnchorPositionForBulkTest(5, 5, 0),
        }
      : anchor,
  )

  return diagram
}

function createBulkSymbolicCoordinateReferenceDiagram(): Diagram {
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
          y: { kind: 'numeric', value: 0 },
          z: { kind: 'numeric', value: 0 },
        },
      },
    }),
  ]
  diagram.strata = [
    createPointStratum({
      ambientDimension: 2,
      id: 'symbolic-ref-point',
      position: coordinateReferencePointForBulkTest(diagram, 'coord-symbolic'),
    }),
  ]

  return diagram
}

function globalAnchorPositionForBulkTest(
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

function coordinateReferencePointForBulkTest(
  diagram: Diagram,
  coordinateId: string,
): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate anchor ${coordinateId}.`)
  }

  return point
}

function pointPreviewForBulkTest(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function createBulkCurveDiagramWithCrossing(): Diagram {
  return {
    ...createBulkCurveDiagram(),
    pathCrossings: [
      {
        id: 'curve-a-curve-b-0',
        pathAId: 'curve-a',
        pathBId: 'curve-b',
        point: { x: 0.5, y: 0.5, z: 0 },
        parameterA: 0.5,
        parameterB: 0.5,
        kind: 'braiding',
      },
    ],
  }
}

function curveSelection(): SelectedElement {
  return {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'curve-a' },
      { kind: 'stratum', id: 'curve-b' },
    ],
  }
}

function curveA(): CurveStratum {
  return {
    id: 'curve-a',
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    name: 'Curve A',
    pathLabel: 'alpha path',
    style: {
      kind: 'curveStyle',
      strokeColor: '#111111',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    styleSegments: [
      {
        id: 'curve-a-style-segment',
        from: 0.2,
        to: 0.4,
        style: { lineStyle: 'dashed' },
      },
    ],
    points: [symbolicPoint(), { x: 1, y: 1, z: 0 }],
    layer: 0,
  }
}

function curveB(): CurveStratum {
  return {
    id: 'curve-b',
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    name: 'Curve B',
    style: {
      kind: 'curveStyle',
      strokeColor: '#222222',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'dotted',
    },
    styleSegments: [],
    points: [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    layer: 1,
  }
}

function curveC(): CurveStratum {
  return {
    id: 'curve-c',
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    name: 'Curve C',
    style: {
      kind: 'curveStyle',
      strokeColor: '#333333',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    styleSegments: [],
    points: [
      { x: -1, y: 0, z: 0 },
      { x: -1, y: 1, z: 0 },
    ],
    layer: 2,
  }
}

function labelA(): TextLabel {
  return {
    id: 'label-a',
    geometricKind: 'label',
    name: 'Label A',
    text: '$A$',
    position: { x: 0, y: 0.4, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  }
}

function createBulkPointDiagram(ambientDimension: 2 | 3 = 3): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension }),
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '3',
        previewValue: 3,
      },
      {
        id: 'var-Len',
        name: 'Len',
        macroName: 'Len',
        expression: '4',
        previewValue: 4,
      },
    ],
    strata: [
      createPointStratum({
        ambientDimension,
        id: 'point-a',
        position: { x: 1, y: 2, z: ambientDimension === 2 ? 0 : 0 },
        layer: 0,
      }),
      createPointStratum({
        ambientDimension,
        id: 'point-b',
        position: { x: 2, y: 2, z: ambientDimension === 2 ? 0 : 1 },
        layer: 0,
      }),
      createPointStratum({
        ambientDimension,
        id: 'symbolic-point',
        position: symbolicRPoint(),
        layer: 0,
      }),
    ],
    labels: [],
  }
}

function createCrossingTranslationDiagram(): Diagram {
  const base = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [
      createCurveStratum({
        ambientDimension: 2,
        id: 'path-a',
        points: [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      }),
      createCurveStratum({
        ambientDimension: 2,
        id: 'path-b',
        points: [
          { x: 0, y: -1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
      }),
    ],
    labels: [],
  }
  const candidate = pathIntersectionCandidatesForDiagram(base)[0]

  if (candidate === undefined) {
    throw new Error('Expected crossing fixture to have one candidate.')
  }

  return {
    ...base,
    pathCrossings: [pathCrossingStateFromCandidate(candidate, 'braiding')],
  }
}

function pointSelection(): SelectedElement {
  return {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'point-a' },
      { kind: 'stratum', id: 'point-b' },
    ],
  }
}

function symbolicPoint(): Vec3 {
  return {
    x: 0,
    y: 0,
    z: 0,
    symbolic: {
      x: {
        kind: 'symbolic',
        expression: 'a',
        previewValue: 0,
      },
      y: {
        kind: 'numeric',
        value: 0,
      },
      z: {
        kind: 'numeric',
        value: 0,
      },
    },
  }
}

function symbolicRPoint(): Vec3 {
  return {
    x: 3,
    y: 0,
    z: 0,
    symbolic: {
      x: {
        kind: 'symbolic',
        expression: 'R',
        previewValue: 3,
      },
      y: {
        kind: 'numeric',
        value: 0,
      },
      z: {
        kind: 'numeric',
        value: 0,
      },
    },
  }
}

function unsupportedCurveStratum(): Stratum {
  return {
    id: 'unsupported-curve',
    codim: 1,
    geometricKind: 'curve',
    kind: 'unsupportedCurve',
    name: 'Unsupported curve',
    style: {
      kind: 'curveStyle',
      strokeColor: '#000000',
      strokeOpacity: 1,
      lineWidth: 1.2,
      lineStyle: 'solid',
    },
    styleSegments: [],
    layer: 0,
  } as unknown as Stratum
}

function parseTranslation(
  diagram: Diagram,
  dx: string,
  dy: string,
  dz: string,
): TranslationVector {
  const parsed = parseTranslationVectorFromInputs(diagram, { dx, dy, dz })

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return parsed.translation
}

function createBulkState(
  editableDiagram: Diagram,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter = allLayersFilter,
): TestEditorState {
  return {
    editableDiagram,
    selectedElement,
    layerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: '',
    history: createDiagramHistory(editableDiagram),
  }
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'curve') {
    throw new Error(`Expected ${id} to be a curve.`)
  }

  return stratum
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'point') {
    throw new Error(`Expected ${id} to be a point.`)
  }

  return stratum
}

function findLabel(diagram: Diagram, id: string): TextLabel {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Expected ${id} to be a label.`)
  }

  return label
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}
