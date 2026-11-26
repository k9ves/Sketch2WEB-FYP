# Custom code (T57)

The code panel shows the project generated from the component tree. Files
can be edited there. An edited file is kept as a separate **custom copy**
(`src/store/customCodeStore.ts`); the component tree stays the only source of
the canvas.

## How it works

- Typing in a file saves the edit for that file path. The tab shows `●`.
- The edited version replaces the generated file in the export
  (`withCustomCode`, used by the ZIP export in T58).
- **Reset to generated** removes the custom copy. Editing a file back to
  exactly the generated code does the same.
- If the canvas changes after a file was edited, the edit is kept and a
  warning says the canvas changed since. Reset the file to pick up the
  canvas changes.

## Limits

- **One way only.** Code edits never change the canvas, and code with added
  logic (state, fetch, login, ...) cannot be imported back into the editor.
- **Session only.** Edits are kept in memory while the editor is open:
  closing the code view, switching tabs or using Preview keeps them. A page
  reload, or opening another template, sample or project file, clears them.
- **Not in project files.** Save (`.json`) stores the component tree only,
  not code edits.
- **Renamed files.** Section files are named after their first heading. If
  that heading changes, the file gets a new name and the edit of the old
  file is no longer shown or exported.
- **Syntax checks only.** The editor shows syntax errors but cannot check
  imports or types; run `npm run build` in the exported project for that.
