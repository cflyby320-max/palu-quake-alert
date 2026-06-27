// Deterministic educational card SVG builder.
//
// Evergreen cards use the Design SDK for color, canvas, and footer values.
// The renderer owns every visible text position and never calls the network.

import { CORE_COLORS, DESIGN_TOKENS, FEED_CANVAS, MANDATORY_FOOTER } from './design-sdk.js';
import { loadApprovedLocalSvgAsset } from './asset-library.js';
import { getTemplateSpec, validateRenderSpec } from './template-registry.js';

const SUPPORTED_TEMPLATES = new Set(['editorial_steps', 'checklist_card', 'poster_statement']);
const PAGE_MARGIN = 60;
const FOOTER_HEIGHT = 118;
const FOOTER_Y = FEED_CANVAS.height - FOOTER_HEIGHT;

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

function slotIds(spec, slotId) {
  const assigned = spec.assets?.slots?.[slotId];
  if (!assigned) return [];
  return Array.isArray(assigned) ? assigned : [assigned];
}

function slotPresentation(spec, slotId) {
  const template = getTemplateSpec(spec.templateId);
  const slot = template?.assetSlots?.find((entry) => entry.id === slotId);
  if (!slot?.presentation) throw new Error(`asset slot "${slotId}" has no presentation contract`);
  return slot.presentation;
}

function svgFit(fit) {
  if (fit === 'contain') return 'xMidYMid meet';
  if (fit === 'cover') return 'xMidYMid slice';
  throw new Error(`unsupported registry asset fit: ${fit}`);
}

function assetImage(assetId, {
  slotId,
  presentation,
  x,
  y,
  width,
  height,
  opacity = presentation.maxOpacity ?? 1,
}) {
  const { dataUri } = loadApprovedLocalSvgAsset(assetId);
  return [
    `<image data-asset-id="${esc(assetId)}"`,
    ` data-slot="${esc(slotId)}"`,
    ` data-role="${esc(presentation.role)}"`,
    ` data-region="${esc(presentation.region)}"`,
    ` data-fit="${esc(presentation.fit)}"`,
    ` data-layer="${esc(presentation.layer)}"`,
    ` href="${dataUri}" x="${x}" y="${y}" width="${width}" height="${height}"`,
    ` preserveAspectRatio="${svgFit(presentation.fit)}" opacity="${opacity}"/>`,
  ].join('');
}

function textBlock({
  x,
  y,
  lines,
  size,
  fill,
  weight = 400,
  lineHeight = Math.round(size * 1.22),
  anchor = 'start',
}) {
  return [
    `<text x="${x}" y="${y}" font-family="'DejaVu Sans'" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">`,
    ...lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`),
    '</text>',
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

function svgOpen(title, background) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FEED_CANVAS.width} ${FEED_CANVAS.height}" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" role="img">`,
    `<title>${esc(title)}</title>`,
    `<rect x="0" y="0" width="${FEED_CANVAS.width}" height="${FEED_CANVAS.height}" fill="${background}"/>`,
  ].join('');
}

function brandLockup({ y = 48, fill = CORE_COLORS.off_white } = {}) {
  return [
    `<circle cx="76" cy="${y - 8}" r="18" fill="none" stroke="${CORE_COLORS.teal_accent}" stroke-width="3"/>`,
    `<path d="M64 ${y - 8} L70 ${y - 8} L74 ${y - 19} L80 ${y + 3} L85 ${y - 12} L91 ${y - 12}" fill="none" stroke="${CORE_COLORS.amber}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    textBlock({
      x: 108,
      y,
      lines: ['PALU EARTHQUAKE ALERTS'],
      size: 23,
      fill,
      weight: 700,
    }),
  ].join('');
}

function pillarTag(pillar, { x = PAGE_MARGIN, y = 72 } = {}) {
  const text = `${pillar.shortCode ? `${pillar.shortCode} / ` : ''}${pillar.label}`;
  const width = Math.min(520, 100 + text.length * 14);
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="52" rx="26" fill="${pillar.color}"/>`,
    textBlock({
      x: x + width / 2,
      y: y + 36,
      lines: [text],
      size: 26,
      fill: CORE_COLORS.off_white,
      weight: 700,
      anchor: 'middle',
    }),
  ].join('');
}

function footer() {
  return [
    `<rect x="0" y="${FOOTER_Y}" width="${FEED_CANVAS.width}" height="${FOOTER_HEIGHT}" fill="${CORE_COLORS.teal_deep}"/>`,
    `<rect x="0" y="${FOOTER_Y}" width="${FEED_CANVAS.width}" height="3" fill="${CORE_COLORS.amber}"/>`,
    textBlock({
      x: PAGE_MARGIN,
      y: FOOTER_Y + 46,
      lines: [MANDATORY_FOOTER.currentLines[0]],
      size: 27,
      fill: CORE_COLORS.mint,
    }),
    textBlock({
      x: PAGE_MARGIN,
      y: FOOTER_Y + 82,
      lines: [MANDATORY_FOOTER.currentLines[1]],
      size: 27,
      fill: CORE_COLORS.mint,
    }),
    textBlock({
      x: FEED_CANVAS.width - PAGE_MARGIN,
      y: FOOTER_Y + 67,
      lines: [MANDATORY_FOOTER.handle],
      size: 30,
      fill: CORE_COLORS.off_white,
      weight: 700,
      anchor: 'end',
    }),
  ].join('');
}

