import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { resolveTikzPaint } from '../../src/model/importedTikzPaint.ts'
import { markPointShapeOverrides } from '../../src/model/pointShapeParameters.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { defaultPointStyle } from '../../src/model/styles.ts'
import { pointShapes, type Diagram, type PointShape, type PointShapeParameters, type PointStratum } from '../../src/model/types.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'

function diagram(shape: PointShape = 'circle', shapeParameters?: PointShapeParameters): Diagram {
  return { ...createEmptyDiagram({ ambientDimension: 2 }), strata: [createPointStratum({ ambientDimension: 2, id: 'p', name: 'P', position: { x: 1, y: 2, z: 0 }, text: '  $F$  ', style: { ...defaultPointStyle, shape, shapeParameters } })] }
}
function point(value: Diagram): PointStratum {
  const result = value.strata[0]; assert.equal(result.geometricKind, 'point')
  if (result.geometricKind !== 'point') throw Error('Expected point')
  return result
}
function importApply(source: string): Diagram {
  const imported = importTikzStyleFile(diagram(), 'shapes.sty', source)
  const reference = imported.references.find((entry) => entry.key === 'geometric')
  const preset = imported.diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference?.id)
  assert.ok(preset)
  return applyUserStylePresetToStratum(imported.diagram, 'p', preset.id)
}
function nodeOptions(output: string): string[] {
  const node = output.match(/\\node\[([\s\S]*?)\] at/); assert.ok(node)
  return node[1].split(',').map((option) => option.trim())
}
for (const shape of pointShapes) for (const exportMode of ['standalone', 'inlineMath'] as const) test(`${shape} remains distinct in ${exportMode} TikZ with library declaration`, () => {
  const output = generateTikz(diagram(shape), { exportMode })
  const options = nodeOptions(output)
  assert.ok(options.includes(shape === 'square' || shape === 'triangle' ? 'regular polygon' : shape))
  if (shape === 'square' || shape === 'triangle') assert.ok(options.includes(`regular polygon sides=${shape === 'square' ? 4 : 3}`))
  if (shape !== 'circle' && shape !== 'rectangle') assert.match(output, /shapes\.geometric/)
  assert.match(output, /\{ {2}\$F\$ {2}\}/)
})
test('readable parameter options preserve booleans, dimensions and active star mode in both outputs', () => {
  for (const exportMode of ['standalone', 'inlineMath'] as const) for (const starPointMode of ['height', 'ratio'] as const) {
    const parameters: PointShapeParameters = { starPoints: 7, starPointHeight: 12, starPointRatio: 2, starPointMode, borderRotate: 37, borderUsesIncircle: false }
    const options = nodeOptions(generateTikz(diagram('star', parameters), { exportMode }))
    assert.ok(options.includes('star points=7'))
    assert.ok(options.includes('shape border rotate=37'))
    assert.ok(options.includes('shape border uses incircle=false'))
    const preview = resolveTikzPaint(options.filter((option) => /^(?:star|shape)/.test(option)).join(','))
    assert.deepEqual(preview.shapeParameters, parameters)
  }
  const onlyMode = nodeOptions(generateTikz(diagram('star', { starPointMode: 'height' })))
  assert.ok(onlyMode.some((option) => option.startsWith('star point height=')))
})
test('switching a configured star to a basic shape retains parameters and their library in both outputs', () => {
  for (const shape of ['circle', 'rectangle'] as const) for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const original = diagram('star', { starPoints: 7, starPointRatio: 2 })
    const switched = updateStratumStyleById(original, 'p', (style) => style.kind === 'pointStyle'
      ? markPointShapeOverrides({ ...style, shape }, ['shape']) : style)
    const output = generateTikz(switched, { exportMode })
    const options = nodeOptions(output)
    assert.ok(options.includes(shape))
    assert.ok(options.includes('star points=7'))
    assert.ok(options.includes('star point ratio=2'))
    assert.match(output, /shapes\.geometric/)
    assert.doesNotMatch(output, /Cylinder(?:End|Body)/)
    const unconfigured = generateTikz(diagram(shape), { exportMode })
    assert.doesNotMatch(unconfigured, /shapes\.geometric/)
    assert.doesNotMatch(unconfigured, /Cylinder(?:End|Body)/)
  }
})
test('cylinder uses independent named custom colors and does not change ordinary fill enablement', () => {
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const value = diagram('cylinder', { aspect: 2, cylinderUsesCustomFill: true, cylinderEndFill: '#123456', cylinderBodyFill: '#ABCDEF' })
    const output = generateTikz(value, { exportMode })
    assert.match(output, /cylinder uses custom fill=true/)
    assert.match(output, /cylinder end fill=stzPointpCylinderEnd/)
    assert.match(output, /cylinder body fill=stzPointpCylinderBody/)
    assert.match(output, /\{stzPointpCylinderEnd\}\{HTML\}\{123456\}/)
    assert.match(output, /\{stzPointpCylinderBody\}\{HTML\}\{ABCDEF\}/)
    assert.ok(nodeOptions(output).some((option) => option.startsWith('fill=') && option !== 'fill=none'))
  }
})
test('ordered imported shape options, aliases and false survive raw sources, JSON and partial defaults', () => {
  const source = String.raw`\tikzset{geometric/.style={diamond,aspect=2,shape aspect=3,cylinder,cylinder uses custom fill,cylinder uses custom fill=false,cylinder end fill=red,kite vertex angles={100 and 50}}}`
  const value = importApply(source)
  assert.equal(point(value).style.shape, 'cylinder')
  assert.equal(point(value).style.shapeParameters?.aspect, 3)
  assert.equal(point(value).style.shapeParameters?.cylinderUsesCustomFill, false)
  const loaded = parseSavedDiagramJson(serializeDiagram(value)); assert.ok(loaded.ok)
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, source)
  assert.deepEqual(point(loaded.diagram).style, point(value).style)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const output = generateTikz(loaded.diagram, { exportMode })
    const options = nodeOptions(output); const post = options.slice(options.indexOf('geometric') + 1)
    assert.ok(!post.some((option) => /^(?:aspect|cylinder|kite)/.test(option)), 'unchanged imported values remain governed by their external key')
    assert.match(output, /shapes\.geometric/)
  }
})
test('unsupported external shape intent remains raw and explicit local fallback-valued overrides survive uncertainty', () => {
  const source = String.raw`\tikzset{geometric/.style={shape=unknown shape,star points=999,aspect=\ratio}}`
  const value = importApply(source)
  assert.ok(value.importedTikzStyleReferences?.[0].previewDiagnostics?.length)
  const sourceId = value.externalTikzStyleSources?.[0].id
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const options = nodeOptions(generateTikz(value, { exportMode }))
    const post = options.slice(options.indexOf('geometric') + 1)
    assert.ok(!post.some((option) => /^(?:circle|aspect|star)/.test(option)), 'unknown source receives no invented post-key shape defaults')
  }
  const edited = updateStratumStyleById(value, 'p', (style) => style.kind === 'pointStyle'
    ? markPointShapeOverrides({ ...style, shape: 'star', shapeParameters: { ...style.shapeParameters, aspect: 1, starPoints: 5 } }, ['shape', 'aspect', 'starPoints']) : style)
  const loaded = parseSavedDiagramJson(serializeDiagram(edited)); assert.ok(loaded.ok)
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].id, sourceId)
  for (const exportMode of ['standalone', 'inlineMath'] as const) {
    const options = nodeOptions(generateTikz(loaded.diagram, { exportMode })); const post = options.slice(options.indexOf('geometric') + 1)
    assert.ok(post.includes('star')); assert.ok(post.includes('aspect=1')); assert.ok(post.includes('star points=5'))
  }
})
test('external shape refresh preserves explicit local parameters but refreshes untouched fields', () => {
  const value = importApply(String.raw`\tikzset{geometric/.style={star,star points=7,star point ratio=2}}`)
  const edited = updateStratumStyleById(value, 'p', (style) => style.kind === 'pointStyle'
    ? markPointShapeOverrides({ ...style, shapeParameters: { ...style.shapeParameters, starPoints: 5 } }, ['starPoints']) : style)
  const refreshed = importTikzStyleFile(edited, 'shapes.sty', String.raw`\tikzset{geometric/.style={star,star points=9,star point ratio=3}}`).diagram
  assert.equal(point(refreshed).style.shapeParameters?.starPoints, 5)
  assert.equal(point(refreshed).style.shapeParameters?.starPointRatio, 3)
})
