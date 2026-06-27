// Pure helpers for Phase 3 render-spec validation.
//
// This module reads the Design SDK template registry, but it does not render
// anything and is not imported by the safety watcher. It gives future Studio
// flows a narrow gate before a structured render spec reaches a renderer.

import { readFileSync } from 'node:fs';
import { DESIGN_TOKENS } from './design-sdk.js';

export const TEMPLATE_REGISTRY_URL = new URL('../design/TEMPLATE_REGISTRY.json', import.meta.url);
export const ASSET_INDEX_URL = new URL('../design/ASSET_INDEX.json', import.meta.url);

const FALLBACK_REGISTRY = {
  schemaVersion: '1.0.0',
  renderSpecSchemaVersion: '1.0.0',
  rules: {
    language: 'id',
    timezone: 'Asia/Makassar',
    defaultFooterId: 'mandatory_honest_framing',
    requiresVerifiedReview: true,
  },
  templates: {
    quake_alert_card: {
      status: 'current',
      exportTargets: ['instagram_feed', 'telegram_image'],
      requiredFooterId: 'mandatory_honest_framing',
      requiresVerifiedReview: true,
      contentShape: { source: 'MergedEvent from src/core.js' },
    },
  },
};

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function loadTemplateRegistry({ url = TEMPLATE_REGISTRY_URL } = {}) {
  try {
    return { source: 'design/TEMPLATE_REGISTRY.json', registry: readJson(url) };
  } catch (e) {
    return { source: 'fallback', reason: e.message, registry: FALLBACK_REGISTRY };
  }
}

export function loadAssetIndex({ url = ASSET_INDEX_URL } = {}) {
  try {
    return { source: 'design/ASSET_INDEX.json', index: readJson(url) };
  } catch (e) {
    return { source: 'fallback', reason: e.message, index: { assets: [] } };
  }
}

export const TEMPLATE_REGISTRY = loadTemplateRegistry();
export const ASSET_INDEX = loadAssetIndex();

export function getTemplateSpec(templateId, registry = TEMPLATE_REGISTRY.registry) {
  return registry.templates?.[templateId] || null;
}

function indexedAssetIds(assetIndex) {
  return new Set((assetIndex.assets || []).map((asset) => asset.id));
}

function collectAssetIds(assets = {}) {
  const ids = [];
  for (const key of ['backgroundId', 'foregroundId', 'mapId', 'referenceAssetId']) {
    if (assets[key]) ids.push(assets[key]);
  }
  for (const key of ['illustrationIds', 'objectIds', 'iconIds', 'patternIds', 'referenceAssetIds']) {
    if (Array.isArray(assets[key])) ids.push(...assets[key]);
  }
  for (const value of Object.values(assets.slots || {})) {
    if (Array.isArray(value)) ids.push(...value);
    else if (value) ids.push(value);
  }
  return ids;
}

function validateAssetSlots(spec, template, assetIndex, errors) {
  const assignedSlots = spec.assets?.slots;
  if (assignedSlots === undefined) return;
  if (!assignedSlots || typeof assignedSlots !== 'object' || Array.isArray(assignedSlots)) {
    errors.push('assets.slots must be an object');
    return;
  }

  const slotSpecs = new Map((template.assetSlots || []).map((slot) => [slot.id, slot]));
  const indexedAssets = new Map((assetIndex.assets || []).map((asset) => [asset.id, asset]));

  for (const [slotId, assigned] of Object.entries(assignedSlots)) {
    const slot = slotSpecs.get(slotId);
    if (!slot) {
      errors.push(`asset slot "${slotId}" is not allowed for ${spec.templateId}`);
      continue;
    }

    const ids = Array.isArray(assigned) ? assigned : [assigned];
    if (ids.length === 0 || ids.some((assetId) => typeof assetId !== 'string' || !assetId.trim())) {
      errors.push(`asset slot "${slotId}" must contain non-empty asset IDs`);
      continue;
    }
    if (!slot.multiple && ids.length > 1) {
      errors.push(`asset slot "${slotId}" accepts only one asset`);
    }
    if (slot.maxItems && ids.length > slot.maxItems) {
      errors.push(`asset slot "${slotId}" accepts at most ${slot.maxItems} assets`);
    }
    if (slotId === 'row_icons' && Array.isArray(spec.content?.rows) && ids.length !== spec.content.rows.length) {
      errors.push(`asset slot "row_icons" must contain one icon per content row`);
    }

    for (const assetId of ids) {
      const asset = indexedAssets.get(assetId);
      if (!asset) continue;
      if (asset.status !== 'committed' || asset.safetyReview !== 'approved') {
        errors.push(`asset "${assetId}" is not committed and approved`);
      }
      if (slot.textless && asset.textPolicy !== 'textless') {
        errors.push(`asset "${assetId}" must be textless in slot "${slotId}"`);
      }
      if (!slot.allowedTypes?.includes(asset.type)) {
        errors.push(`asset "${assetId}" type "${asset.type}" is not allowed in slot "${slotId}"`);
      }
      if (!asset.allowedTemplateIds?.includes(spec.templateId)) {
        errors.push(`asset "${assetId}" is not approved for template "${spec.templateId}"`);
      }
      if (asset.pillarId && asset.pillarId !== spec.knowledge?.pillarId) {
        errors.push(`asset "${assetId}" is not approved for pillar "${spec.knowledge?.pillarId}"`);
      }
    }
  }
}

