import savedCuratedTwoDimensionalExample from './2d-example.json' with { type: 'json' }
import savedCuratedThreeDimensionalExample from './3d-example.json' with { type: 'json' }
import { parseSavedDiagramJson } from '../model/serialization.ts'
import type { Diagram } from '../model/types.ts'

function parseBundledCuratedExample(
  name: string,
  savedExample: unknown,
): Diagram {
  const parsed = parseSavedDiagramJson(JSON.stringify(savedExample))

  if (!parsed.ok) {
    throw new Error(`Bundled ${name} example is invalid: ${parsed.error}`)
  }

  return parsed.diagram
}

export const curatedTwoDimensionalExample: Diagram =
  parseBundledCuratedExample('2D', savedCuratedTwoDimensionalExample)

export const curatedThreeDimensionalExample: Diagram =
  parseBundledCuratedExample('3D', savedCuratedThreeDimensionalExample)
