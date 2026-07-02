import { useState } from 'react'
import {
  pathSplitSegmentCount,
  type PathSplitTarget,
} from '../pathSplitting.ts'
import type { CurveStratum } from '../../model/types.ts'

export type PathSplitEditorProps = {
  curve: CurveStratum
  onSplitPath: (target: PathSplitTarget, keepOriginal: boolean) => string
  onStartPathSplitPick: (keepOriginal: boolean) => string
}

export function PathSplitEditor({
  curve,
  onSplitPath,
  onStartPathSplitPick,
}: PathSplitEditorProps) {
  const [segmentInput, setSegmentInput] = useState('1')
  const [positionInput, setPositionInput] = useState('0.5')
  const [keepOriginal, setKeepOriginal] = useState(false)
  const [status, setStatus] = useState('')
  const segmentCount = pathSplitSegmentCount(curve)
  const segmentNumber = Number(segmentInput)
  const position = Number(positionInput)
  const segmentValid =
    Number.isInteger(segmentNumber) &&
    segmentNumber >= 1 &&
    segmentNumber <= segmentCount
  const positionValid =
    Number.isFinite(position) && position > 0 && position < 1
  const canSplit = segmentCount > 0 && segmentValid && positionValid
  const validationStatus =
    segmentCount === 0
      ? 'This path kind is not splittable.'
      : !segmentValid
        ? `Segment must be between 1 and ${segmentCount}.`
        : !positionValid
          ? 'Position must satisfy 0 < pos < 1.'
          : ''

  function splitDirectly(): void {
    if (!canSplit) {
      setStatus(validationStatus)
      return
    }

    setStatus(
      onSplitPath(
        {
          segmentIndex: segmentNumber - 1,
          t: position,
        },
        keepOriginal,
      ),
    )
  }

  function startPreviewPick(): void {
    setStatus(onStartPathSplitPick(keepOriginal))
  }

  return (
    <section className="inspector-section">
      <h3>Split path</h3>
      <div className="inspector-form">
        <div className="inspector-field">
          <span className="inspector-field-label">Segments</span>
          <span className="readonly-value">{String(segmentCount)}</span>
        </div>
        <label className="inspector-field">
          <span className="inspector-field-label">Segment</span>
          <input
            className="inspector-input"
            type="text"
            inputMode="numeric"
            aria-invalid={!segmentValid && segmentInput.trim().length > 0}
            value={segmentInput}
            onChange={(event) => setSegmentInput(event.currentTarget.value)}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label">Position</span>
          <input
            className="inspector-input"
            type="text"
            inputMode="decimal"
            aria-invalid={!positionValid && positionInput.trim().length > 0}
            value={positionInput}
            onChange={(event) => setPositionInput(event.currentTarget.value)}
          />
        </label>
        <label className="inspector-field inspector-checkbox-field">
          <span className="inspector-field-label">Keep original path</span>
          <span className="inspector-checkbox-control">
            <input
              type="checkbox"
              checked={keepOriginal}
              onChange={(event) => setKeepOriginal(event.currentTarget.checked)}
            />
            <span>{keepOriginal ? 'On' : 'Off'}</span>
          </span>
        </label>
        <div className="inspector-field">
          <span className="inspector-field-label">Apply</span>
          <div className="bulk-action-buttons">
            <button
              type="button"
              className="toolbar-button"
              disabled={!canSplit}
              title={validationStatus}
              onClick={splitDirectly}
            >
              Split
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={segmentCount === 0}
              title={
                segmentCount === 0
                  ? validationStatus
                  : 'Pick a split point on this path in the preview.'
              }
              onClick={startPreviewPick}
            >
              Pick on preview
            </button>
          </div>
        </div>
        {(status !== '' || validationStatus !== '') && (
          <p className="inspector-status" role="status" aria-live="polite">
            {status || validationStatus}
          </p>
        )}
      </div>
    </section>
  )
}
