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
}

export function LayerManager({
  diagram,
  layerFilter,
  creationLayerInput,
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
          </div>
          {layers.map((layer) => (
            <div
              key={formatLayerValue(layer.value)}
              className="layer-manager-row"
              role="row"
            >
              <span role="cell">{layer.name}</span>
              <span role="cell">{formatLayerValue(layer.value)}</span>
              <span role="cell">{counts.get(layer.value) ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function layerFilterLabel(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all'
    ? 'all'
    : formatLayerValue(layerFilter.layer)
}
