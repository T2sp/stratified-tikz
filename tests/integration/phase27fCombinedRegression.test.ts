import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
} from '../../src/model/constructors.ts'
import {
  createCoordinateAnchor,
  symbolicVec3FromVec3,
} from '../../src/model/coordinateAnchors.ts'
import {
  coordinateReferenceSourceForPoint,
  coordinateReferenceVec3ForAnchorId,
} from '../../src/model/coordinateReferences.ts'
import {
  parseSavedDiagramJson,
  savedDiagramFormat,
  savedDiagramVersion,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  CurveStyle,
  Diagram,
  PathCrossingState,
  PathInlineNode,
  PathSegment,
  Stratum,
  Vec2,
  Vec3,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  maxSvgPathInlineNodePreviews,
  pathInlineNodesForSvgPreview,
} from '../../src/rendering/svgPathInlineNodes.ts'
import {
  collectSvgPreviewSelectionCandidates,
  maxSvgPreviewSelectionCandidates,
  nextSvgPreviewSelectionCycle,
} from '../../src/rendering/svgHitTesting.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import {
  finiteNumberDraftWarning,
  updateInspectorNumericDraft,
} from '../../src/ui/inspector/numericInput.ts'
import { parseFiniteNumber } from '../../src/ui/diagramUpdates.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import {
  applySplitSelectedPathToEditorState,
  splitSelectedPath,
  type PathSplittingEditorState,
} from '../../src/ui/pathSplitting.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  applyStyleClipboardToEditorState,
  copyStyleFromSelection,
  pasteStyleClipboardToSelection,
  type StyleClipboardEditorState,
} from '../../src/ui/styleClipboard.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type Phase27EditorState = PathSplittingEditorState &
  StyleClipboardEditorState & {
    polylineDraft: null
    cubicBezierDraft: null
    pathDraft: null
    sheetPolygonDraft: null
  }

const sourceCurveStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#AA0033',
  strokeOpacity: 0.65,
  lineWidth: 2.5,
  lineStyle: 'dashed',
}

const targetCurveStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#004488',
  strokeOpacity: 1,
  lineWidth: 1.2,
  lineStyle: 'solid',
}

test('selection cycling works with coordinate anchor, path, and inline node overlap', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-overlap',
      name: 'O',
      tikzName: 'O',
      position: globalAnchorPosition(point(0, 0)),
    }),
  ]
  diagram.strata = [
    createCurveStratum({
      ambientDimension: 2,
      id: 'path-overlap',
      name: 'Overlapping path',
      points: [point(-1, 0), point(1, 0)],
      inlineNodes: [inlineNode('node-overlap', 0, 0.5, '$n$')],
    }),
  ]

  const clickPoint = svgPointFor(diagram, point(0, 0))
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram,
    camera: diagram.camera,
    viewportHeight: viewportHeight,
    point: clickPoint,
  })
  const stableIds = candidates.map((candidate) => candidate.stableId)
  const firstCycle = nextSvgPreviewSelectionCycle(null, clickPoint, candidates)
  const secondCycle = nextSvgPreviewSelectionCycle(
    firstCycle.state,
    clickPoint,
    candidates,
  )

  assert.deepEqual(stableIds, [
    'coordinateAnchor:coord-overlap',
    'pathInlineNode:path-overlap:node-overlap',
    'curve:path-overlap',
  ])
  assert.equal(firstCycle.candidate?.stableId, 'pathInlineNode:path-overlap:node-overlap')
  assert.deepEqual(firstCycle.candidate?.selection, {
    kind: 'stratum',
    id: 'path-overlap',
  })
  assert.equal(secondCycle.candidate?.stableId, 'curve:path-overlap')
})

