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

test('unsupported style mutation retains external paint until a local fill edit returns to red fallback', () => {
  const source = String.raw`\tikzset{myPoint/.style={fill=red,text=red},myPoint/.append style={fill=blue,text=blue}}`
  const initial = apply(importTikzStyleFile(empty(), 'append.sty', source).diagram, 'myPoint')
  for (const mode of modes) {
    const untouched = afterKey(initial, 'myPoint', mode)
    assert.equal(untouched.color('fill'), undefined)
    assert.equal(untouched.color('text'), undefined)
    assert.ok(!untouched.options.some((option) => /^(?:fill|text|draw)=/.test(option)))
  }
  let edited = initial
  for (const color of ['#123456', '#FF0000'] as const) edited = edit(edited, 'fill.color', (style) => {
    const paint = getPointPaint(style)
    return { ...style, paint: { ...paint, fill: { ...paint.fill, color } } }
  })
  const loaded = parseSavedDiagramJson(serializeDiagram(edited))
  assert.ok(loaded.ok)
  assert.deepEqual(point(loaded.diagram).style.importedPaint?.overriddenFields, ['fill.color'])
  assert.equal(loaded.diagram.externalTikzStyleSources?.[0].rawSource, source)
  for (const mode of modes) {
    const actual = afterKey(loaded.diagram, 'myPoint', mode)
    assert.equal(actual.color('fill'), '#FF0000')
    assert.equal(actual.color('text'), undefined)
    assert.equal(actual.color('draw'), undefined)
    assert.ok(!actual.options.some((option) => /^(?:text|draw|fill opacity|text opacity|draw opacity|line width|dash pattern|dash phase|line cap|line join)=/.test(option)))
  }
  assert.deepEqual(point(initial).style.importedPaint?.overriddenFields, [])
})

test('current mutation exports match the corrected compiled PGF comparison and retain the failing reference', () => {
  const root = new URL('../fixtures/point-paint-pgf/unsupported-mutations/', import.meta.url)
  const observations = JSON.parse(readFileSync(new URL('observations.json', root), 'utf8')) as {
    pgfVersion: string; compilationExitCode: number
    before: { body: string; operator: string }[]
    after: { body: string; operator: string }[]
  }
  assert.equal(observations.pgfVersion, '3.1.11a')
  assert.equal(observations.compilationExitCode, 0)
  assert.match(readFileSync(new URL('compilation.txt', root), 'utf8'), /STZ-PGF-VERSION=3\.1\.11a/)
  assert.match(readFileSync(new URL('compilation.txt', root), 'utf8'), /Output written on/)
  for (const [path, rows] of [['before/pdf-operators.txt', observations.before], ['pdf-operators.txt', observations.after]] as const) {
    const operators = readFileSync(new URL(path, root), 'utf8')
    let offset = 0
    for (const row of rows) {
      const marker = `[(${row.body})]TJ`
      const index = operators.indexOf(marker, offset)
      assert.ok(index >= offset, `${path} contains actual node body ${row.body}`)
      const node = operators.slice(offset, index)
      const colorBefore = (part: string) => [...part.matchAll(/(?:^|\n)([\d.]+(?: [\d.]+){2} rg)(?=\s)/g)].at(-1)?.[1]
      assert.equal(colorBefore(node), row.operator, `${path}: effective text paint ${row.body}`)
      const paint = [...node.matchAll(/(?:^|\n)(?:f|B)\s*\n/g)].at(-1)
      assert.ok(paint, `${path}: actual filled shape ${row.body}`)
      assert.equal(colorBefore(node.slice(0, paint.index)), row.operator, `${path}: effective fill paint ${row.body}`)
      offset = index + marker.length
    }
  }
  const original = createEmptyDiagram({ ambientDimension: 2 })
  original.strata = [createPointStratum({ ambientDimension: 2, id: 'p', text: 'APP', position: { x: 0, y: 0, z: 0 } })]
  const applied = apply(importTikzStyleFile(original, 'append.sty', readFileSync(new URL('append.sty', root), 'utf8')).diagram, 'myPoint')
  for (const mode of modes) {
    const actual = afterKey(applied, 'myPoint', mode)
    assert.equal(actual.output, readFileSync(new URL(`generated-${mode}.tex`, root), 'utf8'), `${mode} is the output actually compiled`)
    assert.equal(actual.color('fill'), undefined)
    assert.equal(actual.color('text'), undefined)
    assert.deepEqual(actual.options, [], 'all untouched paint remains before the external key')
  }
})
