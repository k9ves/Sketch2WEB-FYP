# Code editing and code-to-canvas sync (T57, T57b)

The code panel shows the project generated from the component tree. The
tree stays the only source of the canvas: code edits reach the canvas only
by being turned into tree updates.

## What syncs to the canvas

When you stop typing (about 0.8 s), the edited file is checked
(`src/codegen/syncCode.ts`). If it still has the generated shape, these
edits update the canvas as **one undo step**:

- text of headings, text and buttons
- style tokens in `className` that the Properties panel offers for that
  component
- button `href`, image `src` and `alt`
- heading level (`<h1>` … `<h6>`)
- the website background class in `App.tsx`

Changing a section's first heading also renames its file (e.g.
`WhatWeDo.tsx` → `OurServices.tsx`); the open tab follows it.

## Not supported yet

Everything else shows a bar with the reason and line, and the line is
underlined in the editor:

- hooks, variables or other code before `return`, imports in components
- event handlers and other new attributes (`onClick`, `id`, …)
- JavaScript in text or attributes (`{count}`)
- new tags (`<video>`), tags inside text (`<strong>`)
- adding, removing or reordering elements or sections
- layout styles (`style={{ … }}`); use the Layout controls
- classes the Properties panel does not offer (e.g. `mt-7`)

The bar offers **Undo my change** (back to the last synced code) or
**Keep as code only**.

## Code-only files are never lost silently

A file is in one of three states (`src/store/customCodeStore.ts`):

| State     | Meaning                                                                        | Can it be replaced automatically?              |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| synced    | everything in it is on the canvas                                              | yes: it is regenerated when the canvas changes |
| pending   | not synced yet (typing, or waiting for you)                                    | no                                             |
| code only | you chose **Keep as code only**, or not a canvas file (CSS, `package.json`, …) | no                                             |

Only your own action replaces a pending or code-only file: **Undo my
change**, **Reset to generated** or **Delete file**.

- If the canvas changes after a code-only edit, the edit is kept and the bar
  says the canvas changed since. **Sync again** checks it once more.
- If a section is renamed or removed while its file has code-only changes,
  the file stays as a "(not generated)" tab and is exported as an extra
  file.
- Opening another template, sample or project asks first when code-only
  changes exist; Cancel keeps everything.
- The browser warns before a reload or close while code-only changes exist.

## Limits

- **Session only.** Edits live in memory while the editor is open; they are
  not saved in the project file (`.json`), which stores the tree only.
- **One way for logic.** Code with added logic (state, fetch, login, …) stays
  code; it cannot become canvas components.
- **Syntax checks only.** The editor cannot check imports or types; run
  `npm run build` in the exported project for that.
