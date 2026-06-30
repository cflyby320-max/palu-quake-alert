// Editorial outbox dry-run tests. These keep the review artifacts aligned with
// the topic backlog and make sure they cannot be mistaken for publishable posts.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DESIGN_TOKENS } from '../studio/design-sdk.js';
import { TOPIC_BACKLOG, selectEligibleTopics } from '../studio/topic-backlog.js';
import { validateRenderSpec } from '../studio/template-registry.js';

const BATCH_DIR = 'studio/outbox/editorial-dry-run-1';
const EXPECTED_TOPIC_IDS = [
  'ground_high_ground_route',
  'prep_drop_cover_hold',
  'info_check_before_share',
  'info_no_prediction',
  'prep_go_bag_basics',
];
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

function readText(path) {
  return readFileSync(path, 'utf8');
}

function topicById(id) {
  return TOPIC_BACKLOG.backlog.topics.find((topic) => topic.id === id);
}

function listFilesRecursive(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listFilesRecursive(path));
    else files.push(path);
  }
  return files;
}

test('editorial outbox dry run manifest matches eligible backlog selection', () => {
  assert.equal(existsSync('studio/outbox/README.md'), true);
  assert.equal(existsSync(BATCH_DIR), true);

  const manifest = readJson(join(BATCH_DIR, 'manifest.json'));
  const eligibleIds = selectEligibleTopics(TOPIC_BACKLOG.backlog, { now: '2026-06-27' }).map((topic) => topic.id);

  assert.equal(manifest.batchType, 'editorial_outbox_dry_run');
  assert.equal(manifest.publicationStatus, 'dry_run_not_approved');
  assert.equal(manifest.reviewWarning, 'DRAFT / NOT APPROVED / DO NOT POST');
  assert.deepEqual(manifest.selection.topicIds, EXPECTED_TOPIC_IDS);
  assert.deepEqual(manifest.selection.topicIds, eligibleIds);
  assert.equal(manifest.rules.humanApprovalRequired, true);
  assert.equal(manifest.rules.mandatoryFooterId, 'mandatory_honest_framing');
});

test('each outbox topic has only the required review files', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const files = readdirSync(join(BATCH_DIR, dir)).sort();
    assert.deepEqual(files, ['caption.txt', 'missing-image.md', 'render-decision.json']);
  }
});

test('render decisions preserve backlog decisions and validate render specs', () => {
  const footer = DESIGN_TOKENS.footers.mandatory_honest_framing;

  for (const dir of EXPECTED_TOPIC_DIRS) {
    const decision = readJson(join(BATCH_DIR, dir, 'render-decision.json'));
    const topic = topicById(decision.topicId);
    assert.ok(topic, `${decision.topicId} should exist in topic_backlog.json`);

    assert.equal(decision.publicationStatus, 'dry_run_not_approved');
    assert.equal(decision.reviewWarning, 'DRAFT / NOT APPROVED / DO NOT POST');
    assert.equal(decision.humanApproval, 'required_before_publish');
    assert.equal(decision.templateId, topic.decision.templateId);
    assert.deepEqual(decision.backlogDecision, topic.decision);
    assert.equal(decision.mandatoryFooter.id, 'mandatory_honest_framing');
    assert.deepEqual(decision.mandatoryFooter.lines, footer.currentLines);
    assert.equal(decision.mandatoryFooter.handle, footer.handle);

    const validation = validateRenderSpec(decision.renderSpec);
    assert.equal(validation.ok, true, `${decision.topicId}: ${validation.errors.join('; ')}`);
  }
});

test('each topic includes exactly one pain point, local note, and practical action', () => {
  const expectedBriefFields = ['audiencePainPoint', 'localRelevance', 'practicalAction'];

  for (const dir of EXPECTED_TOPIC_DIRS) {
    const decision = readJson(join(BATCH_DIR, dir, 'render-decision.json'));
    assert.deepEqual(Object.keys(decision.editorialBrief).sort(), expectedBriefFields.sort());
    for (const field of expectedBriefFields) {
      assert.equal(typeof decision.editorialBrief[field], 'string');
      assert.ok(decision.editorialBrief[field].length > 20, `${decision.topicId}.${field} should be specific`);
    }
  }
});

test('captions are marked as drafts and preserve footer and BMKG positioning', () => {
  const footer = DESIGN_TOKENS.footers.mandatory_honest_framing;

  for (const dir of EXPECTED_TOPIC_DIRS) {
    const caption = readText(join(BATCH_DIR, dir, 'caption.txt'));
    assert.match(caption, /^DRAFT \/ NOT APPROVED \/ DO NOT POST/);
    assert.match(caption, /Rujukan:/);
    assert.match(caption, /BMKG/);
    assert.match(caption, /Palu|Sulawesi Tengah|Sigi|Donggala/);
    assert.ok(caption.includes(footer.currentLines[0]));
    assert.ok(caption.includes(footer.currentLines[1]));
    assert.ok(caption.includes(footer.handle));
  }
});

test('missing-image notes explain the renderer gap without image prompt language', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const note = readText(join(BATCH_DIR, dir, 'missing-image.md'));
    assert.match(note, /No PNG or JPG was generated/);
    assert.match(note, /educational template rendering is not connected/);
    assert.match(note, /studio\/render\.js/);
    assert.doesNotMatch(note.toLowerCase(), /imageprompt|image prompt|prompt:/);
  }
});

test('editorial outbox dry run does not contain generated image files', () => {
  const files = listFilesRecursive(BATCH_DIR);
  const imageFiles = files.filter((path) => /\.(png|jpe?g)$/i.test(path));
  assert.deepEqual(imageFiles, []);
});

