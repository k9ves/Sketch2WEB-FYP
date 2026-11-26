import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import ThemePicker from './ThemePicker'

/** Image types every browser can show; phone HEIC photos are not. */
const SKETCH_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
const SKETCH_ACCEPT = SKETCH_TYPES.join(',')
const MAX_SKETCH_MB = 10

interface SketchImage {
  file: File
  url: string
}

interface SketchUploadProps {
  onBack: () => void
}

/** Why a file cannot be used as a sketch, or null when it can. */
function sketchFileProblem(file: File): string | null {
  if (!(SKETCH_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" is not a PNG, JPG or WebP image.`
  }
  if (file.size > MAX_SKETCH_MB * 1024 * 1024) {
    return `"${file.name}" is larger than ${MAX_SKETCH_MB} MB.`
  }
  return null
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Sketch upload (T60): pick a photo of a hand-drawn layout and preview it.
 * The image stays in the browser; turning it into components comes later
 * (T61–T64).
 */
function SketchUpload({ onBack }: SketchUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<SketchImage | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Free the preview URL when the image changes or the screen closes.
  useEffect(() => {
    if (!image) return
    return () => URL.revokeObjectURL(image.url)
  }, [image])

  function acceptFile(file: File | undefined) {
    if (!file) return
    const fileProblem = sketchFileProblem(file)
    setProblem(fileProblem)
    if (fileProblem) return
    setImage({ file, url: URL.createObjectURL(file) })
  }

  function chooseFile() {
    inputRef.current?.click()
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragging(false)
    acceptFile(event.dataTransfer.files[0])
  }

  return (
    <main className="start-screen sketch-screen">
      <input
        ref={inputRef}
        type="file"
        accept={SKETCH_ACCEPT}
        hidden
        onChange={(event) => {
          acceptFile(event.target.files?.[0])
          // Choosing the same file again should still trigger onChange.
          event.target.value = ''
        }}
      />
      <header className="start-header">
        <button className="toolbar-button" type="button" onClick={onBack}>
          ← Back
        </button>
        <ThemePicker />
      </header>
      <section className="start-intro gallery-intro">
        <h1>Upload your sketch</h1>
        <p>
          A clear photo of a hand-drawn layout works best: dark lines on white
          paper, taken from above.
        </p>
      </section>

      <button
        className={`sketch-drop${isDragging ? ' is-dragging' : ''}${image ? ' has-image' : ''}`}
        type="button"
        onClick={chooseFile}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {image ? (
          <img
            className="sketch-preview"
            src={image.url}
            alt={`Uploaded sketch ${image.file.name}`}
          />
        ) : (
          <span className="sketch-drop-text">
            <strong>Choose an image</strong> or drop it here
            <span>PNG, JPG or WebP, up to {MAX_SKETCH_MB} MB</span>
          </span>
        )}
      </button>

      {problem !== null && (
        <p className="sketch-problem" role="alert">
          {problem}
        </p>
      )}

      {image && (
        <div className="sketch-actions">
          <p className="start-message">
            {image.file.name} · {formatSize(image.file.size)}
          </p>
          <div className="sketch-buttons">
            <button
              className="toolbar-button"
              type="button"
              onClick={chooseFile}
            >
              Choose another image
            </button>
            <button
              className="toolbar-button"
              type="button"
              disabled
              title="Turning a sketch into components comes in the next step."
            >
              Convert to website (coming soon)
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default SketchUpload
