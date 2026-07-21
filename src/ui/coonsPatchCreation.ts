import type { Diagram } from '../model/types.ts'
import {
  createCoonsPatchFromBoundaryPaths,
  type CreateCoonsPatchFromBoundaryPathsOptions,
  type CreateCoonsPatchFromBoundaryPathsResult,
} from './ruledSurface.ts'
import {
  coonsPatchBoundarySelectionsFromDraft,
  resetCoonsPatchBoundaryDraft,
  type CoonsPatchBoundaryDraft,
} from './sheetDraft.ts'

export type CoonsPatchCreationOptionsDraft = {
  keepLinkedToBoundarySources: boolean
}

export type CreateCoonsPatchFromCreationDraftOptions = Omit<
  CreateCoonsPatchFromBoundaryPathsOptions,
  'keepLinkedToBoundarySources'
>

type DraftUpdater<T> = (update: (current: T) => T) => void

type SuccessfulCoonsPatchCreation = Extract<
  CreateCoonsPatchFromBoundaryPathsResult,
  { ok: true }
>

export type CoonsPatchCreationInteraction = {
  keepLinkedCheckbox: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
  }
  create: (
    diagram: Diagram,
    boundaryDraft: CoonsPatchBoundaryDraft,
    options: CreateCoonsPatchFromCreationDraftOptions,
    onCreated: (result: SuccessfulCoonsPatchCreation) => void,
  ) => CreateCoonsPatchFromBoundaryPathsResult
  cancel: () => void
}

export type CreateCoonsPatchCreationInteractionOptions = {
  optionsDraft: CoonsPatchCreationOptionsDraft
  updateOptionsDraft: DraftUpdater<CoonsPatchCreationOptionsDraft>
  updateBoundaryDraft: DraftUpdater<CoonsPatchBoundaryDraft>
}

export function createCoonsPatchCreationOptionsDraft(): CoonsPatchCreationOptionsDraft {
  return {
    keepLinkedToBoundarySources: true,
  }
}

export function setCoonsPatchCreationKeepLinked(
  draft: CoonsPatchCreationOptionsDraft,
  keepLinkedToBoundarySources: boolean,
): CoonsPatchCreationOptionsDraft {
  return draft.keepLinkedToBoundarySources === keepLinkedToBoundarySources
    ? draft
    : { keepLinkedToBoundarySources }
}

export function createCoonsPatchFromCreationDraft(
  diagram: Diagram,
  boundaryDraft: CoonsPatchBoundaryDraft,
  optionsDraft: CoonsPatchCreationOptionsDraft,
  options: CreateCoonsPatchFromCreationDraftOptions = {},
): CreateCoonsPatchFromBoundaryPathsResult {
  return createCoonsPatchFromBoundaryPaths(
    diagram,
    coonsPatchBoundarySelectionsFromDraft(boundaryDraft),
    {
      ...options,
      keepLinkedToBoundarySources:
        optionsDraft.keepLinkedToBoundarySources,
    },
  )
}

export function createCoonsPatchCreationInteraction({
  optionsDraft,
  updateOptionsDraft,
  updateBoundaryDraft,
}: CreateCoonsPatchCreationInteractionOptions): CoonsPatchCreationInteraction {
  function resetDrafts(): void {
    updateBoundaryDraft(() => resetCoonsPatchBoundaryDraft())
    updateOptionsDraft(() => createCoonsPatchCreationOptionsDraft())
  }

  return {
    keepLinkedCheckbox: {
      checked: optionsDraft.keepLinkedToBoundarySources,
      onCheckedChange: (checked) => {
        updateOptionsDraft((current) =>
          setCoonsPatchCreationKeepLinked(current, checked),
        )
      },
    },
    create: (diagram, boundaryDraft, options, onCreated) => {
      const result = createCoonsPatchFromCreationDraft(
        diagram,
        boundaryDraft,
        optionsDraft,
        options,
      )

      if (result.ok) {
        onCreated(result)
        resetDrafts()
      }

      return result
    },
    cancel: resetDrafts,
  }
}
