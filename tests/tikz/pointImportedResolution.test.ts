import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createEmptyDiagram, createPointStratum } from '../../src/model/constructors.ts'
import { importTikzStyleFile } from '../../src/model/importedTikzStyles.ts'
import { applyUserStylePresetToStratum } from '../../src/model/stylePresets.ts'
import { getPointPaint } from '../../src/model/styles.ts'
import { parseSavedDiagramJson, serializeDiagram } from '../../src/model/serialization.ts'
import { updateStratumStyleById } from '../../src/ui/diagramUpdates.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import type { Diagram, PointPaintField, PointStratum, PointStyle, TikzExportMode } from '../../src/model/types.ts'

const modes = ['standalone', 'inlineMath'] as const
function empty(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  return { ...diagram, strata: [createPointStratum({ ambientDimension: 2, id: 'p', name: 'P', text: 'P', position: { x: 0, y: 0, z: 0 } })] }
}
function apply(diagram: Diagram, key: string): Diagram {
  const reference = diagram.importedTikzStyleReferences?.find((entry) => entry.key === key)
  const preset = diagram.userStylePresets?.find((entry) => entry.kind === 'point' && entry.importedTikzStyleReferenceId === reference?.id)
  assert.ok(preset)
  return applyUserStylePresetToStratum(diagram, 'p', preset.id)
}
function point(diagram: Diagram): PointStratum {
  const point = diagram.strata[0]
  assert.equal(point.geometricKind, 'point')
  if (point.geometricKind !== 'point') throw new Error('Expected point')
  return point
}
function edit(diagram: Diagram, field: PointPaintField, update: (style: PointStyle) => PointStyle): Diagram {
  return updateStratumStyleById(diagram, 'p', (style) => style.kind === 'pointStyle' ? update(style) : style, [field])
}
function afterKey(diagram: Diagram, key: string, mode: TikzExportMode): { options: string[]; color: (key: string) => string | undefined; output: string } {
  const output = generateTikz(diagram, { exportMode: mode })
  const node = output.match(/\\node\[([\s\S]*?)\] at/)
  assert.ok(node)
  const allOptions = node[1].split(',').map((option) => option.trim())
  const index = allOptions.indexOf(key)
  assert.ok(index >= 0, `exact external key ${key}`)
  const options = allOptions.slice(index + 1)
  const definitions = new Map([...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-Fa-f]{6})\}/g)].map((match) => [match[1], `#${match[2].toUpperCase()}`]))
  return { options, output, color: (paintKey) => {
    const assignment = options.filter((option) => option.startsWith(`${paintKey}=`)).at(-1)
    return assignment === undefined ? undefined : definitions.get(assignment.slice(paintKey.length + 1))
  } }
}

test('post-key paint agrees with independently compiled PGF import-order observations', () => {
  const root = new URL('../fixtures/point-paint-pgf/import-order/', import.meta.url)
  const observations = JSON.parse(readFileSync(new URL('observations.json', root), 'utf8')) as {
    pgfVersion: string; compilationExitCode: number; observations: { body: string; fill?: string; text: string; stroke?: string; textOperator: string }[]
  }
  assert.equal(observations.pgfVersion, '3.1.11a')
  assert.equal(observations.compilationExitCode, 0)
  const operators = readFileSync(new URL('pdf-operators.txt', root), 'utf8')
  for (const row of observations.observations) {
    const prefix = operators.slice(0, operators.indexOf(`[(${row.body})]TJ`))
    assert.ok(prefix.endsWith(' Td '), `actual body ${row.body}`)
    const colorOperators = [...prefix.matchAll(/(?:^|\n)([\d.]+(?: [\d.]+){0,3} (?:rg|g|k))(?=\s)/g)]
    assert.equal(colorOperators.at(-1)?.[1], row.textOperator, `actual text paint before ${row.body}`)
  }
  let diagram = importTikzStyleFile(empty(), 'base.sty', readFileSync(new URL('base.sty', root), 'utf8')).diagram
  diagram = importTikzStyleFile(diagram, 'outer.sty', readFileSync(new URL('outer.sty', root), 'utf8')).diagram
  for (const [key, body] of [['outer', 'A'], ['named', 'B'], ['root', 'C'], ['late', 'D']]) {
    const row = observations.observations.find((entry) => entry.body === body)!
    const applied = apply(diagram, key)
    const paint = getPointPaint(point(applied).style)
    assert.equal(paint.text.color, row.text)
    if (row.fill !== undefined) assert.equal(paint.fill.color, row.fill)
    if (row.stroke !== undefined) assert.equal(paint.stroke.color, row.stroke)
    for (const mode of modes) {
      const actual = afterKey(applied, key, mode)
      assert.equal(actual.color('text'), row.text)
      if (row.fill !== undefined) assert.equal(actual.color('fill'), row.fill)
      if (row.stroke !== undefined) assert.equal(actual.color('draw'), row.stroke)
    }
  }
})

