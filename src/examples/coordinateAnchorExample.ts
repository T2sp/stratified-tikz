import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../model/constructors.ts'
import { createCoordinateAnchor } from '../model/coordinateAnchors.ts'
import { coordinateReferenceVec3ForAnchorId } from '../model/coordinateReferences.ts'
import type {
  CoordinateAnchor,
  CoordinateAnchorPosition,
  Diagram,
  SymbolicVariable,
  Vec3,
} from '../model/types.ts'

const anchorVariable: SymbolicVariable = {
  id: 'var-R',
  name: 'R',
  macroName: 'R',
  expression: '1.5',
  previewValue: 1.5,
}

export const coordinateAnchorExample: Diagram = createCoordinateAnchorExample()

function createCoordinateAnchorExample(): Diagram {
  let diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.variables = [anchorVariable]

  const anchors = [
    createAnchor(diagram, 'coord-a', 'Anchor A', 'A', globalAnchorPosition(0, 0, 0)),
  ]
  diagram = {
    ...diagram,
    coordinateAnchors: anchors,
  }

  anchors.push(
    createAnchor(diagram, 'coord-b', 'Anchor B', 'B', globalAnchorPosition(2, 0, 1)),
  )
  diagram = {
    ...diagram,
    coordinateAnchors: anchors,
  }

  anchors.push(
    createAnchor(diagram, 'coord-c', 'Anchor C', 'C', globalAnchorPosition(3, 1, 1)),
  )
  diagram = {
    ...diagram,
    coordinateAnchors: anchors,
  }

  anchors.push(
    createAnchor(
      diagram,
      'coord-local',
      'Local anchor',
      'LocalAnchor',
      workPlaneLocalAnchorPosition(),
    ),
  )
  diagram = {
    ...diagram,
    coordinateAnchors: anchors,
  }

  const start = requiredCoordinateReference(diagram, 'coord-a')
  const end = requiredCoordinateReference(diagram, 'coord-b')
  const groupEnd = requiredCoordinateReference(diagram, 'coord-c')
  const labelPosition = requiredCoordinateReference(diagram, 'coord-local')
  const visiblePointPosition = requiredCoordinateReference(diagram, 'coord-b')

  diagram.strata.push(
    createCurveStratum({
      ambientDimension: 3,
      id: 'coordinate-anchor-reference-path',
      name: 'Referenced anchor path',
      points: [start, end],
      layer: 0,
    }),
    createCurveStratum({
      ambientDimension: 3,
      id: 'coordinate-anchor-group-reference-path',
      name: 'Group reference path',
      points: [end, groupEnd],
      layer: 0,
    }),
    createPointStratum({
      ambientDimension: 3,
      id: 'coordinate-anchor-visible-point',
      name: 'Visible point at anchor B',
      position: visiblePointPosition,
      layer: 1,
    }),
  )
  diagram.labels.push(
    createTextLabel({
      ambientDimension: 3,
      id: 'coordinate-anchor-reference-label',
      name: 'Coordinate reference label',
      text: '$L$',
      position: labelPosition,
      layer: 1,
    }),
  )

  return diagram
}

function createAnchor(
  diagram: Diagram,
  id: string,
  name: string,
  tikzName: string,
  position: CoordinateAnchorPosition,
): CoordinateAnchor {
  return createCoordinateAnchor(diagram, {
    id,
    name,
    tikzName,
    position,
  })
}

function globalAnchorPosition(
  x: number,
  y: number,
  z: number,
): CoordinateAnchorPosition {
  return {
    kind: 'global',
    value: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
    },
  }
}

function workPlaneLocalAnchorPosition(): CoordinateAnchorPosition {
  return {
    kind: 'workPlaneLocal',
    frame: {
      origin: { x: -0.5, y: 0.5, z: -0.4 },
      u: { x: 1, y: 0, z: 0 },
      v: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: -1, z: 0 },
    },
    local: {
      a: { kind: 'symbolic', expression: 'R/2', previewValue: 0.75 },
      b: { kind: 'numeric', value: 1 },
    },
    preview: { x: 0.25, y: 0.5, z: 0.6 },
  }
}

function requiredCoordinateReference(diagram: Diagram, coordinateId: string): Vec3 {
  const point = coordinateReferenceVec3ForAnchorId(diagram, coordinateId)

  if (point === null) {
    throw new Error(`Missing coordinate anchor ${coordinateId}.`)
  }

  return point
}
