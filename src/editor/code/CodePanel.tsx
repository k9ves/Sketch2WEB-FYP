import './monacoSetup'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { formatProjectFiles } from '../../codegen/formatCode'
import { generateProjectFiles } from '../../codegen/generateProject'
import type { GeneratedFile } from '../../codegen/generateProject'
import type { WebsiteDocument } from '../../schema/types'
import {
  DEFAULT_OPEN_PATH,
  useCustomCodeStore,
} from '../../store/customCodeStore'

type CodeEditor = Parameters<OnMount>[0]

type ViewState = ReturnType<CodeEditor['saveViewState']>

/**
 * Cursor, selection and scroll position per file URI, kept while the page
 * is open, so reopening Code or a tab continues exactly where work stopped.
 */
const viewStates = new Map<string, ViewState>()

function fileUri(path: string): string {
  return `file:///${path}`
}

type CodeResult =
  | { website: WebsiteDocument; files: GeneratedFile[] }
  | { website: WebsiteDocument; error: string }

/** Follows <html data-theme> (set by the theme picker, see src/theme.ts). */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => observer.disconnect()
}

function useIsDarkTheme(): boolean {
  return useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.dataset.theme === 'dark',
  )
}

/** Generated, formatted code for the website; regenerated when it changes. */
function useGeneratedCode(website: WebsiteDocument): CodeResult | null {
  const [result, setResult] = useState<CodeResult | null>(null)

  useEffect(() => {
    let cancelled = false
    formatProjectFiles(generateProjectFiles(website))
      .then((files) => {
        if (!cancelled) setResult({ website, files })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            website,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [website])

  // A result for an older version of the website is still being replaced.
  return result?.website === website ? result : null
}

/** Website files first (App, then components), project setup files last. */
function tabOrder(path: string): number {
  if (path === DEFAULT_OPEN_PATH) return 0
  if (path.startsWith('src/components/')) return 1
  return 2
}

function sortForTabs(files: readonly GeneratedFile[]): GeneratedFile[] {
  return [...files].sort((a, b) => tabOrder(a.path) - tabOrder(b.path))
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

const languageByExtension: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  json: 'json',
  html: 'html',
}

function fileLanguage(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1)
  return languageByExtension[extension] ?? 'plaintext'
}

/**
 * The code generated from the current website. Files can be edited; edits
 * are kept as a separate custom copy (customCodeStore) and never change
 * the canvas.
 */
function CodePanel({ website }: { website: WebsiteDocument }) {
  const result = useGeneratedCode(website)
  const isDark = useIsDarkTheme()
  const customFiles = useCustomCodeStore((state) => state.files)
  const editFile = useCustomCodeStore((state) => state.editFile)
  const resetFile = useCustomCodeStore((state) => state.resetFile)
  const selectedPath = useCustomCodeStore((state) => state.openPath)
  const setSelectedPath = useCustomCodeStore((state) => state.setOpenPath)
  const files = result && 'files' in result ? sortForTabs(result.files) : []
  // A component file can disappear (e.g. its section was renamed); fall
  // back to App.tsx instead of showing nothing.
  const file =
    files.find((entry) => entry.path === selectedPath) ??
    files.find((entry) => entry.path === DEFAULT_OPEN_PATH)
  const custom = file ? customFiles[file.path] : undefined
  const canvasChanged =
    custom !== undefined && custom.baseContent !== file?.content
  const editorRef = useRef<CodeEditor | null>(null)
  // URI whose view state may be saved. While Monaco switches to another
  // file, events of the new model must not overwrite its saved position.
  const trackedUriRef = useRef<string | null>(null)
  const filePath = file?.path

  function restoreViewState(editor: CodeEditor, path: string) {
    const uri = fileUri(path)
    const saved = viewStates.get(uri)
    if (saved) editor.restoreViewState(saved)
    trackedUriRef.current = uri
    editor.focus()
  }

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    const save = () => {
      const uri = editor.getModel()?.uri.toString()
      if (uri && uri === trackedUriRef.current) {
        viewStates.set(uri, editor.saveViewState())
      }
    }
    editor.onDidChangeCursorSelection(save)
    editor.onDidScrollChange(save)
    if (filePath) restoreViewState(editor, filePath)
  }

  // Another tab: Monaco has already switched the model (child effects run
  // first), so the new file's saved position can be restored.
  useEffect(() => {
    const editor = editorRef.current
    if (editor && filePath) restoreViewState(editor, filePath)
  }, [filePath])

  return (
    <section
      className="code-panel"
      aria-label="Generated code"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="code-header">
        <h2>Code</h2>
        {file && <span className="code-file-name">{file.path}</span>}
        <span className="code-note">
          Edits stay in the code only; the canvas does not change. Esc goes
          back.
        </span>
      </div>
      {files.length > 0 && (
        <div className="code-tabs" role="tablist" aria-label="Files">
          {files.map((entry) => {
            const edited = entry.path in customFiles
            return (
              <button
                key={entry.path}
                className={`code-tab${entry.path === file?.path ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={entry.path === file?.path}
                title={edited ? `${entry.path} (edited)` : entry.path}
                onClick={() => setSelectedPath(entry.path)}
              >
                {fileName(entry.path)}
                {edited && (
                  <span className="code-tab-edited" aria-label="edited">
                    ●
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
      {file && custom && (
        <div
          className={`code-custom-bar${canvasChanged ? ' is-warning' : ''}`}
          role="status"
        >
          <span>
            {canvasChanged
              ? 'The canvas changed since you edited this file. Your edited version is kept and used for export.'
              : 'Edited by hand. This version is used for export instead of the generated code.'}
          </span>
          <button
            className="toolbar-button"
            type="button"
            onClick={() => resetFile(file.path)}
          >
            Reset to generated
          </button>
        </div>
      )}
      {result === null && (
        <p className="code-status" role="status">
          Generating code…
        </p>
      )}
      {result !== null && 'error' in result && (
        <p className="code-status is-error" role="alert">
          Could not generate code: {result.error}
        </p>
      )}
      {file && (
        <div className="code-editor">
          <Editor
            // One model per file URI: each tab keeps its own scroll
            // position, and a .tsx URI makes Monaco parse the code as TSX.
            path={fileUri(file.path)}
            language={fileLanguage(file.path)}
            value={custom?.content ?? file.content}
            onChange={(value) => editFile(file.path, value ?? '', file.content)}
            onMount={handleMount}
            theme={isDark ? 'vs-dark' : 'light'}
            loading={<p className="code-status">Loading code editor…</p>}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      )}
    </section>
  )
}

export default CodePanel
