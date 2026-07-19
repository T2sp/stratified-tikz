import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import {
  createEmptyDiagram,
  createGridStratum,
} from '../../src/model/constructors.ts'
import {
  createNumericScalarInputValue,
  gridGeometryEpsilon,
  gridLatticePattern,
  gridPreviewSegments,
  triangularLatticeBasis,
  triangularLatticeLinePhases,
  triangularLatticeMetrics,
  triangularLatticeVertex,
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
  Vec3,
  WorkPlaneFrameSnapshot,
} from '../../src/model/types.ts'

const triangularSpacingCases = [0.25, 0.5, 1, 1.3, 2] as const
const triangularRegressionSpacings = [
  { spacing: 1, fixture: 'unit-spacing baseline' },
  { spacing: 0.5, fixture: 'sub-unit shifted regression' },
  { spacing: 1.3, fixture: 'non-integral shifted regression' },
] as const

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

test('triangular lattice rejects zero, negative, and non-finite spacing', () => {
  for (const spacing of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const validation = validateDiagram(
      diagramWithGrid(
        valid2DGrid({
          latticePattern: 'triangular',
          uRange: range(-2, 2, spacing),
        }),
      ),
    )

    assert.equal(validation.valid, false, `Expected ${spacing} to be rejected.`)
  }

  for (const spacing of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => triangularLatticeMetrics(spacing),
      /positive and finite/,
    )
  }
})

test('canonical triangular basis is equilateral at every supported regression spacing', () => {
  const origin = { u: 2.75, v: -1.4 }

  for (const spacing of triangularSpacingCases) {
    const metrics = triangularLatticeMetrics(spacing)
    const basis = triangularLatticeBasis(spacing)
    const vertex00 = triangularLatticeVertex(origin, 0, 0, spacing)
    const vertex10 = triangularLatticeVertex(origin, 1, 0, spacing)
    const vertex01 = triangularLatticeVertex(origin, 0, 1, spacing)

    assert.deepEqual(vertex00, origin)
    assertApproximatelyEqual(localDistance(vertex00, vertex10), spacing)
    assertApproximatelyEqual(localDistance(vertex00, vertex01), spacing)
    assertApproximatelyEqual(localDistance(vertex10, vertex01), spacing)
    assertApproximatelyEqual(basis.a.u, spacing)
    assertApproximatelyEqual(basis.a.v, 0)
    assertApproximatelyEqual(basis.b.u, spacing / 2)
    assertApproximatelyEqual(basis.b.v, (Math.sqrt(3) * spacing) / 2)
    assertApproximatelyEqual(metrics.halfRowOffset, spacing / 2)
    assertApproximatelyEqual(
      metrics.rowSeparation,
      (Math.sqrt(3) * spacing) / 2,
    )
  }
})

test('all triangular line families pass through the same normalized lattice vertices', () => {
  const origin = { u: 1.7, v: -0.65 }

  for (const spacing of triangularSpacingCases) {
    const metrics = triangularLatticeMetrics(spacing)
    const phases = triangularLatticeLinePhases(origin, spacing)

    for (let i = -2; i <= 2; i += 1) {
      for (let j = -2; j <= 2; j += 1) {
        const vertex = triangularLatticeVertex(origin, i, j, spacing)

        assertApproximatelyEqual(
          vertex.v,
          phases.horizontal + j * metrics.rowSeparation,
        )
        assertApproximatelyEqual(
          vertex.u - vertex.v / metrics.slope,
          phases.positiveDiagonal + i * spacing,
        )
        assertApproximatelyEqual(
          vertex.u + vertex.v / metrics.slope,
          phases.negativeDiagonal + (i + j) * spacing,
        )
      }
    }
  }
})

test('changing triangular spacing scales about the same non-zero local origin', () => {
  const origin = { u: -3.25, v: 2.4 }

  for (const spacing of triangularSpacingCases) {
    assert.deepEqual(triangularLatticeVertex(origin, 0, 0, spacing), origin)
    const vertex = triangularLatticeVertex(origin, 2, 3, spacing)

    assertApproximatelyEqual(
      (vertex.u - origin.u) / spacing,
      2 + 3 / 2,
    )
    assertApproximatelyEqual(
      (vertex.v - origin.v) / spacing,
      (3 * Math.sqrt(3)) / 2,
    )
  }
})

