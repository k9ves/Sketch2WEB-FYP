# Import external website templates (proposal)

Status: **draft for team review**. Nothing here is built yet. It needs a
schema change (§5), so per `CLAUDE.md` the team decides before any code.

## 1. Goal

A user downloads a website template from somewhere else and opens it in
Sketch2Web, then edits it like any other page: select, drag, edit text,
change styles, preview, export. The template may come from HTML5/CSS3,
Bootstrap 5, Tailwind CSS or Next.js.

The project rule stays: **every input becomes the shared component tree**.
We do not keep the template's HTML as a second UI structure. Import is a
one-time conversion from HTML to `ComponentNode`s.

## 2. What can be imported

The browser can only read a template's **final output**: HTML, CSS and
asset files. There is no backend, so nothing is built or run on a server.

| Source               | What the user uploads                                    | Notes                                                                                             |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| HTML5 / CSS3         | `.html` file, or the template folder / `.zip`            | Works as is.                                                                                      |
| Bootstrap 5          | Same                                                     | Bootstrap's CSS is used. Its JavaScript (menu toggle, modal, carousel) does not run.              |
| Tailwind CSS (built) | Same, including the built CSS file                       | Works: the built CSS holds every class the template uses.                                         |
| Tailwind via CDN     | Same                                                     | **Not supported.** The CDN script creates the CSS at runtime, and scripts never run. Show a hint. |
| Next.js              | The static export (`output: 'export'`, `out/` folder)    | The source (`.tsx`, data fetching, server code) cannot be read. Hydration scripts are dropped.    |
| Any live website     | A page saved with the browser's "Save page as, complete" | Often works; the result depends on the site.                                                      |

Not supported in any case: JavaScript behaviour, server features (forms
that submit, logins, APIs), `iframe`/`video` embeds, canvas animations.
The import report (§4, step 8) lists everything that was dropped.

The user is responsible for the template's licence. The import screen
says so.

## 3. Three problems to solve

1. **Structure.** Templates use far more elements than our 11 component
   types (wrapper `div`s, lists, forms, icons). → New generic types (§5).
2. **Styling.** Template classes like `col-md-6` (Bootstrap) or `md:flex`
   (Tailwind) mean nothing to our renderer, and our Tailwind build only
   contains classes written in our own source (see T36 doc, §2). → Keep the
   template's CSS, scoped to the canvas (step 6).
3. **Safety.** Uploaded HTML/CSS is untrusted. → It is parsed inertly and
   never injected as HTML; only our renderer creates DOM (step 4).

## 4. Import pipeline (all in the browser)

1. **Pick files.** A file input for `.html`, a folder (`webkitdirectory`)
   or a `.zip`. Zip needs a library (e.g. JSZip), which T58 "Export as
   ZIP" needs anyway.
2. **Find the entry page.** `index.html`, otherwise ask which HTML file.
3. **Parse** with `DOMParser`. The result is an inert document: scripts do
   not run and images do not load.
4. **Sanitize.** Drop `script`, `noscript`, `iframe`, `object`, `embed`,
   `base`, `meta[http-equiv]` and every `on*` attribute. Links go through the
   existing `safeHref`. Count what was dropped for the report.
5. **Collect assets.** Resolve relative `src`, `href` and CSS `url()` paths
   against the uploaded files and turn them into data URLs, so the JSON
   project stays self-contained (§7, decision 4).
6. **Collect and scope CSS.** Read `<style>` blocks and linked local
   stylesheets. Parse with the browser (`new CSSStyleSheet().replaceSync`)
   and rewrite every rule:
   - prefix selectors with `.sw-imported`. `html`, `body` and `:root` become
     `.sw-imported` itself, so template CSS never touches the editor UI;
   - rewrite width `@media` rules to `@container sw-page (…)`, so the device
     switch works the same way as for our own components (T43);
   - put everything in `@layer imported`, below Tailwind's utilities, so a
     style token picked in the Properties panel still wins;
   - drop `@import` of unknown files and `@font-face` with missing files.

   CSS linked from a CDN (e.g. Bootstrap on jsDelivr) has to be downloaded
   from that CDN (§7, decision 5).

7. **Map DOM → component tree** (§6). Give every node a new unique id.
   Remove pointless wrappers: a `div` with one child and no classes, id or
   inline style.
8. **Validate and report.** Run `isWebsiteDocument`. Apply size limits (e.g.
   at most 2,000 nodes and 2 MB of CSS) to keep the canvas fast. Show a
   report: imported nodes, dropped elements, missing files, warnings.
9. **Open in the editor** with `setWebsite`. Like switching samples, this
   replaces the current page and clears undo history, so ask for
   confirmation first.

## 5. Schema v2 proposal

Schema v1 is frozen (`schema-v1` tag), so these are the changes for v2.
`ComponentNode` itself keeps its shape (`content`, `layout`, `style`,
`children`).

