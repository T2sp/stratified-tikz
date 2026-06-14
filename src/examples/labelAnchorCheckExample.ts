import type { CurveStyle, Diagram, LabelAnchor, Vec3 } from '../model/types'

const axisStyle: CurveStyle = {
  kind: 'curveStyle',
  strokeColor: '#425466',
  strokeOpacity: 0.85,
  lineWidth: 1,
  lineStyle: 'solid',
}

const guideStyle = {
  kind: 'pointStyle',
  color: '#C44536',
  opacity: 1,
  shape: 'circle',
  fill: 'filled',
  size: 2.5,
} as const

const labelStyle = {
  kind: 'labelStyle',
  color: '#1A1A1A',
  opacity: 1,
  fontSize: 10,
} as const

const anchorChecks: {
  id: string
  text: string
  anchor: LabelAnchor
  position: Vec3
}[] = [
  {
    id: 'west',
    text: 'west extends right',
    anchor: 'west',
    position: { x: -1.45, y: -0.75, z: 0 },
  },
  {
    id: 'east',
    text: 'east extends left',
    anchor: 'east',
    position: { x: 1.45, y: -0.75, z: 0 },
  },
  {
    id: 'north',
    text: 'north extends down',
    anchor: 'north',
    position: { x: 0, y: 0.9, z: 0 },
  },
  {
    id: 'south',
    text: 'south extends up',
    anchor: 'south',
    position: { x: 0, y: -0.9, z: 0 },
  },
  {
    id: 'northWest',
    text: 'north west',
    anchor: 'north west',
    position: { x: -1.45, y: 0.35, z: 0 },
  },
  {
    id: 'northEast',
    text: 'north east',
    anchor: 'north east',
    position: { x: 1.45, y: 0.35, z: 0 },
  },
]

export const labelAnchorCheckExample: Diagram = {
  version: 1,
  ambientDimension: 2,
  camera: {
    mode: '2d',
    scale: 92,
    origin: { x: 260, y: 180 },
  },
  strata: [
    {
      id: 'xAxis',
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      name: '+x axis',
      style: axisStyle,
      points: [
        { x: -1.8, y: 0, z: 0 },
        { x: 1.8, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      id: 'yAxis',
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      name: '+y axis',
      style: axisStyle,
      points: [
        { x: 0, y: -1.15, z: 0 },
        { x: 0, y: 1.15, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
    ...anchorChecks.map((check, index) => ({
      id: `${check.id}Guide`,
      codim: 2 as const,
      geometricKind: 'point' as const,
      name: `${check.text} guide`,
      style: guideStyle,
      position: check.position,
      layer: 30 + index,
    })),
  ],
  labels: [
    {
      id: 'positiveXLabel',
      geometricKind: 'label',
      name: '+x label',
      text: '+x',
      position: { x: 1.9, y: 0, z: 0 },
      style: {
        ...labelStyle,
        anchor: 'west',
      },
      layer: 10,
    },
    {
      id: 'positiveYLabel',
      geometricKind: 'label',
      name: '+y label',
      text: '+y',
      position: { x: 0, y: 1.25, z: 0 },
      style: {
        ...labelStyle,
        anchor: 'south',
      },
      layer: 11,
    },
    ...anchorChecks.map((check, index) => ({
      id: `${check.id}Label`,
      geometricKind: 'label' as const,
      name: `${check.text} label`,
      text: check.text,
      position: check.position,
      style: {
        ...labelStyle,
        anchor: check.anchor,
      },
      layer: 20 + index,
    })),
  ],
}
