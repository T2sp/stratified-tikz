import { useMemo, useState } from 'react'
import {
  labelAnchors,
  lineStyles,
  pointFills,
  pointShapes,
  tikzStyleTargets,
} from '../../model/types.ts'
import type {
  Diagram,
  ExternalTikzStyleSource,
  HexColor,
  ImportedTikzStyleReference,
  LabelAnchor,
  LineStyle,
  PointFill,
  PointShape,
  StylePresetKind,
  TikzStyleTarget,
  UserStylePreset,
} from '../../model/types.ts'
import {
  importedTikzStyleReferenceMatchesPresetKind,
  importedTikzStyleTargetsForPresetKind,
  importedTikzStyleTargetsMatchPresetKind,
  updateImportedTikzStyleReferenceTargets,
} from '../../model/importedTikzStyles.ts'
import {
  applyUserStylePresetToLabel,
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
  deleteUserStylePreset,
  normalizeStylePresetName,
  renameUserStylePreset,
  updateUserStylePresetStyle,
  type StylePresetStyle,
} from '../../model/stylePresets.ts'
import {
  EditableColorField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'
import type { DiagramChangeHandler } from './types.ts'

export type StylePresetTarget =
  | { kind: 'stratum'; id: string }
  | { kind: 'label'; id: string }

export type UserStylePresetControlsProps = {
  diagram: Diagram
  kind: StylePresetKind
  currentStyle: StylePresetStyle
  target: StylePresetTarget
  onDiagramChange: DiagramChangeHandler
}

export function UserStylePresetControls({
  diagram,
  kind,
  currentStyle,
  target,
  onDiagramChange,
}: UserStylePresetControlsProps) {
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [presetFilter, setPresetFilter] = useState('')
  const [presetMessage, setPresetMessage] = useState('')
  const importedReferencesById = useMemo(
    () =>
      new Map(
        (diagram.importedTikzStyleReferences ?? []).map((reference) => [
          reference.id,
          reference,
        ]),
      ),
    [diagram.importedTikzStyleReferences],
  )
  const externalSourcesById = useMemo(
    () =>
      new Map(
        (diagram.externalTikzStyleSources ?? []).map((source) => [
          source.id,
          source,
        ]),
      ),
    [diagram.externalTikzStyleSources],
  )
  const allPresets = (diagram.userStylePresets ?? []).filter(
    (preset) => preset.kind === kind,
  )
  const localUserPresets = allPresets.filter(
    (preset) => preset.importedTikzStyleReferenceId === undefined,
  )
  const importedPresets = allPresets.filter(
    (preset) => preset.importedTikzStyleReferenceId !== undefined,
  )
  const filteredLocalUserPresets = filterPresets(
    localUserPresets,
    presetFilter,
    importedReferencesById,
    externalSourcesById,
  )
  const filteredImportedPresets = filterPresets(
    importedPresets,
    presetFilter,
    importedReferencesById,
    externalSourcesById,
  )
  const visiblePresets = [
    ...filteredLocalUserPresets,
    ...filteredImportedPresets,
  ]
  const activePresetId = visiblePresets.some(
    (preset) => preset.id === selectedPresetId,
  )
    ? selectedPresetId
    : visiblePresets[0]?.id ?? ''
  const selectedPreset =
    allPresets.find((preset) => preset.id === activePresetId) ?? null
  const selectedImportedReference =
    selectedPreset?.importedTikzStyleReferenceId === undefined
      ? null
      : importedReferencesById.get(
          selectedPreset.importedTikzStyleReferenceId,
        ) ?? null
  const selectedImportedSource =
    selectedImportedReference === null
      ? null
      : externalSourcesById.get(selectedImportedReference.sourceId) ?? null
  const selectedPresetOrigin =
    selectedPreset?.importedTikzStyleReferenceId === undefined
      ? 'user'
      : 'imported'
  const hasPresets = allPresets.length > 0
  const shouldShowFilter = allPresets.length > 6 || presetFilter.length > 0

  function createPreset(): void {
    const name = window.prompt(
      'Preset name',
      normalizeStylePresetName('', kind),
    )

    if (name === null) {
      return
    }

    if (!isValidPresetName(name)) {
      setPresetMessage('Preset name must include at least one visible character.')
      return
    }

    onDiagramChange((currentDiagram) => {
      const result = createUserStylePresetFromStyle(
        currentDiagram,
        kind,
        name,
        currentStyle,
      )

      return result?.diagram ?? currentDiagram
    })
    setPresetMessage('Preset saved.')
  }

  function applyPreset(): void {
    if (selectedPreset === null) {
      return
    }

    const importedWarning =
      selectedPreset.importedTikzStyleReferenceId === undefined
        ? ''
        : importedPresetStatusMessage(
            kind,
            selectedImportedReference,
            selectedImportedSource,
          )

    onDiagramChange((currentDiagram) =>
      target.kind === 'label'
        ? applyUserStylePresetToLabel(
            currentDiagram,
            target.id,
            selectedPreset.id,
          )
        : applyUserStylePresetToStratum(
            currentDiagram,
            target.id,
            selectedPreset.id,
          ),
    )
    setPresetMessage(importedWarning || 'Preset applied.')
  }

  function renamePreset(): void {
    if (selectedPreset === null || selectedPresetOrigin !== 'user') {
      return
    }

    const name = window.prompt('Preset name', selectedPreset.name)

    if (name === null) {
      return
    }

    if (!isValidPresetName(name)) {
      setPresetMessage('Preset name must include at least one visible character.')
      return
    }

    onDiagramChange((currentDiagram) =>
      renameUserStylePreset(currentDiagram, selectedPreset.id, name),
    )
    setPresetMessage('Preset renamed.')
  }

  function deletePreset(): void {
    if (selectedPreset === null || selectedPresetOrigin !== 'user') {
      return
    }

    if (!window.confirm(`Delete preset "${selectedPreset.name}"?`)) {
      return
    }

    onDiagramChange((currentDiagram) =>
      deleteUserStylePreset(currentDiagram, selectedPreset.id),
    )
    setSelectedPresetId('')
    setPresetMessage('Preset deleted.')
  }

  function updatePresetStyle(style: StylePresetStyle): void {
    if (selectedPreset === null) {
      return
    }

    onDiagramChange((currentDiagram) =>
      updateUserStylePresetStyle(currentDiagram, selectedPreset.id, style),
    )
    setPresetMessage(
      selectedPresetOrigin === 'imported'
        ? 'Imported preview approximation updated; the external TikZ key is unchanged.'
        : 'Preset style updated.',
    )
  }

  function updateImportedTarget(
    reference: ImportedTikzStyleReference,
    targetOption: TikzStyleTarget,
    checked: boolean,
  ): void {
    const nextTargets = checked
      ? [...reference.targets, targetOption]
      : reference.targets.filter((target) => target !== targetOption)
    const uniqueTargets = tikzStyleTargets.filter((target) =>
      nextTargets.includes(target),
    )

    if (uniqueTargets.length === 0) {
      setPresetMessage('Imported style target list must not be empty.')
      return
    }

    const incompatiblePresetKinds = incompatiblePresetKindsForImportedTargets(
      diagram,
      reference.id,
      uniqueTargets,
    )

    if (incompatiblePresetKinds.length > 0) {
      setPresetMessage(
        `Imported style target is incompatible with ${formatPresetKindList(
          incompatiblePresetKinds,
        )} presets.`,
      )
      return
    }

    onDiagramChange((currentDiagram) =>
      updateImportedTikzStyleReferenceTargets(
        currentDiagram,
        reference.id,
        uniqueTargets,
      ),
    )
    setPresetMessage('Imported style targets updated.')
  }

  return (
    <>
      <div className="inspector-field style-preset-field">
        <span className="inspector-field-label">Saved presets</span>
        <div className="style-preset-manager">
          <div className="style-preset-toolbar">
            <button
              type="button"
              className="style-preset-button"
              onClick={createPreset}
            >
              Save current
            </button>
            {shouldShowFilter && (
              <input
                className="inspector-input style-preset-filter"
                type="search"
                value={presetFilter}
                placeholder="Filter presets"
                onChange={(event) => {
                  setPresetFilter(event.currentTarget.value)
                  setPresetMessage('')
                }}
              />
            )}
          </div>
          {hasPresets ? (
            <>
              <div className="style-preset-group-list">
                <PresetGroup
                  title="User"
                  presets={filteredLocalUserPresets}
                  activePresetId={activePresetId}
                  importedReferencesById={importedReferencesById}
                  externalSourcesById={externalSourcesById}
                  onSelect={(presetId) => {
                    setSelectedPresetId(presetId)
                    setPresetMessage('')
                  }}
                />
                <PresetGroup
                  title="Imported"
                  presets={filteredImportedPresets}
                  activePresetId={activePresetId}
                  importedReferencesById={importedReferencesById}
                  externalSourcesById={externalSourcesById}
                  onSelect={(presetId) => {
                    setSelectedPresetId(presetId)
                    setPresetMessage('')
                  }}
                />
              </div>
              <div className="style-preset-buttons">
                <button
                  type="button"
                  className="style-preset-button"
                  disabled={selectedPreset === null}
                  onClick={applyPreset}
                >
                  Apply
                </button>
                {selectedPresetOrigin === 'user' && selectedPreset !== null && (
                  <>
                    <button
                      type="button"
                      className="style-preset-button"
                      onClick={renamePreset}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="style-preset-button style-preset-delete-button"
                      onClick={deletePreset}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              {selectedPreset !== null &&
                selectedPresetOrigin === 'imported' && (
                  <ImportedPresetDetails
                    kind={kind}
                    reference={selectedImportedReference}
                    source={selectedImportedSource}
                    onTargetChange={updateImportedTarget}
                  />
                )}
            </>
          ) : (
            <span className="style-preset-empty">No saved presets.</span>
          )}
          {presetMessage.length > 0 && (
            <span className="style-preset-status" role="status">
              {presetMessage}
            </span>
          )}
        </div>
      </div>
      {selectedPreset !== null && (
        <PresetStyleFields
          preset={selectedPreset}
          onChange={updatePresetStyle}
        />
      )}
    </>
  )
}

function PresetGroup({
  title,
  presets,
  activePresetId,
  importedReferencesById,
  externalSourcesById,
  onSelect,
}: {
  title: string
  presets: readonly UserStylePreset[]
  activePresetId: string
  importedReferencesById: ReadonlyMap<string, ImportedTikzStyleReference>
  externalSourcesById: ReadonlyMap<string, ExternalTikzStyleSource>
  onSelect: (presetId: string) => void
}) {
  return (
    <section className="style-preset-group" aria-label={`${title} presets`}>
      <div className="style-preset-group-heading">
        <span>{title}</span>
        <span>{presets.length}</span>
      </div>
      {presets.length === 0 ? (
        <span className="style-preset-empty">None</span>
      ) : (
        <div className="style-preset-list">
          {presets.map((preset) => {
            const reference =
              preset.importedTikzStyleReferenceId === undefined
                ? undefined
                : importedReferencesById.get(
                    preset.importedTikzStyleReferenceId,
                  )
            const source =
              reference === undefined
                ? undefined
                : externalSourcesById.get(reference.sourceId)
            const isSelected = preset.id === activePresetId

            return (
              <button
                key={preset.id}
                type="button"
                className={`style-preset-list-item${
                  isSelected ? ' style-preset-list-item-selected' : ''
                }`}
                aria-pressed={isSelected}
                onClick={() => onSelect(preset.id)}
              >
                <span className="style-preset-list-item-name">
                  {preset.name}
                </span>
                {reference !== undefined && (
                  <span className="style-preset-list-item-meta">
                    {reference.key}
                    {source === undefined
                      ? ' - missing source'
                      : ` - ${source.name}`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ImportedPresetDetails({
  kind,
  reference,
  source,
  onTargetChange,
}: {
  kind: StylePresetKind
  reference: ImportedTikzStyleReference | null
  source: ExternalTikzStyleSource | null
  onTargetChange: (
    reference: ImportedTikzStyleReference,
    target: TikzStyleTarget,
    checked: boolean,
  ) => void
}) {
  if (reference === null) {
    return (
      <div className="style-preset-details style-preset-warning">
        Imported TikZ style reference is missing.
      </div>
    )
  }

  const compatible = importedTikzStyleReferenceMatchesPresetKind(reference, kind)

  return (
    <div className="style-preset-details">
      <span>
        Imported key: <code>{reference.key}</code>
      </span>
      <span>
        Source:{' '}
        {source === null ? (
          <strong>missing external source</strong>
        ) : (
          source.name
        )}
      </span>
      {source !== null && <span>Load hint: {source.loadHint}</span>}
      <span className="style-preset-warning">
        SVG preview is approximate for imported TikZ styles.
      </span>
      <span className="style-preset-warning">
        External style files are not embedded; load them in LaTeX before
        compiling.
      </span>
      {source === null && (
        <span className="style-preset-warning">
          Missing external source; export can use the key but cannot emit a load
          instruction.
        </span>
      )}
      {!compatible && (
        <span className="style-preset-warning">
          Incompatible preset target; export will use the local preset fallback
          for this element kind.
        </span>
      )}
      {reference.options !== undefined && (
        <span className="style-preset-options">
          Preview options: {reference.options}
        </span>
      )}
      <div className="style-preset-targets" aria-label="Imported style targets">
        {tikzStyleTargets.map((target) => (
          <label key={target} className="style-preset-target-toggle">
            <input
              type="checkbox"
              checked={reference.targets.includes(target)}
              onChange={(event) =>
                onTargetChange(reference, target, event.currentTarget.checked)
              }
            />
            <span>{target}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function filterPresets(
  presets: readonly UserStylePreset[],
  filter: string,
  importedReferencesById: ReadonlyMap<string, ImportedTikzStyleReference>,
  externalSourcesById: ReadonlyMap<string, ExternalTikzStyleSource>,
): UserStylePreset[] {
  const normalizedFilter = filter.trim().toLowerCase()

  if (normalizedFilter.length === 0) {
    return [...presets]
  }

  return presets.filter((preset) =>
    presetSearchText(
      preset,
      importedReferencesById,
      externalSourcesById,
    ).includes(normalizedFilter),
  )
}

function presetSearchText(
  preset: UserStylePreset,
  importedReferencesById: ReadonlyMap<string, ImportedTikzStyleReference>,
  externalSourcesById: ReadonlyMap<string, ExternalTikzStyleSource>,
): string {
  const reference =
    preset.importedTikzStyleReferenceId === undefined
      ? undefined
      : importedReferencesById.get(preset.importedTikzStyleReferenceId)
  const source =
    reference === undefined
      ? undefined
      : externalSourcesById.get(reference.sourceId)

  return [
    preset.name,
    preset.kind,
    preset.tikzStyleName,
    reference?.displayName,
    reference?.key,
    source?.name,
    source?.loadHint,
  ]
    .filter((value): value is string => value !== undefined)
    .join(' ')
    .toLowerCase()
}

function importedPresetStatusMessage(
  kind: StylePresetKind,
  reference: ImportedTikzStyleReference | null,
  source: ExternalTikzStyleSource | null,
): string {
  if (reference === null) {
    return 'Imported TikZ style reference is missing.'
  }

  if (!importedTikzStyleReferenceMatchesPresetKind(reference, kind)) {
    return `Incompatible preset target; expected ${formatTargetList(
      importedTikzStyleTargetsForPresetKind(kind),
    )}.`
  }

  if (source === null) {
    return 'Missing external source; export cannot emit a load instruction.'
  }

  return 'Preset applied. Load the external TikZ style file when compiling.'
}

function incompatiblePresetKindsForImportedTargets(
  diagram: Diagram,
  referenceId: string,
  targets: readonly TikzStyleTarget[],
): StylePresetKind[] {
  const usedKinds = new Set<StylePresetKind>()

  for (const preset of diagram.userStylePresets ?? []) {
    if (
      preset.importedTikzStyleReferenceId === referenceId &&
      !importedTikzStyleTargetsMatchPresetKind(targets, preset.kind)
    ) {
      usedKinds.add(preset.kind)
    }
  }

  for (const stratum of diagram.strata) {
    if (
      stratum.importedTikzStyleReferenceId === referenceId &&
      !importedTikzStyleTargetsMatchPresetKind(
        targets,
        stratum.geometricKind,
      )
    ) {
      usedKinds.add(stratum.geometricKind)
    }
  }

  for (const label of diagram.labels) {
    if (
      label.importedTikzStyleReferenceId === referenceId &&
      !importedTikzStyleTargetsMatchPresetKind(targets, 'label')
    ) {
      usedKinds.add('label')
    }
  }

  return stylePresetKindOrder.filter((kind) => usedKinds.has(kind))
}

function isValidPresetName(name: string): boolean {
  return name.trim().length > 0
}

function formatPresetKindList(kinds: readonly StylePresetKind[]): string {
  return formatWordList(kinds)
}

function formatTargetList(targets: readonly TikzStyleTarget[]): string {
  return formatWordList(targets)
}

function formatWordList(words: readonly string[]): string {
  if (words.length === 0) {
    return ''
  }

  if (words.length === 1) {
    return words[0] ?? ''
  }

  const lastWord = words[words.length - 1] ?? ''
  const previousWords = words.slice(0, -1).join(', ')

  return `${previousWords}, or ${lastWord}`
}

const stylePresetKindOrder: readonly StylePresetKind[] = [
  'region',
  'sheet',
  'curve',
  'point',
  'label',
]

function PresetStyleFields({
  preset,
  onChange,
}: {
  preset: UserStylePreset
  onChange: (style: StylePresetStyle) => void
}) {
  switch (preset.kind) {
    case 'region':
      return (
        <>
          <EditableColorField
            label="Preset fill"
            value={preset.style.fillColor}
            onChange={(fillColor) =>
              onChange({ ...preset.style, fillColor: fillColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset fill opacity"
            value={preset.style.fillOpacity}
            onChange={(fillOpacity) => onChange({ ...preset.style, fillOpacity })}
          />
          <EditableColorField
            label="Preset stroke"
            value={preset.style.strokeColor}
            onChange={(strokeColor) =>
              onChange({ ...preset.style, strokeColor: strokeColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset stroke opacity"
            value={preset.style.strokeOpacity}
            onChange={(strokeOpacity) =>
              onChange({ ...preset.style, strokeOpacity })
            }
          />
        </>
      )
    case 'sheet':
      return (
        <>
          <EditableColorField
            label="Preset fill"
            value={preset.style.fillColor}
            onChange={(fillColor) =>
              onChange({ ...preset.style, fillColor: fillColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset fill opacity"
            value={preset.style.fillOpacity}
            onChange={(fillOpacity) => onChange({ ...preset.style, fillOpacity })}
          />
          <EditableColorField
            label="Preset stroke"
            value={preset.style.strokeColor}
            onChange={(strokeColor) =>
              onChange({ ...preset.style, strokeColor: strokeColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset stroke opacity"
            value={preset.style.strokeOpacity}
            onChange={(strokeOpacity) =>
              onChange({ ...preset.style, strokeOpacity })
            }
          />
        </>
      )
    case 'curve':
      return (
        <>
          <EditableColorField
            label="Preset stroke"
            value={preset.style.strokeColor}
            onChange={(strokeColor) =>
              onChange({ ...preset.style, strokeColor: strokeColor as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset opacity"
            value={preset.style.strokeOpacity}
            onChange={(strokeOpacity) =>
              onChange({ ...preset.style, strokeOpacity })
            }
          />
          <EditablePositiveNumberField
            label="Preset width"
            value={preset.style.lineWidth}
            onChange={(lineWidth) => onChange({ ...preset.style, lineWidth })}
          />
          <EditableSelectField<LineStyle>
            label="Preset line"
            value={preset.style.lineStyle}
            options={lineStyles}
            onChange={(lineStyle) => onChange({ ...preset.style, lineStyle })}
          />
        </>
      )
    case 'point':
      return (
        <>
          <EditableColorField
            label="Preset color"
            value={preset.style.color}
            onChange={(color) =>
              onChange({ ...preset.style, color: color as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset opacity"
            value={preset.style.opacity}
            onChange={(opacity) => onChange({ ...preset.style, opacity })}
          />
          <EditablePositiveNumberField
            label="Preset size"
            value={preset.style.size}
            onChange={(size) => onChange({ ...preset.style, size })}
          />
          <EditableSelectField<PointShape>
            label="Preset shape"
            value={preset.style.shape}
            options={pointShapes}
            onChange={(shape) => onChange({ ...preset.style, shape })}
          />
          <EditableSelectField<PointFill>
            label="Preset fill"
            value={preset.style.fill}
            options={pointFills}
            onChange={(fill) => onChange({ ...preset.style, fill })}
          />
        </>
      )
    case 'label':
      return (
        <>
          <EditableColorField
            label="Preset text"
            value={preset.style.color}
            onChange={(color) =>
              onChange({ ...preset.style, color: color as HexColor })
            }
          />
          <EditableOpacityField
            label="Preset opacity"
            value={preset.style.opacity}
            onChange={(opacity) => onChange({ ...preset.style, opacity })}
          />
          <EditablePositiveNumberField
            label="Preset font"
            value={preset.style.fontSize}
            onChange={(fontSize) => onChange({ ...preset.style, fontSize })}
          />
          <EditableSelectField<LabelAnchor>
            label="Preset anchor"
            value={preset.style.anchor}
            options={labelAnchors}
            onChange={(anchor) => onChange({ ...preset.style, anchor })}
          />
        </>
      )
  }
}
