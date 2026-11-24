# T36 — Properties panel, Tree panel and store API

Scope: the design for M6 (T37–T40). It says what each panel owns, which
fields it edits, and which store actions it calls. No schema change is
needed: everything uses the existing `content`, `style` and `layout` records.

## 1. Who owns what

| Part                          | Owns                                                                                                 | Never does                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Store** (`websiteStore.ts`) | The website tree, `selectedId`, undo/redo history. Validates every change.                           | Know about panels or the DOM.                   |
| **Properties panel** (right)  | Editing the selected node's `content` (T37), `style` (T38) and `layout` (T39); Duplicate and Delete. | Change the tree structure or a node's position. |
| **Tree panel** (left)         | Showing the hierarchy, expand/collapse, selecting a node (T40).                                      | Edit fields.                                    |
| **Canvas** (`freeform/`)      | Rendering, drag and drop, inline text editing, freeform positions (`layout.x/y/width/height`).       | Show form controls.                             |

Rules for all panels:

- Read from the store with selectors and change it only through store
  actions. Never mutate a node object.
- One committed edit is one undo step (see §4).
- Selection is shared: clicking a node on the canvas or in the tree calls
  `selectNode(id)`. Both panels and the canvas follow `selectedId`.
- With nothing selected, the Properties panel shows the website settings
  (site title, page background).

## 2. Properties panel fields

### Content (T37)

Fields come from `Renderer.tsx` and are the same for every node of a type.

| Type                                                     | Fields                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `heading`                                                | `text`, `level` (1–6)                                   |
| `text`                                                   | `text`                                                  |
| `button` (also navbar brand/links)                       | `text`, `href` (must pass `safeHref`)                   |
| `image` (also a navbar logo)                             | `src`, `alt` (both required, else a warning is shown)   |
| `website`                                                | `title`                                                 |
| `navbar`, `hero`, `section`, `columns`, `card`, `footer` | none. Their text lives in child heading/text/link nodes |

`safeHref` moves from `Renderer.tsx` to a shared helper so the panel can
show "unsafe link" before saving.

### Style (T38)

Each type renders exactly one style slot, which holds space-separated classes:

| Slot         | Types                                                    |
| ------------ | -------------------------------------------------------- |
| `background` | `website`                                                |
| `container`  | `navbar`, `hero`, `section`, `columns`, `card`, `footer` |
| `text`       | `heading`, `text`                                        |
| `button`     | `button`                                                 |
| `image`      | `image`                                                  |

A slot can already hold our own classes, e.g. `sw-hero-title`. The panel must
keep them. It only swaps the Tailwind token of the group it edits (text color,
font size, padding, background), through one helper in a new
`src/editor/styleTokens.ts`:

```ts
setStyleToken(slotValue: string, group: StyleGroup, token: string | null): string
```

Two things must be fixed before T38 can work. Both were checked in the
browser:

1. **App.css beats Tailwind.** Tailwind v4 puts utilities in
   `@layer utilities`, while `App.css` has no layer, and un-layered CSS always
   wins. Test: adding `bg-white` to a card left its background `#fbfaff`.
   Fix: move the `sw-*` component rules in `App.css` into
   `@layer components`.
2. **Tailwind only builds classes it finds in the source.** A class put
   together at runtime (`'text-' + size`) is never generated. Every token the
   panel offers must be written out in full in `styleTokens.ts` (a fixed list
   per group).

### Layout (T39)

Read by `resolveLayout()` and `layoutStyle()` in `src/renderer/layout.ts`.
The panel uses the same resolver, so it always shows the value the canvas
renders (e.g. 2 columns when `columns` is not set).

| Key         | Values                                                            | Types         |
| ----------- | ----------------------------------------------------------------- | ------------- |
| `display`   | `grid` \| `flex`                                                  | columns       |
| `columns`   | 1–6 (default 2)                                                   | columns       |
| `gap`       | 0–32 (× 0.25rem, default 4)                                       | columns, hero |
| `direction` | `row` \| `column` (hero default: `column`)                        | columns, hero |
| `align`     | `start` \| `center` \| `end`                                      | columns, hero |
| `justify`   | `start` \| `center` \| `end` \| `between` \| `around` \| `evenly` | columns, hero |

`stretch` is not offered: stretched wrappers caused hidden drop blockers, so
an old `stretch` value is read as `start`. In a grid, `justify` aligns leaf
components inside their cell; containers keep the full cell width.

Freeform keys (`x`, `y`, `width`, `height`) belong to the canvas. The panel
shows "Free position" or "In flow" and offers two actions:

An Alt move pins the old neighbours in place and marks them
`pinned: 'true'`. `children` keeps the original flow order the whole time.
The moved node remembers its flow place in `flowParent` / `flowIndex`, even
when it was dropped into another container.

- **Return to flow** on a positioned node: `returnToFlow(id)`. The node goes
  back to its `flowParent` at `flowIndex`, and its `pinned` neighbours
  return to their original places. Nodes the user placed with Alt stay free.
- **Return all to flow** on a container (or the website root) with
  positioned children: `returnChildrenToFlow(id)`. Children from another
  container go home first; the rest return in the original order.
