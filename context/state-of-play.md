# Palu quake alert — state of play

**DORMANT** — real, shipped, no current attention. Both reliability defects
closed 2026-08-22. (No `Updated:` stamp here on purpose — see the keepalive rule
below. `## Latest` carries the dates that mean something.)

> **Handover test:** someone else should be able to work this for two weeks from
> this file alone. Pulse, not archive — history lives in `context/archive.md`.

## Latest

- **2026-08-22** — duplicate-alert guard **armed** and verified against a live
  triggered run. It had been disarmed since 2026-08-09. *(Alief)*
- **2026-08-22** — Fly.io liveness confirmed via control-plane check. *(Alief)*
- **2026-08-09** — both reliability defects first found. *(Alief)*

## What this is

Automated earthquake/tsunami rapid-notification system — **not** true P-wave
early warning — protecting relatives in Palu, Central Sulawesi. BMKG/InaTEWS
primary with a USGS cross-check, delivered via Telegram and Twilio WhatsApp.

Not a client engagement: personal-stakes family-safety infrastructure, tracked
here because it has real state to pick up and put down cleanly.

## What binds

**The repo is public on purpose** (GitHub Pages + free Actions minutes).
Secrets are protected by `.gitignore`, not by repo privacy, and `.env` has never
been committed. Being public makes that boundary matter **more**, not less.

**Never write a "last touched" date here.** `.github/workflows/keepalive.yml`
pushes an empty commit every Monday, so any date recorded is guaranteed wrong
within a week by design. `git fetch` and read the log.

**A green `Verify` is offline tests only.** What it runs is `.github/workflows/verify.yml`;
what the suite covers is this repo's `CLAUDE.md` → `## Tests`. (There is no
"Verify table" in that file — that table lived in the Nalar OS brain and was
retired 2026-08-23.) **Unreceipted:** the
only observed pass was local, 2026-08-07. No CI run has been checked since, so
"green" is a memory here, not a receipt.

**Fly.io declares no public port on purpose** (`fly.toml`). Liveness is a
control-plane check (`fly status -a palu-quake-alert`), never an HTTP probe — it
confirms the machine runs, not that any given alert fired.

## Where it stands

Both prior defects are closed, so the open problem is back to **reach, not
reliability**:

- 25 Telegram subscribers, **under 5 daily viewers**.
- Instagram (`@infogempapalu`) still fully manual — AI drafts the card and
  caption and DMs it to the operator; a human posts it.
- The reactive per-quake card never got the design-system treatment.

## Open

- [ ] Reach. The system works and almost nobody sees it.
- [ ] Automate or retire the manual Instagram step.
- [ ] Design-system pass on the per-quake card.
- [ ] Get a real CI receipt for `Verify` instead of a 2026-08-07 memory.

## Where to dig deeper

This file always loads in full. Nothing below loads unless the task needs it.

| Read this | When |
|---|---|
| this repo's `README.md` + `CLAUDE.md` | how the system works — alert logic, severity rules, how to run it |
| `studio/STUDIO_DESIGN.md` | the Instagram pipeline, or its known Google Drive `npm install` problem |
| `context/archive.md` | the 2026-08-07 consolidation, the security audit, the full shipped inventory, and what was fixed on 2026-08-22 |
| Nalar OS → `brain/insights/one-canonical-clone.md` and `brain/playbooks/verify-repo-state.md` | before touching local clones of any repo — **both lessons came from here** |
