import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateTikz,
  frameCoordinateHasUnsupportedSymbolicSource,
  layerToTikzLayerName,
  maxCurvedSheetTikzFaces,
  sanitizeTikzSpathSaveName,
  sanitizeTikzNameStem,
  sameWorkPlaneFrameForTikzLocalScope,
  workPlaneFrameHasUnsupportedSymbolicSource,
} from '../../src/tikz/index.ts'
import type {
  ClosedPathBoundary,
  CoordinateComponent,
  CurveStyle,
  Diagram,
  GridParameterRange,
  GridRectangleClip,
  GridStratum,
  PathArrowOptions,
  PerspectiveCamera3D,
  PointShape,
  PointStratum,
  PointStyle,
  PolygonSheetStratum,
  RegionStyle,
  SheetStyle,
  SymbolicVariable,
  TikzStyleTarget,
  Vec3,
  WorkPlaneFrameSnapshot,
  WorkPlaneLocalCoordinateSource,
  WorkPlane,
} from '../../src/model/types.ts'
import {
  createInitialCamera3D,
  resetCameraToInitial,
} from '../../src/model/camera.ts'
import { cameraBasisFromTikz3dplotAngles } from '../../src/geometry/projection.ts'
import { pathIntersectionCandidatesForDiagram } from '../../src/geometry/pathIntersections.ts'
import { pathCrossingStateFromCandidate } from '../../src/model/pathCrossings.ts'
import {
  applyUserStylePresetToLabel,
  applyUserStylePresetToStratum,
  createUserStylePresetFromStyle,
} from '../../src/model/stylePresets.ts'
import { validateDiagram } from '../../src/model/validation.ts'

test('2D TikZ output uses ordinary (x,y) coordinates', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyWire0p1\) at \(1,2\);/)
  assert.doesNotMatch(tikz, /\(0,0,0\)/)
})

test('default TikZ export mode is standalone', () => {
  const diagram = createTwoDimensionalDiagram()

  assert.equal(
    generateTikz(diagram),
    generateTikz(diagram, { exportMode: 'standalone' }),
  )
  assert.doesNotMatch(generateTikz(diagram), /TikZ export mode: inline math/)
})

test('inline math export mode reaches the generator', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram(), {
    exportMode: 'inlineMath',
  })

  assert.match(tikz, /TikZ export mode: inline math/)
  expectNoBlankLines(tikz)
})

test('inline math output starts with the baseline tikzpicture option', () => {
  const baseline = 'baseline={([yshift=-.5ex]current bounding box.center)}'
  const outputs = [
    generateTikz(createTwoDimensionalDiagram(), { exportMode: 'inlineMath' }),
    generateTikz(createThreeDimensionalDiagram(), { exportMode: 'inlineMath' }),
    generateTikz(createEmptyDiagram({ ambientDimension: 2 }), {
      exportMode: 'inlineMath',
    }),
    generateTikz(createEmptyDiagram({ ambientDimension: 3 }), {
      exportMode: 'inlineMath',
    }),
  ]

  for (const tikz of outputs) {
    assert.ok(tikz.startsWith(`\\begin{tikzpicture}[${baseline}`))
    assert.equal(countMatches(tikz, new RegExp(escapeRegExp(baseline), 'g')), 1)
    expectNoBlankLines(tikz)
  }
})

test('inline math output emits no active setup before tikzpicture begin', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    exportMode: 'inlineMath',
    includeCoordinateAxes: true,
  })
  const beforeBegin = tikz.slice(0, tikz.indexOf('\\begin{tikzpicture}'))

  assert.equal(beforeBegin.trim(), '')
  expectNoBlankLines(tikz)
})

test('inline math output places color definitions inside the tikzpicture', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    exportMode: 'inlineMath',
  })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const colorIndex = tikz.indexOf('\\definecolor{stzSheetpageFill}{HTML}{4D9DE0}')
  const endIndex = tikz.indexOf('\\end{tikzpicture}')

  assert.ok(beginIndex < colorIndex)
  assert.ok(colorIndex < endIndex)
  expectNoBlankLines(tikz)
})

test('inline math output emits user presets with local tikzset inside the picture', () => {
  const diagram = createTwoDimensionalDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Inline curve',
    {
      ...curve.style,
      strokeColor: '#000000',
      lineWidth: 0.8,
    },
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const tikz = generateTikz(withPreset, { exportMode: 'inlineMath' })
  const beginLine = tikz.slice(0, tikz.indexOf('\n'))
  const colorIndex = tikz.indexOf('\\definecolor')
  const tikzsetIndex = tikz.indexOf('\\tikzset{')
  const styleDefinition = 'stratifiedStyleInlineCurve/.style='

  assert.ok(colorIndex < tikzsetIndex)
  assert.match(tikz, /\\tikzset\{[\s\S]*stratifiedStyleInlineCurve\/\.style=\{draw=stzStyleusercurveinlinecurveStroke, draw opacity=1, line width=0\.8pt\}[\s\S]*\}/)
  assert.doesNotMatch(beginLine, /stratifiedStyleInlineCurve\/\.style=/)
  assert.ok(tikz.indexOf(styleDefinition) > tikz.indexOf('\\begin{tikzpicture}'))
  assert.ok(tikz.indexOf(styleDefinition) < tikz.indexOf('% Coordinates'))
  expectNoBlankLines(tikz)
})

test('inline math output places layer setup inside the picture before scopes', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    exportMode: 'inlineMath',
  })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const declareIndex = tikz.indexOf('\\pgfdeclarelayer{stratifiedLayer0}')
  const setLayersIndex = tikz.indexOf('\\pgfsetlayers{stratifiedLayer0,main}')
  const tdplotScopeIndex = tikz.indexOf('\\begin{scope}[tdplot_main_coords]')
  const endIndex = tikz.indexOf('\\end{tikzpicture}')

  assert.ok(beginIndex < declareIndex)
  assert.ok(declareIndex < setLayersIndex)
  assert.ok(setLayersIndex < tdplotScopeIndex)
  assert.ok(tdplotScopeIndex < endIndex)
  expectNoBlankLines(tikz)
})

test('inline 3D output keeps camera setup inside the picture and scopes content', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    camera3d: camera,
    exportMode: 'inlineMath',
  })
  const beginLine = tikz.slice(0, tikz.indexOf('\n'))
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const cameraIndex = tikz.indexOf('\\tdplotsetmaincoords{70}{110}')
  const scopeIndex = tikz.indexOf('\\begin{scope}[tdplot_main_coords]')
  const coordinateIndex = tikz.indexOf('\\coordinate (curvePolyLine0p0) at (0,0,1);')
  const scopeEndIndex = tikz.indexOf('\\end{scope}', scopeIndex)

  assert.doesNotMatch(beginLine, /tdplot_main_coords/)
  assert.ok(beginIndex < cameraIndex)
  assert.ok(cameraIndex < scopeIndex)
  assert.ok(scopeIndex < coordinateIndex)
  assert.ok(coordinateIndex < scopeEndIndex)
  expectNoBlankLines(tikz)
})

test('inline math output keeps imported style comments inside without inlining imports', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-draw',
    '3cat/phys/1strata/color/x',
    ['draw', 'curve'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === 'wire'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-draw' }
      : stratum,
  )

  const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const commentIndex = tikz.indexOf('% External TikZ styles referenced below.')
  const keyIndex = tikz.indexOf('3cat/phys/1strata/color/x')

  assert.ok(beginIndex < commentIndex)
  assert.ok(commentIndex < keyIndex)
  assert.doesNotMatch(tikz, /\\tikzset\{/)
  assert.doesNotMatch(tikz, /^\\input\{mygeometry\.sty\}/m)
  expectNoBlankLines(tikz)
})

test('inline math output has no blank lines for Phase 18C regression cases', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const externalStyleDiagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-draw',
    '3cat/phys/1strata/color/x',
    ['draw', 'curve'],
  )
  externalStyleDiagram.strata = externalStyleDiagram.strata.map((stratum) =>
    stratum.id === 'wire'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-draw' }
      : stratum,
  )
  const cases = [
    {
      name: '2D output',
      output: generateTikz(createTwoDimensionalDiagram(), {
        exportMode: 'inlineMath',
      }),
      expectedPattern: /\\coordinate \(curvePolyWire0p0\) at \(0,0\);/,
    },
    {
      name: '3D output',
      output: generateTikz(createThreeDimensionalDiagram(), {
        exportMode: 'inlineMath',
      }),
      expectedPattern: /\\coordinate \(curvePolyLine0p0\) at \(0,0,1\);/,
    },
    {
      name: 'custom colors',
      output: generateTikz(createThreeDimensionalDiagram(), {
        exportMode: 'inlineMath',
      }),
      expectedPattern: /\\definecolor\{stzSheetpageFill\}\{HTML\}\{4D9DE0\}/,
    },
    {
      name: 'layers',
      output: generateTikz(createLayeredTwoDimensionalDiagram(), {
        exportMode: 'inlineMath',
      }),
      expectedPattern: /\\pgfdeclarelayer\{stratifiedLayerMinus1\}/,
    },
    {
      name: 'camera',
      output: generateTikz(createThreeDimensionalDiagram(), {
        camera3d: camera,
        exportMode: 'inlineMath',
      }),
      expectedPattern: /\\tdplotsetmaincoords\{70\}\{110\}/,
    },
    {
      name: 'external style comments',
      output: generateTikz(externalStyleDiagram, {
        exportMode: 'inlineMath',
      }),
      expectedPattern: /% External TikZ styles referenced below\./,
    },
    {
      name: 'user presets',
      output: generateTikz(createTwoDimensionalDiagramWithCurvePreset(), {
        exportMode: 'inlineMath',
      }),
      expectedPattern: /\\tikzset\{/,
    },
  ] satisfies Array<{
    name: string
    output: string
    expectedPattern: RegExp
  }>

  for (const { name, output, expectedPattern } of cases) {
    assert.match(output, expectedPattern, name)
    assert.doesNotMatch(output, /\n\s*\n/, name)
    expectNoBlankLines(output, name)
  }
})

test('inline math output has no leading or trailing blank line', () => {
  const outputs = [
    generateTikz(createTwoDimensionalDiagram(), {
      exportMode: 'inlineMath',
    }),
    generateTikz(createThreeDimensionalDiagram(), {
      exportMode: 'inlineMath',
      includeCoordinateAxes: true,
    }),
    generateTikz(createEmptyDiagram({ ambientDimension: 2 }), {
      exportMode: 'inlineMath',
    }),
  ]

  for (const output of outputs) {
    expectNoLeadingOrTrailingBlankLine(output)
    expectNoBlankLines(output)
  }
})

test('inline math output uses comment separators for readability', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    exportMode: 'inlineMath',
  })

  assert.match(
    tikz,
    /    %----------------------------------------\n    % Styles and colors\n    %----------------------------------------/,
  )
  assert.match(
    tikz,
    /    %----------------------------------------\n    % Local colors\n    %----------------------------------------/,
  )
  assert.match(
    tikz,
    /    %----------------------------------------\n    % TikZ layers\n    %----------------------------------------/,
  )
  assert.match(
    tikz,
    /        %----------------------------------------\n        % Layered drawing commands\n        %----------------------------------------/,
  )
  assert.ok(
    countMatches(tikz, /^\s*%----------------------------------------$/gm) >= 8,
  )
  expectNoBlankLines(tikz)
})

test('standalone output uses four-space indentation inside tikzpicture', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram(), {
    exportMode: 'standalone',
  })

  assert.match(tikz, /\n    \\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\n    \\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('inline output uses four-space indentation inside tikzpicture', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram(), {
    exportMode: 'inlineMath',
  })

  assert.match(tikz, /\n    \\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\n    \\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  expectNoTwoSpaceCommandIndent(tikz)
  expectNoBlankLines(tikz)
})

test('pgfonlayer bodies are indented one level deeper than layer blocks', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())
  const lines = tikz.split('\n')
  const layerName = 'stratifiedLayer0'
  const beginIndex = lines.findIndex(
    (line) => line === `    \\begin{pgfonlayer}{${layerName}}`,
  )
  const endIndex = lines.findIndex(
    (line, index) =>
      index > beginIndex && line === '    \\end{pgfonlayer}',
  )
  const bodyLines = lines.slice(beginIndex + 1, endIndex)

  assert.notEqual(beginIndex, -1)
  assert.notEqual(endIndex, -1)
  assert.ok(bodyLines.some((line) => line.startsWith('        \\draw[')))
  assert.doesNotMatch(bodyLines.join('\n'), /^  \\(?:draw|coordinate|node)/m)
})

test('inline 3D scope and nested pgfonlayer indentation use four-space levels', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    exportMode: 'inlineMath',
  })
  const lines = tikz.split('\n')
  const scopeBeginIndex = lines.findIndex(
    (line) => line === '    \\begin{scope}[tdplot_main_coords]',
  )
  const scopeEndIndex = lines.findIndex(
    (line, index) => index > scopeBeginIndex && line === '    \\end{scope}',
  )
  const layerBeginIndex = lines.findIndex(
    (line, index) =>
      index > scopeBeginIndex &&
      index < scopeEndIndex &&
      line === '        \\begin{pgfonlayer}{stratifiedLayer0}',
  )
  const layerEndIndex = lines.findIndex(
    (line, index) =>
      index > layerBeginIndex &&
      index < scopeEndIndex &&
      line === '        \\end{pgfonlayer}',
  )
  const layerBodyLines = lines.slice(layerBeginIndex + 1, layerEndIndex)

  assert.notEqual(scopeBeginIndex, -1)
  assert.notEqual(scopeEndIndex, -1)
  assert.notEqual(layerBeginIndex, -1)
  assert.notEqual(layerEndIndex, -1)
  assert.ok(
    layerBodyLines.some((line) => line.startsWith('            \\filldraw[')),
  )
  expectNoTwoSpaceCommandIndent(tikz)
  expectNoBlankLines(tikz)
})

test('inline indentation keeps no blank lines across regression cases', () => {
  const layered = createLayeredTwoDimensionalDiagram()
  const multilineLabel = createTextLabelDiagram('A\n\nB')
  const outputs = [
    generateTikz(createTwoDimensionalDiagram(), { exportMode: 'inlineMath' }),
    generateTikz(createThreeDimensionalDiagram(), { exportMode: 'inlineMath' }),
    generateTikz(layered, { exportMode: 'inlineMath' }),
    generateTikz(multilineLabel, { exportMode: 'inlineMath' }),
  ]

  for (const output of outputs) {
    expectNoBlankLines(output)
  }
})

test('inline math output normalizes embedded label newlines', () => {
  const labelTexts = [
    { text: 'A\n\nB', nodePattern: /\\node at \(0,0\) \{A B\};/ },
    { text: 'A\nB', nodePattern: /\\node at \(0,0\) \{A B\};/ },
    { text: '\nA\n\nB\n', nodePattern: /\\node at \(0,0\) \{\s*A B\s*\};/ },
  ] as const

  for (const { text, nodePattern } of labelTexts) {
    const diagram = createTextLabelDiagram(text)
    const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })

    expectNoBlankLines(tikz)
    assert.match(tikz, nodePattern)
    assert.match(tikz, /A/)
    assert.match(tikz, /B/)
    assert.equal(diagram.labels[0].text, text)
  }
})

test('standalone mode remains the default for representative export features', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const twoDimensionalDiagram = createTwoDimensionalExportModeRegressionDiagram()
  const threeDimensionalDiagram =
    createThreeDimensionalExportModeRegressionDiagram()

  assert.equal(
    generateTikz(twoDimensionalDiagram),
    generateTikz(twoDimensionalDiagram, { exportMode: 'standalone' }),
  )
  assert.equal(
    generateTikz(threeDimensionalDiagram, {
      camera3d: camera,
      includeCoordinateAxes: true,
    }),
    generateTikz(threeDimensionalDiagram, {
      camera3d: camera,
      exportMode: 'standalone',
      includeCoordinateAxes: true,
    }),
  )
})

test('representative inline 2D export keeps setup local and align-safe', () => {
  const tikz = generateTikz(createTwoDimensionalExportModeRegressionDiagram(), {
    exportMode: 'inlineMath',
  })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const colorIndex = tikz.indexOf(
    '\\definecolor{stzStyleuserregioninlineregionFill}{HTML}{112233}',
  )
  const tikzsetBlock = extractTikzsetBlock(tikz)
  const externalCommentIndex = tikz.indexOf(
    '% External TikZ styles referenced below.',
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayerMinus1')

  assert.equal(tikz.slice(0, beginIndex).trim(), '')
  assert.match(
    tikz,
    /\\begin\{tikzpicture\}\[baseline=\{\(\[yshift=-\.5ex\]current bounding box\.center\)\}/,
  )
  assert.ok(beginIndex < externalCommentIndex)
  assert.ok(beginIndex < colorIndex)
  assert.ok(colorIndex < tikz.indexOf('\\tikzset{'))
  assert.match(
    tikzsetBlock,
    /stratifiedStyleInlineRegion\/\.style=\{fill=stzStyleuserregioninlineregionFill, fill opacity=0\.42, draw=stzStyleuserregioninlineregionStroke, draw opacity=0\.73\}/,
  )
  assert.doesNotMatch(tikzsetBlock, /3cat\/phys\/1strata\/color\/x/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayerMinus1,stratifiedLayer2,main\}/)
  assert.match(layerBlock, /\\filldraw\[/)
  assert.match(layerBlock, /stratifiedStyleInlineRegion/)
  assert.match(layerBlock, /even odd rule/)
  assert.match(tikz, /3cat\/phys\/1strata\/color\/x/)
  assert.doesNotMatch(tikz, /^\\input\{mygeometry\.sty\}/m)
  assert.doesNotMatch(
    tikz,
    /3cat\/phys\/1strata\/color\/x\/\.style=/,
  )
  expectNoBlankLines(tikz)
})

test('representative inline 3D export keeps camera and layer setup local', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(createThreeDimensionalExportModeRegressionDiagram(), {
    camera3d: camera,
    exportMode: 'inlineMath',
    includeCoordinateAxes: true,
  })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const cameraIndex = tikz.indexOf('\\tdplotsetmaincoords{70}{110}')
  const tdplotScopeIndex = tikz.indexOf('\\begin{scope}[tdplot_main_coords]')
  const libraryIndex = tikz.indexOf('\\usetikzlibrary{3d}')
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer3')

  assert.equal(tikz.slice(0, beginIndex).trim(), '')
  assert.match(
    tikz,
    /\\begin\{tikzpicture\}\[baseline=\{\(\[yshift=-\.5ex\]current bounding box\.center\)\}/,
  )
  assert.ok(beginIndex < libraryIndex)
  assert.ok(beginIndex < cameraIndex)
  assert.ok(cameraIndex < tdplotScopeIndex)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedGuideLayer,stratifiedLayer1,stratifiedLayer3,stratifiedLayer4,main\}/,
  )
  assert.match(tikz, /% Requires \\usepackage\{tikz-3dplot\}/)
  assert.match(tikz, /% \\usetikzlibrary\{shapes\.geometric,shapes\.symbols\}/)
  assert.match(tikz, /\\definecolor\{stzSheetfilledsheetFill\}\{HTML\}\{ABCDEF\}/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /fill opacity=0\.28/)
  assert.match(layerBlock, /draw opacity=0\.66/)
  assert.match(tikz, /\\coordinate \(curvePolyCameraLine0p0\) at \(0,0,0\);/)
  assert.match(tikz, /regular polygon sides=3/)
  expectNoBlankLines(tikz)
})

test('standalone output keeps blank-line section spacing', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram(), {
    exportMode: 'standalone',
  })

  assert.match(tikz, /\n\s*\n/)
})

test('standalone output preserves multiline label text', () => {
  const diagram = createTextLabelDiagram('A\n\nB')
  const tikz = generateTikz(diagram, { exportMode: 'standalone' })

  assert.ok(tikz.includes('\\node at (0,0) {A\n\nB};'))
  assert.equal(diagram.labels[0].text, 'A\n\nB')
})

test('3D TikZ output uses tikz-3dplot camera setup and 3D coordinates', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(createThreeDimensionalDiagram(), { camera3d: camera })

  assert.match(tikz, /% Requires \\usepackage\{tikz-3dplot\}/)
  assert.match(tikz, /\\tdplotsetmaincoords\{70\}\{110\}/)
  assert.match(tikz, /tdplot_main_coords/)
  assert.match(tikz, /\\coordinate \(curvePolyLine0p0\) at \(0,0,1\);/)
  assert.doesNotMatch(tikz, /x=\{\(1cm,0cm\)\}/)
  assert.doesNotMatch(tikz, /y=\{\(0\.45cm,0\.25cm\)\}/)
  assert.doesNotMatch(tikz, /z=\{\(0cm,1cm\)\}/)
  assert.ok(
    tikz.indexOf('\\tdplotsetmaincoords{70}{110}') <
      tikz.indexOf('\\begin{tikzpicture}['),
  )
})

test('3D TikZ output uses diagram view camera metadata by default', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 41,
    phiDeg: -82,
  }
  const diagram: Diagram = {
    ...createThreeDimensionalDiagram(),
    view: { camera3d: camera },
  }
  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\tdplotsetmaincoords\{41\}\{-82\}/)
})

