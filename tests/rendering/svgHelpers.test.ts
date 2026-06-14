import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cubicBezierToSvgPath,
  polylineToSvgPath,
  regularPolygonPoints,
  starPolygonPoints,
} from '../../src/rendering/svgPath.ts'
import { lineStyleToStrokeDasharray } from '../../src/rendering/svgStyle.ts'

test('polylineToSvgPath emits a readable move and line path', () => {
  assert.equal(
    polylineToSvgPath([
      { x: 0, y: 1 },
      { x: 2.25, y: 3.5 },
      { x: -1, y: 0 },
    ]),
    'M 0,1 L 2.25,3.5 L -1,0',
  )
})

test('cubicBezierToSvgPath emits a cubic SVG path for four points', () => {
  assert.equal(
    cubicBezierToSvgPath([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 0 },
    ]),
    'M 0,0 C 1,2 3,2 4,0',
  )
})

test('line styles map to SVG dash arrays', () => {
  assert.equal(lineStyleToStrokeDasharray('solid'), undefined)
  assert.equal(lineStyleToStrokeDasharray('dashed'), '8 5')
  assert.equal(lineStyleToStrokeDasharray('dotted'), '1 5')
  assert.equal(lineStyleToStrokeDasharray('denselyDotted'), '1 2')
})

test('regularPolygonPoints creates one vertex per requested side', () => {
  const square = regularPolygonPoints({ x: 10, y: 20 }, 5, 4, Math.PI / 4)
  const triangle = regularPolygonPoints({ x: 0, y: 0 }, 2, 3, -Math.PI / 2)

  assert.equal(square.length, 4)
  assert.equal(triangle.length, 3)
})

test('starPolygonPoints creates a simple five-point star polygon', () => {
  const star = starPolygonPoints({ x: 0, y: 0 }, 10, 4)

  assert.equal(star.length, 10)
  assert.ok(Math.abs(star[0].x) < 1e-12)
  assert.equal(star[0].y, -10)
})
