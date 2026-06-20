import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import {
  createEmptyDiagram,
  createGridStratum,
} from '../../src/model/constructors.ts'
import {
  createNumericScalarInputValue,
  gridPreviewSegments,
  workPlaneGridFrame,
  xyGridFrame,
} from '../../src/model/grids.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import { projectToSvgPoint } from '../../src/rendering/svgProjection.ts'
import { polylineToSvgPath } from '../../src/rendering/svgPath.ts'
import type {
  CurveStyle,
  Diagram,
  GridParameterRange,
  GridStratum,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'

test('valid 2D grid validates', () => {
  const diagram = diagramWithGrid(valid2DGrid())
  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, true, validation.errors.map(formatIssue).join('; '))
})

test('grid with invalid step is rejected', () => {
  const grid = valid2DGrid({
    uRange: range(-2, 2, 0),
  })
  const validation = validateDiagram(diagramWithGrid(grid))

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /step must be positive/)
})

test('grid with invalid range is rejected', () => {
  const grid = valid2DGrid({
    vRange: range(2, -2, 1),
  })
  const validation = validateDiagram(diagramWithGrid(grid))

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /max must be greater/)
})

test('grid preview line count cap rejects excessive grids', () => {
  const grid = valid2DGrid({
    uRange: range(-300, 300, 1),
    vRange: range(-300, 300, 1),
    clip: clip(-300, 300, -300, 300),
  })
  const validation = validateDiagram(diagramWithGrid(grid))

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /line cap/)
})

test('2D grid preview produces finite line segments', () => {
  const preview = gridPreviewSegments(valid2DGrid(), 2)

  assert.equal(preview.ok, true)
  if (!preview.ok) {
    throw new Error(preview.errors.map(formatIssue).join('; '))
  }
  assert.equal(preview.lineCount, 10)
  assert.equal(preview.segments.every(segmentIsFinite), true)
  assert.equal(preview.segments.every((segment) => segment.start.z === 0), true)
  assert.equal(preview.segments.every((segment) => segment.end.z === 0), true)
})

test('3D work-plane grid preview produces finite projected lines', () => {
  const grid = valid3DGrid()
  const preview = gridPreviewSegments(grid, 3)

  assert.equal(preview.ok, true)
  if (!preview.ok) {
    throw new Error(preview.errors.map(formatIssue).join('; '))
  }

  const camera = createInitialCamera3D()
  const projected = preview.segments.flatMap((segment) => [
    projectToSvgPoint(camera, segment.start, 360),
    projectToSvgPoint(camera, segment.end, 360),
  ])

  assert.equal(projected.every((point) => Number.isFinite(point.x)), true)
  assert.equal(projected.every((point) => Number.isFinite(point.y)), true)
})

test('grid layer and style are preserved', () => {
  const style: CurveStyle = {
    kind: 'curveStyle',
    strokeColor: '#4D9DE0',
    strokeOpacity: 0.4,
    lineWidth: 0.8,
    lineStyle: 'dashed',
  }
  const grid = valid2DGrid({
    layer: 7,
    style,
  })
  const diagram = diagramWithGrid(grid)

  assert.equal(diagram.strata[0]?.layer, 7)
  assert.deepEqual(diagram.strata[0]?.style, style)
})

test('grid save and load round-trip', () => {
  const grid = valid2DGrid({
    id: 'grid-round-trip',
    name: 'Round trip grid',
    layer: 3,
  })
  const loaded = parseSavedDiagramJson(serializeDiagram(diagramWithGrid(grid)))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  assert.deepEqual(loaded.diagram.strata, [grid])
})

test('old diagrams without grids still load', () => {
  const loaded = parseSavedDiagramJson(
    serializeDiagram(createEmptyDiagram({ ambientDimension: 2 })),
  )

  assert.equal(loaded.ok, true)
})

test('existing polyline SVG path rendering is unchanged', () => {
  assert.equal(
    polylineToSvgPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    'M 0,0 L 1,0 L 1,1',
  )
})

function valid2DGrid(
  overrides: Partial<Pick<GridStratum, 'id' | 'name' | 'uRange' | 'vRange' | 'clip' | 'style' | 'layer'>> = {},
): GridStratum {
  return createGridStratum({
    ambientDimension: 2,
    id: overrides.id ?? 'grid-2d',
    name: overrides.name ?? '2D grid',
    frame: xyGridFrame(),
    uRange: overrides.uRange ?? range(-2, 2, 1),
    vRange: overrides.vRange ?? range(-2, 2, 1),
    clip: overrides.clip ?? clip(-2, 2, -2, 2),
    ...(overrides.style === undefined ? {} : { style: overrides.style }),
    layer: overrides.layer ?? 0,
  })
}

function valid3DGrid(): GridStratum {
  return createGridStratum({
    ambientDimension: 3,
    id: 'grid-3d',
    name: '3D grid',
    frame: workPlaneGridFrame(xzFrameAtY(1)),
    uRange: range(-1, 1, 1),
    vRange: range(-1, 1, 1),
    clip: clip(-1, 1, -1, 1),
    layer: 0,
  })
}

function diagramWithGrid(grid: GridStratum): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: grid.codim === 1 ? 2 : 3 }),
    strata: [grid],
  }
}

function range(min: number, max: number, step: number): GridParameterRange {
  return {
    min: createNumericScalarInputValue(min),
    max: createNumericScalarInputValue(max),
    step: createNumericScalarInputValue(step),
  }
}

function clip(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
): GridStratum['clip'] {
  return {
    kind: 'rectangle',
    uMin: createNumericScalarInputValue(uMin),
    uMax: createNumericScalarInputValue(uMax),
    vMin: createNumericScalarInputValue(vMin),
    vMax: createNumericScalarInputValue(vMax),
  }
}

function xzFrameAtY(y: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y, z: 0 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  }
}

function segmentIsFinite(segment: {
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }
}): boolean {
  return (
    Number.isFinite(segment.start.x) &&
    Number.isFinite(segment.start.y) &&
    Number.isFinite(segment.start.z) &&
    Number.isFinite(segment.end.x) &&
    Number.isFinite(segment.end.y) &&
    Number.isFinite(segment.end.z)
  )
}

function formatIssue(issue: { path: string; message: string }): string {
  return `${issue.path} ${issue.message}`
}
