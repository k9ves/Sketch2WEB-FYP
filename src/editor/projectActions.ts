// Browser side of saving and opening projects (see store/projectFile.ts).

import type { WebsiteDocument } from '../schema/types'
import {
  MAX_PROJECT_BYTES,
  parseProject,
  projectFileName,
  serializeProject,
} from '../store/projectFile'
import type { ParseProjectResult } from '../store/projectFile'

/** Downloads the website as a .json project file. */
export function downloadProject(website: WebsiteDocument): void {
  const blob = new Blob([serializeProject(website)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = projectFileName(website)
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser time to start the download before freeing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Reads and checks a chosen project file. Never throws. */
export async function readProjectFile(file: File): Promise<ParseProjectResult> {
  if (file.size > MAX_PROJECT_BYTES) {
    return {
      ok: false,
      message: 'This file is too large to be a Sketch2Web project (over 5 MB).',
    }
  }
  try {
    return parseProject(await file.text())
  } catch {
    return { ok: false, message: 'This file could not be read.' }
  }
}
