import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
} from './emptyDiagrams.ts'
import {
  curatedThreeDimensionalExample,
  curatedTwoDimensionalExample,
} from './curatedExamples.ts'
import { braidingCrossingsExample } from './referenceExamples.ts'
import { workPlaneLocalSymbolicExample } from './workPlaneLocalSymbolicExample.ts'
import { coordinateAnchorExample } from './coordinateAnchorExample.ts'
import type { AmbientDimension, Diagram } from '../model/types.ts'

export type ExampleId =
  | 'empty2d'
  | 'empty3d'
  | '2d'
  | '3d'
  | 'braiding'
  | 'localSymbolic3d'
  | 'coordinateAnchors'

export type ExampleOption = {
  id: ExampleId
  name: string
  summary: string
  diagram: Diagram
}

export const defaultExampleId: ExampleId = 'empty2d'

export const exampleOptions: readonly ExampleOption[] = [
  {
    id: 'empty2d',
    name: 'Empty 2D',
    summary: 'blank 2D canvas',
    diagram: emptyTwoDimensionalDiagram,
  },
  {
    id: 'empty3d',
    name: 'Empty 3D',
    summary: 'blank 3D canvas',
    diagram: emptyThreeDimensionalDiagram,
  },
  {
    id: '2d',
    name: '2D example',
    summary: 'curated 2D diagram loaded from bundled JSON',
    diagram: curatedTwoDimensionalExample,
  },
  {
    id: '3d',
    name: '3D example',
    summary: 'curated 3D diagram loaded from bundled JSON',
    diagram: curatedThreeDimensionalExample,
  },
  {
    id: 'braiding',
    name: 'braiding',
    summary: 'braiding and anti-braiding crossing states',
    diagram: braidingCrossingsExample,
  },
  {
    id: 'localSymbolic3d',
    name: '3D local symbolic',
    summary: 'work-plane-local symbolic point and arrowed path',
    diagram: workPlaneLocalSymbolicExample,
  },
  {
    id: 'coordinateAnchors',
    name: 'Coordinate anchors',
    summary: 'global anchors referenced by a path and local symbolic label',
    diagram: coordinateAnchorExample,
  },
]

export function exampleIdForAmbientDimension(
  ambientDimension: AmbientDimension,
): ExampleId {
  return ambientDimension === 2 ? 'empty2d' : 'empty3d'
}

export function getExampleOption(exampleId: ExampleId): ExampleOption {
  return (
    exampleOptions.find((example) => example.id === exampleId) ??
    exampleOptions[0]
  )
}
