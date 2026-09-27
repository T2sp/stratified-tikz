import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createImportedTikzResolutionContext, resolveImportedTikzStyle } from '../../src/model/importedTikzStyles.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'
import { createPaintValueExecutionVariants, exactSource, point, reload } from '../fixtures/point-paint-pgf/execution-boundary/paint-value-execution/model.ts'

const fixture = new URL('../fixtures/point-paint-pgf/execution-boundary/paint-value-execution/', import.meta.url)
const variants = createPaintValueExecutionVariants().variants
const paintFields = ['fillColor', 'fillEnabled', 'drawColor', 'drawEnabled', 'textColor', 'fillOpacity', 'drawOpacity', 'textOpacity', 'lineWidth', 'dashPattern', 'dashPhase', 'lineCap', 'lineJoin']
interface RetainedFile { originalName: string; retainedName: string; bytes: number; sha256: string }
interface PaintOperators { body: string; textOperator: string | undefined; fillOperator?: string }

function actualPdfOperators(filename: string): PaintOperators[] {
  const pdf = readFileSync(new URL(filename, fixture)).toString('latin1')
  const streams = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => match[1]).filter((stream) => /\[\((?:PGF|APP)\)\]TJ/.test(stream))
  assert.ok(streams.length > 0, 'actual uncompressed page stream exists')
  const stream = streams.join('\n')
  let offset = 0
  const colorBefore = (part: string): string | undefined => [...part.matchAll(/(?:^|\s)([\d.]+ [\d.]+ [\d.]+ rg)(?=\s)/g)].at(-1)?.[1]
  return [...stream.matchAll(/\[\((PGF|APP)\)\]TJ/g)].map((match) => {
    const node = stream.slice(offset, match.index)
    offset = match.index + match[0].length
    const textOperator = colorBefore(node)
    const shape = [...node.matchAll(/(?:^|\n)(?:f|B)\s*\n/g)].at(-1)
    const fillOperator = shape === undefined ? undefined : colorBefore(node.slice(0, shape.index))
    return { body: match[1], textOperator, ...(fillOperator === undefined ? {} : { fillOperator }) }
  })
}

test('recognized-value fixture preserves every independent failing artifact including binary bytes', () => {
  const manifest = JSON.parse(readFileSync(new URL('before-sha256.json', fixture), 'utf8')) as { files: RetainedFile[] }
  assert.equal(manifest.files.length, 19)
  for (const file of manifest.files) {
    const content = readFileSync(new URL(`before/${file.retainedName}`, fixture))
    assert.equal(content.length, file.bytes, file.originalName)
    assert.equal(createHash('sha256').update(content).digest('hex'), file.sha256, file.originalName)
  }
  assert.equal(readFileSync(new URL('runtime.sty', fixture), 'utf8'), exactSource)
  assert.equal(readFileSync(new URL('before/runtime.sty', fixture), 'utf8'), exactSource)
  const originalManifest = JSON.parse(readFileSync(new URL('before/sha256.json', fixture), 'utf8')) as Record<string, string>
  for (const file of manifest.files) {
    if (originalManifest[file.originalName] !== undefined) assert.equal(file.sha256, originalManifest[file.originalName])
  }
})

test('independent before PDF confirms blue external text and both erroneous application red overrides', () => {
  const operators = actualPdfOperators('before/probe.pdf')
  assert.deepEqual(operators.map(({ body, textOperator }) => ({ body, textOperator })), [
    { body: 'PGF', textOperator: '0 0 1 rg' },
    { body: 'APP', textOperator: '1 0 0 rg' },
    { body: 'APP', textOperator: '1 0 0 rg' },
  ])
  const before = JSON.parse(readFileSync(new URL('before/resolver.json', fixture), 'utf8')) as {
    preview: { textColor: string; executionUncertain?: boolean; unresolvedFields: string[] }
  }
  assert.equal(before.preview.textColor, '#FF0000')
  assert.equal(before.preview.executionUncertain, undefined)
  assert.deepEqual(before.preview.unresolvedFields, ['lineWidth'])
})

