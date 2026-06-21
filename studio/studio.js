// Studio CLI.
// Turns one earthquake event into a branded Instagram card (PNG) + an Indonesian
// caption (txt). No Meta account, no auto-posting: it produces the assets you
// upload to Instagram by hand.
//
//   node studio.js --demo               render the live BMKG latest quake -> studio/out/
//   node studio.js --draft [--dry-run]  render it AND DM the draft to your Telegram
//   node studio.js --help
//
// The watcher calls studio/hook.js automatically on each alert (when
// STUDIO_ENABLED=true); this CLI is for manual previews/tests.

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseBmkgEntry, clusterEvents } from '../src/core.js';
import { renderCard } from './render.js';
import { buildCaption } from './caption.js';
import { deliverDraft } from './deliver.js';

const BMKG_AUTOGEMPA = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';

async function fetchLatestEvent() {
  const res = await fetch(BMKG_AUTOGEMPA, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`BMKG autogempa ${res.status}`);
  const g = (await res.json())?.Infogempa?.gempa;
  const ev = g && parseBmkgEntry(g);
  if (!ev) throw new Error('could not parse the latest BMKG event');
  return clusterEvents([ev])[0]; // wrap as a MergedEvent
}

// Render a MergedEvent to studio/out/{card.png, caption.txt}; return the assets.
async function emit(m) {
  const outDir = new URL('./out/', import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const { png, hadShakemap } = await renderCard(m);
  const caption = buildCaption(m);
  writeFileSync(new URL('card.png', outDir), png);
  writeFileSync(new URL('caption.txt', outDir), caption, 'utf8');

  console.log(`Rendered M${m.magnitude.toFixed(1)} — ${m.place || 'dekat Palu'}`);
  console.log(`  card    : studio/out/card.png (${(png.length / 1024).toFixed(0)} KB${hadShakemap ? '' : ', no shakemap'})`);
  console.log(`  caption : studio/out/caption.txt`);
  return { png, caption, hadShakemap };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.length === 0) {
    console.log(
      [
        'Studio — branded Instagram cards for Palu Earthquake Alerts',
        '  node studio.js --demo               render the live BMKG latest quake -> studio/out/',
        '  node studio.js --draft [--dry-run]  render it AND DM the draft to your Telegram',
      ].join('\n')
    );
    return;
  }

  if (args.includes('--demo')) {
    const { caption } = await emit(await fetchLatestEvent());
    console.log('\n----- caption -----\n' + caption + '\n');
    return;
  }

  if (args.includes('--draft')) {
    const m = await fetchLatestEvent();
    const { png, caption, hadShakemap } = await emit(m);
    const res = await deliverDraft({ png, caption, m, hadShakemap }, { dryRun });
    console.log(res.delivered ? '\nDraft DM sent to your Telegram.' : `\nDraft not sent (${res.reason}).`);
    return;
  }

  console.log('Unknown option. Try --help.');
}

main().catch((e) => {
  console.error('studio failed:', e.message);
  process.exit(1);
});
