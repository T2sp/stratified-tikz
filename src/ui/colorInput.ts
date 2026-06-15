import type { HexColor } from '../model/types.ts'

export const colorInputFallback: HexColor = '#000000'

export function isHexColorString(value: string | undefined): value is HexColor {
  return value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function normalizeColorInputValue(
  value: string | undefined,
  fallback: HexColor = colorInputFallback,
): HexColor {
  return isHexColorString(value) ? value : fallback
}