test('triangular Preview has common vertices for baseline and shifted regression fixtures', () => {
  const origin = { u: 1.2, v: -0.7 }

  for (const { spacing, fixture } of triangularRegressionSpacings) {
    const metrics = triangularLatticeMetrics(spacing)
    const preview = gridPreviewSegments(
      valid2DGrid({
        latticePattern: 'triangular',
        uRange: range(origin.u, origin.u + 4 * spacing, spacing),
        // Triangular geometry intentionally retains but does not use vRange.step.
        vRange: range(origin.v, origin.v + 3 * metrics.rowSeparation, 7),
        clip: clip(
          origin.u,
          origin.u + 4 * spacing,
          origin.v,
          origin.v + 3 * metrics.rowSeparation,
        ),
      }),
      2,
    )

    assert.equal(preview.ok, true, fixture)
    if (!preview.ok) {
      throw new Error(preview.errors.map(formatIssue).join('; '))
    }

    for (const [i, j] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
      const vertex = triangularLatticeVertex(origin, i, j, spacing)
      const families = preview.segments
        .filter((segment) => pointLiesOnSegment(vertex, segment))
        .map(segmentDirectionFamily)

      assert.deepEqual(
        [...new Set(families)].sort(),
        ['negativeDiagonal', 'positiveDiagonal', 'u'],
        `${fixture} vertex (${i}, ${j})`,
      )
    }
  }
})

test('triangular Preview preserves non-zero range phase and asymmetric clipping', () => {
  const spacing = 0.5
  const uMin = -1.7
  const vMin = 0.35
  const bounds = { uMin: -0.45, uMax: 2.85, vMin: 0.6, vMax: 3.1 }
  const preview = gridPreviewSegments(
    valid2DGrid({
      latticePattern: 'triangular',
      uRange: range(uMin, 4.4, spacing),
      vRange: range(vMin, 3.7, 13),
      clip: clip(bounds.uMin, bounds.uMax, bounds.vMin, bounds.vMax),
    }),
    2,
  )

  assert.equal(preview.ok, true)
  if (!preview.ok) {
    throw new Error(preview.errors.map(formatIssue).join('; '))
  }

  assert.ok(preview.segments.length > 0)
  for (const segment of preview.segments) {
    for (const point of [segment.start, segment.end]) {
      assert.ok(point.x >= bounds.uMin - gridGeometryEpsilon)
      assert.ok(point.x <= bounds.uMax + gridGeometryEpsilon)
      assert.ok(point.y >= bounds.vMin - gridGeometryEpsilon)
      assert.ok(point.y <= bounds.vMax + gridGeometryEpsilon)
    }
  }

  const phases = triangularLatticeLinePhases({ u: uMin, v: vMin }, spacing)
  const metrics = triangularLatticeMetrics(spacing)
  for (const segment of preview.segments) {
    const family = segmentDirectionFamily(segment)
    const lineValue =
      family === 'u'
        ? segment.start.y
        : family === 'positiveDiagonal'
          ? segment.start.x - segment.start.y / metrics.slope
          : segment.start.x + segment.start.y / metrics.slope
    const phase =
      family === 'u'
        ? phases.horizontal
        : family === 'positiveDiagonal'
          ? phases.positiveDiagonal
          : phases.negativeDiagonal
    const step = family === 'u' ? metrics.rowSeparation : spacing

    assertApproximatelyEqual(
      (lineValue - phase) / step,
      Math.round((lineValue - phase) / step),
    )
  }
})

