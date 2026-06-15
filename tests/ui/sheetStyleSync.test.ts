import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultSheetStyle } from '../../src/model/styles.ts'
import type { HexColor, SheetStyle } from '../../src/model/types.ts'
import {
  updateSheetFillColor,
  updateSheetStrokeColor,
} from '../../src/ui/sheetStyleSync.ts'

const sheetStyle: SheetStyle = {
  ...defaultSheetStyle,
  fillColor: '#4D9DE0',
  strokeColor: '#223344',
}

test('linked sheet fill color updates stroke color too', () => {
  const updated = updateSheetFillColor(sheetStyle, '#AA3344', true)

  assert.equal(updated.fillColor, '#AA3344')
  assert.equal(updated.strokeColor, '#AA3344')
})

test('unlinked sheet fill color preserves stroke color', () => {
  const updated = updateSheetFillColor(sheetStyle, '#AA3344', false)

  assert.equal(updated.fillColor, '#AA3344')
  assert.equal(updated.strokeColor, '#223344')
})

test('sheet stroke color can still be edited independently', () => {
  const strokeColor: HexColor = '#112233'
  const updated = updateSheetStrokeColor(sheetStyle, strokeColor)

  assert.equal(updated.fillColor, '#4D9DE0')
  assert.equal(updated.strokeColor, strokeColor)
})
