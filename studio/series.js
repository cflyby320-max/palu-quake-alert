// Render the evergreen white-paper feed series to PNG cards + captions.
// Editorial (non-quake) companion to studio.js. No network, no Meta account:
// it writes studio/out/series/card-N.png + caption-N.txt for you to upload to
// Instagram by hand, in order, as a feed carousel.
//
//   node studio/series.js            render all cards in the series
//   node studio/series.js --help
//
// The series content lives in studio/content/whitepaper-series.js; the layout is
// studio/evergreen.js (pure SVG); rasterisation reuses render.js (the one resvg
// boundary). Studio stays isolated from the zero-dependency safety watcher.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildEvergreenSvg } from './evergreen.js';
import { rasterizePng } from './render.js';
import { SERIES } from './content/whitepaper-series.js';

function main() {
  if (process.argv.includes('--help')) {
    console.log('Render the white-paper feed series -> studio/out/series/\n  node studio/series.js');
    return;
  }

  const outDir = fileURLToPath(new URL('./out/series/', import.meta.url));
  mkdirSync(outDir, { recursive: true });

  const total = SERIES.length;
  SERIES.forEach((card, i) => {
    const index = i + 1;
    const { svg, overflow, contentBottom } = buildEvergreenSvg(card, { index, total });
    const png = rasterizePng(svg);
    writeFileSync(`${outDir}card-${index}.png`, png);
    writeFileSync(`${outDir}caption-${index}.txt`, card.caption, 'utf8');
    const warn = overflow ? `  ⚠️ content reaches y=${contentBottom} (>1180, may collide with footer)` : '';
    console.log(`card-${index}.png  ${(png.length / 1024).toFixed(0)} KB  · "${card.title}"${warn}`);
  });

  console.log(`\n${total} cards written to studio/out/series/  (card-N.png + caption-N.txt)`);
  console.log('Upload them to Instagram in order as a feed carousel.');
}

main();
