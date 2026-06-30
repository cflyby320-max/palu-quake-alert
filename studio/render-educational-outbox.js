// Render the editorial dry-run outbox into reviewable educational cards.
//
// Manual operator tool only. It reads committed render decisions and writes
// SVG/PNG previews. It does not post, call APIs, or update topic backlog usage.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { CORE_COLORS } from './design-sdk.js';
import { renderEducationalCard } from './render-education.js';

const INPUT_BATCH = new URL('./outbox/editorial-dry-run-1/', import.meta.url);
const OUTPUT_BATCH = new URL('./outbox/educational-render-preview-4/', import.meta.url);
const FONT_FILES = [
  fileURLToPath(new URL('./assets/fonts/DejaVuSans.ttf', import.meta.url)),
  fileURLToPath(new URL('./assets/fonts/DejaVuSans-Bold.ttf', import.meta.url)),
];

const TOPIC_DIRS = [
  '01-ground_high_ground_route',
  '02-prep_drop_cover_hold',
  '03-info_check_before_share',
  '04-info_no_prediction',
  '05-prep_go_bag_basics',
];

export const PREVIEW4_ASSET_ASSIGNMENTS = Object.freeze({
  ground_high_ground_route: {
    ambient_pattern: 'pat_ground_contours',
  },
  prep_drop_cover_hold: {
    ambient_pattern: 'pat_preparedness_route_grid',
    row_icons: ['icon_action_drop', 'icon_action_cover', 'icon_action_hold'],
  },
  info_check_before_share: {
    ambient_pattern: 'pat_information_source_trail',
    row_icons: ['icon_verify_stop', 'icon_verify_source', 'icon_verify_share'],
  },
  info_no_prediction: {},
  prep_go_bag_basics: {
    focal_illustration: 'ill_preparedness_go_bag_flatlay',
  },
});

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function writeJson(url, value) {
  writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function topicOutputDir(topicDir, outputBatch) {
  const outDir = new URL(`${topicDir}/`, outputBatch);
  mkdirSync(outDir, { recursive: true });
  return outDir;
}

function assignApprovedAssets(decision, assetAssignments) {
  const slots = assetAssignments[decision.topicId];
  if (!slots) throw new Error(`no approved asset assignment for topic "${decision.topicId}"`);
  const integrated = structuredClone(decision);
  integrated.imageStatus = Object.keys(slots).length
    ? 'approved_assets_integrated_review_required'
    : 'intentionally_asset_free_review_required';
  integrated.backlogDecision.assets = {
    ...integrated.backlogDecision.assets,
    slots,
  };
  integrated.renderSpec.assets = {
    ...integrated.renderSpec.assets,
    slots,
  };
  return integrated;
}

function contactSheetImage(path, x, y) {
  const dataUri = `data:image/png;base64,${readFileSync(path).toString('base64')}`;
  return `<image href="${dataUri}" x="${x}" y="${y}" width="360" height="450" preserveAspectRatio="xMidYMid meet"/>`;
}

function contactSheetText(value, x, y, size, { fill = CORE_COLORS.off_white, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="'DejaVu Sans'" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
}

function renderContactSheet(outputBatch, rendered) {
  const positions = [
    [240, 126],
    [780, 126],
    [1320, 126],
    [510, 606],
    [1050, 606],
  ];
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" role="img">',
    '<title>Educational Render Preview 4 contact sheet</title>',
    `<rect width="1920" height="1080" fill="${CORE_COLORS.teal_deep}"/>`,
    `<rect width="1920" height="82" fill="${CORE_COLORS.teal}"/>`,
    contactSheetText('EDUCATIONAL RENDER PREVIEW 4', 54, 54, 34),
    contactSheetText('REVIEW ONLY / HUMAN APPROVAL REQUIRED', 1866, 54, 24, {
      fill: CORE_COLORS.mint,
      anchor: 'end',
    }),
  ];

  rendered.forEach((item, index) => {
    const [x, y] = positions[index];
    parts.push(
      contactSheetText(`${String(index + 1).padStart(2, '0')}  ${item.topicId}`, x, y - 12, 19),
      `<rect x="${x - 3}" y="${y - 3}" width="366" height="456" rx="5" fill="${CORE_COLORS.amber}"/>`,
      contactSheetImage(new URL(`${item.folder}/card.png`, outputBatch), x, y)
    );
  });
  parts.push('</svg>');

  const svg = parts.join('');
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1920 },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
    background: CORE_COLORS.teal_deep,
  }).render().asPng();
  writeFileSync(new URL('contact-sheet.svg', outputBatch), svg, 'utf8');
  writeFileSync(new URL('contact-sheet.png', outputBatch), png);
}

