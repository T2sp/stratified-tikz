import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCurveStratum,
  createEmptyDiagram,
  createPointStratum,
  createTextLabel,
} from '../../src/model/constructors.ts'
import { createDefaultPathInlineNode } from '../../src/model/pathInlineNodes.ts'
import {
  parseSavedDiagramJson,
  serializeDiagram,
} from '../../src/model/serialization.ts'
import type { AmbientDimension, Diagram } from '../../src/model/types.ts'
import { parseLabelText } from '../../src/rendering/labelText.ts'
import { generateTikz } from '../../src/tikz/generateTikz.ts'

const pointText = '  point $F$\r\n\n\\textbf{source}  '
const sourceCases = [
  {
    name: 'mixed math and cooked literal escape',
    source: '  図🙂 Cost \\$5 $x$ \t終  ',
    kind: 'parsed',
    inlineMathSource: '  図🙂 Cost \\$5 $x$ \t終  ',
    inlineNodeMathSource: '  図🙂 Cost \\$5 $x$ \t終  ',
  },
  {
    name: 'physical text and math newlines',
    source: ' \t先\n次\r\n $x\n+y$  ',
    kind: 'parsed',
    inlineMathSource: ' \t先 次 $x +y$  ',
    inlineNodeMathSource: ' \t先\n次\n $x\n+y$  ',
  },
  {
    name: 'unsupported text after a valid math run',
    source: '  \\$5 $x$\t \\textbf{A}\r\n\n  ',
    kind: 'fallback',
    inlineMathSource: '  \\$5 $x$\t \\textbf{A} ',
    inlineNodeMathSource: '  \\$5 $x$\t \\textbf{A}\n  ',
  },
  {
    name: 'invalid delimiter after a valid math run',
    source: '  $x$\t  unfinished $y\r\n\n  ',
    kind: 'fallback',
    inlineMathSource: '  $x$\t  unfinished $y ',
    inlineNodeMathSource: '  $x$\t  unfinished $y\n  ',
  },
] as const

for (const ambientDimension of [2, 3] as const) {
  for (const { name, source, kind, inlineMathSource, inlineNodeMathSource } of sourceCases) {
    test(`${ambientDimension}D preview parsing preserves raw storage and TikZ: ${name}`, () => {
      const diagram = createLabelFixture(ambientDimension, source)
      const original = structuredClone(diagram)
      const jsonBefore = serializeDiagram(diagram)
      const standaloneBefore = generateTikz(diagram, { exportMode: 'standalone' })
      const inlineMathBefore = generateTikz(diagram, { exportMode: 'inlineMath' })

      assertVisibleSourcesParse(diagram, source, kind)

      assert.deepEqual(diagram, original)
      assert.equal(serializeDiagram(diagram), jsonBefore)
      assert.equal(generateTikz(diagram, { exportMode: 'standalone' }), standaloneBefore)
      assert.equal(generateTikz(diagram, { exportMode: 'inlineMath' }), inlineMathBefore)
      assert.ok(standaloneBefore.includes(`{${source}};`), 'free label keeps raw source')
      assert.ok(inlineMathBefore.includes(`{${inlineMathSource}};`),
        'free label retains existing inline-math newline formatting')

      assert.ok(standaloneBefore.includes(`node[pos=0.5, above] {${source}}`),
        'path inline node keeps its raw standalone TikZ content')
      assert.ok(inlineMathBefore.includes(`node[pos=0.5, above] {${inlineNodeMathSource}}`),
        'path inline node retains existing export-mode line formatting')
      assert.ok(standaloneBefore.includes(`{${pointText}};`),
        'existing point-node text is untouched')
      assert.ok(inlineMathBefore.includes('{  point $F$ \\textbf{source}  };'),
        'existing point-node inline-math formatting is untouched')

      const loaded = parseSavedDiagramJson(jsonBefore)
      if (!loaded.ok) assert.fail(loaded.error)
      const loadedBefore = structuredClone(loaded.diagram)
      const loadedJsonBefore = serializeDiagram(loaded.diagram)
      const loadedStandaloneBefore = generateTikz(loaded.diagram, { exportMode: 'standalone' })
      const loadedInlineMathBefore = generateTikz(loaded.diagram, { exportMode: 'inlineMath' })

      assertVisibleSourcesParse(loaded.diagram, source, kind)
      const loadedPoint = loaded.diagram.strata.find((stratum) => stratum.id === 'point')
      assert.ok(loadedPoint?.geometricKind === 'point')
      assert.equal(loadedPoint.text, pointText)
      assert.deepEqual(loaded.diagram, loadedBefore)
      assert.equal(serializeDiagram(loaded.diagram), loadedJsonBefore)
      assert.equal(generateTikz(loaded.diagram, { exportMode: 'standalone' }), loadedStandaloneBefore)
      assert.equal(generateTikz(loaded.diagram, { exportMode: 'inlineMath' }), loadedInlineMathBefore)
    })
  }
}

function createLabelFixture(ambientDimension: AmbientDimension, source: string): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension })
  const node = { ...createDefaultPathInlineNode('inline'), text: source }
  diagram.labels.push(createTextLabel({
    ambientDimension,
    id: 'free-label',
    text: source,
    position: { x: 1, y: 2, z: 3 },
  }))
  diagram.strata.push(createCurveStratum({
    ambientDimension,
    id: 'curve',
    pathLabel: 'saved-path',
    label: 'undisplayed stratum metadata',
    points: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }],
    inlineNodes: [node],
  }))
  diagram.strata.push(createPointStratum({
    ambientDimension,
    id: 'point',
    text: pointText,
    position: { x: 3, y: 1, z: 2 },
  }))
  return diagram
}

function assertVisibleSourcesParse(
  diagram: Diagram,
  source: string,
  expectedKind: 'parsed' | 'fallback',
): void {
  const label = diagram.labels[0]
  const curve = diagram.strata.find((stratum) => stratum.id === 'curve')
  assert.ok(label)
  assert.ok(curve?.geometricKind === 'curve')
  const node = curve.inlineNodes?.[0]
  assert.ok(node)
  assert.equal(label.text, source)
  assert.equal(node.text, source)
  assert.equal(curve.pathLabel, 'saved-path')
  assert.equal(curve.label, 'undisplayed stratum metadata')

  for (const text of [label.text, node.text]) {
    const result = parseLabelText(text)
    assert.equal(result.kind, expectedKind)
    assert.equal(result.source, source)
    if (result.kind === 'parsed' && source.includes('Cost')) {
      assert.deepEqual(result.runs[0], {
        kind: 'text',
        sourceStart: 0,
        sourceEnd: source.indexOf('$x$'),
        text: '  図🙂 Cost $5 ',
      })
    }
  }
}
