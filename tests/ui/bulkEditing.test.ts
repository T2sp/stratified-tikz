import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import { serializeDiagram } from '../../src/model/serialization.ts'
import type {
  CurveStratum,
  Diagram,
  TextLabel,
  Vec3,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyBulkDeleteToEditorState,
  applyBulkDuplicateToEditorState,
  applyBulkStyleField,
  createBulkStyleEditorModel,
  duplicateSelectedElements,
  removeSelectedElements,
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
