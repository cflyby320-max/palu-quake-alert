# Rendering Contract

This contract defines how future agents and renderers should exchange design
instructions. It is forward-looking and documentation-only. The current
production renderer remains the existing studio SVG-to-PNG pipeline.

## Principle

AI may select layouts and approved assets. AI may draft structured content only
inside the constraints of the knowledge layer. The renderer composes the final
image. The renderer must own all factual text placement, logo placement, footer
placement, safe areas, export dimensions, and final platform output.

No image model may own:

- Warning status.
- Magnitude, depth, time, distance, or map labels.
- Safety instructions.
- 2018 figures.
- Official-source routing.
- Footer text.

## Render Spec Shape

Future render requests should be structured objects, not prose prompts.

```json
{
  "schemaVersion": "1.0.0",
  "templateId": "editorial_steps",
  "exportTarget": "instagram_feed",
  "language": "id",
  "timezone": "Asia/Makassar",
  "knowledge": {
    "pillarId": "preparedness",
    "sourceIds": ["bmkg", "bnpb", "bpbd_sulteng"],
    "reviewStatus": "verified"
  },
  "assets": {
    "backgroundId": "p2_go_bag_flatlay",
    "illustrationIds": ["drop_cover_hold"],
    "iconIds": ["step_badge"]
  },
  "content": {
    "title": "Saat Gempa: 3 Langkah",
    "kicker": "Siap Sebelum Bencana",
    "rows": [
      { "label": "Merunduk", "body": "Turun ke lantai sebelum terjatuh." },
      { "label": "Lindungi", "body": "Kepala dan leher di bawah meja kokoh." },
      { "label": "Berpegangan", "body": "Tahan sampai guncangan berhenti." }
    ]
  },
  "footerId": "mandatory_honest_framing"
}
```

## Required Fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Contract version for render input. |
| `templateId` | Approved layout ID from `DESIGN_TOKENS.json`. |
| `exportTarget` | Approved platform/export size. |
| `language` | Must be `id` for current social/emergency content. |
| `timezone` | Must be `Asia/Makassar` or WITA-equivalent for quake times. |
| `knowledge.reviewStatus` | Must be `verified` before publication. |
| `content` | Structured text payload; no HTML; renderer handles placement. |
| `footerId` | Must resolve to the mandatory honest-framing footer. |

## Template IDs

The v1 SDK defines these template IDs:

- `quake_alert_card`
- `editorial_steps`
- `poster_statement`
- `carousel_cover`
- `carousel_slide`

Any new template must be added to `DESIGN_TOKENS.json`, documented in
`VISUAL_LANGUAGE.md`, and covered by a renderer test before production use.

## Export Targets

| Target | Size | Use |
|---|---:|---|
| `instagram_feed` | 1080 x 1350 | Current studio/social card format. |
| `telegram_image` | 1080 x 1350 | Same rendered card, delivered through Telegram. |
| `story_9_16` | 1080 x 1920 | Planned, not implemented. |
| `pdf_print` | TBD | Planned community poster/PDF output. |

## Layer Order

Renderers should compose back to front:

1. Canvas background.
2. Curated background/illustration layer, if present.
3. Legibility scrim or tonal overlay.
4. Brand header or lockup.
5. Pillar/severity tag.
6. Verified text payload.
7. Source/counter/progress details.
8. Mandatory footer.

The footer should be drawn last or otherwise guaranteed to remain readable.

## Safe Areas

For `instagram_feed`:

- Canvas: 1080 x 1350.
- Suggested margin: 60 px.
- Current header band: y 0-184.
- Footer reserve: y 1200-1350 in the current renderer.
- Reference mock footer reserve: y 1232-1350.
- Keep image focal points clear of the top brand zone and bottom footer zone.

## Current Renderer Compatibility

The live clone currently renders quake cards through:

- `studio/design-sdk.js`
- `studio/template.js`
- `studio/render.js`
- `studio/caption.js`
- `studio/deliver.js`
- `studio/hook.js`

The renderer builds SVG strings and rasterizes them to PNG with
`@resvg/resvg-js`, using bundled DejaVu fonts. `studio/design-sdk.js` is the
Phase 2 bridge into `design/DESIGN_TOKENS.json`; it reads core colors, canvas
dimensions, and mandatory footer copy while falling back to current values if a
deployment image is missing `design/`.

## Future Renderer Direction

When implementation resumes, prefer an incremental path:

1. Keep the current SVG-to-PNG renderer.
2. Extract shared tokens and footer/header helpers from existing studio code.
3. Add render-spec validation for template IDs, footer IDs, asset IDs, and export
   targets.
4. Add educational templates only after the SDK tokens and asset IDs exist.
5. Add image-layer assets as curated, textless inputs.

Do not introduce a model-generated image directly into final publication. If AI
imagery is used, it must be pre-curated into the asset layer first.

## Validation Gates

Before a rendered asset can be published:

- Footer text is present and readable.
- BMKG routing is present where required.
- No all-clear or prediction phrasing appears.
- Strong-shaking high-ground rule is preserved where relevant.
- WITA is used for quake time.
- Text is Bahasa Indonesia.
- Contrast is acceptable.
- Source IDs are traceable.
- Asset IDs exist in `ASSET_INDEX.json`.
- Export dimensions match the target.
