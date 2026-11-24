# Sketch2Web — Bilal's Task Checklist

Rules: do tasks **in order**. One task at a time. Tick `[x]` only when "Done when" is true.
Commit after every task (`feat: T12 card renderer`). Each milestone ends with a working app.

---

## M0 — Setup (Week 1)

- [x] **T1** Open project in VS Code, `npm run dev` works. — _Done when:_ default Vite page opens at localhost:5173.
- [x] **T2** Install deps: zustand, dnd-kit, monaco, tailwind. — _Done when:_ `npm run build` passes.
- [x] **T3** Tailwind working. — _Done when:_ a `className="text-red-500"` text shows red.
- [x] **T4** Create folders: schema, renderer, components, store, editor, codegen, sketch. — _Done when:_ folders exist in `src/`.
- [x] **T5** Add `CLAUDE.md` and this `TASKS.md` to project root. — _Done when:_ Claude reads and summarizes them.
- [ ] **T6** Push to GitHub, add Asim and Noor, create `dev` branch. — _Done when:_ teammates can clone.

## M1 — Schema and samples (Week 1-2)

- [x] **T7** Write `src/schema/types.ts` (ComponentNode, ComponentType). — _Done when:_ no TS errors.
- [x] **T8** Make `samples/landing.json` (navbar, hero, 3 cards, footer). — _Done when:_ file validates against the types.
- [x] **T9** Make `samples/portfolio.json` and `samples/blog.json`. — _Done when:_ 3 samples exist.
- [x] **T10** Review schema internally and freeze **v1** (add `version` field). — _Done when:_ schema is reviewed and tagged `schema-v1` in git.

## M2 — Renderer (Week 2-3)

- [x] **T11** Basic `Renderer.tsx` (heading, text, button, image). — _Done when:_ small JSON shows on screen.
- [x] **T12** Layout components: section, columns (grid/flex from `layout`). — _Done when:_ 3 columns appear side by side.
- [x] **T13** Navbar and footer components. — _Done when:_ landing sample's top and bottom render.
- [x] **T14** Hero and card components. — _Done when:_ hero + 3 cards render.
- [x] **T15** Safe fallback for unknown type or missing field. — _Done when:_ broken JSON shows a warning box, no crash.
- [x] **T16** Show all 3 samples with a dropdown switch. — _Done when:_ switching changes the page. **(Milestone: Renderer complete)**

## M3 — Store and selection (Week 3)

- [x] **T17** Zustand store: `website`, `selectedId`. — _Done when:_ App reads tree from store.
- [x] **T18** Helper `findNode(tree, id)` and `updateTree` (immutable). — _Done when:_ tested in console.
- [x] **T19** Actions: `selectNode`, `updateNode`. — _Done when:_ updating text in store changes screen.
- [x] **T20** Actions: `addNode`, `removeNode`. — _Done when:_ works from a temporary test button.
- [x] **T21** Action: `moveNode(id, newParentId, index)`. — _Done when:_ node moves between parents.
- [x] **T22** Click a component to select it, show blue outline. — _Done when:_ click selects, click outside clears. **(Milestone: Selectable canvas)**

## M4 — Editor layout (Week 4)

- [x] **T23** Three-panel layout: left (components/tree), center (canvas), right (properties). — _Done when:_ panels visible and responsive.
- [x] **T24** Top toolbar (title, Preview, Code, Export buttons, no logic yet). — _Done when:_ buttons visible.
- [x] **T25** Left panel: list of addable components (palette). — _Done when:_ list shows all types.
- [x] **T26** "Add" button inserts selected palette item into selected container. — _Done when:_ new heading appears.
- [x] **T27** Delete selected (Delete key and button). — _Done when:_ component disappears.
- [x] **T28** Duplicate selected (new unique IDs). — _Done when:_ copy appears below original.
- [x] **T29** Inline text edit (double-click). — _Done when:_ text changes and saves in store.
- [x] **T30** Undo / Redo (history stack in store). — _Done when:_ Ctrl+Z / Ctrl+Y work. **(Milestone: Basic editor)**

## M5 — Drag and drop (Week 5-6)

- [x] **T31** dnd-kit setup, drag palette item onto canvas. — _Done when:_ drop adds the component.
- [x] **T32** Drop zones highlight while dragging. — _Done when:_ visible indicator.
- [x] **T33** Reorder siblings by dragging. — _Done when:_ order changes in store.
- [x] **T34** Move component into another container. — _Done when:_ a card moves into another section.
- [x] **T35** Drag overlay, cancel with Esc, no crash on bad drop. — _Done when:_ smooth feel. **(Milestone: Drag and drop)**

## M6 — Properties and tree (Week 6-7)

- [x] **T36** Define the Tree/Property panel and store API responsibilities. — _Done when:_ written in a short doc.
- [x] **T37** Build the right panel to edit content fields. — _Done when:_ text/src/href editable.
- [x] **T38** Edit style: color, font size, padding, background (Tailwind tokens). — _Done when:_ canvas updates live.
- [x] **T39** Edit layout: columns count, gap, alignment. — _Done when:_ grid changes live.
- [x] **T40** Hierarchy tree panel with select and expand/collapse. — _Done when:_ clicking tree selects on canvas. **(Milestone: Full visual editor)**

## M7 — Preview and responsive (Week 7)

- [x] **T41** Preview mode (no outlines, no editing). — _Done when:_ toggle works.
- [x] **T42** Device switch: desktop / tablet / mobile width. — _Done when:_ canvas width changes.
- [x] **T43** Responsive classes in renderer (`md:`, `lg:` support). — _Done when:_ columns stack on mobile.

