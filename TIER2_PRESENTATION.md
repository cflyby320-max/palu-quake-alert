# Tier 2 — Trust & Presentation

Everything needed to make **@Palu_quake_alert_bot** look complete and trustworthy
when it circulates: BotFather profile text, a static command list, a pinned
welcome/safety post, and a small brand kit (avatar + severity icons).

**No code is changed in this tier.** The bot stays *broadcast-only* (it sends; it
does not respond to commands). Interactive `/start`/`/stop` belongs to the future
subscriber-bot workstream (CONTEXT.md §C) — see the [Commands](#3-command-list)
note below for why we don't fake it here.

All copy mirrors the finalized public page (`docs/index.html`) so the bot, the
channel, and the about page tell one consistent story: *unofficial, ~minutes-
delayed, not early warning, defer to BMKG, high-ground rule is absolute.*

Placeholders in `[BRACKETS]` need a real value before you publish — see
[§7 Before you publish](#7-before-you-publish).

---

## 1. Brand assets

Vector sources and ready-to-upload PNGs live in [`docs/assets/`](docs/assets):

| File | Use | Size |
|---|---|---|
| `avatar.svg` / `avatar.png` | Bot & channel profile photo | 512×512, opaque |
| `severity-low.svg` / `.png` | 🟢 LOW badge | 256×256, transparent |
| `severity-moderate.svg` / `.png` | 🟡 MODERATE badge | 256×256, transparent |
| `severity-high.svg` / `.png` | 🟠 HIGH badge | 256×256, transparent |
| `severity-critical.svg` / `.png` | 🔴 CRITICAL badge | 256×256, transparent |

**Avatar concept:** a deep-teal medallion holding a protective shield whose lower
point doubles as a map pin, crossed by a seismic waveform with a single amber
alert peak. No text (it must read at ~40 px). Calm and civic, not alarmist.

**Severity badges:** one shared seismic-wave glyph; amplitude grows with severity
(LOW = gentle, CRITICAL = a tall spike) so the four are distinguishable even in
greyscale or to colorblind viewers — colour is not the only cue.

### Palette (matches `docs/index.html`)

| Token | Hex | Role |
|---|---|---|
| teal | `#0F4C5C` | primary |
| teal-deep | `#0A3742` | primary (dark) |
| amber | `#C77B0A` | warning accent — use sparingly |
| paper | `#EEF3F2` | light background |
| green | `#2E7D52` | 🟢 LOW |
| yellow | `#D9A406` | 🟡 MODERATE |
| orange | `#CC6B27` | 🟠 HIGH |
| red | `#B5362B` | 🔴 CRITICAL |

Type (web only): **Archivo** (display) + **Inter** (body).

### Regenerating the PNGs from the SVGs

The SVGs are the source of truth. To re-export PNGs (any machine with Chrome),
run from the repo root — adjust the Chrome path if needed:

```bash
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
for f in avatar:512 severity-low:256 severity-moderate:256 severity-high:256 severity-critical:256; do
  name="${f%%:*}"; size="${f##*:}"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size=$size,$size \
    --screenshot="docs/assets/$name.png" "docs/assets/$name.svg"
done
```

> If Chrome is already open, headless may hand off to the running instance and
> write nothing — pass `--user-data-dir=$(mktemp -d)` to force a clean instance.

---

## 2. BotFather profile text

In Telegram, open **@BotFather → /mybots → @Palu_quake_alert_bot**.

**Name** (`Edit Bot → Edit Name`):

```
Palu Earthquake Alerts
```
*(Alt, ID-first: `Peringatan Gempa Palu`. The @username can't be changed and stays `@Palu_quake_alert_bot`.)*

**About** — 119/120 chars (`Edit Bot → Edit About`):

```
Peringatan cepat gempa Palu dari BMKG & USGS. Tidak resmi, bukan peringatan dini. / Unofficial rapid Palu quake alerts.
```

**Description** — 475/512 chars (`Edit Bot → Edit Description`):

```
Bot komunitas yang menyiarkan peringatan cepat gempa di sekitar Palu dari BMKG/InaTEWS & USGS — biasanya 2–5 menit setelah kejadian. Ini BUKAN peringatan dini dan BUKAN pengganti BMKG, sirene, atau petugas; selalu utamakan sumber resmi. Guncangan kuat di dekat pantai? Segera ke tempat tinggi tanpa menunggu konfirmasi. / Unofficial community alerts for quakes near Palu (BMKG & USGS), usually 2–5 min after an event. Not early warning; not a substitute for official sources.
```

**Profile photo** (`Edit Bot → Edit Botpic`): upload `docs/assets/avatar.png`.
Use the same image for the broadcast **channel** photo.

---

## 3. Command list

> **Recommendation: while the bot is broadcast-only, set NO command menu.**
> A menu makes Telegram show a "/" button and command hints; tapping them when
> nothing answers looks broken and quietly erodes trust — the opposite of this
> tier's goal. The same info (about, terms, sources) is already in the
> Description and the pinned post. **We deliberately omit `/start` and `/stop`:**
> people subscribe by *joining the channel*, so a dead `/start` would falsely
> imply they're subscribed — a safety-relevant failure.

If you nonetheless want a cosmetic menu (per CONTEXT.md §A), use this
info-only list via **BotFather → /setcommands** (one per line, lowercase).
These still won't respond until a listener component is added (workstream C):

```
about - Tentang bot ini / About this bot
disclaimer - Ketentuan & keselamatan / Terms & safety
sources - Sumber data: BMKG & USGS / Data sources
status - Status sistem / System status
```

When interactive mode is built later, add `start`/`stop` and wire real handlers.

---

## 4. Pinned welcome & safety post

Post this in the channel (and/or as the bot's first message), then **pin it**.
Bold the ⚠️ line in Telegram for emphasis. Bilingual, Indonesian first.

```
📍 Palu Earthquake Alerts — Peringatan Gempa Palu

Peringatan cepat gempa & potensi tsunami untuk wilayah Palu, Sulawesi Tengah.
Sumber: BMKG/InaTEWS & USGS. Pesan biasanya tiba 2–5 menit setelah gempa
dipublikasikan.

⚠️ ATURAN UTAMA: jika Anda merasakan guncangan KUAT di dekat pantai, segera ke
tempat tinggi — JANGAN menunggu peringatan, pesan bot ini, atau pernyataan
"aman". "Tidak ada potensi tsunami" tidak berarti aman. (Tsunami 2018 dipicu
longsor, tidak terprediksi, dan peringatan resmi sempat dicabut lebih awal.)

Ini BUKAN peringatan dini dan BUKAN pengganti BMKG, sirene, atau petugas —
selalu utamakan sumber resmi. Bot ini hanya menyiarkan (broadcast); tidak
membalas perintah.

Tingkat peringatan:
🟢 RENDAH — M4.0–4.9, info awal
🟡 SEDANG — M5.0–5.9, mungkin terasa
🟠 TINGGI — ≥M6.0 dekat (≤200 km) atau kewaspadaan tsunami
🔴 KRITIS — ≥M7.0 atau peringatan tsunami resmi

Cara pakai: aktifkan notifikasi Telegram; anggap sebagai pelengkap, bukan
andalan utama. Bertindaklah berdasarkan yang Anda rasakan dan arahan BMKG/petugas.

Ketentuan & privasi: [ABOUT_PAGE_URL]
Sumber: BMKG https://inatews.bmkg.go.id · USGS https://earthquake.usgs.gov
Gratis & non-komersial · proyek komunitas tidak resmi.

———

📍 Palu Earthquake Alerts

Rapid earthquake & tsunami-caution alerts for Palu, Central Sulawesi.
Sources: BMKG/InaTEWS & USGS. Messages usually arrive 2–5 minutes after a quake
is published.

⚠️ THE ONE RULE: if you feel STRONG shaking near the coast, move to high ground
immediately — do NOT wait for any warning, this bot's message, or an "all clear."
"No tsunami potential" does not mean safe. (The 2018 tsunami was landslide-driven,
unpredicted, and the official warning was lifted early.)

This is NOT early warning and NOT a substitute for BMKG, sirens, or authorities —
always defer to official sources. This bot only broadcasts; it does not reply to
commands.

Alert levels:
🟢 LOW — M4.0–4.9, heads-up
🟡 MODERATE — M5.0–5.9, may be felt
🟠 HIGH — ≥M6.0 nearby (≤200 km) or tsunami caution
🔴 CRITICAL — ≥M7.0 or an official tsunami warning

How to use: enable Telegram notifications; treat it as a supplement, not your
primary source. Act on what you feel and on BMKG/officials first.

Terms & privacy: [ABOUT_PAGE_URL]
Sources: BMKG https://inatews.bmkg.go.id · USGS https://earthquake.usgs.gov
Free & non-commercial · unofficial community project.
```

---

## 5. Optional: wire severity badges into the public page

The badges match the `.dot` swatches in the "Severity Levels" section of
`docs/index.html`. If you want the richer glyph there later, swap each
`<span class="dot …">` for the matching `severity-*.svg`. Not required for Tier 2.

---

## 6. Alternative: a richer avatar via "Nano Banana" (Gemini image model)

The committed avatar is a clean vector that matches the brand and is enough to
ship. If you later want a more illustrative raster version, these refined prompts
target Google **Gemini 2.5 Flash Image** (CONTEXT.md §B). Keep whichever you
prefer; re-export to a 512×512 PNG and re-upload via BotFather.

- **Avatar:** "Minimalist flat-vector app icon: a stylized seismic waveform with a
  single amber peak, set inside a calm protective shield whose lower point reads
  as a map pin. Deep teal and dark-teal background, one warning-amber accent,
  off-white shield. Centered, simple, circular-safe, high contrast, no text,
  512×512. Trustworthy civic disaster-preparedness feel — not alarmist."
- **Severity set:** "Four matching circular badges — green, gold-yellow, orange,
  red — each with the same white seismic-wave glyph on a solid colored disk,
  amplitude increasing green→red, thin darker rim, flat minimal style, consistent
  line weight, no text, transparent background."

---

## 7. Before you publish

Replace these placeholders, then run the checklist:

- `[ABOUT_PAGE_URL]` — the public terms/privacy page. If GitHub Pages is enabled
  for this repo's `docs/` folder it will be `https://cflyby320-max.github.io/palu-quake-alert/`
  (confirm it's live before sharing). Otherwise drop the line.
- `[CHANNEL_INVITE_LINK]` — add the channel's invite link wherever you share the
  bot (not embedded above; used when you circulate the join link).

**Apply checklist (all in the Telegram app — none of this is automated):**

- [ ] BotFather → set **Name**, **About**, **Description** (§2)
- [ ] BotFather → **Edit Botpic** → upload `docs/assets/avatar.png`
- [ ] Set the **channel** photo to the same avatar
- [ ] Decide commands: **no menu** (recommended) or the info-only list (§3)
- [ ] Post the **welcome/safety message** (§4) in the channel and **pin** it
- [ ] Confirm `[ABOUT_PAGE_URL]` loads; fix or remove the line
- [ ] Sanity-check the avatar at small size in a real chat list (~40 px)
