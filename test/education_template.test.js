// Educational SVG renderer tests. These stay pure: no Resvg import, no network,
// no posting, and no watcher pipeline changes.

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEducationalSvg } from '../studio/education-template.js';
import { DESIGN_TOKENS, FEED_CANVAS, MANDATORY_FOOTER } from '../studio/design-sdk.js';

function readRenderSpec(topicDir) {
  return JSON.parse(readFileSync(`studio/outbox/editorial-dry-run-1/${topicDir}/render-decision.json`, 'utf8')).renderSpec;
}

function svgText(svg) {
  return svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('educational SVG renderer supports editorial steps', () => {
  const spec = readRenderSpec('02-prep_drop_cover_hold');
  const svg = buildEducationalSvg(spec);

  assert.match(svg, new RegExp(`viewBox="0 0 ${FEED_CANVAS.width} ${FEED_CANVAS.height}"`));
  assert.match(svg, /Saat Gempa: 3 Langkah/);
  assert.match(svg, /Merunduk/);
  assert.match(svg, /Lindungi/);
  assert.match(svg, /Berpegangan/);
  assert.match(svg, /Siap Sebelum Bencana/);
  assert.match(svg, new RegExp(DESIGN_TOKENS.colors.pillars.preparedness.hex));
  assert.ok(svg.includes(MANDATORY_FOOTER.currentLines[0]));
  assert.ok(svg.includes(MANDATORY_FOOTER.currentLines[1]));
});

test('educational SVG renderer supports checklist cards', () => {
  const spec = readRenderSpec('05-prep_go_bag_basics');
  const svg = buildEducationalSvg(spec);

  assert.match(svg, /Isi Tas Siaga Keluarga/);
  assert.match(svg, /Air minum dan makanan ringan/);
  assert.match(svg, /Obat pribadi/);
  assert.match(svg, /Nomor keluarga/);
});

test('educational SVG renderer supports poster statements', () => {
  const spec = readRenderSpec('04-info_no_prediction');
  const svg = buildEducationalSvg(spec);
  const text = svgText(svg);

  assert.match(text, /Gempa tidak bisa diprediksi/);
  assert.match(text, /Rujukan: BMKG/);
  assert.match(text, /Saring Sebelum Sebar/);
  assert.match(svg, new RegExp(DESIGN_TOKENS.colors.pillars.information_hygiene.hex));
});

test('educational SVG renderer rejects unsupported or invalid render specs', () => {
  const valid = readRenderSpec('02-prep_drop_cover_hold');

  assert.throws(
    () => buildEducationalSvg({ ...valid, templateId: 'story_card' }),
    /unsupported educational template|exportTarget/
  );
  assert.throws(
    () => buildEducationalSvg({ ...valid, footerId: 'wrong_footer' }),
    /invalid render spec/
  );
});
