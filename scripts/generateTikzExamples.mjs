import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evenOddFilledBoundaryExample,
  hemispherePatchExample,
  saddlePatchExample,
  threeDimensionalExample,
  translucentFilledStrataExample,
  twoDimensionalExample,
} from '../src/examples/index.ts'
import { generateTikz } from '../src/tikz/index.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutputDir = resolve(repositoryRoot, 'generated-tikz-examples')

export async function generateTikzExamples({
  outputDir = process.env.TIKZ_EXAMPLE_OUTPUT_DIR ?? defaultOutputDir,
} = {}) {
  const resolvedOutputDir = resolve(outputDir)
  const outputs = [
    {
      fileName: 'diagram-2d.tex',
      source: generateTikz(twoDimensionalExample),
    },
    {
      fileName: 'diagram-3d.tex',
      source: generateTikz(threeDimensionalExample),
    },
    {
      fileName: 'reference-fills.tex',
      source: generateTikz(translucentFilledStrataExample),
    },
    {
      fileName: 'hemisphere-patch.tex',
      source: generateTikz(hemispherePatchExample),
    },
    {
      fileName: 'saddle-patch.tex',
      source: generateTikz(saddlePatchExample),
    },
    {
      fileName: 'even-odd-boundary.tex',
      source: generateTikz(evenOddFilledBoundaryExample),
    },
  ]

  await mkdir(resolvedOutputDir, { recursive: true })

  await Promise.all(
    outputs.map((output) =>
      writeFile(resolve(resolvedOutputDir, output.fileName), output.source, 'utf8'),
    ),
  )

  return outputs.map((output) => resolve(resolvedOutputDir, output.fileName))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await generateTikzExamples()
  console.log(`Generated ${files.length} TikZ example files:`)
  for (const file of files) {
    console.log(`- ${file}`)
  }
}
