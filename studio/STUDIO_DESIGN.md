# STUDIO_DESIGN.md — Instagram content agent

The **studio** is a self-contained module that turns the project's earthquake data
into branded Instagram posts: it **drafts** a card + caption, lets **you approve**,
then **publishes** via Instagram's official API. "AI creates, you approve."

It is deliberately **separate from the safety watcher**. The watcher in `src/`
stays zero-dependency and never imports anything here; studio may use a couple of
dependencies (image rasteriser) because it is non-safety-critical and runs as its
own process/schedule. A failure in studio must never affect alert delivery.

---

## 1. Decisions already locked

| Question | Decision | Why |
|---|---|---|
| How to post | **Official Instagram Graph API** (Content Publishing) | Pure HTTPS `fetch`; allowed by Meta; stable. No password-bots (ToS + ban risk). |
| Automation level | **AI drafts → human approves → publish** | A safety brand must never auto-post unreviewed quake content. |
| Image | **BMKG shakemap composited into a branded card** → PNG | Reuses data we already fetch; on-brand; honest framing baked in. (PNG because manual upload accepts it — no JPEG step needed yet.) |
| Module boundary | **`studio/` is isolated**; watcher stays zero-dep | One broken dependency must never take the alerter down. |
| Design source | **`studio/preview.html`** (already built) | Visual reference; production renderer mirrors this layout in SVG. |

---

## 2. Pipeline

```
TRIGGER ──> RENDER ──> HOST ──> REVIEW ──> PUBLISH
(catalog   (event ->  (JPEG ->  (Telegram   (Graph API:
 or         branded    public    preview +    container ->
 schedule)  JPEG)      URL)      you approve) media_publish)
```

1. **Trigger** — a notable quake lands in the persisted catalog (`state.json`), or an
   evergreen/recap slot fires on a schedule.
2. **Render** — build the branded card as an SVG (the `preview.html` layout), embed the
   shakemap, rasterise to JPEG.
3. **Host** — put the JPEG at a public URL (Instagram *fetches* the image; it does not
   accept uploaded bytes).
4. **Review** — send the image + caption to your private Telegram; you approve, edit, or
   reject. Nothing publishes without approval.
5. **Publish** — two-step Graph API call.

---

## 3. Proposed file layout

```
studio/
  STUDIO_DESIGN.md      this doc
  preview.html          design reference (done)
  template.js           buildCardSvg(event) -> SVG string  (ports preview.html)
  render.js             SVG + shakemap bytes -> card.jpg    (uses rasteriser dep)
  caption.js            buildCaption(event) -> Indonesian caption (deterministic)
  host.js               publishImage(jpgPath) -> public URL
  publish.js            two-step Graph API container -> media_publish
  plan.js               picks what to post (reactive + evergreen + recap)
  content/              evergreen content bank (preparedness tips, anniversary)
  queue/                drafts awaiting approval: <id>/{card.jpg, caption.txt, meta.json}
  state.json            studio dedup state (posted ids) — separate from src state
  package.json          studio-only deps (NOT installed by the watcher)
  studio.js             CLI entry: --draft | --review | --publish | --dry-run | --test
```

The watcher's `package.json` stays untouched (still zero-dep). Studio has its **own**
`package.json` so its dependency lives only in studio's runtime.

---

## 4. Rendering the card

The card is all rectangles + text + one image — trivial to express as an **SVG string**
(the inline mockup already proved this). `template.js` builds it; the shakemap is embedded
as a base64 data URI so the rasteriser needs no network:

```
const bytes = await fetch(event.shakemap).then(r => r.arrayBuffer());     // already public
const dataUri = `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`;
const svg = buildCardSvg({ ...event, shakemapDataUri: dataUri });
```

**Rasteriser (the one sanctioned dependency) — BUILT: `@resvg/resvg-js`.** Renders the SVG
(with the embedded shakemap) straight to PNG, no headless browser, reliable text. Imported
**only** by `render.js`; `../src` never sees it. We output **PNG** — manual Instagram upload
accepts it, so no `sharp`/JPEG step is needed. (If/when we add the Graph API auto-post path,
which prefers JPEG, add the conversion there.)

