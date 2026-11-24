// Checks templates with src/templates/validateTemplate.ts.
// Usage: npm run check:templates            (every src/templates/*.json)
//        npm run check:templates -- a.json  (only the given files)
// The id prefix of each template is its file name (saas.json → "saas-").
// Exits with code 1 when any template has issues.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const templateDir = join(root, 'src', 'templates')
const args = process.argv.slice(2)
const files =
  args.length > 0
    ? args.map((file) => resolve(file))
    : readdirSync(templateDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => join(templateDir, file))

if (files.length === 0) {
  console.log('No templates found in src/templates/.')
  process.exit(0)
}

// Vite loads the TypeScript sources the same way the app does.
const server = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true },
})

let failed = 0
try {
  const { validateTemplate } = await server.ssrLoadModule(
    '/src/templates/validateTemplate.ts',
  )
  for (const file of files) {
    const name = basename(file, '.json')
    let issues
    try {
      issues = validateTemplate(JSON.parse(readFileSync(file, 'utf8')), {
        idPrefix: name,
        assetExists: (src) => existsSync(join(root, 'public', src)),
      })
    } catch (error) {
      issues = [{ nodeId: null, message: `Cannot read file: ${error.message}` }]
    }

    if (issues.length === 0) {
      console.log(`✓ ${name}`)
      continue
    }
    failed += 1
    console.log(`✗ ${name} (${issues.length} issues)`)
    for (const issue of issues) {
      console.log(`    ${issue.nodeId ?? '(template)'}: ${issue.message}`)
    }
  }
} finally {
  await server.close()
}

if (failed > 0) {
  console.log(`\n${failed} of ${files.length} templates have issues.`)
  process.exit(1)
}
console.log(`\nAll ${files.length} templates are fully editable.`)