- Both are one undo step and drop the container's pinned `height` once no
  child is positioned.
- A node in flow inside a free container shows a hint with a button that
  selects that container.

**Resizing** (handles on the selected component) stores `boxWidth` /
`boxHeight` in px; height is a minimum, so text never clips. The panel
shows the size and offers **Reset size**, which clears both keys.

## 3. Tree panel (T40)

- Renders `website.children` recursively: type label plus a short text
  preview (`content.text`, otherwise the type name).
- Expand/collapse state is local React state in the panel. It is not saved
  in the store or in history.
- Clicking a row calls `selectNode(id)`. When the selection changes, the tree
  expands the ancestors of the selected node, using a new pure helper
  `findPath(tree, id)` in `tree.ts`, and the canvas scrolls that node into
  view.
- Positioned (Alt-placed) nodes get a small "free" badge.
- Reordering by dragging inside the tree is not part of T40. Reordering
  stays on the canvas.

## 4. Store API

Existing actions, used as they are:

| Action                                       | Used by                                  |
| -------------------------------------------- | ---------------------------------------- |
| `selectNode(id \| null)`                     | canvas, tree                             |
| `updateNode(id, { content, style, layout })` | Properties panel (merges, one undo step) |
| `duplicateNode`, `removeNode`                | Properties panel buttons, Delete key     |
| `placeNode(id, parent, index, position)`     | canvas DnD; panel's "Return to flow"     |
| `addNode`, `moveNode`, `setLayouts`          | canvas only                              |
| `undo`, `redo`                               | Ctrl+Z / Ctrl+Y                          |

Changes made:

1. **No `remove` option was needed.** Style "Default" choices write the slot
   without the token (an empty slot renders nothing), and layout controls
   always write a real value shown by `resolveLayout`.
2. **`returnToFlow(id)`** and **`returnChildrenToFlow(containerId)`** clear
   `x`, `y`, `width`, `pinned`, `flowParent` and `flowIndex` (see Layout
   in §2).
3. **One undo step per edit.** Text inputs keep a local draft and call
   `updateNode` on blur or Enter (the same as inline editing), not on every
   keystroke. Selects, toggles and token pickers commit right away.
4. **`findPath(tree, id)`** in `tree.ts` for the tree panel (pure, tested).

Keyboard: shortcuts (Delete, Ctrl+Z) are already ignored while focus is in
an input, through `isEditableTarget` in `App.tsx`, so panel inputs are safe.

## 5. New files (T37–T40)

- `src/editor/properties/PropertiesPanel.tsx`, plus `ContentFields`,
  `StyleFields`, `LayoutFields`
- `src/editor/styleTokens.ts`: token lists and `setStyleToken`
- `src/editor/tree/TreePanel.tsx`
- `src/renderer/layout.ts` and `src/renderer/safeHref.ts`: shared by the
  renderer and the panel
- Small edits: `websiteStore.ts` (`returnToFlow`, `returnChildrenToFlow`),
  `positionedLayout.ts` (`pinned`), `tree.ts` (`findPath`), `App.tsx`
  (panel slots), `App.css` (`@layer components`)

## 6. Decisions

1. **Token set (T38).** A small fixed list per group, written out in full in
   `styleTokens.ts`. Each group also has a "Default" choice that removes the
   token.
   - Text color: `text-slate-900`, `text-slate-600`, `text-white`,
     `text-indigo-600`, `text-emerald-600`, `text-rose-600`
   - Font size: `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`,
     `text-3xl`, `text-4xl`, `text-5xl`
   - Padding: `p-0`, `p-2`, `p-4`, `p-6`, `p-8`, `p-12`, `p-16`
   - Background: `bg-white`, `bg-slate-50`, `bg-slate-100`, `bg-slate-900`,
     `bg-indigo-50`, `bg-indigo-600`, `bg-emerald-50`, `bg-rose-50`

   **Extended for the templates (T44):** text colors `text-slate-400`,
   `text-amber-600`, `text-sky-600`; font sizes `text-xs`, `text-6xl`;
   backgrounds `bg-slate-800`, `bg-amber-50`, `bg-amber-500`, `bg-sky-50`,
   `bg-emerald-600`, `bg-rose-600`; and three new groups:
   - Font weight (text, button): `font-normal`, `font-medium`,
     `font-semibold`, `font-bold`, `font-extrabold`
   - Rounded corners (container, button, image): `rounded-none`,
     `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`
   - Shadow (container, button, image): `shadow-none`, `shadow-sm`,
     `shadow-md`, `shadow-lg`, `shadow-xl`

   No text-align group: text components hug their text, so alignment shows
   no effect. Centering uses the hero/columns layout (Align) instead.

2. **Layer move.** The `sw-*` component rules in `App.css` move into
   `@layer components` as the first step of T38. The editor chrome rules
   (panels, toolbar) can stay un-layered.
3. **Tree placement.** The left sidebar gets two tabs, **Components** and
   **Layers**. The palette stays in Components and the tree panel goes in
   Layers, so no feature loses space.
