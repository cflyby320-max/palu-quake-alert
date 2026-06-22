# Palu Quake Alert — Internal Engineering Teardown

> A learning document, written *for the project owner*, that reverse-engineers your own
> system from its code and git history. The goal is not to praise the project — it is to
> make the **engineering** legible to you: the coding, the architecture, and the strategy
> behind the choices, so the next project is built on purpose instead of by accident.
>
> This is internal. It is honest about weak spots. That is the point.

---

## 0. How to read this

Every major section is **layered**: it opens with a plain-English analogy, then descends
into the actual code. Read top-to-bottom and the abstraction level rises gradually. When
you hit a term you don't know (idempotency, haversine, hexagonal, dead-man's-switch), the
analogy comes *first* and the jargon second — so you're never asked to understand a word
before you understand the idea.

**What you built, in three sentences:**
A small program watches two government earthquake feeds (Indonesia's BMKG and the USA's
USGS), notices when a quake happens near Palu, and pushes a short Indonesian message to
your family before the news does. It is careful to send *one* alert per real quake even
though it's reading two sources, and it refuses to ever call a big shallow quake "safe."
Everything else — the aftershock forecast, the twice-daily recap, the Instagram cards —
is built on that same spine.

**The single most important thing to internalize:**
There is **no AI in the running system.** You may think of this as an "AI project"
because you built it with Claude. But the thing that runs at 3 a.m. when the ground
shakes is 100% plain, deterministic JavaScript with zero AI and zero third-party
libraries. Claude was the **builder**, not a **component**. Hold that distinction — it
reframes half of what follows. (More in §1 and §7.)

---

## 1. The system in one picture

**Analogy.** Picture a night-watchman with two radios (one local, one international), a
notebook, and a megaphone. Every 45 seconds he listens to both radios, writes down any
quake he hears, crosses out duplicates so he never shouts the same quake twice, decides
how alarming it is, and — only if it's new and close and recent — shouts through the
megaphone in Indonesian. Then he ticks a box on a wall calendar so a friend far away
knows he's still awake. That's the whole system. The cleverness is all in *"crosses out
duplicates"* and *"decides how alarming."*

**The actual data flow of one cycle** (`runOnce` in `src/monitor.js:173`):

```
   ┌─────────────── I/O EDGE (the outside world) ───────────────┐
   │  fetch BMKG  +  fetch USGS     (parallel, Promise.allSettled)│   src/sources.js
   └───────────────────────────┬────────────────────────────────┘
                               │  raw JSON (free-text Indonesian / GeoJSON)
   ┌───────────────────────────▼──── PURE CORE (no I/O, testable) ─────────┐
   │  parse each feed → normalised Event objects     parseBmkgEntry /       │
   │                                                  parseUsgsFeature      │
   │  clusterEvents() → merge the two feeds' versions of ONE quake          │  src/core.js
   │                    into a MergedEvent  ("confirmed by BMKG + USGS")    │
   │  classify() → LOW / MODERATE / HIGH / CRITICAL + tsunami logic         │
   │  buildMessage() → the Indonesian text + shakemap photo                 │
   └───────────────────────────┬───────────────────────────────────────────┘
                               │  decisions
   ┌───────────────────────────▼──── ORCHESTRATION (the conductor) ────────┐
   │  accumulate near-Palu quakes into the local catalog (feeds forecast)   │  src/monitor.js
   │  filter: within radius? above M4.0? not stale?                         │
   │  dedup: have we already alerted this physical quake?  (src/state.js)   │
   │  if new → notifyAll()   if magnitude revised up → escalate & re-alert  │
   │  if mainshock ≥ M5.5 → buildOutlook() aftershock forecast (once)       │
   └──────────┬───────────────────────────────────┬────────────────────────┘
             │                                   │
   ┌─────────▼──── I/O EDGE (out) ───┐   ┌───────▼──── I/O EDGE (disk) ─────┐
   │  Telegram / Twilio SMS·WhatsApp │   │  save state.json (dedup memory)  │  src/state.js
   │  console + file log (always)    │   │  prune old records               │
   └─────────────────────────────────┘   └──────────────┬───────────────────┘
                                                        │
                                          ┌─────────────▼──── dead-man's-switch ──┐
                                          │  ping HEARTBEAT_URL — but ONLY if      │
                                          │  delivery didn't fail on all channels  │
                                          └────────────────────────────────────────┘

   ◆ Claude was HERE ────────────────────── (build time: wrote every box above)
   ◆ Claude is NOT HERE ─────────────────── (run time: nothing above calls an LLM)
```

