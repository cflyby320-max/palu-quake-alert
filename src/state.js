// Persistent dedup memory. Without this, a restart would re-spam every recent
// quake, and we couldn't track an aftershock sequence or a magnitude revision.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { haversineKm } from './geo.js';
import { SAME_EVENT_SECONDS, SAME_EVENT_KM, STATE_RETENTION_DAYS } from './config.js';

export function loadState(file) {
  if (!existsSync(file)) return { alerted: [] };
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(s.alerted)) s.alerted = [];
    return s;
  } catch {
    // Corrupt state should not silence alerts; start clean but keep running.
    return { alerted: [] };
  }
}

export function saveState(file, state) {
  writeFileSync(file, JSON.stringify(state, null, 2));
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
  return state;
}
