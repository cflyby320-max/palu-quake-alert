// Rasterise a validated evergreen educational render spec to PNG.
//
// This stays isolated in studio/. It shares the existing @resvg/resvg-js
// dependency used by quake cards and never imports the safety watcher.

import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { buildEducationalSvg } from './education-template.js';
import { CORE_COLORS, FEED_CANVAS } from './design-sdk.js';

const FONT_FILES = [
  fileURLToPath(new URL('./assets/fonts/DejaVuSans.ttf', import.meta.url)),
  fileURLToPath(new URL('./assets/fonts/DejaVuSans-Bold.ttf', import.meta.url)),
];

export function renderEducationalCard(renderSpec) {
  const svg = buildEducationalSvg(renderSpec);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: FEED_CANVAS.width },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
    background: CORE_COLORS.teal,
  });
  return { svg, png: resvg.render().asPng() };
}

