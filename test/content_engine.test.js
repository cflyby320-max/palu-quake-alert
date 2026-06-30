// Phase 5A content engine tests. These verify structured content decisions can
// become validated render specs without rendering, network, prompts, or AI.

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTENT_SCHEMA,
  SOURCE_INDEX,
  buildRenderSpecFromContentDecision,
} from '../studio/content-engine.js';

const VALID_DECISION = {
  schemaVersion: '1.0.0',
  templateId: 'editorial_steps',
  pillarId: 'preparedness',
  sourceIds: ['bnpb'],
  reviewStatus: 'verified',
  assets: {
    referenceAssetIds: ['reference_editorial_steps'],
  },
  content: {
    kicker: 'Siap Sebelum Bencana',
    title: 'Saat Gempa: 3 Langkah',
    rows: [
      { label: 'Merunduk', body: 'Turun ke lantai sebelum terjatuh.' },
      { label: 'Lindungi', body: 'Jaga kepala dan leher.' },
      { label: 'Berpegangan', body: 'Tahan sampai guncangan berhenti.' },
    ],
  },
};

test('content engine loads schema and approved source IDs', () => {
  assert.equal(CONTENT_SCHEMA.source, 'content/CONTENT_SCHEMA.json');
  assert.equal(SOURCE_INDEX.source, 'content/SOURCE_INDEX.json');

  const sourceIds = SOURCE_INDEX.index.sources.map((source) => source.id).sort();
  assert.deepEqual(sourceIds, ['bmkg', 'bnpb', 'bpbd_sulteng', 'project_safety_rules', 'usgs']);
});

test('content decision builds a validated render spec with deterministic defaults', () => {
  const result = buildRenderSpecFromContentDecision(VALID_DECISION);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.renderSpec.schemaVersion, '1.0.0');
  assert.equal(result.renderSpec.templateId, 'editorial_steps');
  assert.equal(result.renderSpec.exportTarget, 'instagram_feed');
  assert.equal(result.renderSpec.language, 'id');
  assert.equal(result.renderSpec.timezone, 'Asia/Makassar');
  assert.equal(result.renderSpec.footerId, 'mandatory_honest_framing');
  assert.deepEqual(result.renderSpec.knowledge, {
    pillarId: 'preparedness',
    sourceIds: ['bnpb'],
    reviewStatus: 'verified',
  });
});

test('content engine rejects legacy layout fields and missing sources', () => {
  const result = buildRenderSpecFromContentDecision({
    ...VALID_DECISION,
    layoutId: 'editorial_steps',
    sourceIds: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /layoutId is forbidden/);
  assert.match(result.errors.join('\n'), /sourceIds must include at least one source/);
});

test('content engine rejects unknown source IDs before publication', () => {
  const result = buildRenderSpecFromContentDecision({
    ...VALID_DECISION,
    sourceIds: ['made_up_source'],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sourceId "made_up_source" is not defined/);
});

test('content engine delegates template, footer, export target, and asset errors', () => {
  const result = buildRenderSpecFromContentDecision({
    ...VALID_DECISION,
    templateId: 'editorial_steps',
    exportTarget: 'story_9_16',
    footerId: 'wrong_footer',
    assets: {
      backgroundId: 'missing_background',
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exportTarget "story_9_16" is not allowed/);
  assert.match(result.errors.join('\n'), /footerId must be mandatory_honest_framing/);
  assert.match(result.errors.join('\n'), /asset id "missing_background"/);
});

test('content JSON files parse as part of the public contract', () => {
  for (const path of ['content/CONTENT_SCHEMA.json', 'content/SOURCE_INDEX.json']) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(path, 'utf8')), `${path} should parse`);
  }
});
