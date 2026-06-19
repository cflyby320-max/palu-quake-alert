// Offline tests against the REAL captured feeds (fixtures/) plus synthetic
// cases. Run with `npm test` (node --test). No network, no credentials needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseBmkgEntry,
  parseUsgsFeature,
  clusterEvents,
  classify,
  buildMessage,
  buildDigest,
  witaString,
  sequenceOrdinal,
  compass,
  omoriIntegral,
  expectedAftershocks,
  probAtLeastOne,
  bValueMLE,
  probBucket,
  outlookStats,
  buildOutlook,
  Event,
} from '../src/core.js';
import { haversineKm, bearingDeg } from '../src/geo.js';
import { findPriorAlert, recordAlert } from '../src/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (f) => JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', f), 'utf8'));

// Frozen snapshot (the validated M6.7) so this test is deterministic and does
// not break when the live BMKG feed rolls to a newer event.
test('BMKG autogempa parses the M6.7 near Palu correctly', () => {
  const g = fx('scenario_m67_palu.json').Infogempa.gempa;
  const e = parseBmkgEntry(g);
  assert.equal(e.source, 'BMKG');
  assert.equal(e.magnitude, 6.7);
  assert.equal(e.depthKm, 10); // parsed from "10 km"
  assert.equal(e.tsunamiFlag, false); // "Tidak berpotensi tsunami"
  assert.ok(e.lat < 0 && e.lon > 119 && e.lon < 121); // southern hemisphere, Sulawesi
  const dist = haversineKm(e.lat, e.lon, -0.8917, 119.8707);
  assert.ok(dist > 30 && dist < 60, `expected ~43km, got ${dist}`);
});

// Loose smoke test against the live-captured USGS file: it parses cleanly and
// every parsed event is well-formed. We avoid asserting specific magnitudes
// because the live feed drifts between captures.
test('USGS feed parses cleanly into well-formed events', () => {
  const feats = fx('usgs_palu.json').features.map(parseUsgsFeature).filter(Boolean);
  assert.ok(feats.length > 0, 'expected at least one parsed USGS event');
  for (const e of feats) {
    assert.equal(e.source, 'USGS');
    assert.ok(Number.isFinite(e.magnitude) && Number.isFinite(e.lat) && Number.isFinite(e.lon));
  }
});

// The live autogempa feed varies its `Potensi` text (tsunami status vs. a
// "felt, please forward" public message). Parsing must never crash on it.
test('BMKG parser is robust to the felt-message Potensi variant', () => {
  const e = parseBmkgEntry(fx('bmkg_autogempa.json').Infogempa.gempa);
  assert.ok(e, 'live autogempa entry should parse');
  assert.ok([true, false, null].includes(e.tsunamiFlag));
});

test('cross-source merge collapses BMKG + USGS versions of one quake', () => {
  // Two sources, same time, ~9 km apart -> must become ONE merged event.
  const t = new Date('2026-06-16T03:27:44Z');
  const bmkg = new Event({ source: 'BMKG', id: 'b1', time: t, magnitude: 6.7, depthKm: 10, lat: -1.04, lon: 120.23, tsunamiFlag: false });
  const usgs = new Event({ source: 'USGS', id: 'u1', time: new Date(t.getTime() + 1000), magnitude: 6.6, depthKm: 10, lat: -1.1173, lon: 120.199, tsunamiFlag: false });
  const merged = clusterEvents([bmkg, usgs]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources.sort(), ['BMKG', 'USGS']);
  assert.equal(merged[0].confirmed, true);
  assert.equal(merged[0].magnitude, 6.7); // takes the max
});

test('distinct distant events are NOT merged', () => {
  const t = new Date('2026-06-16T03:00:00Z');
  const near = new Event({ source: 'USGS', id: 'a', time: t, magnitude: 5, depthKm: 10, lat: -1.0, lon: 120.2 });
  const far = new Event({ source: 'USGS', id: 'b', time: t, magnitude: 5, depthKm: 10, lat: 5.6, lon: 125.4 });
  assert.equal(clusterEvents([near, far]).length, 2);
});

