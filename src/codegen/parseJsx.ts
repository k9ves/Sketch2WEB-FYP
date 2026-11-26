// A small, strict reader for code in the shape the generator writes:
//
//   import ... (App.tsx only)
//   function Name() {
//     return ( <jsx /> )
//   }
//   export default Name
//
// It is not a full TypeScript parser. Anything outside that shape (hooks,
// variables, handlers, spreads, ...) is reported as unsupported with its
// line, so the code panel can say exactly what the canvas cannot show.
// Syntax errors are found before this runs (see syncCode.ts).

export interface SourceIssue {
  message: string
  line: number
}

export type JsxAttributeValue =
  | { kind: 'string'; value: string }
  | { kind: 'object'; entries: Record<string, string> }
  /** Any other expression, kept as written for messages. */
  | { kind: 'expression'; raw: string }
  /** An attribute written without a value, e.g. `disabled`. */
  | { kind: 'boolean' }

export interface JsxAttribute {
  name: string
  value: JsxAttributeValue
  line: number
}

export type JsxChild =
  | JsxElementNode
  | { kind: 'text'; value: string; line: number }
  | { kind: 'expression'; raw: string; line: number }

export interface JsxElementNode {
  kind: 'element'
  tag: string
  attributes: JsxAttribute[]
  children: JsxChild[]
  line: number
}

export interface JsxImport {
  /** Default import name, or null for a side-effect import. */
  name: string | null
  from: string
  line: number
}

export interface ParsedComponentFile {
  imports: JsxImport[]
  name: string
  root: JsxElementNode
}

export type ParseResult =
  { ok: true; file: ParsedComponentFile } | { ok: false; issue: SourceIssue }

class UnsupportedCode extends Error {
  readonly line: number

  constructor(message: string, line: number) {
    super(message)
    this.line = line
  }
}

const IDENTIFIER = /[A-Za-z_$][\w$]*/y

/** HTML entities JSX decodes; numeric ones are handled separately. */
const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  deg: '°',
  times: '×',
  divide: '÷',
}

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi,
    (entity, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10)
        return Number.isFinite(code) && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : entity
      }
      return namedEntities[body] ?? entity
    },
  )
}

/**
 * JSX text whitespace, as React sees it: lines are trimmed, empty lines
 * dropped and the rest joined with one space (Babel's JSX text rule).
 */
export function cleanJsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/)
  let lastNonEmpty = -1
  lines.forEach((line, index) => {
    if (/[^ \t]/.test(line)) lastNonEmpty = index
  })

  let result = ''
  lines.forEach((line, index) => {
    let trimmed = line.replace(/\t/g, ' ')
    if (index !== 0) trimmed = trimmed.replace(/^ +/, '')
    if (index !== lines.length - 1) trimmed = trimmed.replace(/ +$/, '')
    if (trimmed) {
      result += index === lastNonEmpty ? trimmed : `${trimmed} `
    }
  })
  return result
}

class Reader {
  private readonly source: string
  private position = 0

  constructor(source: string) {
    this.source = source
  }

  get pos(): number {
    return this.position
  }

  lineAt(position = this.position): number {
    let line = 1
    for (let index = 0; index < position; index += 1) {
      if (this.source[index] === '\n') line += 1
    }
    return line
  }

  get done(): boolean {
    return this.position >= this.source.length
  }

  peek(text: string): boolean {
    return this.source.startsWith(text, this.position)
  }

  char(offset = 0): string {
    return this.source[this.position + offset] ?? ''
  }

  advance(count = 1): void {
    this.position += count
  }

  slice(from: number, to = this.position): string {
    return this.source.slice(from, to)
  }

  /** Skips whitespace and JS comments. */
  skipSpace(): void {
    for (;;) {
      const match = /\s+/y
      match.lastIndex = this.position
      if (match.test(this.source)) this.position = match.lastIndex
      if (this.peek('//')) {
        const end = this.source.indexOf('\n', this.position)
        this.position = end === -1 ? this.source.length : end
      } else if (this.peek('/*')) {
        const end = this.source.indexOf('*/', this.position + 2)
        this.position = end === -1 ? this.source.length : end + 2
      } else {
        return
      }
    }
  }