export function renderEducationalOutbox({
  inputBatch = INPUT_BATCH,
  outputBatch = OUTPUT_BATCH,
  assetAssignments = PREVIEW4_ASSET_ASSIGNMENTS,
} = {}) {
  const sourceManifest = readJson(new URL('manifest.json', inputBatch));
  const prepared = TOPIC_DIRS.map((topicDir) => {
    const inputDir = new URL(`${topicDir}/`, inputBatch);
    const sourceDecision = readJson(new URL('render-decision.json', inputDir));
    const decision = assignApprovedAssets(sourceDecision, assetAssignments);
    const { svg, png } = renderEducationalCard(decision.renderSpec);
    return { topicDir, inputDir, decision, svg, png };
  });

  mkdirSync(outputBatch, { recursive: true });
  const rendered = [];
  for (const { topicDir, inputDir, decision, svg, png } of prepared) {
    const outDir = topicOutputDir(topicDir, outputBatch);
    writeFileSync(
      new URL('caption.txt', outDir),
      readFileSync(new URL('caption.txt', inputDir))
    );
    writeFileSync(
      new URL('render-decision.json', outDir),
      `${JSON.stringify(decision, null, 2)}\n`,
      'utf8'
    );
    writeFileSync(new URL('card.svg', outDir), svg, 'utf8');
    writeFileSync(new URL('card.png', outDir), png);
    writeFileSync(
      new URL('review-note.md', outDir),
      [
        '# Review Note',
        '',
        'This card was generated deterministically from `render-decision.json` using the explicit asset-composition contract.',
        'Review the PNG, caption, source IDs, mandatory footer, and calm local framing before posting.',
        'This file is not an approval record.',
        '',
      ].join('\n'),
      'utf8'
    );

    rendered.push({
      topicId: decision.topicId,
      folder: basename(topicDir),
      files: ['card.png', 'card.svg', 'caption.txt', 'render-decision.json', 'review-note.md'],
    });
  }

  renderContactSheet(outputBatch, rendered);

  const manifest = {
    schemaVersion: '1.0.0',
    batchId: 'educational-render-preview-4',
    sourceBatchId: sourceManifest.batchId,
    batchType: 'educational_render_preview',
    visualQaRevision: 4,
    publicationStatus: 'review_required_not_auto_posted',
    created: '2026-06-27',
    renderer: 'studio/render-education.js',
    sourceRendererInput: 'studio/outbox/editorial-dry-run-1',
    compositionContract: 'design/RENDERING_CONTRACT.md#educational-asset-composition',
    assetAssignment: 'studio/render-educational-outbox.js#PREVIEW4_ASSET_ASSIGNMENTS',
    reviewArtifacts: ['contact-sheet.png', 'contact-sheet.svg'],
    rules: {
      noAutoPost: true,
      noExternalApis: true,
      noWatcherChanges: true,
      humanApprovalRequired: true,
      mandatoryFooterId: sourceManifest.rules.mandatoryFooterId,
    },
    rendered,
  };
  writeJson(new URL('manifest.json', outputBatch), manifest);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = renderEducationalOutbox();
  console.log(`Rendered ${manifest.rendered.length} educational cards to studio/outbox/${manifest.batchId}/`);
}
