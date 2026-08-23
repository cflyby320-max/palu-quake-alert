# Palu quake alert — archive

Append-only. Dated. **Never rewritten, never auto-loaded.** This is where blocks
from `context/state-of-play.md` land once they are superseded, so the pulse stays
short enough to load alongside another project mid-session.

Two things send a block here, and the first matters more:

1. **Superseded** — a new decision replaced it. Move it the moment that happens.
2. **Age** — `audit --stale` flags dated claims past six months. It flags; it
   never deletes. A two-year-old decision that is still true stays in the pulse.

Nothing is ever deleted from here. If you need to know *why* something was
decided, this file and `git log` are the two places that still hold it.

---

## Rotated from the brain dossier, 2026-08-23

Until the restructure this project's state lived in the Nalar OS brain, at
`brain/clients/palu-quake-alert.md`, duplicating what the repo already knew. The dossier
is gone; what follows is the part of it worth keeping — history and receipts.
Anything that still *binds* moved to the pulse instead.

### Duplicate-alert guard armed, 2026-08-22

Was disarmed since first checked 2026-08-09 (both secrets empty, backup sending
unconditionally). Alief pulled the ping URL and a read-only API key from
healthchecks.io; both secrets set via `gh secret set` — values never touch the
repo's tracked files (GitHub's encrypted secrets store, masked in all workflow
logs). Verified against a live triggered run (`32557672552`), not just secret
presence: the log reads *"backup suppressed — primary heartbeat fresh (1m old
<= 10m); not re-sending."* The guard does exactly what `monitor.yml`'s own
comment says it must.

### Fly.io liveness confirmed, 2026-08-22

Via `fly auth login` (as `c.flyby320@gmail.com`) then
`fly status -a palu-quake-alert`: machine `080e091f3e3278` is `started`, running
image `palu-quake-alert:deployment-01KVNCJT6QYE47BBFSEC9W9PWT` at
`palu-quake-alert.fly.dev`. A control-plane check, not an HTTP probe.

### Shipped

- Always-on Fly.io deploy (app `palu-quake-alert`, region `sin`) cycling every
  ~46s against BMKG + USGS since **2026-06-21**.
- Bahasa-Indonesia alerts with map link, shakemap, and 24h sequence context;
  aftershock-probability outlook; twice-daily digest (08:00 / 20:00 WITA).
- `studio/` Instagram pipeline, manual mode — AI drafts card + caption, DMs it
  to the operator, a human posts it.
- Built 2026-06-16, first shipped 2026-06-19.

### Filing notes from the brain era

- **Local path** was `C:\dev\palu-quake-alert` until the 2026-08-07 migration.
  Two stale clones were archived, not deleted — the lesson became the
  `one-canonical-clone` insight.
- **State:** activated and parked the same day, 2026-08-07; the housekeeping
  goal was met in one session.
- Deploy record: `https://cflyby320-max.github.io/palu-quake-alert/` is the
  public terms/privacy page, public on purpose. The Fly app has no public port
  and nothing to probe.

### The 2026-08-07 consolidation write-up

Moved verbatim from the brain's `archive/palu-quake-alert-2026-08-07/README.md`.

# archive: palu-quake-alert — the 2026-08-07 housekeeping session

**Reference material, not active guidance, and not the project's state.** The
live state file is [[../../clients/palu-quake-alert]]; it routes here when the
detail is actually needed. This folder holds the long-form record of one
session — 2026-08-07 — that consolidated the repo, audited it for secrets, and
inventoried what was already shipped. It was split out of the dossier on
2026-08-08 because the dossier had grown to ~3.5x every other one: half state
file, half session diary. The diary is the half that belongs here.

Everything below is as it stood on 2026-08-07. Dates and figures are preserved
as they were recorded that day, not refreshed since.

## Why this session happened at all: a deliberate cap override

The ACTIVE-client cap was **two** on 2026-08-07 (raised to four the next day,
2026-08-08 — see `logbook.md`). Activating a DORMANT-bound project for a
one-day housekeeping pass meant a **temporary third ACTIVE client**, a
deliberate, acknowledged override rather than an oversight. It worked because
the window was short by design: activated and parked the same day, so the cap
was back to two (`deliwafa`, `youtube-spm-prep`) by the time anyone would have
needed to check it. The lesson worth keeping is the shape of the override, not
the specific number — a cap can be broken on purpose for a bounded, named
reason, as long as the state that broke it gets closed before anything else
needs the room it borrowed.

## What the session found: three divergent clones

The project had drifted across three working copies, and the one holding the
real secrets was the one furthest behind the code.

| Copy | What it actually was |
|---|---|
| `C:\dev\palu-quake-alert` (kept) | fresh clone of `origin/main`, made during the consolidation; became the only working copy. Later that same day it moved to `~/MaybeViki/projects/palu-quake-alert` in the migration off Captain OS's `C:\dev` root |
| `G:\My Drive\Personal\palu-quake-alert-OLD-2026-08-07` | the "real" secrets home — its `.env` was copied into the new clone — but sat on an orphaned `docs/internal` branch missing ~35 commits: the whole civic design system, content engine, and educational asset pipeline |
| `C:\Users\User\palu-quake-alert-OLD-2026-08-07` | the clone found at session start; 50 commits behind `origin/main`, predating the entire `studio/` module |

