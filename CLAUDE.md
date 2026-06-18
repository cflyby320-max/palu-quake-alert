# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A safety tool that sends **rapid earthquake & tsunami-caution alerts** to family in **Palu, Central Sulawesi, Indonesia** (site of the 2018 M7.5 disaster). It polls two independent feeds — **BMKG/InaTEWS** (Indonesia's official agency; primary) and **USGS** (cross-check/fallback) — merges them so one physical quake produces one alert, and pushes a bilingual (Bahasa Indonesia + English) message via Telegram and/or Twilio SMS/WhatsApp.

**Node.js with zero third-party dependencies — by design.** It uses only stdlib: global `fetch`, `node:fs`, the `node:test` runner, and `--env-file`. There is no `npm install` step and no lockfile. Keep it that way: every dependency is one more thing that can break in a tool people trust with their safety. Requires Node >= 20.

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
  → filter: within ALERT_RADIUS_KM, magnitude >= INFO_MAGNITUDE, not stale (MAX_EVENT_AGE_HOURS)
  → dedup against persisted state (findPriorAlert)
  → classify() + buildMessage() → notifyAll() across all configured channels
  → prune + save state, then heartbeat ping
```

### Module responsibilities

- **`src/config.js`** — all tunables come from env vars (with defaults) via helpers `num()` / `list()`. Defines the `channels` object and `activeChannelNames()`. A channel is "active" only if its credentials are present, so the same code runs with Telegram, Twilio, both, or neither configured.
- **`src/sources.js`** — network I/O only. `fetchJson()` wraps `fetch` with timeout + retry. `fetchBmkg()` combines `autogempa.json` (latest single event) with `gempaterkini.json` (recent list) and dedups; BMKG has no server-side geo filter. `fetchUsgs()` uses the USGS FDSN API's server-side radius filter around Palu.
- **`src/core.js`** — **pure** (no network, no I/O), therefore fully unit-testable. Contains parsing (`parseBmkgEntry`, `parseUsgsFeature`), the `Event` and `MergedEvent` classes, `clusterEvents`, `classify`, and `buildMessage`. Most domain logic and safety rules live here.
- **`src/state.js`** — JSON-file dedup memory (`state.json`). `findPriorAlert` matches by the same time+distance window used for cross-source merging, so a quake is recognised even if it gained a second source between polls. `pruneState` drops entries older than `STATE_RETENTION_DAYS`.
- **`src/notify.js`** — multi-channel, multi-recipient delivery. Console + file log always run. External channels run only when configured; each send is independent so one failing never blocks the others. `dryRun` skips external sends.
- **`src/geo.js`** — `haversineKm` great-circle distance.
- **`src/monitor.js`** — orchestration, the CLI dispatch, the continuous loop, fixture loading for `--test`, the heartbeat ping, and a PID-lockfile single-instance guard (prevents double-sends when both a manual run and a logon-autostart run start a loop).

## Safety-critical invariants — do not regress

These encode hard-won lessons from the 2018 Palu tsunami (which was landslide-generated, unpredicted by standard models, and whose official warning was lifted early). They are deliberate and must be preserved in any change:

1. **"No tsunami potential" is NEVER treated as "safe."** In `classify()` (`src/core.js`), a large shallow quake (`mag >= TSUNAMI_MAG && depth <= SHALLOW_KM`) produces a precautionary high-ground `caution` **regardless** of the official tsunami flag. Both `parsePotensi` (BMKG) and the USGS parser comment that a `false`/`0` tsunami value is weak info, not a guarantee.
2. **Conservative source merging for tsunami status** (`MergedEvent.tsunamiFlag`): warn if ANY source warns.
3. **Honest framing.** This is rapid *notification* (~2–5 min after an event), not P-wave "early warning," and it does **not** replace BMKG/sirens/authorities. Keep this in any user-facing copy.
4. **Bilingual (ID + EN), WITA time, calm tone.** Messages are Indonesian-first then English. Palu is WITA (UTC+8); time is computed from the UTC timestamp in `witaString` — do not use BMKG's WIB (`Jam`) field. The M4.0 default alert floor (`INFO_MAGNITUDE`) exists to avoid alert fatigue.

Severity levels (`classify`): 🟢 LOW (below `MIN_MAGNITUDE`) · 🟡 MODERATE (>= `MIN_MAGNITUDE`) · 🟠 HIGH (strong nearby, or tsunami caution) · 🔴 CRITICAL (M>=7 or official tsunami warning).

## Parsing fragility

BMKG fields are free-text Indonesian strings whose format occasionally changes (e.g. `Kedalaman` = `"10 km"`, `Coordinates` = `"-1.04,120.23"`, `Potensi` is prose, `Dirasakan` = `"-"` when not felt). Parsing is intentionally defensive: malformed entries return `null` and are skipped rather than crashing the watcher. When touching parsers, preserve this — a feed glitch must never take the alerter down. The fixtures in `fixtures/` are captured real feeds; `scenario_m67_palu.json` is a frozen snapshot used to keep tests deterministic as the live feed rolls forward.

## Tests

`test/offline.test.js` runs entirely offline against the fixtures and synthetic `Event`s. It covers parsing robustness, cross-source merge/no-merge, the safety-critical classification cases, dedup matching, and WITA conversion. There are no network or integration tests by design (no credentials in CI).

## Deployment

- **Recommended production runtime:** the long-lived loop on an always-on host (Docker / VPS / Raspberry Pi). The `Dockerfile` points `STATE_FILE`/`LOG_FILE` at a `/data` volume so dedup state survives restarts; there is no `npm install` in the build.
- **Free backup:** `.github/workflows/monitor.yml` runs `node run.js --once` on a 5-min cron (GitHub's minimum; free because the repo is public), persisting `state.json` via `actions/cache`. Caveats: scheduled runs can be delayed, and GitHub auto-disables scheduled workflows after 60 days of repo inactivity — `keepalive.yml` exists to counter that. Credentials live in repository Secrets, never in the repo.
- **Heartbeat:** set `HEARTBEAT_URL` (e.g. healthchecks.io) so a silently dead watcher is detected.

## Configuration

All config is env-driven; see `.env.example` for the full annotated list and `src/config.js` for defaults. Key knobs: `PALU_LAT`/`PALU_LON`, `ALERT_RADIUS_KM` (350), `INFO_MAGNITUDE` (4.0), `MIN_MAGNITUDE` (5.0), `STRONG_MAGNITUDE` (6.0), `TSUNAMI_MAG` (6.5), `SHALLOW_KM` (70), `MAX_EVENT_AGE_HOURS` (2), `POLL_SECONDS` (45), `ESCALATION_DELTA` (0.5, re-alert when a preliminary magnitude is revised up by this much). Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`, `TWILIO_*`) belong in `.env` (gitignored) or host secret stores — never committed.

## Known limitation: the bot is SEND-ONLY

The code fetches data and *sends* messages; it does not listen for or respond to Telegram commands, and recipients are a static comma-separated list in config. There is no `/start`/`/stop` or subscriber database. `CONTEXT.md` is a self-contained handoff document detailing the open workstreams (interactive bot interface, visual/brand assets, and scaling beyond a handful of recipients via a Telegram channel or a subscriber-managed bot) — read it before working on any of those.
