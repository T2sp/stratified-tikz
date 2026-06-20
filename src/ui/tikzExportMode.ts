import type { GenerateTikzOptions } from '../tikz/generateTikz.ts'
import { generateTikz } from '../tikz/generateTikz.ts'
import type { SerializeDiagramOptions } from '../model/serialization.ts'
import type {
  Camera3D,
  Diagram,
  TikzExportMode,
  VisibilityOptions,
} from '../model/types.ts'
import { tikzExportModes } from '../model/types.ts'
import {
  defaultVisibilityOptions,
  cloneVisibilityOptions,
} from '../model/visibility.ts'

export const defaultTikzExportMode: TikzExportMode = 'standalone'

export const tikzExportModeOptions: Array<{
  mode: TikzExportMode
  label: string
}> = [
  { mode: 'standalone', label: 'Standalone' },
  { mode: 'inlineMath', label: 'Inline math' },
]

export const inlineMathTikzExportHelp =
  'Inline math puts setup inside tikzpicture, adds baseline centering, and removes blank lines for align.'

export type TikzExportUiOptions = {
  exportMode: TikzExportMode
  includeCoordinateAxesInTikz: boolean
  camera3d?: Camera3D
  visibility?: VisibilityOptions
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

export function tikzDownloadFilenameForMode(mode: TikzExportMode): string {
  return mode === 'inlineMath'
    ? 'diagram-inline-math.tex'
    : 'diagram-standalone.tex'
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
    visibility:
      options.visibility ?? diagram.view?.visibility ?? defaultVisibilityOptions,
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
    visibility:
      options.visibility === undefined
        ? undefined
        : cloneVisibilityOptions(options.visibility),
  }
}

function isTikzExportMode(value: string): value is TikzExportMode {
  return tikzExportModes.includes(value as TikzExportMode)
}
