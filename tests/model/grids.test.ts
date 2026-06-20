import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import {
  createEmptyDiagram,
  createGridStratum,
} from '../../src/model/constructors.ts'
import {
  createNumericScalarInputValue,
  gridLatticePattern,
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
  LatticePattern,
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

test('old grids without lattice pattern default to rectangular', () => {
  const { latticePattern: _omitted, ...oldGrid } = valid2DGrid()
  const grid = oldGrid as GridStratum
  const validation = validateDiagram(diagramWithGrid(grid))

  assert.equal(gridLatticePattern(grid), 'rectangular')
  assert.equal(validation.valid, true, validation.errors.map(formatIssue).join('; '))
})

test('grid with invalid lattice pattern is rejected', () => {
  const grid = {
    ...valid2DGrid(),
    latticePattern: 'diagonal',
  } as GridStratum
  const validation = validateDiagram(diagramWithGrid(grid))

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /lattice pattern/)
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

test('triangular lattice with positive spacing validates', () => {
  const validation = validateDiagram(
    diagramWithGrid(valid2DGrid({ latticePattern: 'triangular' })),
  )

  assert.equal(validation.valid, true, validation.errors.map(formatIssue).join('; '))
})

test('triangular lattice with non-positive spacing is rejected', () => {
  const validation = validateDiagram(
    diagramWithGrid(
      valid2DGrid({
        latticePattern: 'triangular',
        uRange: range(-2, 2, 0),
      }),
    ),
  )

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /step must be positive/)
})

test('honeycomb lattice with positive edge length validates', () => {
  const validation = validateDiagram(
    diagramWithGrid(valid2DGrid({ latticePattern: 'honeycomb' })),
  )

  assert.equal(validation.valid, true, validation.errors.map(formatIssue).join('; '))
})

test('honeycomb lattice with non-positive edge length is rejected', () => {
  const validation = validateDiagram(
    diagramWithGrid(
      valid2DGrid({
        latticePattern: 'honeycomb',
        uRange: range(-2, 2, -1),
      }),
    ),
  )

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /step must be positive/)
})

test('excessive triangular lattice line count is rejected', () => {
  const validation = validateDiagram(
    diagramWithGrid(
      valid2DGrid({
        latticePattern: 'triangular',
        uRange: range(-20, 20, 0.01),
        vRange: range(-20, 20, 1),
        clip: clip(-20, 20, -20, 20),
      }),
    ),
  )

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatIssue).join('\n'), /line cap/)
})

test('excessive honeycomb lattice edge count is rejected', () => {
  const validation = validateDiagram(
    diagramWithGrid(
      valid2DGrid({
        latticePattern: 'honeycomb',
        uRange: range(-20, 20, 0.05),
        vRange: range(-20, 20, 1),
        clip: clip(-20, 20, -20, 20),
      }),
    ),
  )

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

test('triangular lattice preview produces finite 2D segments in three directions', () => {
  const preview = gridPreviewSegments(
    valid2DGrid({ latticePattern: 'triangular' }),
    2,
  )

  assert.equal(preview.ok, true)
  if (!preview.ok) {
    throw new Error(preview.errors.map(formatIssue).join('; '))
  }
  assert.equal(preview.segments.every(segmentIsFinite), true)
  assert.equal(preview.segments.every((segment) => segment.start.z === 0), true)
  assert.equal(preview.segments.every((segment) => segment.end.z === 0), true)
  assert.deepEqual(localDirectionFamilies(preview.segments), [
    'negativeDiagonal',
    'positiveDiagonal',
    'u',
  ])
})

test('honeycomb lattice preview produces finite hexagonal 2D edges', () => {
  const preview = gridPreviewSegments(
    valid2DGrid({ latticePattern: 'honeycomb' }),
    2,
  )

  assert.equal(preview.ok, true)
  if (!preview.ok) {
    throw new Error(preview.errors.map(formatIssue).join('; '))
  }
  assert.equal(preview.segments.every(segmentIsFinite), true)
  assert.equal(preview.segments.every((segment) => segment.start.z === 0), true)
  assert.equal(preview.segments.every((segment) => segment.end.z === 0), true)
  assert.deepEqual(localDirectionFamilies(preview.segments), [
    'negativeDiagonal',
    'positiveDiagonal',
    'u',
  ])
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

test('3D triangular and honeycomb previews lie in the stored work-plane frame', () => {
  for (const latticePattern of ['triangular', 'honeycomb'] as const) {
    const grid = valid3DGrid(latticePattern)
    const preview = gridPreviewSegments(grid, 3)

    assert.equal(preview.ok, true)
    if (!preview.ok) {
      throw new Error(preview.errors.map(formatIssue).join('; '))
    }
    assert.equal(preview.segments.every(segmentIsFinite), true)
    assert.equal(preview.segments.every((segment) => segment.start.y === 1), true)
    assert.equal(preview.segments.every((segment) => segment.end.y === 1), true)
  }
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

test('grid save and load preserves lattice pattern', () => {
  const grid = valid2DGrid({
    id: 'triangular-round-trip',
    name: 'Triangular grid',
    latticePattern: 'triangular',
  })
  const loaded = parseSavedDiagramJson(serializeDiagram(diagramWithGrid(grid)))

  assert.equal(loaded.ok, true)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }

  assert.equal(
    loaded.diagram.strata.find((stratum) => stratum.id === grid.id)?.kind,
    'grid',
  )
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
  overrides: Partial<Pick<GridStratum, 'id' | 'name' | 'latticePattern' | 'uRange' | 'vRange' | 'clip' | 'style' | 'layer'>> = {},
): GridStratum {
  return createGridStratum({
    ambientDimension: 2,
    id: overrides.id ?? 'grid-2d',
    name: overrides.name ?? '2D grid',
    latticePattern: overrides.latticePattern,
    frame: xyGridFrame(),
    uRange: overrides.uRange ?? range(-2, 2, 1),
    vRange: overrides.vRange ?? range(-2, 2, 1),
    clip: overrides.clip ?? clip(-2, 2, -2, 2),
    ...(overrides.style === undefined ? {} : { style: overrides.style }),
    layer: overrides.layer ?? 0,
  })
}

function valid3DGrid(latticePattern: LatticePattern = 'rectangular'): GridStratum {
  return createGridStratum({
    ambientDimension: 3,
    id: 'grid-3d',
    name: '3D grid',
    latticePattern,
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

function localDirectionFamilies(
  segments: Array<{
    start: { x: number; y: number }
    end: { x: number; y: number }
  }>,
): string[] {
  return [
    ...new Set(
      segments.map((segment) => {
        const dx = segment.end.x - segment.start.x
        const dy = segment.end.y - segment.start.y

        if (Math.abs(dy) <= 1e-9) {
          return 'u'
        }

        return dx * dy > 0 ? 'positiveDiagonal' : 'negativeDiagonal'
      }),
    ),
  ].sort()
}

function formatIssue(issue: { path: string; message: string }): string {
  return `${issue.path} ${issue.message}`
}
