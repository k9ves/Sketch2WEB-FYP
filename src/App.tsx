import { useState } from 'react'
import Renderer from './renderer/Renderer'
import { websiteSamples } from './samples'
import { useWebsiteStore } from './store/websiteStore'
import './App.css'

function App() {
  const [sampleName, setSampleName] = useState('landing')
  const website = useWebsiteStore((state) => state.website)
  const setWebsite = useWebsiteStore((state) => state.setWebsite)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const websiteTitle = website.content.title || 'Untitled website'

  function changeSample(name: string) {
    const sample = websiteSamples[name]
    if (!sample) throw new Error(`Unknown website sample: ${name}`)
    setSampleName(name)
    setWebsite(sample)
  }

  return (
    <main className="builder-shell" onClick={() => selectNode(null)}>
      <header className="builder-toolbar">
        <div>
          <p className="eyebrow">Sketch2Web · Renderer</p>
          <h1>Website preview</h1>
        </div>
        <label className="sample-picker">
          <span>Sample</span>
          <select
            value={sampleName}
            onChange={(event) => changeSample(event.target.value)}
          >
            <option value="landing">Landing page</option>
            <option value="portfolio">Portfolio</option>
            <option value="blog">Blog</option>
          </select>
        </label>
      </header>
      <div className="editor-layout">
        <aside className="editor-panel components-panel">
          <h2>Components</h2>
          <p>Component tree will appear here.</p>
        </aside>
        <section className="canvas-panel" aria-label="Canvas">
          <h2>Canvas</h2>
          <section
            className="preview-frame"
            aria-label={`${websiteTitle} preview`}
          >
            <div className="preview-titlebar">
              <span className="preview-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{websiteTitle}</span>
            </div>
            <div className="preview-page" id="top">
              <Renderer node={website} />
            </div>
          </section>
        </section>
        <aside className="editor-panel properties-panel">
          <h2>Properties</h2>
          <p>Select a component on the canvas to view its properties.</p>
        </aside>
      </div>
    </main>
  )
}

export default App
