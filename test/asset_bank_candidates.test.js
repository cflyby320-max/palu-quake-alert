// Asset Bank Sprint 1 candidate integrity tests.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSET_BANK_REVIEW_IDS,
  loadAssetIndex,
  loadLocalSvgAsset,
} from '../studio/asset-library.js';
import { FEED_CANVAS } from '../studio/design-sdk.js';

const REVIEW_DIR = 'studio/outbox/asset-bank-review-2';
const EXTERNAL_REPLACEMENT_IDS = new Set([
  'icon_action_drop',
  'icon_action_cover',
  'icon_action_hold',
  'ill_preparedness_go_bag_flatlay',
]);
const FORBIDDEN_SVG = [
  /<text\b/i,
  /<foreignObject\b/i,
  /<script\b/i,
  /<image\b/i,
  /\b(?:href|xlink:href)\s*=/i,
  /\burl\s*\(/i,
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pngSize(path) {
  const buffer = readFileSync(path);
  return {
    signature: buffer.subarray(0, 8).toString('hex'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('Asset Bank Sprint 1 registers exactly 11 approved assets', () => {
  const { index } = loadAssetIndex();
  const candidates = index.assets.filter((asset) => ASSET_BANK_REVIEW_IDS.includes(asset.id));

  assert.equal(candidates.length, 11);
  assert.deepEqual(candidates.map(({ id }) => id), ASSET_BANK_REVIEW_IDS);
  for (const asset of candidates) {
    assert.equal(asset.status, 'committed');
    assert.equal(asset.safetyReview, 'approved');
    assert.equal(asset.textPolicy, 'textless');
    assert.equal(
      asset.sourceType,
      EXTERNAL_REPLACEMENT_IDS.has(asset.id) ? 'public_domain' : 'project_original'
    );
    assert.equal(asset.usageScope, 'planned_library');
    assert.ok(asset.rightsNote);
    assert.ok(asset.pillarId);
    assert.ok(asset.allowedTemplateIds.length > 0);
    assert.ok(asset.path.startsWith('design/assets/'));
    if (EXTERNAL_REPLACEMENT_IDS.has(asset.id)) {
      assert.match(asset.sourceUrl, /^https:\/\/www\.svgrepo\.com\/svg\//);
      assert.equal(asset.licenseId, 'CC0-1.0');
      assert.equal(asset.licenseUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
      assert.ok(asset.adaptationNote);
    }
  }
});

test('approved Asset Bank SVGs are local, textless, self-contained, and checksummed', () => {
  for (const id of ASSET_BANK_REVIEW_IDS) {
    const loaded = loadLocalSvgAsset(id);
    const sha256 = createHash('sha256').update(loaded.svg).digest('hex').toUpperCase();

    assert.match(loaded.svg, /<svg\b/i);
    assert.match(loaded.svg, /\bviewBox\s*=/i);
    assert.equal(sha256, loaded.asset.sha256);
    assert.match(loaded.dataUri, /^data:image\/svg\+xml;base64,/);
    for (const forbidden of FORBIDDEN_SVG) {
      assert.equal(forbidden.test(loaded.svg), false, `${id} contains ${forbidden}`);
    }
  }
});

test('local asset loader fails closed for unsafe metadata', () => {
  const { index } = loadAssetIndex();
  const base = index.assets.find((asset) => asset.id === 'icon_route_high_ground');

  assert.throws(
    () => loadLocalSvgAsset(base.id, {
      index: { assets: [{ ...base, path: 'docs/assets/avatar.svg' }] },
    }),
    /outside the production asset library/
  );
  assert.throws(
    () => loadLocalSvgAsset(base.id, {
      index: { assets: [{ ...base, textPolicy: 'renderer_text_only' }] },
    }),
    /not declared textless/
  );
  assert.throws(
    () => loadLocalSvgAsset(base.id, {
      index: { assets: [{ ...base, sha256: '0'.repeat(64) }] },
    }),
    /checksum does not match/
  );
});

test('asset review outbox contains only the manifest and contact sheet pair', () => {
  const manifest = readJson(join(REVIEW_DIR, 'manifest.json'));
  const files = readdirSync(REVIEW_DIR).sort();
  const png = pngSize(join(REVIEW_DIR, 'contact-sheet.png'));
  const svg = readFileSync(join(REVIEW_DIR, 'contact-sheet.svg'), 'utf8');

  assert.deepEqual(files, ['contact-sheet.png', 'contact-sheet.svg', 'manifest.json']);
  assert.equal(manifest.batchType, 'asset_candidate_review');
  assert.equal(manifest.publicationStatus, 'candidate_approval_required');
  assert.deepEqual(manifest.candidateAssetIds, ASSET_BANK_REVIEW_IDS);
  assert.equal(manifest.rules.noProductionIntegration, true);
  assert.equal(manifest.rules.humanApprovalRequired, true);
  assert.equal(png.signature, '89504e470d0a1a0a');
  assert.equal(png.width, FEED_CANVAS.width);
  assert.equal(png.height, FEED_CANVAS.height);
  assert.match(svg, /TEXTLESS \/ LOCAL \/ NOT IN PRODUCTION/);
});

test('approved asset IDs remain absent until educational renderer integration', () => {
  const previewDir = 'studio/outbox/educational-render-preview-2';
  const topicDirs = readdirSync(previewDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const topicDir of topicDirs) {
    const decision = readJson(join(previewDir, topicDir, 'render-decision.json'));
    const serializedAssets = JSON.stringify(decision.renderSpec.assets || {});
    for (const id of ASSET_BANK_REVIEW_IDS) {
      assert.equal(serializedAssets.includes(id), false, `${topicDir} prematurely uses ${id}`);
    }
  }
});
