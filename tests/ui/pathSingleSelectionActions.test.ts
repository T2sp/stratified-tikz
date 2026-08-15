import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import {
  createConcatenatedPathStratum,
  createCurveStratum,
  createEmptyDiagram,
  createGridStratum,
  createPointStratum,
  createTemplatePathStratum,
} from '../../src/model/constructors.ts'
import {
  createNumericScalarInputValue,
  xyGridFrame,
} from '../../src/model/grids.ts'
import type {
  Diagram,
  GridParameterRange,
  GridRectangleClip,
  PathSegment,
} from '../../src/model/types.ts'
import { allLayersFilter, type LayerFilter } from '../../src/ui/layerFilter.ts'
import type { SelectedElement } from '../../src/ui/selection.ts'

test('expanded Inspector exposes duplicate and translate actions for one editable path', async () => {
  const cacheDir = mkdtempSync(
    join(tmpdir(), 'stratified-tikz-single-path-inspector-'),
  )
  const server = await createServer({
    root: process.cwd(),
    appType: 'custom',
    cacheDir,
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const loaded = (await server.ssrLoadModule(
      '/src/ui/inspector/EditableInspector.tsx',
    )) as {
      EditableInspector: React.ComponentType<Record<string, unknown>>
    }
    const diagram = createPathActionDiagram()

    for (const pathId of [
      'polyline',
      'cubic-bezier',
      'arc-only-path',
      'mixed-path',
    ]) {
      assertPathActions(
        renderInspector(loaded.EditableInspector, diagram, pathId),
        pathId,
      )
    }

    for (const unsupportedId of ['point', 'grid', 'template-path']) {
      assertNoPathActions(
        renderInspector(loaded.EditableInspector, diagram, unsupportedId),
        unsupportedId,
      )
    }

    assertNoPathActions(
      renderInspector(
        loaded.EditableInspector,
        withLayerState(diagram, { visible: false }),
        'polyline',
      ),
      'hidden path',
    )
    assertNoPathActions(
      renderInspector(
        loaded.EditableInspector,
        withLayerState(diagram, { locked: true }),
        'polyline',
      ),
      'locked path',
    )
    assertNoPathActions(
      renderInspector(
        loaded.EditableInspector,
        diagram,
        'polyline',
        { kind: 'layer', layer: 0 },
      ),
      'path outside the active layer filter',
    )
  } finally {
    await server.close()
    rmSync(cacheDir, { recursive: true, force: true })
  }
})

function renderInspector(
  Inspector: React.ComponentType<Record<string, unknown>>,
  diagram: Diagram,
  stratumId: string,
  layerFilter: LayerFilter = allLayersFilter,
): string {
  const noOp = () => undefined
  const selectedElement: SelectedElement = {
    kind: 'stratum',
    id: stratumId,
  }

  return renderToStaticMarkup(
    React.createElement(Inspector, {
      diagram,
      selectedElement,
      layerFilter,
      expanded: true,
      onExpandedChange: noOp,
      onDiagramChange: noOp,
      onBulkLayerChange: noOp,
      onBulkDelete: noOp,
      onBulkDuplicate: noOp,
      styleClipboardSummary: '',
      styleClipboardStatus: '',
      onCopyStyle: noOp,
      onPasteStyle: noOp,
      onBulkTranslate: noOp,
      onCoordinateTranslate: () => '',
      onBulkConcatenatePaths: () => '',
      onSplitPath: () => '',
      onStartPathSplitPick: () => '',
      onDuplicateCoonsPatch: () => ({
        ok: false,
        message: 'not invoked during SSR',
      }),
      onTranslateCoonsPatch: () => ({
        ok: false,
        message: 'not invoked during SSR',
      }),
    }),
  )
}

function assertPathActions(markup: string, context: string): void {
  assert.match(markup, /Translate selected path/, context)
  assert.match(markup, /aria-label="Duplicate selected path"/, context)
}

function assertNoPathActions(markup: string, context: string): void {
  assert.doesNotMatch(markup, /Translate selected path/, context)
  assert.doesNotMatch(
    markup,
    /aria-label="Duplicate selected path"/,
    context,
  )
}

function createPathActionDiagram(): Diagram {
  const diagram = createEmptyDiagram({ ambientDimension: 2 })

  return {
    ...diagram,
    strata: [
      createCurveStratum({
        ambientDimension: 2,
        id: 'polyline',
        kind: 'polyline',
        points: [point(0, 0), point(1, 0), point(1, 1)],
        layer: 1,
      }),
      createCurveStratum({
        ambientDimension: 2,
        id: 'cubic-bezier',
        kind: 'cubicBezier',
        points: [point(0, 0), point(0.5, 1), point(1.5, 1), point(2, 0)],
        layer: 1,
      }),
      createConcatenatedPathStratum({
        ambientDimension: 2,
        id: 'arc-only-path',
        segments: [arcSegment()],
        layer: 1,
      }),
      createConcatenatedPathStratum({
        ambientDimension: 2,
        id: 'mixed-path',
        segments: mixedSegments(),
        layer: 1,
      }),
      createPointStratum({
        ambientDimension: 2,
        id: 'point',
        position: point(0, 0),
        layer: 1,
      }),
      createGridStratum({
        ambientDimension: 2,
        id: 'grid',
        frame: xyGridFrame(),
        uRange: gridRange(-1, 1),
        vRange: gridRange(-1, 1),
        clip: gridClip(-1, 1, -1, 1),
        layer: 1,
      }),
      createTemplatePathStratum({
        ambientDimension: 2,
        id: 'template-path',
        template: {
          kind: 'circleTemplate',
          center: point(0, 0),
          radius: 1,
        },
        layer: 1,
      }),
    ],
  }
}

function mixedSegments(): PathSegment[] {
  return [
    {
      kind: 'line',
      start: point(0, 0),
      end: point(1, 0),
    },
    {
      kind: 'cubicBezier',
      start: point(1, 0),
      control1: point(1.25, 0.25),
      control2: point(1.75, 0.75),
      end: point(2, 1),
    },
    arcSegment(),
  ]
}

function arcSegment(): Extract<PathSegment, { kind: 'arc' }> {
  return {
    kind: 'arc',
    start: point(2, 1),
    end: point(3, 2),
    center: point(2, 2),
    radius: 1,
    startAngleDeg: -90,
    endAngleDeg: 0,
    direction: 'counterclockwise',
  }
}

function gridRange(min: number, max: number): GridParameterRange {
  return {
    min: createNumericScalarInputValue(min),
    max: createNumericScalarInputValue(max),
    step: createNumericScalarInputValue(1),
  }
}

function gridClip(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
): GridRectangleClip {
  return {
    kind: 'rectangle',
    uMin: createNumericScalarInputValue(uMin),
    uMax: createNumericScalarInputValue(uMax),
    vMin: createNumericScalarInputValue(vMin),
    vMax: createNumericScalarInputValue(vMax),
  }
}

function withLayerState(
  diagram: Diagram,
  state: { visible?: boolean; locked?: boolean },
): Diagram {
  return {
    ...diagram,
    layers: [
      {
        value: 1,
        name: 'Path layer',
        ...state,
      },
    ],
  }
}

function point(x: number, y: number) {
  return { x, y, z: 0 }
}