test('selection cycling candidate collection and inline-node previews are bounded', () => {
  const crowded = createEmptyDiagram({ ambientDimension: 2 })
  crowded.coordinateAnchors = Array.from(
    { length: maxSvgPreviewSelectionCandidates + 12 },
    (_, index) =>
      createCoordinateAnchor(crowded, {
        id: `coord-${index}`,
        name: `C${index}`,
        tikzName: `C${index}`,
        position: globalAnchorPosition(point(0, 0)),
      }),
  )
  const clickPoint = svgPointFor(crowded, point(0, 0))
  const candidates = collectSvgPreviewSelectionCandidates({
    diagram: crowded,
    camera: crowded.camera,
    viewportHeight: viewportHeight,
    point: clickPoint,
  })
  const cycle = nextSvgPreviewSelectionCycle(null, clickPoint, candidates)

  assert.equal(candidates.length, maxSvgPreviewSelectionCandidates)
  assert.equal(cycle.count, maxSvgPreviewSelectionCandidates)
  assert.equal(cycle.state?.candidateKeys.length, maxSvgPreviewSelectionCandidates)

  const inlineNodeHeavyPath = createCurveStratum({
    ambientDimension: 2,
    id: 'many-node-path',
    points: [point(0, 0), point(1, 0)],
    inlineNodes: Array.from(
      { length: maxSvgPathInlineNodePreviews + 10 },
      (_, index) => inlineNode(`node-${index}`, 0, 0.5, `$n_${index}$`),
    ),
  })
  const previews = pathInlineNodesForSvgPreview(
    inlineNodeHeavyPath,
    2,
    (modelPoint) => ({ x: modelPoint.x, y: modelPoint.y }),
  )

  assert.equal(previews.length, maxSvgPathInlineNodePreviews)
})

test('path inline node survives save/load and TikZ export', () => {
  const diagram = diagramWithStrata([
    createCurveStratum({
      ambientDimension: 2,
      id: 'inline-path',
      name: 'Inline path',
      points: [point(0, 0), point(2, 0)],
      inlineNodes: [inlineNode('mid-node', 0, 0.5, '$f$')],
    }),
  ])
  const parsed = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const loadedPath = findCurve(parsed.diagram, 'inline-path')
  const tikz = generateTikz(parsed.diagram)

  assert.equal(loadedPath.inlineNodes?.[0]?.text, '$f$')
  assert.match(tikz, /node\[pos=0\.5, above\] \{\$f\$\}/)
  assert.equal(validateDiagram(parsed.diagram).valid, true)
})

test('split path with coordinateRef endpoints and endpoint arrows is atomic and exportable', () => {
  const diagram = diagramWithAnchors([
    { id: 'coord-a', name: 'A', point: point(0, 0) },
    { id: 'coord-b', name: 'B', point: point(2, 0) },
  ])
  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'ref-arrow-path',
      name: 'Reference arrow path',
      points: [
        coordinateReferencePoint(diagram, 'coord-a'),
        coordinateReferencePoint(diagram, 'coord-b'),
      ],
      arrows: {
        endpoint: 'both',
        mid: {
          enabled: true,
          position: 0.4,
          direction: 'forward',
          head: 'stealth',
        },
      },
    }),
  )

  const unsupported = splitSelectedPath(
    diagram,
    selection('ref-arrow-path'),
    { segmentIndex: 0, t: 1 },
  )
  const result = splitSelectedPath(
    diagram,
    selection('ref-arrow-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'ref-first', secondId: 'ref-second' },
  )
  const first = expectSplitPath(result, 'ref-first')
  const second = expectSplitPath(result, 'ref-second')
  const firstLine = expectLine(first.segments[0])
  const secondLine = expectLine(second.segments[0])
  const tikz = generateTikz(result.diagram)

  assert.equal(unsupported.ok, false)
  assert.deepEqual(unsupported.diagram, diagram)
  assert.equal(
    coordinateReferenceSourceForPoint(firstLine.start)?.coordinateId,
    'coord-a',
  )
  assert.equal(coordinateReferenceSourceForPoint(firstLine.end), null)
  assert.equal(coordinateReferenceSourceForPoint(secondLine.start), null)
  assert.equal(
    coordinateReferenceSourceForPoint(secondLine.end)?.coordinateId,
    'coord-b',
  )
  assert.equal(first.arrows?.endpoint, 'backward')
  assert.equal(second.arrows?.endpoint, 'forward')
  assert.equal(first.arrows?.mid.enabled, false)
  assert.equal(second.arrows?.mid.enabled, false)
  assert.match(tikz, /\(A\) -- \(curvePathReferenceArrowPath10p1\);/)
  assert.match(tikz, /\(curvePathReferenceArrowPath21p0\) -- \(B\);/)
})

