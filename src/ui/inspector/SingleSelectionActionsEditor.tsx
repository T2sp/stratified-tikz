import type { Diagram } from '../../model/types.ts'
import type { TranslationVector } from '../../model/translation.ts'
import { SelectionTranslationSection } from './SelectionTranslationSection.tsx'

export type SingleSelectionActionsEditorProps = {
  diagram: Diagram
  targetName: 'path' | 'point' | 'sheet' | 'region' | 'free text label'
  onDuplicate: () => void
  onTranslate: (translation: TranslationVector) => void
  translationDisabledReason?: string
}

export function SingleSelectionActionsEditor({
  diagram,
  targetName,
  onDuplicate,
  onTranslate,
  translationDisabledReason,
}: SingleSelectionActionsEditorProps) {
  const heading = `${targetName[0].toUpperCase()}${targetName.slice(1)} actions`

  return (
    <>
      <SelectionTranslationSection
        diagram={diagram}
        heading={`Translate selected ${targetName}`}
        ariaLabel={`Translate selected ${targetName}`}
        disabledReason={translationDisabledReason}
        onTranslate={onTranslate}
      />
      <section className="inspector-section">
        <h3>{heading}</h3>
        <div className="inspector-form">
          <div className="inspector-field">
            <span className="inspector-field-label">Duplicate</span>
            <button
              type="button"
              className="toolbar-button"
              aria-label={`Duplicate selected ${targetName}`}
              title={`Duplicate this ${targetName} and select the copy`}
              onClick={onDuplicate}
            >
              Duplicate
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
