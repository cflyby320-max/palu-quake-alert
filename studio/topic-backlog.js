// Phase 5B: pure topic backlog helpers.
//
// This module supports manual planning only. It does not render, publish,
// call external APIs, update topic usage, or import the safety watcher.

import { readFileSync } from 'node:fs';
import { buildRenderSpecFromContentDecision } from './content-engine.js';

export const TOPIC_BACKLOG_URL = new URL('../content/topic_backlog.json', import.meta.url);

const EMPTY_BACKLOG = {
  schemaVersion: '1.0.0',
  topics: [],
};

const ALLOWED_STATUSES = new Set(['ready', 'draft', 'paused', 'retired']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function loadTopicBacklog({ url = TOPIC_BACKLOG_URL } = {}) {
  try {
    return { source: 'content/topic_backlog.json', backlog: readJson(url) };
  } catch (e) {
    return { source: 'missing', reason: e.message, backlog: EMPTY_BACKLOG };
  }
}

export const TOPIC_BACKLOG = loadTopicBacklog();

function topicsFrom(backlogOrTopics) {
  if (Array.isArray(backlogOrTopics)) return backlogOrTopics;
  return Array.isArray(backlogOrTopics?.topics) ? backlogOrTopics.topics : [];
}

function dateOnlyMs(value) {
  if (value instanceof Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function daysSince(lastUsed, now) {
  const lastMs = dateOnlyMs(lastUsed);
  const nowMs = dateOnlyMs(now);
  if (lastMs === null || nowMs === null) return null;
  return Math.floor((nowMs - lastMs) / MS_PER_DAY);
}

function isReusable(topic, now) {
  if (!topic.last_used) return true;
  const elapsedDays = daysSince(topic.last_used, now);
  if (elapsedDays === null) return false;
  return elapsedDays >= Number(topic.reuse_after_days || 0);
}

function validateTopic(topic, index, errors) {
  const label = topic?.id || `topics[${index}]`;

  if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
    errors.push(`topics[${index}] must be an object`);
    return;
  }

  if (typeof topic.id !== 'string' || !topic.id.trim()) {
    errors.push(`topics[${index}].id is required`);
  }
  if (!ALLOWED_STATUSES.has(topic.status)) {
    errors.push(`${label}.status must be ready, draft, paused, or retired`);
  }
  if (!Number.isInteger(topic.priority) || topic.priority < 1 || topic.priority > 3) {
    errors.push(`${label}.priority must be an integer from 1 to 3`);
  }
  if (typeof topic.pillarId !== 'string' || !topic.pillarId.trim()) {
    errors.push(`${label}.pillarId is required`);
  }
  if (!Number.isInteger(topic.reuse_after_days) || topic.reuse_after_days < 0) {
    errors.push(`${label}.reuse_after_days must be a non-negative integer`);
  }
  if (topic.last_used !== null && topic.last_used !== undefined && dateOnlyMs(topic.last_used) === null) {
    errors.push(`${label}.last_used must be YYYY-MM-DD or null`);
  }
  if (topic.approval !== 'human_required') {
    errors.push(`${label}.approval must be human_required`);
  }
  if (!topic.decision || typeof topic.decision !== 'object' || Array.isArray(topic.decision)) {
    errors.push(`${label}.decision is required`);
    return;
  }
  if ('layoutId' in topic.decision || 'layout_id' in topic.decision) {
    errors.push(`${label}.decision must use templateId, not layoutId or layout_id`);
  }
  if (topic.decision.pillarId !== topic.pillarId) {
    errors.push(`${label}.decision.pillarId must match topic.pillarId`);
  }

  const result = buildRenderSpecFromContentDecision(topic.decision);
  if (topic.status === 'ready' && !result.ok) {
    errors.push(`${label}.decision must build a valid render spec: ${result.errors.join('; ')}`);
  }
}

export function validateTopicBacklog(backlog = TOPIC_BACKLOG.backlog) {
  const errors = [];

  if (!backlog || typeof backlog !== 'object' || Array.isArray(backlog)) {
    return { ok: false, errors: ['topic backlog must be an object'] };
  }
  if (backlog.schemaVersion !== '1.0.0') {
    errors.push('schemaVersion must be 1.0.0');
  }
  if (!Array.isArray(backlog.topics)) {
    errors.push('topics must be an array');
  }

  const seenIds = new Set();
  for (const [index, topic] of topicsFrom(backlog).entries()) {
    if (topic?.id) {
      if (seenIds.has(topic.id)) errors.push(`topic id "${topic.id}" must be unique`);
      seenIds.add(topic.id);
    }
    validateTopic(topic, index, errors);
  }

  return { ok: errors.length === 0, errors };
}

export function selectEligibleTopics(
  backlogOrTopics = TOPIC_BACKLOG.backlog,
  {
    status = 'ready',
    priority,
    maxPriority,
    pillarId,
    now = new Date(),
  } = {}
) {
  const statusSet = status == null
    ? null
    : new Set(Array.isArray(status) ? status : [status]);

  return topicsFrom(backlogOrTopics)
    .filter((topic) => {
      if (statusSet && !statusSet.has(topic.status)) return false;
      if (priority !== undefined && topic.priority !== priority) return false;
      if (maxPriority !== undefined && topic.priority > maxPriority) return false;
      if (pillarId !== undefined && topic.pillarId !== pillarId) return false;
      return isReusable(topic, now);
    })
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (!a.last_used && b.last_used) return -1;
      if (a.last_used && !b.last_used) return 1;
      return a.id.localeCompare(b.id);
    });
}

