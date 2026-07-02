import assert from 'node:assert/strict'
import test from 'node:test'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { setLayerLock } from '../../src/model/layers.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
  resolveDiagramCoordinateRefs,
} from '../../src/model/coordinateReferences.ts'
import {
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
} from '../../src/model/stylePresets.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import {
  createInspectorCompactSummary,
  createInspectorSections,
  describeCurvePoints,
  formatLabelStyleSummary,
  formatStratumStyleSummary,
  formatVec3,
} from '../../src/ui/inspectorSummary.ts'
import {
  nextInspectorDisclosureStateForSelection,
  selectedElementDisclosureKey,
  setInspectorDisclosureExpanded,
} from '../../src/ui/inspectorDisclosure.ts'
import type {
  AmbientDimension,
  CoordinateComponent,
  CoordinateAnchorPosition,
  CurveStyle,
  Diagram,
  LabelStyle,
  PointStyle,
  SheetStyle,
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  addCubicBezierCurveStratum,
  addCubicBezierCurveStratumWithResult,
  addPolygonSheetStratum,
  addPolygonSheetStratumWithResult,
  addPolylineCurveStratum,
  addPolylineCurveStratumWithResult,
  addPointStratum,
  addPointStratumFromDirectInput,
  addPointStratumWithResult,
  addTextLabel,
  addTextLabelFromDirectInput,
  addTextLabelWithResult,
  cloneDiagram,
  makeUniqueId,
  normalizeDirectLabelText,
  parseDirectCoordinateInput,
  parseFiniteNumber,
  parseOpacity,
  parsePositiveFiniteNumber,
  removeSelectedElement,
  removeSelectedElementWithLayerFilter,
  updateLabelById,
  updateLabelStyleById,
  updateSelectedElement,
  updateStratumById,
  updateStratumNameById,
  updateStratumStyleById,
  updateVec3Coordinate,
} from '../../src/ui/diagramUpdates.ts'
import {
  isHexColorString,
  normalizeColorInputValue,
} from '../../src/ui/colorInput.ts'
import {
  clearSelectionIfMissing,
  findSelectedElement,
  isSelectedElement,
  selectedElements,
  selectionExistsInDiagram,
  selectionToSerializableModel,
  type SelectedElement,
  updateSelectionForBackgroundClick,
  updateSelectionForClick,
  updateSelectionForCoordinateAnchorVisibility,
} from '../../src/ui/selection.ts'
import {
  clearSelectionForLayerFilter,
  deriveAvailableLayers,
  layerFilterIncludesLayer,
  type LayerFilter,
} from '../../src/ui/layerFilter.ts'

const threeDimensionalSelectionExample: Diagram = {
  version: 1,
  ambientDimension: 3,
  camera: threeDimensionalExample.camera,
  view: threeDimensionalExample.view,
  strata: [
    {
      id: 'blueSheet',
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      name: 'Blue sheet',
      style: {
        kind: 'sheetStyle',
        fillColor: '#4D9DE0',
        fillOpacity: 0.35,
        strokeColor: '#1D6FA5',
        strokeOpacity: 0.9,
      },
      corners: [
        { x: -1, y: -1, z: 0 },
        { x: 2, y: -1, z: 0 },
        { x: 2, y: 1.25, z: 0 },
        { x: -1, y: 1.25, z: 0 },
      ],
      layer: 0,
    },
    {
      id: 'roseSheet',
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      name: 'Rose sheet',
      style: {
        kind: 'sheetStyle',
        fillColor: '#E76F51',
        fillOpacity: 0.22,
        strokeColor: '#9D3D2F',
        strokeOpacity: 0.8,
      },
      corners: [
        { x: -0.5, y: 0.2, z: -0.5 },
        { x: 1.5, y: 0.2, z: -0.5 },
        { x: 1.5, y: 0.2, z: 1.7 },
        { x: -0.5, y: 0.2, z: 1.7 },
      ],
      layer: 1,
    },
    {
      id: 'solidLine',
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      name: 'Solid line defect',
      style: {
        kind: 'curveStyle',
        strokeColor: '#111111',
        strokeOpacity: 1,
        lineWidth: 1.2,
        lineStyle: 'solid',
      },
      points: [
        { x: -0.75, y: -0.75, z: 0.15 },
        { x: 0.25, y: -0.1, z: 0.65 },
        { x: 1.5, y: 0.85, z: 1.1 },
      ],
      styleSegments: [],
      layer: 2,
    },
  ],
  labels: [
    {
      id: 'lineLabel',
      geometricKind: 'label',
      name: 'Line label',
      text: '$F^{(1)}L$',
      position: { x: 0.8, y: 0.15, z: 1.45 },
      style: {
        kind: 'labelStyle',
        color: '#C44536',
        opacity: 1,
        fontSize: 10,
        anchor: 'north',
      },
      layer: 3,
    },
  ],
}

function createEmptyDiagramForTest(ambientDimension: AmbientDimension): Diagram {
  const example =
    ambientDimension === 2
      ? twoDimensionalExample
      : threeDimensionalSelectionExample

  return {
    ...example,
    strata: [],
    labels: [],
  }
}

function createCoordinateSelectionDiagram(): Diagram {
  const diagram = createEmptyDiagramForTest(2)

  return {
    ...diagram,
    coordinateAnchors: [
      createCoordinateAnchor(diagram, {
        id: 'coordA',
        name: 'A',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 0 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
    ],
  }
}

function createCoordinateMultiSelectionDiagram(): Diagram {
  const diagram = createEmptyDiagramForTest(2)

  return {
    ...diagram,
    coordinateAnchors: [
      createCoordinateAnchor(diagram, {
        id: 'coordA',
        name: 'A',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 0 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
      createCoordinateAnchor(diagram, {
        id: 'coordB',
        name: 'B',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 1 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
      createCoordinateAnchor(diagram, {
        id: 'coordC',
        name: 'C',
        position: {
          kind: 'global',
          value: {
            x: { kind: 'numeric', value: 2 },
            y: { kind: 'numeric', value: 0 },
            z: { kind: 'numeric', value: 0 },
          },
        },
      }),
    ],
  }
}

function createReferencedCoordinateDeletionDiagram(): Diagram {
  const diagram = createEmptyDiagramForTest(3)

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
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      position: globalAnchorPosition({
        x: { kind: 'symbolic', expression: 'R', previewValue: 2 },
        y: { kind: 'numeric', value: 0 },
        z: { kind: 'numeric', value: 0 },
      }),
    }),
  ]
  diagram.coordinateAnchors.push(
    createCoordinateAnchor(diagram, {
      id: 'coord-b',
      name: 'B',
      position: globalAnchorPosition({
        x: { kind: 'numeric', value: 4 },
        y: { kind: 'numeric', value: 0 },
        z: { kind: 'numeric', value: 0 },
      }),
    }),
    createCoordinateAnchor(diagram, {
      id: 'coord-c',
      name: 'C',
      position: globalAnchorPosition({
        x: { kind: 'numeric', value: 2 },
        y: { kind: 'numeric', value: 2 },
        z: { kind: 'numeric', value: 0 },
      }),
    }),
  )

  diagram.strata = [
    {
      id: 'ref-path',
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      name: 'Reference path',
      style: defaultCurveStyleForTest(),
      styleSegments: [],
      points: [
        coordinateReferencePoint(diagram, 'coord-a'),
        coordinateReferencePoint(diagram, 'coord-b'),
      ],
      layer: 0,
    },
    {
      id: 'ref-point',
      codim: 3,
      geometricKind: 'point',
      name: 'Reference point',
      style: defaultPointStyleForTest(),
      position: coordinateReferencePoint(diagram, 'coord-a'),
      layer: 0,
    },
    {
      id: 'ref-sheet',
      codim: 1,
      geometricKind: 'sheet',
      kind: 'polygonSheet',
      name: 'Reference sheet',
      style: defaultSheetStyleForTest(),
      vertices: [
        coordinateReferencePoint(diagram, 'coord-a'),
        coordinateReferencePoint(diagram, 'coord-b'),
        coordinateReferencePoint(diagram, 'coord-c'),
      ],
      layer: 0,
    },
  ]
  diagram.labels = [
    {
      id: 'ref-label',
      geometricKind: 'label',
      name: 'Reference label',
      text: '$F$',
      position: coordinateReferencePoint(diagram, 'coord-a'),
      style: defaultLabelStyleForTest(),
      layer: 0,
    },
  ]

  return diagram
}

function createLocalCoordinateDeletionDiagram(): Diagram {
  const diagram = createEmptyDiagramForTest(3)
  const frame = xyFrameForTest()

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
      id: 'coord-p',
      name: 'P',
      tikzName: 'P',
      position: {
        kind: 'workPlaneLocal',
        frame,
        local: {
          a: { kind: 'symbolic', expression: 'R', previewValue: 2 },
          b: { kind: 'numeric', value: 1 },
        },
        preview: { x: 2, y: 1, z: 0 },
      },
    },
  ]
  diagram.strata = [
    {
      id: 'local-path',
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      name: 'Local path',
      style: defaultCurveStyleForTest(),
      styleSegments: [],
      points: [
        coordinateReferencePoint(diagram, 'coord-p'),
        workPlaneLocalPointForTest(frame, 3, 1),
      ],
      layer: 0,
    },
  ]

  return diagram
}

function globalAnchorPosition(
  value: Record<'x' | 'y' | 'z', CoordinateComponent>,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value,
  }
}

