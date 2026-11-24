/** Returns the trimmed link when it is safe to render, otherwise undefined. */
export function safeHref(value: string): string | undefined {
  const href = value.trim()
  if (
    /^(https?:|mailto:|tel:|#|\/)/i.test(href) ||
    !/^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return href
  }
  return undefined
}