## M8 — Template input (Week 8)

- [x] **T44** Templates folder (5 templates as JSON). — _Done when:_ 5 valid files.
- [x] **T45** Start screen: choose Template / Sketch. — _Done when:_ 2 cards shown (Sketch disabled for now).
- [x] **T46** Template gallery with preview thumbnails. — _Done when:_ click opens template in editor.
- [ ] **T47** Save/load project as JSON (download and upload). — _Done when:_ reload restores same website. **(Milestone: First end-to-end, Template → Editor)**

## M9 — Code generator (Week 8-11)

- [ ] **T48** Generator for one node: heading/text/button → JSX string. — _Done when:_ correct string output.
- [ ] **T49** Recursive generator for whole tree. — _Done when:_ landing sample gives full JSX.
- [ ] **T50** Wrap into `App.tsx` with imports. — _Done when:_ output is valid TSX.
- [ ] **T51** Split into component files (Navbar.tsx, Hero.tsx...). — _Done when:_ multiple files generated.
- [ ] **T52** Format output (Prettier in browser). — _Done when:_ code is neatly indented.
- [ ] **T53** Generated project runs on its own (test in a fresh Vite project). — _Done when:_ `npm run dev` shows same website.
- [ ] **T54** Escape special characters and handle missing fields. — _Done when:_ weird text does not break code.

## M10 — Code view and export (Week 11-12)

- [ ] **T55** Monaco panel showing generated code (read-only). — _Done when:_ "Code" button opens it.
- [ ] **T56** File tabs in Monaco for multiple files. — _Done when:_ switch between files.
- [ ] **T57** Allow editing code (keep as separate "custom code" copy, document limits). — _Done when:_ edits persist in session.
- [ ] **T58** Export as ZIP (full runnable project). — _Done when:_ ZIP downloads and runs. **(Milestone: Preview, code and export complete)**

**Remember for M9–M10 (export notes):**

- **Responsive columns:** the canvas stacks columns below 640px through `@container sw-page` (`App.css`). Generated code must give the same result with Tailwind classes, e.g. `grid-cols-1 sm:grid-cols-3`.
- **The export is frontend only.** Users connect a backend themselves, so make that easy:
  - Add `.env.example` with `VITE_API_URL=` and an empty `src/api.ts` starter (a `fetch` helper reading `import.meta.env.VITE_API_URL`).
  - Add a `README.md` to the export: how to connect their own API (env, CORS, deploy frontend and backend separately), or a service such as Supabase/Firebase (data, login), Formspree (forms) or Stripe Payment Links.
  - Warn in the README: `VITE_*` variables are public in the browser. Secret keys belong in the backend only.
  - Give components clear ids/class names so developers find their place in the exported code.
- **Export is one-way.** Code with added logic (fetch, state, login) cannot be imported back into the editor. Document this limit in T57.
- **Forms (later):** an "action URL" field (e.g. Formspree) would let forms submit without any backend.

## M11 — Sketch input (Week 12-16)

- [ ] **T59** Collect 20-30 sample sketches (photos of hand-drawn UIs). — _Done when:_ folder with images.
- [ ] **T60** Sketch upload UI (image picker and preview). — _Done when:_ image shows on screen.
- [ ] **T61** Choose approach (existing vision model/API) with Asim, test on 5 sketches. — _Done when:_ returns element list.
- [ ] **T62** Convert detected elements to ComponentNode JSON (mapping function). — _Done when:_ sketch gives valid JSON.
- [ ] **T63** Layout ordering (top-to-bottom, columns by x-position). — _Done when:_ order matches sketch.
- [ ] **T64** Show result in editor, allow fixing wrong detections. — _Done when:_ full flow Sketch → Editor works. **(Milestone: Sketch input)**

## M12 — AI Component Recommendation System (Week 14-18)

- [ ] **T65** Define the recommendation criteria and API contract (request/response JSON). — _Done when:_ the system's inputs, outputs, and recommendation rules are documented and reviewed.
- [ ] **T66** Prepare a component recommendation dataset or knowledge base using the available component library. — _Done when:_ components have clear names, categories, descriptions, and suitable-use information.
- [ ] **T67** Build the recommendation logic to analyze the selected component or current website section and suggest relevant components. — _Done when:_ the system returns suitable component recommendations for sample cases.
- [ ] **T68** Create the recommendation panel in the editor and allow users to add a suggested component to the canvas. — _Done when:_ selecting a recommendation inserts the correct component into the website.
- [ ] **T69** Test and refine recommendation relevance, schema validation, and error handling. — _Done when:_ recommendations are relevant, valid, and failures do not crash the editor. **(Milestone: AI component recommendation complete)**

## M13 — Polish, testing, docs (Week 19-24)

- [ ] **T70** Loading states, error messages, empty states. — _Done when:_ no blank or frozen screens.
- [ ] **T71** UI cleanup: spacing, icons, consistent colors, keyboard shortcuts. — _Done when:_ demo looks clean.
- [ ] **T72** Test checklist: all 3 inputs, edit, undo, export on 3 browsers. — _Done when:_ bugs logged and fixed.
- [ ] **T73** Basic unit tests for store and code generator. — _Done when:_ tests pass.
- [ ] **T74** Write your sections of the report (renderer, editor, sketch, codegen) with screenshots. — _Done when:_ draft sent to Asim.
- [ ] **T75** Demo script and recorded demo video. — _Done when:_ 5-minute demo runs without errors.

---

## Weekly habit

- Monday: pick this week's tasks. Friday: sync with team, update this file, merge to `dev`.
- If a task takes more than a day, split it into smaller ones.