  match(pattern: RegExp): string | null {
    pattern.lastIndex = this.position
    const found = pattern.exec(this.source)
    if (!found) return null
    this.position = pattern.lastIndex
    return found[0]
  }

  word(): string | null {
    return this.match(IDENTIFIER)
  }

  /** Reads a JS string literal ('...', "..." or `...` without ${}). */
  stringLiteral(): string | null {
    const quote = this.char()
    if (quote !== "'" && quote !== '"' && quote !== '`') return null
    const start = this.position
    this.advance()
    let value = ''
    while (!this.done && this.char() !== quote) {
      if (quote === '`' && this.peek('${')) {
        this.position = start
        return null
      }
      if (this.char() === '\\') {
        value += this.escape()
      } else {
        value += this.char()
        this.advance()
      }
    }
    this.advance()
    return value
  }

  private escape(): string {
    const next = this.char(1)
    this.advance(2)
    const simple: Record<string, string> = {
      n: '\n',
      t: '\t',
      r: '\r',
      b: '\b',
      f: '\f',
      v: '\v',
      0: '\0',
      '\n': '',
    }
    if (next in simple) return simple[next] ?? ''
    if (next === 'u' && this.char() === '{') {
      const end = this.source.indexOf('}', this.position)
      const code = parseInt(this.slice(this.position + 1, end), 16)
      this.position = end + 1
      return String.fromCodePoint(code)
    }
    if (next === 'u' || next === 'x') {
      const length = next === 'u' ? 4 : 2
      const code = parseInt(
        this.slice(this.position, this.position + length),
        16,
      )
      this.advance(length)
      return String.fromCharCode(code)
    }
    return next
  }

  /** Reads a `{...}` expression with nested braces and strings. */
  balancedExpression(): string {
    const start = this.position
    let depth = 0
    while (!this.done) {
      const char = this.char()
      if (char === "'" || char === '"' || char === '`') {
        if (this.stringLiteral() === null) this.skipTemplate()
        continue
      }
      if (this.peek('//') || this.peek('/*')) {
        this.skipSpace()
        continue
      }
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      this.advance()
      if (depth === 0) break
    }
    return this.slice(start)
  }

  private skipTemplate(): void {
    this.advance()
    while (!this.done && this.char() !== '`') {
      if (this.char() === '\\') this.advance(2)
      else if (this.peek('${')) {
        this.advance()
        this.balancedExpression()
      } else this.advance()
    }
    this.advance()
  }
}

/** `{ key: 'value', other: 2 }` with literal values only, else null. */
function parseObjectLiteral(raw: string): Record<string, string> | null {
  const reader = new Reader(raw)
  if (!reader.peek('{')) return null
  reader.advance()
  const entries: Record<string, string> = {}
  for (;;) {
    reader.skipSpace()
    if (reader.peek('}')) {
      reader.advance()
      break
    }
    const key = reader.word() ?? reader.stringLiteral()
    if (key === null) return null
    reader.skipSpace()
    if (!reader.peek(':')) return null
    reader.advance()
    reader.skipSpace()
    const value =
      reader.stringLiteral() ?? reader.match(/-?\d+(?:\.\d+)?/y) ?? null
    if (value === null) return null
    entries[key] = value
    reader.skipSpace()
    if (reader.peek(',')) reader.advance()
    else if (!reader.peek('}')) return null
  }
  reader.skipSpace()
  return reader.done ? entries : null
}

/** The inside of `{ ... }` (without the outer braces), trimmed. */
function expressionBody(raw: string): string {
  return raw.slice(1, -1).trim()
}

function isCommentOnly(body: string): boolean {
  const reader = new Reader(body)
  reader.skipSpace()
  return reader.done
}

