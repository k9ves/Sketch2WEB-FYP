// README and backend starter files of the exported project (T58). The
// export is frontend only; these files show how to connect a backend or a
// hosted service (see the export notes in TASKS.md).

export function readmeMarkdown(title: string): string {
  return `# ${title}

A website made with Sketch2Web: React, TypeScript, Vite and Tailwind CSS.

## Run it

\`\`\`bash
npm install
npm run dev      # development server at http://localhost:5173
npm run build    # type check and production build in dist/
npm run preview  # serve the production build
\`\`\`

## Where things are

| Path              | What it holds                                              |
| ----------------- | ---------------------------------------------------------- |
| \`src/App.tsx\`     | The page: one tag per section                              |
| \`src/components/\` | One file per section (Navbar, Hero, ...)                   |
| \`src/App.css\`     | The component look (\`sw-*\` classes)                        |
| \`src/index.css\`   | Tailwind and page basics                                   |
| \`src/api.ts\`      | A small \`fetch\` helper for your own API                    |
| \`public/\`         | Images used by the page                                    |

Every element has a \`sw-*\` class (\`sw-hero\`, \`sw-card\`, ...), so you can
find each part of the page in the code. Styles you picked in the editor are
Tailwind classes next to them.

## Connect a backend

This project is the frontend only. To load or save data, connect a backend
of your own or a hosted service.

### Your own API

1. Copy \`.env.example\` to \`.env\` and set \`VITE_API_URL\`, for example
   \`VITE_API_URL=https://api.example.com\`.
2. Call it with the helper in \`src/api.ts\`:

   \`\`\`ts
   import { apiFetch } from './api'

   const posts = await apiFetch<{ id: number; title: string }[]>('/posts')
   \`\`\`

3. Allow this site's address in your backend's CORS settings.
4. Deploy the two parts separately: the frontend is static (\`npm run build\`,
   then upload \`dist/\` to any static host); the backend runs on its own
   server.

### Hosted services (no own backend)

- **Supabase** or **Firebase**: data and login.
- **Formspree**: contact forms that send you an email.
- **Stripe Payment Links**: payments without a server.

> **Warning:** every \`VITE_*\` variable is built into the page and visible to
> anyone in the browser. Only put public values there (an API address, a
> public key). Secret keys belong in the backend only.

## Limits

- The export is one-way. Code you change here cannot be imported back into
  Sketch2Web.
- Components placed freely (Alt) or resized on the canvas appear in normal
  flow here; free positions and sizes are not exported yet.
`
}

export const envExample = `# Address of your backend API, used by src/api.ts.
# VITE_* values are public in the browser: never put secret keys here.
VITE_API_URL=
`

export const envDts = `/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Address of your backend API (see .env.example). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
`

export const apiTs = `// A small helper for calling your own backend. Set VITE_API_URL in .env
// (see .env.example and README.md).

const baseUrl = import.meta.env.VITE_API_URL ?? ''

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!baseUrl) {
    throw new Error('Set VITE_API_URL in .env to call your API.')
  }
  const response = await fetch(\`\${baseUrl}\${path}\`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    throw new Error(\`Request failed: \${response.status} \${response.statusText}\`)
  }
  return (await response.json()) as T
}
`

export const gitignore = `node_modules
dist
.env
.env.*
!.env.example
`
