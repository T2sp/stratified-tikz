import assert from 'node:assert/strict'
import test from 'node:test'
import {
  snapCursorPoint,
  type CursorSnapSettings,
} from '../../src/geometry/cursorSnap.ts'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
} from '../../src/model/constructors.ts'
import { serializeDiagram, parseSavedDiagramJson } from '../../src/model/serialization.ts'
import { addSymbolicVariableToDiagram } from '../../src/model/variables.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../../src/model/translation.ts'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  Diagram,
  PathCrossingState,
  PointStratum,
  Stratum,
  Vec3,
  WorkPlane,
} from '../../src/model/types.ts'
import type { PathArrowOptionsInput } from '../../src/model/pathArrows.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyBulkDeleteToEditorState,
  applyBulkDuplicateToEditorState,
  applyBulkStyleField,
  applyBulkTranslateToEditorState,
  duplicateSelectedElements,
  type BulkOperationEditorState,
} from '../../src/ui/bulkEditing.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import {
  applyMergeLayersToEditorState,
  applyTranslateLayerToEditorState,
  type LayerOperationEditorState,
} from '../../src/ui/layerOperations.ts'
import {
  appendConcatenatedPathDraftPoint,
  createConcatenatedPathDraft,
} from '../../src/ui/pathDraft.ts'
import {
  concatenateSelectedPaths,
  type PathConcatenationEditorState,
} from '../../src/ui/pathConcatenation.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type TestEditorState =
  & BulkOperationEditorState
  & LayerOperationEditorState
  & PathConcatenationEditorState
  & {
    polylineDraft: null
    cubicBezierDraft: null
    pathDraft: null
    sheetPolygonDraft: null
  }

const snapStep01: CursorSnapSettings = { enabled: true, step: 0.1 }

test('snap plus cursor path creation commits quantized model coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const workPlane: WorkPlane = { kind: 'xy', z: 0 }
  const first = requireSnappedPoint(
    { x: 0.24, y: 0.26, z: 9 },
    diagram,
    workPlane,
  )
  const draft = createConcatenatedPathDraft(
    first,
    workPlane,
    'line',
    diagram.ambientDimension,
  )

  assert.equal(draft.ok, true)
  if (!draft.ok) {
    throw new Error('Expected draft creation to succeed.')
  }

  const second = requireSnappedPoint(
    { x: 1.24, y: 1.26, z: 9 },
    diagram,
    workPlane,
  )
  const appended = appendConcatenatedPathDraftPoint(
    draft.draft,
    second,
    diagram.ambientDimension,
  )

  assert.equal(appended.ok, true)
  if (!appended.ok) {
    throw new Error('Expected draft append to succeed.')
  }

  const path = createConcatenatedPathStratum({
    ambientDimension: diagram.ambientDimension,
    id: 'snap-path',
    name: 'Snap path',
    segments: appended.draft.segments,
  })
  const savedDiagram: Diagram = {
    ...diagram,
    strata: [path],
  }
  const tikz = generateTikz(savedDiagram)

  assert.deepEqual(path.segments[0], {
    kind: 'line',
    start: point(0.2, 0.3),
    end: point(1.2, 1.3),
  })
  assert.match(tikz, / at \(0\.2,0\.3\);/)
  assert.match(tikz, / at \(1\.2,1\.3\);/)
})

test('multi-select bulk style edits are preserved in TikZ export', () => {
  const styled = applyBulkStyleField(
    diagramWithStrata([
      linePath('style-a', point(0, 0), point(1, 0)),
      linePath('style-b', point(1, 0), point(2, 0)),
      linePath('style-c', point(0, 1), point(1, 1)),
    ]),
    selection('style-a', 'style-b'),
    'curve.strokeColor',
    '#AA00AA',
  )
  const tikz = generateTikz(styled)

  assert.equal(findCurve(styled, 'style-a').style.strokeColor, '#AA00AA')
  assert.equal(findCurve(styled, 'style-b').style.strokeColor, '#AA00AA')
  assert.equal(findCurve(styled, 'style-c').style.strokeColor, '#000000')
  assert.match(tikz, /\\definecolor\{[^}]+\}\{HTML\}\{AA00AA\}/)
})

