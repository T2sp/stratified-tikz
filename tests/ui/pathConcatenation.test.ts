import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createTemplatePathStratum,
} from '../../src/model/constructors.ts'
import type {
  ConcatenatedPathStratum,
  CurveStratum,
  CurveStyle,
  Diagram,
  PathCrossingState,
  PathSegment,
  Stratum,
  Vec3,
} from '../../src/model/types.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import {
  applyConcatenateSelectedPathsToEditorState,
  concatenateSelectedPaths,
  type PathConcatenationEditorState,
} from '../../src/ui/pathConcatenation.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'
import {
  createDiagramHistory,
  redoLastDiagramChange,
  undoLastDiagramChange,
} from '../../src/ui/undo.ts'

type TestEditorState = PathConcatenationEditorState & {
  polylineDraft: null
  cubicBezierDraft: null
  pathDraft: null
  sheetPolygonDraft: null
}

const firstStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#AA0000',
  strokeOpacity: 0.75,
  lineWidth: 2,
  lineStyle: 'dashed',
}

const laterStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#0044AA',
  strokeOpacity: 0.5,
  lineWidth: 4,
  lineStyle: 'dotted',
}

test('concatenate selected paths joins two connected line paths', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    linePath('path-b', point(1, 0), point(2, 0)),
  ])
  const result = concatenateSelectedPaths(diagram, selection('path-a', 'path-b'), {
    id: 'joined-path',
  })
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.equal(path.segments.length, 2)
  assert.deepEqual(path.segments[0], {
    kind: 'line',
    start: point(0, 0),
    end: point(1, 0),
  })
  assert.deepEqual(path.segments[1], {
    kind: 'line',
    start: point(1, 0),
    end: point(2, 0),
  })
})

test('concatenate selected paths joins three connected paths in selection order', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    cubicPath('path-b', point(1, 0), point(2, 0)),
    linePath('path-c', point(2, 0), point(3, 0)),
  ])
  const result = concatenateSelectedPaths(
    diagram,
    selection('path-a', 'path-b', 'path-c'),
    { id: 'joined-path' },
  )
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.equal(path.segments.length, 3)
  assert.equal(path.segments[0].kind, 'line')
  assert.equal(path.segments[1].kind, 'cubicBezier')
  assert.equal(path.segments[2].kind, 'line')
})

test('concatenate selected paths auto-reverses the next path when its end matches', () => {
  const sourceB = linePath('path-b', point(2, 0), point(1, 0))
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    sourceB,
  ])
  const result = concatenateSelectedPaths(diagram, selection('path-a', 'path-b'), {
    id: 'joined-path',
  })
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.deepEqual(result.reversedSourcePathIds, ['path-b'])
  assert.deepEqual(path.segments[1], {
    kind: 'line',
    start: point(1, 0),
    end: point(2, 0),
  })
  assert.deepEqual(findCurve(diagram, 'path-b'), sourceB)
})

test('concatenate selected paths rejects non-connected paths without mutation', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    linePath('path-b', point(3, 0), point(4, 0)),
  ])
  const result = concatenateSelectedPaths(diagram, selection('path-a', 'path-b'), {
    id: 'joined-path',
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, 'endpointMismatch')
  assert.equal(result.diagram, diagram)
  assert.equal(hasStratum(result.diagram, 'joined-path'), false)
})

test('concatenate selected paths leaves sources unchanged when keeping originals', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    linePath('path-b', point(1, 0), point(2, 0)),
  ])
  const beforeA = structuredClone(findCurve(diagram, 'path-a')) as CurveStratum
  const beforeB = structuredClone(findCurve(diagram, 'path-b')) as CurveStratum
  const result = concatenateSelectedPaths(diagram, selection('path-a', 'path-b'), {
    id: 'joined-path',
    keepOriginals: true,
  })

  assert.equal(result.ok, true)
  assert.deepEqual(findCurve(result.diagram, 'path-a'), beforeA)
  assert.deepEqual(findCurve(result.diagram, 'path-b'), beforeB)
})

test('concatenate selected paths removes sources when keep originals is off', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    linePath('path-b', point(1, 0), point(2, 0)),
  ])
  const result = concatenateSelectedPaths(diagram, selection('path-a', 'path-b'), {
    id: 'joined-path',
    keepOriginals: false,
  })

  assert.equal(result.ok, true)
  assert.equal(hasStratum(result.diagram, 'path-a'), false)
  assert.equal(hasStratum(result.diagram, 'path-b'), false)
  assert.equal(hasStratum(result.diagram, 'joined-path'), true)
})

