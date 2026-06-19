// Fetching from BMKG (primary, local, fast) and USGS (cross-check / fallback).
// Uses the built-in global fetch (Node 18+) with timeout + retry. No deps.

import { HTTP_TIMEOUT_MS, HTTP_RETRIES, PALU, ALERT_RADIUS_KM } from './config.js';
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