test('multi-select duplicate and delete remain undoable and redoable', () => {
  const initial = createTestEditorState(
    diagramWithStrata([
      pointStratum('point-a', point(0, 0)),
      pointStratum('point-b', point(1, 0)),
    ]),
    selection('point-a', 'point-b'),
  )
  const duplicated = applyBulkDuplicateToEditorState(initial)
  const deleted = applyBulkDeleteToEditorState(duplicated)
  const undone = undoLastDiagramChange(deleted)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(duplicated.editableDiagram, 'point-a-copy'), true)
  assert.equal(hasStratum(duplicated.editableDiagram, 'point-b-copy'), true)
  assert.equal(hasStratum(deleted.editableDiagram, 'point-a-copy'), false)
  assert.equal(hasStratum(deleted.editableDiagram, 'point-b-copy'), false)
  assert.equal(hasStratum(undone.editableDiagram, 'point-a-copy'), true)
  assert.equal(hasStratum(redone.editableDiagram, 'point-a-copy'), false)
  assert.equal(redone.history.future.length, 0)
})

test('multi-select symbolic translation survives save and load', () => {
  const diagram = symbolicPointDiagram()
  const translated = applyBulkTranslateToEditorState(
    createTestEditorState(diagram, selection('symbolic-point', 'numeric-point')),
    parseTranslation(diagram, 'Len/2', '0', '0'),
  )
  const saved = serializeDiagram(translated.editableDiagram)
  const loaded = parseSavedDiagramJson(saved)

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  const symbolicPoint = findPoint(loaded.diagram, 'symbolic-point')
  const numericPoint = findPoint(loaded.diagram, 'numeric-point')

  assert.equal(symbolicPoint.position.x, 4)
  assert.equal(symbolicPoint.position.symbolic?.x.kind, 'symbolic')
  assert.equal(
    symbolicPoint.position.symbolic.x.expression,
    '(R) + (Len/2)',
  )
  assert.equal(numericPoint.position.x, 3)
  assert.equal(numericPoint.position.symbolic?.x.kind, 'symbolic')
  assert.equal(numericPoint.position.symbolic.x.expression, '1 + (Len/2)')
})

test('path concatenation keeps first arrows and cleans stale braiding data', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0), {
      arrows: { endpoint: 'forward' },
    }),
    linePath('path-b', point(1, 0), point(2, 0), {
      arrows: { endpoint: 'backward' },
    }),
    linePath('path-c', point(0, 1), point(2, 1)),
  ])
  diagram.pathCrossings = [crossingState('path-a', 'path-c')]

  const result = concatenateSelectedPaths(
    diagram,
    selection('path-a', 'path-b'),
    { id: 'joined-path', keepOriginals: false },
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const joined = findConcatenatedPath(result.diagram, 'joined-path')

  assert.equal(joined.arrows.endpoint, 'forward')
  assert.equal(hasStratum(result.diagram, 'path-a'), false)
  assert.equal(hasStratum(result.diagram, 'path-b'), false)
  assert.equal(result.diagram.pathCrossings, undefined)
})

test('layer merge plus layer translation is undoable and reflected in TikZ', () => {
  let state = createTestEditorState(layeredCurveDiagram(), null)

  state = applyMergeLayersToEditorState(state, 0, 1)
  state = applyTranslateLayerToEditorState(state, 1, { x: 1, y: -1, z: 0 })

  const mergedTranslated = state.editableDiagram
  const tikz = generateTikz(mergedTranslated)

  assert.equal(findCurve(mergedTranslated, 'layer-a').layer, 1)
  assert.deepEqual(findCurve(mergedTranslated, 'layer-a').points[0], point(1, -1))
  assert.deepEqual(findCurve(mergedTranslated, 'layer-b').points[0], point(1, 0))
  assert.match(tikz, /stratifiedLayer1/)
  assert.match(tikz, / at \(1,-1\);/)

  const undone = undoLastDiagramChange(state)

  assert.deepEqual(findCurve(undone.editableDiagram, 'layer-a').points[0], point(0, 0))
})

test('inline TikZ output still has no blank lines after edited diagrams', () => {
  const styled = applyBulkStyleField(
    layeredCurveDiagram(),
    selection('layer-a', 'layer-b'),
    'curve.lineStyle',
    'dashed',
  )
  const translated = applyBulkTranslateToEditorState(
    createTestEditorState(styled, selection('layer-a', 'layer-b')),
    parseTranslation(styled, '0.5', '0.5', '0'),
  )
  const tikz = generateTikz(translated.editableDiagram, {
    exportMode: 'inlineMath',
  })

  expectNoBlankLines(tikz)
  assert.match(tikz, /dashed/)
})