test('surface depth sorting emits farther sheet faces before closer faces', () => {
  const diagram = createSurfaceDepthSortDiagram()
  const disabled = generateTikz(diagram)
  const sorted = generateTikz(diagram, {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.ok(disabled.indexOf('Near sheet') < disabled.indexOf('Far sheet'))
  assert.ok(sorted.indexOf('Far sheet') < sorted.indexOf('Near sheet'))
  assert.match(sorted, /Auto surface face depth sort/)
  assert.doesNotMatch(sorted, /NaN|Infinity/)
})

test('disabled surface depth sorting leaves existing TikZ output unchanged', () => {
  const diagram = createSurfaceDepthSortDiagram()

  assert.equal(
    generateTikz(diagram, {
      visibility: {
        ...enabledVisibilityOptions('layerThenDepth'),
        enabled: false,
      },
    }),
    generateTikz(diagram),
  )
})

test('inline surface depth sorted TikZ output has no blank lines', () => {
  const tikz = generateTikz(createSurfaceDepthSortDiagram(), {
    exportMode: 'inlineMath',
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto surface face depth sort/)
  expectNoBlankLines(tikz)
})

test('ruled surface with hidden curve exports sorted faces and hidden segments', () => {
  const tikz = generateTikz(createRuledSurfaceOcclusionDiagram(), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto surface face depth sort/)
  assert.match(tikz, /Ruled Occluding Sheet/)
  assert.match(tikz, /Auto curve occlusion/)
  assert.match(tikz, /Hidden sampled segment/)
  assert.match(tikz, /Visible sampled segment/)
  assert.match(tikz, /densely dotted/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('Coons patch exports finite sampled mesh TikZ', () => {
  const tikz = generateTikz(createCoonsPatchDiagram())

  assert.match(tikz, /Coons patch generated/)
  assert.match(tikz, /Primitive: coonsPatch; sampling: u=4, v=3; faces=12/)
  assert.equal((tikz.match(/\\filldraw/g) ?? []).length, 12)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('auto visibility enabled changes representative output deterministically', () => {
  const diagram = createRuledSurfaceOcclusionDiagram()
  const disabled = generateTikz(diagram)
  const first = generateTikz(diagram, {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })
  const second = generateTikz(diagram, {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.equal(first, second)
  assert.notEqual(first, disabled)
  assert.match(first, /Auto surface face depth sort/)
  assert.match(first, /Auto curve occlusion/)
})

test('surface face sorting cap falls back with a TikZ warning comment', () => {
  const tikz = generateTikz(createCurvedHemisphereSheetDiagram(), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      maxSurfaceFacesForSorting: 4,
    },
  })

  assert.match(tikz, /Auto surface face depth sort skipped/)
  assert.match(
    tikz,
    /at least 5 faces exceed the maxSurfaceFacesForSorting cap of 4/,
  )
  assert.match(tikz, /Curved sheet "Curved Hemisphere"/)
  assert.doesNotMatch(tikz, /Auto surface face depth sort: sheet/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('inline surface face sorting cap fallback has no blank lines', () => {
  const tikz = generateTikz(createCurvedHemisphereSheetDiagram(), {
    exportMode: 'inlineMath',
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      maxSurfaceFacesForSorting: 4,
    },
  })

  assert.match(tikz, /Auto surface face depth sort skipped/)
  assert.match(
    tikz,
    /at least 5 faces exceed the maxSurfaceFacesForSorting cap of 4/,
  )
  assert.doesNotMatch(tikz, /Auto surface face depth sort: sheet/)
  expectNoBlankLines(tikz)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('auto visibility preserves layer-aware TikZ output', () => {
  const diagram = createRuledSurfaceOcclusionDiagram()

  diagram.strata = diagram.strata.map((stratum) =>
    stratum.geometricKind === 'sheet'
      ? { ...stratum, layer: 2 }
      : { ...stratum, layer: 1 },
  )

  const tikz = generateTikz(diagram, {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })
  const sheetLayer = extractLayerBlock(tikz, 'stratifiedLayer2')
  const curveLayer = extractLayerBlock(tikz, 'stratifiedLayer1')

  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer1,stratifiedLayer2,main\}/)
  assert.match(sheetLayer, /Auto surface face depth sort/)
  assert.match(curveLayer, /Auto curve occlusion/)
  assert.match(curveLayer, /Hidden sampled segment/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('curve occlusion TikZ output applies hidden sampled segment style', () => {
  const diagram = createCurveOcclusionDiagram()
  const tikz = generateTikz(diagram, {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      hiddenCurveStyle: {
        lineStyle: 'dashed',
        opacity: 0.4,
      },
    },
  })

  assert.match(tikz, /Auto curve occlusion/)
  assert.match(tikz, /Hidden sampled segment/)
  assert.match(tikz, /Visible sampled segment/)
  assert.match(tikz, /dashed/)
  assert.match(tikz, /draw opacity=0\.4/)
})

test('disabled curve occlusion visibility preserves normal TikZ output', () => {
  const diagram = createCurveOcclusionDiagram()

  assert.equal(
    generateTikz(diagram, {
      visibility: {
        ...enabledVisibilityOptions('layerThenDepth'),
        enabled: false,
      },
    }),
    generateTikz(diagram),
  )
})

test('inline curve occlusion TikZ output has no blank lines', () => {
  const tikz = generateTikz(createCurveOcclusionDiagram(), {
    exportMode: 'inlineMath',
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto curve occlusion/)
  expectNoBlankLines(tikz)
})

test('curve sample cap falls back with a TikZ warning comment', () => {
  const tikz = generateTikz(createStraightCurveOcclusionDiagram('polyline'), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      maxCurveSamples: 2,
    },
  })

  assert.match(tikz, /Auto curve occlusion skipped/)
  assert.match(tikz, /maxCurveSamples cap of 2/)
  assert.doesNotMatch(tikz, /Hidden sampled segment/)
  assert.match(
    tikz,
    /\\coordinate \(curvePolyStraightOcclusionPolyline0p0\) at \(-2,-1,0\);/,
  )
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('curve occlusion surface face cap TikZ fallback emits original curve only', () => {
  const tikz = generateTikz(createSurfaceFaceCapCurveOcclusionDiagram(), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      maxSurfaceFacesForSorting: 1,
    },
  })

  assert.match(tikz, /Auto curve occlusion skipped/)
  assert.match(
    tikz,
    /\n        % Auto curve occlusion skipped for curve "Partly Hidden Curve" \[partly-hidden-curve\] because surface face count exceeds the maxSurfaceFacesForSorting cap of 1\./,
  )
  assert.match(
    tikz,
    /surface face count exceeds the maxSurfaceFacesForSorting cap of 1/,
  )
  assert.doesNotMatch(tikz, /Hidden sampled segment/)
  assert.doesNotMatch(tikz, /Visible sampled segment/)
  assert.doesNotMatch(tikz, /densely dotted/)
  assert.match(
    tikz,
    /\\coordinate \(curvePolyPartlyHiddenCurve0p3\) at \(2,-1,0\);/,
  )
  assert.match(
    tikz,
    /\(curvePolyPartlyHiddenCurve0p2\) -- \(curvePolyPartlyHiddenCurve0p3\);/,
  )
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('inline curve occlusion surface face cap fallback has no blank lines', () => {
  const tikz = generateTikz(createSurfaceFaceCapCurveOcclusionDiagram(), {
    exportMode: 'inlineMath',
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      maxSurfaceFacesForSorting: 1,
    },
  })

  assert.match(tikz, /Auto curve occlusion skipped/)
  assert.doesNotMatch(tikz, /Hidden sampled segment/)
  expectNoBlankLines(tikz)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('straight polyline curve occlusion TikZ output splits visible hidden visible runs', () => {
  const tikz = generateTikz(createStraightCurveOcclusionDiagram('polyline'), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /Visible sampled segment/g), 2)
  assert.equal(countMatches(tikz, /Hidden sampled segment/g), 1)
  assert.match(tikz, /densely dotted/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('backtracking curve occlusion TikZ output preserves both directions', () => {
  const tikz = generateTikz(createBacktrackingCurveOcclusionDiagram(), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /Visible sampled segment/g), 2)
  assert.match(
    tikz,
    /\\coordinate \(curvePolyBacktrackingCurve0Occlusionp0\) at \(0,1,0\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolyBacktrackingCurve0Occlusionp1\) at \(1,1,0\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolyBacktrackingCurve0Occlusionp2\) at \(1,1,0\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolyBacktrackingCurve0Occlusionp3\) at \(0,1,0\);/,
  )
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('long visible capped curve occlusion TikZ output falls back to original curve', () => {
  const tikz = generateTikz(createLongCurveOcclusionDiagram('visible'), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto curve occlusion skipped/)
  assert.match(tikz, /maxCurveSamples cap of 512/)
  assert.match(
    tikz,
    /\\coordinate \(curvePolyLongVisibleCurve0p30\) at \(30,1,0\);/,
  )
  assert.match(
    tikz,
    /\(curvePolyLongVisibleCurve0p29\) -- \(curvePolyLongVisibleCurve0p30\);/,
  )
  assert.doesNotMatch(tikz, /21\.333/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('long hidden capped curve occlusion TikZ output falls back to original curve', () => {
  const tikz = generateTikz(createLongCurveOcclusionDiagram('hidden'), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto curve occlusion skipped/)
  assert.match(tikz, /maxCurveSamples cap of 512/)
  assert.doesNotMatch(tikz, /Hidden sampled segment/)
  assert.match(
    tikz,
    /\\coordinate \(curvePolyLongHiddenCurve0p30\) at \(30,-1,0\);/,
  )
  assert.match(
    tikz,
    /\(curvePolyLongHiddenCurve0p29\) -- \(curvePolyLongHiddenCurve0p30\);/,
  )
  assert.doesNotMatch(tikz, /21\.333/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('straight line path occlusion TikZ output preserves style overrides', () => {
  const tikz = generateTikz(
    createStraightCurveOcclusionDiagram('linePath', {
      strokeColor: '#AA0033',
      strokeOpacity: 0.8,
      lineWidth: 2.4,
      lineStyle: 'dotted',
    }),
    {
      visibility: {
        ...enabledVisibilityOptions('layerThenDepth'),
        hiddenCurveStyle: {
          lineStyle: 'dashed',
          opacity: 0.5,
        },
      },
    },
  )

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /Visible sampled segment/g), 2)
  assert.equal(countMatches(tikz, /Hidden sampled segment/g), 1)
  assert.match(tikz, /\{HTML\}\{AA0033\}/)
  assert.match(tikz, /line width=2\.4pt/)
  assert.match(tikz, /dotted/)
  assert.match(tikz, /dashed/)
  assert.match(tikz, /draw opacity=0\.4/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('inline straight line path occlusion TikZ output has no blank lines', () => {
  const tikz = generateTikz(createStraightCurveOcclusionDiagram('linePath'), {
    exportMode: 'inlineMath',
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /Hidden sampled segment/g), 1)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
  expectNoBlankLines(tikz)
})

test('disabled straight line path occlusion preserves normal TikZ output', () => {
  const diagram = createStraightCurveOcclusionDiagram('linePath')

  assert.equal(
    generateTikz(diagram, {
      visibility: {
        ...enabledVisibilityOptions('layerThenDepth'),
        enabled: false,
      },
    }),
    generateTikz(diagram),
  )
})

test('occlusion segmented curve endpoint arrows use whole-path endpoints', () => {
  const tikz = generateTikz(
    withCurveArrows(
      createStraightCurveOcclusionDiagram('polyline'),
      arrowOptions({ endpoint: 'both' }),
    ),
    { visibility: enabledVisibilityOptions('layerThenDepth') },
  )
  const hiddenIndex = tikz.indexOf('Hidden sampled segment')

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /\n\s+<-\n/g), 1)
  assert.equal(countMatches(tikz, /\n\s+->\n/g), 1)
  assert.ok(tikz.indexOf('<-') < hiddenIndex)
  assert.ok(tikz.lastIndexOf('->') > tikz.lastIndexOf('Visible sampled segment'))
  assert.match(tikz, /densely dotted/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('occlusion segmented curve mid-arrow is emitted once on hidden run', () => {
  const tikz = generateTikz(
    withCurveArrows(
      createStraightCurveOcclusionDiagram('polyline'),
      arrowOptions({ mid: { enabled: true, head: 'stealth' } }),
    ),
    {
      visibility: {
        ...enabledVisibilityOptions('layerThenDepth'),
        hiddenCurveStyle: {
          lineStyle: 'dashed',
          opacity: 0.5,
        },
      },
    },
  )
  const hiddenIndex = tikz.indexOf('Hidden sampled segment')
  const nextVisibleIndex = tikz.indexOf('Visible sampled segment', hiddenIndex)
  const markIndex = tikz.indexOf('mark=at position')
  const hiddenBlock = tikz.slice(hiddenIndex, nextVisibleIndex)

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /postaction=\{decorate\}/g), 1)
  assert.equal(countMatches(tikz, /mark=at position/g), 1)
  assert.ok(hiddenIndex < markIndex)
  assert.ok(markIndex < nextVisibleIndex)
  assert.match(hiddenBlock, /dashed/)
  assert.match(hiddenBlock, /draw opacity=0\.5/)
  assert.match(hiddenBlock, /\\arrow\{Stealth\}/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('occlusion cap fallback preserves original path arrows', () => {
  const tikz = generateTikz(
    withCurveArrows(
      createSurfaceFaceCapCurveOcclusionDiagram(),
      arrowOptions({
        endpoint: 'forward',
        mid: { enabled: true, head: 'stealthHarpoon' },
      }),
      'partly-hidden-curve',
    ),
    {
      visibility: {
        ...enabledVisibilityOptions('layerThenDepth'),
        maxSurfaceFacesForSorting: 1,
      },
    },
  )

  assert.match(tikz, /Auto curve occlusion skipped/)
  assert.doesNotMatch(tikz, /Hidden sampled segment/)
  assert.match(tikz, /\n\s+->,\n/)
  assert.equal(countMatches(tikz, /mark=at position/g), 1)
  assert.match(tikz, /\\arrow\{Stealth\[harpoon\]\}/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('inline occlusion segmented curve arrows have no blank lines', () => {
  const tikz = generateTikz(
    withCurveArrows(
      createStraightCurveOcclusionDiagram('polyline'),
      arrowOptions({ endpoint: 'forward', mid: { enabled: true } }),
    ),
    {
      exportMode: 'inlineMath',
      visibility: enabledVisibilityOptions('layerThenDepth'),
    },
  )

  assert.match(tikz, /Auto curve occlusion/)
  assert.equal(countMatches(tikz, /mark=at position/g), 1)
  expectNoBlankLines(tikz)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('hidden point visibility dims hidden points by default', () => {
  const tikz = generateTikz(createPointAndLabelVisibilityDiagram(), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.match(tikz, /Auto point visibility/)
  assert.match(tikz, /hidden behind sheet \[occluding-sheet\] face 0 and dimmed/)
  assert.match(tikz, /opacity=0\.28/)
  assert.match(tikz, /\\node\[/)
  assert.match(tikz, /pointHiddenPoint0p0/)
})

test('hidden point visibility can omit hidden points', () => {
  const tikz = generateTikz(createPointAndLabelVisibilityDiagram(), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      pointVisibility: 'hideHidden',
    },
  })

  assert.match(tikz, /Auto point visibility/)
  assert.match(tikz, /hidden behind sheet \[occluding-sheet\] face 0 and omitted/)
  assert.doesNotMatch(tikz, /pointHiddenPoint0p0/)
})

test('labels remain foreground by default when visibility is enabled', () => {
  const tikz = generateTikz(createPointAndLabelVisibilityDiagram(), {
    visibility: enabledVisibilityOptions('layerThenDepth'),
  })

  assert.doesNotMatch(tikz, /Auto label visibility/)
  assert.match(tikz, /\\node at \(0,-1,0\) \{\$L\$\};/)
})

test('label auto visibility can dim or hide hidden labels', () => {
  const dimmed = generateTikz(createPointAndLabelVisibilityDiagram(), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      labelVisibility: 'autoDim',
    },
  })
  const hidden = generateTikz(createPointAndLabelVisibilityDiagram(), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      labelVisibility: 'autoHide',
    },
  })

  assert.match(dimmed, /Auto label visibility/)
  assert.match(dimmed, /opacity=0\.35/)
  assert.match(dimmed, /\{\$L\$\};/)
  assert.match(hidden, /Auto label visibility/)
  assert.match(hidden, /hidden behind sheet \[occluding-sheet\] face 0 and omitted/)
  assert.doesNotMatch(hidden, /\{\$L\$\};/)
})

test('disabling curve occlusion keeps surface sorting enabled independently', () => {
  const tikz = generateTikz(createCurveOcclusionDiagram(), {
    visibility: {
      ...enabledVisibilityOptions('layerThenDepth'),
      curveOcclusion: false,
    },
  })

  assert.match(tikz, /Auto surface face depth sort/)
  assert.doesNotMatch(tikz, /Auto curve occlusion/)
  assert.match(tikz, /\\draw\[/)
})

test('current camera option overrides saved diagram camera metadata', () => {
  const savedCamera = {
    ...createInitialCamera3D(),
    thetaDeg: 20,
    phiDeg: 30,
  }
  const currentCamera = {
    ...createInitialCamera3D(),
    thetaDeg: 75,
    phiDeg: 125,
  }
  const diagram: Diagram = {
    ...createThreeDimensionalDiagram(),
    view: { camera3d: savedCamera },
  }
  const tikz = generateTikz(diagram, { camera3d: currentCamera })

  assert.match(tikz, /\\tdplotsetmaincoords\{75\}\{125\}/)
  assert.doesNotMatch(tikz, /\\tdplotsetmaincoords\{20\}\{30\}/)
})

test('changing camera theta and phi changes generated TikZ camera setup', () => {
  const diagram = createThreeDimensionalDiagram()
  const first = generateTikz(diagram, {
    camera3d: { ...createInitialCamera3D(), thetaDeg: 25, phiDeg: 35 },
  })
  const second = generateTikz(diagram, {
    camera3d: { ...createInitialCamera3D(), thetaDeg: 80, phiDeg: 120 },
  })

  assert.equal(extractMainCoords(first), '\\tdplotsetmaincoords{25}{35}')
  assert.equal(extractMainCoords(second), '\\tdplotsetmaincoords{80}{120}')
  assert.notEqual(extractMainCoords(first), extractMainCoords(second))
})

test('reset to initial camera restores initial TikZ camera values', () => {
  const diagram = createThreeDimensionalDiagram()
  const changed = generateTikz(diagram, {
    camera3d: { ...createInitialCamera3D(), thetaDeg: 80, phiDeg: 120 },
  })
  const reset = generateTikz(diagram, {
    camera3d: resetCameraToInitial(),
  })

  assert.match(changed, /\\tdplotsetmaincoords\{80\}\{120\}/)
  assert.match(reset, /\\tdplotsetmaincoords\{13\}\{-23\}/)
})

test('3D TikZ export rejects unsupported perspective cameras', () => {
  const camera: PerspectiveCamera3D = {
    mode: '3d',
    kind: 'perspective',
    thetaDeg: 70,
    phiDeg: 110,
    zoom: 1,
    pan: { x: 0, y: 0 },
    target: { x: 0, y: 0, z: 0 },
    distance: 8,
    fieldOfViewDeg: 45,
  }

  assert.throws(
    () => generateTikz(createThreeDimensionalDiagram(), { camera3d: camera }),
    /Perspective TikZ export is not supported/,
  )
})

test('TikZ output excludes coordinate axes by default', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.doesNotMatch(tikz, /Coordinate axes guide/)
  assert.doesNotMatch(tikz, /stratifiedGuideLayer/)
  assert.doesNotMatch(tikz, /\{\$x\$\}/)
  assert.doesNotMatch(tikz, /\{\$y\$\}/)
  assert.doesNotMatch(tikz, /\{\$z\$\}/)
})

test('2D TikZ output ignores the 3D coordinate axes export option', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram(), {
    includeCoordinateAxes: true,
    camera3d: createInitialCamera3D(),
  })

  assert.doesNotMatch(tikz, /Coordinate axes guide/)
  assert.doesNotMatch(tikz, /stratifiedGuideLayer/)
  assert.doesNotMatch(tikz, /\{\$x\$\}/)
  assert.doesNotMatch(tikz, /tikz-3dplot/)
  assert.doesNotMatch(tikz, /\\tdplotsetmaincoords/)
  assert.doesNotMatch(tikz, /tdplot_main_coords/)
})

test('TikZ output includes a guide layer when coordinate axes export is enabled', () => {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const tikz = generateTikz(createThreeDimensionalDiagram(), {
    includeCoordinateAxes: true,
    camera3d: camera,
  })

  assert.match(tikz, /\\tdplotsetmaincoords\{70\}\{110\}/)
  assert.match(tikz, /tdplot_main_coords/)
  assert.match(tikz, /\\definecolor\{stzCoordinateAxesGuide\}\{HTML\}\{64748B\}/)
  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedGuideLayer\}/)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedGuideLayer,stratifiedLayer0,main\}/,
  )
  assert.match(tikz, /% Coordinate axes guide/)
  assert.match(
    tikz,
    /% Optional 3D coordinate axes guide\. This is not a stratum\./,
  )
  assert.match(tikz, /\(0,0,0\) -- \(2\.5,0,0\);/)
  assert.match(tikz, /\(0,0,0\) -- \(0,2\.5,0\);/)
  assert.match(tikz, /\(0,0,0\) -- \(0,0,2\.5\);/)
  assert.match(tikz, /\] at \(2\.75,0,0\) \{\$x\$\};/)
  assert.match(tikz, /\] at \(0,2\.75,0\) \{\$y\$\};/)
  assert.match(tikz, /\] at \(0,0,2\.75\) \{\$z\$\};/)
  assert.ok(
    tikz.indexOf('\\begin{tikzpicture}[') <
      tikz.indexOf('% Coordinate axes guide'),
  )
})

test('coordinate axes export does not affect ordinary strata or labels', () => {
  const diagram = createThreeDimensionalDiagram()
  diagram.labels.push({
    geometricKind: 'label',
    id: 'ordinary-label',
    name: 'Ordinary label',
    text: '$L$',
    position: { x: 2, y: 2, z: 2 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  const withoutAxes = generateTikz(diagram)
  const withAxes = generateTikz(diagram, { includeCoordinateAxes: true })

  assert.deepEqual(
    extractCoordinateNames(withAxes),
    extractCoordinateNames(withoutAxes),
  )
  assert.match(withAxes, /\\coordinate \(curvePolyLine0p0\) at \(0,0,1\);/)
  assert.match(withAxes, /\\node at \(2,2,2\) \{\$L\$\};/)
})

test('empty 3D TikZ output includes only axes when the option is enabled', () => {
  const tikz = generateTikz(createEmptyDiagram({ ambientDimension: 3 }), {
    includeCoordinateAxes: true,
  })

  assert.match(tikz, /\\pgfsetlayers\{stratifiedGuideLayer,main\}/)
  assert.match(tikz, /\(0,0,0\) -- \(2\.5,0,0\);/)
  assert.match(tikz, /\] at \(0,0,2\.75\) \{\$z\$\};/)
  assert.doesNotMatch(tikz, /\\coordinate /)
  assert.match(tikz, /% Codimension 1 strata: sheets/)
  assert.match(tikz, /% Labels/)
})

test('standalone output emits pgfmathsetmacro variables before tikzpicture', () => {
  const tikz = generateTikz(createVariableDiagram())
  const variableIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')

  assert.notEqual(variableIndex, -1)
  assert.notEqual(beginIndex, -1)
  assert.ok(variableIndex < beginIndex)
  assert.match(tikz, /\\pgfmathsetmacro\{\\q\}\{30\}/)
})

test('valid variable names still export as pgfmathsetmacro definitions', () => {
  const tikz = generateTikz({
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'var-radius',
        name: 'radius',
        macroName: 'radius',
        expression: '2',
        previewValue: 2,
      },
    ],
  })

  assert.match(tikz, /\\pgfmathsetmacro\{\\radius\}\{2\}/)
})

test('TikZ export does not emit reserved variable macro names', () => {
  const unsafeImplicit = generateTikz({
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'var-draw',
        name: 'draw',
        macroName: 'draw',
        expression: '2',
        previewValue: 2,
      },
      {
        id: 'var-node',
        name: 'node',
        macroName: 'node',
        expression: '3',
        previewValue: 3,
      },
    ],
  })
  const unsafeExplicit = generateTikz({
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'var-radius',
        name: 'radius',
        macroName: 'draw',
        expression: '2',
        previewValue: 2,
      },
    ],
  })

  assert.doesNotMatch(unsafeImplicit, /\\pgfmathsetmacro\{\\draw\}/)
  assert.doesNotMatch(unsafeImplicit, /\\pgfmathsetmacro\{\\node\}/)
  assert.doesNotMatch(unsafeExplicit, /\\pgfmathsetmacro\{\\draw\}/)
  assert.match(unsafeImplicit, /Variable omitted/)
  assert.match(unsafeExplicit, /Variable omitted/)
})

test('dependent variables export in dependency order', () => {
  const tikz = generateTikz(createDependentVariableDiagram())
  const rIndex = tikz.indexOf('\\pgfmathsetmacro{\\r}{\\R / 2}')
  const rDependencyIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')

  assert.notEqual(rIndex, -1)
  assert.notEqual(rDependencyIndex, -1)
  assert.ok(rDependencyIndex < rIndex)
})

test('inline output emits variables inside tikzpicture with no blank lines', () => {
  const tikz = generateTikz(createVariableDiagram(), { exportMode: 'inlineMath' })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const variableSectionIndex = tikz.indexOf('% Variables')
  const variableIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const coordinateIndex = tikz.indexOf('% Coordinates')
  const endIndex = tikz.indexOf('\\end{tikzpicture}')

  assert.notEqual(beginIndex, -1)
  assert.notEqual(variableSectionIndex, -1)
  assert.notEqual(variableIndex, -1)
  assert.ok(beginIndex < variableSectionIndex)
  assert.ok(variableSectionIndex < variableIndex)
  assert.ok(variableIndex < coordinateIndex)
  assert.ok(coordinateIndex < endIndex)
  expectNoBlankLines(tikz)
})

test('standalone symbolic export emits variables before symbolic coordinates', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 2,
    geometricKind: 'point',
    id: 'orbit-point',
    name: 'Orbit point',
    style: pointStyle(),
    position: symbolicVec3(
      symbolicComponent('R*cos(q)', Math.sqrt(3)),
      symbolicComponent('R*sin(q)', 1),
      0,
    ),
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const variableIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const coordinateIndex = tikz.indexOf(
    '\\coordinate (pointOrbitPoint0p0) at ({\\R * cos(\\q)},{\\R * sin(\\q)});',
  )
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')

  assert.notEqual(variableIndex, -1)
  assert.notEqual(coordinateIndex, -1)
  assert.ok(variableIndex < beginIndex)
  assert.ok(variableIndex < coordinateIndex)
})

test('inline symbolic export emits variables before coordinates with no blank lines', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 2,
    geometricKind: 'point',
    id: 'inline-symbolic-point',
    name: 'Inline symbolic point',
    style: pointStyle(),
    position: symbolicVec3(symbolicComponent('R', 2), 0, 0),
    layer: 0,
  })

  const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })
  const beginIndex = tikz.indexOf('\\begin{tikzpicture}')
  const variableIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const coordinateIndex = tikz.indexOf(
    '\\coordinate (pointInlineSymbolicPoint0p0) at ({\\R},0);',
  )
  const endIndex = tikz.indexOf('\\end{tikzpicture}')

  assert.equal(tikz.slice(0, beginIndex).trim(), '')
  assert.notEqual(variableIndex, -1)
  assert.notEqual(coordinateIndex, -1)
  assert.ok(beginIndex < variableIndex)
  assert.ok(variableIndex < coordinateIndex)
  assert.ok(coordinateIndex < endIndex)
  expectNoBlankLines(tikz)
})

test('symbolic point coordinates export as braced TikZ expressions', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 2,
    geometricKind: 'point',
    id: 'symbolic-point',
    name: 'Symbolic point',
    style: pointStyle(),
    position: symbolicVec3(symbolicComponent('R + 1', 3), 0, 0),
    layer: 0,
  })

  assert.match(
    generateTikz(diagram),
    /\\coordinate \(pointSymbolicPoint0p0\) at \(\{\\R \+ 1\},0\);/,
  )
})

test('symbolic label positions export directly in node coordinates', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.labels.push({
    geometricKind: 'label',
    id: 'symbolic-label',
    name: 'Symbolic label',
    text: '$P$',
    position: symbolicVec3(
      symbolicComponent('R*cos(q)', Math.sqrt(3)),
      symbolicComponent('R*sin(q)', 1),
      0,
    ),
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  assert.match(
    generateTikz(diagram),
    /\\node at \(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\) \{\$P\$\};/,
  )
})

test('symbolic path vertices export through named coordinates', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'symbolic-path',
    name: 'Symbolic Path',
    style: curveStyle(),
    points: [
      symbolicVec3(symbolicComponent('R', 2), 0, 0),
      symbolicVec3(
        symbolicComponent('R*cos(q)', Math.sqrt(3)),
        symbolicComponent('R*sin(q)', 1),
        0,
      ),
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(curvePolySymbolicPath0p0\) at \(\{\\R\},0\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolySymbolicPath0p1\) at \(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\);/,
  )
})

test('symbolic cubic control coordinates export when absolute controls are used', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'symbolic-cubic',
    name: 'Symbolic Cubic',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      symbolicVec3(symbolicComponent('R', 2), 1, 0),
      symbolicVec3(3, symbolicComponent('R*sin(q)', 1), 0),
      { x: 4, y: 0, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(curveBezierSymbolicCubic0p1\) at \(\{\\R\},1\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curveBezierSymbolicCubic0p2\) at \(3,\{\\R \* sin\(\\q\)\}\);/,
  )
  assert.match(
    tikz,
    /\(curveBezierSymbolicCubic0p0\) \.\. controls \(curveBezierSymbolicCubic0p1\) and \(curveBezierSymbolicCubic0p2\) \.\. \(curveBezierSymbolicCubic0p3\);/,
  )
})

test('symbolic filled-region boundary coordinates export in boundary coordinate definitions', () => {
  const diagram = createFilledRegionDiagram({
    boundaries: [
      squareBoundaryFromPoints('symbolic-region', [
        symbolicVec3(symbolicComponent('R', 2), 0, 0),
        { x: 4, y: 0, z: 0 },
        { x: 4, y: 2, z: 0 },
        { x: 0, y: 2, z: 0 },
      ]),
    ],
  })
  diagram.variables = symbolicExportVariables()

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(regionFilledFilledRegion0b0p0\) at \(\{\\R\},0\);/,
  )
  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{2\}/)
})

test('symbolic work-plane-filled sheet boundaries use absolute coordinates to preserve expressions', () => {
  const diagram = createWorkPlaneFilledSheetDiagram({
    boundaries: [
      squareBoundaryFromPoints('symbolic-sheet', [
        symbolicVec3(symbolicComponent('R', 2), 0, 2),
        { x: 4, y: 0, z: 2 },
        { x: 4, y: 2, z: 2 },
        { x: 0, y: 2, z: 2 },
      ]),
    ],
  })
  diagram.variables = symbolicExportVariables()

  const tikz = generateTikz(diagram)

  assert.match(tikz, /preserve symbolic boundary expressions/)
  assert.match(
    tikz,
    /\\coordinate \(sheetFilledFilledSheet0b0p0\) at \(\{\\R\},0,2\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('symbolic work-plane-filled sheet frame origin exports in local plane options', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const sheet = diagram.strata[0]

  diagram.variables = symbolicFrameVariables()
  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }
  sheet.planeFrame = {
    ...sheet.planeFrame,
    origin: symbolicVec3(symbolicComponent('R', 2), 0, 2),
  }

  const tikz = generateTikz(diagram)
  const variableIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const originIndex = tikz.indexOf('plane origin={({\\R},0,2)}')

  assert.notEqual(variableIndex, -1)
  assert.notEqual(originIndex, -1)
  assert.ok(variableIndex < originIndex)
  assert.match(tikz, /plane x=\{\(\{\\R \+ 1\},0,2\)\}/)
  assert.match(tikz, /plane y=\{\(\{\\R\},1,2\)\}/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,2\)\}/)
})

test('symbolic work-plane-filled sheet frame basis exports in local plane options', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const sheet = diagram.strata[0]

  diagram.variables = symbolicUnitFrameVariables()
  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }
  sheet.planeFrame = {
    ...sheet.planeFrame,
    u: symbolicVec3(symbolicComponent('U', 1), 0, 0),
    v: symbolicVec3(0, symbolicComponent('V', 1), 0),
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /plane x=\{\(\{\\U\},0,2\)\}/)
  assert.match(tikz, /plane y=\{\(0,\{\\V\},2\)\}/)
  assert.doesNotMatch(tikz, /plane x=\{\(1,0,2\)\}/)
  assert.doesNotMatch(tikz, /plane y=\{\(0,1,2\)\}/)
})

