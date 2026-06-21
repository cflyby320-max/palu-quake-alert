// Priority-1 safety-critical tests: the delivery fallback, the dead-man's-switch
// heartbeat suppression, corrupt-state resilience, and the shallow-quake /
// conservative-tsunami classification rules. Runs entirely offline (global
// `fetch` is stubbed); no network, no credentials. Run with `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { deliverTelegram } from '../src/notify.js';
import { allChannelsFailed } from '../src/monitor.js';
import { loadState } from '../src/state.js';
import { classify, clusterEvents, Event } from '../src/core.js';

// --- Item 1: Telegram delivery — the alert TEXT must always get through ------
// Stubs global.fetch and records the API endpoints hit so we can prove which
// Telegram method (sendPhoto vs sendMessage) was called, in what order.

function stubFetch({ failOn = () => false } = {}) {
  const calls = [];
  global.fetch = async (url, opts) => {
    const u = String(url);
    calls.push({ url: u, body: opts && opts.body });
    if (failOn(u)) return { ok: false, status: 400, text: async () => 'bad request' };
    return { ok: true, status: 200, text: async () => 'ok' };
  };
  return calls;
}

test('deliverTelegram: photo + short body sends ONE rich sendPhoto', async () => {
  const saved = global.fetch;
  try {
    const calls = stubFetch();
    await deliverTelegram('123', { subject: 'S', body: 'short body', photo: 'http://img/x.jpg' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/sendPhoto$/);
  } finally {
    global.fetch = saved;
  }
});

test('deliverTelegram: if the photo send FAILS, it falls back to plain text', async () => {
  const saved = global.fetch;
  try {
    const calls = stubFetch({ failOn: (u) => u.includes('/sendPhoto') });
    await deliverTelegram('123', { subject: 'S', body: 'evac now', photo: 'http://img/x.jpg' });
    // photo attempted first (fails), then the text alert is sent anyway.
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/sendPhoto$/);
    assert.match(calls[1].url, /\/sendMessage$/);
    assert.match(calls[1].body, /text=evac\+now/); // the warning text got through
  } finally {
    global.fetch = saved;
  }
});

test('deliverTelegram: a body too long for a caption sends text first, photo as extra', async () => {
  const saved = global.fetch;
  try {
    const calls = stubFetch();
    await deliverTelegram('123', { subject: 'Subj', body: 'x'.repeat(1100), photo: 'http://img/x.jpg' });
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/sendMessage$/); // full text first
    assert.match(calls[1].url, /\/sendPhoto$/); // image best-effort after
  } finally {
    global.fetch = saved;
  }
});

test('deliverTelegram: no photo sends a single plain text message', async () => {
  const saved = global.fetch;
  try {
    const calls = stubFetch();
    await deliverTelegram('123', { subject: 'S', body: 'hi', photo: null });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/sendMessage$/);
  } finally {
    global.fetch = saved;
  }
});

// --- Item 2: heartbeat suppression (the dead-man's-switch) -------------------
// allChannelsFailed must be true ONLY when an external send was attempted and
// every channel failed — never for dry-run or log-only cycles.

test('allChannelsFailed flags only a real all-channels-failed delivery', () => {
  assert.equal(allChannelsFailed(null), false); // defensive
  assert.equal(allChannelsFailed({ dryRun: true, results: [] }), false); // dry-run
  assert.equal(allChannelsFailed({ dryRun: false, results: [] }), false); // log-only, nothing attempted
  assert.equal(allChannelsFailed({ dryRun: false, results: [{ ok: true }] }), false); // delivered
  assert.equal(allChannelsFailed({ dryRun: false, results: [{ ok: true }, { ok: false }] }), false); // one ok
  assert.equal(allChannelsFailed({ dryRun: false, results: [{ ok: false }] }), true); // sole channel failed
  assert.equal(allChannelsFailed({ dryRun: false, results: [{ ok: false }, { ok: false }] }), true); // all failed
});

