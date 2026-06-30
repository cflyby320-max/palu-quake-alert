# Visual Language

Palu Earthquake Alerts should feel like a trusted neighbor with disciplined
information habits: calm, civic, local, and ready. The visual system must support
emergency clarity and long-term disaster literacy without becoming sensational
social media packaging.

## Brand Essence

| Attribute | Direction |
|---|---|
| Promise | We cannot stop the earthquake, but we can decide how ready and informed we are. |
| Personality | Calm, civic, grounded, hopeful. |
| Anti-personality | Alarmist, viral, disaster-porn, doom-scroll bait, toy-like. |
| Cultural register | Bahasa Indonesia first; local to Palu, Donggala, Sigi, and Central Sulawesi. |
| Trust posture | Unofficial community notifier that always defers to official sources. |

The brand exists because of an information failure around the 2018 Palu disaster.
Every visual decision should model information discipline: verified, limited,
humble, and actionable.

## Core Color Language

The civic base is deep teal. It should carry most surfaces and backgrounds.
Amber is a sparse attention accent, not a generic decoration. Red is reserved
for critical quake/tsunami severity, not for ordinary emphasis.

| Token | Hex | Role |
|---|---|---|
| `teal` | `#0F4C5C` | Primary civic surface |
| `teal_deep` | `#0A3742` | Header, footer, dark bands |
| `teal_mid` | `#11343D` | Panels and dark rows |
| `teal_accent` | `#7FB7B8` | Secondary text and hairlines |
| `mint` | `#9FE1CB` | Highlight text on dark surfaces |
| `off_white` | `#FBFCFB` | Primary text on dark surfaces |
| `paper` | `#EEF3F2` | Light web background |
| `amber` | `#C77B0A` | Brand accent and attention rule |
| `amber_ink` | `#412402` | Text on amber |

## Severity vs. Pillar Color

Severity colors are for reactive earthquake alerts only:

- LOW: `#2E7D52`
- MODERATE: `#D9A406`
- HIGH: `#CC6B27`
- CRITICAL: `#B5362B`

Pillar colors are for educational content only:

- P1 Kenali Wilayahmu: `#4169E1`
- P2 Siap Sebelum Bencana: `#148A87`
- P3 Saring Sebelum Sebar: `#6B4EFF`

These pillar colors are deliberately separated from the severity family. Keep
them in the education layer and continue pairing them with labels and motifs,
not color alone. The reference mock PNGs predate this separation, so the JSON
tokens above supersede their pillar swatches.

## Typography

Current public web pages use Archivo for display and Inter for body. Current
studio rendering uses bundled DejaVu Sans and DejaVu Sans Bold for deterministic
output on hosts without system fonts.

Direction:

- Keep DejaVu as the current renderer fallback.
- Prefer a future bundled card typeface with strong Indonesian/local fit.
- Recommended first candidate: Plus Jakarta Sans.
- Keep type large, direct, and highly legible at phone-feed size.
- Use tabular numbers for magnitudes, dates, counters, and distances when the
  selected font supports them.

Card hierarchy:

- Kicker/pillar tag: uppercase, letter-spaced, compact.
- Main title: bold display, one idea, usually two to four lines.
- Body rows: short, left-aligned, scannable.
- Footer: always present, calm, smaller than content but still legible.

## Layout Families

### `quake_alert_card`

Purpose: reactive earthquake card with BMKG shakemap when available.

Use for:

- Actual quake events.
- Operator-reviewed Instagram/Telegram drafts.

Rules:

- Must mirror `classify()` and `buildMessage()` in `src/core.js`.
- Must not visually soften tsunami caution.
- Must attach or reference BMKG shakemap only when available.
- Must degrade to a safe placeholder if shakemap fails.

### `editorial_steps`

Purpose: educational checklist, explainer, or carousel slide.

Use for:

- Preparedness steps.
- Historical explainers.
- SIFT/media-literacy instructions.
- Multi-slide carousels.

Composition:

- Top image/illustration zone.
- Header mark and brand.
- Pillar tag.
- Big action title.
- Structured rows with numbers or icons.
- Mandatory footer.

### `checklist_card`

Purpose: one practical preparedness checklist.

Use for:

- Go-bag items.
- Before/after shaking routines.
- Family communication tasks.

Rules:

- Keep items short enough to scan in one pass.
- Use check marks, step numbers, or icons as renderer-owned marks.
- Do not imply a checklist guarantees safety.
- Mandatory footer.

### `poster_statement`

Purpose: one bold myth-bust, quote, or single civic message.

Use for:

- "Gempa tidak bisa diprediksi."
- Anniversary statements.
- Strong one-takeaway posts.

Composition:

- Full or near-full background imagery with tonal scrim.
- Sparse text.
- One emphasized word or phrase.
- Source attribution when quoting authorities.
- Mandatory footer.

### `carousel_cover`

Purpose: entry slide for multi-slide education.

Use for:

- Historical series.
- Preparedness checklist sets.
- Media-literacy lessons.

Rules:

- Name the topic plainly.
- Include a short "Geser" cue.
- Show progress dots or slide count.
- Do not overload the cover with details.

### `carousel_slide`

Purpose: body slide inside a multi-slide education carousel.

Use for:

- One concept per slide.
- One safety habit per slide.
- Small sets of verified supporting details.

Rules:

- Keep progress visible.
- Preserve the same pillar and footer rules as the cover.
- Do not bury a critical action in small body copy.

### `story_card`

Purpose: 9:16 story-format quick tip or announcement.

Use for:

- Short preparedness reminders.
- Time-sensitive non-emergency updates.
- Lightweight recaps that point back to official sources.

Rules:

- Respect mobile safe areas.
- Keep one message per story.
- Footer remains mandatory and renderer-owned.

## Imagery Style

Use respectful, textless imagery. Richness belongs in curated backgrounds and
illustrations, never in model-generated text.

Good directions:

- Stylized editorial illustration.
- Muted local landscape or place-based imagery.
- Topographic lines, seismic waves, coastline-to-high-ground silhouettes.
- Practical preparedness objects.
- Hands/community motifs without panic.

Avoid:

- Real victims or bodies.
- Gore, panic, rubble spectacle, or disaster-porn.
- Fabricated scenes presented as real events.
- AI-rendered words, numbers, signs, maps, or warnings.
- Stock-photo hero cliches.

## Footer

The footer is mandatory on every social post. Current runtime card footer:

```text
Notifikasi cepat — bukan peringatan dini.
Selalu ikuti arahan resmi BMKG.
@infogempapalu
```

Preparedness/education designs may use the expanded authority line when space
allows:

```text
Notifikasi cepat — bukan peringatan dini.
Selalu ikuti arahan resmi BMKG · BNPB · BPBD Sulteng.
@infogempapalu
```

The footer must be rendered by the composition layer, not by an image model.

## Accessibility

- Text contrast should meet WCAG AA where practical, with 4.5:1 as the target
  for normal text.
- Color cannot be the only meaning carrier.
- Severity also uses waveform amplitude.
- Pillars must use text labels and motifs, not color alone.
- Keep minimum feed text sizes large enough to read on a mobile phone.
- Avoid dense paragraphs. One post should have one takeaway.

## Visual Do Not

- Do not use purple gradients, decorative blobs, or generic SaaS icon grids.
- Do not make emergency content playful.
- Do not treat amber as danger or red as ordinary emphasis.
- Do not center everything by default.
- Do not put the footer inside generated imagery.
- Do not crop the logo into illegibility.
- Do not redesign safety copy for aesthetic balance.
