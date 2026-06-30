// Branded Instagram card for Palu Earthquake Alerts.
// PURE string builder (no network, no I/O): a MergedEvent -> an SVG string.
// render.js rasterises it. Layout mirrors studio/preview.html, scaled to
// 1080x1350 (4:5, Instagram feed). The severity chip colours and the caution
// band copy follow classify()/buildMessage() in src/core.js, so the card can
// never disagree with the text alerts. Bahasa Indonesia + WITA only.

import { classify } from '../src/core.js';
import { CORE_COLORS, FEED_CANVAS, MANDATORY_FOOTER } from './design-sdk.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Palu is WITA (UTC+8); compute from the UTC timestamp (never BMKG's WIB field).
function witaCard(date) {
  const d = new Date(date.getTime() + 8 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${hh}.${mm} WITA`;
}

// BMKG's Wilayah is a sentence ("Pusat gempa berada di darat 37 km utara Sigi").
// Trim the boilerplate prefix and clamp so it fits the card.
function shortPlace(p) {
  let s = String(p || '').replace(/^Pusat gempa berada di\s*/i, '').trim();
  if (!s) return 'Dekat Palu';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 30 ? s.slice(0, 29).trimEnd() + '…' : s;
}

// SVG <text> does not wrap; split into at most 3 lines for the caution band.
function wrap(text, max) {
  const lines = [];
  let cur = '';
  for (const w of String(text).split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function T(x, y, size, fill, content, { weight = 400, anchor = 'start' } = {}) {
  return (
    `<text x="${x}" y="${y}" font-family="'DejaVu Sans', Arial, sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">` +
    `${esc(content)}</text>`
  );
}

// Severity chip — maps classify().level to a brand colour + Indonesian label
// (same tiers as ICON/LEVEL_ID in core.js: LOW/MODERATE/HIGH/CRITICAL).
const SEV = {
  CRITICAL: { label: 'Kritis', bg: '#B5362B', ink: '#FBFCFB', dot: '#FBFCFB' },
  HIGH: { label: 'Tinggi', bg: '#D85A30', ink: '#4A1B0C', dot: '#4A1B0C' },
  MODERATE: { label: 'Sedang', bg: '#C77B0A', ink: '#412402', dot: '#412402' },
  LOW: { label: 'Ringan', bg: '#1D9E75', ink: '#04342C', dot: '#04342C' },
};

// Caution-band copy + colours, mirroring the `action` ladder in buildMessage().
// The high-ground rule for a strong shallow quake is preserved regardless of the
// official tsunami flag (safety invariant #1).
function noteFor(c, m) {
  if (c.tsunami === 'warning')
    return {
      text: 'Segera menjauh dari pantai & sungai. Naik ke tempat tinggi SEKARANG.',
      bg: '#B5362B', ink: '#FFFFFF', bar: '#82231B',
    };
  if (c.tsunami === 'caution')
    return {
      text: 'Gempa besar & dangkal. Jika di dekat pantai dan guncangan kuat, jangan menunggu — naik ke tempat tinggi.',
      bg: '#C77B0A', ink: '#412402', bar: '#7A4A06',
    };
  if (c.level === 'HIGH' || c.level === 'CRITICAL')
    return {
      text: 'Berlindung: merunduk, lindungi kepala, jauhi bangunan & jendela. Siap menghadapi gempa susulan.',
      bg: '#C77B0A', ink: '#412402', bar: '#7A4A06',
    };
  if (c.level === 'LOW')
    return {
      text: (m.felt ? 'Gempa dirasakan ringan. ' : 'Gempa kecil, dampak minim. ') +
        'Tetap tenang dan waspadai gempa susulan.',
      bg: '#0F6E56', ink: '#E1F5EE', bar: '#0A3742',
    };
  return { text: 'Tetap tenang dan waspadai gempa susulan.', bg: '#0F6E56', ink: '#E1F5EE', bar: '#0A3742' };
}

// m: a MergedEvent (or anything with magnitude/depthKm/place/time/felt/tsunamiFlag
// and distanceToPalu()). shakemapDataUri: a `data:image/jpeg;base64,...` string,
// or null to render a "tidak tersedia" placeholder.
export function buildCardSvg(m, { shakemapDataUri = null } = {}) {
  const c = classify(m);
  const sev = SEV[c.level] || SEV.LOW;
  const note = noteFor(c, m);
  const mag = 'M' + m.magnitude.toFixed(1).replace('.', ',');
  const place = shortPlace(m.place);
  const depth = Number.isFinite(m.depthKm) ? `${m.depthKm} km` : 'n/a';
  const sub = `Kedalaman ${depth} · ${witaCard(m.time)}`;

  const chipW = 96 + sev.label.length * 26;
  const chipX = 1036 - chipW;

  const noteLines = wrap(note.text, 50);
  const bandY = 952;
  const bandH = 52 + noteLines.length * 46 + 16;

  const hero = shakemapDataUri
    ? `<image href="${shakemapDataUri}" x="0" y="184" width="${FEED_CANVAS.width}" height="600" preserveAspectRatio="xMidYMid slice"/>`
    : T(540, 500, 30, CORE_COLORS.teal_accent, 'Shakemap BMKG tidak tersedia', { anchor: 'middle' });

  const p = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FEED_CANVAS.width} ${FEED_CANVAS.height}" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" role="img">`);
  p.push(`<title>${esc(`Palu Earthquake Alerts — ${mag} ${place}`)}</title>`);
  p.push(`<rect x="0" y="0" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" fill="${CORE_COLORS.teal}"/>`);

  // header
  p.push(`<rect x="0" y="0" width="${FEED_CANVAS.width}" height="184" fill="${CORE_COLORS.teal_deep}"/>`);
  p.push(`<circle cx="96" cy="92" r="58" fill="${CORE_COLORS.teal}" stroke="${CORE_COLORS.teal_accent}" stroke-width="5"/>`);
  p.push(`<path d="M40 92 H62 L72 70 84 120 96 56 108 92 H152" fill="none" stroke="${CORE_COLORS.off_white}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
  p.push(`<path d="M84 120 96 56 108 92" fill="none" stroke="${CORE_COLORS.amber}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
  p.push(T(184, 80, 40, CORE_COLORS.off_white, 'Palu Earthquake Alerts', { weight: 600 }));
  p.push(T(184, 124, 26, CORE_COLORS.teal_accent, 'Pemantau gempa & tsunami · Sulawesi Tengah'));
  p.push(`<rect x="${chipX}" y="56" width="${chipW}" height="60" rx="30" fill="${sev.bg}"/>`);
  p.push(`<circle cx="${chipX + 34}" cy="86" r="9" fill="${sev.dot}"/>`);
  p.push(T(chipX + 58, 97, 30, sev.ink, sev.label, { weight: 600 }));

  // hero (shakemap)
  p.push(`<rect x="0" y="184" width="${FEED_CANVAS.width}" height="600" fill="${CORE_COLORS.teal_mid}"/>`);
  p.push(hero);
  p.push(`<rect x="32" y="716" width="580" height="52" rx="8" fill="${CORE_COLORS.teal_deep}" fill-opacity="0.82"/>`);
  p.push(T(56, 751, 28, CORE_COLORS.mint, 'Peta guncangan (shakemap) · BMKG'));

  // magnitude + location (place column kept clear of the wide magnitude glyphs)
  p.push(T(44, 902, 104, CORE_COLORS.off_white, mag, { weight: 600 }));
  p.push(T(384, 866, 40, CORE_COLORS.off_white, place, { weight: 600 }));
  p.push(T(384, 912, 30, CORE_COLORS.mint, sub));

  // caution band
  p.push(`<rect x="44" y="${bandY}" width="992" height="${bandH}" rx="12" fill="${note.bg}"/>`);
  p.push(`<rect x="44" y="${bandY}" width="12" height="${bandH}" fill="${note.bar}"/>`);
  noteLines.forEach((ln, i) => p.push(T(82, bandY + 56 + i * 46, 32, note.ink, ln)));

  // Footer lines come from the Design SDK; the renderer still owns placement.
  p.push(`<rect x="0" y="1200" width="${FEED_CANVAS.width}" height="150" fill="${CORE_COLORS.teal_deep}"/>`);
  p.push(T(44, 1262, 28, CORE_COLORS.teal_accent, MANDATORY_FOOTER.currentLines[0]));
  p.push(T(44, 1300, 28, CORE_COLORS.teal_accent, MANDATORY_FOOTER.currentLines[1]));
  p.push(T(1036, 1284, 32, CORE_COLORS.off_white, MANDATORY_FOOTER.handle, { weight: 600, anchor: 'end' }));

  p.push('</svg>');
  return p.join('');
}
