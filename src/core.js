// Normalisation, cross-source merging, classification, and message building.
// This module is pure (no network, no I/O) so it is fully unit-testable.

import { haversineKm, bearingDeg } from './geo.js';
import {
  PALU,
  MIN_MAGNITUDE,
  STRONG_MAGNITUDE,
  TSUNAMI_MAG,
  SHALLOW_KM,
  SAME_EVENT_SECONDS,
  SAME_EVENT_KM,
  WITA_OFFSET_HOURS,
  SHAKEMAP_MIN_MAG,
  SEQUENCE_WINDOW_HOURS,
} from './config.js';

// A single earthquake observation from one source, normalised.
export class Event {
  constructor(o) {
    this.source = o.source; // 'BMKG' | 'USGS'
    this.id = o.id; // stable per-source identifier
    this.time = o.time; // Date (UTC)
    this.magnitude = o.magnitude; // number
    this.depthKm = o.depthKm; // number
    this.lat = o.lat;
    this.lon = o.lon;
    this.place = o.place || '';
    this.tsunamiFlag = o.tsunamiFlag; // true | false | null(unknown)
    this.felt = o.felt || null;
    this.url = o.url || '';
    this.shakemap = o.shakemap || null; // direct BMKG shakemap image URL, if any
  }
}

// --- Parsing helpers --------------------------------------------------------

// BMKG reports tsunami status as free Indonesian text. We map it, but the
// caller must NEVER treat `false` as a safety guarantee (see classify()).
function parsePotensi(p) {
  if (!p) return null;
  const s = String(p).toLowerCase();
  if (s.includes('tidak berpotensi')) return false;
  if (s.includes('berpotensi') || s.includes('waspada') || s.includes('siaga') || s.includes('awas'))
    return true;
  return null;
}

// BMKG fields are all strings, e.g. Magnitude "6.7", Kedalaman "10 km",
// Coordinates "-1.04,120.23", DateTime ISO8601, Dirasakan "-" when not felt.
export function parseBmkgEntry(g) {
  const [latStr, lonStr] = String(g.Coordinates || '').split(',');
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const magnitude = parseFloat(g.Magnitude);
  const depthKm = parseFloat(g.Kedalaman); // parseFloat("10 km") === 10
  const time = new Date(g.DateTime);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(magnitude) || isNaN(time)) {
    return null; // defensive: skip malformed entries rather than crash
  }
  const felt = g.Dirasakan && g.Dirasakan.trim() && g.Dirasakan.trim() !== '-' ? g.Dirasakan.trim() : null;
  const shakemap = g.Shakemap ? `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}` : null;
  return new Event({
    source: 'BMKG',
    id: `BMKG:${g.DateTime}:${g.Coordinates}`,
    time,
    magnitude,
    depthKm: Number.isFinite(depthKm) ? depthKm : NaN,
    lat,
    lon,
    place: g.Wilayah || '',
    tsunamiFlag: parsePotensi(g.Potensi),
    felt,
    shakemap,
    url: shakemap || 'https://inatews.bmkg.go.id/',
  });
}

// USGS GeoJSON: geometry.coordinates is [lon, lat, depthKm]; time is epoch ms.
export function parseUsgsFeature(f) {
  const p = f.properties || {};
  const c = (f.geometry && f.geometry.coordinates) || [];
  const lon = c[0];
  const lat = c[1];
  const depthKm = c[2];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(p.mag)) return null;
  return new Event({
    source: 'USGS',
    id: `USGS:${f.id}`,
    time: new Date(p.time),
    magnitude: p.mag,
    depthKm,
    lat,
    lon,
    place: p.place || '',
    // USGS `tsunami` is a response flag, not a forecast. 0 is NOT a safety
    // guarantee, so we keep false only as weak info and lean on classify().
    tsunamiFlag: p.tsunami === 1 ? true : p.tsunami === 0 ? false : null,
    felt: p.felt ? `${p.felt} felt-reports` : null,
    url: p.url || '',
  });
}

