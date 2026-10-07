import {
  isZeroTranslationVector,
  parseTranslationVectorFromInputs,
  translationVectorPreview,
  type TranslationVector,
} from '../model/translation.ts'
import type { Diagram } from '../model/types.ts'
import { validateDiagram } from '../model/validation.ts'
import {
  isCoonsPatchStratum,
  translateCoonsPatch,
} from '../model/coonsPatchTranslation.ts'
export {
  isCoonsPatchStratum,
  translateCoonsPatch,
  type CoonsPatchStratum,
  type TranslateCoonsPatchResult,
} from '../model/coonsPatchTranslation.ts'
import { duplicateSelectedElements } from './bulkEditing.ts'
import {
  clearSelectionForLayerFilter,
  isSelectionCompatibleWithLayerFilter,
  normalizeLayerFilterForDiagram,
} from './layerFilter.ts'
import type { SelectedElement } from './selection.ts'
import {
  commitDiagramChange,
  type UndoableEditorState,
} from './undo.ts'

export type DuplicateCoonsPatchResult =
  | {
      ok: true
      diagram: Diagram
      sourcePatchId: string
      duplicatedPatchId: string
    }
  | {
      ok: false
      diagram: Diagram
      error: string
    }

export type CoonsPatchActionEditorState = UndoableEditorState & {
  layerOperationStatus: string
}

export type ApplyDuplicateCoonsPatchResult<
  T extends CoonsPatchActionEditorState,
> =
  | {
      ok: true
      state: T
      duplicatedPatchId: string
      message: string
    }
  | {
      ok: false
      state: T
      message: string
    }

export type ApplyTranslateCoonsPatchResult<
  T extends CoonsPatchActionEditorState,
> =
  | {
      ok: true
      state: T
      patchId: string
      message: string
    }
  | {
      ok: false
      state: T
      message: string
    }

export type DuplicateCoonsPatchActionResult =
  | {
      ok: true
      duplicatedPatchId: string
      message: string
    }
  | {
      ok: false
      message: string
    }

export type TranslateCoonsPatchActionResult =
  | {
      ok: true
      patchId: string
      message: string
    }
  | {
      ok: false
      message: string
    }

export type CoonsPatchTranslationInput = {
  dx: string
  dy: string
  dz: string
}

/**
 * Duplicate one Coons patch with the ordinary Phase 29 patch-only policy.
 * The copy is untranslated and retains any active boundary links.
 */
export function duplicateCoonsPatch(
  diagram: Diagram,
  patchId: string,
): DuplicateCoonsPatchResult {
  try {
    const source = diagram.strata.find((stratum) => stratum.id === patchId)

    if (source === undefined) {
      return duplicateFailure(diagram, `Coons patch "${patchId}" does not exist.`)
    }

    if (!isCoonsPatchStratum(source)) {
      return duplicateFailure(
        diagram,
        `Stratum "${patchId}" is not a Coons patch.`,
      )
    }

    const duplicated = duplicateSelectedElements(diagram, {
      kind: 'stratum',
      id: patchId,
    })
    const duplicatedPatchId =
      duplicated.selectedElement?.kind === 'stratum'
        ? duplicated.selectedElement.id
        : null
    const copy =
      duplicatedPatchId === null
        ? undefined
        : duplicated.diagram.strata.find(
            (stratum) => stratum.id === duplicatedPatchId,
          )

    if (
      duplicated.duplicatedCount !== 1 ||
      duplicatedPatchId === null ||
      copy === undefined ||
      !isCoonsPatchStratum(copy)
    ) {
      return duplicateFailure(
        diagram,
        'Duplicate Coons patch failed: patch-only duplication returned an unexpected result.',
      )
    }

    const diagramValidation = validateDiagram(duplicated.diagram)

    if (!diagramValidation.valid) {
      return duplicateFailure(
        diagram,
        validationErrorMessage(
          'Duplicated diagram is invalid',
          diagramValidation.errors,
        ),
      )
    }

    return {
      ok: true,
      diagram: duplicated.diagram,
      sourcePatchId: source.id,
      duplicatedPatchId,
    }
  } catch (error) {
    return duplicateFailure(
      diagram,
      error instanceof Error
        ? `Duplicate Coons patch failed: ${error.message}`
        : 'Duplicate Coons patch failed.',
    )
  }
}

export function applyDuplicateCoonsPatchToEditorState<
  T extends CoonsPatchActionEditorState,
