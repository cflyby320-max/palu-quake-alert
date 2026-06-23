// Branded educational card (1080x1350) for the evergreen track.
// PURE string builder: one bank "slide" -> an SVG string. Shares the exact brand
// header + honest-framing footer with the quake card via studio/svg.js, so the
// two can never diverge. A carousel is just N slides through this same builder.
// Bahasa Indonesia only.

import { PALETTE, T, wrap, svgOpen, SVG_CLOSE, brandHeader, honestFooter } from './svg.js';

// slide: { title, lines: [...] }. post: a bank.js entry (for accent + tag).
// opts.index / opts.total drive the "n/N" carousel counter.
export function buildEduCardSvg(slide, post, { index = 0, total = 1 } = {}) {
  const accent = post.accent;
  const p = [];
  p.push(svgOpen(`Palu Earthquake Alerts — ${accent.tag}: ${slide.title}`));

  // header: shared brand chrome (the pillar tag sits below it, as a pill, to
  // avoid overlapping the header subtitle)
  p.push(brandHeader());
  const tag = accent.tag;
  const pillW = 48 + tag.length * 17;
  p.push(`<rect x="72" y="240" width="${pillW}" height="56" rx="28" fill="${accent.bg}"/>`);
  p.push(T(72 + pillW / 2, 278, 28, accent.ink, tag, { weight: 600, anchor: 'middle' }));

  // title (up to 2 lines), with a short accent rule beneath it
  const titleLines = wrap(slide.title, 22, 2);
  let y = 376;
  titleLines.forEach((ln, i) => p.push(T(72, y + i * 70, 58, PALETTE.off, ln, { weight: 600 })));
  const ruleY = y + titleLines.length * 70 - 8;
  p.push(`<rect x="72" y="${ruleY}" width="132" height="10" rx="5" fill="${accent.bg}"/>`);

  // bullet body — each authored line wrapped to <=2 sub-lines; a dot per bullet
  let by = ruleY + 96;
  for (const line of slide.lines) {
    const sub = wrap(line, 52, 2);
    p.push(`<circle cx="84" cy="${by - 11}" r="9" fill="${accent.bg}"/>`);
    sub.forEach((ln, i) => p.push(T(116, by + i * 50, 34, PALETTE.mint, ln)));
    by += sub.length * 50 + 26;
  }

  // carousel counter (only when more than one slide)
  if (total > 1) {
    p.push(T(1036, 1168, 30, PALETTE.tealAccent, `${index + 1}/${total}`, { anchor: 'end' }));
  }

  // footer (honest framing — shared single source)
  p.push(honestFooter());
  p.push(SVG_CLOSE);
  return p.join('');
}

// All slides of a post as SVG strings, with the counter wired up.
export function buildEduSvgs(post) {
  const total = post.slides.length;
  return post.slides.map((slide, index) => buildEduCardSvg(slide, post, { index, total }));
}
