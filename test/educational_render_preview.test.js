// Rendered educational preview tests. These inspect committed output files
// without importing Resvg, so the root test suite remains dependency-light.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FEED_CANVAS, MANDATORY_FOOTER } from '../studio/design-sdk.js';
import { validateRenderSpec } from '../studio/template-registry.js';

const DRY_RUN_DIR = 'studio/outbox/editorial-dry-run-1';
const PREVIEW_DIR = 'studio/outbox/educational-render-preview-1';
const EXPECTED_TOPIC_DIRS = [
  '01-ground_high_ground_route',
  '02-prep_drop_cover_hold',
  '03-info_check_before_share',
  '04-info_no_prediction',
  '05-prep_go_bag_basics',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pngSize(path) {
  const buf = readFileSync(path);
  return {
    signature: buf.slice(0, 8).toString('hex'),
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

function svgText(svg) {
  return svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('educational render preview manifest links back to the dry run', () => {
  const dryRun = readJson(join(DRY_RUN_DIR, 'manifest.json'));
  const preview = readJson(join(PREVIEW_DIR, 'manifest.json'));

  assert.equal(preview.batchType, 'educational_render_preview');
  assert.equal(preview.sourceBatchId, dryRun.batchId);
  assert.equal(preview.publicationStatus, 'review_required_not_auto_posted');
  assert.equal(preview.rules.noAutoPost, true);
  assert.equal(preview.rules.noExternalApis, true);
  assert.equal(preview.rules.noWatcherChanges, true);
  assert.equal(preview.rules.humanApprovalRequired, true);
  assert.deepEqual(preview.rendered.map((item) => item.topicId), dryRun.selection.topicIds);
});

test('each rendered preview folder has PNG, SVG, caption, render decision, and review note', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const files = readdirSync(join(PREVIEW_DIR, dir)).sort();
    assert.deepEqual(files, ['caption.txt', 'card.png', 'card.svg', 'render-decision.json', 'review-note.md']);
  }
});

test('rendered preview PNGs are valid feed-size images', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const size = pngSize(join(PREVIEW_DIR, dir, 'card.png'));
    assert.equal(size.signature, '89504e470d0a1a0a');
    assert.equal(size.width, FEED_CANVAS.width);
    assert.equal(size.height, FEED_CANVAS.height);
    assert.ok(size.bytes > 20_000, `${dir} PNG should not be blank or tiny`);
  }
});

test('rendered preview SVGs preserve text, footer, and valid render specs', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const decision = readJson(join(PREVIEW_DIR, dir, 'render-decision.json'));
    const svg = readFileSync(join(PREVIEW_DIR, dir, 'card.svg'), 'utf8');
    const text = svgText(svg);
    const validation = validateRenderSpec(decision.renderSpec);

    assert.equal(validation.ok, true, `${dir}: ${validation.errors.join('; ')}`);
    assert.ok(text.includes(decision.renderSpec.content.title));
    assert.ok(text.includes(MANDATORY_FOOTER.currentLines[0]));
    assert.ok(text.includes(MANDATORY_FOOTER.currentLines[1]));
    assert.ok(text.includes(MANDATORY_FOOTER.handle));
  }
});

test('render preview does not replace dry-run missing-image notes', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    assert.equal(existsSync(join(DRY_RUN_DIR, dir, 'missing-image.md')), true);
  }
});
