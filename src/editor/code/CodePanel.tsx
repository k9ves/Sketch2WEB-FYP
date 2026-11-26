import './monacoSetup'
import Editor from '@monaco-editor/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { formatProjectFiles } from '../../codegen/formatCode'
import { generateProjectFiles } from '../../codegen/generateProject'
import type { GeneratedFile } from '../../codegen/generateProject'
import type { WebsiteDocument } from '../../schema/types'

const SHOWN_FILE = 'src/App.tsx'

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

/** Read-only view of the code generated from the current website. */
function CodePanel({ website }: { website: WebsiteDocument }) {
  const result = useGeneratedCode(website)
  const isDark = useIsDarkTheme()
  const file =
    result && 'files' in result
      ? result.files.find((entry) => entry.path === SHOWN_FILE)
      : undefined

  return (
    <section
      className="code-panel"
      aria-label="Generated code"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="code-header">
        <h2>Code</h2>
        <span className="code-file-name">{SHOWN_FILE}</span>
        <span className="code-note">Read-only · press Esc to go back</span>
      </div>
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
            // A .tsx file URI makes Monaco parse the code as TSX.
            path={`file:///${file.path}`}
            language="typescript"
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
