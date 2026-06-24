// Fetching from BMKG (primary, local, fast) and USGS (cross-check / fallback).
// Uses the built-in global fetch (Node 18+) with timeout + retry. No deps.

import {
  HTTP_TIMEOUT_MS,
  HTTP_RETRIES,
  PALU,
  ALERT_RADIUS_KM,
  PRIMARY_HEARTBEAT_URL,
  HEALTHCHECKS_API_KEY,
} from './config.js';
import { parseBmkgEntry, parseUsgsFeature } from './core.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= HTTP_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { 'User-Agent': 'palu-quake-alert/1.0 (family safety prototype)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < HTTP_RETRIES) await sleep(500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`fetch failed after ${HTTP_RETRIES} tries: ${url} (${lastErr})`);
}

// --- Primary-heartbeat read (for the heartbeat-gated backup) ----------------
// Reads the always-on host's healthchecks.io check to learn when it last pinged.
// Returns the last-ping time as a Date, or null on ANY problem (missing config,
// bad URL, network/API error, unparseable). The caller treats null as
// "liveness unknown" and FAILS OPEN — it sends rather than risk a missed alert.
//
// We don't reuse fetchJson() here: this call needs an X-Api-Key header and must
// stay silent (return null) on failure rather than throw after N retries.
export async function fetchPrimaryLastPing() {
  if (!PRIMARY_HEARTBEAT_URL || !HEALTHCHECKS_API_KEY) return null;
  let uuid;
  try {
    // The check UUID is the last path segment of the ping URL
    // (e.g. https://hc-ping.com/<uuid>). The read API lives on healthchecks.io.
    uuid = new URL(PRIMARY_HEARTBEAT_URL).pathname.split('/').filter(Boolean).pop();
  } catch {
    return null;
  }
  if (!uuid) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://healthchecks.io/api/v3/checks/${uuid}`, {
      signal: ac.signal,
      headers: {
        'X-Api-Key': HEALTHCHECKS_API_KEY,
        'User-Agent': 'palu-quake-alert/1.0 (family safety prototype)',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.last_ping) return null;
    const d = new Date(data.last_ping);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const BMKG_AUTO = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';
const BMKG_RECENT = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json';

// BMKG is national (no server-side geo filter) and autogempa returns only the
// single latest event, so we combine it with the recent-15 list and dedup.
export async function fetchBmkg() {
  const [auto, recent] = await Promise.all([fetchJson(BMKG_AUTO), fetchJson(BMKG_RECENT)]);
  const raw = [];
  const a = auto?.Infogempa?.gempa;
  if (a) raw.push(a);
  const r = recent?.Infogempa?.gempa;
  if (Array.isArray(r)) raw.push(...r);

  const byId = new Map();
  for (const g of raw) {
    const e = parseBmkgEntry(g);
    if (e) byId.set(e.id, e);
  }
  return [...byId.values()];
}

// USGS supports server-side radius filtering, so we ask only for events near
// Palu. Low magnitude floor here; the alert threshold is applied later.
export async function fetchUsgs() {
  const params = new URLSearchParams({
    format: 'geojson',
    latitude: String(PALU.lat),
    longitude: String(PALU.lon),
    maxradiuskm: String(ALERT_RADIUS_KM),
    minmagnitude: '2.5',
    orderby: 'time',
    limit: '50',
  });
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`;
  const data = await fetchJson(url);
  const features = data?.features || [];
  return features.map(parseUsgsFeature).filter(Boolean);
}

// Like fetchUsgs but for an explicit time window + magnitude floor — used by the
// digest/recap. Higher limit since a window can contain many events.
export async function fetchUsgsSince(startIso, minMag) {
  const params = new URLSearchParams({
    format: 'geojson',
    latitude: String(PALU.lat),
    longitude: String(PALU.lon),
    maxradiuskm: String(ALERT_RADIUS_KM),
    minmagnitude: String(minMag),
    starttime: startIso,
    orderby: 'time',
    limit: '200',
  });
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`;
  const data = await fetchJson(url);
  return (data?.features || []).map(parseUsgsFeature).filter(Boolean);
}
