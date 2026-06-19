import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cloneStylePreset,
  curveStylePresets,
  pointStylePresets,
  regionStylePresets,
  sheetStylePresets,
} from '../../src/model/styles.ts'
import {
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
  deleteUserStylePreset,
  renameUserStylePreset,
  updateUserStylePresetStyle,
} from '../../src/model/stylePresets.ts'
import { createEmptyDiagram } from '../../src/model/constructors.ts'
import type {
  CurveStyle,
  Diagram,
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

test('creates a user curve preset from the current structured style', () => {
  const diagram = createDiagramWithCurve()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const result = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Black curve',
    curve.style,
  )

  assert.notEqual(result, null)
  assert.equal(result?.preset.kind, 'curve')
  assert.equal(result?.preset.name, 'Black curve')
  assert.equal(result?.preset.tikzStyleName, 'stratifiedStyleBlackCurve')
  assert.deepEqual(result?.preset.style, curve.style)
  assert.equal(result?.diagram.userStylePresets?.length, 1)
})

test('creates a user sheet preset from the current structured style', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const style: SheetStyle = {
    kind: 'sheetStyle',
    fillColor: '#99CCFF',
    fillOpacity: 0.25,
    strokeColor: '#336699',
    strokeOpacity: 0.85,
  }
  const result = createUserStylePresetFromStyle(
    diagram,
    'sheet',
    'Blue sheet',
    style,
  )

  assert.notEqual(result, null)
  assert.equal(result?.preset.kind, 'sheet')
  assert.deepEqual(result?.preset.style, style)
})

test('renames a user preset and regenerates a collision-safe TikZ style name', () => {
  const first = createUserStylePresetFromStyle(
    createDiagramWithCurve(),
    'curve',
    'Visible wire',
    curveStyle(),
  )

  assert.notEqual(first, null)

  const second = createUserStylePresetFromStyle(
    first?.diagram ?? createDiagramWithCurve(),
    'curve',
    'Hidden wire',
    curveStyle({ lineStyle: 'dotted' }),
  )

  assert.notEqual(second, null)

  const renamed = renameUserStylePreset(
    second?.diagram ?? createDiagramWithCurve(),
    second?.preset.id ?? '',
    'Visible wire',
  )
  const presets = renamed.userStylePresets ?? []

  assert.equal(presets[1]?.name, 'Visible wire')
  assert.equal(presets[0]?.tikzStyleName, 'stratifiedStyleVisibleWire')
  assert.equal(presets[1]?.tikzStyleName, 'stratifiedStyleVisibleWire2')
})

test('blank user preset names default to the preset kind', () => {
  const result = createUserStylePresetFromStyle(
    createDiagramWithCurve(),
    'curve',
    '   ',
    curveStyle(),
  )

  assert.notEqual(result, null)
  assert.equal(result?.preset.name, 'Curve preset')
  assert.equal(result?.preset.tikzStyleName, 'stratifiedStyleCurvePreset')
})

test('deletes a user preset and leaves materialized element style intact', () => {
  const diagram = createDiagramWithCurve()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Reusable curve',
    curve.style,
  )
  const applied = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const deleted = deleteUserStylePreset(applied, created?.preset.id ?? '')
  const deletedCurve = deleted.strata[0]

  assert.equal(deleted.userStylePresets, undefined)
  assert.equal(deletedCurve.stylePresetId, undefined)
  assert.deepEqual(deletedCurve.style, curve.style)
})

test('applies a compatible user preset to a selected element', () => {
  const diagram = createDiagramWithCurve()
  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Red dotted',
    curveStyle({
      strokeColor: '#CC0033',
      strokeOpacity: 0.5,
      lineStyle: 'dotted',
    }),
  )
  const applied = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    'wire',
    created?.preset.id ?? '',
  )
  const curve = applied.strata[0]

  assert.equal(curve.stylePresetId, created?.preset.id)
  assert.deepEqual(curve.style, created?.preset.style)
})

test('incompatible user presets are not applied to elements', () => {
  const diagram = createDiagramWithCurve()
  const created = createUserStylePresetFromStyle(
    diagram,
    'sheet',
    'Sheet preset',
    {
      kind: 'sheetStyle',
      fillColor: '#4D9DE0',
      fillOpacity: 0.35,
      strokeColor: '#4D9DE0',
      strokeOpacity: 1,
    },
  )
  const applied = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    'wire',
    created?.preset.id ?? '',
  )
  const curve = applied.strata[0]

  assert.equal(curve.stylePresetId, undefined)
  assert.deepEqual(curve.style, diagram.strata[0]?.style)
})

test('editing a user preset syncs elements that reference it', () => {
  const diagram = createDiagramWithCurve()
  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Editable curve',
    curveStyle(),
  )
  const applied = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    'wire',
    created?.preset.id ?? '',
  )
  const updatedStyle = curveStyle({ strokeColor: '#AA00AA', lineWidth: 2 })
  const updated = updateUserStylePresetStyle(
    applied,
    created?.preset.id ?? '',
    updatedStyle,
  )
  const curve = updated.strata[0]

  assert.deepEqual(updated.userStylePresets?.[0]?.style, updatedStyle)
  assert.deepEqual(curve.style, updatedStyle)
})

test('user preset IDs and TikZ style names are collision-safe', () => {
  const first = createUserStylePresetFromStyle(
    createDiagramWithCurve(),
    'curve',
    'Repeated name',
    curveStyle(),
  )
  const second = createUserStylePresetFromStyle(
    first?.diagram ?? createDiagramWithCurve(),
    'curve',
    'Repeated name',
    curveStyle({ lineStyle: 'dashed' }),
  )

  assert.notEqual(first, null)
  assert.notEqual(second, null)
  assert.equal(first?.preset.id, 'user-curve-repeated-name')
  assert.equal(second?.preset.id, 'user-curve-repeated-name-2')
  assert.equal(first?.preset.tikzStyleName, 'stratifiedStyleRepeatedName')
  assert.equal(second?.preset.tikzStyleName, 'stratifiedStyleRepeatedName2')
})

test('built-in presets remain available beside user presets', () => {
  const result = createUserStylePresetFromStyle(
    createDiagramWithCurve(),
    'curve',
    'User curve',
    curveStyle(),
  )

  assert.notEqual(result, null)
  assert.deepEqual(
    curveStylePresets.map((preset) => preset.id),
    ['blackSolidCurve', 'blackDenselyDottedCurve'],
  )
  assert.equal(result?.diagram.userStylePresets?.[0]?.id, 'user-curve-user-curve')
})

function createDiagramWithCurve(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'wire',
    name: 'Wire',
    style: curveStyle({ strokeColor: '#123456' }),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })

  return diagram
}

function curveStyle(overrides: Partial<CurveStyle> = {}): CurveStyle {
  return {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
    ...overrides,
  }
}
