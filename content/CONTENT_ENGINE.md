# Content Engine

Status: Phase 5A foundation. This layer defines structured content decisions
that can be converted into validated render specs. It does not render images,
call an AI model, publish content, or change the alert pipeline.

## Purpose

Future agents should not write instructions like "make an Instagram post."
They should produce a structured content decision:

```json
{
  "schemaVersion": "1.0.0",
  "templateId": "editorial_steps",
  "exportTarget": "instagram_feed",
  "pillarId": "preparedness",
  "sourceIds": ["bnpb"],
  "reviewStatus": "verified",
  "assets": {
    "referenceAssetIds": ["reference_editorial_steps"]
  },
  "content": {
    "kicker": "Siap Sebelum Bencana",
    "title": "Saat Gempa: 3 Langkah",
    "rows": [
      { "label": "Merunduk", "body": "Turun ke lantai sebelum terjatuh." },
      { "label": "Lindungi", "body": "Jaga kepala dan leher." },
      { "label": "Berpegangan", "body": "Tahan sampai guncangan berhenti." }
    ]
  }
}
```

The content engine converts that decision into a render spec compatible with
`design/RENDERING_CONTRACT.md` and validates it through
`studio/template-registry.js`.

## Boundaries

- The renderer owns visible placement, footer placement, and platform export.
- The content decision owns structured copy, selected template, selected pillar,
  approved asset IDs, and approved source IDs.
- AI may later draft content decisions, but this phase does not call any model.
- Emergency quake captions remain deterministic in `studio/caption.js`.
- No content decision may override warning status, quake facts, safety footer,
  WITA handling, or source routing.

## Required Inputs

Content decisions must use:

- `templateId`, never `layoutId` or `layout_id`.
- `pillarId` from `design/DESIGN_TOKENS.json` when the content is educational.
- `sourceIds` from `SOURCE_INDEX.json`.
- `reviewStatus: "verified"` before publication.
- `content` shaped for the selected template in
  `design/TEMPLATE_REGISTRY.json`.
- `assets` containing only IDs already present in `design/ASSET_INDEX.json`.

## Source Discipline

`SOURCE_INDEX.json` is the approved vocabulary for source IDs. It is a routing
and traceability layer, not a claim that every source was queried live during
rendering. A human or deterministic workflow must verify that the content
matches the cited source before setting `reviewStatus` to `verified`.

## Phase 5A Output

`studio/content-engine.js` returns:

```json
{
  "ok": true,
  "renderSpec": {
    "schemaVersion": "1.0.0",
    "templateId": "editorial_steps",
    "exportTarget": "instagram_feed",
    "language": "id",
    "timezone": "Asia/Makassar",
    "knowledge": {
      "pillarId": "preparedness",
      "sourceIds": ["bnpb"],
      "reviewStatus": "verified"
    },
    "assets": {
      "referenceAssetIds": ["reference_editorial_steps"]
    },
    "content": {},
    "footerId": "mandatory_honest_framing"
  },
  "errors": []
}
```

This object is still only a validated contract. Actual educational rendering is
future work.