// --- Merging ----------------------------------------------------------------
// The same physical quake shows up in both feeds with different ids, slightly
// different epicentres, and possibly different magnitudes. We cluster those so
// the family gets ONE alert, and we can say "confirmed by BMKG + USGS".

export class MergedEvent {
  constructor(events) {
    this.events = events;
  }
  get sources() {
    return [...new Set(this.events.map((e) => e.source))];
  }
  get confirmed() {
    return this.sources.length > 1;
  }
  get magnitude() {
    return Math.max(...this.events.map((e) => e.magnitude));
  }
  // BMKG is the authoritative local agency for Indonesia, so prefer its
  // epicentre/depth/place; fall back to whatever we have.
  get primary() {
    return this.events.find((e) => e.source === 'BMKG') || this.events[0];
  }
  get time() {
    return new Date(Math.min(...this.events.map((e) => e.time.getTime())));
  }
  get lat() {
    return this.primary.lat;
  }
  get lon() {
    return this.primary.lon;
  }
  get depthKm() {
    return this.primary.depthKm;
  }
  get place() {
    return this.primary.place;
  }
  get url() {
    return this.primary.url;
  }
  // Only BMKG publishes shakemaps, so the first non-null wins regardless of order.
  get shakemap() {
    return this.events.map((e) => e.shakemap).find(Boolean) || null;
  }
  get felt() {
    return this.events.map((e) => e.felt).find(Boolean) || null;
  }
  // Conservative tsunami flag: warn if ANY source warns; only "false" if a
  // source explicitly says no and none warn; otherwise unknown.
  get tsunamiFlag() {
    const flags = this.events.map((e) => e.tsunamiFlag);
    if (flags.some((f) => f === true)) return true;
    if (flags.some((f) => f === false)) return false;
    return null;
  }
  distanceToPalu() {
    return haversineKm(this.lat, this.lon, PALU.lat, PALU.lon);
  }
  // Direction the epicentre lies FROM Palu (so "NE of Palu" reads correctly).
  bearingFromPalu() {
    return bearingDeg(PALU.lat, PALU.lon, this.lat, this.lon);
  }
}

// --- Direction, map link & aftershock context (pure presentation helpers) ---

