import './monacoSetup'
import Editor from '@monaco-editor/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { formatProjectFiles } from '../../codegen/formatCode'
import { generateProjectFiles } from '../../codegen/generateProject'
import type { GeneratedFile } from '../../codegen/generateProject'
import type { WebsiteDocument } from '../../schema/types'

const DEFAULT_FILE = 'src/App.tsx'

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
  if (path === DEFAULT_FILE) return 0
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

/** Read-only view of the code generated from the current website. */
function CodePanel({ website }: { website: WebsiteDocument }) {
  const result = useGeneratedCode(website)
  const isDark = useIsDarkTheme()
  const [selectedPath, setSelectedPath] = useState(DEFAULT_FILE)
  const files = result && 'files' in result ? sortForTabs(result.files) : []
  // A component file can disappear (e.g. its section was renamed); fall
  // back to App.tsx instead of showing nothing.
  const file =
    files.find((entry) => entry.path === selectedPath) ??
    files.find((entry) => entry.path === DEFAULT_FILE)

  return (
    <section
      className="code-panel"
      aria-label="Generated code"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="code-header">
        <h2>Code</h2>
        {file && <span className="code-file-name">{file.path}</span>}
        <span className="code-note">Read-only · press Esc to go back</span>
      </div>
      {files.length > 0 && (
        <div className="code-tabs" role="tablist" aria-label="Files">
          {files.map((entry) => (
            <button
              key={entry.path}
              className={`code-tab${entry.path === file?.path ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={entry.path === file?.path}
              title={entry.path}
              onClick={() => setSelectedPath(entry.path)}
            >
              {fileName(entry.path)}
            </button>
          ))}
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
            path={`file:///${file.path}`}
            language={fileLanguage(file.path)}
            value={file.content}
            theme={isDark ? 'vs-dark' : 'light'}
            loading={<p className="code-status">Loading code editor…</p>}
            options={{
              readOnly: true,
              domReadOnly: true,
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