test('invalid symbolic work-plane-filled sheet frame export omits instead of using previews', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const sheet = diagram.strata[0]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }
  sheet.planeFrame = {
    ...sheet.planeFrame,
    origin: symbolicVec3(symbolicComponent('Missing', 2), 0, 2),
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /omitted because its local plane frame cannot be exported safely/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,2\)\}/)
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('inline symbolic work-plane frame output keeps variables before use and no blanks', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const sheet = diagram.strata[0]

  diagram.variables = symbolicFrameVariables()
  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }
  sheet.planeFrame = {
    ...sheet.planeFrame,
    origin: symbolicVec3(symbolicComponent('R', 2), 0, 2),
  }

  const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })
  const variableIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const originIndex = tikz.indexOf('plane origin={({\\R},0,2)}')

  assert.notEqual(variableIndex, -1)
  assert.notEqual(originIndex, -1)
  assert.ok(variableIndex < originIndex)
  expectNoBlankLines(tikz)
})

test('symbolic 3D template frame exports in local plane options', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.variables = symbolicUnitFrameVariables()
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'symbolic-template-frame',
    name: 'Symbolic Template Frame',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'circleTemplate',
      center: { x: 2, y: 0, z: 2 },
      radius: 1,
      frame: {
        origin: symbolicVec3(symbolicComponent('R', 2), 0, 2),
        u: symbolicVec3(symbolicComponent('U', 1), 0, 0),
        v: symbolicVec3(0, symbolicComponent('V', 1), 0),
        normal: { x: 0, y: 0, z: 1 },
      },
    },
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /plane origin=\{\(\{\\R\},0,2\)\}/)
  assert.match(tikz, /plane x=\{\(\{\\R \+ \\U\},0,2\)\}/)
  assert.match(tikz, /plane y=\{\(\{\\R\},\{\\V\},2\)\}/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,2\)\}/)
})

test('local symbolic point exports in a canvas-is-plane scope', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D({ x: 0, y: 0, z: 2 })

  diagram.strata.push({
    codim: 3,
    geometricKind: 'point',
    id: 'local-symbolic-point',
    name: 'Local Symbolic Point',
    style: pointStyle(),
    position: workPlaneLocalPoint(
      Math.sqrt(3),
      1,
      2,
      localCoordinateSource(
        frame,
        symbolicScalar('R*cos(q)', Math.sqrt(3)),
        symbolicScalar('R*sin(q)', 1),
      ),
    ),
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(layerBlock, /plane origin=\{\(0,0,2\)\}/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(
    layerBlock,
    /\] at \(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\) \{\};/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(pointLocalSymbolicPoint0p0\)/)
})

test('local symbolic label exports in a canvas-is-plane scope without wrapping text', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D()

  diagram.labels.push({
    geometricKind: 'label',
    id: 'local-symbolic-label',
    name: 'Local Symbolic Label',
    text: '$F^{(1)}L$',
    position: workPlaneLocalPoint(
      2,
      1,
      0,
      localCoordinateSource(
        frame,
        symbolicScalar('R', 2),
        symbolicScalar('R/2', 1),
      ),
    ),
    style: defaultLabelStyle(),
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /\\node at \(\{\\R\},\{\\R \/ 2\}\) \{\$F\^\{\(1\)\}L\$\};/)
})

test('TikZ local frame equality compares symbolic metadata after preview values', () => {
  const numericFrame = xyFrame3D({ x: 2, y: 0, z: 0 })
  const sameNumericFrame = xyFrame3D({ x: 2, y: 0, z: 0 })
  const toleranceEqualNumericFrame = xyFrame3D({ x: 2.0000005, y: 0, z: 0 })
  const differentNumericFrame = xyFrame3D({ x: 2.01, y: 0, z: 0 })
  const symbolicFrameR = xyFrame3D(
    symbolicVec3(symbolicComponent('R', 2), 0, 0),
  )
  const sameSymbolicFrameR = xyFrame3D(
    symbolicVec3(symbolicComponent('R', 2), 0, 0),
  )
  const symbolicFrameS = xyFrame3D(
    symbolicVec3(symbolicComponent('S', 2), 0, 0),
  )
  const symbolicBasisA = {
    ...xyFrame3D(),
    u: symbolicVec3(symbolicComponent('A', 1), 0, 0),
  }
  const symbolicBasisB = {
    ...xyFrame3D(),
    u: symbolicVec3(symbolicComponent('B', 1), 0, 0),
  }

  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(numericFrame, sameNumericFrame),
    true,
  )
  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(numericFrame, toleranceEqualNumericFrame),
    true,
  )
  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(numericFrame, differentNumericFrame),
    false,
  )
  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(symbolicFrameR, sameSymbolicFrameR),
    true,
  )
  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(symbolicFrameR, symbolicFrameS),
    false,
  )
  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(numericFrame, symbolicFrameR),
    false,
  )
  assert.equal(
    sameWorkPlaneFrameForTikzLocalScope(symbolicBasisA, symbolicBasisB),
    false,
  )
})

test('TikZ plane-scope frame detection rejects source-only symbolic metadata', () => {
  const numericFrame = xyFrame3D({ x: 2, y: 0, z: 0 })
  const perAxisSymbolicFrame = xyFrame3D(
    symbolicVec3(symbolicComponent('R', 2), 0, 0),
  )
  const sourceOnlyCoordinate = sourceOnlyWorkPlaneLocalCoordinate(2, 0, 0)

  assert.equal(frameCoordinateHasUnsupportedSymbolicSource(numericFrame.origin), false)
  assert.equal(
    frameCoordinateHasUnsupportedSymbolicSource(perAxisSymbolicFrame.origin),
    false,
  )
  assert.equal(
    frameCoordinateHasUnsupportedSymbolicSource(sourceOnlyCoordinate),
    true,
  )
  assert.equal(workPlaneFrameHasUnsupportedSymbolicSource(numericFrame), false)
  assert.equal(workPlaneFrameHasUnsupportedSymbolicSource(perAxisSymbolicFrame), false)
  assert.equal(
    workPlaneFrameHasUnsupportedSymbolicSource({
      ...xyFrame3D(),
      origin: sourceOnlyCoordinate,
    }),
    true,
  )
  assert.equal(
    workPlaneFrameHasUnsupportedSymbolicSource({
      ...xyFrame3D(),
      u: sourceOnlyWorkPlaneLocalCoordinate(1, 0, 0),
    }),
    true,
  )
  assert.equal(
    workPlaneFrameHasUnsupportedSymbolicSource({
      ...xyFrame3D(),
      v: sourceOnlyWorkPlaneLocalCoordinate(0, 1, 0),
    }),
    true,
  )
  assert.equal(
    workPlaneFrameHasUnsupportedSymbolicSource({
      ...xyFrame3D(),
      normal: sourceOnlyWorkPlaneLocalCoordinate(0, 0, 1),
    }),
    true,
  )
})

test('same-frame local symbolic path emits one canvas-is-plane scope with local expressions', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D({ x: 0, y: 0, z: 1 })

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'local-symbolic-path',
    name: 'Local Symbolic Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        Math.sqrt(3),
        1,
        1,
        localCoordinateSource(
          frame,
          symbolicScalar('R*cos(q)', Math.sqrt(3)),
          symbolicScalar('R*sin(q)', 1),
        ),
      ),
      workPlaneLocalPoint(
        3,
        0,
        1,
        localCoordinateSource(
          frame,
          symbolicScalar('R + 1', 3),
          numericScalar(0),
        ),
      ),
      workPlaneLocalPoint(
        3,
        5,
        1,
        localCoordinateSource(
          frame,
          symbolicScalar('R + 1', 3),
          symbolicScalar('S', 5),
        ),
      ),
    ],
    styleSegments: [],
    layer: 2,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer2')

  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer2,main\}/)
  assert.equal(countMatches(layerBlock, /canvas is plane/g), 1)
  assert.match(
    layerBlock,
    /\(\{\\R \* cos\(\\q\)\},\{\\R \* sin\(\\q\)\}\) -- \(\{\\R \+ 1\},0\) -- \(\{\\R \+ 1\},\{\\S\}\);/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(curvePolyLocalSymbolicPath0p0\)/)
})

test('same symbolic work-plane frame local path emits one canvas scope with frame symbols', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D(symbolicVec3(symbolicComponent('R', 2), 0, 0))

  diagram.variables = equalPreviewFrameVariables()
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'same-symbolic-frame-local-path',
    name: 'Same Symbolic Frame Local Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, numericScalar(0), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(frame, numericScalar(1), numericScalar(0)),
      ),
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')
  const macroIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const originIndex = tikz.indexOf('plane origin={({\\R},0,0)}')

  assert.equal(countMatches(layerBlock, /canvas is plane/g), 1)
  assert.match(layerBlock, /plane origin=\{\(\{\\R\},0,0\)\}/)
  assert.match(layerBlock, /\(0,0\) -- \(1,0\);/)
  assert.notEqual(macroIndex, -1)
  assert.notEqual(originIndex, -1)
  assert.ok(macroIndex < originIndex)
})

test('mixed-frame local symbolic path falls back with an explicit policy comment', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const firstFrame = xyFrame3D()
  const secondFrame = xyFrame3D({ x: 0, y: 0, z: 1 })

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'mixed-frame-local-path',
    name: 'Mixed Frame Local Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(firstFrame, symbolicScalar('R', 2), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        2,
        0,
        1,
        localCoordinateSource(secondFrame, symbolicScalar('R', 2), numericScalar(0)),
      ),
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /uses global preview coordinates because Curve "Mixed Frame Local Path" \[mixed-frame-local-path\] uses multiple work-plane-local frames/,
  )
  assert.match(
    tikz,
    /Work-plane-local symbolic expressions are not expanded into global symbolic coordinates/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolyMixedFrameLocalPath0p0\) at \(2,0,0\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('equal-preview symbolic frame path falls back instead of dropping frame symbols', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const firstFrame = xyFrame3D(
    symbolicVec3(symbolicComponent('R', 2), 0, 0),
  )
  const secondFrame = xyFrame3D(
    symbolicVec3(symbolicComponent('S', 2), 0, 0),
  )

  diagram.variables = equalPreviewFrameVariables()
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'equal-preview-mixed-frame-path',
    name: 'Equal Preview Mixed Frame Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(firstFrame, numericScalar(0), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(secondFrame, numericScalar(1), numericScalar(0)),
      ),
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const rMacroIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const sMacroIndex = tikz.indexOf('\\pgfmathsetmacro{\\S}{2}')
  const fallbackIndex = tikz.indexOf(
    '% Curve "Equal Preview Mixed Frame Path" [equal-preview-mixed-frame-path] uses global preview coordinates',
  )

  assert.match(
    tikz,
    /uses global preview coordinates because Curve "Equal Preview Mixed Frame Path" \[equal-preview-mixed-frame-path\] uses multiple work-plane-local frames/,
  )
  assert.match(
    tikz,
    /Work-plane-local symbolic expressions are not expanded into global symbolic coordinates/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolyEqualPreviewMixedFramePath0p0\) at \(2,0,0\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolyEqualPreviewMixedFramePath0p1\) at \(3,0,0\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.doesNotMatch(tikz, /plane origin=\{\(\{\\R\},0,0\)\}/)
  assert.notEqual(rMacroIndex, -1)
  assert.notEqual(sMacroIndex, -1)
  assert.notEqual(fallbackIndex, -1)
  assert.ok(rMacroIndex < fallbackIndex)
  assert.ok(sMacroIndex < fallbackIndex)
})

test('source-only symbolic frame origin path falls back instead of exporting numeric plane origin', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D(sourceOnlyWorkPlaneLocalCoordinate(2, 0, 0))

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'source-frame-local-path',
    name: 'Source Frame Local Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, numericScalar(0), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(frame, numericScalar(1), numericScalar(0)),
      ),
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /uses global preview coordinates because curve "Source Frame Local Path" \[source-frame-local-path\] work-plane-local frame\.origin contains work-plane-local symbolic source metadata/,
  )
  assert.match(
    tikz,
    /Work-plane-local symbolic expressions are not expanded into global symbolic coordinates/,
  )
  assert.match(
    tikz,
    /\\coordinate \(curvePolySourceFrameLocalPath0p0\) at \(2,0,0\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,0\)\}/)
})

test('inline source-only symbolic frame fallback preserves layer and indentation', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D(sourceOnlyWorkPlaneLocalCoordinate(2, 0, 0))

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'inline-source-frame-local-path',
    name: 'Inline Source Frame Local Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, numericScalar(0), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(frame, numericScalar(1), numericScalar(0)),
      ),
    ],
    styleSegments: [],
    layer: 4,
  })

  const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer4')

  expectNoBlankLines(tikz)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer4,main\}/)
  assert.match(
    tikz,
    /\n            % Curve "Inline Source Frame Local Path" \[inline-source-frame-local-path\] uses global preview coordinates/,
  )
  assert.match(layerBlock, /\\draw\[/)
  assert.doesNotMatch(layerBlock, /canvas is plane/)
})

test('source-only symbolic grid frame origin is omitted with an explicit frame comment', () => {
  const frame = xyFrame3D(sourceOnlyWorkPlaneLocalCoordinate(2, 0, 0))
  const tikz = generateTikz(
    createThreeDimensionalGridDiagram({
      frame: {
        kind: 'workPlane',
        frame,
      },
    }),
  )

  assert.match(
    tikz,
    /Grid "3D Grid" \[grid-3d\] omitted: its local plane frame cannot be exported safely\. grid "3D Grid" \[grid-3d\] frame\.origin contains work-plane-local symbolic source metadata/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,0\)\}/)
})

test('local symbolic polygon sheet preserves layer and local coordinates in a canvas scope', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D()

  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id: 'local-symbolic-sheet',
    name: 'Local Symbolic Sheet',
    style: sheetStyle(),
    vertices: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, symbolicScalar('R', 2), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(frame, symbolicScalar('R + 1', 3), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        5,
        0,
        localCoordinateSource(frame, symbolicScalar('R + 1', 3), symbolicScalar('S', 5)),
      ),
    ],
    pathLabel: 'local sheet path',
    layer: 6,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer6')

  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer6,main\}/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /spath\/save=localSheetPath/)
  assert.match(
    layerBlock,
    /\(\{\\R\},0\) -- \(\{\\R \+ 1\},0\) -- \(\{\\R \+ 1\},\{\\S\}\) -- cycle;/,
  )
})

test('source-only symbolic polygon sheet frame origin falls back explicitly', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D(sourceOnlyWorkPlaneLocalCoordinate(2, 0, 0))

  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id: 'source-frame-local-sheet',
    name: 'Source Frame Local Sheet',
    style: sheetStyle(),
    vertices: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, numericScalar(0), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(frame, numericScalar(1), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        1,
        0,
        localCoordinateSource(frame, numericScalar(1), numericScalar(1)),
      ),
    ],
    pathLabel: 'source frame local sheet path',
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /uses global preview coordinates because sheet "Source Frame Local Sheet" \[source-frame-local-sheet\] work-plane-local frame\.origin contains work-plane-local symbolic source metadata/,
  )
  assert.match(
    tikz,
    /\\coordinate \(sheetPolySourceFrameLocalSheet0p0\) at \(2,0,0\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,0\)\}/)
})

test('equal-preview symbolic frame sheet falls back instead of using one frame scope', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const firstFrame = xyFrame3D(
    symbolicVec3(symbolicComponent('R', 2), 0, 0),
  )
  const secondFrame = xyFrame3D(
    symbolicVec3(symbolicComponent('S', 2), 0, 0),
  )

  diagram.variables = equalPreviewFrameVariables()
  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id: 'equal-preview-mixed-frame-sheet',
    name: 'Equal Preview Mixed Frame Sheet',
    style: sheetStyle(),
    vertices: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(firstFrame, numericScalar(0), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(secondFrame, numericScalar(1), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        1,
        0,
        localCoordinateSource(secondFrame, numericScalar(1), numericScalar(1)),
      ),
    ],
    pathLabel: 'equal preview mixed frame sheet path',
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /uses global preview coordinates because Sheet "Equal Preview Mixed Frame Sheet" \[equal-preview-mixed-frame-sheet\] uses multiple work-plane-local frames/,
  )
  assert.match(
    tikz,
    /\\coordinate \(sheetPolyEqualPreviewMixedFrameSheet0p0\) at \(2,0,0\);/,
  )
  assert.match(
    tikz,
    /\\coordinate \(sheetPolyEqualPreviewMixedFrameSheet0p1\) at \(3,0,0\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.doesNotMatch(tikz, /plane origin=\{\(\{\\R\},0,0\)\}/)
})

test('local symbolic 3D template center uses local expressions when frames match', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D()

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'local-symbolic-template',
    name: 'Local Symbolic Template',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'circleTemplate',
      center: workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, symbolicScalar('R', 2), numericScalar(0)),
      ),
      radius: 1,
      frame,
    },
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\(\{\\R\},0\) circle\[radius=1\]/)
  assert.doesNotMatch(tikz, /\(2,0\) circle\[radius=1\]/)
})

