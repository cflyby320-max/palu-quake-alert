// Priority-2 tests: the escalation re-alert copy, state retention pruning and
// the one-Outlook-per-mainshock rule, the catalog update/merge path, and the
// twice-daily digest slot timing. Fully offline; run with `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escalateMessage, clusterEvents, Event } from '../src/core.js';
import {
  pruneState,
  pruneCatalog,
  findPriorOutlook,
  recordOutlook,
  appendCatalog,
} from '../src/state.js';
import { lastDigestSlot } from '../src/monitor.js';

const DAY = 24 * 3600 * 1000;
const evt = (over) =>
  new Event({ source: 'BMKG', id: 'x', time: new Date(), magnitude: 6, depthKm: 10, lat: -1.0, lon: 120.0, ...over });

// --- Item 6: escalation re-alert when a magnitude is revised up -------------

test('escalateMessage banners the update and preserves the original body + photo', () => {
  const base = { subject: 'M5.8 10 km dari Palu — SEDANG', body: 'Magnitudo: M5.8\nLokasi: X', photo: 'http://img/x.jpg' };
  const esc = escalateMessage(base, 5.0, 5.8);
  assert.match(esc.subject, /^⏫ DIPERBARUI \/ UPDATED: /);
  assert.match(esc.body, /Magnitudo diperbarui M5\.0 → M5\.8/);
  assert.match(esc.body, /Magnitude revised up/);
  assert.ok(esc.body.endsWith(base.body), 'the original alert body is kept below the banner');
  assert.equal(esc.photo, 'http://img/x.jpg', 'the shakemap photo is carried through');
  // The input must not be mutated (runOnce reuses the built message).
  assert.equal(base.subject, 'M5.8 10 km dari Palu — SEDANG');
});

// --- Item 7: retention pruning + one Outlook per physical mainshock ----------

test('pruneState drops alerted/outlook rows older than the retention window', () => {
  const now = Date.now();
  const state = {
    alerted: [
      { timeIso: new Date(now - 1 * DAY).toISOString(), lat: 0, lon: 0, mag: 5 }, // keep
      { timeIso: new Date(now - 20 * DAY).toISOString(), lat: 0, lon: 0, mag: 5 }, // drop (> 14d)
    ],
    outlooks: [
      { timeIso: new Date(now - 2 * DAY).toISOString() }, // keep
      { timeIso: new Date(now - 30 * DAY).toISOString() }, // drop
    ],
  };
  pruneState(state);
  assert.equal(state.alerted.length, 1);
  assert.equal(state.outlooks.length, 1);
});

test('pruneCatalog keeps the longer catalog window but still drops very old rows', () => {
  const now = Date.now();
  const state = {
    catalog: [
      { timeIso: new Date(now - 10 * DAY).toISOString(), mag: 4 }, // keep (< 60d)
      { timeIso: new Date(now - 70 * DAY).toISOString(), mag: 4 }, // drop (> 60d)
    ],
  };
  pruneCatalog(state);
  assert.equal(state.catalog.length, 1);
});

test('findPriorOutlook recognises the same quake (incl. its other-source version)', () => {
  const state = { outlooks: [] };
  const [m] = clusterEvents([evt({ time: new Date('2026-06-16T03:00:00Z'), magnitude: 6.0 })]);
  assert.equal(findPriorOutlook(state, m), undefined);
  recordOutlook(state, m);
  assert.ok(findPriorOutlook(state, m), 'same mainshock is now deduped');

  // The USGS version (seconds later, a few km off) must match the BMKG prior.
  const [m2] = clusterEvents([
    new Event({ source: 'USGS', id: 'u', time: new Date('2026-06-16T03:00:30Z'), magnitude: 5.9, depthKm: 10, lat: -1.05, lon: 120.02 }),
  ]);
  assert.ok(findPriorOutlook(state, m2), 'one Outlook per physical mainshock');
});

// --- Item 8: the catalog update/merge path ----------------------------------

test('appendCatalog merges a re-observed quake: revised-up mag, tsunami, felt, place', () => {
  const state = { catalog: [] };
  const t = new Date('2026-06-18T05:00:00Z');
  appendCatalog(state, clusterEvents([
    new Event({ source: 'USGS', id: 'c1', time: t, magnitude: 5.0, depthKm: 10, lat: -1.0, lon: 120.2, tsunamiFlag: false }),
  ])[0], 3.5);
  assert.equal(state.catalog.length, 1);
  assert.equal(state.catalog[0].mag, 5.0);

  // Same physical quake re-observed by BMKG with more/updated info.
  appendCatalog(state, clusterEvents([
    new Event({ source: 'BMKG', id: 'c2', time: new Date(t.getTime() + 20000), magnitude: 5.6, depthKm: 10, lat: -1.02, lon: 120.21, tsunamiFlag: true, felt: 'III Palu', place: 'Dekat Palu' }),
  ])[0], 3.5);
  assert.equal(state.catalog.length, 1, 'still one physical quake');
  assert.equal(state.catalog[0].mag, 5.6, 'magnitude revised up');
  assert.equal(state.catalog[0].tsunamiFlag, true, 'tsunami flag escalated');
  assert.equal(state.catalog[0].felt, 'III Palu', 'felt backfilled');
  assert.equal(state.catalog[0].place, 'Dekat Palu', 'place backfilled');

  // Below the catalog floor is ignored.
  appendCatalog(state, clusterEvents([
    new Event({ source: 'USGS', id: 's', time: new Date('2026-06-18T06:00:00Z'), magnitude: 3.0, depthKm: 10, lat: -1.0, lon: 120.2 }),
  ])[0], 3.5);
  assert.equal(state.catalog.length, 1, 'sub-floor event not added');
});

// --- Item 9: twice-daily digest slot timing (08:00 & 20:00 WITA) ------------

test('lastDigestSlot maps a time to the most recent 00:00/12:00 UTC slot', () => {
  const slot = (iso) => lastDigestSlot(new Date(iso).getTime()).toISOString();
  assert.equal(slot('2026-06-16T00:00:00Z'), '2026-06-16T00:00:00.000Z'); // 08:00 WITA
  assert.equal(slot('2026-06-16T05:00:00Z'), '2026-06-16T00:00:00.000Z');
  assert.equal(slot('2026-06-16T11:59:00Z'), '2026-06-16T00:00:00.000Z'); // still the morning slot
  assert.equal(slot('2026-06-16T12:00:00Z'), '2026-06-16T12:00:00.000Z'); // 20:00 WITA
  assert.equal(slot('2026-06-16T23:30:00Z'), '2026-06-16T12:00:00.000Z');
});