test('classify: M6.7 shallow near Palu => HIGH with tsunami CAUTION despite "no tsunami" flag', () => {
  const e = new Event({ source: 'BMKG', id: 'x', time: new Date(), magnitude: 6.7, depthKm: 10, lat: -1.04, lon: 120.23, tsunamiFlag: false });
  const [m] = clusterEvents([e]);
  const c = classify(m);
  assert.equal(c.tsunami, 'caution'); // the safety-critical behaviour
  assert.ok(c.level === 'HIGH' || c.level === 'CRITICAL');
  const msg = buildMessage(m);
  assert.match(msg.body, /high ground/i);
  assert.match(msg.body, /tidak berpotensi tsunami/i); // still reports the official status
});

test('classify: M4.2 near Palu => LOW (new below-5.0 heads-up level)', () => {
  const e = new Event({ source: 'BMKG', id: 'x', time: new Date(), magnitude: 4.2, depthKm: 10, lat: -1.0, lon: 120.0, tsunamiFlag: false });
  const [m] = clusterEvents([e]);
  assert.equal(classify(m).level, 'LOW');
  const msg = buildMessage(m);
  assert.match(msg.subject, /🟢/);
  assert.match(msg.body, /heads-up/i);
});

test('classify: official tsunami warning => CRITICAL', () => {
  const e = new Event({ source: 'BMKG', id: 'x', time: new Date(), magnitude: 7.4, depthKm: 10, lat: -1.0, lon: 119.8, tsunamiFlag: true });
  const [m] = clusterEvents([e]);
  assert.equal(classify(m).level, 'CRITICAL');
  assert.match(buildMessage(m).body, /BERPOTENSI TSUNAMI/);
});

test('dedup: same physical event matches a prior alert; far one does not', () => {
  const state = { alerted: [] };
  const e = new Event({ source: 'BMKG', id: 'x', time: new Date('2026-06-16T03:27:44Z'), magnitude: 6.7, depthKm: 10, lat: -1.04, lon: 120.23 });
  const [m] = clusterEvents([e]);
  assert.equal(findPriorAlert(state, m), undefined);
  recordAlert(state, m);
  assert.ok(findPriorAlert(state, m)); // now seen

  const e2 = new Event({ source: 'USGS', id: 'y', time: new Date('2026-06-16T03:27:45Z'), magnitude: 6.6, depthKm: 10, lat: -1.11, lon: 120.2 });
  const [m2] = clusterEvents([e2]);
  assert.ok(findPriorAlert(state, m2), 'USGS version of same quake should match BMKG prior');
});

test('WITA conversion adds 8 hours to UTC', () => {
  assert.match(witaString(new Date('2026-06-16T03:27:44Z')), /2026-06-16 11:27 WITA/);
});

test('bearingDeg + compass give cardinal directions (ID + EN)', () => {
  assert.ok(Math.abs(bearingDeg(0, 0, 10, 0) - 0) < 1, 'due north ~0deg');
  assert.ok(Math.abs(bearingDeg(0, 0, 0, 10) - 90) < 1, 'due east ~90deg');
  assert.deepEqual(compass(0), { id: 'utara', en: 'N' });
  assert.deepEqual(compass(90), { id: 'timur', en: 'E' });
  assert.deepEqual(compass(45), { id: 'timur laut', en: 'NE' });
});

test('buildMessage includes a map link and the compass bearing from Palu', () => {
  // Epicentre north-east of Palu (higher lat = north, higher lon = east).
  const e = new Event({ source: 'BMKG', id: 'ne', time: new Date(), magnitude: 5.0, depthKm: 10, lat: -0.3, lon: 120.5, tsunamiFlag: false });
  const [m] = clusterEvents([e]);
  const msg = buildMessage(m);
  assert.match(msg.body, /timur laut \/ NE/); // bilingual direction on the distance line
  assert.match(msg.body, /google\.com\/maps\?q=-0\.3,120\.5/); // tappable epicentre map link
});