// 8-point compass label for a bearing: Indonesian name + English abbreviation.
const COMPASS = [
  { id: 'utara', en: 'N' },
  { id: 'timur laut', en: 'NE' },
  { id: 'timur', en: 'E' },
  { id: 'tenggara', en: 'SE' },
  { id: 'selatan', en: 'S' },
  { id: 'barat daya', en: 'SW' },
  { id: 'barat', en: 'W' },
  { id: 'barat laut', en: 'NW' },
];
export function compass(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// A universally-tappable map link to the epicentre (opens the Maps app on phones).
export function mapLink(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

// 1-based ordinal of event m among recent quakes near Palu, computed from the
// persisted dedup records (plain {timeIso,lat,lon} rows, so this stays pure).
// Counts distinct OTHER physical events in the preceding window — the same
// time+distance window used for merging excludes m itself, so an escalation
// re-alert of m is not miscounted — then +1 for m. Returns 1 if it stands alone.
export function sequenceOrdinal(priorAlerts, m, hours = SEQUENCE_WINDOW_HOURS) {
  const tEnd = m.time.getTime();
  const tStart = tEnd - hours * 3600 * 1000;
  let prior = 0;
  for (const a of priorAlerts || []) {
    const at = new Date(a.timeIso).getTime();
    if (!(at >= tStart && at <= tEnd)) continue;
    const sameEvent =
      Math.abs(at - tEnd) <= SAME_EVENT_SECONDS * 1000 &&
      haversineKm(a.lat, a.lon, m.lat, m.lon) <= SAME_EVENT_KM;
    if (!sameEvent) prior++;
  }
  return prior + 1;
}

function ordinalEn(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function clusterEvents(events) {
  const clusters = [];
  const sorted = events.slice().sort((a, b) => a.time - b.time);
  for (const e of sorted) {
    let placed = false;
    for (const cl of clusters) {
      const r = cl[0];
      if (
        Math.abs(e.time - r.time) <= SAME_EVENT_SECONDS * 1000 &&
        haversineKm(e.lat, e.lon, r.lat, r.lon) <= SAME_EVENT_KM
      ) {
        cl.push(e);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([e]);
  }
  return clusters.map((c) => new MergedEvent(c));
}

// --- Classification ---------------------------------------------------------

export function classify(m) {
  const dist = m.distanceToPalu();
  const mag = m.magnitude;
  const shallow = Number.isFinite(m.depthKm) ? m.depthKm <= SHALLOW_KM : true;
  const strong = mag >= STRONG_MAGNITUDE && dist <= 200;

  // Tsunami logic. The 2018 Palu tsunami was landslide-generated and NOT
  // predicted by standard models; BMKG also lifted its warning early. So we
  // never let "no tsunami potential" read as "safe". A large shallow quake
  // gets a precautionary high-ground caution regardless of the official flag.
  let tsunami = 'none';
  if (m.tsunamiFlag === true) tsunami = 'warning';
  else if (mag >= TSUNAMI_MAG && shallow) tsunami = 'caution';

  let level;
  if (mag >= 7 || tsunami === 'warning') level = 'CRITICAL';
  else if (strong || tsunami === 'caution') level = 'HIGH';
  else if (mag >= MIN_MAGNITUDE) level = 'MODERATE';
  else level = 'LOW'; // below MIN_MAGNITUDE: minor/heads-up tier

  return { dist, shallow, strong, tsunami, level };
}

// --- Message building -------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

export function witaString(date) {
  const d = new Date(date.getTime() + WITA_OFFSET_HOURS * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())} WITA`;
}

const ICON = { CRITICAL: '🔴', HIGH: '🟠', MODERATE: '🟡', LOW: '🟢' };

// Returns { subject, body, photo }. Body is bilingual (Bahasa Indonesia +
// English) because recipients may include relatives who don't read English.
// `photo` (a BMKG shakemap image URL, or null) is set for stronger quakes so a
// channel that supports images can attach it. Pass `sequenceN` (from
// sequenceOrdinal) to add the "Nth quake near Palu in 24h" aftershock context.
export function buildMessage(m, { sequenceN } = {}) {
  const c = classify(m);
  const wita = witaString(m.time);
  const dist = Math.round(c.dist);
  const dir = compass(m.bearingFromPalu());
  const conf = m.confirmed
    ? `Dikonfirmasi ${m.sources.join(' + ')}`
    : `Sumber: ${m.sources[0]} (data awal / preliminary)`;

  const official =
    m.tsunamiFlag === true
      ? '⚠️ BERPOTENSI TSUNAMI (peringatan resmi)'
      : m.tsunamiFlag === false
      ? 'Status resmi: tidak berpotensi tsunami'
      : 'Status tsunami: belum dipastikan';

  // Safety instruction scales with tsunami level.
  let action;
  if (c.tsunami === 'warning') {
    action =
      'SEGERA menjauh dari pantai & sungai, naik ke tempat tinggi SEKARANG. ' +
      '/ Move AWAY from coast & rivers to high ground NOW.';
  } else if (c.tsunami === 'caution') {
    action =
      'Gempa besar & dangkal. Jika di dekat pantai dan guncangan terasa kuat, ' +
      'JANGAN menunggu konfirmasi — naik ke tempat tinggi. ' +
      '/ Large shallow quake. If near the coast and shaking felt strong, do NOT wait — move to high ground.';
  } else if (c.level === 'HIGH' || c.level === 'CRITICAL') {
    action =
      'Berlindung (merunduk, lindungi kepala), jauhi bangunan/jendela, siap untuk gempa susulan. ' +
      '/ Take cover, stay clear of buildings/windows, expect aftershocks.';
  } else if (c.level === 'LOW') {
    action =
      'Gempa kecil — dampak minim, ini hanya info. Tetap waspada. ' +
      '/ Minor quake — little expected impact, just a heads-up. Stay aware.';
  } else {
    action =
      'Tetap tenang dan waspada gempa susulan. / Stay calm and watch for aftershocks.';
  }

  const subject = `${ICON[c.level] || ''} M${m.magnitude.toFixed(1)} ${dist} km dari Palu — ${c.level}`;

  // Attach the BMKG shakemap for stronger quakes (channels that can't show an
  // image just ignore this and keep the text alert).
  const photo = m.magnitude >= SHAKEMAP_MIN_MAG && m.shakemap ? m.shakemap : null;

  // Aftershock context only once there's actually been a prior quake recently —
  // an isolated event shows no "1st quake" noise.
  const aftershock =
    sequenceN && sequenceN >= 2
      ? `📊 Gempa ke-${sequenceN} di sekitar Palu dalam ${SEQUENCE_WINDOW_HOURS} jam terakhir. ` +
        `/ ${ordinalEn(sequenceN)} quake near Palu in the last ${SEQUENCE_WINDOW_HOURS}h.`
      : null;

  const lines = [
    subject,
    '',
    `Magnitudo / Magnitude: M${m.magnitude.toFixed(1)}`,
    `Lokasi / Location: ${m.place}`,
    `Jarak ke Palu / Distance to Palu: ~${dist} km ${dir.id} / ${dir.en}`,
    `Kedalaman / Depth: ${Number.isFinite(m.depthKm) ? m.depthKm + ' km' : 'n/a'}`,
    `Waktu / Time: ${wita}`,
    official,
    m.felt ? `Dirasakan / Felt: ${m.felt}` : null,
    aftershock,
    '',
    `➡️ ${action}`,
    '',
    `🗺️ Peta / Map: ${mapLink(m.lat, m.lon)}`,
    conf,
    // Skip the details link when it's the very image we're attaching as a photo.
    m.url && m.url !== photo ? `Detail: ${m.url}` : null,
  ].filter((x) => x !== null);

  return { subject, body: lines.join('\n'), photo };
}

// Catch-up recap of recent quakes near Palu, for posting to the channel.
export function buildDigest(list, { hours, minMag, radiusKm }) {
  const lines = list.map((m) => {
    const c = classify(m);
    const t = witaString(m.time).slice(5); // "MM-DD HH:MM WITA"
    const dist = Math.round(c.dist);
    const tsu = m.tsunamiFlag === true ? ' · 🌊 POTENSI TSUNAMI' : '';
    const felt = m.felt ? ' · dirasakan' : '';
    return `${ICON[c.level] || '•'} M${m.magnitude.toFixed(1)} · ${t} · ~${dist} km dari Palu${tsu}${felt}`;
  });
  const subject = `📋 Ringkasan ${hours} jam — ${list.length} gempa dekat Palu`;
  const body = [
    '📋 RINGKASAN GEMPA / QUAKE RECAP',
    `Sekitar Palu · ${hours} jam terakhir · ≥ M${minMag.toFixed(1)}, ≤ ${radiusKm} km`,
    '',
    ...(list.length ? lines : ['(Tidak ada gempa yang memenuhi kriteria. / No qualifying quakes.)']),
    '',
    `Total: ${list.length} kejadian / events.`,
    'ℹ️ Rekap susulan (mungkin terlambat), BUKAN peringatan real-time. Selalu utamakan BMKG, sirene & petugas.',
    'A delayed recap, not a real-time alert — always follow BMKG & authorities.',
  ].join('\n');
  return { subject, body };
}