test('inline local symbolic canvas-scope output has no blank lines and keeps four-space indentation', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const frame = xyFrame3D()

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'inline-local-symbolic-path',
    name: 'Inline Local Symbolic Path',
    style: curveStyle(),
    points: [
      workPlaneLocalPoint(
        2,
        0,
        0,
        localCoordinateSource(frame, symbolicScalar('R', 2), numericScalar(0)),
      ),
      workPlaneLocalPoint(
        3,
        0,
        0,
        localCoordinateSource(frame, symbolicScalar('R + 1', 3), numericScalar(0)),
      ),
    ],
    styleSegments: [],
    layer: 4,
  })

  const tikz = generateTikz(diagram, { exportMode: 'inlineMath' })

  expectNoBlankLines(tikz)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer4,main\}/)
  assert.match(tikz, /\n            \\begin\{scope\}\[/)
  assert.match(tikz, /\n                plane origin=\{\(0,0,0\)\},/)
  assert.match(tikz, /\n                canvas is plane/)
})

test('local symbolic ruled surface documents numeric sampled mesh fallback', () => {
  const diagram = createLocalSymbolicThreeDimensionalDiagram()
  const bottomFrame = xyFrame3D()
  const topFrame = xyFrame3D({ x: 0, y: 0, z: 1 })

  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    id: 'local-symbolic-ruled',
    name: 'Local Symbolic Ruled',
    style: sheetStyle(),
    primitive: {
      kind: 'ruledSurface',
      boundary0: {
        id: 'local-symbolic-ruled-bottom',
        segments: [
          {
            kind: 'line',
            start: workPlaneLocalPoint(
              2,
              0,
              0,
              localCoordinateSource(
                bottomFrame,
                symbolicScalar('R', 2),
                numericScalar(0),
              ),
            ),
            end: workPlaneLocalPoint(
              3,
              0,
              0,
              localCoordinateSource(
                bottomFrame,
                symbolicScalar('R + 1', 3),
                numericScalar(0),
              ),
            ),
          },
        ],
      },
      boundary1: {
        id: 'local-symbolic-ruled-top',
        segments: [
          {
            kind: 'line',
            start: workPlaneLocalPoint(
              2,
              1,
              1,
              localCoordinateSource(
                topFrame,
                symbolicScalar('R', 2),
                numericScalar(1),
              ),
            ),
            end: workPlaneLocalPoint(
              3,
              1,
              1,
              localCoordinateSource(
                topFrame,
                symbolicScalar('R + 1', 3),
                numericScalar(1),
              ),
            ),
          },
        ],
      },
      sampling: { segments: 2 },
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /Work-plane-local symbolic boundary coordinates are preserved in the saved model; sampled mesh TikZ uses finite numeric preview coordinates\./,
  )
  assert.match(
    tikz,
    /\\coordinate \(sheetCurvedLocalSymbolicRuled0p0\) at \(2,0,0\);/,
  )
})

test('symbolic sheet vertices export through named sheet coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.variables = symbolicExportVariables()
  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id: 'symbolic-sheet-vertices',
    name: 'Symbolic Sheet',
    style: sheetStyle(),
    vertices: [
      symbolicVec3(symbolicComponent('R', 2), 0, 0),
      { x: 3, y: 0, z: 0 },
      { x: 3, y: 1, z: 0 },
    ],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(sheetPolySymbolicSheet0p0\) at \(\{\\R\},0,0\);/,
  )
  assert.match(
    tikz,
    /\(sheetPolySymbolicSheet0p0\) -- \(sheetPolySymbolicSheet0p1\) -- \(sheetPolySymbolicSheet0p2\) -- cycle;/,
  )
})

test('2D template path symbolic centers export through the center coordinate', () => {
  const diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'symbolic-circle',
    name: 'Symbolic Circle',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'circleTemplate',
      center: symbolicVec3(symbolicComponent('R', 2), 0, 0),
      radius: 1.5,
    },
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(curveTemplateSymbolicCircle0p0\) at \(\{\\R\},0\);/,
  )
  assert.match(tikz, /\(curveTemplateSymbolicCircle0p0\) circle\[radius=1\.5\]/)
})

test('unused variables are emitted in deterministic user order', () => {
  const tikz = generateTikz(createSymbolicExportDiagram())
  const radiusIndex = tikz.indexOf('\\pgfmathsetmacro{\\R}{2}')
  const angleIndex = tikz.indexOf('\\pgfmathsetmacro{\\q}{30}')
  const unusedIndex = tikz.indexOf('\\pgfmathsetmacro{\\S}{5}')

  assert.notEqual(radiusIndex, -1)
  assert.notEqual(angleIndex, -1)
  assert.notEqual(unusedIndex, -1)
  assert.ok(radiusIndex < angleIndex)
  assert.ok(angleIndex < unusedIndex)
})

test('duplicate variables are reported without duplicate macro definitions', () => {
  const tikz = generateTikz({
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'first-R',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 2,
      },
      {
        id: 'second-R',
        name: 'R',
        macroName: 'Rdup',
        expression: '3',
        previewValue: 3,
      },
    ],
  })

  assert.equal(countMatches(tikz, /\\pgfmathsetmacro\{\\R\}/g), 0)
  assert.match(tikz, /Variable omitted/)
})

test('local user styles and external imported styles still apply to symbolic coordinates', () => {
  let diagram = createSymbolicExportDiagram()
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'styled-symbolic',
    name: 'Styled Symbolic',
    style: curveStyle({ strokeColor: '#224466' }),
    points: [
      symbolicVec3(symbolicComponent('R', 2), 0, 0),
      { x: 3, y: 1, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })

  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Symbolic preset',
    curve.style,
  )

  if (created === null) {
    throw new Error('Expected curve preset creation to succeed.')
  }

  diagram = withImportedTikzStyleReference(
    applyUserStylePresetToStratum(created.diagram, curve.id, created.preset.id),
    'external-symbolic-draw',
    '3cat/phys/1strata/symbolic/x',
    ['draw', 'curve'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === curve.id
      ? {
          ...stratum,
          importedTikzStyleReferenceId: 'external-symbolic-draw',
        }
      : stratum,
  )

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(
    tikz,
    /\\coordinate \(curvePolyStyledSymbolic0p0\) at \(\{\\R\},0\);/,
  )
  assert.match(tikz, /stratifiedStyleSymbolicPreset/)
  assert.match(layerBlock, /3cat\/phys\/1strata\/symbolic\/x/)
})

test('TikZ 3d library is not emitted when no scoped 3D export is used', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.doesNotMatch(tikz, /\\usetikzlibrary\{3d\}/)
})

test('TikZ export excludes active work-plane guide and UI state', () => {
  const activeWorkPlane: WorkPlane = {
    kind: 'custom',
    id: 'tikz-leak-sentinel-plane',
    name: 'TikZ Leak Sentinel',
    origin: { x: 10, y: 20, z: 30 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    source: { kind: 'threePoints' },
  }
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.equal(activeWorkPlane.kind, 'custom')
  assert.doesNotMatch(tikz, /tikz-leak-sentinel-plane/)
  assert.doesNotMatch(tikz, /TikZ Leak Sentinel/)
  assert.doesNotMatch(tikz, /work-plane-preview/)
  assert.doesNotMatch(tikz, /custom work plane/)
})

test('2D output has codim 1 curves and codim 2 points', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /% Codimension 1 strata: curves/)
  assert.match(tikz, /% Codimension 2 strata: points/)
  assert.match(tikz, /\\draw\[/)
  assert.match(tikz, /\\node\[/)
})

test('2D output contains readable section headers', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assertIncludesSection(tikz, 'Styles and colors')
  assertIncludesSection(tikz, 'Coordinates')
  assertIncludesSection(tikz, 'Codimension 1 strata: curves')
  assertIncludesSection(tikz, 'Codimension 2 strata: points')
  assertIncludesSection(tikz, 'Labels')
  assert.doesNotMatch(tikz, /% Codimension 3 strata/)
})

test('3D output has codim 1 sheets, codim 2 curves, and codim 3 points', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.match(tikz, /% Codimension 1 strata: sheets/)
  assert.match(tikz, /% Codimension 2 strata: curves/)
  assert.match(tikz, /% Codimension 3 strata: points/)
  assert.match(tikz, /\\filldraw\[/)
  assert.match(tikz, /\\draw\[/)
  assert.match(tikz, /\\node\[/)
})

test('3D output contains readable section headers', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assertIncludesSection(tikz, 'Styles and colors')
  assertIncludesSection(tikz, 'Coordinates')
  assertIncludesSection(tikz, 'Codimension 1 strata: sheets')
  assertIncludesSection(tikz, 'Codimension 2 strata: curves')
  assertIncludesSection(tikz, 'Codimension 3 strata: points')
  assertIncludesSection(tikz, 'Labels')
})

test('custom colors are emitted as definecolor commands', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())

  assert.match(tikz, /\\definecolor\{stzSheetpageFill\}\{HTML\}\{4D9DE0\}/)
  assert.match(tikz, /\\definecolor\{stzCurvelineStroke\}\{HTML\}\{FF00AA\}/)
  assert.match(tikz, /\\definecolor\{stzPointjunction\}\{HTML\}\{00AA33\}/)
})

test('user curve presets are emitted as tikzpicture local style options', () => {
  const diagram = createTwoDimensionalDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Black curve',
    {
      ...curve.style,
      strokeColor: '#000000',
      lineWidth: 0.8,
    },
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const tikz = generateTikz(withPreset)
  const styleDefinition = 'stratifiedStyleBlackCurve/.style='

  assert.ok(tikz.indexOf(styleDefinition) > tikz.indexOf('\\begin{tikzpicture}['))
  assert.ok(tikz.indexOf(styleDefinition) < tikz.indexOf('% Coordinates'))
  assert.match(
    tikz,
    /stratifiedStyleBlackCurve\/\.style=\{draw=stzStyleusercurveblackcurveStroke, draw opacity=1, line width=0\.8pt\}/,
  )
})

test('user preset export does not emit a pre-picture tikzset block', () => {
  const diagram = createTwoDimensionalDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'No tikzset curve',
    curve.style,
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const tikz = generateTikz(withPreset)

  assert.doesNotMatch(tikz, /\\tikzset\{/)
})

test('commands reference the local user preset style when style still matches', () => {
  const diagram = createTwoDimensionalDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Referenced curve',
    curve.style,
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const tikz = generateTikz(withPreset)

  assert.match(tikz, /\\draw\[\n\s+stratifiedStyleReferencedCurve\n\s+\]/)
})

test('filldraw commands reference the local user preset style when style still matches', () => {
  const diagram = createFilledRegionDiagram()
  const region = diagram.strata[0]

  if (region.geometricKind !== 'region') {
    throw new Error('Expected region.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'region',
    'Referenced region',
    region.style,
  )

  if (created === null) {
    throw new Error('Expected region preset creation to succeed.')
  }

  const withPreset = applyUserStylePresetToStratum(
    created.diagram,
    region.id,
    created.preset.id,
  )
  const tikz = generateTikz(withPreset)

  assert.match(
    tikz,
    /stratifiedStyleReferencedRegion\/\.style=\{fill=stzStyleuserregionreferencedregionFill, fill opacity=0\.35, draw=stzStyleuserregionreferencedregionStroke, draw opacity=1\}/,
  )
  assert.match(tikz, /\\filldraw\[\n\s+stratifiedStyleReferencedRegion\n\s+\]/)
})

test('point node commands reference the local user preset style when style still matches', () => {
  const diagram = createTwoDimensionalDiagram()
  const point = diagram.strata[1]

  if (point.geometricKind !== 'point') {
    throw new Error('Expected point.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'point',
    'Referenced point',
    point.style,
  )

  if (created === null) {
    throw new Error('Expected point preset creation to succeed.')
  }

  const withPreset = applyUserStylePresetToStratum(
    created.diagram,
    point.id,
    created.preset.id,
  )
  const tikz = generateTikz(withPreset)

  assert.match(
    tikz,
    /stratifiedStyleReferencedPoint\/\.style=\{circle, fill=stzStyleuserpointreferencedpoint, draw=stzStyleuserpointreferencedpoint, opacity=1, inner sep=1\.5pt\}/,
  )
  assert.match(
    tikz,
    /\\node\[\n\s+stratifiedStyleReferencedPoint\n\s+\] at \(pointVertex0p0\) \{\};/,
  )
})

test('label node commands reference the local user preset style when style still matches', () => {
  const diagram = createTwoDimensionalDiagram()
  const label = diagram.labels[0]

  const created = createUserStylePresetFromStyle(
    diagram,
    'label',
    'Referenced label',
    label.style,
  )

  if (created === null) {
    throw new Error('Expected label preset creation to succeed.')
  }

  const withPreset = applyUserStylePresetToLabel(
    created.diagram,
    label.id,
    created.preset.id,
  )
  const tikz = generateTikz(withPreset)

  assert.match(
    tikz,
    /stratifiedStyleReferencedLabel\/\.style=\{text=stzStyleuserlabelreferencedlabel, opacity=1, font=\\fontsize\{10pt\}\{12pt\}\\selectfont, anchor=center\}/,
  )
  assert.match(
    tikz,
    /\\node\[\n\s+stratifiedStyleReferencedLabel\n\s+\] at \(2,3\) \{\$F\^\{\(1\)\}L\$\};/,
  )
})

test('stale user preset references fall back to inline structured style', () => {
  const diagram = createTwoDimensionalDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Stale curve',
    curve.style,
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const staleDiagram: Diagram = {
    ...withPreset,
    strata: withPreset.strata.map((stratum) =>
      stratum.id === curve.id && stratum.geometricKind === 'curve'
        ? {
            ...stratum,
            style: { ...stratum.style, lineStyle: 'dashed' },
          }
        : stratum,
    ),
  }
  const tikz = generateTikz(staleDiagram)

  assert.doesNotMatch(tikz, /stratifiedStyleStaleCurve\/\.style=/)
  assert.match(tikz, /draw=stzCurvewireStroke/)
  assert.match(tikz, /dashed/)
})

test('element imported draw style exports the raw key before structured draw fallback options', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-draw',
    '3cat/phys/1strata/color/x',
    ['draw', 'curve'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === 'wire'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-draw' }
      : stratum,
  )

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\draw\[/)
  assert.match(layerBlock, /draw=stzCurvewireStroke/)
  assert.ok(
    layerBlock.indexOf('3cat/phys/1strata/color/x') <
      layerBlock.indexOf('draw=stzCurvewireStroke'),
  )
  assert.ok(
    layerBlock.indexOf('3cat/phys/1strata/color/x') <
      layerBlock.indexOf('line width=1.2pt'),
  )
  assert.match(layerBlock, /3cat\/phys\/1strata\/color\/x/)
})

test('element imported filldraw style exports the raw key in filldraw options', () => {
  const diagram = withImportedTikzStyleReference(
    createFilledRegionDiagram(),
    'external-filldraw',
    '3cat/phys/2strata/fill/y',
    ['filldraw', 'region'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === 'filled-region'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-filldraw' }
      : stratum,
  )

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\filldraw\[/)
  assert.ok(
    layerBlock.indexOf('3cat/phys/2strata/fill/y') <
      layerBlock.indexOf('fill=stzRegionfilledregionFill'),
  )
  assert.match(layerBlock, /3cat\/phys\/2strata\/fill\/y/)
})

test('element imported node style exports the raw key in node options', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-node',
    '3cat/phys/3strata/shape/L',
    ['node', 'point'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === 'vertex'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-node' }
      : stratum,
  )

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\node\[/)
  assert.ok(
    layerBlock.indexOf('3cat/phys/3strata/shape/L') <
      layerBlock.indexOf('fill=stzPointvertex'),
  )
  assert.match(
    layerBlock,
    /3cat\/phys\/3strata\/shape\/L[\s\S]*\] at \(pointVertex0p0\) \{\};/,
  )
})

test('element imported label style exports the raw key in node options', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-label-node',
    '3cat/phys/label/style/T',
    ['node', 'label'],
  )
  diagram.labels = diagram.labels.map((label) =>
    label.id === 'formula'
      ? { ...label, importedTikzStyleReferenceId: 'external-label-node' }
      : label,
  )

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(
    layerBlock,
    /\\node\[\n\s+3cat\/phys\/label\/style\/T\n\s+\] at \(2,3\) \{\$F\^\{\(1\)\}L\$\};/,
  )
})

test('incompatible imported style targets are not emitted', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-node-only',
    '3cat/phys/3strata/shape/L',
    ['node', 'point'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === 'wire'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-node-only' }
      : stratum,
  )

  const tikz = generateTikz(diagram)

  assert.doesNotMatch(tikz, /3cat\/phys\/3strata\/shape\/L/)
  assert.doesNotMatch(tikz, /External TikZ styles referenced below/)
})

test('imported styles emit external load comments without tikzset or active input', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-draw',
    '3cat/phys/1strata/color/x',
    ['draw', 'curve'],
  )
  diagram.strata = diagram.strata.map((stratum) =>
    stratum.id === 'wire'
      ? { ...stratum, importedTikzStyleReferenceId: 'external-draw' }
      : stratum,
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /% External TikZ styles referenced below\./)
  assert.match(tikz, /% - mygeometry\.sty/)
  assert.match(tikz, /%   \\input\{mygeometry\.sty\}/)
  assert.ok(
    tikz.indexOf('% External TikZ styles referenced below.') <
      tikz.indexOf('\\begin{tikzpicture}['),
  )
  assert.doesNotMatch(tikz, /\\tikzset\{/)
  assert.doesNotMatch(tikz, /^\\input\{mygeometry\.sty\}/m)
})

test('duplicate external source comments are de-duplicated', () => {
  const diagram = withImportedTikzStyleReferences(
    createTwoDimensionalDiagram(),
    [
      {
        id: 'external-draw',
        key: '3cat/phys/1strata/color/x',
        targets: ['draw', 'curve'],
      },
      {
        id: 'external-node',
        key: '3cat/phys/3strata/shape/L',
        targets: ['node', 'point'],
      },
    ],
  )
  diagram.strata = diagram.strata.map((stratum) => {
    if (stratum.id === 'wire') {
      return { ...stratum, importedTikzStyleReferenceId: 'external-draw' }
    }

    if (stratum.id === 'vertex') {
      return { ...stratum, importedTikzStyleReferenceId: 'external-node' }
    }

    return stratum
  })

  const tikz = generateTikz(diagram)

  assert.equal(countMatches(tikz, /% - mygeometry\.sty/g), 1)
  assert.equal(countMatches(tikz, /%   \\input\{mygeometry\.sty\}/g), 1)
})

test('imported style reference from a matching user preset exports after the local preset option', () => {
  const diagram = withImportedTikzStyleReference(
    createTwoDimensionalDiagram(),
    'external-draw',
    '3cat/phys/1strata/color/x',
    ['draw', 'curve'],
  )
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Imported preset curve',
    curve.style,
    'external-draw',
  )
  const withPreset = applyUserStylePresetToStratum(
    created?.diagram ?? diagram,
    curve.id,
    created?.preset.id ?? '',
  )
  const tikz = generateTikz(withPreset)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(
    tikz,
    /stratifiedStyleImportedPresetCurve\/\.style=\{draw=stzStyleusercurveimportedpresetcurveStroke, draw opacity=1, line width=1\.2pt\}/,
  )
  assert.ok(
    layerBlock.indexOf('stratifiedStyleImportedPresetCurve') <
      layerBlock.indexOf('3cat/phys/1strata/color/x'),
  )
})

test('TikZ layer names are deterministic and TikZ-safe', () => {
  assert.equal(layerToTikzLayerName(0), 'stratifiedLayer0')
  assert.equal(layerToTikzLayerName(2), 'stratifiedLayer2')
  assert.equal(layerToTikzLayerName(-1), 'stratifiedLayerMinus1')
  assert.equal(layerToTikzLayerName(1.5), 'stratifiedLayer1Point5')
  assert.equal(layerToTikzLayerName(Number.NaN), 'stratifiedLayer0')
  assert.equal(layerToTikzLayerName(Number.POSITIVE_INFINITY), 'stratifiedLayer0')
})

test('generated TikZ declares used layers in numeric order', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())

  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayerMinus1\}/)
  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayer0\}/)
  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayer2\}/)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedLayerMinus1,stratifiedLayer0,stratifiedLayer2,main\}/,
  )
})

test('generated TikZ groups drawing commands in pgfonlayer blocks', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())
  const layerMinusOne = extractLayerBlock(tikz, 'stratifiedLayerMinus1')
  const layerZero = extractLayerBlock(tikz, 'stratifiedLayer0')
  const layerTwo = extractLayerBlock(tikz, 'stratifiedLayer2')

  assert.match(layerMinusOne, /\\node at \(0\.5,1\) \{\$L\$\};/)
  assert.match(
    layerZero,
    /\(curvePolyBackWire0p0\) -- \(curvePolyBackWire0p1\);/,
  )
  assert.match(
    layerTwo,
    /\(curvePolyFrontWire1p0\) -- \(curvePolyFrontWire1p1\);/,
  )
  assert.match(layerTwo, /\] at \(pointFrontPoint0p0\) \{\};/)
})

test('same-layer drawing command order is preserved', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())
  const layerTwo = extractLayerBlock(tikz, 'stratifiedLayer2')

  assert.ok(
    layerTwo.indexOf('(curvePolyFrontWire1p0)') <
      layerTwo.indexOf('(pointFrontPoint0p0)'),
  )
})

test('same-kind same-layer drawing order follows diagram order, not id order', () => {
  const tikz = generateTikz(createSameLayerOppositeIdCurveDiagram())
  const layerZero = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(tikz, /\\coordinate \(curvePolyZCurve0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyACurve1p0\) at \(0,1\);/)
  assert.ok(
    tikz.indexOf('\\coordinate (curvePolyZCurve0p0)') <
      tikz.indexOf('\\coordinate (curvePolyACurve1p0)'),
  )
  assert.ok(
    layerZero.indexOf('(curvePolyZCurve0p0)') <
      layerZero.indexOf('(curvePolyACurve1p0)'),
  )
})

test('layer blocks use separated codimension comments', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())
  const layerZero = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(
    layerZero,
    /%---+\n\s*% Codimension 1 strata: curves\n\s*%---+/,
  )
})

test('layer-aware output preserves Phase 9A coordinate names', () => {
  const tikz = generateTikz(createLayeredTwoDimensionalDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyBackWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyFrontWire1p0\) at \(0,0\.5\);/)
  assert.match(tikz, /\\coordinate \(pointFrontPoint0p0\) at \(1,0\.5\);/)
  assert.doesNotMatch(tikz, /curvePolycurve/)
})

test('single-layer diagrams still generate valid layer output', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\pgfdeclarelayer\{stratifiedLayer0\}/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer0,main\}/)
  assert.match(tikz, /\\begin\{pgfonlayer\}\{stratifiedLayer0\}/)
  assert.match(tikz, /\\end\{pgfonlayer\}/)
})

test('denselyDotted maps to densely dotted', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'hidden',
      name: 'Hidden curve',
      style: curveStyle({ lineStyle: 'denselyDotted' }),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  assert.match(generateTikz(diagram), /densely dotted/)
})

test('endpoint forward arrow exports arrow option', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(arrowOptions({ endpoint: 'forward' })),
  )

  assert.match(tikz, /\n\s+->\n\s+\]/)
})

test('endpoint backward arrow exports arrow option', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(arrowOptions({ endpoint: 'backward' })),
  )

  assert.match(tikz, /\n\s+<-\n\s+\]/)
})

test('endpoint both arrow exports arrow option', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(arrowOptions({ endpoint: 'both' })),
  )

  assert.match(tikz, /\n\s+<->\n\s+\]/)
})

