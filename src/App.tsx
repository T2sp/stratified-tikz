import './App.css'
import {
  threeDimensionalExample,
  twoDimensionalExample,
} from './examples'
import { SvgDiagram } from './rendering'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>StratifiedTikZ</h1>
        <p>Static SVG previews for the Phase 4 example diagrams.</p>
      </header>

      <section className="preview-grid" aria-label="Example diagram previews">
        <article className="preview-panel">
          <div className="panel-heading">
            <h2>2D Example</h2>
            <span>curves and points</span>
          </div>
          <SvgDiagram diagram={twoDimensionalExample} />
        </article>

        <article className="preview-panel">
          <div className="panel-heading">
            <h2>3D Example</h2>
            <span>sheets, curves, and junctions</span>
          </div>
          <SvgDiagram diagram={threeDimensionalExample} />
        </article>
      </section>
    </main>
  )
}

export default App
