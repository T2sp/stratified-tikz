import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { generateTikzExamples } from '../../scripts/generateTikzExamples.mjs'

test('generateTikzExamples writes representative TikZ files', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'stz-tikz-examples-'))

  try {
    const files = await generateTikzExamples({ outputDir })

    assert.equal(files.length, 6)

    const twoDimensionalSource = await readFile(
      join(outputDir, 'diagram-2d.tex'),
      'utf8',
    )
    const threeDimensionalSource = await readFile(
      join(outputDir, 'diagram-3d.tex'),
      'utf8',
    )
    const referenceFillsSource = await readFile(
      join(outputDir, 'reference-fills.tex'),
      'utf8',
    )
    const hemisphereSource = await readFile(
      join(outputDir, 'hemisphere-patch.tex'),
      'utf8',
    )
    const saddleSource = await readFile(
      join(outputDir, 'saddle-patch.tex'),
      'utf8',
    )
    const evenOddSource = await readFile(
      join(outputDir, 'even-odd-boundary.tex'),
      'utf8',
    )

    assert.match(twoDimensionalSource, /\\begin\{tikzpicture\}/)
    assert.match(twoDimensionalSource, /\$F\^\{\(1\)\}L\$/)
    assert.match(twoDimensionalSource, /densely dotted/)
    assert.match(threeDimensionalSource, /% Requires \\usepackage\{tikz-3dplot\}/)
    assert.match(threeDimensionalSource, /\\tdplotsetmaincoords\{13\}\{-23\}/)
    assert.match(threeDimensionalSource, /tdplot_main_coords/)
    assert.match(threeDimensionalSource, /\\path\[/)
    assert.match(threeDimensionalSource, /star points=5/)
    assert.match(referenceFillsSource, /Blue translucent region/)
    assert.match(referenceFillsSource, /densely dotted/)
    assert.match(hemisphereSource, /Primitive: hemisphere/)
    assert.match(hemisphereSource, /faces=32/)
    assert.match(saddleSource, /Primitive: saddle/)
    assert.match(saddleSource, /faces=30/)
    assert.match(evenOddSource, /even odd rule/)
    assert.doesNotMatch(
      [
        twoDimensionalSource,
        threeDimensionalSource,
        referenceFillsSource,
        hemisphereSource,
        saddleSource,
        evenOddSource,
      ].join('\n'),
      /NaN|Infinity/,
    )
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
