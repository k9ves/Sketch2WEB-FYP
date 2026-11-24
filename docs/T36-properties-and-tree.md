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

Read by `layoutStyle()` in `Renderer.tsx`:

| Key         | Values                                                            | Types         |
| ----------- | ----------------------------------------------------------------- | ------------- |
| `display`   | `grid` \| `flex`                                                  | columns       |
| `columns`   | 1–6                                                               | columns       |
| `gap`       | 0–32 (× 0.25rem)                                                  | columns, hero |
| `direction` | `row` \| `column` (hero default: `column`)                        | columns, hero |
| `align`     | `start` \| `center` \| `end` \| `stretch`                         | columns, hero |
| `justify`   | `start` \| `center` \| `end` \| `between` \| `around` \| `evenly` | columns, hero |

Freeform keys (`x`, `y`, `width`, `height`) belong to the canvas. The panel
shows them read-only ("Free position" or "In flow") and offers one action,
**Return to flow**: `placeNode(id, parentId, index, null)`. Resizing is out of
scope.

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

Changes needed:

1. **Removing a key.** `updateNode` can only merge, so a field cannot go back
   to its default. An empty string is not safe either: `columns: ''` becomes
   1 column. Add an optional `remove` list:
   `updateNode(id, { layout: {...}, remove: { layout: ['direction'] } })`.
   This is backward compatible.
2. **One undo step per edit.** Text inputs keep a local draft and call
   `updateNode` on blur or Enter (the same as inline editing), not on every
   keystroke. Selects, toggles and token pickers commit right away.
3. **`findPath(tree, id)`** in `tree.ts` for the tree panel (pure, tested).

Keyboard: shortcuts (Delete, Ctrl+Z) are already ignored while focus is in
an input, through `isEditableTarget` in `App.tsx`, so panel inputs are safe.

## 5. New files (T37–T40)

- `src/editor/properties/PropertiesPanel.tsx`, plus `ContentFields`,
  `StyleFields`, `LayoutFields`
- `src/editor/styleTokens.ts`: token lists and `setStyleToken`
- `src/editor/tree/TreePanel.tsx`
- Small edits: `websiteStore.ts` (`remove`), `tree.ts` (`findPath`),
  `App.tsx` (panel slots), `App.css` (`@layer components`)

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
2. **Layer move.** The `sw-*` component rules in `App.css` move into
   `@layer components` as the first step of T38. The editor chrome rules
   (panels, toolbar) can stay un-layered.
3. **Tree placement.** The left sidebar gets two tabs, **Components** and
   **Layers**. The palette stays in Components and the tree panel goes in
   Layers, so no feature loses space.
