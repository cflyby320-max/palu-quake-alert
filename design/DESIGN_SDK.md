# Palu Earthquake Alerts Design SDK

Status: v1 design specification. Documentation-only. This SDK does not change
the watcher, studio renderer, prompts, package files, or alert delivery path.

This project is a civic safety system before it is a content brand. Design work
must make verified information easier to recognize, reuse, and render without
letting AI invent facts, text, figures, or safety framing.

## Purpose

The Design SDK turns the handover design references into a maintainable system
for future contributors and AI agents. It should be read before changing any
public visual surface, including Instagram cards, Telegram channel graphics,
the public website, PDF/poster variants, or future channel exports.

Future AI should not be asked to "create an Instagram post." It should select
approved primitives and return structured input:

```json
{
  "layoutId": "editorial_steps",
  "pillarId": "preparedness",
  "backgroundId": "p2_go_bag_flatlay",
  "illustrationIds": ["drop_cover_hold"],
  "iconIds": ["step_1", "step_2", "step_3"],
  "textPayload": {
    "title": "Saat Gempa: 3 Langkah",
    "rows": ["Merunduk", "Lindungi", "Berpegangan"]
  },
  "footerId": "mandatory_honest_framing",
  "exportTarget": "instagram_feed"
}
```

The renderer owns composition. Humans and deterministic templates own words,
numbers, safety claims, and the footer.

## Four Layers

### 1. Knowledge

Facts, educational content, safety guidance, and source discipline.

Use existing source-of-truth docs instead of rewriting them:

- `CLAUDE.md` and active project instructions for safety-critical invariants.
- `OUTLOOK_DESIGN.md` for aftershock-probability framing.
- `studio/STUDIO_DESIGN.md` for studio boundaries and social-card safety rules.
- `docs/whitepaper.html` for the public project story and workstream map.
- `CONTEXT.md` for roadmap context. Treat it as partially stale where it conflicts
  with current Indonesian-only emergency copy.

The handover content strategy is distilled here into three reusable knowledge
pillars:

| Pillar ID | Label | Promise | CTA |
|---|---|---|---|
| `know_your_ground` | Kenali Wilayahmu | Understand the real risk where you live. | Learn and remember |
| `preparedness` | Siap Sebelum Bencana | Cheap, simple actions that help families. | Do one thing today |
| `information_hygiene` | Saring Sebelum Sebar | Stop panic and hoaxes from causing more harm. | Verify, then share |

Content-pillar colors are intentionally separate from quake severity colors:
P1 `#4169E1`, P2 `#148A87`, P3 `#6B4EFF`. Severity colors remain reserved for
reactive earthquake alert levels.

### 2. Design

Brand, visual language, typography, layout families, spacing, and accessibility.

Start with `VISUAL_LANGUAGE.md` and `DESIGN_TOKENS.json`. The visual system is
calm, civic, and disciplined: deep teal foundation, sparse amber accent, strong
typography, obvious hierarchy, and no alarmist spectacle.

### 3. Assets

Approved marks, badges, fonts, reference mockups, future illustrations, icons,
objects, textures, and background IDs.

Start with `ASSET_INDEX.json`. Assets must be reusable, credited or traceable,
and safe for civic disaster communication. Generated imagery, if used later,
must be textless and composited behind deterministic text.

### 4. Rendering

Layout composition, verified text overlays, and platform exports.

Start with `RENDERING_CONTRACT.md`. Current production rendering remains the
existing SVG-to-PNG studio pipeline. This SDK defines where the renderer should
go next: from hand-coded prompt-like layouts toward structured render specs.

## Non-Negotiables

These constraints outrank aesthetics:

- No "all clear." "Tidak berpotensi tsunami" is never treated as safe.
- No earthquake predictions.
- High-ground rule stays visible for strong shallow coastal quakes.
- Emergency alerts and quake cards use Bahasa Indonesia and WITA.
- Safety copy stays calm and scannable.
- AI never owns words, figures, map claims, warning status, or footer copy.
- Every social post carries the honest-framing footer.
- Always route authority to BMKG and, for preparedness education, BNPB/BPBD
  where appropriate.
- Real disaster victims, gore, panic, and fabricated "news" scenes are forbidden
  visual material.

## Current Production Boundary

Do not break the existing pipeline:

- Watcher code in `src/` stays zero-dependency.
- Studio remains optional and isolated under `studio/`.
- This SDK does not introduce any install step.
- This SDK does not alter `studio/template.js`, `studio/render.js`, prompts, or
  message builders.
- Reference PNGs under `design/references/` are guidance, not runtime inputs.

## Reference Files In This SDK

- `VISUAL_LANGUAGE.md` - human-readable brand and layout rules.
- `RENDERING_CONTRACT.md` - structured rendering input/output contract.
- `ILLUSTRATION_BIBLE.md` - imagery and iconography rules.
- `DESIGN_TOKENS.json` - machine-readable token source for agents.
- `ASSET_INDEX.json` - machine-readable inventory of assets and references.
- `references/` - local copies of the approved handover mockups.

## How Future Agents Should Work

1. Read this SDK and the safety docs before visual work.
2. Choose the knowledge pillar and content type.
3. Choose an approved layout ID from `DESIGN_TOKENS.json`.
4. Choose approved assets from `ASSET_INDEX.json`.
5. Provide verified text payload only after source/copy checks.
6. Let the renderer place text, footer, logo, images, and export dimensions.
7. Validate that the footer, safety framing, contrast, and platform crop are safe.

If a desired asset, layout, or icon does not exist, propose adding it to the SDK
first. Do not improvise a one-off graphic in production.
