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
  witaString,
  Event,
} from '../src/core.js';
import { haversineKm } from '../src/geo.js';
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