test('split path redistributes inline nodes and cleans stale crossings', () => {
  const diagram = diagramWithStrata([
    createConcatenatedPathStratum({
      ambientDimension: 2,
      id: 'node-path',
      segments: [lineSegment(point(0, 0), point(2, 0))],
      inlineNodes: [
        inlineNode('before-split', 0, 0.25, '$b$'),
        inlineNode('at-split', 0, 0.5, '$s$'),
        inlineNode('after-split', 0, 0.75, '$a$'),
      ],
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'other-path',
      points: [point(1, -1), point(1, 1)],
    }),
  ])
  diagram.pathCrossings = [crossingState('node-path', 'other-path')]

  const result = splitSelectedPath(
    diagram,
    selection('node-path'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'node-first', secondId: 'node-second' },
  )
  const first = expectSplitPath(result, 'node-first')
  const second = expectSplitPath(result, 'node-second')

  assert.equal(result.diagram.pathCrossings, undefined)
  assert.deepEqual(first.inlineNodes?.map((node) => node.id), ['before-split'])
  assert.deepEqual(second.inlineNodes?.map((node) => node.id), ['after-split'])
  assert.deepEqual(first.inlineNodes?.[0]?.position, {
    kind: 'segment',
    segmentIndex: 0,
    value: 0.5,
  })
  assert.deepEqual(second.inlineNodes?.[0]?.position, {
    kind: 'segment',
    segmentIndex: 0,
    value: 0.5,
  })
})

test('style eyedropper applies curve style and arrows to multi-selection atomically', () => {
  const diagram = createStyleDiagram()
  const copy = copyStyleFromSelection(diagram, selection('style-source'))

  assert.equal(copy.ok, true)
  if (!copy.ok) {
    throw new Error(copy.message)
  }

  const pasted = pasteStyleClipboardToSelection(
    diagram,
    {
      kind: 'multi',
      elements: [selection('style-target-a'), selection('style-target-b')],
    },
    copy.clipboard,
  )
  const mixed = pasteStyleClipboardToSelection(
    diagram,
    {
      kind: 'multi',
      elements: [
        selection('style-target-a'),
        { kind: 'label', id: 'style-label' },
      ],
    },
    copy.clipboard,
  )

  assert.equal(pasted.ok, true)
  if (!pasted.ok) {
    throw new Error(pasted.message)
  }
  assert.deepEqual(findCurve(pasted.diagram, 'style-target-a').style, sourceCurveStyle)
  assert.deepEqual(findCurve(pasted.diagram, 'style-target-b').style, sourceCurveStyle)
  assert.deepEqual(
    findCurve(pasted.diagram, 'style-target-a').arrows,
    findCurve(diagram, 'style-source').arrows,
  )
  assert.equal(mixed.ok, false)
  assert.deepEqual(mixed.diagram, diagram)
})

test('Inspector numeric .5 edit is committed and then used by TikZ export', () => {
  const edit = updateInspectorNumericDraft(
    '.5',
    parseFiniteNumber,
    finiteNumberDraftWarning('x'),
  )

  assert.equal(edit.commitValue, 0.5)

  const diagram = diagramWithStrata([
    createCurveStratum({
      ambientDimension: 2,
      id: 'numeric-path',
      points: [point(edit.commitValue ?? 0, 0), point(1, 0)],
    }),
  ])
  const tikz = generateTikz(diagram)

  assert.match(tikz, /\(0\.5,0\)/)
})

