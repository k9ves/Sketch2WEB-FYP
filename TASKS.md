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

## M1 — Schema and samples (Week 1-2, with Noor)

- [ ] **T7** Write `src/schema/types.ts` (ComponentNode, ComponentType). — _Done when:_ no TS errors.
- [ ] **T8** Make `samples/landing.json` (navbar, hero, 3 cards, footer). — _Done when:_ file validates against the types.
- [ ] **T9** Make `samples/portfolio.json` and `samples/blog.json`. — _Done when:_ 3 samples exist.
- [ ] **T10** Review schema with Noor, freeze **v1** (add `version` field). — _Done when:_ Noor agrees, tagged `schema-v1` in git.

## M2 — Renderer (Week 2-3)

- [ ] **T11** Basic `Renderer.tsx` (heading, text, button, image). — _Done when:_ small JSON shows on screen.
- [ ] **T12** Layout components: section, columns (grid/flex from `layout`). — _Done when:_ 3 columns appear side by side.
- [ ] **T13** Navbar and footer components. — _Done when:_ landing sample's top and bottom render.
- [ ] **T14** Hero and card components. — _Done when:_ hero + 3 cards render.
- [ ] **T15** Safe fallback for unknown type or missing field. — _Done when:_ broken JSON shows a warning box, no crash.
- [ ] **T16** Show all 3 samples with a dropdown switch. — _Done when:_ switching changes the page. **(Milestone: Renderer complete)**

## M3 — Store and selection (Week 3)

- [ ] **T17** Zustand store: `website`, `selectedId`. — _Done when:_ App reads tree from store.
- [ ] **T18** Helper `findNode(tree, id)` and `updateTree` (immutable). — _Done when:_ tested in console.
- [ ] **T19** Actions: `selectNode`, `updateNode`. — _Done when:_ updating text in store changes screen.
- [ ] **T20** Actions: `addNode`, `removeNode`. — _Done when:_ works from a temporary test button.
- [ ] **T21** Action: `moveNode(id, newParentId, index)`. — _Done when:_ node moves between parents.
- [ ] **T22** Click a component to select it, show blue outline. — _Done when:_ click selects, click outside clears. **(Milestone: Selectable canvas)**

## M4 — Editor layout (Week 4)

- [ ] **T23** Three-panel layout: left (components/tree), center (canvas), right (properties). — _Done when:_ panels visible and responsive.
- [ ] **T24** Top toolbar (title, Preview, Code, Export buttons, no logic yet). — _Done when:_ buttons visible.
- [ ] **T25** Left panel: list of addable components (palette). — _Done when:_ list shows all types.
- [ ] **T26** "Add" button inserts selected palette item into selected container. — _Done when:_ new heading appears.
- [ ] **T27** Delete selected (Delete key and button). — _Done when:_ component disappears.
- [ ] **T28** Duplicate selected (new unique IDs). — _Done when:_ copy appears below original.
- [ ] **T29** Inline text edit (double-click). — _Done when:_ text changes and saves in store.
- [ ] **T30** Undo / Redo (history stack in store). — _Done when:_ Ctrl+Z / Ctrl+Y work. **(Milestone: Basic editor)**

## M5 — Drag and drop (Week 5-6)

- [ ] **T31** dnd-kit setup, drag palette item onto canvas. — _Done when:_ drop adds the component.
- [ ] **T32** Drop zones highlight while dragging. — _Done when:_ visible indicator.
- [ ] **T33** Reorder siblings by dragging. — _Done when:_ order changes in store.
- [ ] **T34** Move component into another container. — _Done when:_ a card moves into another section.
- [ ] **T35** Drag overlay, cancel with Esc, no crash on bad drop. — _Done when:_ smooth feel. **(Milestone: Drag and drop)**

## M6 — Properties and tree (Week 6-7, coordinate with Noor)

- [ ] **T36** Agree split with Noor: he builds Tree and Property panels, you provide store API. — _Done when:_ written in a short doc.
- [ ] **T37** Right panel (or Noor's panel plugged in): edit content fields. — _Done when:_ text/src/href editable.
- [ ] **T38** Edit style: color, font size, padding, background (Tailwind tokens). — _Done when:_ canvas updates live.
- [ ] **T39** Edit layout: columns count, gap, alignment. — _Done when:_ grid changes live.
- [ ] **T40** Hierarchy tree panel with select and expand/collapse. — _Done when:_ clicking tree selects on canvas. **(Milestone: Full visual editor)**

## M7 — Preview and responsive (Week 7)

- [ ] **T41** Preview mode (no outlines, no editing). — _Done when:_ toggle works.
- [ ] **T42** Device switch: desktop / tablet / mobile width. — _Done when:_ canvas width changes.
- [ ] **T43** Responsive classes in renderer (`md:`, `lg:` support). — _Done when:_ columns stack on mobile.

## M8 — Template input (Week 8)

- [ ] **T44** Templates folder (5 templates as JSON). — _Done when:_ 5 valid files.
- [ ] **T45** Start screen: choose Template / Sketch / Prompt. — _Done when:_ 3 cards shown (Sketch and Prompt disabled for now).
- [ ] **T46** Template gallery with preview thumbnails. — _Done when:_ click opens template in editor.
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

## M11 — Sketch input (Week 12-16)

- [ ] **T59** Collect 20-30 sample sketches (photos of hand-drawn UIs). — _Done when:_ folder with images.
- [ ] **T60** Sketch upload UI (image picker and preview). — _Done when:_ image shows on screen.
- [ ] **T61** Choose approach (existing vision model/API) with Asim, test on 5 sketches. — _Done when:_ returns element list.
- [ ] **T62** Convert detected elements to ComponentNode JSON (mapping function). — _Done when:_ sketch gives valid JSON.
- [ ] **T63** Layout ordering (top-to-bottom, columns by x-position). — _Done when:_ order matches sketch.
- [ ] **T64** Show result in editor, allow fixing wrong detections. — _Done when:_ full flow Sketch → Editor works. **(Milestone: Sketch input)**

## M12 — AI integration hooks (Week 14-18, with Noor)

- [ ] **T65** Define API contract with Noor: request/response JSON. — _Done when:_ written and agreed.
- [ ] **T66** Prompt box UI, calls a mock endpoint returning sample JSON. — _Done when:_ prompt gives a website.
- [ ] **T67** Validate AI JSON against schema, show friendly error if invalid. — _Done when:_ bad JSON never crashes.
- [ ] **T68** Component-level AI edit: select component → instruction box → replace only that node. — _Done when:_ other components unchanged.
- [ ] **T69** Connect to Noor's real model API. — _Done when:_ real prompt works.

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
