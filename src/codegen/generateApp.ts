import type { WebsiteDocument } from '../schema/types'
import { generateTreeJsx } from './generateTree'

/**
 * Wraps the whole website in an `App.tsx` module. The page's `sw-*` styles
 * come from `App.css`, which the export ships next to this file.
 */
export function generateAppTsx(website: WebsiteDocument): string {
  // Depth 2 places the JSX inside `return (` ... `)`.
  const jsx = generateTreeJsx(website, 2)

  return [
    "import './App.css'",
    '',
    'function App() {',
    '  return (',
    jsx,
    '  )',
    '}',
    '',
    'export default App',
    '',
  ].join('\n')
}
