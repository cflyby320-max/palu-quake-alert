# Studio Outbox

This folder contains manual review artifacts for future evergreen education
posts. It is not a posting queue and nothing here is approved for publication
until a human reviewer says so.

## How To Review

1. Open the latest batch folder.
2. Read each `caption.txt` first.
3. Check `render-decision.json` for the topic, pillar, template, sources,
   mandatory footer, and local editorial brief.
4. If the folder contains `card.png`, review the image against the caption and
   render decision.
5. If the folder contains `missing-image.md`, treat it as a dry run without a
   generated image.
6. Only after human approval should a future workflow update `last_used` in
   `content/topic_backlog.json`.

## Current Renderer Status

The Studio now has two isolated render paths:

- `studio/render.js` renders quake-alert cards from live earthquake event data.
- `studio/render-education.js` renders validated evergreen education specs for
  `editorial_steps`, `checklist_card`, and `poster_statement`.

`editorial-dry-run-1/` remains the original JSON/caption-only dry run. The
rendered PNG/SVG previews live in `educational-render-preview-1/`.

## Next Small Implementation

The next small step is review and polish: compare the generated PNGs against the
Design SDK, tighten spacing/type where needed, then decide whether new textless
assets are needed in `design/ASSET_INDEX.json`.
