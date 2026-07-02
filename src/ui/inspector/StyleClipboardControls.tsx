import { ReadOnlyField } from './InspectorField.tsx'

export type StyleClipboardControlsProps = {
  clipboardSummary: string
  status: string
  copyDisabled?: boolean
  pasteDisabled?: boolean
  onCopyStyle: () => void
  onPasteStyle: () => void
}

export function StyleClipboardControls({
  clipboardSummary,
  status,
  copyDisabled = false,
  pasteDisabled = false,
  onCopyStyle,
  onPasteStyle,
}: StyleClipboardControlsProps) {
  return (
    <section className="inspector-section">
      <h3>Style clipboard</h3>
      <div className="inspector-form">
        <ReadOnlyField label="Copied style" value={clipboardSummary} />
        <div className="inspector-field">
          <span className="inspector-field-label">Commands</span>
          <div className="bulk-action-buttons">
            <button
              type="button"
              className="toolbar-button"
              disabled={copyDisabled}
              onClick={onCopyStyle}
            >
              Copy style
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={pasteDisabled}
              onClick={onPasteStyle}
            >
              Paste style
            </button>
          </div>
        </div>
        {status !== '' && (
          <p className="inspector-status" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </div>
    </section>
  )
}
