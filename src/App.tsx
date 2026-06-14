import { useMemo, useState } from 'react'
import './App.css'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from './examples'
import type { CoordinateInputMode, Diagram } from './model/types'
import { SvgDiagram } from './rendering'
import { generateTikz } from './tikz'

type ExampleId = '2d' | '3d'
type CopyStatus = 'idle' | 'copied' | 'failed'

type ExampleOption = {
  id: ExampleId
  name: string
  summary: string
  diagram: Diagram
}

const exampleOptions: ExampleOption[] = [
  {
    id: '2d',
    name: '2D example',
    summary: 'codim 1 curves, codim 2 points',
    diagram: twoDimensionalExample,
  },
  {
    id: '3d',
    name: '3D example',
    summary: 'codim 1 sheets, codim 2 curves, codim 3 points',
    diagram: threeDimensionalExample,
  },
]

const coordinateInputModes: CoordinateInputMode[] = ['cursor', 'direct']

function App() {
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId>('2d')
  const [coordinateInputMode, setCoordinateInputMode] =
    useState<CoordinateInputMode>('cursor')
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const selectedExample =
    exampleOptions.find((example) => example.id === selectedExampleId) ??
    exampleOptions[0]
  const tikzSource = useMemo(
    () => generateTikz(selectedExample.diagram),
    [selectedExample],
  )

  async function copyTikz(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable.')
      }

      await navigator.clipboard.writeText(tikzSource)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function selectExample(exampleId: ExampleId): void {
    setSelectedExampleId(exampleId)
    setCopyStatus('idle')
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>StratifiedTikZ</h1>
          <p>Basic preview and TikZ source workspace.</p>
        </div>
        <div className="status-strip" aria-label="Current diagram summary">
          <span>{selectedExample.name}</span>
          <span>{selectedExample.diagram.ambientDimension}D</span>
          <span>{coordinateInputMode}</span>
        </div>
      </header>

      <section className="toolbar" aria-label="Diagram controls">
        <div className="control-group">
          <span className="control-label">Example</span>
          <div className="segmented-control">
            {exampleOptions.map((example) => (
              <button
                key={example.id}
                type="button"
                className={
                  selectedExampleId === example.id ? 'is-selected' : undefined
                }
                aria-pressed={selectedExampleId === example.id}
                onClick={() => selectExample(example.id)}
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Input</span>
          <div className="segmented-control">
            {coordinateInputModes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={coordinateInputMode === mode ? 'is-selected' : undefined}
                aria-pressed={coordinateInputMode === mode}
                onClick={() => setCoordinateInputMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="workspace" aria-label="Preview and TikZ source">
        <article className="workspace-panel preview-panel">
          <div className="panel-heading">
            <div>
              <h2>SVG Preview</h2>
              <span>{selectedExample.summary}</span>
            </div>
          </div>
          <SvgDiagram diagram={selectedExample.diagram} fitToView />
        </article>

        <article className="workspace-panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Generated TikZ</h2>
              <span>read-only source</span>
            </div>
            <div className="copy-controls">
              <button type="button" className="copy-button" onClick={copyTikz}>
                Copy TikZ
              </button>
              <span className="copy-status" role="status">
                {copyStatus === 'copied' && 'Copied'}
                {copyStatus === 'failed' && 'Copy failed'}
              </span>
            </div>
          </div>
          <textarea
            className="tikz-source"
            value={tikzSource}
            readOnly
            spellCheck={false}
            aria-label="Generated TikZ source"
          />
        </article>
      </section>
    </main>
  )
}

export default App