test('concatenate selected paths selects the new path', () => {
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('path-a', point(0, 0), point(1, 0)),
      linePath('path-b', point(1, 0), point(2, 0)),
    ]),
    selection('path-a', 'path-b'),
    { id: 'joined-path' },
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.selectedElement, {
    kind: 'stratum',
    id: 'joined-path',
  })
})

test('concatenate selected paths generates a fresh id', () => {
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('concatenated-path-1', point(-2, 0), point(-1, 0)),
      linePath('path-a', point(0, 0), point(1, 0)),
      linePath('path-b', point(1, 0), point(2, 0)),
    ]),
    selection('path-a', 'path-b'),
  )

  assert.equal(result.ok, true)
  assert.equal(result.id, 'concatenated-path-2')
})

test('concatenate selected paths inherits style, arrows, and layer from the first path', () => {
  const first = linePath('path-a', point(0, 0), point(1, 0), {
    style: firstStyle,
    layer: 7,
    arrows: {
      endpoint: 'forward',
      mid: {
        enabled: true,
        position: 0.4,
        direction: 'forward',
        head: 'stealth',
      },
    },
  })
  const second = linePath('path-b', point(1, 0), point(2, 0), {
    style: laterStyle,
    layer: 2,
    arrows: {
      endpoint: 'backward',
      mid: {
        enabled: true,
        position: 0.8,
        direction: 'backward',
        head: 'latex',
      },
    },
  })
  const result = concatenateSelectedPaths(
    diagramWithStrata([first, second]),
    selection('path-a', 'path-b'),
    { id: 'joined-path' },
  )
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.deepEqual(path.style, first.style)
  assert.deepEqual(path.arrows, first.arrows)
  assert.equal(path.layer, 7)
})

test('concatenate selected paths does not preserve later styles as segment overrides', () => {
  const overriddenLater = createConcatenatedPathStratum({
    ambientDimension: 2,
    id: 'path-b',
    name: 'Path B',
    style: laterStyle,
    segments: [
      {
        kind: 'line',
        start: point(1, 0),
        end: point(2, 0),
        styleOverride: {
          strokeColor: '#00AA00',
          lineStyle: 'denselyDotted',
        },
      },
    ],
  })
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('path-a', point(0, 0), point(1, 0), { style: firstStyle }),
      overriddenLater,
    ]),
    selection('path-a', 'path-b'),
    { id: 'joined-path' },
  )
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.deepEqual(path.style, firstStyle)
  assert.deepEqual(path.styleSegments, [])
  assert.equal(path.segments.some((segment) => segment.styleOverride !== undefined), false)
})

test('concatenate selected paths preserves symbolic coordinate expressions', () => {
  const symbolicStart = symbolicPoint('a', 1)
  const symbolicEnd = symbolicPoint('b', 2)
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('path-a', point(0, 0), point(1, 0)),
      linePath('path-b', symbolicStart, symbolicEnd),
    ]),
    selection('path-a', 'path-b'),
    { id: 'joined-path' },
  )
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.equal(path.segments[1].kind, 'line')
  if (path.segments[1].kind !== 'line') {
    throw new Error('Expected a line segment.')
  }
  assert.equal(path.segments[1].start.symbolic?.x.kind, 'symbolic')
  assert.equal(path.segments[1].start.symbolic?.x.expression, 'a')
  assert.equal(path.segments[1].end.symbolic?.x.kind, 'symbolic')
  assert.equal(path.segments[1].end.symbolic?.x.expression, 'b')
})

test('concatenate selected paths cleans crossing states when originals are removed', () => {
  const diagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    linePath('path-b', point(1, 0), point(2, 0)),
    linePath('path-c', point(0, 1), point(1, 1)),
  ])
  diagram.pathCrossings = [crossingState('path-a', 'path-c')]

  const result = concatenateSelectedPaths(diagram, selection('path-a', 'path-b'), {
    id: 'joined-path',
    keepOriginals: false,
  })

  assert.equal(result.ok, true)
  assert.equal(result.diagram.pathCrossings, undefined)
})

test('concatenate selected paths works with undo and redo', () => {
  const initialDiagram = diagramWithStrata([
    linePath('path-a', point(0, 0), point(1, 0)),
    linePath('path-b', point(1, 0), point(2, 0)),
  ])
  const initial = createTestEditorState(
    initialDiagram,
    selection('path-a', 'path-b'),
  )
  const concatenated = applyConcatenateSelectedPathsToEditorState(initial, {
    id: 'joined-path',
    keepOriginals: false,
  })
  const undone = undoLastDiagramChange(concatenated)
  const redone = redoLastDiagramChange(undone)

  assert.equal(hasStratum(concatenated.editableDiagram, 'joined-path'), true)
  assert.equal(hasStratum(concatenated.editableDiagram, 'path-a'), false)
  assert.deepEqual(concatenated.selectedElement, {
    kind: 'stratum',
    id: 'joined-path',
  })
  assert.equal(hasStratum(undone.editableDiagram, 'joined-path'), false)
  assert.equal(hasStratum(undone.editableDiagram, 'path-a'), true)
  assert.equal(hasStratum(redone.editableDiagram, 'joined-path'), true)
  assert.equal(hasStratum(redone.editableDiagram, 'path-a'), false)
})

