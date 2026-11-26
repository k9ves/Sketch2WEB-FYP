import { create } from 'zustand'
import type { GeneratedFile } from '../codegen/generateProject'
import type { SourceIssue } from '../codegen/parseJsx'

// Code edited by hand in the code panel (T57, T57b). Supported edits are
// synced into the component tree, which stays the only source of the
// canvas. Everything else is kept here as code.
//
// Rule: a file with code-only changes ("pending" or "codeOnly") is never
// deleted or overwritten automatically; only the user's own action (Reset,
// Undo my change) replaces it. A "synced" copy holds nothing the tree does
// not have, so it may be dropped when the canvas changes.
// See docs/custom-code.md.

export type CustomFileStatus =
  /** Edited; not synced yet (still typing, or waiting for the user). */
  | 'pending'
  /** Everything in it is on the canvas. */
  | 'synced'
  /** The user chose to keep it as code; the canvas does not follow it. */
  | 'codeOnly'

export interface CustomFile {
  content: string
  status: CustomFileStatus
  /** Generated code when the code-only edits started (canvas-changed hint). */
  baseContent: string
  /** Content of the last synced state; "Undo my change" goes back to it. */
  lastSyncedContent: string
  /** Why the last check could not sync, if it could not. */
  issue: (SourceIssue & { kind: 'syntax' | 'unsupported' }) | null
}

export const DEFAULT_OPEN_PATH = 'src/App.tsx'

interface CustomCodeState {
  /** Edited files by project path, e.g. `src/components/Hero.tsx`. */
  files: Record<string, CustomFile>
  /** File shown in the code panel; reopening Code shows it again. */
  openPath: string
  setOpenPath: (path: string) => void
  /** Saves typing. `generated` is the file's current generated code. */
  editFile: (path: string, content: string, generated: string) => void
  /** The checked content is on the canvas now. */
  markSynced: (path: string, content: string) => void
  /** The checked content could not be synced. */
  markIssue: (path: string, content: string, issue: CustomFile['issue']) => void
  keepCodeOnly: (path: string) => void
  /** A code-only file is checked again for syncing ("Sync again"). */
  retrySync: (path: string) => void
  /** Back to the last synced content ("Undo my change"). */
  undoChange: (path: string) => void
  /** User action: back to the generated code. */
  resetFile: (path: string) => void
  /** Drops a synced copy (it has nothing the tree does not have). */
  dropSynced: (path: string) => void
  /** Drops every edit; only after the user confirmed (another website). */
  clearAll: () => void
}

function withoutFile(
  files: Record<string, CustomFile>,
  path: string,
): Record<string, CustomFile> {
  return Object.fromEntries(
    Object.entries(files).filter(([entryPath]) => entryPath !== path),
  )
}

function updateFile(
  files: Record<string, CustomFile>,
  path: string,
  change: (file: CustomFile) => CustomFile,
): Record<string, CustomFile> {
  const file = files[path]
  return file ? { ...files, [path]: change(file) } : files
}

export const useCustomCodeStore = create<CustomCodeState>((set) => ({
  files: {},
  openPath: DEFAULT_OPEN_PATH,
  setOpenPath: (path) => set({ openPath: path }),
  editFile: (path, content, generated) =>
    set((state) => {
      const previous = state.files[path]
      if (previous?.content === content) return state
      if (!previous && content === generated) return state
      // After a sync the generated code changed; new edits start from it.
      const fromSynced = !previous || previous.status === 'synced'
      return {
        files: {
          ...state.files,
          [path]: {
            content,
            status: previous?.status === 'codeOnly' ? 'codeOnly' : 'pending',
            baseContent: fromSynced ? generated : previous.baseContent,
            lastSyncedContent: previous
              ? fromSynced
                ? previous.content
                : previous.lastSyncedContent
              : generated,
            issue: previous?.issue ?? null,
          },
        },
      }
    }),
  markSynced: (path, content) =>
    set((state) => ({
      files: updateFile(state.files, path, (file) =>
        file.content === content && file.status === 'pending'
          ? {
              ...file,
              status: 'synced',
              lastSyncedContent: content,
              issue: null,
            }
          : file,
      ),
    })),
  markIssue: (path, content, issue) =>
    set((state) => ({
      files: updateFile(state.files, path, (file) =>
        file.content === content ? { ...file, issue } : file,
      ),
    })),
  keepCodeOnly: (path) =>
    set((state) => ({
      files: updateFile(state.files, path, (file) => ({
        ...file,
        status: 'codeOnly',
      })),
    })),
  retrySync: (path) =>
    set((state) => ({
      files: updateFile(state.files, path, (file) => ({
        ...file,
        status: 'pending',
        issue: null,
      })),
    })),
  undoChange: (path) =>
    set((state) => ({
      files: updateFile(state.files, path, (file) => ({
        ...file,
        content: file.lastSyncedContent,
        status: 'synced',
        issue: null,
      })),
    })),
  resetFile: (path) =>
    set((state) => ({ files: withoutFile(state.files, path) })),
  dropSynced: (path) =>
    set((state) =>
      state.files[path]?.status === 'synced'
        ? { files: withoutFile(state.files, path) }
        : state,
    ),
  clearAll: () => set({ files: {}, openPath: DEFAULT_OPEN_PATH }),
}))

/** Files whose code would be lost if the custom copies were dropped. */
export function codeOnlyPaths(files: Record<string, CustomFile>): string[] {
  return Object.entries(files)
    .filter(([, file]) => file.status !== 'synced')
    .map(([path]) => path)
}

/**
 * The project as it will be exported: generated files, with code-only
 * files replaced by their custom copy. Code-only files that are no longer
 * generated (e.g. a renamed section) are kept as extra files. Synced copies
 * match the tree, so the generated code is used for them.
 */
export function withCustomCode(
  generated: readonly GeneratedFile[],
  custom: Record<string, CustomFile>,
): GeneratedFile[] {
  const paths = new Set(generated.map((file) => file.path))
  const replaced = generated.map((file) => {
    const edited = custom[file.path]
    return edited && edited.status !== 'synced'
      ? { ...file, content: edited.content }
      : file
  })
  const orphans = Object.entries(custom)
    .filter(([path, file]) => !paths.has(path) && file.status !== 'synced')
    .map(([path, file]) => ({ path, content: file.content }))
  return [...replaced, ...orphans]
}
