// Studio-side bridge into the Design SDK.
//
// The SDK is documentation/data, not runtime logic. This loader gives Studio a
// single, conservative place to read design tokens while preserving production
// resilience: if a deployment image is missing design/, Studio falls back to
// the current values instead of breaking an already-delivered alert draft.

import { readFileSync } from 'node:fs';

export const DESIGN_TOKENS_URL = new URL('../design/DESIGN_TOKENS.json', import.meta.url);

const FALLBACK_TOKENS = {
  project: {
    name: 'Palu Earthquake Alerts',
    handle: '@infogempapalu',
  },
  colors: {
    core: {
      teal: '#0F4C5C',
      teal_deep: '#0A3742',
      teal_mid: '#11343d',
      teal_accent: '#7FB7B8',
      mint: '#9FE1CB',
      off_white: '#FBFCFB',
      amber: '#C77B0A',
      amber_ink: '#412402',
    },
  },
  canvas: {
    instagram_feed: {
      width: 1080,
      height: 1350,
    },
  },
  footers: {
    mandatory_honest_framing: {
      currentLines: ['Notifikasi cepat — bukan peringatan dini.', 'Selalu ikuti arahan resmi BMKG.'],
      handle: '@infogempapalu',
    },
  },
};

function mergeSdk(parsed) {
  return {
    ...FALLBACK_TOKENS,
    ...parsed,
    project: { ...FALLBACK_TOKENS.project, ...(parsed.project || {}) },
    colors: {
      ...FALLBACK_TOKENS.colors,
      ...(parsed.colors || {}),
      core: { ...FALLBACK_TOKENS.colors.core, ...((parsed.colors || {}).core || {}) },
    },
    canvas: {
      ...FALLBACK_TOKENS.canvas,
      ...(parsed.canvas || {}),
      instagram_feed: {
        ...FALLBACK_TOKENS.canvas.instagram_feed,
        ...((parsed.canvas || {}).instagram_feed || {}),
      },
    },
    footers: {
      ...FALLBACK_TOKENS.footers,
      ...(parsed.footers || {}),
      mandatory_honest_framing: {
        ...FALLBACK_TOKENS.footers.mandatory_honest_framing,
        ...((parsed.footers || {}).mandatory_honest_framing || {}),
      },
    },
  };
}

export function loadDesignTokens({ url = DESIGN_TOKENS_URL } = {}) {
  try {
    const parsed = JSON.parse(readFileSync(url, 'utf8'));
    return { source: 'design/DESIGN_TOKENS.json', tokens: mergeSdk(parsed) };
  } catch (e) {
    return { source: 'fallback', reason: e.message, tokens: FALLBACK_TOKENS };
  }
}

export const DESIGN_SDK = loadDesignTokens();
export const DESIGN_TOKENS = DESIGN_SDK.tokens;
export const CORE_COLORS = DESIGN_TOKENS.colors.core;
export const FEED_CANVAS = DESIGN_TOKENS.canvas.instagram_feed;
export const MANDATORY_FOOTER = DESIGN_TOKENS.footers.mandatory_honest_framing;

