# Deploying the always-on watcher (Fly.io)

Run these from your **Mac**, in a clone of this repo. This puts the alerter on a
small machine that polls every ~45s 24/7 and pings the heartbeat — so coverage
no longer depends on your PC being awake.

## 0. Get the repo on the Mac (once)

```bash
git clone https://github.com/cflyby320-max/palu-quake-alert.git
cd palu-quake-alert
# (or, if already cloned:  git checkout main && git pull origin main)
```

## 1. Install the Fly CLI and log in

```bash
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth signup            # first time (asks for a payment method)
# or, if you already have an account:
fly auth login
```

> Cost note: a `shared-cpu-1x` / 256 MB machine plus a 1 GB volume is roughly a
> couple of USD per month and may fall under Fly's small free allowance. Fly
> requires a card on file even for tiny apps. If you'd rather avoid that, a
> Raspberry Pi at home or any cheap VPS runs the same `docker compose` setup.

## 2. Create the app from the committed `fly.toml`

```bash
fly launch --no-deploy --copy-config
```
- `--copy-config` reuses the `fly.toml` already in this repo (app name
  `palu-quake-alert`, region `sin` = Singapore, a `/data` volume mount).
- `--no-deploy` means "set up only, don't deploy yet" — we still need the volume
  and secrets.
- If it says the app name is taken, pick another and update `app = "..."` in
  `fly.toml`.

## 3. Create the persistent volume (holds dedup state)

```bash
fly volumes create palu_state --region sin --size 1
```
Must match `source = "palu_state"` and the region in `fly.toml`.

## 4. Set your secrets (NOT committed)

```bash
fly secrets set \
  TELEGRAM_BOT_TOKEN="paste-token" \
  TELEGRAM_CHAT_IDS="id1,id2,id3" \
  HEARTBEAT_URL="https://hc-ping.com/your-uuid"
# add TWILIO_* here too if you use SMS/WhatsApp
```
Use the **same** values that are in your PC's `.env`. Setting `HEARTBEAT_URL`
here is what makes the heartbeat independent of your PC.

## 5. Deploy and verify

```bash
fly deploy
fly status                 # should show 1 machine, started
fly logs                   # watch for a line every ~45s:
                           #   [INFO] cycle ok — sources:[BMKG,USGS] events:NN ...
```
Then confirm your **healthchecks.io** check goes solid green and stays up.

---

## IMPORTANT: run only ONE always-on sender

Each running watcher sends alerts independently and keeps its **own** dedup
state, so two of them = your family gets **duplicate** Telegram messages.

Once the Fly machine is confirmed healthy:

- **Stop the PC's auto-start loop** (remove/disable the Startup-folder launcher,
  or just don't run `node ... run.js` on the PC). Fly is now the primary.
- The **GitHub Actions cron** can stay as an emergency backup. It runs rarely,
  so at worst it occasionally double-sends — acceptable for a safety tool, since
  a duplicate alert is far better than a missed one. (Remove the workflow if even
  that bothers you.)

The PC is then only for *steering/checking* via Remote Control, not for sending.

## Common operations

```bash
fly logs                       # live logs
fly status                     # machine state
fly secrets set KEY=value      # change config (auto-redeploys)
fly deploy                     # redeploy after a git pull of new code
fly machine stop / start       # pause / resume the watcher
fly scale count 1              # ensure exactly one instance (never >1)
```
