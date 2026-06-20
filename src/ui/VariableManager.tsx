import { useEffect, useMemo, useState } from 'react'
import {
  addSymbolicVariableToDiagram,
  deleteSymbolicVariableFromDiagram,
  macroNameFromSymbolicVariableName,
  nextSymbolicVariableName,
  updateSymbolicVariableInDiagram,
} from '../model/variables.ts'
import type { Diagram, SymbolicVariable } from '../model/types.ts'

export type VariableManagerProps = {
  diagram: Diagram
  onDiagramChange: (diagram: Diagram) => void
}

type VariableDraft = {
  id: string
  name: string
  expression: string
  error: string
}

export function VariableManager({
  diagram,
  onDiagramChange,
}: VariableManagerProps) {
  const variables = diagram.variables ?? []
  const variablesRevision = useMemo(() => JSON.stringify(variables), [variables])
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<VariableDraft[]>(() =>
    variableDraftsFromDiagram(variables),
  )
  const [status, setStatus] = useState('')

  useEffect(() => {
    setDrafts(variableDraftsFromDiagram(variables))
  }, [variablesRevision])

  function addVariable(): void {
    const name = nextSymbolicVariableName(variables)
    const result = addSymbolicVariableToDiagram(diagram, {
      id: nextVariableId(diagram),
      name,
      expression: '1',
    })

    if (!result.ok) {
      setStatus(result.error)
      return
    }

    setExpanded(true)
    setStatus(`Variable ${name} added.`)
    onDiagramChange(result.diagram)
  }

  function updateDraft(
    id: string,
    field: 'name' | 'expression',
    value: string,
  ): void {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, [field]: value, error: '' } : draft,
      ),
    )
    setStatus('')
  }

  function applyDraft(id: string): void {
    const draft = drafts.find((candidate) => candidate.id === id)

    if (draft === undefined) {
      return
    }

    const result = updateSymbolicVariableInDiagram(diagram, id, {
      name: draft.name,
      expression: draft.expression,
    })

    if (!result.ok) {
      setDrafts((current) =>
        current.map((candidate) =>
          candidate.id === id ? { ...candidate, error: result.error } : candidate,
        ),
      )
      setStatus(result.error)
      return
    }

    setStatus(`Variable ${draft.name.trim()} updated.`)
    onDiagramChange(result.diagram)
  }

  function deleteVariable(id: string): void {
    const variable = variables.find((candidate) => candidate.id === id)
    const result = deleteSymbolicVariableFromDiagram(diagram, id)

    if (!result.ok) {
      setDrafts((current) =>
        current.map((candidate) =>
          candidate.id === id ? { ...candidate, error: result.error } : candidate,
        ),
      )
      setStatus(result.error)
      return
    }

    setStatus(
      variable === undefined ? 'Variable deleted.' : `Variable ${variable.name} deleted.`,
    )
    onDiagramChange(result.diagram)
  }

  return (
    <section className="variable-manager" aria-labelledby="variable-manager-heading">
      <div className="variable-manager-summary-row">
        <button
          type="button"
          className="variable-manager-summary-toggle"
          aria-expanded={expanded}
          aria-controls="variable-manager-details"
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="variable-manager-disclosure" aria-hidden="true">
            {expanded ? 'v' : '>'}
          </span>
          <span id="variable-manager-heading" className="control-label">
            Variables
          </span>
          <span className="variable-manager-summary">
            {variableSummary(variables)}
          </span>
        </button>
        <button type="button" className="toolbar-button" onClick={addVariable}>
          Add variable
        </button>
        {status !== '' && (
          <span className="toolbar-status variable-manager-status" role="status">
            {status}
          </span>
        )}
      </div>

      {expanded && (
        <div id="variable-manager-details" className="variable-manager-details">
          {variables.length === 0 ? (
            <span className="variable-empty-state">No variables defined.</span>
          ) : (
            variables.map((variable) => (
              <VariableRow
                key={variable.id}
                variable={variable}
                draft={
                  drafts.find((candidate) => candidate.id === variable.id) ??
                  variableDraftFromVariable(variable)
                }
                onDraftChange={updateDraft}
                onApply={applyDraft}
                onDelete={deleteVariable}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}

function VariableRow({
  variable,
  draft,
  onDraftChange,
  onApply,
  onDelete,
}: {
  variable: SymbolicVariable
  draft: VariableDraft
  onDraftChange: (
    id: string,
    field: 'name' | 'expression',
    value: string,
  ) => void
  onApply: (id: string) => void
  onDelete: (id: string) => void
}) {
  const changed =
    draft.name !== variable.name || draft.expression !== variable.expression
  const draftMacroName = macroNameFromSymbolicVariableName(draft.name)
  const macroName = draftMacroName.length === 0 ? variable.macroName : draftMacroName

  return (
    <div className="variable-row" role="group" aria-label={`Variable ${variable.name}`}>
      <label className="variable-field variable-name-field">
        <span>Name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(event) =>
            onDraftChange(variable.id, 'name', event.currentTarget.value)
          }
        />
      </label>
      <label className="variable-field variable-expression-field">
        <span>Expression</span>
        <input
          type="text"
          value={draft.expression}
          spellCheck={false}
          onChange={(event) =>
            onDraftChange(variable.id, 'expression', event.currentTarget.value)
          }
        />
      </label>
      <span className="variable-macro" title="TikZ macro">
        \{macroName}
      </span>
      <span className="variable-preview" title="Preview value">
        {formatPreviewValue(variable.previewValue)}
      </span>
      <button
        type="button"
        className="toolbar-button"
        disabled={!changed}
        onClick={() => onApply(variable.id)}
      >
        Apply
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => onDelete(variable.id)}
      >
        Delete
      </button>
      {draft.error !== '' && (
        <span className="variable-row-error" role="status">
          {draft.error}
        </span>
      )}
    </div>
  )
}

function variableDraftsFromDiagram(
  variables: readonly SymbolicVariable[],
): VariableDraft[] {
  return variables.map(variableDraftFromVariable)
}

function variableDraftFromVariable(variable: SymbolicVariable): VariableDraft {
  return {
    id: variable.id,
    name: variable.name,
    expression: variable.expression,
    error: '',
  }
}

function nextVariableId(diagram: Diagram): string {
  const usedIds = new Set([
    ...(diagram.variables ?? []).map((variable) => variable.id),
    ...diagram.strata.map((stratum) => stratum.id),
    ...diagram.labels.map((label) => label.id),
  ])
  let index = (diagram.variables ?? []).length + 1

  while (usedIds.has(`variable-${index}`)) {
    index += 1
  }

  return `variable-${index}`
}

function variableSummary(variables: readonly SymbolicVariable[]): string {
  if (variables.length === 0) {
    return 'No variables'
  }

  const listedVariables = variables
    .slice(0, 3)
    .map((variable) => `${variable.name}=${variable.expression}`)
    .join(', ')
  const suffix = variables.length > 3 ? `, +${variables.length - 3}` : ''

  return `${variables.length} ${variables.length === 1 ? 'variable' : 'variables'}: ${listedVariables}${suffix}`
}

function formatPreviewValue(value: number): string {
  if (!Number.isFinite(value)) {
    return 'invalid'
  }

  if (Object.is(value, -0)) {
    return '0'
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(6)))
}
