import type { GenerateTikzOptions } from '../tikz/generateTikz.ts'
import { generateTikz } from '../tikz/generateTikz.ts'
import type { SerializeDiagramOptions } from '../model/serialization.ts'
import type {
  Camera3D,
  Diagram,
  TikzExportMode,
} from '../model/types.ts'
import { tikzExportModes } from '../model/types.ts'

export const defaultTikzExportMode: TikzExportMode = 'standalone'

export const tikzExportModeOptions: Array<{
  mode: TikzExportMode
  label: string
}> = [
  { mode: 'standalone', label: 'Standalone TikZ' },
  { mode: 'inlineMath', label: 'Inline math TikZ' },
]

export type TikzExportUiOptions = {
  exportMode: TikzExportMode
  includeCoordinateAxesInTikz: boolean
  camera3d?: Camera3D
}

export function tikzExportModeFromSelectValue(value: string): TikzExportMode {
  return isTikzExportMode(value) ? value : defaultTikzExportMode
}

export function tikzExportModeLabel(mode: TikzExportMode): string {
  return (
    tikzExportModeOptions.find((option) => option.mode === mode)?.label ??
    tikzExportModeOptions[0].label
  )
}

export function createTikzGenerateOptionsForUi(
  diagram: Diagram,
  options: TikzExportUiOptions,
): GenerateTikzOptions {
  return {
    exportMode: options.exportMode,
    includeCoordinateAxes:
      diagram.ambientDimension === 3
        ? options.includeCoordinateAxesInTikz
        : undefined,
    camera3d: diagram.ambientDimension === 3 ? options.camera3d : undefined,
  }
}

export function generateTikzForUi(
  diagram: Diagram,
  options: TikzExportUiOptions,
): string {
  return generateTikz(diagram, createTikzGenerateOptionsForUi(diagram, options))
}

export function createSerializeDiagramOptionsForUi(
  diagram: Diagram,
  options: TikzExportUiOptions,
): SerializeDiagramOptions {
  return {
    exportMode: options.exportMode,
    camera3d: diagram.ambientDimension === 3 ? options.camera3d : undefined,
    showCoordinateAxesInTikz:
      diagram.ambientDimension === 3
        ? options.includeCoordinateAxesInTikz
        : undefined,
  }
}

function isTikzExportMode(value: string): value is TikzExportMode {
  return tikzExportModes.includes(value as TikzExportMode)
}