The shape above is the lesson. The middle band — the **pure core** — never touches the
network, the disk, or the clock (except where a timestamp is passed *in*). That's why it
can be tested exhaustively offline. Everything that can fail unpredictably (network,
disk, Telegram) is pushed to the **edges**. This pattern has a name; see §2.

---

## 2. Technical architecture

**Analogy.** Think of the codebase as a person. The **core** is the brain and the
rulebook — it thinks but has no senses. The **sources** module is the ears. The
**notify** module is the mouth. The **state** module is the memory. The **geo** module is
a single reflex (how far is that?). And **monitor** is the heartbeat and the conductor —
it keeps everything beating in time and decides what happens in what order. A healthy
design keeps the brain separate from the senses, so you can quiz the brain in a quiet room
without plugging in eyes and ears. That separation is the whole game.

The formal name for "push all the messy I/O to the edges, keep a pure decision-making
core in the middle" is **hexagonal architecture** (a.k.a. "ports and adapters"). You did
not have to know the name to build it — but now you do, and you can ask for it by name
next time.

| Module | Role (analogy) | What it actually does | Why it's separate |
|---|---|---|---|
| `src/core.js` (543 LOC) | **Brain / rulebook** | Parsing, merging, classification, message text, the aftershock math. **Pure** — no network, no disk, no `Date.now()` baked in. | Purity = testability. Every safety rule can be unit-tested with a fake quake in memory. This is where the danger lives, so this is what you can prove correct. |
| `src/sources.js` (86) | **Ears** | `fetch` from BMKG + USGS, with timeout + retry. Hands raw data to the core's parsers. | Network is the #1 thing that breaks. Isolating it means a feed outage is one `catch`, not a crash. |
| `src/notify.js` (167) | **Mouth** | Delivers one message across Telegram / Twilio SMS / WhatsApp. Each send independent. | Delivery is the #2 thing that breaks. One channel failing must never silence the others. |
| `src/state.js` (134) | **Memory** | A JSON file: `alerted` (dedup), `catalog` (history for the forecast), `outlooks` (forecast dedup). | Memory is what makes the watcher *idempotent* (see §3). Without it, a restart re-spams every recent quake. |
| `src/geo.js` (25) | **Distance reflex** | `haversineKm` + `bearingDeg`. | One tiny, reusable, well-understood calculation. |
| `src/config.js` (130) | **The dials** | Every tunable as an env var with a safe default. Defines which channels are "active." | Same code runs with Telegram, Twilio, both, or neither — config decides, not code edits. |
| `src/monitor.js` (445) | **Heartbeat / conductor** | The cycle, the CLI, the forever-loop, the single-instance lock, the heartbeat, the scheduled digest. | The only place allowed to be "impure" and orchestrate everything in order. |

### Two concepts worth a deeper analogy

**`haversineKm` (the distance reflex).** The Earth is a ball, so you can't measure the
distance between two quakes with a ruler on a flat map — straight-line "ruler" distance
gets more wrong the farther apart things are. The haversine formula is the
spherical-geometry way to get the true "as-the-crow-flies" distance over a curved surface
from two lat/long points. You use it everywhere: "is this quake within 350 km of Palu?"
and "are these two feed entries the same physical quake (within 75 km)?"

**The aftershock forecast (`src/core.js:430` onward).** This is the most academically
serious code in the project, so here's the plain version. After a big quake, two
empirical laws hold almost everywhere on Earth:
- **Omori-Utsu law** — aftershocks are most frequent *immediately* after the mainshock and
  taper off over time (fast at first, then a long tail). Think of a shaken soda bottle:
  most fizz right away, then slower and slower.
- **Gutenberg-Richter law** — small quakes vastly outnumber big ones, in a fixed ratio.
  For every magnitude step up, there are roughly ten times fewer. Think of a pyramid:
  lots of pebbles, few boulders.