function headerTitle(title, { compact = false } = {}) {
  const length = String(title).length;
  const size = compact ? (length > 26 ? 54 : 58) : length > 36 ? 52 : length > 26 ? 58 : 64;
  const maxChars = compact ? 18 : length > 36 ? 30 : length > 26 ? 27 : 24;
  return textBlock({
    x: PAGE_MARGIN,
    y: compact ? 194 : 206,
    lines: wrapText(title, maxChars, 2),
    size,
    fill: CORE_COLORS.off_white,
    weight: 700,
    lineHeight: size + 10,
  });
}

function editorialHeader(spec) {
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const ambientIds = slotIds(spec, 'ambient_pattern');
  const hasAmbient = ambientIds.length > 0;
  const ambientPresentation = hasAmbient ? slotPresentation(spec, 'ambient_pattern') : null;
  return [
    `<rect x="0" y="0" width="${FEED_CANVAS.width}" height="326" fill="${CORE_COLORS.teal}"/>`,
    hasAmbient
      ? assetImage(ambientIds[0], {
          slotId: 'ambient_pattern',
          presentation: ambientPresentation,
          x: 700,
          y: 136,
          width: 320,
          height: 154,
        })
      : [
          `<circle cx="970" cy="82" r="210" fill="none" stroke="${CORE_COLORS.teal_accent}" stroke-width="3" opacity="0.18"/>`,
          `<circle cx="970" cy="82" r="150" fill="none" stroke="${CORE_COLORS.teal_accent}" stroke-width="3" opacity="0.14"/>`,
          `<path d="M0 284 L180 210 L335 292 L520 172 L700 290 L870 205 L1080 278 L1080 326 L0 326 Z" fill="${CORE_COLORS.teal_deep}" opacity="0.58"/>`,
        ].join(''),
    brandLockup(),
    pillarTag(pillar),
    headerTitle(spec.content.title, { compact: hasAmbient }),
  ].join('');
}

function editorialShell(spec, content) {
  const title = `${spec.content.kicker || pillarMeta(spec.knowledge.pillarId).label} - ${spec.content.title}`;
  return [
    svgOpen(title, DESIGN_TOKENS.colors.core.paper || '#EEF3F2'),
    editorialHeader(spec),
    content,
    footer(),
    '</svg>',
  ].join('');
}

function editorialSteps(spec) {
  const rows = spec.content.rows || [];
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const rowIconIds = slotIds(spec, 'row_icons');
  const rowIconPresentation = rowIconIds.length ? slotPresentation(spec, 'row_icons') : null;
  const areaTop = 358;
  const areaBottom = FOOTER_Y - 34;
  const gap = 24;
  const rowHeight = Math.floor((areaBottom - areaTop - gap * (rows.length - 1)) / rows.length);

  const rowsContent = rows.map((row, index) => {
    const y = areaTop + index * (rowHeight + gap);
    const bodyLines = wrapText(row.body, 39, 3);
    const contentHeight = 42 + bodyLines.length * 39;
    const contentTop = y + Math.round((rowHeight - contentHeight) / 2);
    const iconId = rowIconIds[index];

    return [
      `<rect x="${PAGE_MARGIN}" y="${y}" width="960" height="${rowHeight}" rx="12" fill="${CORE_COLORS.off_white}"/>`,
      `<rect x="${PAGE_MARGIN}" y="${y}" width="10" height="${rowHeight}" rx="5" fill="${pillar.color}"/>`,
      iconId
        ? [
            `<rect x="82" y="${y + rowHeight / 2 - 46}" width="92" height="92" rx="18" fill="${DESIGN_TOKENS.colors.core.paper}"/>`,
            assetImage(iconId, {
              slotId: 'row_icons',
              presentation: rowIconPresentation,
              x: 90,
              y: y + rowHeight / 2 - 38,
              width: 76,
              height: 76,
            }),
          ].join('')
        : [
            `<circle cx="124" cy="${y + rowHeight / 2}" r="38" fill="${pillar.color}"/>`,
            textBlock({
              x: 124,
              y: y + rowHeight / 2 + 12,
              lines: [String(index + 1)],
              size: 32,
              fill: CORE_COLORS.off_white,
              weight: 700,
              anchor: 'middle',
            }),
          ].join(''),
      textBlock({
        x: 190,
        y: contentTop + 34,
        lines: wrapText(row.label, 25, 1),
        size: 35,
        fill: CORE_COLORS.teal_deep,
        weight: 700,
      }),
      textBlock({
        x: 190,
        y: contentTop + 80,
        lines: bodyLines,
        size: 30,
        fill: '#293635',
        lineHeight: 39,
      }),
    ].join('');
  }).join('');

  return editorialShell(spec, rowsContent);
}

