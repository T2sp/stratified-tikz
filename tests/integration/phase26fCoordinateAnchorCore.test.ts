import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCoordinateAnchor,
  coordinateReferenceVec3ForAnchorId,
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
  parseSavedDiagramJson,
  resolveDiagramCoordinateRefs,
  serializeDiagram,
  setLayerVisibility,
  validateDiagram,
} from '../../src/model/index.ts'
import { svgCoordinateAnchorMarkers } from '../../src/rendering/svgCoordinateAnchors.ts'
import { generateTikz } from '../../src/tikz/index.ts'
import { addCoordinateAnchorFromDirectInput } from '../../src/ui/diagramUpdates.ts'
import { toggleCoordinateAnchorVisibility } from '../../src/ui/previewToolbar.ts'
import type {
  CoordinateAnchorPosition,
  Diagram,
  SymbolicVariable,
  Vec3,
} from '../../src/model/types.ts'

test('coordinate anchor referenced by a path exports before layer drawing commands', () => {
  const diagram = createReferencedPathDiagram()
  const tikz = generateTikz(diagram)
  const anchorAIndex = tikz.indexOf('\\coordinate (A) at (0,0);')
  const anchorBIndex = tikz.indexOf('\\coordinate (B) at (2,1);')
  const pathIndex = tikz.indexOf('(A) -- (B);')
  const layerIndex = tikz.indexOf('\\begin{pgfonlayer}{stratifiedLayer0}')

  assert.equal(validateDiagram(diagram).valid, true)
  assert.ok(anchorAIndex >= 0)
  assert.ok(anchorBIndex > anchorAIndex)
  assert.ok(pathIndex > anchorBIndex)
  assert.ok(layerIndex > anchorBIndex)
  assert.ok(pathIndex > layerIndex)
  assert.doesNotMatch(tikz, /\\coordinate \(curvePolyReferencedPath0p0\)/)
})

test('work-plane-local coordinate anchor referenced by a label preserves local TikZ', () => {
  const diagram = createWorkPlaneLocalLabelDiagram()
  const tikz = generateTikz(diagram)

  assert.equal(validateDiagram(diagram).valid, true)
  assert.match(tikz, /\\coordinate \(LocalAnchor\) at \(\{\\R \/ 2\},1\);/)
  assert.match(tikz, /\\node at \(LocalAnchor\) \{\$L\$\};/)
})

test('coordinate references survive save and load', () => {
  const parsed = parseSavedDiagramJson(serializeDiagram(createReferencedPathDiagram()))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const curve = findPolyline(parsed.diagram, 'referenced-path')

  assert.equal(referenceId(curve.points[0]), 'coord-a')
  assert.equal(referenceId(curve.points[1]), 'coord-b')
  assert.match(generateTikz(parsed.diagram), /\(A\) -- \(B\);/)
})

test('renaming a coordinate TikZ name updates exported references', () => {
  const diagram = createReferencedPathDiagram()
  const renamed: Diagram = {
    ...diagram,
    coordinateAnchors: (diagram.coordinateAnchors ?? []).map((anchor) =>
      anchor.id === 'coord-a'
        ? {
            ...anchor,
            tikzName: 'RenamedA',
          }
        : anchor,
    ),
  }
  const tikz = generateTikz(renamed)

  assert.equal(validateDiagram(renamed).valid, true)
  assert.match(tikz, /\\coordinate \(RenamedA\) at \(0,0\);/)
  assert.match(tikz, /\(RenamedA\) -- \(B\);/)
  assert.doesNotMatch(tikz, /\\coordinate \(A\) at \(0,0\);/)
})

test('moving a coordinate anchor updates resolved preview references', () => {
  const diagram = createReferencedPathDiagram()
  const moved: Diagram = {
    ...diagram,
    coordinateAnchors: (diagram.coordinateAnchors ?? []).map((anchor) =>
      anchor.id === 'coord-a'
        ? {
            ...anchor,
            position: globalAnchorPosition(6, 7, 0),
          }
        : anchor,
    ),
  }
  const resolved = resolveDiagramCoordinateRefs(moved)
  const curve = findPolyline(resolved, 'referenced-path')

  assert.equal(validateDiagram(moved).valid, true)
  assert.deepEqual(pointPreview(curve.points[0]), { x: 6, y: 7, z: 0 })
  assert.equal(referenceId(curve.points[0]), 'coord-a')
  assert.deepEqual(referencePreview(curve.points[0]), { x: 6, y: 7, z: 0 })
})

