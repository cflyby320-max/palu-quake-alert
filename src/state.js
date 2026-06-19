// Persistent dedup memory. Without this, a restart would re-spam every recent
// quake, and we couldn't track an aftershock sequence or a magnitude revision.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { haversineKm } from './geo.js';
import {
  SAME_EVENT_SECONDS,
  SAME_EVENT_KM,
  STATE_RETENTION_DAYS,
  CATALOG_RETENTION_DAYS,
} from './config.js';

function emptyState() {
  return { alerted: [], catalog: [], outlooks: [] };
}

export function loadState(file) {
  if (!existsSync(file)) return emptyState();
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(s.alerted)) s.alerted = [];
    if (!Array.isArray(s.catalog)) s.catalog = []; // local catalog for the Outlook
    if (!Array.isArray(s.outlooks)) s.outlooks = []; // Outlook dedup memory
    return s;
  } catch {
    // Corrupt state should not silence alerts; start clean but keep running.
    return emptyState();
  }
}

// Same time+distance window used everywhere to treat two rows as one quake.
function sameQuake(a, m) {
  return (
    Math.abs(new Date(a.timeIso).getTime() - m.time.getTime()) <= SAME_EVENT_SECONDS * 1000 &&
    haversineKm(a.lat, a.lon, m.lat, m.lon) <= SAME_EVENT_KM
  );
}

export function saveState(file, state) {
  // Guard against transient file locks (e.g. cloud-sync) so a failed save
  // never crashes the cycle. Dedup is best-effort if a write is skipped.
  try {
    writeFileSync(file, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error(`${new Date().toISOString()} [WARN] state save skipped: ${e.code || e}`);
  }
}

// Match a merged event against an already-alerted physical event using the
// same time+distance window we use to merge sources. This is what makes dedup
// robust even when a quake gains a second source between polls.
export function findPriorAlert(state, m) {
  return state.alerted.find(
    (a) =>
      Math.abs(new Date(a.timeIso).getTime() - m.time.getTime()) <= SAME_EVENT_SECONDS * 1000 &&
      haversineKm(a.lat, a.lon, m.lat, m.lon) <= SAME_EVENT_KM
  );
}

export function recordAlert(state, m) {
  state.alerted.push({
    timeIso: m.time.toISOString(),
    lat: m.lat,
    lon: m.lon,
    mag: m.magnitude,
    sources: m.sources,
    firstAlertedIso: new Date().toISOString(),
  });
}

export function pruneState(state) {
  const cutoff = Date.now() - STATE_RETENTION_DAYS * 24 * 3600 * 1000;
  state.alerted = state.alerted.filter((a) => new Date(a.timeIso).getTime() >= cutoff);
  if (Array.isArray(state.outlooks))
    state.outlooks = state.outlooks.filter((o) => new Date(o.timeIso).getTime() >= cutoff);
  return state;
}

// --- Local catalog (feeds the Seismic Activity Outlook) ---------------------
// Accumulates ALL near-Palu events at/above CATALOG_MIN_MAG (incl. ones below
// the alert floor) so the aftershock model has sequence structure to work with.

export function appendCatalog(state, m, minMag) {
  if (!Array.isArray(state.catalog)) state.catalog = [];
  if (m.magnitude < minMag) return;
  const existing = state.catalog.find((a) => sameQuake(a, m));
  if (existing) {
    if (m.magnitude > existing.mag) existing.mag = m.magnitude; // keep a revised-up magnitude
    return;
  }
  state.catalog.push({
    timeIso: m.time.toISOString(),
    lat: m.lat,
    lon: m.lon,
    mag: m.magnitude,
    depthKm: m.depthKm,
    sources: m.sources,
  });
}

export function pruneCatalog(state) {
  if (!Array.isArray(state.catalog)) {
    state.catalog = [];
    return state;
  }
  const cutoff = Date.now() - CATALOG_RETENTION_DAYS * 24 * 3600 * 1000;
  state.catalog = state.catalog.filter((a) => new Date(a.timeIso).getTime() >= cutoff);
  return state;
}

// --- Outlook dedup: at most one Outlook per physical mainshock --------------

export function findPriorOutlook(state, m) {
  return (state.outlooks || []).find((o) => sameQuake(o, m));
}

export function recordOutlook(state, m) {
  if (!Array.isArray(state.outlooks)) state.outlooks = [];
  state.outlooks.push({
    timeIso: m.time.toISOString(),
    lat: m.lat,
    lon: m.lon,
    mag: m.magnitude,
    postedIso: new Date().toISOString(),
  });
}