test('mid-arrow default exports position and standard head', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(arrowOptions({ mid: { enabled: true } })),
  )

  assert.match(tikz, /mark=at position 0\.5/)
  assert.match(tikz, /\\arrow\{>\}/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
})

test('mid-arrow backward exports reversed standard head', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({ mid: { enabled: true, direction: 'backward' } }),
    ),
  )

  assert.match(tikz, /\\arrow\{<\}/)
})

test('Stealth mid-arrow exports Stealth arrow head', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({ mid: { enabled: true, head: 'stealth' } }),
    ),
  )

  assert.match(tikz, /\\arrow\{Stealth\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
})

test('Latex mid-arrow exports Latex arrow head', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({ mid: { enabled: true, head: 'latex' } }),
    ),
  )

  assert.match(tikz, /\\arrow\{Latex\}/)
})

test('Stealth harpoon mid-arrow exports harpoon arrow head', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({ mid: { enabled: true, head: 'stealthHarpoon' } }),
    ),
  )

  assert.match(tikz, /\\arrow\{Stealth\[harpoon\]\}/)
})

test('Stealth harpoon swap mid-arrow exports swapped harpoon arrow head', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({ mid: { enabled: true, head: 'stealthHarpoonSwap' } }),
    ),
  )

  assert.match(tikz, /\\arrow\{Stealth\[harpoon,swap\]\}/)
})

test('backward custom mid-arrow exports arrowreversed syntax', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({
        mid: { enabled: true, direction: 'backward', head: 'stealth' },
      }),
    ),
  )

  assert.match(tikz, /\\arrowreversed\{Stealth\}/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
})

test('inline math output with arrow decorations has no blank lines', () => {
  const tikz = generateTikz(
    createArrowPathDiagram(
      arrowOptions({ mid: { enabled: true, head: 'stealthHarpoon' } }),
    ),
    { exportMode: 'inlineMath' },
  )

  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
  expectNoBlankLines(tikz)
})

test('3D path arrows export endpoint and mid-arrow options', () => {
  const tikz = generateTikz(
    createThreeDimensionalArrowPathDiagram(
      arrowOptions({
        endpoint: 'forward',
        mid: { enabled: true, head: 'stealth' },
      }),
    ),
  )

  assert.match(tikz, /\n\s+->,\n/)
  assert.match(tikz, /mark=at position 0\.5/)
  assert.match(tikz, /\\arrow\{Stealth\}/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
})

test('numeric path output without arrows has no arrow decoration options', () => {
  const tikz = generateTikz(createArrowPathDiagram())

  assert.match(tikz, /\(curvePolyArrowTestPath0p0\) -- \(curvePolyArrowTestPath0p1\);/)
  assert.doesNotMatch(tikz, /postaction=\{decorate\}/)
  assert.doesNotMatch(tikz, /decorations\.markings/)
  assert.doesNotMatch(tikz, /arrows\.meta/)
  assert.doesNotMatch(tikz, /\n\s+(->|<-|<->)\n/)
})

test('no braiding state emits no crossing mask commands', () => {
  const tikz = generateTikz(createBraidingCrossingDiagram())

  assert.doesNotMatch(tikz, /Background mask clips the under-strand/)
  assert.doesNotMatch(tikz, /stzBraidingBackground/)
  assert.doesNotMatch(tikz, /braidingCrossing0/)
})

test('braiding emits a pathB mask and pathA redraw without knot package', () => {
  const tikz = generateTikz(createBraidingCrossingDiagram('braiding'))
  const maskPath = '(braidingCrossing0Maskp0) -- (braidingCrossing0Maskp1);'
  const redrawPath = '(braidingCrossing0Overp0) -- (braidingCrossing0Overp1);'

  assert.match(tikz, /% Braiding crossing: path-a over path-b; no knot package\./)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Maskp0\) at \(0,-0\.12\);/)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Maskp1\) at \(0,0\.12\);/)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Overp0\) at \(-0\.12,0\);/)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Overp1\) at \(0\.12,0\);/)
  assert.match(tikz, /draw=stzBraidingBackground/)
  assert.match(tikz, /line width=5\.2pt/)
  assert.ok(tikz.indexOf(maskPath) < tikz.indexOf(redrawPath))
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{knot\}/)
  assert.doesNotMatch(tikz, /\\begin\{knot\}|\\strand|\\flipcrossings/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('anti-braiding emits a pathA mask and pathB redraw', () => {
  const tikz = generateTikz(createBraidingCrossingDiagram('antiBraiding'))

  assert.match(tikz, /% Braiding crossing: path-b over path-a; no knot package\./)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Maskp0\) at \(-0\.12,0\);/)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Maskp1\) at \(0\.12,0\);/)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Overp0\) at \(0,-0\.12\);/)
  assert.match(tikz, /\\coordinate \(braidingCrossing0Overp1\) at \(0,0\.12\);/)
  assert.match(tikz, /draw=stzBraidingBackground/)
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{knot\}/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('braiding with arrow decorations preserves arrows on the main path only', () => {
  const tikz = generateTikz(
    createBraidingCrossingDiagram(
      'braiding',
      arrowOptions({ endpoint: 'forward', mid: { enabled: true } }),
    ),
  )

  assert.match(tikz, /% Braiding crossing: path-a over path-b/)
  assert.match(tikz, /\n\s+->,\n/)
  assert.equal(countMatches(tikz, /postaction=\{decorate\}/g), 1)
  assert.equal(countMatches(tikz, /mark=at position/g), 1)
  assert.equal(countMatches(tikz, /\\arrow\{>\}/g), 1)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{knot\}/)
})

test('inline braiding output has no blank lines and keeps four-space indentation', () => {
  const tikz = generateTikz(createBraidingCrossingDiagram('braiding'), {
    exportMode: 'inlineMath',
  })

  assert.match(tikz, /\n        % Braiding crossing: path-a over path-b/)
  assert.match(tikz, /\n        \\draw\[/)
  assert.match(tikz, /\n            draw=stzBraidingBackground/)
  assert.match(tikz, /\n            \(braidingCrossing0Maskp0\) -- \(braidingCrossing0Maskp1\);/)
  expectNoBlankLines(tikz)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('3D TikZ output ignores saved braiding states', () => {
  const twoDimensional = createBraidingCrossingDiagram('braiding')
  const threeDimensional: Diagram = {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    pathCrossings: twoDimensional.pathCrossings,
  }
  const tikz = generateTikz(threeDimensional)

  assert.doesNotMatch(tikz, /Braiding crossing:/)
  assert.doesNotMatch(tikz, /braidingCrossing0/)
  assert.doesNotMatch(tikz, /stzBraidingBackground/)
})

test('split concatenated path forward endpoint arrow is only on the final run', () => {
  const tikz = generateTikz(
    createMixedStyleArrowPathDiagram(arrowOptions({ endpoint: 'forward' })),
  )
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.equal(countMatches(splitDrawSection, /\n\s+->\n/g), 1)
  assert.ok(splitDrawSection.indexOf('->') > splitDrawSection.indexOf('% Segment 3'))
  assert.doesNotMatch(splitDrawSection.slice(0, splitDrawSection.indexOf('% Segment 3')), /->/)
})

test('split concatenated path backward endpoint arrow is only on the first run', () => {
  const tikz = generateTikz(
    createMixedStyleArrowPathDiagram(arrowOptions({ endpoint: 'backward' })),
  )
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.equal(countMatches(splitDrawSection, /\n\s+<-\n/g), 1)
  assert.ok(splitDrawSection.indexOf('<-') < splitDrawSection.indexOf('% Segment 2'))
  assert.doesNotMatch(splitDrawSection.slice(splitDrawSection.indexOf('% Segment 2')), /<-/)
})

test('split concatenated path both endpoint arrows use first and final runs', () => {
  const tikz = generateTikz(
    createMixedStyleArrowPathDiagram(arrowOptions({ endpoint: 'both' })),
  )
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.equal(countMatches(splitDrawSection, /\n\s+<-\n/g), 1)
  assert.equal(countMatches(splitDrawSection, /\n\s+->\n/g), 1)
  assert.doesNotMatch(splitDrawSection, /<->/)
  assert.ok(splitDrawSection.indexOf('<-') < splitDrawSection.indexOf('% Segment 2'))
  assert.ok(splitDrawSection.indexOf('->') > splitDrawSection.indexOf('% Segment 3'))
})

test('split concatenated path mid-arrow is emitted once on the containing run', () => {
  const tikz = generateTikz(
    createMixedStyleArrowPathDiagram(arrowOptions({ mid: { enabled: true } })),
  )
  const markMatch = tikz.match(/mark=at position ([0-9.]+)/)

  assert.notEqual(markMatch, null)

  const localPosition = Number(markMatch[1])
  const segment2Index = tikz.indexOf('% Segment 2')
  const segment3Index = tikz.indexOf('% Segment 3')
  const markIndex = tikz.indexOf('mark=at position')

  assert.equal(countMatches(tikz, /postaction=\{decorate\}/g), 1)
  assert.equal(countMatches(tikz, /mark=at position/g), 1)
  assert.ok(segment2Index < markIndex)
  assert.ok(markIndex < segment3Index)
  assert.ok(Number.isFinite(localPosition))
  assert.ok(localPosition > 0)
  assert.ok(localPosition < 1)
  assert.match(tikz, /dotted/)
  assert.match(tikz, /densely dotted/)
  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('split concatenated path mid-arrow custom heads emit required libraries', () => {
  const cases: Array<{
    head: NonNullable<PathArrowOptions['mid']['head']>
    command: RegExp
  }> = [
    { head: 'stealth', command: /\\arrow\{Stealth\}/ },
    { head: 'latex', command: /\\arrow\{Latex\}/ },
    { head: 'stealthHarpoon', command: /\\arrow\{Stealth\[harpoon\]\}/ },
    {
      head: 'stealthHarpoonSwap',
      command: /\\arrow\{Stealth\[harpoon,swap\]\}/,
    },
  ]

  for (const { head, command } of cases) {
    const tikz = generateTikz(
      createMixedStyleArrowPathDiagram(
        arrowOptions({ mid: { enabled: true, head } }),
      ),
    )

    assert.match(tikz, command)
    assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
    assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
    assert.equal(countMatches(tikz, /mark=at position/g), 1)
  }
})

test('inline split concatenated path arrows have no blank lines', () => {
  const tikz = generateTikz(
    createMixedStyleArrowPathDiagram(
      arrowOptions({ endpoint: 'both', mid: { enabled: true, head: 'stealth' } }),
    ),
    { exportMode: 'inlineMath' },
  )

  assert.match(tikz, /\\usetikzlibrary\{decorations\.markings\}/)
  assert.match(tikz, /\\usetikzlibrary\{arrows\.meta\}/)
  expectNoBlankLines(tikz)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('split concatenated path without arrows has no arrow decoration options', () => {
  const tikz = generateTikz(createMixedStyleArrowPathDiagram())

  assert.match(tikz, /% Segment style overrides split this concatenated path/)
  assert.match(tikz, /dotted/)
  assert.match(tikz, /densely dotted/)
  assert.doesNotMatch(tikz, /postaction=\{decorate\}/)
  assert.doesNotMatch(tikz, /decorations\.markings/)
  assert.doesNotMatch(tikz, /arrows\.meta/)
  assert.doesNotMatch(tikz, /\n\s+(->|<-|<->)\n/)
})

test('curve with empty path label emits no spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'unlabeled',
      name: 'Unlabeled curve',
      pathLabel: '   ',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.doesNotMatch(tikz, /spath\/save=/)
  assert.doesNotMatch(tikz, /spath3/)
})

test('polyline curve with path label emits spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'wire-path',
      name: 'Wire path',
      pathLabel: 'wire path',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /% \\usetikzlibrary\{spath3\}/)
  assert.match(tikz, /spath\/save=wirePath/)
  assert.match(tikz, /\(curvePolyWirePath0p0\) -- \(curvePolyWirePath0p1\);/)
})

test('cubic Bezier curve with path label emits spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'cubicBezier',
      id: 'arc-path',
      name: 'Arc path',
      pathLabel: 'arc path',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 1, z: 0 },
        { x: 3, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /spath\/save=arcPath/)
  assert.match(
    tikz,
    /\(curveBezierArcPath0p0\) \.\. controls \(curveBezierArcPath0p1\) and \(curveBezierArcPath0p2\) \.\. \(curveBezierArcPath0p3\);/,
  )
})

test('concatenated path exports as a continuous TikZ path', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'composite-path',
    name: 'Composite Path',
    pathLabel: 'composite path',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'cubicBezier',
        start: { x: 1, y: 0, z: 0 },
        control1: { x: 1.5, y: 1, z: 0 },
        control2: { x: 2.5, y: 1, z: 0 },
        end: { x: 3, y: 0, z: 0 },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /spath\/save=compositePath/)
  assert.match(tikz, /\\coordinate \(curvePathCompositePath0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePathCompositePath0p4\) at \(3,0\);/)
  assert.match(
    tikz,
    /\(curvePathCompositePath0p0\) -- \(curvePathCompositePath0p1\) \.\. controls \(curvePathCompositePath0p2\) and \(curvePathCompositePath0p3\) \.\. \(curvePathCompositePath0p4\);/,
  )
  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 1)
})

test('template paths export using native 2D TikZ circle and ellipse syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'templatePath',
      id: 'circle-template',
      name: 'Circle Template',
      style: curveStyle(),
      styleSegments: [],
      layer: 0,
      template: {
        kind: 'circleTemplate',
        center: { x: 0, y: 0, z: 0 },
        radius: 1.5,
      },
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'templatePath',
      id: 'ellipse-template',
      name: 'Ellipse Template',
      style: curveStyle(),
      styleSegments: [],
      layer: 0,
      template: {
        kind: 'ellipseTemplate',
        center: { x: 2, y: 0, z: 0 },
        radiusX: 2,
        radiusY: 0.5,
      },
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /circle\[radius=1\.5\]/)
  assert.match(tikz, /ellipse\[x radius=2, y radius=0\.5\]/)
  assert.doesNotMatch(tikz, /\.\. controls/)
})

test('3D template paths export in a TikZ canvas-is-plane scope', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'templatePath',
    id: 'circle-template-3d',
    name: 'Circle Template 3D',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    template: {
      kind: 'circleTemplate',
      center: { x: 1, y: 2, z: 3 },
      radius: 2,
      frame: {
        origin: { x: 1, y: 2, z: 3 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
    },
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /\(0,0\) circle\[radius=2\]/)
})

test('2D grid exports foreach loops', () => {
  const tikz = generateTikz(createTwoDimensionalGridDiagram())

  assert.match(tikz, /\\foreach \\stzGridU in \{0,1,\.\.\.,5\} \{/)
  assert.match(tikz, /\\foreach \\stzGridV in \{0,1,\.\.\.,5\} \{/)
})

test('2D grid exports a rectangular clip', () => {
  const tikz = generateTikz(createTwoDimensionalGridDiagram())

  assert.match(tikz, /\\clip \(0,0\) rectangle \(5,5\);/)
})

test('2D triangular lattice exports compact foreach loops and clip', () => {
  const tikz = generateTikz(
    createTwoDimensionalGridDiagram({
      latticePattern: 'triangular',
      uRange: numericGridRange(0, 3, 1),
      vRange: numericGridRange(0, 3, 1),
      clip: numericGridClip(0, 3, 0, 3),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\clip \(0,0\) rectangle \(3,3\);/)
  assert.equal(countMatches(layerBlock, /\\foreach/g), 3)
  assert.match(layerBlock, /\\foreach \\stzGridW/)
  assert.match(layerBlock, /1\.732051/)
  assert.doesNotMatch(layerBlock, /NaN|Infinity/)
})

test('2D honeycomb lattice exports compact foreach loops and clip', () => {
  const tikz = generateTikz(
    createTwoDimensionalGridDiagram({
      latticePattern: 'honeycomb',
      uRange: numericGridRange(0, 3, 1),
      vRange: numericGridRange(0, 3, 1),
      clip: numericGridClip(0, 3, 0, 3),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\clip \(0,0\) rectangle \(3,3\);/)
  assert.match(layerBlock, /\\foreach \\stzGridI/)
  assert.match(layerBlock, /\\foreach \\stzGridJ/)
  assert.match(layerBlock, /-- cycle;/)
  assert.doesNotMatch(layerBlock, /NaN|Infinity/)
})

test('2D grid foreach export does not expand every line', () => {
  const tikz = generateTikz(
    createTwoDimensionalGridDiagram({
      uRange: numericGridRange(0, 5, 1),
      vRange: numericGridRange(0, 5, 1),
      clip: numericGridClip(0, 5, 0, 5),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.equal(countMatches(layerBlock, /\\foreach/g), 2)
  assert.equal(countMatches(layerBlock, /\\draw\[/g), 2)
})

test('3D work-plane grid exports a canvas-is-plane scope', () => {
  const tikz = generateTikz(createThreeDimensionalGridDiagram())
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(layerBlock, /plane origin=\{\(0,1,0\)\}/)
  assert.match(layerBlock, /plane x=\{\(1,1,0\)\}/)
  assert.match(layerBlock, /plane y=\{\(0,1,1\)\}/)
  assert.match(layerBlock, /canvas is plane/)
})

test('3D work-plane grid uses local coordinates inside the scope', () => {
  const tikz = generateTikz(createThreeDimensionalGridDiagram())
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\clip \(-1,-1\) rectangle \(1,1\);/)
  assert.match(
    layerBlock,
    /\(\\stzGridU,-1\) -- \(\\stzGridU,1\);/,
  )
  assert.match(
    layerBlock,
    /\(-1,\\stzGridV\) -- \(1,\\stzGridV\);/,
  )
  assert.doesNotMatch(layerBlock, /\(0,1,-1\) -- \(0,1,1\);/)
})

test('3D triangular lattice exports a canvas-is-plane foreach scope', () => {
  const tikz = generateTikz(
    createThreeDimensionalGridDiagram({ latticePattern: 'triangular' }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /\\foreach \\stzGridW/)
  assert.match(layerBlock, /\\clip \(-1,-1\) rectangle \(1,1\);/)
})

test('3D honeycomb lattice exports a canvas-is-plane foreach scope', () => {
  const tikz = generateTikz(
    createThreeDimensionalGridDiagram({ latticePattern: 'honeycomb' }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /\\foreach \\stzGridI/)
  assert.match(layerBlock, /\\clip \(-1,-1\) rectangle \(1,1\);/)
})

test('grid TikZ export preserves style and layer', () => {
  const tikz = generateTikz(
    createTwoDimensionalGridDiagram({
      id: 'styled-grid',
      name: 'Styled grid',
      layer: 7,
      style: curveStyle({
        strokeColor: '#4D9DE0',
        strokeOpacity: 0.4,
        lineWidth: 0.8,
        lineStyle: 'dashed',
      }),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer7')

  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer7,main\}/)
  assert.match(tikz, /\{HTML\}\{4D9DE0\}/)
  assert.match(layerBlock, /draw opacity=0\.4/)
  assert.match(layerBlock, /line width=0\.8pt/)
  assert.match(layerBlock, /dashed/)
  assert.match(layerBlock, /\\foreach/)
})

test('triangular lattice TikZ export preserves style and layer', () => {
  const tikz = generateTikz(
    createTwoDimensionalGridDiagram({
      latticePattern: 'triangular',
      id: 'styled-triangle-grid',
      name: 'Styled triangular grid',
      layer: 7,
      style: curveStyle({
        strokeColor: '#4D9DE0',
        strokeOpacity: 0.4,
        lineWidth: 0.8,
        lineStyle: 'dashed',
      }),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer7')

  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer7,main\}/)
  assert.match(tikz, /\{HTML\}\{4D9DE0\}/)
  assert.match(layerBlock, /draw opacity=0\.4/)
  assert.match(layerBlock, /line width=0\.8pt/)
  assert.match(layerBlock, /dashed/)
  assert.match(layerBlock, /\\foreach \\stzGridW/)
})

test('invalid grid ranges are rejected before export', () => {
  const diagram = createTwoDimensionalGridDiagram({
    uRange: numericGridRange(2, -2, 1),
  })
  const validation = validateDiagram(diagram)
  const tikz = generateTikz(diagram)

  assert.equal(validation.valid, false)
  assert.match(validation.errors.map(formatValidationIssue).join('\n'), /max must be greater/)
  assert.match(tikz, /Grid "Grid" \[grid\] omitted: uRange\.max/)
  assert.doesNotMatch(tikz, /\\foreach/)
})

test('inline grid output has no blank lines', () => {
  const tikz = generateTikz(createTwoDimensionalGridDiagram(), {
    exportMode: 'inlineMath',
  })

  assert.match(tikz, /\\foreach \\stzGridU/)
  expectNoBlankLines(tikz)
})

test('inline triangular and honeycomb lattice output has no blank lines', () => {
  const outputs = [
    generateTikz(
      createTwoDimensionalGridDiagram({ latticePattern: 'triangular' }),
      { exportMode: 'inlineMath' },
    ),
    generateTikz(
      createTwoDimensionalGridDiagram({ latticePattern: 'honeycomb' }),
      { exportMode: 'inlineMath' },
    ),
  ]

  for (const tikz of outputs) {
    assert.match(tikz, /\\foreach/)
    assert.doesNotMatch(tikz, /NaN|Infinity/)
    expectNoBlankLines(tikz)
  }
})

test('grid foreach indentation uses four-space levels', () => {
  const tikz = generateTikz(createTwoDimensionalGridDiagram(), {
    exportMode: 'inlineMath',
  })

  assert.match(tikz, /\n {12}\\foreach \\stzGridU/)
  assert.match(tikz, /\n {16}\\draw\[/)
  assert.match(tikz, /\n {20}draw=/)
  expectNoTwoSpaceCommandIndent(tikz)
})

test('grid numeric TikZ output is finite', () => {
  const tikz = generateTikz(createThreeDimensionalGridDiagram())

  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('symbolic grid clip endpoints export when foreach ranges are numeric', () => {
  const diagram = createTwoDimensionalGridDiagram({
    clip: {
      kind: 'rectangle',
      uMin: numericGridScalar(0),
      uMax: symbolicGridScalar('R', 5),
      vMin: numericGridScalar(0),
      vMax: symbolicGridScalar('S', 5),
    },
  })

  diagram.variables = [
    {
      id: 'grid-var-R',
      name: 'R',
      macroName: 'R',
      expression: '5',
      previewValue: 5,
    },
    {
      id: 'grid-var-S',
      name: 'S',
      macroName: 'S',
      expression: '5',
      previewValue: 5,
    },
  ]

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\pgfmathsetmacro\{\\R\}\{5\}/)
  assert.match(tikz, /\\clip \(0,0\) rectangle \(\{\\R\},\{\\S\}\);/)
  assert.match(tikz, /\\foreach \\stzGridU in \{0,1,\.\.\.,5\}/)
})

test('symbolic grid foreach ranges are omitted with a clear limitation', () => {
  const diagram = createTwoDimensionalGridDiagram({
    uRange: {
      min: symbolicGridScalar('R', 0),
      max: numericGridScalar(5),
      step: numericGridScalar(1),
    },
  })

  diagram.variables = [
    {
      id: 'grid-var-R',
      name: 'R',
      macroName: 'R',
      expression: '0',
      previewValue: 0,
    },
  ]

  const validation = validateDiagram(diagram)
  const tikz = generateTikz(diagram)

  assert.equal(validation.valid, true)
  assert.match(tikz, /uRange\.min is symbolic/)
  assert.doesNotMatch(tikz, /\\foreach/)
})

test('2D arc path segment exports using readable TikZ arc syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'arc-segment-path',
    name: 'Arc Segment Path',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    segments: [
      {
        kind: 'arc',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 0, y: 1, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        radius: 1,
        startAngleDeg: 0,
        endAngleDeg: 90,
        direction: 'counterclockwise',
      },
    ],
  })

  assert.match(
    generateTikz(diagram),
    /arc\[start angle=0, end angle=90, radius=1\]/,
  )
})

test('3D cross-work-plane concatenated path exports absolute coordinates in segment order', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'cross-plane-path',
    name: 'Cross Plane Path',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 1 },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curvePathCrossPlanePath0p0\) at \(0,0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePathCrossPlanePath0p1\) at \(1,0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePathCrossPlanePath0p2\) at \(1,0,1\);/)
  assert.match(
    tikz,
    /\(curvePathCrossPlanePath0p0\) -- \(curvePathCrossPlanePath0p1\) -- \(curvePathCrossPlanePath0p2\);/,
  )
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('single concatenated path segment override changes TikZ style', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'segment-style',
    name: 'Segment Style',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
        styleOverride: {
          strokeColor: '#CC0033',
          strokeOpacity: 0.45,
          lineWidth: 2.6,
          lineStyle: 'dashed',
        },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\{HTML\}\{CC0033\}/)
  assert.match(tikz, /draw opacity=0\.45/)
  assert.match(tikz, /line width=2\.6pt/)
  assert.match(tikz, /dashed/)
  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 1)
})

test('3D cross-work-plane concatenated path preserves segment style overrides', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'cross-plane-style',
    name: 'Cross Plane Style',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 1 },
        styleOverride: {
          strokeColor: '#CC0033',
          strokeOpacity: 0.45,
          lineWidth: 2.6,
          lineStyle: 'denselyDotted',
        },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const firstSegment =
    '(curvePathCrossPlaneStyle0p0) -- (curvePathCrossPlaneStyle0p1);'
  const secondSegment =
    '(curvePathCrossPlaneStyle0p1) -- (curvePathCrossPlaneStyle0p2);'
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 2)
  assert.match(tikz, /\{HTML\}\{CC0033\}/)
  assert.match(tikz, /draw opacity=0\.45/)
  assert.match(tikz, /line width=2\.6pt/)
  assert.match(tikz, /densely dotted/)
  assert.ok(splitDrawSection.indexOf(firstSegment) < splitDrawSection.indexOf(secondSegment))
})

test('mixed-style concatenated path exports split draw commands in segment order', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'mixed-style-path',
    name: 'Mixed Style Path',
    pathLabel: 'mixed style path',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 2, y: 0, z: 0 },
        styleOverride: { lineStyle: 'dotted' },
      },
      {
        kind: 'line',
        start: { x: 2, y: 0, z: 0 },
        end: { x: 3, y: 0, z: 0 },
        styleOverride: { lineStyle: 'denselyDotted' },
      },
    ],
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)
  const firstSegment = '(curvePathMixedStylePath0p0) -- (curvePathMixedStylePath0p1);'
  const secondSegment = '(curvePathMixedStylePath0p1) -- (curvePathMixedStylePath0p2);'
  const thirdSegment = '(curvePathMixedStylePath0p2) -- (curvePathMixedStylePath0p3);'
  const splitDrawSection = tikz.slice(
    tikz.indexOf('% Segment style overrides split this concatenated path'),
  )

  assert.match(tikz, /% Segment style overrides split this concatenated path/)
  assert.match(tikz, /% Saved full concatenated path for spath operations\./)
  assert.match(tikz, /\\path\[[\s\S]*spath\/save=mixedStylePath/)
  assert.equal((tikz.match(/\\draw\[/g) ?? []).length, 3)
  assert.match(tikz, /dotted/)
  assert.match(tikz, /densely dotted/)
  assert.ok(splitDrawSection.indexOf(firstSegment) < splitDrawSection.indexOf(secondSegment))
  assert.ok(splitDrawSection.indexOf(secondSegment) < splitDrawSection.indexOf(thirdSegment))
  assert.match(
    tikz,
    /\(curvePathMixedStylePath0p0\) -- \(curvePathMixedStylePath0p1\) -- \(curvePathMixedStylePath0p2\) -- \(curvePathMixedStylePath0p3\);/,
  )
})

test('polygon sheet with path label emits spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'polygonSheet',
      id: 'surface-path',
      name: 'Surface path',
      pathLabel: 'surface boundary',
      style: sheetStyle(),
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      layer: 0,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /spath\/save=surfaceBoundary/)
  assert.match(
    tikz,
    /\(sheetPolySurfacePath0p0\) -- \(sheetPolySurfacePath0p1\) -- \(sheetPolySurfacePath0p2\) -- cycle;/,
  )
})

