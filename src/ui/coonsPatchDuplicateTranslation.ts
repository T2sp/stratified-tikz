import { validateCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import {
  detachSampledCurvedSheetPrimitiveCoordinateReferences,
} from '../model/coordinateReferences.ts'
import {
  diagramTranslationContext,
  isZeroTranslationVector,
  normalizeTranslationVectorForDiagram,
  parseTranslationVectorFromInputs,
  translateStratum,
  translationVectorPreview,
  type TranslationVector,
} from '../model/translation.ts'
import type {
  CurvedSheetStratum,
  Diagram,
  Stratum,
} from '../model/types.ts'
import { validateDiagram } from '../model/validation.ts'
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

export type CoonsPatchStratum = CurvedSheetStratum & {
  primitive: Extract<CurvedSheetStratum['primitive'], { kind: 'coonsPatch' }>
}

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

export type TranslateCoonsPatchResult =
  | {
      ok: true
      diagram: Diagram
      patchId: string
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

export function isCoonsPatchStratum(
  stratum: Stratum,
): stratum is CoonsPatchStratum {
  const candidate = stratum as Partial<CurvedSheetStratum>

  return (
    isCurvedSheetStratum(stratum) &&
    typeof candidate.primitive === 'object' &&
    candidate.primitive !== null &&
    candidate.primitive.kind === 'coonsPatch'
  )
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

/**
 * Translate one Coons patch in place. Active boundary links are removed from
 * the local candidate before it is returned to the central commit/synchronizer.
 */
export function translateCoonsPatch(
  diagram: Diagram,
  patchId: string,
  translation: TranslationVector,
): TranslateCoonsPatchResult {
  try {
    const sourceIndex = diagram.strata.findIndex(
      (stratum) => stratum.id === patchId,
    )
    const source = diagram.strata[sourceIndex]

    if (source === undefined) {
      return translateFailure(diagram, `Coons patch "${patchId}" does not exist.`)
    }

    if (!isCoonsPatchStratum(source)) {
      return translateFailure(
        diagram,
        `Stratum "${patchId}" is not a Coons patch.`,
      )
    }

    const normalizedTranslation = normalizeTranslationVectorForDiagram(
      diagram,
      translation,
      { reject2DNonZeroZ: true },
    )

    if (isZeroTranslationVector(normalizedTranslation)) {
      return translateFailure(diagram, 'Enter a non-zero translation.')
    }

    const localCandidate = structuredClone(source) as CoonsPatchStratum
    delete localCandidate.primitive.boundarySources

    const detached = detachSampledCurvedSheetPrimitiveCoordinateReferences(
      diagram,
      localCandidate.primitive,
      `strata[${sourceIndex}].primitive`,
    )

    if (!detached.ok || detached.value.primitive.kind !== 'coonsPatch') {
      const message = detached.ok
        ? 'Detached curved-sheet primitive changed kind.'
        : detached.error.message

      return translateFailure(
        diagram,
        `Translate Coons patch failed: ${message}`,
      )
    }

    localCandidate.primitive = detached.value.primitive
    const context = diagramTranslationContext(
      diagram,
      localCandidate.primitive.boundarySnapshotState === 'frozen'
        ? 'preserveStored'
        : 'evaluateExpressions',
    )
    const translated = translateStratum(
      localCandidate,
      normalizedTranslation,
      context,
    )

    if (!isCoonsPatchStratum(translated)) {
      return translateFailure(
        diagram,
        'Translate Coons patch failed: translated primitive changed kind.',
      )
    }

    const primitiveValidation = validateCurvedSheetPrimitive(
      translated.primitive,
    )

    if (!primitiveValidation.valid) {
      return translateFailure(
        diagram,
        validationErrorMessage(
          'Translated Coons patch is invalid',
          primitiveValidation.errors,
        ),
      )
    }

    const strata = [...diagram.strata]
    strata[sourceIndex] = translated
    const candidate = { ...diagram, strata }
    const diagramValidation = validateDiagram(candidate)

    if (!diagramValidation.valid) {
      return translateFailure(
        diagram,
        validationErrorMessage(
          'Translated diagram is invalid',
          diagramValidation.errors,
        ),
      )
    }

    return {
      ok: true,
      diagram: candidate,
      patchId: translated.id,
    }
  } catch (error) {
    return translateFailure(
      diagram,
      error instanceof Error
        ? `Translate Coons patch failed: ${error.message}`
        : 'Translate Coons patch failed.',
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

function isCurvedSheetStratum(
  stratum: Diagram['strata'][number],
): stratum is CurvedSheetStratum {
  return (
    stratum.geometricKind === 'sheet' && stratum.kind === 'curvedSheet'
  )
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

function translateFailure(
  diagram: Diagram,
  error: string,
): TranslateCoonsPatchResult {
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
