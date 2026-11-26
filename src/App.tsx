import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { websiteSamples } from './samples'
import { componentTypes } from './schema/types'
import type { WebsiteDocument } from './schema/types'
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
import { downloadProject, readProjectFile } from './editor/projectActions'
import { PROJECT_FILE_ACCEPT, projectFileName } from './store/projectFile'
import { findNode, isContainerType } from './store/tree'
import { codeOnlyPaths, useCustomCodeStore } from './store/customCodeStore'
import { useWebsiteStore } from './store/websiteStore'
import './App.css'
import './renderer/website.css'

// Monaco and Prettier are large; they load the first time Code is opened.
const CodePanel = lazy(() => import('./editor/code/CodePanel'))

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      // Keys typed in the code editor (Esc, Ctrl+Z, ...) belong to Monaco.
      target.closest('.monaco-editor') !== null ||
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
  const [projectMessage, setProjectMessage] = useState<string | null>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const [sampleName, setSampleName] = useState('landing')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('components')
  const [isPreview, setIsPreview] = useState(false)
  const [isCodeView, setIsCodeView] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
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
  const clearCustomCode = useCustomCodeStore((state) => state.clearAll)
  const hasCodeOnlyEdits = useCustomCodeStore(
    (state) => codeOnlyPaths(state.files).length > 0,
  )

  // Code-only edits live in memory; warn before a reload or close loses them.
  useEffect(() => {
    if (!hasCodeOnlyEdits) return
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasCodeOnlyEdits])
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

      // Preview and code view only listen for Esc (back to editing); no
      // edit shortcuts, since the canvas is not visible to undo on.
      if (isPreview || isCodeView) {
        if (event.key === 'Escape') {
          setIsPreview(false)
          setIsCodeView(false)
        }
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
  }, [isCodeView, isPreview, redo, removeNode, screen, selectedId, undo])

  function togglePreview() {
    // Leaving the selection on would show outlines and handles again
    // when going back to editing; start from a clean state both ways.
    selectNode(null)
    setIsCodeView(false)
    setIsPreview((current) => !current)
  }

  function toggleCodeView() {
    selectNode(null)
    setIsPreview(false)
    setIsCodeView((current) => !current)
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

  /**
   * Code edits belong to the current website. Code-only edits are never
   * dropped without asking; returns false when the user keeps them.
   */
  function confirmDiscardCode(): boolean {
    const paths = codeOnlyPaths(useCustomCodeStore.getState().files)
    if (paths.length === 0) return true
    const names = paths.map((path) => path.slice(path.lastIndexOf('/') + 1))
    return window.confirm(
      `You have code-only changes in ${names.join(', ')}. Opening another website discards them. Continue?`,
    )
  }

  function changeSample(name: string) {
    const sample = websiteSamples[name]
    if (!sample) throw new Error(`Unknown website sample: ${name}`)
    if (!confirmDiscardCode()) return
    setSampleName(name)
    setWebsite(sample)
    clearCustomCode()
  }

  function showInEditor(next: WebsiteDocument) {
    if (!confirmDiscardCode()) return
    setWebsite(next)
    clearCustomCode()
    // The sample picker shows "Template" until a sample is chosen.
    setSampleName('')
    setIsPreview(false)
    setIsCodeView(false)
    setDevice('desktop')
    setScreen('editor')
  }

  function chooseProjectFile() {
    setProjectMessage(null)
    projectInputRef.current?.click()
  }

  async function openProjectFile(file: File) {
    const result = await readProjectFile(file)
    if (!result.ok) {
      setProjectMessage(result.message)
      return
    }
    if (
      screen === 'editor' &&
      !window.confirm(
        'Open this project? It replaces the website you are editing now. Save that one first if you want to keep it.',
      )
    ) {
      return
    }
    setProjectMessage(`Opened ${file.name}.`)
    showInEditor(result.website)
  }

  function saveProject() {
    downloadProject(website)
    setProjectMessage(`Saved as ${projectFileName(website)}.`)
  }

  async function exportZip() {
    setIsExporting(true)
    setProjectMessage(null)
    try {
      // Prettier and the exporter load only when exporting.
      const { exportProjectZip } = await import('./editor/exportProject')
      const zip = await exportProjectZip(
        website,
        useCustomCodeStore.getState().files,
      )
      setProjectMessage(
        zip.missingAssets.length === 0
          ? `Exported ${zip.fileName}. Unzip it, then run npm install and npm run dev.`
          : `Exported ${zip.fileName}, but these images could not be added: ${zip.missingAssets.join(', ')}.`,
      )
    } catch (error) {
      setProjectMessage(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsExporting(false)
    }
  }

  // One hidden file picker, used by the start screen and the editor.
  const projectInput = (
    <input
      ref={projectInputRef}
      type="file"
      accept={PROJECT_FILE_ACCEPT}
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        // Reset, so choosing the same file again still triggers a change.
        event.target.value = ''
        if (file) void openProjectFile(file)
      }}
    />
  )

  if (screen === 'start') {
    return (
      <>
        {projectInput}
        <StartScreen
          onChooseTemplate={() => setScreen('gallery')}
          onOpenProject={chooseProjectFile}
          message={projectMessage}
        />
      </>
    )
  }

  if (screen === 'gallery') {
    return (
      <TemplateGallery
        onBack={() => setScreen('start')}
        onSelect={(template) => showInEditor(template.website)}
      />
    )
  }

  return (
    <main className="builder-shell" onClick={() => selectNode(null)}>
      {projectInput}
      <header className="builder-toolbar">
        <div>
          <p className="eyebrow">Sketch2Web</p>
          <h1>Website builder</h1>
        </div>
        <div className="toolbar-controls">
          <div className="toolbar-actions" aria-label="Editor actions">
            <button
              className="toolbar-button"
              type="button"
              title="Open a saved project (.json)"
              onClick={(event) => {
                event.stopPropagation()
                chooseProjectFile()
              }}
            >
              Open
            </button>
            <button
              className="toolbar-button"
              type="button"
              title="Download this website as a project file (.json)"
              onClick={(event) => {
                event.stopPropagation()
                saveProject()
              }}
            >
              Save
            </button>
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
            <button
              className={`toolbar-button${isCodeView ? ' is-active' : ''}`}
              type="button"
              aria-pressed={isCodeView}
              title={
                isCodeView ? 'Back to editing (Esc)' : 'Show generated code'
              }
              onClick={(event) => {
                event.stopPropagation()
                toggleCodeView()
              }}
            >
              {isCodeView ? 'Edit' : 'Code'}
            </button>
            <button
              className="toolbar-button"
              type="button"
              disabled={isExporting}
              title="Download the website as a runnable React project (.zip)"
              onClick={(event) => {
                event.stopPropagation()
                void exportZip()
              }}
            >
              {isExporting ? 'Exporting…' : 'Export'}
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
      {projectMessage !== null && (
        <p className="project-message" role="status">
          {projectMessage}
        </p>
      )}
      <FreeformDndProvider>
        <div
          className={`editor-layout${isPreview ? ' is-preview' : ''}${isCodeView ? ' is-code' : ''}`}
        >
          {isCodeView && (
            <Suspense
              fallback={
                <p className="code-status" role="status">
                  Loading code editor…
                </p>
              }
            >
              <CodePanel website={website} />
            </Suspense>
          )}
          {!isPreview && !isCodeView && (
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
          {/* Unmounted in code view: the freeform canvas measures its DOM. */}
          {!isCodeView && (
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
                style={
                  deviceWidth ? { maxWidth: `${deviceWidth}px` } : undefined
                }
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
          )}
          {!isPreview && !isCodeView && <PropertiesPanel />}
        </div>
      </FreeformDndProvider>
    </main>
  )
}

export default App
