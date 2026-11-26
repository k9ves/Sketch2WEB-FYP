import ThemePicker from './ThemePicker'

interface StartScreenProps {
  onChooseTemplate: () => void
  onChooseSketch: () => void
  onOpenProject: () => void
  /** Result of opening a project, e.g. why a file was refused. */
  message: string | null
}

function TemplateIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="8" width="36" height="32" rx="5" />
      <path d="M6 17h36M17 17v23" />
      <path d="M23 25h13M23 31h9" />
    </svg>
  )
}

function SketchIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M10 38l3.5-10.5L32 9l7 7-18.5 18.5z" />
      <path d="M28 13l7 7M10 38l10.5-3.5" />
      <path d="M6 42h36" />
    </svg>
  )
}

/** First screen: choose how to start a website (docs: TASKS T45). */
function StartScreen({
  onChooseTemplate,
  onChooseSketch,
  onOpenProject,
  message,
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <header className="start-header">
        <p className="eyebrow">Sketch2Web</p>
        <ThemePicker />
      </header>
      <section className="start-intro">
        <h1>How do you want to start?</h1>
        <p>
          Pick a starting point. You can edit everything afterwards in the
          visual editor.
        </p>
      </section>
      <div className="start-options">
        <button className="start-card" type="button" onClick={onChooseTemplate}>
          <span className="start-card-icon">
            <TemplateIcon />
          </span>
          <span className="start-card-title">Start from a template</span>
          <span className="start-card-text">
            Choose a ready-made website and make it your own.
          </span>
        </button>
        <button className="start-card" type="button" onClick={onChooseSketch}>
          <span className="start-card-icon">
            <SketchIcon />
          </span>
          <span className="start-card-title">Start from a sketch</span>
          <span className="start-card-text">
            Upload a photo of a hand-drawn layout and turn it into a website.
          </span>
        </button>
      </div>
      <div className="start-open">
        <button
          className="toolbar-button"
          type="button"
          onClick={onOpenProject}
        >
          Open a saved project (.json)
        </button>
        {message !== null && (
          <p className="start-message" role="status">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}

export default StartScreen
