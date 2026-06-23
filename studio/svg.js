// Shared SVG brand chrome for the studio's 1080x1350 cards.
// PURE string builders (no network, no I/O). Both the quake card (template.js)
// and the educational cards (edutemplate.js) render through these helpers so the
// brand frame — and, critically, the honest-framing footer — can NEVER drift
// between the two. Bahasa Indonesia + the same palette as preview.html.

export const HANDLE = '@infogempapalu';

// Brand palette (mirrors the :root vars in studio/preview.html).
export const PALETTE = {
  tealDeep: '#0A3742',
  teal: '#0F4C5C',
  tealMid: '#11343d',
  tealAccent: '#7FB7B8',
  mint: '#9FE1CB',
  off: '#FBFCFB',
  amber: '#C77B0A',
  amberInk: '#412402',
  red: '#B5362B',
  low: '#1D9E75',
};

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A single <text> element. SVG <text> does not wrap — use wrap() first.
export function T(x, y, size, fill, content, { weight = 400, anchor = 'start' } = {}) {
  return (
    `<text x="${x}" y="${y}" font-family="'DejaVu Sans', Arial, sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">` +
    `${esc(content)}</text>`
  );
}

// Greedy word-wrap into at most `maxLines` lines of <= `max` chars.
export function wrap(text, max, maxLines = 3) {
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
  return lines.slice(0, maxLines);
}

// Opening <svg> + accessible <title> + the teal background. `title` is escaped.
export function svgOpen(title) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350" role="img">' +
    `<title>${esc(title)}</title>` +
    `<rect x="0" y="0" width="1080" height="1350" fill="${PALETTE.teal}"/>`
  );
}

export const SVG_CLOSE = '</svg>';

// The branded header band: logo mark + name + tagline (LEFT side only). The
// caller adds any right-side chip/tag (severity for quakes, pillar for edu).
export function brandHeader() {
  return (
    `<rect x="0" y="0" width="1080" height="184" fill="${PALETTE.tealDeep}"/>` +
    `<circle cx="96" cy="92" r="58" fill="${PALETTE.teal}" stroke="${PALETTE.tealAccent}" stroke-width="5"/>` +
    '<path d="M40 92 H62 L72 70 84 120 96 56 108 92 H152" fill="none" stroke="#FBFCFB" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M84 120 96 56 108 92" fill="none" stroke="#C77B0A" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
    T(184, 80, 40, PALETTE.off, 'Palu Earthquake Alerts', { weight: 600 }) +
    T(184, 124, 26, PALETTE.tealAccent, 'Pemantau gempa & tsunami · Sulawesi Tengah')
  );
}

// The honest-framing footer — carried on EVERY post (safety invariant). Single
// source of truth so the quake and educational cards stay identical.
export function honestFooter() {
  return (
    `<rect x="0" y="1200" width="1080" height="150" fill="${PALETTE.tealDeep}"/>` +
    T(44, 1262, 28, PALETTE.tealAccent, 'Notifikasi cepat — bukan peringatan dini.') +
    T(44, 1300, 28, PALETTE.tealAccent, 'Selalu ikuti arahan resmi BMKG.') +
    T(1036, 1284, 32, PALETTE.off, HANDLE, { weight: 600, anchor: 'end' })
  );
}
