import { useState } from 'react'
import Renderer from './renderer/Renderer'
import { websiteSamples } from './samples'
import { useWebsiteStore } from './store/websiteStore'
import './App.css'

function App() {
  const [sampleName, setSampleName] = useState('landing')
  const website = useWebsiteStore((state) => state.website)
  const setWebsite = useWebsiteStore((state) => state.setWebsite)

  function changeSample(name: string) {
    const sample = websiteSamples[name]
    if (!sample) throw new Error(`Unknown website sample: ${name}`)
    setSampleName(name)
    setWebsite(sample)
  }

  return (
    <main className="builder-shell">
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
      <section
        className="preview-frame"
        aria-label={`${website.title} preview`}
      >
        <div className="preview-titlebar">
          <span className="preview-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{website.title}</span>
        </div>
        <div className="preview-page" id="top">
          <Renderer node={website.root} />
        </div>
      </section>
    </main>
  )
}

export default App