function literalString(body: string): string | null {
  const reader = new Reader(body)
  const value = reader.stringLiteral()
  reader.skipSpace()
  return value !== null && reader.done ? value : null
}

function parseAttributeValue(reader: Reader): JsxAttributeValue {
  const quote = reader.char()
  if (quote === '"' || quote === "'") {
    reader.advance()
    const start = reader.pos
    while (!reader.done && reader.char() !== quote) reader.advance()
    const value = decodeEntities(reader.slice(start))
    reader.advance()
    return { kind: 'string', value }
  }
  if (quote === '{') {
    const raw = reader.balancedExpression()
    const body = expressionBody(raw)
    const text = literalString(body)
    if (text !== null) return { kind: 'string', value: text }
    const object = parseObjectLiteral(body)
    if (object) return { kind: 'object', entries: object }
    return { kind: 'expression', raw }
  }
  throw new UnsupportedCode('Unexpected attribute value.', reader.lineAt())
}

function parseElement(reader: Reader): JsxElementNode {
  const line = reader.lineAt()
  reader.advance() // <
  reader.skipSpace()
  if (reader.peek('>')) {
    throw new UnsupportedCode(
      'Fragments (<>...</>) are not supported yet.',
      line,
    )
  }
  const tag = reader.match(/[A-Za-z][\w]*(?:[.:-][\w]+)*/y)
  if (!tag) throw new UnsupportedCode('Expected an element name.', line)
  if (tag.includes('.')) {
    throw new UnsupportedCode(`<${tag}> is not supported yet.`, line)
  }

  const attributes: JsxAttribute[] = []
  for (;;) {
    reader.skipSpace()
    if (reader.peek('/>')) {
      reader.advance(2)
      return { kind: 'element', tag, attributes, children: [], line }
    }
    if (reader.peek('>')) {
      reader.advance()
      break
    }
    const attributeLine = reader.lineAt()
    if (reader.peek('{')) {
      throw new UnsupportedCode(
        'Spread attributes ({...props}) are not supported yet.',
        attributeLine,
      )
    }
    const name = reader.match(/[A-Za-z_][\w:-]*/y)
    if (!name) {
      throw new UnsupportedCode('Expected an attribute name.', attributeLine)
    }
    reader.skipSpace()
    if (reader.peek('=')) {
      reader.advance()
      reader.skipSpace()
      attributes.push({
        name,
        value: parseAttributeValue(reader),
        line: attributeLine,
      })
    } else {
      attributes.push({ name, value: { kind: 'boolean' }, line: attributeLine })
    }
  }

  const children: JsxChild[] = []
  for (;;) {
    if (reader.done) throw new UnsupportedCode(`<${tag}> is not closed.`, line)
    if (reader.peek('</')) {
      reader.advance(2)
      reader.skipSpace()
      const closing = reader.match(/[A-Za-z][\w]*(?:[.:-][\w]+)*/y)
      reader.skipSpace()
      if (closing !== tag || !reader.peek('>')) {
        throw new UnsupportedCode(`<${tag}> is not closed.`, reader.lineAt())
      }
      reader.advance()
      return { kind: 'element', tag, attributes, children, line }
    }
    if (reader.peek('<')) {
      children.push(parseElement(reader))
      continue
    }
    if (reader.peek('{')) {
      const childLine = reader.lineAt()
      const raw = reader.balancedExpression()
      const body = expressionBody(raw)
      if (isCommentOnly(body)) continue
      const text = literalString(body)
      children.push(
        text !== null
          ? { kind: 'text', value: text, line: childLine }
          : { kind: 'expression', raw, line: childLine },
      )
      continue
    }
    const textLine = reader.lineAt()
    const start = reader.pos
    while (!reader.done && !reader.peek('<') && !reader.peek('{')) {
      reader.advance()
    }
    const value = cleanJsxText(decodeEntities(reader.slice(start)))
    if (value) children.push({ kind: 'text', value, line: textLine })
  }
}

