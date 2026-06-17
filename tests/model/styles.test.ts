import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cloneStylePreset,
  curveStylePresets,
  pointStylePresets,
  regionStylePresets,
  sheetStylePresets,
} from '../../src/model/styles.ts'
import type {
  CurveStyle,
  PointStyle,
  RegionStyle,
  SheetStyle,
} from '../../src/model/types.ts'

test('style presets expose stable lightweight ids', () => {
  assert.deepEqual(
    sheetStylePresets.map((preset) => preset.id),
    ['blueTranslucentSheet', 'redTranslucentSheet'],
  )
  assert.deepEqual(
    regionStylePresets.map((preset) => preset.id),
    ['blueTranslucentRegion', 'redTranslucentRegion'],
  )
  assert.deepEqual(
    curveStylePresets.map((preset) => preset.id),
    ['blackSolidCurve', 'blackDenselyDottedCurve'],
  )
  assert.deepEqual(
    pointStylePresets.map((preset) => preset.id),
    [
      'blackFilledCirclePoint',
      'blackHollowCirclePoint',
      'blackFilledSquarePoint',
      'blackHollowSquarePoint',
    ],
  )
})

test('sheet and region presets copy explicit translucent style values', () => {
  const blueSheet: SheetStyle = cloneStylePreset(sheetStylePresets[0])
  const redRegion: RegionStyle = cloneStylePreset(regionStylePresets[1])

  assert.deepEqual(blueSheet, {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
  })
  assert.deepEqual(redRegion, {
    kind: 'regionStyle',
    fillColor: '#E76F51',
    fillOpacity: 0.28,
    strokeColor: '#C44536',
    strokeOpacity: 0.9,
  })
})

test('curve and point presets cover common black drawing styles', () => {
  const solidCurve: CurveStyle = cloneStylePreset(curveStylePresets[0])
  const dottedCurve: CurveStyle = cloneStylePreset(curveStylePresets[1])
  const filledPoint: PointStyle = cloneStylePreset(pointStylePresets[0])
  const hollowSquare: PointStyle = cloneStylePreset(pointStylePresets[3])

  assert.equal(solidCurve.lineStyle, 'solid')
  assert.equal(dottedCurve.lineStyle, 'denselyDotted')
  assert.equal(solidCurve.strokeColor, '#000000')
  assert.equal(dottedCurve.strokeColor, '#000000')
  assert.deepEqual(filledPoint, {
    kind: 'pointStyle',
    color: '#000000',
    opacity: 1,
    shape: 'circle',
    fill: 'filled',
    size: 3,
  })
  assert.deepEqual(hollowSquare, {
    kind: 'pointStyle',
    color: '#000000',
    opacity: 1,
    shape: 'square',
    fill: 'hollow',
    size: 3.5,
  })
})

test('cloned preset styles do not mutate preset definitions', () => {
  const sheetStyle: SheetStyle = cloneStylePreset(sheetStylePresets[0])
  const curveStyle: CurveStyle = cloneStylePreset(curveStylePresets[0])

  sheetStyle.fillColor = '#000000'
  curveStyle.lineWidth = 2.4

  assert.equal(sheetStylePresets[0].style.fillColor, '#4D9DE0')
  assert.equal(curveStylePresets[0].style.lineWidth, 1.2)
})
