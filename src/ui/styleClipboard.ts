import { clonePathArrowOptions } from '../model/pathArrows.ts'
import { stylePresetStylesEqual } from '../model/stylePresets.ts'
import {
  cloneCurveStyle,
  cloneLabelStyle,
  clonePointStyle,
  cloneRegionStyle,
  cloneSheetStyle,
} from '../model/styles.ts'
import type {
  CurveStratum,
  Diagram,
  ImportedTikzStyleReference,
  LabelStyle,
  PathArrowOptions,
  PointStyle,
  RegionStyle,
  SheetStyle,
  Stratum,
  TextLabel,
  TikzStyleTarget,
} from '../model/types.ts'
import {
  findSelectedElement,
  selectedElements,
  type SelectableGeometricKind,
  type SelectedDiagramElement,
  type SelectedElement,
  type SingleSelectedElement,
} from './selection.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export type StyleClipboardGeometricKind = Exclude<
  SelectableGeometricKind,
  'coordinate'
>

type StyleReferenceClipboard = {
  stylePresetId?: string
  importedTikzStyleReferenceId?: string
}

export type RegionStyleClipboard = StyleReferenceClipboard & {
  geometricKind: 'region'
  style: RegionStyle
}

export type SheetStyleClipboard = StyleReferenceClipboard & {
  geometricKind: 'sheet'
  style: SheetStyle
}

export type CurveStyleClipboard = StyleReferenceClipboard & {
  geometricKind: 'curve'
  style: CurveStratum['style']
  arrows?: PathArrowOptions
}

export type PointStyleClipboard = StyleReferenceClipboard & {
  geometricKind: 'point'
  style: PointStyle
}

export type LabelStyleClipboard = StyleReferenceClipboard & {
  geometricKind: 'label'
  style: LabelStyle
}

export type StyleClipboard =
  | RegionStyleClipboard
  | SheetStyleClipboard
  | CurveStyleClipboard
  | PointStyleClipboard
  | LabelStyleClipboard

export type CopyStyleResult =
  | {
      ok: true
      clipboard: StyleClipboard
      message: string
    }
  | {
      ok: false
      message: string
    }

export type PasteStyleResult =
  | {
      ok: true
      diagram: Diagram
      pastedCount: number
      message: string
    }
  | {
      ok: false
      diagram: Diagram
      message: string
    }

export type StyleEyedropperApplyResult =
  | {
      ok: true
      diagram: Diagram
      clipboard: StyleClipboard
      appliedCount: number
      message: string
    }
  | {
      ok: false
      diagram: Diagram
      message: string
      clipboard?: StyleClipboard
    }

export type StyleClipboardEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

type StyleTarget = Extract<
  SelectedDiagramElement,
  { kind: 'stratum' | 'label' }
>

export function copyStyleFromSelection(
  diagram: Diagram,
  selection: SelectedElement,
): CopyStyleResult {
  const sourceSelections = selectedElements(selection)

  if (sourceSelections.length !== 1) {
    return {
      ok: false,
      message:
        sourceSelections.length === 0
          ? 'Select one styled object to copy style.'
          : 'Select exactly one object to copy style.',
    }
  }

  const selected = findSelectedElement(diagram, sourceSelections[0] ?? null)

  if (selected === null) {
    return {
      ok: false,
      message: 'Select one styled object to copy style.',
    }
  }

  if (selected.kind === 'coordinate') {
    return {
      ok: false,
      message: 'Coordinate anchors do not have styles.',
    }
  }

  const clipboard =
    selected.kind === 'label'
      ? copyLabelStyle(selected.element)
      : copyStratumStyle(selected.element)

  return {
    ok: true,
    clipboard,
    message: `Copied ${clipboard.geometricKind} style.`,
  }
}

export function pasteStyleClipboardToSelection(
  diagram: Diagram,
  selection: SelectedElement,
  clipboard: StyleClipboard | null,
): PasteStyleResult {
  if (clipboard === null) {
    return {
      ok: false,
      diagram,
      message: 'Copy a style before pasting.',
    }
  }

  const targets = resolveStyleTargets(diagram, selection, clipboard)

  if (!targets.ok) {
    return {
      ok: false,
      diagram,
      message: targets.message,
    }
  }

  const targetKeys = new Set(
    targets.targets.map((target) =>
      selectedElementKey({ kind: target.kind, id: target.element.id }),
    ),
  )
  const strata = diagram.strata.map((stratum) =>
    targetKeys.has(selectedElementKey({ kind: 'stratum', id: stratum.id }))
      ? pasteStyleToStratum(diagram, stratum, clipboard)
      : stratum,
  )
  const labels = diagram.labels.map((label) =>
    targetKeys.has(selectedElementKey({ kind: 'label', id: label.id }))
      ? pasteStyleToLabel(diagram, label, clipboard)
      : label,
  )

  return {
    ok: true,
    diagram: {
      ...diagram,
      strata,
      labels,
    },
    pastedCount: targets.targets.length,
    message: `Pasted ${clipboard.geometricKind} style to ${styleObjectCountLabel(
      targets.targets.length,
    )}.`,
  }
}

