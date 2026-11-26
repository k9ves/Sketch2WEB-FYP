import './monacoSetup'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { formatProjectFiles } from '../../codegen/formatCode'
import { generateProjectFiles } from '../../codegen/generateProject'
import type { GeneratedFile } from '../../codegen/generateProject'
import type { WebsiteDocument } from '../../schema/types'
import {
  DEFAULT_OPEN_PATH,
  useCustomCodeStore,
  type CustomFile,
} from '../../store/customCodeStore'
import {
  checkFile,
  COMPONENT_PREFIX,
  dropOutdatedSyncedCopies,
} from './codeSync'

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

/** A renamed file keeps its cursor and scroll position. */
function moveViewState(from: string, to: string): void {
  const saved = viewStates.get(fileUri(from))
  if (saved) viewStates.set(fileUri(to), saved)
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

/**
 * Generated, formatted code for the website. While a newer version is being
 * generated the previous files stay, so the editor never disappears while
 * typing; `fresh` says whether they match the current website.
 */
function useGeneratedCode(website: WebsiteDocument): {
  result: CodeResult | null
  fresh: boolean
} {
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

  return { result, fresh: result?.website === website }
}

/** Pause after typing before an edit is checked and synced. */
const SYNC_DELAY_MS = 800

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

interface TabFile {
  path: string
  /** Generated code, or null for a code-only file no longer generated. */
  generated: string | null
}

function isCanvasFile(path: string): boolean {
  return path === DEFAULT_OPEN_PATH || path.startsWith(COMPONENT_PREFIX)
}

function CustomFileBar({
  file,
  custom,
  canvasChanged,
  onShowLine,
}: {
  file: TabFile
  custom: CustomFile
  canvasChanged: boolean
  onShowLine: (line: number) => void
}) {
  const keepCodeOnly = useCustomCodeStore((state) => state.keepCodeOnly)
  const undoChange = useCustomCodeStore((state) => state.undoChange)
  const resetFile = useCustomCodeStore((state) => state.resetFile)
  const retrySync = useCustomCodeStore((state) => state.retrySync)
  const issue = custom.issue
  const lineButton = issue && (
    <button
      className="code-line-link"
      type="button"
      onClick={() => onShowLine(issue.line)}
    >
      line {issue.line}
    </button>
  )

  if (file.generated === null) {
    return (
      <div className="code-custom-bar is-code-only" role="status">
        <span>
          This file is no longer generated (its section was renamed or removed).
          Your code is kept and exported as an extra file.
        </span>
        <button
          className="toolbar-button"
          type="button"
          onClick={() => resetFile(file.path)}
        >
          Delete file
        </button>
      </div>
    )
  }

  if (custom.status === 'synced') {
    return (
      <div className="code-custom-bar is-synced" role="status">
        <span>✓ Synced to canvas.</span>
      </div>
    )
  }

  if (custom.status === 'codeOnly') {
    return (
      <div
        className={`code-custom-bar ${canvasChanged ? 'is-warning' : 'is-code-only'}`}
        role="status"
      >
        <span>
          Code only: kept as you wrote it and used for export; the canvas does
          not follow this file.
          {canvasChanged && ' The canvas changed since you edited it.'}
        </span>
        <span className="code-bar-actions">
          {isCanvasFile(file.path) && (
            <button
              className="toolbar-button"
              type="button"
              onClick={() => {
                retrySync(file.path)
                void checkFile(file.path, moveViewState)
              }}
            >
              Sync again
            </button>
          )}
          <button
            className="toolbar-button"
            type="button"
            onClick={() => resetFile(file.path)}
          >
            Reset to generated
          </button>
        </span>
      </div>
    )
  }

  if (issue?.kind === 'unsupported') {
    return (
      <div className="code-custom-bar is-warning" role="alert">
        <span>
          ⚠ <strong>Not supported yet:</strong> {issue.message} ({lineButton})
          The canvas can’t show this.
        </span>
        <span className="code-bar-actions">
          <button
            className="toolbar-button"
            type="button"
            onClick={() => undoChange(file.path)}
          >
            Undo my change
          </button>
          <button
            className="toolbar-button"
            type="button"
            onClick={() => keepCodeOnly(file.path)}
          >
            Keep as code only
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="code-custom-bar" role="status">
      <span>
        {issue?.kind === 'syntax' ? (
          <>
            Waiting for valid code: {issue.message} ({lineButton})
          </>
        ) : (
          'Changes go to the canvas when you stop typing…'
        )}
      </span>
    </div>
  )
}

/**
 * The code generated from the current website. Supported edits (text,
 * styles, links, images, heading level) sync to the canvas after a pause;
 * other edits are kept as code (customCodeStore) and never lost silently.
 */
function CodePanel({ website }: { website: WebsiteDocument }) {
  const { result, fresh } = useGeneratedCode(website)
  const isDark = useIsDarkTheme()
  const customFiles = useCustomCodeStore((state) => state.files)
  const editFile = useCustomCodeStore((state) => state.editFile)
  const selectedPath = useCustomCodeStore((state) => state.openPath)
  const setSelectedPath = useCustomCodeStore((state) => state.setOpenPath)
  const generatedFiles = useMemo(
    () => (result && 'files' in result ? sortForTabs(result.files) : []),
    [result],
  )
  const files: TabFile[] = [
    ...generatedFiles.map((entry) => ({
      path: entry.path,
      generated: entry.content,
    })),
    // Code-only files of renamed or removed sections stay visible.
    ...Object.entries(customFiles)
      .filter(
        ([path, custom]) =>
          custom.status !== 'synced' &&
          generatedFiles.length > 0 &&
          !generatedFiles.some((entry) => entry.path === path),
      )
      .map(([path]) => ({ path, generated: null })),
  ]
  const file =
    files.find((entry) => entry.path === selectedPath) ??
    files.find((entry) => entry.path === DEFAULT_OPEN_PATH)
  const custom = file ? customFiles[file.path] : undefined
  const canvasChanged =
    custom !== undefined &&
    file?.generated !== null &&
    custom.status !== 'synced' &&
    custom.baseContent !== file?.generated
  const editorRef = useRef<CodeEditor | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)
  // URI whose view state may be saved. While Monaco switches to another
  // file, events of the new model must not overwrite its saved position.
  const trackedUriRef = useRef<string | null>(null)
  const timerRef = useRef<{ id: number; path: string } | null>(null)
  const filePath = file?.path
  const issue = custom?.issue ?? null

  function restoreViewState(editor: CodeEditor, path: string) {
    const uri = fileUri(path)
    const saved = viewStates.get(uri)
    if (saved) editor.restoreViewState(saved)
    trackedUriRef.current = uri
    editor.focus()
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
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

  function showLine(line: number) {
    const editor = editorRef.current
    if (!editor) return
    editor.revealLineInCenter(line)
    editor.setPosition({ lineNumber: line, column: 1 })
    editor.focus()
  }

  function scheduleCheck(path: string) {
    if (timerRef.current) window.clearTimeout(timerRef.current.id)
    const id = window.setTimeout(() => {
      timerRef.current = null
      void checkFile(path, moveViewState)
    }, SYNC_DELAY_MS)
    timerRef.current = { id, path }
  }

  // Closing the panel checks the last edit right away instead of losing it.
  useEffect(
    () => () => {
      const pending = timerRef.current
      if (pending) {
        window.clearTimeout(pending.id)
        void checkFile(pending.path, moveViewState)
      }
    },
    [],
  )

  // Another tab: Monaco has already switched the model (child effects run
  // first), so the new file's saved position can be restored.
  useEffect(() => {
    const editor = editorRef.current
    if (editor && filePath) restoreViewState(editor, filePath)
  }, [filePath])

  // The line the canvas cannot show gets a warning underline.
  useEffect(() => {
    const model = editorRef.current?.getModel()
    const monaco = monacoRef.current
    if (!model || !monaco) return
    const markers =
      issue && issue.line <= model.getLineCount()
        ? [
            {
              startLineNumber: issue.line,
              endLineNumber: issue.line,
              startColumn: 1,
              endColumn: model.getLineMaxColumn(issue.line),
              message: issue.message,
              severity:
                issue.kind === 'unsupported'
                  ? monaco.MarkerSeverity.Warning
                  : monaco.MarkerSeverity.Info,
            },
          ]
        : []
    monaco.editor.setModelMarkers(model, 'canvas-sync', markers)
  }, [issue, filePath])

  useEffect(() => {
    if (fresh && result && 'files' in result) {
      void dropOutdatedSyncedCopies(result.files, result.website)
    }
  }, [fresh, result])

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
          Text, styles, links and images sync to the canvas when you pause.
          Other code is kept as code.
        </span>
      </div>
      {files.length > 0 && (
        <div className="code-tabs" role="tablist" aria-label="Files">
          {files.map((entry) => {
            const edited =
              entry.path in customFiles &&
              customFiles[entry.path]?.status !== 'synced'
            return (
              <button
                key={entry.path}
                className={`code-tab${entry.path === file?.path ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={entry.path === file?.path}
                title={
                  entry.generated === null
                    ? `${entry.path} (not generated)`
                    : edited
                      ? `${entry.path} (edited in code)`
                      : entry.path
                }
                onClick={() => setSelectedPath(entry.path)}
              >
                {fileName(entry.path)}
                {entry.generated === null && ' (not generated)'}
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
        <CustomFileBar
          file={file}
          custom={custom}
          canvasChanged={canvasChanged}
          onShowLine={showLine}
        />
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
            value={custom?.content ?? file.generated ?? ''}
            onChange={(value) => {
              editFile(file.path, value ?? '', file.generated ?? '')
              scheduleCheck(file.path)
            }}
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
