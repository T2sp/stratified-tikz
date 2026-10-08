// Independent PGF inventory: neither the production solver nor its support map is imported.
const shapes = ['circle', 'rectangle', 'ellipse', 'diamond', 'regular polygon', 'star', 'trapezium',
  'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder', 'square', 'triangle']
const common = ['text', 'center', 'base', 'mid', 'north', 'north east', 'east', 'south east', 'south', 'south west', 'west', 'north west']
const sideText = ['base east', 'base west', 'mid east', 'mid west']
const specific = {
  trapezium: ['bottom left corner', 'top left corner', 'top right corner', 'bottom right corner', 'left side', 'right side', 'top side', 'bottom side'],
  'isosceles triangle': ['apex', 'left corner', 'right corner', 'left side', 'right side', 'lower side'],
  kite: ['upper vertex', 'lower vertex', 'left vertex', 'right vertex', 'upper left side', 'lower left side', 'upper right side', 'lower right side'],
  dart: ['tip', 'left tail', 'right tail', 'tail center', 'left side', 'right side'],
  semicircle: ['apex', 'arc start', 'arc end', 'chord center'],
  'circular sector': ['arc start', 'arc end', 'sector center', 'arc center'],
  cylinder: ['shape center', 'before top', 'top', 'after top', 'before bottom', 'bottom', 'after bottom'],
}
function anchors(shape, parameters = {}) {
  const names = [...common]
  if (['circle', 'rectangle', 'ellipse', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'cylinder'].includes(shape)) names.push(...sideText)
  if (['regular polygon', 'square', 'triangle'].includes(shape)) {
    const count = shape === 'square' ? 4 : shape === 'triangle' ? 3 : parameters.regularPolygonSides ?? 5
    for (let n = 1; n <= count; n++) names.push(`corner ${n}`, `side ${n}`)
  } else if (shape === 'star') {
    for (let n = 1; n <= (parameters.starPoints ?? 5); n++) names.push(`outer point ${n}`, `inner point ${n}`)
  } else names.push(...specific[shape] ?? [])
  return [...names, '0', '13', '45', '90', '181', '270', '315', '-30', '450']
}
const profiles = {
  unequal: { innerXSep: 3, innerYSep: .5, outerXSep: 2, outerYSep: 5 },
  zero: { innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 },
  negative: { innerXSep: -2, innerYSep: -.5, outerXSep: -.25, outerYSep: -.5 },
  minima: { minimumWidth: 65, minimumHeight: 80, outerXSep: 4, outerYSep: 2 },
  'width-minimum': { minimumWidth: 70, minimumHeight: 1, innerXSep: .25, innerYSep: 3, outerXSep: 1, outerYSep: 4 },
  'height-minimum': { minimumWidth: 1, minimumHeight: 65, innerXSep: 3, innerYSep: .25, outerXSep: 4, outerYSep: 1 },
  'border-rotate': { parameters: { borderRotate: 90 }, options: '/pgf/shape border rotate=90', outerXSep: 2, outerYSep: 5 },
  'incircle-rotate': { parameters: { borderRotate: 37, borderUsesIncircle: true }, options: '/pgf/shape border rotate=37,/pgf/shape border uses incircle=true', outerXSep: 2, outerYSep: 5 },
}
function base(shape, id, values = {}) {
  const entry = { id: `${shape.replaceAll(' ', '-')}-${id}`, shape, pgfShape: shape,
    body: { width: 20, height: 8, depth: 3 }, innerXSep: 1.5, innerYSep: 1.5, outerXSep: 0, outerYSep: 0,
    minimumWidth: 1, minimumHeight: 1, lineWidth: .4, parameters: {}, options: '', ...values }
  if (shape === 'square' || shape === 'triangle') {
    entry.pgfShape = 'regular polygon'
    entry.options += `,/pgf/regular polygon sides=${shape === 'square' ? 4 : 3}`
  }
  entry.anchors = anchors(shape, entry.parameters)
  return entry
}
export const pointAnchorReferenceCases = shapes.flatMap((shape) => Object.entries(profiles).map(([id, values]) => base(shape, id, values)))
// PGF cylinder's asin fitting rejects negative inner ysep for a content-dominant
// radius. Retain a PGF-valid negative xsep case; the singular y branch is diagnosed.
const cylinderNegative = pointAnchorReferenceCases.find(({ id }) => id === 'cylinder-negative')
cylinderNegative.innerYSep = .5
const extra = [
  ...['circle', 'rectangle', 'ellipse'].map((shape) => [shape, 'empty-zero', {}, '', { body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 }]),
  ['ellipse', 'zero-x-axis', {}, '', { body: { width: 0, height: 8, depth: 3 }, innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 }],
  ['ellipse', 'zero-y-axis', {}, '', { body: { width: 20, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0, outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 }],
  ...['circle', 'rectangle', 'ellipse', 'diamond'].map((shape) => [shape, 'inverted-outer', {}, '', { outerXSep: -30, outerYSep: -30 }]),
  ...['regular polygon', 'star', 'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'cylinder', 'square', 'triangle']
    .map((shape) => [shape, 'inverted-outer', {}, '', { outerXSep: -30, outerYSep: -30 }]),
  ['circular sector', 'inverted-outer', {}, '', { outerXSep: -30, outerYSep: -30 }],
  ...['trapezium', 'kite'].map((shape) => [shape, 'inverted-incircle-rotate', { borderRotate: 37, borderUsesIncircle: true },
    '/pgf/shape border rotate=37,/pgf/shape border uses incircle=true', { outerXSep: -30, outerYSep: -30 }]),
  ...shapes.filter((shape) => shape !== 'cylinder').map((shape) => [shape, 'deep-negative-inner', {}, '', { innerXSep: -30, innerYSep: -30 }]),
  ['circle', 'numeric-upper-domain', {}, '', {}],
  ['circle', 'zero-anchor-radius', {}, '', { minimumWidth: 40, outerXSep: -20, outerYSep: -20 }],
  ['rectangle', 'negative-minima', {}, '', { minimumWidth: -2, minimumHeight: -5 }],
  ['ellipse', 'deep-text', {}, '', { body: { width: 20, height: 3, depth: 9 }, outerXSep: 3, outerYSep: 1 }],
  ['diamond', 'aspect-minima', { aspect: .6 }, '/pgf/aspect=.6', { minimumWidth: 65, minimumHeight: 50, outerXSep: 3, outerYSep: 5 }],
  ['regular polygon', 'heptagon', { regularPolygonSides: 7 }, '/pgf/regular polygon sides=7', { outerXSep: 4, outerYSep: 2 }],
  ['star', 'height-mode-minimum', { starPointHeight: 8, starPointMode: 'height', starPoints: 7 }, '/pgf/star point height=8pt,/pgf/star points=7', { minimumWidth: 90, outerXSep: 4, outerYSep: 2 }],
  ['star', 'ratio-minimum', { starPointRatio: 2.2 }, '/pgf/star point ratio=2.2', { minimumWidth: 90, outerXSep: 2, outerYSep: 4 }],
  ['trapezium', 'angles', { trapeziumLeftAngle: 110, trapeziumRightAngle: 50 }, '/pgf/trapezium left angle=110,/pgf/trapezium right angle=50', { outerXSep: 2, outerYSep: 4 }],
  ['trapezium', 'stretch', { trapeziumStretches: true }, '/pgf/trapezium stretches=true', { minimumWidth: 70, minimumHeight: 55, outerXSep: 2, outerYSep: 4 }],
  ['trapezium', 'stretch-body', { trapeziumStretchesBody: true }, '/pgf/trapezium stretches body=true', { minimumWidth: 70, minimumHeight: 55, outerXSep: 2, outerYSep: 4 }],
  ['isosceles triangle', 'stretch', { isoscelesTriangleStretches: true }, '/pgf/isosceles triangle stretches=true', { minimumWidth: 70, minimumHeight: 55, outerXSep: 2, outerYSep: 4 }],
  ['kite', 'angles', { kiteUpperVertexAngle: 100, kiteLowerVertexAngle: 75 }, '/pgf/kite upper vertex angle=100,/pgf/kite lower vertex angle=75', { outerXSep: 2, outerYSep: 4 }],
  ['dart', 'angles', { dartTipAngle: 60, dartTailAngle: 120 }, '/pgf/dart tip angle=60,/pgf/dart tail angle=120', { outerXSep: 2, outerYSep: 4 }],
  ['circular sector', 'obtuse', { circularSectorAngle: 150 }, '/pgf/circular sector angle=150', { outerXSep: 2, outerYSep: 4 }],
  ['cylinder', 'aspect-minima', { aspect: .4 }, '/pgf/aspect=.4', { minimumWidth: 70, minimumHeight: 60, outerXSep: 2, outerYSep: 5 }],
]
for (const [shape, id, parameters, options, values] of extra) pointAnchorReferenceCases.push(base(shape, id, { parameters, options, ...values }))
pointAnchorReferenceCases.find(({ id }) => id === 'rectangle-inverted-outer').anchors.push('13.7', '-30.8')
// Independent individual compilations demonstrate PGF's asin-domain error for
// these two sector directions; all remaining anchors compile successfully.
pointAnchorReferenceCases.find(({ id }) => id === 'circular-sector-inverted-outer').anchors =
  anchors('circular sector').filter((anchor) => !['45', 'south west'].includes(anchor))
pointAnchorReferenceCases.find(({ id }) => id === 'kite-deep-negative-inner').anchors = anchors('kite').filter((anchor) => anchor !== '-30')
pointAnchorReferenceCases.find(({ id }) => id === 'circle-numeric-upper-domain').anchors.push('16383', '16383.99998', '-16383.99998',
  '16383.99999', '16383.999999', '16383.99999999999999', '+16383.999999', '+16383.99999999999999',
  '13.999999', '+13.999999', '-13.999999', '-0.99999237060546875', '+0.999999', '-.999999')

export const pointAnchorFailureCases = [
  ...['45', 'south west'].map((anchor) => ({ ...base('circular sector', `singular-${anchor.replaceAll(' ', '-')}`,
    { outerXSep: -30, outerYSep: -30 }), anchors: [anchor], expectedError: 'pgfmath@acos@', diagnostic: 'asin domain' })),
  { ...base('diamond', 'singular-zero-numeric', { body: { width: 0, height: 0, depth: 0 }, innerXSep: 0, innerYSep: 0,
    outerXSep: 0, outerYSep: 0, minimumWidth: 0, minimumHeight: 0 }), anchors: ['45'], expectedError: '1/0.0', diagnostic: 'singular' },
  { ...base('cylinder', 'singular-negative-y', { innerYSep: -.5 }), anchors: ['center'], expectedError: 'pgfmath@acos@', diagnostic: 'asin domain' },
  { ...base('kite', 'singular-deep-negative-ray', { innerXSep: -30, innerYSep: -30 }), anchors: ['-30'], expectedError: 'Dimension too large.', diagnostic: 'dimensional range' },
  ...['16384', '-16384', '+16384', '-16383.999999'].map((anchor) => ({ ...base('circle', `singular-numeric-${anchor.startsWith('-') ? 'negative-' : anchor.startsWith('+') ? 'positive-' : ''}${anchor.replace('-', '').replace('+', '').replace('.', '-')}`),
    anchors: [anchor], expectedError: 'Dimension too large.', diagnostic: 'dimensional range' })),
  ...['.999999', '+.999999'].map((anchor) => ({ ...base('circle', `singular-numeric-${anchor.startsWith('+') ? 'positive-' : ''}missing-integer`),
    anchors: [anchor], expectedError: 'Missing number', diagnostic: 'integer part' })),
]
