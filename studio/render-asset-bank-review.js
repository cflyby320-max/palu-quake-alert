// Build a deterministic mobile review sheet for Asset Bank Sprint 1.
//
// This tool only reads indexed local candidates and writes review artifacts.
// It does not connect candidates to post templates or publish anything.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { ASSET_BANK_REVIEW_IDS, loadLocalSvgAsset } from './asset-library.js';
import { CORE_COLORS, FEED_CANVAS } from './design-sdk.js';

const OUTPUT_DIR = new URL('./outbox/asset-bank-review-2/', import.meta.url);
const FONT_FILES = [
  fileURLToPath(new URL('./assets/fonts/DejaVuSans.ttf', import.meta.url)),
  fileURLToPath(new URL('./assets/fonts/DejaVuSans-Bold.ttf', import.meta.url)),
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function label(id) {
  return id
    .replace(/^(pat|icon|ill)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function image(asset, x, y, width, height) {
  return `<image href="${asset.dataUri}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
}

function text(value, x, y, size, { fill = CORE_COLORS.teal_deep, weight = 400, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="'DejaVu Sans'" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
}

export function buildAssetBankContactSheet() {
  const loaded = Object.fromEntries(
    ASSET_BANK_REVIEW_IDS.map((id) => [id, loadLocalSvgAsset(id)])
  );
  const patterns = ASSET_BANK_REVIEW_IDS.slice(0, 3);
  const icons = ASSET_BANK_REVIEW_IDS.slice(3, 10);
  const illustration = loaded[ASSET_BANK_REVIEW_IDS[10]];

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FEED_CANVAS.width} ${FEED_CANVAS.height}" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" role="img">`,
    '<title>Asset Bank Sprint 1 candidate contact sheet</title>',
    `<rect width="1080" height="1350" fill="${CORE_COLORS.off_white}"/>`,
    `<rect width="1080" height="176" fill="${CORE_COLORS.teal_deep}"/>`,
    text('ASSET BANK / REVIEW 02', 60, 70, 42, { fill: CORE_COLORS.off_white, weight: 700 }),
    text('4 sourced replacements - approval required', 60, 122, 27, { fill: CORE_COLORS.mint }),
    text('Pillar patterns', 60, 222, 28, { weight: 700 }),
  ];

  patterns.forEach((id, index) => {
    const x = 60 + index * 328;
    parts.push(
      `<rect x="${x}" y="246" width="304" height="190" rx="10" fill="${CORE_COLORS.teal}"/>`,
      image(loaded[id], x + 8, 254, 288, 132),
      text(label(id), x + 16, 416, 18, { fill: CORE_COLORS.off_white, weight: 700 })
    );
  });

  parts.push(text('Topic icons', 60, 490, 28, { weight: 700 }));
  icons.forEach((id, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 60 + column * 246;
    const y = 516 + row * 224;
    parts.push(
      `<rect x="${x}" y="${y}" width="222" height="200" rx="10" fill="#EEF3F2"/>`,
      image(loaded[id], x + 48, y + 14, 126, 126),
      text(label(id), x + 111, y + 174, 17, { weight: 700, anchor: 'middle' })
    );
  });

  parts.push(
    text('Preparedness illustration', 60, 986, 28, { weight: 700 }),
    `<rect x="60" y="1010" width="960" height="220" rx="10" fill="#EEF3F2"/>`,
    image(illustration, 88, 1022, 410, 190),
    text('Go-bag Flatlay', 548, 1092, 32, { weight: 700 }),
    text('Candidate / safety review pending', 548, 1134, 23, { fill: CORE_COLORS.teal }),
    text('Approve, revise, or reject as one pack.', 548, 1174, 23),
    `<rect x="0" y="1260" width="1080" height="90" fill="${CORE_COLORS.teal_deep}"/>`,
    `<rect x="0" y="1260" width="1080" height="3" fill="${CORE_COLORS.amber}"/>`,
    text('TEXTLESS / LOCAL / NOT IN PRODUCTION', 60, 1317, 25, { fill: CORE_COLORS.mint, weight: 700 }),
    text('11 candidates', 1020, 1317, 25, { fill: CORE_COLORS.off_white, weight: 700, anchor: 'end' }),
    '</svg>'
  );

  return parts.join('');
}

export function renderAssetBankReview({ outputDir = OUTPUT_DIR } = {}) {
  mkdirSync(outputDir, { recursive: true });
  const svg = buildAssetBankContactSheet();
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: FEED_CANVAS.width },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
    background: CORE_COLORS.off_white,
  }).render().asPng();

  const manifest = {
    schemaVersion: '1.0.0',
    batchId: 'asset-bank-review-2',
    batchType: 'asset_candidate_review',
    publicationStatus: 'candidate_approval_required',
    created: '2026-06-27',
    candidateAssetIds: ASSET_BANK_REVIEW_IDS,
    rules: {
      textlessAssets: true,
      noProductionIntegration: true,
      noAutoPost: true,
      humanApprovalRequired: true,
    },
    files: ['contact-sheet.png', 'contact-sheet.svg'],
  };

  writeFileSync(new URL('contact-sheet.svg', outputDir), svg, 'utf8');
  writeFileSync(new URL('contact-sheet.png', outputDir), png);
  writeFileSync(new URL('manifest.json', outputDir), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = renderAssetBankReview();
  console.log(`Rendered ${manifest.candidateAssetIds.length} candidates to studio/outbox/${manifest.batchId}/`);
}
