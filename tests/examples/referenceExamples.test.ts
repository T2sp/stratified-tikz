import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evenOddFilledBoundaryExample,
  coonsPatchExample,
  hemispherePatchExample,
  referenceExampleDiagrams,
  ruledSurfaceOcclusionExample,
  saddlePatchExample,
  symbolicCirclePointExample,
  symbolicPathExample,
  threeDimensionalExample,
  threeDimensionalWorkPlaneGridExample,
  translucentSortedSheetsExample,
  translucentFilledStrataExample,
  twoDimensionalGridExample,
  twoDimensionalExample,
} from '../../src/examples/index.ts'
import { createInitialCamera3D } from '../../src/model/camera.ts'
import { validateDiagram } from '../../src/model/validation.ts'
import type {
  CurvedSheetStratum,
  Diagram,
  FilledRegion2DStratum,
} from '../../src/model/types.ts'
import { curvedSheetToSvgMesh } from '../../src/rendering/curvedSheetMesh.ts'
import { closedBoundariesToSvgPathData } from '../../src/rendering/svgPath.ts'
import { generateTikz } from '../../src/tikz/index.ts'

const exampleCases = [
  { name: '2D example', diagram: twoDimensionalExample },
  { name: '3D example', diagram: threeDimensionalExample },
  { name: 'reference fills', diagram: translucentFilledStrataExample },
  { name: 'hemisphere patch', diagram: hemispherePatchExample },
  { name: 'saddle patch', diagram: saddlePatchExample },
  { name: 'even-odd boundary', diagram: evenOddFilledBoundaryExample },
  { name: 'ruled surface occlusion', diagram: ruledSurfaceOcclusionExample },
  { name: 'Coons patch', diagram: coonsPatchExample },
  { name: 'sorted translucent sheets', diagram: translucentSortedSheetsExample },
  { name: 'symbolic circle point', diagram: symbolicCirclePointExample },
  { name: 'symbolic path', diagram: symbolicPathExample },
  { name: '2D grid', diagram: twoDimensionalGridExample },
  { name: '3D work-plane grid', diagram: threeDimensionalWorkPlaneGridExample },
] as const

test('existing and reference examples validate', () => {
  for (const { name, diagram } of exampleCases) {
    const validation = validateDiagram(diagram)

    assert.equal(
      validation.valid,
      true,
      `${name}\n${validation.errors
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('\n')}`,
    )
  }
})

test('reference examples generate finite bounded TikZ output', () => {
  for (const diagram of referenceExampleDiagrams) {
    const tikz = generateTikz(diagram)

    assert.ok(tikz.length > 500)
    assert.ok(tikz.length < 24000)
    assert.doesNotMatch(tikz, /NaN|Infinity/)
    assert.match(tikz, /\\definecolor/)
    assert.match(tikz, /\\pgfdeclarelayer/)
  }
})

test('reference filled-strata example exports translucent fills and curve styles', () => {
  const tikz = generateTikz(translucentFilledStrataExample)

  assert.match(tikz, /Filled region "Blue translucent region"/)
  assert.match(tikz, /fill opacity=0\.35/)
  assert.match(tikz, /fill opacity=0\.28/)
  assert.match(tikz, /line width=1\.2pt/)
  assert.match(tikz, /densely dotted/)
  assert.match(tikz, /\$A\$/)
})

test('hemisphere and saddle examples export sampled curved sheets', () => {
  const hemisphereTikz = generateTikz(hemispherePatchExample)
  const saddleTikz = generateTikz(saddlePatchExample)

  assert.match(
    hemisphereTikz,
    /Primitive: hemisphere; sampling: u=8, v=4; faces=32/,
  )
  assert.match(saddleTikz, /Primitive: saddle; sampling: u=6, v=5; faces=30/)
  assert.match(hemisphereTikz, /Each sampled face is emitted/)
  assert.match(saddleTikz, /Each sampled face is emitted/)
  assert.match(hemisphereTikz, /\\node at \(0\.35,0,1\.62\) \{\$\\gamma\$\};/)
  assert.match(saddleTikz, /\\node at \(0\.2,0\.15,0\.35\) \{\$p\$\};/)
})

