// Phase 3 template registry tests. These are pure validation checks: no
// rasteriser, no network, no prompts, no production alert behavior.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DESIGN_TOKENS } from '../studio/design-sdk.js';
import {
  ASSET_INDEX,
  TEMPLATE_REGISTRY,
  getTemplateSpec,
  validateRenderSpec,
} from '../studio/template-registry.js';

const VALID_EDITORIAL_SPEC = {
  schemaVersion: '1.0.0',
  templateId: 'editorial_steps',
  exportTarget: 'instagram_feed',
  language: 'id',
  timezone: 'Asia/Makassar',
  knowledge: {
    pillarId: 'preparedness',
    sourceIds: ['bnpb'],
    reviewStatus: 'verified',
  },
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
  footerId: 'mandatory_honest_framing',
};

test('template registry loads and stays aligned with DESIGN_TOKENS template IDs', () => {
  assert.equal(TEMPLATE_REGISTRY.source, 'design/TEMPLATE_REGISTRY.json');
  assert.equal(ASSET_INDEX.source, 'design/ASSET_INDEX.json');

  const tokenIds = Object.keys(DESIGN_TOKENS.templates).sort();
  const registryIds = Object.keys(TEMPLATE_REGISTRY.registry.templates).sort();
  assert.deepEqual(registryIds, tokenIds);

  for (const id of ['quake_alert_card', 'editorial_steps', 'checklist_card', 'poster_statement', 'story_card', 'carousel_cover', 'carousel_slide']) {
    assert.ok(getTemplateSpec(id), `${id} should exist`);
  }
});

test('render-spec validator accepts a structured editorial template spec', () => {
  const result = validateRenderSpec(VALID_EDITORIAL_SPEC);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.template.family, 'editorial');
});

test('render-spec validator rejects unknown IDs and unsafe publication state', () => {
  const invalid = {
    ...VALID_EDITORIAL_SPEC,
    exportTarget: 'story_9_16',
    footerId: 'wrong_footer',
    knowledge: {
      pillarId: 'unknown_pillar',
      reviewStatus: 'draft',
    },
    assets: {
      backgroundId: 'missing_background',
    },
    content: {
      kicker: 'Siap Sebelum Bencana',
      title: 'Tidak cukup struktur',
      rows: [{ label: 'Satu' }],
    },
  };

  const result = validateRenderSpec(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exportTarget "story_9_16" is not allowed/);
  assert.match(result.errors.join('\n'), /footerId must be mandatory_honest_framing/);
  assert.match(result.errors.join('\n'), /knowledge.reviewStatus must be verified/);
  assert.match(result.errors.join('\n'), /knowledge.pillarId "unknown_pillar"/);
  assert.match(result.errors.join('\n'), /asset id "missing_background"/);
  assert.match(result.errors.join('\n'), /content.rows must contain 2-4 items/);
});

test('render-spec validator requires source IDs for verified-source templates', () => {
  const missingSources = {
    ...VALID_EDITORIAL_SPEC,
    knowledge: {
      pillarId: 'preparedness',
      reviewStatus: 'verified',
    },
  };
  const emptySources = {
    ...VALID_EDITORIAL_SPEC,
    knowledge: {
      pillarId: 'preparedness',
      sourceIds: [],
      reviewStatus: 'verified',
    },
  };
  const blankSource = {
    ...VALID_EDITORIAL_SPEC,
    knowledge: {
      pillarId: 'preparedness',
      sourceIds: [' '],
      reviewStatus: 'verified',
    },
  };

  assert.match(validateRenderSpec(missingSources).errors.join('\n'), /sourceIds must include/);
  assert.match(validateRenderSpec(emptySources).errors.join('\n'), /sourceIds must include/);
  assert.match(validateRenderSpec(blankSource).errors.join('\n'), /sourceIds must contain non-empty strings/);
});
