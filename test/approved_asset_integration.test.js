// Approved Asset Bank integration and Preview 4 composition checks.
//
// These tests keep rejected Preview 3 frozen and make Preview 4 local,
// deterministic, role-specific, fail-closed, and review-only.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isApprovedRenderAsset,
  loadApprovedLocalSvgAsset,
  loadAssetIndex,
} from '../studio/asset-library.js';
import { DESIGN_TOKENS, FEED_CANVAS, MANDATORY_FOOTER } from '../studio/design-sdk.js';
import {
  PREVIEW4_ASSET_ASSIGNMENTS,
  renderEducationalOutbox,
} from '../studio/render-educational-outbox.js';
import { getTemplateSpec, validateRenderSpec } from '../studio/template-registry.js';

const PREVIEW3_DIR = 'studio/outbox/educational-render-preview-3';
const PREVIEW4_DIR = 'studio/outbox/educational-render-preview-4';
const SOURCE_DIR = 'studio/outbox/editorial-dry-run-1';
const TOPICS = [
  ['01-ground_high_ground_route', 'ground_high_ground_route'],
  ['02-prep_drop_cover_hold', 'prep_drop_cover_hold'],
  ['03-info_check_before_share', 'info_check_before_share'],
  ['04-info_no_prediction', 'info_no_prediction'],
  ['05-prep_go_bag_basics', 'prep_go_bag_basics'],
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

function assignedIds(slots) {
  return Object.values(slots).flatMap((value) => Array.isArray(value) ? value : [value]);
}

function decodeAlpha(path) {
  const png = readFileSync(path);
  let offset = 8;
  let width;
  let height;
  let colorType;
  const idat = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const rawRow = y * (stride + 1);
    const filter = raw[rawRow];
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawRow + 1 + x];
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[previous + x - channels] : 0;
      const decoded = filter === 0 ? value
        : filter === 1 ? value + left
          : filter === 2 ? value + up
            : filter === 3 ? value + Math.floor((left + up) / 2)
              : value + paeth(left, up, upperLeft);
      pixels[row + x] = decoded & 0xff;
    }
  }

  if (channels === 4) {
    for (let index = 3; index < pixels.length; index += 4) {
      assert.equal(pixels[index], 255, `${path} contains transparent pixels`);
    }
  }
}

test('Preview 3 remains frozen and records its rejected review lineage', () => {
  const manifest = readJson(join(PREVIEW3_DIR, 'manifest.json'));
  assert.equal(manifest.publicationStatus, 'review_rejected_revision_required');
  assert.equal(manifest.humanReview.status, 'rejected');
  assert.equal(manifest.humanReview.successorBatchId, 'educational-render-preview-4');
  assert.equal(manifest.humanReview.issues.length, 4);

  for (const [relativePath, expected] of Object.entries(manifest.frozenRenderSha256)) {
    const actual = createHash('sha256').update(readFileSync(join(PREVIEW3_DIR, relativePath)))
      .digest('hex').toUpperCase();
    assert.equal(actual, expected, `${relativePath} must remain unchanged`);
  }
});

test('Preview 4 assignments use restraint while integrating all three approved patterns', () => {
  assert.deepEqual(Object.keys(PREVIEW4_ASSET_ASSIGNMENTS), TOPICS.map(([, topicId]) => topicId));
  assert.deepEqual(PREVIEW4_ASSET_ASSIGNMENTS.info_no_prediction, {});

  const uniqueAssigned = [...new Set(
    Object.values(PREVIEW4_ASSET_ASSIGNMENTS).flatMap(assignedIds)
  )];
  assert.deepEqual(
    uniqueAssigned.filter((id) => id.startsWith('pat_')).sort(),
    ['pat_ground_contours', 'pat_information_source_trail', 'pat_preparedness_route_grid']
  );
  assert.equal(uniqueAssigned.includes('icon_route_high_ground'), false);

  const { index } = loadAssetIndex();
  for (const assetId of uniqueAssigned) {
    const asset = index.assets.find((entry) => entry.id === assetId);
    assert.equal(isApprovedRenderAsset(asset), true, `${assetId} must be committed and approved`);
  }
});

test('registry owns role-specific fit, region, opacity, clear-space, and layer rules', () => {
  const editorial = getTemplateSpec('editorial_steps');
  const ambient = editorial.assetSlots.find(({ id }) => id === 'ambient_pattern');
  const rowIcons = editorial.assetSlots.find(({ id }) => id === 'row_icons');
  const focal = getTemplateSpec('checklist_card').assetSlots
    .find(({ id }) => id === 'focal_illustration');
  const poster = getTemplateSpec('poster_statement').assetSlots
    .find(({ id }) => id === 'poster_background');

  assert.deepEqual(ambient.allowedTypes, ['pattern']);
  assert.equal(ambient.presentation.fit, 'contain');
  assert.equal(ambient.presentation.region, 'header_right');
  assert.equal(ambient.presentation.maxOpacity, 0.24);
  assert.equal(ambient.presentation.clearTextZone, 'header_left');
  assert.equal(ambient.presentation.layer, 'below_text');
  assert.equal(rowIcons.presentation.fit, 'contain');
  assert.equal(focal.presentation.surface, 'solid_paper');
  assert.equal(focal.presentation.clearTextZone, 'header');
  assert.equal(poster.allowedTypes.includes('pattern'), false);
});

