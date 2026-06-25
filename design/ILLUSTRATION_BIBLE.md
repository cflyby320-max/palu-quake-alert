# Illustration Bible

The illustration system should make civic disaster literacy feel local, calm,
and memorable without faking news or sensationalizing harm. This file governs
future backgrounds, illustrations, icons, objects, and patterns.

## Hybrid Rule

Every card has two conceptual layers:

1. Imagery layer: background, illustration, texture, objects, or photo.
2. Verified overlay layer: text, numbers, safety lines, logo, footer, and source
   routing.

The imagery layer may be curated, illustrated, photographed, or generated for
style. It must be textless. The verified overlay layer must be deterministic and
human-reviewed.

## Approved Visual Themes

### Place And Ground

Use for `know_your_ground`.

Motifs:

- Palu valley, bay, coastline, and hills.
- Palu-Koro fault line as abstract geography.
- Topographic contours and seismic arcs.
- Ground layers and liquefaction diagrams.

Tone:

- Sober, factual, respectful.
- History as knowledge, not spectacle.

### Readiness And Household Action

Use for `preparedness`.

Motifs:

- Go-bag flat lays.
- Water, radio, power bank, medicine, documents.
- Furniture anchoring, shelves, beds, exits.
- Family meeting point and simple route diagrams.
- Drop, cover, hold on as icon/pose sequence.

Tone:

- Practical, hopeful, doable today.
- Local materials and ordinary homes.

### Verification And Information Hygiene

Use for `information_hygiene`.

Motifs:

- Phone/message bubbles without readable fake text.
- Check mark, magnifier, source trail, split-screen verification.
- SIFT sequence: stop, investigate, find, trace.
- Official-channel routing.

Tone:

- Calm, smart, non-condescending.
- The viewer is capable and in control.

## Hard Prohibitions

Never use:

- Real victims, bodies, gore, or grief close-ups.
- Panic crowds, screaming faces, disaster-porn, or clickbait destruction.
- Recycled disaster photos presented as Palu or as a real current event.
- Fabricated scenes presented as documentary evidence.
- AI-generated text, warning signs, maps, charts, numbers, official logos, or
  screenshots.
- Images that imply an all-clear or prediction.
- Red emergency styling for non-critical educational posts.

## Asset Requirements

Every future illustration/background asset should have:

- Stable asset ID.
- File path.
- Category: background, illustration, icon, object, pattern, texture.
- Pillar or severity association.
- Source type: original, commissioned, generated, public-domain, licensed, or
  official-source.
- Rights/license note.
- Safety review status.
- "Textless" confirmation.
- Intended templates and crops.

Add assets to `ASSET_INDEX.json` before using them in a render spec.

## Background Rules

For editorial templates:

- Preferred image zone: top 0-520 px.
- Keep top-left header area calm.
- Keep lower footer area calm.
- Use a dark scrim or tonal overlay when type crosses imagery.

For poster templates:

- Image may cover the full canvas.
- Use a bottom or side scrim for large text.
- Avoid busy focal points behind the main statement.
- Leave footer band clean and deterministic.

## Iconography

Style:

- Rounded line icons.
- Single-color strokes.
- Consistent stroke at card scale.
- Clear at small sizes.
- No filled decorative icon blobs unless the layout calls for numbered badges.

Core motifs:

- Seismic waveform.
- Location pin/shield.
- High-ground slope.
- Go-bag.
- Water/food/radio/power bank/medicine.
- Drop-cover-hold sequence.
- Magnifier/check/source trail.
- Warning siren only for actual warnings.

Severity badges already encode waveform amplitude. Do not redesign severity
without preserving a non-color cue.

## Pattern Language

Allowed patterns:

- Low-opacity seismic rings.
- Topographic contour lines.
- Fault-line traces.
- Grid/route lines for maps or timelines.
- Sparse amber rules.

Avoid:

- Decorative bokeh, blobs, generic gradients, confetti, or playful stickers.
- Patterns that look like official hazard maps unless they are verified.

## Image Model Prompt Briefs

These are starter briefs for creating textless source assets, not final posts.
Generated outputs must be curated, reviewed, named, and indexed before use.

### P1: Kenali Wilayahmu

Stylized editorial illustration of Palu valley and Palu Bay at dusk, with an
abstract Palu-Koro fault line and topographic contours. Deep teal and mint
palette, calm and factual, no text, no people in distress.

### P2: Siap Sebelum Bencana

Warm practical flat-lay illustration of an emergency go-bag and family
preparedness items on a simple surface. Green accents, hopeful and useful, no
text, no dramatic disaster scene.

### P3: Saring Sebelum Sebar

Conceptual illustration of a phone message, magnifier, source trail, and check
mark. Amber accents, calm and smart, no readable text, no panic.

## Review Checklist

Before adding an asset:

- Is it textless?
- Is it respectful to 2018 victims and survivors?
- Could it be mistaken for a real current event?
- Could it imply official status, all-clear, or prediction?
- Does it work behind deterministic text?
- Does it have a stable ID and source note?
- Does it fit one pillar or template clearly?

