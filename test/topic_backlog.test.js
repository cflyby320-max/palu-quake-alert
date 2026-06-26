// Phase 5B topic backlog tests. These verify the planning workflow remains
// schema-led, human-approved, and disconnected from rendering or posting.

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRenderSpecFromContentDecision } from '../studio/content-engine.js';
import {
  TOPIC_BACKLOG,
  selectEligibleTopics,
  validateTopicBacklog,
} from '../studio/topic-backlog.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function topicIds(topics) {
  return topics.map((topic) => topic.id);
}

test('topic backlog JSON parses and validates as a planning contract', () => {
  for (const path of [
    'content/CONTENT_SCHEMA.json',
    'content/SOURCE_INDEX.json',
    'content/topic_backlog.json',
  ]) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(path, 'utf8')), `${path} should parse`);
  }

  assert.equal(TOPIC_BACKLOG.source, 'content/topic_backlog.json');
  const result = validateTopicBacklog(TOPIC_BACKLOG.backlog);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('topic backlog keeps unique IDs and human approval defaults', () => {
  const ids = topicIds(TOPIC_BACKLOG.backlog.topics);
  assert.equal(new Set(ids).size, ids.length);

  for (const topic of TOPIC_BACKLOG.backlog.topics) {
    assert.equal(topic.approval, 'human_required');
    assert.equal(topic.decision.pillarId, topic.pillarId);
    assert.equal('layoutId' in topic.decision, false);
    assert.equal('layout_id' in topic.decision, false);
  }
});

test('ready backlog topics build render specs through the Phase 5A content engine', () => {
  const readyTopics = TOPIC_BACKLOG.backlog.topics.filter((topic) => topic.status === 'ready');
  assert.ok(readyTopics.length > 0);

  for (const topic of readyTopics) {
    const result = buildRenderSpecFromContentDecision(topic.decision);
    assert.equal(result.ok, true, `${topic.id}: ${result.errors.join('; ')}`);
    assert.equal(result.renderSpec.footerId, 'mandatory_honest_framing');
    assert.equal(result.renderSpec.knowledge.reviewStatus, 'verified');
    assert.ok(result.renderSpec.knowledge.sourceIds.length > 0);
  }
});

test('topic backlog validation rejects missing or unknown source IDs', () => {
  const missingSources = clone(TOPIC_BACKLOG.backlog);
  missingSources.topics = [
    {
      ...clone(TOPIC_BACKLOG.backlog.topics[0]),
      id: 'invalid_missing_sources',
      decision: {
        ...clone(TOPIC_BACKLOG.backlog.topics[0].decision),
        sourceIds: [],
      },
    },
  ];

  const missingResult = validateTopicBacklog(missingSources);
  assert.equal(missingResult.ok, false);
  assert.match(missingResult.errors.join('\n'), /sourceIds must include at least one source/);

  const unknownSources = clone(TOPIC_BACKLOG.backlog);
  unknownSources.topics = [
    {
      ...clone(TOPIC_BACKLOG.backlog.topics[0]),
      id: 'invalid_unknown_source',
      decision: {
        ...clone(TOPIC_BACKLOG.backlog.topics[0].decision),
        sourceIds: ['not_a_source'],
      },
    },
  ];

  const unknownResult = validateTopicBacklog(unknownSources);
  assert.equal(unknownResult.ok, false);
  assert.match(unknownResult.errors.join('\n'), /sourceId "not_a_source" is not defined/);
});

test('topic backlog validation rejects legacy layout fields', () => {
  const invalid = clone(TOPIC_BACKLOG.backlog);
  invalid.topics = [
    {
      ...clone(TOPIC_BACKLOG.backlog.topics[0]),
      id: 'invalid_legacy_layout',
      decision: {
        ...clone(TOPIC_BACKLOG.backlog.topics[0].decision),
        layoutId: 'editorial_steps',
      },
    },
  ];

  const result = validateTopicBacklog(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must use templateId/);
  assert.match(result.errors.join('\n'), /layoutId is forbidden/);
});

test('selectEligibleTopics filters by status, priority, pillar, and reuse window', () => {
  const now = '2026-06-27';

  const eligible = selectEligibleTopics(TOPIC_BACKLOG.backlog, { now });
  const eligibleIds = topicIds(eligible);
  assert.ok(eligibleIds.includes('prep_drop_cover_hold'));
  assert.ok(eligibleIds.includes('ground_high_ground_route'));
  assert.ok(eligibleIds.includes('info_check_before_share'));
  assert.equal(eligibleIds.includes('calendar_family_drill'), false);

  const preparednessP1 = selectEligibleTopics(TOPIC_BACKLOG.backlog, {
    now,
    pillarId: 'preparedness',
    maxPriority: 1,
  });
  assert.deepEqual(topicIds(preparednessP1), ['prep_drop_cover_hold']);

  const priorityTwo = selectEligibleTopics(TOPIC_BACKLOG.backlog, { now, priority: 2 });
  assert.deepEqual(topicIds(priorityTwo), ['info_no_prediction', 'prep_go_bag_basics']);

  const later = selectEligibleTopics(TOPIC_BACKLOG.backlog, { now: '2026-08-01' });
  assert.ok(topicIds(later).includes('calendar_family_drill'));
});

test('selectEligibleTopics can inspect non-ready statuses without mutating the backlog', () => {
  const backlog = clone(TOPIC_BACKLOG.backlog);
  backlog.topics.push({
    ...clone(TOPIC_BACKLOG.backlog.topics[0]),
    id: 'draft_test_topic',
    status: 'draft',
    priority: 1,
    last_used: null,
  });

  const before = JSON.stringify(backlog);
  const draftTopics = selectEligibleTopics(backlog, { status: 'draft', now: '2026-06-27' });
  assert.deepEqual(topicIds(draftTopics), ['draft_test_topic']);
  assert.equal(JSON.stringify(backlog), before);
});