⚠️ **Google Drive `node_modules` gotcha.** This repo lives under `G:\My Drive\…`. Drive's
virtual filesystem corrupts npm's concurrent small-file extraction (0-byte `package.json`,
tar write errors) and does **not** support junctions. Workaround that works:
`npm install --prefix C:\temp\palu-studio-deps` (a normal disk), then `cp -r` the intact
`node_modules` onto Drive. On a real host (Fly/Linux) a plain `npm install --prefix studio`
is fine. `studio/node_modules` is gitignored regardless.

Output spec: **PNG**, 1080×1350 (4:5). (Graph API later wants JPEG ≤8 MB, aspect 4:5–1.91:1.)

**Conditional layout** (mirror `classify()` in `src/core.js`):
- M < `MIN_MAGNITUDE` → green "Ringan" chip + calm reassurance line.
- Strong shallow (the high-ground case) → red chip + **amber high-ground caution band**.
- Official tsunami warning → red "Kritis" + explicit tsunami line.
These are the same safety rules already enforced for the text alerts — the card must not
diverge from them.

---

## 5. Hosting the image

Instagram fetches `image_url`, so the JPEG must be at a **public URL returning 200 +
`image/jpeg`**. The image only needs to be live during the container→publish window —
after publish, Instagram keeps its own copy, so sources can be pruned.

- **Recommended v1: a dedicated public GitHub repo** (e.g. `palu-alert-media`). `host.js`
  commits the JPEG and returns the `raw.githubusercontent.com/...` URL. Zero new server code;
  raw serves the correct content-type. Prune after a successful publish.
- **Alternative: a static route on the existing Fly.io app** serving `/media/<id>.jpg` from
  the `/data` volume. Avoids a second repo but adds an HTTP handler to a process that
  currently has none.

(Open decision — see §11.)

---

## 6. Approval gate (human-in-the-loop)

The bot is currently **send-only** (see CLAUDE.md), so v1 avoids needing inbound Telegram:

- **v1 (recommended): preview + CLI publish.** `--draft` writes the draft to
  `queue/<id>/` and sends you a Telegram preview (image + caption + the queue id). You
  review, then run `node studio/studio.js --publish <id>` to push it live (or `--publish all`).
  Simple, no new bot infrastructure, you stay fully in control.
- **v2 (later): Telegram inline buttons.** Approve / Edit / Reject buttons under the preview,
  handled by polling `getUpdates` (or a webhook). This is the **interactive-bot workstream**
  already described in `CONTEXT.md` — build it there, and studio approval rides on top.

Either way: **no approval, no publish.** A draft left unapproved expires (configurable).

---

## 7. Publishing (Graph API, pure `fetch`)

```
// 1) create media container
POST https://graph.facebook.com/<vXX>/<IG_USER_ID>/media
     ?image_url=<PUBLIC_JPEG_URL>&caption=<ENCODED>&access_token=<TOKEN>
  -> { id: CONTAINER_ID }

// 2) (optional) poll until ready
GET  .../<CONTAINER_ID>?fields=status_code&access_token=<TOKEN>   // FINISHED

// 3) publish
POST .../<IG_USER_ID>/media_publish?creation_id=<CONTAINER_ID>&access_token=<TOKEN>
  -> { id: MEDIA_ID }
```

- Limits: **100 published posts / 24 h**, 200 req/h — irrelevant at our volume.
- `--dry-run` stops before `media_publish` (build + host + preview only).

