import type { AmbientDimension, Vec3 } from '../../model/types.ts'
import {
  coordinateAxesForAmbientDimension,
  parseFiniteNumber,
  type CoordinateAxis,
} from '../diagramUpdates.ts'
import { formatNumberInput } from './InspectorField.tsx'

export type CoordinateEditorProps = {
  label: string
  point: Vec3
  ambientDimension: AmbientDimension
  onCoordinateChange: (axis: CoordinateAxis, value: number) => void
}

export function CoordinateEditor({
  label,
  point,
  ambientDimension,
  onCoordinateChange,
}: CoordinateEditorProps) {
  return (
    <fieldset className="coordinate-group">
      <legend>{label}</legend>
      <div className="coordinate-grid">
        {coordinateAxesForAmbientDimension(ambientDimension).map((axis) => (
          <label key={axis} className="coordinate-input-row">
            <span>{axis}</span>
            <input
              className="inspector-input"
              type="number"
              step="any"
              value={formatNumberInput(point[axis])}
              onChange={(event) => {
                const parsedValue = parseFiniteNumber(event.currentTarget.value)

                if (parsedValue !== null) {
                  onCoordinateChange(axis, parsedValue)
                }
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