| Change                                       | Why                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New type **`box`** (container)               | Any structural element without a match: `div`, `main`, `article`, `aside`, `ul`, `ol`, `li`, `form`, … `content.tag` keeps the HTML tag (allowed list only). |
| New type **`field`** (leaf)                  | `input`, `textarea`, `select`. Display only. `content`: `kind`, `placeholder`, `label`.                                                                      |
| `WebsiteDocument.stylesheets: { id, css }[]` | The scoped template CSS (step 6). It is not page content, so it gets its own field.                                                                          |
| `WebsiteDocument.version: 2`                 | v1 documents load unchanged: they have no stylesheets and no new types.                                                                                      |
| `style.inline` slot (optional)               | The element's own `style=""` declarations (often a `background-image`). The renderer applies it through a safe parser.                                       |
| Website `content.design: 'imported'`         | Tells the renderer not to add our built-in `sw-*` look classes (§6), which would fight the template's CSS.                                                   |

Template classes need no new field: they go into the node's existing style
slot (`container`, `text`, `button`, `image`), the same place our own
classes live.

Code generation (M9) must output the stylesheets as a CSS file and keep
the classes; the editing tools already edit the same fields.

## 6. HTML → component mapping

| HTML                                              | Component      | Notes                                                                             |
| ------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `h1`–`h6`                                         | `heading`      | `content.level` from the tag.                                                     |
| `p`, `blockquote`, text-only `span`/`li`          | `text`         | Inline markup (`strong`, `em`, inline links) becomes plain text (§7, decision 3). |
| `a`, `button`, `input[type=submit]`               | `button`       | `href` through `safeHref`; a `button` without a link gets `#`.                    |
| `img`                                             | `image`        | Missing `alt` → file name, plus a warning.                                        |
| inline `svg` (icons)                              | `image`        | Saved as a `data:image/svg+xml` URL. No new type needed.                          |
| `nav`                                             | `navbar`       |                                                                                   |
| `section`                                         | `section`      |                                                                                   |
| `footer`                                          | `footer`       |                                                                                   |
| `div`, `main`, `header`, `article`, `ul`, `li`, … | `box`          | `content.tag` keeps the element.                                                  |
| `input`, `textarea`, `select`                     | `field`        |                                                                                   |
| text mixed with elements in one parent            | `text` per run |                                                                                   |
| `script`, `iframe`, `video`, `object`, `canvas`   | dropped        | Listed in the report.                                                             |

With `content.design: 'imported'` the renderer outputs the element with the
template's classes only. Our `sw-*` classes stay only where the editor
needs them (selection, dragging, positioning). The semantic types
(`navbar`, `section`, `footer`, …) still help the tree panel and the M12
recommendation system.

Not mapped in v1: `hero`, `card` and `columns`. Guessing them from HTML is
unreliable, and `columns` would override the template's own grid with an
inline style. They can be added later with clear rules (e.g. Bootstrap
`.row` → `columns`).

## 7. Decisions for the team

1. **Schema v2** as in §5: the `box` and `field` types, `stylesheets`,
   `style.inline`, `content.design`. Yes / changes?
2. **Scope of v1:** HTML/CSS, Bootstrap, built Tailwind and the Next.js
   static export, as in §2. Tailwind-CDN templates show a hint.
3. **Inline formatting:** plain text in v1 (bold text and inline links
   inside a paragraph are lost), or a rich-text field in the schema now?
4. **Assets as data URLs:** simple and self-contained, but large images make
   the project JSON big. Alternative: keep files separately and add them to
   the export ZIP.
5. **CDN stylesheets:** download them during import (needs internet and
   sends a request to the CDN), or ask the user to include them locally?
6. **Zip library:** add JSZip now, shared with T58?
7. **Where it goes in the plan:** a new milestone after M8 (template input),
   since both open a website in the editor.

## 8. Proposed tasks (new milestone, numbers set by the team)

1. Schema v2: `box`, `field`, `stylesheets`, `style.inline`,
   `content.design`; renderer support. Old v1 samples still render. —
   _Done when:_ a hand-written v2 JSON renders with its stylesheet.
2. Import UI: pick an `.html` file, folder or `.zip`; choose the entry page;
   confirm replacing the current page. — _Done when:_ the files are read and
   listed.
3. Parse and sanitize, plus the import report. — _Done when:_ a template
   with scripts and `on*` attributes imports with them removed and listed.
4. HTML → component mapping (§6). — _Done when:_ a plain HTML5 template
   opens as editable components.
5. CSS scoping and asset resolving (step 6 and 5). — _Done when:_ a
   Bootstrap 5 template looks like the original and the editor UI is
   unchanged.
6. Test with one template each: HTML5/CSS3, Bootstrap 5, built Tailwind,
   Next.js static export. — _Done when:_ each opens, edits, previews and
   switches devices without errors.
7. Code generation keeps imported stylesheets and classes (together with
   M9). — _Done when:_ an exported imported template looks like the canvas.
