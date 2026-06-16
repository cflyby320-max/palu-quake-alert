# Palu Earthquake Alert — Project Context & Handoff

> Paste this whole file into an LLM as context. It is self-contained: an assistant
> with no access to the code can still help using what's below. **No secrets or
> personal data are included** (bot token + recipient chat IDs live only in `.env`
> and GitHub Secrets — never put them in this file).

---

## 1. What this is — and what it is NOT (must preserve in all public copy)

A small system that sends **rapid earthquake & tsunami-caution alerts** to family/
friends connected to **Palu, Central Sulawesi, Indonesia** (high quake + tsunami
risk; site of the 2018 M7.5 disaster).

- It is a **rapid notification** tool: alerts arrive ~**2–5 minutes AFTER** a quake
  is detected/published by official feeds. It is **NOT** "early warning" (no
  seconds-before-shaking; that needs a P-wave sensor network we don't have).
- The genuine "before" value: for a nearby quake, the alert can still land **before
  the tsunami or aftershocks reach people** → time to move to high ground.
- **Non-negotiable safety rule:** never present "no tsunami potential" as "safe."
  For a large, shallow quake near the coast, the alert always tells people to move
  to high ground regardless of the official flag (the 2018 tsunami was
  landslide-driven, unpredicted, and the warning was lifted early).
- It must **never replace** official BMKG warnings, sirens, or local authorities —
  always defer to them. Any copy/disclaimer must say this.

## 2. Current state & architecture

- **Language/stack:** Node.js, **zero third-party dependencies** (built-in `fetch`,
  test runner, `--env-file`). Pure stdlib by design = fewer things to break.
- **Data sources:** **BMKG / InaTEWS** (Indonesia's official agency) = primary,
  fast, local; **USGS** = cross-check / fallback. The two are merged so one quake =
  one alert, tagged "confirmed by BMKG+USGS" vs. "preliminary."
- **Delivery:** **Telegram bot** = `@Palu_quake_alert_bot` ("Palu Earthquake
  Alerts"). Code also supports Twilio SMS / WhatsApp (not yet configured).
- **Messages:** bilingual (Bahasa Indonesia + English), local time in WITA (UTC+8).
- **Repo:** `https://github.com/cflyby320-max/palu-quake-alert` (private).
- ⚠️ **The bot is SEND-ONLY.** The code fetches data and *sends* messages. It does
  **not** listen for or respond to user commands, and recipients are a **static,
  comma-separated list** in config. There is no `/start`, `/stop`, or subscriber
  database yet. This is the key limitation for workstreams 1 & 3 below.

## 3. How an alert is decided (parameters & levels)

Alert fires when an event is: within radius **AND** ≥ floor magnitude **AND**
recent **AND** not already alerted (dedup). All values are env-overridable.

| Parameter | Default | Meaning |
|---|---|---|
| `INFO_MAGNITUDE` | 4.0 | alert floor; below this = log only |
| `MIN_MAGNITUDE` | 5.0 | boundary between LOW and MODERATE |
| `STRONG_MAGNITUDE` | 6.0 | likely strongly felt nearby |
| `TSUNAMI_MAG` | 6.5 | large shallow quakes ≥ this get a high-ground caution |
| `SHALLOW_KM` | 70 | "shallow" depth threshold |
| `ALERT_RADIUS_KM` | 350 | distance from Palu considered |
| `MAX_EVENT_AGE_HOURS` | 2 | ignore stale events (no startup spam) |

**Severity levels:** 🟢 LOW (4.0–4.9, heads-up) · 🟡 MODERATE (5.0–5.9) ·
🟠 HIGH (≥6.0 within 200 km, or tsunami caution) · 🔴 CRITICAL (≥7.0 or official
tsunami warning).

## 4. Deployment (two free layers)

- **Home PC** — runs continuously, polls every **45s** (fast; only while PC is on).
  Auto-starts at logon via a Startup-folder launcher; single-instance locked.
- **GitHub Actions (cloud)** — `.github/workflows/monitor.yml` runs `node run.js
  --once` every **30 min** as an always-on backup (free on a private repo; 5-min
  would exceed the 2,000 free Actions-min/month). Secrets stored in GitHub Secrets.
  Caveat: GitHub auto-disables scheduled jobs after 60 days of repo inactivity.

---

# OPEN WORKSTREAMS (what you want help building)

## A) Bot interface — description, terms/disclaimer, commands

**Goal:** make the bot look complete and trustworthy, especially if it circulates.

**Key technical reality:** BotFather lets you set name/about/description/commands,
but a **command menu only shows suggestions — the bot won't actually respond to
`/start` etc. unless code is added to receive updates** (Telegram long-polling or a
webhook). So decide:
- **Cosmetic only** (BotFather text + a static command list shown in the menu, with
  a note that the bot is broadcast-only) — quick, no code.
- **Interactive** (real `/start` subscribe, `/stop` unsubscribe, `/status`) —
  requires a new always-on "listener" component + a subscriber store (see C).

**What to produce:**
- **Name / About (≤120 chars) / Description (≤512 chars)** — calm, clear, bilingual
  or ID-first. State plainly it's unofficial and ~minutes-delayed.
- **Command list** for BotFather, e.g.:
  `start` – subscribe / mulai · `stop` – unsubscribe / berhenti ·
  `status` – system status · `about` – about this bot · `disclaimer` – terms.
- **Terms & disclaimer** (see starter draft in §7) — important if shared publicly.

## B) Visual design — using "Nano Banana" (Google Gemini image model)

**Goal:** a bot avatar (and optionally alert-level icons / a small brand kit).

**Brand direction:** trustworthy, calm, civic/disaster-preparedness — **not**
alarmist or toy-like. Audience is Indonesian families. Suggested motifs: a seismic
wave, a location pin over Sulawesi/Palu, a protective shield. Palette: a calm,
trust-building primary (deep teal / indigo) plus the severity colors
(green→yellow→orange→red). Avoid embedded text (illegible when small).

**Telegram specs:** profile photo is **square, ≥512×512**, displayed as a **circle**
— keep the subject centered and simple; must read at ~40px.

**Starter prompts for Nano Banana (refine to taste):**
- *Avatar:* "Minimalist flat vector app icon, a stylized seismic waveform forming a
  protective shield over a location pin on the island of Sulawesi, deep teal and
  indigo with a single warning-amber accent, calm and trustworthy, centered,
  circular-safe composition, no text, high contrast, 512×512."
- *Icon set:* "A set of four matching circular severity badges — green, yellow,
  orange, red — each with a simple seismic-wave glyph, flat minimal style,
  consistent line weight, no text."

## C) Scaling beyond 4–5 recipients (friends & family, maybe wider)

**Current limit:** recipients are a hardcoded list in `.env` / GitHub Secret.
Doesn't scale, no self-service, no unsubscribe. Two paths:

1. **Telegram Channel (simplest for broad reach — recommended to evaluate first).**
   Create a Telegram **channel**; the bot posts each alert once and **every member
   sees it**. People join via an invite link; no per-user sending, no subscriber DB,
   no rate-limit juggling. Trade-offs: less personalization, no per-user severity
   filtering, and you post to the channel via the bot as admin. Best when the goal
   is "circulate widely with minimal ops."

2. **Subscriber-managed bot (more work, more control).** Requires:
   - A **persistent subscriber store** (SQLite / hosted DB / even a simple file) —
     not `.env`.
   - A **listener component** (long-polling or webhook) so `/start` and `/stop`
     manage the list themselves. **This means moving off GitHub Actions cron to an
     always-on host** (small VPS / Fly.io / Railway / Raspberry Pi) that both listens
     and broadcasts.
   - **Broadcast throttling:** Telegram allows ~**30 messages/second** for bots;
     bulk sends to many chats must be paced (fine for hundreds; queue for thousands).
   - **Privacy/PII:** you'd store many people's chat IDs — provide easy unsubscribe,
     a short privacy note, and don't expose the list.
   - **Abuse control** if public: a subscribe confirmation, optional region/severity
     preferences.

**Recommendation to hand the LLM:** decide reach first. *Close circle of
friends/family* → Channel is easiest and nearly free of new code. *Open/public with
preferences* → subscriber bot + always-on host + DB. Either way, scaling pushes you
**off the static-list + GitHub-cron design** toward a small persistent service.

---

## 5. Constraints & decisions to preserve (do not regress)

- Keep the **honest framing** (not early warning; defer to BMKG/sirens) and the
  **tsunami high-ground rule** in any new copy or feature.
- Prefer **few/zero dependencies**; keep secrets out of the repo and off Google
  Drive sync (use host secret stores).
- BMKG primary, USGS fallback; dual-source confirmation is a feature, keep it.
- Bilingual (ID + EN), WITA time, calm tone — avoid alert fatigue (that's why the
  default floor is M4.0, not every micro-quake).

## 6. Reference links

- BMKG InaTEWS: https://inatews.bmkg.go.id/
- BMKG live feeds: `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`,
  `.../gempaterkini.json`, `.../gempadirasakan.json`
- USGS FDSN event API: https://earthquake.usgs.gov/fdsnws/event/1/
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram bot features (commands, etc.): https://core.telegram.org/bots/features
- BotFather: https://t.me/BotFather
- Telegram channels FAQ: https://telegram.org/faq_channels
- Nano Banana = Google **Gemini 2.5 Flash Image** (generation/editing):
  https://ai.google.dev/ (Gemini API → image generation)
- Repo (private): https://github.com/cflyby320-max/palu-quake-alert
- Bot: https://t.me/Palu_quake_alert_bot

## 7. Starter drafts (refine freely)

**About (≤120 chars):**
> Peringatan cepat gempa & potensi tsunami untuk Palu. Tidak resmi — selalu ikuti
> BMKG & petugas. / Rapid Palu quake & tsunami-caution alerts. Unofficial.

**Description (≤512 chars):**
> Bot ini mengirim peringatan cepat saat terjadi gempa di sekitar Palu, bersumber
> dari BMKG dan USGS, biasanya 2–5 menit setelah kejadian. Ini BUKAN peringatan dini
> dan BUKAN pengganti BMKG, sirene, atau petugas — selalu utamakan sumber resmi.
> Jika terjadi guncangan kuat di dekat pantai, segera ke tempat tinggi tanpa
> menunggu konfirmasi. / Rapid alerts for quakes near Palu from BMKG & USGS, usually
> 2–5 min after an event. Not early warning; not a substitute for official sources.

**Disclaimer / Terms (starter — have a local person review):**
> 1. Informational only; sourced from BMKG & USGS; may be delayed, incomplete, or
>    revised. No guarantee of accuracy, timeliness, or delivery.
> 2. NOT an official warning and NOT early warning. Always follow BMKG, local
>    sirens, and authorities first.
> 3. Tsunami: if you feel strong shaking near the coast, move to high ground
>    immediately — do not wait for any confirmation or "all clear."
> 4. Privacy: your Telegram chat ID is stored only to send you alerts. Use /stop to
>    unsubscribe (when interactive mode is enabled).
> 5. Provided "as is," without liability. Use at your own risk.

**Suggested command list (BotFather format):**
```
start - Subscribe to Palu alerts / Mulai
stop - Unsubscribe / Berhenti
status - System & sources status
about - About this bot
disclaimer - Terms & safety notice
```
*(Note: these only respond if a listener component is added — see workstream A/C.)*
