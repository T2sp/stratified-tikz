import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  formatLayerValue,
  getLayerMetadata,
  nextUnusedLayerValue,
  normalizeLayerValue,
} from '../model/layers.ts'
import {
  parseTranslationVectorFromInputs,
  type TranslationVector,
} from '../model/translation.ts'
import type { Diagram, DiagramLayer } from '../model/types.ts'
import {
  canSubmitLayerDuplicateTarget,
  duplicateLayerTargetInput,
  resolveDuplicateLayerTarget,
  type DuplicateLayerTargetResolution,
} from './layerDuplicateTarget.ts'
import type { LayerFilter } from './layerFilter.ts'
import { committedLayerNameDraft } from './layerRenameDraft.ts'
import {
  layerButtonLabel,
  layerButtonTitle,
  layerCreationInputForLayer,
  layerFilterFromSelectValue,
  layerFilterSelectValue,
  layerPaletteRows,
  LAYER_DRAG_MIME,
  nextLayerPaletteOpenState,
  parseLayerValueInput,
  resolveLayerDropSource,
  resolveLayerDropSwap,
  selectedLayerActionTarget,
  type LayerPaletteRow,
  type LayerThumbnail,
  type LayerThumbnailMark,
} from './layerPalette.ts'

export type LayerManagerProps = {
  diagram: Diagram
  layerFilter: LayerFilter
  creationLayerInput: string
  statusMessage: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onCreationLayerChange: (layerInput: string) => void
  onLayerFilterChange: (layerFilter: LayerFilter) => void
  onRenameLayer: (layerValue: number, name: string) => void
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void
  onMergeLayer: (sourceLayerValue: number, targetLayerValue: number) => void
  onTranslateLayer: (layerValue: number, translation: TranslationVector) => void
  onSetLayerVisibility: (layerValue: number, visible: boolean) => void
  onSetLayerLock: (layerValue: number, locked: boolean) => void
  onDeleteLayer: (layerValue: number) => void
  onStatusMessage: (message: string) => void
}

