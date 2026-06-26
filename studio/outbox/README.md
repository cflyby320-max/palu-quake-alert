# Studio Outbox

This folder contains manual review artifacts for future evergreen education
posts. It is not a posting queue and nothing here is approved for publication
until a human reviewer says so.

## How To Review

1. Open the latest batch folder.
2. Read each `caption.txt` first.
3. Check `render-decision.json` for the topic, pillar, template, sources,
   mandatory footer, and local editorial brief.
4. Read `missing-image.md` so you know whether an image exists.
5. Only after human approval should a future workflow update `last_used` in
   `content/topic_backlog.json`.

## Current Renderer Status

The current Studio renderer creates quake-alert cards from live earthquake
event data. It does not yet render evergreen educational templates such as
`editorial_steps`, `checklist_card`, or `poster_statement`.

For now, editorial dry runs include JSON, captions, and missing-image notes.
No PNG or JPG files are expected in this folder.

## Next Small Implementation

The smallest next step is a deterministic educational SVG renderer for
`editorial_steps`, `checklist_card`, and `poster_statement`, using the existing
Design SDK tokens, template registry, mandatory footer tokens, and Resvg
rasterization path. Keep it text-first until approved textless assets are added
to `design/ASSET_INDEX.json`.

