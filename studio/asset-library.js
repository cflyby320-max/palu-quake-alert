// Fail-closed loader for local, indexed, textless Design SDK assets.
//
// Candidate assets may be loaded for review artifacts. Production renderers
// must additionally require committed + approved metadata before integration.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ASSET_INDEX_URL = new URL('../design/ASSET_INDEX.json', import.meta.url);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_ROOT = resolve(REPO_ROOT, 'design', 'assets');
const ALLOWED_REVIEW_STATUSES = new Set(['candidate', 'committed']);

export const ASSET_BANK_REVIEW_IDS = [
  'pat_ground_contours',
  'pat_preparedness_route_grid',
  'pat_information_source_trail',
  'icon_route_high_ground',
  'icon_action_drop',
  'icon_action_cover',
  'icon_action_hold',
  'icon_verify_stop',
  'icon_verify_source',
  'icon_verify_share',
  'ill_preparedness_go_bag_flatlay',
];

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function insideAssetRoot(path) {
  const rel = relative(ASSET_ROOT, path);
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel);
}

function validateSvg(svg, assetId) {
  const forbidden = [
    [/<text\b/i, 'text elements'],
    [/<foreignObject\b/i, 'foreignObject'],
    [/<script\b/i, 'scripts'],
    [/<image\b/i, 'embedded images'],
    [/\b(?:href|xlink:href)\s*=/i, 'external references'],
    [/\burl\s*\(/i, 'URL references'],
  ];

  if (!/<svg\b/i.test(svg) || !/\bviewBox\s*=/i.test(svg)) {
    throw new Error(`asset "${assetId}" must be an SVG with a viewBox`);
  }
  for (const [pattern, label] of forbidden) {
    if (pattern.test(svg)) throw new Error(`asset "${assetId}" contains forbidden ${label}`);
  }
}

export function loadAssetIndex({ url = ASSET_INDEX_URL } = {}) {
  const index = readJson(url);
  return { source: 'design/ASSET_INDEX.json', index };
}

export function loadLocalSvgAsset(assetId, { index = loadAssetIndex().index } = {}) {
  const asset = (index.assets || []).find((entry) => entry.id === assetId);
  if (!asset) throw new Error(`asset "${assetId}" is not indexed`);
  if (!ALLOWED_REVIEW_STATUSES.has(asset.status)) {
    throw new Error(`asset "${assetId}" is not available for local review`);
  }
  if (asset.textPolicy !== 'textless') {
    throw new Error(`asset "${assetId}" is not declared textless`);
  }
  if (asset.safetyReview !== 'pending' && asset.safetyReview !== 'approved') {
    throw new Error(`asset "${assetId}" has invalid safety review state`);
  }
  if (!asset.path?.startsWith('design/assets/')) {
    throw new Error(`asset "${assetId}" is outside the production asset library`);
  }

  const absolutePath = resolve(REPO_ROOT, asset.path);
  if (!insideAssetRoot(absolutePath)) {
    throw new Error(`asset "${assetId}" resolves outside design/assets`);
  }

  const svg = readFileSync(absolutePath, 'utf8');
  validateSvg(svg, assetId);
  const sha256 = createHash('sha256').update(svg).digest('hex').toUpperCase();
  if (sha256 !== asset.sha256) {
    throw new Error(`asset "${assetId}" checksum does not match ASSET_INDEX.json`);
  }

  return {
    asset,
    absolutePath,
    svg,
    dataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  };
}
