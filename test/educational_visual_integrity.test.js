// Visual integrity checks for the polished educational preview batch.
//
// This uses only Node built-ins and decodes Resvg's PNG scanlines so the root
// test suite can catch transparent or incorrectly painted exports.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CORE_COLORS, FEED_CANVAS, MANDATORY_FOOTER } from '../studio/design-sdk.js';
import { validateRenderSpec } from '../studio/template-registry.js';

const PREVIEW_DIR = 'studio/outbox/educational-render-preview-2';
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

function hexRgb(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(path) {
  const png = readFileSync(path);
  assert.equal(png.slice(0, 8).toString('hex'), '89504e470d0a1a0a');

  let offset = 8;
  let width;
  let height;
  let bitDepth;
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
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  assert.equal(bitDepth, 8, `${path} must use 8-bit channels`);
  assert.ok(colorType === 2 || colorType === 6, `${path} must be RGB or RGBA`);
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);

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
      let decoded;

      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + Math.floor((left + up) / 2);
      else if (filter === 4) decoded = value + paeth(left, up, upperLeft);
      else throw new Error(`${path} uses unsupported PNG filter ${filter}`);

      pixels[row + x] = decoded & 0xff;
    }
  }

  function pixel(x, y) {
    const index = (y * width + x) * channels;
    return {
      rgb: [...pixels.subarray(index, index + 3)],
      alpha: channels === 4 ? pixels[index + 3] : 255,
    };
  }

  return { width, height, channels, pixels, pixel };
}

test('polished preview manifest is review-only and links to the dry run', () => {
  const manifest = readJson(join(PREVIEW_DIR, 'manifest.json'));

  assert.equal(manifest.batchId, 'educational-render-preview-2');
  assert.equal(manifest.visualQaRevision, 2);
  assert.equal(manifest.sourceBatchId, 'editorial-dry-run-1');
  assert.equal(manifest.publicationStatus, 'review_required_not_auto_posted');
  assert.equal(manifest.rules.noAutoPost, true);
  assert.equal(manifest.rules.humanApprovalRequired, true);
  assert.deepEqual(manifest.rendered.map(({ folder }) => folder), EXPECTED_TOPIC_DIRS);
});

test('polished previews keep the exact files and valid render decisions', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const files = readdirSync(join(PREVIEW_DIR, dir)).sort();
    const decision = readJson(join(PREVIEW_DIR, dir, 'render-decision.json'));
    const validation = validateRenderSpec(decision.renderSpec);

    assert.deepEqual(files, ['caption.txt', 'card.png', 'card.svg', 'render-decision.json', 'review-note.md']);
    assert.equal(validation.ok, true, `${dir}: ${validation.errors.join('; ')}`);
  }
});

test('polished SVGs preserve brand, content bounds, and mandatory footer', () => {
  for (const dir of EXPECTED_TOPIC_DIRS) {
    const decision = readJson(join(PREVIEW_DIR, dir, 'render-decision.json'));
    const svg = readFileSync(join(PREVIEW_DIR, dir, 'card.svg'), 'utf8');

    assert.ok(svg.includes('PALU EARTHQUAKE ALERTS'));
    assert.ok(svg.includes(decision.renderSpec.content.title));
    assert.ok(svg.includes(MANDATORY_FOOTER.currentLines[0]));
    assert.ok(svg.includes(MANDATORY_FOOTER.currentLines[1]));
    assert.ok(svg.includes(MANDATORY_FOOTER.handle));
    assert.equal(svg.includes('...'), false, `${dir} must not truncate current batch copy`);

    for (const match of svg.matchAll(/<(?:text|rect|circle)[^>]*\bx="(-?\d+(?:\.\d+)?)"/g)) {
      const x = Number(match[1]);
      assert.ok(x >= 0 && x <= FEED_CANVAS.width, `${dir} x=${x} is outside the canvas`);
    }
    for (const match of svg.matchAll(/<(?:text|rect|circle)[^>]*\by="(-?\d+(?:\.\d+)?)"/g)) {
      const y = Number(match[1]);
      assert.ok(y >= 0 && y <= FEED_CANVAS.height, `${dir} y=${y} is outside the canvas`);
    }
  }
});

test('polished PNGs are opaque and paint expected header and footer colors', () => {
  const teal = hexRgb(CORE_COLORS.teal);
  const tealDeep = hexRgb(CORE_COLORS.teal_deep);

  for (const dir of EXPECTED_TOPIC_DIRS) {
    const image = decodePng(join(PREVIEW_DIR, dir, 'card.png'));
    assert.equal(image.width, FEED_CANVAS.width);
    assert.equal(image.height, FEED_CANVAS.height);

    if (image.channels === 4) {
      for (let index = 3; index < image.pixels.length; index += 4) {
        assert.equal(image.pixels[index], 255, `${dir} contains transparent pixels`);
      }
    }

    const expectedHeader = dir === '04-info_no_prediction' ? tealDeep : teal;
    assert.deepEqual(image.pixel(10, 100).rgb, expectedHeader, `${dir} header color`);
    assert.deepEqual(image.pixel(10, 1300).rgb, tealDeep, `${dir} footer color`);
    assert.equal(image.pixel(10, 100).alpha, 255);
    assert.equal(image.pixel(10, 1300).alpha, 255);
  }
});

test('poster statement uses a full-canvas treatment distinct from editorial cards', () => {
  const poster = readFileSync(join(PREVIEW_DIR, '04-info_no_prediction', 'card.svg'), 'utf8');
  const editorial = readFileSync(join(PREVIEW_DIR, '03-info_check_before_share', 'card.svg'), 'utf8');

  assert.equal(poster.includes('<rect x="60" y="380"'), false);
  assert.ok(poster.includes('font-size="78"'));
  assert.ok(poster.includes('Rujukan: BMKG'));
  assert.ok(editorial.includes('<rect x="60" y="358"'));
});
