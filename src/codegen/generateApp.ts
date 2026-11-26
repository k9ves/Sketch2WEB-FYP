import type { ComponentNode, WebsiteDocument } from '../schema/types'
import { describeElement, openTag } from './generateNode'
import { generateTreeJsx } from './generateTree'

/** A React component module wrapping one top-level part of the website. */
export function generateComponentTsx(
  name: string,
  node: ComponentNode,
): string {
  // Depth 2 places the JSX inside `return (` ... `)`.
  return [
    `function ${name}() {`,
    '  return (',
    generateTreeJsx(node, 2),
    '  )',
    '}',
    '',
    `export default ${name}`,
    '',
  ].join('\n')
}

/**
 * The `App.tsx` module: the website root with one tag per component file.
 * The page's `sw-*` styles come from `App.css`, shipped next to this file.
 */
export function generateAppTsx(
  website: WebsiteDocument,
  componentNames: readonly string[],
): string {
  const root = describeElement(website)
  const body =
    componentNames.length === 0
      ? [`    ${openTag(root, true)}`]
      : [
          `    ${openTag(root)}`,
          ...componentNames.map((name) => `      <${name} />`),
          `    </${root.tag}>`,
        ]

  return [
    "import './App.css'",
    ...componentNames.map(
      (name) => `import ${name} from './components/${name}'`,
    ),
    '',
    'function App() {',
    '  return (',
    ...body,
    '  )',
    '}',
    '',
    'export default App',
    '',
  ].join('\n')
}