test('2D one-boundary filledRegion exports as a filled closed path', () => {
  const tikz = generateTikz(createFilledRegionDiagram())

  assert.match(tikz, /% Codimension 0 strata: regions/)
  assert.match(tikz, /\\coordinate \(regionFilledFilledRegion0b0p0\) at \(0,0\);/)
  assert.match(tikz, /\\filldraw\[/)
  assert.match(
    tikz,
    /\(regionFilledFilledRegion0b0p0\) -- \(regionFilledFilledRegion0b0p1\) -- \(regionFilledFilledRegion0b0p2\) -- \(regionFilledFilledRegion0b0p3\) -- \(regionFilledFilledRegion0b0p4\) -- cycle;/,
  )
  assert.doesNotMatch(tikz, /deferred/)
})

test('2D multi-boundary filledRegion with evenOdd exports even odd rule', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      fillRule: 'evenOdd',
      boundaries: [
        squareBoundary2D('outer', 0, 0, 4),
        squareBoundary2D('inner', 1, 1, 1),
      ],
    }),
  )

  assert.match(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('2D filledRegion with nonzero fill rule omits even odd rule', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      fillRule: 'nonzero',
      boundaries: [
        squareBoundary2D('outer', 0, 0, 4),
        squareBoundary2D('inner', 1, 1, 1),
      ],
    }),
  )

  assert.doesNotMatch(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('2D filledRegion exports cubic boundary segments', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      boundaries: [cubicBoundary2D('cubic-loop')],
    }),
  )

  assert.match(tikz, /\\coordinate \(regionFilledFilledRegion0b0p1\) at \(0\.5,1\);/)
  assert.match(tikz, /\\coordinate \(regionFilledFilledRegion0b0p2\) at \(1\.5,1\);/)
  assert.match(
    tikz,
    /\(regionFilledFilledRegion0b0p0\) \.\. controls \(regionFilledFilledRegion0b0p1\) and \(regionFilledFilledRegion0b0p2\) \.\. \(regionFilledFilledRegion0b0p3\) -- \(regionFilledFilledRegion0b0p4\) -- cycle;/,
  )
})

test('2D filledRegion TikZ preserves fill and stroke color opacity', () => {
  const tikz = generateTikz(
    createFilledRegionDiagram({
      style: regionStyle({
        fillColor: '#112233',
        fillOpacity: 0.42,
        strokeColor: '#445566',
        strokeOpacity: 0.73,
      }),
    }),
  )

  assert.match(tikz, /\{HTML\}\{112233\}/)
  assert.match(tikz, /\{HTML\}\{445566\}/)
  assert.match(tikz, /fill opacity=0\.42/)
  assert.match(tikz, /draw opacity=0\.73/)
})

test('2D filledRegion TikZ stays inside the correct layer block', () => {
  const tikz = generateTikz(createFilledRegionDiagram({ layer: 5 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer5')

  assert.match(layerBlock, /% Codimension 0 strata: regions/)
  assert.match(layerBlock, /\\filldraw\[/)
  assert.match(
    tikz,
    /\\pgfsetlayers\{stratifiedLayer5,main\}/,
  )
})

test('3D one-boundary workPlaneFilledSheet exports a styled filled path', () => {
  const tikz = generateTikz(createWorkPlaneFilledSheetDiagram())

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /\\begin\{scope\}\[/)
  assert.match(tikz, /canvas is plane/)
  assert.match(tikz, /\\filldraw\[/)
  assert.match(tikz, /\(0,0\) -- \(2,0\) -- \(2,2\) -- \(0,2\) -- \(0,0\) -- cycle;/)
  assert.doesNotMatch(tikz, /deferred/)
})

test('3D multi-boundary workPlaneFilledSheet with evenOdd exports even odd rule', () => {
  const tikz = generateTikz(
    createWorkPlaneFilledSheetDiagram({
      fillRule: 'evenOdd',
      boundaries: [
        squareBoundary3D('outer', 2, 0, 0, 4),
        squareBoundary3D('inner', 2, 1, 1, 1),
      ],
    }),
  )

  assert.match(tikz, /even odd rule/)
  assert.equal((tikz.match(/-- cycle/g) ?? []).length, 2)
})

test('3D workPlaneFilledSheet falls back to absolute coordinates when local scope is invalid', () => {
  const diagram = createWorkPlaneFilledSheetDiagram()
  const sheet = diagram.strata[0]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }

  sheet.planeFrame = {
    ...sheet.planeFrame,
    u: { x: Number.NaN, y: 0, z: 0 },
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /local plane scope could not be used/)
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.match(tikz, /\\coordinate \(sheetFilledFilledSheet0b0p0\) at \(0,0,2\);/)
  assert.match(
    tikz,
    /\(sheetFilledFilledSheet0b0p0\) -- \(sheetFilledFilledSheet0b0p1\) -- \(sheetFilledFilledSheet0b0p2\) -- \(sheetFilledFilledSheet0b0p3\) -- \(sheetFilledFilledSheet0b0p4\) -- cycle;/,
  )
})

test('3D workPlaneFilledSheet source-only symbolic frame origin falls back with a comment', () => {
  const frame = xyFrame3D(sourceOnlyWorkPlaneLocalCoordinate(2, 0, 0))
  const diagram = createWorkPlaneFilledSheetDiagram({
    boundaries: [squareBoundary3D('source-frame-boundary', 0, 2, 0, 1)],
  })
  const sheet = diagram.strata[0]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'workPlaneFilledSheet') {
    throw new Error('Expected a work-plane filled sheet.')
  }

  sheet.planeFrame = frame

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /uses absolute 3D coordinates because its local plane scope could not be used/,
  )
  assert.match(
    tikz,
    /work-plane filled sheet "Filled Sheet" \[filled-sheet\] frame\.origin contains work-plane-local symbolic source metadata/,
  )
  assert.match(tikz, /\\coordinate \(sheetFilledFilledSheet0b0p0\) at \(2,0,0\);/)
  assert.doesNotMatch(tikz, /canvas is plane/)
  assert.doesNotMatch(tikz, /plane origin=\{\(2,0,0\)\}/)
})

test('3D workPlaneFilledSheet TikZ preserves fill and stroke color opacity', () => {
  const tikz = generateTikz(
    createWorkPlaneFilledSheetDiagram({
      style: sheetStyle({
        fillColor: '#ABCDEF',
        fillOpacity: 0.28,
        strokeColor: '#123ABC',
        strokeOpacity: 0.66,
      }),
    }),
  )

  assert.match(tikz, /\{HTML\}\{ABCDEF\}/)
  assert.match(tikz, /\{HTML\}\{123ABC\}/)
  assert.match(tikz, /fill opacity=0\.28/)
  assert.match(tikz, /draw opacity=0\.66/)
})

test('3D workPlaneFilledSheet TikZ stays inside the correct layer block', () => {
  const tikz = generateTikz(createWorkPlaneFilledSheetDiagram({ layer: 6 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer6')

  assert.match(layerBlock, /% Codimension 1 strata: sheets/)
  assert.match(layerBlock, /canvas is plane/)
  assert.match(layerBlock, /\\filldraw\[/)
})

test('3D curvedSheet hemisphere exports sampled mesh faces inside the sheet layer', () => {
  const tikz = generateTikz(createCurvedHemisphereSheetDiagram({ layer: 8 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer8')

  assert.match(layerBlock, /% Codimension 1 strata: sheets/)
  assert.match(
    layerBlock,
    /Curved sheet "Curved Hemisphere" \[curved-hemisphere\] sampled mesh export/,
  )
  assert.match(layerBlock, /Primitive: hemisphere; sampling: u=8, v=4; faces=32/)
  assert.match(
    tikz,
    /\\coordinate \(sheetCurvedCurvedHemisphere0p0\) at \(0,0,1\);/,
  )
  assert.match(layerBlock, /\\begin\{scope\}\[/)
  assert.equal((layerBlock.match(/\\filldraw/g) ?? []).length, 32)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('3D curvedSheet saddle export preserves style and layer', () => {
  const tikz = generateTikz(
    createCurvedSaddleSheetDiagram({
      layer: 5,
      style: sheetStyle({
        fillColor: '#ABCDEF',
        fillOpacity: 0.28,
        strokeColor: '#123ABC',
        strokeOpacity: 0.66,
      }),
    }),
  )
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer5')

  assert.match(layerBlock, /Primitive: saddle; sampling: u=6, v=5; faces=30/)
  assert.equal((layerBlock.match(/\\filldraw/g) ?? []).length, 30)
  assert.match(tikz, /\{HTML\}\{ABCDEF\}/)
  assert.match(tikz, /\{HTML\}\{123ABC\}/)
  assert.match(layerBlock, /fill opacity=0\.28/)
  assert.match(layerBlock, /draw opacity=0\.66/)
  assert.match(tikz, /\\pgfsetlayers\{stratifiedLayer5,main\}/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('3D curvedSheet default sampled TikZ output remains bounded', () => {
  const tikz = generateTikz(createCurvedHemisphereSheetDiagram())

  assert.ok(tikz.length < 16000)
  assert.equal((tikz.match(/\\filldraw/g) ?? []).length, 32)
  assert.doesNotMatch(tikz, /omitted/)
})

test('3D curvedSheet TikZ export omits meshes above the readable face cap', () => {
  const diagram = createCurvedHemisphereSheetDiagram()
  const sheet = diagram.strata[0]

  if (sheet.geometricKind !== 'sheet' || sheet.kind !== 'curvedSheet') {
    throw new Error('Expected a curved sheet.')
  }

  sheet.primitive = {
    ...sheet.primitive,
    sampling: { uSegments: 32, vSegments: 9 },
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /omitted because its sampled mesh has 288 faces/)
  assert.match(
    tikz,
    new RegExp(`Reduce sampling to at most ${maxCurvedSheetTikzFaces} faces`),
  )
  assert.doesNotMatch(tikz, /sheetCurvedCurvedHemisphere0p0/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('existing 3D vertex sheet export remains a single closed path', () => {
  const tikz = generateTikz(createThreeDimensionalDiagram())
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer0')

  assert.match(layerBlock, /\\filldraw\[/)
  assert.match(
    layerBlock,
    /\(sheetQuadPage0p0\) -- \(sheetQuadPage0p1\) -- \(sheetQuadPage0p2\) -- \(sheetQuadPage0p3\) -- cycle;/,
  )
  assert.doesNotMatch(layerBlock, /sampled mesh export/)
})

test('filled-object TikZ output has no NaN or Infinity values', () => {
  const tikz = [
    generateTikz(createFilledRegionDiagram()),
    generateTikz(createWorkPlaneFilledSheetDiagram()),
    generateTikz(createCurvedHemisphereSheetDiagram()),
    generateTikz(createCurvedSaddleSheetDiagram()),
  ].join('\n')

  assert.doesNotMatch(tikz, /NaN/)
  assert.doesNotMatch(tikz, /Infinity/)
})

test('ordinary non-finite TikZ geometry is omitted instead of emitting invalid coordinates', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      id: 'bad-sheet',
      name: 'Bad Sheet',
      style: sheetStyle(),
      corners: [
        { x: 0, y: 0, z: 0 },
        { x: Number.NaN, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'bad-curve',
      name: 'Bad Curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: Number.POSITIVE_INFINITY, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'bad-point',
      name: 'Bad Point',
      style: pointStyle(),
      position: { x: 0, y: 0, z: Number.NaN },
      layer: 0,
    },
  )
  diagram.labels.push({
    geometricKind: 'label',
    id: 'bad-label',
    name: 'Bad Label',
    text: '$B$',
    position: { x: Number.NEGATIVE_INFINITY, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /Sheet "Bad Sheet" \[bad-sheet\] omitted/)
  assert.match(tikz, /Curve "Bad Curve" \[bad-curve\] omitted/)
  assert.match(tikz, /Point "Bad Point" \[bad-point\] omitted/)
  assert.match(tikz, /Label "Bad Label" \[bad-label\] omitted/)
  assert.doesNotMatch(tikz, /\\coordinate \(sheetQuadBadSheet0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(curvePolyBadCurve0p1\)/)
  assert.doesNotMatch(tikz, /NaN|Infinity/)
})

test('filled-object TikZ omits non-finite fill boundaries instead of emitting invalid coordinates', () => {
  const tikz = [
    generateTikz(
      createFilledRegionDiagram({
        boundaries: [nonFiniteBoundary2D('bad-region-boundary')],
      }),
    ),
    generateTikz(
      createWorkPlaneFilledSheetDiagram({
        boundaries: [nonFiniteBoundary3D('bad-sheet-boundary')],
      }),
    ),
  ].join('\n')

  assert.match(tikz, /Filled region "Filled Region" \[filled-region\] omitted/)
  assert.match(
    tikz,
    /Work-plane filled sheet "Filled Sheet" \[filled-sheet\] omitted/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(regionFilledFilledRegion0b0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(sheetFilledFilledSheet0b0p1\)/)
  assert.doesNotMatch(tikz, /NaN/)
  assert.doesNotMatch(tikz, /Infinity/)
})

test('point stratum path label is not emitted as spath save option', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const point = {
    codim: 2,
    geometricKind: 'point',
    id: 'point-path',
    name: 'Point path',
    pathLabel: 'point path',
    style: pointStyle(),
    position: { x: 0, y: 0, z: 0 },
    layer: 0,
  } satisfies PointStratum & { pathLabel: string }
  diagram.strata.push(point)

  assert.doesNotMatch(generateTikz(diagram), /spath\/save=/)
})

test('free text labels are not emitted as spath save options', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'path-text',
    name: 'Path text',
    text: 'spath/save=notAPathLabel',
    position: { x: 0, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\{spath\/save=notAPathLabel\}/)
  assert.doesNotMatch(tikz, /spath\/save=notAPathLabel,/)
  assert.doesNotMatch(tikz, /% \\usetikzlibrary\{spath3\}/)
})

test('non-default label styles are emitted', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'styledLabel',
    name: 'Styled label',
    text: '$\\alpha \\colon f \\Rightarrow g$',
    position: { x: 0, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#A23E48',
      opacity: 0.65,
      fontSize: 14,
      anchor: 'north east',
    },
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\definecolor\{stzLabelstyledLabel\}\{HTML\}\{A23E48\}/)
  assert.match(tikz, /text=stzLabelstyledLabel/)
  assert.match(tikz, /opacity=0\.65/)
  assert.match(tikz, /font=\\fontsize\{14pt\}\{16\.8pt\}\\selectfont/)
  assert.match(tikz, /anchor=north east/)
  assert.match(tikz, /\$\\alpha \\colon f \\Rightarrow g\$/)
})

test('label text is preserved without automatic math wrapping', () => {
  const tikz = generateTikz(createTwoDimensionalDiagram())

  assert.match(tikz, /\\node at \(2,3\) \{\$F\^\{\(1\)\}L\$\};/)
})

test('point shapes include circle, square, triangle, and star', () => {
  for (const shape of ['circle', 'square', 'triangle', 'star'] satisfies PointShape[]) {
    const tikz = generateTikz(createPointShapeDiagram(shape))

    if (shape === 'circle') {
      assert.match(tikz, /circle/)
    }

    if (shape === 'square') {
      assert.match(tikz, /regular polygon sides=4/)
    }

    if (shape === 'triangle') {
      assert.match(tikz, /regular polygon sides=3/)
    }

    if (shape === 'star') {
      assert.match(tikz, /star points=5/)
    }
  }
})

test('non-circular point shapes document required TikZ libraries', () => {
  for (const shape of ['square', 'triangle', 'star'] satisfies PointShape[]) {
    const tikz = generateTikz(createPointShapeDiagram(shape))

    assert.match(
      tikz,
      /% Required TikZ libraries for non-circular point shapes:/,
    )
    assert.match(tikz, /% \\usetikzlibrary\{shapes\.geometric,shapes\.symbols\}/)
  }
})

test('hollow points are emitted with white fill', () => {
  const tikz = generateTikz(
    createPointShapeDiagram('circle', {
      fill: 'hollow',
    }),
  )

  assert.match(tikz, /fill=white/)
})

test('curve coordinate names distinguish polyline and cubic Bezier curves', () => {
  const tikz = generateTikz(createCurveNamingDiagram())

  assert.match(tikz, /\\coordinate \(curvePolyWire0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyWire0p1\) at \(1,0\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p0\) at \(0,1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p1\) at \(1,2\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p2\) at \(2,2\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p3\) at \(3,1\);/)
  assert.match(tikz, /\(curvePolyWire0p0\) -- \(curvePolyWire0p1\);/)
  assert.match(
    tikz,
    /\(curveBezierArc1p0\) \.\. controls \(curveBezierArc1p1\) and \(curveBezierArc1p2\) \.\. \(curveBezierArc1p3\);/,
  )
  assert.doesNotMatch(tikz, /curvecurve/)
})

test('relative Cartesian cubic Bezier export uses TikZ relative control syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'relative-cartesian',
    name: 'Relative Cartesian',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 7, y: 14, z: 0 },
      { x: 10, y: 10, z: 0 },
    ],
    bezierControls: {
      kind: 'relativeCartesian',
      firstControlOffset: { x: 1, y: 2, z: 0 },
      secondControlOffset: { x: -3, y: 4, z: 0 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curveBezierRelativeCartesian0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curveBezierRelativeCartesian0p3\) at \(10,10\);/)
  assert.match(
    tikz,
    /\(curveBezierRelativeCartesian0p0\) \.\. controls \+\(1,2\) and \+\(-3,4\) \.\. \(curveBezierRelativeCartesian0p3\);/,
  )
  assert.doesNotMatch(tikz, /curveBezierRelativeCartesian0p1/)
  assert.doesNotMatch(tikz, /curveBezierRelativeCartesian0p2/)
})

test('relative polar cubic Bezier export uses TikZ polar control syntax', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'relative-polar',
    name: 'Relative Polar',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 5, y: 8, z: 0 },
      { x: 5, y: 5, z: 0 },
    ],
    bezierControls: {
      kind: 'relativePolar',
      firstControl: { angleDegrees: 0, radius: 2 },
      secondControl: { angleDegrees: 90, radius: 3 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 0,
  })

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\(curveBezierRelativePolar0p0\) \.\. controls \+\(0:2\) and \+\(90:3\) \.\. \(curveBezierRelativePolar0p3\);/,
  )
  assert.doesNotMatch(tikz, /curveBezierRelativePolar0p1/)
  assert.doesNotMatch(tikz, /curveBezierRelativePolar0p2/)
})

test('work-plane-local relative polar 3D Bezier exports in a TikZ 3d canvas scope', () => {
  const tikz = generateTikz(createWorkPlaneRelativePolarBezierDiagram())

  assert.match(tikz, /% Requires \\usepackage\{tikz-3dplot\}/)
  assert.match(tikz, /\\tdplotsetmaincoords\{13\}\{-23\}/)
  assert.match(tikz, /tdplot_main_coords/)
  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(tikz, /\\begin\{scope\}\[/)
  assert.match(tikz, /plane origin=\{\(10,20,30\)\}/)
  assert.match(tikz, /plane x=\{\(11,20,30\)\}/)
  assert.match(tikz, /plane y=\{\(10,20,31\)\}/)
  assert.match(tikz, /canvas is plane/)
  assert.match(
    tikz,
    /\(2,3\) \.\. controls \+\(0:2\) and \+\(90:4\) \.\. \(6,7\);/,
  )
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierLocalRelativePolar0p1\)/)
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierLocalRelativePolar0p2\)/)
  assert.ok(
    tikz.indexOf('tdplot_main_coords') < tikz.indexOf('canvas is plane'),
  )
})

test('symbolic work-plane-local relative Bezier frame exports in local plane options', () => {
  const diagram = createWorkPlaneRelativePolarBezierDiagram()
  const curve = diagram.strata[0]

  diagram.variables = [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '10',
      previewValue: 10,
    },
    {
      id: 'var-U',
      name: 'U',
      macroName: 'U',
      expression: '1',
      previewValue: 1,
    },
    {
      id: 'var-V',
      name: 'V',
      macroName: 'V',
      expression: '1',
      previewValue: 1,
    },
  ]
  if (
    curve.geometricKind !== 'curve' ||
    curve.kind !== 'cubicBezier' ||
    curve.bezierControls?.kind !== 'workPlaneRelativePolar'
  ) {
    throw new Error('Expected a work-plane-relative polar Bezier curve.')
  }
  curve.bezierControls = {
    ...curve.bezierControls,
    frame: {
      ...curve.bezierControls.frame,
      origin: symbolicVec3(symbolicComponent('R', 10), 20, 30),
      u: symbolicVec3(symbolicComponent('U', 1), 0, 0),
      v: symbolicVec3(0, 0, symbolicComponent('V', 1)),
    },
  }

  const tikz = generateTikz(diagram)

  assert.match(tikz, /plane origin=\{\(\{\\R\},20,30\)\}/)
  assert.match(tikz, /plane x=\{\(\{\\R \+ \\U\},20,30\)\}/)
  assert.match(tikz, /plane y=\{\(\{\\R\},20,\{30 \+ \\V\}\)\}/)
  assert.doesNotMatch(tikz, /plane origin=\{\(10,20,30\)\}/)
  assert.doesNotMatch(tikz, /\\coordinate \(curveBezierLocalRelativePolar0p1\)/)
})

test('work-plane-local relative Cartesian 3D Bezier uses local relative controls', () => {
  const tikz = generateTikz(createWorkPlaneRelativeCartesianBezierDiagram())

  assert.match(tikz, /\\usetikzlibrary\{3d\}/)
  assert.match(
    tikz,
    /\(2,3\) \.\. controls \+\(2,-1\) and \+\(-3,4\) \.\. \(6,7\);/,
  )
  assert.doesNotMatch(
    tikz,
    /\\coordinate \(curveBezierLocalRelativeCartesian0p1\)/,
  )
  assert.doesNotMatch(
    tikz,
    /\\coordinate \(curveBezierLocalRelativeCartesian0p2\)/,
  )
})

test('work-plane-local 3D Bezier scope remains inside the curve layer block', () => {
  const tikz = generateTikz(createWorkPlaneRelativePolarBezierDiagram({ layer: 4 }))
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer4')

  assert.match(layerBlock, /\\begin\{scope\}\[/)
  assert.match(
    layerBlock,
    /\(2,3\) \.\. controls \+\(0:2\) and \+\(90:4\) \.\. \(6,7\);/,
  )
})

test('absolute 3D cubic Bezier fallback keeps control-point coordinate declarations', () => {
  const tikz = generateTikz(createAbsoluteThreeDimensionalBezierDiagram())

  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p0\) at \(0,0,0\);/)
  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p1\) at \(1,0,1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p2\) at \(2,1,1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierAbsoluteArc0p3\) at \(3,1,0\);/)
  assert.match(
    tikz,
    /\(curveBezierAbsoluteArc0p0\) \.\. controls \(curveBezierAbsoluteArc0p1\) and \(curveBezierAbsoluteArc0p2\) \.\. \(curveBezierAbsoluteArc0p3\);/,
  )
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{3d\}/)
})

test('inconsistent work-plane-local 3D Bezier metadata falls back to absolute controls', () => {
  const diagram = createWorkPlaneRelativeCartesianBezierDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve' || curve.kind !== 'cubicBezier') {
    throw new Error('Expected a cubic Bezier curve.')
  }

  if (curve.bezierControls?.kind !== 'workPlaneRelativeCartesian') {
    throw new Error('Expected work-plane-relative Cartesian controls.')
  }

  curve.bezierControls = {
    ...curve.bezierControls,
    localStart: { a: 20, b: 30 },
  }

  const tikz = generateTikz(diagram)

  assert.match(
    tikz,
    /\\coordinate \(curveBezierLocalRelativeCartesian0p1\) at \(14,20,32\);/,
  )
  assert.match(
    tikz,
    /\(curveBezierLocalRelativeCartesian0p0\) \.\. controls \(curveBezierLocalRelativeCartesian0p1\) and \(curveBezierLocalRelativeCartesian0p2\) \.\. \(curveBezierLocalRelativeCartesian0p3\);/,
  )
  assert.doesNotMatch(tikz, /\\usetikzlibrary\{3d\}/)
  assert.doesNotMatch(tikz, /canvas is plane/)
})

test('absolute cubic Bezier export keeps control-point coordinate declarations', () => {
  const tikz = generateTikz(createCurveNamingDiagram())

  assert.match(tikz, /\\coordinate \(curveBezierArc1p1\) at \(1,2\);/)
  assert.match(tikz, /\\coordinate \(curveBezierArc1p2\) at \(2,2\);/)
  assert.match(
    tikz,
    /\(curveBezierArc1p0\) \.\. controls \(curveBezierArc1p1\) and \(curveBezierArc1p2\) \.\. \(curveBezierArc1p3\);/,
  )
})

test('layer-aware output keeps relative Bezier curves in their layer block', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'layered-relative',
    name: 'Layered Relative',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 3, y: 0, z: 0 },
    ],
    bezierControls: {
      kind: 'relativeCartesian',
      firstControlOffset: { x: 1, y: 2, z: 0 },
      secondControlOffset: { x: -1, y: 2, z: 0 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer: 4,
  })

  const tikz = generateTikz(diagram)
  const layerBlock = extractLayerBlock(tikz, 'stratifiedLayer4')

  assert.match(
    layerBlock,
    /\(curveBezierLayeredRelative0p0\) \.\. controls \+\(1,2\) and \+\(-1,2\) \.\. \(curveBezierLayeredRelative0p3\);/,
  )
})