test('triangular vRange.step remains validated legacy data but does not change geometry', () => {
  const shared = {
    latticePattern: 'triangular' as const,
    uRange: range(-1.2, 3.8, 1.3),
    clip: clip(-0.4, 2.9, -0.2, 2.7),
  }
  const first = gridPreviewSegments(
    valid2DGrid({ ...shared, vRange: range(-0.7, 3.1, 0.25) }),
    2,
  )
  const second = gridPreviewSegments(
    valid2DGrid({ ...shared, vRange: range(-0.7, 3.1, 99) }),
    2,
  )

  assert.deepEqual(second, first)
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

test('triangular Preview stays finite in 2D and projected 3D at every spacing', () => {
  const camera = createInitialCamera3D()

  for (const spacing of triangularSpacingCases) {
    const metrics = triangularLatticeMetrics(spacing)
    const ranges = {
      uRange: range(0.3, 0.3 + 4 * spacing, spacing),
      vRange: range(-0.8, -0.8 + 3 * metrics.rowSeparation, 5),
      clip: clip(
        0.45,
        0.3 + 3.75 * spacing,
        -0.65,
        -0.8 + 2.8 * metrics.rowSeparation,
      ),
    }
    const preview2D = gridPreviewSegments(
      valid2DGrid({ latticePattern: 'triangular', ...ranges }),
      2,
    )
    const preview3D = gridPreviewSegments(
      valid3DGrid('triangular', ranges),
      3,
    )

    assert.equal(preview2D.ok, true)
    assert.equal(preview3D.ok, true)
    if (!preview2D.ok || !preview3D.ok) {
      throw new Error('Expected finite triangular previews.')
    }
    assert.equal(preview2D.segments.every(segmentIsFinite), true)
    assert.equal(preview3D.segments.every(segmentIsFinite), true)

    const projected = preview3D.segments.flatMap((segment) => [
      projectToSvgPoint(camera, segment.start, 360),
      projectToSvgPoint(camera, segment.end, 360),
    ])
    assert.equal(
      projected.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
      true,
    )
  }
})

test('triangular line caps reject bounded generation before sampling', () => {
  const preview = gridPreviewSegments(
    valid2DGrid({
      latticePattern: 'triangular',
      uRange: range(-20, 20, 0.01),
      vRange: range(-20, 20, 1),
      clip: clip(-20, 20, -20, 20),
    }),
    2,
    20,
  )

  assert.equal(preview.ok, false)
  if (preview.ok) {
    throw new Error('Expected capped triangular Preview to fail.')
  }
  assert.match(preview.errors.map(formatIssue).join('\n'), /20 line cap/)
})

test('rectangular and honeycomb Preview regression fixtures are unchanged', () => {
  const rectangular = gridPreviewSegments(valid2DGrid(), 2)
  const honeycomb = gridPreviewSegments(
    valid2DGrid({ latticePattern: 'honeycomb' }),
    2,
  )

  assert.equal(rectangular.ok, true)
  assert.equal(honeycomb.ok, true)
  if (!rectangular.ok || !honeycomb.ok) {
    throw new Error('Expected unchanged lattice fixtures to preview.')
  }
  assert.equal(rectangular.lineCount, 10)
  assert.deepEqual(rectangular.segments.slice(0, 3), [
    {
      start: { x: -2, y: -2, z: 0 },
      end: { x: -2, y: 2, z: 0 },
    },
    {
      start: { x: -1, y: -2, z: 0 },
      end: { x: -1, y: 2, z: 0 },
    },
    {
      start: { x: 0, y: -2, z: 0 },
      end: { x: 0, y: 2, z: 0 },
    },
  ])
  assert.equal(honeycomb.lineCount, 22)
  assert.deepEqual(honeycomb.segments[0], {
    start: { x: -1, y: -2, z: 0 },
    end: { x: -1.5, y: -1.1339745962155614, z: 0 },
  })
})

test('grid frame origin rejects a missing coordinateRef as an unsupported location', () => {
  const grid = valid3DGridWithFrameReference('origin', 'missing')
  const validation = validateDiagram(diagramWithGrid(grid))

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors.map(formatIssue).join('\n'),
    /strata\[0\]\.frame\.frame\.origin\.symbolic\.source.*coordinateRef is not supported/,
  )
  assert.doesNotMatch(
    validation.errors.map(formatIssue).join('\n'),
    /must point to an existing coordinate anchor/,
  )
})

test('grid frame origin rejects an existing coordinateRef as an unsupported location', () => {
  const diagram = diagramWithGrid(valid3DGridWithFrameReference('origin'))
  diagram.coordinateAnchors = [coordinateAnchor('coord-a')]

  const validation = validateDiagram(diagram)

  assert.equal(validation.valid, false)
  assert.match(
    validation.errors.map(formatIssue).join('\n'),
    /strata\[0\]\.frame\.frame\.origin\.symbolic\.source.*coordinateRef is not supported/,
  )
})

test('grid frame basis fields reject coordinateRefs', () => {
  for (const field of ['u', 'v', 'normal'] as const) {
    const diagram = diagramWithGrid(valid3DGridWithFrameReference(field))
    diagram.coordinateAnchors = [coordinateAnchor('coord-a')]
    const validation = validateDiagram(diagram)

    assert.equal(validation.valid, false, `Expected ${field} to reject coordinateRef.`)
    assert.match(
      validation.errors.map(formatIssue).join('\n'),
      new RegExp(`frame\\.frame\\.${field}\\.symbolic\\.source.*coordinateRef is not supported`),
    )
  }
})

test('saved grid frame coordinateRef is rejected cleanly without throwing', () => {
  const diagram = diagramWithGrid(valid3DGridWithFrameReference('origin'))
  diagram.coordinateAnchors = [coordinateAnchor('coord-a')]
  const loaded = parseSavedDiagramJson(serializeDiagram(diagram))

  assert.equal(loaded.ok, false)
  if (loaded.ok) {
    throw new Error('Expected saved grid frame coordinateRef to fail.')
  }
  assert.match(
    loaded.error,
    /strata\[0\]\.frame\.frame\.origin\.symbolic\.source.*coordinateRef is not supported at strata\[0\]\.frame\.frame\.origin/,
  )
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

function valid3DGrid(
  latticePattern: LatticePattern = 'rectangular',
  overrides: Partial<Pick<GridStratum, 'uRange' | 'vRange' | 'clip'>> = {},
): GridStratum {
  return createGridStratum({
    ambientDimension: 3,
    id: 'grid-3d',
    name: '3D grid',
    latticePattern,
    frame: workPlaneGridFrame(xzFrameAtY(1)),
    uRange: overrides.uRange ?? range(-1, 1, 1),
    vRange: overrides.vRange ?? range(-1, 1, 1),
    clip: overrides.clip ?? clip(-1, 1, -1, 1),
    layer: 0,
  })
}

function valid3DGridWithFrameReference(
  field: keyof WorkPlaneFrameSnapshot,
  coordinateId = 'coord-a',
): GridStratum {
  const grid = valid3DGrid()

  return {
    ...grid,
    frame: {
      ...grid.frame,
      frame: {
        ...grid.frame.frame,
        [field]: rawCoordinateReferencePoint(coordinateId, grid.frame.frame[field]),
      },
    },
  }
}

function coordinateAnchor(
  id: string,
): NonNullable<Diagram['coordinateAnchors']>[number] {
  return {
    id,
    name: 'A',
    tikzName: 'A',
    position: {
      kind: 'global',
      value: {
        x: { kind: 'numeric', value: 0 },
        y: { kind: 'numeric', value: 1 },
        z: { kind: 'numeric', value: 0 },
      },
    },
  }
}

function rawCoordinateReferencePoint(
  coordinateId: string,
  preview: Vec3,
): Vec3 {
  return {
    ...preview,
    symbolic: {
      x: { kind: 'numeric', value: preview.x },
      y: { kind: 'numeric', value: preview.y },
      z: { kind: 'numeric', value: preview.z },
      source: {
        kind: 'coordinateRef',
        coordinateId,
        preview,
      },
    },
  }
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

function segmentDirectionFamily(segment: {
  start: { x: number; y: number }
  end: { x: number; y: number }
}): 'u' | 'positiveDiagonal' | 'negativeDiagonal' {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y

  if (Math.abs(dy) <= gridGeometryEpsilon) {
    return 'u'
  }

  return dx * dy > 0 ? 'positiveDiagonal' : 'negativeDiagonal'
}

function pointLiesOnSegment(
  point: { u: number; v: number },
  segment: {
    start: { x: number; y: number }
    end: { x: number; y: number }
  },
): boolean {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const cross =
    (point.u - segment.start.x) * dy - (point.v - segment.start.y) * dx

  return (
    Math.abs(cross) <= gridGeometryEpsilon * Math.max(1, Math.hypot(dx, dy)) &&
    point.u >= Math.min(segment.start.x, segment.end.x) - gridGeometryEpsilon &&
    point.u <= Math.max(segment.start.x, segment.end.x) + gridGeometryEpsilon &&
    point.v >= Math.min(segment.start.y, segment.end.y) - gridGeometryEpsilon &&
    point.v <= Math.max(segment.start.y, segment.end.y) + gridGeometryEpsilon
  )
}

function localDistance(
  first: { u: number; v: number },
  second: { u: number; v: number },
): number {
  return Math.hypot(second.u - first.u, second.v - first.v)
}

function assertApproximatelyEqual(
  actual: number,
  expected: number,
  epsilon = gridGeometryEpsilon,
): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}.`,
  )
}

function formatIssue(issue: { path: string; message: string }): string {
  return `${issue.path} ${issue.message}`
}