>(
  current: T,
  patchId: string,
): ApplyDuplicateCoonsPatchResult<T> {
  const selectionError = coonsPatchSelectionError(current, patchId)

  if (selectionError !== null) {
    return duplicateEditorFailure(current, selectionError)
  }

  const result = duplicateCoonsPatch(current.editableDiagram, patchId)

  if (!result.ok) {
    return duplicateEditorFailure(current, result.error)
  }

  const nextLayerFilter = normalizeLayerFilterForDiagram(
    result.diagram,
    current.layerFilter,
  )
  const nextSelection: SelectedElement = clearSelectionForLayerFilter(
    result.diagram,
    { kind: 'stratum', id: result.duplicatedPatchId },
    nextLayerFilter,
  )
  const message = 'Duplicated Coons patch.'
  const state = commitDiagramChange(
    current,
    {
      ...current,
      editableDiagram: result.diagram,
      selectedElement: nextSelection,
      layerFilter: nextLayerFilter,
      polylineDraft: null,
      cubicBezierDraft: null,
      pathDraft: null,
      sheetPolygonDraft: null,
      layerOperationStatus: message,
    },
    { preserveLinkedCoonsSnapshots: true },
  )

  return {
    ok: true,
    state,
    duplicatedPatchId: result.duplicatedPatchId,
    message,
  }
}

export function applyTranslateCoonsPatchToEditorState<
  T extends CoonsPatchActionEditorState,
>(
  current: T,
  patchId: string,
  translation: TranslationVector,
): ApplyTranslateCoonsPatchResult<T> {
  const selectionError = coonsPatchSelectionError(current, patchId)

  if (selectionError !== null) {
    return translateEditorFailure(current, selectionError)
  }

  const result = translateCoonsPatch(
    current.editableDiagram,
    patchId,
    translation,
  )

  if (!result.ok) {
    return translateEditorFailure(current, result.error)
  }

  const nextLayerFilter = normalizeLayerFilterForDiagram(
    result.diagram,
    current.layerFilter,
  )
  const nextSelection: SelectedElement = clearSelectionForLayerFilter(
    result.diagram,
    { kind: 'stratum', id: result.patchId },
    nextLayerFilter,
  )
  const preview = translationVectorPreview(translation)
  const message = `Translated Coons patch by (${preview.x}, ${preview.y}, ${preview.z}).`
  const state = commitDiagramChange(current, {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: nextSelection,
    layerFilter: nextLayerFilter,
    polylineDraft: null,
    cubicBezierDraft: null,
    pathDraft: null,
    sheetPolygonDraft: null,
    layerOperationStatus: message,
  })

  return {
    ok: true,
    state,
    patchId: result.patchId,
    message,
  }
}

export function submitCoonsPatchTranslation(
  diagram: Diagram,
  patchId: string,
  input: CoonsPatchTranslationInput,
  action: (
    patchId: string,
    translation: TranslationVector,
  ) => TranslateCoonsPatchActionResult,
): TranslateCoonsPatchActionResult {
  const parsed = parseTranslationVectorFromInputs(diagram, input)

  if (!parsed.ok) {
    return { ok: false, message: parsed.error }
  }

  if (isZeroTranslationVector(parsed.translation)) {
    return { ok: false, message: 'Enter a non-zero translation.' }
  }

  return action(patchId, parsed.translation)
}

function coonsPatchSelectionError(
  current: CoonsPatchActionEditorState,
  patchId: string,
): string | null {
  const selected = current.selectedElement

  return selected === null ||
    selected.kind !== 'stratum' ||
    selected.id !== patchId ||
    !isSelectionCompatibleWithLayerFilter(
      current.editableDiagram,
      selected,
      current.layerFilter,
    )
    ? 'Selection is not editable in the current layer filter.'
    : null
}

function duplicateFailure(
  diagram: Diagram,
  error: string,
): DuplicateCoonsPatchResult {
  return { ok: false, diagram, error }
}

function duplicateEditorFailure<T extends CoonsPatchActionEditorState>(
  state: T,
  message: string,
): ApplyDuplicateCoonsPatchResult<T> {
  return { ok: false, state, message }
}

function translateEditorFailure<T extends CoonsPatchActionEditorState>(
  state: T,
  message: string,
): ApplyTranslateCoonsPatchResult<T> {
  return { ok: false, state, message }
}

function validationErrorMessage(
  prefix: string,
  errors: readonly { path: string; message: string }[],
): string {
  const first = errors[0]

  return first === undefined
    ? `${prefix}.`
    : `${prefix}: ${first.path}: ${first.message}`
}