for (const exportMode of ['standalone', 'inlineMath'] as const) {
  for (const variant of variants) test(`${exportMode} ${variant.name} recognized-value execution matches independently compiled production output`, () => {
    const diagram = variant.diagram
    const reference = diagram.importedTikzStyleReferences?.find((entry) => entry.key === 'myPoint')
    assert.ok(reference)
    const preview = resolveImportedTikzStyle(reference, createImportedTikzResolutionContext(diagram))
    assert.equal(preview.executionUncertain, true)
    for (const field of paintFields) assert.ok(preview.unresolvedFields?.includes(field), `${field} stays uncertain`)
    assert.match(preview.diagnostics?.join('\n') ?? '', /executable.*line width|line width.*executable/i)
    assert.ok(preview.sourceDependencies?.includes(reference.sourceId))
    assert.ok(diagram.externalTikzStyleSources?.every((source) => source.rawSource === exactSource && source.loadHint === String.raw`\input{runtime.sty}`))
    assert.deepEqual(reload(diagram).importedTikzStyleReferences, diagram.importedTikzStyleReferences, 'diagnostics and reference spelling survive another save/reload')
    const expectedFields = Object.keys(variant.local ?? {}).map((channel) => `${channel}.color`)
    assert.deepEqual(point(diagram).style.importedPaint?.overriddenFields, expectedFields)
    const output = generateTikz(diagram, { exportMode })
    assert.equal(output, readFileSync(new URL(`${variant.name}-${exportMode}.tex`, fixture), 'utf8'), 'current production output is byte-identical to the compiled fragment')
    const node = output.match(/\\node\[([\s\S]*?)\]\s+at/)
    assert.ok(node)
    const options = node[1].split(',').map((option) => option.trim())
    const index = options.indexOf('myPoint')
    assert.ok(index >= 0, 'actual external key survives')
    const after = options.slice(index + 1)
    assert.equal(after.length, expectedFields.length, 'untouched uncertain paint never follows the external invocation')
    const colors = new Map([...output.matchAll(/\\definecolor\{([^}]+)\}\{HTML\}\{([\dA-F]{6})\}/g)].map((match) => [match[1], `#${match[2]}`]))
    for (const channel of ['text', 'fill', 'draw'] as const) {
      const option = after.find((entry) => entry.startsWith(`${channel}=`))
      assert.equal(option === undefined ? undefined : colors.get(option.slice(channel.length + 1)), channel === 'draw' ? undefined : variant.local?.[channel])
    }
  })

  test(`${exportMode} actual PGF operators retain external blue and honor only recorded edits through reload, refresh and history`, () => {
    const original = actualPdfOperators('before/probe.pdf')
    const externalBlue = original[0].textOperator
    assert.equal(externalBlue, '0 0 1 rg')
    const operators = actualPdfOperators(`runtime-${exportMode}.pdf`)
    assert.equal(operators.length, variants.length + 1)
    assert.equal(operators[0].body, 'PGF')
    assert.equal(operators[0].textOperator, externalBlue)
    const requestedOperators = new Map([['#FF0000', '1 0 0 rg'], ['#FFFF00', '1 1 0 rg'], ['#000000', '0 0 0 rg']])
    variants.forEach((variant, index) => {
      const node = operators[index + 1]
      assert.equal(node.body, 'APP')
      assert.equal(node.textOperator, variant.local?.text === undefined ? externalBlue : requestedOperators.get(variant.local.text), `${variant.name} text`)
      assert.equal(node.fillOperator, variant.local?.fill === undefined ? '0 0 0 rg' : requestedOperators.get(variant.local.fill), `${variant.name} fill`)
    })
    const log = readFileSync(new URL(`runtime-${exportMode}.log.txt`, fixture), 'utf8')
    assert.match(log, /STZ-PGF-VERSION=3\.1\.11a/)
    for (const { name } of variants) assert.ok(log.includes(`(./${name}-${exportMode}.tex`), `${name} fragment compiled`)
    const results = JSON.parse(readFileSync(new URL('compiler-results.json', fixture), 'utf8')) as { compilations: { mode: string; exitCode: number }[]; operatorExtractionExitCode: number }
    assert.equal(results.compilations.find((result) => result.mode === exportMode)?.exitCode, 0)
    assert.equal(results.operatorExtractionExitCode, 0)
  })
}