test('Preview 4 preserves all copy, source IDs, captions, footer, and BMKG positioning', () => {
  for (const [folder, topicId] of TOPICS) {
    const source = readJson(join(SOURCE_DIR, folder, 'render-decision.json'));
    const preview = readJson(join(PREVIEW4_DIR, folder, 'render-decision.json'));

    assert.equal(preview.topicId, topicId);
    assert.deepEqual(preview.sourceIds, source.sourceIds);
    assert.deepEqual(preview.renderSpec.knowledge.sourceIds, source.renderSpec.knowledge.sourceIds);
    assert.deepEqual(preview.renderSpec.content, source.renderSpec.content);
    assert.deepEqual(preview.backlogDecision.content, source.backlogDecision.content);
    assert.deepEqual(preview.renderSpec.assets.referenceAssetIds, source.renderSpec.assets.referenceAssetIds);
    assert.deepEqual(preview.renderSpec.assets.slots, PREVIEW4_ASSET_ASSIGNMENTS[topicId]);
    assert.deepEqual(
      readFileSync(join(PREVIEW4_DIR, folder, 'caption.txt')),
      readFileSync(join(SOURCE_DIR, folder, 'caption.txt'))
    );

    const validation = validateRenderSpec(preview.renderSpec);
    assert.equal(validation.ok, true, `${topicId}: ${validation.errors.join('; ')}`);
  }
});

test('template validation rejects incompatible types, row cardinality, and unapproved metadata', () => {
  const decision = readJson(join(PREVIEW4_DIR, TOPICS[1][0], 'render-decision.json'));
  const incompatible = structuredClone(decision.renderSpec);
  incompatible.assets.slots.ambient_pattern = 'icon_action_drop';
  assert.match(
    validateRenderSpec(incompatible).errors.join('\n'),
    /type "icon" is not allowed in slot "ambient_pattern"/
  );

  const incompleteRows = structuredClone(decision.renderSpec);
  incompleteRows.assets.slots.row_icons = ['icon_action_drop', 'icon_action_cover'];
  assert.match(
    validateRenderSpec(incompleteRows).errors.join('\n'),
    /one icon per content row/
  );

  const { index } = loadAssetIndex();
  const modified = structuredClone(index);
  modified.assets.find((entry) => entry.id === 'icon_action_drop').safetyReview = 'pending';
  assert.match(
    validateRenderSpec(decision.renderSpec, { assetIndex: modified }).errors.join('\n'),
    /not committed and approved/
  );
});

test('approved local loading remains fail-closed for unsafe metadata and traversal', () => {
  const { index } = loadAssetIndex();
  const modified = structuredClone(index);
  modified.assets.find((entry) => entry.id === 'icon_action_drop').status = 'candidate';
  assert.throws(
    () => loadApprovedLocalSvgAsset('icon_action_drop', { index: modified }),
    /not eligible for approved rendering/
  );

  const escaped = structuredClone(index);
  escaped.assets.find((entry) => entry.id === 'icon_action_drop').path = 'design/assets/../ASSET_INDEX.json';
  assert.throws(
    () => loadApprovedLocalSvgAsset('icon_action_drop', { index: escaped }),
    /resolves outside design\/assets/
  );
});

