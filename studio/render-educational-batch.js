// Render any editorial dry-run batch into reviewable educational cards.
//
// Manual operator tool only. Generic successor to render-educational-outbox.js
// (which is pinned to the Preview 4 batch + its asset-assignment map). This one
// reads whatever render decisions a batch already contains — assets are expected
// to be embedded in each decision's renderSpec.assets — and writes SVG/PNG
// previews + a contact sheet. It does not post, call APIs, alter copy, or update
// the topic backlog. Every card stays review-only until a human approves it.

import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { CORE_COLORS } from './design-sdk.js';
import { renderEducationalCard } from './render-education.js';

const FONT_FILES = [
  fileURLToPath(new URL('./assets/fonts/DejaVuSans.ttf', import.meta.url)),
  fileURLToPath(new URL('./assets/fonts/DejaVuSans-Bold.ttf', import.meta.url)),
];

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function writeJson(url, value) {
  writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// Topic dirs are the numbered subfolders (e.g. "01-topic_id"), sorted by name.
function topicDirs(inputBatch) {
  return readdirSync(inputBatch, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d/.test(e.name))
    .map((e) => e.name)
    .sort();
}

function contactSheetImage(path, x, y) {
  const dataUri = `data:image/png;base64,${readFileSync(path).toString('base64')}`;
  return `<image href="${dataUri}" x="${x}" y="${y}" width="360" height="450" preserveAspectRatio="xMidYMid meet"/>`;
}

function contactSheetText(value, x, y, size, { fill = CORE_COLORS.off_white, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="'DejaVu Sans'" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
}

// Lay up to 5 cards out on a 1920x1080 sheet (3 on top, 2 centered below).
function renderContactSheet(outputBatch, rendered, batchLabel) {
  const positions = [
    [240, 126],
    [780, 126],
    [1320, 126],
    [510, 606],
    [1050, 606],
  ];
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" role="img">',
    `<title>${batchLabel} contact sheet</title>`,
    `<rect width="1920" height="1080" fill="${CORE_COLORS.teal_deep}"/>`,
    `<rect width="1920" height="82" fill="${CORE_COLORS.teal}"/>`,
    contactSheetText(batchLabel.toUpperCase(), 54, 54, 34),
    contactSheetText('REVIEW ONLY / HUMAN APPROVAL REQUIRED', 1866, 54, 24, {
      fill: CORE_COLORS.mint,
      anchor: 'end',
    }),
  ];

  rendered.slice(0, positions.length).forEach((item, index) => {
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

export function renderEducationalBatch({ inputBatch, outputBatch, batchId } = {}) {
  if (!inputBatch || !outputBatch) throw new Error('inputBatch and outputBatch URLs are required');
  const label = batchId || basename(fileURLToPath(outputBatch).replace(/\/$/, ''));
  const sourceManifest = readJson(new URL('manifest.json', inputBatch));

  const dirs = topicDirs(fileURLToPath(inputBatch));
  mkdirSync(outputBatch, { recursive: true });
  const rendered = [];

  for (const dirName of dirs) {
    const inDir = new URL(`${dirName}/`, inputBatch);
    const decision = readJson(new URL('render-decision.json', inDir));
    // renderEducationalCard re-validates the spec and fails closed on any bad asset.
    const { svg, png } = renderEducationalCard(decision.renderSpec);

    const outDir = new URL(`${dirName}/`, outputBatch);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(new URL('caption.txt', outDir), readFileSync(new URL('caption.txt', inDir)));
    writeJson(new URL('render-decision.json', outDir), {
      ...decision,
      batchId: label,
      imageStatus: 'rendered_review_required',
      publicationStatus: 'review_required_not_auto_posted',
    });
    writeFileSync(new URL('card.svg', outDir), svg, 'utf8');
    writeFileSync(new URL('card.png', outDir), png);
    writeFileSync(
      new URL('review-note.md', outDir),
      [
        '# Review Note',
        '',
        'Generated deterministically from `render-decision.json` (renderSpec validated by the content engine + template registry).',
        'Review the PNG, caption, source IDs, mandatory footer, and calm local framing before posting.',
        'This file is not an approval record.',
        '',
      ].join('\n'),
      'utf8'
    );

    rendered.push({
      topicId: decision.topicId,
      folder: dirName,
      templateId: decision.templateId,
      files: ['card.png', 'card.svg', 'caption.txt', 'render-decision.json', 'review-note.md'],
    });
  }

  renderContactSheet(outputBatch, rendered, label);

  const manifest = {
    schemaVersion: '1.0.0',
    batchId: label,
    sourceBatchId: sourceManifest.batchId,
    batchType: 'educational_render_preview',
    publicationStatus: 'review_required_not_auto_posted',
    created: new Date().toISOString().slice(0, 10),
    renderer: 'studio/render-education.js',
    sourceRendererInput: `studio/outbox/${sourceManifest.batchId}`,
    reviewArtifacts: ['contact-sheet.png', 'contact-sheet.svg'],
    rules: {
      noAutoPost: true,
      noExternalApis: true,
      noWatcherChanges: true,
      humanApprovalRequired: true,
      mandatoryFooterId: sourceManifest.rules?.mandatoryFooterId || 'mandatory_honest_framing',
    },
    rendered,
  };
  writeJson(new URL('manifest.json', outputBatch), manifest);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const inId = get('--in', 'editorial-dry-run-2');
  const outId = get('--out', 'educational-render-preview-6');
  const inputBatch = new URL(`./outbox/${inId}/`, import.meta.url);
  const outputBatch = new URL(`./outbox/${outId}/`, import.meta.url);
  const manifest = renderEducationalBatch({ inputBatch, outputBatch, batchId: outId });
  console.log(`Rendered ${manifest.rendered.length} educational cards to studio/outbox/${manifest.batchId}/`);
}