function expectWord(reader: Reader, word: string, message: string): void {
  reader.skipSpace()
  const line = reader.lineAt()
  if (reader.word() !== word) throw new UnsupportedCode(message, line)
}

function expectText(reader: Reader, text: string, message: string): void {
  reader.skipSpace()
  if (!reader.peek(text)) throw new UnsupportedCode(message, reader.lineAt())
  reader.advance(text.length)
}

function optionalText(reader: Reader, text: string): void {
  reader.skipSpace()
  if (reader.peek(text)) reader.advance(text.length)
}

function parseImports(reader: Reader): JsxImport[] {
  const imports: JsxImport[] = []
  for (;;) {
    reader.skipSpace()
    if (!reader.peek('import')) return imports
    const line = reader.lineAt()
    const statement = reader.match(
      /import\s+(?:([A-Za-z_$][\w$]*)\s+from\s+)?(['"])([^'"]+)\2\s*;?/y,
    )
    const found = statement?.match(
      /^import\s+(?:([A-Za-z_$][\w$]*)\s+from\s+)?(['"])([^'"]+)\2/,
    )
    if (!found) {
      throw new UnsupportedCode(
        'Only simple imports like the generated ones are supported yet.',
        line,
      )
    }
    imports.push({ name: found[1] ?? null, from: found[3] ?? '', line })
  }
}

function parseFile(source: string): ParsedComponentFile {
  const reader = new Reader(source)
  const imports = parseImports(reader)

  reader.skipSpace()
  const exportedInline = reader.peek('export')
  if (exportedInline) {
    expectWord(reader, 'export', 'Expected a component function.')
    expectWord(reader, 'default', 'Expected `export default function`.')
  }
  expectWord(
    reader,
    'function',
    'Only the component function is supported here yet (no variables, types or other code).',
  )
  reader.skipSpace()
  const nameLine = reader.lineAt()
  const name = reader.word()
  if (!name) throw new UnsupportedCode('Expected a component name.', nameLine)
  expectText(reader, '(', 'Expected `(` after the component name.')
  reader.skipSpace()
  if (!reader.peek(')')) {
    throw new UnsupportedCode(
      'Component props are not supported yet.',
      reader.lineAt(),
    )
  }
  reader.advance()
  expectText(reader, '{', 'Expected `{` to start the component.')
  reader.skipSpace()
  const bodyLine = reader.lineAt()
  if (reader.word() !== 'return') {
    throw new UnsupportedCode(
      'Code before `return` (hooks, variables, functions) is not supported yet.',
      bodyLine,
    )
  }
  reader.skipSpace()
  const wrapped = reader.peek('(')
  if (wrapped) reader.advance()
  reader.skipSpace()
  if (!reader.peek('<')) {
    throw new UnsupportedCode(
      'The component must return JSX directly.',
      reader.lineAt(),
    )
  }
  const root = parseElement(reader)
  if (wrapped) expectText(reader, ')', 'Expected `)` after the returned JSX.')
  optionalText(reader, ';')
  expectText(reader, '}', 'Code after `return` is not supported yet.')

  if (!exportedInline) {
    expectWord(reader, 'export', 'Expected `export default` for the component.')
    expectWord(
      reader,
      'default',
      'Expected `export default` for the component.',
    )
    reader.skipSpace()
    const exportLine = reader.lineAt()
    if (reader.word() !== name) {
      throw new UnsupportedCode(
        `The file must export ${name} as default.`,
        exportLine,
      )
    }
    optionalText(reader, ';')
  }
  reader.skipSpace()
  if (!reader.done) {
    throw new UnsupportedCode(
      'Extra code after the component is not supported yet.',
      reader.lineAt(),
    )
  }
  return { imports, name, root }
}

/** Reads a generated-shape component file, or says why it cannot. */
export function parseComponentFile(source: string): ParseResult {
  try {
    return { ok: true, file: parseFile(source) }
  } catch (error) {
    if (error instanceof UnsupportedCode) {
      return { ok: false, issue: { message: error.message, line: error.line } }
    }
    throw error
  }
}
