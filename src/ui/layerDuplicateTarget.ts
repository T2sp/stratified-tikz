import { normalizeLayerValue } from '../model/layers.ts'

export type DuplicateLayerTargetResolution =
  | { ok: true; targetLayerValue: number }
  | { ok: false; message: string }

export function duplicateLayerTargetInput(defaultTarget: number | null): string {
  return defaultTarget === null ? '' : String(defaultTarget)
}

export function parseLayerTargetInput(value: string): number | null {
  if (value.trim().length === 0) {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? normalizeLayerValue(number) : null
}

export function canSubmitLayerDuplicateTarget(
  sourceLayerValue: number,
  targetLayerInput: string,
  defaultTargetLayer: number | null,
): boolean {
  return resolveDuplicateLayerTarget(
    sourceLayerValue,
    targetLayerInput,
    defaultTargetLayer,
  ).ok
}

export function resolveDuplicateLayerTarget(
  sourceLayerValue: number,
  targetLayerInput: string,
  defaultTargetLayer: number | null,
): DuplicateLayerTargetResolution {
  if (targetLayerInput.trim().length === 0) {
    return defaultTargetLayer === null
      ? { ok: false, message: 'Choose target layer manually.' }
      : { ok: true, targetLayerValue: defaultTargetLayer }
  }

  const targetLayer = parseLayerTargetInput(targetLayerInput)

  if (targetLayer === null) {
    return { ok: false, message: 'Enter a finite target layer.' }
  }

  if (targetLayer === normalizeLayerValue(sourceLayerValue)) {
    return {
      ok: false,
      message: 'Duplicate target must differ from the source layer.',
    }
  }

  return { ok: true, targetLayerValue: targetLayer }
}
