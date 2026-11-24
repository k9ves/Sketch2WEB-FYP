// Editor colour theme. The choice is kept in localStorage; "system" follows
// the operating system setting and is the default. index.html repeats the
// startup part inline so the right theme shows before React loads.

export const themeChoices = ['system', 'light', 'dark'] as const

export type ThemeChoice = (typeof themeChoices)[number]

const STORAGE_KEY = 'sketch2web-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    typeof value === 'string' &&
    (themeChoices as readonly string[]).includes(value)
  )
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemeChoice(stored) ? stored : 'system'
  } catch {
    // Storage can be blocked (e.g. privacy settings); use the default.
    return 'system'
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Not saved; the choice still applies until the page reloads.
  }
}

function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Applies the choice to <html data-theme>. For "system" it also follows
 * later OS changes; the returned function stops that.
 */
export function applyTheme(choice: ThemeChoice): () => void {
  const root = document.documentElement
  root.dataset.theme = resolveTheme(choice)
  if (choice !== 'system') return () => {}

  const query = window.matchMedia(DARK_QUERY)
  const update = () => {
    root.dataset.theme = query.matches ? 'dark' : 'light'
  }
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}