export function LayerManager({
  diagram,
  layerFilter,
  creationLayerInput,
  statusMessage,
  expanded,
  onExpandedChange,
  onCreationLayerChange,
  onLayerFilterChange,
  onRenameLayer,
  onSwapLayers,
  onDuplicateLayer,
  onMergeLayer,
  onTranslateLayer,
  onSetLayerVisibility,
  onSetLayerLock,
  onDeleteLayer,
  onStatusMessage,
}: LayerManagerProps) {
  const rows = useMemo(
    () => layerPaletteRows(diagram, layerFilter, creationLayerInput),
    [creationLayerInput, diagram, layerFilter],
  )
  const layers = useMemo(() => rows.map((row) => row.layer), [rows])
  const [selectedLayerValue, setSelectedLayerValue] = useState<number | null>(
    () =>
      selectedLayerActionTarget(
        getLayerMetadata(diagram),
        null,
        creationLayerInput,
      ),
  )
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const [draggedLayerValue, setDraggedLayerValue] = useState<number | null>(null)
  const [creationLayerDraft, setCreationLayerDraft] =
    useState(creationLayerInput)
  const selectedActionLayerValue = selectedLayerActionTarget(
    layers,
    selectedLayerValue,
    creationLayerInput,
  )
  const selectedRow =
    selectedActionLayerValue === null
      ? null
      : rows.find((row) => row.layer.value === selectedActionLayerValue) ?? null
  const validLayerValues = useMemo(
    () => layers.map((layer) => layer.value),
    [layers],
  )
  const detailsId = 'preview-layer-palette'
  const titleId = 'preview-layer-palette-title'
  const actionPanelId = 'preview-layer-palette-actions'

  useEffect(() => {
    if (selectedActionLayerValue !== selectedLayerValue) {
      setSelectedLayerValue(selectedActionLayerValue)
    }
  }, [selectedActionLayerValue, selectedLayerValue])

  useEffect(() => {
    setCreationLayerDraft(creationLayerInput)
  }, [creationLayerInput])

  function selectLayerForCreation(layerValue: number): void {
    const layerInput = layerCreationInputForLayer(layerValue)

    setSelectedLayerValue(layerValue)
    onCreationLayerChange(layerInput)
    onStatusMessage(
      `New elements will be created on layer ${formatLayerValue(layerValue)}.`,
    )
  }

  function changeExpanded(nextExpanded: boolean): void {
    if (!nextExpanded) {
      setDraggedLayerValue(null)
    }

    onExpandedChange(nextExpanded)
  }

  function dropLayerOnTarget(
    draggedLayer: number | null,
    targetLayer: number,
  ): void {
    const swap = resolveLayerDropSwap(
      draggedLayer,
      targetLayer,
      validLayerValues,
    )

    setDraggedLayerValue(null)

    if (!swap.ok) {
      return
    }

    onSwapLayers(swap.leftLayerValue, swap.rightLayerValue)
  }

  function submitCreationLayerDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const creationLayer = parseLayerValueInput(creationLayerDraft)

    if (creationLayer === null) {
      onStatusMessage('Layer must be a finite number.')
      return
    }

    const layerInput = layerCreationInputForLayer(creationLayer)

    setSelectedLayerValue(creationLayer)
    onCreationLayerChange(layerInput)
    onStatusMessage(
      `New elements will be created on layer ${formatLayerValue(
        creationLayer,
      )}.`,
    )
  }

  return (
    <div
      className={[
        'preview-layer-control',
        expanded ? 'is-expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="preview-overlay-button layer-palette-toggle-button"
        aria-controls={detailsId}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? 'Close layer window'
            : `Open layer window. ${layerButtonTitle(
                creationLayerInput,
                layers,
              )}`
        }
        title={layerButtonTitle(creationLayerInput, layers)}
        onClick={() => changeExpanded(nextLayerPaletteOpenState(expanded))}
      >
        <span>Layer</span>
        <span className="layer-palette-toggle-count">
          {layerButtonLabel(creationLayerInput, layers.length)}
        </span>
      </button>

      {expanded && (
        <section
          id={detailsId}
          className="layer-palette-window"
          aria-labelledby={titleId}
        >
          <div className="layer-palette-heading">
            <div>
              <h2 id={titleId}>Layers</h2>
              <span>
                {layers.length} {layers.length === 1 ? 'layer' : 'layers'}
              </span>
            </div>
            <button
              type="button"
              className="preview-overlay-button layer-palette-close-button"
              aria-label="Close layer window"
              onClick={() => changeExpanded(false)}
            >
              Close
            </button>
          </div>

          {statusMessage !== '' && (
            <p className="layer-palette-status" role="status" aria-live="polite">
              {statusMessage}
            </p>
          )}

          <div className="layer-palette-body">
            {rows.length > 0 ? (
              <div className="layer-palette-list" role="list">
                {rows.map((row) => (
                  <LayerPaletteListRow
                    key={formatLayerValue(row.layer.value)}
                    row={row}
                    isActionTarget={
                      selectedActionLayerValue === row.layer.value
                    }
                    draggedLayerValue={draggedLayerValue}
                    validLayerValues={validLayerValues}
                    onSelectLayer={selectLayerForCreation}
                    onDragStartLayer={setDraggedLayerValue}
                    onDropLayer={dropLayerOnTarget}
                    onSetLayerVisibility={onSetLayerVisibility}
                    onSetLayerLock={onSetLayerLock}
                  />
                ))}
              </div>
            ) : (
              <p className="layer-palette-empty">No layer metadata yet.</p>
            )}

            {actionsExpanded && (
              <SelectedLayerActions
                id={actionPanelId}
                diagram={diagram}
                layer={selectedRow?.layer ?? null}
                elementCount={selectedRow?.elementCount ?? 0}
                onRenameLayer={onRenameLayer}
                onDuplicateLayer={onDuplicateLayer}
                onMergeLayer={onMergeLayer}
                onTranslateLayer={onTranslateLayer}
                onSetLayerVisibility={onSetLayerVisibility}
                onSetLayerLock={onSetLayerLock}
                onDeleteLayer={onDeleteLayer}
                onStatusMessage={onStatusMessage}
              />
            )}
          </div>

          <div className="layer-palette-footer">
            <label className="layer-palette-filter-field">
              <span>View</span>
              <select
                value={layerFilterSelectValue(layerFilter)}
                onChange={(event) =>
                  onLayerFilterChange(
                    layerFilterFromSelectValue(event.currentTarget.value),
                  )
                }
              >
                <option value="all">All</option>
                {layers.map((layer) => (
                  <option
                    key={formatLayerValue(layer.value)}
                    value={formatLayerValue(layer.value)}
                  >
                    L{formatLayerValue(layer.value)}
                  </option>
                ))}
              </select>
            </label>
            <form
              className="layer-palette-new-layer-form"
              onSubmit={submitCreationLayerDraft}
            >
              <label className="layer-palette-new-layer-field">
                <span>New</span>
                <input
                  type="number"
                  step="any"
                  value={creationLayerDraft}
                  onChange={(event) =>
                    setCreationLayerDraft(event.currentTarget.value)
                  }
                />
              </label>
              <button
                type="submit"
                className="preview-overlay-button"
                aria-label="Set new element layer"
              >
                Set
              </button>
            </form>
            <button
              type="button"
              className={[
                'preview-overlay-button',
                'layer-palette-actions-toggle',
                actionsExpanded ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-controls={actionPanelId}
              aria-expanded={actionsExpanded}
              aria-pressed={actionsExpanded}
              aria-label={
                actionsExpanded
                  ? 'Hide selected layer actions'
                  : 'Show selected layer actions'
              }
              title={
                actionsExpanded
                  ? 'Hide selected layer actions'
                  : 'Show selected layer actions'
              }
              onClick={() => setActionsExpanded((current) => !current)}
            >
              Actions
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

type LayerPaletteListRowProps = {
  row: LayerPaletteRow
  isActionTarget: boolean
  draggedLayerValue: number | null
  validLayerValues: readonly number[]
  onSelectLayer: (layerValue: number) => void
  onDragStartLayer: (layerValue: number | null) => void
  onDropLayer: (draggedLayerValue: number | null, targetLayerValue: number) => void
  onSetLayerVisibility: (layerValue: number, visible: boolean) => void
  onSetLayerLock: (layerValue: number, locked: boolean) => void
}

function LayerPaletteListRow({
  row,
  isActionTarget,
  draggedLayerValue,
  validLayerValues,
  onSelectLayer,
  onDragStartLayer,
  onDropLayer,
  onSetLayerVisibility,
  onSetLayerLock,
}: LayerPaletteListRowProps) {
  const layerKey = formatLayerValue(row.layer.value)
  const isVisible = row.layer.visible !== false
  const isLocked = row.layer.locked === true

  return (
    <section
      className={[
        'layer-palette-row',
        row.isCreationLayer ? 'is-creation-layer' : '',
        row.isFilterActive ? 'is-filter-active' : '',
        isActionTarget ? 'is-action-target' : '',
        isVisible ? '' : 'is-hidden-layer',
        isLocked ? 'is-locked-layer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
      draggable
      onDragStart={(event) => {
        const layerPayload = String(row.layer.value)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(LAYER_DRAG_MIME, layerPayload)
        event.dataTransfer.setData('text/plain', layerPayload)
        onDragStartLayer(row.layer.value)
      }}
      onDragEnd={() => onDragStartLayer(null)}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const draggedLayer = resolveLayerDropSource({
          customPayload: event.dataTransfer.getData(LAYER_DRAG_MIME),
          plainPayload: event.dataTransfer.getData('text/plain'),
          draggedLayerValue,
          validLayerValues,
        })

        onDropLayer(draggedLayer, row.layer.value)
      }}
      aria-label={`Layer ${layerKey}`}
    >
      <button
        type="button"
        className="layer-palette-row-main"
        aria-current={row.isCreationLayer ? 'true' : undefined}
        onClick={() => onSelectLayer(row.layer.value)}
      >
        <LayerThumbnailPreview thumbnail={row.thumbnail} />
        <span className="layer-palette-row-text">
          <span className="layer-palette-layer-name">{row.layer.name}</span>
          <span className="layer-palette-layer-meta">
            L{layerKey} - {row.elementCount}{' '}
            {row.elementCount === 1 ? 'element' : 'elements'}
          </span>
          <span className="layer-palette-badges">
            {row.isCreationLayer && (
              <span className="layer-palette-badge">New</span>
            )}
            {row.isFilterActive && (
              <span className="layer-palette-badge">View</span>
            )}
            {!isVisible && <span className="layer-palette-badge">Hidden</span>}
            {isLocked && <span className="layer-palette-badge">Locked</span>}
          </span>
        </span>
      </button>
      <div className="layer-palette-row-controls">
        <button
          type="button"
          className="preview-overlay-button layer-palette-state-button"
          aria-pressed={isVisible}
          aria-label={`${isVisible ? 'Hide' : 'Show'} layer ${layerKey}`}
          title={isVisible ? 'Visible' : 'Hidden'}
          onClick={() => onSetLayerVisibility(row.layer.value, !isVisible)}
        >
          {isVisible ? 'V' : 'H'}
        </button>
        <button
          type="button"
          className="preview-overlay-button layer-palette-state-button"
          aria-pressed={isLocked}
          aria-label={`${isLocked ? 'Unlock' : 'Lock'} layer ${layerKey}`}
          title={isLocked ? 'Locked' : 'Unlocked'}
          onClick={() => onSetLayerLock(row.layer.value, !isLocked)}
        >
          {isLocked ? 'Lock' : 'Open'}
        </button>
      </div>
    </section>
  )
}

function LayerThumbnailPreview({ thumbnail }: { thumbnail: LayerThumbnail }) {
  return (
    <svg
      className="layer-palette-thumbnail"
      viewBox="0 0 48 34"
      role="img"
      aria-label={`${thumbnail.totalElementCount} layer preview elements`}
      focusable="false"
    >
      <rect x="0.5" y="0.5" width="47" height="33" rx="4" />
      {thumbnail.marks.length === 0 ? (
        <path className="layer-palette-thumbnail-empty" d="M13 17h22" />
      ) : (
        thumbnail.marks.map((mark, index) => (
          <LayerThumbnailMarkShape
            key={`${mark.kind}-${index}`}
            mark={mark}
            index={index}
          />
        ))
      )}
      {thumbnail.hiddenElementCount > 0 && (
        <text x="44" y="30" textAnchor="end">
          +{thumbnail.hiddenElementCount}
        </text>
      )}
    </svg>
  )
}

function LayerThumbnailMarkShape({
  mark,
  index,
}: {
  mark: LayerThumbnailMark
  index: number
}) {
  const column = index % 4
  const row = Math.floor(index / 4)
  const x = 8 + column * 9
  const y = 8 + row * 8

  switch (mark.kind) {
    case 'region':
    case 'sheet':
      return (
        <rect
          x={x - 3}
          y={y - 3}
          width="12"
          height="7"
          rx="1.5"
          fill={mark.color}
          fillOpacity={mark.opacity}
          stroke={mark.color}
          strokeOpacity={Math.min(1, mark.opacity + 0.35)}
        />
      )
    case 'curve':
      return (
        <path
          d={`M${x - 4} ${y + 2} C ${x - 1} ${y - 5}, ${x + 3} ${y + 7}, ${
            x + 7
          } ${y}`}
          fill="none"
          stroke={mark.color}
          strokeOpacity={mark.opacity}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )
    case 'point':
      return (
        <circle
          cx={x + 2}
          cy={y}
          r="3"
          fill={mark.color}
          fillOpacity={mark.opacity}
        />
      )
    case 'label':
      return (
        <text
          x={x - 1}
          y={y + 3}
          fill={mark.color}
          fillOpacity={mark.opacity}
        >
          T
        </text>
      )
  }
}

type SelectedLayerActionsProps = {
  id: string
  diagram: Diagram
  layer: DiagramLayer | null
  elementCount: number
  onRenameLayer: (layerValue: number, name: string) => void
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void
  onMergeLayer: (sourceLayerValue: number, targetLayerValue: number) => void
  onTranslateLayer: (layerValue: number, translation: TranslationVector) => void
  onSetLayerVisibility: (layerValue: number, visible: boolean) => void
  onSetLayerLock: (layerValue: number, locked: boolean) => void
  onDeleteLayer: (layerValue: number) => void
  onStatusMessage: (message: string) => void
}

function SelectedLayerActions({
  id,
  diagram,
  layer,
  elementCount,
  onRenameLayer,
  onDuplicateLayer,
  onMergeLayer,
  onTranslateLayer,
  onSetLayerVisibility,
  onSetLayerLock,
  onDeleteLayer,
  onStatusMessage,
}: SelectedLayerActionsProps) {
  if (layer === null) {
    return (
      <p id={id} className="layer-palette-action-empty">
        No selected layer.
      </p>
    )
  }

  return (
    <SelectedLayerActionForms
      id={id}
      diagram={diagram}
      layer={layer}
      elementCount={elementCount}
      onRenameLayer={onRenameLayer}
      onDuplicateLayer={onDuplicateLayer}
      onMergeLayer={onMergeLayer}
      onTranslateLayer={onTranslateLayer}
      onSetLayerVisibility={onSetLayerVisibility}
      onSetLayerLock={onSetLayerLock}
      onDeleteLayer={onDeleteLayer}
      onStatusMessage={onStatusMessage}
    />
  )
}

type SelectedLayerActionFormsProps = Omit<SelectedLayerActionsProps, 'layer'> & {
  layer: DiagramLayer
}

function SelectedLayerActionForms({
  id,
  diagram,
  layer,
  elementCount,
  onRenameLayer,
  onDuplicateLayer,
  onMergeLayer,
  onTranslateLayer,
  onSetLayerVisibility,
  onSetLayerLock,
  onDeleteLayer,
  onStatusMessage,
}: SelectedLayerActionFormsProps) {
  const layerKey = formatLayerValue(layer.value)
  const actionLayers = useMemo(() => getLayerMetadata(diagram), [diagram])
  const defaultDuplicateTarget = nextUnusedLayerValue(diagram, layer.value)
  const defaultDuplicateTargetInput = duplicateLayerTargetInput(
    defaultDuplicateTarget,
  )
  const defaultMergeSourceInput = layerCreationInputForLayer(layer.value)
  const defaultMergeTarget = firstDifferentLayerValue(actionLayers, layer.value)
  const defaultMergeTargetInput =
    defaultMergeTarget === null
      ? ''
      : layerCreationInputForLayer(defaultMergeTarget)
  const isVisible = layer.visible !== false
  const isLocked = layer.locked === true
  const [duplicateTargetInput, setDuplicateTargetInput] = useState(
    defaultDuplicateTargetInput,
  )
  const [mergeSourceInput, setMergeSourceInput] = useState(
    defaultMergeSourceInput,
  )
  const [mergeTargetInput, setMergeTargetInput] = useState(
    defaultMergeTargetInput,
  )
  const [dxInput, setDxInput] = useState('0')
  const [dyInput, setDyInput] = useState('0')
  const [dzInput, setDzInput] = useState('0')
  const duplicateTargetResolution = resolveDuplicateLayerTarget(
    layer.value,
    duplicateTargetInput,
    defaultDuplicateTarget,
  )
  const mergeSourceLayer = parseLayerValueInput(mergeSourceInput)
  const mergeTargetLayer = parseLayerValueInput(mergeTargetInput)
  const mergeSourceExists = layerExists(actionLayers, mergeSourceLayer)
  const mergeTargetExists = layerExists(actionLayers, mergeTargetLayer)
  const canMerge =
    mergeSourceLayer !== null &&
    mergeTargetLayer !== null &&
    mergeSourceExists &&
    mergeTargetExists &&
    normalizeLayerFormValue(mergeSourceLayer) !==
      normalizeLayerFormValue(mergeTargetLayer)
  const parsedTranslation = useMemo(
    () =>
      parseTranslationVectorFromInputs(diagram, {
        dx: dxInput,
        dy: dyInput,
        dz: dzInput,
      }),
    [diagram, dxInput, dyInput, dzInput],
  )
  const translationIsZero =
    parsedTranslation.ok &&
    isZeroTranslation(parsedTranslation.preview)
  const canDuplicate = canSubmitLayerDuplicateTarget(
    layer.value,
    duplicateTargetInput,
    defaultDuplicateTarget,
  )
  const canTranslate =
    elementCount > 0 &&
    parsedTranslation.ok &&
    !translationIsZero

  useEffect(() => {
    setDuplicateTargetInput(defaultDuplicateTargetInput)
    setMergeSourceInput(defaultMergeSourceInput)
    setMergeTargetInput(defaultMergeTargetInput)
    setDxInput('0')
    setDyInput('0')
    setDzInput('0')
  }, [
    defaultDuplicateTargetInput,
    defaultMergeSourceInput,
    defaultMergeTargetInput,
    layer.value,
  ])

  return (
    <div
      id={id}
      className="layer-palette-action-panel layer-palette-action-overlay"
      aria-label={`Actions for layer ${layerKey}`}
    >
      <div className="layer-palette-action-heading">
        <h3>Layer L{layerKey}</h3>
        <span>
          {layer.name} - {elementCount}{' '}
          {elementCount === 1 ? 'element' : 'elements'}
        </span>
      </div>

      <div className="layer-manager-action-group">
        <span className="layer-manager-action-heading">Name</span>
        <LayerNameEditor
          layerValue={layer.value}
          layerKey={layerKey}
          name={layer.name}
          onRenameLayer={onRenameLayer}
        />
      </div>

      <div className="layer-manager-action-group">
        <span className="layer-manager-action-heading">State</span>
        <div
          className="layer-manager-state-controls"
          aria-label={`State for layer ${layerKey}`}
        >
          <button
            type="button"
            className="toolbar-button"
            aria-pressed={isVisible}
            aria-label={`${isVisible ? 'Hide' : 'Show'} layer ${layerKey}`}
            onClick={() => onSetLayerVisibility(layer.value, !isVisible)}
          >
            {isVisible ? 'Visible' : 'Hidden'}
          </button>
          <button
            type="button"
            className="toolbar-button"
            aria-pressed={isLocked}
            aria-label={`${isLocked ? 'Unlock' : 'Lock'} layer ${layerKey}`}
            onClick={() => onSetLayerLock(layer.value, !isLocked)}
          >
            {isLocked ? 'Locked' : 'Unlocked'}
          </button>
        </div>
      </div>

      <div className="layer-manager-action-group">
        <span className="layer-manager-action-heading">Move</span>
        <form
          className="layer-manager-translate-form"
          onSubmit={(event) =>
            submitLayerTranslate(
              event,
              layer.value,
              parsedTranslation,
              onTranslateLayer,
              onStatusMessage,
            )
          }
        >
          <label className="layer-manager-translation-field">
            <span>dx</span>
            <input
              name="dx"
              type="text"
              className="layer-manager-translation-input"
              aria-label={`Translate layer ${layerKey} by dx`}
              aria-invalid={
                !parsedTranslation.ok && parsedTranslation.error.startsWith('dx:')
              }
              value={dxInput}
              inputMode="decimal"
              onChange={(event) => setDxInput(event.currentTarget.value)}
            />
          </label>
          <label className="layer-manager-translation-field">
            <span>dy</span>
            <input
              name="dy"
              type="text"
              className="layer-manager-translation-input"
              aria-label={`Translate layer ${layerKey} by dy`}
              aria-invalid={
                !parsedTranslation.ok && parsedTranslation.error.startsWith('dy:')
              }
              value={dyInput}
              inputMode="decimal"
              onChange={(event) => setDyInput(event.currentTarget.value)}
            />
          </label>
          {diagram.ambientDimension === 3 && (
            <label className="layer-manager-translation-field">
              <span>dz</span>
              <input
                name="dz"
                type="text"
                className="layer-manager-translation-input"
                aria-label={`Translate layer ${layerKey} by dz`}
                aria-invalid={
                  !parsedTranslation.ok &&
                  parsedTranslation.error.startsWith('dz:')
                }
                value={dzInput}
                inputMode="decimal"
                onChange={(event) => setDzInput(event.currentTarget.value)}
              />
            </label>
          )}
          <button
            type="submit"
            className="toolbar-button"
            aria-label={`Translate layer ${layerKey}`}
            disabled={!canTranslate}
            title={
              elementCount === 0
                ? 'No elements on this layer.'
                : parsedTranslation.ok
                  ? 'Enter a non-zero finite translation.'
                  : parsedTranslation.error
            }
          >
            Translate
          </button>
        </form>
      </div>

      <div className="layer-manager-action-group">
        <span className="layer-manager-action-heading">Merge layers</span>
        <form
          className="layer-manager-merge-form"
          onSubmit={(event) =>
            submitLayerMerge(
              event,
              { source: mergeSourceLayer, target: mergeTargetLayer },
              { sourceExists: mergeSourceExists, targetExists: mergeTargetExists },
              onMergeLayer,
              onStatusMessage,
            )
          }
        >
          <label className="layer-manager-merge-field">
            <span>Source</span>
            <select
              name="sourceLayer"
              className="layer-manager-swap-select"
              aria-label="Source layer to merge"
              aria-invalid={mergeSourceLayer === null || !mergeSourceExists}
              value={mergeSourceInput}
              onChange={(event) =>
                setMergeSourceInput(event.currentTarget.value)
              }
            >
              {actionLayers.map((candidate) => (
                <option
                  key={`source-${formatLayerValue(candidate.value)}`}
                  value={layerCreationInputForLayer(candidate.value)}
                >
                  L{formatLayerValue(candidate.value)}
                </option>
              ))}
            </select>
          </label>
          <label className="layer-manager-merge-field">
            <span>Target</span>
            <select
              name="targetLayer"
              className="layer-manager-swap-select"
              aria-label="Target layer for merge"
              aria-invalid={mergeTargetLayer === null || !mergeTargetExists}
              value={mergeTargetInput}
              onChange={(event) =>
                setMergeTargetInput(event.currentTarget.value)
              }
            >
              {defaultMergeTarget === null && (
                <option value="" disabled>
                  None
                </option>
              )}
              {actionLayers.map((candidate) => (
                <option
                  key={`target-${formatLayerValue(candidate.value)}`}
                  value={layerCreationInputForLayer(candidate.value)}
                >
                  L{formatLayerValue(candidate.value)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="toolbar-button"
            aria-label={`Merge layer ${mergeSourceInput} into ${mergeTargetInput}`}
            disabled={!canMerge}
            title={mergeSubmitTitle(
              mergeSourceLayer,
              mergeTargetLayer,
              mergeSourceExists,
              mergeTargetExists,
            )}
          >
            Merge
          </button>
        </form>
      </div>

      <div className="layer-manager-action-group">
        <span className="layer-manager-action-heading">Copy</span>
        <form
          className="layer-manager-duplicate-form"
          onSubmit={(event) =>
            submitLayerDuplicate(
              event,
              layer.value,
              duplicateTargetResolution,
              onDuplicateLayer,
              onStatusMessage,
            )
          }
        >
          <input
            name="targetLayer"
            type="number"
            step="any"
            className="layer-manager-layer-input"
            aria-label={`Duplicate layer ${layerKey} to target layer`}
            aria-invalid={!canDuplicate}
            value={duplicateTargetInput}
            placeholder={
              defaultDuplicateTarget === null
                ? 'Choose target layer manually'
                : undefined
            }
            inputMode="decimal"
            onChange={(event) =>
              setDuplicateTargetInput(event.currentTarget.value)
            }
          />
          <button
            type="submit"
            className="toolbar-button"
            aria-label={`Duplicate layer ${layerKey}`}
            disabled={!canDuplicate}
            title={
              duplicateTargetResolution.ok
                ? undefined
                : duplicateTargetResolution.message
            }
          >
            Duplicate
          </button>
          {defaultDuplicateTarget === null &&
            duplicateTargetInput.trim().length === 0 && (
              <span className="layer-manager-inline-status">
                Choose target layer manually
              </span>
            )}
        </form>
      </div>

      <div className="layer-manager-action-group layer-manager-danger-group">
        <span className="layer-manager-action-heading">Delete</span>
        <button
          type="button"
          className="toolbar-button layer-manager-delete-button"
          aria-label={`Delete layer ${layerKey} and elements`}
          onClick={() => onDeleteLayer(layer.value)}
        >
          Delete...
        </button>
      </div>
    </div>
  )
}

type LayerNameEditorProps = {
  layerValue: number
  layerKey: string
  name: string
  onRenameLayer: (layerValue: number, name: string) => void
}

function LayerNameEditor({
  layerValue,
  layerKey,
  name,
  onRenameLayer,
}: LayerNameEditorProps) {
  const [draftName, setDraftName] = useState(name)

  useEffect(() => {
    setDraftName(name)
  }, [layerValue, name])

  function commitRename(): void {
    const committedName = committedLayerNameDraft(layerValue, draftName)

    setDraftName(committedName)

    if (committedName !== name) {
      onRenameLayer(layerValue, draftName)
    }
  }

  return (
    <form
      className="layer-manager-name-form"
      onSubmit={(event) => {
        event.preventDefault()
        commitRename()
      }}
    >
      <input
        name="layerName"
        className="layer-manager-name-input"
        aria-label={`Name for layer ${layerKey}`}
        value={draftName}
        onChange={(event) => setDraftName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraftName(name)
            event.currentTarget.blur()
          }
        }}
      />
      <button
        type="submit"
        className="toolbar-button"
        aria-label={`Rename layer ${layerKey}`}
      >
        Rename
      </button>
    </form>
  )
}

function submitLayerTranslate(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  parsed: ReturnType<typeof parseTranslationVectorFromInputs>,
  onTranslateLayer: (layerValue: number, translation: TranslationVector) => void,
  onStatusMessage: (message: string) => void,
): void {
  event.preventDefault()

  if (!parsed.ok) {
    onStatusMessage(parsed.error)
    return
  }

  if (isZeroTranslation(parsed.preview)) {
    onStatusMessage('Enter a non-zero translation vector.')
    return
  }

  onTranslateLayer(layerValue, parsed.translation)
}

function submitLayerMerge(
  event: FormEvent<HTMLFormElement>,
  layers: {
    source: number | null
    target: number | null
  },
  existence: {
    sourceExists: boolean
    targetExists: boolean
  },
  onMergeLayer: (sourceLayerValue: number, targetLayerValue: number) => void,
  onStatusMessage: (message: string) => void,
): void {
  event.preventDefault()

  if (layers.source === null || !existence.sourceExists) {
    onStatusMessage('Choose an existing source layer.')
    return
  }

  if (layers.target === null || !existence.targetExists) {
    onStatusMessage('Choose an existing target layer.')
    return
  }

  if (
    normalizeLayerValue(layers.source) === normalizeLayerValue(layers.target)
  ) {
    onStatusMessage('Choose two different layers to merge.')
    return
  }

  onMergeLayer(layers.source, layers.target)
}

function submitLayerDuplicate(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  targetLayer: DuplicateLayerTargetResolution,
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void,
  onStatusMessage: (message: string) => void,
): void {
  event.preventDefault()

  if (!targetLayer.ok) {
    onStatusMessage(targetLayer.message)
    return
  }

  onDuplicateLayer(layerValue, targetLayer.targetLayerValue)
}

function firstDifferentLayerValue(
  layers: readonly DiagramLayer[],
  layerValue: number,
): number | null {
  const sourceLayer = normalizeLayerValue(layerValue)
  const target = layers.find(
    (candidate) => normalizeLayerValue(candidate.value) !== sourceLayer,
  )

  return target?.value ?? null
}

function layerExists(
  layers: readonly DiagramLayer[],
  layerValue: number | null,
): boolean {
  if (layerValue === null) {
    return false
  }

  const normalizedLayer = normalizeLayerValue(layerValue)

  return layers.some(
    (candidate) => normalizeLayerValue(candidate.value) === normalizedLayer,
  )
}

function mergeSubmitTitle(
  sourceLayer: number | null,
  targetLayer: number | null,
  sourceExists: boolean,
  targetExists: boolean,
): string | undefined {
  if (sourceLayer === null || !sourceExists) {
    return 'Choose an existing source layer.'
  }

  if (targetLayer === null || !targetExists) {
    return 'Choose an existing target layer.'
  }

  if (normalizeLayerValue(sourceLayer) === normalizeLayerValue(targetLayer)) {
    return 'Choose two different layers.'
  }

  return undefined
}

function normalizeLayerFormValue(layerValue: number | null): number | null {
  return layerValue === null ? null : normalizeLayerValue(layerValue)
}

function isZeroTranslation(translation: {
  x: number
  y: number
  z: number
}): boolean {
  return translation.x === 0 && translation.y === 0 && translation.z === 0
}