test('sequenceOrdinal counts recent nearby quakes, excluding stale + same-event rows', () => {
  const e = new Event({ source: 'BMKG', id: 'now', time: new Date('2026-06-16T12:00:00Z'), magnitude: 5.0, depthKm: 10, lat: -1.0, lon: 120.2 });
  const [m] = clusterEvents([e]);
  const priors = [
    { timeIso: '2026-06-16T11:00:00Z', lat: -1.0, lon: 120.3 }, // 1h before, distinct -> counts
    { timeIso: '2026-06-16T06:00:00Z', lat: -1.2, lon: 120.0 }, // 6h before, distinct -> counts
    { timeIso: '2026-06-15T10:00:00Z', lat: -1.0, lon: 120.2 }, // >24h before -> excluded
    { timeIso: '2026-06-16T11:59:50Z', lat: -1.0, lon: 120.2 }, // same physical event -> excluded
  ];
  assert.equal(sequenceOrdinal(priors, m, 24), 3); // 2 priors + itself
  assert.equal(sequenceOrdinal([], m, 24), 1); // stands alone
});

test('buildMessage adds the aftershock-sequence line only when there are recent priors', () => {
  const e = new Event({ source: 'BMKG', id: 's', time: new Date('2026-06-16T12:00:00Z'), magnitude: 5.0, depthKm: 10, lat: -1.0, lon: 120.2, tsunamiFlag: false });
  const [m] = clusterEvents([e]);
  assert.doesNotMatch(buildMessage(m, { sequenceN: 1 }).body, /quake near Palu in the last/i);
  const seq = buildMessage(m, { sequenceN: 3 }).body;
  assert.match(seq, /Gempa ke-3 di sekitar Palu/);
  assert.match(seq, /3rd quake near Palu in the last 24h/);
});

test('shakemap image is parsed and attached only at/above the magnitude threshold', () => {
  const big = parseBmkgEntry(fx('scenario_m67_palu.json').Infogempa.gempa); // M6.7, has Shakemap
  assert.match(big.shakemap, /20260616103010\.mmi\.jpg$/);
  const [mBig] = clusterEvents([big]);
  assert.equal(buildMessage(mBig).photo, big.shakemap); // M6.7 >= 5.5 -> attached

  const small = parseBmkgEntry(fx('bmkg_autogempa.json').Infogempa.gempa); // M4.7, has Shakemap
  assert.ok(small.shakemap, 'shakemap URL parsed even for a small quake');
  assert.equal(buildMessage(clusterEvents([small])[0]).photo, null); // below 5.5 -> not attached
});

// --- Seismic Activity Outlook (Tier 3) -------------------------------------

test('omoriIntegral handles both the p==1 and p!=1 branches', () => {
  // p==1: ∫_0^(e-1) (t+1)^-1 dt = ln(e) - ln(1) = 1
  assert.ok(Math.abs(omoriIntegral(0, Math.E - 1, 1, 1) - 1) < 1e-9);
  // p==2,c==1,T==1: ((2)^-1 - (1)^-1)/(-1) = 0.5
  assert.ok(Math.abs(omoriIntegral(0, 1, 2, 1) - 0.5) < 1e-9);
});

test('expectedAftershocks + probAtLeastOne match hand-computed values', () => {
  // a=0,b=1,Mm=M -> 10^0 = 1; times omoriIntegral(0,1,2,1)=0.5
  const n = expectedAftershocks(5, 5, 0, 1, { a: 0, b: 1, p: 2, c: 1 });
  assert.ok(Math.abs(n - 0.5) < 1e-9);
  assert.ok(Math.abs(probAtLeastOne(0.5) - (1 - Math.exp(-0.5))) < 1e-12);
  assert.equal(probAtLeastOne(0), 0);
});

test('aftershock probabilities are monotonic in the expected directions', () => {
  const p = { a: -1.67, b: 1.0, p: 1.07, c: 0.05 };
  assert.ok(expectedAftershocks(7.0, 5.0, 0, 1, p) > expectedAftershocks(6.0, 5.0, 0, 1, p)); // bigger mainshock
  assert.ok(expectedAftershocks(6.5, 4.0, 0, 1, p) > expectedAftershocks(6.5, 6.0, 0, 1, p)); // lower target M
  assert.ok(expectedAftershocks(6.5, 5.0, 0, 7, p) > expectedAftershocks(6.5, 5.0, 0, 1, p)); // longer window
});

