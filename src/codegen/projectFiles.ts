import builderPackage from '../../package.json'
import websiteCss from '../renderer/website.css?raw'
import type { ComponentNode, WebsiteDocument } from '../schema/types'
import type { GeneratedFile } from './generateProject'
import { generatableChildren } from './generateTree'

// The fixed files of the exported Vite + React + Tailwind project. Package
// versions come from the builder's own package.json, so the export uses the
// same React, Vite and Tailwind as the canvas.

function version(name: string): string {
  const all: Record<string, string> = {
    ...builderPackage.dependencies,
    ...builderPackage.devDependencies,
  }
  const found = all[name]
  if (!found) throw new Error(`Missing builder dependency "${name}".`)
  return found
}

function versions(names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, version(name)]))
}

/** "Northstar Studio" → "northstar-studio" (a valid npm package name). */
function packageName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'my-website'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function packageJson(title: string): string {
  return json({
    name: packageName(title),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc --noEmit && vite build',
      preview: 'vite preview',
    },
    dependencies: versions(['react', 'react-dom']),
    devDependencies: versions([
      '@tailwindcss/vite',
      '@types/react',
      '@types/react-dom',
      '@vitejs/plugin-react',
      'tailwindcss',
      'typescript',
      'vite',
    ]),
  })
}

const tsconfigJson = json({
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    types: ['vite/client'],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  },
  include: ['src'],
})

const viteConfig = `import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
`

function indexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
}

const mainTsx = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`

/** Page basics the canvas gets from the editor (preview frame, index.css). */
const indexCss = `@import 'tailwindcss';

:root {
  color: #252239;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-width: 320px;
  margin: 0;
}

/* The page width drives the gutter (cqw) and the mobile layout
   (@container sw-page in App.css), like the canvas width does. */
#root {
  container: sw-page / inline-size;
}

.sw-website {
  min-height: 100vh;
}
`

/** Lets inline styles set the --sw-align / --sw-justify CSS variables. */
const cssVarsDts = `import 'react'

declare module 'react' {
  interface CSSProperties {
    [variable: \`--\${string}\`]: string | number | undefined
  }
}
`

/** Every fixed file of the export, next to the generated components. */
export function projectFiles(website: WebsiteDocument): GeneratedFile[] {
  const title = website.content.title?.trim() || 'My website'

  return [
    { path: 'package.json', content: packageJson(title) },
    { path: 'tsconfig.json', content: tsconfigJson },
    { path: 'vite.config.ts', content: viteConfig },
    { path: 'index.html', content: indexHtml(title) },
    { path: 'src/main.tsx', content: mainTsx },
    { path: 'src/index.css', content: indexCss },
    { path: 'src/App.css', content: websiteCss },
    { path: 'src/css-vars.d.ts', content: cssVarsDts },
  ]
}

function collectImageSources(node: ComponentNode, sources: Set<string>) {
  if (node.type === 'image' && node.content.src?.startsWith('/')) {
    sources.add(node.content.src)
  }
  generatableChildren(node).forEach((child) =>
    collectImageSources(child, sources),
  )
}

/**
 * Site-relative images (e.g. `/templates/saas/dashboard.svg`) the export
 * must copy from the builder's public folder to its own `public/` folder.
 */
export function publicAssetPaths(website: WebsiteDocument): string[] {
  const sources = new Set<string>()
  collectImageSources(website, sources)
  return [...sources]
}
