import type { Options } from 'prettier'
import type { GeneratedFile } from './generateProject'

// Formats generated code with Prettier's browser build. The parser plugins
// are large, so they load only the first time code is formatted.

/** Same style as this project's .prettierrc.json, with fixed line endings. */
const prettierOptions: Options = {
  parser: 'typescript',
  singleQuote: true,
  semi: false,
  trailingComma: 'all',
  endOfLine: 'lf',
}

async function loadPrettier() {
  const [prettier, typescript, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/typescript'),
    import('prettier/plugins/estree'),
  ])
  return { format: prettier.format, plugins: [typescript, estree] }
}

/** Formats a TypeScript/TSX source string. */
export async function formatTsx(code: string): Promise<string> {
  const { format, plugins } = await loadPrettier()
  return format(code, { ...prettierOptions, plugins })
}

/** Formats every `.ts`/`.tsx` file; other files are returned unchanged. */
export async function formatProjectFiles(
  files: readonly GeneratedFile[],
): Promise<GeneratedFile[]> {
  return Promise.all(
    files.map(async (file) =>
      /\.tsx?$/.test(file.path)
        ? { ...file, content: await formatTsx(file.content) }
        : file,
    ),
  )
}