test('enablement-only edits use bare fill/draw without claiming unknown external colors', () => {
  for (const channel of ['fill', 'stroke'] as const) {
    const key = channel === 'fill' ? 'fill' : 'draw'
    let diagram = apply(importTikzStyleFile(empty(), 'unknown.sty', `\\tikzstyle{example}=[${key}=\\unknown,text=red]`).diagram, 'example')
    for (const enabled of [false, true]) diagram = edit(diagram, `${channel}.enabled`, (style) => {
      const paint = getPointPaint(style)
      return { ...style, paint: { ...paint, [channel]: { ...paint[channel], enabled } } }
    })
    const loaded = parseSavedDiagramJson(serializeDiagram(diagram))
    assert.ok(loaded.ok)
    for (const mode of modes) {
      const actual = afterKey(loaded.diagram, 'example', mode)
      assert.ok(actual.options.includes(key))
      assert.ok(!actual.options.some((option) => option.startsWith(`${key}=`)))
      assert.equal(actual.color('text'), '#FF0000')
    }
  }
})

test('unknown text and border remain external while a fill edit returns to fallback black', () => {
  let diagram = apply(importTikzStyleFile(empty(), 'unknown.sty', String.raw`\tikzstyle{example}=[fill=\mycolor,text=\textcolor,draw=\border]`).diagram, 'example')
  for (const color of ['#123456', '#000000'] as const) diagram = edit(diagram, 'fill.color', (style) => {
    const paint = getPointPaint(style)
    return { ...style, paint: { ...paint, fill: { ...paint.fill, color } } }
  })
  for (const mode of modes) {
    const actual = afterKey(diagram, 'example', mode)
    assert.equal(actual.color('fill'), '#000000')
    assert.equal(actual.color('text'), undefined)
    assert.equal(actual.color('draw'), undefined)
  }
})

test('dependency comments use source order regardless of element traversal and preserve custom hints', () => {
  let diagram = importTikzStyleFile(empty(), 'first.sty', String.raw`\definecolor{Prior}{HTML}{123456}\tikzstyle{base}=[fill=Prior,text=green]`, String.raw`\input{custom-first.sty}`).diagram
  diagram = importTikzStyleFile(diagram, 'second.sty', String.raw`\tikzstyle{outer}=[base,draw=blue]`).diagram
  diagram = apply(diagram, 'outer')
  const basePreset = diagram.userStylePresets?.find((entry) => entry.kind === 'point' &&
    entry.importedTikzStyleReferenceId === diagram.importedTikzStyleReferences?.find((reference) => reference.key === 'base')?.id)
  assert.ok(basePreset)
  diagram = { ...diagram, strata: [...diagram.strata, { ...point(diagram), id: 'base-point' }] }
  diagram = applyUserStylePresetToStratum(diagram, 'base-point', basePreset.id)
  for (const mode of modes) {
    const { output } = afterKey(diagram, 'outer', mode)
    assert.ok(output.indexOf('custom-first.sty') < output.indexOf('\\input{second.sty}'))
    assert.equal(output.match(/\\input\{custom-first.sty\}/g)?.length, 1)
    assert.doesNotMatch(output, /\\tikzstyle\{outer\}/)
    const reversedOutput = generateTikz({ ...diagram, strata: [...diagram.strata].reverse() }, { exportMode: mode })
    assert.deepEqual(reversedOutput.match(/%\s+\\input\{[^}]+\}/g), output.match(/%\s+\\input\{[^}]+\}/g))
  }
})