export function applyStyleEyedropperSourceToSelection(
  diagram: Diagram,
  targetSelection: SelectedElement,
  sourceSelection: SelectedElement,
): StyleEyedropperApplyResult {
  if (sourceSelection === null) {
    return {
      ok: false,
      diagram,
      message: 'Style eyedropper canceled.',
    }
  }

  const copyResult = copyStyleFromSelection(diagram, sourceSelection)

  if (!copyResult.ok) {
    return {
      ok: false,
      diagram,
      message: copyResult.message,
    }
  }

  const pasteResult = pasteStyleClipboardToSelection(
    diagram,
    targetSelection,
    copyResult.clipboard,
  )

  if (!pasteResult.ok) {
    return {
      ok: false,
      diagram,
      clipboard: copyResult.clipboard,
      message: pasteResult.message,
    }
  }

  return {
    ok: true,
    diagram: pasteResult.diagram,
    clipboard: copyResult.clipboard,
    appliedCount: pasteResult.pastedCount,
    message: pasteResult.message,
  }
}

export function applyStyleClipboardToEditorState<
  T extends StyleClipboardEditorState,
>(current: T, clipboard: StyleClipboard | null): T {
  const result = pasteStyleClipboardToSelection(
    current.editableDiagram,
    current.selectedElement,
    clipboard,
  )

  if (!result.ok) {
    return {
      ...current,
      layerOperationStatus: result.message,
    }
  }

  return commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    layerOperationStatus: result.message,
  })
}

export function styleClipboardSummary(
  clipboard: StyleClipboard | null,
): string {
  return clipboard === null ? 'none' : `${clipboard.geometricKind} style`
}

function copyStratumStyle(stratum: Stratum): StyleClipboard {
  const references = copyStyleReferences(stratum)

  switch (stratum.geometricKind) {
    case 'region':
      return {
        geometricKind: 'region',
        style: cloneRegionStyle(stratum.style),
        ...references,
      }
    case 'sheet':
      return {
        geometricKind: 'sheet',
        style: cloneSheetStyle(stratum.style),
        ...references,
      }
    case 'curve':
      return {
        geometricKind: 'curve',
        style: cloneCurveStyle(stratum.style),
        ...(stratum.arrows === undefined
          ? {}
          : { arrows: clonePathArrowOptions(stratum.arrows) }),
        ...references,
      }
    case 'point':
      return {
        geometricKind: 'point',
        style: clonePointStyle(stratum.style),
        ...references,
      }
  }
}

function copyLabelStyle(label: TextLabel): StyleClipboard {
  return {
    geometricKind: 'label',
    style: cloneLabelStyle(label.style),
    ...copyStyleReferences(label),
  }
}

function resolveStyleTargets(
  diagram: Diagram,
  selection: SelectedElement,
  clipboard: StyleClipboard,
):
  | {
      ok: true
      targets: StyleTarget[]
    }
  | {
      ok: false
      message: string
    } {
  const targetSelections = selectedElements(selection)

  if (targetSelections.length === 0) {
    return {
      ok: false,
      message: 'Select target object(s) to paste style.',
    }
  }

  const seen = new Set<string>()
  const targets: StyleTarget[] = []

  for (const targetSelection of targetSelections) {
    const key = selectedElementKey(targetSelection)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    const selected = findSelectedElement(diagram, targetSelection)

    if (selected === null) {
      return {
        ok: false,
        message: 'Selected target is no longer available.',
      }
    }

    if (selected.kind === 'coordinate') {
      return {
        ok: false,
        message: 'Coordinate anchors do not have styles.',
      }
    }

    if (selected.element.geometricKind !== clipboard.geometricKind) {
      return {
        ok: false,
        message: `Copied ${clipboard.geometricKind} style can only be pasted to ${clipboard.geometricKind} objects.`,
      }
    }

    targets.push(selected)
  }

  return {
    ok: true,
    targets,
  }
}

