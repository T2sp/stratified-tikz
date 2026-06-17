import { useEffect, useState, type FormEvent } from 'react'
import {
  countElementsByLayer,
  formatLayerValue,
  getLayerMetadata,
  nextUnusedLayerValue,
} from '../model/layers.ts'
import type { Diagram, Vec3 } from '../model/types.ts'
import type { LayerFilter } from './layerFilter.ts'
import { committedLayerNameDraft } from './layerRenameDraft.ts'

export type LayerManagerProps = {
  diagram: Diagram
  layerFilter: LayerFilter
  creationLayerInput: string
  onRenameLayer: (layerValue: number, name: string) => void
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void
  onTranslateLayer: (layerValue: number, translation: Vec3) => void
  onSetLayerVisibility: (layerValue: number, visible: boolean) => void
  onSetLayerLock: (layerValue: number, locked: boolean) => void
  onDeleteLayer: (layerValue: number) => void
}

export function LayerManager({
  diagram,
  layerFilter,
  creationLayerInput,
  onRenameLayer,
  onSwapLayers,
  onDuplicateLayer,
  onTranslateLayer,
  onSetLayerVisibility,
  onSetLayerLock,
  onDeleteLayer,
}: LayerManagerProps) {
  const layers = getLayerMetadata(diagram)
  const counts = countElementsByLayer(diagram)

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

      {layers.length === 0 ? (
        <p className="layer-manager-empty">No layer metadata yet.</p>
      ) : (
        <div className="layer-manager-list" role="table">
          <div className="layer-manager-row layer-manager-header" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Value</span>
            <span role="columnheader">Elements</span>
            <span role="columnheader">State</span>
            <span role="columnheader">Operations</span>
          </div>
          {layers.map((layer) => {
            const layerKey = formatLayerValue(layer.value)
            const swappableLayers = layers.filter(
              (targetLayer) => targetLayer.value !== layer.value,
            )
            const defaultSwapTarget = swappableLayers[0]?.value
            const defaultDuplicateTarget = nextUnusedLayerValue(
              diagram,
              layer.value,
            )
            const isVisible = layer.visible !== false
            const isLocked = layer.locked === true

            return (
              <div key={layerKey} className="layer-manager-row" role="row">
                <LayerNameEditor
                  layerValue={layer.value}
                  layerKey={layerKey}
                  name={layer.name}
                  onRenameLayer={onRenameLayer}
                />
                <span role="cell">{layerKey}</span>
                <span role="cell">{counts.get(layer.value) ?? 0}</span>
                <div
                  className="layer-manager-state-controls"
                  role="cell"
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
                <div className="layer-manager-actions" role="cell">
                  <form
                    className="layer-manager-translate-form"
                    onSubmit={(event) =>
                      submitLayerTranslate(
                        event,
                        layer.value,
                        diagram.ambientDimension,
                        onTranslateLayer,
                      )
                    }
                  >
                    <label className="layer-manager-translation-field">
                      <span>dx</span>
                      <input
                        name="dx"
                        className="layer-manager-translation-input"
                        aria-label={`Translate layer ${layerKey} by dx`}
                        defaultValue="0"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="layer-manager-translation-field">
                      <span>dy</span>
                      <input
                        name="dy"
                        className="layer-manager-translation-input"
                        aria-label={`Translate layer ${layerKey} by dy`}
                        defaultValue="0"
                        inputMode="decimal"
                      />
                    </label>
                    {diagram.ambientDimension === 3 && (
                      <label className="layer-manager-translation-field">
                        <span>dz</span>
                        <input
                          name="dz"
                          className="layer-manager-translation-input"
                          aria-label={`Translate layer ${layerKey} by dz`}
                          defaultValue="0"
                          inputMode="decimal"
                        />
                      </label>
                    )}
                    <button
                      type="submit"
                      className="toolbar-button"
                      aria-label={`Translate layer ${layerKey}`}
                    >
                      Translate layer
                    </button>
                  </form>
                  <form
                    className="layer-manager-duplicate-form"
                    onSubmit={(event) =>
                      submitLayerDuplicate(event, layer.value, onDuplicateLayer)
                    }
                  >
                    <input
                      key={`${layerKey}:duplicate:${defaultDuplicateTarget}`}
                      name="targetLayer"
                      className="layer-manager-layer-input"
                      aria-label={`Duplicate layer ${layerKey} to target layer`}
                      defaultValue={String(defaultDuplicateTarget)}
                      inputMode="decimal"
                    />
                    <button
                      type="submit"
                      className="toolbar-button"
                      aria-label={`Duplicate layer ${layerKey}`}
                    >
                      Duplicate
                    </button>
                  </form>
                  <form
                    className="layer-manager-swap-form"
                    onSubmit={(event) =>
                      submitLayerSwap(event, layer.value, onSwapLayers)
                    }
                  >
                    <select
                      key={`${layerKey}:swap:${layers.length}`}
                      name="targetLayer"
                      className="layer-manager-swap-select"
                      aria-label={`Swap layer ${layerKey} with`}
                      defaultValue={
                        defaultSwapTarget === undefined
                          ? ''
                          : String(defaultSwapTarget)
                      }
                      disabled={defaultSwapTarget === undefined}
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
                      disabled={defaultSwapTarget === undefined}
                    >
                      Swap
                    </button>
                  </form>
                  <button
                    type="button"
                    className="toolbar-button layer-manager-delete-button"
                    aria-label={`Delete layer ${layerKey} and elements`}
                    onClick={() => onDeleteLayer(layer.value)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
      role="cell"
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
  ambientDimension: Diagram['ambientDimension'],
  onTranslateLayer: (layerValue: number, translation: Vec3) => void,
): void {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const dx = parseFiniteFormNumber(formData.get('dx'))
  const dy = parseFiniteFormNumber(formData.get('dy'))
  const dz =
    ambientDimension === 2 ? 0 : parseFiniteFormNumber(formData.get('dz'))

  if (dx === null || dy === null || dz === null) {
    return
  }

  onTranslateLayer(layerValue, { x: dx, y: dy, z: dz })
}

function submitLayerDuplicate(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  onDuplicateLayer: (sourceLayerValue: number, targetLayerValue?: number) => void,
): void {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const rawTargetLayer = formData.get('targetLayer')

  if (typeof rawTargetLayer !== 'string' || rawTargetLayer.trim().length === 0) {
    onDuplicateLayer(layerValue)
    return
  }

  const targetLayer = Number(rawTargetLayer)

  if (!Number.isFinite(targetLayer)) {
    return
  }

  onDuplicateLayer(layerValue, targetLayer)
}

function submitLayerSwap(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void,
): void {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const rawTargetLayer = formData.get('targetLayer')
  const targetLayer =
    typeof rawTargetLayer === 'string' ? Number(rawTargetLayer) : Number.NaN

  if (!Number.isFinite(targetLayer)) {
    return
  }

  onSwapLayers(layerValue, targetLayer)
}

function parseFiniteFormNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function layerFilterLabel(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all'
    ? 'all'
    : formatLayerValue(layerFilter.layer)
}
