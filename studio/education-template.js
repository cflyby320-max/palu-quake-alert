// Deterministic educational card SVG builder.
//
// This is the first renderer for evergreen content. It consumes a validated
// render spec and returns SVG only: no network, no posting, no watcher imports.

import { CORE_COLORS, DESIGN_TOKENS, FEED_CANVAS, MANDATORY_FOOTER } from './design-sdk.js';
import { validateRenderSpec } from './template-registry.js';

const SUPPORTED_TEMPLATES = new Set(['editorial_steps', 'checklist_card', 'poster_statement']);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function words(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean);
}

function wrapText(text, maxChars, maxLines = 4) {
  const lines = [];
  let current = '';

  for (const word of words(text)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[,. ]+$/, '') + '...';
  return clipped;
}

function textBlock({ x, y, lines, size, fill, weight = 400, lineHeight = Math.round(size * 1.22), anchor = 'start' }) {
  return [
    `<text x="${x}" y="${y}" font-family="'DejaVu Sans', Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">`,
    ...lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`),
    '</text>',
  ].join('');
}

function pill({ x, y, width, height, fill, text, ink = CORE_COLORS.off_white }) {
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${fill}"/>`,
    textBlock({ x: x + width / 2, y: y + height / 2 + 11, lines: [text], size: 28, fill: ink, weight: 700, anchor: 'middle' }),
  ].join('');
}

function pillarMeta(pillarId) {
  const pillar = DESIGN_TOKENS.pillars?.[pillarId] || {};
  const color = DESIGN_TOKENS.colors?.pillars?.[pillarId]?.hex || CORE_COLORS.amber;
  return {
    color,
    label: pillar.label || pillarId,
    shortCode: pillar.shortCode || '',
  };
}

function footer() {
  const y = FEED_CANVAS.height - 118;
  return [
    `<rect x="0" y="${y}" width="${FEED_CANVAS.width}" height="118" fill="${CORE_COLORS.teal_deep}"/>`,
    textBlock({ x: 60, y: y + 46, lines: [MANDATORY_FOOTER.currentLines[0]], size: 26, fill: CORE_COLORS.teal_accent }),
    textBlock({ x: 60, y: y + 82, lines: [MANDATORY_FOOTER.currentLines[1]], size: 26, fill: CORE_COLORS.teal_accent }),
    textBlock({ x: FEED_CANVAS.width - 60, y: y + 66, lines: [MANDATORY_FOOTER.handle], size: 30, fill: CORE_COLORS.off_white, weight: 700, anchor: 'end' }),
  ].join('');
}

function shell(spec, inner, { displayTitle } = {}) {
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const title = displayTitle || spec.content.title || 'Palu Earthquake Alerts';
  const tagText = `${pillar.shortCode ? `${pillar.shortCode} / ` : ''}${pillar.label}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FEED_CANVAS.width} ${FEED_CANVAS.height}" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" role="img">`,
    `<title>${esc(`${spec.content.kicker || pillar.label} - ${title}`)}</title>`,
    `<rect x="0" y="0" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" fill="${DESIGN_TOKENS.colors.core.paper || '#EEF3F2'}"/>`,
    `<rect x="0" y="0" width="${FEED_CANVAS.width}" height="300" fill="${CORE_COLORS.teal}"/>`,
    `<circle cx="945" cy="120" r="180" fill="${CORE_COLORS.teal_deep}" opacity="0.45"/>`,
    `<path d="M0 260 C210 218 345 318 540 270 C760 214 870 254 1080 224 L1080 342 L0 342 Z" fill="${CORE_COLORS.teal_deep}" opacity="0.55"/>`,
    pill({ x: 60, y: 56, width: Math.min(520, 120 + tagText.length * 15), height: 58, fill: pillar.color, text: tagText }),
    textBlock({ x: 60, y: 166, lines: wrapText(spec.content.kicker || pillar.label, 34, 1), size: 28, fill: CORE_COLORS.mint, weight: 700 }),
    textBlock({ x: 60, y: 234, lines: wrapText(title, 24, 2), size: 64, fill: CORE_COLORS.off_white, weight: 700, lineHeight: 74 }),
    inner,
    footer(),
    '</svg>',
  ].join('');
}

