// Branded "evergreen" Instagram cards for Palu Earthquake Alerts.
// PURE string builder (no network, no I/O, no resvg): a content object -> SVG.
// render.js's rasterizePng() turns it into a 1080x1350 (4:5 feed) PNG.
//
// This is the Phase-5 "evergreen / educational" track from STUDIO_DESIGN.md §8:
// editorial cards (why we exist, status, safety principles, get involved) that
// DON'T come from a quake event. It deliberately reuses the same brand chrome as
// the event card in template.js — the deep-teal canvas, the avatar medallion +
// waveform header, and the honest-framing footer that rides on EVERY post
// (safety invariant: "honest framing in every post"). Bahasa Indonesia only.
//
// Content model (one card):
//   { kicker, title, items:[ block, ... ] }   plus { index, total } at render.
// Block kinds:
//   { kind:'para',  text }                         a wrapped paragraph
//   { kind:'head',  text, color }                  a small uppercase section label
//   { kind:'num',   n, lead, sub? }                numbered point (teal disc)
//   { kind:'dot',   color, lead, sub? }            bulleted point (coloured dot)
//   { kind:'gap',   h }                            vertical spacer

const INK = '#FBFCFB';        // primary text on teal
const MUTE = '#9FE1CB';       // secondary / sub text
const PARA = '#E1F0EC';       // paragraph body
const AMBER = '#E8A33D';      // kicker / warning accent
const TEAL = '#0F4C5C';
const TEAL_DEEP = '#0A3742';
const RIM = '#7FB7B8';

const FONT = "'DejaVu Sans', Arial, sans-serif";
// DejaVu Sans runs wide; ~0.55·fontSize per glyph is a safe wrap estimate.
const CW = 0.55;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function maxChars(size, width) {
  return Math.max(1, Math.floor(width / (size * CW)));
}

// SVG <text> does not wrap; greedily split into lines that fit `max` chars.
function wrap(text, max) {
  const lines = [];
  let cur = '';
  for (const w of String(text).split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function T(x, y, size, fill, content, { weight = 400, anchor = 'start' } = {}) {
  return (
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(content)}</text>`
  );
}

// The avatar medallion + seismic waveform, identical to template.js's header
// glyph so the series matches the bot avatar and the event cards.
function headerGlyph() {
  return (
    '<circle cx="96" cy="92" r="58" fill="#0F4C5C" stroke="#7FB7B8" stroke-width="5"/>' +
    '<path d="M40 92 H62 L72 70 84 120 96 56 108 92 H152" fill="none" stroke="#FBFCFB" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M84 120 96 56 108 92" fill="none" stroke="#C77B0A" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
  );
}

// Layout constants for the editorial body column.
const X = 72;                 // left margin
const RIGHT = 1008;           // right margin
const COLW = RIGHT - X;       // paragraph width (936)
const IND = 140;              // indented text x for num/dot
const INDW = RIGHT - IND;     // indented width (868)

// Render one content block at top `y`; returns { svg, y } with the advanced y.
function block(b, y) {
  const p = [];
  if (b.kind === 'gap') return { svg: '', y: y + (b.h || 24) };

  if (b.kind === 'head') {
    p.push(T(X, y + 30, 27, b.color || AMBER, b.text.toUpperCase(), { weight: 700 }));
    p.push(`<rect x="${X}" y="${y + 44}" width="64" height="5" rx="2.5" fill="${b.color || AMBER}"/>`);
    return { svg: p.join(''), y: y + 70 };
  }

  if (b.kind === 'para') {
    const lines = wrap(b.text, maxChars(32, COLW));
    lines.forEach((ln, i) => p.push(T(X, y + 34 + i * 44, 32, b.color || PARA, ln, { weight: b.weight || 400 })));
    return { svg: p.join(''), y: y + 18 + lines.length * 44 };
  }

  // num | dot — a marker plus a bold lead and an optional muted sub-line.
  const leadLines = wrap(b.lead, maxChars(33, INDW));
  const subLines = b.sub ? wrap(b.sub, maxChars(26, INDW)) : [];
  const cy = y + 22;
  if (b.kind === 'num') {
    p.push(`<circle cx="100" cy="${cy}" r="26" fill="${TEAL_DEEP}" stroke="${RIM}" stroke-width="3"/>`);
    p.push(T(100, cy + 11, 30, INK, String(b.n), { weight: 700, anchor: 'middle' }));
  } else {
    p.push(`<circle cx="100" cy="${cy}" r="11" fill="${b.color || AMBER}"/>`);
  }
  leadLines.forEach((ln, i) => p.push(T(IND, y + 31 + i * 42, 33, INK, ln, { weight: 700 })));
  let sy = y + 31 + leadLines.length * 42;
  subLines.forEach((ln, i) => p.push(T(IND, sy + 8 + i * 34, 26, MUTE, ln)));
  const h = 31 + leadLines.length * 42 + (subLines.length ? 8 + subLines.length * 34 : 0) + 16;
  return { svg: p.join(''), y: y + h };
}

// card: { kicker, title, items }. meta: { index, total }.
export function buildEvergreenSvg(card, { index = 1, total = 4 } = {}) {
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350" role="img">');
  p.push(`<title>${esc(`Palu Earthquake Alerts — ${card.title}`)}</title>`);
  p.push(`<rect x="0" y="0" width="1080" height="1350" fill="${TEAL}"/>`);

  // header band (mirrors the event card)
  p.push(`<rect x="0" y="0" width="1080" height="184" fill="${TEAL_DEEP}"/>`);
  p.push(headerGlyph());
  p.push(T(184, 80, 40, INK, 'Palu Earthquake Alerts', { weight: 600 }));
  p.push(T(184, 124, 26, RIM, 'Pemantau gempa & tsunami · Sulawesi Tengah'));
  // page chip (e.g. 1/4) for a feed carousel
  p.push('<rect x="940" y="62" width="96" height="60" rx="30" fill="#0F4C5C" stroke="#7FB7B8" stroke-width="3"/>');
  p.push(T(988, 101, 30, INK, `${index}/${total}`, { weight: 700, anchor: 'middle' }));

  // kicker + title
  p.push(T(X, 256, 30, AMBER, String(card.kicker || '').toUpperCase(), { weight: 700 }));
  const titleLines = wrap(card.title, maxChars(card.titleSize || 56, COLW));
  const ts = card.titleSize || 56;
  titleLines.forEach((ln, i) => p.push(T(X, 286 + ts + i * (ts + 8), ts, INK, ln, { weight: 700 })));
  let y = 286 + ts + titleLines.length * (ts + 8) + 14;

  // body blocks
  for (const b of card.items) {
    const r = block(b, y);
    p.push(r.svg);
    y = r.y;
  }

  // honest-framing footer — on every post (safety invariant)
  p.push(`<rect x="0" y="1200" width="1080" height="150" fill="${TEAL_DEEP}"/>`);
  p.push(T(44, 1262, 28, RIM, 'Notifikasi cepat — bukan peringatan dini.'));
  p.push(T(44, 1300, 28, RIM, 'Selalu ikuti arahan resmi BMKG.'));
  p.push(T(1036, 1284, 32, INK, '@infogempapalu', { weight: 600, anchor: 'end' }));

  p.push('</svg>');
  return { svg: p.join(''), overflow: y > 1180, contentBottom: Math.round(y) };
}
