import { defaultLayerName } from '../model/layers.ts'

export function committedLayerNameDraft(
  layerValue: number,
  draftName: string,
): string {
  return draftName.trim().length === 0
    ? defaultLayerName(layerValue)
    : draftName
}
