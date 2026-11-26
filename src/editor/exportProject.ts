// Export as ZIP (T58): the whole runnable project in one download. It holds
// the generated code with the user's code-only edits, the fixed Vite files
// and the images the page uses from the builder's public folder.

import { formatProjectFiles } from '../codegen/formatCode'
import { generateProjectFiles } from '../codegen/generateProject'
import {
  packageName,
  publicAssetPaths,
  websiteTitle,
} from '../codegen/projectFiles'
import { createZip, type ZipEntry } from '../codegen/zip'
import type { WebsiteDocument } from '../schema/types'
import { withCustomCode, type CustomFile } from '../store/customCodeStore'

/** Loads a site-relative image, or null when it cannot be read. */
export type AssetLoader = (src: string) => Promise<Uint8Array | null>

export interface ProjectZip {
  bytes: Uint8Array<ArrayBuffer>
  fileName: string
  /** Images that could not be added (the page shows them broken). */
  missingAssets: string[]
}

async function fetchAsset(src: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(src)
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * A site-relative path that is safe as a file path in the archive. Paths
 * with `..`, a query or a hash are skipped, so unzipping can never write
 * outside the project folder.
 */
function safeAssetPath(src: string): string | null {
  if (!src.startsWith('/') || /[?#\\]/.test(src)) return null
  const segments = src.split('/').filter(Boolean)
  if (segments.length === 0) return null
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null
  }
  return segments.join('/')
}

export async function buildProjectZip(
  website: WebsiteDocument,
  customFiles: Record<string, CustomFile>,
  loadAsset: AssetLoader = fetchAsset,
): Promise<ProjectZip> {
  const folder = packageName(websiteTitle(website))
  const encoder = new TextEncoder()
  const generated = await formatProjectFiles(generateProjectFiles(website))
  const entries: ZipEntry[] = withCustomCode(generated, customFiles).map(
    (file) => ({
      path: `${folder}/${file.path}`,
      data: encoder.encode(file.content),
    }),
  )

  const missingAssets: string[] = []
  for (const src of publicAssetPaths(website)) {
    const path = safeAssetPath(src)
    const data = path ? await loadAsset(src) : null
    if (path && data) entries.push({ path: `${folder}/public/${path}`, data })
    else missingAssets.push(src)
  }

  return { bytes: createZip(entries), fileName: `${folder}.zip`, missingAssets }
}

function downloadBytes(bytes: Uint8Array<ArrayBuffer>, fileName: string): void {
  const blob = new Blob([bytes], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser time to start the download before freeing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Builds the ZIP and downloads it. Returns what was exported. */
export async function exportProjectZip(
  website: WebsiteDocument,
  customFiles: Record<string, CustomFile>,
): Promise<ProjectZip> {
  const zip = await buildProjectZip(website, customFiles)
  downloadBytes(zip.bytes, zip.fileName)
  return zip
}
