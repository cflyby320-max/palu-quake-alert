// Priority-3 tests: channel-activation detection, source fetching (dedup +
// retry) with a stubbed fetch, parser robustness on junk input, and the
// probability/b-value boundary values. Fully offline; run with `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseBmkgEntry, parseUsgsFeature, probBucket, bValueMLE } from '../src/core.js';
import { fetchBmkg, fetchUsgs } from '../src/sources.js';

// --- Item 10: activeChannelNames reflects which credentials are present ------
// config.js reads env at import time, so re-import a fresh copy per case.

const CHANNEL_ENV = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_IDS',
  'TWILIO_SID', 'TWILIO_TOKEN', 'TWILIO_FROM', 'TWILIO_TO',
  'TWILIO_WHATSAPP_FROM', 'TWILIO_WHATSAPP_TO',
];

async function channelsFor(overrides) {
  const saved = {};
  for (const k of CHANNEL_ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  try {
    const cfg = await import(`../src/config.js?ch-${Math.random()}`);
    return cfg.activeChannelNames();
  } finally {
    for (const k of CHANNEL_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('activeChannelNames: a channel counts only when its credentials are present', async () => {
  assert.deepEqual(await channelsFor({}), []); // nothing configured -> log-only
  assert.deepEqual(await channelsFor({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_IDS: '123' }), ['telegram']);
  assert.deepEqual(await channelsFor({ TWILIO_SID: 's', TWILIO_FROM: '+1', TWILIO_TO: '+2' }), ['twilio-sms']);
  assert.deepEqual(
    await channelsFor({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_IDS: '1', TWILIO_SID: 's', TWILIO_FROM: '+1', TWILIO_TO: '+2' }),
    ['telegram', 'twilio-sms']
  );
  // Telegram token without any chat id is NOT active (can't send anywhere).
  assert.deepEqual(await channelsFor({ TELEGRAM_BOT_TOKEN: 't' }), []);
});

// --- Item 11: source fetching — BMKG dedup + retry on a transient failure ----

test('fetchBmkg combines autogempa + recent and dedups the shared event', async () => {
  const saved = global.fetch;
  const auto = { Infogempa: { gempa: { DateTime: '2026-06-16T03:00:00Z', Coordinates: '-1.0,120.0', Magnitude: '6.0', Kedalaman: '10 km', Wilayah: 'X', Potensi: 'Tidak berpotensi tsunami', Dirasakan: '-' } } };
  const recent = { Infogempa: { gempa: [
    { DateTime: '2026-06-16T03:00:00Z', Coordinates: '-1.0,120.0', Magnitude: '6.0', Kedalaman: '10 km' }, // same id as auto -> dedup
    { DateTime: '2026-06-16T02:00:00Z', Coordinates: '-1.5,120.5', Magnitude: '4.5', Kedalaman: '5 km' }, // distinct
  ] } };
  try {
    global.fetch = async (url) => ({
      ok: true, status: 200,
      json: async () => (String(url).includes('autogempa') ? auto : recent),
      text: async () => '',
    });
    const events = await fetchBmkg();
    assert.equal(events.length, 2, 'duplicate of the autogempa event is collapsed');
  } finally {
    global.fetch = saved;
  }
});

test('fetchJson retries after a transient failure (via fetchUsgs)', async () => {
  const saved = global.fetch;
  let n = 0;
  try {
    global.fetch = async () => {
      n++;
      if (n === 1) throw new Error('network blip');
      return { ok: true, status: 200, json: async () => ({ features: [] }), text: async () => '' };
    };
    assert.deepEqual(await fetchUsgs(), []);
    assert.equal(n, 2, 'retried once after the first attempt failed');
  } finally {
    global.fetch = saved;
  }
});

// --- Item 12: parsers skip junk (return null) instead of crashing -----------

test('parseBmkgEntry returns null on malformed input, parses a valid entry', () => {
  assert.equal(parseBmkgEntry({ Coordinates: 'garbage', Magnitude: 'abc', Kedalaman: '10 km', DateTime: '2026-01-01T00:00:00Z' }), null);
  assert.equal(parseBmkgEntry({}), null);
  assert.ok(parseBmkgEntry({ Coordinates: '-1.0,120.0', Magnitude: '5.0', Kedalaman: '10 km', DateTime: '2026-01-01T00:00:00Z' }));
});

test('parseUsgsFeature returns null on bad geometry/mag and maps the tsunami flag', () => {
  assert.equal(parseUsgsFeature({ properties: { mag: null }, geometry: { coordinates: [] } }), null);
  assert.equal(parseUsgsFeature({ properties: { mag: 5 }, geometry: { coordinates: ['x', 'y', 10] } }), null);
  const mk = (tsunami) => parseUsgsFeature({ id: 'a', properties: { mag: 6, time: Date.now(), tsunami }, geometry: { coordinates: [120, -1, 10] } });
  assert.equal(mk(1).tsunamiFlag, true);
  assert.equal(mk(0).tsunamiFlag, false);
  assert.equal(mk(undefined).tsunamiFlag, null); // missing -> unknown, never assumed safe
});

// --- Item 13: probability + b-value boundary behaviour ----------------------

test('probBucket lands in the right bucket exactly on the threshold values', () => {
  assert.equal(probBucket(0.1).id, 'SEDANG');
  assert.match(probBucket(0.1).range, /10.*20%/);
  assert.equal(probBucket(0.33).id, 'TINGGI');
  assert.equal(probBucket(0.67).id, 'SANGAT TINGGI');
  assert.match(probBucket(0.01).range, /1.*5%/);
});

test('bValueMLE accepts b inside [0.5, 1.5] and rejects values outside it', () => {
  // Constant-magnitude samples whose mean yields a chosen b (mc=3.0, dM=0.1).
  assert.ok(Math.abs(bValueMLE(Array(60).fill(3.8185889638065036), 3.0, 0.1, 50) - 0.5) < 1e-6); // low edge
  assert.ok(Math.abs(bValueMLE(Array(60).fill(3.249513), 3.0, 0.1, 50) - 1.45) < 1e-3); // near high edge
  assert.equal(bValueMLE(Array(60).fill(3.915099), 3.0, 0.1, 50), null); // b ~0.45 -> rejected
  assert.equal(bValueMLE(Array(60).fill(3.221434), 3.0, 0.1, 50), null); // b ~1.6 -> rejected
});
