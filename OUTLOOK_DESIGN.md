# Seismic Activity Outlook — Design Pass (Tier 3)

> **Status: DESIGN ONLY. No code yet.** This document defines the data model, the
> aftershock-probability math, and — most importantly — the safety-framing rules,
> for review *before* implementation. Getting the framing wrong here is dangerous,
> so the framing section is the part that needs the hardest scrutiny.

---

## 0. One-paragraph summary

After a significant mainshock near Palu, the system posts a follow-up **"Seismic
Activity Outlook"**: a calm, bilingual heads-up that aftershocks are now **more
likely than usual for a limited time**, with rough probability ranges for a felt
aftershock, a strong/damaging aftershock, and — stated plainly — the small but
real chance of an **even larger** earthquake. It is built on the standard
operational aftershock-forecasting math used by the USGS (modified Omori–Utsu
decay × Gutenberg–Richter scaling, Poisson probabilities). It is **never** a
prediction of a specific earthquake, **never** an "all-clear," and it **never**
overrides the existing high-ground rule.

---

## 1. Goals & non-goals

**Goals**
- Tell people, after a big quake, that the *next hours-to-days carry elevated
  aftershock probability* — concrete enough to be useful, honest enough to trust.
- Make the genuinely life-relevant point that the strong shaking may **not** be
  over: there is always a small chance the first quake was a foreshock.
- Decay the message with the physics: the elevation fades over time, and the
  Outlook should say so.

