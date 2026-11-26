import type { WebsiteDocument } from '../schema/types'
import { componentNames } from './componentNames'
import { generateAppTsx, generateComponentTsx } from './generateApp'
import { generatableChildren } from './generateTree'
import { projectFiles } from './projectFiles'

export interface GeneratedFile {
  /** Path inside the exported project, e.g. `src/components/Hero.tsx`. */
  path: string
  content: string
}

/**
 * The whole exported project: fixed Vite files, `App.tsx` and one file per
 * top-level part. Images are listed separately (see publicAssetPaths).
 */
export function generateProjectFiles(
  website: WebsiteDocument,
): GeneratedFile[] {
  const parts = generatableChildren(website)
  const names = componentNames(parts)

  return [
    ...projectFiles(website),
    { path: 'src/App.tsx', content: generateAppTsx(website, names) },
    ...parts.map((node, index) => ({
      path: `src/components/${names[index]}.tsx`,
      content: generateComponentTsx(names[index], node),
    })),
  ]
}
