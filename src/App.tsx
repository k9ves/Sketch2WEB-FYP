import { useEffect, useState } from 'react'
import { websiteSamples } from './samples'
import { componentTypes } from './schema/types'
import InlineText from './editor/InlineText'
import PaletteItem from './editor/PaletteItem'
import { createComponentNode } from './editor/componentFactory'
import type { AddableComponentType } from './editor/componentFactory'
import FreeformCanvas from './editor/freeform/FreeformCanvas'
import FreeformDndProvider from './editor/freeform/FreeformDnd'
import PropertiesPanel from './editor/properties/PropertiesPanel'
import TreePanel from './editor/tree/TreePanel'
import ThemePicker from './editor/ThemePicker'
import StartScreen from './editor/StartScreen'
import TemplateGallery from './editor/TemplateGallery'
import type { WebsiteTemplate } from './templates'
import { findNode, isContainerType } from './store/tree'
import { useWebsiteStore } from './store/websiteStore'
import './App.css'

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT')
  )
}

type SidebarTab = 'components' | 'layers'

type Screen = 'start' | 'gallery' | 'editor'

type Device = 'desktop' | 'tablet' | 'mobile'

/** Canvas width per device; null fills the canvas panel. */
const devices: readonly { id: Device; label: string; width: number | null }[] =
  [
    { id: 'desktop', label: 'Desktop', width: null },
    { id: 'tablet', label: 'Tablet', width: 768 },
    { id: 'mobile', label: 'Mobile', width: 375 },
  ]

function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [sampleName, setSampleName] = useState('landing')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('components')
  const [isPreview, setIsPreview] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  // Free positions are stored for the desktop width only, so narrower
  // devices are view-only: editing there would move them for desktop too.
  const isCanvasReadOnly = isPreview || device !== 'desktop'
  const deviceWidth = devices.find((option) => option.id === device)?.width
  const [selectedPaletteType, setSelectedPaletteType] =
    useState<AddableComponentType | null>(null)
  const website = useWebsiteStore((state) => state.website)
  const setWebsite = useWebsiteStore((state) => state.setWebsite)
  const selectedId = useWebsiteStore((state) => state.selectedId)
  const selectNode = useWebsiteStore((state) => state.selectNode)
  const addNode = useWebsiteStore((state) => state.addNode)
  const removeNode = useWebsiteStore((state) => state.removeNode)
  const updateNode = useWebsiteStore((state) => state.updateNode)
  const undo = useWebsiteStore((state) => state.undo)
  const redo = useWebsiteStore((state) => state.redo)
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
    const id = selectedId

    function handleKeyDown(event: KeyboardEvent) {
      // The start screen hides the website; shortcuts must not change it.
      if (screen !== 'editor' || isEditableTarget(event.target)) return

      // Preview only listens for Esc (back to editing); no edit shortcuts.
      if (isPreview) {
        if (event.key === 'Escape') setIsPreview(false)
        return
      }

      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) redo()
          else undo()
          return
        }
        if (key === 'y') {
          event.preventDefault()
          redo()
          return
        }
      }

      if (event.key !== 'Delete' || id === null) return

      event.preventDefault()
      removeNode(id)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPreview, redo, removeNode, screen, selectedId, undo])

  function togglePreview() {
    // Leaving the selection on would show outlines and handles again
    // when going back to editing; start from a clean state both ways.
    selectNode(null)
    setIsPreview((current) => !current)
  }

  function changeDevice(next: Device) {
    // A selection has no outline on a read-only canvas; drop it.
    if (next !== 'desktop') selectNode(null)
    setDevice(next)
  }

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

  function openTemplate(template: WebsiteTemplate) {
    setWebsite(template.website)
    // The sample picker shows "Template" until a sample is chosen.
    setSampleName('')
    setScreen('editor')
  }

  if (screen === 'start') {
    return <StartScreen onChooseTemplate={() => setScreen('gallery')} />
  }

  if (screen === 'gallery') {
    return (
      <TemplateGallery
        onBack={() => setScreen('start')}
        onSelect={openTemplate}
      />
    )
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
            <button
              className={`toolbar-button${isPreview ? ' is-active' : ''}`}
              type="button"
              aria-pressed={isPreview}
              title={isPreview ? 'Back to editing (Esc)' : 'Preview website'}
              onClick={(event) => {
                event.stopPropagation()
                togglePreview()
              }}
            >
              {isPreview ? 'Edit' : 'Preview'}
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
              {sampleName === '' && (
                <option value="" disabled>
                  Template
                </option>
              )}
              <option value="landing">Landing page</option>
              <option value="portfolio">Portfolio</option>
              <option value="blog">Blog</option>
            </select>
          </label>
          <ThemePicker />
        </div>
      </header>
      <FreeformDndProvider>
        <div className={`editor-layout${isPreview ? ' is-preview' : ''}`}>
          {!isPreview && (
            <aside className="editor-panel components-panel">
              <div
                className="sidebar-tabs"
                role="tablist"
                aria-label="Left panel"
              >
                <button
                  className={`sidebar-tab${sidebarTab === 'components' ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'components'}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSidebarTab('components')
                  }}
                >
                  Components
                </button>
                <button
                  className={`sidebar-tab${sidebarTab === 'layers' ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'layers'}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSidebarTab('layers')
                  }}
                >
                  Layers
                </button>
              </div>
              {sidebarTab === 'layers' && <TreePanel />}
              {sidebarTab === 'components' && (
                <>
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
                          <PaletteItem
                            type={type}
                            selected={selectedPaletteType === type}
                            onSelect={setSelectedPaletteType}
                          />
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
                  <p className="component-palette-status">
                    Drag items onto the canvas. Hold Alt while dragging to place
                    a component freely.
                  </p>
                </>
              )}
            </aside>
          )}
          <section className="canvas-panel" aria-label="Canvas">
            <div className="canvas-header">
              <h2>{isPreview ? 'Preview' : 'Canvas'}</h2>
              <div
                className="device-switch"
                role="group"
                aria-label="Device width"
              >
                {devices.map((option) => (
                  <button
                    key={option.id}
                    className={`device-button${device === option.id ? ' is-active' : ''}`}
                    type="button"
                    aria-pressed={device === option.id}
                    title={
                      option.width === null
                        ? option.label
                        : `${option.label} (${option.width}px)`
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                      changeDevice(option.id)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {!isPreview && device !== 'desktop' && (
              <p className="canvas-note" role="status">
                Tablet and mobile views are read-only. Switch to Desktop to
                edit.
              </p>
            )}
            <section
              className="preview-frame"
              aria-label={`${websiteTitle} preview`}
              style={deviceWidth ? { maxWidth: `${deviceWidth}px` } : undefined}
            >
              <div className="preview-titlebar">
                <span className="preview-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {isCanvasReadOnly ? (
                    websiteTitle
                  ) : (
                    <InlineText
                      value={websiteTitle}
                      onSave={(title) =>
                        updateNode(website.id, { content: { title } })
                      }
                    />
                  )}
                </span>
              </div>
              <div className="preview-page" id="top">
                <FreeformCanvas preview={isCanvasReadOnly} />
              </div>
            </section>
          </section>
          {!isPreview && <PropertiesPanel />}
        </div>
      </FreeformDndProvider>
    </main>
  )
}

export default App
