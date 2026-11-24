import { useEffect, useState } from 'react'
import {
  applyTheme,
  readThemeChoice,
  saveThemeChoice,
  themeChoices,
} from '../theme'
import type { ThemeChoice } from '../theme'

const choiceLabels: Record<ThemeChoice, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
}

/** Toolbar select for the editor theme: system (default), light or dark. */
function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice)

  useEffect(() => applyTheme(choice), [choice])

  function change(next: ThemeChoice) {
    saveThemeChoice(next)
    setChoice(next)
  }

  return (
    <label className="sample-picker theme-picker">
      <span>Theme</span>
      <select
        value={choice}
        onChange={(event) => {
          const next = themeChoices.find(
            (option) => option === event.target.value,
          )
          if (next) change(next)
        }}
      >
        {themeChoices.map((option) => (
          <option key={option} value={option}>
            {choiceLabels[option]}
          </option>
        ))}
      </select>
    </label>
  )
}

export default ThemePicker
