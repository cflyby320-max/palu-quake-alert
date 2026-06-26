// Render the editorial dry-run outbox into reviewable educational cards.
//
// Manual operator tool only. It reads committed render decisions and writes
// SVG/PNG previews. It does not post, call APIs, or update topic backlog usage.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderEducationalCard } from './render-education.js';

const INPUT_BATCH = new URL('./outbox/editorial-dry-run-1/', import.meta.url);
const OUTPUT_BATCH = new URL('./outbox/educational-render-preview-1/', import.meta.url);

const TOPIC_DIRS = [
  '01-ground_high_ground_route',
  '02-prep_drop_cover_hold',
  '03-info_check_before_share',
  '04-info_no_prediction',
  '05-prep_go_bag_basics',
];

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

export function renderEducationalOutbox({ inputBatch = INPUT_BATCH, outputBatch = OUTPUT_BATCH } = {}) {
  mkdirSync(outputBatch, { recursive: true });
  const sourceManifest = readJson(new URL('manifest.json', inputBatch));
  const rendered = [];

  for (const topicDir of TOPIC_DIRS) {
    const inputDir = new URL(`${topicDir}/`, inputBatch);
    const outDir = topicOutputDir(topicDir, outputBatch);
    const decision = readJson(new URL('render-decision.json', inputDir));
    const { svg, png } = renderEducationalCard(decision.renderSpec);

    copyFileSync(new URL('caption.txt', inputDir), new URL('caption.txt', outDir));
    copyFileSync(new URL('render-decision.json', inputDir), new URL('render-decision.json', outDir));
    writeFileSync(new URL('card.svg', outDir), svg, 'utf8');
    writeFileSync(new URL('card.png', outDir), png);
    writeFileSync(
      new URL('review-note.md', outDir),
      [
        '# Review Note',
        '',
        'This card was generated deterministically from `render-decision.json`.',
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

  const manifest = {
    schemaVersion: '1.0.0',
    batchId: 'educational-render-preview-1',
    sourceBatchId: sourceManifest.batchId,
    batchType: 'educational_render_preview',
    publicationStatus: 'review_required_not_auto_posted',
    created: '2026-06-27',
    renderer: 'studio/render-education.js',
    sourceRendererInput: 'studio/outbox/editorial-dry-run-1',
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
