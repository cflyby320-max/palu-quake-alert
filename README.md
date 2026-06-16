# Palu Earthquake & Tsunami-Caution Alerter

Rapid, automated earthquake alerts for family in **Palu, Central Sulawesi**.
Pulls from **two independent sources** — Indonesia's official **BMKG/InaTEWS**
(primary) and **USGS** (cross-check/fallback) — and pushes a clear, bilingual
(Bahasa Indonesia + English) alert to relatives via Telegram, SMS, or WhatsApp.

Written in **Node.js with zero third-party dependencies** (uses only the
built-in `fetch`, file system, and test runner). Nothing to `pip`/`npm install`,
which means fewer things that can break in a tool you're trusting with safety.

---

## ⚠️ Read this first — what this is, and what it is NOT

- **This is a rapid *notification* system, not true "early warning."** Real
  early warning (the kind that beats the shaking by seconds) needs a dedicated
  seismic sensor network detecting the P-wave. You can't build that from a data
  feed. What this gives is a fast, automated heads-up — typically **2–5 minutes
  after** an event — which is still genuinely useful for tsunami/aftershock
  awareness and for relatives who are away.
- **It does NOT replace official warnings.** It re-broadcasts BMKG/USGS data.
  Always defer to BMKG, local sirens, and authorities.
- **"No tsunami potential" is never treated as "safe."** The 2018 Palu tsunami
  was caused by submarine landslides that standard models did not predict, and
  the official warning was lifted early. So for any large, shallow quake near
  the coast, the alert tells relatives to **move to high ground regardless of
  the official flag.** The single most important rule we encode:
  > Strong shaking near the coast → high ground now. Don't wait for an all-clear.

---

## Quick start

```bash
# 1. See the help
node run.js --help

# 2. Run the offline demo on captured real data (no setup, sends nothing)
node run.js --test

# 3. Check live connectivity to BMKG + USGS and see which channels are active
node run.js --selftest

# 4. Run the unit tests
npm test

# 5. Configure and go live
cp .env.example .env     # then edit .env (see below)
node --env-file=.env run.js          # continuous loop
node --env-file=.env run.js --once   # single cycle (for cron)
```

---

## Setting up alert delivery

Pick at least one channel. **Telegram is recommended** — free, reliable, and the
easiest to set up for multiple relatives.

### Telegram (recommended)
1. In Telegram, message **@BotFather** → `/newbot` → copy the **token**.
2. Each relative opens a chat with your new bot and sends it any message.
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find each person's
   numeric **chat ID**.
4. In `.env`: set `TELEGRAM_BOT_TOKEN` and a comma-separated `TELEGRAM_CHAT_IDS`.

### Twilio SMS (no smartphone needed)
Set `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` (your Twilio number), and
`TWILIO_TO` (comma-separated `+62...` numbers). Good for relatives without data.

### Twilio WhatsApp (high deliverability in Indonesia)
Reuses your Twilio credentials. Set `TWILIO_WHATSAPP_FROM` and
`TWILIO_WHATSAPP_TO` (`whatsapp:+62...`).

> You can enable several channels at once for redundancy — each sends
> independently, and one failing never blocks the others.

---

## Configuration reference

| Variable | Default | Meaning |
|---|---|---|
| `PALU_LAT` / `PALU_LON` | -0.8917 / 119.8707 | Location to protect |
| `ALERT_RADIUS_KM` | 350 | Only events this close to Palu are considered |
| `MIN_MAGNITUDE` | 5.0 | Below this: logged, not alerted |
| `STRONG_MAGNITUDE` | 6.0 | Likely strongly felt nearby |
| `TSUNAMI_MAG` | 6.5 | Large shallow quakes ≥ this get a high-ground caution |
| `SHALLOW_KM` | 70 | "Shallow" threshold for tsunami caution |
| `MAX_EVENT_AGE_HOURS` | 2 | Ignore stale events (prevents startup spam) |
| `POLL_SECONDS` | 45 | Loop interval (continuous mode) |
| `HEARTBEAT_URL` | — | Dead-man's-switch ping (see below) |
| `STATE_FILE` / `LOG_FILE` | state.json / quake_alert.log | Persistence paths |

---

## Deployment

### Recommended: always-on (Docker / VPS / Raspberry Pi)
A long-lived process polling every ~45s, with dedup state on a persistent
volume. This is the right runtime for a safety tool.

```bash
docker build -t palu-alert .
docker run -d --restart=always --env-file .env -v palu_state:/data palu-alert
```

Cheap hosts that work well: Fly.io, Railway, a small VPS, Oracle Cloud free
tier, or a Raspberry Pi at a relative's house (bonus: local to Palu).

### Fallback: GitHub Actions (free, zero infra)
`.github/workflows/monitor.yml` runs `--once` on a cron. **Caveat:** GitHub's
minimum cron is 5 minutes and can be delayed — slower than BMKG publishes. Fine
to get started; move to the always-on runtime for production. Put credentials in
repository **Secrets**, not in the repo.

### Heartbeat (do this!)
The scariest failure for a safety tool is dying silently. Create a free check at
**healthchecks.io**, put its ping URL in `HEARTBEAT_URL`, and you'll be notified
if the alerter stops running. The watcher watches the quakes; healthchecks
watches the watcher.

---

## Steering it from your phone (Claude on iPhone)

If you run this under **Claude Code with Remote Control paired**, status
notifications reach your phone and you can steer the session from the Claude iOS
app. Pair it once from an interactive `claude` terminal before you step away.

For day-to-day operation once deployed, you don't need Claude at all — you
manage it through the channel you chose (e.g. the Telegram bot) and the
healthchecks.io dashboard, both of which work fine from a phone.

---

## How it works

```
BMKG autogempa + gempaterkini ─┐
                               ├─► normalize ─► cluster (merge the two feeds'
USGS radius query ─────────────┘                 versions of one quake)
                                                      │
        ignore stale / far / small events ◄───────────┘
                                                      │
        dedup vs. persisted state (re-alert only on magnitude upgrade)
                                                      │
        classify (level + tsunami caution) ─► bilingual message
                                                      │
        deliver to all configured channels  +  heartbeat ping
```

Key design choices and why: see code comments in `src/` — every non-obvious
decision (string parsing quirks, the conservative tsunami logic, cross-source
dedup) is documented inline.

## Limitations / honest caveats
- Notification latency is minutes, not seconds (not P-wave early warning).
- Depends on BMKG/USGS uptime; during a major disaster the BMKG server can be
  under load — which is exactly why USGS fallback exists.
- BMKG fields are free-text strings and occasionally change format; parsing is
  defensive but a major feed change would need a code update.
- Magnitudes/locations in the first minutes are preliminary and may be revised.
```

## Tests
`npm test` runs offline tests against frozen real data (no network/credentials).
