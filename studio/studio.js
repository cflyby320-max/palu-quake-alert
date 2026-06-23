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
import { renderCard, renderEduPost } from './render.js';
import { buildCaption } from './caption.js';
import { buildEduCaption, draftEduCaption } from './educaption.js';
import { listPosts, getPost } from './content/bank.js';
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

// Render an educational post (bank.js entry) to studio/out/ and return the
// assets. With useLlm, the caption is rephrased via the Claude API (validated,
// with deterministic fallback); otherwise the authored caption is used as-is.
async function emitEdu(post, { useLlm = false } = {}) {
  const outDir = new URL('./out/', import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const { pngs } = renderEduPost(post);
  const { caption, llm, reason } = useLlm
    ? await draftEduCaption(post)
    : { caption: buildEduCaption(post), llm: false };

  if (pngs.length === 1) {
    writeFileSync(new URL('card.png', outDir), pngs[0]);
  } else {
    pngs.forEach((buf, i) => writeFileSync(new URL(`card-${i + 1}.png`, outDir), buf));
  }
  writeFileSync(new URL('caption.txt', outDir), caption, 'utf8');

  const kb = (pngs.reduce((n, b) => n + b.length, 0) / 1024).toFixed(0);
  console.log(`Rendered [P${post.pillar}] ${post.id} — ${pngs.length} slide(s), ${kb} KB`);
  console.log(`  cards   : studio/out/${pngs.length === 1 ? 'card.png' : `card-1..${pngs.length}.png`}`);
  console.log(`  caption : studio/out/caption.txt${useLlm ? (llm ? ' (LLM)' : ` (authored — LLM fell back: ${reason})`) : ''}`);
  return { pngs, caption, post };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.length === 0) {
    console.log(
      [
        'Studio — branded cards for Palu Earthquake Alerts',
        '  Quake (reactive):',
        '    node studio.js --demo                 render the live BMKG latest quake -> studio/out/',
        '    node studio.js --draft [--dry-run]    render it AND DM the draft to your Telegram',
        '  Educational (evergreen):',
        '    node studio.js --edu                  list available educational posts',
        '    node studio.js --edu <id> [--dry-run] [--llm]   render one post + DM the draft',
        '    node studio.js --edu-all [--dry-run] [--llm]     render + DM every post',
        '  (--llm rephrases captions via the Claude API; default is the authored caption.)',
      ].join('\n')
    );
    return;
  }

  // Educational evergreen track --------------------------------------------
  if (args.includes('--edu-all')) {
    const useLlm = args.includes('--llm');
    for (const { id } of listPosts()) {
      const post = getPost(id);
      const { pngs, caption } = await emitEdu(post, { useLlm });
      const res = await deliverDraft({ pngs, caption, label: `${post.accent.tag} · ${post.id}` }, { dryRun });
      console.log(res.delivered ? '  → draft DM sent.' : `  → not sent (${res.reason}).`);
    }
    return;
  }

  if (args.includes('--edu')) {
    const i = args.indexOf('--edu');
    const id = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
    if (!id) {
      console.log('Educational posts:');
      for (const p of listPosts()) {
        console.log(`  ${p.id}  [P${p.pillar} · ${p.slot} · ${p.slides} slide(s)]`);
      }
      console.log('\nRender one:  node studio.js --edu <id> [--dry-run] [--llm]');
      return;
    }
    const post = getPost(id);
    if (!post) {
      console.log(`Unknown post id "${id}". Run "node studio.js --edu" to list them.`);
      process.exit(1);
    }
    const { pngs, caption } = await emitEdu(post, { useLlm: args.includes('--llm') });
    const res = await deliverDraft({ pngs, caption, label: `${post.accent.tag} · ${post.id}` }, { dryRun });
    console.log(res.delivered ? '\nDraft DM sent to your Telegram.' : `\nDraft not sent (${res.reason}).`);
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
