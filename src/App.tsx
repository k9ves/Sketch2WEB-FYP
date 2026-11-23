import { useEffect, useState } from 'react'
import Renderer from './renderer/Renderer'
import { websiteSamples } from './samples'
import { componentTypes } from './schema/types'
import type { ComponentNode, ComponentType } from './schema/types'
import InlineText from './editor/InlineText'
import { findNode, isContainerType } from './store/tree'
import { useWebsiteStore } from './store/websiteStore'
import './App.css'

type AddableComponentType = Exclude<ComponentType, 'website'>

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT')
  )
}

const componentDefaults: Record<
  AddableComponentType,
  Pick<ComponentNode, 'content' | 'layout' | 'style' | 'children'>
> = {
  navbar: {
    content: { brand: 'New website', links: 'Home, About, Contact' },
    layout: {},
    style: {},
    children: [],
  },
  hero: {
    content: { title: 'New hero', description: 'Add a description' },
    layout: {},
    style: {},
    children: [],
  },
  section: {
    content: { title: 'New section', text: '' },
    layout: {},
    style: {},
    children: [],
  },
  columns: {
    content: {},
    layout: { columns: '2', gap: '4' },
    style: {},
    children: [],
  },
  heading: {
    content: { text: 'New heading' },
    layout: {},
    style: {},
    children: [],
  },
  text: {
    content: { text: 'New text' },
    layout: {},
    style: {},
    children: [],
  },
  button: {
    content: { text: 'New button', href: '#top' },
    layout: {},
    style: {},
    children: [],
  },
  image: {
    content: { src: '/favicon.svg', alt: 'Placeholder image' },
    layout: {},
    style: {},
    children: [],
  },
  card: {
    content: { title: 'New card', text: 'Add a description' },
    layout: {},
    style: {},
    children: [],
  },
  footer: {
    content: { text: 'New footer' },
    layout: {},
    style: {},
    children: [],
  },
}

function createComponentNode(type: AddableComponentType): ComponentNode {
  const defaults = componentDefaults[type]
  return {
    id: crypto.randomUUID(),
    type,
    content: { ...defaults.content },
    layout: { ...defaults.layout },
    style: { ...defaults.style },
    children: [...defaults.children],
  }
}

function App() {
  const [sampleName, setSampleName] = useState('landing')
  const [selectedPaletteType, setSelectedPaletteType] =
    useState<AddableComponentType | null>(null)
  const website = useWebsiteStore((state) => state.website)
  const setWebsite = useWebsiteStore((state) => state.setWebsite)
  const selectedId = useWebsiteStore((state) => state.selectedId)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const addNode = useWebsiteStore((state) => state.addNode)
  const duplicateNode = useWebsiteStore((state) => state.duplicateNode)
  const removeNode = useWebsiteStore((state) => state.removeNode)
  const updateNode = useWebsiteStore((state) => state.updateNode)
  const websiteTitle = website.content.title || 'Untitled website'
  const selectedCanvasNode = selectedId
    ? findNode(website, selectedId)
    : undefined
  const targetContainerId =
    selectedId === null
      ? website.id
      : selectedCanvasNode && isContainerType(selectedCanvasNode.type)
        ? selectedCanvasNode.id
        : null
  const targetDescription =
    targetContainerId === null
      ? 'Select a container on the canvas to add components.'
      : selectedId === null
        ? 'No container selected. New components go into the website root.'
        : 'New components go into the selected container.'

  useEffect(() => {
    if (selectedId === null) return

    const id = selectedId

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' || isEditableTarget(event.target)) return

      event.preventDefault()
      removeNode(id)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [removeNode, selectedId])

  function addSelectedComponent() {
    if (selectedPaletteType === null) {
      throw new Error('Select a component type before adding.')
    }
    if (targetContainerId === null) {
      throw new Error('Select a container before adding a component.')
    }

    addNode(targetContainerId, createComponentNode(selectedPaletteType))
  }

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
          <p className="eyebrow">Sketch2Web</p>
          <h1>Website builder</h1>
        </div>
        <div className="toolbar-controls">
          <div className="toolbar-actions" aria-label="Editor actions">
            <button className="toolbar-button" type="button">
              Preview
            </button>
            <button className="toolbar-button" type="button">
              Code
            </button>
            <button className="toolbar-button" type="button">
              Export
            </button>
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
        </div>
      </header>
      <div className="editor-layout">
        <aside className="editor-panel components-panel">
          <h2>Components</h2>
          <ul
            className="component-palette"
            aria-label="Available component types"
          >
            {componentTypes.map((type) => (
              <li
                className={
                  type === 'website'
                    ? 'component-palette-item is-root-type'
                    : `component-palette-item${selectedPaletteType === type ? ' is-selected' : ''}`
                }
                key={type}
              >
                {type === 'website' && (
                  <>
                    <span>Website</span>
                    <span className="component-palette-note">Root</span>
                  </>
                )}
                {type !== 'website' && (
                  <button
                    className="component-palette-button"
                    type="button"
                    aria-pressed={selectedPaletteType === type}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedPaletteType(type)
                    }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            className="toolbar-button palette-add-button"
            type="button"
            disabled={
              selectedPaletteType === null || targetContainerId === null
            }
            onClick={(event) => {
              event.stopPropagation()
              addSelectedComponent()
            }}
          >
            Add
          </button>
          <p className="component-palette-status" aria-live="polite">
            {targetDescription}
          </p>
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
              <span>
                <InlineText
                  value={websiteTitle}
                  onSave={(title) =>
                    updateNode(website.id, { content: { title } })
                  }
                />
              </span>
            </div>
            <div className="preview-page" id="top">
              <Renderer node={website} />
            </div>
          </section>
        </section>
        <aside className="editor-panel properties-panel">
          <h2>Properties</h2>
          <p>Select a component on the canvas to view its properties.</p>
          <button
            className="toolbar-button duplicate-selected-button"
            type="button"
            disabled={selectedId === null}
            onClick={(event) => {
              event.stopPropagation()
              if (selectedId !== null) duplicateNode(selectedId)
            }}
          >
            Duplicate selected
          </button>
          <button
            className="toolbar-button delete-selected-button"
            type="button"
            disabled={selectedId === null}
            onClick={(event) => {
              event.stopPropagation()
              if (selectedId !== null) removeNode(selectedId)
            }}
          >
            Delete selected
          </button>
        </aside>
      </div>
    </main>
  )
}

export default App
