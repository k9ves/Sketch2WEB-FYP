import { create } from 'zustand'
import type { GeneratedFile } from '../codegen/generateProject'

// Code edited by hand in the code panel (T57). It is a separate copy: the
// component tree stays the single source of the canvas, and these edits are
// never read back into it. See docs/custom-code.md for the limits.

export interface CustomFile {
  /** The code as the user edited it. */
  content: string
  /** Generated code when editing started; shows if the canvas changed since. */
  baseContent: string
}

interface CustomCodeState {
  /** Edited files by project path, e.g. `src/components/Hero.tsx`. */
  files: Record<string, CustomFile>
  /** Saves an edit; going back to the generated code removes the copy. */
  editFile: (path: string, content: string, generated: string) => void
  resetFile: (path: string) => void
  /** File shown in the code panel; reopening Code shows it again. */
  openPath: string
  setOpenPath: (path: string) => void
  /** Drops every edit, e.g. when another website is opened. */
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

export const DEFAULT_OPEN_PATH = 'src/App.tsx'

export const useCustomCodeStore = create<CustomCodeState>((set) => ({
  files: {},
  editFile: (path, content, generated) =>
    set((state) => {
      if (content === generated)
        return { files: withoutFile(state.files, path) }
      const baseContent = state.files[path]?.baseContent ?? generated
      return {
        files: { ...state.files, [path]: { content, baseContent } },
      }
    }),
  resetFile: (path) =>
    set((state) => ({ files: withoutFile(state.files, path) })),
  openPath: DEFAULT_OPEN_PATH,
  setOpenPath: (path) => set({ openPath: path }),
  clearAll: () => set({ files: {}, openPath: DEFAULT_OPEN_PATH }),
}))

/**
 * The project as it will be exported: generated files, with edited files
 * replaced by their custom copy. Edits of files that are no longer
 * generated (e.g. a renamed section) are left out.
 */
export function withCustomCode(
  generated: readonly GeneratedFile[],
  custom: Record<string, CustomFile>,
): GeneratedFile[] {
  return generated.map((file) => {
    const edited = custom[file.path]
    return edited ? { ...file, content: edited.content } : file
  })
}