test('selection and editor states are not saved after bulk workflows', () => {
  const result = duplicateSelectedElements(
    diagramWithStrata([
      linePath('saved-a', point(0, 0), point(1, 0)),
      linePath('saved-b', point(1, 0), point(2, 0)),
    ]),
    selection('saved-a', 'saved-b'),
  )
  const saved = JSON.parse(serializeDiagram(result.diagram)) as {
    diagram: Record<string, unknown>
  }

  assert.notEqual(result.selectedElement, null)
  assert.equal('selectedElement' in saved.diagram, false)
  assert.equal('selection' in saved.diagram, false)
  assert.equal('layerFilter' in saved.diagram, false)
  assert.equal('cursorSnapSettings' in saved.diagram, false)
  assert.equal('history' in saved.diagram, false)
})

function requireSnappedPoint(
  sourcePoint: Vec3,
  diagram: Diagram,
  workPlane: WorkPlane,
): Vec3 {
  const snapped = snapCursorPoint(sourcePoint, {
    ambientDimension: diagram.ambientDimension,
    snap: snapStep01,
    workPlane,
  })

  if (snapped === null) {
    throw new Error('Expected cursor snap to return a point.')
  }

  return snapped
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

function symbolicPointDiagram(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram = addVariable(diagram, 'var-r', 'R', '2')
  diagram = addVariable(diagram, 'var-len', 'Len', '4')
  diagram.strata = [
    pointStratum('symbolic-point', symbolicPoint('R', 2)),
    pointStratum('numeric-point', point(1, 0)),
  ]

  return diagram
}

function addVariable(
  diagram: Diagram,
  id: string,
  name: string,
  expression: string,
): Diagram {
  const result = addSymbolicVariableToDiagram(diagram, {
    id,
    name,
    expression,
    macroName: name,
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.diagram
}

function layeredCurveDiagram(): Diagram {
  const diagram = diagramWithStrata([
    linePath('layer-a', point(0, 0), point(1, 0), { layer: 0 }),
    linePath('layer-b', point(0, 1), point(1, 1), { layer: 1 }),
  ])

  diagram.layers = [
    { value: 0, name: 'Layer 0' },
    { value: 1, name: 'Layer 1' },
  ]

  return diagram
}

function diagramWithStrata(strata: Stratum[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata = strata
  return diagram
}

function linePath(
  id: string,
  start: Vec3,
  end: Vec3,
  options: {
    layer?: number
    arrows?: PathArrowOptionsInput
  } = {},
): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    name: id,
    points: [start, end],
    layer: options.layer,
    arrows: options.arrows,
  })
}

function pointStratum(id: string, position: Vec3): PointStratum {
  return createPointStratum({
    ambientDimension: 2,
    id,
    name: id,
    position,
  })
}

function selection(...ids: string[]): SelectedElement {
  return {
    kind: 'multi',
    elements: ids.map((id) => ({ kind: 'stratum', id })),
  }
}

function createTestEditorState(
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

  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Expected curve ${id}.`)
  }

  return stratum
}

function findConcatenatedPath(
  diagram: Diagram,
  id: string,
): ConcatenatedPathStratum {
  const curve = findCurve(diagram, id)

  if (curve.kind !== 'concatenatedPath') {
    throw new Error(`Expected concatenated path ${id}.`)
  }

  return curve
}

function findPoint(diagram: Diagram, id: string): PointStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'point') {
    throw new Error(`Expected point ${id}.`)
  }

  return stratum
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
}

function crossingState(pathAId: string, pathBId: string): PathCrossingState {
  return {
    id: `${pathAId}-${pathBId}`,
    pathAId,
    pathBId,
    point: point(0.5, 0.5),
    parameterA: 0.5,
    parameterB: 0.5,
    kind: 'braiding',
  }
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function symbolicPoint(expression: string, previewValue: number): Vec3 {
  return {
    x: previewValue,
    y: 0,
    z: 0,
    symbolic: {
      x: {
        kind: 'symbolic',
        expression,
        previewValue,
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

function expectNoBlankLines(output: string): void {
  assert.doesNotMatch(output, /\n\s*\n/)
  assert.equal(output.startsWith('\n'), false)
  assert.equal(output.endsWith('\n\n'), false)
}
