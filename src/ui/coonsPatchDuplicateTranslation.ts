import { validateCurvedSheetPrimitive } from '../geometry/curvedSheets.ts'
import {
  detachSampledCurvedSheetPrimitiveCoordinateReferences,
} from '../model/coordinateReferences.ts'
import {
  collectTopLevelDiagramIds,
  createCopyDiagramIdAllocator,
} from '../model/diagramIds.ts'
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

export type DuplicateAndTranslateCoonsPatchResult =
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

export type DuplicateAndTranslateCoonsPatchEditorState =
  UndoableEditorState & {
    layerOperationStatus: string
  }

export type ApplyDuplicateAndTranslateCoonsPatchResult<
  T extends DuplicateAndTranslateCoonsPatchEditorState,
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

export type DuplicateAndTranslateCoonsPatchActionResult =
  | {
      ok: true
      duplicatedPatchId: string
      message: string
    }
  | {
      ok: false
      message: string
    }

export type CoonsPatchDuplicateTranslationInput = {
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

export function duplicateAndTranslateCoonsPatch(
  diagram: Diagram,
  patchId: string,
  translation: TranslationVector,
): DuplicateAndTranslateCoonsPatchResult {
  try {
    const source = diagram.strata.find((stratum) => stratum.id === patchId)

    if (source === undefined) {
      return operationFailure(diagram, `Coons patch "${patchId}" does not exist.`)
    }

    if (!isCoonsPatchStratum(source)) {
      return operationFailure(
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
      return operationFailure(diagram, 'Enter a non-zero translation.')
    }

    const copied = structuredClone(source) as CoonsPatchStratum
    copied.id = createCopyDiagramIdAllocator(
      collectTopLevelDiagramIds(diagram),
    ).allocate(source.id)
    delete copied.primitive.boundarySources

    const detached = detachSampledCurvedSheetPrimitiveCoordinateReferences(
      diagram,
      copied.primitive,
      'primitive',
    )

    if (!detached.ok || detached.value.primitive.kind !== 'coonsPatch') {
      const message = detached.ok
        ? 'Detached curved-sheet primitive changed kind.'
        : detached.error.message

      return operationFailure(
        diagram,
        `Duplicate and translate failed: ${message}`,
      )
    }

    copied.primitive = detached.value.primitive
    const context = diagramTranslationContext(
      diagram,
      copied.primitive.boundarySnapshotState === 'frozen'
        ? 'preserveStored'
        : 'evaluateExpressions',
    )
    const translated = translateStratum(
      copied,
      normalizedTranslation,
      context,
    )

    if (!isCoonsPatchStratum(translated)) {
      return operationFailure(
        diagram,
        'Duplicate and translate failed: translated primitive changed kind.',
      )
    }

    const primitiveValidation = validateCurvedSheetPrimitive(
      translated.primitive,
    )

    if (!primitiveValidation.valid) {
      return operationFailure(
        diagram,
        validationErrorMessage(
          'Translated Coons patch is invalid',
          primitiveValidation.errors,
        ),
      )
    }

    const candidate = {
      ...diagram,
      strata: [...diagram.strata, translated],
    }
    const diagramValidation = validateDiagram(candidate)

    if (!diagramValidation.valid) {
      return operationFailure(
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
      sourcePatchId: source.id,
      duplicatedPatchId: translated.id,
    }
  } catch (error) {
    return operationFailure(
      diagram,
      error instanceof Error
        ? `Duplicate and translate failed: ${error.message}`
        : 'Duplicate and translate failed.',
    )
  }
}

export function applyDuplicateAndTranslateCoonsPatchToEditorState<
  T extends DuplicateAndTranslateCoonsPatchEditorState,
>(
  current: T,
  patchId: string,
  translation: TranslationVector,
): ApplyDuplicateAndTranslateCoonsPatchResult<T> {
  const selected = current.selectedElement

  if (
    selected === null ||
    selected.kind !== 'stratum' ||
    selected.id !== patchId ||
    !isSelectionCompatibleWithLayerFilter(
      current.editableDiagram,
      selected,
      current.layerFilter,
    )
  ) {
    return editorFailure(
      current,
      'Selection is not editable in the current layer filter.',
    )
  }

  const result = duplicateAndTranslateCoonsPatch(
    current.editableDiagram,
    patchId,
    translation,
  )

  if (!result.ok) {
    return editorFailure(current, result.error)
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
  const preview = translationVectorPreview(translation)
  const message = `Duplicated and translated Coons patch by (${preview.x}, ${preview.y}, ${preview.z}).`
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
    duplicatedPatchId: result.duplicatedPatchId,
    message,
  }
}

export function submitCoonsPatchDuplicateTranslation(
  diagram: Diagram,
  patchId: string,
  input: CoonsPatchDuplicateTranslationInput,
  action: (
    patchId: string,
    translation: TranslationVector,
  ) => DuplicateAndTranslateCoonsPatchActionResult,
): DuplicateAndTranslateCoonsPatchActionResult {
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

function operationFailure(
  diagram: Diagram,
  error: string,
): DuplicateAndTranslateCoonsPatchResult {
  return { ok: false, diagram, error }
}

function editorFailure<T extends DuplicateAndTranslateCoonsPatchEditorState>(
  state: T,
  message: string,
): ApplyDuplicateAndTranslateCoonsPatchResult<T> {
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
