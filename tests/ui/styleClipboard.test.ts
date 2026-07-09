import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createSheetStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import { createCoordinateAnchor } from '../../src/model/coordinateAnchors.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  Diagram,
  CurveStyle,
  ImportedTikzStyleReference,
  PathArrowOptions,
  PointStratum,
  SheetStratum,
  Stratum,
  TextLabel,
  UserStylePreset,
  Vec3,
} from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  applyStyleClipboardToEditorState,
  applyStyleEyedropperSourceToSelection,
  copyStyleFromSelection,
  pasteStyleClipboardToSelection,
  type StyleClipboard,
  type StyleClipboardEditorState,
} from '../../src/ui/styleClipboard.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type TestEditorState = StyleClipboardEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
}

test('copies curve style and arrows to a curve without changing geometry or layer', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'curve-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'stratum', id: 'curve-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const source = findCurve(diagram, 'curve-source')
  const beforeTarget = findCurve(diagram, 'curve-target')
  const target = findCurve(result.diagram, 'curve-target')

  assert.deepEqual(target.style, source.style)
  assert.notEqual(target.style, source.style)
  assert.deepEqual(target.arrows, source.arrows)
  assert.notEqual(target.arrows, source.arrows)
  assert.equal(target.stylePresetId, source.stylePresetId)
  assert.equal(
    target.importedTikzStyleReferenceId,
    source.importedTikzStyleReferenceId,
  )
  assert.equal(target.id, beforeTarget.id)
  assert.equal(target.name, beforeTarget.name)
  assert.equal(target.layer, beforeTarget.layer)
  assert.deepEqual(target.points, beforeTarget.points)
  assert.deepEqual(target.styleSegments, beforeTarget.styleSegments)
})

test('style eyedropper applies curve style to a curve target', () => {
  const diagram = createStyleClipboardDiagram()
  const result = applyStyleEyedropperSourceToSelection(
    diagram,
    { kind: 'stratum', id: 'curve-target' },
    { kind: 'stratum', id: 'curve-source' },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  assert.deepEqual(
    findCurve(result.diagram, 'curve-target').style,
    findCurve(diagram, 'curve-source').style,
  )
})

test('style eyedropper rejects curve source for sheet target atomically', () => {
  const diagram = createCurveSheetEyedropperDiagram()
  const original = structuredClone(diagram) as Diagram
  const result = applyStyleEyedropperSourceToSelection(
    diagram,
    { kind: 'stratum', id: 'sheet-target' },
    { kind: 'stratum', id: 'curve-source' },
  )

  assert.equal(result.ok, false)
  assert.match(result.message, /curve style can only be pasted to curve objects/)
  assert.deepEqual(result.diagram, original)
})

test('style eyedropper applies curve style to same-kind multi-selection', () => {
  const diagram = createStyleClipboardDiagram()
  const result = applyStyleEyedropperSourceToSelection(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'curve-target' },
        { kind: 'stratum', id: 'curve-extra' },
      ],
    },
    { kind: 'stratum', id: 'curve-source' },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const source = findCurve(diagram, 'curve-source')

  assert.deepEqual(findCurve(result.diagram, 'curve-target').style, source.style)
  assert.deepEqual(findCurve(result.diagram, 'curve-extra').style, source.style)
  assert.equal(result.appliedCount, 2)
})

test('style eyedropper excludes coordinate anchors', () => {
  const diagram = createStyleClipboardDiagram()
  const sourceResult = applyStyleEyedropperSourceToSelection(
    diagram,
    { kind: 'stratum', id: 'curve-target' },
    { kind: 'coordinate', id: 'coord-a' },
  )
  const targetResult = applyStyleEyedropperSourceToSelection(
    diagram,
    { kind: 'coordinate', id: 'coord-a' },
    { kind: 'stratum', id: 'curve-source' },
  )

  assert.equal(sourceResult.ok, false)
  assert.match(sourceResult.message, /Coordinate anchors do not have styles/)
  assert.equal(targetResult.ok, false)
  assert.match(targetResult.message, /Coordinate anchors do not have styles/)
})

test('copies sheet style to a sheet', () => {
  const diagram = createSheetClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'sheet-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'stratum', id: 'sheet-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  assert.deepEqual(
    findSheet(result.diagram, 'sheet-target').style,
    findSheet(diagram, 'sheet-source').style,
  )
})

