import savedCounitExample from './counit-example.json' with { type: 'json' }
import { parseSavedDiagramJson } from '../model/serialization.ts'
import type { Diagram } from '../model/types'

const parsedCounitExample = parseSavedDiagramJson(
  JSON.stringify(savedCounitExample),
)

if (!parsedCounitExample.ok) {
  throw new Error(`Bundled 3D example is invalid: ${parsedCounitExample.error}`)
}

export const threeDimensionalExample: Diagram = parsedCounitExample.diagram
