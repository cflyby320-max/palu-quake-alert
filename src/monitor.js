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
  OUTLOOK_ENABLED,
  OUTLOOK_TRIGGER_MAG,
  OUTLOOK_FELT_MAG,
  OUTLOOK_STRONG_MAG,
  CATALOG_MIN_MAG,
  AFTERSHOCK_A,
  AFTERSHOCK_B,
  AFTERSHOCK_P,
  AFTERSHOCK_C,
  B_MIN_SAMPLE,
  DIGEST_ENABLED,
  DIGEST_HOURS,
  activeChannelNames,
  channels,
} from './config.js';
import { fetchBmkg, fetchUsgs } from './sources.js';
import {
  parseBmkgEntry,
  parseUsgsFeature,
  clusterEvents,
  buildMessage,
  digestFromCatalog,
  sequenceOrdinal,
  bValueMLE,
  outlookStats,
  buildOutlook,
} from './core.js';
import {
  loadState,
  saveState,
  findPriorAlert,
  recordAlert,
  pruneState,
  appendCatalog,
  pruneCatalog,
  findPriorOutlook,
  recordOutlook,
} from './state.js';
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
export function allChannelsFailed(res) {
  return Boolean(res && !res.dryRun && res.results.length > 0 && res.results.every((r) => !r.ok));
}

// After a qualifying mainshock alert, post the Seismic Activity Outlook once
// (deduped). Uses a locally-fitted b-value when the catalog is rich enough,
// otherwise the configured default. Best-effort: never throws into the cycle.
async function maybeSendOutlook(state, m, dryRun) {
  if (!OUTLOOK_ENABLED || m.magnitude < OUTLOOK_TRIGGER_MAG) return;
  if (findPriorOutlook(state, m)) return;
  try {
    const localB = bValueMLE((state.catalog || []).map((a) => a.mag), CATALOG_MIN_MAG, 0.1, B_MIN_SAMPLE);
    const params = { a: AFTERSHOCK_A, b: localB ?? AFTERSHOCK_B, p: AFTERSHOCK_P, c: AFTERSHOCK_C };
    const stats = outlookStats(m.magnitude, params, { feltMag: OUTLOOK_FELT_MAG, strongMag: OUTLOOK_STRONG_MAG });
    await notifyAll(buildOutlook(m, stats), { dryRun });
    recordOutlook(state, m);
    log('INFO', `outlook posted for M${m.magnitude.toFixed(1)} (b=${params.b.toFixed(2)} ${localB ? 'local' : 'default'})`);
  } catch (e) {
    log('ERROR', `outlook failed (alert already sent): ${e && e.stack ? e.stack : e}`);
  }
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

  // All near-Palu quakes this cycle. Accumulate the local catalog first (incl.
  // sub-alert-floor events, regardless of age) so the Outlook model has data;
  // then the alert pipeline applies the magnitude floor and freshness window.
  const nearPalu = clusterEvents(events).filter((m) => m.distanceToPalu() <= ALERT_RADIUS_KM);
  for (const m of nearPalu) appendCatalog(state, m, CATALOG_MIN_MAG);

  const merged = nearPalu
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
      await maybeSendOutlook(state, m, dryRun);
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
      // An upward revision may push the event over the Outlook trigger.
      await maybeSendOutlook(state, m, dryRun);
      sent++;
    }
  }

  pruneState(state);
  pruneCatalog(state);
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

// Post a catch-up recap built from the PERSISTED CATALOG (what we actually
// recorded), so it always matches the real-time alerts — a quake that has
// rolled off the live feed is still in the catalog. Shared by the manual
// `--digest` CLI and the scheduled twice-daily run. Posts to the channel, or to
// all recipients if no channel is configured.
async function postDigest(catalog, hours, dryRun) {
  const { subject, body, count } = digestFromCatalog(catalog, {
    hours,
    minMag: INFO_MAGNITUDE,
    radiusKm: ALERT_RADIUS_KM,
  });
  log('INFO', `digest: ${count} qualifying events in last ${hours}h`);
  if (dryRun) {
    console.log('\n----- DIGEST (dry-run, not sent) -----\n' + body + '\n');
    return;
  }
  const channelId = channels.telegram.chatIds.find((id) => id.startsWith('-100'));
  if (channelId) {
    await sendTelegramTo(channelId, body);
    log('INFO', `digest posted to channel ${channelId}`);
  } else {
    await notifyAll({ subject, body }, { dryRun: false });
  }
}

