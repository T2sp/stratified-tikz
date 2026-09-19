import assert from 'node:assert/strict'
import test from 'node:test'
import type { PointShape } from '../../src/model/types.ts'
import {
  svgPointNodeGeometry,
  svgPointNodeTexPointScale,
} from '../../src/rendering/svgPointNodeGeometry.ts'

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

test('circle encloses the padded text rectangle, including its corners', () => {
  const geometry = svgPointNodeGeometry(
    { shape: 'circle', size: 4 },
    { width: 20, height: 12 },
    1,
  )

  assert.equal(geometry.kind, 'circle')
  assertClose(geometry.radius, Math.hypot(12, 8))
  assert.equal(geometry.innerSep, 2)
  assert.deepEqual(geometry.contentBounds, { minX: -10, maxX: 10, minY: -6, maxY: 6 })
  assertClose(geometry.bounds.maxX, geometry.radius)
  assertClose(geometry.bounds.minY, -geometry.radius)
})

test('an empty point uses its TikZ inner sep instead of a fixed marker radius', () => {
  const geometry = svgPointNodeGeometry(
    { shape: 'circle', size: 3 },
    { width: 0, height: 0 },
  )

  assertClose(geometry.innerSep, 1.5 * svgPointNodeTexPointScale)
  assertClose(geometry.radius, 1.5 * Math.SQRT2 * svgPointNodeTexPointScale)
})

test('regular polygon square remains square for wide text, as in exported TikZ', () => {
  const geometry = svgPointNodeGeometry(
    { shape: 'square', size: 4 },
    { width: 40, height: 8 },
    1,
  )
  const halfSide = Math.SQRT2 * 22

  assert.equal(geometry.kind, 'polygon')
  assert.equal(geometry.vertices.length, 4)
  assertClose(geometry.bounds.minX, -halfSide)
  assertClose(geometry.bounds.maxX, halfSide)
  assertClose(geometry.bounds.minY, -halfSide)
  assertClose(geometry.bounds.maxY, halfSide)
  assertClose(geometry.radius, 44)
})

test('triangle has the PGF upward vertex and an asymmetric vertical bounding box', () => {
  const geometry = svgPointNodeGeometry(
    { shape: 'triangle', size: 2 },
    { width: 16, height: 6 },
    1,
  )

  assert.equal(geometry.vertices.length, 3)
  assertClose(geometry.radius, 18 * Math.SQRT2)
  assertClose(geometry.vertices[0].x, 0)
  assertClose(geometry.vertices[0].y, -geometry.radius)
  assertClose(geometry.bounds.maxY, geometry.radius / 2)
  assertClose(geometry.bounds.minX, -geometry.radius * Math.sqrt(3) / 2)
})

test('star uses PGF default outer-to-inner radius ratio of 1.5', () => {
  const geometry = svgPointNodeGeometry(
    { shape: 'star', size: 2 },
    { width: 16, height: 6 },
    1,
  )

  assert.equal(geometry.vertices.length, 10)
  assertClose(geometry.radius, 13.5 * Math.SQRT2)
  geometry.vertices.forEach((vertex, index) => {
    assertClose(
      Math.hypot(vertex.x, vertex.y),
      index % 2 === 0 ? geometry.radius : geometry.radius / 1.5,
    )
  })
  assertClose(geometry.vertices[0].y, -geometry.radius)
})

for (const shape of ['circle', 'square', 'triangle', 'star'] satisfies PointShape[]) {
  test(`${shape} grows with either text width or height`, () => {
    const style = { shape, size: 3 }
    const empty = svgPointNodeGeometry(style, { width: 0, height: 0 })
    const wide = svgPointNodeGeometry(style, { width: 60, height: 12 })
    const tall = svgPointNodeGeometry(style, { width: 12, height: 60 })

    assert.ok(wide.radius > empty.radius)
    assertClose(wide.radius, tall.radius)
    for (const vertex of wide.vertices) {
      assert.ok(vertex.x >= wide.bounds.minX && vertex.x <= wide.bounds.maxX)
      assert.ok(vertex.y >= wide.bounds.minY && vertex.y <= wide.bounds.maxY)
      assert.ok(Math.hypot(vertex.x, vertex.y) <= wide.radius + 1e-9)
    }
  })

  test(`${shape} preserves the PGF 1pt minimum size`, () => {
    const geometry = svgPointNodeGeometry(
      { shape, size: 0 },
      { width: 0, height: 0 },
      1,
    )
    assertClose(geometry.radius, 0.5)
  })
}

test('TeX point conversion applies consistently to padding and shape dimensions', () => {
  const original = svgPointNodeGeometry(
    { shape: 'star', size: 3 },
    { width: 20, height: 10 },
    1,
  )
  const doubled = svgPointNodeGeometry(
    { shape: 'star', size: 3 },
    { width: 40, height: 20 },
    2,
  )

  assertClose(doubled.radius, original.radius * 2)
  assertClose(doubled.innerSep, original.innerSep * 2)
  assertClose(doubled.bounds.minX, original.bounds.minX * 2)
})

test('geometry agrees with measured PGF anchors for a known TeX content box', () => {
  // Measured using pdfTeX / PGF from TeX Live 2026. Each node contains
  // \vrule width20pt height8pt depth2pt, with inner sep=1.5pt, outer sep=0pt.
  // Anchor y values are inverted here for SVG. PGF uses approximate fixed-point
  // trigonometry, so allow 0.02pt when comparing against native JS arithmetic.
  const circle = svgPointNodeGeometry({ shape: 'circle', size: 3 }, { width: 20, height: 10 }, 1)
  const square = svgPointNodeGeometry({ shape: 'square', size: 3 }, { width: 20, height: 10 }, 1)
  const triangle = svgPointNodeGeometry({ shape: 'triangle', size: 3 }, { width: 20, height: 10 }, 1)
  const star = svgPointNodeGeometry({ shape: 'star', size: 3 }, { width: 20, height: 10 }, 1)

  assertClose(circle.radius, 13.20166, 0.02)
  assertClose(square.vertices[0].x, 16.26437, 0.02)
  assertClose(square.vertices[0].y, -16.26437, 0.02)
  assertClose(square.vertices[1].x, -16.26437, 0.02)
  assertClose(triangle.vertices[0].y, -32.52695, 0.02)
  assertClose(triangle.vertices[1].x, -28.16924, 0.02)
  assertClose(triangle.vertices[1].y, 16.26347, 0.02)
  assertClose(star.vertices[0].y, -24.3952, 0.02)
  assertClose(star.vertices[1].x, -9.5594, 0.02)
  assertClose(star.vertices[1].y, -13.15749, 0.02)
})

test('invalid measurements never create NaN shape coordinates', () => {
  const geometry = svgPointNodeGeometry(
    { shape: 'triangle', size: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: -10 },
    Number.NaN,
  )

  assertClose(geometry.radius, 0.5 * svgPointNodeTexPointScale)
  assert.ok(geometry.vertices.every((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y)))
})