test('inline TikZ has no blank lines and 4-space indentation survives Phase 27 edits', () => {
  const diagram = createStyleDiagram()
  const copy = copyStyleFromSelection(diagram, selection('style-source'))

  assert.equal(copy.ok, true)
  if (!copy.ok) {
    throw new Error(copy.message)
  }

  const pasted = pasteStyleClipboardToSelection(
    diagram,
    { kind: 'stratum', id: 'style-target-a' },
    copy.clipboard,
  )

  assert.equal(pasted.ok, true)
  if (!pasted.ok) {
    throw new Error(pasted.message)
  }

  const split = splitSelectedPath(
    pasted.diagram,
    selection('style-target-a'),
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'format-first', secondId: 'format-second' },
  )

  assert.equal(split.ok, true)

  const inlineTikz = generateTikz(split.diagram, { exportMode: 'inlineMath' })
  const standaloneTikz = generateTikz(split.diagram)

  expectNoBlankLines(inlineTikz)
  assert.match(inlineTikz, /node\[pos=/)
  assert.match(standaloneTikz, /\n {8}\\draw\[/)
  assert.doesNotMatch(standaloneTikz, twoSpaceCommandIndentPattern)
})

test('undo/redo covers path split and style eyedropper as separate diagram edits', () => {
  const splitDiagram = diagramWithStrata([
    createCurveStratum({
      ambientDimension: 2,
      id: 'undo-path',
      points: [point(0, 0), point(2, 0)],
    }),
  ])
  const initialSplitState = createEditorState(splitDiagram, selection('undo-path'))
  const splitState = applySplitSelectedPathToEditorState(
    initialSplitState,
    { segmentIndex: 0, t: 0.5 },
    { firstId: 'undo-first', secondId: 'undo-second' },
  )
  const splitUndone = undoLastDiagramChange(splitState)
  const splitRedone = redoLastDiagramChange(splitUndone)

  assert.equal(findCurveOrNull(splitState.editableDiagram, 'undo-first') !== null, true)
  assert.deepEqual(splitUndone.editableDiagram, splitDiagram)
  assert.deepEqual(splitRedone.editableDiagram, splitState.editableDiagram)

  const styleDiagram = createStyleDiagram()
  const copy = copyStyleFromSelection(styleDiagram, selection('style-source'))

  assert.equal(copy.ok, true)
  if (!copy.ok) {
    throw new Error(copy.message)
  }

  const initialStyleState = createEditorState(styleDiagram, {
    kind: 'multi',
    elements: [selection('style-target-a'), selection('style-target-b')],
  })
  const styleState = applyStyleClipboardToEditorState(
    initialStyleState,
    copy.clipboard,
  )
  const styleUndone = undoLastDiagramChange(styleState)
  const styleRedone = redoLastDiagramChange(styleUndone)

  assert.deepEqual(
    findCurve(styleState.editableDiagram, 'style-target-a').style,
    sourceCurveStyle,
  )
  assert.deepEqual(
    findCurve(styleUndone.editableDiagram, 'style-target-a').style,
    targetCurveStyle,
  )
  assert.deepEqual(
    findCurve(styleRedone.editableDiagram, 'style-target-b').arrows,
    findCurve(styleDiagram, 'style-source').arrows,
  )
})

test('old diagrams without Phase 27 persisted fields still load', () => {
  const oldSavedDiagram = {
    format: savedDiagramFormat,
    version: savedDiagramVersion,
    diagram: {
      version: 1,
      ambientDimension: 2,
      strata: [
        {
          id: 'old-path',
          codim: 1,
          geometricKind: 'curve',
          kind: 'polyline',
          name: 'Old path',
          style: targetCurveStyle,
          points: [point(0, 0), point(1, 0)],
          styleSegments: [],
          layer: 0,
        },
      ],
      labels: [],
    },
  }
  const parsed = parseSavedDiagramJson(JSON.stringify(oldSavedDiagram))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const path = findCurve(parsed.diagram, 'old-path')

  assert.deepEqual(parsed.diagram.coordinateAnchors, [])
  assert.equal(path.inlineNodes, undefined)
  assert.equal(path.arrows?.endpoint, 'none')
  assert.equal(validateDiagram(parsed.diagram).valid, true)
})

const viewportHeight = 200
const twoSpaceCommandIndentPattern =
  /\n {2}\\(?:begin\{pgfonlayer\}|end\{pgfonlayer\}|begin\{scope\}|end\{scope\}|coordinate|definecolor|draw|filldraw|node|path|pgfdeclarelayer|pgfsetlayers|tdplotsetmaincoords|tikzset)/

function createStyleDiagram(): Diagram {
  const diagram = diagramWithStrata([
    createCurveStratum({
      ambientDimension: 2,
      id: 'style-source',
      name: 'Style source',
      style: sourceCurveStyle,
      points: [point(0, 0), point(2, 0)],
      arrows: {
        endpoint: 'forward',
        mid: {
          enabled: true,
          position: 0.35,
          direction: 'forward',
          head: 'latex',
        },
      },
      inlineNodes: [inlineNode('source-node', 0, 0.5, '$s$')],
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'style-target-a',
      name: 'Style target A',
      style: targetCurveStyle,
      points: [point(0, 1), point(2, 1)],
      arrows: { endpoint: 'none' },
      inlineNodes: [inlineNode('target-node-a', 0, 0.25, '$a$')],
    }),
    createCurveStratum({
      ambientDimension: 2,
      id: 'style-target-b',
      name: 'Style target B',
      style: targetCurveStyle,
      points: [point(0, 2), point(2, 2)],
      arrows: { endpoint: 'backward' },
    }),
  ])

  diagram.labels.push({
    id: 'style-label',
    geometricKind: 'label',
    name: 'Style label',
    text: '$L$',
    position: point(0, 0),
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  return diagram
}

function diagramWithStrata(strata: Stratum[]): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    strata,
  }
}

function diagramWithAnchors(
  anchors: Array<{ id: string; name: string; point: Vec3 }>,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  anchors.forEach((anchor) => {
    diagram.coordinateAnchors.push(
      createCoordinateAnchor(diagram, {
        id: anchor.id,
        name: anchor.name,
        tikzName: anchor.name,
        position: globalAnchorPosition(anchor.point),
      }),
    )
  })

  return diagram
}

function globalAnchorPosition(anchorPoint: Vec3) {
  return {
    kind: 'global' as const,
    value: symbolicVec3FromVec3(anchorPoint),
  }
}

function coordinateReferencePoint(diagram: Diagram, coordinateId: string): Vec3 {
  const referencedPoint = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (referencedPoint === null) {
    throw new Error(`Expected coordinate ${coordinateId}.`)
  }

  return referencedPoint
}

function selection(id: string): Extract<SelectedElement, { kind: 'stratum' }> {
  return { kind: 'stratum', id }
}

function lineSegment(start: Vec3, end: Vec3): PathSegment {
  return { kind: 'line', start, end }
}

function inlineNode(
  id: string,
  segmentIndex: number,
  value: number,
  text: string,
): PathInlineNode {
  return {
    id,
    position: {
      kind: 'segment',
      segmentIndex,
      value,
    },
    text,
    options: {
      placement: 'above',
    },
  }
}

function crossingState(pathAId: string, pathBId: string): PathCrossingState {
  return {
    id: `${pathAId}-${pathBId}-crossing`,
    pathAId,
    pathBId,
    point: point(1, 0),
    parameterA: 0.5,
    parameterB: 0.5,
    kind: 'braiding',
  }
}

function expectSplitPath(
  result: ReturnType<typeof splitSelectedPath>,
  id: string,
): ConcatenatedPathStratum {
  assert.equal(result.ok, true)

  const path = result.diagram.strata.find(
    (stratum): stratum is ConcatenatedPathStratum =>
      stratum.id === id &&
      stratum.geometricKind === 'curve' &&
      stratum.kind === 'concatenatedPath',
  )

  if (path === undefined) {
    throw new Error(`Expected split path ${id}.`)
  }

  return path
}

function expectLine(
  segment: PathSegment | undefined,
): Extract<PathSegment, { kind: 'line' }> {
  if (segment?.kind !== 'line') {
    throw new Error('Expected line segment.')
  }

  return segment
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const curve = findCurveOrNull(diagram, id)

  if (curve === null) {
    throw new Error(`Expected curve ${id}.`)
  }

  return curve
}

function findCurveOrNull(diagram: Diagram, id: string): CurveStratum | null {
  return (
    diagram.strata.find(
      (stratum): stratum is CurveStratum =>
        stratum.id === id && stratum.geometricKind === 'curve',
    ) ?? null
  )
}

function createEditorState(
  diagram: Diagram,
  selectedElement: SelectedElement,
  layerFilter: LayerFilter = allLayersFilter,
): Phase27EditorState {
  return {
    editableDiagram: diagram,
    selectedElement,
    layerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: '',
    history: createDiagramHistory(diagram),
  }
}

function svgPointFor(diagram: Diagram, modelPoint: Vec3): Vec2 {
  return projectToSvgPoint(diagram.camera, modelPoint, viewportHeight)
}

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function expectNoBlankLines(output: string): void {
  assert.doesNotMatch(output, /\n\s*\n/)
}
