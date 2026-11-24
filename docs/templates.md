# Templates: rules for "100% editable"

Templates live in `src/templates/<name>.json` and use our own schema (v1).
A template follows these rules so the editor can read **and** edit every
part of it with its own tools: canvas, Layers tree and Properties panel.

Check them with:

```sh
npm run check:templates                 # all src/templates/*.json
npm run check:templates -- my-page.json # only the given files
```

The checker is `src/templates/validateTemplate.ts`. The template gallery
uses the same function, so a template with issues is never offered.

## Rules

1. **Schema v1, our 11 types only.** `website` is only the root; leaf
   types (`heading`, `text`, `button`, `image`) have no children.
2. **Text lives in its own nodes.** Containers (`navbar`, `hero`,
   `section`, `columns`, `card`, `footer`) have no content fields; their
   text is `heading` / `text` / `button` children, so every piece of text
   can be dragged and edited on its own.
3. **Only fields the Properties panel edits:** website `title`; heading
   `text`, `level` (1–6); text `text`; button `text`, `href`; image `src`,
   `alt`. Required fields are not empty.
4. **Style: the type's own slot, panel tokens only.** Classes come from
   `src/editor/styleTokens.ts` (the groups offered for that slot), at most
   one per group, plus our look classes for text (`sw-hero-title`,
   `sw-hero-description`, `sw-section-title`, `sw-section-description`,
   `sw-card-title`, `sw-card-text`, `sw-footer-text`) and links (`sw-brand`,
   `sw-nav-link`). No other Tailwind classes: they would not be generated
   and the panel could not show them. The renderer adds the base look
   (`sw-hero`, `sw-card`, …) itself.
5. **Flow layout only.** Layout keys only on `columns` (`display`,
   `columns` 1–6, `gap`, `direction`, `align`, `justify`) and `hero`
   (`gap`, `direction`, `align`, `justify`), with values the panel offers
   (gap steps 0–6, 8, 10, 12, 16). No free positions (`x`, `y`, `width`) or
   resized boxes, so templates stack correctly on mobile.
6. **Images are files in the project:** `src` starts with `/templates/`
   (the file is in `public/templates/<name>/`) and `alt` is filled in. Use
   only images we may use (own or free licence).
7. **Safe links only** (`#section`, `https://…`, `mailto:` …), so no
   warning box appears.
8. **Unique ids starting with the file name:** `saas.json` →
   `saas-hero-title`.

## Tips

- **Buttons in a navbar** take the navbar's text color (`.sw-navbar a`
  inherits it). A filled button there needs a text color token, e.g.
  `bg-slate-900 text-white`.
- **The website spans the full canvas width.** Top-level navbar, hero,
  section, footer and columns get a side space of their own
  (`--sw-gutter`, about 7% of the width), so their background reaches the
  edges.
- **Coloured bands:** give a top-level section a `bg-*` token and use
  **Vertical padding** (`py-*`) for space. A Padding token (`p-*`) also
  replaces the side space, so the text would no longer line up with the
  rest of the page.
- Check every template on Desktop, Tablet and Mobile in the editor, and in
  Preview.

## Current templates

`saas` (startup landing), `portfolio`, `blog`, `restaurant`, `agency`.
Their images are our own SVG illustrations in `public/templates/<name>/`.
