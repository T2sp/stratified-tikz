import type { HexColor, SheetStyle } from '../model/types.ts'

export function updateSheetFillColor(
  style: SheetStyle,
  fillColor: HexColor,
  linkStrokeToFill: boolean,
): SheetStyle {
  return {
    ...style,
    fillColor,
    strokeColor: linkStrokeToFill ? fillColor : style.strokeColor,
  }
}

export function updateSheetStrokeColor(
  style: SheetStyle,
  strokeColor: HexColor,
): SheetStyle {
  return {
    ...style,
    strokeColor,
  }
}