// --- Item 3: corrupt/missing state must never silence the alerter -----------

test('loadState survives a missing file, corrupt JSON, and partial state', () => {
  const p = (n) => join(tmpdir(), `pqa-${n}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const empty = { alerted: [], catalog: [], outlooks: [] };

  // Missing file -> a clean empty state (not a throw).
  assert.deepEqual(loadState(p('missing')), empty);

  // Corrupt JSON -> clean empty state, still no throw (alerts must keep running).
  const corrupt = p('corrupt');
  writeFileSync(corrupt, '{ not valid json ');
  try {
    assert.deepEqual(loadState(corrupt), empty);
  } finally {
    rmSync(corrupt, { force: true });
  }

  // Partial state (old file missing newer arrays) -> arrays normalised, data kept.
  const partial = p('partial');
  writeFileSync(partial, JSON.stringify({ alerted: [{ mag: 5 }] }));
  try {
    const s = loadState(partial);
    assert.deepEqual(s.alerted, [{ mag: 5 }]);
    assert.deepEqual(s.catalog, []);
    assert.deepEqual(s.outlooks, []);
  } finally {
    rmSync(partial, { force: true });
  }
});

// --- Item 4: shallow-quake tsunami caution rules (2018 Palu lesson) ----------

const near = (over) =>
  new Event({ source: 'BMKG', id: 'x', time: new Date(), lat: -1.0, lon: 120.0, tsunamiFlag: false, ...over });

test('classify: unknown depth on a large quake is treated as SHALLOW (precautionary)', () => {
  const [m] = clusterEvents([near({ magnitude: 6.8, depthKm: NaN })]);
  const c = classify(m);
  assert.equal(c.shallow, true);
  assert.equal(c.tsunami, 'caution'); // never assume "deep/safe" when depth is unknown
});

test('classify: a large but DEEP quake gets no tsunami caution', () => {
  const [m] = clusterEvents([near({ magnitude: 6.8, depthKm: 120 })]);
  const c = classify(m);
  assert.equal(c.shallow, false);
  assert.equal(c.tsunami, 'none');
});

test('classify: caution boundary is inclusive at TSUNAMI_MAG / SHALLOW_KM, and exclusive just under', () => {
  // Exactly on the threshold (M6.5 at 70 km) -> caution.
  assert.equal(classify(clusterEvents([near({ magnitude: 6.5, depthKm: 70 })])[0]).tsunami, 'caution');
  // Just under the magnitude threshold (M6.4 shallow) -> no caution.
  assert.equal(classify(clusterEvents([near({ magnitude: 6.4, depthKm: 10 })])[0]).tsunami, 'none');
});

// --- Item 5: conservative cross-source tsunami merge (warn if ANY warns) -----

function merged(flagA, flagB) {
  const t = new Date('2026-06-16T03:00:00Z');
  const a = new Event({ source: 'BMKG', id: 'a', time: t, magnitude: 6.5, depthKm: 10, lat: -1.0, lon: 120.0, tsunamiFlag: flagA });
  const b = new Event({ source: 'USGS', id: 'b', time: t, magnitude: 6.4, depthKm: 10, lat: -1.0, lon: 120.0, tsunamiFlag: flagB });
  const c = clusterEvents([a, b]);
  assert.equal(c.length, 1, 'the two sources must merge into one physical quake');
  return c[0];
}

test('MergedEvent.tsunamiFlag warns if ANY source warns, else false, else unknown', () => {
  assert.equal(merged(false, true).tsunamiFlag, true); // one source warns -> warn
  assert.equal(merged(true, null).tsunamiFlag, true); // warn beats unknown
  assert.equal(merged(false, null).tsunamiFlag, false); // explicit no + unknown -> false
  assert.equal(merged(null, null).tsunamiFlag, null); // both unknown -> unknown
});