test('an invalid assigned asset aborts before any Preview 4 output is created', () => {
  const temp = mkdtempSync(join(tmpdir(), 'palu-preview4-invalid-'));
  const inputPath = join(temp, 'input');
  const outputPath = join(temp, 'output');
  cpSync(SOURCE_DIR, inputPath, { recursive: true });

  const folder = TOPICS[4][0];
  const decisionPath = join(inputPath, folder, 'render-decision.json');
  const decision = readJson(decisionPath);
  decision.renderSpec.assets.slots = { focal_illustration: 'pat_preparedness_route_grid' };
  decision.backlogDecision.assets.slots = decision.renderSpec.assets.slots;
  writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`, 'utf8');

  assert.throws(
    () => renderEducationalOutbox({
      inputBatch: pathToFileURL(`${inputPath}/`),
      outputBatch: pathToFileURL(`${outputPath}/`),
      assetAssignments: {
        ...PREVIEW4_ASSET_ASSIGNMENTS,
        prep_go_bag_basics: { focal_illustration: 'pat_preparedness_route_grid' },
      },
    }),
    /type "pattern" is not allowed in slot "focal_illustration"/
  );
  assert.equal(existsSync(outputPath), false);
});

test('ambient patterns are uncropped secondary header motifs and never body artwork', () => {
  for (const [folder, topicId] of TOPICS.slice(0, 3)) {
    const svg = readFileSync(join(PREVIEW4_DIR, folder, 'card.svg'), 'utf8');
    const patternId = PREVIEW4_ASSET_ASSIGNMENTS[topicId].ambient_pattern;
    const tag = svg.match(new RegExp(`<image[^>]+data-asset-id="${patternId}"[^>]+>`))?.[0];
    assert.ok(tag, `${topicId} must render its ambient pattern`);
    assert.match(tag, /data-slot="ambient_pattern"/);
    assert.match(tag, /data-role="secondary_header_motif"/);
    assert.match(tag, /data-region="header_right"/);
    assert.match(tag, /data-fit="contain"/);
    assert.match(tag, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(tag, /x="700" y="136" width="320" height="154"/);
    assert.match(tag, /opacity="0.24"/);
    assert.doesNotMatch(tag, /slice/);
    assert.doesNotMatch(svg, /data-slot="focal_illustration"/);
  }
});

test('Preview 4 enforces one visual anchor and the agreed card-specific color roles', () => {
  const card4 = readFileSync(join(PREVIEW4_DIR, TOPICS[3][0], 'card.svg'), 'utf8');
  const card5 = readFileSync(join(PREVIEW4_DIR, TOPICS[4][0], 'card.svg'), 'utf8');
  const p3 = DESIGN_TOKENS.colors.pillars.information_hygiene.hex;

  assert.equal(card4.includes('data-asset-id='), false);
  assert.equal(card4.split(p3).length - 1, 2, 'Card 4 uses P3 only for tag and phrase emphasis');
  assert.match(card5, /data-slot="focal_illustration"/);
  assert.match(card5, /data-surface="solid_paper"/);
  assert.doesNotMatch(card5, /data-slot="ambient_pattern"/);
  assert.doesNotMatch(card5, /pat_preparedness_route_grid/);
});

test('Preview 4 renders factual text, footer, bounded SVG, and opaque feed-size PNGs', () => {
  for (const [folder] of TOPICS) {
    const decision = readJson(join(PREVIEW4_DIR, folder, 'render-decision.json'));
    const svg = readFileSync(join(PREVIEW4_DIR, folder, 'card.svg'), 'utf8');
    const pngPath = join(PREVIEW4_DIR, folder, 'card.png');
    const png = pngSize(pngPath);

    assert.ok(svg.includes(decision.renderSpec.content.title));
    assert.ok(svg.includes(MANDATORY_FOOTER.currentLines[0]));
    assert.ok(svg.includes(MANDATORY_FOOTER.currentLines[1]));
    assert.ok(svg.includes(MANDATORY_FOOTER.handle));
    assert.equal(svg.includes('...'), false);
    assert.equal(png.signature, '89504e470d0a1a0a');
    assert.equal(png.width, FEED_CANVAS.width);
    assert.equal(png.height, FEED_CANVAS.height);
    decodeAlpha(pngPath);

    for (const match of svg.matchAll(/<(?:text|rect|circle|image)[^>]*\bx="(-?\d+(?:\.\d+)?)"/g)) {
      assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= FEED_CANVAS.width);
    }
    for (const match of svg.matchAll(/<(?:text|rect|circle|image)[^>]*\by="(-?\d+(?:\.\d+)?)"/g)) {
      assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= FEED_CANVAS.height);
    }
  }
});

test('Preview 4 manifest and contact sheet remain review-only', () => {
  const manifest = readJson(join(PREVIEW4_DIR, 'manifest.json'));
  const contactSheet = pngSize(join(PREVIEW4_DIR, 'contact-sheet.png'));
  const rootFiles = readdirSync(PREVIEW4_DIR).sort();

  assert.equal(manifest.batchId, 'educational-render-preview-4');
  assert.equal(manifest.visualQaRevision, 4);
  assert.equal(manifest.publicationStatus, 'review_required_not_auto_posted');
  assert.equal(manifest.rules.noAutoPost, true);
  assert.equal(manifest.rules.noExternalApis, true);
  assert.equal(manifest.rules.humanApprovalRequired, true);
  assert.equal(
    manifest.compositionContract,
    'design/RENDERING_CONTRACT.md#educational-asset-composition'
  );
  assert.deepEqual(manifest.reviewArtifacts, ['contact-sheet.png', 'contact-sheet.svg']);
  assert.deepEqual(
    rootFiles,
    [...TOPICS.map(([folder]) => folder), 'contact-sheet.png', 'contact-sheet.svg', 'manifest.json'].sort()
  );
  assert.equal(contactSheet.signature, '89504e470d0a1a0a');
  assert.equal(contactSheet.width, 1920);
  assert.equal(contactSheet.height, 1080);
  decodeAlpha(join(PREVIEW4_DIR, 'contact-sheet.png'));
});
