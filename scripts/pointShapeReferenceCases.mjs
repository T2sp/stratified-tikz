// Finite, independently specified PGF fixed-box inventory. No solver imports.
export const geometricReferenceShapes = ['ellipse', 'diamond', 'regular polygon', 'star',
  'trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']
const boxes = { empty: [0, 0, 0], wide: [48, 7, 2], tall: [8, 28, 5], asymmetric: [20, 8, 3] }
const slug = (shape) => shape.replaceAll(' ', '-')
const base = (shape, id, box = boxes.asymmetric) => ({ id: `${slug(shape)}-${id}`, shape,
  body: { width: box[0], height: box[1], depth: box[2] }, innerXSep: 1.5, innerYSep: 1.5,
  outerXSep: 0, outerYSep: 0, minimumWidth: 1, minimumHeight: 1, lineWidth: .4,
  parameters: {}, options: '' })
export const pointShapeReferenceCases = geometricReferenceShapes.flatMap((shape) =>
  Object.entries(boxes).map(([id, box]) => base(shape, id, box)))
function add(shape, id, parameters, options, layout = {}) {
  pointShapeReferenceCases.push({ ...base(shape, id), parameters, options, ...layout })
}
add('ellipse', 'minima', {}, '', { minimumWidth: 60, minimumHeight: 45 })
add('diamond', 'aspect', { aspect: 1.8 }, '/pgf/aspect=1.8')
add('diamond', 'minima', { aspect: .6 }, '/pgf/aspect=.6', { minimumWidth: 65, minimumHeight: 50 })
add('regular polygon', 'heptagon', { regularPolygonSides: 7 }, '/pgf/regular polygon sides=7')
add('regular polygon', 'minimum', { regularPolygonSides: 5 }, '/pgf/regular polygon sides=5', { minimumWidth: 65 })
add('star', 'points', { starPoints: 7 }, '/pgf/star points=7')
add('star', 'ratio', { starPointRatio: 2.2, starPointMode: 'ratio' }, '/pgf/star point ratio=2.2')
add('star', 'height', { starPointHeight: 8, starPointMode: 'height' }, '/pgf/star point height=8pt')
add('star', 'height-minimum', { starPointHeight: 8, starPointMode: 'height' }, '/pgf/star point height=8pt', { minimumWidth: 75 })
add('trapezium', 'angles', { trapeziumLeftAngle: 110, trapeziumRightAngle: 50 }, '/pgf/trapezium left angle=110,/pgf/trapezium right angle=50')
add('trapezium', 'stretch', { trapeziumStretches: true }, '/pgf/trapezium stretches=true', { minimumWidth: 70, minimumHeight: 35 })
add('trapezium', 'stretch-body', { trapeziumStretchesBody: true }, '/pgf/trapezium stretches body=true', { minimumWidth: 70, minimumHeight: 35 })
add('isosceles triangle', 'angle', { isoscelesTriangleApexAngle: 75 }, '/pgf/isosceles triangle apex angle=75')
add('isosceles triangle', 'stretch', { isoscelesTriangleStretches: true }, '/pgf/isosceles triangle stretches=true', { minimumWidth: 70, minimumHeight: 55 })
add('kite', 'angles', { kiteUpperVertexAngle: 100, kiteLowerVertexAngle: 75 }, '/pgf/kite upper vertex angle=100,/pgf/kite lower vertex angle=75')
add('kite', 'minimum', {}, '', { minimumWidth: 60, minimumHeight: 80 })
add('dart', 'angles', { dartTipAngle: 60, dartTailAngle: 120 }, '/pgf/dart tip angle=60,/pgf/dart tail angle=120')
add('dart', 'minimum', {}, '', { minimumWidth: 65, minimumHeight: 55 })
add('semicircle', 'minimum', {}, '', { minimumWidth: 75, minimumHeight: 55 })
add('circular sector', 'angle', { circularSectorAngle: 120 }, '/pgf/circular sector angle=120')
add('circular sector', 'obtuse', { circularSectorAngle: 150 }, '/pgf/circular sector angle=150')
add('circular sector', 'minimum', {}, '', { minimumWidth: 65, minimumHeight: 45 })
add('cylinder', 'aspect', { aspect: .4 }, '/pgf/aspect=.4')
add('cylinder', 'fills', { cylinderUsesCustomFill: true, cylinderBodyFill: '#0000FF', cylinderEndFill: '#FF0000' },
  '/pgf/cylinder uses custom fill=true,/pgf/cylinder body fill=blue,/pgf/cylinder end fill=red')
add('cylinder', 'minimum', { aspect: .5 }, '/pgf/aspect=.5', { minimumWidth: 70, minimumHeight: 60 })
for (const shape of ['trapezium', 'isosceles triangle', 'kite', 'dart', 'semicircle', 'circular sector', 'cylinder']) {
  add(shape, 'rotate-restricted', { borderRotate: 90 }, '/pgf/shape border rotate=90')
  add(shape, 'rotate-negative', { borderRotate: -90 }, '/pgf/shape border rotate=-90')
  add(shape, 'incircle-rotate', { borderRotate: 37, borderUsesIncircle: true },
    '/pgf/shape border rotate=37,/pgf/shape border uses incircle=true')
}
for (const shape of ['regular polygon', 'star']) add(shape, 'rotate', { borderRotate: 37 }, '/pgf/shape border rotate=37')