function editorialSteps(spec) {
  const rows = spec.content.rows || [];
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const startY = 440;
  const gap = rows.length >= 4 ? 174 : 205;

  return shell(spec, rows.map((row, index) => {
    const y = startY + index * gap;
    const bodyLines = wrapText(row.body, 42, 3);
    return [
      `<rect x="60" y="${y - 78}" width="960" height="${Math.max(138, 72 + bodyLines.length * 38)}" rx="14" fill="${CORE_COLORS.off_white}"/>`,
      `<circle cx="116" cy="${y - 28}" r="34" fill="${pillar.color}"/>`,
      textBlock({ x: 116, y: y - 16, lines: [String(index + 1)], size: 32, fill: CORE_COLORS.off_white, weight: 700, anchor: 'middle' }),
      textBlock({ x: 176, y: y - 36, lines: wrapText(row.label, 24, 1), size: 34, fill: CORE_COLORS.teal_deep, weight: 700 }),
      textBlock({ x: 176, y: y + 8, lines: bodyLines, size: 30, fill: '#293635', lineHeight: 38 }),
    ].join('');
  }).join(''));
}

function checklistCard(spec) {
  const items = spec.content.items || [];
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const startY = 430;
  const gap = items.length > 5 ? 116 : 132;

  return shell(spec, [
    `<rect x="60" y="356" width="960" height="730" rx="18" fill="${CORE_COLORS.off_white}"/>`,
    ...items.map((item, index) => {
      const y = startY + index * gap;
      return [
        `<circle cx="122" cy="${y - 10}" r="26" fill="${pillar.color}"/>`,
        `<path d="M110 ${y - 10} L120 ${y + 2} L138 ${y - 20}" fill="none" stroke="${CORE_COLORS.off_white}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
        textBlock({ x: 174, y, lines: wrapText(item.label, 44, 2), size: 32, fill: CORE_COLORS.teal_deep, weight: 600, lineHeight: 40 }),
      ].join('');
    }),
  ].join(''));
}

function posterStatement(spec) {
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const body = spec.content.body ? wrapText(spec.content.body, 38, 4) : [];
  const source = spec.content.sourceLabel ? wrapText(spec.content.sourceLabel, 42, 1) : [];

  return shell(spec, [
    `<rect x="60" y="380" width="960" height="642" rx="22" fill="${CORE_COLORS.off_white}"/>`,
    `<rect x="60" y="380" width="16" height="642" fill="${pillar.color}"/>`,
    textBlock({ x: 118, y: 504, lines: wrapText(spec.content.title, 22, 5), size: 68, fill: CORE_COLORS.teal_deep, weight: 700, lineHeight: 80 }),
    body.length ? textBlock({ x: 118, y: 820, lines: body, size: 34, fill: '#293635', lineHeight: 44 }) : '',
    source.length ? textBlock({ x: 118, y: 960, lines: source, size: 28, fill: CORE_COLORS.amber_ink, weight: 700 }) : '',
  ].join(''), { displayTitle: spec.content.kicker || 'Pesan penting' });
}

export function buildEducationalSvg(renderSpec) {
  const validation = validateRenderSpec(renderSpec);
  if (!validation.ok) {
    throw new Error(`invalid render spec: ${validation.errors.join('; ')}`);
  }
  if (!SUPPORTED_TEMPLATES.has(renderSpec.templateId)) {
    throw new Error(`unsupported educational template: ${renderSpec.templateId}`);
  }

  if (renderSpec.templateId === 'checklist_card') return checklistCard(renderSpec);
  if (renderSpec.templateId === 'poster_statement') return posterStatement(renderSpec);
  return editorialSteps(renderSpec);
}