**Non-goals (hard limits)**
- ❌ Not earthquake prediction. No place, no time, no "a quake will hit."
- ❌ Not an "all-clear." A *low* probability of a large aftershock is **not** safety.
- ❌ Not precise. We emit coarse ranges/buckets, never false-precision percentages.
- ❌ Not a replacement for BMKG/InaTEWS, sirens, or local authorities.
- ❌ Not a tsunami forecast. The high-ground rule (CLAUDE.md invariant #1) is
  untouched and stays primary.

---

## 2. The science (and its limits)

Operational aftershock forecasting is mature and standard. We use the
**Reasenberg–Jones (1989, 1994)** model, which the USGS uses for its public
aftershock forecasts, built from two textbook laws:

### 2.1 Modified Omori–Utsu law (temporal decay)
Aftershock rate decays roughly as a power law after the mainshock:

```
n(t) = K / (t + c)^p        [events ≥ Mc per day, t in days after mainshock]
```

- `p` ≈ 0.9–1.2 (decay exponent; ~1.07 is a common generic value)
- `c` ≈ 0.01–0.1 days (small time offset; often fixed)
- `K` = productivity (scales with mainshock size — see below)

### 2.2 Gutenberg–Richter law (magnitude–frequency)
The number of events scales with magnitude as `log10 N(≥M) = a − bM`, with
`b ≈ 1.0` globally. Combined with Omori, the Reasenberg–Jones rate of aftershocks
**of magnitude ≥ M** at time `t` after a mainshock of magnitude `Mm` is:

```
λ(t, M) = 10^(a + b·(Mm − M)) · (t + c)^(−p)      [events/day]
```

where `a` is the **productivity** parameter (more negative = fewer aftershocks).

### 2.3 Expected count in a time window
Integrating `λ` over `[S, T]` days after the mainshock gives the expected number
of aftershocks ≥ M:

```
N(M, S, T) = 10^(a + b·(Mm − M)) · ∫_S^T (t + c)^(−p) dt

∫_S^T (t+c)^(−p) dt =  ((T+c)^(1−p) − (S+c)^(1−p)) / (1 − p)      if p ≠ 1
                    =  ln(T+c) − ln(S+c)                          if p = 1
```

### 2.4 Probability of "at least one" (Poisson)
Treating aftershocks as a Poisson process with mean `N`:

```
P(≥1 event ≥ M in [S,T]) = 1 − exp(−N(M, S, T))
```

This is the number we communicate (as a coarse range). Three useful quantities:

| Quantity | M used | Why it matters |
|---|---|---|
| P(felt aftershock) | M ≥ `OUTLOOK_FELT_MAG` (≈4.0) | "expect more shaking" |
| P(strong aftershock) | M ≥ `STRONG_MAGNITUDE` (6.0) | damaging-aftershock risk |
| P(larger than mainshock) | M ≥ `Mm` | the foreshock caveat — life-critical |

### 2.5 Parameters: defaults, regional, and local b
- **Default to published generic parameters** (Reasenberg–Jones generic; Page et
  al. 2016 global averages): `b≈1.0`, `p≈1.07`, `c≈0.05 d`, and a generic
  productivity `a`. **Exact constants will be finalized and cited in code**, and
  **every parameter is env-configurable** (consistent with this repo's design).
- **Local b-value** (Aki 1965 MLE) only when we have a robust sample:
  ```
  b = log10(e) / ( mean(M | M ≥ Mc) − (Mc − ΔM/2) )       ΔM = 0.1 bin
  ```
  Near Palu the catalog is sparse and completeness (`Mc`) is poor, so we compute a
  local `b` **only** with ≥ `B_MIN_SAMPLE` events (≈50) above `Mc`; otherwise we
  use the default. We never let a noisy local fit produce a confident-looking
  number.

### 2.6 Stated limitations (these go in the doc *and* influence the copy)
- Parameters carry real uncertainty → outputs are **ranges/buckets**, not points.
- The model assumes a "typical" sequence. **Palu 2018 was not typical**
  (supershear strike-slip + a landslide-driven tsunami that standard models did
  not predict). Aftershock statistics do not forecast the unusual — the copy must
  stay humble and keep deferring to BMKG.
- Early in a sequence (first minutes/hours) the estimate is least certain.

---

## 3. Data model — the local catalog

The aftershock math needs more than the current dedup state (which only holds
*alerted* events ≥ M4). We add an accumulated **local catalog** of recent events
near Palu, including smaller ones, so we can estimate rates and (optionally) `b`.

**Store:** extend the persisted state (new `catalog` array, or a sibling
`catalog.json` on the same `/data` volume). Each entry is small:

```json
{ "timeIso": "...", "lat": -1.04, "lon": 120.23, "mag": 4.6, "depthKm": 10, "sources": ["BMKG","USGS"] }
```

**Population:** every cycle, append all near-Palu merged events with
`mag ≥ CATALOG_MIN_MAG` (≈3.5, below the alert floor so we capture sequence
structure), deduped by the same time+distance window used everywhere else.

**Retention:** `CATALOG_RETENTION_DAYS` (≈60) — long enough for a background-rate
sense and to span a sequence; pruned like the existing state.

**Cold start / backfill (optional, recommended):** on first run, one USGS FDSN
historical query for the Palu region seeds the catalog so the always-on host
isn't blind for weeks. Zero new dependencies (reuses `fetchUsgsSince`-style code).

---

## 4. When an Outlook is issued (trigger & cadence)

- **Trigger:** a mainshock near Palu with `mag ≥ OUTLOOK_TRIGGER_MAG` (proposed
  default below). Issued **once** per mainshock, deduped exactly like alerts
  (same time+distance key), recorded in state so restarts don't repeat it.
- **Sequencing:** the Outlook is a **follow-up** to the normal alert (a separate
  message a moment later), never a replacement for it.
- **Refresh (v1 = optional):** while a sequence is active, an updated Outlook at
  most once/day as probabilities decay. v1 can ship single-shot and add the daily
  refresh later. (Full **ETAS** time-dependent re-forecasting is explicitly out of
  scope for v1 — noted as a future option.)
- **Manual:** a `node run.js --outlook` command renders/sends the current Outlook
  for the latest qualifying mainshock (useful for testing and operator control).

---

## 5. Safety-framing rules (the part that must be right)

Every Outlook message MUST obey all of the following. These are testable
invariants (see §7) and rank alongside the CLAUDE.md safety invariants.

1. **Probabilistic, never deterministic.** Always "elevated probability"/"X in 100
   chance" over an **explicit window** and **explicit magnitude**. Never "will."
2. **Coarse, honest numbers.** Round to ranges or buckets (e.g. *rendah/sedang/
   tinggi · low/elevated/high*, or "~10–20%"). No decimals, no false precision.
3. **State the larger-quake chance plainly.** The small probability that a bigger
   earthquake follows is the most useful, most life-relevant line — never bury or
   omit it. (This is the anti-complacency counterpart to invariant #1.)
4. **Never imply "safe"/"all-clear."** Low probability ≠ safety. The message must
   not read as reassurance to lower one's guard.
5. **Keep the high-ground rule.** Restate: strong shaking near the coast → move to
   high ground immediately, do not wait. The Outlook never softens this.
6. **Decay honesty.** Say the elevated probability fades with time (and that it's
   highest right now).
7. **Defer to authorities.** BMKG/InaTEWS, sirens, and local officials first; this
   is a supplementary statistical estimate, not an official forecast.
8. **Humility about the model.** One line that this is a statistical estimate from
   global/regional models that can be wrong, and that unusual events (like 2018)
   are not captured.
9. **No fatigue.** Only after a genuinely significant mainshock (the trigger), and
   at most once/day — never for routine small quakes.
10. **Bilingual, calm, WITA.** Bahasa Indonesia first, then English; WITA local
    time; measured tone — same as all other messages.

### Draft copy (bilingual; numbers are placeholders, ranges only)

```
📈 PRAKIRAAN AKTIVITAS GEMPA SUSULAN / AFTERSHOCK OUTLOOK

Setelah gempa M6.7 dekat Palu, kemungkinan gempa susulan MENINGKAT untuk
sementara waktu. Ini perkiraan statistik, BUKAN ramalan gempa.

Dalam 24 jam ke depan (perkiraan kasar):
• Gempa susulan yang terasa (≥M4): kemungkinan TINGGI (~70–90%)
• Gempa susulan kuat (≥M6): kemungkinan RENDAH (~5–10%)
• Gempa LEBIH BESAR dari yang tadi: kemungkinan KECIL tapi nyata (~2–5%)

Kemungkinan ini paling tinggi sekarang dan menurun seiring waktu.
Jika terjadi guncangan kuat di dekat pantai: JANGAN menunggu — segera ke
tempat tinggi. Selalu utamakan BMKG, sirene, dan petugas.

— English —
After the M6.7 near Palu, aftershocks are temporarily MORE LIKELY. This is a
statistical estimate, NOT a prediction of a specific quake.
Next 24 h (rough): felt aftershock (≥M4) HIGH ~70–90% · strong (≥M6) LOW
~5–10% · an even LARGER quake SMALL but real ~2–5%. The chance is highest now
and decays with time. Strong shaking near the coast → move to high ground now,
don't wait. Always follow BMKG & authorities.
```

---

## 6. Architecture & integration (keeps the repo's shape)

All math is **pure** and lives in `core.js`; the store in `state.js`; orchestration
in `monitor.js`. **Zero new dependencies.**

- `src/core.js` (pure, fully unit-tested):
  - `bValueMLE(magnitudes, mc, dM=0.1)` → number | null (null if sample too small)
  - `expectedAftershocks({a, b, p, c, Mm}, M, S, T)` → expected count `N`
  - `probAtLeastOne(N)` → `1 − e^(−N)`
  - `outlookProbabilities(merged, params, windows)` → the felt/strong/larger figures
  - `bucketLabel(p)` → bilingual {id, en} coarse label + rounded range string
  - `buildOutlook(merged, stats, params)` → `{ subject, body }` obeying §5
- `src/state.js`: `appendCatalog`, `pruneCatalog`, `recordOutlook`/`findPriorOutlook`
- `src/monitor.js`: after a qualifying mainshock alert, compute stats from the
  catalog and send the Outlook (deduped); plus the `--outlook` command and
  optional daily refresh.
- `src/config.js` (new env knobs, all with defaults):
  `OUTLOOK_TRIGGER_MAG`, `OUTLOOK_FELT_MAG`, `OUTLOOK_WINDOWS` (e.g. 24h,168h),
  `AFTERSHOCK_A/B/P/C` (generic defaults), `B_MIN_SAMPLE`, `CATALOG_MIN_MAG`,
  `CATALOG_RETENTION_DAYS`, `OUTLOOK_ENABLED` (see decision Q2).

---

## 7. Testing plan (offline, deterministic — no network/creds)

- **Math correctness:** known `{a,b,p,c,Mm}` → assert `N(M,S,T)` and `P(≥1)` to a
  tolerance against hand-computed values; check the `p=1` vs `p≠1` integral branch.
- **b-value MLE:** synthetic G–R catalog with known `b` → estimator recovers it;
  small sample → returns `null` (falls back to default).
- **Monotonicity sanity:** bigger `Mm` ⇒ higher P; later window ⇒ lower P; larger
  target M ⇒ lower P.
- **Framing invariants (string assertions on `buildOutlook`):** must contain the
  "not a prediction" line, the larger-quake caveat, the high-ground line, the
  defer-to-BMKG line; must contain **no** decimal percentage; must be bilingual.
- **Trigger:** below `OUTLOOK_TRIGGER_MAG` ⇒ no Outlook; at/above ⇒ exactly one,
  and deduped on repeat.

---

## 8. Decisions (signed off)

1. **Trigger magnitude: M ≥ 5.5** (`OUTLOOK_TRIGGER_MAG=5.5`).
2. **Rollout: auto-post on by default.** Posts to the channel after each
   qualifying mainshock. A kill-switch `OUTLOOK_ENABLED` (default `true`) is still
   provided so it can be turned off without a code change.
3. **Number style: word buckets + rounded ranges** (e.g. "RENDAH (~5–10%) / LOW").

> Even with auto-post on, the framing rules in §5 are mandatory and enforced by
> tests. A local Bahasa-speaker copy review before/just-after launch is still
> strongly recommended.

---

## 9. References
- Reasenberg & Jones (1989), *Science* 243:1173 — operational aftershock probabilities.
- Utsu, Ogata & Matsu'ura (1995) — the modified Omori law.
- Gutenberg & Richter (1944); Aki (1965) — magnitude–frequency & b-value MLE.
- Page, van der Elst, Hardebeck, Felzer, Michael (2016), *BSSA* — generic global
  aftershock parameters for operational forecasts.
- USGS Operational Aftershock Forecasting (public forecast methodology).
