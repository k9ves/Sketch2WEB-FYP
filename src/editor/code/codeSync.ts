import { componentNames } from '../../codegen/componentNames'
import type { GeneratedFile } from '../../codegen/generateProject'
import { generatableChildren } from '../../codegen/generateTree'
import { syncCodeFile } from '../../codegen/syncCode'
import type { WebsiteDocument } from '../../schema/types'
import { useCustomCodeStore } from '../../store/customCodeStore'
import { useWebsiteStore } from '../../store/websiteStore'

// Code-to-canvas sync steps of the code panel (T57b). They read the stores
// directly because they run after a delay, and may finish after the panel
// closed. Code-only files are never dropped or overwritten here.

export const COMPONENT_PREFIX = 'src/components/'

function componentPaths(website: WebsiteDocument): string[] {
  return componentNames(generatableChildren(website)).map(
    (name) => `${COMPONENT_PREFIX}${name}.tsx`,
  )
}

/**
 * Checks a pending file and, when it only has supported edits, puts them on
 * the canvas as one undo step. `onRename` hears about component files that
 * got a new name (a changed section heading renames its file).
 */
export async function checkFile(
  path: string,
  onRename?: (from: string, to: string) => void,
): Promise<void> {
  const custom = useCustomCodeStore.getState().files[path]
  if (!custom || custom.status !== 'pending') return
  const { content } = custom
  const website = useWebsiteStore.getState().website
  const result = await syncCodeFile(path, content, website)

  // Skip results that are out of date (more typing, or another change).
  const code = useCustomCodeStore.getState()
  const latest = code.files[path]
  if (latest?.content !== content || latest.status !== 'pending') return
  if (useWebsiteStore.getState().website !== website) return

  switch (result.status) {
    case 'not-canvas-file':
      code.keepCodeOnly(path)
      return
    case 'syntax-error':
      code.markIssue(path, content, { ...result.issue, kind: 'syntax' })
      return
    case 'unsupported':
      code.markIssue(path, content, { ...result.issue, kind: 'unsupported' })
      return
    case 'synced': {
      const before = componentPaths(website)
      if (result.updates.length > 0) {
        useWebsiteStore.getState().updateNodes(result.updates)
      }
      code.markSynced(path, content)
      const after = componentPaths(useWebsiteStore.getState().website)
      before.forEach((oldPath, index) => {
        const newPath = after[index]
        if (!newPath || newPath === oldPath) return
        // Only a synced copy goes; code-only files stay under the old name.
        useCustomCodeStore.getState().dropSynced(oldPath)
        onRename?.(oldPath, newPath)
        if (useCustomCodeStore.getState().openPath === oldPath) {
          useCustomCodeStore.getState().setOpenPath(newPath)
        }
      })
      return
    }
  }
}

/**
 * Synced copies hold nothing the tree does not have. When the canvas
 * changed so that one no longer matches, the generated code replaces it.
 */
export async function dropOutdatedSyncedCopies(
  files: readonly GeneratedFile[],
  website: WebsiteDocument,
): Promise<void> {
  const generated = new Set(files.map((file) => file.path))
  const custom = useCustomCodeStore.getState().files
  for (const [path, file] of Object.entries(custom)) {
    if (file.status !== 'synced') continue
    if (!generated.has(path)) {
      useCustomCodeStore.getState().dropSynced(path)
      continue
    }
    const result = await syncCodeFile(path, file.content, website)
    const stillMatches = result.status === 'synced' && !result.updates.length
    const latest = useCustomCodeStore.getState().files[path]
    if (!stillMatches && latest?.content === file.content) {
      useCustomCodeStore.getState().dropSynced(path)
    }
  }
}