test('copies point style to a point', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'point-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'stratum', id: 'point-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  assert.deepEqual(
    findPoint(result.diagram, 'point-target').style,
    findPoint(diagram, 'point-source').style,
  )
})

test('copies label style to a label without changing text content', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'label', id: 'label-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'label', id: 'label-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const source = findLabel(diagram, 'label-source')
  const beforeTarget = findLabel(diagram, 'label-target')
  const target = findLabel(result.diagram, 'label-target')

  assert.deepEqual(target.style, source.style)
  assert.equal(target.text, beforeTarget.text)
  assert.equal(target.layer, beforeTarget.layer)
})

test('rejects cross-kind style paste without partial changes', () => {
  const diagram = createStyleClipboardDiagram()
  const original = structuredClone(diagram) as Diagram
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'curve-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'stratum', id: 'point-target' },
    clipboard,
  )

  assert.equal(result.ok, false)
  assert.match(result.message, /curve style can only be pasted to curve objects/)
  assert.deepEqual(result.diagram, original)
})

test('rejects coordinate anchors as style source or target', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'curve-source' })
  const copyResult = copyStyleFromSelection(diagram, {
    kind: 'coordinate',
    id: 'coord-a',
  })
  const pasteResult = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'coordinate', id: 'coord-a' },
    clipboard,
  )

  assert.equal(copyResult.ok, false)
  assert.match(copyResult.message, /Coordinate anchors do not have styles/)
  assert.equal(pasteResult.ok, false)
  assert.match(pasteResult.message, /Coordinate anchors do not have styles/)
})

test('multi-selection paste applies to all compatible targets', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'curve-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'curve-target' },
        { kind: 'stratum', id: 'curve-extra' },
      ],
    },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const source = findCurve(diagram, 'curve-source')

  assert.deepEqual(findCurve(result.diagram, 'curve-target').style, source.style)
  assert.deepEqual(findCurve(result.diagram, 'curve-extra').style, source.style)
})

test('mixed incompatible target selection rejects atomically', () => {
  const diagram = createStyleClipboardDiagram()
  const original = structuredClone(diagram) as Diagram
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'curve-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    {
      kind: 'multi',
      elements: [
        { kind: 'stratum', id: 'curve-target' },
        { kind: 'stratum', id: 'point-target' },
      ],
    },
    clipboard,
  )

  assert.equal(result.ok, false)
  assert.deepEqual(result.diagram, original)
})

test('style paste is undoable and redoable as one history entry', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'stratum', id: 'curve-source' })
  const initial = createStyleClipboardState(diagram, {
    kind: 'multi',
    elements: [
      { kind: 'stratum', id: 'curve-target' },
      { kind: 'stratum', id: 'curve-extra' },
    ],
  })
  const pasted = applyStyleClipboardToEditorState(initial, clipboard)
  const undone = undoLastDiagramChange(pasted)
  const redone = redoLastDiagramChange(undone)

  assert.equal(pasted.history.past.length, 1)
  assert.deepEqual(
    findCurve(pasted.editableDiagram, 'curve-target').style,
    findCurve(diagram, 'curve-source').style,
  )
  assert.deepEqual(
    findCurve(undone.editableDiagram, 'curve-target').style,
    findCurve(diagram, 'curve-target').style,
  )
  assert.deepEqual(
    findCurve(redone.editableDiagram, 'curve-extra').style,
    findCurve(diagram, 'curve-source').style,
  )
})

test('TikZ output reflects pasted style', () => {
  const sourceDiagram = createStyleClipboardDiagram()
  const targetDiagram = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [findCurve(sourceDiagram, 'curve-target')],
    labels: [],
  }
  const clipboard = copiedStyle(sourceDiagram, {
    kind: 'stratum',
    id: 'curve-source',
  })
  const result = pasteStyleClipboardToSelection(
    targetDiagram,
    { kind: 'stratum', id: 'curve-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const tikz = generateTikz(result.diagram)

  assert.match(tikz, /\\definecolor\{[^}]+\}\{HTML\}\{AA0033\}/)
  assert.match(tikz, /line width=2\.5pt/)
  assert.match(tikz, /dashed/)
  assert.match(tikz, /->/)
  assert.match(tikz, /Latex/)
})