function pasteStyleToStratum(
  diagram: Diagram,
  stratum: Stratum,
  clipboard: StyleClipboard,
): Stratum {
  switch (stratum.geometricKind) {
    case 'region':
      return clipboard.geometricKind === 'region'
        ? applyStyleReferences(
            diagram,
            {
              ...stratum,
              style: cloneRegionStyle(clipboard.style),
            },
            clipboard,
          )
        : stratum
    case 'sheet':
      return clipboard.geometricKind === 'sheet'
        ? applyStyleReferences(
            diagram,
            {
              ...stratum,
              style: cloneSheetStyle(clipboard.style),
            },
            clipboard,
          )
        : stratum
    case 'curve':
      return clipboard.geometricKind === 'curve'
        ? pasteStyleToCurve(diagram, stratum, clipboard)
        : stratum
    case 'point':
      return clipboard.geometricKind === 'point'
        ? applyStyleReferences(
            diagram,
            {
              ...stratum,
              style: clonePointStyle(clipboard.style),
            },
            clipboard,
          )
        : stratum
  }
}

function pasteStyleToCurve(
  diagram: Diagram,
  curve: CurveStratum,
  clipboard: CurveStyleClipboard,
): CurveStratum {
  const nextCurve = applyStyleReferences(
    diagram,
    {
      ...curve,
      style: cloneCurveStyle(clipboard.style),
    },
    clipboard,
  )

  if (clipboard.arrows === undefined) {
    delete nextCurve.arrows
  } else {
    nextCurve.arrows = clonePathArrowOptions(clipboard.arrows)
  }

  return nextCurve
}

function pasteStyleToLabel(
  diagram: Diagram,
  label: TextLabel,
  clipboard: StyleClipboard,
): TextLabel {
  return clipboard.geometricKind === 'label'
    ? applyStyleReferences(
        diagram,
        {
          ...label,
          style: cloneLabelStyle(clipboard.style),
        },
        clipboard,
      )
    : label
}

function copyStyleReferences(
  value: StyleReferenceClipboard,
): StyleReferenceClipboard {
  return {
    ...(value.stylePresetId === undefined
      ? {}
      : { stylePresetId: value.stylePresetId }),
    ...(value.importedTikzStyleReferenceId === undefined
      ? {}
      : { importedTikzStyleReferenceId: value.importedTikzStyleReferenceId }),
  }
}

function applyStyleReferences<
  T extends {
    stylePresetId?: string
    importedTikzStyleReferenceId?: string
  },
>(diagram: Diagram, target: T, clipboard: StyleClipboard): T {
  const nextTarget = { ...target }
  const stylePresetId = validStylePresetId(
    diagram,
    clipboard,
  )
  const importedTikzStyleReferenceId = validImportedTikzStyleReferenceId(
    diagram,
    clipboard.geometricKind,
    clipboard.importedTikzStyleReferenceId,
  )

  if (stylePresetId === undefined) {
    delete nextTarget.stylePresetId
  } else {
    nextTarget.stylePresetId = stylePresetId
  }

  if (importedTikzStyleReferenceId === undefined) {
    delete nextTarget.importedTikzStyleReferenceId
  } else {
    nextTarget.importedTikzStyleReferenceId = importedTikzStyleReferenceId
  }

  return nextTarget
}

function validStylePresetId(
  diagram: Diagram,
  clipboard: StyleClipboard,
): string | undefined {
  if (clipboard.stylePresetId === undefined) {
    return undefined
  }

  const preset = diagram.userStylePresets?.find(
    (candidate) => candidate.id === clipboard.stylePresetId,
  )

  return preset !== undefined &&
    preset.kind === clipboard.geometricKind &&
    stylePresetStylesEqual(preset.style, clipboard.style)
    ? clipboard.stylePresetId
    : undefined
}

function validImportedTikzStyleReferenceId(
  diagram: Diagram,
  kind: StyleClipboardGeometricKind,
  referenceId: string | undefined,
): string | undefined {
  if (referenceId === undefined) {
    return undefined
  }

  const reference = diagram.importedTikzStyleReferences?.find(
    (candidate) => candidate.id === referenceId,
  )

  return reference !== undefined && importedReferenceAppliesToKind(reference, kind)
    ? referenceId
    : undefined
}

function importedReferenceAppliesToKind(
  reference: ImportedTikzStyleReference,
  kind: StyleClipboardGeometricKind,
): boolean {
  const targets = styleReferenceTargets(kind)

  return reference.targets.some((target) => targets.includes(target))
}

function styleReferenceTargets(
  kind: StyleClipboardGeometricKind,
): readonly TikzStyleTarget[] {
  switch (kind) {
    case 'region':
      return ['region', 'filldraw']
    case 'sheet':
      return ['sheet', 'filldraw']
    case 'curve':
      return ['curve', 'draw']
    case 'point':
      return ['point', 'node']
    case 'label':
      return ['label', 'node']
  }
}

function selectedElementKey(element: SingleSelectedElement): string {
  return `${element.kind}:${element.id}`
}

function styleObjectCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'object' : 'objects'}`
}
