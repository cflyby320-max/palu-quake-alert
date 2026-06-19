// Orchestrator: poll sources -> merge -> filter -> dedup -> alert -> heartbeat.

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ALERT_RADIUS_KM,
  INFO_MAGNITUDE,
  MAX_EVENT_AGE_HOURS,
  ESCALATION_DELTA,
  POLL_SECONDS,
  STATE_FILE,
  HEARTBEAT_URL,
  HTTP_TIMEOUT_MS,
  activeChannelNames,
  channels,
} from './config.js';
import { fetchBmkg, fetchUsgs, fetchUsgsSince } from './sources.js';
import {
  parseBmkgEntry,
  parseUsgsFeature,
  clusterEvents,
  buildMessage,
  buildDigest,
  sequenceOrdinal,
} from './core.js';
import { loadState, saveState, findPriorAlert, recordAlert, pruneState } from './state.js';
import { notifyAll, sendTelegramTo, log } from './notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Single-instance guard. With Startup-folder autostart, the watcher could be
// launched twice (e.g. manual run + logon run); two loops would double-send and
// race on state.json. A PID lockfile prevents that.
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // exists but not ours
  }
}
function acquireLock() {
  const lock = STATE_FILE + '.lock';
  try {
    if (existsSync(lock)) {
      const pid = parseInt(readFileSync(lock, 'utf8'), 10);
      if (pid && isAlive(pid)) return false; // another instance is live
    }
    writeFileSync(lock, String(process.pid));
    const cleanup = () => {
      try {
        unlinkSync(lock);
      } catch {
        /* best effort */
      }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
    return true;
  } catch {
    return true; // never let lock bookkeeping stop monitoring
  }
}

// Load the captured real feeds so `--test` exercises the whole pipeline offline.
function loadFixtureEvents() {
  const j = (f) => JSON.parse(readFileSync(join(FIXTURES, f), 'utf8'));
  const events = [];
  const auto = j('bmkg_autogempa.json')?.Infogempa?.gempa;
  if (auto) {
    const e = parseBmkgEntry(auto);
    if (e) events.push(e);
  }
  const recent = j('bmkg_gempaterkini.json')?.Infogempa?.gempa || [];
  for (const g of recent) {
    const e = parseBmkgEntry(g);
    if (e) events.push(e);
  }
  for (const f of j('usgs_palu.json')?.features || []) {
    const e = parseUsgsFeature(f);
    if (e) events.push(e);
  }
  return events;
}

async function heartbeat() {
  if (!HEARTBEAT_URL) return;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    await fetch(HEARTBEAT_URL, { signal: ac.signal });
  } catch (e) {
    log('WARN', `heartbeat ping failed: ${e}`);
  } finally {
    clearTimeout(timer);
  }
}

// True only when an alert was actually attempted on >=1 external channel and
// every one failed. dry-run and log-only cycles have empty results and are NOT
// treated as delivery failures. Mirrors the "ALL channels failed" check in
// notify.js so the heartbeat and the CRITICAL delivery log always agree.
function allChannelsFailed(res) {
  return Boolean(res && !res.dryRun && res.results.length > 0 && res.results.every((r) => !r.ok));
}

// One full cycle. Returns number of alerts sent.
export async function runOnce({ dryRun = false, useFixtures = false, ignoreAge = false } = {}) {
  let events = [];
  let okSources = [];

  if (useFixtures) {
    events = loadFixtureEvents();
    okSources = ['FIXTURES'];
  } else {
    const [bmkg, usgs] = await Promise.allSettled([fetchBmkg(), fetchUsgs()]);
    if (bmkg.status === 'fulfilled') {
      events.push(...bmkg.value);
      okSources.push('BMKG');
    } else log('ERROR', `BMKG fetch failed: ${bmkg.reason}`);
    if (usgs.status === 'fulfilled') {
      events.push(...usgs.value);
      okSources.push('USGS');
    } else log('ERROR', `USGS fetch failed: ${usgs.reason}`);

    if (okSources.length === 0) {
      log('CRITICAL', 'Both data sources failed this cycle — no monitoring this round.');
      return 0;
    }
  }

  const state = loadState(STATE_FILE);
  const now = Date.now();
  const maxAgeMs = MAX_EVENT_AGE_HOURS * 3600 * 1000;

  const merged = clusterEvents(events)
    .filter((m) => m.distanceToPalu() <= ALERT_RADIUS_KM)
    .filter((m) => m.magnitude >= INFO_MAGNITUDE)
    .filter((m) => ignoreAge || now - m.time.getTime() <= maxAgeMs)
    .sort((a, b) => a.time - b.time);

  let sent = 0;
  let deliveryFailed = false;
  for (const m of merged) {
    // "Nth quake near Palu in 24h" — computed before recordAlert(m), so the
    // ordinal counts the priors and lands on this event.
    const sequenceN = sequenceOrdinal(state.alerted, m);
    const prior = findPriorAlert(state, m);
    if (!prior) {
      const msg = buildMessage(m, { sequenceN });
      const res = await notifyAll(msg, { dryRun });
      if (allChannelsFailed(res)) deliveryFailed = true;
      recordAlert(state, m);
      sent++;
    } else if (m.magnitude - prior.mag >= ESCALATION_DELTA) {
      // Preliminary magnitude was revised upward — re-alert as an escalation.
      const msg = buildMessage(m, { sequenceN });
      msg.subject = `⏫ DIPERBARUI / UPDATED: ${msg.subject}`;
      msg.body = `⏫ Magnitudo diperbarui M${prior.mag.toFixed(1)} → M${m.magnitude.toFixed(
        1
      )} / Magnitude revised up.\n\n${msg.body}`;
      const res = await notifyAll(msg, { dryRun });
      if (allChannelsFailed(res)) deliveryFailed = true;
      prior.mag = m.magnitude;
      sent++;
    }
  }

  pruneState(state);
  saveState(STATE_FILE, state);
  // Dead-man's-switch integrity: only signal "alive" to the heartbeat monitor if
  // delivery actually worked. A cycle that detected a quake but failed to send it
  // on EVERY channel must NOT keep the healthcheck green — that silent
  // "detector up, delivery down" state (e.g. a revoked bot token 404-ing every
  // send) is exactly what the heartbeat exists to expose.
  if (deliveryFailed) {
    log(
      'ERROR',
      "Heartbeat SUPPRESSED — an alert failed on all channels this cycle. Dead-man's-switch will fire so you learn delivery is broken."
    );
  } else {
    await heartbeat();
  }

  log(
    'INFO',
    `cycle ok — sources:[${okSources.join(',')}] events:${events.length} near-Palu-merged:${merged.length} alerts-sent:${sent}`
  );
  return sent;
}

