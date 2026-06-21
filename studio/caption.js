// Deterministic Indonesian Instagram caption for a quake near Palu.
// PURE (no I/O). No LLM in the quake path — the wording is fixed and mirrors the
// `action`/`official` ladder in buildMessage() so the caption can never go
// off-script or invent a fact. The honest-framing line is always present.

import { classify, witaString, compass, mapLink } from '../src/core.js';

function placeText(p) {
  return String(p || '').replace(/^Pusat gempa berada di\s*/i, '').trim() || 'dekat Palu';
}

export function buildCaption(m, { sequenceN } = {}) {
  const c = classify(m);
  const mag = m.magnitude.toFixed(1).replace('.', ',');
  const dist = Math.round(c.dist);
  const dir = compass(m.bearingFromPalu()).id;
  const depth = Number.isFinite(m.depthKm) ? `${m.depthKm} km` : 'n/a';
  const wita = witaString(m.time);
  const place = placeText(m.place);

  const tsunami =
    m.tsunamiFlag === true
      ? 'Berpotensi tsunami (peringatan resmi BMKG).'
      : m.tsunamiFlag === false
      ? 'Tidak berpotensi tsunami.'
      : 'Status tsunami belum dipastikan.';

  let action;
  if (c.tsunami === 'warning')
    action = 'Segera menjauh dari pantai dan sungai, naik ke tempat tinggi sekarang.';
  else if (c.tsunami === 'caution')
    action =
      'Gempa besar dan dangkal — jika di dekat pantai dan guncangan terasa kuat, jangan menunggu konfirmasi, naik ke tempat tinggi.';
  else if (c.level === 'HIGH' || c.level === 'CRITICAL')
    action = 'Berlindung, jauhi bangunan dan jendela, siap menghadapi gempa susulan.';
  else if (c.level === 'LOW')
    action = 'Dampak minim. Tetap tenang dan waspadai gempa susulan.';
  else action = 'Tetap tenang dan waspadai gempa susulan.';

  const seq =
    sequenceN && sequenceN >= 2
      ? ` Ini gempa ke-${sequenceN} di sekitar Palu dalam 24 jam terakhir.`
      : '';

  const headline =
    `Gempa M${mag} ${m.felt ? 'dirasakan ' : ''}di ${place} ` +
    `(~${dist} km ${dir} Palu, kedalaman ${depth}), ${wita}.`;

  return [
    `${headline} ${tsunami} ${action}${seq}`,
    '',
    'Notifikasi cepat — bukan peringatan dini. Selalu ikuti arahan resmi BMKG, sirene, dan petugas.',
    '',
    `📍 Peta episentrum: ${mapLink(m.lat, m.lon)}`,
    '',
    '#gempa #Palu #Sigi #SulawesiTengah #BMKG #InaTEWS #siapsiaga #mitigasibencana',
  ].join('\n');
}
