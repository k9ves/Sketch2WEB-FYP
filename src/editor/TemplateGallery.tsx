import { useLayoutEffect, useRef, useState } from 'react'
import Renderer from '../renderer/Renderer'
import { EditableContext, NodeFrameContext } from '../renderer/nodeFrame'
import type { WebsiteDocument } from '../schema/types'
import { websiteTemplates } from '../templates'
import type { WebsiteTemplate } from '../templates'
import ThemePicker from './ThemePicker'
import { StaticNodeFrame } from './freeform/CanvasNodeFrame'

/** Width the thumbnail page is laid out at (a desktop window). */
const THUMB_PAGE_WIDTH = 1280

interface TemplateGalleryProps {
  onBack: () => void
  onSelect: (template: WebsiteTemplate) => void
}

/**
 * The template rendered at desktop width and scaled down to fit, so the
 * thumbnail always matches the template. Not interactive.
 */
function TemplateThumbnail({ website }: { website: WebsiteDocument }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => setScale(frame.clientWidth / THUMB_PAGE_WIDTH)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={frameRef} className="template-thumb" aria-hidden="true" inert>
      <div
        className="template-thumb-page"
        style={{ width: THUMB_PAGE_WIDTH, transform: `scale(${scale})` }}
      >
        {/* Same wrappers (and so the same layout) as the canvas, without
            drag and drop. */}
        <NodeFrameContext.Provider value={StaticNodeFrame}>
          <EditableContext.Provider value={false}>
            <Renderer node={website} />
          </EditableContext.Provider>
        </NodeFrameContext.Provider>
      </div>
    </div>
  )
}

/** Template gallery (T46): pick a template to open it in the editor. */
function TemplateGallery({ onBack, onSelect }: TemplateGalleryProps) {
  return (
    <main className="start-screen gallery-screen">
      <header className="start-header">
        <button className="toolbar-button" type="button" onClick={onBack}>
          ← Back
        </button>
        <ThemePicker />
      </header>
      <section className="start-intro gallery-intro">
        <h1>Choose a template</h1>
        <p>Every part of a template can be edited after you open it.</p>
      </section>
      <ul className="gallery-grid" aria-label="Templates">
        {websiteTemplates.map((template) => (
          <li key={template.id}>
            <button
              className="gallery-card"
              type="button"
              onClick={() => onSelect(template)}
            >
              <TemplateThumbnail website={template.website} />
              <span className="gallery-card-body">
                <span className="gallery-card-title">{template.name}</span>
                <span className="gallery-card-text">
                  {template.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default TemplateGallery
