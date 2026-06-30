# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A safety tool that sends **rapid earthquake & tsunami-caution alerts** to family in **Palu, Central Sulawesi, Indonesia** (site of the 2018 M7.5 disaster). It polls two independent feeds — **BMKG/InaTEWS** (Indonesia's official agency; primary) and **USGS** (cross-check/fallback) — merges them so one physical quake produces one alert, and pushes a Bahasa Indonesia message via Telegram and/or Twilio SMS/WhatsApp.

**The watcher (`src/`) is Node.js with zero third-party dependencies — by design.** It uses only stdlib: global `fetch`, `node:fs`, the `node:test` runner, and `--env-file`. There is no `npm install` step and no lockfile for the watcher. Keep it that way: every dependency is one more thing that can break in a tool people trust with their safety. Requires Node >= 20. (The one sanctioned exception is the optional, deliberately isolated `studio/` Instagram module, which has its **own** `package.json` and a single dependency — see [Instagram studio](#instagram-studio-studio). It is opt-in and can never affect alert delivery.)

## Commands

```bash
node run.js --help        # usage
node run.js --test        # offline demo: runs the full pipeline on captured real data (fixtures/), dry-run, sends nothing
node run.js --selftest    # check live BMKG/USGS connectivity + which channels are configured
node run.js --testsend    # send a REAL test message to every configured channel (needs .env)
npm test                  # run the offline unit tests (node --test); no network or credentials needed

# Live operation (needs a configured .env):
node --env-file=.env run.js          # continuous monitoring loop (polls every POLL_SECONDS)
node --env-file=.env run.js --once   # single cycle, for cron / GitHub Actions
node --env-file=.env run.js --outlook # post an aftershock-probability Outlook for the latest mainshock (add --dry-run to preview)
node --env-file=.env run.js --digest [h] # post a catch-up recap of recent quakes from the local catalog (default 24h; add --dry-run to preview)
node run.js --dry-run                # log alerts but never send externally
```

`npm run` aliases exist for the common cases: `start`, `once`, `selftest`, `demo`, `test`.

Run a single test by name (Node's test runner):
```bash
node --test --test-name-pattern="cross-source merge" test/offline.test.js
```

There is no linter or build step configured.

## Architecture

The entry point `run.js` calls `main()` in `src/monitor.js`, which dispatches on CLI flags. The core data flow for one cycle (`runOnce` in `src/monitor.js`) is a pipeline:

```
fetch BMKG + USGS (parallel, Promise.allSettled — one source failing is tolerated)
  → parse each into normalised Event objects
  → clusterEvents(): merge the two feeds' versions of the same quake into MergedEvent
  → accumulate near-Palu events (>= CATALOG_MIN_MAG) into the local catalog (for the Outlook)
  → filter: within ALERT_RADIUS_KM, magnitude >= INFO_MAGNITUDE, not stale (MAX_EVENT_AGE_HOURS)
  → dedup against persisted state (findPriorAlert)
  → classify() + buildMessage() → notifyAll() across all configured channels
  → if mainshock >= OUTLOOK_TRIGGER_MAG: buildOutlook() → notifyAll() (deduped, once)
  → if STUDIO_ENABLED: maybeSendStudioDraft() → studio renders a branded card + DMs it (isolated, failure-swallowed)
  → prune + save state, then heartbeat ping
```

### Module responsibilities

- **`src/config.js`** — all tunables come from env vars (with defaults) via helpers `num()` / `list()` / `bool()` (the last for kill-switches like `DIGEST_ENABLED`/`OUTLOOK_ENABLED`). Defines the `channels` object and `activeChannelNames()`. A channel is "active" only if its credentials are present, so the same code runs with Telegram, Twilio, both, or neither configured.
- **`src/sources.js`** — network I/O only. `fetchJson()` wraps `fetch` with timeout + retry. `fetchBmkg()` combines `autogempa.json` (latest single event) with `gempaterkini.json` (recent list) and dedups; BMKG has no server-side geo filter. `fetchUsgs()` uses the USGS FDSN API's server-side radius filter around Palu.
- **`src/core.js`** — **pure** (no network, no I/O), therefore fully unit-testable. Contains parsing (`parseBmkgEntry`, `parseUsgsFeature`), the `Event` and `MergedEvent` classes, `clusterEvents`, `classify`, `buildMessage`/`buildDigest`/`digestFromCatalog`, the per-alert context helpers (`compass`, `mapLink`, `sequenceOrdinal`), and the **Seismic Activity Outlook** math (`expectedAftershocks`, `probAtLeastOne`, `bValueMLE`, `probBucket`, `outlookStats`, `buildOutlook` — see `OUTLOOK_DESIGN.md`). Most domain logic and safety rules live here.
- **`src/state.js`** — JSON-file memory (`state.json`) holding three arrays — `alerted` (dedup), `catalog` (the local event history that feeds the Outlook **and the digest**; rows store `place`/`tsunamiFlag`/`felt` so the recap keeps its markers), and `outlooks` (Outlook dedup) — plus a `lastDigestIso` scalar (per-slot dedup for the twice-daily digest). `findPriorAlert`/`findPriorOutlook` match by the same time+distance window used for cross-source merging, so a quake is recognised even if it gained a second source between polls. `pruneState` drops `alerted`/`outlooks` older than `STATE_RETENTION_DAYS`; `pruneCatalog` keeps the catalog for `CATALOG_RETENTION_DAYS`.
- **`src/notify.js`** — multi-channel, multi-recipient delivery. Console + file log always run. External channels run only when configured; each send is independent so one failing never blocks the others. `dryRun` skips external sends.
- **`src/geo.js`** — `haversineKm` great-circle distance.
- **`src/monitor.js`** — orchestration, the CLI dispatch, the continuous loop, fixture loading for `--test`, the heartbeat ping, and a PID-lockfile single-instance guard (prevents double-sends when both a manual run and a logon-autostart run start a loop). The **twice-daily digest runs from inside this loop** (`maybeRunScheduledDigest`, fires at 08:00 & 20:00 WITA, deduped per-slot via `state.lastDigestIso`) and is built from the persisted catalog by `digestFromCatalog`, so the recap always matches the real-time alerts. It is NOT run from `--once` (which has no persistent catalog). After each delivered alert it also calls `maybeSendStudioDraft` (opt-in via `STUDIO_ENABLED`), which **lazily** `import('../studio/hook.js')` so the watcher stays zero-dependency unless studio is turned on; any studio failure is caught and logged so it can never delay or break an alert already sent.

## Instagram studio (`studio/`)

A **separate, optional** content module — *not* part of the safety watcher — that turns a quake into a branded Instagram post: it renders the BMKG shakemap into an on-brand card (1080×1350 PNG) with a deterministic Bahasa Indonesia caption and DMs the draft to the operator's private Telegram for **manual** posting ("AI drafts → you approve → you post"). The full spec and safety/brand rules are in **`studio/STUDIO_DESIGN.md`** — read it before touching anything here.

Key boundaries:

- **Isolated by design.** `studio/` has its **own `studio/package.json`** with a single third-party dependency, `@resvg/resvg-js` (the SVG→PNG rasteriser — the only dependency in the whole repo). The watcher in `src/` never imports it; studio is imported lazily only from `maybeSendStudioDraft` in `src/monitor.js`, gated on `STUDIO_ENABLED`, and every failure is swallowed. A broken studio dependency must never take the alerter down. Fonts (`studio/assets/fonts/DejaVuSans*.ttf`) are committed so text renders with no system fonts; `studio/node_modules` and `studio/out/` are gitignored, and studio keeps its **own** dedup memory (`studio/state.json`, separate from the watcher's `state.json`).
- **Same safety/brand invariants as the alerts** (§10 of `STUDIO_DESIGN.md`): Bahasa Indonesia only, WITA time, calm tone, never an "all-clear" or prediction, the high-ground rule for strong shallow quakes, and the honest-framing footer ("notifikasi cepat — bukan peringatan dini · ikuti BMKG"). The card's conditional band mirrors `classify()` in `src/core.js` and must not diverge from it.
- **CLI:** `node studio/studio.js --demo` (render the live BMKG latest quake to `studio/out/`), `node studio/studio.js --draft [--dry-run]` (render **and** DM the draft to Telegram; `--dry-run` renders without sending). Reactive drafts fire automatically from the watcher loop after a delivered alert. Enable with `STUDIO_ENABLED=true` + `STUDIO_REVIEW_CHAT_ID=<your chat id>` in `.env` (the bot token defaults to the existing `TELEGRAM_BOT_TOKEN`); install its dependency with `npm install --prefix studio`.

Currently manual-mode only: the Graph-API auto-publish path (`--publish`) and image hosting are designed but not the active flow — `STUDIO_DESIGN.md` §11 tracks the phased rollout.

## Design SDK and roadmap status

The design-system roadmap is now tracked in `design/`. Do not re-audit the full
repository for routine design work; start with the SDK files and then inspect
only the runtime files touched by the task.

Latest completed commit: **`aa2a9eb` "studio: integrate approved educational
assets"** — the Asset Bank Sprint 1 assets are now composed into the educational
templates and the corrected preview batch (Preview 4) is committed. The full
offline suite **passed 112 tests**. Nothing in the watcher, alerts, severity
classification, prompts, captions, posting, or external-API behavior changed —
this remains review-only, manual-post studio work.

Completed design phases:

- **Phase 1 Foundation:** `design/DESIGN_SDK.md`, `VISUAL_LANGUAGE.md`,
  `RENDERING_CONTRACT.md`, `ILLUSTRATION_BIBLE.md`, `DESIGN_TOKENS.json`,
  `ASSET_INDEX.json`, and `design/references/`.
- **Phase 2 Studio integration:** `studio/design-sdk.js` reads
  `design/DESIGN_TOKENS.json` for core colors, canvas size, and mandatory
  footer values.
- **Phase 3 Template registry:** `design/TEMPLATE_REGISTRY.json` and
  `studio/template-registry.js` define and validate structured render specs.
- **Phase 4A Asset library foundation:** `design/ASSET_SCHEMA.json`,
  `design/assets/`, and enriched `ASSET_INDEX.json` define asset taxonomy and
  intake rules. No new production asset packs have been generated yet.
- **Asset Bank Sprint 1 (integrated):** eleven local, textless SVG patterns,
  icons, and one preparedness illustration were approved on 2026-06-27, indexed
  as `committed` with `approved` safety review, and are **now composed into the
  educational templates** (no longer intake-only). `studio/asset-library.js`
  loads them fail-closed, `studio/outbox/asset-bank-review-2/` preserves the
  approved contact sheet, and four revised assets use locally vendored, adapted
  CC0 sources with recorded provenance. Approved assets are **available
  primitives, not a per-batch usage quota** — a render spec may intentionally
  leave every optional asset slot empty (e.g. Card 4 uses none). The four active
  slot roles are `ambient_pattern` (one uncropped textless pattern in the
  template-owned `header_right` region, `contain` fit, opacity ceiling 0.24,
  below text), `row_icons` (one textless icon per matching row, `contain` in
  fixed boxes), `focal_illustration` (one textless illustration on a quiet solid
  surface — never alongside an ambient pattern), and `poster_background` (one
  background/photo/illustration below a tonal scrim; patterns are not valid
  here). `design/TEMPLATE_REGISTRY.json` owns each slot's role, region, fit,
  opacity ceiling, clear-text zone, layer, and cardinality; render specs select
  asset IDs only.
- **Phase 5A Content engine foundation:** `content/CONTENT_ENGINE.md`,
  `content/CONTENT_SCHEMA.json`, `content/SOURCE_INDEX.json`, and
  `studio/content-engine.js` convert structured content decisions into
  validated render specs. No AI calls or educational renderers are added.
- **Phase 5B Topic backlog workflow:** `content/topic_backlog.json`,
  `content/CALENDAR.md`, `content/TOPIC_BACKLOG_GUIDE.md`, and
  `studio/topic-backlog.js` add manual long-term topic planning and eligibility
  selection. It is planning-only: no auto-posting, rendering, external APIs, or
  alert pipeline changes.
- **Editorial outbox dry run:** `studio/outbox/editorial-dry-run-1/` contains
  five review-only evergreen content drafts with render decisions, captions,
  and missing-image notes. These are explicitly not approved for posting because
  educational template rendering is not implemented yet.
- **Approved asset integration (Preview 3 → Preview 4):**
  `studio/education-template.js` now composes the approved assets into their
  registry-approved slots, loading each through `studio/asset-library.js`, which
  **fails closed** — an asset that is not indexed, not `committed`+`approved`,
  not textless, outside `design/assets/`, path-escaping, or checksum-mismatched
  throws — while `studio/template-registry.js` rejects incompatible asset types,
  wrong row cardinality, and unapproved metadata. One invalid assigned asset
  aborts the entire `studio/render-educational-outbox.js` batch: there is **no
  partial or silent asset-free fallback**. **Preview 3 was rejected** by human
  review (badly cropped pattern banners, too many competing teal/purple motifs
  on Card 4, and the go-bag illustration overlapping the route-grid pattern on
  Card 5) and is **preserved frozen** under
  `studio/outbox/educational-render-preview-3/`, with per-file
  `frozenRenderSha256` hashes asserted by the tests. **Preview 4** added the
  role-specific fit / clear-space / layering constraints that fixed the
  cropping, the excessive motif layering, and the illustration overlap; it was
  **human-approved and committed** in `aa2a9eb` and **preserves all copy, source
  IDs, captions, the mandatory honest-framing footer, and BMKG positioning**
  unchanged from the source decisions. It still carries
  `review_required_not_auto_posted` / `humanApprovalRequired` — approval means
  the corrected render direction is accepted, not that any card is auto-posted.
  Covered by `test/approved_asset_integration.test.js`.

## Next session: start here

Do not re-read the entire repository. For the next roadmap sprint, read these
in order:

1. This `Design SDK and roadmap status` section.
2. `design/DESIGN_SDK.md` and `design/RENDERING_CONTRACT.md` (especially the
   "Educational Asset Composition" section).
3. `design/ASSET_INDEX.json` and `design/TEMPLATE_REGISTRY.json`.
4. `studio/asset-library.js`, `studio/template-registry.js`,
   `studio/education-template.js`, and `studio/render-educational-outbox.js`.
5. `studio/outbox/educational-render-preview-4/manifest.json`, the five
   per-topic `render-decision.json` files under it, and
   `test/approved_asset_integration.test.js`.

The next smallest roadmap step is to **generate the first human-approved
production batch** from the same validated Preview 4 decisions: take the
approved per-topic decisions, render the production-ready cards from them, and
record explicit per-card human approval. Do **not** introduce auto-posting, call
external/Graph APIs, create new assets, alter copy, or touch watcher/alert
behavior in that sprint. Preserve renderer-owned factual text, numbers, safety
instructions, mandatory footer placement, and BMKG positioning.

## Safety-critical invariants — do not regress

These encode hard-won lessons from the 2018 Palu tsunami (which was landslide-generated, unpredicted by standard models, and whose official warning was lifted early). They are deliberate and must be preserved in any change:

1. **"No tsunami potential" is NEVER treated as "safe."** In `classify()` (`src/core.js`), a large shallow quake (`mag >= TSUNAMI_MAG && depth <= SHALLOW_KM`) produces a precautionary high-ground `caution` **regardless** of the official tsunami flag. Both `parsePotensi` (BMKG) and the USGS parser comment that a `false`/`0` tsunami value is weak info, not a guarantee.
2. **Conservative source merging for tsunami status** (`MergedEvent.tsunamiFlag`): warn if ANY source warns.
3. **Honest framing.** This is rapid *notification* (~2–5 min after an event), not P-wave "early warning," and it does **not** replace BMKG/sirens/authorities. Keep this in any user-facing copy.
4. **Bahasa Indonesia only, WITA time, calm tone.** Messages are Indonesian-only — every recipient is family in Palu, so the former English half was dropped to keep emergency messages short and scannable (the action line stays near the top). Palu is WITA (UTC+8); time is computed from the UTC timestamp in `witaString` — do not use BMKG's WIB (`Jam`) field. The M4.0 default alert floor (`INFO_MAGNITUDE`) exists to avoid alert fatigue.
5. **Seismic Activity Outlook framing** (`buildOutlook`; full rules in `OUTLOOK_DESIGN.md` §5). The aftershock-probability message is STRICTLY an "elevated probability over the next N hours," NEVER a deterministic prediction and NEVER an "all-clear." It must always: state the small-but-real chance of a *larger* quake, keep the high-ground rule, show coarse buckets/ranges (no false-precision percentages), note the model can be wrong (2018 was atypical), and defer to BMKG. These are enforced by tests in `test/offline.test.js`.

Severity levels (`classify`): 🟢 LOW (below `MIN_MAGNITUDE`) · 🟡 MODERATE (>= `MIN_MAGNITUDE`) · 🟠 HIGH (strong nearby, or tsunami caution) · 🔴 CRITICAL (M>=7 or official tsunami warning).

## Parsing fragility

BMKG fields are free-text Indonesian strings whose format occasionally changes (e.g. `Kedalaman` = `"10 km"`, `Coordinates` = `"-1.04,120.23"`, `Potensi` is prose, `Dirasakan` = `"-"` when not felt). Parsing is intentionally defensive: malformed entries return `null` and are skipped rather than crashing the watcher. When touching parsers, preserve this — a feed glitch must never take the alerter down. The fixtures in `fixtures/` are captured real feeds; `scenario_m67_palu.json` is a frozen snapshot used to keep tests deterministic as the live feed rolls forward.

## Tests

All tests live under `test/` and are discovered offline by `npm test`
(`node --test`). The core watcher coverage includes `offline.test.js`
(parsing robustness, cross-source merge/no-merge, safety-critical
classification cases, dedup matching, WITA conversion) plus
`priority1.test.js` / `priority2.test.js` / `priority3.test.js` (added
coverage, prioritised by safety impact; P1 is the safety-critical cases).
Design-system coverage now also includes Studio/SDK token loading, template
registry validation, asset index/schema integrity, content engine validation,
topic backlog eligibility, editorial outbox dry-run validation, and educational
render preview validation. There are
no network or integration tests by design (no credentials in CI). The
`--test-name-pattern` example above filters by test name across the suite. As
of Asset Bank Sprint 1, `npm.cmd test` passes 101 tests.

## Deployment

- **Recommended production runtime:** the long-lived loop on an always-on host. Use `docker compose up -d --build` (see `docker-compose.yml`) on a VPS/Pi, or `fly.toml` on Fly.io. The `Dockerfile` points `STATE_FILE`/`LOG_FILE` at a `/data` volume so dedup state survives restarts; there is no `npm install` in the build.
- **Free backup only:** `.github/workflows/monitor.yml` runs `node run.js --once` on a 5-min cron. In practice GitHub drops/delays most scheduled runs (observed multi-hour gaps), and `keepalive.yml` exists because GitHub also disables scheduled workflows after 60 days of inactivity. This is NOT a reliable primary watcher — see the next point.
- **Heartbeat-gated backup (no double-sends):** the cron and the always-on host keep separate dedup state, so an unconditional backup would re-send every quake (the classic "same alert ~1h apart" when GitHub's delayed cron finally fires). The backup is therefore a dead-man's-switch: with `SUPPRESS_IF_PRIMARY_ALIVE=true` + `PRIMARY_HEARTBEAT_URL` (read, not pinged) + `HEALTHCHECKS_API_KEY` set, it sends **only** when the host's heartbeat is stale (host down), else suppresses external sends. The decision is the pure `shouldSuppressBackup()` in `src/monitor.js` (fails open on any uncertainty — a duplicate beats a miss), applied at the `--once` dispatch by reusing the `dryRun` plumbing; liveness is read by `fetchPrimaryLastPing()` in `src/sources.js`. The workflow must NOT set `HEARTBEAT_URL` (the backup reads the host's check, never pings it).
- **Heartbeat:** set `HEARTBEAT_URL` (e.g. healthchecks.io) so a silently dead watcher is detected. `heartbeat()` is only called after a healthy cycle, and only pings if the env var is set in *that* runtime. Known footgun: if `HEARTBEAT_URL` is not added to the GitHub Actions Secrets, the cloud backup never pings — so the healthcheck reflects only the always-on host (or, if there is none, only whenever a developer's PC happens to be running the loop). Also note `runOnce` returns early *before* the heartbeat when both sources fail.

## Configuration

All config is env-driven; see `.env.example` for the full annotated list and `src/config.js` for defaults. Key knobs: `PALU_LAT`/`PALU_LON`, `ALERT_RADIUS_KM` (350), `INFO_MAGNITUDE` (4.0), `MIN_MAGNITUDE` (5.0), `STRONG_MAGNITUDE` (6.0), `TSUNAMI_MAG` (6.5), `SHALLOW_KM` (70), `MAX_EVENT_AGE_HOURS` (6), `POLL_SECONDS` (45), `ESCALATION_DELTA` (0.5, re-alert when a preliminary magnitude is revised up by this much), `SHAKEMAP_MIN_MAG` (0, attach the BMKG shakemap image inline whenever BMKG provides one; raise to suppress images on smaller quakes), `SEQUENCE_WINDOW_HOURS` (24, lookback for the "Nth quake near Palu" aftershock-context line), `DIGEST_ENABLED` (true, kill-switch), `DIGEST_HOURS` (24, twice-daily recap window). **Seismic Activity Outlook** (see `OUTLOOK_DESIGN.md`): `OUTLOOK_ENABLED` (true, kill-switch), `OUTLOOK_TRIGGER_MAG` (5.5), `OUTLOOK_FELT_MAG` (4.0), `OUTLOOK_STRONG_MAG` (6.0), `AFTERSHOCK_A/B/P/C` (Reasenberg-Jones generic params), `CATALOG_MIN_MAG` (3.5), `CATALOG_RETENTION_DAYS` (60). **Instagram studio** (see `studio/STUDIO_DESIGN.md`): `STUDIO_ENABLED` (false; opt-in kill-switch for the auto-draft), `STUDIO_REVIEW_CHAT_ID` (the operator's private Telegram chat that receives drafts; the bot token defaults to `TELEGRAM_BOT_TOKEN`). Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`, `TWILIO_*`) belong in `.env` (gitignored) or host secret stores — never committed.

## Companion docs & public assets

- **`design/DESIGN_SDK.md`** — entry point for the civic design system. Read this before visual, template, asset, renderer, or content-engine work.
- **`design/TEMPLATE_REGISTRY.json`** — approved template IDs, text zones, asset slots, export targets, and render-spec validation rules.
- **`design/ASSET_SCHEMA.json`** and **`design/ASSET_INDEX.json`** — asset taxonomy, intake rules, existing committed assets, references, and planned asset categories.
- **`content/CONTENT_ENGINE.md`**, **`content/CONTENT_SCHEMA.json`**, and **`content/SOURCE_INDEX.json`** — structured content-decision layer and approved source ID vocabulary.
- **`content/topic_backlog.json`**, **`content/CALENDAR.md`**, and **`content/TOPIC_BACKLOG_GUIDE.md`** — manual topic planning workflow for long-term educational content. Human approval remains required.
- **`studio/education-template.js`** and **`studio/render-education.js`** — deterministic educational card renderer for validated evergreen render specs. It is Studio-only and never imported by the watcher.
- **`OUTLOOK_DESIGN.md`** — full spec + safety rules for the Seismic Activity Outlook (aftershock probability). Read before touching any Outlook math or copy.
- **`TIER2_PRESENTATION.md`** — the trust/presentation work (BotFather copy, pinned post, brand kit rationale).
- **`studio/STUDIO_DESIGN.md`** — full spec + safety/brand rules for the optional Instagram content studio (branded shakemap cards). Read before touching anything in `studio/`.
- **`CONTEXT.md`** — self-contained handoff doc for the open workstreams (interactive bot, brand assets, scaling). Note: it predates the Indonesian-only and Tier 2/3 changes, so some details (e.g. "bilingual messages") are stale relative to the code.
- **`docs/`** — the GitHub Pages site: `index.html` is the public About / Terms / Privacy page (Bahasa + English, links to the bot), `whitepaper.html` is the project white paper visualising how the work streams relate (linked from `index.html`), and `docs/assets/` holds the brand kit (`avatar.{png,svg}` and the four `severity-*` badges). These are user-facing assets, not wired into the runtime — keep their copy aligned with the safety framing (not early warning, defer to BMKG, high-ground rule).

## Known limitation: the bot is SEND-ONLY

The code fetches data and *sends* messages; it does not listen for or respond to Telegram commands, and recipients are a static comma-separated list in config. There is no `/start`/`/stop` or subscriber database. `CONTEXT.md` is a self-contained handoff document detailing the open workstreams (interactive bot interface, visual/brand assets, and scaling beyond a handful of recipients via a Telegram channel or a subscriber-managed bot) — read it before working on any of those.