test('coordinate anchors are not affected by hidden layer view or new layer creation', () => {
  const diagram = createReferencedPathDiagram()
  const withHiddenLayer = setLayerVisibility(
    {
      ...diagram,
      layers: [{ value: 0, name: 'Layer 0', visible: true }],
      strata: [
        ...diagram.strata,
        createPointStratum({
          ambientDimension: 2,
          id: 'hidden-layer-point',
          name: 'Hidden layer point',
          position: { x: 0, y: 0, z: 0 },
          layer: 0,
        }),
      ],
    },
    0,
    false,
  )
  const markers = svgCoordinateAnchorMarkers(
    withHiddenLayer,
    withHiddenLayer.camera,
    360,
    null,
  )
  const created = addCoordinateAnchorFromDirectInput(
    {
      ...createEmptyDiagram({ ambientDimension: 2 }),
      layers: [{ value: 12, name: 'New layer' }],
    },
    { x: '3', y: '4', z: '0' },
    { id: 'new-layer-coordinate', name: 'Layerless coordinate' },
  )

  assert.equal(markers.length, 2)
  assert.equal(created.ok, true)
  if (!created.ok) {
    throw new Error('Expected coordinate creation to succeed.')
  }

  const anchor = created.diagram.coordinateAnchors?.find(
    (candidate) => candidate.id === 'new-layer-coordinate',
  )
  const tikz = generateTikz(created.diagram)

  assert.notEqual(anchor, undefined)
  assert.equal(anchor !== undefined && 'layer' in anchor, false)
  assert.match(tikz, /\\coordinate \(LayerlessCoordinate\) at \(3,4\);/)
  assert.doesNotMatch(tikz, /stratifiedLayer12/)
})

test('coordinate anchor show and hide state does not affect TikZ output', () => {
  const diagram = createReferencedPathDiagram()
  const before = generateTikz(diagram)

  assert.equal(toggleCoordinateAnchorVisibility(true), false)
  assert.equal(toggleCoordinateAnchorVisibility(false), true)
  assert.equal(generateTikz(diagram), before)
})

test('coordinate anchor inline output has no blank lines and uses four-space indentation', () => {
  const tikz = generateTikz(createReferencedPathDiagram(), {
    exportMode: 'inlineMath',
  })

  expectNoBlankLines(tikz)
  assert.match(tikz, /\n    \\coordinate \(A\) at \(0,0\);/)
  assert.match(tikz, /\n    \\coordinate \(B\) at \(2,1\);/)
  assert.match(tikz, /\n    \\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  assert.doesNotMatch(
    tikz,
    /\n  \\(?:coordinate|begin\{pgfonlayer\}|draw|node)/,
  )
})

test('old saved diagrams without coordinateAnchors still load', () => {
  const saved = JSON.parse(
    serializeDiagram(createEmptyDiagram({ ambientDimension: 2 })),
  ) as {
    diagram: {
      coordinateAnchors?: unknown
    }
  }

  delete saved.diagram.coordinateAnchors

  const parsed = parseSavedDiagramJson(JSON.stringify(saved))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  assert.deepEqual(parsed.diagram.coordinateAnchors, [])
})

function createReferencedPathDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-a',
      name: 'A',
      tikzName: 'A',
      position: globalAnchorPosition(0, 0, 0),
    }),
  ]
  diagram.coordinateAnchors = [
    ...diagram.coordinateAnchors,
    createCoordinateAnchor(diagram, {
      id: 'coord-b',
      name: 'B',
      tikzName: 'B',
      position: globalAnchorPosition(2, 1, 0),
    }),
  ]

  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 2,
      id: 'referenced-path',
      name: 'Referenced path',
      points: [
        requiredCoordinateReference(diagram, 'coord-a'),
        requiredCoordinateReference(diagram, 'coord-b'),
      ],
      layer: 0,
    }),
  )

  return diagram
}

function createWorkPlaneLocalLabelDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const variable: SymbolicVariable = {
    id: 'var-R',
    name: 'R',
    macroName: 'R',
    expression: '2',
    previewValue: 2,
  }

  diagram.variables = [variable]
  diagram.coordinateAnchors = [
    createCoordinateAnchor(diagram, {
      id: 'coord-local',
      name: 'Local anchor',
      tikzName: 'LocalAnchor',
      position: workPlaneLocalAnchorPosition(),
    }),
  ]
  diagram.labels.push(
    createTextLabel({
      ambientDimension: 3,
      id: 'local-anchor-label',
      name: 'Local anchor label',
      text: '$L$',
      position: requiredCoordinateReference(diagram, 'coord-local'),
      layer: 0,
    }),
  )

  return diagram
}

function globalAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
    },
  }
}

function workPlaneLocalAnchorPosition(): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: {
      origin: { x: 0, y: 0, z: 0 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    },
    local: {
      a: { kind: 'symbolic', expression: 'R/2', previewValue: 1 },
      b: { kind: 'numeric', value: 1 },
    },
    preview: { x: 1, y: 1, z: 0 },
  }
}

function requiredCoordinateReference(diagram: Diagram, coordinateId: string): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Expected coordinate reference ${coordinateId}.`)
  }

  return point
}

function findPolyline(diagram: Diagram, id: string) {
  const stratum = diagram.strata.find((candidate) => candidate.id === id)

  if (stratum?.geometricKind !== 'curve' || stratum.kind !== 'polyline') {
    throw new Error(`Expected polyline ${id}.`)
  }

  return stratum
}

function referenceId(point: Vec3): string | undefined {
  const source = point.symbolic?.source

  return source?.kind === 'coordinateRef' ? source.coordinateId : undefined
}

function referencePreview(point: Vec3): Vec3 | undefined {
  const source = point.symbolic?.source

  return source?.kind === 'coordinateRef' ? source.preview : undefined
}

function pointPreview(point: Vec3): Vec3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  }
}

function expectNoBlankLines(output: string): void {
  assert.doesNotMatch(output, /\n\s*\n/)
  assert.equal(output.startsWith('\n'), false)
  assert.equal(output.endsWith('\n'), false)
}
