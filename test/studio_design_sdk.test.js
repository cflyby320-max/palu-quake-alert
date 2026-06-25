// Studio / Design SDK integration tests. These stay pure: no rasteriser,
// no network, no credentials.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_COLORS,
  DESIGN_SDK,
  FEED_CANVAS,
  MANDATORY_FOOTER,
  loadDesignTokens,
} from '../studio/design-sdk.js';
import { Event, clusterEvents } from '../src/core.js';
import { buildCardSvg } from '../studio/template.js';

test('studio loads Design SDK tokens from design/DESIGN_TOKENS.json', () => {
  assert.equal(DESIGN_SDK.source, 'design/DESIGN_TOKENS.json');
  assert.equal(CORE_COLORS.teal, '#0F4C5C');
  assert.equal(FEED_CANVAS.width, 1080);
  assert.equal(FEED_CANVAS.height, 1350);
  assert.equal(MANDATORY_FOOTER.currentLines[0], 'Notifikasi cepat — bukan peringatan dini.');
});

test('studio Design SDK loader falls back safely if tokens are unavailable', () => {
  const { source, tokens } = loadDesignTokens({ url: new URL('../missing-design-tokens.json', import.meta.url) });
  assert.equal(source, 'fallback');
  assert.equal(tokens.colors.core.teal, '#0F4C5C');
  assert.match(tokens.footers.mandatory_honest_framing.currentLines[1], /BMKG/);
});

test('quake card template consumes SDK canvas, core colors, and mandatory footer', () => {
  const e = new Event({
    source: 'BMKG',
    id: 'sdk',
    time: new Date('2026-06-16T03:27:44Z'),
    magnitude: 4.2,
    depthKm: 10,
    lat: -1.0,
    lon: 120.0,
    tsunamiFlag: false,
  });
  const [m] = clusterEvents([e]);
  const svg = buildCardSvg(m);

  assert.match(svg, new RegExp(`viewBox="0 0 ${FEED_CANVAS.width} ${FEED_CANVAS.height}"`));
  assert.match(svg, new RegExp(`fill="${CORE_COLORS.teal}"`));
  assert.match(svg, new RegExp(`fill="${CORE_COLORS.teal_deep}"`));
  assert.match(svg, /Notifikasi cepat — bukan peringatan dini\./);
  assert.match(svg, /Selalu ikuti arahan resmi BMKG\./);
  assert.match(svg, /@infogempapalu/);
});