test('concatenated path TikZ output is valid and readable', () => {
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('path-a', point(0, 0), point(1, 0), { style: firstStyle }),
      linePath('path-b', point(1, 0), point(2, 0), { style: laterStyle }),
    ]),
    selection('path-a', 'path-b'),
    { id: 'joined-path', name: 'Joined Path' },
  )
  const path = expectConcatenatedPath(result, 'joined-path')
  const validation = validateDiagram(result.diagram)
  const tikz = generateTikz(result.diagram)

  assert.equal(validation.valid, true, validation.errors.map((error) => error.message).join('\n'))
  assert.equal(path.kind, 'concatenatedPath')
  assert.match(tikz, /\\coordinate \(curvePathJoinedPath2p0\) at \(0,0\);/)
  assert.match(tikz, /\\draw\[/)
  assert.match(tikz, /\(curvePathJoinedPath2p0\) -- \(curvePathJoinedPath2p1\) -- \(curvePathJoinedPath2p2\);/)
})

test('concatenate selected paths converts circle templates to exact arc segments', () => {
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('path-a', point(-1, 0), point(1, 0)),
      createTemplatePathStratum({
        ambientDimension: 2,
        id: 'circle-path',
        name: 'Circle Path',
        template: {
          kind: 'circleTemplate',
          center: point(0, 0),
          radius: 1,
        },
      }),
    ]),
    selection('path-a', 'circle-path'),
    { id: 'joined-path' },
  )
  const path = expectConcatenatedPath(result, 'joined-path')

  assert.equal(path.segments.length, 3)
  assert.equal(path.segments[1].kind, 'arc')
  assert.equal(path.segments[2].kind, 'arc')
})

test('concatenate selected paths rejects ellipse templates because they are not exact path segments', () => {
  const result = concatenateSelectedPaths(
    diagramWithStrata([
      linePath('path-a', point(-2, 0), point(-1, 0)),
      createTemplatePathStratum({
        ambientDimension: 2,
        id: 'ellipse-path',
        name: 'Ellipse Path',
        template: {
          kind: 'ellipseTemplate',
          center: point(0, 0),
          radiusX: 1,
          radiusY: 2,
        },
      }),
    ]),
    selection('path-a', 'ellipse-path'),
    { id: 'joined-path' },
  )

  assert.equal(result.ok, false)
  assert.equal(result.error, 'unsupportedTemplatePath')
  assert.equal(hasStratum(result.diagram, 'joined-path'), false)
})

function linePath(
  id: string,
  start: Vec3,
  end: Vec3,
  options: {
    style?: CurveStyle
    layer?: number
    arrows?: NonNullable<CurveStratum['arrows']>
  } = {},
): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    name: id,
    style: options.style,
    points: [start, end],
    layer: options.layer,
    arrows: options.arrows,
  })
}

function cubicPath(id: string, start: Vec3, end: Vec3): CurveStratum {
  return createCurveStratum({
    ambientDimension: 2,
    id,
    kind: 'cubicBezier',
    name: id,
    points: [
      start,
      point(start.x + 0.25, start.y + 1),
      point(end.x - 0.25, end.y + 1),
      end,
    ],
  })
}

function diagramWithStrata(strata: Stratum[]): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(...strata)
  return diagram
}

function selection(...ids: string[]): SelectedElement {
  return {
    kind: 'multi',
    elements: ids.map((id) => ({ kind: 'stratum', id })),
  }
}

function expectConcatenatedPath(
  result: ReturnType<typeof concatenateSelectedPaths>,
  id: string,
): ConcatenatedPathStratum {
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error(result.error)
  }

  return findConcatenatedPath(result.diagram, id)
}

function findConcatenatedPath(
  diagram: Diagram,
  id: string,
): ConcatenatedPathStratum {
  const curve = findCurve(diagram, id)

  if (curve.kind !== 'concatenatedPath') {
    throw new Error(`Expected ${id} to be a concatenated path.`)
  }

  return curve
}

function findCurve(diagram: Diagram, id: string): CurveStratum {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve') {
    throw new Error(`Expected ${id} to be a curve.`)
  }

  return stratum
}

function hasStratum(diagram: Diagram, id: string): boolean {
  return diagram.strata.some((stratum) => stratum.id === id)
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