function validateContentShape(content, shape, errors) {
  if (!shape || shape.source) return;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    errors.push('content must be an object');
    return;
  }

  for (const field of shape.required || []) {
    if (!(field in content)) errors.push(`content.${field} is required`);
  }

  for (const collectionName of ['rows', 'items']) {
    const rule = shape[collectionName];
    if (!rule || !(collectionName in content)) continue;
    const value = content[collectionName];
    if (!Array.isArray(value)) {
      errors.push(`content.${collectionName} must be an array`);
      continue;
    }
    if (value.length < rule.min || value.length > rule.max) {
      errors.push(`content.${collectionName} must contain ${rule.min}-${rule.max} items`);
    }
    for (const [index, item] of value.entries()) {
      for (const field of rule.requiredFields || []) {
        if (!item || !(field in item)) {
          errors.push(`content.${collectionName}[${index}].${field} is required`);
        }
      }
    }
  }
}

function requiresVerifiedSources(template) {
  return (template.safetyChecks || []).includes('verified_sources');
}

function validateSourceIds(spec, template, errors) {
  if (!requiresVerifiedSources(template)) return;
  if (!Array.isArray(spec.knowledge?.sourceIds) || spec.knowledge.sourceIds.length === 0) {
    errors.push('knowledge.sourceIds must include at least one verified source');
    return;
  }
  if (spec.knowledge.sourceIds.some((sourceId) => typeof sourceId !== 'string' || !sourceId.trim())) {
    errors.push('knowledge.sourceIds must contain non-empty strings');
  }
}

export function validateRenderSpec(
  spec,
  {
    registry = TEMPLATE_REGISTRY.registry,
    assetIndex = ASSET_INDEX.index,
    tokens = DESIGN_TOKENS,
  } = {}
) {
  const errors = [];

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { ok: false, errors: ['render spec must be an object'], template: null };
  }

  if (spec.schemaVersion !== registry.renderSpecSchemaVersion) {
    errors.push(`schemaVersion must be ${registry.renderSpecSchemaVersion}`);
  }

  const template = getTemplateSpec(spec.templateId, registry);
  if (!template) {
    errors.push(`templateId "${spec.templateId}" is not in TEMPLATE_REGISTRY.json`);
  } else {
    if (!template.exportTargets?.includes(spec.exportTarget)) {
      errors.push(`exportTarget "${spec.exportTarget}" is not allowed for ${spec.templateId}`);
    }
    if (spec.footerId !== template.requiredFooterId) {
      errors.push(`footerId must be ${template.requiredFooterId}`);
    }
    if (template.requiresVerifiedReview && spec.knowledge?.reviewStatus !== 'verified') {
      errors.push('knowledge.reviewStatus must be verified');
    }
    validateSourceIds(spec, template, errors);
    validateContentShape(spec.content, template.contentShape, errors);
    validateAssetSlots(spec, template, assetIndex, errors);
  }

  if (spec.language !== registry.rules?.language) {
    errors.push(`language must be ${registry.rules?.language}`);
  }
  if (spec.timezone !== registry.rules?.timezone) {
    errors.push(`timezone must be ${registry.rules?.timezone}`);
  }

  const footerExists = Boolean(tokens.footers?.[spec.footerId]);
  if (spec.footerId && !footerExists) errors.push(`footerId "${spec.footerId}" is not defined in DESIGN_TOKENS.json`);

  const pillarId = spec.knowledge?.pillarId;
  if (pillarId && tokens.pillars && !tokens.pillars[pillarId]) {
    errors.push(`knowledge.pillarId "${pillarId}" is not defined in DESIGN_TOKENS.json`);
  }

  const knownAssets = indexedAssetIds(assetIndex);
  for (const assetId of collectAssetIds(spec.assets)) {
    if (!knownAssets.has(assetId)) {
      errors.push(`asset id "${assetId}" is not defined in ASSET_INDEX.json`);
    }
  }

  return { ok: errors.length === 0, errors, template };
}
