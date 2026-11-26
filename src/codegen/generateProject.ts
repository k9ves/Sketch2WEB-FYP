import type { WebsiteDocument } from '../schema/types'
import { componentNames } from './componentNames'
import { generateAppTsx, generateComponentTsx } from './generateApp'

export interface GeneratedFile {
  /** Path inside the exported project, e.g. `src/components/Hero.tsx`. */
  path: string
  content: string
}

/** Splits the website into `App.tsx` plus one file per top-level part. */
export function generateProjectFiles(
  website: WebsiteDocument,
): GeneratedFile[] {
  const names = componentNames(website.children)

  return [
    { path: 'src/App.tsx', content: generateAppTsx(website, names) },
    ...website.children.map((node, index) => ({
      path: `src/components/${names[index]}.tsx`,
      content: generateComponentTsx(names[index], node),
    })),
  ]
}
