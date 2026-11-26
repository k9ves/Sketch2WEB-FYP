import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { parseDetection } from '../sketch/detection'
import type { DetectionResult, SketchElement } from '../sketch/detection'
import { sketchPrompt } from '../sketch/sketchPrompt'
import ThemePicker from './ThemePicker'

/** Image types every browser can show; phone HEIC photos are not. */
const SKETCH_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
const SKETCH_ACCEPT = SKETCH_TYPES.join(',')
const MAX_SKETCH_MB = 10

interface SketchImage {
  file: File
  url: string
}

type CopyState = 'idle' | 'copied' | 'failed'

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

function percent(share: number): string {
  return `${(share * 100).toFixed(2)}%`
}

/** Detected elements drawn over the photo, so mistakes are easy to see. */
function DetectionOverlay({ elements }: { elements: SketchElement[] }) {
  return (
    <span className="sketch-overlay" aria-hidden="true">
      {elements.map((element, index) => (
        <span
          key={index}
          className={`sketch-box sketch-box-${element.type}`}
          style={{
            left: percent(element.box.x),
            top: percent(element.box.y),
            width: percent(element.box.w),
            height: percent(element.box.h),
          }}
        >
          <span className="sketch-box-label">{element.type}</span>
        </span>
      ))}
    </span>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Sketch upload (T60) and manual detection (T61, docs/sketch-detection.md
 * §2.1): pick a photo of a hand-drawn layout, copy the prompt into a Claude
 * chat and paste the answer back. The image stays in the browser; turning
 * the elements into components comes later (T62–T64).
 */
function SketchUpload({ onBack }: SketchUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<SketchImage | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [pasted, setPasted] = useState('')
  const [detection, setDetection] = useState<DetectionResult | null>(null)

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
    // A result belongs to the photo it was made from.
    setPasted('')
    setDetection(null)
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(sketchPrompt)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
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
          <span className="sketch-figure">
            <img
              className="sketch-preview"
              src={image.url}
              alt={`Uploaded sketch ${image.file.name}`}
            />
            {detection?.ok && (
              <DetectionOverlay elements={detection.elements} />
            )}
          </span>
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

      {image && (
        <section
          className="sketch-detect"
          aria-labelledby="sketch-detect-title"
        >
          <h2 id="sketch-detect-title">Read the sketch with Claude</h2>
          <ol className="sketch-steps">
            <li>
              <button
                className="toolbar-button"
                type="button"
                onClick={() => void copyPrompt()}
              >
                {copyState === 'copied' ? 'Prompt copied ✓' : 'Copy prompt'}
              </button>
              {copyState === 'failed' && (
                <span className="sketch-problem">
                  Copy did not work. Select the prompt below and copy it.
                </span>
              )}
            </li>
            <li>
              Open{' '}
              <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                a new Claude chat
              </a>
              , attach this photo and paste the prompt.
            </li>
            <li>Copy Claude's answer and paste it here.</li>
          </ol>

          {copyState === 'failed' && (
            <textarea
              className="sketch-textarea"
              readOnly
              value={sketchPrompt}
              rows={8}
              aria-label="Prompt for Claude"
            />
          )}

          <textarea
            className="sketch-textarea"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={8}
            placeholder='{ "elements": [ ... ] }'
            aria-label="Claude's answer"
            spellCheck={false}
          />
          <button
            className="toolbar-button"
            type="button"
            onClick={() => setDetection(parseDetection(pasted))}
          >
            Show result
          </button>

          {detection && !detection.ok && (
            <p className="sketch-problem" role="alert">
              {detection.message}
            </p>
          )}
          {detection?.ok && (
            <div className="sketch-result" role="status">
              <p>
                Found {detection.elements.length} element
                {detection.elements.length === 1 ? '' : 's'}
                {detection.skipped > 0 &&
                  ` (${detection.skipped} skipped: unknown type or position)`}
                . They are marked on the photo above.
              </p>
              <ul className="sketch-element-list">
                {detection.elements.map((element, index) => (
                  <li key={index}>
                    <strong>{element.type}</strong>
                    {element.text && <span> “{element.text}”</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default SketchUpload