// `node run.js --digest [hours]` — manual recap from the local catalog.
async function runDigest(hours, dryRun) {
  const state = loadState(STATE_FILE);
  await postDigest(state.catalog, hours, dryRun);
}

// The 08:00 & 20:00 WITA digest slots are 00:00 & 12:00 UTC. Returns the most
// recent slot at or before `now`, so the loop posts once per slot and dedups
// across restarts via state.lastDigestIso.
function lastDigestSlot(now) {
  const d = new Date(now);
  const slot = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  if (d.getUTCHours() >= 12) slot.setUTCHours(12);
  return slot;
}

// Posts the twice-daily recap from inside the always-on loop (NOT from --once,
// which has no persistent state/catalog). Idempotent per slot and across
// restarts via state.lastDigestIso. Best-effort: never throws into the cycle.
async function maybeRunScheduledDigest(dryRun) {
  if (!DIGEST_ENABLED) return;
  try {
    const state = loadState(STATE_FILE);
    const slot = lastDigestSlot(Date.now());
    // First ever run: arm at the current slot WITHOUT posting, so a fresh deploy
    // or a restart never fires a recap immediately.
    if (!state.lastDigestIso) {
      state.lastDigestIso = slot.toISOString();
      saveState(STATE_FILE, state);
      return;
    }
    if (slot.getTime() <= new Date(state.lastDigestIso).getTime()) return; // already posted this slot
    await postDigest(state.catalog, DIGEST_HOURS, dryRun);
    state.lastDigestIso = slot.toISOString();
    saveState(STATE_FILE, state);
  } catch (e) {
    log('ERROR', `scheduled digest failed: ${e && e.stack ? e.stack : e}`);
  }
}

// Renders (and optionally posts) the Seismic Activity Outlook for the most recent
// qualifying mainshock near Palu. Manual + unconditional (no dedup), so an
// operator can preview or re-post: `node run.js --outlook [--dry-run]`.
async function runOutlook(dryRun) {
  const [bmkg, usgs] = await Promise.allSettled([fetchBmkg(), fetchUsgs()]);
  const events = [];
  if (bmkg.status === 'fulfilled') events.push(...bmkg.value);
  else log('ERROR', `outlook BMKG fetch failed: ${bmkg.reason}`);
  if (usgs.status === 'fulfilled') events.push(...usgs.value);
  else log('ERROR', `outlook USGS fetch failed: ${usgs.reason}`);

  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const mainshock = clusterEvents(events)
    .filter((m) => m.distanceToPalu() <= ALERT_RADIUS_KM)
    .filter((m) => m.magnitude >= OUTLOOK_TRIGGER_MAG)
    .filter((m) => m.time.getTime() >= cutoff)
    .sort((a, b) => b.time - a.time)[0];
  if (!mainshock) {
    log('INFO', `No qualifying mainshock (>= M${OUTLOOK_TRIGGER_MAG}) near Palu in the last 7 days.`);
    return;
  }

  const state = loadState(STATE_FILE);
  const localB = bValueMLE((state.catalog || []).map((a) => a.mag), CATALOG_MIN_MAG, 0.1, B_MIN_SAMPLE);
  const params = { a: AFTERSHOCK_A, b: localB ?? AFTERSHOCK_B, p: AFTERSHOCK_P, c: AFTERSHOCK_C };
  const stats = outlookStats(mainshock.magnitude, params, { feltMag: OUTLOOK_FELT_MAG, strongMag: OUTLOOK_STRONG_MAG });
  const { subject, body } = buildOutlook(mainshock, stats);
  log('INFO', `outlook for M${mainshock.magnitude.toFixed(1)} (b=${params.b.toFixed(2)} ${localB ? 'local' : 'default'})`);
  if (dryRun) {
    console.log('\n----- OUTLOOK (dry-run, not sent) -----\n' + body + '\n');
    return;
  }
  const channelId = channels.telegram.chatIds.find((id) => id.startsWith('-100'));
  if (channelId) {
    await sendTelegramTo(channelId, body);
    log('INFO', `outlook posted to channel ${channelId}`);
  } else {
    await notifyAll({ subject, body }, { dryRun: false });
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
        '  node run.js --outlook    post an aftershock-probability Outlook for the latest mainshock',
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

  if (args.has('--outlook')) return runOutlook(args.has('--dry-run'));

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
      await maybeRunScheduledDigest(dryRun);
    } catch (e) {
      log('ERROR', `cycle crashed (continuing): ${e && e.stack ? e.stack : e}`);
    }
    await sleep(POLL_SECONDS * 1000);
  }
}
