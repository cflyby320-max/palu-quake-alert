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

`editorial-dry-run-1/` remains the original JSON/caption-only dry run.
`educational-render-preview-1/` is the first renderer baseline.
`educational-render-preview-2/` is the visually polished batch and the current
folder for human review.

## Visual QA Status

The second preview strengthens shared hierarchy, canvas use, footer contrast,
and template differentiation. It remains review-only and is not approved for
publication.

The next phase is a small curated Asset Bank. Add only approved textless assets
with stable IDs and metadata in `design/ASSET_INDEX.json`; do not bake factual
copy into image files.

`asset-bank-review-1/` preserves the initial candidate contact sheet.
`asset-bank-review-2/` is the approved review: four flagged candidates were
replaced with locally vendored, adapted CC0 material while retaining stable
asset IDs. Approval was recorded on 2026-06-27; the assets remain outside
educational render specs until the next renderer-integration sprint.
