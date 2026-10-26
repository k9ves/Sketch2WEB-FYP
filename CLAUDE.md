# Sketch2Web

Sketch2Web is a React + TypeScript visual website builder. Users will start from
a template, a hand-drawn sketch, or a natural-language prompt. All inputs must
be represented by the shared component tree; AI integrations return structured
component data, never raw HTML or CSS.

## Project conventions

- Keep the existing stack: React, TypeScript, Vite, Tailwind CSS, Zustand,
  dnd-kit, and Monaco Editor.
- Keep the shared schema in `src/schema/types.ts`. Coordinate schema changes
  with the team before making them.
- Render and generate code from the shared component model; do not store a
  separate UI structure.
- Use strict, typed TypeScript without `any`, functional React components, and
  immutable store updates.
- Keep changes small and within the visual builder, renderer, sketch input,
  source-code generation, and preview/export scope.
- Do not train ML models or add backend, authentication, or database features.
- Before creating or deleting many files, explain the plan and wait for
  approval. For significant schema or behavior decisions, ask first.
- After each small step, explain briefly why it was needed and what to run or
  check next.
- Use English for code, comments, and filenames. Reply to the developer in
  simple Roman Urdu.

## Validation

Run `npm run build`, `npm run lint`, and `npm run format:check` for relevant
changes. Use `npm run dev` to check the app in a browser.
