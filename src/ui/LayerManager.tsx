import type { FormEvent } from 'react'
import {
  countElementsByLayer,
  formatLayerValue,
  getLayerMetadata,
} from '../model/layers.ts'
import type { Diagram } from '../model/types.ts'
import type { LayerFilter } from './layerFilter.ts'

export type LayerManagerProps = {
  diagram: Diagram
  layerFilter: LayerFilter
  creationLayerInput: string
  onRenameLayer: (layerValue: number, name: string) => void
  onSwapLayers: (leftLayerValue: number, rightLayerValue: number) => void
}

export function LayerManager({
  diagram,
  layerFilter,
  creationLayerInput,
  onRenameLayer,
  onSwapLayers,
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
            <span role="columnheader">Swap</span>
          </div>
          {layers.map((layer) => {
            const layerKey = formatLayerValue(layer.value)
            const swappableLayers = layers.filter(
              (targetLayer) => targetLayer.value !== layer.value,
            )
            const defaultSwapTarget = swappableLayers[0]?.value

            return (
              <div key={layerKey} className="layer-manager-row" role="row">
                <form
                  className="layer-manager-name-form"
                  role="cell"
                  onSubmit={(event) =>
                    submitLayerRename(event, layer.value, onRenameLayer)
                  }
                >
                  <input
                    key={`${layerKey}:${layer.name}`}
                    name="layerName"
                    className="layer-manager-name-input"
                    aria-label={`Name for layer ${layerKey}`}
                    defaultValue={layer.name}
                  />
                  <button type="submit" className="toolbar-button">
                    Rename
                  </button>
                </form>
                <span role="cell">{layerKey}</span>
                <span role="cell">{counts.get(layer.value) ?? 0}</span>
                <form
                  className="layer-manager-swap-form"
                  role="cell"
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
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function submitLayerRename(
  event: FormEvent<HTMLFormElement>,
  layerValue: number,
  onRenameLayer: (layerValue: number, name: string) => void,
): void {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const rawName = formData.get('layerName')

  onRenameLayer(layerValue, typeof rawName === 'string' ? rawName : '')
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

function layerFilterLabel(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all'
    ? 'all'
    : formatLayerValue(layerFilter.layer)
}
