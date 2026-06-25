// Phase 4A asset library integrity tests. These keep the asset registry
// machine-readable before any production asset pack exists.

import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const assetIndex = JSON.parse(readFileSync('design/ASSET_INDEX.json', 'utf8'));
const assetSchema = JSON.parse(readFileSync('design/ASSET_SCHEMA.json', 'utf8'));
const templateRegistry = JSON.parse(readFileSync('design/TEMPLATE_REGISTRY.json', 'utf8'));

const templateIds = new Set(Object.keys(templateRegistry.templates));
const assetTypes = new Set(assetSchema.assetTypes);
const statuses = new Set(assetSchema.statuses);
const sourceTypes = new Set(assetSchema.sourceTypes);
const usageScopes = new Set(assetSchema.usageScopes);
const safetyReviews = new Set(assetSchema.safetyReview);

test('asset schema and index JSON define the Phase 4A library roots', () => {
  assert.equal(assetIndex.schema, 'design/ASSET_SCHEMA.json');
  assert.equal(assetIndex.libraryRoot, 'design/assets');
  assert.ok(existsSync(assetIndex.libraryRoot));

  for (const folder of Object.values(assetIndex.libraryFolders)) {
    assert.ok(existsSync(folder), `${folder} should exist`);
  }
});

test('asset IDs are unique and indexed assets match the approved taxonomy', () => {
  const ids = new Set();
  for (const asset of assetIndex.assets) {
    assert.ok(!ids.has(asset.id), `${asset.id} should be unique`);
    ids.add(asset.id);
    assert.ok(assetTypes.has(asset.type), `${asset.id} has unknown type ${asset.type}`);
    assert.ok(statuses.has(asset.status), `${asset.id} has unknown status ${asset.status}`);
    assert.ok(sourceTypes.has(asset.sourceType), `${asset.id} has unknown sourceType ${asset.sourceType}`);
    assert.ok(usageScopes.has(asset.usageScope), `${asset.id} has unknown usageScope ${asset.usageScope}`);
    assert.ok(safetyReviews.has(asset.safetyReview), `${asset.id} has unknown safetyReview ${asset.safetyReview}`);
  }
});

test('planned asset categories use approved types, statuses, and folders', () => {
  for (const category of assetIndex.plannedAssetCategories) {
    assert.ok(assetTypes.has(category.type), `${category.id} has unknown type ${category.type}`);
    assert.ok(statuses.has(category.status), `${category.id} has unknown status ${category.status}`);
    assert.ok(usageScopes.has(category.usageScope), `${category.id} has unknown usageScope ${category.usageScope}`);
    if (category.folder) assert.ok(existsSync(category.folder), `${category.folder} should exist`);
  }
});

test('committed assets have paths, checksums, and dimensions where needed', () => {
  for (const asset of assetIndex.assets.filter((item) => item.status.startsWith('committed'))) {
    assert.ok(asset.path, `${asset.id} should have a path`);
    assert.ok(existsSync(asset.path), `${asset.path} should exist`);
    assert.match(asset.sha256, /^[A-F0-9]{64}$/, `${asset.id} should have a SHA-256 checksum`);

    if (['.png', '.jpg', '.jpeg', '.webp'].includes(extname(asset.path).toLowerCase())) {
      assert.ok(Number.isInteger(asset.width) && asset.width > 0, `${asset.id} should have width`);
      assert.ok(Number.isInteger(asset.height) && asset.height > 0, `${asset.id} should have height`);
    }
  }
});

test('asset template references resolve to TEMPLATE_REGISTRY IDs', () => {
  for (const asset of assetIndex.assets) {
    if (asset.templateId) {
      assert.ok(templateIds.has(asset.templateId), `${asset.id} templateId should exist`);
    }
    for (const templateId of asset.allowedTemplateIds || []) {
      assert.ok(templateIds.has(templateId), `${asset.id} allowed template ${templateId} should exist`);
    }
  }
});

test('future production image assets are required to stay textless', () => {
  const imageTypes = new Set(['background', 'illustration', 'character', 'icon', 'object', 'pattern', 'photo', 'logo', 'severity_badge']);
  for (const asset of assetIndex.assets) {
    if (!imageTypes.has(asset.type)) continue;
    assert.equal(asset.textPolicy, 'textless', `${asset.id} should not bake text into production imagery`);
  }
});