Combine "how many aftershocks, decaying over time" (Omori) with "what fraction are big"
(Gutenberg-Richter), feed that expected count into a **Poisson probability** ("given I
expect N events, what's the chance of *at least one*?"), and you get statements like
"~20–40% chance of a strongly-felt aftershock in the next 24 h." The code deliberately
**hides the exact percentage** behind coarse word-buckets and ranges (`probBucket`,
`src/core.js:488`) because the underlying parameters are uncertain and false precision
would be dangerous. That restraint *is* the engineering.

---

## 3. Decision patterns — the choices you made over and over

These are the repeated instincts visible across the code. Naming them turns an instinct
into a **reusable principle** you can apply deliberately next time. Each is:
*Pattern → Why → Where → Principle.*

### 3.1 Zero dependencies, on purpose
- **Why:** every library is one more thing that can break, get a security hole, or change
  under you — in a tool people trust with their safety. (Stated outright in `CLAUDE.md`.)
- **Where:** no `npm install`, no lockfile in the core. Only Node's standard library:
  global `fetch`, `node:fs`, `node:test`, `--env-file`.
- **Principle:** *Dependencies are debt. Pay only when the interest is worth it.* For a
  safety tool, the bar is very high. (Note the honest exception in §7: the Instagram
  studio breaks this — and how you isolated the breakage.)

### 3.2 Safety-first invariants — "absence of evidence is not evidence of safety"
- **Why:** the 2018 Palu tsunami was landslide-generated, *not predicted* by standard
  models, and the official warning was lifted early. So the system never trusts a "no
  tsunami" flag.
- **Where:** `classify()` (`src/core.js:241`) raises a precautionary high-ground
  `caution` for any large shallow quake (`mag ≥ TSUNAMI_MAG && depth ≤ SHALLOW_KM`)
  **regardless** of the official flag.
- **Principle:** *In a safety system, the default must be the safe assumption, and only
  strong positive evidence may downgrade it.* "Unknown" is treated like "dangerous," never
  like "fine."

### 3.3 Defensive degradation — bend, never break
- **Why:** the feeds are free-text and occasionally malformed. A feed glitch must never
  take the alerter down.
- **Where:** parsers return `null` on bad data and the caller skips it
  (`parseBmkgEntry`, `src/core.js:58`); `Promise.allSettled` tolerates one source failing
  (`src/monitor.js:181`); log and state writes are wrapped so a file lock can't abort a
  send (`src/notify.js:125`, `src/state.js:42`).
- **Principle:** *Every external input is hostile until proven otherwise. Isolate each
  failure to the smallest possible blast radius.*

### 3.4 Conservative merging — when sources disagree, take the scarier one
- **Why:** two feeds report the same quake differently. For tsunami status, the cost of a
  false "safe" is catastrophic; the cost of a false "warn" is a wasted climb to high ground.
- **Where:** `MergedEvent.tsunamiFlag` (`src/core.js:161`) returns `true` if **any**
  source warns; magnitude takes the **max** across sources (`:126`).
- **Principle:** *Asymmetric stakes demand asymmetric defaults.* Merge toward caution, not
  toward the average.

### 3.5 Idempotency via persisted memory — say each thing exactly once
- **Why:** the loop runs every 45 s and restarts happen. Without memory it would re-alert
  the same quake forever.
- **Where:** `findPriorAlert` (`src/state.js:52`) matches a new quake against
  already-sent ones using the **same time+distance window** used for merging — so a quake
  is recognized even if it gained a second source between polls.
- **Analogy:** *idempotent* means "pressing the button twice does the same thing as
  pressing it once" — like an elevator call button. Re-running the cycle on the same quake
  produces no new alert.
- **Principle:** *Any system that retries or restarts needs a memory of what it already
  did, keyed by the real-world thing, not by the message.*

### 3.6 Kill-switches + feature isolation — new features can't endanger the old ones
- **Why:** the safety path (detect → alert) must stay sacred. Every later feature is
  optional and must be unable to break it.
- **Where:** `OUTLOOK_ENABLED`, `DIGEST_ENABLED` are boolean env kill-switches
  (`src/config.js`). The Instagram studio is **lazy-imported** — `await import('../studio/hook.js')`
  runs *only* when `STUDIO_ENABLED=true` (`src/monitor.js:161`), so its one dependency
  never loads for the safety path. And every optional feature is wrapped so "any failure
  is swallowed — a draft must never delay or break the alert that already went out."
- **Principle:** *Add features as satellites, not as surgery.* A new capability should be
  switch-off-able and sandboxed so its worst day is a no-op, not an outage.

### 3.7 Config over code — behavior lives in dials, not edits
- **Where:** `num()/list()/bool()/str()` helpers (`src/config.js:5`) read every tunable
  from the environment with a safe fallback; `activeChannelNames()` makes a channel
  "active" only if its credentials exist.
- **Principle:** *Things that change per-deployment (radius, thresholds, recipients,
  secrets) belong in configuration; things that change per-decision belong in code.*

### 3.8 Honest framing as a hard requirement
- **Where:** copy throughout insists this is rapid *notification* (~2–5 min), **not**
  P-wave early warning, and **never** an all-clear; the Outlook always states the
  small-but-real chance of a *larger* quake and defers to BMKG. These are enforced by
  tests.
- **Principle:** *In a trust product, the limits of the tool are a feature you must ship,
  not fine print you may omit.*

---

## 4. The build process you actually followed (reconstructed from git)

Your memory of "how I built it" is a story; git is the receipt. The repo holds **34
commits over 5 days (June 17–21, 2026)**. Here's the real order — and the real order is
the lesson.

| Tier | What landed | Commits (paraphrased) |
|---|---|---|
| **1. MVP** | Dual-source (BMKG+USGS) → Telegram, with severity levels | "Palu earthquake/tsunami alerter…", "Add LOW severity level" |
| **2. Reliability** | Heartbeat, deploy configs (Docker/Fly), keepalive cron, file-lock guards | "always-on deploy configs", "guard log/state writes (EBUSY)" |
| **3. Per-alert context** | Map link + bearing, aftershock-count line, inline shakemap | "Tier 1 per-alert context" |
| **4. Statistical modeling** | The Seismic Activity Outlook (aftershock probability) | "Tier 3 Seismic Activity Outlook" |
| **5. Trust / presentation** | Bot copy, pinned post, brand kit, Pages site | "Tier 2 (trust & presentation)" |
| **6. Localization** | Indonesian-only alerts, catalog-sourced digest | "Indonesian-only alerts, inline shakemaps" |
| **7. Tests** | Priority 1/2/3 offline coverage | "test: add Priority-1 safety-critical coverage" |
| **8. Distribution** | Instagram studio (branded cards, manual posting) | "feat: Instagram studio" |

**What this honestly reveals:**
- **You led with the risky stuff first** (reliability came in Tier 2, *before* most
  features). That's mature instinct — you hardened the spine before decorating it.
- **Tests came in Tier 7, near the end.** The safety-critical classification logic ran in
  production for *days* before it had a test asserting it behaves. It probably *was*
  correct — but it was unproven correct. (See §7.)
- **You worked feature-by-feature on branches, merged via Pull Requests** (the `claude/*`
  and `feat/*` branch names, 10 merge commits). That's a real engineering workflow, not
  cowboy commits to `main`.
- **You named your tiers** ("Tier 1/2/3") as you went. That's why the build reads as a
  ladder instead of a pile — you imposed structure on yourself.

**The replicable spine:** *MVP that does the scary thing end-to-end → make it not lie to
you when it breaks (reliability) → enrich → model → present → localize → prove → distribute.*
The only edit I'd make for next time is moving "prove" (tests) up to right after MVP for
anything safety-critical. (Captured in §8.)

---

## 5. Efficiency & token optimization

Two different meters run here. One is **tokens** (how much you spent working *with the
AI*). The other is **runtime efficiency** (how much the program spends when it runs).
They're unrelated, but you asked about both, so:

### 5.1 Working with the AI (token spend)

**What worked (kept token cost down):**
- **`CLAUDE.md` as a standing brief.** A single, dense, always-loaded file that teaches
  any AI session the safety invariants and architecture *once* means you don't re-explain
  the project every conversation. This is the highest-leverage token decision in the repo.
- **PR-per-feature.** Small, scoped branches mean each AI session reasons over a small diff,
  not the whole tree.
- **Design docs as durable memory** (`OUTLOOK_DESIGN.md`, `STUDIO_DESIGN.md`). The
  expensive thinking (the aftershock math, the framing rules) was written down *once* and
  referenced, instead of re-derived each session.

**Where tokens likely leaked (tighten next time):**
- **Doc drift forces re-reading.** `CLAUDE.md` itself warns that `CONTEXT.md` is stale
  ("predates the Indonesian-only and Tier 2/3 changes"). Stale docs make an AI read the
  *code* to reconcile — paying tokens to distrust your own notes. A doc that's wrong costs
  more than no doc.
- **The CRLF line-ending churn** (the +4558/-4558 you spotted). When every file shows as
  "fully changed," any AI reviewing a diff wastes context distinguishing real edits from
  noise. A one-line `.gitattributes` (`* text=auto eol=lf`) removes that tax permanently.
- **Six overlapping prose docs** (`README`, `CONTEXT`, `CLAUDE`, `OUTLOOK_DESIGN`,
  `TIER2_PRESENTATION`, `STUDIO_DESIGN`) partly duplicate each other. Each is loaded in
  full when relevant. One canonical source per fact, with the others linking to it, would
  cut redundant context.
- **Reading large files whole** when you only need a function. The cheaper pattern (which
  this very session used) is targeted reads. Worth asking for explicitly.

### 5.2 Runtime efficiency (when the program runs)

This is already lean and you don't need to optimize it — but understanding *why* it's fine
is the lesson:
- **Polling every 45 s** is the right granularity for a 2–5 min notification target; faster
  polling buys nothing because the feeds don't update faster, and would just hammer BMKG.
- **USGS uses a server-side radius filter** (`maxradiuskm`, `src/sources.js:54`) so you
  download only nearby quakes; BMKG has no geo filter so you fetch its small fixed list and
  filter locally. Right tool per source.
- **Parallel fetches** (`Promise.all` / `allSettled`) mean the cycle waits for the slower
  of the two feeds, not the sum.
- **Dedup short-circuits work** — an already-alerted quake costs one array scan, no send.
- **The honest non-optimization:** the dedup/catalog scans are linear over small arrays
  (pruned to 14/60 days). At this scale, a fancier data structure would be *more* code for
  *zero* felt benefit. Knowing when **not** to optimize is itself a skill — see §7.

---

## 6. Context management — wins and friction

**Analogy.** Context management is how you give a forgetful-but-brilliant collaborator
(any fresh AI session, or future-you) the right briefing at the right moment. Too little
and they guess; too much and they drown.

**Wins:**
- **Layered memory.** `CLAUDE.md` = the always-on operating manual; design docs = the deep
  references pulled in on demand; code comments = the why-not-just-what at the point of use.
  The comments in `core.js` are unusually good — they explain *intent and danger*
  ("a `false` value is weak info, not a guarantee"), which is exactly what a reader can't
  infer from the code alone.
- **The handoff doc pattern** (`CONTEXT.md`) — a deliberate "if someone picks this up cold,
  here's the state of the open workstreams." Rare and valuable.
- **Safety invariants written as a numbered, do-not-regress list** in `CLAUDE.md`. This
  converts tribal knowledge into an enforceable contract.

**Friction:**
- **Doc drift** (covered in §5.1) — the docs and code diverged; `CLAUDE.md` honestly flags
  it, which is good, but the fix is to update or delete, not annotate-as-stale.
- **CRLF churn from Google Drive** — the repo lives in a synced Drive folder, which rewrote
  line endings and produced the phantom 4,558-line diff. Drive-hosted git repos are a known
  source of this; `.gitattributes` plus ideally moving the working copy out of Drive solves
  it.
- **No CI test execution.** Tests exist (`test/*.js`) but the GitHub workflow runs the
  *monitor*, not `npm test`. So the safety tests only run when you remember to run them
  locally. A test that isn't run automatically is a comment that compiles.

---

## 7. Blindspots — what you may not be seeing

Framed as the prompt asked: *where might you be optimizing inside a frame that doesn't need
optimizing, and what's invisible from inside the project?*

1. **You may be over-valuing "zero dependencies" as an identity.** It's genuinely right for
   the safety core. But it's become a point of pride that the **Instagram studio already
   violates** (it needs `@resvg/resvg-js`). You handled that *correctly* — lazy import,
   isolated, off by default — but notice the tension: the rule is "zero deps," the reality
   is "zero deps *on the safety path*." Those are different, better rules. Say the better
   one. Don't let a slogan stop you from adding a well-isolated dependency when it earns its
   place.

2. **The scariest single point of failure is distribution, not detection.** The code is
   robust; the *delivery* rests on narrow foundations. By the project's own admission
   (`CLAUDE.md` deployment section): GitHub's cron "drops/delays most scheduled runs
   (observed multi-hour gaps)" and is "NOT a reliable primary watcher." So reliability
   really depends on **one** always-on host — or, if there isn't one, on your PC happening
   to be running. The forecast math is polished; the question "is anything actually awake
   right now?" is comparatively under-built. **This is the highest-value place to invest
   next.**

3. **The heartbeat footgun is real and live.** `heartbeat()` only pings if `HEARTBEAT_URL`
   is set *in that specific runtime* (`src/monitor.js:116`). If it's not in the GitHub
   Actions secrets, the cloud backup never pings — so your "dead-man's-switch" might be
   silently reflecting only one runtime. A dead-man's-switch you can't trust is worse than
   none, because it gives false confidence. Verify it actually fires.

4. **Safety logic shipped before it was proven.** Tests arrived in Tier 7. The
   classification rules — the literal life-safety code — ran for days unverified. They were
   probably right. "Probably right" is not the standard for tsunami logic. For the *next*
   safety project, the test for the dangerous branch should land in the same commit as the
   branch.

5. **You're a bus factor of one, and the docs know it.** `CONTEXT.md` exists precisely
   because everything lives in your head. The drift in that doc shows the handoff is already
   degrading. If this tool genuinely protects family, its continuity shouldn't depend on
   your memory or your laptop.

6. **Where you're optimizing inside a frame that doesn't need it:** the runtime performance
   (§5.2) and the dependency purity (point 1) are both already past "good enough." Energy
   spent shaving those is energy not spent on distribution reliability (point 2), which is
   where the real risk sits. The instinct to perfect the elegant core is the thing to
   watch — *the system's weakest link is the least elegant part, and elegance attracts
   attention away from it.*

None of these are emergencies. They're the difference between "a thing I built that works"
and "a thing I can trust and hand off."

---

## 8. PROCESS BLUEPRINT (one page — stands alone)

*A reusable methodology distilled from how you actually built this. Copy this into the next
project's first commit.*

### The ladder (build in this order)
1. **MVP that does the scary thing end-to-end.** The riskiest path, working, even if ugly.
   For this project: feed → detect → one real message to one real phone.
2. **Prove the dangerous parts immediately.** Unit-test the safety/correctness branches in
   the *same commit* you write them. (The one thing to change from last time.)
3. **Make it honest when it breaks.** Reliability before features: heartbeat / dead-man's-
   switch, restart-safety, single-instance guard, "fail loud, never silent."
4. **Enrich** the output. 5. **Model** (any statistics/ML). 6. **Present** (brand/trust).
   7. **Localize.** 8. **Distribute.**

### The decision checklist (apply to every new feature)
- [ ] Can this break the core safety path? If yes → isolate it (lazy import, separate
      module) and **wrap every failure** so its worst case is a no-op.
- [ ] Does it need a dependency? Justify the *interest payment*, not just the value. If you
      add one, confine it to the non-safety path.
- [ ] Is it switch-off-able? Give it an env kill-switch.
- [ ] Does it touch the network, disk, or clock? Then it belongs at an **edge**, not in the
      pure core.
- [ ] When inputs are malformed/ambiguous, does it **degrade toward safe** (skip, warn,
      assume danger) rather than crash or assume fine?
- [ ] Where stakes are asymmetric, does the default lean toward the cheaper mistake?

### The architecture default
- **Pure core, I/O at the edges** (hexagonal). The brain (rules/decisions) must be testable
  in a quiet room with fake inputs. Push network/disk/clock to thin, swappable adapters.
- **Idempotency via persisted memory** keyed to the real-world event, so restarts and
  retries never double-act.
- **Config over code:** per-deployment values (thresholds, recipients, secrets) live in env
  vars with safe fallbacks.

### The AI-collaboration setup (do this on day one)
- Write a **`CLAUDE.md`** before building: the mission, the non-negotiable invariants
  (numbered, "do not regress"), the architecture in a paragraph. It pays for itself every
  session.
- **One PR per feature**, small diffs. **One design doc per hard subsystem**, referenced not
  re-derived.
- **Keep docs true or delete them.** A stale doc costs more than no doc — it makes your
  collaborator distrust and re-read everything.
- Add **`.gitattributes` (`* text=auto eol=lf`)** immediately, and don't keep the working
  repo inside a cloud-sync folder.

### The standing question
*"What is the weakest link, and is it the least elegant part?"* It usually is — and elegance
elsewhere is a magnet pulling your attention away from it. Spend your next hour on the
ugliest critical thing, not the prettiest optional one.

---

*Written from the code and git history of this repo. Every file/line and commit reference
above is real — open them alongside this doc and the abstractions will turn concrete.*
