// Rasterise a branded card SVG to PNG.
// The ONE place the studio uses a dependency (@resvg/resvg-js). It is imported
// here and nowhere in ../src, so the safety watcher stays zero-dependency.
// Manual posting accepts PNG, so we skip JPEG conversion (and sharp) for now.

import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { buildCardSvg } from './template.js';

// Bundled fonts so the card renders identically on Windows AND on the Linux host
// (Fly), which ships no system fonts — without these the text would come out
// blank there. loadSystemFonts is off for deterministic output everywhere.
const FONT_FILES = [
  fileURLToPath(new URL('./assets/fonts/DejaVuSans.ttf', import.meta.url)),
  fileURLToPath(new URL('./assets/fonts/DejaVuSans-Bold.ttf', import.meta.url)),
];

// Fetch an image URL and inline it as a base64 data URI, so the rasteriser needs
// no network of its own. Returns null (rather than throwing) on any failure — a
// missing/broken shakemap must degrade to a placeholder, never crash the render.
export async function fetchAsDataUri(url, { timeoutMs = 20000 } = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// m: a MergedEvent. Returns { png: Buffer, svg: string }.
export async function renderCard(m, opts = {}) {
  const shakemapDataUri = m.shakemap ? await fetchAsDataUri(m.shakemap) : null;
  const svg = buildCardSvg(m, { ...opts, shakemapDataUri });
  return { png: rasterizePng(svg), svg, hadShakemap: Boolean(shakemapDataUri) };
}

// Rasterise any 1080-wide card SVG (event cards OR the evergreen series) to PNG.
// The single dependency (@resvg/resvg-js) is confined to this file; callers pass
// in a finished SVG string, so ../src and the evergreen template stay dep-free.
export function rasterizePng(svg, { width = 1080, background = '#0F4C5C' } = {}) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
    background,
  });
  return resvg.render().asPng();
}