async function selftest() {
  log('INFO', 'Self-test: config + live connectivity');
  log('INFO', `Active alert channels: [${activeChannelNames().join(', ') || 'NONE (log-only)'}]`);
  const [bmkg, usgs] = await Promise.allSettled([fetchBmkg(), fetchUsgs()]);
  log(
    bmkg.status === 'fulfilled' ? 'INFO' : 'ERROR',
    `BMKG: ${bmkg.status === 'fulfilled' ? bmkg.value.length + ' events' : bmkg.reason}`
  );
  log(
    usgs.status === 'fulfilled' ? 'INFO' : 'ERROR',
    `USGS: ${usgs.status === 'fulfilled' ? usgs.value.length + ' events' : usgs.reason}`
  );
  log('INFO', 'Self-test done.');
}

// Posts a catch-up recap of recent qualifying quakes to the channel (or, if no
// channel is configured, to all recipients). Reusable: `node run.js --digest 24`.
async function runDigest(hours, dryRun) {
  const startIso = new Date(Date.now() - hours * 3600 * 1000).toISOString().slice(0, 19);
  const [usgs, bmkg] = await Promise.allSettled([
    fetchUsgsSince(startIso, INFO_MAGNITUDE),
    fetchBmkg(),
  ]);
  const events = [];
  if (usgs.status === 'fulfilled') events.push(...usgs.value);
  else log('ERROR', `digest USGS fetch failed: ${usgs.reason}`);
  if (bmkg.status === 'fulfilled') events.push(...bmkg.value);
  const cutoff = Date.now() - hours * 3600 * 1000;
  const merged = clusterEvents(events)
    .filter((m) => m.distanceToPalu() <= ALERT_RADIUS_KM)
    .filter((m) => m.magnitude >= INFO_MAGNITUDE)
    .filter((m) => m.time.getTime() >= cutoff)
    .sort((a, b) => b.time - a.time)
    .slice(0, 30);
  const { body } = buildDigest(merged, { hours, minMag: INFO_MAGNITUDE, radiusKm: ALERT_RADIUS_KM });
  log('INFO', `digest: ${merged.length} qualifying events in last ${hours}h`);
  if (dryRun) {
    console.log('\n----- DIGEST (dry-run, not sent) -----\n' + body + '\n');
    return;
  }
  const channelId = channels.telegram.chatIds.find((id) => id.startsWith('-100'));
  if (channelId) {
    await sendTelegramTo(channelId, body);
    log('INFO', `digest posted to channel ${channelId}`);
  } else {
    await notifyAll({ subject: 'Quake recap', body }, { dryRun: false });
  }
}

export async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help')) {
    console.log(
      [
        'Palu earthquake alerter',
        '  node run.js              continuous monitoring loop',
        '  node run.js --once       single cycle (for cron)',
        '  node run.js --selftest   check config + live feed connectivity',
        '  node run.js --testsend   send a REAL test message to your channels',
        '  node run.js --test       offline demo using captured real data (dry-run)',
        '  node run.js --digest [h] post a recap of recent quakes to the channel (default 24h)',
        '  --dry-run                log alerts but do not send externally',
      ].join('\n')
    );
    return;
  }
  if (args.has('--selftest')) return selftest();

  if (args.has('--testsend')) {
    // Sends a REAL message to every configured channel so you can confirm
    // delivery end-to-end without waiting for an actual earthquake.
    const body =
      '🔔 TES / TEST — Palu Quake Alerter\n\n' +
      'Ini hanya pesan uji. Jika Anda menerima ini, notifikasi gempa BERFUNGSI.\n' +
      'This is only a test. If you received this, your earthquake alerts are WORKING.';
    await notifyAll({ subject: '🔔 TEST — Palu Quake Alerter', body }, { dryRun: false });
    return;
  }

  if (args.has('--digest')) {
    const hoursArg = process.argv.slice(2).find((a) => /^\d+$/.test(a));
    return runDigest(hoursArg ? Number(hoursArg) : 24, args.has('--dry-run'));
  }

  const dryRun = args.has('--dry-run') || args.has('--test');
  const useFixtures = args.has('--test');

  if (args.has('--once') || useFixtures) {
    await runOnce({ dryRun, useFixtures, ignoreAge: useFixtures });
    return;
  }

  if (!acquireLock()) {
    log('WARN', 'Another instance is already running — exiting this one.');
    return;
  }
  log('INFO', `Starting Palu alerter — poll every ${POLL_SECONDS}s. Channels: [${activeChannelNames().join(', ') || 'NONE'}]`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce({ dryRun });
    } catch (e) {
      log('ERROR', `cycle crashed (continuing): ${e && e.stack ? e.stack : e}`);
    }
    await sleep(POLL_SECONDS * 1000);
  }
}
