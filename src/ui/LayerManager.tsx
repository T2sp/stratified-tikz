import { useEffect, useState, type FormEvent } from 'react'
import {
  countElementsByLayer,
  formatLayerValue,
  getLayerMetadata,
  normalizeLayerValue,
  nextUnusedLayerValue,
} from '../model/layers.ts'
import type { Diagram, DiagramLayer, Vec3 } from '../model/types.ts'
import {
  canSubmitLayerDuplicateTarget,
  duplicateLayerTargetInput,
  resolveDuplicateLayerTarget,
  type DuplicateLayerTargetResolution,
} from './layerDuplicateTarget.ts'
import type { LayerFilter } from './layerFilter.ts'
import { committedLayerNameDraft } from './layerRenameDraft.ts'

export type LayerManagerProps = {
  diagram: Diagram
  layerFilter: LayerFilter
  creationLayerInput: string
  statusMessage: string
  onRenameLayer: (layerValue: number, name: string) => void
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void
  onTranslateLayer: (layerValue: number, translation: Vec3) => void
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
  onRenameLayer,
  onSwapLayers,
  onDuplicateLayer,
  onTranslateLayer,
  onSetLayerVisibility,
  onSetLayerLock,
  onDeleteLayer,
  onStatusMessage,
}: LayerManagerProps) {
  const layers = getLayerMetadata(diagram)
  const counts = countElementsByLayer(diagram)
  const creationLayer = parseOptionalLayerValue(creationLayerInput)

  return (
    <section className="layer-manager" aria-labelledby="layer-manager-heading">
      <div className="layer-manager-heading">
        <div>
          <h3 id="layer-manager-heading">Layer Manager</h3>
          <span>
            {layers.length} diagram {layers.length === 1 ? 'layer' : 'layers'}
          </span>
        </div>
        <dl className="layer-manager-state" aria-label="Layer UI state">
          <div>
            <dt>Filter</dt>
            <dd>{layerFilterLabel(layerFilter)}</dd>
          </div>
          <div>
            <dt>New</dt>
            <dd>{creationLayerInput}</dd>
          </div>
        </dl>
      </div>
      {statusMessage !== '' && (
        <p className="layer-manager-status" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {layers.length === 0 ? (
        <p className="layer-manager-empty">No layer metadata yet.</p>
      ) : (
        <div className="layer-manager-list" role="list">
          {layers.map((layer) => (
            <LayerManagerRow
              key={formatLayerValue(layer.value)}
              diagram={diagram}
              layer={layer}
              layers={layers}
              elementCount={counts.get(layer.value) ?? 0}
              isFilterActive={
                layerFilter.kind === 'layer' &&
                normalizeLayerValue(layerFilter.layer) === layer.value
              }
              isCreationLayer={creationLayer === layer.value}
              onRenameLayer={onRenameLayer}
              onSwapLayers={onSwapLayers}
              onDuplicateLayer={onDuplicateLayer}
              onTranslateLayer={onTranslateLayer}
              onSetLayerVisibility={onSetLayerVisibility}
              onSetLayerLock={onSetLayerLock}
              onDeleteLayer={onDeleteLayer}
              onStatusMessage={onStatusMessage}
            />
          ))}
        </div>
      )}
    </section>
  )
}

type LayerManagerRowProps = {
  diagram: Diagram
  layer: DiagramLayer
  layers: DiagramLayer[]
  elementCount: number
  isFilterActive: boolean
  isCreationLayer: boolean
  onRenameLayer: (layerValue: number, name: string) => void
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void
  onTranslateLayer: (layerValue: number, translation: Vec3) => void
  onSetLayerVisibility: (layerValue: number, visible: boolean) => void
  onSetLayerLock: (layerValue: number, locked: boolean) => void
  onDeleteLayer: (layerValue: number) => void
  onStatusMessage: (message: string) => void
}

function LayerManagerRow({
  diagram,
  layer,
  layers,
  elementCount,
  isFilterActive,
  isCreationLayer,
  onRenameLayer,
  onSwapLayers,
  onDuplicateLayer,
  onTranslateLayer,
  onSetLayerVisibility,
  onSetLayerLock,
  onDeleteLayer,
  onStatusMessage,
}: LayerManagerRowProps) {
  const layerKey = formatLayerValue(layer.value)
  const swappableLayers = layers.filter(
    (targetLayer) => targetLayer.value !== layer.value,
  )
  const defaultSwapTarget = swappableLayers[0]?.value
  const defaultDuplicateTarget = nextUnusedLayerValue(diagram, layer.value)
  const defaultDuplicateTargetInput = duplicateLayerTargetInput(
    defaultDuplicateTarget,
  )
  const isVisible = layer.visible !== false
  const isLocked = layer.locked === true
  const [duplicateTargetInput, setDuplicateTargetInput] = useState(
    defaultDuplicateTargetInput,
  )
  const [swapTargetInput, setSwapTargetInput] = useState(
    defaultSwapTarget === undefined ? '' : String(defaultSwapTarget),
  )
  const [dxInput, setDxInput] = useState('0')
  const [dyInput, setDyInput] = useState('0')
  const [dzInput, setDzInput] = useState('0')
  const duplicateTargetResolution = resolveDuplicateLayerTarget(
    layer.value,
    duplicateTargetInput,
    defaultDuplicateTarget,
  )
  const swapTarget = parseOptionalLayerValue(swapTargetInput)
  const dx = parseRequiredFiniteNumber(dxInput)
  const dy = parseRequiredFiniteNumber(dyInput)
  const dz =
    diagram.ambientDimension === 2 ? 0 : parseRequiredFiniteNumber(dzInput)
  const canDuplicate = canSubmitLayerDuplicateTarget(
    layer.value,
    duplicateTargetInput,
    defaultDuplicateTarget,
  )
  const canSwap = swapTarget !== null && swapTarget !== layer.value
  const canTranslate =
    elementCount > 0 &&
    dx !== null &&
    dy !== null &&
    dz !== null &&
    !isZeroTranslation({ x: dx, y: dy, z: dz })

  useEffect(() => {
    setDuplicateTargetInput(defaultDuplicateTargetInput)
  }, [defaultDuplicateTargetInput, layer.value])

  useEffect(() => {
    setSwapTargetInput(
      defaultSwapTarget === undefined ? '' : String(defaultSwapTarget),
    )
  }, [defaultSwapTarget, layer.value])

  return (
    <section
      className={[
        'layer-manager-row',
        isFilterActive || isCreationLayer ? 'is-active-layer' : '',
        isVisible ? '' : 'is-hidden-layer',
        isLocked ? 'is-locked-layer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
      aria-label={`Layer ${layerKey}`}
    >
      <div className="layer-manager-row-summary">
        <div className="layer-manager-row-title">
          <span className="layer-manager-layer-name">{layer.name}</span>
          <span className="layer-manager-layer-value">Layer {layerKey}</span>
        </div>
        <span className="layer-manager-count">
          {elementCount} {elementCount === 1 ? 'element' : 'elements'}
        </span>
        <div className="layer-manager-badges" aria-label="Layer status">
          {isFilterActive && (
            <span className="layer-manager-badge layer-manager-badge-active">
              Filter
            </span>
          )}
          {isCreationLayer && (
            <span className="layer-manager-badge layer-manager-badge-active">
              New
            </span>
          )}
          {!isVisible && (
            <span className="layer-manager-badge">Hidden</span>
          )}
          {isLocked && <span className="layer-manager-badge">Locked</span>}
        </div>
      </div>

      <div className="layer-manager-action-groups">
        <div className="layer-manager-action-group">
          <span className="layer-manager-action-heading">Safe</span>
          <LayerNameEditor
            layerValue={layer.value}
            layerKey={layerKey}
            name={layer.name}
            onRenameLayer={onRenameLayer}
          />
          <div
            className="layer-manager-state-controls"
            aria-label={`State for layer ${layerKey}`}
          >
            <button
              type="button"
              className="toolbar-button"
              aria-pressed={isVisible}
              onClick={() => onSetLayerVisibility(layer.value, !isVisible)}
            >
              {isVisible ? 'Visible' : 'Hidden'}
            </button>
            <button
              type="button"
              className="toolbar-button"
              aria-pressed={isLocked}
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
                { dx, dy, dz },
                onTranslateLayer,
                onStatusMessage,
              )
            }
          >
            <label className="layer-manager-translation-field">
              <span>dx</span>
              <input
                name="dx"
                type="number"
                step="any"
                className="layer-manager-translation-input"
                aria-label={`Translate layer ${layerKey} by dx`}
                aria-invalid={dx === null}
                value={dxInput}
                inputMode="decimal"
                onChange={(event) => setDxInput(event.currentTarget.value)}
              />
            </label>
            <label className="layer-manager-translation-field">
              <span>dy</span>
              <input
                name="dy"
                type="number"
                step="any"
                className="layer-manager-translation-input"
                aria-label={`Translate layer ${layerKey} by dy`}
                aria-invalid={dy === null}
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
                  type="number"
                  step="any"
                  className="layer-manager-translation-input"
                  aria-label={`Translate layer ${layerKey} by dz`}
                  aria-invalid={dz === null}
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
                  : 'Enter a non-zero finite translation.'
              }
            >
              Translate
            </button>
          </form>
        </div>

        <div className="layer-manager-action-group">
          <span className="layer-manager-action-heading">Copy/Reorder</span>
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
          <form
            className="layer-manager-swap-form"
            onSubmit={(event) =>
              submitLayerSwap(
                event,
                layer.value,
                swapTarget,
                onSwapLayers,
                onStatusMessage,
              )
            }
          >
            <select
              name="targetLayer"
              className="layer-manager-swap-select"
              aria-label={`Swap layer ${layerKey} with`}
              value={swapTargetInput}
              disabled={defaultSwapTarget === undefined}
              onChange={(event) => setSwapTargetInput(event.currentTarget.value)}
            >
              {swappableLayers.map((targetLayer) => (
                <option
                  key={formatLayerValue(targetLayer.value)}
                  value={String(targetLayer.value)}
                >
                  {formatLayerValue(targetLayer.value)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="toolbar-button"
              disabled={!canSwap}
            >
              Swap
            </button>
          </form>
        </div>

        <div className="layer-manager-action-group layer-manager-danger-group">
          <span className="layer-manager-action-heading">Destructive</span>
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
    </section>
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
      <button type="submit" className="toolbar-button">
        Rename
      </button>
    </form>
  )
}

function submitLayerTranslate(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  parsed: {
    dx: number | null
    dy: number | null
    dz: number | null
  },
  onTranslateLayer: (layerValue: number, translation: Vec3) => void,
  onStatusMessage: (message: string) => void,
): void {
  event.preventDefault()

  const { dx, dy, dz } = parsed

  if (dx === null || dy === null || dz === null) {
    onStatusMessage('Enter a finite translation vector.')
    return
  }

  if (isZeroTranslation({ x: dx, y: dy, z: dz })) {
    onStatusMessage('Enter a non-zero translation vector.')
    return
  }

  onTranslateLayer(layerValue, { x: dx, y: dy, z: dz })
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

function submitLayerSwap(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  targetLayer: number | null,
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void,
  onStatusMessage: (message: string) => void,
): void {
  event.preventDefault()

  if (targetLayer === null) {
    onStatusMessage('Choose a layer to swap with.')
    return
  }

  onSwapLayers(layerValue, targetLayer)
}

function parseRequiredFiniteNumber(value: string): number | null {
  if (value.trim().length === 0) {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function parseOptionalLayerValue(value: string): number | null {
  if (value.trim().length === 0) {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? normalizeLayerValue(number) : null
}

function isZeroTranslation(translation: Vec3): boolean {
  return translation.x === 0 && translation.y === 0 && translation.z === 0
}

function layerFilterLabel(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all'
    ? 'all'
    : formatLayerValue(layerFilter.layer)
}