test('boundary surface and visibility examples export auto-visibility TikZ', () => {
  const ruledTikz = generateTikz(ruledSurfaceOcclusionExample)
  const coonsTikz = generateTikz(coonsPatchExample)
  const sortedTikz = generateTikz(translucentSortedSheetsExample)

  assert.match(ruledTikz, /Auto surface face depth sort/)
  assert.match(ruledTikz, /Auto curve occlusion/)
  assert.match(ruledTikz, /Hidden sampled segment/)
  assert.match(coonsTikz, /Coons patch generated/)
  assert.match(coonsTikz, /Primitive: coonsPatch/)
  assert.match(sortedTikz, /Auto surface face depth sort/)
  assert.doesNotMatch(
    [ruledTikz, coonsTikz, sortedTikz].join('\n'),
    /NaN|Infinity/,
  )
})

test('even-odd boundary example exports compound fill rule', () => {
  const tikz = generateTikz(evenOddFilledBoundaryExample)

  assert.match(tikz, /Filled region "Even-odd annulus"/)
  assert.match(tikz, /Fill rule: evenOdd/)
  assert.match(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('symbolic and grid examples export macros and foreach grids', () => {
  const pointTikz = generateTikz(symbolicCirclePointExample)
  const pathTikz = generateTikz(symbolicPathExample)
  const grid2dTikz = generateTikz(twoDimensionalGridExample)
  const grid3dTikz = generateTikz(threeDimensionalWorkPlaneGridExample)

  assert.match(pointTikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
  assert.match(pointTikz, /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\)/)
  assert.match(pathTikz, /curvePathSymbolicRadiusPath0p1/)
  assert.match(pathTikz, /\{\\R \* cos\(\\q\)\}/)
  assert.match(grid2dTikz, /\\foreach \\stzGridU/)
  assert.match(grid2dTikz, /\\clip \(-2,-2\) rectangle \(2,2\);/)
  assert.match(grid3dTikz, /canvas is plane/)
  assert.match(grid3dTikz, /\\foreach \\stzGridV/)
})

test('reference examples produce finite SVG helper geometry', () => {
  for (const diagram of [
    translucentFilledStrataExample,
    evenOddFilledBoundaryExample,
  ]) {
    for (const region of filledRegions(diagram)) {
      const pathData = closedBoundariesToSvgPathData(region.boundaries, (point) => ({
        x: point.x,
        y: point.y,
      }))

      assert.match(pathData, /^M /)
      assert.doesNotMatch(pathData, /NaN|Infinity/)
    }
  }

  for (const sheet of [
    curvedSheet(hemispherePatchExample),
    curvedSheet(saddlePatchExample),
  ]) {
    const mesh = curvedSheetToSvgMesh(sheet, createInitialCamera3D(), 360)

    assert.ok(mesh.faces.length > 0)
    assert.ok(mesh.boundaryPathData.length > 0)
    assert.doesNotMatch(
      [
        ...mesh.faces.map((face) => face.points),
        ...mesh.boundaryPathData,
      ].join('\n'),
      /NaN|Infinity/,
    )
  }
})

function filledRegions(diagram: Diagram): FilledRegion2DStratum[] {
  return diagram.strata.filter(
    (stratum): stratum is FilledRegion2DStratum =>
      stratum.geometricKind === 'region' && stratum.kind === 'filledRegion',
  )
}

function curvedSheet(diagram: Diagram): CurvedSheetStratum {
  const sheet = diagram.strata.find(
    (stratum): stratum is CurvedSheetStratum =>
      stratum.geometricKind === 'sheet' && stratum.kind === 'curvedSheet',
  )

  assert.notEqual(sheet, undefined)

  return sheet
}