test('bValueMLE recovers a known b, and refuses small/insane samples', () => {
  // Construct a sample whose mean gives b=1.0 for mc=3.0, dM=0.1:
  // mean = (mc - dM/2) + log10(e)/b = 2.95 + 0.4342944819 = 3.3842944819
  const mags = [...Array(5).fill(3.0), ...Array(5).fill(3.7685889639)];
  assert.ok(Math.abs(bValueMLE(mags, 3.0, 0.1, 10) - 1.0) < 1e-6);
  assert.equal(bValueMLE([3.0, 3.5], 3.0, 0.1, 10), null); // too few events
  assert.equal(bValueMLE(Array(20).fill(10), 3.0, 0.1, 10), null); // b would be ~0.06 (out of range)
});

test('probBucket gives coarse word buckets + rounded ranges (no false precision)', () => {
  assert.equal(probBucket(0.001).range, '<1%');
  assert.deepEqual(probBucket(0.07), { id: 'RENDAH', en: 'LOW', range: '~5–10%' });
  assert.deepEqual(probBucket(0.15), { id: 'SEDANG', en: 'MODERATE', range: '~10–20%' });
  assert.deepEqual(probBucket(0.99), { id: 'SANGAT TINGGI', en: 'VERY HIGH', range: '>95%' });
});

test('buildOutlook obeys every safety-framing invariant', () => {
  const e = new Event({ source: 'BMKG', id: 'ms', time: new Date('2026-06-16T03:27:44Z'), magnitude: 6.7, depthKm: 10, lat: -1.04, lon: 120.23, tsunamiFlag: false });
  const [m] = clusterEvents([e]);
  const stats = outlookStats(6.7, { a: -1.67, b: 1.0, p: 1.07, c: 0.05 }, { feltMag: 4.0, strongMag: 6.0 });
  const { body } = buildOutlook(m, stats);

  assert.match(body, /BUKAN ramalan/); // probabilistic, not a prediction (ID)
  assert.match(body, /NOT a prediction/i); // (EN)
  assert.match(body, /LEBIH BESAR/); // the larger-quake caveat, stated plainly (ID)
  assert.match(body, /LARGER/); // (EN)
  assert.match(body, /tempat tinggi/); // high-ground rule kept (ID)
  assert.match(body, /high ground/i); // (EN)
  assert.match(body, /menurun seiring waktu/); // decay honesty (ID)
  assert.match(body, /decays with time/i); // (EN)
  assert.match(body, /BMKG/); // defer to authorities
  assert.match(body, /2018/); // model humility
  assert.doesNotMatch(body, /\d+\.\d+%/); // NEVER a false-precision percentage

  // sanity of the headline figures for a M6.7
  assert.ok(stats.felt24 > 0.95, 'felt aftershock should read near-certain');
  assert.ok(stats.larger24 < 0.2, 'a larger quake should read small');
  assert.ok(stats.larger7 > stats.larger24, '7-day larger-quake chance exceeds 24h');
});

test('buildDigest formats a recap with count + safety note', () => {
  const e = new Event({ source: 'USGS', id: 'd1', time: new Date('2026-06-18T05:39:00Z'), magnitude: 4.6, depthKm: 10, lat: -1.1, lon: 120.2, tsunamiFlag: false });
  const [m] = clusterEvents([e]);
  const { subject, body } = buildDigest([m], { hours: 24, minMag: 4.0, radiusKm: 350 });
  assert.match(subject, /1 gempa/);
  assert.match(body, /RINGKASAN/);
  assert.match(body, /M4\.6/);
  assert.match(body, /BMKG/); // the safety footer
});

// Regression: a stray space on the bot token (common when pasting into GitHub
// Secrets) put a space in the Telegram URL path and returned HTTP 404, silently
// breaking the channel digest. config must trim it. The monitor hid the bug
// because it only sends on a real quake; the always-on digest exposed it.
test('config trims surrounding whitespace from the Telegram bot token', async () => {
  const saved = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = '  123456:ABC-def_Ghi  ';
  try {
    const cfg = await import('../src/config.js?trim-regression');
    assert.equal(cfg.channels.telegram.token, '123456:ABC-def_Ghi');
  } finally {
    if (saved === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = saved;
  }
});