**Meta account setup (the real gating step — entirely on Meta's side):**
1. Convert the Instagram account to **Business/Creator**, link a **Facebook Page**.
2. Create a **Meta Developer App**, add the Instagram Graph API product.
3. Get the **IG user id** and a **long-lived access token** (~60 days).
4. **Development mode is enough to publish to your own connected account** — App Review
   (~2–4 weeks) is only needed to go beyond your own/test accounts. So we can ship without it.
5. ⚠️ **Token expiry footgun:** the long-lived token lasts ~60 days and must be refreshed.
   Add a refresh step + a heartbeat/alert so a silently expired token is noticed.

---

## 8. Content planning ("AI creates")

Two tracks, with **different risk profiles**:

- **Reactive (quake) posts → deterministic templates.** No LLM in the emergency path:
  `caption.js` fills a fixed Indonesian template from event fields, exactly like
  `buildMessage()`. Consistent, no hallucination risk. Triggered when a quake ≥
  `IG_POST_MIN_MAG` (higher than the M4 alert floor — not every tremor is post-worthy)
  lands in the catalog; deduped via studio `state.json`.
- **Evergreen / educational posts → LLM-assisted drafts you approve.** Preparedness tips
  (drop–cover–hold-on), the tsunami high-ground rule, the **2018 Palu anniversary (28 Sep)**,
  weekly seismic recaps from the catalog. Drafts come from a content bank in `content/`,
  optionally polished by the Claude API (`ANTHROPIC_API_KEY`, pure `fetch`) — but they still
  pass through the same approval gate, so LLM risk is bounded to non-emergency content.

`plan.js` decides which track fires and assembles the draft.

---

## 9. Configuration (studio-scoped env)

```
IG_ENABLED=true
IG_USER_ID=...                 # Instagram business account id
IG_ACCESS_TOKEN=...            # long-lived; refreshed (~60-day expiry)
IG_GRAPH_VERSION=vXX           # pin a current Graph API version
IG_POST_MIN_MAG=5.0            # magnitude floor for an auto-drafted reactive post
IG_HANDLE=@infogempapalu
REVIEW_CHAT_ID=...             # your private Telegram chat for approvals
IMAGE_HOST=github|fly          # hosting backend (see §5)
IMAGE_HOST_REPO=...            # if github: owner/repo + token
ANTHROPIC_API_KEY=...          # optional, evergreen caption drafting only
```

Reuses the existing `TELEGRAM_BOT_TOKEN`. All secrets in `.env`/host store, never committed.

---

## 10. Safety & brand invariants (carried over from CLAUDE.md)

The Instagram copy obeys the same rules as the alerts — they do not get relaxed for social:
- **Bahasa Indonesia only, WITA time, calm tone.** Time from the UTC timestamp, never BMKG's WIB.
- **Never an "all-clear"; never a prediction.** "No tsunami potential" is not "safe."
- **High-ground rule** preserved for strong shallow quakes (precautionary, regardless of flag).
- **Honest framing in every post:** "notifikasi cepat — bukan peringatan dini · ikuti BMKG."
- **No false precision, no alarmist imagery,** accurate magnitudes, defer to BMKG.

A render test should assert the SVG/caption contains the framing footer and the correct
conditional band before rasterising.

---

## 11. Phased rollout (de-risk Meta first)

- **Phase 0 — Prove publishing (smallest, highest-risk-retiring).** Do the Meta setup (§7),
  then a ~40-line script that publishes one hardcoded hosted JPEG end-to-end. If this works,
  everything else is mechanical.
- **Phase 1 — Renderer. ✅ DONE.** `template.js` (SVG, ports `preview.html`) + `caption.js`
  (deterministic Indonesian) + `render.js` (resvg → PNG) + `studio.js --demo`. Verified against
  the live BMKG feed: event → branded PNG + caption in `studio/out/`.
- **Phase 2 — Hosting.** `host.js`: JPEG → public URL (+ prune-after-publish).
- **Phase 3 — Reactive trigger. ✅ DONE.** `src/monitor.js` calls `studio/hook.js` after every
  family alert (opt-in via `STUDIO_ENABLED`), lazily-imported, isolated, non-blocking. Fires for
  ALL alerting events — no magnitude gate.
- **Phase 4 — Delivery to operator. ✅ DONE (manual mode).** `studio/deliver.js` DMs the card +
  caption to your private Telegram (`STUDIO_REVIEW_CHAT_ID`); you post to Instagram by hand. (The
  `--publish`/Graph-API half is only for the future auto-post path — Phases 0 & 2.)
- **Phase 5 — Evergreen + schedule. ✅ DONE (manual mode).** A pillar-structured content bank
  (`studio/content/bank.js`, calendar in `studio/content/CALENDAR.md`) drives educational cards +
  carousels for the quiet periods between quakes — three pillars (Kenali Wilayahmu / Siap Sebelum
  Bencana / Saring Sebelum Sebar) plus the 28-Sep anniversary, built from the Sulawesi Tengah
  content strategy. `studio/edutemplate.js` renders each slide through the **shared brand chrome**
  (`studio/svg.js`, also used by the quake card, so the honest-framing footer can never diverge);
  `renderEduPost` rasterises a card or a multi-slide carousel; `deliverDraft` DMs a single photo or
  a media-group album to the operator for **manual** posting to the channel + Instagram. Captions
  are **pre-authored** (no LLM in the default path) with qualified 2018 figures and the
  BMKG/BNPB/BPBD routing baked in; the **opt-in `--llm`** flag rephrases a caption via the Claude
  Messages API (`ANTHROPIC_API_KEY`, pure `fetch`, model `STUDIO_LLM_MODEL`), re-appends the fixed
  framing, runs `validateEduCaption`, and **falls back to the authored caption** on any
  failure/validation miss — so the LLM can never put an unsafe claim on a post.
  CLI: `node studio/studio.js --edu` (list) · `--edu <id> [--dry-run] [--llm]` · `--edu-all`.
  Safety invariants are enforced offline by `test/studio_content.test.js`.
- **Phase 6 — (optional) Telegram buttons.** Inline approve/reject, via the interactive-bot
  workstream in `CONTEXT.md`.

After Phase 4 the system is fully usable: real quakes → reviewed, branded posts.

---

## 12. Testing

- **Offline render test:** feed a fixture event → assert the SVG string contains magnitude,
  WITA time, the conditional band, and the honest-framing footer (assert on the SVG, before
  rasterising — no image diffing needed).
- **Dry-run publish:** `--dry-run` exercises render + host + preview, stops before
  `media_publish`. No credentials, no network in CI (same philosophy as the watcher's tests).

---

## 13. Decisions for you (defaults in **bold**)

1. **Caption generation:** deterministic templates for quakes, **LLM-assisted only for
   evergreen** — or skip the LLM entirely and template everything?
2. **Image hosting:** **dedicated GitHub media repo** (no new server) vs Fly static route?
3. **Approval UX for v1:** **CLI `--publish`** now, Telegram buttons later — or build buttons up front?
4. **`IG_POST_MIN_MAG`:** ~~what's "post-worthy"?~~ **RESOLVED — no threshold.** The draft
   rides on the same trigger as the family alert, so every alerting event (M≥4.0 near Palu,
   including sub-M5.0) produces a draft. No separate IG magnitude gate.
5. **Where studio runs:** **the always-on Fly host** (so drafts reach you even when your PC is
   off — the only manual step, tapping "post", happens on your phone). Resolved during build.

---

## 14. Turning on manual mode (what's built)

The full manual loop is live: **watcher detects a quake → renders a branded card → DMs it to you
on Telegram → you post to Instagram by hand.** No Meta account, no auto-posting, no image hosting.

To enable:
1. Install studio deps: `npm install --prefix studio` (on Google Drive, see §4's gotcha).
2. In `.env`: `STUDIO_ENABLED=true` and `STUDIO_REVIEW_CHAT_ID=<your own chat id>` (start a chat
   with the bot, then read your id from `https://api.telegram.org/bot<TOKEN>/getUpdates`). The
   token defaults to the existing `TELEGRAM_BOT_TOKEN`.
3. Manual preview anytime: `node studio/studio.js --draft` (add `--dry-run` to render without sending).

**On Fly (production):** the Dockerfile must `npm install --prefix studio` so the render
dependency is present; the DejaVu fonts are committed under `studio/assets/fonts/`, so text
renders with no system fonts. (Not yet wired into the Dockerfile — the next deployment step.)