test('TikZ name stem sanitizer keeps readable safe names', () => {
  assert.equal(sanitizeTikzNameStem('Particle', 'point'), 'Particle')
  assert.equal(sanitizeTikzNameStem('F line', 'curve'), 'FLine')
  assert.equal(sanitizeTikzNameStem('alpha-beta', 'curve'), 'alphaBeta')
  assert.equal(sanitizeTikzNameStem('$F$', 'curve'), 'F')
})

test('TikZ name stem sanitizer falls back for blank or unsafe names', () => {
  assert.equal(sanitizeTikzNameStem('  ', 'sheet'), 'sheet')
  assert.equal(sanitizeTikzNameStem('\\{$%#&_ ^~}', 'curve'), 'curve')
  assert.equal(sanitizeTikzNameStem('123', 'point'), 'point123')
})

test('spath save name sanitizer keeps TikZ-safe non-empty names', () => {
  assert.equal(sanitizeTikzSpathSaveName('my path'), 'myPath')
  assert.equal(sanitizeTikzSpathSaveName('$F_{1}$'), 'F1')
  assert.equal(sanitizeTikzSpathSaveName('123'), 'savedPath123')
  assert.equal(sanitizeTikzSpathSaveName('\\{$%#&_ ^~}'), 'savedPath')
})

test('coordinate names include sanitized point, curve, and sheet names', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'polygonSheet',
      id: 'surface',
      name: 'Surface layer',
      style: sheetStyle(),
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'boundary',
      name: 'Boundary wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'cubicBezier',
      id: 'f-line',
      name: 'F line',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: 3, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 2,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'particle',
      name: 'Particle $P$',
      style: pointStyle(),
      position: { x: 1, y: 1, z: 0 },
      layer: 3,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(sheetPolySurfaceLayer0p0\) at \(0,0,0\);/)
  assert.match(
    tikz,
    /\(sheetPolySurfaceLayer0p0\) -- \(sheetPolySurfaceLayer0p1\) -- \(sheetPolySurfaceLayer0p2\) -- cycle;/,
  )
  assert.match(tikz, /\\coordinate \(curvePolyBoundaryWire0p0\) at \(0,0,0\);/)
  assert.match(tikz, /\(curvePolyBoundaryWire0p0\) -- \(curvePolyBoundaryWire0p1\);/)
  assert.match(tikz, /\\coordinate \(curveBezierFLine1p0\) at \(0,1,0\);/)
  assert.match(
    tikz,
    /\(curveBezierFLine1p0\) \.\. controls \(curveBezierFLine1p1\) and \(curveBezierFLine1p2\) \.\. \(curveBezierFLine1p3\);/,
  )
  assert.match(tikz, /\\coordinate \(pointParticleP0p0\) at \(1,1,0\);/)
  assert.match(tikz, /\] at \(pointParticleP0p0\) \{\};/)
  assert.doesNotMatch(tikz, /curvePolycurve/)
  assert.doesNotMatch(tikz, /curveBeziercurve/)
  assert.doesNotMatch(tikz, /sheetPolysheet/)
})

test('same stratum names still produce unique coordinate names', () => {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'first',
      name: 'Boundary',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'second',
      name: 'Boundary',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
  )

  const tikz = generateTikz(diagram)

  assert.match(tikz, /\\coordinate \(curvePolyBoundary0p0\) at \(0,0\);/)
  assert.match(tikz, /\\coordinate \(curvePolyBoundary1p0\) at \(0,1\);/)
  assert.equal(new Set(extractCoordinateNames(tikz)).size, 4)
})

test('changing a stratum name changes only generated coordinate names', () => {
  const original = createTwoDimensionalDiagram()
  const renamed: Diagram = {
    ...original,
    strata: original.strata.map((stratum) =>
      stratum.id === 'wire' ? { ...stratum, name: 'Boundary' } : stratum,
    ),
  }
  const originalTikz = generateTikz(original)
  const renamedTikz = generateTikz(renamed)

  assert.match(originalTikz, /curvePolyWire0p0/)
  assert.match(renamedTikz, /curvePolyBoundary0p0/)
  assert.equal(
    normalizeGeneratedCoordinateNames(originalTikz),
    normalizeGeneratedCoordinateNames(renamedTikz),
  )
})

function assertIncludesSection(tikz: string, title: string): void {
  assert.match(tikz, new RegExp(`% ${escapeRegExp(title)}`))
}

function expectNoBlankLines(output: string, message?: string): void {
  const blankLines = output
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*$/.test(line))

  assert.deepEqual(blankLines, [], message)
}

function expectNoTwoSpaceCommandIndent(output: string): void {
  const twoSpaceCommandIndent =
    /\n  \\(?:begin\{pgfonlayer\}|end\{pgfonlayer\}|begin\{scope\}|end\{scope\}|coordinate|definecolor|draw|filldraw|node|path|pgfdeclarelayer|pgfsetlayers|tdplotsetmaincoords|tikzset)/

  assert.doesNotMatch(
    output,
    twoSpaceCommandIndent,
  )
}

function expectNoLeadingOrTrailingBlankLine(output: string): void {
  const lines = output.split('\n')

  assert.notEqual(lines.length, 0)
  assert.doesNotMatch(lines[0] ?? '', /^\s*$/)
  assert.doesNotMatch(lines[lines.length - 1] ?? '', /^\s*$/)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractCoordinateNames(tikz: string): string[] {
  return [...tikz.matchAll(/\\coordinate \(([^)]+)\) at/g)].map(
    (match) => match[1],
  )
}

function extractMainCoords(tikz: string): string {
  const match = tikz.match(/\\tdplotsetmaincoords\{[^}]+\}\{[^}]+\}/)

  assert.notEqual(match, null)

  return match[0]
}

function extractLayerBlock(tikz: string, layerName: string): string {
  const blockPattern = new RegExp(
    `\\\\begin\\{pgfonlayer\\}\\{${escapeRegExp(layerName)}\\}([\\s\\S]*?)\\\\end\\{pgfonlayer\\}`,
  )
  const match = tikz.match(blockPattern)

  assert.notEqual(match, null)

  return match[1]
}

function extractTikzsetBlock(tikz: string): string {
  const match = tikz.match(/\\tikzset\{[\s\S]*?\n\s*\}/)

  assert.notEqual(match, null)

  return match[0]
}

function normalizeGeneratedCoordinateNames(tikz: string): string {
  const coordinateNames = extractCoordinateNames(tikz)
  let normalized = tikz

  coordinateNames.forEach((name, index) => {
    normalized = normalized.replaceAll(name, `coord${index}`)
  })

  return normalized
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length
}

function formatValidationIssue(issue: { path: string; message: string }): string {
  return `${issue.path} ${issue.message}`
}

function createTwoDimensionalGridDiagram(
  overrides: Partial<GridStratum> = {},
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  const grid: GridStratum = {
    codim: 1,
    geometricKind: 'curve',
    kind: 'grid',
    id: 'grid',
    name: 'Grid',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    frame: {
      kind: 'xy',
      frame: xyPlaneFrameAtZ(0),
    },
    uRange: numericGridRange(0, 5, 1),
    vRange: numericGridRange(0, 5, 1),
    clip: numericGridClip(0, 5, 0, 5),
    ...overrides,
  }

  diagram.strata.push(grid)

  return diagram
}

function createThreeDimensionalGridDiagram(
  overrides: Partial<GridStratum> = {},
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  const grid: GridStratum = {
    codim: 2,
    geometricKind: 'curve',
    kind: 'grid',
    id: 'grid-3d',
    name: '3D Grid',
    style: curveStyle(),
    styleSegments: [],
    layer: 0,
    frame: {
      kind: 'workPlane',
      frame: xzPlaneFrameAtY(1),
    },
    uRange: numericGridRange(-1, 1, 1),
    vRange: numericGridRange(-1, 1, 1),
    clip: numericGridClip(-1, 1, -1, 1),
    ...overrides,
  }

  diagram.strata.push(grid)

  return diagram
}

function numericGridRange(
  min: number,
  max: number,
  step: number,
): GridParameterRange {
  return {
    min: numericGridScalar(min),
    max: numericGridScalar(max),
    step: numericGridScalar(step),
  }
}

function numericGridClip(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
): GridRectangleClip {
  return {
    kind: 'rectangle',
    uMin: numericGridScalar(uMin),
    uMax: numericGridScalar(uMax),
    vMin: numericGridScalar(vMin),
    vMax: numericGridScalar(vMax),
  }
}

function numericGridScalar(value: number): GridParameterRange['min'] {
  return {
    kind: 'numeric',
    value,
  }
}

function symbolicGridScalar(
  expression: string,
  previewValue: number,
): GridParameterRange['min'] {
  return {
    kind: 'symbolic',
    expression,
    previewValue,
  }
}

function xzPlaneFrameAtY(y: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y, z: 0 },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  }
}

function withImportedTikzStyleReference(
  diagram: Diagram,
  id: string,
  key: string,
  targets: TikzStyleTarget[],
): Diagram {
  return withImportedTikzStyleReferences(diagram, [{ id, key, targets }])
}

function withImportedTikzStyleReferences(
  diagram: Diagram,
  references: Array<{
    id: string
    key: string
    targets: TikzStyleTarget[]
  }>,
): Diagram {
  return {
    ...diagram,
    externalTikzStyleSources: [
      {
        id: 'external-source-mygeometry',
        name: 'mygeometry.sty',
        loadHint: '\\input{mygeometry.sty}',
      },
    ],
    importedTikzStyleReferences: references.map((reference) => ({
      id: reference.id,
      key: reference.key,
      sourceId: 'external-source-mygeometry',
      displayName: reference.key,
      targets: reference.targets,
    })),
  }
}

function createTwoDimensionalExportModeRegressionDiagram(): Diagram {
  let diagram = createFilledRegionDiagram({
    boundaries: [
      squareBoundary2D('outer', 0, 0, 4),
      squareBoundary2D('inner', 1, 1, 1),
    ],
    fillRule: 'evenOdd',
    layer: -1,
    style: regionStyle({
      fillColor: '#112233',
      fillOpacity: 0.42,
      strokeColor: '#445566',
      strokeOpacity: 0.73,
    }),
  })
  const region = diagram.strata[0]

  if (region.geometricKind !== 'region') {
    throw new Error('Expected a filled region.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'region',
    'Inline region',
    region.style,
  )

  if (created === null) {
    throw new Error('Expected region preset creation to succeed.')
  }

  diagram = applyUserStylePresetToStratum(
    created.diagram,
    region.id,
    created.preset.id,
  )
  diagram = withImportedTikzStyleReference(
    diagram,
    'external-draw',
    '3cat/phys/1strata/color/x',
    ['draw', 'curve'],
  )
  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'external-wire',
    name: 'External wire',
    importedTikzStyleReferenceId: 'external-draw',
    style: curveStyle({
      strokeColor: '#778899',
      strokeOpacity: 0.8,
      lineStyle: 'denselyDotted',
    }),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 4, z: 0 },
    ],
    styleSegments: [],
    layer: 2,
  })
  diagram.labels.push({
    geometricKind: 'label',
    id: 'align-label',
    name: 'Align label',
    text: '$A$',
    position: { x: 4.4, y: 4.2, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 2,
  })

  return diagram
}

function createThreeDimensionalExportModeRegressionDiagram(): Diagram {
  const diagram = createWorkPlaneFilledSheetDiagram({
    layer: 3,
    style: sheetStyle({
      fillColor: '#ABCDEF',
      fillOpacity: 0.28,
      strokeColor: '#123ABC',
      strokeOpacity: 0.66,
    }),
  })

  diagram.strata.push(
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'camera-line',
      name: 'Camera line',
      style: curveStyle({
        strokeColor: '#CC0033',
        lineWidth: 1.8,
      }),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 2 },
      ],
      styleSegments: [],
      layer: 1,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'triangle-junction',
      name: 'Triangle junction',
      style: pointStyle({
        color: '#00AA33',
        shape: 'triangle',
        size: 4,
      }),
      position: { x: 1, y: 1, z: 2 },
      layer: 4,
    },
  )

  return diagram
}

function createLayeredTwoDimensionalDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'back-wire',
      name: 'Back wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'front-wire',
      name: 'Front wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0.5, z: 0 },
        { x: 1, y: 0.5, z: 0 },
      ],
      styleSegments: [],
      layer: 2,
    },
    {
      codim: 2,
      geometricKind: 'point',
      id: 'front-point',
      name: 'Front point',
      style: pointStyle(),
      position: { x: 1, y: 0.5, z: 0 },
      layer: 2,
    },
  )
  diagram.labels.push({
    geometricKind: 'label',
    id: 'negative-label',
    name: 'Negative label',
    text: '$L$',
    position: { x: 0.5, y: 1, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: -1,
  })

  return diagram
}

function createSameLayerOppositeIdCurveDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'z-curve',
      name: 'Z curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'a-curve',
      name: 'A curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  return diagram
}

function createCurveNamingDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'wire',
      name: 'Wire',
      style: curveStyle(),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'cubicBezier',
      id: 'arc',
      name: 'Arc',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 2, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: 3, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 1,
    },
  )

  return diagram
}

function createVariableDiagram(): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 2,
      },
      {
        id: 'var-q',
        name: 'q',
        macroName: 'q',
        expression: '30',
        previewValue: 30,
      },
    ],
  }
}

function createDependentVariableDiagram(): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: [
      {
        id: 'var-r',
        name: 'r',
        macroName: 'r',
        expression: 'R/2',
        previewValue: 1,
      },
      {
        id: 'var-R',
        name: 'R',
        macroName: 'R',
        expression: '2',
        previewValue: 2,
      },
    ],
  }
}

function createSymbolicExportDiagram(): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 2 }),
    variables: symbolicExportVariables(),
  }
}

function createLocalSymbolicThreeDimensionalDiagram(): Diagram {
  return {
    ...createEmptyDiagram({ ambientDimension: 3 }),
    variables: symbolicExportVariables(),
  }
}

function symbolicExportVariables(): SymbolicVariable[] {
  return [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
    {
      id: 'var-q',
      name: 'q',
      macroName: 'q',
      expression: '30',
      previewValue: 30,
    },
    {
      id: 'var-S',
      name: 'S',
      macroName: 'S',
      expression: '5',
      previewValue: 5,
    },
  ]
}

function symbolicFrameVariables(): SymbolicVariable[] {
  return [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
  ]
}

function equalPreviewFrameVariables(): SymbolicVariable[] {
  return [
    {
      id: 'var-R',
      name: 'R',
      macroName: 'R',
      expression: '2',
      previewValue: 2,
    },
    {
      id: 'var-S',
      name: 'S',
      macroName: 'S',
      expression: '2',
      previewValue: 2,
    },
  ]
}

function symbolicUnitFrameVariables(): SymbolicVariable[] {
  return [
    ...symbolicFrameVariables(),
    {
      id: 'var-U',
      name: 'U',
      macroName: 'U',
      expression: '1',
      previewValue: 1,
    },
    {
      id: 'var-V',
      name: 'V',
      macroName: 'V',
      expression: '1',
      previewValue: 1,
    },
  ]
}

function symbolicComponent(
  expression: string,
  previewValue: number,
): CoordinateComponent {
  return {
    kind: 'symbolic',
    expression,
    previewValue,
  }
}

function coordinateComponent(value: CoordinateComponent | number): CoordinateComponent {
  return typeof value === 'number'
    ? {
        kind: 'numeric',
        value,
      }
    : value
}

function coordinateComponentPreviewValue(
  component: CoordinateComponent,
): number {
  return component.kind === 'numeric' ? component.value : component.previewValue
}

function symbolicVec3(
  x: CoordinateComponent | number,
  y: CoordinateComponent | number,
  z: CoordinateComponent | number,
): Vec3 {
  const xComponent = coordinateComponent(x)
  const yComponent = coordinateComponent(y)
  const zComponent = coordinateComponent(z)

  return {
    x: coordinateComponentPreviewValue(xComponent),
    y: coordinateComponentPreviewValue(yComponent),
    z: coordinateComponentPreviewValue(zComponent),
    symbolic: {
      x: xComponent,
      y: yComponent,
      z: zComponent,
    },
  }
}

function numericScalar(value: number): WorkPlaneLocalCoordinateSource['local']['a'] {
  return {
    kind: 'numeric',
    value,
  }
}

function symbolicScalar(
  expression: string,
  previewValue: number,
): WorkPlaneLocalCoordinateSource['local']['a'] {
  return {
    kind: 'symbolic',
    expression,
    previewValue,
  }
}

function localCoordinateSource(
  frame: WorkPlaneFrameSnapshot,
  a: WorkPlaneLocalCoordinateSource['local']['a'],
  b: WorkPlaneLocalCoordinateSource['local']['b'],
): WorkPlaneLocalCoordinateSource {
  return {
    kind: 'workPlaneLocal',
    frame,
    local: { a, b },
  }
}

function workPlaneLocalPoint(
  x: number,
  y: number,
  z: number,
  source: WorkPlaneLocalCoordinateSource,
): Vec3 {
  return {
    x,
    y,
    z,
    symbolic: {
      x: { kind: 'numeric', value: x },
      y: { kind: 'numeric', value: y },
      z: { kind: 'numeric', value: z },
      source,
    },
  }
}

function sourceOnlyWorkPlaneLocalCoordinate(x: number, y: number, z: number): Vec3 {
  return workPlaneLocalPoint(
    x,
    y,
    z,
    localCoordinateSource(
      xyFrame3D({ x, y, z }),
      symbolicScalar('R', 0),
      numericScalar(0),
    ),
  )
}