test('save and load preserve pasted style without selection state', () => {
  const diagram = createStyleClipboardDiagram()
  const clipboard = copiedStyle(diagram, { kind: 'label', id: 'label-source' })
  const result = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'label', id: 'label-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const serialized = serializeDiagram(result.diagram)
  const parsed = parseSavedDiagramJson(serialized)

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  assert.deepEqual(
    findLabel(parsed.diagram, 'label-target').style,
    findLabel(diagram, 'label-source').style,
  )
  assert.equal(validateDiagram(parsed.diagram).valid, true)
  assert.equal(serialized.includes('selectedElement'), false)
})

test('paste drops copied style references that are unavailable in the target diagram', () => {
  const sourceDiagram = createStyleClipboardDiagram()
  const targetDiagram = {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata: [findCurve(sourceDiagram, 'curve-target')],
    labels: [],
  }
  const clipboard = copiedStyle(sourceDiagram, {
    kind: 'stratum',
    id: 'curve-source',
  })
  const result = pasteStyleClipboardToSelection(
    targetDiagram,
    { kind: 'stratum', id: 'curve-target' },
    clipboard,
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  const target = findCurve(result.diagram, 'curve-target')

  assert.equal(target.stylePresetId, undefined)
  assert.equal(target.importedTikzStyleReferenceId, undefined)
  assert.equal(validateDiagram(result.diagram).valid, true)
})

function copiedStyle(
  diagram: Diagram,
  selection: SelectedElement,
): StyleClipboard {
  const result = copyStyleFromSelection(diagram, selection)

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.message)
  }

  return result.clipboard
}

function createStyleClipboardDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const curvePreset = userStylePreset(
    'curve-preset-source',
    'curve',
    findCurveSourceStyle(),
  )
  const curveReference = importedTikzStyleReference(
    'imported-curve-source',
    'externalCurveStyle',
    ['curve'],
  )

  diagram.externalTikzStyleSources = [
    {
      id: 'external-style-source',
      name: 'External styles',
      loadHint: 'external-styles.sty',
    },
  ]
  diagram.importedTikzStyleReferences = [curveReference]
  diagram.userStylePresets = [curvePreset]
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
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
  ]
  diagram.strata = [
    {
      ...curveStratum('curve-source', findCurveSourceStyle(), [
        point(0, 0),
        point(2, 0),
      ]),
      stylePresetId: curvePreset.id,
      importedTikzStyleReferenceId: curveReference.id,
      arrows: sourceArrows(),
      layer: 7,
    },
    {
      ...curveStratum('curve-target', {
        kind: 'curveStyle',
        strokeColor: '#224466',
        strokeOpacity: 0.9,
        lineWidth: 1.1,
        lineStyle: 'solid',
      }, [point(0, 1), point(2, 1)]),
      arrows: {
        endpoint: 'none',
        mid: {
          enabled: false,
          position: 0.5,
          direction: 'forward',
          head: 'standard',
        },
      },
      styleSegments: [
        {
          id: 'target-segment-style',
          from: 0.2,
          to: 0.4,
          style: { lineStyle: 'dotted' },
        },
      ],
      layer: 2,
    },
    curveStratum('curve-extra', {
      kind: 'curveStyle',
      strokeColor: '#335577',
      strokeOpacity: 1,
      lineWidth: 1.4,
      lineStyle: 'denselyDotted',
    }, [point(0, 2), point(2, 2)]),
    createPointStratum({
      ambientDimension: 2,
      id: 'point-source',
      style: {
        kind: 'pointStyle',
        color: '#CC5500',
        opacity: 0.6,
        shape: 'square',
        fill: 'hollow',
        size: 5,
      },
      position: point(-1, 0),
      layer: 4,
    }),
    createPointStratum({
      ambientDimension: 2,
      id: 'point-target',
      style: {
        kind: 'pointStyle',
        color: '#000000',
        opacity: 1,
        shape: 'circle',
        fill: 'filled',
        size: 3,
      },
      position: point(-1, 1),
      layer: 1,
    }),
  ]
  diagram.labels = [
    createTextLabel({
      ambientDimension: 2,
      id: 'label-source',
      text: '$F$',
      position: point(0, -1),
      style: {
        kind: 'labelStyle',
        color: '#AA5500',
        opacity: 0.7,
        fontSize: 14,
        anchor: 'north east',
      },
      layer: 5,
    }),
    createTextLabel({
      ambientDimension: 2,
      id: 'label-target',
      text: '$G$',
      position: point(1, -1),
      style: {
        kind: 'labelStyle',
        color: '#000000',
        opacity: 1,
        fontSize: 10,
        anchor: 'center',
      },
      layer: 3,
    }),
  ]

  return diagram
}

function createSheetClipboardDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata = [
    createSheetStratum({
      ambientDimension: 3,
      id: 'sheet-source',
      style: {
        kind: 'sheetStyle',
        fillColor: '#55AACC',
        fillOpacity: 0.25,
        strokeColor: '#114466',
        strokeOpacity: 0.8,
        lineWidth: 2,
      },
      corners: [
        point(0, 0, 0),
        point(1, 0, 0),
        point(1, 1, 0),
        point(0, 1, 0),
      ],
      layer: 6,
    }),
    createSheetStratum({
      ambientDimension: 3,
      id: 'sheet-target',
      style: {
        kind: 'sheetStyle',
        fillColor: '#FFFFFF',
        fillOpacity: 0.1,
        strokeColor: '#000000',
        strokeOpacity: 1,
      },
      corners: [
        point(0, 0, 1),
        point(1, 0, 1),
        point(1, 1, 1),
        point(0, 1, 1),
      ],
      layer: 1,
    }),
  ]

  return diagram
}

function createCurveSheetEyedropperDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata = [
    createCurveStratum({
      ambientDimension: 3,
      id: 'curve-source',
      style: findCurveSourceStyle(),
      points: [point(0, 0, 0), point(1, 0, 0)],
    }),
    createSheetStratum({
      ambientDimension: 3,
      id: 'sheet-target',
      style: {
        kind: 'sheetStyle',
        fillColor: '#FFFFFF',
        fillOpacity: 0.1,
        strokeColor: '#000000',
        strokeOpacity: 1,
      },
      corners: [
        point(0, 0, 1),
        point(1, 0, 1),
        point(1, 1, 1),
        point(0, 1, 1),
      ],
      layer: 1,
    }),
  ]

  return diagram
}

function curveStratum(
  id: string,
  style: CurveStyle,
  points: [Vec3, Vec3],
) {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    style,
    points,
  })
}

function findCurveSourceStyle(): CurveStyle {
  return {
    kind: 'curveStyle',
    strokeColor: '#AA0033',
    strokeOpacity: 0.45,
    lineWidth: 2.5,
    lineStyle: 'dashed',
  }
}

function sourceArrows(): PathArrowOptions {
  return {
    endpoint: 'forward',
    mid: {
      enabled: true,
      position: 0.35,
      direction: 'backward',
      head: 'latex',
    },
  }
}

function userStylePreset(
  id: string,
  kind: 'curve',
  style: CurveStyle,
): UserStylePreset {
  return {
    id,
    name: 'Source curve preset',
    kind,
    style,
    tikzStyleName: 'stratifiedStyleSourceCurve',
  }
}

function importedTikzStyleReference(
  id: string,
  key: string,
  targets: ImportedTikzStyleReference['targets'],
): ImportedTikzStyleReference {
  return {
    id,
    key,
    sourceId: 'external-style-source',
    displayName: key,
    targets,
  }
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function createStyleClipboardState(
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

function findCurve(diagram: Diagram, id: string) {
  const stratum = findStratum(diagram, id)

  if (stratum.geometricKind !== 'curve') {
    throw new Error(`Expected ${id} to be a curve.`)
  }

  return stratum
}

function findSheet(diagram: Diagram, id: string): SheetStratum {
  const stratum = findStratum(diagram, id)

  if (stratum.geometricKind !== 'sheet') {
    throw new Error(`Expected ${id} to be a sheet.`)
  }

  return stratum
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = findStratum(diagram, id)

  if (stratum.geometricKind !== 'point') {
    throw new Error(`Expected ${id} to be a point.`)
  }

  return stratum
}

function findStratum(diagram: Diagram, id: string): Stratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum === undefined) {
    throw new Error(`Expected stratum ${id}.`)
  }

  return stratum
}

function findLabel(diagram: Diagram, id: string): TextLabel {
  const label = diagram.labels.find((candidate) => candidate.id === id)

  if (label === undefined) {
    throw new Error(`Expected label ${id}.`)
  }

  return label
}