function coordinateReferencePoint(diagram: Diagram, coordinateId: string): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate anchor ${coordinateId}.`)
  }

  return point
}

function xyFrameForTest(): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y: 0, z: 0 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function workPlaneLocalPointForTest(
  frame: WorkPlaneFrameSnapshot,
  a: number,
  b: number,
): Vec3 {
  return {
    x: a,
    y: b,
    z: 0,
    symbolic: {
      x: { kind: 'numeric', value: a },
      y: { kind: 'numeric', value: b },
      z: { kind: 'numeric', value: 0 },
      source: {
        kind: 'workPlaneLocal',
        frame: structuredClone(frame) as WorkPlaneFrameSnapshot,
        local: {
          a: { kind: 'numeric', value: a },
          b: { kind: 'numeric', value: b },
        },
      },
    },
  }
}

function defaultCurveStyleForTest(): CurveStyle {
  return {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
  }
}

function defaultPointStyleForTest(): PointStyle {
  return {
    kind: 'pointStyle',
    color: '#000000',
    opacity: 1,
    shape: 'circle',
    fill: 'filled',
    size: 3,
  }
}

function defaultSheetStyleForTest(): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
  }
}

function defaultLabelStyleForTest(): LabelStyle {
  return {
    kind: 'labelStyle',
    color: '#000000',
    opacity: 1,
    fontSize: 10,
    anchor: 'center',
  }
}

function findPolylineCurveForTest(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { geometricKind: 'curve'; kind: 'polyline' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'curve' ||
    stratum.kind !== 'polyline'
  ) {
    throw new Error(`Expected ${id} to be a polyline curve.`)
  }

  return stratum
}

function findPointStratumForTest(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { geometricKind: 'point' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined || stratum.geometricKind !== 'point') {
    throw new Error(`Expected ${id} to be a point.`)
  }

  return stratum
}

function findPolygonSheetForTest(
  diagram: Diagram,
  id: string,
): Extract<Diagram['strata'][number], { geometricKind: 'sheet'; kind: 'polygonSheet' }> {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (
    stratum === undefined ||
    stratum.geometricKind !== 'sheet' ||
    stratum.kind !== 'polygonSheet'
  ) {
    throw new Error(`Expected ${id} to be a polygon sheet.`)
  }

  return stratum
}

test('findSelectedElement finds a selected stratum by id', () => {
  const selected = findSelectedElement(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })

  assert.equal(selected?.kind, 'stratum')
  assert.equal(selected?.element.id, 'visibleWire')
})

test('findSelectedElement finds a selected label by id', () => {
  const selected = findSelectedElement(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })

  assert.equal(selected?.kind, 'label')
  assert.equal(selected?.element.id, 'mathMorphismLabel')
})

test('findSelectedElement finds a selected coordinate anchor by id', () => {
  const diagram = createCoordinateSelectionDiagram()
  const selected = findSelectedElement(diagram, {
    kind: 'coordinate',
    id: 'coordA',
  })

  assert.equal(selected?.kind, 'coordinate')
  assert.equal(selected?.element.id, 'coordA')
})

test('coordinate selection is not cleared by layer filter', () => {
  const diagram = createCoordinateSelectionDiagram()
  const selection: SelectedElement = { kind: 'coordinate', id: 'coordA' }

  assert.deepEqual(
    clearSelectionForLayerFilter(diagram, selection, { kind: 'layer', layer: 99 }),
    selection,
  )
})

test('stale coordinate selection is cleaned after load normalization', () => {
  const serialized = serializeDiagram(createCoordinateSelectionDiagram())
  const parsed = parseSavedDiagramJson(serialized)

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  assert.equal(
    clearSelectionIfMissing(parsed.diagram, {
      kind: 'coordinate',
      id: 'missing-coordinate',
    }),
    null,
  )
})

test('stale coordinate ids are removed from coordinate multi-selection', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const removed = removeSelectedElement(diagram, {
    kind: 'coordinate',
    id: 'coordB',
  })
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
      { kind: 'coordinate', id: 'coordC' },
    ],
  }

  assert.equal(removed.removed, true)
  assert.deepEqual(clearSelectionIfMissing(removed.diagram, selection), {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordC' },
    ],
  })
})

test('click coordinate selects single coordinate anchor', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const selection = updateSelectionForClick(
    diagram,
    null,
    { kind: 'coordinate', id: 'coordA' },
    'replace',
  )

  assert.deepEqual(selection, { kind: 'coordinate', id: 'coordA' })
})

test('Shift-click second coordinate creates coordinate multi-selection', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const selection = updateSelectionForClick(
    diagram,
    { kind: 'coordinate', id: 'coordA' },
    { kind: 'coordinate', id: 'coordB' },
    'toggle',
  )

  assert.deepEqual(selection, {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
    ],
  })
})

test('Shift-click selected coordinate removes it from coordinate multi-selection', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const selection = updateSelectionForClick(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'coordinate', id: 'coordA' },
        { kind: 'coordinate', id: 'coordB' },
      ],
    },
    { kind: 'coordinate', id: 'coordB' },
    'toggle',
  )

  assert.deepEqual(selection, { kind: 'coordinate', id: 'coordA' })
})

test('background click clears coordinate multi-selection', () => {
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
    ],
  }

  assert.equal(updateSelectionForBackgroundClick(selection, 'replace'), null)
})

test('hiding coordinates clears coordinate selection', () => {
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
    ],
  }

  assert.equal(
    updateSelectionForCoordinateAnchorVisibility(selection, false),
    null,
  )
  assert.equal(
    updateSelectionForCoordinateAnchorVisibility(selection, true),
    selection,
  )
})

test('coordinate multi-selection cannot include layer-bound objects in MVP', () => {
  const diagram = {
    ...twoDimensionalExample,
    coordinateAnchors: createCoordinateMultiSelectionDiagram().coordinateAnchors,
  }
  const selection = updateSelectionForClick(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'coordinate', id: 'coordA' },
        { kind: 'coordinate', id: 'coordB' },
      ],
    },
    { kind: 'stratum', id: 'visibleWire' },
    'toggle',
  )

  assert.deepEqual(selection, { kind: 'stratum', id: 'visibleWire' })
})

test('Shift-click coordinate while layer-bound selection exists starts coordinate selection', () => {
  const diagram = {
    ...twoDimensionalExample,
    coordinateAnchors: createCoordinateMultiSelectionDiagram().coordinateAnchors,
  }
  const selection = updateSelectionForClick(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'visibleWire' },
        { kind: 'stratum', id: 'dashedMorphism' },
      ],
    },
    { kind: 'coordinate', id: 'coordA' },
    'toggle',
  )

  assert.deepEqual(selection, { kind: 'coordinate', id: 'coordA' })
})

test('removeSelectedElement deletes an unused coordinate anchor', () => {
  const result = removeSelectedElement(createCoordinateSelectionDiagram(), {
    kind: 'coordinate',
    id: 'coordA',
  })

  assert.equal(result.removed, true)
  assert.equal(result.detachedCoordinateReferenceCount, 0)
  assert.equal(result.selectedElement, null)
  assert.equal(result.diagram.coordinateAnchors?.length, 0)
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('removeSelectedElement detaches coordinate refs before deleting a referenced coordinate', () => {
  const result = removeSelectedElement(createReferencedCoordinateDeletionDiagram(), {
    kind: 'coordinate',
    id: 'coord-a',
  })

  assert.equal(result.removed, true)
  assert.equal(result.detachedCoordinateReferenceCount, 4)
  assert.equal(validateDiagram(result.diagram).valid, true)
  assert.equal(
    result.diagram.coordinateAnchors?.some((anchor) => anchor.id === 'coord-a'),
    false,
  )
  assert.equal(JSON.stringify(result.diagram).includes('"coordinateId":"coord-a"'), false)

  const curve = findPolylineCurveForTest(result.diagram, 'ref-path')
  const detachedEndpoint = curve.points[0]

  assert.equal(coordinateReferenceSourceForPoint(detachedEndpoint), null)
  assert.equal(detachedEndpoint.x, 2)
  assert.equal(detachedEndpoint.symbolic?.x.kind, 'symbolic')
  assert.equal(
    detachedEndpoint.symbolic?.x.kind === 'symbolic'
      ? detachedEndpoint.symbolic.x.expression
      : '',
    'R',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(curve.points[1])?.coordinateId,
    'coord-b',
  )
  assert.equal(
    coordinateReferenceSourceForPoint(
      findPointStratumForTest(result.diagram, 'ref-point').position,
    ),
    null,
  )
  assert.equal(
    coordinateReferenceSourceForPoint(
      findPolygonSheetForTest(result.diagram, 'ref-sheet').vertices[0],
    ),
    null,
  )
  assert.equal(
    coordinateReferenceSourceForPoint(
      result.diagram.labels.find((label) => label.id === 'ref-label')?.position ??
        { x: 0, y: 0, z: 0 },
    ),
    null,
  )

  const resolved = resolveDiagramCoordinateRefs(result.diagram)
  const resolvedCurve = findPolylineCurveForTest(resolved, 'ref-path')
  const tikz = generateTikz(result.diagram)

  assert.deepEqual(
    {
      x: resolvedCurve.points[0].x,
      y: resolvedCurve.points[0].y,
      z: resolvedCurve.points[0].z,
    },
    { x: 2, y: 0, z: 0 },
  )
  assert.doesNotMatch(tikz, /\\coordinate \(A\)/)
  assert.doesNotMatch(tikz, /\(A\)/)
  assert.doesNotMatch(tikz, /unresolvedCoordinateRef/)
  assert.match(tikz, /\(\{\\R\},0,0\)/)
})

test('removeSelectedElement preserves work-plane-local source when detaching a local coordinate', () => {
  const diagram = createLocalCoordinateDeletionDiagram()
  const originalPosition = diagram.coordinateAnchors?.[0]?.position
  const originalFrame =
    originalPosition?.kind === 'workPlaneLocal' ? originalPosition.frame : null
  const result = removeSelectedElement(diagram, {
    kind: 'coordinate',
    id: 'coord-p',
  })

  assert.equal(result.removed, true)
  assert.equal(result.detachedCoordinateReferenceCount, 1)
  assert.equal(validateDiagram(result.diagram).valid, true)

  const curve = findPolylineCurveForTest(result.diagram, 'local-path')
  const source = curve.points[0].symbolic?.source
  const tikz = generateTikz(result.diagram)

  assert.equal(source?.kind, 'workPlaneLocal')
  if (source?.kind !== 'workPlaneLocal') {
    throw new Error('Expected detached local source.')
  }
  assert.equal(source.local.a.kind, 'symbolic')
  assert.equal(source.local.a.kind === 'symbolic' ? source.local.a.expression : '', 'R')
  assert.deepEqual(source.frame, xyFrameForTest())
  assert.notEqual(source.frame, originalFrame)
  assert.doesNotMatch(tikz, /\\coordinate \(P\)/)
  assert.doesNotMatch(tikz, /\(P\)/)
  assert.match(tikz, /\(\{\\R\},1\) -- \(3,1\)/)
})

test('clearSelectionIfMissing clears selection when switching diagrams', () => {
  const selection: SelectedElement = { kind: 'stratum', id: 'visibleWire' }

  assert.equal(selectionExistsInDiagram(twoDimensionalExample, selection), true)
  assert.equal(
    selectionExistsInDiagram(threeDimensionalSelectionExample, selection),
    false,
  )
  assert.equal(
    clearSelectionIfMissing(threeDimensionalSelectionExample, selection),
    null,
  )
})

test('single click selects one object', () => {
  const selection = updateSelectionForClick(
    twoDimensionalExample,
    null,
    { kind: 'stratum', id: 'visibleWire' },
    'replace',
  )

  assert.deepEqual(selection, { kind: 'stratum', id: 'visibleWire' })
})

test('Shift-click adds a same-geometric-kind object to multi-selection', () => {
  const selection = updateSelectionForClick(
    twoDimensionalExample,
    { kind: 'stratum', id: 'visibleWire' },
    { kind: 'stratum', id: 'dashedMorphism' },
    'toggle',
  )

  assert.deepEqual(selection, {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'visibleWire' },
      { kind: 'stratum', id: 'dashedMorphism' },
    ],
  })
})

test('Shift-click selected object removes it from multi-selection', () => {
  const selection = updateSelectionForClick(
    twoDimensionalExample,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'visibleWire' },
        { kind: 'stratum', id: 'dashedMorphism' },
      ],
    },
    { kind: 'stratum', id: 'dashedMorphism' },
    'toggle',
  )

  assert.deepEqual(selection, { kind: 'stratum', id: 'visibleWire' })
})

test('modifier-clicking a different geometric kind replaces selection', () => {
  const selection = updateSelectionForClick(
    twoDimensionalExample,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'visibleWire' },
        { kind: 'stratum', id: 'dashedMorphism' },
      ],
    },
    { kind: 'stratum', id: 'circlePoint' },
    'toggle',
  )

  assert.deepEqual(selection, { kind: 'stratum', id: 'circlePoint' })
})

test('background click clears multi-selection while modifier background preserves it', () => {
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'visibleWire' },
      { kind: 'stratum', id: 'dashedMorphism' },
    ],
  }

  assert.equal(updateSelectionForBackgroundClick(selection, 'replace'), null)
  assert.equal(updateSelectionForBackgroundClick(selection, 'toggle'), selection)
})

test('deleting an object cleans stale selected ids from multi-selection', () => {
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'visibleWire' },
      { kind: 'stratum', id: 'dashedMorphism' },
    ],
  }
  const removed = removeSelectedElement(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })

  assert.equal(removed.removed, true)
  assert.deepEqual(clearSelectionIfMissing(removed.diagram, selection), {
    kind: 'stratum',
    id: 'dashedMorphism',
  })
})

test('inspector summary displays multi-selection count and kind', () => {
  const summary = createInspectorCompactSummary(twoDimensionalExample, {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'visibleWire' },
      { kind: 'stratum', id: 'dashedMorphism' },
      { kind: 'stratum', id: 'hiddenWire' },
    ],
  })

  assert.notEqual(summary, null)
  assert.equal(summary?.title, '3 curves selected')
  assert.equal(summary?.layer, 'multiple')
  assert.equal(
    summary?.detail,
    'Bulk style, layer, delete, and duplicate available.',
  )
})

test('inspector summary displays coordinate multi-selection count', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const summary = createInspectorCompactSummary(diagram, {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
      { kind: 'coordinate', id: 'coordC' },
    ],
  })

  assert.notEqual(summary, null)
  assert.equal(summary?.title, '3 coordinates selected')
  assert.equal(summary?.layer, null)
  assert.equal(
    summary?.detail,
    'Translate selected coordinates will be available later.',
  )
})

test('selected highlighting helper includes all multi-selected ids', () => {
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'visibleWire' },
      { kind: 'stratum', id: 'dashedMorphism' },
    ],
  }

  assert.equal(
    isSelectedElement(selection, { kind: 'stratum', id: 'visibleWire' }),
    true,
  )
  assert.equal(
    isSelectedElement(selection, { kind: 'stratum', id: 'dashedMorphism' }),
    true,
  )
  assert.equal(
    isSelectedElement(selection, { kind: 'stratum', id: 'circlePoint' }),
    false,
  )
})

test('selection state is not saved to diagram JSON', () => {
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'visibleWire' },
      { kind: 'stratum', id: 'dashedMorphism' },
    ],
  }
  const serialized = serializeDiagram(twoDimensionalExample)
  const parsed = JSON.parse(serialized) as Record<string, unknown>

  assert.deepEqual(selectionToSerializableModel(selection), {
    kind: 'multi',
    ids: ['visibleWire', 'dashedMorphism'],
  })
  assert.equal('selectedElement' in parsed, false)
  assert.equal('selection' in parsed, false)
})

test('coordinate multi-selection state is not saved to diagram JSON', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
    ],
  }
  const serialized = serializeDiagram(diagram)
  const parsed = JSON.parse(serialized) as Record<string, unknown>

  assert.deepEqual(selectionToSerializableModel(selection), {
    kind: 'multi',
    ids: ['coordA', 'coordB'],
  })
  assert.equal('selectedElement' in parsed, false)
  assert.equal('selection' in parsed, false)
})

test('TikZ output is unaffected by selection operations', () => {
  const before = generateTikz(twoDimensionalExample)
  const selection = updateSelectionForClick(
    twoDimensionalExample,
    { kind: 'stratum', id: 'visibleWire' },
    { kind: 'stratum', id: 'dashedMorphism' },
    'toggle',
  )

  assert.equal(selectedElements(selection).length, 2)
  assert.equal(generateTikz(twoDimensionalExample), before)
})

test('TikZ output is unaffected by coordinate selection state', () => {
  const diagram = createCoordinateMultiSelectionDiagram()
  const before = generateTikz(diagram)
  const selection: SelectedElement = {
    kind: 'multi',
    elements: [
      { kind: 'coordinate', id: 'coordA' },
      { kind: 'coordinate', id: 'coordB' },
    ],
  }

  assert.equal(selectedElements(selection).length, 2)
  assert.equal(generateTikz(diagram), before)
})

test('formatVec3 formats 2D coordinates without z', () => {
  assert.equal(formatVec3({ x: 1.23456, y: -0, z: 2 }, 2), '(1.235, 0)')
})

test('formatVec3 formats 3D coordinates with z', () => {
  assert.equal(formatVec3({ x: 1.23456, y: -0, z: 2 }, 3), '(1.235, 0, 2)')
})

test('createInspectorSections reports curve geometry and style summaries', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'dashedMorphism',
  })

  assert.equal(sections[0].title, 'Selection')
  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Curve kind' && field.value === 'cubicBezier'),
    true,
  )
  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.value.includes('dashed')),
    true,
  )
})

test('describeCurvePoints labels cubic Bezier points semantically', () => {
  const curve = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'dashedMorphism',
  )

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'cubicBezier')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected dashedMorphism to be a curve.')
  }

  assert.deepEqual(
    describeCurvePoints(curve).map((description) => description.label),
    ['Start', 'Control point 1', 'Control point 2', 'End'],
  )
})

test('describeCurvePoints labels polyline points as vertices', () => {
  const curve = threeDimensionalSelectionExample.strata.find(
    (stratum) => stratum.id === 'solidLine',
  )

  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(curve?.kind, 'polyline')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected solidLine to be a curve.')
  }

  assert.deepEqual(
    describeCurvePoints(curve).map((description) => description.label),
    ['Vertex 0', 'Vertex 1', 'Vertex 2'],
  )
})

test('createInspectorSections shows cubic Bezier control point labels', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'dashedMorphism',
  })
  const labels = sections.flatMap((section) =>
    section.fields.map((field) => field.label),
  )

  assert.equal(labels.includes('Start'), true)
  assert.equal(labels.includes('Control point 1'), true)
  assert.equal(labels.includes('Control point 2'), true)
  assert.equal(labels.includes('End'), true)
})

test('2D cubic Bezier control point coordinates omit z', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'dashedMorphism',
  })
  const fields = sections.flatMap((section) => section.fields)

  assert.equal(
    fields.some(
      (field) =>
        field.label === 'Control point 1' && field.value === '(-0.7, 2.3)',
    ),
    true,
  )
  assert.equal(
    fields.some(
      (field) =>
        field.label === 'Control point 2' && field.value === '(0.8, 0.9)',
    ),
    true,
  )
})

test('2D point position coordinates omit z', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'circlePoint',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Position' && field.value === '(-0.75, 1)'),
    true,
  )
})

test('3D polyline vertex coordinates include z', () => {
  const sections = createInspectorSections(threeDimensionalSelectionExample, {
    kind: 'stratum',
    id: 'solidLine',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some(
        (field) =>
          field.label === 'Vertex 0' && field.value === '(-0.75, -0.75, 0.15)',
      ),
    true,
  )
})

test('3D sheet corner coordinates include z', () => {
  const sections = createInspectorSections(threeDimensionalSelectionExample, {
    kind: 'stratum',
    id: 'roseSheet',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some(
        (field) =>
          field.label === 'Corner 1' && field.value === '(-0.5, 0.2, -0.5)',
      ),
    true,
  )
})

test('label positions follow ambient dimension coordinate display', () => {
  const twoDSections = createInspectorSections(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })
  const threeDSections = createInspectorSections(threeDimensionalSelectionExample, {
    kind: 'label',
    id: 'lineLabel',
  })

  assert.equal(
    twoDSections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Position' && field.value === '(0.15, 1.75)'),
    true,
  )
  assert.equal(
    threeDSections
      .flatMap((section) => section.fields)
      .some(
        (field) =>
          field.label === 'Position' && field.value === '(0.8, 0.15, 1.45)',
      ),
    true,
  )
})

test('createInspectorSections reports free text label content', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })

  assert.equal(
    sections
      .flatMap((section) => section.fields)
      .some((field) => field.label === 'Text' && field.value === '$F^{(1)}L$'),
    true,
  )
})

test('createInspectorCompactSummary identifies selected strata compactly', () => {
  const summary = createInspectorCompactSummary(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })

  assert.notEqual(summary, null)
  assert.equal(summary?.title, 'Curve: Visible wire [visibleWire]')
  assert.equal(summary?.layer, '0')
  assert.equal(summary?.detail, 'codim 1')
})

test('createInspectorCompactSummary identifies selected free text labels compactly', () => {
  const summary = createInspectorCompactSummary(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })

  assert.notEqual(summary, null)
  assert.equal(summary?.title, 'Label: $F^{(1)}L$ [mathMorphismLabel]')
  assert.equal(summary?.layer, '11')
  assert.equal(summary?.detail, 'position (0.15, 1.75)')
})

test('inspector disclosure collapses only when the selection key changes', () => {
  const selectedWire: SelectedElement = {
    kind: 'stratum',
    id: 'visibleWire',
  }
  const selectedPoint: SelectedElement = {
    kind: 'stratum',
    id: 'circlePoint',
  }
  const expanded = setInspectorDisclosureExpanded(
    {
      selectionKey: selectedElementDisclosureKey(selectedWire),
      expanded: false,
    },
    selectedWire,
    true,
  )

  assert.equal(expanded.expanded, true)
  assert.equal(
    nextInspectorDisclosureStateForSelection(expanded, {
      kind: 'stratum',
      id: 'visibleWire',
    }),
    expanded,
  )
  assert.deepEqual(
    nextInspectorDisclosureStateForSelection(expanded, selectedPoint),
    {
      selectionKey: selectedElementDisclosureKey(selectedPoint),
      expanded: false,
    },
  )
  assert.deepEqual(nextInspectorDisclosureStateForSelection(expanded, null), {
    selectionKey: null,
    expanded: false,
  })
})

test('style summaries display opacity with readable labels', () => {
  const curve = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'hiddenWire',
  )

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected hiddenWire to be a curve.')
  }

  const summary = formatStratumStyleSummary(curve.style)

  assert.equal(summary.includes('@'), false)
  assert.equal(summary.includes('stroke opacity: 0.85'), true)
  assert.equal(summary.includes('line style: denselyDotted'), true)
})

test('label style summaries display opacity with readable labels', () => {
  const label = twoDimensionalExample.labels.find(
    (textLabel) => textLabel.id === 'mathMorphismLabel',
  )

  assert.notEqual(label, undefined)

  if (label === undefined) {
    throw new Error('Expected mathMorphismLabel to exist.')
  }

  const summary = formatLabelStyleSummary(label.style)

  assert.equal(summary.includes('@'), false)
  assert.equal(summary.includes('opacity: 1'), true)
  assert.equal(summary.includes('anchor: south'), true)
})

test('style summaries omit missing opacity values cleanly', () => {
  const style = {
    kind: 'curveStyle',
    strokeColor: '#000000',
    lineWidth: 1.2,
    lineStyle: 'solid',
  } as unknown as CurveStyle
  const summary = formatStratumStyleSummary(style)

  assert.equal(summary.includes('@'), false)
  assert.equal(summary.includes('undefined'), false)
  assert.equal(summary.includes('stroke opacity'), false)
  assert.equal(summary.includes('line width: 1.2pt'), true)
})

test('stratum attached label is reported as metadata in helper output', () => {
  const sections = createInspectorSections(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })
  const fields = sections.flatMap((section) => section.fields)

  assert.equal(
    fields.some((field) => field.label === 'Attached label metadata'),
    true,
  )
  assert.equal(fields.some((field) => field.label === 'Attached label'), false)
})

test('updateStratumById returns a new diagram without mutating the original', () => {
  const originalName = twoDimensionalExample.strata[0].name
  const updated = updateStratumById(
    twoDimensionalExample,
    'visibleWire',
    (stratum) => ({
      ...stratum,
      name: 'Edited wire',
    }),
  )
  const updatedStratum = updated.strata.find(
    (stratum) => stratum.id === 'visibleWire',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updatedStratum?.name, 'Edited wire')
  assert.equal(twoDimensionalExample.strata[0].name, originalName)
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'hiddenWire'),
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'hiddenWire'),
  )
  assert.equal(updated.labels, twoDimensionalExample.labels)
})

test('updateStratumNameById updates valid non-empty names', () => {
  const updated = updateStratumNameById(
    twoDimensionalExample,
    'visibleWire',
    'my curve',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'visibleWire')?.name,
    'my curve',
  )
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'hiddenWire'),
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'hiddenWire'),
  )
  assert.equal(updated.labels, twoDimensionalExample.labels)
})

test('updateStratumNameById rejects empty names', () => {
  const updated = updateStratumNameById(twoDimensionalExample, 'visibleWire', '')

  assert.equal(updated, twoDimensionalExample)
  assert.equal(
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'visibleWire')
      ?.name,
    'Visible wire',
  )
})

test('updateStratumNameById rejects whitespace-only names', () => {
  const updated = updateStratumNameById(twoDimensionalExample, 'visibleWire', '   ')

  assert.equal(updated, twoDimensionalExample)
  assert.equal(
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'visibleWire')
      ?.name,
    'Visible wire',
  )
})

test('updateLabelById returns a new diagram and preserves unrelated strata', () => {
  const updated = updateLabelById(
    twoDimensionalExample,
    'mathMorphismLabel',
    (label) => ({
      ...label,
      text: '$G$',
      layer: 7,
    }),
  )
  const updatedLabel = updated.labels.find(
    (label) => label.id === 'mathMorphismLabel',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updatedLabel?.text, '$G$')
  assert.equal(updatedLabel?.layer, 7)
  assert.equal(
    twoDimensionalExample.labels.find((label) => label.id === 'mathMorphismLabel')
      ?.text,
    '$F^{(1)}L$',
  )
  assert.equal(updated.strata, twoDimensionalExample.strata)
})

test('removeSelectedElement removes a selected stratum by id', () => {
  const result = removeSelectedElement(twoDimensionalExample, {
    kind: 'stratum',
    id: 'visibleWire',
  })

  assert.equal(result.removed, true)
  assert.equal(result.selectedElement, null)
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === 'visibleWire'),
    false,
  )
  assert.equal(
    result.diagram.strata.length,
    twoDimensionalExample.strata.length - 1,
  )
  assert.equal(result.diagram.labels, twoDimensionalExample.labels)
})

test('removeSelectedElement removes a selected free text label by id', () => {
  const result = removeSelectedElement(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })

  assert.equal(result.removed, true)
  assert.equal(result.selectedElement, null)
  assert.equal(
    result.diagram.labels.some((label) => label.id === 'mathMorphismLabel'),
    false,
  )
  assert.equal(
    result.diagram.labels.length,
    twoDimensionalExample.labels.length - 1,
  )
  assert.equal(result.diagram.strata, twoDimensionalExample.strata)
})

test('removeSelectedElement safely clears a stale selection without changing diagram data', () => {
  const result = removeSelectedElement(twoDimensionalExample, {
    kind: 'stratum',
    id: 'missing-stratum',
  })

  assert.equal(result.removed, false)
  assert.equal(result.diagram, twoDimensionalExample)
  assert.equal(result.selectedElement, null)
})

test('removeSelectedElement removes at most one matching element', () => {
  const duplicateIdDiagram = {
    ...twoDimensionalExample,
    strata: [
      ...twoDimensionalExample.strata,
      {
        ...twoDimensionalExample.strata[0],
        id: 'visibleWire',
      },
    ],
  }
  const result = removeSelectedElement(duplicateIdDiagram, {
    kind: 'stratum',
    id: 'visibleWire',
  })

  assert.equal(result.removed, true)
  assert.equal(
    result.diagram.strata.filter((stratum) => stratum.id === 'visibleWire')
      .length,
    1,
  )
})

test('removeSelectedElementWithLayerFilter resets a stale layer filter after deletion', () => {
  const diagram = {
    ...twoDimensionalExample,
    strata: [
      {
        ...twoDimensionalExample.strata[0],
        id: 'only-layer-seven-stratum',
        layer: 7,
      },
      {
        ...twoDimensionalExample.strata[1],
        id: 'remaining-layer-two-stratum',
        layer: 2,
      },
    ],
    labels: [
      {
        ...twoDimensionalExample.labels[0],
        id: 'remaining-layer-two-label',
        layer: 2,
      },
    ],
  }

  const result = removeSelectedElementWithLayerFilter(
    diagram,
    { kind: 'stratum', id: 'only-layer-seven-stratum' },
    { kind: 'layer', layer: 7 },
  )
  const remainingStratum = result.diagram.strata.find(
    (stratum) => stratum.id === 'remaining-layer-two-stratum',
  )

  assert.equal(result.removed, true)
  assert.deepEqual(result.layerFilter, { kind: 'all' })
  assert.equal(deriveAvailableLayers(result.diagram).includes(7), false)
  assert.equal(remainingStratum === undefined, false)
  assert.equal(
    remainingStratum === undefined
      ? false
      : layerFilterIncludesLayer(result.layerFilter, remainingStratum.layer),
    true,
  )
})

test('removeSelectedElementWithLayerFilter does not remove locked layer elements', () => {
  const diagram = setLayerLock(
    {
      ...twoDimensionalExample,
      strata: [
        {
          ...twoDimensionalExample.strata[0],
          id: 'locked-layer-stratum',
          layer: 7,
        },
      ],
      labels: [],
    },
    7,
    true,
  )
  const result = removeSelectedElementWithLayerFilter(
    diagram,
    { kind: 'stratum', id: 'locked-layer-stratum' },
    { kind: 'layer', layer: 7 },
  )

  assert.equal(result.removed, false)
  assert.equal(result.selectedElement, null)
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === 'locked-layer-stratum'),
    true,
  )
})

test('generated TikZ no longer includes a removed selected element', () => {
  const result = removeSelectedElement(twoDimensionalExample, {
    kind: 'label',
    id: 'mathMorphismLabel',
  })
  const tikz = generateTikz(result.diagram)

  assert.equal(tikz.includes('$F^{(1)}L$'), false)
})

test('makeUniqueId avoids collisions across top-level diagram ids', () => {
  const diagram = {
    ...twoDimensionalExample,
    strata: [
      ...twoDimensionalExample.strata,
      {
        ...twoDimensionalExample.strata[0],
        id: 'point-1',
      },
    ],
    labels: [
      ...twoDimensionalExample.labels,
      {
        ...twoDimensionalExample.labels[0],
        id: 'point-2',
      },
    ],
    coordinateAnchors: [
      createCoordinateAnchor(twoDimensionalExample, {
        id: 'point-3',
        name: 'Reserved point id',
        position: globalAnchorPosition({
          x: { kind: 'numeric', value: 0 },
          y: { kind: 'numeric', value: 0 },
          z: { kind: 'numeric', value: 0 },
        }),
      }),
    ],
  }

  assert.equal(makeUniqueId(diagram, 'point'), 'point-4')
})

test('addPointStratum returns a new 2D diagram with codim 2 and z normalized', () => {
  const updated = addPointStratum(
    twoDimensionalExample,
    { x: 3, y: 4, z: 9 },
    { id: 'point-1' },
  )
  const point = updated.strata.find((stratum) => stratum.id === 'point-1')

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updated.labels, twoDimensionalExample.labels)
  assert.equal(twoDimensionalExample.strata.some((stratum) => stratum.id === 'point-1'), false)
  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected added stratum to be a point.')
  }

  assert.equal(point.codim, 2)
  assert.deepEqual(point.position, { x: 3, y: 4, z: 0 })
  assert.equal(point.name.length > 0, true)
})

test('addPointStratumWithResult returns the updated diagram and created id atomically', () => {
  const result = addPointStratumWithResult(
    twoDimensionalExample,
    { x: 3, y: 4, z: 9 },
  )

  assert.equal(result.id, 'point-1')
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === result.id),
    true,
  )
})

test('addPointStratum returns a new 3D diagram with codim 3', () => {
  const updated = addPointStratum(
    threeDimensionalSelectionExample,
    { x: 3, y: 4, z: 5 },
    { id: 'point-1' },
  )
  const point = updated.strata.find((stratum) => stratum.id === 'point-1')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected added stratum to be a point.')
  }

  assert.equal(point.codim, 3)
  assert.deepEqual(point.position, { x: 3, y: 4, z: 5 })
})

test('direct-created 2D point has z normalized to 0 and codim 2', () => {
  const diagram = createEmptyDiagramForTest(2)
  const result = addPointStratumFromDirectInput(
    diagram,
    { x: '1.5', y: '-2', z: '99' },
    { id: 'direct-point' },
  )

  assert.equal(result.ok, true)

  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const point = result.diagram.strata.find(
    (stratum) => stratum.id === 'direct-point',
  )

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected direct-created stratum to be a point.')
  }

  assert.equal(point.codim, 2)
  assert.deepEqual(point.position, { x: 1.5, y: -2, z: 0 })
})

test('direct-created 3D point preserves z and has codim 3', () => {
  const diagram = createEmptyDiagramForTest(3)
  const result = addPointStratumFromDirectInput(
    diagram,
    { x: '1', y: '2', z: '3.25' },
    { id: 'direct-point' },
  )

  assert.equal(result.ok, true)

  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const point = result.diagram.strata.find(
    (stratum) => stratum.id === 'direct-point',
  )

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected direct-created stratum to be a point.')
  }

  assert.equal(point.codim, 3)
  assert.deepEqual(point.position, { x: 1, y: 2, z: 3.25 })
})

test('direct-created point on the visible New layer remains selected', () => {
  const activeLayer = 2
  const layerFilter: LayerFilter = { kind: 'layer', layer: activeLayer }
  const result = addPointStratumFromDirectInput(
    twoDimensionalExample,
    { x: '1', y: '2', z: '99' },
    {
      id: 'filtered-direct-point',
      layer: activeLayer,
    },
  )

  assert.equal(result.ok, true)

  if (!result.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const point = result.diagram.strata.find(
    (stratum) => stratum.id === 'filtered-direct-point',
  )

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected direct-created stratum to be a point.')
  }

  const selection: SelectedElement = { kind: 'stratum', id: result.id }

  assert.equal(point.layer, activeLayer)
  assert.equal(layerFilterIncludesLayer(layerFilter, point.layer), true)
  assert.deepEqual(
    clearSelectionForLayerFilter(result.diagram, selection, layerFilter),
    selection,
  )
})

test('addPolygonSheetStratum returns a new 3D diagram with codim 1', () => {
  const vertices = [
    { x: 0, y: 0, z: 1 },
    { x: 2, y: 0, z: 1 },
    { x: 1, y: 1, z: 1 },
  ]
  const updated = addPolygonSheetStratum(
    threeDimensionalSelectionExample,
    vertices,
    { id: 'sheet-1' },
  )
  const sheet = updated.strata.find((stratum) => stratum.id === 'sheet-1')

  assert.notEqual(updated, threeDimensionalSelectionExample)
  assert.equal(updated.labels, threeDimensionalSelectionExample.labels)
  assert.equal(
    threeDimensionalSelectionExample.strata.some(
      (stratum) => stratum.id === 'sheet-1',
    ),
    false,
  )
  assert.equal(sheet?.geometricKind, 'sheet')

  if (sheet?.geometricKind !== 'sheet') {
    throw new Error('Expected added stratum to be a sheet.')
  }

  assert.equal(sheet.codim, 1)
  assert.equal(sheet.kind, 'polygonSheet')
  if (sheet.kind !== 'polygonSheet') {
    throw new Error('Expected added sheet to be a polygon sheet.')
  }
  assert.deepEqual(sheet.vertices, vertices)
  assert.equal(sheet.name.length > 0, true)
  assert.equal(sheet.style.kind, 'sheetStyle')
  assert.equal(validateDiagram(updated).valid, true)
})

test('addPolygonSheetStratumWithResult returns the updated diagram and created id atomically', () => {
  const diagram = {
    ...threeDimensionalSelectionExample,
    strata: [
      ...threeDimensionalSelectionExample.strata,
      {
        ...threeDimensionalSelectionExample.strata[0],
        id: 'sheet-1',
      },
    ],
  }
  const result = addPolygonSheetStratumWithResult(diagram, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ])

  assert.equal(result.id, 'sheet-2')
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === result.id),
    true,
  )
})

test('addPolygonSheetStratumWithResult safely rejects invalid sheet creation', () => {
  const twoPointResult = addPolygonSheetStratumWithResult(
    threeDimensionalSelectionExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
  )
  const twoDimensionalResult = addPolygonSheetStratumWithResult(twoDimensionalExample, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ])

  assert.equal(twoPointResult.diagram, threeDimensionalSelectionExample)
  assert.equal(twoPointResult.id, null)
  assert.equal(twoDimensionalResult.diagram, twoDimensionalExample)
  assert.equal(twoDimensionalResult.id, null)
})

test('addPolygonSheetStratumWithResult rejects non-finite vertices', () => {
  const invalidValues = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]

  for (const invalidValue of invalidValues) {
    const result = addPolygonSheetStratumWithResult(
      threeDimensionalSelectionExample,
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: invalidValue, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
    )

    assert.equal(result.diagram, threeDimensionalSelectionExample)
    assert.equal(result.id, null)
    assert.equal(
      result.diagram.strata.some((stratum) => stratum.id === 'sheet-1'),
      false,
    )
  }
})

test('addPolylineCurveStratum returns a new 2D diagram with codim 1 and z normalized', () => {
  const updated = addPolylineCurveStratum(
    twoDimensionalExample,
    [
      { x: 1, y: 2, z: 8 },
      { x: 3, y: 4, z: 9 },
    ],
    { id: 'curve-1' },
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'curve-1')

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updated.labels, twoDimensionalExample.labels)
  assert.equal(
    twoDimensionalExample.strata.some((stratum) => stratum.id === 'curve-1'),
    false,
  )
  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected added stratum to be a curve.')
  }

  assert.equal(curve.codim, 1)
  assert.equal(curve.kind, 'polyline')
  assert.deepEqual(curve.points, [
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
  ])
  assert.equal(curve.name.length > 0, true)
  assert.equal(curve.style.kind, 'curveStyle')
  assert.equal(curve.style.lineWidth > 0, true)
})

test('addPolylineCurveStratum returns a new 3D diagram with codim 2', () => {
  const updated = addPolylineCurveStratum(
    threeDimensionalSelectionExample,
    [
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ],
    { id: 'curve-1' },
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'curve-1')

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected added stratum to be a curve.')
  }

  assert.equal(curve.codim, 2)
  assert.deepEqual(curve.points, [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 },
  ])
})

test('addPolylineCurveStratumWithResult returns the updated diagram and created id atomically', () => {
  const diagram = {
    ...twoDimensionalExample,
    strata: [
      ...twoDimensionalExample.strata,
      {
        ...twoDimensionalExample.strata[0],
        id: 'curve-1',
      },
    ],
  }
  const result = addPolylineCurveStratumWithResult(diagram, [
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 4, z: 0 },
  ])

  assert.equal(result.id, 'curve-2')
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === result.id),
    true,
  )
})

test('addPolylineCurveStratumWithResult safely rejects fewer than 2 points', () => {
  const result = addPolylineCurveStratumWithResult(twoDimensionalExample, [
    { x: 1, y: 2, z: 0 },
  ])

  assert.equal(result.diagram, twoDimensionalExample)
  assert.equal(result.id, null)
})

test('addPolylineCurveStratumWithResult ignores a colliding custom id', () => {
  const result = addPolylineCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 4, z: 0 },
    ],
    { id: 'visibleWire' },
  )

  assert.equal(result.id, 'curve-1')
  assert.equal(
    result.diagram.strata.filter((stratum) => stratum.id === 'visibleWire')
      .length,
    1,
  )
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('addPolylineCurveStratumWithResult rejects blank custom names safely', () => {
  for (const name of ['', '   ']) {
    const result = addPolylineCurveStratumWithResult(
      twoDimensionalExample,
      [
        { x: 1, y: 2, z: 0 },
        { x: 3, y: 4, z: 0 },
      ],
      { id: `blank-name-${name.length}`, name },
    )
    const curve = result.diagram.strata.find((stratum) => stratum.id === result.id)

    assert.equal(curve?.geometricKind, 'curve')

    if (curve?.geometricKind !== 'curve') {
      throw new Error('Expected added stratum to be a curve.')
    }

    assert.equal(curve.name, 'Curve')
    assert.equal(validateDiagram(result.diagram).valid, true)
  }
})

test('addPolylineCurveStratumWithResult accepts trimmed custom id and name', () => {
  const result = addPolylineCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 4, z: 0 },
    ],
    { id: ' custom-curve ', name: '  Custom curve  ' },
  )
  const curve = result.diagram.strata.find((stratum) => stratum.id === result.id)

  assert.equal(result.id, 'custom-curve')
  assert.notEqual(result.diagram, twoDimensionalExample)
  assert.equal(twoDimensionalExample.strata.some((stratum) => stratum.id === result.id), false)
  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected added stratum to be a curve.')
  }

  assert.equal(curve.name, 'Custom curve')
  assert.equal(validateDiagram(result.diagram).valid, true)
})

test('addCubicBezierCurveStratum returns a new 2D diagram with codim 1 and z normalized', () => {
  const points = [
    { x: 0, y: 0, z: 8 },
    { x: 1, y: 2, z: 9 },
    { x: 3, y: 2, z: 10 },
    { x: 4, y: 0, z: 11 },
  ]
  const updated = addCubicBezierCurveStratum(
    twoDimensionalExample,
    points,
    { id: 'curve-1' },
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'curve-1')

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updated.labels, twoDimensionalExample.labels)
  assert.equal(
    twoDimensionalExample.strata.some((stratum) => stratum.id === 'curve-1'),
    false,
  )
  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected added stratum to be a curve.')
  }

  assert.equal(curve.codim, 1)
  assert.equal(curve.kind, 'cubicBezier')
  assert.deepEqual(curve.points, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: 4, y: 0, z: 0 },
  ])
  assert.equal(curve.name.length > 0, true)
  assert.equal(curve.style.kind, 'curveStyle')
  assert.equal(curve.style.lineWidth > 0, true)
  assert.equal(validateDiagram(updated).valid, true)
})

test('addCubicBezierCurveStratum returns a new 3D diagram with codim 2', () => {
  const points = [
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 2, z: 3 },
    { x: 3, y: 2, z: 4 },
    { x: 4, y: 0, z: 5 },
  ]
  const updated = addCubicBezierCurveStratum(
    threeDimensionalSelectionExample,
    points,
    { id: 'curve-1' },
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'curve-1')

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected added stratum to be a curve.')
  }

  assert.equal(curve.codim, 2)
  assert.deepEqual(curve.points, points)
  assert.equal(validateDiagram(updated).valid, true)
})

test('addCubicBezierCurveStratumWithResult returns the updated diagram and created id atomically', () => {
  const diagram = {
    ...twoDimensionalExample,
    strata: [
      ...twoDimensionalExample.strata,
      {
        ...twoDimensionalExample.strata[0],
        id: 'curve-1',
      },
    ],
  }
  const result = addCubicBezierCurveStratumWithResult(diagram, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: 4, y: 0, z: 0 },
  ])

  assert.equal(result.id, 'curve-2')
  assert.equal(
    result.diagram.strata.some((stratum) => stratum.id === result.id),
    true,
  )
})

test('addCubicBezierCurveStratumWithResult safely rejects point counts other than 4', () => {
  const threePointResult = addCubicBezierCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 2, z: 0 },
    ],
  )
  const fivePointResult = addCubicBezierCurveStratumWithResult(
    twoDimensionalExample,
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 2, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 5, y: 1, z: 0 },
    ],
  )

  assert.equal(threePointResult.diagram, twoDimensionalExample)
  assert.equal(threePointResult.id, null)
  assert.equal(fivePointResult.diagram, twoDimensionalExample)
  assert.equal(fivePointResult.id, null)
})

test('addTextLabel returns a new diagram with default text and valid style', () => {
  const updated = addTextLabel(
    twoDimensionalExample,
    { x: 1, y: 2, z: 8 },
    { id: 'label-1' },
  )
  const label = updated.labels.find((candidate) => candidate.id === 'label-1')

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(updated.strata, twoDimensionalExample.strata)
  assert.equal(label?.text, 'Label')
  assert.equal(label?.name.length ? label.name.length > 0 : false, true)
  assert.deepEqual(label?.position, { x: 1, y: 2, z: 0 })
  assert.equal(label?.style.kind, 'labelStyle')
})

test('addTextLabelWithResult returns the updated diagram and created id atomically', () => {
  const result = addTextLabelWithResult(
    twoDimensionalExample,
    { x: 1, y: 2, z: 8 },
  )

  assert.equal(result.id, 'label-1')
  assert.equal(
    result.diagram.labels.some((label) => label.id === result.id),
    true,
  )
})

test('direct-created label is added to diagram.labels', () => {
  const diagram = createEmptyDiagramForTest(3)
  const result = addTextLabelFromDirectInput(
    diagram,
    { x: '4', y: '5', z: '6' },
    '$F$',
    { id: 'direct-label' },
  )

  assert.equal(result.ok, true)

  if (!result.ok) {
    throw new Error('Expected direct label creation to succeed.')
  }

  assert.equal(result.diagram.strata.length, 0)
  assert.equal(result.diagram.labels.length, 1)
  assert.deepEqual(result.diagram.labels[0], {
    ...result.diagram.labels[0],
    id: 'direct-label',
    text: '$F$',
    position: { x: 4, y: 5, z: 6 },
  })
})

test('direct-created label on the visible New layer remains selected', () => {
  const activeLayer = 2
  const layerFilter: LayerFilter = { kind: 'layer', layer: activeLayer }
  const result = addTextLabelFromDirectInput(
    twoDimensionalExample,
    { x: '3', y: '4', z: '99' },
    '$F$',
    {
      id: 'filtered-direct-label',
      layer: activeLayer,
    },
  )

  assert.equal(result.ok, true)

  if (!result.ok) {
    throw new Error('Expected direct label creation to succeed.')
  }

  const label = result.diagram.labels.find(
    (candidate) => candidate.id === 'filtered-direct-label',
  )

  if (label === undefined) {
    throw new Error('Expected direct-created label to be present.')
  }

  const selection: SelectedElement = { kind: 'label', id: result.id }

  assert.equal(label.layer, activeLayer)
  assert.equal(layerFilterIncludesLayer(layerFilter, label.layer), true)
  assert.deepEqual(
    clearSelectionForLayerFilter(result.diagram, selection, layerFilter),
    selection,
  )
})

test('blank direct label text normalizes to the existing default label text', () => {
  assert.equal(normalizeDirectLabelText(''), 'Label')
  assert.equal(normalizeDirectLabelText('   '), 'Label')
  assert.equal(normalizeDirectLabelText('$F$'), '$F$')
})

test('invalid direct numeric input does not create invalid geometry', () => {
  const diagram = createEmptyDiagramForTest(3)
  const result = addPointStratumFromDirectInput(
    diagram,
    { x: '1', y: 'Infinity', z: '' },
  )

  assert.equal(result.ok, false)
  assert.equal(result.diagram, diagram)
  assert.equal(result.diagram.strata.length, 0)
  assert.equal(
    parseDirectCoordinateInput({ x: 'NaN', y: '2', z: '3' }, 3),
    null,
  )
})

test('generated TikZ includes newly added point and label', () => {
  const withPoint = addPointStratum(
    twoDimensionalExample,
    { x: 3, y: 4, z: 0 },
    { id: 'point-1' },
  )
  const withLabel = addTextLabel(
    withPoint,
    { x: 5, y: 6, z: 0 },
    { id: 'label-1', text: 'New label' },
  )
  const tikz = generateTikz(withLabel)

  assert.equal(tikz.includes('\\coordinate (pointPoint4p0'), true)
  assert.equal(tikz.includes('New label'), true)
  assert.equal(tikz.includes('(5,6)'), true)
})

test('TikZ output for direct-created point and label matches model behavior', () => {
  const withPoint = addPointStratumFromDirectInput(
    createEmptyDiagramForTest(2),
    { x: '1', y: '2', z: '99' },
    { id: 'direct-point' },
  )

  assert.equal(withPoint.ok, true)

  if (!withPoint.ok) {
    throw new Error('Expected direct point creation to succeed.')
  }

  const withLabel = addTextLabelFromDirectInput(
    withPoint.diagram,
    { x: '3', y: '4', z: '99' },
    '$L$',
    { id: 'direct-label' },
  )

  assert.equal(withLabel.ok, true)

  if (!withLabel.ok) {
    throw new Error('Expected direct label creation to succeed.')
  }

  const tikz = generateTikz(withLabel.diagram)

  assert.match(tikz, /\\coordinate \(pointPoint0p0\) at \(1,2\);/)
  assert.match(tikz, /\\node at \(3,4\) \{\$L\$\};/)
  assert.doesNotMatch(tikz, /\(1,2,99\)/)
})

test('generated TikZ includes newly added polyline curve', () => {
  const updated = addPolylineCurveStratum(
    twoDimensionalExample,
    [
      { x: 7, y: 8, z: 4 },
      { x: 9, y: 10, z: 5 },
    ],
    { id: 'curve-1' },
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('\\coordinate (curvePolyCurve3p0'), true)
  assert.equal(tikz.includes('(7,8)'), true)
  assert.equal(tikz.includes('(9,10)'), true)
  assert.equal(tikz.includes('\\draw['), true)
})

test('generated TikZ includes newly added cubic Bezier curve', () => {
  const updated = addCubicBezierCurveStratum(
    twoDimensionalExample,
    [
      { x: 0, y: 0, z: 8 },
      { x: 1, y: 2, z: 9 },
      { x: 3, y: 2, z: 10 },
      { x: 4, y: 0, z: 11 },
    ],
    { id: 'curve-1' },
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('\\coordinate (curveBezierCubicBezier3p0'), true)
  assert.equal(
    tikz.includes('(curveBezierCubicBezier3p0) .. controls (curveBezierCubicBezier3p1) and (curveBezierCubicBezier3p2) .. (curveBezierCubicBezier3p3);'),
    true,
  )
  assert.equal(tikz.includes('(1,2)'), true)
  assert.equal(tikz.includes('(3,2)'), true)
})

test('generated TikZ includes newly added polygon sheet as a closed polygon', () => {
  const updated = addPolygonSheetStratum(
    threeDimensionalSelectionExample,
    [
      { x: 0, y: 0, z: 2 },
      { x: 1, y: 0, z: 2 },
      { x: 1.5, y: 0.75, z: 2 },
      { x: 0.5, y: 1.5, z: 2 },
      { x: -0.25, y: 0.75, z: 2 },
    ],
    { id: 'sheet-1' },
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('\\coordinate (sheetPolySheet2p0'), true)
  assert.equal(tikz.includes('\\coordinate (sheetPolySheet2p4'), true)
  assert.equal(
    tikz.includes(
      '(sheetPolySheet2p0) -- (sheetPolySheet2p1) -- (sheetPolySheet2p2) -- (sheetPolySheet2p3) -- (sheetPolySheet2p4) -- cycle;',
    ),
    true,
  )
})

test('updateStratumStyleById updates curve style immutably', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'visibleWire',
    (style) =>
      style.kind === 'curveStyle'
        ? { ...style, lineStyle: 'dashed', strokeColor: '#123456' }
        : style,
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'visibleWire')
  const originalCurve = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'visibleWire',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(curve?.geometricKind, 'curve')
  assert.equal(originalCurve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve' || originalCurve?.geometricKind !== 'curve') {
    throw new Error('Expected visibleWire to be a curve.')
  }

  assert.equal(curve.style.lineStyle, 'dashed')
  assert.equal(curve.style.strokeColor, '#123456')
  assert.equal(originalCurve.style.lineStyle, 'solid')
  assert.equal(updated.labels, twoDimensionalExample.labels)
  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'hiddenWire'),
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'hiddenWire'),
  )
})

test('manual stratum style edits clear applied user preset references', () => {
  const visibleWire = twoDimensionalExample.strata.find(
    (stratum) => stratum.id === 'visibleWire',
  )

  if (visibleWire?.geometricKind !== 'curve') {
    throw new Error('Expected visibleWire to be a curve.')
  }

  const created = createUserStylePresetFromStyle(
    twoDimensionalExample,
    'curve',
    'Editable wire',
    visibleWire.style,
  )
  const applied = applyUserStylePresetToStratum(
    created?.diagram ?? twoDimensionalExample,
    'visibleWire',
    created?.preset.id ?? '',
  )
  const edited = updateStratumStyleById(applied, 'visibleWire', (style) =>
    style.kind === 'curveStyle' ? { ...style, lineWidth: 2 } : style,
  )
  const editedWire = edited.strata.find(
    (stratum) => stratum.id === 'visibleWire',
  )

  assert.equal(editedWire?.stylePresetId, undefined)
})

test('updateStratumStyleById updates point shape and fill immutably', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'circlePoint',
    (style) =>
      style.kind === 'pointStyle'
        ? { ...style, shape: 'star', fill: 'hollow' }
        : style,
  )
  const point = updated.strata.find((stratum) => stratum.id === 'circlePoint')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected circlePoint to be a point.')
  }

  assert.equal(point.style.shape, 'star')
  assert.equal(point.style.fill, 'hollow')
  assert.equal(
    twoDimensionalExample.strata.find((stratum) => stratum.id === 'circlePoint')
      ?.geometricKind,
    'point',
  )
})

test('updateStratumStyleById updates sheet style immutably', () => {
  const updated = updateStratumStyleById(
    threeDimensionalSelectionExample,
    'roseSheet',
    (style) =>
      style.kind === 'sheetStyle'
        ? { ...style, fillOpacity: 0.6, strokeColor: '#654321' }
        : style,
  )
  const sheet = updated.strata.find((stratum) => stratum.id === 'roseSheet')

  assert.equal(sheet?.geometricKind, 'sheet')

  if (sheet?.geometricKind !== 'sheet') {
    throw new Error('Expected roseSheet to be a sheet.')
  }

  assert.equal(sheet.style.fillOpacity, 0.6)
  assert.equal(sheet.style.strokeColor, '#654321')
  assert.equal(updated.labels, threeDimensionalSelectionExample.labels)
})

test('updateLabelStyleById updates label anchor immutably', () => {
  const updated = updateLabelStyleById(
    twoDimensionalExample,
    'mathMorphismLabel',
    (style) => ({ ...style, anchor: 'north east', color: '#112233' }),
  )
  const label = updated.labels.find(
    (candidate) => candidate.id === 'mathMorphismLabel',
  )

  assert.notEqual(updated, twoDimensionalExample)
  assert.equal(label?.style.anchor, 'north east')
  assert.equal(label?.style.color, '#112233')
  assert.equal(
    twoDimensionalExample.labels.find(
      (candidate) => candidate.id === 'mathMorphismLabel',
    )?.style.anchor,
    'south',
  )
  assert.equal(updated.strata, twoDimensionalExample.strata)
})

test('updateSelectedElement updates the selected stratum helper path', () => {
  const updated = updateSelectedElement(
    twoDimensionalExample,
    { kind: 'stratum', id: 'circlePoint' },
    {
      stratum: (stratum) => ({
        ...stratum,
        layer: 4,
      }),
    },
  )

  assert.equal(
    updated.strata.find((stratum) => stratum.id === 'circlePoint')?.layer,
    4,
  )
})

test('updateSelectedElement updates the selected label helper path', () => {
  const updated = updateSelectedElement(
    twoDimensionalExample,
    { kind: 'label', id: 'mathMorphismLabel' },
    {
      label: (label) => ({
        ...label,
        text: '$H$',
      }),
    },
  )

  assert.equal(
    updated.labels.find((label) => label.id === 'mathMorphismLabel')?.text,
    '$H$',
  )
})

test('parseFiniteNumber rejects invalid numeric input', () => {
  assert.equal(parseFiniteNumber(''), null)
  assert.equal(parseFiniteNumber('   '), null)
  assert.equal(parseFiniteNumber('abc'), null)
  assert.equal(parseFiniteNumber('NaN'), null)
  assert.equal(parseFiniteNumber('Infinity'), null)
  assert.equal(parseFiniteNumber('-Infinity'), null)
})

test('parseFiniteNumber accepts finite numeric input', () => {
  assert.equal(parseFiniteNumber('3.25'), 3.25)
  assert.equal(parseFiniteNumber('  -2  '), -2)
})

test('parseOpacity rejects invalid opacity input', () => {
  assert.equal(parseOpacity(''), null)
  assert.equal(parseOpacity('NaN'), null)
  assert.equal(parseOpacity('-0.1'), null)
  assert.equal(parseOpacity('1.1'), null)
})

test('parseOpacity accepts opacity values from 0 to 1', () => {
  assert.equal(parseOpacity('0'), 0)
  assert.equal(parseOpacity('0.5'), 0.5)
  assert.equal(parseOpacity('1'), 1)
})

test('parsePositiveFiniteNumber rejects nonpositive and invalid input', () => {
  assert.equal(parsePositiveFiniteNumber(''), null)
  assert.equal(parsePositiveFiniteNumber('NaN'), null)
  assert.equal(parsePositiveFiniteNumber('0'), null)
  assert.equal(parsePositiveFiniteNumber('-1'), null)
})

test('invalid opacity input does not write NaN into diagram state', () => {
  const parsedValue = parseOpacity('2')
  const updated =
    parsedValue === null
      ? twoDimensionalExample
      : updateStratumStyleById(twoDimensionalExample, 'visibleWire', (style) =>
          style.kind === 'curveStyle'
            ? { ...style, strokeOpacity: parsedValue }
            : style,
        )

  assert.equal(updated, twoDimensionalExample)
  const curve = updated.strata.find((stratum) => stratum.id === 'visibleWire')

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected visibleWire to be a curve.')
  }

  assert.equal(Number.isNaN(curve.style.strokeOpacity), false)
  assert.equal(curve.style.strokeOpacity, 1)
})

test('style edits are reflected in generated TikZ', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'visibleWire',
    (style) =>
      style.kind === 'curveStyle'
        ? {
            ...style,
            strokeColor: '#123456',
            strokeOpacity: 0.45,
            lineWidth: 2.5,
            lineStyle: 'dashed',
          }
        : style,
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{123456}'), true)
  assert.equal(tikz.includes('draw opacity=0.45'), true)
  assert.equal(tikz.includes('line width=2.5pt'), true)
  assert.equal(tikz.includes('dashed'), true)
})

test('sheet style edits through update helpers are reflected in generated TikZ', () => {
  const updated = updateStratumStyleById(
    threeDimensionalSelectionExample,
    'roseSheet',
    (style) =>
      style.kind === 'sheetStyle'
        ? {
            ...style,
            fillColor: '#ABCDEF',
            fillOpacity: 0.72,
            strokeColor: '#123ABC',
            strokeOpacity: 0.44,
          }
        : style,
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{ABCDEF}'), true)
  assert.equal(tikz.includes('fill opacity=0.72'), true)
  assert.equal(tikz.includes('{HTML}{123ABC}'), true)
  assert.equal(tikz.includes('draw opacity=0.44'), true)
})

test('point style edits through update helpers are reflected in generated TikZ', () => {
  const updated = updateStratumStyleById(
    twoDimensionalExample,
    'circlePoint',
    (style) =>
      style.kind === 'pointStyle'
        ? {
            ...style,
            color: '#445566',
            opacity: 0.5,
            shape: 'square',
            fill: 'hollow',
            size: 5,
          }
        : style,
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{445566}'), true)
  assert.equal(tikz.includes('regular polygon sides=4'), true)
  assert.equal(tikz.includes('fill=white'), true)
  assert.equal(tikz.includes('opacity=0.5'), true)
  assert.equal(tikz.includes('inner sep=2.5pt'), true)
})

test('label style edits through update helpers are reflected in generated TikZ', () => {
  const updated = updateLabelStyleById(
    twoDimensionalExample,
    'mathMorphismLabel',
    (style) => ({
      ...style,
      color: '#778899',
      opacity: 0.6,
      fontSize: 13,
      anchor: 'north west',
    }),
  )
  const tikz = generateTikz(updated)

  assert.equal(tikz.includes('{HTML}{778899}'), true)
  assert.equal(tikz.includes('text=stzLabelmathMorphismLabel'), true)
  assert.equal(tikz.includes('opacity=0.6'), true)
  assert.equal(tikz.includes('\\fontsize{13pt}{15.6pt}\\selectfont'), true)
  assert.equal(tikz.includes('anchor=north west'), true)
})

test('color input guard accepts valid hex colors and falls back for malformed values', () => {
  assert.equal(isHexColorString('#A1b2C3'), true)
  assert.equal(isHexColorString('not-a-color'), false)
  assert.equal(normalizeColorInputValue('#A1b2C3'), '#A1b2C3')
  assert.equal(normalizeColorInputValue('not-a-color'), '#000000')
  assert.equal(normalizeColorInputValue(''), '#000000')
  assert.equal(normalizeColorInputValue(undefined), '#000000')
})

test('color input fallback does not automatically commit to the diagram', () => {
  const malformedColor = 'not-a-color'
  const diagramWithMalformedColor = {
    ...twoDimensionalExample,
    labels: twoDimensionalExample.labels.map((label) =>
      label.id === 'mathMorphismLabel'
        ? {
            ...label,
            style: {
              ...label.style,
              color: malformedColor,
            },
          }
        : label,
    ),
  }

  assert.equal(normalizeColorInputValue(malformedColor), '#000000')
  assert.equal(
    diagramWithMalformedColor.labels.find(
      (label) => label.id === 'mathMorphismLabel',
    )?.style.color,
    malformedColor,
  )
})

test('invalid numeric input does not write NaN into diagram state', () => {
  const parsedValue = parseFiniteNumber('not a number')
  const updated =
    parsedValue === null
      ? twoDimensionalExample
      : updateStratumById(twoDimensionalExample, 'circlePoint', (stratum) => {
          if (stratum.geometricKind !== 'point') {
            return stratum
          }

          return {
            ...stratum,
            position: updateVec3Coordinate(stratum.position, 'x', parsedValue, 2),
          }
        })

  assert.equal(updated, twoDimensionalExample)
  const point = updated.strata.find((stratum) => stratum.id === 'circlePoint')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected circlePoint to be a point.')
  }

  assert.equal(Number.isNaN(point.position.x), false)
})

test('valid numeric input updates coordinates through parsing helper', () => {
  const parsedValue = parseFiniteNumber('4.5')

  assert.notEqual(parsedValue, null)

  if (parsedValue === null) {
    throw new Error('Expected 4.5 to parse as a finite number.')
  }

  const updated = updateStratumById(
    twoDimensionalExample,
    'circlePoint',
    (stratum) => {
      if (stratum.geometricKind !== 'point') {
        return stratum
      }

      return {
        ...stratum,
        position: updateVec3Coordinate(stratum.position, 'x', parsedValue, 2),
      }
    },
  )
  const point = updated.strata.find((stratum) => stratum.id === 'circlePoint')

  assert.equal(point?.geometricKind, 'point')

  if (point?.geometricKind !== 'point') {
    throw new Error('Expected circlePoint to be a point.')
  }

  assert.equal(point.position.x, 4.5)
  assert.equal(point.position.z, 0)
})

test('updateVec3Coordinate normalizes z to 0 for 2D coordinates', () => {
  const point = updateVec3Coordinate({ x: 1, y: 2, z: 0 }, 'z', 9, 2)

  assert.deepEqual(point, { x: 1, y: 2, z: 0 })
})

test('updateVec3Coordinate preserves editable z for 3D coordinates', () => {
  const point = updateVec3Coordinate({ x: 1, y: 2, z: 0 }, 'z', 9, 3)

  assert.deepEqual(point, { x: 1, y: 2, z: 9 })
})

test('cubic Bezier point labels remain semantic after coordinate editing', () => {
  const updated = updateStratumById(
    twoDimensionalExample,
    'dashedMorphism',
    (stratum) => {
      if (stratum.geometricKind !== 'curve') {
        return stratum
      }

      return {
        ...stratum,
        points: stratum.points.map((point, index) =>
          index === 1 ? updateVec3Coordinate(point, 'x', -1.1, 2) : point,
        ),
      }
    },
  )
  const curve = updated.strata.find((stratum) => stratum.id === 'dashedMorphism')

  assert.equal(curve?.geometricKind, 'curve')

  if (curve?.geometricKind !== 'curve') {
    throw new Error('Expected dashedMorphism to be a curve.')
  }

  assert.deepEqual(
    describeCurvePoints(curve).map((description) => description.label),
    ['Start', 'Control point 1', 'Control point 2', 'End'],
  )
  assert.deepEqual(curve.points[1], { x: -1.1, y: 2.3, z: 0 })
})

test('cloneDiagram creates an editable copy of an example diagram', () => {
  const cloned = cloneDiagram(twoDimensionalExample)

  assert.notEqual(cloned, twoDimensionalExample)
  assert.notEqual(cloned.strata, twoDimensionalExample.strata)
  assert.deepEqual(cloned, twoDimensionalExample)
})