function xyFrame3D(origin: Vec3 = { x: 0, y: 0, z: 0 }): WorkPlaneFrameSnapshot {
  return {
    origin,
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function createArrowPathDiagram(arrows?: PathArrowOptions): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'arrow-test-path',
    name: 'Arrow Test Path',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    styleSegments: [],
    ...(arrows === undefined ? {} : { arrows }),
    layer: 0,
  })

  return diagram
}

function createThreeDimensionalArrowPathDiagram(
  arrows?: PathArrowOptions,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'polyline',
    id: 'arrow-test-path-3d',
    name: 'Arrow Test Path 3D',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0.5, z: 0.75 },
    ],
    styleSegments: [],
    ...(arrows === undefined ? {} : { arrows }),
    layer: 0,
  })

  return diagram
}

function createBraidingCrossingDiagram(
  crossingKind?: 'none' | 'braiding' | 'antiBraiding',
  pathAArrows?: PathArrowOptions,
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'path-a',
      name: 'Path A',
      style: curveStyle(),
      points: [
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      styleSegments: [],
      ...(pathAArrows === undefined ? {} : { arrows: pathAArrows }),
      layer: 0,
    },
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'path-b',
      name: 'Path B',
      style: curveStyle({
        strokeColor: '#224466',
        lineWidth: 1.2,
      }),
      points: [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  if (crossingKind !== undefined) {
    diagram.pathCrossings = [
      pathCrossingStateFromCandidate(
        onlyPathIntersectionCandidate(diagram),
        crossingKind,
      ),
    ]
  }

  return diagram
}

function onlyPathIntersectionCandidate(diagram: Diagram) {
  const candidates = pathIntersectionCandidatesForDiagram(diagram)

  assert.equal(candidates.length, 1)

  const candidate = candidates[0]

  if (candidate === undefined) {
    throw new Error('Expected one path intersection candidate.')
  }

  return candidate
}

function createMixedStyleArrowPathDiagram(arrows?: PathArrowOptions): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.strata.push({
    codim: 1,
    geometricKind: 'curve',
    kind: 'concatenatedPath',
    id: 'split-arrow-path',
    name: 'Split Arrow Path',
    style: curveStyle(),
    segments: [
      {
        kind: 'line',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 1, y: 0, z: 0 },
        end: { x: 4, y: 0, z: 0 },
        styleOverride: {
          strokeColor: '#CC0033',
          strokeOpacity: 0.7,
          lineWidth: 1.8,
          lineStyle: 'dotted',
        },
      },
      {
        kind: 'line',
        start: { x: 4, y: 0, z: 0 },
        end: { x: 6, y: 0, z: 0 },
        styleOverride: { lineStyle: 'denselyDotted' },
      },
    ],
    styleSegments: [],
    ...(arrows === undefined ? {} : { arrows }),
    layer: 0,
  })

  return diagram
}

function withCurveArrows(
  diagram: Diagram,
  arrows: PathArrowOptions,
  curveId?: string,
): Diagram {
  const curve = diagram.strata.find(
    (stratum) =>
      stratum.geometricKind === 'curve' &&
      (curveId === undefined || stratum.id === curveId),
  )

  if (curve === undefined || curve.geometricKind !== 'curve') {
    throw new Error('Expected curve fixture.')
  }

  curve.arrows = arrows

  return diagram
}

function arrowOptions({
  endpoint = 'none',
  mid = {},
}: {
  endpoint?: PathArrowOptions['endpoint']
  mid?: Partial<PathArrowOptions['mid']>
} = {}): PathArrowOptions {
  return {
    endpoint,
    mid: {
      enabled: mid.enabled ?? false,
      position: mid.position ?? 0.5,
      direction: mid.direction ?? 'forward',
      head: mid.head ?? 'standard',
    },
  }
}

function createTwoDimensionalDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'wire',
      name: 'Wire',
      style: curveStyle({ strokeColor: '#123456' }),
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'point',
      id: 'vertex',
      name: 'Vertex',
      style: pointStyle({ color: '#654321' }),
      position: { x: 1, y: 2, z: 0 },
      layer: 0,
    },
  )
  diagram.labels.push(
    {
      geometricKind: 'label',
      id: 'formula',
      name: 'Formula',
      text: '$F^{(1)}L$',
      position: { x: 2, y: 3, z: 0 },
      style: {
        kind: 'labelStyle',
        color: '#000000',
        opacity: 1,
        fontSize: 10,
        anchor: 'center',
      },
      layer: 0,
    },
  )

  return diagram
}

function createTextLabelDiagram(text: string): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  diagram.labels.push({
    geometricKind: 'label',
    id: 'text-label',
    name: 'Text label',
    text,
    position: { x: 0, y: 0, z: 0 },
    style: {
      kind: 'labelStyle',
      color: '#000000',
      opacity: 1,
      fontSize: 10,
      anchor: 'center',
    },
    layer: 0,
  })

  return diagram
}

function createTwoDimensionalDiagramWithCurvePreset(): Diagram {
  const diagram = createTwoDimensionalDiagram()
  const curve = diagram.strata[0]

  if (curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  const created = createUserStylePresetFromStyle(
    diagram,
    'curve',
    'Inline curve',
    {
      ...curve.style,
      strokeColor: '#000000',
      lineWidth: 0.8,
    },
  )

  if (created === null) {
    throw new Error('Expected curve preset creation to succeed.')
  }

  return applyUserStylePresetToStratum(
    created.diagram,
    curve.id,
    created.preset.id,
  )
}

function createThreeDimensionalDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      id: 'page',
      name: 'Page',
      style: sheetStyle(),
      corners: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'line',
      name: 'Line',
      style: curveStyle({ strokeColor: '#FF00AA' }),
      points: [
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 1, z: 2 },
      ],
      styleSegments: [],
      layer: 0,
    },
    {
      codim: 3,
      geometricKind: 'point',
      id: 'junction',
      name: 'Junction',
      style: pointStyle({ color: '#00AA33', shape: 'star' }),
      position: { x: 1, y: 1, z: 2 },
      layer: 0,
    },
  )

  return diagram
}

function createSurfaceDepthSortDiagram(): Diagram {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 70,
    phiDeg: 110,
  }
  const viewDirection = cameraBasisFromTikz3dplotAngles(
    camera.thetaDeg,
    camera.phiDeg,
  ).forward
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.camera = camera
  diagram.view = { camera3d: camera }
  diagram.strata.push(
    surfaceDepthSortSheet('a-near', 'Near sheet', '#AA0000', viewDirection, -0.6),
    surfaceDepthSortSheet('z-far', 'Far sheet', '#00AA00', viewDirection, 0.6),
  )

  return diagram
}

function createCurveOcclusionDiagram(): Diagram {
  const camera = {
    ...createInitialCamera3D(),
    thetaDeg: 90,
    phiDeg: 0,
  }
  const diagram = createEmpty3DDiagramWithCamera(camera)

  diagram.strata.push(
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'quadSheet',
      id: 'occluding-sheet',
      name: 'Occluding Sheet',
      style: sheetStyle(),
      corners: [
        { x: -1, y: 0, z: -1 },
        { x: 1, y: 0, z: -1 },
        { x: 1, y: 0, z: 1 },
        { x: -1, y: 0, z: 1 },
      ],
      layer: 0,
    },
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'partly-hidden-curve',
      name: 'Partly Hidden Curve',
      style: curveStyle(),
      points: [
        { x: -2, y: -1, z: 0 },
        { x: -0.5, y: -1, z: 0 },
        { x: 0.5, y: -1, z: 0 },
        { x: 2, y: -1, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  )

  return diagram
}

function createSurfaceFaceCapCurveOcclusionDiagram(): Diagram {
  const diagram = createCurveOcclusionDiagram()
  const sheet = diagram.strata[0]

  if (sheet === undefined || sheet.geometricKind !== 'sheet') {
    throw new Error('Expected occluding sheet.')
  }

  diagram.strata.splice(1, 0, {
    ...sheet,
    id: 'second-occluding-sheet',
    name: 'Second Occluding Sheet',
  })

  return diagram
}

function createRuledSurfaceOcclusionDiagram(): Diagram {
  const diagram = createCurveOcclusionDiagram()
  const curve = diagram.strata[1]

  if (curve === undefined || curve.geometricKind !== 'curve') {
    throw new Error('Expected curve.')
  }

  diagram.strata = [
    {
      codim: 1,
      geometricKind: 'sheet',
      kind: 'curvedSheet',
      id: 'ruled-occluding-sheet',
      name: 'Ruled Occluding Sheet',
      style: sheetStyle(),
      primitive: {
        kind: 'ruledSurface',
        boundary0: lineBoundarySnapshot(
          'ruled-lower-boundary',
          { x: -1, y: 0, z: -1 },
          { x: 1, y: 0, z: -1 },
        ),
        boundary1: lineBoundarySnapshot(
          'ruled-upper-boundary',
          { x: -1, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
        ),
        sampling: { segments: 4 },
      },
      layer: 0,
    },
    {
      ...curve,
      id: 'ruled-hidden-curve',
      name: 'Ruled Hidden Curve',
    },
  ]

  return diagram
}

function createPointAndLabelVisibilityDiagram(): Diagram {
  const diagram = createCurveOcclusionDiagram()
  const sheet = diagram.strata[0]

  if (sheet === undefined) {
    throw new Error('Expected occluding sheet.')
  }

  diagram.strata = [
    sheet,
    {
      codim: 3,
      geometricKind: 'point',
      id: 'hidden-point',
      name: 'Hidden Point',
      style: pointStyle(),
      position: { x: 0, y: -1, z: 0 },
      layer: 0,
    },
  ]
  diagram.labels = [
    {
      geometricKind: 'label',
      id: 'hidden-label',
      name: 'Hidden Label',
      text: '$L$',
      position: { x: 0, y: -1, z: 0 },
      style: {
        kind: 'labelStyle',
        color: '#000000',
        opacity: 1,
        fontSize: 10,
        anchor: 'center',
      },
      layer: 0,
    },
  ]

  return diagram
}

function createStraightCurveOcclusionDiagram(
  curveKind: 'polyline' | 'linePath',
  styleOverride?: Partial<CurveStyle>,
): Diagram {
  const diagram = createCurveOcclusionDiagram()
  const sheet = diagram.strata[0]
  const start = { x: -2, y: -1, z: 0 }
  const end = { x: 2, y: -1, z: 0 }

  if (sheet === undefined) {
    throw new Error('Expected occluding sheet.')
  }

  diagram.strata = [
    sheet,
    curveKind === 'polyline'
      ? {
          codim: 2,
          geometricKind: 'curve',
          kind: 'polyline',
          id: 'straight-occlusion-polyline',
          name: 'Straight Occlusion Polyline',
          style: curveStyle(),
          points: [start, end],
          styleSegments: [],
          layer: 0,
        }
      : {
          codim: 2,
          geometricKind: 'curve',
          kind: 'concatenatedPath',
          id: 'straight-occlusion-path',
          name: 'Straight Occlusion Path',
          style: curveStyle(),
          segments: [
            {
              kind: 'line',
              start,
              end,
              ...(styleOverride === undefined ? {} : { styleOverride }),
            },
          ],
          styleSegments: [],
          layer: 0,
        },
  ]

  return diagram
}

function createBacktrackingCurveOcclusionDiagram(): Diagram {
  const diagram = createCurveOcclusionDiagram()
  const sheet = diagram.strata[0]

  if (sheet === undefined) {
    throw new Error('Expected occluding sheet.')
  }

  diagram.strata = [
    sheet,
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: 'backtracking-curve',
      name: 'Backtracking Curve',
      style: curveStyle(),
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      styleSegments: [],
      layer: 0,
    },
  ]

  return diagram
}

function createLongCurveOcclusionDiagram(
  visibility: 'visible' | 'hidden',
): Diagram {
  const diagram = createCurveOcclusionDiagram()
  const sheet = diagram.strata[0]
  const y = visibility === 'visible' ? 1 : -1
  const title = visibility === 'visible' ? 'Long Visible Curve' : 'Long Hidden Curve'

  if (sheet === undefined) {
    throw new Error('Expected occluding sheet.')
  }

  diagram.strata = [
    sheet,
    {
      codim: 2,
      geometricKind: 'curve',
      kind: 'polyline',
      id: `long-${visibility}-curve`,
      name: title,
      style: curveStyle(),
      points: longPolylinePoints(30, y),
      styleSegments: [],
      layer: 0,
    },
  ]

  return diagram
}

function longPolylinePoints(finalX: number, y: number): Vec3[] {
  return Array.from({ length: finalX + 1 }, (_, index) => ({
    x: index,
    y,
    z: 0,
  }))
}

function createEmpty3DDiagramWithCamera(camera: ReturnType<typeof createInitialCamera3D>): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.camera = camera
  diagram.view = { camera3d: camera }

  return diagram
}

function surfaceDepthSortSheet(
  id: string,
  name: string,
  color: '#AA0000' | '#00AA00',
  viewDirection: Vec3,
  depthOffset: number,
): PolygonSheetStratum {
  return {
    codim: 1,
    geometricKind: 'sheet',
    kind: 'polygonSheet',
    id,
    name,
    style: sheetStyle({
      fillColor: color,
      strokeColor: color,
      fillOpacity: 0.5,
      strokeOpacity: 1,
    }),
    vertices: square3D(0, 0, 1, 0).map((point) =>
      addVec3(point, scaleVec3(viewDirection, depthOffset)),
    ),
    layer: 0,
  }
}

function createWorkPlaneRelativeCartesianBezierDiagram({
  layer = 0,
}: {
  layer?: number
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'local-relative-cartesian',
    name: 'Local Relative Cartesian',
    style: curveStyle(),
    points: [
      { x: 12, y: 20, z: 33 },
      { x: 14, y: 20, z: 32 },
      { x: 13, y: 20, z: 41 },
      { x: 16, y: 20, z: 37 },
    ],
    bezierControls: {
      kind: 'workPlaneRelativeCartesian',
      frame: {
        origin: { x: 10, y: 20, z: 30 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 1 },
        normal: { x: 0, y: -1, z: 0 },
      },
      localStart: { a: 2, b: 3 },
      localEnd: { a: 6, b: 7 },
      firstControlOffset: { dx: 2, dy: -1 },
      secondControlOffset: { dx: -3, dy: 4 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer,
  })

  return diagram
}

function createWorkPlaneRelativePolarBezierDiagram({
  layer = 0,
}: {
  layer?: number
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'local-relative-polar',
    name: 'Local Relative Polar',
    style: curveStyle(),
    points: [
      { x: 12, y: 20, z: 33 },
      { x: 14, y: 20, z: 33 },
      { x: 16, y: 20, z: 41 },
      { x: 16, y: 20, z: 37 },
    ],
    bezierControls: {
      kind: 'workPlaneRelativePolar',
      frame: {
        origin: { x: 10, y: 20, z: 30 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 1 },
        normal: { x: 0, y: -1, z: 0 },
      },
      localStart: { a: 2, b: 3 },
      localEnd: { a: 6, b: 7 },
      firstControl: { angleDegrees: 0, radius: 2 },
      secondControl: { angleDegrees: 90, radius: 4 },
      secondOffsetReference: 'end',
    },
    styleSegments: [],
    layer,
  })

  return diagram
}

function createAbsoluteThreeDimensionalBezierDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 2,
    geometricKind: 'curve',
    kind: 'cubicBezier',
    id: 'absolute-arc',
    name: 'Absolute Arc',
    style: curveStyle(),
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 2, y: 1, z: 1 },
      { x: 3, y: 1, z: 0 },
    ],
    styleSegments: [],
    layer: 0,
  })

  return diagram
}

function createFilledRegionDiagram({
  boundaries = [squareBoundary2D('outer')],
  fillRule = 'nonzero',
  layer = 0,
  style = regionStyle(),
}: {
  boundaries?: ClosedPathBoundary[]
  fillRule?: 'nonzero' | 'evenOdd'
  layer?: number
  style?: RegionStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push({
    codim: 0,
    geometricKind: 'region',
    kind: 'filledRegion',
    id: 'filled-region',
    name: 'Filled Region',
    visible: true,
    style,
    boundaries,
    fillRule,
    layer,
  })

  return diagram
}

function createWorkPlaneFilledSheetDiagram({
  boundaries = [squareBoundary3D('outer', 2)],
  fillRule = 'nonzero',
  layer = 0,
  style = sheetStyle(),
}: {
  boundaries?: ClosedPathBoundary[]
  fillRule?: 'nonzero' | 'evenOdd'
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    codim: 1,
    geometricKind: 'sheet',
    kind: 'workPlaneFilledSheet',
    id: 'filled-sheet',
    name: 'Filled Sheet',
    style,
    planeFrame: xyPlaneFrameAtZ(2),
    boundaries,
    fillRule,
    layer,
  })

  return diagram
}

function createCurvedHemisphereSheetDiagram({
  layer = 0,
  style = sheetStyle(),
}: {
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    id: 'curved-hemisphere',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Curved Hemisphere',
    style,
    primitive: {
      kind: 'hemisphere',
      center: { x: 0, y: 0, z: 0 },
      radius: 1,
      frame: xyPlaneFrameAtZ(0),
      hemisphereSide: 'positive',
      sampling: { uSegments: 8, vSegments: 4 },
    },
    layer,
  })

  return diagram
}

function createCurvedSaddleSheetDiagram({
  layer = 0,
  style = sheetStyle(),
}: {
  layer?: number
  style?: SheetStyle
} = {}): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })
  diagram.strata.push({
    id: 'curved-saddle',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Curved Saddle',
    style,
    primitive: {
      kind: 'saddle',
      frame: xyPlaneFrameAtZ(0),
      width: 4,
      depth: 3,
      height: 1.5,
      sampling: { uSegments: 6, vSegments: 5 },
    },
    layer,
  })

  return diagram
}

function createCoonsPatchDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 3 })

  diagram.strata.push({
    id: 'coons-patch',
    codim: 1,
    geometricKind: 'sheet',
    kind: 'curvedSheet',
    name: 'Coons Patch',
    style: sheetStyle(),
    primitive: {
      kind: 'coonsPatch',
      bottom: lineBoundarySnapshot(
        'coons-bottom',
        { x: -1, y: -1, z: 0 },
        { x: 1, y: -1, z: 0.2 },
      ),
      right: lineBoundarySnapshot(
        'coons-right',
        { x: 1, y: -1, z: 0.2 },
        { x: 1, y: 1, z: -0.2 },
      ),
      top: lineBoundarySnapshot(
        'coons-top',
        { x: -1, y: 1, z: 0.35 },
        { x: 1, y: 1, z: -0.2 },
      ),
      left: lineBoundarySnapshot(
        'coons-left',
        { x: -1, y: -1, z: 0 },
        { x: -1, y: 1, z: 0.35 },
      ),
      sampling: { uSegments: 4, vSegments: 3 },
    },
    layer: 0,
  })

  return diagram
}

function squareBoundary2D(
  id: string,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z: 0 },
    { x: x + size, y, z: 0 },
    { x: x + size, y: y + size, z: 0 },
    { x, y: y + size, z: 0 },
  ])
}

function cubicBoundary2D(id: string): ClosedPathBoundary {
  return {
    id,
    segments: [
      {
        kind: 'cubicBezier',
        start: { x: 0, y: 0, z: 0 },
        control1: { x: 0.5, y: 1, z: 0 },
        control2: { x: 1.5, y: 1, z: 0 },
        end: { x: 2, y: 0, z: 0 },
      },
      {
        kind: 'line',
        start: { x: 2, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 },
      },
    ],
  }
}

function squareBoundary3D(
  id: string,
  z: number,
  x = 0,
  y = 0,
  size = 2,
): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x, y, z },
    { x: x + size, y, z },
    { x: x + size, y: y + size, z },
    { x, y: y + size, z },
  ])
}

function nonFiniteBoundary2D(id: string): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x: 0, y: 0, z: 0 },
    { x: Number.NaN, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
  ])
}

function nonFiniteBoundary3D(id: string): ClosedPathBoundary {
  return squareBoundaryFromPoints(id, [
    { x: 0, y: 0, z: 2 },
    { x: Number.POSITIVE_INFINITY, y: 0, z: 2 },
    { x: 1, y: 1, z: 2 },
    { x: 0, y: 1, z: 2 },
  ])
}

function lineBoundarySnapshot(
  id: string,
  start: Vec3,
  end: Vec3,
): ClosedPathBoundary {
  return {
    id,
    segments: [
      {
        kind: 'line',
        start,
        end,
      },
    ],
  }
}

function squareBoundaryFromPoints(
  id: string,
  points: [Vec3, Vec3, Vec3, Vec3],
): ClosedPathBoundary {
  return {
    id,
    segments: [
      { kind: 'line', start: points[0], end: points[1] },
      { kind: 'line', start: points[1], end: points[2] },
      { kind: 'line', start: points[2], end: points[3] },
      { kind: 'line', start: points[3], end: points[0] },
    ],
  }
}

function xyPlaneFrameAtZ(z: number): WorkPlaneFrameSnapshot {
  return {
    origin: { x: 0, y: 0, z },
    u: { x: 1, y: 0, z: 0 },
    v: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  }
}

function createPointShapeDiagram(
  shape: PointShape,
  overrides: Partial<PointStyle> = {},
): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })
  diagram.strata.push(
    {
      codim: 2,
      geometricKind: 'point',
      id: shape,
      name: shape,
      style: pointStyle({ shape, ...overrides }),
      position: { x: 0, y: 0, z: 0 },
      layer: 0,
    },
  )

  return diagram
}

function createEmptyDiagram({
  ambientDimension,
}: {
  ambientDimension: 2 | 3
}): Diagram {
  return {
    version: 1,
    ambientDimension,
    camera:
      ambientDimension === 2
        ? { mode: '2d', scale: 1, origin: { x: 0, y: 0 } }
        : createInitialCamera3D(),
    strata: [],
    labels: [],
  }
}

function square3D(x: number, y: number, size: number, z: number): Vec3[] {
  return [
    { x, y, z },
    { x: x + size, y, z },
    { x: x + size, y: y + size, z },
    { x, y: y + size, z },
  ]
}

function addVec3(first: Vec3, second: Vec3): Vec3 {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  }
}

function scaleVec3(point: Vec3, scalar: number): Vec3 {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar,
  }
}

function enabledVisibilityOptions(sortMode: 'layerThenDepth' | 'depthThenLayer') {
  return {
    enabled: true,
    surfaceDepthSort: true,
    curveOcclusion: true,
    pointVisibility: 'dimHidden',
    labelVisibility: 'alwaysForeground',
    sortMode,
    depthEpsilon: 1e-9,
  } as const
}

function regionStyle(overrides: Partial<RegionStyle> = {}): RegionStyle {
  return {
    kind: 'regionStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
    ...overrides,
  }
}

function sheetStyle(overrides: Partial<SheetStyle> = {}): SheetStyle {
  return {
    kind: 'sheetStyle',
    fillColor: '#4D9DE0',
    fillOpacity: 0.35,
    strokeColor: '#4D9DE0',
    strokeOpacity: 1,
    ...overrides,
  }
}

function curveStyle(overrides: Partial<CurveStyle> = {}): CurveStyle {
  return {
    kind: 'curveStyle',
    strokeColor: '#000000',
    strokeOpacity: 1,
    lineWidth: 1.2,
    lineStyle: 'solid',
    ...overrides,
  }
}

function pointStyle(overrides: Partial<PointStyle> = {}): PointStyle {
  return {
    kind: 'pointStyle',
    color: '#000000',
    opacity: 1,
    shape: 'circle',
    fill: 'filled',
    size: 3,
    ...overrides,
  }
}

function defaultLabelStyle() {
  return {
    kind: 'labelStyle' as const,
    color: '#000000' as const,
    opacity: 1,
    fontSize: 10,
    anchor: 'center' as const,
  }
}
