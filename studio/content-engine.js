// Phase 5A: pure content-decision -> render-spec bridge.
//
// This module does not render, publish, call AI, or touch the safety watcher.
// It converts a structured content decision into the render contract and then
// delegates validation to the template registry gate.

import { readFileSync } from 'node:fs';
import { DESIGN_TOKENS } from './design-sdk.js';
import { TEMPLATE_REGISTRY, validateRenderSpec } from './template-registry.js';

export const SOURCE_INDEX_URL = new URL('../content/SOURCE_INDEX.json', import.meta.url);
export const CONTENT_SCHEMA_URL = new URL('../content/CONTENT_SCHEMA.json', import.meta.url);

const FALLBACK_SOURCE_INDEX = {
  sources: [
    { id: 'bmkg', label: 'BMKG / InaTEWS' },
    { id: 'bnpb', label: 'BNPB' },
    { id: 'bpbd_sulteng', label: 'BPBD Sulawesi Tengah' },
    { id: 'usgs', label: 'USGS' },
    { id: 'project_safety_rules', label: 'Palu Earthquake Alerts safety rules' },
  ],
};

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function loadSourceIndex({ url = SOURCE_INDEX_URL } = {}) {
  try {
    return { source: 'content/SOURCE_INDEX.json', index: readJson(url) };
  } catch (e) {
    return { source: 'fallback', reason: e.message, index: FALLBACK_SOURCE_INDEX };
  }
}

export function loadContentSchema({ url = CONTENT_SCHEMA_URL } = {}) {
  try {
    return { source: 'content/CONTENT_SCHEMA.json', schema: readJson(url) };
  } catch (e) {
    return { source: 'missing', reason: e.message, schema: null };
  }
}

export const SOURCE_INDEX = loadSourceIndex();
export const CONTENT_SCHEMA = loadContentSchema();

function sourceIdSet(sourceIndex) {
  return new Set((sourceIndex.sources || []).map((source) => source.id));
}

function firstAllowedExportTarget(template, fallback = 'instagram_feed') {
  return template?.exportTargets?.[0] || fallback;
}

function validateContentDecisionShape(decision, schema, errors) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    errors.push('content decision must be an object');
    return false;
  }

  for (const field of schema?.forbiddenFields || []) {
    if (field in decision) errors.push(`${field} is forbidden; use the Phase 5 content schema`);
  }

  if (decision.schemaVersion !== schema?.schemaVersion) {
    errors.push(`schemaVersion must be ${schema?.schemaVersion || '1.0.0'}`);
  }
  if (!decision.templateId) errors.push('templateId is required');
  if (!decision.pillarId) errors.push('pillarId is required');
  if (!Array.isArray(decision.sourceIds) || decision.sourceIds.length === 0) {
    errors.push('sourceIds must include at least one source');
  }
  if (decision.sourceIds?.some((sourceId) => typeof sourceId !== 'string' || !sourceId.trim())) {
    errors.push('sourceIds must contain non-empty strings');
  }
  if (!decision.reviewStatus) errors.push('reviewStatus is required');
  if (!decision.content || typeof decision.content !== 'object' || Array.isArray(decision.content)) {
    errors.push('content must be an object');
  }

  return errors.length === 0;
}

function validateKnownSources(sourceIds, sourceIndex, errors) {
  const knownSources = sourceIdSet(sourceIndex);
  for (const sourceId of sourceIds || []) {
    if (!knownSources.has(sourceId)) errors.push(`sourceId "${sourceId}" is not defined in SOURCE_INDEX.json`);
  }
}

export function buildRenderSpecFromContentDecision(
  decision,
  {
    registry = TEMPLATE_REGISTRY.registry,
    tokens = DESIGN_TOKENS,
    assetIndex,
    sourceIndex = SOURCE_INDEX.index,
    contentSchema = CONTENT_SCHEMA.schema,
  } = {}
) {
  const errors = [];
  validateContentDecisionShape(decision, contentSchema, errors);
  validateKnownSources(decision?.sourceIds, sourceIndex, errors);

  const template = registry.templates?.[decision?.templateId];
  const renderSpec = decision && typeof decision === 'object' && !Array.isArray(decision)
    ? {
        schemaVersion: registry.renderSpecSchemaVersion,
        templateId: decision.templateId,
        exportTarget: decision.exportTarget || firstAllowedExportTarget(template),
        language: decision.language || registry.rules?.language || 'id',
        timezone: decision.timezone || registry.rules?.timezone || 'Asia/Makassar',
        knowledge: {
          pillarId: decision.pillarId,
          sourceIds: decision.sourceIds,
          reviewStatus: decision.reviewStatus,
        },
        assets: decision.assets || {},
        content: decision.content,
        footerId: decision.footerId || registry.rules?.defaultFooterId || 'mandatory_honest_framing',
      }
    : null;

  if (!renderSpec) return { ok: false, renderSpec: null, errors };

  const renderValidation = validateRenderSpec(renderSpec, { registry, tokens, ...(assetIndex ? { assetIndex } : {}) });
  errors.push(...renderValidation.errors);

  return {
    ok: errors.length === 0,
    renderSpec,
    errors,
  };
}