Neither old copy was deleted — both were renamed with the `-OLD-2026-08-07`
suffix after their unique value was migrated, and can be deleted for real once
nothing surfaces as missing.

Two lessons were generalized out of this and live in the brain proper:
[[../../insights/one-canonical-clone]] and
[[../../playbooks/verify-repo-state]] — a stale local clone looks identical to
a current one until you `git fetch`.

Google Drive is also a bad place to work from for a second, independent reason:
it corrupts `npm install` for `studio/` (a known issue, documented in the
repo's own `studio/STUDIO_DESIGN.md`).

## What was closed that session

All pushed to `origin/main` at commit `1325b6a`.

- **Windows checkout corruption, fixed.** Merging the orphaned `docs/internal`
  branch brought in a `.gitattributes` that enforces LF endings and marks
  binaries. The damage was worse than first assumed: Windows had been mangling
  **22 of 27 design assets on checkout**, PNGs and TTF fonts included, not just
  SVGs. The test suite went from 102 tests / 2 failing to **112 / 112 passing**.
  The second original failure was never a bug — `studio/`'s `@resvg/resvg-js`
  dependency simply wasn't installed, and it installed in about a second off
  Drive, which is exactly the operation Drive is documented to corrupt. Free
  independent validation of the move.
- **Five human-approved cards recovered.** `studio/outbox/production-batch-1/`,
  approved 2026-06-30, had sat unmerged and unused for over a month. Later
  preview batches came along with them.
- **Privacy scrub.** The personal Gmail was removed from the public batch
  manifest (six `approvedBy` fields became `owner`, approval semantics intact).
  The repo's local `user.email` was set to the GitHub no-reply alias so future
  commits don't reintroduce it.
- **Security audit — clean.** All 76 commits across every branch were scanned:
  no bot token, chat IDs, phone numbers, heartbeat URL, or `.env` was ever
  committed; `.gitignore` held from the first commit. The only residual
  exposure is the personal Gmail in older commit *metadata* (33 of the 76) —
  an email address, not a credential. Rewriting history was judged not worth
  the cost.
- **The alerter never stopped.** Fly.io kept cycling every ~46 seconds through
  all of the above, untouched: nothing in `src/`, the alert logic, the severity
  rules, or `fly.toml` was changed.

## Full shipped inventory (as of 2026-08-07)

Much more was on `origin/main` than the original activation dossier knew about.

- **Always-on Fly.io deploy** (`fly.toml`, app `palu-quake-alert`, region
  `sin`), cycling every ~46s against BMKG + USGS since 2026-06-21. This closed
  a reliability gap GitHub Actions could not: GitHub silently drops or delays
  scheduled runs by hours. Actions is now a heartbeat-gated dead-man's-switch
  backup only, via `shouldSuppressBackup()` in `src/monitor.js`.
- **Per-alert context** — map link and bearing, inline BMKG shakemap, and an
  "Nth quake near Palu in 24h" sequence line. Messages are **Bahasa Indonesia
  only**; the bilingual English copy was dropped for brevity.
- **Seismic Activity Outlook** — an aftershock-probability heads-up using
  Reasenberg-Jones math, worded strictly as "elevated probability," never as a
  prediction and never as an all-clear.
- **Twice-daily digest** at 08:00 and 20:00 WITA, from a persisted local catalog.
- **Brand kit** — committed avatar plus four severity badges, a public
  About/Terms page (`docs/index.html`), and a whitepaper (`docs/whitepaper.html`).
- **`studio/`, the Instagram content pipeline** — "AI drafts, human approves,
  posts manually." It renders a branded card and an Indonesian caption and DMs
  them to the operator's private Telegram after every alerting quake.
  Manual mode (Phases 1-4) is done and live. Graph-API auto-publish (Phase 0/2)
  was designed and then deliberately not built: it's gated on Meta account
  setup, an external account-level step, not a code gap.
- **A full civic design system** feeding studio — `design/` (tokens, asset
  schema, template registry, rendering contract), `content/` (a structured
  content engine plus a topic backlog), and an educational/evergreen render
  pipeline that has been through real human-reviewed iteration: a "Preview 3"
  layout was rejected for cropping and motif clutter, "Preview 4" fixed it and
  was approved and committed.
- **112 offline tests** in `test/`, covering both the watcher's safety
  invariants and design-system validation.
- **Channels confirmed by `--selftest` post-migration:** both `telegram` and
  `twilio-whatsapp` are actually configured. Twilio is set up, just constrained
  by its free/trial tier — not "unused," as an earlier read assumed.

## The two open findings, in full

Both were surfaced 2026-08-07 and neither was acted on. They are content and
design problems, not reliability problems.

1. **The reactive per-quake card never got the design-system treatment.** It's
   studio's flagship and highest-frequency output, yet its hero image is BMKG's
   raw shakemap screenshot, hard-cropped in with no restyling —
   `preserveAspectRatio="xMidYMid slice"` in `studio/template.js:115` — which
   keeps BMKG's own axis labels, scale bar, and city names. The result is
   visibly inconsistent with the polished educational cards, and is the likely
   source of the "still sub-par" quality read. The caption also ends in a
   seven-tag hashtag block with no call to action, plausibly connected to the
   engagement problem below.
2. **Reach, not reliability, is the real problem.** 25 Telegram channel
   subscribers, under 5 daily active viewers. Telegram channels don't push as
   insistently as a DM in Indonesia, where WhatsApp dominates daily attention.
   Twilio WhatsApp is configured but trial-tier-limited, and Instagram
   (`@infogempapalu`) is still 100% manual copy-paste from studio's
   Telegram-DM'd drafts. The system works; its distribution doesn't.

## Left open deliberately

- **Four superseded branches, unmerged:** `activation-content-strategy`, two
  `claude-md-docs` branches, and `studio-evergreen-series`. Judged replaced by
  later work on `main`. Deleting or merging them is a live decision, not an
  oversight — nothing was deleted that session.
- **The two `-OLD-2026-08-07` folders**, pending confidence that nothing is
  missing.
- **The Windows Startup launcher** (`autostart.vbs` → `start.cmd`) once pointed
  at the old Google Drive path and was repointed to `C:\dev\palu-quake-alert`
  during the session. It was **already disabled** (`...vbs.disabled` in the
  Startup folder), and Fly.io is the sole active runtime, so this was low
  urgency either way. Note that the repo moved out of `C:\dev` later the same
  day, so the launcher's path is stale again — harmless while it stays
  disabled, but it would not work if re-enabled as-is.

---

## Session log

Moved from the brain's `logbook.md` on 2026-08-23, when project history stopped
living in the brain. These are the entries whose title named this project and
whose tag was `[client]` or `[shipped]` — about this project rather than about
the system that builds it. Cross-project entries stayed behind.

Newest last.

## 2026-08-22 · [client] · palu-quake-alert Fly liveness confirmed


`fly auth login` had never been run from this machine, so the always-on
Fly.io deploy's liveness was a stale 2026-08-07 claim citing ephemeral logs
that no longer existed. Alief approved the browser-based Fly OAuth flow;
ran `fly auth login` (background, since it just opens a browser and polls a
callback — no TTY interaction needed), confirmed via `fly auth whoami`
(`c.flyby320@gmail.com`), then `fly status -a palu-quake-alert`: machine
`080e091f3e3278` is `started`, serving from `palu-quake-alert.fly.dev`.
Recorded in the dossier and `work-desk.md`; that open loop is closed.

**Scope note:** this confirms the machine is running, not that alerts are
actually firing correctly — `fly.toml` declares no public port on purpose,
so there's no HTTP endpoint to probe end-to-end. The duplicate-alert-guard
defect (two empty repo secrets, backup sends unconditionally) is unrelated
and still open, waiting on Alief's Healthchecks.io values.

## 2026-08-22 · [client] · palu-quake-alert duplicate-alert guard armed


Closed the day's second open loop. Alief pulled `PRIMARY_HEARTBEAT_URL`
(healthchecks.io's ping URL for the "Palu Quake Alerter" check) and a
read-only `HEALTHCHECKS_API_KEY` from that check's Settings → API Access
page, screenshotted for the ping URL and pasted the key directly. Set both
via `gh secret set` against `cflyby320-max/palu-quake-alert`.

**Verified past "secret exists"** — the actual failure mode being fixed was
behavioral (backup sends unconditionally), so presence alone wasn't proof.
Manually dispatched `monitor.yml` (`gh workflow run`), then read the run's
log directly: `SUPPRESS_IF_PRIMARY_ALIVE: true`, `PRIMARY_HEARTBEAT_URL:
***` (correctly masked), and the payoff line — *"backup suppressed —
primary heartbeat fresh (1m old <= 10m); not re-sending."* That's the guard
actually engaging, not inferred from config.

**A fair question came up mid-task and is worth recording the answer to,
since it'll come up again on any public repo:** does pushing a repo secret
via `gh secret set` expose it, given the repo is intentionally public?
No — GitHub Actions secrets are a separate store from repository content:
never in a commit or `git log`, only decryptable inside that repo's own
workflow runs, and auto-masked to `***` in every log even on accidental
print. Repo privacy and secret privacy are orthogonal; this dossier already
knew that for `.env`/`.gitignore`, same mechanism class applies here for CI.

Also noted, not acted on: a stray `HEARTBEAT_URL` GitHub secret (distinct
from `PRIMARY_HEARTBEAT_URL`) has sat unused since 2026-06-17 — it's a Fly
host secret, not read by any GitHub Actions workflow. Harmless leftover,
not this session's scope.

Both dossier defects that made this DORMANT client's re-park conditional
are now closed — worth a deliberate reactivation call, not an automatic one
(same "on purpose, not by drift" rule `deliwafa`'s 2026-08-21 reactivation
used), so left DORMANT here pending that decision.