function checklistCard(spec) {
  const items = spec.content.items || [];
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const focalIds = slotIds(spec, 'focal_illustration');
  const hasFocal = focalIds.length > 0;
  const focalPresentation = hasFocal ? slotPresentation(spec, 'focal_illustration') : null;
  const heroY = 344;
  const heroHeight = 270;
  const panelY = hasFocal ? 638 : 356;
  const panelHeight = FOOTER_Y - panelY - 34;
  const rowHeight = panelHeight / items.length;

  const content = [
    hasFocal
      ? [
          `<rect data-surface="solid_paper" x="${PAGE_MARGIN}" y="${heroY}" width="960" height="${heroHeight}" rx="12" fill="${DESIGN_TOKENS.colors.core.paper}"/>`,
          `<rect x="${PAGE_MARGIN}" y="${heroY}" width="8" height="${heroHeight}" rx="4" fill="${pillar.color}"/>`,
          assetImage(focalIds[0], {
            slotId: 'focal_illustration',
            presentation: focalPresentation,
            x: 170,
            y: heroY + 8,
            width: 740,
            height: heroHeight - 16,
          }),
        ].join('')
      : '',
    `<rect x="${PAGE_MARGIN}" y="${panelY}" width="960" height="${panelHeight}" rx="12" fill="${CORE_COLORS.off_white}"/>`,
    ...items.map((item, index) => {
      const y = panelY + index * rowHeight;
      const centerY = y + rowHeight / 2;
      return [
        index > 0
          ? `<line x1="96" y1="${y}" x2="984" y2="${y}" stroke="${DESIGN_TOKENS.colors.core.paper}" stroke-width="3"/>`
          : '',
        `<circle cx="124" cy="${centerY}" r="29" fill="${pillar.color}"/>`,
        `<path d="M111 ${centerY} L121 ${centerY + 11} L139 ${centerY - 13}" fill="none" stroke="${CORE_COLORS.off_white}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
        textBlock({
          x: 184,
          y: centerY + 11,
          lines: wrapText(item.label, 43, 2),
          size: 32,
          fill: CORE_COLORS.teal_deep,
          weight: 700,
          lineHeight: 40,
        }),
      ].join('');
    }),
  ].join('');

  return editorialShell(spec, content);
}

function posterStatement(spec) {
  const pillar = pillarMeta(spec.knowledge.pillarId);
  const backgroundIds = slotIds(spec, 'poster_background');
  const backgroundPresentation = backgroundIds.length
    ? slotPresentation(spec, 'poster_background')
    : null;
  const titleLines = wrapText(spec.content.title, 20, 5);
  const bodyLines = spec.content.body ? wrapText(spec.content.body, 38, 4) : [];
  const sourceLines = spec.content.sourceLabel ? wrapText(spec.content.sourceLabel, 42, 1) : [];

  const statement = [
    `<text x="${PAGE_MARGIN}" y="570" font-family="'DejaVu Sans'" font-size="78" font-weight="700" text-anchor="start">`,
    ...titleLines.map((line, index) => {
      const fill = index === titleLines.length - 1 ? pillar.color : CORE_COLORS.off_white;
      return `<tspan x="${PAGE_MARGIN}" dy="${index === 0 ? 0 : 90}" fill="${fill}">${esc(line)}</tspan>`;
    }),
    '</text>',
  ].join('');

  return [
    svgOpen(`${spec.content.kicker || pillar.label} - ${spec.content.title}`, CORE_COLORS.teal_deep),
    `<circle cx="540" cy="980" r="490" fill="none" stroke="${CORE_COLORS.teal_accent}" stroke-width="3" opacity="0.12"/>`,
    `<circle cx="540" cy="980" r="390" fill="none" stroke="${CORE_COLORS.teal_accent}" stroke-width="3" opacity="0.10"/>`,
    `<circle cx="540" cy="980" r="290" fill="none" stroke="${CORE_COLORS.teal_accent}" stroke-width="3" opacity="0.08"/>`,
    `<path d="M0 884 L230 620 L380 805 L610 392 L820 760 L1080 548 L1080 1232 L0 1232 Z" fill="${CORE_COLORS.teal}" opacity="0.34"/>`,
    backgroundIds[0]
      ? assetImage(backgroundIds[0], {
          slotId: 'poster_background',
          presentation: backgroundPresentation,
          x: 0,
          y: 270,
          width: FEED_CANVAS.width,
          height: 690,
          opacity: 0.34,
        })
      : '',
    brandLockup({ y: 64 }),
    pillarTag(pillar, { y: 116 }),
    statement,
    bodyLines.length
      ? textBlock({
          x: PAGE_MARGIN,
          y: 922,
          lines: bodyLines,
          size: 34,
          fill: CORE_COLORS.mint,
          lineHeight: 46,
        })
      : '',
    sourceLines.length
      ? textBlock({
          x: PAGE_MARGIN,
          y: 1112,
          lines: sourceLines,
          size: 29,
          fill: CORE_COLORS.teal_accent,
          weight: 700,
        })
      : '',
    footer(),
    '</svg>',
  ].join('');
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
