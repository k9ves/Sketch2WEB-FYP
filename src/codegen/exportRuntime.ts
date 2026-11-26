// Run-time helper of the exported project for freely placed components
// (T53b). Absolutely positioned components take no space, so each
// container grows to keep them inside, like containPositionedChildren on
// the canvas (editor/freeform/positionedLayout.ts). Only exported when the
// website uses free placement or resized containers.

export const freeformTs = `// Keeps freely placed components (data-sw-positioned) inside their
// containers (data-sw-contains). Absolutely positioned elements take no
// space, so each container gets a min-height that reaches below them. A
// stored height (data-sw-min-height) is kept as a minimum too.

function containPositioned(root: HTMLElement): void {
  // Deepest containers first, so outer ones see the grown inner ones.
  const containers = Array.from(
    root.querySelectorAll<HTMLElement>('[data-sw-contains]'),
  ).reverse()

  for (const container of containers) {
    container.style.minHeight = ''
    const style = getComputedStyle(container)
    const stored = Number(container.dataset.swMinHeight) || 0
    const positioned = Array.from(container.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset.swPositioned === 'true',
    )
    const bottom =
      positioned.length === 0
        ? 0
        : Math.max(
            ...positioned.map((child) => child.offsetTop + child.offsetHeight),
          ) +
          parseFloat(style.borderTopWidth) +
          parseFloat(style.borderBottomWidth)
    const required = Math.max(bottom, stored)
    if (required > (parseFloat(style.minHeight) || 0)) {
      container.style.minHeight = \`\${Math.ceil(required)}px\`
    }
  }
}

/** Arranges the page now and whenever its content or size changes. */
export function watchFreeform(root: HTMLElement): void {
  let frame = 0
  const resizes = new ResizeObserver(() => schedule())

  function observeAll() {
    resizes.disconnect()
    resizes.observe(root)
    root
      .querySelectorAll('[data-sw-positioned], [data-sw-contains]')
      .forEach((element) => resizes.observe(element))
  }

  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => containPositioned(root))
  }

  // React renders after this call; watch for the page to appear or change.
  new MutationObserver(() => {
    observeAll()
    schedule()
  }).observe(root, { childList: true, subtree: true })
  observeAll()
  schedule()
}
`

export const mainTsxWithFreeform = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { watchFreeform } from './freeform'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Freely placed components: keep them inside their sections.
watchFreeform(root)
`
