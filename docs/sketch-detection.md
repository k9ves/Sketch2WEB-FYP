# Sketch detection with a vision model (proposal, T61)

Status: **draft for team review**. Nothing here is built yet. No change to
`src/schema/types.ts` is needed.

## 1. Goal

The user uploads a photo of a hand-drawn layout (T60). A vision model reads
the photo and returns a **list of detected elements**. Our own code then
turns that list into `ComponentNode`s (T62) and orders them (T63). The user
fixes mistakes in the editor (T64).

The model never returns HTML, CSS or `ComponentNode` JSON. It returns only
the element list in §3, and our code builds the tree from it. So a bad or
odd answer can never break the editor; at worst an element is missing.

## 2. Model and access

There are two ways to get the element list. Both give the same JSON (§3),
so everything after detection (T62–T64) works the same for both.

### 2.1 Manual mode (first, no cost)

The user runs the model in their own Claude chat (claude.ai or the Claude
app, e.g. with a Claude Pro plan) and copies the answer back. No API key,
no new package and no extra cost.

1. On the sketch screen, **Copy prompt** copies a fixed prompt. It
   describes the element list (§3) and the drawing guide (§4) and asks for
   the JSON only.
2. The user opens a Claude chat, attaches the sketch photo and pastes the
   prompt.
3. The user copies Claude's answer and pastes it into the **Paste result**
   box on the sketch screen.
4. Our code reads the JSON (a surrounding ` ```json ` code block is
   allowed), checks it as in §5 and builds the page.

Limits: it takes a few clicks per sketch, and the chat plan's usage limits
apply. The chat cannot be forced to follow the schema, so the checks in §5
matter more here. We use this mode for the T61 test and for T62–T64.

### 2.2 API mode (later, paid)

The app calls the model itself. This needs credit on the Claude API
(Claude Console), which is billed per use and is separate from a Claude
Pro plan.

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`), called with the official
  `@anthropic-ai/sdk` package.
- **Structured output:** the request sets `output_config.format` to the JSON
  schema in §3, so the answer always has that shape. Our code still checks
  it before use (§5).
- **No backend.** The browser calls the API directly
  (`dangerouslyAllowBrowser: true` in the SDK).
- **API key:** the user pastes their own key in the sketch screen. It stays
  in memory for the session only: it is not saved to `localStorage`, the
  project file or the export. Anyone with access to the browser can read
  it, so this is fine for the FYP demo with our own key, but **not for a
  public deployment**. A public version would need a small backend that
  holds the key, which is out of our scope.
- **Cost (rough):** one photo plus the answer is a few thousand tokens,
  about 1 to 5 US cents per sketch. We will measure it in the test (§6).

## 3. Element list (model output)

```json
{
  "elements": [
    {
      "type": "navbar",
      "box": { "x": 0.02, "y": 0.01, "w": 0.96, "h": 0.07 }
    },
    {
      "type": "button",
      "text": "Sign up",
      "box": { "x": 0.8, "y": 0.02, "w": 0.15, "h": 0.05 }
    },
    {
      "type": "heading",
      "text": "Build websites faster",
      "box": { "x": 0.1, "y": 0.15, "w": 0.6, "h": 0.06 }
    }
  ]
}
```

| Field  | Meaning                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `type` | One of `navbar`, `hero`, `section`, `card`, `footer`, `heading`, `text`, `button`, `image`.                            |
| `text` | Optional. The handwritten words, if they can be read. Empty or missing for images and unreadable text.                 |
| `box`  | Position and size as a share of the photo (0 to 1): left `x`, top `y`, width `w`, height `h`. Works at any photo size. |

Decisions in this format:

- **Flat list, no nesting.** Our code finds the parent of each element from
  the boxes: a button inside the navbar box belongs to the navbar. This is
  simple to check and does not depend on the model getting a tree right.
- **No `columns` or `website` type.** The page root is always added by our
  code. Columns come from elements that sit side by side (T63).
- **Navbar links** often come back as one `text` element, e.g.
  `"Home | Services | About | Contact"`. T62 splits a `text` inside a
  navbar at `|` (or wide gaps) into separate link buttons, like the navbar
  of the component palette.
- **Heading level** is not asked for. T62 picks it from the box height (the
  tallest heading on the page becomes `h1`).
- Words like "Sign up" are taken as **text to show**, never as instructions
  to the model.

## 4. Drawing guide (shown on the upload screen)

Detection is better when everybody draws the same way:

| Draw this                               | Becomes   |
| --------------------------------------- | --------- |
| Box with an X (☒) or a mountain inside  | `image`   |
| Small box with rounded corners and text | `button`  |
| Large or underlined words               | `heading` |
| Wavy or straight lines                  | `text`    |
| Wide strip at the top                   | `navbar`  |
| Wide strip at the bottom                | `footer`  |
| Box around a group of elements          | `card`    |

## 5. Errors and checks

| Problem                                                  | What the user sees                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Pasted text is not JSON (manual mode)                    | "This is not the JSON result. Copy Claude's whole answer."           |
| No key, or wrong key (API mode)                          | "Enter a valid API key" next to the key field.                       |
| No internet, rate limit, server error                    | "Could not reach the model. Try again." with a **Try again** button. |
| Model refuses (`stop_reason: "refusal"`)                 | "This image could not be read. Try another photo."                   |
| Answer has no elements                                   | "No layout found. Use a clear photo with dark lines."                |
| An element is invalid (unknown type, box outside 0 to 1) | That element is skipped; the rest are used. The count is shown.      |

In API mode, the upload screen shows a loading state while waiting. The
user can cancel.

## 6. Test plan (Done when of T61)

1. Pick 5 sketches from T59: simple to complex, at least one photo taken at
   an angle and one with poor light.
2. Run each through manual mode (§2.1) and paste the result into a small
   test page that shows the photo with the detected boxes drawn on top,
   and the raw element list.
3. For each sketch, note in a table: elements drawn, elements found,
   wrong type, missed, and whether the pasted JSON was valid.
4. Share the table with the team. If the results are poor, we change the
   prompt or the drawing guide before T62.

## 7. Open questions for the team

1. Is manual mode enough for the demo, or do we buy API credit for API
   mode? If API mode, whose key do we use?
2. Is the drawing guide in §4 fine, or do we want other symbols?
3. Do we keep the photo out of the project file (current plan), or save it
   so the user can compare later?
